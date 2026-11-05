// js/views/inventoryView.js - Stitch Screen 1: Gestión de Inventario, Insumos & Alertas
import { store } from '../store.js';

let currentCategoryFilter = "all";

export function renderInventoryView(container) {
  const inventory = store.getInventory();
  const settings = store.getSettings();

  const totalValue = inventory.reduce((sum, item) => sum + (item.stock * item.costPerUnit), 0);
  const optimalCount = inventory.filter(i => i.status === "optimal" || i.stock > i.minStock).length;
  const criticalCount = inventory.filter(i => i.status === "critical" || i.stock <= (i.minStock * 0.5)).length;
  const warningCount = inventory.filter(i => i.status === "warning" || (i.stock <= i.minStock && i.stock > (i.minStock * 0.5))).length;
  const outOfStockCount = inventory.filter(i => i.stock <= 0).length;

  const filteredItems = currentCategoryFilter === "all"
    ? inventory
    : inventory.filter(i => i.category.toLowerCase().includes(currentCategoryFilter.toLowerCase()));

  container.innerHTML = `
    <div class="flex flex-col w-full px-margin pb-28 gap-space-md">
      <!-- Tarjeta de Valor Monetizado -->
      <div class="relative overflow-hidden rounded-xl bg-surface-container-low p-space-md shadow-sm mt-1">
        <div class="flex items-start justify-between">
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-1.5 text-primary">
              <span class="material-symbols-outlined text-[18px]">inventory</span>
              <span class="font-label-sm text-label-sm uppercase tracking-wider font-semibold">Almacén Central & Despensa</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="font-data-metric text-data-metric text-on-surface font-extrabold tracking-tight">${settings.currency}${totalValue.toFixed(2)}</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">valor total en stock</span>
            </div>
          </div>
          <div class="w-10 h-10 rounded-full bg-secondary-container/40 flex items-center justify-center text-primary shadow-sm flex-shrink-0">
            <span class="material-symbols-outlined text-[22px]">payments</span>
          </div>
        </div>
        <div class="mt-space-sm pt-2 flex items-center justify-between text-on-surface-variant border-t border-surface-variant/40">
          <span class="font-body-sm text-body-sm flex items-center gap-1">
            <span class="inline-block w-2 h-2 rounded-full bg-primary"></span> ${inventory.length} referencias activas
          </span>
          <span class="font-label-sm text-label-sm text-primary font-semibold flex items-center gap-0.5">
            Auditado hoy
            <span class="material-symbols-outlined text-[14px]">history</span>
          </span>
        </div>
      </div>

      <!-- Métricas Rápidas en 2 Columnas (Bento 2x2) -->
      <div class="grid grid-cols-2 gap-space-xs">
        <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-surface-container-high text-primary flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-label-sm text-label-sm text-on-surface-variant truncate">En Stock Óptimo</span>
            <span class="font-headline-md text-headline-md text-on-surface font-bold">${optimalCount}</span>
          </div>
        </div>

        <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-tertiary-fixed text-tertiary flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-[20px]">error_outline</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-label-sm text-label-sm text-on-surface-variant truncate">Stock Crítico</span>
            <span class="font-headline-md text-headline-md text-tertiary font-bold">${criticalCount}</span>
          </div>
        </div>

        <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-secondary-fixed text-secondary flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-[20px]">shelves</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-label-sm text-label-sm text-on-surface-variant truncate">Total Insumos</span>
            <span class="font-headline-md text-headline-md text-on-surface font-bold">${inventory.length}</span>
          </div>
        </div>

        <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-surface-container-highest text-outline flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-[20px]">remove_shopping_cart</span>
          </div>
          <div class="flex flex-col min-w-0">
            <span class="font-label-sm text-label-sm text-on-surface-variant truncate">Agotados</span>
            <span class="font-headline-md text-headline-md text-outline font-bold">${outOfStockCount}</span>
          </div>
        </div>
      </div>

      <!-- Tarjeta Suave de Alerta Urgente Fin de Semana -->
      <div class="bg-tertiary-fixed/60 rounded-xl p-space-md shadow-sm flex items-start gap-3">
        <div class="w-8 h-8 rounded-full bg-tertiary text-on-tertiary flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
          <span class="material-symbols-outlined text-[18px]">warning</span>
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between">
            <h2 class="font-headline-sm text-headline-sm text-on-tertiary-fixed font-bold leading-tight">Urgencia Producción</h2>
            <span class="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary font-bold tracking-wide">PEDIDOS SAB/DOM</span>
          </div>
          <p class="font-body-sm text-body-sm text-on-tertiary-fixed-variant mt-1 leading-snug">
            Insumos prioritarios para reponer antes del fin de semana (<strong class="font-bold">Mantequilla</strong>, <strong class="font-bold">Fresas</strong> y <strong class="font-bold">Cajas 22cm</strong>).
          </p>
          <div class="mt-2.5 flex items-center gap-2">
            <button class="px-3 py-1.5 rounded-full bg-tertiary text-on-tertiary font-label-md text-label-md shadow-sm active:scale-95 transition-all flex items-center gap-1.5 font-bold" id="btnBuyUrgent" type="button">
              <span class="material-symbols-outlined text-[15px]">send_time_extension</span>
              <span>Comprar Urgente</span>
            </button>
            <span class="font-label-sm text-label-sm text-on-tertiary-fixed font-medium">Proveedor entrega en 4h</span>
          </div>
        </div>
      </div>

      <!-- Buscador y Chips de Categoría -->
      <div class="flex flex-col gap-space-xs">
        <div class="relative w-full">
          <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline text-[20px]">search</span>
          <input class="w-full h-11 pl-10 pr-10 rounded-xl bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none focus:ring-2 focus:ring-primary shadow-sm" id="invSearchInput" placeholder="Buscar por insumo, lote o proveedor..." type="text"/>
        </div>
        
        <div class="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none -mx-margin px-margin no-scrollbar">
          <button class="inv-cat-pill px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap shadow-sm ${currentCategoryFilter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="all" type="button">
            Todos (${inventory.length})
          </button>
          <button class="inv-cat-pill px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap shadow-sm ${currentCategoryFilter === 'Lácteos' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="Lácteos" type="button">
            Lácteos
          </button>
          <button class="inv-cat-pill px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap shadow-sm ${currentCategoryFilter === 'Harinas' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="Harinas" type="button">
            Harinas & Azúcares
          </button>
          <button class="inv-cat-pill px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap shadow-sm ${currentCategoryFilter === 'Frutas' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="Frutas" type="button">
            Frutas & Rellenos
          </button>
          <button class="inv-cat-pill px-3.5 py-1.5 rounded-full font-label-md text-label-md whitespace-nowrap shadow-sm ${currentCategoryFilter === 'Packaging' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="Packaging" type="button">
            Packaging
          </button>
        </div>
      </div>

      <!-- Botones de Acción Primarios -->
      <div class="flex flex-col gap-2">
        <button class="w-full h-12 rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-transform font-bold" id="btnAddSupplyEntry" type="button">
          <span class="material-symbols-outlined text-[22px]">add_circle</span>
          <span>Registrar Entrada de Insumo (Factura)</span>
        </button>
        <button class="w-full h-11 rounded-xl bg-surface-container-lowest text-primary font-headline-sm text-headline-sm flex items-center justify-center gap-2 shadow-sm hover:bg-surface-container transition-colors font-bold border border-surface-variant/40" id="btnGenerateShoppingList" type="button">
          <span class="material-symbols-outlined text-[20px]">assignment</span>
          <span>Generar Lista de Compras para WhatsApp</span>
        </button>
      </div>

      <!-- Encabezado de Lista Detallada -->
      <div class="flex items-center justify-between pt-1">
        <span class="font-headline-sm text-headline-sm text-on-surface font-bold">Inventario Activo</span>
        <span class="text-xs text-primary font-bold">Prioridad: Críticos</span>
      </div>

      <!-- Lista Detallada de Insumos -->
      <div class="flex flex-col gap-space-sm" id="inventoryList">
        ${filteredItems.map(item => {
          const isCritical = item.status === "critical" || item.stock <= (item.minStock * 0.5);
          const percent = Math.min(100, Math.round((item.stock / (item.minStock * 1.5)) * 100));

          return `
            <div class="inv-item-card bg-surface-container-lowest p-3.5 rounded-2xl shadow-sm flex flex-col gap-2.5 border ${isCritical ? 'border-tertiary-container/60' : 'border-surface-variant/40'}" data-id="${item.id}">
              <div class="flex items-start justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  <div class="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container-high flex items-center justify-center">
                    ${item.image ? `<img class="w-full h-full object-cover" src="${item.image}" />` : `<span class="material-symbols-outlined text-[24px] text-primary">inventory_2</span>`}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-semibold text-primary uppercase">${item.category}</span>
                      ${isCritical ? '<span class="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-tertiary-fixed text-tertiary">Bajo Stock</span>' : ''}
                    </div>
                    <h3 class="font-label-lg font-bold text-on-surface truncate">${item.name}</h3>
                    <span class="text-xs text-on-surface-variant">Proveedor: ${item.supplier || 'Proveedor Directo'}</span>
                  </div>
                </div>
                <div class="text-right flex-shrink-0">
                  <div class="flex items-baseline justify-end gap-1">
                    <span class="text-xl font-extrabold ${isCritical ? 'text-tertiary' : 'text-on-surface'}">${item.stock}</span>
                    <span class="text-xs text-on-surface-variant font-medium">${item.unit}</span>
                  </div>
                  <span class="text-xs text-on-surface-variant block font-medium">${settings.currency}${Number(item.costPerUnit).toFixed(2)}/${item.unit}</span>
                </div>
              </div>

              <!-- Stock Bar -->
              <div class="flex items-center gap-2">
                <div class="flex-1 h-2 bg-surface-container rounded-full overflow-hidden">
                  <div class="h-full rounded-full ${isCritical ? 'bg-tertiary' : 'bg-primary'}" style="width: ${percent}%;"></div>
                </div>
                <span class="text-[11px] text-on-surface-variant">Mín: ${item.minStock} ${item.unit}</span>
              </div>

              <!-- Quick stock modifiers: +1 / -1 / Edit -->
              <div class="flex items-center justify-between pt-1 border-t border-surface-variant/30">
                <span class="text-xs text-on-surface-variant">Vence: ${item.expDate || 'N/A'}</span>
                <div class="flex items-center gap-1.5">
                  <button class="inv-minus-btn w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors font-bold" data-id="${item.id}">
                    -
                  </button>
                  <button class="inv-plus-btn w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center hover:opacity-90 transition-opacity font-bold" data-id="${item.id}">
                    +
                  </button>
                  <button class="inv-edit-btn w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-primary hover:bg-surface-container-high transition-colors" data-id="${item.id}" title="Editar Insumo">
                    <span class="material-symbols-outlined text-[16px]">edit</span>
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  attachInventoryEvents(container);
}

function attachInventoryEvents(container) {
  const inventory = store.getInventory();
  const settings = store.getSettings();

  // Category filter
  container.querySelectorAll(".inv-cat-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      currentCategoryFilter = pill.getAttribute("data-cat");
      renderInventoryView(container);
    });
  });

  // Search input
  const searchInput = container.querySelector("#invSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      container.querySelectorAll(".inv-item-card").forEach(card => {
        const id = card.getAttribute("data-id");
        const it = store.getInventoryItem(id);
        if (it && (it.name.toLowerCase().includes(q) || it.category.toLowerCase().includes(q) || (it.supplier && it.supplier.toLowerCase().includes(q)))) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  }

  // Stock quick +/-
  container.querySelectorAll(".inv-plus-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const item = store.getInventoryItem(id);
      if (item) {
        item.stock = Math.round((item.stock + 1) * 10) / 10;
        store.saveInventoryItem(item);
        renderInventoryView(container);
      }
    });
  });

  container.querySelectorAll(".inv-minus-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const item = store.getInventoryItem(id);
      if (item && item.stock > 0) {
        item.stock = Math.max(0, Math.round((item.stock - 1) * 10) / 10);
        store.saveInventoryItem(item);
        renderInventoryView(container);
      }
    });
  });

  // Edit Supply
  container.querySelectorAll(".inv-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const item = store.getInventoryItem(id);
      if (!item) return;

      const newStock = prompt(`Stock actual de ${item.name} (${item.unit}):`, item.stock);
      if (newStock === null) return;
      const newCost = prompt(`Costo por ${item.unit} ($):`, item.costPerUnit);
      if (newCost === null) return;

      item.stock = parseFloat(newStock) || item.stock;
      item.costPerUnit = parseFloat(newCost) || item.costPerUnit;
      store.saveInventoryItem(item);
      renderInventoryView(container);
    });
  });

  // Add Supply Entry
  container.querySelector("#btnAddSupplyEntry")?.addEventListener("click", () => {
    const name = prompt("Nombre del nuevo insumo:", "Chocolate Blanco 32%");
    if (!name) return;
    const category = prompt("Categoría (Lácteos, Harinas, Frutas, Packaging):", "Harinas") || "Harinas";
    const stock = parseFloat(prompt("Cantidad inicial recibida:", "5.0")) || 1.0;
    const unit = prompt("Unidad (kg, L, unid, kit):", "kg") || "kg";
    const costPerUnit = parseFloat(prompt("Costo unitario de compra ($):", "12.50")) || 5.0;
    const supplier = prompt("Proveedor:", "Distribuidora Dulce") || "Proveedor Directo";

    store.saveInventoryItem({
      name,
      category,
      stock,
      unit,
      minStock: stock * 0.5,
      costPerUnit,
      supplier,
      expDate: "2027-01-01",
      status: "optimal",
      image: null
    });

    renderInventoryView(container);
  });

  // Generate Shopping List for WhatsApp
  container.querySelector("#btnGenerateShoppingList")?.addEventListener("click", () => {
    const critical = inventory.filter(i => i.stock <= i.minStock);
    if (critical.length === 0) {
      alert("¡Todos los insumos están en nivel óptimo!");
      return;
    }

    const lines = critical.map(i => `• ${i.name}: Pedir ${(i.minStock * 2 - i.stock).toFixed(1)} ${i.unit} (Stock actual: ${i.stock})`).join("\n");
    const msg = `📋 *LISTA DE COMPRAS - SWEET SMILE PASTRY*\n\nInsumos requeridos con urgencia:\n${lines}\n\nPor favor confirmar disponibilidad y fecha de entrega.`;

    const encoded = encodeURIComponent(msg);
    const whatsappUrl = `https://wa.me/?text=${encoded}`;
    window.open(whatsappUrl, "_blank");
  });

  // Urgent Buy button
  container.querySelector("#btnBuyUrgent")?.addEventListener("click", () => {
    container.querySelector("#btnGenerateShoppingList")?.click();
  });
}
