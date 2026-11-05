// tests/challenge_m2_empirics.js
// EMPIRICAL CHALLENGE HARNESS: Milestone M2 (Requirement R2 / Features F3, F4, F5)
// Deep adversarial testing of POS UI components, execution of executeConfirmSale,
// inventory deduction multi-tier robustness, and Dashboard KPI recalculations.

import assert from 'node:assert';

// ---------------------------------------------------------------------------
// 1. High-Fidelity Mock DOM & Browser Environment
// ---------------------------------------------------------------------------
class MockStyle {
  constructor() {
    this._props = {};
  }
  setProperty(k, v) { this._props[k] = v; }
  getPropertyValue(k) { return this._props[k] || ''; }
  get display() { return this._props.display || ''; }
  set display(v) { this._props.display = v; }
}

class MockDOMElement {
  constructor(tagName = 'div', attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || '';
    this.children = [];
    this.parentNode = null;
    this.listeners = {};
    this.style = new MockStyle();
    this._classList = new Set();
    this._value = attrs.value || '';
    this._innerText = '';
    this._innerHTML = '';

    if (attrs.class) {
      attrs.class.split(/\s+/).filter(Boolean).forEach(c => this._classList.add(c));
    }
  }

  get innerText() {
    if (this._innerText) return this._innerText;
    if (this.children.length > 0) {
      return this.children.map(c => c.innerText || '').join(' ').trim();
    }
    return '';
  }

  set innerText(v) {
    this._innerText = String(v ?? '');
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = String(v ?? '');
    this.attributes.value = this._value;
  }

  get classList() {
    const self = this;
    return {
      contains: (c) => self._classList.has(c),
      add: (...classes) => classes.forEach(c => c && self._classList.add(c)),
      remove: (...classes) => classes.forEach(c => self._classList.delete(c)),
      toggle: (c) => {
        if (self._classList.has(c)) { self._classList.delete(c); return false; }
        self._classList.add(c); return true;
      },
      toString: () => Array.from(self._classList).join(' ')
    };
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.classList.toString();
    if (name === 'value') return this.value;
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'id') this.id = String(val);
    if (name === 'value') this._value = String(val);
    if (name === 'class') {
      this._classList.clear();
      String(val).split(/\s+/).filter(Boolean).forEach(c => this._classList.add(c));
    }
  }

  appendChild(child) {
    if (child) {
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  removeEventListener(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }
  }

  dispatchEvent(evt) {
    const eventObj = typeof evt === 'string' ? { type: evt, target: this, stopPropagation() {} } : evt;
    if (!eventObj.target) eventObj.target = this;
    const list = this.listeners[eventObj.type] || [];
    for (const fn of list) {
      fn(eventObj);
    }
    if (this.parentNode && !eventObj._stopped) {
      this.parentNode.dispatchEvent(eventObj);
    }
    return true;
  }

  click() {
    const evt = { type: 'click', target: this, stopPropagation() { this._stopped = true; } };
    this.dispatchEvent(evt);
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const results = [];
    const match = (node) => {
      if (sel.startsWith('#')) return node.id === sel.slice(1);
      if (sel.startsWith('.')) {
        const classes = sel.slice(1).split('.');
        return classes.every(c => node.classList.contains(c));
      }
      if (sel.includes('[') && sel.endsWith(']')) {
        const [k, v] = sel.slice(1, -1).split('=');
        return v ? node.getAttribute(k) === v.replace(/["']/g, '') : node.getAttribute(k) !== null;
      }
      return node.tagName.toLowerCase() === sel.toLowerCase();
    };

    const walk = (node) => {
      for (const ch of node.children) {
        if (match(ch)) results.push(ch);
        walk(ch);
      }
    };
    walk(this);
    return results;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    this._parseHtml(html);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  _parseHtml(html) {
    if (!html) return;
    const tagRegex = /<([a-zA-Z0-9\-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9\-]+)([^>]*?)\/?>/g;
    let m;
    while ((m = tagRegex.exec(html)) !== null) {
      const tagName = m[1] || m[4];
      const rawAttrs = m[2] || m[5] || '';
      const inner = m[3] || '';

      const attrs = {};
      const attrRegex = /([a-zA-Z0-9\-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let am;
      while ((am = attrRegex.exec(rawAttrs)) !== null) {
        attrs[am[1]] = am[2] ?? am[3] ?? am[4] ?? '';
      }

      const child = new MockDOMElement(tagName, attrs);
      if (tagName.toLowerCase() === 'input' && attrs.value !== undefined) {
        child.value = attrs.value;
      } else if (tagName.toLowerCase() === 'select') {
        // Find default selected option or first option
        const optMatch = /<option[^>]*value=["']([^"']*)["'][^>]*selected/i.exec(inner) ||
                         /<option[^>]*value=["']([^"']*)["']/i.exec(inner);
        if (optMatch) child.value = optMatch[1];
      }

      if (inner.includes('<')) {
        child.innerHTML = inner;
      } else {
        child.innerText = inner.trim();
      }
      this.appendChild(child);
    }
  }
}

// Global browser mocks
const mockWindow = {
  alertCalls: [],
  alert(msg) { this.alertCalls.push(msg); },
  confirm() { return true; },
  scrollTo() {},
  listeners: {},
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  },
  removeEventListener(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }
  },
  open() {
    return {
      document: { open() {}, write() {}, close() {} },
      close() {}
    };
  }
};

globalThis.window = mockWindow;

// ---------------------------------------------------------------------------
// 2. Test Execution Harness
// ---------------------------------------------------------------------------
let passedCount = 0;
let failedCount = 0;
const testFailures = [];

function runTest(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(`    ${err.message}`);
    failedCount++;
    testFailures.push({ name, error: err });
  }
}

// Dynamic Imports
const { store } = await import('../js/store.js');
const { renderPosView } = await import('../js/views/posView.js');
const { renderDashboardView } = await import('../js/views/dashboardView.js');

console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
console.log('\x1b[1m\x1b[36m   🧁 EMPIRICAL CHALLENGE SUITE: MILESTONE M2 (POS & INVENTORY)      \x1b[0m');
console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m\n');

// Import models baseline before any store mutations
import { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS } from '../js/models.js';

const BASELINE_PRODUCTS = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
const BASELINE_INVENTORY = JSON.parse(JSON.stringify(INITIAL_INVENTORY));
const BASELINE_RECIPES = JSON.parse(JSON.stringify(INITIAL_RECIPES));
const BASELINE_INVOICES = JSON.parse(JSON.stringify(INITIAL_INVOICES));
const BASELINE_SETTINGS = JSON.parse(JSON.stringify(INITIAL_SETTINGS));

// Helper to reset store state cleanly before test modules
function resetFreshStore() {
  store.cart = [];
  store.state = {
    products: JSON.parse(JSON.stringify(BASELINE_PRODUCTS)),
    inventory: JSON.parse(JSON.stringify(BASELINE_INVENTORY)),
    recipes: JSON.parse(JSON.stringify(BASELINE_RECIPES)),
    invoices: JSON.parse(JSON.stringify(BASELINE_INVOICES)),
    settings: JSON.parse(JSON.stringify(BASELINE_SETTINGS)),
    isOnline: true,
    cloudSyncStatus: "synced"
  };
}

// ===========================================================================
// MODULE 1: POS UI Visibility & Accessibility (Mobile & Desktop Viewports)
// ===========================================================================
console.log('\x1b[1m▶ MODULE 1: POS UI Visibility & Accessibility Across Viewports\x1b[0m');

runTest('1.1 Cart empty state: Sticky cart bar #btnSaveSaleBar is absent', () => {
  resetFreshStore();
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const saveBtn = container.querySelector('#btnSaveSaleBar');
  assert.strictEqual(saveBtn, null, 'Sticky save sale button must NOT render when cart is empty');
});

runTest('1.2 Cart with items: Sticky cart bar #btnSaveSaleBar renders', () => {
  resetFreshStore();
  store.addToCart('p1', 1);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const saveBtn = container.querySelector('#btnSaveSaleBar');
  assert.notStrictEqual(saveBtn, null, 'Sticky save sale button MUST render when cart has items');
});

runTest('1.3 Sticky button #btnSaveSaleBar text, icon, and title attribute', () => {
  resetFreshStore();
  store.addToCart('p1', 1);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const saveBtn = container.querySelector('#btnSaveSaleBar');
  assert.ok(saveBtn.innerText.includes('Guardar Venta'), 'Button text must include "Guardar Venta"');
  assert.strictEqual(saveBtn.getAttribute('title'), 'Guardar Venta', 'Button must have title="Guardar Venta"');
  
  const icon = saveBtn.querySelector('span.material-symbols-outlined') || saveBtn.children[0];
  assert.ok(icon && (icon.innerText.includes('check_circle') || saveBtn.innerHTML.includes('check_circle')), 
    'Button must display check_circle icon');
});

runTest('1.4 Button #btnSaveSaleBar styling, touch target, and high-contrast styling', () => {
  resetFreshStore();
  store.addToCart('p1', 1);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const saveBtn = container.querySelector('#btnSaveSaleBar');
  assert.strictEqual(saveBtn.getAttribute('type'), 'button', 'Button must have explicit type="button"');
  assert.ok(saveBtn.classList.contains('bg-secondary-fixed'), 'Button must use secondary-fixed high contrast background');
  assert.ok(saveBtn.classList.contains('text-on-secondary-fixed'), 'Button must use on-secondary-fixed high contrast text');
  assert.ok(saveBtn.classList.contains('font-bold'), 'Button text must be bold');
});

runTest('1.5 Sticky bar viewport adaptation (fixed, bottom clearance, max-width)', () => {
  resetFreshStore();
  store.addToCart('p1', 1);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const outerBar = container.querySelector('.fixed.bottom-16');
  assert.notStrictEqual(outerBar, null, 'Sticky bar wrapper must have fixed bottom-16 to avoid bottom nav bar');
  assert.ok(outerBar.classList.contains('left-0') && outerBar.classList.contains('right-0'), 'Must stretch full width left-0 right-0');
  assert.ok(outerBar.classList.contains('z-40'), 'Must have z-40 layering above content and below modal z-50');

  const innerConstraint = outerBar.children[0];
  assert.ok(innerConstraint.classList.contains('max-w-md'), 'Must constrain width to max-w-md on desktop viewports');
  assert.ok(innerConstraint.classList.contains('mx-auto'), 'Must center container horizontally on desktop viewports');
});

runTest('1.6 Checkout Modal (#cartModal) open & close toggle mechanism', () => {
  resetFreshStore();
  store.addToCart('p1', 1);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const modal = container.querySelector('#cartModal');
  assert.ok(modal.classList.contains('hidden'), 'Modal must initially be hidden');

  const openBtn = container.querySelector('#openCartModalBtn');
  assert.notStrictEqual(openBtn, null, '#openCartModalBtn must be present');
  openBtn.click();
  assert.ok(!modal.classList.contains('hidden'), 'Clicking #openCartModalBtn must remove "hidden"');

  const closeBtn = container.querySelector('#closeCartModalBtn');
  assert.notStrictEqual(closeBtn, null, '#closeCartModalBtn must be present');
  closeBtn.click();
  assert.ok(modal.classList.contains('hidden'), 'Clicking #closeCartModalBtn must restore "hidden"');
});

runTest('1.7 Modal confirmation button #confirmSaleBtn label and accessible touch target', () => {
  resetFreshStore();
  store.addToCart('p1', 1);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const confirmBtn = container.querySelector('#confirmSaleBtn');
  assert.notStrictEqual(confirmBtn, null, '#confirmSaleBtn must be present in modal');
  assert.ok(confirmBtn.innerText.includes('Guardar Venta'), 'Modal button must contain "Guardar Venta"');
  assert.ok(confirmBtn.innerText.includes('Ticket'), 'Default billing type ticket must reflect in button');
  assert.ok(confirmBtn.classList.contains('flex-1') && confirmBtn.classList.contains('py-3'), 
    'Button must be full width flex-1 with py-3 large touch target');
  assert.ok(confirmBtn.classList.contains('bg-primary') && confirmBtn.classList.contains('text-on-primary'),
    'Button must use primary prominent theme color');
});

runTest('1.8 Modal responsive classes for Mobile (bottom sheet) and Desktop (centered modal)', () => {
  resetFreshStore();
  store.addToCart('p1', 1);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const modal = container.querySelector('#cartModal');
  assert.ok(modal.classList.contains('items-end'), 'Mobile layout must align to bottom (items-end)');
  assert.ok(modal.classList.contains('sm:items-center'), 'Desktop layout must center vertically (sm:items-center)');

  const modalDialog = modal.children[0];
  assert.ok(modalDialog.classList.contains('w-full'), 'Mobile width must be 100%');
  assert.ok(modalDialog.classList.contains('max-w-lg'), 'Modal width must be capped at max-w-lg');
  assert.ok(modalDialog.classList.contains('rounded-t-3xl'), 'Mobile must round top corners (rounded-t-3xl)');
  assert.ok(modalDialog.classList.contains('sm:rounded-3xl'), 'Desktop must round all corners (sm:rounded-3xl)');
  assert.ok(modalDialog.classList.contains('max-h-[90vh]'), 'Modal height must be capped at 90vh to prevent overflow');
});

console.log();

// ===========================================================================
// MODULE 2: Execution of executeConfirmSale Under Various Cart States
// ===========================================================================
console.log('\x1b[1m▶ MODULE 2: Execution of executeConfirmSale Under Various Cart States\x1b[0m');

runTest('2.1 Empty cart: executeConfirmSale safely returns null without side effects', () => {
  resetFreshStore();
  const initialInvoicesCount = store.getInvoices().length;
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  // Trigger confirm sale button directly with empty cart
  const confirmBtn = container.querySelector('#confirmSaleBtn');
  confirmBtn.click();

  assert.strictEqual(store.getInvoices().length, initialInvoicesCount, 'Invoices count must not change on empty cart');
  assert.strictEqual(store.getCart().length, 0, 'Cart must remain empty');
});

runTest('2.2 Single-item cart with recipe: product stock & raw inventory ingredients decrement', () => {
  resetFreshStore();
  const prod = store.getProduct('p6'); // Pastel Selva Negra, recipe rec-042
  assert.ok(prod && prod.recipeId, 'p6 must exist and have recipeId');
  const initialProdStock = prod.stock;

  const butter = store.findMatchingInventoryItem('Mantequilla sin sal 82%');
  const flour = store.findMatchingInventoryItem('Harina de Trigo Especial');
  assert.ok(butter && flour, 'Butter and flour inventory items must exist');
  const initialButter = butter.stock;
  const initialFlour = flour.stock;

  store.addToCart('p6', 2);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const saveBarBtn = container.querySelector('#btnSaveSaleBar');
  assert.notStrictEqual(saveBarBtn, null);
  saveBarBtn.click(); // Triggers executeConfirmSale

  // Check product stock decremented by 2
  assert.strictEqual(prod.stock, initialProdStock - 2, 'Product stock must decrement by 2');

  // Recipe rec-042: Mantequilla 0.25 kg * 2 = 0.50 kg, Harina 0.40 kg * 2 = 0.80 kg
  assert.strictEqual(butter.stock, Math.round((initialButter - 0.50) * 100) / 100, 'Butter must decrement by 0.50 kg');
  assert.strictEqual(flour.stock, Math.round((initialFlour - 0.80) * 100) / 100, 'Flour must decrement by 0.80 kg');

  // Check cart cleared
  assert.strictEqual(store.getCart().length, 0, 'Cart must be cleared after confirm sale');

  // Check new invoice created
  const latestInvoice = store.getInvoices()[0];
  assert.ok(latestInvoice.id.startsWith('TIK-'), 'Must generate TIK- ID');
  assert.strictEqual(latestInvoice.items.length, 1);
  assert.strictEqual(latestInvoice.items[0].productId, 'p6');
  assert.strictEqual(latestInvoice.items[0].quantity, 2);
  assert.strictEqual(latestInvoice.total, 69.50);
});

runTest('2.3 Multi-item cart with discount, tip, and custom customer info', () => {
  resetFreshStore();
  const p1 = store.getProduct('p1'); // Red Velvet, $28.00
  const p2 = store.getProduct('p2'); // Cupcake, $3.50
  const p4 = store.getProduct('p4'); // Galletas, $7.50

  const initialP1Stock = p1.stock;
  const initialP2Stock = p2.stock;
  const initialP4Stock = p4.stock;

  store.addToCart('p1', 2); // 56.00
  store.addToCart('p2', 4); // 14.00
  store.addToCart('p4', 3); // 22.50
  // Subtotal = 92.50

  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  // Simulate quick discount button click (cycles 0 -> 5%)
  const discountBtn = container.querySelector('#quickDiscountBtn');
  discountBtn.click(); // 5%

  // Simulate quick tip button click (cycles 0 -> 1)
  const tipBtn = container.querySelector('#quickTipBtn');
  tipBtn.click(); // 1.00

  // Fill custom customer details in modal
  const custNameInp = container.querySelector('#checkoutCustomerName');
  const custDocInp = container.querySelector('#checkoutCustomerDoc');
  custNameInp.value = 'Repostería Doña Clara';
  custDocInp.value = '98765432-1';

  // Click confirm sale button in modal
  const confirmBtn = container.querySelector('#confirmSaleBtn');
  confirmBtn.click();

  const inv = store.getInvoices()[0];
  assert.strictEqual(inv.customerName, 'Repostería Doña Clara', 'Customer name must match input');
  assert.strictEqual(inv.customerDoc, '98765432-1', 'Customer doc must match input');
  assert.strictEqual(inv.subtotal, 92.50, 'Subtotal must be 92.50');
  assert.strictEqual(inv.discountPercent, 5, 'Discount must be 5%');
  assert.strictEqual(inv.discountAmount, 92.50 * 0.05, 'Discount amount must be 4.625');
  assert.strictEqual(inv.tip, 1.00, 'Tip must be 1.00');
  const expectedTotal = Math.max(0, 92.50 - (92.50 * 0.05) + 1.00);
  assert.strictEqual(inv.total, expectedTotal, 'Total must match formula');

  // Verify stock decrements for all 3 products
  assert.strictEqual(p1.stock, initialP1Stock - 2, 'P1 stock must decrement by 2');
  assert.strictEqual(p2.stock, initialP2Stock - 4, 'P2 stock must decrement by 4');
  assert.strictEqual(p4.stock, initialP4Stock - 3, 'P4 stock must decrement by 3');

  // Verify cart cleared
  assert.strictEqual(store.getCart().length, 0, 'Cart must be cleared');
});

runTest('2.4 Zero-price promotional item standalone execution', () => {
  resetFreshStore();
  // Register a promotional item with price 0.00
  const promoProduct = {
    id: 'p-free-sample',
    name: 'Muestra Gratis Degustación Pastel',
    category: 'postres',
    price: 0.00,
    cost: 0.50,
    stock: 10,
    unit: 'porción',
    recipeId: 'rec-042' // Uses Selva Negra recipe
  };
  store.state.products.push(promoProduct);

  const flour = store.findMatchingInventoryItem('Harina de Trigo Especial');
  const initialFlour = flour.stock;

  store.addToCart('p-free-sample', 1);
  assert.strictEqual(store.getCart()[0].price, 0.00, 'Cart item price must be 0.00');

  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  // Sticky bar should still be visible because cartCount > 0
  const saveBtn = container.querySelector('#btnSaveSaleBar');
  assert.notStrictEqual(saveBtn, null, 'Sticky bar must render even for zero-price item');

  // Execute sale
  saveBtn.click();

  const inv = store.getInvoices()[0];
  assert.strictEqual(inv.subtotal, 0.00, 'Subtotal must be 0.00');
  assert.strictEqual(inv.total, 0.00, 'Total must be 0.00');
  assert.strictEqual(promoProduct.stock, 9, 'Zero-price item stock must still decrement by 1');
  assert.strictEqual(flour.stock, Math.round((initialFlour - 0.40) * 100) / 100, 
    'Raw ingredients must still be deducted for zero-price promotional items');
});

runTest('2.5 Mixed zero-price promo item + paid item in cart', () => {
  resetFreshStore();
  const freeCookie = {
    id: 'p-free-cookie',
    name: 'Galleta de Cortesía',
    category: 'galletas',
    price: 0.00,
    stock: 20,
    recipeId: 'rec-cookies'
  };
  store.state.products.push(freeCookie);

  const p1 = store.getProduct('p1'); // Red Velvet, $28.00
  const initialP1Stock = p1.stock;

  store.addToCart('p1', 1); // $28.00
  store.addToCart('p-free-cookie', 2); // $0.00

  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const saveBtn = container.querySelector('#btnSaveSaleBar');
  saveBtn.click();

  const inv = store.getInvoices()[0];
  assert.strictEqual(inv.subtotal, 28.00, 'Subtotal should only sum paid items');
  assert.strictEqual(inv.total, 28.00, 'Total should only sum paid items');
  assert.strictEqual(p1.stock, initialP1Stock - 1, 'P1 stock decremented');
  assert.strictEqual(freeCookie.stock, 18, 'Free cookie stock decremented by 2');
});

runTest('2.6 Rapid double-click / Re-entrancy stress testing on save button', () => {
  resetFreshStore();
  const initialInvoiceCount = store.getInvoices().length;
  store.addToCart('p1', 1);

  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const saveBtn = container.querySelector('#btnSaveSaleBar');
  
  // Simulate immediate rapid double-clicks
  saveBtn.click();
  saveBtn.click();

  // Exactly 1 invoice must be created, not 2
  assert.strictEqual(store.getInvoices().length, initialInvoiceCount + 1, 
    'Exactly 1 invoice must be created on double-click (re-entrancy prevented by empty cart guard)');
});

runTest('2.7 Stock depletion and underflow protection (non-negative guarantee)', () => {
  resetFreshStore();
  const prod = store.getProduct('p3'); // stock is 2
  assert.strictEqual(prod.stock, 2);

  // Directly pass invoice selling 10 units
  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p3', name: prod.name, quantity: 10, price: 22.00, total: 220.00 }],
    total: 220.00
  });

  // Stock must clamp at 0 and NEVER become negative
  assert.strictEqual(prod.stock, 0, 'Product stock must clamp at 0, never negative');
});

runTest('2.8 Multi-tier inventory matching by ID, exact name, substring, and tokens', () => {
  resetFreshStore();
  
  // 1. Direct ID match
  const match1 = store.findMatchingInventoryItem('inv-1');
  assert.notStrictEqual(match1, null);
  assert.strictEqual(match1.id, 'inv-1');

  // 2. Exact name match (case-insensitive)
  const match2 = store.findMatchingInventoryItem('harina de trigo pastelera');
  assert.notStrictEqual(match2, null);
  assert.strictEqual(match2.id, 'inv-2');

  // 3. Substring match
  const match3 = store.findMatchingInventoryItem('Chocolate amargo');
  assert.notStrictEqual(match3, null);

  // 4. Token overlap match with stop words ignored
  const match4 = store.findMatchingInventoryItem('Mantequilla para repostería con sal');
  assert.notStrictEqual(match4, null);
  assert.ok(match4.name.toLowerCase().includes('mantequilla'));

  // 5. Unknown ingredient gracefully returns null
  const matchUnknown = store.findMatchingInventoryItem('Extracto de Fruto de Dragón de la Patagonia');
  assert.strictEqual(matchUnknown, null, 'Unmatched item must return null without throwing');
});

console.log();

// ===========================================================================
// MODULE 3: Dashboard KPIs Calculation and Dynamic Updates
// ===========================================================================
console.log('\x1b[1m▶ MODULE 3: Dashboard KPIs Calculation and Dynamic Updates\x1b[0m');

runTest('3.1 Initial state KPIs mathematical formula consistency', () => {
  resetFreshStore();
  const invoices = store.getInvoices();
  const expectedTotalSales = invoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const expectedTotalOrders = invoices.length;
  const expectedAvgTicket = (expectedTotalSales / expectedTotalOrders).toFixed(2);
  const expectedExpenses = Math.round(expectedTotalSales * 0.631 * 100) / 100;
  const expectedNetProfit = Math.round((expectedTotalSales - expectedExpenses) * 100) / 100;

  const container = new MockDOMElement('div');
  renderDashboardView(container);

  const salesEl = container.querySelector('#dashTotalSales');
  const profitEl = container.querySelector('#dashNetProfit');

  assert.notStrictEqual(salesEl, null, '#dashTotalSales must exist in DOM');
  assert.notStrictEqual(profitEl, null, '#dashNetProfit must exist in DOM');
  assert.ok(salesEl.innerText.includes(expectedTotalSales.toFixed(2)), 'Sales element text must match formula');
  assert.ok(profitEl.innerText.includes(expectedNetProfit.toFixed(2)), 'Profit element text must match formula');
});

runTest('3.2 Dynamic KPI update after POS sale completion', () => {
  resetFreshStore();
  const preInvoices = store.getInvoices();
  const preSales = preInvoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const preOrders = preInvoices.length;

  // Complete a sale of $50.00
  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p1', name: 'Pastel Red Velvet', quantity: 1, price: 50.00, total: 50.00 }],
    total: 50.00
  });

  const postContainer = new MockDOMElement('div');
  renderDashboardView(postContainer);

  const postInvoices = store.getInvoices();
  const postSales = postInvoices.reduce((s, inv) => s + (inv.total || 0), 0);
  const postOrders = postInvoices.length;
  const postAvgTicket = (postSales / postOrders).toFixed(2);
  const postExpenses = Math.round(postSales * 0.631 * 100) / 100;
  const postNetProfit = Math.round((postSales - postExpenses) * 100) / 100;

  assert.strictEqual(postOrders, preOrders + 1, 'Total orders must increment by 1');
  assert.strictEqual(postSales, preSales + 50.00, 'Total sales must increase by 50.00');

  const salesEl = postContainer.querySelector('#dashTotalSales');
  const profitEl = postContainer.querySelector('#dashNetProfit');
  assert.ok(salesEl.innerText.includes(postSales.toFixed(2)), 'Rendered sales must reflect new total');
  assert.ok(profitEl.innerText.includes(postNetProfit.toFixed(2)), 'Rendered profit must reflect new total');
});

runTest('3.3 Zero-price sale impact on Dashboard KPIs', () => {
  resetFreshStore();
  const preSales = store.getInvoices().reduce((s, inv) => s + (inv.total || 0), 0);
  const preOrders = store.getInvoices().length;

  // Save zero-price sale
  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p-gift', name: 'Muestra Gratis', quantity: 1, price: 0.00, total: 0.00 }],
    total: 0.00
  });

  const container = new MockDOMElement('div');
  renderDashboardView(container);

  const postSales = store.getInvoices().reduce((s, inv) => s + (inv.total || 0), 0);
  const postOrders = store.getInvoices().length;
  const expectedAvg = (postSales / postOrders).toFixed(2);

  assert.strictEqual(postOrders, preOrders + 1, 'Orders count must increment by 1');
  assert.strictEqual(postSales, preSales, 'Total sales must NOT change on zero-price sale');
  
  const salesEl = container.querySelector('#dashTotalSales');
  assert.ok(salesEl.innerText.includes(postSales.toFixed(2)));
  assert.ok(!container.innerHTML.includes('NaN'), 'Dashboard must not contain NaN');
});

runTest('3.4 Invoice deletion impact on Dashboard KPIs', () => {
  resetFreshStore();
  const firstInv = store.getInvoices()[0];
  const deletedTotal = firstInv.total;
  const preSales = store.getInvoices().reduce((s, inv) => s + (inv.total || 0), 0);
  const preOrders = store.getInvoices().length;

  store.deleteInvoice(firstInv.id);

  const container = new MockDOMElement('div');
  renderDashboardView(container);

  const postSales = store.getInvoices().reduce((s, inv) => s + (inv.total || 0), 0);
  const postOrders = store.getInvoices().length;

  assert.strictEqual(postOrders, preOrders - 1, 'Orders count must decrement by 1');
  assert.strictEqual(postSales, preSales - deletedTotal, 'Total sales must decrement by deleted total');
});

runTest('3.5 Zero invoices edge case (empty store)', () => {
  resetFreshStore();
  store.state.invoices = []; // Clear all invoices

  const container = new MockDOMElement('div');
  renderDashboardView(container);

  const salesEl = container.querySelector('#dashTotalSales');
  const profitEl = container.querySelector('#dashNetProfit');

  assert.ok(salesEl.innerText.includes('0.00'), 'Sales must display 0.00');
  assert.ok(profitEl.innerText.includes('0.00'), 'Profit must display 0.00');
  assert.ok(!container.innerHTML.includes('NaN'), 'Must not display NaN');
  assert.ok(!container.innerHTML.includes('Infinity'), 'Must not display Infinity');
});

console.log();

// ===========================================================================
// MODULE 4: Adversarial Stress, Invariants & Security Hardening
// ===========================================================================
console.log('\x1b[1m▶ MODULE 4: Adversarial Stress, Invariants & Security Hardening\x1b[0m');

runTest('4.1 Unicode, emojis, and HTML entities in customer name and notes', () => {
  resetFreshStore();
  const xssName = '<script>alert("xss")</script> 🍰 Pastelera & "Gourmet"';
  const xssDoc = "ID-999' OR '1'='1";
  
  store.addToCart('p1', 1);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  container.querySelector('#checkoutCustomerName').value = xssName;
  container.querySelector('#checkoutCustomerDoc').value = xssDoc;

  const confirmBtn = container.querySelector('#confirmSaleBtn');
  confirmBtn.click();

  const saved = store.getInvoices()[0];
  assert.strictEqual(saved.customerName, xssName, 'Special characters must be faithfully preserved');
  assert.strictEqual(saved.customerDoc, xssDoc, 'SQL injection strings must be treated as plain string');

  // Verify renderInvoicesScreen can render it safely
  renderPosView(container, 'invoices');
  assert.ok(container.innerHTML.includes('Pastelera'), 'Invoices tab must render invoice');
});

runTest('4.2 Missing or corrupted recipeId fails gracefully without throwing', () => {
  resetFreshStore();
  const orphanProduct = {
    id: 'p-orphan',
    name: 'Torta Especial Sin Receta',
    category: 'pasteles',
    price: 15.00,
    stock: 5,
    recipeId: 'rec-non-existent-99999' // Non-existent recipe ID
  };
  store.state.products.push(orphanProduct);

  store.addToCart('p-orphan', 2);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const saveBtn = container.querySelector('#btnSaveSaleBar');
  assert.doesNotThrow(() => {
    saveBtn.click();
  }, 'Should not throw when recipeId does not exist in recipes catalog');

  assert.strictEqual(orphanProduct.stock, 3, 'Product stock must still decrement by 2');
});

runTest('4.3 Recipe with empty or malformed ingredients array fails gracefully', () => {
  resetFreshStore();
  const corruptRecipe = {
    id: 'rec-corrupt',
    name: 'Receta Vacía',
    ingredients: null // Corrupted ingredients
  };
  store.state.recipes.push(corruptRecipe);

  const productWithCorruptRecipe = {
    id: 'p-corrupt-rec',
    name: 'Producto con Receta Corrupta',
    category: 'pasteles',
    price: 10.00,
    stock: 4,
    recipeId: 'rec-corrupt'
  };
  store.state.products.push(productWithCorruptRecipe);

  store.addToCart('p-corrupt-rec', 1);
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  assert.doesNotThrow(() => {
    container.querySelector('#btnSaveSaleBar').click();
  }, 'Should handle non-array ingredients gracefully');

  assert.strictEqual(productWithCorruptRecipe.stock, 3);
});

runTest('4.4 Bulk sale (500 units) triggers stock depletion and status transitions to critical', () => {
  resetFreshStore();
  const butter = store.findMatchingInventoryItem('inv-1');
  assert.notStrictEqual(butter, null);

  // Directly invoice 500 Selva Negra cakes
  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p6', name: 'Pastel Selva Negra Especial 20cm', quantity: 500, price: 34.75, total: 17375.00 }],
    total: 17375.00
  });

  // Butter stock was 2.5 kg, deducts 500 * 0.25 = 125 kg
  assert.strictEqual(butter.stock, 0, 'Stock must floor at 0');
  assert.strictEqual(butter.status, 'critical', 'Status must transition to critical');
});

runTest('4.5 Decimal precision: calculations avoid precision artifacts', () => {
  resetFreshStore();
  // Selling items with fractional prices
  const weirdProduct = {
    id: 'p-odd',
    name: 'Alfajor Singular',
    category: 'galletas',
    price: 1.99,
    stock: 50
  };
  store.state.products.push(weirdProduct);

  store.addToCart('p-odd', 3); // 3 * 1.99 = 5.97
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');

  const saveBtn = container.querySelector('#btnSaveSaleBar');
  saveBtn.click();

  const inv = store.getInvoices()[0];
  assert.strictEqual(inv.subtotal, 5.97);
  assert.strictEqual(inv.total, 5.97);
  assert.strictEqual(inv.total.toFixed(2), '5.97');
});

runTest('4.6 In-place invoice editing does NOT double-deduct pantry inventory', () => {
  resetFreshStore();
  const butter = store.findMatchingInventoryItem('inv-1');
  const initialButter = butter.stock;

  // Make an initial sale
  store.addToCart('p6', 1); // Uses 0.25 kg butter
  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');
  container.querySelector('#btnSaveSaleBar').click();

  const butterAfterSale = butter.stock;
  assert.strictEqual(butterAfterSale, Math.round((initialButter - 0.25) * 100) / 100);

  // Now update the saved invoice (e.g. change customer notes or payment status)
  const savedInv = store.getInvoices()[0];
  savedInv.notes = 'Modificación de prueba';
  savedInv.status = 'Pendiente';
  store.saveInvoice(savedInv); // Saving existing invoice with id

  // Verify butter was NOT decremented again
  assert.strictEqual(butter.stock, butterAfterSale, 
    'Saving an existing invoice (with ID) must NOT trigger inventory deduction again');
});

runTest('4.7 Cart item eviction: reducing quantity to 0 removes item and hides bar', () => {
  resetFreshStore();
  store.addToCart('p1', 1);
  assert.strictEqual(store.getCart().length, 1);

  store.updateCartQty('p1', 0); // Evict
  assert.strictEqual(store.getCart().length, 0, 'Cart must be empty');

  const container = new MockDOMElement('div');
  renderPosView(container, 'pos');
  const stickyBar = container.querySelector('#btnSaveSaleBar');
  assert.strictEqual(stickyBar, null, 'Sticky bar must disappear when cart is cleared');
});

runTest('4.8 Invoice ID format validation (TIK-xxxxx or FAC-xxxxx)', () => {
  resetFreshStore();
  
  // Ticket
  const ticketInv = store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p1', quantity: 1, price: 28.00, total: 28.00 }],
    total: 28.00
  });
  assert.ok(/^TIK-\d{5}$/.test(ticketInv.id), `Ticket ID must match ^TIK-\\d{5}$, got ${ticketInv.id}`);

  // Factura
  const facturaInv = store.saveInvoice({
    type: 'factura',
    items: [{ productId: 'p1', quantity: 1, price: 28.00, total: 28.00 }],
    total: 28.00
  });
  assert.ok(/^FAC-\d{5}$/.test(facturaInv.id), `Factura ID must match ^FAC-\\d{5}$, got ${facturaInv.id}`);
});

runTest('4.9 Event emissions: invoices_changed and inventory_changed are dispatched', () => {
  resetFreshStore();
  let invoicesChangedDispatched = false;
  let inventoryChangedDispatched = false;

  const unsubscribe = store.subscribe((event, data) => {
    if (event === 'invoices_changed') invoicesChangedDispatched = true;
    if (event === 'inventory_changed') inventoryChangedDispatched = true;
  });

  store.saveInvoice({
    type: 'ticket',
    items: [{ productId: 'p6', quantity: 1, price: 34.75, total: 34.75 }],
    total: 34.75
  });

  unsubscribe();
  assert.ok(invoicesChangedDispatched, 'invoices_changed event must be emitted');
  assert.ok(inventoryChangedDispatched, 'inventory_changed event must be emitted');
});

console.log();

// ===========================================================================
// SUMMARY & VERDICT
// ===========================================================================
console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');
console.log(`\x1b[1mCHALLENGE RESULTS: \x1b[32m${passedCount} PASSED\x1b[0m | \x1b[31m${failedCount} FAILED\x1b[0m`);
console.log('\x1b[1m\x1b[36m======================================================================\x1b[0m');

if (failedCount > 0) {
  console.error('\nFailures details:');
  testFailures.forEach(f => console.error(`- ${f.name}: ${f.error.message}`));
  process.exit(1);
} else {
  console.log('\n\x1b[32m✔ VERDICT: CONFIRMED. All empirical POS and inventory challenges passed.\x1b[0m\n');
  process.exit(0);
}
