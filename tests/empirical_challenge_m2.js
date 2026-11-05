// tests/empirical_challenge_m2.js
// EMPIRICAL CHALLENGE SUITE: Milestone M2 (Requirement R2 / Features F3, F4, F5)
// Rigorous adversarial stress testing for POS sales flow, multi-tier inventory deduction,
// exact arithmetic, zero-flooring, invoice ordering, and persistence.

import { store } from '../js/store.js';
import {
  INITIAL_PRODUCTS,
  INITIAL_INVENTORY,
  INITIAL_RECIPES,
  INITIAL_INVOICES,
  INITIAL_SETTINGS
} from '../js/models.js';
import {
  setupGlobalEnv,
  resetGlobalEnv,
  resetStoreToSeed,
  MockElement
} from './harness.js';
import { renderPosView } from '../js/views/posView.js';

let passedCount = 0;
let failedCount = 0;
const failureDetails = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Assertion failed'}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertCloseTo(actual, expected, delta = 0.001, message) {
  if (Math.abs(actual - expected) > delta) {
    throw new Error(`${message || 'Assertion failed'}: expected ${actual} to be within ${delta} of ${expected}`);
  }
}

function runTest(testName, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
    failedCount++;
    failureDetails.push({ name: testName, error: err.message });
  }
}

console.log('================================================================');
console.log(' 🔥 EMPIRICAL CHALLENGE SUITE — MILESTONE M2 (POS & INVENTORY)');
console.log('================================================================\n');

// ---------------------------------------------------------------------------
// SUITE 1: Rapid Sales of Single and Multi-Quantity Items
// ---------------------------------------------------------------------------
console.log('--- SUITE 1: Rapid Sales (Single & Multi-Quantity) ---');

runTest('1.1 Single-item rapid sales decrement product stock sequentially', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const p10 = store.getProduct('p10'); // Café Latte (stock: 40, no recipe)
  const initialStock = p10.stock;

  for (let i = 1; i <= 15; i++) {
    const inv = store.saveInvoice({
      type: 'ticket',
      items: [{ productId: 'p10', name: p10.name, quantity: 1, price: p10.price, total: p10.price }],
      total: p10.price
    });
    assertEquals(p10.stock, initialStock - i, `Stock should decrement by 1 on sale ${i}`);
    assertEquals(store.getInvoices()[0].id, inv.id, 'Newest invoice must be at index 0');
  }
  assertEquals(p10.stock, initialStock - 15, 'Final stock must equal initial - 15');
});

runTest('1.2 Multi-quantity sale decrements product stock by exact quantity sold', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const p4 = store.getProduct('p4'); // Galletas Chispas Chocolate (stock: 12)
  const initialStock = p4.stock;

  store.saveInvoice({
    type: 'factura',
    items: [{ productId: 'p4', name: p4.name, quantity: 7, price: p4.price, total: p4.price * 7 }],
    total: p4.price * 7
  });

  assertEquals(p4.stock, initialStock - 7, 'Product stock must decrement by 7');
});

runTest('1.3 High-volume burst: 50 sequential rapid sales across varied products and quantities', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const initialInvoicesCount = store.getInvoices().length;

  const initialStocks = {};
  store.getProducts().forEach(p => {
    initialStocks[p.id] = p.stock;
  });

  const expectedDeductions = {};
  store.getProducts().forEach(p => {
    expectedDeductions[p.id] = 0;
  });

  for (let i = 0; i < 50; i++) {
    const prodIndex = i % store.getProducts().length;
    const prod = store.getProducts()[prodIndex];
    const qty = (i % 3) + 1; // 1, 2, or 3
    expectedDeductions[prod.id] += qty;

    store.saveInvoice({
      type: i % 2 === 0 ? 'ticket' : 'factura',
      items: [{ productId: prod.id, name: prod.name, quantity: qty, price: prod.price, total: prod.price * qty }],
      total: prod.price * qty
    });
  }

  assertEquals(store.getInvoices().length, initialInvoicesCount + 50, 'Must record all 50 invoices');

  store.getProducts().forEach(p => {
    const expected = Math.max(0, initialStocks[p.id] - expectedDeductions[p.id]);
    assertEquals(p.stock, expected, `Product ${p.id} stock mismatch after 50 sales`);
  });
});

runTest('1.4 Multi-item single invoice deducts stock for all items correctly', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const p1 = store.getProduct('p1'); // stock 4
  const p2 = store.getProduct('p2'); // stock 18
  const p10 = store.getProduct('p10'); // stock 40

  const s1 = p1.stock;
  const s2 = p2.stock;
  const s10 = p10.stock;

  store.saveInvoice({
    type: 'factura',
    customerName: 'Pastelería Gourmet Corp',
    customerDoc: '99887766-5',
    items: [
      { productId: 'p1', name: p1.name, quantity: 2, price: p1.price, total: p1.price * 2 },
      { productId: 'p2', name: p2.name, quantity: 5, price: p2.price, total: p2.price * 5 },
      { productId: 'p10', name: p10.name, quantity: 10, price: p10.price, total: p10.price * 10 }
    ],
    total: (p1.price * 2) + (p2.price * 5) + (p10.price * 10)
  });

  assertEquals(p1.stock, s1 - 2, 'p1 stock should decrease by 2');
  assertEquals(p2.stock, s2 - 5, 'p2 stock should decrease by 5');
  assertEquals(p10.stock, s10 - 10, 'p10 stock should decrease by 10');
});

// ---------------------------------------------------------------------------
// SUITE 2: Verified Accurate Recipe-Based Inventory Deductions (Selva Negra)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 2: Recipe Deductions (Selva Negra p6 / rec-042) ---');

runTest('2.1 Selling Pastel Selva Negra (p6) deducts exact recipe ingredients from pantry', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const invFlour = store.findMatchingInventoryItem('Harina de Trigo Especial');
  const invButter = store.findMatchingInventoryItem('Mantequilla sin sal 82%');
  const invCherries = store.findMatchingInventoryItem('Cerezas al marrasquino');
  const invChoc = store.findMatchingInventoryItem('Chocolate amargo 70%');
  const invEggs = store.findMatchingInventoryItem('Huevos frescos');
  const invPack = store.findMatchingInventoryItem('Empaque & Cinta Sweet Smile');

  assert(invFlour && invButter && invCherries && invChoc && invEggs && invPack, 'All recipe ingredients must match inventory');

  const startFlour = invFlour.stock;
  const startButter = invButter.stock;
  const startCherries = invCherries.stock;
  const startChoc = invChoc.stock;
  const startEggs = invEggs.stock;
  const startPack = invPack.stock;

  const qtyToSell = 3;
  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p6', quantity: qtyToSell, price: 34.75, total: 34.75 * qtyToSell }],
    total: 34.75 * qtyToSell
  });

  assertCloseTo(invFlour.stock, startFlour - (0.40 * qtyToSell), 0.001, 'Harina deduction mismatch');
  assertCloseTo(invButter.stock, startButter - (0.25 * qtyToSell), 0.001, 'Mantequilla deduction mismatch');
  assertCloseTo(invCherries.stock, startCherries - (0.15 * qtyToSell), 0.001, 'Cerezas deduction mismatch');
  assertCloseTo(invChoc.stock, startChoc - (0.20 * qtyToSell), 0.001, 'Chocolate deduction mismatch');
  assertCloseTo(invEggs.stock, startEggs - (4 * qtyToSell), 0.001, 'Huevos deduction mismatch');
  assertCloseTo(invPack.stock, startPack - (1 * qtyToSell), 0.001, 'Empaque deduction mismatch');
});

runTest('2.2 Selling product without recipe or with missing recipe does NOT error or corrupt inventory', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const p10 = store.getProduct('p10'); // recipeId: null
  const p2 = store.getProduct('p2'); // recipeId: 'rec-cupcake' (unseeded recipe)

  const initialInvJson = JSON.stringify(store.getInventory());

  store.saveInvoice({
    type: 'ticket',
    items: [
      { productId: 'p10', quantity: 5, price: 3.50, total: 17.50 },
      { productId: 'p2', quantity: 3, price: 3.50, total: 10.50 }
    ],
    total: 28.00
  });

  assertEquals(p10.stock, 40 - 5, 'p10 stock must decrement');
  assertEquals(p2.stock, 18 - 3, 'p2 stock must decrement');
  assertEquals(JSON.stringify(store.getInventory()), initialInvJson, 'Inventory should remain unmodified');
});

// ---------------------------------------------------------------------------
// SUITE 3: Stock Flooring at Zero (Never Negative)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 3: Stock Flooring at 0 (Never Negative) ---');

runTest('3.1 Overselling finished product floors product stock at 0', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const p3 = store.getProduct('p3'); // stock: 2
  assertEquals(p3.stock, 2, 'Initial stock should be 2');

  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p3', quantity: 10, price: 22.00, total: 220.00 }],
    total: 220.00
  });

  assertEquals(p3.stock, 0, 'Oversold product stock MUST floor at 0');

  // Subsequent sale when already at 0
  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p3', quantity: 5, price: 22.00, total: 110.00 }],
    total: 110.00
  });

  assertEquals(p3.stock, 0, 'Product stock at 0 MUST remain at 0 after further sale');
});

runTest('3.2 Massive recipe demand floors raw pantry inventory stock at 0 without negative numbers', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const invButter = store.findMatchingInventoryItem('Mantequilla');
  assertEquals(invButter.stock, 2.5, 'Initial butter stock is 2.5 kg');

  store.saveInvoice({
    type: 'factura',
    items: [{ productId: 'p6', quantity: 50, price: 34.75, total: 34.75 * 50 }],
    total: 34.75 * 50
  });

  assertEquals(invButter.stock, 0, 'Raw butter stock MUST floor at 0, not -10.0');
  assertEquals(invButter.status, 'critical', 'Zero stock butter must have status "critical"');

  // Sell another 10 cakes
  store.saveInvoice({
    type: 'factura',
    items: [{ productId: 'p6', quantity: 10, price: 34.75, total: 34.75 * 10 }],
    total: 34.75 * 10
  });

  assertEquals(invButter.stock, 0, 'Zero stock butter MUST remain 0 after additional sale');
});

runTest('3.3 Invariant: No product or inventory item ever has negative stock under randomized stress', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });

  for (let round = 0; round < 30; round++) {
    const randomProduct = store.getProducts()[Math.floor(Math.random() * store.getProducts().length)];
    const randomQty = Math.floor(Math.random() * 25) + 5;
    store.saveInvoice({
      type: 'ticket',
      items: [{ productId: randomProduct.id, quantity: randomQty, price: randomProduct.price, total: randomProduct.price * randomQty }],
      total: randomProduct.price * randomQty
    });
  }

  store.getProducts().forEach(p => {
    assert(p.stock >= 0, `Product ${p.id} (${p.name}) has negative stock: ${p.stock}`);
  });

  store.getInventory().forEach(inv => {
    assert(inv.stock >= 0, `Inventory item ${inv.id} (${inv.name}) has negative stock: ${inv.stock}`);
  });
});

// ---------------------------------------------------------------------------
// SUITE 4: Invoices Array Ordering and State Persistence
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 4: Invoices Array Ordering & State Persistence ---');

runTest('4.1 Invoices array adheres to LIFO ordering (newest invoice at index 0)', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const idsCreated = [];

  for (let i = 1; i <= 5; i++) {
    const invoice = store.saveInvoice({
      type: i % 2 === 0 ? 'factura' : 'ticket',
      customerName: `Cliente Prueba ${i}`,
      items: [{ productId: 'p10', quantity: 1, price: 3.50, total: 3.50 }],
      total: 3.50
    });
    idsCreated.push(invoice.id);
    assertEquals(store.getInvoices()[0].id, invoice.id, `Invoice ${invoice.id} must be at index 0`);
  }

  const currentInvoices = store.getInvoices();
  for (let i = 0; i < 5; i++) {
    const expectedId = idsCreated[idsCreated.length - 1 - i];
    assertEquals(currentInvoices[i].id, expectedId, `Index ${i} must have invoice ${expectedId}`);
  }
});

runTest('4.2 Invoices generate correct prefixes and required properties', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });

  const ticket = store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p10', quantity: 1, price: 3.50, total: 3.50 }],
    total: 3.50
  });
  assert(ticket.id.startsWith('TIK-'), `Ticket ID must start with TIK-, got ${ticket.id}`);
  assert(typeof ticket.date === 'string' && ticket.date.length >= 10, 'Ticket date must be formatted');

  const factura = store.saveInvoice({
    type: 'factura',
    items: [{ productId: 'p10', quantity: 1, price: 3.50, total: 3.50 }],
    total: 3.50
  });
  assert(factura.id.startsWith('FAC-'), `Factura ID must start with FAC-, got ${factura.id}`);
});

runTest('4.3 State persistence across AppStore reloading via localStorage', () => {
  resetGlobalEnv();
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });

  const savedInv = store.saveInvoice({
    type: 'factura',
    customerName: 'Prueba Persistencia Local',
    customerDoc: '11223344-K',
    items: [{ productId: 'p6', quantity: 2, price: 34.75, total: 69.50 }],
    total: 69.50
  });

  const p6StockBeforeReload = store.getProduct('p6').stock;
  const butterStockBeforeReload = store.findMatchingInventoryItem('Mantequilla').stock;
  const invoicesCountBeforeReload = store.getInvoices().length;

  const rawSaved = globalThis.localStorage.getItem(store.storageKey);
  assert(rawSaved !== null, 'localStorage must contain saved state JSON');

  const parsed = JSON.parse(rawSaved);
  assertEquals(parsed.invoices[0].id, savedInv.id, 'Persisted newest invoice ID matches');
  assertEquals(parsed.products.find(p => p.id === 'p6').stock, p6StockBeforeReload, 'Persisted product stock matches');

  const freshState = store.loadState();
  assertEquals(freshState.invoices[0].id, savedInv.id, 'Freshly loaded state has newest invoice');
  assertEquals(freshState.invoices.length, invoicesCountBeforeReload, 'Freshly loaded state has correct invoice count');
  assertEquals(freshState.products.find(p => p.id === 'p6').stock, p6StockBeforeReload, 'Freshly loaded product stock matches');
  assertEquals(freshState.inventory.find(i => i.id === 'inv-1').stock, butterStockBeforeReload, 'Freshly loaded butter stock matches');
});

runTest('4.4 Editing an existing invoice updates state without duplicating or re-deducting stock', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const initialP6Stock = store.getProduct('p6').stock;
  const initialButterStock = store.findMatchingInventoryItem('Mantequilla').stock;
  const initialInvoicesCount = store.getInvoices().length;

  const inv = store.saveInvoice({
    type: 'factura',
    customerName: 'Cliente Original',
    items: [{ productId: 'p6', quantity: 1, price: 34.75, total: 34.75 }],
    total: 34.75
  });

  assertEquals(store.getProduct('p6').stock, initialP6Stock - 1, 'Stock decrements on first save');
  assertEquals(store.getInvoices().length, initialInvoicesCount + 1, 'Invoices count increases by 1');

  inv.customerName = 'Cliente Modificado Con Éxito';
  inv.status = 'Cancelada';

  store.saveInvoice(inv);

  assertEquals(store.getInvoices().length, initialInvoicesCount + 1, 'Editing existing invoice must NOT add new row');
  assertEquals(store.getInvoice(inv.id).customerName, 'Cliente Modificado Con Éxito', 'Invoice customerName updated');
  assertEquals(store.getInvoice(inv.id).status, 'Cancelada', 'Invoice status updated');

  assertEquals(store.getProduct('p6').stock, initialP6Stock - 1, 'Stock must NOT decrement on edit');
  assertEquals(store.findMatchingInventoryItem('Mantequilla').stock, initialButterStock - 0.25, 'Butter must NOT decrement on edit');
});

// ---------------------------------------------------------------------------
// SUITE 5: POS UI Flow, Cart Sticky Bar & Save Sale Modal Buttons
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 5: POS UI View Buttons & Checkout Interaction ---');

runTest('5.1 POS Screen displays "Guardar Venta" in sticky bar when items exist in cart', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const container = new MockElement('div');

  renderPosView(container, 'pos');
  assert(!container.querySelector('#btnSaveSaleBar'), 'Sticky bar save button should not appear for empty cart');

  store.addToCart('p10', 2);
  renderPosView(container, 'pos');

  const saveBarBtn = container.querySelector('#btnSaveSaleBar');
  assert(saveBarBtn !== null, '#btnSaveSaleBar must be rendered in DOM when cart has items');
  assert(saveBarBtn.innerText.includes('Guardar Venta'), 'Sticky bar button must contain text "Guardar Venta"');
});

runTest('5.2 Cart Modal displays "Guardar Venta (Ticket/Factura)" as confirmation button', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const container = new MockElement('div');
  store.addToCart('p6', 1);

  renderPosView(container, 'pos');

  const confirmBtn = container.querySelector('#confirmSaleBtn');
  assert(confirmBtn !== null, '#confirmSaleBtn must exist in cartModal');
  assert(confirmBtn.innerText.includes('Guardar Venta'), `#confirmSaleBtn must contain "Guardar Venta", got: ${confirmBtn.innerText}`);
});

runTest('5.3 Clicking "#btnSaveSaleBar" executes sale, clears cart, and records invoice', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const container = new MockElement('div');
  store.addToCart('p6', 1);

  const initialP6 = store.getProduct('p6').stock;
  const initialInvoicesCount = store.getInvoices().length;

  renderPosView(container, 'pos');

  const saveBarBtn = container.querySelector('#btnSaveSaleBar');
  saveBarBtn.click();

  assertEquals(store.getCart().length, 0, 'Cart must be empty after save sale');
  assertEquals(store.getInvoices().length, initialInvoicesCount + 1, 'Invoices list must have new record');
  assertEquals(store.getProduct('p6').stock, initialP6 - 1, 'Product stock decremented');
  assert(container.querySelector('#tabInvoicesBtn') !== null, 'Invoices screen should be rendered');
});

// ---------------------------------------------------------------------------
// SUITE 6: Inventory Status Recalculation (Critical / Warning / Optimal)
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 6: Supply Health Status Transitions ---');

runTest('6.1 Inventory health dynamically updates status to "warning" and "critical"', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const flour = store.getInventoryItem('inv-2');
  assertEquals(flour.status, 'optimal', 'Harina should start as optimal');

  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p6', quantity: 65, price: 34.75, total: 34.75 * 65 }],
    total: 34.75 * 65
  });

  assertEquals(flour.stock, 19.0, 'Flour stock should be 19.0');
  assertEquals(flour.status, 'warning', 'Flour status should transition to warning (<= 20)');

  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p6', quantity: 25, price: 34.75, total: 34.75 * 25 }],
    total: 34.75 * 25
  });

  assertEquals(flour.stock, 9.0, 'Flour stock should be 9.0');
  assertEquals(flour.status, 'critical', 'Flour status should transition to critical (<= 10)');
});

// ---------------------------------------------------------------------------
// SUITE 7: Store Reactive Event Notifications
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 7: Store Reactive Event Notifications ---');

runTest('7.1 store.saveInvoice() emits "products_changed", "inventory_changed", and "invoices_changed"', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });

  let productsEmitted = false;
  let inventoryEmitted = false;
  let invoicesEmitted = false;

  const unsub = store.subscribe((event, data) => {
    if (event === 'products_changed') productsEmitted = true;
    if (event === 'inventory_changed') inventoryEmitted = true;
    if (event === 'invoices_changed') invoicesEmitted = true;
  });

  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p6', quantity: 1, price: 34.75, total: 34.75 }],
    total: 34.75
  });

  unsub();

  assert(productsEmitted, 'Must emit products_changed');
  assert(inventoryEmitted, 'Must emit inventory_changed');
  assert(invoicesEmitted, 'Must emit invoices_changed');
});

// ---------------------------------------------------------------------------
// SUITE 8: ADVERSARIAL CHALLENGES — UNCOVERING HIDDEN DEFECTS & BLAST RADIUS
// ---------------------------------------------------------------------------
console.log('\n--- SUITE 8: Adversarial Challenges (Defect Discovery) ---');

runTest('CHALLENGE 8.1 [ADJECTIVE COLLISION]: Selling Croissant (p8) must NOT deduct Fresh Strawberries (inv-5)', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const strawberries = store.getInventoryItem('inv-5'); // Fresas Frescas de Huerto
  const initialStrawberries = strawberries.stock;

  // Croissant uses: Harina (0.50), Mantequilla (0.30), Levadura fresca (0.02), Leche (0.25), Empaque (12)
  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p8', quantity: 10, price: 3.80, total: 38.00 }],
    total: 38.00
  });

  // Yeast ("Levadura fresca") must NOT match Strawberries ("Fresas Frescas de Huerto")
  if (strawberries.stock !== initialStrawberries) {
    throw new Error(
      `CRITICAL DEFECT: Selling 10 Butter Croissants deducted ${initialStrawberries - strawberries.stock} kg of Fresh Strawberries (inv-5)! "Levadura fresca" collided with "Fresas Frescas de Huerto" due to adjective token "fresc-".`
    );
  }
});

runTest('CHALLENGE 8.2 [DOUBLE DEDUCTION COLLISION]: Selling Cheesecake (p7) must NOT double-deduct cream cheese (inv-9)', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const cheese = store.getInventoryItem('inv-9'); // Queso Crema Tipo Filadelfia (initial: 5.0)
  const initialCheese = cheese.stock;

  // Cheesecake recipe calls for:
  // - Queso crema Philadelphia: 0.60 kg
  // - Crema para batir 35%: 0.35 L
  // If "Crema para batir" falsely matches "Queso Crema", each cake deducts 0.95 kg instead of 0.60 kg.
  store.saveInvoice({
    type: 'factura',
    items: [{ productId: 'p7', quantity: 2, price: 28.00, total: 56.00 }],
    total: 56.00
  });

  const expectedCheese = initialCheese - (0.60 * 2); // 5.0 - 1.20 = 3.80
  if (cheese.stock !== expectedCheese) {
    throw new Error(
      `CRITICAL DEFECT: Selling 2 Cheesecakes deducted ${initialCheese - cheese.stock} kg of cream cheese (actual stock: ${cheese.stock}, expected: ${expectedCheese})! Both "Queso crema Philadelphia" (0.60kg) and "Crema para batir 35%" (0.35L) matched inv-9, causing a 0.70 kg excess double deduction.`
    );
  }
});

runTest('CHALLENGE 8.3 [FALSE MATCH CHANTILLY]: Selling Pavlova (p9) must NOT deduct Cream Cheese (inv-9)', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const cheese = store.getInventoryItem('inv-9');
  const initialCheese = cheese.stock;

  // Pavlova recipe calls for "Crema chantilly: 0.25 L"
  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p9', quantity: 2, price: 4.50, total: 9.00 }],
    total: 9.00
  });

  if (cheese.stock !== initialCheese) {
    throw new Error(
      `CRITICAL DEFECT: Selling 2 Pavlovas deducted ${initialCheese - cheese.stock} kg of Cream Cheese (inv-9)! "Crema chantilly" falsely matched "Queso Crema Tipo Filadelfia" due to single token "crema".`
    );
  }
});

runTest('CHALLENGE 8.4 [ZERO QUANTITY COERCION]: Saving sale with quantity: 0 must NOT decrement stock', () => {
  resetStoreToSeed(store, { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS });
  const p10 = store.getProduct('p10');
  const initialStock = p10.stock;

  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p10', quantity: 0, price: 0, total: 0 }],
    total: 0
  });

  if (p10.stock !== initialStock) {
    throw new Error(
      `DEFECT: Selling with quantity: 0 decremented product stock from ${initialStock} to ${p10.stock} because (Number(it.quantity) || 1) coerces 0 to 1.`
    );
  }
});

// ---------------------------------------------------------------------------
// FINAL SUMMARY
// ---------------------------------------------------------------------------
console.log('\n================================================================');
console.log('                 CHALLENGE TEST RESULTS SUMMARY                 ');
console.log('================================================================');
console.log(`  TOTAL TESTS:   ${passedCount + failedCount}`);
console.log(`  PASSED:        ${passedCount}`);
console.log(`  FAILED:        ${failedCount}`);

if (failedCount > 0) {
  console.log('\n❌ VERDICT: CHALLENGE (Failures detected)');
  failureDetails.forEach((f, idx) => {
    console.log(`\n  [${idx + 1}] ${f.name}`);
    console.log(`      ${f.error}`);
  });
  process.exit(1);
} else {
  console.log('\n🏆 VERDICT: CONFIRMED (All empirical stress tests passed!)');
  process.exit(0);
}
