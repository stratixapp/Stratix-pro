/**
 * STRATIX vertical.js v3.0
 * 4 Focused Verticals — Perfectly Aligned Tools
 *
 *  1. logistics   — Transport / Freight / Fleet companies
 *  2. msme        — MSME / Services / Contractors / Professionals
 *  3. retail      — Retail Shops / Trading / Distributors
 *  4. factory     — Manufacturing / Factory / Production
 *  5. other       — All Tools (every section unlocked)
 */

const VERTICAL = (() => {

  const CONFIGS = {

    /* ═══════════════════════════════════════════════════════════════
       1. LOGISTICS — Transport / Freight / Fleet
       Full tools: LR, E-Way, POD, Freight Invoice, Fleet, Trip P&L,
       Route Optimizer, Load Planner, Driver Payroll, GST, CRM, WhatsApp
    ═══════════════════════════════════════════════════════════════ */
    logistics: {
      id:          'logistics',
      label:       'Transport / Logistics',
      icon:        '🚛',
      accentColor: '#2563EB',
      accentRgb:   '240,165,0',
      tagline:     'Move freight. Track every rupee. Run your fleet.',
      labels: {
        dashboard:    'Dashboard',
        analytics:    'Fleet Analytics',
        logistics:    'Route & Freight Calculators',
        logisticsdocs:'All Logistics Documents',
        fleet:        'Fleet Manager',
        trippnl:      'Trip P&L',
        invoiceaging: 'Freight Dues / Invoice Aging',
        erp:          'Operations ERP',
        crm:          'Clients & Consignors',
        scm:          'Spare Parts & Vendors',
        salary:       'Driver & Staff Payroll',
        documents:    'Documents',
        datamanager:  'Ledger',
        goals:        'Goals',
        notes:        'Notes',
        reminders:    'Reminders',
        strategy:     'Strategy',
        gst:          'GST Calculator',
        loan:         'Loan Readiness',
        earlywarning: 'Early Warning',
        ordertracker: 'Order Tracker',
        bank:         'Bank Tracker',
        whatsapp:     'WhatsApp Tools',
        project_scope: 'Project Scope',
        calculators:  'Calculators',
        tds_tracker:  'TDS / TCS Tracker',
        amc_tracker:  'AMC & Insurance Tracker',
        settings:     'Settings',
        privacy:      'Privacy'
      },
      navGroups: [
        { label: '🚛 Operations',      ids: ['dashboard','analytics','trippnl','fleet'] },
        { label: '📋 All Documents',   ids: ['logisticsdocs','epod','documents'] },
        { label: '🗺️ Route & Load',   ids: ['logistics','route_optimizer','load_planner'] },
        { label: '🔧 Fleet Tools',     ids: ['maintenance','amc_tracker','earlywarning','scm'] },
        { label: '📦 Orders & Docs',   ids: ['invoiceaging','ordertracker','erp'] },
        { label: '🤝 Clients',         ids: ['crm','whatsapp','reminders'] },
        { label: '💰 Finance',         ids: ['datamanager','gst','gst_filing','tds_tracker','bank','upi_tracker','salary','loan'] },
        { label: '🧠 Intelligence',    ids: ['decision','calculators','strategy','tally_export'] },
        { label: '📌 Workspace',       ids: ['goals','notes'] },
        { label: '⚙️ Account',         ids: ['settings','privacy'] }
      ],
      bottomNav: [
        { id:'dashboard',     icon:'🏠',  label:'Home' },
        { id:'trippnl',       icon:'🛣️', label:'Trips' },
        { id:'fleet',         icon:'🚛',  label:'Fleet' },
        { id:'logisticsdocs', icon:'📋',  label:'Docs' },
        { id:'menu',          icon:'☰',   label:'More', isMenu:true }
      ],
      kpiLabels: {
        revenue: 'Freight Revenue',
        expense: 'Operating Cost',
        profit:  'Net Profit',
        pending: 'Freight Dues'
      },
      quickActions: [
        { label:'New Trip',      icon:'🛣️', section:'trippnl' },
        { label:'New LR / Doc',  icon:'📋',  section:'logisticsdocs' },
        { label:'Add Vehicle',   icon:'🚛',  section:'fleet' },
        { label:'Route Plan',    icon:'🗺️', section:'route_optimizer' },
        { label:'Load Planner',  icon:'📦',  section:'load_planner' },
        { label:'Log Revenue',   icon:'💰',  section:'datamanager' },
        { label:'Collect Due',   icon:'💸',  section:'invoiceaging' },
        { label:'WhatsApp',      icon:'📱',  section:'whatsapp' },
        { label:'GST Calc',      icon:'🧾',  section:'gst' },
        { label:'Project Scope', icon:'🎯',  section:'project_scope' }
      ]
    },

    /* ═══════════════════════════════════════════════════════════════
       2. MSME — Services / Contractors / Small Business / Professionals
       Full tools: Project ERP, Invoices, Timesheets, Labour Payroll,
       GST, CRM, WhatsApp collections, AMC contracts, AI Advisor
    ═══════════════════════════════════════════════════════════════ */
    msme: {
      id:          'msme',
      label:       'MSME / Services / Contractor',
      icon:        '🏢',
      accentColor: '#a855f7',
      accentRgb:   '168,85,247',
      tagline:     'Deliver work. Invoice fast. Grow your business.',
      labels: {
        dashboard:    'Dashboard',
        analytics:    'Revenue Analytics',
        logisticsdocs:'Invoices & Documents',
        trippnl:      'Project P&L',
        invoiceaging: 'Invoice Aging',
        erp:          'Project / Work ERP',
        crm:          'Clients',
        scm:          'Materials & Procurement',
        salary:       'Staff & Labour Payroll',
        documents:    'Documents',
        datamanager:  'Ledger',
        goals:        'Business Goals',
        notes:        'Notes',
        reminders:    'Follow-ups',
        strategy:     'Business Strategy',
        gst:          'GST Billing',
        loan:         'Loan Readiness',
        earlywarning: 'Cash Flow Warning',
        ordertracker: 'Project Tracker',
        bank:         'Bank Tracker',
        whatsapp:     'WhatsApp Tools',
        project_scope: 'Project Scope',
        calculators:  'Calculators',
        tds_tracker:  'TDS / TCS Tracker',
        amc_tracker:  'AMC & Contracts',
        timesheets:   'Timesheets',
        settings:     'Settings',
        privacy:      'Privacy'
      },
      navGroups: [
        { label: '🏢 Business',        ids: ['dashboard','analytics','erp','ordertracker'] },
        { label: '📄 Billing & Docs',  ids: ['logisticsdocs','invoiceaging','documents'] },
        { label: '🤝 Clients',         ids: ['crm','whatsapp','reminders'] },
        { label: '👷 Staff & Work',    ids: ['salary','timesheets','scm','earlywarning'] },
        { label: '💰 Finance',         ids: ['datamanager','gst','gst_filing','upi_tracker','tds_tracker','bank','loan','trippnl'] },
        { label: '📋 Contracts',       ids: ['amc_tracker'] },
        { label: '🧠 Intelligence',    ids: ['decision','calculators','strategy','tally_export'] },
        { label: '📌 Workspace',       ids: ['goals','notes'] },
        { label: '⚙️ Account',         ids: ['settings','privacy'] }
      ],
      bottomNav: [
        { id:'dashboard',    icon:'🏠', label:'Home' },
        { id:'erp',          icon:'🔧', label:'Projects' },
        { id:'invoiceaging', icon:'💰', label:'Invoices' },
        { id:'crm',          icon:'🤝', label:'Clients' },
        { id:'menu',         icon:'☰',  label:'More', isMenu:true }
      ],
      kpiLabels: {
        revenue: 'Project Revenue',
        expense: 'Project Cost',
        profit:  'Net Profit',
        pending: 'Pending Invoices'
      },
      quickActions: [
        { label:'New Project',   icon:'🔧',  section:'erp' },
        { label:'New Invoice',   icon:'📄',  section:'logisticsdocs' },
        { label:'Project P&L',   icon:'📊',  section:'trippnl' },
        { label:'New Client',    icon:'🤝',  section:'crm' },
        { label:'Log Revenue',   icon:'💰',  section:'datamanager' },
        { label:'GST Bill',      icon:'🧾',  section:'gst' },
        { label:'Collect Due',   icon:'💸',  section:'invoiceaging' },
        { label:'WhatsApp',      icon:'📱',  section:'whatsapp' },
        { label:'Timesheet',     icon:'⏱️', section:'timesheets' },
        { label:'Project Scope', icon:'🎯',  section:'project_scope' }
      ]
    },

    /* ═══════════════════════════════════════════════════════════════
       3. RETAIL — Shops / Trading / Distribution
       Full tools: POS Billing, Stock/Inventory, GST Invoice,
       Customer CRM, Supplier SCM, WhatsApp receipts, Loyalty
    ═══════════════════════════════════════════════════════════════ */
    retail: {
      id:          'retail',
      label:       'Retail Shop / Trading',
      icon:        '🛒',
      accentColor: '#00d68f',
      accentRgb:   '0,214,143',
      tagline:     'Sell fast. Stock smart. Bill in seconds.',
      labels: {
        dashboard:    'Dashboard',
        analytics:    'Sales Analytics',
        erp:          'POS Billing & Inventory',
        scm:          'Suppliers & Purchase',
        earlywarning: 'Stock Alerts',
        invoiceaging: 'Receivables',
        crm:          'Customers',
        salary:       'Staff Payroll',
        documents:    'Documents',
        datamanager:  'Sales Ledger',
        goals:        'Sales Goals',
        notes:        'Notes',
        reminders:    'Reminders',
        strategy:     'Growth Strategy',
        gst:          'GST / Billing',
        loan:         'Business Loan',
        ordertracker: 'Purchase Orders',
        bank:         'Bank Tracker',
        whatsapp:     'WhatsApp Tools',
        project_scope: 'Project Scope',
        calculators:  'Calculators',
        tds_tracker:  'TDS / TCS Tracker',
        logisticsdocs:'Delivery & Invoices',
        settings:     'Settings',
        privacy:      'Privacy'
      },
      navGroups: [
        { label: '🛒 Sales & POS',     ids: ['dashboard','analytics','erp','datamanager'] },
        { label: '📦 Stock',           ids: ['scm','earlywarning','ordertracker','variant_manager'] },
        { label: '🤝 Customers',       ids: ['crm','invoiceaging','loyalty','whatsapp','reminders'] },
        { label: '📄 Billing & Docs',  ids: ['logisticsdocs','documents','epod'] },
        { label: '💰 Finance',         ids: ['gst','gst_filing','upi_tracker','bank','tds_tracker','salary','loan'] },
        { label: '🧠 Intelligence',    ids: ['decision','calculators','strategy','tally_export'] },
        { label: '📌 Workspace',       ids: ['goals','notes','amc_tracker'] },
        { label: '⚙️ Account',         ids: ['settings','privacy'] }
      ],
      bottomNav: [
        { id:'dashboard',   icon:'🏠', label:'Home' },
        { id:'erp',         icon:'🛒', label:'POS/Stock' },
        { id:'crm',         icon:'👥', label:'Customers' },
        { id:'datamanager', icon:'💰', label:'Sales' },
        { id:'menu',        icon:'☰',  label:'More', isMenu:true }
      ],
      kpiLabels: {
        revenue: 'Total Sales',
        expense: 'Purchase Cost',
        profit:  'Gross Margin',
        pending: 'Receivables'
      },
      quickActions: [
        { label:'POS Billing',   icon:'🛒',  section:'erp' },
        { label:'New Sale',      icon:'💰',  section:'datamanager' },
        { label:'Add Stock',     icon:'📦',  section:'scm' },
        { label:'GST Invoice',   icon:'🧾',  section:'gst' },
        { label:'Stock Alert',   icon:'⚠️', section:'earlywarning' },
        { label:'New Customer',  icon:'👥',  section:'crm' },
        { label:'WhatsApp',      icon:'📱',  section:'whatsapp' },
        { label:'Loyalty Pts',   icon:'⭐',  section:'loyalty' },
        { label:'Purchase Order',icon:'🛍️', section:'ordertracker' },
        { label:'Project Scope', icon:'🎯',  section:'project_scope' }
      ]
    },

    /* ═══════════════════════════════════════════════════════════════
       4. FACTORY — Manufacturing / Production
       Full tools: Production ERP, Batch P&L, Raw Material SCM,
       Worker Payroll, Machine Tracker, QC, GST, Order Tracker
    ═══════════════════════════════════════════════════════════════ */
    factory: {
      id:          'factory',
      label:       'Manufacturing / Factory',
      icon:        '🏭',
      accentColor: '#4f9ef0',
      accentRgb:   '79,158,240',
      tagline:     'Produce more. Waste less. Profit more.',
      labels: {
        dashboard:    'Dashboard',
        analytics:    'Production Analytics',
        erp:          'Production ERP',
        scm:          'Raw Materials & Suppliers',
        earlywarning: 'Stock & Quality Alerts',
        invoiceaging: 'Buyer Invoice Aging',
        crm:          'Buyers & Clients',
        salary:       'Worker Payroll',
        documents:    'Documents',
        datamanager:  'Ledger',
        goals:        'Production Goals',
        notes:        'Notes',
        reminders:    'Reminders',
        strategy:     'Strategy',
        gst:          'GST on Dispatch',
        loan:         'Loan Readiness',
        ordertracker: 'Order to Dispatch',
        bank:         'Bank Tracker',
        whatsapp:     'WhatsApp Tools',
        project_scope: 'Project Scope',
        calculators:  'Calculators',
        tds_tracker:  'TDS / TCS Tracker',
        logisticsdocs:'Dispatch Documents',
        trippnl:      'Batch P&L',
        fleet:        'Machine & Vehicle Assets',
        maintenance:  'Machine Maintenance',
        load_planner: 'Dispatch Load Planner',
        settings:     'Settings',
        privacy:      'Privacy'
      },
      navGroups: [
        { label: '🏭 Production',      ids: ['dashboard','analytics','erp','ordertracker'] },
        { label: '📦 Materials',       ids: ['scm','earlywarning','load_planner','trippnl'] },
        { label: '🤝 Buyers',          ids: ['crm','invoiceaging','logisticsdocs','epod','documents'] },
        { label: '🔧 Machines & Fleet',ids: ['fleet','maintenance','amc_tracker'] },
        { label: '💰 Finance',         ids: ['datamanager','gst','gst_filing','tds_tracker','bank','upi_tracker','salary','loan'] },
        { label: '🧠 Intelligence',    ids: ['decision','calculators','strategy','whatsapp'] },
        { label: '📌 Workspace',       ids: ['goals','notes','reminders'] },
        { label: '⚙️ Account',         ids: ['settings','privacy'] }
      ],
      bottomNav: [
        { id:'dashboard', icon:'🏠', label:'Home' },
        { id:'erp',       icon:'🏭', label:'Production' },
        { id:'scm',       icon:'📦', label:'Materials' },
        { id:'crm',       icon:'🤝', label:'Buyers' },
        { id:'menu',      icon:'☰',  label:'More', isMenu:true }
      ],
      kpiLabels: {
        revenue: 'Dispatch Revenue',
        expense: 'Production Cost',
        profit:  'Gross Profit',
        pending: 'Outstanding Bills'
      },
      quickActions: [
        { label:'New Batch',     icon:'🏭',  section:'erp' },
        { label:'Raw Material',  icon:'📦',  section:'scm' },
        { label:'Order Tracker', icon:'📋',  section:'ordertracker' },
        { label:'Dispatch Doc',  icon:'📄',  section:'logisticsdocs' },
        { label:'Batch P&L',     icon:'📊',  section:'trippnl' },
        { label:'Add Worker',    icon:'👷',  section:'salary' },
        { label:'Machine Log',   icon:'🔧',  section:'maintenance' },
        { label:'GST Invoice',   icon:'🧾',  section:'gst' },
        { label:'WhatsApp',      icon:'📱',  section:'whatsapp' },
        { label:'Project Scope', icon:'🎯',  section:'project_scope' }
      ]
    },

    /* ═══════════════════════════════════════════════════════════════
       5. OTHER — All Tools (every section visible)
    ═══════════════════════════════════════════════════════════════ */
    other: {
      id:          'other',
      label:       'All Business Tools',
      icon:        '💼',
      accentColor: '#2563EB',
      accentRgb:   '240,165,0',
      tagline:     'Every tool, all in one place.',
      labels:      {},
      navGroups: [
        { label: '🏠 Overview',          ids: ['dashboard','analytics','decision'] },
        { label: '🚛 Logistics',         ids: ['logistics','logisticsdocs','fleet','trippnl','route_optimizer','load_planner','epod'] },
        { label: '🏢 Business',          ids: ['erp','crm','scm','ordertracker'] },
        { label: '🛒 Retail & POS',      ids: ['loyalty','variant_manager','omnichannel'] },
        { label: '📄 Billing & Docs',    ids: ['gst','invoiceaging','documents','datamanager'] },
        { label: '💰 Finance',           ids: ['bank','tds_tracker','salary','loan','earlywarning'] },
        { label: '🔧 Operations',        ids: ['maintenance','amc_tracker','timesheets'] },
        { label: '✨ Smart Tools',       ids: ['whatsapp','calculators','strategy','tally_export'] },
        { label: '📌 Workspace',         ids: ['goals','notes','reminders'] },
        { label: '⚙️ Account',           ids: ['settings','privacy'] }
      ],
      bottomNav: [
        { id:'dashboard',     icon:'🏠', label:'Home' },
        { id:'analytics',     icon:'📊', label:'Analytics' },
        { id:'logisticsdocs', icon:'📋', label:'Docs' },
        { id:'whatsapp',      icon:'📱', label:'WhatsApp' },
        { id:'menu',          icon:'☰',  label:'More', isMenu:true }
      ],
      kpiLabels: {
        revenue: 'Total Revenue',
        expense: 'Total Expenses',
        profit:  'Net Profit',
        pending: 'Pending Dues'
      },
      quickActions: [
        { label:'Add Revenue',  icon:'💰',  section:'datamanager' },
        { label:'Add Expense',  icon:'💸',  section:'datamanager' },
        { label:'New Doc',      icon:'📋',  section:'logisticsdocs' },
        { label:'New Client',   icon:'🤝',  section:'crm' },
        { label:'GST Calc',     icon:'🧾',  section:'gst' },
        { label:'WhatsApp',     icon:'📱',  section:'whatsapp' },
        { label:'Goals',        icon:'🎯',  section:'goals' },
        { label:'Project Scope',icon:'🎯',  section:'project_scope' }
      ]
    }

  }; // end CONFIGS

  // ── Canonical nav item definitions ──────────────────────────────
  const NAV_ITEMS = [
    { id:'dashboard',       icon:'🏠',  label:'Dashboard' },
    { id:'analytics',       icon:'📊',  label:'Analytics' },
    { id:'decision',        icon:'🧠',  label:'Decision Engine' },
    { id:'calculators',     icon:'🔢',  label:'Calculators' },
    { id:'logistics',       icon:'🚛',  label:'Route Calculators' },
    { id:'logisticsdocs',   icon:'📋',  label:'Logistics Docs',        isnew:true },
    { id:'erp',             icon:'🏭',  label:'ERP',                   isnew:true },
    { id:'crm',             icon:'🤝',  label:'CRM',                   isnew:true },
    { id:'scm',             icon:'🔗',  label:'Supply Chain',          isnew:true },
    { id:'documents',       icon:'📄',  label:'Documents' },
    { id:'datamanager',     icon:'🗄️', label:'Data Manager' },
    { id:'goals',           icon:'🎯',  label:'Goals Tracker' },
    { id:'notes',           icon:'📝',  label:'Smart Notes' },
    { id:'reminders',       icon:'🔔',  label:'Reminders' },
    { id:'strategy',        icon:'📈',  label:'Strategy Builder' },
    { id:'gst',             icon:'🧾',  label:'GST Calculator' },
    { id:'fleet',           icon:'📍',  label:'Fleet Manager' },
    { id:'loan',            icon:'🏦',  label:'Loan Readiness' },
    { id:'trippnl',         icon:'🛣️', label:'Trip P&L' },
    { id:'invoiceaging',    icon:'💰',  label:'Invoice Aging' },
    { id:'earlywarning',    icon:'⚠️', label:'Early Warning' },
    { id:'ordertracker',    icon:'📦',  label:'Order Tracker' },
    { id:'salary',          icon:'💸',  label:'Salary & Payroll',      isnew:true },
    { id:'bank',            icon:'🏦',  label:'Bank Tracker',          isnew:true },
    { id:'whatsapp',        icon:'📱',  label:'WhatsApp Tools',        isnew:true },
    { id:'project_scope',   icon:'🎯',  label:'Project Scope',          soon:true },
    { id:'settings',        icon:'⚙️', label:'Settings' },
    { id:'privacy',         icon:'🔒',  label:'Privacy Policy' },
    { id:'loyalty',         icon:'⭐',  label:'Loyalty Points',        isnew:true },
    { id:'variant_manager', icon:'🎨',  label:'Variant Manager',       isnew:true },
    { id:'timesheets',      icon:'⏱️', label:'Timesheets',            isnew:true },
    { id:'route_optimizer', icon:'🗺️',  label:'Route Optimizer',      isnew:true },
    { id:'load_planner',    icon:'📦',  label:'Load Planner',          isnew:true },
    { id:'maintenance',     icon:'🔧',  label:'Maintenance Scheduler', isnew:true },
    { id:'epod',            icon:'📸',  label:'e-POD Delivery',        isnew:true },
    { id:'tds_tracker',     icon:'🧾',  label:'TDS / TCS Tracker',     isnew:true },
    { id:'amc_tracker',     icon:'📋',  label:'AMC Tracker',           isnew:true },
    { id:'omnichannel',     icon:'🔄',  label:'Omnichannel Sync',      isnew:true },
    { id:'gst_filing',      icon:'📑',  label:'GST Filing Hub',          isnew:true },
    { id:'upi_tracker',     icon:'💳',  label:'UPI Payment Tracker',     isnew:true },
    { id:'tally_export',    icon:'📊',  label:'Tally-Compatible Export', isnew:true },
    { id:'site_logs',       icon:'🏗️', label:'Site Daily Logs',       isnew:true }
  ];

  let _current = null;

  // ── Public API ──────────────────────────────────────────────────
  function get(bizType) {
    // Map old type names → new ones
    const MAP = {
      transport: 'logistics', msme: 'msme', services: 'msme', service: 'msme',
      trading: 'retail', retail: 'retail',
      manufacturing: 'factory', factory: 'factory',
      other: 'other'
    };
    const key = MAP[bizType] || bizType;
    return CONFIGS[key] || CONFIGS.other;
  }

  function apply(bizType) {
    _current = get(bizType);
    _applyAccentColor(_current);
    _buildNav(_current);
    _buildBottomNav(_current);
    return _current;
  }

  function current() { return _current || CONFIGS.other; }

  function label(sectionId) {
    const c = current();
    return (c.labels && c.labels[sectionId]) || _defaultLabel(sectionId);
  }

  function kpiLabel(key) {
    const c = current();
    return (c.kpiLabels && c.kpiLabels[key]) || key;
  }

  // ── Private helpers ─────────────────────────────────────────────
  function _defaultLabel(id) {
    const item = NAV_ITEMS.find(n => n.id === id);
    return item ? item.label : id;
  }

  function _applyAccentColor(cfg) {
    let style = document.getElementById('vx-accent');
    if (!style) {
      style = document.createElement('style');
      style.id = 'vx-accent';
      document.head.appendChild(style);
    }
    if (cfg.accentColor !== '#2563EB') {
      style.textContent = `
        :root { --vx:${cfg.accentColor}; --vx-rgb:${cfg.accentRgb}; --vx-dim:rgba(${cfg.accentRgb},.12); --vx-dim2:rgba(${cfg.accentRgb},.06); }
        .vx-accent { color:var(--vx) !important; }
        .vx-bg { background:var(--vx-dim) !important; border-color:rgba(${cfg.accentRgb},.2) !important; }
        .vx-badge { background:rgba(${cfg.accentRgb},.12); color:var(--vx); border:1px solid rgba(${cfg.accentRgb},.25); padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; letter-spacing:.5px; }
        .nav-item.active { background:var(--vx-dim) !important; color:var(--vx) !important; border-left-color:var(--vx) !important; }
        #topbar { border-bottom-color:rgba(${cfg.accentRgb},.2) !important; }
        .btn-vx { background:linear-gradient(135deg,${cfg.accentColor},color-mix(in srgb,${cfg.accentColor} 70%,#000)) !important; color:#fff !important; }
        .kpi::before { background:linear-gradient(90deg,transparent,rgba(${cfg.accentRgb},.6),transparent) !important; }`;
    } else {
      style.textContent = `
        :root { --vx:var(--gold); --vx-rgb:240,165,0; --vx-dim:var(--gdim); --vx-dim2:rgba(37,99,235,.06); }
        .vx-accent { color:var(--gold) !important; }
        .vx-badge { background:rgba(37,99,235,.12); color:var(--gold); border:1px solid rgba(37,99,235,.25); padding:3px 10px; border-radius:20px; font-size:10px; font-weight:700; }
        .btn-vx { background:linear-gradient(135deg,var(--gold),#c07000) !important; color:#F8FAFC !important; }`;
    }
  }

  function _buildNav(cfg) {
    const nav = document.getElementById('sideNav');
    if (!nav) return;
    let html = '';
    cfg.navGroups.forEach(group => {
      html += `<div class="nav-group-label">${group.label}</div>`;
      group.ids.forEach(id => {
        const base = NAV_ITEMS.find(n => n.id === id);
        if (!base) return;
        const lbl = (cfg.labels && cfg.labels[id]) || base.label;
        html += `<button class="nav-item" data-id="${id}" onclick="APP.navigate('${id}')">
          <span class="nav-icon">${base.icon}</span>
          <span class="nav-label">${lbl}</span>
          ${base.isnew ? '<span class="nav-new">NEW</span>' : ''}
        </button>`;
      });
    });
    nav.innerHTML = html;
  }

  function _buildBottomNav(cfg) {
    const bn = document.getElementById('bottomNav');
    if (!bn) return;
    let html = '<div class="bn-row">';
    cfg.bottomNav.forEach(item => {
      if (item.isMenu) {
        html += `<button class="bn-btn" id="bn-menu" onclick="APP.toggleSidebar()">
          <span class="bn-ico">${item.icon}</span><span>${item.label}</span></button>`;
      } else {
        html += `<button class="bn-btn" id="bn-${item.id}" onclick="APP.navigate('${item.id}');setBN('${item.id}')">
          <span class="bn-ico">${item.icon}</span><span>${item.label}</span></button>`;
      }
    });
    html += '</div>';
    bn.innerHTML = html;
  }

  // ── Vertical banner shown at top of each dashboard ─────────────
  function bannerHTML() {
    const c = current();
    return `<div style="background:linear-gradient(135deg,rgba(${c.accentRgb},.08),rgba(${c.accentRgb},.03));border:1px solid rgba(${c.accentRgb},.18);border-radius:12px;padding:12px 18px;margin-bottom:20px;display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="font-size:28px">${c.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--vx,var(--gold))">${c.label}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.tagline}</div>
      </div>
      <span class="vx-badge">${c.id.toUpperCase()} MODE</span>
    </div>`;
  }

  // ── Quick actions grid ─────────────────────────────────────────
  function quickActionsHTML() {
    const c = current();
    let h = `<div class="card" style="margin-bottom:18px"><div class="card-title">⚡ Quick Actions</div><div class="qa-grid">`;
    c.quickActions.forEach(a => {
      h += `<button class="qa-btn" onclick="APP.navigate('${a.section}')">
        <div style="font-size:20px;margin-bottom:5px">${a.icon}</div>
        <div>${a.label}</div></button>`;
    });
    h += `</div></div>`;
    return h;
  }

  return { get, apply, current, label, kpiLabel, bannerHTML, quickActionsHTML };

})();

/* ── Shared helpers for all v_*.js vertical dashboards ── */
function _fmt(n, sym) {
  sym = sym || (STRATIX_DB && STRATIX_DB.getSettings().currencySymbol) || '₹';
  n = Math.abs(Number(n) || 0);
  if (n >= 1e7) return sym + (n/1e7).toFixed(1) + 'Cr';
  if (n >= 1e5) return sym + (n/1e5).toFixed(1) + 'L';
  if (n >= 1e3) return sym + (n/1e3).toFixed(1) + 'K';
  return sym + Math.round(n).toLocaleString('en-IN');
}
function _greet() {
  const h = new Date().getHours();
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}
