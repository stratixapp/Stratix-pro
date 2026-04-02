/**
 * STRATIX v_services.js v1.0
 * Services / Contractor Vertical
 * Custom dashboard + Project tracker, client dues, site management
 */

// ── Services Dashboard ────────────────────────────────────────────────────────
function renderServicesDashboard() {
  const s      = STRATIX_AUTH.getSession();
  const sym    = STRATIX_DB.getSettings().currencySymbol || '₹';
  const now    = new Date();
  const td     = now.toISOString().split('T')[0];
  const mKey   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const txns   = STRATIX_DB.getArr('transactions');
  const projects = STRATIX_DB.getArr('svc_projects');
  const clients  = STRATIX_DB.getArr('clients');
  const reminders= STRATIX_DB.getArr('reminders');

  // KPIs
  const mRev   = txns.filter(t=>t.type==='revenue'&&t.date&&t.date.startsWith(mKey)).reduce((s,t)=>s+Number(t.amount),0);
  const mExp   = txns.filter(t=>t.type==='expense'&&t.date&&t.date.startsWith(mKey)).reduce((s,t)=>s+Number(t.amount),0);
  const mProfit= mRev - mExp;
  const totalDue = clients.reduce((s,c)=>s+Number(c.outstanding||0),0);
  const activeProjects = projects.filter(p=>p.status==='active').length;
  const completedThisMth = projects.filter(p=>p.status==='completed'&&p.completedDate&&p.completedDate.startsWith(mKey)).length;
  const overdueReminders = reminders.filter(r=>!r.done&&r.date&&r.date<td).length;

  // Pipeline value
  const pipelineValue = projects.filter(p=>p.status==='active').reduce((s,p)=>s+Number(p.value||0),0);

  // Project stages funnel
  const stageCount = { proposal:0, active:0, completed:0, on_hold:0 };
  projects.forEach(p=>{ if(stageCount[p.status]!==undefined) stageCount[p.status]++; });

  // Last 6 months
  const months6=[];
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const mk=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const mn=d.toLocaleString('en-IN',{month:'short'});
    const rev=txns.filter(t=>t.type==='revenue'&&t.date&&t.date.startsWith(mk)).reduce((s,t)=>s+Number(t.amount),0);
    const exp=txns.filter(t=>t.type==='expense'&&t.date&&t.date.startsWith(mk)).reduce((s,t)=>s+Number(t.amount),0);
    months6.push({mn,rev,exp});
  }
  const maxBar=Math.max(...months6.map(m=>Math.max(m.rev,m.exp)),1);

  document.getElementById('sectionContent').innerHTML = `
  <div class="sec">
    ${VERTICAL.bannerHTML()}

    <div class="sec-head">
      <div>
        <div class="sec-title">Good ${_greet()}, ${escapeHTML(s.name)} 👋</div>
        <div class="sec-sub">${escapeHTML(STRATIX_DB.getSettings().businessName||s.biz)} · ${now.toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long'})}</div>
      </div>
      <div class="head-actions">
        <button class="btn btn-vx" onclick="openProjectModal()">🔧 New Project</button>
        <button class="btn btn-outline" onclick="APP.navigate('invoiceaging')">💰 Invoices</button>
        <button class="btn btn-outline" onclick="APP.navigate('crm')">🤝 Clients</button>
      </div>
    </div>

    <!-- KPIs -->
    <div class="kpi-grid">
      <div class="kpi accent" style="cursor:pointer" onclick="openProjectModal()">
        <div class="kpi-ico">🔧</div>
        <div class="kpi-lbl">Active Projects</div>
        <div class="kpi-val vx-accent">${activeProjects}</div>
        <div class="kpi-trend muted">${_fmt(pipelineValue,sym)} pipeline value</div>
      </div>
      <div class="kpi" style="cursor:pointer" onclick="APP.navigate('datamanager')">
        <div class="kpi-ico">💰</div>
        <div class="kpi-lbl">${VERTICAL.kpiLabel('revenue')} (Month)</div>
        <div class="kpi-val">${_fmt(mRev,sym)}</div>
        <div class="kpi-trend ${mProfit>=0?'up':'down'}">${mProfit>=0?'▲':'▼'} Profit: ${_fmt(Math.abs(mProfit),sym)}</div>
      </div>
      <div class="kpi" style="cursor:pointer" onclick="APP.navigate('invoiceaging')">
        <div class="kpi-ico">⏳</div>
        <div class="kpi-lbl">${VERTICAL.kpiLabel('pending')}</div>
        <div class="kpi-val ${totalDue>0?'gold':''}">${_fmt(totalDue,sym)}</div>
        <div class="kpi-trend ${totalDue>0?'down':'up'}">${totalDue>0?`${clients.filter(c=>c.outstanding>0).length} clients pending`:'All invoices paid'}</div>
      </div>
      <div class="kpi" style="cursor:pointer" onclick="APP.navigate('reminders')">
        <div class="kpi-ico">🔔</div>
        <div class="kpi-lbl">Overdue Follow-ups</div>
        <div class="kpi-val ${overdueReminders>0?'red':''}">${overdueReminders}</div>
        <div class="kpi-trend muted">${completedThisMth} projects completed this month</div>
      </div>
    </div>

    <!-- Row 2: Projects + Client dues + Upcoming reminders -->
    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;margin-bottom:18px">

      <!-- Active Projects -->
      <div class="card">
        <div class="card-title">🔧 Project Pipeline
          <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="openProjectModal()">+ New Project</button>
        </div>
        ${projects.length===0 ? `<div style="text-align:center;padding:24px;color:var(--muted)">No projects yet.<br/><button class="btn btn-vx btn-sm" style="margin-top:8px" onclick="openProjectModal()">Add First Project</button></div>` : `
        <div style="display:grid;gap:8px;max-height:280px;overflow-y:auto">
        ${[...projects].sort((a,b)=>{const ord={active:0,proposal:1,on_hold:2,completed:3};return (ord[a.status]||0)-(ord[b.status]||0);}).map(p=>{
          const pct = Number(p.budget)>0 ? Math.min(100,Math.round(Number(p.spent||0)/Number(p.budget)*100)) : 0;
          const daysLeft = p.dueDate ? Math.ceil((new Date(p.dueDate)-now)/(864e5)) : null;
          const stColor = {active:'var(--green)',proposal:'var(--blue)',on_hold:'var(--orange)',completed:'var(--muted)'}[p.status]||'var(--muted)';
          return `<div style="background:var(--s2);border-radius:10px;padding:13px;border:1px solid ${p.status==='active'?'rgba(168,85,247,.2)':'var(--b1)'}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
              <div>
                <div style="font-size:13px;font-weight:700">${escapeHTML(p.name)}</div>
                <div style="font-size:11px;color:var(--muted)">${escapeHTML(p.client||'—')} ${p.dueDate?`· Due: ${p.dueDate}`:''}</div>
              </div>
              <div style="display:flex;gap:5px;align-items:center;flex-shrink:0">
                ${daysLeft!==null&&p.status==='active'?`<span style="font-size:9px;font-weight:700;color:${daysLeft<0?'var(--red)':daysLeft<7?'var(--orange)':'var(--muted)'}">${daysLeft<0?`${Math.abs(daysLeft)}d overdue`:`${daysLeft}d left`}</span>`:''}
                <span style="font-size:9px;font-weight:700;color:${stColor};background:rgba(0,0,0,.2);padding:2px 7px;border-radius:4px">${p.status}</span>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
              <span>Budget: <strong>${_fmt(p.budget||0,'₹')}</strong></span>
              <span style="color:${pct>90?'var(--red)':'var(--muted)'}">Spent: ${_fmt(p.spent||0,'₹')} (${pct}%)</span>
            </div>
            <div class="prog"><div class="prog-fill ${pct>90?'pr':'pb'}" style="width:${pct}%"></div></div>
            <div style="display:flex;gap:6px;margin-top:8px">
              <button class="btn btn-ghost btn-sm" onclick="editProject('${p.id}')">✏️ Edit</button>
              ${p.status==='active'?`<button class="btn btn-green btn-sm" onclick="completeProject('${p.id}')">✅ Mark Done</button>`:''}
              <button class="del-btn" onclick="deleteProject('${p.id}')">🗑</button>
            </div>
          </div>`;
        }).join('')}
        </div>`}
      </div>

      <!-- Client Dues -->
      <div class="card">
        <div class="card-title">💰 Client Dues
          <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="APP.navigate('invoiceaging')">All →</button>
        </div>
        ${clients.length===0 ? `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">No clients<br/><button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="APP.navigate('crm')">Add Client</button></div>` :
          clients.filter(c=>Number(c.outstanding)>0).length===0 ?
          `<div style="text-align:center;padding:20px;color:var(--green);font-size:13px">✅ All invoices paid!</div>` :
          clients.filter(c=>Number(c.outstanding)>0).map(c=>`
          <div style="padding:10px;background:var(--s2);border-radius:8px;margin-bottom:7px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:12px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:110px">${escapeHTML(c.name)}</span>
              <span style="font-size:12px;font-weight:700;color:var(--red);flex-shrink:0">${_fmt(c.outstanding,'₹')}</span>
            </div>
            <div style="font-size:10px;color:var(--muted)">${c.invoices||0} invoices · Risk: ${c.risk||'—'}</div>
          </div>`).join('')
        }
        <div style="border-top:1px solid var(--b1);padding-top:10px;margin-top:4px">
          <div style="font-size:11px;color:var(--muted)">Total Outstanding</div>
          <div style="font-size:18px;font-weight:800;color:${totalDue>0?'var(--red)':'var(--green)'};">${_fmt(totalDue,'₹')}</div>
        </div>
      </div>

      <!-- Reminders + Follow-ups -->
      <div class="card">
        <div class="card-title">🔔 Follow-ups
          <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="APP.navigate('reminders')">All →</button>
        </div>
        ${reminders.length===0 ? `<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">No reminders<br/><button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="APP.navigate('reminders')">Add Reminder</button></div>` :
          reminders.filter(r=>!r.done).slice(0,5).map(r=>{
            const isOverdue = r.date && r.date < td;
            const isToday   = r.date === td;
            return `<div style="padding:9px 10px;background:var(--s2);border-radius:8px;margin-bottom:6px;border-left:3px solid ${isOverdue?'var(--red)':isToday?'var(--gold)':'var(--b2)'}">
              <div style="font-size:12px;font-weight:700">${escapeHTML(r.title||r.text||'—')}</div>
              <div style="font-size:10px;color:${isOverdue?'var(--red)':isToday?'var(--gold)':'var(--muted)'};margin-top:2px">${isOverdue?'⚠️ Overdue':isToday?'📅 Today':r.date||'—'}</div>
            </div>`;
          }).join('')
        }
      </div>
    </div>

    <!-- Chart + Project stage summary -->
    <div class="charts-row" style="margin-bottom:18px">
      <div class="chart-card">
        <div class="chart-hd">
          <h3>📊 Revenue vs Cost — Last 6 Months</h3>
        </div>
        <div class="bar-chart">
          ${months6.map(m=>`
          <div class="bar-grp">
            <div class="bars">
              <div class="bar rev" style="height:${Math.round((m.rev/maxBar)*120)}px" title="Revenue: ${_fmt(m.rev,'₹')}"></div>
              <div class="bar exp" style="height:${Math.round((m.exp/maxBar)*120)}px" title="Cost: ${_fmt(m.exp,'₹')}"></div>
            </div>
            <div class="bar-lbl">${m.mn}</div>
          </div>`).join('')}
        </div>
        <div class="chart-legend">
          <div class="leg rev">Project Revenue</div>
          <div class="leg exp">Project Cost</div>
        </div>
      </div>

      <!-- Project stage breakdown -->
      <div class="chart-card">
        <div class="chart-hd"><h3>📊 Project Breakdown</h3></div>
        <div style="display:grid;gap:12px;padding:10px 0">
          ${[
            {label:'Active Projects',    count:stageCount.active,    color:'var(--green)'},
            {label:'Proposals',          count:stageCount.proposal,  color:'var(--blue)'},
            {label:'On Hold',            count:stageCount.on_hold,   color:'var(--orange)'},
            {label:'Completed',          count:stageCount.completed, color:'var(--muted)'}
          ].map(item=>`
          <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <span style="font-size:12px;font-weight:600">${item.label}</span>
              <span style="font-size:13px;font-weight:800;color:${item.color}">${item.count}</span>
            </div>
            <div class="prog"><div class="prog-fill" style="width:${projects.length>0?Math.round((item.count/projects.length)*100):0}%;background:${item.color}"></div></div>
          </div>`).join('')}
        </div>
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--b1)">
          <div style="font-size:11px;color:var(--muted)">Total Pipeline Value</div>
          <div style="font-size:20px;font-weight:800;color:var(--vx,var(--gold))">${_fmt(pipelineValue,'₹')}</div>
        </div>
      </div>
    </div>

    ${VERTICAL.quickActionsHTML()}
  </div>`;
}

// ── Project Modal ─────────────────────────────────────────────────────────────
function openProjectModal(editId) {
  const existing = editId ? STRATIX_DB.getArr('svc_projects').find(p=>p.id===editId) : null;
  const clients = STRATIX_DB.getArr('clients');
  const html = `
  <div class="overlay" id="svcModal" onclick="if(event.target===this)closeSvcModal()">
    <div class="modal" style="max-width:580px">
      <div class="modal-hd">
        <div class="modal-title">🔧 ${editId?'Edit':'New'} Project</div>
        <button class="modal-close" onclick="closeSvcModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="field form-full"><label>Project Name *</label><input id="prjName" value="${escapeHTML(existing?.name||'')}" placeholder="e.g., Office Renovation — Sharma Ltd"/></div>
          <div class="field"><label>Client *</label>
            <input id="prjClient" value="${escapeHTML(existing?.client||'')}" placeholder="Client name" list="prjClientList"/>
            <datalist id="prjClientList">${clients.map(c=>`<option value="${escapeHTML(c.name)}">`).join('')}</datalist>
          </div>
          <div class="field"><label>Project Value (₹)</label><input type="number" id="prjValue" value="${existing?.value||''}" placeholder="500000"/></div>
          <div class="field"><label>Budget / Cost Estimate (₹)</label><input type="number" id="prjBudget" value="${existing?.budget||''}" placeholder="350000"/></div>
          <div class="field"><label>Spent So Far (₹)</label><input type="number" id="prjSpent" value="${existing?.spent||0}" placeholder="0"/></div>
          <div class="field"><label>Status</label>
            <select id="prjStatus">
              <option value="proposal"  ${(!existing||existing.status==='proposal')?'selected':''}>📋 Proposal / Negotiation</option>
              <option value="active"    ${existing?.status==='active'?'selected':''}>🔧 Active / In Progress</option>
              <option value="on_hold"   ${existing?.status==='on_hold'?'selected':''}>⏸️ On Hold</option>
              <option value="completed" ${existing?.status==='completed'?'selected':''}>✅ Completed</option>
            </select>
          </div>
          <div class="field"><label>Start Date</label><input type="date" id="prjStart" value="${existing?.startDate||new Date().toISOString().split('T')[0]}"/></div>
          <div class="field"><label>Due / Completion Date</label><input type="date" id="prjDue" value="${existing?.dueDate||''}"/></div>
          <div class="field form-full"><label>Description / Scope of Work</label><textarea id="prjDesc" rows="3" placeholder="Brief description of work scope...">${escapeHTML(existing?.desc||'')}</textarea></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:4px">
          <button class="btn btn-ghost" style="flex:1" onclick="closeSvcModal()">Cancel</button>
          <button class="btn btn-vx" style="flex:2" onclick="saveProject('${editId||''}')">${editId?'💾 Save Changes':'🔧 Add Project'}</button>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function saveProject(editId) {
  const name   = document.getElementById('prjName').value.trim();
  const client = document.getElementById('prjClient').value.trim();
  if (!name)   return NOTIFY.show('Enter project name','error');
  if (!client) return NOTIFY.show('Enter client name','error');
  const item = {
    name, client,
    value:      parseFloat(document.getElementById('prjValue').value)||0,
    budget:     parseFloat(document.getElementById('prjBudget').value)||0,
    spent:      parseFloat(document.getElementById('prjSpent').value)||0,
    status:     document.getElementById('prjStatus').value,
    startDate:  document.getElementById('prjStart').value,
    dueDate:    document.getElementById('prjDue').value,
    desc:       document.getElementById('prjDesc').value.trim()
  };
  if (editId) {
    STRATIX_DB.update('svc_projects', editId, item);
    NOTIFY.show('✅ Project updated!','success');
  } else {
    STRATIX_DB.push('svc_projects', item);
    NOTIFY.show('🔧 Project added!','success');
  }
  closeSvcModal();
  if (APP.currentSection==='dashboard') renderServicesDashboard();
}

function editProject(id) {
  closeSvcModal();
  setTimeout(()=>openProjectModal(id), 100);
}

function completeProject(id) {
  STRATIX_DB.update('svc_projects', id, { status:'completed', completedDate:new Date().toISOString().split('T')[0] });
  NOTIFY.show('✅ Project marked complete!','success');
  if (APP.currentSection==='dashboard') renderServicesDashboard();
}

function deleteProject(id) {
  STRATIX_DB.remove('svc_projects', id);
  NOTIFY.show('Project removed','info',1500);
  if (APP.currentSection==='dashboard') renderServicesDashboard();
}

function closeSvcModal() {
  const m = document.getElementById('svcModal'); if(m) m.remove();
}

// ── Services Demo Data ────────────────────────────────────────────────────────
function seedServicesDemo() {
  // DEMO SEED DISABLED — users start with a clean slate and add their own real data
  return;
}

// _fmt() and _greet() are defined in vertical.js (shared helpers — do not redefine here)
