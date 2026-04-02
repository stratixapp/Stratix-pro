/**
 * STRATIX onboarding.js v1.0
 * ─────────────────────────────────────────────────────────────────
 * 1. Onboarding Wizard   — 4-step first-run setup after registration
 * 2. Push Notifications  — Web Push via Service Worker (real phone alerts)
 * 3. GST Filing Hub      — GSTR-1 / GSTR-3B data summary + JSON export
 *                          (actual portal filing marked Coming Soon)
 * 4. UPI Payment Tracker — Manual UPI tracking + Coming Soon auto-detect
 * 5. E-Way Bill Enhanced — Full Part-A + Part-B form with JSON export
 *                          for pasting into ewaybillgst.gov.in
 * ─────────────────────────────────────────────────────────────────
 */

/* ══════════════════════════════════════════════════════════════════
   ① ONBOARDING WIZARD
   Shows automatically after first registration. 4 steps:
     Step 1 — Business profile (name, type, GST, phone)
     Step 2 — Add first employee / driver (optional skip)
     Step 3 — Add first client / customer (optional skip)
     Step 4 — Add first transaction / trip to see live data
   Never shown again once completed or skipped.
══════════════════════════════════════════════════════════════════ */

const ONBOARD = (() => {

  const FLAG = 'sx_onboard_done_v1';

  function shouldShow() {
    const s = STRATIX_AUTH.getSession();
    if (!s) return false;
    const key = `sx_${s.userId}_${FLAG}`;
    return !localStorage.getItem(key);
  }

  function markDone() {
    const s = STRATIX_AUTH.getSession();
    if (!s) return;
    localStorage.setItem(`sx_${s.userId}_${FLAG}`, '1');
  }

  function start() {
    if (!shouldShow()) return;
    _showStep(1);
  }

  function skip() {
    markDone();
    _close();
    NOTIFY.show('Setup skipped — you can fill in your details anytime via Settings ⚙️', 'info', 5000);
  }

  function _close() {
    const el = document.getElementById('onboardOverlay');
    if (el) el.remove();
  }

  function _showStep(step) {
    const s = STRATIX_AUTH.getSession();
    const cfg = STRATIX_DB.getSettings();
    const sym = cfg.currencySymbol || '₹';
    const bizType = s.bizType || cfg.businessType || 'logistics';

    // Labels per vertical
    const labels = {
      logistics: { emp:'First Driver / Staff', empDesc:'Add your first driver to run payroll', client:'First Client / Consignor', clientDesc:'Add your first freight client', txn:'First Trip / Revenue', txnDesc:'Log your first freight trip income' },
      msme:      { emp:'First Employee / Staff', empDesc:'Add your first employee to run payroll', client:'First Client', clientDesc:'Add your first service client', txn:'First Revenue Entry', txnDesc:'Log your first project income' },
      retail:    { emp:'First Staff Member', empDesc:'Add your billing counter staff', client:'First Customer', clientDesc:'Add your first regular customer', txn:'First Sale', txnDesc:'Record your first sale amount' },
      factory:   { emp:'First Worker', empDesc:'Add your first production worker', client:'First Buyer', clientDesc:'Add your first goods buyer', txn:'First Dispatch Revenue', txnDesc:'Log your first production dispatch' },
      other:     { emp:'First Employee', empDesc:'Add your first employee', client:'First Client', clientDesc:'Add your first client', txn:'First Revenue', txnDesc:'Log your first income' }
    };
    const L = labels[bizType] || labels.other;

    const steps = [
      {
        num: 1,
        icon: '🏢',
        title: 'Set Up Your Business',
        sub: 'Takes 60 seconds — this powers your invoices, documents & reports',
        html: `
          <div class="ob-grid">
            <div class="ob-field"><label>Business Name *</label><input id="ob_biz" placeholder="Your Company Pvt Ltd" value="${escapeHTML(cfg.businessName || s.biz || '')}"/></div>
            <div class="ob-field"><label>Owner / Your Name</label><input id="ob_owner" placeholder="Rajesh Kumar" value="${escapeHTML(cfg.ownerName || s.name || '')}"/></div>
            <div class="ob-field"><label>Phone Number</label><input id="ob_phone" type="tel" placeholder="+91 98765 43210" value="${escapeHTML(cfg.phone || s.phone || '')}"/></div>
            <div class="ob-field"><label>GST Number (if registered)</label><input id="ob_gst" placeholder="22AAAAA0000A1Z5" value="${escapeHTML(cfg.gstNumber || '')}"/></div>
            <div class="ob-field"><label>Business Address</label><input id="ob_addr" placeholder="City, State" value="${escapeHTML(cfg.address || '')}"/></div>
            <div class="ob-field"><label>UPI ID (for payment collection)</label><input id="ob_upi" placeholder="yourbusiness@upi" value="${escapeHTML(cfg.upiId || '')}"/></div>
          </div>`,
        next: () => {
          const biz = document.getElementById('ob_biz').value.trim();
          if (!biz) { NOTIFY.show('Please enter your business name', 'warning'); return false; }
          const s2 = STRATIX_DB.getSettings();
          s2.businessName  = biz;
          s2.ownerName     = document.getElementById('ob_owner').value.trim() || s2.ownerName;
          s2.phone         = document.getElementById('ob_phone').value.trim();
          s2.gstNumber     = document.getElementById('ob_gst').value.trim().toUpperCase();
          s2.address       = document.getElementById('ob_addr').value.trim();
          s2.upiId         = document.getElementById('ob_upi').value.trim();
          STRATIX_DB.saveSettings(s2);
          STRATIX_AUTH.updateProfile({ name: s2.ownerName || s.name, biz: biz });
          APP.settings = s2;
          APP.updateUserBadge();
          return true;
        }
      },
      {
        num: 2,
        icon: '👤',
        title: L.emp,
        sub: L.empDesc + ' — skip if you want to add later',
        html: `
          <div class="ob-grid">
            <div class="ob-field"><label>Full Name *</label><input id="ob_ename" placeholder="Ramesh Kumar"/></div>
            <div class="ob-field"><label>Phone</label><input id="ob_ephone" type="tel" placeholder="+91 98765 43210"/></div>
            <div class="ob-field"><label>Role / Designation</label><input id="ob_erole" placeholder="${bizType === 'logistics' ? 'Driver / Cleaner / Helper' : 'Worker / Manager / Accountant'}"/></div>
            <div class="ob-field"><label>Basic Monthly Salary (${sym})</label><input type="number" id="ob_esal" placeholder="15000"/></div>
          </div>`,
        next: () => {
          const name = document.getElementById('ob_ename').value.trim();
          if (!name) return true; // optional step — skip silently
          STRATIX_DB.push('employees', {
            name,
            phone: document.getElementById('ob_ephone').value.trim(),
            designation: document.getElementById('ob_erole').value.trim() || (bizType === 'logistics' ? 'Driver' : 'Employee'),
            basic: +document.getElementById('ob_esal').value || 15000,
            department: 'Operations',
            doj: new Date().toISOString().split('T')[0]
          });
          NOTIFY.show(`✅ ${name} added to payroll!`, 'success', 2000);
          return true;
        }
      },
      {
        num: 3,
        icon: '🤝',
        title: L.client,
        sub: L.clientDesc + ' — skip if you want to add later',
        html: `
          <div class="ob-grid">
            <div class="ob-field"><label>Name / Company *</label><input id="ob_cname" placeholder="${bizType === 'logistics' ? 'ABC Logistics Pvt Ltd' : 'Customer Name'}"/></div>
            <div class="ob-field"><label>Phone (for WhatsApp)</label><input id="ob_cphone" type="tel" placeholder="+91 98765 43210"/></div>
            <div class="ob-field"><label>GST Number (optional)</label><input id="ob_cgst" placeholder="27XXXXX0000X1Z5"/></div>
            <div class="ob-field"><label>Outstanding Amount (${sym})</label><input type="number" id="ob_cout" placeholder="0"/></div>
          </div>`,
        next: () => {
          const name = document.getElementById('ob_cname').value.trim();
          if (!name) return true; // optional
          STRATIX_DB.push('clients', {
            name,
            phone: document.getElementById('ob_cphone').value.trim(),
            gst: document.getElementById('ob_cgst').value.trim().toUpperCase(),
            outstanding: +document.getElementById('ob_cout').value || 0,
            invoices: 0, lastPayment: '—', risk: 'low'
          });
          NOTIFY.show(`✅ ${name} added to CRM!`, 'success', 2000);
          return true;
        }
      },
      {
        num: 4,
        icon: '💰',
        title: L.txn,
        sub: L.txnDesc + ' — this makes your dashboard come alive immediately',
        html: `
          <div class="ob-grid">
            <div class="ob-field"><label>Description *</label><input id="ob_tdesc" placeholder="${bizType === 'logistics' ? 'Mumbai to Delhi — Steel rods freight' : 'First client payment'}"/></div>
            <div class="ob-field"><label>Amount (${sym}) *</label><input type="number" id="ob_tamt" placeholder="${bizType === 'logistics' ? '25000' : '10000'}"/></div>
            <div class="ob-field"><label>Date</label><input type="date" id="ob_tdate" value="${new Date().toISOString().split('T')[0]}"/></div>
            <div class="ob-field"><label>Category</label>
              <select id="ob_tcat">
                ${bizType === 'logistics'
                  ? '<option value="freight">Freight Revenue</option><option value="fuel">Fuel Expense</option><option value="toll">Toll Expense</option><option value="salary">Driver Salary</option>'
                  : bizType === 'retail'
                  ? '<option value="sales">Sales</option><option value="purchase">Purchase</option><option value="salary">Staff Salary</option>'
                  : '<option value="revenue">Revenue</option><option value="material">Materials</option><option value="salary">Salary</option><option value="other">Other</option>'
                }
              </select>
            </div>
          </div>`,
        next: () => {
          const desc = document.getElementById('ob_tdesc').value.trim();
          const amt = +document.getElementById('ob_tamt').value;
          if (!desc || !amt) return true; // optional
          const cat = document.getElementById('ob_tcat').value;
          const isRevenue = ['freight','sales','revenue'].includes(cat);
          STRATIX_DB.push('transactions', {
            description: desc,
            amount: amt,
            type: isRevenue ? 'revenue' : 'expense',
            category: cat,
            date: document.getElementById('ob_tdate').value
          });
          NOTIFY.show(`✅ First transaction added — ₹${amt.toLocaleString('en-IN')}!`, 'success', 2000);
          return true;
        }
      }
    ];

    const current = steps[step - 1];
    const isLast = step === steps.length;
    const progress = Math.round((step / steps.length) * 100);

    // Build or update overlay
    let el = document.getElementById('onboardOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'onboardOverlay';
      el.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(2,5,9,.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;font-family:var(--font)';
      document.body.appendChild(el);
    }

    el.innerHTML = `
      <div style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:22px;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;box-shadow:0 30px 80px rgba(0,0,0,.8)">
        <!-- Header -->
        <div style="padding:24px 28px 0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
            <div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:1.2px;text-transform:uppercase">STRATIX SETUP — Step ${step} of ${steps.length}</div>
            <button onclick="ONBOARD.skip()" style="background:transparent;border:none;color:var(--muted);font-size:13px;cursor:pointer;padding:4px 8px;border-radius:6px" title="Skip setup">✕ Skip</button>
          </div>
          <!-- Progress bar -->
          <div style="height:4px;background:#E2E8F0;border-radius:4px;margin-bottom:24px;overflow:hidden">
            <div style="height:100%;width:${progress}%;background:linear-gradient(90deg,var(--gold),#ff8c00);border-radius:4px;transition:width .4s ease"></div>
          </div>
          <!-- Step icon + title -->
          <div style="font-size:38px;margin-bottom:10px">${current.icon}</div>
          <div style="font-size:20px;font-weight:800;font-family:var(--heading);color:var(--text);margin-bottom:6px">${current.title}</div>
          <div style="font-size:13px;color:var(--muted);margin-bottom:22px;line-height:1.6">${current.sub}</div>
        </div>

        <!-- Form fields -->
        <div style="padding:0 28px 24px">
          <style>
            .ob-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
            .ob-field { display:flex; flex-direction:column; gap:6px; }
            .ob-field label { font-size:11px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:.8px; }
            .ob-field input, .ob-field select { background:#F8FAFC; border:1.5px solid #E2E8F0; border-radius:10px; padding:11px 14px; color:var(--text); font-family:var(--font); font-size:14px; outline:none; width:100%; box-sizing:border-box; transition:.2s; }
            .ob-field input:focus, .ob-field select:focus { border-color:var(--gold); box-shadow:0 0 0 3px rgba(37,99,235,.1); }
            .ob-field select option { background:#FFFFFF; }
            @media(max-width:480px){ .ob-grid { grid-template-columns:1fr; } }
          </style>
          ${current.html}
        </div>

        <!-- Footer buttons -->
        <div style="padding:0 28px 28px;display:flex;gap:12px">
          ${step > 1 ? `<button onclick="ONBOARD._showStep(${step-1})" style="flex:0 0 auto;padding:13px 20px;background:transparent;border:1.5px solid #E2E8F0;border-radius:12px;color:var(--text2);font-family:var(--font);font-size:14px;cursor:pointer">← Back</button>` : ''}
          ${step < steps.length
            ? `<button id="ob_nextBtn" onclick="ONBOARD._nextStep(${step})" style="flex:1;padding:13px;background:linear-gradient(135deg,var(--gold),#c07000);border:none;border-radius:12px;color:#F8FAFC;font-family:var(--heading);font-size:15px;font-weight:800;cursor:pointer;letter-spacing:.3px">Continue →</button>`
            : `<button id="ob_nextBtn" onclick="ONBOARD._finish()" style="flex:1;padding:13px;background:linear-gradient(135deg,#00d68f,#009960);border:none;border-radius:12px;color:#fff;font-family:var(--heading);font-size:15px;font-weight:800;cursor:pointer;letter-spacing:.3px">🚀 Launch My Dashboard</button>`
          }
        </div>

        <!-- Step dots -->
        <div style="padding:0 28px 22px;display:flex;justify-content:center;gap:8px">
          ${steps.map((_,i) => `<div style="width:${i+1===step?'22px':'8px'};height:8px;border-radius:4px;background:${i+1<=step?'var(--gold)':'#E2E8F0'};transition:all .3s ease"></div>`).join('')}
        </div>
      </div>`;

    // Store step functions for next/finish callbacks
    ONBOARD._steps = steps;
  }

  function _nextStep(step) {
    const btn = document.getElementById('ob_nextBtn');
    if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }
    const ok = ONBOARD._steps[step - 1].next();
    if (ok === false) {
      if (btn) { btn.textContent = 'Continue →'; btn.disabled = false; }
      return;
    }
    _showStep(step + 1);
  }

  function _finish() {
    const btn = document.getElementById('ob_nextBtn');
    if (btn) { btn.textContent = 'Launching...'; btn.disabled = true; }
    ONBOARD._steps[ONBOARD._steps.length - 1].next();
    markDone();
    PUSH.requestPermission(); // Ask for push notification permission on finish
    setTimeout(() => {
      _close();
      if (typeof APP !== 'undefined') {
        APP.settings = STRATIX_DB.getSettings();
        APP.navigate('dashboard');
      }
      NOTIFY.show('🎉 Setup complete! Your dashboard is ready.', 'success', 4000);
    }, 600);
  }

  return { start, skip, _showStep, _nextStep, _finish };

})();


/* ══════════════════════════════════════════════════════════════════
   ② PUSH NOTIFICATIONS
   Web Push via Service Worker. Falls back gracefully if not supported.
   Fires real phone alerts for:
     - Overdue reminders
     - Vehicle insurance / fitness expiry (7 days warning)
     - Client dues above ₹50,000
     - GST due date reminders (7th, 11th, 20th of month)
══════════════════════════════════════════════════════════════════ */

const PUSH = (() => {

  const PERM_KEY = 'sx_push_permission';

  function isSupported() {
    return ('Notification' in window) && ('serviceWorker' in navigator);
  }

  async function requestPermission() {
    if (!isSupported()) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const perm = await Notification.requestPermission();
      localStorage.setItem(PERM_KEY, perm);
      if (perm === 'granted') {
        NOTIFY.show('🔔 Push notifications enabled! You\'ll get alerts for reminders, dues & expiry.', 'success', 4000);
        scheduleAll();
        return true;
      }
    } catch(e) { console.warn('Push permission error:', e); }
    return false;
  }

  function send(title, body, icon = '🔔', tag = '') {
    if (!isSupported() || Notification.permission !== 'granted') return;
    try {
      new Notification(`STRATIX — ${title}`, {
        body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="%23f0a500"/><text x="50%" y="58%" font-size="36" text-anchor="middle" fill="%23020509" font-family="sans-serif" font-weight="900">SX</text></svg>',
        tag: tag || title,
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%23f0a500"/></svg>',
        vibrate: [200, 100, 200]
      });
    } catch(e) { console.warn('Notification send error:', e); }
  }

  function scheduleAll() {
    if (!isSupported() || Notification.permission !== 'granted') return;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const sym = STRATIX_DB.getSettings().currencySymbol || '₹';

    // ── Overdue reminders ──
    const overdueRem = STRATIX_DB.getArr('reminders').filter(r => !r.done && r.date && r.date < today);
    if (overdueRem.length > 0) {
      send('⏰ Overdue Reminder', `"${overdueRem[0].title}" is overdue${overdueRem.length > 1 ? ` (+${overdueRem.length-1} more)` : ''}`, '⏰', 'overdue-reminder');
    }

    // ── High client dues ──
    const highDues = STRATIX_DB.getArr('clients').filter(c => Number(c.outstanding) >= 50000);
    highDues.slice(0, 2).forEach(c => {
      send('💰 Payment Due', `${c.name} owes ${sym}${Number(c.outstanding).toLocaleString('en-IN')} — collect today`, '💰', `due-${c.id}`);
    });

    // ── Vehicle fitness / insurance expiry (within 7 days) ──
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fleet = STRATIX_DB.getArr('fleet');
    fleet.forEach(v => {
      ['insuranceExpiry','fitnessExpiry','pucExpiry'].forEach(field => {
        if (v[field] && v[field] <= soon && v[field] >= today) {
          const labels = { insuranceExpiry:'Insurance', fitnessExpiry:'Fitness', pucExpiry:'PUC' };
          send('🚛 Vehicle Alert', `${v.number} — ${labels[field]} expires ${v[field]}`, '🚛', `vehicle-${v.id}-${field}`);
        }
      });
    });

    // ── GST due date reminders ──
    const day = now.getDate();
    const month = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    if (day === 7)  send('🧾 GST Reminder', `GSTR-1 (Quarterly) due by 13th — prepare your outward supply data for ${month}`, '🧾', 'gst-7');
    if (day === 10) send('🧾 GST Reminder', `GSTR-1 (Monthly) due tomorrow — file your outward supplies for ${month}`, '🧾', 'gst-10');
    if (day === 19) send('🧾 GST Reminder', `GSTR-3B due tomorrow (20th) — pay your GST liability for ${month}`, '🧾', 'gst-19');
    if (day === 14) send('🧾 GST Reminder', `GSTR-1 (Quarterly) due today — file your outward supplies for ${month}`, '🧾', 'gst-14');
  }

  // Schedule notifications once per day
  function init() {
    if (!isSupported() || Notification.permission !== 'granted') return;
    const key = `sx_push_last_${new Date().toISOString().split('T')[0]}`;
    if (localStorage.getItem(key)) return; // already sent today
    localStorage.setItem(key, '1');
    setTimeout(scheduleAll, 2000); // 2 seconds after app loads
  }

  function getStatus() {
    if (!isSupported()) return 'not_supported';
    return Notification.permission; // 'default' | 'granted' | 'denied'
  }

  // Render settings panel for Settings page
  function getSettingsHTML() {
    const status = getStatus();
    const statusMap = {
      'not_supported': { label: 'Not supported in this browser', color: 'var(--muted)', btn: false },
      'default':       { label: 'Not enabled — tap to enable', color: 'var(--gold)', btn: true },
      'granted':       { label: '✅ Enabled — you will get alerts', color: 'var(--green)', btn: false },
      'denied':        { label: '❌ Blocked — enable in browser settings', color: 'var(--red)', btn: false }
    };
    const info = statusMap[status] || statusMap['not_supported'];
    return `
      <div class="settings-group">
        <div class="settings-group-title">🔔 Push Notifications</div>
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:16px 20px">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:4px">Phone Alerts</div>
              <div style="font-size:12px;color:${info.color}">${info.label}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:6px">Alerts for: overdue reminders · vehicle expiry · GST due dates · high pending dues</div>
            </div>
            ${info.btn ? `<button onclick="PUSH.requestPermission()" class="btn btn-gold btn-sm" style="flex-shrink:0">Enable Alerts</button>` : ''}
          </div>
        </div>
      </div>`;
  }

  return { requestPermission, send, scheduleAll, init, getStatus, getSettingsHTML };

})();


/* ══════════════════════════════════════════════════════════════════
   ③ GST FILING HUB
   Renders a full GSTR-1 and GSTR-3B data summary from transactions.
   - Displays outward supply breakup (B2B / B2C / Nil)
   - Shows GSTR-3B liability calculation
   - Exports filing-ready JSON (Coming Soon — portal API)
   - Links directly to GST portal for actual submission
══════════════════════════════════════════════════════════════════ */

function renderGSTFiling() {
  const sym = STRATIX_DB.getSettings().currencySymbol || '₹';
  const settings = STRATIX_DB.getSettings();
  const txns = STRATIX_DB.getArr('transactions');
  const invoices = STRATIX_DB.getArr('invoices');
  const gstEntries = STRATIX_DB.getArr('gstEntries');

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const prevMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const prevMonthKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;
  const filingPeriod = prevMonth.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  // Calculate outward supplies from revenue transactions
  const outward = txns.filter(t => t.type === 'revenue' && t.date && t.date.startsWith(prevMonthKey));
  const totalTaxable = outward.reduce((s, t) => s + Number(t.amount || 0), 0);
  const b2bTxns = outward.filter(t => t.category === 'b2b' || (t.gstRate && t.partyGST));
  const b2cTxns = outward.filter(t => !t.partyGST);
  const b2bValue = b2bTxns.reduce((s, t) => s + Number(t.amount || 0), 0);
  const b2cValue = b2cTxns.reduce((s, t) => s + Number(t.amount || 0), 0);

  // GST entries (from existing GST calculator)
  const mGST = gstEntries.filter(e => e.date && e.date.startsWith(prevMonthKey));
  const outputGST = mGST.filter(e => e.type === 'output').reduce((s,e)=>s+Number(e.gstAmount||0),0);
  const inputGST  = mGST.filter(e => e.type === 'input').reduce((s,e)=>s+Number(e.gstAmount||0),0);
  const netGST = Math.max(0, outputGST - inputGST);

  // GST due dates
  const nextDates = {
    'GSTR-1 (Monthly)': `11th ${now.toLocaleString('en-IN',{month:'long'})} ${now.getFullYear()}`,
    'GSTR-1 (Quarterly)': `13th ${now.toLocaleString('en-IN',{month:'long'})} ${now.getFullYear()}`,
    'GSTR-3B': `20th ${now.toLocaleString('en-IN',{month:'long'})} ${now.getFullYear()}`
  };

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div>
          <h1 class="sec-title">🧾 GST Filing Hub</h1>
          <p class="sec-sub">GSTR-1 & GSTR-3B data summary for ${filingPeriod}</p>
        </div>
        <div class="head-actions">
          <button class="btn btn-gold" onclick="window.open('https://www.gst.gov.in','_blank')">🌐 Open GST Portal</button>
          <button class="btn btn-outline" onclick="exportGSTJSON()">📥 Export JSON</button>
        </div>
      </div>

      <!-- Coming Soon banner for auto-filing -->
      <div style="background:linear-gradient(135deg,rgba(79,158,240,.08),rgba(79,158,240,.03));border:1px solid rgba(79,158,240,.2);border-radius:14px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="font-size:24px">🚀</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--blue)">One-Click GST Filing — Coming Soon</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">Direct API integration with GST portal · Auto-fill GSTR-1 & GSTR-3B from your STRATIX data · Zero manual entry</div>
        </div>
        <span style="background:rgba(79,158,240,.12);color:var(--blue);border:1px solid rgba(79,158,240,.3);padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700">COMING SOON</span>
      </div>

      <!-- Due Dates -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px">
        ${Object.entries(nextDates).map(([form, date]) => `
          <div class="card" style="padding:14px 16px">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;font-weight:700;margin-bottom:6px">${form}</div>
            <div style="font-size:14px;font-weight:700;color:var(--gold)">📅 ${date}</div>
          </div>`).join('')}
      </div>

      <!-- GSTR-1 Summary -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">📋 GSTR-1 — Outward Supplies (${filingPeriod})</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px">
          <div style="text-align:center;padding:14px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:6px">B2B Supplies</div>
            <div style="font-size:18px;font-weight:800;color:var(--text);font-family:var(--heading)">${sym}${(b2bValue/100000).toFixed(1)}L</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px">${b2bTxns.length} invoices</div>
          </div>
          <div style="text-align:center;padding:14px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:6px">B2C Supplies</div>
            <div style="font-size:18px;font-weight:800;color:var(--text);font-family:var(--heading)">${sym}${(b2cValue/100000).toFixed(1)}L</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px">${b2cTxns.length} transactions</div>
          </div>
          <div style="text-align:center;padding:14px;background:var(--surface2);border-radius:10px;border:1px solid var(--border)">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:6px">Total Turnover</div>
            <div style="font-size:18px;font-weight:800;color:var(--gold);font-family:var(--heading)">${sym}${(totalTaxable/100000).toFixed(1)}L</div>
            <div style="font-size:11px;color:var(--muted);margin-top:3px">${outward.length} total entries</div>
          </div>
        </div>
        <div style="background:rgba(0,214,143,.07);border:1px solid rgba(0,214,143,.2);border-radius:10px;padding:12px 16px;font-size:13px;color:var(--text2)">
          ℹ️ Add GSTIN to your clients in CRM to automatically split B2B / B2C supplies. Nil-rated & exempt supplies are tracked separately in GST Calculator.
        </div>
      </div>

      <!-- GSTR-3B Summary -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">📋 GSTR-3B — Tax Liability (${filingPeriod})</div>
        <div class="tbl-scroll"><table>
          <thead><tr><th>Description</th><th>Amount</th></tr></thead>
          <tbody>
            <tr><td>Output Tax (from your sales / GST entries)</td><td style="color:var(--red);font-weight:700">${sym}${outputGST.toLocaleString('en-IN')}</td></tr>
            <tr><td>Input Tax Credit (ITC from purchases)</td><td style="color:var(--green);font-weight:700">– ${sym}${inputGST.toLocaleString('en-IN')}</td></tr>
            <tr style="background:var(--surface2)"><td style="font-weight:700">Net Tax Payable</td><td style="font-weight:800;color:${netGST>0?'var(--gold)':'var(--green)'};">${sym}${netGST.toLocaleString('en-IN')}</td></tr>
          </tbody>
        </table></div>
        ${gstEntries.length === 0 ? `
          <div style="margin-top:14px;background:rgba(37,99,235,.07);border:1px solid rgba(37,99,235,.2);border-radius:10px;padding:12px 16px;font-size:13px;color:var(--text2)">
            ⚠️ No GST entries found for ${filingPeriod}. Go to <button onclick="APP.navigate('gst')" class="btn btn-ghost btn-sm" style="display:inline-block;margin:0 4px">GST Calculator</button> to add your sales and purchase GST entries.
          </div>` : ''}
      </div>

      <!-- Steps to file -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">📌 How to File GST (Until Auto-Filing Launches)</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${[
            ['1','Export your data', 'Click "Export JSON" above to download your STRATIX GST data in filing format'],
            ['2','Open GST Portal', 'Go to gst.gov.in → Login → Returns Dashboard'],
            ['3','File GSTR-1', 'Add your outward supplies (B2B with GSTIN, B2C amounts). Use data from Step 1.'],
            ['4','File GSTR-3B', 'Fill in your tax liability from the summary above. Pay net GST before 20th.'],
            ['5','Save ARN', 'After successful filing, save your ARN (Acknowledgment Reference Number) here in Notes.']
          ].map(([n,title,desc]) => `
            <div style="display:flex;gap:14px;align-items:flex-start;padding:12px;background:var(--surface2);border-radius:10px">
              <div style="width:28px;height:28px;background:linear-gradient(135deg,var(--gold),#c07000);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#F8FAFC;flex-shrink:0">${n}</div>
              <div><div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:3px">${title}</div><div style="font-size:12px;color:var(--muted)">${desc}</div></div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Disclaimer -->
      <div style="background:rgba(255,77,77,.06);border:1px solid rgba(255,77,77,.2);border-radius:12px;padding:14px 18px;font-size:12px;color:var(--text2);line-height:1.8">
        ⚠️ <strong>Disclaimer:</strong> STRATIX provides GST summaries as a tool — not as a CA or tax advisor. Always verify calculations with a qualified Chartered Accountant before filing. Tax laws change frequently. STRATIX is not liable for filing errors.
      </div>
    </div>`;
}

function exportGSTJSON() {
  const settings = STRATIX_DB.getSettings();
  const gstEntries = STRATIX_DB.getArr('gstEntries');
  const txns = STRATIX_DB.getArr('transactions');
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const periodKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth()+1).padStart(2,'0')}`;

  const data = {
    _generated_by: 'STRATIX v7.0',
    _exported: now.toISOString(),
    _disclaimer: 'Verify with CA before filing. STRATIX is not liable for filing errors.',
    gstin: settings.gstNumber || '',
    business_name: settings.businessName || '',
    filing_period: `${prevMonth.toLocaleString('en-IN',{month:'long'})} ${prevMonth.getFullYear()}`,
    gstr1: {
      outward_supplies: txns
        .filter(t => t.type === 'revenue' && t.date && t.date.startsWith(periodKey))
        .map(t => ({
          invoice_date: t.date,
          description: t.description,
          taxable_value: Number(t.amount),
          party_gstin: t.partyGST || '',
          gst_rate: t.gstRate || 18,
          is_b2b: !!(t.partyGST)
        }))
    },
    gstr3b: {
      output_tax: gstEntries.filter(e=>e.type==='output'&&e.date&&e.date.startsWith(periodKey)).reduce((s,e)=>s+Number(e.gstAmount||0),0),
      itc_available: gstEntries.filter(e=>e.type==='input'&&e.date&&e.date.startsWith(periodKey)).reduce((s,e)=>s+Number(e.gstAmount||0),0),
      gst_entries: gstEntries.filter(e => e.date && e.date.startsWith(periodKey))
    }
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `STRATIX_GST_${periodKey}_${settings.businessName || 'export'}.json`;
  a.click();
  NOTIFY.show('GST data exported! Share with your CA or use for portal filing.', 'success', 4000);
}


/* ══════════════════════════════════════════════════════════════════
   ④ UPI PAYMENT TRACKER
   Manual UPI payment logging with payment status tracking.
   Auto-detection (Coming Soon) — shown as a prominent banner.
   Integrates with Invoice Aging to mark invoices as paid.
══════════════════════════════════════════════════════════════════ */

function renderUPITracker() {
  const sym = STRATIX_DB.getSettings().currencySymbol || '₹';
  const settings = STRATIX_DB.getSettings();
  const payments = STRATIX_DB.getArr('upiPayments');
  const clients = STRATIX_DB.getArr('clients');

  const totalCollected = payments.filter(p=>p.status==='received').reduce((s,p)=>s+Number(p.amount||0),0);
  const totalPending = payments.filter(p=>p.status==='pending').reduce((s,p)=>s+Number(p.amount||0),0);
  const thisMonth = new Date().toISOString().slice(0,7);
  const monthCollected = payments.filter(p=>p.status==='received'&&p.date&&p.date.startsWith(thisMonth)).reduce((s,p)=>s+Number(p.amount||0),0);

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div>
          <h1 class="sec-title">💳 UPI Payment Tracker</h1>
          <p class="sec-sub">Track UPI collections · Mark invoices paid · Monitor cash flow</p>
        </div>
        <button class="btn btn-gold" onclick="openUPIAdd()">+ Record Payment</button>
      </div>

      <!-- Auto-detect Coming Soon banner -->
      <div style="background:linear-gradient(135deg,rgba(0,214,143,.08),rgba(0,214,143,.03));border:1px solid rgba(0,214,143,.25);border-radius:14px;padding:16px 20px;margin-bottom:20px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">
        <div style="font-size:24px">⚡</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--green)">Auto-Detect UPI Payments — Coming Soon</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">Connect your UPI ID (GPay, PhonePe, Paytm) · Auto-detect incoming payments · Match to invoices automatically · Zero manual entry</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
          <span style="background:rgba(0,214,143,.12);color:var(--green);border:1px solid rgba(0,214,143,.3);padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700">COMING SOON</span>
          ${settings.upiId ? `<div style="font-size:11px;color:var(--muted)">Your UPI: ${escapeHTML(settings.upiId)}</div>` : `<button onclick="APP.navigate('settings')" class="btn btn-ghost btn-sm" style="font-size:11px">Add UPI ID in Settings</button>`}
        </div>
      </div>

      <!-- KPIs -->
      <div class="kpi-grid" style="margin-bottom:18px">
        <div class="kpi accent">
          <div class="kpi-ico">💰</div>
          <div class="kpi-lbl">This Month Collected</div>
          <div class="kpi-val">${sym}${monthCollected.toLocaleString('en-IN')}</div>
        </div>
        <div class="kpi">
          <div class="kpi-ico">✅</div>
          <div class="kpi-lbl">Total Collected</div>
          <div class="kpi-val green">${sym}${totalCollected.toLocaleString('en-IN')}</div>
        </div>
        <div class="kpi">
          <div class="kpi-ico">⏳</div>
          <div class="kpi-lbl">Pending Payments</div>
          <div class="kpi-val ${totalPending>0?'gold':''}">${sym}${totalPending.toLocaleString('en-IN')}</div>
        </div>
        <div class="kpi">
          <div class="kpi-ico">📊</div>
          <div class="kpi-lbl">Total Records</div>
          <div class="kpi-val">${payments.length}</div>
        </div>
      </div>

      <!-- UPI Quick Send -->
      <div class="card" style="margin-bottom:16px">
        <div class="card-title">📱 Send UPI Payment Request via WhatsApp</div>
        <div class="form-grid" style="margin-bottom:12px">
          <div class="field"><label>Client</label>
            <select id="upiClientSel" onchange="upiAutoFillPhone()">
              <option value="">Select client or enter manually</option>
              ${clients.map(c=>`<option value="${escapeHTML(c.id)}" data-phone="${escapeHTML(c.phone||'')}" data-name="${escapeHTML(c.name)}" data-due="${c.outstanding||0}">${escapeHTML(c.name)}${c.outstanding>0?' — ₹'+Number(c.outstanding).toLocaleString('en-IN')+' due':''}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Amount (${sym})</label><input type="number" id="upiAmt" placeholder="5000"/></div>
          <div class="field"><label>WhatsApp Number</label><input type="tel" id="upiPhone" placeholder="+91 98765 43210"/></div>
          <div class="field"><label>Description</label><input id="upiDesc" placeholder="Invoice #INV-001 payment"/></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-gold" onclick="sendUPIRequest()">📱 Send via WhatsApp</button>
          <button class="btn btn-ghost" onclick="copyUPILink()">📋 Copy UPI Link</button>
        </div>
      </div>

      <!-- Payment log -->
      <div class="tbl-wrap">
        <div class="tbl-head">
          <div class="tbl-title">Payment Log</div>
          <div style="display:flex;gap:8px">
            <select id="upiFilter" onchange="filterUPIPayments(this.value)" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:13px">
              <option value="all">All</option>
              <option value="received">Received</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>
        <div id="upiPaymentList">
          ${payments.length === 0 ? `
            <div style="padding:40px;text-align:center;color:var(--muted)">
              <div style="font-size:40px;margin-bottom:12px">💳</div>
              <div style="font-size:14px;font-weight:600;margin-bottom:6px">No payments recorded yet</div>
              <div style="font-size:13px;margin-bottom:16px">Record your first UPI payment to start tracking</div>
              <button class="btn btn-gold" onclick="openUPIAdd()">+ Record First Payment</button>
            </div>` :
            _renderUPIList(payments, sym)}
        </div>
      </div>
      <div id="upiAddModal"></div>
    </div>`;
}

function _renderUPIList(payments, sym) {
  const sorted = [...payments].sort((a,b)=>new Date(b.date||b.createdAt)-new Date(a.date||a.createdAt));
  return `<div class="tbl-scroll"><table>
    <thead><tr><th>Date</th><th>Client / Description</th><th>Amount</th><th>UPI Ref / Note</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>
      ${sorted.map(p=>`
        <tr>
          <td class="td-m">${p.date||'—'}</td>
          <td class="td-b">${escapeHTML(p.clientName||p.description||'—')}</td>
          <td style="font-weight:700;color:${p.status==='received'?'var(--green)':'var(--gold)'}">${sym}${Number(p.amount).toLocaleString('en-IN')}</td>
          <td class="td-m" style="font-size:12px">${escapeHTML(p.upiRef||p.note||'—')}</td>
          <td><span style="padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${p.status==='received'?'rgba(0,214,143,.12)':'rgba(37,99,235,.12)'};color:${p.status==='received'?'var(--green)':'var(--gold)'}">${p.status==='received'?'✅ Received':'⏳ Pending'}</span></td>
          <td style="display:flex;gap:6px">
            ${p.status==='pending'?`<button class="btn btn-ghost btn-sm" onclick="markUPIReceived('${p.id}')">✅ Mark Paid</button>`:''}
            <button class="btn btn-ghost btn-sm" onclick="APP._confirmDelete('payment',()=>{STRATIX_DB.remove('upiPayments','${p.id}');renderUPITracker()})">🗑</button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table></div>`;
}

function openUPIAdd() {
  const sym = STRATIX_DB.getSettings().currencySymbol || '₹';
  const clients = STRATIX_DB.getArr('clients');
  const modal = document.getElementById('upiAddModal');
  if (!modal) return;
  modal.innerHTML = `
    <div style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.8);display:flex;align-items:center;justify-content:center;padding:20px">
      <div style="background:#FFFFFF;border:1px solid #D1D5DB;border-radius:18px;padding:28px;max-width:460px;width:100%">
        <h3 style="color:var(--text);font-family:var(--heading);font-size:17px;margin-bottom:20px">💳 Record UPI Payment</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div class="field"><label>Client (optional)</label>
            <select id="upiAddClient">
              <option value="">No client / manual entry</option>
              ${clients.map(c=>`<option value="${c.id}" data-name="${escapeHTML(c.name)}">${escapeHTML(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Description</label><input id="upiAddDesc" placeholder="Invoice payment / advance / EMI"/></div>
          <div class="field"><label>Amount (${sym}) *</label><input type="number" id="upiAddAmt" placeholder="5000"/></div>
          <div class="field"><label>Date</label><input type="date" id="upiAddDate" value="${new Date().toISOString().split('T')[0]}"/></div>
          <div class="field"><label>UPI Ref / Transaction ID</label><input id="upiAddRef" placeholder="GPay / PhonePe / Paytm ref no."/></div>
          <div class="field"><label>Status</label>
            <select id="upiAddStatus">
              <option value="received">✅ Payment Received</option>
              <option value="pending">⏳ Payment Pending</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:20px">
          <button onclick="document.getElementById('upiAddModal').innerHTML=''" style="flex:1;padding:11px;background:transparent;border:1px solid #D1D5DB;border-radius:10px;color:var(--text);cursor:pointer;font-family:var(--font);font-size:14px">Cancel</button>
          <button onclick="saveUPIPayment()" style="flex:1;padding:11px;background:linear-gradient(135deg,var(--gold),#c07000);border:none;border-radius:10px;color:#F8FAFC;cursor:pointer;font-family:var(--font);font-size:14px;font-weight:700">Save Payment</button>
        </div>
      </div>
    </div>`;
}

function saveUPIPayment() {
  const amt = +document.getElementById('upiAddAmt').value;
  if (!amt) { NOTIFY.show('Enter payment amount', 'warning'); return; }
  const clientId = document.getElementById('upiAddClient').value;
  const clientName = clientId ? STRATIX_DB.getArr('clients').find(c=>c.id===clientId)?.name || '' : '';
  const status = document.getElementById('upiAddStatus').value;
  const payment = STRATIX_DB.push('upiPayments', {
    clientId, clientName,
    description: document.getElementById('upiAddDesc').value.trim(),
    amount: amt,
    date: document.getElementById('upiAddDate').value,
    upiRef: document.getElementById('upiAddRef').value.trim(),
    status
  });
  // If received, add to transactions and update client outstanding
  if (status === 'received') {
    STRATIX_DB.push('transactions', {
      description: `UPI Payment${clientName ? ' from '+clientName : ''}${document.getElementById('upiAddDesc').value ? ' — '+document.getElementById('upiAddDesc').value : ''}`,
      amount: amt, type: 'revenue', category: 'payment',
      date: document.getElementById('upiAddDate').value
    });
    if (clientId) {
      const c = STRATIX_DB.getArr('clients').find(x=>x.id===clientId);
      if (c) STRATIX_DB.update('clients', clientId, { outstanding: Math.max(0, Number(c.outstanding||0)-amt), lastPayment: document.getElementById('upiAddDate').value });
    }
  }
  document.getElementById('upiAddModal').innerHTML = '';
  NOTIFY.show(`Payment of ${STRATIX_DB.getSettings().currencySymbol||'₹'}${amt.toLocaleString('en-IN')} recorded!`, 'success');
  renderUPITracker();
}

function markUPIReceived(id) {
  const p = STRATIX_DB.getArr('upiPayments').find(x=>x.id===id);
  if (!p) return;
  STRATIX_DB.update('upiPayments', id, { status: 'received' });
  STRATIX_DB.push('transactions', {
    description: `UPI Payment${p.clientName ? ' from '+p.clientName : ''} — ${p.description||''}`,
    amount: Number(p.amount), type: 'revenue', category: 'payment', date: p.date
  });
  if (p.clientId) {
    const c = STRATIX_DB.getArr('clients').find(x=>x.id===p.clientId);
    if (c) STRATIX_DB.update('clients', p.clientId, { outstanding: Math.max(0, Number(c.outstanding||0)-Number(p.amount)), lastPayment: p.date });
  }
  NOTIFY.show('Payment marked as received ✅', 'success');
  renderUPITracker();
}

function filterUPIPayments(filter) {
  const sym = STRATIX_DB.getSettings().currencySymbol || '₹';
  const all = STRATIX_DB.getArr('upiPayments');
  const filtered = filter === 'all' ? all : all.filter(p=>p.status===filter);
  document.getElementById('upiPaymentList').innerHTML = filtered.length ? _renderUPIList(filtered, sym) : '<div style="padding:28px;text-align:center;color:var(--muted)">No payments match this filter</div>';
}

function upiAutoFillPhone() {
  const sel = document.getElementById('upiClientSel');
  const opt = sel.options[sel.selectedIndex];
  const phone = opt.dataset.phone || '';
  const due = opt.dataset.due || '';
  if (document.getElementById('upiPhone')) document.getElementById('upiPhone').value = phone;
  if (document.getElementById('upiAmt') && due) document.getElementById('upiAmt').value = due;
}

function sendUPIRequest() {
  const settings = STRATIX_DB.getSettings();
  const phone = (document.getElementById('upiPhone')?.value||'').replace(/[^0-9]/g,'');
  const amt = document.getElementById('upiAmt')?.value||'';
  const desc = document.getElementById('upiDesc')?.value||'Payment request';
  const upi = settings.upiId || '';
  const biz = settings.businessName || 'STRATIX Business';
  if (!phone) { NOTIFY.show('Enter WhatsApp number', 'warning'); return; }
  const msg = `Dear Sir/Madam,\n\n*Payment Request from ${biz}*\n\nAmount: *₹${Number(amt).toLocaleString('en-IN')}*\nDescription: ${desc}\n\nPlease pay via UPI:\n*UPI ID: ${upi||'[Set UPI ID in Settings]'}*\n\nThank you! 🙏\n_${biz}_`;
  const normalized = phone.startsWith('91') ? phone : '91' + phone;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`, '_blank');
  NOTIFY.show('WhatsApp opened with payment request! 📱', 'success');
}

function copyUPILink() {
  const settings = STRATIX_DB.getSettings();
  const amt = document.getElementById('upiAmt')?.value||'';
  const desc = document.getElementById('upiDesc')?.value||'Payment';
  const upi = settings.upiId;
  if (!upi) { NOTIFY.show('Add your UPI ID in Settings first', 'warning'); APP.navigate('settings'); return; }
  const link = `upi://pay?pa=${upi}&pn=${encodeURIComponent(settings.businessName||'Business')}&am=${amt}&cu=INR&tn=${encodeURIComponent(desc)}`;
  navigator.clipboard?.writeText(link).then(() => NOTIFY.show('UPI deep link copied! 📋 Share with customer.', 'success')).catch(() => NOTIFY.show('UPI link: ' + link, 'info', 8000));
}


/* ══════════════════════════════════════════════════════════════════
   ⑤ ONBOARDING — Wire into APP.init() and navigation
   Call ONBOARD.start() after APP.init() completes.
   Also add gst_filing and upi_tracker to renderSection map.
══════════════════════════════════════════════════════════════════ */

// ── Called directly from launchApp() in index.html after APP.init() ─────────
// This replaces the broken DOMContentLoaded patching approach.
// index.html calls: ONBOARD.startIfNeeded() after APP.init() in launchApp()
function onboardingReady() {
  // Wire up renderSection extensions for new sections
  // These are now also directly in app.js renderSection map — this is a fallback
  if (typeof APP !== 'undefined') {
    const _origRender = APP.renderSection.bind(APP);
    APP.renderSection = function(id) {
      if (id === 'gst_filing')   { renderGSTFiling(); return; }
      if (id === 'upi_tracker')  { renderUPITracker(); return; }
      if (id === 'tally_export') { renderTallyExport(); return; }
      _origRender(id);
    };
  }

  // Show onboarding or start push notifications
  if (ONBOARD.shouldShow()) {
    ONBOARD.start();
  } else {
    PUSH.init();
  }
}


/* ══════════════════════════════════════════════════════════════════
   ⑥ TALLY-COMPATIBLE EXPORT
   Legal note: "Tally" is a registered trademark of Tally Solutions
   Pvt. Ltd. We do NOT use their logo, branding, or API.
   We export data in industry-standard formats that Tally can import:
     - Tally XML (TDML format — publicly documented)
     - CSV Ledger format (universally importable)
     - JSON for CA/accountant sharing
   This is legally the same as "export to Excel" — format compatibility,
   not replication of Tally software.
══════════════════════════════════════════════════════════════════ */

function renderTallyExport() {
  const settings = STRATIX_DB.getSettings();
  const sym = settings.currencySymbol || '₹';
  const txns = STRATIX_DB.getArr('transactions');
  const employees = STRATIX_DB.getArr('employees');
  const gstEntries = STRATIX_DB.getArr('gstEntries');

  const now = new Date();
  const fyStart = settings.financialYear === '2025-26' ? '2025-04-01' : '2024-04-01';
  const fyEnd   = settings.financialYear === '2025-26' ? '2026-03-31' : '2025-03-31';
  const fyTxns  = txns.filter(t => t.date && t.date >= fyStart && t.date <= fyEnd);
  const totalRev = fyTxns.filter(t=>t.type==='revenue').reduce((s,t)=>s+Number(t.amount),0);
  const totalExp = fyTxns.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);

  // Category → Tally ledger mapping
  const LEDGER_MAP = {
    freight: 'Freight Revenue', sales: 'Sales Accounts', revenue: 'Sales Accounts',
    fuel: 'Fuel & Lubricants', toll: 'Toll & Taxes', salary: 'Salaries & Wages',
    purchase: 'Purchases', material: 'Material Cost', repair: 'Repairs & Maintenance',
    insurance: 'Insurance', rent: 'Rent Paid', electric: 'Electricity Charges',
    phone: 'Telephone Expenses', stationary: 'Stationery', other: 'Miscellaneous Expenses',
    payment: 'Sundry Debtors', bank: 'Bank Charges', tax: 'Taxes & Duties'
  };

  document.getElementById('sectionContent').innerHTML = `
    <div class="sec">
      <div class="sec-head">
        <div>
          <h1 class="sec-title">📊 Tally-Compatible Export</h1>
          <p class="sec-sub">Export your STRATIX data in formats that Tally, CA tools & Excel can import</p>
        </div>
      </div>

      <!-- Legal clarity banner -->
      <div style="background:rgba(79,158,240,.07);border:1px solid rgba(79,158,240,.2);border-radius:12px;padding:14px 18px;margin-bottom:20px;font-size:13px;color:var(--text2);line-height:1.7">
        ℹ️ <strong>About this feature:</strong> STRATIX exports your data in industry-standard formats (XML, CSV, JSON) that are compatible with Tally, Busy, and other accounting software. 
        We do not integrate with or replicate Tally software. "Tally" is a trademark of Tally Solutions Pvt. Ltd.
        <strong>Always verify exports with your CA before importing into accounting software.</strong>
      </div>

      <!-- Summary KPIs -->
      <div class="kpi-grid" style="margin-bottom:20px">
        <div class="kpi accent">
          <div class="kpi-ico">📅</div>
          <div class="kpi-lbl">Financial Year</div>
          <div class="kpi-val" style="font-size:16px">${settings.financialYear || '2025-26'}</div>
        </div>
        <div class="kpi">
          <div class="kpi-ico">📄</div>
          <div class="kpi-lbl">Total Transactions</div>
          <div class="kpi-val">${fyTxns.length}</div>
        </div>
        <div class="kpi">
          <div class="kpi-ico">💰</div>
          <div class="kpi-lbl">Total Revenue (FY)</div>
          <div class="kpi-val green">${sym}${totalRev.toLocaleString('en-IN')}</div>
        </div>
        <div class="kpi">
          <div class="kpi-ico">💸</div>
          <div class="kpi-lbl">Total Expenses (FY)</div>
          <div class="kpi-val">${sym}${totalExp.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <!-- Export options grid -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px">

        <!-- Tally XML -->
        <div class="card" style="border:1px solid rgba(37,99,235,.2)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="font-size:28px">📄</div>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text)">Tally XML (TDML)</div>
              <div style="font-size:11px;color:var(--muted)">Import directly into Tally ERP / Prime</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.7">
            Exports all vouchers (sales, purchase, payments, receipts) in Tally Data Migration Language format.
            Your CA can import this file into Tally with one click.
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-gold btn-sm" onclick="exportTallyXML('vouchers')">📥 Export Vouchers</button>
            <button class="btn btn-outline btn-sm" onclick="exportTallyXML('masters')">📥 Masters</button>
          </div>
        </div>

        <!-- CSV Ledger -->
        <div class="card" style="border:1px solid rgba(0,214,143,.2)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="font-size:28px">📊</div>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text)">CSV Ledger</div>
              <div style="font-size:11px;color:var(--muted)">Open in Excel, Google Sheets, Busy</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.7">
            Clean spreadsheet with Date, Ledger, Debit, Credit, Narration columns. 
            Standard double-entry format any accountant understands.
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-gold btn-sm" onclick="exportCSVLedger()">📥 Export CSV</button>
            <button class="btn btn-outline btn-sm" onclick="exportCSVLedger('payroll')">💸 Payroll CSV</button>
          </div>
        </div>

        <!-- P&L Statement -->
        <div class="card" style="border:1px solid rgba(79,158,240,.2)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="font-size:28px">📈</div>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text)">P&L + Balance Sheet</div>
              <div style="font-size:11px;color:var(--muted)">CA-ready financial statements</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.7">
            Profit & Loss statement with category-wise breakdown + simplified Balance Sheet. 
            Print or share as PDF with your CA.
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-gold btn-sm" onclick="exportPnLStatement()">📥 Export P&L</button>
            <button class="btn btn-outline btn-sm" onclick="printPnLStatement()">🖨️ Print</button>
          </div>
        </div>

        <!-- GST Returns data -->
        <div class="card" style="border:1px solid rgba(155,93,229,.2)">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="font-size:28px">🧾</div>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text)">GST Returns Data</div>
              <div style="font-size:11px;color:var(--muted)">GSTR-1 & GSTR-3B ready format</div>
            </div>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:14px;line-height:1.7">
            JSON export with all outward supplies, B2B/B2C split, HSN summary, and ITC data.
            Your CA can use this to file GST returns directly.
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-gold btn-sm" onclick="exportGSTJSON ? exportGSTJSON() : APP.navigate('gst_filing')">📥 Export GST</button>
            <button class="btn btn-outline btn-sm" onclick="APP.navigate('gst_filing')">📑 GST Hub</button>
          </div>
        </div>

      </div>

      <!-- Ledger preview table -->
      <div class="tbl-wrap">
        <div class="tbl-head">
          <div class="tbl-title">📋 Ledger Preview — ${settings.financialYear || '2025-26'}</div>
          <div style="font-size:12px;color:var(--muted)">${fyTxns.length} transactions · ${fyStart} to ${fyEnd}</div>
        </div>
        ${fyTxns.length === 0 ? `
          <div style="padding:40px;text-align:center;color:var(--muted)">
            <div style="font-size:36px;margin-bottom:12px">📄</div>
            <div style="font-size:14px;margin-bottom:8px">No transactions for FY ${settings.financialYear || '2025-26'}</div>
            <div style="font-size:12px">Add transactions via <button class="btn btn-ghost btn-sm" onclick="APP.navigate('datamanager')">Data Manager</button></div>
          </div>` : `
        <div class="tbl-scroll"><table>
          <thead><tr><th>Date</th><th>Ledger Account</th><th>Type</th><th>Debit</th><th>Credit</th><th>Narration</th></tr></thead>
          <tbody>
            ${fyTxns.slice(0, 50).map(t => {
              const ledger = LEDGER_MAP[t.category] || (t.type === 'revenue' ? 'Sales Accounts' : 'Miscellaneous Expenses');
              const isRev = t.type === 'revenue';
              return `<tr>
                <td class="td-m">${t.date||'—'}</td>
                <td class="td-b">${ledger}</td>
                <td><span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${isRev?'rgba(0,214,143,.1)':'rgba(255,77,77,.1)'};color:${isRev?'var(--green)':'var(--red)'}">${isRev?'CR':'DR'}</span></td>
                <td style="color:var(--red)">${!isRev ? sym+Number(t.amount).toLocaleString('en-IN') : '—'}</td>
                <td style="color:var(--green)">${isRev ? sym+Number(t.amount).toLocaleString('en-IN') : '—'}</td>
                <td class="td-m" style="font-size:12px">${escapeHTML(t.description||'—').slice(0,40)}</td>
              </tr>`;
            }).join('')}
            ${fyTxns.length > 50 ? `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:10px">... and ${fyTxns.length - 50} more transactions (all included in export)</td></tr>` : ''}
          </tbody>
        </table></div>`}
      </div>

      <!-- CA sharing section -->
      <div class="card" style="margin-top:16px">
        <div class="card-title">👨‍💼 Share with Your CA</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
          <div class="field"><label>CA Name</label><input id="caName" placeholder="CA Ramesh Sharma"/></div>
          <div class="field"><label>CA WhatsApp</label><input id="caPhone" type="tel" placeholder="+91 98765 43210"/></div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-gold" onclick="sendToCA()">📱 Send Summary via WhatsApp</button>
          <button class="btn btn-outline" onclick="exportFullPackage()">📦 Export Full Package (ZIP)</button>
        </div>
      </div>
    </div>`;
}

// ── Tally XML (TDML format) Export ─────────────────────────────────────────
function exportTallyXML(type) {
  const settings = STRATIX_DB.getSettings();
  const txns = STRATIX_DB.getArr('transactions');
  const fyStart = settings.financialYear === '2025-26' ? '2025-04-01' : '2024-04-01';
  const fyEnd   = settings.financialYear === '2025-26' ? '2026-03-31' : '2025-03-31';
  const fyTxns  = txns.filter(t => t.date && t.date >= fyStart && t.date <= fyEnd);

  const LEDGER_MAP = {
    freight: 'Freight Revenue', sales: 'Sales Accounts', revenue: 'Sales Accounts',
    fuel: 'Fuel & Lubricants', toll: 'Toll & Taxes', salary: 'Salaries & Wages',
    purchase: 'Purchases', material: 'Material Cost', other: 'Miscellaneous Expenses',
    payment: 'Sundry Debtors', bank: 'Bank Charges', tax: 'Taxes & Duties'
  };

  function tallyDate(d) {
    if (!d) return '';
    return d.replace(/-/g, '').slice(0, 8); // YYYYMMDD
  }

  let voucherXML = '';
  if (type === 'vouchers') {
    fyTxns.forEach((t, i) => {
      const isRev = t.type === 'revenue';
      const ledger = LEDGER_MAP[t.category] || (isRev ? 'Sales Accounts' : 'Miscellaneous Expenses');
      const vtype = isRev ? 'Receipt' : 'Payment';
      const amt = Number(t.amount);
      voucherXML += `
  <VOUCHER VCHTYPE="${vtype}" ACTION="Create" OBJVIEW="Accounting Voucher View">
    <DATE>${tallyDate(t.date)}</DATE>
    <NARRATION>${(t.description||'').replace(/[<>&"']/g, ' ')}</NARRATION>
    <VOUCHERTYPENAME>${vtype}</VOUCHERTYPENAME>
    <VOUCHERNUMBER>TXN-${i+1}</VOUCHERNUMBER>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${isRev ? 'Cash / Bank' : ledger}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${isRev ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
      <AMOUNT>${isRev ? -amt : amt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
    <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${isRev ? ledger : 'Cash / Bank'}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${isRev ? 'No' : 'Yes'}</ISDEEMEDPOSITIVE>
      <AMOUNT>${isRev ? amt : -amt}</AMOUNT>
    </ALLLEDGERENTRIES.LIST>
  </VOUCHER>`;
    });
  } else {
    // Masters — ledger accounts
    const ledgerSet = new Set(['Cash / Bank', 'Sales Accounts', 'Purchases', 'Sundry Debtors', 'Sundry Creditors']);
    fyTxns.forEach(t => ledgerSet.add(LEDGER_MAP[t.category] || (t.type === 'revenue' ? 'Sales Accounts' : 'Miscellaneous Expenses')));
    ledgerSet.forEach(name => {
      const group = name.includes('Sales') ? 'Sales Accounts' : name.includes('Purchase') ? 'Purchase Accounts' : name === 'Cash / Bank' ? 'Bank Accounts' : 'Indirect Expenses';
      voucherXML += `
  <LEDGER NAME="${name}" ACTION="Create">
    <NAME>${name}</NAME>
    <PARENT>${group}</PARENT>
    <OPENINGBALANCE>0</OPENINGBALANCE>
  </LEDGER>`;
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Generated by STRATIX Business Intelligence Platform
  Company: ${settings.businessName || ''}
  GSTIN: ${settings.gstNumber || ''}
  Financial Year: ${settings.financialYear || '2025-26'}
  Export Date: ${new Date().toISOString().split('T')[0]}
  IMPORTANT: Verify all entries with your CA before importing into Tally.
  "Tally" is a registered trademark of Tally Solutions Pvt. Ltd.
-->
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${(settings.businessName||'').replace(/[<>&"']/g,' ')}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          ${voucherXML}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;

  const blob = new Blob([xml], { type: 'text/xml' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `STRATIX_Tally_${type}_${settings.financialYear||'FY'}_${settings.businessName||'export'}.xml`;
  a.click();
  NOTIFY.show(`Tally XML exported! Import into Tally: Gateway → Import Data → ${type === 'vouchers' ? 'Vouchers' : 'Masters'}`, 'success', 6000);
}

// ── CSV Ledger Export ───────────────────────────────────────────────────────
function exportCSVLedger(type) {
  const settings = STRATIX_DB.getSettings();
  const sym = settings.currencySymbol || '₹';
  const fyStart = settings.financialYear === '2025-26' ? '2025-04-01' : '2024-04-01';
  const fyEnd   = settings.financialYear === '2025-26' ? '2026-03-31' : '2025-03-31';

  const LEDGER_MAP = {
    freight:'Freight Revenue',sales:'Sales Accounts',revenue:'Sales Accounts',
    fuel:'Fuel & Lubricants',toll:'Toll & Taxes',salary:'Salaries & Wages',
    purchase:'Purchases',material:'Material Cost',other:'Miscellaneous Expenses',
    payment:'Sundry Debtors',bank:'Bank Charges',tax:'Taxes & Duties'
  };

  let rows, filename;

  if (type === 'payroll') {
    const employees = STRATIX_DB.getArr('employees');
    rows = [['Employee Name','Designation','Department','Basic Salary','HRA','DA','Gross Salary','PF (Employee)','ESI (Employee)','TDS','Net Pay','DOJ']];
    employees.forEach(e => {
      const basic = e.basic||0, hra=e.hra||Math.round(basic*.4), da=e.da||Math.round(basic*.1);
      const gross=basic+hra+da+(e.special||0)+(e.otherAllow||0);
      const pf=basic<=15000?Math.round(basic*.12):1800, esi=gross<=21000?Math.round(gross*.0075):0;
      const tds=0; // simplified
      rows.push([e.name,e.designation||'',e.department||'',basic,hra,da,gross,pf,esi,tds,gross-pf-esi-tds,e.doj||'']);
    });
    filename = `STRATIX_Payroll_${settings.financialYear||'FY'}.csv`;
  } else {
    const txns = STRATIX_DB.getArr('transactions').filter(t=>t.date&&t.date>=fyStart&&t.date<=fyEnd);
    rows = [['Date','Ledger Account','Voucher Type','Debit','Credit','Narration','Category','Reference']];
    txns.forEach((t,i) => {
      const isRev = t.type==='revenue';
      const ledger = LEDGER_MAP[t.category]||(isRev?'Sales Accounts':'Miscellaneous Expenses');
      rows.push([
        t.date,ledger,isRev?'Receipt':'Payment',
        isRev?'':Number(t.amount).toFixed(2),
        isRev?Number(t.amount).toFixed(2):'',
        (t.description||'').replace(/,/g,' '),
        t.category||'other',
        `TXN-${i+1}`
      ]);
    });
    filename = `STRATIX_Ledger_${settings.financialYear||'FY'}_${settings.businessName||'export'}.csv`;
  }

  const csv = rows.map(r => r.map(v => `"${String(v||'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8' }); // BOM for Excel
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  NOTIFY.show('CSV exported! Open in Excel or share with your CA.', 'success', 4000);
}

// ── P&L Statement Export / Print ───────────────────────────────────────────
function exportPnLStatement() {
  const settings = STRATIX_DB.getSettings();
  const sym = settings.currencySymbol || '₹';
  const fyStart = settings.financialYear === '2025-26' ? '2025-04-01' : '2024-04-01';
  const fyEnd   = settings.financialYear === '2025-26' ? '2026-03-31' : '2025-03-31';
  const txns = STRATIX_DB.getArr('transactions').filter(t=>t.date&&t.date>=fyStart&&t.date<=fyEnd);

  // Group by category
  const revCats={}, expCats={};
  txns.filter(t=>t.type==='revenue').forEach(t=>{
    const k=t.category||'other'; revCats[k]=(revCats[k]||0)+Number(t.amount);
  });
  txns.filter(t=>t.type==='expense').forEach(t=>{
    const k=t.category||'other'; expCats[k]=(expCats[k]||0)+Number(t.amount);
  });
  const totalRev=Object.values(revCats).reduce((a,b)=>a+b,0);
  const totalExp=Object.values(expCats).reduce((a,b)=>a+b,0);
  const netProfit=totalRev-totalExp;

  const NAMES={freight:'Freight Revenue',sales:'Sales Revenue',revenue:'Revenue',fuel:'Fuel & Lubricants',toll:'Toll & Road Tax',salary:'Salaries & Wages',purchase:'Purchase of Goods',material:'Raw Material Cost',repair:'Repairs & Maintenance',insurance:'Insurance Premium',rent:'Rent Paid',electric:'Electricity',phone:'Telephone',other:'Miscellaneous',payment:'Payment Received',bank:'Bank Charges'};

  const data = {
    _generated_by: 'STRATIX v7.0', _type: 'Profit & Loss Statement',
    business: settings.businessName, gstin: settings.gstNumber,
    period: `${fyStart} to ${fyEnd}`,
    revenue: Object.entries(revCats).map(([k,v])=>({category:NAMES[k]||k,amount:v})),
    total_revenue: totalRev,
    expenses: Object.entries(expCats).map(([k,v])=>({category:NAMES[k]||k,amount:v})),
    total_expenses: totalExp,
    net_profit: netProfit,
    profit_margin: totalRev>0?((netProfit/totalRev)*100).toFixed(1)+'%':'N/A'
  };

  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `STRATIX_PnL_${settings.financialYear||'FY'}_${settings.businessName||'export'}.json`;
  a.click();
  NOTIFY.show('P&L Statement exported! Share this JSON with your CA.', 'success', 4000);
}

function printPnLStatement() {
  const settings = STRATIX_DB.getSettings();
  const sym = settings.currencySymbol || '₹';
  const fyStart = settings.financialYear === '2025-26' ? '2025-04-01' : '2024-04-01';
  const fyEnd   = settings.financialYear === '2025-26' ? '2026-03-31' : '2025-03-31';
  const txns = STRATIX_DB.getArr('transactions').filter(t=>t.date&&t.date>=fyStart&&t.date<=fyEnd);

  const revCats={}, expCats={};
  txns.filter(t=>t.type==='revenue').forEach(t=>{const k=t.category||'other';revCats[k]=(revCats[k]||0)+Number(t.amount);});
  txns.filter(t=>t.type==='expense').forEach(t=>{const k=t.category||'other';expCats[k]=(expCats[k]||0)+Number(t.amount);});
  const totalRev=Object.values(revCats).reduce((a,b)=>a+b,0);
  const totalExp=Object.values(expCats).reduce((a,b)=>a+b,0);
  const netProfit=totalRev-totalExp;
  const NAMES={freight:'Freight Revenue',sales:'Sales Revenue',revenue:'Revenue',fuel:'Fuel & Lubricants',toll:'Toll & Road Tax',salary:'Salaries & Wages',purchase:'Purchase of Goods',material:'Raw Material Cost',other:'Miscellaneous Expenses'};

  const win = window.open('', '_blank', 'width=860,height=920');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>P&L Statement - ${settings.businessName||''}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;padding:30px;color:#111;background:#fff}
    .header{text-align:center;border-bottom:2px solid #111;padding-bottom:14px;margin-bottom:20px}
    .co-name{font-size:22px;font-weight:800;letter-spacing:1px}
    .sub{font-size:13px;color:#555;margin-top:4px}
    .title{font-size:17px;font-weight:700;margin:16px 0 4px}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{background:#2563EB;color:#fff;padding:8px 12px;text-align:left;font-size:12px}
    td{padding:8px 12px;border-bottom:1px solid #eee;font-size:13px}
    .total-row{background:#f9f9f9;font-weight:700}
    .profit-row{background:#e8f5e9;font-weight:800;font-size:15px}
    .loss-row{background:#ffebee;font-weight:800;font-size:15px}
    .right{text-align:right}
    .disclaimer{font-size:11px;color:#888;margin-top:20px;border-top:1px solid #ddd;padding-top:10px}
    .no-print{display:none}
    @media print{.no-print{display:none}}
  </style></head><body>
  <button class="no-print" onclick="window.print()" style="position:fixed;top:14px;right:14px;padding:10px 20px;background:#2563EB;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:14px">🖨️ Print / Save PDF</button>
  <div class="header">
    <div class="co-name">${settings.businessName||'Your Business'}</div>
    <div class="sub">GSTIN: ${settings.gstNumber||'—'} &nbsp;|&nbsp; ${settings.address||''}</div>
    <div class="sub" style="margin-top:8px;font-size:15px;font-weight:700">Profit & Loss Statement — FY ${settings.financialYear||'2025-26'}</div>
    <div class="sub">${fyStart} to ${fyEnd}</div>
  </div>
  <div class="title">Income</div>
  <table>
    <tr><th>Category</th><th class="right">Amount (${sym})</th></tr>
    ${Object.entries(revCats).map(([k,v])=>`<tr><td>${NAMES[k]||k}</td><td class="right">${v.toLocaleString('en-IN')}</td></tr>`).join('')}
    <tr class="total-row"><td>TOTAL INCOME</td><td class="right">${totalRev.toLocaleString('en-IN')}</td></tr>
  </table>
  <div class="title">Expenditure</div>
  <table>
    <tr><th>Category</th><th class="right">Amount (${sym})</th></tr>
    ${Object.entries(expCats).map(([k,v])=>`<tr><td>${NAMES[k]||k}</td><td class="right">${v.toLocaleString('en-IN')}</td></tr>`).join('')}
    <tr class="total-row"><td>TOTAL EXPENDITURE</td><td class="right">${totalExp.toLocaleString('en-IN')}</td></tr>
  </table>
  <table>
    <tr class="${netProfit>=0?'profit-row':'loss-row'}">
      <td>NET ${netProfit>=0?'PROFIT':'LOSS'}</td>
      <td class="right">${sym}${Math.abs(netProfit).toLocaleString('en-IN')} (${totalRev>0?((netProfit/totalRev)*100).toFixed(1)+'%':'N/A'} margin)</td>
    </tr>
  </table>
  <div class="disclaimer">
    ⚠️ Generated by STRATIX Business Intelligence Platform on ${new Date().toLocaleDateString('en-IN')}. 
    This statement is indicative only. Verify all figures with a qualified Chartered Accountant before use in tax filings or legal documents.
  </div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 800);
}

// ── Send to CA via WhatsApp ─────────────────────────────────────────────────
function sendToCA() {
  const settings = STRATIX_DB.getSettings();
  const sym = settings.currencySymbol || '₹';
  const fyStart = settings.financialYear === '2025-26' ? '2025-04-01' : '2024-04-01';
  const fyEnd   = settings.financialYear === '2025-26' ? '2026-03-31' : '2025-03-31';
  const txns = STRATIX_DB.getArr('transactions').filter(t=>t.date&&t.date>=fyStart&&t.date<=fyEnd);
  const totalRev = txns.filter(t=>t.type==='revenue').reduce((s,t)=>s+Number(t.amount),0);
  const totalExp = txns.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0);
  const netProfit = totalRev - totalExp;
  const phone = (document.getElementById('caPhone')?.value||'').replace(/[^0-9]/g,'');
  const caName = document.getElementById('caName')?.value || 'CA Sir/Ma\'am';
  if (!phone) { NOTIFY.show('Enter CA\'s WhatsApp number first', 'warning'); return; }

  const msg = `Dear ${caName},\n\nPlease find the financial summary for FY ${settings.financialYear||'2025-26'}:\n\n` +
    `*Business:* ${settings.businessName||'—'}\n` +
    `*GSTIN:* ${settings.gstNumber||'Not registered'}\n\n` +
    `*Financial Summary:*\n` +
    `• Total Revenue: *${sym}${totalRev.toLocaleString('en-IN')}*\n` +
    `• Total Expenses: *${sym}${totalExp.toLocaleString('en-IN')}*\n` +
    `• Net ${netProfit>=0?'Profit':'Loss'}: *${sym}${Math.abs(netProfit).toLocaleString('en-IN')}*\n` +
    `• Total Transactions: ${txns.length}\n\n` +
    `I will share the detailed CSV/XML export file separately.\n\n` +
    `Please advise on any corrections before GST filing.\n\n` +
    `_Exported from STRATIX Business Platform_`;

  const normalized = phone.startsWith('91') ? phone : '91' + phone;
  window.open(`https://wa.me/${normalized}?text=${encodeURIComponent(msg)}`, '_blank');
  NOTIFY.show('WhatsApp opened with financial summary for your CA! 📱', 'success');
}

// ── Export Full Package ─────────────────────────────────────────────────────
function exportFullPackage() {
  // Export all 3 formats sequentially
  NOTIFY.show('Exporting all formats... (3 files will download)', 'info', 3000);
  setTimeout(() => exportTallyXML('vouchers'), 300);
  setTimeout(() => exportCSVLedger(), 1200);
  setTimeout(() => exportPnLStatement(), 2100);
  setTimeout(() => {
    if (typeof exportGSTJSON === 'function') exportGSTJSON();
  }, 3000);
}
