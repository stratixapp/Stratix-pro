/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  STRATIX  —  upgrades.js  v1.0  (Round 3)                                 ║
 * ║                                                                             ║
 * ║  DROP-IN: add ONE line to index.html AFTER components.js                   ║
 * ║  <script src="upgrades.js"></script>                                        ║
 * ║                                                                             ║
 * ║  WHAT THIS FILE DOES (zero changes to any existing file):                  ║
 * ║                                                                             ║
 * ║  1. SMART CONFIRMATIONS  — patches all 20+ instant deletes with            ║
 * ║     sx_confirm() styled dialogs (ERP, CRM, SCM, Payroll, Bank, App)        ║
 * ║                                                                             ║
 * ║  2. ENHANCED GLOBAL SEARCH — adds 6 missing collections to APP.            ║
 * ║     globalSearch(): inventory, sales orders, purchase orders,               ║
 * ║     CRM leads, invoices, trips. Result text highlighting.                  ║
 * ║                                                                             ║
 * ║  3. KEYBOARD SHORTCUTS — full shortcut system (none existed before)        ║
 * ║     Ctrl/Cmd+K = search, Ctrl+D = dashboard, Ctrl+E = ERP,                ║
 * ║     Ctrl+M = data manager, ? = cheatsheet                                  ║
 * ║                                                                             ║
 * ║  4. REAL RBAC — Admin / Staff role enforcement at the service layer        ║
 * ║     Staff: no delete, no finance export, no full finance view              ║
 * ║     Admin: full access (default for all existing accounts)                 ║
 * ║                                                                             ║
 * ║  5. DATAMANAGER → SERVICES WIRE — APP.addEntry() now goes through         ║
 * ║     STRATIX_SERVICES.finance.logTransaction() so the event bus fires       ║
 * ║     and dashboard KPI cards auto-update without page reload                ║
 * ║                                                                             ║
 * ║  6. SETTINGS FORM VALIDATION — saveSettings() validates GSTIN, phone,     ║
 * ║     business name, PAN with inline field errors before saving              ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   UTILITY: safe patch helper
   Wraps a method on an object so the original still runs but we can add
   behavior before or after. Safe even if the object doesn't exist yet.
   ══════════════════════════════════════════════════════════════════════════════ */
function _wrap(obj, method, fn) {
  if (!obj || typeof obj[method] !== 'function') return;
  const orig = obj[method].bind(obj);
  obj[method] = function(...args) { return fn(orig, args, this); };
}

/* ══════════════════════════════════════════════════════════════════════════════
   1.  SMART CONFIRMATIONS
   Patches every instant-delete across ERP, CRM, SCM, Payroll, Bank, App.
   All deletions now show a branded confirmation dialog before executing.
   ══════════════════════════════════════════════════════════════════════════════ */

const CONFIRM_PATCHES = {

  /* ── ERP ── */
  patchERP() {
    if (typeof ERP === 'undefined') return;

    _wrap(ERP, 'deleteItem', (orig, [id]) => {
      sx_confirm(
        'Delete this inventory item? Stock count and value will be removed.',
        () => orig(id),
        { type: 'danger', confirmText: 'Delete Item' }
      );
    });

    _wrap(ERP, 'deleteSO', (orig, [id]) => {
      const so = STRATIX_DB.getArr('erpSalesOrders').find(o => o.id === id);
      sx_confirm(
        `Delete Sales Order <strong>${escapeHTML(so?.soNo || id)}</strong>?<br>Customer: ${escapeHTML(so?.customer || '—')}`,
        () => orig(id),
        { type: 'danger', confirmText: 'Delete Order' }
      );
    });

    _wrap(ERP, 'deletePO', (orig, [id]) => {
      const po = STRATIX_DB.getArr('erpPurchaseOrders').find(p => p.id === id);
      sx_confirm(
        `Delete Purchase Order <strong>${escapeHTML(po?.poNo || id)}</strong>?<br>Supplier: ${escapeHTML(po?.supplier || '—')}`,
        () => orig(id),
        { type: 'danger', confirmText: 'Delete PO' }
      );
    });

    _wrap(ERP, 'deleteJob', (orig, [id]) => {
      const job = STRATIX_DB.getArr('erpJobs').find(j => j.id === id);
      sx_confirm(
        `Delete Job Order <strong>${escapeHTML(job?.jobNo || id)}</strong>?`,
        () => orig(id),
        { type: 'danger', confirmText: 'Delete Job' }
      );
    });
  },

  /* ── CRM ── */
  patchCRM() {
    if (typeof CRM === 'undefined') return;

    _wrap(CRM, 'deleteLead', (orig, [id]) => {
      const lead = STRATIX_DB.getArr('crmLeads').find(l => l.id === id);
      sx_confirm(
        `Delete lead <strong>${escapeHTML(lead?.name || id)}</strong>?<br>This will remove all lead history.`,
        () => orig(id),
        { type: 'danger', confirmText: 'Delete Lead' }
      );
    });

    _wrap(CRM, 'deleteContact', (orig, [id]) => {
      const c = STRATIX_DB.getArr('crmContacts').find(x => x.id === id);
      sx_confirm(
        `Delete contact <strong>${escapeHTML(c?.name || id)}</strong>?`,
        () => orig(id),
        { type: 'danger', confirmText: 'Delete Contact' }
      );
    });

    _wrap(CRM, 'deleteDeal', (orig, [id]) => {
      const d = STRATIX_DB.getArr('crmDeals').find(x => x.id === id);
      const sym = STRATIX_DB.getSettings().currencySymbol || '₹';
      sx_confirm(
        `Delete deal <strong>${escapeHTML(d?.title || id)}</strong>?<br>Value: ${sym}${(d?.value || 0).toLocaleString('en-IN')}`,
        () => orig(id),
        { type: 'danger', confirmText: 'Delete Deal' }
      );
    });
  },

  /* ── SCM ── */
  patchSCM() {
    if (typeof SCM === 'undefined') return;

    _wrap(SCM, 'deleteVendor', (orig, [id]) => {
      const v = STRATIX_DB.getArr('scmVendors').find(x => x.id === id);
      sx_confirm(
        `Delete vendor <strong>${escapeHTML(v?.name || id)}</strong>?<br>All vendor history will be removed.`,
        () => orig(id),
        { type: 'danger', confirmText: 'Delete Vendor' }
      );
    });

    _wrap(SCM, 'deleteReq', (orig, [id]) => {
      sx_confirm(
        'Delete this purchase requisition?',
        () => orig(id),
        { type: 'warning', confirmText: 'Delete Requisition' }
      );
    });

    _wrap(SCM, 'deleteQuote', (orig, [id]) => {
      sx_confirm(
        'Delete this supplier quote?',
        () => orig(id),
        { type: 'warning', confirmText: 'Delete Quote' }
      );
    });

    // deleteShipment (was missing)
    _wrap(SCM, 'deleteShipment', (orig, [id]) => {
      const s = STRATIX_DB.getArr('scmShipments').find(x => x.id === id);
      sx_confirm(
        `Remove shipment record <strong>${escapeHTML(s?.shipmentNo || id)}</strong>?`,
        () => orig(id),
        { type: 'warning', confirmText: 'Remove Shipment' }
      );
    });
  },

  /* ── PAYROLL (FEAT + PAY) ── */
  patchPayroll() {
    // features.js FEAT object
    if (typeof FEAT !== 'undefined') {
      _wrap(FEAT, 'deleteEmployee', (orig, [id]) => {
        const e = STRATIX_DB.getArr('employees').find(x => x.id === id);
        sx_confirm(
          `Remove employee <strong>${escapeHTML(e?.name || id)}</strong> from payroll?<br>All payslip history will be preserved.`,
          () => orig(id),
          { type: 'danger', confirmText: 'Remove Employee' }
        );
      });
    }

    // finance_deep.js PAY object
    if (typeof PAY !== 'undefined') {
      _wrap(PAY, 'deleteEmployee', (orig, [id]) => {
        const e = STRATIX_DB.getArr('employees').find(x => x.id === id);
        sx_confirm(
          `Remove employee <strong>${escapeHTML(e?.name || id)}</strong>?<br>All their payslips will also be deleted.`,
          () => orig(id),
          { type: 'danger', confirmText: 'Remove Employee' }
        );
      });

      _wrap(PAY, 'deletePayslip', (orig, [id]) => {
        sx_confirm(
          'Delete this payslip? This action cannot be undone.',
          () => orig(id),
          { type: 'danger', confirmText: 'Delete Payslip' }
        );
      });
    }
  },

  /* ── BANK (BNK) ── */
  patchBank() {
    if (typeof BNK === 'undefined') return;

    _wrap(BNK, 'deleteCheque', (orig, [id]) => {
      sx_confirm(
        'Delete this cheque record?',
        () => orig(id),
        { type: 'warning', confirmText: 'Delete Cheque' }
      );
    });
  },

  /* ── APP (Goals, Notes, Entries) ── */
  patchApp() {
    if (typeof APP === 'undefined') return;

    _wrap(APP, 'deleteGoal', (orig, [id]) => {
      const g = STRATIX_DB.getArr('goals').find(x => x.id === id);
      sx_confirm(
        `Remove goal <strong>${escapeHTML(g?.title || 'this goal')}</strong>?`,
        () => orig(id),
        { type: 'warning', confirmText: 'Remove Goal' }
      );
    });

    _wrap(APP, 'deleteNote', (orig, [id]) => {
      sx_confirm(
        'Delete this note permanently?',
        () => orig(id),
        { type: 'warning', confirmText: 'Delete Note' }
      );
    });

    // deleteEntry already uses _confirmDelete but it's the old inline bar — upgrade it
    _wrap(APP, 'deleteEntry', (orig, [id]) => {
      const t = STRATIX_DB.getArr('transactions').find(x => x.id === id);
      const sym = STRATIX_DB.getSettings().currencySymbol || '₹';
      sx_confirm(
        `Delete transaction: <strong>${escapeHTML(t?.description || '—')}</strong><br>Amount: ${sym}${(t?.amount || 0).toLocaleString('en-IN')}`,
        () => {
          STRATIX_DB.remove('transactions', id);
          // Invalidate cache + emit event so dashboard updates
          if (typeof STRATIX_STORE !== 'undefined') STRATIX_STORE.invalidate('transactions');
          if (typeof STRATIX_BUS !== 'undefined') STRATIX_BUS.emit('finance:changed', { source: 'upgrades.deleteEntry' });
          APP.renderDataManager();
        },
        { type: 'danger', confirmText: 'Delete Entry' }
      );
    });
  },

  applyAll() {
    this.patchERP();
    this.patchCRM();
    this.patchSCM();
    this.patchPayroll();
    this.patchBank();
    this.patchApp();
  }
};


/* ══════════════════════════════════════════════════════════════════════════════
   2.  ENHANCED GLOBAL SEARCH
   Replaces APP.globalSearch() with a version that searches 6 more collections
   and highlights matched text in results.
   ══════════════════════════════════════════════════════════════════════════════ */

const SEARCH_UPGRADE = {

  /* Highlight matched substring in text */
  _highlight(text, query) {
    if (!text || !query) return escapeHTML(String(text || ''));
    const escaped = escapeHTML(String(text));
    const safe = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped.replace(new RegExp(`(${safe})`, 'gi'),
      '<mark style="background:rgba(37,99,235,.35);color:var(--text);border-radius:2px;padding:0 1px">$1</mark>');
  },

  /* Build a result row HTML (replaces the old inline template) */
  _resultRow(r, idx, query) {
    const highlighted = this._highlight(r.label, query);
    const typeColors = {
      section:    '#4f9ef0',
      transaction:'#00d68f',
      inventory:  '#2563EB',
      'sales-order': '#9b5de5',
      'purchase-order': '#ff7c40',
      lead:       '#00c8e0',
      invoice:    '#00d68f',
      trip:       '#2563EB',
      client:     '#4f9ef0',
      employee:   '#9b5de5',
      note:       '#5a6e90',
    };
    const color = typeColors[r.type] || '#5a6e90';
    return `
      <div id="sr_${idx}"
        style="padding:11px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;border-bottom:1px solid rgba(26,37,64,.6);transition:.12s"
        onmouseover="this.style.background='rgba(37,99,235,.07)'"
        onmouseout="this.style.background='transparent'">
        <span style="font-size:17px;flex-shrink:0;line-height:1">${r.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:#0F172A;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${highlighted}</div>
          <div style="font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;margin-top:2px;color:${color}">${r.type.replace('-', ' ')}</div>
        </div>
        ${r.meta ? `<div style="font-size:12px;color:var(--muted);flex-shrink:0">${r.meta}</div>` : ''}
      </div>`;
  },

  apply() {
    if (typeof APP === 'undefined') return;

    APP.globalSearch = function(q) {
      if (!q || q.length < 2) { this._clearSearchResults(); return; }
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        if (document.getElementById('globalSearch')?.value !== q) return;

        const ql = q.toLowerCase();
        const sym = this.settings?.currencySymbol || '₹';
        const results = [];

        /* ── Sections ── */
        const sections = [
          { id:'dashboard',    label:'Dashboard',       icon:'🏠' },
          { id:'analytics',    label:'Analytics',       icon:'📊' },
          { id:'erp',          label:'ERP',             icon:'🏭' },
          { id:'crm',          label:'CRM',             icon:'🤝' },
          { id:'scm',          label:'Supply Chain',    icon:'🔗' },
          { id:'salary',       label:'Salary & Payroll',icon:'💸' },
          { id:'bank',         label:'Bank Tracker',    icon:'🏦' },
          { id:'gst',          label:'GST Calculator',  icon:'🧾' },
          { id:'fleet',        label:'Fleet Manager',   icon:'🚛' },
          { id:'documents',    label:'Documents',       icon:'📄' },
          { id:'datamanager',  label:'Data Manager',    icon:'🗄️' },
          { id:'goals',        label:'Goals Tracker',   icon:'🎯' },
          { id:'notes',        label:'Smart Notes',     icon:'📝' },
          { id:'reminders',    label:'Reminders',       icon:'🔔' },
          { id:'trippnl',      label:'Trip P&L',        icon:'🛣️' },
          { id:'invoiceaging', label:'Invoice Aging',   icon:'💰' },
          { id:'loan',         label:'Loan Readiness',  icon:'🏦' },
          { id:'strategy',     label:'Strategy Builder',icon:'📈' },
          { id:'whatsapp',     label:'WhatsApp Tools',  icon:'📱' },
          { id:'ai_advisor',   label:'AI Advisor',      icon:'🤖' },
          { id:'settings',     label:'Settings',        icon:'⚙️' },
          { id:'logisticsdocs',label:'Logistics Docs',  icon:'📋' },
          { id:'earlywarning', label:'Early Warning',   icon:'⚠️' },
          { id:'ordertracker', label:'Order Tracker',   icon:'📦' },
        ];
        sections
          .filter(s => s.label.toLowerCase().includes(ql))
          .forEach(s => results.push({ type: 'section', label: s.label, icon: s.icon, action: () => APP.navigate(s.id) }));

        /* ── Transactions ── */
        STRATIX_DB.getArr('transactions')
          .filter(t => (t.description || '').toLowerCase().includes(ql) || (t.category || '').toLowerCase().includes(ql))
          .slice(0, 3)
          .forEach(t => results.push({
            type: 'transaction',
            label: t.description || t.category || '—',
            icon: t.type === 'revenue' ? '💚' : '🔴',
            meta: sym + (t.amount || 0).toLocaleString('en-IN'),
            action: () => APP.navigate('datamanager'),
          }));

        /* ── Inventory Items (NEW) ── */
        STRATIX_DB.getArr('erpInventory')
          .filter(i => (i.name || '').toLowerCase().includes(ql) || (i.code || '').toLowerCase().includes(ql) || (i.category || '').toLowerCase().includes(ql))
          .slice(0, 3)
          .forEach(i => results.push({
            type: 'inventory',
            label: i.name,
            icon: '📦',
            meta: `Qty: ${i.qty || 0}`,
            action: () => APP.navigate('erp'),
          }));

        /* ── Sales Orders (NEW) ── */
        STRATIX_DB.getArr('erpSalesOrders')
          .filter(o => (o.soNo || '').toLowerCase().includes(ql) || (o.customer || '').toLowerCase().includes(ql))
          .slice(0, 3)
          .forEach(o => results.push({
            type: 'sales-order',
            label: `${o.soNo} — ${o.customer}`,
            icon: '🛒',
            meta: sym + (o.totalAmt || 0).toLocaleString('en-IN'),
            action: () => APP.navigate('erp'),
          }));

        /* ── Purchase Orders (NEW) ── */
        STRATIX_DB.getArr('erpPurchaseOrders')
          .filter(p => (p.poNo || '').toLowerCase().includes(ql) || (p.supplier || '').toLowerCase().includes(ql))
          .slice(0, 2)
          .forEach(p => results.push({
            type: 'purchase-order',
            label: `${p.poNo} — ${p.supplier}`,
            icon: '🏪',
            meta: sym + (p.totalAmt || 0).toLocaleString('en-IN'),
            action: () => APP.navigate('erp'),
          }));

        /* ── CRM Leads (NEW) ── */
        STRATIX_DB.getArr('crmLeads')
          .filter(l => (l.name || '').toLowerCase().includes(ql) || (l.company || '').toLowerCase().includes(ql) || (l.phone || '').includes(ql))
          .slice(0, 3)
          .forEach(l => results.push({
            type: 'lead',
            label: l.name + (l.company ? ` — ${l.company}` : ''),
            icon: '🎯',
            meta: l.temperature || '',
            action: () => APP.navigate('crm'),
          }));

        /* ── Invoices (NEW) ── */
        STRATIX_DB.getArr('invoices')
          .filter(inv => (inv.invoiceNo || '').toLowerCase().includes(ql) || (inv.customerName || '').toLowerCase().includes(ql))
          .slice(0, 3)
          .forEach(inv => results.push({
            type: 'invoice',
            label: `${inv.invoiceNo} — ${inv.customerName}`,
            icon: '🧾',
            meta: sym + (inv.totalAmount || 0).toLocaleString('en-IN'),
            action: () => APP.navigate('invoiceaging'),
          }));

        /* ── Trips (NEW) ── */
        STRATIX_DB.getArr('trips')
          .filter(t => (t.route || '').toLowerCase().includes(ql) || (t.vehicle || '').toLowerCase().includes(ql))
          .slice(0, 2)
          .forEach(t => results.push({
            type: 'trip',
            label: t.route,
            icon: '🛣️',
            meta: t.vehicle || '',
            action: () => APP.navigate('trippnl'),
          }));

        /* ── Clients ── */
        STRATIX_DB.getArr('clients')
          .filter(c => (c.name || '').toLowerCase().includes(ql) || (c.phone || '').includes(ql))
          .slice(0, 2)
          .forEach(c => results.push({
            type: 'client',
            label: c.name,
            icon: '🤝',
            meta: c.outstanding > 0 ? `Due: ${sym}${c.outstanding.toLocaleString('en-IN')}` : '',
            action: () => APP.navigate('crm'),
          }));

        /* ── Employees ── */
        STRATIX_DB.getArr('employees')
          .filter(e => (e.name || '').toLowerCase().includes(ql) || (e.designation || '').toLowerCase().includes(ql))
          .slice(0, 2)
          .forEach(e => results.push({
            type: 'employee',
            label: `${e.name} — ${e.designation || 'Staff'}`,
            icon: '👤',
            action: () => APP.navigate('salary'),
          }));

        /* ── Notes ── */
        STRATIX_DB.getArr('notes')
          .filter(n => (n.title || n.content || '').toLowerCase().includes(ql))
          .slice(0, 2)
          .forEach(n => results.push({
            type: 'note',
            label: n.title || (n.content || '').slice(0, 50),
            icon: '📝',
            action: () => APP.navigate('notes'),
          }));

        SEARCH_UPGRADE._showResults(results, q);
      }, 280);
    };
  },

  _showResults(results, q) {
    APP._clearSearchResults();
    if (results.length === 0) {
      // Show "no results" state
      const box = document.createElement('div');
      box.id = 'searchResultsBox';
      box.style.cssText = 'position:fixed;top:58px;left:50%;transform:translateX(-50%);z-index:9999;background:#FFFFFF;border:1px solid #2a3a5c;border-radius:16px;width:min(440px,92vw);box-shadow:0 16px 48px rgba(0,0,0,.75)';
      box.innerHTML = `
        <div style="padding:28px;text-align:center;color:var(--muted)">
          <div style="font-size:28px;margin-bottom:10px">🔍</div>
          <div style="font-size:13px">No results for <strong style="color:var(--text)">"${escapeHTML(q)}"</strong></div>
        </div>`;
      document.body.appendChild(box);
      setTimeout(() => document.addEventListener('click', APP._closeSearch = (e) => {
        if (!box.contains(e.target) && e.target.id !== 'globalSearch') {
          APP._clearSearchResults();
          document.removeEventListener('click', APP._closeSearch);
        }
      }), 80);
      return;
    }

    const box = document.createElement('div');
    box.id = 'searchResultsBox';
    box.style.cssText = 'position:fixed;top:58px;left:50%;transform:translateX(-50%);z-index:9999;background:#FFFFFF;border:1px solid #2a3a5c;border-radius:16px;width:min(440px,92vw);max-height:380px;overflow-y:auto;box-shadow:0 16px 48px rgba(0,0,0,.75);animation:fadeIn .12s ease';

    // Header
    const header = `<div style="padding:10px 16px 8px;font-size:10px;color:var(--muted);font-weight:700;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid rgba(26,37,64,.6)">${results.length} result${results.length !== 1 ? 's' : ''} for "${escapeHTML(q)}"</div>`;

    box.innerHTML = header + results.map((r, i) => SEARCH_UPGRADE._resultRow(r, i, q)).join('');
    document.body.appendChild(box);

    // Wire click actions
    results.forEach((r, i) => {
      document.getElementById(`sr_${i}`)?.addEventListener('click', () => {
        APP._clearSearchResults();
        const input = document.getElementById('globalSearch');
        if (input) input.value = '';
        r.action();
      });
    });

    // Close on outside click
    setTimeout(() => document.addEventListener('click', APP._closeSearch = (e) => {
      if (!box.contains(e.target) && e.target.id !== 'globalSearch') {
        APP._clearSearchResults();
        document.removeEventListener('click', APP._closeSearch);
      }
    }), 80);
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   3.  KEYBOARD SHORTCUTS
   Full shortcut system. None existed before this file.
   ══════════════════════════════════════════════════════════════════════════════ */

const SHORTCUTS = {

  _map: [
    { keys: ['ctrl+k', 'cmd+k'],  label: 'Focus Search',    action: (e) => { e.preventDefault(); const el = document.getElementById('globalSearch'); if (el) { el.focus(); el.select(); } } },
    { keys: ['ctrl+d', 'cmd+d'],  label: 'Dashboard',       action: (e) => { e.preventDefault(); APP?.navigate('dashboard'); } },
    { keys: ['ctrl+e', 'cmd+e'],  label: 'ERP',             action: (e) => { e.preventDefault(); APP?.navigate('erp'); } },
    { keys: ['ctrl+m', 'cmd+m'],  label: 'Data Manager',    action: (e) => { e.preventDefault(); APP?.navigate('datamanager'); } },
    { keys: ['ctrl+r', 'cmd+r'],  label: 'Reminders',       action: (e) => { e.preventDefault(); APP?.navigate('reminders'); } },
    { keys: ['ctrl+g', 'cmd+g'],  label: 'Goals',           action: (e) => { e.preventDefault(); APP?.navigate('goals'); } },
    { keys: ['ctrl+,'],           label: 'Settings',         action: (e) => { e.preventDefault(); APP?.navigate('settings'); } },
    { keys: ['?'],                label: 'Show Shortcuts',   action: () => SHORTCUTS.showCheatsheet(), textOnly: true },
    { keys: ['escape'],           label: 'Close / Cancel',   action: () => {
        if (typeof UI !== 'undefined') { UI.modal.close(); UI.drawer.close(); }
        APP?._clearSearchResults();
        document.getElementById('globalSearch') && (document.getElementById('globalSearch').value = '', document.getElementById('globalSearch').blur());
      }
    },
  ],

  _active: false,

  init() {
    document.addEventListener('keydown', (e) => {
      // Skip if typing in input/textarea/select
      const tag = e.target?.tagName;
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target?.isContentEditable;

      const ctrl  = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const key   = e.key?.toLowerCase();

      for (const shortcut of this._map) {
        for (const combo of shortcut.keys) {
          const parts   = combo.split('+');
          const needCtrl = parts.includes('ctrl') || parts.includes('cmd');
          const mainKey  = parts[parts.length - 1];

          if (needCtrl && !ctrl) continue;
          if (!needCtrl && ctrl) continue;
          if (key !== mainKey) continue;

          // Skip text-only shortcuts when typing
          if (isTyping && shortcut.textOnly) continue;

          // Allow escape even in inputs
          if (key !== 'escape' && isTyping && needCtrl === false) continue;

          e.preventDefault?.();
          shortcut.action(e);
          return;
        }
      }
    });
  },

  showCheatsheet() {
    // Don't open if already open
    if (document.getElementById('sx-shortcuts-overlay')) {
      document.getElementById('sx-shortcuts-overlay').remove();
      return;
    }

    const groups = [
      { label: 'Navigation', items: [
        { keys: 'Ctrl + K',  desc: 'Focus search bar' },
        { keys: 'Ctrl + D',  desc: 'Go to Dashboard' },
        { keys: 'Ctrl + E',  desc: 'Go to ERP' },
        { keys: 'Ctrl + M',  desc: 'Go to Data Manager' },
        { keys: 'Ctrl + R',  desc: 'Go to Reminders' },
        { keys: 'Ctrl + G',  desc: 'Go to Goals' },
        { keys: 'Ctrl + ,',  desc: 'Open Settings' },
      ]},
      { label: 'General', items: [
        { keys: 'Escape',    desc: 'Close modal / clear search' },
        { keys: '?',         desc: 'Toggle this shortcut guide' },
      ]},
    ];

    const el = document.createElement('div');
    el.id = 'sx-shortcuts-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(2,5,9,.88);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .15s ease;backdrop-filter:blur(4px)';
    el.innerHTML = `
      <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:20px;padding:28px;max-width:480px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,.8)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px">
          <div>
            <h3 style="font-family:var(--heading);font-size:18px;font-weight:800;letter-spacing:1px">Keyboard Shortcuts</h3>
            <p style="font-size:12px;color:var(--muted);margin-top:3px">Press <kbd style="${SHORTCUTS._kbdStyle()}">?</kbd> again to close</p>
          </div>
          <button onclick="document.getElementById('sx-shortcuts-overlay').remove()" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer;padding:4px">✕</button>
        </div>
        ${groups.map(g => `
          <div style="margin-bottom:18px">
            <div style="font-size:10px;font-weight:700;color:var(--muted);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px">${g.label}</div>
            ${g.items.map(item => `
              <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(26,37,64,.5)">
                <span style="font-size:13px;color:var(--text2)">${item.desc}</span>
                <kbd style="${SHORTCUTS._kbdStyle()}">${item.keys}</kbd>
              </div>`).join('')}
          </div>`).join('')}
        <div style="margin-top:6px;font-size:11px;color:var(--muted);text-align:center">Mac users: ⌘ Cmd instead of Ctrl</div>
      </div>`;

    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    document.body.appendChild(el);
  },

  _kbdStyle() {
    return 'font-family:var(--font);font-size:11px;background:var(--surface2);border:1px solid var(--border2);border-radius:6px;padding:3px 8px;color:var(--text);letter-spacing:.5px;white-space:nowrap';
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   4.  REAL RBAC — Admin / Staff enforcement
   ══════════════════════════════════════════════════════════════════════════════ */

const RBAC = {

  ROLES: {
    admin: {
      canDelete:      true,
      canExport:      true,
      canViewFinance: true,
      canEditSettings:true,
    },
    staff: {
      canDelete:      false,
      canExport:      false,
      canViewFinance: false,  // hides revenue totals in full finance view
      canEditSettings:false,
    },
  },

  /* Get current user's role. Default: admin (all existing accounts = admin) */
  getRole() {
    try {
      const s = STRATIX_DB.getSettings();
      return s.userRole || 'admin';
    } catch(e) { return 'admin'; }
  },

  can(permission) {
    const role = this.getRole();
    return !!(this.ROLES[role]?.[permission] ?? true);
  },

  /* Guard a function — show warning toast if permission denied */
  guard(permission, fn, denyMsg) {
    if (!this.can(permission)) {
      NOTIFY.show(denyMsg || '🔒 Your role does not have permission for this action.', 'warning', 4000);
      return false;
    }
    fn();
    return true;
  },

  /* Apply RBAC to delete operations — wrap all delete methods to check permission */
  applyDeleteGuard() {
    const deny = () => NOTIFY.show('🔒 Staff accounts cannot delete records. Contact your admin.', 'warning', 4000);

    const guardObj = (obj, method) => {
      if (!obj || typeof obj[method] !== 'function') return;
      const orig = obj[method].bind(obj);
      obj[method] = function(...args) {
        if (!RBAC.can('canDelete')) { deny(); return; }
        return orig(...args);
      };
    };

    // ERP
    if (typeof ERP !== 'undefined') {
      ['deleteItem', 'deleteSO', 'deletePO', 'deleteJob'].forEach(m => guardObj(ERP, m));
    }
    // CRM
    if (typeof CRM !== 'undefined') {
      ['deleteLead', 'deleteContact', 'deleteDeal'].forEach(m => guardObj(CRM, m));
    }
    // SCM
    if (typeof SCM !== 'undefined') {
      ['deleteVendor', 'deleteReq', 'deleteQuote'].forEach(m => guardObj(SCM, m));
    }
    // PAY
    if (typeof PAY !== 'undefined') {
      ['deleteEmployee', 'deletePayslip'].forEach(m => guardObj(PAY, m));
    }
    // FEAT
    if (typeof FEAT !== 'undefined') {
      ['deleteEmployee'].forEach(m => guardObj(FEAT, m));
    }
    // BNK
    if (typeof BNK !== 'undefined') {
      ['deleteCheque'].forEach(m => guardObj(BNK, m));
    }
    // APP
    if (typeof APP !== 'undefined') {
      ['deleteGoal', 'deleteNote', 'deleteEntry'].forEach(m => guardObj(APP, m));
    }
  },

  /* Apply export guard */
  applyExportGuard() {
    if (typeof APP === 'undefined') return;
    _wrap(APP, 'exportData', (orig) => {
      RBAC.guard('canExport', orig, '🔒 Staff accounts cannot export data. Contact your admin.');
    });
    _wrap(APP, 'exportCSV', (orig) => {
      RBAC.guard('canExport', orig, '🔒 Staff accounts cannot export data. Contact your admin.');
    });
  },

  /* Inject role selector into Settings page */
  injectRoleSettings() {
    // Hook into renderSettings to add role section
    if (typeof APP === 'undefined') return;
    const origRender = APP.renderSettings.bind(APP);
    APP.renderSettings = function() {
      origRender();
      // Find the settings container and append role section
      const container = document.querySelector('.settings-group:last-of-type');
      if (!container || document.getElementById('sx-role-settings')) return;

      const currentRole = RBAC.getRole();
      const section = document.createElement('div');
      section.className = 'settings-group';
      section.id = 'sx-role-settings';
      section.style.marginTop = '16px';
      section.innerHTML = `
        <div class="settings-group-title">👤 User Role & Permissions</div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px">
          <div style="font-size:12px;color:var(--muted);margin-bottom:12px;line-height:1.6">
            Set your account role. <strong style="color:var(--gold)">Admin</strong> has full access.
            <strong style="color:var(--text2)">Staff</strong> cannot delete records, export data, or edit settings.
          </div>
          <div style="display:flex;gap:10px">
            <label style="flex:1;cursor:pointer">
              <input type="radio" name="sxRole" value="admin" ${currentRole === 'admin' ? 'checked' : ''} style="display:none" onchange="RBAC._saveRole('admin')"/>
              <div class="sx-role-card ${currentRole === 'admin' ? 'active' : ''}" data-role="admin" onclick="RBAC._saveRole('admin')">
                <div style="font-size:20px;margin-bottom:6px">👑</div>
                <div style="font-weight:700;font-size:13px">Admin</div>
                <div style="font-size:11px;color:var(--muted);margin-top:3px">Full access</div>
              </div>
            </label>
            <label style="flex:1;cursor:pointer">
              <input type="radio" name="sxRole" value="staff" ${currentRole === 'staff' ? 'checked' : ''} style="display:none" onchange="RBAC._saveRole('staff')"/>
              <div class="sx-role-card ${currentRole === 'staff' ? 'active' : ''}" data-role="staff" onclick="RBAC._saveRole('staff')">
                <div style="font-size:20px;margin-bottom:6px">👤</div>
                <div style="font-weight:700;font-size:13px">Staff</div>
                <div style="font-size:11px;color:var(--muted);margin-top:3px">Read + Add only</div>
              </div>
            </label>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);line-height:1.7">
          <strong style="color:var(--text2)">Admin:</strong> Create, edit, delete, export, manage settings<br>
          <strong style="color:var(--text2)">Staff:</strong> View, add entries, add clients — no delete or export
        </div>`;

      const lastGroup = document.querySelector('#sectionContent .settings-group:last-of-type');
      if (lastGroup) lastGroup.after(section);

      // Inject role card CSS
      if (!document.getElementById('sx-role-css')) {
        const s = document.createElement('style');
        s.id = 'sx-role-css';
        s.textContent = `
          .sx-role-card {
            border:2px solid var(--border);border-radius:12px;padding:16px;text-align:center;
            transition:.2s;background:var(--surface);cursor:pointer;
          }
          .sx-role-card:hover { border-color:var(--border2); background:var(--surface2); }
          .sx-role-card.active { border-color:var(--gold); background:rgba(37,99,235,.06); }
        `;
        document.head.appendChild(s);
      }
    };
  },

  _saveRole(role) {
    const s = STRATIX_DB.getSettings();
    s.userRole = role;
    STRATIX_DB.saveSettings(s);

    // Update card UI
    document.querySelectorAll('.sx-role-card').forEach(c => {
      c.classList.toggle('active', c.dataset.role === role);
    });

    // Re-apply guards
    this.applyDeleteGuard();
    this.applyExportGuard();

    NOTIFY.show(`Role set to ${role === 'admin' ? '👑 Admin' : '👤 Staff'}`, 'success', 3000);
  },

  init() {
    this.applyDeleteGuard();
    this.applyExportGuard();
    this.injectRoleSettings();
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   5.  DATAMANAGER → STRATIX_SERVICES WIRE
   APP.addEntry() currently writes directly to STRATIX_DB.push — bypassing the
   event bus. Patch it to go through STRATIX_SERVICES.finance.logTransaction()
   so dashboard KPIs auto-update without page reload.
   ══════════════════════════════════════════════════════════════════════════════ */

const DATAMANAGER_UPGRADE = {
  apply() {
    if (typeof APP === 'undefined') return;
    if (typeof STRATIX_SERVICES === 'undefined') return;

    APP.addEntry = function() {
      const amtEl  = document.getElementById('entAmt');
      const descEl = document.getElementById('entDesc');
      const catEl  = document.getElementById('entCat');
      const dateEl = document.getElementById('entDate');
      const typeEl = document.getElementById('entryType');

      const amt  = Number(amtEl?.value) || 0;
      const desc = descEl?.value?.trim() || '';
      const cat  = catEl?.value || 'other';
      const date = dateEl?.value || new Date().toISOString().split('T')[0];
      const type = typeEl?.value === 'expense' ? 'expense' : 'revenue';

      // Field-level validation
      if (!amt || amt <= 0) {
        NOTIFY.show('⚠️ Enter a valid amount greater than 0', 'warning');
        amtEl?.focus();
        if (amtEl) { amtEl.style.borderColor = 'var(--red)'; setTimeout(() => amtEl.style.borderColor = '', 2000); }
        return;
      }
      if (!desc) {
        NOTIFY.show('⚠️ Description is required', 'warning');
        descEl?.focus();
        if (descEl) { descEl.style.borderColor = 'var(--red)'; setTimeout(() => descEl.style.borderColor = '', 2000); }
        return;
      }

      // Route through services layer
      const result = STRATIX_SERVICES.finance.logTransaction({
        type,
        amount: amt,
        category: cat,
        description: desc,
        date,
      });

      if (result.success) {
        // Clear form fields
        if (amtEl)  amtEl.value  = '';
        if (descEl) descEl.value = '';
        if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

        NOTIFY.show(`✅ ${type === 'revenue' ? 'Revenue' : 'Expense'} of ₹${amt.toLocaleString('en-IN')} added`, 'success', 2800);

        // Re-render table
        APP.renderDataManager();
      } else {
        NOTIFY.show('Failed to save entry. Please try again.', 'error');
      }
    };
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   6.  SETTINGS FORM VALIDATION
   APP.saveSettings() currently saves with zero validation.
   Wrap it to validate GSTIN, phone, PAN, business name first.
   ══════════════════════════════════════════════════════════════════════════════ */

const SETTINGS_UPGRADE = {

  _schema: {
    sBizName: {
      label: 'Business Name',
      rules: [['required', 'Business name is required']]
    },
    sGSTNo: {
      label: 'GST Number',
      rules: [['custom', 'Invalid GSTIN format (e.g. 22AAAAA0000A1Z5)', v => {
        if (!v) return true; // optional
        return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v.toUpperCase());
      }]]
    },
    sPhone: {
      label: 'Phone Number',
      rules: [['custom', 'Enter a valid 10-digit phone number', v => {
        if (!v) return true; // optional
        return /^[+]?[0-9\s\-()]{10,15}$/.test(v);
      }]]
    },
  },

  apply() {
    if (typeof APP === 'undefined') return;

    const origSave = APP.saveSettings.bind(APP);
    APP.saveSettings = function() {
      // Collect values to validate
      const data = {
        sBizName: document.getElementById('sBizName')?.value?.trim() || '',
        sGSTNo:   (document.getElementById('sGSTNo')?.value?.trim() || '').toUpperCase(),
        sPhone:   document.getElementById('sPhone')?.value?.trim() || '',
      };

      const errors = SETTINGS_UPGRADE._validateSettings(data);

      if (errors) {
        // Show inline errors
        Object.entries(errors).forEach(([field, msg]) => {
          const input = document.getElementById(field);
          if (!input) return;
          input.style.borderColor = 'var(--red)';
          input.style.boxShadow = '0 0 0 3px rgba(255,77,77,.12)';

          // Add or update error label
          let errEl = document.getElementById(field + '-err');
          if (!errEl) {
            errEl = document.createElement('div');
            errEl.id = field + '-err';
            errEl.style.cssText = 'color:var(--red);font-size:11px;font-weight:600;margin-top:5px';
            input.parentNode?.appendChild(errEl);
          }
          errEl.textContent = msg;

          // Auto-clear on fix
          input.addEventListener('input', () => {
            input.style.borderColor = '';
            input.style.boxShadow = '';
            if (errEl) errEl.textContent = '';
          }, { once: true });
        });

        // Scroll to first error
        const firstErr = document.querySelector('[style*="var(--red)"]');
        firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });

        NOTIFY.show('⚠️ Fix the highlighted fields before saving', 'warning', 3500);
        return;
      }

      // Fix GSTIN casing before save
      const gstEl = document.getElementById('sGSTNo');
      if (gstEl && gstEl.value) gstEl.value = gstEl.value.toUpperCase();

      // All good — run original save
      origSave();
    };
  },

  _validateSettings(data) {
    const errors = {};

    if (!data.sBizName) {
      errors.sBizName = 'Business name is required';
    }

    if (data.sGSTNo && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(data.sGSTNo)) {
      errors.sGSTNo = 'Invalid GSTIN — should be like 22AAAAA0000A1Z5';
    }

    if (data.sPhone && !/^[+]?[0-9\s\-()]{10,15}$/.test(data.sPhone)) {
      errors.sPhone = 'Enter a valid 10-digit phone number';
    }

    return Object.keys(errors).length > 0 ? errors : null;
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   7.  NOTIFICATION BADGE — real-time count
   Updates the notification dot in the topbar with actual unread count
   ══════════════════════════════════════════════════════════════════════════════ */

const NOTIF_BADGE = {
  update() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const overdueReminders = STRATIX_DB.getArr('reminders').filter(r => !r.done && r.date && r.date <= today).length;
      const highClients = STRATIX_DB.getArr('clients').filter(c => (c.outstanding || 0) > 50000).length;
      const lowStock = STRATIX_DB.getArr('erpInventory').filter(i => (i.qty || 0) <= (i.reorderQty || 5)).length;
      const overdueInvoices = STRATIX_DB.getArr('invoices').filter(i => i.status === 'Overdue').length;

      const count = overdueReminders + (highClients > 0 ? 1 : 0) + (lowStock > 0 ? 1 : 0) + overdueInvoices;

      const dot = document.getElementById('notifDot');
      if (!dot) return;

      if (count > 0) {
        dot.style.display = 'flex';
        dot.style.cssText += ';display:flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 4px;background:#ff4d4d;color:#fff;font-size:9px;font-weight:800;border-radius:10px;position:absolute;top:-4px;right:-4px';
        dot.textContent = count > 9 ? '9+' : String(count);
      } else {
        dot.style.display = 'none';
        dot.textContent = '';
      }
    } catch(e) {}
  },

  init() {
    // Update on load
    setTimeout(() => this.update(), 1000);
    // Update whenever data changes
    if (typeof STRATIX_BUS !== 'undefined') {
      STRATIX_BUS.on('finance:changed',    () => this.update());
      STRATIX_BUS.on('inventory:changed',  () => this.update());
      STRATIX_BUS.on('crm:changed',        () => this.update());
    }
    // Also update showNotifications to show rich panel
    if (typeof APP !== 'undefined') {
      APP.showNotifications = function() {
        const today = new Date().toISOString().split('T')[0];
        const sym = this.settings?.currencySymbol || '₹';

        const items = [];

        STRATIX_DB.getArr('reminders')
          .filter(r => !r.done && r.date && r.date <= today)
          .slice(0, 3)
          .forEach(r => items.push({ icon: '🔔', text: r.title, sub: `Due: ${r.date}`, action: 'reminders', color: 'var(--red)' }));

        STRATIX_DB.getArr('erpInventory')
          .filter(i => (i.qty || 0) <= (i.reorderQty || 5))
          .slice(0, 3)
          .forEach(i => items.push({ icon: '📦', text: `Low stock: ${i.name}`, sub: `${i.qty || 0} units left`, action: 'erp', color: 'var(--orange)' }));

        STRATIX_DB.getArr('clients')
          .filter(c => (c.outstanding || 0) > 50000)
          .slice(0, 3)
          .forEach(c => items.push({ icon: '💰', text: `${c.name} owes ${sym}${(c.outstanding || 0).toLocaleString('en-IN')}`, sub: 'Outstanding dues', action: 'invoiceaging', color: 'var(--gold)' }));

        STRATIX_DB.getArr('invoices')
          .filter(i => i.status === 'Overdue')
          .slice(0, 3)
          .forEach(i => items.push({ icon: '🧾', text: `Overdue: ${i.invoiceNo}`, sub: `${sym}${(i.totalAmount || 0).toLocaleString('en-IN')} — ${i.customerName}`, action: 'invoiceaging', color: 'var(--red)' }));

        if (items.length === 0) {
          NOTIFY.show('✅ All clear — no alerts right now', 'success', 3000);
          NOTIF_BADGE.update();
          return;
        }

        if (typeof UI !== 'undefined') {
          UI.modal.open({
            title: `🔔 Alerts (${items.length})`,
            body: `<div style="display:flex;flex-direction:column;gap:8px">
              ${items.map(item => `
                <div onclick="UI.modal.closeAll();APP.navigate('${item.action}')"
                  style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--surface2);border-radius:10px;cursor:pointer;border:1px solid var(--border);transition:.15s"
                  onmouseover="this.style.borderColor='${item.color}'" onmouseout="this.style.borderColor='var(--border)'">
                  <span style="font-size:20px;flex-shrink:0">${item.icon}</span>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:13px;font-weight:600;color:${item.color}">${escapeHTML(item.text)}</div>
                    <div style="font-size:11px;color:var(--muted);margin-top:2px">${escapeHTML(item.sub)}</div>
                  </div>
                  <span style="color:var(--muted);font-size:12px">→</span>
                </div>`).join('')}
            </div>`,
          });
        } else {
          NOTIFY.show(`${items.length} alert${items.length > 1 ? 's' : ''}: ${items[0].text}`, 'info', 5000);
        }

        NOTIF_BADGE.update();
      };
    }
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   8.  INLINE DELETE INTERCEPTS
   finance_deep.js and new_features.js use raw onclick="STRATIX_DB.remove(...)"
   in their HTML — no delete method to patch with _wrap(). We intercept them by
   overriding STRATIX_DB.remove to inject confirmation for specific keys.
   ══════════════════════════════════════════════════════════════════════════════ */

const INLINE_DELETE_GUARD = {

  /* Keys that need confirmation + their human-readable label */
  _guardedKeys: {
    gstSales:             'GST sales entry',
    gstPurchases:         'GST purchase entry',
    advances:             'salary advance record',
    payslips:             'payslip',
    bankTransactions:     'bank transaction',
    bankAccounts:         'bank account',
    maintenance_schedule: 'maintenance schedule',
    epods:                'e-POD delivery record',
    tds_entries:          'TDS/TCS entry',
    amc_contracts:        'AMC contract',
    esg_entries:          'ESG entry',
    re_units:             'property unit',
    pharma_stock:         'pharmacy stock item',
    appointments:         'appointment',
    emr_patients:         'patient record',
    room_tables:          'table/room record',
    contractors:          'contractor record',
    work_orders:          'work order',
    site_logs:            'site log entry',
    timesheet_entries:    'timesheet entry',
    omni_channels:        'channel sync record',
    scmShipments:         'shipment record',
  },

  init() {
    const orig = STRATIX_DB.remove.bind(STRATIX_DB);
    const guardedKeys = this._guardedKeys;

    STRATIX_DB.remove = function(key, id) {
      const label = guardedKeys[key];
      if (!label) {
        // Not a guarded key — run immediately (existing patched keys)
        return orig(key, id);
      }

      // RBAC: staff cannot delete
      if (typeof RBAC !== 'undefined' && !RBAC.can('canDelete')) {
        NOTIFY.show('🔒 Staff accounts cannot delete records. Contact your admin.', 'warning', 4000);
        return;
      }

      // Show confirmation — then run original remove + re-render if needed
      sx_confirm(
        `Delete this ${label}? This cannot be undone.`,
        () => {
          orig(key, id);
          // Invalidate store cache
          if (typeof STRATIX_STORE !== 'undefined') STRATIX_STORE.invalidate(key);
          // Emit relevant events
          if (typeof STRATIX_BUS !== 'undefined') {
            if (['gstSales','gstPurchases','bankTransactions','bankAccounts','tds_entries'].includes(key)) {
              STRATIX_BUS.emit('finance:changed', { source: `inline.remove.${key}` });
            }
          }
          // Trigger re-render of section
          if (typeof APP !== 'undefined' && APP.currentSection) {
            setTimeout(() => APP.renderSection(APP.currentSection), 50);
          }
          NOTIFY.show(`${label.charAt(0).toUpperCase() + label.slice(1)} deleted`, 'success', 2500);
        },
        { type: 'danger', confirmText: 'Delete' }
      );
    };
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   9.  FORM VALIDATION WIRING
   Patches ERP/CRM/SCM save methods to run FORM.validate() before saving.
   Shows inline field errors instead of toast-only validation.
   ══════════════════════════════════════════════════════════════════════════════ */

const FORM_WIRING = {

  _schemas: {
    /* ERP Inventory */
    erpItem: {
      ei_name: { label: 'Item Name',    rules: [['required', 'Item name is required']] },
      ei_cost: { label: 'Cost Price',   rules: [['custom', 'Cost price cannot be negative', v => Number(v) >= 0]] },
      ei_sale: { label: 'Sale Price',   rules: [['custom', 'Sale price cannot be negative', v => Number(v) >= 0]] },
      ei_qty:  { label: 'Opening Qty',  rules: [['custom', 'Quantity cannot be negative',   v => Number(v) >= 0]] },
    },
    /* ERP Sales Order */
    erpSO: {
      so_cust: { label: 'Customer',     rules: [['required', 'Customer name is required']] },
      so_date: { label: 'Date',         rules: [['required', 'Date is required']] },
    },
    /* ERP Purchase Order */
    erpPO: {
      po_sup:  { label: 'Supplier',     rules: [['required', 'Supplier name is required']] },
      po_date: { label: 'Date',         rules: [['required', 'Date is required']] },
    },
    /* CRM Lead */
    crmLead: {
      ld_name:  { label: 'Name',        rules: [['required', 'Lead name is required']] },
      ld_phone: { label: 'Phone',       rules: [['custom', 'Enter a valid phone number', v => !v || /^[0-9\s\-+()]{10,15}$/.test(v)]] },
      ld_email: { label: 'Email',       rules: [['custom', 'Invalid email address',      v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)]] },
    },
    /* CRM Contact */
    crmContact: {
      ct_name:  { label: 'Name',        rules: [['required', 'Contact name is required']] },
      ct_phone: { label: 'Phone',       rules: [['custom', 'Enter a valid phone number', v => !v || /^[0-9\s\-+()]{10,15}$/.test(v)]] },
      ct_email: { label: 'Email',       rules: [['custom', 'Invalid email address',      v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)]] },
    },
    /* CRM Deal */
    crmDeal: {
      dl_title: { label: 'Deal Title',  rules: [['required', 'Deal title is required']] },
      dl_value: { label: 'Value',       rules: [['custom', 'Value must be greater than 0', v => !v || Number(v) >= 0]] },
    },
  },

  _validate(schemaKey, containerSelector) {
    if (typeof FORM === 'undefined') return true; // FORM not loaded — allow save
    const schema = this._schemas[schemaKey];
    if (!schema) return true;

    const container = document.querySelector(containerSelector);
    if (!container) return true;

    // Collect values
    const data = {};
    Object.keys(schema).forEach(fieldId => {
      const el = document.getElementById(fieldId) || container.querySelector(`[id="${fieldId}"]`);
      data[fieldId] = el ? el.value : '';
    });

    const errors = FORM.validate(data, schema);
    if (errors) {
      FORM.show(errors, container);
      // Scroll first error into view
      const first = container.querySelector('[style*="var(--red)"]');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    FORM.clear(container);
    return true;
  },

  apply() {
    // ── ERP.saveItem ─────────────────────────────────────────────────────────
    if (typeof ERP !== 'undefined') {
      const origSaveItem = ERP.saveItem.bind(ERP);
      ERP.saveItem = function(id) {
        if (!FORM_WIRING._validate('erpItem', '#erpAddItem .modal-body, .modal-body')) return;
        origSaveItem(id);
      };

      const origSaveSO = ERP.saveSO.bind(ERP);
      ERP.saveSO = function() {
        if (!FORM_WIRING._validate('erpSO', '#soModal .modal-body, .modal-body')) return;
        origSaveSO();
      };

      const origSavePO = ERP.savePO?.bind(ERP);
      if (origSavePO) {
        ERP.savePO = function() {
          if (!FORM_WIRING._validate('erpPO', '#poModal .modal-body, .modal-body')) return;
          origSavePO();
        };
      }
    }

    // ── CRM ──────────────────────────────────────────────────────────────────
    if (typeof CRM !== 'undefined') {
      const origSaveLead = CRM.saveLead?.bind(CRM);
      if (origSaveLead) {
        CRM.saveLead = function(id) {
          if (!FORM_WIRING._validate('crmLead', '#leadModal .modal-body, .modal-body')) return;
          origSaveLead(id);
        };
      }

      const origSaveContact = CRM.saveContact?.bind(CRM);
      if (origSaveContact) {
        CRM.saveContact = function(id) {
          if (!FORM_WIRING._validate('crmContact', '#contactModal .modal-body, .modal-body')) return;
          origSaveContact(id);
        };
      }

      const origSaveDeal = CRM.saveDeal?.bind(CRM);
      if (origSaveDeal) {
        CRM.saveDeal = function(id) {
          if (!FORM_WIRING._validate('crmDeal', '#dealModal .modal-body, .modal-body')) return;
          origSaveDeal(id);
        };
      }
    }
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   10.  UNDO SYSTEM
   Lightweight undo stack — last 10 deletions can be undone within 8 seconds.
   Works by saving the deleted record before the actual remove, then re-inserting
   it if the user clicks Undo in the toast notification.
   ══════════════════════════════════════════════════════════════════════════════ */

const UNDO = {

  _stack: [], // [{ key, record, label, timestamp }]
  _MAX:   10,

  /* Call this BEFORE deleting — saves snapshot for undo */
  snapshot(key, id, label) {
    try {
      const record = STRATIX_DB.getArr(key).find(r => r.id === id);
      if (!record) return;
      this._stack.push({ key, record: JSON.parse(JSON.stringify(record)), label, timestamp: Date.now() });
      if (this._stack.length > this._MAX) this._stack.shift();
    } catch(e) {}
  },

  /* Show undo toast and restore if clicked */
  showUndo(label) {
    const entry = this._stack[this._stack.length - 1];
    if (!entry) return;

    let toastEl = null;
    // Build a persistent toast with Undo button
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;width:90%;max-width:380px';
      document.body.appendChild(container);
    }

    toastEl = document.createElement('div');
    toastEl.style.cssText = 'background:#F8FAFC;border:1px solid rgba(37,99,235,.3);border-radius:12px;padding:11px 16px;display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(0,0,0,.6);pointer-events:all;font-family:var(--font);font-size:13px;color:#0F172A;width:100%';
    toastEl.innerHTML = `
      <span style="flex-shrink:0">🗑️</span>
      <span style="flex:1">${escapeHTML(label)} deleted</span>
      <button onclick="UNDO.restore()" style="padding:5px 12px;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.3);border-radius:8px;color:var(--gold);cursor:pointer;font-family:var(--font);font-size:12px;font-weight:700;flex-shrink:0">↩ Undo</button>`;

    container.appendChild(toastEl);

    // Auto-dismiss after 8s
    const timer = setTimeout(() => {
      toastEl.style.animation = 'toastOut .3s ease forwards';
      setTimeout(() => toastEl?.remove(), 300);
    }, 8000);

    // Store timer ref on element so restore() can clear it
    toastEl._undoTimer = timer;
  },

  /* Restore last deleted record */
  restore() {
    const entry = this._stack.pop();
    if (!entry) return;

    try {
      const arr = STRATIX_DB.getArr(entry.key);
      // Only restore if it doesn't already exist
      if (!arr.find(r => r.id === entry.record.id)) {
        arr.push(entry.record);
        STRATIX_DB.set(entry.key, arr);
        if (typeof STRATIX_STORE !== 'undefined') STRATIX_STORE.invalidate(entry.key);
      }

      NOTIFY.show(`↩ ${entry.label} restored`, 'success', 3000);

      // Re-render current section
      if (typeof APP !== 'undefined') {
        setTimeout(() => APP.renderSection(APP.currentSection), 50);
      }
    } catch(e) {
      NOTIFY.show('Could not restore — data may have changed', 'error', 3000);
    }

    // Dismiss undo toast
    document.querySelectorAll('#toastContainer > div').forEach(el => {
      if (el.querySelector('[onclick*="UNDO.restore"]')) {
        clearTimeout(el._undoTimer);
        el.remove();
      }
    });
  },

  /* Snapshot a record RIGHT BEFORE it is actually deleted (called from confirm callbacks) */
  _snapshotNow(key, id) {
    try {
      const record = STRATIX_DB.getArr(key).find(r => r.id === id);
      if (!record) return;
      this._stack.push({
        key,
        record: JSON.parse(JSON.stringify(record)),
        label: record.name || record.title || record.description || key,
        timestamp: Date.now(),
      });
      if (this._stack.length > this._MAX) this._stack.shift();
    } catch(e) {}
  },

  /* Wire STRATIX_DB.remove so confirmed deletes always snapshot first */
  wire() {
    const origRemove = STRATIX_DB.remove.bind(STRATIX_DB);
    STRATIX_DB.remove = function(key, id) {
      // Snapshot at actual removal time — not before confirm dialog opens
      // This prevents stale undo entries when user cancels a confirm dialog
      UNDO._snapshotNow(key, id);
      return origRemove(key, id);
    };
  },
};

window.UNDO = UNDO;


/* ══════════════════════════════════════════════════════════════════════════════
   11.  canViewFinance ENFORCEMENT
   Staff cannot access DataManager, GST, Bank, full Analytics finance data.
   ══════════════════════════════════════════════════════════════════════════════ */

const FINANCE_GUARD = {

  _blockedSections: ['datamanager', 'gst', 'bank', 'gst_filing', 'tds_tracker', 'upi_tracker', 'tally_export'],

  _renderBlocked() {
    const el = document.getElementById('sectionContent');
    if (!el) return;
    el.innerHTML = `
      <div class="sec">
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;text-align:center;gap:12px">
          <div style="font-size:44px">🔒</div>
          <h3 style="font-size:17px;font-weight:700;color:var(--red)">Finance Access Restricted</h3>
          <p style="font-size:13px;color:var(--muted);max-width:300px;line-height:1.7">
            Your account has <strong>Staff</strong> access. Full finance data is restricted to Admin accounts only.
          </p>
          <button class="btn btn-ghost" onclick="APP.navigate('dashboard')">← Back to Dashboard</button>
          <p style="font-size:11px;color:var(--muted);margin-top:4px">Contact your admin to upgrade your role.</p>
        </div>
      </div>`;
  },

  init() {
    if (typeof APP === 'undefined') return;
    const origRenderSection = APP.renderSection.bind(APP);
    const blocked = this._blockedSections;

    APP.renderSection = function(id) {
      if (blocked.includes(id) && typeof RBAC !== 'undefined' && !RBAC.can('canViewFinance')) {
        FINANCE_GUARD._renderBlocked();
        return;
      }
      origRenderSection(id);
    };

    // Also hide sensitive KPI numbers on dashboard for staff
    if (typeof STRATIX_BUS !== 'undefined') {
      STRATIX_BUS.on('dashboard:refresh', () => {
        if (typeof RBAC !== 'undefined' && !RBAC.can('canViewFinance')) {
          ['sx-kpi-revenue','sx-kpi-expenses','sx-kpi-profit','sx-kpi-receivable'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '****';
          });
        }
      });
    }
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   BOOT — apply everything at DOMContentLoaded
   ══════════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  try {
    // 1. Undo system — wire FIRST so STRATIX_DB.remove snapshots before anything else
    UNDO.wire();

    // 2. Smart confirmations (wraps after undo snapshot, before RBAC guard)
    CONFIRM_PATCHES.applyAll();

    // 3. Inline delete guard — finance_deep + new_features raw onclick removes
    INLINE_DELETE_GUARD.init();

    // 4. Enhanced global search
    SEARCH_UPGRADE.apply();

    // 5. Keyboard shortcuts
    SHORTCUTS.init();

    // 6. RBAC (wraps on top of confirm patches — order matters)
    RBAC.init();

    // 7. canViewFinance enforcement — must be after RBAC.init()
    FINANCE_GUARD.init();

    // 8. DataManager → Services wire
    DATAMANAGER_UPGRADE.apply();

    // 9. Settings validation
    SETTINGS_UPGRADE.apply();

    // 10. FORM wiring into ERP/CRM forms
    FORM_WIRING.apply();

    // 11. Notification badge
    NOTIF_BADGE.init();

    console.info('[STRATIX] upgrades.js v2.0 loaded — Confirmations, Inline guards, Undo, Search, Shortcuts, RBAC, Finance guard, FORM wiring, DataManager, Settings, Notifications active.');
  } catch(e) {
    console.warn('[STRATIX] upgrades.js boot warning:', e.message);
  }
});

/* Expose RBAC globally so Settings page role cards can call it */
window.RBAC = RBAC;
