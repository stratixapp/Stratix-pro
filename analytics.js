/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  STRATIX  —  analytics.js  v1.0  (Round 4)                                ║
 * ║                                                                             ║
 * ║  DROP-IN: <script src="analytics.js"></script> after upgrades.js           ║
 * ║                                                                             ║
 * ║  1. ANALYTICS SECTION  — Real Chart.js replacing CSS bars                  ║
 * ║     12-month revenue/expense line, profit area, expense donut,             ║
 * ║     top customers bar, date range filter, CSV export                       ║
 * ║                                                                             ║
 * ║  2. VERTICAL CHART UPGRADES — transport/retail/factory CSS bars → Canvas   ║
 * ║     Injected after each vertical dashboard renders via MutationObserver    ║
 * ║                                                                             ║
 * ║  3. API LAYER — STRATIX_API fetch abstraction                              ║
 * ║     Retry logic, timeout, Firebase-ready interface                         ║
 * ║     Patches AI.sendMessage() to use STRATIX_API                            ║
 * ║                                                                             ║
 * ║  4. MULTI-TENANT GROUNDWORK — TENANT helpers                               ║
 * ║     TENANT.currentId(), TENANT.list(), TENANT.context()                    ║
 * ║                                                                             ║
 * ║  5. CUSTOMER PROFILE DRAWER — CRM contacts get slide-in profile            ║
 * ║     Total business, invoice history, outstanding, quick actions            ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   SHARED HELPERS
   ══════════════════════════════════════════════════════════════════════════════ */
const _A = {
  sym: () => (STRATIX_DB.getSettings().currencySymbol || '₹'),
  fmt(n) {
    const s = _A.sym();
    n = Math.abs(Number(n) || 0);
    if (n >= 1e7) return s + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return s + (n / 1e5).toFixed(2) + ' L';
    if (n >= 1e3) return s + (n / 1e3).toFixed(1) + 'K';
    return s + Math.round(n).toLocaleString('en-IN');
  },
  // Get last N months as [{key:'YYYY-MM', label:'Jan'}]
  lastMonths(n) {
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      result.push({
        key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('en-IN', { month: 'short' }) + ' ' + String(d.getFullYear()).slice(2),
      });
    }
    return result;
  },
  txnsByRange(txns, range) {
    const now   = new Date();
    const cutoff = new Date();
    if (range === '1m')  cutoff.setMonth(now.getMonth() - 1);
    else if (range === '3m') cutoff.setMonth(now.getMonth() - 3);
    else if (range === '6m') cutoff.setMonth(now.getMonth() - 6);
    else if (range === '1y') cutoff.setFullYear(now.getFullYear() - 1);
    else return txns; // 'all'
    return txns.filter(t => new Date(t.date || t.createdAt) >= cutoff);
  },
  palette: ['#2563EB','#4f9ef0','#00d68f','#9b5de5','#ff7c40','#00c8e0','#ff4d4d','#a3e635'],
};


/* ══════════════════════════════════════════════════════════════════════════════
   1. FULL ANALYTICS SECTION
   ══════════════════════════════════════════════════════════════════════════════ */

const ANALYTICS = {

  _range: '6m',

  render(range) {
    if (range) this._range = range;
    const content = document.getElementById('sectionContent');
    if (!content) return;

    const allTxns = STRATIX_DB.getArr('transactions');
    const txns    = _A.txnsByRange(allTxns, this._range);
    const sym     = _A.sym();

    const revenue  = txns.filter(t => t.type === 'revenue').reduce((s, t) => s + (t.amount || 0), 0);
    const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    const profit   = revenue - expenses;
    const margin   = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

    // Month-over-month for selected range
    const months = this._range === '1m' ? _A.lastMonths(4)
                 : this._range === '3m' ? _A.lastMonths(3)
                 : this._range === '1y' ? _A.lastMonths(12)
                 : _A.lastMonths(6);

    months.forEach(m => {
      m.revenue  = txns.filter(t => t.type === 'revenue'  && (t.date || '').startsWith(m.key)).reduce((s, t) => s + (t.amount || 0), 0);
      m.expenses = txns.filter(t => t.type === 'expense'  && (t.date || '').startsWith(m.key)).reduce((s, t) => s + (t.amount || 0), 0);
      m.profit   = m.revenue - m.expenses;
    });

    // Expense by category
    const expByCat = {};
    txns.filter(t => t.type === 'expense').forEach(t => {
      const c = t.category || 'other';
      expByCat[c] = (expByCat[c] || 0) + (t.amount || 0);
    });
    const topCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Revenue by customer/source
    const revBySrc = {};
    txns.filter(t => t.type === 'revenue').forEach(t => {
      const src = (t.description || '').split(' — ')[1]
               || (t.description || '').split(': ')[1]
               || t.category || 'Direct';
      revBySrc[src] = (revBySrc[src] || 0) + (t.amount || 0);
    });
    const topSrc = Object.entries(revBySrc).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Trend delta (last month vs prev month)
    const lastM  = months[months.length - 1];
    const prevM  = months[months.length - 2];
    const revDelta = prevM?.revenue > 0 ? (((lastM?.revenue - prevM.revenue) / prevM.revenue) * 100).toFixed(1) : null;

    const ranges = [
      { id: '1m', label: '1 Month' },
      { id: '3m', label: '3 Months' },
      { id: '6m', label: '6 Months' },
      { id: '1y', label: '1 Year' },
      { id: 'all', label: 'All Time' },
    ];

    content.innerHTML = `
      <div class="sec" id="sx-analytics">
        <!-- Header -->
        <div class="sec-head" style="margin-bottom:20px">
          <div>
            <h1 class="sec-title">📊 Analytics</h1>
            <p class="sec-sub">Business performance intelligence</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <div style="display:flex;background:var(--surface2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
              ${ranges.map(r => `
                <button onclick="ANALYTICS.render('${r.id}')"
                  style="padding:7px 13px;border:none;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:600;transition:.15s;${this._range === r.id ? 'background:var(--gold);color:#F8FAFC;' : 'background:transparent;color:var(--muted);'}"
                  onmouseover="if('${r.id}'!=='${this._range}')this.style.color='var(--text)'"
                  onmouseout="if('${r.id}'!=='${this._range}')this.style.color='var(--muted)'">${r.label}</button>`
              ).join('')}
            </div>
            <button class="btn btn-ghost btn-sm" onclick="ANALYTICS.exportCSV()">⬇ Export CSV</button>
          </div>
        </div>

        <!-- KPIs -->
        <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
          <div class="kpi accent">
            <div class="kpi-lbl">Revenue</div>
            <div class="kpi-val green">${_A.fmt(revenue)}</div>
            ${revDelta !== null ? `<div class="kpi-trend ${Number(revDelta) >= 0 ? 'up' : 'down'}">${Number(revDelta) >= 0 ? '▲' : '▼'} ${Math.abs(revDelta)}% MoM</div>` : ''}
            <div class="kpi-ico">💰</div>
          </div>
          <div class="kpi">
            <div class="kpi-lbl">Expenses</div>
            <div class="kpi-val red">${_A.fmt(expenses)}</div>
            <div class="kpi-ico">📤</div>
          </div>
          <div class="kpi">
            <div class="kpi-lbl">Net Profit</div>
            <div class="kpi-val ${profit >= 0 ? 'green' : 'red'}">${_A.fmt(profit)}</div>
            <div class="kpi-trend ${profit >= 0 ? 'up' : 'down'}" style="font-size:10px">${margin}% margin</div>
            <div class="kpi-ico">📈</div>
          </div>
          <div class="kpi">
            <div class="kpi-lbl">Transactions</div>
            <div class="kpi-val">${txns.length}</div>
            <div class="kpi-trend up" style="font-size:10px">${allTxns.length} total</div>
            <div class="kpi-ico">🗂️</div>
          </div>
        </div>

        <!-- Charts Row 1: Trend + Profit -->
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px">
          <div class="card">
            <div class="card-title" style="margin-bottom:16px">📈 Revenue vs Expenses</div>
            <div style="height:200px;position:relative"><canvas id="sx-an-trend"></canvas></div>
          </div>
          <div class="card">
            <div class="card-title" style="margin-bottom:16px">💸 Expense Breakdown</div>
            ${topCats.length > 0
              ? `<div style="height:200px;position:relative"><canvas id="sx-an-donut"></canvas></div>`
              : `<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--muted);font-size:13px">No expenses recorded</div>`}
          </div>
        </div>

        <!-- Charts Row 2: Profit + Top Sources -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <div class="card">
            <div class="card-title" style="margin-bottom:16px">📊 Monthly Profit Trend</div>
            <div style="height:180px;position:relative"><canvas id="sx-an-profit"></canvas></div>
          </div>
          <div class="card">
            <div class="card-title" style="margin-bottom:16px">🏆 Top Revenue Sources</div>
            ${topSrc.length > 0
              ? `<div style="height:180px;position:relative"><canvas id="sx-an-sources"></canvas></div>`
              : `<div style="display:flex;align-items:center;justify-content:center;height:180px;color:var(--muted);font-size:13px">No revenue data yet</div>`}
          </div>
        </div>

        <!-- Category Detail Table -->
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div class="card-title" style="margin:0">📋 Expense Detail by Category</div>
          </div>
          ${topCats.length === 0
            ? `<div style="text-align:center;padding:24px;color:var(--muted);font-size:13px">No expense data in this period</div>`
            : `<div>${topCats.map(([cat, amt]) => {
                const pct = expenses > 0 ? ((amt / expenses) * 100).toFixed(1) : 0;
                return `
                <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
                  <div style="width:120px;font-size:13px;color:var(--text2);flex-shrink:0">${escapeHTML(cat)}</div>
                  <div style="flex:1;height:6px;background:var(--surface3);border-radius:3px;overflow:hidden">
                    <div style="width:${pct}%;height:100%;background:var(--gold);border-radius:3px;transition:width .6s ease"></div>
                  </div>
                  <div style="font-size:12px;color:var(--muted);width:40px;text-align:right">${pct}%</div>
                  <div style="font-size:13px;font-weight:700;color:var(--text);min-width:80px;text-align:right">${_A.fmt(amt)}</div>
                  <button class="btn btn-ghost btn-sm" onclick="ANALYTICS.filterByCategory('${escapeHTML(cat)}')" style="font-size:11px">View →</button>
                </div>`;
              }).join('')}</div>`}
        </div>

        <!-- Filtered transaction view -->
        <div id="sx-an-filtered"></div>
      </div>`;

    // Render Chart.js charts after DOM ready
    requestAnimationFrame(() => this._renderCharts(months, topCats, topSrc));
  },

  _renderCharts(months, topCats, topSrc) {
    if (typeof CHARTS === 'undefined') return;

    // Revenue vs Expenses line
    CHARTS.line('sx-an-trend', {
      labels: months.map(m => m.label),
      datasets: [
        { label: 'Revenue',  data: months.map(m => m.revenue),  color: '#00d68f' },
        { label: 'Expenses', data: months.map(m => m.expenses), color: '#ff4d4d' },
      ],
    }, { area: true });

    // Expense donut
    if (topCats.length > 0) {
      CHARTS.donut('sx-an-donut', {
        labels: topCats.map(([k]) => k),
        values: topCats.map(([, v]) => v),
        colors: _A.palette,
      });
    }

    // Profit bar
    CHARTS.bar('sx-an-profit', {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Net Profit',
        data: months.map(m => m.profit),
        color: '#2563EB',
      }],
    });

    // Top sources horizontal bar
    if (topSrc.length > 0) {
      CHARTS.bar('sx-an-sources', {
        labels: topSrc.map(([k]) => k.length > 18 ? k.slice(0, 18) + '…' : k),
        datasets: [{
          label: 'Revenue',
          data: topSrc.map(([, v]) => v),
          color: '#4f9ef0',
        }],
      }, { horizontal: true });
    }
  },

  filterByCategory(cat) {
    const txns = _A.txnsByRange(STRATIX_DB.getArr('transactions'), this._range)
      .filter(t => t.type === 'expense' && (t.category || 'other') === cat)
      .slice().reverse();

    const sym = _A.sym();
    const total = txns.reduce((s, t) => s + (t.amount || 0), 0);
    const el = document.getElementById('sx-an-filtered');
    if (!el) return;

    el.innerHTML = `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <div>
            <div class="card-title" style="margin:0">🔍 ${escapeHTML(cat)} — ${txns.length} transactions</div>
            <div style="font-size:12px;color:var(--muted);margin-top:3px">Total: <strong style="color:var(--red)">${_A.fmt(total)}</strong></div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('sx-an-filtered').innerHTML=''">✕ Close</button>
        </div>
        <div class="tbl-scroll">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              ${txns.length === 0
                ? `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--muted)">No transactions in this period</td></tr>`
                : txns.map(t => `
                  <tr>
                    <td style="color:var(--muted);font-size:12px">${t.date || (t.createdAt || '').split('T')[0]}</td>
                    <td>${escapeHTML(t.description || '—')}</td>
                    <td style="color:var(--red);font-weight:700">${sym}${(t.amount || 0).toLocaleString('en-IN')}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;

    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  exportCSV() {
    const txns = _A.txnsByRange(STRATIX_DB.getArr('transactions'), this._range);
    if (txns.length === 0) { NOTIFY.show('No transactions in this period', 'warning'); return; }

    const sym = _A.sym();
    const rows = [['Date', 'Type', 'Category', 'Description', `Amount (${sym})`, 'Running Balance']];
    let balance = 0;
    txns.slice().sort((a, b) => new Date(a.date || a.createdAt) - new Date(b.date || b.createdAt)).forEach(t => {
      balance += t.type === 'revenue' ? (t.amount || 0) : -(t.amount || 0);
      rows.push([
        t.date || (t.createdAt || '').split('T')[0],
        t.type,
        t.category || '',
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.type === 'revenue' ? (t.amount || 0) : -(t.amount || 0),
        balance.toFixed(2),
      ]);
    });

    const revenue  = txns.filter(t => t.type === 'revenue').reduce((s, t) => s + (t.amount || 0), 0);
    const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
    rows.push(['', '', '', '', '', '']);
    rows.push(['SUMMARY', '', '', 'Total Revenue',  revenue,           '']);
    rows.push(['',        '', '', 'Total Expenses', expenses,          '']);
    rows.push(['',        '', '', 'Net Profit',     revenue - expenses,'']);

    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `stratix_analytics_${this._range}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    NOTIFY.show('CSV exported ✓', 'success');
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   2. VERTICAL CHART UPGRADES
   Replaces CSS bar-chart divs in transport/retail/factory dashboards
   with real Chart.js canvases, injected via MutationObserver after render.
   ══════════════════════════════════════════════════════════════════════════════ */

const VERTICAL_CHARTS = {

  _observer: null,

  init() {
    const target = document.getElementById('sectionContent');
    if (!target) return;

    this._observer = new MutationObserver(() => this._onMutation());
    this._observer.observe(target, { childList: true, subtree: false });
  },

  _onMutation() {
    // Small delay to let the vertical dashboard finish rendering
    clearTimeout(this._mutTimer);
    this._mutTimer = setTimeout(() => this._upgradeCharts(), 80);
  },

  _upgradeCharts() {
    // Find all .bar-chart divs that haven't been upgraded yet
    document.querySelectorAll('.bar-chart:not([data-upgraded])').forEach(barChart => {
      barChart.dataset.upgraded = '1';
      const card = barChart.closest('.chart-card');
      if (!card) return;
      this._replaceWithCanvas(barChart, card);
    });
  },

  _replaceWithCanvas(barChartEl, cardEl) {
    if (typeof CHARTS === 'undefined') return;

    // Extract data from the existing bar-chart DOM
    const groups = barChartEl.querySelectorAll('.bar-grp');
    if (!groups.length) return;

    const labels   = [];
    const revenues = [];
    const expenses = [];

    groups.forEach(grp => {
      const lbl  = grp.querySelector('.bar-lbl')?.textContent || '';
      const bars  = grp.querySelectorAll('.bar');
      const revBar = grp.querySelector('.bar.rev');
      const expBar = grp.querySelector('.bar.exp');

      labels.push(lbl);
      // Extract value from title attribute (set by vertical dashboards)
      const revTitle = revBar?.getAttribute('title') || '';
      const expTitle = expBar?.getAttribute('title') || '';
      revenues.push(this._parseAmount(revTitle));
      expenses.push(this._parseAmount(expTitle));
    });

    // Create canvas to replace bar-chart
    const canvasId = 'sx-vc-' + Math.random().toString(36).slice(2, 7);
    const wrapper  = document.createElement('div');
    wrapper.style.cssText = 'height:160px;position:relative';
    wrapper.innerHTML     = `<canvas id="${canvasId}"></canvas>`;

    // Preserve legend if present
    const legend = barChartEl.nextElementSibling;
    barChartEl.replaceWith(wrapper);
    if (legend && legend.classList.contains('chart-legend')) {
      legend.style.display = 'none'; // Chart.js shows its own legend
    }

    requestAnimationFrame(() => {
      CHARTS.bar(canvasId, {
        labels,
        datasets: [
          { label: 'Revenue',  data: revenues, color: '#00d68f' },
          { label: 'Expenses', data: expenses, color: '#ff4d4d' },
        ],
      });
    });
  },

  // Parse amount from title strings like "Revenue: ₹1.2L" or "Cost: ₹45K"
  _parseAmount(titleStr) {
    if (!titleStr) return 0;
    const match = titleStr.match(/[₹$£€]?([\d.]+)\s*(Cr|L|K)?/i);
    if (!match) return 0;
    const [, num, unit] = match;
    const n = parseFloat(num) || 0;
    if (unit?.toLowerCase() === 'cr') return n * 1e7;
    if (unit?.toLowerCase() === 'l')  return n * 1e5;
    if (unit?.toLowerCase() === 'k')  return n * 1e3;
    return n;
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   3. API LAYER — STRATIX_API
   Wraps all external fetch calls with retry, timeout, error handling.
   Firebase-ready: swap the _transport() method to use Firebase SDK.
   ══════════════════════════════════════════════════════════════════════════════ */

const STRATIX_API = (() => {

  const _defaults = {
    timeout:    15000,  // 15s default
    retries:    2,
    retryDelay: 1000,   // 1s between retries
  };

  /**
   * Core fetch with timeout + retry.
   * @param {string} url
   * @param {Object} options - standard fetch options + { timeout?, retries?, retryDelay? }
   * @returns {Promise<Response>}
   */
  async function _fetch(url, options = {}) {
    const timeout    = options.timeout    ?? _defaults.timeout;
    const retries    = options.retries    ?? _defaults.retries;
    const retryDelay = options.retryDelay ?? _defaults.retryDelay;

    let lastError;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timer      = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timer);
        return response;
      } catch (err) {
        clearTimeout(timer);
        lastError = err;

        if (err.name === 'AbortError') {
          lastError = new Error(`Request timed out after ${timeout}ms`);
          break; // Don't retry timeouts
        }

        if (attempt < retries) {
          await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
        }
      }
    }
    throw lastError;
  }

  /**
   * Call Anthropic Claude API.
   * @param {Object} opts - { messages, system?, model?, maxTokens?, apiKey }
   * @returns {Promise<{success:boolean, text?:string, error?:string}>}
   */
  async function claude({ messages, system, model, maxTokens, apiKey }) {
    const key = apiKey || STRATIX_DB.getSettings().anthropicApiKey;
    if (!key) return { success: false, error: 'API key not configured' };

    try {
      const response = await _fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model:      model      || 'claude-sonnet-4-5',
          max_tokens: maxTokens  || 1000,
          system:     system     || undefined,
          messages,
        }),
        timeout: 30000,
        retries: 1,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return { success: false, error: err.error?.message || `HTTP ${response.status}` };
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      return { success: true, text };
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Generic JSON GET.
   * @param {string} url
   * @returns {Promise<{success:boolean, data?:*, error?:string}>}
   */
  async function get(url, options = {}) {
    try {
      const response = await _fetch(url, { method: 'GET', ...options });
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Generic JSON POST.
   */
  async function post(url, body, options = {}) {
    try {
      const response = await _fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: JSON.stringify(body),
        ...options,
      });
      if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Firebase-ready storage abstraction.
   * Currently writes to localStorage. Swap _storage.set/get to Firebase SDK
   * when ready — zero changes needed in the rest of the app.
   */
  const storage = {
    async set(key, value) {
      // FUTURE: await firebase.firestore().collection(...).doc(key).set(value);
      try { STRATIX_DB.set(key, value); return { success: true }; }
      catch (e) { return { success: false, error: e.message }; }
    },
    async get(key) {
      // FUTURE: const doc = await firebase.firestore()...doc(key).get();
      try { return { success: true, data: STRATIX_DB.get(key) }; }
      catch (e) { return { success: false, error: e.message }; }
    },
  };

  return { claude, get, post, storage };
})();

/* Patch AI.sendMessage to use STRATIX_API */
document.addEventListener('DOMContentLoaded', () => {
  if (typeof AI === 'undefined') return;

  AI.sendMessage = async function() {
    const input = document.getElementById('aiInput');
    const msg   = input?.value.trim();
    if (!msg) return;
    input.value = '';

    this.addMessage(msg, 'user');

    const typingId = 'typing_' + Date.now();
    const container = document.getElementById('aiMessages');
    if (container) {
      container.innerHTML += `<div class="ai-msg ai" id="${typingId}"><div class="avatar">🤖</div><div class="ai-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div></div>`;
      container.scrollTop = container.scrollHeight;
    }

    const settings = STRATIX_DB.getSettings();
    if (!settings.anthropicApiKey) {
      document.getElementById(typingId)?.remove();
      this.addError('API key not found. Please setup your API key in Settings.');
      return;
    }

    // Build business context
    const txns      = STRATIX_DB.getArr('transactions');
    const trips     = STRATIX_DB.getArr('trips');
    const fleet     = STRATIX_DB.getArr('fleet');
    const employees = STRATIX_DB.getArr('employees');
    const clients   = STRATIX_DB.getArr('clients');
    const goals     = STRATIX_DB.getArr('goals');
    const sym       = settings.currencySymbol || '₹';
    const totalRev  = txns.filter(t => t.type === 'revenue').reduce((s, t) => s + t.amount, 0);
    const totalExp  = txns.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    const margin    = totalRev > 0 ? (((totalRev - totalExp) / totalRev) * 100).toFixed(1) : 0;
    const outstanding = clients.reduce((s, c) => s + (c.outstanding || 0), 0);
    const expCats   = txns.filter(t => t.type === 'expense').reduce((acc, t) => {
      acc[t.category || 'other'] = (acc[t.category || 'other'] || 0) + t.amount;
      return acc;
    }, {});

    const businessContext = `STRATIX Business Data:
Business: ${settings.businessName || 'Unnamed'} (${settings.businessType || 'General'})
Owner: ${settings.ownerName || '—'} | GST: ${settings.gstNumber || 'Not registered'}
Revenue: ${sym}${totalRev.toLocaleString('en-IN')} | Expenses: ${sym}${totalExp.toLocaleString('en-IN')} | Profit Margin: ${margin}%
Outstanding: ${sym}${outstanding.toLocaleString('en-IN')} | Transactions: ${txns.length}
Expense breakdown: ${JSON.stringify(expCats).slice(0, 300)}
Fleet: ${fleet.length} vehicles | Trips: ${trips.length} | Employees: ${employees.length}
Goals: ${goals.map(g => `${g.title}: ${g.current}/${g.target}`).join(', ') || 'None'}`;

    const result = await STRATIX_API.claude({
      messages: [{ role: 'user', content: msg }],
      system: `You are an experienced Indian business advisor and CFO. You have access to the user's actual business data below. Give specific, actionable advice based on their real numbers. Use Indian business context (GST, PF, ESI, lakhs, crores). Be concise and use bullet points.\n\n${businessContext}`,
      maxTokens: 1000,
    });

    document.getElementById(typingId)?.remove();

    if (result.success) {
      this.addMessage(result.text, 'ai');
    } else {
      this.addError(`Error: ${result.error}. Check your API key and internet connection.`);
    }
  };
});


/* ══════════════════════════════════════════════════════════════════════════════
   4. MULTI-TENANT GROUNDWORK
   ══════════════════════════════════════════════════════════════════════════════ */

const TENANT = (() => {

  /**
   * Get the current tenant (user) ID.
   * Single-user: returns the logged-in user's ID.
   * Multi-tenant: would return the org/workspace ID.
   */
  function currentId() {
    try {
      const s = STRATIX_AUTH.getSession();
      return s ? s.userId : 'anonymous';
    } catch { return 'anonymous'; }
  }

  /**
   * Get all tenant IDs that have data in this browser.
   * Used for account-switching in a future multi-account UI.
   */
  function list() {
    const tenants = new Set();
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        const match = k?.match(/^sx_([^_]+)_settings$/);
        if (match) tenants.add(match[1]);
      }
    } catch {}
    return [...tenants];
  }

  /**
   * Get the current tenant's settings context.
   * All modules should call this instead of STRATIX_DB.getSettings() directly
   * once multi-tenant is active — this abstraction layer makes that migration trivial.
   */
  function context() {
    return {
      tenantId:  currentId(),
      settings:  STRATIX_DB.getSettings(),
      session:   STRATIX_AUTH.getSession(),
      // FUTURE: org name, plan, feature flags, etc.
    };
  }

  /**
   * Namespace a key for the current tenant.
   * STRATIX_DB already does this via sx_{userId}_{key}.
   * This helper is for any future direct localStorage access.
   */
  function key(k) {
    return `sx_${currentId()}_${k}`;
  }

  /**
   * Clear all data for a specific tenant ID (for account deletion).
   */
  function clearTenant(tenantId) {
    if (!tenantId) return;
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(`sx_${tenantId}_`)) keysToDelete.push(k);
    }
    keysToDelete.forEach(k => localStorage.removeItem(k));
  }

  return { currentId, list, context, key, clearTenant };
})();

/* Expose globally */
window.TENANT = TENANT;


/* ══════════════════════════════════════════════════════════════════════════════
   5. CUSTOMER PROFILE DRAWER
   Clicking a CRM contact opens a slide-in drawer with full profile.
   ══════════════════════════════════════════════════════════════════════════════ */

const CUSTOMER_PROFILE = {

  open(contactId) {
    if (typeof UI === 'undefined') return;

    const contact = STRATIX_DB.getArr('crmContacts').find(c => c.id === contactId);
    if (!contact) return;

    const sym      = _A.sym();
    const txns     = STRATIX_DB.getArr('transactions');
    const invoices = STRATIX_DB.getArr('invoices').filter(inv => inv.customerId === contactId || inv.customerName === contact.name);
    const activities = STRATIX_DB.getArr('crmActivity').filter(a => a.leadId === contactId).slice().reverse().slice(0, 5);
    const deals    = STRATIX_DB.getArr('crmDeals').filter(d => d.contactId === contactId || d.company === contact.company);

    const totalBusiness = invoices.filter(inv => inv.status === 'Paid').reduce((s, inv) => s + (inv.totalAmount || 0), 0) || (contact.totalBusiness || 0);
    const outstanding   = invoices.filter(inv => ['Unpaid','Partial','Overdue'].includes(inv.status)).reduce((s, inv) => s + (inv.totalAmount - (inv.paidAmount || 0)), 0) || (contact.outstanding || 0);
    const wonDeals      = deals.filter(d => d.status === 'Won').reduce((s, d) => s + (d.value || 0), 0);

    const initials = (contact.name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const typeColors = { 'Customer': '#00d68f', 'Supplier': '#4f9ef0', 'Prospect': '#2563EB', 'Partner': '#9b5de5' };
    const typeColor  = typeColors[contact.type] || '#5a6e90';

    const body = `
      <!-- Profile Header -->
      <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid var(--border);margin-bottom:20px">
        <div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,#2563EB,#1D4ED8);display:inline-flex;align-items:center;justify-content:center;font-family:var(--heading);font-weight:800;font-size:22px;color:#F8FAFC;margin-bottom:12px">${initials}</div>
        <h3 style="font-size:18px;font-weight:700;margin-bottom:4px">${escapeHTML(contact.name)}</h3>
        ${contact.company ? `<div style="font-size:13px;color:var(--muted);margin-bottom:6px">${escapeHTML(contact.company)} ${contact.role ? '· ' + escapeHTML(contact.role) : ''}</div>` : ''}
        <span style="background:${typeColor}18;color:${typeColor};border:1px solid ${typeColor}40;border-radius:20px;padding:3px 12px;font-size:11px;font-weight:700">${contact.type || 'Contact'}</span>
      </div>

      <!-- KPIs -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        <div style="background:rgba(0,214,143,.06);border:1px solid rgba(0,214,143,.15);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.8px">Total Business</div>
          <div style="font-size:18px;font-weight:800;color:var(--green)">${_A.fmt(totalBusiness)}</div>
        </div>
        <div style="background:${outstanding > 0 ? 'rgba(255,124,64,.06)' : 'rgba(0,214,143,.04)'};border:1px solid ${outstanding > 0 ? 'rgba(255,124,64,.2)' : 'rgba(26,37,64,.6)'};border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:.8px">Outstanding</div>
          <div style="font-size:18px;font-weight:800;color:${outstanding > 0 ? 'var(--orange)' : 'var(--muted)'}">${_A.fmt(outstanding)}</div>
        </div>
      </div>

      <!-- Contact Details -->
      <div style="background:var(--surface2);border-radius:12px;padding:14px;margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Contact Details</div>
        ${[
          contact.phone && { icon: '📞', label: 'Phone', value: contact.phone, link: `tel:${contact.phone}` },
          contact.email && { icon: '✉️', label: 'Email', value: contact.email, link: `mailto:${contact.email}` },
          contact.city  && { icon: '📍', label: 'City',  value: contact.city  },
          contact.gstin && { icon: '🧾', label: 'GSTIN', value: contact.gstin },
        ].filter(Boolean).map(item => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:14px;width:20px;text-align:center">${item.icon}</span>
            <span style="font-size:11px;color:var(--muted);width:46px;flex-shrink:0">${item.label}</span>
            ${item.link
              ? `<a href="${item.link}" style="font-size:13px;color:var(--gold);flex:1;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHTML(item.value)}</a>`
              : `<span style="font-size:13px;color:var(--text);flex:1">${escapeHTML(item.value)}</span>`}
          </div>`).join('')}
      </div>

      <!-- Quick Actions -->
      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
        ${contact.phone ? `
          <button onclick="window.open('https://wa.me/91${contact.phone.replace(/[^0-9]/g,'')}','_blank')"
            style="flex:1;min-width:100px;padding:10px;background:#25d366;color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px">
            📱 WhatsApp
          </button>` : ''}
        <button onclick="UI.drawer.close();APP.navigate('crm');setTimeout(()=>CRM.tab('activity'),200)"
          style="flex:1;min-width:100px;padding:10px;background:rgba(79,158,240,.12);color:var(--blue);border:1px solid rgba(79,158,240,.2);border-radius:10px;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:700">
          📋 Log Activity
        </button>
        ${outstanding > 0 ? `
          <button onclick="UI.drawer.close();APP.navigate('invoiceaging')"
            style="flex:1;min-width:100px;padding:10px;background:rgba(37,99,235,.1);color:var(--gold);border:1px solid rgba(37,99,235,.2);border-radius:10px;cursor:pointer;font-family:var(--font);font-size:12px;font-weight:700">
            💰 Collect Due
          </button>` : ''}
      </div>

      <!-- Recent Invoices -->
      ${invoices.length > 0 ? `
        <div style="margin-bottom:16px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Recent Invoices (${invoices.length})</div>
          ${invoices.slice(-4).reverse().map(inv => {
            const statusColors = { Paid: '#00d68f', Unpaid: '#ff4d4d', Partial: '#2563EB', Overdue: '#ff4d4d', Cancelled: '#5a6e90' };
            const sc = statusColors[inv.status] || '#5a6e90';
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600">${escapeHTML(inv.invoiceNo || '—')}</div>
                <div style="font-size:11px;color:var(--muted)">${inv.createdAt?.split('T')[0] || '—'}</div>
              </div>
              <div style="font-size:13px;font-weight:700;color:var(--text)">${_A.fmt(inv.totalAmount || 0)}</div>
              <span style="background:${sc}18;color:${sc};border:1px solid ${sc}40;border-radius:20px;padding:2px 8px;font-size:10px;font-weight:700">${inv.status}</span>
            </div>`;
          }).join('')}
        </div>` : ''}

      <!-- Recent Activities -->
      ${activities.length > 0 ? `
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Recent Activity</div>
          ${activities.map(a => `
            <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="width:28px;height:28px;border-radius:8px;background:rgba(79,158,240,.1);display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0">📋</div>
              <div style="flex:1">
                <div style="font-size:12px;font-weight:600;color:var(--text2)">${escapeHTML(a.type || 'Activity')}</div>
                <div style="font-size:11px;color:var(--muted)">${escapeHTML((a.note || '').slice(0, 60))}</div>
              </div>
              <div style="font-size:11px;color:var(--muted);white-space:nowrap">${a.date || '—'}</div>
            </div>`).join('')}
        </div>` : ''}
    `;

    UI.drawer.open({
      title: escapeHTML(contact.name),
      body,
    });
  },

  /* Patch CRM contacts table to make rows clickable */
  patchCRM() {
    if (typeof CRM === 'undefined') return;

    const orig = CRM._renderContactRows?.bind(CRM);
    if (!orig) return;

    CRM._renderContactRows = function(contacts) {
      const sym = EH?.sym?.() || '₹';
      if (!contacts.length) return `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">No contacts yet.</td></tr>`;
      return contacts.slice().reverse().map(c => `
        <tr style="cursor:pointer" onmouseover="this.style.background='rgba(37,99,235,.04)'" onmouseout="this.style.background=''">
          <td class="td-b" onclick="CUSTOMER_PROFILE.open('${c.id}')" style="color:var(--gold)">${escapeHTML(c.name)}</td>
          <td onclick="CUSTOMER_PROFILE.open('${c.id}')">${escapeHTML(c.company || '—')}</td>
          <td class="td-m">${escapeHTML(c.role || '—')}</td>
          <td class="td-m">${escapeHTML(c.phone || '—')}</td>
          <td class="td-m">${escapeHTML(c.email || '—')}</td>
          <td class="td-m">${escapeHTML(c.city || '—')}</td>
          <td>${EH?.badge(c.type || 'Customer', c.type === 'Supplier' ? 'blue' : c.type === 'Prospect' ? 'orange' : 'green') || c.type}</td>
          <td class="td-gold">${sym}${EH?.fmt?.(c.totalBusiness || 0) || (c.totalBusiness || 0)}</td>
          <td style="display:flex;gap:5px">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();CUSTOMER_PROFILE.open('${c.id}')" title="View Profile">👤</button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();CRM.editContact('${c.id}')">✏️</button>
            ${c.phone ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();window.open('https://wa.me/91${c.phone.replace(/[^0-9]/g,'')}','_blank')">📱</button>` : ''}
            <button class="btn btn-red btn-sm" onclick="event.stopPropagation();CRM.deleteContact('${c.id}')">🗑</button>
          </td>
        </tr>`).join('');
    };
  },
};

window.CUSTOMER_PROFILE = CUSTOMER_PROFILE;


/* ══════════════════════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  try {
    // Patch APP.renderAnalytics to use new ANALYTICS module
    if (typeof APP !== 'undefined') {
      APP.renderAnalytics = () => ANALYTICS.render();
    }

    // Init vertical chart upgrader
    VERTICAL_CHARTS.init();

    // Patch CRM contacts for customer drawer
    CUSTOMER_PROFILE.patchCRM();

    // Subscribe to bus events for chart refresh
    if (typeof STRATIX_BUS !== 'undefined') {
      STRATIX_BUS.on('finance:changed', () => {
        if (document.getElementById('sx-analytics')) {
          ANALYTICS.render(ANALYTICS._range);
        }
      });
    }

    console.info('[STRATIX] analytics.js v1.0 — Analytics, API layer, multi-tenant, customer profiles active.');
  } catch (e) {
    console.warn('[STRATIX] analytics.js boot warning:', e.message);
  }
});
