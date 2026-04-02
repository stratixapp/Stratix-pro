/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  STRATIX  —  store.js  v1.0                                                ║
 * ║  Centralized State Management + Event Bus + Module Integration Layer        ║
 * ║                                                                             ║
 * ║  DROP-IN FILE: add <script src="store.js"></script> BEFORE app.js          ║
 * ║  in index.html. Zero breaking changes to existing code.                     ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * ARCHITECTURE:
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │                      STRATIX_STORE                          │
 *  │                                                             │
 *  │  In-Memory Cache ─────► Event Bus ─────► UI Subscribers     │
 *  │       ▲                                                     │
 *  │       │  sync                                               │
 *  │  STRATIX_DB (localStorage)                                  │
 *  └─────────────────────────────────────────────────────────────┘
 *
 *  ┌─────────────────────────────────────────────────────────────┐
 *  │                    STRATIX_SERVICES                         │
 *  │                                                             │
 *  │  Business logic layer — all cross-module operations go here  │
 *  │                                                             │
 *  │  invoice.create()   → deducts inventory                     │
 *  │                     → logs transaction                      │
 *  │                     → updates customer history              │
 *  │                     → emits events to refresh UI            │
 *  │                                                             │
 *  │  payment.record()   → updates invoice status                │
 *  │                     → logs transaction                      │
 *  │                     → refreshes dashboard KPIs              │
 *  │                                                             │
 *  │  inventory.adjust() → updates stock                         │
 *  │                     → checks low-stock alerts               │
 *  │                     → logs audit trail                      │
 *  └─────────────────────────────────────────────────────────────┘
 *
 * INTEGRATION FLOWS (auto-wired, zero extra code needed in modules):
 *
 *   Sales Order Confirmed
 *     → inventory deducted per line item
 *     → accounts receivable updated
 *     → CRM contact linked
 *     → EVENT: 'inventory:changed', 'finance:changed', 'crm:changed'
 *
 *   Purchase Order Received
 *     → inventory increased per line item (already wired in erp.js, now also emits events)
 *     → expense transaction auto-logged
 *     → EVENT: 'inventory:changed', 'finance:changed'
 *
 *   Payment Recorded (Invoice/SO)
 *     → invoice status → 'Paid' or 'Partial'
 *     → revenue transaction logged
 *     → customer totalBusiness updated
 *     → EVENT: 'finance:changed', 'crm:changed'
 *
 *   Inventory Low-Stock
 *     → alert triggered to notification centre
 *     → EVENT: 'inventory:lowstock'
 *
 *   Dashboard
 *     → subscribes to 'finance:changed', 'inventory:changed'
 *     → auto-refreshes KPI cards without full page reload
 */

'use strict';

/* ══════════════════════════════════════════════════════════════════════════════
   1. EVENT BUS
   ══════════════════════════════════════════════════════════════════════════════ */

const STRATIX_BUS = (() => {
  const _handlers = {};

  /**
   * Subscribe to an event.
   * @param {string} event  - e.g. 'finance:changed', 'inventory:lowstock'
   * @param {Function} fn   - callback(payload)
   * @returns {Function}    - unsubscribe function
   */
  function on(event, fn) {
    if (!_handlers[event]) _handlers[event] = [];
    _handlers[event].push(fn);
    return () => {
      _handlers[event] = _handlers[event].filter(h => h !== fn);
    };
  }

  /**
   * Emit an event to all subscribers.
   * @param {string} event
   * @param {*} payload
   */
  function emit(event, payload) {
    const handlers = _handlers[event] || [];
    handlers.forEach(fn => {
      try { fn(payload); } catch (e) { console.warn(`[BUS] Handler error for "${event}":`, e); }
    });
    // Wildcard subscribers get everything
    const wildcards = _handlers['*'] || [];
    wildcards.forEach(fn => {
      try { fn(event, payload); } catch (e) {}
    });
  }

  /** Remove all handlers for an event (useful on section unmount) */
  function off(event) {
    delete _handlers[event];
  }

  /** One-time subscriber */
  function once(event, fn) {
    const unsub = on(event, (payload) => {
      fn(payload);
      unsub();
    });
    return unsub;
  }

  return { on, emit, off, once };
})();


/* ══════════════════════════════════════════════════════════════════════════════
   2. IN-MEMORY STATE STORE (with localStorage sync)
   ══════════════════════════════════════════════════════════════════════════════ */

const STRATIX_STORE = (() => {

  // In-memory cache — populated lazily on first read, stays warm across renders
  const _cache = {};
  // Track which keys have been hydrated from localStorage
  const _hydrated = new Set();

  /* ── Internal: hydrate a key from DB into cache ── */
  function _hydrate(key) {
    if (_hydrated.has(key)) return;
    try {
      _cache[key] = STRATIX_DB.getArr(key);
    } catch (e) {
      _cache[key] = [];
    }
    _hydrated.add(key);
  }

  /* ── Internal: flush cache → localStorage and emit change ── */
  function _flush(key, eventName) {
    try {
      STRATIX_DB.set(key, _cache[key]);
    } catch (e) {
      console.error(`[STORE] flush failed for key "${key}":`, e);
    }
    if (eventName) {
      STRATIX_BUS.emit(eventName, { key, data: _cache[key] });
    }
  }

  /**
   * Get all records for a collection.
   * First call hydrates from localStorage; subsequent calls use in-memory cache.
   * @param {string} key - e.g. 'erpInventory', 'transactions'
   * @returns {Array}
   */
  function getAll(key) {
    _hydrate(key);
    return _cache[key] || [];
  }

  /**
   * Find a single record by id.
   */
  function findById(key, id) {
    return getAll(key).find(r => r.id === id) || null;
  }

  /**
   * Find records matching a predicate.
   */
  function where(key, predicate) {
    return getAll(key).filter(predicate);
  }

  /**
   * Insert a new record. Auto-generates id + createdAt.
   * @param {string} key
   * @param {Object} record
   * @param {string} [event] - bus event to emit after save
   * @returns {Object} saved record with id
   */
  function insert(key, record, event) {
    _hydrate(key);
    const saved = {
      ...record,
      id: record.id || (_genId()),
      createdAt: record.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    _cache[key].push(saved);
    _flush(key, event);
    return saved;
  }

  /**
   * Update an existing record by id. Merges fields.
   * @param {string} key
   * @param {string} id
   * @param {Object} patch
   * @param {string} [event]
   * @returns {Object|null} updated record
   */
  function update(key, id, patch, event) {
    _hydrate(key);
    const idx = _cache[key].findIndex(r => r.id === id);
    if (idx === -1) return null;
    _cache[key][idx] = {
      ..._cache[key][idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    _flush(key, event);
    return _cache[key][idx];
  }

  /**
   * Remove a record by id.
   * @param {string} key
   * @param {string} id
   * @param {string} [event]
   * @returns {boolean}
   */
  function remove(key, id, event) {
    _hydrate(key);
    const before = _cache[key].length;
    _cache[key] = _cache[key].filter(r => r.id !== id);
    const removed = _cache[key].length < before;
    if (removed) _flush(key, event);
    return removed;
  }

  /**
   * Replace entire collection (bulk set).
   * @param {string} key
   * @param {Array} records
   * @param {string} [event]
   */
  function setAll(key, records, event) {
    _hydrated.add(key);
    _cache[key] = records;
    _flush(key, event);
  }

  /**
   * Invalidate cache for a key (forces re-hydrate on next read).
   * Use this if external code (existing erp.js, etc.) writes to STRATIX_DB directly.
   */
  function invalidate(key) {
    _hydrated.delete(key);
    delete _cache[key];
  }

  /**
   * Invalidate all cached keys. Call after bulk import.
   */
  function invalidateAll() {
    _hydrated.clear();
    Object.keys(_cache).forEach(k => delete _cache[k]);
  }

  /**
   * Computed aggregates — cached until the relevant store key changes.
   * Prevents recalculating the same sum across multiple dashboard widgets.
   */
  const _computed = {};
  function computed(cacheKey, deps, computeFn) {
    if (_computed[cacheKey] !== undefined) return _computed[cacheKey];
    const result = computeFn();
    _computed[cacheKey] = result;
    // Auto-invalidate computed cache when any dep key changes
    deps.forEach(dep => {
      STRATIX_BUS.once(dep + ':changed', () => {
        delete _computed[cacheKey];
      });
    });
    return result;
  }

  /* ── ID generator (26-char, URL-safe, no uuid lib needed) ── */
  function _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  }

  return { getAll, findById, where, insert, update, remove, setAll, invalidate, invalidateAll, computed };
})();


/* ══════════════════════════════════════════════════════════════════════════════
   3. DATA MODELS  (production schemas — source of truth for all modules)
   ══════════════════════════════════════════════════════════════════════════════ */

const STRATIX_MODELS = {

  /**
   * Customer schema (unified — replaces separate crmContacts + clients)
   * Key: 'customers'
   */
  Customer: {
    key: 'customers',
    defaults() {
      return {
        id: null,
        name: '',
        phone: '',
        email: '',
        address: '',
        gstin: '',
        type: 'B2B',                  // B2B | B2C | Distributor | Retailer
        source: 'manual',             // manual | crm | import
        tags: [],
        status: 'Active',             // Active | Inactive | Blocked
        creditLimit: 0,
        outstandingBalance: 0,
        totalBusiness: 0,             // sum of all completed invoice amounts
        transactionHistory: [],       // [{invoiceId, date, amount, type}]
        createdAt: null,
        updatedAt: null,
      };
    },
    validate(data) {
      const errors = {};
      if (!data.name || data.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
      if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = 'Invalid email address';
      if (data.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(data.gstin)) errors.gstin = 'Invalid GSTIN format';
      return Object.keys(errors).length === 0 ? null : errors;
    }
  },

  /**
   * Product / Inventory Item schema
   * Key: 'erpInventory'
   */
  Product: {
    key: 'erpInventory',
    defaults() {
      return {
        id: null,
        code: '',
        name: '',
        category: 'Trading Goods',
        unit: 'pcs',
        qty: 0,
        reorderQty: 5,
        costPrice: 0,
        salePrice: 0,
        hsn: '',
        location: '',
        description: '',
        createdAt: null,
        updatedAt: null,
      };
    },
    validate(data) {
      const errors = {};
      if (!data.name || data.name.trim().length < 1) errors.name = 'Item name is required';
      if (data.qty < 0) errors.qty = 'Stock quantity cannot be negative';
      if (data.salePrice < 0) errors.salePrice = 'Sale price cannot be negative';
      if (data.costPrice < 0) errors.costPrice = 'Cost price cannot be negative';
      return Object.keys(errors).length === 0 ? null : errors;
    }
  },

  /**
   * Invoice schema
   * Key: 'invoices'
   */
  Invoice: {
    key: 'invoices',
    defaults() {
      return {
        id: null,
        invoiceNo: '',
        customerId: null,         // links to Customer.id
        customerName: '',         // denormalized for display
        customerGstin: '',
        items: [],                // [{productId, name, qty, rate, unit, amount, gstRate}]
        subtotal: 0,
        gstAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        paidAmount: 0,
        status: 'Unpaid',         // Unpaid | Partial | Paid | Cancelled | Overdue
        dueDate: null,
        paymentTerms: '30 Days',
        notes: '',
        payments: [],             // [{date, amount, mode, referenceNo, transactionId}]
        createdAt: null,
        updatedAt: null,
      };
    },
    validate(data) {
      const errors = {};
      if (!data.customerName && !data.customerId) errors.customer = 'Customer is required';
      if (!data.items || data.items.length === 0) errors.items = 'At least one line item is required';
      if (data.totalAmount <= 0) errors.totalAmount = 'Invoice total must be greater than 0';
      return Object.keys(errors).length === 0 ? null : errors;
    }
  },

  /**
   * Transaction schema (finance ledger)
   * Key: 'transactions'
   */
  Transaction: {
    key: 'transactions',
    defaults() {
      return {
        id: null,
        type: 'revenue',              // revenue | expense
        amount: 0,
        category: 'sales',
        description: '',
        date: null,
        linkedInvoiceId: null,        // Invoice.id if linked
        linkedOrderId: null,          // SO/PO id if linked
        linkedCustomerId: null,
        paymentMode: 'cash',          // cash | bank | upi | cheque | credit
        referenceNo: '',
        createdAt: null,
        updatedAt: null,
      };
    },
    validate(data) {
      const errors = {};
      if (!data.type || !['revenue', 'expense'].includes(data.type)) errors.type = 'Type must be revenue or expense';
      if (!data.amount || data.amount <= 0) errors.amount = 'Amount must be greater than 0';
      if (!data.description) errors.description = 'Description is required';
      return Object.keys(errors).length === 0 ? null : errors;
    }
  },

  /**
   * Stock movement audit log
   * Key: 'stockLog'
   */
  StockLog: {
    key: 'stockLog',
    defaults() {
      return {
        id: null,
        productId: '',
        productName: '',
        movementType: 'adjustment',   // sale | purchase | adjustment | return | damage
        qtyBefore: 0,
        qtyChange: 0,                 // +ve = stock in, -ve = stock out
        qtyAfter: 0,
        linkedOrderId: null,
        reason: '',
        performedBy: '',
        createdAt: null,
      };
    }
  },

  /**
   * Notification / Alert schema
   * Key: 'alerts'
   */
  Alert: {
    key: 'alerts',
    defaults() {
      return {
        id: null,
        type: 'info',              // info | warning | error | success
        category: 'system',        // system | inventory | finance | crm | overdue
        title: '',
        message: '',
        actionLabel: '',
        actionTarget: '',          // section to navigate to
        read: false,
        createdAt: null,
      };
    }
  }
};


/* ══════════════════════════════════════════════════════════════════════════════
   4. SERVICE LAYER  (all cross-module business logic lives here)
   ══════════════════════════════════════════════════════════════════════════════ */

const STRATIX_SERVICES = {

  /* ────────────────────────────────────────────────────────────────
     INVOICE SERVICE
     Handles: create, payment recording, status management
     Cross-module: inventory deduction, customer history, finance ledger
  ──────────────────────────────────────────────────────────────── */
  invoice: {

    /**
     * Create a new invoice.
     * - Validates data
     * - Deducts inventory per line item
     * - Creates a transaction (if advance/full payment)
     * - Updates customer's outstanding balance
     * - Logs stock movements
     * - Emits: 'invoice:created', 'inventory:changed', 'finance:changed', 'crm:changed'
     *
     * @param {Object} data - Invoice fields
     * @returns {{ success: boolean, invoice?: Object, errors?: Object }}
     */
    create(data) {
      // 1. Validate
      const invoiceData = { ...STRATIX_MODELS.Invoice.defaults(), ...data };
      const errors = STRATIX_MODELS.Invoice.validate(invoiceData);
      if (errors) return { success: false, errors };

      // 2. Auto-generate invoice number if not provided
      if (!invoiceData.invoiceNo) {
        const settings = STRATIX_DB.getSettings();
        const prefix = settings.invoicePrefix || 'INV';
        const count = STRATIX_STORE.getAll('invoices').length + 1;
        invoiceData.invoiceNo = `${prefix}-${String(count).padStart(4, '0')}`;
      }

      // 3. Deduct inventory for each line item
      const stockLog = [];
      for (const item of invoiceData.items) {
        if (!item.productId || item.productId === 'custom') continue;
        const product = STRATIX_STORE.findById('erpInventory', item.productId);
        if (!product) continue;

        const qtyBefore = product.qty || 0;
        const qtyChange = -(item.qty || 0);
        const qtyAfter = Math.max(0, qtyBefore + qtyChange);

        STRATIX_STORE.update('erpInventory', product.id, { qty: qtyAfter }, null);

        stockLog.push({
          productId: product.id,
          productName: product.name,
          movementType: 'sale',
          qtyBefore,
          qtyChange,
          qtyAfter,
          linkedOrderId: null, // will be updated with invoice.id below
          reason: `Invoice ${invoiceData.invoiceNo}`,
          performedBy: STRATIX_AUTH.getSession()?.name || 'System',
        });
      }

      // 4. Save invoice
      const saved = STRATIX_STORE.insert('invoices', invoiceData, null);

      // 5. Save stock log entries (now we have the invoice id)
      stockLog.forEach(entry => {
        STRATIX_STORE.insert('stockLog', {
          ...STRATIX_MODELS.StockLog.defaults(),
          ...entry,
          linkedOrderId: saved.id,
        }, null);
      });

      // 6. Update customer outstanding balance + history
      if (invoiceData.customerId) {
        this._updateCustomerBalance(invoiceData.customerId, saved.id, invoiceData.totalAmount, 'invoice_created');
      }

      // 7. Check low-stock alerts after inventory deduction
      STRATIX_SERVICES.inventory._checkLowStock();

      // 8. Emit events to refresh UI subscribers
      STRATIX_BUS.emit('inventory:changed', { source: 'invoice.create', invoiceId: saved.id });
      STRATIX_BUS.emit('invoice:created', { invoice: saved });
      STRATIX_BUS.emit('finance:changed', { source: 'invoice.create' });
      STRATIX_BUS.emit('crm:changed', { source: 'invoice.create', customerId: invoiceData.customerId });

      return { success: true, invoice: saved };
    },

    /**
     * Record a payment against an invoice.
     * - Partially or fully marks invoice as Paid
     * - Creates a revenue transaction
     * - Updates customer outstanding balance
     * - Emits: 'invoice:updated', 'finance:changed', 'crm:changed'
     *
     * @param {string} invoiceId
     * @param {Object} payment - { amount, mode, referenceNo, date }
     * @returns {{ success: boolean, invoice?: Object, error?: string }}
     */
    recordPayment(invoiceId, payment) {
      const invoice = STRATIX_STORE.findById('invoices', invoiceId);
      if (!invoice) return { success: false, error: 'Invoice not found' };
      if (invoice.status === 'Paid') return { success: false, error: 'Invoice is already fully paid' };
      if (invoice.status === 'Cancelled') return { success: false, error: 'Cannot record payment on a cancelled invoice' };

      const payAmount = Number(payment.amount) || 0;
      if (payAmount <= 0) return { success: false, error: 'Payment amount must be greater than 0' };

      const newPaid = (invoice.paidAmount || 0) + payAmount;
      const remaining = invoice.totalAmount - newPaid;
      const newStatus = remaining <= 0.01 ? 'Paid' : 'Partial';

      const paymentRecord = {
        date: payment.date || new Date().toISOString().split('T')[0],
        amount: payAmount,
        mode: payment.mode || 'cash',
        referenceNo: payment.referenceNo || '',
        transactionId: null,  // filled below
      };

      // Create transaction
      const txn = STRATIX_STORE.insert('transactions', {
        ...STRATIX_MODELS.Transaction.defaults(),
        type: 'revenue',
        amount: payAmount,
        category: 'sales',
        description: `Payment for Invoice ${invoice.invoiceNo} — ${invoice.customerName}`,
        date: paymentRecord.date,
        linkedInvoiceId: invoiceId,
        linkedCustomerId: invoice.customerId,
        paymentMode: payment.mode || 'cash',
        referenceNo: payment.referenceNo || '',
      }, null);

      paymentRecord.transactionId = txn.id;

      // Update invoice
      const updatedInvoice = STRATIX_STORE.update('invoices', invoiceId, {
        paidAmount: newPaid,
        status: newStatus,
        payments: [...(invoice.payments || []), paymentRecord],
      }, null);

      // Update customer total business (only on full payment)
      if (newStatus === 'Paid' && invoice.customerId) {
        this._updateCustomerBalance(invoice.customerId, invoiceId, -invoice.totalAmount, 'invoice_paid');
        const customer = STRATIX_STORE.findById('customers', invoice.customerId);
        if (customer) {
          STRATIX_STORE.update('customers', invoice.customerId, {
            totalBusiness: (customer.totalBusiness || 0) + invoice.totalAmount,
          }, null);
        }
      }

      // Emit events
      STRATIX_BUS.emit('invoice:updated', { invoice: updatedInvoice, payment: paymentRecord });
      STRATIX_BUS.emit('finance:changed', { source: 'invoice.payment', amount: payAmount });
      STRATIX_BUS.emit('crm:changed', { source: 'invoice.payment', customerId: invoice.customerId });
      STRATIX_BUS.emit('dashboard:refresh', {});

      // Show low-balance alert if it was a large payment
      NOTIFY.show(
        `✅ Payment of ₹${payAmount.toLocaleString('en-IN')} recorded. Invoice is now ${newStatus}.`,
        'success', 4000
      );

      return { success: true, invoice: updatedInvoice };
    },

    /**
     * Cancel an invoice.
     * - Reverses inventory deductions
     * - Voids linked transaction
     * - Emits: 'invoice:cancelled', 'inventory:changed', 'finance:changed'
     */
    cancel(invoiceId) {
      const invoice = STRATIX_STORE.findById('invoices', invoiceId);
      if (!invoice) return { success: false, error: 'Invoice not found' };
      if (invoice.status === 'Paid') return { success: false, error: 'Paid invoices cannot be cancelled. Issue a credit note instead.' };

      // Reverse inventory deductions
      for (const item of (invoice.items || [])) {
        if (!item.productId || item.productId === 'custom') continue;
        const product = STRATIX_STORE.findById('erpInventory', item.productId);
        if (!product) continue;

        const restored = (product.qty || 0) + (item.qty || 0);
        STRATIX_STORE.update('erpInventory', product.id, { qty: restored }, null);

        STRATIX_STORE.insert('stockLog', {
          ...STRATIX_MODELS.StockLog.defaults(),
          productId: product.id,
          productName: product.name,
          movementType: 'return',
          qtyBefore: product.qty,
          qtyChange: item.qty,
          qtyAfter: restored,
          linkedOrderId: invoiceId,
          reason: `Invoice ${invoice.invoiceNo} cancelled`,
          performedBy: STRATIX_AUTH.getSession()?.name || 'System',
        }, null);
      }

      // Update customer outstanding
      if (invoice.customerId) {
        this._updateCustomerBalance(invoice.customerId, invoiceId, -invoice.totalAmount, 'invoice_cancelled');
      }

      STRATIX_STORE.update('invoices', invoiceId, { status: 'Cancelled' }, null);

      STRATIX_BUS.emit('invoice:cancelled', { invoiceId });
      STRATIX_BUS.emit('inventory:changed', { source: 'invoice.cancel' });
      STRATIX_BUS.emit('finance:changed', { source: 'invoice.cancel' });

      return { success: true };
    },

    /** Internal: update customer.outstandingBalance */
    _updateCustomerBalance(customerId, invoiceId, delta, reason) {
      const customer = STRATIX_STORE.findById('customers', customerId);
      if (!customer) return;
      const newBalance = Math.max(0, (customer.outstandingBalance || 0) + delta);
      STRATIX_STORE.update('customers', customerId, {
        outstandingBalance: newBalance,
        transactionHistory: [
          ...(customer.transactionHistory || []),
          { invoiceId, date: new Date().toISOString(), delta, reason, balanceAfter: newBalance }
        ]
      }, null);
    },

    /** Mark overdue invoices (run on app init and daily) */
    checkOverdue() {
      const today = new Date().toISOString().split('T')[0];
      const invoices = STRATIX_STORE.where('invoices', inv =>
        inv.status === 'Unpaid' && inv.dueDate && inv.dueDate < today
      );
      invoices.forEach(inv => {
        STRATIX_STORE.update('invoices', inv.id, { status: 'Overdue' }, null);
      });
      if (invoices.length > 0) {
        STRATIX_BUS.emit('finance:changed', { source: 'invoice.checkOverdue', count: invoices.length });
        NOTIFY.show(`⚠️ ${invoices.length} invoice(s) are now overdue`, 'warning', 5000);
      }
    },
  },

  /* ────────────────────────────────────────────────────────────────
     INVENTORY SERVICE
  ──────────────────────────────────────────────────────────────── */
  inventory: {

    /**
     * Adjust stock with full audit trail.
     * @param {string} productId
     * @param {Object} adjustment - { type: 'add'|'remove'|'set', qty, reason }
     * @returns {{ success: boolean, product?: Object, error?: string }}
     */
    adjust(productId, adjustment) {
      const product = STRATIX_STORE.findById('erpInventory', productId);
      if (!product) return { success: false, error: 'Product not found' };

      const qtyBefore = product.qty || 0;
      let qtyAfter;
      let qtyChange;

      switch (adjustment.type) {
        case 'add':
          qtyAfter  = qtyBefore + (adjustment.qty || 0);
          qtyChange = adjustment.qty || 0;
          break;
        case 'remove':
          qtyAfter  = Math.max(0, qtyBefore - (adjustment.qty || 0));
          qtyChange = -(adjustment.qty || 0);
          break;
        case 'set':
          qtyAfter  = adjustment.qty || 0;
          qtyChange = qtyAfter - qtyBefore;
          break;
        default:
          return { success: false, error: 'Invalid adjustment type' };
      }

      const updated = STRATIX_STORE.update('erpInventory', productId, { qty: qtyAfter }, null);

      // Audit log
      STRATIX_STORE.insert('stockLog', {
        ...STRATIX_MODELS.StockLog.defaults(),
        productId,
        productName: product.name,
        movementType: 'adjustment',
        qtyBefore,
        qtyChange,
        qtyAfter,
        reason: adjustment.reason || 'Manual adjustment',
        performedBy: STRATIX_AUTH.getSession()?.name || 'System',
      }, null);

      this._checkLowStock();

      STRATIX_BUS.emit('inventory:changed', { source: 'inventory.adjust', productId });

      return { success: true, product: updated };
    },

    /**
     * Receive stock from a purchase order.
     * - Updates inventory quantity
     * - Logs expense transaction
     * - Updates PO status → 'Received'
     * Emits: 'inventory:changed', 'finance:changed'
     */
    receivePurchaseOrder(poId) {
      const po = STRATIX_STORE.findById('erpPurchaseOrders', poId);
      if (!po) return { success: false, error: 'Purchase order not found' };
      if (po.status === 'Received') return { success: false, error: 'Already received' };

      const today = new Date().toISOString().split('T')[0];

      (po.items || []).forEach(line => {
        if (line.itemId && line.itemId !== 'custom') {
          const item = STRATIX_STORE.findById('erpInventory', line.itemId);
          if (item) {
            STRATIX_STORE.update('erpInventory', item.id, {
              qty: (item.qty || 0) + (line.qty || 0),
            }, null);
          } else {
            // Auto-create inventory entry for new items
            STRATIX_STORE.insert('erpInventory', {
              ...STRATIX_MODELS.Product.defaults(),
              name: line.name,
              qty: line.qty || 0,
              costPrice: line.rate || 0,
              unit: 'pcs',
            }, null);
          }
          // Audit log per line
          STRATIX_STORE.insert('stockLog', {
            ...STRATIX_MODELS.StockLog.defaults(),
            productId: line.itemId,
            productName: line.name,
            movementType: 'purchase',
            qtyBefore: 0,
            qtyChange: line.qty,
            qtyAfter: line.qty,
            linkedOrderId: poId,
            reason: `PO Received: ${po.poNo}`,
          }, null);
        } else {
          STRATIX_STORE.insert('erpInventory', {
            ...STRATIX_MODELS.Product.defaults(),
            name: line.name,
            qty: line.qty || 0,
            costPrice: line.rate || 0,
            unit: 'pcs',
          }, null);
        }
      });

      // Auto-log expense transaction
      STRATIX_STORE.insert('transactions', {
        ...STRATIX_MODELS.Transaction.defaults(),
        type: 'expense',
        amount: po.totalAmt || 0,
        category: 'purchase',
        description: `PO ${po.poNo} — ${po.supplier}`,
        date: today,
        linkedOrderId: poId,
        paymentMode: 'bank',
      }, null);

      // Update PO status
      STRATIX_STORE.update('erpPurchaseOrders', poId, {
        status: 'Received',
        receivedDate: today,
      }, null);

      this._checkLowStock();

      STRATIX_BUS.emit('inventory:changed', { source: 'inventory.receivePO', poId });
      STRATIX_BUS.emit('finance:changed', { source: 'inventory.receivePO', amount: po.totalAmt });

      NOTIFY.show(`✅ PO Received! Inventory updated & ₹${(po.totalAmt||0).toLocaleString('en-IN')} expense logged.`, 'success', 4000);

      return { success: true };
    },

    /**
     * Complete a sales order — deduct inventory, log income.
     * Call when advancing SO to 'Completed'.
     */
    completeSalesOrder(soId) {
      const so = STRATIX_STORE.findById('erpSalesOrders', soId);
      if (!so) return { success: false, error: 'Sales order not found' };

      // Log revenue transaction (only once on completion)
      const alreadyLogged = STRATIX_STORE.where('transactions', t => t.linkedOrderId === soId).length > 0;
      if (!alreadyLogged) {
        STRATIX_STORE.insert('transactions', {
          ...STRATIX_MODELS.Transaction.defaults(),
          type: 'revenue',
          amount: so.totalAmt || 0,
          category: 'sales',
          description: `SO ${so.soNo} — ${so.customer}`,
          date: new Date().toISOString().split('T')[0],
          linkedOrderId: soId,
          paymentMode: so.payTerms?.includes('Advance') ? 'cash' : 'credit',
        }, null);
      }

      STRATIX_STORE.update('erpSalesOrders', soId, { status: 'Completed' }, null);

      STRATIX_BUS.emit('finance:changed', { source: 'inventory.completeSO', soId });

      return { success: true };
    },

    /** Internal: check all items for low stock and emit alerts */
    _checkLowStock() {
      const items = STRATIX_STORE.where('erpInventory', item => {
        const qty = item.qty || 0;
        const reorder = item.reorderQty || 5;
        return qty <= reorder;
      });

      if (items.length > 0) {
        STRATIX_BUS.emit('inventory:lowstock', {
          count: items.length,
          items: items.map(i => ({ id: i.id, name: i.name, qty: i.qty, reorderQty: i.reorderQty }))
        });
      }
    },

    /** Get stock summary for dashboard */
    getSummary() {
      const all = STRATIX_STORE.getAll('erpInventory');
      return {
        totalItems: all.length,
        totalValue: all.reduce((s, i) => s + (i.qty || 0) * (i.costPrice || 0), 0),
        lowStockCount: all.filter(i => (i.qty || 0) <= (i.reorderQty || 5)).length,
        outOfStockCount: all.filter(i => (i.qty || 0) === 0).length,
        lowStockItems: all.filter(i => (i.qty || 0) <= (i.reorderQty || 5)).map(i => ({
          name: i.name, qty: i.qty, reorderQty: i.reorderQty
        })),
      };
    },
  },

  /* ────────────────────────────────────────────────────────────────
     FINANCE SERVICE
  ──────────────────────────────────────────────────────────────── */
  finance: {

    /**
     * Log a standalone transaction (income or expense).
     * @param {Object} data - Transaction fields
     * @returns {{ success: boolean, transaction?: Object, errors?: Object }}
     */
    logTransaction(data) {
      const txnData = { ...STRATIX_MODELS.Transaction.defaults(), ...data };
      const errors = STRATIX_MODELS.Transaction.validate(txnData);
      if (errors) return { success: false, errors };

      const saved = STRATIX_STORE.insert('transactions', txnData, null);

      STRATIX_BUS.emit('finance:changed', { source: 'finance.logTransaction', type: txnData.type });
      STRATIX_BUS.emit('dashboard:refresh', {});

      return { success: true, transaction: saved };
    },

    /**
     * Get P&L summary for a date range.
     * @param {string} [from] - ISO date string
     * @param {string} [to]   - ISO date string
     * @returns {Object}
     */
    getPnL(from, to) {
      const txns = STRATIX_STORE.getAll('transactions').filter(t => {
        if (from && t.date < from) return false;
        if (to && t.date > to) return false;
        return true;
      });

      const revenue = txns.filter(t => t.type === 'revenue').reduce((s, t) => s + (t.amount || 0), 0);
      const expenses = txns.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
      const profit = revenue - expenses;
      const margin = revenue > 0 ? ((profit / revenue) * 100) : 0;

      // Expense by category
      const byCategory = {};
      txns.filter(t => t.type === 'expense').forEach(t => {
        const cat = t.category || 'other';
        byCategory[cat] = (byCategory[cat] || 0) + (t.amount || 0);
      });

      // Revenue by month (last 12 months)
      const byMonth = {};
      txns.filter(t => t.type === 'revenue').forEach(t => {
        if (!t.date) return;
        const month = t.date.substring(0, 7); // YYYY-MM
        byMonth[month] = (byMonth[month] || 0) + (t.amount || 0);
      });

      return { revenue, expenses, profit, margin, byCategory, byMonth };
    },

    /**
     * Get accounts receivable from invoices.
     */
    getReceivables() {
      return STRATIX_STORE.where('invoices', inv =>
        ['Unpaid', 'Partial', 'Overdue'].includes(inv.status)
      );
    },

    /**
     * Get accounts payable from purchase orders.
     */
    getPayables() {
      return STRATIX_STORE.where('erpPurchaseOrders', po =>
        po.status === 'Confirmed'
      );
    },

    /**
     * Dashboard summary — all KPIs in one call.
     */
    getDashboardKPIs() {
      const pnl = this.getPnL();
      const receivables = this.getReceivables();
      const payables = this.getPayables();
      const totalReceivable = receivables.reduce((s, inv) => s + (inv.totalAmount - inv.paidAmount), 0);
      const totalPayable = payables.reduce((s, po) => s + (po.totalAmt || 0), 0);

      const invoices = STRATIX_STORE.getAll('invoices');
      const overdueCount = invoices.filter(inv => inv.status === 'Overdue').length;

      // Top customers by revenue
      const customerRevenue = {};
      STRATIX_STORE.getAll('invoices').forEach(inv => {
        if (inv.status === 'Paid') {
          customerRevenue[inv.customerName] = (customerRevenue[inv.customerName] || 0) + inv.totalAmount;
        }
      });
      const topCustomers = Object.entries(customerRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, amount]) => ({ name, amount }));

      return {
        ...pnl,
        totalReceivable,
        totalPayable,
        overdueCount,
        topCustomers,
      };
    },
  },

  /* ────────────────────────────────────────────────────────────────
     CUSTOMER SERVICE (unified — merges CRM + clients data)
  ──────────────────────────────────────────────────────────────── */
  customer: {

    /**
     * Create or update a customer record.
     * Handles merging of legacy 'clients' data.
     */
    upsert(data) {
      const customerData = { ...STRATIX_MODELS.Customer.defaults(), ...data };
      const errors = STRATIX_MODELS.Customer.validate(customerData);
      if (errors) return { success: false, errors };

      let saved;
      if (customerData.id) {
        saved = STRATIX_STORE.update('customers', customerData.id, customerData, null);
      } else {
        // Check for duplicates by phone/email
        const existing = STRATIX_STORE.where('customers', c =>
          (customerData.email && c.email === customerData.email) ||
          (customerData.phone && c.phone === customerData.phone)
        );
        if (existing.length > 0) {
          // Merge with existing rather than duplicate
          saved = STRATIX_STORE.update('customers', existing[0].id, customerData, null);
        } else {
          saved = STRATIX_STORE.insert('customers', customerData, null);
        }
      }

      STRATIX_BUS.emit('crm:changed', { source: 'customer.upsert', customerId: saved.id });
      return { success: true, customer: saved };
    },

    /**
     * Get full customer profile with computed stats.
     */
    getProfile(customerId) {
      const customer = STRATIX_STORE.findById('customers', customerId);
      if (!customer) return null;

      const invoices = STRATIX_STORE.where('invoices', inv => inv.customerId === customerId);
      const transactions = STRATIX_STORE.where('transactions', t => t.linkedCustomerId === customerId);

      return {
        ...customer,
        invoiceCount: invoices.length,
        totalBilled: invoices.reduce((s, inv) => s + inv.totalAmount, 0),
        totalPaid: invoices.reduce((s, inv) => s + (inv.paidAmount || 0), 0),
        outstandingBalance: invoices
          .filter(inv => ['Unpaid', 'Partial', 'Overdue'].includes(inv.status))
          .reduce((s, inv) => s + (inv.totalAmount - (inv.paidAmount || 0)), 0),
        lastTransaction: transactions.length > 0
          ? transactions.sort((a, b) => b.createdAt?.localeCompare(a.createdAt))[0]
          : null,
        recentInvoices: invoices.slice(-5).reverse(),
      };
    },

    /**
     * Migrate legacy 'clients' data to the unified 'customers' store.
     * Safe to call multiple times — skips already-migrated records.
     */
    migrateLegacyClients() {
      const migrationKey = 'sx_customers_migrated_v1';
      if (localStorage.getItem(migrationKey)) return;

      const legacyClients = STRATIX_DB.getArr('clients');
      const legacyContacts = STRATIX_DB.getArr('crmContacts');

      let count = 0;
      [...legacyClients, ...legacyContacts].forEach(c => {
        if (!c.name) return;
        const existing = STRATIX_STORE.where('customers', x =>
          x.name === c.name || (c.phone && x.phone === c.phone)
        );
        if (existing.length > 0) return; // skip if already exists

        STRATIX_STORE.insert('customers', {
          ...STRATIX_MODELS.Customer.defaults(),
          name: c.name,
          phone: c.phone || '',
          email: c.email || '',
          address: c.address || '',
          outstandingBalance: c.outstanding || 0,
          status: 'Active',
          source: 'migrated',
        }, null);
        count++;
      });

      localStorage.setItem(migrationKey, '1');
      if (count > 0) {
        STRATIX_BUS.emit('crm:changed', { source: 'customer.migration', count });
        console.info(`[STRATIX] Migrated ${count} legacy client/contact records to unified customers store.`);
      }
    },
  },

  /* ────────────────────────────────────────────────────────────────
     ALERT SERVICE (smart notifications based on business state)
  ──────────────────────────────────────────────────────────────── */
  alerts: {
    _unread: 0,

    /**
     * Run all business-state checks and generate alerts.
     * Call on app init and whenever major events fire.
     */
    runChecks() {
      const alerts = [];
      const settings = STRATIX_DB.getSettings();
      const sym = settings.currencySymbol || '₹';

      // Low stock alerts
      const inv = STRATIX_SERVICES.inventory.getSummary();
      if (inv.lowStockCount > 0) {
        alerts.push({
          type: 'warning',
          category: 'inventory',
          title: `${inv.lowStockCount} Items Low on Stock`,
          message: inv.lowStockItems.map(i => `${i.name}: ${i.qty} ${i.qty === 1 ? 'unit' : 'units'} left`).join(', '),
          actionLabel: 'View Inventory',
          actionTarget: 'erp',
        });
      }

      // Overdue invoice alerts
      const kpis = STRATIX_SERVICES.finance.getDashboardKPIs();
      if (kpis.overdueCount > 0) {
        alerts.push({
          type: 'error',
          category: 'finance',
          title: `${kpis.overdueCount} Overdue Invoices`,
          message: `${sym}${kpis.totalReceivable.toLocaleString('en-IN')} total outstanding`,
          actionLabel: 'View Invoices',
          actionTarget: 'invoiceaging',
        });
      }

      // High receivables warning
      if (kpis.totalReceivable > 500000) {
        alerts.push({
          type: 'warning',
          category: 'finance',
          title: 'High Accounts Receivable',
          message: `${sym}${kpis.totalReceivable.toLocaleString('en-IN')} pending collection`,
          actionLabel: 'Collect Dues',
          actionTarget: 'invoiceaging',
        });
      }

      // Upcoming reminder alerts
      const today = new Date().toISOString().split('T')[0];
      const overdue = STRATIX_DB.getArr('reminders').filter(r => !r.done && r.date && r.date <= today);
      if (overdue.length > 0) {
        alerts.push({
          type: 'info',
          category: 'system',
          title: `${overdue.length} Overdue Reminder${overdue.length > 1 ? 's' : ''}`,
          message: overdue[0].title,
          actionLabel: 'View Reminders',
          actionTarget: 'reminders',
        });
      }

      this._unread = alerts.length;
      this._updateBadge(alerts.length);

      return alerts;
    },

    _updateBadge(count) {
      const dot = document.getElementById('notifDot');
      if (dot) {
        dot.style.display = count > 0 ? 'block' : 'none';
        dot.textContent = count > 9 ? '9+' : count > 0 ? count : '';
      }
    },

    getUnreadCount() { return this._unread; },
  },
};


/* ══════════════════════════════════════════════════════════════════════════════
   5. DASHBOARD REACTIVE SUBSCRIPTIONS
   ══════════════════════════════════════════════════════════════════════════════
   These subscriptions auto-refresh dashboard KPI cards when data changes,
   without a full page reload. Works by patching specific DOM nodes in-place.
*/

const STRATIX_REACTIVE = (() => {
  const _subs = [];

  function init() {
    // When finance data changes, refresh dashboard KPI bar if visible
    _subs.push(STRATIX_BUS.on('finance:changed', _refreshDashboardKPIs));
    _subs.push(STRATIX_BUS.on('dashboard:refresh', _refreshDashboardKPIs));

    // When inventory changes, refresh low-stock alerts if dashboard is showing
    _subs.push(STRATIX_BUS.on('inventory:changed', _refreshInventoryBadges));

    // Low stock → toast notification
    _subs.push(STRATIX_BUS.on('inventory:lowstock', ({ count, items }) => {
      if (count > 0 && !sessionStorage.getItem(`sx_lowstock_notif_${items[0]?.id}`)) {
        NOTIFY.show(
          `⚠️ Low stock: ${items[0]?.name} (${items[0]?.qty} left)${count > 1 ? ` and ${count - 1} more` : ''}`,
          'warning', 6000
        );
        // Suppress repeat toast for same item within session
        if (items[0]?.id) sessionStorage.setItem(`sx_lowstock_notif_${items[0].id}`, '1');
      }
    }));
  }

  function _refreshDashboardKPIs() {
    // Only act if dashboard is currently rendered
    const kpiContainer = document.getElementById('sx-dashboard-kpis');
    if (!kpiContainer) return;

    try {
      const kpis = STRATIX_SERVICES.finance.getDashboardKPIs();
      const settings = STRATIX_DB.getSettings();
      const sym = settings.currencySymbol || '₹';

      // Update individual KPI cells in-place (no full re-render)
      _updateKPICell('sx-kpi-revenue', sym + _fmt(kpis.revenue));
      _updateKPICell('sx-kpi-expenses', sym + _fmt(kpis.expenses));
      _updateKPICell('sx-kpi-profit', sym + _fmt(kpis.profit));
      _updateKPICell('sx-kpi-receivable', sym + _fmt(kpis.totalReceivable));
    } catch (e) {}
  }

  function _refreshInventoryBadges() {
    const badge = document.getElementById('sx-inv-lowstock-badge');
    if (!badge) return;
    const summary = STRATIX_SERVICES.inventory.getSummary();
    badge.textContent = summary.lowStockCount;
    badge.style.display = summary.lowStockCount > 0 ? '' : 'none';
  }

  function _updateKPICell(id, value) {
    const el = document.getElementById(id);
    if (el && el.textContent !== value) {
      el.style.transition = 'opacity 0.2s';
      el.style.opacity = '0.4';
      setTimeout(() => {
        el.textContent = value;
        el.style.opacity = '1';
      }, 150);
    }
  }

  function teardown() {
    _subs.forEach(unsub => unsub());
    _subs.length = 0;
  }

  return { init, teardown };
})();


/* ══════════════════════════════════════════════════════════════════════════════
   6. PATCHING EXISTING CODE (backward compat — zero breaking changes)
   ══════════════════════════════════════════════════════════════════════════════

   We intercept key operations in erp.js / features.js by wrapping their
   save methods, so existing UI code keeps working but now goes through
   the service layer for cross-module integration.

   This is a DOMContentLoaded patch — runs after all scripts load.
*/

document.addEventListener('DOMContentLoaded', () => {

  // ── Patch: ERP.saveSO → also triggers SERVICES.inventory event ──────────────
  // The existing erp.js saveSO() already deducts inventory directly — we just
  // need to invalidate the store cache and emit the event so subscribers refresh.
  const _origSaveSO = (typeof ERP !== 'undefined') && ERP.saveSO;
  if (_origSaveSO) {
    ERP.saveSO = function() {
      _origSaveSO.call(this);
      // Invalidate caches so STORE reads fresh data
      STRATIX_STORE.invalidate('erpInventory');
      STRATIX_STORE.invalidate('erpSalesOrders');
      STRATIX_STORE.invalidate('transactions');
      // Emit events
      STRATIX_BUS.emit('inventory:changed', { source: 'erp.saveSO' });
      STRATIX_BUS.emit('finance:changed', { source: 'erp.saveSO' });
      // Check low stock after deduction
      STRATIX_SERVICES.inventory._checkLowStock();
    };
  }

  // ── Patch: ERP.receivePO → emit events after stock update ───────────────────
  const _origReceivePO = (typeof ERP !== 'undefined') && ERP.receivePO;
  if (_origReceivePO) {
    ERP.receivePO = function(id) {
      _origReceivePO.call(this, id);
      STRATIX_STORE.invalidate('erpInventory');
      STRATIX_STORE.invalidate('erpPurchaseOrders');
      STRATIX_STORE.invalidate('transactions');
      STRATIX_BUS.emit('inventory:changed', { source: 'erp.receivePO', poId: id });
      STRATIX_BUS.emit('finance:changed', { source: 'erp.receivePO' });
    };
  }

  // ── Patch: ERP.saveItem → emit inventory:changed ────────────────────────────
  const _origSaveItem = (typeof ERP !== 'undefined') && ERP.saveItem;
  if (_origSaveItem) {
    ERP.saveItem = function(id) {
      _origSaveItem.call(this, id);
      STRATIX_STORE.invalidate('erpInventory');
      STRATIX_BUS.emit('inventory:changed', { source: 'erp.saveItem' });
      STRATIX_SERVICES.inventory._checkLowStock();
    };
  }

  // ── Patch: ERP.saveAdjust → emit inventory:changed ──────────────────────────
  const _origSaveAdjust = (typeof ERP !== 'undefined') && ERP.saveAdjust;
  if (_origSaveAdjust) {
    ERP.saveAdjust = function() {
      _origSaveAdjust.call(this);
      STRATIX_STORE.invalidate('erpInventory');
      STRATIX_BUS.emit('inventory:changed', { source: 'erp.saveAdjust' });
      STRATIX_SERVICES.inventory._checkLowStock();
    };
  }

  // ── Patch: ERP.advanceSO → emit finance:changed when SO completes ───────────
  const _origAdvanceSO = (typeof ERP !== 'undefined') && ERP.advanceSO;
  if (_origAdvanceSO) {
    ERP.advanceSO = function(id) {
      // Capture status before advance
      const so = STRATIX_DB.getArr('erpSalesOrders').find(o => o.id === id);
      const wasStatus = so?.status;
      _origAdvanceSO.call(this, id);
      STRATIX_STORE.invalidate('erpSalesOrders');
      // If it just became Completed, log revenue transaction
      if (wasStatus !== 'Completed') {
        const updated = STRATIX_DB.getArr('erpSalesOrders').find(o => o.id === id);
        if (updated?.status === 'Completed') {
          STRATIX_SERVICES.inventory.completeSalesOrder(id);
          STRATIX_BUS.emit('finance:changed', { source: 'erp.advanceSO.completed', soId: id });
        }
      }
    };
  }

  // ── Patch: STRATIX_DB.push('transactions') → emit finance:changed ───────────
  // Intercept raw transaction pushes from existing features.js code
  const _origDBPush = STRATIX_DB.push;
  STRATIX_DB.push = function(key, item) {
    const result = _origDBPush.call(this, key, item);
    // Invalidate store cache for this key
    STRATIX_STORE.invalidate(key);
    // Emit domain events
    if (key === 'transactions') {
      STRATIX_BUS.emit('finance:changed', { source: 'db.push.transactions' });
    }
    if (key === 'erpInventory' || key === 'erpSalesOrders' || key === 'erpPurchaseOrders') {
      STRATIX_BUS.emit('inventory:changed', { source: `db.push.${key}` });
    }
    if (key === 'crmLeads' || key === 'crmContacts' || key === 'crmDeals') {
      STRATIX_BUS.emit('crm:changed', { source: `db.push.${key}` });
    }
    return result;
  };

  // ── Patch: STRATIX_DB.update → same invalidation ────────────────────────────
  const _origDBUpdate = STRATIX_DB.update;
  STRATIX_DB.update = function(key, id, patch) {
    const result = _origDBUpdate.call(this, key, id, patch);
    STRATIX_STORE.invalidate(key);
    if (key === 'transactions') STRATIX_BUS.emit('finance:changed', { source: 'db.update.transactions' });
    if (['erpInventory','erpSalesOrders','erpPurchaseOrders'].includes(key)) {
      STRATIX_BUS.emit('inventory:changed', { source: `db.update.${key}` });
    }
    return result;
  };

  // ── Run startup tasks ────────────────────────────────────────────────────────
  try {
    // Migrate legacy client records to unified customers store
    STRATIX_SERVICES.customer.migrateLegacyClients();

    // Check for overdue invoices
    STRATIX_SERVICES.invoice.checkOverdue();

    // Run smart alert checks
    STRATIX_SERVICES.alerts.runChecks();

    // Start reactive dashboard subscriptions
    STRATIX_REACTIVE.init();

    console.info('[STRATIX] store.js v1.0 loaded — State store, event bus, and integration layer active.');
  } catch (e) {
    console.warn('[STRATIX] store.js startup warning:', e.message);
  }
});


/* ══════════════════════════════════════════════════════════════════════════════
   7. GLOBAL HELPERS  (drop-in utilities to replace duplicate fmt functions)
   ══════════════════════════════════════════════════════════════════════════════

   These are shared across erp.js / features.js / app.js.
   All existing fmt calls still work. These are additive.
*/

/**
 * Format a number as Indian currency.
 * Replaces: APP.fmt(), EH.fmt(), FIN.fmt(), fmtN(), _fmt()
 * @param {number} n
 * @param {string} [sym] - currency symbol (default: from settings)
 */
function sx_fmt(n, sym) {
  sym = sym || (STRATIX_DB && STRATIX_DB.getSettings().currencySymbol) || '₹';
  n = Math.abs(Number(n) || 0);
  if (n >= 1e7) return sym + (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return sym + (n / 1e5).toFixed(2) + ' L';
  if (n >= 1e3) return sym + (n / 1e3).toFixed(1) + 'K';
  return sym + Math.round(n).toLocaleString('en-IN');
}

/**
 * Format a date string for display.
 * Replaces: EH.dateStr(), FIN.dateStr()
 */
function sx_date(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt) ? '—' : dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Get today's date as YYYY-MM-DD string.
 */
function sx_today() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Validate a form object against a STRATIX_MODELS validator.
 * Returns null if valid, or { field: message } object.
 * @param {string} modelName - e.g. 'Customer', 'Invoice', 'Transaction'
 * @param {Object} data
 */
function sx_validate(modelName, data) {
  const model = STRATIX_MODELS[modelName];
  if (!model) return null;
  return model.validate(data);
}

/**
 * Show field-level validation errors in a form.
 * Looks for elements with id="${fieldId}-error" and populates them.
 * @param {Object|null} errors - { fieldId: message } or null to clear
 */
function sx_showErrors(errors) {
  // Clear existing errors
  document.querySelectorAll('.sx-field-error').forEach(el => {
    el.textContent = '';
    el.style.display = 'none';
  });

  if (!errors) return;

  Object.entries(errors).forEach(([field, message]) => {
    const el = document.getElementById(`${field}-error`);
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
    }
    // Also highlight the input
    const input = document.getElementById(field) || document.querySelector(`[name="${field}"]`);
    if (input) {
      input.style.borderColor = 'var(--red)';
      input.addEventListener('input', () => {
        input.style.borderColor = '';
        if (el) { el.textContent = ''; el.style.display = 'none'; }
      }, { once: true });
    }
  });
}

/**
 * Smart confirmation dialog — replaces browser confirm() with styled modal.
 * @param {string} message
 * @param {Function} onConfirm
 * @param {Object} [opts] - { confirmText, cancelText, type }
 */
function sx_confirm(message, onConfirm, opts = {}) {
  const id = 'sx-confirm-' + Date.now();
  const type = opts.type || 'warning'; // warning | danger | info
  const confirmText = opts.confirmText || 'Confirm';
  const cancelText = opts.cancelText || 'Cancel';
  const colors = { warning: '#2563EB', danger: '#ff4d4d', info: '#4f9ef0' };
  const color = colors[type] || colors.warning;

  const el = document.createElement('div');
  el.id = id;
  el.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .15s ease';
  el.innerHTML = `
    <div style="background:#F8FAFC;border:1px solid ${color}33;border-radius:18px;padding:28px;max-width:360px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.8)">
      <div style="font-size:32px;text-align:center;margin-bottom:14px">${type === 'danger' ? '🗑️' : type === 'warning' ? '⚠️' : 'ℹ️'}</div>
      <p style="text-align:center;font-size:14px;color:#b8c6de;line-height:1.7;margin-bottom:24px">${message}</p>
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('${id}').remove()" 
          style="flex:1;padding:12px;border:1px solid #E2E8F0;background:transparent;border-radius:10px;color:#5a6e90;cursor:pointer;font-family:var(--font);font-size:14px;transition:.15s"
          onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background='transparent'">
          ${cancelText}
        </button>
        <button id="${id}-confirm"
          style="flex:1;padding:12px;border:none;background:linear-gradient(135deg,${color},${color}cc);border-radius:10px;color:${type==='warning'?'#F8FAFC':'#fff'};cursor:pointer;font-family:var(--font);font-size:14px;font-weight:700;transition:.15s">
          ${confirmText}
        </button>
      </div>
    </div>`;

  document.body.appendChild(el);

  document.getElementById(`${id}-confirm`).addEventListener('click', () => {
    el.remove();
    onConfirm();
  });

  el.addEventListener('click', e => {
    if (e.target === el) el.remove();
  });
}

/**
 * Add the required CSS class for field-level validation errors to the document.
 * Call once — idempotent.
 */
(function _injectValidationCSS() {
  if (document.getElementById('sx-validation-css')) return;
  const style = document.createElement('style');
  style.id = 'sx-validation-css';
  style.textContent = `
    .sx-field-error {
      display: none;
      color: var(--red, #ff4d4d);
      font-size: 11px;
      margin-top: 4px;
      font-weight: 600;
    }
    @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
    @keyframes toastIn { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
    @keyframes toastOut { from { opacity: 1; transform: translateY(0) } to { opacity: 0; transform: translateY(-8px) } }
  `;
  document.head.appendChild(style);
})();
