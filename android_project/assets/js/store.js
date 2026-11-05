// js/store.js - Central Reactive Store & Multi-Device Cloud Sync Simulation
import { INITIAL_PRODUCTS, INITIAL_INVENTORY, INITIAL_RECIPES, INITIAL_INVOICES, INITIAL_SETTINGS } from './models.js';

class AppStore {
  constructor() {
    this.listeners = [];
    this.storageKey = "sweet_smile_app_state_v1";
    this.cart = [];
    this.state = this.loadState();

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
    }
  }

  loadState() {
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    try {
      if (typeof localStorage !== "undefined") {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            products: parsed.products || INITIAL_PRODUCTS,
            inventory: parsed.inventory || INITIAL_INVENTORY,
            recipes: parsed.recipes || INITIAL_RECIPES,
            invoices: parsed.invoices || INITIAL_INVOICES,
            settings: { ...INITIAL_SETTINGS, ...(parsed.settings || {}) },
            isOnline,
            cloudSyncStatus: "synced" // "synced", "syncing", "offline", "error"
          };
        }
      }
    } catch (e) {
      console.warn("Error loading from localStorage, using initial seed data", e);
    }
    return {
      products: INITIAL_PRODUCTS,
      inventory: INITIAL_INVENTORY,
      recipes: INITIAL_RECIPES,
      invoices: INITIAL_INVOICES,
      settings: INITIAL_SETTINGS,
      isOnline,
      cloudSyncStatus: "synced"
    };
  }

  saveState() {
    try {
      const payload = {
        products: this.state.products,
        inventory: this.state.inventory,
        recipes: this.state.recipes,
        invoices: this.state.invoices,
        settings: this.state.settings
      };
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(this.storageKey, JSON.stringify(payload));
      }
      this.triggerCloudSyncSimulation();
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notify(event, data) {
    this.listeners.forEach(fn => {
      try {
        fn(event, data, this.state);
      } catch (err) {
        console.error("Error in store subscriber:", err);
      }
    });
  }

  handleNetworkChange(isOnline) {
    this.state.isOnline = isOnline;
    this.state.cloudSyncStatus = isOnline ? "synced" : "offline";
    this.notify("network_change", { isOnline });
  }

  triggerCloudSyncSimulation() {
    if (!this.state.isOnline) {
      this.state.cloudSyncStatus = "offline";
      this.notify("sync_change", { status: "offline" });
      return;
    }
    this.state.cloudSyncStatus = "syncing";
    this.notify("sync_change", { status: "syncing" });
    setTimeout(() => {
      this.state.cloudSyncStatus = "synced";
      this.state.settings.lastSync = new Date().toISOString();
      this.notify("sync_change", { status: "synced", lastSync: this.state.settings.lastSync });
    }, 700);
  }

  // --- PRODUCTS ---
  getProducts() {
    return this.state.products;
  }

  getProduct(id) {
    return this.state.products.find(p => p.id === id);
  }

  saveProduct(product) {
    if (product.id) {
      const index = this.state.products.findIndex(p => p.id === product.id);
      if (index >= 0) {
        this.state.products[index] = { ...this.state.products[index], ...product };
      } else {
        this.state.products.push(product);
      }
    } else {
      product.id = "p-" + Date.now() + "-" + Math.floor(100 + Math.random() * 900);
      this.state.products.push(product);
    }
    this.saveState();
    this.notify("products_changed", this.state.products);
    return product;
  }

  deleteProduct(id) {
    this.state.products = this.state.products.filter(p => p.id !== id);
    this.saveState();
    this.notify("products_changed", this.state.products);
  }

  // --- INVENTORY ---
  getInventory() {
    return this.state.inventory;
  }

  getInventoryItem(id) {
    return this.state.inventory.find(i => i.id === id);
  }

  saveInventoryItem(item) {
    if (item.id) {
      const idx = this.state.inventory.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        this.state.inventory[idx] = { ...this.state.inventory[idx], ...item };
      } else {
        this.state.inventory.push(item);
      }
    } else {
      item.id = "inv-" + Date.now() + "-" + Math.floor(100 + Math.random() * 900);
      this.state.inventory.push(item);
    }
    this.saveState();
    this.notify("inventory_changed", this.state.inventory);
    return item;
  }

  deleteInventoryItem(id) {
    this.state.inventory = this.state.inventory.filter(i => i.id !== id);
    this.saveState();
    this.notify("inventory_changed", this.state.inventory);
  }

  findMatchingInventoryItem(nameOrId) {
    if (!nameOrId || (typeof nameOrId !== "string" && typeof nameOrId !== "number")) return null;
    const rawStr = String(nameOrId).trim();
    if (!rawStr) return null;
    if (!this.state.inventory || !this.state.inventory.length) return null;

    // 0. Match by ID directly if applicable
    const byId = this.state.inventory.find(i => i.id === rawStr);
    if (byId) return byId;

    const stripAccents = (str) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    const ingNorm = stripAccents(rawStr);

    // 1. Exact match (case-insensitive, trimmed, accent-insensitive)
    const exact = this.state.inventory.find(inv => inv.name && stripAccents(inv.name).trim() === ingNorm);
    if (exact) return exact;

    // 2. Normalized keyword / token overlap matching with culinary qualifiers & substantive filters
    const stopWords = new Set([
      "de", "del", "en", "la", "el", "los", "las", "un", "una", "unos", "unas",
      "y", "o", "con", "sin", "para", "al", "a", "por", "&",
      "fresco", "fresca", "frescos", "frescas",
      "entero", "entera", "enteros", "enteras",
      "especial", "especiales",
      "extra", "extras",
      "artesanal", "artesanales",
      "maduro", "madura", "maduros", "maduras",
      "tipo", "puro", "pura", "puros", "puras",
      "natural", "naturales",
      "organico", "organica", "organicos", "organicas",
      "comun", "comunes",
      "sobrante", "sobrantes"
    ]);

    const stemToken = (token) => {
      let t = stripAccents(token);
      if (t === "philadelphia") t = "filadelfia";
      if (t.endsWith("es") && t.length > 4) t = t.slice(0, -2);
      else if (t.endsWith("s") && t.length > 3) t = t.slice(0, -1);
      return t;
    };

    const tokenize = (str) =>
      stripAccents(str)
        .replace(/[^\w\s%]/gi, " ")
        .split(/\s+/)
        .filter(w => w.length > 1 && !stopWords.has(w))
        .map(w => stemToken(w));

    const ingTokens = tokenize(rawStr);
    if (ingTokens.length === 0) return null;

    let bestMatch = null;
    let maxScore = 0;

    for (const inv of this.state.inventory) {
      if (!inv.name) continue;
      const invTokens = tokenize(inv.name);
      if (invTokens.length === 0) continue;

      // Substantive noun domain guard: cheese products cannot match cream-only ingredients and vice versa
      if (invTokens.includes("queso") && !ingTokens.includes("queso")) continue;
      if (ingTokens.includes("queso") && !invTokens.includes("queso")) continue;

      let score = 0;
      for (const token of ingTokens) {
        if (invTokens.some(t => t === token || t.includes(token) || token.includes(t))) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = inv;
      }
    }

    return maxScore > 0 ? bestMatch : null;
  }

  // --- RECIPES ---
  getRecipes() {
    return this.state.recipes;
  }

  getRecipe(id) {
    return this.state.recipes.find(r => r.id === id);
  }

  saveRecipe(recipe) {
    if (recipe.id) {
      const idx = this.state.recipes.findIndex(r => r.id === recipe.id);
      if (idx >= 0) {
        this.state.recipes[idx] = { ...this.state.recipes[idx], ...recipe };
      } else {
        this.state.recipes.push(recipe);
      }
    } else {
      recipe.id = "rec-" + Date.now() + "-" + Math.floor(100 + Math.random() * 900);
      recipe.code = "#" + Math.floor(100 + Math.random() * 900);
      this.state.recipes.push(recipe);
    }
    this.saveState();
    this.notify("recipes_changed", this.state.recipes);
    return recipe;
  }

  deleteRecipe(id) {
    this.state.recipes = this.state.recipes.filter(r => r.id !== id);
    this.saveState();
    this.notify("recipes_changed", this.state.recipes);
  }

  // --- INVOICES & SALES ---
  getInvoices() {
    return this.state.invoices;
  }

  getInvoice(id) {
    return this.state.invoices.find(inv => inv.id === id);
  }

  saveInvoice(invoice) {
    if (invoice.id) {
      const idx = this.state.invoices.findIndex(inv => inv.id === invoice.id);
      if (idx >= 0) {
        this.state.invoices[idx] = { ...this.state.invoices[idx], ...invoice };
      } else {
        this.state.invoices.unshift(invoice);
      }
    } else {
      const isTicket = !invoice.type || invoice.type.toLowerCase() === "ticket";
      const prefix = isTicket ? "TIK-" : "FAC-";
      const num = Math.floor(10000 + Math.random() * 90000);
      invoice.id = prefix + num;
      if (!invoice.date) {
        invoice.date = new Date().toISOString().replace("T", " ").substring(0, 16);
      }
      this.state.invoices.unshift(invoice);

      // Decrement product stock and raw recipe ingredients
      if (invoice.items && Array.isArray(invoice.items)) {
        let productsChanged = false;

        invoice.items.forEach(it => {
          const qtySold = typeof it.quantity === "number" ? Math.max(0, it.quantity) : (parseFloat(it.quantity) || 0);
          if (qtySold <= 0) return;
          const prod = this.getProduct(it.productId) || this.state.products.find(p => p.id === it.productId || p.name === it.name);

          if (prod) {
            if (typeof prod.stock === "number") {
              prod.stock = Math.max(0, prod.stock - qtySold);
              productsChanged = true;
            }

            // Deduct recipe ingredients from raw pantry inventory
            if (prod.recipeId) {
              const recipe = this.getRecipe(prod.recipeId);
              if (recipe && Array.isArray(recipe.ingredients)) {
                const claimedInRecipe = new Map();

                recipe.ingredients.forEach(ing => {
                  const deductAmount = (parseFloat(ing.quantity) || 0) * qtySold;
                  const invItem = this.findMatchingInventoryItem(ing.name || ing.id || ing.inventoryId);
                  if (invItem && typeof invItem.stock === "number") {
                    // Prevent intra-recipe double deduction collision
                    if (claimedInRecipe.has(invItem.id)) {
                      const prior = claimedInRecipe.get(invItem.id);
                      const isSameId = (ing.inventoryId && prior.inventoryId && ing.inventoryId === prior.inventoryId) ||
                                       (ing.id && prior.id && ing.id === prior.id);
                      const isSameName = (ing.name && prior.name && ing.name.toLowerCase().trim() === prior.name.toLowerCase().trim());
                      if (!isSameId && !isSameName) {
                        return;
                      }
                    } else {
                      claimedInRecipe.set(invItem.id, ing);
                    }

                    invItem.stock = Math.max(0, Math.round((invItem.stock - deductAmount) * 100) / 100);

                    // Recalculate status based on minStock
                    const minStock = typeof invItem.minStock === "number" ? invItem.minStock : 0;
                    if (invItem.stock <= (minStock * 0.5)) {
                      invItem.status = "critical";
                    } else if (invItem.stock <= minStock) {
                      invItem.status = "warning";
                    } else {
                      invItem.status = "optimal";
                    }
                  }
                });
              }
            }
          }
        });

        if (productsChanged) {
          this.notify("products_changed", this.state.products);
        }
        this.notify("inventory_changed", this.state.inventory);
      }
    }
    this.saveState();
    this.notify("invoices_changed", this.state.invoices);
    return invoice;
  }

  deleteInvoice(id) {
    this.state.invoices = this.state.invoices.filter(inv => inv.id !== id);
    this.saveState();
    this.notify("invoices_changed", this.state.invoices);
  }

  // --- POS CART ---
  getCart() {
    return this.cart;
  }

  addToCart(productId, qty = 1) {
    const existing = this.cart.find(item => item.productId === productId);
    const prod = this.getProduct(productId);
    if (!prod) return;

    if (existing) {
      existing.quantity += qty;
    } else {
      this.cart.push({
        productId,
        name: prod.name,
        price: prod.price,
        quantity: qty,
        image: prod.image
      });
    }
    this.notify("cart_changed", this.cart);
  }

  updateCartQty(productId, qty) {
    if (qty <= 0) {
      this.cart = this.cart.filter(item => item.productId !== productId);
    } else {
      const item = this.cart.find(it => it.productId === productId);
      if (item) item.quantity = qty;
    }
    this.notify("cart_changed", this.cart);
  }

  clearCart() {
    this.cart = [];
    this.notify("cart_changed", this.cart);
  }

  // --- SETTINGS ---
  getSettings() {
    return this.state.settings;
  }

  updateSettings(newSettings) {
    this.state.settings = { ...this.state.settings, ...newSettings };
    this.saveState();
    this.notify("settings_changed", this.state.settings);
  }

  // --- EXPORT / IMPORT FOR MULTI-DEVICE SYNC ---
  exportBackup() {
    return JSON.stringify(this.state, null, 2);
  }

  importBackup(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.products && parsed.recipes) {
        this.state = {
          ...this.state,
          products: parsed.products,
          inventory: parsed.inventory || this.state.inventory,
          recipes: parsed.recipes,
          invoices: parsed.invoices || this.state.invoices,
          settings: { ...this.state.settings, ...(parsed.settings || {}) }
        };
        this.saveState();
        this.notify("state_reloaded", this.state);
        return true;
      }
    } catch (e) {
      console.error("Invalid JSON backup", e);
    }
    return false;
  }
}

export const store = new AppStore();
