/**
 * STRATIX finance_deep.js v1.0 — ROUND 2: FINANCE COMPLETE
 * ══════════════════════════════════════════════════════════════
 *
 * MODULE 1 → GST DEEP
 *   - Sales Register (B2B / B2C / B2BL)
 *   - Purchase Register + ITC
 *   - GSTR-1 Summary (outward supplies)
 *   - GSTR-3B Working (net liability)
 *   - Party-wise GST ledger
 *   - HSN/SAC Summary
 *   - e-Invoice JSON generator
 *   - Quarterly filing calendar
 *
 * MODULE 2 → PAYROLL DEEP (replaces features.js renderSalary)
 *   - Employee master with full structure
 *   - Attendance register (daily, monthly summary)
 *   - Advance management & recovery schedule
 *   - Overtime calculation
 *   - PF/ESI/TDS per latest FY 2025-26 slabs
 *   - Leave balance (CL/EL/SL/LWP)
 *   - Bulk payroll run → payslip generation
 *   - PF/ESI/TDS challan summary (CA-ready)
 *   - CSV export for CA
 *
 * MODULE 3 → BANK RECONCILIATION (replaces features.js renderBankConnect)
 *   - Multi-account management
 *   - Manual transaction entry
 *   - CSV statement import (smart parser)
 *   - Auto-match imported vs recorded transactions
 *   - Unmatched / reconciled buckets
 *   - Cheque tracking (issued / cleared / bounced)
 *   - Cash flow summary
 *   - Bank-wise P&L contribution
 *
 * INTEGRATION:
 *   - Patches APP.renderGST()  → renderGSTDeep()
 *   - Patches renderSalary()   → renderPayrollDeep()
 *   - Patches renderBankConnect() → renderBankRecon()
 *   - All auto-apply on DOMContentLoaded
 *
 * DATA KEYS:
 *   gstSales       — B2B/B2C outward supply entries
 *   gstPurchases   — inward supply + ITC entries
 *   gstEntries     — existing key (backward compat)
 *   employees      — existing key
 *   attendance     — {empId, date, status, otHours}
 *   leaveBalance   — {empId, cl, el, sl, lwp}
 *   payslips       — existing key (extended)
 *   advances       — {empId, amount, date, reason, recoveredAmt, recovered}
 *   bankAccounts   — existing key (extended)
 *   bankTransactions — existing key (extended + matched flag)
 *   cheques        — {accountId, type, no, date, amount, payee, status}
 * ══════════════════════════════════════════════════════════════
 */

/* ── Finance Helpers ─────────────────────────────────────────── */
const FIN = {
  sym()    { return STRATIX_DB.getSettings().currencySymbol || '₹'; },
  biz()    { return STRATIX_DB.getSettings().businessName   || 'Your Company'; },
  gstin()  { return STRATIX_DB.getSettings().gstNumber      || ''; },
  state()  { return STRATIX_DB.getSettings().state          || 'Maharashtra'; },
  today()  { return new Date().toISOString().split('T')[0]; },

  fmt(n) {
    n = Math.abs(Number(n) || 0);
    if (n >= 1e7) return (FIN.sym()) + (n/1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return (FIN.sym()) + (n/1e5).toFixed(2) + ' L';
    if (n >= 1e3) return (FIN.sym()) + (n/1e3).toFixed(1) + 'K';
    return (FIN.sym()) + Math.round(n).toLocaleString('en-IN');
  },

  fmtRaw(n) {
    n = Number(n) || 0;
    return Math.abs(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  },

  dateStr(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  },

  monthKey(offset=0) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + offset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  },

  fyMonths() {
    // Returns last 12 months in YYYY-MM format
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push({
        key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
        label: d.toLocaleString('en-IN', { month:'short', year:'2-digit' })
      });
    }
    return months;
  },

  // Indian FY quarter from date
  fyQuarter(dateStr) {
    if (!dateStr) return '—';
    const m = new Date(dateStr).getMonth(); // 0-indexed
    if (m >= 3 && m <= 5)  return 'Q1 (Apr–Jun)';
    if (m >= 6 && m <= 8)  return 'Q2 (Jul–Sep)';
    if (m >= 9 && m <= 11) return 'Q3 (Oct–Dec)';
    return 'Q4 (Jan–Mar)';
  },

  modal(id, title, body, wide=false) {
    return `<div class="overlay" id="${id}" onclick="if(event.target.id==='${id}')document.getElementById('${id}').remove()">
      <div class="modal" style="${wide ? 'max-width:760px' : 'max-width:500px'}">
        <div class="modal-hd">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="document.getElementById('${id}').remove()">✕</button>
        </div>
        <div class="modal-body">${body}</div>
      </div>
    </div>`;
  },

  badge(text, cls='bm') { return `<span class="badge ${cls}">${text}</span>`; },

  // Number to words for payslip
  numWords(n) {
    n = Math.floor(Math.abs(n) || 0);
    if (n === 0) return 'Zero';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
      'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const conv = x => {
      if (x < 20)    return ones[x];
      if (x < 100)   return tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '');
      if (x < 1000)  return ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+conv(x%100):'');
      if (x < 100000)return conv(Math.floor(x/1000))+' Thousand'+(x%1000?' '+conv(x%1000):'');
      if (x < 1e7)   return conv(Math.floor(x/100000))+' Lakh'+(x%100000?' '+conv(x%100000):'');
      return conv(Math.floor(x/1e7))+' Crore'+(x%1e7?' '+conv(x%1e7):'');
    };
    return 'Rupees ' + conv(n) + ' Only';
  },

  downloadCSV(rows, filename) {
    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }
};


/* ══════════════════════════════════════════════════════════════
   MODULE 1 — GST DEEP
   ══════════════════════════════════════════════════════════════ */

function renderGSTDeep(activeTab) {
  activeTab = activeTab || 'dashboard';
  const sym    = FIN.sym();
  const gstin  = FIN.gstin();
  const state  = FIN.state();

  // Summary numbers
  const sales     = STRATIX_DB.getArr('gstSales');
  const purchases = STRATIX_DB.getArr('gstPurchases');
  const mKey      = FIN.monthKey(0);

  const mSalesAmt = sales.filter(e=>(e.date||'').startsWith(mKey)).reduce((s,e)=>s+Number(e.taxableAmt||0),0);
  const mSalesTax = sales.filter(e=>(e.date||'').startsWith(mKey)).reduce((s,e)=>s+Number(e.taxAmt||0),0);
  const mPurchAmt = purchases.filter(e=>(e.date||'').startsWith(mKey)).reduce((s,e)=>s+Number(e.taxableAmt||0),0);
  const mITC      = purchases.filter(e=>(e.date||'').startsWith(mKey)).reduce((s,e)=>s+Number(e.taxAmt||0),0);
  const netLiability = Math.max(0, mSalesTax - mITC);
  const itcBalance   = Math.max(0, mITC - mSalesTax);

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">🧾 GST Management</h1>
        <p class="sec-sub">GSTIN: <strong style="color:var(--gold)">${escapeHTML(gstin||'Not set — update in Settings')}</strong> · State: ${escapeHTML(state)}</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="GST._tab('sales');setTimeout(()=>GST.openAddSale(),200)">+ Add Sale</button>
        <button class="btn btn-outline" onclick="GST._tab('purchases');setTimeout(()=>GST.openAddPurchase(),200)">+ Add Purchase</button>
        <button class="btn btn-ghost btn-sm" onclick="GST.exportGSTR1()">📥 GSTR-1 Report</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      <div class="kpi accent">
        <div class="kpi-lbl">Output GST (This Month)</div>
        <div class="kpi-val">${FIN.fmt(mSalesTax)}</div>
        <div class="kpi-trend">On ${FIN.fmt(mSalesAmt)} sales</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">ITC Available (This Month)</div>
        <div class="kpi-val green">${FIN.fmt(mITC)}</div>
        <div class="kpi-trend">On ${FIN.fmt(mPurchAmt)} purchases</div>
      </div>
      <div class="kpi ${netLiability>0?'':''}">
        <div class="kpi-lbl">Net GST Payable</div>
        <div class="kpi-val ${netLiability>0?'red':'green'}">${FIN.fmt(netLiability)}</div>
        <div class="kpi-trend ${netLiability>0?'down':'up'}">${netLiability>0?'Cash payment needed':'ITC surplus'}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">ITC Carry Forward</div>
        <div class="kpi-val ${itcBalance>0?'gold':''}">${FIN.fmt(itcBalance)}</div>
        <div class="kpi-trend muted">Next month offset</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="calc-tabs" style="margin-bottom:16px">
      <button class="calc-tab${activeTab==='dashboard'?' active':''}" data-gsttab="dashboard" onclick="GST._tab('dashboard')">📊 Dashboard</button>
      <button class="calc-tab${activeTab==='sales'?' active':''}" data-gsttab="sales" onclick="GST._tab('sales')">📤 Sales Register</button>
      <button class="calc-tab${activeTab==='purchases'?' active':''}" data-gsttab="purchases" onclick="GST._tab('purchases')">📥 Purchase + ITC</button>
      <button class="calc-tab${activeTab==='gstr1'?' active':''}" data-gsttab="gstr1" onclick="GST._tab('gstr1')">📑 GSTR-1 Summary</button>
      <button class="calc-tab${activeTab==='gstr3b'?' active':''}" data-gsttab="gstr3b" onclick="GST._tab('gstr3b')">📋 GSTR-3B Working</button>
      <button class="calc-tab${activeTab==='hsn'?' active':''}" data-gsttab="hsn" onclick="GST._tab('hsn')">🔢 HSN Summary</button>
      <button class="calc-tab${activeTab==='calendar'?' active':''}" data-gsttab="calendar" onclick="GST._tab('calendar')">📅 Filing Calendar</button>
    </div>

    <div id="gstTabContent">${GST._renderTab(activeTab)}</div>
    <div id="gstModal"></div>
  </div>`;
}

const GST = {
  _tab(tab) {
    document.querySelectorAll('[data-gsttab]').forEach(b => b.classList.toggle('active', b.dataset.gsttab === tab));
    const el = document.getElementById('gstTabContent');
    if (el) el.innerHTML = this._renderTab(tab);
  },

  _renderTab(tab) {
    if (tab === 'dashboard')  return this._renderDashboard();
    if (tab === 'sales')      return this._renderSalesRegister();
    if (tab === 'purchases')  return this._renderPurchaseRegister();
    if (tab === 'gstr1')      return this._renderGSTR1();
    if (tab === 'gstr3b')     return this._renderGSTR3B();
    if (tab === 'hsn')        return this._renderHSNSummary();
    if (tab === 'calendar')   return this._renderCalendar();
    return '';
  },

  /* ── GST DASHBOARD ── */
  _renderDashboard() {
    const sales     = STRATIX_DB.getArr('gstSales');
    const purchases = STRATIX_DB.getArr('gstPurchases');
    const months    = FIN.fyMonths();
    const sym       = FIN.sym();

    // Monthly chart data
    months.forEach(m => {
      m.output = sales.filter(e=>(e.date||'').startsWith(m.key)).reduce((s,e)=>s+Number(e.taxAmt||0),0);
      m.itc    = purchases.filter(e=>(e.date||'').startsWith(m.key)).reduce((s,e)=>s+Number(e.taxAmt||0),0);
      m.net    = Math.max(0, m.output - m.itc);
    });
    const maxBar = Math.max(...months.map(m=>Math.max(m.output,m.itc)),1);

    // Party-wise outstanding GST (B2B parties with unpaid GST)
    const partyMap = {};
    sales.filter(e=>e.type==='B2B').forEach(e => {
      const k = e.partyName || 'Unknown';
      if (!partyMap[k]) partyMap[k] = { taxable:0, tax:0, count:0 };
      partyMap[k].taxable += Number(e.taxableAmt||0);
      partyMap[k].tax     += Number(e.taxAmt||0);
      partyMap[k].count   += 1;
    });
    const topParties = Object.entries(partyMap).sort((a,b)=>b[1].tax-a[1].tax).slice(0,5);

    // FY totals
    const fyStart = new Date().getMonth() >= 3
      ? new Date().getFullYear() + '-04'
      : (new Date().getFullYear()-1) + '-04';
    const fyMths  = months.filter(m => m.key >= fyStart);
    const fyOutput = fyMths.reduce((s,m)=>s+m.output,0);
    const fyITC    = fyMths.reduce((s,m)=>s+m.itc,0);
    const fyNet    = Math.max(0, fyOutput - fyITC);

    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
      <!-- Monthly chart -->
      <div class="card">
        <div class="card-title">📊 Monthly GST — Output vs ITC (Last 12 Months)</div>
        <div class="bar-chart" style="height:120px">
          ${months.slice(-6).map(m=>`
          <div class="bar-grp">
            <div class="bars">
              <div class="bar rev" style="height:${Math.round((m.output/maxBar)*110)}px" title="Output GST: ${FIN.fmt(m.output)}"></div>
              <div class="bar exp" style="height:${Math.round((m.itc/maxBar)*110)}px" title="ITC: ${FIN.fmt(m.itc)}"></div>
            </div>
            <div class="bar-lbl">${m.label}</div>
          </div>`).join('')}
        </div>
        <div class="chart-legend">
          <div class="leg rev">Output GST</div>
          <div class="leg exp">ITC</div>
        </div>
      </div>

      <!-- FY Summary -->
      <div class="card">
        <div class="card-title">📋 FY 2025-26 GST Summary</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
          <div style="background:rgba(232,64,64,.07);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Total Output GST</div>
            <div style="font-size:18px;font-weight:800;color:var(--red)">${FIN.fmt(fyOutput)}</div>
          </div>
          <div style="background:rgba(0,214,143,.07);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Total ITC Claimed</div>
            <div style="font-size:18px;font-weight:800;color:var(--green)">${FIN.fmt(fyITC)}</div>
          </div>
          <div style="background:rgba(37,99,235,.07);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Net GST Paid (FY)</div>
            <div style="font-size:18px;font-weight:800;color:var(--gold)">${FIN.fmt(fyNet)}</div>
          </div>
          <div style="background:var(--s2);padding:12px;border-radius:10px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Total Entries</div>
            <div style="font-size:18px;font-weight:800">${sales.length + purchases.length}</div>
          </div>
        </div>
        <div class="alert" style="background:rgba(79,126,240,.08);border-color:rgba(79,126,240,.3)">
          <span>💡</span><div>GSTR-1 due 11th of next month · GSTR-3B due 20th · Annual return GSTR-9 by Dec 31</div>
        </div>
      </div>
    </div>

    <!-- Top Parties -->
    ${topParties.length > 0 ? `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Top B2B Parties by GST Volume</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Party Name</th><th>Invoices</th><th>Taxable Amount</th><th>GST Charged</th><th>% of Total</th></tr></thead>
        <tbody>
        ${topParties.map(([name,d]) => `<tr>
          <td class="td-b">${escapeHTML(name)}</td>
          <td>${d.count}</td>
          <td>${FIN.fmt(d.taxable)}</td>
          <td class="td-r">${FIN.fmt(d.tax)}</td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <div class="prog" style="width:60px"><div class="prog-fill po" style="width:${fyOutput>0?((d.tax/fyOutput)*100).toFixed(0):0}%"></div></div>
              <span style="font-size:11px">${fyOutput>0?((d.tax/fyOutput)*100).toFixed(1):0}%</span>
            </div>
          </td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>` : `
    <div class="card" style="text-align:center;padding:32px 20px">
      <div style="font-size:36px;margin-bottom:10px">🧾</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No GST Entries Yet</h3>
      <p style="color:var(--muted);margin-bottom:16px">Add sales and purchase invoices to see your GST dashboard.</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn btn-gold" onclick="GST._tab('sales');setTimeout(()=>GST.openAddSale(),200)">+ Add Sale</button>
        <button class="btn btn-outline" onclick="GST._tab('purchases');setTimeout(()=>GST.openAddPurchase(),200)">+ Add Purchase</button>
      </div>
    </div>`}`;
  },

  /* ── SALES REGISTER ── */
  _renderSalesRegister() {
    const sales  = STRATIX_DB.getArr('gstSales');
    const sym    = FIN.sym();
    const sorted = [...sales].sort((a,b) => new Date(b.date||b.createdAt) - new Date(a.date||a.createdAt));

    const totalTaxable = sales.reduce((s,e)=>s+Number(e.taxableAmt||0),0);
    const totalGST     = sales.reduce((s,e)=>s+Number(e.taxAmt||0),0);
    const totalInv     = sales.reduce((s,e)=>s+Number(e.invoiceAmt||0),0);

    return `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
      <div class="kpi accent"><div class="kpi-lbl">Total Taxable</div><div class="kpi-val">${FIN.fmt(totalTaxable)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Total GST Collected</div><div class="kpi-val red">${FIN.fmt(totalGST)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Total Invoice Value</div><div class="kpi-val">${FIN.fmt(totalInv)}</div></div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Sales Register — ${sales.length} entries</span>
        <div style="display:flex;gap:8px">
          <select onchange="GST._filterSales(this.value)" style="padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt)">
            <option value="all">All Types</option>
            <option value="B2B">B2B</option>
            <option value="B2C">B2C</option>
            <option value="B2BL">B2BL (Large)</option>
            <option value="EXP">Export</option>
          </select>
          <button class="btn btn-gold btn-sm" onclick="GST.openAddSale()">+ Add Sale</button>
          <button class="btn btn-ghost btn-sm" onclick="GST.exportSalesCSV()">📥 CSV</button>
        </div>
      </div>
      <div id="salesTable">
        ${this._renderSaleRows(sorted, sym)}
      </div>
    </div>`;
  },

  _renderSaleRows(sales, sym) {
    if (sales.length === 0) return `<div style="padding:32px;text-align:center;color:var(--muted)">No sales entries. Click "+ Add Sale" to start recording.</div>`;
    return `<div class="tbl-scroll"><table>
      <thead><tr><th>Date</th><th>Invoice No.</th><th>Party Name</th><th>GSTIN</th><th>Type</th><th>HSN/SAC</th><th>Rate</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th></th></tr></thead>
      <tbody>
      ${sales.map(e => {
        const rate  = Number(e.rate||0);
        const tax   = Number(e.taxAmt||0);
        const txType= e.gstType||'intra';
        const cgst  = txType==='intra' ? tax/2 : 0;
        const sgst  = txType==='intra' ? tax/2 : 0;
        const igst  = txType==='inter' ? tax   : 0;
        return `<tr>
          <td class="td-m">${FIN.dateStr(e.date)}</td>
          <td class="td-m" style="font-size:11px;font-family:monospace">${escapeHTML(e.invoiceNo||'—')}</td>
          <td class="td-b">${escapeHTML(e.partyName||'—')}</td>
          <td class="td-m" style="font-size:11px">${escapeHTML(e.partyGSTIN||'—')}</td>
          <td>${FIN.badge(e.type||'B2C', e.type==='B2B'?'bb':e.type==='EXP'?'bg':'bm')}</td>
          <td class="td-m">${escapeHTML(e.hsn||'—')}</td>
          <td class="td-m">${rate}%</td>
          <td>${FIN.fmt(e.taxableAmt||0)}</td>
          <td class="td-r">${cgst>0?FIN.fmt(cgst):'—'}</td>
          <td class="td-r">${sgst>0?FIN.fmt(sgst):'—'}</td>
          <td class="td-r">${igst>0?FIN.fmt(igst):'—'}</td>
          <td style="font-weight:700">${FIN.fmt(e.invoiceAmt||0)}</td>
          <td><button class="del-btn" onclick="GST.deleteSale('${e.id}')">🗑</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
  },

  _filterSales(type) {
    const all = STRATIX_DB.getArr('gstSales');
    const filtered = type==='all' ? all : all.filter(e=>e.type===type);
    const el = document.getElementById('salesTable');
    if (el) el.innerHTML = this._renderSaleRows(
      [...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)), FIN.sym()
    );
  },

  openAddSale(id) {
    const all = STRATIX_DB.getArr('gstSales');
    const e   = id ? (all.find(x=>x.id===id)||{}) : {};
    const today = FIN.today();
    const nextInvNo = 'INV-' + String(all.length + 1).padStart(4,'0');

    document.getElementById('gstModal').innerHTML = FIN.modal('gstSaleModal', id?'✏️ Edit Sale':'📤 Add Sale Entry', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Invoice Date *</label><input type="date" id="gs_date" value="${e.date||today}"/></div>
        <div class="field"><label>Invoice No. *</label><input id="gs_inv" value="${escapeHTML(e.invoiceNo||nextInvNo)}" placeholder="INV-0001"/></div>
        <div class="field"><label>Supply Type</label>
          <select id="gs_type" onchange="GST._onSaleTypeChange()">
            <option value="B2B" ${e.type==='B2B'?'selected':''}>B2B — Registered Buyer</option>
            <option value="B2C" ${(!e.type||e.type==='B2C')?'selected':''}>B2C — Unregistered Buyer</option>
            <option value="B2BL" ${e.type==='B2BL'?'selected':''}>B2BL — Large (Inv > ₹2.5L)</option>
            <option value="EXP" ${e.type==='EXP'?'selected':''}>Export</option>
          </select>
        </div>
        <div class="field"><label>GST Type</label>
          <select id="gs_gsttype">
            <option value="intra" ${(e.gstType||'intra')==='intra'?'selected':''}>Intrastate (CGST+SGST)</option>
            <option value="inter" ${e.gstType==='inter'?'selected':''}>Interstate (IGST)</option>
          </select>
        </div>
        <div class="field"><label>Party / Customer Name</label><input id="gs_party" value="${escapeHTML(e.partyName||'')}" placeholder="Company / Person name"/></div>
        <div class="field" id="gs_gstin_field"><label>Party GSTIN</label><input id="gs_gstin" value="${escapeHTML(e.partyGSTIN||'')}" placeholder="29AABCT1332L1ZT" style="text-transform:uppercase"/></div>
        <div class="field"><label>HSN / SAC Code</label><input id="gs_hsn" value="${escapeHTML(e.hsn||'')}" placeholder="996511 / 9963 / 84713"/></div>
        <div class="field"><label>GST Rate (%)</label>
          <select id="gs_rate" onchange="GST._calcSaleTax()">
            ${[0,5,12,18,28].map(r=>`<option value="${r}" ${Number(e.rate||18)===r?'selected':''}>${r}%</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Taxable Amount (${FIN.sym()}) *</label><input type="number" id="gs_taxable" value="${e.taxableAmt||''}" placeholder="100000" oninput="GST._calcSaleTax()"/></div>
        <div class="field"><label>Total Invoice Value</label><input type="number" id="gs_total" value="${e.invoiceAmt||''}" placeholder="Auto-calculated" readonly style="background:var(--s2)"/></div>
        <div class="field" id="gs_cgst_row"><label>CGST Amount</label><input type="number" id="gs_cgst" readonly style="background:var(--s2)" value="${e.taxAmt?e.taxAmt/2:''}"/></div>
        <div class="field" id="gs_sgst_row"><label>SGST Amount</label><input type="number" id="gs_sgst" readonly style="background:var(--s2)" value="${e.taxAmt?e.taxAmt/2:''}"/></div>
        <div class="field" id="gs_igst_row" style="display:none"><label>IGST Amount</label><input type="number" id="gs_igst" readonly style="background:var(--s2)"/></div>
      </div>
      <div class="field" style="margin-top:10px"><label>Narration / Notes</label><input id="gs_notes" value="${escapeHTML(e.notes||'')}" placeholder="e.g. Against PO 12345"/></div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="GST.saveSale('${id||''}')">💾 ${id?'Update':'Save'} Entry</button>
    `, true);
    setTimeout(() => this._calcSaleTax(), 100);
  },

  _onSaleTypeChange() {
    const type = document.getElementById('gs_type')?.value;
    const gstinField = document.getElementById('gs_gstin_field');
    if (gstinField) gstinField.style.display = type==='B2C' ? 'none' : '';
  },

  _calcSaleTax() {
    const taxable = +document.getElementById('gs_taxable')?.value||0;
    const rate    = +document.getElementById('gs_rate')?.value||0;
    const gstType = document.getElementById('gs_gsttype')?.value||'intra';
    const taxAmt  = taxable * rate / 100;
    const total   = taxable + taxAmt;

    const totEl  = document.getElementById('gs_total');
    if (totEl) totEl.value = total.toFixed(2);

    const cgstRow = document.getElementById('gs_cgst_row');
    const sgstRow = document.getElementById('gs_sgst_row');
    const igstRow = document.getElementById('gs_igst_row');

    if (gstType === 'intra') {
      if (cgstRow) cgstRow.style.display = '';
      if (sgstRow) sgstRow.style.display = '';
      if (igstRow) igstRow.style.display = 'none';
      const c = document.getElementById('gs_cgst'); if (c) c.value = (taxAmt/2).toFixed(2);
      const s = document.getElementById('gs_sgst'); if (s) s.value = (taxAmt/2).toFixed(2);
    } else {
      if (cgstRow) cgstRow.style.display = 'none';
      if (sgstRow) sgstRow.style.display = 'none';
      if (igstRow) igstRow.style.display = '';
      const i = document.getElementById('gs_igst'); if (i) i.value = taxAmt.toFixed(2);
    }
  },

  saveSale(id) {
    const date    = document.getElementById('gs_date')?.value;
    const invNo   = document.getElementById('gs_inv')?.value.trim();
    const taxable = +document.getElementById('gs_taxable')?.value||0;
    if (!invNo)    { NOTIFY.show('Enter invoice number','warning'); return; }
    if (!taxable)  { NOTIFY.show('Enter taxable amount','warning'); return; }
    const rate    = +document.getElementById('gs_rate')?.value||0;
    const taxAmt  = taxable * rate / 100;
    const data    = {
      date, invoiceNo: invNo,
      type:        document.getElementById('gs_type')?.value||'B2C',
      gstType:     document.getElementById('gs_gsttype')?.value||'intra',
      partyName:   document.getElementById('gs_party')?.value.trim()||'',
      partyGSTIN:  document.getElementById('gs_gstin')?.value.trim().toUpperCase()||'',
      hsn:         document.getElementById('gs_hsn')?.value.trim()||'',
      rate,
      taxableAmt:  taxable,
      taxAmt,
      invoiceAmt:  taxable + taxAmt,
      notes:       document.getElementById('gs_notes')?.value.trim()||''
    };
    if (id) { STRATIX_DB.update('gstSales',id,data); NOTIFY.show('Entry updated!','success'); }
    else    { STRATIX_DB.push('gstSales',data);       NOTIFY.show('Sale entry saved!','success'); }
    document.getElementById('gstSaleModal')?.remove();
    this._tab('sales');
  },

  deleteSale(id) {
    if (!confirm('Delete this sale entry?')) return;
    STRATIX_DB.remove('gstSales',id);
    this._tab('sales');
  },

  /* ── PURCHASE REGISTER + ITC ── */
  _renderPurchaseRegister() {
    const purchases = STRATIX_DB.getArr('gstPurchases');
    const sym       = FIN.sym();
    const sorted    = [...purchases].sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));

    const totalTaxable = purchases.reduce((s,e)=>s+Number(e.taxableAmt||0),0);
    const totalITC     = purchases.reduce((s,e)=>s+Number(e.taxAmt||0),0);
    const eligibleITC  = purchases.filter(e=>e.itcEligible!==false).reduce((s,e)=>s+Number(e.taxAmt||0),0);
    const blockedITC   = purchases.filter(e=>e.itcEligible===false).reduce((s,e)=>s+Number(e.taxAmt||0),0);

    return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
      <div class="kpi"><div class="kpi-lbl">Total Purchases</div><div class="kpi-val">${FIN.fmt(totalTaxable)}</div></div>
      <div class="kpi accent"><div class="kpi-lbl">Total ITC</div><div class="kpi-val green">${FIN.fmt(totalITC)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Eligible ITC</div><div class="kpi-val green">${FIN.fmt(eligibleITC)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Blocked ITC</div><div class="kpi-val ${blockedITC>0?'red':''}">${FIN.fmt(blockedITC)}</div></div>
    </div>

    <div class="alert" style="background:rgba(79,126,240,.08);border-color:rgba(79,126,240,.3);margin-bottom:14px">
      <span>💡</span>
      <div>ITC is blocked on: Personal expenses, Motor vehicles (passenger), Food & beverages, Club memberships, Works contract for immovable property. Mark accordingly below.</div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Purchase Register — ${purchases.length} entries</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-gold btn-sm" onclick="GST.openAddPurchase()">+ Add Purchase</button>
          <button class="btn btn-ghost btn-sm" onclick="GST.exportPurchaseCSV()">📥 CSV</button>
        </div>
      </div>
      ${sorted.length === 0 ? `<div style="padding:32px;text-align:center;color:var(--muted)">No purchase entries yet.</div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Invoice No.</th><th>Supplier</th><th>GSTIN</th><th>HSN</th><th>Rate</th><th>Taxable</th><th>GST Paid</th><th>ITC?</th><th>Total</th><th></th></tr></thead>
        <tbody>
        ${sorted.map(e => `<tr>
          <td class="td-m">${FIN.dateStr(e.date)}</td>
          <td class="td-m" style="font-size:11px;font-family:monospace">${escapeHTML(e.invoiceNo||'—')}</td>
          <td class="td-b">${escapeHTML(e.partyName||'—')}</td>
          <td class="td-m" style="font-size:11px">${escapeHTML(e.partyGSTIN||'—')}</td>
          <td class="td-m">${escapeHTML(e.hsn||'—')}</td>
          <td class="td-m">${e.rate||0}%</td>
          <td>${FIN.fmt(e.taxableAmt||0)}</td>
          <td class="td-g">${FIN.fmt(e.taxAmt||0)}</td>
          <td>
            <button onclick="GST.toggleITC('${e.id}',${e.itcEligible!==false})" 
              style="padding:3px 10px;border-radius:6px;border:1px solid ${e.itcEligible!==false?'var(--green)':'var(--red)'};background:${e.itcEligible!==false?'rgba(0,214,143,.1)':'rgba(232,64,64,.1)'};color:${e.itcEligible!==false?'var(--green)':'var(--red)'};font-size:11px;cursor:pointer;font-weight:700">
              ${e.itcEligible!==false?'✓ Eligible':'✗ Blocked'}
            </button>
          </td>
          <td style="font-weight:700">${FIN.fmt(e.invoiceAmt||0)}</td>
          <td><button class="del-btn" onclick="GST.deletePurchase('${e.id}')">🗑</button></td>
        </tr>`).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  },

  toggleITC(id, currentlyEligible) {
    STRATIX_DB.update('gstPurchases', id, { itcEligible: !currentlyEligible });
    NOTIFY.show(`ITC ${!currentlyEligible?'enabled':'blocked'} for this entry`, 'info');
    this._tab('purchases');
  },

  openAddPurchase(id) {
    const all   = STRATIX_DB.getArr('gstPurchases');
    const e     = id ? (all.find(x=>x.id===id)||{}) : {};
    const today = FIN.today();

    document.getElementById('gstModal').innerHTML = FIN.modal('gstPurchModal', id?'✏️ Edit Purchase':'📥 Add Purchase Entry', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Invoice Date *</label><input type="date" id="gp_date" value="${e.date||today}"/></div>
        <div class="field"><label>Supplier Invoice No. *</label><input id="gp_inv" value="${escapeHTML(e.invoiceNo||'')}" placeholder="Supplier's invoice number"/></div>
        <div class="field"><label>Supplier Name *</label><input id="gp_party" value="${escapeHTML(e.partyName||'')}" placeholder="Supplier company name"/></div>
        <div class="field"><label>Supplier GSTIN</label><input id="gp_gstin" value="${escapeHTML(e.partyGSTIN||'')}" placeholder="29AABCT1332L1ZT" style="text-transform:uppercase"/></div>
        <div class="field"><label>HSN / SAC Code</label><input id="gp_hsn" value="${escapeHTML(e.hsn||'')}" placeholder="84713 / 996511"/></div>
        <div class="field"><label>GST Rate (%)</label>
          <select id="gp_rate" onchange="GST._calcPurchTax()">
            ${[0,5,12,18,28].map(r=>`<option value="${r}" ${Number(e.rate||18)===r?'selected':''}>${r}%</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>GST Type</label>
          <select id="gp_gsttype" onchange="GST._calcPurchTax()">
            <option value="intra" ${(e.gstType||'intra')==='intra'?'selected':''}>Intrastate</option>
            <option value="inter" ${e.gstType==='inter'?'selected':''}>Interstate</option>
          </select>
        </div>
        <div class="field"><label>Taxable Amount *</label><input type="number" id="gp_taxable" value="${e.taxableAmt||''}" placeholder="50000" oninput="GST._calcPurchTax()"/></div>
        <div class="field"><label>GST Paid (Auto)</label><input type="number" id="gp_tax" readonly style="background:var(--s2)" value="${e.taxAmt||''}"/></div>
        <div class="field"><label>Total Invoice</label><input type="number" id="gp_total" readonly style="background:var(--s2)" value="${e.invoiceAmt||''}"/></div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-top:12px;padding:10px;background:var(--s2);border-radius:8px">
        <input type="checkbox" id="gp_itc" ${e.itcEligible===false?'':'checked'} style="width:16px;height:16px;cursor:pointer"/>
        <label for="gp_itc" style="font-size:13px;cursor:pointer">ITC Eligible (Uncheck if blocked — personal use, passenger vehicle, food, etc.)</label>
      </div>
      <div class="field" style="margin-top:10px"><label>Notes</label><input id="gp_notes" value="${escapeHTML(e.notes||'')}" placeholder="Purchase description"/></div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="GST.savePurchase('${id||''}')">💾 ${id?'Update':'Save'} Entry</button>
    `, true);
    setTimeout(() => this._calcPurchTax(), 100);
  },

  _calcPurchTax() {
    const taxable = +document.getElementById('gp_taxable')?.value||0;
    const rate    = +document.getElementById('gp_rate')?.value||0;
    const taxAmt  = taxable * rate / 100;
    const total   = taxable + taxAmt;
    const taxEl   = document.getElementById('gp_tax');   if (taxEl)   taxEl.value = taxAmt.toFixed(2);
    const totEl   = document.getElementById('gp_total'); if (totEl)   totEl.value = total.toFixed(2);
  },

  savePurchase(id) {
    const invNo   = document.getElementById('gp_inv')?.value.trim();
    const taxable = +document.getElementById('gp_taxable')?.value||0;
    if (!invNo)   { NOTIFY.show('Enter supplier invoice number','warning'); return; }
    if (!taxable) { NOTIFY.show('Enter taxable amount','warning'); return; }
    const rate   = +document.getElementById('gp_rate')?.value||0;
    const taxAmt = taxable * rate / 100;
    const data   = {
      date:        document.getElementById('gp_date')?.value,
      invoiceNo:   invNo,
      gstType:     document.getElementById('gp_gsttype')?.value||'intra',
      partyName:   document.getElementById('gp_party')?.value.trim()||'',
      partyGSTIN:  document.getElementById('gp_gstin')?.value.trim().toUpperCase()||'',
      hsn:         document.getElementById('gp_hsn')?.value.trim()||'',
      rate,
      taxableAmt:  taxable,
      taxAmt,
      invoiceAmt:  taxable + taxAmt,
      itcEligible: document.getElementById('gp_itc')?.checked !== false,
      notes:       document.getElementById('gp_notes')?.value.trim()||''
    };
    if (id) { STRATIX_DB.update('gstPurchases',id,data); NOTIFY.show('Updated!','success'); }
    else    { STRATIX_DB.push('gstPurchases',data);       NOTIFY.show('Purchase saved!','success'); }
    document.getElementById('gstPurchModal')?.remove();
    this._tab('purchases');
  },

  deletePurchase(id) {
    if (!confirm('Delete this purchase entry?')) return;
    STRATIX_DB.remove('gstPurchases',id);
    this._tab('purchases');
  },

  /* ── GSTR-1 SUMMARY ── */
  _renderGSTR1() {
    const sales  = STRATIX_DB.getArr('gstSales');
    const sym    = FIN.sym();
    const months = [...new Set(sales.map(e=>(e.date||'').slice(0,7)).filter(Boolean))].sort().reverse().slice(0,6);
    const selMonth = months[0] || FIN.monthKey(0);

    return `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
        <div class="card-title" style="margin:0">📑 GSTR-1 — Outward Supply Summary</div>
        <select id="gstr1Month" onchange="GST._refreshGSTR1(this.value)" style="padding:8px 12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt);font-size:13px">
          ${months.map(m=>`<option value="${m}" ${m===selMonth?'selected':''}>${new Date(m+'-01').toLocaleString('en-IN',{month:'long',year:'numeric'})}</option>`).join('')}
          <option value="all">All Periods</option>
        </select>
        <button class="btn btn-gold btn-sm" onclick="GST.exportGSTR1()">📥 Export GSTR-1</button>
        <button class="btn btn-ghost btn-sm" onclick="GST.printGSTR1()">🖨️ Print</button>
      </div>
    </div>
    <div id="gstr1Content">${this._buildGSTR1(selMonth, sales, sym)}</div>`;
  },

  _refreshGSTR1(month) {
    const sales = STRATIX_DB.getArr('gstSales');
    const el = document.getElementById('gstr1Content');
    if (el) el.innerHTML = this._buildGSTR1(month, sales, FIN.sym());
  },

  _buildGSTR1(month, sales, sym) {
    const filtered = month==='all' ? sales : sales.filter(e=>(e.date||'').startsWith(month));

    // Section 4A — B2B
    const b2b = filtered.filter(e=>e.type==='B2B'||e.type==='B2BL');
    const b2bTaxable = b2b.reduce((s,e)=>s+Number(e.taxableAmt||0),0);
    const b2bTax     = b2b.reduce((s,e)=>s+Number(e.taxAmt||0),0);

    // Section 5 — B2C Small (< ₹2.5L)
    const b2c = filtered.filter(e=>e.type==='B2C');
    const b2cTaxable = b2c.reduce((s,e)=>s+Number(e.taxableAmt||0),0);
    const b2cTax     = b2c.reduce((s,e)=>s+Number(e.taxAmt||0),0);

    // Exports
    const exp = filtered.filter(e=>e.type==='EXP');
    const expTaxable = exp.reduce((s,e)=>s+Number(e.taxableAmt||0),0);

    // Total
    const totalTaxable = filtered.reduce((s,e)=>s+Number(e.taxableAmt||0),0);
    const totalTax     = filtered.reduce((s,e)=>s+Number(e.taxAmt||0),0);
    const totalIntra   = filtered.filter(e=>e.gstType==='intra');
    const totalInter   = filtered.filter(e=>e.gstType==='inter');
    const cgst = totalIntra.reduce((s,e)=>s+Number(e.taxAmt||0)/2,0);
    const sgst = totalIntra.reduce((s,e)=>s+Number(e.taxAmt||0)/2,0);
    const igst = totalInter.reduce((s,e)=>s+Number(e.taxAmt||0),0);

    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">4A — B2B Supplies (Registered Buyers)</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">
        <div style="background:var(--s2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">No. of Invoices</div>
          <div style="font-size:18px;font-weight:800">${b2b.length}</div>
        </div>
        <div style="background:var(--s2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">Taxable Value</div>
          <div style="font-size:16px;font-weight:800">${FIN.fmt(b2bTaxable)}</div>
        </div>
        <div style="background:rgba(232,64,64,.07);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">Tax Amount</div>
          <div style="font-size:16px;font-weight:800;color:var(--red)">${FIN.fmt(b2bTax)}</div>
        </div>
      </div>
      ${b2b.length > 0 ? `
      <div class="tbl-scroll"><table>
        <thead><tr><th>GSTIN</th><th>Party</th><th>Invoices</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th></tr></thead>
        <tbody>
        ${Object.entries(b2b.reduce((acc,e)=>{
          const k = e.partyGSTIN||'Unregistered';
          if(!acc[k]) acc[k]={name:e.partyName||'',count:0,taxable:0,cgst:0,sgst:0,igst:0};
          acc[k].count++;
          acc[k].taxable+=Number(e.taxableAmt||0);
          if(e.gstType==='intra'){acc[k].cgst+=Number(e.taxAmt||0)/2;acc[k].sgst+=Number(e.taxAmt||0)/2;}
          else acc[k].igst+=Number(e.taxAmt||0);
          return acc;
        },{})).map(([gstin,d])=>`<tr>
          <td class="td-m" style="font-size:11px;font-family:monospace">${escapeHTML(gstin)}</td>
          <td class="td-b">${escapeHTML(d.name)}</td>
          <td>${d.count}</td>
          <td>${FIN.fmt(d.taxable)}</td>
          <td class="td-r">${d.cgst>0?FIN.fmt(d.cgst):'—'}</td>
          <td class="td-r">${d.sgst>0?FIN.fmt(d.sgst):'—'}</td>
          <td class="td-r">${d.igst>0?FIN.fmt(d.igst):'—'}</td>
        </tr>`).join('')}
        </tbody>
      </table></div>` : `<div style="color:var(--muted);font-size:13px;padding:8px 0">No B2B entries for this period.</div>`}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-title">5 — B2C Supplies (Unregistered)</div>
        <div class="gst-row"><span>No. of Invoices</span><span>${b2c.length}</span></div>
        <div class="gst-row"><span>Taxable Value</span><span>${FIN.fmt(b2cTaxable)}</span></div>
        <div class="gst-row total"><span>Tax Amount</span><span class="red">${FIN.fmt(b2cTax)}</span></div>
      </div>
      <div class="card">
        <div class="card-title">6A — Exports</div>
        <div class="gst-row"><span>No. of Invoices</span><span>${exp.length}</span></div>
        <div class="gst-row total"><span>Export Value</span><span>${FIN.fmt(expTaxable)}</span></div>
      </div>
    </div>

    <!-- Grand Total Box -->
    <div class="card" style="background:linear-gradient(135deg,rgba(37,99,235,.08),rgba(37,99,235,.03));border:1px solid rgba(37,99,235,.25)">
      <div class="card-title">📊 GSTR-1 Total — ${month==='all'?'All Periods':new Date(month+'-01').toLocaleString('en-IN',{month:'long',year:'numeric'})}</div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px">
        ${[
          ['Total Invoices', filtered.length, 'var(--txt)'],
          ['Taxable Value', FIN.fmt(totalTaxable), 'var(--txt)'],
          ['CGST', FIN.fmt(cgst), 'var(--red)'],
          ['SGST', FIN.fmt(sgst), 'var(--red)'],
          ['IGST', FIN.fmt(igst), 'var(--orange)'],
        ].map(([l,v,c])=>`<div style="text-align:center;padding:10px;background:var(--s2);border-radius:8px">
          <div style="font-size:10px;color:var(--muted)">${l}</div>
          <div style="font-size:15px;font-weight:800;color:${c}">${v}</div>
        </div>`).join('')}
      </div>
      <div style="text-align:center;margin-top:12px;padding:10px;background:rgba(37,99,235,.08);border-radius:8px">
        <span style="font-size:12px;color:var(--muted)">Total Output Tax: </span>
        <span style="font-size:20px;font-weight:800;color:var(--gold)">${FIN.fmt(totalTax)}</span>
      </div>
    </div>`;
  },

  /* ── GSTR-3B WORKING ── */
  _renderGSTR3B() {
    const sales     = STRATIX_DB.getArr('gstSales');
    const purchases = STRATIX_DB.getArr('gstPurchases');
    const months    = [...new Set([
      ...sales.map(e=>(e.date||'').slice(0,7)),
      ...purchases.map(e=>(e.date||'').slice(0,7))
    ].filter(Boolean))].sort().reverse().slice(0,6);
    const selMonth = months[0] || FIN.monthKey(0);

    return `
    <div class="card" style="margin-bottom:14px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      <div class="card-title" style="margin:0">📋 GSTR-3B Working Sheet</div>
      <select id="gstr3bMonth" onchange="GST._refreshGSTR3B(this.value)" style="padding:8px 12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt);font-size:13px">
        ${months.map(m=>`<option value="${m}" ${m===selMonth?'selected':''}>${new Date(m+'-01').toLocaleString('en-IN',{month:'long',year:'numeric'})}</option>`).join('')}
      </select>
      <button class="btn btn-ghost btn-sm" onclick="GST.printGSTR3B()">🖨️ Print</button>
    </div>
    <div id="gstr3bContent">${this._buildGSTR3B(selMonth, sales, purchases)}</div>`;
  },

  _refreshGSTR3B(month) {
    const el = document.getElementById('gstr3bContent');
    if (el) el.innerHTML = this._buildGSTR3B(month, STRATIX_DB.getArr('gstSales'), STRATIX_DB.getArr('gstPurchases'));
  },

  _buildGSTR3B(month, sales, purchases) {
    const fSales = month==='all' ? sales : sales.filter(e=>(e.date||'').startsWith(month));
    const fPurch = month==='all' ? purchases : purchases.filter(e=>(e.date||'').startsWith(month));

    // 3.1 — Outward supplies
    const outTaxable = fSales.reduce((s,e)=>s+Number(e.taxableAmt||0),0);
    const outTax     = fSales.reduce((s,e)=>s+Number(e.taxAmt||0),0);
    const outCGST    = fSales.filter(e=>e.gstType==='intra').reduce((s,e)=>s+Number(e.taxAmt||0)/2,0);
    const outSGST    = fSales.filter(e=>e.gstType==='intra').reduce((s,e)=>s+Number(e.taxAmt||0)/2,0);
    const outIGST    = fSales.filter(e=>e.gstType==='inter').reduce((s,e)=>s+Number(e.taxAmt||0),0);

    // 4 — ITC
    const eligiblePurch = fPurch.filter(e=>e.itcEligible!==false);
    const itcCGST       = eligiblePurch.filter(e=>e.gstType==='intra').reduce((s,e)=>s+Number(e.taxAmt||0)/2,0);
    const itcSGST       = eligiblePurch.filter(e=>e.gstType==='intra').reduce((s,e)=>s+Number(e.taxAmt||0)/2,0);
    const itcIGST       = eligiblePurch.filter(e=>e.gstType==='inter').reduce((s,e)=>s+Number(e.taxAmt||0),0);
    const itcTotal      = itcCGST + itcSGST + itcIGST;

    // 6 — Net payable
    const netCGST  = Math.max(0, outCGST - itcCGST);
    const netSGST  = Math.max(0, outSGST - itcSGST);
    const netIGST  = Math.max(0, outIGST - itcIGST);
    const netTotal = netCGST + netSGST + netIGST;

    const row = (label, taxable, cgst, sgst, igst, total, isTotal=false) =>
      `<tr ${isTotal?'style="background:var(--s2);font-weight:700"':''}>
        <td>${label}</td>
        <td>${taxable!==null?FIN.fmt(taxable):'—'}</td>
        <td class="td-r">${cgst!==null?FIN.fmt(cgst):'—'}</td>
        <td class="td-r">${sgst!==null?FIN.fmt(sgst):'—'}</td>
        <td class="td-r">${igst!==null?FIN.fmt(igst):'—'}</td>
        <td style="font-weight:700;color:${isTotal?'var(--gold)':'inherit'}">${FIN.fmt(total)}</td>
      </tr>`;

    return `
    <div class="tbl-wrap" style="margin-bottom:14px">
      <div class="tbl-head"><span class="tbl-title">3.1 — Details of Outward Supplies</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Nature of Supply</th><th>Taxable Value</th><th>CGST</th><th>SGST/UTGST</th><th>IGST</th><th>Total Tax</th></tr></thead>
        <tbody>
          ${row('(a) Outward taxable supplies', outTaxable, outCGST, outSGST, outIGST, outTax)}
          ${row('(b) Zero rated (Exports)', fSales.filter(e=>e.type==='EXP').reduce((s,e)=>s+Number(e.taxableAmt||0),0), 0, 0, 0, 0)}
          ${row('(c) Nil rated / Exempt', 0, 0, 0, 0, 0)}
          ${row('TOTAL', outTaxable, outCGST, outSGST, outIGST, outTax, true)}
        </tbody>
      </table></div>
    </div>

    <div class="tbl-wrap" style="margin-bottom:14px">
      <div class="tbl-head"><span class="tbl-title">4 — Eligible ITC</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>ITC Type</th><th>Taxable Value</th><th>CGST</th><th>SGST/UTGST</th><th>IGST</th><th>Total</th></tr></thead>
        <tbody>
          ${row('(A) ITC Available — All other ITC', eligiblePurch.reduce((s,e)=>s+Number(e.taxableAmt||0),0), itcCGST, itcSGST, itcIGST, itcTotal)}
          ${row('(B) ITC Reversed / Blocked', fPurch.filter(e=>e.itcEligible===false).reduce((s,e)=>s+Number(e.taxableAmt||0),0), 0, 0, 0, fPurch.filter(e=>e.itcEligible===false).reduce((s,e)=>s+Number(e.taxAmt||0),0))}
          ${row('NET ITC AVAILABLE', null, itcCGST, itcSGST, itcIGST, itcTotal, true)}
        </tbody>
      </table></div>
    </div>

    <div class="card" style="background:linear-gradient(135deg,rgba(${netTotal>0?'232,64,64':'0,214,143'},.08),rgba(0,0,0,.0));border:1px solid rgba(${netTotal>0?'232,64,64':'0,214,143'},.25)">
      <div class="card-title">6 — Net GST Payable in Cash</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
        ${[['CGST',netCGST],['SGST',netSGST],['IGST',netIGST],['TOTAL',netTotal]].map(([l,v])=>`
        <div style="text-align:center;padding:12px;background:var(--s2);border-radius:8px">
          <div style="font-size:10px;color:var(--muted)">${l}</div>
          <div style="font-size:18px;font-weight:800;color:${v>0?'var(--red)':'var(--green)'}">${FIN.fmt(v)}</div>
        </div>`).join('')}
      </div>
      ${netTotal > 0 ? `
      <div style="margin-top:12px;padding:10px 14px;background:rgba(232,64,64,.08);border-radius:8px;font-size:13px;color:var(--red);font-weight:600">
        ⚠️ Cash payment of ${FIN.fmt(netTotal)} due by 20th of next month. File before deadline to avoid interest @18% per annum.
      </div>` : `
      <div style="margin-top:12px;padding:10px 14px;background:rgba(0,214,143,.08);border-radius:8px;font-size:13px;color:var(--green);font-weight:600">
        ✅ ITC is sufficient to cover output liability. No cash payment required this period.
      </div>`}
    </div>`;
  },

  /* ── HSN SUMMARY ── */
  _renderHSNSummary() {
    const sales     = STRATIX_DB.getArr('gstSales');
    const purchases = STRATIX_DB.getArr('gstPurchases');

    const hsnMap = {};
    [...sales,...purchases].forEach(e => {
      const k = e.hsn || 'Not Specified';
      if (!hsnMap[k]) hsnMap[k] = { taxable:0, tax:0, count:0, type:e===sales?'Sales':'Purch' };
      hsnMap[k].taxable += Number(e.taxableAmt||0);
      hsnMap[k].tax     += Number(e.taxAmt||0);
      hsnMap[k].count   += 1;
    });

    const hsnList = Object.entries(hsnMap).sort((a,b)=>b[1].taxable-a[1].taxable);

    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">🔢 HSN/SAC Summary — For GSTR-1 Table 12</div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:14px">Required in GSTR-1 from FY 2022-23. Aggregate turnover &gt; ₹5 Cr: 6-digit HSN mandatory. Others: 4-digit.</p>
    </div>
    ${hsnList.length === 0 ? `<div class="card" style="text-align:center;padding:32px;color:var(--muted)">No entries with HSN/SAC codes. Add HSN while recording sales/purchases.</div>` : `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">HSN/SAC Wise Summary (${hsnList.length} codes)</span><button class="btn btn-ghost btn-sm" onclick="GST.exportHSNCSV()">📥 Export</button></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>HSN/SAC Code</th><th>Description (from common codes)</th><th>Transactions</th><th>Taxable Value</th><th>GST Amount</th><th>Effective Rate</th></tr></thead>
        <tbody>
        ${hsnList.map(([hsn,d]) => {
          const desc = {
            '996511':'Road transport by goods vehicle',
            '9965':'Goods transport services',
            '9963':'Accommodation services',
            '9984':'Telecom & internet',
            '9983':'Consulting / professional services',
            '84713':'Computers & peripherals',
            '8704':'Goods vehicles',
            '7214':'Steel bars & rods',
            '3004':'Pharmaceutical products',
          }[hsn] || 'Goods/Services';
          const rate = d.taxable > 0 ? ((d.tax/d.taxable)*100).toFixed(1) : 0;
          return `<tr>
            <td class="td-b" style="font-family:monospace">${escapeHTML(hsn)}</td>
            <td class="td-m" style="font-size:11px">${escapeHTML(desc)}</td>
            <td>${d.count}</td>
            <td>${FIN.fmt(d.taxable)}</td>
            <td class="td-r">${FIN.fmt(d.tax)}</td>
            <td>${rate}%</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`}`;
  },

  /* ── FILING CALENDAR ── */
  _renderCalendar() {
    const now  = new Date();
    const mon  = now.toLocaleString('en-IN',{month:'long',year:'numeric'});
    const due11 = new Date(now.getFullYear(), now.getMonth()+1, 11);
    const due20 = new Date(now.getFullYear(), now.getMonth()+1, 20);
    const daysTo11 = Math.round((due11-now)/86400000);
    const daysTo20 = Math.round((due20-now)/86400000);

    const deadlines = [
      { form:'GSTR-1', desc:'Outward supplies (B2B + B2C)', due:'11th of next month', days:daysTo11, urgent:daysTo11<=5 },
      { form:'GSTR-3B', desc:'Monthly summary + tax payment', due:'20th of next month', days:daysTo20, urgent:daysTo20<=5 },
      { form:'GSTR-2B', desc:'ITC auto-drafted (view only)', due:'14th of next month', days:Math.round((new Date(now.getFullYear(),now.getMonth()+1,14)-now)/86400000), urgent:false },
      { form:'GSTR-9', desc:'Annual return (FY 2024-25)', due:'31 Dec 2025', days:null, urgent:false },
      { form:'GSTR-9C', desc:'Reconciliation (Turnover > ₹5Cr)', due:'31 Dec 2025', days:null, urgent:false },
    ];

    const compliance = [
      { task:'PF Contribution', due:'15th of every month', penalty:'₹5000+' },
      { task:'ESI Contribution', due:'21st of every month', penalty:'₹5000+' },
      { task:'TDS Deposit', due:'7th of next month', penalty:'1.5%/month' },
      { task:'Advance Tax (Q1)', due:'15 June', penalty:'1%/month (Sec 234C)' },
      { task:'Advance Tax (Q2)', due:'15 Sep', penalty:'1%/month (Sec 234C)' },
      { task:'Advance Tax (Q3)', due:'15 Dec', penalty:'1%/month (Sec 234C)' },
      { task:'Advance Tax (Q4)', due:'15 Mar', penalty:'1%/month (Sec 234C)' },
      { task:'ITR Filing', due:'31 July (non-audit)', penalty:'₹5000 (Sec 234F)' },
    ];

    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <div>
        <div class="card" style="margin-bottom:14px">
          <div class="card-title">📅 GST Filing Deadlines — ${mon}</div>
          ${deadlines.map(d=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--b1)">
            <div>
              <div style="font-size:13px;font-weight:700;color:${d.urgent?'var(--red)':'var(--txt)'}">${d.form}</div>
              <div style="font-size:11px;color:var(--muted)">${d.desc}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:12px;font-weight:600;color:var(--muted)">${d.due}</div>
              ${d.days!==null ? `<div style="font-size:11px;font-weight:700;color:${d.urgent?'var(--red)':d.days<=10?'var(--orange)':'var(--green)'}">${d.days>0?d.days+'d away':d.days===0?'TODAY!':'OVERDUE'}</div>` : ''}
            </div>
          </div>`).join('')}
        </div>
      </div>

      <div>
        <div class="card">
          <div class="card-title">📋 Full Compliance Calendar</div>
          ${compliance.map(c=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 0;border-bottom:1px solid var(--b1)">
            <div>
              <div style="font-size:12px;font-weight:700">${c.task}</div>
              <div style="font-size:11px;color:var(--muted)">Due: ${c.due}</div>
            </div>
            <div style="font-size:11px;color:var(--red);font-weight:600">${c.penalty}</div>
          </div>`).join('')}
          <div class="alert" style="background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.3);margin-top:12px">
            <span>⚠️</span><div style="font-size:12px">Always verify with your CA. Tax laws change frequently. This calendar is for reference only.</div>
          </div>
        </div>
      </div>
    </div>`;
  },

  /* ── EXPORTS ── */
  exportGSTR1() {
    const sales = STRATIX_DB.getArr('gstSales');
    if (sales.length===0) { NOTIFY.show('No sales entries to export','warning'); return; }
    const rows = [['Date','Invoice No.','Party Name','Party GSTIN','Supply Type','GST Type','HSN/SAC','Rate%','Taxable Amt','CGST','SGST','IGST','Invoice Total']];
    sales.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(e=>{
      const intra = e.gstType==='intra';
      rows.push([
        e.date||'', `"${e.invoiceNo||''}"`, `"${e.partyName||''}"`, e.partyGSTIN||'',
        e.type||'B2C', e.gstType||'intra', e.hsn||'', e.rate||0,
        e.taxableAmt||0,
        intra?(e.taxAmt||0)/2:0, intra?(e.taxAmt||0)/2:0, intra?0:(e.taxAmt||0),
        e.invoiceAmt||0
      ]);
    });
    FIN.downloadCSV(rows, `STRATIX_GSTR1_${FIN.today()}.csv`);
    NOTIFY.show('GSTR-1 exported!','success');
  },

  exportSalesCSV() { this.exportGSTR1(); },

  exportPurchaseCSV() {
    const purchases = STRATIX_DB.getArr('gstPurchases');
    if (purchases.length===0) { NOTIFY.show('No purchase entries','warning'); return; }
    const rows = [['Date','Supplier Invoice','Supplier','GSTIN','HSN','Rate%','Taxable','GST Paid','ITC Eligible','Total']];
    purchases.forEach(e=>rows.push([e.date||'',`"${e.invoiceNo||''}"`,`"${e.partyName||''}"`,e.partyGSTIN||'',e.hsn||'',e.rate||0,e.taxableAmt||0,e.taxAmt||0,e.itcEligible!==false?'Yes':'No',e.invoiceAmt||0]));
    FIN.downloadCSV(rows, `STRATIX_Purchases_${FIN.today()}.csv`);
    NOTIFY.show('Purchase register exported!','success');
  },

  exportHSNCSV() {
    const sales = STRATIX_DB.getArr('gstSales');
    const purchases = STRATIX_DB.getArr('gstPurchases');
    const hsnMap = {};
    [...sales,...purchases].forEach(e=>{
      const k = e.hsn||'Not Specified';
      if(!hsnMap[k]) hsnMap[k]={taxable:0,tax:0,count:0};
      hsnMap[k].taxable+=Number(e.taxableAmt||0);
      hsnMap[k].tax+=Number(e.taxAmt||0);
      hsnMap[k].count+=1;
    });
    const rows = [['HSN/SAC Code','Transactions','Taxable Value','GST Amount','Effective Rate']];
    Object.entries(hsnMap).forEach(([k,d])=>rows.push([k,d.count,d.taxable,d.tax,d.taxable>0?((d.tax/d.taxable)*100).toFixed(1)+'%':'0%']));
    FIN.downloadCSV(rows, `STRATIX_HSN_${FIN.today()}.csv`);
    NOTIFY.show('HSN summary exported!','success');
  },

  printGSTR1() {
    const selMonth = document.getElementById('gstr1Month')?.value || FIN.monthKey(0);
    const sales    = STRATIX_DB.getArr('gstSales');
    const cfg      = STRATIX_DB.getSettings();
    const win      = window.open('','_blank','width=900,height=700');
    if (!win) { NOTIFY.show('Allow popups and try again','warning'); return; }
    const content  = this._buildGSTR1(selMonth, sales, cfg.currencySymbol||'₹');
    win.document.write(`<!DOCTYPE html><html><head><title>GSTR-1 — ${cfg.businessName||'Business'}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:28px;color:#111;background:#fff}.card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:14px}.card-title{font-size:13px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #eee}.tbl-wrap{margin-bottom:14px}.gst-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px}.gst-row.total{font-weight:700;font-size:14px;border-top:2px solid #ccc;padding-top:8px}.td-b{font-weight:700}.td-r{color:#dc2626}.td-g{color:#16a34a}@media print{body{padding:12px}}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #2563EB">
      <div><h2 style="font-size:18px;font-weight:800">${escapeHTML(cfg.businessName||'Your Business')}</h2><div style="font-size:12px;color:#666">GSTIN: ${escapeHTML(cfg.gstNumber||'—')} | ${escapeHTML(cfg.address||'')}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:800;color:#2563EB">GSTR-1</div><div style="font-size:12px;color:#666">Generated: ${new Date().toLocaleDateString('en-IN')}</div></div>
    </div>
    ${content.replace(/<button[^>]*>.*?<\/button>/gs,'').replace(/onclick="[^"]*"/g,'').replace(/style="cursor:pointer[^"]*"/g,'')}
    <div style="margin-top:20px;text-align:center;font-size:11px;color:#aaa">Generated by STRATIX · Verify with your CA before filing · stratix.app</div>
    <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:10px 20px;background:#2563EB;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px">🖨️ Print</button>
    </body></html>`);
    win.document.close();
  },

  printGSTR3B() {
    const selMonth  = document.getElementById('gstr3bMonth')?.value || FIN.monthKey(0);
    const sales     = STRATIX_DB.getArr('gstSales');
    const purchases = STRATIX_DB.getArr('gstPurchases');
    const cfg       = STRATIX_DB.getSettings();
    const win       = window.open('','_blank','width=900,height=700');
    if (!win) { NOTIFY.show('Allow popups and try again','warning'); return; }
    const content   = this._buildGSTR3B(selMonth, sales, purchases);
    win.document.write(`<!DOCTYPE html><html><head><title>GSTR-3B — ${cfg.businessName||'Business'}</title>
    <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:28px;color:#111;background:#fff}.card{background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:14px}.card-title{font-size:13px;font-weight:800;color:#555;text-transform:uppercase;margin-bottom:12px}table{width:100%;border-collapse:collapse;font-size:12px}th{background:#1a1a2e;color:#fff;padding:8px;text-align:left}td{padding:7px 8px;border-bottom:1px solid #eee}.tbl-wrap{margin-bottom:14px}.td-r{color:#dc2626}.td-g{color:#16a34a}@media print{body{padding:12px}}</style>
    </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #2563EB">
      <div><h2 style="font-size:18px;font-weight:800">${escapeHTML(cfg.businessName||'Your Business')}</h2><div style="font-size:12px;color:#666">GSTIN: ${escapeHTML(cfg.gstNumber||'—')}</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:800;color:#2563EB">GSTR-3B Working</div><div style="font-size:12px;color:#666">Generated: ${new Date().toLocaleDateString('en-IN')}</div></div>
    </div>
    ${content.replace(/<button[^>]*>.*?<\/button>/gs,'').replace(/onclick="[^"]*"/g,'')}
    <div style="margin-top:20px;text-align:center;font-size:11px;color:#aaa">Generated by STRATIX · Verify with CA · stratix.app</div>
    <button onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:10px 20px;background:#2563EB;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px">🖨️ Print</button>
    </body></html>`);
    win.document.close();
  }
};


/* ══════════════════════════════════════════════════════════════
   MODULE 2 — PAYROLL DEEP
   (replaces features.js renderSalary)
   ══════════════════════════════════════════════════════════════ */

function renderPayrollDeep(activeTab) {
  activeTab = activeTab || 'employees';
  const employees = STRATIX_DB.getArr('employees');
  const payslips  = STRATIX_DB.getArr('payslips');
  const advances  = STRATIX_DB.getArr('advances');
  const sym       = FIN.sym();

  const currentMonth = new Date().toISOString().slice(0,7);
  const monthLabel   = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});
  const totalPayroll = employees.reduce((s,e)=>s+PAY._calc(e).netPay,0);
  const totalCTC     = employees.reduce((s,e)=>{const c=PAY._calc(e);return s+c.gross+c.pfEmployer+c.esiEmployer;},0);
  const pendingAdv   = advances.filter(a=>!a.recovered).reduce((s,a)=>s+Number(a.amount||0)-Number(a.recoveredAmt||0),0);

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">💸 Payroll Management</h1>
        <p class="sec-sub">PF · ESI · TDS · PT · Attendance · Leave · Advances · CA-ready reports</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="PAY.openAddEmployee()">+ Add Employee</button>
        <button class="btn btn-outline" onclick="PAY.confirmRunPayroll()">▶ Run ${monthLabel}</button>
        <button class="btn btn-ghost btn-sm" onclick="PAY.exportPayrollCSV()">📥 CA Export</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:18px">
      <div class="kpi accent"><div class="kpi-lbl">Employees</div><div class="kpi-val">${employees.length}</div><div class="kpi-trend">${employees.filter(e=>e.status!=='inactive').length} active</div></div>
      <div class="kpi"><div class="kpi-lbl">Monthly Net Payout</div><div class="kpi-val">${FIN.fmt(totalPayroll)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Total CTC</div><div class="kpi-val">${FIN.fmt(totalCTC)}</div><div class="kpi-trend muted">incl. employer PF+ESI</div></div>
      <div class="kpi"><div class="kpi-lbl">PF + ESI (Govt)</div><div class="kpi-val red">${FIN.fmt(employees.reduce((s,e)=>{const c=PAY._calc(e);return s+c.pfEmployee+c.pfEmployer+c.esiEmployee+c.esiEmployer;},0))}</div></div>
      <div class="kpi ${pendingAdv>0?'':''}"><div class="kpi-lbl">Advance Pending</div><div class="kpi-val ${pendingAdv>0?'orange':''}">${FIN.fmt(pendingAdv)}</div><div class="kpi-trend muted">${advances.filter(a=>!a.recovered).length} employees</div></div>
    </div>

    <div class="calc-tabs" style="margin-bottom:16px">
      <button class="calc-tab${activeTab==='employees'?' active':''}" data-paytab="employees" onclick="PAY._tab('employees')">👤 Employees</button>
      <button class="calc-tab${activeTab==='payroll'?' active':''}" data-paytab="payroll" onclick="PAY._tab('payroll')">💰 Run Payroll</button>
      <button class="calc-tab${activeTab==='attendance'?' active':''}" data-paytab="attendance" onclick="PAY._tab('attendance')">📅 Attendance</button>
      <button class="calc-tab${activeTab==='advances'?' active':''}" data-paytab="advances" onclick="PAY._tab('advances')">💳 Advances</button>
      <button class="calc-tab${activeTab==='payslips'?' active':''}" data-paytab="payslips" onclick="PAY._tab('payslips')">📋 Payslips</button>
      <button class="calc-tab${activeTab==='challan'?' active':''}" data-paytab="challan" onclick="PAY._tab('challan')">🏛️ PF/ESI/TDS</button>
    </div>

    <div id="payTabContent">${PAY._renderTab(activeTab)}</div>
    <div id="payModal"></div>
  </div>`;
}

const PAY = {
  _tab(tab) {
    document.querySelectorAll('[data-paytab]').forEach(b => b.classList.toggle('active', b.dataset.paytab === tab));
    const el = document.getElementById('payTabContent');
    if (el) el.innerHTML = this._renderTab(tab);
  },

  _renderTab(tab) {
    if (tab === 'employees')  return this._renderEmployees();
    if (tab === 'payroll')    return this._renderPayrollTable();
    if (tab === 'attendance') return this._renderAttendance();
    if (tab === 'advances')   return this._renderAdvances();
    if (tab === 'payslips')   return this._renderPayslips();
    if (tab === 'challan')    return this._renderChallan();
    return '';
  },

  /* ── SALARY CALCULATION ENGINE ── */
  _calc(e) {
    const basic   = Number(e.basic||0);
    const hra     = Number(e.hra||0)     || Math.round(Math.round(basic * 0.40 * 100) / 100);
    const da      = Number(e.da||0)      || Math.round(Math.round(basic * 0.10 * 100) / 100);
    const special = Number(e.special||0);
    const otherA  = Number(e.otherAllow||0);
    const gross   = basic + hra + da + special + otherA;

    // PF — 12% of basic, capped at ₹15,000 basic
    const pfEmployee = basic <= 15000 ? Math.round(Math.round(basic * 0.12 * 100) / 100) : 1800;
    const pfEmployer = basic <= 15000 ? Math.round(Math.round(basic * 0.12 * 100) / 100) : 1800;

    // ESI — only if gross ≤ ₹21,000
    const esiEmployee = gross <= 21000 ? Math.round(Math.round(gross * 0.0075 * 100) / 100) : 0;
    const esiEmployer = gross <= 21000 ? Math.round(Math.round(gross * 0.0325 * 100) / 100) : 0;

    // Professional Tax — Maharashtra slab (FY 2025-26)
    const state = STRATIX_DB.getSettings().state || 'Maharashtra';
    let pt = 0;
    if (state === 'Maharashtra')   pt = gross > 10000 ? 200 : gross > 7500 ? 175 : 0;
    else if (state === 'Karnataka') pt = gross >= 25000 ? 200 : gross >= 15000 ? 150 : gross >= 10000 ? 100 : 0;
    else if (state === 'Tamil Nadu') pt = gross >= 21000 ? 208 : gross >= 15001 ? 173 : gross >= 10001 ? 130 : gross >= 7501 ? 86 : 0;
    else if (['Gujarat','Madhya Pradesh'].includes(state)) pt = gross >= 12000 ? 200 : 0;
    else pt = gross > 10000 ? 200 : 0;

    // TDS — New Regime FY 2025-26, Rebate u/s 87A ≤ ₹12L
    const annualGross = gross * 12;
    let annualTax = 0;
    if (annualGross > 400000) {
      if      (annualGross <= 800000)  annualTax = (annualGross-400000)*0.05;
      else if (annualGross <= 1200000) annualTax = 20000+(annualGross-800000)*0.10;
      else if (annualGross <= 1600000) annualTax = 60000+(annualGross-1200000)*0.15;
      else if (annualGross <= 2000000) annualTax = 120000+(annualGross-1600000)*0.20;
      else if (annualGross <= 2400000) annualTax = 200000+(annualGross-2000000)*0.25;
      else                              annualTax = 300000+(annualGross-2400000)*0.30;
      if (annualGross <= 1200000) annualTax = 0; // 87A rebate
    }
    annualTax = Math.round(annualTax * 1.04); // 4% cess
    const tds = Math.round(annualTax / 12);

    // Advance recovery this month
    const advances    = STRATIX_DB.getArr('advances');
    const pendingAdv  = advances.find(a => a.empId === e.id && !a.recovered);
    const advRecovery = pendingAdv ? Math.min(Number(pendingAdv.amount||0) - Number(pendingAdv.recoveredAmt||0), Math.round(basic * 0.5)) : 0;
    // OT
    const otPay = Math.round(Number(e.otHours||0) * (basic/26/8) * 2);

    const totalDeductions = pfEmployee + esiEmployee + pt + tds + advRecovery;
    const netPay = gross + otPay - totalDeductions;

    return { basic, hra, da, special, otherA, gross, otPay,
             pfEmployee, pfEmployer, esiEmployee, esiEmployer, pt, tds,
             advRecovery, totalDeductions, netPay,
             ctc: gross + otPay + pfEmployer + esiEmployer };
  },

  /* ── EMPLOYEES LIST ── */
  _renderEmployees() {
    const employees = STRATIX_DB.getArr('employees');
    if (employees.length === 0) return `<div class="card" style="text-align:center;padding:56px 20px">
      <div style="font-size:48px;margin-bottom:14px">👥</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No Employees Added</h3>
      <p style="color:var(--muted);max-width:300px;margin:0 auto 20px">Add employees to manage payroll with automatic PF, ESI, PT & TDS.</p>
      <button class="btn btn-gold" onclick="PAY.openAddEmployee()">+ Add First Employee</button>
    </div>`;

    return `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Employee Master (${employees.length})</span>
        <div style="display:flex;gap:8px">
          <select onchange="PAY._filterEmp(this.value)" style="padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt)">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button class="btn btn-gold btn-sm" onclick="PAY.openAddEmployee()">+ Add</button>
        </div>
      </div>
      <div class="tbl-scroll" id="empTable"><table>
        <thead><tr><th>Employee</th><th>Department</th><th>Basic</th><th>Gross</th><th>PF (EE)</th><th>ESI (EE)</th><th>PT</th><th>TDS</th><th>Net Pay</th><th>CTC</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
        ${employees.map(e => {
          const sal = this._calc(e);
          return `<tr>
            <td>
              <div class="td-b">${escapeHTML(e.name)}</div>
              <div style="font-size:10px;color:var(--muted)">${escapeHTML(e.designation||'—')} · EMP${escapeHTML(e.empId||'—')}</div>
            </td>
            <td class="td-m">${escapeHTML(e.department||'—')}</td>
            <td>${FIN.fmt(e.basic||0)}</td>
            <td>${FIN.fmt(sal.gross)}</td>
            <td class="td-r">${FIN.fmt(sal.pfEmployee)}</td>
            <td class="td-r">${sal.esiEmployee>0?FIN.fmt(sal.esiEmployee):'—'}</td>
            <td class="td-r">${sal.pt>0?FIN.fmt(sal.pt):'—'}</td>
            <td class="td-r">${sal.tds>0?FIN.fmt(sal.tds):'—'}</td>
            <td style="font-weight:800;color:var(--gold)">${FIN.fmt(sal.netPay)}</td>
            <td class="td-m">${FIN.fmt(sal.ctc)}</td>
            <td>${FIN.badge(e.status||'active',e.status==='inactive'?'bm':'bg')}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="PAY.openEditEmployee('${e.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="PAY.generatePayslip('${e.id}')">📋</button>
                <button class="del-btn" onclick="PAY.deleteEmployee('${e.id}')">🗑</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`;
  },

  _filterEmp(status) {
    const all  = STRATIX_DB.getArr('employees');
    const list = status==='all' ? all : all.filter(e=>(e.status||'active')===status);
    const el   = document.getElementById('empTable');
    if (el) {
      const rows = list.map(e=>{
        const sal=this._calc(e);
        return `<tr>
          <td><div class="td-b">${escapeHTML(e.name)}</div><div style="font-size:10px;color:var(--muted)">${escapeHTML(e.designation||'—')}</div></td>
          <td class="td-m">${escapeHTML(e.department||'—')}</td>
          <td>${FIN.fmt(e.basic||0)}</td>
          <td>${FIN.fmt(sal.gross)}</td>
          <td class="td-r">${FIN.fmt(sal.pfEmployee)}</td>
          <td class="td-r">${sal.esiEmployee>0?FIN.fmt(sal.esiEmployee):'—'}</td>
          <td class="td-r">${sal.pt>0?FIN.fmt(sal.pt):'—'}</td>
          <td class="td-r">${sal.tds>0?FIN.fmt(sal.tds):'—'}</td>
          <td style="font-weight:800;color:var(--gold)">${FIN.fmt(sal.netPay)}</td>
          <td class="td-m">${FIN.fmt(sal.ctc)}</td>
          <td>${FIN.badge(e.status||'active',e.status==='inactive'?'bm':'bg')}</td>
          <td><div style="display:flex;gap:4px"><button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="PAY.openEditEmployee('${e.id}')">✏️</button><button class="del-btn" onclick="PAY.deleteEmployee('${e.id}')">🗑</button></div></td>
        </tr>`;
      }).join('');
      el.querySelector('tbody').innerHTML = rows;
    }
  },

  /* ── PAYROLL TABLE ── */
  _renderPayrollTable() {
    const employees = STRATIX_DB.getArr('employees');
    if (employees.length === 0) return `<div class="card" style="text-align:center;padding:40px;color:var(--muted)">Add employees first.</div>`;

    const monthLabel = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});
    let totals = {gross:0,pfEE:0,pfER:0,esiEE:0,esiER:0,pt:0,tds:0,adv:0,ot:0,net:0,ctc:0};
    employees.forEach(e=>{const s=this._calc(e);totals.gross+=s.gross;totals.pfEE+=s.pfEmployee;totals.pfER+=s.pfEmployer;totals.esiEE+=s.esiEmployee;totals.esiER+=s.esiEmployer;totals.pt+=s.pt;totals.tds+=s.tds;totals.adv+=s.advRecovery;totals.ot+=s.otPay;totals.net+=s.netPay;totals.ctc+=s.ctc;});

    return `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px">
      <div style="background:var(--s2);padding:12px;border-radius:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted)">Total Gross</div><div style="font-size:16px;font-weight:800">${FIN.fmt(totals.gross)}</div>
      </div>
      <div style="background:rgba(232,64,64,.07);padding:12px;border-radius:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted)">Employer CTC Add-on</div><div style="font-size:16px;font-weight:800;color:var(--red)">${FIN.fmt(totals.pfER+totals.esiER)}</div>
      </div>
      <div style="background:rgba(37,99,235,.07);padding:12px;border-radius:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted)">Total CTC</div><div style="font-size:16px;font-weight:800;color:var(--gold)">${FIN.fmt(totals.ctc)}</div>
      </div>
      <div style="background:rgba(0,214,143,.07);padding:12px;border-radius:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted)">Net Cash Payout</div><div style="font-size:16px;font-weight:800;color:var(--green)">${FIN.fmt(totals.net)}</div>
      </div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Payroll Sheet — ${monthLabel}</span>
        <button class="btn btn-gold btn-sm" onclick="PAY.confirmRunPayroll()">▶ Run & Generate Payslips</button>
      </div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Employee</th><th>Basic</th><th>HRA</th><th>DA</th><th>OT Pay</th><th>Gross</th><th>PF (EE)</th><th>ESI (EE)</th><th>PT</th><th>TDS</th><th>Adv. Rec.</th><th>Net Pay</th><th>Employer CTC</th></tr></thead>
        <tbody>
        ${employees.map(e=>{
          const s=this._calc(e);
          return `<tr>
            <td><div class="td-b">${escapeHTML(e.name)}</div><div style="font-size:10px;color:var(--muted)">${escapeHTML(e.designation||'—')}</div></td>
            <td>${FIN.fmt(e.basic||0)}</td>
            <td>${FIN.fmt(s.hra)}</td>
            <td>${FIN.fmt(s.da)}</td>
            <td class="td-g">${s.otPay>0?FIN.fmt(s.otPay):'—'}</td>
            <td style="font-weight:700">${FIN.fmt(s.gross)}</td>
            <td class="td-r">${FIN.fmt(s.pfEmployee)}</td>
            <td class="td-r">${s.esiEmployee>0?FIN.fmt(s.esiEmployee):'—'}</td>
            <td class="td-r">${s.pt>0?FIN.fmt(s.pt):'—'}</td>
            <td class="td-r">${s.tds>0?FIN.fmt(s.tds):'—'}</td>
            <td class="td-r">${s.advRecovery>0?FIN.fmt(s.advRecovery):'—'}</td>
            <td style="font-weight:800;color:var(--gold)">${FIN.fmt(s.netPay)}</td>
            <td class="td-m">${FIN.fmt(s.ctc)}</td>
          </tr>`;
        }).join('')}
        <tr style="background:var(--s2);font-weight:700">
          <td>TOTALS</td>
          <td>—</td><td>—</td><td>—</td>
          <td class="td-g">${totals.ot>0?FIN.fmt(totals.ot):'—'}</td>
          <td>${FIN.fmt(totals.gross)}</td>
          <td class="td-r">${FIN.fmt(totals.pfEE)}</td>
          <td class="td-r">${FIN.fmt(totals.esiEE)}</td>
          <td class="td-r">${FIN.fmt(totals.pt)}</td>
          <td class="td-r">${FIN.fmt(totals.tds)}</td>
          <td class="td-r">${totals.adv>0?FIN.fmt(totals.adv):'—'}</td>
          <td style="color:var(--green)">${FIN.fmt(totals.net)}</td>
          <td>${FIN.fmt(totals.ctc)}</td>
        </tr>
        </tbody>
      </table></div>
    </div>

    <div class="alert" style="background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.3);margin-top:12px">
      <span>💡</span>
      <div>PF (Employer ${FIN.fmt(totals.pfER)}) due by 15th · ESI (Employer ${FIN.fmt(totals.esiER)}) due by 21st · TDS ${FIN.fmt(totals.tds)} due by 7th next month</div>
    </div>`;
  },

  /* ── ATTENDANCE ── */
  _renderAttendance() {
    const employees  = STRATIX_DB.getArr('employees');
    const attendance = STRATIX_DB.getArr('attendance');
    const today      = FIN.today();
    const monthKey   = today.slice(0,7);

    if (employees.length === 0) return `<div class="card" style="text-align:center;padding:40px;color:var(--muted)">Add employees first.</div>`;

    // Working days in this month
    const daysInMonth = new Date(new Date(monthKey+'-01').getFullYear(), new Date(monthKey+'-01').getMonth()+1, 0).getDate();
    const workingDays = 26; // standard for salary calc

    return `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div class="card-title">📅 Attendance — ${new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})}</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-gold btn-sm" onclick="PAY.markAllPresent()">✅ Mark All Present Today</button>
          <button class="btn btn-ghost btn-sm" onclick="PAY.exportAttendanceCSV()">📥 Export</button>
        </div>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Working days this month: <strong>${daysInMonth}</strong> calendar · <strong>${workingDays}</strong> for salary calc · Mark P (Present), A (Absent), H (Half-day), L (Leave)</div>

      <div class="tbl-scroll"><table>
        <thead><tr><th>Employee</th><th>Today</th><th>Present</th><th>Absent</th><th>Half-Day</th><th>Leave</th><th>OT Hours</th><th>Effective Days</th><th>Actions</th></tr></thead>
        <tbody>
        ${employees.map(e => {
          const empAtt  = attendance.filter(a=>a.empId===e.id&&(a.date||'').startsWith(monthKey));
          const present = empAtt.filter(a=>a.status==='P').length;
          const absent  = empAtt.filter(a=>a.status==='A').length;
          const half    = empAtt.filter(a=>a.status==='H').length;
          const leave   = empAtt.filter(a=>a.status==='L').length;
          const otHours = empAtt.reduce((s,a)=>s+Number(a.otHours||0),0);
          const effective = present + (half*0.5) + leave; // assume paid leave
          const todayAtt  = attendance.find(a=>a.empId===e.id&&a.date===today);
          return `<tr>
            <td class="td-b">${escapeHTML(e.name)}</td>
            <td>
              <div style="display:flex;gap:4px">
                ${['P','A','H','L'].map(s=>`<button onclick="PAY.markAttendance('${e.id}','${today}','${s}')" style="padding:3px 7px;border-radius:5px;border:1px solid ${todayAtt?.status===s?'var(--gold)':'var(--b1)'};background:${todayAtt?.status===s?'rgba(37,99,235,.15)':'transparent'};color:${todayAtt?.status===s?'var(--gold)':'var(--muted)'};font-size:10px;cursor:pointer;font-weight:700">${s}</button>`).join('')}
              </div>
            </td>
            <td class="td-g">${present}</td>
            <td class="td-r">${absent}</td>
            <td>${half}</td>
            <td>${leave}</td>
            <td>
              <input type="number" value="${Number(e.otHours||0)}" min="0" max="200"
                style="width:55px;background:var(--s2);border:1px solid var(--b1);border-radius:6px;padding:3px 6px;color:var(--txt);font-size:12px;outline:none"
                onchange="PAY.updateOT('${e.id}',this.value)"/>
            </td>
            <td style="font-weight:700;color:var(--gold)">${effective.toFixed(1)}</td>
            <td>
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="PAY.viewAttHistory('${e.id}')">History</button>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`;
  },

  markAttendance(empId, date, status) {
    const attendance = STRATIX_DB.getArr('attendance');
    const idx        = attendance.findIndex(a=>a.empId===empId&&a.date===date);
    if (idx !== -1) {
      attendance[idx].status = status;
      STRATIX_DB.set('attendance', attendance);
    } else {
      STRATIX_DB.push('attendance', { empId, date, status, otHours:0 });
    }
    this._tab('attendance');
  },

  markAllPresent() {
    const employees = STRATIX_DB.getArr('employees');
    const today     = FIN.today();
    employees.forEach(e => {
      const att = STRATIX_DB.getArr('attendance');
      if (!att.find(a=>a.empId===e.id&&a.date===today)) {
        STRATIX_DB.push('attendance', { empId:e.id, date:today, status:'P', otHours:0 });
      }
    });
    NOTIFY.show('All marked Present for today!','success');
    this._tab('attendance');
  },

  updateOT(empId, hours) {
    const h = Math.max(0, Number(hours)||0);
    STRATIX_DB.update('employees', empId, { otHours: h });
    NOTIFY.show(`OT updated: ${h} hours`,'info',1500);
  },

  viewAttHistory(empId) {
    const emp  = STRATIX_DB.getArr('employees').find(e=>e.id===empId);
    const att  = STRATIX_DB.getArr('attendance').filter(a=>a.empId===empId).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
    document.getElementById('payModal').innerHTML = FIN.modal('attHistModal', `📅 Attendance — ${emp?.name||''}`, `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Status</th><th>OT Hours</th></tr></thead>
        <tbody>
        ${att.length===0?`<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--muted)">No attendance recorded yet.</td></tr>`:''}
        ${att.map(a=>`<tr>
          <td>${FIN.dateStr(a.date)}</td>
          <td><span class="badge ${a.status==='P'?'bg':a.status==='A'?'br':a.status==='H'?'bo':'bb'}">${a.status==='P'?'Present':a.status==='A'?'Absent':a.status==='H'?'Half-Day':'Leave'}</span></td>
          <td>${a.otHours||0} hrs</td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    `);
  },

  exportAttendanceCSV() {
    const employees  = STRATIX_DB.getArr('employees');
    const attendance = STRATIX_DB.getArr('attendance');
    const monthKey   = FIN.today().slice(0,7);
    const rows = [['Employee','Department','Present Days','Absent Days','Half Days','Leave Days','OT Hours','Effective Days']];
    employees.forEach(e=>{
      const att = attendance.filter(a=>a.empId===e.id&&(a.date||'').startsWith(monthKey));
      rows.push([`"${e.name}"`,e.department||'',att.filter(a=>a.status==='P').length,att.filter(a=>a.status==='A').length,att.filter(a=>a.status==='H').length,att.filter(a=>a.status==='L').length,att.reduce((s,a)=>s+Number(a.otHours||0),0),(att.filter(a=>a.status==='P').length+att.filter(a=>a.status==='H').length*0.5).toFixed(1)]);
    });
    FIN.downloadCSV(rows, `STRATIX_Attendance_${monthKey}.csv`);
    NOTIFY.show('Attendance exported!','success');
  },

  /* ── ADVANCES ── */
  _renderAdvances() {
    const employees = STRATIX_DB.getArr('employees');
    const advances  = STRATIX_DB.getArr('advances');
    const sym       = FIN.sym();
    const totalPending = advances.filter(a=>!a.recovered).reduce((s,a)=>s+Number(a.amount||0)-Number(a.recoveredAmt||0),0);

    return `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
      <div class="kpi accent"><div class="kpi-lbl">Total Pending</div><div class="kpi-val">${FIN.fmt(totalPending)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Active Advances</div><div class="kpi-val">${advances.filter(a=>!a.recovered).length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Recovered (All Time)</div><div class="kpi-val green">${FIN.fmt(advances.filter(a=>a.recovered).reduce((s,a)=>s+Number(a.amount||0),0))}</div></div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">💳 Give New Advance</div>
      <div class="form-grid">
        <div class="field"><label>Employee *</label>
          <select id="adv_emp">
            <option value="">-- Select --</option>
            ${employees.map(e=>`<option value="${e.id}">${escapeHTML(e.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Amount (${sym}) *</label><input type="number" id="adv_amt" placeholder="5000"/></div>
        <div class="field"><label>Date</label><input type="date" id="adv_date" value="${FIN.today()}"/></div>
        <div class="field"><label>Recovery per month</label><input type="number" id="adv_rec" placeholder="1000 (or leave blank for 50% of basic)"/></div>
        <div class="field form-full"><label>Reason</label><input id="adv_reason" placeholder="Medical / Personal / Education etc."/></div>
      </div>
      <button class="btn btn-gold" style="margin-top:10px" onclick="PAY.saveAdvance()">Give Advance</button>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Advance Register</span></div>
      ${advances.length===0?`<div style="padding:24px;text-align:center;color:var(--muted)">No advances given yet.</div>`:`
      <div class="tbl-scroll"><table>
        <thead><tr><th>Employee</th><th>Date</th><th>Amount</th><th>Recovered</th><th>Balance</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
        ${[...advances].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(a=>{
          const emp = employees.find(e=>e.id===a.empId);
          const balance = Number(a.amount||0) - Number(a.recoveredAmt||0);
          return `<tr>
            <td class="td-b">${escapeHTML(emp?.name||'—')}</td>
            <td class="td-m">${FIN.dateStr(a.date)}</td>
            <td style="font-weight:700">${FIN.fmt(a.amount||0)}</td>
            <td class="td-g">${FIN.fmt(a.recoveredAmt||0)}</td>
            <td class="${balance>0?'td-r':'td-g'}" style="font-weight:700">${FIN.fmt(balance)}</td>
            <td class="td-m">${escapeHTML(a.reason||'—')}</td>
            <td>${a.recovered?FIN.badge('Recovered','bg'):FIN.badge('Pending','bo')}</td>
            <td>
              <div style="display:flex;gap:4px">
                ${!a.recovered?`<button class="btn btn-green btn-sm" style="font-size:10px;padding:3px 8px" onclick="PAY.partialRecover('${a.id}')">+ Recover</button>`:''}
                <button class="del-btn" onclick="PAY.deleteAdvance('${a.id}')">🗑</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  },

  saveAdvance() {
    const empId  = document.getElementById('adv_emp')?.value;
    const amount = +document.getElementById('adv_amt')?.value||0;
    if (!empId)  { NOTIFY.show('Select employee','warning'); return; }
    if (!amount) { NOTIFY.show('Enter amount','warning'); return; }
    STRATIX_DB.push('advances', {
      empId, amount,
      date:        document.getElementById('adv_date')?.value||FIN.today(),
      monthlyRec:  +document.getElementById('adv_rec')?.value||0,
      reason:      document.getElementById('adv_reason')?.value.trim()||'',
      recoveredAmt: 0,
      recovered:   false
    });
    STRATIX_DB.push('transactions',{type:'expense',amount,category:'advance',description:`Employee Advance — ${STRATIX_DB.getArr('employees').find(e=>e.id===empId)?.name||''}`,date:FIN.today()});
    NOTIFY.show('Advance recorded!','success');
    this._tab('advances');
  },

  partialRecover(id) {
    const adv = STRATIX_DB.getArr('advances').find(a=>a.id===id);
    if (!adv) return;
    const balance = Number(adv.amount||0) - Number(adv.recoveredAmt||0);
    const amt     = prompt(`Recover how much from ${FIN.sym()}${balance.toLocaleString('en-IN')} pending?`,'');
    if (amt===null) return;
    const val = Math.min(parseFloat(amt)||0, balance);
    if (val <= 0) { NOTIFY.show('Enter valid amount','warning'); return; }
    const newRecovered = Number(adv.recoveredAmt||0) + val;
    STRATIX_DB.update('advances', id, {
      recoveredAmt: newRecovered,
      recovered:    newRecovered >= Number(adv.amount||0)
    });
    NOTIFY.show(`${FIN.sym()}${val.toLocaleString('en-IN')} recovered!`,'success');
    this._tab('advances');
  },

  deleteAdvance(id) {
    if (!confirm('Delete this advance record?')) return;
    STRATIX_DB.remove('advances',id);
    this._tab('advances');
  },

  /* ── PAYSLIPS ── */
  _renderPayslips() {
    const payslips  = STRATIX_DB.getArr('payslips');
    const employees = STRATIX_DB.getArr('employees');
    const sym       = FIN.sym();

    // Payslips can be individual (from runPayroll) or bulk summary
    const indiv = payslips.filter(p=>p.employeeId);
    const bulk  = payslips.filter(p=>!p.employeeId);

    return `
    ${payslips.length===0?`<div class="card" style="text-align:center;padding:48px 20px">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No Payslips Generated</h3>
      <p style="color:var(--muted);margin-bottom:16px">Run the monthly payroll to generate individual payslips.</p>
      <button class="btn btn-gold" onclick="PAY._tab('payroll')">Go to Run Payroll →</button>
    </div>`:
    `<div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Payslip Register (${payslips.length})</span>
        <button class="btn btn-ghost btn-sm" onclick="PAY.exportPayrollCSV()">📥 Export All</button>
      </div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Employee</th><th>Month</th><th>Gross</th><th>PF (EE)</th><th>ESI (EE)</th><th>PT</th><th>TDS</th><th>Net Pay</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
        ${[...payslips].sort((a,b)=>(b.month||'').localeCompare(a.month||'')).map(p=>{
          const emp = p.employeeId ? employees.find(e=>e.id===p.employeeId) : null;
          return `<tr>
            <td class="td-b">${escapeHTML(emp?.name||p.employeeName||'All Employees')}</td>
            <td class="td-m">${escapeHTML(p.monthLabel||p.month||'—')}</td>
            <td>${FIN.fmt(p.gross||0)}</td>
            <td class="td-r">${FIN.fmt(p.pfEmployee||0)}</td>
            <td class="td-r">${(p.esiEmployee||0)>0?FIN.fmt(p.esiEmployee):'—'}</td>
            <td class="td-r">${(p.pt||0)>0?FIN.fmt(p.pt):'—'}</td>
            <td class="td-r">${(p.tds||0)>0?FIN.fmt(p.tds):'—'}</td>
            <td style="font-weight:800;color:var(--gold)">${FIN.fmt(p.netPay||p.totalNet||0)}</td>
            <td>${p.paid?FIN.badge('Paid','bg'):FIN.badge('Unpaid','bo')}</td>
            <td>
              <div style="display:flex;gap:4px">
                ${p.employeeId?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="PAY.generatePayslip('${p.employeeId}')">🖨️ Print</button>`:''}
                ${!p.paid?`<button class="btn btn-green btn-sm" style="font-size:10px;padding:3px 7px" onclick="PAY.markPayslipPaid('${p.id}')">✓ Paid</button>`:''}
                <button class="del-btn" onclick="PAY.deletePayslip('${p.id}')">🗑</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`}`;
  },

  markPayslipPaid(id) {
    STRATIX_DB.update('payslips',id,{paid:true,paidOn:FIN.today()});
    NOTIFY.show('Marked as paid!','success');
    this._tab('payslips');
  },

  deletePayslip(id) {
    if (!confirm('Delete this payslip?')) return;
    STRATIX_DB.remove('payslips',id);
    this._tab('payslips');
  },

  /* ── PF/ESI/TDS CHALLAN ── */
  _renderChallan() {
    const employees  = STRATIX_DB.getArr('employees');
    const monthLabel = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});
    const sym        = FIN.sym();

    let totals = {pfEE:0,pfER:0,esiEE:0,esiER:0,tds:0};
    employees.forEach(e=>{const s=this._calc(e);totals.pfEE+=s.pfEmployee;totals.pfER+=s.pfEmployer;totals.esiEE+=s.esiEmployee;totals.esiER+=s.esiEmployer;totals.tds+=s.tds;});

    const pfTotal  = totals.pfEE + totals.pfER;
    const esiTotal = totals.esiEE + totals.esiER;
    const tdsTotal = totals.tds;

    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">🏛️ Statutory Compliance Summary — ${monthLabel}</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:14px">For CA/Accountant use · Print and verify before filing</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
        <div style="background:rgba(79,126,240,.08);border:1px solid rgba(79,126,240,.25);border-radius:12px;padding:16px">
          <div style="font-size:12px;font-weight:700;color:var(--blue);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🏦 Provident Fund (ECR)</div>
          <div class="gst-row"><span>Employee Share (12%)</span><span class="red">${FIN.fmt(totals.pfEE)}</span></div>
          <div class="gst-row"><span>Employer Share (12%)</span><span class="red">${FIN.fmt(totals.pfER)}</span></div>
          <div class="gst-row total"><span>Total PF</span><span style="color:var(--blue)">${FIN.fmt(pfTotal)}</span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px">Due by 15th of next month · EPFO portal</div>
        </div>
        <div style="background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.25);border-radius:12px;padding:16px">
          <div style="font-size:12px;font-weight:700;color:var(--purple,#a855f7);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">🏥 ESI Contribution</div>
          <div class="gst-row"><span>Employee (0.75%)</span><span class="red">${FIN.fmt(totals.esiEE)}</span></div>
          <div class="gst-row"><span>Employer (3.25%)</span><span class="red">${FIN.fmt(totals.esiER)}</span></div>
          <div class="gst-row total"><span>Total ESI</span><span style="color:#a855f7">${FIN.fmt(esiTotal)}</span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px">Due by 21st of next month · ESIC portal</div>
          ${employees.every(e=>this._calc(e).esiEmployee===0)?`<div style="font-size:11px;color:var(--green);margin-top:4px">✓ No eligible employees (all gross &gt; ₹21K)</div>`:''}
        </div>
        <div style="background:rgba(232,64,64,.08);border:1px solid rgba(232,64,64,.25);border-radius:12px;padding:16px">
          <div style="font-size:12px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">💰 TDS (Section 192)</div>
          <div class="gst-row"><span>Total TDS Deducted</span><span class="red">${FIN.fmt(tdsTotal)}</span></div>
          <div class="gst-row"><span>Employees Liable</span><span>${employees.filter(e=>this._calc(e).tds>0).length}</span></div>
          <div class="gst-row total"><span>ITNS 281 Challan</span><span style="color:var(--red)">${FIN.fmt(tdsTotal)}</span></div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px">Due by 7th of next month · Income Tax portal</div>
          ${tdsTotal===0?`<div style="font-size:11px;color:var(--green);margin-top:4px">✓ No TDS (all income ≤ ₹12L — 87A rebate)</div>`:''}
        </div>
      </div>
      <div style="background:var(--s2);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:13px;font-weight:700">Total Monthly Statutory Outflow</div>
        <div style="font-size:28px;font-weight:800;color:var(--gold);margin-top:6px">${FIN.fmt(pfTotal+esiTotal+tdsTotal)}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">This amount must be deposited to EPFO + ESIC + Income Tax by respective due dates</div>
      </div>
    </div>

    <!-- Employee-wise breakdown -->
    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Employee-wise Statutory Deduction Detail</span>
        <button class="btn btn-ghost btn-sm" onclick="PAY.exportChallanCSV()">📥 Export for CA</button>
      </div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Employee</th><th>PAN</th><th>UAN (PF)</th><th>ESI No.</th><th>Gross</th><th>PF (EE)</th><th>PF (ER)</th><th>ESI (EE)</th><th>ESI (ER)</th><th>PT</th><th>TDS</th><th>Total Deducted</th></tr></thead>
        <tbody>
        ${employees.map(e=>{
          const s=this._calc(e);
          return `<tr>
            <td class="td-b">${escapeHTML(e.name)}</td>
            <td class="td-m" style="font-size:11px">${escapeHTML(e.pan||'—')}</td>
            <td class="td-m" style="font-size:11px">${escapeHTML(e.uan||'—')}</td>
            <td class="td-m" style="font-size:11px">${escapeHTML(e.esiNo||'—')}</td>
            <td>${FIN.fmt(s.gross)}</td>
            <td class="td-r">${FIN.fmt(s.pfEmployee)}</td>
            <td class="td-r">${FIN.fmt(s.pfEmployer)}</td>
            <td class="td-r">${s.esiEmployee>0?FIN.fmt(s.esiEmployee):'—'}</td>
            <td class="td-r">${s.esiEmployer>0?FIN.fmt(s.esiEmployer):'—'}</td>
            <td class="td-r">${s.pt>0?FIN.fmt(s.pt):'—'}</td>
            <td class="td-r">${s.tds>0?FIN.fmt(s.tds):'—'}</td>
            <td style="font-weight:700;color:var(--red)">${FIN.fmt(s.totalDeductions)}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`;
  },

  exportChallanCSV() {
    const employees = STRATIX_DB.getArr('employees');
    const month     = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});
    const rows = [['Employee Name','PAN','UAN','ESI No.','Gross','PF Employee','PF Employer','ESI Employee','ESI Employer','PT','TDS','Total Deducted']];
    employees.forEach(e=>{const s=this._calc(e);rows.push([`"${e.name}"`,e.pan||'',e.uan||'',e.esiNo||'',s.gross,s.pfEmployee,s.pfEmployer,s.esiEmployee,s.esiEmployer,s.pt,s.tds,s.totalDeductions]);});
    FIN.downloadCSV(rows, `STRATIX_Challan_${FIN.today()}.csv`);
    NOTIFY.show('Challan data exported for CA!','success');
  },

  exportPayrollCSV() {
    const employees = STRATIX_DB.getArr('employees');
    const month     = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});
    const rows = [['Employee','Employee ID','Department','Designation','Basic','HRA','DA','Special','Other Allow','OT Pay','Gross','PF (EE)','PF (ER)','ESI (EE)','ESI (ER)','PT','TDS','Adv Recovery','Total Deductions','Net Pay','CTC','Bank Account','IFSC']];
    employees.forEach(e=>{const s=this._calc(e);rows.push([`"${e.name}"`,e.empId||'',`"${e.department||''}"`,`"${e.designation||''}"`,e.basic||0,s.hra,s.da,s.special,s.otherA,s.otPay,s.gross,s.pfEmployee,s.pfEmployer,s.esiEmployee,s.esiEmployer,s.pt,s.tds,s.advRecovery,s.totalDeductions,s.netPay,s.ctc,e.bankAcc||'',e.bankIFSC||'']);});
    FIN.downloadCSV(rows, `STRATIX_Payroll_${FIN.today()}.csv`);
    NOTIFY.show('Full payroll exported for CA!','success');
  },

  /* ── RUN PAYROLL ── */
  confirmRunPayroll() {
    const employees = STRATIX_DB.getArr('employees');
    if (employees.length===0) { NOTIFY.show('Add employees first','warning'); return; }
    const total = employees.reduce((s,e)=>s+this._calc(e).netPay,0);
    if (!confirm(`Run payroll for ${employees.length} employees?\nTotal net payout: ${FIN.sym()}${total.toLocaleString('en-IN')}\nThis will generate payslips and log as expense.`)) return;

    const month = FIN.today().slice(0,7);
    const monthLabel = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});
    let totalNet = 0;

    employees.forEach(e => {
      const s = this._calc(e);
      totalNet += s.netPay;
      STRATIX_DB.push('payslips', {
        employeeId: e.id, employeeName: e.name,
        designation: e.designation||'', department: e.department||'',
        month, monthLabel,
        basic: e.basic||0, hra:s.hra, da:s.da, special:s.special, otherA:s.otherA, otPay:s.otPay,
        gross:s.gross, pfEmployee:s.pfEmployee, pfEmployer:s.pfEmployer,
        esiEmployee:s.esiEmployee, esiEmployer:s.esiEmployer,
        pt:s.pt, tds:s.tds, advRecovery:s.advRecovery,
        totalDeductions:s.totalDeductions, netPay:s.netPay, ctc:s.ctc,
        pan:e.pan||'', uan:e.uan||'',
        paid:false, generatedOn: FIN.today()
      });
      // Recover advance if applicable
      const advances = STRATIX_DB.getArr('advances');
      const pendingAdv = advances.find(a=>a.empId===e.id&&!a.recovered);
      if (pendingAdv && s.advRecovery > 0) {
        const newRec = Number(pendingAdv.recoveredAmt||0) + s.advRecovery;
        STRATIX_DB.update('advances', pendingAdv.id, {
          recoveredAmt: newRec,
          recovered: newRec >= Number(pendingAdv.amount||0)
        });
      }
    });

    STRATIX_DB.push('transactions',{type:'expense',amount:totalNet,category:'salary',description:`Monthly Payroll — ${monthLabel} (${employees.length} employees)`,date:FIN.today()});
    NOTIFY.show(`Payroll complete! ${employees.length} payslips · Net: ${FIN.sym()}${totalNet.toLocaleString('en-IN')}`, 'success', 5000);
    this._tab('payslips');
  },

  /* ── PAYSLIP PRINT ── */
  generatePayslip(empId) {
    const e   = STRATIX_DB.getArr('employees').find(x=>x.id===empId);
    if (!e)   return;
    const s   = this._calc(e);
    const cfg = STRATIX_DB.getSettings();
    const sym = cfg.currencySymbol||'₹';
    const win = window.open('','_blank','width=800,height=900');
    if (!win) { NOTIFY.show('Allow popups and retry','warning'); return; }
    win.document.write(`<!DOCTYPE html><html><head>
    <title>Payslip — ${e.name} — ${new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:32px;color:#111;background:#fff;max-width:780px;margin:0 auto}
      .hd{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;margin-bottom:20px;border-bottom:3px solid #2563EB}
      .biz{font-size:20px;font-weight:800}.biz-sub{font-size:12px;color:#666;margin-top:4px;line-height:1.6}
      .slip-title{font-size:17px;font-weight:800;color:#2563EB;text-transform:uppercase;letter-spacing:1px;text-align:right}
      .slip-sub{font-size:12px;color:#666;text-align:right;margin-top:4px}
      .emp-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px}
      .f{display:flex;gap:8px;font-size:12px;padding:5px 0;border-bottom:1px solid #f0ede0}
      .lbl{font-weight:700;color:#555;min-width:130px;flex-shrink:0}.val{color:#111}
      .earn-ded{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
      .col-title{font-size:11px;font-weight:800;color:#555;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #2563EB}
      table{width:100%;border-collapse:collapse;font-size:12px}
      tr td{padding:7px 0;border-bottom:1px solid #f0ede0}td:last-child{text-align:right;font-weight:600}
      .subtotal td{font-weight:800;font-size:13px;padding-top:8px;border-top:2px solid #ccc;border-bottom:none}
      .net{background:linear-gradient(135deg,#fdf3e0,#fff8ed);border:2px solid #2563EB;border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;margin:16px 0}
      .net-lbl{font-size:14px;font-weight:800}.net-words{font-size:11px;color:#666;margin-top:3px;font-style:italic}
      .net-val{font-size:26px;font-weight:800;color:#2563EB}
      .ctc-bar{display:flex;gap:18px;flex-wrap:wrap;font-size:12px;background:#f9f9f9;padding:10px 14px;border-radius:8px;margin-bottom:16px}
      .sigs{display:flex;justify-content:space-between;margin-top:40px;padding-top:14px;border-top:1px solid #eee}
      .sig-line{width:150px;border-top:1px solid #111;padding-top:6px;font-size:11px;color:#666;text-align:center}
      .ftr{margin-top:16px;text-align:center;font-size:11px;color:#aaa;padding-top:12px;border-top:1px solid #eee}
      @media print{body{padding:16px}.no-print{display:none}}
    </style></head><body>
    <div class="hd">
      <div>
        <div class="biz">${escapeHTML(cfg.businessName||'Your Company')}</div>
        <div class="biz-sub">${escapeHTML(cfg.address||'')}${cfg.gstNumber?'<br/>GSTIN: '+escapeHTML(cfg.gstNumber):''}${cfg.pfNumber?'<br/>PF Reg: '+escapeHTML(cfg.pfNumber):''}${cfg.esiNumber?'  |  ESI Reg: '+escapeHTML(cfg.esiNumber):''}</div>
      </div>
      <div>
        <div class="slip-title">Salary Payslip</div>
        <div class="slip-sub">${new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})}</div>
      </div>
    </div>

    <div class="emp-grid">
      <div>
        <div class="f"><span class="lbl">Employee Name</span><span class="val">${escapeHTML(e.name)}</span></div>
        <div class="f"><span class="lbl">Employee ID</span><span class="val">${escapeHTML(e.empId||'—')}</span></div>
        <div class="f"><span class="lbl">Designation</span><span class="val">${escapeHTML(e.designation||'—')}</span></div>
        <div class="f"><span class="lbl">Department</span><span class="val">${escapeHTML(e.department||'—')}</span></div>
        <div class="f"><span class="lbl">Date of Joining</span><span class="val">${e.doj?new Date(e.doj).toLocaleDateString('en-IN'):'—'}</span></div>
      </div>
      <div>
        <div class="f"><span class="lbl">PAN Number</span><span class="val">${escapeHTML(e.pan||'—')}</span></div>
        <div class="f"><span class="lbl">UAN (PF)</span><span class="val">${escapeHTML(e.uan||'—')}</span></div>
        <div class="f"><span class="lbl">ESI Number</span><span class="val">${escapeHTML(e.esiNo||'—')}</span></div>
        <div class="f"><span class="lbl">Bank Account</span><span class="val">${escapeHTML(e.bankAcc||'—')}</span></div>
        <div class="f"><span class="lbl">Pay Period</span><span class="val">${new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})}</span></div>
      </div>
    </div>

    <div class="earn-ded">
      <div>
        <div class="col-title">Earnings</div>
        <table><tbody>
          <tr><td>Basic Salary</td><td>${sym}${(e.basic||0).toLocaleString('en-IN')}</td></tr>
          <tr><td>House Rent Allowance</td><td>${sym}${s.hra.toLocaleString('en-IN')}</td></tr>
          <tr><td>Dearness Allowance</td><td>${sym}${s.da.toLocaleString('en-IN')}</td></tr>
          ${s.special>0?`<tr><td>Special Allowance</td><td>${sym}${s.special.toLocaleString('en-IN')}</td></tr>`:''}
          ${s.otherA>0?`<tr><td>Other Allowances</td><td>${sym}${s.otherA.toLocaleString('en-IN')}</td></tr>`:''}
          ${s.otPay>0?`<tr><td>Overtime (${e.otHours||0} hrs)</td><td>${sym}${s.otPay.toLocaleString('en-IN')}</td></tr>`:''}
          <tr class="subtotal"><td>Gross Earnings</td><td>${sym}${(s.gross+s.otPay).toLocaleString('en-IN')}</td></tr>
        </tbody></table>
      </div>
      <div>
        <div class="col-title">Deductions</div>
        <table><tbody>
          <tr><td>PF — Employee (12%)</td><td style="color:#dc2626">${sym}${s.pfEmployee.toLocaleString('en-IN')}</td></tr>
          ${s.esiEmployee>0?`<tr><td>ESI — Employee (0.75%)</td><td style="color:#dc2626">${sym}${s.esiEmployee.toLocaleString('en-IN')}</td></tr>`:''}
          ${s.pt>0?`<tr><td>Professional Tax</td><td style="color:#dc2626">${sym}${s.pt.toLocaleString('en-IN')}</td></tr>`:''}
          ${s.tds>0?`<tr><td>TDS (Income Tax)</td><td style="color:#dc2626">${sym}${s.tds.toLocaleString('en-IN')}</td></tr>`:''}
          ${s.advRecovery>0?`<tr><td>Advance Recovery</td><td style="color:#dc2626">${sym}${s.advRecovery.toLocaleString('en-IN')}</td></tr>`:''}
          <tr class="subtotal"><td>Total Deductions</td><td style="color:#dc2626">${sym}${s.totalDeductions.toLocaleString('en-IN')}</td></tr>
        </tbody></table>
      </div>
    </div>

    <div class="net">
      <div class="net-lbl">NET SALARY (TAKE HOME)<div class="net-words">${FIN.numWords(s.netPay)}</div></div>
      <div class="net-val">${sym}${s.netPay.toLocaleString('en-IN')}</div>
    </div>

    <div class="ctc-bar">
      <span>PF Employer: <strong>${sym}${s.pfEmployer.toLocaleString('en-IN')}</strong></span>
      <span>ESI Employer: <strong>${sym}${s.esiEmployer.toLocaleString('en-IN')}</strong></span>
      <span>Gross CTC: <strong>${sym}${s.ctc.toLocaleString('en-IN')}</strong></span>
    </div>

    <div class="sigs">
      <div class="sig-line">Employee Signature<br/>${escapeHTML(e.name)}</div>
      <div class="sig-line">Authorised Signatory<br/>${escapeHTML(cfg.businessName||'Company')}</div>
    </div>
    <div class="ftr">Computer-generated payslip. Verify statutory deductions with HR. Generated by STRATIX · stratix.app</div>

    <button class="no-print" onclick="window.print()" style="position:fixed;bottom:20px;right:20px;padding:10px 20px;background:#2563EB;border:none;border-radius:8px;cursor:pointer;font-weight:700">🖨️ Print / Save PDF</button>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 500);
  },

  /* ── ADD/EDIT EMPLOYEE MODAL ── */
  openAddEmployee() { this._openEmpModal(null); },
  openEditEmployee(id) { this._openEmpModal(id); },

  _openEmpModal(id) {
    const employees = STRATIX_DB.getArr('employees');
    const e = id ? (employees.find(x=>x.id===id)||{}) : {};
    const sym = FIN.sym();

    document.getElementById('payModal').innerHTML = FIN.modal('empModal', id?`✏️ Edit — ${e.name||''}`:'👤 Add Employee', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Full Name *</label><input id="pe_name" value="${escapeHTML(e.name||'')}" placeholder="Ramesh Kumar"/></div>
        <div class="field"><label>Employee ID</label><input id="pe_empid" value="${escapeHTML(e.empId||'')}" placeholder="EMP001"/></div>
        <div class="field"><label>Designation</label><input id="pe_desig" value="${escapeHTML(e.designation||'')}" placeholder="Manager / Driver / Worker"/></div>
        <div class="field"><label>Department</label><input id="pe_dept" value="${escapeHTML(e.department||'')}" placeholder="Operations / Finance / Admin"/></div>
        <div class="field"><label>Date of Joining</label><input type="date" id="pe_doj" value="${e.doj||''}"/></div>
        <div class="field"><label>Status</label>
          <select id="pe_status">
            <option value="active" ${(e.status||'active')==='active'?'selected':''}>Active</option>
            <option value="inactive" ${e.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
        <div class="field"><label>PAN Number</label><input id="pe_pan" value="${escapeHTML(e.pan||'')}" placeholder="ABCDE1234F" style="text-transform:uppercase"/></div>
        <div class="field"><label>UAN (PF Account)</label><input id="pe_uan" value="${escapeHTML(e.uan||'')}" placeholder="100123456789"/></div>
        <div class="field"><label>ESI Number</label><input id="pe_esi" value="${escapeHTML(e.esiNo||'')}" placeholder="ESI number if applicable"/></div>
        <div class="field"><label>Aadhaar (last 4)</label><input id="pe_aadhaar" value="${escapeHTML(e.aadhaar||'')}" placeholder="1234" maxlength="4"/></div>
        <div class="field"><label>Bank Account No.</label><input id="pe_bank" value="${escapeHTML(e.bankAcc||'')}" placeholder="Account number"/></div>
        <div class="field"><label>Bank IFSC</label><input id="pe_ifsc" value="${escapeHTML(e.bankIFSC||'')}" placeholder="SBIN0001234"/></div>
      </div>
      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--b1)">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">💰 Salary Structure</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field"><label>Basic Salary (${sym}) *</label><input type="number" id="pe_basic" value="${e.basic||''}" placeholder="15000" oninput="PAY._previewSalary()"/></div>
          <div class="field"><label>HRA (blank = 40% of basic)</label><input type="number" id="pe_hra" value="${e.hra||''}" placeholder="Auto"/></div>
          <div class="field"><label>DA (blank = 10% of basic)</label><input type="number" id="pe_da" value="${e.da||''}" placeholder="Auto"/></div>
          <div class="field"><label>Special Allowance</label><input type="number" id="pe_special" value="${e.special||''}" placeholder="0"/></div>
          <div class="field"><label>Other Allowances</label><input type="number" id="pe_other" value="${e.otherAllow||''}" placeholder="0"/></div>
        </div>
        <div id="empSalPreview" style="margin-top:10px"></div>
      </div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="PAY.saveEmployee('${id||''}')">💾 ${id?'Update':'Save'} Employee</button>
    `, true);
  },

  _previewSalary() {
    const basic = +document.getElementById('pe_basic')?.value||0;
    if (!basic) return;
    const hra   = +document.getElementById('pe_hra')?.value || Math.round(Math.round(basic * 0.40 * 100) / 100);
    const da    = +document.getElementById('pe_da')?.value  || Math.round(Math.round(basic * 0.10 * 100) / 100);
    const sp    = +document.getElementById('pe_special')?.value||0;
    const oth   = +document.getElementById('pe_other')?.value||0;
    const gross = basic+hra+da+sp+oth;
    const pfEE  = basic<=15000?Math.round(Math.round(basic * 0.12 * 100) / 100):1800;
    const pfER  = pfEE;
    const esiEE = gross<=21000?Math.round(Math.round(gross * 0.0075 * 100) / 100):0;
    const esiER = gross<=21000?Math.round(Math.round(gross * 0.0325 * 100) / 100):0;
    const net   = gross - pfEE - esiEE;
    const ctc   = gross + pfER + esiER;
    const sym   = FIN.sym();
    const el    = document.getElementById('empSalPreview');
    if (!el) return;
    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
      ${[['Gross',gross,'var(--txt)'],['PF',pfEE,'var(--red)'],['ESI',esiEE,'var(--red)'],['Net Pay',net,'var(--gold)'],['CTC',ctc,'var(--blue)']].map(([l,v,c])=>`<div style="background:var(--s2);padding:8px;border-radius:8px;text-align:center"><div style="font-size:10px;color:var(--muted)">${l}</div><div style="font-size:13px;font-weight:800;color:${c}">${sym}${v.toLocaleString('en-IN')}</div></div>`).join('')}
    </div>`;
  },

  saveEmployee(id) {
    const name = document.getElementById('pe_name')?.value.trim();
    if (!name) { NOTIFY.show('Enter employee name','warning'); return; }
    const data = {
      name,
      empId:      document.getElementById('pe_empid')?.value.trim()||'',
      designation:document.getElementById('pe_desig')?.value.trim()||'',
      department: document.getElementById('pe_dept')?.value.trim()||'',
      doj:        document.getElementById('pe_doj')?.value||null,
      status:     document.getElementById('pe_status')?.value||'active',
      pan:        document.getElementById('pe_pan')?.value.trim().toUpperCase()||'',
      uan:        document.getElementById('pe_uan')?.value.trim()||'',
      esiNo:      document.getElementById('pe_esi')?.value.trim()||'',
      aadhaar:    document.getElementById('pe_aadhaar')?.value.trim()||'',
      bankAcc:    document.getElementById('pe_bank')?.value.trim()||'',
      bankIFSC:   document.getElementById('pe_ifsc')?.value.trim().toUpperCase()||'',
      basic:      +document.getElementById('pe_basic')?.value||0,
      hra:        +document.getElementById('pe_hra')?.value||0,
      da:         +document.getElementById('pe_da')?.value||0,
      special:    +document.getElementById('pe_special')?.value||0,
      otherAllow: +document.getElementById('pe_other')?.value||0,
      otHours:    0
    };
    if (id) { STRATIX_DB.update('employees',id,data); NOTIFY.show('Employee updated!','success'); }
    else    { STRATIX_DB.push('employees',data);       NOTIFY.show('Employee added!','success'); }
    document.getElementById('empModal')?.remove();
    renderPayrollDeep('employees');
  },

  deleteEmployee(id) {
    const e = STRATIX_DB.getArr('employees').find(x=>x.id===id);
    if (!confirm(`Delete "${e?.name}"? Their payslips will remain.`)) return;
    STRATIX_DB.remove('employees',id);
    NOTIFY.show('Employee deleted','info');
    renderPayrollDeep('employees');
  }
};


/* ══════════════════════════════════════════════════════════════
   MODULE 3 — BANK RECONCILIATION DEEP
   (replaces features.js renderBankConnect)
   ══════════════════════════════════════════════════════════════ */

function renderBankRecon(activeTab) {
  activeTab = activeTab || 'accounts';
  const accounts = STRATIX_DB.getArr('bankAccounts');
  const txns     = STRATIX_DB.getArr('bankTransactions');
  const sym      = FIN.sym();

  const totalBalance = accounts.reduce((s,a)=>s+Number(a.balance||0),0);
  const moneyIn      = txns.filter(t=>Number(t.amount||0)>0).reduce((s,t)=>s+Number(t.amount||0),0);
  const moneyOut     = txns.filter(t=>Number(t.amount||0)<0).reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0);
  const unmatched    = txns.filter(t=>!t.matched).length;

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">🏦 Bank Reconciliation</h1>
        <p class="sec-sub">Multi-account tracker · CSV import · Auto-match · Cheque tracking</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="BNK.openAddAccount()">+ Add Account</button>
        <button class="btn btn-outline" onclick="BNK.openAddTxn()">+ Add Transaction</button>
        <button class="btn btn-ghost btn-sm" onclick="BNK.openImport()">⬆ Import CSV</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      <div class="kpi accent"><div class="kpi-lbl">Total Balance</div><div class="kpi-val">${FIN.fmt(totalBalance)}</div><div class="kpi-trend">${accounts.length} account${accounts.length!==1?'s':''}</div></div>
      <div class="kpi"><div class="kpi-lbl">Total In (All)</div><div class="kpi-val green">${FIN.fmt(moneyIn)}</div></div>
      <div class="kpi"><div class="kpi-lbl">Total Out (All)</div><div class="kpi-val red">${FIN.fmt(moneyOut)}</div></div>
      <div class="kpi ${unmatched>0?'':''}"><div class="kpi-lbl">Unreconciled</div><div class="kpi-val ${unmatched>0?'orange':''}">${unmatched}</div><div class="kpi-trend ${unmatched>0?'down':'up'}">${unmatched>0?'Need review':'All matched'}</div></div>
    </div>

    <div class="calc-tabs" style="margin-bottom:16px">
      <button class="calc-tab${activeTab==='accounts'?' active':''}" data-bnktab="accounts" onclick="BNK._tab('accounts')">🏦 Accounts</button>
      <button class="calc-tab${activeTab==='transactions'?' active':''}" data-bnktab="transactions" onclick="BNK._tab('transactions')">📋 Transactions</button>
      <button class="calc-tab${activeTab==='reconcile'?' active':''}" data-bnktab="reconcile" onclick="BNK._tab('reconcile')">✅ Reconciliation${unmatched>0?` <span style="background:var(--orange);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:4px">${unmatched}</span>`:''}</button>
      <button class="calc-tab${activeTab==='cheques'?' active':''}" data-bnktab="cheques" onclick="BNK._tab('cheques')">📝 Cheques</button>
      <button class="calc-tab${activeTab==='cashflow'?' active':''}" data-bnktab="cashflow" onclick="BNK._tab('cashflow')">📊 Cash Flow</button>
    </div>

    <div id="bankTabContent">${BNK._renderTab(activeTab, accounts, txns, sym)}</div>
    <div id="bankModal"></div>
  </div>`;
}

const BNK = {
  _tab(tab) {
    const accounts = STRATIX_DB.getArr('bankAccounts');
    const txns     = STRATIX_DB.getArr('bankTransactions');
    const sym      = FIN.sym();
    document.querySelectorAll('[data-bnktab]').forEach(b => b.classList.toggle('active', b.dataset.bnktab === tab));
    const el = document.getElementById('bankTabContent');
    if (el) el.innerHTML = this._renderTab(tab, accounts, txns, sym);
  },

  _renderTab(tab, accounts, txns, sym) {
    if (tab === 'accounts')     return this._renderAccounts(accounts, txns, sym);
    if (tab === 'transactions') return this._renderTransactions(accounts, txns, sym);
    if (tab === 'reconcile')    return this._renderReconcile(accounts, txns, sym);
    if (tab === 'cheques')      return this._renderCheques(accounts, sym);
    if (tab === 'cashflow')     return this._renderCashFlow(accounts, txns, sym);
    return '';
  },

  /* ── ACCOUNTS ── */
  _renderAccounts(accounts, txns, sym) {
    if (accounts.length === 0) return `<div class="card" style="text-align:center;padding:56px 20px">
      <div style="font-size:48px;margin-bottom:14px">🏦</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No Bank Accounts Added</h3>
      <p style="color:var(--muted);max-width:300px;margin:0 auto 20px">Add your business bank accounts to track balances and reconcile transactions.</p>
      <button class="btn btn-gold" onclick="BNK.openAddAccount()">+ Add Bank Account</button>
    </div>`;

    return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">
    ${accounts.map(a => {
      const accTxns = txns.filter(t=>t.accountId===a.id);
      const moneyIn = accTxns.filter(t=>Number(t.amount||0)>0).reduce((s,t)=>s+Number(t.amount||0),0);
      const moneyOut= accTxns.filter(t=>Number(t.amount||0)<0).reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0);
      return `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
          <div>
            <div style="font-size:15px;font-weight:800">${escapeHTML(a.bankName||'Bank')}</div>
            <div style="font-size:11px;color:var(--muted);font-family:monospace">****${(a.accountNo||'').slice(-4)} · ${a.accountType||'Current'}</div>
            ${a.ifsc?`<div style="font-size:11px;color:var(--muted)">IFSC: ${escapeHTML(a.ifsc)}</div>`:''}
          </div>
          <span class="badge bg">Active</span>
        </div>
        <div style="font-size:24px;font-weight:800;color:var(--gold);margin-bottom:10px">${sym}${Number(a.balance||0).toLocaleString('en-IN')}</div>
        <div style="display:flex;gap:14px;margin-bottom:12px">
          <div style="text-align:center;flex:1">
            <div style="font-size:10px;color:var(--muted)">Total In</div>
            <div style="font-size:13px;font-weight:700;color:var(--green)">${FIN.fmt(moneyIn)}</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:10px;color:var(--muted)">Total Out</div>
            <div style="font-size:13px;font-weight:700;color:var(--red)">${FIN.fmt(moneyOut)}</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:10px;color:var(--muted)">Transactions</div>
            <div style="font-size:13px;font-weight:700">${accTxns.length}</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="number" id="bal_${a.id}" placeholder="Update balance" style="flex:1;padding:7px 10px;background:var(--s2);border:1px solid var(--b1);border-radius:8px;color:var(--txt);font-size:12px;outline:none"/>
          <button class="btn btn-gold btn-sm" onclick="BNK.updateBalance('${a.id}')">Update</button>
          <button class="del-btn" onclick="BNK.deleteAccount('${a.id}')">🗑</button>
        </div>
      </div>`;
    }).join('')}
    </div>`;
  },

  updateBalance(id) {
    const val = +document.getElementById('bal_'+id)?.value;
    if (isNaN(val)) { NOTIFY.show('Enter valid balance','warning'); return; }
    STRATIX_DB.update('bankAccounts', id, { balance:val });
    NOTIFY.show('Balance updated!','success');
    this._tab('accounts');
  },

  /* ── TRANSACTIONS ── */
  _renderTransactions(accounts, txns, sym) {
    const sorted = [...txns].sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
    return `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">All Transactions (${txns.length})</span>
        <div style="display:flex;gap:8px">
          <select id="bankAccFilter" onchange="BNK._filterTxns(this.value)" style="padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt)">
            <option value="all">All Accounts</option>
            ${accounts.map(a=>`<option value="${a.id}">${escapeHTML(a.bankName)} ****${(a.accountNo||'').slice(-4)}</option>`).join('')}
          </select>
          <button class="btn btn-gold btn-sm" onclick="BNK.openAddTxn()">+ Add</button>
          <button class="btn btn-ghost btn-sm" onclick="BNK.exportTxnCSV()">📥 Export</button>
        </div>
      </div>
      <div id="txnTableWrap">
        ${this._renderTxnRows(sorted, accounts, sym)}
      </div>
    </div>`;
  },

  _renderTxnRows(txns, accounts, sym) {
    if (txns.length === 0) return `<div style="padding:32px;text-align:center;color:var(--muted)">No transactions yet. Add manually or import a CSV statement.</div>`;
    return `<div class="tbl-scroll"><table>
      <thead><tr><th>Date</th><th>Account</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th><th>Balance After</th><th>Matched</th><th></th></tr></thead>
      <tbody>
      ${txns.slice(0,100).map(t=>{
        const acc = accounts.find(a=>a.id===t.accountId);
        return `<tr>
          <td class="td-m">${FIN.dateStr(t.date)}</td>
          <td class="td-m">${escapeHTML(acc?.bankName||'—')}</td>
          <td class="td-b" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(t.description||'—')}</td>
          <td>${FIN.badge(t.category||'Other','bm')}</td>
          <td>${Number(t.amount||0)>0?FIN.badge('Credit','bg'):FIN.badge('Debit','br')}</td>
          <td class="${Number(t.amount||0)>0?'td-g':'td-r'}" style="font-weight:700">${Number(t.amount||0)>0?'+':'-'}${sym}${Math.abs(Number(t.amount||0)).toLocaleString('en-IN')}</td>
          <td class="td-m">${t.balanceAfter!=null?sym+Number(t.balanceAfter).toLocaleString('en-IN'):'—'}</td>
          <td>
            <button onclick="BNK.toggleMatch('${t.id}')" style="padding:2px 8px;border-radius:5px;border:1px solid ${t.matched?'var(--green)':'var(--b1)'};background:${t.matched?'rgba(0,214,143,.1)':'transparent'};color:${t.matched?'var(--green)':'var(--muted)'};font-size:10px;cursor:pointer;font-weight:700">
              ${t.matched?'✓ Matched':'— Match'}
            </button>
          </td>
          <td><button class="del-btn" onclick="BNK.deleteTxn('${t.id}')">🗑</button></td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
  },

  _filterTxns(accountId) {
    const txns     = STRATIX_DB.getArr('bankTransactions');
    const accounts = STRATIX_DB.getArr('bankAccounts');
    const filtered = accountId==='all' ? txns : txns.filter(t=>t.accountId===accountId);
    const el = document.getElementById('txnTableWrap');
    if (el) el.innerHTML = this._renderTxnRows([...filtered].sort((a,b)=>new Date(b.date)-new Date(a.date)), accounts, FIN.sym());
  },

  toggleMatch(id) {
    const txns = STRATIX_DB.getArr('bankTransactions');
    const t    = txns.find(x=>x.id===id);
    if (!t) return;
    STRATIX_DB.update('bankTransactions', id, { matched: !t.matched });
    this._tab('transactions');
  },

  deleteTxn(id) {
    if (!confirm('Delete this transaction?')) return;
    STRATIX_DB.remove('bankTransactions', id);
    this._tab('transactions');
  },

  /* ── RECONCILIATION ── */
  _renderReconcile(accounts, txns, sym) {
    const unmatched = txns.filter(t => !t.matched);
    const matched   = txns.filter(t => t.matched);
    const unmatchedIn  = unmatched.filter(t=>Number(t.amount||0)>0).reduce((s,t)=>s+Number(t.amount||0),0);
    const unmatchedOut = unmatched.filter(t=>Number(t.amount||0)<0).reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0);

    return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
      <div class="kpi"><div class="kpi-lbl">Total Transactions</div><div class="kpi-val">${txns.length}</div></div>
      <div class="kpi accent"><div class="kpi-lbl">Matched</div><div class="kpi-val green">${matched.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Unmatched</div><div class="kpi-val ${unmatched.length>0?'orange':''}">${unmatched.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Reconciliation %</div><div class="kpi-val ${txns.length>0&&matched.length/txns.length>=0.9?'green':'orange'}">${txns.length>0?((matched.length/txns.length)*100).toFixed(0):0}%</div></div>
    </div>

    ${unmatched.length === 0 ? `
    <div class="card" style="text-align:center;padding:36px 20px">
      <div style="font-size:36px;margin-bottom:10px">✅</div>
      <h3 style="color:var(--green)">Fully Reconciled!</h3>
      <p style="color:var(--muted);margin-top:6px">All transactions are matched with your books.</p>
    </div>` : `
    <div class="card" style="margin-bottom:14px;background:rgba(37,99,235,.05);border:1px solid rgba(37,99,235,.2)">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
        <div>
          <div class="card-title">⚠️ ${unmatched.length} Unmatched Transactions Need Review</div>
          <div style="font-size:12px;color:var(--muted)">Unmatched credits: ${FIN.fmt(unmatchedIn)} · Unmatched debits: ${FIN.fmt(unmatchedOut)}</div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="BNK.matchAll()">✓ Match All</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Unmatched Transactions</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Account</th><th>Description</th><th>Amount</th><th>Possible Match</th><th>Action</th></tr></thead>
        <tbody>
        ${unmatched.slice(0,50).map(t => {
          const acc  = accounts.find(a=>a.id===t.accountId);
          const amt  = Number(t.amount||0);
          // Find possible match from main transactions
          const mainTxns = STRATIX_DB.getArr('transactions');
          const possible = mainTxns.find(m => {
            const diff = Math.abs(Math.abs(Number(m.amount||0)) - Math.abs(amt));
            return diff < Math.abs(amt) * 0.02; // within 2%
          });
          return `<tr>
            <td class="td-m">${FIN.dateStr(t.date)}</td>
            <td class="td-m">${escapeHTML(acc?.bankName||'—')}</td>
            <td class="td-b">${escapeHTML(t.description||'—')}</td>
            <td class="${amt>0?'td-g':'td-r'}" style="font-weight:700">${amt>0?'+':'-'}${sym}${Math.abs(amt).toLocaleString('en-IN')}</td>
            <td style="font-size:11px;color:var(--muted)">${possible?`${possible.type} — ${possible.category||''} (${FIN.fmt(possible.amount)})`:'-'}</td>
            <td><button class="btn btn-green btn-sm" style="font-size:10px;padding:3px 8px" onclick="BNK.toggleMatch('${t.id}')">✓ Match</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`}`;
  },

  matchAll() {
    const txns = STRATIX_DB.getArr('bankTransactions');
    txns.forEach(t => { if (!t.matched) STRATIX_DB.update('bankTransactions', t.id, { matched:true }); });
    NOTIFY.show('All transactions matched!','success');
    this._tab('reconcile');
  },

  /* ── CHEQUES ── */
  _renderCheques(accounts, sym) {
    const cheques = STRATIX_DB.getArr('cheques');
    const issued  = cheques.filter(c=>c.type==='issued');
    const received= cheques.filter(c=>c.type==='received');
    const totalIssued   = issued.reduce((s,c)=>s+Number(c.amount||0),0);
    const totalReceived = received.reduce((s,c)=>s+Number(c.amount||0),0);
    const pendingClear  = issued.filter(c=>c.status==='issued').reduce((s,c)=>s+Number(c.amount||0),0);

    return `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
      <div class="kpi"><div class="kpi-lbl">Cheques Issued</div><div class="kpi-val red">${FIN.fmt(totalIssued)}</div><div class="kpi-trend">${issued.length} cheques</div></div>
      <div class="kpi accent"><div class="kpi-lbl">Cheques Received</div><div class="kpi-val green">${FIN.fmt(totalReceived)}</div><div class="kpi-trend">${received.length} cheques</div></div>
      <div class="kpi"><div class="kpi-lbl">Pending Clearance</div><div class="kpi-val ${pendingClear>0?'orange':''}">${FIN.fmt(pendingClear)}</div></div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">📝 Add Cheque Entry</div>
      <div class="form-grid">
        <div class="field"><label>Type</label>
          <select id="chq_type">
            <option value="issued">Issued (Outgoing)</option>
            <option value="received">Received (Incoming)</option>
          </select>
        </div>
        <div class="field"><label>Account</label>
          <select id="chq_acc">
            ${accounts.map(a=>`<option value="${a.id}">${escapeHTML(a.bankName)} ****${(a.accountNo||'').slice(-4)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Cheque No.</label><input id="chq_no" placeholder="012345"/></div>
        <div class="field"><label>Date</label><input type="date" id="chq_date" value="${FIN.today()}"/></div>
        <div class="field"><label>Amount (${sym}) *</label><input type="number" id="chq_amt" placeholder="50000"/></div>
        <div class="field"><label>Payee / Payer Name</label><input id="chq_payee" placeholder="Company / Person name"/></div>
        <div class="field"><label>Purpose</label><input id="chq_purpose" placeholder="Payment for invoice / advance etc."/></div>
        <div class="field"><label>Status</label>
          <select id="chq_status">
            <option value="issued">Issued / Handed</option>
            <option value="cleared">Cleared</option>
            <option value="bounced">Bounced</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>
      <button class="btn btn-gold" style="margin-top:10px" onclick="BNK.saveCheque()">Save Cheque Entry</button>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Cheque Register (${cheques.length})</span>
        <select onchange="BNK._filterCheques(this.value)" style="padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt)">
          <option value="all">All</option>
          <option value="issued-issued">Issued — Pending</option>
          <option value="issued-cleared">Issued — Cleared</option>
          <option value="issued-bounced">Bounced</option>
          <option value="received-issued">Received — Pending</option>
        </select>
      </div>
      ${cheques.length===0?`<div style="padding:24px;text-align:center;color:var(--muted)">No cheque entries yet.</div>`:`
      <div class="tbl-scroll" id="chequeRows"><table>
        <thead><tr><th>Date</th><th>No.</th><th>Type</th><th>Account</th><th>Payee/Payer</th><th>Amount</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
        ${[...cheques].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(c=>{
          const acc = accounts.find(a=>a.id===c.accountId);
          return `<tr>
            <td class="td-m">${FIN.dateStr(c.date)}</td>
            <td class="td-m" style="font-family:monospace">${escapeHTML(c.chequeNo||'—')}</td>
            <td>${FIN.badge(c.type==='issued'?'Issued':'Received',c.type==='issued'?'br':'bg')}</td>
            <td class="td-m">${escapeHTML(acc?.bankName||'—')}</td>
            <td class="td-b">${escapeHTML(c.payee||'—')}</td>
            <td class="${c.type==='issued'?'td-r':'td-g'}" style="font-weight:700">${c.type==='issued'?'-':'+'}${sym}${Number(c.amount||0).toLocaleString('en-IN')}</td>
            <td class="td-m">${escapeHTML(c.purpose||'—')}</td>
            <td>
              <select onchange="BNK.updateChequeStatus('${c.id}',this.value)" style="padding:3px 8px;font-size:11px;border-radius:6px;border:1px solid var(--b1);background:var(--s2);color:var(--txt);cursor:pointer">
                ${['issued','cleared','bounced','cancelled'].map(s=>`<option ${c.status===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </td>
            <td><button class="del-btn" onclick="BNK.deleteCheque('${c.id}')">🗑</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  },

  saveCheque() {
    const amt = +document.getElementById('chq_amt')?.value||0;
    if (!amt) { NOTIFY.show('Enter cheque amount','warning'); return; }
    STRATIX_DB.push('cheques', {
      type:      document.getElementById('chq_type')?.value||'issued',
      accountId: document.getElementById('chq_acc')?.value||'',
      chequeNo:  document.getElementById('chq_no')?.value.trim()||'',
      date:      document.getElementById('chq_date')?.value||FIN.today(),
      amount:    amt,
      payee:     document.getElementById('chq_payee')?.value.trim()||'',
      purpose:   document.getElementById('chq_purpose')?.value.trim()||'',
      status:    document.getElementById('chq_status')?.value||'issued'
    });
    NOTIFY.show('Cheque entry saved!','success');
    this._tab('cheques');
  },

  updateChequeStatus(id, status) {
    STRATIX_DB.update('cheques', id, { status });
    if (status === 'bounced') NOTIFY.show('⚠️ Cheque marked as bounced! Take appropriate action.','warning',5000);
  },

  deleteCheque(id) {
    if (!confirm('Delete cheque entry?')) return;
    STRATIX_DB.remove('cheques', id);
    this._tab('cheques');
  },

  _filterCheques(filter) {
    const cheques = STRATIX_DB.getArr('cheques');
    let filtered  = cheques;
    if (filter !== 'all') {
      const [type, status] = filter.split('-');
      filtered = cheques.filter(c=>c.type===type&&c.status===status);
    }
    const accounts = STRATIX_DB.getArr('bankAccounts');
    const sym = FIN.sym();
    const el  = document.getElementById('chequeRows');
    if (el) {
      const tbody = el.querySelector('tbody');
      if (tbody) tbody.innerHTML = filtered.map(c=>{
        const acc = accounts.find(a=>a.id===c.accountId);
        return `<tr>
          <td class="td-m">${FIN.dateStr(c.date)}</td>
          <td class="td-m" style="font-family:monospace">${escapeHTML(c.chequeNo||'—')}</td>
          <td>${FIN.badge(c.type==='issued'?'Issued':'Received',c.type==='issued'?'br':'bg')}</td>
          <td class="td-m">${escapeHTML(acc?.bankName||'—')}</td>
          <td class="td-b">${escapeHTML(c.payee||'—')}</td>
          <td class="${c.type==='issued'?'td-r':'td-g'}" style="font-weight:700">${c.type==='issued'?'-':'+'}${sym}${Number(c.amount||0).toLocaleString('en-IN')}</td>
          <td class="td-m">${escapeHTML(c.purpose||'—')}</td>
          <td><span class="badge ${c.status==='cleared'?'bg':c.status==='bounced'?'br':c.status==='cancelled'?'bm':'bo'}">${c.status}</span></td>
          <td><button class="del-btn" onclick="BNK.deleteCheque('${c.id}')">🗑</button></td>
        </tr>`;
      }).join('');
    }
  },

  /* ── CASH FLOW ── */
  _renderCashFlow(accounts, txns, sym) {
    const months = FIN.fyMonths().slice(-6);
    months.forEach(m => {
      m.in  = txns.filter(t=>(t.date||'').startsWith(m.key)&&Number(t.amount||0)>0).reduce((s,t)=>s+Number(t.amount||0),0);
      m.out = txns.filter(t=>(t.date||'').startsWith(m.key)&&Number(t.amount||0)<0).reduce((s,t)=>s+Math.abs(Number(t.amount||0)),0);
      m.net = m.in - m.out;
    });
    const maxBar = Math.max(...months.map(m=>Math.max(m.in,m.out)),1);
    const totalIn  = months.reduce((s,m)=>s+m.in,0);
    const totalOut = months.reduce((s,m)=>s+m.out,0);

    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">📊 Cash Flow — Last 6 Months</div>
      <div class="bar-chart">
        ${months.map(m=>`
        <div class="bar-grp">
          <div class="bars">
            <div class="bar rev" style="height:${Math.round((m.in/maxBar)*120)}px" title="In: ${FIN.fmt(m.in)}"></div>
            <div class="bar exp" style="height:${Math.round((m.out/maxBar)*120)}px" title="Out: ${FIN.fmt(m.out)}"></div>
          </div>
          <div class="bar-lbl">${m.label}</div>
        </div>`).join('')}
      </div>
      <div class="chart-legend"><div class="leg rev">Money In</div><div class="leg exp">Money Out</div></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:14px">
      <div class="card"><div class="card-title">Total In (6M)</div><div style="font-size:22px;font-weight:800;color:var(--green)">${FIN.fmt(totalIn)}</div></div>
      <div class="card"><div class="card-title">Total Out (6M)</div><div style="font-size:22px;font-weight:800;color:var(--red)">${FIN.fmt(totalOut)}</div></div>
      <div class="card"><div class="card-title">Net Flow (6M)</div><div style="font-size:22px;font-weight:800;color:${totalIn-totalOut>=0?'var(--gold)':'var(--red)'}">${FIN.fmt(Math.abs(totalIn-totalOut))}</div></div>
    </div>

    <!-- Account-wise balance table -->
    ${accounts.length > 0 ? `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Account-wise Summary</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Bank</th><th>Account</th><th>Type</th><th>Current Balance</th><th>Total Txns</th><th>Last Activity</th></tr></thead>
        <tbody>
        ${accounts.map(a=>{
          const accTxns = txns.filter(t=>t.accountId===a.id);
          const lastTxn = accTxns.sort((a,b)=>new Date(b.date)-new Date(a.date))[0];
          return `<tr>
            <td class="td-b">${escapeHTML(a.bankName||'Bank')}</td>
            <td class="td-m" style="font-family:monospace">****${(a.accountNo||'').slice(-4)}</td>
            <td>${FIN.badge(a.accountType||'Current','bm')}</td>
            <td style="font-size:16px;font-weight:800;color:var(--gold)">${sym}${Number(a.balance||0).toLocaleString('en-IN')}</td>
            <td>${accTxns.length}</td>
            <td class="td-m">${lastTxn?FIN.dateStr(lastTxn.date):'—'}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>` : ''}`;
  },

  /* ── ADD ACCOUNT MODAL ── */
  openAddAccount() {
    document.getElementById('bankModal').innerHTML = FIN.modal('addAccModal', '🏦 Add Bank Account', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Bank Name *</label>
          <select id="ba_bank">
            ${['State Bank of India','HDFC Bank','ICICI Bank','Axis Bank','Kotak Mahindra Bank','Punjab National Bank','Bank of Baroda','Canara Bank','Union Bank of India','IndusInd Bank','Yes Bank','IDFC FIRST Bank','Federal Bank','South Indian Bank','Other'].map(b=>`<option>${b}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Account Type</label>
          <select id="ba_type"><option>Current</option><option>Savings</option><option>OD/CC</option></select>
        </div>
        <div class="field"><label>Account Number *</label><input id="ba_no" placeholder="00001234567890"/></div>
        <div class="field"><label>IFSC Code</label><input id="ba_ifsc" placeholder="SBIN0001234" style="text-transform:uppercase"/></div>
        <div class="field"><label>Branch Name</label><input id="ba_branch" placeholder="Main Branch, Mumbai"/></div>
        <div class="field"><label>Current Balance (${FIN.sym()}) *</label><input type="number" id="ba_bal" placeholder="125000"/></div>
      </div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="BNK.saveAccount()">Add Account</button>
    `);
  },

  saveAccount() {
    const no  = document.getElementById('ba_no')?.value.trim();
    if (!no) { NOTIFY.show('Enter account number','warning'); return; }
    STRATIX_DB.push('bankAccounts', {
      bankName:    document.getElementById('ba_bank')?.value||'Bank',
      accountType: document.getElementById('ba_type')?.value||'Current',
      accountNo:   no,
      ifsc:        document.getElementById('ba_ifsc')?.value.trim().toUpperCase()||'',
      branch:      document.getElementById('ba_branch')?.value.trim()||'',
      balance:     +document.getElementById('ba_bal')?.value||0
    });
    document.getElementById('addAccModal')?.remove();
    NOTIFY.show('Account added!','success');
    renderBankRecon('accounts');
  },

  deleteAccount(id) {
    if (!confirm('Remove this bank account? Transactions will remain.')) return;
    STRATIX_DB.remove('bankAccounts', id);
    NOTIFY.show('Account removed','info');
    renderBankRecon('accounts');
  },

  /* ── ADD TRANSACTION MODAL ── */
  openAddTxn() {
    const accounts = STRATIX_DB.getArr('bankAccounts');
    document.getElementById('bankModal').innerHTML = FIN.modal('addTxnModal', '+ Add Transaction', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Account *</label>
          <select id="bt_acc">
            ${accounts.map(a=>`<option value="${a.id}">${escapeHTML(a.bankName)} ****${(a.accountNo||'').slice(-4)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Date *</label><input type="date" id="bt_date" value="${FIN.today()}"/></div>
        <div class="field"><label>Type</label>
          <select id="bt_type">
            <option value="credit">Credit (Money In)</option>
            <option value="debit">Debit (Money Out)</option>
          </select>
        </div>
        <div class="field"><label>Amount (${FIN.sym()}) *</label><input type="number" id="bt_amt" placeholder="50000"/></div>
        <div class="field"><label>Category</label>
          <select id="bt_cat">
            ${['Freight Collection','Salary','Fuel','Toll','Maintenance','GST Payment','Loan EMI','Advance','Vendor Payment','Other Income','Other Expense'].map(c=>`<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Balance After (${FIN.sym()})</label><input type="number" id="bt_bal" placeholder="Optional"/></div>
        <div class="field form-full"><label>Description *</label><input id="bt_desc" placeholder="e.g. Payment from Ramesh Traders / Diesel fill at HP Pump"/></div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
        <input type="checkbox" id="bt_matched" style="width:16px;height:16px"/>
        <label for="bt_matched" style="font-size:13px;cursor:pointer">Mark as matched / reconciled</label>
      </div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="BNK.saveTxn()">Save Transaction</button>
    `);
  },

  saveTxn() {
    const accId = document.getElementById('bt_acc')?.value;
    const amt   = +document.getElementById('bt_amt')?.value||0;
    const desc  = document.getElementById('bt_desc')?.value.trim();
    if (!accId)  { NOTIFY.show('Select account','warning'); return; }
    if (!amt)    { NOTIFY.show('Enter amount','warning'); return; }
    if (!desc)   { NOTIFY.show('Enter description','warning'); return; }
    const type  = document.getElementById('bt_type')?.value||'credit';
    const finalAmt = type==='credit' ? amt : -amt;
    STRATIX_DB.push('bankTransactions', {
      accountId:   accId,
      date:        document.getElementById('bt_date')?.value||FIN.today(),
      description: desc,
      category:    document.getElementById('bt_cat')?.value||'Other',
      amount:      finalAmt,
      balanceAfter:+document.getElementById('bt_bal')?.value||null,
      matched:     document.getElementById('bt_matched')?.checked||false
    });
    // Also update account balance
    const accounts = STRATIX_DB.getArr('bankAccounts');
    const acc = accounts.find(a=>a.id===accId);
    if (acc) STRATIX_DB.update('bankAccounts', accId, { balance: (Number(acc.balance||0)) + finalAmt });

    document.getElementById('addTxnModal')?.remove();
    NOTIFY.show('Transaction saved!','success');
    this._tab('transactions');
  },

  /* ── CSV IMPORT ── */
  openImport() {
    const accounts = STRATIX_DB.getArr('bankAccounts');
    document.getElementById('bankModal').innerHTML = FIN.modal('importModal', '⬆ Import Bank Statement CSV', `
      <div class="alert" style="background:rgba(79,126,240,.08);border-color:rgba(79,126,240,.3);margin-bottom:14px">
        <span>ℹ️</span>
        <div style="font-size:12px">CSV format: <strong>Date, Description, Debit, Credit, Balance</strong><br/>
        Download from your bank's NetBanking portal. Headers are auto-detected.</div>
      </div>
      <div class="field"><label>Account *</label>
        <select id="imp_acc">
          ${accounts.map(a=>`<option value="${a.id}">${escapeHTML(a.bankName)} ****${(a.accountNo||'').slice(-4)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="margin-top:10px"><label>CSV File *</label>
        <input type="file" accept=".csv,.txt" id="imp_file" onchange="BNK.parseImport(event)"/>
      </div>
      <div id="imp_preview" style="margin-top:12px"></div>
    `, true);
  },

  parseImport(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target.result;
      const lines = raw.split(/\r?\n/).filter(l=>l.trim());
      if (lines.length < 2) { NOTIFY.show('File is empty or invalid','error'); return; }

      function parseCSVLine(line) {
        const result=[]; let cur=''; let inQ=false;
        for (const ch of line) {
          if (ch==='"') { inQ=!inQ; continue; }
          if (ch===',' && !inQ) { result.push(cur.trim()); cur=''; continue; }
          cur+=ch;
        }
        result.push(cur.trim());
        return result;
      }
      function parseNum(s) {
        if (!s) return 0;
        return parseFloat(s.replace(/[₹$,\s()]/g,'').replace(/[^0-9.-]/g,''))||0;
      }

      const header = parseCSVLine(lines[0]).map(h=>h.toLowerCase().trim());
      const dateIdx  = header.findIndex(h=>h.includes('date'));
      const descIdx  = header.findIndex(h=>h.includes('desc')||h.includes('narr')||h.includes('particular')||h.includes('detail'));
      const debitIdx = header.findIndex(h=>h.includes('debit')||h.includes('dr')||h.includes('withdraw'));
      const creditIdx= header.findIndex(h=>h.includes('credit')||h.includes('cr')||h.includes('deposit'));
      const balIdx   = header.findIndex(h=>h.includes('bal'));

      const parsed = [];
      for (let i=1; i<lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 3) continue;
        const debit  = debitIdx>=0  ? parseNum(cols[debitIdx])  : 0;
        const credit = creditIdx>=0 ? parseNum(cols[creditIdx]) : 0;
        const amount = credit > 0 ? credit : debit > 0 ? -debit : 0;
        if (amount === 0) continue;
        parsed.push({
          date:        cols[dateIdx]?.trim()||FIN.today(),
          description: cols[descIdx]?.trim()||'Bank Transaction',
          amount,
          balanceAfter: balIdx>=0?parseNum(cols[balIdx]):null,
          matched:     false
        });
      }

      const el = document.getElementById('imp_preview');
      if (el) el.innerHTML = `
        <div class="alert" style="background:rgba(0,214,143,.08);border-color:rgba(0,214,143,.3)">
          <span>✅</span><div>${parsed.length} transactions parsed. <button class="btn btn-gold btn-sm" style="margin-left:10px" onclick="BNK.importTxns(${JSON.stringify(parsed).replace(/"/g,'&quot;')})">Import All</button></div>
        </div>
        <div class="tbl-scroll" style="max-height:250px;margin-top:10px"><table>
          <thead><tr><th>Date</th><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            ${parsed.slice(0,10).map(t=>`<tr>
              <td class="td-m">${escapeHTML(t.date)}</td>
              <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis">${escapeHTML(t.description)}</td>
              <td class="${t.amount>0?'td-g':'td-r'}" style="font-weight:700">${t.amount>0?'+':'-'}${FIN.sym()}${Math.abs(t.amount).toLocaleString('en-IN')}</td>
            </tr>`).join('')}
            ${parsed.length>10?`<tr><td colspan="3" style="text-align:center;color:var(--muted);font-size:12px">...and ${parsed.length-10} more</td></tr>`:''}
          </tbody>
        </table></div>`;
    };
    reader.readAsText(file);
  },

  importTxns(txnsJson) {
    const accId = document.getElementById('imp_acc')?.value;
    if (!accId) { NOTIFY.show('Select account first','warning'); return; }
    let txns;
    try { txns = typeof txnsJson === 'string' ? JSON.parse(txnsJson) : txnsJson; }
    catch { NOTIFY.show('Parse error','error'); return; }
    txns.forEach(t => STRATIX_DB.push('bankTransactions', { ...t, accountId: accId }));
    // Update account balance to last balance
    const lastBal = txns.filter(t=>t.balanceAfter!=null).pop()?.balanceAfter;
    if (lastBal != null) STRATIX_DB.update('bankAccounts', accId, { balance: lastBal });
    document.getElementById('importModal')?.remove();
    NOTIFY.show(`${txns.length} transactions imported!`,'success');
    renderBankRecon('transactions');
  },

  exportTxnCSV() {
    const txns = STRATIX_DB.getArr('bankTransactions');
    const accs = STRATIX_DB.getArr('bankAccounts');
    if (txns.length===0) { NOTIFY.show('No transactions to export','warning'); return; }
    const rows = [['Date','Bank','Account','Description','Category','Amount','Balance After','Matched']];
    txns.sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(t=>{
      const acc=accs.find(a=>a.id===t.accountId);
      rows.push([t.date||'',`"${acc?.bankName||''}"`,`****${(acc?.accountNo||'').slice(-4)}`,`"${t.description||''}"`,t.category||'',t.amount||0,t.balanceAfter||'',t.matched?'Yes':'No']);
    });
    FIN.downloadCSV(rows, `STRATIX_BankTransactions_${FIN.today()}.csv`);
    NOTIFY.show('Transactions exported!','success');
  }
};


/* ══════════════════════════════════════════════════════════════
   AUTO-PATCH — Wire up all 3 modules to APP routing
   ══════════════════════════════════════════════════════════════ */
(function patchFinance() {
  function doPatching() {
    if (typeof APP === 'undefined') { setTimeout(doPatching, 300); return; }

    // ── Direct render-table patch (most reliable approach) ──
    // app.js renderSection uses a lookup table — we overwrite entries directly.

    // 1. GST — all verticals get deep GST
    APP.renderGST = function() { renderGSTDeep('dashboard'); };

    // 2. Salary — only non-transport/logistics gets deep payroll
    //    Transport vertical uses renderDriverPayroll() from v_transport.js
    window.renderSalary = function() {
      const biz = (typeof VERTICAL !== 'undefined' && VERTICAL.current()?.id) || '';
      if (biz === 'logistics' || biz === 'transport') {
        // Let v_transport.js handle it — call original if exists
        if (typeof renderDriverPayroll === 'function') renderDriverPayroll('drivers');
      } else {
        renderPayrollDeep('employees');
      }
    };

    // 3. Bank — all verticals get deep bank reconciliation
    window.renderBankConnect = function() { renderBankRecon('accounts'); };

    // 4. Also patch renderSection for safety (handles any direct navigate calls)
    const _origRS = APP.renderSection.bind(APP);
    APP.renderSection = function(id) {
      if (id === 'gst')  { APP.renderGST(); return; }
      if (id === 'bank') { renderBankRecon('accounts'); return; }
      if (id === 'salary') { window.renderSalary(); return; }
      _origRS(id);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doPatching);
  } else {
    doPatching();
  }
})();
