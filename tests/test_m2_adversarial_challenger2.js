// tests/test_m2_adversarial_challenger2.js
// EMPIRICAL ADVERSARIAL STRESS TEST HARNESS — MILESTONE M2_v12: EXPENSE TRACKING & ACCOUNTING
// Role: Accounting Challenger 2
// Thoroughly stress-tests:
// 1. High-throughput expense addition (100+ expenses, sorting, calculation speed <10ms, ledger bounds)
// 2. Form boundary inputs (negative, zero, string parsing/rejection, special chars, XSS payloads)
// 3. Dual-persistence & float precision ($0.10 + $0.20 = $0.30, accumulative decimals, localStorage + IndexedDB)
// 4. UI event reactivity (expenses_changed -> live DOM KPI element updates, unsubscribe lifecycle)

import assert from 'node:assert';
import { performance } from 'node:perf_hooks';
import { store } from '../js/store.js';
import {
  INITIAL_PRODUCTS,
  INITIAL_INVENTORY,
  INITIAL_RECIPES,
  INITIAL_INVOICES,
  INITIAL_EXPENSES,
  INITIAL_SETTINGS
} from '../js/models.js';
import { renderDashboardView } from '../js/views/dashboardView.js';
import { uiToast, uiModal } from '../js/ui-feedback.js';
import { saveToIndexedDB, loadFromIndexedDB } from '../js/db.js';
import { setupGlobalEnv, mockStorage, mockDocument } from './harness.js';

// Activate headless browser & storage mocks
setupGlobalEnv();

console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m');
console.log('\x1b[1m\x1b[35m   🥊 ADVERSARIAL CHALLENGER 2: M2_v12 EXPENSE & ACCOUNTING SUITE    \x1b[0m');
console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m\n');

let passCount = 0;
let failCount = 0;
const failureDetails = [];

async function runStep(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(`    ${err.stack || err.message}`);
    failCount++;
    failureDetails.push({ name, error: err.message });
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
    cloudSyncStatus: 'synced'
  };
}

// ---------------------------------------------------------------------------
// Realistic Mock DOM Node for full dashboardView tree parsing
// ---------------------------------------------------------------------------
class AdvMockNode {
  constructor(tag = 'div', attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || '';
    this.name = attrs.name || '';
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.isConnected = true;
    this._innerHTML = '';
    this._value = attrs.value || '';
    this._classList = new Set();
    this.style = { display: '' };
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
    if (name === 'name') return this.name;
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'id') this.id = String(val);
    if (name === 'name') this.name = String(val);
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
    const evt = typeof eventObj === 'string' ? { type, target: this, stopPropagation() {}, preventDefault() {} } : eventObj;
    if (!evt.target) evt.target = this;
    if (!evt.stopPropagation) evt.stopPropagation = () => {};
    if (!evt.preventDefault) evt.preventDefault = () => {};
    for (const fn of list) fn(evt);
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this });
  }

  submit() {
    this.dispatchEvent({ type: 'submit', target: this });
  }

  focus() {}

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const res = [];
    const match = (n) => {
      if (sel.startsWith('#')) return n.id === sel.slice(1);
      if (sel.startsWith('.')) return n.classList.contains(sel.slice(1));
      if (sel.startsWith('[data-category="')) {
        const cat = sel.slice(16, -2);
        return n.getAttribute('data-category') === cat;
      }
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
      const child = new AdvMockNode(tag, attrs);
      if (inner.includes('<')) {
        child.innerHTML = inner;
      } else {
        child.innerText = inner.trim();
      }
      this.appendChild(child);
    }
  }
}

async function main() {
  // ---------------------------------------------------------------------------
  // SUITE 1: HIGH-THROUGHPUT EXPENSE ADDITION & CALCULATION SPEED
  // ---------------------------------------------------------------------------
  console.log('\x1b[1m▶ SUITE 1: High-Throughput Expense Ingestion & Calculation Latency (<10ms)\x1b[0m');

  await runStep('1.1 Rapid insertion of 100 expenses across all 6 categories maintains chronological unshift order', () => {
    resetCleanStore();
    const initialCount = store.state.expenses.length; // 4
    const categories = ['Insumos', 'Servicios', 'Empaques', 'Mano de Obra', 'Mantenimiento', 'Otros'];

    const startTime = performance.now();
    for (let i = 1; i <= 100; i++) {
      const cat = categories[(i - 1) % categories.length];
      const amount = Math.round((5 + (i * 1.35)) * 100) / 100;
      store.saveExpense({
        amount,
        concept: `Gasto Prueba #${i} - ${cat}`,
        category: cat,
        date: `2026-11-${String(((i - 1) % 28) + 1).padStart(2, '0')}`,
        paymentMethod: i % 2 === 0 ? 'Transferencia Bancaria' : 'Efectivo',
        receipt: `REC-${1000 + i}`,
        notes: `Batch ingestion load test iteration ${i}`
      });
    }
    const elapsed = performance.now() - startTime;
    console.log(`    ↳ 100 expenses inserted and persisted in ${elapsed.toFixed(2)}ms (${(elapsed / 100).toFixed(3)}ms/op)`);

    assert.strictEqual(store.state.expenses.length, initialCount + 100, 'All 100 expenses must be saved in state');
    // Verify newest first: the last inserted was #100 ((100-1)%6 = 3 -> 'Mano de Obra')
    const lastCategory = categories[99 % 6];
    assert.strictEqual(store.state.expenses[0].concept, `Gasto Prueba #100 - ${lastCategory}`, 'Most recent expense must be prepended (unshifted) at index 0');
    assert.ok(store.state.expenses[0].id.startsWith('EXP-'), 'Auto-generated ID must follow EXP-XXXXX format');
  });

  await runStep('1.2 getFinancialSummary() calculation speed on 104 expenses is strictly <10ms (empirical target <1ms)', () => {
    // Store currently has 104 expenses + 10 invoices
    const iterations = 100;
    const latencies = [];

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const summary = store.getFinancialSummary();
      const t1 = performance.now();
      latencies.push(t1 - t0);
      assert.strictEqual(summary.expenseCount, 104, 'Summary must account for all 104 expenses');
      assert.ok(summary.totalExpenses > 0, 'Total expenses must be positive');
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / iterations;
    const maxLatency = Math.max(...latencies);
    console.log(`    ↳ getFinancialSummary latency over 100 iterations: Avg = ${avgLatency.toFixed(3)}ms, Max = ${maxLatency.toFixed(3)}ms`);

    assert.ok(maxLatency < 10.0, `Max calculation latency (${maxLatency.toFixed(3)}ms) must be strictly < 10ms`);
    assert.ok(avgLatency < 2.0, `Average calculation latency (${avgLatency.toFixed(3)}ms) must be well below 2ms`);
  });

  await runStep('1.3 Expense Ledger table DOM bounds: renders all 104 expenses without pagination crash or UI degradation', () => {
    const container = new AdvMockNode('div');
    const t0 = performance.now();
    renderDashboardView(container);
    const renderTime = performance.now() - t0;
    console.log(`    ↳ Dashboard view with 104 ledger rows rendered in ${renderTime.toFixed(2)}ms`);

    assert.ok(renderTime < 50.0, `Render time (${renderTime.toFixed(2)}ms) must be rapid and non-blocking`);

    const rows = container.querySelectorAll('.expense-row');
    assert.strictEqual(rows.length, 104, 'Dashboard expense ledger table must render all 104 expense rows');

    // Verify category filter toggling works dynamically
    const categoryFilter = container.querySelector('#expenseCategoryFilter');
    assert.notStrictEqual(categoryFilter, null, '#expenseCategoryFilter select element must exist');

    categoryFilter.value = 'Insumos';
    categoryFilter.dispatchEvent({ type: 'change', target: categoryFilter });

    let insumosVisible = 0;
    let othersHidden = 0;
    rows.forEach(r => {
      if (r.getAttribute('data-category') === 'Insumos') {
        if (r.style.display !== 'none') insumosVisible++;
      } else {
        if (r.style.display === 'none') othersHidden++;
      }
    });

    assert.ok(insumosVisible > 0, 'Insumos rows must be visible');
    assert.ok(othersHidden > 0, 'Non-Insumos rows must be hidden');
    assert.strictEqual(insumosVisible + othersHidden, 104, 'All rows accounted for in category filter test');
  });

  // ---------------------------------------------------------------------------
  // SUITE 2: FORM BOUNDARY INPUTS & ADVERSARIAL VALIDATION
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 2: Form Boundary Inputs & Adversarial Validation\x1b[0m');

  await runStep('2.1 Negative amounts are strictly rejected by store.saveExpense and UI modal', () => {
    resetCleanStore();
    const negativeCases = [-50, -0.01, -0.00001, -999999];

    for (const neg of negativeCases) {
      assert.throws(
        () => store.saveExpense({ amount: neg, concept: 'Gasto Negativo' }),
        /El monto del gasto debe ser un número mayor a 0/,
        `Negative amount ${neg} must be rejected with validation error`
      );
    }

    // UI Modal test: submitting negative amount triggers toast error and does not mutate store
    const container = new AdvMockNode('div');
    renderDashboardView(container);
    const countBefore = store.state.expenses.length;

    const amountInput = container.querySelector('#expenseAmount');
    const conceptInput = container.querySelector('#expenseConcept');
    const form = container.querySelector('#expenseForm');

    amountInput.value = '-45.00';
    conceptInput.value = 'Compra ilegal con monto negativo';
    form.dispatchEvent({ type: 'submit', target: form });

    assert.strictEqual(store.state.expenses.length, countBefore, 'Store must not receive negative expense from form');
    assert.ok(window._lastAlert.includes('válido mayor a 0'), 'Toast error message must notify user of invalid amount');
  });

  await runStep('2.2 Zero amount (0, 0.0, -0) is strictly rejected by store.saveExpense and UI modal', () => {
    const zeroCases = [0, 0.0, -0, '0', '0.00'];

    for (const z of zeroCases) {
      assert.throws(
        () => store.saveExpense({ amount: z, concept: 'Gasto Cero' }),
        /El monto del gasto debe ser un número mayor a 0/,
        `Zero amount ${z} must be rejected`
      );
    }
  });

  await runStep('2.3 String amounts are properly parsed or rejected if non-numeric', () => {
    resetCleanStore();

    // Valid numeric strings
    const exp1 = store.saveExpense({ amount: '42.50', concept: 'String Float Válido' });
    assert.strictEqual(exp1.amount, 42.50, 'String "42.50" must parse to float 42.50');

    const exp2 = store.saveExpense({ amount: '  19.99  ', concept: 'String con Espacios' });
    assert.strictEqual(exp2.amount, 19.99, 'String "  19.99  " must parse to float 19.99');

    // Non-numeric and empty strings must throw
    const invalidStrings = ['abc', '$45.00', 'NaN', 'undefined', '', '   '];
    for (const inv of invalidStrings) {
      assert.throws(
        () => store.saveExpense({ amount: inv, concept: 'Invalido' }),
        /El monto del gasto debe ser un número mayor a 0/,
        `Invalid string amount "${inv}" must be rejected`
      );
    }

    // Number with comma parses leading integer in JS or throws
    const parsedComma = store.saveExpense({ amount: '12,50', concept: 'Coma Decimal' });
    assert.ok(typeof parsedComma.amount === 'number' && parsedComma.amount > 0, 'Comma string must parse to positive float or integer');
  });

  await runStep('2.4 Special characters, Unicode, emojis and 10KB concept strings are handled safely', () => {
    resetCleanStore();

    // Unicode, accents, emojis
    const richConcept = 'Harina de Trigo 0000 🌾 & Vainilla de Papantla 🍰 — 100% Cacao (Ñoquis & Azúcar)';
    const richNotes = 'Factura con caracteres: <> & " \' / \\ \n\t tabuladores y saltos';
    const richExpense = store.saveExpense({
      amount: 75.30,
      concept: richConcept,
      notes: richNotes,
      category: 'Insumos'
    });

    assert.strictEqual(richExpense.concept, richConcept, 'Unicode and emojis must be preserved exactly in concept');
    assert.strictEqual(richExpense.notes, richNotes, 'Special characters must be preserved in notes');

    // Stress: 10,000-character concept string
    const longConcept = 'A'.repeat(10000);
    const longExpense = store.saveExpense({
      amount: 10.00,
      concept: longConcept,
      category: 'Otros'
    });
    assert.strictEqual(longExpense.concept.length, 10000, '10KB concept string must be accepted without truncation or crash');
  });

  await runStep('2.5 XSS injection attempts in concept, receipt, and notes are safely neutralized', () => {
    resetCleanStore();

    const xssConcept = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
    const xssReceipt = '<svg onload=alert(2)>';
    const xssNotes = '" onmouseover="alert(3)" <b style="color:red">';

    // 1. Data layer: must store string safely as plain text without executing
    const xssExp = store.saveExpense({
      amount: 60.00,
      concept: xssConcept,
      receipt: xssReceipt,
      notes: xssNotes,
      category: 'Servicios'
    });

    assert.strictEqual(xssExp.concept, xssConcept, 'Store should hold verbatim string without executing');

    // 2. Feedback layer: uiToast escapes HTML entities
    const toast = uiToast.success(`Gasto: ${xssConcept}`);
    assert.ok(!toast.innerHTML.includes('<script>'), 'uiToast must not contain unescaped <script> tag');
    assert.ok(toast.innerHTML.includes('&lt;script&gt;'), 'uiToast must escape < to &lt;');

    // 3. Feedback layer: uiModal.confirm escapes HTML entities
    uiModal.confirm({
      title: 'Confirmar Eliminación',
      message: `¿Eliminar gasto ${xssConcept}?`
    });
    const modalContainer = document.getElementById('uiModalContainer');
    assert.notStrictEqual(modalContainer, null, 'Modal container must exist in DOM');
    const overlay = modalContainer.children[modalContainer.children.length - 1];
    assert.notStrictEqual(overlay, null, 'Modal overlay must exist in modal container');
    assert.ok(overlay.className.includes('modal-backdrop-overlay'), 'Overlay element must have modal-backdrop-overlay class');
    assert.ok(!overlay.innerHTML.includes('<script>'), 'uiModal overlay must not contain unescaped <script>');
    assert.ok(overlay.innerHTML.includes('&lt;script&gt;'), 'uiModal overlay must escape < to &lt;');
  });

  // ---------------------------------------------------------------------------
  // SUITE 3: DUAL-PERSISTENCE & FLOAT ROUNDING PRECISION
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 3: Dual-Persistence & Float Rounding Precision ($0.10 + $0.20 = $0.30)\x1b[0m');

  await runStep('3.1 IEEE-754 binary floating point precision ($0.10 + $0.20) does not leak decimal artifacts', () => {
    resetCleanStore();
    // Clear seed expenses to test exact float sums
    store.state.expenses = [];

    store.saveExpense({ amount: 0.10, concept: 'Gasto Diez Centavos', category: 'Otros' });
    store.saveExpense({ amount: 0.20, concept: 'Gasto Veinte Centavos', category: 'Otros' });

    const summary = store.getFinancialSummary();
    // In raw JS: 0.10 + 0.20 === 0.30000000000000004
    assert.strictEqual(summary.totalExpenses, 0.30, 'totalExpenses must equal exactly 0.30 (not 0.30000000000000004)');

    // Verify dashboard DOM formatting
    const container = new AdvMockNode('div');
    renderDashboardView(container);
    const expEl = container.querySelector('#dashTotalExpenses');
    assert.ok(expEl.innerText.includes('$0.30'), 'Rendered currency must display formatted "$0.30"');
    assert.ok(!expEl.innerText.includes('0.30000000000000004'), 'Must not leak IEEE-754 precision artifacts');
  });

  await runStep('3.2 Accumulative float stress: 100 micro-expenses of $0.07 sum to exactly $7.00', () => {
    resetCleanStore();
    store.state.expenses = [];

    for (let i = 0; i < 100; i++) {
      store.saveExpense({ amount: 0.07, concept: `Micro-gasto #${i}`, category: 'Empaques' });
    }

    const summary = store.getFinancialSummary();
    assert.strictEqual(summary.totalExpenses, 7.00, 'Sum of 100 x $0.07 must be strictly $7.00');
    assert.strictEqual(summary.expensesByCategory['Empaques'], 7.00, 'Category aggregation must equal exactly $7.00');
  });

  await runStep('3.3 Financial margins: Gross and Net margins compute exact percentages and handle negative profit', () => {
    resetCleanStore();
    // Configure product with exact cost
    store.state.products = [{
      id: 'p-adv-test',
      name: 'Pastel Especial Test',
      cost: 40.00,
      price: 100.00
    }];
    // Invoice totaling $100.00 with 1 unit of p-adv-test (COGS = $40.00)
    store.state.invoices = [{
      id: 'INV-TEST-1',
      total: 100.00,
      items: [{ productId: 'p-adv-test', quantity: 1, cost: 40.00 }]
    }];
    // Expenses = $85.00
    store.state.expenses = [{
      id: 'EXP-TEST-1',
      amount: 85.00,
      concept: 'Gasto Pesado',
      category: 'Mantenimiento'
    }];

    const fin = store.getFinancialSummary();
    assert.strictEqual(fin.totalSales, 100.00, 'Total sales = 100.00');
    assert.strictEqual(fin.totalCogs, 40.00, 'Total COGS = 40.00');
    assert.strictEqual(fin.totalExpenses, 85.00, 'Total expenses = 85.00');
    assert.strictEqual(fin.grossProfit, 60.00, 'Gross profit = 100 - 40 = +60.00');
    assert.strictEqual(fin.grossMargin, 60.0, 'Gross margin = (60 / 100) * 100 = 60.0%');
    assert.strictEqual(fin.netProfit, -25.00, 'Net profit = 60 - 85 = -25.00');
    assert.strictEqual(fin.netMargin, -25.0, 'Net margin = (-25 / 100) * 100 = -25.0%');

    // Verify dashboard displays negative net profit with minus sign and correct styling
    const container = new AdvMockNode('div');
    renderDashboardView(container);
    const netEl = container.querySelector('#dashNetProfit');
    assert.ok(netEl.innerText.includes('-$25.00') || netEl.innerText.includes('-25.00'), 'Negative net profit must be formatted with negative sign');
    const netMarginEl = container.querySelector('#dashNetMargin');
    assert.ok(netMarginEl.innerText.includes('-25.0%'), 'Net margin must display negative percentage');
  });

  await runStep('3.4 Zero sales division protection: returns 0.0% margins without NaN or Infinity', () => {
    resetCleanStore();
    store.state.invoices = []; // 0 sales
    store.state.expenses = [{ id: 'EXP-1', amount: 50.00, concept: 'Gasto sin ventas' }];

    const fin = store.getFinancialSummary();
    assert.strictEqual(fin.totalSales, 0, 'Total sales is 0');
    assert.strictEqual(fin.grossMargin, 0.0, 'Gross margin must be protected to 0.0');
    assert.strictEqual(fin.netMargin, 0.0, 'Net margin must be protected to 0.0');
    assert.ok(!isNaN(fin.grossMargin), 'grossMargin must not be NaN');
    assert.ok(isFinite(fin.grossMargin), 'grossMargin must not be Infinity');
    assert.ok(!isNaN(fin.netMargin), 'netMargin must not be NaN');
    assert.ok(isFinite(fin.netMargin), 'netMargin must not be Infinity');
  });

  await runStep('3.5 Dual-Persistence: localStorage and IndexedDB (SweetSmileDB) serialize and restore state', async () => {
    resetCleanStore();
    const testExp = store.saveExpense({ amount: 125.75, concept: 'Dual Persistence Check', category: 'Insumos' });

    // 1. Verify localStorage serialization
    const rawLocal = mockStorage.getItem('sweet_smile_app_state_v1');
    assert.notStrictEqual(rawLocal, null, 'localStorage must contain saved state key');
    const parsedLocal = JSON.parse(rawLocal);
    assert.ok(Array.isArray(parsedLocal.expenses), 'Parsed localStorage must have expenses array');
    const foundLocal = parsedLocal.expenses.find(e => e.id === testExp.id);
    assert.notStrictEqual(foundLocal, undefined, 'Saved expense must exist in localStorage payload');
    assert.strictEqual(foundLocal.amount, 125.75, 'Stored amount in localStorage must match exactly');

    // 2. Verify IndexedDB persistence via db.js
    const idbSaved = await saveToIndexedDB('app_state', store.state);
    assert.strictEqual(idbSaved, true, 'saveToIndexedDB must return true');

    const loadedFromIdb = await loadFromIndexedDB('app_state');
    assert.notStrictEqual(loadedFromIdb, null, 'loadFromIndexedDB must return stored object');
    assert.ok(Array.isArray(loadedFromIdb.expenses), 'IndexedDB state must contain expenses array');
    const foundIdb = loadedFromIdb.expenses.find(e => e.id === testExp.id);
    assert.notStrictEqual(foundIdb, undefined, 'Saved expense must exist in IndexedDB');
    assert.strictEqual(foundIdb.amount, 125.75, 'Stored amount in IndexedDB must match float precision');
  });

  // ---------------------------------------------------------------------------
  // SUITE 4: UI EVENT REACTIVITY & DOM UPDATES
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 4: UI Event Reactivity & DOM Updates\x1b[0m');

  await runStep('4.1 expenses_changed event triggers immediate reactive DOM update of KPI cards', () => {
    resetCleanStore();
    const container = new AdvMockNode('div');
    renderDashboardView(container);

    // Baseline values before new expense
    const expElBefore = container.querySelector('#dashTotalExpenses');
    const netElBefore = container.querySelector('#dashNetProfit');
    assert.ok(expElBefore.innerText.includes('187.00'), 'Initial expenses = $187.00');
    assert.ok(netElBefore.innerText.includes('46.71'), 'Initial net profit = -$46.71');

    // Ingest new expense: $100.00
    store.saveExpense({
      amount: 100.00,
      concept: 'Batidora Planetaria Cuota',
      category: 'Mantenimiento'
    });

    // Since container was registered with renderDashboardView, store.subscribe should have triggered re-render
    const expElAfter = container.querySelector('#dashTotalExpenses');
    const netElAfter = container.querySelector('#dashNetProfit');

    // Total expenses should now be $187.00 + $100.00 = $287.00
    assert.ok(expElAfter.innerText.includes('287.00'), `Expenses KPI must update in DOM to $287.00 (got: ${expElAfter.innerText})`);
    // Net profit was -$46.71, now -$146.71
    assert.ok(netElAfter.innerText.includes('146.71'), `Net profit KPI must update in DOM to -$146.71 (got: ${netElAfter.innerText})`);

    // Expense ledger table should now contain 5 rows
    const rows = container.querySelectorAll('.expense-row');
    assert.strictEqual(rows.length, 5, 'Expense ledger table must reactively append new row (5 total)');
  });

  await runStep('4.2 deleteExpense triggers reactive DOM recalculation and row removal', () => {
    resetCleanStore();
    const container = new AdvMockNode('div');
    renderDashboardView(container);

    // Initial seed has EXP-001 ($85.50)
    const rowsBefore = container.querySelectorAll('.expense-row');
    assert.strictEqual(rowsBefore.length, 4, 'Initially 4 rows');

    // Delete EXP-001
    const deleted = store.deleteExpense('EXP-001');
    assert.strictEqual(deleted, true, 'EXP-001 must be deleted');

    // DOM should have reactively updated: 4 - 1 = 3 rows
    const rowsAfter = container.querySelectorAll('.expense-row');
    assert.strictEqual(rowsAfter.length, 3, 'Ledger table must reactively reflect deletion (3 rows)');

    // Expenses: $187.00 - $85.50 = $101.50
    const expEl = container.querySelector('#dashTotalExpenses');
    assert.ok(expEl.innerText.includes('101.50'), `Total expenses must reactively reduce to $101.50 (got: ${expEl.innerText})`);
  });

  await runStep('4.3 Rapid burst of 20 expenses_changed events executes stably without listener leaks', () => {
    resetCleanStore();
    const container = new AdvMockNode('div');
    renderDashboardView(container);

    const t0 = performance.now();
    for (let i = 1; i <= 20; i++) {
      store.saveExpense({
        amount: 5.00,
        concept: `Burst #${i}`,
        category: 'Otros'
      });
    }
    const elapsed = performance.now() - t0;
    console.log(`    ↳ 20 reactive UI updates executed in ${elapsed.toFixed(2)}ms (${(elapsed / 20).toFixed(2)}ms/update)`);

    assert.ok(elapsed < 250.0, '20 reactive UI updates must complete in <250ms');

    const expEl = container.querySelector('#dashTotalExpenses');
    // $187.00 + 20 * $5.00 = $287.00
    assert.ok(expEl.innerText.includes('287.00'), 'DOM must reflect all 20 batch mutations');
    assert.strictEqual(container.querySelectorAll('.expense-row').length, 24, 'All 24 expenses rendered in ledger');
  });

  await runStep('4.4 Store subscription unbinds cleanly when container is disconnected from DOM', () => {
    const container = new AdvMockNode('div');
    renderDashboardView(container);

    // Simulate disconnecting container from DOM
    container.isConnected = false;

    // Dispatch an expense change
    store.notify('expenses_changed', store.state.expenses);

    // Should have unsubscribed cleanly and cleared _hasDashboardStoreSub
    assert.strictEqual(container._hasDashboardStoreSub, false, 'Unsubscribe handler must reset _hasDashboardStoreSub when disconnected');
  });

  // ---------------------------------------------------------------------------
  // SUITE SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[35m======================================================================\x1b[0m');
  console.log(`\x1b[1mADVERSARIAL STRESS SUMMARY: ${passCount} PASSED | ${failCount} FAILED\x1b[0m`);
  console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m\n');

  if (failCount > 0) {
    console.error('\x1b[31mFAILURES DETECTED:\x1b[0m');
    failureDetails.forEach(f => console.error(` - ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('\x1b[32m✔ VERDICT: CONFIRMED. All adversarial stress tests PASSED with zero failures.\x1b[0m');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test harness failure:', err);
  process.exit(1);
});
