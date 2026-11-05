// tests/test_m3_adversarial_challenger2.js
// EMPIRICAL ADVERSARIAL CHALLENGER 2: MILESTONE M3_v12 DYNAMIC FINANCIAL CHARTS & REACTIVITY (R3)
// Stress-tests:
// 1. High mutation burst (25 rapid sales & expenses, re-render latency, DOM stability, zero exceptions)
// 2. Dual margin meter stress (Saludable, Ajustado, Alerta badges across positive, zero, and negative margins)
// 3. Categorical distribution stress (0 expenses empty state, 1 category 100%, all categories equal, unknown categories)
// 4. Unbind & memory safety (container.isConnected = false, listener leak prevention across mount/unmount cycles)
// 5. SVG coordinate bounds & extreme scale stress

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
import { renderDashboardView, calculateWeeklyChartData } from '../js/views/dashboardView.js';
import { setupGlobalEnv, MockElement } from './harness.js';

// Activate headless browser & storage mocks
setupGlobalEnv();

console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m');
console.log('\x1b[1m\x1b[35m   🥊 ADVERSARIAL CHALLENGER 2: M3_v12 DYNAMIC CHARTS & REACTIVITY   \x1b[0m');
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

async function main() {
  // ---------------------------------------------------------------------------
  // SUITE 1: HIGH MUTATION BURST & RE-RENDERING LATENCY STRESS
  // ---------------------------------------------------------------------------
  console.log('\x1b[1m▶ SUITE 1: High Mutation Burst (25 Rapid Operations) & Latency Benchmark\x1b[0m');

  await runStep('1.1 Execute 25 rapid interleaved expense additions and sales creations with measured latency', () => {
    resetCleanStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const categories = ['Insumos', 'Servicios', 'Empaques', 'Mano de Obra', 'Mantenimiento', 'Otros'];
    const mutationTimes = [];

    const tStart = performance.now();

    for (let i = 1; i <= 25; i++) {
      const stepStart = performance.now();
      if (i % 2 === 1) {
        // Add expense (13 operations total)
        store.saveExpense({
          amount: 10.00 + i,
          concept: `Burst Gasto #${i}`,
          category: categories[(i - 1) % categories.length],
          date: '2026-11-05'
        });
      } else {
        // Add sale / invoice (12 operations total)
        store.saveInvoice({
          type: 'ticket',
          items: [
            { productId: 'p1', name: 'Pastel Gourmet Evento', quantity: 1, price: 25.00 + i, total: 25.00 + i }
          ],
          total: 25.00 + i,
          date: '2026-11-05 14:00'
        });
      }
      mutationTimes.push(performance.now() - stepStart);
    }

    const tTotal = performance.now() - tStart;
    const avgLatency = tTotal / 25;
    const maxLatency = Math.max(...mutationTimes);

    console.log(`    ↳ 25 reactive mutations executed in ${tTotal.toFixed(2)}ms (Avg: ${avgLatency.toFixed(2)}ms/op, Max: ${maxLatency.toFixed(2)}ms)`);

    // Latency assertion: 25 full DOM updates must complete comfortably in <500ms (typically ~50-150ms)
    assert.ok(tTotal < 500.0, `25 mutations took ${tTotal.toFixed(2)}ms, exceeding 500ms limit`);

    // Verify DOM stability after burst
    const svg = container.querySelector('#trendChartSvg');
    assert.notStrictEqual(svg, null, '#trendChartSvg must remain in DOM after burst');
    assert.strictEqual(container.querySelectorAll('.chart-day').length, 7, 'Must have 7 .chart-day elements');
    assert.strictEqual(container.querySelectorAll('.bar-sales').length, 7, 'Must have 7 .bar-sales elements');
    assert.strictEqual(container.querySelectorAll('.bar-expenses').length, 7, 'Must have 7 .bar-expenses elements');
    assert.strictEqual(container.querySelectorAll('.bar-profit').length, 7, 'Must have 7 .bar-profit elements');

    // Verify tooltips and audit summary stability
    assert.notStrictEqual(container.querySelector('#chart-tooltip'), null, '#chart-tooltip must exist');
    assert.notStrictEqual(container.querySelector('#chartAuditSummary'), null, '#chartAuditSummary must exist');
    assert.notStrictEqual(container.querySelector('#expenseSegmentedBar'), null, '#expenseSegmentedBar must exist');

    // Verify financial metrics in DOM match live store state
    const finalSummary = store.getFinancialSummary();
    const salesEl = container.querySelector('#dashTotalSales');
    const expEl = container.querySelector('#dashTotalExpenses');
    const netEl = container.querySelector('#dashNetProfit');

    assert.ok(salesEl.innerText.includes(finalSummary.totalSales.toFixed(2)), `Sales DOM ($${salesEl.innerText}) must match summary ($${finalSummary.totalSales.toFixed(2)})`);
    assert.ok(expEl.innerText.includes(finalSummary.totalExpenses.toFixed(2)), `Expenses DOM ($${expEl.innerText}) must match summary ($${finalSummary.totalExpenses.toFixed(2)})`);
    assert.ok(netEl.innerText.includes(Math.abs(finalSummary.netProfit).toFixed(2)), `Net Profit DOM ($${netEl.innerText}) must match summary ($${finalSummary.netProfit.toFixed(2)})`);

    // Verify zero unhandled NaN or Infinity in rendered HTML
    assert.ok(!container.innerHTML.includes('NaN'), 'DOM must not contain NaN');
    assert.ok(!container.innerHTML.includes('Infinity'), 'DOM must not contain Infinity');
  });

  // ---------------------------------------------------------------------------
  // SUITE 2: DUAL MARGIN METER STRESS (THRESHOLDS & EDGE CONDITIONS)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 2: Dual Margin Meter Stress: Badges & Extreme Conditions\x1b[0m');

  await runStep('2.1 High positive margin scenario triggers "Saludable" status badges on Gross (≥50%) & Net (≥30%)', () => {
    resetCleanStore();
    // High profit sale: Product cost = $20, Sale = $100 -> Gross Margin = 80%, Expenses = $10 -> Net Margin = 70%
    store.state.products = [{ id: 'prod_high', name: 'Pastel VIP', price: 100.00, cost: 20.00 }];
    store.state.invoices = [{
      id: 'INV-TEST-HIGH',
      total: 100.00,
      items: [{ productId: 'prod_high', quantity: 1, price: 100.00 }],
      date: '2026-11-05 10:00'
    }];
    store.state.expenses = [{
      id: 'EXP-TEST-1',
      amount: 10.00,
      category: 'Insumos',
      concept: 'Insumos base',
      date: '2026-11-05'
    }];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const grossBadge = container.querySelector('#dashGrossMarginBadge');
    const netBadge = container.querySelector('#dashNetMarginCompareBadge');
    const grossMeter = container.querySelector('#dashGrossMeterBar');
    const netMeter = container.querySelector('#dashNetMeterBar');

    assert.ok(grossBadge.innerText.includes('Saludable'), `Gross badge must be Saludable (got ${grossBadge.innerText})`);
    assert.ok(grossBadge.getAttribute('class').includes('bg-emerald-100'), 'Gross badge must use emerald style');
    assert.ok(netBadge.innerText.includes('Saludable'), `Net badge must be Saludable (got ${netBadge.innerText})`);
    assert.ok(netBadge.getAttribute('class').includes('bg-emerald-100'), 'Net badge must use emerald style');

    assert.ok(grossMeter.getAttribute('style').includes('width: 80%'), 'Gross meter bar width must be 80%');
    assert.ok(netMeter.getAttribute('style').includes('width: 70%'), 'Net meter bar width must be 70%');
  });

  await runStep('2.2 Moderate positive margin scenario triggers "Ajustado" badges on Gross (30-49%) & Net (15-29%)', () => {
    resetCleanStore();
    // Sales $100, COGS $60 (Gross Margin = 40.0% -> Ajustado)
    // Operating Expenses = $18 -> Net Profit = $22 (Net Margin = 22.0% -> Ajustado)
    store.state.products = [{ id: 'prod_mod', name: 'Pastel Mod', price: 100.00, cost: 60.00 }];
    store.state.invoices = [{
      id: 'INV-TEST-MOD',
      total: 100.00,
      items: [{ productId: 'prod_mod', quantity: 1, price: 100.00 }],
      date: '2026-11-05 10:00'
    }];
    store.state.expenses = [{
      id: 'EXP-TEST-MOD',
      amount: 18.00,
      category: 'Servicios',
      concept: 'Gas y luz',
      date: '2026-11-05'
    }];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const grossBadge = container.querySelector('#dashGrossMarginBadge');
    const netBadge = container.querySelector('#dashNetMarginCompareBadge');
    const grossMeter = container.querySelector('#dashGrossMeterBar');
    const netMeter = container.querySelector('#dashNetMeterBar');

    assert.ok(grossBadge.innerText.includes('Ajustado'), `Gross badge must be Ajustado (got ${grossBadge.innerText})`);
    assert.ok(grossBadge.getAttribute('class').includes('bg-amber-100'), 'Gross badge must use amber style');
    assert.ok(netBadge.innerText.includes('Ajustado'), `Net badge must be Ajustado (got ${netBadge.innerText})`);
    assert.ok(netBadge.getAttribute('class').includes('bg-amber-100'), 'Net badge must use amber style');

    assert.ok(grossMeter.getAttribute('style').includes('width: 40%'), 'Gross meter bar width must be 40%');
    assert.ok(netMeter.getAttribute('style').includes('width: 22%'), 'Net meter bar width must be 22%');
  });

  await runStep('2.3 Low positive margin scenario triggers "Alerta" badges on Gross (<30%) & Net (<15%)', () => {
    resetCleanStore();
    // Sales $100, COGS $75 -> Gross Profit = $25 (Gross Margin = 25.0% -> Alerta)
    // Operating Expenses = $15 -> Net Profit = $10 (Net Margin = 10.0% -> Alerta)
    store.state.products = [{ id: 'prod_low', name: 'Pastel Low', price: 100.00, cost: 75.00 }];
    store.state.invoices = [{
      id: 'INV-TEST-LOW',
      total: 100.00,
      items: [{ productId: 'prod_low', quantity: 1, price: 100.00 }],
      date: '2026-11-05 10:00'
    }];
    store.state.expenses = [{
      id: 'EXP-TEST-LOW',
      amount: 15.00,
      category: 'Empaques',
      concept: 'Cajas importadas',
      date: '2026-11-05'
    }];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const grossBadge = container.querySelector('#dashGrossMarginBadge');
    const netBadge = container.querySelector('#dashNetMarginCompareBadge');
    const grossMeter = container.querySelector('#dashGrossMeterBar');
    const netMeter = container.querySelector('#dashNetMeterBar');

    assert.ok(grossBadge.innerText.includes('Alerta'), `Gross badge must be Alerta (got ${grossBadge.innerText})`);
    assert.ok(grossBadge.getAttribute('class').includes('bg-rose-100'), 'Gross badge must use rose/red style');
    assert.ok(netBadge.innerText.includes('Alerta'), `Net badge must be Alerta (got ${netBadge.innerText})`);
    assert.ok(netBadge.getAttribute('class').includes('bg-rose-100'), 'Net badge must use rose/red style');

    assert.ok(grossMeter.getAttribute('style').includes('width: 25%'), 'Gross meter width must be 25%');
    assert.ok(netMeter.getAttribute('style').includes('width: 10%'), 'Net meter width must be 10%');
  });

  await runStep('2.4 Zero margin & zero sales boundary condition renders 0% meters with "Alerta" and zero NaN', () => {
    resetCleanStore();
    store.state.invoices = [];
    store.state.expenses = [];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const grossBadge = container.querySelector('#dashGrossMarginBadge');
    const netBadge = container.querySelector('#dashNetMarginCompareBadge');
    const grossMeter = container.querySelector('#dashGrossMeterBar');
    const netMeter = container.querySelector('#dashNetMeterBar');

    assert.ok(grossBadge.innerText.includes('Alerta'), '0% gross margin must badge Alerta');
    assert.ok(netBadge.innerText.includes('Alerta'), '0% net margin must badge Alerta');
    assert.ok(grossMeter.getAttribute('style').includes('width: 0%'), 'Gross meter bar width must be 0%');
    assert.ok(netMeter.getAttribute('style').includes('width: 0%'), 'Net meter bar width must be 0%');

    assert.ok(!container.innerHTML.includes('NaN'), 'Zero sales must not generate NaN');
    assert.ok(!container.innerHTML.includes('Infinity'), 'Zero sales must not generate Infinity');
  });

  await runStep('2.5 Negative net margin condition (operating loss) clamps meter bar width to 0% with "Alerta" and minus sign', () => {
    resetCleanStore();
    // Sales $100, COGS $40 (Gross Margin = 60.0% -> Saludable)
    // Operating Expenses = $160 -> Net Profit = -$100 (Net Margin = -100.0% -> Alerta)
    store.state.products = [{ id: 'prod_loss', name: 'Pastel Loss', price: 100.00, cost: 40.00 }];
    store.state.invoices = [{
      id: 'INV-TEST-LOSS',
      total: 100.00,
      items: [{ productId: 'prod_loss', quantity: 1, price: 100.00 }],
      date: '2026-11-05 10:00'
    }];
    store.state.expenses = [{
      id: 'EXP-TEST-LOSS',
      amount: 160.00,
      category: 'Servicios',
      concept: 'Reparación horno industrial',
      date: '2026-11-05'
    }];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const grossBadge = container.querySelector('#dashGrossMarginBadge');
    const netBadge = container.querySelector('#dashNetMarginCompareBadge');
    const netMeter = container.querySelector('#dashNetMeterBar');
    const netCompareText = container.querySelector('#dashNetMarginCompare');

    assert.ok(grossBadge.innerText.includes('Saludable'), 'Gross badge remains Saludable at 60%');
    assert.ok(netBadge.innerText.includes('Alerta'), 'Net badge must be Alerta for negative profit');
    assert.ok(netCompareText.innerText.includes('-100.0%'), `Net margin text must show negative percentage (got: ${netCompareText.innerText})`);
    assert.ok(netMeter.getAttribute('style').includes('width: 0%'), 'Negative net margin meter width must clamp to 0%');
    assert.ok(netMeter.getAttribute('class').includes('bg-tertiary'), 'Negative net margin meter must use tertiary warning color');
  });

  await runStep('2.6 Severely negative gross margin (COGS exceeds Sales) clamps both meters to 0% safely', () => {
    resetCleanStore();
    // Sales $100, COGS $300 -> Gross Margin = -200%
    // Operating Expenses = $50 -> Net Margin = -250%
    store.state.products = [{ id: 'prod_neg', name: 'Pastel Neg', price: 100.00, cost: 300.00 }];
    store.state.invoices = [{
      id: 'INV-TEST-NEG-GROSS',
      total: 100.00,
      items: [{ productId: 'prod_neg', quantity: 1, price: 100.00 }],
      date: '2026-11-05 10:00'
    }];
    store.state.expenses = [{
      id: 'EXP-TEST-NEG',
      amount: 50.00,
      category: 'Otros',
      concept: 'Multa',
      date: '2026-11-05'
    }];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const grossBadge = container.querySelector('#dashGrossMarginBadge');
    const netBadge = container.querySelector('#dashNetMarginCompareBadge');
    const grossMeter = container.querySelector('#dashGrossMeterBar');
    const netMeter = container.querySelector('#dashNetMeterBar');

    assert.ok(grossBadge.innerText.includes('Alerta'), 'Negative gross margin must badge Alerta');
    assert.ok(netBadge.innerText.includes('Alerta'), 'Negative net margin must badge Alerta');
    assert.ok(grossMeter.getAttribute('style').includes('width: 0%'), 'Gross meter bar width must clamp to 0%');
    assert.ok(netMeter.getAttribute('style').includes('width: 0%'), 'Net meter bar width must clamp to 0%');
  });

  // ---------------------------------------------------------------------------
  // SUITE 3: CATEGORICAL DISTRIBUTION STRESS
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 3: Categorical Distribution Stress (Progress Bar & Legend)\x1b[0m');

  await runStep('3.1 Zero expenses (empty state) renders fallback text placeholder and 0% legends without NaN', () => {
    resetCleanStore();
    store.state.invoices = [];
    store.state.expenses = [];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const segmentedBar = container.querySelector('#expenseSegmentedBar');
    assert.notStrictEqual(segmentedBar, null, '#expenseSegmentedBar must exist');
    assert.ok(segmentedBar.innerHTML.includes('Sin gastos registrados'), 'Must render empty state message in segmented bar');

    // Segments with percent > 0 must not exist
    const categorySpans = segmentedBar.querySelectorAll('[data-category]');
    assert.strictEqual(categorySpans.length, 0, 'No category segments should render when expenses are 0');

    assert.ok(!container.innerHTML.includes('NaN'), 'Empty breakdown must not generate NaN');
  });

  await runStep('3.2 Single category dominating (100%) renders exactly 1 segment with width: 100%', () => {
    resetCleanStore();
    // Only 1 expense in Insumos
    store.state.expenses = [{
      id: 'EXP-DOMINANT',
      amount: 450.00,
      category: 'Insumos',
      concept: 'Harina a granel 100kg',
      date: '2026-11-05'
    }];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const segmentedBar = container.querySelector('#expenseSegmentedBar');
    const insumosSpan = segmentedBar.querySelector('[data-category="Insumos"]');

    assert.notStrictEqual(insumosSpan, null, 'Insumos segment must exist');
    assert.ok(insumosSpan.getAttribute('style').includes('width: 100%'), `Insumos width must be 100% (got ${insumosSpan.getAttribute('style')})`);
    assert.ok(insumosSpan.getAttribute('title').includes('100%'), 'Insumos title must indicate 100%');

    // No other category spans should be rendered in the segmented bar
    const allSegments = segmentedBar.querySelectorAll('[data-category]');
    assert.strictEqual(allSegments.length, 1, 'Only 1 segment must render for 100% single category');
  });

  await runStep('3.3 Uniform distribution (all 6 categories equal at $100 each) renders 6 segments with 17% each', () => {
    resetCleanStore();
    const categories = ['Insumos', 'Servicios', 'Empaques', 'Mano de Obra', 'Mantenimiento', 'Otros'];
    store.state.expenses = categories.map((cat, idx) => ({
      id: `EXP-UNI-${idx}`,
      amount: 100.00,
      category: cat,
      concept: `Gasto uniforme de ${cat}`,
      date: '2026-11-05'
    }));

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const segmentedBar = container.querySelector('#expenseSegmentedBar');
    const segments = segmentedBar.querySelectorAll('[data-category]');

    assert.strictEqual(segments.length, 6, 'Must render exactly 6 category segments');

    categories.forEach(cat => {
      const seg = segmentedBar.querySelector(`[data-category="${cat}"]`);
      assert.notStrictEqual(seg, null, `Segment for ${cat} must exist`);
      // 100 / 600 = 16.666% -> Math.round gives 17%
      assert.ok(seg.getAttribute('style').includes('width: 17%'), `${cat} width must be 17% (got ${seg.getAttribute('style')})`);
      assert.ok(seg.getAttribute('title').includes('17%'), `${cat} title must show 17%`);
    });
  });

  await runStep('3.4 Unknown category spillover aggregates into "Otros" safely without throwing exceptions', () => {
    resetCleanStore();
    store.state.expenses = [
      { id: 'EXP-KNOWN', amount: 100.00, category: 'Insumos', concept: 'Insumo', date: '2026-11-05' },
      { id: 'EXP-UNKNOWN-1', amount: 50.00, category: 'Impuestos Municipales', concept: 'Tasa local', date: '2026-11-05' },
      { id: 'EXP-UNKNOWN-2', amount: 50.00, category: 'Marketing Digital', concept: 'Pauta Instagram', date: '2026-11-05' }
    ];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const segmentedBar = container.querySelector('#expenseSegmentedBar');
    const insumosSeg = segmentedBar.querySelector('[data-category="Insumos"]');
    const otrosSeg = segmentedBar.querySelector('[data-category="Otros"]');

    assert.notStrictEqual(insumosSeg, null, 'Insumos segment must exist');
    assert.notStrictEqual(otrosSeg, null, 'Otros segment must exist and absorb unknown categories');

    // Total = $200. Insumos = $100 (50%). Otros = $100 ($50 + $50) (50%).
    assert.ok(insumosSeg.getAttribute('style').includes('width: 50%'), 'Insumos must be 50%');
    assert.ok(otrosSeg.getAttribute('style').includes('width: 50%'), 'Otros must absorb unknown categories and be 50%');
  });

  // ---------------------------------------------------------------------------
  // SUITE 4: UNBIND, DISCONNECT & MEMORY SAFETY STRESS
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 4: Unbind, Disconnect & Memory Safety Stress\x1b[0m');

  await runStep('4.1 Disconnecting container unbinds subscription immediately upon store event emission', () => {
    resetCleanStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    assert.strictEqual(container._hasDashboardStoreSub, true, 'Active subscription flag must be set');
    const listenerCountBefore = store.listeners.length;
    assert.ok(listenerCountBefore >= 1, 'Store must have at least 1 listener');

    // Simulate route change: container disconnected from DOM
    container.isConnected = false;

    // Fire store event
    store.notify('expenses_changed', store.state.expenses);

    // Verify unbind occurred
    assert.strictEqual(container._hasDashboardStoreSub, false, 'Subscription flag must be cleared on disconnect');
    assert.strictEqual(store.listeners.length, listenerCountBefore - 1, 'Listener must be removed from store.listeners');
  });

  await runStep('4.2 50 rapid store event emissions while disconnected execute stably with zero memory leaks', () => {
    resetCleanStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    container.isConnected = false;
    // First event cleans up
    store.notify('expenses_changed', store.state.expenses);

    const baseListeners = store.listeners.length;

    // Storm 50 rapid events
    for (let i = 0; i < 50; i++) {
      store.notify('invoices_changed');
      store.notify('expenses_changed');
      store.notify('state_reloaded');
    }

    assert.strictEqual(store.listeners.length, baseListeners, 'Listener count must stay constant during event storm');
  });

  await runStep('4.3 15 mount/unmount navigation cycles do not accumulate zombie listeners', () => {
    resetCleanStore();
    const baseCount = store.listeners.length;

    for (let cycle = 1; cycle <= 15; cycle++) {
      const container = new MockElement('div');
      container.isConnected = true;
      renderDashboardView(container);

      assert.strictEqual(store.listeners.length, baseCount + 1, `Cycle ${cycle}: listener registered`);

      // Disconnect and fire event to unbind
      container.isConnected = false;
      store.notify('expenses_changed');

      assert.strictEqual(store.listeners.length, baseCount, `Cycle ${cycle}: listener cleaned up cleanly`);
    }

    assert.strictEqual(store.listeners.length, baseCount, 'Final listener count must equal initial baseline');
  });

  await runStep('4.4 Reconnecting and remounting restores reactivity seamlessly', () => {
    resetCleanStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    // Disconnect
    container.isConnected = false;
    store.notify('expenses_changed');
    assert.strictEqual(container._hasDashboardStoreSub, false);

    // Reconnect & Remount
    container.isConnected = true;
    renderDashboardView(container);
    assert.strictEqual(container._hasDashboardStoreSub, true, 'Subscription flag restored');

    // Mutate state & verify reactive render
    store.saveExpense({
      amount: 99.99,
      concept: 'Re-mount test expense',
      category: 'Servicios',
      date: '2026-11-05'
    });

    const expEl = container.querySelector('#dashTotalExpenses');
    assert.ok(expEl.innerText.includes('286.99'), 'Dashboard must update reactively after remount');
  });

  // ---------------------------------------------------------------------------
  // SUITE 5: SVG COORDINATE & AXIS CLIPPING BOUNDS STRESS
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 5: SVG Coordinate & Axis Clipping Bounds Stress\x1b[0m');

  await runStep('5.1 Daily net loss in 7-day SVG chart switches profit bar fill to red (#ef4444) and clamps bar height', () => {
    resetCleanStore();
    // Today has 0 sales and $250 expenses -> net profit = -$250
    const today = new Date().toISOString().slice(0, 10);
    store.state.invoices = [];
    store.state.expenses = [{
      id: 'EXP-TODAY-LOSS',
      amount: 250.00,
      category: 'Insumos',
      concept: 'Pérdida neta del día',
      date: today
    }];

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const days = container.querySelectorAll('.chart-day');
    const todayDay = days[days.length - 1];
    assert.notStrictEqual(todayDay, null, 'Today column must exist');

    const profitBar = todayDay.querySelector('.bar-profit');
    assert.notStrictEqual(profitBar, null, 'Profit bar must exist');

    // Fill must be red (#ef4444) for loss
    assert.strictEqual(profitBar.getAttribute('fill'), '#ef4444', 'Loss profit bar must have red fill (#ef4444)');

    // Height must be positive and bounded (clamped to at most 15px below baseline)
    const h = parseInt(profitBar.getAttribute('height'), 10);
    assert.ok(h > 0 && h <= 15, `Loss bar height must be between 1 and 15 (got ${h})`);
    assert.strictEqual(profitBar.getAttribute('y'), '125', 'Loss bar y must start at baseline 125');
  });

  await runStep('5.2 Extreme scale ($5,000,000 transaction) calculates dynamic maxVal and maintains SVG bounds', () => {
    resetCleanStore();
    const today = new Date().toISOString().slice(0, 10);
    store.state.invoices = [{
      id: 'INV-MEGA',
      total: 5000000.00,
      cogs: 1000000.00,
      date: `${today} 12:00`
    }];

    const { maxVal, days } = calculateWeeklyChartData(store);
    assert.ok(maxVal >= 5000000, `maxVal must scale to at least 5000000 (got ${maxVal})`);

    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const svg = container.querySelector('#trendChartSvg');
    assert.notStrictEqual(svg, null);

    const salesBars = container.querySelectorAll('.bar-sales');
    salesBars.forEach(bar => {
      const h = parseInt(bar.getAttribute('height'), 10);
      assert.ok(h >= 0 && h <= 105, `Bar height must never exceed 105px (got ${h})`);
    });

    assert.ok(!container.innerHTML.includes('NaN'), 'Mega scale must not produce NaN');
  });

  await runStep('5.3 Interactive day selection correctly updates tooltips and audit summary on user clicks', () => {
    resetCleanStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const days = container.querySelectorAll('.chart-day');
    assert.strictEqual(days.length, 7);

    // Select the first day
    const firstDay = days[0];
    firstDay.click();

    const tooltipText = container.querySelector('#tooltip-text');
    const auditDetail = container.querySelector('#chartActiveDayDetail');
    const dayName = firstDay.getAttribute('data-day');

    assert.ok(tooltipText.innerText.includes(dayName), `Tooltip must show day name ${dayName}`);
    assert.ok(auditDetail.innerText.includes(dayName), `Audit detail must show day name ${dayName}`);
  });

  // ---------------------------------------------------------------------------
  // SUMMARY & VERDICT
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[35m======================================================================\x1b[0m');
  console.log(`\x1b[1mADVERSARIAL STRESS SUMMARY: ${passCount} PASSED | ${failCount} FAILED\x1b[0m`);
  console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m\n');

  if (failCount > 0) {
    console.error('\x1b[31mFAILURES DETECTED:\x1b[0m');
    failureDetails.forEach(f => console.error(` - ${f.name}: ${f.error}`));
    process.exit(1);
  } else {
    console.log('\x1b[32m✔ VERDICT: CONFIRMED. Milestone M3_v12 (Requirement R3) fully verified under adversarial stress.\x1b[0m\n');
    process.exit(0);
  }
}

main();
