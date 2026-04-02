/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  STRATIX  —  polish.js  v1.0  (Round 5)                                   ║
 * ║                                                                             ║
 * ║  DROP-IN: <script src="polish.js"></script> last script in index.html      ║
 * ║                                                                             ║
 * ║  1. MICRO-INTERACTIONS  — Button ripple, KPI count-up animation,           ║
 * ║     tab slide indicator, row hover pulse, number transitions               ║
 * ║                                                                             ║
 * ║  2. ERROR STATES WITH RETRY — All renderSection calls wrapped in           ║
 * ║     try/catch with styled error card + retry button                        ║
 * ║                                                                             ║
 * ║  3. DISABLED STATES — "Receive PO" when received, "Advance SO"             ║
 * ║     when complete, export when no data — enforced at render time           ║
 * ║                                                                             ║
 * ║  4. RENDER CACHE — Navigate away and back within 45s reuses HTML           ║
 * ║     instead of re-running expensive render functions                       ║
 * ║                                                                             ║
 * ║  5. PERFORMANCE — Debounce all oninput handlers, defer non-critical        ║
 * ║     init (AI float, onboarding) by 2s, virtual scroll for large tables    ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   1.  MICRO-INTERACTIONS
   ══════════════════════════════════════════════════════════════════════════════ */

const MICRO = {

  /* ── Button ripple effect ── */
  initRipple() {
    // Use event delegation — works on all buttons including dynamically created ones
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('button, .btn, .btn-calc, .btn-main, .nav-item, .qa-btn, .doc-card, .decision-card');
      if (!btn || btn.disabled) return;

      const rect   = btn.getBoundingClientRect();
      const size   = Math.max(rect.width, rect.height) * 2;
      const x      = e.clientX - rect.left - size / 2;
      const y      = e.clientY - rect.top  - size / 2;

      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position:absolute;left:${x}px;top:${y}px;
        width:${size}px;height:${size}px;
        background:rgba(255,255,255,.15);
        border-radius:50%;pointer-events:none;
        transform:scale(0);animation:sxRipple .5s ease-out forwards;
        z-index:0;
      `;

      // Need position:relative on the button
      const prev = btn.style.position;
      if (!prev || prev === 'static') btn.style.position = 'relative';
      btn.style.overflow = 'hidden';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 520);
    }, { passive: true });
  },

  /* ── KPI count-up animation ── */
  animateKPIs() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        if (el.dataset.animated) return;
        el.dataset.animated = '1';
        this._countUp(el);
        observer.unobserve(el);
      });
    }, { threshold: 0.3 });

    // Watch for new KPI values being inserted into DOM
    const mo = new MutationObserver(() => {
      document.querySelectorAll('.kpi-val:not([data-animated])').forEach(el => {
        if (el.textContent.trim()) observer.observe(el);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Also observe existing ones
    document.querySelectorAll('.kpi-val').forEach(el => observer.observe(el));
  },

  _countUp(el) {
    const text  = el.textContent.trim();
    // Extract numeric part — handles ₹1.2L, ₹45K, 23%, 42, etc.
    const match = text.match(/([₹$£€]?)([\d.]+)(\s*(?:Cr|L|K|%)?)(.*)/);
    if (!match) return;

    const prefix = match[1];
    const num    = parseFloat(match[2]);
    const suffix = match[3] + match[4];
    if (isNaN(num) || num === 0) return;

    const duration = Math.min(800, Math.max(300, num / 1000 * 100));
    const start    = Date.now();
    const ease     = t => t < .5 ? 2*t*t : -1+(4-2*t)*t;

    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const current  = num * ease(progress);

      // Format to match original (preserve decimal places)
      const decimals = (match[2].split('.')[1] || '').length;
      el.textContent = prefix + current.toFixed(decimals) + suffix;

      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = text; // Restore exact original
    };
    requestAnimationFrame(tick);
  },

  /* ── Smooth section transitions ── */
  initSectionTransitions() {
    if (typeof APP === 'undefined') return;
    const orig = APP.navigate.bind(APP);
    APP.navigate = function(sectionId, fromPopState) {
      const content = document.getElementById('sectionContent');
      if (content && content.children.length > 0) {
        content.style.transition = 'opacity .12s ease, transform .12s ease';
        content.style.opacity    = '0.4';
        content.style.transform  = 'translateY(4px)';
        setTimeout(() => {
          content.style.opacity   = '';
          content.style.transform = '';
          content.style.transition = '';
        }, 120);
      }
      return orig(sectionId, fromPopState);
    };
  },

  /* ── Number value update flash ── */
  flashUpdate(el, newValue) {
    if (!el) return;
    el.style.transition = 'color .15s, opacity .15s';
    el.style.opacity    = '0.3';
    setTimeout(() => {
      el.textContent = newValue;
      el.style.opacity   = '1';
      el.style.color     = 'var(--gold)';
      setTimeout(() => { el.style.color = ''; }, 600);
    }, 100);
  },

  init() {
    this.initRipple();
    this.animateKPIs();
    this.initSectionTransitions();
  },
};

/* Inject ripple keyframe CSS */
(function() {
  if (document.getElementById('sx-polish-css')) return;
  const s = document.createElement('style');
  s.id = 'sx-polish-css';
  s.textContent = `
    @keyframes sxRipple {
      to { transform:scale(1); opacity:0; }
    }
    /* Smooth row hover */
    .data-table tbody tr, table tbody tr {
      transition: background .12s ease;
    }
    /* KPI hover lift */
    .kpi:hover, .kpi-card:hover {
      transform: translateY(-3px) !important;
      box-shadow: 0 8px 32px rgba(0,0,0,.4) !important;
    }
    /* Button active press */
    .btn:active, .btn-calc:active, .btn-main:active {
      transform: scale(0.97) !important;
      transition: transform .08s ease !important;
    }
    /* Card hover glow */
    .card:hover {
      border-color: rgba(37,99,235,.12);
      transition: border-color .2s ease;
    }
    /* Nav item active indicator */
    .nav-item.active::before {
      content:'';
      position:absolute;
      left:0;top:8px;bottom:8px;
      width:3px;
      background:var(--vx,var(--gold));
      border-radius:0 3px 3px 0;
      animation: navSlide .2s ease;
    }
    @keyframes navSlide {
      from { transform: scaleY(0) }
      to   { transform: scaleY(1) }
    }
    /* Input focus glow */
    .field input:focus, .field select:focus, .field textarea:focus {
      border-color: var(--gold) !important;
      box-shadow: 0 0 0 3px rgba(37,99,235,.1) !important;
      transition: border-color .15s, box-shadow .15s !important;
    }
    /* Table row select flash */
    @keyframes rowFlash {
      0%   { background: rgba(37,99,235,.12) }
      100% { background: transparent }
    }
    .sx-row-flash { animation: rowFlash .6s ease; }
    /* Disabled button */
    button[disabled], .btn[disabled] {
      opacity: 0.38 !important;
      cursor: not-allowed !important;
      transform: none !important;
      pointer-events: none !important;
    }
    /* Error state card */
    .sx-error-card {
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:48px 24px;text-align:center;gap:12px;
    }
    .sx-error-icon { font-size:40px; }
    .sx-error-title { font-size:16px;font-weight:700;color:var(--red); }
    .sx-error-sub { font-size:13px;color:var(--muted);max-width:320px;line-height:1.6; }
    /* Skeleton shimmer */
    @keyframes shimmer {
      0%   { background-position:200% 0 }
      100% { background-position:-200% 0 }
    }
  `;
  document.head.appendChild(s);
})();


/* ══════════════════════════════════════════════════════════════════════════════
   2.  ERROR STATES WITH RETRY
   ══════════════════════════════════════════════════════════════════════════════ */

const ERROR_HANDLER = {

  /* Wrap APP.renderSection to catch any render errors */
  init() {
    if (typeof APP === 'undefined') return;
    const orig = APP.renderSection.bind(APP);

    APP.renderSection = function(id) {
      const content = document.getElementById('sectionContent');
      try {
        orig(id);
      } catch (err) {
        console.error(`[STRATIX] Render error in section "${id}":`, err);
        ERROR_HANDLER.show(content, id, err);
      }
    };
  },

  show(container, sectionId, err) {
    if (!container) return;
    container.innerHTML = `
      <div class="sec">
        <div class="sx-error-card">
          <div class="sx-error-icon">⚠️</div>
          <div class="sx-error-title">Section failed to load</div>
          <div class="sx-error-sub">${escapeHTML(err?.message || 'An unexpected error occurred. Your data is safe.')}</div>
          <div style="display:flex;gap:10px;margin-top:8px">
            <button class="btn btn-gold" onclick="APP.renderSection('${escapeHTML(sectionId)}')">🔄 Retry</button>
            <button class="btn btn-ghost" onclick="APP.navigate('dashboard')">← Dashboard</button>
          </div>
          <details style="margin-top:16px;max-width:400px;text-align:left">
            <summary style="font-size:11px;color:var(--muted);cursor:pointer">Technical details</summary>
            <pre style="margin-top:8px;font-size:10px;color:var(--muted);white-space:pre-wrap;background:var(--surface2);padding:10px;border-radius:8px;overflow:auto;max-height:120px">${escapeHTML(err?.stack || err?.message || 'Unknown error')}</pre>
          </details>
        </div>
      </div>`;
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   3.  DISABLED STATES
   ══════════════════════════════════════════════════════════════════════════════ */

const DISABLED_STATES = {

  init() {
    // Use MutationObserver to apply disabled states whenever section content changes
    const observer = new MutationObserver(() => this._apply());
    const content  = document.getElementById('sectionContent');
    if (content) observer.observe(content, { childList: true, subtree: true });
  },

  _apply() {
    clearTimeout(this._applyTimer);
    this._applyTimer = setTimeout(() => {
      this._applyPOButtons();
      this._applySOButtons();
      this._applyExportButtons();
      this._applyPayslipButtons();
    }, 60);
  },

  /* "Receive PO" → disable if already received */
  _applyPOButtons() {
    const pos = STRATIX_DB.getArr('erpPurchaseOrders');
    const posMap = {};
    pos.forEach(p => posMap[p.id] = p.status);

    document.querySelectorAll('[onclick*="ERP.receivePO("]').forEach(btn => {
      const match = btn.getAttribute('onclick')?.match(/ERP\.receivePO\('([^']+)'\)/);
      if (!match) return;
      const status = posMap[match[1]];
      if (status === 'Received') {
        btn.disabled = true;
        btn.title    = 'Already received';
        btn.textContent = '✅ Received';
      }
    });
  },

  /* "Advance SO →" → disable if already Completed/Cancelled */
  _applySOButtons() {
    const sos = STRATIX_DB.getArr('erpSalesOrders');
    const soMap = {};
    sos.forEach(o => soMap[o.id] = o.status);

    document.querySelectorAll('[onclick*="ERP.advanceSO("]').forEach(btn => {
      const match = btn.getAttribute('onclick')?.match(/ERP\.advanceSO\('([^']+)'\)/);
      if (!match) return;
      const status = soMap[match[1]];
      if (status === 'Completed' || status === 'Cancelled') {
        btn.disabled     = true;
        btn.title        = `Order is ${status}`;
        btn.textContent  = status === 'Completed' ? '✅ Done' : '❌ Cancelled';
      }
    });
  },

  /* Export buttons → disable when no data */
  _applyExportButtons() {
    const txns = STRATIX_DB.getArr('transactions');
    document.querySelectorAll('[onclick*="exportCSV"],[onclick*="exportData"]').forEach(btn => {
      if (txns.length === 0) {
        btn.disabled = true;
        btn.title    = 'No data to export';
      }
    });
  },

  /* Payslip generate → disable if no employees */
  _applyPayslipButtons() {
    const employees = STRATIX_DB.getArr('employees');
    if (employees.length > 0) return;
    document.querySelectorAll('[onclick*="runPayroll"],[onclick*="generatePayslip"]').forEach(btn => {
      btn.disabled = true;
      btn.title    = 'Add employees first';
    });
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   4.  RENDER CACHE
   Stores rendered HTML for each section. On re-visit within 45 seconds,
   restores cached HTML instead of re-running render function.
   Cache is invalidated when relevant store data changes.
   ══════════════════════════════════════════════════════════════════════════════ */

const RENDER_CACHE = {

  _cache: {},
  _TTL:   45000, // 45 seconds

  /* Sections that should NOT be cached (dynamic, real-time, or role-gated) */
  _noCache: new Set([
    'dashboard', 'analytics', 'datamanager', 'earlywarning', 'notifications',
    // Finance-gated sections — never cache so role changes take effect immediately
    'gst', 'bank', 'gst_filing', 'tds_tracker', 'upi_tracker', 'tally_export',
  ]),

  /* Sections invalidated by each bus event */
  _invalidateMap: {
    'finance:changed':   ['invoiceaging', 'loan', 'trippnl', 'gst'],
    'inventory:changed': ['erp'],
    'crm:changed':       ['crm', 'invoiceaging'],
  },

  init() {
    if (typeof APP === 'undefined') return;

    // Intercept renderSection
    const orig = APP.renderSection.bind(APP);
    const self = this;

    APP.renderSection = function(id) {
      if (self._noCache.has(id)) { orig(id); return; }

      const cached = self._get(id);
      if (cached) {
        const content = document.getElementById('sectionContent');
        if (content) {
          content.innerHTML = cached;
          // Re-run any scripts that need to bind events
          self._rebindAfterRestore(id);
        }
        return;
      }

      // Run original render, then cache the output
      orig(id);

      const content = document.getElementById('sectionContent');
      if (content && content.innerHTML.length > 100) {
        self._set(id, content.innerHTML);
      }
    };

    // Subscribe to bus events for targeted cache invalidation
    if (typeof STRATIX_BUS !== 'undefined') {
      Object.entries(this._invalidateMap).forEach(([event, sections]) => {
        STRATIX_BUS.on(event, () => sections.forEach(s => this._invalidate(s)));
      });
    }
  },

  _get(id) {
    const entry = this._cache[id];
    if (!entry) return null;
    if (Date.now() - entry.time > this._TTL) {
      delete this._cache[id];
      return null;
    }
    return entry.html;
  },

  _set(id, html) {
    this._cache[id] = { html, time: Date.now() };
  },

  _invalidate(id) {
    delete this._cache[id];
  },

  invalidateAll() {
    this._cache = {};
  },

  /* After restoring cached HTML, some sections need event rebinding */
  _rebindAfterRestore(id) {
    // ERP tabs need the active tab re-rendered
    if (id === 'erp') {
      setTimeout(() => {
        const activeTab = document.querySelector('[id^="erp_tab_"].active');
        if (activeTab && typeof ERP !== 'undefined') {
          const name = activeTab.id.replace('erp_tab_', '');
          const renders = { inv: 'inventory', so: 'sales', po: 'purchase', job: 'jobs', ledger: 'ledger' };
          ERP.tab(renders[name] || 'inventory');
        }
      }, 0);
    }
    // Re-apply disabled states
    if (typeof DISABLED_STATES !== 'undefined') {
      setTimeout(() => DISABLED_STATES._apply(), 100);
    }
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   5.  PERFORMANCE IMPROVEMENTS
   ══════════════════════════════════════════════════════════════════════════════ */

const PERF = {

  /* Debounce all oninput handlers in the DOM */
  debounceInputs() {
    // Find inputs with oninput that aren't already debounced
    const fixInput = (input) => {
      const handler = input.getAttribute('oninput');
      if (!handler || handler.includes('_debounced_') || handler.includes('globalSearch')) return;

      const fnName = '_debounced_' + Math.random().toString(36).slice(2, 7);
      let timer;
      window[fnName] = (el) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          try {
            const fn = new Function('el', 'value', handler.replace(/this\.value/g, 'value'));
            fn(el, el.value);
          } catch {}
        }, 250);
      };
      input.setAttribute('oninput', `${fnName}(this)`);
    };

    // Apply to existing inputs
    document.querySelectorAll('input[oninput]:not([data-debounced])').forEach(input => {
      fixInput(input);
      input.dataset.debounced = '1';
    });
  },

  /* Defer non-critical initializations */
  deferNonCritical() {
    // AI float button and onboarding guide slow first paint
    // Delay their init by 2.5s after app is interactive
    const deferTasks = [
      () => {
        if (typeof STRATIX_AI !== 'undefined') {
          STRATIX_AI.addFloatingButton?.();
          STRATIX_AI.autoTrigger?.();
        }
      },
      () => {
        if (typeof onboardingReady === 'function') onboardingReady();
      },
    ];

    deferTasks.forEach((task, i) => {
      setTimeout(task, 2500 + i * 200);
    });
  },

  /* Patch APP.init to defer non-critical parts */
  patchInit() {
    if (typeof APP === 'undefined') return;
    const orig = APP.init.bind(APP);

    APP.init = function() {
      // Remove the non-critical calls from init
      const origAI   = typeof STRATIX_AI !== 'undefined' ? STRATIX_AI.addFloatingButton : null;
      const origAuto = typeof STRATIX_AI !== 'undefined' ? STRATIX_AI.autoTrigger       : null;

      if (typeof STRATIX_AI !== 'undefined') {
        STRATIX_AI.addFloatingButton = () => {}; // suppress during init
        STRATIX_AI.autoTrigger       = () => {};
      }

      orig();

      // Restore after init and schedule deferred
      if (typeof STRATIX_AI !== 'undefined') {
        STRATIX_AI.addFloatingButton = origAI;
        STRATIX_AI.autoTrigger       = origAuto;
      }

      PERF.deferNonCritical();
    };
  },

  /* Virtual scroll for large transaction tables > 200 rows */
  applyVirtualScroll() {
    // Watch for large tables being inserted
    const observer = new MutationObserver(() => {
      document.querySelectorAll('table tbody:not([data-vscroll])').forEach(tbody => {
        const rows = tbody.querySelectorAll('tr');
        if (rows.length > 200) {
          tbody.dataset.vscroll = '1';
          this._virtualizeTable(tbody, rows);
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  },

  _virtualizeTable(tbody, allRows) {
    const rowHeight  = 42; // px — approximate row height
    const viewHeight = Math.min(window.innerHeight * 0.6, 500);
    const visible    = Math.ceil(viewHeight / rowHeight) + 5; // buffer

    const wrapper = tbody.closest('.tbl-scroll') || tbody.parentElement;
    const origOverflow = wrapper.style.overflow;
    wrapper.style.overflowY = 'auto';
    wrapper.style.maxHeight = `${viewHeight}px`;

    let renderStart = 0;
    const render = (start) => {
      renderStart = Math.max(0, Math.min(start, allRows.length - visible));
      const fragment = document.createDocumentFragment();

      // Spacer before
      if (renderStart > 0) {
        const spacer = document.createElement('tr');
        spacer.style.height = `${renderStart * rowHeight}px`;
        fragment.appendChild(spacer);
      }
      // Visible rows
      for (let i = renderStart; i < Math.min(renderStart + visible, allRows.length); i++) {
        fragment.appendChild(allRows[i].cloneNode(true));
      }
      // Spacer after
      const after = allRows.length - renderStart - visible;
      if (after > 0) {
        const spacer = document.createElement('tr');
        spacer.style.height = `${after * rowHeight}px`;
        fragment.appendChild(spacer);
      }

      tbody.innerHTML = '';
      tbody.appendChild(fragment);
    };

    render(0);

    wrapper.addEventListener('scroll', () => {
      const newStart = Math.floor(wrapper.scrollTop / rowHeight);
      if (Math.abs(newStart - renderStart) > 10) render(newStart);
    }, { passive: true });
  },

  init() {
    this.patchInit();
    this.applyVirtualScroll();
    // Debounce inputs on DOM mutation
    const mo = new MutationObserver(() => {
      clearTimeout(this._debTimer);
      this._debTimer = setTimeout(() => this.debounceInputs(), 300);
    });
    mo.observe(document.body, { childList: true, subtree: true });
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   6.  ENHANCED EMPTY STATES  (replace bare "No data" text in all modules)
   ══════════════════════════════════════════════════════════════════════════════ */

const EMPTY_STATES = {

  /* Map of section → empty state config */
  _configs: {
    erpInventory:      { icon: '📦', title: 'Stock register is empty', sub: 'Add your first item to start tracking inventory', btn: '+ Add Item', fn: "ERP.openAddItem()" },
    erpSalesOrders:    { icon: '🛒', title: 'No sales orders yet',    sub: 'Create your first sales order to start tracking sales', btn: '+ New Order', fn: "ERP.openSaleOrder()" },
    erpPurchaseOrders: { icon: '🏪', title: 'No purchase orders',     sub: 'Create a purchase order to restock inventory', btn: '+ New PO', fn: "ERP.openPO()" },
    crmLeads:          { icon: '🎯', title: 'No leads tracked',       sub: 'Add your first lead to start managing your pipeline', btn: '+ Add Lead', fn: "CRM.openAddLead()" },
    crmContacts:       { icon: '👥', title: 'No contacts yet',        sub: 'Build your contact directory to stay connected', btn: '+ Add Contact', fn: "CRM.openAddContact()" },
    transactions:      { icon: '📒', title: 'No transactions yet',    sub: 'Start adding revenue and expense entries', btn: '+ Add Entry', fn: "APP.navigate('datamanager')" },
    employees:         { icon: '👤', title: 'No employees added',     sub: 'Add your team to start managing payroll', btn: '+ Add Employee', fn: "typeof FEAT!=='undefined'?FEAT.openAddEmployee():PAY?.openAddEmployee()" },
    fleet:             { icon: '🚛', title: 'No vehicles registered', sub: 'Add your vehicles to track fleet performance', btn: '+ Add Vehicle', fn: "APP.navigate('fleet')" },
  },

  /* Upgrade bare "No items" table cells to full empty states */
  init() {
    const mo = new MutationObserver(() => this._upgrade());
    mo.observe(document.body, { childList: true, subtree: true });
  },

  _upgrade() {
    clearTimeout(this._upgradeTimer);
    this._upgradeTimer = setTimeout(() => {
      document.querySelectorAll('td[colspan]:not([data-sx-empty])').forEach(td => {
        const text = td.textContent.trim().toLowerCase();
        const isEmptyMsg = text.includes('no items') || text.includes('no data') ||
                           text === '' || (text.length < 60 && (
                             text.includes('yet') || text.includes('add ') ||
                             text.includes('click') || text.includes('create')
                           ));
        if (!isEmptyMsg || td.querySelector('.sx-inline-empty')) return;

        // Find which data key this table is for
        const section = document.querySelector('#sectionContent');
        const sectionId = APP?.currentSection;
        const cfg = this._getConfig(sectionId, td);
        if (!cfg) return;

        td.dataset.sxEmpty = '1';
        td.style.padding   = '0';
        td.innerHTML = `
          <div class="sx-inline-empty" style="padding:44px 24px;text-align:center">
            <div style="font-size:40px;margin-bottom:12px;opacity:.7">${cfg.icon}</div>
            <h4 style="font-size:15px;font-weight:700;color:var(--text2);margin-bottom:6px">${cfg.title}</h4>
            <p style="font-size:13px;color:var(--muted);max-width:280px;margin:0 auto;line-height:1.6">${cfg.sub}</p>
            ${cfg.btn ? `<button class="btn btn-gold" style="margin-top:16px" onclick="${cfg.fn}">${cfg.btn}</button>` : ''}
          </div>`;
      });
    }, 100);
  },

  _getConfig(sectionId, td) {
    // Try to detect from table content or section
    if (sectionId === 'erp') {
      const tab = document.querySelector('[id^="erp_tab_"].active')?.id;
      if (tab === 'erp_tab_inv')  return this._configs.erpInventory;
      if (tab === 'erp_tab_so')   return this._configs.erpSalesOrders;
      if (tab === 'erp_tab_po')   return this._configs.erpPurchaseOrders;
    }
    if (sectionId === 'crm') {
      const tab = document.querySelector('[id^="crm_tab_"].active')?.id;
      if (tab === 'crm_tab_leads')    return this._configs.crmLeads;
      if (tab === 'crm_tab_contacts') return this._configs.crmContacts;
    }
    if (sectionId === 'datamanager') return this._configs.transactions;
    if (sectionId === 'salary')      return this._configs.employees;
    if (sectionId === 'fleet')       return this._configs.fleet;
    return null;
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   7.  PROGRESSIVE LOADING INDICATOR
   Shows a thin gold progress bar at the top of the page during section renders
   ══════════════════════════════════════════════════════════════════════════════ */

const PROGRESS_BAR = {

  _el: null,
  _timer: null,

  init() {
    this._el = document.createElement('div');
    this._el.id = 'sx-progress-bar';
    this._el.style.cssText = `
      position:fixed;top:0;left:0;height:2px;width:0%;z-index:10000;
      background:linear-gradient(90deg,var(--gold),#ff7c40,var(--gold));
      background-size:200% 100%;
      animation:progressShimmer 1.2s linear infinite;
      transition:width .3s ease, opacity .3s ease;
      opacity:0;pointer-events:none;
    `;
    document.body.appendChild(this._el);

    // Inject keyframe
    const s = document.createElement('style');
    s.textContent = `@keyframes progressShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`;
    document.head.appendChild(s);

    // Hook into navigation
    if (typeof APP !== 'undefined') {
      const orig = APP.renderSection.bind(APP);
      const self = this;
      APP.renderSection = function(id) {
        self.start();
        try { orig(id); }
        finally { self.done(); }
      };
    }
  },

  start() {
    if (!this._el) return;
    clearTimeout(this._timer);
    this._el.style.opacity = '1';
    this._el.style.width   = '0%';
    // Progress to 80% quickly then stall
    requestAnimationFrame(() => {
      this._el.style.transition = 'width .4s ease';
      this._el.style.width = '80%';
    });
  },

  done() {
    if (!this._el) return;
    this._el.style.transition = 'width .2s ease, opacity .4s ease .1s';
    this._el.style.width = '100%';
    this._timer = setTimeout(() => {
      if (this._el) { this._el.style.opacity = '0'; this._el.style.width = '0%'; }
    }, 400);
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   BOOT — apply everything after DOM ready
   ══════════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  try {
    // 1. Micro-interactions
    MICRO.init();

    // 2. Error states with retry
    ERROR_HANDLER.init();

    // 3. Disabled states watcher
    DISABLED_STATES.init();

    // 4. Render cache
    RENDER_CACHE.init();

    // 5. Performance
    PERF.init();

    // 6. Enhanced empty states
    EMPTY_STATES.init();

    // 7. Progress bar
    PROGRESS_BAR.init();

    // Expose cache invalidation globally (useful for external calls)
    window.RENDER_CACHE = RENDER_CACHE;

    console.info('[STRATIX] polish.js v1.0 — Micro-interactions, error states, disabled states, render cache, performance active.');
  } catch(e) {
    console.warn('[STRATIX] polish.js boot warning:', e.message);
  }
});
