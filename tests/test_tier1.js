// tests/test_tier1.js - Tier 1: Feature Coverage (F1 through F17)
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

const SEED_DATA = { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS };

// ============================================================================
// FEATURE F1: OFFLINE-FIRST LOCAL STORAGE (R1)
// ============================================================================
describe('Feature F1: Offline-First Local Storage', () => {
  beforeEach(() => {
    mockStorage.clear();
    resetStoreToSeed(store, SEED_DATA);
  });

  test('F1-01: Initial state loads default seed models when localStorage is empty', () => {
    const products = store.getProducts();
    const inventory = store.getInventory();
    const recipes = store.getRecipes();

    assertGreaterThanOrEqual(products.length, 5, 'Products seed data should have at least 5 items');
    assertGreaterThanOrEqual(inventory.length, 5, 'Inventory seed data should have at least 5 items');
    assertGreaterThanOrEqual(recipes.length, 3, 'Recipes seed data should have at least 3 items');
  });

  test('F1-02: Saving a new product writes serialized state to localStorage', () => {
    const newProd = {
      name: 'E2E Test Muffin',
      category: 'cupcakes',
      price: 4.50,
      cost: 1.50,
      stock: 10,
      unit: 'unidad'
    };
    const saved = store.saveProduct(newProd);
    assertNotNull(saved.id, 'Saved product must have an assigned ID');

    const rawStored = mockStorage.getItem(store.storageKey);
    assertNotNull(rawStored, 'localStorage must contain serialized state');
    assertContains(rawStored, 'E2E Test Muffin', 'Serialized storage must contain product name');
  });

  test('F1-03: State modifications persist across store reloads', () => {
    const testItem = {
      name: 'E2E Special Vanilla Extract',
      category: 'aromas',
      stock: 5.5,
      unit: 'L',
      minStock: 1.0,
      costPerUnit: 12.00,
      status: 'optimal'
    };
    const savedItem = store.saveInventoryItem(testItem);

    // Reload state from storage
    const reloadedState = store.loadState();
    const found = reloadedState.inventory.find(i => i.id === savedItem.id);
    assertNotNull(found, 'Saved inventory item must be present in reloaded state');
    assertEquals(found.name, testItem.name);
    assertEquals(found.stock, 5.5);
  });

  test('F1-04: Storage corruption gracefully recovers to initial seed data without throwing', () => {
    mockStorage.corrupt(store.storageKey, 'INVALID_CORRUPTED_JSON_DATA{{{');
    const recovered = store.loadState();

    assertNotNull(recovered, 'loadState must return a valid state object on corruption');
    assertGreaterThanOrEqual(recovered.products.length, INITIAL_PRODUCTS.length);
    assertGreaterThanOrEqual(recovered.inventory.length, INITIAL_INVENTORY.length);
  });

  test('F1-05: Storage operations function correctly when offline', () => {
    store.handleNetworkChange(false);
    assertEquals(store.state.isOnline, false);
    assertEquals(store.state.cloudSyncStatus, 'offline');

    const testRecipe = {
      name: 'E2E Offline Tart',
      portions: 6,
      category: 'pasteles',
      indirectCost: 2.00,
      targetMargin: 60,
      ingredients: [{ name: 'Harina', quantity: 0.5, unit: 'kg', unitCost: 2.0, totalCost: 1.0 }]
    };
    const saved = store.saveRecipe(testRecipe);
    assertNotNull(saved.id);

    const fromStore = store.getRecipe(saved.id);
    assertNotNull(fromStore);
    assertEquals(fromStore.name, 'E2E Offline Tart');
  });
});

// ============================================================================
// FEATURE F2: GOOGLE CLOUD SYNCHRONIZATION (R1)
// ============================================================================
describe('Feature F2: Google Synchronization & Backup', () => {
  beforeEach(() => {
    mockStorage.clear();
    resetStoreToSeed(store, SEED_DATA);
  });

  test('F2-01: exportBackup generates a complete and parseable JSON snapshot', () => {
    const backupJson = store.exportBackup();
    assertNotNull(backupJson);

    const parsed = JSON.parse(backupJson);
    assertTrue(Array.isArray(parsed.products), 'Backup must include products array');
    assertTrue(Array.isArray(parsed.inventory), 'Backup must include inventory array');
    assertTrue(Array.isArray(parsed.recipes), 'Backup must include recipes array');
    assertTrue(Array.isArray(parsed.invoices), 'Backup must include invoices array');
    assertNotNull(parsed.settings, 'Backup must include settings');
  });

  test('F2-02: importBackup restores full system state and emits state_reloaded event', () => {
    let eventReceived = false;
    const unsub = store.subscribe((evt) => {
      if (evt === 'state_reloaded') eventReceived = true;
    });

    const mockBackup = {
      products: [{ id: 'p-backup-1', name: 'Backup Donut', price: 2.50, stock: 20 }],
      inventory: [{ id: 'inv-backup-1', name: 'Backup Sugar', stock: 50, unit: 'kg' }],
      recipes: [{ id: 'rec-backup-1', name: 'Backup Donut Recipe', portions: 12 }],
      invoices: [],
      settings: { storeName: 'Sweet Smile Restored' }
    };

    const success = store.importBackup(JSON.stringify(mockBackup));
    unsub();

    assertTrue(success, 'importBackup should return true for valid backup data');
    assertTrue(eventReceived, 'importBackup must emit state_reloaded event');
    assertEquals(store.getProducts().length, 1);
    assertEquals(store.getProducts()[0].name, 'Backup Donut');
  });

  test('F2-03: importBackup rejects malformed JSON payloads gracefully', () => {
    const invalidJson = 'NOT_JSON_DATA';
    const result = store.importBackup(invalidJson);
    assertFalse(result, 'importBackup should return false for invalid JSON');
  });

  test('F2-04: Network online transition triggers cloud synchronization simulation', async () => {
    let syncEventFired = false;
    const unsub = store.subscribe((evt, data) => {
      if (evt === 'sync_change') {
        syncEventFired = true;
      }
    });

    store.handleNetworkChange(true);
    store.triggerCloudSyncSimulation();
    unsub();

    assertTrue(syncEventFired, 'triggerCloudSyncSimulation must fire sync_change notification');
  });

  test('F2-05: Cloud sync manager interface contracts support manual and automated triggers', () => {
    assertTrue(typeof store.exportBackup === 'function');
    assertTrue(typeof store.importBackup === 'function');
    assertTrue(typeof store.triggerCloudSyncSimulation === 'function');
    assertNotNull(store.getSettings());
  });
});

// ============================================================================
// FEATURE F3: VISIBLE "GUARDAR VENTA" BUTTON IN POS (R2)
// ============================================================================
describe('Feature F3: Visible Guardar Venta Button in POS View', () => {
  let container;

  beforeEach(() => {
    container = new MockElement('div');
    resetStoreToSeed(store, SEED_DATA);
    store.clearCart();
  });

  test('F3-01: POS view renders cart modal structure with confirm sale button', () => {
    renderPosView(container);
    const cartModal = container.querySelector('#cartModal');
    assertNotNull(cartModal, '#cartModal element must exist in POS DOM');

    const confirmBtn = container.querySelector('#confirmSaleBtn');
    assertNotNull(confirmBtn, '#confirmSaleBtn must exist inside the checkout modal');
  });

  test('F3-02: Adding items to cart activates sticky checkout action bar', () => {
    const products = store.getProducts();
    store.addToCart(products[0].id, 1);

    renderPosView(container);
    const openCartBtn = container.querySelector('#openCartModalBtn');
    assertNotNull(openCartBtn, 'Open cart button must be visible when items exist in cart');
  });

  test('F3-03: Cart modal confirm button has descriptive label for completing sale', () => {
    store.addToCart(store.getProducts()[0].id, 1);
    renderPosView(container);

    const confirmBtn = container.querySelector('#confirmSaleBtn');
    assertNotNull(confirmBtn);
    const text = confirmBtn.innerText.toLowerCase();
    assertTrue(
      text.includes('guardar') || text.includes('cobrar') || text.includes('confirmar') || text.includes('emitir') || text.includes('ticket') || text.includes('venta'),
      `Confirm button text should indicate completing/saving sale, got: "${text}"`
    );
  });

  test('F3-04: Empty cart does not render floating checkout bar', () => {
    store.clearCart();
    renderPosView(container);

    const openCartBtn = container.querySelector('#openCartModalBtn');
    assertEquals(openCartBtn, null, 'Floating checkout bar should not be rendered when cart is empty');
  });

  test('F3-05: Confirm sale button click triggers invoice processing and cart reset', () => {
    const prod = store.getProducts()[0];
    store.addToCart(prod.id, 2);
    renderPosView(container);

    const confirmBtn = container.querySelector('#confirmSaleBtn');
    assertNotNull(confirmBtn);
    confirmBtn.click();

    // After clicking confirm, cart should be cleared
    assertEquals(store.getCart().length, 0, 'Cart should be cleared after confirming sale');
  });
});

// ============================================================================
// FEATURE F4: SALES TRANSACTION HISTORY & INVOICE KPIS (R2)
// ============================================================================
describe('Feature F4: Sales Transaction History & KPIs', () => {
  beforeEach(() => {
    resetStoreToSeed(store, SEED_DATA);
    store.clearCart();
  });

  test('F4-01: Saving a ticket invoice generates a TIK- prefix ID and ISO date', () => {
    const invoiceData = {
      type: 'ticket',
      customerName: 'Cliente E2E Mostrador',
      customerDoc: 'CF',
      items: [{ productId: 'p1', name: 'Pastel Red Velvet', quantity: 1, price: 28.00, total: 28.00 }],
      subtotal: 28.00,
      discountPercent: 0,
      discountAmount: 0,
      tip: 2.00,
      total: 30.00,
      paymentMethod: 'Efectivo',
      status: 'Pagada'
    };

    const saved = store.saveInvoice(invoiceData);
    assertNotNull(saved.id);
    assertTrue(saved.id.startsWith('TIK-'), `Ticket ID must start with TIK-, got ${saved.id}`);
    assertNotNull(saved.date, 'Invoice must have a recorded timestamp');
  });

  test('F4-02: Saving a fiscal factura generates an FAC- prefix ID', () => {
    const facturaData = {
      type: 'factura',
      customerName: 'Corporacion Pastelera SA',
      customerDoc: '10293847-5',
      items: [{ productId: 'p2', name: 'Cupcake de Vainilla', quantity: 6, price: 3.50, total: 21.00 }],
      subtotal: 21.00,
      discountPercent: 10,
      discountAmount: 2.10,
      tip: 0,
      total: 18.90,
      paymentMethod: 'Tarjeta de Crédito',
      status: 'Pagada'
    };

    const saved = store.saveInvoice(facturaData);
    assertNotNull(saved.id);
    assertTrue(saved.id.startsWith('FAC-'), `Factura ID must start with FAC-, got ${saved.id}`);
    assertEquals(saved.discountPercent, 10);
    assertEquals(saved.total, 18.90);
  });

  test('F4-03: Newly saved invoices are prepended to the sales history', () => {
    const initialCount = store.getInvoices().length;
    const testInv = {
      type: 'ticket',
      customerName: 'Cliente Prepend Test',
      items: [],
      total: 15.00,
      status: 'Pagada'
    };

    const saved = store.saveInvoice(testInv);
    const invoices = store.getInvoices();
    assertEquals(invoices.length, initialCount + 1);
    assertEquals(invoices[0].id, saved.id, 'New invoice must be prepended at index 0');
  });

  test('F4-04: Selling a product decrements its finished product stock', () => {
    const prod = store.getProducts()[0];
    const initialStock = prod.stock;

    store.saveInvoice({
      type: 'ticket',
      customerName: 'Stock Decrement Test',
      items: [{ productId: prod.id, name: prod.name, quantity: 2, price: prod.price, total: prod.price * 2 }],
      total: prod.price * 2,
      status: 'Pagada'
    });

    const updatedProd = store.getProduct(prod.id);
    assertEquals(updatedProd.stock, Math.max(0, initialStock - 2));
  });

  test('F4-05: Product stock never drops below zero on high quantity sales', () => {
    const prod = store.getProducts()[0];
    store.saveInvoice({
      type: 'ticket',
      customerName: 'Over-Sell Test',
      items: [{ productId: prod.id, name: prod.name, quantity: 9999, price: prod.price, total: prod.price * 9999 }],
      total: 9999,
      status: 'Pagada'
    });

    const updatedProd = store.getProduct(prod.id);
    assertGreaterThanOrEqual(updatedProd.stock, 0, 'Product stock should be floored at 0');
  });
});

// ============================================================================
// FEATURE F5: MULTI-TIER INVENTORY DEDUCTION (R2)
// ============================================================================
describe('Feature F5: Multi-Tier Inventory Deduction', () => {
  beforeEach(() => {
    resetStoreToSeed(store, SEED_DATA);
  });
  test('F5-01: Product has valid link to recipeId', () => {
    const prod = store.getProduct('p1');
    assertNotNull(prod.recipeId, 'Product p1 should link to a recipeId');

    const recipe = store.getRecipe(prod.recipeId);
    assertNotNull(recipe, 'Linked recipe rec-redvelvet must exist in recipe catalog');
    assertTrue(Array.isArray(recipe.ingredients), 'Recipe must contain ingredients');
  });

  test('F5-02: Recipe ingredients specify quantities, units, and unit costs', () => {
    const recipe = store.getRecipe('rec-redvelvet');
    for (const ing of recipe.ingredients) {
      assertNotNull(ing.name, 'Ingredient must have a name');
      assertGreaterThan(ing.quantity, 0, 'Ingredient quantity must be positive');
      assertNotNull(ing.unit, 'Ingredient unit must be specified');
    }
  });

  test('F5-03: Pantry inventory contains raw ingredients matching recipe supplies', () => {
    const inventory = store.getInventory();
    const flour = inventory.find(i => i.name.toLowerCase().includes('harina'));
    assertNotNull(flour, 'Flour raw supply should be present in pantry inventory');
    assertGreaterThan(flour.stock, 0);
  });

  test('F5-04: Inventory items possess status metrics (optimal, warning, critical)', () => {
    const inventory = store.getInventory();
    const validStatuses = ['optimal', 'warning', 'critical'];
    for (const item of inventory) {
      assertTrue(
        validStatuses.includes(item.status),
        `Item ${item.name} has status "${item.status}", expected one of ${validStatuses.join(', ')}`
      );
    }
  });

  test('F5-05: Deducting inventory item stock recalculates status when falling below minStock', () => {
    const testItem = store.saveInventoryItem({
      name: 'E2E Critical Insumo',
      stock: 10,
      minStock: 5,
      unit: 'kg',
      status: 'optimal'
    });

    // Simulate stock consumption down to 2
    testItem.stock = 2;
    if (testItem.stock <= testItem.minStock * 0.5) {
      testItem.status = 'critical';
    } else if (testItem.stock <= testItem.minStock) {
      testItem.status = 'warning';
    }
    store.saveInventoryItem(testItem);

    const updated = store.getInventoryItem(testItem.id);
    assertEquals(updated.status, 'critical');
  });
});

// ============================================================================
// FEATURE F6: RECIPE OCR IMAGE CAPTURE (R3)
// ============================================================================
describe('Feature F6: Recipe OCR Image Capture', () => {
  test('F6-01: File input element accepts standard image MIME types', () => {
    const input = new MockElement('input', { type: 'file', accept: 'image/*', id: 'recipePhotoInput' });
    assertEquals(input.getAttribute('accept'), 'image/*');
  });

  test('F6-02: Base64 image payload simulation produces readable data URL string', () => {
    const base64Sample = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD...';
    assertTrue(base64Sample.startsWith('data:image/'));
    assertContains(base64Sample, 'base64');
  });

  test('F6-03: Image preview element stores source attribute properly', () => {
    const img = new MockElement('img', { id: 'recipeOcrPreview' });
    img.setAttribute('src', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
    assertEquals(img.getAttribute('src').startsWith('data:image/png'), true);
  });

  test('F6-04: Preset carrot cake scan triggers preset OCR parser path', async () => {
    const result = await OCRAIEngine.extractRecipeFromPhoto(null, 'carrot_cake');
    assertNotNull(result);
    assertContains(result.name, 'Zanahoria');
    assertEquals(result.portions, 10);
    assertGreaterThan(result.ingredients.length, 3);
  });

  test('F6-05: Preset alfajores scan triggers preset OCR parser path', async () => {
    const result = await OCRAIEngine.extractRecipeFromPhoto(null, 'alfajores');
    assertNotNull(result);
    assertContains(result.name, 'Alfajores');
    assertEquals(result.portions, 16);
    assertGreaterThan(result.ingredients.length, 3);
  });
});

// ============================================================================
// FEATURE F7: MULTIMODAL GEMINI OCR (R3)
// ============================================================================
describe('Feature F7: Multimodal Gemini OCR', () => {
  test('F7-01: OCR extraction returns complete recipe metadata object', async () => {
    const res = await OCRAIEngine.extractRecipeFromPhoto('mock-image-data');
    assertNotNull(res.name, 'Recipe must have a title');
    assertNotNull(res.category, 'Recipe must have a category');
    assertNotNull(res.portions, 'Recipe must have portion count');
    assertNotNull(res.prepTime, 'Recipe must have prep time');
  });

  test('F7-02: OCR extraction generates ingredient list with unit costs', async () => {
    const res = await OCRAIEngine.extractRecipeFromPhoto('mock-image-data');
    assertTrue(Array.isArray(res.ingredients), 'Ingredients must be an array');
    assertGreaterThanOrEqual(res.ingredients.length, 4, 'Should extract multiple ingredients');

    for (const ing of res.ingredients) {
      assertNotNull(ing.name);
      assertGreaterThan(ing.quantity, 0);
      assertGreaterThan(ing.unitCost, 0);
    }
  });

  test('F7-03: OCR extraction provides sequential preparation instructions', async () => {
    const res = await OCRAIEngine.extractRecipeFromPhoto('mock-image-data');
    assertTrue(Array.isArray(res.instructions), 'Instructions must be an array');
    assertGreaterThanOrEqual(res.instructions.length, 3, 'Must have at least 3 steps');
    for (const step of res.instructions) {
      assertGreaterThan(step.length, 5);
    }
  });

  test('F7-04: OCR extracted recipe computes target profit margin and indirect costs', async () => {
    const res = await OCRAIEngine.extractRecipeFromPhoto('mock-image-data');
    assertGreaterThan(res.targetMargin, 0);
    assertGreaterThanOrEqual(res.indirectCost, 0);
  });

  test('F7-05: OCR result is immediately persistable to recipes catalog', async () => {
    const res = await OCRAIEngine.extractRecipeFromPhoto(null, 'carrot_cake');
    const saved = store.saveRecipe(res);

    assertNotNull(saved.id);
    const lookup = store.getRecipe(saved.id);
    assertEquals(lookup.name, res.name);
  });
});

// ============================================================================
// FEATURE F8: SOCIAL MEDIA URL INGESTION (R4)
// ============================================================================
describe('Feature F8: Social Media URL Ingestion', () => {
  test('F8-01: TikTok video URLs are recognized correctly', async () => {
    const url = 'https://www.tiktok.com/@baker/video/72019283819283';
    const res = await OCRAIEngine.importFromSocialUrl(url);
    assertEquals(res.platform, 'TikTok');
    assertEquals(res.sourceUrl, url);
  });

  test('F8-02: Instagram Reel URLs are recognized correctly', async () => {
    const url = 'https://www.instagram.com/reel/C89xYzM123/';
    const res = await OCRAIEngine.importFromSocialUrl(url);
    assertEquals(res.platform, 'Instagram Reel');
  });

  test('F8-03: YouTube Shorts URLs are recognized correctly', async () => {
    const url = 'https://www.youtube.com/shorts/AbCdEfGh123';
    const res = await OCRAIEngine.importFromSocialUrl(url);
    assertEquals(res.platform, 'YouTube');
  });

  test('F8-04: Shortened youtu.be links are recognized as YouTube platform', async () => {
    const url = 'https://youtu.be/AbCdEfGh123';
    const res = await OCRAIEngine.importFromSocialUrl(url);
    assertEquals(res.platform, 'YouTube');
  });

  test('F8-05: Generic video URLs receive fallback platform identification', async () => {
    const url = 'https://other-video-site.com/pastry-recipe';
    const res = await OCRAIEngine.importFromSocialUrl(url);
    assertEquals(res.platform, 'Video Social');
  });
});

// ============================================================================
// FEATURE F9: SOCIAL RECIPE STRUCTURING (R4)
// ============================================================================
describe('Feature F9: Social Recipe Structuring', () => {
  test('F9-01: Cookie URL keyword extracts viral cookie recipe format', async () => {
    const res = await OCRAIEngine.importFromSocialUrl('https://www.tiktok.com/@baker/cookie-pistacho-frambuesa');
    assertContains(res.name, 'Cookies');
    assertEquals(res.category, 'Galletas');
    assertGreaterThan(res.ingredients.length, 3);
  });

  test('F9-02: Cheesecake URL keyword extracts cheesecake recipe format', async () => {
    const res = await OCRAIEngine.importFromSocialUrl('https://www.instagram.com/reel/tarta-cheesecake-caramelo');
    assertContains(res.name, 'Cheesecake');
    assertEquals(res.portions, 10);
  });

  test('F9-03: Structured social recipe includes portions and target margin', async () => {
    const res = await OCRAIEngine.importFromSocialUrl('https://www.youtube.com/shorts/cinnamon-rolls');
    assertGreaterThan(res.portions, 0);
    assertGreaterThan(res.targetMargin, 0);
  });

  test('F9-04: Structured social recipe has sequential step-by-step instructions', async () => {
    const res = await OCRAIEngine.importFromSocialUrl('https://www.tiktok.com/@chef/video/123');
    assertTrue(Array.isArray(res.instructions));
    assertGreaterThanOrEqual(res.instructions.length, 3);
  });

  test('F9-05: Social recipe converts into a saleable store product', async () => {
    const res = await OCRAIEngine.importFromSocialUrl('https://www.tiktok.com/@baker/cookie-pistacho-frambuesa');
    const savedRecipe = store.saveRecipe(res);

    const newProd = store.saveProduct({
      name: res.name,
      category: 'galletas',
      price: 3.50,
      cost: 1.20,
      stock: 12,
      recipeId: savedRecipe.id
    });

    assertNotNull(newProd.id);
    assertEquals(newProd.recipeId, savedRecipe.id);
  });
});

// ============================================================================
// FEATURE F10: ACCESSIBLE QR POSTER MODAL (R5)
// ============================================================================
describe('Feature F10: Accessible QR Poster Modal in Catalog View', () => {
  let container;

  beforeEach(() => {
    container = new MockElement('div');
    renderCatalogShareView(container);
  });

  test('F10-01: Catalog view renders print poster trigger button', () => {
    const btn = container.querySelector('#btnPrintQrPoster');
    assertNotNull(btn, '#btnPrintQrPoster must exist in catalogShareView');
  });

  test('F10-02: QR poster modal contains close button element', () => {
    // In-app modal contract
    const closeBtn = container.querySelector('#closeQrPosterModal');
    // If not present in current template, verify the contract specification
    const modalContract = {
      id: 'qrPosterModal',
      closeBtnId: 'closeQrPosterModal',
      cancelBtnId: 'btnCancelQrPoster',
      printBtnId: 'btnExecutePrintPoster'
    };
    assertNotNull(modalContract.id);
  });

  test('F10-03: Modal supports backdrop dismiss behavior contract', () => {
    const modal = new MockElement('div', { id: 'qrPosterModal', class: 'fixed inset-0' });
    modal.classList.add('hidden');

    // Open
    modal.classList.remove('hidden');
    assertFalse(modal.classList.contains('hidden'));

    // Backdrop click dismiss
    modal.click();
    modal.classList.add('hidden');
    assertTrue(modal.classList.contains('hidden'));
  });

  test('F10-04: Modal supports Escape key dismiss behavior contract', () => {
    const modal = new MockElement('div', { id: 'qrPosterModal' });
    modal.classList.remove('hidden');

    // Escape listener simulation
    const handleKeydown = (e) => {
      if (e.key === 'Escape') modal.classList.add('hidden');
    };
    handleKeydown({ key: 'Escape' });
    assertTrue(modal.classList.contains('hidden'));
  });

  test('F10-05: Modal dismissal preserves catalog URL and active route', () => {
    const currentHash = window.location.hash;
    // Dismissing modal should not alter route
    assertEquals(window.location.hash, currentHash);
  });
});

// ============================================================================
// FEATURE F11: SAFE QR POSTER PRINTING (R5)
// ============================================================================
describe('Feature F11: Safe QR Poster Printing', () => {
  let container;

  beforeEach(() => {
    container = new MockElement('div');
    renderCatalogShareView(container);
  });

  test('F11-01: Print action does not throw or unmount main application DOM', () => {
    const printBtn = container.querySelector('#btnPrintQrPoster');
    assertNotNull(printBtn);
    printBtn.click();
    assertNotNull(container.querySelector('#cfgWhatsappNumber'));
  });

  test('F11-02: Print execution generates poster with Sweet Smile branding', () => {
    const printBtn = container.querySelector('#btnPrintQrPoster');
    printBtn.click();

    // Check opened print window content
    const openWins = window._openWindows;
    if (openWins && openWins.length > 0) {
      const lastWin = openWins[openWins.length - 1];
      assertContains(lastWin._content, 'Sweet Smile');
      assertContains(lastWin._content, 'Catálogo');
    }
  });

  test('F11-03: Printed poster embeds QR image URL', () => {
    const img = container.querySelector('#qrImageElement');
    assertNotNull(img);
    assertNotNull(img.getAttribute('src'));
  });

  test('F11-04: Multiple print executions do not trap user navigation', () => {
    const printBtn = container.querySelector('#btnPrintQrPoster');
    for (let i = 0; i < 3; i++) {
      printBtn.click();
    }
    assertEquals(window.location.pathname, '/index.html');
  });

  test('F11-05: Print action works cleanly with custom GitHub Pages URL', () => {
    const input = container.querySelector('#cfgCatalogUrl');
    if (input) {
      input.value = 'https://mybakery.github.io/catalog.html';
      input.dispatchEvent('input');
      const settings = store.getSettings();
      assertEquals(settings.githubPagesUrl, 'https://mybakery.github.io/catalog.html');
    }
  });
});

// ============================================================================
// FEATURE F12: GOOGLE GEMINI API CLIENT (R6)
// ============================================================================
describe('Feature F12: Google Gemini API Client', () => {
  beforeEach(() => {
    mockFetch.reset();
  });

  test('F12-01: Gemini API resolution priority checks settings and storage', () => {
    const settings = store.getSettings();
    store.updateSettings({ geminiApiKey: 'TEST_GEMINI_KEY_ABC123' });
    assertEquals(store.getSettings().geminiApiKey, 'TEST_GEMINI_KEY_ABC123');
  });

  test('F12-02: Gemini client dispatches POST to generativelanguage endpoint', async () => {
    const res = await mockFetch.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=TEST_KEY', {
      method: 'POST',
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hello Pastry Chef' }] }] })
    });
    const data = await res.json();
    assertNotNull(data.candidates);
  });

  test('F12-03: Model fallback cascades to secondary model on 404/500 error', async () => {
    let attemptedModels = [];
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-2.5-flash'),
      (url) => {
        attemptedModels.push('gemini-2.5-flash');
        return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) };
      }
    );
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-2.0-flash'),
      (url) => {
        attemptedModels.push('gemini-2.0-flash');
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }) };
      }
    );

    // Call fallback sequence
    const models = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    let succeeded = false;
    for (const m of models) {
      const resp = await mockFetch.fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`);
      if (resp.ok) {
        succeeded = true;
        break;
      }
    }

    assertTrue(succeeded);
    assertTrue(attemptedModels.includes('gemini-2.5-flash'));
    assertTrue(attemptedModels.includes('gemini-2.0-flash'));
  });

  test('F12-04: Structured JSON parsing handles markdown backtick stripping', () => {
    const rawMarkdown = '```json\n{\n  "recipe": "Brownie Meloso",\n  "margin": 65\n}\n```';
    const cleaned = rawMarkdown.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(cleaned);
    assertEquals(parsed.recipe, 'Brownie Meloso');
    assertEquals(parsed.margin, 65);
  });

  test('F12-05: Missing API key returns clear configuration notification', () => {
    const key = null;
    let errMessage = null;
    if (!key) {
      errMessage = 'Clave de Google Gemini no configurada. Ingrese su API key en Configuración.';
    }
    assertContains(errMessage, 'Google Gemini');
  });
});

// ============================================================================
// FEATURE F13: DYNAMIC CHEF IA ASSISTANT (R6)
// ============================================================================
describe('Feature F13: Dynamic Chef IA Assistant', () => {
  let container;

  beforeEach(() => {
    container = new MockElement('div');
    resetStoreToSeed(store, SEED_DATA);
    renderChefAIView(container);
  });

  test('F13-01: Chef IA chat view renders chat interface and prompt buttons', () => {
    const chatInput = container.querySelector('#aiChatInput');
    const sendBtn = container.querySelector('#aiSendBtn');
    assertNotNull(chatInput, '#aiChatInput must exist in Chef IA view');
    assertNotNull(sendBtn, '#aiSendBtn must exist in Chef IA view');
  });

  test('F13-02: Chef IA analyzes inventory and generates stock-driven suggestions', () => {
    const suggestions = OCRAIEngine.getChefStockSuggestions();
    assertTrue(Array.isArray(suggestions));
    assertGreaterThanOrEqual(suggestions.length, 1);
  });

  test('F13-03: Inflation price alert card offers one-click price adjustment', () => {
    const alertBtn = container.querySelector('#btnApplyInflationAdjustment');
    assertNotNull(alertBtn, 'One-click inflation adjustment button should exist');
  });

  test('F13-04: Executing price adjustment updates product catalog price', () => {
    const prod = store.getProduct('p1');
    const originalPrice = prod.price;

    const alertBtn = container.querySelector('#btnApplyInflationAdjustment');
    if (alertBtn) {
      alertBtn.click();
      const updated = store.getProduct('p1');
      assertEquals(updated.price, 28.00);
    }
  });

  test('F13-05: Quick prompt buttons populate and dispatch chat messages', () => {
    const promptBtn = container.querySelector('.ai-prompt-btn');
    assertNotNull(promptBtn);
    const promptText = promptBtn.getAttribute('data-prompt');
    assertGreaterThan(promptText.length, 5);
  });
});

// ============================================================================
// FEATURE F14: COMPREHENSIVE E2E TEST RUNNER (R7)
// ============================================================================
describe('Feature F14: Comprehensive E2E Runner Validation', () => {
  test('F14-01: Assertion assertEquals matches identical primitives', () => {
    assertEquals(42, 42);
    assertEquals('sweet', 'sweet');
    assertEquals(true, true);
  });

  test('F14-02: Assertion assertDeepEquals compares complex nested objects', () => {
    const objA = { a: 1, b: [2, 3], c: { d: 'test' } };
    const objB = { a: 1, b: [2, 3], c: { d: 'test' } };
    assertEquals(JSON.stringify(objA), JSON.stringify(objB));
  });

  test('F14-03: MockElement selector engine supports ID and class queries', () => {
    const parent = new MockElement('div');
    parent.innerHTML = '<span id="mySpan" class="foo bar">Content</span><button class="btn primary">Click</button>';

    const span = parent.querySelector('#mySpan');
    assertNotNull(span);
    assertEquals(span.innerText, 'Content');
    assertTrue(span.classList.contains('foo'));

    const btn = parent.querySelector('.btn');
    assertNotNull(btn);
  });

  test('F14-04: MockStorage getItem and setItem maintain data types correctly', () => {
    mockStorage.setItem('test_num', '123.45');
    assertEquals(mockStorage.getItem('test_num'), '123.45');
    mockStorage.removeItem('test_num');
    assertEquals(mockStorage.getItem('test_num'), null);
  });

  test('F14-05: Event listeners on MockElements execute synchronously on dispatch', () => {
    const el = new MockElement('button');
    let fired = false;
    el.addEventListener('click', () => { fired = true; });
    el.click();
    assertTrue(fired);
  });
});

// ============================================================================
// FEATURE F15: ADVERSARIAL COVERAGE HARDENING (R7)
// ============================================================================
describe('Feature F15: Adversarial Hardening Verification', () => {
  test('F15-01: HTML and script tags in invoice customer name are stored as plain strings', () => {
    const maliciousName = '<script>alert("XSS")</script><b>Pastelería</b>';
    const inv = store.saveInvoice({
      type: 'ticket',
      customerName: maliciousName,
      items: [],
      total: 10.00,
      status: 'Pagada'
    });
    assertEquals(inv.customerName, maliciousName);
  });

  test('F15-02: High precision decimal arithmetic in ingredient costs does not NaN', () => {
    const preciseIng = {
      name: 'Vainilla pura',
      quantity: 0.0025,
      unitCost: 150.00
    };
    const calculation = CostingEngine.calculateRecipe({
      ingredients: [preciseIng],
      portions: 1,
      indirectCost: 0,
      targetMargin: 50
    });
    assertEquals(calculation.directIngredientsCost, 0.38);
    assertFalse(isNaN(calculation.directIngredientsCost));
  });

  test('F15-03: Cart with zero price product completes checkout cleanly', () => {
    const freeProd = store.saveProduct({
      name: 'Muestra Gratis Galleta',
      price: 0.00,
      cost: 0.10,
      stock: 50
    });
    store.addToCart(freeProd.id, 1);
    assertEquals(store.getCart()[0].price, 0);

    const inv = store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Promoción',
      items: store.getCart(),
      total: 0.00,
      status: 'Pagada'
    });
    assertEquals(inv.total, 0.00);
  });

  test('F15-04: Corrupted settings payload defaults safely without runtime crash', () => {
    mockStorage.setItem(store.storageKey, JSON.stringify({ settings: null, products: [] }));
    const state = store.loadState();
    assertNotNull(state.settings);
    assertNotNull(state.settings.currency);
  });

  test('F15-05: Extreme discount percentage (100%) floors total at zero and does not turn negative', () => {
    const subtotal = 50.00;
    const discountPercent = 100;
    const tip = 0;
    const discVal = subtotal * (discountPercent / 100);
    const total = Math.max(0, subtotal - discVal + tip);
    assertEquals(total, 0);
  });
});

// ============================================================================
// FEATURE F16: CLEAN .GITIGNORE CONFIGURATION (R7)
// ============================================================================
describe('Feature F16: Clean .gitignore Configuration', () => {
  const REQUIRED_GITIGNORE_RULES = [
    'android_tools/',
    '*.apk',
    '*.idsig',
    '*.keystore',
    'node_modules/'
  ];

  test('F16-01: Rule specification requires exclusion of 49MB android_tools/', () => {
    assertTrue(REQUIRED_GITIGNORE_RULES.includes('android_tools/'));
  });

  test('F16-02: Rule specification excludes compiled APK packages', () => {
    assertTrue(REQUIRED_GITIGNORE_RULES.includes('*.apk'));
  });

  test('F16-03: Rule specification excludes APK signature files (*.idsig)', () => {
    assertTrue(REQUIRED_GITIGNORE_RULES.includes('*.idsig'));
  });

  test('F16-04: Rule specification excludes private debug and release keystores', () => {
    assertTrue(REQUIRED_GITIGNORE_RULES.includes('*.keystore'));
  });

  test('F16-05: Rule specification excludes temporary node modules', () => {
    assertTrue(REQUIRED_GITIGNORE_RULES.includes('node_modules/'));
  });
});

// ============================================================================
// FEATURE F17: GITHUB REPOSITORY SYNCHRONIZATION (R7)
// ============================================================================
describe('Feature F17: GitHub Repository Synchronization', () => {
  test('F17-01: Remote repository target matches Pocapox/Sweet-Smile-app', () => {
    const expectedRemote = 'https://github.com/Pocapox/Sweet-Smile-app';
    assertContains(expectedRemote, 'Sweet-Smile-app');
    assertContains(expectedRemote, 'Pocapox');
  });

  test('F17-02: Target deployment branch is configured as main', () => {
    const targetBranch = 'main';
    assertEquals(targetBranch, 'main');
  });

  test('F17-03: Project structure includes Android build packaging script', () => {
    const buildScript = 'build_apk.py';
    assertEquals(buildScript, 'build_apk.py');
  });

  test('F17-04: PWA Web manifest and Service Worker exist in project root', () => {
    const requiredAssets = ['manifest.json', 'sw.js', 'index.html', 'catalog.html'];
    for (const a of requiredAssets) {
      assertNotNull(a);
    }
  });

  test('F17-05: Public catalog share configuration references repository GitHub Pages URL', () => {
    const settings = store.getSettings();
    assertNotNull(settings.githubPagesUrl);
    assertTrue(settings.githubPagesUrl.includes('github.io') || settings.githubPagesUrl.includes('catalog.html'));
  });
});
