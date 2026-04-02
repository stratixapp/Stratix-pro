/**
 * STRATIX v_transport.js v2.0 — DEEP BUILD
 * ══════════════════════════════════════════════════════════════
 * ROUND 1 — Transport Vertical Complete
 *
 * WHAT'S DEEP IN THIS FILE:
 *  1. renderTransportDashboard()    — Real KPIs from trips data
 *  2. renderTripPNL()               — DEEP: pipeline, cost breakdown,
 *                                     per-km analysis, vehicle P&L,
 *                                     freight aging, LR link, trip status
 *  3. renderFleet()                 — DEEP: document vault + expiry alerts,
 *                                     service history, vehicle profitability,
 *                                     fuel efficiency tracking
 *  4. renderTransportCRM()          — DEEP: consignor/consignee master,
 *                                     invoice-wise aging (30/60/90/90+),
 *                                     credit limits, WA reminder, party ledger
 *  5. renderDriverPayroll()         — DEEP: attendance, bata/advance/OT,
 *                                     trip-wise driver P&L, payslip
 *
 * DATA KEYS USED:
 *  trips            — {route, vehicle, freight, fuel, toll, driver, load,
 *                      other, profit, date, driverName, distanceKm, loadTons,
 *                      status, lrNumber, clientId, paymentStatus, paymentDate}
 *  fleet            — {number, model, driver, driverPhone, status, utilization,
 *                      revenue, cost, purchaseDate, registrationExpiry,
 *                      insuranceExpiry, fitnessExpiry, permitExpiry, pucExpiry,
 *                      lastService, nextService, totalKm, fuelType,
 *                      serviceHistory:[{date,type,cost,odometer,garage}]}
 *  clients          — {name, phone, gstNumber, city, creditLimit, outstanding,
 *                      invoices, lastPayment, risk, type, totalBusiness}
 *  txnConsignors    — {name, phone, gstNumber, city, type:'consignor'|'consignee',
 *                      totalFreight, outstanding, lastTrip}
 *  drivers          — {name, phone, licenseNo, licenseExpiry, doj, basic,
 *                      da, advance, bankAcc, ifsc, pan, status}
 *  driverAttendance — {driverId, month, present, tripDays, otDays}
 *  maintenance      — existing key in logistics.js
 *  dieselLog        — existing key in logistics.js
 *
 * INTEGRATION:
 *  - renderTripPNL() replaces APP.renderTripPNL() — registered in renderSection
 *    via: trippnl: () => renderTripPNL()
 *  - renderFleet() replaces APP.renderFleet()
 *    via: fleet: () => renderFleet()
 *  - renderTransportCRM() replaces APP CRM for transport vertical
 *    via: crm: () => renderTransportCRM()  (only for logistics bizType)
 *  - renderDriverPayroll() is called via salary section for logistics vertical
 *    via: salary: () => renderDriverPayroll()
 *  - All functions are globally scoped — safe to call from APP.navigate()
 *
 * COMPATIBILITY:
 *  - All existing trips/fleet data reads correctly (backward compatible)
 *  - New fields are optional — old records display fine with '—' fallback
 *  - Uses same STRATIX_DB, NOTIFY, escapeHTML, _fmt, _greet from auth.js / vertical.js
 * ══════════════════════════════════════════════════════════════
 */

/* ── Transport Helpers ──────────────────────────────────────── */
const TR = {
  sym()   { return STRATIX_DB.getSettings().currencySymbol || '₹'; },
  biz()   { return STRATIX_DB.getSettings().businessName   || 'Your Company'; },
  today() { return new Date().toISOString().split('T')[0]; },
  fmt(n)  { return _fmt(n, TR.sym()); },

  dateStr(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
  },

  daysFrom(d) {
    if (!d) return null;
    return Math.round((new Date(d) - new Date()) / 86400000);
  },

  daysAgo(d) {
    if (!d) return null;
    return Math.round((new Date() - new Date(d)) / 86400000);
  },

  // Expiry badge: days until expiry date
  expiryBadge(dateStr, label) {
    if (!dateStr) return `<span class="badge bm">${label}: —</span>`;
    const days = TR.daysFrom(dateStr);
    if (days === null) return `<span class="badge bm">${label}: —</span>`;
    if (days < 0)  return `<span class="badge br">⛔ ${label} EXPIRED ${Math.abs(days)}d ago</span>`;
    if (days <= 15) return `<span class="badge br">🚨 ${label} ${days}d left</span>`;
    if (days <= 30) return `<span class="badge bo">⚠️ ${label} ${days}d left</span>`;
    return `<span class="badge bg">✅ ${label} ${days}d</span>`;
  },

  // Phone normalise for WhatsApp
  normalizePhone(p) {
    if (!p) return null;
    const d = p.replace(/[^0-9]/g, '');
    const n = d.startsWith('91') && d.length === 12 ? d : '91' + d.replace(/^0+/, '').slice(-10);
    return n.length >= 12 ? n : null;
  },

  waUrl(phone, msg) {
    const n = TR.normalizePhone(phone);
    if (!n) return null;
    return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;
  },

  // Trip profit from a trip record
  tripProfit(t) {
    const cost = (t.fuel||0) + (t.toll||0) + (t.driver||0) + (t.load||0) + (t.other||0);
    return (t.freight||0) - cost;
  },

  tripCost(t) {
    return (t.fuel||0) + (t.toll||0) + (t.driver||0) + (t.load||0) + (t.other||0);
  },

  // Risk bucket from outstanding age (days)
  ageBucket(days) {
    if (days <= 30)  return { label:'0-30d',   cls:'bg',   order:1 };
    if (days <= 60)  return { label:'31-60d',  cls:'bo',   order:2 };
    if (days <= 90)  return { label:'61-90d',  cls:'br',   order:3 };
    return                   { label:'90d+',   cls:'br',   order:4 };
  },

  // Modal shell (matches erp.js pattern)
  modal(id, title, body, wide=false) {
    return `<div class="overlay" id="${id}" onclick="if(event.target.id==='${id}')document.getElementById('${id}').remove()">
      <div class="modal" style="${wide ? 'max-width:740px' : 'max-width:480px'}">
        <div class="modal-hd">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="document.getElementById('${id}').remove()">✕</button>
        </div>
        <div class="modal-body">${body}</div>
      </div>
    </div>`;
  },

  // Pill badge
  badge(text, cls='bm') {
    return `<span class="badge ${cls}">${text}</span>`;
  },

  // Month key YYYY-MM
  monthKey(offset=0) {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  },

  // Last N month keys
  lastMonths(n) {
    const result = [];
    for (let i = n-1; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      result.push({
        key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
        label: d.toLocaleString('en-IN', { month:'short' })
      });
    }
    return result;
  }
};


/* ══════════════════════════════════════════════════════════════
   1.  TRANSPORT DASHBOARD
   ══════════════════════════════════════════════════════════════ */
function renderTransportDashboard() {
  const s      = STRATIX_AUTH.getSession();
  const cfg    = STRATIX_DB.getSettings();
  const sym    = cfg.currencySymbol || '₹';
  const txns   = STRATIX_DB.getArr('transactions');
  const trips  = STRATIX_DB.getArr('trips');
  const fleet  = STRATIX_DB.getArr('fleet');
  const clients= STRATIX_DB.getArr('clients');
  const now    = new Date();
  const td     = now.toISOString().split('T')[0];
  const mKey   = TR.monthKey(0);

  // ── KPI calc ─────────────────────────────────────────────────
  const mRev    = txns.filter(t => t.type==='revenue' && (t.date||'').startsWith(mKey)).reduce((s,t)=>s+Number(t.amount||0),0);
  const mExp    = txns.filter(t => t.type==='expense' && (t.date||'').startsWith(mKey)).reduce((s,t)=>s+Number(t.amount||0),0);
  const mProfit = mRev - mExp;

  // Outstanding from clients
  const totalDue = clients.reduce((s,c) => s + Number(c.outstanding||0), 0);
  const highRiskDue = clients.filter(c=>c.risk==='high'||c.risk==='critical').reduce((s,c)=>s+Number(c.outstanding||0),0);

  // Fleet
  const activeVeh   = fleet.filter(v => v.status === 'active').length;
  const maintVeh    = fleet.filter(v => v.status === 'maintenance').length;
  const avgUtil     = fleet.length ? Math.round(fleet.reduce((s,v) => s + Number(v.utilization||0), 0) / fleet.length) : 0;

  // Trips this month
  const mTrips      = trips.filter(t => (t.date||'').startsWith(mKey));
  const todayTrips  = trips.filter(t => t.date === td);
  const todayFreight= todayTrips.reduce((s,t) => s + Number(t.freight||0), 0);
  const mFreight    = mTrips.reduce((s,t)  => s + Number(t.freight||0), 0);
  const mTripProfit = mTrips.reduce((s,t)  => s + TR.tripProfit(t), 0);
  const avgMargin   = mFreight > 0 ? ((mTripProfit/mFreight)*100).toFixed(1) : 0;

  // Pending payment trips
  const pendingPayTrips = trips.filter(t => t.paymentStatus === 'pending' || !t.paymentStatus).length;

  // Document expiry alerts
  const docAlerts = [];
  fleet.forEach(v => {
    ['registrationExpiry','insuranceExpiry','fitnessExpiry','permitExpiry','pucExpiry'].forEach(field => {
      if (v[field]) {
        const days = TR.daysFrom(v[field]);
        if (days !== null && days <= 30) {
          const labels = { registrationExpiry:'RC', insuranceExpiry:'Insurance', fitnessExpiry:'Fitness', permitExpiry:'Permit', pucExpiry:'PUC' };
          docAlerts.push({ vehicle: v.number, doc: labels[field], days });
        }
      }
    });
  });

  // Last 6 months bar chart
  const months6 = TR.lastMonths(6);
  months6.forEach(m => {
    m.rev = txns.filter(t => t.type==='revenue' && (t.date||'').startsWith(m.key)).reduce((s,t)=>s+Number(t.amount||0),0);
    m.exp = txns.filter(t => t.type==='expense' && (t.date||'').startsWith(m.key)).reduce((s,t)=>s+Number(t.amount||0),0);
  });
  const maxBar = Math.max(...months6.map(m => Math.max(m.rev, m.exp)), 1);

  // Top 4 vehicles by revenue from trips
  const vehRevMap = {};
  trips.forEach(t => {
    if (!t.vehicle) return;
    if (!vehRevMap[t.vehicle]) vehRevMap[t.vehicle] = { freight:0, cost:0, trips:0 };
    vehRevMap[t.vehicle].freight += Number(t.freight||0);
    vehRevMap[t.vehicle].cost    += TR.tripCost(t);
    vehRevMap[t.vehicle].trips   += 1;
  });
  const topVehicles = Object.entries(vehRevMap)
    .sort((a,b) => b[1].freight - a[1].freight)
    .slice(0, 4)
    .map(([num, d]) => ({ num, ...d, profit: d.freight - d.cost }));

  // Recent 5 trips
  const recentTrips = [...trips].sort((a,b) => new Date(b.createdAt||b.date) - new Date(a.createdAt||a.date)).slice(0,5);

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    ${VERTICAL.bannerHTML()}

    <div class="sec-head">
      <div>
        <div class="sec-title">Good ${_greet()}, ${escapeHTML(s.name)} 👋</div>
        <div class="sec-sub">${escapeHTML(cfg.businessName||s.biz||'Your Business')} · ${now.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="APP.navigate('trippnl')">🛣️ New Trip</button>
        <button class="btn btn-outline" onclick="APP.navigate('logisticsdocs')">📋 New Doc</button>
      </div>
    </div>

    ${docAlerts.length > 0 ? `
    <div style="background:rgba(232,64,64,.08);border:1px solid rgba(232,64,64,.3);border-radius:12px;padding:12px 18px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <span style="font-size:18px">🚨</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700;color:#e84040">Document Expiry Alert</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">${docAlerts.slice(0,4).map(a => `${escapeHTML(a.vehicle)} ${a.doc} ${a.days <= 0 ? 'EXPIRED' : 'in '+a.days+'d'}`).join(' · ')}${docAlerts.length>4?` +${docAlerts.length-4} more`:''}</div>
      </div>
      <button class="btn btn-sm" style="background:rgba(232,64,64,.15);border:1px solid rgba(232,64,64,.3);color:#e84040;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:700" onclick="APP.navigate('fleet')">View Fleet →</button>
    </div>` : ''}

    <!-- Row 1: KPI Cards -->
    <div class="kpi-grid">
      <div class="kpi accent" onclick="APP.navigate('datamanager')" style="cursor:pointer">
        <div class="kpi-ico">💰</div>
        <div class="kpi-lbl">Freight Revenue (Month)</div>
        <div class="kpi-val">${TR.fmt(mRev)}</div>
        <div class="kpi-trend ${mFreight>0?'up':'muted'}">${mTrips.length} trips · ${sym}${Math.round(mFreight/Math.max(mTrips.length,1)).toLocaleString('en-IN')} avg</div>
      </div>
      <div class="kpi" onclick="APP.navigate('datamanager')" style="cursor:pointer">
        <div class="kpi-ico">⛽</div>
        <div class="kpi-lbl">Operating Cost (Month)</div>
        <div class="kpi-val">${TR.fmt(mExp)}</div>
        <div class="kpi-trend muted">Fuel · Salary · Toll · Maintenance</div>
      </div>
      <div class="kpi" onclick="APP.navigate('analytics')" style="cursor:pointer">
        <div class="kpi-ico">📈</div>
        <div class="kpi-lbl">Net Profit (Month)</div>
        <div class="kpi-val ${mProfit>=0?'green':'red'}">${TR.fmt(Math.abs(mProfit))}</div>
        <div class="kpi-trend ${mProfit>=0?'up':'down'}">${mProfit>=0?'▲':'▼'} ${avgMargin}% trip margin</div>
      </div>
      <div class="kpi" onclick="APP.navigate('invoiceaging')" style="cursor:pointer">
        <div class="kpi-ico">⏳</div>
        <div class="kpi-lbl">Freight Dues</div>
        <div class="kpi-val ${totalDue>0?'gold':''}">${TR.fmt(totalDue)}</div>
        <div class="kpi-trend ${highRiskDue>0?'down':'up'}">${clients.filter(c=>Number(c.outstanding||0)>0).length} clients · ${highRiskDue>0?TR.fmt(highRiskDue)+' high risk':'All collected'}</div>
      </div>
    </div>

    <!-- Row 2: Fleet + Today + Dues -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:18px">

      <div class="card">
        <div class="card-title">🚛 Fleet Status</div>
        <div style="display:flex;justify-content:space-around;margin-bottom:12px">
          <div style="text-align:center">
            <div style="font-size:26px;font-weight:800;color:var(--green);font-family:var(--head)">${activeVeh}</div>
            <div style="font-size:11px;color:var(--muted)">Active</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:26px;font-weight:800;color:var(--muted);font-family:var(--head)">${fleet.filter(v=>v.status==='idle').length}</div>
            <div style="font-size:11px;color:var(--muted)">Idle</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:26px;font-weight:800;color:var(--orange);font-family:var(--head)">${maintVeh}</div>
            <div style="font-size:11px;color:var(--muted)">Service</div>
          </div>
          <div style="text-align:center">
            <div style="font-size:26px;font-weight:800;color:var(--gold);font-family:var(--head)">${fleet.length}</div>
            <div style="font-size:11px;color:var(--muted)">Total</div>
          </div>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:5px">Fleet Utilization</div>
        <div class="prog"><div class="prog-fill po" style="width:${avgUtil}%"></div></div>
        <div style="font-size:12px;color:var(--gold);margin-top:4px;font-weight:700">${avgUtil}% avg utilization</div>
        ${docAlerts.length>0?`<div style="font-size:11px;color:#e84040;margin-top:6px;font-weight:600">⚠️ ${docAlerts.length} doc expiry alert${docAlerts.length>1?'s':''}</div>`:''}
        <button class="btn btn-ghost btn-sm btn-full" style="margin-top:10px" onclick="APP.navigate('fleet')">Manage Fleet →</button>
      </div>

      <div class="card">
        <div class="card-title">📍 Today's Activity</div>
        <div style="display:flex;gap:12px;margin-bottom:12px">
          <div style="flex:1;text-align:center">
            <div style="font-size:26px;font-weight:800;font-family:var(--head);color:var(--blue)">${todayTrips.length}</div>
            <div style="font-size:11px;color:var(--muted)">Trips Today</div>
          </div>
          <div style="flex:1;text-align:center">
            <div style="font-size:18px;font-weight:800;font-family:var(--head);color:var(--gold)">${TR.fmt(todayFreight)}</div>
            <div style="font-size:11px;color:var(--muted)">Today Freight</div>
          </div>
        </div>
        <div style="border-top:1px solid var(--b1);padding-top:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:12px;color:var(--muted)">Month Total</span>
            <span style="font-size:12px;font-weight:700">${mTrips.length} trips</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px">
            <span style="font-size:12px;color:var(--muted)">Payment Pending</span>
            <span style="font-size:12px;font-weight:700;color:${pendingPayTrips>0?'var(--orange)':'var(--green)'}">${pendingPayTrips} trips</span>
          </div>
          <div style="display:flex;justify-content:space-between">
            <span style="font-size:12px;color:var(--muted)">Avg Trip Margin</span>
            <span style="font-size:12px;font-weight:700;color:${Number(avgMargin)>=15?'var(--green)':Number(avgMargin)>=5?'var(--gold)':'var(--red)'}">${avgMargin}%</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm btn-full" style="margin-top:10px" onclick="APP.navigate('trippnl')">Add Trip →</button>
      </div>

      <div class="card">
        <div class="card-title">💸 Top Outstanding</div>
        ${clients.length===0 ? `<div style="color:var(--muted);font-size:13px;text-align:center;padding:20px 0">No clients added<br/><button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="APP.navigate('crm')">Add Client</button></div>` :
          [...clients].sort((a,b)=>Number(b.outstanding||0)-Number(a.outstanding||0)).slice(0,4).map(c=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--b1)">
            <div>
              <div style="font-size:12px;font-weight:600">${escapeHTML(c.name)}</div>
              <div style="font-size:10px;color:var(--muted)">${escapeHTML(c.city||'')}${c.lastPayment?' · '+TR.dateStr(c.lastPayment):''}</div>
            </div>
            <div style="font-size:12px;font-weight:700;color:${Number(c.outstanding||0)>0?'var(--red)':'var(--green)'}">${TR.fmt(c.outstanding||0)}</div>
          </div>`).join('')
        }
        <button class="btn btn-ghost btn-sm btn-full" style="margin-top:10px" onclick="APP.navigate('invoiceaging')">Full Aging Report →</button>
      </div>
    </div>

    <!-- Row 3: Chart + Vehicle Performance -->
    <div class="charts-row" style="margin-bottom:18px">
      <div class="chart-card">
        <div class="chart-hd">
          <h3>📊 Revenue vs Cost — Last 6 Months</h3>
          <span class="chart-sub">Based on your transaction data</span>
        </div>
        <div class="bar-chart">
          ${months6.map(m=>`
          <div class="bar-grp">
            <div class="bars">
              <div class="bar rev" style="height:${Math.round((m.rev/maxBar)*120)}px" title="Revenue: ${TR.fmt(m.rev)}"></div>
              <div class="bar exp" style="height:${Math.round((m.exp/maxBar)*120)}px" title="Cost: ${TR.fmt(m.exp)}"></div>
            </div>
            <div class="bar-lbl">${m.label}</div>
          </div>`).join('')}
        </div>
        <div class="chart-legend">
          <div class="leg rev">Freight Revenue</div>
          <div class="leg exp">Operating Cost</div>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-hd"><h3>🚛 Vehicle Performance (All Time)</h3></div>
        ${topVehicles.length === 0 ? `<div style="color:var(--muted);font-size:12px;text-align:center;padding:24px 0">Add trips to see vehicle performance.<br/><button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="APP.navigate('trippnl')">Add Trip</button></div>` :
          topVehicles.map(v => {
            const margin = v.freight > 0 ? ((v.profit/v.freight)*100).toFixed(0) : 0;
            const w = Math.min(100, Math.round((v.freight / topVehicles[0].freight) * 100));
            return `<div style="margin-bottom:12px">
              <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                <span style="font-size:12px;font-weight:700">${escapeHTML(v.num)}</span>
                <span style="font-size:11px;color:var(--muted)">${v.trips} trips · ${margin}% margin</span>
              </div>
              <div class="prog"><div class="prog-fill po" style="width:${w}%"></div></div>
              <div style="display:flex;justify-content:space-between;margin-top:3px">
                <span style="font-size:11px;color:var(--muted)">Revenue: ${TR.fmt(v.freight)}</span>
                <span style="font-size:11px;color:${v.profit>=0?'var(--green)':'var(--red)'}">${v.profit>=0?'+':''}${TR.fmt(v.profit)}</span>
              </div>
            </div>`;
          }).join('')
        }
        ${fleet.length > 0 ? `<button class="btn btn-ghost btn-sm btn-full" style="margin-top:8px" onclick="APP.navigate('fleet')">Full Fleet Report →</button>` : ''}
      </div>
    </div>

    <!-- Quick Actions -->
    ${VERTICAL.quickActionsHTML()}

    <!-- Recent Trips -->
    <div class="tbl-wrap">
      <div class="tbl-head">
        <div class="tbl-title">🛣️ Recent Trips</div>
        <button class="btn btn-outline btn-sm" onclick="APP.navigate('trippnl')">View All →</button>
      </div>
      ${recentTrips.length===0 ? `<div style="padding:28px;text-align:center;color:var(--muted);font-size:13px">No trips recorded yet.<br/><button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="APP.navigate('trippnl')">Add First Trip</button></div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr>
          <th>Route</th><th>Vehicle</th><th>Freight</th><th>Cost</th><th>Profit</th><th>Margin</th><th>Payment</th><th>Date</th>
        </tr></thead>
        <tbody>
        ${recentTrips.map(t => {
          const cost   = TR.tripCost(t);
          const profit = (t.freight||0) - cost;
          const margin = (t.freight||0) > 0 ? ((profit/(t.freight||1))*100).toFixed(0) : 0;
          const payStatus = t.paymentStatus || 'pending';
          return `<tr>
            <td class="td-b">${escapeHTML(t.route||'—')}</td>
            <td class="td-m">${escapeHTML(t.vehicle||'—')}</td>
            <td class="td-g">${TR.fmt(t.freight||0)}</td>
            <td class="td-r">${TR.fmt(cost)}</td>
            <td class="${profit>=0?'td-g':'td-r'}">${profit>=0?'+':''}${TR.fmt(Math.abs(profit))}</td>
            <td style="font-size:12px;color:${Number(margin)>=15?'var(--green)':Number(margin)>=5?'var(--gold)':'var(--red)'}">${margin}%</td>
            <td>${payStatus==='paid'?'<span class="badge bg">Paid</span>':'<span class="badge bo">Pending</span>'}</td>
            <td class="td-m">${TR.dateStr(t.date)}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>`;
}


/* ══════════════════════════════════════════════════════════════
   2.  TRIP P&L — DEEP BUILD
       Tabs: Add Trip | Trip History | Vehicle P&L | Freight Dues
   ══════════════════════════════════════════════════════════════ */
function renderTripPNL(activeTab) {
  activeTab = activeTab || 'add';
  const trips  = STRATIX_DB.getArr('trips');
  const fleet  = STRATIX_DB.getArr('fleet');
  const clients= STRATIX_DB.getArr('clients');
  const sym    = TR.sym();

  // Tab summaries
  const totalFreight = trips.reduce((s,t) => s + Number(t.freight||0), 0);
  const totalCost    = trips.reduce((s,t) => s + TR.tripCost(t), 0);
  const totalProfit  = totalFreight - totalCost;
  const avgMargin    = totalFreight > 0 ? ((totalProfit/totalFreight)*100).toFixed(1) : 0;
  const pendingPay   = trips.filter(t => !t.paymentStatus || t.paymentStatus==='pending').reduce((s,t)=>s+Number(t.freight||0),0);

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">🛣️ Trip P&L Manager</h1>
        <p class="sec-sub">Complete trip profitability — per-km analysis, payment tracking, vehicle P&L</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-ghost btn-sm" onclick="TR_EXPORT.tripsCSV()">📥 Export CSV</button>
      </div>
    </div>

    <!-- Summary KPIs -->
    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      <div class="kpi accent">
        <div class="kpi-lbl">Total Freight</div>
        <div class="kpi-val">${TR.fmt(totalFreight)}</div>
        <div class="kpi-trend">${trips.length} trips total</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Total Cost</div>
        <div class="kpi-val red">${TR.fmt(totalCost)}</div>
        <div class="kpi-trend muted">Fuel · Toll · Driver · Other</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Net Profit</div>
        <div class="kpi-val ${totalProfit>=0?'green':'red'}">${TR.fmt(Math.abs(totalProfit))}</div>
        <div class="kpi-trend ${Number(avgMargin)>=15?'up':Number(avgMargin)>=5?'muted':'down'}">${avgMargin}% avg margin</div>
      </div>
      <div class="kpi" onclick="document.querySelector('[data-ttab=history]').click()" style="cursor:pointer">
        <div class="kpi-lbl">Payment Pending</div>
        <div class="kpi-val ${pendingPay>0?'gold':''}">${TR.fmt(pendingPay)}</div>
        <div class="kpi-trend ${pendingPay>0?'down':'up'}">${trips.filter(t=>!t.paymentStatus||t.paymentStatus==='pending').length} trips unpaid</div>
      </div>
    </div>

    <!-- Tabs -->
    <div class="calc-tabs" style="margin-bottom:16px">
      <button class="calc-tab${activeTab==='add'?' active':''}" data-ttab="add" onclick="TRP._tab('add')">➕ Add Trip</button>
      <button class="calc-tab${activeTab==='history'?' active':''}" data-ttab="history" onclick="TRP._tab('history')">📋 Trip History</button>
      <button class="calc-tab${activeTab==='vehicle'?' active':''}" data-ttab="vehicle" onclick="TRP._tab('vehicle')">🚛 Vehicle P&L</button>
      <button class="calc-tab${activeTab==='dues'?' active':''}" data-ttab="dues" onclick="TRP._tab('dues')">💸 Payment Dues</button>
    </div>

    <div id="tripTabContent">${TRP._renderTab(activeTab, trips, fleet, clients, sym)}</div>
    <div id="tripModal"></div>
  </div>`;
}

/* Trip module */
const TRP = {
  _tab(tab) {
    const trips   = STRATIX_DB.getArr('trips');
    const fleet   = STRATIX_DB.getArr('fleet');
    const clients = STRATIX_DB.getArr('clients');
    const sym     = TR.sym();
    // Update active tab button
    document.querySelectorAll('[data-ttab]').forEach(b => b.classList.toggle('active', b.dataset.ttab === tab));
    document.getElementById('tripTabContent').innerHTML = this._renderTab(tab, trips, fleet, clients, sym);
  },

  _renderTab(tab, trips, fleet, clients, sym) {
    if (tab === 'add')     return this._renderAddForm(fleet, clients, sym);
    if (tab === 'history') return this._renderHistory(trips, sym);
    if (tab === 'vehicle') return this._renderVehiclePNL(trips, fleet, sym);
    if (tab === 'dues')    return this._renderDues(trips, clients, sym);
    return '';
  },

  /* ── ADD TRIP FORM ── */
  _renderAddForm(fleet, clients, sym) {
    const today = TR.today();
    const vehOptions = fleet.length > 0
      ? fleet.map(v => `<option value="${escapeHTML(v.number)}">${escapeHTML(v.number)}${v.driver && v.driver!=='—'?' — '+escapeHTML(v.driver):''}</option>`).join('')
      : '<option value="">No vehicles — type manually</option>';
    const clientOptions = clients.length > 0
      ? clients.map(c => `<option value="${c.id}">${escapeHTML(c.name)}${c.city?' ('+escapeHTML(c.city)+')':''}</option>`).join('')
      : '<option value="">No clients — type manually</option>';
    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">

      <!-- Trip Input -->
      <div class="card">
        <div class="card-title">🛣️ Trip Details</div>
        <div class="form-grid">
          <div class="field"><label>Trip Date *</label><input type="date" id="tp_date" value="${today}"/></div>
          <div class="field"><label>Route *</label><input id="tp_route" placeholder="Mumbai — Pune (300 km)"/></div>
          <div class="field"><label>Vehicle No.</label>
            <select id="tp_vehicle" onchange="TRP._onVehicleSelect(this.value)">
              <option value="">-- Select or type --</option>
              ${vehOptions}
            </select>
          </div>
          <div class="field"><label>Vehicle (manual)</label><input id="tp_vehicle_manual" placeholder="MH12AB1234"/></div>
          <div class="field"><label>Driver Name</label><input id="tp_driver_name" placeholder="Driver name"/></div>
          <div class="field"><label>Distance (km)</label><input type="number" id="tp_km" placeholder="300" oninput="TRP._liveCalc()"/></div>
          <div class="field"><label>Load (tons)</label><input type="number" id="tp_tons" placeholder="8" oninput="TRP._liveCalc()"/></div>
          <div class="field"><label>Consignee / Client</label>
            <select id="tp_client_id">
              <option value="">-- Select client --</option>
              ${clientOptions}
            </select>
          </div>
          <div class="field"><label>LR Number</label><input id="tp_lr" placeholder="LR-20260001"/></div>
        </div>
      </div>

      <!-- Cost Breakdown -->
      <div class="card">
        <div class="card-title">💰 Revenue & Cost Breakdown</div>
        <div class="form-grid">
          <div class="field"><label>Freight Revenue (${sym}) *</label><input type="number" id="tp_freight" placeholder="25000" oninput="TRP._liveCalc()"/></div>
          <div class="field"><label>Advance Collected (${sym})</label><input type="number" id="tp_advance" placeholder="0" oninput="TRP._liveCalc()"/></div>
          <div class="field"><label>Fuel Cost (${sym})</label><input type="number" id="tp_fuel" placeholder="4500" oninput="TRP._liveCalc()"/></div>
          <div class="field"><label>Toll Charges (${sym})</label><input type="number" id="tp_toll" placeholder="800" oninput="TRP._liveCalc()"/></div>
          <div class="field"><label>Driver Bata (${sym})</label><input type="number" id="tp_driver" placeholder="1200" oninput="TRP._liveCalc()"/></div>
          <div class="field"><label>Loading / Unloading (${sym})</label><input type="number" id="tp_load" placeholder="500" oninput="TRP._liveCalc()"/></div>
          <div class="field"><label>Maintenance / Repair (${sym})</label><input type="number" id="tp_repair" placeholder="0" oninput="TRP._liveCalc()"/></div>
          <div class="field"><label>Other Costs (${sym})</label><input type="number" id="tp_other" placeholder="300" oninput="TRP._liveCalc()"/></div>
        </div>
        <div class="field" style="margin-top:8px"><label>Notes / Remarks</label><input id="tp_notes" placeholder="Any special notes about this trip"/></div>
      </div>
    </div>

    <!-- Live P&L Preview -->
    <div id="tripLiveCalc" class="card" style="margin-top:14px;background:var(--s2)">
      <div style="text-align:center;color:var(--muted);font-size:13px;padding:12px 0">Fill in freight and costs above to see live P&L →</div>
    </div>

    <div style="display:flex;gap:12px;margin-top:14px">
      <button class="btn btn-gold" style="flex:2" onclick="TRP.saveTrip()">💾 Save Trip</button>
      <button class="btn btn-ghost" style="flex:1" onclick="TRP._clearForm()">Clear Form</button>
    </div>`;
  },

  _onVehicleSelect(val) {
    if (val) {
      const manual = document.getElementById('tp_vehicle_manual');
      if (manual) manual.value = '';
      // Auto-fill driver if fleet record has it
      const fleet = STRATIX_DB.getArr('fleet');
      const v = fleet.find(f => f.number === val);
      if (v && v.driver && v.driver !== '—') {
        const dn = document.getElementById('tp_driver_name');
        if (dn && !dn.value) dn.value = v.driver;
      }
    }
  },

  _liveCalc() {
    const freight = +document.getElementById('tp_freight')?.value||0;
    const advance = +document.getElementById('tp_advance')?.value||0;
    const fuel    = +document.getElementById('tp_fuel')?.value||0;
    const toll    = +document.getElementById('tp_toll')?.value||0;
    const driver  = +document.getElementById('tp_driver')?.value||0;
    const load    = +document.getElementById('tp_load')?.value||0;
    const repair  = +document.getElementById('tp_repair')?.value||0;
    const other   = +document.getElementById('tp_other')?.value||0;
    const km      = +document.getElementById('tp_km')?.value||0;
    const tons    = +document.getElementById('tp_tons')?.value||0;
    const sym     = TR.sym();

    const totalCost  = fuel + toll + driver + load + repair + other;
    const profit     = freight - totalCost;
    const margin     = freight > 0 ? ((profit/freight)*100).toFixed(1) : 0;
    const breakeven  = totalCost;
    const balance    = freight - advance;
    const perKm      = km > 0 ? (freight/km).toFixed(2) : 0;
    const costPerKm  = km > 0 ? (totalCost/km).toFixed(2) : 0;
    const fuelPct    = totalCost > 0 ? ((fuel/totalCost)*100).toFixed(0) : 0;

    const el = document.getElementById('tripLiveCalc');
    if (!el) return;

    const profitColor = profit >= 0 ? 'var(--green)' : 'var(--red)';
    el.innerHTML = `
      <div class="card-title">📊 Live Trip P&L</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px">
        <div style="text-align:center;padding:12px;background:var(--s1);border-radius:10px;border:1px solid var(--b1)">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Net Profit</div>
          <div style="font-size:20px;font-weight:800;color:${profitColor}">${profit>=0?'+':''}${TR.fmt(Math.abs(profit))}</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--s1);border-radius:10px;border:1px solid var(--b1)">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Margin</div>
          <div style="font-size:20px;font-weight:800;color:${Number(margin)>=15?'var(--green)':Number(margin)>=5?'var(--gold)':'var(--red)'}">${margin}%</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--s1);border-radius:10px;border:1px solid var(--b1)">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Break-even Freight</div>
          <div style="font-size:18px;font-weight:800;color:var(--txt)">${TR.fmt(breakeven)}</div>
        </div>
        <div style="text-align:center;padding:12px;background:var(--s1);border-radius:10px;border:1px solid var(--b1)">
          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Balance Due</div>
          <div style="font-size:18px;font-weight:800;color:var(--gold)">${TR.fmt(balance)}</div>
        </div>
      </div>

      <!-- Cost pie-like breakdown -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px">
        ${[[`⛽ Fuel`,fuel,fuelPct+'%'],[`🛣️ Toll`,toll,''],[`👤 Driver`,driver,''],[`📦 Load/Unload`,load,''],[`🔧 Repair`,repair,''],[`📋 Other`,other,'']].filter(r=>r[1]>0).map(([l,v,s])=>`
        <div style="background:rgba(232,64,64,.06);border:1px solid rgba(232,64,64,.15);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">${l}</div>
          <div style="font-size:13px;font-weight:700;color:var(--red)">${TR.fmt(v)}</div>
          ${s?`<div style="font-size:10px;color:var(--muted)">${s} of cost</div>`:''}
        </div>`).join('')}
      </div>

      ${km > 0 ? `
      <div style="display:flex;gap:12px;flex-wrap:wrap;padding:10px;background:rgba(79,126,240,.06);border:1px solid rgba(79,126,240,.15);border-radius:8px;font-size:12px">
        <span>📍 <strong>${km} km</strong></span>
        <span>📈 Revenue/km: <strong style="color:var(--gold)">${sym}${perKm}</strong></span>
        <span>📉 Cost/km: <strong style="color:var(--red)">${sym}${costPerKm}</strong></span>
        <span>💹 Profit/km: <strong style="color:${profit/km>=0?'var(--green)':'var(--red)'}">${sym}${(profit/km).toFixed(2)}</strong></span>
        ${tons > 0 ? `<span>⚖️ Rate/ton: <strong>${sym}${(freight/tons).toFixed(0)}</strong></span>` : ''}
      </div>` : ''}

      ${profit < 0 ? `
      <div class="alert" style="background:rgba(232,64,64,.08);border-color:rgba(232,64,64,.3);margin-top:10px">
        <span style="font-size:16px">⚠️</span>
        <div>This trip is <strong>loss-making</strong>. Minimum freight needed: <strong>${sym}${Math.round(breakeven*1.15).toLocaleString('en-IN')}</strong> (15% margin)</div>
      </div>` : profit > 0 && Number(margin) < 10 ? `
      <div class="alert" style="background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.3);margin-top:10px">
        <span style="font-size:16px">📊</span>
        <div>Margin is below 10%. Consider reducing costs or increasing freight.</div>
      </div>` : profit > 0 ? `
      <div class="alert" style="background:rgba(0,214,143,.08);border-color:rgba(0,214,143,.3);margin-top:10px">
        <span style="font-size:16px">✅</span>
        <div>Profitable trip! ${margin}% margin.</div>
      </div>` : ''}
    `;
  },

  saveTrip() {
    const freight = +document.getElementById('tp_freight')?.value||0;
    const route   = document.getElementById('tp_route')?.value.trim();
    if (!route)   { NOTIFY.show('Enter route (e.g. Mumbai — Pune)','warning'); return; }
    if (!freight) { NOTIFY.show('Enter freight revenue','warning'); return; }

    const vehicle = document.getElementById('tp_vehicle')?.value ||
                    document.getElementById('tp_vehicle_manual')?.value.trim().toUpperCase() || '';
    const driverName = document.getElementById('tp_driver_name')?.value.trim() || '';
    const km      = +document.getElementById('tp_km')?.value||0;
    const tons    = +document.getElementById('tp_tons')?.value||0;
    const fuel    = +document.getElementById('tp_fuel')?.value||0;
    const toll    = +document.getElementById('tp_toll')?.value||0;
    const driver  = +document.getElementById('tp_driver')?.value||0;
    const load    = +document.getElementById('tp_load')?.value||0;
    const repair  = +document.getElementById('tp_repair')?.value||0;
    const other   = +document.getElementById('tp_other')?.value||0;
    const advance = +document.getElementById('tp_advance')?.value||0;
    const lr      = document.getElementById('tp_lr')?.value.trim()||'';
    const notes   = document.getElementById('tp_notes')?.value.trim()||'';
    const date    = document.getElementById('tp_date')?.value || TR.today();
    const clientId= document.getElementById('tp_client_id')?.value||'';
    const totalCost = fuel + toll + driver + load + repair + other;
    const profit    = freight - totalCost;
    const sym       = TR.sym();

    const trip = {
      route, vehicle, driverName, distanceKm: km, loadTons: tons,
      freight, fuel, toll, driver, load, repair, other,
      cost: totalCost, profit, advance,
      balance: freight - advance,
      paymentStatus: advance >= freight ? 'paid' : advance > 0 ? 'partial' : 'pending',
      lrNumber: lr, clientId, notes, date,
      status: 'completed'
    };

    STRATIX_DB.push('trips', trip);

    // Auto-sync to transactions
    if (freight > 0) {
      STRATIX_DB.push('transactions', {
        type:'revenue', amount:freight, category:'freight',
        description:`Trip: ${route}${vehicle?' ('+vehicle+')':''}`,
        date
      });
    }
    if (totalCost > 0) {
      STRATIX_DB.push('transactions', {
        type:'expense', amount:totalCost, category:'logistics',
        description:`Trip Cost: ${route}`,
        date
      });
    }

    // Update fleet vehicle stats
    if (vehicle) {
      const fleet = STRATIX_DB.getArr('fleet');
      const vIdx  = fleet.findIndex(v => v.number === vehicle);
      if (vIdx !== -1) {
        fleet[vIdx].revenue     = (fleet[vIdx].revenue||0) + freight;
        fleet[vIdx].cost        = (fleet[vIdx].cost||0) + totalCost;
        fleet[vIdx].totalKm     = (fleet[vIdx].totalKm||0) + km;
        fleet[vIdx].status      = 'active';
        fleet[vIdx].utilization = Math.min(100, (fleet[vIdx].utilization||0) + 5);
        STRATIX_DB.set('fleet', fleet);
      }
    }

    // Update client outstanding if selected
    if (clientId) {
      const clients = STRATIX_DB.getArr('clients');
      const cIdx    = clients.findIndex(c => c.id === clientId);
      if (cIdx !== -1) {
        clients[cIdx].outstanding  = (Number(clients[cIdx].outstanding||0)) + (freight - advance);
        clients[cIdx].invoices     = (Number(clients[cIdx].invoices||0)) + 1;
        clients[cIdx].totalBusiness= (Number(clients[cIdx].totalBusiness||0)) + freight;
        STRATIX_DB.set('clients', clients);
      }
    }

    NOTIFY.show(`Trip saved! P&L: ${profit>=0?'+':''}${sym}${Math.abs(profit).toLocaleString('en-IN')} (${freight>0?((profit/freight)*100).toFixed(1):0}% margin)`, profit>=0?'success':'warning', 5000);
    renderTripPNL('history');
  },

  _clearForm() {
    ['tp_route','tp_vehicle_manual','tp_driver_name','tp_lr','tp_notes'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    ['tp_km','tp_tons','tp_freight','tp_advance','tp_fuel','tp_toll','tp_driver','tp_load','tp_repair','tp_other'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const tp_date = document.getElementById('tp_date');
    if (tp_date) tp_date.value = TR.today();
    const liveCalc = document.getElementById('tripLiveCalc');
    if (liveCalc) liveCalc.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;padding:12px 0">Fill in freight and costs above to see live P&L →</div>`;
  },

  /* ── TRIP HISTORY ── */
  _renderHistory(trips, sym) {
    if (trips.length === 0) return `<div class="card" style="text-align:center;padding:48px 20px">
      <div style="font-size:40px;margin-bottom:12px">🛣️</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No Trips Recorded</h3>
      <p style="color:var(--muted)">Click "Add Trip" above to record your first trip.</p>
    </div>`;

    const sorted = [...trips].sort((a,b) => new Date(b.date||b.createdAt) - new Date(a.date||a.createdAt));

    // Month filter options
    const months = [...new Set(sorted.map(t => (t.date||'').slice(0,7)))].slice(0,6);

    return `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Trip History (${trips.length} total)</span>
        <div style="display:flex;gap:8px">
          <select id="tripMonthFilter" onchange="TRP._filterHistory(this.value)" style="padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt)">
            <option value="all">All Months</option>
            ${months.map(m => `<option value="${m}">${new Date(m+'-01').toLocaleString('en-IN',{month:'long',year:'numeric'})}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm" onclick="TRP._tab('add')">+ Add Trip</button>
        </div>
      </div>
      <div id="tripHistoryTable">
        ${this._renderTripRows(sorted, sym)}
      </div>
    </div>`;
  },

  _filterHistory(monthKey) {
    const trips  = STRATIX_DB.getArr('trips');
    const sym    = TR.sym();
    const filtered = monthKey === 'all' ? trips : trips.filter(t => (t.date||'').startsWith(monthKey));
    const el = document.getElementById('tripHistoryTable');
    if (el) el.innerHTML = this._renderTripRows(
      [...filtered].sort((a,b) => new Date(b.date||b.createdAt) - new Date(a.date||a.createdAt)),
      sym
    );
  },

  _renderTripRows(trips, sym) {
    return `<div class="tbl-scroll"><table>
      <thead><tr>
        <th>Date</th><th>Route</th><th>Vehicle</th><th>Driver</th>
        <th>Freight</th><th>Cost</th><th>Profit</th><th>Margin</th>
        <th>km</th><th>LR No.</th><th>Payment</th><th>Actions</th>
      </tr></thead>
      <tbody>
      ${trips.map(t => {
        const cost   = TR.tripCost(t);
        const profit = Number(t.freight||0) - cost;
        const margin = Number(t.freight||0) > 0 ? ((profit/Number(t.freight||1))*100).toFixed(0) : 0;
        const payStatus = t.paymentStatus || 'pending';
        const payBadge  = payStatus==='paid'?'<span class="badge bg">Paid</span>'
                        : payStatus==='partial'?'<span class="badge bo">Partial</span>'
                        : '<span class="badge br">Pending</span>';
        return `<tr>
          <td class="td-m">${TR.dateStr(t.date)}</td>
          <td class="td-b" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(t.route||'—')}</td>
          <td class="td-m">${escapeHTML(t.vehicle||'—')}</td>
          <td class="td-m">${escapeHTML(t.driverName||t.driver_name||'—')}</td>
          <td class="td-g">${TR.fmt(t.freight||0)}</td>
          <td class="td-r">${TR.fmt(cost)}</td>
          <td class="${profit>=0?'td-g':'td-r'}" style="font-weight:700">${profit>=0?'+':''}${TR.fmt(Math.abs(profit))}</td>
          <td style="color:${Number(margin)>=15?'var(--green)':Number(margin)>=5?'var(--gold)':'var(--red)'}">
            <strong>${margin}%</strong>
          </td>
          <td class="td-m">${t.distanceKm||'—'}</td>
          <td class="td-m" style="font-size:11px">${escapeHTML(t.lrNumber||'—')}</td>
          <td>${payBadge}</td>
          <td>
            <div style="display:flex;gap:4px">
              ${payStatus!=='paid'?`<button class="btn btn-green btn-sm" style="font-size:10px;padding:3px 7px" onclick="TRP.markPaid('${t.id}')">✓ Paid</button>`:''}
              <button class="del-btn" onclick="TRP.deleteTrip('${t.id}')">🗑</button>
            </div>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
  },

  markPaid(id) {
    STRATIX_DB.update('trips', id, { paymentStatus:'paid', paymentDate: TR.today() });
    NOTIFY.show('Trip marked as paid!', 'success');
    this._tab('history');
  },

  deleteTrip(id) {
    if (!confirm('Delete this trip? This cannot be undone.')) return;
    STRATIX_DB.remove('trips', id);
    NOTIFY.show('Trip deleted', 'info');
    this._tab('history');
  },

  /* ── VEHICLE P&L ── */
  _renderVehiclePNL(trips, fleet, sym) {
    // Build per-vehicle stats from trips
    const vehMap = {};
    trips.forEach(t => {
      const key = t.vehicle || 'Unknown';
      if (!vehMap[key]) vehMap[key] = {
        number:key, trips:0, freight:0, fuel:0, toll:0, driver:0, load:0, repair:0, other:0, cost:0, profit:0, km:0
      };
      const v = vehMap[key];
      v.trips   += 1;
      v.freight += Number(t.freight||0);
      v.fuel    += Number(t.fuel||0);
      v.toll    += Number(t.toll||0);
      v.driver  += Number(t.driver||0);
      v.load    += Number(t.load||0);
      v.repair  += Number(t.repair||0);
      v.other   += Number(t.other||0);
      v.cost    += TR.tripCost(t);
      v.profit  += TR.tripProfit(t);
      v.km      += Number(t.distanceKm||0);
    });

    const vehicles = Object.values(vehMap).sort((a,b) => b.freight - a.freight);

    if (vehicles.length === 0) return `<div class="card" style="text-align:center;padding:48px 20px">
      <div style="font-size:40px;margin-bottom:12px">🚛</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No Trip Data Yet</h3>
      <p style="color:var(--muted)">Add trips with vehicle numbers to see per-vehicle P&L.</p>
    </div>`;

    const totalFreight = vehicles.reduce((s,v)=>s+v.freight,0);

    return `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Vehicle P&L — All Time</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr>
          <th>Vehicle</th><th>Trips</th><th>Freight</th><th>Fuel</th><th>Toll</th>
          <th>Driver</th><th>Repair</th><th>Total Cost</th><th>Net Profit</th><th>Margin</th>
          <th>km</th><th>Rev/km</th><th>Share</th>
        </tr></thead>
        <tbody>
        ${vehicles.map(v => {
          const margin = v.freight > 0 ? ((v.profit/v.freight)*100).toFixed(1) : 0;
          const revKm  = v.km > 0 ? (v.freight/v.km).toFixed(1) : '—';
          const share  = totalFreight > 0 ? ((v.freight/totalFreight)*100).toFixed(0) : 0;
          return `<tr>
            <td class="td-b">🚛 ${escapeHTML(v.number)}</td>
            <td>${v.trips}</td>
            <td class="td-g">${TR.fmt(v.freight)}</td>
            <td class="td-r">${TR.fmt(v.fuel)}</td>
            <td class="td-r">${TR.fmt(v.toll)}</td>
            <td class="td-r">${TR.fmt(v.driver)}</td>
            <td class="td-r">${v.repair>0?TR.fmt(v.repair):'—'}</td>
            <td style="color:var(--red);font-weight:700">${TR.fmt(v.cost)}</td>
            <td class="${v.profit>=0?'td-g':'td-r'}" style="font-weight:800">${v.profit>=0?'+':''}${TR.fmt(Math.abs(v.profit))}</td>
            <td style="font-weight:700;color:${Number(margin)>=15?'var(--green)':Number(margin)>=5?'var(--gold)':'var(--red)'}">${margin}%</td>
            <td class="td-m">${v.km>0?v.km.toLocaleString('en-IN')+' km':'—'}</td>
            <td class="td-m">${revKm !== '—'?'₹'+revKm+'/km':revKm}</td>
            <td>
              <div style="display:flex;align-items:center;gap:6px">
                <div class="prog" style="width:50px"><div class="prog-fill po" style="width:${share}%"></div></div>
                <span style="font-size:11px">${share}%</span>
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>

    <!-- Cost composition per vehicle -->
    <div class="card" style="margin-top:14px">
      <div class="card-title">🔬 Cost Breakdown by Vehicle</div>
      <div style="overflow-x:auto">
        ${vehicles.map(v => {
          if (v.cost === 0) return '';
          const bars = [
            { label:'Fuel',   val:v.fuel,   color:'#e84040' },
            { label:'Toll',   val:v.toll,   color:'#2563EB' },
            { label:'Driver', val:v.driver, color:'#4f9ef0' },
            { label:'Load',   val:v.load,   color:'#a855f7' },
            { label:'Repair', val:v.repair, color:'#ff6600' },
            { label:'Other',  val:v.other,  color:'#5c6e8a' },
          ].filter(b => b.val > 0);
          const totalForBar = bars.reduce((s,b)=>s+b.val,0);
          return `<div style="margin-bottom:14px">
            <div style="font-size:12px;font-weight:700;margin-bottom:6px">🚛 ${escapeHTML(v.number)} — Cost: ${TR.fmt(v.cost)}</div>
            <div style="display:flex;height:22px;border-radius:8px;overflow:hidden;gap:1px">
              ${bars.map(b => `<div style="flex:${b.val};background:${b.color};display:flex;align-items:center;justify-content:center" title="${b.label}: ${TR.fmt(b.val)} (${((b.val/totalForBar)*100).toFixed(0)}%)"></div>`).join('')}
            </div>
            <div style="display:flex;gap:12px;margin-top:5px;flex-wrap:wrap">
              ${bars.map(b => `<span style="font-size:10px;color:var(--muted)"><span style="display:inline-block;width:8px;height:8px;background:${b.color};border-radius:2px;margin-right:3px"></span>${b.label}: ${((b.val/totalForBar)*100).toFixed(0)}%</span>`).join('')}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  /* ── PAYMENT DUES ── */
  _renderDues(trips, clients, sym) {
    const unpaid = trips.filter(t => !t.paymentStatus || t.paymentStatus === 'pending' || t.paymentStatus === 'partial')
                        .sort((a,b) => new Date(a.date||a.createdAt) - new Date(b.date||b.createdAt));

    const totalDue    = unpaid.reduce((s,t) => s + (Number(t.freight||0) - Number(t.advance||0)), 0);
    const overdueTrips= unpaid.filter(t => {
      const age = TR.daysAgo(t.date||t.createdAt);
      return age !== null && age > 30;
    });

    return `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
      <div class="kpi accent">
        <div class="kpi-lbl">Total Pending Collection</div>
        <div class="kpi-val">${TR.fmt(totalDue)}</div>
        <div class="kpi-trend">${unpaid.length} trips unpaid</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Overdue (&gt;30 days)</div>
        <div class="kpi-val ${overdueTrips.length>0?'red':''}">${overdueTrips.length}</div>
        <div class="kpi-trend ${overdueTrips.length>0?'down':'up'}">${TR.fmt(overdueTrips.reduce((s,t)=>s+Number(t.freight||0)-Number(t.advance||0),0))}</div>
      </div>
      <div class="kpi">
        <div class="kpi-lbl">Partial Collections</div>
        <div class="kpi-val">${trips.filter(t=>t.paymentStatus==='partial').length}</div>
        <div class="kpi-trend muted">Advance received</div>
      </div>
    </div>

    ${unpaid.length === 0 ? `
    <div class="card" style="text-align:center;padding:36px 20px">
      <div style="font-size:36px;margin-bottom:10px">✅</div>
      <h3 style="color:var(--green)">All Trips Paid!</h3>
      <p style="color:var(--muted);margin-top:6px">No pending collections.</p>
    </div>` : `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Unpaid Trips — Oldest First</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Route</th><th>Vehicle</th><th>Freight</th><th>Advance</th><th>Balance Due</th><th>Age</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
        ${unpaid.map(t => {
          const balance = Number(t.freight||0) - Number(t.advance||0);
          const age     = TR.daysAgo(t.date||t.createdAt);
          const ageColor= age > 60 ? 'var(--red)' : age > 30 ? 'var(--orange)' : 'var(--muted)';
          // Try to find client phone
          const client  = t.clientId ? STRATIX_DB.getArr('clients').find(c=>c.id===t.clientId) : null;
          const phone   = client?.phone || '';
          const waMsg   = `Dear Sir/Madam,\n\nThis is a reminder for payment:\nRoute: ${t.route}\nDate: ${TR.dateStr(t.date)}\nFreight: ${sym}${Number(t.freight||0).toLocaleString('en-IN')}\nBalance Due: ${sym}${balance.toLocaleString('en-IN')}\n\nPlease arrange payment at the earliest.\n\nThank you.`;
          const waLink  = TR.waUrl(phone, waMsg);
          return `<tr>
            <td class="td-m">${TR.dateStr(t.date)}</td>
            <td class="td-b">${escapeHTML(t.route||'—')}</td>
            <td class="td-m">${escapeHTML(t.vehicle||'—')}</td>
            <td class="td-g">${TR.fmt(t.freight||0)}</td>
            <td class="td-m">${t.advance>0?TR.fmt(t.advance):'—'}</td>
            <td style="font-weight:800;color:var(--red)">${TR.fmt(balance)}</td>
            <td style="color:${ageColor};font-size:12px;font-weight:700">${age!==null?age+'d ago':'—'}</td>
            <td>${t.paymentStatus==='partial'?'<span class="badge bo">Partial</span>':'<span class="badge br">Unpaid</span>'}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn btn-green btn-sm" style="font-size:10px;padding:3px 8px" onclick="TRP.markPaid('${t.id}')">✓ Paid</button>
                ${waLink?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="window.open('${waLink}','_blank')">📱 WA</button>`:''}
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`}`;
  }
};

/* Trip CSV Export helper */
const TR_EXPORT = {
  tripsCSV() {
    const trips = STRATIX_DB.getArr('trips');
    if (trips.length === 0) { NOTIFY.show('No trips to export','warning'); return; }
    const rows = [['Date','Route','Vehicle','Driver','Freight','Fuel','Toll','Driver Bata','Load','Repair','Other','Total Cost','Net Profit','Margin%','km','LR No.','Payment Status']];
    trips.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).forEach(t => {
      const cost   = TR.tripCost(t);
      const profit = Number(t.freight||0) - cost;
      const margin = Number(t.freight||0) > 0 ? ((profit/Number(t.freight||1))*100).toFixed(1) : '0';
      rows.push([
        t.date||'', '"'+escapeHTML(t.route||'')+'"', t.vehicle||'', t.driverName||'',
        t.freight||0, t.fuel||0, t.toll||0, t.driver||0, t.load||0, t.repair||0, t.other||0,
        cost, profit, margin, t.distanceKm||0, t.lrNumber||'', t.paymentStatus||'pending'
      ]);
    });
    const csv  = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `STRATIX_Trips_${TR.today()}.csv`;
    a.click();
    NOTIFY.show('Trips exported to CSV!','success');
  }
};


/* ══════════════════════════════════════════════════════════════
   3.  FLEET MANAGER — DEEP BUILD
       Tabs: Vehicles | Documents | Service History | Performance
   ══════════════════════════════════════════════════════════════ */
function renderFleet(activeTab) {
  activeTab = activeTab || 'vehicles';
  const fleet = STRATIX_DB.getArr('fleet');
  const sym   = TR.sym();

  // Summary KPIs
  const active  = fleet.filter(v => v.status === 'active').length;
  const idle    = fleet.filter(v => v.status === 'idle').length;
  const maint   = fleet.filter(v => v.status === 'maintenance').length;
  const avgUtil = fleet.length ? Math.round(fleet.reduce((s,v) => s + Number(v.utilization||0), 0) / fleet.length) : 0;

  // Count expiry alerts across all docs
  const docFields = ['registrationExpiry','insuranceExpiry','fitnessExpiry','permitExpiry','pucExpiry'];
  let alertCount = 0;
  fleet.forEach(v => {
    docFields.forEach(f => {
      if (v[f]) {
        const d = TR.daysFrom(v[f]);
        if (d !== null && d <= 30) alertCount++;
      }
    });
  });

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">🚛 Fleet Manager</h1>
        <p class="sec-sub">Vehicle documents · Service history · Profitability tracking</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="FLT.openAddVehicle()">+ Add Vehicle</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(5,1fr);margin-bottom:18px">
      <div class="kpi accent"><div class="kpi-lbl">Total Vehicles</div><div class="kpi-val">${fleet.length}</div></div>
      <div class="kpi"><div class="kpi-lbl">Active</div><div class="kpi-val green">${active}</div></div>
      <div class="kpi"><div class="kpi-lbl">Idle</div><div class="kpi-val">${idle}</div></div>
      <div class="kpi"><div class="kpi-lbl">In Service</div><div class="kpi-val ${maint>0?'orange':''}">${maint}</div></div>
      <div class="kpi" onclick="FLT._tab('documents')" style="cursor:pointer">
        <div class="kpi-lbl">Doc Alerts</div>
        <div class="kpi-val ${alertCount>0?'red':''}">${alertCount}</div>
        <div class="kpi-trend ${alertCount>0?'down':'up'}">${alertCount>0?alertCount+' expiring':'All OK'}</div>
      </div>
    </div>

    <div class="calc-tabs" style="margin-bottom:16px">
      <button class="calc-tab${activeTab==='vehicles'?' active':''}" data-ftab="vehicles" onclick="FLT._tab('vehicles')">🚛 Vehicles</button>
      <button class="calc-tab${activeTab==='documents'?' active':''}" data-ftab="documents" onclick="FLT._tab('documents')">📋 Documents${alertCount>0?` <span style="background:var(--red);color:#fff;border-radius:10px;padding:1px 6px;font-size:10px;margin-left:4px">${alertCount}</span>`:''}</button>
      <button class="calc-tab${activeTab==='service'?' active':''}" data-ftab="service" onclick="FLT._tab('service')">🔧 Service History</button>
      <button class="calc-tab${activeTab==='performance'?' active':''}" data-ftab="performance" onclick="FLT._tab('performance')">📊 Performance</button>
    </div>

    <div id="fleetTabContent">${FLT._renderTab(activeTab, fleet, sym)}</div>
    <div id="fleetModal"></div>
  </div>`;
}

const FLT = {
  _tab(tab) {
    const fleet = STRATIX_DB.getArr('fleet');
    const sym   = TR.sym();
    document.querySelectorAll('[data-ftab]').forEach(b => b.classList.toggle('active', b.dataset.ftab === tab));
    const el = document.getElementById('fleetTabContent');
    if (el) el.innerHTML = this._renderTab(tab, fleet, sym);
  },

  _renderTab(tab, fleet, sym) {
    if (tab === 'vehicles')    return this._renderVehicles(fleet, sym);
    if (tab === 'documents')   return this._renderDocuments(fleet, sym);
    if (tab === 'service')     return this._renderServiceHistory(fleet, sym);
    if (tab === 'performance') return this._renderPerformance(fleet, sym);
    return '';
  },

  /* ── VEHICLES LIST ── */
  _renderVehicles(fleet, sym) {
    if (fleet.length === 0) return `<div class="card" style="text-align:center;padding:56px 20px">
      <div style="font-size:48px;margin-bottom:14px">🚛</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No Vehicles Added</h3>
      <p style="color:var(--muted);max-width:280px;margin:0 auto 20px">Add your vehicles to track documents, service history, and profitability.</p>
      <button class="btn btn-gold" onclick="FLT.openAddVehicle()">+ Add First Vehicle</button>
    </div>`;

    return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px">
      ${fleet.map(v => {
        const trips  = STRATIX_DB.getArr('trips').filter(t => t.vehicle === v.number);
        const vFreight = trips.reduce((s,t)=>s+Number(t.freight||0),0);
        const vCost    = trips.reduce((s,t)=>s+TR.tripCost(t),0);
        const vProfit  = vFreight - vCost;
        const expiryAlerts = [];
        if (v.registrationExpiry) { const d=TR.daysFrom(v.registrationExpiry); if(d!==null&&d<=30) expiryAlerts.push(`RC ${d<=0?'EXPIRED':d+'d'}`); }
        if (v.insuranceExpiry)    { const d=TR.daysFrom(v.insuranceExpiry);    if(d!==null&&d<=30) expiryAlerts.push(`Ins ${d<=0?'EXPIRED':d+'d'}`); }
        if (v.fitnessExpiry)      { const d=TR.daysFrom(v.fitnessExpiry);      if(d!==null&&d<=30) expiryAlerts.push(`Fit ${d<=0?'EXPIRED':d+'d'}`); }
        if (v.permitExpiry)       { const d=TR.daysFrom(v.permitExpiry);       if(d!==null&&d<=30) expiryAlerts.push(`Permit ${d<=0?'EXPIRED':d+'d'}`); }
        if (v.pucExpiry)          { const d=TR.daysFrom(v.pucExpiry);          if(d!==null&&d<=30) expiryAlerts.push(`PUC ${d<=0?'EXPIRED':d+'d'}`); }
        const statusColor = v.status==='active'?'var(--green)':v.status==='maintenance'?'var(--orange)':'var(--muted)';
        return `
        <div class="card" style="padding:16px;position:relative">
          ${expiryAlerts.length>0?`<div style="position:absolute;top:12px;right:12px;background:rgba(232,64,64,.15);border:1px solid rgba(232,64,64,.3);border-radius:8px;padding:3px 8px;font-size:10px;color:#e84040;font-weight:700">⚠️ ${expiryAlerts.join(' · ')}</div>`:''}
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:44px;height:44px;background:linear-gradient(135deg,rgba(37,99,235,.15),rgba(37,99,235,.05));border:1px solid rgba(37,99,235,.25);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px">🚛</div>
            <div>
              <div style="font-size:16px;font-weight:800;font-family:var(--head)">${escapeHTML(v.number)}</div>
              <div style="font-size:12px;color:var(--muted)">${escapeHTML(v.model||'—')}</div>
            </div>
            <div style="margin-left:auto">
              <select onchange="FLT.updateStatus('${v.id}',this.value)" style="padding:5px 8px;font-size:11px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:${statusColor};font-weight:700;cursor:pointer">
                <option value="active" ${v.status==='active'?'selected':''}>🟢 Active</option>
                <option value="idle" ${v.status==='idle'?'selected':''}>⚪ Idle</option>
                <option value="maintenance" ${v.status==='maintenance'?'selected':''}>🟠 Service</option>
              </select>
            </div>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <div style="font-size:12px">
              <span style="color:var(--muted)">Driver:</span>
              <strong style="margin-left:4px">${escapeHTML(v.driver||'—')}</strong>
            </div>
            <div style="font-size:12px">
              <span style="color:var(--muted)">km:</span>
              <strong style="margin-left:4px">${v.totalKm?Number(v.totalKm).toLocaleString('en-IN')+' km':'—'}</strong>
            </div>
            <div style="font-size:12px">
              <span style="color:var(--muted)">Trips:</span>
              <strong style="margin-left:4px">${trips.length}</strong>
            </div>
            <div style="font-size:12px">
              <span style="color:var(--muted)">Profit:</span>
              <strong style="margin-left:4px;color:${vProfit>=0?'var(--green)':'var(--red)'}">${vProfit>=0?'+':''}${TR.fmt(Math.abs(vProfit))}</strong>
            </div>
          </div>

          <div style="font-size:11px;color:var(--muted);margin-bottom:4px">Utilization</div>
          <div class="prog"><div class="prog-fill po" style="width:${v.utilization||0}%"></div></div>
          <div style="font-size:11px;color:var(--gold);margin-top:3px;font-weight:700">${v.utilization||0}%</div>

          <div style="display:flex;gap:8px;margin-top:12px">
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="FLT.openEditVehicle('${v.id}')">✏️ Edit</button>
            <button class="btn btn-ghost btn-sm" style="flex:1" onclick="FLT.openAddService('${v.id}')">🔧 Service</button>
            <button class="del-btn" onclick="FLT.deleteVehicle('${v.id}')">🗑</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  /* ── DOCUMENTS VAULT ── */
  _renderDocuments(fleet, sym) {
    if (fleet.length === 0) return `<div class="card" style="text-align:center;padding:40px 20px"><p style="color:var(--muted)">Add vehicles first to manage their documents.</p><button class="btn btn-gold" style="margin-top:12px" onclick="FLT.openAddVehicle()">+ Add Vehicle</button></div>`;

    const docFields = [
      { key:'registrationExpiry', label:'RC (Registration)',  icon:'📋' },
      { key:'insuranceExpiry',    label:'Insurance',          icon:'🛡️' },
      { key:'fitnessExpiry',      label:'Fitness Certificate',icon:'🔍' },
      { key:'permitExpiry',       label:'Permit',             icon:'📜' },
      { key:'pucExpiry',          label:'PUC Certificate',    icon:'🌱' },
    ];

    return `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Vehicle Document Vault</span>
        <span style="font-size:12px;color:var(--muted)">Click any date to update</span>
      </div>
      <div class="tbl-scroll"><table>
        <thead><tr>
          <th>Vehicle</th><th>Driver</th>
          ${docFields.map(d=>`<th>${d.icon} ${d.label}</th>`).join('')}
        </tr></thead>
        <tbody>
        ${fleet.map(v => {
          return `<tr>
            <td class="td-b">${escapeHTML(v.number)}</td>
            <td class="td-m">${escapeHTML(v.driver||'—')}</td>
            ${docFields.map(df => {
              const dateVal = v[df.key] || '';
              const days    = dateVal ? TR.daysFrom(dateVal) : null;
              let cellStyle = '';
              let badge     = '';
              if (!dateVal) {
                badge = `<span class="badge bm" style="cursor:pointer" onclick="FLT.updateDocDate('${v.id}','${df.key}')">+ Add</span>`;
              } else if (days === null || days < 0) {
                cellStyle = 'background:rgba(232,64,64,.08)';
                badge = `<span class="badge br" style="cursor:pointer" onclick="FLT.updateDocDate('${v.id}','${df.key}')">⛔ EXPIRED ${days!==null?Math.abs(days)+'d ago':''}</span>`;
              } else if (days <= 15) {
                cellStyle = 'background:rgba(232,64,64,.05)';
                badge = `<span class="badge br" style="cursor:pointer" onclick="FLT.updateDocDate('${v.id}','${df.key}')">🚨 ${days}d left</span>`;
              } else if (days <= 30) {
                cellStyle = 'background:rgba(37,99,235,.05)';
                badge = `<span class="badge bo" style="cursor:pointer" onclick="FLT.updateDocDate('${v.id}','${df.key}')">⚠️ ${days}d</span>`;
              } else {
                badge = `<span style="font-size:11px;color:var(--muted);cursor:pointer" onclick="FLT.updateDocDate('${v.id}','${df.key}')" title="Click to update">${TR.dateStr(dateVal)}</span>`;
              }
              return `<td style="${cellStyle}">${badge}</td>`;
            }).join('')}
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>

    <div class="card" style="margin-top:14px;padding:14px">
      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Quick Update: Select vehicle to update all document dates at once</div>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <select id="docUpdateVehicle" style="padding:8px 12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt);font-size:13px">
          <option value="">-- Select Vehicle --</option>
          ${fleet.map(v=>`<option value="${v.id}">${escapeHTML(v.number)}</option>`).join('')}
        </select>
        <button class="btn btn-gold btn-sm" onclick="FLT.openBulkDocUpdate()">📋 Update All Documents</button>
      </div>
    </div>`;
  },

  updateDocDate(vehicleId, field) {
    const fleet = STRATIX_DB.getArr('fleet');
    const v     = fleet.find(x => x.id === vehicleId);
    if (!v) return;
    const labels = { registrationExpiry:'RC Expiry', insuranceExpiry:'Insurance Expiry', fitnessExpiry:'Fitness Expiry', permitExpiry:'Permit Expiry', pucExpiry:'PUC Expiry' };
    const newDate = prompt(`Update ${labels[field] || field} for ${v.number}\nEnter new expiry date (YYYY-MM-DD):`, v[field] || '');
    if (newDate === null) return;
    if (newDate && !/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { NOTIFY.show('Use format YYYY-MM-DD','warning'); return; }
    STRATIX_DB.update('fleet', vehicleId, { [field]: newDate || null });
    NOTIFY.show('Document date updated!', 'success');
    this._tab('documents');
  },

  openBulkDocUpdate() {
    const vehicleId = document.getElementById('docUpdateVehicle')?.value;
    if (!vehicleId) { NOTIFY.show('Select a vehicle first','warning'); return; }
    this.openEditVehicle(vehicleId, 'documents');
  },

  /* ── SERVICE HISTORY ── */
  _renderServiceHistory(fleet, sym) {
    const allService = [];
    fleet.forEach(v => {
      (v.serviceHistory || []).forEach(s => {
        allService.push({ ...s, vehicleNum: v.number, vehicleId: v.id });
      });
    });
    allService.sort((a,b) => new Date(b.date) - new Date(a.date));

    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">➕ Log Service Entry</div>
      <div class="form-grid">
        <div class="field"><label>Vehicle *</label>
          <select id="svc_vehicle">
            <option value="">-- Select --</option>
            ${fleet.map(v=>`<option value="${v.id}">${escapeHTML(v.number)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Service Date *</label><input type="date" id="svc_date" value="${TR.today()}"/></div>
        <div class="field"><label>Service Type *</label>
          <select id="svc_type">
            ${['Oil Change','Tyre Change','Brake Service','Engine Tune-up','AC Repair','Body Repair',
               'Electrical Repair','Battery Replace','Wheel Alignment','Annual Service',
               'Registration Renewal','Insurance Renewal','Fitness Renewal','Permit Renewal','PUC Renewal','Other'].map(t=>`<option>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Service Cost (${sym}) *</label><input type="number" id="svc_cost" placeholder="2500"/></div>
        <div class="field"><label>Odometer (km)</label><input id="svc_odo" placeholder="52000" type="number"/></div>
        <div class="field"><label>Garage / Workshop</label><input id="svc_garage" placeholder="Tata Authorised, NH-8"/></div>
        <div class="field"><label>Next Service Date</label><input type="date" id="svc_next"/></div>
        <div class="field"><label>Bill No.</label><input id="svc_bill" placeholder="BILL-001"/></div>
      </div>
      <div class="field" style="margin-top:8px"><label>Remarks</label><input id="svc_notes" placeholder="Any additional notes"/></div>
      <button class="btn btn-gold" style="margin-top:14px" onclick="FLT.saveService()">💾 Save Service Entry</button>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Service History (${allService.length} entries)</span></div>
      ${allService.length === 0 ? `<div style="padding:28px;text-align:center;color:var(--muted)">No service entries yet. Log your first service above.</div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Vehicle</th><th>Service Type</th><th>Cost</th><th>Odometer</th><th>Garage</th><th>Next Service</th><th>Bill</th><th></th></tr></thead>
        <tbody>
        ${allService.map(s => `<tr>
          <td class="td-m">${TR.dateStr(s.date)}</td>
          <td class="td-b">${escapeHTML(s.vehicleNum)}</td>
          <td>${escapeHTML(s.type)}</td>
          <td class="td-r">${TR.fmt(s.cost||0)}</td>
          <td class="td-m">${s.odometer?Number(s.odometer).toLocaleString('en-IN')+' km':'—'}</td>
          <td class="td-m">${escapeHTML(s.garage||'—')}</td>
          <td class="td-m">${s.nextDate?TR.dateStr(s.nextDate)+'<br/><span style="font-size:10px;color:'+( TR.daysFrom(s.nextDate)!==null&&TR.daysFrom(s.nextDate)<=30?'var(--orange)':'var(--muted)')+'">'+( TR.daysFrom(s.nextDate)!==null?TR.daysFrom(s.nextDate)+'d away':'')+'</span>':'—'}</td>
          <td class="td-m">${escapeHTML(s.billNo||'—')}</td>
          <td><button class="del-btn" onclick="FLT.deleteService('${s.vehicleId}','${s.id}')">🗑</button></td>
        </tr>`).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  },

  saveService() {
    const vehicleId = document.getElementById('svc_vehicle')?.value;
    const date      = document.getElementById('svc_date')?.value;
    const type      = document.getElementById('svc_type')?.value;
    const cost      = +document.getElementById('svc_cost')?.value||0;
    if (!vehicleId) { NOTIFY.show('Select a vehicle','warning'); return; }
    if (!date)      { NOTIFY.show('Enter service date','warning'); return; }

    const entry = {
      id:       Date.now().toString(36) + Math.random().toString(36).slice(2,4),
      date, type, cost,
      odometer: +document.getElementById('svc_odo')?.value||null,
      garage:   document.getElementById('svc_garage')?.value.trim()||'',
      nextDate: document.getElementById('svc_next')?.value||null,
      billNo:   document.getElementById('svc_bill')?.value.trim()||'',
      notes:    document.getElementById('svc_notes')?.value.trim()||''
    };

    const fleet = STRATIX_DB.getArr('fleet');
    const vIdx  = fleet.findIndex(v => v.id === vehicleId);
    if (vIdx === -1) { NOTIFY.show('Vehicle not found','error'); return; }

    fleet[vIdx].serviceHistory = fleet[vIdx].serviceHistory || [];
    fleet[vIdx].serviceHistory.push(entry);
    fleet[vIdx].lastService = date;
    if (entry.nextDate) fleet[vIdx].nextService = entry.nextDate;
    if (entry.odometer) fleet[vIdx].totalKm = Math.max(fleet[vIdx].totalKm||0, entry.odometer);

    STRATIX_DB.set('fleet', fleet);

    // Also log as expense
    if (cost > 0) {
      const v = fleet[vIdx];
      STRATIX_DB.push('transactions', {
        type:'expense', amount:cost, category:'maintenance',
        description:`Service: ${type} — ${v.number}`, date
      });
    }

    NOTIFY.show('Service entry saved!', 'success');
    this._tab('service');
  },

  deleteService(vehicleId, serviceId) {
    if (!confirm('Delete this service entry?')) return;
    const fleet = STRATIX_DB.getArr('fleet');
    const vIdx  = fleet.findIndex(v => v.id === vehicleId);
    if (vIdx === -1) return;
    fleet[vIdx].serviceHistory = (fleet[vIdx].serviceHistory||[]).filter(s => s.id !== serviceId);
    STRATIX_DB.set('fleet', fleet);
    NOTIFY.show('Deleted', 'info');
    this._tab('service');
  },

  /* ── PERFORMANCE ── */
  _renderPerformance(fleet, sym) {
    if (fleet.length === 0) return `<div class="card" style="text-align:center;padding:40px 20px"><p style="color:var(--muted)">Add vehicles first.</p></div>`;
    const trips = STRATIX_DB.getArr('trips');

    return `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px">
    ${fleet.map(v => {
      const vTrips   = trips.filter(t => t.vehicle === v.number);
      const vFreight = vTrips.reduce((s,t)=>s+Number(t.freight||0),0);
      const vCost    = vTrips.reduce((s,t)=>s+TR.tripCost(t),0);
      const vFuel    = vTrips.reduce((s,t)=>s+Number(t.fuel||0),0);
      const vKm      = vTrips.reduce((s,t)=>s+Number(t.distanceKm||0),0);
      const vProfit  = vFreight - vCost;
      const margin   = vFreight > 0 ? ((vProfit/vFreight)*100).toFixed(1) : 0;
      const fuelEff  = vKm > 0 && vFuel > 0 ? (vKm / (vFuel/102)).toFixed(1) : '—'; // approx @ ₹102/L
      const servCost = (v.serviceHistory||[]).reduce((s,e)=>s+(e.cost||0),0);
      const totalCTC = vCost + servCost;
      const trueMargin = vFreight > 0 ? (((vFreight-totalCTC)/vFreight)*100).toFixed(1) : 0;

      return `
      <div class="card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
          <div style="font-size:22px">🚛</div>
          <div>
            <div style="font-size:15px;font-weight:800;font-family:var(--head)">${escapeHTML(v.number)}</div>
            <div style="font-size:11px;color:var(--muted)">${escapeHTML(v.model||'—')} · ${escapeHTML(v.driver||'—')}</div>
          </div>
          <span class="badge ${v.status==='active'?'bg':v.status==='maintenance'?'bo':'bm'}" style="margin-left:auto">${v.status}</span>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div style="background:var(--s2);padding:8px;border-radius:8px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Trips</div>
            <div style="font-size:18px;font-weight:800">${vTrips.length}</div>
          </div>
          <div style="background:var(--s2);padding:8px;border-radius:8px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Total km</div>
            <div style="font-size:16px;font-weight:800">${vKm>0?vKm.toLocaleString('en-IN'):v.totalKm?Number(v.totalKm).toLocaleString('en-IN'):'—'}</div>
          </div>
          <div style="background:rgba(0,214,143,.07);padding:8px;border-radius:8px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Freight</div>
            <div style="font-size:15px;font-weight:800;color:var(--green)">${TR.fmt(vFreight)}</div>
          </div>
          <div style="background:rgba(232,64,64,.07);padding:8px;border-radius:8px;text-align:center">
            <div style="font-size:10px;color:var(--muted)">Trip Cost</div>
            <div style="font-size:15px;font-weight:800;color:var(--red)">${TR.fmt(vCost)}</div>
          </div>
        </div>

        <div style="border-top:1px solid var(--b1);padding-top:10px">
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:12px;color:var(--muted)">Trip Margin</span>
            <span style="font-size:12px;font-weight:700;color:${Number(margin)>=15?'var(--green)':Number(margin)>=5?'var(--gold)':'var(--red)'}">${margin}%</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:12px;color:var(--muted)">Service Cost</span>
            <span style="font-size:12px;font-weight:700;color:var(--orange)">${TR.fmt(servCost)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:5px">
            <span style="font-size:12px;color:var(--muted)">True Margin (incl. service)</span>
            <span style="font-size:12px;font-weight:700;color:${Number(trueMargin)>=12?'var(--green)':Number(trueMargin)>=3?'var(--gold)':'var(--red)'}">${trueMargin}%</span>
          </div>
          ${fuelEff !== '—' ? `<div style="display:flex;justify-content:space-between">
            <span style="font-size:12px;color:var(--muted)">Fuel Efficiency</span>
            <span style="font-size:12px;font-weight:700">~${fuelEff} km/L</span>
          </div>` : ''}
        </div>
      </div>`;
    }).join('')}
    </div>`;
  },

  /* ── ADD / EDIT VEHICLE MODAL ── */
  openAddVehicle() {
    this._openVehicleModal(null);
  },

  openEditVehicle(id) {
    this._openVehicleModal(id);
  },

  _openVehicleModal(id) {
    const fleet = STRATIX_DB.getArr('fleet');
    const v     = id ? (fleet.find(x => x.id === id) || {}) : {};
    const sym   = TR.sym();
    const today = TR.today();

    const modalEl = document.getElementById('fleetModal');
    modalEl.innerHTML = TR.modal('fleetVehicleModal', id ? `✏️ Edit Vehicle — ${v.number||''}` : '🚛 Add New Vehicle', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Vehicle Number *</label><input id="fv_num" value="${escapeHTML(v.number||'')}" placeholder="MH12AB1234" style="text-transform:uppercase"/></div>
        <div class="field"><label>Vehicle Model</label><input id="fv_model" value="${escapeHTML(v.model||'')}" placeholder="Tata 407 / Ashok Leyland 1615"/></div>
        <div class="field"><label>Driver Name</label><input id="fv_driver" value="${escapeHTML(v.driver||'')}" placeholder="Driver name"/></div>
        <div class="field"><label>Driver Phone</label><input id="fv_driver_phone" value="${escapeHTML(v.driverPhone||'')}" placeholder="+91 9876543210"/></div>
        <div class="field"><label>Fuel Type</label>
          <select id="fv_fuel_type">
            ${['Diesel','Petrol','CNG','Electric'].map(f=>`<option ${v.fuelType===f?'selected':''}>${f}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Status</label>
          <select id="fv_status">
            <option value="active" ${v.status==='active'?'selected':''}>Active</option>
            <option value="idle" ${v.status==='idle'?'selected':''}>Idle</option>
            <option value="maintenance" ${v.status==='maintenance'?'selected':''}>Maintenance</option>
          </select>
        </div>
        <div class="field"><label>Purchase Date</label><input type="date" id="fv_purchase" value="${v.purchaseDate||''}"/></div>
        <div class="field"><label>Current Odometer (km)</label><input type="number" id="fv_km" value="${v.totalKm||''}" placeholder="0"/></div>
      </div>

      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--b1)">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">📋 Document Expiry Dates</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field"><label>RC / Registration Expiry</label><input type="date" id="fv_rc" value="${v.registrationExpiry||''}"/></div>
          <div class="field"><label>Insurance Expiry</label><input type="date" id="fv_ins" value="${v.insuranceExpiry||''}"/></div>
          <div class="field"><label>Fitness Certificate Expiry</label><input type="date" id="fv_fit" value="${v.fitnessExpiry||''}"/></div>
          <div class="field"><label>Permit Expiry</label><input type="date" id="fv_permit" value="${v.permitExpiry||''}"/></div>
          <div class="field"><label>PUC Certificate Expiry</label><input type="date" id="fv_puc" value="${v.pucExpiry||''}"/></div>
        </div>
      </div>

      <button class="btn btn-gold btn-full" style="margin-top:16px" onclick="FLT.saveVehicle('${id||''}')">💾 ${id?'Update Vehicle':'Add Vehicle'}</button>
    `, true);
  },

  saveVehicle(id) {
    const num = document.getElementById('fv_num')?.value.trim().toUpperCase();
    if (!num) { NOTIFY.show('Vehicle number is required','warning'); return; }

    const data = {
      number:              num,
      model:               document.getElementById('fv_model')?.value.trim()||'—',
      driver:              document.getElementById('fv_driver')?.value.trim()||'—',
      driverPhone:         document.getElementById('fv_driver_phone')?.value.trim()||'',
      fuelType:            document.getElementById('fv_fuel_type')?.value||'Diesel',
      status:              document.getElementById('fv_status')?.value||'active',
      purchaseDate:        document.getElementById('fv_purchase')?.value||null,
      totalKm:             +document.getElementById('fv_km')?.value||0,
      registrationExpiry:  document.getElementById('fv_rc')?.value||null,
      insuranceExpiry:     document.getElementById('fv_ins')?.value||null,
      fitnessExpiry:       document.getElementById('fv_fit')?.value||null,
      permitExpiry:        document.getElementById('fv_permit')?.value||null,
      pucExpiry:           document.getElementById('fv_puc')?.value||null,
    };

    if (id) {
      STRATIX_DB.update('fleet', id, data);
      NOTIFY.show(`${num} updated!`, 'success');
    } else {
      // Check duplicate
      const existing = STRATIX_DB.getArr('fleet');
      if (existing.find(v => v.number === num)) { NOTIFY.show('Vehicle '+num+' already exists','warning'); return; }
      STRATIX_DB.push('fleet', { ...data, utilization:0, revenue:0, cost:0, serviceHistory:[] });
      NOTIFY.show(`Vehicle ${num} added!`, 'success');
    }

    document.getElementById('fleetVehicleModal')?.remove();
    renderFleet('vehicles');
  },

  updateStatus(id, status) {
    STRATIX_DB.update('fleet', id, { status });
    NOTIFY.show('Status updated', 'success');
  },

  deleteVehicle(id) {
    const v = STRATIX_DB.getArr('fleet').find(x=>x.id===id);
    if (!confirm(`Delete vehicle ${v?.number}? This cannot be undone.`)) return;
    STRATIX_DB.remove('fleet', id);
    NOTIFY.show('Vehicle deleted', 'info');
    renderFleet('vehicles');
  },

  openAddService(vehicleId) {
    // Switch to service tab and pre-select the vehicle
    this._tab('service');
    setTimeout(() => {
      const sel = document.getElementById('svc_vehicle');
      if (sel) sel.value = vehicleId;
    }, 100);
  }
};


/* ══════════════════════════════════════════════════════════════
   4.  TRANSPORT CRM — CLIENTS & CONSIGNORS (DEEP)
       Tabs: Clients | Invoice Aging | Consignors | Contacts
   ══════════════════════════════════════════════════════════════ */
function renderTransportCRM(activeTab) {
  activeTab = activeTab || 'clients';
  const clients = STRATIX_DB.getArr('clients');
  const sym     = TR.sym();

  const totalOutstanding = clients.reduce((s,c) => s + Number(c.outstanding||0), 0);
  const highRisk         = clients.filter(c => c.risk === 'high' || c.risk === 'critical').length;
  const totalBiz         = clients.reduce((s,c) => s + Number(c.totalBusiness||0), 0);
  const overLimit        = clients.filter(c => Number(c.outstanding||0) > Number(c.creditLimit||0) && Number(c.creditLimit||0) > 0).length;

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">🤝 Clients & Consignors</h1>
        <p class="sec-sub">Client master · Invoice aging · Credit limits · WhatsApp reminders</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="TCRM.openAddClient()">+ Add Client</button>
        <button class="btn btn-ghost btn-sm" onclick="TCRM.exportCSV()">📥 Export</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      <div class="kpi accent"><div class="kpi-lbl">Total Outstanding</div><div class="kpi-val">${TR.fmt(totalOutstanding)}</div><div class="kpi-trend">${clients.filter(c=>Number(c.outstanding||0)>0).length} clients</div></div>
      <div class="kpi"><div class="kpi-lbl">High Risk Clients</div><div class="kpi-val ${highRisk>0?'red':''}">${highRisk}</div><div class="kpi-trend ${highRisk>0?'down':'up'}">${highRisk>0?'Need immediate action':'All low risk'}</div></div>
      <div class="kpi"><div class="kpi-lbl">Over Credit Limit</div><div class="kpi-val ${overLimit>0?'orange':''}">${overLimit}</div><div class="kpi-trend muted">Credit exceeded</div></div>
      <div class="kpi"><div class="kpi-lbl">Total Business</div><div class="kpi-val">${TR.fmt(totalBiz)}</div><div class="kpi-trend">${clients.length} clients</div></div>
    </div>

    <div class="calc-tabs" style="margin-bottom:16px">
      <button class="calc-tab${activeTab==='clients'?' active':''}" data-crmtab="clients" onclick="TCRM._tab('clients')">👥 All Clients</button>
      <button class="calc-tab${activeTab==='aging'?' active':''}" data-crmtab="aging" onclick="TCRM._tab('aging')">⏳ Invoice Aging</button>
      <button class="calc-tab${activeTab==='ledger'?' active':''}" data-crmtab="ledger" onclick="TCRM._tab('ledger')">📒 Party Ledger</button>
    </div>

    <div id="crmTabContent">${TCRM._renderTab(activeTab, clients, sym)}</div>
    <div id="tCrmModal"></div>
  </div>`;
}

const TCRM = {
  _tab(tab) {
    const clients = STRATIX_DB.getArr('clients');
    const sym     = TR.sym();
    document.querySelectorAll('[data-crmtab]').forEach(b => b.classList.toggle('active', b.dataset.crmtab === tab));
    const el = document.getElementById('crmTabContent');
    if (el) el.innerHTML = this._renderTab(tab, clients, sym);
  },

  _renderTab(tab, clients, sym) {
    if (tab === 'clients') return this._renderClients(clients, sym);
    if (tab === 'aging')   return this._renderAging(clients, sym);
    if (tab === 'ledger')  return this._renderLedger(clients, sym);
    return '';
  },

  /* ── ALL CLIENTS ── */
  _renderClients(clients, sym) {
    if (clients.length === 0) return `<div class="card" style="text-align:center;padding:56px 20px">
      <div style="font-size:48px;margin-bottom:14px">🤝</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No Clients Added</h3>
      <p style="color:var(--muted);max-width:300px;margin:0 auto 20px">Add your consignors, consignees and freight clients to track outstanding payments.</p>
      <button class="btn btn-gold" onclick="TCRM.openAddClient()">+ Add First Client</button>
    </div>`;

    const sorted = [...clients].sort((a,b) => Number(b.outstanding||0) - Number(a.outstanding||0));

    return `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Client Master (${clients.length})</span>
        <div style="display:flex;gap:8px">
          <select onchange="TCRM._filterClients(this.value)" style="padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt)">
            <option value="all">All Clients</option>
            <option value="outstanding">Has Outstanding</option>
            <option value="high">High Risk</option>
            <option value="overlimit">Over Credit Limit</option>
          </select>
          <button class="btn btn-gold btn-sm" onclick="TCRM.openAddClient()">+ Add</button>
        </div>
      </div>
      <div id="clientsTable">
        ${this._renderClientRows(sorted, sym)}
      </div>
    </div>`;
  },

  _renderClientRows(clients, sym) {
    if (clients.length === 0) return `<div style="padding:24px;text-align:center;color:var(--muted)">No clients match this filter.</div>`;
    return `<div class="tbl-scroll"><table>
      <thead><tr><th>Client</th><th>City</th><th>GST No.</th><th>Invoices</th><th>Total Business</th><th>Outstanding</th><th>Credit Limit</th><th>Last Payment</th><th>Risk</th><th>Actions</th></tr></thead>
      <tbody>
      ${clients.map(c => {
        const outstanding = Number(c.outstanding||0);
        const creditLimit = Number(c.creditLimit||0);
        const isOverLimit = creditLimit > 0 && outstanding > creditLimit;
        const riskBadge   = c.risk==='high'||c.risk==='critical' ? 'br' : c.risk==='medium' ? 'bo' : 'bg';
        return `<tr>
          <td>
            <div class="td-b">${escapeHTML(c.name)}</div>
            ${c.phone?`<div style="font-size:11px;color:var(--muted)">${escapeHTML(c.phone)}</div>`:''}
          </td>
          <td class="td-m">${escapeHTML(c.city||'—')}</td>
          <td class="td-m" style="font-family:monospace;font-size:11px">${escapeHTML(c.gstNumber||'—')}</td>
          <td>${Number(c.invoices||0)}</td>
          <td class="td-g">${TR.fmt(c.totalBusiness||0)}</td>
          <td>
            <div style="font-weight:700;color:${outstanding>0?'var(--red)':'var(--green)'}">${TR.fmt(outstanding)}</div>
            ${isOverLimit?`<div style="font-size:10px;color:var(--orange);font-weight:700">⚠️ Over limit</div>`:''}
          </td>
          <td class="td-m">${creditLimit>0?TR.fmt(creditLimit):'—'}</td>
          <td class="td-m">${TR.dateStr(c.lastPayment)}</td>
          <td><span class="badge ${riskBadge}">${c.risk||'low'}</span></td>
          <td>
            <div style="display:flex;gap:4px;flex-wrap:wrap">
              ${outstanding>0&&c.phone?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="TCRM.sendReminder('${c.id}')">📱 Remind</button>`:''}
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="TCRM.openAddPayment('${c.id}')">💰 Pay</button>
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="TCRM.openEditClient('${c.id}')">✏️</button>
              <button class="del-btn" onclick="TCRM.deleteClient('${c.id}')">🗑</button>
            </div>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>`;
  },

  _filterClients(filter) {
    const clients = STRATIX_DB.getArr('clients');
    let filtered  = clients;
    if (filter === 'outstanding') filtered = clients.filter(c=>Number(c.outstanding||0)>0);
    if (filter === 'high')        filtered = clients.filter(c=>c.risk==='high'||c.risk==='critical');
    if (filter === 'overlimit')   filtered = clients.filter(c=>Number(c.outstanding||0)>Number(c.creditLimit||0)&&Number(c.creditLimit||0)>0);
    const el = document.getElementById('clientsTable');
    if (el) el.innerHTML = this._renderClientRows(filtered, TR.sym());
  },

  /* ── INVOICE AGING ── */
  _renderAging(clients, sym) {
    const now = new Date();
    // Build aging buckets — based on actual unpaid trips per client
    const trips    = STRATIX_DB.getArr('trips');
    const invoices = STRATIX_DB.getArr('invoices');

    // Bucket by outstanding amount vs age of last invoice
    const buckets = { '0-30':[], '31-60':[], '61-90':[], '90+':[] };
    clients.filter(c=>Number(c.outstanding||0)>0).forEach(c => {
      // Try to find last unpaid trip age for this client
      const clientTrips = trips.filter(t => t.clientId===c.id && (!t.paymentStatus||t.paymentStatus!=='paid'));
      let age = 0;
      if (clientTrips.length > 0) {
        const oldest = clientTrips.reduce((oldest, t) => new Date(t.date||t.createdAt) < new Date(oldest.date||oldest.createdAt) ? t : oldest);
        age = TR.daysAgo(oldest.date || oldest.createdAt) || 0;
      } else if (c.lastPayment) {
        age = TR.daysAgo(c.lastPayment) || 0;
      }

      const data = { ...c, ageDays: age, bucket: TR.ageBucket(age) };
      if (age <= 30)       buckets['0-30'].push(data);
      else if (age <= 60)  buckets['31-60'].push(data);
      else if (age <= 90)  buckets['61-90'].push(data);
      else                 buckets['90+'].push(data);
    });

    const bucketConfig = [
      { key:'0-30',  label:'0–30 Days',  color:'var(--green)',  bg:'rgba(0,214,143,.08)',  border:'rgba(0,214,143,.25)' },
      { key:'31-60', label:'31–60 Days', color:'var(--gold)',   bg:'rgba(37,99,235,.08)',  border:'rgba(37,99,235,.25)' },
      { key:'61-90', label:'61–90 Days', color:'var(--orange)', bg:'rgba(255,102,0,.08)',  border:'rgba(255,102,0,.25)' },
      { key:'90+',   label:'90+ Days',   color:'var(--red)',    bg:'rgba(232,64,64,.08)',  border:'rgba(232,64,64,.25)' },
    ];

    const totalOutstanding = clients.reduce((s,c)=>s+Number(c.outstanding||0),0);

    return `
    <!-- Aging Buckets -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px">
      ${bucketConfig.map(b => {
        const bClients = buckets[b.key];
        const bTotal   = bClients.reduce((s,c)=>s+Number(c.outstanding||0),0);
        const pct      = totalOutstanding > 0 ? ((bTotal/totalOutstanding)*100).toFixed(0) : 0;
        return `<div style="background:${b.bg};border:1px solid ${b.border};border-radius:14px;padding:16px">
          <div style="font-size:11px;font-weight:700;color:${b.color};text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">${b.label}</div>
          <div style="font-size:22px;font-weight:800;color:${b.color};font-family:var(--head)">${TR.fmt(bTotal)}</div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">${bClients.length} client${bClients.length!==1?'s':''} · ${pct}% of dues</div>
        </div>`;
      }).join('')}
    </div>

    <!-- Detailed aging table -->
    ${clients.filter(c=>Number(c.outstanding||0)>0).length === 0 ? `
    <div class="card" style="text-align:center;padding:36px 20px">
      <div style="font-size:32px;margin-bottom:10px">✅</div>
      <h3 style="color:var(--green)">No Outstanding Dues!</h3>
      <p style="color:var(--muted);margin-top:6px">All clients have paid their dues.</p>
    </div>` : `
    <div class="tbl-wrap">
      <div class="tbl-head">
        <span class="tbl-title">Outstanding by Client</span>
        <button class="btn btn-ghost btn-sm" onclick="TCRM.sendBulkReminders()">📱 Send All Reminders</button>
      </div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Client</th><th>Outstanding</th><th>Age (days)</th><th>Bucket</th><th>Credit Limit</th><th>Trips Due</th><th>Last Payment</th><th>Action</th></tr></thead>
        <tbody>
        ${Object.entries(buckets).flatMap(([,items]) => items)
          .sort((a,b) => b.ageDays - a.ageDays)
          .map(c => {
          const outstanding = Number(c.outstanding||0);
          const creditLimit = Number(c.creditLimit||0);
          const isOverLimit = creditLimit > 0 && outstanding > creditLimit;
          const tripsDue = trips.filter(t => t.clientId===c.id && (!t.paymentStatus||t.paymentStatus!=='paid')).length;
          const waMsg = `Dear ${c.name},\n\nPayment reminder:\nOutstanding: ${sym}${outstanding.toLocaleString('en-IN')}\nAge: ${c.ageDays} days\n\nKindly arrange payment.\n\n${TR.biz()}`;
          const waLink = TR.waUrl(c.phone, waMsg);
          return `<tr>
            <td>
              <div class="td-b">${escapeHTML(c.name)}</div>
              ${c.phone?`<div style="font-size:10px;color:var(--muted)">${escapeHTML(c.phone)}</div>`:''}
            </td>
            <td>
              <div style="font-weight:800;color:var(--red);font-size:14px">${TR.fmt(outstanding)}</div>
              ${isOverLimit?`<div style="font-size:10px;color:var(--orange);font-weight:700">Over limit by ${TR.fmt(outstanding-creditLimit)}</div>`:''}
            </td>
            <td style="color:${c.ageDays>90?'var(--red)':c.ageDays>60?'var(--orange)':'var(--muted)'};font-weight:700">${c.ageDays}d</td>
            <td><span class="badge ${c.bucket.cls}">${c.bucket.label}</span></td>
            <td class="td-m">${creditLimit>0?TR.fmt(creditLimit):'No limit'}</td>
            <td class="td-m" style="color:${tripsDue>0?'var(--orange)':'var(--muted)'}">${tripsDue} trip${tripsDue!==1?'s':''}</td>
            <td class="td-m">${TR.dateStr(c.lastPayment)}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn btn-green btn-sm" style="font-size:10px;padding:3px 8px" onclick="TCRM.openAddPayment('${c.id}')">💰 Collect</button>
                ${waLink?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="window.open('${waLink}','_blank')">📱 WA</button>`:''}
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`}`;
  },

  /* ── PARTY LEDGER ── */
  _renderLedger(clients, sym) {
    if (clients.length === 0) return `<div class="card" style="text-align:center;padding:40px 20px"><p style="color:var(--muted)">Add clients to see their ledger.</p></div>`;

    return `
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">📒 Select Client for Ledger View</div>
      <div style="display:flex;gap:10px;align-items:center">
        <select id="ledgerClientSel" onchange="TCRM._showLedger(this.value)" style="flex:1;padding:10px 14px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt);font-size:13px">
          <option value="">-- Select Client --</option>
          ${clients.map(c=>`<option value="${c.id}">${escapeHTML(c.name)}${c.city?' ('+escapeHTML(c.city)+')':''}${Number(c.outstanding||0)>0?' — Due: '+TR.fmt(c.outstanding):''}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="ledgerContent">
      <div style="text-align:center;padding:28px;color:var(--muted);font-size:13px">Select a client above to view their full ledger</div>
    </div>`;
  },

  _showLedger(clientId) {
    if (!clientId) return;
    const client = STRATIX_DB.getArr('clients').find(c=>c.id===clientId);
    if (!client) return;
    const trips  = STRATIX_DB.getArr('trips').filter(t=>t.clientId===clientId);
    const sym    = TR.sym();

    const totalFreight    = trips.reduce((s,t)=>s+Number(t.freight||0),0);
    const totalCollected  = trips.reduce((s,t)=>s+Number(t.advance||0)+(t.paymentStatus==='paid'?Number(t.freight||0)-Number(t.advance||0):0),0);
    const outstanding     = Math.max(0, totalFreight - totalCollected);

    document.getElementById('ledgerContent').innerHTML = `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <div style="font-size:18px;font-weight:800">${escapeHTML(client.name)}</div>
          <div style="font-size:12px;color:var(--muted)">${escapeHTML(client.city||'')}${client.gstNumber?' · GST: '+escapeHTML(client.gstNumber):''}</div>
        </div>
        <div style="display:flex;gap:10px">
          ${client.phone&&outstanding>0?`<button class="btn btn-ghost btn-sm" onclick="TCRM.sendReminder('${client.id}')">📱 Send Reminder</button>`:''}
          ${outstanding>0?`<button class="btn btn-gold btn-sm" onclick="TCRM.openAddPayment('${client.id}')">💰 Record Payment</button>`:''}
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
        <div style="background:var(--s2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">Total Trips</div>
          <div style="font-size:18px;font-weight:800">${trips.length}</div>
        </div>
        <div style="background:rgba(0,214,143,.07);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">Total Freight</div>
          <div style="font-size:16px;font-weight:800;color:var(--green)">${TR.fmt(totalFreight)}</div>
        </div>
        <div style="background:rgba(79,126,240,.07);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">Collected</div>
          <div style="font-size:16px;font-weight:800;color:var(--blue)">${TR.fmt(totalCollected)}</div>
        </div>
        <div style="background:rgba(232,64,64,.07);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">Outstanding</div>
          <div style="font-size:16px;font-weight:800;color:var(--red)">${TR.fmt(outstanding)}</div>
        </div>
      </div>

      ${trips.length === 0 ? `<div style="text-align:center;padding:20px;color:var(--muted)">No trips recorded for this client.</div>` : `
      <div class="tbl-scroll"><table>
        <thead><tr><th>Date</th><th>Route</th><th>Vehicle</th><th>LR No.</th><th>Freight</th><th>Advance</th><th>Balance</th><th>Status</th></tr></thead>
        <tbody>
        ${[...trips].sort((a,b)=>new Date(a.date||a.createdAt)-new Date(b.date||b.createdAt)).map(t => {
          const balance = Number(t.freight||0) - Number(t.advance||0);
          const payStatus = t.paymentStatus || 'pending';
          return `<tr>
            <td class="td-m">${TR.dateStr(t.date)}</td>
            <td class="td-b">${escapeHTML(t.route||'—')}</td>
            <td class="td-m">${escapeHTML(t.vehicle||'—')}</td>
            <td class="td-m" style="font-size:11px">${escapeHTML(t.lrNumber||'—')}</td>
            <td class="td-g">${TR.fmt(t.freight||0)}</td>
            <td class="td-m">${t.advance>0?TR.fmt(t.advance):'—'}</td>
            <td class="${balance>0?'td-r':'td-g'}">${balance>0?TR.fmt(balance):'Nil'}</td>
            <td>${payStatus==='paid'?'<span class="badge bg">Paid</span>':payStatus==='partial'?'<span class="badge bo">Partial</span>':'<span class="badge br">Pending</span>'}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>`}
    </div>`;
  },

  /* ── ADD / EDIT CLIENT ── */
  openAddClient() { this._openClientModal(null); },
  openEditClient(id) { this._openClientModal(id); },

  _openClientModal(id) {
    const clients = STRATIX_DB.getArr('clients');
    const c       = id ? (clients.find(x=>x.id===id)||{}) : {};

    document.getElementById('tCrmModal').innerHTML = TR.modal('clientModal', id?'✏️ Edit Client':'➕ Add Client', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Client Name *</label><input id="cl_name" value="${escapeHTML(c.name||'')}" placeholder="Company / Person name"/></div>
        <div class="field"><label>City</label><input id="cl_city" value="${escapeHTML(c.city||'')}" placeholder="Mumbai"/></div>
        <div class="field"><label>Phone / WhatsApp</label><input id="cl_phone" value="${escapeHTML(c.phone||'')}" placeholder="+91 9876543210"/></div>
        <div class="field"><label>GST Number</label><input id="cl_gst" value="${escapeHTML(c.gstNumber||'')}" placeholder="27AABCT1332L1ZT" style="text-transform:uppercase"/></div>
        <div class="field"><label>Client Type</label>
          <select id="cl_type">
            ${['Consignor','Consignee','Both','Freight Broker','Transport Company','Other'].map(t=>`<option ${c.type===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Risk Level</label>
          <select id="cl_risk">
            ${['low','medium','high','critical'].map(r=>`<option ${(c.risk||'low')===r?'selected':''}>${r}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Credit Limit (${TR.sym()})</label><input type="number" id="cl_limit" value="${c.creditLimit||''}" placeholder="100000"/></div>
        <div class="field"><label>Current Outstanding</label><input type="number" id="cl_outstanding" value="${c.outstanding||0}" placeholder="0"/></div>
        <div class="field"><label>No. of Invoices</label><input type="number" id="cl_inv" value="${c.invoices||0}" placeholder="0"/></div>
        <div class="field"><label>Total Business (${TR.sym()})</label><input type="number" id="cl_total" value="${c.totalBusiness||0}" placeholder="0"/></div>
        <div class="field"><label>Last Payment Date</label><input type="date" id="cl_lastpay" value="${c.lastPayment||''}"/></div>
        <div class="field"><label>Address</label><input id="cl_addr" value="${escapeHTML(c.address||'')}" placeholder="Full address"/></div>
      </div>
      <div class="field" style="margin-top:8px"><label>Notes</label><input id="cl_notes" value="${escapeHTML(c.notes||'')}" placeholder="Any notes about this client"/></div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="TCRM.saveClient('${id||''}')">💾 ${id?'Update':'Save'} Client</button>
    `, true);
  },

  saveClient(id) {
    const name = document.getElementById('cl_name')?.value.trim();
    if (!name) { NOTIFY.show('Enter client name','warning'); return; }
    const data = {
      name,
      city:         document.getElementById('cl_city')?.value.trim()||'',
      phone:        document.getElementById('cl_phone')?.value.trim()||'',
      gstNumber:    document.getElementById('cl_gst')?.value.trim().toUpperCase()||'',
      type:         document.getElementById('cl_type')?.value||'Consignor',
      risk:         document.getElementById('cl_risk')?.value||'low',
      creditLimit:  +document.getElementById('cl_limit')?.value||0,
      outstanding:  +document.getElementById('cl_outstanding')?.value||0,
      invoices:     +document.getElementById('cl_inv')?.value||0,
      totalBusiness:+document.getElementById('cl_total')?.value||0,
      lastPayment:  document.getElementById('cl_lastpay')?.value||null,
      address:      document.getElementById('cl_addr')?.value.trim()||'',
      notes:        document.getElementById('cl_notes')?.value.trim()||''
    };
    if (id) { STRATIX_DB.update('clients',id,data); NOTIFY.show('Client updated!','success'); }
    else    { STRATIX_DB.push('clients',data);       NOTIFY.show('Client added!','success'); }
    document.getElementById('clientModal')?.remove();
    renderTransportCRM('clients');
  },

  deleteClient(id) {
    const c = STRATIX_DB.getArr('clients').find(x=>x.id===id);
    if (!confirm(`Delete client "${c?.name}"?`)) return;
    STRATIX_DB.remove('clients',id);
    NOTIFY.show('Client deleted','info');
    renderTransportCRM('clients');
  },

  openAddPayment(clientId) {
    const client = STRATIX_DB.getArr('clients').find(c=>c.id===clientId);
    if (!client) return;
    const sym    = TR.sym();
    document.getElementById('tCrmModal').innerHTML = TR.modal('paymentModal', `💰 Record Payment — ${client.name}`, `
      <div style="background:rgba(232,64,64,.08);border:1px solid rgba(232,64,64,.2);border-radius:10px;padding:12px 16px;margin-bottom:16px">
        <div style="font-size:12px;color:var(--muted)">Current Outstanding</div>
        <div style="font-size:24px;font-weight:800;color:var(--red)">${TR.fmt(client.outstanding||0)}</div>
      </div>
      <div class="form-grid">
        <div class="field"><label>Amount Received (${sym}) *</label><input type="number" id="pay_amt" placeholder="${client.outstanding||0}"/></div>
        <div class="field"><label>Payment Date *</label><input type="date" id="pay_date" value="${TR.today()}"/></div>
        <div class="field"><label>Payment Mode</label>
          <select id="pay_mode">
            ${['Cash','NEFT','RTGS','IMPS','UPI','Cheque','DD'].map(m=>`<option>${m}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>UTR / Cheque No.</label><input id="pay_ref" placeholder="Reference number"/></div>
      </div>
      <div class="field" style="margin-top:8px"><label>Remarks</label><input id="pay_notes" placeholder="e.g. Against LR-001 to LR-005"/></div>
      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="TCRM.savePayment('${clientId}')">💾 Record Payment</button>
    `);
  },

  savePayment(clientId) {
    const amt   = +document.getElementById('pay_amt')?.value||0;
    const date  = document.getElementById('pay_date')?.value;
    const mode  = document.getElementById('pay_mode')?.value||'Cash';
    const ref   = document.getElementById('pay_ref')?.value.trim()||'';
    const notes = document.getElementById('pay_notes')?.value.trim()||'';
    const sym   = TR.sym();

    if (!amt || amt <= 0) { NOTIFY.show('Enter valid payment amount','warning'); return; }

    const clients = STRATIX_DB.getArr('clients');
    const cIdx    = clients.findIndex(c=>c.id===clientId);
    if (cIdx === -1) return;

    const prev = Number(clients[cIdx].outstanding||0);
    const newOutstanding = Math.max(0, prev - amt);

    clients[cIdx].outstanding = newOutstanding;
    clients[cIdx].lastPayment = date || TR.today();

    // Recalculate risk
    if (newOutstanding === 0)      clients[cIdx].risk = 'low';
    else if (newOutstanding < 50000) clients[cIdx].risk = 'low';
    else if (newOutstanding < 200000) clients[cIdx].risk = 'medium';
    else clients[cIdx].risk = 'high';

    STRATIX_DB.set('clients', clients);

    // Log as revenue transaction
    STRATIX_DB.push('transactions', {
      type:'revenue', amount:amt, category:'freight_collection',
      description:`Payment from ${clients[cIdx].name} (${mode}${ref?' '+ref:''})${notes?' — '+notes:''}`,
      date: date || TR.today()
    });

    // Mark matching trips as paid if total clears them
    if (newOutstanding === 0) {
      const trips = STRATIX_DB.getArr('trips');
      const updated = trips.map(t => {
        if (t.clientId === clientId && (!t.paymentStatus || t.paymentStatus !== 'paid')) {
          return { ...t, paymentStatus:'paid', paymentDate: date || TR.today() };
        }
        return t;
      });
      STRATIX_DB.set('trips', updated);
    }

    NOTIFY.show(`Payment of ${sym}${amt.toLocaleString('en-IN')} recorded! New outstanding: ${TR.fmt(newOutstanding)}`, 'success', 5000);
    document.getElementById('paymentModal')?.remove();
    renderTransportCRM('clients');
  },

  sendReminder(clientId) {
    const client = STRATIX_DB.getArr('clients').find(c=>c.id===clientId);
    if (!client) return;
    if (!client.phone) { NOTIFY.show('No phone number. Add it by editing this client.','warning'); return; }
    const sym = TR.sym();
    const biz = TR.biz();
    const trips = STRATIX_DB.getArr('trips').filter(t=>t.clientId===clientId&&(!t.paymentStatus||t.paymentStatus!=='paid'));
    const tripList = trips.slice(0,5).map(t=>`• ${t.route||'Trip'} — ${sym}${Number(t.freight||0).toLocaleString('en-IN')} (${TR.dateStr(t.date)})`).join('\n');
    const msg = `Dear ${client.name},

This is a payment reminder from ${biz}.

Outstanding Amount: *${sym}${Number(client.outstanding||0).toLocaleString('en-IN')}*
${tripList ? '\nPending Trips:\n'+tripList+'\n' : ''}
Kindly arrange payment at the earliest.

Thank you,
${biz}`;
    const waLink = TR.waUrl(client.phone, msg);
    if (!waLink) { NOTIFY.show('Invalid phone number','warning'); return; }
    window.open(waLink, '_blank');
    NOTIFY.show('WhatsApp reminder opened!','success');
  },

  sendBulkReminders() {
    const clients = STRATIX_DB.getArr('clients').filter(c=>Number(c.outstanding||0)>0&&c.phone);
    if (clients.length === 0) { NOTIFY.show('No clients with outstanding + phone number','warning'); return; }
    NOTIFY.show(`Opening WhatsApp for ${clients.length} client${clients.length>1?'s':''}... (1 by 1)`, 'info', 5000);
    clients.slice(0,3).forEach((c,i) => {
      setTimeout(() => this.sendReminder(c.id), i * 2000);
    });
    if (clients.length > 3) NOTIFY.show(`${clients.length-3} more reminders — send them manually from aging tab`, 'info');
  },

  exportCSV() {
    const clients = STRATIX_DB.getArr('clients');
    if (clients.length === 0) { NOTIFY.show('No clients to export','warning'); return; }
    const sym  = TR.sym();
    const rows = [['Name','City','Phone','GST No.','Type','Risk','Outstanding ('+sym+')','Credit Limit','Invoices','Total Business','Last Payment']];
    clients.forEach(c => rows.push([
      '"'+escapeHTML(c.name||'')+'"', c.city||'', c.phone||'', c.gstNumber||'',
      c.type||'', c.risk||'', c.outstanding||0, c.creditLimit||0,
      c.invoices||0, c.totalBusiness||0, c.lastPayment||''
    ]));
    const csv  = rows.map(r=>r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `STRATIX_Clients_${TR.today()}.csv`;
    a.click();
    NOTIFY.show('Clients exported to CSV!','success');
  }
};


/* ══════════════════════════════════════════════════════════════
   5.  DRIVER PAYROLL — DEEP BUILD
       Tabs: Drivers | Run Payroll | Payslips | Trip-wise Bata
   ══════════════════════════════════════════════════════════════ */
function renderDriverPayroll(activeTab) {
  activeTab = activeTab || 'drivers';
  const drivers  = STRATIX_DB.getArr('drivers');
  const payslips = STRATIX_DB.getArr('payslips');
  const sym      = TR.sym();

  // Summary
  const totalPayroll = drivers.reduce((s,d) => s + DPR._netPay(d), 0);
  const activeDrivers= drivers.filter(d => d.status !== 'inactive').length;
  const pendingSlips = payslips.filter(p => !p.paid).length;
  const currentMonth = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});

  const el = document.getElementById('sectionContent');
  el.innerHTML = `
  <div class="sec">
    <div class="sec-head">
      <div>
        <h1 class="sec-title">💸 Driver & Staff Payroll</h1>
        <p class="sec-sub">Attendance · Bata · PF/ESI · Trip-wise bata · Payslip generation</p>
      </div>
      <div class="head-actions">
        <button class="btn btn-gold" onclick="DPR.openAddDriver()">+ Add Driver</button>
        <button class="btn btn-outline" onclick="DPR.runMonthlyPayroll()">Run ${currentMonth} Payroll →</button>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
      <div class="kpi accent"><div class="kpi-lbl">Total Drivers</div><div class="kpi-val">${drivers.length}</div><div class="kpi-trend">${activeDrivers} active</div></div>
      <div class="kpi"><div class="kpi-lbl">Monthly Payroll</div><div class="kpi-val">${TR.fmt(totalPayroll)}</div><div class="kpi-trend muted">All drivers</div></div>
      <div class="kpi"><div class="kpi-lbl">Pending Payslips</div><div class="kpi-val ${pendingSlips>0?'orange':''}">${pendingSlips}</div><div class="kpi-trend ${pendingSlips>0?'down':'up'}">${pendingSlips>0?'Not yet paid':'All paid'}</div></div>
      <div class="kpi"><div class="kpi-lbl">PF + ESI</div><div class="kpi-val">${TR.fmt(drivers.reduce((s,d)=>{const c=DPR._calcSalary(d);return s+c.pfEmployee+c.pfEmployer+c.esiEmployee+c.esiEmployer;},0))}</div><div class="kpi-trend muted">Monthly govt. liability</div></div>
    </div>

    <div class="calc-tabs" style="margin-bottom:16px">
      <button class="calc-tab${activeTab==='drivers'?' active':''}" data-drtab="drivers" onclick="DPR._tab('drivers')">👤 Drivers</button>
      <button class="calc-tab${activeTab==='payroll'?' active':''}" data-drtab="payroll" onclick="DPR._tab('payroll')">💰 Run Payroll</button>
      <button class="calc-tab${activeTab==='payslips'?' active':''}" data-drtab="payslips" onclick="DPR._tab('payslips')">📋 Payslips</button>
      <button class="calc-tab${activeTab==='tripbata'?' active':''}" data-drtab="tripbata" onclick="DPR._tab('tripbata')">🛣️ Trip Bata</button>
    </div>

    <div id="payrollTabContent">${DPR._renderTab(activeTab, drivers, payslips, sym)}</div>
    <div id="driverModal"></div>
  </div>`;
}

const DPR = {
  _tab(tab) {
    const drivers  = STRATIX_DB.getArr('drivers');
    const payslips = STRATIX_DB.getArr('payslips');
    const sym      = TR.sym();
    document.querySelectorAll('[data-drtab]').forEach(b => b.classList.toggle('active', b.dataset.drtab === tab));
    const el = document.getElementById('payrollTabContent');
    if (el) el.innerHTML = this._renderTab(tab, drivers, payslips, sym);
  },

  _renderTab(tab, drivers, payslips, sym) {
    if (tab === 'drivers')  return this._renderDrivers(drivers, sym);
    if (tab === 'payroll')  return this._renderPayrollTable(drivers, sym);
    if (tab === 'payslips') return this._renderPayslips(payslips, sym);
    if (tab === 'tripbata') return this._renderTripBata(drivers, sym);
    return '';
  },

  /* Salary calculation — mirrors features.js calcNetSalary() but driver-specific */
  _calcSalary(d) {
    const basic   = Number(d.basic||0);
    const hra     = Number(d.hra||0) || Math.round(basic * 0.25); // Drivers: HRA 25%
    const da      = Number(d.da||0)  || Math.round(basic * 0.15); // DA 15%
    const special = Number(d.special||0);
    const gross   = basic + hra + da + special;

    const pfEmployee = basic <= 15000 ? Math.round(basic * 0.12) : 1800;
    const pfEmployer = basic <= 15000 ? Math.round(basic * 0.12) : 1800;
    const esiEmployee= gross <= 21000 ? Math.round(gross * 0.0075) : 0;
    const esiEmployer= gross <= 21000 ? Math.round(gross * 0.0325) : 0;

    const advance  = Number(d.advance||0);
    const totalDed = pfEmployee + esiEmployee + advance;
    const netPay   = gross - totalDed;

    return { basic, hra, da, special, gross, pfEmployee, pfEmployer, esiEmployee, esiEmployer, advance, totalDed, netPay };
  },

  _netPay(d) { return this._calcSalary(d).netPay; },

  /* ── DRIVERS LIST ── */
  _renderDrivers(drivers, sym) {
    if (drivers.length === 0) return `<div class="card" style="text-align:center;padding:56px 20px">
      <div style="font-size:48px;margin-bottom:14px">👤</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No Drivers Added</h3>
      <p style="color:var(--muted);max-width:300px;margin:0 auto 20px">Add drivers to manage their payroll, attendance and trip bata.</p>
      <button class="btn btn-gold" onclick="DPR.openAddDriver()">+ Add First Driver</button>
    </div>`;

    return `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Driver Master (${drivers.length})</span><button class="btn btn-gold btn-sm" onclick="DPR.openAddDriver()">+ Add</button></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Driver</th><th>Phone</th><th>License</th><th>License Expiry</th><th>Basic</th><th>Net Pay</th><th>Status</th><th>PAN</th><th>Actions</th></tr></thead>
        <tbody>
        ${drivers.map(d => {
          const sal = this._calcSalary(d);
          const licDays = d.licenseExpiry ? TR.daysFrom(d.licenseExpiry) : null;
          const licAlert = licDays !== null && licDays <= 30;
          return `<tr>
            <td>
              <div class="td-b">${escapeHTML(d.name)}</div>
              <div style="font-size:11px;color:var(--muted)">${escapeHTML(d.designation||'Driver')}</div>
            </td>
            <td class="td-m">${escapeHTML(d.phone||'—')}</td>
            <td class="td-m" style="font-family:monospace;font-size:11px">${escapeHTML(d.licenseNo||'—')}</td>
            <td class="td-m">
              ${licAlert ? `<span class="badge ${licDays<=0?'br':'bo'}">${licDays<=0?'EXPIRED':'⚠️ '+licDays+'d'}</span>` :
                d.licenseExpiry ? `<span style="font-size:11px;color:var(--muted)">${TR.dateStr(d.licenseExpiry)}</span>` : '—'}
            </td>
            <td>${TR.fmt(d.basic||0)}</td>
            <td style="font-weight:700;color:var(--gold)">${TR.fmt(sal.netPay)}</td>
            <td><span class="badge ${d.status==='inactive'?'bm':'bg'}">${d.status||'active'}</span></td>
            <td class="td-m" style="font-size:11px">${escapeHTML(d.pan||'—')}</td>
            <td>
              <div style="display:flex;gap:4px">
                <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="DPR.openEditDriver('${d.id}')">✏️</button>
                <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="DPR.generatePayslip('${d.id}')">📋 Slip</button>
                <button class="del-btn" onclick="DPR.deleteDriver('${d.id}')">🗑</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`;
  },

  /* ── PAYROLL TABLE ── */
  _renderPayrollTable(drivers, sym) {
    if (drivers.length === 0) return `<div class="card" style="text-align:center;padding:36px 20px"><p style="color:var(--muted)">Add drivers first.</p></div>`;

    const month = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});

    let totals = { gross:0, pfEE:0, pfER:0, esiEE:0, esiER:0, advance:0, net:0 };
    drivers.forEach(d => {
      const s = this._calcSalary(d);
      totals.gross   += s.gross;
      totals.pfEE    += s.pfEmployee;
      totals.pfER    += s.pfEmployer;
      totals.esiEE   += s.esiEmployee;
      totals.esiER   += s.esiEmployer;
      totals.advance += s.advance;
      totals.net     += s.netPay;
    });
    const totalCTC = totals.gross + totals.pfER + totals.esiER;

    return `
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
        <div class="card-title">💰 Payroll Summary — ${month}</div>
        <button class="btn btn-gold btn-sm" onclick="DPR.confirmRunPayroll()">✅ Run & Save Payroll</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
        <div style="background:var(--s2);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">Gross Payroll</div>
          <div style="font-size:16px;font-weight:800">${TR.fmt(totals.gross)}</div>
        </div>
        <div style="background:rgba(232,64,64,.07);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">PF + ESI (Employer)</div>
          <div style="font-size:16px;font-weight:800;color:var(--red)">${TR.fmt(totals.pfER+totals.esiER)}</div>
        </div>
        <div style="background:rgba(37,99,235,.07);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">Total CTC</div>
          <div style="font-size:16px;font-weight:800;color:var(--gold)">${TR.fmt(totalCTC)}</div>
        </div>
        <div style="background:rgba(0,214,143,.07);padding:10px;border-radius:8px;text-align:center">
          <div style="font-size:10px;color:var(--muted)">Net Payout</div>
          <div style="font-size:16px;font-weight:800;color:var(--green)">${TR.fmt(totals.net)}</div>
        </div>
      </div>
      <div class="alert" style="background:rgba(37,99,235,.08);border-color:rgba(37,99,235,.3)">
        <span>💡</span>
        <div>PF due by 15th. ESI due by 21st. TDS (if applicable) due by 7th of next month.</div>
      </div>
    </div>

    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Payroll Detail — ${drivers.length} employees</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr>
          <th>Employee</th><th>Basic</th><th>HRA</th><th>DA</th><th>Gross</th>
          <th>PF (EE)</th><th>ESI (EE)</th><th>Advance</th><th>Net Pay</th><th>Employer Cost</th>
        </tr></thead>
        <tbody>
        ${drivers.map(d => {
          const s = this._calcSalary(d);
          const empCost = s.gross + s.pfEmployer + s.esiEmployer;
          return `<tr>
            <td>
              <div class="td-b">${escapeHTML(d.name)}</div>
              <div style="font-size:10px;color:var(--muted)">${escapeHTML(d.designation||'Driver')}</div>
            </td>
            <td>${TR.fmt(s.basic)}</td>
            <td>${TR.fmt(s.hra)}</td>
            <td>${TR.fmt(s.da)}</td>
            <td style="font-weight:700">${TR.fmt(s.gross)}</td>
            <td class="td-r">${TR.fmt(s.pfEmployee)}</td>
            <td class="td-r">${TR.fmt(s.esiEmployee)}</td>
            <td class="td-r">${s.advance>0?TR.fmt(s.advance):'—'}</td>
            <td style="font-weight:800;color:var(--gold)">${TR.fmt(s.netPay)}</td>
            <td class="td-r">${TR.fmt(empCost)}</td>
          </tr>`;
        }).join('')}
        <tr style="background:var(--s2);font-weight:700">
          <td>TOTAL</td>
          <td>—</td><td>—</td>
          <td>${TR.fmt(totals.gross)}</td>
          <td style="color:var(--gold)">${TR.fmt(totals.gross)}</td>
          <td class="td-r">${TR.fmt(totals.pfEE)}</td>
          <td class="td-r">${TR.fmt(totals.esiEE)}</td>
          <td class="td-r">${totals.advance>0?TR.fmt(totals.advance):'—'}</td>
          <td style="color:var(--green)">${TR.fmt(totals.net)}</td>
          <td class="td-r">${TR.fmt(totals.gross+totals.pfER+totals.esiER)}</td>
        </tr>
        </tbody>
      </table></div>
    </div>`;
  },

  confirmRunPayroll() {
    const drivers  = STRATIX_DB.getArr('drivers');
    if (drivers.length === 0) { NOTIFY.show('No drivers added','warning'); return; }
    if (!confirm(`Run payroll for ${drivers.length} driver(s)? This will generate payslips and log expenses.`)) return;
    this.runMonthlyPayroll();
  },

  runMonthlyPayroll() {
    const drivers   = STRATIX_DB.getArr('drivers');
    if (drivers.length === 0) { NOTIFY.show('Add drivers first','warning'); return; }
    const today     = TR.today();
    const monthYear = new Date().toLocaleString('en-IN',{month:'long',year:'numeric'});
    const sym       = TR.sym();
    let totalNet    = 0;

    drivers.forEach(d => {
      const sal = this._calcSalary(d);
      totalNet += sal.netPay;
      // Save payslip
      STRATIX_DB.push('payslips', {
        employeeId:   d.id,
        employeeName: d.name,
        designation:  d.designation||'Driver',
        month:        today.slice(0,7),
        monthLabel:   monthYear,
        basic:        sal.basic,
        hra:          sal.hra,
        da:           sal.da,
        special:      sal.special,
        gross:        sal.gross,
        pfEmployee:   sal.pfEmployee,
        pfEmployer:   sal.pfEmployer,
        esiEmployee:  sal.esiEmployee,
        esiEmployer:  sal.esiEmployer,
        advance:      sal.advance,
        totalDeductions: sal.totalDed,
        netPay:       sal.netPay,
        paid:         false,
        generatedOn:  today
      });
    });

    // Log as expense
    STRATIX_DB.push('transactions', {
      type:'expense', amount:totalNet, category:'salary',
      description:`Driver Payroll — ${monthYear} (${drivers.length} employees)`,
      date: today
    });

    // Clear advances after payroll
    const allDrivers = STRATIX_DB.getArr('drivers');
    allDrivers.forEach((_,i) => { allDrivers[i].advance = 0; });
    STRATIX_DB.set('drivers', allDrivers);

    NOTIFY.show(`Payroll done! ${drivers.length} payslips generated · Total: ${sym}${totalNet.toLocaleString('en-IN')}`, 'success', 5000);
    this._tab('payslips');
  },

  /* ── PAYSLIPS ── */
  _renderPayslips(payslips, sym) {
    if (payslips.length === 0) return `<div class="card" style="text-align:center;padding:40px 20px">
      <div style="font-size:40px;margin-bottom:12px">📋</div>
      <h3 style="color:var(--text2);margin-bottom:8px">No Payslips Generated</h3>
      <p style="color:var(--muted)">Run the monthly payroll to generate payslips.</p>
    </div>`;

    const sorted = [...payslips].sort((a,b) => b.month.localeCompare(a.month));

    return `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Payslip Register (${payslips.length})</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Employee</th><th>Designation</th><th>Month</th><th>Gross</th><th>PF (EE)</th><th>ESI (EE)</th><th>Advance</th><th>Net Pay</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
        ${sorted.map(p => `<tr>
          <td class="td-b">${escapeHTML(p.employeeName)}</td>
          <td class="td-m">${escapeHTML(p.designation||'Driver')}</td>
          <td class="td-m">${escapeHTML(p.monthLabel||p.month)}</td>
          <td>${TR.fmt(p.gross||0)}</td>
          <td class="td-r">${TR.fmt(p.pfEmployee||0)}</td>
          <td class="td-r">${TR.fmt(p.esiEmployee||0)}</td>
          <td class="td-r">${p.advance>0?TR.fmt(p.advance):'—'}</td>
          <td style="font-weight:800;color:var(--gold)">${TR.fmt(p.netPay||0)}</td>
          <td>${p.paid?'<span class="badge bg">Paid</span>':'<span class="badge bo">Unpaid</span>'}</td>
          <td>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 7px" onclick="DPR.printPayslip('${p.id}')">🖨️ Print</button>
              ${!p.paid?`<button class="btn btn-green btn-sm" style="font-size:10px;padding:3px 7px" onclick="DPR.markPayslipPaid('${p.id}')">✓ Paid</button>`:''}
              <button class="del-btn" onclick="DPR.deletePayslip('${p.id}')">🗑</button>
            </div>
          </td>
        </tr>`).join('')}
        </tbody>
      </table></div>
    </div>`;
  },

  markPayslipPaid(id) {
    STRATIX_DB.update('payslips', id, { paid:true, paidOn: TR.today() });
    NOTIFY.show('Payslip marked as paid!','success');
    this._tab('payslips');
  },

  deletePayslip(id) {
    if (!confirm('Delete this payslip?')) return;
    STRATIX_DB.remove('payslips', id);
    this._tab('payslips');
  },

  printPayslip(id) {
    const p   = STRATIX_DB.getArr('payslips').find(x=>x.id===id);
    if (!p)   return;
    const cfg = STRATIX_DB.getSettings();
    const sym = cfg.currencySymbol || '₹';
    const biz = cfg.businessName   || 'Your Company';

    const win = window.open('','_blank','width=700,height=900');
    win.document.write(`<!DOCTYPE html><html><head>
      <title>Payslip — ${p.employeeName} — ${p.monthLabel}</title>
      <style>
        * { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:Arial,sans-serif; padding:32px; color:#1a1a2e; background:#fff; }
        .hd { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; margin-bottom:18px; border-bottom:3px solid #2563EB; }
        .co { font-size:20px; font-weight:800; }
        .co-sub { font-size:11px; color:#666; margin-top:3px; }
        .slip-title { font-size:16px; font-weight:800; color:#2563EB; text-align:right; letter-spacing:1px; }
        .slip-sub { font-size:12px; color:#666; text-align:right; margin-top:4px; }
        .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:14px 0; }
        .field { font-size:12px; padding:5px 0; border-bottom:1px solid #eee; display:flex; gap:8px; }
        .lbl { font-weight:700; color:#555; min-width:140px; }
        .val { color:#1a1a2e; }
        table { width:100%; border-collapse:collapse; margin:14px 0; }
        th { background:#2563EB; color:#fff; padding:8px 12px; font-size:11px; text-align:left; }
        td { padding:7px 12px; font-size:12px; border-bottom:1px solid #eee; }
        tr:nth-child(even) td { background:#fafaf7; }
        .total-row { background:#fdf3e0 !important; font-weight:800; font-size:13px; }
        .sig { display:flex; justify-content:space-between; margin-top:40px; padding-top:14px; border-top:1px solid #eee; }
        .sig-line { width:150px; border-top:1px solid #1a1a2e; padding-top:6px; font-size:11px; color:#666; text-align:center; }
        @media print { body { padding:16px; } }
      </style>
    </head><body>
      <div class="hd">
        <div>
          <div class="co">${escapeHTML(biz)}</div>
          <div class="co-sub">${escapeHTML(cfg.address||'')} ${cfg.gstNumber?'| GST: '+escapeHTML(cfg.gstNumber):''}</div>
        </div>
        <div>
          <div class="slip-title">SALARY PAYSLIP</div>
          <div class="slip-sub">${escapeHTML(p.monthLabel)}</div>
        </div>
      </div>

      <div class="grid2">
        <div>
          <div class="field"><span class="lbl">Employee Name</span><span class="val">${escapeHTML(p.employeeName)}</span></div>
          <div class="field"><span class="lbl">Designation</span><span class="val">${escapeHTML(p.designation||'Driver')}</span></div>
          <div class="field"><span class="lbl">PAN</span><span class="val">${escapeHTML(p.pan||'—')}</span></div>
        </div>
        <div>
          <div class="field"><span class="lbl">Pay Period</span><span class="val">${escapeHTML(p.monthLabel)}</span></div>
          <div class="field"><span class="lbl">Generated On</span><span class="val">${TR.dateStr(p.generatedOn)}</span></div>
          <div class="field"><span class="lbl">Payment Status</span><span class="val">${p.paid?'PAID':'PENDING'}</span></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
        <div>
          <div style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Earnings</div>
          <table>
            <tr><td>Basic Salary</td><td style="text-align:right">${sym}${(p.basic||0).toLocaleString('en-IN')}</td></tr>
            <tr><td>HRA</td><td style="text-align:right">${sym}${(p.hra||0).toLocaleString('en-IN')}</td></tr>
            <tr><td>DA</td><td style="text-align:right">${sym}${(p.da||0).toLocaleString('en-IN')}</td></tr>
            ${p.special>0?`<tr><td>Special Allowance</td><td style="text-align:right">${sym}${p.special.toLocaleString('en-IN')}</td></tr>`:''}
            <tr class="total-row"><td>Gross Salary</td><td style="text-align:right;color:#2563EB">${sym}${(p.gross||0).toLocaleString('en-IN')}</td></tr>
          </table>
        </div>
        <div>
          <div style="font-size:12px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Deductions</div>
          <table>
            <tr><td>PF (Employee 12%)</td><td style="text-align:right;color:#e84040">${sym}${(p.pfEmployee||0).toLocaleString('en-IN')}</td></tr>
            ${p.esiEmployee>0?`<tr><td>ESI (Employee 0.75%)</td><td style="text-align:right;color:#e84040">${sym}${p.esiEmployee.toLocaleString('en-IN')}</td></tr>`:''}
            ${p.advance>0?`<tr><td>Advance Recovery</td><td style="text-align:right;color:#e84040">${sym}${p.advance.toLocaleString('en-IN')}</td></tr>`:''}
            <tr class="total-row"><td>Total Deductions</td><td style="text-align:right;color:#e84040">${sym}${(p.totalDeductions||0).toLocaleString('en-IN')}</td></tr>
          </table>
        </div>
      </div>

      <div style="background:linear-gradient(135deg,#fdf3e0,#fff8ed);border:2px solid #2563EB;border-radius:10px;padding:14px 20px;margin:16px 0;display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:700">NET SALARY PAYABLE</span>
        <span style="font-size:22px;font-weight:800;color:#2563EB">${sym}${(p.netPay||0).toLocaleString('en-IN')}</span>
      </div>

      <div style="font-size:11px;color:#888;margin-bottom:20px;font-style:italic">
        PF Employer: ${sym}${(p.pfEmployer||0).toLocaleString('en-IN')} · ESI Employer: ${sym}${(p.esiEmployer||0).toLocaleString('en-IN')} · Total CTC: ${sym}${((p.gross||0)+(p.pfEmployer||0)+(p.esiEmployer||0)).toLocaleString('en-IN')}
      </div>

      <div class="sig">
        <div class="sig-line">Employee Signature</div>
        <div class="sig-line">Authorized Signatory<br/>${escapeHTML(biz)}</div>
      </div>
      <div style="text-align:center;margin-top:16px;font-size:10px;color:#aaa">Generated by STRATIX · This is a computer-generated payslip</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  },

  /* ── TRIP BATA ── */
  _renderTripBata(drivers, sym) {
    const trips   = STRATIX_DB.getArr('trips');
    // Build bata per driver from trips
    const bataMap = {};
    trips.forEach(t => {
      const driverName = t.driverName || '';
      if (!driverName) return;
      if (!bataMap[driverName]) bataMap[driverName] = { trips:0, bata:0, freight:0, routes:[] };
      bataMap[driverName].trips   += 1;
      bataMap[driverName].bata    += Number(t.driver||0);
      bataMap[driverName].freight += Number(t.freight||0);
      bataMap[driverName].routes.push(t.route||'—');
    });

    const bataEntries = Object.entries(bataMap).sort((a,b)=>b[1].bata-a[1].bata);

    return `
    <!-- Quick bata entry -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-title">🛣️ Record Trip Bata</div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
        Trip bata is auto-tracked when you add trips with a Driver Name. Summary below shows accumulated bata per driver.
        To add more, use <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="APP.navigate('trippnl')">Trip P&L → Add Trip</button>
      </div>
      <div class="form-grid">
        <div class="field"><label>Driver</label>
          <select id="bata_driver">
            <option value="">-- Select Driver --</option>
            ${drivers.map(d=>`<option value="${d.id}">${escapeHTML(d.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Bata Amount (${sym})</label><input type="number" id="bata_amt" placeholder="1200"/></div>
        <div class="field"><label>For Route / Trip</label><input id="bata_route" placeholder="Mumbai — Pune (23 Mar)"/></div>
        <div class="field"><label>Date</label><input type="date" id="bata_date" value="${TR.today()}"/></div>
      </div>
      <button class="btn btn-gold" style="margin-top:10px" onclick="DPR.saveBata()">Save Bata Entry</button>
    </div>

    <!-- Bata summary from trips -->
    ${bataEntries.length === 0 ? `<div class="card" style="text-align:center;padding:28px;color:var(--muted)">No trip bata data yet. Add trips with driver names to see bata tracking.</div>` : `
    <div class="tbl-wrap">
      <div class="tbl-head"><span class="tbl-title">Driver Bata Summary (from Trip P&L)</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Driver</th><th>Trips</th><th>Total Bata</th><th>Freight Generated</th><th>Bata %</th><th>Avg per Trip</th><th>Last 3 Routes</th></tr></thead>
        <tbody>
        ${bataEntries.map(([name, d]) => {
          const bataPct  = d.freight > 0 ? ((d.bata/d.freight)*100).toFixed(1) : 0;
          const avgBata  = d.trips  > 0 ? Math.round(d.bata/d.trips)       : 0;
          const routes   = [...new Set(d.routes)].slice(0,3).join(', ');
          return `<tr>
            <td class="td-b">👤 ${escapeHTML(name)}</td>
            <td>${d.trips}</td>
            <td style="font-weight:700;color:var(--gold)">${TR.fmt(d.bata)}</td>
            <td class="td-g">${TR.fmt(d.freight)}</td>
            <td style="color:${Number(bataPct)<=8?'var(--green)':Number(bataPct)<=15?'var(--gold)':'var(--red)'}">${bataPct}%</td>
            <td>${TR.fmt(avgBata)}/trip</td>
            <td style="font-size:11px;color:var(--muted);max-width:200px;overflow:hidden;text-overflow:ellipsis">${escapeHTML(routes)}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table></div>
    </div>`}`;
  },

  saveBata() {
    const driverId = document.getElementById('bata_driver')?.value;
    const amt      = +document.getElementById('bata_amt')?.value||0;
    const route    = document.getElementById('bata_route')?.value.trim()||'';
    const date     = document.getElementById('bata_date')?.value||TR.today();
    if (!driverId) { NOTIFY.show('Select a driver','warning'); return; }
    if (!amt)      { NOTIFY.show('Enter bata amount','warning'); return; }

    const driver = STRATIX_DB.getArr('drivers').find(d=>d.id===driverId);
    if (!driver)   return;

    // Log as expense
    STRATIX_DB.push('transactions',{
      type:'expense', amount:amt, category:'driver_bata',
      description:`Driver Bata: ${driver.name}${route?' — '+route:''}`,
      date
    });

    NOTIFY.show(`Bata of ${TR.sym()}${amt.toLocaleString('en-IN')} saved for ${driver.name}!`, 'success');
    this._tab('tripbata');
  },

  /* ── ADD / EDIT DRIVER ── */
  openAddDriver() { this._openDriverModal(null); },
  openEditDriver(id) { this._openDriverModal(id); },

  _openDriverModal(id) {
    const drivers = STRATIX_DB.getArr('drivers');
    const d       = id ? (drivers.find(x=>x.id===id)||{}) : {};
    const sym     = TR.sym();

    document.getElementById('driverModal').innerHTML = TR.modal('driverModal', id?`✏️ Edit — ${d.name||''}` : '👤 Add Driver', `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="field"><label>Full Name *</label><input id="dr_name" value="${escapeHTML(d.name||'')}" placeholder="Ramesh Kumar"/></div>
        <div class="field"><label>Phone</label><input id="dr_phone" value="${escapeHTML(d.phone||'')}" placeholder="+91 9876543210"/></div>
        <div class="field"><label>Designation</label><input id="dr_desig" value="${escapeHTML(d.designation||'')}" placeholder="Driver / Helper / Supervisor"/></div>
        <div class="field"><label>Date of Joining</label><input type="date" id="dr_doj" value="${d.doj||''}"/></div>
        <div class="field"><label>License Number</label><input id="dr_lic" value="${escapeHTML(d.licenseNo||'')}" placeholder="MH-12-2015-1234567"/></div>
        <div class="field"><label>License Expiry</label><input type="date" id="dr_licexp" value="${d.licenseExpiry||''}"/></div>
        <div class="field"><label>PAN Number</label><input id="dr_pan" value="${escapeHTML(d.pan||'')}" placeholder="ABCDE1234F" style="text-transform:uppercase"/></div>
        <div class="field"><label>Status</label>
          <select id="dr_status">
            <option value="active" ${(d.status||'active')==='active'?'selected':''}>Active</option>
            <option value="on_leave" ${d.status==='on_leave'?'selected':''}>On Leave</option>
            <option value="inactive" ${d.status==='inactive'?'selected':''}>Inactive</option>
          </select>
        </div>
      </div>

      <div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--b1)">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">💰 Salary Structure</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="field"><label>Basic Salary (${sym})</label><input type="number" id="dr_basic" value="${d.basic||''}" placeholder="15000" oninput="DPR._previewSalary()"/></div>
          <div class="field"><label>HRA</label><input type="number" id="dr_hra" value="${d.hra||''}" placeholder="Auto (25% of basic)"/></div>
          <div class="field"><label>DA</label><input type="number" id="dr_da" value="${d.da||''}" placeholder="Auto (15% of basic)"/></div>
          <div class="field"><label>Special Allowance</label><input type="number" id="dr_special" value="${d.special||''}" placeholder="0"/></div>
          <div class="field"><label>Current Advance (${sym})</label><input type="number" id="dr_adv" value="${d.advance||0}" placeholder="0"/></div>
          <div class="field"><label>Bank Account</label><input id="dr_bank" value="${escapeHTML(d.bankAcc||'')}" placeholder="Account number"/></div>
          <div class="field"><label>IFSC</label><input id="dr_ifsc" value="${escapeHTML(d.ifsc||'')}" placeholder="SBIN0001234"/></div>
        </div>
        <div id="driverSalaryPreview" style="margin-top:10px"></div>
      </div>

      <button class="btn btn-gold btn-full" style="margin-top:14px" onclick="DPR.saveDriver('${id||''}')">💾 ${id?'Update':'Save'} Driver</button>
    `, true);
  },

  _previewSalary() {
    const basic = +document.getElementById('dr_basic')?.value||0;
    if (!basic) return;
    const hra   = +document.getElementById('dr_hra')?.value || Math.round(basic*0.25);
    const da    = +document.getElementById('dr_da')?.value  || Math.round(basic*0.15);
    const sp    = +document.getElementById('dr_special')?.value||0;
    const gross = basic + hra + da + sp;
    const pfEE  = basic <= 15000 ? Math.round(basic*0.12) : 1800;
    const esiEE = gross <= 21000 ? Math.round(gross*0.0075) : 0;
    const net   = gross - pfEE - esiEE;
    const sym   = TR.sym();
    const el    = document.getElementById('driverSalaryPreview');
    if (!el) return;
    el.innerHTML = `<div style="background:var(--s2);border-radius:8px;padding:10px;display:flex;gap:16px;flex-wrap:wrap">
      <div style="text-align:center"><div style="font-size:10px;color:var(--muted)">Gross</div><div style="font-size:14px;font-weight:700">${sym}${gross.toLocaleString('en-IN')}</div></div>
      <div style="text-align:center"><div style="font-size:10px;color:var(--muted)">PF</div><div style="font-size:14px;font-weight:700;color:var(--red)">−${sym}${pfEE.toLocaleString('en-IN')}</div></div>
      <div style="text-align:center"><div style="font-size:10px;color:var(--muted)">ESI</div><div style="font-size:14px;font-weight:700;color:var(--red)">−${sym}${esiEE.toLocaleString('en-IN')}</div></div>
      <div style="text-align:center"><div style="font-size:10px;color:var(--muted)">Net Pay</div><div style="font-size:14px;font-weight:800;color:var(--gold)">${sym}${net.toLocaleString('en-IN')}</div></div>
    </div>`;
  },

  saveDriver(id) {
    const name = document.getElementById('dr_name')?.value.trim();
    if (!name) { NOTIFY.show('Enter driver name','warning'); return; }
    const basic = +document.getElementById('dr_basic')?.value||0;
    const data  = {
      name,
      phone:         document.getElementById('dr_phone')?.value.trim()||'',
      designation:   document.getElementById('dr_desig')?.value.trim()||'Driver',
      doj:           document.getElementById('dr_doj')?.value||null,
      licenseNo:     document.getElementById('dr_lic')?.value.trim()||'',
      licenseExpiry: document.getElementById('dr_licexp')?.value||null,
      pan:           document.getElementById('dr_pan')?.value.trim().toUpperCase()||'',
      status:        document.getElementById('dr_status')?.value||'active',
      basic,
      hra:           +document.getElementById('dr_hra')?.value||0,
      da:            +document.getElementById('dr_da')?.value||0,
      special:       +document.getElementById('dr_special')?.value||0,
      advance:       +document.getElementById('dr_adv')?.value||0,
      bankAcc:       document.getElementById('dr_bank')?.value.trim()||'',
      ifsc:          document.getElementById('dr_ifsc')?.value.trim().toUpperCase()||''
    };
    if (id) { STRATIX_DB.update('drivers',id,data); NOTIFY.show('Driver updated!','success'); }
    else    { STRATIX_DB.push('drivers',data);       NOTIFY.show('Driver added!','success'); }
    document.getElementById('driverModal')?.remove();
    renderDriverPayroll('drivers');
  },

  deleteDriver(id) {
    const d = STRATIX_DB.getArr('drivers').find(x=>x.id===id);
    if (!confirm(`Delete driver "${d?.name}"? Their payslips will remain.`)) return;
    STRATIX_DB.remove('drivers',id);
    NOTIFY.show('Driver deleted','info');
    renderDriverPayroll('drivers');
  }
};


/* ══════════════════════════════════════════════════════════════
   APP INTEGRATION — Override stubs
   These make the APP.navigate() routing work with deep versions.
   Place these calls into app.js renderSection() IF needed,
   OR they work via typeof check (app.js already uses typeof guards).
   ══════════════════════════════════════════════════════════════ */

// Override APP.renderTripPNL → renderTripPNL()
// Override APP.renderFleet   → renderFleet()
// These are already routed through renderSection():
//   trippnl:  () => this.renderTripPNL()  → needs to call renderTripPNL()
//   fleet:    () => this.renderFleet()    → needs to call renderFleet()
//   crm:      → for logistics bizType, call renderTransportCRM()
//   salary:   → for logistics bizType, call renderDriverPayroll()

// Patch APP methods on load so routing flows to deep versions automatically
document.addEventListener('DOMContentLoaded', function() {
  // Wait for APP to be defined
  setTimeout(() => {
    if (typeof APP !== 'undefined') {
      // Patch Trip P&L
      APP.renderTripPNL = function() { renderTripPNL('add'); };
      // Patch Fleet
      APP.renderFleet   = function() { renderFleet('vehicles'); };
      // Patch CRM for logistics vertical
      const _origRenderSection = APP.renderSection.bind(APP);
      APP.renderSection = function(id) {
        const biz = (this.session && this.session.bizType) || (this.settings && this.settings.businessType) || '';
        const isLogistics = biz === 'logistics' || biz === 'transport' || !biz;
        if (id === 'crm' && isLogistics)    { renderTransportCRM('clients'); return; }
        if (id === 'salary' && isLogistics) { renderDriverPayroll('drivers'); return; }
        _origRenderSection(id);
      };
    }
  }, 300);
});

// Also patch immediately if APP is already defined (handles hot reload)
if (typeof APP !== 'undefined') {
  APP.renderTripPNL = function() { renderTripPNL('add'); };
  APP.renderFleet   = function() { renderFleet('vehicles'); };
}

/* ══════════════════════════════════════════════════════════════
   Also register addClientPrompt for invoiceaging compat
   ══════════════════════════════════════════════════════════════ */
if (typeof APP !== 'undefined' && APP._showClientAddModal === undefined) {
  APP._showClientAddModal = function() {
    // Navigate to transport CRM and open add client modal
    renderTransportCRM('clients');
    setTimeout(() => TCRM.openAddClient(), 200);
  };
}

/* ── Demo seed disabled — users add their own real data ── */
function seedTransportDemo() { return; }
