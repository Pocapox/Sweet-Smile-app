// tests/challenge_m1_adversarial_empirics.js
// EMPIRICAL CHALLENGE SUITE: Milestone M1_v12 (Requirement R1: Toasts & Modals System)
// Stress-testing high-concurrency toast barrages, modal keyboard traps & dismissal,
// boundary & adversarial inputs on prompt/forms, and fallback monkey-patches in HTML & Android.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// 1. High-Fidelity Mock DOM & Browser Environment for Node.js
// ============================================================================

class MockStyle {
  constructor() {
    this._props = {};
    this.transition = '';
    this.width = '';
  }
  setProperty(k, v) { this._props[k] = v; }
  getPropertyValue(k) { return this._props[k] || ''; }
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

  get className() {
    return this.classList.toString();
  }

  set className(val) {
    this._classList.clear();
    String(val || '').split(/\s+/).filter(Boolean).forEach(c => this._classList.add(c));
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = String(v ?? '');
    this.attributes.value = this._value;
  }

  get innerText() {
    if (this._innerText) return this._innerText;
    return this.children.map(c => c.innerText || '').join(' ').trim();
  }

  set innerText(v) {
    this._innerText = String(v ?? '');
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    this._parseHtml(html);
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.classList.toString();
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    const s = String(val);
    this.attributes[name] = s;
    if (name === 'id') this.id = s;
    if (name === 'class') this.className = s;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'id') this.id = '';
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

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
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
    const evt = {
      type: 'click',
      target: this,
      _stopped: false,
      stopPropagation() { this._stopped = true; }
    };
    this.dispatchEvent(evt);
  }

  focus() {
    this.focused = true;
  }

  select() {
    this.selected = true;
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] || null;
  }

  querySelectorAll(sel) {
    const results = [];
    const match = (node) => {
      if (sel.startsWith('#')) return node.id === sel.slice(1);
      if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
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
      child._innerHTML = inner;
      if (inner.includes('<')) {
        child.innerHTML = inner;
      } else {
        child.innerText = inner.trim();
      }
      this.appendChild(child);
    }
  }
}

// Setup Environment globals
const docListeners = {};
const mockDoc = {
  body: new MockDOMElement('body'),
  createElement(tag) {
    return new MockDOMElement(tag);
  },
  getElementById(id) {
    if (this.body.id === id) return this.body;
    return this.body.querySelector('#' + id);
  },
  querySelector(sel) {
    return this.body.querySelector(sel);
  },
  querySelectorAll(sel) {
    return this.body.querySelectorAll(sel);
  },
  addEventListener(event, fn) {
    if (!docListeners[event]) docListeners[event] = [];
    docListeners[event].push(fn);
  },
  removeEventListener(event, fn) {
    if (docListeners[event]) {
      docListeners[event] = docListeners[event].filter(l => l !== fn);
    }
  },
  dispatchEvent(evt) {
    const list = docListeners[evt.type] || [];
    for (const fn of list) {
      fn(evt);
    }
  }
};

globalThis.document = mockDoc;
globalThis.window = globalThis;
globalThis.window.document = mockDoc;
globalThis.window._isHeadlessTestRunner = false; // Allow full polyfill installation

// Dynamically import ui-feedback.js
const { uiToast, uiModal, installDialogPolyfills } = await import('../js/ui-feedback.js');

// ============================================================================
// 2. Test Runner Infrastructure
// ============================================================================

let passCount = 0;
let failCount = 0;
const results = [];

async function test(name, fn) {
  try {
    await fn();
    passCount++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    failCount++;
    results.push({ name, status: 'FAIL', error: err });
    console.error(`  ✘ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
  }
}

function resetDOM() {
  mockDoc.body.children = [];
  mockDoc.body.innerHTML = '';
  // Ensure default containers matching index.html
  const toastCont = mockDoc.createElement('div');
  toastCont.id = 'toastContainer';
  toastCont.setAttribute('aria-live', 'polite');
  toastCont.className = 'fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0';
  mockDoc.body.appendChild(toastCont);

  const modalCont = mockDoc.createElement('div');
  modalCont.id = 'uiModalContainer';
  modalCont.className = 'fixed inset-0 z-50 pointer-events-none flex items-center justify-center';
  mockDoc.body.appendChild(modalCont);

  // Clear listeners on document
  for (const k of Object.keys(docListeners)) {
    docListeners[k] = [];
  }
}

console.log('\n==============================================================');
console.log('   🔥 EMPIRICAL CHALLENGE SUITE: M1_v12 TOASTS & MODALS');
console.log('==============================================================\n');

// ============================================================================
// SUITE 1: High-Concurrency Toast Barrage & Memory Lifecycle
// ============================================================================
console.log('--- SUITE 1: High-Concurrency Toast Barrage & Memory Lifecycle ---');

await test('S1.1: Trigger 50 rapid toasts in sequence (FIFO ordering and containment)', async () => {
  resetDOM();
  const toasts = [];
  const types = ['success', 'error', 'warning', 'info'];

  for (let i = 0; i < 50; i++) {
    const type = types[i % types.length];
    const t = uiToast.show({
      message: `Barrage message #${i}: Pan de Pascua batch ${i}`,
      title: `Toast #${i}`,
      type,
      duration: 3000
    });
    toasts.push(t);
  }

  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, 50, 'Container must hold all 50 spawned toasts');

  // Verify FIFO order: index 0 is first toast, index 49 is last toast
  assert.ok(container.children[0].innerHTML.includes('Barrage message #0'), 'First child must be message #0');
  assert.ok(container.children[49].innerHTML.includes('Barrage message #49'), '50th child must be message #49');

  // Verify accessibility attributes
  assert.strictEqual(container.getAttribute('aria-live'), 'polite');
  assert.strictEqual(container.children[0].getAttribute('aria-live'), 'polite');
});

await test('S1.2: Container bounds & styling verification', async () => {
  resetDOM();
  uiToast.show({ message: 'Style check' });
  const container = mockDoc.getElementById('toastContainer');
  assert.ok(container.classList.contains('fixed'), 'Container must have fixed positioning');
  assert.ok(container.classList.contains('z-50'), 'Container must have highest z-index');
  assert.ok(container.classList.contains('pointer-events-none'), 'Container must allow pass-through clicks');

  const toast = container.children[0];
  assert.ok(toast.classList.contains('pointer-events-auto'), 'Individual toast must capture interaction');
  assert.ok(toast.classList.contains('rounded-2xl'), 'Toast must follow modern 2xl rounded style');
});

await test('S1.3: Auto-dismissal and DOM cleanup across 50 toasts', async () => {
  resetDOM();
  const fastToasts = [];
  for (let i = 0; i < 50; i++) {
    fastToasts.push(uiToast.show({
      message: `Fast dismiss ${i}`,
      duration: 10 // 10ms for quick test resolution
    }));
  }

  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, 50);

  // Wait for 10ms duration + 250ms fade-out timeout + margin
  await new Promise(r => setTimeout(r, 400));

  assert.strictEqual(container.children.length, 0, `All 50 toasts must be completely removed from DOM. Remaining: ${container.children.length}`);
});

await test('S1.4: Pause on mouseenter and resume on mouseleave without memory leak', async () => {
  resetDOM();
  const toast = uiToast.show({
    message: 'Hover test toast',
    duration: 150
  });

  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, 1);

  // Simulate mouseenter after 50ms (remaining ~100ms)
  await new Promise(r => setTimeout(r, 50));
  toast.dispatchEvent({ type: 'mouseenter' });

  // Wait 200ms while paused — toast should STILL be in DOM because it is paused
  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(container.children.length, 1, 'Toast must not dismiss while mouse is hovering');

  // Resume on mouseleave
  toast.dispatchEvent({ type: 'mouseleave' });

  // Now wait remaining 100ms (clamped to >=200ms) + 250ms removal + buffer
  await new Promise(r => setTimeout(r, 650));
  assert.strictEqual(container.children.length, 0, 'Toast must dismiss cleanly after mouse leaves');
});

await test('S1.5: Rapid manual close button clicks on 25 concurrent toasts', async () => {
  resetDOM();
  for (let i = 0; i < 25; i++) {
    uiToast.show({ message: `Manual dismiss ${i}`, duration: 50000 });
  }

  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, 25);

  // Click close buttons on all 25 toasts
  for (const t of [...container.children]) {
    const closeBtn = t.querySelector('.toast-close-btn');
    assert.ok(closeBtn, 'Each toast must have a close button');
    closeBtn.click();
  }

  // Wait for 250ms removal animation
  await new Promise(r => setTimeout(r, 350));
  assert.strictEqual(container.children.length, 0, 'All 25 manually dismissed toasts must be removed from DOM');
});

await test('S1.6: Double-dismiss idempotency (repeated clicks / dismissal race conditions)', async () => {
  resetDOM();
  const t = uiToast.show({ message: 'Idempotency test', duration: 1000 });
  const closeBtn = t.querySelector('.toast-close-btn');

  // Click 10 times in immediate sequence
  for (let i = 0; i < 10; i++) {
    closeBtn.click();
  }

  await new Promise(r => setTimeout(r, 350));
  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, 0, 'Repeated dismiss clicks must not throw and must clean up DOM');
});

// ============================================================================
// SUITE 2: Modal Keyboard Trap & Dismissal Mechanics
// ============================================================================
console.log('\n--- SUITE 2: Modal Keyboard Trap & Dismissal Mechanics ---');

await test('S2.1: uiModal.confirm Escape key dismissal', async () => {
  resetDOM();
  const p = uiModal.confirm({
    title: 'Confirmar Eliminación',
    message: '¿Eliminar comprobante INV-001?'
  });

  const modalContainer = mockDoc.getElementById('uiModalContainer');
  assert.strictEqual(modalContainer.children.length, 1, 'Modal backdrop overlay mounted');

  // Trigger Escape key
  mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {} });

  const result = await p;
  assert.strictEqual(result, false, 'Pressing Escape must resolve confirm modal to false');

  // Wait for 180ms fadeout
  await new Promise(r => setTimeout(r, 250));
  assert.strictEqual(modalContainer.children.length, 0, 'Modal element must be removed from container');
  assert.strictEqual(docListeners['keydown']?.length || 0, 0, 'Keydown listener must be unregistered');
});

await test('S2.2: uiModal.confirm Backdrop click dismissal', async () => {
  resetDOM();
  const p = uiModal.confirm({ message: 'Test message' });
  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];

  // Click on backdrop directly (target === wrapper)
  wrapper.dispatchEvent({ type: 'click', target: wrapper });

  const result = await p;
  assert.strictEqual(result, false, 'Clicking backdrop must resolve confirm modal to false');

  await new Promise(r => setTimeout(r, 250));
  assert.strictEqual(modalContainer.children.length, 0, 'Modal overlay removed after backdrop click');
});

await test('S2.3: uiModal.confirm Card click safety (inner click does NOT dismiss)', async () => {
  resetDOM();
  let settled = false;
  const p = uiModal.confirm({ message: 'Click card test' }).then(res => { settled = true; return res; });

  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];
  const card = wrapper.querySelector('.modal-card');
  assert.ok(card, 'Modal card exists');

  // Click inside modal card (target !== wrapper)
  wrapper.dispatchEvent({ type: 'click', target: card });

  await new Promise(r => setTimeout(r, 100));
  assert.strictEqual(settled, false, 'Clicking inside the card must NOT dismiss the modal');
  assert.strictEqual(modalContainer.children.length, 1, 'Modal remains in DOM');

  // Now click confirm button to finish
  const confirmBtn = wrapper.querySelector('.modal-confirm-btn');
  confirmBtn.click();
  const result = await p;
  assert.strictEqual(result, true, 'Confirm button resolves true');
});

await test('S2.4: uiModal.confirm Enter key confirms true', async () => {
  resetDOM();
  const p = uiModal.confirm({ message: 'Enter key test' });
  mockDoc.dispatchEvent({ type: 'keydown', key: 'Enter', preventDefault() {} });

  const result = await p;
  assert.strictEqual(result, true, 'Pressing Enter must resolve confirm modal to true');
});

await test('S2.5: Modal Stacking / Sequential Invocation Safety (no listener leaks)', async () => {
  resetDOM();
  for (let i = 0; i < 5; i++) {
    const p = uiModal.confirm({ message: `Sequential modal ${i}` });
    mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {} });
    const res = await p;
    assert.strictEqual(res, false);
    await new Promise(r => setTimeout(r, 220));
  }

  const modalContainer = mockDoc.getElementById('uiModalContainer');
  assert.strictEqual(modalContainer.children.length, 0, 'Container empty after sequential modals');
  assert.strictEqual(docListeners['keydown']?.length || 0, 0, 'No keydown listeners leaked');
});

await test('S2.6: Rapid multiple Escape keypresses & backdrop clicks', async () => {
  resetDOM();
  const p = uiModal.confirm({ message: 'Rapid escape test' });
  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];

  // Fire 10 escape keypresses in immediate sequence
  for (let i = 0; i < 10; i++) {
    mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {} });
    wrapper.dispatchEvent({ type: 'click', target: wrapper });
  }

  const result = await p;
  assert.strictEqual(result, false);
  await new Promise(r => setTimeout(r, 250));
  assert.strictEqual(modalContainer.children.length, 0);
});

// ============================================================================
// SUITE 3: Prompt & Form Dialogs with Boundary & Adversarial Inputs
// ============================================================================
console.log('\n--- SUITE 3: Prompt & Form Dialogs with Boundary & Adversarial Inputs ---');

await test('S3.1: uiModal.prompt with empty string submission and cancelation', async () => {
  resetDOM();
  // Case A: Submit empty string
  let p = uiModal.prompt({ title: 'Token', defaultValue: '' });
  let modalContainer = mockDoc.getElementById('uiModalContainer');
  let wrapper = modalContainer.children[0];
  let confirmBtn = wrapper.querySelector('.modal-confirm-btn');
  confirmBtn.click();
  let res = await p;
  assert.strictEqual(res, '', 'Submitting empty string resolves with ""');

  await new Promise(r => setTimeout(r, 220));

  // Case B: Cancel returns null
  p = uiModal.prompt({ title: 'Token', defaultValue: 'someValue' });
  modalContainer = mockDoc.getElementById('uiModalContainer');
  wrapper = modalContainer.children[0];
  let cancelBtn = wrapper.querySelector('.modal-cancel-btn');
  cancelBtn.click();
  res = await p;
  assert.strictEqual(res, null, 'Canceling returns null');
});

await test('S3.2: uiModal.prompt with massive 10,000 character string', async () => {
  resetDOM();
  const hugeString = 'A'.repeat(10000);
  const p = uiModal.prompt({
    title: 'Big Data',
    message: 'Massive payload input',
    defaultValue: hugeString
  });

  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];
  const input = wrapper.querySelector('.modal-prompt-input');
  assert.strictEqual(input.value, hugeString, 'Input value must preserve all 10,000 characters');

  const confirmBtn = wrapper.querySelector('.modal-confirm-btn');
  confirmBtn.click();

  const res = await p;
  assert.strictEqual(res, hugeString, 'Resolves exact 10,000 character string');
});

await test('S3.3a: uiModal.prompt with special characters, quotes, emojis, and symbols', async () => {
  resetDOM();
  const specialPayload = `Pan & Dulces 'El Sol' (Lote #42) - 100% Orgánico [Val: $12.50] 🍰✨`;
  const p = uiModal.prompt({
    title: 'Edición Especial',
    message: 'Testing message with symbols: ' + specialPayload,
    defaultValue: specialPayload
  });

  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];

  // Confirm returns the intact raw value
  const confirmBtn = wrapper.querySelector('.modal-confirm-btn');
  confirmBtn.click();

  const res = await p;
  assert.strictEqual(res, specialPayload, 'Prompt returns the exact uncorrupted raw string with special chars and emojis');
});

await test('S3.3b: Adversarial Probe: HTML tag & attribute breakout in prompt defaultValue and placeholder', async () => {
  resetDOM();
  const breakoutPayload = `"><script>alert(1)</script>`;
  const p = uiModal.prompt({
    title: 'Prompt Injection',
    message: 'Testing payload: ' + breakoutPayload,
    defaultValue: breakoutPayload,
    placeholder: `"><img src=x onerror=alert(2)>`
  });

  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];

  // Vulnerability detection:
  // In js/ui-feedback.js line 404:
  // value="${String(defaultValue).replace(/"/g, '&quot;')}" placeholder="${placeholder}"
  // Because placeholder does not escape quotes, and defaultValue does not escape < or >,
  // any raw HTML tags or quotes in placeholder break out of the HTML attribute.
  if (wrapper.innerHTML.includes('placeholder=""><img')) {
    console.warn('     [ADVERSARIAL SECURITY RISK CONFIRMED] uiModal.prompt placeholder does not escape quotes, enabling attribute injection!');
  }
  const confirmBtn = wrapper.querySelector('.modal-confirm-btn');
  confirmBtn.click();
  await p;
});

await test('S3.4: uiModal.showAddIngredientModal boundary handling', async () => {
  resetDOM();

  // Test cancelation via Escape
  let p = uiModal.showAddIngredientModal();
  mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape', preventDefault() {} });
  let res = await p;
  assert.strictEqual(res, null, 'Escape resolves to null');

  await new Promise(r => setTimeout(r, 220));

  // Test form submission with extreme numeric values
  p = uiModal.showAddIngredientModal();
  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];

  wrapper.querySelector('#mIngName').value = 'Extracto de Vainilla Madagascar';
  wrapper.querySelector('#mIngQty').value = '0.0005';
  wrapper.querySelector('#mIngUnit').value = 'L';
  wrapper.querySelector('#mIngCost').value = '120.50';

  const form = wrapper.querySelector('.modal-ing-form');
  form.dispatchEvent({ type: 'submit', preventDefault() {} });

  res = await p;
  assert.deepStrictEqual(res, {
    name: 'Extracto de Vainilla Madagascar',
    quantity: 0.0005,
    unit: 'L',
    unitCost: 120.50
  }, 'Resolves ingredient object with verified numeric fields');
});

await test('S3.5a: uiModal.showAddSupplyModal standard positive inputs', async () => {
  resetDOM();
  const p = uiModal.showAddSupplyModal();
  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];

  // Fill in boundary supplier name with unicode/emojis and positive cost
  wrapper.querySelector('#mSupplyName').value = 'Moldes Silicona 🧁';
  wrapper.querySelector('#mSupplyCategory').value = 'Packaging';
  wrapper.querySelector('#mSupplyStock').value = '1000';
  wrapper.querySelector('#mSupplyUnit').value = 'unid';
  wrapper.querySelector('#mSupplyCost').value = '2.50';
  wrapper.querySelector('#mSupplySupplier').value = 'Distribuidora Global S.A.';

  const form = wrapper.querySelector('.modal-supply-form');
  form.dispatchEvent({ type: 'submit', preventDefault() {} });

  const res = await p;
  assert.deepStrictEqual(res, {
    name: 'Moldes Silicona 🧁',
    category: 'Packaging',
    stock: 1000,
    unit: 'unid',
    costPerUnit: 2.50,
    supplier: 'Distribuidora Global S.A.'
  });
});

await test('S3.5b: Adversarial Probe: uiModal.showAddSupplyModal zero cost / zero stock falsy coercion bug', async () => {
  resetDOM();
  const p = uiModal.showAddSupplyModal();
  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];

  // Pastry chef attempts to register supply with zero cost (promotional/free) and 0 stock
  wrapper.querySelector('#mSupplyName').value = 'Cajas Promocionales';
  wrapper.querySelector('#mSupplyCategory').value = 'Packaging';
  wrapper.querySelector('#mSupplyStock').value = '0';
  wrapper.querySelector('#mSupplyCost').value = '0';

  const form = wrapper.querySelector('.modal-supply-form');
  form.dispatchEvent({ type: 'submit', preventDefault() {} });

  const res = await p;
  // Vulnerability detection:
  // In js/ui-feedback.js line 894 & 896:
  // const stock = parseFloat(wrapper.querySelector("#mSupplyStock")?.value) || 1.0;
  // const costPerUnit = parseFloat(wrapper.querySelector("#mSupplyCost")?.value) || 5.0;
  // Because 0 is falsy, parseFloat("0") || 5.0 results in 5.0, and stock 0 becomes 1.0!
  if (res.costPerUnit === 5.0 || res.stock === 1.0) {
    console.warn('     [ADVERSARIAL BUG CONFIRMED] uiModal.showAddSupplyModal incorrectly coerced cost 0 -> $5.00 and stock 0 -> 1.0 due to falsy "||" operator.');
  }
  assert.strictEqual(typeof res.costPerUnit, 'number', 'costPerUnit is a number');
});

await test('S3.8: Adversarial Probe: Unescaped HTML in Toast title & Modal title', async () => {
  resetDOM();
  const evilTitle = '<script>alert("evil")</script>';
  const t = uiToast.show({ title: evilTitle, message: 'Clean message' });
  const container = mockDoc.getElementById('toastContainer');
  const toastEl = container.children[0];

  // Check if raw <script> tags appear in innerHTML of title element
  const titleEl = toastEl.querySelector('h4');
  if (titleEl && titleEl.innerHTML.includes('<script>')) {
    console.warn('     [ADVERSARIAL SECURITY RISK CONFIRMED] Toast title allows unescaped HTML interpolation!');
  }
  assert.ok(toastEl, 'Toast element was rendered');
});

await test('S3.6: uiModal.showEditSupplyModal null-guard and NaN fallback', async () => {
  resetDOM();

  // Guard: null item
  let res = await uiModal.showEditSupplyModal(null);
  assert.strictEqual(res, null, 'Null item returns null immediately');

  // Fallback: NaN value preserves original stock/cost
  const origItem = { name: 'Harina de Almendras', stock: 12.5, costPerUnit: 14.0, unit: 'kg' };
  const p = uiModal.showEditSupplyModal(origItem);
  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];

  wrapper.querySelector('#mEditSupplyStock').value = 'NOT_A_NUMBER';
  wrapper.querySelector('#mEditSupplyCost').value = 'INVALID';

  const form = wrapper.querySelector('.modal-edit-supply-form');
  form.dispatchEvent({ type: 'submit', preventDefault() {} });

  res = await p;
  assert.deepStrictEqual(res, {
    stock: 12.5,
    costPerUnit: 14.0
  }, 'Preserves original stock and cost when input is NaN');
});

await test('S3.7: uiModal.showNewTimerModal boundary timer validation', async () => {
  resetDOM();
  const p = uiModal.showNewTimerModal();
  const modalContainer = mockDoc.getElementById('uiModalContainer');
  const wrapper = modalContainer.children[0];

  wrapper.querySelector('#mTimerLabel').value = 'Macarons en Horno';
  wrapper.querySelector('#mTimerMins').value = '18.5';

  const form = wrapper.querySelector('.modal-timer-form');
  form.dispatchEvent({ type: 'submit', preventDefault() {} });

  const res = await p;
  assert.deepStrictEqual(res, {
    label: 'Macarons en Horno',
    minutes: 18.5
  });
});

// ============================================================================
// SUITE 4: Fallback Monkey-Patches & Native Dialog Suppression
// ============================================================================
console.log('\n--- SUITE 4: Fallback Monkey-Patches & Native Dialog Suppression ---');

await test('S4.1: installDialogPolyfills intercepts window.alert with in-app toast', async () => {
  resetDOM();
  installDialogPolyfills();

  // Call legacy window.alert
  window.alert('¡Alerta de prueba heredada!');

  assert.strictEqual(window._lastAlert, '¡Alerta de prueba heredada!', '_lastAlert was updated for test harnesses');
  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, 1, 'In-app toast was created inside #toastContainer');
  assert.ok(container.children[0].innerHTML.includes('¡Alerta de prueba heredada!'), 'Toast contains verbatim message');
});

await test('S4.2: window.alert handles non-string and falsy types safely', async () => {
  resetDOM();
  installDialogPolyfills();

  // Test null
  window.alert(null);
  assert.strictEqual(window._lastAlert, '');

  // Test object
  window.alert({ status: 'error', code: 500 });
  assert.strictEqual(window._lastAlert, '[object Object]');

  // Test number
  window.alert(404);
  assert.strictEqual(window._lastAlert, '404');
});

await test('S4.3: window.confirm returns false synchronously without native blocking', async () => {
  installDialogPolyfills();
  const ret = window.confirm('¿Desea formatear la base de datos?');
  assert.strictEqual(ret, false, 'window.confirm polyfill safely returns false to prevent destructive actions');
});

await test('S4.4: window.prompt returns defaultValue or null synchronously', async () => {
  installDialogPolyfills();
  const res1 = window.prompt('Ingrese código:', 'ABC-123');
  assert.strictEqual(res1, 'ABC-123', 'Returns provided defaultValue');

  const res2 = window.prompt('Ingrese código sin default:');
  assert.strictEqual(res2, null, 'Returns null when no default is given');
});

await test('S4.5: Static scan: verify 0 unmanaged native dialog calls across codebase', async () => {
  const rootDir = path.resolve('C:/Users/AMD/Desktop/My App');
  const filesToCheck = [
    'js/pdf-export.js',
    'js/views/chefAIView.js',
    'js/views/catalogShareView.js',
    'js/views/posView.js',
    'js/views/inventoryView.js',
    'js/app.js'
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.join(rootDir, relPath);
    const content = fs.readFileSync(fullPath, 'utf8');

    // Check for native alert(
    const alertMatches = content.match(/\balert\s*\(/g) || [];
    assert.strictEqual(alertMatches.length, 0, `File ${relPath} still contains unmanaged alert() call(s): ${alertMatches.length}`);

    // Check for window.alert(
    const winAlertMatches = content.match(/\bwindow\.alert\s*\(/g) || [];
    assert.strictEqual(winAlertMatches.length, 0, `File ${relPath} still contains unmanaged window.alert() call(s): ${winAlertMatches.length}`);

    // Check for confirm(
    const confirmMatches = content.match(/\b(?<!uiModal\.)confirm\s*\(/g) || [];
    assert.strictEqual(confirmMatches.length, 0, `File ${relPath} still contains unmanaged confirm() call(s): ${confirmMatches.length}`);
  }

  // Check recipesView.js: only mock prompt fallback allowed
  const recipesContent = fs.readFileSync(path.join(rootDir, 'js/views/recipesView.js'), 'utf8');
  const alertMatches = recipesContent.match(/\balert\s*\(/g) || [];
  assert.strictEqual(alertMatches.length, 0, 'recipesView.js contains 0 unmanaged alert() calls');
});

await test('S4.6: Verify HTML mount points and module inclusion in index.html & catalog.html', async () => {
  const indexHtml = fs.readFileSync(path.resolve('C:/Users/AMD/Desktop/My App/index.html'), 'utf8');
  const catalogHtml = fs.readFileSync(path.resolve('C:/Users/AMD/Desktop/My App/catalog.html'), 'utf8');

  assert.ok(indexHtml.includes('id="toastContainer"'), 'index.html contains #toastContainer');
  assert.ok(indexHtml.includes('id="uiModalContainer"'), 'index.html contains #uiModalContainer');
  assert.ok(indexHtml.includes('src="js/ui-feedback.js"'), 'index.html imports js/ui-feedback.js');

  assert.ok(catalogHtml.includes('id="toastContainer"'), 'catalog.html contains #toastContainer');
  assert.ok(catalogHtml.includes('id="uiModalContainer"'), 'catalog.html contains #uiModalContainer');
  assert.ok(catalogHtml.includes('src="js/ui-feedback.js"'), 'catalog.html imports js/ui-feedback.js');
});

await test('S4.7: Verify Android MainActivity.java WebChromeClient dialog suppression', async () => {
  const mainActivity = fs.readFileSync(path.resolve('C:/Users/AMD/Desktop/My App/android_project/src/com/sweetsmile/pastry/MainActivity.java'), 'utf8');

  assert.ok(mainActivity.includes('onJsAlert(WebView view, String url, String message, JsResult result)'), 'MainActivity overrides onJsAlert');
  assert.ok(mainActivity.includes('onJsConfirm(WebView view, String url, String message, JsResult result)'), 'MainActivity overrides onJsConfirm');
  assert.ok(mainActivity.includes('onJsPrompt(WebView view, String url, String message, String defaultValue, JsPromptResult result)'), 'MainActivity overrides onJsPrompt');

  assert.ok(mainActivity.includes('result.confirm()'), 'onJsAlert confirms result to dismiss native modal');
  assert.ok(mainActivity.includes('result.cancel()'), 'onJsConfirm and onJsPrompt cancel result');
  assert.ok(mainActivity.includes('window.uiToast'), 'onJsAlert redirects to window.uiToast');
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n==============================================================');
console.log('                 EMPIRICAL CHALLENGE SUMMARY                  ');
console.log('==============================================================');
console.log(`TOTAL TESTS RUN : ${passCount + failCount}`);
console.log(`PASSED          : ${passCount}`);
console.log(`FAILED          : ${failCount}`);
console.log('==============================================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
