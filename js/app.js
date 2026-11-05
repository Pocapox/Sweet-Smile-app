// js/app.js - Master Application Coordinator, Router & Cloud Sync Controller
import { store } from './store.js';
import { notifications } from './notifications.js';
import { googleSync } from './google-sync.js';
import { dbStorage, initDB, saveToIndexedDB, loadFromIndexedDB } from './db.js';
import { renderDashboardView } from './views/dashboardView.js';
import { renderPosView } from './views/posView.js';
import { renderRecipesView } from './views/recipesView.js';
import { renderInventoryView } from './views/inventoryView.js';
import { renderChefAIView } from './views/chefAIView.js';
import { renderCatalogShareView } from './views/catalogShareView.js';

class App {
  constructor() {
    this.mainContainer = document.getElementById("app-main-content");
    this.pageTitle = document.getElementById("headerPageTitle");
    this.cloudPill = document.getElementById("cloudSyncPill");
    this.init();
  }

  init() {
    // Initialize Offline-First IndexedDB Resilience
    initDB().then(() => {
      saveToIndexedDB("app_state", store.state).catch(() => {});
    }).catch(err => {
      console.warn("IndexedDB initialization warning:", err);
    });

    // Initialize Google Sync Manager
    googleSync.init(store);
    googleSync.subscribe(() => {
      this.updateCloudSyncUI();
    });

    // Register Service Worker for Offline Mode
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").then(reg => {
          console.log("Service Worker registered successfully", reg.scope);
        }).catch(err => {
          console.warn("Service Worker registration failed", err);
        });
      });
    }

    // Hash router
    window.addEventListener("hashchange", () => this.handleRoute());
    
    // Store subscriptions
    store.subscribe((event, data, state) => this.handleStoreEvent(event, data, state));

    // Initial setup
    this.setupTopHeader();
    this.setupBottomNav();
    this.setupNotificationsModal();
    this.setupSyncModal();
    this.updateCloudSyncUI();

    // Check expiration dates on launch
    setTimeout(() => {
      notifications.checkExpiringInventory();
    }, 1500);

    // Initial route
    this.handleRoute();
  }

  handleRoute() {
    const hash = window.location.hash || "#dashboard";
    const [route, subroute] = hash.replace("#", "").split("-");

    // Update bottom nav active state
    document.querySelectorAll(".nav-link").forEach(link => {
      const target = link.getAttribute("data-route");
      if (target === route || (route === "pos" && target === "pos") || (route === "inicio" && target === "dashboard")) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });

    // Render corresponding view
    switch (route) {
      case "dashboard":
      case "inicio":
      default:
        this.pageTitle.innerText = "Inicio / Finanzas";
        renderDashboardView(this.mainContainer);
        break;
      case "pos":
        this.pageTitle.innerText = subroute === "invoices" ? "Facturas Emitidas" : "Ventas & Facturas";
        renderPosView(this.mainContainer, subroute);
        break;
      case "recetario":
      case "recetas":
        this.pageTitle.innerText = "Recetario & Costos";
        renderRecipesView(this.mainContainer);
        break;
      case "inventario":
      case "stock":
        this.pageTitle.innerText = "Inventario & Insumos";
        renderInventoryView(this.mainContainer);
        break;
      case "asistente":
      case "ia":
        this.pageTitle.innerText = "Asistente Chef IA";
        renderChefAIView(this.mainContainer);
        break;
      case "catalogo":
        this.pageTitle.innerText = "Catálogo Web & QR";
        renderCatalogShareView(this.mainContainer);
        break;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  setupTopHeader() {
    // Cloud Sync click opens multi-device sync modal
    this.cloudPill?.addEventListener("click", () => {
      document.getElementById("syncModal")?.classList.remove("hidden");
      this.updateSyncModalUI();
    });

    // Notifications bell
    document.getElementById("headerNotificationsBtn")?.addEventListener("click", () => {
      document.getElementById("notificationsModal")?.classList.remove("hidden");
      this.renderActiveTimersList();
    });

    // Request notification permission proactively
    notifications.requestPermission();
  }

  setupBottomNav() {
    document.querySelectorAll(".nav-link").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const target = link.getAttribute("data-route");
        window.location.hash = `#${target}`;
      });
    });
  }

  setupNotificationsModal() {
    const modal = document.getElementById("notificationsModal");
    document.getElementById("closeNotificationsModal")?.addEventListener("click", () => {
      modal?.classList.add("hidden");
    });

    // New Timer Trigger
    document.getElementById("btnNewTimer")?.addEventListener("click", () => {
      const label = prompt("Nombre de la preparación o receta:", "Torta en Horno");
      if (!label) return;
      const mins = parseFloat(prompt("Minutos en horno:", "35")) || 15;
      notifications.addBakingTimer(label, mins);
      this.renderActiveTimersList();
    });
  }

  renderActiveTimersList() {
    const list = document.getElementById("activeTimersList");
    if (!list) return;

    const timers = notifications.getActiveTimers();
    if (timers.length === 0) {
      list.innerHTML = `
        <div class="p-4 text-center text-xs text-on-surface-variant bg-surface-container rounded-xl">
          No hay temporizadores de cocina activos en este momento.
        </div>
      `;
      return;
    }

    list.innerHTML = timers.map(t => {
      const mins = Math.floor(t.remainingSeconds / 60);
      const secs = t.remainingSeconds % 60;
      const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
      return `
        <div class="flex items-center justify-between p-3 rounded-xl bg-surface-container-low border border-surface-variant/30">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px]">timer</span>
            </div>
            <div>
              <h5 class="font-bold text-xs text-on-surface">${t.label}</h5>
              <span class="text-xs text-primary font-mono font-bold">${formatted} restantes</span>
            </div>
          </div>
          <button class="text-xs text-tertiary font-bold hover:underline" onclick="window.cancelTimer('${t.id}')">
            Cancelar
          </button>
        </div>
      `;
    }).join("");
  }

  setupSyncModal() {
    const modal = document.getElementById("syncModal");
    document.getElementById("closeSyncModal")?.addEventListener("click", () => {
      modal?.classList.add("hidden");
    });

    // Google Cloud / Drive connect trigger
    document.getElementById("btnConnectGoogle")?.addEventListener("click", () => {
      const currentToken = googleSync.getGoogleConfig().accessToken || "";
      const currentEndpoint = googleSync.getGoogleConfig().cloudEndpoint || "";
      const input = prompt("Introduce tu Google OAuth Token o endpoint de Google Cloud REST:", currentToken || currentEndpoint);
      if (input !== null) {
        if (input.startsWith("http")) {
          googleSync.setGoogleConfig({ cloudEndpoint: input.trim(), accessToken: "" });
        } else {
          googleSync.connectGoogle({ accessToken: input.trim() });
        }
        alert("Configuración de Google guardada con éxito.");
        this.updateSyncModalUI();
        this.updateCloudSyncUI();
      }
    });

    // Export backup JSON
    document.getElementById("btnExportBackup")?.addEventListener("click", () => {
      const backupData = googleSync.exportBackup();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(backupData);
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `SweetSmile_Backup_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    // Import backup JSON
    const fileInp = document.getElementById("importBackupFile");
    document.getElementById("btnImportBackupTrigger")?.addEventListener("click", () => {
      fileInp?.click();
    });

    if (fileInp) {
      fileInp.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = async (ev) => {
            const ok = await googleSync.importBackup(ev.target.result);
            if (ok) {
              alert("¡Copia de seguridad restaurada con éxito! Todos tus dispositivos sincronizados.");
              modal?.classList.add("hidden");
              this.handleRoute();
            } else {
              alert("Archivo de copia de seguridad no válido.");
            }
          };
          reader.readAsText(file);
        }
      });
    }

    // Force Sync button
    document.getElementById("btnForceSync")?.addEventListener("click", async () => {
      const forceSyncBtn = document.getElementById("btnForceSync");
      const btnText = document.getElementById("btnForceSyncText");
      if (forceSyncBtn) forceSyncBtn.disabled = true;
      if (btnText) btnText.innerText = "Sincronizando...";

      try {
        const res = await googleSync.syncNow();
        if (res.success) {
          alert("Sincronización con Google Cloud completada con éxito.");
        } else if (res.reason === "offline") {
          alert("Sin conexión a Internet. Los cambios se guardaron localmente y se sincronizarán al reconectar.");
        } else {
          alert("Error durante la sincronización: " + (res.error || "Servidor no disponible"));
        }
      } catch (err) {
        console.error("Force sync failed:", err);
      } finally {
        if (forceSyncBtn) forceSyncBtn.disabled = false;
        if (btnText) btnText.innerText = "Sincronizar Ahora";
        this.updateSyncModalUI();
        this.updateCloudSyncUI();
      }
    });

    this.updateSyncModalUI();
  }

  updateSyncModalUI() {
    const status = googleSync.getStatus();
    const statusTextEl = document.getElementById("syncModalStatusText");
    const statusDotEl = document.getElementById("syncModalStatusDot");
    const pendingBadgeEl = document.getElementById("syncModalPendingBadge");
    const lastSyncEl = document.getElementById("syncModalLastSync");
    const googleBadgeEl = document.getElementById("syncModalGoogleBadge");

    if (statusTextEl) {
      statusTextEl.innerText = status.statusLabel;
    }

    if (statusDotEl) {
      if (!status.isOnline) {
        statusDotEl.className = "w-2.5 h-2.5 rounded-full bg-slate-400";
      } else if (status.status === "syncing") {
        statusDotEl.className = "w-2.5 h-2.5 rounded-full bg-primary animate-ping";
      } else if (status.pendingCount > 0 || status.status === "pending") {
        statusDotEl.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
      } else {
        statusDotEl.className = "w-2.5 h-2.5 rounded-full bg-[#10b981]";
      }
    }

    if (pendingBadgeEl) {
      pendingBadgeEl.innerText = `${status.pendingCount} pendiente${status.pendingCount === 1 ? '' : 's'}`;
    }

    if (lastSyncEl) {
      if (!status.lastSync) {
        lastSyncEl.innerText = "Pendiente inicial";
      } else {
        try {
          const d = new Date(status.lastSync);
          lastSyncEl.innerText = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        } catch {
          lastSyncEl.innerText = status.lastSync;
        }
      }
    }

    if (googleBadgeEl) {
      if (status.hasGoogleConnection) {
        googleBadgeEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800";
        googleBadgeEl.innerText = "Conectado";
      } else {
        googleBadgeEl.className = "text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant";
        googleBadgeEl.innerText = "Sin configurar";
      }
    }
  }

  handleStoreEvent(event, data, state) {
    // Offline-first dual persistence: mirror all store updates to IndexedDB
    saveToIndexedDB("app_state", store.state).catch(() => {});

    // If offline, queue mutation for cloud sync
    if (!navigator.onLine && (event === "products_changed" || event === "inventory_changed" || event === "recipes_changed" || event === "invoices_changed" || event === "settings_changed")) {
      googleSync.queueMutation({
        entity: event.replace("_changed", ""),
        action: "update",
        item: data
      });
    }

    if (event === "sync_change" || event === "network_change" || event === "state_reloaded") {
      this.updateCloudSyncUI();
    }
    if (event === "timer_tick") {
      this.renderActiveTimersList();
    }
    if (event === "timer_completed") {
      this.renderActiveTimersList();
    }
  }

  updateCloudSyncUI() {
    if (!this.cloudPill) return;

    const status = googleSync.getStatus();

    if (!navigator.onLine || !status.isOnline) {
      this.cloudPill.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-outline/20 text-on-surface-variant font-label-sm text-[11px] font-semibold cursor-pointer";
      this.cloudPill.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-slate-400"></span>
        <span>Sin Conexión</span>
      `;
    } else if (status.status === "syncing" || store.state.cloudSyncStatus === "syncing") {
      this.cloudPill.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-primary font-label-sm text-[11px] font-semibold cursor-pointer";
      this.cloudPill.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-primary animate-ping"></span>
        <span>Sincronizando...</span>
      `;
    } else if (status.pendingCount > 0 || status.status === "pending") {
      this.cloudPill.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-label-sm text-[11px] font-semibold cursor-pointer";
      this.cloudPill.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>Pendiente</span>
      `;
    } else {
      this.cloudPill.className = "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-primary font-label-sm text-[11px] font-semibold cursor-pointer";
      this.cloudPill.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-[#10b981]"></span>
        <span>Sincronizado</span>
      `;
    }

    this.updateSyncModalUI();
  }
}

// Global hook for timer cancellation
window.cancelTimer = function(id) {
  notifications.cancelTimer(id);
};

// Global hooks for dev/console and external modules
if (typeof window !== "undefined") {
  window.googleSync = googleSync;
  window.dbStorage = dbStorage;
}

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  window.appInstance = new App();
});
