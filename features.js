/**
 * STRATIX Features v3.0
 * Salary & Payroll, Bank Connect, WhatsApp, AI Advisor, GST, Fleet, Loan, Trip P&L, Invoice Aging, Early Warning, Order Tracker
 */

// ── SALARY / PAYROLL ───────────────────────────────────────────────────────
function renderSalary() {
  const employees = STRATIX_DB.getArr('employees');
  const payslips = STRATIX_DB.getArr('payslips');
  const sym = STRATIX_DB.getSettings().currencySymbol || '₹';
  const currentMonth = new Date().toISOString().slice(0,7);
  const totalPayroll = employees.reduce((s,e)=>s+calcNetSalary(e).netPay,0);

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div>
          <h1 class="sec-title">Salary & Payroll</h1>
          <p class="sec-sub">Complete payroll with PF, ESI, TDS auto-calculation</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-gold" onclick="FEAT.openAddEmployee()">+ Add Employee</button>
          <button class="btn btn-ghost" onclick="FEAT.runPayroll()">Run Monthly Payroll →</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-lbl">Total Employees</div><div class="kpi-val">${employees.length}</div><div class="kpi-icon">👤</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Monthly Payroll</div><div class="kpi-val">${sym}${fmtN(totalPayroll)}</div><div class="kpi-icon">💰</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Total PF Liability</div><div class="kpi-val">${sym}${fmtN(employees.reduce((s,e)=>s+calcNetSalary(e).pfEmployee+calcNetSalary(e).pfEmployer,0))}</div><div class="kpi-icon">🏦</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Total ESI Liability</div><div class="kpi-val">${sym}${fmtN(employees.reduce((s,e)=>s+calcNetSalary(e).esiEmployee+calcNetSalary(e).esiEmployer,0))}</div><div class="kpi-icon">🏥</div></div>
      </div>

      ${employees.length === 0 ? `
        <div class="card" style="text-align:center;padding:60px 20px">
          <div style="font-size:48px;margin-bottom:14px">👥</div>
          <h3 style="color:var(--text2);margin-bottom:8px">No Employees Added</h3>
          <p style="color:var(--muted);max-width:320px;margin:0 auto 20px">Add your first employee to start managing payroll with automatic PF, ESI & TDS calculations.</p>
          <button class="btn btn-gold" onclick="FEAT.openAddEmployee()">+ Add First Employee</button>
        </div>
      ` : `
        <div class="table-wrap card" style="padding:0">
          <div class="tbl-head"><span class="tbl-title">Employee Payroll Summary — ${new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})}</span></div>
          <table>
            <thead>
              <tr>
                <th>Employee</th><th>Department</th><th>Basic</th><th>Gross</th>
                <th>PF (EE)</th><th>ESI (EE)</th><th>TDS</th><th>Net Pay</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${employees.map(e=>{
                const s = calcNetSalary(e);
                return `<tr>
                  <td><div class="td-bold">${e.name}</div><div style="font-size:11px;color:var(--muted)">${escapeHTML(e.designation||'—')}</div></td>
                  <td>${e.department||'—'}</td>
                  <td>${sym}${fmtN(e.basic)}</td>
                  <td>${sym}${fmtN(s.gross)}</td>
                  <td class="td-red">${sym}${fmtN(s.pfEmployee)}</td>
                  <td class="td-red">${sym}${fmtN(s.esiEmployee)}</td>
                  <td class="td-red">${sym}${fmtN(s.tds)}</td>
                  <td class="td-gold fw-700">${sym}${fmtN(s.netPay)}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" onclick="FEAT.generatePayslip('${e.id}')">Payslip</button>
                    <button class="btn btn-red btn-sm" onclick="FEAT.deleteEmployee('${e.id}')">🗑</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="card mt-16">
          <div class="card-title">📊 Payroll Cost Breakdown</div>
          <div class="form-grid">
            ${(() => {
              const totals = employees.reduce((acc,e)=>{
                const s = calcNetSalary(e);
                acc.gross += s.gross;
                acc.pfEE += s.pfEmployee; acc.pfER += s.pfEmployer;
                acc.esiEE += s.esiEmployee; acc.esiER += s.esiEmployer;
                acc.tds += s.tds; acc.net += s.netPay;
                return acc;
              },{gross:0,pfEE:0,pfER:0,esiEE:0,esiER:0,tds:0,net:0});
              const totalCTC = totals.gross + totals.pfER + totals.esiER;
              return `
                <div class="stat-mini"><div class="stat-mini-lbl">Gross Salaries</div><div class="stat-mini-val">${sym}${fmtN(totals.gross)}</div></div>
                <div class="stat-mini"><div class="stat-mini-lbl">PF (Employer Share)</div><div class="stat-mini-val text-red">${sym}${fmtN(totals.pfER)}</div></div>
                <div class="stat-mini"><div class="stat-mini-lbl">ESI (Employer Share)</div><div class="stat-mini-val text-red">${sym}${fmtN(totals.esiER)}</div></div>
                <div class="stat-mini"><div class="stat-mini-lbl">Total CTC</div><div class="stat-mini-val text-gold">${sym}${fmtN(totalCTC)}</div></div>
                <div class="stat-mini"><div class="stat-mini-lbl">Total TDS to Deposit</div><div class="stat-mini-val text-red">${sym}${fmtN(totals.tds)}</div></div>
                <div class="stat-mini"><div class="stat-mini-lbl">Net Payout</div><div class="stat-mini-val text-green">${sym}${fmtN(totals.net)}</div></div>
              `;
            })()}
          </div>
          <div class="alert alert-gold mt-12">
            <span class="alert-icon">💡</span>
            <div>PF due by 15th of next month. ESI due by 21st. TDS due by 7th of next month.</div>
          </div>
        </div>
      `}

      <div id="salaryModal"></div>
      <div id="payslipModal"></div>
    </div>`;
}

function calcNetSalary(e) {
  const basic = e.basic || 0;
  const hra = e.hra || Math.round(basic * 0.4);
  const da = e.da || Math.round(basic * 0.1);
  const special = e.special || 0;
  const otherAllow = e.otherAllow || 0;
  const gross = basic + hra + da + special + otherAllow;

  // PF: 12% of basic (employee) + 12% employer — capped at ₹15,000 basic
  const pfEmployee = basic <= 15000 ? Math.round(Math.round(basic * 0.12 * 100) / 100) : 1800;
  const pfEmployer = basic <= 15000 ? Math.round(Math.round(basic * 0.12 * 100) / 100) : 1800;

  // ESI: 0.75% employee, 3.25% employer — only if gross <= ₹21,000/month
  const esiEmployee = gross <= 21000 ? Math.round(Math.round(gross * 0.0075 * 100) / 100) : 0;
  const esiEmployer = gross <= 21000 ? Math.round(Math.round(gross * 0.0325 * 100) / 100) : 0;

  // Professional Tax — state-wise slabs (FY 2025-26)
  const ptState = (STRATIX_DB.getSettings().state || 'Maharashtra');
  let pt = 0;
  if (['Maharashtra','Karnataka','Andhra Pradesh','Telangana','Tamil Nadu','West Bengal','Gujarat','Madhya Pradesh'].includes(ptState)) {
    if (ptState === 'Maharashtra') pt = gross > 10000 ? 200 : (gross > 7500 ? 175 : 0);
    else if (ptState === 'Karnataka') pt = gross >= 25000 ? 200 : gross >= 15000 ? 150 : gross >= 10000 ? 100 : 0;
    else if (ptState === 'Andhra Pradesh' || ptState === 'Telangana') pt = gross >= 20001 ? 200 : gross >= 15001 ? 150 : gross >= 10001 ? 100 : gross >= 5001 ? 60 : 0;
    else if (ptState === 'Tamil Nadu') pt = gross >= 21000 ? 208 : gross >= 15001 ? 173 : gross >= 10001 ? 130 : gross >= 7501 ? 86 : 0;
    else if (ptState === 'West Bengal') pt = gross >= 40001 ? 200 : gross >= 25001 ? 150 : gross >= 15001 ? 110 : gross >= 10001 ? 80 : 0;
    else if (ptState === 'Gujarat' || ptState === 'Madhya Pradesh') pt = gross >= 12000 ? 200 : 0;
    else pt = gross > 10000 ? 200 : 0;
  }

  // TDS — New Tax Regime FY 2025-26 (Budget 2025)
  // Rebate u/s 87A: Zero tax for annual income up to ₹12,00,000 (new regime)
  const annualGross = gross * 12;
  let annualTax = 0;
  if (annualGross > 400000) {
    if (annualGross <= 800000)       annualTax = (annualGross - 400000) * 0.05;
    else if (annualGross <= 1200000) annualTax = 20000 + (annualGross - 800000) * 0.10;
    else if (annualGross <= 1600000) annualTax = 60000 + (annualGross - 1200000) * 0.15;
    else if (annualGross <= 2000000) annualTax = 120000 + (annualGross - 1600000) * 0.20;
    else if (annualGross <= 2400000) annualTax = 200000 + (annualGross - 2000000) * 0.25;
    else                              annualTax = 300000 + (annualGross - 2400000) * 0.30;
    // Rebate u/s 87A — zero tax if annual income <= ₹12 Lakh (Budget 2025)
    if (annualGross <= 1200000) annualTax = 0;
  }
  // 4% Health & Education Cess
  annualTax = Math.round(annualTax * 1.04);
  const tds = Math.round(annualTax / 12);

  const totalDeductions = pfEmployee + esiEmployee + pt + tds;
  const netPay = gross - totalDeductions;

  return { gross, basic, hra, da, special, otherAllow, pfEmployee, pfEmployer, esiEmployee, esiEmployer, pt, tds, totalDeductions, netPay };
}

const FEAT = {
  openAddEmployee() {
    const modal = document.getElementById('salaryModal');
    modal.innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)this.innerHTML=''">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Add Employee</h3>
            <button class="modal-close" onclick="document.getElementById('salaryModal').innerHTML=''">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field"><label>Full Name</label><input id="empName" placeholder="Ramesh Kumar"/></div>
              <div class="field"><label>Employee ID</label><input id="empId" placeholder="EMP001"/></div>
              <div class="field"><label>Designation</label><input id="empDesig" placeholder="Driver / Manager / Worker"/></div>
              <div class="field"><label>Department</label><input id="empDept" placeholder="Operations / Admin / Finance"/></div>
              <div class="field"><label>Date of Joining</label><input type="date" id="empDOJ" value="${new Date().toISOString().split('T')[0]}"/></div>
              <div class="field"><label>PAN Number</label><input id="empPAN" placeholder="ABCDE1234F"/></div>
              <div class="field"><label>Aadhaar (last 4)</label><input id="empAadhaar" placeholder="1234" maxlength="4"/></div>
              <div class="field"><label>Bank Account No.</label><input id="empBank" placeholder="Account number"/></div>
            </div>
            <div class="divider-line mt-16"></div>
            <div style="font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Salary Structure</div>
            <div class="form-grid-3">
              <div class="field"><label>Basic Salary</label><input type="number" id="empBasic" placeholder="15000" oninput="FEAT.previewSalary()"/></div>
              <div class="field"><label>HRA</label><input type="number" id="empHRA" placeholder="Auto (40% of basic)"/></div>
              <div class="field"><label>DA</label><input type="number" id="empDA" placeholder="Auto (10% of basic)"/></div>
              <div class="field"><label>Special Allowance</label><input type="number" id="empSpecial" placeholder="0"/></div>
              <div class="field"><label>Other Allowances</label><input type="number" id="empOther" placeholder="0"/></div>
            </div>
            <div id="salaryPreview" class="card mt-12" style="padding:14px;background:var(--surface2)"></div>
            <button class="btn btn-gold btn-full mt-16" onclick="FEAT.saveEmployee()">Save Employee</button>
          </div>
        </div>
      </div>`;
  },

  previewSalary() {
    const basic = +document.getElementById('empBasic').value||0;
    const hra = +document.getElementById('empHRA').value||Math.round(basic*0.4);
    const da = +document.getElementById('empDA').value||Math.round(basic*0.1);
    const special = +document.getElementById('empSpecial').value||0;
    const other = +document.getElementById('empOther').value||0;
    const s = calcNetSalary({basic,hra,da,special,otherAllow:other});
    const sym = STRATIX_DB.getSettings().currencySymbol||'₹';
    document.getElementById('salaryPreview').innerHTML = `
      <div class="gap-row" style="gap:20px;font-size:13px">
        <div><div class="text-muted fs-12">Gross</div><div class="fw-700">${sym}${fmtN(s.gross)}</div></div>
        <div><div class="text-muted fs-12">PF (EE)</div><div class="fw-700 text-red">-${sym}${fmtN(s.pfEmployee)}</div></div>
        <div><div class="text-muted fs-12">ESI (EE)</div><div class="fw-700 text-red">-${sym}${fmtN(s.esiEmployee)}</div></div>
        <div><div class="text-muted fs-12">TDS</div><div class="fw-700 text-red">-${sym}${fmtN(s.tds)}</div></div>
        <div><div class="text-muted fs-12">Net Pay</div><div class="fw-700 text-green">${sym}${fmtN(s.netPay)}</div></div>
      </div>`;
  },

  saveEmployee() {
    const name = document.getElementById('empName').value.trim();
    if (!name) { NOTIFY.show('Please enter employee name','warning'); return; }
    const basic = +document.getElementById('empBasic').value||0;
    STRATIX_DB.push('employees', {
      name, empId: document.getElementById('empId').value,
      designation: document.getElementById('empDesig').value,
      department: document.getElementById('empDept').value,
      doj: document.getElementById('empDOJ').value,
      pan: document.getElementById('empPAN').value,
      aadhaar: document.getElementById('empAadhaar').value,
      bank: document.getElementById('empBank').value,
      basic, hra: +document.getElementById('empHRA').value||0,
      da: +document.getElementById('empDA').value||0,
      special: +document.getElementById('empSpecial').value||0,
      otherAllow: +document.getElementById('empOther').value||0
    });
    document.getElementById('salaryModal').innerHTML = '';
    NOTIFY.show('Employee added successfully!', 'success');
    renderSalary();
  },

  deleteEmployee(id) {
    const bar = document.getElementById('empDelBar')||document.createElement('div');
    bar.id='empDelBar';
    bar.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;background:#F8FAFC;border:1.5px solid #e84040;border-radius:14px;padding:14px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.6);font-family:var(--font);font-size:13px;color:#0F172A;';
    bar.innerHTML='<span>Remove this employee?</span><button onclick="STRATIX_DB.remove(\'employees\',\''+id+'\');renderSalary();document.getElementById(\'empDelBar\').remove();" style="background:#e84040;border:none;border-radius:8px;padding:7px 14px;color:#fff;font-weight:700;cursor:pointer;font-family:var(--font)">Remove</button><button onclick="document.getElementById(\'empDelBar\').remove();" style="background:#2a3550;border:none;border-radius:8px;padding:7px 14px;color:#0F172A;cursor:pointer;font-family:var(--font)">Cancel</button>';
    document.body.appendChild(bar);
    setTimeout(()=>{const b=document.getElementById('empDelBar');if(b)b.remove();},4000);
  },

  generatePayslip(id) {
    const emp = STRATIX_DB.getArr('employees').find(e=>e.id===id);
    if (!emp) return;
    const sal = calcNetSalary(emp);
    const cfg = STRATIX_DB.getSettings();
    const sym = cfg.currencySymbol || '₹';
    const now = new Date();
    const month = now.toLocaleString('en-IN',{month:'long',year:'numeric'});
    const ctc = sal.gross + sal.pfEmployer + sal.esiEmployer;

    // Open a clean white popup — no dark app theme interference
    const win = window.open('', '_blank', 'width=860,height=920');
    if (!win) { NOTIFY.show('Popup blocked! Allow pop-ups to generate payslips.','warning',5000); return; }

    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>Payslip — ${escapeHTML(emp.name)} — ${month}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  @media print {
    body { padding: 0 !important; background: #fff !important; }
    .no-print { display: none !important; }
    .ps-wrap { box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
  }
  body { font-family: 'Inter', Arial, sans-serif; background: #f0f2f5; padding: 24px 16px; color: #1a1a2e; }
  .ps-wrap { background: #fff; max-width: 760px; margin: 0 auto; border-radius: 16px; box-shadow: 0 8px 48px rgba(0,0,0,.15); overflow: hidden; }

  /* ── Header band ── */
  .ps-hdr { background: linear-gradient(135deg,#111827 0%,#1e293b 100%); padding: 28px 36px; display: flex; justify-content: space-between; align-items: flex-start; }
  .ps-co { font-size: 20px; font-weight: 800; color: #fff; margin-bottom: 5px; letter-spacing: -.3px; }
  .ps-co-meta { font-size: 12px; color: rgba(255,255,255,.6); line-height: 1.8; }
  .ps-logo { width: 46px; height: 46px; background: linear-gradient(135deg,#2563EB,#1D4ED8); border-radius: 13px; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; color: #111; flex-shrink: 0; }

  /* ── Gold title bar ── */
  .ps-bar { background: #2563EB; padding: 12px 36px; display: flex; justify-content: space-between; align-items: center; }
  .ps-bar-title { font-size: 15px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #111; }
  .ps-bar-period { font-size: 13px; font-weight: 700; color: #111; }

  /* ── Body ── */
  .ps-body { padding: 28px 36px; }

  /* Employee info grid */
  .ps-emp { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; background: #f8f9fb; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; margin-bottom: 24px; }
  .ps-emp-cell { padding: 13px 16px; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; }
  .ps-emp-cell:nth-child(3n) { border-right: none; }
  .ps-emp-lbl { font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: .6px; margin-bottom: 4px; }
  .ps-emp-val { font-size: 14px; font-weight: 700; color: #1a1a2e; }

  /* ── Earnings / Deductions columns ── */
  .ps-ed { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
  .ps-col-hdr { font-size: 12px; font-weight: 800; color: #fff; background: #1a1a2e; padding: 10px 14px; border-radius: 8px 8px 0 0; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 0; }
  .ps-col-body { border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden; }
  .ps-row { display: flex; justify-content: space-between; padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f3f4f6; }
  .ps-row:last-child { border-bottom: none; }
  .ps-row-lbl { color: #4b5563; }
  .ps-row-val { font-weight: 600; color: #1a1a2e; }
  .ps-subtotal { display: flex; justify-content: space-between; padding: 11px 14px; font-weight: 800; font-size: 14px; background: #f3f4f6; border-top: 2px solid #1a1a2e; }

  /* ── Net Pay ── */
  .ps-net { background: linear-gradient(135deg,#1a1a2e,#2d3748); border-radius: 14px; padding: 22px 28px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .ps-net-left .ps-net-lbl { font-size: 13px; font-weight: 700; color: rgba(255,255,255,.7); margin-bottom: 4px; }
  .ps-net-left .ps-net-words { font-size: 11px; color: rgba(255,255,255,.5); font-style: italic; max-width: 360px; line-height: 1.5; }
  .ps-net-val { font-size: 32px; font-weight: 800; color: #2563EB; flex-shrink: 0; margin-left: 20px; }

  /* ── CTC breakdown ── */
  .ps-ctc { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 18px; margin-bottom: 24px; display: flex; gap: 24px; flex-wrap: wrap; font-size: 12px; color: #555; }
  .ps-ctc strong { color: #1a1a2e; }

  /* ── Signatures ── */
  .ps-sigs { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  .ps-sig-line { border-bottom: 1.5px dashed #bbb; height: 52px; margin-bottom: 8px; }
  .ps-sig-lbl { font-size: 12px; color: #6b7280; font-weight: 600; text-align: center; }
  .ps-sig-sub { font-size: 11px; color: #9ca3af; text-align: center; margin-top: 2px; }

  /* ── Footer ── */
  .ps-ftr { display: flex; justify-content: space-between; align-items: center; padding: 14px 36px; background: #f8f9fb; border-top: 1px solid #e5e7eb; font-size: 10.5px; color: #9ca3af; }
  .ps-ftr-brand { display: flex; align-items: center; gap: 5px; }
  .ps-ftr-mini { width: 16px; height: 16px; background: linear-gradient(135deg,#2563EB,#1D4ED8); border-radius: 3px; display: inline-flex; align-items: center; justify-content: center; font-size: 7px; font-weight: 800; color: #fff; }
  .ps-note { font-size: 11px; color: #9ca3af; text-align: center; margin: 16px 0 0; font-style: italic; }

  /* ── Print button ── */
  .ps-print-btn { display: block; margin: 20px auto; padding: 12px 40px; background: linear-gradient(135deg,#2563EB,#1D4ED8); border: none; border-radius: 10px; font-weight: 800; font-size: 15px; cursor: pointer; color: #111; font-family: 'Inter', Arial, sans-serif; letter-spacing: .3px; }
</style>
</head>
<body>
<div class="ps-wrap">

  <!-- Header -->
  <div class="ps-hdr">
    <div>
      <div class="ps-co">${escapeHTML(cfg.businessName||'Your Company')}</div>
      <div class="ps-co-meta">
        ${cfg.address ? escapeHTML(cfg.address)+'<br/>' : ''}
        ${cfg.gstNumber ? 'GSTIN: '+escapeHTML(cfg.gstNumber) : ''}
        ${cfg.gstNumber && cfg.phone ? ' &nbsp;|&nbsp; ' : ''}
        ${cfg.phone ? '&#128222; '+escapeHTML(cfg.phone) : ''}
        ${cfg.pfNumber ? '<br/>PF Reg: '+escapeHTML(cfg.pfNumber) : ''}
        ${cfg.esiNumber ? ' &nbsp;|&nbsp; ESI: '+escapeHTML(cfg.esiNumber) : ''}
      </div>
    </div>
    <div class="ps-logo">SX</div>
  </div>

  <!-- Gold bar -->
  <div class="ps-bar">
    <div class="ps-bar-title">&#128188; Salary Slip</div>
    <div class="ps-bar-period">${month}</div>
  </div>

  <div class="ps-body">

    <!-- Employee info -->
    <div class="ps-emp">
      <div class="ps-emp-cell"><div class="ps-emp-lbl">Employee Name</div><div class="ps-emp-val">${escapeHTML(emp.name)}</div></div>
      <div class="ps-emp-cell"><div class="ps-emp-lbl">Employee ID</div><div class="ps-emp-val">${escapeHTML(emp.empId||'—')}</div></div>
      <div class="ps-emp-cell"><div class="ps-emp-lbl">Pay Period</div><div class="ps-emp-val">${month}</div></div>
      <div class="ps-emp-cell"><div class="ps-emp-lbl">Designation</div><div class="ps-emp-val">${escapeHTML(emp.designation||'—')}</div></div>
      <div class="ps-emp-cell"><div class="ps-emp-lbl">Department</div><div class="ps-emp-val">${escapeHTML(emp.department||'—')}</div></div>
      <div class="ps-emp-cell"><div class="ps-emp-lbl">Date of Joining</div><div class="ps-emp-val">${escapeHTML(emp.doj||'—')}</div></div>
      <div class="ps-emp-cell"><div class="ps-emp-lbl">PAN Number</div><div class="ps-emp-val">${escapeHTML(emp.pan||'—')}</div></div>
      <div class="ps-emp-cell"><div class="ps-emp-lbl">Bank Account</div><div class="ps-emp-val">${escapeHTML(emp.bank||'—')}</div></div>
      <div class="ps-emp-cell"><div class="ps-emp-lbl">Working Days</div><div class="ps-emp-val">${now.getDate()} / ${new Date(now.getFullYear(), now.getMonth()+1, 0).getDate()}</div></div>
    </div>

    <!-- Earnings / Deductions -->
    <div class="ps-ed">
      <div>
        <div class="ps-col-hdr">&#128200; Earnings</div>
        <div class="ps-col-body">
          <div class="ps-row"><span class="ps-row-lbl">Basic Salary</span><span class="ps-row-val">${sym}${fmtN(sal.basic)}</span></div>
          <div class="ps-row"><span class="ps-row-lbl">HRA (House Rent Allow.)</span><span class="ps-row-val">${sym}${fmtN(sal.hra)}</span></div>
          <div class="ps-row"><span class="ps-row-lbl">Dearness Allowance</span><span class="ps-row-val">${sym}${fmtN(sal.da)}</span></div>
          <div class="ps-row"><span class="ps-row-lbl">Special Allowance</span><span class="ps-row-val">${sym}${fmtN(sal.special)}</span></div>
          <div class="ps-row"><span class="ps-row-lbl">Other Allowances</span><span class="ps-row-val">${sym}${fmtN(sal.otherAllow)}</span></div>
          <div class="ps-subtotal"><span>Gross Earnings</span><span>${sym}${fmtN(sal.gross)}</span></div>
        </div>
      </div>
      <div>
        <div class="ps-col-hdr">&#128683; Deductions</div>
        <div class="ps-col-body">
          <div class="ps-row"><span class="ps-row-lbl">PF — Employee (12%)</span><span class="ps-row-val" style="color:#dc2626">${sym}${fmtN(sal.pfEmployee)}</span></div>
          <div class="ps-row"><span class="ps-row-lbl">ESI — Employee (0.75%)</span><span class="ps-row-val" style="color:#dc2626">${sym}${fmtN(sal.esiEmployee)}</span></div>
          <div class="ps-row"><span class="ps-row-lbl">Professional Tax</span><span class="ps-row-val" style="color:#dc2626">${sym}${fmtN(sal.pt)}</span></div>
          <div class="ps-row"><span class="ps-row-lbl">TDS (Income Tax)</span><span class="ps-row-val" style="color:#dc2626">${sym}${fmtN(sal.tds)}</span></div>
          <div class="ps-row"><span class="ps-row-lbl">Other Deductions</span><span class="ps-row-val" style="color:#dc2626">${sym}${fmtN(sal.otherDeduct||0)}</span></div>
          <div class="ps-subtotal"><span>Total Deductions</span><span style="color:#dc2626">${sym}${fmtN(sal.totalDeductions)}</span></div>
        </div>
      </div>
    </div>

    <!-- Net pay -->
    <div class="ps-net">
      <div class="ps-net-left">
        <div class="ps-net-lbl">NET SALARY (Take Home)</div>
        <div class="ps-net-words">${numToWordsPayslip(Math.round(sal.netPay))} Only</div>
      </div>
      <div class="ps-net-val">${sym}${fmtN(sal.netPay)}</div>
    </div>

    <!-- CTC -->
    <div class="ps-ctc">
      <span>&#128200; Employer PF: <strong>${sym}${fmtN(sal.pfEmployer)}</strong></span>
      <span>&#127973; Employer ESI: <strong>${sym}${fmtN(sal.esiEmployer)}</strong></span>
      <span>&#128184; Total CTC: <strong>${sym}${fmtN(ctc)}</strong></span>
      <span>&#128200; Gross: <strong>${sym}${fmtN(sal.gross)}</strong></span>
    </div>

    <!-- Signatures -->
    <div class="ps-sigs">
      <div>
        <div class="ps-sig-line"></div>
        <div class="ps-sig-lbl">Employee Signature</div>
        <div class="ps-sig-sub">${escapeHTML(emp.name)}</div>
      </div>
      <div>
        <div class="ps-sig-line"></div>
        <div class="ps-sig-lbl">Authorised Signatory</div>
        <div class="ps-sig-sub">${escapeHTML(cfg.businessName||'Company')}</div>
      </div>
    </div>

    <div class="ps-note">
      This is a computer-generated payslip and does not require a physical signature.<br/>
      Verify all statutory deductions with your HR / Accounts department.
    </div>
  </div>

  <!-- Footer -->
  <div class="ps-ftr">
    <div class="ps-ftr-brand">
      <span class="ps-ftr-mini">SX</span>
      <span style="font-weight:700;color:#2563EB;letter-spacing:1px">STRATIX</span>
      <span>&nbsp;&#183;&nbsp;India's Business Intelligence Platform</span>
    </div>
    <div>Generated: ${new Date().toLocaleString('en-IN')}</div>
  </div>

</div>
<button class="ps-print-btn no-print" onclick="window.print()">&#128424;&#65039; Print / Save as PDF</button>
</body>
</html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 600);
  },

  runPayroll() {
    const employees = STRATIX_DB.getArr('employees');
    if (employees.length === 0) { NOTIFY.show('Add employees first before generating payroll','warning'); return; }
    const month = new Date().toISOString().slice(0,7);
    const sym = STRATIX_DB.getSettings().currencySymbol||'₹';
    const total = employees.reduce((s,e)=>s+calcNetSalary(e).netPay,0);
    const totalCTC = employees.reduce((s,e)=>{const c=calcNetSalary(e);return s+c.gross+c.pfEmployer+c.esiEmployer;},0);
    STRATIX_DB.push('payslips', { month, count: employees.length, totalNet: total, totalCTC });
    STRATIX_DB.push('transactions', { type:'expense', amount: total, category:'salary', description:`Monthly Payroll — ${month}`, date: new Date().toISOString().split('T')[0] });
    NOTIFY.show(`Payroll processed! ${sym}${fmtN(total)} for ${employees.length} employees.`, 'success');
  }
};

// ── BANK CONNECT ──────────────────────────────────────────────────────────
function renderBankConnect() {
  const accounts = STRATIX_DB.getArr('bankAccounts');
  const txns = STRATIX_DB.getArr('bankTransactions');
  const sym = STRATIX_DB.getSettings().currencySymbol||'₹';
  const totalBalance = accounts.reduce((s,a)=>s+a.balance,0);
  const totalIn = txns.filter(t=>t.amount>0).reduce((s,t)=>s+t.amount,0);
  const totalOut = txns.filter(t=>t.amount<0).reduce((s,t)=>s+Math.abs(t.amount),0);

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div>
          <h1 class="sec-title">Bank Tracker</h1>
          <p class="sec-sub">Manually track bank accounts, balances &amp; transactions in one place</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-gold" onclick="BANK.openAddAccount()">+ Add Account</button>
          <button class="btn btn-ghost" onclick="BANK.showImport()">⬆ Import CSV</button>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-lbl">Total Balance</div><div class="kpi-value text-gold">${sym}${fmtN(totalBalance)}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Total Accounts</div><div class="kpi-val">${accounts.length}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Money In (Period)</div><div class="kpi-value text-green">${sym}${fmtN(totalIn)}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Money Out (Period)</div><div class="kpi-value text-red">${sym}${fmtN(totalOut)}</div></div>
      </div>

      ${accounts.length === 0 ? `
        <div class="card" style="text-align:center;padding:60px 20px">
          <div style="font-size:48px;margin-bottom:14px">🏦</div>
          <h3 style="color:var(--text2);margin-bottom:8px">No Bank Accounts Added</h3>
          <p style="color:var(--muted);margin:0 auto 20px;max-width:320px">Add your business bank accounts to track balances and sync transactions.</p>
          <button class="btn btn-gold" onclick="BANK.openAddAccount()">+ Add Bank Account</button>
        </div>
      ` : `
        <div class="form-grid mb-20">
          ${accounts.map(a=>`
            <div class="bank-card">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div>
                  <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${escapeHTML(a.bankName)}</div>
                  <div class="bank-number">${a.accountNo.replace(/\d(?=\d{4})/g,'*')}</div>
                  <div style="font-size:11px;color:var(--muted)">IFSC: ${a.ifsc||'—'} | ${a.accountType||'Current'}</div>
                </div>
                <div style="text-align:right">
                  <div style="font-size:11px;color:var(--muted)">Balance</div>
                  <div class="bank-balance">${a.currSym||sym}${fmtN(a.balance)}</div>
                  <span class="badge badge-green" style="margin-top:6px">Active</span>
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-top:14px;border-top:1px solid var(--border2);padding-top:12px">
                <input type="number" id="newAccBal_${a.id}" placeholder="New balance" style="width:110px;padding:6px 10px;border-radius:8px;border:1px solid var(--border2);background:var(--surface);color:var(--text);font-size:12px;font-family:var(--font)"/>
                <button class="btn btn-ghost btn-sm" onclick="BANK.updateBalance('${a.id}','newAccBal_${a.id}')">Update</button>
                <button class="btn btn-red btn-sm" onclick="BANK.deleteAccount('${a.id}')">Remove</button>
              </div>
            </div>`).join('')}
        </div>
      `}

      ${accounts.length > 0 ? `
        <div class="table-wrap card" style="padding:0">
          <div class="tbl-head">
            <span class="tbl-title">Transaction History</span>
            <div style="display:flex;gap:8px">
              <select id="bankFilter" onchange="BANK.filterTxns(this.value)" style="width:auto;padding:6px 10px;font-size:12px">
                <option value="all">All Accounts</option>
                ${accounts.map(a=>`<option value="${a.id}">${a.bankName}</option>`).join('')}
              </select>
            </div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Account</th><th>Description</th><th>Category</th><th>Amount</th><th>Balance After</th></tr></thead>
            <tbody id="bankTxnBody">
              ${renderBankTxns(txns, accounts, sym)}
            </tbody>
          </table>
          ${txns.length === 0 ? `<div class="empty-state"><div class="empty-icon">💳</div><h3>No transactions yet</h3><p>Import bank statement CSV or add transactions manually</p></div>` : ''}
        </div>
      ` : ''}

      <div class="alert alert-blue mt-16">
        <span class="alert-icon">🔗</span>
        <div>
          <strong>Account Aggregator Integration:</strong> Connect via RBI-approved Account Aggregator (Finvu, OneMoney, CAMSfinserv) to auto-sync transactions. Coming soon — for now, manually update balances or import CSV.
        </div>
      </div>

      <div id="bankModal"></div>
    </div>`;
}

function renderBankTxns(txns, accounts, sym) {
  if (txns.length === 0) return '';
  return txns.slice().reverse().slice(0,50).map(t=>{
    const acc = accounts.find(a=>a.id===t.accountId);
    return `<tr>
      <td class="td-muted">${t.date}</td>
      <td>${acc?.bankName||'—'}</td>
      <td>${escapeHTML(t.description||'—')}</td>
      <td><span class="badge badge-muted">${t.category||'Other'}</span></td>
      <td class="${t.amount>0?'td-green':'td-red'}">${t.amount>0?'+':'-'}${sym}${fmtN(Math.abs(t.amount))}</td>
      <td>${sym}${fmtN(t.balanceAfter||0)}</td>
    </tr>`;
  }).join('');
}

const BANK = {
  openAddAccount() {
    document.getElementById('bankModal').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)this.innerHTML=''">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Add Bank Account</h3>
            <button class="modal-close" onclick="document.getElementById('bankModal').innerHTML=''">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <div class="field"><label>Bank Name</label>
                <select id="bBankName">
                  ${['State Bank of India','HDFC Bank','ICICI Bank','Axis Bank','Kotak Mahindra Bank','Punjab National Bank','Bank of Baroda','Canara Bank','Union Bank of India','IndusInd Bank','Yes Bank','IDFC FIRST Bank','Other'].map(b=>`<option>${b}</option>`).join('')}
                </select>
              </div>
              <div class="field"><label>Account Type</label>
                <select id="bAccType"><option>Current</option><option>Savings</option><option>OD/CC</option></select>
              </div>
              <div class="field"><label>Account Number</label><input id="bAccNo" placeholder="00000011223344"/></div>
              <div class="field"><label>IFSC Code</label><input id="bIFSC" placeholder="SBIN0001234" style="text-transform:uppercase"/></div>
              <div class="field"><label>Branch Name</label><input id="bBranch" placeholder="Mumbai Main Branch"/></div>
              <div class="field"><label>Current Balance (₹)</label><input type="number" id="bBalance" placeholder="125000"/></div>
            </div>
            <button class="btn btn-gold btn-full mt-16" onclick="BANK.saveAccount()">Add Account</button>
          </div>
        </div>
      </div>`;
  },

  saveAccount() {
    const name = document.getElementById('bBankName').value;
    const accNo = document.getElementById('bAccNo').value.trim();
    if (!accNo) { NOTIFY.show('Please enter account number','warning'); return; }
    STRATIX_DB.push('bankAccounts', {
      bankName: name, accountNo: accNo,
      accountType: document.getElementById('bAccType').value,
      ifsc: document.getElementById('bIFSC').value.toUpperCase(),
      branch: document.getElementById('bBranch').value,
      balance: +document.getElementById('bBalance').value||0,
    });
    document.getElementById('bankModal').innerHTML = '';
    NOTIFY.show('Bank account added!', 'success');
    renderBankConnect();
  },

  updateBalance(id, inputId) {
    const elId = inputId || 'newAccBal_' + id;
    const bal = document.getElementById(elId)?.value;
    if (!bal && bal !== '0') { NOTIFY.show('Enter a balance amount first','warning'); return; }
    STRATIX_DB.update('bankAccounts', id, { balance: +bal||0 });
    NOTIFY.show('Balance updated!', 'success');
    renderBankConnect();
  },

  deleteAccount(id) {
    const bar2 = document.getElementById('bankDelBar')||document.createElement('div');
    bar2.id='bankDelBar';
    bar2.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;background:#F8FAFC;border:1.5px solid #e84040;border-radius:14px;padding:14px 20px;display:flex;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.6);font-family:var(--font);font-size:13px;color:#0F172A;';
    bar2.innerHTML='<span>Remove this bank account?</span><button onclick="STRATIX_DB.remove(\'bankAccounts\',\''+id+'\');renderBankConnect();document.getElementById(\'bankDelBar\').remove();" style="background:#e84040;border:none;border-radius:8px;padding:7px 14px;color:#fff;font-weight:700;cursor:pointer;font-family:var(--font)">Remove</button><button onclick="document.getElementById(\'bankDelBar\').remove();" style="background:#2a3550;border:none;border-radius:8px;padding:7px 14px;color:#0F172A;cursor:pointer;font-family:var(--font)">Cancel</button>';
    document.body.appendChild(bar2);
    // Auto-dismiss after 8 seconds (non-destructive timeout - user must still confirm)
    setTimeout(()=>{const b=document.getElementById('bankDelBar');if(b)b.remove();},8000);
  },

  showImport() {
    document.getElementById('bankModal').innerHTML = `
      <div class="modal-overlay" onclick="if(event.target===this)this.innerHTML=''">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">Import Bank Statement (CSV)</h3>
            <button class="modal-close" onclick="document.getElementById('bankModal').innerHTML=''">✕</button>
          </div>
          <div class="modal-body">
            <div class="alert alert-blue"><span class="alert-icon">ℹ️</span>
              <div>CSV format: <strong>Date, Description, Debit, Credit, Balance</strong><br/>
              Download your statement from NetBanking and upload here.</div>
            </div>
            <div class="field mt-16"><label>Select Account</label>
              <select id="importAccId">
                ${STRATIX_DB.getArr('bankAccounts').map(a=>`<option value="${a.id}">${a.bankName} — ${a.accountNo.slice(-4)}</option>`).join('')}
              </select>
            </div>
            <div class="field mt-12"><label>CSV File</label><input type="file" accept=".csv" id="csvFile" onchange="BANK.parseCSV(event)"/></div>
            <div id="csvPreview" class="mt-12"></div>
          </div>
        </div>
      </div>`;
  },

  parseCSV(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      // Smart CSV parser - handles Indian number format "1,50,000" and quoted fields
      function parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQuotes = !inQuotes; continue; }
          if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; continue; }
          current += ch;
        }
        result.push(current.trim());
        return result;
      }
      function parseIndianNum(s) {
        if (!s) return 0;
        // Remove currency symbols, spaces, commas (Indian format 1,50,000)
        const cleaned = s.replace(/[₹$,\s]/g, '').replace(/[()]/g, '');
        return parseFloat(cleaned) || 0;
      }
      const raw = e.target.result;
      const lines = raw.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) { NOTIFY.show('CSV file is empty or invalid','error'); return; }
      // Auto-detect header
      const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());
      const dateIdx = header.findIndex(h => h.includes('date'));
      const descIdx = header.findIndex(h => h.includes('desc') || h.includes('narr') || h.includes('particular') || h.includes('detail'));
      const debitIdx = header.findIndex(h => h.includes('debit') || h.includes('dr') || h.includes('withdraw'));
      const creditIdx = header.findIndex(h => h.includes('credit') || h.includes('cr') || h.includes('deposit'));
      const balIdx = header.findIndex(h => h.includes('bal'));
      const accId = document.getElementById('importAccId')?.value || '';
      let count = 0; let skipped = 0;
      lines.slice(1).forEach(line => {
        if (!line.trim()) return;
        const parts = parseCSVLine(line);
        if (parts.length < 3) { skipped++; return; }
        const date = dateIdx >= 0 ? parts[dateIdx] : parts[0];
        const desc = descIdx >= 0 ? parts[descIdx] : parts[1];
        const debit = debitIdx >= 0 ? parseIndianNum(parts[debitIdx]) : 0;
        const credit = creditIdx >= 0 ? parseIndianNum(parts[creditIdx]) : 0;
        const balance = balIdx >= 0 ? parseIndianNum(parts[balIdx]) : 0;
        const amount = credit - debit;
        if (!date && amount === 0) { skipped++; return; }
        STRATIX_DB.push('bankTransactions', {
          accountId: accId, date: date || new Date().toISOString().split('T')[0],
          description: desc || 'Transaction', amount, balanceAfter: balance,
          category: autoCategorize(desc || '')
        });
        count++;
      });
      const el = document.getElementById('csvPreview');
      if (el) el.innerHTML = count > 0
        ? '<div class="alert alert-green"><span>✅</span> Imported ' + count + ' transactions' + (skipped > 0 ? ' (' + skipped + ' rows skipped)' : '') + '.</div>'
        : '<div class="alert alert-red"><span>❌</span> No valid transactions found. Check CSV format.</div>';
      if (count > 0) {
        NOTIFY.show(count + ' transactions imported!', 'success');
        setTimeout(() => renderBankConnect(), 2000);
      }
    };
    reader.readAsText(file);
  },

  filterTxns(accId) {
    const allTxns = STRATIX_DB.getArr('bankTransactions');
    const accounts = STRATIX_DB.getArr('bankAccounts');
    const sym = STRATIX_DB.getSettings().currencySymbol||'₹';
    const filtered = accId === 'all' ? allTxns : allTxns.filter(t=>t.accountId===accId);
    document.getElementById('bankTxnBody').innerHTML = renderBankTxns(filtered, accounts, sym);
  }
};

function autoCategorize(desc) {
  desc = (desc||'').toLowerCase();
  if (/fuel|petrol|diesel/i.test(desc)) return 'Fuel';
  if (/salary|payroll|wage/i.test(desc)) return 'Salary';
  if (/toll|fastag/i.test(desc)) return 'Toll';
  if (/gst|tax/i.test(desc)) return 'GST/Tax';
  if (/emi|loan|interest/i.test(desc)) return 'Loan EMI';
  if (/rent/i.test(desc)) return 'Rent';
  if (/insurance/i.test(desc)) return 'Insurance';
  if (/maintenance|repair|service/i.test(desc)) return 'Maintenance';
  return 'Other';
}

// ── WHATSAPP REMINDERS ────────────────────────────────────────────────────
function renderWhatsApp() {
  const clients  = STRATIX_DB.getArr('clients');
  const settings = STRATIX_DB.getSettings();
  const sym      = settings.currencySymbol || '₹';
  const overdue  = clients.filter(c => c.outstanding > 0);

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div>
          <h1 class="sec-title">WhatsApp Business Tools</h1>
          <p class="sec-sub">Send branded receipts, invoices &amp; payment reminders via WhatsApp</p>
        </div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-lbl">Overdue Clients</div><div class="kpi-val red">${overdue.length}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Total Outstanding</div><div class="kpi-val gold">${sym}${fmtN(overdue.reduce((s,c)=>s+c.outstanding,0))}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">Business Name</div><div class="kpi-val" style="font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${settings.businessName||'Set in Settings'}</div></div>
        <div class="kpi-card"><div class="kpi-lbl">UPI ID</div><div class="kpi-val" style="font-size:13px">${settings.upiId||'Set in Settings'}</div></div>
      </div>

      <!-- ═══ STRATIX BRANDED RECEIPT BUILDER ═══ -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-hdr" style="padding:14px 18px;border-bottom:1px solid var(--border)">
          <div class="card-title">
            <span style="width:32px;height:32px;background:linear-gradient(135deg,#2563EB,#c07000);border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-size:11px;font-weight:800;color:#060a10;flex-shrink:0">SX</span>
            ✦ STRATIX Receipt Builder
          </div>
          <span style="font-size:11px;color:var(--gold);font-weight:700;background:rgba(37,99,235,.1);border:1px solid rgba(37,99,235,.2);border-radius:20px;padding:3px 10px">Branded Receipt</span>
        </div>
        <div style="padding:18px">
          <div class="form-grid" style="margin-bottom:14px">
            <div class="field"><label>Customer Name *</label><input id="rcptName" placeholder="e.g. Rajesh Kumar" oninput="WA.previewReceipt()"/></div>
            <div class="field"><label>Customer WhatsApp</label><input id="rcptPhone" placeholder="+91 98765 43210" type="tel"/></div>
            <div class="field"><label>Receipt / Invoice No</label><input id="rcptNo" placeholder="e.g. INV-001" oninput="WA.previewReceipt()"/></div>
            <div class="field"><label>Date</label><input type="date" id="rcptDate" value="${new Date().toISOString().split('T')[0]}" oninput="WA.previewReceipt()"/></div>
          </div>

          <!-- Line items -->
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">Items / Services</div>
          <div id="rcptItems" style="display:flex;flex-direction:column;gap:8px;margin-bottom:10px">
            <div class="rcpt-item" style="display:grid;grid-template-columns:1fr 80px 90px 32px;gap:8px;align-items:center">
              <input placeholder="Item / Service description" oninput="WA.previewReceipt()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:13px;outline:none"/>
              <input type="number" placeholder="Qty" value="1" oninput="WA.previewReceipt()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:13px;outline:none"/>
              <input type="number" placeholder="Rate (${sym})" oninput="WA.previewReceipt()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:13px;outline:none"/>
              <button onclick="this.closest('.rcpt-item').remove();WA.previewReceipt()" style="background:var(--rdim);border:none;border-radius:8px;color:var(--red);font-size:14px;padding:8px;cursor:pointer;width:32px;height:36px;display:flex;align-items:center;justify-content:center">×</button>
            </div>
          </div>
          <button onclick="WA.addItem()" class="btn btn-ghost btn-sm" style="margin-bottom:16px">＋ Add Item</button>

          <div class="form-grid" style="margin-bottom:14px">
            <div class="field"><label>GST / Tax (%)</label><input type="number" id="rcptTax" placeholder="0" value="0" oninput="WA.previewReceipt()"/></div>
            <div class="field"><label>Discount (${sym})</label><input type="number" id="rcptDisc" placeholder="0" value="0" oninput="WA.previewReceipt()"/></div>
            <div class="field"><label>Payment Method</label>
              <select id="rcptPay" onchange="WA.previewReceipt()">
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer / NEFT</option>
                <option value="Cheque">Cheque</option>
                <option value="Credit">Credit / Pending</option>
              </select>
            </div>
            <div class="field"><label>Note (Optional)</label><input id="rcptNote" placeholder="Thank you note or terms" oninput="WA.previewReceipt()"/></div>
          </div>

          <!-- Live Preview -->
          <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px">📱 WhatsApp Preview</div>
          <div id="rcptPreview" style="background:#075e54;border-radius:12px;padding:16px;font-family:monospace;font-size:13px;color:#e9edef;white-space:pre-wrap;line-height:1.7;max-height:380px;overflow-y:auto;min-height:120px;border:2px solid rgba(7,94,84,.5)">
            Fill in customer name and add items to see preview...
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
            <button onclick="WA.sendReceipt()" style="display:flex;align-items:center;gap:8px;padding:11px 20px;background:#25d366;color:#0F172A;border:none;border-radius:10px;font-family:var(--font);font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(37,211,102,.35)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Send via WhatsApp
            </button>
            <button onclick="WA.copyReceipt()" class="btn btn-ghost">📋 Copy Receipt</button>
            <button onclick="WA.saveAsTransaction()" class="btn btn-ghost" style="color:var(--gold)">💾 Save as Transaction</button>
          </div>
        </div>
      </div>

      <!-- ═══ QUICK COMPOSE (simple messages) ═══ -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-hdr" style="padding:14px 18px;border-bottom:1px solid var(--border)">
          <div class="card-title">📱 Quick Message Composer</div>
        </div>
        <div style="padding:18px">
          <div class="form-grid mb-16">
            <div class="field"><label>Recipient Name</label><input id="waName" placeholder="Client / Contact name"/></div>
            <div class="field"><label>WhatsApp Number</label><input id="waPhone" placeholder="+91 98765 43210" type="tel"/></div>
            <div class="field form-full"><label>Message Template</label>
              <select id="waTpl" onchange="WA.fillTemplate(this.value)">
                <option value="reminder">Payment Reminder</option>
                <option value="invoice">Invoice Follow-up</option>
                <option value="thanks">Payment Received (Thank You)</option>
                <option value="advance">Advance Request</option>
                <option value="quote">Price Quotation Sent</option>
                <option value="custom">Custom Message</option>
              </select>
            </div>
            <div class="field form-full"><label>Amount (${sym})</label><input type="number" id="waAmt" placeholder="50000" oninput="WA.refreshPreview()"/></div>
            <div class="field form-full"><label>Message</label><textarea id="waMsg" rows="5" oninput="WA.refreshPreview()"></textarea></div>
          </div>
          <div class="wa-preview" id="waPreview">Select a template to preview message</div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:14px">
            <button class="btn btn-ghost" onclick="WA.sendMessage()" style="background:#25d366;color:#0F172A;border-color:#25d366">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Open WhatsApp
            </button>
            <button class="btn btn-ghost" onclick="WA.copyMsg()">📋 Copy Message</button>
          </div>
        </div>
      </div>

      <!-- ═══ COLLECTION REMINDERS TABLE ═══ -->
      <div class="card" style="padding:0">
        <div class="tbl-head" style="padding:14px 18px">
          <span class="tbl-title">Outstanding Collection Reminders</span>
          <button class="btn btn-ghost btn-sm" onclick="const f=document.getElementById('qcForm');f.style.display=f.style.display==='none'?'block':'none'">+ Add Client</button>
        </div>
        <div id="qcForm" style="display:none;padding:16px 18px;border-bottom:1px solid var(--border)">
          <div class="form-grid">
            <div class="field"><label>Client Name</label><input id="qcName" placeholder="Rajesh Traders"/></div>
            <div class="field"><label>Outstanding (${sym})</label><input type="number" id="qcAmt" placeholder="50000"/></div>
            <div class="field"><label>WhatsApp Number</label><input id="qcPhone" placeholder="+91 9876543210"/></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-gold btn-sm" onclick="WA.addClient()">Add Client</button>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('qcForm').style.display='none'">Cancel</button>
          </div>
        </div>
        ${overdue.length === 0 ? `
          <div class="empty-state"><div class="empty-icon">🎉</div><h3>All Clear!</h3><p>No outstanding payments. Great job!</p></div>
        ` : `
          <div class="tbl-scroll"><table class="data-table">
            <thead><tr><th>Client</th><th>Outstanding</th><th>Risk</th><th>WhatsApp No.</th><th>Actions</th></tr></thead>
            <tbody>
              ${overdue.map(c=>`<tr>
                <td class="td-bold">${c.name}</td>
                <td class="td-red">${sym}${fmtN(c.outstanding)}</td>
                <td><span class="badge badge-${c.risk==='high'?'red':c.risk==='medium'?'gold':'green'}">${c.risk||'low'}</span></td>
                <td><input id="ph_${c.id}" value="${c.phone||''}" placeholder="+91 9876543210" style="width:150px;padding:5px 8px;font-size:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);font-family:var(--font)"/></td>
                <td style="display:flex;gap:5px;flex-wrap:wrap">
                  <button class="btn btn-ghost btn-sm" onclick="WA.quickRemind('${c.id}','gentle')" style="font-size:11px">💚 Gentle</button>
                  <button class="btn btn-ghost btn-sm" onclick="WA.quickRemind('${c.id}','firm')" style="font-size:11px">💛 Firm</button>
                  <button class="btn btn-ghost btn-sm" onclick="WA.quickRemind('${c.id}','urgent')" style="font-size:11px;color:var(--red)">🔴 Urgent</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table></div>
        `}
      </div>
    </div>`;

  WA.fillTemplate('reminder');
  WA.previewReceipt();
}

const WA = {
  /* ── Receipt Builder ──────────────────────────────────────── */
  _buildReceiptText() {
    const settings = STRATIX_DB.getSettings();
    const biz   = settings.businessName || 'My Business';
    const phone = settings.phone || '';
    const addr  = settings.address || '';
    const gst   = settings.gstNumber || '';
    const upi   = settings.upiId || '';
    const bank  = settings.bankName  ? `${settings.bankName} | A/C: ${settings.bankAcc||'—'} | IFSC: ${settings.bankIFSC||'—'}` : '';
    const sym   = settings.currencySymbol || '₹';

    const name    = document.getElementById('rcptName')?.value?.trim() || 'Customer';
    const rcptNo  = document.getElementById('rcptNo')?.value?.trim() || '';
    const dateVal = document.getElementById('rcptDate')?.value || new Date().toISOString().split('T')[0];
    const dateStr = new Date(dateVal+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
    const payMode = document.getElementById('rcptPay')?.value || 'UPI';
    const note    = document.getElementById('rcptNote')?.value?.trim() || '';
    const taxPct  = parseFloat(document.getElementById('rcptTax')?.value) || 0;
    const disc    = parseFloat(document.getElementById('rcptDisc')?.value) || 0;

    // Collect items
    const rows = [...document.querySelectorAll('.rcpt-item')];
    const items = [];
    let subtotal = 0;
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const desc = inputs[0]?.value?.trim();
      const qty  = parseFloat(inputs[1]?.value) || 1;
      const rate = parseFloat(inputs[2]?.value) || 0;
      if (desc && rate > 0) {
        const amt = qty * rate;
        subtotal += amt;
        items.push({ desc, qty, rate, amt });
      }
    });

    if (items.length === 0) return null;

    const taxAmt   = Math.round(subtotal * taxPct / 100);
    const total    = subtotal + taxAmt - disc;
    const divider  = '━━━━━━━━━━━━━━━━━━━━━━━━';
    const sym2     = sym;

    let lines = [];
    // Header — STRATIX branded
    lines.push(`🏪 *${biz}*`);
    if (addr)   lines.push(`📍 ${addr}`);
    if (phone)  lines.push(`📞 ${phone}`);
    if (gst)    lines.push(`GST: ${gst}`);
    lines.push(divider);
    lines.push(`📄 *RECEIPT / INVOICE*`);
    if (rcptNo) lines.push(`No: *${rcptNo}*`);
    lines.push(`Date: ${dateStr}`);
    lines.push(`To: *${name}*`);
    lines.push(divider);

    // Items
    lines.push(`*ITEMS:*`);
    items.forEach(it => {
      const amtStr = `${sym2}${it.amt.toLocaleString('en-IN')}`;
      if (it.qty !== 1) {
        lines.push(`• ${it.desc}`);
        lines.push(`  ${it.qty} × ${sym2}${it.rate.toLocaleString('en-IN')} = *${amtStr}*`);
      } else {
        lines.push(`• ${it.desc}  *${amtStr}*`);
      }
    });
    lines.push(divider);

    // Totals
    if (items.length > 1 || disc > 0 || taxAmt > 0) {
      lines.push(`Subtotal: ${sym2}${subtotal.toLocaleString('en-IN')}`);
    }
    if (taxAmt > 0)  lines.push(`GST ${taxPct}%: ${sym2}${taxAmt.toLocaleString('en-IN')}`);
    if (disc > 0)    lines.push(`Discount: -${sym2}${disc.toLocaleString('en-IN')}`);
    lines.push(`*TOTAL: ${sym2}${total.toLocaleString('en-IN')}*`);
    lines.push(divider);

    // Payment
    lines.push(`💳 *Payment: ${payMode}*`);
    if (upi && (payMode === 'UPI' || payMode === 'Bank Transfer')) {
      lines.push(`UPI ID: *${upi}*`);
    }
    if (bank && payMode === 'Bank Transfer') {
      lines.push(`Bank: ${bank}`);
    }
    lines.push(divider);

    if (note) lines.push(`📝 ${note}`);
    lines.push(`Thank you for your business! 🙏`);
    lines.push(``);
    // STRATIX branding watermark
    lines.push(`_Powered by STRATIX · India's Business Intelligence App_`);
    lines.push(`_stratix.app_`);

    return lines.join('\n');
  },

  previewReceipt() {
    const text = this._buildReceiptText();
    const el = document.getElementById('rcptPreview');
    if (!el) return;
    el.textContent = text || 'Fill in customer name and add at least one item to see preview...';
  },

  addItem() {
    const sym = STRATIX_DB.getSettings().currencySymbol || '₹';
    const container = document.getElementById('rcptItems');
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'rcpt-item';
    div.style.cssText = 'display:grid;grid-template-columns:1fr 80px 90px 32px;gap:8px;align-items:center';
    div.innerHTML = `
      <input placeholder="Item / Service description" oninput="WA.previewReceipt()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:13px;outline:none"/>
      <input type="number" placeholder="Qty" value="1" oninput="WA.previewReceipt()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:13px;outline:none"/>
      <input type="number" placeholder="Rate (${sym})" oninput="WA.previewReceipt()" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:13px;outline:none"/>
      <button onclick="this.closest('.rcpt-item').remove();WA.previewReceipt()" style="background:var(--rdim);border:none;border-radius:8px;color:var(--red);font-size:14px;padding:8px;cursor:pointer;width:32px;height:36px;display:flex;align-items:center;justify-content:center">×</button>`;
    container.appendChild(div);
    div.querySelector('input').focus();
  },

  sendReceipt() {
    const text = this._buildReceiptText();
    if (!text) { NOTIFY.show('Please fill in customer name and at least one item with a price','warning'); return; }
    const rawPhone = (document.getElementById('rcptPhone')?.value || '').replace(/[^0-9]/g, '');
    if (!rawPhone) {
      // No phone — copy to clipboard and show instruction
      this._copyText(text);
      NOTIFY.show('No phone entered — receipt copied! Paste it in WhatsApp manually.', 'info', 5000);
      return;
    }
    const normalized = rawPhone.startsWith('91') && rawPhone.length === 12
      ? rawPhone : '91' + rawPhone.replace(/^0+/, '').slice(-10);
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(text)}`, '_blank');
    NOTIFY.show('WhatsApp opened with STRATIX receipt! 🚀', 'success');
  },

  copyReceipt() {
    const text = this._buildReceiptText();
    if (!text) { NOTIFY.show('Add customer name and at least one item first','warning'); return; }
    this._copyText(text);
    NOTIFY.show('Receipt copied! Paste it anywhere 📋', 'success');
  },

  saveAsTransaction() {
    const text = this._buildReceiptText();
    if (!text) { NOTIFY.show('Add items first','warning'); return; }
    // Calculate total from items
    const rows = [...document.querySelectorAll('.rcpt-item')];
    let subtotal = 0;
    rows.forEach(row => {
      const inputs = row.querySelectorAll('input');
      const qty  = parseFloat(inputs[1]?.value) || 1;
      const rate = parseFloat(inputs[2]?.value) || 0;
      subtotal += qty * rate;
    });
    const taxPct = parseFloat(document.getElementById('rcptTax')?.value) || 0;
    const disc   = parseFloat(document.getElementById('rcptDisc')?.value) || 0;
    const total  = subtotal + Math.round(subtotal * taxPct / 100) - disc;
    if (total <= 0) { NOTIFY.show('Total amount is zero — please add items','warning'); return; }
    const name   = document.getElementById('rcptName')?.value?.trim() || 'Customer';
    const rcptNo = document.getElementById('rcptNo')?.value?.trim() || '';
    const date   = document.getElementById('rcptDate')?.value || new Date().toISOString().split('T')[0];
    STRATIX_DB.push('transactions', {
      type: 'revenue', amount: total, category: 'sales',
      description: `Receipt${rcptNo?' #'+rcptNo:''} — ${name}`, date
    });
    NOTIFY.show(`✅ ${STRATIX_DB.getSettings().currencySymbol||'₹'}${total.toLocaleString('en-IN')} saved as revenue transaction!`, 'success');
  },

  _copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text)
        .then(() => NOTIFY.show('Copied!','success'))
        .catch(() => this._fallbackCopy(text));
    } else {
      this._fallbackCopy(text);
    }
  },

  /* ── Quick Compose ───────────────────────────────────────── */
  fillTemplate(type) {
    const settings = STRATIX_DB.getSettings();
    const biz = settings.businessName || 'Your Business';
    const footer = `\n\n_Powered by STRATIX · stratix.app_`;
    const templates = {
      reminder: `Dear [Name],\n\nThis is a payment reminder from *${biz}*.\n\nOutstanding Amount: ₹[Amount]\n\nKindly arrange payment at your earliest.\n\nBank: ${settings.bankName||'—'} | A/C: ${settings.bankAcc||'—'}\nUPI: ${settings.upiId||'—'}\n\nThank you! 🙏\n${biz}${footer}`,
      invoice:  `Dear [Name],\n\nInvoice for our services — Amount: ₹[Amount]\n\nKindly confirm receipt and share expected payment date.\n\nUPI: ${settings.upiId||'—'}\n\nRegards,\n${biz}${footer}`,
      thanks:   `Dear [Name],\n\n✅ *Payment Received!*\n\nWe have received ₹[Amount]. Thank you for your prompt payment!\n\nPleasure doing business with you 🙏\n\n${biz}${footer}`,
      advance:  `Dear [Name],\n\nRequest for Advance Payment: ₹[Amount]\n\nFor the confirmed order, please pay 50% advance to begin work.\n\nUPI: ${settings.upiId||'—'}\n\nThank you.\n${biz}${footer}`,
      quote:    `Dear [Name],\n\nPrice Quotation: ₹[Amount]\n\nAs discussed — valid for 7 days. Please confirm to proceed.\n\nRegards,\n${biz}${footer}`,
      custom: ''
    };
    const el = document.getElementById('waMsg');
    if (el) { el.value = templates[type] || ''; this.refreshPreview(); }
  },

  refreshPreview() {
    const msg = (document.getElementById('waMsg')?.value || '')
      .replace('[Name]',   document.getElementById('waName')?.value  || '[Name]')
      .replace('[Amount]', document.getElementById('waAmt')?.value   || '0');
    const el = document.getElementById('waPreview');
    if (el) el.textContent = msg;
  },

  sendMessage() {
    const phone = (document.getElementById('waPhone')?.value || '').replace(/[^0-9+]/g, '');
    const msg   = document.getElementById('waMsg')?.value || '';
    if (!phone) { NOTIFY.show('Enter WhatsApp number first','warning'); return; }
    if (!msg)   { NOTIFY.show('Enter message content first','warning'); return; }
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('91') && digits.length === 12
      ? digits : '91' + digits.replace(/^0+/, '').slice(-10);
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`, '_blank');
  },

  copyMsg() {
    const msg = document.getElementById('waMsg')?.value || '';
    if (!msg) { NOTIFY.show('No message to copy','warning'); return; }
    this._copyText(msg);
    NOTIFY.show('Message copied!', 'success');
  },

  _fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand('copy'); NOTIFY.show('Copied!','success'); }
    catch { NOTIFY.show('Copy failed — please select and copy manually','warning'); }
    document.body.removeChild(ta);
  },

  quickRemind(clientId, tone) {
    const c = STRATIX_DB.getArr('clients').find(c => c.id === clientId);
    if (!c) return;
    const settings = STRATIX_DB.getSettings();
    const sym = settings.currencySymbol || '₹';
    const phone = document.getElementById(`ph_${clientId}`)?.value;
    if (!phone) { NOTIFY.show('Enter WhatsApp number for this client first','warning'); return; }
    const footer = `\n\n_Powered by STRATIX · stratix.app_`;
    const msgs = {
      gentle: `Dear ${c.name},\n\nGentle reminder that *${sym}${fmtN(c.outstanding)}* is pending with *${settings.businessName||'us'}*.\n\nKindly arrange payment soon 🙏\n\nUPI: ${settings.upiId||'—'}${footer}`,
      firm:   `Dear ${c.name},\n\nYour payment of *${sym}${fmtN(c.outstanding)}* is overdue.\n\nKindly clear by ${new Date(Date.now()+3*86400000).toLocaleDateString('en-IN')} to continue services.\n\n${settings.businessName||''}${footer}`,
      urgent: `⚠️ Dear ${c.name},\n\n*URGENT: ${sym}${fmtN(c.outstanding)} is severely overdue.*\n\nImmediate payment required to avoid service suspension.\n\nPay Now: ${settings.upiId||'[UPI]'}\n\n${settings.businessName||''} | ${settings.phone||''}${footer}`
    };
    const digits = phone.replace(/[^0-9]/g, '');
    const normalized = digits.startsWith('91') && digits.length === 12
      ? digits : '91' + digits.replace(/^0+/, '').slice(-10);
    window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(msgs[tone])}`, '_blank');
  },

  loadTemplate(encoded) {
    try {
      document.getElementById('waMsg').value = decodeURIComponent(encoded);
      this.refreshPreview();
      document.getElementById('waMsg').scrollIntoView({ behavior: 'smooth' });
    } catch(e) {}
  },

  addClient() {
    const name        = document.getElementById('qcName')?.value?.trim();
    const outstanding = +document.getElementById('qcAmt')?.value  || 0;
    const phone       = document.getElementById('qcPhone')?.value?.trim();
    if (!name) { NOTIFY.show('Enter client name','warning'); return; }
    STRATIX_DB.push('clients', {
      name, outstanding, invoices: 1, lastPayment: null,
      phone: phone || '',
      risk: outstanding > 50000 ? 'high' : outstanding > 20000 ? 'medium' : 'low'
    });
    renderWhatsApp();
  }
};


// ── PROJECT SCOPE (placeholder - full feature coming soon) ───────────────
function renderAIAdvisor() {
  // AI Advisor removed - replaced by Project Scope in future update
  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head"><h1 class="sec-title">🎯 Project Scope</h1><p class="sec-sub">Coming soon — define and manage your project scope</p></div>
      <div style="text-align:center;padding:60px 24px">
        <div style="font-size:52px;margin-bottom:16px">🎯</div>
        <h3 style="font-size:18px;font-weight:700;margin-bottom:10px">Project Scope Manager</h3>
        <p style="color:var(--muted);max-width:380px;margin:0 auto 20px;font-size:14px;line-height:1.7">
          Define project requirements, deliverables, timelines and team responsibilities. Tailored templates for each business vertical.
        </p>
        <span style="background:rgba(37,99,235,.1);color:var(--gold);border:1px solid rgba(37,99,235,.25);border-radius:20px;padding:6px 16px;font-size:13px;font-weight:700">🚀 Coming in Next Update</span>
      </div>
    </div>\`;
}
const AI = { showKeySetup(){}, saveKey(){}, sendMessage(){}, addMessage(){}, addError(){} };


// ── HELPER ────────────────────────────────────────────────────────────────
function fmtN(n) {
  n = Math.abs(n);
  if (n >= 10000000) return (n/10000000).toFixed(2) + ' Cr';
  if (n >= 100000) return (n/100000).toFixed(2) + ' L';
  if (n >= 1000) return (n/1000).toFixed(1) + 'K';
  return Math.round(n).toLocaleString('en-IN');
}

// ── Number to words for payslip (standalone, no dependency on app.js) ──
function numToWordsPayslip(num) {
  num = Math.floor(num || 0);
  if (num === 0) return 'Zero Rupees';
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const conv = n => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+conv(n%100) : '');
    if (n < 100000) return conv(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+conv(n%1000) : '');
    if (n < 10000000) return conv(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+conv(n%100000) : '');
    return conv(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+conv(n%10000000) : '');
  };
  return 'Rupees ' + conv(num);
}
