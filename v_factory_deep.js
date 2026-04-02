/**
 * STRATIX v_factory_deep.js v2.0 — ROUND 3: FACTORY COMPLETE
 * ══════════════════════════════════════════════════════════════
 *
 * MODULE 1 → FACTORY DASHBOARD (deep rebuild)
 *   - Real KPIs from all factory data
 *   - Low stock alert banner
 *   - Production efficiency chart (6M)
 *   - Today's batch status strip
 *   - Machine utilization cards
 *   - Pending orders pipeline
 *
 * MODULE 2 → PRODUCTION DEEP (renderProductionDeep)
 *   TAB 1 — Batch Management
 *     - Full batch form: product, BOM linkage, machine, worker, shift
 *     - Live progress % bar + output entry
 *     - Cost per batch (raw material + labour + machine)
 *     - Status pipeline: Planned → Running → QC → Completed
 *     - Scrap / rejection tracking
 *   TAB 2 — Bill of Materials (BOM)
 *     - BOM per product with all raw material ingredients + quantities
 *     - "Can produce X units" calculator vs current stock
 *     - BOM cost roll-up per unit
 *     - Auto-consume raw materials when batch completes
 *   TAB 3 — Quality Control
 *     - QC entry per batch: pass/fail/partial
 *     - Rejection reason log
 *     - Yield % tracking per product
 *     - QC history table
 *   TAB 4 — Production Analytics
 *     - Monthly output chart (last 6M)
 *     - Top products by volume
 *     - Yield trend
 *     - Efficiency (actual vs target)
 *     - Cost per unit trend
 *
 * MODULE 3 → RAW MATERIAL DEEP (renderRawMaterialDeep)
 *   TAB 1 — Stock Register
 *     - Full material card: supplier, unit cost, stock value, lead time
 *     - Color-coded stock levels (critical/low/ok/excess)
 *     - Stock movement history
 *   TAB 2 — GRN (Goods Receipt Note)
 *     - Receive raw materials against POs
 *     - GRN number, supplier invoice, quality check flag
 *     - Auto-updates stock and logs expense
 *   TAB 3 — Material Issue
 *     - Issue materials to production jobs/batches
 *     - Auto-deducts from stock
 *     - Issue register
 *   TAB 4 — Consumption Analytics
 *     - Per-material consumption chart (6M)
 *     - Wastage tracking
 *     - Reorder schedule
 *     - Supplier-wise purchase analysis
 *
 * MODULE 4 → ERP DEEP (extends existing erp.js)
 *   - Adds BOM tab to production jobs
 *   - Adds material consumption on SO dispatch
 *   - Adds production cost to financial ledger
 *   - Cost-of-Goods-Sold (COGS) calculation
 *   - Gross margin per product
 *
 * INTEGRATION:
 *   - Patches renderFactoryDashboard() → deep version
 *   - Patches APP.renderSection('production') → renderProductionDeep()
 *   - Patches APP.renderSection('scm') → renderRawMaterialDeep()
 *   - Patches renderERP() → renderERPDeep()
 *   - Auto-wires on DOMContentLoaded
 *
 * DATA KEYS (new, backward-compatible):
 *   fct_batches     — existing (extended)
 *   fct_bom         — [{id, product, items:[{materialId,materialName,qty,unit}]}]
 *   fct_qc          — [{batchId, date, passed, failed, rejected, reason, yield}]
 *   fct_grn         — [{id, grnNo, supplierId, supplierName, date, items:[{materialId,qty,costPerUnit}], invoiceNo}]
 *   fct_issue       — [{id, date, batchId, batchNo, items:[{materialId,materialName,qty}]}]
 *   fct_workers     — existing
 *   fct_machines    — existing
 *   fct_rawmats     — existing (extended with costPerUnit, supplier, leadDays)
 *   fct_stocklog    — [{materialId, date, type, qty, balAfter, ref}]
 * ══════════════════════════════════════════════════════════════
 */

/* ── Factory Helpers ─────────────────────────────────────────── */
const FCT = {
  sym()  { return STRATIX_DB.getSettings().currencySymbol || '₹'; },
  today(){ return new Date().toISOString().split('T')[0]; },

  fmt(n) {
    n = Math.abs(Number(n)||0);
    if (n >= 1e7) return (FCT.sym()) + (n/1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return (FCT.sym()) + (n/1e5).toFixed(2) + ' L';
    if (n >= 1e3) return (FCT.sym()) + Math.round(n/1000) + 'K';
    return (FCT.sym()) + Math.round(n).toLocaleString('en-IN');
  },

  fmtN(n) {
    return Math.abs(Number(n)||0).toLocaleString('en-IN', { maximumFractionDigits:2 });
  },

  dateStr(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  },

  monthKey(offset=0) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth()+offset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  },

  last6Months() {
    const months = [];
    for (let i=5;i>=0;i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth()-i);
      months.push({
        key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
        label: d.toLocaleString('en-IN',{month:'short'})
      });
    }
    return months;
  },

  badge(text, cls='bm') { return `<span class="badge ${cls}">${escapeHTML(String(text))}</span>`; },

  statusBadge(s) {
    const map = {
      'running':'bg','completed':'bg','Completed':'bg',
      'paused':'bo','Planned':'bm','In Progress':'bb',
      'QC Check':'bo','On Hold':'bm',
      'pass':'bg','fail':'br','partial':'bo',
      'ok':'bg','low':'bo','critical':'br','excess':'bb'
    };
    return FCT.badge(s, map[s]||'bm');
  },

  modal(id, title, body, wide=false) {
    return `<div class="overlay" id="${id}" onclick="if(event.target.id==='${id}')document.getElementById('${id}').remove()">
      <div class="modal" style="${wide?'max-width:760px':'max-width:520px'}">
        <div class="modal-hd">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="document.getElementById('${id}').remove()">✕</button>
        </div>
        <div class="modal-body">${body}</div>
      </div>
    </div>`;
  },

  downloadCSV(rows, filename) {
    const csv  = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  },

  // Stock level classification
  stockLevel(mat) {
    const qty = Number(mat.qty||0);
    const min = Number(mat.minQty||0);
    const max = Number(mat.maxQty||0);
    if (qty === 0)       return 'critical';
    if (qty <= min)      return 'low';
    if (max && qty >= max*0.9) return 'excess';
    return 'ok';
  },

  stockLevelColor(level) {
    return {critical:'var(--red)',low:'var(--orange)',ok:'var(--green)',excess:'var(--blue)'}[level]||'var(--txt)';
  },

  // Compute batch cost from BOM + raw material unit costs
  batchCost(batch) {
    const boms    = STRATIX_DB.getArr('fct_bom');
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const workers = STRATIX_DB.getArr('fct_workers');
    const bom     = boms.find(b=>b.product===batch.product);
    let materialCost = 0;
    if (bom) {
      bom.items.forEach(item => {
        const mat  = rawmats.find(m=>m.id===item.materialId);
        const cost = Number(mat?.costPerUnit||0);
        materialCost += cost * Number(item.qty||0) * Number(batch.targetQty||1);
      });
    }
    const labourRate  = workers.length ? workers.reduce((s,w)=>s+Number(w.wage||0)/8,0)/workers.length : 0;
    const labourHours = Number(batch.labourHours||0);
    const labourCost  = labourRate * labourHours;
    const machineCost = Number(batch.machineCostPerHr||0) * Number(batch.machineHours||0);
    return { materialCost, labourCost, machineCost, total: materialCost+labourCost+machineCost };
  }
};


/* ══════════════════════════════════════════════════════════════
   MODULE 1 — FACTORY DASHBOARD DEEP
   ══════════════════════════════════════════════════════════════ */

function renderFactoryDashboard() {
  const s        = STRATIX_AUTH.getSession();
  const cfg      = STRATIX_DB.getSettings();
  const sym      = FCT.sym();
  const now      = new Date();
  const td       = now.toISOString().split('T')[0];
  const mKey     = FCT.monthKey(0);

  const txns     = STRATIX_DB.getArr('transactions');
  const batches  = STRATIX_DB.getArr('fct_batches');
  const workers  = STRATIX_DB.getArr('fct_workers');
  const machines = STRATIX_DB.getArr('fct_machines');
  const rawmats  = STRATIX_DB.getArr('fct_rawmats');
  const orders   = STRATIX_DB.getArr('erpJobs');
  const qcData   = STRATIX_DB.getArr('fct_qc');

  // KPIs
  const mRev   = txns.filter(t=>t.type==='revenue'&&(t.date||'').startsWith(mKey)).reduce((s,t)=>s+Number(t.amount||0),0);
  const mExp   = txns.filter(t=>t.type==='expense'&&(t.date||'').startsWith(mKey)).reduce((s,t)=>s+Number(t.amount||0),0);
  const mProfit= mRev - mExp;

  const todayBatches  = batches.filter(b=>b.date===td);
  const todayOutput   = todayBatches.reduce((s,b)=>s+Number(b.doneQty||0),0);
  const mBatches      = batches.filter(b=>(b.date||'').startsWith(mKey));
  const mOutput       = mBatches.reduce((s,b)=>s+Number(b.doneQty||0),0);
  const mTarget       = mBatches.reduce((s,b)=>s+Number(b.targetQty||0),0);
  const efficiency    = mTarget > 0 ? Math.round((mOutput/mTarget)*100) : 0;

  const running       = batches.filter(b=>b.status==='running').length;
  const workersPresent= workers.filter(w=>w.todayStatus==='present').length;
  const machinesOn    = machines.filter(m=>m.status==='running').length;
  const lowMats       = rawmats.filter(r=>FCT.stockLevel(r)!=='ok'&&FCT.stockLevel(r)!=='excess');
  const stockValue    = rawmats.reduce((s,r)=>s+Number(r.qty||0)*Number(r.costPerUnit||0),0);

  // Yield from QC
  const mQC      = qcData.filter(q=>(q.date||'').startsWith(mKey));
  const mPassed  = mQC.reduce((s,q)=>s+Number(q.passed||0),0);
  const mTotal   = mQC.reduce((s,q)=>s+Number(q.passed||0)+Number(q.failed||0),0);
  const avgYield = mTotal > 0 ? Math.round((mPassed/mTotal)*100) : 100;

  // 6M production chart
  const months6 = FCT.last6Months();
  months6.forEach(m => {
    m.output = batches.filter(b=>(b.date||'').startsWith(m.key)).reduce((s,b)=>s+Number(b.doneQty||0),0);
    m.target = batches.filter(b=>(b.date||'').startsWith(m.key)).reduce((s,b)=>s+Number(b.targetQty||0),0);
    m.rev    = txns.filter(t=>t.type==='revenue'&&(t.date||'').startsWith(m.key)).reduce((s,t)=>s+Number(t.amount||0),0);
  });
  const maxOutput = Math.max(...months6.map(m=>Math.max(m.output,m.target)),1);
  const maxRev    = Math.max(...months6.map(m=>m.rev),1);

  // Pending orders (erpJobs not completed)
  const pendingJobs = orders.filter(o=>o.status!=='Completed'&&o.status!=='Cancelled').slice(0,5);

  // Top products this month
  const productMap = {};
  mBatches.forEach(b=>{
    const k = b.product||'Unknown';
    if (!productMap[k]) productMap[k]={output:0,target:0};
    productMap[k].output+=Number(b.doneQty||0);
    productMap[k].target+=Number(b.targetQty||0);
  });
  const topProducts = Object.entries(productMap).sort((a,b)=>b[1].output-a[1].output).slice(0,4);

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    ${typeof VERTICAL !== 'undefined' ? VERTICAL.bannerHTML() : ''}

    <div class="sec-head">
      <div>
        <div class="sec-title">Good ${_greet()}, ${escapeHTML(s.name)} 👋</div>
        <div class="sec-sub">${escapeHTML(cfg.businessName||s.biz)} · ${now.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long'})}</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="APP.navigate('erp')">🏭 New Batch</button>
        <button class="btn btn-outline" onclick="APP.navigate('scm')">📦 Raw Materials</button>
        <button class="btn btn-outline" onclick="APP.navigate('erp')">📋 ERP</button>
      </div>
    </div>

    <!-- Low stock alert banner -->
    ${lowMats.length > 0 ? `
    <div class="alert a-red" style="margin-bottom:16px">
      <span class="alert-ico">⚠️</span>
      <div>
        <strong>${lowMats.length} material${lowMats.length>1?'s':''} need attention:</strong>
        ${lowMats.map(m=>`<span style="background:rgba(232,64,64,.15);padding:2px 8px;border-radius:6px;font-size:11px;margin:0 3px">${escapeHTML(m.name)} (${m.qty||0} ${m.unit||''})</span>`).join('')}
        <button class="btn btn-ghost btn-sm" style="margin-left:8px" onclick="APP.navigate('scm')">Manage →</button>
      </div>
    </div>` : ''}

    <!-- KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:18px">
      <div class="kpi" onclick="APP.navigate('erp')" style="cursor:pointer">
        <div class="kpi-ico">📦</div>
        <div class="kpi-lbl">Today's Output</div>
        <div class="kpi-val" style="color:var(--blue)">${todayOutput}</div>
        <div class="kpi-trend muted">${todayBatches.length} batch${todayBatches.length!==1?'es':''} today</div>
      </div>
      <div class="kpi accent">
        <div class="kpi-ico">⚡</div>
        <div class="kpi-lbl">Efficiency (Month)</div>
        <div class="kpi-val ${efficiency>=85?'green':efficiency>=60?'gold':'red'}">${efficiency}%</div>
        <div class="kpi-trend">${mOutput} / ${mTarget} units</div>
      </div>
      <div class="kpi" onclick="APP.navigate('erp')" style="cursor:pointer">
        <div class="kpi-ico">✅</div>
        <div class="kpi-lbl">Yield Rate (Month)</div>
        <div class="kpi-val ${avgYield>=95?'green':avgYield>=80?'gold':'red'}">${avgYield}%</div>
        <div class="kpi-trend muted">QC pass rate</div>
      </div>
      <div class="kpi">
        <div class="kpi-ico">🔧</div>
        <div class="kpi-lbl">Machines Running</div>
        <div class="kpi-val ${machinesOn>0?'green':'red'}">${machinesOn}<span style="font-size:12px;color:var(--muted)"> / ${machines.length}</span></div>
        <div class="kpi-trend ${running>0?'up':'muted'}">${running} active batch${running!==1?'es':''}</div>
      </div>
      <div class="kpi ${mProfit>=0?'':''}">
        <div class="kpi-ico">💰</div>
        <div class="kpi-lbl">Profit (Month)</div>
        <div class="kpi-val ${mProfit>=0?'green':'red'}">${FCT.fmt(Math.abs(mProfit))}</div>
        <div class="kpi-trend ${mProfit>=0?'up':'down'}">${mProfit>=0?'▲ Profit':'▼ Loss'}</div>
      </div>
    </div>

    <!-- Row 2: three cards -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px">

      <!-- Workers + Machines -->
      <div class="card">
        <div class="card-title">👷 Workforce & Machines</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div style="text-align:center;background:var(--s2);padding:10px;border-radius:10px">
            <div style="font-size:26px;font-weight:800;color:var(--green)">${workersPresent}</div>
            <div style="font-size:11px;color:var(--muted)">Present / ${workers.length}</div>
          </div>
          <div style="text-align:center;background:var(--s2);padding:10px;border-radius:10px">
            <div style="font-size:26px;font-weight:800;color:var(--blue)">${machinesOn}</div>
            <div style="font-size:11px;color:var(--muted)">Machines On / ${machines.length}</div>
          </div>
        </div>
        <div style="margin-bottom:6px;font-size:11px;color:var(--muted)">Production Capacity Used</div>
        <div class="prog"><div class="prog-fill po" style="width:${machines.length?Math.round((machinesOn/machines.length)*100):0}%"></div></div>
        <div style="font-size:11px;color:var(--gold);margin-top:4px;font-weight:700">${machines.length?Math.round((machinesOn/machines.length)*100):0}% of machines active</div>
        <button class="btn btn-ghost btn-sm btn-full" style="margin-top:10px" onclick="APP.navigate('erp')">Manage →</button>
      </div>

      <!-- Raw Material Status -->
      <div class="card">
        <div class="card-title">🔩 Raw Material Status</div>
        <div style="font-size:13px;font-weight:700;color:var(--gold);margin-bottom:8px">Stock Value: ${FCT.fmt(stockValue)}</div>
        ${rawmats.length === 0
          ? `<div style="color:var(--muted);font-size:13px;text-align:center;padding:14px 0">No materials tracked<br/><button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="APP.navigate('scm')">Add Material</button></div>`
          : rawmats.slice(0,5).map(m => {
              const level = FCT.stockLevel(m);
              const pct   = m.maxQty ? Math.min(100, Math.round((Number(m.qty||0)/Number(m.maxQty))*100)) : 50;
              return `<div style="margin-bottom:9px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
                  <span style="font-size:12px;font-weight:600">${escapeHTML(m.name)}</span>
                  <span style="font-size:11px;font-weight:700;color:${FCT.stockLevelColor(level)}">${m.qty||0} ${m.unit||''}</span>
                </div>
                <div class="prog"><div class="prog-fill" style="width:${pct}%;background:${FCT.stockLevelColor(level)}"></div></div>
              </div>`;
            }).join('')}
        <button class="btn btn-ghost btn-sm btn-full" style="margin-top:10px" onclick="APP.navigate('scm')">Full Register →</button>
      </div>

      <!-- Pending Jobs -->
      <div class="card">
        <div class="card-title">📋 Pending Job Orders</div>
        ${pendingJobs.length === 0
          ? `<div style="color:var(--muted);font-size:13px;text-align:center;padding:14px 0">No pending jobs.<br/><button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="APP.navigate('erp')">Create Job</button></div>`
          : pendingJobs.map(j => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--b1)">
              <div>
                <div style="font-size:12px;font-weight:700">${escapeHTML(j.product||j.jobNo||'—')}</div>
                <div style="font-size:10px;color:var(--muted)">${j.qty||1} units · Due: ${FCT.dateStr(j.dueDate)}</div>
              </div>
              ${FCT.statusBadge(j.status||'Planned')}
            </div>`).join('')}
        <button class="btn btn-ghost btn-sm btn-full" style="margin-top:10px" onclick="APP.navigate('erp')">All Jobs →</button>
      </div>
    </div>

    <!-- Charts row -->
    <div class="charts-row" style="margin-bottom:18px">

      <!-- Production output chart -->
      <div class="chart-card">
        <div class="chart-hd">
          <h3>📊 Production Output vs Target — Last 6 Months</h3>
          <span class="chart-sub">units</span>
        </div>
        <div class="bar-chart">
          ${months6.map(m => `
          <div class="bar-grp">
            <div class="bars">
              <div class="bar rev" style="height:${Math.round((m.output/maxOutput)*120)}px" title="Output: ${m.output}"></div>
              <div class="bar exp" style="height:${Math.round((m.target/maxOutput)*120)}px;opacity:.45" title="Target: ${m.target}"></div>
            </div>
            <div class="bar-lbl">${m.label}</div>
          </div>`).join('')}
        </div>
        <div class="chart-legend">
          <div class="leg rev">Actual Output</div>
          <div class="leg exp">Target</div>
        </div>
      </div>

      <!-- Top products this month -->
      <div class="chart-card">
        <div class="chart-hd"><h3>🏆 Top Products (This Month)</h3></div>
        ${topProducts.length === 0
          ? `<div style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0">No production data yet.</div>`
          : topProducts.map(([name,d]) => {
              const eff = d.target > 0 ? Math.round((d.output/d.target)*100) : 100;
              return `<div style="margin-bottom:12px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                  <span style="font-size:12px;font-weight:600">${escapeHTML(name)}</span>
                  <span style="font-size:11px;color:var(--muted)">${d.output} / ${d.target} units</span>
                </div>
                <div class="prog"><div class="prog-fill po" style="width:${Math.min(100,eff)}%;background:${eff>=85?'var(--green)':eff>=60?'var(--gold)':'var(--red)'}"></div></div>
                <div style="font-size:10px;color:var(--muted);margin-top:2px">${eff}% efficiency</div>
              </div>`;
            }).join('')}
      </div>
    </div>

    <!-- Quick Actions -->
    ${typeof VERTICAL !== 'undefined' ? VERTICAL.quickActionsHTML() : ''}

    <!-- Recent batches table -->
    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">🏭 Recent Batches</span>
        <button class="btn btn-outline btn-sm" onclick="APP.navigate('erp')">All Batches →</button>
      </div>
      ${batches.length === 0
        ? `<div style="padding:28px;text-align:center;color:var(--muted);font-size:13px">No batches yet. <button class="btn btn-ghost btn-sm" onclick="APP.navigate('erp')">Start First Batch</button></div>`
        : `<div class="tbl-scroll"><table>
            <thead><tr><th>Batch No.</th><th>Product</th><th>Target</th><th>Done</th><th>Efficiency</th><th>Machine</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
            ${[...batches].sort((a,b)=>new Date(b.createdAt||b.date)-new Date(a.createdAt||a.date)).slice(0,8).map(b=>{
              const eff = b.targetQty > 0 ? Math.round((Number(b.doneQty||0)/Number(b.targetQty))*100) : 0;
              return `<tr>
                <td class="td-m" style="font-family:monospace">${escapeHTML(b.batchNo||'—')}</td>
                <td class="td-b">${escapeHTML(b.product||'—')}</td>
                <td>${b.targetQty||0} ${b.unit||''}</td>
                <td style="font-weight:700;color:var(--green)">${b.doneQty||0} ${b.unit||''}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <div class="prog" style="width:50px"><div class="prog-fill" style="width:${Math.min(100,eff)}%;background:${eff>=85?'var(--green)':eff>=60?'var(--gold)':'var(--red)'}"></div></div>
                    <span style="font-size:11px">${eff}%</span>
                  </div>
                </td>
                <td class="td-m">${escapeHTML(b.machine||'—')}</td>
                <td>${FCT.statusBadge(b.status||'running')}</td>
                <td class="td-m">${FCT.dateStr(b.date)}</td>
              </tr>`;
            }).join('')}
            </tbody>
          </table></div>`}
    </div>
  </div>`;
}


/* ══════════════════════════════════════════════════════════════
   MODULE 2 — PRODUCTION DEEP
   ══════════════════════════════════════════════════════════════ */

function renderProductionDeep(activeTab) {
  activeTab = activeTab || 'batches';
  const batches  = STRATIX_DB.getArr('fct_batches');
  const machines = STRATIX_DB.getArr('fct_machines');
  const workers  = STRATIX_DB.getArr('fct_workers');
  const mKey     = FCT.monthKey(0);

  const running   = batches.filter(b=>b.status==='running').length;
  const completed = batches.filter(b=>b.status==='completed'&&(b.date||'').startsWith(mKey)).length;
  const mOutput   = batches.filter(b=>(b.date||'').startsWith(mKey)).reduce((s,b)=>s+Number(b.doneQty||0),0);

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">🏭 Production Management</h1>
        <p class="sec-sub">Batches · BOM · Quality Control · Analytics</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="PROD.openAddBatch()">+ New Batch</button>
        <button class="btn btn-outline" onclick="PROD._tab('bom')">📐 BOM</button>
        <button class="btn btn-ghost btn-sm" onclick="PROD.exportBatchCSV()">📥 Export</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      <div class="kpi"><div class="kpi-lbl">Running Batches</div><div class="kpi-val blue">${running}</div></div>
      <div class="kpi accent"><div class="kpi-lbl">Completed (Month)</div><div class="kpi-val green">${completed}</div></div>
      <div class="kpi"><div class="kpi-lbl">Output (Month)</div><div class="kpi-val">${mOutput.toLocaleString('en-IN')} units</div></div>
      <div class="kpi"><div class="kpi-lbl">Total Batches</div><div class="kpi-val">${batches.length}</div></div>
    </div>

    <div class="calc-tabs" style="margin-bottom:16px">
      <button class="calc-tab${activeTab==='batches'?' active':''}" data-prodtab="batches" onclick="PROD._tab('batches')">📋 Batches</button>
      <button class="calc-tab${activeTab==='bom'?' active':''}" data-prodtab="bom" onclick="PROD._tab('bom')">📐 Bill of Materials</button>
      <button class="calc-tab${activeTab==='qc'?' active':''}" data-prodtab="qc" onclick="PROD._tab('qc')">✅ Quality Control</button>
      <button class="calc-tab${activeTab==='analytics'?' active':''}" data-prodtab="analytics" onclick="PROD._tab('analytics')">📊 Analytics</button>
      <button class="calc-tab${activeTab==='workers'?' active':''}" data-prodtab="workers" onclick="PROD._tab('workers')">👷 Workers</button>
      <button class="calc-tab${activeTab==='machines'?' active':''}" data-prodtab="machines" onclick="PROD._tab('machines')">⚙️ Machines</button>
    </div>

    <div id="prodTabContent">${PROD._renderTab(activeTab)}</div>
    <div id="prodModal"></div>
  </div>`;
}

const PROD = {
  _tab(tab) {
    document.querySelectorAll('[data-prodtab]').forEach(b=>b.classList.toggle('active',b.dataset.prodtab===tab));
    const el = document.getElementById('prodTabContent');
    if (el) el.innerHTML = this._renderTab(tab);
  },

  _renderTab(tab) {
    if (tab==='batches')   return this._renderBatches();
    if (tab==='bom')       return this._renderBOM();
    if (tab==='qc')        return this._renderQC();
    if (tab==='analytics') return this._renderAnalytics();
    if (tab==='workers')   return this._renderWorkers();
    if (tab==='machines')  return this._renderMachines();
    return '';
  },

  /* ── BATCHES ── */
  _renderBatches() {
    const batches  = STRATIX_DB.getArr('fct_batches');
    const sym      = FCT.sym();
    const sorted   = [...batches].sort((a,b)=>new Date(b.createdAt||b.date)-new Date(a.createdAt||a.date));

    return `
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      ${['all','running','completed','paused'].map(s=>`
        <button onclick="PROD._filterBatches('${s}')" style="padding:5px 14px;border-radius:20px;border:1px solid var(--b1);background:transparent;color:var(--txt);font-size:12px;cursor:pointer;font-family:var(--font)">${s==='all'?'All':s.charAt(0).toUpperCase()+s.slice(1)} (${s==='all'?batches.length:batches.filter(b=>b.status===s).length})</button>`).join('')}
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Batch Register (${batches.length})</span>
        <button class="btn btn-gold btn-sm" onclick="PROD.openAddBatch()">+ New Batch</button>
      </div>
      <div id="batchTableWrap">
        ${this._renderBatchRows(sorted, sym)}
      </div>
    </div>`;
  },

  _renderBatchRows(batches, sym) {
    if (batches.length===0) return `<div style="padding:32px;text-align:center;color:var(--muted)">No batches yet. Click "+ New Batch" to start.</div>`;
    return `<div class="tbl-scroll"><table>
      <thead><tr><th>Batch No.</th><th>Product</th><th>Target</th><th>Done</th><th>Scrap</th><th>Efficiency</th><th>Machine</th><th>Shift</th><th>Cost</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
      <tbody>
      ${batches.map(b=>{
        const eff  = Number(b.targetQty||0)>0 ? Math.round((Number(b.doneQty||0)/Number(b.targetQty))*100) : 0;
        const cost = FCT.batchCost(b);
        return `<tr>
          <td class="td-m" style="font-family:monospace">${escapeHTML(b.batchNo||'—')}</td>
          <td class="td-b">${escapeHTML(b.product||'—')}</td>
          <td class="td-m">${b.targetQty||0} ${b.unit||''}</td>
          <td style="font-weight:700;color:var(--green)">${b.doneQty||0}</td>
          <td class="td-r">${b.scrapQty||0}</td>
          <td>
            <div style="display:flex;align-items:center;gap:5px">
              <div class="prog" style="width:45px"><div class="prog-fill" style="width:${Math.min(100,eff)}%;background:${eff>=85?'var(--green)':eff>=60?'var(--gold)':'var(--red)'}"></div></div>
              <span style="font-size:11px">${eff}%</span>
            </div>
          </td>
          <td class="td-m">${escapeHTML(b.machine||'—')}</td>
          <td class="td-m">${escapeHTML(b.shift||'—')}</td>
          <td class="td-m">${cost.total>0?FCT.fmt(cost.total):'—'}</td>
          <td>${FCT.statusBadge(b.status||'running')}</td>
          <td class="td-m">${FCT.dateStr(b.date)}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="PROD.openEditBatch('${b.id}')">✏️</button>
              ${b.status!=='completed'?`<button class="btn btn-green btn-sm" style="font-size:10px;padding:3px 7px" onclick="PROD.completeBatch('${b.id}')">✓ Done</button>`:''}
              ${b.status!=='completed'?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="PROD.openQCEntry('${b.id}')">QC</button>`:''}
              <button class="del-btn" onclick="PROD.deleteBatch('${b.id}')">🗑</button>
            </div>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
  },

  _filterBatches(status) {
    const all     = STRATIX_DB.getArr('fct_batches');
    const filtered= status==='all' ? all : all.filter(b=>b.status===status);
    const el      = document.getElementById('batchTableWrap');
    if (el) el.innerHTML = this._renderBatchRows([...filtered].sort((a,b)=>new Date(b.createdAt||b.date)-new Date(a.createdAt||a.date)), FCT.sym());
  },

  openAddBatch(id) {
    const all      = STRATIX_DB.getArr('fct_batches');
    const machines = STRATIX_DB.getArr('fct_machines');
    const workers  = STRATIX_DB.getArr('fct_workers');
    const boms     = STRATIX_DB.getArr('fct_bom');
    const e        = id ? (all.find(x=>x.id===id)||{}) : {};
    const batchNo  = id ? (e.batchNo||'') : 'BCH-' + String(all.length+1).padStart(4,'0');
    const products = [...new Set([...all.map(b=>b.product),...boms.map(b=>b.product)].filter(Boolean))];

    document.getElementById('prodModal').innerHTML = FCT.modal('batchModal', id?'✏️ Edit Batch':'🏭 New Production Batch', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Batch No. *</label><input id="pb_no" value="${escapeHTML(batchNo)}" placeholder="BCH-0001"/></div>
        <div class="field"><label>Product *</label>
          <input id="pb_prod" value="${escapeHTML(e.product||'')}" list="pb_prodlist" placeholder="Product name"/>
          <datalist id="pb_prodlist">${products.map(p=>`<option value="${escapeHTML(p)}">`).join('')}</datalist>
        </div>
        <div class="field"><label>Target Qty *</label><input type="number" id="pb_target" value="${e.targetQty||''}" placeholder="500"/></div>
        <div class="field"><label>Unit</label><input id="pb_unit" value="${escapeHTML(e.unit||'units')}" placeholder="pcs / kg / metres"/></div>
        <div class="field"><label>Start Date</label><input type="date" id="pb_date" value="${e.date||FCT.today()}"/></div>
        <div class="field"><label>End Date</label><input type="date" id="pb_enddate" value="${e.endDate||''}"/></div>
        <div class="field"><label>Machine</label>
          <select id="pb_machine">
            <option value="">— None —</option>
            ${machines.map(m=>`<option value="${escapeHTML(m.name)}" ${e.machine===m.name?'selected':''}>${escapeHTML(m.name)}</option>`).join('')}
            <option value="__manual__" ${!machines.find(m=>m.name===e.machine)&&e.machine?'selected':''}>Other (type below)</option>
          </select>
        </div>
        <div class="field"><label>Shift</label>
          <select id="pb_shift">
            ${['Morning (6am-2pm)','Afternoon (2pm-10pm)','Night (10pm-6am)','Full Day'].map(s=>`<option ${e.shift===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Assigned Worker(s)</label>
          <input id="pb_worker" value="${escapeHTML(e.worker||'')}" list="pb_workerlist" placeholder="Worker name"/>
          <datalist id="pb_workerlist">${workers.map(w=>`<option value="${escapeHTML(w.name)}">`).join('')}</datalist>
        </div>
        <div class="field"><label>Status</label>
          <select id="pb_status">
            ${['running','paused','completed'].map(s=>`<option value="${s}" ${(e.status||'running')===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Done Qty</label><input type="number" id="pb_done" value="${e.doneQty||0}" placeholder="0"/></div>
        <div class="field"><label>Scrap / Rejection Qty</label><input type="number" id="pb_scrap" value="${e.scrapQty||0}" placeholder="0"/></div>
        <div class="field"><label>Labour Hours</label><input type="number" id="pb_labhrs" value="${e.labourHours||''}" placeholder="8"/></div>
        <div class="field"><label>Machine Hours</label><input type="number" id="pb_machrs" value="${e.machineHours||''}" placeholder="8"/></div>
        <div class="field"><label>Machine Cost/Hr (${FCT.sym()})</label><input type="number" id="pb_machcost" value="${e.machineCostPerHr||''}" placeholder="50"/></div>
      </div>
      <div class="field" style="margin-top:10px"><label>Notes / Instructions</label><textarea id="pb_notes" rows="2" placeholder="Quality specs, special instructions...">${escapeHTML(e.notes||'')}</textarea></div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="PROD.saveBatch('${id||''}')">💾 ${id?'Update':'Start'} Batch</button>
    `, true);
  },

  openEditBatch(id) { this.openAddBatch(id); },

  saveBatch(id) {
    const product = document.getElementById('pb_prod')?.value.trim();
    const target  = +document.getElementById('pb_target')?.value||0;
    if (!product) { NOTIFY.show('Enter product name','warning'); return; }
    if (!target)  { NOTIFY.show('Enter target quantity','warning'); return; }
    const data = {
      batchNo:        document.getElementById('pb_no')?.value.trim()||'',
      product,
      targetQty:      target,
      unit:           document.getElementById('pb_unit')?.value.trim()||'units',
      date:           document.getElementById('pb_date')?.value||FCT.today(),
      endDate:        document.getElementById('pb_enddate')?.value||'',
      machine:        document.getElementById('pb_machine')?.value||'',
      shift:          document.getElementById('pb_shift')?.value||'',
      worker:         document.getElementById('pb_worker')?.value.trim()||'',
      status:         document.getElementById('pb_status')?.value||'running',
      doneQty:        +document.getElementById('pb_done')?.value||0,
      scrapQty:       +document.getElementById('pb_scrap')?.value||0,
      labourHours:    +document.getElementById('pb_labhrs')?.value||0,
      machineHours:   +document.getElementById('pb_machrs')?.value||0,
      machineCostPerHr:+document.getElementById('pb_machcost')?.value||0,
      notes:          document.getElementById('pb_notes')?.value.trim()||''
    };
    if (id) { STRATIX_DB.update('fct_batches',id,data); NOTIFY.show('Batch updated!','success'); }
    else    { STRATIX_DB.push('fct_batches',data);       NOTIFY.show('Batch started!','success'); }
    document.getElementById('batchModal')?.remove();
    this._tab('batches');
  },

  completeBatch(id) {
    const batch = STRATIX_DB.getArr('fct_batches').find(b=>b.id===id);
    if (!batch) return;
    // Auto-consume raw materials from BOM
    const boms    = STRATIX_DB.getArr('fct_bom');
    const bom     = boms.find(b=>b.product===batch.product);
    const doneQty = Number(batch.doneQty||0)||Number(batch.targetQty||0);
    if (bom && bom.items?.length) {
      const rawmats = STRATIX_DB.getArr('fct_rawmats');
      bom.items.forEach(item => {
        const mat = rawmats.find(m=>m.id===item.materialId);
        if (mat) {
          const consumed = Number(item.qty||0) * doneQty;
          const newQty   = Math.max(0, Number(mat.qty||0)-consumed);
          STRATIX_DB.update('fct_rawmats', mat.id, { qty: newQty });
          STRATIX_DB.push('fct_stocklog',{materialId:mat.id,materialName:mat.name,type:'issue',qty:consumed,balAfter:newQty,ref:`Batch ${batch.batchNo||id}`,date:FCT.today()});
        }
      });
      NOTIFY.show(`BOM consumed: ${bom.items.length} materials deducted from stock`,'info',4000);
    }
    // Log as revenue (finished goods)
    const inv  = STRATIX_DB.getArr('erpInventory');
    const item = inv.find(i=>i.name===batch.product);
    if (item) {
      STRATIX_DB.update('erpInventory', item.id, { qty: Number(item.qty||0)+doneQty });
    }
    STRATIX_DB.update('fct_batches', id, { status:'completed', doneQty, completedOn:FCT.today() });
    NOTIFY.show(`Batch completed! ${doneQty} ${batch.unit||'units'} added to stock`,'success',4000);
    this._tab('batches');
  },

  deleteBatch(id) {
    if (!confirm('Delete this batch?')) return;
    STRATIX_DB.remove('fct_batches',id);
    this._tab('batches');
  },

  /* ── BILL OF MATERIALS ── */
  _renderBOM() {
    const boms    = STRATIX_DB.getArr('fct_bom');
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const sym     = FCT.sym();

    return `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div class="card-title">📐 Bill of Materials — ${boms.length} products defined</div>
        <button class="btn btn-gold btn-sm" onclick="PROD.openAddBOM()">+ Add BOM</button>
      </div>
      <p style="font-size:12px;color:var(--muted);margin-top:6px">BOM defines which raw materials and how much is needed to produce one unit of each product. Used for auto-costing and auto-consumption when a batch completes.</p>
    </div>

    ${boms.length === 0
      ? `<div class="card" style="text-align:center;padding:40px 20px">
          <div style="font-size:36px;margin-bottom:10px">📐</div>
          <h3 style="color:var(--text2);margin-bottom:8px">No BOM Defined</h3>
          <p style="color:var(--muted);margin-bottom:16px">Define what raw materials go into each product.</p>
          <button class="btn btn-gold" onclick="PROD.openAddBOM()">+ Create First BOM</button>
        </div>`
      : boms.map(bom => {
          // Can produce calculator
          const canProduce = bom.items.length > 0
            ? Math.floor(Math.min(...bom.items.map(item => {
                const mat = rawmats.find(m=>m.id===item.materialId);
                const stock = Number(mat?.qty||0);
                const need  = Number(item.qty||0);
                return need > 0 ? stock/need : Infinity;
              })))
            : 0;
          // BOM cost per unit
          const costPerUnit = bom.items.reduce((s,item)=>{
            const mat = rawmats.find(m=>m.id===item.materialId);
            return s + Number(item.qty||0)*Number(mat?.costPerUnit||0);
          },0);
          return `
          <div class="card" style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
              <div>
                <div style="font-size:15px;font-weight:800">${escapeHTML(bom.product)}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:2px">${bom.items.length} materials · Cost/unit: ${FCT.fmt(costPerUnit)}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <div style="background:rgba(0,214,143,.1);padding:6px 12px;border-radius:8px;text-align:center">
                  <div style="font-size:10px;color:var(--muted)">Can Produce</div>
                  <div style="font-size:16px;font-weight:800;color:var(--green)">${canProduce}</div>
                  <div style="font-size:9px;color:var(--muted)">with current stock</div>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px">
                  <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="PROD.openEditBOM('${bom.id}')">✏️ Edit</button>
                  <button class="del-btn" onclick="PROD.deleteBOM('${bom.id}')">🗑</button>
                </div>
              </div>
            </div>
            <div class="tbl-scroll"><table>
              <thead><tr><th>Material</th><th>Qty per Unit</th><th>Unit</th><th>Current Stock</th><th>Cost/Unit</th><th>Status</th></tr></thead>
              <tbody>
              ${bom.items.map(item => {
                const mat   = rawmats.find(m=>m.id===item.materialId);
                const stock = Number(mat?.qty||0);
                const need  = Number(item.qty||0);
                const enough= stock >= need;
                return `<tr>
                  <td class="td-b">${escapeHTML(item.materialName||mat?.name||'—')}</td>
                  <td style="font-weight:700">${item.qty||0}</td>
                  <td class="td-m">${escapeHTML(item.unit||mat?.unit||'')}</td>
                  <td style="font-weight:700;color:${enough?'var(--green)':'var(--red)'}">${stock} ${mat?.unit||''}</td>
                  <td>${mat?.costPerUnit?FCT.fmt(Number(item.qty||0)*Number(mat.costPerUnit)):'—'}</td>
                  <td>${FCT.badge(enough?'OK':'Low Stock',enough?'bg':'br')}</td>
                </tr>`;
              }).join('')}
              </tbody>
            </table></div>
          </div>`;
        }).join('')}`;
  },

  openAddBOM(id) {
    const boms    = STRATIX_DB.getArr('fct_bom');
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const e       = id ? (boms.find(x=>x.id===id)||{items:[]}) : {items:[]};
    const batches = STRATIX_DB.getArr('fct_batches');
    const products= [...new Set(batches.map(b=>b.product).filter(Boolean))];

    document.getElementById('prodModal').innerHTML = FCT.modal('bomModal', id?'✏️ Edit BOM':'📐 Create Bill of Materials', `
      <div class="field" style="margin-bottom:14px">
        <label>Product Name *</label>
        <input id="bom_prod" value="${escapeHTML(e.product||'')}" list="bom_prodlist" placeholder="Product name"/>
        <datalist id="bom_prodlist">${products.map(p=>`<option value="${escapeHTML(p)}">`).join('')}</datalist>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Materials Required (per 1 unit of output)</div>
      <div id="bom_items">
        ${(e.items||[]).map((item,i)=>`
        <div class="bom-row" style="display:grid;grid-template-columns:1fr 80px 80px 32px;gap:8px;margin-bottom:8px;align-items:center">
          <select onchange="PROD._onBOMMatChange(this,${i})" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none">
            <option value="">— Select Material —</option>
            ${rawmats.map(m=>`<option value="${m.id}" ${m.id===item.materialId?'selected':''}>${escapeHTML(m.name)} (${m.qty||0} ${m.unit||''})</option>`).join('')}
          </select>
          <input type="number" value="${item.qty||''}" placeholder="Qty" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
          <input value="${escapeHTML(item.unit||'')}" placeholder="Unit" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
          <button onclick="this.closest('.bom-row').remove()" style="background:var(--rdim);border:none;border-radius:8px;color:var(--red);cursor:pointer;padding:7px;font-size:14px">×</button>
        </div>`).join('')}
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-bottom:14px" onclick="PROD._addBOMRow()">＋ Add Material</button>
      <button class="btn btn-gold btn-full" onclick="PROD.saveBOM('${id||''}')">💾 ${id?'Update':'Save'} BOM</button>
    `, true);
    // add a blank row if new BOM
    if (!id) setTimeout(()=>this._addBOMRow(),50);
  },

  openEditBOM(id) { this.openAddBOM(id); },

  _addBOMRow() {
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const container = document.getElementById('bom_items');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'bom-row';
    div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 80px 32px;gap:8px;margin-bottom:8px;align-items:center';
    div.innerHTML = `
      <select onchange="PROD._onBOMMatChange(this,-1)" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none">
        <option value="">— Select Material —</option>
        ${rawmats.map(m=>`<option value="${m.id}">${escapeHTML(m.name)} (${m.qty||0} ${m.unit||''})</option>`).join('')}
      </select>
      <input type="number" placeholder="Qty" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
      <input placeholder="Unit" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
      <button onclick="this.closest('.bom-row').remove()" style="background:var(--rdim);border:none;border-radius:8px;color:var(--red);cursor:pointer;padding:7px;font-size:14px">×</button>`;
    container.appendChild(div);
  },

  _onBOMMatChange(sel, rowIdx) {
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const mat     = rawmats.find(m=>m.id===sel.value);
    if (!mat) return;
    // Auto-fill unit from material
    const row     = sel.closest('.bom-row');
    const unitInp = row?.querySelectorAll('input')[1];
    if (unitInp && !unitInp.value) unitInp.value = mat.unit||'';
  },

  saveBOM(id) {
    const product = document.getElementById('bom_prod')?.value.trim();
    if (!product) { NOTIFY.show('Enter product name','warning'); return; }
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const rows    = document.querySelectorAll('#bom_items .bom-row');
    const items   = [];
    rows.forEach(row => {
      const sel  = row.querySelector('select');
      const inps = row.querySelectorAll('input');
      const matId= sel?.value;
      const qty  = +inps[0]?.value||0;
      const unit = inps[1]?.value.trim()||'';
      if (matId && qty > 0) {
        const mat = rawmats.find(m=>m.id===matId);
        items.push({ materialId:matId, materialName:mat?.name||'', qty, unit: unit||mat?.unit||'' });
      }
    });
    if (items.length === 0) { NOTIFY.show('Add at least one material','warning'); return; }
    const data = { product, items };
    if (id) { STRATIX_DB.update('fct_bom',id,data); NOTIFY.show('BOM updated!','success'); }
    else    { STRATIX_DB.push('fct_bom',data);       NOTIFY.show('BOM saved!','success'); }
    document.getElementById('bomModal')?.remove();
    this._tab('bom');
  },

  deleteBOM(id) {
    if (!confirm('Delete this BOM?')) return;
    STRATIX_DB.remove('fct_bom',id);
    this._tab('bom');
  },

  /* ── QUALITY CONTROL ── */
  _renderQC() {
    const qcData  = STRATIX_DB.getArr('fct_qc');
    const batches = STRATIX_DB.getArr('fct_batches');
    const sym     = FCT.sym();

    const totalPassed  = qcData.reduce((s,q)=>s+Number(q.passed||0),0);
    const totalFailed  = qcData.reduce((s,q)=>s+Number(q.failed||0),0);
    const totalInspect = totalPassed+totalFailed;
    const avgYield     = totalInspect>0 ? ((totalPassed/totalInspect)*100).toFixed(1) : 100;

    return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
      <div class="kpi accent"><div class="kpi-lbl">Total Inspected</div><div class="kpi-val">${totalInspect}</div></div>
      <div class="kpi"><div class="kpi-lbl">Passed</div><div class="kpi-val green">${totalPassed}</div></div>
      <div class="kpi"><div class="kpi-lbl">Rejected</div><div class="kpi-val red">${totalFailed}</div></div>
      <div class="kpi"><div class="kpi-lbl">Avg Yield</div><div class="kpi-val ${Number(avgYield)>=95?'green':Number(avgYield)>=80?'gold':'red'}">${avgYield}%</div></div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-title">✅ Record QC Entry</div>
      <div class="form-grid">
        <div class="field"><label>Batch *</label>
          <select id="qc_batch">
            <option value="">— Select Batch —</option>
            ${batches.filter(b=>b.status!=='completed').map(b=>`<option value="${b.id}">${escapeHTML(b.batchNo||b.id)} — ${escapeHTML(b.product||'')}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Date</label><input type="date" id="qc_date" value="${FCT.today()}"/></div>
        <div class="field"><label>Inspected Qty *</label><input type="number" id="qc_inspect" placeholder="500" oninput="PROD._calcYield()"/></div>
        <div class="field"><label>Passed Qty *</label><input type="number" id="qc_passed" placeholder="480" oninput="PROD._calcYield()"/></div>
        <div class="field"><label>Failed / Rejected Qty</label><input type="number" id="qc_failed" placeholder="20" oninput="PROD._calcYield()" readonly style="background:var(--s2)"/></div>
        <div class="field"><label>Yield % (Auto)</label><input type="number" id="qc_yield" readonly style="background:var(--s2);color:var(--gold);font-weight:700"/></div>
        <div class="field"><label>Result</label>
          <select id="qc_result">
            <option value="pass">Pass</option>
            <option value="partial">Partial Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>
        <div class="field form-full"><label>Rejection Reason</label><input id="qc_reason" placeholder="Dimensional defect / Surface finish / Material defect etc."/></div>
      </div>
      <button class="btn btn-gold" style="margin-top:10px" onclick="PROD.saveQC()">Save QC Entry</button>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">QC History (${qcData.length})</span>
        <button class="btn btn-ghost btn-sm" onclick="PROD.exportQCCSV()">📥 Export</button>
      </div>
      ${qcData.length===0?`<div style="padding:24px;text-align:center;color:var(--muted)">No QC entries yet.</div>`:`
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Batch</th><th>Product</th><th>Inspected</th><th>Passed</th><th>Failed</th><th>Yield</th><th>Result</th><th>Reason</th><th></th></tr></thead>
        <tbody>
        ${[...qcData].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(q=>{
          const batch = batches.find(b=>b.id===q.batchId);
          return `<tr>
            <td class="td-m">${FCT.dateStr(q.date)}</td>
            <td class="td-m" style="font-family:monospace">${escapeHTML(batch?.batchNo||q.batchId||'—')}</td>
            <td class="td-b">${escapeHTML(batch?.product||'—')}</td>
            <td>${q.inspected||0}</td>
            <td class="td-g">${q.passed||0}</td>
            <td class="td-r">${q.failed||0}</td>
            <td style="font-weight:700;color:${Number(q.yield||100)>=95?'var(--green)':Number(q.yield||100)>=80?'var(--gold)':'var(--red)'}">${q.yield||100}%</td>
            <td>${FCT.statusBadge(q.result||'pass')}</td>
            <td class="td-m" style="font-size:11px">${escapeHTML(q.reason||'—')}</td>
            <td><button class="del-btn" onclick="PROD.deleteQC('${q.id}')">🗑</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  },

  _calcYield() {
    const inspected = +document.getElementById('qc_inspect')?.value||0;
    const passed    = +document.getElementById('qc_passed')?.value||0;
    const failed    = inspected - passed;
    const yld       = inspected > 0 ? ((passed/inspected)*100).toFixed(1) : 100;
    const fe = document.getElementById('qc_failed'); if (fe) fe.value = Math.max(0,failed);
    const ye = document.getElementById('qc_yield');  if (ye) ye.value = yld;
    const re = document.getElementById('qc_result');
    if (re) re.value = Number(yld)>=95?'pass':Number(yld)>=70?'partial':'fail';
  },

  saveQC() {
    const batchId   = document.getElementById('qc_batch')?.value;
    const inspected = +document.getElementById('qc_inspect')?.value||0;
    const passed    = +document.getElementById('qc_passed')?.value||0;
    if (!batchId)    { NOTIFY.show('Select a batch','warning'); return; }
    if (!inspected)  { NOTIFY.show('Enter inspected quantity','warning'); return; }
    const failed = Math.max(0, inspected-passed);
    const yld    = inspected>0 ? ((passed/inspected)*100).toFixed(1) : 100;
    STRATIX_DB.push('fct_qc',{
      batchId,
      date:     document.getElementById('qc_date')?.value||FCT.today(),
      inspected, passed, failed,
      yield:    Number(yld),
      result:   document.getElementById('qc_result')?.value||'pass',
      reason:   document.getElementById('qc_reason')?.value.trim()||''
    });
    // Update batch doneQty with passed quantity
    STRATIX_DB.update('fct_batches', batchId, { doneQty: passed, scrapQty: failed });
    NOTIFY.show(`QC saved! Yield: ${yld}%`,'success');
    this._tab('qc');
  },

  openQCEntry(batchId) {
    this._tab('qc');
    setTimeout(()=>{
      const sel = document.getElementById('qc_batch');
      if (sel) sel.value = batchId;
    }, 100);
  },

  deleteQC(id) {
    if (!confirm('Delete QC entry?')) return;
    STRATIX_DB.remove('fct_qc',id);
    this._tab('qc');
  },

  exportQCCSV() {
    const qcData  = STRATIX_DB.getArr('fct_qc');
    const batches = STRATIX_DB.getArr('fct_batches');
    const rows = [['Date','Batch No','Product','Inspected','Passed','Failed','Yield %','Result','Reason']];
    qcData.forEach(q=>{
      const b=batches.find(x=>x.id===q.batchId);
      rows.push([q.date||'',b?.batchNo||'',`"${b?.product||''}"`,q.inspected||0,q.passed||0,q.failed||0,q.yield||100,q.result||'',`"${q.reason||''}"`]);
    });
    FCT.downloadCSV(rows, `STRATIX_QC_${FCT.today()}.csv`);
    NOTIFY.show('QC data exported!','success');
  },

  /* ── ANALYTICS ── */
  _renderAnalytics() {
    const batches = STRATIX_DB.getArr('fct_batches');
    const qcData  = STRATIX_DB.getArr('fct_qc');
    const months  = FCT.last6Months();

    months.forEach(m=>{
      const mb    = batches.filter(b=>(b.date||'').startsWith(m.key));
      m.output    = mb.reduce((s,b)=>s+Number(b.doneQty||0),0);
      m.target    = mb.reduce((s,b)=>s+Number(b.targetQty||0),0);
      m.efficiency= m.target>0?Math.round((m.output/m.target)*100):0;
      const mq    = qcData.filter(q=>(q.date||'').startsWith(m.key));
      const mqPass= mq.reduce((s,q)=>s+Number(q.passed||0),0);
      const mqTot = mq.reduce((s,q)=>s+Number(q.passed||0)+Number(q.failed||0),0);
      m.yield     = mqTot>0?Math.round((mqPass/mqTot)*100):0;
      m.batches   = mb.length;
    });

    const maxOut = Math.max(...months.map(m=>Math.max(m.output,m.target)),1);

    // Product performance
    const productMap = {};
    batches.forEach(b=>{
      const k=b.product||'Unknown';
      if(!productMap[k]) productMap[k]={output:0,target:0,batches:0,scrap:0};
      productMap[k].output  +=Number(b.doneQty||0);
      productMap[k].target  +=Number(b.targetQty||0);
      productMap[k].batches +=1;
      productMap[k].scrap   +=Number(b.scrapQty||0);
    });
    const topProducts = Object.entries(productMap).sort((a,b)=>b[1].output-a[1].output).slice(0,6);

    return `
    <div class="charts-row" style="margin-bottom:18px">
      <!-- Output vs Target -->
      <div class="chart-card">
        <div class="chart-hd"><h3>📊 Production Output vs Target (6 Months)</h3></div>
        <div class="bar-chart">
          ${months.map(m=>`
          <div class="bar-grp">
            <div class="bars">
              <div class="bar rev" style="height:${Math.round((m.output/maxOut)*120)}px" title="Output: ${m.output}"></div>
              <div class="bar exp" style="height:${Math.round((m.target/maxOut)*120)}px;opacity:.4" title="Target: ${m.target}"></div>
            </div>
            <div class="bar-lbl">${m.label}</div>
          </div>`).join('')}
        </div>
        <div class="chart-legend"><div class="leg rev">Actual Output</div><div class="leg exp">Target</div></div>
      </div>

      <!-- Efficiency + Yield trend -->
      <div class="chart-card">
        <div class="chart-hd"><h3>⚡ Efficiency & Yield Trend</h3></div>
        <div style="padding:10px 0">
          ${months.map(m=>`
          <div style="margin-bottom:12px">
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px">
              <span style="font-weight:600">${m.label}</span>
              <span style="color:var(--muted)">${m.batches} batch${m.batches!==1?'es':''} · ${m.output} units</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="font-size:10px;color:var(--muted);width:55px">Efficiency</span>
              <div class="prog" style="flex:1"><div class="prog-fill" style="width:${m.efficiency}%;background:${m.efficiency>=85?'var(--green)':m.efficiency>=60?'var(--gold)':'var(--red)'}"></div></div>
              <span style="font-size:11px;font-weight:700;width:32px;text-align:right;color:${m.efficiency>=85?'var(--green)':m.efficiency>=60?'var(--gold)':'var(--red)'}">${m.efficiency}%</span>
            </div>
            ${m.yield>0?`<div style="display:flex;gap:6px;align-items:center;margin-top:3px">
              <span style="font-size:10px;color:var(--muted);width:55px">Yield</span>
              <div class="prog" style="flex:1"><div class="prog-fill" style="width:${m.yield}%;background:${m.yield>=95?'var(--green)':m.yield>=80?'var(--gold)':'var(--red)'}"></div></div>
              <span style="font-size:11px;font-weight:700;width:32px;text-align:right;color:${m.yield>=95?'var(--green)':m.yield>=80?'var(--gold)':'var(--red)'}">${m.yield}%</span>
            </div>`:``}
          </div>`).join('')}
        </div>
      </div>
    </div>

    <!-- Product performance table -->
    ${topProducts.length > 0 ? `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Product Performance Summary</span><button class="btn btn-ghost btn-sm" onclick="PROD.exportAnalyticsCSV()">📥 Export</button></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Product</th><th>Total Batches</th><th>Total Output</th><th>Total Target</th><th>Efficiency</th><th>Total Scrap</th><th>Scrap Rate</th></tr></thead>
        <tbody>
        ${topProducts.map(([name,d])=>{
          const eff       = d.target>0?Math.round((d.output/d.target)*100):100;
          const scrapRate = (d.output+d.scrap)>0?((d.scrap/(d.output+d.scrap))*100).toFixed(1):0;
          return `<tr>
            <td class="td-b">${escapeHTML(name)}</td>
            <td>${d.batches}</td>
            <td style="font-weight:700;color:var(--green)">${d.output.toLocaleString('en-IN')}</td>
            <td>${d.target.toLocaleString('en-IN')}</td>
            <td>
              <div style="display:flex;align-items:center;gap:6px">
                <div class="prog" style="width:60px"><div class="prog-fill" style="width:${Math.min(100,eff)}%;background:${eff>=85?'var(--green)':eff>=60?'var(--gold)':'var(--red)'}"></div></div>
                <span style="font-size:12px;font-weight:700;color:${eff>=85?'var(--green)':eff>=60?'var(--gold)':'var(--red)'}">${eff}%</span>
              </div>
            </td>
            <td class="td-r">${d.scrap.toLocaleString('en-IN')}</td>
            <td class="td-r">${scrapRate}%</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>` : `<div class="card" style="text-align:center;padding:32px;color:var(--muted)">Add production batches to see analytics.</div>`}`;
  },

  exportAnalyticsCSV() {
    const batches = STRATIX_DB.getArr('fct_batches');
    const rows = [['Product','Total Batches','Total Output','Total Target','Efficiency %','Total Scrap','Scrap Rate %']];
    const pm={};
    batches.forEach(b=>{const k=b.product||'Unknown';if(!pm[k])pm[k]={o:0,t:0,b:0,s:0};pm[k].o+=Number(b.doneQty||0);pm[k].t+=Number(b.targetQty||0);pm[k].b+=1;pm[k].s+=Number(b.scrapQty||0);});
    Object.entries(pm).forEach(([k,d])=>rows.push([`"${k}"`,d.b,d.o,d.t,d.t>0?Math.round((d.o/d.t)*100):100,d.s,(d.o+d.s)>0?((d.s/(d.o+d.s))*100).toFixed(1):0]));
    FCT.downloadCSV(rows, `STRATIX_ProductionAnalytics_${FCT.today()}.csv`);
    NOTIFY.show('Analytics exported!','success');
  },

  exportBatchCSV() {
    const batches = STRATIX_DB.getArr('fct_batches');
    const rows = [['Batch No','Product','Target Qty','Done Qty','Scrap','Unit','Machine','Worker','Shift','Status','Date','End Date']];
    batches.forEach(b=>rows.push([`"${b.batchNo||''}"`,`"${b.product||''}"`,b.targetQty||0,b.doneQty||0,b.scrapQty||0,b.unit||'',`"${b.machine||''}"`,`"${b.worker||''}"`,`"${b.shift||''}"`,b.status||'',b.date||'',b.endDate||'']));
    FCT.downloadCSV(rows, `STRATIX_Batches_${FCT.today()}.csv`);
    NOTIFY.show('Batch data exported!','success');
  },

  /* ── WORKERS (from v_factory.js, enhanced) ── */
  _renderWorkers() {
    const workers = STRATIX_DB.getArr('fct_workers');
    const today   = FCT.today();
    const present = workers.filter(w=>w.todayStatus==='present').length;
    const sym     = FCT.sym();

    return `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
      <div class="kpi accent"><div class="kpi-lbl">Total Workers</div><div class="kpi-val">${workers.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Present Today</div><div class="kpi-val green">${present}</div></div>
      <div class="kpi"><div class="kpi-lbl">Absent Today</div><div class="kpi-val red">${workers.length-present}</div></div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Worker Register</span>
        <div style="display:flex;gap:8px">
          <button class="btn btn-gold btn-sm" onclick="PROD.markAllWorkersPresent()">✅ All Present</button>
          <button class="btn btn-ghost btn-sm" onclick="PROD.openAddWorker()">+ Add Worker</button>
        </div>
      </div>
      ${workers.length===0?`<div style="padding:32px;text-align:center;color:var(--muted)">No workers added yet. <button class="btn btn-ghost btn-sm" onclick="PROD.openAddWorker()">Add Worker</button></div>`:`
      <div class="tbl-scroll"><table>
        <thead><tr><th>Name</th><th>Role</th><th>Daily Wage</th><th>Phone</th><th>Today's Status</th><th>Actions</th></tr></thead>
        <tbody>
        ${workers.map(w=>`<tr id="wrow2-${w.id}">
          <td class="td-b">${escapeHTML(w.name)}</td>
          <td class="td-m">${escapeHTML(w.role||'—')}</td>
          <td>${sym}${Number(w.wage||0).toLocaleString('en-IN')}/day</td>
          <td class="td-m">${escapeHTML(w.phone||'—')}</td>
          <td>
            <div style="display:flex;gap:5px">
              ${['present','absent','half'].map(st=>`<button onclick="PROD.markWorker('${w.id}','${st}')" style="padding:4px 10px;border-radius:6px;border:1px solid ${w.todayStatus===st?'var(--gold)':'var(--b1)'};background:${w.todayStatus===st?'rgba(37,99,235,.15)':'transparent'};color:${w.todayStatus===st?'var(--gold)':'var(--muted)'};font-size:11px;cursor:pointer;font-weight:700;font-family:var(--font)">${st.charAt(0).toUpperCase()}</button>`).join('')}
            </div>
          </td>
          <td><button class="del-btn" onclick="PROD.deleteWorker('${w.id}')">🗑</button></td>
        </tr>`).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  },

  markWorker(id, status) {
    STRATIX_DB.update('fct_workers',id,{todayStatus:status});
    this._tab('workers');
  },

  markAllWorkersPresent() {
    STRATIX_DB.getArr('fct_workers').forEach(w=>STRATIX_DB.update('fct_workers',w.id,{todayStatus:'present'}));
    NOTIFY.show('All marked Present!','success');
    this._tab('workers');
  },

  openAddWorker() {
    document.getElementById('prodModal').innerHTML = FCT.modal('workerModal','👷 Add Worker',`
      <div class="form-grid">
        <div class="field"><label>Name *</label><input id="wk_name" placeholder="Ramesh Kumar"/></div>
        <div class="field"><label>Role</label><input id="wk_role" placeholder="Machine Operator / Welder / Helper"/></div>
        <div class="field"><label>Daily Wage (${FCT.sym()})</label><input type="number" id="wk_wage" placeholder="600"/></div>
        <div class="field"><label>Phone</label><input type="tel" id="wk_phone" placeholder="9876543210"/></div>
      </div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="PROD.saveWorker()">Save Worker</button>
    `);
  },

  saveWorker() {
    const name = document.getElementById('wk_name')?.value.trim();
    if (!name) { NOTIFY.show('Enter worker name','warning'); return; }
    STRATIX_DB.push('fct_workers',{name,role:document.getElementById('wk_role')?.value.trim()||'',wage:+document.getElementById('wk_wage')?.value||0,phone:document.getElementById('wk_phone')?.value.trim()||'',todayStatus:'present'});
    document.getElementById('workerModal')?.remove();
    NOTIFY.show('Worker added!','success');
    this._tab('workers');
  },

  deleteWorker(id) {
    if (!confirm('Remove this worker?')) return;
    STRATIX_DB.remove('fct_workers',id);
    this._tab('workers');
  },

  /* ── MACHINES ── */
  _renderMachines() {
    const machines = STRATIX_DB.getArr('fct_machines');
    const running  = machines.filter(m=>m.status==='running').length;
    const sym      = FCT.sym();

    return `
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
      <div class="kpi accent"><div class="kpi-lbl">Total Machines</div><div class="kpi-val">${machines.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Running</div><div class="kpi-val green">${running}</div></div>
      <div class="kpi"><div class="kpi-lbl">Idle</div><div class="kpi-val orange">${machines.filter(m=>m.status==='idle').length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Maintenance</div><div class="kpi-val red">${machines.filter(m=>m.status==='maintenance').length}</div></div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin-bottom:14px">
    ${machines.map(m=>`
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
          <div>
            <div style="font-size:14px;font-weight:800">${escapeHTML(m.name)}</div>
            <div style="font-size:11px;color:var(--muted)">${escapeHTML(m.type||'General')}</div>
          </div>
          ${FCT.statusBadge(m.status||'running')}
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:6px">Hours logged: <strong>${m.hours||0} hrs</strong></div>
        ${m.lastMaintenance?`<div style="font-size:11px;color:var(--muted)">Last service: ${FCT.dateStr(m.lastMaintenance)}</div>`:''}
        <div style="display:flex;gap:6px;margin-top:10px">
          ${['running','idle','maintenance'].map(st=>`<button onclick="PROD.setMachineStatus('${m.id}','${st}')" style="flex:1;padding:5px;border-radius:7px;border:1px solid ${m.status===st?'var(--gold)':'var(--b1)'};background:${m.status===st?'rgba(37,99,235,.12)':'transparent'};color:${m.status===st?'var(--gold)':'var(--muted)'};font-size:10px;cursor:pointer;font-family:var(--font);font-weight:600">${st.charAt(0).toUpperCase()+st.slice(1)}</button>`).join('')}
        </div>
        <button class="del-btn" style="margin-top:8px" onclick="PROD.deleteMachine('${m.id}')">🗑 Remove</button>
      </div>`).join('')}

    <!-- Add new machine card -->
    <div class="card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:160px;border:2px dashed var(--b1);cursor:pointer;background:transparent" onclick="PROD.openAddMachine()">
      <div style="font-size:32px">⚙️</div>
      <div style="font-size:13px;color:var(--muted);margin-top:8px">+ Add Machine</div>
    </div>
    </div>`;
  },

  setMachineStatus(id, status) {
    STRATIX_DB.update('fct_machines',id,{status});
    this._tab('machines');
  },

  openAddMachine() {
    document.getElementById('prodModal').innerHTML = FCT.modal('machineModal','⚙️ Add Machine',`
      <div class="form-grid">
        <div class="field"><label>Machine Name *</label><input id="mc_name" placeholder="CNC Lathe / Welding Machine / Drill Press"/></div>
        <div class="field"><label>Type / Model</label><input id="mc_type" placeholder="Model number or description"/></div>
        <div class="field"><label>Running Hours</label><input type="number" id="mc_hours" placeholder="0"/></div>
        <div class="field"><label>Last Maintenance Date</label><input type="date" id="mc_maint" value="${FCT.today()}"/></div>
      </div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="PROD.saveMachine()">Add Machine</button>
    `);
  },

  saveMachine() {
    const name = document.getElementById('mc_name')?.value.trim();
    if (!name) { NOTIFY.show('Enter machine name','warning'); return; }
    STRATIX_DB.push('fct_machines',{name,type:document.getElementById('mc_type')?.value.trim()||'',hours:+document.getElementById('mc_hours')?.value||0,lastMaintenance:document.getElementById('mc_maint')?.value||'',status:'running'});
    document.getElementById('machineModal')?.remove();
    NOTIFY.show('Machine added!','success');
    this._tab('machines');
  },

  deleteMachine(id) {
    if (!confirm('Remove this machine?')) return;
    STRATIX_DB.remove('fct_machines',id);
    this._tab('machines');
  }
};


/* ══════════════════════════════════════════════════════════════
   MODULE 3 — RAW MATERIAL DEEP
   ══════════════════════════════════════════════════════════════ */

function renderRawMaterialDeep(activeTab) {
  activeTab = activeTab || 'stock';
  const rawmats  = STRATIX_DB.getArr('fct_rawmats');
  const sym      = FCT.sym();

  const lowCount    = rawmats.filter(r=>FCT.stockLevel(r)==='low').length;
  const critCount   = rawmats.filter(r=>FCT.stockLevel(r)==='critical').length;
  const totalValue  = rawmats.reduce((s,r)=>s+Number(r.qty||0)*Number(r.costPerUnit||0),0);

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">🔩 Raw Material Management</h1>
        <p class="sec-sub">Stock register · GRN · Issue to production · Consumption analytics</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="RAWM.openAddMaterial()">+ Add Material</button>
        <button class="btn btn-outline" onclick="RAWM._tab('grn')">📦 Receive GRN</button>
        <button class="btn btn-ghost btn-sm" onclick="RAWM.exportStockCSV()">📥 Export</button>
      </div>
    </div>

    ${critCount > 0 ? `
    <div class="alert a-red" style="margin-bottom:16px">
      <span class="alert-ico">🚨</span>
      <div><strong>${critCount} material${critCount>1?'s':''} completely out of stock!</strong> Production may stop. Raise purchase orders immediately.</div>
    </div>` : ''}

    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:18px">
      <div class="kpi accent"><div class="kpi-lbl">Total Materials</div><div class="kpi-val">${rawmats.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Stock Value</div><div class="kpi-val">${FCT.fmt(totalValue)}</div></div>
      <div class="kpi"><div class="kpi-lbl">OK / Excess</div><div class="kpi-val green">${rawmats.filter(r=>['ok','excess'].includes(FCT.stockLevel(r))).length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Low Stock</div><div class="kpi-val orange">${lowCount}</div></div>
      <div class="kpi"><div class="kpi-lbl">Critical / Out</div><div class="kpi-val red">${critCount}</div></div>
    </div>

    <div class="calc-tabs" style="margin-bottom:16px">
      <button class="calc-tab${activeTab==='stock'?' active':''}" data-rawmtab="stock" onclick="RAWM._tab('stock')">📋 Stock Register</button>
      <button class="calc-tab${activeTab==='grn'?' active':''}" data-rawmtab="grn" onclick="RAWM._tab('grn')">📦 GRN (Receive)</button>
      <button class="calc-tab${activeTab==='issue'?' active':''}" data-rawmtab="issue" onclick="RAWM._tab('issue')">🏭 Issue to Production</button>
      <button class="calc-tab${activeTab==='analytics'?' active':''}" data-rawmtab="analytics" onclick="RAWM._tab('analytics')">📊 Consumption Analytics</button>
    </div>

    <div id="rawmTabContent">${RAWM._renderTab(activeTab)}</div>
    <div id="rawmModal"></div>
  </div>`;
}

const RAWM = {
  _tab(tab) {
    document.querySelectorAll('[data-rawmtab]').forEach(b=>b.classList.toggle('active',b.dataset.rawmtab===tab));
    const el = document.getElementById('rawmTabContent');
    if (el) el.innerHTML = this._renderTab(tab);
  },

  _renderTab(tab) {
    if (tab==='stock')     return this._renderStock();
    if (tab==='grn')       return this._renderGRN();
    if (tab==='issue')     return this._renderIssue();
    if (tab==='analytics') return this._renderAnalytics();
    return '';
  },

  /* ── STOCK REGISTER ── */
  _renderStock() {
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const sym     = FCT.sym();
    const sorted  = [...rawmats].sort((a,b)=>{
      const order={critical:0,low:1,ok:2,excess:3};
      return (order[FCT.stockLevel(a)]||2)-(order[FCT.stockLevel(b)]||2);
    });

    return `
    <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap">
      ${['all','critical','low','ok','excess'].map(f=>`
        <button onclick="RAWM._filterStock('${f}')" style="padding:5px 14px;border-radius:20px;border:1px solid var(--b1);background:transparent;color:var(--txt);font-size:12px;cursor:pointer;font-family:var(--font)">${f==='all'?'All':f.charAt(0).toUpperCase()+f.slice(1)} (${f==='all'?rawmats.length:rawmats.filter(r=>FCT.stockLevel(r)===f).length})</button>`).join('')}
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Raw Material Register (${rawmats.length})</span>
        <div style="display:flex;gap:8px">
          <input placeholder="🔍 Search..." oninput="RAWM._searchStock(this.value)" style="width:180px;padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt);outline:none"/>
          <button class="btn btn-gold btn-sm" onclick="RAWM.openAddMaterial()">+ Add</button>
        </div>
      </div>
      <div id="stockTable">
        ${this._renderStockRows(sorted, sym)}
      </div>
    </div>`;
  },

  _renderStockRows(rawmats, sym) {
    if (rawmats.length===0) return `<div style="padding:32px;text-align:center;color:var(--muted)">No materials added. Click "+ Add" to start.</div>`;
    return `<div class="tbl-scroll"><table>
      <thead><tr><th>Material</th><th>Category</th><th>In Stock</th><th>Min Level</th><th>Max Cap.</th><th>Unit</th><th>Cost/Unit</th><th>Stock Value</th><th>Lead Days</th><th>Supplier</th><th>Level</th><th>Actions</th></tr></thead>
      <tbody>
      ${rawmats.map(r=>{
        const level   = FCT.stockLevel(r);
        const value   = Number(r.qty||0)*Number(r.costPerUnit||0);
        const pct     = r.maxQty ? Math.min(100,Math.round((Number(r.qty||0)/Number(r.maxQty))*100)) : 50;
        return `<tr>
          <td>
            <div class="td-b">${escapeHTML(r.name)}</div>
            <div style="display:flex;align-items:center;gap:4px;margin-top:3px">
              <div class="prog" style="width:60px;height:4px"><div style="width:${pct}%;height:100%;background:${FCT.stockLevelColor(level)};border-radius:2px"></div></div>
              <span style="font-size:10px;color:var(--muted)">${pct}%</span>
            </div>
          </td>
          <td class="td-m">${escapeHTML(r.category||'—')}</td>
          <td style="font-weight:800;color:${FCT.stockLevelColor(level)};font-size:15px">${r.qty||0}</td>
          <td class="td-m">${r.minQty||0}</td>
          <td class="td-m">${r.maxQty||'—'}</td>
          <td class="td-m">${escapeHTML(r.unit||'units')}</td>
          <td>${r.costPerUnit?`${sym}${FCT.fmtN(r.costPerUnit)}`:'—'}</td>
          <td style="font-weight:700;color:var(--gold)">${value>0?FCT.fmt(value):'—'}</td>
          <td class="td-m">${r.leadDays||'—'} ${r.leadDays?'days':''}</td>
          <td class="td-m">${escapeHTML(r.supplier||'—')}</td>
          <td>${FCT.badge(level.charAt(0).toUpperCase()+level.slice(1),{critical:'br',low:'bo',ok:'bg',excess:'bb'}[level]||'bm')}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="RAWM.openEditMaterial('${r.id}')">✏️</button>
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="RAWM.openAdjust('${r.id}')">±</button>
              <button class="del-btn" onclick="RAWM.deleteMaterial('${r.id}')">🗑</button>
            </div>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
  },

  _filterStock(level) {
    const all      = STRATIX_DB.getArr('fct_rawmats');
    const filtered = level==='all' ? all : all.filter(r=>FCT.stockLevel(r)===level);
    const el       = document.getElementById('stockTable');
    if (el) el.innerHTML = this._renderStockRows(filtered, FCT.sym());
  },

  _searchStock(q) {
    const all      = STRATIX_DB.getArr('fct_rawmats');
    const filtered = q ? all.filter(r=>r.name.toLowerCase().includes(q.toLowerCase())||(r.supplier||'').toLowerCase().includes(q.toLowerCase())) : all;
    const el       = document.getElementById('stockTable');
    if (el) el.innerHTML = this._renderStockRows(filtered, FCT.sym());
  },

  openAddMaterial(id) {
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const e       = id ? (rawmats.find(x=>x.id===id)||{}) : {};

    document.getElementById('rawmModal').innerHTML = FCT.modal('matModal', id?'✏️ Edit Material':'🔩 Add Raw Material', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Material Name *</label><input id="rm_name" value="${escapeHTML(e.name||'')}" placeholder="Steel Rods 12mm / Cotton Yarn / PVC Granules"/></div>
        <div class="field"><label>Category</label>
          <select id="rm_cat">
            ${['Metal','Plastic','Chemical','Textile','Wood','Electrical','Packing','Other'].map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Unit</label>
          <select id="rm_unit">
            ${['kg','ton','litre','metre','feet','pcs','bag','roll','drum','box'].map(u=>`<option ${e.unit===u?'selected':''}>${u}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Current Stock *</label><input type="number" id="rm_qty" value="${e.qty||''}" placeholder="100"/></div>
        <div class="field"><label>Min Stock Alert</label><input type="number" id="rm_min" value="${e.minQty||''}" placeholder="20"/></div>
        <div class="field"><label>Max Capacity</label><input type="number" id="rm_max" value="${e.maxQty||''}" placeholder="500"/></div>
        <div class="field"><label>Cost Per Unit (${FCT.sym()})</label><input type="number" id="rm_cost" value="${e.costPerUnit||''}" placeholder="45.50"/></div>
        <div class="field"><label>Lead Time (days)</label><input type="number" id="rm_lead" value="${e.leadDays||''}" placeholder="7"/></div>
        <div class="field"><label>Supplier Name</label><input id="rm_supplier" value="${escapeHTML(e.supplier||'')}" placeholder="Supplier / vendor name"/></div>
        <div class="field"><label>Supplier Phone</label><input type="tel" id="rm_suppphone" value="${escapeHTML(e.supplierPhone||'')}" placeholder="9876543210"/></div>
        <div class="field"><label>Location / Rack</label><input id="rm_loc" value="${escapeHTML(e.location||'')}" placeholder="Warehouse A / Rack 3B"/></div>
        <div class="field"><label>HSN Code</label><input id="rm_hsn" value="${escapeHTML(e.hsn||'')}" placeholder="7214 / 3004"/></div>
      </div>
      <div class="field" style="margin-top:10px"><label>Notes</label><input id="rm_notes" value="${escapeHTML(e.notes||'')}" placeholder="Any special storage or handling instructions"/></div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="RAWM.saveMaterial('${id||''}')">💾 ${id?'Update':'Save'} Material</button>
    `, true);
  },

  openEditMaterial(id) { this.openAddMaterial(id); },

  saveMaterial(id) {
    const name = document.getElementById('rm_name')?.value.trim();
    if (!name) { NOTIFY.show('Enter material name','warning'); return; }
    const data = {
      name,
      category:     document.getElementById('rm_cat')?.value||'Other',
      unit:         document.getElementById('rm_unit')?.value||'kg',
      qty:          +document.getElementById('rm_qty')?.value||0,
      minQty:       +document.getElementById('rm_min')?.value||0,
      maxQty:       +document.getElementById('rm_max')?.value||0,
      costPerUnit:  +document.getElementById('rm_cost')?.value||0,
      leadDays:     +document.getElementById('rm_lead')?.value||0,
      supplier:     document.getElementById('rm_supplier')?.value.trim()||'',
      supplierPhone:document.getElementById('rm_suppphone')?.value.trim()||'',
      location:     document.getElementById('rm_loc')?.value.trim()||'',
      hsn:          document.getElementById('rm_hsn')?.value.trim()||'',
      notes:        document.getElementById('rm_notes')?.value.trim()||''
    };
    if (id) { STRATIX_DB.update('fct_rawmats',id,data); NOTIFY.show('Material updated!','success'); }
    else    { STRATIX_DB.push('fct_rawmats',data);       NOTIFY.show('Material added!','success'); }
    document.getElementById('matModal')?.remove();
    renderRawMaterialDeep('stock');
  },

  deleteMaterial(id) {
    if (!confirm('Delete this material?')) return;
    STRATIX_DB.remove('fct_rawmats',id);
    NOTIFY.show('Removed','info',1500);
    this._tab('stock');
  },

  openAdjust(id) {
    const m = STRATIX_DB.getArr('fct_rawmats').find(r=>r.id===id);
    if (!m) return;
    document.getElementById('rawmModal').innerHTML = FCT.modal('adjModal',`± Adjust — ${m.name}`,`
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:11px;color:var(--muted)">Current Stock</div>
        <div style="font-size:28px;font-weight:800;color:${FCT.stockLevelColor(FCT.stockLevel(m))}">${m.qty||0} ${m.unit||''}</div>
      </div>
      <div class="field"><label>Adjustment Type</label>
        <select id="adj_type">
          <option value="add">Add Stock (+)</option>
          <option value="remove">Remove Stock (-)</option>
          <option value="set">Set Exact Quantity</option>
        </select>
      </div>
      <div class="field"><label>Quantity</label><input type="number" id="adj_qty" placeholder="50"/></div>
      <div class="field"><label>Reason</label><input id="adj_reason" placeholder="Physical count / Damage / Theft / Receipt without GRN"/></div>
      <button class="btn btn-gold btn-full" style="margin-top:12px" onclick="RAWM.saveAdjust('${id}')">Apply Adjustment</button>
    `);
  },

  saveAdjust(id) {
    const type   = document.getElementById('adj_type')?.value||'add';
    const qty    = +document.getElementById('adj_qty')?.value||0;
    const reason = document.getElementById('adj_reason')?.value.trim()||'';
    if (!qty)    { NOTIFY.show('Enter quantity','warning'); return; }
    const mat    = STRATIX_DB.getArr('fct_rawmats').find(r=>r.id===id);
    if (!mat)    return;
    let newQty   = Number(mat.qty||0);
    if (type==='add')    newQty += qty;
    else if (type==='remove') newQty = Math.max(0, newQty-qty);
    else newQty  = qty;
    STRATIX_DB.update('fct_rawmats',id,{qty:newQty});
    STRATIX_DB.push('fct_stocklog',{materialId:id,materialName:mat.name,type,qty,balAfter:newQty,ref:reason||'Manual adjustment',date:FCT.today()});
    document.getElementById('adjModal')?.remove();
    NOTIFY.show(`Stock adjusted: ${mat.name} → ${newQty} ${mat.unit||''}`, 'success');
    this._tab('stock');
  },

  exportStockCSV() {
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const sym     = FCT.sym();
    const rows    = [['Material','Category','Unit','Current Stock','Min Level','Max Capacity','Cost Per Unit','Stock Value','Lead Days','Supplier','Level']];
    rawmats.forEach(r=>rows.push([`"${r.name}"`,r.category||'',r.unit||'',r.qty||0,r.minQty||0,r.maxQty||'',r.costPerUnit||0,(Number(r.qty||0)*Number(r.costPerUnit||0)).toFixed(2),r.leadDays||'',`"${r.supplier||''}"`,FCT.stockLevel(r)]));
    FCT.downloadCSV(rows, `STRATIX_RawMaterials_${FCT.today()}.csv`);
    NOTIFY.show('Stock register exported!','success');
  },

  /* ── GRN (GOODS RECEIPT NOTE) ── */
  _renderGRN() {
    const grns    = STRATIX_DB.getArr('fct_grn');
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const sym     = FCT.sym();
    const sorted  = [...grns].sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));

    const totalGRNValue = grns.reduce((s,g)=>{
      return s + (g.items||[]).reduce((is,item)=>is+Number(item.qty||0)*Number(item.costPerUnit||0),0);
    },0);

    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">📦 New Goods Receipt Note (GRN)</div>
      <div class="form-grid">
        <div class="field"><label>GRN No. *</label><input id="grn_no" value="GRN-${String(grns.length+1).padStart(4,'0')}" placeholder="GRN-0001"/></div>
        <div class="field"><label>Supplier Name *</label><input id="grn_supplier" placeholder="Supplier company name"/></div>
        <div class="field"><label>Date</label><input type="date" id="grn_date" value="${FCT.today()}"/></div>
        <div class="field"><label>Supplier Invoice No.</label><input id="grn_invoice" placeholder="Supplier's invoice number"/></div>
        <div class="field"><label>Vehicle / Challan No.</label><input id="grn_challan" placeholder="Delivery challan number"/></div>
        <div class="field"><label>Quality Status</label>
          <select id="grn_qstatus">
            <option value="accepted">Accepted ✅</option>
            <option value="partial">Partial Accept ⚠️</option>
            <option value="rejected">Rejected ❌</option>
          </select>
        </div>
      </div>

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:12px 0 8px">Materials Received</div>
      <div id="grn_items">
        <div class="grn-row" style="display:grid;grid-template-columns:1fr 80px 80px 90px 32px;gap:8px;margin-bottom:8px;align-items:center">
          <select style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none" onchange="RAWM._onGRNMatChange(this)">
            <option value="">— Select Material —</option>
            ${rawmats.map(m=>`<option value="${m.id}">${escapeHTML(m.name)} (${m.qty||0} ${m.unit||''})</option>`).join('')}
          </select>
          <input type="number" placeholder="Qty" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
          <input placeholder="Unit" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
          <input type="number" placeholder="Cost/Unit" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
          <button onclick="this.closest('.grn-row').remove()" style="background:var(--rdim);border:none;border-radius:8px;color:var(--red);cursor:pointer;padding:7px;font-size:14px">×</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-ghost btn-sm" onclick="RAWM._addGRNRow()">＋ Add Row</button>
        <button class="btn btn-gold" onclick="RAWM.saveGRN()">💾 Save GRN & Update Stock</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">GRN History (${grns.length})</span>
        <div style="font-size:12px;color:var(--muted)">Total Received: ${FCT.fmt(totalGRNValue)}</div>
      </div>
      ${sorted.length===0?`<div style="padding:24px;text-align:center;color:var(--muted)">No GRNs yet.</div>`:`
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>GRN No.</th><th>Supplier</th><th>Invoice No.</th><th>Items</th><th>Total Value</th><th>Quality</th><th></th></tr></thead>
        <tbody>
        ${sorted.map(g=>{
          const val = (g.items||[]).reduce((s,i)=>s+Number(i.qty||0)*Number(i.costPerUnit||0),0);
          return `<tr>
            <td class="td-m">${FCT.dateStr(g.date)}</td>
            <td class="td-b" style="font-family:monospace">${escapeHTML(g.grnNo||'—')}</td>
            <td class="td-b">${escapeHTML(g.supplierName||'—')}</td>
            <td class="td-m">${escapeHTML(g.invoiceNo||'—')}</td>
            <td>${(g.items||[]).length} material${(g.items||[]).length!==1?'s':''}</td>
            <td style="font-weight:700;color:var(--gold)">${FCT.fmt(val)}</td>
            <td>${FCT.badge(g.qStatus||'accepted',g.qStatus==='accepted'?'bg':g.qStatus==='partial'?'bo':'br')}</td>
            <td><button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="RAWM.viewGRN('${g.id}')">View</button></td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  },

  _addGRNRow() {
    const rawmats   = STRATIX_DB.getArr('fct_rawmats');
    const container = document.getElementById('grn_items');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'grn-row';
    div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 80px 90px 32px;gap:8px;margin-bottom:8px;align-items:center';
    div.innerHTML = `
      <select style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none" onchange="RAWM._onGRNMatChange(this)">
        <option value="">— Select Material —</option>
        ${rawmats.map(m=>`<option value="${m.id}">${escapeHTML(m.name)} (${m.qty||0} ${m.unit||''})</option>`).join('')}
      </select>
      <input type="number" placeholder="Qty" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
      <input placeholder="Unit" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
      <input type="number" placeholder="Cost/Unit" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
      <button onclick="this.closest('.grn-row').remove()" style="background:var(--rdim);border:none;border-radius:8px;color:var(--red);cursor:pointer;padding:7px;font-size:14px">×</button>`;
    container.appendChild(div);
  },

  _onGRNMatChange(sel) {
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const mat     = rawmats.find(m=>m.id===sel.value);
    if (!mat) return;
    const row     = sel.closest('.grn-row');
    const inps    = row?.querySelectorAll('input');
    if (inps?.[1] && !inps[1].value) inps[1].value = mat.unit||'';
    if (inps?.[2] && !inps[2].value && mat.costPerUnit) inps[2].value = mat.costPerUnit;
  },

  saveGRN() {
    const grnNo       = document.getElementById('grn_no')?.value.trim();
    const supplierName= document.getElementById('grn_supplier')?.value.trim();
    if (!grnNo)        { NOTIFY.show('Enter GRN number','warning'); return; }
    if (!supplierName) { NOTIFY.show('Enter supplier name','warning'); return; }

    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const rows    = document.querySelectorAll('#grn_items .grn-row');
    const items   = [];
    let   totalVal= 0;

    rows.forEach(row=>{
      const sel   = row.querySelector('select');
      const inps  = row.querySelectorAll('input');
      const matId = sel?.value;
      const qty   = +inps[0]?.value||0;
      const unit  = inps[1]?.value.trim()||'';
      const cost  = +inps[2]?.value||0;
      if (matId && qty>0) {
        const mat = rawmats.find(m=>m.id===matId);
        items.push({ materialId:matId, materialName:mat?.name||'', qty, unit, costPerUnit:cost });
        totalVal += qty*cost;
        // Update stock
        const newQty = Number(mat?.qty||0)+qty;
        STRATIX_DB.update('fct_rawmats', matId, { qty:newQty, costPerUnit: cost||mat?.costPerUnit||0 });
        STRATIX_DB.push('fct_stocklog',{materialId:matId,materialName:mat?.name||'',type:'grn',qty,balAfter:newQty,ref:`GRN ${grnNo}`,date:FCT.today()});
      }
    });

    if (items.length===0) { NOTIFY.show('Add at least one material row','warning'); return; }

    STRATIX_DB.push('fct_grn',{
      grnNo, supplierName,
      date:     document.getElementById('grn_date')?.value||FCT.today(),
      invoiceNo:document.getElementById('grn_invoice')?.value.trim()||'',
      challanNo:document.getElementById('grn_challan')?.value.trim()||'',
      qStatus:  document.getElementById('grn_qstatus')?.value||'accepted',
      items
    });

    // Log as purchase expense
    if (totalVal>0) STRATIX_DB.push('transactions',{type:'expense',amount:totalVal,category:'raw material',description:`GRN ${grnNo} — ${supplierName}`,date:FCT.today()});

    NOTIFY.show(`GRN saved! ${items.length} material${items.length!==1?'s':''} added to stock · ${FCT.fmt(totalVal)}`, 'success', 5000);
    this._tab('grn');
  },

  viewGRN(id) {
    const grns    = STRATIX_DB.getArr('fct_grn');
    const g       = grns.find(x=>x.id===id);
    if (!g) return;
    const sym     = FCT.sym();
    const val     = (g.items||[]).reduce((s,i)=>s+Number(i.qty||0)*Number(i.costPerUnit||0),0);
    document.getElementById('rawmModal').innerHTML = FCT.modal('grnViewModal',`📦 GRN ${g.grnNo||''}`,`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
        <div class="field"><label>Supplier</label><div style="font-weight:700">${escapeHTML(g.supplierName||'—')}</div></div>
        <div class="field"><label>Date</label><div>${FCT.dateStr(g.date)}</div></div>
        <div class="field"><label>Invoice No.</label><div>${escapeHTML(g.invoiceNo||'—')}</div></div>
        <div class="field"><label>Quality</label><div>${FCT.badge(g.qStatus||'accepted',g.qStatus==='accepted'?'bg':g.qStatus==='partial'?'bo':'br')}</div></div>
      </div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Material</th><th>Qty</th><th>Unit</th><th>Cost/Unit</th><th>Total</th></tr></thead>
        <tbody>
        ${(g.items||[]).map(i=>`<tr>
          <td class="td-b">${escapeHTML(i.materialName||'—')}</td>
          <td>${i.qty||0}</td>
          <td>${i.unit||''}</td>
          <td>${sym}${FCT.fmtN(i.costPerUnit||0)}</td>
          <td style="font-weight:700">${FCT.fmt(Number(i.qty||0)*Number(i.costPerUnit||0))}</td>
        </tr>`).join('')}
        <tr style="background:var(--s2);font-weight:700">
          <td colspan="4">Total GRN Value</td>
          <td style="color:var(--gold)">${FCT.fmt(val)}</td>
        </tr>
        </tbody>
      </table></div>
    `, true);
  },

  /* ── ISSUE TO PRODUCTION ── */
  _renderIssue() {
    const issues  = STRATIX_DB.getArr('fct_issue');
    const rawmats = STRATIX_DB.getArr('fct_rawmats');
    const batches = STRATIX_DB.getArr('fct_batches').filter(b=>b.status!=='completed');
    const sym     = FCT.sym();
    const sorted  = [...issues].sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));

    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">🏭 Issue Materials to Production</div>
      <div class="form-grid">
        <div class="field"><label>Issue Ref No.</label><input id="iss_ref" value="ISS-${String(issues.length+1).padStart(4,'0')}" placeholder="ISS-0001"/></div>
        <div class="field"><label>Date</label><input type="date" id="iss_date" value="${FCT.today()}"/></div>
        <div class="field"><label>Batch / Job</label>
          <select id="iss_batch">
            <option value="">— Select Batch (Optional) —</option>
            ${batches.map(b=>`<option value="${b.id}">${escapeHTML(b.batchNo||b.id)} — ${escapeHTML(b.product||'')}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Issued To (Dept/Worker)</label><input id="iss_to" placeholder="Production / Machine Shop / Worker name"/></div>
      </div>
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:12px 0 8px">Materials to Issue</div>
      <div id="iss_items">
        <div class="iss-row" style="display:grid;grid-template-columns:1fr 80px 80px 32px;gap:8px;margin-bottom:8px;align-items:center">
          <select style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none">
            <option value="">— Select Material —</option>
            ${rawmats.map(m=>`<option value="${m.id}">${escapeHTML(m.name)} (Stock: ${m.qty||0} ${m.unit||''})</option>`).join('')}
          </select>
          <input type="number" placeholder="Qty" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
          <input placeholder="Unit" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
          <button onclick="this.closest('.iss-row').remove()" style="background:var(--rdim);border:none;border-radius:8px;color:var(--red);cursor:pointer;padding:7px;font-size:14px">×</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-ghost btn-sm" onclick="RAWM._addIssueRow()">＋ Add Row</button>
        <button class="btn btn-gold" onclick="RAWM.saveIssue()">💾 Issue & Deduct Stock</button>
      </div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Issue Register (${issues.length})</span></div>
      ${sorted.length===0?`<div style="padding:24px;text-align:center;color:var(--muted)">No issues recorded yet.</div>`:`
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Ref No.</th><th>Batch</th><th>Issued To</th><th>Materials</th></tr></thead>
        <tbody>
        ${sorted.map(iss=>{
          const batch=batches.find(b=>b.id===iss.batchId);
          return `<tr>
            <td class="td-m">${FCT.dateStr(iss.date)}</td>
            <td class="td-m" style="font-family:monospace">${escapeHTML(iss.refNo||'—')}</td>
            <td class="td-b">${escapeHTML(batch?.batchNo||iss.batchId||'—')}</td>
            <td class="td-m">${escapeHTML(iss.issuedTo||'—')}</td>
            <td class="td-m">${(iss.items||[]).map(i=>`${escapeHTML(i.materialName||'—')} ×${i.qty}`).join(', ')}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  },

  _addIssueRow() {
    const rawmats   = STRATIX_DB.getArr('fct_rawmats');
    const container = document.getElementById('iss_items');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'iss-row';
    div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 80px 32px;gap:8px;margin-bottom:8px;align-items:center';
    div.innerHTML = `
      <select style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none">
        <option value="">— Select Material —</option>
        ${rawmats.map(m=>`<option value="${m.id}">${escapeHTML(m.name)} (Stock: ${m.qty||0} ${m.unit||''})</option>`).join('')}
      </select>
      <input type="number" placeholder="Qty" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
      <input placeholder="Unit" style="background:var(--s2);border:1px solid var(--b1);border-radius:8px;padding:7px 10px;color:var(--txt);font-family:var(--font);font-size:12px;outline:none"/>
      <button onclick="this.closest('.iss-row').remove()" style="background:var(--rdim);border:none;border-radius:8px;color:var(--red);cursor:pointer;padding:7px;font-size:14px">×</button>`;
    container.appendChild(div);
  },

  saveIssue() {
    const refNo    = document.getElementById('iss_ref')?.value.trim()||'';
    const batchId  = document.getElementById('iss_batch')?.value||'';
    const issuedTo = document.getElementById('iss_to')?.value.trim()||'';
    const rawmats  = STRATIX_DB.getArr('fct_rawmats');
    const rows     = document.querySelectorAll('#iss_items .iss-row');
    const items    = [];

    rows.forEach(row=>{
      const sel   = row.querySelector('select');
      const inps  = row.querySelectorAll('input');
      const matId = sel?.value;
      const qty   = +inps[0]?.value||0;
      const unit  = inps[1]?.value.trim()||'';
      if (matId && qty>0) {
        const mat    = rawmats.find(m=>m.id===matId);
        const newQty = Math.max(0, Number(mat?.qty||0)-qty);
        STRATIX_DB.update('fct_rawmats', matId, { qty:newQty });
        STRATIX_DB.push('fct_stocklog',{materialId:matId,materialName:mat?.name||'',type:'issue',qty,balAfter:newQty,ref:refNo||batchId||'Manual Issue',date:FCT.today()});
        items.push({ materialId:matId, materialName:mat?.name||'', qty, unit:unit||mat?.unit||'' });
      }
    });

    if (items.length===0) { NOTIFY.show('Add at least one material row','warning'); return; }

    STRATIX_DB.push('fct_issue',{
      refNo, batchId, issuedTo,
      date: document.getElementById('iss_date')?.value||FCT.today(),
      items
    });

    NOTIFY.show(`${items.length} material${items.length!==1?'s':''} issued & stock deducted!`,'success',4000);
    this._tab('issue');
  },

  /* ── CONSUMPTION ANALYTICS ── */
  _renderAnalytics() {
    const stockLog = STRATIX_DB.getArr('fct_stocklog');
    const rawmats  = STRATIX_DB.getArr('fct_rawmats');
    const months   = FCT.last6Months();
    const sym      = FCT.sym();

    // Monthly consumption
    months.forEach(m=>{
      const mLog    = stockLog.filter(l=>l.type==='issue'&&(l.date||'').startsWith(m.key));
      m.consumed    = mLog.reduce((s,l)=>s+Number(l.qty||0),0);
      m.receipts    = stockLog.filter(l=>l.type==='grn'&&(l.date||'').startsWith(m.key)).reduce((s,l)=>s+Number(l.qty||0),0);
    });
    const maxBar    = Math.max(...months.map(m=>Math.max(m.consumed,m.receipts)),1);

    // Per-material consumption
    const matConsMap = {};
    stockLog.filter(l=>l.type==='issue').forEach(l=>{
      const k = l.materialId||l.materialName||'Unknown';
      if (!matConsMap[k]) matConsMap[k]={ name:l.materialName||k, consumed:0 };
      matConsMap[k].consumed += Number(l.qty||0);
    });
    const topConsumed = Object.values(matConsMap).sort((a,b)=>b.consumed-a.consumed).slice(0,6);

    // Reorder schedule
    const reorderList = rawmats.filter(r=>FCT.stockLevel(r)!=='ok'&&FCT.stockLevel(r)!=='excess')
      .map(r=>{
        const consumed  = stockLog.filter(l=>l.type==='issue'&&l.materialId===r.id).reduce((s,l)=>s+Number(l.qty||0),0);
        const dailyRate = consumed > 0 ? consumed/180 : 0; // 6M avg
        const daysLeft  = dailyRate > 0 ? Math.round(Number(r.qty||0)/dailyRate) : 999;
        return { ...r, dailyRate, daysLeft };
      }).sort((a,b)=>a.daysLeft-b.daysLeft);

    return `
    <div class="charts-row" style="margin-bottom:18px">
      <div class="chart-card">
        <div class="chart-hd"><h3>📊 Consumption vs Receipts — Last 6 Months</h3></div>
        <div class="bar-chart">
          ${months.map(m=>`
          <div class="bar-grp">
            <div class="bars">
              <div class="bar exp" style="height:${Math.round((m.consumed/maxBar)*120)}px" title="Consumed: ${m.consumed}"></div>
              <div class="bar rev" style="height:${Math.round((m.receipts/maxBar)*120)}px" title="Received: ${m.receipts}"></div>
            </div>
            <div class="bar-lbl">${m.label}</div>
          </div>`).join('')}
        </div>
        <div class="chart-legend"><div class="leg exp">Consumed</div><div class="leg rev">Received (GRN)</div></div>
      </div>

      <div class="chart-card">
        <div class="chart-hd"><h3>🔩 Top Consumed Materials</h3></div>
        ${topConsumed.length===0?`<div style="color:var(--muted);font-size:13px;padding:20px;text-align:center">Issue materials to production to see consumption.</div>`:
          topConsumed.map(m=>{
            const pct = topConsumed[0].consumed>0?Math.round((m.consumed/topConsumed[0].consumed)*100):0;
            return `<div style="margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;margin-bottom:3px">
                <span style="font-size:12px;font-weight:600">${escapeHTML(m.name)}</span>
                <span style="font-size:11px;color:var(--muted)">${m.consumed.toLocaleString('en-IN')} consumed</span>
              </div>
              <div class="prog"><div class="prog-fill po" style="width:${pct}%"></div></div>
            </div>`;
          }).join('')}
      </div>
    </div>

    <!-- Reorder schedule -->
    ${reorderList.length > 0 ? `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">⏰ Reorder Schedule — Materials Needing Attention</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Material</th><th>Current Stock</th><th>Min Level</th><th>Daily Usage Rate</th><th>Days Stock Left</th><th>Supplier</th><th>Lead Time</th><th>Order By</th></tr></thead>
        <tbody>
        ${reorderList.map(r=>{
          const orderBy = r.daysLeft < 999 ? new Date(Date.now()+(r.daysLeft-(r.leadDays||7))*86400000).toLocaleDateString('en-IN') : 'Now';
          return `<tr>
            <td class="td-b">${escapeHTML(r.name)}</td>
            <td style="font-weight:700;color:${FCT.stockLevelColor(FCT.stockLevel(r))}">${r.qty||0} ${r.unit||''}</td>
            <td class="td-m">${r.minQty||0}</td>
            <td class="td-m">${r.dailyRate>0?r.dailyRate.toFixed(1)+'/day':'Not tracked'}</td>
            <td style="font-weight:700;color:${r.daysLeft<7?'var(--red)':r.daysLeft<14?'var(--orange)':'var(--green)'}">${r.daysLeft<999?r.daysLeft+' days':'—'}</td>
            <td class="td-m">${escapeHTML(r.supplier||'—')}</td>
            <td class="td-m">${r.leadDays||'—'} ${r.leadDays?'days':''}</td>
            <td style="font-weight:700;color:var(--red)">${orderBy}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>` : `<div class="card" style="text-align:center;padding:24px;color:var(--green)">✅ All materials are adequately stocked.</div>`}`;
  }
};


/* ══════════════════════════════════════════════════════════════
   MODULE 4 — ERP DEEP EXTENSION
   Adds COGS + gross margin to existing ERP
   ══════════════════════════════════════════════════════════════ */

function renderERPDeep() {
  // Extend existing renderERP with a COGS / Margin tab
  // First render the existing ERP
  if (typeof renderERP === 'function') renderERP();

  // Then inject extra COGS tab into the tab bar
  setTimeout(()=>{
    const tabBar = document.querySelector('[id^="erp_tab_"]')?.parentElement;
    if (tabBar && !document.getElementById('erp_tab_cogs')) {
      const btn = document.createElement('button');
      btn.className = 'ctab';
      btn.id        = 'erp_tab_cogs';
      btn.textContent = '📉 COGS & Margin';
      btn.onclick   = () => {
        document.querySelectorAll('[id^="erp_tab_"]').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('erp_content').innerHTML = renderCOGS();
      };
      tabBar.appendChild(btn);
    }
  }, 100);
}

function renderCOGS() {
  const batches   = STRATIX_DB.getArr('fct_batches').filter(b=>b.status==='completed');
  const salesOrds = STRATIX_DB.getArr('erpSalesOrders');
  const inventory = STRATIX_DB.getArr('erpInventory');
  const sym       = STRATIX_DB.getSettings().currencySymbol||'₹';

  // Build product-level P&L
  const productPL = {};
  batches.forEach(b=>{
    const k = b.product||'Unknown';
    if (!productPL[k]) productPL[k]={ product:k, produced:0, batchCostTotal:0, revenue:0, sold:0 };
    const cost = FCT.batchCost(b);
    productPL[k].produced       += Number(b.doneQty||0);
    productPL[k].batchCostTotal += cost.total;
  });

  // Match sales orders to products
  salesOrds.filter(o=>o.status==='Completed').forEach(o=>{
    const k = o.product||o.items?.[0]?.name||'Unknown';
    if (productPL[k]) {
      productPL[k].revenue += Number(o.totalAmt||0);
      productPL[k].sold    += Number(o.qty||o.items?.[0]?.qty||0);
    }
  });

  const rows = Object.values(productPL);
  const totalRevenue = rows.reduce((s,r)=>s+r.revenue,0);
  const totalCOGS    = rows.reduce((s,r)=>s+r.batchCostTotal,0);
  const totalGP      = totalRevenue - totalCOGS;
  const gpPct        = totalRevenue>0 ? ((totalGP/totalRevenue)*100).toFixed(1) : 0;

  return `
  <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
    <div class="kpi accent"><div class="kpi-lbl">Total Revenue</div><div class="kpi-val">${sym}${Math.round(totalRevenue).toLocaleString('en-IN')}</div></div>
    <div class="kpi"><div class="kpi-lbl">COGS</div><div class="kpi-val red">${sym}${Math.round(totalCOGS).toLocaleString('en-IN')}</div></div>
    <div class="kpi"><div class="kpi-lbl">Gross Profit</div><div class="kpi-val ${totalGP>=0?'green':'red'}">${sym}${Math.round(Math.abs(totalGP)).toLocaleString('en-IN')}</div></div>
    <div class="kpi"><div class="kpi-lbl">Gross Margin</div><div class="kpi-val ${Number(gpPct)>=30?'green':Number(gpPct)>=15?'gold':'red'}">${gpPct}%</div></div>
  </div>

  ${rows.length===0 ? `
  <div class="card" style="text-align:center;padding:40px;color:var(--muted)">
    <div style="font-size:36px;margin-bottom:10px">📉</div>
    <h3>No completed batches yet</h3>
    <p>Complete production batches and sales orders to see COGS & margin analysis.</p>
  </div>` : `
  <div class="tbl-wrap">
    <div class="tbl-head"><span class="tbl-title">Product-wise COGS & Gross Margin</span></div>
    <div class="tbl-scroll"><table>
      <thead><tr><th>Product</th><th>Units Produced</th><th>Units Sold</th><th>Total COGS</th><th>Cost/Unit</th><th>Revenue</th><th>Gross Profit</th><th>GP Margin</th></tr></thead>
      <tbody>
      ${rows.map(r=>{
        const costPerUnit = r.produced>0?(r.batchCostTotal/r.produced):0;
        const gp          = r.revenue-r.batchCostTotal;
        const gpM         = r.revenue>0?((gp/r.revenue)*100).toFixed(1):0;
        return `<tr>
          <td class="td-b">${escapeHTML(r.product)}</td>
          <td>${r.produced.toLocaleString('en-IN')}</td>
          <td>${r.sold.toLocaleString('en-IN')}</td>
          <td class="td-r">${sym}${Math.round(r.batchCostTotal).toLocaleString('en-IN')}</td>
          <td class="td-m">${costPerUnit>0?sym+costPerUnit.toFixed(2):'—'}</td>
          <td class="td-g">${r.revenue>0?sym+Math.round(r.revenue).toLocaleString('en-IN'):'—'}</td>
          <td class="${gp>=0?'td-g':'td-r'}" style="font-weight:700">${gp>=0?'+':''}${sym}${Math.round(Math.abs(gp)).toLocaleString('en-IN')}</td>
          <td>
            <div style="display:flex;align-items:center;gap:6px">
              <div class="prog" style="width:50px"><div class="prog-fill" style="width:${Math.min(100,Math.max(0,Number(gpM)))}%;background:${Number(gpM)>=30?'var(--green)':Number(gpM)>=15?'var(--gold)':'var(--red)'}"></div></div>
              <span style="font-size:11px;font-weight:700;color:${Number(gpM)>=30?'var(--green)':Number(gpM)>=15?'var(--gold)':'var(--red)'}">${gpM}%</span>
            </div>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>
  </div>
  <div class="alert" style="background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.3);margin-top:12px">
    <span>💡</span><div style="font-size:12px">COGS is calculated from batch raw material costs + labour + machine hours. For accurate margins, ensure BOM is defined for all products and unit costs are updated in raw material register.</div>
  </div>`}`;
}


/* ══════════════════════════════════════════════════════════════
   AUTO-PATCH — Wire up all factory modules to APP routing
   ══════════════════════════════════════════════════════════════ */
(function patchFactory() {
  function doPatching() {
    if (typeof APP === 'undefined') { setTimeout(doPatching, 300); return; }

    // Deep factory dashboard (replaces shallow v1.0)
    // renderFactoryDashboard is already defined above and will override the shallow version

    // Patch renderSection — only intercept erp/scm when factory vertical is active
    const _origRS = APP.renderSection.bind(APP);
    APP.renderSection = function(id) {
      const isFactory = typeof VERTICAL !== 'undefined' && VERTICAL.current()?.id === 'factory';
      if (isFactory && id === 'erp')  { renderProductionDeep('batches'); return; }
      if (isFactory && id === 'scm')  { renderRawMaterialDeep('stock');  return; }
      _origRS(id);
    };

    // Also expose for direct nav calls
    window.renderProductionDeep  = renderProductionDeep;
    window.renderRawMaterialDeep = renderRawMaterialDeep;
    window.renderERPDeep         = renderERPDeep;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doPatching);
  } else {
    doPatching();
  }
})();
