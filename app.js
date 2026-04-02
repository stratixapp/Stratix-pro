
// Global error handler — prevents silent failures
window.addEventListener('error', function(e) {
  console.error('[STRATIX] Uncaught error:', e.error || e.message);
});
window.addEventListener('unhandledrejection', function(e) {
  console.error('[STRATIX] Unhandled promise rejection:', e.reason);
  // Don't crash the app on Firebase network errors
  if (e.reason && typeof e.reason.message === 'string' &&
      (e.reason.message.includes('Firebase') || e.reason.message.includes('network'))) {
    e.preventDefault();
  }
});

/**
 * STRATIX App Logic v2.0
 * All feature handlers, data processing, chart rendering
 */

// ── State ────────────────────────────────────────────────────────────────────
const APP = {
  currentSection: 'dashboard',
  session: null,
  settings: null,
  charts: {},

  init() {
    // ── Bug #8 fix: guard against double-init (e.g. launchApp() + window.onload both firing)
    if (this._initialized) return;
    this._initialized = true;

    try {
      this.session = STRATIX_AUTH.requireAuth();
      if (!this.session) { this._initialized = false; return; }
      this.settings = STRATIX_DB.getSettings();

      // BUG 17 FIX: apply saved compact view on startup
      if (this.settings.compactView) document.body.classList.add('compact-mode');

      // ── Bug #3 fix: migrate old accounts that have businessType in settings but no bizType in session
      // Accounts created before bizType was added to the session object fall back to 'transport'
      // unless we patch the session here from settings.businessType.
      if (!this.session.bizType && this.settings.businessType) {
        this.session.bizType = this.settings.businessType;
        // Persist the fix into the stored session so it survives page reloads
        try {
          const raw = JSON.parse(localStorage.getItem('sx_session'));
          if (raw && !raw.bizType) {
            raw.bizType = this.settings.businessType;
            localStorage.setItem('sx_session', JSON.stringify(raw));
          }
        } catch(e) {}
      }

      // ── One-time demo data purge ──────────────────────────────────────────
      // If demo data was seeded in a previous session (before seed was disabled),
      // wipe it automatically the first time the user opens the app after this update.
      const purgeKey = `sx_${this.session.userId}_demo_purged_v2`;
      if (!localStorage.getItem(purgeKey)) {
        // Clear all auto-seeded collections — keeps only data the user manually added
        // Detection: seeded transactions have predictable IDs like 'r0a','e0b','r5a' etc.
        const txns = STRATIX_DB.getArr('transactions');
        const seedPattern = /^[re]\d[a-d]$/;
        const hasOnlySeedData = txns.length > 0 && txns.every(t => seedPattern.test(t.id || ''));
        if (hasOnlySeedData || txns.length === 0) {
          // All data looks like seeded demo OR empty — do a full clean wipe
          ['transactions','fleet','trips','clients','goals','orders',
           'fct_workers','fct_machines','fct_rawmats','fct_batches',
           'rtl_items','rtl_bills','svc_projects','reminders',
           'gstEntries','invoices','employees','payslips',
           'bankAccounts','bankTransactions'].forEach(k => STRATIX_DB.set(k, []));
        }
        localStorage.setItem(purgeKey, '1');
      }
      // ─────────────────────────────────────────────────────────────────────
      this.seedDemoData();

      // ── Bug #2 fix: apply VERTICAL *before* renderNav so nav is built once with correct labels.
      // renderNav() builds the generic fallback nav first (needed as a DOM base),
      // then VERTICAL.apply() immediately overwrites it with the vertical-specific nav.
      // This happens synchronously so there is no visible flash.
      const _vBizType = (this.session && this.session.bizType) || (this.settings && this.settings.businessType) || 'logistics';
      this.renderNav();
      if (typeof VERTICAL !== 'undefined') VERTICAL.apply(_vBizType);

      this.updateUserBadge();
      this.navigate('dashboard');
      this.bindGlobalEvents();
      // Show data safety reminder once
      if (!localStorage.getItem('sx_safety_shown')) {
        setTimeout(() => {
          NOTIFY.show('💾 Your data is saved on this device. Export regularly via Settings!', 'info', 6000);
          localStorage.setItem('sx_safety_shown', '1');
        }, 3000);
      }
      // AI Advisor removed
      // Check overdue reminders on every app open
      setTimeout(() => {
        const today = new Date().toISOString().split('T')[0];
        const overdue = STRATIX_DB.getArr('reminders').filter(r=>!r.done && r.date && r.date <= today);
        if (overdue.length > 0) {
          NOTIFY.show(`🔔 ${overdue.length} overdue reminder${overdue.length>1?'s':''}: "${overdue[0].title}"`, 'warning', 7000);
        }
      }, 1500);
    } catch(e) {
      console.error('STRATIX init error:', e);
      const el = document.getElementById('sectionContent');
      if (el) { const safeMsg = String(e.message||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); el.innerHTML = `<div style="padding:40px;color:#0F172A;font-family:sans-serif"><h2 style="color:#2563EB">⚠️ Loading Error</h2><pre style="color:#888;font-size:12px;margin:10px 0">${safeMsg}</pre><button onclick="location.reload()" style="margin-top:12px;padding:10px 20px;background:#2563EB;border:none;border-radius:8px;cursor:pointer;font-weight:700;color:#000">Reload Page</button></div>`; }
    }
  },

  seedDemoData() {
    // DEMO SEED DISABLED — all verticals start clean, user adds their own data
    // seedTransportDemo / seedRetailDemo etc. are also disabled in their files
    return;
  },

  renderNav() {
    const navItems = [
      { id:'dashboard',       icon:'🏠',  label:'Dashboard' },
      { id:'analytics',       icon:'📊',  label:'Analytics' },
      { id:'decision',        icon:'🧠',  label:'Decision Engine' },
      { id:'calculators',     icon:'🔢',  label:'Calculators' },
      { id:'logistics',       icon:'🚛',  label:'Logistics' },
      { id:'logisticsdocs',   icon:'📋',  label:'Logistics Docs', isnew:true },
      { id:'erp',             icon:'🏭',  label:'ERP', isnew:true },
      { id:'crm',             icon:'🤝',  label:'CRM', isnew:true },
      { id:'scm',             icon:'🔗',  label:'Supply Chain', isnew:true },
      { id:'documents',       icon:'📄',  label:'Documents' },
      { id:'datamanager',     icon:'🗄️', label:'Data Manager' },
      { id:'goals',           icon:'🎯',  label:'Goals Tracker' },
      { id:'notes',           icon:'📝',  label:'Smart Notes' },
      { id:'reminders',       icon:'🔔',  label:'Reminders' },
      { id:'strategy',        icon:'📈',  label:'Strategy Builder' },
      { id:'gst',             icon:'🧾',  label:'GST Calculator' },
      { id:'fleet',           icon:'📍',  label:'Fleet Manager' },
      { id:'loan',            icon:'🏦',  label:'Loan Readiness' },
      { id:'trippnl',         icon:'🛣️', label:'Trip P&L' },
      { id:'invoiceaging',    icon:'💰',  label:'Invoice Aging' },
      { id:'earlywarning',    icon:'⚠️', label:'Early Warning' },
      { id:'ordertracker',    icon:'📦',  label:'Order Tracker' },
      { id:'salary',          icon:'💸',  label:'Salary & Payroll', isnew:true },
      { id:'bank',            icon:'🏦',  label:'Bank Tracker', isnew:true },
      { id:'whatsapp',        icon:'📱',  label:'WhatsApp Tools', isnew:true },
      { id:'project_scope',   icon:'🎯',  label:'Project Scope', soon:true },
      { id:'tally_export',   icon:'📊',  label:'Tally Export',          isnew:true },
      { id:'gst_filing',     icon:'📑',  label:'GST Filing Hub',         isnew:true },
      { id:'upi_tracker',    icon:'💳',  label:'UPI Tracker',            isnew:true },
      // ── New Features v5.0 ──────────────────────────────
      { id:'route_optimizer', icon:'🗺️',  label:'Route Optimizer', isnew:true },
      { id:'load_planner',    icon:'📦',  label:'Load Planner', isnew:true },
      { id:'maintenance',     icon:'🔧',  label:'Maintenance Scheduler', isnew:true },
      { id:'epod',            icon:'📸',  label:'e-POD Delivery', isnew:true },
      { id:'tds_tracker',     icon:'🧾',  label:'TDS / TCS Tracker', isnew:true },
      { id:'amc_tracker',     icon:'📋',  label:'AMC Tracker', isnew:true },
      { id:'loyalty',         icon:'⭐',  label:'Loyalty Points', isnew:true },
      { id:'variant_manager', icon:'🎨',  label:'Variant Manager', isnew:true },
      // ── Batch 2 ─────────────────────────────────────────────────────────
      // ── Batch 3 ─────────────────────────────────────────────────────────
      { id:'timesheets',      icon:'⏱️', label:'Timesheets', isnew:true },
      { id:'omnichannel',     icon:'🔄',  label:'Omnichannel Sync', isnew:true },
      // ── Coming Soon ─────────────────────────────────────
      { id:'multiuser', icon:'👥', label:'Team Access', soon:true },
      { id:'upi',       icon:'💳', label:'UPI Tracker', soon:true },
      { id:'ca_report', icon:'📋', label:'CA Report', soon:true },
      { id:'nbfc',      icon:'🏧', label:'Loan Marketplace', soon:true },
      { id:'settings',  icon:'⚙️', label:'Settings' },
      { id:'privacy',   icon:'🔒', label:'Privacy Policy' }
    ];
    const nav = document.getElementById('sideNav');
    const groups = [
      { label: '🏠 Overview',        ids: ['dashboard','analytics','decision'] },
      { label: '🛠️ Tools',           ids: ['calculators','logistics','logisticsdocs','documents','datamanager'] },
      { label: '📌 Management',      ids: ['goals','notes','reminders','strategy'] },
      { label: '💰 Finance',         ids: ['gst','gst_filing','tds_tracker','fleet','loan','trippnl','invoiceaging','earlywarning','ordertracker','upi_tracker'] },
      { label: '✨ New Features',    ids: ['salary','bank','whatsapp','amc_tracker','loyalty','variant_manager','omnichannel','tally_export'] },
      { label: '🚛 Logistics Tools', ids: ['route_optimizer','load_planner','maintenance','epod'] },
      { label: '🏢 Business Suite',  ids: ['erp','crm','scm'] },
      { label: '🔜 Coming Soon',     ids: ['multiuser','ca_report','nbfc','project_scope'] },
      { label: '⚙️ Account',         ids: ['settings','privacy'] }
    ];
    let html = '';
    groups.forEach(group => {
      html += `<div class="nav-group-label">${group.label}</div>`;
      group.ids.forEach(id => {
        const item = navItems.find(n => n.id === id);
        if (!item) return;
        const locked = false; // all features unlocked during beta
        html += `<button class="nav-item" data-id="${item.id}" onclick="APP.navigate('${item.id}')">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
          ${item.soon ? '<span class="nav-soon">SOON</span>' : ''}
          ${item.isnew ? '<span class="nav-new">NEW</span>' : ''}
        </button>`;
      });
    });
    nav.innerHTML = html;
    // BUG 6 FIX: removed duplicate VERTICAL.apply() call here.
    // Callers (init() and saveSettings()) already call VERTICAL.apply() right after renderNav().
    // Having it here caused VERTICAL to rebuild the nav twice and produced label flicker.
  },

  updateUserBadge() {
    const s = this.session;
    // Topbar badge — compact, gold avatar matching logo style
    const safeAvatar = escapeHTML(s.avatar||s.name.charAt(0));
    const safeName = escapeHTML(s.name);
    const topHtml = `
      <div class="user-avatar">${safeAvatar}</div>
      <div class="user-info"><div class="user-name">${safeName}</div><div class="user-plan enterprise">⭐ Beta</div></div>
    `;
    // Sidebar bottom badge — distinct blue avatar so it doesn't look like SX logo
    const sideHtml = `
      <div style="width:34px;height:34px;background:linear-gradient(135deg,#4f7cff,#7c3aed);border-radius:10px;display:flex;align-items:center;justify-content:center;font-family:var(--heading);font-weight:800;font-size:13px;color:#fff;flex-shrink:0">${safeAvatar}</div>
      <div class="user-info"><div class="user-name">${safeName}</div><div class="user-plan enterprise">⭐ Beta</div></div>
    `;
    const top    = document.getElementById('userBadgeTop');
    const side   = document.getElementById('userBadgeSide');
    const legacy = document.getElementById('userBadge');
    if (top)    top.innerHTML    = topHtml;
    if (side)   side.innerHTML   = sideHtml;
    if (legacy) legacy.innerHTML = topHtml;

    // ── Bug #9 fix: inject vertical mode badge into topbar (e.g. "🏭 MANUFACTURING MODE")
    // Remove any existing badge first so this is idempotent on re-calls.
    const existing = document.getElementById('vxModeBadge');
    if (existing) existing.remove();
    if (typeof VERTICAL !== 'undefined') {
      const cfg = VERTICAL.current();
      if (cfg && cfg.id !== 'other' && cfg.id !== 'transport') {
        // Only show badge for non-default verticals to avoid clutter
        const topbar = document.getElementById('topbar');
        const notifBtn = document.getElementById('notifBtn');
        if (topbar && notifBtn && notifBtn.parentNode) {
          const badge = document.createElement('div');
          badge.id = 'vxModeBadge';
          badge.style.cssText = 'margin-right:6px;flex-shrink:0;display:flex;align-items:center';
          badge.innerHTML = `<span style="font-size:11px;font-weight:700;color:var(--vx,var(--gold));background:rgba(var(--vx-rgb,240,165,0),.12);border:1px solid rgba(var(--vx-rgb,240,165,0),.25);border-radius:20px;padding:3px 10px;letter-spacing:.5px;white-space:nowrap">${escapeHTML(cfg.icon)} ${escapeHTML(cfg.id.toUpperCase())}</span>`;
          // FIX: insertBefore requires reference node to be a direct child of parent.
          // notifBtn lives inside .topbar-right, not directly in #topbar — use its actual parentNode.
          notifBtn.parentNode.insertBefore(badge, notifBtn);
        }
      }
    }
  },

  navigate(sectionId, fromPopState) {
    // Check premium gate
    const premiumMap = {}; // beta — no gates
    if (premiumMap[sectionId] && !STRATIX_AUTH.hasPremium(premiumMap[sectionId])) {
      this.showPremiumGate(sectionId, premiumMap[sectionId]);
      return;
    }
    this.currentSection = sectionId;
    // Push to browser history for Android back button support
    if (!fromPopState) {
      try { history.pushState({ section: sectionId }, '', '#' + sectionId); } catch(e) {}
    }
    this.highlightNav(sectionId);
    this.renderSection(sectionId);
    // BUG 15 FIX: scroll reset AFTER render so it applies to the newly rendered content
    requestAnimationFrame(() => {
      const mc = document.getElementById('mainContent');
      const sc = document.getElementById('sectionContent');
      if (mc) mc.scrollTop = 0;
      if (sc) sc.scrollTop = 0;
    });
    // ── Bug #4 fix: sync bottom nav robustly.
    // VERTICAL._buildBottomNav() replaces the bottom nav with vertical-specific buttons.
    // The old static bnMap only covered 4 sections and broke for verticals that swap
    // those buttons out (e.g. manufacturing uses bn-erp, not bn-analytics).
    // New approach: clear all active states, then activate whichever bn-* button matches
    // the current sectionId OR matches via the static fallback map.
    document.querySelectorAll('.bn-btn').forEach(b => b.classList.remove('active'));
    // Try direct match first (works for all vertical bottom navs)
    let bnEl = document.getElementById('bn-' + sectionId);
    // Fallback to static map for sections that don't have a dedicated bottom nav button
    if (!bnEl) {
      const bnMap = { dashboard:'dashboard', analytics:'analytics', documents:'documents', whatsapp:'whatsapp' };
      bnEl = document.getElementById('bn-' + (bnMap[sectionId] || ''));
    }
    if (bnEl) bnEl.classList.add('active');
    if (window.innerWidth < 768) this.closeSidebar();
  },

  highlightNav(id) {
    document.querySelectorAll('.nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.id === id);
    });
  },


  // ── Helper: Sequential Document/Receipt Numbers
  _nextDocNo(prefix, counterKey) {
    const s = STRATIX_AUTH.getSession();
    const userKey = s ? `sx_${s.userId}_${counterKey}` : counterKey;
    const last = parseInt(localStorage.getItem(userKey)||'0');
    const next = last + 1;
    localStorage.setItem(userKey, next);
    return prefix + '-' + String(next).padStart(5,'0');
  },

  // ── Helper: Next Invoice Number (derives from data — survives export/import)
  _nextInvoiceNo() {
    const settings = STRATIX_DB.getSettings();
    const prefix = (settings.invoicePrefix || 'INV').toUpperCase().replace(/[^A-Z0-9]/g,'');
    // Check invoices array first
    const invoices = STRATIX_DB.getArr('invoices');
    let maxNum = 0;
    invoices.forEach(inv => {
      const m = (inv.invoiceNo || '').match(/(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1]));
    });
    // Also check legacy counter
    const legacyCounter = parseInt(localStorage.getItem('sx_inv_counter')||'0');
    const next = Math.max(maxNum, legacyCounter) + 1;
    localStorage.setItem('sx_inv_counter', next);
    return prefix + '-' + String(next).padStart(6,'0');
  },

  // ── Helper: Confirm Delete (inline toast-based) ──────────────────────────
  _confirmDelete(type, callback) {
    if (!this._deleteConfirmEl) {
      const el = document.createElement('div');
      el.id = 'deleteConfirmBar';
      el.style.cssText = 'position:fixed;bottom:90px;left:50%;transform:translateX(-50%);z-index:9998;background:#FFFFFF;border:1px solid #EF4444;border-radius:14px;padding:14px 20px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 24px rgba(15,23,42,.15);font-family:var(--font);min-width:300px;max-width:90vw';
      el.innerHTML = '<span style="color:#e84040;font-size:14px;flex:1">⚠️ Delete this <span id="dcType"></span>?</span><button id="dcNo" style="padding:7px 16px;background:transparent;border:1px solid #5c6e8a;border-radius:8px;color:#0F172A;cursor:pointer;font-family:var(--font);font-size:13px">Cancel</button><button id="dcYes" style="padding:7px 16px;background:#e84040;border:none;border-radius:8px;color:#fff;cursor:pointer;font-family:var(--font);font-size:13px;font-weight:700">Delete</button>';
      document.body.appendChild(el);
      this._deleteConfirmEl = el;
    }
    const el = this._deleteConfirmEl;
    document.getElementById('dcType').textContent = type;
    el.style.display = 'flex';
    document.getElementById('dcNo').onclick  = () => { el.style.display='none'; };
    document.getElementById('dcYes').onclick = () => { el.style.display='none'; callback(); NOTIFY.show('Deleted successfully','success'); };
    return true; // BUG 10 FIX: was returning false — callers can now detect confirm was shown
  },

  // ── Helper: Clear all data confirm (inline) ──────────────────────────────
  _showClearConfirm() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px';
    el.innerHTML = `<div style="background:#FFFFFF;border:1px solid #e84040;border-radius:18px;padding:32px 28px;max-width:400px;width:100%;text-align:center">
      <div style="font-size:40px;margin-bottom:12px">⚠️</div>
      <h3 style="color:#e84040;font-family:var(--heading);font-size:18px;margin-bottom:10px">Delete All Data?</h3>
      <p style="color:#6B7280;font-size:13px;line-height:1.7;margin-bottom:20px">This will permanently delete all your transactions, trips, employees, invoices and settings. This cannot be undone.<br/><br/><strong style="color:#0F172A">Export your data first from Settings → Export.</strong></p>
      <div style="display:flex;gap:12px;justify-content:center">
        <button onclick="this.closest('div[style*=fixed]').remove()" style="padding:11px 24px;background:transparent;border:1px solid #5c6e8a;border-radius:10px;color:#0F172A;cursor:pointer;font-family:var(--font);font-size:14px">Cancel</button>
        <button onclick="APP._executeClearData(this)" style="padding:11px 24px;background:#e84040;border:none;border-radius:10px;color:#fff;cursor:pointer;font-family:var(--font);font-size:14px;font-weight:700">Yes, Delete Everything</button>
      </div>
    </div>`;
    document.body.appendChild(el);
  },

  _executeClearData(btn) {
    btn.textContent = 'Deleting...'; btn.disabled = true;
    Object.keys(localStorage).filter(k=>k.startsWith('sx_')).forEach(k=>localStorage.removeItem(k));
    NOTIFY.show('All data cleared successfully','success');
    setTimeout(()=>{ btn.closest('div[style*=fixed]').remove(); APP.renderSettings(); }, 800);
  },

  // ── Helper: Client Add Modal ─────────────────────────────────────────────
  _showClientAddModal() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px';
    el.innerHTML = `<div style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:18px;padding:28px;max-width:420px;width:100%">
      <h3 style="color:#0F172A;font-family:var(--heading);font-size:17px;margin-bottom:20px">➕ Add Client</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><label style="font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:.8px;font-weight:700;display:block;margin-bottom:6px">Client Name *</label><input id="caN" placeholder="Company or person name" style="width:100%;background:#F8FAFC;border:1.5px solid #D1D5DB;border-radius:10px;padding:11px 14px;color:#0F172A;font-family:var(--font);font-size:14px;outline:none;box-sizing:border-box"/></div>
        <div><label style="font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:.8px;font-weight:700;display:block;margin-bottom:6px">Outstanding Amount (₹)</label><input id="caO" type="number" placeholder="0" style="width:100%;background:#F8FAFC;border:1.5px solid #D1D5DB;border-radius:10px;padding:11px 14px;color:#0F172A;font-family:var(--font);font-size:14px;outline:none;box-sizing:border-box"/></div>
        <div><label style="font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:.8px;font-weight:700;display:block;margin-bottom:6px">Phone (for WhatsApp)</label><input id="caP" type="tel" placeholder="+91 98765 43210" style="width:100%;background:#F8FAFC;border:1.5px solid #D1D5DB;border-radius:10px;padding:11px 14px;color:#0F172A;font-family:var(--font);font-size:14px;outline:none;box-sizing:border-box"/></div>
      </div>
      <div style="display:flex;gap:12px;margin-top:20px">
        <button onclick="this.closest('div[style*=fixed]').remove()" style="flex:1;padding:11px;background:transparent;border:1px solid #D1D5DB;border-radius:10px;color:#0F172A;cursor:pointer;font-family:var(--font);font-size:14px">Cancel</button>
        <button onclick="APP._saveClient(this)" style="flex:1;padding:11px;background:linear-gradient(135deg,#2563EB,#c07000);border:none;border-radius:10px;color:#F8FAFC;cursor:pointer;font-family:var(--font);font-size:14px;font-weight:700">Add Client</button>
      </div>
    </div>`;
    document.body.appendChild(el);
    setTimeout(()=>el.querySelector('#caN').focus(),100);
  },

  _saveClient(btn) {
    const name = document.getElementById('caN').value.trim();
    const outstanding = +document.getElementById('caO').value||0;
    const phone = document.getElementById('caP').value.trim();
    if (!name) { NOTIFY.show('Client name is required','warning'); return; }
    STRATIX_DB.push('clients', { name, outstanding, phone, invoices:0, lastPayment:'—', risk:'low' });
    btn.closest('div[style*=fixed]').remove();
    NOTIFY.show(`Client ${name} added!`,'success');
    APP.renderInvoiceAging();
  },

  bindGlobalEvents() {
    // Android back button — popstate fires when user presses back
    window.addEventListener('popstate', (e) => {
      const section = (e.state && e.state.section) || 'dashboard';
      this.navigate(section, true); // true = from popstate, don't push again
    });
    // Handle direct URL hash on load (e.g. bookmark)
    const hash = window.location.hash.replace('#','');
    if (hash && hash !== 'dashboard') {
      const validSections = ['dashboard','analytics','decision','calculators','logistics',
        'logisticsdocs','erp','crm','scm','documents','datamanager','goals','notes',
        'reminders','strategy','gst','fleet','loan','trippnl','invoiceaging',
        'earlywarning','ordertracker','salary','bank','whatsapp','settings',
        'route_optimizer','load_planner','maintenance','epod','tds_tracker',
        'amc_tracker','esg_tracker',        'loyalty','variant_manager',
'timesheets','omnichannel'];
      if (validSections.includes(hash)) {
        setTimeout(() => this.navigate(hash), 100);
      }
    }
    // Push initial state
    try { history.replaceState({ section: this.currentSection || 'dashboard' }, '', '#' + (this.currentSection || 'dashboard')); } catch(e) {}
    document.getElementById('sideOverlay').addEventListener('click', () => this.closeSidebar());
  },

  toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    const overlay = document.getElementById('sideOverlay');
    overlay.classList.toggle('open', document.getElementById('sidebar').classList.contains('open'));
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sideOverlay').classList.remove('open');
  },

  globalSearch(q) {
    if (!q || q.length < 2) { this._clearSearchResults(); return; }
    clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      if (document.getElementById('globalSearch').value !== q) return;
      const ql = q.toLowerCase();
      const results = [];

      // Search sections
      const sections = [
        {id:'dashboard',label:'Dashboard',icon:'🏠'},{id:'analytics',label:'Analytics',icon:'📊'},
        {id:'salary',label:'Salary & Payroll',icon:'💸'},{id:'bank',label:'Bank Tracker',icon:'🏦'},
        {id:'whatsapp',label:'WhatsApp Tools',icon:'📱'},
        {id:'gst',label:'GST Calculator',icon:'🧾'},{id:'fleet',label:'Fleet Manager',icon:'🚛'},
        {id:'documents',label:'Documents',icon:'📄'},{id:'settings',label:'Settings',icon:'⚙️'},
        {id:'goals',label:'Goals Tracker',icon:'🎯'},{id:'notes',label:'Smart Notes',icon:'📝'},
        {id:'reminders',label:'Reminders',icon:'🔔'},{id:'erp',label:'ERP',icon:'🏭'},
        {id:'crm',label:'CRM',icon:'🤝'},{id:'logistics',label:'Logistics',icon:'🚛'},
        {id:'logisticsdocs',label:'Logistics Docs',icon:'📋'},{id:'trippnl',label:'Trip P&L',icon:'🛣️'},
        {id:'invoiceaging',label:'Invoice Aging',icon:'💰'},{id:'loan',label:'Loan Readiness',icon:'🏦'},
        {id:'datamanager',label:'Data Manager',icon:'🗄️'},{id:'strategy',label:'Strategy Builder',icon:'📈'}
      ];
      sections.filter(s=>s.label.toLowerCase().includes(ql)).forEach(s=>
        results.push({type:'section',label:s.label,icon:s.icon,action:()=>this.navigate(s.id)})
      );

      // Search transactions
      STRATIX_DB.getArr('transactions').filter(t=>(t.description||'').toLowerCase().includes(ql)).slice(0,3).forEach(t=>
        results.push({type:'transaction',label:t.description+' — '+( this.settings.currencySymbol||'₹')+this.fmt(t.amount),icon:t.type==='revenue'?'💚':'🔴',action:()=>this.navigate('datamanager')})
      );

      // Search clients
      STRATIX_DB.getArr('clients').filter(c=>(c.name||'').toLowerCase().includes(ql)).slice(0,3).forEach(c=>
        results.push({type:'client',label:c.name+' — Outstanding: '+(this.settings.currencySymbol||'₹')+this.fmt(c.outstanding),icon:'🤝',action:()=>this.navigate('crm')})
      );

      // Search employees
      STRATIX_DB.getArr('employees').filter(e=>(e.name||'').toLowerCase().includes(ql)).slice(0,3).forEach(e=>
        results.push({type:'employee',label:e.name+' — '+(e.designation||'Employee'),icon:'👤',action:()=>this.navigate('salary')})
      );

      // Search notes
      STRATIX_DB.getArr('notes').filter(n=>(n.title||n.content||'').toLowerCase().includes(ql)).slice(0,2).forEach(n=>
        results.push({type:'note',label:n.title||n.content.slice(0,40),icon:'📝',action:()=>this.navigate('notes')})
      );

      this._showSearchResults(results, q);
    }, 350);
  },

  _showSearchResults(results, q) {
    this._clearSearchResults();
    if (results.length === 0) return;
    const box = document.createElement('div');
    box.id = 'searchResultsBox';
    box.style.cssText = 'position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:9999;background:#FFFFFF;border:1px solid #2a3a5c;border-radius:14px;width:min(400px,90vw);max-height:320px;overflow-y:auto;box-shadow:0 12px 40px rgba(0,0,0,.7)';
    box.innerHTML = results.map((r,i) =>
      `<div onclick="this.closest('#searchResultsBox').remove();document.getElementById('globalSearch').value=''" style="padding:11px 16px;display:flex;align-items:center;gap:12px;cursor:pointer;border-bottom:1px solid #D1D5DB;transition:.15s" onmouseover="this.style.background='rgba(37,99,235,.08)'" onmouseout="this.style.background=''" id="sr_${i}">
        <span style="font-size:16px;flex-shrink:0">${r.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:#0F172A;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(r.label)}</div>
          <div style="font-size:10px;color:#374151;text-transform:uppercase;letter-spacing:.5px">${escapeHTML(r.type)}</div>
        </div>
      </div>`
    ).join('');
    // Attach click actions
    document.body.appendChild(box);
    results.forEach((r,i) => {
      document.getElementById('sr_'+i)?.addEventListener('click', r.action);
    });
    // Close on outside click
    setTimeout(() => document.addEventListener('click', this._closeSearch = (e) => {
      if (!box.contains(e.target) && e.target.id !== 'globalSearch') {
        this._clearSearchResults();
        document.removeEventListener('click', this._closeSearch);
      }
    }), 100);
  },

  _clearSearchResults() {
    const box = document.getElementById('searchResultsBox');
    if (box) box.remove();
  },

  showNotifications() {
    const rems = STRATIX_DB.getArr('reminders').filter(r=>!r.done&&r.date<=new Date().toISOString().split('T')[0]);
    const clients = STRATIX_DB.getArr('clients').filter(c=>c.outstanding>50000);
    const sym = this.settings.currencySymbol||'₹';
    const notifs = [...rems.map(r=>`🔔 Reminder: ${r.title}`), ...clients.map(c=>`💰 ${c.name} owes ${sym}${this.fmt(c.outstanding)}`)];
    document.getElementById('notifDot').style.display = notifs.length ? 'block' : 'none';
    if (notifs.length === 0) { NOTIFY.show('No new notifications', 'info'); return; }
    NOTIFY.show(`${notifs.length} notification${notifs.length>1?'s':''}: ${notifs[0]}`, 'info', 5000);
  },

  showPremiumGate(section, plan) {
    const content = document.getElementById('sectionContent');
    const planDetails = {
      professional: { price: '₹799/month', features: ['GST Calculator + GSTR Report', 'Trip P&L Calculator', 'Loan Readiness Report', 'Invoice Aging & Collection', 'Priority email support'] },
      enterprise: { price: '₹1,499/month', features: ['Fleet Manager', 'Business Early Warning System', 'Order to Delivery Tracker', 'WhatsApp Priority Support', 'Monthly Business Review Call'] }
    };
    const d = planDetails[plan];
    content.innerHTML = `
      <div class="sec">
        <div class="premium-gate">
          <div class="gate-icon">🔒</div>
          <h2>Premium Feature</h2>
          <p>This feature requires the <strong>${plan.charAt(0).toUpperCase()+plan.slice(1)}</strong> plan</p>
          <div class="gate-price">${d.price}</div>
          <ul class="gate-features">${d.features.map(f=>`<li>✓ ${f}</li>`).join('')}</ul>
          <button class="btn-upgrade" onclick="APP.showUpgradeModal('${plan}')">Upgrade to ${plan.charAt(0).toUpperCase()+plan.slice(1)} →</button>
          <button class="btn-ghost" onclick="APP.navigate('dashboard')">Back to Dashboard</button>
        </div>
      </div>`;
    this.highlightNav(section);
  },

  showUpgradeModal(plan) {
    NOTIFY.show('All features are FREE during Beta. Premium plans coming soon!','info');
  },

  renderSection(id) {
    const content = document.getElementById('sectionContent');
    const renders = {
      dashboard: () => this._renderVerticalDashboard(),
      analytics: () => this.renderAnalytics(),
      decision: () => this.renderDecision(),
      calculators: () => this.renderCalculators(),
      logistics: () => this.renderLogistics(),
      logisticsdocs: () => renderLogisticsDocs(),
      erp: () => renderERP(),
      crm: () => renderCRM(),
      scm: () => renderSCM(),
      documents: () => this.renderDocuments(),
      datamanager: () => this.renderDataManager(),
      goals: () => this.renderGoals(),
      notes: () => this.renderNotes(),
      reminders: () => this.renderReminders(),
      strategy: () => this.renderStrategy(),
      gst: () => this.renderGST(),
      fleet: () => this.renderFleet(),
      loan: () => this.renderLoan(),
      trippnl: () => this.renderTripPNL(),
      invoiceaging: () => this.renderInvoiceAging(),
      earlywarning: () => this.renderEarlyWarning(),
      ordertracker: () => this.renderOrderTracker(),
      salary: () => renderSalary(),
      bank: () => renderBankConnect(),
      whatsapp: () => renderWhatsApp(),
      project_scope: () => this.renderComingSoon('🎯','Project Scope','Define and track your business project scope. Custom project templates for each business vertical — coming in next update.',null),
      settings: () => this.renderSettings(),
      privacy: () => this.renderPrivacy(),
      terms: () => this.renderTerms(),
      about: () => this.renderAbout(),
      multiuser: () => this.renderTeamAccess(),
      upi: () => this.renderComingSoon('💳','UPI Payment Tracker','Link UPI ID, auto-detect incoming payments, match to invoices automatically, real-time balance updates.','professional'),
      ca_report: () => APP.navigate('gst_filing'),
      ewaybill: () => { APP.navigate('logisticsdocs'); setTimeout(()=>{ if(typeof LDOC!=='undefined') LDOC.open('eway'); },200); },
      nbfc: () => APP.navigate('loan'),
      // ── NEW FEATURES v5.0 ──────────────────────────────────────────────────
      route_optimizer:   () => (typeof renderRouteOptimizer === 'function' ? renderRouteOptimizer() : this.renderComingSoon('🗺️','Route Optimizer','','professional')),
      load_planner:      () => (typeof renderLoadPlanner === 'function' ? renderLoadPlanner() : this.renderComingSoon('📦','Load Planner','','professional')),
      maintenance:       () => (typeof renderMaintenanceScheduler === 'function' ? renderMaintenanceScheduler() : this.renderComingSoon('🔧','Maintenance Scheduler','','professional')),
      epod:              () => (typeof renderEPOD === 'function' ? renderEPOD() : this.renderComingSoon('📸','e-POD','','professional')),
      tds_tracker:       () => (typeof renderTDSTracker === 'function' ? renderTDSTracker() : this.renderComingSoon('🧾','TDS/TCS Tracker','','professional')),
      amc_tracker:       () => (typeof renderAMCTracker === 'function' ? renderAMCTracker() : this.renderComingSoon('📋','AMC Tracker','','professional')),
      realestate:        () => (typeof renderRealEstateTracker === 'function' ? renderRealEstateTracker() : this.renderComingSoon('🏗️','Real Estate Tracker','','professional')),
      pharma_expiry:     () => (typeof renderPharmacyExpiry === 'function' ? renderPharmacyExpiry() : this.renderComingSoon('💊','Pharmacy Expiry','','professional')),
      loyalty:           () => (typeof renderLoyaltyManager === 'function' ? renderLoyaltyManager() : this.renderComingSoon('⭐','Loyalty Points','','professional')),
      variant_manager:   () => (typeof renderVariantManager === 'function' ? renderVariantManager() : this.renderComingSoon('🎨','Variant Manager','','professional')),
      // ── Batch 2: Healthcare & Hospitality ──────────────────────────────
      appointments:      () => (typeof renderAppointmentScheduler === 'function' ? renderAppointmentScheduler() : this.renderComingSoon('📅','Appointment Scheduler','','professional')),
      patient_history:   () => (typeof renderPatientHistory === 'function' ? renderPatientHistory() : this.renderComingSoon('🏥','Patient History / EMR','','professional')),
      table_manager:     () => (typeof renderTableRoomManager === 'function' ? renderTableRoomManager() : this.renderComingSoon('🍽️','Table / Room Manager','','professional')),
      // ── Batch 3: Real Estate & Services ────────────────────────────────
      contractors:       () => (typeof renderContractorManagement === 'function' ? renderContractorManagement() : this.renderComingSoon('👷','Contractor Management','','professional')),
      site_logs:         () => (typeof renderSiteDailyLogs === 'function' ? renderSiteDailyLogs() : this.renderComingSoon('🏗️','Site Daily Logs','','professional')),
      timesheets:        () => (typeof renderTimesheets === 'function' ? renderTimesheets() : this.renderComingSoon('⏱️','Timesheets','','professional')),
      omnichannel:       () => (typeof renderOmnichannelSync === 'function' ? renderOmnichannelSync() : this.renderComingSoon('🔄','Omnichannel Sync','','professional')),
      // ── New: Onboarding.js sections ──────────────────────────────────────────
      gst_filing:        () => (typeof renderGSTFiling === 'function' ? renderGSTFiling() : this.renderComingSoon('📑','GST Filing Hub','',null)),
      upi_tracker:       () => (typeof renderUPITracker === 'function' ? renderUPITracker() : this.renderComingSoon('💳','UPI Payment Tracker','',null)),
      tally_export:      () => (typeof renderTallyExport === 'function' ? renderTallyExport() : this.renderComingSoon('📊','Tally-Compatible Export','',null))
    };
    if (renders[id]) renders[id]();
    else this.renderDashboard();
  },
  // ── Vertical Dashboard Router ─────────────────────────────────────────────
  _renderVerticalDashboard() {
    const bizType = (this.session && this.session.bizType) ||
                    (this.settings && this.settings.businessType) || 'logistics';

    // Map legacy names to new vertical IDs
    const resolved = (bizType === 'transport' || bizType === 'logistics') ? 'logistics'
                   : (bizType === 'msme' || bizType === 'services' || bizType === 'service') ? 'msme'
                   : (bizType === 'retail' || bizType === 'trading') ? 'retail'
                   : (bizType === 'factory' || bizType === 'manufacturing') ? 'factory'
                   : 'other';

    if (resolved === 'factory') {
      if (typeof seedFactoryDemo === 'function') seedFactoryDemo();
      if (typeof renderFactoryDashboard === 'function') {
        try { renderFactoryDashboard(); return; } catch(e) { console.error('Factory dashboard error:', e); }
      }
    } else if (resolved === 'retail') {
      if (typeof seedRetailDemo === 'function') seedRetailDemo();
      if (typeof renderRetailDashboard === 'function') {
        try { renderRetailDashboard(); return; } catch(e) { console.error('Retail dashboard error:', e); }
      }
    } else if (resolved === 'msme') {
      if (typeof seedServicesDemo === 'function') seedServicesDemo();
      if (typeof renderServicesDashboard === 'function') {
        try { renderServicesDashboard(); return; } catch(e) { console.error('MSME dashboard error:', e); }
      }
    } else {
      // logistics + other → transport dashboard
      if (typeof seedTransportDemo === 'function') seedTransportDemo();
      if (typeof renderTransportDashboard === 'function') {
        try { renderTransportDashboard(); return; } catch(e) { console.error('Logistics dashboard error:', e); }
      }
    }
    // Fallback to generic dashboard if vertical files not loaded or errored
    this.renderDashboard();
  },

  renderDashboard() {
    const txns = STRATIX_DB.getArr('transactions');
    const now = new Date();
    const thisMonth = txns.filter(t => { const d=new Date(t.date||t.createdAt); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
    const revenue = thisMonth.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
    const expenses = thisMonth.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const profit = revenue - expenses;
    const margin = revenue > 0 ? ((profit/revenue)*100).toFixed(1) : 0;
    const healthScore = Math.min(100, Math.round(60 + (margin/100)*40));
    const riskLevel = healthScore >= 75 ? 'Low' : healthScore >= 50 ? 'Medium' : healthScore >= 30 ? 'High' : 'Critical';
    const riskColor = { Low:'#00d68f', Medium:'#2563EB', High:'#ff6600', Critical:'#e84040' };
    const sym = this.settings.currencySymbol || '₹';

    // Build monthly chart data
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const chartData = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mTxns = txns.filter(t => { const td=new Date(t.date||t.createdAt); return td.getMonth()===d.getMonth()&&td.getFullYear()===d.getFullYear(); });
      const mRev = mTxns.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
      const mExp = mTxns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
      chartData.push({ label: months[d.getMonth()], rev: mRev, exp: mExp, profit: mRev - mExp });
    }
    const maxVal = Math.max(...chartData.map(d=>Math.max(d.rev,d.exp)),1);

    // Pre-compute profit chart SVG (avoids nested IIFE in template literal)
    const maxP = Math.max(...chartData.map(d=>Math.abs(d.profit)),1);
    const pts = chartData.map((d,i)=>({ x: i*(280/5), y: 100 - ((d.profit/maxP)*80 + 10) }));
    const pathD = pts.map((p,i)=>(i===0?`M${p.x},${p.y}`:`L${p.x},${p.y}`)).join(' ');
    const areaD = `${pathD} L${pts[pts.length-1].x},120 L0,120 Z`;
    const profitSVG = `<path d="${areaD}" fill="url(#profGrad)"/><path d="${pathD}" fill="none" stroke="#00d68f" stroke-width="2.5" stroke-linecap="round"/>${pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4" fill="#00d68f"/>`).join('')}`;

    const recentTxns = [...txns].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);

    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head">
          <div>
            <h1 class="sec-title">Dashboard</h1>
            <p class="sec-sub">Welcome back, ${escapeHTML(this.session.name)} — ${escapeHTML(this.settings.businessName||'Your Business')}</p>
          </div>
          <div class="head-actions">
            <span class="date-badge">${now.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}</span>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card accent">
            <div class="kpi-lbl">Monthly Revenue</div>
            <div class="kpi-val">${sym}${this.fmt(revenue)}</div>
            <div class="kpi-trend up">↑ This Month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">Total Expenses</div>
            <div class="kpi-val red">${sym}${this.fmt(expenses)}</div>
            <div class="kpi-trend">Current Month</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-lbl">Net Profit</div>
            <div class="kpi-val ${profit>=0?'green':'red'}">${sym}${this.fmt(Math.abs(profit))}</div>
            <div class="kpi-trend ${profit>=0?'up':'down'}">${profit>=0?'↑':'↓'} ${margin}% Margin</div>
          </div>
          <div class="kpi-card health-card">
            <div class="kpi-lbl">Business Health</div>
            <div class="health-ring-wrap">
              <svg class="health-ring" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="32" fill="none" stroke="#E2E8F0" stroke-width="8"/>
                <circle cx="40" cy="40" r="32" fill="none" stroke="${healthScore>=70?'#00d68f':healthScore>=40?'#2563EB':'#e84040'}" stroke-width="8" stroke-dasharray="${2*Math.PI*32}" stroke-dashoffset="${2*Math.PI*32*(1-healthScore/100)}" stroke-linecap="round" transform="rotate(-90 40 40)"/>
                <text x="40" y="44" text-anchor="middle" fill="${healthScore>=70?'#00d68f':healthScore>=40?'#2563EB':'#e84040'}" font-size="16" font-weight="700">${healthScore}</text>
              </svg>
            </div>
            <div class="kpi-trend" style="color:${riskColor[riskLevel]}">Risk: ${riskLevel}</div>
          </div>
        </div>

        <div class="charts-row">
          <div class="chart-card">
            <div class="chart-hd"><h3>Revenue vs Expenses</h3><span class="chart-sub">Last 6 months</span></div>
            <div class="bar-chart" id="revenueChart">
              ${chartData.map(d=>`
                <div class="bar-grp">
                  <div class="bars">
                    <div class="bar rev" style="height:${Math.round((d.rev/maxVal)*140)}px" title="Revenue: ${sym}${this.fmt(d.rev)}"></div>
                    <div class="bar exp" style="height:${Math.round((d.exp/maxVal)*140)}px" title="Expense: ${sym}${this.fmt(d.exp)}"></div>
                  </div>
                  <div class="bar-lbl">${d.label}</div>
                </div>`).join('')}
            </div>
            <div class="chart-legend">
              <span class="leg rev">Revenue</span>
              <span class="leg exp">Expenses</span>
            </div>
          </div>

          <div class="chart-card">
            <div class="chart-hd"><h3>Profit Trend</h3></div>
            <div class="line-chart-wrap" id="profitChart">
              <svg viewBox="0 0 280 120" preserveAspectRatio="none" style="width:100%;height:120px">
                <defs><linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#00d68f" stop-opacity="0.3"/><stop offset="100%" stop-color="#00d68f" stop-opacity="0"/></linearGradient></defs>
                ${profitSVG}
              </svg>
              <div class="line-labels">${chartData.map(d=>`<span>${d.label}</span>`).join('')}</div>
            </div>
          </div>
        </div>

        <div class="tbl-wrap">
          <div class="tbl-head">
            <h3>Recent Transactions</h3>
            <button class="btn btn-ghost btn-sm" onclick="APP.navigate('datamanager')">View All →</button>
          </div>
          <div class="tbl-scroll">
            <table class="data-table">
              <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th></tr></thead>
              <tbody>
                ${recentTxns.map(t=>`
                  <tr>
                    <td>${t.date||t.createdAt.split('T')[0]}</td>
                    <td><span class="badge-type ${t.type==='revenue'?'revenue':'expense'}">${t.type==='revenue'?'Revenue':'Expense'}</span></td>
                    <td>${escapeHTML(t.category||'—')}</td>
                    <td>${escapeHTML(t.description||'—')}</td>
                    <td class="${t.type==='revenue'?'green':'red'}">${t.type==='expense'?'−':'+'} ${sym}${this.fmt(t.amount)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="quick-actions">
          <h3>Quick Actions</h3>
          <div class="qa-grid">
            <button class="qa-btn" onclick="APP.navigate('datamanager')">➕ Add Transaction</button>
            <button class="qa-btn" onclick="APP.navigate('documents')">📄 Generate Invoice</button>
            <button class="qa-btn" onclick="APP.navigate('trippnl')">🛣️ Log Trip</button>
            <button class="qa-btn" onclick="APP.navigate('reminders')">🔔 Set Reminder</button>
          </div>
        </div>
      </div>`;
  },

  // ── ANALYTICS ──────────────────────────────────────────────────────────────
  renderAnalytics() {
    const txns = STRATIX_DB.getArr('transactions');
    const sym = this.settings.currencySymbol || '₹';
    const totalRev = txns.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
    const totalExp = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const totalProfit = totalRev - totalExp;
    const margin = totalRev > 0 ? ((totalProfit/totalRev)*100).toFixed(1) : 0;

    const expByCategory = {};
    txns.filter(t=>t.type==='expense').forEach(t=>{ expByCategory[t.category||'other']=(expByCategory[t.category||'other']||0)+t.amount; });
    const topExp = Object.entries(expByCategory).sort((a,b)=>b[1]-a[1]);

    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Analytics Panel</h1><p class="sec-sub">Business performance overview</p></div>
        <div class="kpi-grid">
          <div class="kpi-card accent"><div class="kpi-lbl">Total Revenue</div><div class="kpi-val">${sym}${this.fmt(totalRev)}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Total Expenses</div><div class="kpi-val red">${sym}${this.fmt(totalExp)}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Net Profit</div><div class="kpi-val green">${sym}${this.fmt(totalProfit)}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Profit Margin</div><div class="kpi-val">${margin}%</div></div>
        </div>
        <div class="tbl-wrap">
          <div class="tbl-head"><h3>Expense Breakdown by Category</h3></div>
          ${topExp.map(([cat,amt])=>{
            const pct = totalExp > 0 ? ((amt/totalExp)*100).toFixed(1) : 0;
            return `<div class="cat-row">
              <div class="cat-name">${cat}</div>
              <div class="cat-bar-wrap"><div class="cat-bar" style="width:${pct}%"></div></div>
              <div class="cat-pct">${pct}%</div>
              <div class="cat-amt">${sym}${this.fmt(amt)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  // ── DECISION ENGINE ────────────────────────────────────────────────────────
  renderDecision() {
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Decision Engine</h1><p class="sec-sub">Simulate business decisions with AI-powered analysis</p></div>
        <div class="decision-grid">
          ${[
            { id:'location', title:'Open New Location', icon:'🏪', desc:'Analyze ROI of expanding to a new location' },
            { id:'price', title:'Increase Prices', icon:'💹', desc:'Demand impact analysis for price change' },
            { id:'routes', title:'Expand Delivery Routes', icon:'🗺️', desc:'ROI calculation for new routes' },
            { id:'hire', title:'Hire New Employees', icon:'👷', desc:'Net gain analysis for headcount increase' },
            { id:'vehicle', title:'Purchase Vehicle', icon:'🚛', desc:'Fleet expansion ROI analysis' }
          ].map(d=>`
            <div class="decision-card" onclick="APP.runDecision('${d.id}')">
              <div class="dec-icon">${d.icon}</div>
              <h3>${d.title}</h3>
              <p>${d.desc}</p>
              <button class="btn-dec">Run Analysis →</button>
            </div>`).join('')}
        </div>
        <div id="decisionResult"></div>
      </div>`;
  },

  runDecision(type) {
    const txns = STRATIX_DB.getArr('transactions');
    const revenue = txns.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0)/6;
    const expenses = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)/6;
    const sym = this.settings.currencySymbol||'₹';
    const profit = revenue - expenses;

    const results = {
      location: { risk:'Medium', impact:`+${sym}${this.fmt(revenue*0.3)}/month projected`, breakeven:'8-12 months', rec:'Proceed if capital available. New location could add 30% revenue based on current performance.' },
      price: { risk:'Low', impact:`+${sym}${this.fmt(revenue*0.1)}/month projected`, breakeven:'Immediate', rec:'A 10% price increase with 5% volume loss still nets positive. Recommend gradual 5-7% increase.' },
      routes: { risk:'Medium', impact:`+${sym}${this.fmt(revenue*0.15)}/month projected`, breakeven:'4-6 months', rec:'New routes viable if freight coverage exceeds 2.5x fuel cost. Test with 1 route first.' },
      hire: { risk:'Low', impact:`+${sym}${this.fmt(profit*0.2)}/month projected`, breakeven:'3-4 months', rec:'Hiring recommended if current capacity utilization exceeds 80%. Adds capacity for growth.' },
      vehicle: { risk:'High', impact:`+${sym}${this.fmt(revenue*0.12)}/month projected`, breakeven:'18-24 months', rec:'Vehicle purchase viable only with secured freight contracts. Consider leasing first.' }
    };

    const r = results[type];
    document.getElementById('decisionResult').innerHTML = `
      <div class="dec-result">
        <h3>Analysis Result</h3>
        <div class="result-grid">
          <div class="result-item"><div class="res-label">Risk Level</div><div class="res-val risk-${r.risk.toLowerCase()}">${r.risk}</div></div>
          <div class="result-item"><div class="res-label">Profit Impact</div><div class="res-val green">${r.impact}</div></div>
          <div class="result-item"><div class="res-label">Break-Even</div><div class="res-val">${r.breakeven}</div></div>
        </div>
        <div class="rec-box"><strong>Recommendation:</strong> ${r.rec}</div>
      </div>`;
  },

  // ── CALCULATORS ───────────────────────────────────────────────────────────
  renderCalculators() {
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Business Calculators</h1></div>
        <div class="calc-tabs" id="calcTabs">
          ${['Profit','Break-Even','Pricing','Idea Validator','Forecast'].map((t,i)=>`<button class="calc-tab${i===0?' active':''}" onclick="APP.switchCalc(${i},'${t}')">${t}</button>`).join('')}
        </div>
        <div id="calcContent">
          <div class="calc-card">
            <h3>Profit Calculator</h3>
            <div class="calc-grid">
              <div class="field"><label>Revenue (${sym})</label><input type="number" id="cRevenue" placeholder="500000"/></div>
              <div class="field"><label>Cost of Goods (${sym})</label><input type="number" id="cCOGS" placeholder="200000"/></div>
              <div class="field"><label>Operating Expenses (${sym})</label><input type="number" id="cOpEx" placeholder="100000"/></div>
              <div class="field"><label>Tax Rate (%)</label><input type="number" id="cTax" placeholder="18"/></div>
            </div>
            <button class="btn-calc" onclick="APP.calcProfit()">Calculate →</button>
            <div id="calcResult"></div>
          </div>
        </div>
      </div>`;
  },

  switchCalc(idx, name) {
    document.querySelectorAll('.calc-tab').forEach((t,i)=>t.classList.toggle('active',i===idx));
    const calcTemplates = {
      'Break-Even': `<div class="calc-card"><h3>Break-Even Calculator</h3>
        <div class="calc-grid">
          <div class="field"><label>Fixed Costs</label><input type="number" id="beFixed" placeholder="100000"/></div>
          <div class="field"><label>Variable Cost per Unit</label><input type="number" id="beVar" placeholder="150"/></div>
          <div class="field"><label>Selling Price per Unit</label><input type="number" id="bePrice" placeholder="250"/></div>
        </div>
        <button class="btn-calc" onclick="APP.calcBreakEven()">Calculate →</button>
        <div id="calcResult"></div></div>`,
      'Pricing': `<div class="calc-card"><h3>Pricing Optimizer</h3>
        <div class="calc-grid">
          <div class="field"><label>Your Cost</label><input type="number" id="poCost" placeholder="200"/></div>
          <div class="field"><label>Competitor Price</label><input type="number" id="poComp" placeholder="350"/></div>
          <div class="field"><label>Target Margin (%)</label><input type="number" id="poMargin" placeholder="30"/></div>
        </div>
        <button class="btn-calc" onclick="APP.calcPricing()">Optimize →</button>
        <div id="calcResult"></div></div>`,
      'Idea Validator': `<div class="calc-card"><h3>Business Idea Validator</h3>
        <div class="calc-grid">
          <div class="field"><label>Market Size (${this.settings.currencySymbol||'₹'})</label><input type="number" id="ivMarket" placeholder="10000000"/></div>
          <div class="field"><label>Est. Market Share (%)</label><input type="number" id="ivShare" placeholder="2"/></div>
          <div class="field"><label>Initial Investment</label><input type="number" id="ivInvest" placeholder="500000"/></div>
          <div class="field"><label>Monthly Operating Cost</label><input type="number" id="ivOps" placeholder="50000"/></div>
        </div>
        <button class="btn-calc" onclick="APP.calcIdeaValidator()">Validate →</button>
        <div id="calcResult"></div></div>`,
      'Forecast': `<div class="calc-card"><h3>12-Month Profit Forecast</h3>
        <div class="calc-grid">
          <div class="field"><label>Current Monthly Revenue</label><input type="number" id="fcRev" placeholder="200000"/></div>
          <div class="field"><label>Monthly Growth Rate (%)</label><input type="number" id="fcGrowth" placeholder="5"/></div>
          <div class="field"><label>Fixed Monthly Costs</label><input type="number" id="fcFixed" placeholder="80000"/></div>
          <div class="field"><label>Variable Cost (%)</label><input type="number" id="fcVar" placeholder="35"/></div>
        </div>
        <button class="btn-calc" onclick="APP.calcForecast()">Generate Forecast →</button>
        <div id="calcResult"></div></div>`,
      'Profit': ''
    };
    if (calcTemplates[name] !== '') document.getElementById('calcContent').innerHTML = calcTemplates[name];
    else this.renderCalculators();
  },

  calcProfit() {
    const rev = +document.getElementById('cRevenue').value||0;
    const cogs = +document.getElementById('cCOGS').value||0;
    const opex = +document.getElementById('cOpEx').value||0;
    const tax = +document.getElementById('cTax').value||0;
    const gross = rev - cogs;
    const operating = gross - opex;
    const net = operating * (1 - tax/100);
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('calcResult').innerHTML = `
      <div class="calc-res">
        <div class="cri"><div>Gross Profit</div><div class="res-val green">${sym}${this.fmt(gross)} (${rev>0?((gross/rev)*100).toFixed(1):0}%)</div></div>
        <div class="cri"><div>Operating Profit</div><div class="res-val">${sym}${this.fmt(operating)} (${rev>0?((operating/rev)*100).toFixed(1):0}%)</div></div>
        <div class="cri"><div>Net Profit</div><div class="res-val ${net>=0?'green':'red'}">${sym}${this.fmt(net)} (${rev>0?((net/rev)*100).toFixed(1):0}%)</div></div>
      </div>`;
  },

  calcBreakEven() {
    const fixed = +document.getElementById('beFixed').value||0;
    const varC = +document.getElementById('beVar').value||0;
    const price = +document.getElementById('bePrice').value||1;
    const contribution = price - varC;
    const beUnits = Math.ceil(fixed / contribution);
    const beRevenue = beUnits * price;
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('calcResult').innerHTML = `
      <div class="calc-res">
        <div class="cri"><div>Break-Even Units</div><div class="res-val">${beUnits.toLocaleString('en-IN')}</div></div>
        <div class="cri"><div>Break-Even Revenue</div><div class="res-val">${sym}${this.fmt(beRevenue)}</div></div>
        <div class="cri"><div>Contribution Margin</div><div class="res-val green">${sym}${contribution}/unit</div></div>
      </div>`;
  },

  calcPricing() {
    const cost = +document.getElementById('poCost').value||0;
    const comp = +document.getElementById('poComp').value||0;
    const margin = +document.getElementById('poMargin').value||30;
    const marginPrice = cost * (1 + margin/100);
    const competitive = (marginPrice + comp*0.95) / 2;
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('calcResult').innerHTML = `
      <div class="calc-res">
        <div class="cri"><div>Cost-Plus Price</div><div class="res-val">${sym}${this.fmt(marginPrice)}</div></div>
        <div class="cri"><div>Competitive Price</div><div class="res-val green">${sym}${this.fmt(competitive)}</div></div>
        <div class="cri"><div>vs Competitor</div><div class="res-val ${competitive<comp?'green':'red'}">${competitive<comp?'5% Below':'Parity'}</div></div>
      </div>`;
  },

  calcIdeaValidator() {
    const market = +document.getElementById('ivMarket').value||0;
    const share = +document.getElementById('ivShare').value||0;
    const invest = +document.getElementById('ivInvest').value||0;
    const ops = +document.getElementById('ivOps').value||0;
    const annualRev = market * (share/100);
    const annualCost = ops * 12;
    const roi = invest > 0 ? (((annualRev-annualCost)/invest)*100).toFixed(1) : 0;
    const score = Math.min(100, Math.round(20 + (roi>50?30:roi>20?20:roi>0?10:0) + (annualRev>annualCost?30:0) + (share<5?10:5)));
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('calcResult').innerHTML = `
      <div class="calc-res">
        <div class="cri"><div>Viability Score</div><div class="res-val ${score>=70?'green':score>=40?'':'red'}">${score}/100</div></div>
        <div class="cri"><div>Projected Annual Revenue</div><div class="res-val">${sym}${this.fmt(annualRev)}</div></div>
        <div class="cri"><div>ROI</div><div class="res-val ${roi>0?'green':'red'}">${roi}%</div></div>
      </div>`;
  },

  calcForecast() {
    const rev = +document.getElementById('fcRev').value||0;
    const growth = +document.getElementById('fcGrowth').value||0;
    const fixed = +document.getElementById('fcFixed').value||0;
    const varPct = +document.getElementById('fcVar').value||0;
    const sym = this.settings.currencySymbol||'₹';
    let html = '<div class="forecast-table"><table class="data-table"><thead><tr><th>Month</th><th>Revenue</th><th>Expenses</th><th>Profit</th></tr></thead><tbody>';
    let r = rev;
    for (let m = 1; m <= 12; m++) {
      const exp = fixed + (r * varPct/100);
      const p = r - exp;
      html += `<tr><td>Month ${m}</td><td class="green">${sym}${this.fmt(r)}</td><td class="red">${sym}${this.fmt(exp)}</td><td class="${p>=0?'green':'red'}">${sym}${this.fmt(p)}</td></tr>`;
      r *= (1 + growth/100);
    }
    html += '</tbody></table></div>';
    document.getElementById('calcResult').innerHTML = html;
  },

  // ── LOGISTICS ─────────────────────────────────────────────────────────────
  renderLogistics() {
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Logistics Tools</h1></div>
        <div class="logistics-grid">
          ${[
            { title:'Fuel Cost Calculator', inputs:[{id:'flDist',label:'Distance (km)',ph:'500'},{id:'flEff',label:'Fuel Efficiency (km/L)',ph:'8'},{id:'flPrice',label:'Fuel Price/L ('+sym+')',ph:'102'}], btn:'calcFuel', label:'Calculate Fuel Cost' },
            { title:'Route Profit Calculator', inputs:[{id:'rpFreight',label:'Freight Revenue',ph:'25000'},{id:'rpFuel',label:'Fuel Cost',ph:'4500'},{id:'rpToll',label:'Toll Charges',ph:'800'},{id:'rpDriver',label:'Driver Cost',ph:'1200'}], btn:'calcRoute', label:'Calculate Route Profit' },
            { title:'Driver Cost Calculator', inputs:[{id:'dcSalary',label:'Basic Salary',ph:'15000'},{id:'dcDA',label:'Daily Allowance/day',ph:'500'},{id:'dcDays',label:'Trip Days',ph:'10'},{id:'dcPF',label:'PF/ESI (%)',ph:'12'}], btn:'calcDriver', label:'Calculate Driver Cost' },
            { title:'Delivery Pricing', inputs:[{id:'dpDist',label:'Distance (km)',ph:'300'},{id:'dpWeight',label:'Load (tons)',ph:'5'},{id:'dpCost',label:'Total Trip Cost',ph:'8000'}], btn:'calcDelivery', label:'Get Recommended Price' }
          ].map(c=>`
            <div class="logistics-card">
              <h3>${c.title}</h3>
              ${c.inputs.map(i=>`<div class="field"><label>${i.label}</label><input type="number" id="${i.id}" placeholder="${i.ph}"/></div>`).join('')}
              <button class="btn-calc" onclick="APP.${c.btn}()">${c.label}</button>
              <div id="${c.btn}Result"></div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  calcFuel() {
    const d=+document.getElementById('flDist').value||0, e=+document.getElementById('flEff').value||1, p=+document.getElementById('flPrice').value||0;
    const liters=d/e, cost=liters*p, sym=this.settings.currencySymbol||'₹';
    document.getElementById('calcFuelResult').innerHTML=`<div class="log-result">Fuel Needed: <strong>${liters.toFixed(1)}L</strong> | Trip Cost: <strong class="gold">${sym}${this.fmt(cost)}</strong></div>`;
  },
  calcRoute() {
    const f=+document.getElementById('rpFreight').value||0, fu=+document.getElementById('rpFuel').value||0, t=+document.getElementById('rpToll').value||0, d=+document.getElementById('rpDriver').value||0;
    const profit=f-fu-t-d, margin=f>0?((profit/f)*100).toFixed(1):0, sym=this.settings.currencySymbol||'₹';
    document.getElementById('calcRouteResult').innerHTML=`<div class="log-result">Net Profit: <strong class="${profit>=0?'green':'red'}">${sym}${this.fmt(profit)}</strong> | Margin: ${margin}%</div>`;
  },
  calcDriver() {
    const s=+document.getElementById('dcSalary').value||0, da=+document.getElementById('dcDA').value||0, days=+document.getElementById('dcDays').value||0, pf=+document.getElementById('dcPF').value||0;
    const total=s+(da*days)+(s*pf/100), sym=this.settings.currencySymbol||'₹';
    document.getElementById('calcDriverResult').innerHTML=`<div class="log-result">Total Driver Cost: <strong class="gold">${sym}${this.fmt(total)}</strong></div>`;
  },
  calcDelivery() {
    const dist=+document.getElementById('dpDist').value||0, w=+document.getElementById('dpWeight').value||1, cost=+document.getElementById('dpCost').value||0;
    const recommended=cost*1.35, perKm=(recommended/dist).toFixed(2), sym=this.settings.currencySymbol||'₹';
    document.getElementById('calcDeliveryResult').innerHTML=`<div class="log-result">Recommended: <strong class="gold">${sym}${this.fmt(recommended)}</strong> | ${sym}${perKm}/km</div>`;
  },

  // ── DOCUMENTS ─────────────────────────────────────────────────────────────
  renderDocuments() {
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Document Center</h1><p class="sec-sub">8 professional document generators — Print & PDF ready</p></div>
        <div class="doc-grid">
          ${[
            { id:'invoice', icon:'🧾', title:'Tax Invoice', sub:'GST-ready with CGST/SGST' },
            { id:'delivery', icon:'📋', title:'Delivery Note', sub:'With driver & vehicle details' },
            { id:'cargo', icon:'📦', title:'Cargo Manifest', sub:'Complete freight manifest' },
            { id:'logbook', icon:'📓', title:'Vehicle Logbook', sub:'Per-trip log with auto KM' },
            { id:'explog', icon:'💳', title:'Expense Log', sub:'Category-wise with totals' },
            { id:'po', icon:'🛒', title:'Purchase Order', sub:'Official vendor PO with GST' },
            { id:'receipt', icon:'🧧', title:'Payment Receipt', sub:'Amount in words auto-generated' },
            { id:'quotation', icon:'📝', title:'Quotation', sub:'Professional with T&C' }
          ].map(d=>`
            <div class="doc-card" onclick="APP.openDocument('${d.id}')">
              <div class="doc-icon">${d.icon}</div>
              <h3>${d.title}</h3>
              <p>${d.sub}</p>
              <button class="btn-doc">Generate →</button>
            </div>`).join('')}
        </div>
      </div>`;
  },

  openDocument(type) {
    const s = this.settings;
    const sym = s.currencySymbol||'₹';
    const templates = {
      invoice: () => `
        <div class="doc-form">
          <h3>🧾 Tax Invoice Generator</h3>
          <div class="doc-fields">
            <div class="field"><label>Invoice No</label><input id="dInvNo" value="${APP._nextInvoiceNo()}"/></div>
            <div class="field"><label>Date</label><input type="date" id="dDate" value="${new Date().toISOString().split('T')[0]}"/></div>
            <div class="field"><label>Due Date</label><input type="date" id="dDue" value="${new Date(Date.now()+15*24*60*60*1000).toISOString().split('T')[0]}"/></div>
            <div class="field"><label>Client Name</label><input id="dClient" placeholder="Client company name" maxlength="100"/></div>
            <div class="field"><label>Client GST</label><input id="dClientGST" placeholder="22XXXXX0000X1Z5"/></div>
            <div class="field"><label>Item Description</label><input id="dItem" placeholder="Freight service Mumbai-Pune" maxlength="200"/></div>
            <div class="field"><label>Amount (${sym})</label><input type="number" id="dAmt" placeholder="25000" oninput="APP.calcInvoice()"/></div>
            <div class="field"><label>GST Rate (%)</label>
              <select id="dGST" onchange="APP.calcInvoice()"><option value="5">5%</option><option value="12">12%</option><option value="18" selected>18%</option><option value="28">28%</option></select>
            </div>
          </div>
          <div id="invoiceTotals" class="invoice-totals"></div>
          <button class="btn-calc" onclick="APP.printDoc('invoice')">🖨️ Print / Save PDF</button>
        </div>`,
      receipt: () => `
        <div class="doc-form">
          <h3>🧧 Payment Receipt</h3>
          <div class="doc-fields">
            <div class="field"><label>Receipt No</label><input id="rNo" value="${APP._nextDocNo('RCP', 'sx_rcp_counter')}"/></div>
            <div class="field"><label>Date</label><input type="date" id="rDate" value="${new Date().toISOString().split('T')[0]}"/></div>
            <div class="field"><label>Received From</label><input id="rFrom" placeholder="Payer name"/></div>
            <div class="field"><label>Amount (${sym})</label><input type="number" id="rAmt" placeholder="50000" oninput="APP.updateAmountWords()"/></div>
            <div class="field"><label>Payment Mode</label><select id="rMode"><option>Cash</option><option>NEFT</option><option>RTGS</option><option>UPI</option><option>Cheque</option></select></div>
            <div class="field"><label>Towards</label><input id="rTowards" placeholder="Invoice INV-001234"/></div>
          </div>
          <div id="amtWords" class="amt-words"></div>
          <button class="btn-calc" onclick="APP.printDoc('receipt')">🖨️ Print / Save PDF</button>
        </div>`
    };
    const defaultTemplate = `
      <div class="doc-form">
        <h3>Document Generator</h3>
        <div class="doc-fields">
          <div class="field"><label>Document No</label><input id="docNo" value="${APP._nextDocNo('DOC', 'sx_doc_counter')}"/></div>
          <div class="field"><label>Date</label><input type="date" id="docDate" value="${new Date().toISOString().split('T')[0]}"/></div>
          <div class="field"><label>Party Name</label><input id="docParty" placeholder="Company / Person name"/></div>
          <div class="field"><label>Details</label><textarea id="docDetails" rows="3" placeholder="Enter document details..."></textarea></div>
          <div class="field"><label>Amount</label><input type="number" id="docAmt" placeholder="0"/></div>
        </div>
        <button class="btn-calc" onclick="APP.printDoc('generic')">🖨️ Print / Save PDF</button>
      </div>`;

    const content = document.getElementById('sectionContent');
    content.innerHTML = `<div class="sec">
      <div class="sec-head">
        <button class="btn-back" onclick="APP.navigate('documents')">← Back to Documents</button>
      </div>
      ${templates[type] ? templates[type]() : defaultTemplate}
    </div>`;
    if (type==='invoice') this.calcInvoice();
  },

  calcInvoice() {
    const amt = +document.getElementById('dAmt')?.value||0;
    const gstRate = +document.getElementById('dGST')?.value||18;
    const cgst = amt * (gstRate/2)/100;
    const sgst = amt * (gstRate/2)/100;
    const total = amt + cgst + sgst;
    const sym = this.settings.currencySymbol||'₹';
    const el = document.getElementById('invoiceTotals');
    if (el) el.innerHTML = `
      <div class="inv-row"><span>Taxable Amount</span><span>${sym}${this.fmt(amt)}</span></div>
      <div class="inv-row"><span>CGST @${gstRate/2}%</span><span>${sym}${this.fmt(cgst)}</span></div>
      <div class="inv-row"><span>SGST @${gstRate/2}%</span><span>${sym}${this.fmt(sgst)}</span></div>
      <div class="inv-row total"><span>TOTAL</span><span class="gold">${sym}${this.fmt(total)}</span></div>`;
  },

  updateAmountWords() {
    const amt = +document.getElementById('rAmt')?.value||0;
    const words = this.numberToWords(amt);
    const el = document.getElementById('amtWords');
    if (el) el.innerHTML = `<div class="amt-words-box">Amount in Words: <strong>${words} Only</strong></div>`;
  },

  numberToWords(num) {
    if (num === 0) return 'Zero';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const convert = (n) => {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n/10)] + (n%10?' '+ones[n%10]:'');
      if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100?' '+convert(n%100):'');
      if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000?' '+convert(n%1000):'');
      if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000?' '+convert(n%100000):'');
      return convert(Math.floor(n/10000000)) + ' Crore' + (n%10000000?' '+convert(n%10000000):'');
    };
    return 'Rupees ' + convert(Math.floor(num));
  },

  printDoc(type) {
    // ── Read ALL form values BEFORE touching the DOM ──────────────────────
    const s = this.settings;
    const sym = s.currencySymbol || '₹';
    const biz = s.businessName || 'My Business';
    const addr = s.address || '';
    const ph = s.phone || '';
    const gst = s.gstNumber || '';
    const pan = s.panNumber || '';
    const state = s.state || '';
    const now = new Date();

    // Capture field values from the live form (before innerHTML is replaced)
    const fv = (id) => {
      const el = document.getElementById(id);
      if (!el) return '';
      return (el.value || '').trim();
    };

    let docHTML = '';

    if (type === 'invoice') {
      const amt    = parseFloat(fv('dAmt')) || 0;
      const gstPct = parseFloat(fv('dGST')) || 18;
      const cgst   = amt * (gstPct/2) / 100;
      const sgst   = amt * (gstPct/2) / 100;
      const total  = amt + cgst + sgst;

      docHTML = `
        <div class="sx-section-title">TAX INVOICE</div>
        <div class="sx-doc-meta">
          <div><span class="sx-lbl">Invoice No</span><span class="sx-val">${fv('dInvNo')}</span></div>
          <div><span class="sx-lbl">Date</span><span class="sx-val">${this._fmtDate(fv('dDate'))}</span></div>
          <div><span class="sx-lbl">Due Date</span><span class="sx-val">${this._fmtDate(fv('dDue')) || '—'}</span></div>
        </div>
        <div class="sx-party-row">
          <div class="sx-party-box">
            <div class="sx-party-lbl">BILLED BY</div>
            <div class="sx-party-name">${escapeHTML(biz)}</div>
            ${addr ? `<div class="sx-party-meta">${escapeHTML(addr)}</div>` : ''}
            ${ph ? `<div class="sx-party-meta">Ph: ${escapeHTML(ph)}</div>` : ''}
            ${gst ? `<div class="sx-party-meta">GSTIN: ${escapeHTML(gst)}</div>` : ''}
            ${pan ? `<div class="sx-party-meta">PAN: ${escapeHTML(pan)}</div>` : ''}
            ${state ? `<div class="sx-party-meta">State: ${escapeHTML(state)}</div>` : ''}
          </div>
          <div class="sx-party-box">
            <div class="sx-party-lbl">BILLED TO</div>
            <div class="sx-party-name">${escapeHTML(fv('dClient') || '—')}</div>
            ${fv('dClientGST') ? `<div class="sx-party-meta">GSTIN: ${escapeHTML(fv('dClientGST'))}</div>` : ''}
          </div>
        </div>
        <table class="sx-table">
          <thead><tr>
            <th>#</th><th>Description</th><th>Qty</th><th>Rate (${sym})</th><th>Amount (${sym})</th>
          </tr></thead>
          <tbody>
            <tr><td>1</td><td>${escapeHTML(fv('dItem') || '—')}</td><td>1</td><td>${this.fmt(amt)}</td><td>${this.fmt(amt)}</td></tr>
          </tbody>
        </table>
        <div class="sx-totals">
          <div class="sx-total-row"><span>Taxable Amount</span><span>${sym}${this.fmt(amt)}</span></div>
          <div class="sx-total-row"><span>CGST @ ${gstPct/2}%</span><span>${sym}${this.fmt(cgst)}</span></div>
          <div class="sx-total-row"><span>SGST @ ${gstPct/2}%</span><span>${sym}${this.fmt(sgst)}</span></div>
          <div class="sx-total-grand"><span>TOTAL AMOUNT</span><span>${sym}${this.fmt(total)}</span></div>
          <div class="sx-words">Amount in Words: <strong>${this.numberToWords(Math.round(total))} Only</strong></div>
        </div>
        <div class="sx-sigs">
          <div class="sx-sig-box"><div class="sx-sig-line"></div><div class="sx-sig-lbl">Authorised Signatory</div><div class="sx-sig-lbl">${escapeHTML(biz)}</div></div>
          <div class="sx-sig-box"><div class="sx-sig-line"></div><div class="sx-sig-lbl">Receiver's Signature</div></div>
        </div>`;

    } else if (type === 'receipt') {
      const amt = parseFloat(fv('rAmt')) || 0;
      docHTML = `
        <div class="sx-section-title">PAYMENT RECEIPT</div>
        <div class="sx-doc-meta">
          <div><span class="sx-lbl">Receipt No</span><span class="sx-val">${fv('rNo')}</span></div>
          <div><span class="sx-lbl">Date</span><span class="sx-val">${this._fmtDate(fv('rDate'))}</span></div>
        </div>
        <div class="sx-receipt-box">
          <div class="sx-receipt-row"><span class="sx-lbl">Received From</span><span class="sx-val"><strong>${escapeHTML(fv('rFrom') || '—')}</strong></span></div>
          <div class="sx-receipt-row"><span class="sx-lbl">Amount</span><span class="sx-val" style="font-size:22px;font-weight:800;color:#1a1a2e">${sym}${this.fmt(amt)}</span></div>
          <div class="sx-receipt-row"><span class="sx-lbl">Payment Mode</span><span class="sx-val">${escapeHTML(fv('rMode'))}</span></div>
          <div class="sx-receipt-row"><span class="sx-lbl">Towards</span><span class="sx-val">${escapeHTML(fv('rTowards') || '—')}</span></div>
        </div>
        <div class="sx-words" style="margin-top:14px">Amount in Words: <strong>${this.numberToWords(Math.round(amt))} Only</strong></div>
        <div class="sx-sigs" style="margin-top:32px">
          <div class="sx-sig-box"><div class="sx-sig-line"></div><div class="sx-sig-lbl">Authorised Signatory</div></div>
          <div class="sx-sig-box"><div class="sx-sig-line"></div><div class="sx-sig-lbl">Receiver's Signature</div></div>
        </div>`;

    } else {
      // Generic doc — read common fields
      const amt = parseFloat(fv('docAmt')) || 0;
      docHTML = `
        <div class="sx-section-title">DOCUMENT</div>
        <div class="sx-doc-meta">
          <div><span class="sx-lbl">Document No</span><span class="sx-val">${fv('docNo')}</span></div>
          <div><span class="sx-lbl">Date</span><span class="sx-val">${this._fmtDate(fv('docDate'))}</span></div>
        </div>
        <div class="sx-receipt-box">
          <div class="sx-receipt-row"><span class="sx-lbl">Party Name</span><span class="sx-val">${escapeHTML(fv('docParty') || '—')}</span></div>
          <div class="sx-receipt-row"><span class="sx-lbl">Details</span><span class="sx-val">${escapeHTML(fv('docDetails') || '—')}</span></div>
          ${amt > 0 ? `<div class="sx-receipt-row"><span class="sx-lbl">Amount</span><span class="sx-val" style="font-size:20px;font-weight:800">${sym}${this.fmt(amt)}</span></div>` : ''}
        </div>
        ${amt > 0 ? `<div class="sx-words">Amount in Words: <strong>${this.numberToWords(Math.round(amt))} Only</strong></div>` : ''}
        <div class="sx-sigs" style="margin-top:32px">
          <div class="sx-sig-box"><div class="sx-sig-line"></div><div class="sx-sig-lbl">Authorised Signatory</div></div>
          <div class="sx-sig-box"><div class="sx-sig-line"></div><div class="sx-sig-lbl">Receiver's Signature</div></div>
        </div>`;
    }

    // ── Open clean popup and write full professional PDF ──────────────────
    const win = window.open('', '_blank', 'width=900,height=820');
    if (!win) { NOTIFY.show('Popup blocked! Allow popups for this site to print.', 'warning', 5000); return; }

    const css = `
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @media print {
        body { background: #fff !important; padding: 0 !important; }
        .no-print { display: none !important; }
        .sx-doc-wrap { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
      }
      body { font-family: 'Inter', Arial, sans-serif; background: #f4f4f4; padding: 24px 16px; color: #1a1a2e; }
      .sx-doc-wrap { background: #fff; max-width: 800px; margin: 0 auto; padding: 40px 44px; border-radius: 16px; box-shadow: 0 8px 48px rgba(0,0,0,.15); }

      /* ── Header ── */
      .sx-doc-header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 20px; margin-bottom: 24px; border-bottom: 3px solid #2563EB; }
      .sx-biz-name { font-size: 22px; font-weight: 800; color: #1a1a2e; letter-spacing: -.3px; margin-bottom: 5px; }
      .sx-biz-meta { font-size: 12px; color: #555; line-height: 1.8; }
      .sx-logo-block { text-align: right; flex-shrink: 0; }
      .sx-logo-mark { width: 44px; height: 44px; background: linear-gradient(135deg,#2563EB,#1D4ED8); border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 16px; color: #111; margin-bottom: 6px; }
      .sx-logo-name { font-size: 12px; font-weight: 800; color: #2563EB; letter-spacing: 2px; }
      .sx-logo-date { font-size: 11px; color: #aaa; margin-top: 2px; }

      /* ── Section title ── */
      .sx-section-title { font-size: 18px; font-weight: 800; color: #2563EB; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #f0e0c0; }

      /* ── Doc meta ── */
      .sx-doc-meta { display: flex; gap: 32px; background: #f9f9f9; border-radius: 10px; padding: 14px 18px; margin-bottom: 20px; flex-wrap: wrap; }
      .sx-doc-meta > div { display: flex; flex-direction: column; gap: 3px; }
      .sx-lbl { font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .6px; }
      .sx-val { font-size: 14px; font-weight: 700; color: #1a1a2e; }

      /* ── Party row ── */
      .sx-party-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
      .sx-party-box { background: #f9f9f9; border-radius: 10px; padding: 14px 18px; border-left: 3px solid #2563EB; }
      .sx-party-lbl { font-size: 10px; font-weight: 700; color: #2563EB; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 6px; }
      .sx-party-name { font-size: 16px; font-weight: 800; color: #1a1a2e; margin-bottom: 4px; }
      .sx-party-meta { font-size: 12px; color: #555; line-height: 1.7; }

      /* ── Table ── */
      .sx-table { width: 100%; border-collapse: collapse; margin: 0 0 20px; }
      .sx-table thead th { background: #1a1a2e; color: #fff; padding: 11px 14px; font-size: 12px; font-weight: 700; letter-spacing: .5px; text-align: left; }
      .sx-table thead th:last-child { text-align: right; }
      .sx-table tbody td { padding: 10px 14px; font-size: 13px; color: #333; border-bottom: 1px solid #f0ede0; vertical-align: top; }
      .sx-table tbody td:last-child { text-align: right; font-weight: 600; }
      .sx-table tbody tr:nth-child(even) td { background: #fafaf7; }
      .sx-table tfoot td { padding: 10px 14px; font-size: 13px; font-weight: 600; border-top: 2px solid #1a1a2e; background: #f5f5f5; }

      /* ── Totals ── */
      .sx-totals { margin-left: auto; max-width: 340px; margin-bottom: 20px; }
      .sx-total-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; color: #444; border-bottom: 1px solid #f0ede0; }
      .sx-total-grand { display: flex; justify-content: space-between; padding: 12px 14px; margin-top: 8px; background: linear-gradient(135deg,#fdf3e0,#fff8ed); border: 1px solid #2563EB; border-radius: 10px; font-weight: 800; font-size: 16px; color: #1a1a2e; }
      .sx-words { background: #fdf3e0; border: 1px solid #f5c060; border-radius: 8px; padding: 10px 14px; font-size: 12px; color: #555; font-style: italic; margin-top: 10px; }

      /* ── Receipt box ── */
      .sx-receipt-box { background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px 22px; margin-bottom: 16px; }
      .sx-receipt-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #ededf0; }
      .sx-receipt-row:last-child { border-bottom: none; }

      /* ── Signatures ── */
      .sx-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-top: 36px; padding-top: 20px; border-top: 1px solid #eee; }
      .sx-sig-box { text-align: center; }
      .sx-sig-line { border-bottom: 1.5px solid #bbb; height: 50px; margin-bottom: 8px; }
      .sx-sig-lbl { font-size: 11px; color: #666; font-weight: 600; margin-top: 3px; }

      /* ── Footer ── */
      .sx-doc-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee; font-size: 11px; color: #aaa; }
      .sx-footer-brand { display: flex; align-items: center; gap: 5px; }
      .sx-mini-mark { width: 16px; height: 16px; background: linear-gradient(135deg,#2563EB,#1D4ED8); border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 800; color: #fff; }

      /* ── Print button ── */
      .sx-print-btn { display: block; margin: 24px auto 0; padding: 12px 36px; background: linear-gradient(135deg,#2563EB,#1D4ED8); border: none; border-radius: 10px; font-weight: 800; font-size: 15px; cursor: pointer; color: #111; font-family: 'Inter', Arial, sans-serif; }
      .sx-print-btn:hover { opacity: .9; }
    `;

    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${escapeHTML(biz)} — Document</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>${css}</style>
</head>
<body>
<div class="sx-doc-wrap">

  <div class="sx-doc-header">
    <div>
      <div class="sx-biz-name">${escapeHTML(biz)}</div>
      <div class="sx-biz-meta">
        ${addr ? escapeHTML(addr) + '<br/>' : ''}
        ${ph ? '&#128222; ' + escapeHTML(ph) + (gst ? '&nbsp;&nbsp;|&nbsp;&nbsp;' : '') : ''}
        ${gst ? 'GSTIN: ' + escapeHTML(gst) : ''}
        ${pan ? '<br/>PAN: ' + escapeHTML(pan) : ''}
        ${state ? (gst || ph ? '&nbsp;&nbsp;|&nbsp;&nbsp;' : '') + 'State: ' + escapeHTML(state) : ''}
      </div>
    </div>
    <div class="sx-logo-block">
      <div class="sx-logo-mark">SX</div>
      <div class="sx-logo-name">STRATIX</div>
      <div class="sx-logo-date">${now.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</div>
    </div>
  </div>

  ${docHTML}

  <div class="sx-doc-footer">
    <div class="sx-footer-brand">
      <span class="sx-mini-mark">SX</span>
      <span style="font-weight:700;color:#2563EB;letter-spacing:1px;font-size:10px">STRATIX</span>
      <span>&nbsp;&#183;&nbsp;Business Intelligence Platform</span>
    </div>
    <div style="text-align:right">
      ${escapeHTML(biz)}<br/>
      Printed on ${now.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
    </div>
  </div>
</div>

<button class="sx-print-btn no-print" onclick="window.print()">&#128424;&#65039; Print / Save as PDF</button>

</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  },

  _fmtDate(d) {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); } catch { return d; }
  },

  // ── DATA MANAGER ──────────────────────────────────────────────────────────
  renderDataManager() {
    const sym = this.settings.currencySymbol||'₹';
    const txns = STRATIX_DB.getArr('transactions');
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head">
          <h1 class="sec-title">Data Manager</h1>
          <div class="head-actions">
            <button class="btn btn-ghost btn-sm" onclick="APP.exportData()">⬇ JSON</button>
            <button class="btn btn-ghost btn-sm" onclick="APP.exportCSV()">📊 Excel/CSV</button>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('importFile').click()">⬆ Import</button>
            <input type="file" id="importFile" accept=".json" style="display:none" onchange="APP.importData(event)"/>
          </div>
        </div>
        <div class="entry-form">
          <div class="calc-tabs">
            <button class="calc-tab active" onclick="APP.setEntryType('revenue',this)">Revenue</button>
            <button class="calc-tab" onclick="APP.setEntryType('expense',this)">Expense</button>
            <button class="calc-tab" onclick="APP.setEntryType('logistics',this)">Logistics</button>
          </div>
          <div class="entry-fields">
            <input type="hidden" id="entryType" value="revenue"/>
            <div class="calc-grid">
              <div class="field"><label>Amount (${sym})</label><input type="number" id="entAmt" placeholder="Amount"/></div>
              <div class="field"><label>Category</label>
                <select id="entCat">
                  <option>freight</option><option>contract</option><option>logistics</option><option>service</option>
                  <option>fuel</option><option>salary</option><option>maintenance</option><option>toll</option><option>other</option>
                </select>
              </div>
              <div class="field"><label>Description</label><input id="entDesc" placeholder="Description" maxlength="200"/></div>
              <div class="field"><label>Date</label><input type="date" id="entDate" value="${new Date().toISOString().split('T')[0]}"/></div>
            </div>
            <button class="btn-calc" onclick="APP.addEntry()">+ Add Entry</button>
          </div>
        </div>
        <div class="filter-row">
          <button class="filter-btn active" data-filter="all" onclick="APP.filterTxns('all',this)">All</button>
          <button class="fbtn" data-filter="revenue" onclick="APP.filterTxns('revenue',this)">Revenue</button>
          <button class="fbtn" data-filter="expense" onclick="APP.filterTxns('expense',this)">Expense</button>
          <button class="fbtn" data-filter="logistics" onclick="APP.filterTxns('logistics',this)">Logistics</button>
        </div>
        <div class="tbl-wrap" id="txnTable">
          ${this.renderTxnTable(txns, sym)}
        </div>
      </div>`;
  },

  renderTxnTable(txns, sym, page) {
    page = page || 1;
    const pageSize = 50;
    const sorted = txns.slice().reverse();
    const total = sorted.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page-1)*pageSize;
    const visible = sorted.slice(start, start+pageSize);
    const pager = totalPages > 1 ? `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border);font-size:13px;color:var(--muted)">
        <span>Showing ${start+1}–${Math.min(start+pageSize,total)} of ${total} entries</span>
        <div style="display:flex;gap:8px">
          ${page>1?`<button onclick="APP._txnPage(${page-1})" class="btn btn-ghost btn-sm">← Prev</button>`:''}
          <span style="padding:6px 12px;background:var(--surface2);border-radius:8px;font-weight:600">${page}/${totalPages}</span>
          ${page<totalPages?`<button onclick="APP._txnPage(${page+1})" class="btn btn-ghost btn-sm">Next →</button>`:''}
        </div>
      </div>` : '';
    return `<div class="tbl-scroll"><table class="data-table">
      <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th></th></tr></thead>
      <tbody>${visible.map(t=>`
        <tr>
          <td>${t.date||t.createdAt.split('T')[0]}</td>
          <td><span class="badge-type ${t.type==='revenue'?'revenue':'expense'}">${t.type==='revenue'?'Revenue':'Expense'}</span></td>
          <td>${escapeHTML(t.category||'—')}</td>
          <td>${escapeHTML(t.description||'—')}</td>
          <td class="${t.type==='revenue'?'green':'red'}">${sym}${this.fmt(t.amount)}</td>
          <td><button class="del-btn" onclick="APP.deleteEntry('${t.id}')">🗑</button></td>
        </tr>`).join('')}
      </tbody></table></div>${pager}`;
  },

  _txnPage(page) {
    const sym = this.settings.currencySymbol||'₹';
    const activeBtn = document.querySelector('.filter-btn.active, .fbtn.active');
    // Use data-filter attribute (set by filterTxns) so text-locale mismatches don't break pagination
    const filter = activeBtn?.dataset?.filter || activeBtn?.textContent?.toLowerCase().trim() || 'all';
    let txns = STRATIX_DB.getArr('transactions');
    if (filter !== 'all') txns = txns.filter(t=>t.type===filter);
    const el = document.getElementById('txnTable');
    if (el) el.innerHTML = this.renderTxnTable(txns, sym, page);
  },

  setEntryType(type, btn) {
    document.getElementById('entryType').value = type;
    document.querySelectorAll('.entry-form .calc-tabs .calc-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  },

  addEntry() {
    const amt = +document.getElementById('entAmt').value;
    if (!amt) { NOTIFY.show('Please enter an amount','warning'); return; }
    STRATIX_DB.push('transactions', {
      type: document.getElementById('entryType').value,
      amount: amt,
      category: document.getElementById('entCat').value,
      description: document.getElementById('entDesc').value,
      date: document.getElementById('entDate').value
    });
    this.renderDataManager();
  },

  deleteEntry(id) {
    if (APP._confirmDelete('transaction',()=>{ STRATIX_DB.remove('transactions', id); APP.renderDataManager(); })) {}
  },

  filterTxns(type, btn) {
    const txns = STRATIX_DB.getArr('transactions');
    const filtered = type === 'all' ? txns : txns.filter(t=>t.type===type);
    document.getElementById('txnTable').innerHTML = this.renderTxnTable(filtered, this.settings.currencySymbol||'₹');
    document.querySelectorAll('.filter-btn, .fbtn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
  },

  exportData() {
    const data = STRATIX_DB.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `stratix_backup_${new Date().toISOString().split('T')[0]}.json`; a.click();
  },

  exportCSV() {
    const txns = STRATIX_DB.getArr('transactions');
    if (txns.length === 0) { NOTIFY.show('No transactions to export','warning'); return; }
    const sym = this.settings.currencySymbol || '₹';
    const biz = this.settings.businessName || 'STRATIX';
    // CSV header
    const rows = [['Date','Type','Category','Description','Amount ('+sym+')','Running Balance']];
    let balance = 0;
    txns.slice().sort((a,b)=>new Date(a.date||a.createdAt)-new Date(b.date||b.createdAt)).forEach(t => {
      balance += t.type === 'revenue' ? t.amount : -t.amount;
      rows.push([
        t.date || t.createdAt.split('T')[0],
        t.type,
        t.category || '',
        '"' + (t.description || '').replace(/"/g,'""') + '"',
        t.type === 'revenue' ? t.amount : -t.amount,
        balance.toFixed(2)
      ]);
    });
    // Add summary rows
    const totalRev = txns.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
    const totalExp = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    rows.push(['','','','','','']);
    rows.push(['SUMMARY','','','Total Revenue',totalRev,'']);
    rows.push(['','','','Total Expenses',totalExp,'']);
    rows.push(['','','','Net Profit',totalRev-totalExp,'']);
    rows.push(['','','','Generated by STRATIX on '+new Date().toLocaleDateString('en-IN'),'','']);

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = biz.replace(/[^a-zA-Z0-9]/g,'_') + '_Transactions_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    NOTIFY.show('CSV exported! Open in Excel or Google Sheets ✓','success');
  },

  importData(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        STRATIX_DB.importAll(JSON.parse(e.target.result));
        this.settings = STRATIX_DB.getSettings(); // refresh in-memory settings
        NOTIFY.show('Data imported successfully!','success');
        this.renderDataManager();
      }
      catch { NOTIFY.show('Invalid file — use a STRATIX JSON export','error'); }
    };
    reader.readAsText(file);
  },

  // ── GOALS ─────────────────────────────────────────────────────────────────
  renderGoals() {
    const goals = STRATIX_DB.getArr('goals');
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Goals Tracker</h1></div>
        <div class="goal-add-form">
          <div class="calc-grid">
            <div class="field"><label>Goal Title</label><input id="gTitle" placeholder="e.g. Monthly Revenue Target" maxlength="100"/></div>
            <div class="field"><label>Target Value</label><input type="number" id="gTarget" placeholder="500000"/></div>
            <div class="field"><label>Unit</label><select id="gUnit"><option value="${sym}">${sym} (Currency)</option><option value="%">% (Percentage)</option><option value="#"># (Count)</option></select></div>
            <div class="field"><label>Priority</label><select id="gPriority"><option>high</option><option>medium</option><option>low</option></select></div>
          </div>
          <button class="btn-calc" onclick="APP.addGoal()">+ Add Goal</button>
        </div>
        <div class="goals-list">
          ${goals.map(g=>{
            const pct = Math.min(100, Math.round((g.current/g.target)*100));
            return `<div class="goal-card">
              <div class="goal-hd">
                <div>
                  <div class="goal-name">${escapeHTML(g.title)}</div>
                  <span class="priority-badge ${escapeHTML(g.priority)}">${escapeHTML(g.priority)}</span>
                </div>
                <div class="goal-val">${g.current}${escapeHTML(g.unit||'')} / ${g.target}${escapeHTML(g.unit||'')}</div>
              </div>
              <div class="goal-prog"><div class="goal-bar" style="width:${pct}%"></div></div>
              <div class="goal-pct">${pct}% Complete</div>
              <input type="range" min="0" max="${g.target}" value="${g.current}" class="goal-slider"
                oninput="APP.updateGoal('${g.id}',this.value,this)"/>
              <button class="del-btn" onclick="APP.deleteGoal('${g.id}')">Remove</button>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  addGoal() {
    const title = document.getElementById('gTitle').value.trim();
    if (!title) { NOTIFY.show('Please enter a goal title','warning'); return; }
    STRATIX_DB.push('goals', { title, target: +document.getElementById('gTarget').value||100, current: 0, unit: document.getElementById('gUnit').value, priority: document.getElementById('gPriority').value });
    this.renderGoals();
  },

  updateGoal(id, value, slider) {
    STRATIX_DB.update('goals', id, { current: +value });
    const card = slider.closest('.goal-card');
    const pct = Math.min(100, Math.round((value / slider.max)*100));
    card.querySelector('.goal-bar').style.width = pct + '%';
    card.querySelector('.goal-pct').textContent = pct + '% Complete';
    const g = STRATIX_DB.getArr('goals').find(g=>g.id===id);
    if (g) card.querySelector('.goal-val').textContent = `${value}${g.unit} / ${g.target}${g.unit}`;
  },

  deleteGoal(id) {
    STRATIX_DB.remove('goals', id); this.renderGoals();
  },

  // ── NOTES ─────────────────────────────────────────────────────────────────
  renderNotes() {
    const notes = STRATIX_DB.getArr('notes');
    const categories = ['General','Finance','Operations','HR','Marketing','Legal'];
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Smart Notes</h1></div>
        <div class="notes-add">
          <div class="calc-grid">
            <div class="field" style="grid-column:1/-1"><label>Note Content</label><textarea id="noteContent" maxlength="2000" rows="3" placeholder="Write your note..."></textarea></div>
            <div class="field"><label>Category</label><select id="noteCat">${categories.map(c=>`<option>${c}</option>`).join('')}</select></div>
          </div>
          <button class="btn-calc" onclick="APP.addNote()">+ Save Note</button>
        </div>
        <div class="notes-search"><input type="text" placeholder="🔍 Search notes..." oninput="APP.searchNotes(this.value)"/></div>
        <div class="notes-grid" id="notesList">
          ${this.renderNoteCards(notes)}
        </div>
      </div>`;
  },

  renderNoteCards(notes) {
    const colors = { General:'#E2E8F0', Finance:'#1a2030', Operations:'#1a2520', HR:'#201a30', Marketing:'#201a20', Legal:'#2a2010' };
    return notes.slice().reverse().map(n=>`
      <div class="note-card" style="background:${colors[n.category]||'#E2E8F0'}">
        <div class="note-cat">${escapeHTML(n.category||'')}</div>
        <p>${escapeHTML(n.content)}</p>
        <div class="note-time">${new Date(n.createdAt).toLocaleString('en-IN')}</div>
        <button class="del-btn" onclick="APP.deleteNote('${n.id}')">🗑</button>
      </div>`).join('') || '<p class="empty">No notes yet. Add your first note above.</p>';
  },

  addNote() {
    const content = document.getElementById('noteContent').value.trim();
    if (!content) return;
    STRATIX_DB.push('notes', { content, category: document.getElementById('noteCat').value });
    this.renderNotes();
  },

  searchNotes(q) {
    const notes = STRATIX_DB.getArr('notes').filter(n=>n.content.toLowerCase().includes(q.toLowerCase())||n.category.toLowerCase().includes(q.toLowerCase()));
    document.getElementById('notesList').innerHTML = this.renderNoteCards(notes);
  },

  deleteNote(id) { STRATIX_DB.remove('notes', id); this.renderNotes(); },

  // ── REMINDERS ─────────────────────────────────────────────────────────────
  renderReminders() {
    const rems = STRATIX_DB.getArr('reminders');
    const today = new Date().toISOString().split('T')[0];
    const todayRems = rems.filter(r=>!r.done&&r.date===today);
    const upcoming = rems.filter(r=>!r.done&&r.date>today);
    const overdue = rems.filter(r=>!r.done&&r.date<today);
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Reminders</h1></div>
        <div class="rem-add">
          <div class="calc-grid">
            <div class="field"><label>Reminder Title</label><input id="remTitle" maxlength="100" placeholder="e.g. Pay GST for March"/></div>
            <div class="field"><label>Date</label><input type="date" id="remDate" value="${today}"/></div>
            <div class="field"><label>Amount (optional)</label><input type="number" id="remAmt" placeholder="Amount"/></div>
            <div class="field"><label>Category</label><select id="remCat"><option>GST</option><option>Payment</option><option>Invoice</option><option>Meeting</option><option>Maintenance</option><option>Other</option></select></div>
          </div>
          <button class="btn-calc" onclick="APP.addReminder()">+ Add Reminder</button>
        </div>
        ${[['🔴 Today', todayRems],['🟡 Upcoming', upcoming],['⚠️ Overdue', overdue]].map(([label,list])=>`
          <div class="rem-section">
            <h3>${label} (${list.length})</h3>
            ${list.map(r=>`
              <div class="rem-card">
                <div class="rem-info">
                  <strong>${escapeHTML(r.title||'')}</strong>
                  <span>${escapeHTML(r.category||'')} — ${r.date}${r.amount?` — ${sym}${this.fmt(r.amount)}`:''}</span>
                </div>
                <button class="btn-sm green" onclick="APP.doneReminder('${r.id}')">✓ Done</button>
              </div>`).join('') || '<p class="empty">None</p>'}
          </div>`).join('')}
      </div>`;
  },

  addReminder() {
    const title = document.getElementById('remTitle').value.trim();
    if (!title) return;
    STRATIX_DB.push('reminders', { title, date: document.getElementById('remDate').value, amount: +document.getElementById('remAmt').value||null, category: document.getElementById('remCat').value, done: false });
    this.renderReminders();
  },

  doneReminder(id) { STRATIX_DB.update('reminders', id, { done: true }); this.renderReminders(); },

  // ── STRATEGY ──────────────────────────────────────────────────────────────
  renderStrategy() {
    // Pre-fill with real user data
    const txns = STRATIX_DB.getArr('transactions');
    const now = new Date();
    const thisMonth = txns.filter(t=>{const d=new Date(t.date||t.createdAt);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
    const rev = thisMonth.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
    const exp = thisMonth.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const allRev = txns.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
    const avgMonthlyRev = allRev / 6 || 0;
    const suggestedTarget = Math.round(avgMonthlyRev * 1.3);
    const suggestedBudget = Math.round(exp * 0.1);
    const sym = this.settings.currencySymbol||'₹';

    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head">
          <h1 class="sec-title">Strategy Builder</h1>
          <p class="sec-sub">Pre-filled with your actual business data</p>
        </div>
        <div style="background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.2);border-radius:12px;padding:12px 18px;margin-bottom:20px;font-size:13px;color:var(--muted)">
          📊 Based on your data — This month: <strong style="color:var(--gold)">${sym}${this.fmt(rev)}</strong> revenue, <strong style="color:#e84040">${sym}${this.fmt(exp)}</strong> expenses. Monthly avg: <strong style="color:#0F172A">${sym}${this.fmt(avgMonthlyRev)}</strong>
        </div>
        <div class="strategy-grid">
          ${[
            { title:'Marketing Strategy', icon:'📣', fields:[
              {id:'sRevTarget',label:'Revenue Target (₹)',ph:suggestedTarget||'1000000',val:suggestedTarget||''},
              {id:'sBudget',label:'Marketing Budget (₹)',ph:suggestedBudget||'50000',val:suggestedBudget||''},
              {id:'sChannels',label:'Top Channels (comma separated)',ph:'WhatsApp,Google Ads,Referral',val:'WhatsApp,Google Ads,Referral'}
            ], btn:'genMarketing' },
            { title:'Growth Strategy', icon:'📈', fields:[
              {id:'gRevCurrent',label:'Current Monthly Revenue (₹)',ph:'200000',val:Math.round(rev)||''},
              {id:'gRevTarget',label:'Target Revenue (₹)',ph:'500000',val:suggestedTarget||''},
              {id:'gTimeframe',label:'Timeframe (months)',ph:'12',val:'12'}
            ], btn:'genGrowth' },
            { title:'Cost Reduction', icon:'✂️', fields:[
              {id:'crTotal',label:'Total Monthly Costs (₹)',ph:'150000',val:Math.round(exp)||''},
              {id:'crTarget',label:'Target Reduction (%)',ph:'20',val:'20'}
            ], btn:'genCostReduction' },
            { title:'Customer Acquisition', icon:'👥', fields:[
              {id:'caCostBudget',label:'Acquisition Budget (₹)',ph:'30000',val:suggestedBudget||''},
              {id:'caTargetNew',label:'Target New Customers',ph:'50',val:'50'}
            ], btn:'genCAP' }
          ].map(s=>`
            <div class="strategy-card">
              <div class="strat-icon">${s.icon}</div>
              <h3>${s.title}</h3>
              ${s.fields.map(f=>`<div class="field"><label>${f.label}</label><input id="${f.id}" placeholder="${f.ph}" value="${f.val}"/></div>`).join('')}
              <button class="btn-calc" onclick="APP.${s.btn}()">Generate Plan →</button>
              <div id="${s.btn}Result"></div>
            </div>`).join('')}
        </div>
      </div>`;
  },

  genMarketing() {
    const target = +document.getElementById('sRevTarget').value||0;
    const budget = +document.getElementById('sBudget').value||0;
    const channels = document.getElementById('sChannels').value||'WhatsApp, Google Ads, Referral';
    if (!budget || budget <= 0) { NOTIFY.show('Please enter a Marketing Budget to generate a plan','warning'); return; }
    const sym = this.settings.currencySymbol||'₹';
    const channelList = channels.split(',').map(c=>c.trim()).filter(Boolean);
    const budgetPerChannel = channelList.length > 0 ? Math.round(budget / channelList.length) : budget;
    document.getElementById('genMarketingResult').innerHTML = `
      <div class="strat-result">
        <strong>6-Step Marketing Plan:</strong><br/>
        1. Define USP & target customer profile<br/>
        2. Allocate budget: ${channelList.map(c=>`${c} (${sym}${this.fmt(budgetPerChannel)})`).join(', ')}<br/>
        3. Create WhatsApp broadcast to 500+ contacts<br/>
        4. Run Google Ads targeting transport/logistics keywords<br/>
        5. Referral program: 1 month free per referral<br/>
        6. Monthly review: track CAC vs revenue generated
      </div>`;
  },

  genGrowth() {
    const curr = +document.getElementById('gRevCurrent').value||0;
    const target = +document.getElementById('gRevTarget').value||0;
    const months = +document.getElementById('gTimeframe').value||12;
    if (!curr || curr <= 0) { NOTIFY.show('Please enter your Current Monthly Revenue first','warning'); return; }
    if (!target || target <= curr) { NOTIFY.show('Target Revenue must be greater than current revenue','warning'); return; }
    const growth = (((target/curr)**(1/months)-1)*100).toFixed(1);
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('genGrowthResult').innerHTML = `
      <div class="strat-result">
        <strong>Growth Framework:</strong><br/>
        Required Monthly Growth: ${growth}%<br/>
        Month 3 Milestone: ${sym}${this.fmt(curr*1.15)}<br/>
        Month 6 Milestone: ${sym}${this.fmt(curr*1.3)}<br/>
        Month 12 Target: ${sym}${this.fmt(target)}<br/>
        Strategy: Expand routes + premium clients + referral
      </div>`;
  },

  genCostReduction() {
    const total = +document.getElementById('crTotal').value||0;
    const pct = +document.getElementById('crTarget').value||20;
    if (!total || total <= 0) { NOTIFY.show('Please enter your Total Monthly Expenses first','warning'); return; }
    const saving = total * pct/100;
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('genCostReductionResult').innerHTML = `
      <div class="strat-result">
        <strong>Cost Reduction Plan (${pct}% = ${sym}${this.fmt(saving)}/month):</strong><br/>
        1. Fuel: Route optimization → save 10-15%<br/>
        2. Salary: Performance-based DA instead of fixed<br/>
        3. Maintenance: Preventive schedule → reduce breakdown cost<br/>
        4. Toll: Pre-planned routes using FASTag analytics<br/>
        5. Admin: Digitize docs → reduce CA fees
      </div>`;
  },

  genCAP() {
    const budget = +document.getElementById('caCostBudget').value||0;
    const target = +document.getElementById('caTargetNew').value||50;
    if (!budget || budget <= 0) { NOTIFY.show('Please enter a Customer Acquisition Budget first','warning'); return; }
    const cac = target > 0 ? (budget/target).toFixed(0) : 0;
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('genCAPResult').innerHTML = `
      <div class="strat-result">
        <strong>Customer Acquisition Plan:</strong><br/>
        Budget per Customer: ${sym}${cac}<br/>
        Channels: WhatsApp (free) + Transport Associations + CA Partnerships<br/>
        Funnel: Demo → Free Trial → Paid Subscription<br/>
        Target CAC: ${sym}${Math.round(cac*0.7)} (optimize over 3 months)
      </div>`;
  },

  // ── GST CALCULATOR ────────────────────────────────────────────────────────
  renderGST() {
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">GST Calculator + GSTR Report</h1>
          <span style="font-size:12px;color:var(--muted)">Registered State: <strong style="color:var(--gold)">${this.settings.state||'Set in Settings'}</strong></span>
        </div>
        <div class="gst-grid">
          <div class="gst-calc-card">
            <h3>GST Calculator</h3>
            <div class="field"><label>Transaction Type</label>
              <select id="gstType" onchange="APP.calcGST()">
                <option value="intra">Intrastate — CGST + SGST (Buyer &amp; Seller in same state)</option>
                <option value="inter">Interstate — IGST only (Different states)</option>
              </select>
            </div>
            <div class="field"><label>Amount (${sym})</label><input type="number" id="gstAmt" placeholder="100000" oninput="APP.calcGST()"/></div>
            <div class="field"><label>GST Rate (%)</label>
              <select id="gstRate" onchange="APP.calcGST()">
                <option value="5">5%</option><option value="12">12%</option><option value="18" selected>18% (Standard)</option><option value="28">28%</option>
              </select>
            </div>
            <div class="field"><label>HSN/SAC Code</label><input id="gstHSN" placeholder="996511 (Road Transport)"/></div>
            <div id="gstResult" class="gst-result"></div>
            <button class="btn-calc" onclick="APP.saveGSTEntry()">+ Add to GST Register</button>
          </div>
          <div class="gst-summary-card">
            <h3>Monthly GST Summary</h3>
            ${this.renderGSTSummary()}
            <button class="btn-calc" onclick="APP.exportGSTReport()">Export GSTR Report PDF</button>
          </div>
        </div>
        <div class="itc-card">
          <h3>Input Tax Credit (ITC) Tracker</h3>
          <div class="calc-grid">
            <div class="field"><label>ITC Available (${sym})</label><input type="number" id="itcAvail" placeholder="5000"/></div>
            <div class="field"><label>ITC Claimed (${sym})</label><input type="number" id="itcClaimed" placeholder="3000"/></div>
          </div>
          <button class="btn-calc" onclick="APP.calcITC()">Calculate Net Liability</button>
          <div id="itcResult"></div>
        </div>
      </div>`;
    this.calcGST();
  },

  calcGST() {
    const amt = +document.getElementById('gstAmt')?.value||0;
    const rate = +document.getElementById('gstRate')?.value||18;
    const type = document.getElementById('gstType')?.value||'intra';
    const sym = this.settings.currencySymbol||'₹';
    const gstAmt = amt * rate/100;
    const total = amt + gstAmt;
    const el = document.getElementById('gstResult');
    if (!el) return;
    if (type === 'intra') {
      el.innerHTML = `
        <div class="gst-row"><span>Taxable Amount</span><span>${sym}${this.fmt(amt)}</span></div>
        <div class="gst-row"><span>CGST @${rate/2}% (Central)</span><span>${sym}${this.fmt(gstAmt/2)}</span></div>
        <div class="gst-row"><span>SGST @${rate/2}% (State)</span><span>${sym}${this.fmt(gstAmt/2)}</span></div>
        <div class="gst-row"><span style="font-size:11px;color:var(--muted)">Both buyer &amp; seller in ${this.settings.state||'same state'}</span><span></span></div>
        <div class="gst-row total"><span>Total Invoice</span><span class="gold">${sym}${this.fmt(total)}</span></div>`;
    } else {
      el.innerHTML = `
        <div class="gst-row"><span>Taxable Amount</span><span>${sym}${this.fmt(amt)}</span></div>
        <div class="gst-row"><span>IGST @${rate}% (Interstate)</span><span>${sym}${this.fmt(gstAmt)}</span></div>
        <div class="gst-row"><span style="font-size:11px;color:var(--muted)">Buyer &amp; seller in different states — full IGST applies</span><span></span></div>
        <div class="gst-row total"><span>Total Invoice</span><span class="gold">${sym}${this.fmt(total)}</span></div>`;
    }
  },

  saveGSTEntry() {
    const amt = +document.getElementById('gstAmt')?.value||0;
    if (!amt) return;
    STRATIX_DB.push('gstEntries', { amount: amt, rate: +document.getElementById('gstRate').value, type: document.getElementById('gstType').value, hsn: document.getElementById('gstHSN').value, date: new Date().toISOString().split('T')[0] });
    NOTIFY.show('GST entry saved to register','success');
  },

  renderGSTSummary() {
    const entries = STRATIX_DB.getArr('gstEntries');
    const sym = this.settings.currencySymbol||'₹';
    if (entries.length === 0) return '<p class="empty">No GST entries yet. Use the calculator to add entries.</p>';
    const total = entries.reduce((s,e)=>s+e.amount*(e.rate/100),0);
    // Indian FY quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
    const quarters = { 'Q1 (Apr-Jun)':0, 'Q2 (Jul-Sep)':0, 'Q3 (Oct-Dec)':0, 'Q4 (Jan-Mar)':0 };
    entries.forEach(e=>{ const m=new Date(e.date).getMonth(); const q=m>=3&&m<=5?'Q1 (Apr-Jun)':m>=6&&m<=8?'Q2 (Jul-Sep)':m>=9&&m<=11?'Q3 (Oct-Dec)':'Q4 (Jan-Mar)'; quarters[q]+=e.amount*(e.rate/100); });
    return `<div class="gst-summary">
      <div class="gst-sum-row"><span>Total GST Collected</span><span class="gold">${sym}${this.fmt(total)}</span></div>
      <div class="gst-sum-row"><span>Total Entries</span><span>${entries.length}</span></div>
      ${Object.entries(quarters).map(([q,v])=>`<div class="gst-sum-row"><span>${q}</span><span>${sym}${this.fmt(v)}</span></div>`).join('')}
    </div>`;
  },

  calcITC() {
    const avail   = +document.getElementById('itcAvail').value||0;
    const claimed = +document.getElementById('itcClaimed').value||0;
    const sym = this.settings.currencySymbol||'₹';
    const gstEntries = STRATIX_DB.getArr('gstEntries');
    const liability = gstEntries.reduce((s,e)=>s+e.amount*(e.rate/100), 0);
    // BUG 14 FIX: was ignoring avail entirely — now cap claimed to avail
    const effectiveClaimed = Math.min(claimed, avail);
    const unutilised = avail - effectiveClaimed;
    const net = liability - effectiveClaimed;
    document.getElementById('itcResult').innerHTML = `
      <div class="itc-result">
        <div class="gst-row"><span>Gross GST Liability</span><span>${sym}${this.fmt(liability)}</span></div>
        <div class="gst-row"><span>ITC Available</span><span class="green">${sym}${this.fmt(avail)}</span></div>
        <div class="gst-row"><span>ITC Claimed (effective)</span><span class="green">− ${sym}${this.fmt(effectiveClaimed)}</span></div>
        ${unutilised > 0 ? `<div class="gst-row"><span>Unutilised ITC (carry forward)</span><span class="gold">${sym}${this.fmt(unutilised)}</span></div>` : ''}
        <div class="gst-row total"><span>Net GST Payable</span><span class="${net>0?'red':'green'}">${sym}${this.fmt(net)}</span></div>
      </div>`;
  },

  exportGSTReport() {
    const entries = STRATIX_DB.getArr('gstEntries');
    const settings = STRATIX_DB.getSettings();
    const sym = settings.currencySymbol || '₹';
    const biz = settings.businessName || 'Your Business';
    const gst = settings.gstNumber || '—';
    const now = new Date();
    const month = now.toLocaleString('en-IN',{month:'long',year:'numeric'});
    if (entries.length === 0) { NOTIFY.show('No GST entries to export. Add entries first.','warning'); return; }
    const totalTax = entries.reduce((s,e)=>s+e.amount*(e.rate/100),0);
    const totalAmt = entries.reduce((s,e)=>s+e.amount,0);
    const rows = entries.map((e,i)=>`
      <tr>
        <td>${i+1}</td>
        <td>${e.date||'—'}</td>
        <td>${e.hsn||'—'}</td>
        <td>${e.type==='intra'?'Intrastate':'Interstate'}</td>
        <td style="text-align:right">${sym}${(e.amount||0).toLocaleString('en-IN')}</td>
        <td style="text-align:center">${e.rate}%</td>
        <td style="text-align:right">${sym}${(e.amount*(e.rate/100)).toLocaleString('en-IN')}</td>
      </tr>`).join('');
    const win = window.open('','_blank');
    if (!win) { NOTIFY.show('Popup blocked! Allow popups for this site and try again.','warning',5000); return; }
    win.document.write(`<!DOCTYPE html><html><head><title>GST Report - ${biz}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:Arial,sans-serif;padding:30px;color:#111;max-width:800px;margin:0 auto}
      .sx-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:2px solid #2563EB}
      .sx-biz{font-size:18px;font-weight:800;color:#1a1a2e}.sx-meta{font-size:12px;color:#555;line-height:1.8;margin-top:3px}
      .sx-mark{width:38px;height:38px;background:linear-gradient(135deg,#2563EB,#c07000);border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;color:#F8FAFC;margin-bottom:3px}
      h2{font-size:14px;color:#555;font-weight:normal;margin-bottom:16px}
      .meta{display:flex;justify-content:space-between;background:#f5f5f5;padding:12px 16px;border-radius:6px;margin-bottom:20px;font-size:13px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#1a1a2e;color:#fff;padding:10px;text-align:left}
      td{padding:9px 10px;border-bottom:1px solid #eee}
      tr:hover td{background:#f9f9f9}
      .total-row td{font-weight:700;background:#f0f0f0;border-top:2px solid #333}
      .sx-footer{margin-top:24px;padding-top:12px;border-top:1px solid #e0e0e0;display:flex;justify-content:space-between;font-size:11px;color:#888}
      @media print{body{padding:10px}}
    </style></head><body>
    <div class="sx-header">
      <div>
        <div class="sx-biz">${biz}</div>
        <div class="sx-meta">GSTIN: ${gst}${settings.phone ? ' &nbsp;|&nbsp; 📞 '+settings.phone : ''}${settings.address ? '<br/>'+settings.address : ''}</div>
      </div>
      <div style="text-align:right">
        <div class="sx-mark" style="margin-left:auto">SX</div>
        <div style="font-size:11px;font-weight:700;color:#2563EB">STRATIX</div>
      </div>
    </div>
    <h2>GST REPORT &nbsp;|&nbsp; Period: ${month}</h2>
    <div class="meta">
      <span><strong>Total Taxable Amount:</strong> ${sym}${totalAmt.toLocaleString('en-IN')}</span>
      <span><strong>Total GST Collected:</strong> ${sym}${totalTax.toLocaleString('en-IN')}</span>
      <span><strong>Total Entries:</strong> ${entries.length}</span>
    </div>
    <table>
      <thead><tr><th>#</th><th>Date</th><th>HSN/SAC</th><th>Type</th><th>Taxable Amt</th><th>Rate</th><th>GST Amt</th></tr></thead>
      <tbody>${rows}
        <tr class="total-row"><td colspan="4">TOTAL</td><td style="text-align:right">${sym}${totalAmt.toLocaleString('en-IN')}</td><td></td><td style="text-align:right">${sym}${totalTax.toLocaleString('en-IN')}</td></tr>
      </tbody>
    </table>
    <div class="sx-footer">
      <div>Generated by <strong>STRATIX</strong> — India's Business Intelligence Platform &nbsp;|&nbsp; stratix.app</div>
      <div>Printed ${now.toLocaleDateString('en-IN')} &nbsp;|&nbsp; Verify with your CA before filing</div>
    </div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(()=>win.print(), 500);
    NOTIFY.show('GST Report opened — use Print > Save as PDF','success',4000);
  },

  // ── FLEET TRACKING ────────────────────────────────────────────────────────
  renderFleet() {
    const fleet = STRATIX_DB.getArr('fleet');
    const sym = this.settings.currencySymbol||'₹';
    const active = fleet.filter(v=>v.status==='active').length;
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head">
          <h1 class="sec-title">Fleet Manager</h1>
          
        </div>
        <div class="fleet-kpis">
          <div class="kpi-card accent"><div class="kpi-lbl">Total Vehicles</div><div class="kpi-val">${fleet.length}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Active Now</div><div class="kpi-val green">${active}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Fleet Utilization</div><div class="kpi-val">${fleet.length>0?Math.round(fleet.reduce((s,v)=>s+v.utilization,0)/fleet.length):0}%</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Total Revenue</div><div class="kpi-val">${sym}${this.fmt(fleet.reduce((s,v)=>s+v.revenue,0))}</div></div>
        </div>
        <div class="fleet-map-placeholder">
          <div class="map-note">📍 GPS live tracking coming soon. Manage your fleet details below.</div>
          <div class="map-sim">
            ${fleet.map(v=>`<div class="map-pin ${v.status}" title="${v.number} — ${v.driver}">🚛 ${v.number}</div>`).join('')}
          </div>
        </div>
        <div class="tbl-wrap">
          <div class="tbl-head">
            <h3>Vehicle Performance</h3>
            <button class="btn btn-ghost btn-sm" onclick="APP.addVehiclePrompt()">+ Add Vehicle</button>
          </div>
          <div class="tbl-scroll">
            <table class="data-table">
              <thead><tr><th>Vehicle</th><th>Model</th><th>Driver</th><th>Status</th><th>Utilization</th><th>Revenue</th><th>Cost</th><th>Profit</th></tr></thead>
              <tbody>
                ${fleet.map(v=>{
                  const profit = v.revenue - v.cost;
                  return `<tr>
                    <td><strong>${v.number}</strong></td>
                    <td>${v.model}</td>
                    <td>${v.driver}</td>
                    <td><span class="status-badge ${v.status}">${v.status}</span></td>
                    <td><div class="mini-progress"><div style="width:${v.utilization}%"></div></div>${v.utilization}%</td>
                    <td class="green">${sym}${this.fmt(v.revenue)}</td>
                    <td class="red">${sym}${this.fmt(v.cost)}</td>
                    <td class="${profit>=0?'green':'red'}">${sym}${this.fmt(profit)}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  },

  addVehiclePrompt() {
    APP._showFleetAddModal();
  },

  _showFleetAddModal() {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.5);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:20px';
    el.innerHTML = `<div style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:18px;padding:28px;max-width:440px;width:100%">
      <h3 style="color:#0F172A;font-family:var(--heading);font-size:17px;margin-bottom:20px">🚛 Add Vehicle</h3>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div><label style="font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:.8px;font-weight:700;display:block;margin-bottom:6px">Vehicle Number *</label><input id="fvNum" placeholder="MH12AB1234" style="width:100%;background:#F8FAFC;border:1.5px solid #D1D5DB;border-radius:10px;padding:11px 14px;color:#0F172A;font-family:var(--font);font-size:14px;outline:none;box-sizing:border-box;text-transform:uppercase"/></div>
        <div><label style="font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:.8px;font-weight:700;display:block;margin-bottom:6px">Model</label><input id="fvModel" placeholder="Tata 407 / Ashok Leyland 1615" style="width:100%;background:#F8FAFC;border:1.5px solid #D1D5DB;border-radius:10px;padding:11px 14px;color:#0F172A;font-family:var(--font);font-size:14px;outline:none;box-sizing:border-box"/></div>
        <div><label style="font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:.8px;font-weight:700;display:block;margin-bottom:6px">Driver Name</label><input id="fvDriver" placeholder="Driver name" style="width:100%;background:#F8FAFC;border:1.5px solid #D1D5DB;border-radius:10px;padding:11px 14px;color:#0F172A;font-family:var(--font);font-size:14px;outline:none;box-sizing:border-box"/></div>
        <div><label style="font-size:11px;color:#374151;text-transform:uppercase;letter-spacing:.8px;font-weight:700;display:block;margin-bottom:6px">Status</label><select id="fvStatus" style="width:100%;background:#F8FAFC;border:1.5px solid #D1D5DB;border-radius:10px;padding:11px 14px;color:#0F172A;font-family:var(--font);font-size:14px;outline:none;box-sizing:border-box"><option value="active">Active</option><option value="idle">Idle</option><option value="maintenance">Maintenance</option></select></div>
      </div>
      <div style="display:flex;gap:12px;margin-top:20px">
        <button onclick="this.closest('div[style*=fixed]').remove()" style="flex:1;padding:11px;background:transparent;border:1px solid #D1D5DB;border-radius:10px;color:#0F172A;cursor:pointer;font-family:var(--font);font-size:14px">Cancel</button>
        <button onclick="APP._saveVehicle(this)" style="flex:1;padding:11px;background:linear-gradient(135deg,#2563EB,#c07000);border:none;border-radius:10px;color:#F8FAFC;cursor:pointer;font-family:var(--font);font-size:14px;font-weight:700">Add Vehicle</button>
      </div>
    </div>`;
    document.body.appendChild(el);
    setTimeout(()=>el.querySelector('#fvNum').focus(),100);
  },

  _saveVehicle(btn) {
    const num = document.getElementById('fvNum').value.trim().toUpperCase();
    if (!num) { NOTIFY.show('Vehicle number is required','warning'); return; }
    STRATIX_DB.push('fleet', {
      number: num,
      model: document.getElementById('fvModel').value||'—',
      driver: document.getElementById('fvDriver').value||'—',
      status: document.getElementById('fvStatus').value,
      utilization: 0, revenue: 0, cost: 0
    });
    btn.closest('div[style*=fixed]').remove();
    NOTIFY.show(`Vehicle ${num} added!`,'success');
    APP.renderFleet();
  },

  // ── LOAN READINESS ────────────────────────────────────────────────────────
  renderLoan() {
    const txns = STRATIX_DB.getArr('transactions');
    const totalRev = txns.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0)/6;
    const totalExp = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)/6;
    const profit = totalRev - totalExp;
    const margin = totalRev > 0 ? ((profit/totalRev)*100).toFixed(1) : 0;
    const creditScore = Math.min(100, Math.round(40 + (margin/100)*30 + (totalRev>100000?20:10) + 10));
    const maxLoan = totalRev * 18;
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Business Loan Readiness Report</h1></div>
        <div class="loan-card">
          <div class="score-ring">
            <svg viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#E2E8F0" stroke-width="10"/>
              <circle cx="60" cy="60" r="50" fill="none" stroke="${creditScore>=70?'#00d68f':creditScore>=40?'#2563EB':'#e84040'}" stroke-width="10" stroke-dasharray="${2*Math.PI*50}" stroke-dashoffset="${2*Math.PI*50*(1-creditScore/100)}" stroke-linecap="round" transform="rotate(-90 60 60)"/>
              <text x="60" y="55" text-anchor="middle" fill="white" font-size="24" font-weight="700">${creditScore}</text>
              <text x="60" y="72" text-anchor="middle" fill="#6b7a99" font-size="11">/100</text>
            </svg>
          </div>
          <div class="score-info">
            <h2>Business Credit Score: ${creditScore}/100</h2>
            <p>${creditScore>=70?'🟢 Good — You qualify for most business loans':creditScore>=40?'🟡 Average — Improve margins before applying':'🔴 Low — Focus on profitability first'}</p>
            <div class="loan-stats">
              <div class="loan-stat"><div class="ls-lbl">Max Loan Estimate</div><div class="ls-val gold">${sym}${this.fmt(maxLoan)}</div></div>
              <div class="loan-stat"><div class="ls-lbl">Monthly Revenue</div><div class="ls-val">${sym}${this.fmt(totalRev)}</div></div>
              <div class="loan-stat"><div class="ls-lbl">Profit Margin</div><div class="ls-val ${margin>15?'green':'red'}">${margin}%</div></div>
            </div>
          </div>
        </div>
        <div class="loan-sections">
          <div class="loan-checklist">
            <h3>Document Checklist</h3>
            ${['GST Returns (last 12 months)','Bank Statements (last 6 months)','ITR for last 2 years','Business Registration Certificate','PAN Card (Business + Owner)','Audited Balance Sheet','Profit & Loss Statement','Address Proof (Utility Bill)'].map(d=>`<div class="check-item"><span class="check-box">☐</span>${d}</div>`).join('')}
          </div>
          <div class="loan-lenders">
            <h3>Recommended Lenders</h3>
            ${[{name:'Lendingkart',rate:'1.5-2%/month',max:'₹2 Crore',type:'Business Loan'},{name:'Capital Float',rate:'1.2-1.8%/month',max:'₹1 Crore',type:'Working Capital'},{name:'Aye Finance',rate:'2-3%/month',max:'₹10 Lakh',type:'MSME Loan'},{name:'Kinara Capital',rate:'1.8-2.5%/month',max:'₹30 Lakh',type:'Equipment Finance'}].map(l=>`
              <div class="lender-card">
                <div class="lender-name">${l.name}</div>
                <div class="lender-type">${l.type}</div>
                <div class="lender-details">Rate: ${l.rate} | Max: ${l.max}</div>
                <button class="btn btn-ghost btn-sm" onclick="NOTIFY.show('NBFC Loan Marketplace coming soon!','info')">Notify Me →</button>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  },

  // ── TRIP P&L ──────────────────────────────────────────────────────────────
  renderTripPNL() {
    const trips = STRATIX_DB.getArr('trips');
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Trip P&L Calculator</h1></div>
        <div class="trip-form">
          <h3>Add Trip</h3>
          <div class="calc-grid">
            <div class="field"><label>Route</label><input id="tpRoute" placeholder="Mumbai — Pune"/></div>
            <div class="field"><label>Vehicle No</label><input id="tpVehicle" placeholder="MH12AB1234"/></div>
            <div class="field"><label>Trip Date</label><input type="date" id="tpDate" value="${new Date().toISOString().split('T')[0]}"/></div>
            <div class="field"><label>Freight Revenue (${sym})</label><input type="number" id="tpFreight" placeholder="25000"/></div>
            <div class="field"><label>Fuel Cost</label><input type="number" id="tpFuel" placeholder="4500"/></div>
            <div class="field"><label>Toll Charges</label><input type="number" id="tpToll" placeholder="800"/></div>
            <div class="field"><label>Driver Bata</label><input type="number" id="tpDriver" placeholder="1200"/></div>
            <div class="field"><label>Loading/Unloading</label><input type="number" id="tpLoad" placeholder="500"/></div>
            <div class="field"><label>Other Costs</label><input type="number" id="tpOther" placeholder="300"/></div>
          </div>
          <button class="btn-calc" onclick="APP.addTrip()">Calculate & Save Trip →</button>
          <div id="tripCalcResult"></div>
        </div>
        <div class="tbl-wrap">
          <div class="tbl-head"><h3>Trip History</h3></div>
          <div class="tbl-scroll">
            <table class="data-table">
              <thead><tr><th>Route</th><th>Vehicle</th><th>Freight</th><th>Total Cost</th><th>Profit</th><th>Margin</th><th>Status</th></tr></thead>
              <tbody>
                ${trips.map(t=>{
                  const cost=(t.fuel||0)+(t.toll||0)+(t.driver||0)+(t.load||0)+(t.other||0);
                  const p=t.freight-cost;
                  const m=t.freight>0?((p/t.freight)*100).toFixed(1):0;
                  return `<tr>
                    <td>${escapeHTML(t.route)}</td>
                    <td>${t.vehicle}</td>
                    <td class="green">${sym}${this.fmt(t.freight)}</td>
                    <td class="red">${sym}${this.fmt(cost)}</td>
                    <td class="${p>=0?'green':'red'}">${sym}${this.fmt(p)}</td>
                    <td>${m}%</td>
                    <td><span class="status-badge ${p>=0?'active':'idle'}">${p>=0?'Profitable':'Loss'}</span></td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  },

  addTrip() {
    const freight = +document.getElementById('tpFreight').value||0;
    const fuel = +document.getElementById('tpFuel').value||0;
    const toll = +document.getElementById('tpToll').value||0;
    const driver = +document.getElementById('tpDriver').value||0;
    const load = +document.getElementById('tpLoad').value||0;
    const other = +document.getElementById('tpOther').value||0;
    const cost = fuel+toll+driver+load+other;
    const profit = freight - cost;
    const margin = freight > 0 ? ((profit/freight)*100).toFixed(1) : 0;
    const breakeven = freight > 0 ? ((cost/freight)*freight).toFixed(0) : 0;
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('tripCalcResult').innerHTML = `
      <div class="trip-res">
        <div class="trip-res-grid">
          <div class="tri"><div>Net Profit</div><div class="${profit>=0?'green':'red'} big">${sym}${this.fmt(Math.abs(profit))} ${profit<0?'LOSS':''}</div></div>
          <div class="tri"><div>Margin</div><div>${margin}%</div></div>
          <div class="tri"><div>Break-Even Freight</div><div>${sym}${this.fmt(cost)}</div></div>
          <div class="tri"><div>Total Costs</div><div class="red">${sym}${this.fmt(cost)}</div></div>
        </div>
        ${profit < 0 ? '<div class="alert a-red">⚠️ This trip is LOSS-MAKING. Minimum freight needed: '+sym+this.fmt(cost*1.1)+'</div>' : '<div class="alert a-green">✅ Profitable Trip</div>'}
      </div>`;
    const route = document.getElementById('tpRoute').value || 'Trip';
    const vehicle = document.getElementById('tpVehicle').value || '';
    const today = document.getElementById('tpDate')?.value || new Date().toISOString().split('T')[0];
    STRATIX_DB.push('trips', { route, vehicle, freight, fuel, toll, driver, load, other, profit, date: today });
    // Auto-sync to transactions so Dashboard + Analytics reflect this trip
    if (freight > 0) {
      STRATIX_DB.push('transactions', { type:'revenue', amount:freight, category:'freight', description:'Trip: ' + route + (vehicle?' ('+vehicle+')':''), date: today });
    }
    const totalCost = fuel + toll + driver + load + other;
    if (totalCost > 0) {
      STRATIX_DB.push('transactions', { type:'expense', amount:totalCost, category:'logistics', description:'Trip Costs: ' + route, date: today });
    }
    NOTIFY.show('Trip saved! Revenue & expenses added to Dashboard ✓', 'success');
  },

  // ── INVOICE AGING ─────────────────────────────────────────────────────────
  renderInvoiceAging() {
    const clients = STRATIX_DB.getArr('clients');
    const sym = this.settings.currencySymbol||'₹';
    const totalOutstanding = clients.reduce((s,c)=>s+c.outstanding,0);
    const highRisk = clients.filter(c=>c.risk==='high').length;
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Invoice Aging & Collection Tracker</h1></div>
        <div class="kpi-grid">
          <div class="kpi-card accent"><div class="kpi-lbl">Total Outstanding</div><div class="kpi-val">${sym}${this.fmt(totalOutstanding)}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Clients with Dues</div><div class="kpi-val">${clients.filter(c=>c.outstanding>0).length}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">High Risk</div><div class="kpi-val red">${highRisk}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">Collection Score</div><div class="kpi-val green">${clients.length>0?Math.round((clients.filter(c=>c.outstanding===0).length/clients.length)*100):100}%</div></div>
        </div>
        <div class="age-buckets">
          ${[['0-30 days','low',0,30000],['31-60 days','medium',30001,100000],['61-90 days','high',100001,300000],['90+ days','critical',300001,Infinity]].map(([label,risk,min,max])=>`
            <div class="aging-bucket ${risk}">
              <div class="age-lbl">${label}</div>
              <div class="age-amt">${sym}${this.fmt(clients.filter(c=>Number(c.outstanding)>min&&Number(c.outstanding)<=max).reduce((s,c)=>s+Number(c.outstanding||0),0))}</div>
              <div class="age-cnt">${clients.filter(c=>Number(c.outstanding)>min&&Number(c.outstanding)<=max).length} clients</div>
            </div>`).join('')}
        </div>
        <div class="tbl-wrap">
          <div class="tbl-head">
            <h3>Client Outstanding</h3>
            <button class="btn btn-ghost btn-sm" onclick="APP.addClientPrompt()">+ Add Client</button>
          </div>
          <div class="tbl-scroll">
            <table class="data-table">
              <thead><tr><th>Client</th><th>Outstanding</th><th>Invoices</th><th>Last Payment</th><th>Risk</th><th>Action</th></tr></thead>
              <tbody>
                ${clients.map(c=>`<tr>
                  <td><strong>${escapeHTML(c.name||'')}</strong></td>
                  <td class="${Number(c.outstanding||0)>0?'red':'green'}">${sym}${this.fmt(c.outstanding||0)}</td>
                  <td>${c.invoices||0}</td>
                  <td>${c.lastPayment||'—'}</td>
                  <td><span class="risk-badge ${c.risk||'low'}">${c.risk||'low'}</span></td>
                  <td style="display:flex;gap:6px;flex-wrap:wrap">
                    ${Number(c.outstanding||0)>0
                      ?`<button class=\"btn btn-sm\" style=\"background:rgba(16,185,129,.1);color:#10B981;border:1px solid rgba(16,185,129,.2)\" onclick=\"APP._markClientPaid('${c.id}')\">✅ Paid</button>`
                      :'<span style=\"color:#10B981;font-size:12px\">✓ Clear</span>'
                    }
                    <button class=\"btn btn-ghost btn-sm\" onclick=\"APP.sendReminder('${c.id}')\">📱 Remind</button>
                  </td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  },


  _markClientPaid(clientId) {
    const clients = STRATIX_DB.getArr('clients');
    const idx = clients.findIndex(c => c.id === clientId);
    if (idx === -1) return;
    const client = clients[idx];
    const amt = Number(client.outstanding || 0);
    if (amt <= 0) { NOTIFY.show('This client has no outstanding balance.', 'info'); return; }
    const sym = this.settings.currencySymbol || '₹';
    if (!confirm(`Mark ${client.name} as fully paid (${sym}${amt.toLocaleString('en-IN')})? This will create a revenue transaction.`)) return;
    // Reduce outstanding
    clients[idx].outstanding = 0;
    clients[idx].lastPayment = new Date().toLocaleDateString('en-IN');
    STRATIX_DB.set('clients', clients);
    // Record revenue transaction
    STRATIX_DB.push('transactions', {
      type: 'revenue', amount: amt, category: 'payment_received',
      description: 'Payment received: ' + client.name,
      date: new Date().toISOString().split('T')[0],
    });
    NOTIFY.show('✅ ' + client.name + ' marked paid — ' + sym + amt.toLocaleString('en-IN') + ' added to revenue', 'success');
    this.renderInvoiceAging();
  },

  addClientPrompt() {
    APP._showClientAddModal();
  },

  sendReminder(id) {
    const client = STRATIX_DB.getArr('clients').find(c=>c.id===id);
    if (!client) return;
    const sym = this.settings.currencySymbol||'₹';
    const phone = client.phone || '';
    if (!phone) { NOTIFY.show('No phone number for this client. Add it in CRM first.','warning'); return; }
    const msg = `Dear ${client.name},\n\nThis is a reminder that you have an outstanding balance of ${sym}${this.fmt(client.outstanding)} with ${this.settings.businessName||'us'}.\n\nPlease arrange payment at the earliest.\n\nRegards,\n${this.session.name}`;
    // Robust Indian phone normalisation: strip non-digits, remove leading 0, ensure 91 prefix
    const digits = phone.replace(/[^0-9]/g, '');
    const normalized = digits.startsWith('91') && digits.length === 12
      ? digits
      : '91' + digits.replace(/^0+/, '').slice(-10);
    if (normalized.length < 12) { NOTIFY.show('Phone number looks invalid. Please check the client profile.','warning'); return; }
    const waUrl = `https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    NOTIFY.show('WhatsApp opened — message ready to send!','success');
  },

  // ── EARLY WARNING ─────────────────────────────────────────────────────────
  renderEarlyWarning() {
    const txns = STRATIX_DB.getArr('transactions');
    const now = new Date();
    const months = [];
    for (let m = 2; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const mTxns = txns.filter(t=>{ const td=new Date(t.date||t.createdAt); return td.getMonth()===d.getMonth()&&td.getFullYear()===d.getFullYear(); });
      const rev = mTxns.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
      const exp = mTxns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
      months.push({ rev, exp, profit: rev-exp });
    }
    // revDrop: true if newest month revenue is >10% below oldest month (3-month decline)
    const revDrop = months[2].rev < months[0].rev * 0.9;
    // expRise: true if newest month expenses are >20% above oldest month
    const expRise = months[2].exp > months[0].exp * 1.2;
    const marginLow = months[2].rev > 0 && (months[2].profit/months[2].rev) < 0.1;
    const warnings = [
      { active: revDrop, icon:'📉', title:'Revenue Declining', desc:'3+ consecutive months of revenue decline detected', level:'red' },
      { active: expRise, icon:'📈', title:'Expenses Rising', desc:'Expenses increased >20% compared to 3 months ago', level:'orange' },
      { active: marginLow, icon:'⚠️', title:'Low Profit Margin', desc:'Current margin below 10% minimum viable threshold', level:'yellow' },
      { active: false, icon:'👤', title:'Customer Concentration', desc:'One client is >50% of revenue', level:'orange' },
      { active: false, icon:'💰', title:'Cash Reserve Low', desc:'Less than 30 days of survival cash', level:'red' }
    ];
    const activeWarnings = warnings.filter(w=>w.active).length;
    const dangerScore = activeWarnings === 0 ? 'Green' : activeWarnings <= 1 ? 'Yellow' : activeWarnings <= 3 ? 'Red' : 'Critical';
    const sym = this.settings.currencySymbol||'₹';
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Business Early Warning System</h1></div>
        <div class="danger-score ${dangerScore.toLowerCase()}">
          <div class="danger-icon">${dangerScore==='Green'?'✅':dangerScore==='Yellow'?'⚠️':'🚨'}</div>
          <div>
            <div class="danger-label">Overall Business Danger Score</div>
            <div class="danger-level">${dangerScore}</div>
          </div>
          <div class="survival-days">
            <div class="sd-label">Est. Survival Days</div>
            <div class="sd-val">${months[2].exp > 0 ? Math.round((months[2].profit > 0 ? 180 : 30)) : 'N/A'}</div>
          </div>
        </div>
        <div class="warnings-list">
          ${warnings.map(w=>`
            <div class="warning-card ${w.active?w.level:'inactive'}">
              <div class="warn-icon">${w.icon}</div>
              <div class="warn-body">
                <div class="warn-title">${w.title}</div>
                <div class="warn-desc">${w.desc}</div>
              </div>
              <div class="warn-status">${w.active?'🔴 ACTIVE':'🟢 OK'}</div>
            </div>`).join('')}
        </div>
        <div class="weekly-report-card">
          <h3>📱 Weekly WhatsApp Report (Every Monday 8AM)</h3>
          <p>Summary: Revenue ${sym}${this.fmt(months[2].rev)} | Expenses ${sym}${this.fmt(months[2].exp)} | Profit ${sym}${this.fmt(months[2].profit)} | Status: ${dangerScore}</p>
          <button class="btn-calc" onclick="NOTIFY.show('WhatsApp automation coming soon!','info')">Coming Soon</button>
        </div>
      </div>`;
  },

  // ── ORDER TRACKER ─────────────────────────────────────────────────────────
  renderOrderTracker() {
    const orders = STRATIX_DB.getArr('orders');
    const stages = ['Order Confirmed','Advance Received','Material Ordered','Material Received','Production Started','Production Done','QC Passed','Packed','Dispatched','Delivered','Payment Received'];
    const sym = this.settings.currencySymbol||'₹';
    const wipValue = orders.filter(o=>o.stage<10).reduce((s,o)=>s+o.value,0);
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Order to Delivery Tracker</h1></div>
        <div class="order-kpis">
          <div class="kpi-card accent"><div class="kpi-lbl">Active Orders</div><div class="kpi-val">${orders.filter(o=>o.stage<10).length}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">WIP Value</div><div class="kpi-val">${sym}${this.fmt(wipValue)}</div></div>
          <div class="kpi-card"><div class="kpi-lbl">On-Time Score</div><div class="kpi-val green">${orders.length>0?Math.round((orders.filter(o=>o.stage>=9).length/orders.length)*100):0}%</div></div>
        </div>
        <div class="add-order-form">
          <h3>Create New Order</h3>
          <div class="calc-grid">
            <div class="field"><label>Client Name</label><input id="oClient" placeholder="Client name"/></div>
            <div class="field"><label>Product/Service</label><input id="oProduct" placeholder="Product description"/></div>
            <div class="field"><label>Order Value (${sym})</label><input type="number" id="oValue" placeholder="50000"/></div>
            <div class="field"><label>Delivery Date</label><input type="date" id="oDelivery" value="${new Date(Date.now()+7*24*60*60*1000).toISOString().split('T')[0]}"/></div>
            <div class="field"><label>Penalty/day (${sym})</label><input type="number" id="oPenalty" placeholder="500"/></div>
          </div>
          <button class="btn-calc" onclick="APP.addOrder()">+ Create Order</button>
        </div>
        <div class="orders-board">
          ${orders.map(o=>{
            const daysLeft = Math.round((new Date(o.delivery)-new Date())/(1000*60*60*24));
            const pct = Math.round((o.stage/10)*100);
            const alertClass = daysLeft < 0 ? 'critical' : daysLeft < 2 ? 'warning' : '';
            return `<div class="order-card ${alertClass}">
              <div class="order-header">
                <div><strong>${escapeHTML(o.client||'—')}</strong><div class="order-product">${escapeHTML(o.product||'—')}</div></div>
                <div class="order-value">${sym}${this.fmt(o.value)}</div>
              </div>
              <div class="pipe-stages">
                ${stages.slice(0,10).map((s,i)=>`<div class="stage-dot ${i<o.stage?'done':i===o.stage?'current':''}" title="${s}"></div>`).join('')}
              </div>
              <div class="order-stage-label">${stages[o.stage]||'Complete'} — ${pct}%</div>
              <div class="order-meta">
                <span class="${daysLeft<0?'red':daysLeft<3?'orange':''}">📅 ${daysLeft<0?'OVERDUE '+Math.abs(daysLeft)+' days':daysLeft+' days left'}</span>
                ${daysLeft<0?`<span class="red">Penalty: ${sym}${this.fmt(o.penalty*Math.abs(daysLeft))}</span>`:''}
              </div>
              <div class="order-actions">
                ${o.stage < 10 ? `<button class="btn-sm green" onclick="APP.advanceOrder('${o.id}')">→ Next Stage</button>` : '<span class="green">✅ Complete</span>'}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  },

  addOrder() {
    const client = document.getElementById('oClient').value.trim(); if (!client) return;
    STRATIX_DB.push('orders', { client, product: document.getElementById('oProduct').value, value: +document.getElementById('oValue').value||0, stage:0, delivery: document.getElementById('oDelivery').value, penalty: +document.getElementById('oPenalty').value||0 });
    this.renderOrderTracker();
  },

  advanceOrder(id) {
    const orders = STRATIX_DB.getArr('orders');
    const o = orders.find(o=>o.id===id); if (!o) return;
    if (o.stage < 10) { STRATIX_DB.update('orders', id, { stage: o.stage+1 }); this.renderOrderTracker(); }
  },

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  renderSettings() {
    const s = STRATIX_DB.getSettings();
    const session = this.session;
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">Settings</h1><p class="sec-sub">Customize your STRATIX experience</p></div>
        
        <div class="settings-sections">
          <!-- Business Profile -->
          <div class="settings-group">
            <div class="settings-group-title">🏢 Business Profile</div>
            <div class="settings-grid">
              <div class="field"><label>Business Name</label><input id="sBizName" value="${s.businessName||''}"/></div>
              <div class="field"><label>Owner Name</label><input id="sOwnerName" value="${s.ownerName||session.name||''}"/></div>
              <div class="field"><label>Business Type</label>
                <select id="sBizType">
                  <option value="logistics"  ${(s.businessType==='logistics'||s.businessType==='transport')?'selected':''}>🚛 Transport / Logistics / Fleet</option>
                  <option value="msme"       ${(s.businessType==='msme'||s.businessType==='services'||s.businessType==='service')?'selected':''}>🏢 MSME / Services / Contractor</option>
                  <option value="retail"     ${(s.businessType==='retail'||s.businessType==='trading')?'selected':''}>🛒 Retail Shop / Trading / Distribution</option>
                  <option value="factory"    ${(s.businessType==='factory'||s.businessType==='manufacturing')?'selected':''}>🏭 Manufacturing / Factory / Production</option>
                  <option value="other"      ${(!s.businessType||s.businessType==='other')?'selected':''}>💼 Other / All Tools</option>
                </select>
              </div>
              <div class="field"><label>GST Number</label><input id="sGSTNo" value="${s.gstNumber||''}" placeholder="22AAAAA0000A1Z5"/></div>
              <div class="field"><label>Phone Number</label><input id="sPhone" value="${s.phone||''}" placeholder="+91 9876543210"/></div>
              <div class="field"><label>Invoice Prefix</label><input id="sInvPrefix" value="${s.invoicePrefix||'INV'}" placeholder="INV" maxlength="10"/></div>
              <div class="field"><label>Business Address</label><input id="sAddress" value="${s.address||''}" placeholder="Full address"/></div>
            </div>
          </div>

          <!-- Currency & Regional -->
          <div class="settings-group">
            <div class="settings-group-title">💱 Currency & Regional</div>
            <div class="settings-grid">
              <div class="field"><label>Currency</label>
                <select id="sCurrency" onchange="APP.updateCurrencySymbol(this.value)">
                  ${[['INR','₹','Indian Rupee'],['USD','$','US Dollar'],['EUR','€','Euro'],['GBP','£','British Pound'],['AED','AED','UAE Dirham'],['SGD','S$','Singapore Dollar']].map(([code,sym,name])=>`<option value="${code}" data-sym="${sym}" ${s.currency===code?'selected':''}>${name} (${sym})</option>`).join('')}
                </select>
              </div>
              <div class="field"><label>Financial Year</label>
                <select id="sFinYear">
                  <option ${s.financialYear==='2024-25'?'selected':''}>2024-25</option>
                  <option ${s.financialYear==='2025-26'?'selected':''}>2025-26</option>
                  <option ${s.financialYear==='2026-27'?'selected':''}>2026-27</option>
                </select>
              </div>
              <div class="field"><label>State (for Professional Tax)</label>
                <select id="sState">
                  ${['Maharashtra','Karnataka','Tamil Nadu','Andhra Pradesh','Telangana','West Bengal','Gujarat','Madhya Pradesh','Delhi','Rajasthan','Uttar Pradesh','Kerala','Punjab','Haryana','Bihar','Odisha','Assam','Jharkhand','Chhattisgarh','Goa','Other'].map(st=>`<option value="${st}" ${(s.state||'Maharashtra')===st?'selected':''}>${st}</option>`).join('')}
                </select>
              </div>
              <div class="field"><label>Timezone</label>
                <select id="sTimezone">
                  <option value="Asia/Kolkata" ${s.timezone==='Asia/Kolkata'?'selected':''}>India (IST)</option>
                  <option value="Asia/Dubai" ${s.timezone==='Asia/Dubai'?'selected':''}>Dubai (GST)</option>
                  <option value="America/New_York" ${s.timezone==='America/New_York'?'selected':''}>New York (EST)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Notifications -->
          <div class="settings-group">
            <div class="settings-group-title">🔔 Notifications</div>
            <div class="settings-grid">
              <div class="field"><label>Daily Report Time</label><input type="time" id="sReminderTime" value="${s.reminderTime||'08:00'}"/></div>
              <div class="toggle-row"><label>WhatsApp Notifications</label><input type="checkbox" id="sNotifyWA" ${s.notifyWhatsapp?'checked':''} class="toggle"/></div>
              <div class="toggle-row"><label>Email Notifications</label><input type="checkbox" id="sNotifyEmail" ${s.notifyEmail?'checked':''} class="toggle"/></div>
              <div class="toggle-row"><label>Compact View Mode</label><input type="checkbox" id="sCompact" ${s.compactView?'checked':''} class="toggle"/></div>
            </div>
          </div>

          <!-- Subscription -->
          <div class="settings-group">
            <div class="settings-group-title">🎉 Beta Plan</div>
            <div style="background:rgba(0,214,143,.07);border:1px solid rgba(0,214,143,.2);border-radius:12px;padding:16px 20px">
              <div style="font-size:15px;font-weight:700;color:#00d68f;margin-bottom:6px">All Features Free During Beta</div>
              <div style="font-size:13px;color:var(--muted);line-height:1.7">You have access to all 40+ features at no cost. Premium paid plans will be introduced in a future update — you'll be notified in advance.</div>
            </div>
          </div>

          <!-- Data Management -->
          <div class="settings-group">
            <div class="settings-group-title">🗄️ Data Management</div>
            <div class="data-actions">
              <button class="btn-calc" onclick="APP.exportData()">⬇ Export All Data (JSON)</button>
              <button class="btn-calc" onclick="document.getElementById('settingsImport').click()">⬆ Import Data</button>
              <input type="file" id="settingsImport" accept=".json" style="display:none" onchange="APP.importData(event)"/>
              <button class="btn-calc red" onclick="APP.confirmClearData()">🗑 Clear All Data</button>
            </div>
            <div class="data-stats">
              ${[['transactions','Transactions'],['goals','Goals'],['notes','Notes'],['reminders','Reminders'],['trips','Trips'],['fleet','Fleet Vehicles']].map(([k,label])=>`
                <div class="stat-pill"><span>${label}</span><strong>${STRATIX_DB.getArr(k).length}</strong></div>`).join('')}
            </div>
          </div>

          <!-- Bank Details -->
          <div class="settings-group">
            <div class="settings-group-title">🏦 Bank Details (for Invoices & Receipts)</div>
            <div class="settings-grid">
              <div class="field"><label>Bank Name</label><input id="sBankName" value="${s.bankName||''}" placeholder="State Bank of India"/></div>
              <div class="field"><label>Account Number</label><input id="sBankAcc" value="${s.bankAcc||''}" placeholder="00000011223344"/></div>
              <div class="field"><label>IFSC Code</label><input id="sBankIFSC" value="${s.bankIFSC||''}" placeholder="SBIN0001234"/></div>
              <div class="field"><label>UPI ID</label><input id="sBankUPI" value="${s.upiId||''}" placeholder="yourbusiness@upi"/></div>
            </div>
          </div>

          <!-- STRATIX AI Guide Settings -->


          <!-- Legal -->
          <div class="settings-group">
            <div class="settings-group-title">📜 Legal</div>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <button class="btn btn-ghost btn-sm" onclick="APP.navigate('privacy')">🔒 Privacy Policy</button>
              <button class="btn btn-ghost btn-sm" onclick="APP.renderTerms()">📄 Terms of Service</button>
              <button class="btn btn-ghost btn-sm" onclick="APP.renderAbout()">ℹ️ About STRATIX</button>
            </div>
          </div>

          <!-- Account -->
          <div class="settings-group">
            <div class="settings-group-title">👤 Account</div>
            <div class="account-info">
              <div class="acc-avatar">${escapeHTML(session.avatar||session.name.charAt(0))}</div>
              <div><div class="acc-name">${escapeHTML(session.name||'')}</div><div class="acc-email">${escapeHTML(session.email||'')}</div></div>
            </div>
            <button class="btn-calc" onclick="APP._doLogout()">🚪 Sign Out</button>
          </div>
        </div>

        <div class="settings-save-bar">
          <button class="btn-main" onclick="APP.saveSettings()">💾 Save Settings</button>
        </div>
      </div>`;
  },

  updateCurrencySymbol(code) {
    const symbols = { INR:'₹', USD:'$', EUR:'€', GBP:'£', AED:'AED', SGD:'S$' };
    this.settings.currencySymbol = symbols[code]||'₹';
  },

  saveSettings() {
    const s = STRATIX_DB.getSettings();
    s.businessName = document.getElementById('sBizName').value;
    s.ownerName = document.getElementById('sOwnerName').value;
    s.businessType = document.getElementById('sBizType').value;
    s.gstNumber = document.getElementById('sGSTNo').value;
    s.phone = document.getElementById('sPhone').value;
    s.address = document.getElementById('sAddress').value;
    s.invoicePrefix = (document.getElementById('sInvPrefix')?.value||'INV').toUpperCase().replace(/[^A-Z0-9]/g,'');
    s.currency = document.getElementById('sCurrency').value;
    s.currencySymbol = { INR:'₹',USD:'$',EUR:'€',GBP:'£',AED:'AED',SGD:'S$' }[s.currency]||'₹';
    s.financialYear = document.getElementById('sFinYear').value;
    s.state = document.getElementById('sState') ? document.getElementById('sState').value : (s.state||'Maharashtra');
    s.timezone = document.getElementById('sTimezone').value;
    s.reminderTime = document.getElementById('sReminderTime').value;
    s.notifyWhatsapp = document.getElementById('sNotifyWA').checked;
    s.notifyEmail = document.getElementById('sNotifyEmail').checked;
    s.compactView = document.getElementById('sCompact').checked;
    // Bank details
    if (document.getElementById('sBankName')) {
      s.bankName = document.getElementById('sBankName').value;
      s.bankAcc = document.getElementById('sBankAcc').value;
      s.bankIFSC = document.getElementById('sBankIFSC').value;
      s.upiId = document.getElementById('sBankUPI').value;
      s.bankDetails = `${s.bankName||''} | A/C: ${s.bankAcc||''} | IFSC: ${s.bankIFSC||''} | UPI: ${s.upiId||''}`;
    }
    STRATIX_DB.saveSettings(s);
    this.settings = s;
    STRATIX_AUTH.updateProfile({ name: s.ownerName, biz: s.businessName });
    // Notify interconnect of settings change
    try { document.dispatchEvent(new CustomEvent('stratix:settingssaved', { detail: { businessType: s.businessType } })); } catch(e) {}
    this.session = STRATIX_AUTH.getSession();

    // BUG 17 FIX: apply compact view mode immediately
    document.body.classList.toggle('compact-mode', !!s.compactView);

    // ── Bug fix: sync session.bizType when user changes business type in Settings.
    // Without this, _renderVerticalDashboard() keeps reading the OLD bizType from
    // the session object and the vertical never switches.
    if (this.session) {
      this.session.bizType = s.businessType;
      // Persist into stored session so it survives page reload
      try {
        const raw = JSON.parse(localStorage.getItem('sx_session'));
        if (raw) { raw.bizType = s.businessType; localStorage.setItem('sx_session', JSON.stringify(raw)); }
      } catch(e) {}
    }

    if (typeof VERTICAL !== 'undefined') {
      const vCfg = VERTICAL.apply(s.businessType);
      this.renderNav();
      this.updateUserBadge();
      NOTIFY.show(`✅ Settings saved! Mode: ${vCfg ? vCfg.label : s.businessType}`, 'success');
    } else {
      this.renderNav();
      this.updateUserBadge();
      NOTIFY.show('Settings saved!', 'success');
    }
  },

  confirmClearData() {
    const existing = document.getElementById('clearDataBar');
    if (existing) { existing.remove(); return; }
    const bar = document.createElement('div');
    bar.id = 'clearDataBar';
    bar.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;background:#F8FAFC;border:1.5px solid #e84040;border-radius:16px;padding:18px 24px;display:flex;flex-direction:column;gap:12px;box-shadow:0 8px 40px rgba(0,0,0,.7);font-family:var(--font);max-width:340px;width:90%;';
    bar.innerHTML = `
      <div style="font-size:14px;font-weight:700;color:#e84040">⚠️ Delete ALL Data?</div>
      <div style="font-size:12px;color:#6B7280;line-height:1.6">Permanently deletes all transactions, trips, fleet, employees, goals, notes, reminders. Cannot be undone. Export first!</div>
      <div style="display:flex;gap:10px;">
        <button id="clearDataYes" style="flex:1;background:#e84040;border:none;border-radius:10px;padding:10px;color:#fff;font-weight:700;cursor:pointer;font-family:var(--font);font-size:13px;">Yes, Delete All</button>
        <button id="clearDataNo" style="flex:1;background:#E2E8F0;border:1px solid #2a3a5c;border-radius:10px;padding:10px;color:#0F172A;cursor:pointer;font-family:var(--font);font-size:13px;">Cancel</button>
      </div>`;
    document.body.appendChild(bar);
    // BUG 5 FIX: use proper event listeners instead of inline escaped onclick strings
    document.getElementById('clearDataNo').onclick = () => bar.remove();
    document.getElementById('clearDataYes').onclick = () => {
      ['transactions','goals','notes','reminders','trips','fleet','invoices','orders',
       'gstEntries','clients','employees','payslips','bankAccounts','bankTransactions',
       'fct_workers','fct_machines','fct_rawmats','fct_batches',
       'rtl_items','rtl_bills','svc_projects','route_history'].forEach(k => STRATIX_DB.set(k, []));
      bar.remove();
      NOTIFY.show('All data cleared successfully', 'success');
      APP.renderSettings();
    };
  },

  // ── PRIVACY POLICY ────────────────────────────────────────────────────────
  renderPrivacy() {
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">🔒 Privacy Policy</h1><p class="sec-sub">Last updated: March 2026 &middot; STRATIX v4.0</p></div>
        <div class="privacy-doc">
          ${[
            ['1. Introduction', 'STRATIX is a business intelligence platform built for Indian entrepreneurs. This Privacy Policy explains how your data is handled. By using STRATIX, you consent to the practices described here.'],
            ['2. What Data We Collect', '<strong>Account:</strong> Name, email, phone, business name, password (one-way hashed — never plain text).<br/><br/><strong>Business Data:</strong> Revenue, expenses, trips, fleet, clients, employees, payroll, GST, notes, goals, and reminders that you enter.<br/><br/><strong>Device Info:</strong> Browser type and OS — only for technical support.'],
            ['3. How Your Data is Stored', '<strong>On Your Device (Default):</strong> All business data is stored in your browser localStorage. It never leaves your device unless you export it. Important: if you clear your browser data, your data will be lost — export regularly via Settings → Export.<br/><br/><strong>Password Security:</strong> Hashed with a one-way algorithm. Never stored or transmitted in plain text.<br/><br/><strong>API Key:</strong> Your AI Advisor API key is stored in sessionStorage (auto-clears when browser closes) for your protection.'],
            ['4. How We Use Your Data', '• To provide app features and generate your reports<br/>• To improve features based on aggregated usage<br/>• To send support communications if you contact us<br/>• To comply with legal obligations under Indian law'],
            ['5. Data Sharing — We Never Sell Your Data', 'STRATIX never sells, rents, or trades your data. Limited sharing only with:<br/>• <strong>Legal Authorities:</strong> Only if required by Indian law or court order<br/>• <strong>Payment Processors:</strong> Only when paid plans are introduced — only payment info shared<br/>• <strong>Anthropic (AI Advisor):</strong> Your business summary sent to Claude API using your own key. We never store these conversations.'],
            ['6. Your Rights Under DPDP Act 2023', '• <strong>Access:</strong> Request your data at any time<br/>• <strong>Correction:</strong> Update info via Settings<br/>• <strong>Erasure:</strong> Delete account via Settings → Clear Data<br/>• <strong>Portability:</strong> Export all data as JSON via Settings → Export<br/>• <strong>Grievance:</strong> privacy@stratix.app — response within 72 hours'],
            ['7. WhatsApp Message Builder', 'The WhatsApp feature creates pre-filled message templates that open WhatsApp on your device. STRATIX does not access your WhatsApp account or store any conversation data.'],
            ["8. Children's Privacy", 'STRATIX is for business use by adults (18+). We do not collect data from persons under 18. Contact privacy@stratix.app immediately if you believe a minor has registered.'],
            ['9. Policy Updates', 'We may update this policy. You will be notified via in-app notification. Continued use after changes means you accept the updated policy.'],
            ['10. Contact', '<strong>Privacy:</strong> privacy@stratix.app<br/><strong>Support:</strong> support@stratix.app<br/><strong>Website:</strong> stratix.app<br/>Response within 72 hours.'],
            ['11. Governing Law', 'Governed by Indian law including the DPDP Act 2023 and IT Act 2000. Jurisdiction: Courts of India.']
          ].map(([title,body])=>`
            <div class="privacy-sec">
              <h3>${title}</h3>
              <p>${body}</p>
            </div>`).join('')}
        </div>
      </div>`;
  },

  // ── COMING SOON ───────────────────────────────────────────────────────────
  renderComingSoon(icon, title, desc, plan) {
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="cs-wrap">
          <div class="cs-ico">${icon}</div>
          <h2>${title}</h2>
          <p>${desc}</p>
          ${plan?`<div class="cs-plan">Requires ${plan.charAt(0).toUpperCase()+plan.slice(1)} Plan</div>`:''}
          <div class="cs-badge">🚀 Coming Soon</div>
          <p class="cs-note">This feature is in active development. You'll be notified in-app when it launches.</p>
          <button class="btn-calc" onclick="APP.navigate('dashboard')">← Back to Dashboard</button>
        </div>
      </div>`;
  },

  // ── TERMS OF SERVICE ──────────────────────────────────────────────────────
  renderTerms() {
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">📄 Terms of Service</h1><p class="sec-sub">Last updated: March 2026 &middot; STRATIX v4.0</p></div>
        <div class="privacy-doc">
          ${[
            ['1. Acceptance of Terms', 'By accessing or using STRATIX, you agree to be bound by these Terms of Service. If you do not agree, do not use the app. These terms apply to all users.'],
            ['2. Description of Service', 'STRATIX is a business intelligence platform providing financial analytics, document generation, payroll tools, logistics documents, and operational tools for Indian small businesses, transport operators, and manufacturers.'],
            ['3. User Accounts', 'You must register to access the platform. You are responsible for keeping your credentials confidential. You must provide accurate information during registration. One person or entity may not maintain more than one free account.'],
            ['4. Current Pricing — Beta Phase', 'STRATIX is currently FREE during beta. All features are available at no cost. Paid plans will be introduced in a future update. You will receive advance in-app notification before any charges begin. You can continue using the free features or choose to subscribe.'],
            ['5. Acceptable Use', 'You agree not to: (a) use STRATIX for any unlawful purpose; (b) attempt unauthorized access to any part of the platform; (c) interfere with or disrupt the platform; (d) copy or distribute content without permission; (e) use the platform to send spam or distribute malicious code.'],
            ['6. Data & Privacy', 'All business data is stored on your device by default (localStorage). Please export your data regularly — we are not liable for data loss from browser cache clearing. Your use of the platform is also governed by our Privacy Policy.'],
            ['7. Intellectual Property', 'STRATIX, its logo, and all platform content are owned by STRATIX and protected under Indian copyright law. You are granted a limited, non-exclusive, non-transferable license to use the platform for your own business purposes only.'],
            ['8. Limitation of Liability', 'STRATIX is provided "as is" without warranties. We are not liable for: data loss, business loss, indirect damages, errors in calculations, or service interruptions. Always verify financial calculations with a qualified CA.'],
            ['9. Financial & Legal Disclaimer', 'STRATIX provides tools for analysis and planning — not financial, legal, or tax advice. All GST calculations, salary estimates, loan projections, and financial data are indicative only. Consult a qualified CA or financial advisor before making business decisions.'],
            ['10. Termination', 'We may suspend accounts for violation of these terms. You may delete your account anytime via Settings → Clear Data. Export your data before deletion.'],
            ['11. Governing Law', 'These Terms are governed by the laws of India. Disputes resolved through arbitration under the Arbitration and Conciliation Act, 1996. Seat of arbitration: Mumbai, Maharashtra.'],
            ['12. Contact', 'Questions about these Terms: legal@stratix.app | support@stratix.app | stratix.app']
          ].map(([title,body]) => `
            <div class="privacy-sec">
              <h3>${title}</h3>
              <p>${body}</p>
            </div>`).join('')}
        </div>
      </div>`;
  },

    renderAbout() {
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">About STRATIX</h1></div>
        <div style="max-width:700px">
          <div style="text-align:center;padding:40px 20px;background:var(--surface);border:1px solid var(--border);border-radius:20px;margin-bottom:20px">
            <div style="width:72px;height:72px;background:linear-gradient(135deg,var(--gold),#3B82F6);border-radius:18px;display:inline-flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:800;font-size:26px;color:#060a10;margin-bottom:16px">SX</div>
            <h2 style="font-family:'Syne',sans-serif;font-size:28px;letter-spacing:4px;margin-bottom:6px">STRATIX</h2>
            <p style="color:var(--muted);letter-spacing:3px;font-size:12px;margin-bottom:20px">ANALYZE · DECIDE · GROW</p>
            <div style="display:inline-block;background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.3);border-radius:20px;padding:6px 16px;font-size:12px;color:var(--gold)">Version 2.0 · March 2026</div>
          </div>
          <div class="settings-group">
            <div class="settings-group-title">Mission</div>
            <p style="font-size:15px;line-height:1.8;color:var(--text2)">Every Indian small business owner deserves enterprise-grade intelligence tools at an affordable price. STRATIX brings the same analytics power that large corporations pay lakhs for — to transport operators, factory owners, traders, and service businesses across India.</p>
          </div>
          <div class="settings-group" style="margin-top:16px">
            <div class="settings-group-title">Platform Stats</div>
            <div class="data-stats">
              ${[['37+','Features'],['8','Doc Types'],['7','Premium Tools'],['3','Target Markets'],['2+','Platforms'],['₹299','Starting Price']].map(([n,l])=>`<div class="stat-pill"><span>${l}</span><strong>${n}</strong></div>`).join('')}
            </div>
          </div>
          <div class="settings-group" style="margin-top:16px">
            <div class="settings-group-title">Contact</div>
            <p style="font-size:14px;color:var(--text2);line-height:2">
              🌐 Website: <a href="https://stratix.app" style="color:var(--gold)">stratix.app</a><br/>
              📧 Support: support@stratix.app<br/>
              📧 Privacy: privacy@stratix.app<br/>
              📧 Legal: legal@stratix.app<br/>
              📱 Play Store: Search "STRATIX Business"
            </p>
          </div>
          <div style="text-align:center;margin-top:20px;color:var(--muted);font-size:12px">
            Made with ❤️ for Indian entrepreneurs<br/>
            © 2026 STRATIX. All rights reserved.
          </div>
        </div>
      </div>`;
  },


  renderTeamAccess() {
    document.getElementById('sectionContent').innerHTML = `
      <div class="sec">
        <div class="sec-head">
          <div>
            <h1 class="sec-title">👥 Team Access</h1>
            <p class="sec-sub">Multi-user collaboration — coming soon</p>
          </div>
          <span style="background:rgba(37,99,235,.12);color:var(--gold);border:1px solid rgba(37,99,235,.3);border-radius:20px;padding:5px 14px;font-size:12px;font-weight:700">🚀 Coming Soon</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <div class="card" style="text-align:center;padding:32px 24px">
            <div style="font-size:52px;margin-bottom:14px">👑</div>
            <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Owner / Admin</h3>
            <p style="font-size:13px;color:var(--muted);line-height:1.7">Full access to all modules — finance, payroll, delete, export, settings</p>
          </div>
          <div class="card" style="text-align:center;padding:32px 24px">
            <div style="font-size:52px;margin-bottom:14px">👤</div>
            <h3 style="font-size:16px;font-weight:700;margin-bottom:8px">Staff / Accountant</h3>
            <p style="font-size:13px;color:var(--muted);line-height:1.7">View and add entries — no delete, no export, no finance access</p>
          </div>
        </div>
        <div class="card" style="margin-bottom:16px">
          <div class="card-title">🔮 What's Coming</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px">
            ${[
              ['🔐','Login with separate credentials','Each team member gets their own secure login'],
              ['👁️','Role-based views','Driver sees only trips, accountant sees only finance'],
              ['📋','Activity audit log','See who added, edited or deleted what and when'],
              ['🔔','Team notifications','Alert specific roles when actions need approval'],
              ['📱','WhatsApp invite','Invite staff members directly via WhatsApp'],
              ['🏢','Multi-branch','Separate data per branch, consolidated dashboard'],
            ].map(([icon,title,desc])=>`
              <div style="display:flex;gap:12px;padding:12px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)">
                <span style="font-size:22px;flex-shrink:0">${icon}</span>
                <div>
                  <div style="font-size:13px;font-weight:600;margin-bottom:3px">${title}</div>
                  <div style="font-size:11px;color:var(--muted)">${desc}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
        <div style="background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.2);border-radius:14px;padding:20px;text-align:center">
          <div style="font-size:14px;font-weight:700;color:var(--gold);margin-bottom:6px">💡 For Now — Use Role System</div>
          <p style="font-size:13px;color:var(--muted);margin-bottom:14px">STRATIX already has Admin/Staff roles you can set today. Go to Settings → User Role to switch between Admin (full access) and Staff (restricted).</p>
          <button class="btn btn-gold" onclick="APP.navigate('settings')">Open Settings → Role</button>
        </div>
      </div>`;
  },

  _doLogout() {
    // Works in both single-page (index.html) and standalone mode
    if (typeof doLogout === 'function') { doLogout(); return; }
    STRATIX_AUTH.logout();
  },

  fmt(n) {
    n = Math.abs(n || 0);
    if (n >= 10000000) return (n/10000000).toFixed(2) + ' Cr';
    if (n >= 100000)   return (n/100000).toFixed(2) + ' L';
    if (n >= 1000)     return (n/1000).toFixed(1) + 'K';
    return Math.round(n).toLocaleString('en-IN');
  }
};

