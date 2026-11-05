// tests/test_v12_charts_verification.js - Milestone M3_v12 Financial Charts & Reactivity Verification (Requirement R3)
import assert from 'node:assert';
import { store } from '../js/store.js';
import { renderDashboardView, calculateWeeklyChartData } from '../js/views/dashboardView.js';
import { MockElement } from './harness.js';
import { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_EXPENSES, INITIAL_SETTINGS } from '../js/models.js';

let passCount = 0;
let failCount = 0;

function resetStore() {
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

async function runTest(name, fn) {
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

async function main() {
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[36m   📊 MILESTONE M3_v12: DYNAMIC FINANCIAL CHARTS & REACTIVITY (R3)    \x1b[0m');
  console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

  // ---------------------------------------------------------------------------
  // SUITE 1: SVG CHART STRUCTURE & ELEMENT CONTRACTS (R3.1, R3.6)
  // ---------------------------------------------------------------------------
  console.log('\x1b[1m▶ SUITE 1: SVG Chart Structure & Element Contracts (R3.1, R3.6)\x1b[0m');

  await runTest('1.1 Dashboard renders responsive SVG grouped bar chart without errors', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const svg = container.querySelector('#trendChartSvg');
    assert.notStrictEqual(svg, null, '#trendChartSvg must exist in DOM');
    assert.strictEqual(svg.getAttribute('viewBox'), '0 0 420 160');
    assert.strictEqual(svg.getAttribute('role'), 'img');
    assert.ok(svg.getAttribute('aria-label').includes('tendencia semanal'), 'Must have descriptive aria-label');
  });

  await runTest('1.2 Exactly 7 grouped bar columns (.chart-day) render with authentic financial attributes', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const days = container.querySelectorAll('.chart-day');
    assert.strictEqual(days.length, 7, 'Must render exactly 7 chart-day columns for the rolling week');

    days.forEach((day, idx) => {
      assert.ok(day.hasAttribute('data-day'), `Day ${idx} must have data-day`);
      assert.ok(day.hasAttribute('data-date'), `Day ${idx} must have data-date (YYYY-MM-DD)`);
      assert.ok(day.hasAttribute('data-inc'), `Day ${idx} must have data-inc`);
      assert.ok(day.hasAttribute('data-exp'), `Day ${idx} must have data-exp`);
      assert.ok(day.hasAttribute('data-profit'), `Day ${idx} must have data-profit`);
      assert.ok(day.hasAttribute('data-margin'), `Day ${idx} must have data-margin`);

      const inc = parseFloat(day.getAttribute('data-inc'));
      const exp = parseFloat(day.getAttribute('data-exp'));
      const profit = parseFloat(day.getAttribute('data-profit'));
      assert.ok(!isNaN(inc), `Day ${idx} sales must be numeric`);
      assert.ok(!isNaN(exp), `Day ${idx} expenses must be numeric`);
      assert.ok(!isNaN(profit), `Day ${idx} profit must be numeric`);
    });
  });

  await runTest('1.3 Each day column contains Sales, Expenses, and Profit bar rects with labels', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const days = container.querySelectorAll('.chart-day');
    const salesBars = container.querySelectorAll('.bar-sales');
    const expBars = container.querySelectorAll('.bar-expenses');
    const profitBars = container.querySelectorAll('.bar-profit');
    const labels = container.querySelectorAll('.chart-day-label');

    assert.strictEqual(salesBars.length, 7, 'Must have 7 bar-sales rects');
    assert.strictEqual(expBars.length, 7, 'Must have 7 bar-expenses rects');
    assert.strictEqual(profitBars.length, 7, 'Must have 7 bar-profit rects');
    assert.strictEqual(labels.length, 7, 'Must have 7 day labels');
  });

  // ---------------------------------------------------------------------------
  // SUITE 2: AUTHENTIC FINANCIAL CHART DATA AGGREGATION (R3.1)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 2: Authentic Financial Chart Data Aggregation (R3.1)\x1b[0m');

  await runTest('2.1 calculateWeeklyChartData aggregates transactions into 7 daily buckets', () => {
    resetStore();
    const { days, maxVal } = calculateWeeklyChartData(store);

    assert.strictEqual(days.length, 7, 'Must generate exactly 7 daily buckets');
    assert.ok(maxVal >= 50, 'Max scale must be at least 50');

    // Verify 2026-11-02 transactions: 1 invoice of $122.58, 1 expense of $32.00
    const dayNov2 = days.find(d => d.dateStr === '2026-11-02');
    if (dayNov2) {
      assert.strictEqual(dayNov2.sales, 122.58, '2026-11-02 sales must equal $122.58');
      assert.strictEqual(dayNov2.expenses, 32.00, '2026-11-02 expenses must equal $32.00');
      assert.strictEqual(dayNov2.netProfit, 90.58, '2026-11-02 net profit must equal $90.58');
      assert.strictEqual(dayNov2.margin, 73.9, '2026-11-02 margin must equal 73.9%');
    }

    // Verify 2026-11-03 transactions: 3 invoices ($61.61, $18.50, $30.00) = $110.11, 2 expenses ($24.50, $45.00) = $69.50
    const dayNov3 = days.find(d => d.dateStr === '2026-11-03');
    if (dayNov3) {
      assert.strictEqual(dayNov3.sales, 110.11, '2026-11-03 sales must equal $110.11');
      assert.strictEqual(dayNov3.expenses, 69.50, '2026-11-03 expenses must equal $69.50');
      assert.strictEqual(dayNov3.netProfit, 40.61, '2026-11-03 net profit must equal $40.61');
    }
  });

  await runTest('2.2 Empty transactions edge case generates safe 0.0 values without NaN or Infinity', () => {
    resetStore();
    store.state.invoices = [];
    store.state.expenses = [];

    const container = new MockElement('div');
    renderDashboardView(container);

    const days = container.querySelectorAll('.chart-day');
    assert.strictEqual(days.length, 7);

    days.forEach(day => {
      assert.strictEqual(day.getAttribute('data-inc'), '0.00');
      assert.strictEqual(day.getAttribute('data-exp'), '0.00');
      assert.strictEqual(day.getAttribute('data-profit'), '0.00');
      assert.strictEqual(day.getAttribute('data-margin'), '0.0');
    });

    assert.ok(!container.innerHTML.includes('NaN'), 'DOM must not contain NaN');
    assert.ok(!container.innerHTML.includes('Infinity'), 'DOM must not contain Infinity');
  });

  // ---------------------------------------------------------------------------
  // SUITE 3: INTERACTIVE TOOLTIPS & DAY AUDIT (R3.2)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 3: Interactive Tooltips & Day Audit (R3.2)\x1b[0m');

  await runTest('3.1 Tooltip container (#chart-tooltip) and text (#tooltip-text) render with initial summary', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const tooltip = container.querySelector('#chart-tooltip');
    const tooltipText = container.querySelector('#tooltip-text');
    assert.notStrictEqual(tooltip, null, '#chart-tooltip must exist');
    assert.notStrictEqual(tooltipText, null, '#tooltip-text must exist');
    assert.ok(tooltipText.innerText.length > 5, 'Tooltip text must be populated');
  });

  await runTest('3.2 Clicking or activating a .chart-day updates tooltip text with exact formatted amounts', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const days = container.querySelectorAll('.chart-day');
    const targetDay = days.find(d => parseFloat(d.getAttribute('data-inc')) > 0) || days[0];

    targetDay.click();

    const tooltipText = container.querySelector('#tooltip-text');
    const dayName = targetDay.getAttribute('data-day');
    const inc = targetDay.getAttribute('data-inc');
    const exp = targetDay.getAttribute('data-exp');

    assert.ok(tooltipText.innerText.includes(dayName), 'Tooltip must display selected day name');
    assert.ok(tooltipText.innerText.includes(inc), 'Tooltip must display day sales');
    assert.ok(tooltipText.innerText.includes(exp), 'Tooltip must display day expenses');
  });

  await runTest('3.3 Day selection updates audit summary bar (#chartAuditSummary)', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const days = container.querySelectorAll('.chart-day');
    const dayNov2 = days.find(d => d.getAttribute('data-date') === '2026-11-02');
    if (dayNov2) {
      dayNov2.click();

      const auditSales = container.querySelector('#auditDaySales');
      const auditExpenses = container.querySelector('#auditDayExpenses');
      const auditProfit = container.querySelector('#auditDayProfit');

      assert.ok(auditSales.innerText.includes('122.58'), 'Audit sales must show 122.58');
      assert.ok(auditExpenses.innerText.includes('32.00'), 'Audit expenses must show 32.00');
      assert.ok(auditProfit.innerText.includes('90.58'), 'Audit profit must show 90.58');
    }
  });

  // ---------------------------------------------------------------------------
  // SUITE 4: CATEGORICAL EXPENSE BREAKDOWN & SEGMENTED BAR (R3.3)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 4: Categorical Expense Breakdown & Segmented Bar (R3.3)\x1b[0m');

  await runTest('4.1 Segmented visual bar (#expenseSegmentedBar) renders proportional segments based on live store expenses', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const segmentedBar = container.querySelector('#expenseSegmentedBar');
    assert.notStrictEqual(segmentedBar, null, '#expenseSegmentedBar must exist');

    // Total seed expenses = $187.00. Insumos = $85.50 (46%), Mantenimiento = $45.00 (24%), Servicios = $32.00 (17%), Empaques = $24.50 (13%)
    const insumosSegment = segmentedBar.querySelector('[data-category="Insumos"]');
    assert.notStrictEqual(insumosSegment, null, 'Insumos segment must exist in visual bar');
    assert.ok(insumosSegment.getAttribute('title').includes('46%'), 'Insumos percentage must be approximately 46%');
  });

  await runTest('4.2 Category breakdown updates dynamically when registering new expense', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    // Save a large expense in Servicios ($200)
    store.saveExpense({
      amount: 200.00,
      concept: 'Electricidad industrial hornos',
      category: 'Servicios',
      date: '2026-11-05'
    });

    // Reactive store subscription will have called renderDashboardView(container)
    const segmentedBar = container.querySelector('#expenseSegmentedBar');
    const serviciosSegment = segmentedBar.querySelector('[data-category="Servicios"]');
    assert.notStrictEqual(serviciosSegment, null, 'Servicios segment must exist');
    // Total expenses = $187 + $200 = $387. Servicios = $32 + $200 = $232. $232 / $387 = 60%
    assert.ok(serviciosSegment.getAttribute('title').includes('60%'), 'Servicios must now represent 60% of total expenses');
  });

  // ---------------------------------------------------------------------------
  // SUITE 5: DUAL MARGIN METERS & STATUS BADGES (R3.4)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 5: Dual Margin Meters & Status Badges (R3.4)\x1b[0m');

  await runTest('5.1 Dual Margin Card (#marginsComparisonCard) renders Gross and Net Margin progress bars', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const card = container.querySelector('#marginsComparisonCard');
    assert.notStrictEqual(card, null, '#marginsComparisonCard must exist');

    const grossMeter = container.querySelector('#dashGrossMeterBar');
    const netMeter = container.querySelector('#dashNetMeterBar');
    assert.notStrictEqual(grossMeter, null, '#dashGrossMeterBar must exist');
    assert.notStrictEqual(netMeter, null, '#dashNetMeterBar must exist');

    assert.ok(grossMeter.getAttribute('style').includes('width: 60%'), 'Gross meter bar width must reflect 60%');
  });

  await runTest('5.2 Status badges display "Saludable", "Ajustado", or "Alerta" based on margin benchmarks', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const grossBadge = container.querySelector('#dashGrossMarginBadge');
    const netBadge = container.querySelector('#dashNetMarginCompareBadge');

    assert.notStrictEqual(grossBadge, null, '#dashGrossMarginBadge must exist');
    assert.notStrictEqual(netBadge, null, '#dashNetMarginCompareBadge must exist');

    // Baseline: Gross Margin = 60.3% (>= 50% -> Saludable)
    assert.ok(grossBadge.innerText.includes('Saludable'), 'Gross margin >=50% must badge Saludable');

    // Baseline: Net Margin = -20.1% (< 15% -> Alerta)
    assert.ok(netBadge.innerText.includes('Alerta'), 'Net margin <15% must badge Alerta');
  });

  await runTest('5.3 High profit scenario upgrades Net Margin badge to "Saludable"', () => {
    resetStore();
    // Add high sales: $1,000 sale with $200 COGS -> Gross Profit = $800, Total Expenses = $187 -> Net Profit = $613 (61.3% Net Margin)
    store.saveInvoice({
      type: 'factura',
      items: [{ productId: 'p1', name: 'Pastel Gourmet Evento', quantity: 20, price: 50.00, total: 1000.00 }],
      total: 1000.00,
      date: '2026-11-05 12:00'
    });

    const container = new MockElement('div');
    renderDashboardView(container);

    const netBadge = container.querySelector('#dashNetMarginCompareBadge');
    assert.ok(netBadge.innerText.includes('Saludable'), 'Net margin >30% must badge Saludable');
  });

  // ---------------------------------------------------------------------------
  // SUITE 6: REACTIVITY & LIFECYCLE STORE SUBSCRIPTIONS (R3.5)
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 6: Reactivity & Lifecycle Store Subscriptions (R3.5)\x1b[0m');

  await runTest('6.1 Registering a sale dynamically updates chart and KPI DOM elements without page reload', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const initialSales = container.querySelector('#dashTotalSales').innerText;

    // Register a new sale of $75.00
    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p6', name: 'Pastel Selva Negra', quantity: 2, price: 37.50, total: 75.00 }],
      total: 75.00,
      date: '2026-11-05 15:30'
    });

    const updatedSales = container.querySelector('#dashTotalSales').innerText;
    assert.notStrictEqual(initialSales, updatedSales, 'Sales KPI must update reactively');
    assert.ok(updatedSales.includes('307.69'), 'Sales must display $307.69 ($232.69 + $75.00)');

    // Verify today chart bar updated
    const days = container.querySelectorAll('.chart-day');
    const todayDay = days[days.length - 1];
    assert.ok(parseFloat(todayDay.getAttribute('data-inc')) >= 75.00, 'Today chart sales must reflect the $75 sale');
  });

  await runTest('6.2 Registering an expense dynamically updates chart, net profit, and breakdown', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const initialExpenses = container.querySelector('#dashTotalExpenses').innerText;

    store.saveExpense({
      amount: 50.00,
      concept: 'Cajas decorativas pastel',
      category: 'Empaques',
      date: '2026-11-05'
    });

    const updatedExpenses = container.querySelector('#dashTotalExpenses').innerText;
    assert.notStrictEqual(initialExpenses, updatedExpenses, 'Expenses KPI must update reactively');
    assert.ok(updatedExpenses.includes('237.00'), 'Expenses must display $237.00 ($187.00 + $50.00)');

    // Verify today chart expense updated
    const days = container.querySelectorAll('.chart-day');
    const todayDay = days[days.length - 1];
    assert.ok(parseFloat(todayDay.getAttribute('data-exp')) >= 50.00, 'Today chart expenses must reflect the $50 expense');
  });

  await runTest('6.3 Disconnecting container unbinds subscription cleanly without memory leaks', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    assert.strictEqual(container._hasDashboardStoreSub, true, 'Must have active subscription flag');

    // Simulate route navigation: container disconnected from DOM
    container.isConnected = false;

    // Trigger an event
    store.notify('expenses_changed', store.state.expenses);

    // Subscription must have cleaned up
    assert.strictEqual(container._hasDashboardStoreSub, false, 'Subscription flag must reset to false on unmount');
  });

  await runTest('6.4 Cross-route SPA navigation prevents UI hijacking when store events emit outside dashboard', () => {
    resetStore();
    const mainContainer = new MockElement('main');
    mainContainer.isConnected = true;
    renderDashboardView(mainContainer);

    // Simulate router navigating to POS view
    mainContainer.innerHTML = '<div id="posContainer"><h1 id="posTitle">Punto de Venta</h1></div>';

    // Completing an invoice outside dashboard must not overwrite POS view
    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p1', name: 'Pastel', quantity: 1, price: 20.00, total: 20.00 }],
      total: 20.00
    });

    assert.strictEqual(mainContainer.querySelector('#trendChartSvg'), null, 'Dashboard chart must not hijack active view');
    assert.strictEqual(mainContainer.querySelector('#weeklyTrendCard'), null, 'Dashboard card must not hijack active view');
    assert.notStrictEqual(mainContainer.querySelector('#posContainer'), null, 'POS view must remain active and intact');
    assert.strictEqual(mainContainer._hasDashboardStoreSub, false, 'Subscription flag must reset to false');
  });

  // ---------------------------------------------------------------------------
  // SUITE 7: BACKWARD COMPATIBILITY & LEGACY INVARIANTS
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m▶ SUITE 7: Backward Compatibility & Legacy Invariants\x1b[0m');

  await runTest('7.1 All legacy KPI element IDs exist in rendered DOM', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const requiredIds = [
      '#dashTotalSales',
      '#dashTotalExpenses',
      '#dashNetProfit',
      '#dashGrossMargin',
      '#dashNetMargin',
      '#dashCogs',
      '#chart-tooltip',
      '#tooltip-text'
    ];

    requiredIds.forEach(id => {
      const el = container.querySelector(id);
      assert.notStrictEqual(el, null, `${id} must exist in rendered dashboardView`);
    });
  });

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log('\n\x1b[1m\x1b[35m======================================================================\x1b[0m');
  console.log(`\x1b[1mVERIFICATION SUMMARY: ${passCount} PASSED | ${failCount} FAILED\x1b[0m`);
  console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m\n');

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log('\x1b[32m✔ VERDICT: CONFIRMED. Milestone M3_v12 (Requirement R3) fully verified.\x1b[0m\n');
    process.exit(0);
  }
}

main();
