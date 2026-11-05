// js/views/catalogShareView.js - Configuración del Catálogo Web para GitHub Pages & Generador de QR
import { store } from '../store.js';
import { QRGenerator } from '../qr-generator.js';

export function renderCatalogShareView(container) {
  const settings = store.getSettings();
  const currentCatalogUrl = window.location.origin + window.location.pathname.replace("index.html", "") + "catalog.html";
  const qrUrl = QRGenerator.generateQRDataUrl(settings.githubPagesUrl || currentCatalogUrl, 260);

  container.innerHTML = `
    <div class="flex flex-col w-full px-margin pb-28 gap-space-md">
      <!-- Header Banner -->
      <div class="rounded-2xl bg-primary text-on-primary p-5 shadow-md flex items-center justify-between mt-1">
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-secondary-fixed text-[24px]">storefront</span>
            <span class="font-label-sm uppercase tracking-wider text-primary-fixed font-bold">Ventas Online</span>
          </div>
          <h2 class="font-headline-md font-bold leading-tight">Catálogo Web & WhatsApp</h2>
          <p class="text-body-sm text-primary-fixed leading-snug">
            Comparte tu carta de pastelería con tus clientes mediante código QR o enlace directo a GitHub Pages.
          </p>
        </div>
      </div>

      <!-- Configuración del Teléfono de WhatsApp -->
      <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-surface-variant/40 flex flex-col gap-3">
        <div class="flex items-center gap-2 text-on-surface">
          <span class="material-symbols-outlined text-primary text-[20px]">phone_iphone</span>
          <h3 class="font-headline-sm font-bold">Número de WhatsApp para Pedidos</h3>
        </div>
        <p class="text-xs text-on-surface-variant">
          Los clientes armarán su pedido en la web y al hacer clic en "Pedir por WhatsApp" se abrirá una conversación a este número con el desglose del pedido.
        </p>
        <div class="flex items-center gap-2">
          <input type="text" id="cfgWhatsappNumber" class="flex-1 bg-surface-container-low px-3.5 py-2.5 rounded-xl text-on-surface outline-none text-body-md font-semibold" value="${settings.whatsappNumber || '+18095551234'}" placeholder="+18095551234" />
          <button class="px-4 py-2.5 rounded-xl bg-primary text-on-primary font-bold shadow-sm hover:opacity-95 transition-opacity" id="btnSaveWhatsapp">
            Guardar
          </button>
        </div>
      </div>

      <!-- Generador de Código QR para el Mostrador -->
      <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-surface-variant/40 flex flex-col items-center gap-4 text-center">
        <div class="flex flex-col items-center gap-1">
          <span class="font-headline-sm text-on-surface font-bold">Código QR del Catálogo</span>
          <p class="text-xs text-on-surface-variant max-w-xs">
            Imprímelo y colócalo en el mostrador de tu pastelería o en las cajas de entrega.
          </p>
        </div>

        <!-- Canvas / Imagen del QR -->
        <div class="p-3 bg-white rounded-2xl shadow-md border border-surface-variant/50 inline-block">
          <img id="qrImageElement" class="w-52 h-52 rounded-xl object-contain mx-auto" src="${qrUrl}" />
        </div>

        <div class="w-full flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <input type="text" id="cfgCatalogUrl" class="flex-1 bg-surface-container-low px-3 py-2 rounded-xl text-xs text-on-surface-variant outline-none" value="${settings.githubPagesUrl || currentCatalogUrl}" />
            <button class="px-3 py-2 rounded-xl bg-surface-container text-primary font-label-md hover:bg-surface-container-high transition-colors" id="btnCopyCatalogUrl">
              Copiar
            </button>
          </div>

          <div class="grid grid-cols-2 gap-2 mt-1">
            <button class="py-2.5 px-3 rounded-xl bg-primary text-on-primary font-label-md font-bold flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 active:scale-95 transition-transform" id="btnDownloadQr">
              <span class="material-symbols-outlined text-[18px]">download</span>
              <span>Descargar QR</span>
            </button>
            <button class="py-2.5 px-3 rounded-xl bg-surface-container-high text-on-surface font-label-md font-bold flex items-center justify-center gap-1.5 hover:bg-surface-container transition-colors active:scale-95" id="btnPrintQrPoster">
              <span class="material-symbols-outlined text-[18px]">print</span>
              <span>Imprimir Cartel</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Botón Probar Catálogo de Clientes en Vivo -->
      <div class="p-4 rounded-2xl bg-secondary-fixed/50 border border-secondary/20 flex items-center justify-between gap-3">
        <div>
          <h4 class="font-headline-sm text-on-secondary-fixed font-bold">Vista Previa de Clientes</h4>
          <p class="text-xs text-on-secondary-fixed-variant">Abre el catálogo tal como lo verán tus clientes</p>
        </div>
        <button class="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary font-bold text-sm shadow-sm flex items-center gap-1.5 hover:opacity-95 transition-opacity" id="btnOpenClientCatalog">
          <span>Abrir Catálogo</span>
          <span class="material-symbols-outlined text-[18px]">open_in_new</span>
        </button>
      </div>

      <!-- Guía Rápida para Subir a GitHub Pages -->
      <div class="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-surface-variant/40 flex flex-col gap-2.5">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[20px]">cloud_upload</span>
          <h4 class="font-headline-sm font-bold text-on-surface">Cómo publicar gratis en GitHub Pages</h4>
        </div>
        <ol class="text-xs text-on-surface-variant list-decimal pl-4 flex flex-col gap-1.5 leading-relaxed">
          <li>Crea un repositorio público en GitHub (ej: <code class="bg-surface-container px-1 py-0.5 rounded text-primary">sweet-smile</code>).</li>
          <li>Sube los archivos del proyecto (<code class="bg-surface-container px-1 py-0.5 rounded">index.html</code>, <code class="bg-surface-container px-1 py-0.5 rounded">catalog.html</code>, carpetas <code class="bg-surface-container px-1 py-0.5 rounded">js/</code> y <code class="bg-surface-container px-1 py-0.5 rounded">css/</code>).</li>
          <li>Ve a <strong>Settings > Pages</strong> en GitHub y activa el despliegue desde la rama <strong>main</strong>.</li>
          <li>¡Listo! Tu catálogo estará disponible en <code class="bg-surface-container px-1 py-0.5 rounded text-primary">https://usuario.github.io/sweet-smile/catalog.html</code> para que tus clientes te pidan directamente por WhatsApp.</li>
        </ol>
      </div>

      <!-- Modal Cartel QR para Mostrador (Accesible, In-App) -->
      <div id="qrPosterModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm hidden flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="qrPosterTitle">
        <div class="bg-surface-container-lowest w-full max-w-md rounded-3xl p-5 flex flex-col gap-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between pb-2 border-b border-surface-variant/40">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[24px]">qr_code_2</span>
              <h3 id="qrPosterTitle" class="font-headline-sm font-bold text-on-surface">Cartel QR para Mostrador</h3>
            </div>
            <button id="closeQrPosterModal" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors" type="button" aria-label="Cerrar cartel">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <!-- Poster Preview Card -->
          <div id="qrPosterPreview" class="border-2 border-primary/40 rounded-2xl p-6 text-center bg-surface-container-low flex flex-col items-center gap-2 shadow-inner">
            <h2 class="font-headline-md font-bold text-primary">🍰 Sweet Smile Pastry</h2>
            <p class="font-body-sm text-secondary font-medium">Repostería Artesanal & Café</p>
            <div class="my-3 p-3 bg-white rounded-2xl shadow-sm border border-surface-variant/30">
              <img id="modalQrImg" class="w-48 h-48 object-contain mx-auto" src="${qrUrl}" alt="Código QR Catálogo" />
            </div>
            <p class="font-headline-sm font-bold text-primary">¡Escanea para ver nuestro Catálogo!</p>
            <p class="font-body-sm font-semibold text-on-surface">Haz tu pedido directo a nuestro WhatsApp</p>
            <p class="text-xs text-on-surface-variant mt-1 leading-relaxed">Pasteles para eventos • Cupcakes • Tartas frescas • Envío a domicilio</p>
          </div>

          <!-- Modal Action Buttons -->
          <div class="flex items-center gap-2 pt-2 border-t border-surface-variant/40">
            <button id="btnCancelQrPoster" class="flex-1 py-2.5 rounded-xl bg-surface-container text-on-surface font-label-md font-bold hover:bg-surface-container-high active:scale-[0.98] transition-all" type="button">
              Cerrar
            </button>
            <button id="btnExecutePrintPoster" class="flex-1 py-2.5 rounded-xl bg-primary text-on-primary font-label-md font-bold flex items-center justify-center gap-1.5 shadow-md hover:opacity-95 active:scale-[0.98] transition-all" type="button">
              <span class="material-symbols-outlined text-[18px]">print</span>
              <span>Imprimir Cartel</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Safe Non-Destructive Media Print Styles -->
      <style>
        @media print {
          body > *:not(#app-container) { display: none !important; }
          #app-container > header, #app-container > nav, #app-container > main > *:not(#qrPosterModal) { display: none !important; }
          #qrPosterModal {
            display: flex !important;
            position: fixed !important;
            inset: 0 !important;
            background: white !important;
            padding: 0 !important;
            align-items: center !important;
            justify-content: center !important;
          }
          #qrPosterModal > div {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
          #qrPosterModal button,
          #qrPosterModal .border-b,
          #qrPosterModal .border-t {
            display: none !important;
          }
          #qrPosterPreview {
            border: 4px solid #345aa0 !important;
            background: white !important;
            margin: 0 auto !important;
            max-width: 440px !important;
            box-shadow: none !important;
          }
        }
      </style>
    </div>
  `;

  attachCatalogShareEvents(container, currentCatalogUrl);
}

function attachCatalogShareEvents(container, defaultUrl) {
  const settings = store.getSettings();

  // Save WhatsApp
  container.querySelector("#btnSaveWhatsapp")?.addEventListener("click", () => {
    const val = container.querySelector("#cfgWhatsappNumber")?.value?.trim();
    if (val) {
      store.updateSettings({ whatsappNumber: val });
      alert("¡Número de WhatsApp guardado con éxito!");
    }
  });

  // Copy Catalog URL
  container.querySelector("#btnCopyCatalogUrl")?.addEventListener("click", () => {
    const val = container.querySelector("#cfgCatalogUrl")?.value;
    navigator.clipboard.writeText(val).then(() => {
      alert("¡Enlace copiado al portapapeles!");
    });
  });

  // Update QR when URL changes
  const urlInput = container.querySelector("#cfgCatalogUrl");
  if (urlInput) {
    urlInput.addEventListener("input", (e) => {
      const newUrl = e.target.value;
      const newQrDataUrl = QRGenerator.generateQRDataUrl(newUrl, 260);
      const img = container.querySelector("#qrImageElement");
      if (img) img.src = newQrDataUrl;
      const modalImg = container.querySelector("#modalQrImg");
      if (modalImg) modalImg.src = newQrDataUrl;
      store.updateSettings({ githubPagesUrl: newUrl });
    });
  }

  // Download QR PNG
  container.querySelector("#btnDownloadQr")?.addEventListener("click", () => {
    const img = container.querySelector("#qrImageElement");
    if (!img) return;
    const a = document.createElement("a");
    a.href = img.src;
    a.download = "SweetSmile_Catalogo_QR.png";
    a.target = "_blank";
    a.click();
  });

  // Modal Dialog Controls for QR Poster (F10 / R5)
  const qrModal = container.querySelector("#qrPosterModal");
  const modalImg = container.querySelector("#modalQrImg");
  const qrImg = container.querySelector("#qrImageElement");

  const openQrPosterModal = () => {
    if (!qrModal) return;
    if (modalImg && qrImg) {
      modalImg.src = qrImg.src;
    }
    qrModal.classList.remove("hidden");
  };

  const closeQrPosterModal = () => {
    if (qrModal && !qrModal.classList.contains("hidden")) {
      qrModal.classList.add("hidden");
    }
  };

  // Open modal trigger
  container.querySelector("#btnPrintQrPoster")?.addEventListener("click", openQrPosterModal);

  // Close triggers: (X) button & Cancel button
  container.querySelector("#closeQrPosterModal")?.addEventListener("click", closeQrPosterModal);
  container.querySelector("#btnCancelQrPoster")?.addEventListener("click", closeQrPosterModal);

  // Backdrop click dismiss
  qrModal?.addEventListener("click", (e) => {
    if (e.target === qrModal) {
      closeQrPosterModal();
    }
  });

  // Escape key listener (with prior handler cleanup)
  if (window.__qrPosterEscapeHandler) {
    document.removeEventListener("keydown", window.__qrPosterEscapeHandler);
  }
  window.__qrPosterEscapeHandler = (e) => {
    if (e.key === "Escape") {
      const activeModal = document.querySelector("#qrPosterModal");
      if (activeModal && !activeModal.classList.contains("hidden")) {
        activeModal.classList.add("hidden");
      }
    }
  };
  document.addEventListener("keydown", window.__qrPosterEscapeHandler);

  // Safe QR Poster Printing (F11 / R5)
  container.querySelector("#btnExecutePrintPoster")?.addEventListener("click", () => {
    const qrUrl = modalImg?.src || qrImg?.src;
    if (!qrUrl) return;

    try {
      let printFrame = document.getElementById("qrPrintFrame");
      if (!printFrame) {
        printFrame = document.createElement("iframe");
        printFrame.id = "qrPrintFrame";
        printFrame.style.position = "fixed";
        printFrame.style.right = "0";
        printFrame.style.bottom = "0";
        printFrame.style.width = "0";
        printFrame.style.height = "0";
        printFrame.style.border = "0";
        printFrame.style.visibility = "hidden";
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(`
          <!DOCTYPE html>
          <html lang="es">
          <head>
            <meta charset="utf-8"/>
            <title>Cartel QR - Sweet Smile Pastry</title>
            <style>
              @page { size: auto; margin: 15mm; }
              * { box-sizing: border-box; }
              body {
                font-family: 'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-align: center;
                padding: 24px;
                color: #151b29;
                background: #ffffff;
                margin: 0;
              }
              .poster {
                border: 4px solid #345aa0;
                padding: 36px 28px;
                border-radius: 24px;
                max-width: 440px;
                margin: 0 auto;
                background: #ffffff;
              }
              h1 {
                color: #345aa0;
                font-size: 28px;
                margin: 0 0 6px 0;
                font-weight: 800;
                letter-spacing: -0.02em;
              }
              h2 {
                color: #445f8c;
                font-size: 16px;
                font-weight: 600;
                margin: 0 0 20px 0;
              }
              .cta {
                font-size: 20px;
                font-weight: 700;
                color: #345aa0;
                margin-bottom: 16px;
              }
              .qr-box {
                padding: 16px;
                background: #ffffff;
                border: 2px solid #dde2f5;
                border-radius: 20px;
                display: inline-block;
                margin: 0 auto 16px auto;
              }
              img {
                width: 240px;
                height: 240px;
                display: block;
                object-fit: contain;
              }
              .whatsapp-cta {
                font-size: 15px;
                font-weight: 700;
                color: #151b29;
                margin-bottom: 6px;
              }
              .sub {
                color: #747782;
                font-size: 12px;
                line-height: 1.5;
              }
            </style>
          </head>
          <body>
            <div class="poster">
              <h1>🍰 Sweet Smile Pastry</h1>
              <h2>Repostería Artesanal & Café</h2>
              <div class="cta">¡Escanea para ver nuestro Catálogo!</div>
              <div class="qr-box">
                <img src="${qrUrl}" alt="Código QR Catálogo Sweet Smile" />
              </div>
              <div class="whatsapp-cta">Haz tu pedido directo a nuestro WhatsApp</div>
              <div class="sub">Pasteles para eventos • Cupcakes • Tartas frescas • Envío a domicilio</div>
            </div>
          </body>
          </html>
        `);
        frameDoc.close();

        setTimeout(() => {
          try {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
          } catch (e) {
            console.warn("Hidden iframe print failed, falling back to window.print():", e);
            window.print();
          }
        }, 250);
      } else {
        window.print();
      }
    } catch (err) {
      console.warn("Print execution error, fallback to window.print():", err);
      window.print();
    }
  });

  // Open Client Catalog
  container.querySelector("#btnOpenClientCatalog")?.addEventListener("click", () => {
    window.open("catalog.html", "_blank");
  });
}
