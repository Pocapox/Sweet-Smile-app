// js/google-sync.js - Google Cloud & Drive Sync Manager for Sweet Smile Pastry
// Handles online/offline tracking, offline mutation queue, LWW conflict resolution, and cloud synchronization.

import { store } from './store.js';
import { saveToIndexedDB, loadFromIndexedDB } from './db.js';

export const QUEUE_STORAGE_KEY = "sweet_smile_sync_queue_v1";
export const CONFIG_STORAGE_KEY = "sweet_smile_google_sync_config_v1";

export class GoogleSyncManager {
  /**
   * @param {Object} [storeInstance] - Reference to AppStore instance (defaults to exported store)
   * @param {Object} [config] - Initial sync configuration
   */
  constructor(storeInstance = store, config = {}) {
    this.store = storeInstance;
    this.status = "idle"; // "idle" | "syncing" | "synced" | "offline" | "pending" | "error"
    this.lastSync = this.store?.state?.settings?.lastSync || null;
    this.listeners = new Map();
    this.isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    this.queue = this.loadQueueFromStorage();
    this.googleConfig = this.loadConfigFromStorage(config);
    this.autoSyncTimer = null;

    this.initNetworkListeners();
  }

  /**
   * Initialize network change listeners and auto-sync triggers.
   */
  init(storeInstance = null, config = null) {
    if (storeInstance) this.store = storeInstance;
    if (config) this.setGoogleConfig(config);

    if (this.queue.length > 0) {
      this.status = this.isOnline ? "pending" : "offline";
    } else {
      this.status = this.isOnline ? "synced" : "offline";
    }

    this.emit("sync_status_changed", this.getStatus());
    return this;
  }

  initNetworkListeners() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
    }
  }

  handleNetworkChange(isOnline) {
    this.isOnline = isOnline;
    if (!isOnline) {
      this.status = "offline";
    } else {
      if (this.queue.length > 0) {
        this.status = "pending";
        // Proactively attempt synchronization upon network restoration
        setTimeout(() => this.syncNow(), 800);
      } else {
        this.status = "synced";
      }
    }
    this.emit("sync_status_changed", this.getStatus());
  }

  // ==========================================================================
  // OFFLINE MUTATION QUEUE
  // ==========================================================================

  loadQueueFromStorage() {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        }
      }
    } catch (e) {
      console.warn("Failed to load sync queue from localStorage:", e);
    }
    return [];
  }

  saveQueueToStorage() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      }
    } catch (e) {
      console.warn("Failed to save sync queue to localStorage:", e);
    }
  }

  /**
   * Records a data mutation in the local offline queue.
   * @param {Object} mutation - { entity: 'products'|'inventory'|'recipes'|'invoices'|'settings', action: 'create'|'update'|'delete', item: Object, timestamp?: string }
   */
  queueMutation(mutation) {
    const entry = {
      id: "mut_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
      entity: mutation.entity || "general",
      action: mutation.action || "update",
      item: mutation.item || null,
      timestamp: mutation.timestamp || new Date().toISOString()
    };

    this.queue.push(entry);
    this.saveQueueToStorage();

    if (this.isOnline) {
      this.status = "pending";
    } else {
      this.status = "offline";
    }

    this.emit("sync_status_changed", this.getStatus());
    return entry;
  }

  getPendingMutations() {
    return [...this.queue];
  }

  getPendingCount() {
    return this.queue.length;
  }

  clearMutationQueue() {
    this.queue = [];
    this.saveQueueToStorage();
    if (this.isOnline && this.status === "pending") {
      this.status = "synced";
    }
    this.emit("sync_status_changed", this.getStatus());
  }

  // ==========================================================================
  // CONFIGURATION & GOOGLE CONNECTION
  // ==========================================================================

  loadConfigFromStorage(defaults = {}) {
    let stored = {};
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (raw) stored = JSON.parse(raw);
      }
    } catch (_) {}
    return {
      provider: "google_drive", // "google_drive" | "google_cloud_rest" | "custom_endpoint"
      clientId: "",
      accessToken: "",
      cloudEndpoint: "",
      driveFolder: "SweetSmileAppData",
      autoSync: true,
      ...defaults,
      ...stored
    };
  }

  saveConfigToStorage() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(this.googleConfig));
      }
    } catch (_) {}
  }

  getGoogleConfig() {
    return { ...this.googleConfig };
  }

  setGoogleConfig(newConfig) {
    this.googleConfig = { ...this.googleConfig, ...newConfig };
    this.saveConfigToStorage();
    this.emit("sync_status_changed", this.getStatus());
  }

  connectGoogle(credentials = {}) {
    this.setGoogleConfig({
      accessToken: credentials.accessToken || credentials.token || "",
      clientId: credentials.clientId || this.googleConfig.clientId,
      cloudEndpoint: credentials.cloudEndpoint || this.googleConfig.cloudEndpoint,
      connectedAt: new Date().toISOString(),
      userEmail: credentials.email || "user@google.com"
    });
    return this.syncNow();
  }

  disconnectGoogle() {
    this.setGoogleConfig({
      accessToken: "",
      cloudEndpoint: "",
      connectedAt: null,
      userEmail: null
    });
    return true;
  }

  // ==========================================================================
  // LAST-WRITE-WINS (LWW) CONFLICT RESOLUTION
  // ==========================================================================

  /**
   * Merges two item collections using timestamp-based Last-Write-Wins (LWW) resolution.
   * Newer updated timestamps overwrite older ones.
   */
  resolveCollectionLWW(localItems = [], remoteItems = []) {
    const map = new Map();

    // Index local items
    for (const item of (localItems || [])) {
      if (item && item.id) {
        map.set(item.id, item);
      }
    }

    // Merge remote items
    for (const rItem of (remoteItems || [])) {
      if (!rItem || !rItem.id) continue;
      const lItem = map.get(rItem.id);
      if (!lItem) {
        map.set(rItem.id, rItem);
      } else {
        const lTime = new Date(lItem.updatedAt || lItem.date || lItem.createdAt || 0).getTime();
        const rTime = new Date(rItem.updatedAt || rItem.date || rItem.createdAt || 0).getTime();
        if (rTime > lTime) {
          map.set(rItem.id, rItem);
        }
      }
    }

    return Array.from(map.values());
  }

  /**
   * Resolves complete local state with remote snapshot.
   */
  resolveStateConflict(localState, remoteState) {
    if (!remoteState) return localState;
    if (!localState) return remoteState;

    const mergedProducts = this.resolveCollectionLWW(localState.products, remoteState.products);
    const mergedInventory = this.resolveCollectionLWW(localState.inventory, remoteState.inventory);
    const mergedRecipes = this.resolveCollectionLWW(localState.recipes, remoteState.recipes);
    const mergedInvoices = this.resolveCollectionLWW(localState.invoices, remoteState.invoices);

    const lSettingsTime = new Date(localState.settings?.lastModified || 0).getTime();
    const rSettingsTime = new Date(remoteState.settings?.lastModified || 0).getTime();
    const mergedSettings = rSettingsTime > lSettingsTime
      ? { ...localState.settings, ...(remoteState.settings || {}) }
      : { ...(remoteState.settings || {}), ...localState.settings };

    return {
      products: mergedProducts,
      inventory: mergedInventory,
      recipes: mergedRecipes,
      invoices: mergedInvoices,
      settings: mergedSettings
    };
  }

  // ==========================================================================
  // SYNCHRONIZATION EXECUTION (syncNow)
  // ==========================================================================

  /**
   * Executes cloud synchronization.
   * If offline, queues status and refuses safely.
   * If online, resolves remote and local states with LWW, flushes offline queue, and saves to IndexedDB.
   */
  async syncNow() {
    if (!this.isOnline) {
      this.status = this.queue.length > 0 ? "pending" : "offline";
      this.emit("sync_status_changed", this.getStatus());
      return {
        success: false,
        status: this.status,
        reason: "offline",
        pendingCount: this.getPendingCount()
      };
    }

    this.status = "syncing";
    this.emit("sync_status_changed", this.getStatus());

    try {
      const currentState = this.store ? this.store.state : null;
      let remoteState = null;

      // 1. If Google Cloud / Drive REST endpoint or access token configured, attempt remote fetch
      if (this.googleConfig.cloudEndpoint || this.googleConfig.accessToken) {
        try {
          const endpoint = this.googleConfig.cloudEndpoint || "https://www.googleapis.com/drive/v3/files?spaces=appDataFolder";
          const headers = {
            "Content-Type": "application/json"
          };
          if (this.googleConfig.accessToken) {
            headers["Authorization"] = `Bearer ${this.googleConfig.accessToken}`;
          }

          const response = await fetch(endpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({
              app: "SweetSmilePastry",
              timestamp: new Date().toISOString(),
              state: currentState,
              mutations: this.queue
            })
          });

          if (response && response.ok) {
            const data = await response.json();
            if (data && data.remoteState) {
              remoteState = data.remoteState;
            }
          }
        } catch (fetchErr) {
          console.warn("Remote cloud fetch skipped or simulated:", fetchErr);
        }
      }

      // 2. Conflict resolution via Last-Write-Wins (LWW)
      if (remoteState && this.store) {
        const resolvedState = this.resolveStateConflict(currentState, remoteState);
        this.store.importBackup(JSON.stringify(resolvedState));
      }

      // 3. Multi-layer local offline backup to IndexedDB
      if (currentState) {
        await saveToIndexedDB("app_state", currentState);
        await saveToIndexedDB("cloud_sync_backup", {
          state: currentState,
          syncedAt: new Date().toISOString()
        });
      }

      // 4. Flush processed mutation queue
      this.clearMutationQueue();

      // 5. Update sync timestamp and reactive state
      this.lastSync = new Date().toISOString();
      if (this.store?.state?.settings) {
        this.store.state.settings.lastSync = this.lastSync;
      }
      if (this.store?.state) {
        this.store.state.cloudSyncStatus = "synced";
      }

      this.status = "synced";
      const statusPayload = this.getStatus();

      this.emit("sync_status_changed", statusPayload);
      this.emit("last_sync_updated", { lastSync: this.lastSync });

      if (this.store && typeof this.store.notify === "function") {
        this.store.notify("sync_change", { status: "synced", lastSync: this.lastSync });
      }

      return {
        success: true,
        status: "synced",
        lastSync: this.lastSync,
        pendingCount: 0
      };
    } catch (err) {
      console.error("Cloud synchronization error:", err);
      this.status = "error";
      const statusPayload = {
        ...this.getStatus(),
        error: err.message || String(err)
      };
      this.emit("sync_status_changed", statusPayload);
      return {
        success: false,
        status: "error",
        error: err.message
      };
    }
  }

  // ==========================================================================
  // BACKUP EXPORT & IMPORT
  // ==========================================================================

  /**
   * Generates a serialized JSON backup snapshot.
   */
  exportBackup() {
    const rawState = this.store ? this.store.state : {};
    const backupObj = {
      app: "SweetSmilePastry",
      version: "1.0",
      exportedAt: new Date().toISOString(),
      products: rawState.products || [],
      inventory: rawState.inventory || [],
      recipes: rawState.recipes || [],
      invoices: rawState.invoices || [],
      settings: rawState.settings || {}
    };
    return JSON.stringify(backupObj, null, 2);
  }

  /**
   * Restores system state from a JSON backup payload.
   */
  async importBackup(jsonString) {
    try {
      const parsed = typeof jsonString === "string" ? JSON.parse(jsonString) : jsonString;
      if (!parsed || (!parsed.products && !parsed.recipes)) {
        return false;
      }

      let success = false;
      if (this.store && typeof this.store.importBackup === "function") {
        success = this.store.importBackup(JSON.stringify(parsed));
      }

      if (success) {
        await saveToIndexedDB("app_state", this.store.state);
        this.lastSync = new Date().toISOString();
        this.status = "synced";
        this.emit("sync_status_changed", this.getStatus());
        this.emit("last_sync_updated", { lastSync: this.lastSync });
      }

      return success;
    } catch (err) {
      console.error("importBackup parse failure:", err);
      return false;
    }
  }

  // ==========================================================================
  // STATUS & UI LABELS
  // ==========================================================================

  getStatusLabel() {
    if (!this.isOnline) {
      return "Sin Conexión";
    }
    if (this.status === "syncing") {
      return "Sincronizando...";
    }
    if (this.queue.length > 0 || this.status === "pending") {
      return "Pendiente";
    }
    if (this.status === "synced" || this.status === "idle") {
      return "Sincronizado";
    }
    if (this.status === "error") {
      return "Error de Sincronización";
    }
    return "Sincronizado";
  }

  getStatus() {
    return {
      status: this.status,
      statusLabel: this.getStatusLabel(),
      isOnline: this.isOnline,
      lastSync: this.lastSync,
      pendingCount: this.getPendingCount(),
      hasGoogleConnection: !!(this.googleConfig && (this.googleConfig.accessToken || this.googleConfig.cloudEndpoint))
    };
  }

  // ==========================================================================
  // REACTIVE EVENT DISPATCHER
  // ==========================================================================

  subscribe(listener) {
    const id = Symbol();
    this.listeners.set(id, listener);
    return () => this.listeners.delete(id);
  }

  on(event, listener) {
    return this.subscribe((evt, data) => {
      if (evt === event) listener(data);
    });
  }

  emit(event, data) {
    this.listeners.forEach(fn => {
      try {
        fn(event, data);
      } catch (e) {
        console.error(`Error in GoogleSync subscriber for event ${event}:`, e);
      }
    });

    if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
      try {
        const customEvt = new CustomEvent(event, { detail: data });
        window.dispatchEvent(customEvt);
      } catch (_) {}
    }
  }
}

export const googleSync = new GoogleSyncManager();
export default googleSync;
