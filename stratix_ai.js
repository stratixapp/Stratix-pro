/**
 * STRATIX AI Guide v5.0 — Premium Edition
 * Complete intelligent in-app assistant with 35 guided steps
 * Fixed: layout, session counting, navigation, animations
 * Enhanced: premium feel, smooth transitions, contextual data
 */

const STRATIX_AI = (() => {

  /* ── Inject required CSS once ─────────────────────────────────────────── */
  function _injectStyles() {
    if (document.getElementById('sx-ai-styles')) return;
    const s = document.createElement('style');
    s.id = 'sx-ai-styles';
    s.textContent = `
      /* ── Animations ── */
      @keyframes sxAiIn {
        0%  { opacity:0; transform:translateY(24px) scale(0.93); }
        60% { opacity:1; transform:translateY(-4px) scale(1.01); }
        100%{ opacity:1; transform:translateY(0) scale(1); }
      }
      @keyframes sxAiOut {
        0%  { opacity:1; transform:translateY(0) scale(1); }
        100%{ opacity:0; transform:translateY(16px) scale(0.95); }
      }
      @keyframes sxPulse {
        0%,100% { box-shadow:0 0 0 0 rgba(37,99,235,.45), 0 6px 24px rgba(37,99,235,.35); }
        50%      { box-shadow:0 0 0 10px rgba(37,99,235,.0), 0 6px 24px rgba(37,99,235,.35); }
      }
      @keyframes sxBtnPop {
        0%  { transform:scale(0); opacity:0; }
        70% { transform:scale(1.12); }
        100%{ transform:scale(1); opacity:1; }
      }
      @keyframes sxProgFill {
        from { width:0; }
      }
      @keyframes sxDotBounce {
        0%,80%,100%{ transform:scale(0.6); opacity:.35; }
        40%         { transform:scale(1.1); opacity:1; }
      }
      @keyframes sxShimmer {
        0%   { background-position:-200% 0; }
        100% { background-position:200% 0; }
      }

      /* ── Floating button ── */
      #sxAiBtn {
        position:fixed; bottom:88px; right:18px; z-index:9997;
        width:50px; height:50px;
        background:linear-gradient(135deg,#2563EB,#c07000);
        border:none; border-radius:50%;
        color:#F8FAFC; font-size:19px; font-weight:900;
        cursor:pointer;
        box-shadow:0 6px 24px rgba(37,99,235,.35);
        display:flex; align-items:center; justify-content:center;
        font-family:var(--font,sans-serif);
        animation:sxBtnPop .5s cubic-bezier(.34,1.56,.64,1) both, sxPulse 3s ease-in-out 1s infinite;
        transition:transform .15s, box-shadow .15s;
        -webkit-tap-highlight-color:transparent;
        user-select:none;
      }
      #sxAiBtn:hover { transform:scale(1.08); }
      #sxAiBtn:active { transform:scale(0.95); }
      #sxAiBtn.hide { display:none !important; }

      /* ── Modal ── */
      #sxAiModal {
        position:fixed;
        bottom:150px;
        right:18px;
        z-index:9998;
        width:min(390px, calc(100vw - 28px));
        max-height:calc(100vh - 180px);
        background:linear-gradient(160deg,#F8FAFC 0%,#FFFFFF 60%,#090e1a 100%);
        border:1px solid rgba(37,99,235,.22);
        border-radius:22px;
        box-shadow:
          0 32px 80px rgba(0,0,0,.85),
          0 0 0 1px rgba(37,99,235,.08),
          inset 0 1px 0 rgba(255,255,255,.04);
        font-family:var(--font,'Plus Jakarta Sans',sans-serif);
        animation:sxAiIn .4s cubic-bezier(.34,1.2,.64,1) both;
        overflow:hidden;
        display:flex;
        flex-direction:column;
      }
      #sxAiModal.closing {
        animation:sxAiOut .22s ease forwards;
      }

      /* Progress bar */
      .sx-progress-track {
        height:3px;
        background:rgba(255,255,255,.06);
        flex-shrink:0;
      }
      .sx-progress-fill {
        height:100%;
        background:linear-gradient(90deg,#2563EB,#ffca60,#c07000);
        background-size:200% 100%;
        border-radius:0 2px 2px 0;
        transition:width .5s cubic-bezier(.4,0,.2,1);
        animation:sxShimmer 2.5s linear infinite;
      }

      /* Header */
      .sx-header {
        padding:16px 18px 14px;
        display:flex;
        align-items:center;
        gap:12px;
        border-bottom:1px solid rgba(255,255,255,.055);
        flex-shrink:0;
      }
      .sx-icon-wrap {
        width:46px; height:46px; flex-shrink:0;
        background:linear-gradient(135deg,rgba(37,99,235,.18),rgba(37,99,235,.06));
        border:1px solid rgba(37,99,235,.28);
        border-radius:14px;
        display:flex; align-items:center; justify-content:center;
        font-size:21px;
        box-shadow:0 4px 16px rgba(37,99,235,.15);
      }
      .sx-header-meta { flex:1; min-width:0; }
      .sx-step-title {
        font-size:14.5px; font-weight:700;
        color:#0F172A; line-height:1.3;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
      }
      .sx-step-sub {
        font-size:11px; color:#4a6080; margin-top:2px;
        display:flex; align-items:center; gap:5px;
      }
      .sx-step-sub .sx-brand {
        color:#2563EB; font-weight:700; letter-spacing:.3px;
      }
      .sx-close-btn {
        background:none; border:none; color:#3a4a60;
        font-size:17px; cursor:pointer; padding:6px;
        border-radius:8px; transition:all .15s; flex-shrink:0;
        line-height:1; display:flex; align-items:center; justify-content:center;
        width:30px; height:30px;
      }
      .sx-close-btn:hover { background:rgba(255,255,255,.07); color:#c0cce0; }

      /* Body */
      .sx-body {
        padding:16px 18px 14px;
        font-size:13.5px;
        color:#7a92b0;
        line-height:1.85;
        overflow-y:auto;
        flex:1;
        min-height:0;
        scrollbar-width:thin;
        scrollbar-color:rgba(37,99,235,.2) transparent;
      }
      .sx-body::-webkit-scrollbar { width:3px; }
      .sx-body::-webkit-scrollbar-thumb { background:rgba(37,99,235,.2); border-radius:2px; }
      .sx-body strong { color:#dde8f4; font-weight:600; }
      .sx-body .sx-highlight {
        display:inline-block;
        background:rgba(37,99,235,.1);
        border:1px solid rgba(37,99,235,.2);
        border-radius:6px;
        padding:1px 7px;
        color:#2563EB;
        font-weight:600;
        font-size:12.5px;
      }
      .sx-body .sx-tip {
        margin-top:12px;
        padding:10px 14px;
        background:rgba(37,99,235,.06);
        border-left:2px solid rgba(37,99,235,.5);
        border-radius:0 8px 8px 0;
        font-size:12.5px;
        color:#8da0bb;
        line-height:1.7;
      }
      .sx-body .sx-warn {
        margin-top:10px;
        padding:9px 13px;
        background:rgba(232,64,64,.07);
        border-left:2px solid rgba(232,64,64,.4);
        border-radius:0 8px 8px 0;
        font-size:12.5px;
        color:#c07070;
      }
      .sx-body .sx-check {
        margin-top:10px;
        padding:9px 13px;
        background:rgba(0,214,143,.06);
        border-left:2px solid rgba(0,214,143,.35);
        border-radius:0 8px 8px 0;
        font-size:12.5px;
        color:#50c090;
      }
      .sx-body .sx-new-badge {
        display:inline-flex; align-items:center; gap:5px;
        background:rgba(37,99,235,.12);
        border:1px solid rgba(37,99,235,.3);
        border-radius:20px; padding:3px 10px;
        font-size:11px; font-weight:700;
        color:#2563EB; margin-bottom:8px;
        letter-spacing:.3px;
      }

      /* Step dots */
      .sx-dots {
        display:flex; gap:5px; justify-content:center;
        padding:0 18px 10px; flex-shrink:0; flex-wrap:wrap;
      }
      .sx-dot {
        width:5px; height:5px; border-radius:50%;
        background:rgba(255,255,255,.1);
        transition:all .3s cubic-bezier(.34,1.56,.64,1);
        cursor:pointer;
      }
      .sx-dot.active {
        background:#2563EB;
        transform:scale(1.5);
        box-shadow:0 0 6px rgba(37,99,235,.5);
      }
      .sx-dot.done { background:rgba(37,99,235,.4); }

      /* Footer */
      .sx-footer {
        padding:12px 18px 16px;
        border-top:1px solid rgba(255,255,255,.055);
        display:flex; gap:8px; align-items:center;
        flex-shrink:0;
      }
      .sx-btn-primary {
        flex:1; padding:10px 14px;
        background:linear-gradient(135deg,#2563EB,#c07000);
        border:none; border-radius:11px;
        color:#F8FAFC; font-weight:700; font-size:13px;
        cursor:pointer; font-family:inherit;
        transition:all .15s;
        white-space:nowrap;
        display:flex; align-items:center; justify-content:center; gap:5px;
      }
      .sx-btn-primary:hover { transform:translateY(-1px); box-shadow:0 5px 18px rgba(37,99,235,.3); }
      .sx-btn-primary:active { transform:translateY(0); }
      .sx-btn-ghost {
        padding:10px 13px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.09);
        border-radius:11px;
        color:#7a92b0; font-size:13px;
        cursor:pointer; font-family:inherit;
        transition:all .15s;
        white-space:nowrap;
        display:flex; align-items:center; justify-content:center; gap:4px;
      }
      .sx-btn-ghost:hover { background:rgba(255,255,255,.08); color:#c0cce0; border-color:rgba(255,255,255,.15); }
      .sx-btn-ghost:active { transform:scale(.97); }
      .sx-btn-back {
        width:38px; height:38px; flex-shrink:0; padding:0;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(255,255,255,.09);
        border-radius:11px;
        color:#7a92b0; font-size:14px;
        cursor:pointer; font-family:inherit;
        transition:all .15s;
        display:flex; align-items:center; justify-content:center;
      }
      .sx-btn-back:hover { background:rgba(255,255,255,.08); color:#c0cce0; }

      /* Session indicator */
      .sx-session-bar {
        display:flex; align-items:center; justify-content:space-between;
        padding:7px 18px 13px;
        flex-shrink:0;
      }
      .sx-session-left {
        display:flex; align-items:center; gap:7px;
        font-size:11px; color:#2d3d55;
      }
      .sx-session-pips {
        display:flex; gap:3px;
      }
      .sx-pip {
        width:4px; height:4px; border-radius:50%;
        background:rgba(37,99,235,.18);
      }
      .sx-pip.used { background:rgba(37,99,235,.55); }
      .sx-session-count {
        font-size:11px; color:#2d3d55; font-weight:600;
      }

      /* Settings UI */
      .sx-settings-card {
        background:linear-gradient(135deg,rgba(37,99,235,.06),rgba(37,99,235,.02));
        border:1px solid rgba(37,99,235,.18);
        border-radius:16px;
        padding:20px 22px;
      }
      .sx-toggle-row {
        display:flex; align-items:center; justify-content:space-between;
        margin-bottom:16px;
      }
      .sx-toggle-label h4 { font-size:14px; font-weight:700; color:#0F172A; margin-bottom:3px; }
      .sx-toggle-label p  { font-size:12px; color:#4a6080; line-height:1.5; }
      .sx-toggle-switch {
        position:relative; display:inline-block;
        width:50px; height:28px; cursor:pointer; flex-shrink:0;
      }
      .sx-toggle-switch input { opacity:0; width:0; height:0; position:absolute; }
      .sx-slider {
        position:absolute; inset:0;
        background:#2d1200; border-radius:14px;
        transition:.3s;
      }
      .sx-slider::before {
        content:''; position:absolute;
        width:22px; height:22px;
        left:3px; top:3px;
        background:#fff; border-radius:50%;
        transition:.3s;
        box-shadow:0 2px 5px rgba(0,0,0,.4);
      }
      input:checked + .sx-slider { background:#2563EB; }
      input:checked + .sx-slider::before { left:25px; }

      /* Mobile responsive */
      @media (max-width: 480px) {
        #sxAiModal {
          bottom:80px;
          right:14px;
          left:14px;
          width:auto;
          max-height:calc(100vh - 160px);
        }
        #sxAiBtn { bottom:80px; right:14px; }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── All 25 guide steps ───────────────────────────────────────────────── */
  const STEPS = [
    {
      id:'welcome', section:null, icon:'✦',
      title:'Welcome to STRATIX!',
      body: d => `Namaste${d.name ? ', <strong>' + d.name + '</strong>' : ''}! I'm your <strong>STRATIX AI Guide</strong> — your personal business intelligence assistant.\n\nI know your entire app inside-out. I'll walk you through all <strong>35 features</strong> using <strong>your real business data</strong> — every tip is personalised to your actual numbers.\n\n✨ New in v5.0: Route Optimizer, POS Barcode, Loyalty Points, AMC Tracker, Appointments, EMR, TDS Tracker, ESG Score, Variants, Timesheets, Contractors, Site Logs & Table Manager.\n\nYou've chosen <strong>${d.maxSessions} guide sessions</strong>. Let's unlock the full power of STRATIX v5.0!\n\n<div class="sx-tip">💡 Tap <strong>Show Me →</strong> to jump directly to each feature, or <strong>Next</strong> to read the next tip.</div>`,
      action:null
    },
    {
      id:'dashboard', section:'dashboard', icon:'🏠',
      title:'Your Business Command Centre',
      body: d => `This is your live business dashboard — everything at a glance.\n\n📊 Revenue this month: <strong>${d.sym}${d.fmt(d.thisMonthRev)}</strong>\n💸 Expenses: <strong>${d.sym}${d.fmt(d.thisMonthExp)}</strong>\n💰 Net Profit: <strong style="color:${d.thisMonthRev-d.thisMonthExp>=0?'#00d68f':'#e84040'}">${d.sym}${d.fmt(Math.abs(d.thisMonthRev-d.thisMonthExp))}</strong>\n\nThe <strong>Health Score</strong> gives your business a letter grade. Green = healthy, red = action needed.\n\n<div class="sx-tip">💡 Tap any KPI card to drill down into details. The Quick Actions row at the bottom saves you navigation time.</div>`,
      action:'dashboard'
    },
    {
      id:'datamanager', section:'datamanager', icon:'🗄️',
      title:'Track Every Rupee In & Out',
      body: d => `Data Manager is the heart of STRATIX. Every transaction you record here powers the entire app.\n\n📥 <strong>Revenue</strong> — freight income, contract payments, advances\n📤 <strong>Expense</strong> — fuel, driver salary, maintenance, tolls\n🚛 <strong>Logistics</strong> — trip-linked expense entries\n\nYou have <strong>${d.txnCount} transaction${d.txnCount!==1?'s':''}</strong> recorded right now.\n\n<div class="sx-tip">💡 Tap <strong>+ Add Entry</strong> and record this week's income. Takes under 30 seconds. The more you enter, the smarter STRATIX gets.</div>\n<div class="sx-check">✅ CSV Export works — open your transactions directly in Excel to share with your CA.</div>`,
      action:'datamanager'
    },
    {
      id:'analytics', section:'analytics', icon:'📊',
      title:'See Your Business Trends',
      body: d => `Analytics shows your last 6 months of business performance — so you can spot growth or decline before it's too late.\n\n📈 Revenue trend — are you growing each month?\n📉 Expense trend — are costs rising too fast?\n🏷️ Category breakdown — where money comes from and goes\n\n${d.thisMonthRev > 0 ? `Your strongest revenue source this month is <strong>${d.topCategory}</strong>. Double down on what's working.` : 'Add a few transactions in Data Manager, then come back — your trends will appear here automatically.'}\n\n<div class="sx-tip">💡 Check Analytics every Sunday evening. 10 minutes of review = better decisions all week.</div>`,
      action:'analytics'
    },
    {
      id:'trippnl', section:'trippnl', icon:'🛣️',
      title:'Is Each Trip Actually Profitable?',
      body: d => `Most transport owners don't know if individual trips make money. Trip P&L solves this.\n\nBefore every trip, enter:\n• Freight charge to client\n• Fuel cost\n• Toll charges  \n• Driver allowance\n• Loading & unloading\n\nSTRATIX instantly shows: <strong>Profit or Loss on this trip.</strong>\n\n<div class="sx-check">✅ Every trip you save automatically syncs to your Dashboard — no double-entry needed.</div>\n<div class="sx-tip">💡 Try your last trip right now. You might be surprised if it was really profitable after all costs.</div>`,
      action:'trippnl'
    },
    {
      id:'fleet', section:'fleet', icon:'🚛',
      title:'Fleet Manager — Every Vehicle Tracked',
      body: d => `${d.fleetCount > 0 ? `You have <strong>${d.fleetCount} vehicle${d.fleetCount!==1?'s':''}</strong> in your fleet with <strong>${d.fleetUtil}% average utilization</strong>.` : "You haven't added any vehicles yet. Add them to unlock full fleet intelligence."}\n\n📍 Per-vehicle revenue, cost & profit\n🔧 Maintenance schedule alerts\n📊 Utilization % comparison across fleet\n🚛 Driver assignment tracking\n\n<div class="sx-tip">💡 A vehicle sitting idle = money lost. Fleet Manager tells you which trucks to prioritize for next dispatch.</div>`,
      action:'fleet'
    },
    {
      id:'documents', section:'documents', icon:'📄',
      title:'Professional Documents in One Tap',
      body: d => `Generate GST-ready invoices, delivery notes, receipts and 8 more document types — print or save as PDF instantly.\n\n📋 <strong>Tax Invoice</strong> — GSTIN, HSN, CGST/SGST breakdown\n🧾 <strong>Receipt</strong> — payment acknowledgement\n📦 <strong>Delivery Note</strong> — goods movement record\n📝 <strong>Cargo Manifest</strong> — freight listing\n\n${d.bizName ? `All documents are branded with <strong>${d.bizName}</strong>.` : '<div class="sx-warn">⚠️ Add your Business Name in Settings — it appears on every document you generate.</div>'}\n\n<div class="sx-tip">💡 Invoice numbers are sequential and never repeat. Your accountant will love this.</div>`,
      action:'documents'
    },
    {
      id:'logisticsdocs', section:'logisticsdocs', icon:'📋',
      title:'12 Transport Documents Ready',
      body: () => `Every document a transport business needs — all 12 ready to fill and print:\n\n📄 LR (Lorry Receipt), Freight Invoice, E-Way Bill\n📋 Hire Agreement, Consignment Note, Delivery Challan\n✅ POD (Proof of Delivery), Weighment Slip, Fuel Log\n👨‍✈️ Driver Log, Vehicle Fitness Tracker, Fleet Report\n\nAll documents auto-fill your business name, address and GSTIN from Settings.\n\n<div class="sx-tip">💡 Generate an LR for your next trip. It creates a legally-valid document in 2 minutes flat.</div>`,
      action:'logisticsdocs'
    },
    {
      id:'gst', section:'gst', icon:'🧾',
      title:'GST Calculator — Never Overpay',
      body: d => `GST filing is mandatory and mistakes are expensive. STRATIX makes it foolproof.\n\n🔢 <strong>Intrastate (CGST+SGST)</strong> — same state transactions\n🔢 <strong>Interstate (IGST)</strong> — cross-state transactions\n📊 <strong>GST Summary</strong> — export GSTR report for your CA\n\n${d.gstNumber ? `Your GSTIN <strong>${d.gstNumber}</strong> auto-appears on all invoices.` : '<div class="sx-warn">⚠️ GSTIN not set. Add it in Settings → it appears on every tax invoice automatically.</div>'}\n\n<div class="sx-tip">💡 Use the calculator before raising invoices to get the exact breakup right every time.</div>`,
      action:'gst'
    },
    {
      id:'salary', section:'salary', icon:'💸',
      title:'Correct Payroll — Every Month',
      body: d => `Salary errors mean legal trouble. STRATIX calculates every deduction automatically.\n\n✅ <strong>PF:</strong> 12% employee + 12% employer\n✅ <strong>ESI:</strong> 0.75% emp + 3.25% employer (gross ≤ ₹21,000)\n✅ <strong>TDS:</strong> Budget 2025 rates with ₹12L rebate\n✅ <strong>Prof. Tax:</strong> Correct slab for ${d.state}\n\n${d.empCount > 0 ? `You have <strong>${d.empCount} employee${d.empCount!==1?'s':''}</strong> on payroll.` : 'Add employees to start generating correct payslips.'}\n\n<div class="sx-tip">💡 Generate a payslip — it prints with your company logo and signature line, ready for your employee.</div>`,
      action:'salary'
    },
    {
      id:'bank', section:'bank', icon:'🏦',
      title:'All Bank Accounts in One View',
      body: d => `Track all your business accounts together — current, savings, OD/CC — without switching apps.\n\n💳 Live balances at a glance\n📥 Import bank statement CSV from NetBanking\n🔄 Auto-categorize: fuel, salary, freight, misc\n📊 Cash flow per account\n\n${d.bankCount > 0 ? `You have <strong>${d.bankCount} account${d.bankCount!==1?'s':''}</strong> connected.` : 'Add your primary business current account to start.'}\n\n<div class="sx-tip">💡 Import your last 3 months of bank statements. STRATIX auto-categorizes transactions so you don't have to enter them manually.</div>`,
      action:'bank'
    },
    {
      id:'whatsapp', section:'whatsapp', icon:'📱',
      title:'Collect Payments 3× Faster',
      body: d => `Send professional payment reminders via WhatsApp — with the right tone for every situation.\n\n🟢 <strong>Gentle</strong> — for good long-term clients\n🟡 <strong>Firm</strong> — for overdue payments\n🔴 <strong>Urgent</strong> — for severely overdue amounts\n\n${d.overdueCount > 0 ? `<div class="sx-warn">⚠️ <strong>${d.overdueCount} client${d.overdueCount!==1?'s have':' has'}</strong> outstanding dues right now! Tap Remind to send a WhatsApp in one tap.</div>` : 'Add clients with pending amounts in Invoice Aging to use this feature.'}\n\n<div class="sx-tip">💡 Messages open directly in WhatsApp pre-filled. One tap to send — no typing needed.</div>`,
      action:'whatsapp'
    },
    {
      id:'invoiceaging', section:'invoiceaging', icon:'💰',
      title:'Who Owes You — Exactly How Long',
      body: d => `Invoice Aging shows exactly which clients haven't paid and for how long.\n\n🟢 <strong>0–30 days</strong> — normal, just monitor\n🟡 <strong>31–60 days</strong> — send a reminder today\n🔴 <strong>60+ days</strong> — serious risk, consider pausing services\n\n${d.clientCount > 0 ? `You have <strong>${d.clientCount} client${d.clientCount!==1?'s':''}</strong> in the system.` : 'Add clients with their outstanding amounts to track collections.'}\n\n<div class="sx-tip">💡 Click 📱 Remind next to any client — it fires a WhatsApp reminder with the exact amount and date in the message.</div>`,
      action:'invoiceaging'
    },
    {
      id:'earlywarning', section:'earlywarning', icon:'⚠️',
      title:'Catch Problems Before They Explode',
      body: d => `Early Warning scans your data for danger signals — automatically.\n\n🔴 Revenue falling 2+ months in a row\n🔴 Expenses growing faster than revenue\n🔴 Profit margin below 15%\n🔴 Clients unpaid 60+ days\n🟡 Fleet utilization dropping\n🟡 Cash flow turning negative\n\n${d.txnCount > 5 ? 'Your data is being actively monitored. Check this section monthly.' : '<div class="sx-tip">Add more transactions to activate the full warning system — it needs at least 2 months of data.</div>'}\n\n<div class="sx-tip">💡 Check Early Warning once a month. It takes 30 seconds and can save your business from a blind-side crisis.</div>`,
      action:'earlywarning'
    },
    {
      id:'goals', section:'goals', icon:'🎯',
      title:'Set Targets. Track Progress.',
      body: d => `A business without goals just drifts. STRATIX Goals keeps you focused.\n\nExample targets:\n🎯 Monthly revenue: ₹5 Lakh\n🚛 Fleet utilization: 85%\n👥 New clients this month: 10\n💰 Reduce fuel cost by 8%\n\n${d.goalCount > 0 ? `You have <strong>${d.goalCount} active goal${d.goalCount!==1?'s':''}</strong>. Great discipline!` : "You haven't set goals yet — every business that grows has written targets."}\n\n<div class="sx-tip">💡 Set your revenue target for this month right now. STRATIX tracks progress against it automatically. Takes 30 seconds.</div>`,
      action:'goals'
    },
    {
      id:'reminders', section:'reminders', icon:'🔔',
      title:'Never Miss a Compliance Deadline',
      body: () => `STRATIX checks for overdue reminders every time you open the app.\n\nCritical dates to track:\n📅 <strong>GST filing</strong> — 20th of every month\n💸 <strong>PF payment</strong> — 15th of every month\n📋 <strong>Vehicle fitness renewal</strong>\n🔧 <strong>Truck service schedule</strong>\n💰 <strong>Client payment follow-ups</strong>\n\nIf you have an overdue reminder, you'll see an alert the moment you open the app.\n\n<div class="sx-tip">💡 Set your next GST filing reminder right now — it's the most common compliance failure for small businesses.</div>`,
      action:'reminders'
    },
    {
      id:'notes', section:'notes', icon:'📝',
      title:'Smart Business Notes',
      body: () => `Not everything fits in a spreadsheet. Smart Notes gives you a clean place to think.\n\nUse it for:\n📝 Meeting notes with clients\n💭 Business ideas you don't want to forget\n📋 Checklists for recurring tasks\n🔖 Important phone numbers and contacts\n\nNotes are private, stored on your device, and searchable.\n\n<div class="sx-tip">💡 After your next client meeting, open Notes and write down what was discussed and what was promised. Your future self will thank you.</div>`,
      action:'notes'
    },
    {
      id:'loan', section:'loan', icon:'🏦',
      title:'Know Your Borrowing Power',
      body: d => `Before walking into a bank, know if you'll qualify and how much you can get.\n\nSTRATIX calculates:\n📊 Your estimated Business Credit Score\n💰 Maximum loan amount based on revenue\n📋 Exactly what documents banks require\n⚡ Which loan type suits your need\n\n${d.thisMonthRev > 0 ? `Based on your revenue pattern, estimated max loan: <strong>${d.sym}${d.fmt(d.thisMonthRev * 18)}</strong>.` : 'Add 3+ months of revenue data to get an accurate loan estimate.'}\n\n<div class="sx-tip">💡 Open Loan Readiness to see your full financial health report — even if you don't need a loan right now, it's good to know where you stand.</div>`,
      action:'loan'
    },
    {
      id:'erp', section:'erp', icon:'🏭',
      title:'ERP — Full Business Operations',
      body: () => `If you run a factory, trading firm, or service business, ERP manages your entire operation.\n\n📦 <strong>Inventory</strong> — stock levels, low-stock alerts\n📋 <strong>Sales Orders</strong> — end-to-end order management\n🛒 <strong>Purchase Orders</strong> — track supplier orders\n⚙️ <strong>Job Work</strong> — production job management\n💰 <strong>Accounts</strong> — payable and receivable\n\nAll modules connect: a sales order auto-reduces inventory, a PO auto-creates a payable.\n\n<div class="sx-tip">💡 If you run transport only, use Logistics Docs instead of ERP. ERP is built for manufacturing and trading businesses.</div>`,
      action:'erp'
    },
    {
      id:'crm', section:'crm', icon:'🤝',
      title:'Never Let a Good Lead Go Cold',
      body: d => `Your clients are your biggest asset. CRM helps you manage every relationship.\n\n👥 <strong>Leads pipeline</strong> — track prospects to close\n📞 <strong>Contacts</strong> — full directory with call history\n💼 <strong>Deal tracker</strong> — see every deal's stage visually\n📅 <strong>Follow-up calendar</strong> — no lead goes cold\n\n${d.clientCount > 0 ? `You have <strong>${d.clientCount} client${d.clientCount!==1?'s':''}</strong> tracked.` : 'Add your top 3 clients right now — name, phone, and outstanding amount.'}\n\n<div class="sx-tip">💡 Set a follow-up reminder on every new lead. Most deals close on the 4th or 5th contact, not the first.</div>`,
      action:'crm'
    },
    {
      id:'strategy', section:'strategy', icon:'📈',
      title:'Strategy Builder — Your Growth Roadmap',
      body: d => `Strategy Builder creates a personalised growth plan using your actual numbers.\n\n📣 <strong>Marketing Strategy</strong> — how to reach more clients\n📈 <strong>Growth Plan</strong> — step-by-step path to your revenue target\n✂️ <strong>Cost Reduction</strong> — where to cut without hurting operations\n👥 <strong>Client Acquisition</strong> — how many new clients you need\n\n${d.thisMonthRev > 0 ? `All fields pre-fill with your numbers — <strong>${d.sym}${d.fmt(d.thisMonthRev)}</strong> revenue this month.` : 'Once you have some transactions, this becomes a very powerful planning tool.'}\n\n<div class="sx-tip">💡 Run Strategy Builder at the start of every quarter. Set your 90-day target and the app tells you exactly how to hit it.</div>`,
      action:'strategy'
    },
    {
      id:'ai_advisor', section:'ai_advisor', icon:'🤖',
      title:'AI Business Advisor — Your 24/7 CFO',
      body: d => `Ask your AI Advisor anything about your business:\n\n💬 <em>"Why are my expenses so high this month?"</em>\n💬 <em>"How can I improve profit margin?"</em>\n💬 <em>"Am I ready for a bank loan?"</em>\n💬 <em>"What should I focus on next quarter?"</em>\n\nIt answers like a real CFO — with specific advice based on <strong>your actual numbers</strong>, not generic tips.\n\n${d.hasApiKey ? '<div class="sx-check">✅ Your AI Advisor is connected and ready!</div>' : '<div class="sx-tip">💡 Get a free API key at console.anthropic.com → API Keys → Create. Paste it in Settings → AI Advisor. It takes 2 minutes.</div>'}`,
      action:'ai_advisor'
    },
    {
      id:'settings', section:'settings', icon:'⚙️',
      title:'Settings — Make STRATIX Truly Yours',
      body: d => `Three minutes in Settings unlocks the full power of STRATIX.\n\n🏢 Business name, address, GSTIN, PAN\n🏦 Bank details (appear on invoices automatically)\n💱 Currency symbol (₹ by default)\n🗺️ State (affects Professional Tax slab)\n📋 Invoice prefix: INV, BILL, TRN, etc.\n\n${d.bizName ? `<div class="sx-check">✅ Business name set: <strong>${d.bizName}</strong></div>` : '<div class="sx-warn">⚠️ Business name not set. It appears on every invoice you generate.</div>'}\n${d.gstNumber ? `<div class="sx-check">✅ GSTIN: <strong>${d.gstNumber}</strong></div>` : '<div class="sx-warn">⚠️ GSTIN not set — required for tax invoices.</div>'}`,
      action:'settings'
    },
    {
      id:'export', section:'settings', icon:'💾',
      title:'Protect Your Business Data',
      body: () => `Your STRATIX data lives on this device. One wrong tap can erase it. Protect yourself:\n\n✅ <strong>Export JSON</strong> — full backup, restores everything\n✅ <strong>Export CSV</strong> — share with CA directly in Excel\n✅ <strong>Import</strong> — restore on any device anytime\n\n<div class="sx-warn">⚠️ Clearing browser data or using a different browser will delete your data — unless you've exported it first.</div>\n\n<div class="sx-tip">💡 Every Friday evening: Settings → Export → save the file to Google Drive or WhatsApp yourself. Takes 5 seconds. Do it now.</div>`,
      action:'settings'
    },
    {
      id:'route_optimizer', section:'route_optimizer', icon:'🗺️',
      title:'Route Optimizer — Cut Fuel Costs Now',
      body: d => `✨ <strong>New in v5.0</strong>\n\nBefore every trip, calculate the real cost — fuel, tolls, driver allowance — across multi-stop routes.\n\n🗺️ Origin → stops → destination, any combination\n⛽ Vehicle type × fuel price = exact litres burned\n🛣️ Toll + driver allowance breakdown\n📜 Every calculation saved to history\n\n${d.txnCount > 0 ? `You have ${d.txnCount} transactions — route costs flow straight into Trip P&L.` : 'Use this before every trip to know exactly if your quoted rate is profitable.'}\n\n<div class="sx-tip">💡 If total route cost exceeds 70% of your freight rate, the trip barely makes money. Adjust rate or cut stops before committing.</div>`,
      action:'route_optimizer'
    },
    {
      id:'maintenance', section:'maintenance', icon:'🔧',
      title:'Maintenance Scheduler — Auto Alerts',
      body: d => `✨ <strong>New in v5.0</strong>\n\nMaintenance Scheduler reads your logged trip mileage and auto-alerts when service is due.\n\n🛢️ Oil change — trigger at X km or by date\n🔄 Tyre rotation / replacement schedule\n📋 Permit + insurance renewals by date\n🔔 Auto-creates Reminders for every schedule\n\n${d.fleetCount > 0 ? `Your fleet has <strong>${d.fleetCount} vehicle${d.fleetCount !== 1 ? 's' : ''}</strong> — set a schedule for each one today.` : 'Add vehicles to Fleet Manager first, then schedule maintenance for each.'}\n\n<div class="sx-tip">💡 A blown tyre mid-route costs ₹15,000+. A ₹3,000 rotation every 20,000 km prevents it. Set schedules now.</div>`,
      action:'maintenance'
    },
    {
      id:'tds_tracker', section:'tds_tracker', icon:'🧾',
      title:'TDS / TCS — Track Every Deduction',
      body: d => `✨ <strong>New in v5.0</strong>\n\nIf your business turnover exceeds ₹75L, TDS under 194C is mandatory. Track it here.\n\n📤 TDS you deduct from contractor/vendor payments\n📥 TDS deducted from you by large corporate buyers\n🧮 Quick calculator — 194C, 194J, 194H, 194Q and more\n📋 Challan number tracking for quarterly returns\n\n${d.gstNumber ? `GSTIN set — TDS returns must match your GST filings.` : '<div class="sx-warn">⚠️ Add GSTIN in Settings — it must match your TDS challan details.</div>'}\n\n<div class="sx-tip">💡 Print this ledger for your CA every quarter. It tells them exactly which TDS certificates to collect from buyers.</div>`,
      action:'tds_tracker'
    },
    {
      id:'esg_tracker', section:'esg_tracker', icon:'🌱',
      title:'ESG Tracker — Build a Verified Green Report',
      body: d => `✨ <strong>New in v5.0</strong>\n\nLarge companies increasingly need ESG data from vendors before awarding contracts.\n\n⛽ Fuel consumed → CO₂ kg (diesel: 2.68 kg/L)\n⚡ Electricity used → CO₂ kg (grid: 0.82 kg/kWh)\n💧 Water consumption and waste tracking\n🏆 ESG grade A/B/C/D based on actual emissions\n🌳 Tree offset calculator\n\n${d.esgEntries > 0 ? `You have ${d.esgEntries} ESG log entries so far.` : 'Start logging monthly — 3 months of consistent data builds a credible ESG report.'}\n\n<div class="sx-tip">💡 Some government tenders now score vendors on ESG. Log fuel data consistently — it doubles as your fleet cost report too.</div>`,
      action:'esg_tracker'
    },
    {
      id:'amc_tracker', section:'amc_tracker', icon:'📋',
      title:'AMC Tracker — Never Lose a Contract',
      body: d => `✨ <strong>New in v5.0</strong>\n\nFor service businesses — every Annual Maintenance Contract tracked, every renewal alerted.\n\n📋 30-day renewal alerts before expiry\n🔧 Service visit logging per contract\n💰 Full contract value tracking\n🔔 Reminder auto-created for every renewal date\n\n${d.amcRenewing > 0 ? `<div class="sx-warn">⚠️ ${d.amcRenewing} AMC contract${d.amcRenewing !== 1 ? 's are' : ' is'} renewing within 30 days — act now!</div>` : d.clientCount > 0 ? `You have ${d.clientCount} clients — add an AMC for every one on a service contract.` : 'Add your first AMC contract to start tracking renewals.'}\n\n<div class="sx-tip">💡 A missed AMC renewal = 1 full year of that contract's revenue lost instantly. This pays for itself the first alert it fires.</div>`,
      action:'amc_tracker'
    },
    {
      id:'loyalty', section:'loyalty', icon:'⭐',
      title:'Loyalty Points — Bring Customers Back',
      body: d => `✨ <strong>New in v5.0</strong>\n\nEvery named POS sale automatically earns points. Customer redeems on next visit.\n\n⭐ 1 point earned per ₹100 spent\n💰 1 point = ₹1 discount on redemption\n🥇 Gold / Silver / Bronze member tiers\n📷 Barcode scanner — scan SKU → instantly adds to bill\n\n${d.loyaltyMembers > 0 ? `You have <strong>${d.loyaltyMembers} loyalty member${d.loyaltyMembers !== 1 ? 's' : ''}</strong> already.` : 'Points earn automatically the moment you name a customer in POS billing.'}\n\n<div class="sx-tip">💡 Tell every customer they've earned points. Shops that do this see 40%+ higher repeat visits within 3 months.</div>`,
      action:'loyalty'
    },
    {
      id:'appointments', section:'appointments', icon:'📅',
      title:'Appointment Scheduler — Zero No-Shows',
      body: d => `✨ <strong>New in v5.0</strong>\n\nFor clinics, consultants, salons — full appointment management with billing integration.\n\n🗓️ Today's schedule as a timeline view\n✅ Confirmed / Pending / Completed / Cancelled\n💰 Mark Done → consultation fee auto-records as revenue\n🔔 Reminder auto-created on every new booking\n\n${d.todayAppts > 0 ? `You have <strong>${d.todayAppts} appointment${d.todayAppts !== 1 ? 's' : ''}</strong> today.` : d.overdueAppts > 0 ? `<div class="sx-warn">⚠️ ${d.overdueAppts} past appointment${d.overdueAppts !== 1 ? 's' : ''} not marked done — update their status.</div>` : 'Add your first appointment — it creates a reminder and tracks your revenue automatically.'}\n\n<div class="sx-tip">💡 Always mark appointments Done rather than deleting them. Each one auto-fills your monthly revenue report.</div>`,
      action:'appointments'
    },
    {
      id:'patient_history', section:'patient_history', icon:'🏥',
      title:'Patient Records — Secure & Instant',
      body: d => `✨ <strong>New in v5.0</strong>\n\nElectronic medical records stored only on your device — never uploaded anywhere.\n\n🏥 Patient profile: age, gender, blood group, allergies\n📋 Per-visit: complaint, diagnosis, prescription, notes\n💰 Consultation fee auto-records to revenue on save\n🔒 100% private — no server, no cloud, no sharing\n\n<div class="sx-warn">⚠️ Patient data is sensitive. Export a backup weekly. Clearing browser storage deletes records permanently.</div>\n\n<div class="sx-tip">💡 Enter allergy information as soon as you register a patient. The red allergy alert appears on every future visit card — it could prevent a medical emergency.</div>`,
      action:'patient_history'
    },
    {
      id:'timesheets', section:'timesheets', icon:'⏱️',
      title:'Timesheets — Bill Every Hour You Work',
      body: d => `✨ <strong>New in v5.0</strong>\n\nFor lawyers, agencies, consultants — track every billable hour per client.\n\n⏱️ Log hours with date, client and task description\n💰 Rate per hour × hours = exact invoice amount\n📊 Unbilled total per client shown at a glance\n✅ Mark Billed → auto-records revenue transaction\n\n${d.clientCount > 0 ? `Your ${d.clientCount} CRM clients auto-populate in timesheet dropdowns.` : 'Add clients to CRM — they auto-appear in timesheet client dropdowns.'}\n\n<div class="sx-tip">💡 Log hours every single day, not at month end. Memory is unreliable — you always under-bill when you wait. Log now, invoice later.</div>`,
      action:'timesheets'
    },
    {
      id:'contractors', section:'contractors', icon:'👷',
      title:'Contractor Management — Track Every Rupee',
      body: d => `✨ <strong>New in v5.0</strong>\n\nFor builders and project managers — manage contractors and work orders without spreadsheets.\n\n👷 Contractor directory with trade and star rating\n📋 Work orders: total contracted vs paid tracking\n💸 Partial payments — each auto-records as expense\n🔴 Outstanding balance highlighted per work order\n\n${d.pendingWO > 0 ? `You have <strong>${d.pendingWO} active work order${d.pendingWO !== 1 ? 's' : ''}</strong> with ${STRATIX_DB.getSettings().currencySymbol || '₹'}${d.woBalance.toLocaleString('en-IN')} outstanding.` : 'Add contractors and work orders to start tracking site payments.'}\n\n<div class="sx-tip">💡 Never pay a contractor in full upfront. Split payments: 30% advance, 40% midpoint, 30% completion. The work order tracker enforces this structure automatically.</div>`,
      action:'contractors'
    },
    {
      id:'omnichannel', section:'omnichannel', icon:'🔄',
      title:'Omnichannel Sync — Never Oversell',
      body: d => `✨ <strong>New in v5.0</strong>\n\nSell on Amazon, Flipkart, Meesho, Myntra and your own store — one stock count across all.\n\n🏪 Physical store (STRATIX POS) = master stock\n📡 Add each marketplace as a channel\n⚠️ Instantly see which items are out of sync\n🔄 One-tap sync updates all channel quantities\n📋 Full sync log for compliance\n\n${d.clientCount > 0 ? `You already have ${d.clientCount} clients — if any buy from multiple channels, this prevents overselling.` : 'Add your marketplace channels to start syncing stock.'}\n\n<div class="sx-tip">💡 Run Sync All after every POS billing session. It takes 2 seconds and prevents the embarrassment of selling items you don\'t have in stock on a marketplace.</div>`,
      action:'omnichannel'
    },
    {
      id:'final', section:null, icon:'🎉',
      title:"You've Mastered STRATIX!",
      body: d => `Congratulations${d.name ? ', <strong>' + d.name + '</strong>' : ''}! You've mastered all <strong>35 features</strong> of STRATIX v5.0.\n\n<strong>Your action list for this week:</strong>\n1. Fill in Settings (business name, GSTIN, bank)\n2. Add this week's income & expenses\n3. Generate one invoice for a client\n4. Set your monthly revenue target in Goals\n5. Export a backup on Friday\n\n<div class="sx-check">✅ The <strong>✦ button</strong> is always there — tap it anytime to revisit any feature guide.</div>\n\nYour business intelligence journey is just beginning. <strong>Grow smart. 🚀</strong>`,
      action:null
    }
  ];

  /* ── State helpers ────────────────────────────────────────────────────── */
  const SK = 'sx_ai_guide_v5';

  function _state()  { try { return JSON.parse(localStorage.getItem(SK)) || {}; } catch { return {}; } }
  function _save(s)  { try { localStorage.setItem(SK, JSON.stringify(s)); } catch(e) {} }
  function _enabled(){ if(typeof STRATIX_DB==='undefined') return false; const s=STRATIX_DB.getSettings(); return s.stratixAiEnabled !== false; }
  function _maxS()   { if(typeof STRATIX_DB==='undefined') return 20; const s=STRATIX_DB.getSettings(); return parseInt(s.stratixAiMaxSessions) || 20; }

  /* ── Context builder ──────────────────────────────────────────────────── */
  function _ctx() {
    if(typeof STRATIX_DB==='undefined'||typeof STRATIX_AUTH==='undefined') return {name:'',bizName:'',gstNumber:'',state:'Maharashtra',sym:'₹',fmt:n=>Math.round(n||0).toString(),txnCount:0,thisMonthRev:0,thisMonthExp:0,topCategory:'freight',fleetCount:0,fleetUtil:0,empCount:0,bankCount:0,clientCount:0,overdueCount:0,goalCount:0,hasApiKey:false,maxSessions:20};
    const sess = STRATIX_AUTH.getSession() || {};
    const set  = STRATIX_DB.getSettings();
    const txns = STRATIX_DB.getArr('transactions');
    const now  = new Date();
    const mo   = txns.filter(t=>{ const d=new Date(t.date||t.createdAt); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
    const rev  = mo.filter(t=>t.type==='revenue').reduce((s,t)=>s+t.amount,0);
    const exp  = mo.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const cats = {}; txns.filter(t=>t.type==='revenue').forEach(t=>{cats[t.category]=(cats[t.category]||0)+t.amount;});
    const topCat = Object.entries(cats).sort((a,b)=>b[1]-a[1])[0]?.[0]||'freight';
    const fleet = STRATIX_DB.getArr('fleet');
    const sym = set.currencySymbol || '₹';
    const fmt = n => { n=Math.abs(n||0); if(n>=10000000)return(n/10000000).toFixed(1)+'Cr'; if(n>=100000)return(n/100000).toFixed(1)+'L'; if(n>=1000)return(n/1000).toFixed(1)+'K'; return Math.round(n).toLocaleString('en-IN'); };
    const maintSchedules = STRATIX_DB.getArr('maintenance_schedule');
    const amcContracts   = STRATIX_DB.getArr('amc_contracts');
    const loyaltyRecs    = STRATIX_DB.getArr('loyalty_points');
    const appointments   = STRATIX_DB.getArr('appointments');
    const workOrders     = STRATIX_DB.getArr('work_orders');
    const esgEntries     = STRATIX_DB.getArr('esg_entries');
    const today          = new Date().toISOString().split('T')[0];
    const todayAppts     = appointments.filter(a => a.date === today).length;
    const overdueAppts   = appointments.filter(a => a.date < today && a.status !== 'completed' && a.status !== 'cancelled').length;
    const pendingWO      = workOrders.filter(w => w.status !== 'completed').length;
    const woBalance      = workOrders.reduce((s,w)=>s+Math.max(0,Number(w.totalAmt||0)-Number(w.paidAmt||0)),0);
    const amcRenewing    = amcContracts.filter(a => { try { return a.renewalDate && new Date(a.renewalDate) <= new Date(Date.now()+30*24*60*60*1000) && new Date(a.renewalDate) >= new Date(); } catch{return false;} }).length;
    const loyaltyMembers = loyaltyRecs.length;
    return {
      name:sess.name||'', bizName:set.businessName||'', gstNumber:set.gstNumber||'',
      state:set.state||'Maharashtra', sym, fmt,
      txnCount:txns.length, thisMonthRev:rev, thisMonthExp:exp, topCategory:topCat,
      fleetCount:fleet.length, fleetUtil:fleet.length?Math.round(fleet.reduce((s,v)=>s+v.utilization,0)/fleet.length):0,
      empCount:STRATIX_DB.getArr('employees').length,
      bankCount:STRATIX_DB.getArr('bankAccounts').length,
      clientCount:STRATIX_DB.getArr('clients').length,
      overdueCount:STRATIX_DB.getArr('clients').filter(c=>c.outstanding>0).length,
      goalCount:STRATIX_DB.getArr('goals').length,
      hasApiKey:!!(set.anthropicApiKey),
      maxSessions:_maxS(),
      // v5.0 new context
      maintSchedules: maintSchedules.length,
      amcRenewing, loyaltyMembers, todayAppts, overdueAppts,
      pendingWO, woBalance, esgEntries: esgEntries.length
    };
  }

  /* ── Session pip dots ─────────────────────────────────────────────────── */
  function _pipsHtml(used, max) {
    const show = Math.min(max, 20);
    let h = '';
    for (let i = 0; i < show; i++) {
      h += `<span class="sx-pip${i<used?' used':''}"></span>`;
    }
    if (max > 20) h += `<span style="font-size:10px;color:#2d3d55;margin-left:2px">+${max-20}</span>`;
    return h;
  }

  /* ── Render step ──────────────────────────────────────────────────────── */
  function showStep(stepId) {
    if (!_enabled()) return;
    _injectStyles();

    const state = _state();
    const maxS  = _maxS();
    const used  = state.sessionCount || 0;

    // Allow 'manual' to always show current step; gate auto-shows on session limit
    if (stepId !== 'manual' && stepId !== 'welcome' && used >= maxS) {
      if (typeof NOTIFY !== 'undefined') NOTIFY.show(`All ${maxS} guide sessions used. Increase in Settings → STRATIX AI.`, 'info', 4000);
      return;
    }

    // Resolve step
    let step, stepIdx;
    if (stepId === 'manual') {
      stepIdx = state.currentStepIndex || 0;
      step = STEPS[stepIdx];
    } else {
      stepIdx = STEPS.findIndex(s => s.id === stepId);
      if (stepIdx === -1) stepIdx = state.currentStepIndex || 0;
      step = STEPS[stepIdx];
    }
    if (!step) return;

    const ctx      = _ctx();
    const bodyText = typeof step.body === 'function' ? step.body(ctx) : step.body;
    const progress = Math.round((stepIdx / (STEPS.length - 1)) * 100);
    const isFirst  = stepIdx === 0;
    const isLast   = stepIdx === STEPS.length - 1;
    const newUsed  = (state.currentStepIndex === stepIdx && state.lastShown) ? used : used + 1;

    // Dismiss existing with animation
    _animateOut(() => _renderModal(step, stepIdx, bodyText, progress, isFirst, isLast, newUsed, maxS));

    // Update state
    state.currentStepIndex = stepIdx;
    state.sessionCount = Math.min(newUsed, maxS);
    state.lastShown = new Date().toISOString();
    _save(state);
  }

  function _animateOut(cb) {
    const existing = document.getElementById('sxAiModal');
    if (existing) {
      existing.classList.add('closing');
      setTimeout(cb, 180);
    } else {
      cb();
    }
  }

  function _renderModal(step, idx, bodyText, progress, isFirst, isLast, used, maxS) {
    const old = document.getElementById('sxAiModal');
    if (old) old.remove();

    // Build step dots (show max 15 to avoid overflow)
    const dotsCount = Math.min(STEPS.length, 15);
    const dotsStep  = Math.floor(STEPS.length / dotsCount);
    let dotsHtml = '';
    for (let i = 0; i < dotsCount; i++) {
      const si = i * dotsStep;
      const cls = si === idx ? 'active' : (si < idx ? 'done' : '');
      dotsHtml += `<span class="sx-dot ${cls}" onclick="STRATIX_AI._jumpTo(${si})" title="Step ${si+1}"></span>`;
    }

    const modal = document.createElement('div');
    modal.id = 'sxAiModal';
    modal.innerHTML = `
      <div class="sx-progress-track">
        <div class="sx-progress-fill" style="width:${progress}%"></div>
      </div>
      <div class="sx-header">
        <div class="sx-icon-wrap">${step.icon}</div>
        <div class="sx-header-meta">
          <div class="sx-step-title">${step.title}</div>
          <div class="sx-step-sub">
            <span class="sx-brand">✦ STRATIX AI</span>
            <span>·</span>
            <span>Step ${idx+1} of ${STEPS.length}</span>
          </div>
        </div>
        <button class="sx-close-btn" onclick="STRATIX_AI.dismiss()" aria-label="Close">✕</button>
      </div>
      <div class="sx-body">${bodyText.replace(/\n/g,'<br/>')}</div>
      <div class="sx-dots">${dotsHtml}</div>
      <div class="sx-footer">
        ${!isFirst ? `<button class="sx-btn-back" onclick="STRATIX_AI.prev()" title="Previous">←</button>` : ''}
        ${step.action ? `<button class="sx-btn-primary" onclick="STRATIX_AI.goTo('${step.action}')">Show Me →</button>` : ''}
        ${!isLast ? `<button class="sx-btn-ghost ${!step.action?'sx-btn-primary':''}" onclick="STRATIX_AI.next()">Next ${step.action ? '' : '→'}</button>` : ''}
        ${isLast ? `<button class="sx-btn-primary" onclick="STRATIX_AI.finish()">Finish Guide 🎉</button>` : ''}
      </div>
      <div class="sx-session-bar">
        <div class="sx-session-left">
          <div class="sx-session-pips">${_pipsHtml(Math.min(used,maxS), maxS)}</div>
        </div>
        <div class="sx-session-count">${Math.min(used,maxS)} / ${maxS} sessions</div>
      </div>
    `;

    document.body.appendChild(modal);
  }

  /* ── Navigation ───────────────────────────────────────────────────────── */
  function next() {
    const state = _state();
    const ni = Math.min((state.currentStepIndex || 0) + 1, STEPS.length - 1);
    showStep(STEPS[ni].id);
  }

  function prev() {
    const state = _state();
    const pi = Math.max((state.currentStepIndex || 0) - 1, 0);
    showStep(STEPS[pi].id);
  }

  function _jumpTo(idx) {
    showStep(STEPS[idx].id);
  }

  function goTo(sectionId) {
    dismiss();
    if (window.APP && sectionId) {
      setTimeout(() => window.APP.navigate(sectionId), 180);
    }
  }

  function dismiss() {
    const el = document.getElementById('sxAiModal');
    if (!el) return;
    el.classList.add('closing');
    setTimeout(() => { if (el.parentNode) el.remove(); }, 200);
  }

  function finish() {
    dismiss();
    const state = _state();
    state.completed = true;
    _save(state);
    if (typeof NOTIFY !== 'undefined') {
      NOTIFY.show('🎉 STRATIX guide complete! Tap ✦ anytime to review any tip.', 'success', 5000);
    }
  }

  /* ── Floating button ──────────────────────────────────────────────────── */
  function addFloatingButton() {
    if (document.getElementById('sxAiBtn')) return;
    _injectStyles();
    const btn = document.createElement('button');
    btn.id = 'sxAiBtn';
    btn.innerHTML = '✦';
    btn.title = 'STRATIX AI Guide';
    btn.setAttribute('aria-label', 'Open STRATIX AI Guide');
    if (!_enabled()) btn.classList.add('hide');

    btn.onclick = () => {
      const modal = document.getElementById('sxAiModal');
      if (modal) { dismiss(); return; }
      if (!_enabled()) {
        if (typeof NOTIFY !== 'undefined') NOTIFY.show('STRATIX AI is off. Enable it in Settings → STRATIX AI.', 'info');
        return;
      }
      const state = _state();
      const maxS  = _maxS();
      if ((state.sessionCount || 0) >= maxS) {
        if (typeof NOTIFY !== 'undefined') NOTIFY.show(`All ${maxS} sessions used. Increase limit in Settings → STRATIX AI.`, 'info', 4000);
        return;
      }
      showStep('manual');
    };

    document.body.appendChild(btn);
  }

  /* ── Auto trigger ─────────────────────────────────────────────────────── */
  function autoTrigger() {
    if (!_enabled()) return;
    const state = _state();
    const maxS  = _maxS();
    if ((state.sessionCount || 0) >= maxS) return;
    const lastShown  = state.lastShown ? new Date(state.lastShown) : null;
    const tenMinAgo  = new Date(Date.now() - 10 * 60 * 1000);
    if (lastShown && lastShown > tenMinAgo) return;
    setTimeout(() => {
      addFloatingButton();
      const idx = state.currentStepIndex || 0;
      showStep(STEPS[idx].id);
    }, 3000);
  }

  /* ── Settings UI ──────────────────────────────────────────────────────── */
  function getSettingsHTML() {
    if(typeof STRATIX_DB==='undefined') return '';
    const s          = STRATIX_DB.getSettings();
    const enabled    = s.stratixAiEnabled !== false;
    const maxSess    = parseInt(s.stratixAiMaxSessions) || 20;
    const state      = _state();
    const used       = state.sessionCount || 0;
    const pct        = maxSess > 0 ? Math.round((used / maxSess) * 100) : 0;
    const completed  = state.completed || false;
    const totalSteps = 35;
    const stepsComplete = Math.min(state.currentStepIndex || 0, totalSteps);

    return `
<div class="settings-group" id="stratixAiSettingsGroup">
  <div class="settings-group-title">✦ STRATIX AI Guide — v5.0</div>
  <div class="sx-settings-card">

    <div style="background:linear-gradient(135deg,rgba(37,99,235,.08),rgba(37,99,235,.03));border:1px solid rgba(37,99,235,.18);border-radius:12px;padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:12px">
      <div style="font-size:28px">✦</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:#0F172A">STRATIX AI Guide</div>
        <div style="font-size:11px;color:#4a6080;margin-top:2px">${totalSteps} guided steps · Uses your real business data · Personalised tips</div>
        <div style="font-size:10px;color:#2563EB;margin-top:4px;font-weight:700">✨ v5.0 — Now includes Route Optimizer, POS Barcode, Loyalty, AMC, Appointments, EMR, TDS, ESG, Timesheets, Contractors & more</div>
      </div>
      <label class="sx-toggle-switch" style="margin-left:auto;flex-shrink:0">
        <input type="checkbox" id="sxAiToggle" ${enabled?'checked':''} onchange="STRATIX_AI.toggleEnabled(this.checked)"/>
        <span class="sx-slider"></span>
      </label>
    </div>

    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#4a6080;text-transform:uppercase;letter-spacing:.7px;margin-bottom:10px">Maximum Guide Sessions</div>
      <div style="display:flex;align-items:center;gap:14px">
        <input type="range" id="sxMaxRange" min="5" max="50" step="5" value="${maxSess}"
          oninput="document.getElementById('sxMaxVal').textContent=this.value; STRATIX_AI.setMaxSessions(parseInt(this.value))"
          style="flex:1;accent-color:#2563EB;cursor:pointer;height:4px"/>
        <span id="sxMaxVal" style="font-size:18px;font-weight:800;color:#2563EB;min-width:40px;text-align:right">${maxSess}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#2d3d55;margin-top:5px">
        <span>5 sessions</span><span>50 sessions</span>
      </div>
    </div>

    <div style="background:rgba(0,0,0,.25);border-radius:12px;padding:14px 16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="font-size:12px;color:#4a6080">Sessions Used</span>
        <span style="font-size:13px;font-weight:700;color:#2563EB">${Math.min(used,maxSess)} / ${maxSess}</span>
      </div>
      <div style="height:5px;background:rgba(255,255,255,.06);border-radius:3px;overflow:hidden;margin-bottom:8px">
        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#2563EB,#ffca60);border-radius:3px;transition:width .5s ease"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:11px;color:#4a6080">Steps completed</span>
        <span style="font-size:12px;font-weight:700;color:${completed?'#00d68f':'#4a6080'}">${stepsComplete} / ${totalSteps} ${completed?'🎉':''}</span>
      </div>
      ${completed ? '<div style="font-size:11px;color:#00d68f;margin-top:6px;font-weight:600">🎉 You\'ve completed the full v5.0 guide!</div>' : ''}
    </div>

    <div style="display:flex;gap:8px">
      ${used > 0 ? `
      <button onclick="STRATIX_AI.resetProgress()" style="flex:1;padding:9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:10px;color:#5c6e8a;font-size:12px;cursor:pointer;font-family:var(--font);font-weight:600;transition:.15s" onmouseover="this.style.background='rgba(255,255,255,.08)'" onmouseout="this.style.background='rgba(255,255,255,.04)'">
        Reset Progress
      </button>` : ''}
      <button onclick="STRATIX_AI.showStep('welcome')" style="flex:2;padding:10px;background:linear-gradient(135deg,rgba(37,99,235,.14),rgba(37,99,235,.05));border:1px solid rgba(37,99,235,.28);border-radius:10px;color:#2563EB;font-size:13px;cursor:pointer;font-family:var(--font);font-weight:700;transition:.15s">
        ${state.currentStepIndex > 0 ? 'Continue Guide ✦' : 'Start v5.0 Guide ✦'}
      </button>
    </div>

  </div>
</div>`;
  }

  function toggleEnabled(val) {
    const s = STRATIX_DB.getSettings();
    s.stratixAiEnabled = val;
    STRATIX_DB.saveSettings(s);
    if (typeof NOTIFY !== 'undefined') NOTIFY.show(val ? '✦ STRATIX AI Guide enabled!' : 'STRATIX AI Guide disabled.', val?'success':'info');
    const btn = document.getElementById('sxAiBtn');
    if (btn) btn.classList.toggle('hide', !val);
    if (!val) dismiss();
    // Refresh settings section
    const group = document.getElementById('stratixAiSettingsGroup');
    if (group) group.outerHTML = getSettingsHTML();
  }

  function setMaxSessions(val) {
    const s = STRATIX_DB.getSettings();
    s.stratixAiMaxSessions = val;
    STRATIX_DB.saveSettings(s);
  }

  function resetProgress() {
    _save({});
    if (typeof NOTIFY !== 'undefined') NOTIFY.show('✦ STRATIX AI guide reset. Starting fresh!', 'success');
    const group = document.getElementById('stratixAiSettingsGroup');
    if (group) group.outerHTML = getSettingsHTML();
  }

  /* ── Public API ───────────────────────────────────────────────────────── */
  return {
    showStep, next, prev, _jumpTo, goTo,
    dismiss, finish, autoTrigger, addFloatingButton,
    getSettingsHTML, toggleEnabled, setMaxSessions, resetProgress
  };

})();
