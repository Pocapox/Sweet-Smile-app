// tests/empirical_challenge_m4_v12.js - Empirical Adversarial Challenge for Sweet Smile v1.2 M4
// Strict validation of the complete E2E integration flow:
// POS Sale -> Stock & Pantry deducted -> Invoice saved -> Expense added ->
// Financial summary recomputed -> Dynamic chart reacts -> Storage persists
// Plus adversarial abuse stress testing and APK binary verification.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

import {
  describe, test, beforeEach, afterEach,
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
// SUITE 1: FULL E2E INTEGRATION FLOW (POS -> PANTRY -> INVOICE -> EXPENSE -> FINANCES -> CHART -> PERSISTENCE)
// ============================================================================
describe('Empirical M4: Full End-to-End Integration Flow', () => {
  beforeEach(() => {
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
    installDialogPolyfills(true);
  });

  test('E2E-01: POS Sale deducts product stock and linked recipe pantry ingredients, and saves invoice', () => {
    // Product p6: "Pastel Selva Negra Especial 20cm", price 34.75, cost 13.90, stock 5, recipeId: "rec-042"
    // Recipe rec-042 requires:
    // - Harina de Trigo Especial: 0.40 kg (matches inv-2, stock 45.0 kg)
    // - Mantequilla sin sal 82%: 0.25 kg (matches inv-1, stock 2.5 kg)
    // - Chocolate amargo 70%: 0.20 kg (matches inv-7, stock 8.5 kg)
    // - Huevos frescos: 4 unid (matches inv-6, stock 120.0 unid)
    // - Empaque & Cinta: 1 kit (matches inv-10, stock 60.0 kit)

    const initialP6 = store.getProduct('p6');
    assertEquals(initialP6.stock, 5, 'Initial p6 stock must be 5');

    const inv1 = store.getInventoryItem('inv-1');
    const inv2 = store.getInventoryItem('inv-2');
    const inv7 = store.getInventoryItem('inv-7');
    const inv6 = store.getInventoryItem('inv-6');
    const inv10 = store.getInventoryItem('inv-10');

    assertEquals(inv1.stock, 2.5, 'Initial Mantequilla stock must be 2.5');
    assertEquals(inv2.stock, 45.0, 'Initial Harina stock must be 45.0');
    assertEquals(inv7.stock, 8.5, 'Initial Chocolate stock must be 8.5');
    assertEquals(inv6.stock, 120.0, 'Initial Huevos stock must be 120.0');
    assertEquals(inv10.stock, 60.0, 'Initial Empaque stock must be 60.0');

    const initialInvoicesCount = store.getInvoices().length;

    // Track event emissions
    const emittedEvents = [];
    const unsub = store.subscribe((evt) => emittedEvents.push(evt));

    // Execute POS Sale: 2 units of p6
    const saleInvoice = store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Prueba E2E',
      customerDoc: 'CF',
      items: [
        {
          productId: 'p6',
          name: 'Pastel Selva Negra Especial 20cm',
          quantity: 2,
          price: 34.75,
          total: 69.50
        }
      ],
      subtotal: 69.50,
      discountPercent: 0,
      discountAmount: 0,
      tip: 0,
      total: 69.50,
      paymentMethod: 'Efectivo',
      status: 'Pagada',
      date: new Date().toISOString()
    });

    unsub();

    // 1. Verify invoice saved
    assertNotNull(saleInvoice.id, 'Invoice ID must be generated');
    assertTrue(saleInvoice.id.startsWith('TIK-'), 'Ticket invoice ID must start with TIK-');
    assertEquals(store.getInvoices().length, initialInvoicesCount + 1, 'Invoices count must increment by 1');
    assertEquals(store.getInvoices()[0].id, saleInvoice.id, 'New invoice must be unshifted to top');

    // 2. Verify product stock deducted
    const updatedP6 = store.getProduct('p6');
    assertEquals(updatedP6.stock, 3, 'p6 stock must decrease from 5 to 3 (5 - 2)');

    // 3. Verify recipe ingredients deducted from pantry
    // Mantequilla (inv-1): 2.5 - (0.25 * 2) = 2.0
    assertEquals(store.getInventoryItem('inv-1').stock, 2.0, 'Mantequilla stock must decrease by 0.50 kg');
    // Harina (inv-2): 45.0 - (0.40 * 2) = 44.20
    assertEquals(store.getInventoryItem('inv-2').stock, 44.20, 'Harina stock must decrease by 0.80 kg');
    // Chocolate (inv-7): 8.5 - (0.20 * 2) = 8.10
    assertEquals(store.getInventoryItem('inv-7').stock, 8.10, 'Chocolate stock must decrease by 0.40 kg');
    // Huevos (inv-6): 120.0 - (4 * 2) = 112.0
    assertEquals(store.getInventoryItem('inv-6').stock, 112.0, 'Huevos stock must decrease by 8 unid');
    // Empaque (inv-10): 60.0 - (1 * 2) = 58.0
    assertEquals(store.getInventoryItem('inv-10').stock, 58.0, 'Empaque stock must decrease by 2 kits');

    // 4. Verify event emissions
    assertTrue(emittedEvents.includes('products_changed'), 'Must emit products_changed');
    assertTrue(emittedEvents.includes('inventory_changed'), 'Must emit inventory_changed');
    assertTrue(emittedEvents.includes('invoices_changed'), 'Must emit invoices_changed');
  });

  test('E2E-02: Expense registration validates inputs, creates ID, and appends to ledger', () => {
    // 1. Rejection of negative amount
    assertThrows(() => {
      store.saveExpense({ amount: -50, concept: 'Gasto Inválido', category: 'Insumos' });
    });

    // 2. Rejection of zero amount
    assertThrows(() => {
      store.saveExpense({ amount: 0, concept: 'Gasto Cero', category: 'Insumos' });
    });

    // 3. Rejection of missing concept
    assertThrows(() => {
      store.saveExpense({ amount: 75, concept: '   ', category: 'Insumos' });
    });

    const initialExpCount = store.getExpenses().length; // 4
    let expenseEventFired = false;
    store.subscribe((evt) => {
      if (evt === 'expenses_changed') expenseEventFired = true;
    });

    // 4. Save valid expense
    const newExp = store.saveExpense({
      amount: 45.50,
      concept: 'Mantenimiento preventivo batidora planetaria',
      category: 'Mantenimiento',
      paymentMethod: 'Transferencia'
    });

    assertTrue(expenseEventFired, 'expenses_changed event must fire');
    assertNotNull(newExp.id);
    assertTrue(newExp.id.startsWith('EXP-'), 'Expense ID must start with EXP-');
    assertEquals(newExp.amount, 45.50);
    assertEquals(store.getExpenses().length, initialExpCount + 1, 'Expenses length must increase by 1');
    assertEquals(store.getExpenses()[0].id, newExp.id, 'New expense must be unshifted to top');
  });

  test('E2E-03: Financial summary recomputes with mathematical fidelity and accounting invariants', () => {
    // 1. Record sale of 2 Selva Negra ($69.50 total, COGS = 2 * 13.90 = $27.80)
    store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Contable',
      items: [{ productId: 'p6', name: 'Pastel Selva Negra Especial 20cm', quantity: 2, price: 34.75, total: 69.50 }],
      total: 69.50,
      status: 'Pagada',
      date: new Date().toISOString()
    });

    // 2. Record new expense ($45.50 in Empaques)
    store.saveExpense({
      amount: 45.50,
      concept: 'Cajas decoradas',
      category: 'Empaques'
    });

    // 3. Recompute financial summary
    const fin = store.getFinancialSummary();

    // Verify mathematical invariants
    // Total sales = Seed sales (232.69) + 69.50 = 302.19
    assertCloseTo(fin.totalSales, 302.19, 0.01, 'Total Sales must match sum of all invoices');

    // Total orders = 4 + 1 = 5
    assertEquals(fin.totalOrders, 5, 'Total orders must be 5');

    // COGS = Seed COGS (92.40) + 27.80 = 120.20
    assertCloseTo(fin.totalCogs, 120.20, 0.01, 'COGS must equal seed COGS + new sale COGS');

    // Total expenses = Seed expenses (187.00) + 45.50 = 232.50
    assertCloseTo(fin.totalExpenses, 232.50, 0.01, 'Total expenses must match sum of all expenses');

    // Total costs = COGS + Expenses = 120.20 + 232.50 = 352.70
    assertCloseTo(fin.totalCosts, 352.70, 0.01, 'Total costs must equal COGS + Expenses');

    // Gross profit = Sales - COGS = 302.19 - 120.20 = 181.99
    assertCloseTo(fin.grossProfit, 181.99, 0.01, 'Gross profit must equal Sales - COGS');

    // Gross margin % = (181.99 / 302.19) * 100 = 60.2%
    assertCloseTo(fin.grossMargin, 60.2, 0.1, 'Gross margin % must equal (Gross Profit / Sales) * 100');

    // Net profit = Gross profit - Total expenses = 181.99 - 232.50 = -50.51
    assertCloseTo(fin.netProfit, -50.51, 0.01, 'Net profit must equal Gross profit - Expenses');

    // Net margin % = (-50.51 / 302.19) * 100 = -16.7%
    assertCloseTo(fin.netMargin, -16.7, 0.1, 'Net margin % must reflect operating deficit correctly');

    // Expenses by category: Seed Empaques ($24.50) + new ($45.50) = $70.00
    assertEquals(fin.expensesByCategory['Empaques'], 70.00, 'Empaques category sum must be updated');
  });

  test('E2E-04: Dynamic SVG chart and Dashboard KPIs react live to newly saved sales and expenses', () => {
    mockDocument.body = new MockElement('body');
    const container = new MockElement('div');
    mockDocument.body.appendChild(container);

    renderDashboardView(container);

    // Initial check of KPIs
    const initialSalesText = container.querySelector('#dashTotalSales').innerText;
    const initialExpText = container.querySelector('#dashTotalExpenses').innerText;
    const initialGrossBadge = container.querySelector('#dashGrossMarginBadge').innerText;

    // Trigger POS sale
    store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Reactivo E2E',
      items: [{ productId: 'p1', name: 'Pastel Red Velvet', quantity: 1, price: 28.00, total: 28.00 }],
      total: 28.00,
      status: 'Pagada',
      date: new Date().toISOString()
    });

    const afterSaleSalesText = container.querySelector('#dashTotalSales').innerText;
    assertNotEquals(initialSalesText, afterSaleSalesText, 'dashTotalSales must react immediately');

    // Trigger expense addition
    store.saveExpense({
      amount: 100.00,
      concept: 'Servicio Eléctrico Mensual',
      category: 'Servicios'
    });

    const afterExpText = container.querySelector('#dashTotalExpenses').innerText;
    assertNotEquals(initialExpText, afterExpText, 'dashTotalExpenses must react immediately');

    // Verify SVG Chart exists and is rendered
    const svg = container.querySelector('#trendChartSvg');
    assertNotNull(svg, '#trendChartSvg must exist');
    assertEquals(svg.getAttribute('viewBox'), '0 0 420 160');

    const dayColumns = container.querySelectorAll('.chart-day');
    assertEquals(dayColumns.length, 7, 'Must render 7 day columns');

    // Click on day column updates audit summary
    dayColumns[6].dispatchEvent('click');
    const auditSummary = container.querySelector('#chartAuditSummary');
    assertNotNull(auditSummary);

    // Verify segmented progress bar
    const segBar = container.querySelector('#expenseSegmentedBar');
    assertNotNull(segBar);
    const segments = segBar.querySelectorAll('[data-category]');
    assertTrue(segments.length > 0, 'Category segments must be rendered');
  });

  test('E2E-05: Storage persists updated state and cold-start rehydration preserves all data byte-for-byte', () => {
    // Perform sale
    const inv = store.saveInvoice({
      type: 'factura',
      customerName: 'Empresa Dulce S.A.',
      customerDoc: 'B150001234',
      items: [{ productId: 'p2', name: 'Cupcake de Vainilla', quantity: 4, price: 3.50, total: 14.00 }],
      total: 14.00,
      status: 'Pagada',
      date: new Date().toISOString()
    });

    // Perform expense
    const exp = store.saveExpense({
      amount: 25.00,
      concept: 'Gas propano repuesto',
      category: 'Servicios'
    });

    // Check localStorage payload
    const rawStorage = mockStorage.getItem(store.storageKey);
    assertNotNull(rawStorage, 'localStorage must contain serialized state');

    const parsed = JSON.parse(rawStorage);
    assertTrue(parsed.invoices.some(i => i.id === inv.id), 'Saved invoice must exist in localStorage');
    assertTrue(parsed.expenses.some(e => e.id === exp.id), 'Saved expense must exist in localStorage');

    // Simulate Cold Start: create a new Store instance from scratch
    const coldStore = new (store.constructor)();
    const coldFin = coldStore.getFinancialSummary();

    assertEquals(coldStore.getInvoices().length, store.getInvoices().length, 'Invoices count preserved');
    assertEquals(coldStore.getExpenses().length, store.getExpenses().length, 'Expenses count preserved');
    assertEquals(coldStore.getProduct('p2').stock, store.getProduct('p2').stock, 'Product stock preserved');
    assertEquals(coldFin.totalSales, store.getFinancialSummary().totalSales, 'Total sales preserved');
    assertEquals(coldFin.totalExpenses, store.getFinancialSummary().totalExpenses, 'Total expenses preserved');
    assertEquals(coldFin.netProfit, store.getFinancialSummary().netProfit, 'Net profit preserved');
  });
});

// ============================================================================
// SUITE 2: ADVERSARIAL EDGE CASES & ABUSE HARNESS
// ============================================================================
describe('Empirical M4: Adversarial Stress & Edge Abuse', () => {
  beforeEach(() => {
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
    installDialogPolyfills(true);
  });

  test('ADV-01: Massive over-ordering does not cause negative product or pantry stock (clamped to 0)', () => {
    // Product p1 has stock 4
    const prod = store.getProduct('p1');
    assertEquals(prod.stock, 4);

    // Order 500 units
    store.saveInvoice({
      type: 'ticket',
      customerName: 'Acaparador',
      items: [{ productId: 'p1', name: 'Pastel Red Velvet (8 porc.)', quantity: 500, price: 28.00, total: 14000.00 }],
      total: 14000.00,
      status: 'Pagada'
    });

    assertEquals(store.getProduct('p1').stock, 0, 'Product stock must clamp to 0 and NEVER be negative');

    // Linked inventory items must also clamp to 0 without negative numbers
    store.getInventory().forEach(inv => {
      assertTrue(inv.stock >= 0, `Inventory item ${inv.id} (${inv.name}) stock (${inv.stock}) must be >= 0`);
    });
  });

  test('ADV-02: Zero-Sales and massive operating deficit handles divisions cleanly without NaN or Infinity', () => {
    // Clear all invoices
    store.state.invoices = [];

    // Inject massive expenses
    store.saveExpense({ amount: 15000.00, concept: 'Alquiler anual de local', category: 'Servicios' });

    const fin = store.getFinancialSummary();
    assertEquals(fin.totalSales, 0, 'Sales must be 0');
    assertEquals(fin.totalCogs, 0, 'COGS must be 0');
    assertCloseTo(fin.totalExpenses, 187.00 + 15000.00, 0.01);
    assertCloseTo(fin.netProfit, -(187.00 + 15000.00), 0.01);

    assertEquals(fin.grossMargin, 0.0, 'Gross margin on 0 sales must be 0.0%');
    assertEquals(fin.netMargin, 0.0, 'Net margin on 0 sales must be 0.0%');
    assertFalse(isNaN(fin.grossMargin), 'Gross margin must NOT be NaN');
    assertFalse(isNaN(fin.netMargin), 'Net margin must NOT be NaN');
    assertTrue(isFinite(fin.grossMargin), 'Gross margin must be finite');
    assertTrue(isFinite(fin.netMargin), 'Net margin must be finite');
  });

  test('ADV-03: Rapid-fire mutation barrage (100 interleaved operations) maintains financial consistency', () => {
    for (let i = 0; i < 50; i++) {
      // Sale
      store.saveInvoice({
        type: 'ticket',
        customerName: `Cliente Barrage ${i}`,
        items: [{ productId: 'p4', name: 'Galletas Chispas Chocolate', quantity: 1, price: 7.50, total: 7.50 }],
        total: 7.50,
        status: 'Pagada',
        date: new Date().toISOString()
      });

      // Expense
      store.saveExpense({
        amount: 3.25,
        concept: `Gasto menor ${i}`,
        category: 'Insumos',
        date: new Date().toISOString().slice(0, 10)
      });
    }

    const fin = store.getFinancialSummary();
    assertTrue(fin.totalSales > 0);
    assertTrue(fin.totalExpenses > 0);

    // Verify mathematical relation strictly
    assertCloseTo(fin.grossProfit, Math.round((fin.totalSales - fin.totalCogs) * 100) / 100, 0.01);
    assertCloseTo(fin.netProfit, Math.round((fin.grossProfit - fin.totalExpenses) * 100) / 100, 0.01);
    assertCloseTo(fin.totalCosts, Math.round((fin.totalCogs + fin.totalExpenses) * 100) / 100, 0.01);
  });

  test('ADV-04: Cross-route isolation: store events on POS do NOT hijack or overwrite POS DOM', () => {
    const appContainer = new MockElement('div');
    renderPosView(appContainer);

    assertNotNull(appContainer.querySelector('#tabPosBtn'), 'POS tab mounted');

    // Trigger store modifications in background
    store.saveExpense({ amount: 120.00, concept: 'Mantenimiento horno', category: 'Mantenimiento' });
    store.saveInvoice({
      type: 'ticket',
      customerName: 'Venta background',
      items: [{ productId: 'p1', name: 'Pastel', quantity: 1, price: 28.00, total: 28.00 }],
      total: 28.00,
      status: 'Pagada'
    });

    // POS View must remain intact
    assertNotNull(appContainer.querySelector('#tabPosBtn'), 'POS view must not be corrupted');
    assertNull(appContainer.querySelector('#trendChartSvg'), 'Dashboard chart must not leak into POS view');
  });

  test('ADV-05: Native dialog suppression: window.alert, confirm, prompt generate no unmanaged alerts', () => {
    mockDocument.body = new MockElement('body');
    const toastContainer = new MockElement('div', { id: 'toastContainer' });
    mockDocument.body.appendChild(toastContainer);

    // window.alert -> Toast
    window.alert('Mensaje de prueba');
    assertTrue(toastContainer.children.length >= 1, 'Toast must be created');
    assertContains(toastContainer.children[0].innerHTML, 'Mensaje de prueba');

    // window.confirm -> false without blocking
    const cRes = window.confirm('¿Desea borrar la base de datos?');
    assertFalse(cRes, 'window.confirm must return false synchronously');

    // window.prompt -> defaultValue or null
    const pRes1 = window.prompt('Ingrese PIN:', '1234');
    assertEquals(pRes1, '1234');
    const pRes2 = window.prompt('Ingrese PIN:');
    assertNull(pRes2);
  });
});

// ============================================================================
// SUITE 3: APK BUILD INTEGRITY, TOOLING & BYTE ARTIFACT VERIFICATION
// ============================================================================
describe('Empirical M4: Android Packaging & APK Binary Integrity', () => {
  test('APK-01: Android build tools exist and are executable', () => {
    const toolsDir = path.join(PROJECT_ROOT, 'android_tools');
    const requiredTools = ['aapt2.exe', 'zipalign.exe', 'android.jar', 'r8.jar', 'apksigner.jar'];

    for (const tool of requiredTools) {
      const toolPath = path.join(toolsDir, tool);
      assertTrue(fs.existsSync(toolPath), `Required Android tool ${tool} must exist at ${toolPath}`);
      const stats = fs.statSync(toolPath);
      assertTrue(stats.size > 1000, `Tool ${tool} must be a non-empty binary (size: ${stats.size} bytes)`);
    }
  });

  test('APK-02: Executing python build_apk.py produces SweetSmilePastry_v1.0.apk successfully', () => {
    // Run build_apk.py
    const output = execSync('python build_apk.py', { cwd: PROJECT_ROOT, encoding: 'utf8' });
    assertContains(output, 'SUCCESS! APK built and signed with Signature Scheme v2/v3!');

    const apkPath = path.join(PROJECT_ROOT, 'SweetSmilePastry_v1.0.apk');
    assertTrue(fs.existsSync(apkPath), 'SweetSmilePastry_v1.0.apk must be produced');

    const stats = fs.statSync(apkPath);
    assertGreaterThan(stats.size, 100 * 1024, 'APK size must be greater than 100KB');
  });

  test('APK-03: apksigner verifies v1, v2, v3 signature schemes on the compiled APK', () => {
    const apksignerJar = path.join(PROJECT_ROOT, 'android_tools', 'apksigner.jar');
    const apkPath = path.join(PROJECT_ROOT, 'SweetSmilePastry_v1.0.apk');

    const verifyCmd = `java -jar "${apksignerJar}" verify --verbose "${apkPath}"`;
    const verifyOutput = execSync(verifyCmd, { encoding: 'utf8' });

    assertContains(verifyOutput, 'Verifies');
    assertContains(verifyOutput, 'Verified using v1 scheme (JAR signing): true');
    assertContains(verifyOutput, 'Verified using v2 scheme (APK Signature Scheme v2): true');
    assertContains(verifyOutput, 'Verified using v3 scheme (APK Signature Scheme v3): true');
  });

  test('APK-04: APK internal structure contains classes.dex, AndroidManifest.xml, resources.arsc, and web assets', () => {
    // Inspect APK contents via python zipfile command
    const pyCmd = `python -c "import zipfile; z = zipfile.ZipFile('SweetSmilePastry_v1.0.apk'); print(','.join(z.namelist()))"`;
    const entriesRaw = execSync(pyCmd, { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
    const entries = entriesRaw.split(',');

    assertTrue(entries.includes('AndroidManifest.xml'), 'APK must contain AndroidManifest.xml');
    assertTrue(entries.includes('classes.dex'), 'APK must contain classes.dex');
    assertTrue(entries.includes('resources.arsc'), 'APK must contain resources.arsc');
    assertTrue(entries.includes('assets/index.html'), 'APK must contain assets/index.html');
    assertTrue(entries.includes('assets/js/app.js'), 'APK must contain assets/js/app.js');
    assertTrue(entries.includes('assets/js/store.js'), 'APK must contain assets/js/store.js');
    assertTrue(entries.includes('assets/js/ui-feedback.js'), 'APK must contain assets/js/ui-feedback.js');
    assertTrue(entries.includes('assets/js/views/dashboardView.js'), 'APK must contain assets/js/views/dashboardView.js');
    assertTrue(entries.includes('assets/js/views/posView.js'), 'APK must contain assets/js/views/posView.js');
  });

  test('APK-05: Web assets inside APK match root web assets byte-for-byte with zero drift', () => {
    const pyCheckCmd = `python -c "import zipfile; z = zipfile.ZipFile('SweetSmilePastry_v1.0.apk'); files = ['index.html', 'catalog.html', 'js/store.js', 'js/ui-feedback.js', 'js/views/dashboardView.js', 'js/views/posView.js']; mismatches = [f for f in files if z.read('assets/' + f) != open(f, 'rb').read()]; print('ALL_MATCH' if not mismatches else 'MISMATCH:' + ','.join(mismatches))"`;
    const checkRes = execSync(pyCheckCmd, { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
    assertEquals(checkRes, 'ALL_MATCH', `APK assets must match root assets exactly: ${checkRes}`);
  });
});

// ============================================================================
// DIRECT EXECUTION ENTRYPOINT
// ============================================================================
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  console.log('\n==============================================================');
  console.log('   🔥 SWEET SMILE v1.2 EMPIRICAL ADVERSARIAL CHALLENGER (M4)');
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
