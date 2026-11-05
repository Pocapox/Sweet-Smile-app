// tests/test_tier5_adversarial.js - Tier 5: Adversarial Stress Hardening & Fault Injection Suite
import {
  describe, test, beforeEach, afterEach,
  assertEquals, assertNotEquals, assertTrue, assertFalse,
  assertNull, assertNotNull, assertContains, assertGreaterThan,
  assertGreaterThanOrEqual, assertCloseTo, assertThrows, assertRejects,
  mockStorage, mockFetch, MockElement, mockWindow, mockDocument,
  resetGlobalEnv, resetStoreToSeed
} from './harness.js';

import { store } from '../js/store.js';
import { GeminiAPI } from '../js/gemini-api.js';
import { OCRAIEngine } from '../js/ocr-ai.js';
import { CostingEngine } from '../js/costing.js';
import { GoogleSyncManager } from '../js/google-sync.js';
import {
  isIndexedDBAvailable, initDB, saveToIndexedDB, loadFromIndexedDB, deleteFromIndexedDB
} from '../js/db.js';
import { renderChefAIView } from '../js/views/chefAIView.js';
import { renderRecipesView } from '../js/views/recipesView.js';
import { renderPosView } from '../js/views/posView.js';
import { renderCatalogShareView } from '../js/views/catalogShareView.js';
import {
  INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS
} from '../js/models.js';

// DOM property reflection for MockElement (mirror standard HTMLInputElement and HTMLImageElement properties)
if (!Object.getOwnPropertyDescriptor(MockElement.prototype, 'type')) {
  Object.defineProperty(MockElement.prototype, 'type', {
    get() { return this.getAttribute('type') || ''; },
    set(v) { this.setAttribute('type', v); },
    configurable: true
  });
}

if (!Object.getOwnPropertyDescriptor(MockElement.prototype, 'src')) {
  Object.defineProperty(MockElement.prototype, 'src', {
    get() { return this.getAttribute('src') || ''; },
    set(v) { this.setAttribute('src', v); },
    configurable: true
  });
}

if (!Object.getOwnPropertyDescriptor(MockElement.prototype, 'style')) {
  Object.defineProperty(MockElement.prototype, 'style', {
    get() {
      if (!this._style) this._style = {};
      return this._style;
    },
    set(v) { this._style = v; },
    configurable: true
  });
}

// Global prompt fallback in headless test runner
globalThis.prompt = (msg, def) => (mockWindow.prompt ? mockWindow.prompt(msg, def) : def);

const SEED_DATA = { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS };

// ============================================================================
// DOMAIN 1: GOOGLE GEMINI API CLIENT ADVERSARIAL STRESS (T5-01 .. T5-08)
// ============================================================================
describe('Domain 1: Gemini API Resilience & Fallback Cascade', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockFetch.reset();
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
    GeminiAPI.setApiKey('test-valid-gemini-key');
  });

  test('T5-01: Model fallback cascade executes in sequence (2.5-flash 500 -> 2.0-flash 503 -> 1.5-flash 200)', async () => {
    // 2.5 fails with 500
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-2.5-flash'),
      () => ({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Internal Server Error on 2.5' } })
      })
    );

    // 2.0 fails with 503
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-2.0-flash'),
      () => ({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'Service Unavailable on 2.0' } })
      })
    );

    // 1.5 succeeds with 200
    mockFetch.addHandler(
      (url) => String(url).includes('gemini-1.5-flash'),
      () => ({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: 'Response from gemini-1.5-flash fallback' }] } }
          ]
        })
      })
    );

    const result = await GeminiAPI.generateContent({
      contents: [{ role: 'user', parts: [{ text: 'Hello AI' }] }]
    });

    assertEquals(result.modelUsed, 'gemini-1.5-flash', 'Should cascade down to gemini-1.5-flash');
    assertEquals(result.text, 'Response from gemini-1.5-flash fallback');
  });

  test('T5-02: Total cascade failure throws aggregated descriptive error when all 3 models fail', async () => {
    mockFetch.addHandler(
      () => true,
      (url) => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Resource Exhausted / Quota Exceeded' } })
      })
    );

    await assertRejects(
      () => GeminiAPI.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Stress prompt' }] }]
      }),
      /Quota Exceeded|Resource Exhausted|No se pudo obtener respuesta/
    );
  });

  test('T5-03: Missing or whitespace API key rejects without network request', async () => {
    GeminiAPI.setApiKey('');
    delete mockWindow.GEMINI_API_KEY;
    store.updateSettings({ geminiApiKey: '' });
    mockStorage.removeItem('sweet_smile_gemini_key');

    assertFalse(GeminiAPI.hasApiKey());

    let networkCalled = false;
    mockFetch.addHandler(() => true, () => {
      networkCalled = true;
      return { ok: true, status: 200, json: async () => ({}) };
    });

    await assertRejects(
      () => GeminiAPI.generateContent({ contents: [] }),
      /Clave de Google Gemini no configurada/
    );

    assertFalse(networkCalled, 'No network requests should be dispatched when API key is missing');
  });

  test('T5-04: Markdown code fence stripping handles ```json, ```, and trailing whitespace', () => {
    const raw = '```json\n{\n  "recipe": "Brownie Artesanal",\n  "portions": 12\n}\n```  ';
    const parsed = GeminiAPI.cleanAndParseJson(raw);
    assertEquals(parsed.recipe, 'Brownie Artesanal');
    assertEquals(parsed.portions, 12);

    const rawGeneric = '```\n{\n  "status": "ok"\n}\n```';
    const parsedGeneric = GeminiAPI.cleanAndParseJson(rawGeneric);
    assertEquals(parsedGeneric.status, 'ok');
  });

  test('T5-05: Conversational prefix and suffix text surrounding JSON are stripped to outer braces', () => {
    const raw = '¡Hola! Aquí tienes la receta estructurada:\n\n{\n  "name": "Tarta de Limón",\n  "difficulty": "Fácil"\n}\n\n¡Espero que sea de gran utilidad para Sweet Smile!';
    const parsed = GeminiAPI.cleanAndParseJson(raw);
    assertEquals(parsed.name, 'Tarta de Limón');
    assertEquals(parsed.difficulty, 'Fácil');
  });

  test('T5-06: Malformed / incomplete JSON throws user-friendly Spanish error instead of unhandled crash', () => {
    assertThrows(
      () => GeminiAPI.cleanAndParseJson('{ "incomplete": true, "name": '),
      /No se pudo interpretar el formato JSON/
    );

    assertThrows(
      () => GeminiAPI.cleanAndParseJson(''),
      /Respuesta vacía recibida/
    );

    assertThrows(
      () => GeminiAPI.cleanAndParseJson(null),
      /Respuesta vacía recibida/
    );
  });

  test('T5-07: Offline state (navigator.onLine = false) throws offline notification error', async () => {
    mockWindow.navigator.onLine = false;

    mockFetch.addHandler(() => true, () => {
      throw new Error('Network failure');
    });

    await assertRejects(
      () => GeminiAPI.generateContent({ contents: [] }),
      /Sin conexión a internet/
    );
  });

  test('T5-08: Network fetch rejection (TypeError: Failed to fetch) is caught gracefully', async () => {
    mockWindow.navigator.onLine = true;

    mockFetch.addHandler(() => true, () => {
      throw new TypeError('Failed to fetch');
    });

    await assertRejects(
      () => GeminiAPI.generateContent({ contents: [] }),
      /Failed to fetch/
    );
  });
});

// ============================================================================
// DOMAIN 2: OCR & SOCIAL MEDIA RECIPE ADVERSARIAL STRESS (T5-09 .. T5-14)
// ============================================================================
describe('Domain 2: Recipe OCR & Social Video Importer Robustness', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockFetch.reset();
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
  });

  test('T5-09: extractRecipeFromPhoto(null) and extractRecipeFromPhoto("") return resilient fallback without crashing', async () => {
    const rNull = await OCRAIEngine.extractRecipeFromPhoto(null);
    assertNotNull(rNull);
    assertNotNull(rNull.name);
    assertTrue(rNull.ingredients.length >= 4);
    assertGreaterThanOrEqual(rNull.portions, 1);

    const rEmpty = await OCRAIEngine.extractRecipeFromPhoto('');
    assertNotNull(rEmpty);
    assertNotNull(rEmpty.name);
    assertTrue(rEmpty.instructions.length >= 3);
  });

  test('T5-10: Corrupt base64 data string recovers to safe draft without unhandled exceptions', async () => {
    const corruptBase64 = 'data:image/jpeg;base64,CORRUPT_GARBAGE_PAYLOAD_!@#$%^&*()_+~`';
    const result = await OCRAIEngine.extractRecipeFromPhoto(corruptBase64);

    assertNotNull(result);
    assertNotNull(result.name);
    assertGreaterThan(result.targetMargin, 0);
    assertTrue(Array.isArray(result.ingredients));
  });

  test('T5-11: Unknown social platforms (Threads, Twitter, Pinterest) fall back to "Video Social" platform', async () => {
    const rThreads = await OCRAIEngine.importFromSocialUrl('https://www.threads.net/@pastrychef/post/123456');
    assertEquals(rThreads.platform, 'Video Social');
    assertNotNull(rThreads.name);
    assertTrue(rThreads.ingredients.length > 0);

    const rPinterest = await OCRAIEngine.importFromSocialUrl('https://pinterest.com/pin/987654321');
    assertEquals(rPinterest.platform, 'Video Social');
    assertNotNull(rPinterest.name);
  });

  test('T5-12: Social video URL with missing protocol or raw domains parses cleanly', async () => {
    const rNoProto = await OCRAIEngine.importFromSocialUrl('tiktok.com/@sweetbaker/video/777');
    assertEquals(rNoProto.platform, 'TikTok');
    assertNotNull(rNoProto.name);

    const rIg = await OCRAIEngine.importFromSocialUrl('instagram.com/reel/abc123xyz');
    assertEquals(rIg.platform, 'Instagram Reel');
    assertNotNull(rIg.name);
  });

  test('T5-13: _normalizeRecipeDraft with zero portions, negative margins, and missing ingredients auto-remedies', () => {
    const crazyPayload = {
      name: '',
      portions: 0,
      targetMargin: -50,
      indirectCost: -10,
      ingredients: [],
      instructions: null
    };

    const normalized = OCRAIEngine._normalizeRecipeDraft(crazyPayload);
    assertEquals(normalized.name, 'Creación Pastelera');
    assertGreaterThanOrEqual(normalized.portions, 1, 'Portions must be clamped to at least 1');
    assertEquals(normalized.portions, 8, 'Falsy portion falls back to 8 portions');
    assertEquals(normalized.targetMargin, 5, 'Target margin must be clamped to min 5%');
    assertEquals(normalized.indirectCost, 0, 'Negative indirect cost must be clamped to 0');
    assertTrue(normalized.ingredients.length >= 4, 'Empty ingredients should receive pastry baseline');
    assertTrue(normalized.instructions.length >= 3, 'Empty instructions should receive 3 standard steps');
  });

  test('T5-14: getChefStockSuggestions returns array without throwing on empty inventory', () => {
    store.state.inventory = [];
    const suggestions = OCRAIEngine.getChefStockSuggestions();
    assertTrue(Array.isArray(suggestions));
    assertEquals(suggestions.length, 0);
  });
});

// ============================================================================
// DOMAIN 3: CHEF AI VIEW & ADVERSARIAL CHAT INJECTION (T5-15 .. T5-19)
// ============================================================================
describe('Domain 3: Chef IA View & Input Sanitation', () => {
  let container;

  beforeEach(() => {
    mockStorage.clear();
    mockFetch.reset();
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
    container = new MockElement('div');
    renderChefAIView(container);
  });

  test('T5-15: Empty or whitespace-only chat input does not trigger API or create empty chat bubble', () => {
    const input = container.querySelector('#aiChatInput');
    const sendBtn = container.querySelector('#aiSendBtn');
    const initialCount = container.querySelectorAll('#aiChatMessages > div').length;

    input.value = '   ';
    sendBtn.dispatchEvent('click');

    const postCount = container.querySelectorAll('#aiChatMessages > div').length;
    assertEquals(postCount, initialCount, 'No message should be appended for whitespace-only query');
  });

  test('T5-16: Chat message preserves special characters and safely appends user message', () => {
    const input = container.querySelector('#aiChatInput');
    const sendBtn = container.querySelector('#aiSendBtn');

    input.value = 'Receta <Especial> & Dulce "Caramelo"';
    sendBtn.dispatchEvent('click');

    const html = container.innerHTML;
    assertContains(html, 'Receta');
    assertContains(html, 'Dulce');
  });

  test('T5-17: Rapid double submission handles queueing without crashing or losing history', () => {
    const input = container.querySelector('#aiChatInput');
    const sendBtn = container.querySelector('#aiSendBtn');

    input.value = 'Consulta Rápida 1: Mermas';
    sendBtn.dispatchEvent('click');

    input.value = 'Consulta Rápida 2: Sustitutos';
    sendBtn.dispatchEvent('click');

    const html = container.innerHTML;
    assertContains(html, 'Consulta Rápida 1');
    assertContains(html, 'Consulta Rápida 2');
  });

  test('T5-18: Chat message with multi-byte unicode emojis and culinary symbols processes correctly', () => {
    const input = container.querySelector('#aiChatInput');
    const sendBtn = container.querySelector('#aiSendBtn');

    input.value = '🍰🥐🧑‍🍳 ¿Cómo optimizo la emulsión de mantequilla? 🍓✨';
    sendBtn.dispatchEvent('click');

    const html = container.innerHTML;
    assertContains(html, '🍰🥐🧑‍🍳');
  });

  test('T5-19: Gemini API key configuration modal can open, toggle visibility, and close with clean state', () => {
    const configBtn = container.querySelector('#btnConfigureGeminiKey');
    const keyModal = container.querySelector('#geminiKeyModal');

    assertTrue(keyModal.classList.contains('hidden'));

    configBtn.dispatchEvent('click');
    assertFalse(keyModal.classList.contains('hidden'), 'Modal should be visible after clicking configure');

    const keyInput = container.querySelector('#geminiApiKeyInput');
    const eyeBtn = container.querySelector('#btnToggleKeyVisibility');

    assertEquals(keyInput.type, 'password');
    eyeBtn.dispatchEvent('click');
    assertEquals(keyInput.type, 'text');
    eyeBtn.dispatchEvent('click');
    assertEquals(keyInput.type, 'password');

    const closeBtn = container.querySelector('#btnCloseGeminiModal');
    closeBtn.dispatchEvent('click');
    assertTrue(keyModal.classList.contains('hidden'), 'Modal should close on clicking close button');
  });
});

// ============================================================================
// DOMAIN 4: RECIPES VIEW & COSTING ENGINE HARDENING (T5-20 .. T5-24)
// ============================================================================
describe('Domain 4: Recipes View & Costing Engine Hardening', () => {
  let container;

  beforeEach(() => {
    mockStorage.clear();
    mockFetch.reset();
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
    container = new MockElement('div');
    renderRecipesView(container);
  });

  test('T5-20: Camera drop area click triggers hidden file picker; empty file selection handled safely', () => {
    const ocrBtn = container.querySelector('#btnOcrPhoto');
    ocrBtn.dispatchEvent('click');

    const ocrModal = container.querySelector('#ocrModal');
    assertFalse(ocrModal.classList.contains('hidden'));

    const dropArea = container.querySelector('#ocrDropArea');
    const fileInput = container.querySelector('#ocrFileInput');

    let clickTriggered = false;
    fileInput.click = () => { clickTriggered = true; };

    dropArea.dispatchEvent('click');
    assertTrue(clickTriggered, 'Clicking drop area should trigger camera file input');

    // Empty file selection event
    fileInput.dispatchEvent({ type: 'change', target: { files: [] } });
    assertFalse(ocrModal.classList.contains('hidden'), 'Empty file selection should keep dialog available');
  });

  test('T5-21: Drag-and-drop events on OCR drop area (dragover, dragleave, drop) execute without exception', () => {
    const dropArea = container.querySelector('#ocrDropArea');

    dropArea.dispatchEvent({ type: 'dragover', preventDefault: () => {} });
    assertTrue(dropArea.classList.contains('bg-surface-container'));

    dropArea.dispatchEvent({ type: 'dragleave', preventDefault: () => {} });
    assertFalse(dropArea.classList.contains('bg-surface-container'));

    dropArea.dispatchEvent({ type: 'drop', preventDefault: () => {}, dataTransfer: { files: [] } });
    assertFalse(dropArea.classList.contains('bg-surface-container'));
  });

  test('T5-22: Profit margin slider at extreme boundaries (15% and 85%) maintains non-negative finite PVP', () => {
    const recipe = store.getRecipes()[0];

    const lowMargin = CostingEngine.calculateRecipe(recipe, 15);
    assertEquals(lowMargin.targetMargin, 15);
    assertGreaterThan(lowMargin.suggestedPrice, lowMargin.totalProductionCost);
    assertTrue(Number.isFinite(lowMargin.suggestedPrice));

    const highMargin = CostingEngine.calculateRecipe(recipe, 85);
    assertEquals(highMargin.targetMargin, 85);
    assertGreaterThan(highMargin.suggestedPrice, lowMargin.suggestedPrice);
    assertTrue(Number.isFinite(highMargin.suggestedPrice));
  });

  test('T5-23: Adding ingredient via prompt handles cancel and valid additions safely', () => {
    const addBtn = container.querySelector('#btnAddIngredientRow');

    // Cancel prompt
    mockWindow.prompt = () => null;
    addBtn.dispatchEvent('click');

    const recBefore = store.getRecipe('rec-042');
    const initialIngCount = recBefore.ingredients.length;

    // Valid addition
    mockWindow.prompt = (msg) => {
      if (msg.includes('Nombre')) return 'Nueces de Brasil';
      if (msg.includes('Cantidad')) return '0.15';
      if (msg.includes('Unidad')) return 'kg';
      if (msg.includes('Costo')) return '14.00';
      return '';
    };

    addBtn.dispatchEvent('click');
    const recAfter = store.getRecipe('rec-042');
    assertEquals(recAfter.ingredients.length, initialIngCount + 1);
    assertTrue(recAfter.ingredients.some(i => i.name === 'Nueces de Brasil'));
  });

  test('T5-24: Recipe with 0 ingredients produces valid costing (only indirect cost remains)', () => {
    const bareRecipe = {
      id: 'rec-bare',
      name: 'Masa Experimental',
      category: 'Masas',
      portions: 4,
      indirectCost: 3.50,
      targetMargin: 50,
      ingredients: []
    };

    const calc = CostingEngine.calculateRecipe(bareRecipe);
    assertEquals(calc.directIngredientsCost, 0);
    assertEquals(calc.indirectCost, 3.50);
    assertEquals(calc.totalProductionCost, 3.50);
    assertEquals(calc.unitCost, 0.88);
    assertEquals(calc.suggestedPrice, 7.00);
    assertEquals(calc.grossProfit, 3.50);
  });
});

// ============================================================================
// DOMAIN 5: POS RAPID CHECKOUT, ZERO STOCK & MULTI-RECIPE IMPACT (T5-25 .. T5-30)
// ============================================================================
describe('Domain 5: POS Concurrency, Zero Stock & Inventory Deduction Invariants', () => {
  beforeEach(() => {
    mockStorage.clear();
    mockFetch.reset();
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
  });

  test('T5-25: High-speed burst checkout (20 sequential sales) executes cleanly with distinct invoice records', () => {
    const initialInvoices = store.getInvoices().length;

    for (let i = 0; i < 20; i++) {
      store.saveInvoice({
        type: i % 2 === 0 ? 'ticket' : 'factura',
        customerName: `Cliente Concurrente ${i}`,
        customerDoc: `DOC-${i}`,
        items: [
          { productId: 'p1', name: 'Pastel Red Velvet', quantity: 1, price: 25.00, total: 25.00 }
        ],
        subtotal: 25.00,
        discountPercent: 0,
        discountAmount: 0,
        tip: 0,
        total: 25.00,
        paymentMethod: 'Efectivo',
        status: 'Pagada'
      });
    }

    const invoices = store.getInvoices();
    assertEquals(invoices.length, initialInvoices + 20);

    const ids = new Set(invoices.map(inv => inv.id));
    assertEquals(ids.size, invoices.length, 'Every invoice must possess a unique ID');
  });

  test('T5-26: Selling items when product stock is 0 clamps stock to 0 (never negative)', () => {
    const prod = store.getProduct('p1');
    prod.stock = 2;
    store.saveProduct(prod);

    // Sell 10 units
    store.saveInvoice({
      items: [
        { productId: 'p1', name: prod.name, quantity: 10, price: 25.00, total: 250.00 }
      ],
      total: 250.00
    });

    const updatedProd = store.getProduct('p1');
    assertEquals(updatedProd.stock, 0, 'Stock must not drop below 0');
  });

  test('T5-27: Raw inventory deductions when pantry stock is below required recipe quantity clamps stock at 0 and sets critical status', () => {
    // Find butter inventory item
    const butter = store.getInventory().find(i => i.name.toLowerCase().includes('mantequilla'));
    assertNotNull(butter);

    butter.stock = 0.05; // Less than required for red velvet recipe
    butter.minStock = 2.0;
    store.saveInventoryItem(butter);

    // Save sale of Red Velvet
    store.saveInvoice({
      items: [
        { productId: 'p1', name: 'Pastel Red Velvet', quantity: 2, price: 25.00, total: 50.00 }
      ],
      total: 50.00
    });

    const updatedButter = store.findMatchingInventoryItem(butter.id);
    assertEquals(updatedButter.stock, 0, 'Inventory stock should clamp at 0');
    assertEquals(updatedButter.status, 'critical', 'Zero stock must trigger critical alert status');
  });

  test('T5-28: Substantive token matching prevents "Queso crema" from deducting "Crema de leche"', () => {
    // Ensure both items are in inventory to test token discrimination
    store.saveInventoryItem({
      id: 'inv-test-crema',
      name: 'Crema de Leche Fresca 35% MG',
      stock: 10,
      unit: 'L',
      costPerUnit: 4.80
    });

    const matchQueso = store.findMatchingInventoryItem('Queso crema para glaseado');
    assertNotNull(matchQueso);
    assertContains(matchQueso.name.toLowerCase(), 'queso');
    assertNotEquals(matchQueso.id, 'inv-test-crema', 'Queso crema must not match Crema de Leche');

    const matchCrema = store.findMatchingInventoryItem('Crema de leche para batir');
    assertNotNull(matchCrema);
    assertEquals(matchCrema.id, 'inv-test-crema', 'Crema de leche must match inv-test-crema');
    assertFalse(matchCrema.name.toLowerCase().includes('queso'));
  });

  test('T5-29: Multi-item sales with common culinary stop words ("de", "en", "con") accurately discriminate targets', () => {
    const matchHarina = store.findMatchingInventoryItem('Harina de Trigo Especial para Repostería');
    assertNotNull(matchHarina);
    assertContains(matchHarina.name.toLowerCase(), 'harina');

    const matchHuevos = store.findMatchingInventoryItem('Huevos de Campo Seleccionados');
    assertNotNull(matchHuevos);
    assertContains(matchHuevos.name.toLowerCase(), 'huevo');
  });

  test('T5-30: POS cart with 100% discount produces total of 0 without NaN or negative values', () => {
    const inv = store.saveInvoice({
      items: [
        { productId: 'p1', name: 'Pastel Red Velvet', quantity: 1, price: 25.00, total: 25.00 }
      ],
      subtotal: 25.00,
      discountPercent: 100,
      discountAmount: 25.00,
      tip: 0,
      total: 0
    });

    assertEquals(inv.total, 0);
    assertFalse(Number.isNaN(inv.total));
    assertGreaterThanOrEqual(inv.total, 0);
  });
});

// ============================================================================
// DOMAIN 6: GOOGLE SYNC OFFLINE QUEUE REPLAY & CONFLICT RESOLUTION (T5-31 .. T5-36)
// ============================================================================
describe('Domain 6: Google Sync Offline Mutation Queue & Conflict Resolution', () => {
  let sync;

  beforeEach(() => {
    mockStorage.clear();
    mockFetch.reset();
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
    sync = new GoogleSyncManager(store);
  });

  test('T5-31: Enqueuing mutations while offline marks status as "offline" and queues them in storage', () => {
    sync.isOnline = false;

    const mut = sync.queueMutation({
      entity: 'invoices',
      action: 'create',
      item: { id: 'TIK-OFFLINE-01', total: 45.00 }
    });

    assertEquals(sync.status, 'offline');
    assertEquals(sync.getPendingCount(), 1);
    assertNotNull(mut.id);

    const storedQueue = sync.loadQueueFromStorage();
    assertEquals(storedQueue.length, 1);
    assertEquals(storedQueue[0].item.id, 'TIK-OFFLINE-01');
  });

  test('T5-32: Network restoration triggers auto-sync and flushes queue to "synced"', async () => {
    sync.isOnline = false;
    sync.queueMutation({ entity: 'products', action: 'update', item: { id: 'p1', price: 30 } });

    assertEquals(sync.getPendingCount(), 1);

    // Restore network
    sync.isOnline = true;
    const result = await sync.syncNow();

    assertTrue(result.success);
    assertEquals(sync.status, 'synced');
    assertEquals(sync.getPendingCount(), 0);
  });

  test('T5-33: LWW conflict resolution resolves newer remote timestamp over older local timestamp', () => {
    const localProducts = [
      { id: 'p1', name: 'Pastel Local', updatedAt: '2026-11-05T01:00:00Z', price: 25 }
    ];
    const remoteProducts = [
      { id: 'p1', name: 'Pastel Remoto Ganador', updatedAt: '2026-11-05T02:00:00Z', price: 32 }
    ];

    const merged = sync.resolveCollectionLWW(localProducts, remoteProducts);
    assertEquals(merged.length, 1);
    assertEquals(merged[0].name, 'Pastel Remoto Ganador');
    assertEquals(merged[0].price, 32);
  });

  test('T5-34: LWW conflict resolution resolves newer local timestamp over older remote timestamp', () => {
    const localProducts = [
      { id: 'p1', name: 'Pastel Local Ganador', updatedAt: '2026-11-05T04:00:00Z', price: 29 }
    ];
    const remoteProducts = [
      { id: 'p1', name: 'Pastel Remoto Antiguo', updatedAt: '2026-11-05T02:00:00Z', price: 26 }
    ];

    const merged = sync.resolveCollectionLWW(localProducts, remoteProducts);
    assertEquals(merged.length, 1);
    assertEquals(merged[0].name, 'Pastel Local Ganador');
    assertEquals(merged[0].price, 29);
  });

  test('T5-35: LWW handles items with missing or corrupt timestamps by falling back to 0', () => {
    const localItem = [{ id: 'item-1', name: 'Local with date', updatedAt: '2026-11-05T01:00:00Z' }];
    const remoteItem = [{ id: 'item-1', name: 'Remote no date' }];

    const merged = sync.resolveCollectionLWW(localItem, remoteItem);
    assertEquals(merged[0].name, 'Local with date', 'Item with valid timestamp should beat item with no timestamp');
  });

  test('T5-36: IndexedDB open failure falls back gracefully to localStorage without unhandled rejection', async () => {
    const origIdb = globalThis.indexedDB;
    globalThis.indexedDB = null;

    assertFalse(isIndexedDBAvailable());

    const saveResult = await saveToIndexedDB('test_key', { test: true });
    assertFalse(saveResult, 'Saving should resolve false without throwing');

    const loadResult = await loadFromIndexedDB('test_key');
    assertNull(loadResult, 'Loading should resolve null without throwing');

    globalThis.indexedDB = origIdb;
  });
});

// ============================================================================
// DOMAIN 7: CATALOG SHARE VIEW & QR MODAL CYCLE STRESS (T5-37 .. T5-40)
// ============================================================================
describe('Domain 7: QR Modal Dialog Cycle & Navigation Non-Blocking Stress', () => {
  let container;

  beforeEach(() => {
    mockStorage.clear();
    mockFetch.reset();
    resetGlobalEnv();
    resetStoreToSeed(store, SEED_DATA);
    container = new MockElement('div');
    renderCatalogShareView(container);
  });

  test('T5-37: Rapid modal open/close cycles through close button, cancel button, and backdrop click', () => {
    const modal = container.querySelector('#qrPosterModal');
    const openBtn = container.querySelector('#btnPrintQrPoster');
    const closeBtn = container.querySelector('#closeQrPosterModal');
    const cancelBtn = container.querySelector('#btnCancelQrPoster');

    assertTrue(modal.classList.contains('hidden'));

    // Cycle 1: Open and close with (X)
    openBtn.dispatchEvent('click');
    assertFalse(modal.classList.contains('hidden'));
    closeBtn.dispatchEvent('click');
    assertTrue(modal.classList.contains('hidden'));

    // Cycle 2: Open and close with Cancel button
    openBtn.dispatchEvent('click');
    assertFalse(modal.classList.contains('hidden'));
    cancelBtn.dispatchEvent('click');
    assertTrue(modal.classList.contains('hidden'));

    // Cycle 3: Open and close with backdrop click
    openBtn.dispatchEvent('click');
    assertFalse(modal.classList.contains('hidden'));
    modal.dispatchEvent({ type: 'click', target: modal });
    assertTrue(modal.classList.contains('hidden'));
  });

  test('T5-38: Escape key dismisses QR poster modal safely without affecting document listeners', () => {
    const modal = container.querySelector('#qrPosterModal');
    const openBtn = container.querySelector('#btnPrintQrPoster');

    openBtn.dispatchEvent('click');
    assertFalse(modal.classList.contains('hidden'));

    // Mount to document mock so querySelector('#qrPosterModal') finds it
    mockDocument.body.appendChild(modal);

    mockWindow.__qrPosterEscapeHandler({ key: 'Escape' });
    assertTrue(modal.classList.contains('hidden'), 'Modal should close on Escape key');
  });

  test('T5-39: QR poster print trigger executes without throwing or losing current navigation route', () => {
    const openBtn = container.querySelector('#btnPrintQrPoster');
    openBtn.dispatchEvent('click');

    const executePrint = container.querySelector('#btnExecutePrintPoster');
    assertNotNull(executePrint);

    executePrint.dispatchEvent('click');
    assertTrue(mockWindow._printCalled || mockDocument.getElementById('qrPrintFrame') !== null);
  });

  test('T5-40: Modifying catalog URL dynamically regenerates valid QR code image URL', () => {
    const urlInput = container.querySelector('#cfgCatalogUrl');
    const qrImg = container.querySelector('#qrImageElement');
    const oldSrc = qrImg.src;

    urlInput.dispatchEvent({
      type: 'input',
      target: { value: 'https://pocapox.github.io/Sweet-Smile-app/catalog.html' }
    });

    assertNotEquals(qrImg.src, oldSrc);
    assertContains(qrImg.src, 'api.qrserver.com');
    assertContains(qrImg.src, encodeURIComponent('https://pocapox.github.io/Sweet-Smile-app/catalog.html'));
  });
});

// Self-executing runner if executed directly: node tests/test_tier5_adversarial.js
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('test_tier5_adversarial.js')) {
  console.log('Running Tier 5 Adversarial Test Suite directly...');
  const { collector } = await import('./harness.js');
  let passed = 0;
  let failed = 0;

  for (const suite of collector.suites) {
    console.log(`\n▶ Suite: ${suite.name}`);
    for (const testItem of suite.tests) {
      resetGlobalEnv();
      for (const bh of suite.beforeEachHooks) await bh();
      try {
        await testItem.fn();
        passed++;
        console.log(`  ✓ [PASS] ${testItem.name}`);
      } catch (err) {
        failed++;
        console.error(`  ✗ [FAIL] ${testItem.name}:`, err.message);
      }
      for (const ah of suite.afterEachHooks) await ah();
    }
  }

  console.log(`\n==============================================================`);
  console.log(`Tier 5 Results: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
  console.log(`==============================================================`);
  process.exit(failed > 0 ? 1 : 0);
}
