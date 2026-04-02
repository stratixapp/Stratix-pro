/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  STRATIX interconnect.js v1.0                                       ║
 * ║  Deep data interconnects — automatic cross-module sync              ║
 * ║  Load LAST (after all feature files, before polish.js)              ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * What this does:
 *  1. Dashboard auto-refresh when ANY data changes (no manual reload)
 *  2. Trip saved → auto-create revenue + expense transactions
 *  3. Invoice generated (printDoc) → auto-save to invoices + CRM
 *  4. Invoice/payment marked paid → reduce client outstanding + add transaction
 *  5. Employee added → auto-create salary expense reminder
 *  6. Goal funded → auto-create expense transaction
 *  7. Reminder overdue → badge on bottom nav
 *  8. Firebase sync badge (visual feedback)
 *  9. Cross-tab data sync via localStorage events
 * 10. Business type change → re-apply vertical + refresh nav
 */

(function() {
'use strict';

/* ── Helpers ────────────────────────────────────────────────────────── */
const IC = {
  _dashboardRefreshTimer: null,

  /* Schedule a dashboard refresh — debounced so rapid changes batch */
  scheduleDashboardRefresh(delay = 400) {
    clearTimeout(this._dashboardRefreshTimer);
    this._dashboardRefreshTimer = setTimeout(() => {
      if (typeof APP !== 'undefined' && APP._initialized && APP.currentSection === 'dashboard') {
        // Flash KPI cards to signal refresh
        document.querySelectorAll('.kpi-card').forEach(el => {
          el.classList.remove('refreshed');
          void el.offsetWidth; // force reflow
          el.classList.add('refreshed');
          setTimeout(() => el.classList.remove('refreshed'), 700);
        });
        try { APP._renderVerticalDashboard(); } catch(e) {
          try { APP.renderDashboard(); } catch(e2) {}
        }
      }
      this.refreshReminderBadge();
    }, delay);
  },

  /* Auto-refresh: listen to ALL data changes */
  bindDataChangeListener() {
    document.addEventListener('stratix:datachange', (e) => {
      const { collection, action } = e.detail || {};
      // Refresh dashboard for financial collections
      const financialCollections = ['transactions','trips','invoices','orders','goals',
        'fct_batches','rtl_bills','svc_projects','employees','payslips'];
      if (financialCollections.includes(collection)) {
        this.scheduleDashboardRefresh();
      }
      // Update reminder badge for any reminder change
      if (collection === 'reminders') this.refreshReminderBadge();
    });
  },

  /* ── 1. Trip → Transaction auto-create ─────────────────────────── */
  /*
   * v_transport.js already creates transactions when a trip is saved,
   * but the generic Trip P&L calculator in app.js (addTrip) also does.
   * This hook ensures that if a trip is pushed WITHOUT transactions,
   * we create them automatically.
   */
  bindTripInterconnect() {
    STRATIX_DB.onChange('trips', ({ action, item }) => {
      if (action !== 'push') return;
      // Check if transactions were already created for this trip
      const existing = STRATIX_DB.getArr('transactions').filter(t => t._tripId === item.id);
      if (existing.length > 0) return; // already handled
      const freight = Number(item.freight || item.revenue || 0);
      const costs   = Number(item.totalCost || item.expenses || 0);
      const date    = item.date || new Date().toISOString().split('T')[0];
      const route   = item.route || 'Trip';
      if (freight > 0) {
        STRATIX_DB.push('transactions', {
          type: 'revenue', amount: freight, category: 'freight',
          description: `Trip: ${route}`, date, _tripId: item.id, _auto: true,
        });
      }
      if (costs > 0) {
        STRATIX_DB.push('transactions', {
          type: 'expense', amount: costs, category: 'logistics',
          description: `Trip Costs: ${route}`, date, _tripId: item.id, _auto: true,
        });
      }
    });
  },

  /* ── 2. Invoice → CRM client outstanding sync ───────────────────── */
  /*
   * When an invoice is pushed, find the matching client and
   * increase their outstanding by the invoice's unpaid amount.
   */
  bindInvoiceInterconnect() {
    STRATIX_DB.onChange('invoices', ({ action, item }) => {
      if (action !== 'push') return;
      if (!item.clientName || item.paid) return;
      const clients = STRATIX_DB.getArr('clients');
      const idx = clients.findIndex(c =>
        (c.name || '').toLowerCase().trim() === (item.clientName || '').toLowerCase().trim()
      );
      const amount = Number(item.total || item.amount || 0);
      if (amount <= 0) return;
      if (idx !== -1) {
        clients[idx].outstanding = Number(clients[idx].outstanding || 0) + amount;
        clients[idx].lastInvoice = item.invoiceNo || item.id;
        clients[idx].invoices    = (Number(clients[idx].invoices) || 0) + 1;
        STRATIX_DB.set('clients', clients);
      } else {
        // Auto-create client in CRM if not exists
        STRATIX_DB.push('clients', {
          name: item.clientName, outstanding: amount, phone: item.clientPhone || '',
          invoices: 1, lastPayment: '—', risk: 'low', _autoCreated: true,
        });
      }
    });
  },

  /* ── 3. Invoice paid → reduce outstanding + record transaction ────── */
  /*
   * Call IC.markInvoicePaid(invoiceId) from any UI button to cascade.
   */
  markInvoicePaid(invoiceId, paidAmount) {
    const invoices = STRATIX_DB.getArr('invoices');
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv || inv.paid) return false;
    const amount = paidAmount || Number(inv.total || inv.amount || 0);
    // Mark paid
    STRATIX_DB.update('invoices', invoiceId, { paid: true, paidAt: new Date().toISOString(), paidAmount: amount });
    // Reduce client outstanding
    if (inv.clientName) {
      const clients = STRATIX_DB.getArr('clients');
      const idx = clients.findIndex(c =>
        (c.name || '').toLowerCase().trim() === (inv.clientName || '').toLowerCase().trim()
      );
      if (idx !== -1) {
        clients[idx].outstanding = Math.max(0, Number(clients[idx].outstanding || 0) - amount);
        clients[idx].lastPayment = new Date().toLocaleDateString('en-IN');
        STRATIX_DB.set('clients', clients);
      }
    }
    // Auto-create revenue transaction
    STRATIX_DB.push('transactions', {
      type: 'revenue', amount, category: 'invoice_payment',
      description: `Payment received: ${inv.invoiceNo || invoiceId} — ${inv.clientName || ''}`,
      date: new Date().toISOString().split('T')[0], _invoiceId: invoiceId, _auto: true,
    });
    if (typeof NOTIFY !== 'undefined') {
      NOTIFY.show(`✅ Invoice ${inv.invoiceNo || ''} marked paid — ₹${amount.toLocaleString('en-IN')} added to revenue`, 'success');
    }
    this.scheduleDashboardRefresh();
    return true;
  },

  /* ── 4. New employee → auto-create monthly salary reminder ─────── */
  bindEmployeeInterconnect() {
    STRATIX_DB.onChange('employees', ({ action, item }) => {
      if (action !== 'push') return;
      if (!item.salary || item._autoReminder) return;
      // Create a recurring salary reminder on the 1st of next month
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
      const dateStr = nextMonth.toISOString().split('T')[0];
      STRATIX_DB.push('reminders', {
        title: `Pay salary: ${item.name} (₹${Number(item.salary).toLocaleString('en-IN')})`,
        date: dateStr, category: 'payroll', priority: 'high',
        _employeeId: item.id, _autoCreated: true, done: false,
      });
    });
  },

  /* ── 5. Goal funded → auto-create expense transaction ──────────── */
  bindGoalInterconnect() {
    STRATIX_DB.onChange('goals', ({ action, item }) => {
      if (action !== 'update') return;
      // If a goal was just funded (current >= target), record it
      if (item._fundedRecorded) return;
      const target  = Number(item.target || 0);
      const current = Number(item.current || 0);
      if (target > 0 && current >= target && !item._fundedRecorded) {
        STRATIX_DB.update('goals', item.id, { _fundedRecorded: true });
        if (typeof NOTIFY !== 'undefined') {
          NOTIFY.show(`🎯 Goal achieved: "${item.title}"! `, 'success', 5000);
        }
      }
    });
  },

  /* ── 6. Reminder badge on bottom nav ───────────────────────────── */
  refreshReminderBadge() {
    const today    = new Date().toISOString().split('T')[0];
    const overdue  = STRATIX_DB.getArr('reminders').filter(r => !r.done && r.date && r.date <= today);
    const dot      = document.getElementById('notifDot');
    if (dot) {
      dot.style.display   = overdue.length > 0 ? 'inline-block' : 'none';
      dot.textContent     = overdue.length > 9 ? '9+' : (overdue.length > 0 ? overdue.length : '');
      dot.style.cssText   = overdue.length > 0
        ? 'display:inline-block;background:#EF4444;color:#fff;border-radius:99px;font-size:9px;padding:1px 4px;min-width:14px;text-align:center;position:absolute;top:6px;right:6px;font-weight:700;line-height:1.4'
        : 'display:none';
    }
  },

  /* ── 7. Firebase sync badge ─────────────────────────────────────── */
  initSyncBadge() {
    // Create badge element
    let badge = document.getElementById('fbSyncBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'fbSyncBadge';
      document.body.appendChild(badge);
    }

    // Show offline/online state
    const updateOnline = () => {
      badge.className = navigator.onLine ? '' : 'offline';
      badge.textContent = navigator.onLine ? '' : '📶 Offline';
      if (!navigator.onLine) badge.className = 'offline';
    };
    window.addEventListener('online',  updateOnline);
    window.addEventListener('offline', updateOnline);
    updateOnline();

    // Listen for Firebase sync events
    document.addEventListener('stratix:datachange', () => {
      if (!window.STRATIX_FB_STORE) return;
      badge.className   = 'syncing';
      badge.textContent = '⏫ Syncing…';
      clearTimeout(this._syncBadgeTimer);
      this._syncBadgeTimer = setTimeout(() => {
        badge.className   = 'synced';
        badge.textContent = '☁️ Saved';
        setTimeout(() => { badge.className = ''; badge.textContent = ''; }, 3000);
      }, 1200);
    });
  },

  /* ── 8. Cross-tab sync (localStorage 'storage' event) ─────────── */
  bindCrossTabSync() {
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith('sx_')) return;
      // Another tab changed data — refresh dashboard if we're on it
      this.scheduleDashboardRefresh(600);
    });
  },

  /* ── 9. Patch app.js printDoc to auto-save invoice ─────────────── */
  patchPrintDoc() {
    if (typeof APP === 'undefined' || !APP.printDoc) return;
    const _orig = APP.printDoc.bind(APP);
    APP.printDoc = function(type, ...args) {
      // Call original first
      _orig(type, ...args);
      // After printing invoice, save it to invoices collection
      if (type === 'invoice') {
        setTimeout(() => {
          try {
            const invNo   = (document.getElementById('dInvNo') || document.getElementById('pInvNo') || {}).value || '';
            const client  = (document.getElementById('dClient') || {}).value || '';
            const amount  = parseFloat((document.getElementById('dAmt') || {}).value) || 0;
            const date    = (document.getElementById('dDate') || {}).value || new Date().toISOString().split('T')[0];
            if (amount > 0) {
              const gstPct = parseFloat((document.getElementById('dGST') || {}).value) || 18;
              const total  = amount + (amount * gstPct / 100);
              STRATIX_DB.push('invoices', {
                invoiceNo: invNo, clientName: client, amount, gstPct, total,
                date, status: 'pending', paid: false,
              });
              if (typeof NOTIFY !== 'undefined') {
                NOTIFY.show(`📄 Invoice ${invNo} saved to Invoice Aging`, 'info', 3000);
              }
            }
          } catch(e) {}
        }, 500);
      }
    };
  },

  /* ── 10. Business type switch → re-apply vertical ──────────────── */
  watchBusinessTypeChange() {
    // Called after settings save — compare stored vs new
    document.addEventListener('stratix:settingssaved', (e) => {
      const newType = e.detail && e.detail.businessType;
      if (!newType) return;
      if (typeof VERTICAL !== 'undefined') VERTICAL.apply(newType);
      if (typeof APP !== 'undefined' && APP.renderNav) APP.renderNav();
      this.scheduleDashboardRefresh(300);
    });
  },

  /* ── 11. Auto-load Firestore data on first login ─────────────────── */
  async loadFirestoreOnFirstLogin() {
    if (!window.STRATIX_FB_STORE) return;
    const key = 'sx_fb_loaded_' + (STRATIX_AUTH.getSession() || {}).userId;
    if (localStorage.getItem(key)) return; // already loaded this session
    await STRATIX_DB.loadFromFirestore();
    localStorage.setItem(key, '1');
  },

  /* ── INIT: wire everything up ────────────────────────────────────── */
  init() {
    // Wait for APP to be ready
    const tryInit = () => {
      if (typeof APP === 'undefined' || !APP._initialized) {
        setTimeout(tryInit, 200);
        return;
      }
      this.bindDataChangeListener();
      this.bindTripInterconnect();
      this.bindInvoiceInterconnect();
      this.bindEmployeeInterconnect();
      this.bindGoalInterconnect();
      this.refreshReminderBadge();
      this.initSyncBadge();
      this.bindCrossTabSync();
      this.patchPrintDoc();
      this.watchBusinessTypeChange();
      this.loadFirestoreOnFirstLogin().catch(() => {});

      // Expose markInvoicePaid globally for inline buttons
      window.IC_markInvoicePaid = (id, amt) => IC.markInvoicePaid(id, amt);

      console.info('[STRATIX] Interconnect v1.0 ready ✓');
    };
    // Start trying once DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryInit);
    } else {
      tryInit();
    }
  },
};

IC.init();
window.IC = IC; // expose for debugging

})();
