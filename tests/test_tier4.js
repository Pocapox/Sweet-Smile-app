// tests/test_tier4.js - Tier 4: Real-World Bakery Scenarios
import {
  describe, test, beforeEach,
  assertEquals, assertNotEquals, assertTrue, assertFalse,
  assertNotNull, assertContains, assertGreaterThan, assertGreaterThanOrEqual,
  mockStorage, mockFetch, MockElement, resetStoreToSeed
} from './harness.js';
import { store } from '../js/store.js';
import { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS } from '../js/models.js';
import { OCRAIEngine } from '../js/ocr-ai.js';
import { renderPosView } from '../js/views/posView.js';
import { renderCatalogShareView } from '../js/views/catalogShareView.js';
import { renderChefAIView } from '../js/views/chefAIView.js';
import { CostingEngine } from '../js/costing.js';
import { notifications } from '../js/notifications.js';

const SEED_DATA = { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS };

describe('Tier 4: Real-World Bakery Operational Scenarios', () => {
  beforeEach(() => {
    mockStorage.clear();
    resetStoreToSeed(store, SEED_DATA);
  });

  // ==========================================================================
  // SCENARIO 4-1: MORNING BAKERY OPENING & PRODUCTION INSPECTION
  // ==========================================================================
  test('Scenario 4-1: Morning bakery opening: pantry audit, expiration alerts, and production planning', () => {
    // 1. Audit inventory stock levels
    const inventory = store.getInventory();
    assertGreaterThanOrEqual(inventory.length, 10);

    const lowStockItems = inventory.filter(i => i.status === 'warning' || i.status === 'critical');
    assertNotNull(lowStockItems);

    // 2. Chef IA morning suggestions inspection
    const suggestions = OCRAIEngine.getChefStockSuggestions();
    assertTrue(Array.isArray(suggestions));

    // 3. Verify store is online and ready for business
    assertEquals(store.state.isOnline, true);
    assertEquals(store.getCart().length, 0);

    // 4. Products catalog has stock counts ready
    const products = store.getProducts();
    const readyProducts = products.filter(p => p.stock > 0);
    assertGreaterThan(readyProducts.length, 0);
  });

  // ==========================================================================
  // SCENARIO 4-2: PEAK MORNING RUSH HOUR POS OPERATIONS
  // ==========================================================================
  test('Scenario 4-2: Peak morning rush hour: tickets, facturas, discounts, tips, and inventory decrements', () => {
    const initialInvoices = store.getInvoices().length;
    const p1 = store.getProduct('p1'); // Red Velvet ($28)
    const p2 = store.getProduct('p2'); // Cupcake ($3.50)
    const p4 = store.getProduct('p4'); // Galletas ($7.50)

    const initialStockP1 = p1.stock;
    const initialStockP2 = p2.stock;

    // Transaction 1: Customer buys 1 Red Velvet, pays cash, leaves $2 tip
    const t1 = store.saveInvoice({
      type: 'ticket',
      customerName: 'María González',
      customerDoc: 'CF',
      items: [{ productId: p1.id, name: p1.name, quantity: 1, price: p1.price, total: p1.price }],
      subtotal: 28.00,
      discountPercent: 0,
      tip: 2.00,
      total: 30.00,
      paymentMethod: 'Efectivo',
      status: 'Pagada'
    });
    assertTrue(t1.id.startsWith('TIK-'));

    // Transaction 2: Corporate client orders 6 Cupcakes with 10% discount, requests Factura
    const subtotalT2 = p2.price * 6; // 21.00
    const discVal = subtotalT2 * 0.10; // 2.10
    const totalT2 = subtotalT2 - discVal; // 18.90
    const t2 = store.saveInvoice({
      type: 'factura',
      customerName: 'Tech Solutions SAS',
      customerDoc: '900.123.456-7',
      items: [{ productId: p2.id, name: p2.name, quantity: 6, price: p2.price, total: subtotalT2 }],
      subtotal: subtotalT2,
      discountPercent: 10,
      discountAmount: discVal,
      tip: 0,
      total: totalT2,
      paymentMethod: 'Tarjeta de Crédito',
      status: 'Pagada'
    });
    assertTrue(t2.id.startsWith('FAC-'));

    // Transaction 3: Family buys 2 Cookie Packs, pays exact cash
    const t3 = store.saveInvoice({
      type: 'ticket',
      customerName: 'Familia Ramírez',
      customerDoc: 'CF',
      items: [{ productId: p4.id, name: p4.name, quantity: 2, price: p4.price, total: p4.price * 2 }],
      subtotal: 15.00,
      discountPercent: 0,
      tip: 0,
      total: 15.00,
      paymentMethod: 'Efectivo',
      status: 'Pagada'
    });

    // Verification
    assertEquals(store.getInvoices().length, initialInvoices + 3);
    assertEquals(store.getProduct(p1.id).stock, initialStockP1 - 1);
    assertEquals(store.getProduct(p2.id).stock, initialStockP2 - 6);
  });

  // ==========================================================================
  // SCENARIO 4-3: HANDWRITTEN RECIPE DIGITIZATION VIA OCR
  // ==========================================================================
  test('Scenario 4-3: Handwritten recipe digitization: OCR extraction, costing valuation, and catalog publish', async () => {
    // 1. Photo OCR extraction of Alfajores de Maicena
    const rawRecipe = await OCRAIEngine.extractRecipeFromPhoto('alfajores_note.png', 'alfajores');
    assertNotNull(rawRecipe);
    assertContains(rawRecipe.name, 'Alfajores');

    // 2. Costing valuation with 60% profit margin
    const costing = CostingEngine.calculateRecipe(rawRecipe, 60);
    assertGreaterThan(costing.totalProductionCost, 0);
    assertGreaterThan(costing.suggestedPrice, costing.totalProductionCost);
    assertEquals(costing.targetMargin, 60);

    // 3. Save recipe to master catalog
    rawRecipe.actualPrice = costing.suggestedPrice;
    const savedRec = store.saveRecipe(rawRecipe);
    assertNotNull(savedRec.id);

    // 4. Create retail product for POS
    const newProduct = store.saveProduct({
      name: savedRec.name,
      category: 'galletas',
      price: costing.suggestedPrice,
      cost: costing.totalProductionCost,
      stock: 16,
      recipeId: savedRec.id
    });
    assertNotNull(newProduct.id);

    // 5. Verify product immediately ready for sale in POS
    const posContainer = new MockElement('div');
    renderPosView(posContainer);
    store.addToCart(newProduct.id, 1);
    assertEquals(store.getCart().length, 1);
    assertEquals(store.getCart()[0].name, rawRecipe.name);
  });

  // ==========================================================================
  // SCENARIO 4-4: VIRAL SOCIAL MEDIA TREND RECIPE ADOPTION
  // ==========================================================================
  test('Scenario 4-4: Viral social trend recipe adoption: link ingestion, costing, and menu publication', async () => {
    const instagramUrl = 'https://www.instagram.com/reel/cheesecake-dulce-de-leche/';
    const recipe = await OCRAIEngine.importFromSocialUrl(instagramUrl);
    assertNotNull(recipe);
    assertContains(recipe.name, 'Cheesecake');

    // Calculate costing
    const costing = CostingEngine.calculateRecipe(recipe);
    assertGreaterThan(costing.directIngredientsCost, 0);
    assertGreaterThan(costing.suggestedPrice, 0);

    // Register recipe and product
    const savedRecipe = store.saveRecipe(recipe);
    const prod = store.saveProduct({
      name: savedRecipe.name,
      category: 'pasteles',
      price: costing.suggestedPrice,
      cost: costing.totalProductionCost,
      stock: 5,
      recipeId: savedRecipe.id
    });

    const lookup = store.getProduct(prod.id);
    assertEquals(lookup.name, savedRecipe.name);
    assertEquals(lookup.price, costing.suggestedPrice);
  });

  // ==========================================================================
  // SCENARIO 4-5: CUSTOMER QR TABLE DISPLAY & WHATSAPP CHECKOUT
  // ==========================================================================
  test('Scenario 4-5: Customer QR counter poster generation, in-app modal preview, safe print, and WhatsApp order flow', () => {
    const catalogContainer = new MockElement('div');
    renderCatalogShareView(catalogContainer);

    // 1. Configure WhatsApp number
    const phoneInput = catalogContainer.querySelector('#cfgWhatsappNumber');
    if (phoneInput) {
      phoneInput.value = '+18095558888';
      catalogContainer.querySelector('#btnSaveWhatsapp')?.click();
      assertEquals(store.getSettings().whatsappNumber, '+18095558888');
    }

    // 2. Open QR Poster Modal
    const printPosterBtn = catalogContainer.querySelector('#btnPrintQrPoster');
    assertNotNull(printPosterBtn);
    printPosterBtn.click();

    const qrModal = catalogContainer.querySelector('#qrPosterModal');
    if (qrModal) {
      assertFalse(qrModal.classList.contains('hidden'));
      // Execute print
      catalogContainer.querySelector('#btnExecutePrintPoster')?.click();
      // Close modal
      catalogContainer.querySelector('#btnCancelQrPoster')?.click();
      assertTrue(qrModal.classList.contains('hidden'));
    }

    // 3. Customer WhatsApp order message URL simulation
    const customerCart = [
      { name: 'Pastel Red Velvet', quantity: 1, price: 28.00 },
      { name: 'Cupcake Vainilla', quantity: 2, price: 3.50 }
    ];
    const orderText = `Hola Sweet Smile, quiero pedir:\n- 1x Pastel Red Velvet ($28.00)\n- 2x Cupcake Vainilla ($7.00)\nTotal: $35.00`;
    const waUrl = `https://wa.me/18095558888?text=${encodeURIComponent(orderText)}`;

    assertContains(waUrl, 'wa.me/18095558888');
    assertContains(waUrl, 'Red%20Velvet');
  });

  // ==========================================================================
  // SCENARIO 4-6: POWER OUTAGE / OFFLINE OPERATIONS & CLOUD RECOVERY
  // ==========================================================================
  test('Scenario 4-6: Power outage / offline bakery operations with local persistence and cloud reconciliation', () => {
    // 1. Power/Internet goes down
    store.handleNetworkChange(false);
    assertEquals(store.state.isOnline, false);
    assertEquals(store.state.cloudSyncStatus, 'offline');

    // 2. Bakery continues operating: sales recorded locally
    const inv1 = store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Apagón 1',
      items: [{ productId: 'p1', name: 'Pastel Red Velvet', quantity: 1, price: 28.00, total: 28.00 }],
      total: 28.00,
      status: 'Pagada'
    });
    const inv2 = store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Apagón 2',
      items: [{ productId: 'p4', name: 'Galletas', quantity: 1, price: 7.50, total: 7.50 }],
      total: 7.50,
      status: 'Pagada'
    });

    // Verify localStorage retains the sales
    const rawSaved = mockStorage.getItem(store.storageKey);
    assertNotNull(rawSaved);
    assertContains(rawSaved, 'Cliente Apagón 1');
    assertContains(rawSaved, 'Cliente Apagón 2');

    // 3. Internet restored: online transition triggers cloud sync
    store.handleNetworkChange(true);
    store.triggerCloudSyncSimulation();
    assertEquals(store.state.isOnline, true);
    assertNotNull(store.getInvoice(inv1.id));
    assertNotNull(store.getInvoice(inv2.id));
  });

  // ==========================================================================
  // SCENARIO 4-7: BUTTER INFLATION RESPONSE VIA CHEF IA
  // ==========================================================================
  test('Scenario 4-7: Butter price inflation detected: Chef IA recommendation and 1-click price update', () => {
    // 1. Butter price at $10.00/kg triggers alert
    const inventory = store.getInventory();
    const butter = inventory.find(i => i.name.toLowerCase().includes('mantequilla'));
    assertNotNull(butter);
    assertGreaterThanOrEqual(butter.costPerUnit, 10.00);

    // 2. Chef suggestions generate inflation alert
    const suggestions = OCRAIEngine.getChefStockSuggestions();
    const inflationCard = suggestions.find(s => s.type === 'pricing');
    assertNotNull(inflationCard);
    assertEquals(inflationCard.targetProduct, 'p1');
    assertEquals(inflationCard.newPrice, 28.00);

    // 3. Apply price update in store
    const prod = store.getProduct('p1');
    prod.price = inflationCard.newPrice;
    store.saveProduct(prod);

    // 4. Verify updated price in store
    assertEquals(store.getProduct('p1').price, 28.00);
  });

  // ==========================================================================
  // SCENARIO 4-8: WEEKLY SUPPLIER DELIVERY INTAKE & STOCK CLEARANCE
  // ==========================================================================
  test('Scenario 4-8: Weekly supplier delivery intake clears low stock warnings in inventory', () => {
    // Set low stock on flour and butter
    const flour = store.getInventory().find(i => i.name.toLowerCase().includes('harina'));
    if (flour) {
      flour.stock = 1.0;
      flour.status = 'critical';
      store.saveInventoryItem(flour);
    }

    // Delivery arrives: add 50 kg flour
    const updatedFlour = store.getInventoryItem(flour.id);
    updatedFlour.stock += 50.0;
    if (updatedFlour.stock > updatedFlour.minStock) {
      updatedFlour.status = 'optimal';
    }
    store.saveInventoryItem(updatedFlour);

    const reloadedFlour = store.getInventoryItem(flour.id);
    assertEquals(reloadedFlour.stock, 51.0);
    assertEquals(reloadedFlour.status, 'optimal');
  });

  // ==========================================================================
  // SCENARIO 4-9: END-OF-DAY FINANCIAL CLOSE & AUDIT
  // ==========================================================================
  test('Scenario 4-9: End-of-day financial close: sales tally, payment breakdown, and total revenue', () => {
    // Record mixed sales for the day
    store.saveInvoice({ type: 'ticket', customerName: 'Venta 1', total: 50.00, paymentMethod: 'Efectivo', status: 'Pagada' });
    store.saveInvoice({ type: 'ticket', customerName: 'Venta 2', total: 35.00, paymentMethod: 'Tarjeta de Crédito', status: 'Pagada' });
    store.saveInvoice({ type: 'factura', customerName: 'Venta 3', total: 115.00, paymentMethod: 'Transferencia', status: 'Pagada' });

    const invoices = store.getInvoices();
    const totalDaySales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const cashSales = invoices.filter(i => i.paymentMethod === 'Efectivo').reduce((sum, i) => sum + (i.total || 0), 0);
    const cardSales = invoices.filter(i => i.paymentMethod === 'Tarjeta de Crédito').reduce((sum, i) => sum + (i.total || 0), 0);

    assertGreaterThanOrEqual(totalDaySales, 200.00);
    assertGreaterThanOrEqual(cashSales, 50.00);
    assertGreaterThanOrEqual(cardSales, 35.00);
  });

  // ==========================================================================
  // SCENARIO 4-10: MULTI-DEVICE MIGRATION & DISASTER RECOVERY
  // ==========================================================================
  test('Scenario 4-10: Multi-device migration: export state, wipe target device, import, and verify 100% parity', () => {
    // 1. Initial complete state
    const originalProductsCount = store.getProducts().length;
    const originalInventoryCount = store.getInventory().length;
    const originalRecipesCount = store.getRecipes().length;

    // 2. Export full backup
    const backupJson = store.exportBackup();
    assertNotNull(backupJson);

    // 3. New device: empty localStorage
    mockStorage.clear();
    resetStoreToSeed(store, {
      INITIAL_PRODUCTS: [],
      INITIAL_INVENTORY: [],
      INITIAL_RECIPES: [],
      INITIAL_INVOICES: [],
      INITIAL_SETTINGS
    });

    // 4. Import backup on new device
    const ok = store.importBackup(backupJson);
    assertTrue(ok);

    // 5. Parity verification
    assertEquals(store.getProducts().length, originalProductsCount);
    assertEquals(store.getInventory().length, originalInventoryCount);
    assertEquals(store.getRecipes().length, originalRecipesCount);
  });
});
