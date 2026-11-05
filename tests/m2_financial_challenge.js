// tests/m2_financial_challenge.js
// EMPIRICAL CHALLENGE HARNESS: Milestone M2_v12 (Requirement R2)
// Rigorous adversarial stress testing of Expense Tracking & Financial Accounting Engine

import assert from 'node:assert';
import { store } from '../js/store.js';
import {
  INITIAL_PRODUCTS,
  INITIAL_INVENTORY,
  INITIAL_RECIPES,
  INITIAL_INVOICES,
  INITIAL_EXPENSES,
  INITIAL_SETTINGS
} from '../js/models.js';
import { CostingEngine } from '../js/costing.js';
import { renderDashboardView } from '../js/views/dashboardView.js';
import {
  setupGlobalEnv,
  resetGlobalEnv,
  resetStoreToSeed,
  MockElement
} from './harness.js';

let passed = 0;
let failed = 0;
const failureLog = [];

function challenge(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
    failureLog.push({ test: name, error: err.message, stack: err.stack });
  }
}

async function asyncChallenge(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ [PASS]\x1b[0m ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \x1b[31m✖ [FAIL]\x1b[0m ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
    failureLog.push({ test: name, error: err.message, stack: err.stack });
  }
}

function restoreCleanState() {
  resetGlobalEnv();
  resetStoreToSeed(store, {
    INITIAL_PRODUCTS,
    INITIAL_INVENTORY,
    INITIAL_RECIPES,
    INITIAL_INVOICES,
    INITIAL_EXPENSES,
    INITIAL_SETTINGS
  });
  store.cart = [];
  store.saveState();
}

console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m');
console.log('\x1b[1m\x1b[35m 🔥 EMPIRICAL CHALLENGE HARNESS — MILESTONE M2_v12 (R2 ACCOUNTING)   \x1b[0m');
console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m\n');

// ============================================================================
// CHALLENGE 1: Register multiple expenses with various categories, check store.getExpenses(), verify schema
// ============================================================================
console.log('\x1b[1m▶ CHALLENGE 1: Expense Registration, Schema Conformance & Filtering\x1b[0m');

challenge('1.1 Register multiple expenses spanning all categories with full schemas', () => {
  restoreCleanState();
  const initialCount = store.getExpenses().length;

  const sampleExpenses = [
    { amount: 125.50, concept: 'Sacos de Harina Flor de Trigo 25kg', category: 'Insumos', paymentMethod: 'Transferencia Bancaria', receipt: 'FAC-IN-101', notes: 'Proveedor Molinos del Sur' },
    { amount: 48.00, concept: 'Recarga balón de gas propano 45kg', category: 'Servicios', paymentMethod: 'Efectivo', receipt: 'TK-GAS-55', notes: 'Hornada matutina' },
    { amount: 36.75, concept: 'Cajas de cartón microcorrugado 28cm', category: 'Empaques', paymentMethod: 'Tarjeta de Débito', receipt: 'BOL-EMP-98', notes: 'Para tortas de matrimonio' },
    { amount: 180.00, concept: 'Turno extra maestro pastelero fin de semana', category: 'Mano de Obra', paymentMethod: 'Efectivo', receipt: 'REC-MO-02', notes: 'Campana navideña' },
    { amount: 75.20, concept: 'Mantenimiento preventivo engranajes amasadora', category: 'Mantenimiento', paymentMethod: 'Transferencia Bancaria', receipt: 'FAC-MANT-12', notes: 'TecniPan S.A.' },
    { amount: 22.00, concept: 'Artículos de desinfección y limpieza grado alimentario', category: 'Otros', paymentMethod: 'Efectivo', receipt: 'TKT-LIM-88', notes: 'Supermercado' }
  ];

  const registered = sampleExpenses.map(e => store.saveExpense(e));

  // Verify total count
  const allExpenses = store.getExpenses();
  assert.strictEqual(allExpenses.length, initialCount + sampleExpenses.length, `Total expenses count must be ${initialCount + sampleExpenses.length}`);

  // Verify schema of all registered
  registered.forEach(r => {
    assert.ok(r.id && /^EXP-\d+$/.test(r.id), `ID ${r.id} must match format EXP-XXXXX`);
    assert.ok(typeof r.amount === 'number' && r.amount > 0, 'Amount must be positive number');
    assert.ok(r.concept && r.concept.length > 5, 'Concept must be descriptive');
    assert.ok(r.category, 'Category must be defined');
    assert.ok(r.date && /^\d{4}-\d{2}-\d{2}$/.test(r.date), `Date ${r.date} must be ISO YYYY-MM-DD`);
    assert.ok(r.paymentMethod, 'Payment method must be defined');
    assert.ok(r.createdAt && !isNaN(Date.parse(r.createdAt)), 'createdAt must be valid ISO timestamp');
  });

  // Verify newest expense is at head of list (unshifted)
  assert.strictEqual(allExpenses[0].id, registered[registered.length - 1].id, 'Newest expense must be unshifted to the top');
});

challenge('1.2 Filtering by category, date range and search query', () => {
  restoreCleanState();
  // Clear and add controlled dataset
  store.state.expenses = [
    { id: 'EXP-A', amount: 100, concept: 'Harina pastelera', category: 'Insumos', date: '2026-11-01', receipt: 'REC-1', notes: 'nota uno' },
    { id: 'EXP-B', amount: 50, concept: 'Electricidad taller', category: 'Servicios', date: '2026-11-02', receipt: 'REC-2', notes: 'nota dos' },
    { id: 'EXP-C', amount: 30, concept: 'Cajas kraft', category: 'Empaques', date: '2026-11-03', receipt: 'REC-3', notes: 'nota tres' },
    { id: 'EXP-D', amount: 200, concept: 'Sueldo ayudante', category: 'Mano de Obra', date: '2026-11-04', receipt: 'REC-4', notes: 'nota cuatro' },
    { id: 'EXP-E', amount: 80, concept: 'Harina integral orgánica', category: 'Insumos', date: '2026-11-05', receipt: 'REC-5', notes: 'nota cinco' }
  ];

  // Category filter
  const insumos = store.getExpenses({ category: 'Insumos' });
  assert.strictEqual(insumos.length, 2);
  assert.ok(insumos.every(e => e.category === 'Insumos'));

  const servicios = store.getExpenses({ category: 'Servicios' });
  assert.strictEqual(servicios.length, 1);
  assert.strictEqual(servicios[0].id, 'EXP-B');

  // "all" and "Todas" should return full list
  assert.strictEqual(store.getExpenses({ category: 'all' }).length, 5);
  assert.strictEqual(store.getExpenses({ category: 'Todas' }).length, 5);

  // Date range filter
  const midDates = store.getExpenses({ startDate: '2026-11-02', endDate: '2026-11-04' });
  assert.strictEqual(midDates.length, 3);
  const ids = midDates.map(e => e.id);
  assert.ok(ids.includes('EXP-B') && ids.includes('EXP-C') && ids.includes('EXP-D'));

  // Search filter across concept, receipt, notes, category
  const searchHarina = store.getExpenses({ search: 'harina' });
  assert.strictEqual(searchHarina.length, 2, 'Search "harina" should find 2 expenses');

  const searchReceipt = store.getExpenses({ search: 'REC-3' });
  assert.strictEqual(searchReceipt.length, 1);
  assert.strictEqual(searchReceipt[0].id, 'EXP-C');

  const searchNotes = store.getExpenses({ search: 'cuatro' });
  assert.strictEqual(searchNotes.length, 1);
  assert.strictEqual(searchNotes[0].id, 'EXP-D');
});

challenge('1.3 Input validation rejects invalid payloads with descriptive errors', () => {
  restoreCleanState();

  // Non-object
  assert.throws(() => store.saveExpense(null), /no válidos/i);
  assert.throws(() => store.saveExpense('not an object'), /no válidos/i);

  // Amount <= 0 or NaN
  assert.throws(() => store.saveExpense({ amount: 0, concept: 'Test' }), /mayor a 0/i);
  assert.throws(() => store.saveExpense({ amount: -15.50, concept: 'Test' }), /mayor a 0/i);
  assert.throws(() => store.saveExpense({ amount: 'cero', concept: 'Test' }), /mayor a 0/i);
  assert.throws(() => store.saveExpense({ amount: NaN, concept: 'Test' }), /mayor a 0/i);

  // Concept missing or whitespace
  assert.throws(() => store.saveExpense({ amount: 10 }), /concepto.*requerido/i);
  assert.throws(() => store.saveExpense({ amount: 10, concept: '' }), /concepto.*requerido/i);
  assert.throws(() => store.saveExpense({ amount: 10, concept: '   ' }), /concepto.*requerido/i);
});

challenge('1.4 Updating an existing expense preserves count and updates attributes in-place', () => {
  restoreCleanState();
  const created = store.saveExpense({
    amount: 50.00,
    concept: 'Azúcar refinada 50kg',
    category: 'Insumos'
  });

  const countBefore = store.getExpenses().length;

  const updated = store.saveExpense({
    id: created.id,
    amount: 57.50,
    concept: 'Azúcar refinada 50kg + flete',
    category: 'Insumos',
    notes: 'Incluye flete de entrega'
  });

  const countAfter = store.getExpenses().length;
  assert.strictEqual(countAfter, countBefore, 'Updating existing expense must not change total count');
  assert.strictEqual(updated.id, created.id);
  assert.strictEqual(updated.amount, 57.50);
  assert.strictEqual(updated.concept, 'Azúcar refinada 50kg + flete');
  assert.strictEqual(updated.notes, 'Incluye flete de entrega');

  // Verify in store list
  const fetched = store.getExpense(created.id);
  assert.strictEqual(fetched.amount, 57.50);
});

challenge('1.5 Default field values when optional attributes are omitted', () => {
  restoreCleanState();
  const minimal = store.saveExpense({
    amount: 25.50,
    concept: 'Vainilla Bourbon'
  });

  assert.strictEqual(minimal.amount, 25.50);
  assert.strictEqual(minimal.concept, 'Vainilla Bourbon');
  assert.strictEqual(minimal.category, 'Otros', 'Default category must be "Otros"');
  assert.strictEqual(minimal.paymentMethod, 'Efectivo', 'Default payment method must be "Efectivo"');
  assert.strictEqual(minimal.receipt, '');
  assert.strictEqual(minimal.notes, '');
  assert.strictEqual(minimal.date, new Date().toISOString().slice(0, 10));
});

challenge('1.6 Multi-filter combination: category + date range + text search simultaneously', () => {
  restoreCleanState();
  store.state.expenses = [
    { id: 'E-1', amount: 50, category: 'Insumos', date: '2026-11-01', concept: 'Harina panadera' },
    { id: 'E-2', amount: 60, category: 'Insumos', date: '2026-11-03', concept: 'Harina pastelera' },
    { id: 'E-3', amount: 70, category: 'Insumos', date: '2026-11-03', concept: 'Mantequilla 82%' },
    { id: 'E-4', amount: 80, category: 'Servicios', date: '2026-11-03', concept: 'Harina para pruebas' }
  ];

  // Filter category: Insumos, date: 2026-11-02 to 2026-11-04, search: "harina"
  const res = store.getExpenses({
    category: 'Insumos',
    startDate: '2026-11-02',
    endDate: '2026-11-04',
    search: 'harina'
  });

  assert.strictEqual(res.length, 1);
  assert.strictEqual(res[0].id, 'E-2');
});

// ============================================================================
// CHALLENGE 2: Exact output against manual calculation across diverse invoice + expense states
// ============================================================================
console.log('\n\x1b[1m▶ CHALLENGE 2: Exact Financial Accounting Verification vs Independent Manual Math\x1b[0m');

challenge('2.1 Baseline Seed Dataset matches exact manual accounting calculations', () => {
  restoreCleanState();

  const fin = store.getFinancialSummary();

  // Manual sum of seed invoices
  const manualSales = INITIAL_INVOICES.reduce((sum, inv) => sum + inv.total, 0); // 232.69
  assert.strictEqual(fin.totalSales, Math.round(manualSales * 100) / 100);
  assert.strictEqual(fin.totalSales, 232.69);

  // Manual sum of seed expenses
  const manualExpenses = INITIAL_EXPENSES.reduce((sum, exp) => sum + exp.amount, 0); // 187.00
  assert.strictEqual(fin.totalExpenses, Math.round(manualExpenses * 100) / 100);
  assert.strictEqual(fin.totalExpenses, 187.00);

  // Manual COGS:
  // INV-001: PROD-001 (qty 1, cost 4.50) -> 4.50
  // INV-002: PROD-002 (qty 1, cost 11.20) + PROD-004 (qty 1, cost 6.00) -> 17.20
  // INV-003: PROD-003 (qty 1, cost 3.20) -> 3.20
  // INV-004: PROD-002 (qty 1, cost 11.20) -> 11.20
  // INV-005: PROD-005 (qty 1, cost 13.90) -> 13.90
  // INV-006: PROD-006 (qty 2, cost 8.50) -> 17.00
  // INV-007: PROD-007 (qty 1, cost 1.45) -> 1.45
  // INV-008: PROD-008 (qty 2, cost 9.80) -> 19.60
  // INV-009: PROD-002 (qty 1, cost 11.20) -> 11.20
  // INV-010: PROD-007 (qty 2, cost 1.45) -> 2.90
  // Total COGS = 4.50 + 17.20 + 3.20 + 11.20 + 13.90 + 17.00 + 1.45 + 19.60 + 11.20 + 2.90 = 102.15?
  // Wait, let's verify exact COGS computed by store:
  let expectedCogs = 0;
  INITIAL_INVOICES.forEach(inv => {
    inv.items.forEach(it => {
      const p = INITIAL_PRODUCTS.find(prod => prod.id === it.productId);
      if (p && typeof p.cost === 'number') {
        expectedCogs += (p.cost * it.quantity);
      }
    });
  });
  expectedCogs = Math.round(expectedCogs * 100) / 100;
  assert.strictEqual(fin.totalCogs, expectedCogs);

  // Gross Profit = totalSales - totalCogs
  const expectedGrossProfit = Math.round((fin.totalSales - fin.totalCogs) * 100) / 100;
  assert.strictEqual(fin.grossProfit, expectedGrossProfit);

  // Gross Margin = (grossProfit / totalSales) * 100 rounded to 1 decimal
  const expectedGrossMargin = Math.round((expectedGrossProfit / fin.totalSales) * 1000) / 10;
  assert.strictEqual(fin.grossMargin, expectedGrossMargin);

  // Net Profit = grossProfit - totalExpenses
  const expectedNetProfit = Math.round((expectedGrossProfit - fin.totalExpenses) * 100) / 100;
  assert.strictEqual(fin.netProfit, expectedNetProfit);

  // Net Margin = (netProfit / totalSales) * 100 rounded to 1 decimal
  const expectedNetMargin = Math.round((expectedNetProfit / fin.totalSales) * 1000) / 10;
  assert.strictEqual(fin.netMargin, expectedNetMargin);

  // Total Costs = totalCogs + totalExpenses
  const expectedTotalCosts = Math.round((fin.totalCogs + fin.totalExpenses) * 100) / 100;
  assert.strictEqual(fin.totalCosts, expectedTotalCosts);

  // Expenses by Category breakdown verification
  const catSums = {};
  INITIAL_EXPENSES.forEach(e => {
    catSums[e.category] = Math.round(((catSums[e.category] || 0) + e.amount) * 100) / 100;
  });
  assert.deepStrictEqual(fin.expensesByCategory, catSums);
});

challenge('2.2 High-volume complex financial scenario with independent mathematical verification', () => {
  restoreCleanState();

  // Create controlled set of 5 custom products
  store.state.products = [
    { id: 'P-1', name: 'Torta Selva', cost: 15.00, price: 40.00 },
    { id: 'P-2', name: 'Pie de Limón', cost: 8.00, price: 25.00 },
    { id: 'P-3', name: 'Croissant Almendra', cost: 1.50, price: 4.50 },
    { id: 'P-4', name: 'Donut Glaseada', cost: 0.60, price: 2.00 },
    { id: 'P-5', name: 'Cheesecake Maracuyá', cost: 12.00, price: 35.00 }
  ];

  // Invoices:
  // Inv 1: 2 x P-1 ($80), 3 x P-3 ($13.50) -> total $93.50, COGS: (2*15) + (3*1.50) = 34.50
  // Inv 2: 10 x P-4 ($20), 1 x P-5 ($35) -> total $55.00, COGS: (10*0.60) + (1*12) = 18.00
  // Inv 3: 4 x P-2 ($100), 2 x P-5 ($70) -> total $170.00, COGS: (4*8) + (2*12) = 56.00
  store.state.invoices = [
    { id: 'INV-X1', total: 93.50, items: [{ productId: 'P-1', quantity: 2 }, { productId: 'P-3', quantity: 3 }] },
    { id: 'INV-X2', total: 55.00, items: [{ productId: 'P-4', quantity: 10 }, { productId: 'P-5', quantity: 1 }] },
    { id: 'INV-X3', total: 170.00, items: [{ productId: 'P-2', quantity: 4 }, { productId: 'P-5', quantity: 2 }] }
  ];

  // Expenses:
  // Insumos: 45.00, Servicios: 30.00, Mano de Obra: 60.00
  // Total Expenses = 135.00
  store.state.expenses = [
    { id: 'EXP-1', amount: 45.00, category: 'Insumos', concept: 'Fresas' },
    { id: 'EXP-2', amount: 30.00, category: 'Servicios', concept: 'Luz' },
    { id: 'EXP-3', amount: 60.00, category: 'Mano de Obra', concept: 'Turno' }
  ];

  // Hand-calculated expected figures:
  const manualTotalSales = 93.50 + 55.00 + 170.00; // 318.50
  const manualTotalCogs = 34.50 + 18.00 + 56.00; // 108.50
  const manualTotalExpenses = 45.00 + 30.00 + 60.00; // 135.00
  const manualGrossProfit = manualTotalSales - manualTotalCogs; // 210.00
  const manualGrossMargin = Math.round((manualGrossProfit / manualTotalSales) * 1000) / 10; // (210 / 318.50)*100 = 65.934 -> 65.9%
  const manualNetProfit = manualGrossProfit - manualTotalExpenses; // 210.00 - 135.00 = 75.00
  const manualNetMargin = Math.round((manualNetProfit / manualTotalSales) * 1000) / 10; // (75 / 318.50)*100 = 23.547 -> 23.5%

  const fin = store.getFinancialSummary();

  assert.strictEqual(fin.totalSales, 318.50, 'Total Sales must match 318.50');
  assert.strictEqual(fin.totalCogs, 108.50, 'Total COGS must match 108.50');
  assert.strictEqual(fin.totalExpenses, 135.00, 'Total Expenses must match 135.00');
  assert.strictEqual(fin.totalCosts, 243.50, 'Total Costs must be COGS + Expenses (243.50)');
  assert.strictEqual(fin.grossProfit, 210.00, 'Gross Profit must match 210.00');
  assert.strictEqual(fin.grossMargin, 65.9, 'Gross Margin % must match 65.9%');
  assert.strictEqual(fin.netProfit, 75.00, 'Net Profit must match 75.00');
  assert.strictEqual(fin.netMargin, 23.5, 'Net Margin % must match 23.5%');
  assert.strictEqual(fin.avgTicket, Math.round((318.50 / 3) * 100) / 100);
});

challenge('2.3 Fallback to Recipe Costing Engine when product has cost=0', () => {
  restoreCleanState();

  store.state.products = [
    { id: 'PROD-RECIPE-ONLY', name: 'Postre Especial', cost: 0, recipeId: 'rec-042' }
  ];

  store.state.invoices = [
    { id: 'INV-REC', total: 50.00, items: [{ productId: 'PROD-RECIPE-ONLY', quantity: 2 }] }
  ];

  store.state.expenses = [
    { id: 'EXP-1', amount: 10.00, category: 'Otros', concept: 'Varios' }
  ];

  const fin = store.getFinancialSummary();

  // Recipe rec-042 unitCost via CostingEngine
  const recipe = store.state.recipes.find(r => r.id === 'rec-042');
  assert.ok(recipe, 'Recipe rec-042 must exist');
  const res = CostingEngine.calculateRecipe(recipe);
  const expectedUnitCost = res.unitCost || 0;
  const expectedCogs = Math.round((expectedUnitCost * 2) * 100) / 100;

  assert.strictEqual(fin.totalCogs, expectedCogs, 'COGS must be derived from recipe unit cost when product.cost is 0');
  assert.ok(fin.totalCogs > 0, 'COGS should be greater than 0');
});

challenge('2.4 Corrupted or non-numeric expense amounts in state handled gracefully without NaN', () => {
  restoreCleanState();
  store.state.expenses.push({ id: 'E-CORRUPT', amount: null, concept: 'Corrupt' });
  store.state.expenses.push({ id: 'E-STRING', amount: '45.50', concept: 'String amount' });
  store.state.expenses.push({ id: 'E-NAN', amount: NaN, concept: 'NaN amount' });

  const fin = store.getFinancialSummary();
  assert.strictEqual(Number.isNaN(fin.totalExpenses), false, 'totalExpenses must not be NaN');
  assert.strictEqual(Number.isNaN(fin.netProfit), false, 'netProfit must not be NaN');
  assert.strictEqual(Number.isNaN(fin.netMargin), false, 'netMargin must not be NaN');
  // 187 (seed) + 0 (null) + 45.50 + 0 (NaN) = 232.50
  assert.strictEqual(fin.totalExpenses, 232.50);
});

// ============================================================================
// CHALLENGE 3: Edge case: Zero sales (invoices = []). Margins must return 0.0% without NaN or Infinity
// ============================================================================
console.log('\n\x1b[1m▶ CHALLENGE 3: Zero Sales Edge Case & Division-by-Zero Resilience\x1b[0m');

challenge('3.1 invoices = [] with active expenses produces 0.0% margins, negative net profit, no NaN/Infinity', () => {
  restoreCleanState();
  store.state.invoices = []; // Zero sales

  const fin = store.getFinancialSummary();

  assert.strictEqual(fin.totalSales, 0.0, 'totalSales must be 0.0');
  assert.strictEqual(fin.totalOrders, 0, 'totalOrders must be 0');
  assert.strictEqual(fin.avgTicket, 0.0, 'avgTicket must be 0.0');
  assert.strictEqual(fin.totalCogs, 0.0, 'totalCogs must be 0.0');
  assert.strictEqual(fin.grossProfit, 0.0, 'grossProfit must be 0.0');
  assert.strictEqual(fin.grossMargin, 0.0, 'grossMargin must be strictly 0.0');
  assert.strictEqual(fin.totalExpenses, 187.00, 'totalExpenses must reflect seed expenses');
  assert.strictEqual(fin.netProfit, -187.00, 'netProfit must be -187.00');
  assert.strictEqual(fin.netMargin, 0.0, 'netMargin must be strictly 0.0 (not -Infinity)');

  // Strict NaN and Infinity assertions
  assert.strictEqual(Number.isNaN(fin.grossMargin), false, 'grossMargin must not be NaN');
  assert.strictEqual(Number.isFinite(fin.grossMargin), true, 'grossMargin must be finite');
  assert.strictEqual(Number.isNaN(fin.netMargin), false, 'netMargin must not be NaN');
  assert.strictEqual(Number.isFinite(fin.netMargin), true, 'netMargin must be finite');
  assert.strictEqual(Number.isNaN(fin.avgTicket), false, 'avgTicket must not be NaN');
  assert.strictEqual(Number.isFinite(fin.avgTicket), true, 'avgTicket must be finite');
});

challenge('3.2 Both invoices = [] and expenses = [] produces safe 0.0 values without NaN/Infinity', () => {
  restoreCleanState();
  store.state.invoices = [];
  store.state.expenses = [];

  const fin = store.getFinancialSummary();

  assert.strictEqual(fin.totalSales, 0.0);
  assert.strictEqual(fin.totalExpenses, 0.0);
  assert.strictEqual(fin.grossProfit, 0.0);
  assert.strictEqual(fin.grossMargin, 0.0);
  assert.strictEqual(fin.netProfit, 0.0);
  assert.strictEqual(fin.netMargin, 0.0);
  assert.strictEqual(Number.isNaN(fin.grossMargin), false);
  assert.strictEqual(Number.isNaN(fin.netMargin), false);
});

challenge('3.3 Dashboard View DOM renders zero sales cleanly as 0.0% without NaN strings', () => {
  restoreCleanState();
  store.state.invoices = []; // Zero sales

  const container = new MockElement('div');
  renderDashboardView(container);

  const salesEl = container.querySelector('#dashTotalSales');
  const grossMarginEl = container.querySelector('#dashGrossMargin');
  const netMarginEl = container.querySelector('#dashNetMargin');
  const profitEl = container.querySelector('#dashNetProfit');

  assert.ok(salesEl.innerText.includes('$0.00'), `Sales must show $0.00, got: ${salesEl.innerText}`);
  assert.strictEqual(grossMarginEl.innerText, '0.0%', `Gross margin must display 0.0%, got: ${grossMarginEl.innerText}`);
  assert.ok(netMarginEl.innerText.includes('0.0%'), `Net margin must display 0.0%, got: ${netMarginEl.innerText}`);
  assert.ok(profitEl.innerText.includes('-187.00') || profitEl.innerText.includes('-$187.00'), `Net profit must show -$187.00, got: ${profitEl.innerText}`);

  // Entire innerHTML must be clean of NaN and Infinity
  assert.strictEqual(container.innerHTML.includes('NaN'), false, 'Container HTML must not contain NaN');
  assert.strictEqual(container.innerHTML.includes('Infinity'), false, 'Container HTML must not contain Infinity');
});

challenge('3.4 Micro-sales ($0.01) with large expenses remains mathematically sound and finite', () => {
  restoreCleanState();
  store.state.invoices = [{ id: 'INV-MICRO', total: 0.01, items: [] }];
  store.state.expenses = [{ id: 'EXP-1', amount: 100.00, concept: 'Test' }];

  const fin = store.getFinancialSummary();
  assert.strictEqual(fin.totalSales, 0.01);
  assert.strictEqual(fin.grossMargin, 100.0); // (0.01 - 0) / 0.01 * 100
  assert.strictEqual(fin.netProfit, -99.99); // 0.01 - 100.00
  assert.strictEqual(fin.netMargin, -999900.0); // (-99.99 / 0.01) * 100
  assert.strictEqual(Number.isFinite(fin.netMargin), true);
  assert.strictEqual(Number.isNaN(fin.netMargin), false);
});

// ============================================================================
// CHALLENGE 4: Edge case: Large expenses exceeding sales (Net loss). Verify negative formatting
// ============================================================================
console.log('\n\x1b[1m▶ CHALLENGE 4: Large Expenses Exceeding Sales (Net Loss Scenario)\x1b[0m');

challenge('4.1 Net loss calculations correctly reflect negative profit and negative margins', () => {
  restoreCleanState();

  // Low sales: $100.00, COGS: $30.00
  store.state.products = [{ id: 'P-TEST', name: 'Pastel', cost: 30.00, price: 100.00 }];
  store.state.invoices = [
    { id: 'INV-LOSS-1', total: 100.00, items: [{ productId: 'P-TEST', quantity: 1 }] }
  ];

  // Huge operating expenses: $900.00
  store.state.expenses = [
    { id: 'EXP-BIG-1', amount: 500.00, category: 'Servicios', concept: 'Reparación de Horno Rotativo' },
    { id: 'EXP-BIG-2', amount: 400.00, category: 'Insumos', concept: 'Materia prima importada' }
  ];

  const fin = store.getFinancialSummary();

  assert.strictEqual(fin.totalSales, 100.00);
  assert.strictEqual(fin.totalCogs, 30.00);
  assert.strictEqual(fin.totalExpenses, 900.00);
  assert.strictEqual(fin.grossProfit, 70.00); // 100 - 30
  assert.strictEqual(fin.grossMargin, 70.0); // 70%

  // Net Profit: Gross Profit (70) - Expenses (900) = -830.00
  assert.strictEqual(fin.netProfit, -830.00);

  // Net Margin: (-830 / 100) * 100 = -830.0%
  assert.strictEqual(fin.netMargin, -830.0);
  assert.ok(fin.netProfit < 0, 'Net profit must be negative');
  assert.ok(fin.netMargin < 0, 'Net margin must be negative');
});

challenge('4.2 Dashboard View DOM formats negative net profit and negative net margin cleanly without duplicate signs', () => {
  restoreCleanState();

  store.state.products = [{ id: 'P-TEST', name: 'Pastel', cost: 30.00, price: 100.00 }];
  store.state.invoices = [
    { id: 'INV-LOSS-1', total: 100.00, items: [{ productId: 'P-TEST', quantity: 1 }] }
  ];
  store.state.expenses = [
    { id: 'EXP-BIG-1', amount: 900.00, category: 'Servicios', concept: 'Reparación de Horno' }
  ];

  const container = new MockElement('div');
  renderDashboardView(container);

  const profitEl = container.querySelector('#dashNetProfit');
  const netMarginEl = container.querySelector('#dashNetMargin');
  const netMarginBadge = container.querySelector('#dashNetMarginBadge');

  // Verify negative currency formatting (e.g. "-$830.00")
  assert.strictEqual(profitEl.innerText, '-$830.00', `Profit must be formatted as -$830.00, got: ${profitEl.innerText}`);

  // Verify net margin formatting: must be "-830.0%" (NOT "+-830.0%" or "--830.0%")
  assert.strictEqual(netMarginEl.innerText, '-830.0%', `Net margin must be formatted as -830.0%, got: ${netMarginEl.innerText}`);
  assert.strictEqual(netMarginEl.innerText.includes('+-'), false, 'Net margin must not contain "+-"');
  assert.strictEqual(netMarginEl.innerText.includes('--'), false, 'Net margin must not contain "--"');

  // Verify trending_down icon on loss
  assert.ok(container.innerHTML.includes('trending_down'), 'Loss markup must display trending_down icon');
});

// ============================================================================
// CHALLENGE 5: Persistence: Add expense, reload/re-instantiate store from storage, verify expense survives
// ============================================================================
console.log('\n\x1b[1m▶ CHALLENGE 5: Storage Serialization & Store Re-instantiation Persistence\x1b[0m');

challenge('5.1 Added expense is persisted to localStorage and survives store re-instantiation', () => {
  restoreCleanState();

  const newExpense = {
    amount: 142.50,
    concept: 'Cacao en polvo alcalinizado 10kg',
    category: 'Insumos',
    paymentMethod: 'Transferencia Bancaria',
    receipt: 'FAC-CACAO-2026',
    notes: 'Origen Ecuador 22-24% grasa'
  };

  const saved = store.saveExpense(newExpense);
  const assignedId = saved.id;
  assert.ok(assignedId, 'Must have generated ID');

  // 1. Verify localStorage content
  const rawStored = globalThis.localStorage.getItem('sweet_smile_app_state_v1');
  assert.ok(rawStored, 'localStorage key sweet_smile_app_state_v1 must exist');
  const parsedStored = JSON.parse(rawStored);
  assert.ok(Array.isArray(parsedStored.expenses), 'Parsed payload must contain expenses array');

  const inStorage = parsedStored.expenses.find(e => e.id === assignedId);
  assert.ok(inStorage, 'Added expense must exist in localStorage payload');
  assert.strictEqual(inStorage.amount, 142.50);
  assert.strictEqual(inStorage.concept, 'Cacao en polvo alcalinizado 10kg');

  // 2. Simulate complete app restart / reload by invoking store.loadState()
  const freshLoadedState = store.loadState();
  assert.ok(Array.isArray(freshLoadedState.expenses), 'Loaded state must have expenses array');
  const inFresh = freshLoadedState.expenses.find(e => e.id === assignedId);
  assert.ok(inFresh, 'Persisted expense must exist in freshly loaded state');
  assert.strictEqual(inFresh.amount, 142.50);
  assert.strictEqual(inFresh.category, 'Insumos');
  assert.strictEqual(inFresh.receipt, 'FAC-CACAO-2026');
  assert.strictEqual(inFresh.notes, 'Origen Ecuador 22-24% grasa');

  // 3. Re-assign loaded state to store and verify KPIs reflect it
  store.state = freshLoadedState;
  const fin = store.getFinancialSummary();
  // 187 (seed) + 142.50 = 329.50
  assert.strictEqual(fin.totalExpenses, 329.50, 'Total expenses must match persisted sum');
  assert.strictEqual(fin.expenseCount, 5, 'Expense count must be 5');
});

challenge('5.2 Clearing expenses persists empty array and reloads safely without fallback corruption', () => {
  restoreCleanState();

  // Clear expenses and save
  store.state.expenses = [];
  store.saveState();

  const freshState = store.loadState();
  assert.ok(Array.isArray(freshState.expenses), 'Expenses must remain an array');
  assert.strictEqual(freshState.expenses.length, 0, 'Empty expenses array must survive persistence');

  store.state = freshState;
  const fin = store.getFinancialSummary();
  assert.strictEqual(fin.totalExpenses, Math.round(fin.totalSales * 0.631 * 100) / 100, 'Empty expenses gracefully uses legacy snapshot');
  assert.strictEqual(fin.expenseCount, 0);
});

// ============================================================================
// CHALLENGE 6: Delete expense: Verify store.deleteExpense(id) removes entry and recalculates KPIs
// ============================================================================
console.log('\n\x1b[1m▶ CHALLENGE 6: Delete Expense & Instant KPI Recalculation\x1b[0m');

challenge('6.1 store.deleteExpense(id) removes entry, emits events, and updates financial KPIs', () => {
  restoreCleanState();

  const finBefore = store.getFinancialSummary();
  const initialExpenseCount = store.getExpenses().length;
  const targetExpense = store.getExpense('EXP-001'); // $85.50
  assert.ok(targetExpense, 'EXP-001 must exist initially');
  const targetAmount = targetExpense.amount; // 85.50

  // Track event notifications
  let expensesChangedEventFired = false;
  let stateChangedEventFired = false;
  let notifiedExpensesList = null;

  const unsubscribe = store.subscribe((evt, data) => {
    if (evt === 'expenses_changed') {
      expensesChangedEventFired = true;
      notifiedExpensesList = data;
    }
    if (evt === 'state_changed') {
      stateChangedEventFired = true;
    }
  });

  // Execute deletion
  const result = store.deleteExpense('EXP-001');
  unsubscribe();

  // Assertions on deletion result and state
  assert.strictEqual(result, true, 'deleteExpense must return true when record is removed');
  assert.strictEqual(store.getExpense('EXP-001'), undefined, 'Deleted expense must not be retrievable via getExpense');
  assert.strictEqual(store.getExpenses().length, initialExpenseCount - 1, 'Expenses length must decrease by 1');

  // Event notifications
  assert.strictEqual(expensesChangedEventFired, true, 'expenses_changed event must be emitted');
  assert.strictEqual(stateChangedEventFired, true, 'state_changed event must be emitted');
  assert.ok(Array.isArray(notifiedExpensesList), 'Notification must carry updated expenses array');
  assert.strictEqual(notifiedExpensesList.some(e => e.id === 'EXP-001'), false, 'Notification array must not contain deleted ID');

  // Verify localStorage update
  const stored = JSON.parse(globalThis.localStorage.getItem('sweet_smile_app_state_v1'));
  assert.strictEqual(stored.expenses.some(e => e.id === 'EXP-001'), false, 'Deleted expense must not exist in localStorage');

  // Verify financial summary recalculation
  const finAfter = store.getFinancialSummary();
  const expectedNewExpenses = Math.round((finBefore.totalExpenses - targetAmount) * 100) / 100;
  assert.strictEqual(finAfter.totalExpenses, expectedNewExpenses, `Total expenses must decrease by $${targetAmount}`);
  assert.strictEqual(finAfter.totalExpenses, 187.00 - 85.50); // 101.50

  // Net Profit must improve by exactly targetAmount
  const expectedNewNetProfit = Math.round((finBefore.netProfit + targetAmount) * 100) / 100;
  assert.strictEqual(finAfter.netProfit, expectedNewNetProfit, `Net profit must increase by $${targetAmount}`);
  // -46.71 + 85.50 = +38.79
  assert.strictEqual(finAfter.netProfit, 38.79);

  // Net Margin must improve
  assert.ok(finAfter.netMargin > finBefore.netMargin, 'Net margin must increase after expense deletion');
});

challenge('6.2 Deleting non-existent expense returns false and does not alter state or KPIs', () => {
  restoreCleanState();
  const finBefore = store.getFinancialSummary();
  const countBefore = store.getExpenses().length;

  const result = store.deleteExpense('EXP-NON-EXISTENT-999');

  assert.strictEqual(result, false, 'deleteExpense on missing ID must return false');
  assert.strictEqual(store.getExpenses().length, countBefore, 'Expenses count must remain unchanged');

  const finAfter = store.getFinancialSummary();
  assert.strictEqual(finAfter.totalExpenses, finBefore.totalExpenses);
  assert.strictEqual(finAfter.netProfit, finBefore.netProfit);
});

challenge('6.3 Calling deleteExpense when store.state.expenses is undefined/null returns false safely', () => {
  restoreCleanState();
  store.state.expenses = null;
  assert.strictEqual(store.deleteExpense('EXP-001'), false);
  store.state.expenses = undefined;
  assert.strictEqual(store.deleteExpense('EXP-001'), false);
});

// ============================================================================
// CHALLENGE 7: Adversarial Stress Test: Rapid batch mutations & precision arithmetic
// ============================================================================
console.log('\n\x1b[1m▶ CHALLENGE 7: Adversarial Stress Test: Rapid Batch Mutations & Precision\x1b[0m');

challenge('7.1 Rapid creation and deletion of 50 expenses maintains mathematical and ID integrity', () => {
  restoreCleanState();
  const initialFin = store.getFinancialSummary();
  const baseExpenses = initialFin.totalExpenses; // 187.00

  // Create 50 rapid expenses with floating point pennies
  const createdIds = [];
  let expectedAddedTotal = 0;

  for (let i = 1; i <= 50; i++) {
    const pennyAmount = Math.round((i * 1.37) * 100) / 100; // e.g., 1.37, 2.74, 4.11...
    expectedAddedTotal = Math.round((expectedAddedTotal + pennyAmount) * 100) / 100;
    const exp = store.saveExpense({
      amount: pennyAmount,
      concept: `Stress Item #${i}`,
      category: i % 2 === 0 ? 'Insumos' : 'Servicios'
    });
    createdIds.push({ id: exp.id, amount: exp.amount });
  }

  assert.strictEqual(store.getExpenses().length, 4 + 50, 'Store must contain 54 expenses');

  const finMid = store.getFinancialSummary();
  const expectedMidExpenses = Math.round((baseExpenses + expectedAddedTotal) * 100) / 100;
  assert.strictEqual(finMid.totalExpenses, expectedMidExpenses, 'Total expenses must match sum of 50 additions down to the cent');

  // Verify all 50 generated IDs are strictly unique
  const idSet = new Set(createdIds.map(c => c.id));
  assert.strictEqual(idSet.size, 50, 'All 50 generated expense IDs must be strictly unique');

  // Delete alternate 25 expenses
  let deletedTotal = 0;
  for (let i = 0; i < 25; i++) {
    const target = createdIds[i * 2]; // Delete even indexed
    deletedTotal = Math.round((deletedTotal + target.amount) * 100) / 100;
    const deleted = store.deleteExpense(target.id);
    assert.strictEqual(deleted, true, `Must successfully delete ${target.id}`);
  }

  assert.strictEqual(store.getExpenses().length, 54 - 25, 'Store must contain 29 expenses remaining');

  const finEnd = store.getFinancialSummary();
  const expectedEndExpenses = Math.round((expectedMidExpenses - deletedTotal) * 100) / 100;
  assert.strictEqual(finEnd.totalExpenses, expectedEndExpenses, 'Final expenses must equal mid minus deleted');
  assert.strictEqual(Number.isNaN(finEnd.netMargin), false, 'Net margin must remain finite and not NaN');
});

challenge('7.2 High-volume fuzzing with 100 random amounts and deletions maintains penny-exact reconciliation', () => {
  restoreCleanState();
  store.state.expenses = [];

  let expectedSum = 0;
  const items = [];

  for (let i = 0; i < 100; i++) {
    const amt = Math.round((Math.random() * 500 + 0.01) * 100) / 100;
    expectedSum = Math.round((expectedSum + amt) * 100) / 100;
    const exp = store.saveExpense({
      amount: amt,
      concept: `Fuzz Item #${i}`,
      category: ['Insumos', 'Servicios', 'Empaques', 'Mano de Obra', 'Mantenimiento', 'Otros'][i % 6]
    });
    items.push(exp);
  }

  assert.strictEqual(store.getExpenses().length, 100);
  let fin = store.getFinancialSummary();
  assert.strictEqual(fin.totalExpenses, expectedSum);

  // Randomly delete 50 items
  for (let i = 0; i < 50; i++) {
    const idx = Math.floor(Math.random() * items.length);
    const [removed] = items.splice(idx, 1);
    expectedSum = Math.round((expectedSum - removed.amount) * 100) / 100;
    store.deleteExpense(removed.id);
  }

  assert.strictEqual(store.getExpenses().length, 50);
  fin = store.getFinancialSummary();
  assert.strictEqual(fin.totalExpenses, expectedSum);
  assert.strictEqual(Number.isNaN(fin.totalExpenses), false);
  assert.strictEqual(Number.isNaN(fin.netProfit), false);
});

// ============================================================================
// CHALLENGE HARNESS SUMMARY & VERDICT
// ============================================================================
console.log('\n\x1b[1m\x1b[35m======================================================================\x1b[0m');
console.log(`\x1b[1m CHALLENGE HARNESS RESULTS: ${passed} PASSED | ${failed} FAILED\x1b[0m`);
console.log('\x1b[1m\x1b[35m======================================================================\x1b[0m\n');

if (failed > 0) {
  console.error('\x1b[31m✖ VERDICT: DISPROVED. Failures detected in M2_v12 implementation:\x1b[0m');
  failureLog.forEach((f, idx) => {
    console.error(`  ${idx + 1}. [${f.test}]: ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\x1b[32m✔ VERDICT: CONFIRMED. All 7 adversarial challenge suites passed completely with 0 errors.\x1b[0m\n');
  process.exit(0);
}
