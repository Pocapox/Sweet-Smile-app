// tests/stress_m3_it2_route_navigation.js
// EMPIRICAL ADVERSARIAL STRESS TEST: ROUTE NAVIGATION & HIGH-FREQUENCY STORE MUTATIONS
// Milestone: M3_v12 Iteration 2 (Requirement R3)
// Role: Charts Remediation Challenger 2

import assert from 'node:assert';
import { performance } from 'node:perf_hooks';
import { store } from '../js/store.js';
import { renderDashboardView } from '../js/views/dashboardView.js';
import { renderPosView } from '../js/views/posView.js';
import { renderRecipesView } from '../js/views/recipesView.js';
import { renderInventoryView } from '../js/views/inventoryView.js';
import { setupGlobalEnv, MockElement } from './harness.js';
import {
  INITIAL_PRODUCTS,
  INITIAL_INVENTORY,
  INITIAL_RECIPES,
  INITIAL_INVOICES,
  INITIAL_EXPENSES,
  INITIAL_SETTINGS
} from '../js/models.js';

// Activate headless browser & storage mocks
setupGlobalEnv();

console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
console.log('\x1b[1m\x1b[36m   ⚔️ ADVERSARIAL STRESS: RAPID ROUTE NAVIGATION & MUTATION STORM   \x1b[0m');
console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

function resetCleanStore() {
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

async function runAdversarialStress() {
  const consoleErrors = [];
  const origConsoleError = console.error;
  console.error = (...args) => {
    consoleErrors.push(args.join(' '));
    origConsoleError(...args);
  };

  resetCleanStore();

  const container = new MockElement('div', { id: 'app-main-content' });
  container.isConnected = true;

  const baselineListeners = store.listeners.length;
  console.log(`[INIT] Baseline store listeners: ${baselineListeners}`);

  const totalLoops = 10;
  const loopLatencies = [];
  let totalMutations = 0;

  const startTime = performance.now();

  for (let loop = 1; loop <= totalLoops; loop++) {
    const loopStart = performance.now();

    // -------------------------------------------------------------------------
    // 1. ROUTE: DASHBOARD
    // -------------------------------------------------------------------------
    renderDashboardView(container);
    assert.strictEqual(container._hasDashboardStoreSub, true, `Loop ${loop}: Dashboard must set _hasDashboardStoreSub = true`);
    assert.notStrictEqual(container.querySelector('#weeklyTrendCard'), null, `Loop ${loop}: #weeklyTrendCard must be mounted`);
    assert.notStrictEqual(container.querySelector('#trendChartSvg'), null, `Loop ${loop}: #trendChartSvg must be mounted`);

    // Fire mutation while ON Dashboard: should reactively re-render and keep subscription
    store.saveExpense({
      amount: 10.00 + loop,
      concept: `Gasto Dash Loop ${loop}`,
      category: 'Insumos',
      date: '2026-11-05'
    });
    totalMutations++;
    assert.strictEqual(container._hasDashboardStoreSub, true, `Loop ${loop}: Dashboard must keep subscription after mutation`);
    assert.notStrictEqual(container.querySelector('#trendChartSvg'), null, `Loop ${loop}: #trendChartSvg must remain after reactive re-render`);

    // -------------------------------------------------------------------------
    // 2. ROUTE: POS
    // -------------------------------------------------------------------------
    renderPosView(container);
    // Active view must now be POS
    assert.notStrictEqual(container.querySelector('#tabPosBtn'), null, `Loop ${loop}: POS #tabPosBtn must be mounted`);
    assert.strictEqual(container.querySelector('#trendChartSvg'), null, `Loop ${loop}: Dashboard chart must not be in POS view`);

    // Fire store mutations while on POS:
    // First mutation triggers dashboard subscriber cleanup
    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p1', name: `Pastel POS Loop ${loop}`, quantity: 1, price: 15.00 + loop, total: 15.00 + loop }],
      total: 15.00 + loop,
      date: '2026-11-05 15:00'
    });
    totalMutations++;

    // Crucial check: POS view must NOT have been hijacked or overwritten by dashboard
    assert.notStrictEqual(container.querySelector('#tabPosBtn'), null, `Loop ${loop}: POS view must remain active after saveInvoice`);
    assert.strictEqual(container.querySelector('#trendChartSvg'), null, `Loop ${loop}: #trendChartSvg must NOT mount on POS`);
    assert.strictEqual(container._hasDashboardStoreSub, false, `Loop ${loop}: _hasDashboardStoreSub must be false after unbind`);

    // Second mutation on POS: ensure no lingering subscribers wake up
    store.saveExpense({
      amount: 5.00 + loop,
      concept: `Gasto POS Loop ${loop}`,
      category: 'Servicios',
      date: '2026-11-05'
    });
    totalMutations++;
    assert.notStrictEqual(container.querySelector('#tabPosBtn'), null, `Loop ${loop}: POS view must remain active after second mutation`);
    assert.strictEqual(container.querySelector('#trendChartSvg'), null, `Loop ${loop}: #trendChartSvg still absent`);

    // -------------------------------------------------------------------------
    // 3. ROUTE: RECIPES
    // -------------------------------------------------------------------------
    renderRecipesView(container);
    assert.notStrictEqual(container.querySelector('#recipeSearch'), null, `Loop ${loop}: Recipes #recipeSearch must be mounted`);
    assert.strictEqual(container.querySelector('#trendChartSvg'), null, `Loop ${loop}: Dashboard chart must not be in Recipes view`);

    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p2', name: `Galletas Loop ${loop}`, quantity: 2, price: 6.00, total: 12.00 }],
      total: 12.00,
      date: '2026-11-05 16:00'
    });
    totalMutations++;
    assert.notStrictEqual(container.querySelector('#recipeSearch'), null, `Loop ${loop}: Recipes view intact after invoice mutation`);
    assert.strictEqual(container.querySelector('#trendChartSvg'), null, `Loop ${loop}: #trendChartSvg still absent in Recipes`);

    // -------------------------------------------------------------------------
    // 4. ROUTE: INVENTORY
    // -------------------------------------------------------------------------
    renderInventoryView(container);
    assert.strictEqual(container.querySelector('#trendChartSvg'), null, `Loop ${loop}: Dashboard chart must not be in Inventory view`);
    assert.ok(container.innerHTML.includes('Almacén Central'), `Loop ${loop}: Inventory content mounted`);

    store.saveExpense({
      amount: 8.00 + loop,
      concept: `Gasto Harina Inv Loop ${loop}`,
      category: 'Insumos',
      date: '2026-11-05'
    });
    totalMutations++;
    assert.strictEqual(container.querySelector('#trendChartSvg'), null, `Loop ${loop}: Dashboard chart must not mount on Inventory mutation`);
    assert.ok(container.innerHTML.includes('Almacén Central'), `Loop ${loop}: Inventory content intact after mutation`);

    // -------------------------------------------------------------------------
    // Verify listener count during non-dashboard state:
    // Should be back to baseline listeners (0 dashboard listeners lingering)
    // -------------------------------------------------------------------------
    assert.strictEqual(
      store.listeners.length,
      baselineListeners,
      `Loop ${loop}: Listeners count (${store.listeners.length}) must equal baseline (${baselineListeners})`
    );

    const loopElapsed = performance.now() - loopStart;
    loopLatencies.push(loopElapsed);
  }

  const totalElapsed = performance.now() - startTime;
  const avgLoop = totalElapsed / totalLoops;
  const maxLoop = Math.max(...loopLatencies);

  // Restore console.error
  console.error = origConsoleError;

  // Final check: return to Dashboard and verify full reactivity and data aggregation
  renderDashboardView(container);
  assert.strictEqual(container._hasDashboardStoreSub, true, 'Final Dashboard return: subscription re-registered');
  assert.strictEqual(store.listeners.length, baselineListeners + 1, 'Exactly 1 active dashboard subscription');

  // Verify financial summary in DOM reflects all mutations
  const summary = store.getFinancialSummary();
  const salesEl = container.querySelector('#dashTotalSales');
  const expEl = container.querySelector('#dashTotalExpenses');
  const netEl = container.querySelector('#dashNetProfit');

  assert.ok(salesEl.innerText.includes(summary.totalSales.toFixed(2)), `Sales DOM ($${salesEl.innerText}) matches state ($${summary.totalSales.toFixed(2)})`);
  assert.ok(expEl.innerText.includes(summary.totalExpenses.toFixed(2)), `Expenses DOM ($${expEl.innerText}) matches state ($${summary.totalExpenses.toFixed(2)})`);

  // Final console errors check
  assert.strictEqual(consoleErrors.length, 0, `Expected 0 console errors, but caught ${consoleErrors.length}: ${consoleErrors.join(' | ')}`);

  console.log(`[PASS] 10 complete route cycles (40 route transitions, ${totalMutations} store mutations) executed.`);
  console.log(`       Total time: ${totalElapsed.toFixed(2)}ms | Avg per 4-route cycle: ${avgLoop.toFixed(2)}ms | Max cycle: ${maxLoop.toFixed(2)}ms`);
  console.log(`       Subscriber memory leaks: 0 detected.`);
  console.log(`       Console errors: ${consoleErrors.length} detected.`);
  console.log(`       Active view hijacking: 0 occurrences detected.`);
  console.log('\n\x1b[32m✔ EMPIRICAL VERDICT: CONFIRMED. Rapid navigation and mutation storm passed all invariants.\x1b[0m\n');
}

runAdversarialStress().catch(err => {
  console.error('\x1b[31m✖ ADVERSARIAL STRESS TEST FAILED:\x1b[0m', err);
  process.exit(1);
});
