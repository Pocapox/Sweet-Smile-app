// tests/test_m2_accounting_verification.js - Milestone M2_v12 Comprehensive Empirical Verification
import assert from 'node:assert';
import { store } from '../js/store.js';
import { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_EXPENSES, INITIAL_SETTINGS } from '../js/models.js';
import { renderDashboardView } from '../js/views/dashboardView.js';
import { uiToast, uiModal } from '../js/ui-feedback.js';

console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
console.log('\x1b[1m\x1b[36m   🎂 MILESTONE M2_v12: EXPENSE TRACKING & ACCOUNTING VERIFICATION    \x1b[0m');
console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(`    ${err.message}`);
    failCount++;
  }
}

function resetCleanStore() {
  store.cart = [];
  store.state = {
    products: JSON.parse(JSON.stringify(INITIAL_PRODUCTS)),
    inventory: JSON.parse(JSON.stringify(INITIAL_INVENTORY)),
    recipes: JSON.parse(JSON.stringify(INITIAL_RECIPES)),
    invoices: JSON.parse(JSON.stringify(INITIAL_INVOICES)),
    expenses: JSON.parse(JSON.stringify(INITIAL_EXPENSES)),
    settings: JSON.parse(JSON.stringify(INITIAL_SETTINGS)),
    isOnline: true,
    cloudSyncStatus: "synced"
  };
}

// ---------------------------------------------------------------------------
// SUITE 1: Model & Seed Data Verification
// ---------------------------------------------------------------------------
console.log('\x1b[1m▶ SUITE 1: Expense Seed Dataset & Model Contract\x1b[0m');

test('1.1 INITIAL_EXPENSES is defined with 4 realistic bakery expenses', () => {
  assert.ok(Array.isArray(INITIAL_EXPENSES), 'INITIAL_EXPENSES must be an array');
  assert.strictEqual(INITIAL_EXPENSES.length, 4, 'INITIAL_EXPENSES must contain 4 seed records');
});

test('1.2 Seed expense total matches expected $187.00 across distinct operational categories', () => {
  const sum = INITIAL_EXPENSES.reduce((s, e) => s + e.amount, 0);
  assert.strictEqual(Math.round(sum * 100) / 100, 187.00, 'Sum of seed expenses must be exactly $187.00');

  const categories = new Set(INITIAL_EXPENSES.map(e => e.category));
  assert.ok(categories.has('Insumos'), 'Must include Insumos');
  assert.ok(categories.has('Servicios'), 'Must include Servicios');
  assert.ok(categories.has('Empaques'), 'Must include Empaques');
  assert.ok(categories.has('Mantenimiento'), 'Must include Mantenimiento');
});

test('1.3 Each seed expense record contains all required financial attributes', () => {
  INITIAL_EXPENSES.forEach(exp => {
    assert.ok(exp.id && exp.id.startsWith('EXP-'), 'ID must start with EXP-');
    assert.ok(typeof exp.amount === 'number' && exp.amount > 0, 'Amount must be positive number');
    assert.ok(exp.concept && exp.concept.length > 3, 'Concept must be descriptive');
    assert.ok(exp.category, 'Category must be defined');
    assert.ok(exp.date && /^\d{4}-\d{2}-\d{2}$/.test(exp.date), 'Date must be YYYY-MM-DD');
    assert.ok(exp.paymentMethod, 'Payment method must be defined');
  });
});

// ---------------------------------------------------------------------------
// SUITE 2: Store CRUD Operations
// ---------------------------------------------------------------------------
console.log('\n\x1b[1m▶ SUITE 2: Reactive Store CRUD Methods & Data Validation\x1b[0m');

test('2.1 getExpenses returns full list and supports category filtering', () => {
  resetCleanStore();
  const all = store.getExpenses();
  assert.strictEqual(all.length, 4, 'getExpenses() should return all 4 expenses');

  const insumos = store.getExpenses({ category: 'Insumos' });
  assert.strictEqual(insumos.length, 1, 'Should find 1 Insumos expense');
  assert.strictEqual(insumos[0].amount, 85.50);

  const empty = store.getExpenses({ category: 'Marketing' });
  assert.strictEqual(empty.length, 0, 'Should return empty array for non-existent category');
});

test('2.2 getExpenses supports date range and text search filtering', () => {
  resetCleanStore();
  const filtered = store.getExpenses({ startDate: '2026-11-02', endDate: '2026-11-03' });
  assert.strictEqual(filtered.length, 3, 'Should find 3 expenses within date range');

  const searched = store.getExpenses({ search: 'batidora' });
  assert.strictEqual(searched.length, 1, 'Search by keyword "batidora" should return 1 record');
  assert.strictEqual(searched[0].id, 'EXP-004');
});

test('2.3 getExpense(id) retrieves single record or returns undefined', () => {
  resetCleanStore();
  const exp = store.getExpense('EXP-002');
  assert.notStrictEqual(exp, undefined);
  assert.strictEqual(exp.concept, 'Suministro gas natural hornos de convección');
  assert.strictEqual(exp.amount, 32.00);

  const missing = store.getExpense('EXP-999');
  assert.strictEqual(missing, undefined);
});

test('2.4 saveExpense validates amount > 0 and concept requirement', () => {
  resetCleanStore();
  assert.throws(() => store.saveExpense({ amount: 0, concept: 'Test' }), /monto.*mayor a 0/i);
  assert.throws(() => store.saveExpense({ amount: -25, concept: 'Test' }), /monto.*mayor a 0/i);
  assert.throws(() => store.saveExpense({ amount: 'invalid', concept: 'Test' }), /monto.*mayor a 0/i);
  assert.throws(() => store.saveExpense({ amount: 50, concept: '   ' }), /concepto.*requerido/i);
});

test('2.5 saveExpense auto-generates ID and ISO date if omitted and prepends to list', () => {
  resetCleanStore();
  const initialCount = store.getExpenses().length;

  const saved = store.saveExpense({
    amount: 15.75,
    concept: 'Azúcar glas y canela en rama',
    category: 'Insumos'
  });

  assert.ok(saved.id.startsWith('EXP-'), 'Auto-generated ID must start with EXP-');
  assert.strictEqual(saved.amount, 15.75);
  assert.ok(saved.date && /^\d{4}-\d{2}-\d{2}$/.test(saved.date), 'Auto-generated date format');
  assert.strictEqual(store.getExpenses().length, initialCount + 1);
  assert.strictEqual(store.getExpenses()[0].id, saved.id, 'New expense should be prepended to the top');
});

test('2.6 saveExpense updates existing record when matching ID is provided', () => {
  resetCleanStore();
  const updated = store.saveExpense({
    id: 'EXP-002',
    amount: 38.00,
    concept: 'Suministro gas natural hornos (ajuste tarifa)',
    category: 'Servicios'
  });

  assert.strictEqual(updated.amount, 38.00);
  assert.strictEqual(store.getExpense('EXP-002').amount, 38.00);
  assert.strictEqual(store.getExpenses().length, 4, 'Total count must not change on update');
});

test('2.7 deleteExpense removes record, saves state, and returns boolean status', () => {
  resetCleanStore();
  const result = store.deleteExpense('EXP-003');
  assert.strictEqual(result, true, 'deleteExpense should return true on success');
  assert.strictEqual(store.getExpenses().length, 3);
  assert.strictEqual(store.getExpense('EXP-003'), undefined);

  const nonExistent = store.deleteExpense('EXP-999');
  assert.strictEqual(nonExistent, false, 'deleteExpense should return false for unknown ID');
});

// ---------------------------------------------------------------------------
// SUITE 3: Financial Calculations & Margins Formula Precision
// ---------------------------------------------------------------------------
console.log('\n\x1b[1m▶ SUITE 3: Authentic Financial Accounting Engine & Margins Precision\x1b[0m');

test('3.1 Baseline financial summary calculations match exact mathematical definitions', () => {
  resetCleanStore();
  const fin = store.getFinancialSummary();

  // Baseline data:
  // Invoices: 61.61 + 18.50 + 122.58 + 30.00 = 232.69
  assert.strictEqual(fin.totalSales, 232.69, 'Total sales must equal $232.69');

  // COGS: FAC-00101 (23.70) + TIK-00234 (5.30) + FAC-00102 (51.60) + FAC-00103 (11.80) = 92.40
  assert.strictEqual(fin.totalCogs, 92.40, 'Total COGS must equal $92.40');

  // Operating Expenses: 85.50 + 32.00 + 24.50 + 45.00 = 187.00
  assert.strictEqual(fin.totalExpenses, 187.00, 'Total expenses must equal $187.00');

  // Total Costs: 92.40 + 187.00 = 279.40
  assert.strictEqual(fin.totalCosts, 279.40, 'Total costs must equal $279.40');

  // Gross Profit: 232.69 - 92.40 = 140.29
  assert.strictEqual(fin.grossProfit, 140.29, 'Gross profit must equal $140.29');

  // Gross Margin: (140.29 / 232.69) * 100 = 60.3%
  assert.strictEqual(fin.grossMargin, 60.3, 'Gross margin % must equal 60.3%');

  // Net Profit: 140.29 - 187.00 = -46.71 (Operating loss)
  assert.strictEqual(fin.netProfit, -46.71, 'Net profit must equal -$46.71');

  // Net Margin: (-46.71 / 232.69) * 100 = -20.1%
  assert.strictEqual(fin.netMargin, -20.1, 'Net margin % must equal -20.1%');
});

test('3.2 Dynamic financial recalculation upon new POS sale', () => {
  resetCleanStore();
  const pre = store.getFinancialSummary();

  // Save new sale: 2 Red Velvet Cakes (Price $28, Cost $11.80 each) = Sale $56, COGS $23.60
  store.saveInvoice({
    type: 'factura',
    items: [{ productId: 'p1', name: 'Pastel Red Velvet (8 porc.)', quantity: 2, price: 28.00, total: 56.00 }],
    total: 56.00
  });

  const post = store.getFinancialSummary();
  assert.strictEqual(post.totalSales, Math.round((pre.totalSales + 56.00) * 100) / 100);
  assert.strictEqual(post.totalCogs, Math.round((pre.totalCogs + 23.60) * 100) / 100);
  assert.strictEqual(post.totalExpenses, pre.totalExpenses, 'Expenses must not change on sale');

  const expectedGross = Math.round((post.totalSales - post.totalCogs) * 100) / 100;
  assert.strictEqual(post.grossProfit, expectedGross);

  const expectedNet = Math.round((post.grossProfit - post.totalExpenses) * 100) / 100;
  assert.strictEqual(post.netProfit, expectedNet);
  assert.ok(post.netProfit > pre.netProfit, 'Net profit must increase following profitable sale');
});

test('3.3 Dynamic financial recalculation upon registering new expense', () => {
  resetCleanStore();
  const pre = store.getFinancialSummary();

  // Register new expense: $100.00 for Kitchen Repair
  store.saveExpense({
    amount: 100.00,
    concept: 'Reparación termostato horno de piso',
    category: 'Mantenimiento'
  });

  const post = store.getFinancialSummary();
  assert.strictEqual(post.totalSales, pre.totalSales, 'Sales must not change on expense');
  assert.strictEqual(post.totalCogs, pre.totalCogs, 'COGS must not change on expense');
  assert.strictEqual(post.totalExpenses, pre.totalExpenses + 100.00);
  assert.strictEqual(post.netProfit, Math.round((pre.netProfit - 100.00) * 100) / 100);
  assert.ok(post.netMargin < pre.netMargin, 'Net margin must drop following additional expense');
});

test('3.4 Zero sales division protection returns 0.0 without NaN or Infinity', () => {
  resetCleanStore();
  store.state.invoices = []; // Clear all sales

  const fin = store.getFinancialSummary();
  assert.strictEqual(fin.totalSales, 0.0);
  assert.strictEqual(fin.grossMargin, 0.0);
  assert.strictEqual(fin.netMargin, 0.0);
  assert.ok(!Number.isNaN(fin.grossMargin), 'Gross margin must not be NaN');
  assert.ok(Number.isFinite(fin.grossMargin), 'Gross margin must be finite');
  assert.ok(!Number.isNaN(fin.netMargin), 'Net margin must not be NaN');
  assert.ok(Number.isFinite(fin.netMargin), 'Net margin must be finite');
});

// ---------------------------------------------------------------------------
// SUITE 4: Backup Export/Import & Dual Persistence
// ---------------------------------------------------------------------------
console.log('\n\x1b[1m▶ SUITE 4: Backup Export/Import Serialization & Dual Persistence\x1b[0m');

test('4.1 exportBackup serializes expenses array into JSON payload', () => {
  resetCleanStore();
  const backupJson = store.exportBackup();
  const parsed = JSON.parse(backupJson);

  assert.ok(Array.isArray(parsed.expenses), 'Exported backup must include expenses array');
  assert.strictEqual(parsed.expenses.length, 4);
  assert.strictEqual(parsed.expenses[0].id, 'EXP-001');
});

test('4.2 importBackup successfully restores expenses into store state', () => {
  resetCleanStore();
  const customBackup = {
    products: store.state.products,
    recipes: store.state.recipes,
    invoices: store.state.invoices,
    inventory: store.state.inventory,
    expenses: [
      {
        id: 'EXP-CUSTOM-1',
        concept: 'Compra de fresas ecológicas',
        category: 'Insumos',
        amount: 55.00,
        date: '2026-11-05'
      }
    ],
    settings: store.state.settings
  };

  const success = store.importBackup(JSON.stringify(customBackup));
  assert.strictEqual(success, true, 'importBackup should return true');
  assert.strictEqual(store.state.expenses.length, 1);
  assert.strictEqual(store.state.expenses[0].id, 'EXP-CUSTOM-1');
  assert.strictEqual(store.state.expenses[0].amount, 55.00);
});

// ---------------------------------------------------------------------------
// SUITE 5: Dashboard View Rendering & Interactive Components
// ---------------------------------------------------------------------------
console.log('\n\x1b[1m▶ SUITE 5: Dashboard View UI & Expense Modal Integration\x1b[0m');

class MockElement {
  constructor(tag, attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || '';
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this._innerHTML = '';
    this._value = attrs.value || '';
    this._classList = new Set();
    if (attrs.class) {
      attrs.class.split(/\s+/).filter(Boolean).forEach(c => this._classList.add(c));
    }
  }

  get classList() {
    const self = this;
    return {
      contains: (c) => self._classList.has(c),
      add: (...classes) => classes.forEach(c => c && self._classList.add(c)),
      remove: (...classes) => classes.forEach(c => self._classList.delete(c)),
      toggle: (c) => {
        if (self._classList.has(c)) { self._classList.delete(c); return false; }
        self._classList.add(c); return true;
      }
    };
  }

  get value() { return this._value; }
  set value(v) { this._value = String(v ?? ''); this.attributes.value = this._value; }

  get innerText() {
    if (this._innerText !== undefined) return this._innerText;
    if (this.children.length > 0) {
      return this.children.map(c => c.innerText || '').join(' ').trim();
    }
    return '';
  }
  set innerText(v) { this._innerText = String(v ?? ''); }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'value') return this.value;
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'id') this.id = String(val);
  }

  appendChild(ch) {
    ch.parentNode = this;
    this.children.push(ch);
    return ch;
  }

  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }

  dispatchEvent(eventObj) {
    const type = typeof eventObj === 'string' ? eventObj : eventObj.type;
    const list = this.listeners[type] || [];
    const evt = typeof eventObj === 'string' ? { type, target: this, stopPropagation() {} } : eventObj;
    for (const fn of list) fn(evt);
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this, stopPropagation() {} });
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const res = [];
    const match = (n) => {
      if (sel.startsWith('#')) return n.id === sel.slice(1);
      if (sel.startsWith('.')) return n.classList.contains(sel.slice(1));
      return n.tagName.toLowerCase() === sel.toLowerCase();
    };
    const walk = (n) => {
      for (const ch of n.children) {
        if (match(ch)) res.push(ch);
        walk(ch);
      }
    };
    walk(this);
    return res;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    this._parse(html);
  }

  get innerHTML() { return this._innerHTML; }

  _parse(html) {
    if (!html) return;
    const tagRegex = /<([a-zA-Z0-9\-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9\-]+)([^>]*?)\/?>/g;
    let m;
    while ((m = tagRegex.exec(html)) !== null) {
      const tag = m[1] || m[4];
      const rawAttrs = m[2] || m[5] || '';
      const inner = m[3] || '';
      const attrs = {};
      const attrRegex = /([a-zA-Z0-9\-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let am;
      while ((am = attrRegex.exec(rawAttrs)) !== null) {
        attrs[am[1]] = am[2] ?? am[3] ?? am[4] ?? '';
      }
      const child = new MockElement(tag, attrs);
      if (inner.includes('<')) {
        child.innerHTML = inner;
      } else {
        child.innerText = inner.trim();
      }
      this.appendChild(child);
    }
  }
}

test('5.1 Dashboard renders all 5 required KPI elements without NaN or mock 0.631 constants', () => {
  resetCleanStore();
  const container = new MockElement('div');
  renderDashboardView(container);

  const salesEl = container.querySelector('#dashTotalSales');
  const expensesEl = container.querySelector('#dashTotalExpenses');
  const profitEl = container.querySelector('#dashNetProfit');
  const grossMarginEl = container.querySelector('#dashGrossMargin');
  const netMarginEl = container.querySelector('#dashNetMargin');

  assert.notStrictEqual(salesEl, null, '#dashTotalSales must exist in DOM');
  assert.notStrictEqual(expensesEl, null, '#dashTotalExpenses must exist in DOM');
  assert.notStrictEqual(profitEl, null, '#dashNetProfit must exist in DOM');
  assert.notStrictEqual(grossMarginEl, null, '#dashGrossMargin must exist in DOM');
  assert.notStrictEqual(netMarginEl, null, '#dashNetMargin must exist in DOM');

  assert.ok(salesEl.innerText.includes('232.69'), 'Sales must display $232.69');
  assert.ok(expensesEl.innerText.includes('187.00'), 'Expenses must display $187.00');
  assert.ok(profitEl.innerText.includes('46.71'), 'Net profit must display 46.71');
  assert.ok(grossMarginEl.innerText.includes('60.3%'), 'Gross margin must display 60.3%');
  assert.ok(netMarginEl.innerText.includes('-20.1%'), 'Net margin must display -20.1%');
  assert.ok(!container.innerHTML.includes('NaN'), 'Dashboard must not contain NaN');
  assert.ok(!container.innerHTML.includes('Infinity'), 'Dashboard must not contain Infinity');
});

test('5.2 Modal #expenseModal and action button #btnOpenExpenseModal exist in dashboard view', () => {
  resetCleanStore();
  const container = new MockElement('div');
  renderDashboardView(container);

  const btnOpen = container.querySelector('#btnOpenExpenseModal');
  const modal = container.querySelector('#expenseModal');

  assert.notStrictEqual(btnOpen, null, '#btnOpenExpenseModal button must be present in Dashboard');
  assert.notStrictEqual(modal, null, '#expenseModal modal must be present in Dashboard DOM');
});

test('5.3 Modal #expenseModal contains all required form fields', () => {
  resetCleanStore();
  const container = new MockElement('div');
  renderDashboardView(container);

  assert.notStrictEqual(container.querySelector('#expenseAmount'), null, '#expenseAmount field must exist');
  assert.notStrictEqual(container.querySelector('#expenseConcept'), null, '#expenseConcept field must exist');
  assert.notStrictEqual(container.querySelector('#expenseCategory'), null, '#expenseCategory select must exist');
  assert.notStrictEqual(container.querySelector('#expenseDate'), null, '#expenseDate field must exist');
  assert.notStrictEqual(container.querySelector('#expensePaymentMethod'), null, '#expensePaymentMethod select must exist');
  assert.notStrictEqual(container.querySelector('#btnSaveExpense'), null, '#btnSaveExpense submit button must exist');
});

test('5.4 Expense Ledger table #expenseLedgerTable renders seed records and delete buttons', () => {
  resetCleanStore();
  const container = new MockElement('div');
  renderDashboardView(container);

  const table = container.querySelector('#expenseLedgerTable');
  assert.notStrictEqual(table, null, '#expenseLedgerTable must exist in DOM');

  const rows = container.querySelectorAll('.expense-row');
  assert.strictEqual(rows.length, 4, 'Must render 4 expense rows for initial seed data');

  const deleteBtns = container.querySelectorAll('.btn-delete-expense');
  assert.strictEqual(deleteBtns.length, 4, 'Must render delete button for each expense row');
});

// ---------------------------------------------------------------------------
// SUITE SUMMARY
// ---------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[36m======================================================================\x1b[0m');
console.log(`\x1b[1mVERIFICATION SUMMARY: ${passCount} PASSED | ${failCount} FAILED\x1b[0m`);
console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m✔ VERDICT: CONFIRMED. All M2_v12 Expense Tracking & Accounting requirements verified.\x1b[0m\n');
  process.exit(0);
}
