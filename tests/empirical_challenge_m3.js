// tests/empirical_challenge_m3.js
// EMPIRICAL CHALLENGE SUITE: Milestone M3 (Requirement R5 / Features F10, F11)
// Adversarial test runner for exit mechanisms, print iframe isolation, and #catalogo route safety.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// 1. High-Fidelity Mock DOM & Browser Environment
// ---------------------------------------------------------------------------
class MockStyle {
  constructor() {
    this._props = {};
  }
  setProperty(k, v) { this._props[k] = v; }
  getPropertyValue(k) { return this._props[k] || ''; }
  set position(v) { this._props.position = v; }
  get position() { return this._props.position || ''; }
  set right(v) { this._props.right = v; }
  get right() { return this._props.right || ''; }
  set bottom(v) { this._props.bottom = v; }
  get bottom() { return this._props.bottom || ''; }
  set width(v) { this._props.width = v; }
  get width() { return this._props.width || ''; }
  set height(v) { this._props.height = v; }
  get height() { return this._props.height || ''; }
  set border(v) { this._props.border = v; }
  get border() { return this._props.border || ''; }
  set visibility(v) { this._props.visibility = v; }
  get visibility() { return this._props.visibility || ''; }
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
    this.src = attrs.src || '';
    this.value = attrs.value || '';
    this.innerText = '';
    this._innerHTML = '';
    this.contentWindow = null;
    this.contentDocument = null;

    if (attrs.class) {
      attrs.class.split(/\s+/).filter(Boolean).forEach(c => this._classList.add(c));
    }

    if (this.tagName === 'IFRAME') {
      this._initIframeDocument();
    }
  }

  _initIframeDocument() {
    const doc = {
      _writtenHtml: '',
      open() { this._writtenHtml = ''; },
      write(chunk) { this._writtenHtml += chunk; },
      close() {}
    };
    const win = {
      document: doc,
      focusCalled: false,
      printCalled: false,
      printShouldThrow: false,
      focus() { this.focusCalled = true; },
      print() {
        if (this.printShouldThrow) {
          throw new Error('Native print dialog unavailable in WebView');
        }
        this.printCalled = true;
      }
    };
    this.contentWindow = win;
    this.contentDocument = doc;
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
    return this.attributes[name] ?? null;
  }

  setAttribute(name, val) {
    this.attributes[name] = String(val);
    if (name === 'id') this.id = String(val);
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
      if (inner.includes('<')) {
        child.innerHTML = inner;
      } else {
        child.innerText = inner.trim();
      }
      this.appendChild(child);
    }
  }
}

// Global environment setup
const mockDocBody = new MockDOMElement('body');
const mockDoc = {
  body: mockDocBody,
  listeners: {},
  createElement(tag) { return new MockDOMElement(tag); },
  getElementById(id) {
    return mockDocBody.querySelector('#' + id);
  },
  querySelector(sel) {
    return mockDocBody.querySelector(sel);
  },
  querySelectorAll(sel) {
    return mockDocBody.querySelectorAll(sel);
  },
  addEventListener(event, fn) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  },
  removeEventListener(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(l => l !== fn);
    }
  },
  dispatchEvent(evt) {
    const list = this.listeners[evt.type] || [];
    for (const fn of list) {
      fn(evt);
    }
  }
};

const mockWin = {
  location: {
    origin: 'http://localhost:3000',
    pathname: '/index.html',
    hash: '#catalogo'
  },
  document: mockDoc,
  navigator: {
    clipboard: {
      async writeText(t) { mockWin._lastClipboard = t; return true; }
    }
  },
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
  dispatchEvent(evt) {
    const list = this.listeners[evt.type] || [];
    for (const fn of list) fn(evt);
  },
  localStorage: {
    _data: {},
    getItem(k) { return this._data[k] || null; },
    setItem(k, v) { this._data[k] = String(v); },
    removeItem(k) { delete this._data[k]; },
    clear() { this._data = {}; }
  },
  alertCalls: [],
  openCalls: [],
  printCalls: 0,
  alert(msg) { this.alertCalls.push(msg); },
  open(url, target) {
    this.openCalls.push({ url, target });
    return {
      document: { write() {}, close() {} },
      close() {}
    };
  },
  print() { this.printCalls++; },
  __qrPosterEscapeHandler: null
};

globalThis.window = mockWin;
globalThis.document = mockDoc;
globalThis.localStorage = mockWin.localStorage;
globalThis.alert = mockWin.alert.bind(mockWin);

try {
  Object.defineProperty(globalThis, 'navigator', {
    value: mockWin.navigator,
    configurable: true,
    writable: true
  });
} catch {
  // If property cannot be redefined, mutate existing properties
  try {
    globalThis.navigator.clipboard = mockWin.navigator.clipboard;
  } catch {}
}

// Import application module under test
const { renderCatalogShareView } = await import('../js/views/catalogShareView.js');

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

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
    console.error(`    ${err.message}`);
    failedCount++;
    testFailures.push({ name, error: err });
  }
}

console.log('\x1b[1m\x1b[36m==============================================================\x1b[0m');
console.log('\x1b[1m\x1b[36m   EMPIRICAL CHALLENGER: MILESTONE M3 STRESS & VERIFICATION   \x1b[0m');
console.log('\x1b[1m\x1b[36m==============================================================\x1b[0m\n');

// Set up clean main container
const appContainer = new MockDOMElement('div', { id: 'app-container' });
const mainContainer = new MockDOMElement('main', { id: 'app-main-content' });
appContainer.appendChild(mainContainer);
mockDocBody.children = [appContainer];

// Helper to mount catalogShareView
function mountView() {
  mainContainer.children = [];
  mockWin.openCalls = [];
  mockWin.alertCalls = [];
  mockWin.printCalls = 0;
  mockWin.location.hash = '#catalogo';
  renderCatalogShareView(mainContainer);
  return {
    modal: mainContainer.querySelector('#qrPosterModal'),
    btnOpen: mainContainer.querySelector('#btnPrintQrPoster'),
    btnClose: mainContainer.querySelector('#closeQrPosterModal'),
    btnCancel: mainContainer.querySelector('#btnCancelQrPoster'),
    btnPrint: mainContainer.querySelector('#btnExecutePrintPoster'),
    previewCard: mainContainer.querySelector('#qrPosterPreview'),
    modalImg: mainContainer.querySelector('#modalQrImg'),
    inlineImg: mainContainer.querySelector('#qrImageElement'),
    urlInput: mainContainer.querySelector('#cfgCatalogUrl')
  };
}

// ===========================================================================
// SUITE 1: Exit Mechanisms & Trap Prevention (WebView & Browser)
// ===========================================================================
console.log('\x1b[1m--- SUITE 1: Exit Mechanisms & Trap Prevention (WebView & Browser) ---\x1b[0m');

runTest('1.1: Clicking #btnPrintQrPoster opens #qrPosterModal (removes "hidden")', () => {
  const v = mountView();
  assert(v.modal.classList.contains('hidden'), 'Modal must start with class "hidden"');
  v.btnOpen.click();
  assert(!v.modal.classList.contains('hidden'), 'Modal must not contain "hidden" after open trigger');
});

runTest('1.2: Exit Path A — Clicking top-right Close (X) button closes modal', () => {
  const v = mountView();
  v.btnOpen.click();
  assert(!v.modal.classList.contains('hidden'));
  v.btnClose.click();
  assert(v.modal.classList.contains('hidden'), 'Modal must be hidden after clicking close (X)');
});

runTest('1.3: Exit Path B — Clicking Cancel ("Cerrar") button closes modal', () => {
  const v = mountView();
  v.btnOpen.click();
  assert(!v.modal.classList.contains('hidden'));
  v.btnCancel.click();
  assert(v.modal.classList.contains('hidden'), 'Modal must be hidden after clicking "Cerrar"');
});

runTest('1.4: Exit Path C — Clicking outside overlay (backdrop) closes modal', () => {
  const v = mountView();
  v.btnOpen.click();
  assert(!v.modal.classList.contains('hidden'));
  // Simulate clicking on the modal backdrop container itself
  v.modal.dispatchEvent({ type: 'click', target: v.modal });
  assert(v.modal.classList.contains('hidden'), 'Modal must be hidden after backdrop click');
});

runTest('1.5: Non-Exit Protection — Clicking inside the modal card does NOT close modal', () => {
  const v = mountView();
  v.btnOpen.click();
  assert(!v.modal.classList.contains('hidden'));
  // Click inside the preview card
  v.previewCard.dispatchEvent({ type: 'click', target: v.previewCard });
  assert(!v.modal.classList.contains('hidden'), 'Modal must NOT close when clicking interior poster preview');
});

runTest('1.6: Exit Path D — Pressing Escape key closes active modal', () => {
  const v = mountView();
  v.btnOpen.click();
  assert(!v.modal.classList.contains('hidden'));
  // Simulate global Escape keydown
  mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert(v.modal.classList.contains('hidden'), 'Modal must be hidden after pressing Escape');
});

runTest('1.7: Escape listener clean unmount & idempotence across re-renders', () => {
  // Mount 5 times to simulate user navigating back and forth
  for (let i = 0; i < 5; i++) {
    mountView();
  }
  const v = mountView();
  v.btnOpen.click();
  assert(!v.modal.classList.contains('hidden'));
  // Escape should cleanly close without throwing or duplicate multi-invocations
  mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
  assert(v.modal.classList.contains('hidden'), 'Modal must close on Escape after multiple view mounts');
});

runTest('1.8: Alternating Stress Test — 100 rapid open/close cycles across all exit paths', () => {
  const v = mountView();
  const exitActions = [
    () => v.btnClose.click(),
    () => v.btnCancel.click(),
    () => v.modal.dispatchEvent({ type: 'click', target: v.modal }),
    () => mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape' })
  ];

  for (let i = 0; i < 100; i++) {
    v.btnOpen.click();
    assert(!v.modal.classList.contains('hidden'), `Cycle ${i}: failed to open`);
    const action = exitActions[i % exitActions.length];
    action();
    assert(v.modal.classList.contains('hidden'), `Cycle ${i}: failed to close`);
  }
});

// ===========================================================================
// SUITE 2: Print Iframe Isolation & Parent Navigation Integrity
// ===========================================================================
console.log('\n\x1b[1m--- SUITE 2: Print Iframe Isolation & Parent Navigation Integrity ---\x1b[0m');

runTest('2.1: Elimination of raw window.open("", "_blank") — Zero window.open calls', () => {
  const v = mountView();
  v.btnOpen.click();
  v.btnPrint.click();
  assert.strictEqual(mockWin.openCalls.length, 0, 'Must NOT invoke window.open during poster print flow');
});

runTest('2.2: Hidden iframe creation and DOM styling isolation', () => {
  const v = mountView();
  v.btnOpen.click();
  v.btnPrint.click();

  const printFrame = mockDoc.getElementById('qrPrintFrame');
  assert(printFrame, 'Iframe #qrPrintFrame must be created and appended to document');
  assert.strictEqual(printFrame.style.position, 'fixed');
  assert.strictEqual(printFrame.style.visibility, 'hidden');
  assert.strictEqual(printFrame.style.width, '0');
  assert.strictEqual(printFrame.style.height, '0');
  assert.strictEqual(printFrame.style.border, '0');
});

runTest('2.3: Parent DOM immutability — Application shell remains 100% intact', () => {
  const v = mountView();
  v.btnOpen.click();
  v.btnPrint.click();

  // Verify header, main container, and input elements are untouched
  assert(mockDoc.getElementById('app-container'), 'app-container must remain in DOM');
  assert(mockDoc.getElementById('app-main-content'), 'app-main-content must remain in DOM');
  assert(v.urlInput, 'URL input must remain in DOM');
  assert(v.btnCancel, 'Cancel button must remain in DOM');
});

runTest('2.4: Route immutability — Parent window location and hash remain #catalogo', () => {
  const v = mountView();
  v.btnOpen.click();
  v.btnPrint.click();

  assert.strictEqual(mockWin.location.hash, '#catalogo', 'Parent hash must strictly stay #catalogo');
  assert.strictEqual(mockWin.location.pathname, '/index.html', 'Parent pathname must not change');
});

runTest('2.5: Iframe document content verification — Complete branded poster', () => {
  const v = mountView();
  v.btnOpen.click();
  v.btnPrint.click();

  const printFrame = mockDoc.getElementById('qrPrintFrame');
  const written = printFrame.contentDocument._writtenHtml;

  assert(written.includes('<!DOCTYPE html>'), 'Must contain DOCTYPE');
  assert(written.includes('Cartel QR - Sweet Smile Pastry'), 'Must contain poster document title');
  assert(written.includes('🍰 Sweet Smile Pastry'), 'Must contain pastry brand header');
  assert(written.includes('Repostería Artesanal & Café'), 'Must contain subtitle');
  assert(written.includes('¡Escanea para ver nuestro Catálogo!'), 'Must contain scan CTA');
  assert(written.includes('Haz tu pedido directo a nuestro WhatsApp'), 'Must contain WhatsApp CTA');
  assert(written.includes(v.inlineImg.src), 'Must embed active QR data URI');
});

await runAsyncTest('2.6: Iframe print execution triggers contentWindow.print()', async () => {
  const v = mountView();
  v.btnOpen.click();
  v.btnPrint.click();

  const printFrame = mockDoc.getElementById('qrPrintFrame');
  // Await the 250ms setTimeout
  await new Promise(resolve => setTimeout(resolve, 300));

  assert(printFrame.contentWindow.focusCalled, 'iframe.contentWindow.focus() must be called');
  assert(printFrame.contentWindow.printCalled, 'iframe.contentWindow.print() must be called');
});

await runAsyncTest('2.7: WebView resilience — Graceful fallback if iframe print throws', async () => {
  const v = mountView();
  v.btnOpen.click();

  // Pre-create frame with throwing print method
  let printFrame = mockDoc.getElementById('qrPrintFrame');
  if (!printFrame) {
    printFrame = mockDoc.createElement('iframe');
    printFrame.id = 'qrPrintFrame';
    mockDocBody.appendChild(printFrame);
  }
  printFrame.contentWindow.printShouldThrow = true;

  // Click print; should catch exception and call window.print fallback without unhandled error
  v.btnPrint.click();
  await new Promise(resolve => setTimeout(resolve, 300));

  assert.strictEqual(mockWin.printCalls, 1, 'Should call window.print() fallback when iframe print throws');
  // Modal must still remain open and closable
  assert(!v.modal.classList.contains('hidden'));
  v.btnClose.click();
  assert(v.modal.classList.contains('hidden'), 'Modal must close cleanly after print error fallback');
});

runTest('2.8: Post-print modal state — User is never locked into modal after print', () => {
  const v = mountView();
  v.btnOpen.click();
  v.btnPrint.click();

  // User should immediately be able to dismiss via Cerrar
  assert(!v.modal.classList.contains('hidden'));
  v.btnCancel.click();
  assert(v.modal.classList.contains('hidden'), 'User must be able to exit modal immediately after printing');
});

// ===========================================================================
// SUITE 3: Navigation and State Integration (#catalogo Route Lifecycle)
// ===========================================================================
console.log('\n\x1b[1m--- SUITE 3: Navigation and State Integration (#catalogo Route Lifecycle) ---\x1b[0m');

runTest('3.1: Dynamic QR Synchronization — Editing URL updates modal QR and inline QR', () => {
  const v = mountView();
  const testUrl = 'https://sweetsmile.github.io/special-menu';

  // Trigger input event on URL field
  v.urlInput.value = testUrl;
  v.urlInput.dispatchEvent({ type: 'input', target: v.urlInput });

  assert(v.inlineImg.src.includes(encodeURIComponent(testUrl)), 'Inline QR must be updated with encoded URL');
  v.btnOpen.click();
  assert.strictEqual(v.modalImg.src, v.inlineImg.src, 'Modal QR image must synchronize with inline QR');
});

runTest('3.2: Re-opening modal displays the updated QR code', () => {
  const v = mountView();
  v.urlInput.value = 'https://sweetsmile.github.io/autumn-collection';
  v.urlInput.dispatchEvent({ type: 'input', target: v.urlInput });

  v.btnOpen.click();
  const src1 = v.modalImg.src;
  v.btnClose.click();

  v.urlInput.value = 'https://sweetsmile.github.io/winter-collection';
  v.urlInput.dispatchEvent({ type: 'input', target: v.urlInput });
  v.btnOpen.click();
  const src2 = v.modalImg.src;

  assert.notStrictEqual(src1, src2, 'Modal QR src must update on consecutive opens with new URL');
  assert.strictEqual(v.modalImg.src, v.inlineImg.src);
});

runTest('3.3: Route change while modal is open unmounts view without orphaned overlay', () => {
  const v = mountView();
  v.btnOpen.click();
  assert(!v.modal.classList.contains('hidden'));

  // Simulate routing to another page (replacing innerHTML of mainContainer)
  mainContainer.innerHTML = '<div id="posView">POS Content</div>';

  assert.strictEqual(mockDoc.getElementById('qrPosterModal'), null, 'Modal should be fully unmounted on route change');
  // Global Escape handler should be inert now
  mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
  // No exceptions thrown
});

runTest('3.4: Route return to #catalogo restores pristine default state (modal closed)', () => {
  // Re-mount catalog view
  const v = mountView();
  assert(v.modal.classList.contains('hidden'), 'New mount of #catalogo must have modal closed by default');
});

runTest('3.5: No conflicting hash navigation created by modal operations', () => {
  const v = mountView();
  mockWin.location.hash = '#catalogo';
  v.btnOpen.click();
  assert.strictEqual(mockWin.location.hash, '#catalogo', 'Opening modal must not alter hash');
  v.btnClose.click();
  assert.strictEqual(mockWin.location.hash, '#catalogo', 'Closing modal must not alter hash');
});

// ===========================================================================
// SUITE 4: Print Media CSS & Edge Case Analysis
// ===========================================================================
console.log('\n\x1b[1m--- SUITE 4: Print Media CSS & Edge Case Analysis ---\x1b[0m');

runTest('4.1: Embedded style tag contains @media print rules', () => {
  mountView();
  const styleEl = mainContainer.querySelector('style');
  assert(styleEl, '<style> tag must exist in view template');
  assert(styleEl.innerText.includes('@media print'), 'Must define @media print block');
});

runTest('4.2: Media print isolation design analysis', () => {
  const v = mountView();
  v.btnOpen.click();
  v.btnPrint.click();

  const printFrame = mockDoc.getElementById('qrPrintFrame');
  const iframeDoc = printFrame.contentDocument._writtenHtml;
  assert(iframeDoc.includes('@page { size: auto; margin: 15mm; }'), 'Iframe has independent @page styling');
  assert(iframeDoc.includes('.poster {'), 'Iframe has self-contained .poster styling');
});

// ---------------------------------------------------------------------------
// 3. Summary & Final Verdict
// ---------------------------------------------------------------------------
console.log('\n\x1b[1m\x1b[36m==============================================================\x1b[0m');
console.log(`\x1b[1mTOTAL TESTS EXECUTED: ${passedCount + failedCount}\x1b[0m`);
console.log(`\x1b[32mPASSED: ${passedCount}\x1b[0m`);
console.log(`\x1b[31mFAILED: ${failedCount}\x1b[0m`);
console.log('\x1b[1m\x1b[36m==============================================================\x1b[0m\n');

if (failedCount > 0) {
  console.log('\x1b[31mVERDICT: CHALLENGE (Failures detected)\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32mVERDICT: CONFIRMED (All stress & adversarial tests passed)\x1b[0m');
  process.exit(0);
}
