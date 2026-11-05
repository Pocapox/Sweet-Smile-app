// tests/test_m3_adversarial_stress.js - Adversarial Stress & Integrity Test for M3_v12 Charts
import assert from 'node:assert';
import { store } from '../js/store.js';
import { renderDashboardView, calculateWeeklyChartData } from '../js/views/dashboardView.js';
import { MockElement } from './harness.js';
import { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_EXPENSES, INITIAL_SETTINGS } from '../js/models.js';

let passed = 0;
let failed = 0;

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

function run(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✔ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✖ FAIL: ${name}`);
    console.error(err);
  }
}

console.log('--- ADVERSARIAL STRESS TEST SUITE FOR M3_v12 CHARTS ---');

// Stress 1: Extreme Values & Clamping
run('1. Huge financial values ($100,000,000) scale without NaN, overflow, or NaN in SVG coords', () => {
  resetStore();
  store.state.invoices = [{
    id: 'inv_huge',
    date: '2026-11-05 10:00',
    total: 100000000,
    items: [{ productId: 'p1', name: 'Huge Cake', quantity: 1, price: 100000000, cost: 1000, total: 100000000 }]
  }];
  store.state.expenses = [{
    id: 'exp_huge',
    date: '2026-11-05',
    amount: 50000000,
    concept: 'Mega factory upgrade',
    category: 'Mantenimiento'
  }];

  const { days, maxVal } = calculateWeeklyChartData(store);
  assert.strictEqual(maxVal, 100000000);
  assert.strictEqual(days[days.length - 1].sales, 100000000);
  assert.strictEqual(days[days.length - 1].expenses, 50000000);
  assert.strictEqual(days[days.length - 1].netProfit, 50000000);

  const container = new MockElement('div');
  renderDashboardView(container);
  assert.ok(!container.innerHTML.includes('NaN'));
  assert.ok(!container.innerHTML.includes('Infinity'));

  // Gauge bar should clamp at 100%
  const grossMeter = container.querySelector('#dashGrossMeterBar');
  assert.ok(grossMeter.getAttribute('style').includes('width: 100%'));
});

// Stress 2: Deficit Day (Expenses > Sales) Negative Coordinates Handling
run('2. Deep deficit ($5,000 expense, $0 sales) renders red profit bar within safe bounds', () => {
  resetStore();
  store.state.invoices = [];
  store.state.expenses = [{
    id: 'exp_deficit',
    date: '2026-11-05',
    amount: 5000,
    concept: 'New Oven purchase',
    category: 'Servicios'
  }];

  const { days, maxVal } = calculateWeeklyChartData(store);
  const today = days[days.length - 1];
  assert.strictEqual(today.sales, 0);
  assert.strictEqual(today.expenses, 5000);
  assert.strictEqual(today.netProfit, -5000);
  assert.strictEqual(today.margin, 0.0); // Safe margin division

  const container = new MockElement('div');
  renderDashboardView(container);

  const todayGroup = container.querySelectorAll('.chart-day')[6];
  assert.strictEqual(todayGroup.getAttribute('data-profit'), '-5000.00');
  
  const profitBar = todayGroup.querySelector('.bar-profit');
  assert.strictEqual(profitBar.getAttribute('fill'), '#ef4444');
  const hProf = parseFloat(profitBar.getAttribute('height'));
  assert.ok(hProf <= 15, 'Deficit bar height must be clamped to max 15px to protect baseline');
  assert.strictEqual(profitBar.getAttribute('y'), '125');
});

// Stress 3: Malformed & Missing Dates
run('3. Corrupted or invalid date formats in transactions do not throw exceptions', () => {
  resetStore();
  store.state.invoices.push(
    { id: 'bad1', date: null, total: 10 },
    { id: 'bad2', date: undefined, total: 20 },
    { id: 'bad3', date: 'invalid-date-string', total: 30 },
    { id: 'bad4', date: 1234567, total: 40 }
  );
  store.state.expenses.push(
    { id: 'ebad1', date: '', amount: 15 },
    { id: 'ebad2', date: {}, amount: 25 }
  );

  assert.doesNotThrow(() => {
    const res = calculateWeeklyChartData(store);
    assert.strictEqual(res.days.length, 7);
  });

  const container = new MockElement('div');
  assert.doesNotThrow(() => {
    renderDashboardView(container);
  });
});

// Stress 4: Custom / Unrecognized Categories Aggregation
run('4. Unrecognized expense categories roll into "Otros" breakdown smoothly', () => {
  resetStore();
  store.state.expenses.push({
    id: 'exp_custom',
    date: '2026-11-05',
    amount: 100,
    concept: 'Unusual expense',
    category: 'Alien Supplies'
  });

  const container = new MockElement('div');
  renderDashboardView(container);

  const segmentedBar = container.querySelector('#expenseSegmentedBar');
  assert.notStrictEqual(segmentedBar, null);
  assert.ok(!container.innerHTML.includes('NaN'));
});

// Stress 5: Interactive Tooltip & Day selection on All Days
run('5. Rapid selection across all 7 days updates tooltip and audit bar with zero error', () => {
  resetStore();
  const container = new MockElement('div');
  renderDashboardView(container);

  const days = container.querySelectorAll('.chart-day');
  assert.strictEqual(days.length, 7);

  days.forEach(day => {
    day.click();
    const tooltipText = container.querySelector('#tooltip-text').innerText;
    assert.ok(tooltipText.includes(day.getAttribute('data-day')));
    const auditSales = container.querySelector('#auditDaySales').innerText;
    assert.ok(auditSales.includes(day.getAttribute('data-inc')));
  });
});

// Stress 6: Negative Margins Meter Protection
run('6. Highly negative net margin clamps meter bar width to 0% and badges Alerta', () => {
  resetStore();
  store.state.invoices = [{ id: 'i1', total: 10, date: '2026-11-05', items: [{ productId: 'p1', total: 10, cost: 5, quantity: 1 }] }];
  store.state.expenses = [{ id: 'e1', amount: 500, date: '2026-11-05', concept: 'Giant loss', category: 'Otros' }];

  const container = new MockElement('div');
  renderDashboardView(container);

  const netMeter = container.querySelector('#dashNetMeterBar');
  assert.ok(netMeter.getAttribute('style').includes('width: 0%'), 'Negative margin bar must clamp to 0%');

  const netBadge = container.querySelector('#dashNetMarginCompareBadge');
  assert.ok(netBadge.innerText.includes('Alerta'));
});

console.log(`\nAdversarial Stress Results: ${passed} PASSED | ${failed} FAILED\n`);
if (failed > 0) process.exit(1);
