/**
 * STRATIX erp.js v4.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * MODULE 1 → ERP  (Enterprise Resource Planning)
 *   - Inventory Management
 *   - Purchase Orders (Inward)
 *   - Sales Orders (Outward)
 *   - Production / Job Work Planning
 *   - Accounts Payable & Receivable
 *   - Financial Ledger
 *
 * MODULE 2 → CRM  (Customer Relationship Management)
 *   - Lead Management
 *   - Contact & Company Directory
 *   - Deal Pipeline (Kanban)
 *   - Follow-up Reminders
 *   - Activity Log
 *   - Customer Lifetime Value
 *
 * MODULE 3 → SCM  (Supply Chain Management)
 *   - Supplier / Vendor Master
 *   - Purchase Requisitions
 *   - Supplier Quotation Comparison
 *   - Inward Shipment Tracking
 *   - Inventory Reorder Alerts
 *   - Demand Forecasting
 *   - Supplier Performance Scorecard
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/* ── Shared helpers ──────────────────────────────────────────── */
const EH = {
  sym()   { return STRATIX_DB.getSettings().currencySymbol || '₹'; },
  biz()   { return STRATIX_DB.getSettings().businessName   || 'Your Company'; },
  today() { return new Date().toISOString().split('T')[0]; },
  id(p)   { return p + Date.now().toString(36) + Math.random().toString(36).slice(2,4); },
  fmt(n)  {
    n = Math.abs(n || 0);
    if (n >= 10000000) return (n/10000000).toFixed(2)+' Cr';
    if (n >= 100000)   return (n/100000).toFixed(2)+' L';
    if (n >= 1000)     return (n/1000).toFixed(1)+'K';
    return Math.round(n).toLocaleString('en-IN');
  },
  dateStr(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
  },
  daysAgo(d) {
    return Math.round((new Date() - new Date(d)) / 86400000);
  },
  toast(msg, type='success') { NOTIFY.show(msg, type); },

  // Generic empty state
  empty(icon, title, sub, btnLabel, btnFn) {
    return `<div class="empty">
      <div class="ei">${icon}</div>
      <h3>${title}</h3>
      <p>${sub}</p>
      ${btnLabel ? `<button class="btn btn-gold" onclick="${btnFn}">${btnLabel}</button>` : ''}
    </div>`;
  },

  // Reusable modal shell
  modal(id, title, body, wide=false) {
    return `<div class="overlay" id="${id}" onclick="if(event.target.id==='${id}')document.getElementById('${id}').remove()">
      <div class="modal" style="${wide?'max-width:700px':''}">
        <div class="modal-hd">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" onclick="document.getElementById('${id}').remove()">✕</button>
        </div>
        <div class="modal-body">${body}</div>
      </div>
    </div>`;
  },

  // Stat badge
  badge(text, type) {
    const map = {
      green:'bg', red:'br', gold:'bgold', blue:'bb', orange:'bo', muted:'bm'
    };
    return `<span class="badge ${map[type]||'bm'}">${text}</span>`;
  },

  // Status color helper
  statusColor(status) {
    const m = {
      'Active':'green','Open':'blue','Draft':'muted','Pending':'orange',
      'Confirmed':'blue','In Progress':'orange','Completed':'green',
      'Cancelled':'red','Overdue':'red','Paid':'green','Unpaid':'red',
      'Partial':'orange','Hot':'red','Warm':'orange','Cold':'muted',
      'Won':'green','Lost':'red','New':'blue','Qualified':'blue',
      'In Stock':'green','Low Stock':'orange','Out of Stock':'red',
    };
    return m[status] || 'muted';
  }
};


/* ════════════════════════════════════════════════════════════════
   MODULE 1 — ERP
   ════════════════════════════════════════════════════════════════ */

function renderERP() {
  const sym = EH.sym();
  const inventory = STRATIX_DB.getArr('erpInventory');
  const salesOrders = STRATIX_DB.getArr('erpSalesOrders');
  const purchaseOrders = STRATIX_DB.getArr('erpPurchaseOrders');
  const jobs = STRATIX_DB.getArr('erpJobs');

  const totalStockValue = inventory.reduce((s,i)=>s+(i.qty||0)*(i.costPrice||0),0);
  const openSales = salesOrders.filter(o=>o.status!=='Completed'&&o.status!=='Cancelled').length;
  const openPOs = purchaseOrders.filter(p=>p.status!=='Received'&&p.status!=='Cancelled').length;
  const lowStock = inventory.filter(i=>(i.qty||0)<=(i.reorderQty||5)).length;

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div><h1 class="sec-title">ERP — Enterprise Resource Planning</h1>
          <p class="sec-sub">Inventory · Purchase Orders · Sales Orders · Production · Ledger</p>
        </div>
        <span class="owner-tag">👑 All Unlocked</span>
      </div>
      <div class="owner-banner">
        <span class="ob-ico">🏭</span>
        <div><div class="ob-txt">Full ERP — Manage your entire business operations</div>
          <div class="ob-sub">Inventory management, purchase & sales orders, job work planning, financial ledger</div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi accent"><div class="kpi-lbl">Total Stock Value</div><div class="kpi-val">${sym}${EH.fmt(totalStockValue)}</div><div class="kpi-ico">📦</div></div>
        <div class="kpi"><div class="kpi-lbl">Open Sales Orders</div><div class="kpi-val blue">${openSales}</div><div class="kpi-ico">🛒</div></div>
        <div class="kpi"><div class="kpi-lbl">Open Purchase Orders</div><div class="kpi-val gold">${openPOs}</div><div class="kpi-ico">🏪</div></div>
        <div class="kpi"><div class="kpi-lbl" style="color:var(--red)">Low / Out of Stock</div><div class="kpi-val red">${lowStock}</div><div class="kpi-ico">⚠️</div></div>
      </div>

      <!-- Sub-module tabs -->
      <div class="calc-tabs" style="margin-bottom:20px">
        <button class="ctab active" id="erp_tab_inv" onclick="ERP.tab('inventory')">📦 Inventory</button>
        <button class="ctab" id="erp_tab_so" onclick="ERP.tab('sales')">🛒 Sales Orders</button>
        <button class="ctab" id="erp_tab_po" onclick="ERP.tab('purchase')">🏪 Purchase Orders</button>
        <button class="ctab" id="erp_tab_job" onclick="ERP.tab('jobs')">🏭 Production / Jobs</button>
        <button class="ctab" id="erp_tab_ledger" onclick="ERP.tab('ledger')">📒 Financial Ledger</button>
      </div>
      <div id="erp_content">${ERP.renderInventory()}</div>
    </div>`;
}

const ERP = {
  tab(name) {
    document.querySelectorAll('[id^="erp_tab_"]').forEach(b=>b.classList.remove('active'));
    document.getElementById('erp_tab_'+name.replace('purchase','po').replace('sales','so').replace('jobs','job').replace('inventory','inv').replace('ledger','ledger'))?.classList.add('active');
    const renders = {inventory:this.renderInventory,sales:this.renderSales,purchase:this.renderPurchase,jobs:this.renderJobs,ledger:this.renderLedger};
    document.getElementById('erp_content').innerHTML = (renders[name]||this.renderInventory).call(this);
  },

  /* ── INVENTORY ── */
  renderInventory() {
    const inv = STRATIX_DB.getArr('erpInventory');
    const sym = EH.sym();
    return `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Stock Register — ${inv.length} Items</span>
          <div style="display:flex;gap:8px">
            <input placeholder="🔍 Search item..." oninput="ERP.searchInv(this.value)" style="width:200px;padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt)"/>
            <button class="btn btn-gold btn-sm" onclick="ERP.openAddItem()">+ Add Item</button>
            <button class="btn btn-ghost btn-sm" onclick="ERP.openStockAdjust()">🔧 Adjust Stock</button>
          </div>
        </div>
        <div class="tbl-scroll">
          <table id="invTable">
            <thead><tr><th>Item Code</th><th>Item Name</th><th>Category</th><th>Unit</th><th>Stock Qty</th><th>Reorder Qty</th><th>Cost Price</th><th>Sale Price</th><th>Stock Value</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${inv.length === 0
                ? `<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--muted)">No items yet. Click "+ Add Item" to create your stock register.</td></tr>`
                : inv.map(i=>{
                    const val = (i.qty||0)*(i.costPrice||0);
                    const status = (i.qty||0)===0?'Out of Stock':(i.qty||0)<=(i.reorderQty||5)?'Low Stock':'In Stock';
                    return `<tr>
                      <td class="td-m">${i.code||'—'}</td>
                      <td class="td-b">${escapeHTML(i.name)}</td>
                      <td class="td-m">${i.category||'—'}</td>
                      <td class="td-m">${i.unit||'pcs'}</td>
                      <td class="${(i.qty||0)<=(i.reorderQty||5)?'td-r td-b':'td-b'}">${i.qty||0}</td>
                      <td class="td-m">${i.reorderQty||5}</td>
                      <td>${sym}${EH.fmt(i.costPrice||0)}</td>
                      <td class="td-g">${sym}${EH.fmt(i.salePrice||0)}</td>
                      <td class="td-gold">${sym}${EH.fmt(val)}</td>
                      <td>${EH.badge(status, EH.statusColor(status))}</td>
                      <td style="display:flex;gap:5px">
                        <button class="btn btn-ghost btn-sm" onclick="ERP.editItem('${i.id}')">✏️</button>
                        <button class="btn btn-red btn-sm" onclick="ERP.deleteItem('${i.id}')">🗑</button>
                      </td>
                    </tr>`;
                  }).join('')
              }
            </tbody>
          </table>
        </div>
        ${inv.filter(i=>(i.qty||0)<=(i.reorderQty||5)).length > 0 ? `
          <div class="alert a-red" style="margin:12px"><span class="alert-ico">⚠️</span>
            <div><b>${inv.filter(i=>(i.qty||0)<=(i.reorderQty||5)).length} items at or below reorder level</b> — 
            ${inv.filter(i=>(i.qty||0)<=(i.reorderQty||5)).map(i=>i.name).join(', ')}</div>
          </div>` : ''}
      </div>
      <div id="erpModal"></div>`;
  },

  searchInv(q) {
    const inv = STRATIX_DB.getArr('erpInventory');
    const f = q ? inv.filter(i=>i.name.toLowerCase().includes(q.toLowerCase())||i.code?.toLowerCase().includes(q.toLowerCase())) : inv;
    const sym = EH.sym();
    const tbody = document.querySelector('#invTable tbody');
    if (!tbody) return;
    tbody.innerHTML = f.map(i=>{
      const val=(i.qty||0)*(i.costPrice||0);
      const status=(i.qty||0)===0?'Out of Stock':(i.qty||0)<=(i.reorderQty||5)?'Low Stock':'In Stock';
      return `<tr>
        <td class="td-m">${i.code||'—'}</td><td class="td-b">${escapeHTML(i.name)}</td><td class="td-m">${i.category||'—'}</td>
        <td class="td-m">${i.unit||'pcs'}</td><td class="${(i.qty||0)<=(i.reorderQty||5)?'td-r td-b':'td-b'}">${i.qty||0}</td>
        <td class="td-m">${i.reorderQty||5}</td><td>${sym}${EH.fmt(i.costPrice||0)}</td>
        <td class="td-g">${sym}${EH.fmt(i.salePrice||0)}</td><td class="td-gold">${sym}${EH.fmt(val)}</td>
        <td>${EH.badge(status,EH.statusColor(status))}</td>
        <td style="display:flex;gap:5px"><button class="btn btn-ghost btn-sm" onclick="ERP.editItem('${i.id}')">✏️</button><button class="btn btn-red btn-sm" onclick="ERP.deleteItem('${i.id}')">🗑</button></td>
      </tr>`;
    }).join('') || `<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--muted)">No results for "${q}"</td></tr>`;
  },

  openAddItem(id) {
    const existing = id ? STRATIX_DB.getArr('erpInventory').find(i=>i.id===id) : null;
    const e = existing || {};
    document.getElementById('erpModal').innerHTML = EH.modal('erpAddItem', id?'Edit Item':'Add Stock Item', `
      <div class="form-grid">
        <div class="field"><label>Item Code</label><input id="ei_code" value="${e.code||''}" placeholder="ITM001"/></div>
        <div class="field"><label>Item Name *</label><input id="ei_name" value="${e.name||''}" placeholder="Steel Rods 12mm"/></div>
        <div class="field"><label>Category</label><select id="ei_cat">
          ${['Raw Material','Finished Goods','Semi-Finished','Consumable','Spare Parts','Packing Material','Trading Goods','Other'].map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
        <div class="field"><label>Unit</label><select id="ei_unit">
          ${['pcs','kg','ton','litre','metre','feet','box','bag','bundle','set','pair','dozen'].map(u=>`<option ${e.unit===u?'selected':''}>${u}</option>`).join('')}
        </select></div>
        <div class="field"><label>Opening Stock (Qty)</label><input type="number" id="ei_qty" value="${e.qty||0}" placeholder="100"/></div>
        <div class="field"><label>Reorder Level (Qty)</label><input type="number" id="ei_reorder" value="${e.reorderQty||5}" placeholder="10"/></div>
        <div class="field"><label>Cost Price (${EH.sym()})</label><input type="number" id="ei_cost" value="${e.costPrice||0}" placeholder="150"/></div>
        <div class="field"><label>Selling Price (${EH.sym()})</label><input type="number" id="ei_sale" value="${e.salePrice||0}" placeholder="200"/></div>
        <div class="field"><label>HSN Code</label><input id="ei_hsn" value="${e.hsn||''}" placeholder="7214"/></div>
        <div class="field"><label>Location / Rack</label><input id="ei_loc" value="${e.location||''}" placeholder="Warehouse A, Rack 3"/></div>
        <div class="field form-full"><label>Description</label><textarea id="ei_desc" rows="2">${e.description||''}</textarea></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="ERP.saveItem('${id||''}')">💾 Save Item</button>
    `);
  },

  editItem(id) { this.openAddItem(id); },

  saveItem(id) {
    const name = document.getElementById('ei_name')?.value.trim();
    if (!name) { EH.toast('Enter item name','warning'); return; }
    const item = {
      code: document.getElementById('ei_code')?.value, name,
      category: document.getElementById('ei_cat')?.value,
      unit: document.getElementById('ei_unit')?.value,
      qty: +document.getElementById('ei_qty')?.value||0,
      reorderQty: +document.getElementById('ei_reorder')?.value||5,
      costPrice: +document.getElementById('ei_cost')?.value||0,
      salePrice: +document.getElementById('ei_sale')?.value||0,
      hsn: document.getElementById('ei_hsn')?.value,
      location: document.getElementById('ei_loc')?.value,
      description: document.getElementById('ei_desc')?.value,
    };
    if (id) { STRATIX_DB.update('erpInventory', id, item); EH.toast('Item updated!'); }
    else { STRATIX_DB.push('erpInventory', item); EH.toast('Item added to inventory!'); }
    document.getElementById('erpAddItem')?.remove();
    document.getElementById('erp_content').innerHTML = this.renderInventory();
  },

  deleteItem(id) {
    if (true) {
      STRATIX_DB.remove('erpInventory', id);
      document.getElementById('erp_content').innerHTML = this.renderInventory();
    }
  },

  openStockAdjust() {
    const inv = STRATIX_DB.getArr('erpInventory');
    document.getElementById('erpModal').innerHTML = EH.modal('erpAdjust', '🔧 Stock Adjustment', `
      <div class="alert a-gold" style="margin-bottom:14px"><span class="alert-ico">ℹ️</span><div>Use this to correct stock counts after physical verification.</div></div>
      <div class="field"><label>Select Item</label><select id="adj_item">
        ${inv.map(i=>`<option value="${i.id}">${i.name} (Current: ${i.qty||0} ${i.unit||'pcs'})</option>`).join('')}
      </select></div>
      <div class="form-grid" style="margin-top:12px">
        <div class="field"><label>Adjustment Type</label><select id="adj_type"><option value="add">Add Stock (+)</option><option value="remove">Remove Stock (-)</option><option value="set">Set Exact Qty</option></select></div>
        <div class="field"><label>Quantity</label><input type="number" id="adj_qty" placeholder="50"/></div>
        <div class="field form-full"><label>Reason</label><input id="adj_reason" placeholder="Physical count, damaged goods, etc."/></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="ERP.saveAdjust()">Apply Adjustment</button>
    `);
  },

  saveAdjust() {
    const id = document.getElementById('adj_item')?.value;
    const type = document.getElementById('adj_type')?.value;
    const qty = +document.getElementById('adj_qty')?.value||0;
    const reason = document.getElementById('adj_reason')?.value;
    const inv = STRATIX_DB.getArr('erpInventory');
    const item = inv.find(i=>i.id===id);
    if (!item) return;
    let newQty = item.qty||0;
    if (type==='add') newQty += qty;
    else if (type==='remove') newQty = Math.max(0, newQty - qty);
    else newQty = qty;
    STRATIX_DB.update('erpInventory', id, { qty: newQty });
    STRATIX_DB.push('erpStockLog', { itemId:id, itemName:item.name, type, qty, newQty, reason, date:EH.today() });
    EH.toast(`Stock adjusted — ${item.name}: ${item.qty||0} → ${newQty}`);
    document.getElementById('erpAdjust')?.remove();
    document.getElementById('erp_content').innerHTML = this.renderInventory();
  },

  /* ── SALES ORDERS ── */
  renderSales() {
    const orders = STRATIX_DB.getArr('erpSalesOrders');
    const sym = EH.sym();
    const totalValue = orders.reduce((s,o)=>s+(o.totalAmt||0),0);
    const pending = orders.filter(o=>o.status==='Confirmed'||o.status==='In Progress').reduce((s,o)=>s+(o.totalAmt||0),0);
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
        <div class="kpi accent"><div class="kpi-lbl">Total Orders</div><div class="kpi-val">${orders.length}</div></div>
        <div class="kpi"><div class="kpi-lbl">Total Value</div><div class="kpi-val">${sym}${EH.fmt(totalValue)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Pending Value</div><div class="kpi-val gold">${sym}${EH.fmt(pending)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Completed</div><div class="kpi-val green">${orders.filter(o=>o.status==='Completed').length}</div></div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Sales Orders</span>
          <button class="btn btn-gold btn-sm" onclick="ERP.openSaleOrder()">+ New Sales Order</button>
        </div>
        <div class="tbl-scroll"><table>
          <thead><tr><th>SO Number</th><th>Customer</th><th>Date</th><th>Delivery Date</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${orders.length===0
            ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">No sales orders yet.</td></tr>`
            : orders.slice().reverse().map(o=>`<tr>
                <td class="td-b">${o.soNo}</td>
                <td>${o.customer}</td>
                <td class="td-m">${EH.dateStr(o.date)}</td>
                <td class="${new Date(o.deliveryDate)<new Date()&&o.status!=='Completed'?'td-r':''}">${EH.dateStr(o.deliveryDate)}</td>
                <td class="td-m">${o.items?.length||0} item(s)</td>
                <td class="td-gold">${sym}${EH.fmt(o.totalAmt||0)}</td>
                <td>${EH.badge(o.status||'Draft',EH.statusColor(o.status||'Draft'))}</td>
                <td style="display:flex;gap:5px">
                  <button class="btn btn-ghost btn-sm" onclick="ERP.viewSO('${o.id}')">👁 View</button>
                  <button class="btn btn-green btn-sm" onclick="ERP.advanceSO('${o.id}')">→</button>
                  <button class="btn btn-red btn-sm" onclick="ERP.deleteSO('${o.id}')">🗑</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
      <div id="erpModal"></div>`;
  },

  openSaleOrder() {
    const inv = STRATIX_DB.getArr('erpInventory');
    document.getElementById('erpModal').innerHTML = EH.modal('soModal','➕ New Sales Order',`
      <div class="form-grid">
        <div class="field"><label>SO Number</label><input id="so_no" value="SO-${Date.now().toString().slice(-6)}"/></div>
        <div class="field"><label>Date</label><input type="date" id="so_date" value="${EH.today()}"/></div>
        <div class="field"><label>Customer Name *</label><input id="so_cust" placeholder="Customer company"/></div>
        <div class="field"><label>Customer Phone</label><input id="so_ph" placeholder="+91 9876543210"/></div>
        <div class="field"><label>Delivery Date</label><input type="date" id="so_del" value="${new Date(Date.now()+7*86400000).toISOString().split('T')[0]}"/></div>
        <div class="field"><label>Payment Terms</label><select id="so_pay"><option>Advance 100%</option><option>30 Days Credit</option><option>60 Days Credit</option><option>On Delivery</option><option>Custom</option></select></div>
        <div class="field"><label>GST Rate (%)</label><select id="so_gst" onchange="ERP._renderSOLines()"><option value="0">0% (Exempt)</option><option value="5">5%</option><option value="12">12%</option><option value="18" selected>18%</option><option value="28">28%</option></select></div>
      </div>
      <div style="font-weight:700;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px">Order Items</div>
      <div id="soItems">
        <div class="form-grid" style="align-items:end;margin-bottom:8px">
          <div class="field"><label>Item</label><select id="so_item">
            <option value="">-- Select Item --</option>
            ${inv.map(i=>`<option value="${i.id}" data-price="${i.salePrice||0}" data-name="${i.name}" data-unit="${i.unit||'pcs'}">${i.name} (Avail: ${i.qty||0} ${i.unit||'pcs'})</option>`).join('')}
            <option value="custom">+ Custom Item</option>
          </select></div>
          <div class="field"><label>Qty</label><input type="number" id="so_qty" placeholder="10" min="1"/></div>
          <div class="field"><label>Rate (${EH.sym()})</label><input type="number" id="so_rate" placeholder="Auto-fills"/></div>
          <div><button class="btn btn-ghost btn-sm" onclick="ERP.addSOLine()" style="width:100%;margin-top:21px">+ Add Line</button></div>
        </div>
      </div>
      <div id="soLineItems" style="margin-bottom:12px"></div>
      <div id="soTotals" class="inv-totals"></div>
      <div class="field mt12"><label>Notes / Special Instructions</label><textarea id="so_notes" rows="2" placeholder="Delivery instructions, special requirements..."></textarea></div>
      <button class="btn btn-gold btn-full mt12" onclick="ERP.saveSO()">💾 Create Sales Order</button>
    `, true);
    this._soLines = [];
    document.getElementById('so_item').addEventListener('change', function(){
      const opt = this.options[this.selectedIndex];
      document.getElementById('so_rate').value = opt.dataset.price||'';
    });
  },

  _soLines: [],
  addSOLine() {
    const sel = document.getElementById('so_item');
    const itemId = sel?.value;
    const qty = +document.getElementById('so_qty')?.value||0;
    const rate = +document.getElementById('so_rate')?.value||0;
    if (!itemId || !qty) { EH.toast('Select item and quantity','warning'); return; }
    let name = itemId==='custom' ? (document.getElementById('customItemName')?.value?.trim() || 'Custom Item') : sel.options[sel.selectedIndex].dataset.name;
    const unit = itemId==='custom' ? 'pcs' : sel.options[sel.selectedIndex].dataset.unit||'pcs';
    this._soLines.push({ itemId, name, qty, rate, unit, amount: qty*rate });
    this._renderSOLines();
  },
  _renderSOLines() {
    const sym = EH.sym();
    const subtotal = this._soLines.reduce((s,l)=>s+l.amount,0);
    const gstRate = +(document.getElementById('so_gst')?.value||18);
    const gst = subtotal * (gstRate/100);
    document.getElementById('soLineItems').innerHTML = this._soLines.map((l,i)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:7px 10px;background:var(--s2);border-radius:8px;margin-bottom:6px;font-size:13px">
        <span style="flex:1">${l.name}</span>
        <span class="td-m">${l.qty} ${l.unit}</span>
        <span>${sym}${EH.fmt(l.rate)}</span>
        <span class="td-gold fw-700">${sym}${EH.fmt(l.amount)}</span>
        <button class="del-btn" onclick="ERP._soLines.splice(${i},1);ERP._renderSOLines()">✕</button>
      </div>`).join('') || '<p style="color:var(--muted);font-size:13px;padding:8px">No items added yet</p>';
    document.getElementById('soTotals').innerHTML = `
      <div class="inv-row"><span>Subtotal</span><span>${sym}${EH.fmt(subtotal)}</span></div>
      <div class="inv-row"><span>GST @${gstRate}%</span><span>${sym}${EH.fmt(gst)}</span></div>
      <div class="inv-row total"><span>Total Amount</span><span style="color:var(--gold)">${sym}${EH.fmt(subtotal+gst)}</span></div>`;
  },
  saveSO() {
    const cust = document.getElementById('so_cust')?.value.trim();
    if (!cust) { EH.toast('Enter customer name','warning'); return; }
    if (this._soLines.length === 0) { EH.toast('Add at least one item','warning'); return; }
    const subtotal = this._soLines.reduce((s,l)=>s+l.amount,0);
    const gstRate = +(document.getElementById('so_gst')?.value||18);
    const gst = subtotal * (gstRate/100);
    STRATIX_DB.push('erpSalesOrders', {
      soNo: document.getElementById('so_no')?.value,
      customer: cust,
      phone: document.getElementById('so_ph')?.value,
      date: document.getElementById('so_date')?.value,
      deliveryDate: document.getElementById('so_del')?.value,
      payTerms: document.getElementById('so_pay')?.value,
      items: [...this._soLines],
      gstRate, subtotal, gst, totalAmt: subtotal+gst,
      notes: document.getElementById('so_notes')?.value,
      status: 'Confirmed',
    });
    // Deduct from inventory
    this._soLines.forEach(l=>{
      if (l.itemId && l.itemId!=='custom') {
        const inv = STRATIX_DB.getArr('erpInventory');
        const item = inv.find(i=>i.id===l.itemId);
        if (item) STRATIX_DB.update('erpInventory',item.id,{qty:Math.max(0,(item.qty||0)-l.qty)});
      }
    });
    document.getElementById('soModal')?.remove();
    EH.toast('Sales Order created! Inventory updated.');
    document.getElementById('erp_content').innerHTML = this.renderSales();
  },
  viewSO(id) {
    const o = STRATIX_DB.getArr('erpSalesOrders').find(o=>o.id===id);
    if (!o) return;
    const sym = EH.sym();
    const s = STRATIX_DB.getSettings();
    document.getElementById('erpModal').innerHTML = EH.modal('soView',`Sales Order — ${o.soNo}`, `
      <div style="background:white;color:#111;padding:24px;border-radius:10px">
        <div style="display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px">
          <div><div style="font-size:18px;font-weight:800">${s.businessName||'Your Company'}</div>
            <div style="font-size:11px;color:#555">${s.address||''} | GST: ${s.gstNumber||'N/A'}</div></div>
          <div style="text-align:right"><div style="font-size:16px;font-weight:700">SALES ORDER</div>
            <div style="font-size:11px;color:#555">SO No: <b>${o.soNo}</b> | Date: ${EH.dateStr(o.date)}</div>
            <div style="font-size:11px;color:#555">Delivery: ${EH.dateStr(o.deliveryDate)}</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:14px;font-size:12px">
          <div><b>Customer:</b> ${o.customer}</div>
          <div><b>Phone:</b> ${o.phone||'—'}</div>
          <div><b>Payment Terms:</b> ${o.payTerms||'—'}</div>
          <div><b>Status:</b> ${o.status}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead><tr style="background:#f0f0f0">${['#','Item','Qty','Unit','Rate','Amount'].map(h=>`<th style="padding:7px 8px;border:1px solid #ccc;text-align:left">${h}</th>`).join('')}</tr></thead>
          <tbody>${o.items?.map((l,i)=>`<tr>${[i+1,l.name,l.qty,l.unit,sym+EH.fmt(l.rate),sym+EH.fmt(l.amount)].map(c=>`<td style="padding:6px 8px;border:1px solid #ddd">${c}</td>`).join('')}</tr>`).join('')||''}</tbody>
        </table>
        <div style="display:flex;justify-content:flex-end;margin-top:10px;font-size:13px">
          <div><div style="display:flex;justify-content:space-between;gap:40px"><span>Subtotal</span><span>${sym}${EH.fmt(o.subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:40px"><span>GST @18%</span><span>${sym}${EH.fmt(o.gst)}</span></div>
          <div style="display:flex;justify-content:space-between;gap:40px;font-weight:800;font-size:15px;margin-top:6px;border-top:2px solid #111;padding-top:6px"><span>TOTAL</span><span>${sym}${EH.fmt(o.totalAmt)}</span></div></div>
        </div>
        ${o.notes?`<div style="background:#fffde7;border:1px solid #f0c040;border-radius:6px;padding:8px 12px;font-size:11px;margin-top:10px">Notes: ${o.notes}</div>`:''}
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="ERP._printSO(this)">🖨️ Print / Save PDF</button>
    `, true);
  },
  _printSO(btn) {
    // Find SO content from modal
    const modal = document.getElementById('soView');
    if (!modal) { NOTIFY.show('No Sales Order to print', 'warning'); return; }
    const contentEl = modal.querySelector('.modal-body > div');
    if (!contentEl) { NOTIFY.show('Cannot find SO content', 'warning'); return; }
    // Strip buttons from content
    const tmpDiv = document.createElement('div');
    tmpDiv.innerHTML = contentEl.innerHTML;
    tmpDiv.querySelectorAll('button, .btn').forEach(b => b.remove());
    const content = tmpDiv.innerHTML;

    const cfg = STRATIX_DB.getSettings();
    const biz = cfg.businessName || 'My Company';
    const win = window.open('', '_blank', 'width=860,height=820');
    if (!win) { NOTIFY.show('Popup blocked! Allow popups to print.', 'warning', 5000); return; }

    const css = [
      '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }',
      '* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }',
      '@media print { body { padding: 0 !important; background: #fff !important; } .no-print { display: none !important; } .so-wrap { box-shadow: none !important; border-radius: 0 !important; } }',
      'body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 24px 16px; color: #1a1a2e; }',
      '.so-wrap { background: #fff; max-width: 800px; margin: 0 auto; border-radius: 14px; box-shadow: 0 8px 40px rgba(0,0,0,.12); overflow: hidden; }',
      '.so-hdr { background: linear-gradient(135deg,#111827,#1e293b); padding: 24px 36px; display: flex; justify-content: space-between; align-items: flex-start; }',
      '.so-co { font-size: 18px; font-weight: 800; color: #fff; margin-bottom: 4px; }',
      '.so-co-meta { font-size: 11px; color: rgba(255,255,255,.6); line-height: 1.7; }',
      '.so-logo { width: 42px; height: 42px; background: linear-gradient(135deg,#2563EB,#1D4ED8); border-radius: 11px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; color: #111; }',
      '.so-bar { background: #2563EB; padding: 10px 36px; display: flex; justify-content: space-between; align-items: center; }',
      '.so-bar-title { font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111; }',
      '.so-body { padding: 24px 36px; }',
      'table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }',
      'thead th { background: #1a1a2e; color: #fff; padding: 10px 14px; font-size: 12px; font-weight: 700; text-align: left; }',
      'thead th:last-child { text-align: right; }',
      'tbody td { padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f0ede0; color: #333; }',
      'tbody tr:nth-child(even) td { background: #fafaf7; }',
      '.so-total-row { display: flex; justify-content: space-between; padding: 7px 14px; font-size: 13px; color: #444; border-bottom: 1px solid #f0ede0; }',
      '.so-grand { display: flex; justify-content: space-between; padding: 12px 14px; margin: 8px 0 20px; background: linear-gradient(135deg,#fdf3e0,#fff8ed); border: 1px solid #2563EB; border-radius: 10px; font-weight: 800; font-size: 16px; color: #1a1a2e; }',
      '.badge, .status-badge, .risk-badge, .priority-badge { display: inline-flex; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 700; background: #f5f5f5; color: #333; }',
      '.so-ftr { display: flex; justify-content: space-between; padding: 12px 36px; border-top: 1px solid #eee; background: #f9f9f9; font-size: 10px; color: #aaa; }',
      '.so-print-btn { display: block; margin: 20px auto; padding: 11px 36px; background: linear-gradient(135deg,#2563EB,#1D4ED8); border: none; border-radius: 9px; font-weight: 800; font-size: 14px; cursor: pointer; color: #111; font-family: Arial, sans-serif; }',
    ].join(' ');

    win.document.write(
      '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><title>' + escapeHTML(biz) + ' — Sales Order</title>' +
      '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet"/>' +
      '<style>' + css + '</style></head><body>' +
      '<div class="so-wrap">' +
        '<div class="so-hdr">' +
          '<div><div class="so-co">' + escapeHTML(biz) + '</div>' +
          '<div class="so-co-meta">' + (cfg.address ? escapeHTML(cfg.address) + '<br/>' : '') + (cfg.gstNumber ? 'GSTIN: ' + escapeHTML(cfg.gstNumber) : '') + '</div></div>' +
          '<div class="so-logo">SX</div>' +
        '</div>' +
        '<div class="so-bar"><div class="so-bar-title">Sales Order</div><div style="font-size:13px;font-weight:700;color:#111">' + new Date().toLocaleDateString('en-IN') + '</div></div>' +
        '<div class="so-body">' + content + '</div>' +
        '<div class="so-ftr"><div>Generated by <strong style="color:#2563EB">STRATIX</strong></div><div>' + escapeHTML(biz) + '</div></div>' +
      '</div>' +
      '<button class="so-print-btn no-print" onclick="window.print()">&#128424;&#65039; Print / Save as PDF</button>' +
      '</body></html>'
    );
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  },

  advanceSO(id) {
    const stages = ['Draft','Confirmed','In Progress','Dispatched','Completed'];
    const o = STRATIX_DB.getArr('erpSalesOrders').find(o=>o.id===id);
    if (!o) return;
    const i = stages.indexOf(o.status||'Draft');
    if (i < stages.length-1) {
      STRATIX_DB.update('erpSalesOrders',id,{status:stages[i+1]});
      EH.toast(`Order moved to: ${stages[i+1]}`);
      document.getElementById('erp_content').innerHTML = this.renderSales();
    }
  },
  deleteSO(id) {
    NOTIFY.show('Sales order deleted','success'); STRATIX_DB.remove('erpSalesOrders',id); document.getElementById('erp_content').innerHTML=this.renderSales();
  },

  /* ── PURCHASE ORDERS ── */
  renderPurchase() {
    const pos = STRATIX_DB.getArr('erpPurchaseOrders');
    const sym = EH.sym();
    return `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Purchase Orders — ${pos.length} total</span>
          <button class="btn btn-gold btn-sm" onclick="ERP.openPO()">+ New Purchase Order</button>
        </div>
        <div class="tbl-scroll"><table>
          <thead><tr><th>PO Number</th><th>Supplier</th><th>Date</th><th>Expected Delivery</th><th>Items</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${pos.length===0
            ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">No purchase orders yet.</td></tr>`
            : pos.slice().reverse().map(p=>`<tr>
                <td class="td-b">${p.poNo}</td><td>${p.supplier}</td>
                <td class="td-m">${EH.dateStr(p.date)}</td>
                <td class="${new Date(p.expectedDate)<new Date()&&p.status!=='Received'?'td-r':''}">${EH.dateStr(p.expectedDate)}</td>
                <td class="td-m">${p.items?.length||0} item(s)</td>
                <td class="td-gold">${sym}${EH.fmt(p.totalAmt||0)}</td>
                <td>${EH.badge(p.status||'Draft',EH.statusColor(p.status||'Draft'))}</td>
                <td style="display:flex;gap:5px">
                  <button class="btn btn-green btn-sm" onclick="ERP.receivePO('${p.id}')" ${p.status==='Received'?'disabled':''}>✅ Receive</button>
                  <button class="btn btn-red btn-sm" onclick="ERP.deletePO('${p.id}')">🗑</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
      <div id="erpModal"></div>`;
  },
  openPO() {
    const vendors = STRATIX_DB.getArr('scmVendors');
    const inv = STRATIX_DB.getArr('erpInventory');
    document.getElementById('erpModal').innerHTML = EH.modal('poModal','🏪 New Purchase Order',`
      <div class="form-grid">
        <div class="field"><label>PO Number</label><input id="po_no" value="PO-${Date.now().toString().slice(-6)}"/></div>
        <div class="field"><label>Date</label><input type="date" id="po_date" value="${EH.today()}"/></div>
        <div class="field"><label>Supplier *</label>
          ${vendors.length>0
            ? `<select id="po_sup">${vendors.map(v=>`<option>${escapeHTML(v.name)}</option>`).join('')}</select>`
            : `<input id="po_sup" placeholder="Supplier name"/>`}
        </div>
        <div class="field"><label>Expected Delivery</label><input type="date" id="po_exp" value="${new Date(Date.now()+7*86400000).toISOString().split('T')[0]}"/></div>
      </div>
      <div style="font-weight:700;font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin:14px 0 8px">Items to Order</div>
      <div class="form-grid" style="align-items:end;margin-bottom:8px">
        <div class="field"><label>Item</label><select id="po_item">
          <option value="custom">Custom / New Item</option>
          ${inv.map(i=>`<option value="${i.id}">${i.name} (Stock: ${i.qty||0})</option>`).join('')}
        </select></div>
        <div class="field"><label>Qty to Order</label><input type="number" id="po_qty" placeholder="100"/></div>
        <div class="field"><label>Rate (${EH.sym()})</label><input type="number" id="po_rate" placeholder="150"/></div>
        <div><button class="btn btn-ghost btn-sm" onclick="ERP.addPOLine()" style="width:100%;margin-top:21px">+ Add</button></div>
      </div>
      <div id="poLineItems"></div>
      <div id="poTotals" class="inv-totals"></div>
      <div class="field mt12"><label>Notes</label><textarea id="po_notes" rows="2" placeholder="Delivery instructions..."></textarea></div>
      <button class="btn btn-gold btn-full mt12" onclick="ERP.savePO()">💾 Create Purchase Order</button>
    `, true);
    this._poLines = [];
  },
  _poLines: [],
  addPOLine() {
    const sel = document.getElementById('po_item');
    const qty = +document.getElementById('po_qty')?.value||0;
    const rate = +document.getElementById('po_rate')?.value||0;
    if (!qty) { EH.toast('Enter quantity','warning'); return; }
    const name = sel.value==='custom' ? (document.getElementById('customPOItem')?.value?.trim() || 'Item') : sel.options[sel.selectedIndex].text.split(' (')[0];
    this._poLines.push({ itemId: sel.value, name, qty, rate, amount: qty*rate });
    this._renderPOLines();
  },
  _renderPOLines() {
    const sym = EH.sym();
    const subtotal = this._poLines.reduce((s,l)=>s+l.amount,0);
    document.getElementById('poLineItems').innerHTML = this._poLines.map((l,i)=>`
      <div style="display:flex;gap:10px;align-items:center;padding:7px 10px;background:var(--s2);border-radius:8px;margin-bottom:6px;font-size:13px">
        <span style="flex:1">${l.name}</span><span class="td-m">${l.qty}</span>
        <span>${sym}${EH.fmt(l.rate)}</span><span class="td-gold fw-700">${sym}${EH.fmt(l.amount)}</span>
        <button class="del-btn" onclick="ERP._poLines.splice(${i},1);ERP._renderPOLines()">✕</button>
      </div>`).join('');
    document.getElementById('poTotals').innerHTML = `
      <div class="inv-row"><span>Subtotal</span><span>${sym}${EH.fmt(subtotal)}</span></div>
      <div class="inv-row total"><span>Total Amount</span><span style="color:var(--gold)">${sym}${EH.fmt(subtotal)}</span></div>`;
  },
  savePO() {
    const sup = document.getElementById('po_sup')?.value.trim();
    if (!sup) { EH.toast('Enter supplier','warning'); return; }
    if (this._poLines.length===0) { EH.toast('Add at least one item','warning'); return; }
    STRATIX_DB.push('erpPurchaseOrders', {
      poNo: document.getElementById('po_no')?.value,
      supplier: sup, date: document.getElementById('po_date')?.value,
      expectedDate: document.getElementById('po_exp')?.value,
      items: [...this._poLines],
      totalAmt: this._poLines.reduce((s,l)=>s+l.amount,0),
      notes: document.getElementById('po_notes')?.value,
      status: 'Confirmed',
    });
    document.getElementById('poModal')?.remove();
    EH.toast('Purchase Order created!');
    document.getElementById('erp_content').innerHTML = this.renderPurchase();
  },
  receivePO(id) {
    const po = STRATIX_DB.getArr('erpPurchaseOrders').find(p=>p.id===id);
    if (!po) return;
    /* proceed */
    po.items?.forEach(l=>{
      if (l.itemId && l.itemId!=='custom') {
        const inv = STRATIX_DB.getArr('erpInventory');
        const item = inv.find(i=>i.id===l.itemId);
        if (item) STRATIX_DB.update('erpInventory',item.id,{qty:(item.qty||0)+l.qty});
        else STRATIX_DB.push('erpInventory',{name:l.name,qty:l.qty,costPrice:l.rate,unit:'pcs'});
      } else {
        STRATIX_DB.push('erpInventory',{name:l.name,qty:l.qty,costPrice:l.rate,unit:'pcs'});
      }
    });
    STRATIX_DB.update('erpPurchaseOrders',id,{status:'Received',receivedDate:EH.today()});
    STRATIX_DB.push('transactions',{type:'expense',amount:po.totalAmt,category:'purchase',description:`PO ${po.poNo} — ${po.supplier}`,date:EH.today()});
    EH.toast('PO Received! Inventory updated & expense recorded.');
    document.getElementById('erp_content').innerHTML = this.renderPurchase();
  },
  deletePO(id) {
    NOTIFY.show('Purchase order deleted','success'); STRATIX_DB.remove('erpPurchaseOrders',id); document.getElementById('erp_content').innerHTML=this.renderPurchase();
  },

  /* ── JOBS / PRODUCTION ── */
  renderJobs() {
    const jobs = STRATIX_DB.getArr('erpJobs');
    const sym = EH.sym();
    const stages = ['Planned','In Progress','QC Check','Completed','On Hold'];
    return `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Production / Job Work Orders</span>
          <button class="btn btn-gold btn-sm" onclick="ERP.openJob()">+ New Job Order</button>
        </div>
        <div class="tbl-scroll"><table>
          <thead><tr><th>Job No</th><th>Product</th><th>Customer</th><th>Qty</th><th>Start</th><th>Due Date</th><th>Assigned To</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${jobs.length===0
            ? `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">No job orders yet.</td></tr>`
            : jobs.slice().reverse().map(j=>`<tr>
                <td class="td-b">${j.jobNo}</td><td>${j.product}</td><td class="td-m">${j.customer||'—'}</td>
                <td>${j.qty||1}</td><td class="td-m">${EH.dateStr(j.startDate)}</td>
                <td class="${new Date(j.dueDate)<new Date()&&j.status!=='Completed'?'td-r':''}">${EH.dateStr(j.dueDate)}</td>
                <td class="td-m">${j.assignedTo||'—'}</td>
                <td>${EH.badge(j.status||'Planned',EH.statusColor(j.status||'Planned'))}</td>
                <td style="display:flex;gap:5px">
                  <button class="btn btn-ghost btn-sm" onclick="ERP.advanceJob('${j.id}')">→ Next</button>
                  <button class="btn btn-red btn-sm" onclick="ERP.deleteJob('${j.id}')">🗑</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
      <div id="erpModal"></div>`;
  },
  openJob() {
    const emps = STRATIX_DB.getArr('employees');
    document.getElementById('erpModal').innerHTML = EH.modal('jobModal','🏭 New Job / Production Order',`
      <div class="form-grid">
        <div class="field"><label>Job Number</label><input id="jb_no" value="JOB-${Date.now().toString().slice(-5)}"/></div>
        <div class="field"><label>Product / Work Description *</label><input id="jb_prod" placeholder="e.g. MS Fabrication 5mm plate"/></div>
        <div class="field"><label>Customer / For</label><input id="jb_cust" placeholder="Internal or customer name"/></div>
        <div class="field"><label>Quantity</label><input type="number" id="jb_qty" placeholder="50"/></div>
        <div class="field"><label>Start Date</label><input type="date" id="jb_start" value="${EH.today()}"/></div>
        <div class="field"><label>Due Date</label><input type="date" id="jb_due" value="${new Date(Date.now()+7*86400000).toISOString().split('T')[0]}"/></div>
        <div class="field"><label>Assigned To</label>
          ${emps.length>0
            ? `<select id="jb_assign"><option value="">Unassigned</option>${emps.map(e=>`<option>${e.name}</option>`).join('')}</select>`
            : `<input id="jb_assign" placeholder="Worker / Team name"/>`}
        </div>
        <div class="field"><label>Priority</label><select id="jb_pri"><option>Normal</option><option>High</option><option>Urgent</option><option>Low</option></select></div>
        <div class="field form-full"><label>Materials Required</label><textarea id="jb_mat" rows="2" placeholder="Steel 5mm - 20kg, Electrodes - 2 packs, etc."></textarea></div>
        <div class="field form-full"><label>Work Instructions</label><textarea id="jb_inst" rows="2" placeholder="Detailed work instructions..."></textarea></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="ERP.saveJob()">💾 Create Job Order</button>
    `, true);
  },
  saveJob() {
    const prod = document.getElementById('jb_prod')?.value.trim();
    if (!prod) { EH.toast('Enter product/work description','warning'); return; }
    STRATIX_DB.push('erpJobs',{
      jobNo: document.getElementById('jb_no')?.value,
      product: prod, customer: document.getElementById('jb_cust')?.value,
      qty: +document.getElementById('jb_qty')?.value||1,
      startDate: document.getElementById('jb_start')?.value,
      dueDate: document.getElementById('jb_due')?.value,
      assignedTo: document.getElementById('jb_assign')?.value,
      priority: document.getElementById('jb_pri')?.value,
      materials: document.getElementById('jb_mat')?.value,
      instructions: document.getElementById('jb_inst')?.value,
      status: 'Planned',
    });
    document.getElementById('jobModal')?.remove();
    EH.toast('Job order created!');
    document.getElementById('erp_content').innerHTML = this.renderJobs();
  },
  advanceJob(id) {
    const stages=['Planned','In Progress','QC Check','Completed'];
    const j = STRATIX_DB.getArr('erpJobs').find(j=>j.id===id);
    if (!j) return;
    const i = stages.indexOf(j.status||'Planned');
    if (i < stages.length-1) {
      STRATIX_DB.update('erpJobs',id,{status:stages[i+1]});
      EH.toast(`Job moved to: ${stages[i+1]}`);
      document.getElementById('erp_content').innerHTML = this.renderJobs();
    }
  },
  deleteJob(id) {
    NOTIFY.show('Job deleted','success'); STRATIX_DB.remove('erpJobs',id); document.getElementById('erp_content').innerHTML=this.renderJobs();
  },

  /* ── FINANCIAL LEDGER ── */
  renderLedger() {
    const sym = EH.sym();
    const txns = STRATIX_DB.getArr('transactions');
    const soIncome = STRATIX_DB.getArr('erpSalesOrders').filter(o=>o.status==='Completed').reduce((s,o)=>s+(o.totalAmt||0),0);
    const poExpense = STRATIX_DB.getArr('erpPurchaseOrders').filter(p=>p.status==='Received').reduce((s,p)=>s+(p.totalAmt||0),0);
    const salaryExp = STRATIX_DB.getArr('payslips').reduce((s,p)=>s+(p.totalNet||0),0);
    const totalRevenue = txns.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
    const totalExpense = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const arTotal = STRATIX_DB.getArr('erpSalesOrders').filter(o=>o.status!=='Completed'&&o.status!=='Cancelled').reduce((s,o)=>s+(o.totalAmt||0),0);
    const apTotal = STRATIX_DB.getArr('erpPurchaseOrders').filter(p=>p.status==='Confirmed').reduce((s,p)=>s+(p.totalAmt||0),0);
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px">
        <div class="kpi accent"><div class="kpi-lbl">Total Revenue</div><div class="kpi-val green">${sym}${EH.fmt(totalRevenue)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Total Expense</div><div class="kpi-val red">${sym}${EH.fmt(totalExpense)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Accounts Receivable</div><div class="kpi-val gold">${sym}${EH.fmt(arTotal)}</div></div>
        <div class="kpi"><div class="kpi-lbl">Accounts Payable</div><div class="kpi-val orange">${sym}${EH.fmt(apTotal)}</div></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
        <div class="tbl-wrap">
          <div class="tbl-head"><span class="tbl-title">Accounts Receivable (Sales Due)</span></div>
          <div class="tbl-scroll"><table>
            <thead><tr><th>SO No</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>${STRATIX_DB.getArr('erpSalesOrders').filter(o=>o.status!=='Completed'&&o.status!=='Cancelled').map(o=>`<tr>
              <td class="td-b">${o.soNo}</td><td>${o.customer}</td>
              <td class="td-gold">${sym}${EH.fmt(o.totalAmt||0)}</td>
              <td>${EH.badge(o.status,EH.statusColor(o.status))}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted)">No pending receivables</td></tr>`}
            </tbody>
          </table></div>
        </div>
        <div class="tbl-wrap">
          <div class="tbl-head"><span class="tbl-title">Accounts Payable (Purchase Due)</span></div>
          <div class="tbl-scroll"><table>
            <thead><tr><th>PO No</th><th>Supplier</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>${STRATIX_DB.getArr('erpPurchaseOrders').filter(p=>p.status==='Confirmed').map(p=>`<tr>
              <td class="td-b">${p.poNo}</td><td>${p.supplier}</td>
              <td class="td-red">${sym}${EH.fmt(p.totalAmt||0)}</td>
              <td>${EH.badge(p.status,EH.statusColor(p.status))}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted)">No pending payables</td></tr>`}
            </tbody>
          </table></div>
        </div>
      </div>`;
  },
};


/* ════════════════════════════════════════════════════════════════
   MODULE 2 — CRM
   ════════════════════════════════════════════════════════════════ */

function renderCRM() {
  const sym = EH.sym();
  const leads = STRATIX_DB.getArr('crmLeads');
  const contacts = STRATIX_DB.getArr('crmContacts');
  const deals = STRATIX_DB.getArr('crmDeals');
  const totalDealValue = deals.filter(d=>d.status!=='Lost').reduce((s,d)=>s+(d.value||0),0);
  const wonDeals = deals.filter(d=>d.status==='Won').reduce((s,d)=>s+(d.value||0),0);

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div><h1 class="sec-title">CRM — Customer Relationship Management</h1>
          <p class="sec-sub">Leads · Contacts · Deal Pipeline · Follow-ups · Activity Log</p>
        </div>
        <span class="owner-tag">👑 All Unlocked</span>
      </div>
      <div class="owner-banner">
        <span class="ob-ico">🤝</span>
        <div><div class="ob-txt">Full CRM — Track every customer from lead to repeat business</div>
          <div class="ob-sub">Lead management, contacts directory, deal pipeline, follow-up reminders, activity log</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi accent"><div class="kpi-lbl">Total Leads</div><div class="kpi-val">${leads.length}</div><div class="kpi-ico">🎯</div></div>
        <div class="kpi"><div class="kpi-lbl">Contacts</div><div class="kpi-val blue">${contacts.length}</div><div class="kpi-ico">👥</div></div>
        <div class="kpi"><div class="kpi-lbl">Pipeline Value</div><div class="kpi-val gold">${sym}${EH.fmt(totalDealValue)}</div><div class="kpi-ico">💰</div></div>
        <div class="kpi"><div class="kpi-lbl">Won Revenue</div><div class="kpi-val green">${sym}${EH.fmt(wonDeals)}</div><div class="kpi-ico">🏆</div></div>
      </div>

      <div class="calc-tabs" style="margin-bottom:20px">
        <button class="ctab active" id="crm_tab_leads" onclick="CRM.tab('leads')">🎯 Leads</button>
        <button class="ctab" id="crm_tab_contacts" onclick="CRM.tab('contacts')">👥 Contacts</button>
        <button class="ctab" id="crm_tab_pipeline" onclick="CRM.tab('pipeline')">💼 Deal Pipeline</button>
        <button class="ctab" id="crm_tab_followup" onclick="CRM.tab('followup')">🔔 Follow-ups</button>
        <button class="ctab" id="crm_tab_activity" onclick="CRM.tab('activity')">📋 Activity Log</button>
      </div>
      <div id="crm_content">${CRM.renderLeads()}</div>
    </div>`;
}

const CRM = {
  tab(name) {
    document.querySelectorAll('[id^="crm_tab_"]').forEach(b=>b.classList.remove('active'));
    document.getElementById('crm_tab_'+name)?.classList.add('active');
    const renders = {leads:this.renderLeads,contacts:this.renderContacts,pipeline:this.renderPipeline,followup:this.renderFollowup,activity:this.renderActivity};
    document.getElementById('crm_content').innerHTML = (renders[name]||this.renderLeads).call(this);
  },

  /* ── LEADS ── */
  renderLeads() {
    const leads = STRATIX_DB.getArr('crmLeads');
    const sym = EH.sym();
    const hot = leads.filter(l=>l.temperature==='Hot').length;
    const warm = leads.filter(l=>l.temperature==='Warm').length;
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">
        <div class="kpi"><div class="kpi-lbl">Total</div><div class="kpi-val">${leads.length}</div></div>
        <div class="kpi"><div class="kpi-lbl" style="color:var(--red)">🔥 Hot</div><div class="kpi-val red">${hot}</div></div>
        <div class="kpi"><div class="kpi-lbl" style="color:var(--orange)">🟡 Warm</div><div class="kpi-val orange">${warm}</div></div>
        <div class="kpi"><div class="kpi-lbl">❄️ Cold</div><div class="kpi-val muted">${leads.filter(l=>l.temperature==='Cold').length}</div></div>
      </div>
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Lead Register</span>
          <div style="display:flex;gap:8px">
            <select onchange="CRM.filterLeads(this.value)" style="padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt)">
              <option value="all">All Leads</option>
              <option value="Hot">🔥 Hot</option>
              <option value="Warm">🟡 Warm</option>
              <option value="Cold">❄️ Cold</option>
              <option value="New">🆕 New</option>
              <option value="Qualified">✅ Qualified</option>
            </select>
            <button class="btn btn-gold btn-sm" onclick="CRM.openAddLead()">+ Add Lead</button>
          </div>
        </div>
        <div class="tbl-scroll">
          <table id="leadsTable">
            <thead><tr><th>Lead Name</th><th>Company</th><th>Phone</th><th>Source</th><th>Potential</th><th>Temp</th><th>Stage</th><th>Last Contact</th><th>Actions</th></tr></thead>
            <tbody>${CRM._renderLeadRows(leads)}</tbody>
          </table>
        </div>
      </div>
      <div id="crmModal"></div>`;
  },
  _renderLeadRows(leads) {
    const sym = EH.sym();
    if (leads.length===0) return `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">No leads yet. Click "+ Add Lead" to start tracking.</td></tr>`;
    return leads.slice().reverse().map(l=>`<tr>
      <td class="td-b">${l.name}</td><td>${l.company||'—'}</td>
      <td class="td-m">${l.phone||'—'}</td>
      <td class="td-m">${l.source||'—'}</td>
      <td class="td-gold">${sym}${EH.fmt(l.potential||0)}</td>
      <td>${EH.badge(l.temperature||'Cold',EH.statusColor(l.temperature||'Cold'))}</td>
      <td>${EH.badge(l.stage||'New',EH.statusColor(l.stage||'New'))}</td>
      <td class="td-m">${EH.dateStr(l.lastContact)||'—'}</td>
      <td style="display:flex;gap:5px">
        <button class="btn btn-ghost btn-sm" onclick="CRM.editLead('${l.id}')">✏️</button>
        <button class="btn btn-green btn-sm" onclick="CRM.convertToDeal('${l.id}')">→ Deal</button>
        <button class="btn btn-red btn-sm" onclick="CRM.deleteLead('${l.id}')">🗑</button>
      </td>
    </tr>`).join('');
  },
  filterLeads(temp) {
    const leads = STRATIX_DB.getArr('crmLeads');
    const f = temp==='all' ? leads : leads.filter(l=>l.temperature===temp||l.stage===temp);
    const tbody = document.querySelector('#leadsTable tbody');
    if (tbody) tbody.innerHTML = this._renderLeadRows(f);
  },
  openAddLead(id) {
    const e = id ? STRATIX_DB.getArr('crmLeads').find(l=>l.id===id) : {};
    document.getElementById('crmModal').innerHTML = EH.modal('leadModal',id?'Edit Lead':'➕ Add New Lead',`
      <div class="form-grid">
        <div class="field"><label>Lead Name *</label><input id="ld_name" value="${e.name||''}" placeholder="Person / Company name"/></div>
        <div class="field"><label>Company</label><input id="ld_co" value="${e.company||''}" placeholder="Company name"/></div>
        <div class="field"><label>Phone *</label><input id="ld_ph" value="${e.phone||''}" placeholder="+91 9876543210"/></div>
        <div class="field"><label>Email</label><input type="email" id="ld_em" value="${e.email||''}" placeholder="contact@company.com"/></div>
        <div class="field"><label>Lead Source</label><select id="ld_src">
          ${['WhatsApp','Referral','Play Store','Website','Cold Call','Trade Show','Google Ads','Facebook','Transport Association','CA Referral','Other'].map(s=>`<option ${e.source===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="field"><label>Business Type</label><select id="ld_btype">
          ${['Transport / Logistics','Manufacturing','Trading','Retail','Services','Other'].map(s=>`<option ${e.businessType===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="field"><label>Potential Value (${EH.sym()})</label><input type="number" id="ld_val" value="${e.potential||0}" placeholder="50000"/></div>
        <div class="field"><label>Temperature</label><select id="ld_temp">
          ${['Hot','Warm','Cold'].map(t=>`<option ${e.temperature===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
        <div class="field"><label>Stage</label><select id="ld_stage">
          ${['New','Contacted','Qualified','Demo Given','Proposal Sent','Negotiation','Closed Won','Closed Lost'].map(s=>`<option ${e.stage===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="field"><label>Last Contact Date</label><input type="date" id="ld_lc" value="${e.lastContact||EH.today()}"/></div>
        <div class="field"><label>Next Follow-up</label><input type="date" id="ld_nf" value="${e.nextFollowup||new Date(Date.now()+3*86400000).toISOString().split('T')[0]}"/></div>
        <div class="field"><label>Assigned To</label><input id="ld_assign" value="${e.assignedTo||''}" placeholder="Sales person name"/></div>
        <div class="field form-full"><label>Notes</label><textarea id="ld_notes" rows="3">${e.notes||''}</textarea></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="CRM.saveLead('${id||''}')">💾 Save Lead</button>
    `, true);
  },
  editLead(id) { this.openAddLead(id); },
  saveLead(id) {
    const name = document.getElementById('ld_name')?.value.trim();
    if (!name) { EH.toast('Enter lead name','warning'); return; }
    const lead = {
      name, company:document.getElementById('ld_co')?.value,
      phone:document.getElementById('ld_ph')?.value,
      email:document.getElementById('ld_em')?.value,
      source:document.getElementById('ld_src')?.value,
      businessType:document.getElementById('ld_btype')?.value,
      potential:+document.getElementById('ld_val')?.value||0,
      temperature:document.getElementById('ld_temp')?.value,
      stage:document.getElementById('ld_stage')?.value,
      lastContact:document.getElementById('ld_lc')?.value,
      nextFollowup:document.getElementById('ld_nf')?.value,
      assignedTo:document.getElementById('ld_assign')?.value,
      notes:document.getElementById('ld_notes')?.value,
    };
    if (id) { STRATIX_DB.update('crmLeads',id,lead); EH.toast('Lead updated!'); }
    else { STRATIX_DB.push('crmLeads',lead); EH.toast('Lead added!'); }
    // Auto create follow-up reminder
    if (lead.nextFollowup) {
      STRATIX_DB.push('reminders',{title:`Follow-up: ${lead.name}`,date:lead.nextFollowup,note:lead.notes||'',done:false});
    }
    document.getElementById('leadModal')?.remove();
    document.getElementById('crm_content').innerHTML = this.renderLeads();
  },
  deleteLead(id) {
    NOTIFY.show('Lead deleted','success'); STRATIX_DB.remove('crmLeads',id); document.getElementById('crm_content').innerHTML=this.renderLeads();
  },
  convertToDeal(leadId) {
    const lead = STRATIX_DB.getArr('crmLeads').find(l=>l.id===leadId);
    if (!lead) return;
    STRATIX_DB.push('crmDeals',{
      name: `Deal — ${lead.name}`, company: lead.company||lead.name,
      phone: lead.phone, value: lead.potential||0,
      stage: 'Proposal', probability: 50, source: lead.source,
      leadId, status: 'Open', closeDate: new Date(Date.now()+14*86400000).toISOString().split('T')[0],
      notes: lead.notes||'',
    });
    STRATIX_DB.update('crmLeads',leadId,{stage:'Qualified',temperature:'Hot'});
    EH.toast(`Lead converted to Deal! Check the Pipeline tab.`,'success');
    document.getElementById('crm_content').innerHTML = this.renderLeads();
  },

  /* ── CONTACTS ── */
  renderContacts() {
    const contacts = STRATIX_DB.getArr('crmContacts');
    return `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Contact Directory — ${contacts.length} contacts</span>
          <div style="display:flex;gap:8px">
            <input placeholder="🔍 Search..." oninput="CRM.searchContacts(this.value)" style="width:200px;padding:6px 10px;font-size:12px;border-radius:8px;border:1px solid var(--b1);background:var(--s2);color:var(--txt)"/>
            <button class="btn btn-gold btn-sm" onclick="CRM.openAddContact()">+ Add Contact</button>
          </div>
        </div>
        <div class="tbl-scroll">
          <table id="contactsTable">
            <thead><tr><th>Name</th><th>Company</th><th>Role</th><th>Phone</th><th>Email</th><th>City</th><th>Type</th><th>Total Business</th><th>Actions</th></tr></thead>
            <tbody>${CRM._renderContactRows(contacts)}</tbody>
          </table>
        </div>
      </div>
      <div id="crmModal"></div>`;
  },
  _renderContactRows(contacts) {
    const sym = EH.sym();
    if (!contacts.length) return `<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">No contacts yet.</td></tr>`;
    return contacts.slice().reverse().map(c=>`<tr>
      <td class="td-b">${escapeHTML(c.name)}</td><td>${c.company||'—'}</td><td class="td-m">${c.role||'—'}</td>
      <td class="td-m">${c.phone||'—'}</td><td class="td-m">${c.email||'—'}</td>
      <td class="td-m">${c.city||'—'}</td>
      <td>${EH.badge(c.type||'Customer',c.type==='Supplier'?'blue':c.type==='Prospect'?'orange':'green')}</td>
      <td class="td-gold">${sym}${EH.fmt(c.totalBusiness||0)}</td>
      <td style="display:flex;gap:5px">
        <button class="btn btn-ghost btn-sm" onclick="CRM.editContact('${c.id}')">✏️</button>
        ${c.phone?`<button class="btn btn-ghost btn-sm" onclick="window.open('https://wa.me/91${c.phone.replace(/[^0-9]/g,'')}','_blank')">📱</button>`:''}
        <button class="btn btn-red btn-sm" onclick="CRM.deleteContact('${c.id}')">🗑</button>
      </td>
    </tr>`).join('');
  },
  searchContacts(q) {
    const f = STRATIX_DB.getArr('crmContacts').filter(c=>
      c.name.toLowerCase().includes(q.toLowerCase())||
      c.company?.toLowerCase().includes(q.toLowerCase())||
      c.phone?.includes(q)
    );
    const tbody = document.querySelector('#contactsTable tbody');
    if (tbody) tbody.innerHTML = this._renderContactRows(f);
  },
  openAddContact(id) {
    const e = id ? STRATIX_DB.getArr('crmContacts').find(c=>c.id===id) : {};
    document.getElementById('crmModal').innerHTML = EH.modal('contactModal',id?'Edit Contact':'➕ Add Contact',`
      <div class="form-grid">
        <div class="field"><label>Full Name *</label><input id="ct_name" value="${e.name||''}" placeholder="Rajesh Kumar"/></div>
        <div class="field"><label>Company</label><input id="ct_co" value="${e.company||''}" placeholder="Company name"/></div>
        <div class="field"><label>Role / Designation</label><input id="ct_role" value="${e.role||''}" placeholder="Owner / Manager / Purchase Head"/></div>
        <div class="field"><label>Contact Type</label><select id="ct_type">
          ${['Customer','Supplier','Prospect','Partner','Other'].map(t=>`<option ${e.type===t?'selected':''}>${t}</option>`).join('')}
        </select></div>
        <div class="field"><label>Phone</label><input id="ct_ph" value="${e.phone||''}" placeholder="+91 9876543210"/></div>
        <div class="field"><label>WhatsApp</label><input id="ct_wa" value="${e.whatsapp||e.phone||''}" placeholder="+91 9876543210"/></div>
        <div class="field"><label>Email</label><input type="email" id="ct_em" value="${e.email||''}" placeholder="email@company.com"/></div>
        <div class="field"><label>City / Location</label><input id="ct_city" value="${e.city||''}" placeholder="Mumbai"/></div>
        <div class="field"><label>GST Number</label><input id="ct_gst" value="${e.gstNumber||''}" placeholder="27XXXXX0000X1Z5"/></div>
        <div class="field"><label>Total Business (${EH.sym()})</label><input type="number" id="ct_biz" value="${e.totalBusiness||0}" placeholder="500000"/></div>
        <div class="field form-full"><label>Address</label><textarea id="ct_addr" rows="2">${e.address||''}</textarea></div>
        <div class="field form-full"><label>Notes</label><textarea id="ct_notes" rows="2">${e.notes||''}</textarea></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="CRM.saveContact('${id||''}')">💾 Save Contact</button>
    `, true);
  },
  editContact(id) { this.openAddContact(id); },
  saveContact(id) {
    const name = document.getElementById('ct_name')?.value.trim();
    if (!name) { EH.toast('Enter contact name','warning'); return; }
    const c = {
      name, company:document.getElementById('ct_co')?.value,
      role:document.getElementById('ct_role')?.value,
      type:document.getElementById('ct_type')?.value,
      phone:document.getElementById('ct_ph')?.value,
      whatsapp:document.getElementById('ct_wa')?.value,
      email:document.getElementById('ct_em')?.value,
      city:document.getElementById('ct_city')?.value,
      gstNumber:document.getElementById('ct_gst')?.value,
      totalBusiness:+document.getElementById('ct_biz')?.value||0,
      address:document.getElementById('ct_addr')?.value,
      notes:document.getElementById('ct_notes')?.value,
    };
    if (id) { STRATIX_DB.update('crmContacts',id,c); EH.toast('Contact updated!'); }
    else { STRATIX_DB.push('crmContacts',c); EH.toast('Contact added!'); }
    document.getElementById('contactModal')?.remove();
    document.getElementById('crm_content').innerHTML = this.renderContacts();
  },
  deleteContact(id) {
    NOTIFY.show('Contact deleted','success'); STRATIX_DB.remove('crmContacts',id); document.getElementById('crm_content').innerHTML=this.renderContacts();
  },

  /* ── DEAL PIPELINE ── */
  renderPipeline() {
    const deals = STRATIX_DB.getArr('crmDeals');
    const sym = EH.sym();
    const stages = ['Prospect','Proposal','Negotiation','Won','Lost'];
    const colors = {'Prospect':'var(--blue)','Proposal':'var(--gold)','Negotiation':'var(--orange)','Won':'var(--green)','Lost':'var(--red)'};
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <div class="kpi" style="padding:12px 16px;min-width:0"><div class="kpi-lbl">Total Pipeline</div><div class="kpi-val" style="font-size:18px">${sym}${EH.fmt(deals.filter(d=>d.status==='Open').reduce((s,d)=>s+(d.value||0),0))}</div></div>
          <div class="kpi" style="padding:12px 16px;min-width:0"><div class="kpi-lbl">Won</div><div class="kpi-val green" style="font-size:18px">${sym}${EH.fmt(deals.filter(d=>d.status==='Won').reduce((s,d)=>s+(d.value||0),0))}</div></div>
          <div class="kpi" style="padding:12px 16px;min-width:0"><div class="kpi-lbl">Win Rate</div><div class="kpi-val" style="font-size:18px">${(() => { const closed=deals.filter(d=>d.status==='Won'||d.status==='Lost').length; return closed>0?Math.round(deals.filter(d=>d.status==='Won').length/closed*100):0; })()}%</div></div>
        </div>
        <button class="btn btn-gold btn-sm" onclick="CRM.openAddDeal()">+ Add Deal</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;overflow-x:auto">
        ${stages.map(stage=>{
          const stageDels = deals.filter(d=>d.stage===stage);
          const stageVal = stageDels.reduce((s,d)=>s+(d.value||0),0);
          return `<div style="background:var(--s2);border-radius:12px;padding:12px;border-top:3px solid ${colors[stage]};min-height:200px">
            <div style="font-size:11px;font-weight:700;color:${colors[stage]};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${stage}</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:10px">${stageDels.length} deal${stageDels.length!==1?'s':''} · ${sym}${EH.fmt(stageVal)}</div>
            ${stageDels.map(d=>`
              <div style="background:var(--s1);border:1px solid var(--b1);border-radius:8px;padding:10px;margin-bottom:8px;cursor:pointer" onclick="CRM.viewDeal('${d.id}')">
                <div style="font-size:12px;font-weight:700;margin-bottom:3px">${d.name}</div>
                <div style="font-size:11px;color:var(--muted);margin-bottom:5px">${d.company||'—'}</div>
                <div style="font-size:13px;font-weight:700;color:var(--gold)">${sym}${EH.fmt(d.value||0)}</div>
                <div style="font-size:10px;color:var(--muted);margin-top:3px">Close: ${EH.dateStr(d.closeDate)}</div>
                <div style="display:flex;gap:5px;margin-top:6px">
                  ${stage!=='Won'&&stage!=='Lost'?`<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="event.stopPropagation();CRM.moveDeal('${d.id}','forward')">→</button>`:''}
                  <button class="btn btn-ghost btn-sm" style="font-size:10px;padding:3px 8px" onclick="event.stopPropagation();CRM.editDeal('${d.id}')">✏️</button>
                  <button class="btn btn-red btn-sm" style="font-size:10px;padding:3px 8px" onclick="event.stopPropagation();CRM.deleteDeal('${d.id}')">🗑</button>
                </div>
              </div>`).join('')}
          </div>`;
        }).join('')}
      </div>
      <div id="crmModal"></div>`;
  },
  openAddDeal(id) {
    const e = id ? STRATIX_DB.getArr('crmDeals').find(d=>d.id===id) : {};
    document.getElementById('crmModal').innerHTML = EH.modal('dealModal',id?'Edit Deal':'➕ Add Deal',`
      <div class="form-grid">
        <div class="field"><label>Deal Name *</label><input id="dl_name" value="${e.name||''}" placeholder="Deal — Transport Contract"/></div>
        <div class="field"><label>Company / Client *</label><input id="dl_co" value="${e.company||''}" placeholder="Company name"/></div>
        <div class="field"><label>Contact Phone</label><input id="dl_ph" value="${e.phone||''}" placeholder="+91 9876543210"/></div>
        <div class="field"><label>Deal Value (${EH.sym()})</label><input type="number" id="dl_val" value="${e.value||0}" placeholder="100000"/></div>
        <div class="field"><label>Stage</label><select id="dl_stage">
          ${['Prospect','Proposal','Negotiation','Won','Lost'].map(s=>`<option ${e.stage===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="field"><label>Win Probability (%)</label><input type="number" id="dl_prob" value="${e.probability||50}" min="0" max="100"/></div>
        <div class="field"><label>Expected Close Date</label><input type="date" id="dl_close" value="${e.closeDate||new Date(Date.now()+14*86400000).toISOString().split('T')[0]}"/></div>
        <div class="field"><label>Deal Source</label><select id="dl_src">
          ${['Referral','WhatsApp','Cold Call','Website','Trade Show','CA Partner','Direct','Other'].map(s=>`<option ${e.source===s?'selected':''}>${s}</option>`).join('')}
        </select></div>
        <div class="field form-full"><label>Notes</label><textarea id="dl_notes" rows="3">${e.notes||''}</textarea></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="CRM.saveDeal('${id||''}')">💾 Save Deal</button>
    `, true);
  },
  editDeal(id) { this.openAddDeal(id); },
  saveDeal(id) {
    const name = document.getElementById('dl_name')?.value.trim();
    if (!name) { EH.toast('Enter deal name','warning'); return; }
    const d = {
      name, company:document.getElementById('dl_co')?.value,
      phone:document.getElementById('dl_ph')?.value,
      value:+document.getElementById('dl_val')?.value||0,
      stage:document.getElementById('dl_stage')?.value,
      probability:+document.getElementById('dl_prob')?.value||50,
      closeDate:document.getElementById('dl_close')?.value,
      source:document.getElementById('dl_src')?.value,
      notes:document.getElementById('dl_notes')?.value,
      status:document.getElementById('dl_stage')?.value==='Won'?'Won':document.getElementById('dl_stage')?.value==='Lost'?'Lost':'Open',
    };
    if (d.status==='Won') {
      STRATIX_DB.push('transactions',{type:'revenue',amount:d.value,category:'contract',description:`CRM Win: ${name}`,date:EH.today()});
    }
    if (id) { STRATIX_DB.update('crmDeals',id,d); EH.toast('Deal updated!'); }
    else { STRATIX_DB.push('crmDeals',d); EH.toast('Deal added to pipeline!'); }
    document.getElementById('dealModal')?.remove();
    document.getElementById('crm_content').innerHTML = this.renderPipeline();
  },
  moveDeal(id, dir) {
    const stages=['Prospect','Proposal','Negotiation','Won','Lost'];
    const d = STRATIX_DB.getArr('crmDeals').find(d=>d.id===id);
    if (!d) return;
    const i = stages.indexOf(d.stage||'Prospect');
    if (dir==='forward'&&i<stages.length-1) {
      const newStage = stages[i+1];
      const status = newStage==='Won'?'Won':newStage==='Lost'?'Lost':'Open';
      STRATIX_DB.update('crmDeals',id,{stage:newStage,status});
      if (newStage==='Won') {
        STRATIX_DB.push('transactions',{type:'revenue',amount:d.value,category:'contract',description:`CRM Win: ${d.name}`,date:EH.today()});
        EH.toast(`🎉 Deal WON! Revenue recorded: ${EH.sym()}${EH.fmt(d.value)}`,'success');
      }
      document.getElementById('crm_content').innerHTML = this.renderPipeline();
    }
  },
  deleteDeal(id) {
    NOTIFY.show('Deal deleted','success'); STRATIX_DB.remove('crmDeals',id); document.getElementById('crm_content').innerHTML=this.renderPipeline();
  },
  viewDeal(id) {
    const d = STRATIX_DB.getArr('crmDeals').find(d=>d.id===id);
    if (!d) return;
    const sym = EH.sym();
    document.getElementById('crmModal').innerHTML = EH.modal('dealView',`Deal — ${d.name}`,`
      <div style="display:grid;gap:10px">
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="kpi accent"><div class="kpi-lbl">Deal Value</div><div class="kpi-val">${sym}${EH.fmt(d.value)}</div></div>
          <div class="kpi"><div class="kpi-lbl">Stage</div><div class="kpi-val" style="font-size:16px">${d.stage}</div></div>
          <div class="kpi"><div class="kpi-lbl">Win Probability</div><div class="kpi-val">${d.probability}%</div></div>
        </div>
        <div class="card" style="padding:14px">
          ${[['Company',d.company||'—'],['Phone',d.phone||'—'],['Close Date',EH.dateStr(d.closeDate)],['Source',d.source||'—'],['Status',d.status||'Open']].map(([k,v])=>`
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--b1);font-size:13px">
              <span style="color:var(--muted)">${k}</span><span>${v}</span>
            </div>`).join('')}
        </div>
        ${d.notes?`<div class="alert a-blue"><span class="alert-ico">📝</span><div>${d.notes}</div></div>`:''}
        <div style="display:flex;gap:8px">
          <button class="btn btn-gold" onclick="CRM.editDeal('${d.id}');document.getElementById('dealView')?.remove()">✏️ Edit Deal</button>
          ${d.stage!=='Won'?`<button class="btn btn-green" onclick="CRM.moveDeal('${d.id}','forward');document.getElementById('dealView')?.remove()">→ Move Forward</button>`:''}
        </div>
      </div>
    `);
  },

  /* ── FOLLOW-UPS ── */
  renderFollowup() {
    const leads = STRATIX_DB.getArr('crmLeads').filter(l=>l.nextFollowup);
    const today = EH.today();
    const overdue = leads.filter(l=>l.nextFollowup<today);
    const todayF = leads.filter(l=>l.nextFollowup===today);
    const upcoming = leads.filter(l=>l.nextFollowup>today);
    const sym = EH.sym();
    const renderSection = (title, color, items) => `
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px">${title} (${items.length})</div>
        ${items.length===0?`<p style="color:var(--muted);font-size:13px;padding:10px">No follow-ups in this category</p>`:
        items.map(l=>`
          <div class="rem-card ${l.nextFollowup<today?'overdue':l.nextFollowup===today?'today':''}">
            <div style="font-size:20px">📞</div>
            <div class="rem-body">
              <div class="rem-name">${l.name} ${l.company?`<span style="color:var(--muted);font-weight:400">— ${l.company}</span>`:''}</div>
              <div class="rem-meta">${EH.badge(l.temperature||'Cold',EH.statusColor(l.temperature||'Cold'))} ${EH.badge(l.stage||'New',EH.statusColor(l.stage||'New'))} · Due: ${EH.dateStr(l.nextFollowup)} · ${sym}${EH.fmt(l.potential||0)} potential</div>
              ${l.notes?`<div style="font-size:11px;color:var(--muted);margin-top:4px">${l.notes.slice(0,80)}${l.notes.length>80?'...':''}</div>`:''}
            </div>
            <div style="display:flex;flex-direction:column;gap:5px">
              ${l.phone?`<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="window.open('https://wa.me/91${l.phone.replace(/[^0-9]/g,'')}','_blank')">📱 WhatsApp</button>`:''}
              <button class="btn btn-gold btn-sm" style="font-size:11px" onclick="CRM.markFollowupDone('${l.id}')">✅ Done</button>
              <button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="CRM.editLead('${l.id}')">📅 Reschedule</button>
            </div>
          </div>`).join('')}
      </div>`;
    return `
      <div>
        ${renderSection('🔴 Overdue Follow-ups','var(--red)',overdue)}
        ${renderSection('📅 Today\'s Follow-ups','var(--gold)',todayF)}
        ${renderSection('🔜 Upcoming (Next 7 Days)','var(--blue)',upcoming.slice(0,10))}
      </div>
      <div id="crmModal"></div>`;
  },
  markFollowupDone(id) {
    const next = new Date(Date.now()+7*86400000).toISOString().split('T')[0]; NOTIFY.show('Follow-up set for ' + next,'success');
    if (next) {
      STRATIX_DB.update('crmLeads',id,{lastContact:EH.today(),nextFollowup:next});
      STRATIX_DB.push('crmActivity',{type:'Follow-up Done',leadId:id,date:EH.today(),note:`Next scheduled: ${next}`});
      EH.toast('Follow-up marked done. Next follow-up scheduled!');
      document.getElementById('crm_content').innerHTML = this.renderFollowup();
    }
  },

  /* ── ACTIVITY LOG ── */
  renderActivity() {
    const acts = STRATIX_DB.getArr('crmActivity');
    return `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Activity Log — ${acts.length} entries</span>
          <button class="btn btn-gold btn-sm" onclick="CRM.logActivity()">+ Log Activity</button>
        </div>
        <div class="tbl-scroll"><table>
          <thead><tr><th>Date</th><th>Type</th><th>Lead / Company</th><th>Note</th></tr></thead>
          <tbody>
            ${acts.length===0
              ? `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--muted)">No activities logged yet.</td></tr>`
              : acts.slice().reverse().slice(0,50).map(a=>{
                const lead = STRATIX_DB.getArr('crmLeads').find(l=>l.id===a.leadId);
                return `<tr>
                  <td class="td-m">${EH.dateStr(a.date)}</td>
                  <td>${EH.badge(a.type||'Note','blue')}</td>
                  <td>${lead?.name||a.company||'—'}</td>
                  <td class="td-m">${a.note||'—'}</td>
                </tr>`;
              }).join('')}
          </tbody>
        </table></div>
      </div>`;
  },
  logActivity() {
    const leads = STRATIX_DB.getArr('crmLeads');
    document.getElementById('crm_content').innerHTML += EH.modal('actModal','📋 Log Activity',`
      <div class="form-grid">
        <div class="field"><label>Activity Type</label><select id="act_type">
          ${['Call Made','Meeting Done','WhatsApp Sent','Email Sent','Demo Given','Follow-up Done','Quote Sent','Order Received','Complaint Resolved','Note'].map(t=>`<option>${t}</option>`).join('')}
        </select></div>
        <div class="field"><label>Date</label><input type="date" id="act_date" value="${EH.today()}"/></div>
        <div class="field"><label>Related Lead / Contact</label><select id="act_lead">
          <option value="">General</option>
          ${leads.map(l=>`<option value="${l.id}">${l.name} (${l.company||'—'})</option>`).join('')}
        </select></div>
        <div class="field form-full"><label>Notes / Details *</label><textarea id="act_note" rows="3" placeholder="What happened, outcome, next steps..."></textarea></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="CRM.saveActivity()">💾 Save Activity</button>
    `);
  },
  saveActivity() {
    const note = document.getElementById('act_note')?.value.trim();
    if (!note) { EH.toast('Enter activity note','warning'); return; }
    STRATIX_DB.push('crmActivity',{
      type: document.getElementById('act_type')?.value,
      date: document.getElementById('act_date')?.value,
      leadId: document.getElementById('act_lead')?.value,
      note,
    });
    document.getElementById('actModal')?.remove();
    EH.toast('Activity logged!');
    document.getElementById('crm_content').innerHTML = this.renderActivity();
  },
};


/* ════════════════════════════════════════════════════════════════
   MODULE 3 — SUPPLY CHAIN (SCM)
   ════════════════════════════════════════════════════════════════ */

function renderSCM() {
  const sym = EH.sym();
  const vendors = STRATIX_DB.getArr('scmVendors');
  const reqs = STRATIX_DB.getArr('scmRequisitions');
  const shipments = STRATIX_DB.getArr('scmShipments');
  const inv = STRATIX_DB.getArr('erpInventory');
  const lowStock = inv.filter(i=>(i.qty||0)<=(i.reorderQty||5)).length;

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div><h1 class="sec-title">SCM — Supply Chain Management</h1>
          <p class="sec-sub">Suppliers · Requisitions · Quotations · Shipments · Forecasting</p>
        </div>
        <span class="owner-tag">👑 All Unlocked</span>
      </div>
      <div class="owner-banner">
        <span class="ob-ico">🔗</span>
        <div><div class="ob-txt">Full Supply Chain — From procurement to delivery</div>
          <div class="ob-sub">Vendor master, purchase requisitions, quotation comparison, shipment tracking, demand forecasting, reorder alerts</div>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi accent"><div class="kpi-lbl">Registered Vendors</div><div class="kpi-val">${vendors.length}</div><div class="kpi-ico">🏭</div></div>
        <div class="kpi"><div class="kpi-lbl">Open Requisitions</div><div class="kpi-val blue">${reqs.filter(r=>r.status!=='Ordered').length}</div><div class="kpi-ico">📋</div></div>
        <div class="kpi"><div class="kpi-lbl">Active Shipments</div><div class="kpi-val gold">${shipments.filter(s=>s.status!=='Delivered').length}</div><div class="kpi-ico">🚛</div></div>
        <div class="kpi"><div class="kpi-lbl" style="color:var(--red)">Reorder Alerts</div><div class="kpi-val red">${lowStock}</div><div class="kpi-ico">⚠️</div></div>
      </div>

      <div class="calc-tabs" style="margin-bottom:20px">
        <button class="ctab active" id="scm_tab_vendors" onclick="SCM.tab('vendors')">🏭 Vendors</button>
        <button class="ctab" id="scm_tab_reqs" onclick="SCM.tab('reqs')">📋 Requisitions</button>
        <button class="ctab" id="scm_tab_quotes" onclick="SCM.tab('quotes')">💬 Quotations</button>
        <button class="ctab" id="scm_tab_shipments" onclick="SCM.tab('shipments')">🚛 Shipments</button>
        <button class="ctab" id="scm_tab_reorder" onclick="SCM.tab('reorder')">⚠️ Reorder Alerts</button>
        <button class="ctab" id="scm_tab_forecast" onclick="SCM.tab('forecast')">📈 Forecast</button>
      </div>
      <div id="scm_content">${SCM.renderVendors()}</div>
    </div>`;
}

const SCM = {
  tab(name) {
    document.querySelectorAll('[id^="scm_tab_"]').forEach(b=>b.classList.remove('active'));
    document.getElementById('scm_tab_'+name)?.classList.add('active');
    const renders = {vendors:this.renderVendors,reqs:this.renderRequisitions,quotes:this.renderQuotations,shipments:this.renderShipments,reorder:this.renderReorder,forecast:this.renderForecast};
    document.getElementById('scm_content').innerHTML = (renders[name]||this.renderVendors).call(this);
  },

  /* ── VENDORS ── */
  renderVendors() {
    const vendors = STRATIX_DB.getArr('scmVendors');
    const sym = EH.sym();
    return `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Vendor / Supplier Master — ${vendors.length} vendors</span>
          <button class="btn btn-gold btn-sm" onclick="SCM.openAddVendor()">+ Add Vendor</button>
        </div>
        <div class="tbl-scroll"><table>
          <thead><tr><th>Vendor Code</th><th>Name</th><th>Category</th><th>Phone</th><th>City</th><th>GST No</th><th>Payment Terms</th><th>Score</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${vendors.length===0
              ? `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--muted)">No vendors yet. Add your suppliers to start managing the supply chain.</td></tr>`
              : vendors.map(v=>{
                  const score = this._vendorScore(v.id);
                  return `<tr>
                    <td class="td-m">${v.code||'—'}</td>
                    <td class="td-b">${escapeHTML(v.name)}</td>
                    <td class="td-m">${v.category||'—'}</td>
                    <td class="td-m">${v.phone||'—'}</td>
                    <td class="td-m">${v.city||'—'}</td>
                    <td class="td-m">${v.gst||'—'}</td>
                    <td class="td-m">${v.payTerms||'—'}</td>
                    <td>${score>=80?'⭐⭐⭐':score>=60?'⭐⭐':'⭐'} <span class="${score>=80?'td-g':score>=60?'td-gold':'td-r'}">${score}</span></td>
                    <td>${EH.badge(v.status||'Active',EH.statusColor(v.status||'Active'))}</td>
                    <td style="display:flex;gap:5px">
                      <button class="btn btn-ghost btn-sm" onclick="SCM.editVendor('${v.id}')">✏️</button>
                      <button class="btn btn-ghost btn-sm" onclick="SCM.viewVendorHistory('${v.id}')">📊</button>
                      <button class="btn btn-red btn-sm" onclick="SCM.deleteVendor('${v.id}')">🗑</button>
                    </td>
                  </tr>`;
                }).join('')
            }
          </tbody>
        </table></div>
      </div>
      <div id="scmModal"></div>`;
  },

  _vendorScore(vendorId) {
    const pos = STRATIX_DB.getArr('erpPurchaseOrders').filter(p=>p.supplier&&STRATIX_DB.getArr('scmVendors').find(v=>v.id===vendorId)?.name===p.supplier);
    if (pos.length===0) return 75; // default
    const onTime = pos.filter(p=>p.status==='Received'&&(!p.expectedDate||p.receivedDate<=p.expectedDate)).length;
    return Math.round(60 + (pos.length>0?onTime/pos.length:0)*40);
  },

  openAddVendor(id) {
    const e = id ? STRATIX_DB.getArr('scmVendors').find(v=>v.id===id) : {};
    document.getElementById('scmModal').innerHTML = EH.modal('vendorModal',id?'Edit Vendor':'➕ Add Vendor / Supplier',`
      <div class="form-grid">
        <div class="field"><label>Vendor Code</label><input id="vn_code" value="${e.code||''}" placeholder="VND001"/></div>
        <div class="field"><label>Vendor Name *</label><input id="vn_name" value="${e.name||''}" placeholder="Supplier company name"/></div>
        <div class="field"><label>Category</label><select id="vn_cat">
          ${['Raw Material','Spare Parts','Consumables','Services','Transport','Fuel','Packing','Other'].map(c=>`<option ${e.category===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
        <div class="field"><label>Contact Person</label><input id="vn_cp" value="${e.contactPerson||''}" placeholder="Person name"/></div>
        <div class="field"><label>Phone *</label><input id="vn_ph" value="${e.phone||''}" placeholder="+91 9876543210"/></div>
        <div class="field"><label>Email</label><input type="email" id="vn_em" value="${e.email||''}" placeholder="vendor@company.com"/></div>
        <div class="field"><label>GST Number</label><input id="vn_gst" value="${e.gst||''}" placeholder="27XXXXX0000X1Z5"/></div>
        <div class="field"><label>PAN Number</label><input id="vn_pan" value="${e.pan||''}" placeholder="ABCDE1234F"/></div>
        <div class="field"><label>City / Location</label><input id="vn_city" value="${e.city||''}" placeholder="Mumbai"/></div>
        <div class="field"><label>Payment Terms</label><select id="vn_pay">
          ${['Advance 100%','30 Days Credit','45 Days Credit','60 Days Credit','On Delivery','Against LC','Other'].map(p=>`<option ${e.payTerms===p?'selected':''}>${p}</option>`).join('')}
        </select></div>
        <div class="field"><label>Lead Time (days)</label><input type="number" id="vn_lead" value="${e.leadTime||7}" placeholder="7"/></div>
        <div class="field"><label>Min Order Qty</label><input id="vn_moq" value="${e.moq||''}" placeholder="100 kg"/></div>
        <div class="field"><label>Bank Name</label><input id="vn_bank" value="${e.bankName||''}" placeholder="HDFC Bank"/></div>
        <div class="field"><label>Account Number</label><input id="vn_acc" value="${e.bankAcc||''}" placeholder="Account number"/></div>
        <div class="field"><label>IFSC</label><input id="vn_ifsc" value="${e.ifsc||''}" placeholder="HDFC0001234"/></div>
        <div class="field"><label>Status</label><select id="vn_status"><option ${e.status==='Active'?'selected':''}>Active</option><option ${e.status==='Inactive'?'selected':''}>Inactive</option><option ${e.status==='Blacklisted'?'selected':''}>Blacklisted</option></select></div>
        <div class="field form-full"><label>Address</label><textarea id="vn_addr" rows="2">${e.address||''}</textarea></div>
        <div class="field form-full"><label>Notes</label><textarea id="vn_notes" rows="2">${e.notes||''}</textarea></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="SCM.saveVendor('${id||''}')">💾 Save Vendor</button>
    `, true);
  },
  editVendor(id) { this.openAddVendor(id); },
  saveVendor(id) {
    const name = document.getElementById('vn_name')?.value.trim();
    if (!name) { EH.toast('Enter vendor name','warning'); return; }
    const v = {
      code:document.getElementById('vn_code')?.value, name,
      category:document.getElementById('vn_cat')?.value,
      contactPerson:document.getElementById('vn_cp')?.value,
      phone:document.getElementById('vn_ph')?.value,
      email:document.getElementById('vn_em')?.value,
      gst:document.getElementById('vn_gst')?.value,
      pan:document.getElementById('vn_pan')?.value,
      city:document.getElementById('vn_city')?.value,
      payTerms:document.getElementById('vn_pay')?.value,
      leadTime:+document.getElementById('vn_lead')?.value||7,
      moq:document.getElementById('vn_moq')?.value,
      bankName:document.getElementById('vn_bank')?.value,
      bankAcc:document.getElementById('vn_acc')?.value,
      ifsc:document.getElementById('vn_ifsc')?.value,
      status:document.getElementById('vn_status')?.value||'Active',
      address:document.getElementById('vn_addr')?.value,
      notes:document.getElementById('vn_notes')?.value,
    };
    if (id) { STRATIX_DB.update('scmVendors',id,v); EH.toast('Vendor updated!'); }
    else { STRATIX_DB.push('scmVendors',v); EH.toast('Vendor added!'); }
    document.getElementById('vendorModal')?.remove();
    document.getElementById('scm_content').innerHTML = this.renderVendors();
  },
  deleteVendor(id) {
    NOTIFY.show('Vendor deleted','success'); STRATIX_DB.remove('scmVendors',id); document.getElementById('scm_content').innerHTML=this.renderVendors();
  },
  viewVendorHistory(id) {
    const v = STRATIX_DB.getArr('scmVendors').find(v=>v.id===id);
    const pos = STRATIX_DB.getArr('erpPurchaseOrders').filter(p=>p.supplier===v?.name);
    const sym = EH.sym();
    const totalBusiness = pos.reduce((s,p)=>s+(p.totalAmt||0),0);
    document.getElementById('scmModal').innerHTML = EH.modal('vhModal',`Vendor History — ${v?.name||''}`,`
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div class="kpi"><div class="kpi-lbl">Total Orders</div><div class="kpi-val">${pos.length}</div></div>
        <div class="kpi accent"><div class="kpi-lbl">Total Business</div><div class="kpi-val">${sym}${EH.fmt(totalBusiness)}</div></div>
        <div class="kpi"><div class="kpi-lbl">On-Time Rate</div><div class="kpi-val green">${this._vendorScore(id)}%</div></div>
      </div>
      <div class="tbl-scroll"><table>
        <thead><tr><th>PO No</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${pos.length===0?`<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--muted)">No orders yet</td></tr>`:
        pos.map(p=>`<tr><td class="td-b">${p.poNo}</td><td class="td-m">${EH.dateStr(p.date)}</td>
          <td class="td-gold">${sym}${EH.fmt(p.totalAmt||0)}</td>
          <td>${EH.badge(p.status||'Draft',EH.statusColor(p.status||'Draft'))}</td></tr>`).join('')}
        </tbody>
      </table></div>
    `);
  },

  /* ── REQUISITIONS ── */
  renderRequisitions() {
    const reqs = STRATIX_DB.getArr('scmRequisitions');
    const inv = STRATIX_DB.getArr('erpInventory');
    const sym = EH.sym();
    return `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Purchase Requisitions — ${reqs.length} total</span>
          <button class="btn btn-gold btn-sm" onclick="SCM.openAddReq()">+ New Requisition</button>
        </div>
        <div class="tbl-scroll"><table>
          <thead><tr><th>Req No</th><th>Item</th><th>Qty Required</th><th>Required By</th><th>Raised By</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${reqs.length===0
            ? `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">No requisitions yet.</td></tr>`
            : reqs.slice().reverse().map(r=>`<tr>
                <td class="td-b">${r.reqNo}</td><td>${r.item}</td>
                <td>${r.qty} ${r.unit||'pcs'}</td>
                <td class="${r.reqDate<EH.today()&&r.status!=='Ordered'?'td-r':''}">${EH.dateStr(r.reqDate)}</td>
                <td class="td-m">${r.raisedBy||'—'}</td>
                <td>${EH.badge(r.priority||'Normal',r.priority==='Urgent'?'red':r.priority==='High'?'orange':'blue')}</td>
                <td>${EH.badge(r.status||'Pending',EH.statusColor(r.status||'Pending'))}</td>
                <td style="display:flex;gap:5px">
                  ${r.status!=='Ordered'?`<button class="btn btn-gold btn-sm" onclick="SCM.convertReqToPO('${r.id}')">→ Create PO</button>`:'<span class="badge bg">PO Created</span>'}
                  <button class="btn btn-red btn-sm" onclick="SCM.deleteReq('${r.id}')">🗑</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
      <div id="scmModal"></div>`;
  },
  openAddReq() {
    const inv = STRATIX_DB.getArr('erpInventory');
    document.getElementById('scmModal').innerHTML = EH.modal('reqModal','📋 New Purchase Requisition',`
      <div class="form-grid">
        <div class="field"><label>Requisition No</label><input id="rq_no" value="REQ-${Date.now().toString().slice(-5)}"/></div>
        <div class="field"><label>Date Required By</label><input type="date" id="rq_date" value="${new Date(Date.now()+3*86400000).toISOString().split('T')[0]}"/></div>
        <div class="field"><label>Item Required *</label>
          <select id="rq_item" onchange="SCM.autoFillReqItem(this)">
            <option value="custom">Custom / New Item</option>
            ${inv.map(i=>`<option value="${i.id}" data-unit="${i.unit||'pcs'}">${i.name} (Current: ${i.qty||0} ${i.unit||'pcs'})</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Item Name (if custom)</label><input id="rq_itemname" placeholder="Enter item name"/></div>
        <div class="field"><label>Qty Required *</label><input type="number" id="rq_qty" placeholder="100"/></div>
        <div class="field"><label>Unit</label><input id="rq_unit" placeholder="kg / pcs / litre"/></div>
        <div class="field"><label>Priority</label><select id="rq_pri"><option>Normal</option><option>High</option><option>Urgent</option></select></div>
        <div class="field"><label>Raised By</label><input id="rq_by" placeholder="Department / Person name"/></div>
        <div class="field"><label>Estimated Cost (${EH.sym()})</label><input type="number" id="rq_cost" placeholder="5000"/></div>
        <div class="field"><label>Preferred Vendor</label><select id="rq_vendor">
          <option value="">Any Vendor</option>
          ${STRATIX_DB.getArr('scmVendors').filter(v=>v.status==='Active').map(v=>`<option>${escapeHTML(v.name)}</option>`).join('')}
        </select></div>
        <div class="field form-full"><label>Reason / Justification</label><textarea id="rq_reason" rows="2" placeholder="Why is this purchase needed?"></textarea></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="SCM.saveReq()">💾 Submit Requisition</button>
    `, true);
  },
  autoFillReqItem(sel) {
    const unit = sel.options[sel.selectedIndex]?.dataset.unit||'pcs';
    document.getElementById('rq_unit').value = unit;
    if (sel.value!=='custom') {
      const name = sel.options[sel.selectedIndex].text.split(' (')[0];
      document.getElementById('rq_itemname').value = name;
    }
  },
  saveReq() {
    const qty = +document.getElementById('rq_qty')?.value||0;
    const sel = document.getElementById('rq_item');
    const itemName = sel.value==='custom' ? document.getElementById('rq_itemname')?.value.trim() : sel.options[sel.selectedIndex].text.split(' (')[0];
    if (!itemName || !qty) { EH.toast('Enter item and quantity','warning'); return; }
    STRATIX_DB.push('scmRequisitions',{
      reqNo:document.getElementById('rq_no')?.value,
      item:itemName, itemId:sel.value,
      qty, unit:document.getElementById('rq_unit')?.value||'pcs',
      reqDate:document.getElementById('rq_date')?.value,
      priority:document.getElementById('rq_pri')?.value,
      raisedBy:document.getElementById('rq_by')?.value,
      estimatedCost:+document.getElementById('rq_cost')?.value||0,
      preferredVendor:document.getElementById('rq_vendor')?.value,
      reason:document.getElementById('rq_reason')?.value,
      status:'Pending',
    });
    document.getElementById('reqModal')?.remove();
    EH.toast('Requisition submitted!');
    document.getElementById('scm_content').innerHTML = this.renderRequisitions();
  },
  convertReqToPO(id) {
    const req = STRATIX_DB.getArr('scmRequisitions').find(r=>r.id===id);
    if (!req) return;
    const vendor = req.preferredVendor || 'TBD';
    if (!vendor) return;
    STRATIX_DB.push('erpPurchaseOrders',{
      poNo:`PO-${Date.now().toString().slice(-6)}`,
      supplier:vendor,
      date:EH.today(),
      expectedDate:req.reqDate,
      items:[{name:req.item,itemId:req.itemId,qty:req.qty,unit:req.unit,rate:req.estimatedCost>0?Math.round(req.estimatedCost/req.qty):0,amount:req.estimatedCost||0}],
      totalAmt:req.estimatedCost||0,
      notes:`From Requisition ${req.reqNo}`,
      status:'Confirmed',
    });
    STRATIX_DB.update('scmRequisitions',id,{status:'Ordered'});
    EH.toast(`Purchase Order created for ${vendor}!`);
    document.getElementById('scm_content').innerHTML = this.renderRequisitions();
  },
  deleteReq(id) {
    NOTIFY.show('Requisition deleted','success'); STRATIX_DB.remove('scmRequisitions',id); document.getElementById('scm_content').innerHTML=this.renderRequisitions();
  },

  /* ── QUOTATION COMPARISON ── */
  renderQuotations() {
    const quotes = STRATIX_DB.getArr('scmQuotes');
    const sym = EH.sym();
    // Group by item
    const items = [...new Set(quotes.map(q=>q.item))];
    return `
      <div style="margin-bottom:14px">
        <div class="alert a-gold"><span class="alert-ico">💡</span>
          <div>Compare quotes from multiple vendors for the same item. The system automatically highlights the best price.</div>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
        <button class="btn btn-gold btn-sm" onclick="SCM.openAddQuote()">+ Add Quote</button>
      </div>
      ${items.length===0
        ? `<div class="empty"><div class="ei">💬</div><h3>No quotations yet</h3><p>Add vendor quotes to compare prices</p></div>`
        : items.map(item=>{
            const itemQuotes = quotes.filter(q=>q.item===item).sort((a,b)=>a.unitRate-b.unitRate);
            const best = itemQuotes[0];
            return `
              <div class="tbl-wrap" style="margin-bottom:14px">
                <div class="tbl-head"><span class="tbl-title">📦 ${item}</span></div>
                <div class="tbl-scroll"><table>
                  <thead><tr><th>Vendor</th><th>Unit Rate</th><th>Lead Time</th><th>Min Qty</th><th>Payment Terms</th><th>Valid Till</th><th>Remarks</th><th></th></tr></thead>
                  <tbody>${itemQuotes.map((q,i)=>`<tr style="${i===0?'background:rgba(0,214,143,.05)':''}">
                    <td class="td-b">${q.vendor} ${i===0?'<span class="badge bg" style="font-size:9px">BEST PRICE</span>':''}</td>
                    <td class="${i===0?'td-g fw-700':''}">${sym}${EH.fmt(q.unitRate)} / ${q.unit||'unit'}</td>
                    <td class="td-m">${q.leadTime||'—'} days</td>
                    <td class="td-m">${q.minQty||'—'}</td>
                    <td class="td-m">${q.payTerms||'—'}</td>
                    <td class="${q.validTill<EH.today()?'td-r':''}">${EH.dateStr(q.validTill)}</td>
                    <td class="td-m">${q.remarks||'—'}</td>
                    <td><button class="btn btn-ghost btn-sm" onclick="SCM.deleteQuote('${q.id}')">🗑</button></td>
                  </tr>`).join('')}</tbody>
                </table></div>
                <div style="padding:10px 14px;font-size:12px;color:var(--muted)">
                  Best: <b>${best.vendor}</b> @ ${sym}${EH.fmt(best.unitRate)}/${best.unit||'unit'} · 
                  Saving vs highest: ${sym}${EH.fmt(itemQuotes[itemQuotes.length-1].unitRate-best.unitRate)} / unit
                </div>
              </div>`;
          }).join('')
      }
      <div id="scmModal"></div>`;
  },
  openAddQuote() {
    const vendors = STRATIX_DB.getArr('scmVendors');
    document.getElementById('scmModal').innerHTML = EH.modal('quoteModal','💬 Add Vendor Quotation',`
      <div class="form-grid">
        <div class="field"><label>Item Name *</label><input id="qt_item" placeholder="Steel Rods 12mm"/></div>
        <div class="field"><label>Vendor *</label>
          ${vendors.length>0
            ? `<select id="qt_vendor">${vendors.map(v=>`<option>${escapeHTML(v.name)}</option>`).join('')}</select>`
            : `<input id="qt_vendor" placeholder="Vendor name"/>`}
        </div>
        <div class="field"><label>Unit Rate (${EH.sym()})</label><input type="number" id="qt_rate" placeholder="150"/></div>
        <div class="field"><label>Unit</label><input id="qt_unit" placeholder="kg / pcs / litre"/></div>
        <div class="field"><label>Minimum Qty</label><input id="qt_minqty" placeholder="100 kg"/></div>
        <div class="field"><label>Lead Time (days)</label><input type="number" id="qt_lead" placeholder="7"/></div>
        <div class="field"><label>Payment Terms</label><select id="qt_pay">
          ${['Advance','30 Days','45 Days','60 Days','On Delivery'].map(p=>`<option>${p}</option>`).join('')}
        </select></div>
        <div class="field"><label>Quote Valid Till</label><input type="date" id="qt_valid" value="${new Date(Date.now()+30*86400000).toISOString().split('T')[0]}"/></div>
        <div class="field form-full"><label>Remarks / Conditions</label><input id="qt_rem" placeholder="Any special conditions, inclusions, exclusions..."/></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="SCM.saveQuote()">💾 Save Quotation</button>
    `, true);
  },
  saveQuote() {
    const item = document.getElementById('qt_item')?.value.trim();
    const vendor = document.getElementById('qt_vendor')?.value.trim();
    const rate = +document.getElementById('qt_rate')?.value||0;
    if (!item||!vendor||!rate) { EH.toast('Fill item, vendor and rate','warning'); return; }
    STRATIX_DB.push('scmQuotes',{
      item, vendor, unitRate:rate,
      unit:document.getElementById('qt_unit')?.value,
      minQty:document.getElementById('qt_minqty')?.value,
      leadTime:+document.getElementById('qt_lead')?.value||7,
      payTerms:document.getElementById('qt_pay')?.value,
      validTill:document.getElementById('qt_valid')?.value,
      remarks:document.getElementById('qt_rem')?.value,
    });
    document.getElementById('quoteModal')?.remove();
    EH.toast('Quotation saved!');
    document.getElementById('scm_content').innerHTML = this.renderQuotations();
  },
  deleteQuote(id) {
    NOTIFY.show('Quote deleted','success'); STRATIX_DB.remove('scmQuotes',id); document.getElementById('scm_content').innerHTML=this.renderQuotations();
  },

  /* ── SHIPMENT TRACKING ── */
  renderShipments() {
    const shipments = STRATIX_DB.getArr('scmShipments');
    const sym = EH.sym();
    const stages = ['Order Placed','Dispatched by Vendor','In Transit','At Border/Checkpoint','Arrived at Warehouse','Quality Check','Received','Delivered'];
    return `
      <div class="tbl-wrap">
        <div class="tbl-head">
          <span class="tbl-title">Inward Shipment Tracking</span>
          <button class="btn btn-gold btn-sm" onclick="SCM.openAddShipment()">+ Track Shipment</button>
        </div>
        ${shipments.filter(s=>s.status!=='Delivered').length===0&&shipments.length>0?'':
          shipments.filter(s=>s.status!=='Delivered').map(s=>`
            <div class="order-card ${s.expectedDate<EH.today()?'crit':''}" style="margin:10px 14px;padding:16px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
                <div>
                  <div class="td-b">${s.trackingNo} — ${s.description}</div>
                  <div class="td-m" style="font-size:12px;margin-top:2px">From: ${s.vendor} · ${sym}${EH.fmt(s.value||0)}</div>
                </div>
                <div style="text-align:right">
                  <div class="td-m" style="font-size:11px">Expected: ${EH.dateStr(s.expectedDate)}</div>
                  ${EH.badge(s.status||'Order Placed',EH.statusColor(s.status==='Received'||s.status==='Delivered'?'Completed':s.status==='In Transit'?'In Progress':'Open'))}
                </div>
              </div>
              <div class="pipe-stages">${stages.map(st=>`<div class="pipe-dot ${s.status===st?'cur':stages.indexOf(s.status)>stages.indexOf(st)?'done':''}" title="${st}"></div>`).join('')}</div>
              <div style="font-size:11px;color:var(--muted);margin:6px 0">${s.status} · ${stages.indexOf(s.status)+1}/${stages.length}</div>
              ${s.lastUpdate?`<div style="font-size:11px;color:var(--muted)">Last update: ${s.lastUpdate}</div>`:''}
              <div style="display:flex;gap:8px;margin-top:10px">
                <button class="btn btn-gold btn-sm" onclick="SCM.advanceShipment('${s.id}')">→ Update Status</button>
                <button class="btn btn-ghost btn-sm" onclick="SCM.editShipmentNote('${s.id}')">📝 Add Note</button>
                <button class="btn btn-red btn-sm" onclick="SCM.deleteShipment('${s.id}')">🗑</button>
              </div>
            </div>`).join('')
        }
        <div class="tbl-scroll"><table>
          <thead><tr><th>Tracking No</th><th>Description</th><th>Vendor</th><th>Value</th><th>Expected</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>${shipments.length===0
            ? `<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--muted)">No shipments tracked yet.</td></tr>`
            : shipments.map(s=>`<tr>
                <td class="td-b">${s.trackingNo}</td><td>${s.description}</td>
                <td class="td-m">${s.vendor}</td>
                <td class="td-gold">${sym}${EH.fmt(s.value||0)}</td>
                <td class="${s.expectedDate<EH.today()&&s.status!=='Delivered'&&s.status!=='Received'?'td-r':''}">${EH.dateStr(s.expectedDate)}</td>
                <td>${EH.badge(s.status||'Order Placed','blue')}</td>
                <td style="display:flex;gap:5px">
                  <button class="btn btn-ghost btn-sm" onclick="SCM.advanceShipment('${s.id}')">→</button>
                  <button class="btn btn-red btn-sm" onclick="SCM.deleteShipment('${s.id}')">🗑</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
      <div id="scmModal"></div>`;
  },
  openAddShipment() {
    const vendors = STRATIX_DB.getArr('scmVendors');
    document.getElementById('scmModal').innerHTML = EH.modal('shipModal','🚛 Track New Shipment',`
      <div class="form-grid">
        <div class="field"><label>Tracking / Reference No *</label><input id="sh_no" placeholder="TRK-12345 / PO Number / LR No"/></div>
        <div class="field"><label>Vendor / Supplier *</label>
          ${vendors.length>0
            ? `<select id="sh_vendor"><option value="">Select vendor</option>${vendors.map(v=>`<option>${escapeHTML(v.name)}</option>`).join('')}</select>`
            : `<input id="sh_vendor" placeholder="Vendor name"/>`}
        </div>
        <div class="field"><label>Description of Goods *</label><input id="sh_desc" placeholder="Steel rods, spare parts, chemicals..."/></div>
        <div class="field"><label>Shipment Value (${EH.sym()})</label><input type="number" id="sh_val" placeholder="50000"/></div>
        <div class="field"><label>Dispatch Date</label><input type="date" id="sh_disp" value="${EH.today()}"/></div>
        <div class="field"><label>Expected Arrival Date</label><input type="date" id="sh_exp" value="${new Date(Date.now()+5*86400000).toISOString().split('T')[0]}"/></div>
        <div class="field"><label>Transport Mode</label><select id="sh_mode"><option>Road (Truck)</option><option>Rail</option><option>Air</option><option>Ship/Sea</option><option>Courier</option></select></div>
        <div class="field"><label>Carrier / Transporter</label><input id="sh_carrier" placeholder="Transport company name / GR No"/></div>
        <div class="field form-full"><label>Notes</label><textarea id="sh_notes" rows="2" placeholder="Any special notes about this shipment..."></textarea></div>
      </div>
      <button class="btn btn-gold btn-full mt12" onclick="SCM.saveShipment()">💾 Start Tracking</button>
    `, true);
  },
  saveShipment() {
    const no = document.getElementById('sh_no')?.value.trim();
    const vendor = document.getElementById('sh_vendor')?.value.trim();
    const desc = document.getElementById('sh_desc')?.value.trim();
    if (!no||!vendor||!desc) { EH.toast('Fill required fields','warning'); return; }
    STRATIX_DB.push('scmShipments',{
      trackingNo:no, vendor, description:desc,
      value:+document.getElementById('sh_val')?.value||0,
      dispatchDate:document.getElementById('sh_disp')?.value,
      expectedDate:document.getElementById('sh_exp')?.value,
      mode:document.getElementById('sh_mode')?.value,
      carrier:document.getElementById('sh_carrier')?.value,
      notes:document.getElementById('sh_notes')?.value,
      status:'Order Placed',
    });
    document.getElementById('shipModal')?.remove();
    EH.toast('Shipment tracking started!');
    document.getElementById('scm_content').innerHTML = this.renderShipments();
  },
  advanceShipment(id) {
    const stages=['Order Placed','Dispatched by Vendor','In Transit','At Border/Checkpoint','Arrived at Warehouse','Quality Check','Received','Delivered'];
    const s = STRATIX_DB.getArr('scmShipments').find(s=>s.id===id);
    if (!s) return;
    const i = stages.indexOf(s.status||'Order Placed');
    if (i < stages.length-1) {
      STRATIX_DB.update('scmShipments',id,{status:stages[i+1],lastUpdate:`Updated to ${stages[i+1]} on ${EH.today()}`});
      if (stages[i+1]==='Received') EH.toast('Shipment received! Update inventory via ERP → Purchase Orders.','success');
      else EH.toast(`Status: ${stages[i+1]}`);
      document.getElementById('scm_content').innerHTML = this.renderShipments();
    }
  },
  editShipmentNote(id) {
    const note = 'Status updated on ' + new Date().toLocaleDateString('en-IN');
    if (note) { STRATIX_DB.update('scmShipments',id,{lastUpdate:note+' ('+EH.today()+')'}); document.getElementById('scm_content').innerHTML=this.renderShipments(); }
  },
  deleteShipment(id) {
    NOTIFY.show('Shipment removed','success'); STRATIX_DB.remove('scmShipments',id); document.getElementById('scm_content').innerHTML=this.renderShipments();
  },

  /* ── REORDER ALERTS ── */
  renderReorder() {
    const inv = STRATIX_DB.getArr('erpInventory');
    const sym = EH.sym();
    const critical = inv.filter(i=>(i.qty||0)===0);
    const low = inv.filter(i=>(i.qty||0)>0&&(i.qty||0)<=(i.reorderQty||5));
    const ok = inv.filter(i=>(i.qty||0)>(i.reorderQty||5));
    const renderGroup = (title, color, icon, items) => `
      <div style="margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;color:${color};text-transform:uppercase;letter-spacing:1.2px;margin-bottom:10px">${icon} ${title} — ${items.length} items</div>
        ${items.length===0
          ? `<p style="color:var(--muted);font-size:13px;padding:10px">No items in this category</p>`
          : `<div class="tbl-scroll"><table>
            <thead><tr><th>Item</th><th>Category</th><th>Current Stock</th><th>Reorder Level</th><th>Suggested Order</th><th>Action</th></tr></thead>
            <tbody>${items.map(i=>`<tr>
              <td class="td-b">${escapeHTML(i.name)}</td><td class="td-m">${i.category||'—'}</td>
              <td style="color:${(i.qty||0)===0?'var(--red)':'var(--orange)'};font-weight:700">${i.qty||0} ${i.unit||'pcs'}</td>
              <td class="td-m">${i.reorderQty||5} ${i.unit||'pcs'}</td>
              <td class="td-gold">${Math.max((i.reorderQty||5)*3-(i.qty||0),i.reorderQty||5)*2} ${i.unit||'pcs'}</td>
              <td><button class="btn btn-gold btn-sm" onclick="SCM.quickReorder('${i.id}')">📋 Create PO</button></td>
            </tr>`).join('')}</tbody>
          </table></div>`
        }
      </div>`;
    return `
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">
        <div class="kpi"><div class="kpi-lbl" style="color:var(--red)">Out of Stock</div><div class="kpi-val red">${critical.length}</div></div>
        <div class="kpi"><div class="kpi-lbl" style="color:var(--orange)">Low Stock</div><div class="kpi-val orange">${low.length}</div></div>
        <div class="kpi accent"><div class="kpi-lbl" style="color:var(--green)">Stock OK</div><div class="kpi-val green">${ok.length}</div></div>
      </div>
      ${renderGroup('Out of Stock — Order Immediately','var(--red)','🚨',critical)}
      ${renderGroup('Low Stock — Order Soon','var(--orange)','⚠️',low)}
      ${ok.length>0?renderGroup('Stock OK','var(--green)','✅',ok.slice(0,5)):''}`;
  },

  quickReorder(itemId) {
    const item = STRATIX_DB.getArr('erpInventory').find(i=>i.id===itemId);
    if (!item) return;
    const vendor = STRATIX_DB.getArr('scmVendors')[0]?.name || 'TBD';
    const orderQty = Math.max((item.reorderQty||5)*3-(item.qty||0),(item.reorderQty||5)*2);
    STRATIX_DB.push('erpPurchaseOrders',{
      poNo:`PO-${Date.now().toString().slice(-6)}`,
      supplier:vendor,
      date:EH.today(),
      expectedDate:new Date(Date.now()+7*86400000).toISOString().split('T')[0],
      items:[{itemId:item.id,name:item.name,qty:orderQty,unit:item.unit||'pcs',rate:item.costPrice||0,amount:(item.costPrice||0)*orderQty}],
      totalAmt:(item.costPrice||0)*orderQty,
      notes:`Auto-generated reorder for ${item.name}`,
      status:'Confirmed',
    });
    EH.toast(`Purchase Order created for ${item.name} (${orderQty} ${item.unit||'pcs'})`,'success');
    document.getElementById('scm_content').innerHTML = this.renderReorder();
  },

  /* ── DEMAND FORECASTING ── */
  renderForecast() {
    const sym = EH.sym();
    const inv = STRATIX_DB.getArr('erpInventory');
    const pos = STRATIX_DB.getArr('erpPurchaseOrders').filter(p=>p.status==='Received');
    const sos = STRATIX_DB.getArr('erpSalesOrders').filter(s=>s.status==='Completed');

    // Simple forecast based on past sales orders
    const itemDemand = {};
    sos.forEach(o=>{
      o.items?.forEach(l=>{
        if (!itemDemand[l.name]) itemDemand[l.name] = {name:l.name,totalQty:0,orders:0,totalValue:0};
        itemDemand[l.name].totalQty += l.qty;
        itemDemand[l.name].orders++;
        itemDemand[l.name].totalValue += l.amount;
      });
    });

    const forecastItems = Object.values(itemDemand).sort((a,b)=>b.totalValue-a.totalValue);
    const months = sos.length > 0 ? Math.max(1, Math.ceil(EH.daysAgo(sos[sos.length-1]?.createdAt||EH.today())/30)) : 1;

    return `
      <div class="card mb14">
        <div class="card-title">📈 Demand Forecast — Based on Sales Order History</div>
        ${forecastItems.length===0
          ? `<div class="empty"><div class="ei">📊</div><h3>No sales data yet</h3><p>Complete some sales orders to see demand forecast</p></div>`
          : `<div class="tbl-scroll"><table>
            <thead><tr><th>Item</th><th>Total Sold (All Time)</th><th>Avg/Month</th><th>Forecast Next Month</th><th>Forecast Next 3 Months</th><th>Current Stock</th><th>Reorder Needed?</th></tr></thead>
            <tbody>${forecastItems.map(f=>{
              const avgMonth = (f.totalQty/months).toFixed(1);
              const next1 = Math.ceil(+avgMonth * 1.1);
              const next3 = Math.ceil(+avgMonth * 3 * 1.1);
              const invItem = inv.find(i=>i.name===f.name);
              const currentStock = invItem?.qty||0;
              const needsReorder = currentStock < next1;
              return `<tr>
                <td class="td-b">${f.name}</td>
                <td>${f.totalQty} (${f.orders} orders)</td>
                <td>${avgMonth} units/month</td>
                <td class="td-gold">${next1} units</td>
                <td>${next3} units</td>
                <td class="${needsReorder?'td-r':''}">${currentStock}</td>
                <td>${needsReorder
                  ? `<span class="badge br">⚠️ Yes — order ${next1-currentStock}+ units</span>`
                  : `<span class="badge bg">✅ Stock OK</span>`}
                </td>
              </tr>`;
            }).join('')}</tbody>
          </table></div>`
        }
      </div>

      <div class="card">
        <div class="card-title">🏭 Supply Chain Health Score</div>
        <div class="form-grid">
          ${[
            ['Vendor Coverage',`${STRATIX_DB.getArr('scmVendors').filter(v=>v.status==='Active').length} active vendors`,'green'],
            ['Pending POs',`${STRATIX_DB.getArr('erpPurchaseOrders').filter(p=>p.status==='Confirmed').length} orders awaiting delivery`,'orange'],
            ['Delayed Shipments',`${STRATIX_DB.getArr('scmShipments').filter(s=>s.status!=='Delivered'&&s.expectedDate<EH.today()).length} overdue`,'red'],
            ['Low Stock Items',`${inv.filter(i=>(i.qty||0)<=(i.reorderQty||5)).length} items need reorder`,'orange'],
            ['Win Rate (CRM)',`${STRATIX_DB.getArr('crmDeals').filter(d=>d.status==='Won'||d.status==='Lost').length>0?(STRATIX_DB.getArr('crmDeals').filter(d=>d.status==='Won').length/STRATIX_DB.getArr('crmDeals').filter(d=>d.status==='Won'||d.status==='Lost').length*100).toFixed(0):0}% of closed deals won`,'green'],
            ['Open Sales Orders',`${STRATIX_DB.getArr('erpSalesOrders').filter(o=>o.status!=='Completed'&&o.status!=='Cancelled').length} in progress`,'blue'],
          ].map(([label,val,color])=>`
            <div class="stat-mini"><div class="stat-mini-lbl">${label}</div><div class="stat-mini-val" style="font-size:14px;color:var(--${color})">${val}</div></div>`).join('')}
        </div>
      </div>`;
  },
};
