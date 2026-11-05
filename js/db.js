// js/db.js - IndexedDB Offline Storage Engine for Sweet Smile Pastry & Bakery Manager
// Manages local IndexedDB database "SweetSmileDB" with store "state" for high-capacity offline resilience.

export const DB_NAME = "SweetSmileDB";
export const DB_VERSION = 1;
export const STORE_NAME = "state";

let dbInstance = null;

/**
 * Checks if IndexedDB is available in the current runtime environment.
 * Guards safely against headless Node or environments where IndexedDB is disabled.
 */
export function isIndexedDBAvailable() {
  try {
    if (typeof indexedDB === "undefined" || !indexedDB) {
      return false;
    }
    return typeof indexedDB.open === "function";
  } catch (e) {
    return false;
  }
}

/**
 * Initializes and returns the IndexedDB database instance.
 * Safe in both browser and headless Node environments.
 * Resolves to the IDBDatabase instance, or null if IndexedDB is unavailable.
 */
export function initDB() {
  return new Promise((resolve) => {
    if (!isIndexedDBAvailable()) {
      return resolve(null);
    }

    if (dbInstance) {
      return resolve(dbInstance);
    }

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        try {
          const db = event.target ? event.target.result : (request.result || event.detail);
          if (db && db.objectStoreNames && !db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch (upgradeErr) {
          console.warn("IndexedDB upgradeneeded warning:", upgradeErr);
        }
      };

      request.onsuccess = (event) => {
        dbInstance = event.target ? event.target.result : (request.result || event.detail);
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.warn("IndexedDB open error:", request.error || event);
        resolve(null);
      };

      if (request.onblocked !== undefined) {
        request.onblocked = () => {
          console.warn("IndexedDB open blocked by other tabs");
        };
      }
    } catch (err) {
      console.warn("Exception during initDB:", err);
      resolve(null);
    }
  });
}

/**
 * Persists a key-value pair to IndexedDB.
 * @param {string} key - Identifier for stored data (e.g., 'app_state', 'backup')
 * @param {*} data - Data to store (will be cloned or serialized)
 * @returns {Promise<boolean>} - Resolves true on success, false on error/fallback
 */
export async function saveToIndexedDB(key, data) {
  if (!isIndexedDBAvailable()) {
    return false;
  }

  try {
    const db = await initDB();
    if (!db) return false;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        
        // Deep copy safely to avoid structured clone issues with Proxy or complex prototypes
        let payload = data;
        try {
          payload = JSON.parse(JSON.stringify(data));
        } catch (_) {
          payload = data;
        }

        const req = store.put(payload, key);

        req.onsuccess = () => resolve(true);
        req.onerror = (err) => {
          console.warn(`IndexedDB put error for key "${key}":`, err);
          resolve(false);
        };
        tx.onerror = (err) => {
          console.warn(`IndexedDB transaction error for key "${key}":`, err);
          resolve(false);
        };
        tx.oncomplete = () => resolve(true);
      } catch (txErr) {
        console.warn("saveToIndexedDB transaction failed:", txErr);
        resolve(false);
      }
    });
  } catch (err) {
    console.warn("saveToIndexedDB error:", err);
    return false;
  }
}

/**
 * Retrieves a value by key from IndexedDB.
 * @param {string} key - Identifier for stored data
 * @returns {Promise<*|null>} - Resolves to stored data, or null if missing/unavailable
 */
export async function loadFromIndexedDB(key) {
  if (!isIndexedDBAvailable()) {
    return null;
  }

  try {
    const db = await initDB();
    if (!db) return null;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);

        req.onsuccess = (e) => {
          const res = req.result !== undefined ? req.result : (e && e.target ? e.target.result : null);
          resolve(res !== undefined ? res : null);
        };
        req.onerror = (err) => {
          console.warn(`IndexedDB get error for key "${key}":`, err);
          resolve(null);
        };
        tx.onerror = (err) => {
          console.warn(`IndexedDB read tx error for key "${key}":`, err);
          resolve(null);
        };
      } catch (txErr) {
        console.warn("loadFromIndexedDB transaction failed:", txErr);
        resolve(null);
      }
    });
  } catch (err) {
    console.warn("loadFromIndexedDB error:", err);
    return null;
  }
}

/**
 * Deletes a key from IndexedDB.
 * @param {string} key
 * @returns {Promise<boolean>}
 */
export async function deleteFromIndexedDB(key) {
  if (!isIndexedDBAvailable()) return false;
  try {
    const db = await initDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
        tx.oncomplete = () => resolve(true);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Clears all entries from the store.
 * @returns {Promise<boolean>}
 */
export async function clearIndexedDB() {
  if (!isIndexedDBAvailable()) return false;
  try {
    const db = await initDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => resolve(false);
        tx.oncomplete = () => resolve(true);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
}

/**
 * Closes the active database connection (for cleanup or reset in tests).
 */
export function closeDB() {
  if (dbInstance) {
    try {
      if (typeof dbInstance.close === "function") {
        dbInstance.close();
      }
    } catch {}
    dbInstance = null;
  }
}

export const dbStorage = {
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
  isIndexedDBAvailable,
  initDB,
  saveToIndexedDB,
  loadFromIndexedDB,
  deleteFromIndexedDB,
  clearIndexedDB,
  closeDB
};

export default dbStorage;
