import { store } from '../store.js';
import { uiToast, uiModal } from '../ui-feedback.js';

let currentCategory = "all";
let discountPercent = 0;
let tipAmount = 0;
let billingType = "ticket"; // "ticket" or "factura"
let activeTab = "pos"; // "pos" or "invoices"
let editingInvoiceId = null;

export function renderPosView(container, subRoute = "pos") {
  if (subRoute === "invoices") activeTab = "invoices";
  else activeTab = "pos";

  renderMainLayout(container);
}

function renderMainLayout(container) {
  const settings = store.getSettings();
  const products = store.getProducts();
  const cart = store.getCart();
  const invoices = store.getInvoices();

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountVal = (cartSubtotal * (discountPercent / 100));
  const cartTotal = Math.max(0, cartSubtotal - discountVal + tipAmount);

  container.innerHTML = `
    <div class="flex flex-col w-full px-margin pb-28 gap-space-md">
      <!-- POS Tabs: Nueva Venta vs Historial Facturas -->
      <div class="flex p-1 bg-surface-container rounded-xl shadow-xs mt-1">
        <button class="flex-1 py-2 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all ${activeTab === 'pos' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'}" id="tabPosBtn" type="button">
          <span class="material-symbols-outlined text-[18px]">point_of_sale</span>
          <span>Punto de Venta (POS)</span>
        </button>
        <button class="flex-1 py-2 rounded-lg font-label-md text-label-md flex items-center justify-center gap-1.5 transition-all ${activeTab === 'invoices' ? 'bg-surface-container-lowest text-primary font-bold shadow-sm' : 'text-on-surface-variant'}" id="tabInvoicesBtn" type="button">
          <span class="material-symbols-outlined text-[18px]">receipt_long</span>
          <span>Facturas Emitidas (${invoices.length})</span>
        </button>
      </div>

      ${activeTab === 'pos' ? renderPosScreen(products, settings) : renderInvoicesScreen(invoices, settings)}
    </div>

    <!-- Floating / Sticky POS Cart Bar (if items in cart and in POS tab) -->
    ${activeTab === 'pos' && cartCount > 0 ? `
      <div class="fixed bottom-16 left-0 right-0 p-3 bg-surface/90 backdrop-blur-md border-t border-surface-variant z-40">
        <div class="max-w-md mx-auto flex items-center justify-between gap-2.5 bg-primary text-on-primary p-3 rounded-2xl shadow-xl">
          <div class="flex items-center gap-2">
            <div class="w-10 h-10 rounded-xl bg-on-primary/20 flex items-center justify-center font-bold text-lg flex-shrink-0">
              ${cartCount}
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-xs text-primary-fixed uppercase tracking-wider font-semibold truncate">Total a Cobrar</span>
              <span class="text-xl font-extrabold tracking-tight">${settings.currency}${cartTotal.toFixed(2)}</span>
            </div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <button class="px-3 py-2 rounded-xl bg-on-primary/15 hover:bg-on-primary/25 text-on-primary font-label-md font-semibold transition-colors flex items-center gap-1" id="openCartModalBtn" type="button" title="Ver Carrito">
              <span class="material-symbols-outlined text-[18px]">shopping_cart</span>
              <span>Ver Carrito</span>
            </button>
            <button class="px-3.5 py-2.5 rounded-xl bg-secondary-fixed text-on-secondary-fixed font-label-md font-bold shadow-sm hover:scale-95 active:scale-90 transition-transform flex items-center gap-1.5" id="btnSaveSaleBar" type="button" title="Guardar Venta">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Guardar Venta</span>
            </button>
          </div>
        </div>
      </div>
    ` : ''}

    <!-- Modal Carrito & Checkout -->
    <div id="cartModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm hidden flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div class="bg-surface-container-lowest w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-200">
        <div class="p-4 border-b border-surface-variant flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">shopping_bag</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface font-bold">Completar Cobro & Factura</h3>
          </div>
          <button class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface" id="closeCartModalBtn">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div class="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
          <!-- Item list -->
          <div class="flex flex-col gap-2" id="cartModalItems">
            ${cart.map(item => `
              <div class="flex items-center justify-between p-2.5 rounded-xl bg-surface-container-low">
                <div class="flex items-center gap-2.5 min-w-0">
                  ${item.image ? `<img class="w-10 h-10 rounded-lg object-cover flex-shrink-0" src="${item.image}" />` : ''}
                  <div class="min-w-0">
                    <h5 class="font-label-lg font-bold text-on-surface truncate">${item.name}</h5>
                    <span class="font-body-sm text-on-surface-variant">${settings.currency}${item.price.toFixed(2)} c/u</span>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <button class="cart-minus-btn w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary" data-id="${item.productId}">-</button>
                  <span class="font-bold text-on-surface px-1">${item.quantity}</span>
                  <button class="cart-plus-btn w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary" data-id="${item.productId}">+</button>
                  <span class="font-bold text-on-surface w-16 text-right">${settings.currency}${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              </div>
            `).join("")}
          </div>

          <!-- Checkout details -->
          <div class="p-3 rounded-xl bg-surface-container flex flex-col gap-2 mt-2">
            <div class="flex items-center justify-between text-body-sm">
              <span class="text-on-surface-variant">Subtotal:</span>
              <span class="font-bold text-on-surface">${settings.currency}${cartSubtotal.toFixed(2)}</span>
            </div>
            <div class="flex items-center justify-between text-body-sm">
              <span class="text-on-surface-variant">Descuento (${discountPercent}%):</span>
              <span class="font-semibold text-tertiary">-${settings.currency}${discountVal.toFixed(2)}</span>
            </div>
            <div class="flex items-center justify-between text-body-sm">
              <span class="text-on-surface-variant">Propina sugerida:</span>
              <span class="font-semibold text-secondary">+${settings.currency}${tipAmount.toFixed(2)}</span>
            </div>
            <div class="border-t border-surface-variant/60 pt-2 flex items-center justify-between text-headline-sm font-bold text-primary">
              <span>Total Final:</span>
              <span>${settings.currency}${cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <!-- Customer info -->
          <div class="flex flex-col gap-2 mt-1">
            <label class="font-label-sm uppercase tracking-wider text-on-surface-variant">Datos del Cliente</label>
            <div class="grid grid-cols-2 gap-2">
              <input id="checkoutCustomerName" class="w-full bg-surface-container-low px-3 py-2 rounded-xl text-body-md text-on-surface outline-none" placeholder="Nombre del cliente" value="Cliente de Mostrador" />
              <input id="checkoutCustomerDoc" class="w-full bg-surface-container-low px-3 py-2 rounded-xl text-body-md text-on-surface outline-none" placeholder="RUT / DNI / RFC" value="CF" />
            </div>
          </div>

          <!-- Payment method -->
          <div class="flex flex-col gap-2 mt-1">
            <label class="font-label-sm uppercase tracking-wider text-on-surface-variant">Método de Pago</label>
            <select id="checkoutPaymentMethod" class="w-full bg-surface-container-low px-3 py-2.5 rounded-xl text-body-md text-on-surface outline-none">
              <option value="Efectivo">Efectivo</option>
              <option value="Tarjeta de Crédito / Débito">Tarjeta de Crédito / Débito</option>
              <option value="Transferencia Bancaria / Zelle">Transferencia Bancaria / Zelle</option>
              <option value="WhatsApp / Enlace de Pago">WhatsApp / Enlace de Pago</option>
            </select>
          </div>
        </div>

        <div class="p-4 border-t border-surface-variant bg-surface-container-low flex gap-2">
          <button class="flex-1 py-3 rounded-xl bg-primary text-on-primary font-headline-sm font-bold shadow-md hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2" id="confirmSaleBtn" type="button">
            <span class="material-symbols-outlined text-[20px]">check_circle</span>
            <span>Guardar Venta (${billingType === 'factura' ? 'Factura' : 'Ticket'})</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Modificar Factura Existente -->
    <div id="editInvoiceModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm hidden flex items-center justify-center p-4">
      <div class="bg-surface-container-lowest w-full max-w-lg rounded-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div class="p-4 border-b border-surface-variant flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">edit_note</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface font-bold" id="editModalTitle">Modificar Factura</h3>
          </div>
          <button class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant" id="closeEditInvoiceBtn">
            <span class="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div class="p-4 overflow-y-auto flex-1 flex flex-col gap-3" id="editInvoiceBody">
          <!-- Populated by JS -->
        </div>
      </div>
    </div>
  `;

  attachPosEvents(container);
}

function renderPosScreen(products, settings) {
  const filteredProducts = currentCategory === "all" 
    ? products 
    : products.filter(p => p.category === currentCategory);

  return `
    <!-- Buscador rápido & Lector de Barra -->
    <div class="flex items-center gap-space-xs">
      <div class="flex-1 flex items-center bg-surface-container-low rounded-xl px-space-sm py-2 shadow-sm transition-all focus-within:bg-surface-container-lowest focus-within:shadow-md">
        <span class="material-symbols-outlined text-outline text-[20px] mr-2">search</span>
        <input autocomplete="off" class="w-full bg-transparent border-0 outline-none text-on-surface font-body-md placeholder:text-outline text-body-md" id="posSearch" placeholder="Buscar dulce o código..." type="text"/>
      </div>
      <button aria-label="Escanear Código de Barras" class="w-11 h-11 flex-shrink-0 bg-secondary-container text-on-secondary-container rounded-xl flex items-center justify-center shadow-sm hover:scale-95 active:scale-90 transition-transform" id="posBarcodeBtn" title="Simular Escáner de Barra" type="button">
        <span class="material-symbols-outlined text-[22px]">barcode_scanner</span>
      </button>
      <button class="w-11 h-11 flex-shrink-0 bg-surface-container-high text-primary rounded-xl flex items-center justify-center shadow-sm hover:bg-surface-container transition-colors" id="posDocTypeToggle" title="Cambiar tipo de comprobante" type="button">
        <span class="material-symbols-outlined text-[22px]" id="docTypeIcon">${billingType === 'factura' ? 'description' : 'receipt_long'}</span>
      </button>
    </div>

    <!-- Selector Comprobante & Cliente Rápido -->
    <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex flex-col gap-space-xs">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[18px]">badge</span>
          <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Facturación</span>
        </div>
        <div class="flex bg-surface-container rounded-lg p-0.5" id="billingSegment">
          <button class="px-2.5 py-1 rounded-md text-label-sm font-label-sm ${billingType === 'ticket' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant'} transition-all" data-type="ticket" type="button">Ticket</button>
          <button class="px-2.5 py-1 rounded-md text-label-sm font-label-sm ${billingType === 'factura' ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant'} transition-all" data-type="factura" type="button">Factura Fiscal</button>
        </div>
      </div>
      <div class="${billingType === 'factura' ? '' : 'hidden'} pt-1 flex flex-col gap-1.5 transition-all" id="customerDetailsPanel">
        <div class="flex gap-2">
          <input class="flex-1 bg-surface-container-low px-2.5 py-1.5 rounded-lg text-body-sm font-body-sm text-on-surface outline-none placeholder:text-outline" id="quickRut" placeholder="RUT / RFC / DNI" type="text"/>
          <input class="flex-1 bg-surface-container-low px-2.5 py-1.5 rounded-lg text-body-sm font-body-sm text-on-surface outline-none placeholder:text-outline" id="quickCustomerName" placeholder="Razón Social / Cliente" type="text"/>
        </div>
      </div>
    </div>

    <!-- Categorías Pills -->
    <div class="overflow-x-auto -mx-margin px-margin py-0.5 flex items-center gap-2 no-scrollbar">
      <button class="cat-pill flex-shrink-0 px-4 py-2 rounded-full font-label-md text-label-md ${currentCategory === 'all' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'} transition-all" data-cat="all" type="button">
        Todo (${products.length})
      </button>
      <button class="cat-pill flex-shrink-0 px-4 py-2 rounded-full font-label-md text-label-md ${currentCategory === 'pasteles' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'} transition-all" data-cat="pasteles" type="button">
        Pasteles
      </button>
      <button class="cat-pill flex-shrink-0 px-4 py-2 rounded-full font-label-md text-label-md ${currentCategory === 'cupcakes' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'} transition-all" data-cat="cupcakes" type="button">
        Cupcakes
      </button>
      <button class="cat-pill flex-shrink-0 px-4 py-2 rounded-full font-label-md text-label-md ${currentCategory === 'galletas' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'} transition-all" data-cat="galletas" type="button">
        Galletas
      </button>
      <button class="cat-pill flex-shrink-0 px-4 py-2 rounded-full font-label-md text-label-md ${currentCategory === 'postres' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'} transition-all" data-cat="postres" type="button">
        Postres Fríos
      </button>
      <button class="cat-pill flex-shrink-0 px-4 py-2 rounded-full font-label-md text-label-md ${currentCategory === 'bebidas' ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'} transition-all" data-cat="bebidas" type="button">
        Bebidas
      </button>
    </div>

    <!-- Descuentos y Propinas Rápidas -->
    <div class="grid grid-cols-2 gap-space-xs">
      <button class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-primary font-label-md text-label-md transition-colors shadow-xs" id="quickDiscountBtn" type="button">
        <span class="material-symbols-outlined text-[18px]">percent</span>
        <span id="discountLabel">Descuento (${discountPercent}%)</span>
      </button>
      <button class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-surface-container-low hover:bg-surface-container text-secondary font-label-md text-label-md transition-colors shadow-xs" id="quickTipBtn" type="button">
        <span class="material-symbols-outlined text-[18px]">volunteer_activism</span>
        <span id="tipLabel">Propina (${settings.currency}${tipAmount.toFixed(2)})</span>
      </button>
    </div>

    <!-- Lista de Productos -->
    <div class="flex flex-col gap-space-sm" id="productList">
      ${filteredProducts.map(product => `
        <div class="product-item bg-surface-container-lowest rounded-2xl p-space-sm shadow-sm flex items-center justify-between gap-space-sm hover:shadow-md transition-all active:scale-[0.99]" data-id="${product.id}">
          <div class="relative w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container-high">
            ${product.image ? `
              <img class="w-full h-full object-cover" src="${product.image}" />
            ` : `
              <div class="w-full h-full flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[28px]">bakery_dining</span>
              </div>
            `}
            <span class="absolute top-1 left-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${product.stock <= 2 ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-secondary-fixed text-on-secondary-fixed'} flex items-center gap-0.5">
              ${product.stock <= 2 ? '<span class="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>' : ''}
              ${product.stock} disp.
            </span>
          </div>
          <div class="flex-1 min-w-0 flex flex-col justify-center">
            <div class="flex items-center gap-1">
              <span class="font-label-sm text-label-sm text-primary uppercase">${product.category}</span>
              ${product.stock <= 2 ? '<span class="text-[10px] font-label-sm text-tertiary font-bold">¡Últimas unidades!</span>' : ''}
            </div>
            <h2 class="font-headline-sm text-headline-sm text-on-surface truncate">${product.name}</h2>
            <div class="flex items-baseline gap-2 mt-0.5">
              <span class="font-headline-md text-headline-md text-on-surface">${settings.currency}${product.price.toFixed(2)}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">/ ${product.unit}</span>
            </div>
          </div>
          <button aria-label="Agregar ${product.name}" class="add-to-cart-btn w-12 h-12 rounded-xl bg-surface-container-low hover:bg-primary hover:text-on-primary text-primary flex items-center justify-center shadow-xs transition-colors flex-shrink-0 active:scale-95" data-id="${product.id}" type="button">
            <span class="material-symbols-outlined text-[24px]">add_shopping_cart</span>
          </button>
        </div>
      `).join("")}
    </div>
  `;
}

function renderInvoicesScreen(invoices, settings) {
  return `
    <div class="flex items-center justify-between">
      <div>
        <h3 class="font-headline-sm text-on-surface font-bold">Historial de Facturas y Ventas</h3>
        <p class="font-body-sm text-on-surface-variant">Consulta, reimprime o modifica cualquier comprobante</p>
      </div>
      <button class="px-3 py-1.5 rounded-full bg-primary text-on-primary font-label-sm font-bold flex items-center gap-1" id="invNewSaleRedirect">
        <span class="material-symbols-outlined text-[16px]">add</span>
        <span>Nueva Venta</span>
      </button>
    </div>

    <div class="flex flex-col gap-3">
      ${invoices.length === 0 ? `
        <div class="p-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-2xl">
          <span class="material-symbols-outlined text-[36px] text-outline">receipt_long</span>
          <p class="mt-2 font-medium">No hay comprobantes registrados aún.</p>
        </div>
      ` : invoices.map(inv => `
        <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-variant/40 hover:shadow-md transition-shadow">
          <div class="flex items-start justify-between">
            <div class="flex items-center gap-2">
              <div class="w-9 h-9 rounded-xl ${inv.type === 'factura' ? 'bg-primary text-on-primary' : 'bg-surface-container text-primary'} flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">${inv.type === 'factura' ? 'description' : 'receipt_long'}</span>
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-label-lg font-bold text-on-surface">${inv.id}</span>
                  <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${inv.status === 'Pagada' ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-fixed text-tertiary'}">${inv.status}</span>
                </div>
                <span class="font-body-sm text-on-surface-variant block text-xs">${inv.date}</span>
              </div>
            </div>
            <div class="text-right">
              <span class="font-headline-md text-on-surface font-extrabold">${settings.currency}${Number(inv.total).toFixed(2)}</span>
              <span class="font-body-sm text-xs text-on-surface-variant block">${inv.paymentMethod}</span>
            </div>
          </div>

          <!-- Customer info -->
          <div class="bg-surface-container-low px-3 py-2 rounded-xl flex items-center justify-between text-body-sm">
            <div class="flex items-center gap-1.5 text-on-surface">
              <span class="material-symbols-outlined text-[16px] text-primary">person</span>
              <span class="font-semibold">${inv.customerName}</span>
              ${inv.customerDoc ? `<span class="text-on-surface-variant text-xs">(${inv.customerDoc})</span>` : ''}
            </div>
            <span class="text-xs text-on-surface-variant">${inv.items?.length || 0} ítems</span>
          </div>

          <!-- Items preview -->
          <div class="flex flex-col gap-1 text-xs text-on-surface-variant">
            ${(inv.items || []).map(it => `
              <div class="flex justify-between">
                <span>${it.quantity}x ${it.name}</span>
                <span class="font-medium text-on-surface">${settings.currency}${Number(it.total).toFixed(2)}</span>
              </div>
            `).join("")}
          </div>

          <!-- Action buttons: Modificar, Imprimir Ticket, Eliminar -->
          <div class="pt-2 border-t border-surface-variant/40 flex items-center justify-between gap-2">
            <button class="edit-invoice-btn px-3 py-1.5 rounded-xl bg-surface-container text-primary font-label-md flex items-center gap-1 hover:bg-surface-container-high transition-colors" data-id="${inv.id}">
              <span class="material-symbols-outlined text-[16px]">edit</span>
              <span>Modificar Factura</span>
            </button>
            <div class="flex items-center gap-1.5">
              <button class="print-invoice-btn px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface font-label-md flex items-center gap-1 hover:bg-surface-container transition-colors" data-id="${inv.id}">
                <span class="material-symbols-outlined text-[16px]">print</span>
                <span>Ticket</span>
              </button>
              <button class="delete-invoice-btn w-8 h-8 rounded-xl bg-error-container text-tertiary flex items-center justify-center hover:opacity-80 transition-opacity" data-id="${inv.id}" title="Eliminar Comprobante">
                <span class="material-symbols-outlined text-[16px]">delete</span>
              </button>
            </div>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function attachPosEvents(container) {
  const settings = store.getSettings();

  // Switch tabs
  container.querySelector("#tabPosBtn")?.addEventListener("click", () => {
    activeTab = "pos";
    renderMainLayout(container);
  });
  container.querySelector("#tabInvoicesBtn")?.addEventListener("click", () => {
    activeTab = "invoices";
    renderMainLayout(container);
  });
  container.querySelector("#invNewSaleRedirect")?.addEventListener("click", () => {
    activeTab = "pos";
    renderMainLayout(container);
  });

  // Category filter
  container.querySelectorAll(".cat-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.getAttribute("data-cat");
      renderMainLayout(container);
    });
  });

  // Billing type toggle
  container.querySelectorAll("#billingSegment button").forEach(btn => {
    btn.addEventListener("click", () => {
      billingType = btn.getAttribute("data-type");
      renderMainLayout(container);
    });
  });

  container.querySelector("#posDocTypeToggle")?.addEventListener("click", () => {
    billingType = billingType === "ticket" ? "factura" : "ticket";
    renderMainLayout(container);
  });

  // Search input
  const searchInput = container.querySelector("#posSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      container.querySelectorAll(".product-item").forEach(el => {
        const id = el.getAttribute("data-id");
        const prod = store.getProduct(id);
        if (prod && (prod.name.toLowerCase().includes(q) || (prod.barcode && prod.barcode.includes(q)))) {
          el.style.display = "flex";
        } else {
          el.style.display = "none";
        }
      });
    });
  }

  // Simulated Barcode Scanner
  container.querySelector("#posBarcodeBtn")?.addEventListener("click", () => {
    const products = store.getProducts();
    const randomProd = products[Math.floor(Math.random() * products.length)];
    store.addToCart(randomProd.id, 1);
    if (searchInput) searchInput.value = randomProd.name;
    renderMainLayout(container);
  });

  // Quick discount toggle
  container.querySelector("#quickDiscountBtn")?.addEventListener("click", () => {
    const discounts = [0, 5, 10, 15, 20];
    const currIdx = discounts.indexOf(discountPercent);
    discountPercent = discounts[(currIdx + 1) % discounts.length];
    renderMainLayout(container);
  });

  // Quick tip toggle
  container.querySelector("#quickTipBtn")?.addEventListener("click", () => {
    const tips = [0, 1, 2, 5];
    const currIdx = tips.indexOf(tipAmount);
    tipAmount = tips[(currIdx + 1) % tips.length];
    renderMainLayout(container);
  });

  // Add to cart buttons
  container.querySelectorAll(".add-to-cart-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      store.addToCart(id, 1);
      renderMainLayout(container);
    });
  });

  // Cart Modal Open/Close
  const cartModal = container.querySelector("#cartModal");
  container.querySelector("#openCartModalBtn")?.addEventListener("click", () => {
    cartModal?.classList.remove("hidden");
  });
  container.querySelector("#closeCartModalBtn")?.addEventListener("click", () => {
    cartModal?.classList.add("hidden");
  });

  // Cart Quantity Controls inside Modal
  container.querySelectorAll(".cart-plus-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      store.addToCart(id, 1);
      renderMainLayout(container);
      container.querySelector("#cartModal")?.classList.remove("hidden");
    });
  });

  container.querySelectorAll(".cart-minus-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const item = store.getCart().find(it => it.productId === id);
      if (item) {
        store.updateCartQty(id, item.quantity - 1);
      }
      renderMainLayout(container);
      if (store.getCart().length > 0) {
        container.querySelector("#cartModal")?.classList.remove("hidden");
      }
    });
  });

  // Direct Save Sale Button (from Sticky POS Bar)
  container.querySelector("#btnSaveSaleBar")?.addEventListener("click", () => {
    executeConfirmSale(container);
  });

  // Confirm Sale Button (from Cart Modal)
  container.querySelector("#confirmSaleBtn")?.addEventListener("click", () => {
    executeConfirmSale(container);
  });

  // Invoice Actions: Edit, Print, Delete
  container.querySelectorAll(".delete-invoice-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const confirmed = await uiModal.confirm({
        title: "Eliminar Comprobante",
        message: `¿Estás seguro de eliminar el comprobante ${id}? Esta acción no se puede deshacer.`,
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        type: "danger"
      });
      if (confirmed) {
        store.deleteInvoice(id);
        uiToast.success(`Comprobante ${id} eliminado.`);
        renderMainLayout(container);
      }
    });
  });

  container.querySelectorAll(".print-invoice-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const inv = store.getInvoice(id);
      if (inv) openPrintTicket(inv, settings);
    });
  });

  container.querySelectorAll(".edit-invoice-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      openEditInvoiceModal(id, container);
    });
  });

  container.querySelector("#closeEditInvoiceBtn")?.addEventListener("click", () => {
    container.querySelector("#editInvoiceModal")?.classList.add("hidden");
  });
}

function executeConfirmSale(container) {
  const cart = store.getCart();
  if (!cart || cart.length === 0) return null;

  const settings = store.getSettings();
  const customerName =
    container.querySelector("#checkoutCustomerName")?.value ||
    container.querySelector("#quickCustomerName")?.value ||
    "Cliente de Mostrador";
  const customerDoc =
    container.querySelector("#checkoutCustomerDoc")?.value ||
    container.querySelector("#quickRut")?.value ||
    (billingType === "factura" ? "12345678-9" : "CF");
  const paymentMethod = container.querySelector("#checkoutPaymentMethod")?.value || "Efectivo";

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discVal = subtotal * (discountPercent / 100);
  const total = Math.max(0, subtotal - discVal + tipAmount);

  const newInvoice = {
    type: billingType,
    customerName,
    customerDoc,
    items: cart.map(it => ({
      productId: it.productId,
      name: it.name,
      quantity: it.quantity,
      price: it.price,
      total: it.price * it.quantity
    })),
    subtotal,
    discountPercent,
    discountAmount: discVal,
    tip: tipAmount,
    total,
    paymentMethod,
    status: "Pagada",
    notes: ""
  };

  const savedInvoice = store.saveInvoice(newInvoice);
  store.clearCart();
  discountPercent = 0;
  tipAmount = 0;

  uiToast.success(`¡Venta realizada con éxito!\nComprobante emitido: ${savedInvoice?.id || newInvoice.id}\nTotal: ${settings.currency}${total.toFixed(2)}`);

  activeTab = "invoices";
  renderMainLayout(container);
  return savedInvoice;
}

function openEditInvoiceModal(invoiceId, container) {
  const inv = store.getInvoice(invoiceId);
  if (!inv) return;

  const modal = container.querySelector("#editInvoiceModal");
  const body = container.querySelector("#editInvoiceBody");
  const title = container.querySelector("#editModalTitle");
  const settings = store.getSettings();

  title.innerText = `Modificar Comprobante: ${inv.id}`;

  body.innerHTML = `
    <div class="flex flex-col gap-3">
      <div>
        <label class="font-label-sm uppercase tracking-wider text-on-surface-variant">Cliente / Razón Social</label>
        <input id="editCustomerName" class="w-full bg-surface-container-low px-3 py-2 rounded-xl text-on-surface mt-1 outline-none" value="${inv.customerName}" />
      </div>
      <div>
        <label class="font-label-sm uppercase tracking-wider text-on-surface-variant">Documento (RUT / DNI)</label>
        <input id="editCustomerDoc" class="w-full bg-surface-container-low px-3 py-2 rounded-xl text-on-surface mt-1 outline-none" value="${inv.customerDoc || ''}" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="font-label-sm uppercase tracking-wider text-on-surface-variant">Estado</label>
          <select id="editStatus" class="w-full bg-surface-container-low px-3 py-2 rounded-xl text-on-surface mt-1 outline-none">
            <option value="Pagada" ${inv.status === 'Pagada' ? 'selected' : ''}>Pagada</option>
            <option value="Pendiente" ${inv.status === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
            <option value="Cancelada" ${inv.status === 'Cancelada' ? 'selected' : ''}>Cancelada</option>
          </select>
        </div>
        <div>
          <label class="font-label-sm uppercase tracking-wider text-on-surface-variant">Método de Pago</label>
          <select id="editPaymentMethod" class="w-full bg-surface-container-low px-3 py-2 rounded-xl text-on-surface mt-1 outline-none">
            <option value="Efectivo" ${inv.paymentMethod === 'Efectivo' ? 'selected' : ''}>Efectivo</option>
            <option value="Tarjeta de Crédito" ${inv.paymentMethod.includes('Tarjeta') ? 'selected' : ''}>Tarjeta</option>
            <option value="Transferencia Bancaria" ${inv.paymentMethod.includes('Transferencia') ? 'selected' : ''}>Transferencia</option>
            <option value="WhatsApp / Zelle" ${inv.paymentMethod.includes('WhatsApp') ? 'selected' : ''}>WhatsApp / Zelle</option>
          </select>
        </div>
      </div>

      <div class="border-t border-surface-variant pt-2">
        <label class="font-label-sm uppercase tracking-wider text-on-surface-variant block mb-1">Ítems de la Factura</label>
        <div class="flex flex-col gap-2 max-h-48 overflow-y-auto" id="editItemsList">
          ${inv.items.map((it, idx) => `
            <div class="flex items-center justify-between p-2 rounded-lg bg-surface-container-low text-body-sm">
              <span class="font-medium text-on-surface flex-1">${it.name}</span>
              <div class="flex items-center gap-1.5">
                <input type="number" min="1" class="edit-qty-input w-14 bg-surface-container px-2 py-1 rounded text-center font-bold" data-idx="${idx}" value="${it.quantity}" />
                <span class="w-16 text-right font-bold">${settings.currency}${Number(it.price).toFixed(2)}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 mt-1">
        <div>
          <label class="font-label-sm text-on-surface-variant">Descuento (%)</label>
          <input type="number" id="editDiscountPercent" class="w-full bg-surface-container-low px-3 py-1.5 rounded-lg text-on-surface mt-0.5" value="${inv.discountPercent || 0}" />
        </div>
        <div>
          <label class="font-label-sm text-on-surface-variant">Propina (${settings.currency})</label>
          <input type="number" id="editTip" class="w-full bg-surface-container-low px-3 py-1.5 rounded-lg text-on-surface mt-0.5" value="${inv.tip || 0}" />
        </div>
      </div>

      <div class="mt-3 flex gap-2">
        <button id="saveEditInvoiceBtn" class="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-bold shadow-md hover:opacity-95">
          Guardar Modificaciones
        </button>
      </div>
    </div>
  `;

  modal.classList.remove("hidden");

  body.querySelector("#saveEditInvoiceBtn")?.addEventListener("click", () => {
    inv.customerName = body.querySelector("#editCustomerName").value;
    inv.customerDoc = body.querySelector("#editCustomerDoc").value;
    inv.status = body.querySelector("#editStatus").value;
    inv.paymentMethod = body.querySelector("#editPaymentMethod").value;
    inv.discountPercent = parseFloat(body.querySelector("#editDiscountPercent").value) || 0;
    inv.tip = parseFloat(body.querySelector("#editTip").value) || 0;

    // Update quantities and recalculate
    body.querySelectorAll(".edit-qty-input").forEach(inp => {
      const idx = parseInt(inp.getAttribute("data-idx"));
      const newQty = parseInt(inp.value) || 1;
      inv.items[idx].quantity = newQty;
      inv.items[idx].total = newQty * inv.items[idx].price;
    });

    inv.subtotal = inv.items.reduce((s, it) => s + it.total, 0);
    inv.discountAmount = inv.subtotal * (inv.discountPercent / 100);
    inv.total = Math.max(0, inv.subtotal - inv.discountAmount + inv.tip);

    store.saveInvoice(inv);
    modal.classList.add("hidden");
    renderMainLayout(container);
  });
}

function openPrintTicket(inv, settings) {
  const win = window.open("", "_blank");
  if (!win) return;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ticket ${inv.id}</title>
      <style>
        body { font-family: monospace; width: 280px; margin: 0 auto; padding: 15px; color: #000; font-size: 12px; }
        .center { text-align: center; }
        .line { border-bottom: 1px dashed #000; margin: 8px 0; }
        .flex { display: flex; justify-content: space-between; }
        .bold { font-weight: bold; }
        @media print { .no-print { display: none; } }
      </style>
    </head>
    <body>
      <div class="no-print" style="margin-bottom: 10px; text-align: center;">
        <button onclick="window.print()" style="padding: 6px 12px; font-weight: bold; cursor: pointer;">Imprimir Ticket</button>
      </div>
      <div class="center bold" style="font-size: 14px;">SWEET SMILE PASTRY</div>
      <div class="center">Repostería & Pastelería Fina</div>
      <div class="center">${inv.id} - ${inv.date}</div>
      <div class="line"></div>
      <div>Cliente: ${inv.customerName}</div>
      <div>Doc: ${inv.customerDoc || 'CF'}</div>
      <div>Pago: ${inv.paymentMethod}</div>
      <div class="line"></div>
      ${inv.items.map(it => `
        <div class="flex">
          <span>${it.quantity}x ${it.name}</span>
          <span>${settings.currency}${Number(it.total).toFixed(2)}</span>
        </div>
      `).join("")}
      <div class="line"></div>
      <div class="flex"><span>Subtotal:</span><span>${settings.currency}${Number(inv.subtotal).toFixed(2)}</span></div>
      ${inv.discountPercent ? `<div class="flex"><span>Descuento (${inv.discountPercent}%):</span><span>-${settings.currency}${Number(inv.discountAmount).toFixed(2)}</span></div>` : ''}
      ${inv.tip ? `<div class="flex"><span>Propina:</span><span>+${settings.currency}${Number(inv.tip).toFixed(2)}</span></div>` : ''}
      <div class="flex bold" style="font-size: 14px; margin-top: 4px;">
        <span>TOTAL:</span>
        <span>${settings.currency}${Number(inv.total).toFixed(2)}</span>
      </div>
      <div class="line"></div>
      <div class="center" style="margin-top: 10px;">¡Gracias por endulzar tu día con nosotros! 🍰</div>
    </body>
    </html>
  `;

  win.document.open();
  win.document.write(html);
  win.document.close();
}
