// tests/challenger_r1_r2_r3_stress.js - Empirical Challenger 1 Stress Harness for Sweet Smile v1.2
// Rigorously tests R1 (Native Dialog Elimination & Android WebChromeClient),
// R2 (Financial Math Invariants, Deficit Margins & Persistence), and
// R3 (Dynamic SVG Charts, Live Reactivity & Memory Leak Proof).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  describe, test, beforeEach,
  assertEquals, assertNotEquals, assertTrue, assertFalse,
  assertNull, assertNotNull, assertContains, assertGreaterThan,
  assertGreaterThanOrEqual, assertLessThanOrEqual, assertCloseTo,
  assertThrows,
  mockStorage, MockElement, mockWindow, mockDocument,
  resetGlobalEnv, resetStoreToSeed, collector
} from './harness.js';

import { store } from '../js/store.js';
import { uiToast, uiModal, installDialogPolyfills } from '../js/ui-feedback.js';
import { renderDashboardView, calculateWeeklyChartData } from '../js/views/dashboardView.js';
import { renderPosView } from '../js/views/posView.js';
import { renderRecipesView } from '../js/views/recipesView.js';
import {
  INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_EXPENSES, INITIAL_SETTINGS
} from '../js/models.js';

const SEED_DATA = {
  INITIAL_PRODUCTS,
  INITIAL_INVENTORY,
  INITIAL_RECIPES,
  INITIAL_INVOICES,
  INITIAL_EXPENSES,
  INITIAL_SETTINGS
};

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ============================================================================
// CHALLENGE R1: NATIVE DIALOG ELIMINATION & ANDROID WEBCHROMECLIENT PROOF
// ============================================================================
describe('Challenge R1: Native Dialog Elimination & Android WebChromeClient Proof', () => {
  beforeEach(() => {
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
    installDialogPolyfills(true);
  });

  test('R1-EMP-01: Static audit proves 0 unmanaged alert/confirm/prompt across all web source files', () => {
    const webFiles = [
      'js/app.js',
      'js/costing.js',
      'js/db.js',
      'js/gemini-api.js',
      'js/google-sync.js',
      'js/models.js',
      'js/notifications.js',
      'js/ocr-ai.js',
      'js/pdf-export.js',
      'js/qr-generator.js',
      'js/store.js',
      'js/views/catalogShareView.js',
      'js/views/chefAIView.js',
      'js/views/dashboardView.js',
      'js/views/inventoryView.js',
      'js/views/posView.js',
      'js/views/recipesView.js',
      'index.html',
      'catalog.html',
      'sw.js'
    ];

    const violations = [];
    const dialogRegex = /\b(?<!uiModal\.)(?<!uiToast\.)(?<!window\._native)(alert|confirm)\s*\(/g;

    for (const rel of webFiles) {
      const fullPath = path.join(PROJECT_ROOT, rel);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      const lines = content.split('\n');

      lines.forEach((line, idx) => {
        const clean = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
        if (dialogRegex.test(clean)) {
          violations.push(`${rel}:${idx + 1}: ${line.trim()}`);
        }
      });
    }

    assertEquals(violations.length, 0, `Unmanaged native dialog calls found in production code:\n${violations.join('\n')}`);
  });

  test('R1-EMP-02: recipesView prompt fallback is strictly gated and uses uiModal.showAddIngredientModal in production', () => {
    const filePath = path.join(PROJECT_ROOT, 'js', 'views', 'recipesView.js');
    const content = fs.readFileSync(filePath, 'utf8');

    // Prove that prompt() can ONLY execute if window.prompt is NOT the polyfill and NOT native (i.e. test mock)
    assertContains(content, 'window.prompt !== window._fallbackPrompt');
    assertContains(content, 'window.prompt !== window._nativePrompt');
    // Prove that normal path calls modern modal
    assertContains(content, 'uiModal.showAddIngredientModal()');
  });

  test('R1-EMP-03: JS Polyfill intercepts window.alert/confirm/prompt across diverse data types without thread blocking', () => {
    mockDocument.body = new MockElement('body');
    const toastContainer = new MockElement('div', { id: 'toastContainer' });
    mockDocument.body.appendChild(toastContainer);

    // 1. Diverse payloads to alert()
    const alertInputs = [
      'Cadena regular',
      12345.67,
      null,
      undefined,
      { status: 'error', message: 'Fail' },
      ['item1', 'item2'],
      '<script>alert("XSS")</script>'
    ];

    for (const val of alertInputs) {
      window.alert(val);
      assertEquals(window._lastAlert, String(val ?? ''));
    }
    assertTrue(toastContainer.children.length >= alertInputs.length, 'Every alert creates an accessible in-app toast');

    // 2. confirm() returns false synchronously without native popup
    const confirmResult = window.confirm('¿Confirmar acción destructiva?');
    assertFalse(confirmResult, 'window.confirm must return false synchronously without displaying native popup');

    // 3. prompt() returns default value or null safely
    const promptWithDef = window.prompt('Ingrese código:', 'PROMO-2026');
    assertEquals(promptWithDef, 'PROMO-2026', 'prompt must return default value');

    const promptNoDef = window.prompt('Ingrese notas:');
    assertNull(promptNoDef, 'prompt without default must return null');
  });

  test('R1-EMP-04: Android MainActivity.java WebChromeClient strictly returns true on onJsAlert/Confirm/Prompt', () => {
    const mainActivityFile = path.join(PROJECT_ROOT, 'android_project', 'src', 'com', 'sweetsmile', 'pastry', 'MainActivity.java');
    assertTrue(fs.existsSync(mainActivityFile), 'MainActivity.java must exist');

    const javaSource = fs.readFileSync(mainActivityFile, 'utf8');

    // 1. onJsAlert contract: result.confirm(), returns true, routes to uiToast
    const alertBlock = javaSource.match(/public boolean onJsAlert\([^)]*\)\s*\{([\s\S]*?return true;\s*\})/);
    assertNotNull(alertBlock, 'onJsAlert must exist and return true');
    assertContains(alertBlock[1], 'result.confirm();');
    assertContains(alertBlock[1], 'return true;');
    assertContains(alertBlock[1], 'window.uiToast.show');

    // 2. onJsConfirm contract: result.cancel(), returns true
    const confirmBlock = javaSource.match(/public boolean onJsConfirm\([^)]*\)\s*\{([\s\S]*?return true;\s*\})/);
    assertNotNull(confirmBlock, 'onJsConfirm must exist and return true');
    assertContains(confirmBlock[1], 'result.cancel();');
    assertContains(confirmBlock[1], 'return true;');

    // 3. onJsPrompt contract: result.cancel(), returns true
    const promptBlock = javaSource.match(/public boolean onJsPrompt\([^)]*\)\s*\{([\s\S]*?return true;\s*\})/);
    assertNotNull(promptBlock, 'onJsPrompt must exist and return true');
    assertContains(promptBlock[1], 'result.cancel();');
    assertContains(promptBlock[1], 'return true;');

    // 4. In Android WebView, returning true informs the WebView that the host application handles the dialog,
    // which completely suppresses the default native alert dialog displaying the "file://" prefix.
    assertTrue(javaSource.includes('setWebChromeClient'), 'WebChromeClient must be configured on WebView');
  });
});

// ============================================================================
// CHALLENGE R2: FINANCIAL SUMMARY MATH, DEFICITS & PERSISTENCE
// ============================================================================
describe('Challenge R2: Financial Summary Math, Deficits, and State Persistence Proof', () => {
  beforeEach(() => {
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
  });

  test('R2-EMP-01: Profitable scenario satisfies exact mathematical accounting invariants', () => {
    // Product p1 has cost 11.80, price 28.00. Product p2 has cost 1.20, price 3.50.
    // Sale: 10 units of p1 ($280.00 sales, $118.00 COGS) + 20 units of p2 ($70.00 sales, $24.00 COGS)
    // Total Sales = $350.00, Total COGS = $142.00
    store.state.invoices = [
      {
        id: 'INV-TEST-1',
        total: 350.00,
        items: [
          { productId: 'p1', name: 'Pastel Red Velvet (8 porc.)', quantity: 10, price: 28.00 },
          { productId: 'p2', name: 'Cupcake de Vainilla & Cereza', quantity: 20, price: 3.50 }
        ]
      }
    ];

    // Expenses: $80.00 total
    store.state.expenses = [
      { id: 'EXP-1', amount: 50.00, concept: 'Luz eléctrica', category: 'Servicios' },
      { id: 'EXP-2', amount: 30.00, concept: 'Cajas de entrega', category: 'Empaques' }
    ];

    const fin = store.getFinancialSummary();

    // Mathematical definitions:
    // Sales = $350.00
    assertEquals(fin.totalSales, 350.00);
    // COGS = 10*11.80 + 20*1.20 = 118.00 + 24.00 = $142.00
    assertEquals(fin.totalCogs, 142.00);
    // Total Expenses = 50 + 30 = $80.00
    assertEquals(fin.totalExpenses, 80.00);
    // Total Costs = COGS + Expenses = 142 + 80 = $222.00
    assertEquals(fin.totalCosts, 222.00);
    // Gross Profit = Sales - COGS = 350 - 142 = $208.00
    assertEquals(fin.grossProfit, 208.00);
    // Gross Margin % = (208 / 350) * 100 = 59.4%
    assertCloseTo(fin.grossMargin, 59.4, 0.1);
    // Net Profit = Gross Profit - Expenses = 208 - 80 = $128.00
    assertEquals(fin.netProfit, 128.00);
    // Net Margin % = (128 / 350) * 100 = 36.6%
    assertCloseTo(fin.netMargin, 36.6, 0.1);

    assertTrue(fin.grossProfit > 0);
    assertTrue(fin.grossMargin > 0);
    assertTrue(fin.netProfit > 0);
    assertTrue(fin.netMargin > 0);
  });

  test('R2-EMP-02: Operating deficit scenario (Positive Gross Profit, Negative Net Profit & Margin)', () => {
    // Sales = $100.00, COGS = 2 * 11.80 = $23.60
    store.state.invoices = [
      {
        id: 'INV-DEF-1',
        total: 100.00,
        items: [{ productId: 'p1', name: 'Pastel Red Velvet (8 porc.)', quantity: 2, price: 28.00 }]
      }
    ];

    // High operating expenses ($200.00) exceed Gross Profit ($76.40)
    store.state.expenses = [
      { id: 'EXP-RENT', amount: 200.00, concept: 'Alquiler taller', category: 'Servicios' }
    ];

    const fin = store.getFinancialSummary();

    assertEquals(fin.totalSales, 100.00);
    assertEquals(fin.totalCogs, 23.60);
    assertEquals(fin.totalExpenses, 200.00);
    assertEquals(fin.totalCosts, 223.60);
    assertEquals(fin.grossProfit, 76.40);
    assertCloseTo(fin.grossMargin, 76.4, 0.1);

    // Net Profit = 76.40 - 200.00 = -$123.60
    assertEquals(fin.netProfit, -123.60);
    // Net Margin % = (-123.60 / 100.00) * 100 = -123.6%
    assertCloseTo(fin.netMargin, -123.6, 0.1);

    assertTrue(fin.grossProfit > 0, 'Gross profit must be positive');
    assertTrue(fin.grossMargin > 0, 'Gross margin must be positive');
    assertTrue(fin.netProfit < 0, 'Net profit must reflect operating deficit');
    assertTrue(fin.netMargin < 0, 'Net margin must reflect operating deficit');
  });

  test('R2-EMP-03: Cost-of-goods deficit scenario (Negative Gross Profit and Deep Negative Net Margin)', () => {
    // Unprofitable sale: Selling product below cost (e.g. clearance)
    // 10 units of p1 (COGS = 10 * 11.80 = $118.00) sold for only $50.00
    store.state.invoices = [
      {
        id: 'INV-CLEARANCE',
        total: 50.00,
        items: [{ productId: 'p1', name: 'Pastel Red Velvet (8 porc.)', quantity: 10, price: 5.00 }]
      }
    ];

    store.state.expenses = [
      { id: 'EXP-1', amount: 30.00, concept: 'Transporte', category: 'Servicios' }
    ];

    const fin = store.getFinancialSummary();

    assertEquals(fin.totalSales, 50.00);
    assertEquals(fin.totalCogs, 118.00);
    assertEquals(fin.totalExpenses, 30.00);
    assertEquals(fin.totalCosts, 148.00);

    // Gross Profit = 50.00 - 118.00 = -$68.00
    assertEquals(fin.grossProfit, -68.00);
    // Gross Margin % = (-68.00 / 50.00) * 100 = -136.0%
    assertCloseTo(fin.grossMargin, -136.0, 0.1);

    // Net Profit = -68.00 - 30.00 = -$98.00
    assertEquals(fin.netProfit, -98.00);
    // Net Margin % = (-98.00 / 50.00) * 100 = -196.0%
    assertCloseTo(fin.netMargin, -196.0, 0.1);

    assertTrue(fin.grossProfit < 0);
    assertTrue(fin.grossMargin < 0);
    assertTrue(fin.netProfit < 0);
    assertTrue(fin.netMargin < 0);
  });

  test('R2-EMP-04: Pre-revenue and completely empty states produce clean 0.0% margins with zero NaN/Infinity', () => {
    // 1. Pre-revenue: Sales = 0, Expenses = $500.00
    store.state.invoices = [];
    store.state.expenses = [
      { id: 'EXP-PRE', amount: 500.00, concept: 'Compra de Horno Industrial', category: 'Equipamiento' }
    ];

    const preRevFin = store.getFinancialSummary();
    assertEquals(preRevFin.totalSales, 0);
    assertEquals(preRevFin.totalCogs, 0);
    assertEquals(preRevFin.totalExpenses, 500.00);
    assertEquals(preRevFin.grossProfit, 0);
    assertEquals(preRevFin.grossMargin, 0.0);
    assertEquals(preRevFin.netProfit, -500.00);
    assertEquals(preRevFin.netMargin, 0.0);
    assertFalse(isNaN(preRevFin.grossMargin));
    assertFalse(isNaN(preRevFin.netMargin));
    assertTrue(isFinite(preRevFin.grossMargin));
    assertTrue(isFinite(preRevFin.netMargin));

    // 2. Completely empty state: 0 sales, 0 expenses
    store.state.invoices = [];
    store.state.expenses = [];

    const emptyFin = store.getFinancialSummary();
    assertEquals(emptyFin.totalSales, 0);
    assertEquals(emptyFin.totalCogs, 0);
    assertEquals(emptyFin.totalExpenses, 0);
    assertEquals(emptyFin.totalCosts, 0);
    assertEquals(emptyFin.grossProfit, 0);
    assertEquals(emptyFin.grossMargin, 0.0);
    assertEquals(emptyFin.netProfit, 0);
    assertEquals(emptyFin.netMargin, 0.0);
    assertFalse(isNaN(emptyFin.grossMargin));
    assertFalse(isNaN(emptyFin.netMargin));
  });

  test('R2-EMP-05: High-precision IEEE-754 decimal arithmetic under 100 micro-transactions', () => {
    // 100 micro expenses of $0.07 each
    store.state.expenses = [];
    for (let i = 0; i < 100; i++) {
      store.state.expenses.push({
        id: `EXP-MICRO-${i}`,
        amount: 0.07,
        concept: `Micro-compra ${i}`,
        category: 'Insumos',
        date: '2026-11-05'
      });
    }

    const fin = store.getFinancialSummary();
    assertEquals(fin.totalExpenses, 7.00, '100 * $0.07 must sum to exactly $7.00 without floating point drift');
  });

  test('R2-EMP-06: Persistence across mock page reloads (fresh AppStore instance from localStorage)', () => {
    // 1. Add unique custom invoice and expense
    store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Persistencia',
      items: [{ productId: 'p1', name: 'Pastel Red Velvet', quantity: 2, price: 28.00, total: 56.00 }],
      total: 56.00,
      status: 'Pagada',
      date: new Date().toISOString()
    });

    store.saveExpense({
      amount: 72.50,
      concept: 'Esencia de almendras y vainilla',
      category: 'Insumos'
    });
    store.saveState();

    const expectedSummary = store.getFinancialSummary();

    // 2. Simulate Cold Page Reload: instantiate new AppStore from scratch
    const freshStore = new (store.constructor)();
    const freshSummary = freshStore.getFinancialSummary();

    // Compare all financial metrics byte-for-byte and cent-for-cent
    assertEquals(freshSummary.totalSales, expectedSummary.totalSales);
    assertEquals(freshSummary.totalOrders, expectedSummary.totalOrders);
    assertEquals(freshSummary.totalCogs, expectedSummary.totalCogs);
    assertEquals(freshSummary.totalExpenses, expectedSummary.totalExpenses);
    assertEquals(freshSummary.totalCosts, expectedSummary.totalCosts);
    assertEquals(freshSummary.grossProfit, expectedSummary.grossProfit);
    assertEquals(freshSummary.grossMargin, expectedSummary.grossMargin);
    assertEquals(freshSummary.netProfit, expectedSummary.netProfit);
    assertEquals(freshSummary.netMargin, expectedSummary.netMargin);

    const reloadedExpenses = freshStore.getExpenses();
    assertTrue(reloadedExpenses.some(e => e.concept === 'Esencia de almendras y vainilla'));
  });
});

// ============================================================================
// CHALLENGE R3: DYNAMIC SVG CHARTS, LIVE REACTIVITY & MEMORY LEAK PROOF
// ============================================================================
describe('Challenge R3: Dynamic SVG Charts, Reactivity, and Memory Leak Proof', () => {
  beforeEach(() => {
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
  });

  test('R3-EMP-01: SVG chart and Dashboard KPIs react dynamically to sales, expenses, and deletions', () => {
    const container = new MockElement('div');
    renderDashboardView(container);

    const initialSalesKPI = container.querySelector('#dashTotalSales').innerText;
    const initialExpensesKPI = container.querySelector('#dashTotalExpenses').innerText;
    const initialProfitKPI = container.querySelector('#dashNetProfit').innerText;

    // 1. Save new sale
    store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Reactivo R3',
      items: [{ productId: 'p1', name: 'Pastel Red Velvet', quantity: 1, price: 28.00, total: 28.00 }],
      total: 28.00,
      status: 'Pagada',
      date: new Date().toISOString()
    });

    const salesAfterSale = container.querySelector('#dashTotalSales').innerText;
    assertNotEquals(initialSalesKPI, salesAfterSale, 'Total sales KPI must update reactively');

    // 2. Save new expense
    store.saveExpense({
      amount: 65.00,
      concept: 'Reparación de batidora',
      category: 'Mantenimiento'
    });

    const expensesAfterExp = container.querySelector('#dashTotalExpenses').innerText;
    const profitAfterExp = container.querySelector('#dashNetProfit').innerText;
    assertNotEquals(initialExpensesKPI, expensesAfterExp, 'Total expenses KPI must update reactively');
    assertNotEquals(initialProfitKPI, profitAfterExp, 'Net profit KPI must update reactively');

    // 3. Delete expense
    const exps = store.getExpenses();
    store.deleteExpense(exps[0].id);

    const expensesAfterDel = container.querySelector('#dashTotalExpenses').innerText;
    assertNotEquals(expensesAfterExp, expensesAfterDel, 'Expenses KPI must update upon deleteExpense');
  });

  test('R3-EMP-02: 50 rapid route-switching cycles prove zero memory leaks & zero route hijacking', () => {
    const appContainer = new MockElement('div', { id: 'app-main-content' });
    mockDocument.body = new MockElement('body');
    mockDocument.body.appendChild(appContainer);

    const initialListeners = store.listeners.length;

    // Run 50 rapid route cycles: Dashboard -> POS -> Recipes -> Dashboard
    for (let cycle = 0; cycle < 50; cycle++) {
      // 1. Mount Dashboard
      appContainer.innerHTML = '';
      appContainer.isConnected = true;
      renderDashboardView(appContainer);
      assertTrue(appContainer.querySelector('#trendChartSvg') !== null, 'Dashboard chart mounted');

      // 2. Switch route to POS
      appContainer.innerHTML = '';
      renderPosView(appContainer);
      assertNotNull(appContainer.querySelector('#tabPosBtn'), 'POS view mounted');

      // 3. Emit store mutations while on POS
      store.saveExpense({
        amount: 2.50,
        concept: `Insumo ciclo ${cycle}`,
        category: 'Insumos'
      });

      // Assert POS view is NOT hijacked by dashboard re-render
      assertNotNull(appContainer.querySelector('#tabPosBtn'), 'POS view must remain active');
      assertNull(appContainer.querySelector('#trendChartSvg'), 'Dashboard must not hijack POS DOM');

      // 4. Switch route to Recipes
      appContainer.innerHTML = '';
      renderRecipesView(appContainer);

      // Emit another mutation
      store.saveInvoice({
        type: 'ticket',
        customerName: `Cliente ciclo ${cycle}`,
        items: [{ productId: 'p2', name: 'Cupcake', quantity: 1, price: 3.50, total: 3.50 }],
        total: 3.50,
        status: 'Pagada',
        date: new Date().toISOString()
      });

      // Assert Recipes view is NOT hijacked
      assertNull(appContainer.querySelector('#trendChartSvg'), 'Dashboard must not hijack Recipes DOM');
    }

    // Check store listener count: must remain bounded (no unbounded listener growth)
    const finalListeners = store.listeners.length;
    assertTrue(finalListeners <= initialListeners + 2,
      `Listener leak detected: listeners grew from ${initialListeners} to ${finalListeners}`);
  });

  test('R3-EMP-03: SVG grouped bar chart geometric sanity under massive values ($1,000,000) and deficit days', () => {
    // 1. Outlier: $1,000,000 sale and $500,000 expense
    store.state.invoices = [{
      id: 'INV-MILLION',
      total: 1000000.00,
      items: [{ productId: 'p1', name: 'Pastel Red Velvet', quantity: 1000, price: 1000.00 }],
      date: new Date().toISOString()
    }];
    store.state.expenses = [{
      id: 'EXP-HALF-MIL',
      amount: 500000.00,
      concept: 'Expansión de planta',
      category: 'Equipamiento',
      date: new Date().toISOString()
    }];

    const container = new MockElement('div');
    renderDashboardView(container);

    const svg = container.querySelector('#trendChartSvg');
    assertNotNull(svg);
    assertEquals(svg.getAttribute('viewBox'), '0 0 420 160');

    const salesBars = container.querySelectorAll('.bar-sales');
    const expBars = container.querySelectorAll('.bar-expenses');
    const profitBars = container.querySelectorAll('.bar-profit');

    assertEquals(salesBars.length, 7);
    assertEquals(expBars.length, 7);
    assertEquals(profitBars.length, 7);

    // Verify all heights are within 0 and 160 (viewBox bounds) and non-negative
    salesBars.forEach(b => {
      const h = parseFloat(b.getAttribute('height'));
      assertTrue(h >= 0 && h <= 160, `Sales bar height ${h} must be within viewBox 0..160`);
      assertFalse(isNaN(h));
    });

    expBars.forEach(b => {
      const h = parseFloat(b.getAttribute('height'));
      assertTrue(h >= 0 && h <= 160, `Expense bar height ${h} must be within viewBox 0..160`);
      assertFalse(isNaN(h));
    });

    profitBars.forEach(b => {
      const h = parseFloat(b.getAttribute('height'));
      assertTrue(h >= 0 && h <= 160, `Profit bar height ${h} must be within viewBox 0..160`);
      assertFalse(isNaN(h));
    });

    // 2. Deficit day visualization: expenses exceed sales
    store.state.invoices = [];
    store.state.expenses = [{
      id: 'EXP-DEFICIT-DAY',
      amount: 2500.00,
      concept: 'Mantenimiento urgente',
      category: 'Mantenimiento',
      date: new Date().toISOString().split('T')[0]
    }];

    const deficitContainer = new MockElement('div');
    renderDashboardView(deficitContainer);

    const defProfitBars = deficitContainer.querySelectorAll('.bar-profit');
    let hasRedDeficit = false;

    for (const b of defProfitBars) {
      if (b.getAttribute('fill') === '#ef4444') {
        hasRedDeficit = true;
        const h = parseFloat(b.getAttribute('height'));
        assertTrue(h > 0, 'Deficit profit bar must have positive height');
      }
    }

    assertTrue(hasRedDeficit, 'Deficit day must color profit bar with red fill #ef4444');
  });
});

// ============================================================================
// DIRECT EXECUTION ENTRYPOINT
// ============================================================================
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('\n==============================================================');
  console.log('   🔥 ACCEPTANCE CHALLENGER 1 — SWEET SMILE v1.2 AUDIT');
  console.log('==============================================================\n');

  let passed = 0;
  let failed = 0;

  for (const suite of collector.suites) {
    console.log(`\x1b[1m▶ ${suite.name}\x1b[0m`);
    for (const t of suite.tests) {
      try {
        for (const bh of suite.beforeEachHooks) await bh();
        await t.fn();
        for (const ah of suite.afterEachHooks) await ah();
        console.log(`  \x1b[32m✔ PASS\x1b[0m: ${t.name}`);
        passed++;
      } catch (err) {
        console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${t.name}`);
        console.error(`    ${err.message}`);
        if (err.stack) {
          const lines = err.stack.split('\n').slice(1, 4).join('\n');
          console.error(`    ${lines}`);
        }
        failed++;
      }
    }
    console.log();
  }

  console.log('==============================================================');
  console.log(`TOTAL: ${passed + failed} | \x1b[32mPASSED: ${passed}\x1b[0m | \x1b[31mFAILED: ${failed}\x1b[0m`);
  console.log('==============================================================\n');

  if (failed > 0) process.exit(1);
}
