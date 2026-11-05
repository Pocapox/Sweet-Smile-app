// tests/harness.js - Headless DOM, Storage, Network, and Assertion Harness for Sweet Smile E2E Tests
import { EventEmitter } from 'node:events';

/**
 * Lightweight mock DOM Element that supports innerHTML parsing,
 * classList manipulation, attribute inspection, event listeners, and querying.
 */
export class MockElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.children = [];
    this.parentNode = null;
    this.eventListeners = {};
    this._value = attributes.value !== undefined ? String(attributes.value) : '';
    this._innerHTML = '';
    this._innerText = '';
    this._classList = new Set();

    if (attributes.id) this.id = attributes.id;
    if (attributes.class) {
      attributes.class.split(/\s+/).filter(Boolean).forEach(c => this._classList.add(c));
    }
  }

  get value() {
    return this._value;
  }

  set value(v) {
    this._value = String(v ?? '');
  }

  get innerText() {
    if (this._innerText) return this._innerText;
    return this.children.map(c => c.innerText || '').join(' ').trim();
  }

  set innerText(text) {
    this._innerText = String(text ?? '');
    this._innerHTML = escapeHtml(this._innerText);
    this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = html;
    this.children = [];
    this.parseChildrenFromHtml(html);
  }

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
    return this.attributes[name] ?? null;
  }

  setAttribute(name, value) {
    const strVal = String(value);
    this.attributes[name] = strVal;
    if (name === 'id') this.id = strVal;
    if (name === 'class') {
      this._classList.clear();
      strVal.split(/\s+/).filter(Boolean).forEach(c => this._classList.add(c));
    }
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'id') delete this.id;
    if (name === 'class') this._classList.clear();
  }

  hasAttribute(name) {
    return name in this.attributes || (name === 'id' && !!this.id);
  }

  appendChild(child) {
    if (child) {
      child.parentNode = this;
      this.children.push(child);
    }
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(c => c !== this);
      this.parentNode = null;
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
    if (!evtObj.stopPropagation) evtObj.stopPropagation = () => {};

    const listeners = this.eventListeners[type] || [];
    listeners.forEach(fn => {
      try {
        fn(evtObj);
      } catch (err) {
        console.error(`Error in event listener for ${type}:`, err);
      }
    });

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
    const matchFn = createSelectorMatcher(selector);

    function walk(node) {
      if (node !== this && matchFn(node)) {
        results.push(node);
      }
      for (const child of node.children) {
        walk.call(this, child);
      }
    }

    for (const child of this.children) {
      walk.call(this, child);
    }
    return results;
  }

  /**
   * Lightweight tag & attribute parser for innerHTML.
   * Extracts tags with IDs, classes, and custom attributes.
   */
  parseChildrenFromHtml(html) {
    if (!html || typeof html !== 'string') return;

    // Match tags: <tagname attr1="val" attr2='val' ...> or </tagname>
    const tagRegex = /<([a-zA-Z0-9\-]+)([^>]*)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9\-]+)([^>]*?)\/?>/g;
    let match;

    while ((match = tagRegex.exec(html)) !== null) {
      const tagName = match[1] || match[4];
      const rawAttrs = match[2] || match[5] || '';
      const innerContent = match[3] || '';

      const attrs = parseAttributes(rawAttrs);
      const child = new MockElement(tagName, attrs);

      if (innerContent && !innerContent.includes('<')) {
        child.innerText = innerContent.trim();
      } else if (innerContent) {
        child.innerHTML = innerContent;
      }

      this.appendChild(child);
    }
  }
}

function parseAttributes(rawAttrs) {
  const attrs = {};
  if (!rawAttrs) return attrs;

  const attrRegex = /([a-zA-Z0-9\-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = attrRegex.exec(rawAttrs)) !== null) {
    const key = m[1];
    const val = m[2] ?? m[3] ?? m[4] ?? '';
    attrs[key] = val;
  }
  return attrs;
}

function createSelectorMatcher(selector) {
  const s = selector.trim();

  // ID selector: #foo
  if (s.startsWith('#')) {
    const id = s.slice(1);
    return node => node.id === id || node.getAttribute('id') === id;
  }

  // Class selector: .foo
  if (s.startsWith('.')) {
    const cls = s.slice(1);
    return node => node.classList.contains(cls);
  }

  // Attribute selector: [data-id="123"] or [data-id]
  if (s.startsWith('[') && s.endsWith(']')) {
    const attrExp = s.slice(1, -1);
    if (attrExp.includes('=')) {
      const [attrName, rawVal] = attrExp.split('=');
      const expectedVal = rawVal.replace(/^["']|["']$/g, '');
      return node => node.getAttribute(attrName.trim()) === expectedVal;
    } else {
      return node => node.hasAttribute(attrExp.trim());
    }
  }

  // Tag with class: button.cat-pill
  if (s.includes('.')) {
    const [tag, cls] = s.split('.');
    return node => (!tag || node.tagName === tag.toUpperCase()) && node.classList.contains(cls);
  }

  // Plain tag: button, div, span
  const tagUpper = s.toUpperCase();
  return node => node.tagName === tagUpper;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Mock localStorage implementation with corruption simulation and inspection.
 */
export class MockStorage {
  constructor() {
    this._store = new Map();
  }

  get length() {
    return this._store.size;
  }

  getItem(key) {
    return this._store.has(String(key)) ? this._store.get(String(key)) : null;
  }

  setItem(key, value) {
    this._store.set(String(key), String(value));
  }

  removeItem(key) {
    this._store.delete(String(key));
  }

  clear() {
    this._store.clear();
  }

  key(n) {
    const keys = Array.from(this._store.keys());
    return keys[n] || null;
  }

  /**
   * Helper to simulate storage corruption
   */
  corrupt(key, badValue = 'INVALID_JSON{{{') {
    this._store.set(String(key), badValue);
  }
}

/**
 * In-Memory IndexedDB Simulation
 */
export class MockIndexedDB {
  constructor() {
    this.databases = new Map();
  }

  open(dbName, version = 1) {
    const self = this;
    const req = new EventEmitter();

    setTimeout(() => {
      if (!self.databases.has(dbName)) {
        self.databases.set(dbName, {
          name: dbName,
          version,
          stores: new Map()
        });
      }
      const db = self.databases.get(dbName);
      const dbObj = {
        name: db.name,
        version: db.version,
        objectStoreNames: {
          contains(name) { return db.stores.has(name); }
        },
        createObjectStore(name, options = {}) {
          const store = { name, keyPath: options.keyPath, data: new Map() };
          db.stores.set(name, store);
          return store;
        },
        transaction(storeNames, mode = 'readonly') {
          return {
            objectStore(storeName) {
              const store = db.stores.get(storeName) || { data: new Map() };
              return {
                get(key) {
                  const r = new EventEmitter();
                  setTimeout(() => {
                    r.result = store.data.get(key) || null;
                    if (r.onsuccess) r.onsuccess({ target: r });
                  }, 5);
                  return r;
                },
                getAll() {
                  const r = new EventEmitter();
                  setTimeout(() => {
                    r.result = Array.from(store.data.values());
                    if (r.onsuccess) r.onsuccess({ target: r });
                  }, 5);
                  return r;
                },
                put(val, key) {
                  const r = new EventEmitter();
                  const finalKey = key || (store.keyPath ? val[store.keyPath] : 'k_' + Date.now());
                  store.data.set(finalKey, JSON.parse(JSON.stringify(val)));
                  setTimeout(() => {
                    r.result = finalKey;
                    if (r.onsuccess) r.onsuccess({ target: r });
                  }, 5);
                  return r;
                },
                delete(key) {
                  const r = new EventEmitter();
                  store.data.delete(key);
                  setTimeout(() => {
                    if (r.onsuccess) r.onsuccess({ target: r });
                  }, 5);
                  return r;
                },
                clear() {
                  const r = new EventEmitter();
                  store.data.clear();
                  setTimeout(() => {
                    if (r.onsuccess) r.onsuccess({ target: r });
                  }, 5);
                  return r;
                }
              };
            }
          };
        },
        close() {}
      };

      req.result = dbObj;
      if (req.onupgradeneeded) req.onupgradeneeded({ target: req });
      if (req.onsuccess) req.onsuccess({ target: req });
    }, 5);

    return req;
  }
}

/**
 * Mock Fetch & HTTP Interceptor
 */
export class MockFetchManager {
  constructor() {
    this.requests = [];
    this.customHandlers = [];
  }

  reset() {
    this.requests = [];
    this.customHandlers = [];
  }

  addHandler(matcherFn, responderFn) {
    this.customHandlers.unshift({ matcherFn, responderFn });
  }

  async fetch(url, options = {}) {
    const reqRecord = { url: String(url), options, timestamp: Date.now() };
    this.requests.push(reqRecord);

    // Check custom handlers
    for (const h of this.customHandlers) {
      if (h.matcherFn(url, options)) {
        return h.responderFn(url, options);
      }
    }

    // Default Gemini API simulation
    if (String(url).includes('generativelanguage.googleapis.com')) {
      // Model fallback simulation or standard response
      if (String(url).includes('gemini-2.5-flash') || String(url).includes('gemini-2.0-flash') || String(url).includes('gemini-1.5-flash')) {
        let bodyJson = {};
        try {
          bodyJson = typeof options.body === 'string' ? JSON.parse(options.body) : (options.body || {});
        } catch {
          // ignore
        }

        const promptText = JSON.stringify(bodyJson);

        // Chef advice prompt or OCR prompt
        let responseText = 'Simulated Gemini AI Chef response for pastry management.';
        if (promptText.includes('OCR') || promptText.includes('receta')) {
          responseText = JSON.stringify({
            name: 'Croissant Artesanal de Mantequilla',
            category: 'Masas',
            portions: 8,
            prepTime: '3h 30m',
            difficulty: 'Media',
            indirectCost: 2.10,
            targetMargin: 65,
            ingredients: [
              { name: 'Harina de Trigo Especial', quantity: 0.50, unit: 'kg', unitCost: 2.00, totalCost: 1.00 },
              { name: 'Mantequilla Repostera 82% MG', quantity: 0.25, unit: 'kg', unitCost: 10.00, totalCost: 2.50 }
            ],
            instructions: ['Amasar masa base', 'Laminar con mantequilla en 3 pliegues', 'Hornear a 190C por 18 min']
          });
        }

        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [{ text: responseText }]
                }
              }
            ]
          }),
          text: async () => responseText
        };
      }
    }

    // Default fallback 200 OK
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
      text: async () => JSON.stringify({ success: true })
    };
  }
}

/**
 * Global Test Environment Setup
 */
export const mockFetch = new MockFetchManager();
export const mockStorage = new MockStorage();
export const mockIdb = new MockIndexedDB();

export const mockDocument = {
  body: new MockElement('body'),
  createElement(tag) {
    return new MockElement(tag);
  },
  getElementById(id) {
    return this.body.querySelector('#' + id);
  },
  querySelector(sel) {
    return this.body.querySelector(sel);
  },
  querySelectorAll(sel) {
    return this.body.querySelectorAll(sel);
  },
  addEventListener() {},
  removeEventListener() {}
};

export const mockWindow = {
  AudioContext: class MockAudioContext {
    createOscillator() {
      return {
        connect() {},
        start() {},
        stop() {},
        frequency: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
          linearRampToValueAtTime() {}
        }
      };
    }
    createGain() {
      return {
        connect() {},
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
          linearRampToValueAtTime() {}
        }
      };
    }
    get destination() { return {}; }
    get currentTime() { return 0; }
    close() {}
  },
  webkitAudioContext: class MockWebkitAudioContext {
    createOscillator() {
      return {
        connect() {},
        start() {},
        stop() {},
        frequency: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
          linearRampToValueAtTime() {}
        }
      };
    }
    createGain() {
      return {
        connect() {},
        gain: {
          setValueAtTime() {},
          exponentialRampToValueAtTime() {},
          linearRampToValueAtTime() {}
        }
      };
    }
    get destination() { return {}; }
    get currentTime() { return 0; }
    close() {}
  },
  document: mockDocument,
  localStorage: mockStorage,
  navigator: {
    onLine: true,
    clipboard: {
      async writeText(text) {
        mockWindow._lastClipboard = text;
        return true;
      }
    }
  },
  location: {
    origin: 'http://localhost:3000',
    pathname: '/index.html',
    hash: '#pos'
  },
  _lastClipboard: '',
  _lastAlert: '',
  _lastConfirm: '',
  _openWindows: [],
  alert(msg) {
    mockWindow._lastAlert = msg;
  },
  confirm(msg) {
    mockWindow._lastConfirm = msg;
    return true;
  },
  open(url, target) {
    const mockWin = {
      location: { href: url },
      target,
      document: {
        write(content) { mockWin._content = (mockWin._content || '') + content; },
        close() {}
      },
      close() { mockWin._closed = true; }
    };
    mockWindow._openWindows.push(mockWin);
    return mockWin;
  },
  print() {
    mockWindow._printCalled = true;
  },
  addEventListener(type, fn) {
    if (!mockWindow._listeners) mockWindow._listeners = {};
    if (!mockWindow._listeners[type]) mockWindow._listeners[type] = [];
    mockWindow._listeners[type].push(fn);
  },
  removeEventListener(type, fn) {
    if (mockWindow._listeners && mockWindow._listeners[type]) {
      mockWindow._listeners[type] = mockWindow._listeners[type].filter(f => f !== fn);
    }
  },
  dispatchEvent(evt) {
    const type = typeof evt === 'string' ? evt : evt.type;
    const listeners = (mockWindow._listeners && mockWindow._listeners[type]) || [];
    listeners.forEach(fn => fn(evt));
  }
};

// Install mocks into globalThis safely
export function setupGlobalEnv() {
  globalThis.window = mockWindow;
  globalThis.document = mockDocument;
  globalThis.localStorage = mockStorage;
  try {
    Object.defineProperty(globalThis, 'navigator', {
      value: mockWindow.navigator,
      configurable: true,
      writable: true
    });
  } catch {
    globalThis.navigator.onLine = true;
  }
  globalThis.indexedDB = mockIdb;
  globalThis.fetch = mockFetch.fetch.bind(mockFetch);
  globalThis.alert = mockWindow.alert.bind(mockWindow);
  globalThis.confirm = mockWindow.confirm.bind(mockWindow);
  globalThis.AudioContext = mockWindow.AudioContext;
  globalThis.webkitAudioContext = mockWindow.webkitAudioContext;

  // Accelerate artificial UX delays (1000ms+) for high-speed test execution
  if (!globalThis._origSetTimeout) {
    globalThis._origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = function(fn, delay, ...args) {
      const fastDelay = (typeof delay === 'number' && delay >= 200) ? 5 : delay;
      return globalThis._origSetTimeout(fn, fastDelay, ...args);
    };
  }
}

// Reset environment between tests
export function resetGlobalEnv() {
  mockStorage.clear();
  mockFetch.reset();
  mockDocument.body = new MockElement('body');
  mockWindow._lastClipboard = '';
  mockWindow._lastAlert = '';
  mockWindow._lastConfirm = '';
  mockWindow._openWindows = [];
  mockWindow._printCalled = false;
  mockWindow.navigator.onLine = true;
  mockWindow.location.hash = '#pos';
  delete mockWindow.prompt;
  delete mockWindow._dialogPolyfillsInstalled;
}

export function resetStoreToSeed(store, seedData) {
  if (!store || !seedData) return;
  store.state = {
    products: JSON.parse(JSON.stringify(seedData.INITIAL_PRODUCTS)),
    inventory: JSON.parse(JSON.stringify(seedData.INITIAL_INVENTORY)),
    recipes: JSON.parse(JSON.stringify(seedData.INITIAL_RECIPES)),
    invoices: JSON.parse(JSON.stringify(seedData.INITIAL_INVOICES)),
    expenses: JSON.parse(JSON.stringify(seedData.INITIAL_EXPENSES || [])),
    settings: JSON.parse(JSON.stringify(seedData.INITIAL_SETTINGS)),
    isOnline: true,
    cloudSyncStatus: 'synced'
  };
  store.cart = [];
}

// Initial activation
setupGlobalEnv();

/**
 * Robust, friendly Assertion Library
 */
export class AssertionError extends Error {
  constructor(message, actual, expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new AssertionError(message, condition, true);
  }
}

export function assertEquals(actual, expected, message = null) {
  if (actual !== expected) {
    throw new AssertionError(
      message || `Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`,
      actual,
      expected
    );
  }
}

export function assertNotEquals(actual, unexpected, message = null) {
  if (actual === unexpected) {
    throw new AssertionError(
      message || `Expected value not to equal ${JSON.stringify(unexpected)}`,
      actual,
      unexpected
    );
  }
}

export function assertDeepEquals(actual, expected, message = null) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new AssertionError(
      message || `Deep equality mismatch:\nActual:   ${actualStr}\nExpected: ${expectedStr}`,
      actual,
      expected
    );
  }
}

export function assertTrue(val, message = null) {
  if (val !== true) {
    throw new AssertionError(message || `Expected true, got ${JSON.stringify(val)}`, val, true);
  }
}

export function assertFalse(val, message = null) {
  if (val !== false) {
    throw new AssertionError(message || `Expected false, got ${JSON.stringify(val)}`, val, false);
  }
}

export function assertNull(val, message = null) {
  if (val !== null) {
    throw new AssertionError(message || `Expected null, got ${JSON.stringify(val)}`, val, null);
  }
}

export function assertNotNull(val, message = null) {
  if (val === null || val === undefined) {
    throw new AssertionError(message || `Expected non-null value, got ${JSON.stringify(val)}`, val, 'non-null');
  }
}

export function assertContains(haystack, needle, message = null) {
  if (typeof haystack === 'string') {
    if (!haystack.includes(needle)) {
      throw new AssertionError(
        message || `Expected "${haystack}" to contain "${needle}"`,
        haystack,
        needle
      );
    }
  } else if (Array.isArray(haystack)) {
    if (!haystack.includes(needle)) {
      throw new AssertionError(
        message || `Expected array to contain item ${JSON.stringify(needle)}`,
        haystack,
        needle
      );
    }
  } else {
    throw new AssertionError(message || `Cannot check contains on ${typeof haystack}`, haystack, needle);
  }
}

export function assertGreaterThan(actual, min, message = null) {
  if (!(actual > min)) {
    throw new AssertionError(
      message || `Expected ${actual} > ${min}`,
      actual,
      `> ${min}`
    );
  }
}

export function assertGreaterThanOrEqual(actual, min, message = null) {
  if (!(actual >= min)) {
    throw new AssertionError(
      message || `Expected ${actual} >= ${min}`,
      actual,
      `>= ${min}`
    );
  }
}

export function assertLessThanOrEqual(actual, max, message = null) {
  if (!(actual <= max)) {
    throw new AssertionError(
      message || `Expected ${actual} <= ${max}`,
      actual,
      `<= ${max}`
    );
  }
}

export function assertCloseTo(actual, expected, delta = 0.001, message = null) {
  if (Math.abs(actual - expected) > delta) {
    throw new AssertionError(
      message || `Expected ${actual} to be within ${delta} of ${expected}`,
      actual,
      expected
    );
  }
}

export function assertThrows(fn, expectedRegex = null, message = null) {
  let threw = false;
  let thrownError = null;
  try {
    fn();
  } catch (err) {
    threw = true;
    thrownError = err;
  }
  if (!threw) {
    throw new AssertionError(message || 'Expected function to throw, but it returned normally', null, 'Error');
  }
  if (expectedRegex && thrownError) {
    const errText = thrownError.message || String(thrownError);
    if (!new RegExp(expectedRegex).test(errText)) {
      throw new AssertionError(
        message || `Expected error message to match ${expectedRegex}, got "${errText}"`,
        errText,
        expectedRegex
      );
    }
  }
}

export async function assertRejects(asyncFn, expectedRegex = null, message = null) {
  let threw = false;
  let thrownError = null;
  try {
    await asyncFn();
  } catch (err) {
    threw = true;
    thrownError = err;
  }
  if (!threw) {
    throw new AssertionError(message || 'Expected promise to reject, but it resolved', null, 'Rejected promise');
  }
  if (expectedRegex && thrownError) {
    const errText = thrownError.message || String(thrownError);
    if (!new RegExp(expectedRegex).test(errText)) {
      throw new AssertionError(
        message || `Expected error message to match ${expectedRegex}, got "${errText}"`,
        errText,
        expectedRegex
      );
    }
  }
}

/**
 * Test Suite Framework
 */
class TestCollector {
  constructor() {
    this.currentSuite = null;
    this.suites = [];
  }

  describe(name, fn) {
    const parentSuite = this.currentSuite;
    const suite = {
      name,
      parent: parentSuite,
      tests: [],
      beforeEachHooks: [],
      afterEachHooks: []
    };
    if (parentSuite) {
      parentSuite.suites = parentSuite.suites || [];
      parentSuite.suites.push(suite);
    } else {
      this.suites.push(suite);
    }

    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = parentSuite;
    }
  }

  test(name, fn) {
    if (!this.currentSuite) {
      this.describe('Default Suite', () => {});
    }
    this.currentSuite.tests.push({ name, fn });
  }

  beforeEach(fn) {
    if (this.currentSuite) this.currentSuite.beforeEachHooks.push(fn);
  }

  afterEach(fn) {
    if (this.currentSuite) this.currentSuite.afterEachHooks.push(fn);
  }

  clear() {
    this.suites = [];
    this.currentSuite = null;
  }
}

export const collector = new TestCollector();
export const describe = collector.describe.bind(collector);
export const test = collector.test.bind(collector);
export const it = test;
export const beforeEach = collector.beforeEach.bind(collector);
export const afterEach = collector.afterEach.bind(collector);
