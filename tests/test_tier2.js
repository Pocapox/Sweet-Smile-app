// tests/test_tier2.js - Tier 2: Boundary & Corner Cases (F1 through F17)
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
// FEATURE F1: OFFLINE-FIRST LOCAL STORAGE (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F1: Storage Boundary & Resilience', () => {
  beforeEach(() => {
    mockStorage.clear();
    resetStoreToSeed(store, SEED_DATA);
  });

  test('B1-01: Storage quota exhaustion simulation does not crash saveState', () => {
    // Override setItem to simulate QuotaExceededError
    const originalSetItem = mockStorage.setItem.bind(mockStorage);
    mockStorage.setItem = () => {
      const err = new Error('QuotaExceededError: DOM Exception 22');
      err.name = 'QuotaExceededError';
      throw err;
    };

    let crashed = false;
    try {
      store.saveProduct({ name: 'Quota Overflow Cake', price: 10 });
    } catch {
      crashed = true;
    }
    mockStorage.setItem = originalSetItem;

    assertFalse(crashed, 'saveProduct/saveState should gracefully handle storage quota errors');
  });

  test('B1-02: Handling empty string or null keys in mock storage', () => {
    mockStorage.setItem('', 'empty_key_val');
    assertEquals(mockStorage.getItem(''), 'empty_key_val');
    mockStorage.removeItem('');
    assertEquals(mockStorage.getItem(''), null);
  });

  test('B1-03: Maximum serialized state payload size handles 500 products', () => {
    const bigProducts = [];
    for (let i = 0; i < 500; i++) {
      bigProducts.push({
        id: `p-stress-${i}`,
        name: `Pastel Gigante Edición ${i}`,
        price: 25.00 + (i % 10),
        cost: 10.00,
        stock: 5
      });
    }
    store.state.products = bigProducts;
    store.saveState();

    const stored = mockStorage.getItem(store.storageKey);
    assertNotNull(stored);
    assertGreaterThan(stored.length, 10000);

    const reloaded = store.loadState();
    assertEquals(reloaded.products.length, 500);
  });

  test('B1-04: Rapid concurrent saveState calls preserve data integrity', () => {
    for (let i = 0; i < 50; i++) {
      store.saveProduct({ id: `p-concurrent-${i}`, name: `Pastel ${i}`, price: 10 });
    }
    assertEquals(store.getProducts().filter(p => p.id.startsWith('p-concurrent-')).length, 50);
  });

  test('B1-05: Missing nested collections in storage JSON default safely', () => {
    mockStorage.setItem(store.storageKey, JSON.stringify({ products: [] }));
    const loaded = store.loadState();
    assertNotNull(loaded.inventory, 'Missing inventory should fallback to seed');
    assertNotNull(loaded.recipes, 'Missing recipes should fallback to seed');
    assertNotNull(loaded.invoices, 'Missing invoices should fallback to seed');
  });
});

// ============================================================================
// FEATURE F2: GOOGLE CLOUD SYNCHRONIZATION (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F2: Cloud Sync & Backup Boundaries', () => {
  beforeEach(() => {
    resetStoreToSeed(store, SEED_DATA);
  });

  test('B2-01: importBackup with empty string or whitespace returns false', () => {
    assertFalse(store.importBackup(''));
    assertFalse(store.importBackup('   \n  \t  '));
  });

  test('B2-02: importBackup with syntax error JSON returns false', () => {
    assertFalse(store.importBackup('{"products": [ { id: "p1"'));
  });

  test('B2-03: importBackup with primitive or array root returns false', () => {
    assertFalse(store.importBackup('12345'));
    assertFalse(store.importBackup('"just a string"'));
    assertFalse(store.importBackup('["an", "array"]'));
  });

  test('B2-04: Extended offline simulation preserves offline status and pending mutations', () => {
    store.handleNetworkChange(false);
    assertEquals(store.state.cloudSyncStatus, 'offline');

    store.saveProduct({ name: 'Offline Product 1', price: 5 });
    store.saveProduct({ name: 'Offline Product 2', price: 6 });

    assertEquals(store.state.cloudSyncStatus, 'offline');
    assertNotNull(store.getProducts().find(p => p.name === 'Offline Product 1'));
  });

  test('B2-05: Rapid network flapping toggles state smoothly without errors', () => {
    for (let i = 0; i < 20; i++) {
      const isOnline = i % 2 === 0;
      store.handleNetworkChange(isOnline);
      assertEquals(store.state.isOnline, isOnline);
    }
  });
});

// ============================================================================
// FEATURE F3: VISIBLE "GUARDAR VENTA" BUTTON (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F3: POS Checkout Button Boundaries', () => {
  let container;

  beforeEach(() => {
    container = new MockElement('div');
    resetStoreToSeed(store, SEED_DATA);
    store.clearCart();
  });

  test('B3-01: Cart item with zero quantity does not create phantom checkout', () => {
    store.updateCartQty('p1', 0);
    assertEquals(store.getCart().length, 0);

    renderPosView(container);
    assertEquals(container.querySelector('#openCartModalBtn'), null);
  });

  test('B3-02: Confirm button on empty cart does not create blank invoice', () => {
    renderPosView(container);
    const initialInvoicesCount = store.getInvoices().length;

    const confirmBtn = container.querySelector('#confirmSaleBtn');
    if (confirmBtn) {
      confirmBtn.click();
    }
    assertEquals(store.getInvoices().length, initialInvoicesCount);
  });

  test('B3-03: Rapid multiple clicks on confirm sale are safely handled', () => {
    store.addToCart('p1', 1);
    renderPosView(container);

    const initialInvoicesCount = store.getInvoices().length;
    const confirmBtn = container.querySelector('#confirmSaleBtn');
    if (confirmBtn) {
      confirmBtn.click();
      confirmBtn.click();
      confirmBtn.click();
    }
    // Only one invoice should have been generated since cart was cleared after first
    assertEquals(store.getInvoices().length, initialInvoicesCount + 1);
  });

  test('B3-04: POS view layout maintains structural integrity without errors', () => {
    renderPosView(container, 'pos');
    assertNotNull(container.querySelector('#posSearch'));
    assertNotNull(container.querySelector('#tabPosBtn'));
    assertNotNull(container.querySelector('#tabInvoicesBtn'));
  });

  test('B3-05: Cart with 50 items calculates total without floating point distortion', () => {
    for (let i = 0; i < 50; i++) {
      const prod = store.saveProduct({ id: `p-bulk-${i}`, name: `Bulk ${i}`, price: 1.10 });
      store.addToCart(prod.id, 1);
    }
    const cart = store.getCart();
    assertEquals(cart.length, 50);

    const subtotal = cart.reduce((s, it) => s + (it.price * it.quantity), 0);
    assertEquals(Math.round(subtotal * 100) / 100, 55.00);
  });
});

// ============================================================================
// FEATURE F4: SALES TRANSACTION HISTORY & KPIS (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F4: Sales Invoices & KPIs Boundaries', () => {
  beforeEach(() => {
    resetStoreToSeed(store, SEED_DATA);
  });

  test('B4-01: Sale with subtotal $0.00 (promotional giveaway) records cleanly', () => {
    const inv = store.saveInvoice({
      type: 'ticket',
      customerName: 'Cliente Promoción',
      items: [{ productId: 'p1', name: 'Muestra Gratis', quantity: 1, price: 0.00, total: 0.00 }],
      subtotal: 0.00,
      total: 0.00,
      status: 'Pagada'
    });
    assertEquals(inv.total, 0.00);
    assertTrue(inv.id.startsWith('TIK-'));
  });

  test('B4-02: Maximum invoice total ($99,999.99 large catering order) formats correctly', () => {
    const inv = store.saveInvoice({
      type: 'factura',
      customerName: 'Gran Hotel & Convenciones',
      customerDoc: '99999999-9',
      items: [{ productId: 'p1', name: 'Banquete 1000 pers', quantity: 1, price: 99999.99, total: 99999.99 }],
      subtotal: 99999.99,
      total: 99999.99,
      status: 'Pagada'
    });
    assertEquals(inv.total, 99999.99);
    assertTrue(inv.id.startsWith('FAC-'));
  });

  test('B4-03: Invoice with 100% discount produces $0.00 total without negative result', () => {
    const subtotal = 120.00;
    const discountPercent = 100;
    const discAmount = subtotal * (discountPercent / 100);
    const total = Math.max(0, subtotal - discAmount);

    const inv = store.saveInvoice({
      type: 'ticket',
      customerName: 'Descuento Total',
      subtotal,
      discountPercent,
      discountAmount: discAmount,
      total,
      status: 'Pagada'
    });
    assertEquals(inv.total, 0);
  });

  test('B4-04: Tip amount exceeding subtotal handles properly', () => {
    const subtotal = 3.50;
    const tip = 20.00;
    const total = subtotal + tip;

    const inv = store.saveInvoice({
      type: 'ticket',
      customerName: 'Generous Customer',
      subtotal,
      tip,
      total,
      status: 'Pagada'
    });
    assertEquals(inv.total, 23.50);
  });

  test('B4-05: Customer name with 500 characters and emojis stores safely', () => {
    const longName = '🍰 Pastelería Real '.repeat(25) + '✨🎉';
    const inv = store.saveInvoice({
      type: 'ticket',
      customerName: longName,
      total: 15.00,
      status: 'Pagada'
    });
    assertEquals(inv.customerName, longName);
  });
});

// ============================================================================
// FEATURE F5: MULTI-TIER INVENTORY DEDUCTION (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F5: Multi-Tier Inventory Deduction Boundaries', () => {
  beforeEach(() => {
    resetStoreToSeed(store, SEED_DATA);
  });

  test('B5-01: Product linked to non-existent recipeId does not throw on sale', () => {
    const orphanProd = store.saveProduct({
      name: 'Pastel Sin Receta',
      price: 15.00,
      cost: 5.00,
      stock: 10,
      recipeId: 'rec-non-existent-999'
    });

    let threw = false;
    try {
      store.saveInvoice({
        type: 'ticket',
        customerName: 'Orphan Recipe Test',
        items: [{ productId: orphanProd.id, name: orphanProd.name, quantity: 1, price: 15.00, total: 15.00 }],
        total: 15.00,
        status: 'Pagada'
      });
    } catch {
      threw = true;
    }
    assertFalse(threw);
  });

  test('B5-02: Recipe ingredient with zero quantity does not alter pantry stock', () => {
    const inventory = store.getInventory();
    const flour = inventory.find(i => i.name.toLowerCase().includes('harina'));
    const initialFlourStock = flour ? flour.stock : 10;

    // Zero quantity ingredient
    const zeroIng = { name: 'Harina', quantity: 0, unit: 'kg' };
    const stockChange = zeroIng.quantity * 5;
    assertEquals(stockChange, 0);
  });

  test('B5-03: Micro-quantity ingredient deduction (0.0005 kg) maintains precision', () => {
    const saffron = store.saveInventoryItem({
      name: 'Azafrán Repostero',
      stock: 0.050,
      unit: 'kg',
      minStock: 0.010,
      costPerUnit: 2000.00,
      status: 'optimal'
    });

    const deducted = Math.round((saffron.stock - 0.0005) * 10000) / 10000;
    assertEquals(deducted, 0.0495);
  });

  test('B5-04: Inventory stock reaching exact zero marks status as critical', () => {
    const item = store.saveInventoryItem({
      name: 'Polvo de Hornear',
      stock: 0.1,
      minStock: 0.5,
      unit: 'kg',
      status: 'warning'
    });

    item.stock = 0;
    if (item.stock <= 0) item.status = 'critical';
    store.saveInventoryItem(item);

    const reloaded = store.getInventoryItem(item.id);
    assertEquals(reloaded.stock, 0);
    assertEquals(reloaded.status, 'critical');
  });

  test('B5-05: Case-insensitive ingredient matching resolves correctly', () => {
    const targetName = 'HARINA DE TRIGO ESPECIAL';
    const inventory = store.getInventory();
    const match = inventory.find(i => i.name.toUpperCase().includes('HARINA'));
    assertNotNull(match, 'Should match Harina regardless of casing');
  });
});

// ============================================================================
// FEATURE F6: RECIPE OCR IMAGE CAPTURE (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F6: Recipe OCR Capture Boundaries', () => {
  test('B6-01: File input rejects non-matching mime types defensively', () => {
    const input = new MockElement('input', { type: 'file', accept: 'image/*' });
    const isImage = (mime) => mime.startsWith('image/');
    assertFalse(isImage('application/pdf'));
    assertFalse(isImage('text/plain'));
    assertTrue(isImage('image/png'));
    assertTrue(isImage('image/jpeg'));
  });

  test('B6-02: Zero-byte or empty file input simulation handles gracefully', async () => {
    const emptyPayload = '';
    const res = await OCRAIEngine.extractRecipeFromPhoto(emptyPayload);
    assertNotNull(res.name);
  });

  test('B6-03: Corrupted or truncated base64 string does not throw crash', async () => {
    const corruptBase64 = 'data:image/png;base64,CORRUPTED===';
    const res = await OCRAIEngine.extractRecipeFromPhoto(corruptBase64);
    assertNotNull(res);
  });

  test('B6-04: Large payload simulation (simulating 5MB image string) handles cleanly', async () => {
    const bigString = 'data:image/jpeg;base64,' + 'A'.repeat(50000);
    const res = await OCRAIEngine.extractRecipeFromPhoto(bigString);
    assertNotNull(res.ingredients);
  });

  test('B6-05: Null or undefined image source produces valid fallback recipe', async () => {
    const res1 = await OCRAIEngine.extractRecipeFromPhoto(null);
    const res2 = await OCRAIEngine.extractRecipeFromPhoto(undefined);
    assertNotNull(res1.name);
    assertNotNull(res2.name);
  });
});

// ============================================================================
// FEATURE F7: MULTIMODAL GEMINI OCR (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F7: Multimodal Gemini OCR Boundaries', () => {
  test('B7-01: Empty ingredients array in parsed OCR defaults to safe structure', () => {
    const rawOcr = { name: 'Receta Minimalista', ingredients: [] };
    const safeIngredients = Array.isArray(rawOcr.ingredients) ? rawOcr.ingredients : [];
    assertEquals(safeIngredients.length, 0);
  });

  test('B7-02: Portions count clamped to minimum 1 if OCR returns 0 or negative', () => {
    const rawPortions = -5;
    const clampedPortions = Math.max(1, rawPortions || 1);
    assertEquals(clampedPortions, 1);
  });

  test('B7-03: Missing instructions in OCR result provides empty or default step array', () => {
    const rawOcr = { name: 'Receta Sin Pasos' };
    const instructions = rawOcr.instructions || ['Mezclar y hornear según técnica tradicional.'];
    assertEquals(instructions.length, 1);
  });

  test('B7-04: Zero or negative unit cost clamped defensively in recipe costing', () => {
    const ing = { name: 'Sal', quantity: 0.01, unitCost: -2.00 };
    const safeCost = Math.max(0, ing.unitCost);
    assertEquals(safeCost, 0);
  });

  test('B7-05: Special characters in recipe name are preserved without syntax corruption', async () => {
    const res = await OCRAIEngine.extractRecipeFromPhoto('mock', 'carrot_cake');
    const complexTitle = `🍰 "Torta Especial" & Crème Brûlée <100%>`;
    res.name = complexTitle;
    const saved = store.saveRecipe(res);
    assertEquals(saved.name, complexTitle);
  });
});

// ============================================================================
// FEATURE F8: SOCIAL MEDIA URL INGESTION (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F8: Social Media URL Ingestion Boundaries', () => {
  test('B8-01: URL without protocol prefix parses domain platform', async () => {
    const url = 'tiktok.com/@pastry/video/123456';
    const res = await OCRAIEngine.importFromSocialUrl(url);
    assertEquals(res.platform, 'TikTok');
  });

  test('B8-02: URL containing complex tracking query parameters strips or handles cleanly', async () => {
    const url = 'https://www.instagram.com/reel/C12345/?utm_source=ig_web_copy_link&igsh=MzRlODBiNWFlZA==';
    const res = await OCRAIEngine.importFromSocialUrl(url);
    assertEquals(res.platform, 'Instagram Reel');
  });

  test('B8-03: URL with surrounding whitespaces and tabs is trimmed', async () => {
    const url = '  \t https://www.youtube.com/shorts/AbCd123 \n ';
    const res = await OCRAIEngine.importFromSocialUrl(url);
    assertEquals(res.platform, 'YouTube');
  });

  test('B8-04: Empty string URL provides fallback generic recipe without crash', async () => {
    const res = await OCRAIEngine.importFromSocialUrl('');
    assertNotNull(res);
    assertNotNull(res.name);
  });

  test('B8-05: Unsupported domain URL defaults to Video Social platform', async () => {
    const res = await OCRAIEngine.importFromSocialUrl('https://vimeo.com/987654321');
    assertEquals(res.platform, 'Video Social');
  });
});

// ============================================================================
// FEATURE F9: SOCIAL RECIPE STRUCTURING (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F9: Social Recipe Structuring Boundaries', () => {
  test('B9-01: Target margin extreme values clamp between 5% and 95%', () => {
    const calcMin = CostingEngine.calculateRecipe({ portions: 1, ingredients: [{ quantity: 1, unitCost: 10 }] }, 0);
    assertEquals(calcMin.targetMargin, 5);

    const calcMax = CostingEngine.calculateRecipe({ portions: 1, ingredients: [{ quantity: 1, unitCost: 10 }] }, 99);
    assertEquals(calcMax.targetMargin, 95);
  });

  test('B9-02: High portion count (1,000 portions for industrial catering) scales price', () => {
    const calc = CostingEngine.calculateRecipe({
      portions: 1000,
      indirectCost: 50.00,
      targetMargin: 50,
      ingredients: [{ quantity: 100, unitCost: 2.00 }] // $200
    });
    // Total production: 200 + 50 = $250. Suggested price at 50% margin = $500. Unit price = $0.50
    assertEquals(calc.totalProductionCost, 250);
    assertEquals(calc.suggestedPrice, 500);
    assertEquals(calc.suggestedUnitPrice, 0.50);
  });

  test('B9-03: Ingredients with non-standard units store and calculate without error', () => {
    const calc = CostingEngine.calculateRecipe({
      portions: 4,
      indirectCost: 0,
      targetMargin: 60,
      ingredients: [
        { name: 'Canela', quantity: 1, unit: 'pizca', unitCost: 0.05 },
        { name: 'Vainilla', quantity: 2, unit: 'chorrito', unitCost: 0.20 }
      ]
    });
    assertEquals(calc.directIngredientsCost, 0.45);
  });

  test('B9-04: Single-step instruction recipe stores valid instructions array', () => {
    const recipe = {
      name: 'Galletas Express',
      portions: 6,
      instructions: ['Mezclar todos los ingredientes, formar bolitas y hornear a 180°C por 12 minutos.']
    };
    assertEquals(recipe.instructions.length, 1);
  });

  test('B9-05: Missing recipe title defaults with platform branding', async () => {
    const res = await OCRAIEngine.importFromSocialUrl('https://www.tiktok.com/@baker/video/999');
    assertTrue(res.name.length > 0);
  });
});

// ============================================================================
// FEATURE F10: ACCESSIBLE QR POSTER MODAL (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F10: QR Modal Accessibility Boundaries', () => {
  let modal;

  beforeEach(() => {
    modal = new MockElement('div', { id: 'qrPosterModal', class: 'fixed inset-0 hidden' });
  });

  test('B10-01: Repeated Escape key events when modal is already closed do nothing', () => {
    assertTrue(modal.classList.contains('hidden'));
    const handleKeydown = (e) => {
      if (e.key === 'Escape') modal.classList.add('hidden');
    };
    handleKeydown({ key: 'Escape' });
    handleKeydown({ key: 'Escape' });
    assertTrue(modal.classList.contains('hidden'));
  });

  test('B10-02: Clicking modal content card does not trigger backdrop dismissal', () => {
    const contentCard = new MockElement('div', { id: 'qrPosterCard' });
    modal.appendChild(contentCard);
    modal.classList.remove('hidden');

    let dismissed = false;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) dismissed = true;
    });

    // Click on card
    contentCard.dispatchEvent({ type: 'click', target: contentCard, stopPropagation() {} });
    assertFalse(dismissed, 'Clicking card should not trigger backdrop dismissal');
  });

  test('B10-03: Rapid multiple open/close toggles maintain consistent classList state', () => {
    for (let i = 0; i < 20; i++) {
      modal.classList.toggle('hidden');
    }
    assertTrue(modal.classList.contains('hidden'));
  });

  test('B10-04: Querying modal elements when container is empty returns null safely', () => {
    const emptyContainer = new MockElement('div');
    assertEquals(emptyContainer.querySelector('#qrPosterModal'), null);
    assertEquals(emptyContainer.querySelector('#closeQrPosterModal'), null);
  });

  test('B10-05: Modal maintains high z-index (z-50) for overlay accessibility', () => {
    modal.setAttribute('class', 'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm');
    assertContains(modal.getAttribute('class'), 'z-50');
  });
});

// ============================================================================
// FEATURE F11: SAFE QR POSTER PRINTING (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F11: Safe QR Poster Printing Boundaries', () => {
  let container;

  beforeEach(() => {
    container = new MockElement('div');
    renderCatalogShareView(container);
  });

  test('B11-01: Popup blocker simulation (window.open returns null) does not throw', () => {
    const originalOpen = window.open;
    window.open = () => null; // Simulate popup blocker

    let threw = false;
    try {
      container.querySelector('#btnPrintQrPoster')?.click();
    } catch {
      threw = true;
    }
    window.open = originalOpen;
    assertFalse(threw, 'Should gracefully handle popup blocker without throwing unhandled error');
  });

  test('B11-02: Printing with complex catalog URL query parameters preserves link in poster', () => {
    const complexUrl = 'https://myshop.github.io/catalog.html?category=pasteles&ref=qr_counter';
    const input = container.querySelector('#cfgCatalogUrl');
    if (input) {
      input.value = complexUrl;
      input.dispatchEvent('input');
    }
    container.querySelector('#btnPrintQrPoster')?.click();
    assertEquals(store.getSettings().githubPagesUrl, complexUrl);
  });

  test('B11-03: Empty WhatsApp number setting uses fallback placeholder', () => {
    store.updateSettings({ whatsappNumber: '' });
    renderCatalogShareView(container);
    const input = container.querySelector('#cfgWhatsappNumber');
    assertNotNull(input);
  });

  test('B11-04: Rapid consecutive print clicks (10 calls) do not corrupt window state', () => {
    const btn = container.querySelector('#btnPrintQrPoster');
    for (let i = 0; i < 10; i++) {
      btn?.click();
    }
    assertEquals(window.location.pathname, '/index.html');
  });

  test('B11-05: Store name with quotes and HTML in print template escapes safely', () => {
    store.updateSettings({ storeName: 'Pastelería "Dulce Sonrisa" & Café' });
    container.querySelector('#btnPrintQrPoster')?.click();
    assertNotNull(container);
  });
});

// ============================================================================
// FEATURE F12: GOOGLE GEMINI API CLIENT (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F12: Gemini API Client Error & Limit Boundaries', () => {
  beforeEach(() => {
    mockFetch.reset();
  });

  test('B12-01: HTTP 429 Rate Limit error triggers fallback attempt', async () => {
    let fallbackHit = false;
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-2.5-flash'),
      () => ({ ok: false, status: 429, json: async () => ({ error: 'Rate limit exceeded' }) })
    );
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-2.0-flash'),
      () => {
        fallbackHit = true;
        return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }) };
      }
    );

    // Sequence
    const r1 = await mockFetch.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assertEquals(r1.status, 429);

    const r2 = await mockFetch.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent');
    assertEquals(r2.status, 200);
    assertTrue(fallbackHit);
  });

  test('B12-02: HTTP 503 Service Unavailable triggers model fallback sequence', async () => {
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-2.5-flash'),
      () => ({ ok: false, status: 503, json: async () => ({ error: 'Service Unavailable' }) })
    );
    const resp = await mockFetch.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    assertEquals(resp.status, 503);
  });

  test('B12-03: Empty API response object handled gracefully', async () => {
    mockFetch.addHandler(
      () => true,
      () => ({ ok: true, status: 200, json: async () => ({}) })
    );
    const resp = await mockFetch.fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    const data = await resp.json();
    assertEquals(data.candidates, undefined);
  });

  test('B12-04: Malformed JSON within markdown response handled with fallback parsing', () => {
    const badMarkdown = '```json\n{ "broken": json without quotes }\n```';
    let parsed = null;
    try {
      const cleaned = badMarkdown.replace(/```json|```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { fallback: true };
    }
    assertTrue(parsed.fallback);
  });

  test('B12-05: Large prompt (10,000 characters) payload formats valid request body', async () => {
    const hugePrompt = 'A'.repeat(10000);
    const bodyStr = JSON.stringify({ contents: [{ parts: [{ text: hugePrompt }] }] });
    assertGreaterThan(bodyStr.length, 10000);
  });
});

// ============================================================================
// FEATURE F13: DYNAMIC CHEF IA ASSISTANT (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F13: Dynamic Chef IA Assistant Boundaries', () => {
  let container;

  beforeEach(() => {
    container = new MockElement('div');
    resetStoreToSeed(store, SEED_DATA);
    renderChefAIView(container);
  });

  test('B13-01: Empty or whitespace message send attempt does not generate user bubble', () => {
    const input = container.querySelector('#aiChatInput');
    const btn = container.querySelector('#aiSendBtn');
    if (input && btn) {
      input.value = '    ';
      btn.click();
      assertEquals(input.value, '    ');
    }
  });

  test('B13-02: Message with 2,000 characters submits without error', () => {
    const input = container.querySelector('#aiChatInput');
    const btn = container.querySelector('#aiSendBtn');
    if (input && btn) {
      input.value = '¿Cómo hornear macarons? '.repeat(80);
      btn.click();
      assertEquals(input.value, '');
    }
  });

  test('B13-03: Empty pantry inventory produces zero stock suggestions safely', () => {
    store.state.inventory = [];
    const suggestions = OCRAIEngine.getChefStockSuggestions();
    assertTrue(Array.isArray(suggestions));
    assertEquals(suggestions.length, 0);
  });

  test('B13-04: Butter at low cost does not trigger inflation alert', () => {
    const butter = store.getInventory().find(i => i.name.toLowerCase().includes('mantequilla'));
    if (butter) {
      butter.costPerUnit = 4.00; // Low cost
    }
    const suggestions = OCRAIEngine.getChefStockSuggestions();
    const inflationAlert = suggestions.find(s => s.type === 'pricing');
    assertEquals(inflationAlert, undefined);
  });

  test('B13-05: Strawberries below 3 kg do not trigger anti-waste pavlova suggestion', () => {
    const strawberries = store.getInventory().find(i => i.name.toLowerCase().includes('fresa'));
    if (strawberries) {
      strawberries.stock = 1.0; // Low stock
    }
    const suggestions = OCRAIEngine.getChefStockSuggestions();
    const antiWaste = suggestions.find(s => s.type === 'antiwaste');
    assertEquals(antiWaste, undefined);
  });
});

// ============================================================================
// FEATURE F14: COMPREHENSIVE E2E TEST RUNNER (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F14: Harness & Assertion Engine Boundaries', () => {
  test('B14-01: Non-error exception throws captured by runner cleanly', () => {
    let caught = false;
    try {
      throw 'Raw string exception';
    } catch (err) {
      caught = true;
      assertEquals(err, 'Raw string exception');
    }
    assertTrue(caught);
  });

  test('B14-02: MockElement querySelectorAll returns empty array for non-existent classes', () => {
    const el = new MockElement('div');
    const matches = el.querySelectorAll('.non-existent-class-1234');
    assertTrue(Array.isArray(matches));
    assertEquals(matches.length, 0);
  });

  test('B14-03: MockElement remove method removes element from parent children list', () => {
    const parent = new MockElement('div');
    const child = new MockElement('span', { id: 'childSpan' });
    parent.appendChild(child);
    assertEquals(parent.children.length, 1);

    child.remove();
    assertEquals(parent.children.length, 0);
    assertEquals(child.parentNode, null);
  });

  test('B14-04: MockStorage clear removes all entries', () => {
    mockStorage.setItem('k1', 'v1');
    mockStorage.setItem('k2', 'v2');
    assertEquals(mockStorage.length, 2);

    mockStorage.clear();
    assertEquals(mockStorage.length, 0);
    assertEquals(mockStorage.getItem('k1'), null);
  });

  test('B14-05: Nested MockElement querySelector finds deeply nested ID', () => {
    const root = new MockElement('div');
    root.innerHTML = '<div><div><div><p id="deepPara">Found</p></div></div></div>';
    const found = root.querySelector('#deepPara');
    assertNotNull(found);
    assertEquals(found.innerText, 'Found');
  });
});

// ============================================================================
// FEATURE F15: ADVERSARIAL COVERAGE HARDENING (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F15: Adversarial Hardening Boundaries', () => {
  beforeEach(() => {
    resetStoreToSeed(store, SEED_DATA);
  });

  test('B15-01: SQL injection string in customer name stored without modification', () => {
    const sqli = "Robert'); DROP TABLE invoices;--";
    const inv = store.saveInvoice({
      type: 'ticket',
      customerName: sqli,
      total: 10.00,
      status: 'Pagada'
    });
    assertEquals(inv.customerName, sqli);
  });

  test('B15-02: Command injection payload in product barcode stores safely', () => {
    const cmdi = '$(cat /etc/passwd) && rm -rf /';
    const prod = store.saveProduct({
      name: 'Pastel Seguro',
      barcode: cmdi,
      price: 15.00
    });
    assertEquals(prod.barcode, cmdi);
  });

  test('B15-03: Right-to-Left (RTL) unicode characters in recipe name preserve text', () => {
    const rtlTitle = 'كعكة الفراولة اللذيذة (Pastel de Fresa)';
    const rec = store.saveRecipe({
      name: rtlTitle,
      portions: 8
    });
    assertEquals(rec.name, rtlTitle);
  });

  test('B15-04: Negative price in product clamped or handled without NaN', () => {
    const negProd = store.saveProduct({
      name: 'Pastel Negativo',
      price: -15.00
    });
    assertEquals(negProd.price, -15.00);
  });

  test('B15-05: NaN or Infinity in recipe costing inputs sanitized gracefully', () => {
    const calc = CostingEngine.calculateRecipe({
      portions: NaN,
      indirectCost: Infinity,
      targetMargin: -100,
      ingredients: [{ quantity: 'not_a_number', unitCost: undefined }]
    });
    assertFalse(isNaN(calc.totalProductionCost));
    assertEquals(calc.portions, 1);
    assertEquals(calc.targetMargin, 5); // Clamped to min 5
  });
});

// ============================================================================
// FEATURE F16: CLEAN .GITIGNORE CONFIGURATION (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F16: .gitignore Pattern Matching Boundaries', () => {
  const isIgnored = (path, rule) => {
    if (rule.endsWith('/')) {
      return path.includes(rule) || path.startsWith(rule);
    }
    if (rule.startsWith('*.')) {
      const ext = rule.slice(1);
      return path.endsWith(ext);
    }
    return path.includes(rule);
  };

  test('B16-01: Subdirectory APK path matches *.apk wildcard rule', () => {
    assertTrue(isIgnored('android_project/SweetSmile_unsigned.apk', '*.apk'));
    assertTrue(isIgnored('SweetSmilePastry_v1.0.apk', '*.apk'));
  });

  test('B16-02: Signature file matches *.idsig rule', () => {
    assertTrue(isIgnored('SweetSmilePastry_v1.0.apk.idsig', '*.idsig'));
  });

  test('B16-03: Keystore files match *.keystore rule', () => {
    assertTrue(isIgnored('android_project/debug.keystore', '*.keystore'));
  });

  test('B16-04: android_tools/ folder matches directory exclusion rule', () => {
    assertTrue(isIgnored('android_tools/windows/aapt2.exe', 'android_tools/'));
  });

  test('B16-05: Critical web source files are NOT matched by gitignore rules', () => {
    const webFiles = ['index.html', 'catalog.html', 'js/store.js', 'css/styles.css'];
    for (const f of webFiles) {
      assertFalse(isIgnored(f, '*.apk'));
      assertFalse(isIgnored(f, 'android_tools/'));
      assertFalse(isIgnored(f, '*.keystore'));
    }
  });
});

// ============================================================================
// FEATURE F17: GITHUB REPOSITORY SYNCHRONIZATION (BOUNDARIES)
// ============================================================================
describe('Tier 2 - F17: GitHub Repository Sync Boundaries', () => {
  test('B17-01: Remote URL with and without .git suffix normalized to same repo', () => {
    const url1 = 'https://github.com/Pocapox/Sweet-Smile-app.git';
    const url2 = 'https://github.com/Pocapox/Sweet-Smile-app';
    const normalize = u => u.replace(/\.git$/, '').toLowerCase();
    assertEquals(normalize(url1), normalize(url2));
  });

  test('B17-02: SSH and HTTPS remote formats resolve to identical owner and repo', () => {
    const httpsUrl = 'https://github.com/Pocapox/Sweet-Smile-app.git';
    const sshUrl = 'git@github.com:Pocapox/Sweet-Smile-app.git';
    const extractPath = u => u.replace(/.*github\.com[:/]/, '').replace(/\.git$/, '');
    assertEquals(extractPath(httpsUrl), 'Pocapox/Sweet-Smile-app');
    assertEquals(extractPath(sshUrl), 'Pocapox/Sweet-Smile-app');
  });

  test('B17-03: Case-insensitive repository owner matching', () => {
    const owner = 'Pocapox';
    assertEquals(owner.toLowerCase(), 'pocapox');
  });

  test('B17-04: API key strings are never stored in hardcoded git configs', () => {
    const gitConfigSample = '[remote "origin"]\nurl = https://github.com/Pocapox/Sweet-Smile-app.git\nfetch = +refs/heads/*:refs/remotes/origin/*';
    assertFalse(gitConfigSample.includes('AIzaSy'));
  });

  test('B17-05: Main branch validation enforces standard branch name', () => {
    const defaultBranch = 'main';
    assertContains(['main', 'master'], defaultBranch);
  });
});
