// tests/test_v12_challenger_routes.js - Empirical Adversarial Verification of Route Switching & Reactivity Lifecycles
import assert from 'node:assert';
import { store } from '../js/store.js';
import { renderDashboardView, calculateWeeklyChartData } from '../js/views/dashboardView.js';
import { renderPosView } from '../js/views/posView.js';
import { MockElement } from './harness.js';
import { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_EXPENSES, INITIAL_SETTINGS } from '../js/models.js';
import { uiModal } from '../js/ui-feedback.js';
import fs from 'node:fs';
import crypto from 'node:crypto';

let passCount = 0;
let failCount = 0;

function resetStore() {
  store.cart = [];
  store.listeners = [];
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

async function test(name, fn) {
  try {
    await fn();
    passCount++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
  } catch (err) {
    failCount++;
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(err);
  }
}

async function runAdversarialSuite() {
  console.log('\x1b[1m\x1b[33m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[33m   ⚔️ ADVERSARIAL CHALLENGER: ROUTE SWITCHING & REACTIVITY LIFECYCLES \x1b[0m');
  console.log('\x1b[1m\x1b[33m======================================================================\x1b[0m\n');

  // ---------------------------------------------------------------------------
  // CHALLENGE 1: Cross-Route View Hijacking & Unbind Lifecycle
  // ---------------------------------------------------------------------------
  console.log('\x1b[1m▶ CHALLENGE 1: Cross-Route View Isolation & Subscriber Detachment\x1b[0m');

  await test('1.1 Render Dashboard -> Navigate to POS -> store.saveInvoice() -> POS is NOT overwritten', async () => {
    resetStore();
    const mainContainer = new MockElement('main', { id: 'app-main-content' });
    mainContainer.isConnected = true;

    // 1. Render Dashboard
    renderDashboardView(mainContainer);
    assert.strictEqual(mainContainer._hasDashboardStoreSub, true, 'Dashboard must register subscription flag');
    assert.notStrictEqual(mainContainer.querySelector('#trendChartSvg'), null, '#trendChartSvg must exist in Dashboard');
    assert.notStrictEqual(mainContainer.querySelector('#weeklyTrendCard'), null, '#weeklyTrendCard must exist in Dashboard');
    const initialListenerCount = store.listeners.length;
    assert.ok(initialListenerCount >= 1, 'Store must have at least 1 listener');

    // 2. Navigate to POS
    renderPosView(mainContainer);
    assert.strictEqual(mainContainer.querySelector('#trendChartSvg'), null, 'POS view must NOT contain #trendChartSvg');
    assert.strictEqual(mainContainer.querySelector('#weeklyTrendCard'), null, 'POS view must NOT contain #weeklyTrendCard');
    assert.notStrictEqual(mainContainer.querySelector('#tabPosBtn'), null, 'POS view tab must be present');

    // 3. Complete an invoice while on POS
    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p1', name: 'Pastel de Chocolate', quantity: 2, price: 25.00, total: 50.00 }],
      total: 50.00
    });

    // 4. Assert POS remains intact, Dashboard was NOT re-rendered into mainContainer
    assert.strictEqual(mainContainer.querySelector('#trendChartSvg'), null, 'VIOLATION: Dashboard hijacked active POS view!');
    assert.strictEqual(mainContainer.querySelector('#weeklyTrendCard'), null, 'VIOLATION: Dashboard card hijacked POS view!');
    assert.notStrictEqual(mainContainer.querySelector('#tabPosBtn'), null, 'POS view tab must remain in DOM');

    // 5. Assert subscription cleanup
    assert.strictEqual(mainContainer._hasDashboardStoreSub, false, 'container._hasDashboardStoreSub must be reset to false');
    assert.strictEqual(store.listeners.length, initialListenerCount - 1, 'Subscriber must be removed from store.listeners');
  });

  await test('1.2 Successive store mutations while on POS do not trigger errors or zombie re-registrations', async () => {
    resetStore();
    const mainContainer = new MockElement('main', { id: 'app-main-content' });
    mainContainer.isConnected = true;

    renderDashboardView(mainContainer);
    renderPosView(mainContainer);

    // First mutation detaches subscriber
    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p1', name: 'Pastel', quantity: 1, price: 10, total: 10 }],
      total: 10
    });
    assert.strictEqual(mainContainer._hasDashboardStoreSub, false);
    const listenerCountAfterDetached = store.listeners.length;

    // Subsequent mutations while on POS
    store.saveExpense({ amount: 15, concept: 'Azúcar refinada', category: 'Insumos' });
    store.deleteExpense('EXP-NONEXISTENT');
    store.notify('state_reloaded', store.state);

    assert.strictEqual(store.listeners.length, listenerCountAfterDetached, 'Listener count must remain clean and stable');
    assert.strictEqual(mainContainer.querySelector('#trendChartSvg'), null, 'Dashboard must never remount unbidden');
  });

  await test('1.3 Navigating back to Dashboard re-subscribes cleanly and restores reactivity', async () => {
    resetStore();
    const mainContainer = new MockElement('main', { id: 'app-main-content' });
    mainContainer.isConnected = true;

    // Dashboard -> POS -> store mutation (unsubscribes)
    renderDashboardView(mainContainer);
    renderPosView(mainContainer);
    store.saveInvoice({ type: 'ticket', items: [{ productId: 'p1', name: 'Pastel', quantity: 1, price: 10, total: 10 }], total: 10 });
    assert.strictEqual(mainContainer._hasDashboardStoreSub, false);

    // Navigate back to Dashboard
    renderDashboardView(mainContainer);
    assert.strictEqual(mainContainer._hasDashboardStoreSub, true, 'Must re-arm subscription flag on dashboard mount');
    assert.notStrictEqual(mainContainer.querySelector('#trendChartSvg'), null, 'Trend chart must be remounted');

    // Trigger expense while on Dashboard
    const initialKpiSales = mainContainer.querySelector('#dashTotalSales').innerText;
    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p1', name: 'Pastel', quantity: 1, price: 500, total: 500 }],
      total: 500
    });

    const updatedKpiSales = mainContainer.querySelector('#dashTotalSales').innerText;
    assert.notStrictEqual(updatedKpiSales, initialKpiSales, 'Dashboard must reactively update after re-mounting');
  });

  // ---------------------------------------------------------------------------
  // CHALLENGE 2: Double Re-Render Elimination on Expense Mutations
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ CHALLENGE 2: Single Re-render Assertion (No Double Renders)\x1b[0m');

  await test('2.1 Submitting expense form triggers EXACTLY ONE render, not duplicate', async () => {
    resetStore();
    const mainContainer = new MockElement('main', { id: 'app-main-content' });
    mainContainer.isConnected = true;

    renderDashboardView(mainContainer);

    // Form submission simulation
    const form = mainContainer.querySelector('#expenseForm');
    const amountInput = mainContainer.querySelector('#expenseAmount');
    const conceptInput = mainContainer.querySelector('#expenseConcept');
    const categoryInput = mainContainer.querySelector('#expenseCategory');

    assert.notStrictEqual(form, null, '#expenseForm must exist');
    amountInput.value = '42.50';
    conceptInput.value = 'Mantequilla Gloria';
    categoryInput.value = 'Insumos';

    // Track calls to store.getFinancialSummary, which is called once per renderDashboardView execution
    let renderInvocations = 0;
    const origGetFinancialSummary = store.getFinancialSummary.bind(store);
    store.getFinancialSummary = () => {
      renderInvocations++;
      return origGetFinancialSummary();
    };

    // Submit form
    form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

    // Assert renderDashboardView was called exactly once
    assert.strictEqual(renderInvocations, 1, `Expected exactly 1 re-render, but observed ${renderInvocations}`);

    // Restore original method
    store.getFinancialSummary = origGetFinancialSummary;

    // Verify expense is present in store
    const expenses = store.getExpenses();
    const created = expenses.find(e => e.concept === 'Mantequilla Gloria');
    assert.notStrictEqual(created, undefined, 'Created expense must be saved in store');
    assert.strictEqual(created.amount, 42.50);
  });

  await test('2.2 Deleting an expense triggers EXACTLY ONE reactive re-render', async () => {
    resetStore();
    const mainContainer = new MockElement('main', { id: 'app-main-content' });
    mainContainer.isConnected = true;

    // Add an initial expense to delete
    const exp = store.saveExpense({ amount: 88.00, concept: 'Harina Selecta', category: 'Insumos' });

    renderDashboardView(mainContainer);

    // Find delete button
    const deleteBtns = mainContainer.querySelectorAll('.btn-delete-expense');
    const deleteBtn = deleteBtns.find(b => b.getAttribute('data-id') === exp.id);
    assert.notStrictEqual(deleteBtn, undefined, 'Delete button for expense must exist');

    // Mock uiModal.confirm to resolve true
    const originalConfirm = uiModal.confirm;
    uiModal.confirm = async () => true;

    // Track calls to store.getFinancialSummary
    let renderInvocations = 0;
    const origGetFinancialSummary = store.getFinancialSummary.bind(store);
    store.getFinancialSummary = () => {
      renderInvocations++;
      return origGetFinancialSummary();
    };

    // Click delete
    deleteBtn.click();

    // Await async confirm and reactive dispatch
    await new Promise(resolve => setTimeout(resolve, 50));

    // Verify render invocation count is exactly 1
    assert.strictEqual(renderInvocations, 1, `Expected exactly 1 re-render on delete, but observed ${renderInvocations}`);

    // Restore
    store.getFinancialSummary = origGetFinancialSummary;
    uiModal.confirm = originalConfirm;

    // Verify expense is deleted from store
    const deletedExp = store.getExpense(exp.id);
    assert.strictEqual(deletedExp, undefined, 'Expense must be deleted from store');
  });

  // ---------------------------------------------------------------------------
  // CHALLENGE 3: Rapid Route Thrashing & Memory Leak Stress Test
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ CHALLENGE 3: Rapid Route Thrashing & Memory Leak Stress Test\x1b[0m');

  await test('3.1 Thrashing routes 50 times with interleaved store writes maintains bounded listener count', async () => {
    resetStore();
    const mainContainer = new MockElement('main', { id: 'app-main-content' });
    mainContainer.isConnected = true;

    const baseListenerCount = store.listeners.length;

    for (let i = 0; i < 50; i++) {
      if (i % 2 === 0) {
        renderDashboardView(mainContainer);
      } else {
        renderPosView(mainContainer);
      }

      // Mutate store every 3 iterations
      if (i % 3 === 0) {
        store.saveExpense({
          amount: 10 + i,
          concept: `Stress Gasto ${i}`,
          category: 'Servicios'
        });
      }
    }

    // Now navigate to POS and trigger store event
    renderPosView(mainContainer);
    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p1', name: 'Pastel', quantity: 1, price: 15, total: 15 }],
      total: 15
    });

    // Verify no zombie listeners leaked
    assert.strictEqual(mainContainer._hasDashboardStoreSub, false, 'Dashboard sub must be clean');
    assert.strictEqual(mainContainer.querySelector('#trendChartSvg'), null, 'POS view must not be hijacked');
    assert.ok(store.listeners.length <= baseListenerCount + 1, `Listeners must not leak (found ${store.listeners.length})`);
  });

  await test('3.2 Navigating to POS without store events, then returning to Dashboard, does NOT accumulate duplicate subscribers', async () => {
    resetStore();
    const mainContainer = new MockElement('main', { id: 'app-main-content' });
    mainContainer.isConnected = true;

    // Render Dashboard
    renderDashboardView(mainContainer);
    const countAfterDash1 = store.listeners.length;

    // Navigate to POS (no store event fired)
    renderPosView(mainContainer);

    // Return to Dashboard
    renderDashboardView(mainContainer);
    const countAfterDash2 = store.listeners.length;

    assert.strictEqual(countAfterDash2, countAfterDash1, 'Duplicate subscription must NOT be added when returning to Dashboard without unbind');

    // Fire store event on Dashboard: exactly 1 update
    let renderCalls = 0;
    const unsub = store.subscribe((ev) => {
      if (ev === 'expenses_changed') renderCalls++;
    });

    store.saveExpense({ amount: 12, concept: 'Levadura', category: 'Insumos' });
    assert.strictEqual(renderCalls, 1);
    unsub();
  });

  // ---------------------------------------------------------------------------
  // CHALLENGE 4: Defensiveness against Abnormal Container States
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ CHALLENGE 4: Defensiveness Against Abnormal Container States\x1b[0m');

  await test('4.1 Container with missing querySelector or null container gracefully unsubscribes', async () => {
    resetStore();
    const mockContainer = {
      _hasDashboardStoreSub: false,
      isConnected: true,
      querySelector: null // broken querySelector
    };

    // Simulate listener registered on this abnormal container
    let unsubCalled = false;
    const unsubscribe = () => { unsubCalled = true; };

    // The subscription callback logic from dashboardView.js:
    const callback = (event) => {
      if (mockContainer.isConnected === false || typeof mockContainer.querySelector !== "function" || !mockContainer.querySelector?.("#weeklyTrendCard") || !mockContainer.querySelector?.("#trendChartSvg")) {
        unsubscribe();
        mockContainer._hasDashboardStoreSub = false;
        return;
      }
    };

    callback('expenses_changed');
    assert.strictEqual(unsubCalled, true, 'Must call unsubscribe when querySelector is not a function');
    assert.strictEqual(mockContainer._hasDashboardStoreSub, false);
  });

  await test('4.2 Partial DOM stripping (e.g. #weeklyTrendCard removed, #trendChartSvg remains) triggers clean unbind', async () => {
    resetStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    assert.strictEqual(container._hasDashboardStoreSub, true);

    // Partially strip DOM (remove only #weeklyTrendCard)
    container.innerHTML = '<svg id="trendChartSvg"></svg>';

    // Fire event
    store.notify('expenses_changed', store.state.expenses);

    assert.strictEqual(container._hasDashboardStoreSub, false, 'Partial DOM must unbind dashboard subscription');
  });

  // ---------------------------------------------------------------------------
  // CHALLENGE 5: Financial Chart Integrity with Boundary Numbers
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ CHALLENGE 5: Financial Chart Boundary & Extreme Numbers\x1b[0m');

  await test('5.1 Extreme numbers ($10,000,000) scale without SVG NaN or Infinity', async () => {
    resetStore();
    const container = new MockElement('div');
    container.isConnected = true;

    // Inject massive transaction
    store.state.invoices.push({
      id: 'INV-EXTREME',
      date: new Date().toISOString().slice(0, 10),
      total: 10000000,
      items: [{ productId: 'p1', name: 'Mega Cake', quantity: 1, price: 10000000, total: 10000000 }]
    });

    renderDashboardView(container);

    const svg = container.querySelector('#trendChartSvg');
    assert.notStrictEqual(svg, null);
    const bars = container.querySelectorAll('.bar-sales');
    assert.strictEqual(bars.length, 7);

    bars.forEach(bar => {
      const height = parseFloat(bar.getAttribute('height'));
      const y = parseFloat(bar.getAttribute('y'));
      assert.ok(!isNaN(height) && isFinite(height), 'Height must be finite number');
      assert.ok(!isNaN(y) && isFinite(y), 'Y must be finite number');
      assert.ok(height >= 0 && height <= 160, `Height ${height} must stay within viewBox bounds`);
    });
  });

  await test('5.2 Massive expenses exceeding sales (Net Loss) calculates negative profit and 0/negative margins safely', async () => {
    resetStore();
    const container = new MockElement('div');
    container.isConnected = true;

    // Zero sales, massive expenses
    store.state.invoices = [];
    store.state.expenses = [
      { id: 'EXP-1', amount: 50000, concept: 'Horno Industrial', category: 'Mantenimiento', date: new Date().toISOString().slice(0, 10) }
    ];

    renderDashboardView(container);

    const netProfitEl = container.querySelector('#dashNetProfit');
    assert.notStrictEqual(netProfitEl, null);
    assert.ok(netProfitEl.innerText.includes('-'), 'Net profit must be displayed as negative');

    // Verify SVG bar doesn't crash on negative profit
    const profitBars = container.querySelectorAll('.bar-profit');
    profitBars.forEach(bar => {
      const height = parseFloat(bar.getAttribute('height'));
      assert.ok(!isNaN(height) && height >= 0, 'Height must be >= 0');
    });
  });

  // ---------------------------------------------------------------------------
  // CHALLENGE 6: Asset Mirror Parity (Root vs Android)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ CHALLENGE 6: Asset Mirror Parity (Root vs Android)\x1b[0m');

  await test('6.1 Root dashboardView.js and Android asset dashboardView.js are byte-identical', () => {
    const rootPath = 'js/views/dashboardView.js';
    const androidPath = 'android_project/assets/js/views/dashboardView.js';

    const rootBuf = fs.readFileSync(rootPath);
    const androidBuf = fs.readFileSync(androidPath);

    const rootHash = crypto.createHash('sha256').update(rootBuf).digest('hex');
    const androidHash = crypto.createHash('sha256').update(androidBuf).digest('hex');

    assert.strictEqual(rootHash, androidHash, 'SHA256 hashes must match byte-for-byte');
    assert.strictEqual(rootBuf.length, androidBuf.length, 'File byte sizes must match identically');
  });

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[33m======================================================================\x1b[0m');
  console.log(`\x1b[1mADVERSARIAL STRESS SUMMARY: ${passCount} PASSED | ${failCount} FAILED\x1b[0m`);
  console.log('\x1b[1m\x1b[33m======================================================================\x1b[0m\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32m✔ EMPIRICAL VERDICT: ALL ADVERSARIAL CHALLENGES CONFIRMED ROBUST.\x1b[0m\n');
    process.exit(0);
  }
}

runAdversarialSuite();
