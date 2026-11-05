// tests/stress_m3_qr_poster.js - Empirical Challenger Stress Test Suite for Milestone M3 (R5 / F10, F11)
// Rigorous adversarial stress tests for QR Poster Modal and Non-Destructive Printing

import assert from 'node:assert';
import { store } from '../js/store.js';
import { QRGenerator } from '../js/qr-generator.js';
import { renderCatalogShareView } from '../js/views/catalogShareView.js';

// Comprehensive Headless Browser DOM Simulator
class DOMElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.children = [];
    this.parentNode = null;
    this.eventListeners = {};
    this._value = attributes.value || '';
    this._src = attributes.src || '';
    this._classList = new Set();
    this.style = {};

    if (attributes.id) this.id = attributes.id;
    if (attributes.class) {
      attributes.class.split(/\s+/).filter(Boolean).forEach(c => this._classList.add(c));
    }
  }

  get value() { return this._value; }
  set value(v) { this._value = String(v ?? ''); }

  get src() { return this._src; }
  set src(v) { this._src = String(v ?? ''); }

  get classList() {
    const self = this;
    return {
      add(...classes) {
        classes.forEach(c => c && self._classList.add(c));
      },
      remove(...classes) {
        classes.forEach(c => self._classList.delete(c));
      },
      contains(cls) {
        return self._classList.has(cls);
      },
      toggle(cls) {
        if (self._classList.has(cls)) {
          self._classList.delete(cls);
          return false;
        } else {
          self._classList.add(cls);
          return true;
        }
      },
      toString() {
        return Array.from(self._classList).join(' ');
      }
    };
  }

  getAttribute(name) {
    if (name === 'class') return this.classList.toString();
    if (name === 'id') return this.id || null;
    if (name === 'src') return this.src || null;
    if (name === 'value') return this.value || null;
    return this.attributes[name] ?? null;
  }

  setAttribute(name, value) {
    const strVal = String(value);
    this.attributes[name] = strVal;
    if (name === 'id') this.id = strVal;
    if (name === 'src') this.src = strVal;
    if (name === 'value') this.value = strVal;
    if (name === 'class') {
      this._classList.clear();
      strVal.split(/\s+/).filter(Boolean).forEach(c => this._classList.add(c));
    }
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'id') delete this.id;
    if (name === 'src') this._src = '';
    if (name === 'value') this._value = '';
    if (name === 'class') this._classList.clear();
  }

  hasAttribute(name) {
    if (name === 'id') return !!this.id;
    if (name === 'src') return !!this.src;
    return name in this.attributes;
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

  addEventListener(type, listener) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (this.eventListeners[type]) {
      this.eventListeners[type] = this.eventListeners[type].filter(l => l !== listener);
    }
  }

  dispatchEvent(event) {
    const type = typeof event === 'string' ? event : event.type;
    const evtObj = typeof event === 'string' ? { type, target: this, stopPropagation: () => {} } : event;
    if (!evtObj.target) evtObj.target = this;
    if (!evtObj.stopPropagation) evtObj.stopPropagation = () => { evtObj._stopped = true; };

    const listeners = (this.eventListeners[type] || []).slice();
    for (const fn of listeners) {
      fn(evtObj);
    }

    if (this.parentNode && !evtObj._stopped) {
      this.parentNode.dispatchEvent(evtObj);
    }
    return true;
  }

  click() {
    this.dispatchEvent({ type: 'click', target: this, stopPropagation() { this._stopped = true; } });
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const matchFn = (node) => {
      if (selector.startsWith('#')) {
        return node.id === selector.slice(1);
      }
      if (selector.startsWith('.')) {
        return node.classList.contains(selector.slice(1));
      }
      return node.tagName === selector.toUpperCase();
    };

    const walk = (node) => {
      for (const child of node.children) {
        if (matchFn(child)) results.push(child);
        walk(child);
      }
    };

    walk(this);
    return results;
  }

  get innerHTML() {
    return this._rawHTML || '';
  }

  set innerHTML(html) {
    this._rawHTML = html;
    this.children = [];
    this.parseChildren(html);
  }

  parseChildren(html) {
    if (!html || typeof html !== 'string') return;
    const tagRegex = /<([a-zA-Z0-9\-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9\-]+)([^>]*?)\/?>/g;
    let match;
    while ((match = tagRegex.exec(html)) !== null) {
      const tagName = match[1] || match[4];
      const rawAttrs = match[2] || match[5] || '';
      const innerContent = match[3] || '';

      const attrs = {};
      const attrRegex = /([a-zA-Z0-9\-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let m;
      while ((m = attrRegex.exec(rawAttrs)) !== null) {
        attrs[m[1]] = m[2] ?? m[3] ?? m[4] ?? '';
      }

      const child = new DOMElement(tagName, attrs);
      if (attrs.src) child.src = attrs.src;
      if (attrs.value) child.value = attrs.value;

      if (innerContent && innerContent.includes('<')) {
        child.innerHTML = innerContent;
      } else if (innerContent) {
        child._innerText = innerContent.trim();
      }

      this.appendChild(child);
    }
  }
}

// Global Document & Window Simulator
class DocumentSimulator {
  constructor() {
    this.body = new DOMElement('body');
    this.eventListeners = {};
  }

  createElement(tagName) {
    const el = new DOMElement(tagName);
    if (tagName.toLowerCase() === 'iframe') {
      const doc = {
        _written: '',
        open() { this._written = ''; },
        write(c) { this._written += c; },
        close() {}
      };
      el.contentDocument = doc;
      el.contentWindow = {
        document: doc,
        focusCalled: false,
        printCalled: false,
        focus() { this.focusCalled = true; },
        print() { this.printCalled = true; }
      };
    }
    return el;
  }

  getElementById(id) {
    return this.body.querySelector('#' + id);
  }

  querySelector(selector) {
    if (selector.startsWith('#')) return this.getElementById(selector.slice(1));
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  addEventListener(type, fn) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(fn);
  }

  removeEventListener(type, fn) {
    if (this.eventListeners[type]) {
      this.eventListeners[type] = this.eventListeners[type].filter(f => f !== fn);
    }
  }

  dispatchEvent(evt) {
    const type = typeof evt === 'string' ? evt : evt.type;
    const evtObj = typeof evt === 'string' ? { type, target: this } : evt;
    const listeners = (this.eventListeners[type] || []).slice();
    for (const fn of listeners) {
      fn(evtObj);
    }
    return true;
  }
}

// Global Environment Setup
const simDoc = new DocumentSimulator();
globalThis.document = simDoc;
globalThis.window = {
  document: simDoc,
  location: {
    origin: 'https://example.com',
    pathname: '/app/index.html',
    hash: '#catalogo'
  },
  navigator: {
    clipboard: {
      _text: '',
      writeText(t) {
        this._text = t;
        return Promise.resolve();
      }
    }
  },
  alert(msg) { this._lastAlert = msg; },
  print() { this._windowPrintCalled = true; },
  _windowPrintCalled: false,
  _lastAlert: null,
  __qrPosterEscapeHandler: null
};

// Global alert mock
globalThis.alert = (msg) => { window.alert(msg); };

// Test Metrics
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails = [];

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failureDetails.push({ name, error: err });
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    failureDetails.push({ name, error: err });
  }
}

async function main() {
  console.log('================================================================');
  console.log('   🔥 EMPIRICAL STRESS TEST SUITE — QR POSTER (M3 / R5 / F10-F11)  ');
  console.log('================================================================\n');

  // -----------------------------------------------------------------------------
  // SUITE 1: DOM Hierarchy, Accessibility & Design Contract (F10)
  // -----------------------------------------------------------------------------
  console.log('▶ SUITE 1: DOM Hierarchy, Accessibility & Design Contract');

  const container1 = new DOMElement('div');
  simDoc.body.appendChild(container1);
  renderCatalogShareView(container1);

  runTest('S1-01: QR poster modal exists with role="dialog" and aria-modal="true"', () => {
    const modal = container1.querySelector('#qrPosterModal');
    assert.ok(modal, '#qrPosterModal must exist');
    assert.strictEqual(modal.getAttribute('role'), 'dialog');
    assert.strictEqual(modal.getAttribute('aria-modal'), 'true');
    assert.strictEqual(modal.getAttribute('aria-labelledby'), 'qrPosterTitle');
  });

  runTest('S1-02: Modal starts hidden by default (has "hidden" class)', () => {
    const modal = container1.querySelector('#qrPosterModal');
    assert.ok(modal.classList.contains('hidden'), 'Modal must have "hidden" class initially');
  });

  runTest('S1-03: Close button exists with accessible aria-label', () => {
    const closeBtn = container1.querySelector('#closeQrPosterModal');
    assert.ok(closeBtn, '#closeQrPosterModal must exist');
    assert.strictEqual(closeBtn.getAttribute('aria-label'), 'Cerrar cartel');
  });

  runTest('S1-04: Poster preview contains Sweet Smile branding and instructions', () => {
    const preview = container1.querySelector('#qrPosterPreview');
    assert.ok(preview, '#qrPosterPreview must exist');
    const modalImg = container1.querySelector('#modalQrImg');
    assert.ok(modalImg, '#modalQrImg must exist');
    assert.strictEqual(modalImg.getAttribute('alt'), 'Código QR Catálogo');
    assert.ok(container1.innerHTML.includes('🍰 Sweet Smile Pastry'));
    assert.ok(container1.innerHTML.includes('Repostería Artesanal & Café'));
    assert.ok(container1.innerHTML.includes('¡Escanea para ver nuestro Catálogo!'));
    assert.ok(container1.innerHTML.includes('Haz tu pedido directo a nuestro WhatsApp'));
  });

  runTest('S1-05: Modal contains Cerrar and Imprimir Cartel action buttons', () => {
    const cancelBtn = container1.querySelector('#btnCancelQrPoster');
    const printBtn = container1.querySelector('#btnExecutePrintPoster');
    assert.ok(cancelBtn, '#btnCancelQrPoster must exist');
    assert.ok(printBtn, '#btnExecutePrintPoster must exist');
  });

  runTest('S1-06: @media print CSS rules exist and isolate #qrPosterModal', () => {
    assert.ok(container1.innerHTML.includes('@media print'));
    assert.ok(container1.innerHTML.includes('#qrPosterModal'));
    assert.ok(container1.innerHTML.includes('#qrPosterPreview'));
  });

  // -----------------------------------------------------------------------------
  // SUITE 2: Multi-Path Modal Dismissal & Rapid Cycling Stress (F10)
  // -----------------------------------------------------------------------------
  console.log('\n▶ SUITE 2: Multi-Path Modal Dismissal & Rapid Cycling Stress');

  const modal = container1.querySelector('#qrPosterModal');
  const openBtn = container1.querySelector('#btnPrintQrPoster');
  const closeBtn = container1.querySelector('#closeQrPosterModal');
  const cancelBtn = container1.querySelector('#btnCancelQrPoster');

  runTest('S2-01: Triggering #btnPrintQrPoster opens the modal', () => {
    openBtn.click();
    assert.strictEqual(modal.classList.contains('hidden'), false, 'Modal should not be hidden after open');
  });

  runTest('S2-02: Clicking (X) #closeQrPosterModal closes the modal', () => {
    closeBtn.click();
    assert.strictEqual(modal.classList.contains('hidden'), true, 'Modal should be hidden after close click');
  });

  runTest('S2-03: Re-opening and clicking "Cerrar" #btnCancelQrPoster closes modal', () => {
    openBtn.click();
    assert.strictEqual(modal.classList.contains('hidden'), false);
    cancelBtn.click();
    assert.strictEqual(modal.classList.contains('hidden'), true);
  });

  runTest('S2-04: Clicking backdrop overlay closes modal', () => {
    openBtn.click();
    assert.strictEqual(modal.classList.contains('hidden'), false);
    modal.dispatchEvent({ type: 'click', target: modal });
    assert.strictEqual(modal.classList.contains('hidden'), true);
  });

  runTest('S2-05: Clicking inside modal card does NOT close modal', () => {
    openBtn.click();
    assert.strictEqual(modal.classList.contains('hidden'), false);
    const card = modal.children[0];
    assert.ok(card, 'Modal card child element should exist');
    modal.dispatchEvent({ type: 'click', target: card });
    assert.strictEqual(modal.classList.contains('hidden'), false, 'Modal must remain open when card clicked');
    cancelBtn.click();
  });

  runTest('S2-06: 1,000 rapid open-close cycles stress test', () => {
    const t0 = Date.now();
    for (let i = 0; i < 1000; i++) {
      openBtn.click();
      assert.strictEqual(modal.classList.contains('hidden'), false, `Cycle ${i} failed to open`);

      const method = i % 3;
      if (method === 0) {
        closeBtn.click();
      } else if (method === 1) {
        cancelBtn.click();
      } else {
        modal.dispatchEvent({ type: 'click', target: modal });
      }
      assert.strictEqual(modal.classList.contains('hidden'), true, `Cycle ${i} failed to close via method ${method}`);
    }
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 2000, `1000 cycles completed in ${elapsed}ms (within 2s bound)`);
  });

  // -----------------------------------------------------------------------------
  // SUITE 3: Keyboard Escape Handler & Navigation Stress (F10)
  // -----------------------------------------------------------------------------
  console.log('\n▶ SUITE 3: Keyboard Escape Handler & Navigation Stress');

  runTest('S3-01: Pressing Escape key closes open modal', () => {
    openBtn.click();
    assert.strictEqual(modal.classList.contains('hidden'), false);
    simDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.strictEqual(modal.classList.contains('hidden'), true, 'Escape must hide modal');
  });

  runTest('S3-02: Pressing Escape when already closed causes no error and remains closed', () => {
    assert.strictEqual(modal.classList.contains('hidden'), true);
    for (let i = 0; i < 100; i++) {
      simDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
    }
    assert.strictEqual(modal.classList.contains('hidden'), true);
  });

  runTest('S3-03: Non-Escape keys (Enter, Space, Tab, Arrow) do NOT close modal', () => {
    openBtn.click();
    const keys = ['Enter', ' ', 'Tab', 'ArrowDown', 'ArrowUp', 'Backspace', 'Shift', 'Control', 'a', 'x'];
    for (const k of keys) {
      simDoc.dispatchEvent({ type: 'keydown', key: k });
      assert.strictEqual(modal.classList.contains('hidden'), false, `Key "${k}" should not close modal`);
    }
    simDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.strictEqual(modal.classList.contains('hidden'), true);
  });

  runTest('S3-04: 1,000 rapid Escape key stress cycles', () => {
    for (let i = 0; i < 1000; i++) {
      openBtn.click();
      simDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
      assert.strictEqual(modal.classList.contains('hidden'), true, `Escape cycle ${i} failed`);
    }
  });

  runTest('S3-05: Modal dismissal preserves route hash and path without reload', () => {
    const initialHash = window.location.hash;
    const initialPath = window.location.pathname;

    openBtn.click();
    cancelBtn.click();

    assert.strictEqual(window.location.hash, initialHash, 'Hash must not change');
    assert.strictEqual(window.location.pathname, initialPath, 'Path must not change');
  });

  // -----------------------------------------------------------------------------
  // SUITE 4: Safe Non-Destructive Print Execution (F11)
  // -----------------------------------------------------------------------------
  console.log('\n▶ SUITE 4: Safe Non-Destructive Print Execution');

  await runAsyncTest('S4-01: Clicking #btnExecutePrintPoster generates isolated hidden iframe', async () => {
    const executeBtn = container1.querySelector('#btnExecutePrintPoster');
    assert.ok(executeBtn, '#btnExecutePrintPoster must exist');

    const modalImg = container1.querySelector('#modalQrImg');
    modalImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=https%3A%2F%2Fexample.com';

    executeBtn.click();

    const printFrame = simDoc.getElementById('qrPrintFrame');
    assert.ok(printFrame, '#qrPrintFrame iframe must be added to document');
    assert.strictEqual(printFrame.style.visibility, 'hidden');
    assert.strictEqual(printFrame.style.width, '0');
    assert.strictEqual(printFrame.style.height, '0');
    assert.strictEqual(printFrame.style.position, 'fixed');

    const content = printFrame.contentDocument._written;
    assert.ok(content.includes('<!DOCTYPE html>'));
    assert.ok(content.includes('Cartel QR - Sweet Smile Pastry'));
    assert.ok(content.includes('🍰 Sweet Smile Pastry'));
    assert.ok(content.includes('Repostería Artesanal & Café'));
    assert.ok(content.includes('Haz tu pedido directo a nuestro WhatsApp'));
    assert.ok(content.includes(modalImg.src));

    await new Promise(r => setTimeout(r, 300));
    assert.strictEqual(printFrame.contentWindow.focusCalled, true, 'iframe contentWindow.focus() called');
    assert.strictEqual(printFrame.contentWindow.printCalled, true, 'iframe contentWindow.print() called');
  });

  runTest('S4-02: 50 rapid print clicks reuses existing frame and does not leak iframes', () => {
    const executeBtn = container1.querySelector('#btnExecutePrintPoster');
    for (let i = 0; i < 50; i++) {
      executeBtn.click();
    }

    const iframes = simDoc.body.querySelectorAll('iframe');
    assert.strictEqual(iframes.length, 1, 'Exactly 1 #qrPrintFrame must exist, no iframe pollution');
  });

  await runAsyncTest('S4-03: Print fallback when iframe contentWindow.print() throws', async () => {
    const executeBtn = container1.querySelector('#btnExecutePrintPoster');
    const printFrame = simDoc.getElementById('qrPrintFrame');

    printFrame.contentWindow.print = () => {
      throw new Error('Native print unavailable in WebView');
    };
    window._windowPrintCalled = false;

    executeBtn.click();
    await new Promise(r => setTimeout(r, 300));

    assert.strictEqual(window._windowPrintCalled, true, 'window.print() must be called as graceful fallback');
  });

  runTest('S4-04: Print with missing QR URL aborts cleanly without throwing', () => {
    const modalImg = container1.querySelector('#modalQrImg');
    const qrImg = container1.querySelector('#qrImageElement');
    const prevModalSrc = modalImg.src;
    const prevQrSrc = qrImg.src;

    modalImg.src = '';
    qrImg.src = '';

    const executeBtn = container1.querySelector('#btnExecutePrintPoster');
    let threw = false;
    try {
      executeBtn.click();
    } catch (e) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Must not throw when QR URL is empty');

    modalImg.src = prevModalSrc;
    qrImg.src = prevQrSrc;
  });

  // -----------------------------------------------------------------------------
  // SUITE 5: Special Characters, Encoding & Adversarial Data Inputs
  // -----------------------------------------------------------------------------
  console.log('\n▶ SUITE 5: Special Characters, Encoding & Adversarial Data Inputs');

  const testUrls = [
    { name: 'Standard URL', url: 'https://pocapox.github.io/sweet-smile/catalog.html' },
    { name: 'Query params with percent encoding', url: 'https://example.com/catalog.html?ref=insta&discount=20%25&tag=cake' },
    { name: 'Spanish accents and special chars', url: 'https://dulcesonrisa.com/catálogo-español/repostería-fina?año=2026' },
    { name: 'Emojis in path and params', url: 'https://sweet.smile/🍰/catálogo?item=🎂&heart=❤️' },
    { name: 'XSS script injection attempt', url: 'https://example.com/catalog.html?x="><script>alert(1)</script>' },
    { name: 'Image onerror injection attempt', url: 'https://example.com/catalog.html"><img src=x onerror=alert(1)>' },
    { name: 'Quotes, apostrophes, and brackets', url: 'https://example.com/catalog\'s-list["best"]' },
    { name: 'Very long URL (2,000 chars)', url: 'https://example.com/catalog.html?' + 'param='.repeat(250) + 'test' },
    { name: 'Empty string', url: '' }
  ];

  for (const { name, url } of testUrls) {
    runTest(`S5-URL: ${name}`, () => {
      const qrData = QRGenerator.generateQRDataUrl(url, 260);
      assert.ok(qrData.startsWith('https://api.qrserver.com/v1/create-qr-code/?size=260x260&data='));
      assert.strictEqual(qrData.includes('<script>'), false, 'QR URL must not contain raw script tags');
      assert.strictEqual(qrData.includes('onerror='), false, 'QR URL must encode onerror attribute');

      const input = container1.querySelector('#cfgCatalogUrl');
      input.value = url;
      input.dispatchEvent({ type: 'input', target: input });

      const qrImg = container1.querySelector('#qrImageElement');
      const modalQrImg = container1.querySelector('#modalQrImg');

      assert.strictEqual(qrImg.src, qrData, 'Inline QR src must update');
      assert.strictEqual(modalQrImg.src, qrData, 'Modal QR src must synchronize');

      openBtn.click();
      assert.strictEqual(modalQrImg.src, qrData);
      cancelBtn.click();
    });
  }

  // -----------------------------------------------------------------------------
  // SUITE 6: Multi-Render Memory Leak & Event Listener Hygiene
  // -----------------------------------------------------------------------------
  console.log('\n▶ SUITE 6: Multi-Render Memory Leak & Event Listener Hygiene');

  runTest('S6-01: Re-rendering catalogShareView 100 times cleans prior Escape listeners', () => {
    // Replace active main container, modeling App.handleRoute behavior
    simDoc.body.removeChild(container1);
    const containerIter = new DOMElement('div');
    simDoc.body.appendChild(containerIter);

    for (let i = 0; i < 100; i++) {
      renderCatalogShareView(containerIter);
    }

    const keydownListeners = simDoc.eventListeners['keydown'] || [];
    assert.strictEqual(keydownListeners.length, 1, 'Exactly 1 Escape listener must remain on document');

    const lastModal = containerIter.querySelector('#qrPosterModal');
    const lastOpenBtn = containerIter.querySelector('#btnPrintQrPoster');

    lastOpenBtn.click();
    assert.strictEqual(lastModal.classList.contains('hidden'), false);

    simDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.strictEqual(lastModal.classList.contains('hidden'), true);
  });

  runTest('S6-02: Escape key press when view is unmounted causes no error', () => {
    simDoc.body.children = [];
    const blankContainer = new DOMElement('div');
    blankContainer.innerHTML = '<div id="dashboardView">Dashboard Content</div>';
    simDoc.body.appendChild(blankContainer);

    let threw = false;
    try {
      simDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
    } catch (err) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Escape when modal not in DOM must not throw');
  });

  // -----------------------------------------------------------------------------
  // SUITE 7: WhatsApp Number Config & Store Synchronization
  // -----------------------------------------------------------------------------
  console.log('\n▶ SUITE 7: WhatsApp Number Config & Store Synchronization');

  runTest('S7-01: Saving WhatsApp number updates store settings', () => {
    const freshContainer = new DOMElement('div');
    simDoc.body.appendChild(freshContainer);
    renderCatalogShareView(freshContainer);

    const phoneInput = freshContainer.querySelector('#cfgWhatsappNumber');
    const saveBtn = freshContainer.querySelector('#btnSaveWhatsapp');

    phoneInput.value = '+18095559876';
    saveBtn.click();

    const settings = store.getSettings();
    assert.strictEqual(settings.whatsappNumber, '+18095559876');
    assert.strictEqual(window._lastAlert, '¡Número de WhatsApp guardado con éxito!');
  });

  runTest('S7-02: Empty WhatsApp input does not overwrite valid number', () => {
    const freshContainer = new DOMElement('div');
    renderCatalogShareView(freshContainer);

    const phoneInput = freshContainer.querySelector('#cfgWhatsappNumber');
    const saveBtn = freshContainer.querySelector('#btnSaveWhatsapp');

    phoneInput.value = '   ';
    window._lastAlert = null;
    saveBtn.click();

    const settings = store.getSettings();
    assert.strictEqual(settings.whatsappNumber, '+18095559876', 'Must retain previous value');
    assert.strictEqual(window._lastAlert, null, 'Must not alert success for empty input');
  });

  // -----------------------------------------------------------------------------
  // SUITE 8: Nested Click Bubbling & Event Target Precision
  // -----------------------------------------------------------------------------
  console.log('\n▶ SUITE 8: Nested Click Bubbling & Event Target Precision');

  runTest('S8-01: Clicking icon span inside close button bubbles and closes modal', () => {
    const bubbleContainer = new DOMElement('div');
    simDoc.body.appendChild(bubbleContainer);
    renderCatalogShareView(bubbleContainer);

    const m = bubbleContainer.querySelector('#qrPosterModal');
    const open = bubbleContainer.querySelector('#btnPrintQrPoster');
    const closeBtn = bubbleContainer.querySelector('#closeQrPosterModal');
    const iconSpan = closeBtn.children[0];

    open.click();
    assert.strictEqual(m.classList.contains('hidden'), false);

    // Click on icon span inside button, bubbles to button
    iconSpan.click();
    assert.strictEqual(m.classList.contains('hidden'), true, 'Clicking span in close button must close modal');
  });

  runTest('S8-02: Clicking preview image, titles, or text does NOT close modal', () => {
    const bubbleContainer = new DOMElement('div');
    simDoc.body.appendChild(bubbleContainer);
    renderCatalogShareView(bubbleContainer);

    const m = bubbleContainer.querySelector('#qrPosterModal');
    const open = bubbleContainer.querySelector('#btnPrintQrPoster');
    const preview = bubbleContainer.querySelector('#qrPosterPreview');

    open.click();
    assert.strictEqual(m.classList.contains('hidden'), false);

    // Click elements inside preview
    for (const child of preview.children) {
      m.dispatchEvent({ type: 'click', target: child });
      assert.strictEqual(m.classList.contains('hidden'), false, 'Clicking inside preview must not close modal');
    }
  });

  // -----------------------------------------------------------------------------
  // SUITE 9: Null/Undefined/Falsy Store Settings Resiliency
  // -----------------------------------------------------------------------------
  console.log('\n▶ SUITE 9: Null/Undefined/Falsy Store Settings Resiliency');

  runTest('S9-01: Falsy settings.githubPagesUrl defaults safely to currentCatalogUrl', () => {
    store.updateSettings({ githubPagesUrl: '' });
    const nullContainer = new DOMElement('div');
    simDoc.body.appendChild(nullContainer);
    renderCatalogShareView(nullContainer);

    const qrImg = nullContainer.querySelector('#qrImageElement');
    assert.ok(qrImg.src.includes('catalog.html'), 'Must fall back to catalog.html');
    assert.strictEqual(qrImg.src.includes('undefined'), false, 'Must not contain string "undefined"');
    assert.strictEqual(qrImg.src.includes('null'), false, 'Must not contain string "null"');
  });

  // -----------------------------------------------------------------------------
  // SUITE 10: Fault Injection & Graceful Error Handling
  // -----------------------------------------------------------------------------
  console.log('\n▶ SUITE 10: Fault Injection & Graceful Error Handling');

  runTest('S10-01: attachCatalogShareEvents survives missing optional DOM elements', () => {
    const brokenContainer = new DOMElement('div');
    // Minimal HTML missing modal and QR elements
    brokenContainer.innerHTML = '<div>No buttons here</div>';

    let threw = false;
    try {
      renderCatalogShareView(brokenContainer);
    } catch (err) {
      threw = true;
    }
    assert.strictEqual(threw, false, 'Must not throw if elements are missing or altered');
  });

  // -----------------------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`   STRESS TEST RESULTS: ${passedTests}/${totalTests} PASSED (${failedTests} FAILED)`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error('\nFAILED TESTS:');
    failureDetails.forEach(f => console.error(` - ${f.name}: ${f.error.message}`));
    process.exit(1);
  } else {
    console.log('\n🎉 ALL EMPIRICAL STRESS TESTS PASSED WITH ZERO FAILURES!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
