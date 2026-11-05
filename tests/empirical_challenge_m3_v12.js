// tests/empirical_challenge_m3_v12.js - Milestone M3_v12 Empirical Challenger Harness (Requirement R3)
// Rigorous adversarial stress testing of dynamic financial charts, SVG geometry, reactivity, tooltips, and edge cases.
import assert from 'node:assert';
import { store } from '../js/store.js';
import { renderDashboardView, calculateWeeklyChartData } from '../js/views/dashboardView.js';
import { MockElement } from './harness.js';
import { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_EXPENSES, INITIAL_SETTINGS } from '../js/models.js';

let passed = 0;
let failed = 0;
const failureDetails = [];

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

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
  } catch (err) {
    failed++;
    failureDetails.push({ name, error: err.stack || err.message });
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(err);
  }
}

async function runAllChallenges() {
  console.log('\x1b[1m\x1b[33m======================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[33m   ⚔️ EMPIRICAL CHALLENGER M3_v12: DYNAMIC CHARTS & REACTIVITY (R3)   \x1b[0m');
  console.log('\x1b[1m\x1b[33m======================================================================\x1b[0m\n');

  // ===========================================================================
  // CHALLENGE 1: CALCULATION ACCURACY & AGGREGATION MATHEMATICS
  // ===========================================================================
  console.log('\x1b[1m▶ CHALLENGE 1: Calculation Accuracy & Aggregation Mathematics\x1b[0m');

  await test('1.1 Rolling 7-day calendar window generates exactly 7 sequential days ending at anchor', () => {
    resetStore();
    const { days } = calculateWeeklyChartData(store);
    assert.strictEqual(days.length, 7, 'Must generate exactly 7 calendar buckets');

    for (let i = 0; i < days.length; i++) {
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(days[i].dateStr), `Day ${i} dateStr must be YYYY-MM-DD`);
      assert.strictEqual(typeof days[i].sales, 'number');
      assert.strictEqual(typeof days[i].expenses, 'number');
      assert.strictEqual(typeof days[i].netProfit, 'number');
      assert.strictEqual(typeof days[i].margin, 'number');
      assert.strictEqual(days[i].isToday, i === 6, `Only the 7th element (index 6) must have isToday === true`);

      if (i > 0) {
        const prev = new Date(days[i - 1].dateStr + 'T12:00:00Z');
        const curr = new Date(days[i].dateStr + 'T12:00:00Z');
        const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
        assert.strictEqual(diffDays, 1, `Day ${i} must be exactly 1 day after Day ${i - 1}`);
      }
    }
  });

  await test('1.2 Multiple invoices and expenses on the same day aggregate with exact cent precision', () => {
    resetStore();
    const targetDate = '2026-11-05';
    // Clear invoices and expenses
    store.state.invoices = [
      { id: 'i1', date: `${targetDate} 08:30`, total: 10.33, items: [] },
      { id: 'i2', date: `${targetDate} 11:15`, total: 20.66, items: [] },
      { id: 'i3', date: `${targetDate} 14:00`, total: 5.01, items: [] },
      { id: 'i4', date: `${targetDate} 16:45`, total: 99.99, items: [] },
      { id: 'i5', date: `${targetDate} 19:20`, total: 0.01, items: [] }
    ]; // Sum = 136.00

    store.state.expenses = [
      { id: 'e1', date: targetDate, amount: 40.10, concept: 'Insumos', category: 'Insumos' },
      { id: 'e2', date: targetDate, amount: 15.20, concept: 'Gas', category: 'Servicios' },
      { id: 'e3', date: targetDate, amount: 4.70, concept: 'Caja', category: 'Empaques' }
    ]; // Sum = 60.00

    const { days } = calculateWeeklyChartData(store);
    const day = days.find(d => d.dateStr === targetDate);
    assert.ok(day, `Target day ${targetDate} must be present in rolling window`);
    assert.strictEqual(day.sales, 136.00, 'Sales must sum to exact 136.00');
    assert.strictEqual(day.expenses, 60.00, 'Expenses must sum to exact 60.00');
    assert.strictEqual(day.netProfit, 76.00, 'Net profit must equal 76.00 (136.00 - 60.00)');
    // Margin: (76 / 136) * 100 = 55.882... -> 55.9%
    assert.strictEqual(day.margin, 55.9, 'Margin must equal 55.9%');
  });

  await test('1.3 Transactions outside the 7-day rolling window do NOT bleed into chart buckets', () => {
    resetStore();
    const anchorStr = '2026-11-05';
    // Add transaction 8 days before anchor
    store.state.invoices.push({
      id: 'i_old',
      date: '2026-10-25 10:00', // outside 7-day window
      total: 9999.00,
      items: []
    });
    store.state.expenses.push({
      id: 'e_old',
      date: '2026-10-25',
      amount: 8888.00,
      concept: 'Old expense',
      category: 'Otros'
    });

    const { days } = calculateWeeklyChartData(store);
    const totalChartSales = days.reduce((sum, d) => sum + d.sales, 0);
    const totalChartExpenses = days.reduce((sum, d) => sum + d.expenses, 0);

    // Old transaction must not be part of the 7 days
    assert.ok(totalChartSales < 9999.00, 'Old invoice outside window must not be aggregated');
    assert.ok(totalChartExpenses < 8888.00, 'Old expense outside window must not be aggregated');
  });

  await test('1.4 Corrupted, null, and non-ISO transaction dates are safely handled without unhandled exception', () => {
    resetStore();
    store.state.invoices.push(
      { id: 'c1', date: null, total: 50 },
      { id: 'c2', date: undefined, total: 50 },
      { id: 'c3', date: 'invalid-date', total: 50 },
      { id: 'c4', date: 987654321, total: 50 }
    );
    store.state.expenses.push(
      { id: 'ce1', date: null, amount: 20 },
      { id: 'ce2', date: '', amount: 20 }
    );

    assert.doesNotThrow(() => {
      const res = calculateWeeklyChartData(store);
      assert.strictEqual(res.days.length, 7);
    });
  });

  // ===========================================================================
  // CHALLENGE 2: SVG GEOMETRY & GROUPED BAR GENERATION
  // ===========================================================================
  console.log('\n\x1b[1m▶ CHALLENGE 2: SVG Geometry & Grouped Bar Generation\x1b[0m');

  await test('2.1 SVG root element contains exact viewBox, role="img", aria-label, and grid guides', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const svg = container.querySelector('#trendChartSvg');
    assert.notStrictEqual(svg, null, '#trendChartSvg must exist');
    assert.strictEqual(svg.getAttribute('viewBox'), '0 0 420 160');
    assert.strictEqual(svg.getAttribute('role'), 'img');
    assert.ok(svg.getAttribute('aria-label').length > 10);

    // Check grid lines at y=20, y=72, y=125 in the SVG markup
    const rawSvg = container.innerHTML;
    assert.ok(rawSvg.includes('y1="20"') && rawSvg.includes('y2="20"'), 'Top grid line must be at y=20');
    assert.ok(rawSvg.includes('y1="72"') && rawSvg.includes('y2="72"'), 'Mid grid line must be at y=72');
    assert.ok(rawSvg.includes('y1="125"') && rawSvg.includes('y2="125"'), 'Baseline grid line must be at y=125');
  });

  await test('2.2 7 .chart-day groups render with 3 non-overlapping bars per group', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const groups = container.querySelectorAll('.chart-day');
    assert.strictEqual(groups.length, 7, 'Must have 7 .chart-day groups');

    const salesBars = container.querySelectorAll('.bar-sales');
    const expBars = container.querySelectorAll('.bar-expenses');
    const profBars = container.querySelectorAll('.bar-profit');
    assert.strictEqual(salesBars.length, 7);
    assert.strictEqual(expBars.length, 7);
    assert.strictEqual(profBars.length, 7);

    // Verify horizontal alignment for each column:
    // centerX = i * 60 + 30
    // xSales = centerX - 16, xExp = centerX - 5, xProf = centerX + 6. Width = 10.
    for (let i = 0; i < 7; i++) {
      const centerX = i * 60 + 30;
      const expectedXSales = centerX - 16;
      const expectedXExp = centerX - 5;
      const expectedXProf = centerX + 6;

      assert.strictEqual(parseFloat(salesBars[i].getAttribute('x')), expectedXSales);
      assert.strictEqual(parseFloat(expBars[i].getAttribute('x')), expectedXExp);
      assert.strictEqual(parseFloat(profBars[i].getAttribute('x')), expectedXProf);

      assert.strictEqual(parseFloat(salesBars[i].getAttribute('width')), 10);
      assert.strictEqual(parseFloat(expBars[i].getAttribute('width')), 10);
      assert.strictEqual(parseFloat(profBars[i].getAttribute('width')), 10);
    }
  });

  await test('2.3 Bar heights scale proportionally to maxVal and do not exceed top grid line (y >= 20)', () => {
    resetStore();
    const { maxVal } = calculateWeeklyChartData(store);
    const container = new MockElement('div');
    renderDashboardView(container);

    const salesBars = container.querySelectorAll('.bar-sales');
    const expBars = container.querySelectorAll('.bar-expenses');
    const profBars = container.querySelectorAll('.bar-profit');

    for (let i = 0; i < 7; i++) {
      const hSales = parseFloat(salesBars[i].getAttribute('height'));
      const ySales = parseFloat(salesBars[i].getAttribute('y'));
      const hExp = parseFloat(expBars[i].getAttribute('height'));
      const yExp = parseFloat(expBars[i].getAttribute('y'));

      assert.ok(!isNaN(hSales) && hSales >= 0, `hSales must be >= 0 (got ${hSales})`);
      assert.ok(!isNaN(ySales), `ySales must be numeric (got ${ySales})`);
      assert.strictEqual(Math.round(ySales + hSales), 125, 'y + height must anchor to baseline 125 for sales');

      assert.ok(!isNaN(hExp) && hExp >= 0, `hExp must be >= 0 (got ${hExp})`);
      assert.strictEqual(Math.round(yExp + hExp), 125, 'y + height must anchor to baseline 125 for expenses');

      // Top edge must not breach top line y=20
      assert.ok(ySales >= 20, `ySales must be >= 20 (got ${ySales})`);
      assert.ok(yExp >= 20, `yExp must be >= 20 (got ${yExp})`);
    }
  });

  await test('2.4 Negative profit (deficit day) renders red bar (#ef4444) clamped to baseline without vertical overflow', () => {
    resetStore();
    store.state.invoices = [];
    store.state.expenses = [{
      id: 'exp_loss',
      date: '2026-11-05',
      amount: 1000,
      concept: 'Major Equipment Breakdown',
      category: 'Mantenimiento'
    }];

    const container = new MockElement('div');
    renderDashboardView(container);

    const todayGroup = container.querySelectorAll('.chart-day')[6];
    const profBar = todayGroup.querySelector('.bar-profit');

    assert.strictEqual(profBar.getAttribute('fill'), '#ef4444', 'Loss bar must be colored red (#ef4444)');
    assert.strictEqual(profBar.getAttribute('y'), '125', 'Loss bar must start at baseline y=125');
    const h = parseFloat(profBar.getAttribute('height'));
    assert.ok(h > 0 && h <= 15, `Loss bar height must be clamped to max 15px (got ${h})`);
    // Ensure 125 + h <= 160 (bottom of viewBox)
    assert.ok(125 + h <= 160, 'Deficit bar must not overflow SVG viewBox height of 160');
  });

  // ===========================================================================
  // CHALLENGE 3: LIVE REACTIVITY & CROSS-MODULE MUTATION (POS + EXPENSES)
  // ===========================================================================
  console.log('\n\x1b[1m▶ CHALLENGE 3: Live Reactivity & Cross-Module Mutation\x1b[0m');

  await test('3.1 Recording a new invoice in POS reactively increases today SVG sales bar and KPI', () => {
    resetStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const initialSalesText = container.querySelector('#dashTotalSales').innerText;
    const initialTodayGroup = container.querySelectorAll('.chart-day')[6];
    const initialTodaySalesH = parseFloat(initialTodayGroup.querySelector('.bar-sales').getAttribute('height'));

    // Record invoice as POS would
    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p1', name: 'Pastel de Chocolate', quantity: 3, price: 25.00, total: 75.00 }],
      total: 75.00,
      date: '2026-11-05 14:15'
    });

    const updatedSalesText = container.querySelector('#dashTotalSales').innerText;
    const updatedTodayGroup = container.querySelectorAll('.chart-day')[6];
    const updatedTodaySalesH = parseFloat(updatedTodayGroup.querySelector('.bar-sales').getAttribute('height'));

    assert.notStrictEqual(initialSalesText, updatedSalesText, 'Sales KPI text must update reactively');
    assert.ok(updatedSalesText.includes('307.69'), `Sales text must reflect +$75.00 (got ${updatedSalesText})`);
    assert.ok(updatedTodaySalesH > initialTodaySalesH, `Today sales bar must increase in height (${updatedTodaySalesH} > ${initialTodaySalesH})`);
  });

  await test('3.2 Recording a new expense reactively increases expense bar and updates segmented bar', () => {
    resetStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const initialExpText = container.querySelector('#dashTotalExpenses').innerText;
    const initialTodayGroup = container.querySelectorAll('.chart-day')[6];
    const initialTodayExpH = parseFloat(initialTodayGroup.querySelector('.bar-expenses').getAttribute('height'));

    // Record new expense
    store.saveExpense({
      amount: 100.00,
      concept: 'Gas industrial para hornos',
      category: 'Servicios',
      date: '2026-11-05'
    });

    const updatedExpText = container.querySelector('#dashTotalExpenses').innerText;
    const updatedTodayGroup = container.querySelectorAll('.chart-day')[6];
    const updatedTodayExpH = parseFloat(updatedTodayGroup.querySelector('.bar-expenses').getAttribute('height'));

    assert.notStrictEqual(initialExpText, updatedExpText, 'Expenses KPI text must update reactively');
    assert.ok(updatedExpText.includes('287.00'), `Expenses must reflect +$100.00 ($187 -> $287)`);
    assert.ok(updatedTodayExpH > initialTodayExpH, `Today expense bar must increase in height (${updatedTodayExpH} > ${initialTodayExpH})`);

    // Verify segmented bar reflects Servicios expansion
    const segmentedBar = container.querySelector('#expenseSegmentedBar');
    const serviciosSegment = segmentedBar.querySelector('[data-category="Servicios"]');
    assert.notStrictEqual(serviciosSegment, null);
    // Total expenses = $287. Servicios = $32 + $100 = $132 -> 132/287 = 46%
    assert.ok(serviciosSegment.getAttribute('title').includes('46%'), 'Servicios must now represent 46% of total expenses');
  });

  await test('3.3 Deleting an expense reactively recalculates charts and margin meters', () => {
    resetStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    // Save then delete an expense
    const newExp = store.saveExpense({
      amount: 60.00,
      concept: 'Temporary supplies',
      category: 'Insumos',
      date: '2026-11-05'
    });

    assert.ok(container.querySelector('#dashTotalExpenses').innerText.includes('247.00'));

    store.deleteExpense(newExp.id);

    // Reactively rolled back
    assert.ok(container.querySelector('#dashTotalExpenses').innerText.includes('187.00'), 'Expenses must roll back to 187.00 upon delete');
  });

  // ===========================================================================
  // CHALLENGE 4: TOOLTIP INTERACTIVITY & EVENT DISPATCHING
  // ===========================================================================
  console.log('\n\x1b[1m▶ CHALLENGE 4: Tooltip Interactivity & Event Dispatching\x1b[0m');

  await test('4.1 Dispatching click, pointerdown, mouseenter, and focus on .chart-day triggers selectDay', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const days = container.querySelectorAll('.chart-day');
    const target = days[2];
    const tooltipText = container.querySelector('#tooltip-text');
    const auditDetail = container.querySelector('#chartActiveDayDetail');

    // Test pointerdown
    target.dispatchEvent({ type: 'pointerdown', target });
    assert.ok(auditDetail.innerText.includes(target.getAttribute('data-day')), 'pointerdown must trigger day audit');
    assert.ok(target.classList.contains('active-day'), 'target must gain active-day class');

    // Test mouseenter on day 4
    const day4 = days[4];
    day4.dispatchEvent({ type: 'mouseenter', target: day4 });
    assert.ok(auditDetail.innerText.includes(day4.getAttribute('data-day')), 'mouseenter must trigger day audit');
    assert.ok(!target.classList.contains('active-day'), 'previous day must lose active-day class');
    assert.ok(day4.classList.contains('active-day'), 'new day must gain active-day class');

    // Test focus on day 0
    const day0 = days[0];
    day0.dispatchEvent({ type: 'focus', target: day0 });
    assert.ok(auditDetail.innerText.includes(day0.getAttribute('data-day')), 'focus must trigger day audit');
    assert.ok(day0.classList.contains('active-day'));
  });

  await test('4.2 Audit bar (#chartAuditSummary) reflects exact formatted financial numbers on day selection', () => {
    resetStore();
    const container = new MockElement('div');
    renderDashboardView(container);

    const days = container.querySelectorAll('.chart-day');
    // Day Nov 2 has $122.58 sales, $32.00 expenses, $90.58 profit
    const dayNov2 = days.find(d => d.getAttribute('data-date') === '2026-11-02');
    if (dayNov2) {
      dayNov2.click();

      const auditSales = container.querySelector('#auditDaySales');
      const auditExpenses = container.querySelector('#auditDayExpenses');
      const auditProfit = container.querySelector('#auditDayProfit');

      assert.strictEqual(auditSales.innerText, 'Ventas: $122.58');
      assert.strictEqual(auditExpenses.innerText, 'Gastos: -$32.00');
      assert.strictEqual(auditProfit.innerText, 'Neto: +$90.58 (73.9%)');
      assert.ok(auditProfit.className.includes('text-primary'), 'Positive profit must have text-primary class');
    }
  });

  // ===========================================================================
  // CHALLENGE 5: EXTREME EDGE CASES & STRESS HARDENING
  // ===========================================================================
  console.log('\n\x1b[1m▶ CHALLENGE 5: Extreme Edge Cases & Stress Hardening\x1b[0m');

  await test('5.1 All 7 days with zero sales and zero expenses produce clean DOM without NaN, Infinity, or broken paths', () => {
    resetStore();
    store.state.invoices = [];
    store.state.expenses = [];

    const { days, maxVal } = calculateWeeklyChartData(store);
    assert.strictEqual(maxVal, 50, 'Fallback maxVal must be 50 to avoid 0-division');
    days.forEach(d => {
      assert.strictEqual(d.sales, 0);
      assert.strictEqual(d.expenses, 0);
      assert.strictEqual(d.netProfit, 0);
      assert.strictEqual(d.margin, 0.0);
    });

    const container = new MockElement('div');
    renderDashboardView(container);

    const html = container.innerHTML;
    assert.ok(!html.includes('NaN'), 'DOM must not contain NaN');
    assert.ok(!html.includes('Infinity'), 'DOM must not contain Infinity');
    assert.ok(!html.includes('undefined'), 'DOM must not contain undefined');

    const salesBars = container.querySelectorAll('.bar-sales');
    salesBars.forEach(b => {
      assert.strictEqual(b.getAttribute('height'), '0');
      assert.strictEqual(b.getAttribute('y'), '125');
    });

    const expBars = container.querySelectorAll('.bar-expenses');
    expBars.forEach(b => {
      assert.strictEqual(b.getAttribute('height'), '0');
      assert.strictEqual(b.getAttribute('y'), '125');
    });

    const segmentedBar = container.querySelector('#expenseSegmentedBar');
    assert.ok(segmentedBar.innerText.includes('Sin gastos registrados'), 'Must display empty state placeholder');
  });

  await test('5.2 Massive sales outlier ($10,000,000) scales maxVal, maintains proper bar proportions, and clamps meters at 100%', () => {
    resetStore();
    store.state.invoices = [{
      id: 'i_mega',
      date: '2026-11-05 12:00',
      total: 10000000,
      items: [{ productId: 'p1', name: 'Mega Sale', quantity: 1000, price: 10000, total: 10000000 }]
    }];

    const { days, maxVal } = calculateWeeklyChartData(store);
    assert.strictEqual(maxVal, 10000000);
    assert.strictEqual(days[6].sales, 10000000);

    const container = new MockElement('div');
    renderDashboardView(container);

    const todaySalesBar = container.querySelectorAll('.bar-sales')[6];
    assert.strictEqual(todaySalesBar.getAttribute('height'), '105', 'Peak bar must equal maximum height 105px');
    assert.strictEqual(todaySalesBar.getAttribute('y'), '20', 'Peak bar top must align with grid line at y=20');

    const grossMeter = container.querySelector('#dashGrossMeterBar');
    assert.ok(grossMeter.getAttribute('style').includes('width: 100%'), 'Gross meter must clamp cleanly to 100%');
  });

  await test('5.3 High throughput: 20 rapid sequential mutations (10 sales + 10 expenses) process in <350ms without data loss', () => {
    resetStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    const startTime = performance.now();
    for (let i = 1; i <= 10; i++) {
      store.saveInvoice({
        type: 'ticket',
        items: [{ productId: 'p1', name: `Item ${i}`, quantity: 1, price: 5.00, total: 5.00 }],
        total: 5.00,
        date: '2026-11-05 12:00'
      });
      store.saveExpense({
        amount: 3.00,
        concept: `Expense ${i}`,
        category: 'Insumos',
        date: '2026-11-05'
      });
    }
    const elapsed = performance.now() - startTime;
    console.log(`    ℹ️ 20 mutations (10 sales + 10 expenses) executed in ${elapsed.toFixed(2)}ms`);

    assert.ok(elapsed < 400, `Elapsed time must be under 400ms (got ${elapsed.toFixed(2)}ms)`);

    // Verify consistency: 10 sales of $5 = $50 added. Baseline was $232.69 -> $282.69
    const salesText = container.querySelector('#dashTotalSales').innerText;
    assert.ok(salesText.includes('282.69'), `Final sales must be $282.69 (got ${salesText})`);

    // 10 expenses of $3 = $30 added. Baseline was $187.00 -> $217.00
    const expText = container.querySelector('#dashTotalExpenses').innerText;
    assert.ok(expText.includes('217.00'), `Final expenses must be $217.00 (got ${expText})`);
  });

  await test('5.4 Memory leak guard: Disconnected container unsubscribes cleanly and halts further re-renders', () => {
    resetStore();
    const container = new MockElement('div');
    container.isConnected = true;
    renderDashboardView(container);

    assert.strictEqual(container._hasDashboardStoreSub, true);

    // Disconnect container (e.g. user navigated to #recetario)
    container.isConnected = false;

    // Trigger state change
    store.saveExpense({
      amount: 99.00,
      concept: 'Unmounted expense',
      category: 'Otros',
      date: '2026-11-05'
    });

    // Verify flag was reset and subscription was dropped
    assert.strictEqual(container._hasDashboardStoreSub, false, 'Subscription flag must be cleared on disconnect');

    // Container should NOT have been updated with the new expense
    const expText = container.querySelector('#dashTotalExpenses').innerText;
    assert.ok(!expText.includes('286.00'), 'Disconnected container must not re-render');
  });

  // ===========================================================================
  // CHALLENGER VERDICT & SUMMARY
  // ===========================================================================
  console.log('\n\x1b[1m\x1b[33m======================================================================\x1b[0m');
  console.log(`\x1b[1mCHALLENGER RESULTS: ${passed} PASSED | ${failed} FAILED\x1b[0m`);
  console.log('\x1b[1m\x1b[33m======================================================================\x1b[0m\n');

  if (failed > 0) {
    console.error(`\x1b[31m❌ VERDICT: DISPROVED (${failed} challenges failed).\x1b[0m`);
    process.exit(1);
  } else {
    console.log('\x1b[32m✔ VERDICT: CONFIRMED. All 5 challenges passed adversarial stress testing.\x1b[0m\n');
    process.exit(0);
  }
}

runAllChallenges();
