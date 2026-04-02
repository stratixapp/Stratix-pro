/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  STRATIX  —  components.js  v1.0                                           ║
 * ║  Reusable Component Library + Chart Engine + Form Validation System        ║
 * ║                                                                             ║
 * ║  DROP-IN: <script src="components.js"></script> AFTER store.js, BEFORE app.js ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 *  EXPORTS (all global, zero build step needed):
 *
 *    UI.*             — Component factory methods
 *      UI.kpiGrid()        → renders KPI card grid
 *      UI.table()          → renders sortable, filterable data table
 *      UI.modal()          → opens/closes reusable modal system
 *      UI.toast()          → rich toast with actions
 *      UI.badge()          → status/label badge
 *      UI.emptyState()     → empty state with CTA
 *      UI.skeleton()       → loading skeleton (replaces blank → data flash)
 *      UI.confirm()        → smart confirmation dialog
 *      UI.drawer()         → slide-in detail drawer
 *      UI.tabs()           → tabbed panel
 *      UI.searchBar()      → debounced search input
 *      UI.pagination()     → data pagination controls
 *
 *    FORM.*           — Form validation system
 *      FORM.validate()     → run validators against form data
 *      FORM.bind()         → attach real-time validation to a form
 *      FORM.show()         → display field errors inline
 *      FORM.clear()        → clear all errors
 *      FORM.serialize()    → extract form values as object
 *
 *    CHARTS.*         — Chart.js wrapper (auto-loads Chart.js from CDN)
 *      CHARTS.line()       → line/area chart
 *      CHARTS.bar()        → bar chart
 *      CHARTS.donut()      → donut/pie chart
 *      CHARTS.miniBar()    → inline sparkbar (no canvas)
 *      CHARTS.destroy()    → cleanup a chart instance
 *
 *    DASHBOARD.*      — Business Intelligence dashboard panel
 *      DASHBOARD.render()  → renders full BI dashboard into #sectionContent
 *      DASHBOARD.refresh() → partial refresh of KPI cards without full re-render
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   0.  SHARED CONSTANTS & HELPERS
   ══════════════════════════════════════════════════════════════════════════════ */

const _C = {
  sym: () => (typeof STRATIX_DB !== 'undefined' && STRATIX_DB.getSettings().currencySymbol) || '₹',

  fmt(n) {
    const sym = _C.sym();
    n = Math.abs(Number(n) || 0);
    if (n >= 1e7) return sym + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return sym + (n / 1e5).toFixed(2) + ' L';
    if (n >= 1e3) return sym + (n / 1e3).toFixed(1) + 'K';
    return sym + Math.round(n).toLocaleString('en-IN');
  },

  fmtRaw(n) {
    return Math.abs(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  },

  date(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  today: () => new Date().toISOString().split('T')[0],

  uid: () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),

  escape(s) {
    if (typeof escapeHTML === 'function') return escapeHTML(s);
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  /* Color tokens */
  colors: {
    revenue: '#00d68f',
    expense: '#ff4d4d',
    profit:  '#2563EB',
    neutral: '#4f9ef0',
    purple:  '#9b5de5',
    grid:    'rgba(255,255,255,0.04)',
    text:    'rgba(184,198,222,0.7)',
  },

  /* 6-color palette for charts */
  palette: ['#2563EB','#4f9ef0','#00d68f','#9b5de5','#ff7c40','#00c8e0'],
};


/* ══════════════════════════════════════════════════════════════════════════════
   1.  UI COMPONENT FACTORY
   ══════════════════════════════════════════════════════════════════════════════ */

const UI = {

  /* ── KPI GRID ──────────────────────────────────────────────────────────────
   * @param {Array} cards - [{ label, value, id?, icon?, trend?, trendDir?, accent?, color? }]
   * @param {Object} opts - { cols? }
   * @returns {string} HTML
   */
  kpiGrid(cards, opts = {}) {
    const cols = opts.cols || Math.min(cards.length, 4);
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(${cols},1fr)">
        ${cards.map(c => `
          <div class="kpi ${c.accent ? 'accent' : ''}" ${c.id ? `id="${_C.escape(c.id)}"` : ''}>
            <div class="kpi-lbl">${_C.escape(c.label)}</div>
            <div class="kpi-val ${c.color || ''}" ${c.valueId ? `id="${_C.escape(c.valueId)}"` : ''}>${_C.escape(String(c.value))}</div>
            ${c.trend !== undefined ? `
              <div class="kpi-trend ${c.trendDir || (c.trend >= 0 ? 'up' : 'down')}">
                ${c.trend >= 0 ? '▲' : '▼'} ${Math.abs(c.trend).toFixed(1)}%
              </div>` : ''}
            ${c.icon ? `<div class="kpi-ico">${c.icon}</div>` : ''}
          </div>`).join('')}
      </div>`;
  },

  /* ── DATA TABLE ────────────────────────────────────────────────────────────
   * @param {Array} cols   - [{ key, label, render?, width?, align? }]
   * @param {Array} rows   - array of data objects
   * @param {Object} opts  - { id?, emptyMsg?, actions?, pageSize?, searchable? }
   * @returns {string} HTML
   */
  table(cols, rows, opts = {}) {
    const id = opts.id || _C.uid();
    const pageSize = opts.pageSize || 50;
    const page = opts._page || 1;
    const start = (page - 1) * pageSize;
    const visible = rows.slice(start, start + pageSize);
    const totalPages = Math.ceil(rows.length / pageSize);

    const thead = cols.map(c =>
      `<th style="${c.width ? `width:${c.width};` : ''}${c.align ? `text-align:${c.align};` : ''}">${_C.escape(c.label)}</th>`
    ).join('');

    const tbody = visible.length === 0
      ? `<tr><td colspan="${cols.length + (opts.actions ? 1 : 0)}" style="text-align:center;padding:40px 20px;color:var(--muted)">${opts.emptyMsg || 'No data yet'}</td></tr>`
      : visible.map(row => {
          const cells = cols.map(c => {
            const val = c.render ? c.render(row[c.key], row) : _C.escape(String(row[c.key] ?? '—'));
            return `<td style="${c.align ? `text-align:${c.align};` : ''}">${val}</td>`;
          }).join('');
          const actionCell = opts.actions ? `<td style="text-align:right">${opts.actions(row)}</td>` : '';
          return `<tr data-id="${row.id || ''}">${cells}${actionCell}</tr>`;
        }).join('');

    const pager = totalPages > 1 ? `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border);font-size:12px;color:var(--muted)">
        <span>Showing ${start + 1}–${Math.min(start + pageSize, rows.length)} of <strong style="color:var(--text)">${rows.length}</strong> entries</span>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="UI._page('${id}',${page - 1})" ${page <= 1 ? 'disabled' : ''}>‹</button>
          <span style="padding:4px 10px;background:var(--surface2);border-radius:6px;font-weight:600;font-size:12px">${page} / ${totalPages}</span>
          <button class="btn btn-ghost btn-sm" onclick="UI._page('${id}',${page + 1})" ${page >= totalPages ? 'disabled' : ''}>›</button>
        </div>
      </div>` : '';

    return `
      <div class="tbl-wrap" id="${id}" data-cols='${JSON.stringify(cols.map(c => ({ key: c.key, label: c.label })))}'>
        <div class="tbl-scroll">
          <table>
            <thead><tr>${thead}${opts.actions ? '<th style="text-align:right">Actions</th>' : ''}</tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
        ${pager}
      </div>`;
  },

  /* Internal: page change for table */
  _tableState: {},
  _page(tableId, newPage) {
    // Store page state and re-render from the table's data-* attrs
    this._tableState[tableId] = newPage;
    const wrapper = document.getElementById(tableId);
    if (!wrapper) return;
    // Re-run the original render function if registered
    const fn = this._tableRenderFns?.[tableId];
    if (fn) fn(newPage);
  },

  /* Register a re-render function for a table (called by renderSection) */
  _tableRenderFns: {},
  registerTable(id, fn) {
    this._tableRenderFns[id] = fn;
  },

  /* ── MODAL SYSTEM ──────────────────────────────────────────────────────────
   * Usage: UI.modal.open({ title, body, wide?, onConfirm?, confirmText? })
   *        UI.modal.close()
   */
  modal: {
    _stack: [],

    open({ title, body, wide = false, onConfirm, confirmText = 'Confirm', id } = {}) {
      const modalId = id || ('sx-modal-' + _C.uid());
      const el = document.createElement('div');
      el.id = modalId;
      el.className = 'overlay';
      el.innerHTML = `
        <div class="modal sx-modal-panel" style="max-width:${wide ? '780px' : '520px'};animation:modalIn .2s cubic-bezier(.34,1.56,.64,1)">
          <div class="modal-hd">
            <h3 class="modal-title">${title || ''}</h3>
            <button class="modal-close" onclick="UI.modal.close('${modalId}')">✕</button>
          </div>
          <div class="modal-body sx-modal-body">${body || ''}</div>
          ${onConfirm ? `
            <div class="modal-footer">
              <button class="btn btn-ghost" onclick="UI.modal.close('${modalId}')">Cancel</button>
              <button class="btn btn-gold" id="${modalId}-confirm">${_C.escape(confirmText)}</button>
            </div>` : ''}
        </div>`;

      el.addEventListener('click', e => { if (e.target === el) this.close(modalId); });
      document.body.appendChild(el);
      this._stack.push(modalId);

      if (onConfirm) {
        document.getElementById(`${modalId}-confirm`)?.addEventListener('click', () => {
          onConfirm();
          this.close(modalId);
        });
      }

      // Focus first input
      setTimeout(() => {
        const first = el.querySelector('input:not([type=hidden]),select,textarea');
        first?.focus();
      }, 50);

      return modalId;
    },

    close(id) {
      const el = id ? document.getElementById(id) : document.getElementById(this._stack[this._stack.length - 1]);
      if (!el) return;
      el.style.animation = 'fadeOut .15s ease forwards';
      setTimeout(() => {
        el.remove();
        this._stack = this._stack.filter(s => s !== (id || el.id));
      }, 150);
    },

    closeAll() {
      [...this._stack].forEach(id => this.close(id));
    },

    /* Update only the body of an open modal */
    setBody(id, html) {
      const body = document.querySelector(`#${id} .sx-modal-body`);
      if (body) body.innerHTML = html;
    },
  },

  /* ── BADGE ─────────────────────────────────────────────────────────────────
   * @param {string} text
   * @param {string} type  — 'green'|'red'|'gold'|'blue'|'orange'|'muted'
   * @returns {string} HTML
   */
  badge(text, type = 'muted') {
    const map = { green:'bg', red:'br', gold:'bgold', blue:'bb', orange:'bo', muted:'bm', purple:'bp' };
    return `<span class="badge ${map[type] || 'bm'}">${_C.escape(String(text))}</span>`;
  },

  /* Auto-pick badge color from status string */
  statusBadge(status) {
    const map = {
      'Active':'green','Open':'blue','Draft':'muted','Pending':'orange',
      'Confirmed':'blue','In Progress':'orange','Completed':'green',
      'Cancelled':'red','Overdue':'red','Paid':'green','Unpaid':'red',
      'Partial':'orange','Hot':'red','Warm':'orange','Cold':'muted',
      'Won':'green','Lost':'red','New':'blue','Qualified':'blue',
      'In Stock':'green','Low Stock':'orange','Out of Stock':'red',
    };
    return this.badge(status, map[status] || 'muted');
  },

  /* ── EMPTY STATE ───────────────────────────────────────────────────────────
   * @param {Object} opts - { icon, title, sub, btnLabel?, btnAction? }
   */
  emptyState({ icon, title, sub, btnLabel, btnAction } = {}) {
    return `
      <div class="empty" style="padding:60px 20px;text-align:center">
        <div class="ei" style="font-size:52px;margin-bottom:16px">${icon || '📂'}</div>
        <h3 style="margin-bottom:8px;font-size:17px">${_C.escape(title || 'Nothing here yet')}</h3>
        <p style="color:var(--muted);font-size:14px;max-width:300px;margin:0 auto${btnLabel ? ';margin-bottom:20px' : ''}">${_C.escape(sub || '')}</p>
        ${btnLabel ? `<button class="btn btn-gold" onclick="${btnAction || ''}">${_C.escape(btnLabel)}</button>` : ''}
      </div>`;
  },

  /* ── LOADING SKELETON ──────────────────────────────────────────────────────
   * @param {string} type - 'table'|'cards'|'kpis'|'list'
   * @param {number} count - rows/cards to show
   */
  skeleton(type = 'table', count = 5) {
    const line = (w = '100%', h = '14px') =>
      `<div style="height:${h};width:${w};background:linear-gradient(90deg,var(--surface2) 25%,var(--surface3) 50%,var(--surface2) 75%);background-size:200% 100%;border-radius:6px;animation:shimmer 1.4s infinite"></div>`;

    if (type === 'kpis') {
      return `<div class="kpi-grid">${Array(count).fill(0).map(() => `
        <div class="kpi" style="gap:10px">
          ${line('50%','10px')}
          ${line('70%','28px')}
          ${line('40%','10px')}
        </div>`).join('')}</div>`;
    }

    if (type === 'cards') {
      return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px">${Array(count).fill(0).map(() => `
        <div class="card" style="gap:12px;display:flex;flex-direction:column">
          ${line('60%','12px')}
          ${line('100%','10px')}
          ${line('80%','10px')}
          ${line('40%','10px')}
        </div>`).join('')}</div>`;
    }

    if (type === 'list') {
      return Array(count).fill(0).map(() => `
        <div style="display:flex;gap:14px;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)">
          <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;background:var(--surface3);animation:shimmer 1.4s infinite"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:8px">
            ${line('50%','12px')}
            ${line('70%','10px')}
          </div>
          ${line('80px','12px')}
        </div>`).join('');
    }

    // Default: table
    return `
      <div class="tbl-wrap">
        <div style="padding:12px 16px;border-bottom:1px solid var(--border)">${line('200px','14px')}</div>
        <div class="tbl-scroll">
          <table>
            <thead><tr>${Array(5).fill(0).map(() => `<th>${line('80px','10px')}</th>`).join('')}</tr></thead>
            <tbody>${Array(count).fill(0).map(() => `<tr>${Array(5).fill(0).map((_, i) => `<td>${line(i === 0 ? '140px' : i === 4 ? '60px' : '100px','12px')}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      </div>`;
  },

  /* ── DRAWER (slide-in detail panel) ───────────────────────────────────────
   * @param {Object} opts - { title, body, onClose? }
   */
  drawer: {
    open({ title, body, onClose } = {}) {
      this.close(); // close any existing
      const el = document.createElement('div');
      el.id = 'sx-drawer';
      el.innerHTML = `
        <div id="sx-drawer-overlay" style="position:fixed;inset:0;z-index:499;background:rgba(0,0,0,.5)" onclick="UI.drawer.close()"></div>
        <div id="sx-drawer-panel" style="position:fixed;top:0;right:0;bottom:0;width:min(480px,95vw);z-index:500;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;animation:drawerIn .25s cubic-bezier(.4,0,.2,1);overflow:hidden;box-shadow:-10px 0 40px rgba(0,0,0,.5)">
          <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border);flex-shrink:0">
            <h3 style="font-size:16px;font-weight:700">${title || ''}</h3>
            <button onclick="UI.drawer.close()" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:18px;padding:4px">✕</button>
          </div>
          <div id="sx-drawer-body" style="flex:1;overflow-y:auto;padding:20px">${body || ''}</div>
        </div>`;
      document.body.appendChild(el);
      this._onClose = onClose;

      // Keyboard: Escape to close
      this._escHandler = e => { if (e.key === 'Escape') this.close(); };
      document.addEventListener('keydown', this._escHandler);
    },

    close() {
      const el = document.getElementById('sx-drawer');
      if (!el) return;
      const panel = document.getElementById('sx-drawer-panel');
      if (panel) panel.style.animation = 'drawerOut .2s cubic-bezier(.4,0,.2,1) forwards';
      setTimeout(() => {
        el.remove();
        if (this._onClose) this._onClose();
      }, 200);
      if (this._escHandler) document.removeEventListener('keydown', this._escHandler);
    },

    setBody(html) {
      const body = document.getElementById('sx-drawer-body');
      if (body) body.innerHTML = html;
    },
  },

  /* ── TABS ──────────────────────────────────────────────────────────────────
   * @param {Array} tabs  - [{ id, label, icon? }]
   * @param {string} activeId
   * @param {Function} onSwitch - fn(tabId)
   */
  tabs(tabs, activeId, onSwitch) {
    const fnName = '_tabSwitch_' + _C.uid();
    window[fnName] = (id) => {
      document.querySelectorAll(`[data-tabgroup="${fnName}"]`).forEach(b => {
        b.classList.toggle('active', b.dataset.tabid === id);
      });
      onSwitch(id);
    };
    return `
      <div class="calc-tabs" style="margin-bottom:20px">
        ${tabs.map(t => `
          <button class="ctab ${t.id === activeId ? 'active' : ''}" data-tabgroup="${fnName}" data-tabid="${t.id}" onclick="${fnName}('${t.id}')">
            ${t.icon ? t.icon + ' ' : ''}${_C.escape(t.label)}
          </button>`).join('')}
      </div>`;
  },

  /* ── SEARCH BAR ────────────────────────────────────────────────────────────
   * Returns HTML + registers debounced handler
   * @param {string} placeholder
   * @param {Function} onSearch - fn(query)
   * @param {Object} opts - { id?, delay? }
   */
  searchBar(placeholder, onSearch, opts = {}) {
    const id = opts.id || ('sx-search-' + _C.uid());
    const fnName = '_search_' + id.replace(/-/g, '_');
    let timer;
    window[fnName] = (q) => {
      clearTimeout(timer);
      timer = setTimeout(() => onSearch(q.trim()), opts.delay || 300);
    };
    return `
      <div style="position:relative;display:inline-flex;align-items:center;width:100%;max-width:320px">
        <span style="position:absolute;left:10px;color:var(--muted);font-size:14px;pointer-events:none">🔍</span>
        <input id="${id}" type="text" placeholder="${_C.escape(placeholder || 'Search...')}"
          oninput="${fnName}(this.value)"
          style="width:100%;padding:8px 10px 8px 32px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px;outline:none;transition:.2s"
          onfocus="this.style.borderColor='var(--gold)'" onblur="this.style.borderColor=''"/>
      </div>`;
  },

  /* ── PAGINATION ────────────────────────────────────────────────────────────
   * @param {number} page
   * @param {number} total
   * @param {number} pageSize
   * @param {Function} onChange - fn(newPage)
   */
  pagination(page, total, pageSize, onChange) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return '';
    const fnName = '_paginate_' + _C.uid();
    window[fnName] = onChange;
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);

    // Show max 5 page buttons
    const pages = [];
    let lo = Math.max(1, page - 2), hi = Math.min(totalPages, lo + 4);
    lo = Math.max(1, hi - 4);
    for (let i = lo; i <= hi; i++) pages.push(i);

    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;font-size:12px;color:var(--muted)">
        <span>Showing ${start}–${end} of <strong style="color:var(--text)">${total}</strong></span>
        <div style="display:flex;gap:4px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="${fnName}(${page - 1})" ${page <= 1 ? 'disabled' : ''}>‹</button>
          ${pages.map(p => `<button class="btn ${p === page ? 'btn-gold' : 'btn-ghost'} btn-sm" onclick="${fnName}(${p})">${p}</button>`).join('')}
          <button class="btn btn-ghost btn-sm" onclick="${fnName}(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>›</button>
        </div>
      </div>`;
  },

  /* ── STAT ROW (sparkline-style inline bars) ────────────────────────────────
   * @param {Array} items - [{ label, value, max, color? }]
   */
  statRows(items) {
    return items.map(item => {
      const pct = item.max > 0 ? Math.min(100, (item.value / item.max) * 100).toFixed(1) : 0;
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0;font-size:13px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_C.escape(item.label)}</div>
          <div style="flex:2;height:6px;background:var(--surface3);border-radius:3px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${item.color || 'var(--gold)'};border-radius:3px;transition:width .4s ease"></div>
          </div>
          <div style="font-size:13px;font-weight:700;color:${item.color || 'var(--text)'};min-width:70px;text-align:right">${_C.fmt(item.value)}</div>
        </div>`;
    }).join('');
  },
};

/* Inject component animation CSS once */
(function _injectComponentCSS() {
  if (document.getElementById('sx-component-css')) return;
  const style = document.createElement('style');
  style.id = 'sx-component-css';
  style.textContent = `
    @keyframes shimmer {
      0%   { background-position: 200% 0 }
      100% { background-position: -200% 0 }
    }
    @keyframes modalIn {
      from { opacity:0; transform:scale(.95) translateY(10px) }
      to   { opacity:1; transform:scale(1)  translateY(0) }
    }
    @keyframes fadeOut {
      to { opacity:0 }
    }
    @keyframes drawerIn {
      from { transform:translateX(100%) }
      to   { transform:translateX(0) }
    }
    @keyframes drawerOut {
      to { transform:translateX(100%) }
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 16px 20px;
      border-top: 1px solid var(--border);
      flex-shrink: 0;
    }
    .badge.bgold { background:rgba(37,99,235,.12); color:var(--gold); border:1px solid rgba(37,99,235,.25); }
    .badge.bp    { background:rgba(155,93,229,.12); color:#9b5de5;    border:1px solid rgba(155,93,229,.25); }
  `;
  document.head.appendChild(style);
})();


/* ══════════════════════════════════════════════════════════════════════════════
   2.  FORM VALIDATION SYSTEM
   ══════════════════════════════════════════════════════════════════════════════ */

const FORM = {

  /* Built-in validators */
  validators: {
    required:    v => v !== null && v !== undefined && String(v).trim() !== '',
    email:       v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    phone:       v => /^[0-9\s\-+()]{10,15}$/.test(v),
    gstin:       v => /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v),
    pan:         v => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v),
    positive:    v => Number(v) > 0,
    nonNegative: v => Number(v) >= 0,
    minLen: n => v => String(v).length >= n,
    maxLen: n => v => String(v).length <= n,
    min:    n => v => Number(v) >= n,
    max:    n => v => Number(v) <= n,
    pattern: re => v => re.test(v),
    date:    v => !isNaN(new Date(v).getTime()),
  },

  /**
   * Validate a data object against a schema.
   *
   * Schema format:
   *   { fieldId: { label, rules: [['required','Field is required'], ['email','Invalid email'], ...] } }
   *
   * Built-in rule names: required, email, phone, gstin, pan, positive, nonNegative, date
   * Custom rule:         ['custom', 'Error message', v => boolean]
   *
   * @param {Object} data   - key/value pairs
   * @param {Object} schema - validation schema
   * @returns {Object|null} - null if valid, { fieldId: message } if errors
   */
  validate(data, schema) {
    const errors = {};
    for (const [field, config] of Object.entries(schema)) {
      const value = data[field];
      for (const rule of (config.rules || [])) {
        const [ruleName, message, customFn] = rule;

        // Skip non-required empty fields
        if (ruleName !== 'required' && (value === '' || value === null || value === undefined)) continue;

        let pass = true;
        if (ruleName === 'custom') {
          pass = customFn ? customFn(value, data) : true;
        } else if (typeof this.validators[ruleName] === 'function') {
          const fn = this.validators[ruleName];
          // Handle factory validators (minLen, etc.)
          pass = fn(value);
        } else {
          // Try as factory: e.g. ['minLen', 'Too short', 2]
          const factory = this.validators[ruleName.replace(/[0-9]/g, '')];
          if (factory) {
            const n = parseInt(ruleName.replace(/[^0-9]/g, ''));
            pass = factory(n)(value);
          }
        }

        if (!pass) {
          errors[field] = message || `${config.label || field} is invalid`;
          break;
        }
      }
    }
    return Object.keys(errors).length === 0 ? null : errors;
  },

  /**
   * Bind real-time validation to a form container.
   * Validates on blur for each field, shows errors inline.
   *
   * @param {string|Element} containerOrId - form container
   * @param {Object} schema - validation schema (same as validate())
   * @returns {Function} unbind - call to detach listeners
   */
  bind(containerOrId, schema) {
    const container = typeof containerOrId === 'string'
      ? document.getElementById(containerOrId)
      : containerOrId;
    if (!container) return () => {};

    const handlers = [];

    for (const [field, config] of Object.entries(schema)) {
      const input = container.querySelector(`#${field}, [name="${field}"]`);
      if (!input) continue;

      const onBlur = () => {
        const value = input.value;
        for (const rule of (config.rules || [])) {
          const [ruleName, message, customFn] = rule;
          if (ruleName !== 'required' && !value) break;

          let pass = true;
          if (ruleName === 'custom') {
            pass = customFn ? customFn(value) : true;
          } else {
            const fn = this.validators[ruleName];
            pass = fn ? fn(value) : true;
          }

          if (!pass) {
            this._setFieldError(input, message || `Invalid ${config.label || field}`);
            return;
          }
        }
        this._clearFieldError(input);
      };

      const onInput = () => {
        if (input.dataset.sxError) this._clearFieldError(input);
      };

      input.addEventListener('blur', onBlur);
      input.addEventListener('input', onInput);
      handlers.push({ input, onBlur, onInput });
    }

    return () => handlers.forEach(({ input, onBlur, onInput }) => {
      input.removeEventListener('blur', onBlur);
      input.removeEventListener('input', onInput);
    });
  },

  /**
   * Show errors returned from validate() inline in a form.
   * Looks for an element with id="${fieldId}-err" adjacent to each field.
   * If not found, appends one automatically.
   *
   * @param {Object|null} errors - { fieldId: message }
   * @param {string|Element} [container] - scope to search within
   */
  show(errors, container) {
    const scope = (typeof container === 'string' ? document.getElementById(container) : container) || document;
    // Clear first
    scope.querySelectorAll('.sx-field-err').forEach(el => { el.textContent = ''; el.style.display = 'none'; });
    scope.querySelectorAll('[data-sx-error]').forEach(el => {
      el.style.borderColor = '';
      delete el.dataset.sxError;
    });

    if (!errors) return;

    for (const [field, message] of Object.entries(errors)) {
      const input = scope.querySelector(`#${field}, [name="${field}"]`);
      if (input) this._setFieldError(input, message);
    }

    // Scroll first error into view
    const firstErr = scope.querySelector('[data-sx-error]');
    firstErr?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  },

  /** Clear all errors in a container */
  clear(container) {
    this.show(null, container);
  },

  /**
   * Serialize all named/id'd inputs in a form container.
   * @param {string|Element} container
   * @param {Array} [fields] - if provided, only extract these field ids
   * @returns {Object}
   */
  serialize(container, fields) {
    const scope = typeof container === 'string' ? document.getElementById(container) : container;
    if (!scope) return {};
    const result = {};
    const inputs = scope.querySelectorAll('input,select,textarea');
    inputs.forEach(el => {
      const key = el.id || el.name;
      if (!key || key.startsWith('_') || el.type === 'hidden' && !el.dataset.include) return;
      if (fields && !fields.includes(key)) return;
      if (el.type === 'checkbox') result[key] = el.checked;
      else if (el.type === 'number') result[key] = el.value === '' ? '' : Number(el.value);
      else result[key] = el.value;
    });
    return result;
  },

  /* Internal: set field error */
  _setFieldError(input, message) {
    input.style.borderColor = 'var(--red)';
    input.dataset.sxError = '1';

    const errId = (input.id || input.name) + '-err';
    let errEl = document.getElementById(errId) || input.parentNode?.querySelector('.sx-field-err');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.id = errId;
      errEl.className = 'sx-field-err';
      errEl.style.cssText = 'color:var(--red);font-size:11px;font-weight:600;margin-top:4px';
      input.parentNode?.appendChild(errEl);
    }
    errEl.textContent = message;
    errEl.style.display = 'block';
  },

  /* Internal: clear field error */
  _clearFieldError(input) {
    input.style.borderColor = '';
    delete input.dataset.sxError;
    const errId = (input.id || input.name) + '-err';
    const errEl = document.getElementById(errId) || input.parentNode?.querySelector('.sx-field-err');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   3.  CHART ENGINE  (Chart.js wrapper with auto-CDN load)
   ══════════════════════════════════════════════════════════════════════════════ */

const CHARTS = (() => {
  const _instances = {}; // canvasId → Chart instance

  /* Load Chart.js from CDN if not already loaded */
  function _ensureChartJS(callback) {
    if (typeof Chart !== 'undefined') { callback(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js';
    script.onload = callback;
    script.onerror = () => console.warn('[CHARTS] Failed to load Chart.js from CDN');
    document.head.appendChild(script);
  }

  /* Shared chart defaults */
  function _defaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: _C.colors.text,
            font: { family: "'Inter', sans-serif", size: 11 },
            boxWidth: 12,
            padding: 16,
          }
        },
        tooltip: {
          backgroundColor: '#F8FAFC',
          borderColor: 'rgba(37,99,235,.25)',
          borderWidth: 1,
          titleColor: '#eef2fa',
          bodyColor: _C.colors.text,
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => ' ' + _C.sym() + ctx.parsed.y?.toLocaleString('en-IN') || ctx.parsed.toString(),
          }
        }
      },
      scales: {
        x: {
          grid: { color: _C.colors.grid, drawBorder: false },
          ticks: { color: _C.colors.text, font: { size: 11 } }
        },
        y: {
          grid: { color: _C.colors.grid, drawBorder: false },
          ticks: {
            color: _C.colors.text,
            font: { size: 11 },
            callback: v => _C.sym() + v.toLocaleString('en-IN'),
          }
        }
      }
    };
  }

  /**
   * Destroy a chart instance (call before re-rendering).
   */
  function destroy(canvasId) {
    if (_instances[canvasId]) {
      try { _instances[canvasId].destroy(); } catch(e) {}
      delete _instances[canvasId];
    }
  }

  /**
   * Line / Area chart.
   * @param {string} canvasId  - id of <canvas> element
   * @param {Object} data      - { labels:[], datasets:[{label, data:[], color?}] }
   * @param {Object} [opts]    - { area?, yLabel? }
   */
  function line(canvasId, data, opts = {}) {
    destroy(canvasId);
    _ensureChartJS(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      const datasets = data.datasets.map((ds, i) => {
        const color = ds.color || _C.palette[i % _C.palette.length];
        return {
          label: ds.label,
          data: ds.data,
          borderColor: color,
          backgroundColor: opts.area !== false
            ? `${color}18`
            : 'transparent',
          fill: opts.area !== false,
          tension: 0.4,
          pointRadius: 3,
          pointHoverRadius: 6,
          borderWidth: 2,
          pointBackgroundColor: color,
        };
      });

      const cfg = _defaults();
      if (opts.yLabel) cfg.scales.y.title = { display: true, text: opts.yLabel, color: _C.colors.text, font: { size: 11 } };

      _instances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: data.labels, datasets },
        options: cfg,
      });
    });
  }

  /**
   * Bar chart.
   * @param {string} canvasId
   * @param {Object} data  - { labels:[], datasets:[{label, data:[], color?}] }
   * @param {Object} [opts] - { stacked?, horizontal? }
   */
  function bar(canvasId, data, opts = {}) {
    destroy(canvasId);
    _ensureChartJS(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      const datasets = data.datasets.map((ds, i) => ({
        label: ds.label,
        data: ds.data,
        backgroundColor: (ds.color || _C.palette[i % _C.palette.length]) + 'cc',
        borderColor: ds.color || _C.palette[i % _C.palette.length],
        borderWidth: 1,
        borderRadius: 5,
        borderSkipped: false,
      }));

      const cfg = _defaults();
      if (opts.stacked) {
        cfg.scales.x.stacked = true;
        cfg.scales.y.stacked = true;
      }
      if (opts.horizontal) {
        cfg.indexAxis = 'y';
        cfg.scales.x.ticks.callback = v => _C.sym() + v.toLocaleString('en-IN');
        delete cfg.scales.y.ticks.callback;
      }

      _instances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: data.labels, datasets },
        options: cfg,
      });
    });
  }

  /**
   * Donut / Pie chart.
   * @param {string} canvasId
   * @param {Object} data  - { labels:[], values:[], colors?:[] }
   * @param {Object} [opts] - { type?: 'doughnut'|'pie', cutout? }
   */
  function donut(canvasId, data, opts = {}) {
    destroy(canvasId);
    _ensureChartJS(() => {
      const canvas = document.getElementById(canvasId);
      if (!canvas) return;

      const colors = data.colors || _C.palette;

      const cfg = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: opts.cutout || (opts.type === 'pie' ? 0 : '65%'),
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: _C.colors.text,
              font: { family: "'Inter', sans-serif", size: 11 },
              boxWidth: 12,
              padding: 14,
            }
          },
          tooltip: {
            backgroundColor: '#F8FAFC',
            borderColor: 'rgba(37,99,235,.25)',
            borderWidth: 1,
            titleColor: '#eef2fa',
            bodyColor: _C.colors.text,
            padding: 12,
            cornerRadius: 10,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${_C.sym()}${ctx.parsed.toLocaleString('en-IN')}`,
            }
          }
        }
      };

      _instances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: opts.type === 'pie' ? 'pie' : 'doughnut',
        data: {
          labels: data.labels,
          datasets: [{
            data: data.values,
            backgroundColor: colors.map(c => c + 'cc'),
            borderColor: colors,
            borderWidth: 2,
            hoverOffset: 8,
          }]
        },
        options: cfg,
      });
    });
  }

  /**
   * Mini inline bar (CSS only — no canvas needed).
   * @param {number} value
   * @param {number} max
   * @param {string} [color]
   * @returns {string} HTML
   */
  function miniBar(value, max, color = 'var(--gold)') {
    const pct = max > 0 ? Math.min(100, (value / max) * 100).toFixed(1) : 0;
    return `<div style="height:5px;background:var(--surface3);border-radius:3px;overflow:hidden;min-width:60px">
      <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;transition:width .4s ease"></div>
    </div>`;
  }

  return { line, bar, donut, miniBar, destroy };
})();


/* ══════════════════════════════════════════════════════════════════════════════
   4.  BUSINESS INTELLIGENCE DASHBOARD
   ══════════════════════════════════════════════════════════════════════════════ */

const DASHBOARD = {

  /**
   * Render the full BI dashboard into #sectionContent.
   * Replaces the existing vertical dashboard routing.
   * Called by APP._renderVerticalDashboard() via patch below.
   */
  render() {
    const content = document.getElementById('sectionContent');
    if (!content) return;

    // Show skeleton instantly
    content.innerHTML = `
      <div class="sec" id="sx-dashboard">
        ${UI.skeleton('kpis', 4)}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
          ${UI.skeleton('table', 4)}
          ${UI.skeleton('cards', 3)}
        </div>
      </div>`;

    // Load data async (simulated — actually synchronous but deferred to next tick
    // so skeleton renders first, then real data replaces it)
    requestAnimationFrame(() => {
      // Guard: if user navigated away before rAF fired, #sx-dashboard is gone — abort
      if (!document.getElementById('sx-dashboard')) return;
      try {
        this._renderContent();
      } catch (e) {
        console.error('[DASHBOARD] render error:', e);
        const c = document.getElementById('sectionContent');
        if (c) c.innerHTML = `<div class="sec"><div style="padding:40px;text-align:center;color:var(--muted)">
          <div style="font-size:40px;margin-bottom:16px">⚠️</div>
          <p>Dashboard failed to load. <button class="btn btn-ghost btn-sm" onclick="APP.navigate('dashboard')">Retry</button></p>
        </div></div>`;
      }
    });
  },

  _renderContent() {
    // ── Gather data ──────────────────────────────────────────────────────────
    const settings = STRATIX_DB.getSettings();
    const sym = settings.currencySymbol || '₹';
    const session = STRATIX_AUTH.getSession();
    const vertical = (typeof VERTICAL !== 'undefined') ? VERTICAL.current() : null;

    const txns = STRATIX_DB.getArr('transactions');
    const invoices = STRATIX_DB.getArr('invoices');
    const inventory = STRATIX_DB.getArr('erpInventory');
    const trips = STRATIX_DB.getArr('trips');
    const reminders = STRATIX_DB.getArr('reminders');
    const clients = STRATIX_DB.getArr('clients');
    const salesOrders = STRATIX_DB.getArr('erpSalesOrders');

    // ── P&L from transactions ────────────────────────────────────────────────
    const now = new Date();
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const lastMonthKey = (() => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; })();

    const thisMonthTxns = txns.filter(t => (t.date||'').startsWith(thisMonthKey));
    const lastMonthTxns = txns.filter(t => (t.date||'').startsWith(lastMonthKey));

    const calcPnL = ts => ({
      revenue: ts.filter(t=>t.type==='revenue').reduce((s,t)=>s+(t.amount||0),0),
      expense: ts.filter(t=>t.type==='expense').reduce((s,t)=>s+(t.amount||0),0),
    });

    const current = calcPnL(thisMonthTxns);
    const last    = calcPnL(lastMonthTxns);
    const all     = calcPnL(txns);

    const profit  = all.revenue - all.expense;
    const margin  = all.revenue > 0 ? ((profit / all.revenue) * 100).toFixed(1) : 0;

    // Revenue trend (last 6 months)
    const revenueByMonth = {};
    const expenseByMonth = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short' });
      revenueByMonth[key] = { label, revenue: 0, expense: 0 };
    }
    txns.forEach(t => {
      const key = (t.date || '').substring(0, 7);
      if (revenueByMonth[key]) {
        if (t.type === 'revenue') revenueByMonth[key].revenue += (t.amount || 0);
        else revenueByMonth[key].expense += (t.amount || 0);
      }
    });
    const chartMonths = Object.values(revenueByMonth);

    // Expense breakdown by category
    const expByCategory = {};
    txns.filter(t => t.type === 'expense').forEach(t => {
      const cat = t.category || 'other';
      expByCategory[cat] = (expByCategory[cat] || 0) + (t.amount || 0);
    });
    const topExpCategories = Object.entries(expByCategory).sort((a,b) => b[1]-a[1]).slice(0, 5);
    const maxCatExp = topExpCategories[0]?.[1] || 1;

    // Receivables
    const totalReceivable = [
      ...invoices.filter(inv => ['Unpaid','Partial','Overdue'].includes(inv.status))
        .map(inv => inv.totalAmount - (inv.paidAmount || 0)),
      ...clients.filter(c => (c.outstanding || 0) > 0).map(c => c.outstanding),
      ...salesOrders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').map(o => o.totalAmt || 0),
    ].reduce((s, v) => s + v, 0) / (invoices.length > 0 || salesOrders.length > 0 ? 1 : Math.max(1, clients.filter(c=>c.outstanding>0).length > 0 ? 1 : 0));

    // Actually compute it properly
    const receivable = invoices.filter(inv => ['Unpaid','Partial','Overdue'].includes(inv.status)).reduce((s, inv) => s + (inv.totalAmount - (inv.paidAmount||0)), 0)
      + clients.filter(c => (c.outstanding||0)>0 && !invoices.length).reduce((s,c) => s + c.outstanding, 0);

    // Top customers
    const customerRevenue = {};
    txns.filter(t => t.type === 'revenue').forEach(t => {
      const name = t.description?.split(' — ')?.[1] || t.description?.split(': ')?.[1] || 'Direct';
      customerRevenue[name] = (customerRevenue[name] || 0) + (t.amount || 0);
    });
    const topCustomers = Object.entries(customerRevenue).sort((a,b) => b[1]-a[1]).slice(0, 5);

    // Low stock
    const lowStockItems = inventory.filter(i => (i.qty||0) <= (i.reorderQty||5));

    // Overdue reminders
    const today = _C.today();
    const overdueReminders = reminders.filter(r => !r.done && r.date && r.date <= today);

    // Revenue trend % vs last month
    const revTrend = last.revenue > 0 ? (((current.revenue - last.revenue) / last.revenue) * 100) : null;
    const expTrend = last.expense > 0 ? (((current.expense - last.expense) / last.expense) * 100) : null;

    // Greet
    const h = now.getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';

    // ── Render ───────────────────────────────────────────────────────────────
    const vBanner = (typeof VERTICAL !== 'undefined') ? VERTICAL.bannerHTML() : '';
    const bizName = session?.biz || settings.businessName || 'Your Business';

    document.getElementById('sectionContent').innerHTML = `
      <div class="sec" id="sx-dashboard">

        <!-- Header -->
        <div class="sec-head" style="margin-bottom:20px">
          <div>
            <h1 class="sec-title" style="font-size:20px">${greet}, ${_C.escape(session?.name?.split(' ')[0] || 'there')} 👋</h1>
            <p class="sec-sub">${_C.escape(bizName)} &middot; ${new Date().toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            ${overdueReminders.length > 0 ? `<button class="btn btn-ghost btn-sm" onclick="APP.navigate('reminders')" style="color:var(--orange)">🔔 ${overdueReminders.length} Due</button>` : ''}
            <button class="btn btn-gold btn-sm" onclick="APP.navigate('datamanager')">+ Add Entry</button>
          </div>
        </div>

        ${vBanner}

        <!-- KPI Row -->
        <div class="kpi-grid" id="sx-dashboard-kpis" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi accent">
            <div class="kpi-lbl">${vertical?.kpiLabels?.revenue || 'Total Revenue'}</div>
            <div class="kpi-val green" id="sx-kpi-revenue">${_C.fmt(all.revenue)}</div>
            ${revTrend !== null ? `<div class="kpi-trend ${revTrend >= 0 ? 'up' : 'down'}">${revTrend >= 0 ? '▲' : '▼'} ${Math.abs(revTrend).toFixed(1)}% vs last month</div>` : ''}
            <div class="kpi-ico">💰</div>
          </div>
          <div class="kpi">
            <div class="kpi-lbl">${vertical?.kpiLabels?.expense || 'Total Expenses'}</div>
            <div class="kpi-val red" id="sx-kpi-expenses">${_C.fmt(all.expense)}</div>
            ${expTrend !== null ? `<div class="kpi-trend ${expTrend <= 0 ? 'up' : 'down'}">${expTrend <= 0 ? '▼' : '▲'} ${Math.abs(expTrend).toFixed(1)}% vs last month</div>` : ''}
            <div class="kpi-ico">📤</div>
          </div>
          <div class="kpi">
            <div class="kpi-lbl">${vertical?.kpiLabels?.profit || 'Net Profit'}</div>
            <div class="kpi-val ${profit >= 0 ? 'green' : 'red'}" id="sx-kpi-profit">${_C.fmt(profit)}</div>
            <div class="kpi-trend ${profit >= 0 ? 'up' : 'down'}" style="font-size:10px">${margin}% margin</div>
            <div class="kpi-ico">📊</div>
          </div>
          <div class="kpi">
            <div class="kpi-lbl">${vertical?.kpiLabels?.pending || 'Outstanding'}</div>
            <div class="kpi-val gold" id="sx-kpi-receivable">${_C.fmt(receivable || clients.reduce((s,c)=>s+(c.outstanding||0),0))}</div>
            ${lowStockItems.length > 0 ? `<div class="kpi-trend down" style="font-size:10px">⚠️ ${lowStockItems.length} low stock</div>` : ''}
            <div class="kpi-ico" id="sx-inv-lowstock-badge">📦</div>
          </div>
        </div>

        <!-- Charts Row -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:20px">
          <!-- Revenue vs Expense trend -->
          <div class="card">
            <div class="card-title" style="margin-bottom:16px">📈 Revenue vs Expenses — Last 6 Months</div>
            <div style="height:220px;position:relative">
              <canvas id="sx-chart-trend"></canvas>
            </div>
          </div>
          <!-- Expense breakdown donut -->
          <div class="card">
            <div class="card-title" style="margin-bottom:16px">💸 Expense Breakdown</div>
            ${topExpCategories.length > 0 ? `
              <div style="height:220px;position:relative">
                <canvas id="sx-chart-expenses"></canvas>
              </div>` : UI.emptyState({ icon: '💸', title: 'No expenses yet', sub: 'Add expense entries to see breakdown' })}
          </div>
        </div>

        <!-- Bottom Row: Recent Transactions + Top Customers + Alerts -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">

          <!-- Recent Transactions -->
          <div class="card" style="overflow:hidden">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
              <div class="card-title" style="margin:0">🕐 Recent Transactions</div>
              <button class="btn btn-ghost btn-sm" onclick="APP.navigate('datamanager')">View All →</button>
            </div>
            ${txns.length === 0
              ? UI.emptyState({ icon: '📒', title: 'No transactions', sub: 'Start adding income & expenses', btnLabel: '+ Add Entry', btnAction: "APP.navigate('datamanager')" })
              : `<div>
                  ${txns.slice().reverse().slice(0, 8).map(t => `
                    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
                      <div style="width:32px;height:32px;border-radius:9px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:14px;background:${t.type==='revenue'?'rgba(0,214,143,.1)':'rgba(255,77,77,.1)'}">
                        ${t.type === 'revenue' ? '💚' : '🔴'}
                      </div>
                      <div style="flex:1;min-width:0">
                        <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_C.escape(t.description || t.category || '—')}</div>
                        <div style="font-size:11px;color:var(--muted)">${t.date || t.createdAt?.split('T')[0] || '—'}</div>
                      </div>
                      <div style="font-size:13px;font-weight:700;color:${t.type==='revenue'?'var(--green)':'var(--red)'}">
                        ${t.type === 'expense' ? '-' : '+'}${_C.fmt(t.amount)}
                      </div>
                    </div>`).join('')}
                </div>`}
          </div>

          <!-- Right column: Top Customers + Alerts stacked -->
          <div style="display:flex;flex-direction:column;gap:16px">

            <!-- Top Customers -->
            <div class="card">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
                <div class="card-title" style="margin:0">🏆 Top Revenue Sources</div>
                <button class="btn btn-ghost btn-sm" onclick="APP.navigate('crm')">CRM →</button>
              </div>
              ${topCustomers.length === 0
                ? `<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0">No revenue data yet</div>`
                : `<div>${topCustomers.map(([name, amount], i) => `
                    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
                      <div style="width:22px;height:22px;border-radius:6px;background:${_C.palette[i] + '22'};color:${_C.palette[i]};font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>
                      <div style="flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_C.escape(name)}</div>
                      <div style="font-size:13px;font-weight:700;color:var(--gold)">${_C.fmt(amount)}</div>
                    </div>`).join('')}</div>`}
            </div>

            <!-- Smart Alerts -->
            ${this._renderAlerts(lowStockItems, overdueReminders, clients)}
          </div>
        </div>

        <!-- Quick Actions -->
        ${(typeof VERTICAL !== 'undefined') ? VERTICAL.quickActionsHTML() : ''}

      </div>`;

    // Render charts after DOM is ready
    requestAnimationFrame(() => this._renderCharts(chartMonths, topExpCategories));
  },

  _renderAlerts(lowStockItems, overdueReminders, clients) {
    const alerts = [];

    lowStockItems.slice(0, 3).forEach(item => {
      alerts.push({
        icon: '📦',
        color: 'var(--orange)',
        bg: 'rgba(255,124,64,.08)',
        text: `<strong>${_C.escape(item.name)}</strong> — only ${item.qty} left`,
        action: "APP.navigate('erp')",
        actionLabel: 'View Stock',
      });
    });

    overdueReminders.slice(0, 2).forEach(r => {
      alerts.push({
        icon: '🔔',
        color: 'var(--red)',
        bg: 'rgba(255,77,77,.08)',
        text: `<strong>${_C.escape(r.title)}</strong> — due ${r.date}`,
        action: "APP.navigate('reminders')",
        actionLabel: 'View',
      });
    });

    const highRiskClients = clients.filter(c => (c.outstanding||0) > 100000).slice(0, 2);
    highRiskClients.forEach(c => {
      alerts.push({
        icon: '💰',
        color: 'var(--gold)',
        bg: 'rgba(37,99,235,.08)',
        text: `<strong>${_C.escape(c.name)}</strong> — ${_C.fmt(c.outstanding)} outstanding`,
        action: "APP.navigate('invoiceaging')",
        actionLabel: 'Collect',
      });
    });

    if (alerts.length === 0) {
      return `<div class="card" style="text-align:center;padding:24px">
        <div style="font-size:28px;margin-bottom:8px">✅</div>
        <div style="font-size:13px;color:var(--muted)">All clear — no urgent alerts</div>
      </div>`;
    }

    return `
      <div class="card" style="overflow:hidden">
        <div class="card-title" style="margin-bottom:14px">⚡ Smart Alerts (${alerts.length})</div>
        ${alerts.map(a => `
          <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:${a.bg};border-radius:8px;margin-bottom:6px">
            <span style="font-size:16px;flex-shrink:0">${a.icon}</span>
            <div style="flex:1;font-size:12px;color:${a.color};line-height:1.5">${a.text}</div>
            <button class="btn btn-ghost btn-sm" onclick="${a.action}" style="font-size:11px;white-space:nowrap">${a.actionLabel}</button>
          </div>`).join('')}
      </div>`;
  },

  _renderCharts(chartMonths, topExpCategories) {
    // Line chart: Revenue vs Expenses
    CHARTS.line('sx-chart-trend', {
      labels: chartMonths.map(m => m.label),
      datasets: [
        { label: 'Revenue', data: chartMonths.map(m => m.revenue), color: _C.colors.revenue },
        { label: 'Expenses', data: chartMonths.map(m => m.expense), color: _C.colors.expense },
      ]
    }, { area: true });

    // Donut: Expense breakdown
    if (topExpCategories.length > 0) {
      CHARTS.donut('sx-chart-expenses', {
        labels: topExpCategories.map(([k]) => k),
        values: topExpCategories.map(([, v]) => v),
        colors: _C.palette,
      });
    }
  },

  /**
   * Partially refresh KPI values without full re-render.
   * Called by STRATIX_REACTIVE on finance:changed events.
   */
  refresh() {
    const el = document.getElementById('sx-dashboard-kpis');
    if (!el) return;

    try {
      const txns = STRATIX_DB.getArr('transactions');
      const revenue = txns.filter(t => t.type === 'revenue').reduce((s, t) => s + (t.amount||0), 0);
      const expense = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount||0), 0);
      const profit = revenue - expense;
      const clients = STRATIX_DB.getArr('clients');
      const receivable = clients.reduce((s, c) => s + (c.outstanding||0), 0);

      const fade = (id, val) => {
        const el = document.getElementById(id);
        if (!el || el.textContent === val) return;
        el.style.opacity = '0.3';
        el.style.transition = 'opacity .15s';
        setTimeout(() => { el.textContent = val; el.style.opacity = '1'; }, 120);
      };

      fade('sx-kpi-revenue', _C.fmt(revenue));
      fade('sx-kpi-expenses', _C.fmt(expense));
      fade('sx-kpi-profit', _C.fmt(profit));
      fade('sx-kpi-receivable', _C.fmt(receivable));
    } catch(e) {}
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   5.  WIRING — Patch APP._renderVerticalDashboard to use DASHBOARD.render()
   ══════════════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Subscribe DASHBOARD.refresh() to finance events
  if (typeof STRATIX_BUS !== 'undefined') {
    STRATIX_BUS.on('finance:changed', () => DASHBOARD.refresh());
    STRATIX_BUS.on('dashboard:refresh', () => DASHBOARD.refresh());
  }

  // Patch APP to use new dashboard
  if (typeof APP !== 'undefined') {
    APP._renderVerticalDashboard = () => DASHBOARD.render();
  }

  // Keyboard shortcut: Escape closes modals/drawer
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      UI.modal.close();
      UI.drawer.close();
    }
  });

  console.info('[STRATIX] components.js v1.0 loaded — UI components, Chart engine, DASHBOARD, and FORM validation active.');
});
