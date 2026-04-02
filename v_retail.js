/**
 * STRATIX v_retail.js v2.0 — REDESIGNED PROFESSIONAL POS
 * Full-screen billing · Professional receipt · Stock management · Loyalty
 */

// ─────────────────────────────────────────────────────
// RETAIL DASHBOARD
// ─────────────────────────────────────────────────────
function renderRetailDashboard() {
  const s    = STRATIX_AUTH.getSession();
  const cfg  = STRATIX_DB.getSettings();
  const sym  = cfg.currencySymbol || '₹';
  const now  = new Date();
  const td   = now.toISOString().split('T')[0];
  const mKey = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
  const txns   = STRATIX_DB.getArr('transactions');
  const items  = STRATIX_DB.getArr('rtl_items');
  const bills  = STRATIX_DB.getArr('rtl_bills');
  const clients= STRATIX_DB.getArr('clients');

  const tdSales    = txns.filter(t=>t.type==='revenue'&&t.date===td).reduce((s,t)=>s+Number(t.amount),0);
  const tdBills    = bills.filter(b=>b.date===td).length;
  const mSales     = txns.filter(t=>t.type==='revenue'&&t.date&&t.date.startsWith(mKey)).reduce((s,t)=>s+Number(t.amount),0);
  const mPurchase  = txns.filter(t=>t.type==='expense'&&t.date&&t.date.startsWith(mKey)).reduce((s,t)=>s+Number(t.amount),0);
  const mMargin    = mSales - mPurchase;
  const totalStock = items.reduce((s,i)=>s+Number(i.qty||0)*Number(i.costPrice||0),0);
  const lowStockItems = items.filter(i=>Number(i.qty||0)<=Number(i.minQty||5));
  const totalDue   = clients.reduce((s,c)=>s+Number(c.outstanding||0),0);

  const salesMap = {};
  bills.forEach(b=>(b.items||[]).forEach(i=>{ salesMap[i.name]=(salesMap[i.name]||0)+Number(i.qty||1); }));
  const topItems = Object.entries(salesMap).sort((a,b)=>b[1]-a[1]).slice(0,5);

  const months6=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const mk=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
    const mn=d.toLocaleString('en-IN',{month:'short'});
    const rev=txns.filter(t=>t.type==='revenue'&&t.date&&t.date.startsWith(mk)).reduce((s,t)=>s+Number(t.amount),0);
    const exp=txns.filter(t=>t.type==='expense'&&t.date&&t.date.startsWith(mk)).reduce((s,t)=>s+Number(t.amount),0);
    months6.push({mn,rev,exp});
  }
  const maxBar=Math.max(...months6.map(m=>Math.max(m.rev,m.exp)),1);
  const todayBillsList=[...bills].filter(b=>b.date===td).reverse().slice(0,4);

  document.getElementById('sectionContent').innerHTML=`
  <div class="sec">
    ${VERTICAL.bannerHTML()}
    <div class="sec-head">
      <div>
        <div class="sec-title">Good ${_greet()}, ${escapeHTML(s.name)} &#x1F44B;</div>
        <div class="sec-sub">${escapeHTML(cfg.businessName||s.biz)} &middot; ${now.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long'})}</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-vx" onclick="openPOS()" style="font-size:14px;padding:10px 20px;gap:8px">
          <span style="font-size:18px">&#x1F9FE;</span> New Bill
        </button>
        <button class="btn btn-outline" onclick="openAddStockModal()">&#x1F4E6; Add Stock</button>
        <button class="btn btn-outline" onclick="APP.navigate('crm')">&#x1F465; Customers</button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi accent" style="cursor:pointer" onclick="openPOS()">
        <div class="kpi-ico">&#x1F9FE;</div>
        <div class="kpi-lbl">Today's Sales</div>
        <div class="kpi-val">${_fmt(tdSales,sym)}</div>
        <div class="kpi-trend muted">${tdBills} bill${tdBills!==1?'s':''} today</div>
      </div>
      <div class="kpi" style="cursor:pointer" onclick="APP.navigate('datamanager')">
        <div class="kpi-ico">&#x1F4C8;</div>
        <div class="kpi-lbl">Month Revenue</div>
        <div class="kpi-val">${_fmt(mSales,sym)}</div>
        <div class="kpi-trend ${mMargin>=0?'up':'down'}">${mMargin>=0?'&#x25B2;':'&#x25BC;'} Margin: ${_fmt(Math.abs(mMargin),sym)}</div>
      </div>
      <div class="kpi" style="cursor:pointer" onclick="openAddStockModal()">
        <div class="kpi-ico">&#x1F4E6;</div>
        <div class="kpi-lbl">Stock Value</div>
        <div class="kpi-val">${_fmt(totalStock,sym)}</div>
        <div class="kpi-trend ${lowStockItems.length>0?'down':'up'}">${lowStockItems.length>0?'&#x26A0;&#xFE0F; '+lowStockItems.length+' items low':'&#x2705; Stock healthy'}</div>
      </div>
      <div class="kpi" style="cursor:pointer" onclick="APP.navigate('invoiceaging')">
        <div class="kpi-ico">&#x23F3;</div>
        <div class="kpi-lbl">Receivables</div>
        <div class="kpi-val ${totalDue>0?'gold':''}">${_fmt(totalDue,sym)}</div>
        <div class="kpi-trend ${totalDue>0?'down':'up'}">${totalDue>0?clients.filter(c=>c.outstanding>0).length+' parties pending':'All collected &#x2705;'}</div>
      </div>
    </div>

    ${lowStockItems.length>0?`
    <div class="alert a-red" style="margin-bottom:16px;cursor:pointer;border-radius:12px;padding:13px 16px" onclick="openAddStockModal()">
      <span class="alert-ico">&#x26A0;&#xFE0F;</span>
      <div style="flex:1"><strong>${lowStockItems.length} items running low:</strong>
        <span style="color:var(--text2);margin-left:6px">${lowStockItems.slice(0,4).map(i=>escapeHTML(i.name)).join(' &middot; ')}${lowStockItems.length>4?' +'+(lowStockItems.length-4)+' more':''}</span>
      </div>
      <span style="font-size:12px;opacity:.7;white-space:nowrap">Click to restock &rarr;</span>
    </div>`:''}

    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;margin-bottom:18px">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border)">
          <div class="card-title" style="margin:0">&#x1F4E6; Stock Inventory</div>
          <div style="display:flex;gap:8px">
            <input type="text" placeholder="Search..." id="rtlStockSearch"
              style="background:var(--surface3);border:1px solid var(--border);border-radius:8px;padding:5px 10px;font-size:12px;color:var(--text);outline:none;width:130px"
              oninput="rtlFilterStock(this.value)"/>
            <button class="btn btn-vx btn-sm" onclick="openAddStockModal()">+ Add</button>
          </div>
        </div>
        ${items.length===0?`<div style="text-align:center;padding:40px 20px;color:var(--muted)">
          <div style="font-size:40px;margin-bottom:12px">&#x1F4E6;</div>
          <div style="font-size:14px;font-weight:600;margin-bottom:8px">No items in stock</div>
          <button class="btn btn-vx btn-sm" onclick="openAddStockModal()">Add First Item</button></div>`:
        `<div id="rtlStockTable" style="max-height:280px;overflow-y:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead style="position:sticky;top:0;background:var(--surface2)"><tr>
              <th style="font-size:10px;color:var(--muted);padding:8px 12px;text-align:left;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Item</th>
              <th style="font-size:10px;color:var(--muted);padding:8px;text-align:center;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Stock</th>
              <th style="font-size:10px;color:var(--muted);padding:8px;text-align:right;font-weight:600;letter-spacing:.5px;text-transform:uppercase">MRP</th>
              <th style="font-size:10px;color:var(--muted);padding:8px;text-align:center;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Status</th>
            </tr></thead>
            <tbody id="rtlStockBody">
            ${items.map(i=>{const isLow=Number(i.qty||0)<=Number(i.minQty||5);return`<tr class="rtl-stock-row" style="border-bottom:1px solid var(--border)">
                <td style="padding:9px 12px"><div style="font-size:13px;font-weight:600">${escapeHTML(i.name)}</div>${i.category?`<div style="font-size:10px;color:var(--muted)">${escapeHTML(i.category)}</div>`:''}</td>
                <td style="padding:9px 8px;text-align:center;font-weight:700;font-size:14px;color:${isLow?'var(--red)':'var(--green)'}">${i.qty}<span style="font-size:10px;color:var(--muted);font-weight:400"> ${escapeHTML(i.unit||'')}</span></td>
                <td style="padding:9px 8px;text-align:right;font-size:13px;font-weight:600">${_fmt(i.mrp||0,sym)}</td>
                <td style="padding:9px 8px;text-align:center"><span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:${isLow?'rgba(255,77,77,.12)':'rgba(0,214,143,.1)'};color:${isLow?'var(--red)':'var(--green)'}">${isLow?'Low':'OK'}</span></td>
              </tr>`;}).join('')}
            </tbody>
          </table>
        </div>`}
      </div>

      <div class="card">
        <div class="card-title">&#x1F525; Top Sellers</div>
        ${topItems.length===0?`<div style="text-align:center;padding:24px;color:var(--muted);font-size:12px">Start billing to see top sellers</div>`:
          topItems.map((item,idx)=>`
          <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
            <div style="width:22px;height:22px;border-radius:7px;background:rgba(37,99,235,${0.15-idx*0.02});display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;color:var(--gold);flex-shrink:0">${idx+1}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(item[0])}</div>
              <div style="font-size:10px;color:var(--muted)">${item[1]} units sold</div>
            </div>
          </div>`).join('')}
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin:0">&#x1F9FE; Today's Bills</div>
          <span style="font-size:11px;font-weight:700;color:var(--gold);background:rgba(37,99,235,.1);padding:2px 8px;border-radius:20px">${tdBills}</span>
        </div>
        ${todayBillsList.length===0?`<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">No bills today.<br/><button class="btn btn-vx btn-sm" style="margin-top:10px" onclick="openPOS()">Create Bill</button></div>`:
          todayBillsList.map(b=>`
          <div style="padding:10px;background:var(--surface3);border-radius:10px;margin-bottom:8px;border-left:3px solid var(--green)">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:12px;font-weight:700">${escapeHTML(b.customerName||'Walk-in')}</div>
              <div style="font-size:13px;font-weight:800;color:var(--green)">${_fmt(b.total||0,sym)}</div>
            </div>
            <div style="font-size:10px;color:var(--muted);margin-top:3px">${b.billNo} &middot; ${(b.items||[]).length} items &middot; ${b.payMode||'Cash'}</div>
          </div>`).join('')}
        ${bills.length>0?`<button class="btn btn-ghost btn-sm btn-full" style="margin-top:4px" onclick="rtlOpenBillHistory()">View All Bills &rarr;</button>`:''}
      </div>
    </div>

    <div class="charts-row" style="margin-bottom:18px">
      <div class="chart-card">
        <div class="chart-hd"><h3>&#x1F4CA; Sales vs Purchase &mdash; Last 6 Months</h3><span class="chart-sub">${sym} values</span></div>
        <div class="bar-chart">
          ${months6.map(m=>`<div class="bar-grp"><div class="bars">
              <div class="bar rev" style="height:${Math.round((m.rev/maxBar)*120)}px" title="Sales: ${_fmt(m.rev,sym)}"></div>
              <div class="bar exp" style="height:${Math.round((m.exp/maxBar)*120)}px" title="Purchase: ${_fmt(m.exp,sym)}"></div>
            </div><div class="bar-lbl">${m.mn}</div></div>`).join('')}
        </div>
        <div class="chart-legend"><div class="leg rev">Sales</div><div class="leg exp">Purchase Cost</div></div>
      </div>
      <div class="chart-card">
        <div class="chart-hd"><h3>&#x1F465; Party Receivables</h3></div>
        ${clients.length===0?`<div style="color:var(--muted);font-size:12px;text-align:center;padding:20px">No parties added</div>`:
          clients.filter(c=>Number(c.outstanding)>0).length===0
          ?`<div style="color:var(--green);font-size:13px;text-align:center;padding:20px;font-weight:700">&#x2705; All dues collected!</div>`
          :clients.filter(c=>Number(c.outstanding)>0).slice(0,5).map(c=>`
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:130px">${escapeHTML(c.name)}</span>
            <span style="font-size:13px;font-weight:700;color:var(--red);flex-shrink:0">${_fmt(c.outstanding,sym)}</span>
          </div>`).join('')}
        <button class="btn btn-ghost btn-sm btn-full" style="margin-top:12px" onclick="APP.navigate('invoiceaging')">Full Receivables &rarr;</button>
      </div>
    </div>
    ${VERTICAL.quickActionsHTML()}
  </div>`;
}

function rtlFilterStock(q) {
  document.querySelectorAll('.rtl-stock-row').forEach(r=>{
    r.style.display=!q||r.textContent.toLowerCase().includes(q.toLowerCase())?'':'none';
  });
}

// ── Bill History ──────────────────────────────────────────────────────────────
function rtlOpenBillHistory() {
  const bills=[...STRATIX_DB.getArr('rtl_bills')].reverse();
  const sym=STRATIX_DB.getSettings().currencySymbol||'₹';
  const total=bills.reduce((s,b)=>s+Number(b.total||0),0);
  document.body.insertAdjacentHTML('beforeend',`
  <div class="overlay" id="billHistoryModal" onclick="if(event.target===this)document.getElementById('billHistoryModal').remove()">
    <div class="modal" style="max-width:820px;max-height:90vh">
      <div class="modal-hd"><div class="modal-title">&#x1F9FE; All Bills &mdash; ${bills.length} records</div>
        <button class="modal-close" onclick="document.getElementById('billHistoryModal').remove()">&#x2715;</button></div>
      <div class="modal-body">
        <div style="display:flex;gap:10px;margin-bottom:14px">
          <div style="flex:1;background:var(--surface3);border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Total Bills</div>
            <div style="font-size:22px;font-weight:800">${bills.length}</div>
          </div>
          <div style="flex:1;background:var(--surface3);border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Total Revenue</div>
            <div style="font-size:22px;font-weight:800;color:var(--green)">${sym}${Math.round(total).toLocaleString('en-IN')}</div>
          </div>
        </div>
        <input type="text" placeholder="&#x1F50D; Search by customer, bill no, date..."
          style="width:100%;background:var(--surface3);border:1px solid var(--border);border-radius:10px;padding:10px 14px;font-size:13px;color:var(--text);outline:none;margin-bottom:12px"
          oninput="document.querySelectorAll('.bill-hist-row').forEach(r=>{r.style.display=!this.value||r.textContent.toLowerCase().includes(this.value.toLowerCase())?'':'none'})"/>
        <div class="tbl-scroll"><table>
          <thead><tr><th>Bill No</th><th>Customer</th><th>Items</th><th>Subtotal</th><th>Discount</th><th>GST</th><th>Total</th><th>Payment</th><th>Date</th><th></th></tr></thead>
          <tbody>
          ${bills.map(b=>`<tr class="bill-hist-row">
            <td class="td-b" style="font-size:11px">${escapeHTML(b.billNo||'—')}</td>
            <td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(b.customerName||'Walk-in')}</td>
            <td style="text-align:center;font-weight:700">${(b.items||[]).length}</td>
            <td>${sym}${Number(b.subtotal||0).toLocaleString('en-IN')}</td>
            <td style="color:var(--green)">${b.discount>0?'-'+sym+Number(b.discount).toLocaleString('en-IN'):'—'}</td>
            <td>${b.gstPct>0?b.gstPct+'%':'—'}</td>
            <td style="font-weight:700;color:var(--green)">${sym}${Number(b.total||0).toLocaleString('en-IN')}</td>
            <td><span style="font-size:11px;background:rgba(0,214,143,.1);color:var(--green);border-radius:20px;padding:2px 8px">${escapeHTML(b.payMode||'Cash')}</span></td>
            <td style="font-size:11px;color:var(--muted)">${b.date||''}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="var bill=STRATIX_DB.getArr('rtl_bills').find(b=>b.id==='${b.id}');if(bill)printReceipt(bill)">&#x1F5A8;&#xFE0F;</button></td>
          </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    </div>
  </div>`);
}

// ─────────────────────────────────────────────────────
// FULL-SCREEN POS BILLING
// ─────────────────────────────────────────────────────
function openPOS() {
  const items  = STRATIX_DB.getArr('rtl_items');
  const cfg    = STRATIX_DB.getSettings();
  const sym    = cfg.currencySymbol||'₹';
  const billNo = 'BILL-'+String(STRATIX_DB.getArr('rtl_bills').length+1).padStart(5,'0');
  const today  = new Date().toISOString().split('T')[0];
  const categories=[...new Set(items.map(i=>i.category||'General').filter(Boolean))];

  document.body.insertAdjacentHTML('beforeend',`
  <div id="posOverlay" style="position:fixed;inset:0;z-index:9990;background:var(--bg);display:flex;flex-direction:column;font-family:var(--font)">

    <!-- TOP BAR -->
    <div style="height:54px;background:var(--surface);border-bottom:1px solid var(--border);display:flex;align-items:center;padding:0 16px;gap:12px;flex-shrink:0">
      <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
        <div style="width:32px;height:32px;background:linear-gradient(135deg,var(--gold),var(--gold2));border-radius:9px;display:flex;align-items:center;justify-content:center;font-family:var(--heading);font-weight:800;font-size:12px;color:#F8FAFC">SX</div>
        <div>
          <div style="font-family:var(--heading);font-size:14px;font-weight:800;color:var(--text);letter-spacing:2px">POS BILLING</div>
          <div style="font-size:10px;color:var(--muted)">${escapeHTML(cfg.businessName||'My Shop')}</div>
        </div>
      </div>
      <div style="background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.2);border-radius:20px;padding:4px 14px;font-size:13px;font-weight:700;color:var(--gold);flex-shrink:0">&#x1F9FE; ${billNo}</div>
      <div style="flex:1"></div>
      <div style="position:relative;flex:0 0 280px">
        <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none">&#x1F50D;</span>
        <input id="posGlobalSearch" type="text" placeholder="Search items..."
          style="width:100%;background:var(--surface3);border:1px solid var(--border2);border-radius:9px;padding:7px 10px 7px 32px;font-size:13px;color:var(--text);outline:none"
          oninput="posSearchItems(this.value)"/>
      </div>
      <div style="position:relative;flex:0 0 210px">
        <span style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:13px;pointer-events:none">&#x1F4F7;</span>
        <input id="posBarcodeInput" type="text" placeholder="Scan barcode..."
          style="width:100%;background:var(--surface3);border:1px solid rgba(79,158,240,.3);border-radius:9px;padding:7px 10px 7px 32px;font-size:13px;color:var(--text);outline:none"
          onkeydown="if(event.key==='Enter'){posAddByBarcode(this.value);this.value='';event.preventDefault();}"/>
      </div>
      <button onclick="closePOS()" style="background:rgba(255,77,77,.1);border:1px solid rgba(255,77,77,.25);color:var(--red);border-radius:8px;padding:7px 16px;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);white-space:nowrap">&#x2715; Close</button>
    </div>

    <!-- 3-COLUMN BODY -->
    <div style="flex:1;display:flex;overflow:hidden">

      <!-- LEFT: Item catalogue -->
      <div style="width:360px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden">
        <div style="padding:10px 12px 0;border-bottom:1px solid var(--border);flex-shrink:0">
          <div style="display:flex;gap:5px;flex-wrap:wrap;padding-bottom:10px" id="posCatTabs">
            <button class="pos-cat-tab pos-cat-active" onclick="posFilterCat('',this)"
              style="font-size:11px;padding:4px 11px;border-radius:20px;border:1px solid var(--gold);background:rgba(37,99,235,.12);color:var(--gold);cursor:pointer;font-family:var(--font);font-weight:600">All</button>
            ${categories.map(c=>`<button class="pos-cat-tab" onclick="posFilterCat('${escapeHTML(c)}',this)"
              style="font-size:11px;padding:4px 11px;border-radius:20px;border:1px solid var(--border2);background:transparent;color:var(--muted);cursor:pointer;font-family:var(--font);font-weight:500">${escapeHTML(c)}</button>`).join('')}
          </div>
        </div>
        <div id="posItemGrid" style="flex:1;overflow-y:auto;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:7px;align-content:start">
          ${items.length===0?`<div style="grid-column:1/-1;text-align:center;padding:40px 0;color:var(--muted)">
            <div style="font-size:36px;margin-bottom:10px">&#x1F4E6;</div>
            <div style="font-size:13px;font-weight:600">No stock items</div>
            <button class="btn btn-vx btn-sm" style="margin-top:12px" onclick="closePOS();openAddStockModal()">+ Add Items</button></div>`:
          items.map(i=>{const isLow=Number(i.qty||0)<=Number(i.minQty||0);return`
            <div class="pos-item-card" data-cat="${escapeHTML(i.category||'')}" data-name="${escapeHTML(i.name)}"
              onclick="posQuickAdd('${escapeHTML(i.name).replace(/'/g,"\'").replace(/\`/g,"\`")}',${i.mrp||0})"
              style="background:var(--surface3);border:1px solid var(--border);border-radius:10px;padding:11px 12px;cursor:pointer;transition:all .15s;user-select:none;position:relative;${isLow?'border-color:rgba(255,77,77,.25)':''}">
              ${isLow?`<div style="position:absolute;top:5px;right:8px;font-size:9px;font-weight:700;color:var(--red)">LOW</div>`:''}
              <div style="font-size:13px;font-weight:600;line-height:1.3;margin-bottom:3px;color:var(--text)">${escapeHTML(i.name)}</div>
              <div style="font-size:10px;color:var(--muted);margin-bottom:5px">${escapeHTML(i.category||'')} &middot; ${i.qty} ${escapeHTML(i.unit||'pcs')}</div>
              <div style="font-size:15px;font-weight:800;color:var(--gold)">${_fmt(i.mrp||0,sym)}</div>
            </div>`;}).join('')}
        </div>
        <!-- Manual entry -->
        <div style="padding:10px 12px;border-top:1px solid var(--border);background:var(--surface2);flex-shrink:0">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:7px">Manual Entry</div>
          <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:5px">
            <div>
              <input id="posItemName" placeholder="Item name" list="posItemList"
                style="width:100%;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;padding:7px 9px;font-size:12px;color:var(--text);outline:none"
                oninput="posFillPrice(this.value)"/>
              <datalist id="posItemList">${items.map(i=>`<option value="${escapeHTML(i.name)}">`).join('')}</datalist>
            </div>
            <input type="number" id="posQty" value="1" min="0.01" step="0.01" placeholder="Qty"
              style="background:var(--surface3);border:1px solid var(--border2);border-radius:8px;padding:7px 6px;font-size:12px;color:var(--text);outline:none;text-align:center"/>
            <input type="number" id="posPrice" placeholder="${sym}"
              style="background:var(--surface3);border:1px solid var(--border2);border-radius:8px;padding:7px 6px;font-size:12px;color:var(--text);outline:none;text-align:right"/>
            <button onclick="posAddItem()" style="background:linear-gradient(135deg,var(--gold),var(--gold2));border:none;border-radius:8px;padding:7px 11px;font-weight:800;font-size:15px;color:#F8FAFC;cursor:pointer">+</button>
          </div>
        </div>
      </div>

      <!-- MIDDLE: Bill items -->
      <div style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:var(--bg2)">
        <!-- Customer row -->
        <div style="padding:11px 14px;background:var(--surface2);border-bottom:1px solid var(--border);flex-shrink:0">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Customer</div>
              <input id="posCustomer" placeholder="Walk-in / Name" list="posCustomerList"
                style="width:100%;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;padding:7px 10px;font-size:13px;color:var(--text);outline:none"
                oninput="posLookupLoyalty(this.value)"/>
              <datalist id="posCustomerList">${STRATIX_DB.getArr('clients').map(c=>`<option value="${escapeHTML(c.name)}">`).join('')}</datalist>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Phone</div>
              <input id="posPhone" type="tel" placeholder="9876543210"
                style="width:100%;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;padding:7px 10px;font-size:13px;color:var(--text);outline:none"/>
            </div>
            <div>
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Date</div>
              <input id="posBillDate" type="date" value="${today}"
                style="width:100%;background:var(--surface3);border:1px solid var(--border2);border-radius:8px;padding:7px 10px;font-size:13px;color:var(--text);outline:none"/>
            </div>
          </div>
          <div id="posLoyaltyInfo" style="display:none;margin-top:8px;background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.2);border-radius:8px;padding:6px 12px;font-size:12px;color:var(--gold)"></div>
        </div>
        <!-- Bill table -->
        <div style="flex:1;overflow-y:auto">
          <table style="width:100%;border-collapse:collapse">
            <thead style="position:sticky;top:0;background:var(--surface2);z-index:1"><tr>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;width:36px">#</th>
              <th style="padding:10px 8px;text-align:left;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Item</th>
              <th style="padding:10px 8px;text-align:center;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;width:110px">Qty</th>
              <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;width:110px">Rate</th>
              <th style="padding:10px 8px;text-align:right;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;width:110px">Amount</th>
              <th style="padding:10px 8px;width:40px"></th>
            </tr></thead>
            <tbody id="posBillTableBody">
              <tr id="posBillEmptyRow"><td colspan="6" style="text-align:center;padding:60px 20px;color:var(--muted)">
                <div style="font-size:40px;margin-bottom:12px">&#x1F6D2;</div>
                <div style="font-size:14px;font-weight:600">Click items on the left or scan barcode to add</div>
              </td></tr>
            </tbody>
          </table>
        </div>
        <!-- Note -->
        <div style="padding:9px 14px;border-top:1px solid var(--border);flex-shrink:0">
          <input id="posBillNote" type="text" placeholder="&#x1F4DD; Note / Remarks (appears on receipt)"
            style="width:100%;background:transparent;border:none;font-size:12px;color:var(--muted);outline:none"/>
        </div>
      </div>

      <!-- RIGHT: Totals + Payment -->
      <div style="width:292px;flex-shrink:0;background:var(--surface);border-left:1px solid var(--border);display:flex;flex-direction:column;overflow-y:auto">

        <!-- Bill summary -->
        <div style="padding:14px;border-bottom:1px solid var(--border)">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:11px">Bill Summary</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:9px"><span style="font-size:13px;color:var(--text2)">Items</span><span id="posItemCount" style="font-size:13px;font-weight:600">0</span></div>
          <div style="display:flex;justify-content:space-between;margin-bottom:9px"><span style="font-size:13px;color:var(--text2)">Subtotal</span><span id="posSubtotal" style="font-size:13px;font-weight:600">${sym}0</span></div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
            <span style="font-size:13px;color:var(--green)">Discount</span>
            <div style="display:flex;align-items:center;gap:3px">
              <input type="number" id="posDiscount" value="0" min="0"
                style="width:66px;text-align:right;background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:13px;color:var(--text);outline:none"
                oninput="posUpdateTotals()"/>
              <select id="posDiscType" style="background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:3px 5px;font-size:11px;color:var(--text);outline:none" onchange="posUpdateTotals()">
                <option value="flat">${sym}</option><option value="pct">%</option>
              </select>
            </div>
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:9px">
            <span style="font-size:13px;color:var(--text2)">GST</span>
            <select id="posGST" style="background:var(--surface3);border:1px solid var(--border);border-radius:6px;padding:3px 7px;font-size:12px;color:var(--text);outline:none" onchange="posUpdateTotals()">
              <option value="0">0% None</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option>
            </select>
          </div>
          <div id="posGSTLine" style="display:none;justify-content:space-between;margin-bottom:9px">
            <span style="font-size:12px;color:var(--muted)">GST Amount</span>
            <span id="posGSTAmt" style="font-size:12px;color:var(--text2)">${sym}0</span>
          </div>

          <div id="posLoyaltyRedeem" style="display:none;margin-bottom:9px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:13px;color:var(--gold)">&#x2B50; Loyalty Pts</span>
              <div style="display:flex;align-items:center;gap:3px">
                <input type="number" id="posLoyaltyUse" placeholder="0" min="0"
                  style="width:70px;text-align:right;background:rgba(37,99,235,.08);border:1px solid rgba(37,99,235,.25);border-radius:6px;padding:3px 7px;font-size:13px;color:var(--gold);outline:none"
                  oninput="posUpdateTotals()"/>
                <span style="font-size:10px;color:var(--muted)">pts</span>
              </div>
            </div>
            <div id="posLoyaltyAvail" style="font-size:10px;color:var(--muted);margin-top:2px;text-align:right"></div>
          </div>

          <div style="border-top:2px solid var(--border);padding-top:11px;margin-top:3px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:16px;font-weight:700">TOTAL</span>
              <span id="posTotal" style="font-size:26px;font-weight:800;color:var(--gold)">${sym}0</span>
            </div>
            <div id="posTotalWords" style="font-size:10px;color:var(--muted);margin-top:3px;text-align:right"></div>
          </div>
        </div>

        <!-- Payment mode -->
        <div style="padding:14px;border-bottom:1px solid var(--border)">
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:9px">Payment Mode</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
            ${[['Cash','&#x1F4B5;'],['UPI','&#x1F4F1;'],['Card','&#x1F4B3;'],['Credit','&#x1F4CB;']].map(([mode,icon],i)=>`
            <button class="pos-pay-btn ${i===0?'pos-pay-active':''}" onclick="posSelectPayMode(this,'${mode}')"
              style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 7px;border-radius:10px;cursor:pointer;
              background:${i===0?'rgba(0,214,143,.1)':'var(--surface3)'};border:${i===0?'1.5px solid var(--green)':'1.5px solid var(--border)'};
              color:${i===0?'var(--green)':'var(--muted)'};font-family:var(--font);font-size:11px;font-weight:600;transition:.15s">
              <span style="font-size:18px">${icon}</span>${mode}
            </button>`).join('')}
          </div>
          <input type="hidden" id="posPayMode" value="Cash"/>
          <div id="posCashChange" style="margin-top:11px">
            <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:7px">
              <div style="flex:1">
                <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Cash Tendered</div>
                <input type="number" id="posCashTendered" placeholder="0" min="0"
                  style="width:100%;background:var(--surface3);border:1px solid var(--border);border-radius:8px;padding:7px 9px;font-size:13px;color:var(--text);outline:none"
                  oninput="posCalcChange()"/>
              </div>
              <div style="flex:1;text-align:right">
                <div style="font-size:10px;color:var(--muted);margin-bottom:3px">Change</div>
                <div id="posChange" style="font-size:18px;font-weight:800;color:var(--green);padding-top:3px">${sym}0</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div style="padding:14px;margin-top:auto">
          <button onclick="savePOSBill(true)" style="width:100%;padding:14px;border:none;border-radius:11px;cursor:pointer;
            background:linear-gradient(135deg,var(--gold),var(--gold2));color:#F8FAFC;font-family:var(--heading);
            font-weight:800;font-size:15px;letter-spacing:.5px;transition:.2s;margin-bottom:9px;
            box-shadow:0 4px 20px rgba(37,99,235,.3)">
            &#x1F5A8;&#xFE0F; SAVE &amp; PRINT
          </button>
          <div style="display:flex;gap:7px">
            <button onclick="savePOSBill(false)" style="flex:1;padding:10px;border:1px solid var(--border2);border-radius:9px;cursor:pointer;background:transparent;color:var(--text2);font-family:var(--font);font-weight:600;font-size:12px">&#x1F4BE; Save Only</button>
            <button onclick="posShareWhatsApp()" style="flex:1;padding:10px;border:1px solid rgba(0,214,143,.3);border-radius:9px;cursor:pointer;background:rgba(0,214,143,.07);color:var(--green);font-family:var(--font);font-weight:600;font-size:12px">&#x1F4F1; WhatsApp</button>
          </div>
          <button onclick="closePOS()" style="width:100%;padding:9px;border:none;border-radius:9px;cursor:pointer;background:transparent;color:var(--muted);font-family:var(--font);font-size:12px;margin-top:7px">&#x2715; Cancel Bill</button>
        </div>
      </div>
    </div>
  </div>`);

  window._posBillItems=[];
  setTimeout(()=>document.getElementById('posGlobalSearch')?.focus(),100);
}

// ── POS Helpers ───────────────────────────────────────────────────────────────
function posSearchItems(q){
  document.querySelectorAll('.pos-item-card').forEach(c=>{
    c.style.display=!q||(c.dataset.name||'').toLowerCase().includes(q.toLowerCase())?'':'none';
  });
}
function posFilterCat(cat,btn){
  document.querySelectorAll('.pos-cat-tab').forEach(b=>{b.style.background='transparent';b.style.color='var(--muted)';b.style.borderColor='var(--border2)';});
  btn.style.background='rgba(37,99,235,.12)';btn.style.color='var(--gold)';btn.style.borderColor='var(--gold)';
  document.querySelectorAll('.pos-item-card').forEach(c=>{c.style.display=!cat||c.dataset.cat===cat?'':'none';});
}
function posQuickAdd(name,price){
  if(!window._posBillItems)window._posBillItems=[];
  const ex=window._posBillItems.find(i=>i.name===name);
  if(ex){ex.qty++;}else{window._posBillItems.push({name,qty:1,price:Number(price)});}
  posRenderBillTable();posUpdateTotals();
}
function posFillPrice(name){
  const item=STRATIX_DB.getArr('rtl_items').find(i=>i.name.toLowerCase()===name.toLowerCase());
  if(item){document.getElementById('posPrice').value=item.mrp||0;}
}
function posAddItem(){
  const name=document.getElementById('posItemName').value.trim();
  const qty=parseFloat(document.getElementById('posQty').value)||1;
  const price=parseFloat(document.getElementById('posPrice').value)||0;
  if(!name)return NOTIFY.show('Enter item name','error');
  if(price<=0)return NOTIFY.show('Enter item price','error');
  if(!window._posBillItems)window._posBillItems=[];
  const ex=window._posBillItems.find(i=>i.name===name);
  if(ex){ex.qty+=qty;}else{window._posBillItems.push({name,qty,price});}
  document.getElementById('posItemName').value='';
  document.getElementById('posQty').value='1';
  document.getElementById('posPrice').value='';
  posRenderBillTable();posUpdateTotals();
}
function posRenderBillTable(){
  const body=document.getElementById('posBillTableBody');if(!body)return;
  const items=window._posBillItems||[];
  if(!items.length){
    body.innerHTML=`<tr id="posBillEmptyRow"><td colspan="6" style="text-align:center;padding:60px 20px;color:var(--muted)">
      <div style="font-size:40px;margin-bottom:12px">&#x1F6D2;</div>
      <div style="font-size:14px;font-weight:600">Click items on the left or scan barcode to add</div></td></tr>`;return;
  }
  const sym=STRATIX_DB.getSettings().currencySymbol||'₹';
  body.innerHTML=items.map((item,idx)=>`<tr style="border-bottom:1px solid var(--border)">
    <td style="padding:10px 14px;color:var(--muted);font-size:12px">${idx+1}</td>
    <td style="padding:10px 8px;font-size:13px;font-weight:600">${escapeHTML(item.name)}</td>
    <td style="padding:10px 8px;text-align:center">
      <div style="display:inline-flex;align-items:center;gap:3px">
        <button onclick="posChangeQty(${idx},-1)" style="width:24px;height:24px;border-radius:6px;border:1px solid var(--border);background:var(--surface3);color:var(--text);cursor:pointer;font-size:14px;line-height:1">-</button>
        <input type="number" value="${item.qty}" min="0.01" step="0.01"
          style="width:50px;text-align:center;background:var(--surface3);border:1px solid var(--border2);border-radius:6px;padding:3px 3px;font-size:13px;font-weight:700;color:var(--text);outline:none"
          onchange="posChangeQtyDirect(${idx},this.value)"/>
        <button onclick="posChangeQty(${idx},1)" style="width:24px;height:24px;border-radius:6px;border:1px solid var(--border);background:var(--surface3);color:var(--text);cursor:pointer;font-size:14px;line-height:1">+</button>
      </div>
    </td>
    <td style="padding:10px 8px;text-align:right">
      <input type="number" value="${item.price}" min="0"
        style="width:86px;text-align:right;background:var(--surface3);border:1px solid var(--border2);border-radius:6px;padding:4px 7px;font-size:13px;color:var(--text);outline:none"
        onchange="posChangePriceDirect(${idx},this.value)"/>
    </td>
    <td style="padding:10px 8px;text-align:right;font-size:14px;font-weight:700">${sym}${Math.round(item.qty*item.price).toLocaleString('en-IN')}</td>
    <td style="padding:10px 8px;text-align:center">
      <button onclick="posRemoveItem(${idx})" style="background:rgba(255,77,77,.1);border:1px solid rgba(255,77,77,.2);color:var(--red);border-radius:6px;padding:3px 8px;cursor:pointer;font-size:12px">&#x2715;</button>
    </td>
  </tr>`).join('');
}
function posChangeQty(idx,delta){
  const item=window._posBillItems[idx];if(!item)return;
  item.qty=Math.max(0.01,Math.round((item.qty+delta)*100)/100);
  if(item.qty<=0)window._posBillItems.splice(idx,1);
  posRenderBillTable();posUpdateTotals();
}
function posChangeQtyDirect(idx,val){const v=parseFloat(val);if(isNaN(v)||v<=0)return;window._posBillItems[idx].qty=v;posRenderBillTable();posUpdateTotals();}
function posChangePriceDirect(idx,val){const v=parseFloat(val);if(isNaN(v)||v<0)return;window._posBillItems[idx].price=v;posRenderBillTable();posUpdateTotals();}
function posRemoveItem(idx){window._posBillItems.splice(idx,1);posRenderBillTable();posUpdateTotals();}
function posUpdateTotals(){
  const items=window._posBillItems||[];
  const sym=STRATIX_DB.getSettings().currencySymbol||'₹';
  const subtotal=items.reduce((s,i)=>s+(i.qty*i.price),0);
  const discRaw=parseFloat(document.getElementById('posDiscount')?.value)||0;
  const discType=document.getElementById('posDiscType')?.value||'flat';
  const discount=discType==='pct'?subtotal*(discRaw/100):discRaw;
  const afterDisc=Math.max(0,subtotal-discount);
  const gstPct=parseFloat(document.getElementById('posGST')?.value)||0;
  const gstAmt=afterDisc*(gstPct/100);
  const loyaltyUse=Math.min(parseFloat(document.getElementById('posLoyaltyUse')?.value)||0,afterDisc);
  const total=Math.round(Math.max(0,afterDisc+gstAmt-loyaltyUse));
  const el=id=>document.getElementById(id);
  if(el('posItemCount'))el('posItemCount').textContent=items.length;
  if(el('posSubtotal'))el('posSubtotal').textContent=sym+Math.round(subtotal).toLocaleString('en-IN');
  if(el('posTotal'))el('posTotal').textContent=sym+total.toLocaleString('en-IN');
  if(el('posGSTLine'))el('posGSTLine').style.display=gstPct>0?'flex':'none';
  if(el('posGSTAmt'))el('posGSTAmt').textContent=sym+Math.round(gstAmt).toLocaleString('en-IN');
  if(el('posTotalWords'))el('posTotalWords').textContent=numToWords(total)+' Only';
  posCalcChange();
}
function posCalcChange(){
  const sym=STRATIX_DB.getSettings().currencySymbol||'₹';
  const total=parseInt((document.getElementById('posTotal')?.textContent||'0').replace(/[^0-9]/g,''))||0;
  const tender=parseFloat(document.getElementById('posCashTendered')?.value)||0;
  const change=Math.max(0,tender-total);
  const el=document.getElementById('posChange');
  if(el){el.textContent=sym+change.toLocaleString('en-IN');el.style.color=change>0?'var(--green)':'var(--text2)';}
}
function posSelectPayMode(btn,mode){
  document.querySelectorAll('.pos-pay-btn').forEach(b=>{b.style.background='var(--surface3)';b.style.borderColor='var(--border)';b.style.color='var(--muted)';});
  btn.style.background='rgba(0,214,143,.1)';btn.style.borderColor='var(--green)';btn.style.color='var(--green)';
  const el=document.getElementById('posPayMode');if(el)el.value=mode;
  const cashDiv=document.getElementById('posCashChange');
  if(cashDiv)cashDiv.style.display=mode==='Cash'?'':'none';
}

// ── Save bill ─────────────────────────────────────────────────────────────────
function savePOSBill(print){
  const items=window._posBillItems||[];
  if(!items.length)return NOTIFY.show('Add at least one item to the bill','error');
  const sym=STRATIX_DB.getSettings().currencySymbol||'₹';
  const subtotal=items.reduce((s,i)=>s+(i.qty*i.price),0);
  const discRaw=parseFloat(document.getElementById('posDiscount')?.value)||0;
  const discType=document.getElementById('posDiscType')?.value||'flat';
  const discount=discType==='pct'?subtotal*(discRaw/100):discRaw;
  const gstPct=parseFloat(document.getElementById('posGST')?.value)||0;
  const afterDisc=Math.max(0,subtotal-discount);
  const gstAmt=afterDisc*(gstPct/100);
  const loyaltyUse=Math.min(parseFloat(document.getElementById('posLoyaltyUse')?.value)||0,afterDisc);
  const total=Math.round(Math.max(0,afterDisc+gstAmt-loyaltyUse));
  const customerName=(document.getElementById('posCustomer')?.value.trim())||'Walk-in';
  const customerPhone=(document.getElementById('posPhone')?.value.trim())||'';
  const billDate=(document.getElementById('posBillDate')?.value)||new Date().toISOString().split('T')[0];
  const note=(document.getElementById('posBillNote')?.value.trim())||'';
  const payMode=document.getElementById('posPayMode')?.value||'Cash';
  // Loyalty
  const loyaltyEarned=Math.floor(total/100);
  const loyaltyRecs=STRATIX_DB.getArr('loyalty_points');
  const existingLoy=loyaltyRecs.find(l=>l.customerName.toLowerCase()===customerName.toLowerCase());
  const prevPts=existingLoy?Number(existingLoy.points):0;
  const newPts=Math.max(0,prevPts-loyaltyUse+loyaltyEarned);
  if(existingLoy){STRATIX_DB.update('loyalty_points',existingLoy.id,{points:newPts,lastBill:billDate});}
  else if(customerName!=='Walk-in'){STRATIX_DB.push('loyalty_points',{customerName,points:newPts,lastBill:billDate});}
  const bill={
    billNo:'BILL-'+String(STRATIX_DB.getArr('rtl_bills').length+1).padStart(5,'0'),
    customerName,customerPhone,phone:customerPhone,
    items:[...items],subtotal,discount,discountType:discType,gstPct,gstAmt,
    loyaltyUsed:loyaltyUse,loyaltyPoints:loyaltyEarned,totalPoints:newPts,
    total,payMode,note,date:billDate,
    time:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
  };
  STRATIX_DB.push('rtl_bills',bill);
  // Reduce stock
  const stockItems=STRATIX_DB.getArr('rtl_items');
  items.forEach(bi=>{const found=stockItems.find(i=>i.name.toLowerCase()===bi.name.toLowerCase());if(found)STRATIX_DB.update('rtl_items',found.id,{qty:Math.max(0,Number(found.qty)-Number(bi.qty))});});
  // Record revenue
  STRATIX_DB.push('transactions',{type:'revenue',amount:total,category:'sales',description:'Bill '+bill.billNo+' — '+bill.customerName,date:billDate,createdAt:new Date().toISOString()});
  if(print)printReceipt(bill);
  closePOS();
  NOTIFY.show('Bill saved! Total: '+sym+total.toLocaleString('en-IN')+(loyaltyEarned>0?' · +'+loyaltyEarned+' loyalty pts':''),'success',4000);
  if(APP.currentSection==='dashboard')renderRetailDashboard();
}

function posShareWhatsApp(){
  const items=window._posBillItems||[];
  if(!items.length)return NOTIFY.show('Add items first','error');
  const sym=STRATIX_DB.getSettings().currencySymbol||'₹';
  const cfg=STRATIX_DB.getSettings();
  const total=parseInt((document.getElementById('posTotal')?.textContent||'0').replace(/[^0-9]/g,''))||0;
  const cust=(document.getElementById('posCustomer')?.value.trim())||'Customer';
  const phone=(document.getElementById('posPhone')?.value.trim())||'';
  let msg='*Bill from '+( cfg.businessName||'My Shop')+'*\n\nDear '+cust+',\n\n';
  items.forEach(i=>{msg+='• '+i.name+' × '+i.qty+' = '+sym+Math.round(i.qty*i.price).toLocaleString('en-IN')+'\n';});
  msg+='\n*Total: '+sym+total.toLocaleString('en-IN')+'*\n\nThank you! \uD83D\uDE4F';
  const url=phone?'https://wa.me/91'+phone.replace(/\D/g,'')+'?text='+encodeURIComponent(msg):'https://wa.me/?text='+encodeURIComponent(msg);
  window.open(url,'_blank');
}

// ── Print Receipt ─────────────────────────────────────────────────────────────
function printReceipt(bill){
  const cfg=STRATIX_DB.getSettings();
  const sym=cfg.currencySymbol||'₹';
  const w=window.open('','_blank','width=480,height=800');
  if(!w){NOTIFY.show('Pop-ups blocked — allow pop-ups to print','warning',5000);return;}
  const html='<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Bill — '+bill.billNo+'</title>'
  +'<style>'
  +'@import url(\'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap\');'
  +'@page{margin:0;size:80mm auto}'
  +'@media print{body{margin:0;padding:0}.no-print{display:none!important}}'
  +'*{box-sizing:border-box;margin:0;padding:0}'
  +'body{font-family:Inter,Arial,sans-serif;font-size:13px;background:#fff;color:#111;max-width:340px;margin:0 auto;padding:0 0 20px}'
  +'.bh{background:linear-gradient(135deg,#111827,#1f2937);color:#fff;padding:20px 20px 16px;text-align:center}'
  +'.biz-badge{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;background:linear-gradient(135deg,#2563EB,#1D4ED8);border-radius:11px;font-weight:800;font-size:17px;color:#111;margin:0 auto 9px}'
  +'.biz-name{font-size:17px;font-weight:800;margin-bottom:3px}'
  +'.biz-meta{font-size:11px;color:rgba(255,255,255,.65);line-height:1.7}'
  +'.bill-badge{display:inline-flex;align-items:center;gap:5px;background:rgba(37,99,235,.15);border:1px solid rgba(37,99,235,.3);border-radius:20px;padding:4px 14px;margin-top:11px;font-size:11px;font-weight:700;color:#2563EB;letter-spacing:.5px}'
  +'.bi{padding:13px 18px;display:grid;grid-template-columns:1fr 1fr;gap:9px;border-bottom:1px solid #f0f0f0}'
  +'.bi label{font-size:10px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:2px}'
  +'.bi span{font-size:13px;font-weight:600;color:#111}'
  +'.is{padding:13px 18px}'
  +'.ih{display:grid;grid-template-columns:1fr 60px 75px 75px;gap:3px;border-bottom:2px solid #111;padding-bottom:6px;margin-bottom:6px}'
  +'.ih div{font-size:10px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.4px}'
  +'.ih .r{text-align:right}'
  +'.ir{display:grid;grid-template-columns:1fr 60px 75px 75px;gap:3px;padding:7px 0;border-bottom:1px solid #f5f5f5;align-items:start}'
  +'.in{font-size:13px;font-weight:600;color:#111}'
  +'.ir .r{text-align:right;font-size:13px;color:#333}'
  +'.irt{text-align:right;font-size:13px;font-weight:700;color:#111}'
  +'.ts{padding:0 18px 13px}'
  +'.tr{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#444}'
  +'.trg{border-top:2px solid #111;margin-top:7px;padding-top:9px}'
  +'.trg span:first-child{font-size:15px;font-weight:800;color:#111}'
  +'.trg span:last-child{font-size:18px;font-weight:800;color:#111}'
  +'.tw{font-size:11px;color:#888;text-align:right;margin-top:3px;font-style:italic}'
  +'.ps{padding:12px 18px;background:#f9f9f9;margin:12px 18px;border-radius:9px;border:1px solid #eee}'
  +'.pm{display:inline-flex;align-items:center;gap:5px;background:#e8f5e9;color:#2e7d32;border:1px solid #c8e6c9;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700}'
  +'.lb{margin:0 18px 12px;background:#fff8e1;border:1px solid #ffc107;border-radius:9px;padding:9px 13px;text-align:center}'
  +'.lb .lbig{font-size:19px;font-weight:800;color:#e65100}'
  +'.lb .lsub{font-size:11px;color:#888;margin-top:2px}'
  +'.bn{font-size:11px;color:#666;margin:0 18px 12px;background:#f5f5f5;border-radius:8px;padding:7px 11px}'
  +'.gst{padding:0 18px 12px}'
  +'.gt{width:100%;border-collapse:collapse;font-size:12px}'
  +'.gt td{padding:4px 7px;color:#555}.gt td:last-child{text-align:right;font-weight:600}'
  +'.bf{text-align:center;padding:13px 18px;border-top:1px solid #f0f0f0}'
  +'.ty{font-size:15px;font-weight:800;color:#111;margin-bottom:5px}'
  +'.fs{font-size:11px;color:#888;margin-bottom:11px}'
  +'.sxp{display:inline-flex;align-items:center;gap:5px;background:#111;border-radius:20px;padding:4px 12px}'
  +'.sxml{width:15px;height:15px;background:linear-gradient(135deg,#2563EB,#1D4ED8);border-radius:4px;display:inline-flex;align-items:center;justify-content:center;font-size:7px;font-weight:800;color:#111}'
  +'.sxt{font-size:10px;font-weight:700;color:#2563EB;letter-spacing:1px}'
  +'.pb{display:block;margin:14px auto 0;padding:9px 26px;background:#111;border:none;border-radius:8px;color:#fff;font-size:13px;font-weight:700;cursor:pointer}'
  +'</style></head><body>'
  // HEADER
  +'<div class="bh">'
  +'<div class="biz-badge">'+( cfg.businessName||'S').charAt(0).toUpperCase()+'</div>'
  +'<div class="biz-name">'+(cfg.businessName||'My Shop')+'</div>'
  +'<div class="biz-meta">'+(cfg.phone?'Ph: '+cfg.phone:'')+(cfg.address?'<br/>'+cfg.address:'')+(cfg.gstNumber?'<br/>GSTIN: '+cfg.gstNumber:'')+'</div>'
  +'<div class="bill-badge">SALES RECEIPT</div>'
  +'</div>'
  // BILL INFO
  +'<div class="bi">'
  +'<div><label>Bill No</label><span>'+bill.billNo+'</span></div>'
  +'<div><label>Date &amp; Time</label><span>'+bill.date+' '+(bill.time||'')+'</span></div>'
  +'<div><label>Customer</label><span>'+(bill.customerName||'Walk-in')+'</span></div>'
  +'<div><label>Phone</label><span>'+(bill.customerPhone||'—')+'</span></div>'
  +(cfg.panNumber?'<div><label>PAN</label><span>'+cfg.panNumber+'</span></div>':'')
  +(cfg.gstNumber?'<div><label>GSTIN</label><span>'+cfg.gstNumber+'</span></div>':'')
  +'</div>'
  // ITEMS
  +'<div class="is"><div class="ih"><div>Item</div><div class="r">Qty</div><div class="r">Rate</div><div class="r">Amt</div></div>'
  +bill.items.map(function(i){return'<div class="ir"><div class="in">'+i.name+'</div><div class="r">'+i.qty+'</div><div class="r">'+sym+Number(i.price).toLocaleString('en-IN')+'</div><div class="irt">'+sym+Math.round(i.qty*i.price).toLocaleString('en-IN')+'</div></div>';}).join('')
  +'</div>'
  // TOTALS
  +'<div class="ts">'
  +'<div class="tr"><span>Subtotal ('+bill.items.length+' items)</span><span>'+sym+Math.round(bill.subtotal).toLocaleString('en-IN')+'</span></div>'
  +(bill.discount>0?'<div class="tr" style="color:#388e3c"><span>Discount</span><span>-'+sym+Math.round(bill.discount).toLocaleString('en-IN')+'</span></div>':'')
  +(bill.loyaltyUsed>0?'<div class="tr" style="color:#e65100"><span>Loyalty Redeemed</span><span>-'+sym+Math.round(bill.loyaltyUsed).toLocaleString('en-IN')+'</span></div>':'')
  +(bill.gstPct>0?'<div class="tr"><span>GST ('+bill.gstPct+'%)</span><span>+'+sym+Math.round(bill.gstAmt).toLocaleString('en-IN')+'</span></div>':'')
  +'<div class="tr trg"><span>TOTAL</span><span>'+sym+bill.total.toLocaleString('en-IN')+'</span></div>'
  +'<div class="tw">'+numToWords(bill.total)+' Only</div>'
  +'</div>'
  // GST BREAKUP
  +(bill.gstPct>0?'<div class="gst"><table class="gt">'
    +'<tr style="background:#f9f9f9"><td>Taxable Value</td><td>'+sym+Math.round(bill.subtotal-(bill.discount||0)).toLocaleString('en-IN')+'</td></tr>'
    +'<tr><td>SGST @ '+(bill.gstPct/2)+'%</td><td>'+sym+Math.round(bill.gstAmt/2).toLocaleString('en-IN')+'</td></tr>'
    +'<tr><td>CGST @ '+(bill.gstPct/2)+'%</td><td>'+sym+Math.round(bill.gstAmt/2).toLocaleString('en-IN')+'</td></tr>'
    +'<tr style="background:#f9f9f9"><td style="font-weight:700">Total GST</td><td style="font-weight:700">'+sym+Math.round(bill.gstAmt).toLocaleString('en-IN')+'</td></tr>'
    +'</table></div>':'')
  // PAYMENT
  +'<div class="ps"><div style="display:flex;justify-content:space-between;align-items:center">'
  +'<div><div style="font-size:10px;color:#888;margin-bottom:4px;text-transform:uppercase;font-weight:700">Payment Received</div>'
  +'<span class="pm">&#x2713; '+(bill.payMode||'Cash')+'</span></div>'
  +'<div style="text-align:right"><div style="font-size:11px;color:#888;margin-bottom:3px">Amount Paid</div>'
  +'<div style="font-size:20px;font-weight:800;color:#111">'+sym+bill.total.toLocaleString('en-IN')+'</div></div>'
  +'</div></div>'
  // LOYALTY
  +(bill.loyaltyPoints>0?'<div class="lb"><div class="lbig">&#x2B50; +'+bill.loyaltyPoints+' Points Earned!</div><div class="lsub">Balance: '+(bill.totalPoints||0)+' pts = '+sym+(bill.totalPoints||0)+' redeemable</div></div>':'')
  // NOTE
  +(bill.note?'<div class="bn">Note: '+bill.note+'</div>':'')
  // UPI
  +(cfg.upiId?'<div style="text-align:center;font-size:11px;color:#888;margin-bottom:10px">Pay via UPI: <strong>'+cfg.upiId+'</strong></div>':'')
  // FOOTER
  +'<div class="bf"><div class="ty">Thank you for shopping! &#x1F64F;</div>'
  +'<div class="fs">Visit again &middot; '+(cfg.businessName||'My Shop')+'</div>'
  +'<div class="sxp"><div class="sxml">SX</div><span class="sxt">STRATIX</span></div>'
  +'<div style="font-size:10px;color:#aaa;margin-top:7px">'+new Date().toLocaleString('en-IN')+'</div>'
  +'</div>'
  +'<button class="pb no-print" onclick="window.print()">&#x1F5A8;&#xFE0F; Print Receipt</button>'
  +'</body></html>';
  w.document.write(html);w.document.close();
  setTimeout(function(){w.print();},600);
}

function closePOS(){const el=document.getElementById('posOverlay');if(el)el.remove();window._posBillItems=[];}

// ── Stock Modal ────────────────────────────────────────────────────────────────
function openAddStockModal(){
  const items=STRATIX_DB.getArr('rtl_items');
  const categories=[...new Set(items.map(i=>i.category).filter(Boolean))];
  document.body.insertAdjacentHTML('beforeend',`
  <div class="overlay" id="stockModal" onclick="if(event.target===this)closeStockModal()">
    <div class="modal" style="max-width:760px;max-height:90vh">
      <div class="modal-hd">
        <div class="modal-title">&#x1F4E6; Stock Management &mdash; ${items.length} Items</div>
        <button class="modal-close" onclick="closeStockModal()">&#x2715;</button>
      </div>
      <div class="modal-body">
        <div style="background:var(--surface3);border-radius:12px;padding:16px;margin-bottom:16px;border:1px solid var(--border)">
          <div style="font-size:12px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:.7px;margin-bottom:12px">&#x2795; Add New Item</div>
          <div class="form-grid" style="grid-template-columns:2fr 1fr 1fr 1fr">
            <div class="field"><label>Item Name *</label><input id="stkName" placeholder="Basmati Rice 1kg" autofocus/></div>
            <div class="field"><label>Category</label>
              <input id="stkCat" placeholder="Grocery..." list="stkCatList"/>
              <datalist id="stkCatList">${categories.map(c=>`<option value="${escapeHTML(c)}">`).join('')}</datalist>
            </div>
            <div class="field"><label>HSN Code</label><input id="stkHSN" placeholder="1006"/></div>
            <div class="field"><label>Barcode / SKU</label><input id="stkSKU" placeholder="SKU-001"/></div>
          </div>
          <div class="form-grid" style="grid-template-columns:1fr 1fr 1fr 1fr 1fr">
            <div class="field"><label>Opening Stock *</label><input type="number" id="stkQty" placeholder="100"/></div>
            <div class="field"><label>Unit</label><input id="stkUnit" placeholder="pcs / kg / box"/></div>
            <div class="field"><label>MRP / Selling (&#x20B9;)</label><input type="number" id="stkMRP" placeholder="120"/></div>
            <div class="field"><label>Cost Price (&#x20B9;)</label><input type="number" id="stkCost" placeholder="95"/></div>
            <div class="field"><label>Low Stock Alert</label><input type="number" id="stkMin" placeholder="10"/></div>
          </div>
          <button class="btn btn-vx" onclick="saveStockItem()">&#x1F4BE; Save Item</button>
        </div>
        ${items.length>0?`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <input type="text" placeholder="&#x1F50D; Search items..."
            style="flex:1;background:var(--surface3);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--text);outline:none"
            oninput="document.querySelectorAll('.stk-row').forEach(r=>{r.style.display=!this.value||r.textContent.toLowerCase().includes(this.value.toLowerCase())?'':'none'})"/>
          <span style="font-size:12px;color:var(--muted)">${items.length} items</span>
        </div>
        <div class="tbl-scroll"><table>
          <thead><tr>
            <th>Item</th><th>Category</th><th>HSN</th><th>SKU</th>
            <th>Stock</th><th>MRP</th><th>Cost</th><th>Margin</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
          ${items.map(i=>{
            const isLow=Number(i.qty||0)<=Number(i.minQty||0);
            const margin=i.mrp&&i.costPrice?Math.round(((i.mrp-i.costPrice)/i.mrp)*100):null;
            return`<tr class="stk-row">
              <td class="td-b">${escapeHTML(i.name)}</td>
              <td class="td-m">${escapeHTML(i.category||'—')}</td>
              <td class="td-m" style="font-size:11px">${escapeHTML(i.hsn||'—')}</td>
              <td class="td-m" style="font-size:11px">${escapeHTML(i.sku||'—')}</td>
              <td style="font-weight:700;color:${isLow?'var(--red)':'var(--green)'}">${i.qty} <span style="font-size:10px;color:var(--muted)">${escapeHTML(i.unit||'')}</span></td>
              <td class="td-gold">${_fmt(i.mrp||0,'₹')}</td>
              <td class="td-m">${_fmt(i.costPrice||0,'₹')}</td>
              <td style="font-weight:600;color:${margin>30?'var(--green)':margin>10?'var(--gold)':'var(--red)'}">${margin!==null?margin+'%':'—'}</td>
              <td><span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:20px;background:${isLow?'rgba(255,77,77,.1)':'rgba(0,214,143,.1)'};color:${isLow?'var(--red)':'var(--green)'}">${isLow?'Low':'OK'}</span></td>
              <td style="white-space:nowrap">
                <button class="btn btn-ghost btn-sm" style="margin-right:3px" onclick="stkAdjust('${i.id}','${escapeHTML(i.name).replace(/'/g,"\\'")}',${i.qty||0})">&#xB1; Adj</button>
                <button class="del-btn" onclick="deleteStockItem('${i.id}')">&#x1F5D1;</button>
              </td>
            </tr>`;}).join('')}
          </tbody>
        </table></div>`:
        `<div style="text-align:center;padding:30px;color:var(--muted)"><div style="font-size:36px;margin-bottom:10px">&#x1F4E6;</div><div>No items added yet. Fill the form above to get started.</div></div>`}
      </div>
    </div>
  </div>`);
}

function saveStockItem(){
  const name=document.getElementById('stkName').value.trim();
  if(!name)return NOTIFY.show('Enter item name','error');
  STRATIX_DB.push('rtl_items',{
    name,category:document.getElementById('stkCat').value.trim(),
    hsn:document.getElementById('stkHSN').value.trim(),
    sku:document.getElementById('stkSKU').value.trim(),
    qty:parseFloat(document.getElementById('stkQty').value)||0,
    unit:document.getElementById('stkUnit').value.trim()||'pcs',
    mrp:parseFloat(document.getElementById('stkMRP').value)||0,
    costPrice:parseFloat(document.getElementById('stkCost').value)||0,
    minQty:parseFloat(document.getElementById('stkMin').value)||5
  });
  NOTIFY.show('Item saved!','success',1500);
  closeStockModal();openAddStockModal();
}

function stkAdjust(id,name,currentQty){
  const existing=document.getElementById('adjStk_'+id);if(existing){existing.remove();return;}
  const row=[...document.querySelectorAll('.stk-row')].find(r=>r.innerHTML.includes("'"+id+"'"));
  if(!row)return;
  const cell=row.querySelector('td:last-child');
  const div=document.createElement('div');div.id='adjStk_'+id;div.style.cssText='display:flex;align-items:center;gap:4px;margin-top:5px';
  div.innerHTML=`<input type="number" id="adjAmt_${id}" placeholder="±qty" style="width:66px;background:var(--surface3);border:1px solid var(--border2);border-radius:6px;padding:4px 7px;font-size:12px;color:var(--text);outline:none"/>
    <button class="btn btn-vx btn-sm" onclick="var v=parseFloat(document.getElementById('adjAmt_${id}').value);if(isNaN(v)){NOTIFY.show('Enter a number','error');return;}STRATIX_DB.update('rtl_items','${id}',{qty:Math.max(0,${currentQty}+v)});NOTIFY.show('Stock updated','success',1500);closeStockModal();openAddStockModal();">&#x2713;</button>
    <button class="btn btn-ghost btn-sm" onclick="document.getElementById('adjStk_${id}').remove()">&#x2715;</button>`;
  cell.appendChild(div);document.getElementById('adjAmt_'+id)?.focus();
}

function deleteStockItem(id){STRATIX_DB.remove('rtl_items',id);NOTIFY.show('Item removed','info',1500);closeStockModal();openAddStockModal();}
function closeStockModal(){const m=document.getElementById('stockModal');if(m)m.remove();}

// ── Loyalty Manager ───────────────────────────────────────────────────────────
function renderLoyaltyManager(){
  const records=STRATIX_DB.getArr('loyalty_points');
  const bills=STRATIX_DB.getArr('rtl_bills');
  const sym=STRATIX_DB.getSettings().currencySymbol||'₹';
  const totalPts=records.reduce((s,r)=>s+Number(r.points||0),0);
  document.getElementById('sectionContent').innerHTML=`
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">&#x2B50; Loyalty Points Manager</h1>
      <p class="sec-sub">1 pt per ${sym}100 spent &middot; 1 pt = ${sym}1 discount &middot; Auto-tracked at POS</p></div>
      <button class="btn btn-gold" onclick="openManualLoyalty()">+ Adjust Points</button>
    </div>
    <div class="kpi-grid" style="margin-bottom:20px">
      <div class="kpi accent"><div class="kpi-ico">&#x1F465;</div><div class="kpi-lbl">Members</div><div class="kpi-val">${records.length}</div></div>
      <div class="kpi"><div class="kpi-ico">&#x2B50;</div><div class="kpi-lbl">Total Points</div><div class="kpi-val gold">${totalPts.toLocaleString('en-IN')}</div></div>
      <div class="kpi"><div class="kpi-ico">&#x1F4B0;</div><div class="kpi-lbl">Redeemable</div><div class="kpi-val">${sym}${totalPts.toLocaleString('en-IN')}</div></div>
      <div class="kpi"><div class="kpi-ico">&#x1F9FE;</div><div class="kpi-lbl">Total Bills</div><div class="kpi-val">${bills.length}</div></div>
    </div>
    <div class="tbl-wrap">
      <div class="tbl-head"><div class="tbl-title">Customer Loyalty Ledger</div></div>
      ${!records.length?`<div style="padding:40px;text-align:center;color:var(--muted)">No loyalty members yet. Points are earned automatically when customers are named at POS.</div>`:
      `<div class="tbl-scroll"><table>
        <thead><tr><th>Customer</th><th>Points</th><th>Value (${sym})</th><th>Last Bill</th><th>Tier</th><th></th></tr></thead>
        <tbody>
        ${[...records].sort((a,b)=>Number(b.points)-Number(a.points)).map(r=>{const pts=Number(r.points||0);return`<tr>
          <td class="td-b">${escapeHTML(r.customerName)}</td>
          <td style="font-size:16px;font-weight:800;color:var(--gold)">${pts.toLocaleString('en-IN')} pts</td>
          <td style="font-weight:700;color:var(--green)">${sym}${pts.toLocaleString('en-IN')}</td>
          <td class="td-m">${r.lastBill||'—'}</td>
          <td><span class="badge ${pts>500?'bgold':pts>100?'bb':'bm'}">${pts>500?'&#x1F947; Gold':pts>100?'&#x1F948; Silver':'&#x1F949; Bronze'}</span></td>
          <td style="display:flex;gap:5px">
            <button class="btn btn-ghost btn-sm" onclick="openManualLoyalty('${r.id}','${escapeHTML(r.customerName).replace(/'/g,"\\'")}',${pts})">&#x270F;&#xFE0F; Adjust</button>
            <button class="del-btn" onclick="STRATIX_DB.remove('loyalty_points','${r.id}');renderLoyaltyManager()">&#x1F5D1;</button>
          </td>
        </tr>`;}).join('')}
        </tbody>
      </table></div>`}
    </div>
  </div>`;
}

function openManualLoyalty(id,name,pts){
  document.body.insertAdjacentHTML('beforeend',`
  <div class="overlay" id="loyaltyModal" onclick="if(event.target===this)document.getElementById('loyaltyModal').remove()">
    <div class="modal" style="max-width:400px">
      <div class="modal-hd"><div class="modal-title">&#x2B50; Adjust Loyalty Points</div><button class="modal-close" onclick="document.getElementById('loyaltyModal').remove()">&#x2715;</button></div>
      <div class="modal-body">
        <div class="field"><label>Customer Name *</label><input id="loyCustomer" value="${escapeHTML(name||'')}" placeholder="Customer name"/></div>
        <div class="field"><label>Current Points</label><input type="number" id="loyCurrent" value="${pts||0}" readonly style="opacity:.6"/></div>
        <div class="field"><label>Adjustment (+/-)</label><input type="number" id="loyAdj" placeholder="+100 or -50"/></div>
        <div class="field"><label>Reason</label><input id="loyReason" placeholder="Birthday bonus, manual correction..."/></div>
        <div style="display:flex;gap:10px;margin-top:16px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('loyaltyModal').remove()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveLoyaltyAdj('${id||''}')">&#x1F4BE; Save</button>
        </div>
      </div>
    </div>
  </div>`);
}

function saveLoyaltyAdj(editId){
  const customerName=document.getElementById('loyCustomer').value.trim();
  if(!customerName)return NOTIFY.show('Enter customer name','error');
  const adj=parseFloat(document.getElementById('loyAdj').value)||0;
  const existing=STRATIX_DB.getArr('loyalty_points').find(l=>l.id===editId||l.customerName.toLowerCase()===customerName.toLowerCase());
  const newPts=Math.max(0,Number(existing?.points||0)+adj);
  if(existing){STRATIX_DB.update('loyalty_points',existing.id,{points:newPts,lastBill:new Date().toISOString().split('T')[0]});}
  else{STRATIX_DB.push('loyalty_points',{customerName,points:Math.max(0,adj),lastBill:new Date().toISOString().split('T')[0]});}
  NOTIFY.show('Points updated to '+newPts+' ✅','success');
  document.getElementById('loyaltyModal').remove();renderLoyaltyManager();
}

// ── Barcode lookup ─────────────────────────────────────────────────────────────
function posAddByBarcode(val){
  val=(val||'').trim();if(!val)return;
  const items=STRATIX_DB.getArr('rtl_items');
  const found=items.find(i=>(i.sku&&i.sku.toLowerCase()===val.toLowerCase())||(i.barcode&&i.barcode.toLowerCase()===val.toLowerCase())||i.name.toLowerCase()===val.toLowerCase());
  if(!found){NOTIFY.show('No item found for "'+escapeHTML(val)+'"','error',3000);return;}
  posQuickAdd(found.name,found.mrp||0);NOTIFY.show('Added: '+found.name,'success',1500);
}

// ── Loyalty POS lookup ─────────────────────────────────────────────────────────
function posLookupLoyalty(customerName){
  customerName=(customerName||'').trim();
  const infoEl=document.getElementById('posLoyaltyInfo');
  const redeemEl=document.getElementById('posLoyaltyRedeem');
  const availEl=document.getElementById('posLoyaltyAvail');
  if(!infoEl||!redeemEl)return;
  if(!customerName||customerName==='Walk-in'){infoEl.style.display='none';redeemEl.style.display='none';return;}
  const rec=(STRATIX_DB.getArr('loyalty_points')||[]).find(l=>l.customerName.toLowerCase()===customerName.toLowerCase());
  const pts=rec?Number(rec.points):0;
  if(pts>0){
    infoEl.style.display='block';infoEl.textContent='⭐ '+customerName+' has '+pts+' loyalty points = ₹'+pts+' redeemable';
    redeemEl.style.display='block';if(availEl)availEl.textContent='Available: '+pts+' points';
    const useInput=document.getElementById('posLoyaltyUse');if(useInput)useInput.max=pts;
  }else{
    infoEl.style.display='block';infoEl.textContent='⭐ New member — will earn points on this purchase';
    redeemEl.style.display='none';
  }
}

// ── Variant Manager ───────────────────────────────────────────────────────────
function renderVariantManager(){
  const products=STRATIX_DB.getArr('variant_products');
  document.getElementById('sectionContent').innerHTML=`
  <div class="sec">
    <div class="sec-head">
      <div><h1 class="sec-title">&#x1F3A8; Variant Manager</h1><p class="sec-sub">Manage products with multiple sizes, colors &amp; SKUs</p></div>
      <button class="btn btn-gold" onclick="openVariantProduct()">+ New Product</button>
    </div>
    ${!products.length?`<div class="empty" style="padding:60px"><div class="ei">&#x1F3A8;</div><h3>No variant products yet</h3><p>Add products with multiple sizes, colors or materials</p><button class="btn btn-gold" style="margin-top:16px" onclick="openVariantProduct()">+ Add First Product</button></div>`:
    products.map(p=>{const variants=p.variants||[];const ts=variants.reduce((s,v)=>s+Number(v.qty||0),0);const ls=variants.filter(v=>Number(v.qty||0)<=Number(v.minQty||0)).length;return`
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div><div style="font-size:15px;font-weight:700">${escapeHTML(p.name)}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">${escapeHTML(p.category||'')} &middot; ${variants.length} variants &middot; ${ts} units${ls?` &middot; <span style="color:var(--red)">${ls} low</span>`:''}</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="openVariantProduct('${p.id}')">&#x270F;&#xFE0F; Edit</button>
          <button class="del-btn" onclick="STRATIX_DB.remove('variant_products','${p.id}');renderVariantManager()">&#x1F5D1;</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
        ${variants.map(v=>{const isLow=Number(v.qty||0)<=Number(v.minQty||0);return`
        <div style="background:var(--surface2);border:1px solid ${isLow?'rgba(255,77,77,.3)':'var(--border)'};border-radius:9px;padding:10px 12px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">${escapeHTML(v.size||'')}${v.color?' &middot; '+escapeHTML(v.color):''}</div>
          <div style="font-size:12px;font-weight:600;color:var(--text);margin-top:2px">${escapeHTML(v.sku||'—')}</div>
          <div style="font-size:18px;font-weight:800;color:${isLow?'var(--red)':'var(--green)'};margin-top:4px">${v.qty||0}</div>
          <div style="font-size:11px;color:var(--gold)">&#x20B9;${Number(v.mrp||0).toLocaleString('en-IN')}</div>
          ${isLow?`<div style="font-size:10px;color:var(--red);margin-top:3px;font-weight:700">&#x26A0; Low Stock</div>`:''}
        </div>`;}).join('')}
      </div>
    </div>`;}).join('')}
  </div>`;
}

function openVariantProduct(editId){
  const ex=editId?STRATIX_DB.getArr('variant_products').find(p=>p.id===editId):null;
  const variants=ex?.variants||[{size:'S',color:'',sku:'',qty:0,mrp:0,minQty:0}];
  document.body.insertAdjacentHTML('beforeend',`
  <div class="overlay" id="variantModal" onclick="if(event.target===this)closeVariantModal()">
    <div class="modal" style="max-width:680px;max-height:90vh">
      <div class="modal-hd"><div class="modal-title">&#x1F3A8; ${editId?'Edit':'New'} Variant Product</div><button class="modal-close" onclick="closeVariantModal()">&#x2715;</button></div>
      <div class="modal-body">
        <div class="form-grid" style="margin-bottom:16px">
          <div class="field"><label>Product Name *</label><input id="vpName" value="${escapeHTML(ex?.name||'')}" placeholder="Cotton T-Shirt"/></div>
          <div class="field"><label>Category</label><input id="vpCat" value="${escapeHTML(ex?.category||'')}" placeholder="Apparel..."/></div>
          <div class="field"><label>Base MRP (&#x20B9;)</label><input type="number" id="vpBaseMRP" value="${ex?.baseMRP||''}" placeholder="299"/></div>
          <div class="field"><label>Variant Type</label>
            <select id="vpVarType">
              <option value="size" ${ex?.varType==='size'?'selected':''}>Size (S/M/L/XL)</option>
              <option value="color" ${ex?.varType==='color'?'selected':''}>Color</option>
              <option value="both" ${ex?.varType==='both'?'selected':''}>Size + Color</option>
              <option value="custom" ${ex?.varType==='custom'?'selected':''}>Custom</option>
            </select>
          </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.6px">Variants</div>
          <button class="btn btn-ghost btn-sm" onclick="vpAddRow()">+ Add Row</button>
        </div>
        <div style="background:var(--surface2);border-radius:10px;overflow:hidden;margin-bottom:16px">
          <div style="display:grid;grid-template-columns:1fr 1fr 1.2fr 0.8fr 0.8fr 0.8fr auto;padding:8px 12px;background:var(--surface3)">
            ${['Size','Color','SKU','Qty','Min Qty','MRP',''].map(h=>`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">${h}</div>`).join('')}
          </div>
          <div id="vpRows">
            ${variants.map(v=>`<div class="vp-row" style="display:grid;grid-template-columns:1fr 1fr 1.2fr 0.8fr 0.8fr 0.8fr auto;gap:4px;padding:6px 12px;border-bottom:1px solid var(--border);align-items:center">
              <input class="vp-size" value="${escapeHTML(v.size||'')}" placeholder="S/M/L"/>
              <input class="vp-color" value="${escapeHTML(v.color||'')}" placeholder="Red"/>
              <input class="vp-sku" value="${escapeHTML(v.sku||'')}" placeholder="SKU-001"/>
              <input type="number" class="vp-qty" value="${v.qty||0}" min="0"/>
              <input type="number" class="vp-minqty" value="${v.minQty||0}" min="0"/>
              <input type="number" class="vp-mrp" value="${v.mrp||''}" placeholder="0"/>
              <button class="del-btn" onclick="this.closest('.vp-row').remove()">&#x1F5D1;</button>
            </div>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-ghost" style="flex:1" onclick="closeVariantModal()">Cancel</button>
          <button class="btn btn-gold" style="flex:2" onclick="saveVariantProduct('${editId||''}')">&#x1F4BE; Save Product</button>
        </div>
      </div>
    </div>
  </div>`);
}

function vpAddRow(){const wrap=document.getElementById('vpRows');const div=document.createElement('div');div.className='vp-row';div.style.cssText='display:grid;grid-template-columns:1fr 1fr 1.2fr 0.8fr 0.8fr 0.8fr auto;gap:4px;padding:6px 12px;border-bottom:1px solid var(--border);align-items:center';div.innerHTML='<input class="vp-size" placeholder="S/M/L"/><input class="vp-color" placeholder="Red"/><input class="vp-sku" placeholder="SKU"/><input type="number" class="vp-qty" value="0" min="0"/><input type="number" class="vp-minqty" value="0" min="0"/><input type="number" class="vp-mrp" placeholder="0"/><button class="del-btn" onclick="this.closest(\'.vp-row\').remove()">&#x1F5D1;</button>';wrap.appendChild(div);}

function saveVariantProduct(editId){
  const name=document.getElementById('vpName').value.trim();
  if(!name){NOTIFY.show('Enter product name','error');return;}
  const variants=Array.from(document.querySelectorAll('.vp-row')).map(r=>({size:r.querySelector('.vp-size').value.trim(),color:r.querySelector('.vp-color').value.trim(),sku:r.querySelector('.vp-sku').value.trim(),qty:parseFloat(r.querySelector('.vp-qty').value)||0,minQty:parseFloat(r.querySelector('.vp-minqty').value)||0,mrp:parseFloat(r.querySelector('.vp-mrp').value)||0})).filter(v=>v.size||v.sku);
  if(!variants.length){NOTIFY.show('Add at least one variant','error');return;}
  const item={name,category:document.getElementById('vpCat').value.trim(),baseMRP:parseFloat(document.getElementById('vpBaseMRP').value)||0,varType:document.getElementById('vpVarType').value,variants};
  if(editId){STRATIX_DB.update('variant_products',editId,item);NOTIFY.show('Product updated ✅','success');}
  else{STRATIX_DB.push('variant_products',item);NOTIFY.show('Product saved ✅','success');}
  closeVariantModal();renderVariantManager();
}
function closeVariantModal(){const m=document.getElementById('variantModal');if(m)m.remove();}

// ── Demo seed (disabled) ──────────────────────────────────────────────────────
function seedRetailDemo(){return;}

// ── Number to words ───────────────────────────────────────────────────────────
function numToWords(num){
  num=Math.floor(num||0);if(num===0)return'Zero Rupees';
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const conv=n=>{if(n<20)return ones[n];if(n<100)return tens[Math.floor(n/10)]+(n%10?' '+ones[n%10]:'');if(n<1000)return ones[Math.floor(n/100)]+' Hundred'+(n%100?' '+conv(n%100):'');if(n<100000)return conv(Math.floor(n/1000))+' Thousand'+(n%1000?' '+conv(n%1000):'');if(n<10000000)return conv(Math.floor(n/100000))+' Lakh'+(n%100000?' '+conv(n%100000):'');return conv(Math.floor(n/10000000))+' Crore'+(n%10000000?' '+conv(n%10000000):'');};
  return'Rupees '+conv(num);
}
// _fmt() and _greet() defined in vertical.js
