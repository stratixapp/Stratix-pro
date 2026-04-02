/**
 * STRATIX logistics.js v4.0
 * Full Logistics Documentation + Tools
 * 
 * Includes:
 * 1.  Lorry Receipt (LR) Generator
 * 2.  E-Way Bill Generator
 * 3.  Freight Invoice
 * 4.  Truck Hire Agreement
 * 5.  Consignment Note
 * 6.  Delivery Challan
 * 7.  Vehicle Fitness Tracker
 * 8.  Driver Daily Log
 * 9.  Weighment Slip
 * 10. POD (Proof of Delivery)
 * 11. Fuel Logbook
 * 12. Monthly Fleet Summary Report
 *
 * New Tools:
 *  - Load Efficiency Optimizer
 *  - Multi-Route Profit Comparison
 *  - Driver Performance Tracker
 *  - Vehicle Maintenance Scheduler
 *  - Freight Rate Calculator
 *  - Diesel Cost Tracker
 */

/* ── Helpers ─────────────────────────────────────────────── */
const LD = {
  fmt(n) {
    n = Math.abs(n||0);
    if (n >= 10000000) return (n/10000000).toFixed(2)+' Cr';
    if (n >= 100000)   return (n/100000).toFixed(2)+' L';
    if (n >= 1000)     return (n/1000).toFixed(1)+'K';
    return Math.round(n).toLocaleString('en-IN');
  },
  sym() { return STRATIX_DB.getSettings().currencySymbol || '₹'; },
  biz() { return STRATIX_DB.getSettings().businessName || 'Your Company'; },
  today() { return new Date().toISOString().split('T')[0]; },
  dateStr(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  },
  id(prefix) { return prefix+'-'+Date.now().toString().slice(-6); },

  numberToWords(num) {
    num = Math.floor(num||0);
    if (num === 0) return 'Zero';
    const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const conv = n => {
      if (n<20) return ones[n];
      if (n<100) return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');
      if (n<1000) return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+conv(n%100):'');
      if (n<100000) return conv(Math.floor(n/1000))+' Thousand'+(n%1000?' '+conv(n%1000):'');
      if (n<10000000) return conv(Math.floor(n/100000))+' Lakh'+(n%100000?' '+conv(n%100000):'');
      return conv(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+conv(n%10000000):'');
    };
    return 'Rupees '+conv(num)+' Only';
  },

  printStyle() {
    return `<style id="ldocStyle">
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      @media print {
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        body { background: #fff !important; padding: 0 !important; }
        .no-print { display: none !important; }
        .print-doc { max-width: 100% !important; box-shadow: none !important; border-radius: 0 !important; padding: 16px 20px !important; }
        .doc-border { border: 2px solid #2563EB !important; }
        .doc-total { background: #fdf3e0 !important; border: 1px solid #2563EB !important; }
        .doc-table th { background: #2563EB !important; -webkit-print-color-adjust: exact !important; }
      }
      body { font-family: 'Inter', Arial, sans-serif; background: #f4f4f4; }
      .print-doc {
        background: #fff; color: #1a1a2e;
        font-family: 'Inter', Arial, sans-serif;
        padding: 32px 36px; border-radius: 14px;
        max-width: 780px; margin: 24px auto;
        box-shadow: 0 6px 48px rgba(0,0,0,.14);
      }
      /* ── STRATIX branded header ── */
      .doc-header {
        display: flex; justify-content: space-between; align-items: flex-start;
        padding-bottom: 16px; margin-bottom: 18px;
        border-bottom: 3px solid #2563EB;
      }
      .sx-doc-brand { display: flex; align-items: center; gap: 10px; }
      .sx-doc-mark {
        width: 42px; height: 42px;
        background: linear-gradient(135deg,#2563EB,#1D4ED8);
        border-radius: 10px; display: flex; align-items: center;
        justify-content: center; font-weight: 800; font-size: 15px;
        color: #fff; flex-shrink: 0; font-family: 'Inter', Arial, sans-serif;
      }
      .doc-co { font-size: 18px; font-weight: 800; color: #1a1a2e; letter-spacing: -.3px; }
      .doc-co-sub { font-size: 11px; color: #666; margin-top: 3px; line-height: 1.5; }
      .doc-title {
        font-size: 20px; font-weight: 800; text-align: right;
        color: #2563EB; letter-spacing: 1px; text-transform: uppercase;
      }
      .doc-no { font-size: 12px; color: #666; margin-top: 4px; text-align: right; }
      /* ── Fields ── */
      .doc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin: 14px 0; }
      .doc-field { display: flex; gap: 8px; font-size: 12px; padding: 5px 0; border-bottom: 1px solid #f0ede0; }
      .doc-field .lbl { font-weight: 700; color: #555; min-width: 130px; flex-shrink: 0; }
      .doc-field .val { color: #1a1a2e; font-weight: 500; }
      /* ── Table ── */
      .doc-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
      .doc-table th { background: #2563EB; color: #fff; padding: 9px 12px; font-size: 11px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; text-align: left; }
      .doc-table td { padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #f0ede0; vertical-align: top; color: #333; }
      .doc-table tr:last-child td { border-bottom: none; }
      .doc-table tr:nth-child(even) td { background: #fafaf7; }
      /* ── Totals ── */
      .doc-total {
        background: linear-gradient(135deg,#fdf3e0,#fff8ed);
        border: 1px solid #2563EB; padding: 14px 16px; border-radius: 10px;
        display: flex; justify-content: space-between;
        font-weight: 800; font-size: 16px; margin-top: 12px;
        color: #1a1a2e;
      }
      .doc-total .doc-total-val { color: #2563EB; }
      .doc-words {
        background: #fdf3e0; border: 1px solid #f5c060;
        border-radius: 8px; padding: 9px 14px;
        font-size: 12px; margin: 10px 0; color: #555; font-style: italic;
      }
      /* ── Signatures ── */
      .doc-sigs {
        display: grid; grid-template-columns: repeat(3,1fr);
        gap: 20px; margin-top: 28px; padding-top: 18px;
        border-top: 1px solid #eee;
      }
      .sig-box { text-align: center; }
      .sig-line { border-bottom: 1.5px solid #bbb; height: 44px; margin-bottom: 6px; }
      .sig-lbl { font-size: 11px; color: #666; font-weight: 600; }
      .stamp-box {
        border: 2px dashed #ddd; height: 70px; width: 90px;
        display: flex; align-items: center; justify-content: center;
        font-size: 10px; color: #bbb; margin: 0 auto 6px; border-radius: 6px;
      }
      /* ── Misc ── */
      .doc-border { border: 2px solid #2563EB; padding: 3px; border-radius: 10px; margin-bottom: 16px; }
      .doc-border-inner { border: 1px solid #fde0a0; padding: 18px; border-radius: 8px; }
      .doc-section-title {
        font-size: 11px; font-weight: 700; color: #2563EB;
        text-transform: uppercase; letter-spacing: .8px;
        margin: 14px 0 6px; padding-bottom: 4px;
        border-bottom: 1px solid #2563EB;
      }
      /* ── STRATIX footer watermark ── */
      .sx-doc-footer {
        display: flex; align-items: center; justify-content: space-between;
        margin-top: 24px; padding-top: 14px; border-top: 1px solid #eee;
        font-size: 10px; color: #bbb;
      }
      .sx-doc-footer-brand { display: flex; align-items: center; gap: 5px; }
      .sx-doc-footer-brand .sx-mini-mark {
        width: 18px; height: 18px; background: linear-gradient(135deg,#2563EB,#1D4ED8);
        border-radius: 4px; display: inline-flex; align-items: center;
        justify-content: center; font-size: 8px; font-weight: 800; color: #fff;
      }
      .sx-doc-footer-brand span { font-weight: 700; color: #2563EB; letter-spacing: 1px; }
      .note-box {
        background: #fffde7; border: 1px solid #f0c040;
        border-radius: 8px; padding: 9px 14px; font-size: 12px; margin: 10px 0;
      }
    </style>`;
  },

  docShell(content, backFn='renderLogisticsDocs') {
    const s = STRATIX_DB.getSettings();
    return `<div class="sec">
      <div class="sec-head no-print" style="margin-bottom:16px">
        <button class="btn-back" onclick="${backFn}()">← Back</button>
        <div class="head-actions">
          <button class="btn btn-gold" onclick="window.print()">🖨️ Print / Save PDF</button>
        </div>
      </div>
      ${LD.printStyle()}
      ${content}
    </div>`;
  }
};

/* ═══════════════════════════════════════════════════════════
   MAIN LOGISTICS DOCS PAGE
═══════════════════════════════════════════════════════════ */
function renderLogisticsDocs() {
  const docs = [
    { id:'lr',      icon:'📜', title:'Lorry Receipt (LR)',      sub:'Standard consignment transport document', color:'#2563EB' },
    { id:'eway',    icon:'🛂', title:'E-Way Bill',              sub:'GST e-way bill for goods movement', color:'#4f9ef0' },
    { id:'freight', icon:'🧾', title:'Freight Invoice',         sub:'Complete freight billing with GST', color:'#00d68f' },
    { id:'hire',    icon:'🤝', title:'Truck Hire Agreement',    sub:'Vehicle hire contract with terms', color:'#9b5de5' },
    { id:'consign', icon:'📦', title:'Consignment Note',        sub:'Goods consignment with shipper details', color:'#3B82F6' },
    { id:'challan', icon:'📋', title:'Delivery Challan',        sub:'Delivery confirmation document', color:'#00c6cf' },
    { id:'pod',     icon:'✅', title:'Proof of Delivery (POD)', sub:'Receiver signed delivery proof', color:'#00d68f' },
    { id:'weighment',icon:'⚖️','title':'Weighment Slip',        sub:'Loaded & tare weight certificate', color:'#4f9ef0' },
    { id:'fuellog', icon:'⛽', title:'Fuel Logbook',            sub:'Trip-wise fuel consumption record', color:'#e84040' },
    { id:'driverlog',icon:'👤','title':'Driver Daily Log',      sub:'Daily duty & distance log', color:'#2563EB' },
    { id:'fitness',  icon:'🔧', title:'Vehicle Fitness Tracker',sub:'RC, fitness & insurance expiry', color:'#3B82F6' },
    { id:'fleetsummary',icon:'📊','title':'Fleet Monthly Report',sub:'All vehicles P&L summary', color:'#00c6cf' },
  ];

  const tools = [
    { id:'loadopt',   icon:'📐', title:'Load Efficiency Optimizer', sub:'Maximize load vs profit' },
    { id:'routecmp',  icon:'🗺️', title:'Multi-Route Profit Compare', sub:'Side-by-side route analysis' },
    { id:'driverperf',icon:'🏆', title:'Driver Performance Tracker', sub:'Trips, KM, earnings per driver' },
    { id:'maintsch',  icon:'🔧', title:'Maintenance Scheduler',      sub:'Service due alerts per vehicle' },
    { id:'freightrate',icon:'💹','title':'Freight Rate Calculator',  sub:'Market-competitive rate finder' },
    { id:'dieseltrack',icon:'⛽','title':'Diesel Cost Tracker',      sub:'Daily diesel prices & trip cost' },
  ];

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div>
          <h1 class="sec-title">Logistics Documentation</h1>
          <p class="sec-sub">12 transport documents + 6 smart tools — print & PDF ready</p>
        </div>
        <span class="owner-tag">👑 All Unlocked</span>
      </div>

      <div class="owner-banner">
        <span class="ob-ico">🚛</span>
        <div>
          <div class="ob-txt">12 Logistics Documents + 6 Advanced Tools</div>
          <div class="ob-sub">LR, E-Way Bill, Freight Invoice, Hire Agreement, POD, Weighment Slip, Fuel Log, Fleet Report + more</div>
        </div>
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px">Transport Documents</div>
      <div class="doc-grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;margin-bottom:28px">
        ${docs.map(d=>`
          <div class="doc-card" onclick="LDOC.open('${d.id}')" style="border-color:${d.color}22;cursor:pointer">
            <div style="width:44px;height:44px;border-radius:12px;background:${d.color}18;border:1px solid ${d.color}33;display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 12px">${d.icon}</div>
            <h3 style="font-size:13px;margin-bottom:5px">${d.title}</h3>
            <p style="font-size:11px;color:var(--muted);margin-bottom:12px">${d.sub}</p>
            <button class="btn-doc" style="border-color:${d.color}44;color:${d.color}">Generate →</button>
          </div>`).join('')}
      </div>

      <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:12px">Smart Tools</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px">
        ${tools.map(t=>`
          <div class="card" onclick="LTOOL.open('${t.id}')" style="cursor:pointer;transition:.18s ease;border-color:var(--b2)" onmouseover="this.style.borderColor='var(--gold)'" onmouseout="this.style.borderColor='var(--b2)'">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="font-size:28px">${t.icon}</div>
              <div>
                <div style="font-size:14px;font-weight:700">${t.title}</div>
                <div style="font-size:12px;color:var(--muted);margin-top:3px">${t.sub}</div>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" style="margin-top:12px;width:100%">Open Tool →</button>
          </div>`).join('')}
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════════
   DOCUMENT GENERATORS
═══════════════════════════════════════════════════════════ */
const LDOC = {
  open(type) {
    const handlers = {
      lr: this.lrForm,
      eway: this.ewayForm,
      freight: this.freightForm,
      hire: this.hireForm,
      consign: this.consignForm,
      challan: this.challanForm,
      pod: this.podForm,
      weighment: this.weighmentForm,
      fuellog: this.fuellogsForm,
      driverlog: this.driverlogForm,
      fitness: this.fitnessForm,
      fleetsummary: this.fleetSummary,
    };
    if (handlers[type]) handlers[type].call(this);
  },

  /* ── 1. LORRY RECEIPT ── */
  lrForm() {
    const s = STRATIX_DB.getSettings(), sym = LD.sym();
    const fleet = STRATIX_DB.getArr('fleet');
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="doc-form" style="max-width:780px">
        <h3 style="margin-bottom:4px">📜 Lorry Receipt (LR) Generator</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:18px">As per Motor Vehicles Act — Standard LR format for road consignment</p>

        <div class="doc-section-title">🏢 Transport / Carrier Details</div>
        <div class="doc-fields">
          <div class="field"><label>LR Number *</label><input id="lrNo" value="${LD.id('LR')}"/></div>
          <div class="field"><label>Date *</label><input type="date" id="lrDate" value="${LD.today()}"/></div>
          <div class="field"><label>Transporter Name</label><input id="lrTransporter" value="${s.businessName||''}" placeholder="Transport Co. Name"/></div>
          <div class="field"><label>Transporter GSTIN</label><input id="lrTransGST" value="${s.gstNumber||''}" placeholder="22XXXXX0000X1Z5"/></div>
          <div class="field"><label>Vehicle Number *</label>
            ${fleet.length>0
              ? `<select id="lrVehicle">${fleet.map(v=>`<option value="${v.number}">${v.number}${v.type?' ('+v.type+')':''}</option>`).join('')}<option value="">-- Enter manually --</option></select>`
              : `<input id="lrVehicle" placeholder="MH12AB1234"/>`}
          </div>
          <div class="field"><label>Vehicle Type</label>
            <select id="lrVehicleType">
              <option>Open Body Truck</option><option>Closed Container</option><option>Trailer</option>
              <option>LCV / Mini Truck</option><option>Tanker</option><option>Refrigerated</option><option>Tipper</option>
            </select>
          </div>
          <div class="field"><label>Driver Name</label><input id="lrDriver" placeholder="Ramesh Kumar"/></div>
          <div class="field"><label>Driver Phone</label><input id="lrDriverPh" placeholder="+91 9876543210"/></div>
          <div class="field"><label>Driver License No</label><input id="lrDL" placeholder="MH-1420110012345"/></div>
          <div class="field"><label>From (Origin) *</label><input id="lrFrom" placeholder="Mumbai, Maharashtra"/></div>
          <div class="field"><label>To (Destination) *</label><input id="lrTo" placeholder="Delhi"/></div>
          <div class="field"><label>E-Way Bill No</label><input id="lrEWB" placeholder="Leave blank if exempt"/></div>
        </div>

        <div class="doc-section-title">👤 Consignor (Sender)</div>
        <div class="doc-fields">
          <div class="field"><label>Consignor Name *</label><input id="lrConsignor" placeholder="Sender company / person"/></div>
          <div class="field"><label>Consignor GSTIN</label><input id="lrConGST" placeholder="22XXXXX0000X1Z5"/></div>
          <div class="field" style="grid-column:1/-1"><label>Consignor Address</label><input id="lrConAddr" placeholder="Full address with pincode"/></div>
          <div class="field"><label>Consignor Phone</label><input id="lrConPh" placeholder="+91"/></div>
        </div>

        <div class="doc-section-title">📦 Consignee (Receiver)</div>
        <div class="doc-fields">
          <div class="field"><label>Consignee Name *</label><input id="lrConsignee" placeholder="Receiver company / person"/></div>
          <div class="field"><label>Consignee GSTIN</label><input id="lrRecGST" placeholder="27XXXXX0000X1Z5"/></div>
          <div class="field" style="grid-column:1/-1"><label>Consignee Address</label><input id="lrRecAddr" placeholder="Full delivery address with pincode"/></div>
          <div class="field"><label>Consignee Phone</label><input id="lrRecPh" placeholder="+91"/></div>
        </div>

        <div class="doc-section-title">📋 Goods Description</div>
        <div class="doc-fields">
          <div class="field"><label>Description of Goods *</label><input id="lrGoods" placeholder="Steel Pipes / Cement Bags / Auto Parts"/></div>
          <div class="field"><label>HSN Code</label><input id="lrHSN" placeholder="7216 (steel), 2523 (cement)"/></div>
          <div class="field"><label>No. of Packages *</label><input type="number" id="lrPkgs" placeholder="10"/></div>
          <div class="field"><label>Packing Type</label>
            <select id="lrPacking">
              <option>Bundles</option><option>Bags</option><option>Boxes</option><option>Cartons</option>
              <option>Drums</option><option>Loose</option><option>Pallets</option><option>Rolls</option><option>Crates</option>
            </select>
          </div>
          <div class="field"><label>Gross Weight *</label><input id="lrWeight" placeholder="5 tons / 5000 kg"/></div>
          <div class="field"><label>Charged Weight</label><input id="lrChargeWt" placeholder="5 tons"/></div>
          <div class="field"><label>Declared Value (${sym})</label><input type="number" id="lrValue" placeholder="500000"/></div>
          <div class="field"><label>Risk</label>
            <select id="lrRisk"><option>Owner's Risk</option><option>Carrier's Risk</option></select>
          </div>
          <div class="field"><label>Delivery Type</label>
            <select id="lrDel"><option>Door Delivery</option><option>Godown Delivery</option><option>Self Pickup</option><option>Branch Delivery</option></select>
          </div>
          <div class="field"><label>Expected Delivery Date</label><input type="date" id="lrETA"/></div>
          <div class="field" style="grid-column:1/-1"><label>Special Instructions</label>
            <textarea id="lrNotes" rows="2" placeholder="Handle with care · Fragile · Keep dry · This side up"></textarea>
          </div>
        </div>

        <div class="doc-section-title">💰 Freight Charges</div>
        <div class="doc-fields">
          <div class="field"><label>Basic Freight (${sym}) *</label><input type="number" id="lrFreight" placeholder="18000" oninput="LDOC.lrCalc()"/></div>
          <div class="field"><label>GST on Freight (%)</label>
            <select id="lrGST" onchange="LDOC.lrCalc()">
              <option value="0">0% (Exempted / RCM)</option>
              <option value="5" selected>5% (GTA Forward Charge)</option>
              <option value="12">12%</option><option value="18">18%</option>
            </select>
          </div>
          <div class="field"><label>Loading Charges (${sym})</label><input type="number" id="lrLoadCh" placeholder="0" oninput="LDOC.lrCalc()"/></div>
          <div class="field"><label>Advance Paid (${sym})</label><input type="number" id="lrAdvance" placeholder="5000" oninput="LDOC.lrCalc()"/></div>
        </div>
        <div id="lrTotals" class="inv-totals" style="margin-top:12px"></div>
        <button class="btn-calc" style="margin-top:16px" onclick="LDOC.printLR()">🖨️ Generate LR — Print / PDF</button>
      </div>`);
    this.lrCalc();
  },

  lrCalc() {
    const freight = +document.getElementById('lrFreight')?.value||0;
    const gst     = +document.getElementById('lrGST')?.value||0;
    const adv     = +document.getElementById('lrAdvance')?.value||0;
    const load    = +document.getElementById('lrLoadCh')?.value||0;
    const sym = LD.sym();
    const cgst = freight*(gst/2)/100, sgst = freight*(gst/2)/100;
    const subtotal = freight + load;
    const total = subtotal + cgst + sgst;
    const balance = total - adv;
    const el = document.getElementById('lrTotals');
    if (!el) return;
    el.innerHTML = `
      <div class="inv-row"><span>Basic Freight</span><span>${sym}${LD.fmt(freight)}</span></div>
      ${load?`<div class="inv-row"><span>Loading Charges</span><span>${sym}${LD.fmt(load)}</span></div>`:''}
      ${gst>0?`<div class="inv-row"><span>Subtotal</span><span>${sym}${LD.fmt(subtotal)}</span></div>
      <div class="inv-row"><span>CGST @${gst/2}%</span><span>${sym}${LD.fmt(cgst)}</span></div>
      <div class="inv-row"><span>SGST @${gst/2}%</span><span>${sym}${LD.fmt(sgst)}</span></div>`:''}
      <div class="inv-row"><span>Total Freight</span><span style="font-weight:700">${sym}${LD.fmt(total)}</span></div>
      ${adv?`<div class="inv-row"><span>Advance Paid</span><span style="color:var(--green)">— ${sym}${LD.fmt(adv)}</span></div>`:''}
      <div class="inv-row total"><span>Balance Due</span><span style="color:var(--gold)">${sym}${LD.fmt(balance)}</span></div>`;
  },

  printLR() {
    const s = STRATIX_DB.getSettings(), sym = LD.sym();
    const v = id => document.getElementById(id)?.value||'—';
    const n = id => +document.getElementById(id)?.value||0;
    const freight=n('lrFreight'), gst=n('lrGST'), adv=n('lrAdvance'), load=n('lrLoadCh');
    const cgst=freight*(gst/2)/100, sgst=freight*(gst/2)/100;
    const subtotal=freight+load, total=subtotal+cgst+sgst, balance=total-adv;
    const lrNo=v('lrNo');
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="print-doc">
        <div class="doc-border"><div class="doc-border-inner">

          <!-- Header -->
          <div class="doc-header">
            <div class="sx-doc-brand">
              <div class="sx-doc-mark">SX</div>
              <div>
                <div class="doc-co">${escapeHTML(s.businessName||'Your Company')}</div>
                <div class="doc-co-sub">
                  ${s.address?escapeHTML(s.address)+'<br/>':''}
                  ${s.gstNumber?'GSTIN: '+escapeHTML(s.gstNumber)+' | ':''}${s.phone?'Ph: '+escapeHTML(s.phone):''}
                </div>
              </div>
            </div>
            <div style="text-align:right">
              <div class="doc-title">LORRY RECEIPT</div>
              <div class="doc-no" style="margin-top:4px">LR No: <strong>${escapeHTML(lrNo)}</strong></div>
              <div class="doc-no">Date: <strong>${LD.dateStr(v('lrDate'))}</strong></div>
              ${v('lrEWB')!=='—'?`<div class="doc-no">E-Way Bill: <strong>${escapeHTML(v('lrEWB'))}</strong></div>`:''}
            </div>
          </div>

          <!-- Consignor / Consignee -->
          <div class="doc-grid" style="margin-bottom:10px">
            <div style="border:1px solid #e8dfc0;border-radius:6px;padding:10px">
              <div class="doc-section-title" style="margin-top:0">CONSIGNOR (Sender)</div>
              <div class="doc-field"><span class="lbl">Name</span><span class="val"><strong>${escapeHTML(v('lrConsignor'))}</strong></span></div>
              ${v('lrConGST')!=='—'?`<div class="doc-field"><span class="lbl">GSTIN</span><span class="val">${escapeHTML(v('lrConGST'))}</span></div>`:''}
              ${v('lrConAddr')!=='—'?`<div class="doc-field"><span class="lbl">Address</span><span class="val">${escapeHTML(v('lrConAddr'))}</span></div>`:''}
              ${v('lrConPh')!=='—'?`<div class="doc-field"><span class="lbl">Phone</span><span class="val">${escapeHTML(v('lrConPh'))}</span></div>`:''}
              <div class="doc-field"><span class="lbl">From</span><span class="val"><strong>${escapeHTML(v('lrFrom'))}</strong></span></div>
            </div>
            <div style="border:1px solid #e8dfc0;border-radius:6px;padding:10px">
              <div class="doc-section-title" style="margin-top:0">CONSIGNEE (Receiver)</div>
              <div class="doc-field"><span class="lbl">Name</span><span class="val"><strong>${escapeHTML(v('lrConsignee'))}</strong></span></div>
              ${v('lrRecGST')!=='—'?`<div class="doc-field"><span class="lbl">GSTIN</span><span class="val">${escapeHTML(v('lrRecGST'))}</span></div>`:''}
              ${v('lrRecAddr')!=='—'?`<div class="doc-field"><span class="lbl">Address</span><span class="val">${escapeHTML(v('lrRecAddr'))}</span></div>`:''}
              ${v('lrRecPh')!=='—'?`<div class="doc-field"><span class="lbl">Phone</span><span class="val">${escapeHTML(v('lrRecPh'))}</span></div>`:''}
              <div class="doc-field"><span class="lbl">To</span><span class="val"><strong>${escapeHTML(v('lrTo'))}</strong></span></div>
            </div>
          </div>

          <!-- Vehicle & Driver -->
          <div class="doc-section-title">VEHICLE &amp; DRIVER DETAILS</div>
          <div class="doc-grid">
            <div class="doc-field"><span class="lbl">Vehicle No</span><span class="val"><strong>${escapeHTML(v('lrVehicle'))}</strong></span></div>
            <div class="doc-field"><span class="lbl">Vehicle Type</span><span class="val">${escapeHTML(v('lrVehicleType'))}</span></div>
            <div class="doc-field"><span class="lbl">Driver</span><span class="val">${escapeHTML(v('lrDriver'))}</span></div>
            <div class="doc-field"><span class="lbl">Driver Phone</span><span class="val">${escapeHTML(v('lrDriverPh'))}</span></div>
            ${v('lrDL')!=='—'?`<div class="doc-field"><span class="lbl">License No</span><span class="val">${escapeHTML(v('lrDL'))}</span></div>`:''}
            <div class="doc-field"><span class="lbl">Transporter</span><span class="val">${escapeHTML(v('lrTransporter'))}</span></div>
            ${v('lrTransGST')!=='—'?`<div class="doc-field"><span class="lbl">Trans. GSTIN</span><span class="val">${escapeHTML(v('lrTransGST'))}</span></div>`:''}
          </div>

          <!-- Goods Table -->
          <table class="doc-table" style="margin-top:12px">
            <tr>
              <th>Description of Goods</th><th>HSN</th><th>Packages</th>
              <th>Packing</th><th>Gross Wt</th><th>Charged Wt</th><th>Decl. Value</th><th>Risk</th>
            </tr>
            <tr>
              <td><strong>${escapeHTML(v('lrGoods'))}</strong></td>
              <td>${escapeHTML(v('lrHSN'))}</td>
              <td>${escapeHTML(v('lrPkgs'))}</td>
              <td>${escapeHTML(v('lrPacking'))}</td>
              <td>${escapeHTML(v('lrWeight'))}</td>
              <td>${escapeHTML(v('lrChargeWt'))}</td>
              <td>${v('lrValue')!=='—'?sym+LD.fmt(+document.getElementById('lrValue')?.value||0):'—'}</td>
              <td>${escapeHTML(v('lrRisk'))}</td>
            </tr>
          </table>

          <!-- Delivery & Notes -->
          <div class="doc-grid" style="margin-top:10px">
            <div class="doc-field"><span class="lbl">Delivery Type</span><span class="val">${escapeHTML(v('lrDel'))}</span></div>
            ${v('lrETA')!=='—'?`<div class="doc-field"><span class="lbl">Expected Delivery</span><span class="val">${LD.dateStr(v('lrETA'))}</span></div>`:''}
          </div>
          ${v('lrNotes')!=='—'?`<div class="note-box"><strong>Special Instructions:</strong> ${escapeHTML(v('lrNotes'))}</div>`:''}

          <!-- Freight Table -->
          <table class="doc-table" style="margin-top:12px">
            <tr><th style="text-align:left">Charge Head</th><th style="text-align:right">Amount (${sym})</th></tr>
            <tr><td>Basic Freight</td><td style="text-align:right">${LD.fmt(freight)}</td></tr>
            ${load?`<tr><td>Loading Charges</td><td style="text-align:right">${LD.fmt(load)}</td></tr>`:''}
            ${gst>0?`<tr><td>CGST @ ${gst/2}%</td><td style="text-align:right">${LD.fmt(cgst)}</td></tr>
            <tr><td>SGST @ ${gst/2}%</td><td style="text-align:right">${LD.fmt(sgst)}</td></tr>`:''}
            ${adv?`<tr><td>Advance Paid</td><td style="text-align:right;color:green">— ${LD.fmt(adv)}</td></tr>`:''}
          </table>
          <div class="doc-total"><span>BALANCE DUE</span><span class="doc-total-val">${sym} ${LD.fmt(balance)}</span></div>
          <div class="doc-words">${LD.numberToWords(balance)}</div>

          <!-- Terms -->
          <div style="font-size:10px;color:#777;margin:10px 0;padding:8px;border:1px solid #eee;border-radius:6px;line-height:1.6">
            <strong>Terms &amp; Conditions:</strong> 1. Goods accepted subject to conditions on back hereof.
            2. Consignee liable for demurrage/detention after free time.
            3. Transporter not liable for inherent defects in goods.
            4. In case of loss/damage, claim must be lodged within 7 days of delivery.
            5. Disputes subject to jurisdiction of ${escapeHTML(v('lrFrom'))} courts only.
          </div>

          <!-- Signatures -->
          <div class="doc-sigs">
            <div class="sig-box"><div class="stamp-box">COMPANY SEAL</div><div class="sig-lbl">Consignor Signature</div></div>
            <div class="sig-box"><div class="stamp-box">STAMP</div><div class="sig-lbl">Transporter / Driver</div></div>
            <div class="sig-box"><div class="stamp-box">RECEIVED</div><div class="sig-lbl">Consignee Signature</div></div>
          </div>
          <div class="sx-doc-footer">
            <div class="sx-doc-footer-brand">
              <span class="sx-mini-mark">SX</span><span>STRATIX</span>
              <span style="color:#ccc">&nbsp;· Business Intelligence Platform</span>
            </div>
            <div>${new Date().toLocaleString('en-IN')} · ${escapeHTML(s.businessName||'')}</div>
          </div>
        </div></div>
      </div>`);
  },

  /* ── 2. E-WAY BILL ── */
  ewayForm() {
    const s = STRATIX_DB.getSettings(), sym = LD.sym();
    const validDays = d => d <= 100 ? 1 : d <= 300 ? 3 : d <= 500 ? 5 : d <= 1000 ? 10 : 15;
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="doc-form" style="max-width:780px">
        <h3 style="margin-bottom:4px">🛂 E-Way Bill Generator</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:18px">
          CGST Rule 138 — Required for goods movement exceeding ₹50,000 in value
        </p>

        <div class="doc-section-title">📋 PART A — Supply Details</div>
        <div class="doc-fields">
          <div class="field"><label>E-Way Bill No</label><input id="ewNo" value="EWB-${Date.now().toString().slice(-10)}"/></div>
          <div class="field"><label>Generated Date &amp; Time</label><input type="datetime-local" id="ewDate" value="${new Date().toISOString().slice(0,16)}"/></div>
          <div class="field"><label>Transaction Type</label>
            <select id="ewTxn">
              <option>1 — Outward Supply</option><option>2 — Inward Supply</option>
              <option>3 — Job Work</option><option>4 — SKD/CKD</option>
              <option>5 — Recipient Not Known</option><option>6 — For Own Use</option>
              <option>7 — Exhibition / Fairs</option><option>8 — Line Sales</option>
              <option>9 — Others</option>
            </select>
          </div>
          <div class="field"><label>Document Type</label>
            <select id="ewDocType">
              <option>Tax Invoice</option><option>Bill of Supply</option><option>Delivery Challan</option>
              <option>Credit Note</option><option>Bill of Entry</option><option>Others</option>
            </select>
          </div>
          <div class="field"><label>Invoice / Doc Number *</label><input id="ewDocNo" placeholder="INV-2425-001"/></div>
          <div class="field"><label>Invoice Date</label><input type="date" id="ewInvDate" value="${LD.today()}"/></div>
        </div>

        <div class="doc-section-title">🏭 Supplier Details</div>
        <div class="doc-fields">
          <div class="field"><label>Supplier GSTIN *</label><input id="ewSupGST" value="${s.gstNumber||''}" placeholder="22AAAAA0000A1Z5"/></div>
          <div class="field"><label>Supplier Name *</label><input id="ewSupName" value="${s.businessName||''}" placeholder="Supplier Company"/></div>
          <div class="field" style="grid-column:1/-1"><label>Supplier Address</label><input id="ewSupAddr" value="${s.address||''}" placeholder="Supplier full address"/></div>
          <div class="field"><label>Place of Supply (State)</label><input id="ewSupplyState" placeholder="Maharashtra (27)"/></div>
        </div>

        <div class="doc-section-title">🏢 Recipient Details</div>
        <div class="doc-fields">
          <div class="field"><label>Recipient GSTIN *</label><input id="ewRecGST" placeholder="27BBBBB0000B1Z5 or URP"/></div>
          <div class="field"><label>Recipient Name *</label><input id="ewRecName" placeholder="Receiving Company"/></div>
          <div class="field" style="grid-column:1/-1"><label>Recipient Address</label><input id="ewRecAddr" placeholder="Delivery address with pincode"/></div>
          <div class="field"><label>Place of Delivery (State)</label><input id="ewDeliveryState" placeholder="Delhi (07)"/></div>
          <div class="field"><label>Delivery Pincode</label><input id="ewPin" placeholder="110001"/></div>
        </div>

        <div class="doc-section-title">📦 Goods Details</div>
        <div class="doc-fields">
          <div class="field"><label>Product / Goods Name *</label><input id="ewProd" placeholder="Steel Rods / Cement / Auto Parts"/></div>
          <div class="field"><label>HSN / SAC Code *</label><input id="ewHSN" placeholder="7214 (steel bars), 2523 (cement)"/></div>
          <div class="field"><label>Quantity</label><input id="ewQty" placeholder="500 kg / 10 MT / 100 nos"/></div>
          <div class="field"><label>Unit</label>
            <select id="ewUnit">
              <option>KGS</option><option>TON</option><option>MTR</option><option>NOS</option>
              <option>LTR</option><option>BOX</option><option>PKT</option><option>SET</option><option>OTH</option>
            </select>
          </div>
          <div class="field"><label>Taxable Value (${sym}) *</label><input type="number" id="ewValue" placeholder="500000" oninput="LDOC.ewCalc()"/></div>
          <div class="field"><label>GST Rate</label>
            <select id="ewGST" onchange="LDOC.ewCalc()">
              <option value="0">0%</option><option value="5">5%</option><option value="12">12%</option>
              <option value="18" selected>18%</option><option value="28">28%</option>
            </select>
          </div>
          <div class="field"><label>Cess (%)</label><input type="number" id="ewCess" placeholder="0" value="0" oninput="LDOC.ewCalc()"/></div>
        </div>
        <div id="ewTotals" class="inv-totals" style="margin-bottom:16px"></div>

        <div class="doc-section-title">🚛 PART B — Vehicle / Transport Details</div>
        <div class="doc-fields">
          <div class="field"><label>Vehicle Number *</label><input id="ewVeh" placeholder="MH12AB1234"/></div>
          <div class="field"><label>Vehicle Type</label>
            <select id="ewVehType">
              <option>Regular</option><option>Over Dimensional Cargo (ODC)</option>
              <option>Multimodal</option><option>Rail</option><option>Air</option><option>Ship</option>
            </select>
          </div>
          <div class="field"><label>Transporter Name</label><input id="ewTransporter" value="${s.businessName||''}" placeholder="Transport Company"/></div>
          <div class="field"><label>Transporter ID / GSTIN</label><input id="ewTransId" value="${s.gstNumber||''}" placeholder="Trans GSTIN or TRAN ID"/></div>
          <div class="field"><label>Distance (km) *</label>
            <input type="number" id="ewDist" placeholder="250" oninput="LDOC.ewUpdateValidity()"/>
          </div>
          <div class="field"><label>Valid Till (Auto-calculated)</label>
            <input type="date" id="ewValid" value="${new Date(Date.now()+86400000).toISOString().split('T')[0]}"/>
          </div>
          <div class="field"><label>Mode of Transport</label>
            <select id="ewMode">
              <option value="1">Road</option><option value="2">Rail</option>
              <option value="3">Air</option><option value="4">Ship</option>
            </select>
          </div>
          <div class="field"><label>LR / RR / Airway Bill No</label><input id="ewLR" placeholder="LR-123456"/></div>
        </div>
        <button class="btn-calc" style="margin-top:16px" onclick="LDOC.printEway()">🖨️ Generate E-Way Bill — Print / PDF</button>
      </div>`);
    this.ewCalc();
  },

  ewCalc() {
    const val  = +document.getElementById('ewValue')?.value||0;
    const gst  = +document.getElementById('ewGST')?.value||18;
    const cess = +document.getElementById('ewCess')?.value||0;
    const sym  = LD.sym();
    const cgst = val*(gst/2)/100, sgst = val*(gst/2)/100;
    const cessAmt = val*cess/100;
    const total = val + cgst + sgst + cessAmt;
    const el = document.getElementById('ewTotals');
    if (!el) return;
    el.innerHTML = `
      <div class="inv-row"><span>Taxable Value</span><span>${sym}${LD.fmt(val)}</span></div>
      ${gst>0?`<div class="inv-row"><span>CGST @${gst/2}%</span><span>${sym}${LD.fmt(cgst)}</span></div>
      <div class="inv-row"><span>SGST @${gst/2}%</span><span>${sym}${LD.fmt(sgst)}</span></div>`:''}
      ${cessAmt?`<div class="inv-row"><span>Cess @${cess}%</span><span>${sym}${LD.fmt(cessAmt)}</span></div>`:''}
      <div class="inv-row total"><span>Total Invoice Value</span><span style="color:var(--gold)">${sym}${LD.fmt(total)}</span></div>`;
  },

  ewUpdateValidity() {
    const dist = +document.getElementById('ewDist')?.value||0;
    if (!dist) return;
    const days = dist <= 100?1: dist<=300?3: dist<=500?5: dist<=1000?10:15;
    const d = new Date(Date.now() + days*86400000);
    const el = document.getElementById('ewValid');
    if (el) el.value = d.toISOString().split('T')[0];
  },

  printEway() {
    const s = STRATIX_DB.getSettings(), sym = LD.sym();
    const v = id => document.getElementById(id)?.value||'—';
    const n = id => +document.getElementById(id)?.value||0;
    const val=n('ewValue'), gst=n('ewGST'), cess=n('ewCess');
    const cgst=val*(gst/2)/100, sgst=val*(gst/2)/100, cessAmt=val*cess/100;
    const total=val+cgst+sgst+cessAmt;
    const dist=n('ewDist');
    const days = dist<=100?1: dist<=300?3: dist<=500?5: dist<=1000?10:15;

    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="print-doc">
        <div class="doc-border"><div class="doc-border-inner">

          <!-- EWB Header -->
          <div style="text-align:center;border-bottom:2px solid #2563EB;padding-bottom:12px;margin-bottom:14px">
            <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px">
              <div class="sx-doc-mark">SX</div>
              <div>
                <div style="font-size:20px;font-weight:800;letter-spacing:1px">E-WAY BILL</div>
                <div style="font-size:11px;color:#555">As per CGST Rule 138 | GST EWB-01</div>
              </div>
            </div>
            <div style="display:flex;justify-content:center;gap:30px;font-size:12px;margin-top:6px">
              <span><strong>EWB No:</strong> ${escapeHTML(v('ewNo'))}</span>
              <span><strong>Generated:</strong> ${new Date(v('ewDate')).toLocaleString('en-IN')}</span>
              <span><strong>Valid Till:</strong> <span style="color:#d32f2f;font-weight:700">${LD.dateStr(v('ewValid'))} (${days} day${days>1?'s':''})</span></span>
            </div>
          </div>

          <!-- Part A -->
          <div style="font-weight:800;font-size:12px;color:#2563EB;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;border-bottom:1px solid #2563EB;padding-bottom:4px">
            PART A — SUPPLY DETAILS
          </div>
          <div class="doc-grid" style="margin-bottom:12px">
            <div>
              <div style="font-weight:700;font-size:11px;color:#444;margin-bottom:6px">SUPPLIER</div>
              <div class="doc-field"><span class="lbl">GSTIN</span><span class="val"><strong>${escapeHTML(v('ewSupGST'))}</strong></span></div>
              <div class="doc-field"><span class="lbl">Name</span><span class="val">${escapeHTML(v('ewSupName'))}</span></div>
              ${v('ewSupAddr')!=='—'?`<div class="doc-field"><span class="lbl">Address</span><span class="val">${escapeHTML(v('ewSupAddr'))}</span></div>`:''}
              <div class="doc-field"><span class="lbl">Place of Supply</span><span class="val">${escapeHTML(v('ewSupplyState'))}</span></div>
            </div>
            <div>
              <div style="font-weight:700;font-size:11px;color:#444;margin-bottom:6px">RECIPIENT</div>
              <div class="doc-field"><span class="lbl">GSTIN</span><span class="val"><strong>${escapeHTML(v('ewRecGST'))}</strong></span></div>
              <div class="doc-field"><span class="lbl">Name</span><span class="val">${escapeHTML(v('ewRecName'))}</span></div>
              ${v('ewRecAddr')!=='—'?`<div class="doc-field"><span class="lbl">Address</span><span class="val">${escapeHTML(v('ewRecAddr'))}</span></div>`:''}
              <div class="doc-field"><span class="lbl">Delivery State</span><span class="val">${escapeHTML(v('ewDeliveryState'))}</span></div>
              ${v('ewPin')!=='—'?`<div class="doc-field"><span class="lbl">Pincode</span><span class="val">${escapeHTML(v('ewPin'))}</span></div>`:''}
            </div>
          </div>

          <!-- Doc Details -->
          <div class="doc-grid" style="margin-bottom:12px">
            <div class="doc-field"><span class="lbl">Transaction Type</span><span class="val">${escapeHTML(v('ewTxn'))}</span></div>
            <div class="doc-field"><span class="lbl">Document Type</span><span class="val">${escapeHTML(v('ewDocType'))}</span></div>
            <div class="doc-field"><span class="lbl">Document No</span><span class="val"><strong>${escapeHTML(v('ewDocNo'))}</strong></span></div>
            <div class="doc-field"><span class="lbl">Document Date</span><span class="val">${LD.dateStr(v('ewInvDate'))}</span></div>
          </div>

          <!-- Goods Table -->
          <table class="doc-table">
            <tr>
              <th>Goods Description</th><th>HSN / SAC</th><th>Qty</th><th>Unit</th>
              <th style="text-align:right">Taxable Value</th><th style="text-align:right">CGST</th>
              <th style="text-align:right">SGST</th>${cess?`<th style="text-align:right">Cess</th>`:''}
              <th style="text-align:right">Total Value</th>
            </tr>
            <tr>
              <td><strong>${escapeHTML(v('ewProd'))}</strong></td>
              <td>${escapeHTML(v('ewHSN'))}</td>
              <td>${escapeHTML(v('ewQty'))}</td>
              <td>${escapeHTML(v('ewUnit'))}</td>
              <td style="text-align:right">${sym}${LD.fmt(val)}</td>
              <td style="text-align:right">${sym}${LD.fmt(cgst)}<br/><span style="font-size:9px;color:#888">@${gst/2}%</span></td>
              <td style="text-align:right">${sym}${LD.fmt(sgst)}<br/><span style="font-size:9px;color:#888">@${gst/2}%</span></td>
              ${cess?`<td style="text-align:right">${sym}${LD.fmt(cessAmt)}</td>`:''}
              <td style="text-align:right"><strong>${sym}${LD.fmt(total)}</strong></td>
            </tr>
          </table>
          <div class="doc-total"><span>TOTAL INVOICE VALUE</span><span class="doc-total-val">${sym} ${LD.fmt(total)}</span></div>
          <div class="doc-words">${LD.numberToWords(total)}</div>

          <!-- Part B -->
          <div style="font-weight:800;font-size:12px;color:#2563EB;text-transform:uppercase;letter-spacing:.6px;margin:14px 0 8px;border-bottom:1px solid #2563EB;padding-bottom:4px">
            PART B — VEHICLE / TRANSPORT DETAILS
          </div>
          <div class="doc-grid">
            <div class="doc-field"><span class="lbl">Vehicle No</span><span class="val"><strong style="font-size:14px">${escapeHTML(v('ewVeh'))}</strong></span></div>
            <div class="doc-field"><span class="lbl">Vehicle Type</span><span class="val">${escapeHTML(v('ewVehType'))}</span></div>
            <div class="doc-field"><span class="lbl">Mode</span><span class="val">${escapeHTML(v('ewMode'))==='1'?'Road':v('ewMode')==='2'?'Rail':v('ewMode')==='3'?'Air':'Ship'}</span></div>
            <div class="doc-field"><span class="lbl">Distance</span><span class="val">${dist} km</span></div>
            <div class="doc-field"><span class="lbl">Transporter</span><span class="val">${escapeHTML(v('ewTransporter'))}</span></div>
            <div class="doc-field"><span class="lbl">Trans. ID/GSTIN</span><span class="val">${escapeHTML(v('ewTransId'))}</span></div>
            ${v('ewLR')!=='—'?`<div class="doc-field"><span class="lbl">LR / RR No</span><span class="val">${escapeHTML(v('ewLR'))}</span></div>`:''}
          </div>

          <!-- Validity Box -->
          <div style="margin:14px 0;padding:10px 14px;background:#fff8e1;border:1px solid #f0c040;border-radius:8px;font-size:12px">
            <strong>⏰ Validity:</strong> This E-Way Bill is valid for <strong>${days} day${days>1?'s':''}</strong> from date of generation
            (up to <strong style="color:#d32f2f">${LD.dateStr(v('ewValid'))}</strong>).
            For ODC cargo, validity is 20% of normal.
            Extension can be obtained on the GST portal within 8 hours before / after expiry.
          </div>

          <!-- Compliance Note -->
          <div style="margin:8px 0;padding:10px 14px;background:#e3f2fd;border:1px solid #90caf9;border-radius:8px;font-size:11px;color:#1565c0">
            📌 <strong>Important:</strong> This document is computer-generated by STRATIX.
            The actual EWB must be generated on <strong>ewaybillgst.gov.in</strong> using your GSTIN credentials.
            Penalty for non-compliance: ₹10,000 or equivalent tax amount (whichever is higher) + detention of goods.
          </div>

          <div class="sx-doc-footer">
            <div class="sx-doc-footer-brand">
              <span class="sx-mini-mark">SX</span><span>STRATIX</span>
              <span style="color:#ccc">&nbsp;· Business Intelligence Platform</span>
            </div>
            <div>${new Date().toLocaleString('en-IN')} · ${escapeHTML(s.businessName||'')}</div>
          </div>
        </div></div>
      </div>`);
  },

  /* ── 3. FREIGHT INVOICE ── */
  freightForm() {
    const s = STRATIX_DB.getSettings(), sym = LD.sym();
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="doc-form" style="max-width:780px">
        <h3 style="margin-bottom:4px">🧾 Freight Invoice</h3>
        <p style="font-size:12px;color:var(--muted);margin-bottom:18px">GST Tax Invoice for Freight / Transport Service (GTA)</p>

        <div class="doc-section-title">📄 Invoice Details</div>
        <div class="doc-fields">
          <div class="field"><label>Invoice Number *</label><input id="fi_no" value="${LD.id('FINV')}"/></div>
          <div class="field"><label>Invoice Date *</label><input type="date" id="fi_date" value="${LD.today()}"/></div>
          <div class="field"><label>LR / Bill of Lading No</label><input id="fi_lr" placeholder="LR-123456"/></div>
          <div class="field"><label>Payment Terms</label>
            <select id="fi_terms">
              <option>To Pay (Consignee pays on delivery)</option>
              <option>Paid (Consignor already paid)</option>
              <option>TBB (To Be Billed)</option>
              <option>Credit — 15 Days</option>
              <option>Credit — 30 Days</option>
              <option>Credit — 45 Days</option>
            </select>
          </div>
        </div>

        <div class="doc-section-title">🏭 Supplier / Transporter</div>
        <div class="doc-fields">
          <div class="field"><label>Transporter Name</label><input id="fi_sup" value="${s.businessName||''}" placeholder="Transport Co."/></div>
          <div class="field"><label>Transporter GSTIN</label><input id="fi_supgst" value="${s.gstNumber||''}" placeholder="22XXXXX0000X1Z5"/></div>
          <div class="field" style="grid-column:1/-1"><label>Transporter Address</label><input id="fi_supaddr" value="${s.address||''}" placeholder="Full address"/></div>
          <div class="field"><label>SAC Code (Transport)</label><input id="fi_sac" value="996511" placeholder="996511 (road), 996512 (rail)"/></div>
        </div>

        <div class="doc-section-title">🏢 Bill To (Client)</div>
        <div class="doc-fields">
          <div class="field"><label>Client Name *</label><input id="fi_client" placeholder="Client company name"/></div>
          <div class="field"><label>Client GSTIN</label><input id="fi_cgst" placeholder="27XXXXX0000X1Z5"/></div>
          <div class="field" style="grid-column:1/-1"><label>Client Address</label><input id="fi_caddr" placeholder="Full billing address"/></div>
          <div class="field"><label>Client Phone</label><input id="fi_cph" placeholder="+91"/></div>
          <div class="field"><label>PO / Reference No</label><input id="fi_ref" placeholder="PO-2024-001 (optional)"/></div>
        </div>

        <div class="doc-section-title">🚚 Shipment Details</div>
        <div class="doc-fields">
          <div class="field"><label>From (Origin)</label><input id="fi_from" placeholder="Mumbai, Maharashtra"/></div>
          <div class="field"><label>To (Destination)</label><input id="fi_to" placeholder="Delhi"/></div>
          <div class="field"><label>Vehicle Number</label><input id="fi_veh" placeholder="MH12AB1234"/></div>
          <div class="field"><label>Consignor</label><input id="fi_consignor" placeholder="Goods sender name"/></div>
          <div class="field"><label>Consignee</label><input id="fi_consignee" placeholder="Goods receiver name"/></div>
          <div class="field"><label>Description of Goods</label><input id="fi_goods" placeholder="Goods transported"/></div>
          <div class="field"><label>Weight</label><input id="fi_wt" placeholder="10 tons"/></div>
          <div class="field"><label>E-Way Bill No</label><input id="fi_ewb" placeholder="If applicable"/></div>
        </div>

        <div class="doc-section-title">💰 Charges</div>
        <div class="doc-fields">
          <div class="field"><label>Basic Freight (${sym}) *</label><input type="number" id="fi_freight" placeholder="25000" oninput="LDOC.fiCalc()"/></div>
          <div class="field"><label>Loading Charges (${sym})</label><input type="number" id="fi_load" placeholder="0" oninput="LDOC.fiCalc()"/></div>
          <div class="field"><label>Unloading Charges (${sym})</label><input type="number" id="fi_unload" placeholder="0" oninput="LDOC.fiCalc()"/></div>
          <div class="field"><label>Detention / Demurrage (${sym})</label><input type="number" id="fi_det" placeholder="0" oninput="LDOC.fiCalc()"/></div>
          <div class="field"><label>Fuel Surcharge (${sym})</label><input type="number" id="fi_fuel" placeholder="0" oninput="LDOC.fiCalc()"/></div>
          <div class="field"><label>Other Charges (${sym})</label><input type="number" id="fi_other" placeholder="0" oninput="LDOC.fiCalc()"/></div>
          <div class="field"><label>GST on Freight (%)</label>
            <select id="fi_gst" onchange="LDOC.fiCalc()">
              <option value="0">0% — GTA Exempt / RCM</option>
              <option value="5" selected>5% — GTA (Forward Charge)</option>
              <option value="12">12%</option><option value="18">18%</option>
            </select>
          </div>
          <div class="field"><label>Advance / TDS Deducted (${sym})</label><input type="number" id="fi_adv" placeholder="0" oninput="LDOC.fiCalc()"/></div>
        </div>
        <div id="fi_totals" class="inv-totals" style="margin-top:12px"></div>
        <button class="btn-calc" style="margin-top:16px" onclick="LDOC.printFreight()">🖨️ Generate Freight Invoice — Print / PDF</button>
      </div>`);
    this.fiCalc();
  },

  fiCalc() {
    const freight=+document.getElementById('fi_freight')?.value||0;
    const load=+document.getElementById('fi_load')?.value||0;
    const unload=+document.getElementById('fi_unload')?.value||0;
    const det=+document.getElementById('fi_det')?.value||0;
    const fuel=+document.getElementById('fi_fuel')?.value||0;
    const other=+document.getElementById('fi_other')?.value||0;
    const gst=+document.getElementById('fi_gst')?.value||5;
    const adv=+document.getElementById('fi_adv')?.value||0;
    const sym = LD.sym();
    const subtotal=freight+load+unload+det+fuel+other;
    const cgst=subtotal*(gst/2)/100, sgst=subtotal*(gst/2)/100;
    const total=subtotal+cgst+sgst;
    const balance=total-adv;
    const el=document.getElementById('fi_totals');
    if(!el) return;
    el.innerHTML=`
      <div class="inv-row"><span>Basic Freight</span><span>${sym}${LD.fmt(freight)}</span></div>
      ${load?`<div class="inv-row"><span>Loading</span><span>${sym}${LD.fmt(load)}</span></div>`:''}
      ${unload?`<div class="inv-row"><span>Unloading</span><span>${sym}${LD.fmt(unload)}</span></div>`:''}
      ${det?`<div class="inv-row"><span>Detention</span><span>${sym}${LD.fmt(det)}</span></div>`:''}
      ${fuel?`<div class="inv-row"><span>Fuel Surcharge</span><span>${sym}${LD.fmt(fuel)}</span></div>`:''}
      ${other?`<div class="inv-row"><span>Other Charges</span><span>${sym}${LD.fmt(other)}</span></div>`:''}
      <div class="inv-row"><span>Subtotal</span><span>${sym}${LD.fmt(subtotal)}</span></div>
      ${gst>0?`<div class="inv-row"><span>CGST @${gst/2}%</span><span>${sym}${LD.fmt(cgst)}</span></div>
      <div class="inv-row"><span>SGST @${gst/2}%</span><span>${sym}${LD.fmt(sgst)}</span></div>`:''}
      <div class="inv-row"><span>Gross Total</span><span style="font-weight:700">${sym}${LD.fmt(total)}</span></div>
      ${adv?`<div class="inv-row"><span>Less: Advance / TDS</span><span style="color:var(--green)">— ${sym}${LD.fmt(adv)}</span></div>`:''}
      <div class="inv-row total"><span>Net Amount Due</span><span style="color:var(--gold)">${sym}${LD.fmt(balance)}</span></div>`;
  },

  printFreight() {
    const s=STRATIX_DB.getSettings(), sym=LD.sym();
    const v = id => document.getElementById(id)?.value||'—';
    const n = id => +document.getElementById(id)?.value||0;
    const freight=n('fi_freight'),load=n('fi_load'),unload=n('fi_unload');
    const det=n('fi_det'),fuel=n('fi_fuel'),other=n('fi_other');
    const gst=n('fi_gst'),adv=n('fi_adv');
    const subtotal=freight+load+unload+det+fuel+other;
    const cgst=subtotal*(gst/2)/100, sgst=subtotal*(gst/2)/100;
    const total=subtotal+cgst+sgst, balance=total-adv;
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="print-doc">
        <div class="doc-header">
          <div class="sx-doc-brand">
            <div class="sx-doc-mark">SX</div>
            <div>
              <div class="doc-co">${escapeHTML(s.businessName||'Your Company')}</div>
              <div class="doc-co-sub">
                ${s.address?escapeHTML(s.address)+'<br/>':''}
                ${s.gstNumber?'GSTIN: '+escapeHTML(s.gstNumber):''}
                ${s.panNumber?' | PAN: '+escapeHTML(s.panNumber):''}
                ${s.phone?' | Ph: '+escapeHTML(s.phone):''}
              </div>
            </div>
          </div>
          <div style="text-align:right">
            <div class="doc-title">FREIGHT INVOICE</div>
            <div class="doc-no">Invoice No: <strong>${escapeHTML(v('fi_no'))}</strong></div>
            <div class="doc-no">Date: <strong>${LD.dateStr(v('fi_date'))}</strong></div>
            <div class="doc-no">LR No: ${escapeHTML(v('fi_lr'))}</div>
            <div class="doc-no">SAC: ${escapeHTML(v('fi_sac'))}</div>
          </div>
        </div>

        <!-- Bill To / Shipment -->
        <div class="doc-grid" style="margin-bottom:10px">
          <div style="border:1px solid #e8dfc0;border-radius:6px;padding:10px">
            <div class="doc-section-title" style="margin-top:0">BILL TO</div>
            <div class="doc-field"><span class="lbl">Name</span><span class="val"><strong>${escapeHTML(v('fi_client'))}</strong></span></div>
            ${v('fi_cgst')!=='—'?`<div class="doc-field"><span class="lbl">GSTIN</span><span class="val">${escapeHTML(v('fi_cgst'))}</span></div>`:''}
            ${v('fi_caddr')!=='—'?`<div class="doc-field"><span class="lbl">Address</span><span class="val">${escapeHTML(v('fi_caddr'))}</span></div>`:''}
            ${v('fi_cph')!=='—'?`<div class="doc-field"><span class="lbl">Phone</span><span class="val">${escapeHTML(v('fi_cph'))}</span></div>`:''}
            ${v('fi_ref')!=='—'?`<div class="doc-field"><span class="lbl">PO / Ref</span><span class="val">${escapeHTML(v('fi_ref'))}</span></div>`:''}
          </div>
          <div style="border:1px solid #e8dfc0;border-radius:6px;padding:10px">
            <div class="doc-section-title" style="margin-top:0">SHIPMENT</div>
            <div class="doc-field"><span class="lbl">Route</span><span class="val"><strong>${escapeHTML(v('fi_from'))} → ${escapeHTML(v('fi_to'))}</strong></span></div>
            <div class="doc-field"><span class="lbl">Vehicle No</span><span class="val">${escapeHTML(v('fi_veh'))}</span></div>
            <div class="doc-field"><span class="lbl">Consignor</span><span class="val">${escapeHTML(v('fi_consignor'))}</span></div>
            <div class="doc-field"><span class="lbl">Consignee</span><span class="val">${escapeHTML(v('fi_consignee'))}</span></div>
            <div class="doc-field"><span class="lbl">Goods</span><span class="val">${escapeHTML(v('fi_goods'))}</span></div>
            <div class="doc-field"><span class="lbl">Weight</span><span class="val">${escapeHTML(v('fi_wt'))}</span></div>
            ${v('fi_ewb')!=='—'?`<div class="doc-field"><span class="lbl">E-Way Bill</span><span class="val">${escapeHTML(v('fi_ewb'))}</span></div>`:''}
            <div class="doc-field"><span class="lbl">Payment</span><span class="val">${escapeHTML(v('fi_terms'))}</span></div>
          </div>
        </div>

        <!-- Charges Table -->
        <table class="doc-table">
          <tr><th>Sl.</th><th>Description of Service</th><th>SAC</th><th style="text-align:right">Amount (${sym})</th></tr>
          <tr><td>1</td><td>Basic Freight Charges — ${escapeHTML(v('fi_from'))} to ${escapeHTML(v('fi_to'))}</td><td>${escapeHTML(v('fi_sac'))}</td><td style="text-align:right">${LD.fmt(freight)}</td></tr>
          ${load?`<tr><td>2</td><td>Loading / Handling Charges</td><td>${escapeHTML(v('fi_sac'))}</td><td style="text-align:right">${LD.fmt(load)}</td></tr>`:''}
          ${unload?`<tr><td></td><td>Unloading Charges</td><td></td><td style="text-align:right">${LD.fmt(unload)}</td></tr>`:''}
          ${det?`<tr><td></td><td>Detention / Demurrage</td><td></td><td style="text-align:right">${LD.fmt(det)}</td></tr>`:''}
          ${fuel?`<tr><td></td><td>Fuel Surcharge</td><td></td><td style="text-align:right">${LD.fmt(fuel)}</td></tr>`:''}
          ${other?`<tr><td></td><td>Other Charges</td><td></td><td style="text-align:right">${LD.fmt(other)}</td></tr>`:''}
          <tr><td colspan="3" style="text-align:right;font-weight:700">Taxable Value</td><td style="text-align:right;font-weight:700">${LD.fmt(subtotal)}</td></tr>
          ${gst>0?`<tr><td colspan="3" style="text-align:right">CGST @ ${gst/2}%</td><td style="text-align:right">${LD.fmt(cgst)}</td></tr>
          <tr><td colspan="3" style="text-align:right">SGST @ ${gst/2}%</td><td style="text-align:right">${LD.fmt(sgst)}</td></tr>`:''}
          ${adv?`<tr><td colspan="3" style="text-align:right;color:green">Less: Advance / TDS</td><td style="text-align:right;color:green">— ${LD.fmt(adv)}</td></tr>`:''}
        </table>
        <div class="doc-total"><span>NET AMOUNT DUE</span><span class="doc-total-val">${sym} ${LD.fmt(balance)}</span></div>
        <div class="doc-words">${LD.numberToWords(balance)}</div>

        <!-- Bank Details -->
        ${(s.bankName||s.bankAcc||s.upiId)?`<div style="margin-top:14px;padding:10px 14px;background:#f9f9f6;border:1px solid #e8dfc0;border-radius:8px;font-size:12px">
          <strong>Payment Details:</strong>
          ${s.bankName?` Bank: ${escapeHTML(s.bankName)}`:''}
          ${s.bankAcc?' | A/C: '+escapeHTML(s.bankAcc):''}
          ${s.bankIFSC?' | IFSC: '+escapeHTML(s.bankIFSC):''}
          ${s.upiId?' | UPI: '+escapeHTML(s.upiId):''}
        </div>`:''}

        <div class="doc-sigs">
          <div class="sig-box"><div class="stamp-box">COMPANY SEAL</div><div class="sig-lbl">Authorised Signatory</div></div>
          <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Prepared By</div></div>
          <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Client Acknowledgement</div></div>
        </div>
        <div style="font-size:10px;color:#888;margin-top:8px;text-align:center">
          Subject to ${escapeHTML(v('fi_from'))} jurisdiction only. Interest @18% p.a. charged on overdue amounts.
        </div>
        <div class="sx-doc-footer">
          <div class="sx-doc-footer-brand">
            <span class="sx-mini-mark">SX</span><span>STRATIX</span>
            <span style="color:#ccc">&nbsp;· Business Intelligence Platform</span>
          </div>
          <div>${new Date().toLocaleString('en-IN')} · ${escapeHTML(s.businessName||'')}</div>
        </div>
      </div>`);
  },

  /* ── 4. TRUCK HIRE AGREEMENT ── */
  hireForm() {
    const s=STRATIX_DB.getSettings(),sym=LD.sym();
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="doc-form" style="max-width:720px">
        <h3 style="margin-bottom:18px">🤝 Truck Hire Agreement</h3>
        <div class="doc-fields">
          <div class="field"><label>Agreement No</label><input id="ha_no" value="${LD.id('THA')}"/></div>
          <div class="field"><label>Date</label><input type="date" id="ha_date" value="${LD.today()}"/></div>
          <div class="field"><label>Hirer (Client Name)</label><input id="ha_hirer" placeholder="Company hiring the truck"/></div>
          <div class="field"><label>Hirer GSTIN</label><input id="ha_hirergst" placeholder="27XXXXX0000X1Z5"/></div>
          <div class="field"><label>Truck Owner (Your Name/Co.)</label><input id="ha_owner" value="${s.ownerName||s.businessName||''}"/></div>
          <div class="field"><label>Vehicle Number</label><input id="ha_veh" placeholder="MH12AB1234"/></div>
          <div class="field"><label>Vehicle Type</label><select id="ha_vtype"><option>Tata 407</option><option>Tata 1109</option><option>Ashok Leyland 1616</option><option>Tata Prima</option><option>Eicher 20.16</option><option>Container 20ft</option><option>Container 40ft</option><option>Trailer</option><option>Other</option></select></div>
          <div class="field"><label>Driver Name</label><input id="ha_driver" placeholder="Ramesh Kumar"/></div>
          <div class="field"><label>Driver License No</label><input id="ha_dlno" placeholder="MH1420210012345"/></div>
          <div class="field"><label>Hire From Date</label><input type="date" id="ha_from" value="${LD.today()}"/></div>
          <div class="field"><label>Hire To Date</label><input type="date" id="ha_to" value="${new Date(Date.now()+7*86400000).toISOString().split('T')[0]}"/></div>
          <div class="field"><label>Route / Purpose</label><input id="ha_route" placeholder="Mumbai to Delhi — Goods Transport"/></div>
          <div class="field"><label>Hire Charges (${sym})</label><input type="number" id="ha_charges" placeholder="45000"/></div>
          <div class="field"><label>Advance Amount (${sym})</label><input type="number" id="ha_advance" placeholder="15000"/></div>
          <div class="field"><label>Fuel Responsibility</label><select id="ha_fuel"><option>Hirer pays fuel</option><option>Owner pays fuel</option><option>Split equally</option></select></div>
          <div class="field"><label>Toll Responsibility</label><select id="ha_toll"><option>Hirer pays tolls</option><option>Owner pays tolls</option></select></div>
        </div>
        <button class="btn-calc" onclick="LDOC.printHire()">🖨️ Generate Agreement</button>
      </div>`);
  },

  printHire() {
    const s=STRATIX_DB.getSettings(),sym=LD.sym();
    const charges=+document.getElementById('ha_charges')?.value||0;
    const advance=+document.getElementById('ha_advance')?.value||0;
    const balance=charges-advance;
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="print-doc">
        <div style="text-align:center;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px">
          <div style="font-size:20px;font-weight:800">TRUCK HIRE AGREEMENT</div>
          <div style="font-size:11px;color:#555">Agreement No: ${document.getElementById('ha_no')?.value||''} | Date: ${LD.dateStr(document.getElementById('ha_date')?.value||LD.today())}</div>
        </div>
        <p style="font-size:13px;line-height:1.8;margin-bottom:14px">This Truck Hire Agreement is entered into between <strong>${document.getElementById('ha_hirer')?.value||'___________'}</strong> (hereinafter referred to as the "Hirer") and <strong>${document.getElementById('ha_owner')?.value||'___________'}</strong> (hereinafter referred to as the "Owner/Transporter"), on the terms and conditions mentioned below:</p>
        <div class="doc-grid" style="margin-bottom:14px">
          <div>
            <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:#444">VEHICLE DETAILS</div>
            <div class="doc-field"><span class="lbl">Vehicle No</span><span class="val"><strong>${document.getElementById('ha_veh')?.value||'—'}</strong></span></div>
            <div class="doc-field"><span class="lbl">Vehicle Type</span><span class="val">${document.getElementById('ha_vtype')?.value||'—'}</span></div>
            <div class="doc-field"><span class="lbl">Driver</span><span class="val">${document.getElementById('ha_driver')?.value||'—'}</span></div>
            <div class="doc-field"><span class="lbl">License No</span><span class="val">${document.getElementById('ha_dlno')?.value||'—'}</span></div>
          </div>
          <div>
            <div style="font-weight:700;font-size:12px;margin-bottom:8px;color:#444">HIRE DETAILS</div>
            <div class="doc-field"><span class="lbl">Period</span><span class="val">${LD.dateStr(document.getElementById('ha_from')?.value||'')} to ${LD.dateStr(document.getElementById('ha_to')?.value||'')}</span></div>
            <div class="doc-field"><span class="lbl">Route</span><span class="val">${document.getElementById('ha_route')?.value||'—'}</span></div>
            <div class="doc-field"><span class="lbl">Fuel</span><span class="val">${document.getElementById('ha_fuel')?.value||'—'}</span></div>
            <div class="doc-field"><span class="lbl">Tolls</span><span class="val">${document.getElementById('ha_toll')?.value||'—'}</span></div>
          </div>
        </div>
        <table class="doc-table"><tr><th>Description</th><th>Amount (${sym})</th></tr>
          <tr><td>Total Hire Charges</td><td>${LD.fmt(charges)}</td></tr>
          <tr><td>Advance Paid</td><td style="color:green">- ${LD.fmt(advance)}</td></tr>
          <tr><td><strong>Balance Payable on Delivery</strong></td><td><strong>${LD.fmt(balance)}</strong></td></tr>
        </table>
        <div style="font-size:12px;line-height:2;margin-top:14px;padding:12px;border:1px solid #ddd;border-radius:6px">
          <strong>Terms & Conditions:</strong><br/>
          1. The hirer shall not sublet the vehicle without written consent of the owner.<br/>
          2. The vehicle shall be used only for the agreed route and purpose mentioned above.<br/>
          3. Any damages to vehicle caused by hirer's negligence shall be borne by the hirer.<br/>
          4. Driver's accommodation, daily allowance and overtime are Hirer's responsibility.<br/>
          5. In case of vehicle breakdown, owner is responsible for arranging alternative transport.<br/>
          6. Payment must be made in full upon delivery of goods at destination.<br/>
          7. Disputes shall be settled through mutual negotiation; jurisdiction: ${s.state||'Maharashtra'}.
        </div>
        <div class="doc-sigs" style="margin-top:20px">
          <div class="sig-box"><div class="stamp-box">OWNER SEAL</div><div class="sig-lbl">Owner/Transporter Signature<br/>${document.getElementById('ha_owner')?.value||''}</div></div>
          <div class="sig-box"><div class="stamp-box">HIRER SEAL</div><div class="sig-lbl">Hirer Signature<br/>${document.getElementById('ha_hirer')?.value||''}</div></div>
          <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Witness Signature<br/>Date: ___________</div></div>
        </div>
        <div class="sx-doc-footer">
            <div class="sx-doc-footer-brand">
              <span class="sx-mini-mark">SX</span>
              <span>STRATIX</span>
              <span style="color:#ccc">&nbsp;· Business Intelligence Platform</span>
            </div>
            <div>${new Date().toLocaleString('en-IN')}</div>
          </div>
      </div>`);
  },

  /* ── 5-10. SIMPLE FORM DOCS ── */
  consignForm() { this._simpleDocForm('consign',  '📦 Consignment Note',  [{id:'cn_no',lbl:'CN Number',v:LD.id('CN')},{id:'cn_date',lbl:'Date',t:'date',v:LD.today()},{id:'cn_from',lbl:'Origin'},{id:'cn_to',lbl:'Destination'},{id:'cn_shipper',lbl:'Shipper'},{id:'cn_receiver',lbl:'Receiver'},{id:'cn_veh',lbl:'Vehicle No'},{id:'cn_goods',lbl:'Goods Description'},{id:'cn_pkgs',lbl:'No. of Packages',t:'number'},{id:'cn_wt',lbl:'Weight'},{id:'cn_val',lbl:'Declared Value (₹)',t:'number'},{id:'cn_notes',lbl:'Remarks',ta:true}]); },
  challanForm() { this._simpleDocForm('challan',  '📋 Delivery Challan',  [{id:'dc_no',lbl:'Challan No',v:LD.id('DC')},{id:'dc_date',lbl:'Date',t:'date',v:LD.today()},{id:'dc_from',lbl:'Dispatched From'},{id:'dc_to',lbl:'Delivered To'},{id:'dc_ref',lbl:'Reference Order No'},{id:'dc_goods',lbl:'Goods Description'},{id:'dc_qty',lbl:'Quantity'},{id:'dc_uom',lbl:'Unit (kg/pcs/lots)'},{id:'dc_veh',lbl:'Vehicle No'},{id:'dc_driver',lbl:'Driver Name'},{id:'dc_notes',lbl:'Notes',ta:true}]); },
  podForm() { this._simpleDocForm('pod',      '✅ Proof of Delivery', [{id:'pod_no',lbl:'POD Number',v:LD.id('POD')},{id:'pod_date',lbl:'Delivery Date',t:'date',v:LD.today()},{id:'pod_lr',lbl:'LR Number'},{id:'pod_from',lbl:'Dispatched From'},{id:'pod_to',lbl:'Delivered To'},{id:'pod_goods',lbl:'Goods Description'},{id:'pod_pkgs',lbl:'Packages Received',t:'number'},{id:'pod_wt',lbl:'Weight Received'},{id:'pod_cond',lbl:'Condition of Goods'},{id:'pod_rcvr',lbl:'Receiver Name'},{id:'pod_phone',lbl:'Receiver Phone'},{id:'pod_notes',lbl:'Remarks',ta:true}]); },
  weighmentForm() { this._simpleDocForm('weighment','⚖️ Weighment Slip',    [{id:'wt_no',lbl:'Slip No',v:LD.id('WT')},{id:'wt_date',lbl:'Date & Time',t:'datetime-local',v:new Date().toISOString().slice(0,16)},{id:'wt_veh',lbl:'Vehicle No'},{id:'wt_driver',lbl:'Driver Name'},{id:'wt_gross',lbl:'Gross Weight (kg)',t:'number'},{id:'wt_tare',lbl:'Tare Weight (kg)',t:'number'},{id:'wt_net',lbl:'Net Weight (kg)',t:'number'},{id:'wt_goods',lbl:'Goods Description'},{id:'wt_from',lbl:'From'},{id:'wt_to',lbl:'To'},{id:'wt_op',lbl:'Weighbridge Operator'}]); },
  fuellogsForm() { this._simpleDocForm('fuellog',  '⛽ Fuel Logbook Entry', [{id:'fl_date',lbl:'Date',t:'date',v:LD.today()},{id:'fl_veh',lbl:'Vehicle No'},{id:'fl_driver',lbl:'Driver Name'},{id:'fl_route',lbl:'Route'},{id:'fl_dist',lbl:'Distance (km)',t:'number'},{id:'fl_litres',lbl:'Fuel Filled (Litres)',t:'number'},{id:'fl_rate',lbl:'Rate per Litre (₹)',t:'number'},{id:'fl_cost',lbl:'Total Fuel Cost (₹)',t:'number'},{id:'fl_odo_start',lbl:'Odometer Start'},{id:'fl_odo_end',lbl:'Odometer End'},{id:'fl_pump',lbl:'Fuel Pump Name'},{id:'fl_notes',lbl:'Remarks',ta:true}]); },
  driverlogForm() { this._simpleDocForm('driverlog','👤 Driver Daily Log',   [{id:'dl_date',lbl:'Date',t:'date',v:LD.today()},{id:'dl_driver',lbl:'Driver Name'},{id:'dl_emp',lbl:'Employee ID'},{id:'dl_veh',lbl:'Vehicle No'},{id:'dl_duty_start',lbl:'Duty Start Time',t:'time'},{id:'dl_duty_end',lbl:'Duty End Time',t:'time'},{id:'dl_route',lbl:'Route Covered'},{id:'dl_dist',lbl:'KM Covered',t:'number'},{id:'dl_trips',lbl:'No. of Trips',t:'number'},{id:'dl_odo',lbl:'Odometer Reading'},{id:'dl_fuel',lbl:'Fuel Received (Ltrs)',t:'number'},{id:'dl_notes',lbl:'Incidents / Remarks',ta:true}]); },

  _simpleDocForm(type, title, fields) {
    const fieldsHTML = fields.map(f=>`
      <div class="field"><label>${f.lbl}</label>
        ${f.ta
          ? `<textarea id="${f.id}" rows="2" placeholder="${f.ph||''}"></textarea>`
          : `<input type="${f.t||'text'}" id="${f.id}" placeholder="${f.ph||''}" value="${f.v||''}"/>`
        }
      </div>`).join('');
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="doc-form" style="max-width:680px">
        <h3 style="margin-bottom:18px">${title}</h3>
        <div class="doc-fields">${fieldsHTML}</div>
        <button class="btn-calc" onclick="LDOC._simplePrint('${type}','${title}')">🖨️ Generate & Print</button>
      </div>`);
  },

  _simplePrint(type, title) {
    const s = STRATIX_DB.getSettings();
    const rows = [...document.querySelectorAll('.doc-form .field')].map(f=>{
      const lbl=f.querySelector('label')?.textContent||'';
      const inp=f.querySelector('input,select,textarea');
      const val=inp?.value||'—';
      return `<div class="doc-field"><span class="lbl">${lbl}</span><span class="val">${val}</span></div>`;
    }).join('');
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="print-doc">
        <div class="doc-header">
          <div class="sx-doc-brand">
              <div class="sx-doc-mark">SX</div>
              <div>
                <div class="doc-co">${s.businessName||'Your Company'}</div>
                <div class="doc-co-sub">${s.address||''} | Ph: ${s.phone||''}</div>
          </div>
          <div><div class="doc-title">${title}</div>
            <div class="doc-no">Generated: ${new Date().toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:14px 0">${rows}</div>
        <div class="doc-sigs">
          <div class="sig-box"><div class="stamp-box">COMPANY SEAL</div><div class="sig-lbl">Authorised Signatory</div>
              </div>
            </div>
          <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Driver / Operator</div></div>
          <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Receiver Signature</div></div>
        </div>
        <div class="sx-doc-footer">
            <div class="sx-doc-footer-brand">
              <span class="sx-mini-mark">SX</span>
              <span>STRATIX</span>
              <span style="color:#ccc">&nbsp;· Business Intelligence Platform</span>
            </div>
            <div>${new Date().toLocaleString('en-IN')} · ${s.businessName||''}</div>
          </div>
      </div>`);
  },

  /* ── 11. VEHICLE FITNESS TRACKER ── */
  fitnessForm() {
    const fleet = STRATIX_DB.getArr('fleet');
    const docs_types = ['RC (Registration Certificate)','Fitness Certificate','Insurance Policy','Pollution (PUC)','Permit (State/National)','Road Tax','Fastag','Driver License'];
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="sec">
        <div class="sec-head"><h1 class="sec-title">🔧 Vehicle Fitness Tracker</h1><p class="sec-sub">Track RC, Fitness, Insurance, Permit & PUC expiry dates for all vehicles</p></div>
        <div class="card mb14">
          <div class="card-title">Add / Update Vehicle Document</div>
          <div class="form-grid">
            <div class="field"><label>Vehicle Number</label>
              ${fleet.length>0
                ? `<select id="vf_veh">${fleet.map(v=>`<option>${v.number}</option>`).join('')}<option value="__new__">+ New Vehicle</option></select>`
                : `<input id="vf_veh" placeholder="MH12AB1234"/>`}
            </div>
            <div class="field"><label>Document Type</label><select id="vf_type">${docs_types.map(d=>`<option>${d}</option>`).join('')}</select></div>
            <div class="field"><label>Expiry Date</label><input type="date" id="vf_expiry"/></div>
            <div class="field"><label>Document No</label><input id="vf_docno" placeholder="Certificate / Policy number"/></div>
          </div>
          <button class="btn btn-gold" onclick="LDOC.saveFitness()">Save Document</button>
        </div>
        <div id="fitnessTable">${LDOC.renderFitnessTable()}</div>
      </div>`);
  },

  saveFitness() {
    const veh=document.getElementById('vf_veh')?.value||'';
    const type=document.getElementById('vf_type')?.value||'';
    const expiry=document.getElementById('vf_expiry')?.value||'';
    const docno=document.getElementById('vf_docno')?.value||'';
    if(!veh||!expiry){NOTIFY.show('Fill vehicle number and expiry date','warning');return;}
    STRATIX_DB.push('vehicleDocs',{veh,type,expiry,docno});
    NOTIFY.show('Document saved!','success');
    document.getElementById('fitnessTable').innerHTML = this.renderFitnessTable();
  },

  renderFitnessTable() {
    const docs = STRATIX_DB.getArr('vehicleDocs');
    const today = new Date();
    if(docs.length===0) return `<div class="empty"><div class="ei">🔧</div><h3>No documents added yet</h3><p>Add vehicle documents above to track expiry dates</p></div>`;
    const sorted = [...docs].sort((a,b)=>new Date(a.expiry)-new Date(b.expiry));
    return `<div class="tbl-wrap"><div class="tbl-head"><span class="tbl-title">Vehicle Documents — Expiry Tracker</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Vehicle</th><th>Document</th><th>Doc No</th><th>Expiry Date</th><th>Status</th><th></th></tr></thead>
        <tbody>${sorted.map(d=>{
          const exp=new Date(d.expiry), diff=Math.round((exp-today)/86400000);
          const status=diff<0?'<span class="badge br">⛔ Expired</span>':diff<=30?`<span class="badge bo">⚠️ ${diff}d left</span>`:diff<=90?`<span class="badge bgold">📅 ${diff}d left</span>`:`<span class="badge bg">✅ Valid</span>`;
          return `<tr><td class="td-b">${d.veh}</td><td>${d.type}</td><td class="td-m">${d.docno||'—'}</td><td>${LD.dateStr(d.expiry)}</td><td>${status}</td><td><button class="del-btn" onclick="STRATIX_DB.remove('vehicleDocs','${d.id}');document.getElementById('fitnessTable').innerHTML=LDOC.renderFitnessTable()">🗑</button></td></tr>`;
        }).join('')}</tbody>
      </table></div></div>`;
  },

  /* ── 12. FLEET SUMMARY REPORT ── */
  fleetSummary() {
    const fleet=STRATIX_DB.getArr('fleet'), trips=STRATIX_DB.getArr('trips');
    const sym=LD.sym(), now=new Date();
    const month=now.toLocaleString('en-IN',{month:'long',year:'numeric'});
    const totalRev=fleet.reduce((s,v)=>s+v.revenue,0);
    const totalCost=fleet.reduce((s,v)=>s+v.cost,0);
    const totalProfit=totalRev-totalCost;
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="print-doc" style="max-width:100%">
        <div class="doc-header">
          <div class="sx-doc-brand">
              <div class="sx-doc-mark">SX</div>
              <div>
                <div class="doc-co">${STRATIX_DB.getSettings().businessName||'Your Company'}</div>
                <div class="doc-co-sub">Fleet Performance Report — ${month}</div>
          </div>
          <div style="text-align:right"><div style="font-size:18px;font-weight:800">FLEET REPORT</div>
            <div style="font-size:11px;color:#555">Generated: ${new Date().toLocaleString('en-IN')}</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:14px 0;text-align:center">
          <div style="background:#f0f7f0;border-radius:8px;padding:12px"><div style="font-size:11px;color:#555">Total Revenue</div><div style="font-size:18px;font-weight:800;color:#2e7d32">${sym}${LD.fmt(totalRev)}</div>
              </div>
            </div>
          <div style="background:#fdf3f3;border-radius:8px;padding:12px"><div style="font-size:11px;color:#555">Total Cost</div><div style="font-size:18px;font-weight:800;color:#c62828">${sym}${LD.fmt(totalCost)}</div></div>
          <div style="background:#fffde7;border-radius:8px;padding:12px"><div style="font-size:11px;color:#555">Net Profit</div><div style="font-size:18px;font-weight:800;color:#e65100">${sym}${LD.fmt(totalProfit)}</div></div>
        </div>
        <table class="doc-table">
          <thead><tr><th>Vehicle</th><th>Model</th><th>Driver</th><th>Status</th><th>Utilization</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin</th></tr></thead>
          <tbody>${fleet.map(v=>{
            const profit=v.revenue-v.cost;
            const margin=v.revenue>0?((profit/v.revenue)*100).toFixed(1):0;
            const tripCount=trips.filter(t=>t.vehicle===v.number).length;
            return `<tr>
              <td><strong>${v.number}</strong></td><td>${v.model||'—'}</td><td>${v.driver||'—'}</td>
              <td>${v.status==='active'?'✅ Active':'🔴 Idle'}</td>
              <td>${v.utilization||0}%</td>
              <td style="color:#2e7d32;font-weight:700">${sym}${LD.fmt(v.revenue)}</td>
              <td style="color:#c62828">${sym}${LD.fmt(v.cost)}</td>
              <td style="font-weight:700;color:${profit>=0?'#2e7d32':'#c62828'}">${sym}${LD.fmt(profit)}</td>
              <td>${margin}%</td>
            </tr>`;
          }).join('')}
          <tr style="font-weight:800;background:#f5f5f5"><td colspan="5">TOTAL</td><td style="color:#2e7d32">${sym}${LD.fmt(totalRev)}</td><td style="color:#c62828">${sym}${LD.fmt(totalCost)}</td><td>${sym}${LD.fmt(totalProfit)}</td><td>${totalRev>0?((totalProfit/totalRev)*100).toFixed(1):0}%</td></tr>
          </tbody>
        </table>
        <div style="margin-top:14px;font-size:12px;color:#555">Total Trips Recorded: ${trips.length} | Report Period: ${month}</div>
        <div class="sx-doc-footer">
            <div class="sx-doc-footer-brand">
              <span class="sx-mini-mark">SX</span>
              <span>STRATIX</span>
              <span style="color:#ccc">&nbsp;· Business Intelligence Platform</span>
            </div>
            <div>${new Date().toLocaleString('en-IN')}</div>
          </div>
      </div>`);
  },
};

/* ═══════════════════════════════════════════════════════════
   SMART TOOLS
═══════════════════════════════════════════════════════════ */
const LTOOL = {
  open(id) {
    const handlers = {
      loadopt: this.loadOptimizer,
      routecmp: this.routeCompare,
      driverperf: this.driverPerformance,
      maintsch: this.maintenanceScheduler,
      freightrate: this.freightRateCalc,
      dieseltrack: this.dieselTracker,
    };
    if(handlers[id]) handlers[id].call(this);
  },

  /* ── Load Efficiency Optimizer ── */
  loadOptimizer() {
    const sym=LD.sym();
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="sec"><div class="sec-head"><h1 class="sec-title">📐 Load Efficiency Optimizer</h1></div>
        <div class="card" style="max-width:600px">
          <div class="calc-grid">
            <div class="field"><label>Vehicle Capacity (tons)</label><input type="number" id="lo_cap" placeholder="10"/></div>
            <div class="field"><label>Actual Load (tons)</label><input type="number" id="lo_load" placeholder="7.5"/></div>
            <div class="field"><label>Freight Revenue (${sym})</label><input type="number" id="lo_freight" placeholder="25000"/></div>
            <div class="field"><label>Total Trip Cost (${sym})</label><input type="number" id="lo_cost" placeholder="12000"/></div>
            <div class="field"><label>Fuel Efficiency (km/L)</label><input type="number" id="lo_eff" placeholder="8"/></div>
            <div class="field"><label>Distance (km)</label><input type="number" id="lo_dist" placeholder="500"/></div>
          </div>
          <button class="btn-calc" onclick="LTOOL.calcLoad()">Optimize →</button>
          <div id="lo_result" style="margin-top:16px"></div>
        </div>
      </div>`,'renderLogisticsDocs');
  },

  calcLoad() {
    const cap=+document.getElementById('lo_cap')?.value||1;
    const load=+document.getElementById('lo_load')?.value||0;
    const freight=+document.getElementById('lo_freight')?.value||0;
    const cost=+document.getElementById('lo_cost')?.value||0;
    const eff=+document.getElementById('lo_eff')?.value||8;
    const dist=+document.getElementById('lo_dist')?.value||0;
    const sym=LD.sym();
    const utilPct=(load/cap*100).toFixed(1);
    const profit=freight-cost;
    const margin=freight>0?((profit/freight)*100).toFixed(1):0;
    const perTon=load>0?(freight/load).toFixed(0):0;
    const fuelCost=dist/eff*102;
    const emptyLoad=cap-load;
    const potentialExtra=emptyLoad*+perTon;
    const breakeven=(cost/(freight/load)).toFixed(1);
    document.getElementById('lo_result').innerHTML=`
      <div class="calc-res" style="grid-template-columns:repeat(3,1fr)">
        <div class="cri"><div>Load Utilization</div><div class="cv ${+utilPct>=80?'g':+utilPct>=60?'':'r'}">${utilPct}%</div></div>
        <div class="cri"><div>Net Profit</div><div class="cv ${profit>=0?'g':'r'}">${sym}${LD.fmt(profit)}</div></div>
        <div class="cri"><div>Profit Margin</div><div class="cv">${margin}%</div></div>
        <div class="cri"><div>Revenue per Ton</div><div class="cv">${sym}${LD.fmt(+perTon)}</div></div>
        <div class="cri"><div>Empty Capacity</div><div class="cv r">${LD.fmt(emptyLoad)} tons</div></div>
        <div class="cri"><div>Lost Revenue (empty)</div><div class="cv r">${sym}${LD.fmt(potentialExtra)}</div></div>
      </div>
      <div class="alert a-gold" style="margin-top:12px"><span class="alert-ico">💡</span>
        <div>${+utilPct<80?`Load only ${utilPct}% — you are leaving ${LD.fmt(emptyLoad)} tons unused. Potential additional revenue: <strong>${sym}${LD.fmt(potentialExtra)}</strong> per trip.`:`Good load efficiency! You are utilizing ${utilPct}% of vehicle capacity.`}
        Break-even load: <strong>${breakeven} tons</strong> to cover all costs.</div>
      </div>`;
  },

  /* ── Multi-Route Profit Comparison ── */
  routeCompare() {
    const sym=LD.sym();
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="sec"><div class="sec-head"><h1 class="sec-title">🗺️ Multi-Route Profit Comparison</h1></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
          ${[1,2].map(n=>`
            <div class="card">
              <div class="card-title">Route ${n}</div>
              <div class="field mt8"><label>Route Name</label><input id="rc_name${n}" placeholder="Mumbai — Delhi"/></div>
              <div class="field"><label>Freight Revenue (${sym})</label><input type="number" id="rc_freight${n}" placeholder="25000"/></div>
              <div class="field"><label>Fuel Cost (${sym})</label><input type="number" id="rc_fuel${n}" placeholder="5500"/></div>
              <div class="field"><label>Toll Charges (${sym})</label><input type="number" id="rc_toll${n}" placeholder="800"/></div>
              <div class="field"><label>Driver Bata (${sym})</label><input type="number" id="rc_bata${n}" placeholder="1200"/></div>
              <div class="field"><label>Other Costs (${sym})</label><input type="number" id="rc_other${n}" placeholder="500"/></div>
              <div class="field"><label>Distance (km)</label><input type="number" id="rc_dist${n}" placeholder="450"/></div>
              <div class="field"><label>Trip Days</label><input type="number" id="rc_days${n}" placeholder="2"/></div>
            </div>`).join('')}
        </div>
        <button class="btn-calc" onclick="LTOOL.compareRoutes()">Compare Routes →</button>
        <div id="rc_result" style="margin-top:16px"></div>
      </div>`,'renderLogisticsDocs');
  },

  compareRoutes() {
    const sym=LD.sym();
    const r=[1,2].map(n=>({
      name:document.getElementById(`rc_name${n}`)?.value||`Route ${n}`,
      freight:+document.getElementById(`rc_freight${n}`)?.value||0,
      fuel:+document.getElementById(`rc_fuel${n}`)?.value||0,
      toll:+document.getElementById(`rc_toll${n}`)?.value||0,
      bata:+document.getElementById(`rc_bata${n}`)?.value||0,
      other:+document.getElementById(`rc_other${n}`)?.value||0,
      dist:+document.getElementById(`rc_dist${n}`)?.value||1,
      days:+document.getElementById(`rc_days${n}`)?.value||1,
    })).map(r=>({...r,cost:r.fuel+r.toll+r.bata+r.other,profit:r.freight-(r.fuel+r.toll+r.bata+r.other),margin:r.freight>0?(((r.freight-(r.fuel+r.toll+r.bata+r.other))/r.freight)*100).toFixed(1):0,perKm:r.dist>0?((r.freight-(r.fuel+r.toll+r.bata+r.other))/r.dist).toFixed(1):0,perDay:r.days>0?((r.freight-(r.fuel+r.toll+r.bata+r.other))/r.days).toFixed(0):0}));
    const better=r[0].profit>r[1].profit?0:1;
    document.getElementById('rc_result').innerHTML=`
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        ${r.map((rt,i)=>`
          <div class="card ${i===better?'accent':''}">
            <div class="card-title">${rt.name} ${i===better?'🏆':''}</div>
            <div style="display:flex;flex-direction:column;gap:7px;font-size:13px">
              <div style="display:flex;justify-content:space-between"><span class="muted">Freight</span><span class="green">${sym}${LD.fmt(rt.freight)}</span></div>
              <div style="display:flex;justify-content:space-between"><span class="muted">Total Cost</span><span class="red">${sym}${LD.fmt(rt.cost)}</span></div>
              <div style="display:flex;justify-content:space-between;font-weight:700"><span>Net Profit</span><span class="${rt.profit>=0?'green':'red'}">${sym}${LD.fmt(rt.profit)}</span></div>
              <div style="display:flex;justify-content:space-between"><span class="muted">Margin</span><span>${rt.margin}%</span></div>
              <div style="display:flex;justify-content:space-between"><span class="muted">Profit/km</span><span>${sym}${rt.perKm}</span></div>
              <div style="display:flex;justify-content:space-between"><span class="muted">Profit/day</span><span>${sym}${LD.fmt(+rt.perDay)}</span></div>
            </div>
          </div>`).join('')}
      </div>
      <div class="alert a-gold" style="margin-top:12px"><span class="alert-ico">🏆</span>
        <div><strong>${r[better].name}</strong> is more profitable by <strong>${sym}${LD.fmt(Math.abs(r[0].profit-r[1].profit))}</strong> per trip (${Math.abs(+r[0].margin - +r[1].margin).toFixed(1)}% better margin).</div>
      </div>`;
  },

  /* ── Driver Performance Tracker ── */
  driverPerformance() {
    const trips=STRATIX_DB.getArr('trips');
    const sym=LD.sym();
    const driverStats={};
    trips.forEach(t=>{
      if(!t.vehicle) return;
      const key=t.vehicle;
      if(!driverStats[key]) driverStats[key]={vehicle:key,trips:0,revenue:0,cost:0,profit:0};
      driverStats[key].trips++;
      driverStats[key].revenue+=t.freight||0;
      driverStats[key].cost+=(t.fuel||0)+(t.toll||0)+(t.driver||0)+(t.load||0)+(t.other||0);
      driverStats[key].profit+=t.profit||0;
    });
    const sorted=Object.values(driverStats).sort((a,b)=>b.profit-a.profit);
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="sec"><div class="sec-head"><h1 class="sec-title">🏆 Driver Performance Tracker</h1></div>
        ${sorted.length===0
          ? `<div class="empty"><div class="ei">👤</div><h3>No trip data yet</h3><p>Add trips in Trip P&L to see driver performance</p></div>`
          : `<div class="tbl-wrap"><div class="tbl-head"><span class="tbl-title">Vehicle-wise Performance (All Time)</span></div>
            <div class="tbl-scroll"><table>
              <thead><tr><th>Vehicle</th><th>Trips</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin</th><th>Avg Profit/Trip</th><th>Rating</th></tr></thead>
              <tbody>${sorted.map((d,i)=>{
                const margin=d.revenue>0?((d.profit/d.revenue)*100).toFixed(1):0;
                const avg=d.trips>0?(d.profit/d.trips).toFixed(0):0;
                const rating=i===0?'🥇 Top':i===1?'🥈 2nd':i===2?'🥉 3rd':d.profit>0?'✅ Good':'⚠️ Review';
                return `<tr>
                  <td class="td-b">${d.vehicle}</td>
                  <td>${d.trips}</td>
                  <td class="td-g">${sym}${LD.fmt(d.revenue)}</td>
                  <td class="td-r">${sym}${LD.fmt(d.cost)}</td>
                  <td class="${d.profit>=0?'td-g':'td-r'} td-b">${sym}${LD.fmt(d.profit)}</td>
                  <td>${margin}%</td>
                  <td>${sym}${LD.fmt(+avg)}</td>
                  <td>${rating}</td>
                </tr>`;
              }).join('')}</tbody>
            </table></div></div>`
        }
      </div>`,'renderLogisticsDocs');
  },

  /* ── Maintenance Scheduler ── */
  maintenanceScheduler() {
    const fleet=STRATIX_DB.getArr('fleet');
    const maint=STRATIX_DB.getArr('maintenance');
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="sec"><div class="sec-head"><h1 class="sec-title">🔧 Maintenance Scheduler</h1></div>
        <div class="card mb14">
          <div class="card-title">Add Maintenance Record</div>
          <div class="form-grid">
            <div class="field"><label>Vehicle</label><input id="ms_veh" placeholder="MH12AB1234"/></div>
            <div class="field"><label>Service Type</label><select id="ms_type"><option>Oil Change</option><option>Tyre Change</option><option>Brake Service</option><option>Engine Overhaul</option><option>Battery Replacement</option><option>AC Service</option><option>General Service</option><option>Bodywork / Denting</option><option>Other</option></select></div>
            <div class="field"><label>Last Service Date</label><input type="date" id="ms_last" value="${LD.today()}"/></div>
            <div class="field"><label>Next Due Date</label><input type="date" id="ms_next"/></div>
            <div class="field"><label>Cost (${LD.sym()})</label><input type="number" id="ms_cost" placeholder="3500"/></div>
            <div class="field"><label>Garage / Workshop</label><input id="ms_garage" placeholder="Sharma Auto Workshop"/></div>
            <div class="field"><label>Odometer at Service</label><input id="ms_odo" placeholder="52000 km"/></div>
            <div class="field"><label>Notes</label><input id="ms_notes" placeholder="Additional details"/></div>
          </div>
          <button class="btn btn-gold" onclick="LTOOL.saveMaint()">Save Record</button>
        </div>
        <div id="maintTable">${LTOOL.renderMaintTable()}</div>
      </div>`,'renderLogisticsDocs');
  },

  saveMaint() {
    const veh=document.getElementById('ms_veh')?.value;
    const next=document.getElementById('ms_next')?.value;
    if(!veh||!next){NOTIFY.show('Enter vehicle and next due date','warning');return;}
    STRATIX_DB.push('maintenance',{veh,type:document.getElementById('ms_type')?.value,last:document.getElementById('ms_last')?.value,next,cost:+document.getElementById('ms_cost')?.value||0,garage:document.getElementById('ms_garage')?.value,odo:document.getElementById('ms_odo')?.value,notes:document.getElementById('ms_notes')?.value});
    NOTIFY.show('Maintenance record saved!','success');
    document.getElementById('maintTable').innerHTML=this.renderMaintTable();
  },

  renderMaintTable() {
    const maint=STRATIX_DB.getArr('maintenance');
    if(maint.length===0) return `<div class="empty"><div class="ei">🔧</div><h3>No maintenance records</h3><p>Add service records to track due dates</p></div>`;
    const today=new Date();
    const sorted=[...maint].sort((a,b)=>new Date(a.next)-new Date(b.next));
    const sym=LD.sym();
    return `<div class="tbl-wrap"><div class="tbl-head"><span class="tbl-title">Maintenance Schedule</span></div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>Vehicle</th><th>Service Type</th><th>Last Service</th><th>Next Due</th><th>Cost</th><th>Garage</th><th>Status</th><th></th></tr></thead>
        <tbody>${sorted.map(m=>{
          const diff=Math.round((new Date(m.next)-today)/86400000);
          const status=diff<0?`<span class="badge br">⛔ Overdue ${Math.abs(diff)}d</span>`:diff<=7?`<span class="badge br">🚨 Due in ${diff}d</span>`:diff<=30?`<span class="badge bo">⚠️ ${diff}d left</span>`:`<span class="badge bg">✅ ${diff}d left</span>`;
          return `<tr><td class="td-b">${m.veh}</td><td>${m.type}</td><td class="td-m">${LD.dateStr(m.last)}</td><td>${LD.dateStr(m.next)}</td><td class="td-m">${sym}${LD.fmt(m.cost)}</td><td class="td-m">${m.garage||'—'}</td><td>${status}</td><td><button class="del-btn" onclick="STRATIX_DB.remove('maintenance','${m.id}');document.getElementById('maintTable').innerHTML=LTOOL.renderMaintTable()">🗑</button></td></tr>`;
        }).join('')}</tbody>
      </table></div></div>`;
  },

  /* ── Freight Rate Calculator ── */
  freightRateCalc() {
    const sym=LD.sym();
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="sec"><div class="sec-head"><h1 class="sec-title">💹 Freight Rate Calculator</h1><p class="sec-sub">Find the right freight rate to cover costs and make profit</p></div>
        <div class="card" style="max-width:600px">
          <div class="calc-grid">
            <div class="field"><label>Distance (km)</label><input type="number" id="fr_dist" placeholder="500"/></div>
            <div class="field"><label>Load Weight (tons)</label><input type="number" id="fr_wt" placeholder="8"/></div>
            <div class="field"><label>Fuel Rate (${sym}/L)</label><input type="number" id="fr_fuel" placeholder="102" value="102"/></div>
            <div class="field"><label>Fuel Efficiency (km/L)</label><input type="number" id="fr_eff" placeholder="8" value="8"/></div>
            <div class="field"><label>Toll Charges (${sym})</label><input type="number" id="fr_toll" placeholder="800"/></div>
            <div class="field"><label>Driver Bata (${sym})</label><input type="number" id="fr_bata" placeholder="1200"/></div>
            <div class="field"><label>Loading/Unloading</label><input type="number" id="fr_lu" placeholder="600"/></div>
            <div class="field"><label>Other Costs (${sym})</label><input type="number" id="fr_other" placeholder="400"/></div>
            <div class="field"><label>Target Profit Margin (%)</label><input type="number" id="fr_margin" placeholder="20" value="20"/></div>
            <div class="field"><label>Market Rate (${sym}/ton/km)</label><input type="number" id="fr_market" placeholder="2.5"/></div>
          </div>
          <button class="btn-calc" onclick="LTOOL.calcFreightRate()">Calculate Rate →</button>
          <div id="fr_result" style="margin-top:16px"></div>
        </div>
      </div>`,'renderLogisticsDocs');
  },

  calcFreightRate() {
    const dist=+document.getElementById('fr_dist')?.value||0;
    const wt=+document.getElementById('fr_wt')?.value||1;
    const fuelRate=+document.getElementById('fr_fuel')?.value||102;
    const eff=+document.getElementById('fr_eff')?.value||8;
    const toll=+document.getElementById('fr_toll')?.value||0;
    const bata=+document.getElementById('fr_bata')?.value||0;
    const lu=+document.getElementById('fr_lu')?.value||0;
    const other=+document.getElementById('fr_other')?.value||0;
    const margin=+document.getElementById('fr_margin')?.value||20;
    const market=+document.getElementById('fr_market')?.value||0;
    const sym=LD.sym();
    const fuelCost=(dist/eff)*fuelRate;
    const totalCost=fuelCost+toll+bata+lu+other;
    const breakeven=totalCost;
    const targetRate=totalCost*(1+margin/100);
    const perTon=wt>0?(targetRate/wt).toFixed(0):0;
    const perTonKm=wt>0&&dist>0?(targetRate/(wt*dist)).toFixed(2):0;
    const marketTotal=market*wt*dist;
    const marketProfit=marketTotal-totalCost;
    document.getElementById('fr_result').innerHTML=`
      <div class="calc-res" style="grid-template-columns:repeat(3,1fr)">
        <div class="cri"><div>Fuel Cost</div><div class="cv r">${sym}${LD.fmt(fuelCost)}</div></div>
        <div class="cri"><div>Total Trip Cost</div><div class="cv r">${sym}${LD.fmt(totalCost)}</div></div>
        <div class="cri"><div>Break-Even Freight</div><div class="cv">${sym}${LD.fmt(breakeven)}</div></div>
        <div class="cri"><div>Target Rate (${margin}% margin)</div><div class="cv g">${sym}${LD.fmt(targetRate)}</div></div>
        <div class="cri"><div>Rate per Ton</div><div class="cv g">${sym}${perTon}</div></div>
        <div class="cri"><div>Rate per Ton/km</div><div class="cv g">${sym}${perTonKm}</div></div>
      </div>
      ${market>0?`<div class="alert ${marketProfit>=0?'a-green':'a-red'} mt12"><span class="alert-ico">${marketProfit>=0?'✅':'⚠️'}</span>
        <div>At market rate ${sym}${market}/ton/km → Total: <strong>${sym}${LD.fmt(marketTotal)}</strong> | Profit: <strong>${sym}${LD.fmt(marketProfit)}</strong> (${marketTotal>0?((marketProfit/marketTotal)*100).toFixed(1):0}% margin)</div>
      </div>`:''}`;
  },

  /* ── Diesel Cost Tracker ── */
  dieselTracker() {
    const entries=STRATIX_DB.getArr('dieselLog');
    const sym=LD.sym();
    document.getElementById('sectionContent').innerHTML = LD.docShell(`
      <div class="sec"><div class="sec-head"><h1 class="sec-title">⛽ Diesel Cost Tracker</h1></div>
        <div class="card mb14">
          <div class="card-title">Add Diesel Entry</div>
          <div class="form-grid">
            <div class="field"><label>Date</label><input type="date" id="dt_date" value="${LD.today()}"/></div>
            <div class="field"><label>Vehicle No</label><input id="dt_veh" placeholder="MH12AB1234"/></div>
            <div class="field"><label>Fuel Pump</label><input id="dt_pump" placeholder="HP Petrol Pump, NH-8"/></div>
            <div class="field"><label>Litres Filled</label><input type="number" id="dt_ltrs" placeholder="150" oninput="LTOOL.dtCalc()"/></div>
            <div class="field"><label>Rate per Litre (${sym})</label><input type="number" id="dt_rate" placeholder="102" value="102" oninput="LTOOL.dtCalc()"/></div>
            <div class="field"><label>Total Amount (${sym})</label><input type="number" id="dt_amt" placeholder="Auto-calculated"/></div>
            <div class="field"><label>Odometer Reading</label><input id="dt_odo" placeholder="52500 km"/></div>
            <div class="field"><label>Payment Mode</label><select id="dt_pay"><option>Cash</option><option>Card</option><option>Fastag Wallet</option><option>UPI</option><option>Fleet Card</option></select></div>
          </div>
          <button class="btn btn-gold" onclick="LTOOL.saveDiesel()">Save Entry</button>
        </div>
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="kpi"><div class="kpi-lbl">Total Litres</div><div class="kpi-val">${entries.reduce((s,e)=>s+(e.ltrs||0),0).toFixed(0)} L</div></div>
          <div class="kpi accent"><div class="kpi-lbl">Total Cost</div><div class="kpi-val">${sym}${LD.fmt(entries.reduce((s,e)=>s+(e.amt||0),0))}</div></div>
          <div class="kpi"><div class="kpi-lbl">Avg Rate/Litre</div><div class="kpi-val">${sym}${entries.length>0?(entries.reduce((s,e)=>s+(e.rate||0),0)/entries.length).toFixed(1):0}</div></div>
        </div>
        <div class="tbl-wrap mt12"><div class="tbl-head"><span class="tbl-title">Diesel Fill History</span></div>
          <div class="tbl-scroll"><table>
            <thead><tr><th>Date</th><th>Vehicle</th><th>Pump</th><th>Litres</th><th>Rate</th><th>Amount</th><th>Payment</th><th></th></tr></thead>
            <tbody id="dtBody">
              ${entries.slice().reverse().slice(0,30).map(e=>`<tr>
                <td class="td-m">${LD.dateStr(e.date)}</td><td class="td-b">${e.veh||'—'}</td><td class="td-m">${e.pump||'—'}</td>
                <td>${e.ltrs||0} L</td><td class="td-m">${sym}${e.rate||0}/L</td>
                <td class="td-gold">${sym}${LD.fmt(e.amt)}</td><td class="td-m">${e.pay||'—'}</td>
                <td><button class="del-btn" onclick="STRATIX_DB.remove('dieselLog','${e.id}');LTOOL.dieselTracker()">🗑</button></td>
              </tr>`).join('')}
            </tbody>
          </table></div>
          ${entries.length===0?`<div class="empty"><div class="ei">⛽</div><h3>No diesel entries yet</h3></div>`:''}
        </div>
      </div>`,'renderLogisticsDocs');
  },

  dtCalc() {
    const ltrs=+document.getElementById('dt_ltrs')?.value||0;
    const rate=+document.getElementById('dt_rate')?.value||0;
    const el=document.getElementById('dt_amt');
    if(el) el.value=(ltrs*rate).toFixed(0);
  },

  saveDiesel() {
    const veh=document.getElementById('dt_veh')?.value;
    const ltrs=+document.getElementById('dt_ltrs')?.value||0;
    if(!veh||!ltrs){NOTIFY.show('Enter vehicle and litres','warning');return;}
    STRATIX_DB.push('dieselLog',{date:document.getElementById('dt_date')?.value,veh,pump:document.getElementById('dt_pump')?.value,ltrs,rate:+document.getElementById('dt_rate')?.value||0,amt:+document.getElementById('dt_amt')?.value||ltrs*(+document.getElementById('dt_rate')?.value||0),odo:document.getElementById('dt_odo')?.value,pay:document.getElementById('dt_pay')?.value});
    NOTIFY.show('Diesel entry saved!','success');
    this.dieselTracker();
  },
};
