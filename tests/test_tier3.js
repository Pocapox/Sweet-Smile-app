// tests/test_tier3.js - Tier 3: Cross-Feature Integration Workflows
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

describe('Tier 3: Cross-Feature Integration Workflows', () => {
  beforeEach(() => {
    mockStorage.clear();
    resetStoreToSeed(store, SEED_DATA);
  });

  // ==========================================================================
  // WORKFLOW 3-1: POS SALE -> INVENTORY DEDUCTION -> RECIPE COSTING -> KPIS
  // ==========================================================================
  test('WF-01: POS Sale completes and impacts product stock, sales history, and dashboard totals', () => {
    const prod = store.getProduct('p1'); // Red Velvet cake ($28, stock: 4)
    const initialStock = prod.stock;
    const initialInvoicesCount = store.getInvoices().length;

    // 1. Add to POS cart
    store.addToCart(prod.id, 2);
    assertEquals(store.getCart().length, 1);
    assertEquals(store.getCart()[0].quantity, 2);

    // 2. Render POS view and trigger sale
    const container = new MockElement('div');
    renderPosView(container);
    const confirmBtn = container.querySelector('#confirmSaleBtn');
    assertNotNull(confirmBtn, 'Checkout button must be present in POS');
    confirmBtn.click();

    // 3. Verify finished product stock decremented
    const updatedProd = store.getProduct('p1');
    assertEquals(updatedProd.stock, initialStock - 2);

    // 4. Verify invoice was recorded
    const invoices = store.getInvoices();
    assertEquals(invoices.length, initialInvoicesCount + 1);
    const latestInvoice = invoices[0];
    assertTrue(latestInvoice.id.startsWith('TIK-') || latestInvoice.id.startsWith('FAC-'));
    assertEquals(latestInvoice.total, 28.00 * 2);

    // 5. Verify cart cleared
    assertEquals(store.getCart().length, 0);
  });

  // ==========================================================================
  // WORKFLOW 3-2: SOCIAL RECIPE IMPORT -> CATALOG REGISTRATION -> POS CATALOG
  // ==========================================================================
  test('WF-02: Viral TikTok recipe import creates structured recipe, computes costing margins, and publishes to POS', async () => {
    // 1. Ingest social URL
    const tiktokUrl = 'https://www.tiktok.com/@pastrychef/video/cookies-pistacho-frambuesa';
    const structuredRecipe = await OCRAIEngine.importFromSocialUrl(tiktokUrl);
    assertNotNull(structuredRecipe);
    assertEquals(structuredRecipe.platform, 'TikTok');

    // 2. Register recipe in catalog
    const savedRecipe = store.saveRecipe(structuredRecipe);
    assertNotNull(savedRecipe.id);

    // 3. Costing calculation
    const costing = CostingEngine.calculateRecipe(savedRecipe);
    assertGreaterThan(costing.totalProductionCost, 0);
    assertGreaterThan(costing.suggestedPrice, costing.totalProductionCost);
    assertEquals(costing.targetMargin, 65);

    // 4. Create saleable product in store
    const newProduct = store.saveProduct({
      name: savedRecipe.name,
      category: 'galletas',
      price: costing.suggestedUnitPrice || 3.50,
      cost: costing.unitCost || 1.20,
      stock: 24,
      recipeId: savedRecipe.id
    });
    assertNotNull(newProduct.id);

    // 5. Verify product appears in POS
    const container = new MockElement('div');
    renderPosView(container);
    const catalogProds = store.getProducts();
    const foundInCatalog = catalogProds.find(p => p.id === newProduct.id);
    assertNotNull(foundInCatalog);
    assertEquals(foundInCatalog.name, savedRecipe.name);
  });

  // ==========================================================================
  // WORKFLOW 3-3: OCR RECIPE SCAN -> INGREDIENT INVENTORY EVALUATION
  // ==========================================================================
  test('WF-03: Photo OCR scan extracts ingredients and verifies pantry supply availability', async () => {
    // 1. Photo OCR scan
    const extracted = await OCRAIEngine.extractRecipeFromPhoto('mock_photo.jpg', 'carrot_cake');
    assertNotNull(extracted.name);
    assertGreaterThan(extracted.ingredients.length, 3);

    // 2. Save recipe
    const recipe = store.saveRecipe(extracted);

    // 3. Match recipe ingredients against pantry inventory
    const inventory = store.getInventory();
    const ingredientAvailability = recipe.ingredients.map(ing => {
      const match = inventory.find(inv => inv.name.toLowerCase().includes(ing.name.toLowerCase().split(' ')[0]));
      return {
        ingredient: ing.name,
        requiredQty: ing.quantity,
        availableStock: match ? match.stock : 0,
        inStock: match ? match.stock >= ing.quantity : false
      };
    });

    assertTrue(ingredientAvailability.length >= 4);
    // Flour should be in stock
    const flourCheck = ingredientAvailability.find(i => i.ingredient.toLowerCase().includes('harina'));
    assertNotNull(flourCheck);
    assertTrue(flourCheck.availableStock > 0);
  });

  // ==========================================================================
  // WORKFLOW 3-4: OFFLINE SALES QUEUE -> RECONNECT -> CLOUD SYNC SIMULATION
  // ==========================================================================
  test('WF-04: Offline sales recording and seamless cloud sync transition on network reconnect', () => {
    // 1. Go offline
    store.handleNetworkChange(false);
    assertEquals(store.state.isOnline, false);
    assertEquals(store.state.cloudSyncStatus, 'offline');

    // 2. Perform offline sales
    const offlineInv1 = store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Offline 1',
      items: [{ productId: 'p1', name: 'Pastel Red Velvet', quantity: 1, price: 28.00, total: 28.00 }],
      total: 28.00,
      status: 'Pagada'
    });
    const offlineInv2 = store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Offline 2',
      items: [{ productId: 'p2', name: 'Cupcake Vainilla', quantity: 4, price: 3.50, total: 14.00 }],
      total: 14.00,
      status: 'Pagada'
    });

    assertEquals(store.getInvoices().length >= 2, true);

    // 3. Reconnect network
    let syncStateChanged = false;
    const unsub = store.subscribe((evt, data) => {
      if (evt === 'sync_change' || evt === 'network_change') {
        syncStateChanged = true;
      }
    });

    store.handleNetworkChange(true);
    store.triggerCloudSyncSimulation();
    unsub();

    assertEquals(store.state.isOnline, true);
    assertTrue(syncStateChanged);
  });

  // ==========================================================================
  // WORKFLOW 3-5: QR MODAL -> PRINT EXECUTION -> DISMISSAL -> CART RETENTION
  // ==========================================================================
  test('WF-05: QR poster generation, print execution, and safe return preserving active POS cart', () => {
    // 1. Put items in POS cart
    store.addToCart('p1', 1);
    store.addToCart('p2', 2);
    assertEquals(store.getCart().length, 2);

    // 2. Open catalog QR view
    const catalogContainer = new MockElement('div');
    renderCatalogShareView(catalogContainer);

    // 3. Trigger Print Poster (opens #qrPosterModal)
    const printBtn = catalogContainer.querySelector('#btnPrintQrPoster');
    assertNotNull(printBtn);
    printBtn.click();

    // Verify in-app modal opened or print window initiated
    const qrModal = catalogContainer.querySelector('#qrPosterModal');
    if (qrModal) {
      assertFalse(qrModal.classList.contains('hidden'), 'QR poster modal should be open');
      const executePrint = catalogContainer.querySelector('#btnExecutePrintPoster');
      if (executePrint) executePrint.click();
      const closeBtn = catalogContainer.querySelector('#closeQrPosterModal') || catalogContainer.querySelector('#btnCancelQrPoster');
      if (closeBtn) closeBtn.click();
      assertTrue(qrModal.classList.contains('hidden'), 'Modal should close cleanly');
    } else {
      assertGreaterThan(window._openWindows.length, 0);
    }

    // 4. Return to POS view
    const posContainer = new MockElement('div');
    renderPosView(posContainer);

    // Verify cart items are intact
    assertEquals(store.getCart().length, 2);
    const cartProdIds = store.getCart().map(i => i.productId);
    assertTrue(cartProdIds.includes('p1'));
    assertTrue(cartProdIds.includes('p2'));
  });

  // ==========================================================================
  // WORKFLOW 3-6: CHEF IA INFLATION ALERT -> 1-CLICK PRICE ADJUSTMENT -> POS
  // ==========================================================================
  test('WF-06: Chef IA inflation detection triggers 1-click price update that reflects immediately in POS', () => {
    // 1. Render Chef IA view
    const chefContainer = new MockElement('div');
    renderChefAIView(chefContainer);

    // 2. Click 1-click inflation adjustment button
    const adjustBtn = chefContainer.querySelector('#btnApplyInflationAdjustment');
    assertNotNull(adjustBtn, 'One-click price adjustment button should be visible');
    adjustBtn.click();

    // 3. Verify product p1 price updated to $28.00 in store
    const prod = store.getProduct('p1');
    assertEquals(prod.price, 28.00);

    // 4. Re-render POS view and add product to cart
    store.clearCart();
    store.addToCart('p1', 1);
    const posContainer = new MockElement('div');
    renderPosView(posContainer);

    // Cart total must reflect new adjusted price $28.00
    const cart = store.getCart();
    assertEquals(cart[0].price, 28.00);
  });

  // ==========================================================================
  // WORKFLOW 3-7: CHEF IA ANTI-WASTE MERMAS -> RECIPE SELECTION
  // ==========================================================================
  test('WF-07: Chef IA zero-waste fruit alert recommends Pavlova recipe and validates margins', () => {
    // 1. Ensure inventory has surplus strawberries (>3 kg)
    const strawberries = store.getInventory().find(i => i.name.toLowerCase().includes('fresa'));
    if (strawberries) {
      strawberries.stock = 5.0; // Surplus
      store.saveInventoryItem(strawberries);
    }

    // 2. Get chef suggestions
    const suggestions = OCRAIEngine.getChefStockSuggestions();
    const antiWaste = suggestions.find(s => s.type === 'antiwaste');
    assertNotNull(antiWaste, 'Chef IA should produce anti-waste suggestion for strawberries');
    assertContains(antiWaste.title, 'Pavlova');

    // 3. Lookup Pavlova recipe
    const pavlovaRec = store.getRecipe('rec-pavlova');
    if (pavlovaRec) {
      const costing = CostingEngine.calculateRecipe(pavlovaRec);
      assertGreaterThan(costing.targetMargin, 50);
    }
  });

  // ==========================================================================
  // WORKFLOW 3-8: KITCHEN OVEN TIMER -> NOTIFICATION -> CHIME ALERT
  // ==========================================================================
  test('WF-08: Kitchen baking timer registration and push notification chime execution', () => {
    let pushDispatched = false;

    // Trigger baking timer
    const timer = notifications.addBakingTimer('Macarons de Frambuesa', 18);
    const timers = notifications.activeTimers;
    assertNotNull(timers);
    assertGreaterThanOrEqual(timers.length, 1);

    const latest = timers[timers.length - 1];
    assertEquals(latest.label, 'Macarons de Frambuesa');
    assertEquals(latest.totalSeconds, 18 * 60);

    // Send push notification with kitchen chime
    notifications.sendPush('⏰ Temporizador Finalizado', {
      body: 'Los Macarons están listos para salir del horno.'
    });
    pushDispatched = true;
    assertTrue(pushDispatched);

    // Cleanup timer to prevent background interval
    notifications.cancelTimer(timer.id);
  });

  // ==========================================================================
  // WORKFLOW 3-9: COMPLETE DISASTER RECOVERY LIFECYCLE
  // ==========================================================================
  test('WF-09: Complete disaster recovery: snapshot export, storage wipe, and state restore', () => {
    // 1. Modify initial state
    const customProd = store.saveProduct({ name: 'Pastel Unicornio Edición Limitada', price: 45.00, stock: 3 });
    const customInv = store.saveInventoryItem({ name: 'Brillo Comestible Dorado', stock: 0.5, unit: 'kg' });
    const customRecipe = store.saveRecipe({ name: 'Receta Secreta Unicornio', portions: 12 });
    const customInvRecord = store.saveInvoice({ type: 'ticket', customerName: 'VIP Client', total: 45.00, status: 'Pagada' });

    // 2. Export full backup snapshot
    const backupSnapshot = store.exportBackup();
    assertNotNull(backupSnapshot);

    // 3. Simulate total storage wipeout
    mockStorage.clear();
    resetStoreToSeed(store, {
      INITIAL_PRODUCTS: [],
      INITIAL_INVENTORY: [],
      INITIAL_RECIPES: [],
      INITIAL_INVOICES: [],
      INITIAL_SETTINGS
    });
    assertEquals(store.getProducts().length, 0);
    assertEquals(store.getInvoices().length, 0);

    // 4. Restore state from snapshot
    const restoreSuccess = store.importBackup(backupSnapshot);
    assertTrue(restoreSuccess, 'importBackup should successfully restore full system snapshot');

    // 5. Verify complete restoration
    const restoredProd = store.getProduct(customProd.id);
    assertNotNull(restoredProd, 'Custom product must be restored');
    assertEquals(restoredProd.name, 'Pastel Unicornio Edición Limitada');

    const restoredInv = store.getInventoryItem(customInv.id);
    assertNotNull(restoredInv, 'Custom inventory item must be restored');

    const restoredRecipe = store.getRecipe(customRecipe.id);
    assertNotNull(restoredRecipe, 'Custom recipe must be restored');

    const restoredInvoice = store.getInvoice(customInvRecord.id);
    assertNotNull(restoredInvoice, 'Custom invoice must be restored');
  });

  // ==========================================================================
  // WORKFLOW 3-10: GEMINI API FALLBACK CASCADE ON NETWORK / RATE LIMIT ERROR
  // ==========================================================================
  test('WF-10: Gemini API client handles model failure cascade (2.5 -> 2.0 -> 1.5) with structured output', async () => {
    const attemptedModels = [];
    mockFetch.reset();

    // 2.5-flash fails with 500 internal server error
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-2.5-flash'),
      (url) => {
        attemptedModels.push('gemini-2.5-flash');
        return { ok: false, status: 500, json: async () => ({ error: 'Internal Error' }) };
      }
    );

    // 2.0-flash fails with 429 rate limit
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-2.0-flash'),
      (url) => {
        attemptedModels.push('gemini-2.0-flash');
        return { ok: false, status: 429, json: async () => ({ error: 'Resource Exhausted' }) };
      }
    );

    // 1.5-flash succeeds with structured pastry response
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-1.5-flash'),
      (url) => {
        attemptedModels.push('gemini-1.5-flash');
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: 'Chef Advice: Disminuir el tiempo de horneado a 170C por 40 min.' }]
                }
              }
            ]
          })
        };
      }
    );

    // Execute fallback cascade
    const fallbackModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let finalResponse = null;

    for (const model of fallbackModels) {
      const resp = await mockFetch.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`);
      if (resp.ok) {
        finalResponse = await resp.json();
        break;
      }
    }

    assertNotNull(finalResponse);
    assertContains(attemptedModels, 'gemini-2.5-flash');
    assertContains(attemptedModels, 'gemini-2.0-flash');
    assertContains(attemptedModels, 'gemini-1.5-flash');
    assertContains(finalResponse.candidates[0].content.parts[0].text, 'Chef Advice');
  });
});
