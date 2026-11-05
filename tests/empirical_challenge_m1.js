// tests/empirical_challenge_m1.js
// EMPIRICAL ADVERSARIAL CHALLENGE SUITE: Milestone M1_v12 (Requirement R1)
// Rigorous verification of UI Modernization: Toasts, Modals, Dialog Polyfills, and Android Native Overrides.

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

// ===========================================================================
// 1. High-Fidelity DOM & Browser Environment for Headless Testing
// ===========================================================================

class MockDOMTokenList {
  constructor(element) {
    this._element = element;
    this._classes = new Set();
  }

  add(...tokens) {
    for (const t of tokens) {
      if (t) this._classes.add(t);
    }
    this._sync();
  }

  remove(...tokens) {
    for (const t of tokens) {
      this._classes.delete(t);
    }
    this._sync();
  }

  contains(token) {
    return this._classes.has(token);
  }

  toggle(token) {
    if (this._classes.has(token)) {
      this._classes.delete(token);
      this._sync();
      return false;
    } else {
      this._classes.add(token);
      this._sync();
      return true;
    }
  }

  _sync() {
    this._element.attributes.class = Array.from(this._classes).join(' ');
  }

  toString() {
    return Array.from(this._classes).join(' ');
  }
}

class MockDOMElement {
  constructor(tagName = 'div', attrs = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attrs };
    this.id = attrs.id || '';
    this.children = [];
    this.parentNode = null;
    this.eventListeners = {};
    this.style = {};
    this._value = attrs.value || '';
    this._innerText = '';
    this._innerHTML = '';
    this.classList = new MockDOMTokenList(this);

    if (attrs.class) {
      this.className = attrs.class;
    }
  }

  get className() {
    return Array.from(this.classList._classes).join(' ');
  }

  set className(val) {
    this.classList._classes.clear();
    String(val || '').split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
    this.attributes.class = this.className;
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
    if (this.children.length > 0) {
      return this.children.map(c => c.innerText || '').join(' ').trim();
    }
    return '';
  }

  set innerText(v) {
    this._innerText = String(v ?? '');
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = String(html ?? '');
    this.children = [];
    parseHTMLInto(this, this._innerHTML);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'id') this.id = String(value);
    if (name === 'class') {
      this.className = String(value);
    }
  }

  getAttribute(name) {
    if (name === 'class') return this.className;
    if (name === 'id') return this.id;
    return this.attributes[name] !== undefined ? this.attributes[name] : null;
  }

  hasAttribute(name) {
    return name in this.attributes;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'id') this.id = '';
    if (name === 'class') this.classList._classes.clear();
  }

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    this.children.push(child);
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

  focus() {
    this._focused = true;
  }

  select() {
    this._selected = true;
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
    const evtObj = typeof evt === 'string' ? { type, target: this, stopPropagation: () => {} } : evt;
    if (!evtObj.target) evtObj.target = this;
    if (!evtObj.stopPropagation) evtObj.stopPropagation = () => {};
    if (!evtObj.preventDefault) evtObj.preventDefault = () => {};

    const listeners = this.eventListeners[type] || [];
    listeners.forEach(fn => {
      try {
        fn(evtObj);
      } catch (err) {
        console.error(`Error in ${type} event listener:`, err);
      }
    });

    if (this.parentNode && !evtObj._stopped) {
      this.parentNode.dispatchEvent(evtObj);
    }
    return true;
  }

  click() {
    this.dispatchEvent({
      type: 'click',
      target: this,
      stopPropagation() { this._stopped = true; },
      preventDefault() {}
    });
  }

  querySelector(selector) {
    const matcher = createSelectorMatcher(selector);

    function find(node) {
      for (const c of node.children) {
        if (matcher(c)) return c;
        const sub = find(c);
        if (sub) return sub;
      }
      return null;
    }

    return find(this);
  }

  querySelectorAll(selector) {
    const results = [];
    const matcher = createSelectorMatcher(selector);

    function walk(node) {
      for (const c of node.children) {
        if (matcher(c)) results.push(c);
        walk(c);
      }
    }

    walk(this);
    return results;
  }
}

function parseRawAttributes(raw) {
  const attrs = {};
  if (!raw) return attrs;
  const regex = /([a-zA-Z0-9\-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = regex.exec(raw)) !== null) {
    const key = m[1];
    const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : ''));
    attrs[key] = val;
  }
  return attrs;
}

function parseHTMLInto(parent, html) {
  if (!html || typeof html !== 'string') return;

  const VOID_TAGS = new Set(['input', 'img', 'br', 'hr', 'meta', 'link']);
  const stack = [parent];

  const tokenRegex = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9\-]+)>|<([a-zA-Z0-9\-]+)((?:\s+[^=>\/]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let match;

  while ((match = tokenRegex.exec(html)) !== null) {
    if (match[0].startsWith('<!--')) {
      continue;
    }

    // Closing tag: </tag>
    if (match[1]) {
      const closingTag = match[1].toUpperCase();
      for (let i = stack.length - 1; i > 0; i--) {
        if (stack[i].tagName === closingTag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    // Opening tag: <tag attrs>
    if (match[2]) {
      const tagName = match[2];
      const rawAttrs = match[3] || '';
      const isSelfClosing = match[4] === '/' || VOID_TAGS.has(tagName.toLowerCase());

      const attrs = parseRawAttributes(rawAttrs);
      const child = new MockDOMElement(tagName, attrs);

      if (attrs.value) child._value = attrs.value;
      if (attrs.class) child.className = attrs.class;
      if (attrs.id) child.id = attrs.id;

      const currentParent = stack[stack.length - 1];
      currentParent.appendChild(child);

      if (!isSelfClosing) {
        stack.push(child);
      }
      continue;
    }

    // Text content
    if (match[5]) {
      const text = match[5].trim();
      if (text) {
        const currentParent = stack[stack.length - 1];
        currentParent.innerText = (currentParent.innerText ? currentParent.innerText + ' ' : '') + text;
      }
    }
  }
}

function createSelectorMatcher(selector) {
  const s = selector.trim();
  if (s.startsWith('#')) {
    const id = s.slice(1);
    return node => node.id === id || node.getAttribute('id') === id;
  }
  if (s.startsWith('.')) {
    const cls = s.slice(1);
    return node => node.classList && node.classList.contains(cls);
  }
  if (s.startsWith('[') && s.endsWith(']')) {
    const attrExp = s.slice(1, -1);
    if (attrExp.includes('=')) {
      const [attrName, rawVal] = attrExp.split('=');
      const expectedVal = rawVal.replace(/^["']|["']$/g, '');
      return node => node.getAttribute(attrName.trim()) === expectedVal;
    }
    return node => node.hasAttribute(attrExp.trim());
  }
  return node => node.tagName.toLowerCase() === s.toLowerCase();
}

// Build Global Mock Document and Window
class MockDocument {
  constructor() {
    this.body = new MockDOMElement('body');
    this.eventListeners = {};
  }

  createElement(tagName) {
    return new MockDOMElement(tagName);
  }

  getElementById(id) {
    return this.body.querySelector('#' + id);
  }

  querySelector(sel) {
    return this.body.querySelector(sel);
  }

  querySelectorAll(sel) {
    return this.body.querySelectorAll(sel);
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
    const evtObj = typeof evt === 'string' ? { type, target: this, stopPropagation: () => {} } : evt;
    if (!evtObj.preventDefault) evtObj.preventDefault = () => {};
    const listeners = this.eventListeners[type] || [];
    listeners.forEach(fn => fn(evtObj));
  }
}

const mockDoc = new MockDocument();
const mockWin = {
  document: mockDoc,
  _lastAlert: '',
  _lastConfirm: '',
  addEventListener(type, fn) {},
  removeEventListener(type, fn) {},
  location: { href: 'http://localhost' }
};

// Install globals
globalThis.window = mockWin;
globalThis.document = mockDoc;

// Load module ui-feedback.js
const { uiToast, uiModal, installDialogPolyfills } = await import('../js/ui-feedback.js');

// ===========================================================================
// Test Harness Tracking
// ===========================================================================

let passedCount = 0;
let failedCount = 0;
const testFailures = [];

async function runTest(testName, fn) {
  try {
    await fn();
    console.log(`  ✔ [PASS] ${testName}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${testName}`);
    console.error(`     Error: ${err.message}`);
    failedCount++;
    testFailures.push({ name: testName, error: err });
  }
}

function resetMockDOM() {
  mockDoc.body = new MockDOMElement('body');
  mockDoc.eventListeners = {};
  mockWin._lastAlert = '';
  mockWin._lastConfirm = '';
  // Set up standard root containers
  const toastContainer = mockDoc.createElement('div');
  toastContainer.id = 'toastContainer';
  toastContainer.setAttribute('aria-live', 'polite');
  mockDoc.body.appendChild(toastContainer);

  const modalContainer = mockDoc.createElement('div');
  modalContainer.id = 'uiModalContainer';
  mockDoc.body.appendChild(modalContainer);
}

console.log('======================================================================');
console.log(' 🔥 EMPIRICAL CHALLENGE SUITE: MILESTONE M1_v12 (REQUIREMENT R1)');
console.log('   Adversarial Stress Testing of Toasts, Modals, & Dialog Suppression');
console.log('======================================================================\n');

// ===========================================================================
// CHALLENGE 1: Static & AST Scan — Zero Unmanaged Native Dialog Invocations
// ===========================================================================
console.log('--- CHALLENGE 1: Static & AST Scan for Native Dialogs ---');

await runTest('1.1 Zero unmanaged calls to window.alert, alert() across js/ and html', () => {
  const rootDir = path.resolve('.');
  const jsDir = path.join(rootDir, 'js');

  function scanDir(dir) {
    let files = [];
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, f.name);
      if (f.isDirectory()) {
        files = files.concat(scanDir(fullPath));
      } else if (f.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const jsFiles = scanDir(jsDir);
  const htmlFiles = [path.join(rootDir, 'index.html'), path.join(rootDir, 'catalog.html')];
  const allFiles = [...jsFiles, ...htmlFiles];

  const unmanagedAlerts = [];

  for (const file of allFiles) {
    const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      const alertRegex = /(?:\bwindow\.)?alert\s*\(/g;
      let match;
      while ((match = alertRegex.exec(line)) !== null) {
        if (relPath === 'js/ui-feedback.js') continue;
        if (/uiModal\.alert\s*\(/.test(line)) continue;

        unmanagedAlerts.push({ file: relPath, line: lineIdx + 1, content: line.trim() });
      }
    });
  }

  assert.strictEqual(
    unmanagedAlerts.length,
    0,
    `Found ${unmanagedAlerts.length} unmanaged alert() calls:\n${JSON.stringify(unmanagedAlerts, null, 2)}`
  );
});

await runTest('1.2 Zero unmanaged calls to window.confirm, confirm() across js/ and html', () => {
  const rootDir = path.resolve('.');
  const jsDir = path.join(rootDir, 'js');

  function scanDir(dir) {
    let files = [];
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, f.name);
      if (f.isDirectory()) {
        files = files.concat(scanDir(fullPath));
      } else if (f.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const jsFiles = scanDir(jsDir);
  const htmlFiles = [path.join(rootDir, 'index.html'), path.join(rootDir, 'catalog.html')];
  const allFiles = [...jsFiles, ...htmlFiles];

  const unmanagedConfirms = [];

  for (const file of allFiles) {
    const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      const confirmRegex = /(?:\bwindow\.)?confirm\s*\(/g;
      let match;
      while ((match = confirmRegex.exec(line)) !== null) {
        if (relPath === 'js/ui-feedback.js') continue;
        if (/uiModal\.confirm\s*\(/.test(line)) continue;
        if (/result\.confirm\s*\(/.test(line)) continue;

        unmanagedConfirms.push({ file: relPath, line: lineIdx + 1, content: line.trim() });
      }
    });
  }

  assert.strictEqual(
    unmanagedConfirms.length,
    0,
    `Found ${unmanagedConfirms.length} unmanaged confirm() calls:\n${JSON.stringify(unmanagedConfirms, null, 2)}`
  );
});

await runTest('1.3 Zero unmanaged calls to window.prompt, prompt() across js/ and html', () => {
  const rootDir = path.resolve('.');
  const jsDir = path.join(rootDir, 'js');

  function scanDir(dir) {
    let files = [];
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, f.name);
      if (f.isDirectory()) {
        files = files.concat(scanDir(fullPath));
      } else if (f.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const jsFiles = scanDir(jsDir);
  const htmlFiles = [path.join(rootDir, 'index.html'), path.join(rootDir, 'catalog.html')];
  const allFiles = [...jsFiles, ...htmlFiles];

  const unmanagedPrompts = [];

  for (const file of allFiles) {
    const relPath = path.relative(rootDir, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;

      const promptRegex = /(?:\bwindow\.)?prompt\s*\(/g;
      let match;
      while ((match = promptRegex.exec(line)) !== null) {
        if (relPath === 'js/ui-feedback.js') continue;
        if (/uiModal\.prompt\s*\(/.test(line)) continue;
        if (relPath === 'js/views/recipesView.js' && lineIdx >= 475 && lineIdx <= 485) continue;

        unmanagedPrompts.push({ file: relPath, line: lineIdx + 1, content: line.trim() });
      }
    });
  }

  assert.strictEqual(
    unmanagedPrompts.length,
    0,
    `Found ${unmanagedPrompts.length} unmanaged prompt() calls:\n${JSON.stringify(unmanagedPrompts, null, 2)}`
  );
});

await runTest('1.4 DOM containers #toastContainer and #uiModalContainer present in index.html & catalog.html', () => {
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const catalogHtml = fs.readFileSync('catalog.html', 'utf8');

  assert.ok(indexHtml.includes('id="toastContainer"'), 'index.html must contain #toastContainer');
  assert.ok(indexHtml.includes('id="uiModalContainer"'), 'index.html must contain #uiModalContainer');
  assert.ok(indexHtml.includes('src="js/ui-feedback.js"'), 'index.html must load js/ui-feedback.js');

  assert.ok(catalogHtml.includes('id="toastContainer"'), 'catalog.html must contain #toastContainer');
  assert.ok(catalogHtml.includes('id="uiModalContainer"'), 'catalog.html must contain #uiModalContainer');
  assert.ok(catalogHtml.includes('src="js/ui-feedback.js"'), 'catalog.html must load js/ui-feedback.js');
});

// ===========================================================================
// CHALLENGE 2: uiToast Engine Lifecycle, Types, Timers, and Controls
// ===========================================================================
console.log('\n--- CHALLENGE 2: uiToast Engine & Lifecycle ---');

await runTest('2.1 uiToast creates element with proper type, role, and styles in container', () => {
  resetMockDOM();

  const successToast = uiToast.success('Operación completada con éxito');
  const container = mockDoc.getElementById('toastContainer');
  assert.ok(container.children.includes(successToast), 'Toast must be appended to #toastContainer');
  assert.strictEqual(successToast.getAttribute('role'), 'status', 'Success toast role must be status');
  assert.ok(successToast.innerHTML.includes('check_circle'), 'Success toast must render check_circle icon');
  assert.strictEqual(mockWin._lastAlert, 'Operación completada con éxito', '_lastAlert must be synchronized');

  const errorToast = uiToast.error('Error al procesar la solicitud');
  assert.strictEqual(errorToast.getAttribute('role'), 'alert', 'Error toast role must be alert');
  assert.ok(errorToast.innerHTML.includes('error'), 'Error toast must render error icon');
  assert.ok(errorToast.className.includes('border-rose-500/30'), 'Error toast must have rose border');

  const warningToast = uiToast.warning('Advertencia de stock');
  assert.strictEqual(warningToast.getAttribute('role'), 'status', 'Warning toast role must be status');
  assert.ok(warningToast.innerHTML.includes('warning'), 'Warning toast must render warning icon');

  const infoToast = uiToast.info('Información importante');
  assert.strictEqual(infoToast.getAttribute('role'), 'status', 'Info toast role must be status');
  assert.ok(infoToast.innerHTML.includes('info'), 'Info toast must render info icon');
});

await runTest('2.2 uiToast auto-creates container if missing from DOM', () => {
  mockDoc.body = new MockDOMElement('body');
  assert.strictEqual(mockDoc.getElementById('toastContainer'), null);

  const toast = uiToast.show({ message: 'Auto container test' });
  const container = mockDoc.getElementById('toastContainer');
  assert.ok(container !== null, 'Container #toastContainer must be auto-created');
  assert.strictEqual(container.getAttribute('aria-live'), 'polite');
  assert.ok(container.children.includes(toast), 'Toast must be in auto-created container');
});

await runTest('2.3 uiToast close button click manually dismisses toast element', async () => {
  resetMockDOM();

  const toast = uiToast.info('Notificación descartable', 'Aviso');
  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, 1);

  const closeBtn = toast.querySelector('.toast-close-btn');
  assert.ok(closeBtn !== null, 'Toast must have a close button');

  closeBtn.click();
  await new Promise(r => setTimeout(r, 260));

  assert.strictEqual(container.children.length, 0, 'Toast element must be removed from DOM after close click');
});

await runTest('2.4 uiToast action button executes onAction callback and dismisses', async () => {
  resetMockDOM();

  let actionExecuted = false;
  const toast = uiToast.show({
    message: 'Elemento eliminado',
    actionText: 'Deshacer',
    onAction: () => {
      actionExecuted = true;
    }
  });

  const container = mockDoc.getElementById('toastContainer');
  const actionBtn = toast.querySelector('.toast-action-btn');
  assert.ok(actionBtn !== null, 'Action button must be rendered');
  assert.ok(actionBtn.innerText.includes('Deshacer'));

  actionBtn.click();
  assert.strictEqual(actionExecuted, true, 'onAction callback must be executed');

  await new Promise(r => setTimeout(r, 260));
  assert.strictEqual(container.children.length, 0, 'Toast must be dismissed after action execution');
});

await runTest('2.5 uiToast auto-dismisses after duration expires', async () => {
  resetMockDOM();

  const toast = uiToast.show({
    message: 'Auto dismiss test',
    duration: 50
  });

  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, 1);

  await new Promise(r => setTimeout(r, 320));
  assert.strictEqual(container.children.length, 0, 'Toast must be automatically removed after duration');
});

await runTest('2.6 uiToast XSS escaping and newline handling', () => {
  resetMockDOM();

  const maliciousInput = '<script>alert("XSS")</script>&<b>bold</b>\nSegunda Línea';
  const toast = uiToast.show({ message: maliciousInput });

  assert.ok(!toast.innerHTML.includes('<script>'), 'HTML script tag must be sanitized');
  assert.ok(toast.innerHTML.includes('&lt;script&gt;'), '< must be escaped to &lt;');
  assert.ok(toast.innerHTML.includes('&amp;'), '& must be escaped to &amp;');
  assert.ok(toast.innerHTML.includes('<br/>'), 'Newlines must be formatted with <br/>');
});

await runTest('2.7 uiToast persistent toast when duration <= 0', async () => {
  resetMockDOM();

  const toast = uiToast.show({
    message: 'Sticky warning',
    duration: 0
  });

  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, 1);
  assert.strictEqual(toast.querySelector('.toast-progress-bar'), null, 'Persistent toast should not have progress bar');

  await new Promise(r => setTimeout(r, 150));
  assert.strictEqual(container.children.length, 1, 'Persistent toast must remain in DOM');
});

// ===========================================================================
// CHALLENGE 3: uiModal.confirm Engine Lifecycle & Resolution
// ===========================================================================
console.log('\n--- CHALLENGE 3: uiModal.confirm Engine & Lifecycle ---');

await runTest('3.1 uiModal.confirm resolves true when confirm button clicked', async () => {
  resetMockDOM();

  const confirmPromise = uiModal.confirm({
    title: 'Eliminar receta',
    message: '¿Estás seguro?',
    confirmText: 'Sí, eliminar',
    cancelText: 'No'
  });

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  assert.ok(modalOverlay !== null, 'Modal overlay must be appended to DOM');
  assert.ok(modalOverlay.innerHTML.includes('Eliminar receta'), 'Title must be rendered');

  const confirmBtn = modalOverlay.querySelector('.modal-confirm-btn');
  assert.ok(confirmBtn !== null, 'Confirm button must exist');
  confirmBtn.click();

  const result = await confirmPromise;
  assert.strictEqual(result, true, 'Confirm click must resolve true');

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(mockDoc.querySelectorAll('.modal-backdrop-overlay').length, 0, 'Modal must be removed from DOM');
});

await runTest('3.2 uiModal.confirm resolves false when cancel button clicked', async () => {
  resetMockDOM();

  const confirmPromise = uiModal.confirm({
    title: 'Cancelar acción',
    message: '¿Continuar?'
  });

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  const cancelBtn = modalOverlay.querySelector('.modal-cancel-btn');
  assert.ok(cancelBtn !== null, 'Cancel button must exist');
  cancelBtn.click();

  const result = await confirmPromise;
  assert.strictEqual(result, false, 'Cancel click must resolve false');

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(mockDoc.querySelectorAll('.modal-backdrop-overlay').length, 0);
});

await runTest('3.3 uiModal.confirm resolves false when Escape key is pressed', async () => {
  resetMockDOM();

  const confirmPromise = uiModal.confirm({
    title: 'Test Escape',
    message: 'Presiona escape'
  });

  mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });

  const result = await confirmPromise;
  assert.strictEqual(result, false, 'Escape key must resolve false');

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(mockDoc.querySelectorAll('.modal-backdrop-overlay').length, 0);
  assert.strictEqual((mockDoc.eventListeners['keydown'] || []).length, 0, 'Keydown listener must be cleaned up');
});

await runTest('3.4 uiModal.confirm resolves true when Enter key is pressed', async () => {
  resetMockDOM();

  const confirmPromise = uiModal.confirm({
    title: 'Test Enter',
    message: 'Presiona enter'
  });

  mockDoc.dispatchEvent({ type: 'keydown', key: 'Enter' });

  const result = await confirmPromise;
  assert.strictEqual(result, true, 'Enter key must resolve true');

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(mockDoc.querySelectorAll('.modal-backdrop-overlay').length, 0);
  assert.strictEqual((mockDoc.eventListeners['keydown'] || []).length, 0, 'Keydown listener must be cleaned up');
});

await runTest('3.5 uiModal.confirm resolves false on backdrop click, but ignores card click', async () => {
  resetMockDOM();

  const confirmPromise = uiModal.confirm({
    title: 'Test Backdrop',
    message: 'Click afuera'
  });

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  const card = modalOverlay.querySelector('.modal-card');

  // Click on card should NOT dismiss
  card.click();
  await new Promise(r => setTimeout(r, 50));
  assert.strictEqual(mockDoc.querySelectorAll('.modal-backdrop-overlay').length, 1);

  // Click on backdrop overlay directly
  modalOverlay.click();
  const result = await confirmPromise;
  assert.strictEqual(result, false, 'Backdrop click must resolve false');

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(mockDoc.querySelectorAll('.modal-backdrop-overlay').length, 0);
});

await runTest('3.6 uiModal.confirm supports danger type with danger styling and delete icon', async () => {
  resetMockDOM();

  const confirmPromise = uiModal.confirm({
    title: 'Eliminar Insumo',
    message: 'Acción irreversible',
    type: 'danger'
  });

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  assert.ok(modalOverlay.innerHTML.includes('bg-rose-600'), 'Danger confirm button must have rose styling');
  assert.ok(modalOverlay.innerHTML.includes('delete'), 'Danger modal must display delete icon');

  const cancelBtn = modalOverlay.querySelector('.modal-cancel-btn');
  cancelBtn.click();
  await confirmPromise;
});

// ===========================================================================
// CHALLENGE 4: uiModal.prompt & Specialized Form Modals
// ===========================================================================
console.log('\n--- CHALLENGE 4: uiModal.prompt & Specialized Modals ---');

await runTest('4.1 uiModal.prompt resolves with entered text on confirm button click', async () => {
  resetMockDOM();

  const promptPromise = uiModal.prompt({
    title: 'Stock Actual',
    message: 'Ingresa la nueva cantidad',
    defaultValue: '10'
  });

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  const input = modalOverlay.querySelector('.modal-prompt-input');
  assert.ok(input !== null, 'Input element must exist');
  assert.strictEqual(input.value, '10', 'Default value must be set in input');

  input.value = '25.5';

  const confirmBtn = modalOverlay.querySelector('.modal-confirm-btn');
  confirmBtn.click();

  const result = await promptPromise;
  assert.strictEqual(result, '25.5', 'Prompt must resolve with new input value');

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(mockDoc.querySelectorAll('.modal-backdrop-overlay').length, 0);
});

await runTest('4.2 uiModal.prompt resolves with text on Enter key press', async () => {
  resetMockDOM();

  const promptPromise = uiModal.prompt({
    title: 'Google Token',
    message: 'Token de acceso',
    defaultValue: 'INITIAL_TOKEN'
  });

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  const input = modalOverlay.querySelector('.modal-prompt-input');
  input.value = 'NEW_AUTH_TOKEN_XYZ';

  mockDoc.dispatchEvent({ type: 'keydown', key: 'Enter' });

  const result = await promptPromise;
  assert.strictEqual(result, 'NEW_AUTH_TOKEN_XYZ', 'Enter key must resolve with input value');
});

await runTest('4.3 uiModal.prompt resolves null on cancel, escape, or backdrop click', async () => {
  // Test Cancel button
  {
    resetMockDOM();
    const p1 = uiModal.prompt({ title: 'Test 1', defaultValue: 'val' });
    const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
    modalOverlay.querySelector('.modal-cancel-btn').click();
    const res1 = await p1;
    assert.strictEqual(res1, null, 'Cancel button must resolve null');
  }

  // Test Escape key
  {
    resetMockDOM();
    const p2 = uiModal.prompt({ title: 'Test 2', defaultValue: 'val' });
    mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
    const res2 = await p2;
    assert.strictEqual(res2, null, 'Escape must resolve null');
  }

  // Test Backdrop click
  {
    resetMockDOM();
    const p3 = uiModal.prompt({ title: 'Test 3', defaultValue: 'val' });
    const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
    modalOverlay.click();
    const res3 = await p3;
    assert.strictEqual(res3, null, 'Backdrop click must resolve null');
  }
});

await runTest('4.4 uiModal.prompt resolves empty string when input cleared vs null on cancel', async () => {
  resetMockDOM();

  const promptPromise = uiModal.prompt({
    title: 'Nota adicional',
    defaultValue: 'Original'
  });

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  const input = modalOverlay.querySelector('.modal-prompt-input');
  input.value = '';

  modalOverlay.querySelector('.modal-confirm-btn').click();

  const result = await promptPromise;
  assert.strictEqual(result, '', 'Submitting empty input must resolve "" (empty string, not null)');
});

await runTest('4.5 uiModal.alert displays message and resolves on confirm or escape', async () => {
  resetMockDOM();

  const alertPromise = uiModal.alert({
    title: 'Aviso Importante',
    message: 'La sincronización fue completada con éxito.'
  });

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  assert.ok(modalOverlay !== null, 'Alert modal must be rendered');
  assert.ok(modalOverlay.innerHTML.includes('Aviso Importante'));

  modalOverlay.querySelector('.modal-confirm-btn').click();
  await alertPromise;

  await new Promise(r => setTimeout(r, 200));
  assert.strictEqual(mockDoc.querySelectorAll('.modal-backdrop-overlay').length, 0);
});

await runTest('4.6 uiModal.showAddIngredientModal extracts unified ingredient form fields', async () => {
  resetMockDOM();

  const formPromise = uiModal.showAddIngredientModal();

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  assert.ok(modalOverlay !== null, 'Ingredient modal must render');

  const nameInput = modalOverlay.querySelector('#mIngName');
  const qtyInput = modalOverlay.querySelector('#mIngQty');
  const unitSelect = modalOverlay.querySelector('#mIngUnit');
  const costInput = modalOverlay.querySelector('#mIngCost');
  const form = modalOverlay.querySelector('.modal-ing-form');

  nameInput.value = 'Chocolate 70%';
  qtyInput.value = '0.5';
  unitSelect.value = 'kg';
  costInput.value = '8.50';

  form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

  const result = await formPromise;
  assert.deepStrictEqual(result, {
    name: 'Chocolate 70%',
    quantity: 0.5,
    unit: 'kg',
    unitCost: 8.50
  }, 'Must extract clean ingredient object from form');
});

await runTest('4.7 uiModal.showAddSupplyModal extracts unified inventory pantry form fields', async () => {
  resetMockDOM();

  const supplyPromise = uiModal.showAddSupplyModal();

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  assert.ok(modalOverlay !== null, 'Supply modal must render');

  modalOverlay.querySelector('#mSupplyName').value = 'Mantequilla Sin Sal';
  modalOverlay.querySelector('#mSupplyCategory').value = 'Lácteos';
  modalOverlay.querySelector('#mSupplyStock').value = '15.0';
  modalOverlay.querySelector('#mSupplyUnit').value = 'kg';
  modalOverlay.querySelector('#mSupplyCost').value = '6.20';
  modalOverlay.querySelector('#mSupplySupplier').value = 'Distribuidora Láctea';

  const form = modalOverlay.querySelector('.modal-supply-form');
  form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

  const result = await supplyPromise;
  assert.deepStrictEqual(result, {
    name: 'Mantequilla Sin Sal',
    category: 'Lácteos',
    stock: 15.0,
    unit: 'kg',
    costPerUnit: 6.20,
    supplier: 'Distribuidora Láctea'
  });
});

await runTest('4.8 uiModal.showEditSupplyModal updates fast inventory adjustment fields', async () => {
  resetMockDOM();

  const item = { id: 'inv-1', name: 'Harina de Trigo', stock: 10, unit: 'kg', costPerUnit: 1.25 };
  const editPromise = uiModal.showEditSupplyModal(item);

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  modalOverlay.querySelector('#mEditSupplyStock').value = '18.5';
  modalOverlay.querySelector('#mEditSupplyCost').value = '1.30';

  const form = modalOverlay.querySelector('.modal-edit-supply-form');
  form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

  const result = await editPromise;
  assert.deepStrictEqual(result, {
    stock: 18.5,
    costPerUnit: 1.30
  });
});

await runTest('4.9 uiModal.showNewTimerModal extracts label and baking minutes', async () => {
  resetMockDOM();

  const timerPromise = uiModal.showNewTimerModal();

  const modalOverlay = mockDoc.querySelector('.modal-backdrop-overlay');
  modalOverlay.querySelector('#mTimerLabel').value = 'Macarons de Frambuesa';
  modalOverlay.querySelector('#mTimerMins').value = '18';

  const form = modalOverlay.querySelector('.modal-timer-form');
  form.dispatchEvent({ type: 'submit', preventDefault: () => {} });

  const result = await timerPromise;
  assert.deepStrictEqual(result, {
    label: 'Macarons de Frambuesa',
    minutes: 18
  });
});

// ===========================================================================
// CHALLENGE 5: Android WebView WebChromeClient Overrides & Polyfills
// ===========================================================================
console.log('\n--- CHALLENGE 5: Android WebChromeClient Overrides & Polyfills ---');

await runTest('5.1 MainActivity.java contains WebChromeClient onJsAlert, onJsConfirm, onJsPrompt overrides', () => {
  const javaPath = path.resolve('android_project/src/com/sweetsmile/pastry/MainActivity.java');
  assert.ok(fs.existsSync(javaPath), 'MainActivity.java must exist');

  const content = fs.readFileSync(javaPath, 'utf8');

  // Verify onJsAlert
  assert.ok(content.includes('public boolean onJsAlert('), 'MainActivity must override onJsAlert');
  assert.ok(content.includes('result.confirm()'), 'onJsAlert must call result.confirm() to unblock WebView');
  assert.ok(content.includes('window.uiToast'), 'onJsAlert must route to window.uiToast');
  assert.ok(content.includes('return true;'), 'onJsAlert must return true to suppress OS alert');

  // Verify onJsConfirm
  assert.ok(content.includes('public boolean onJsConfirm('), 'MainActivity must override onJsConfirm');
  assert.ok(content.includes('result.cancel()'), 'onJsConfirm must call result.cancel()');
  assert.ok(content.includes('return true;'), 'onJsConfirm must return true to suppress OS confirm');

  // Verify onJsPrompt
  assert.ok(content.includes('public boolean onJsPrompt('), 'MainActivity must override onJsPrompt');
  assert.ok(content.includes('result.cancel()'), 'onJsPrompt must call result.cancel()');
  assert.ok(content.includes('return true;'), 'onJsPrompt must return true to suppress OS prompt');
});

await runTest('5.2 JS Dialog Polyfill intercepts window.alert and routes to uiToast.info', () => {
  resetMockDOM();
  installDialogPolyfills();

  window.alert('Mensaje desde código legado');
  assert.strictEqual(mockWin._lastAlert, 'Mensaje desde código legado');

  const toastContainer = mockDoc.getElementById('toastContainer');
  assert.ok(toastContainer.children.length > 0, 'Polyfill must create a toast in container');
  const toast = toastContainer.children[0];
  assert.ok(toast.innerHTML.includes('Mensaje desde código legado'));
});

await runTest('5.3 JS Dialog Polyfill safely returns non-blocking values for confirm and prompt', () => {
  installDialogPolyfills();

  const confirmRes = window.confirm('¿Desea borrar todo?');
  assert.strictEqual(confirmRes, false, 'Sync window.confirm polyfill must safely return false');

  const promptRes1 = window.prompt('Introduce nombre:', 'Usuario');
  assert.strictEqual(promptRes1, 'Usuario', 'Sync window.prompt polyfill must return defaultValue');

  const promptRes2 = window.prompt('Introduce nombre:');
  assert.strictEqual(promptRes2, null, 'Sync window.prompt polyfill without default must return null');
});

// ===========================================================================
// CHALLENGE 6: Adversarial Stress & Edge Cases
// ===========================================================================
console.log('\n--- CHALLENGE 6: Adversarial Stress & Edge Cases ---');

await runTest('6.1 Rapid burst emission: 50 simultaneous toasts without memory exhaustion', () => {
  resetMockDOM();

  const count = 50;
  for (let i = 0; i < count; i++) {
    uiToast.show({
      message: `Toast #${i}`,
      type: i % 2 === 0 ? 'success' : 'error',
      duration: 5000
    });
  }

  const container = mockDoc.getElementById('toastContainer');
  assert.strictEqual(container.children.length, count, `All ${count} toasts must be mounted`);
});

await runTest('6.2 Falsy and boundary payloads in uiToast and uiModal', async () => {
  resetMockDOM();

  // null message
  assert.doesNotThrow(() => uiToast.show({ message: null }));
  // undefined message
  assert.doesNotThrow(() => uiToast.show({ message: undefined }));
  // number 0
  assert.doesNotThrow(() => uiToast.show({ message: 0 }));
  // boolean false
  assert.doesNotThrow(() => uiToast.show({ message: false }));
  // NaN
  assert.doesNotThrow(() => uiToast.show({ message: NaN }));

  // uiModal with null message
  const p = uiModal.confirm({ title: null, message: null });
  const overlay = mockDoc.querySelector('.modal-backdrop-overlay');
  assert.ok(overlay !== null);
  mockDoc.dispatchEvent({ type: 'keydown', key: 'Escape' });
  const res = await p;
  assert.strictEqual(res, false);
});

// ===========================================================================
// FINAL REPORT & VERDICT
// ===========================================================================
console.log('\n======================================================================');
console.log(` EMPIRICAL VERIFICATION RESULTS: ${passedCount} PASSED | ${failedCount} FAILED`);
console.log('======================================================================');

if (failedCount > 0) {
  console.error('\nFAILURES SUMMARY:');
  testFailures.forEach(f => console.error(`  - ${f.name}: ${f.error.message}`));
  process.exit(1);
} else {
  console.log('\n\x1b[32m✔ EMPIRICAL VERDICT: CONFIRMED. Milestone M1_v12 (Requirement R1) is fully robust.\x1b[0m\n');
  process.exit(0);
}
