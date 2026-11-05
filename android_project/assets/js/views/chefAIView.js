// js/views/chefAIView.js - Stitch Screen 2: Asistente IA de Pastelería & Rescate de Mermas con Google Gemini
import { store } from '../store.js';
import { notifications } from '../notifications.js';
import { GeminiAPI } from '../gemini-api.js';

let chatHistory = [
  {
    sender: "assistant",
    text: "¡Hola! Soy tu Chef Dulce IA 🧑‍🍳 He analizado tu almacén hoy. Tienes fresas maduras para aprovechar y la mantequilla subió de costo. ¿En qué te puedo asesorar hoy?"
  }
];

export function renderChefAIView(container) {
  const inventory = store.getInventory();
  const settings = store.getSettings();
  const hasKey = GeminiAPI.hasApiKey();

  container.innerHTML = `
    <div class="flex flex-col w-full px-margin pb-28 gap-space-md">
      <!-- AI Identity Banner (Stitch Screen 2) -->
      <div class="relative overflow-hidden rounded-xl bg-surface-container-high p-space-md shadow-sm mt-1">
        <div class="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-primary/10 blur-xl pointer-events-none"></div>
        <div class="relative z-10 flex items-center justify-between gap-space-sm flex-wrap">
          <div class="flex items-center gap-space-sm min-w-0">
            <div class="relative flex-shrink-0">
              <div class="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-md">
                <span class="material-symbols-outlined text-[26px]">smart_toy</span>
              </div>
              <span class="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-surface-container-high flex items-center justify-center">
                <span class="w-2.5 h-2.5 rounded-full ${hasKey ? 'bg-primary-container' : 'bg-[#eab308]'} animate-pulse"></span>
              </span>
            </div>
            <div class="min-w-0 flex flex-col">
              <div class="flex items-center gap-1.5">
                <span class="font-headline-sm text-headline-sm text-on-surface truncate font-bold">Chef Dulce IA</span>
                <span class="material-symbols-outlined text-[16px] text-tertiary" style="font-variation-settings: 'FILL' 1;">auto_awesome</span>
              </div>
              <span class="font-label-sm text-label-sm text-primary flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-primary"></span>
                ${hasKey ? 'Google Gemini Activo (2.5-Flash / 2.0-Flash)' : 'Modo Asistente Local (API Key sin configurar)'}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button class="px-3 py-1.5 rounded-xl ${hasKey ? 'bg-surface-container text-primary' : 'bg-primary text-on-primary shadow-sm'} font-label-sm font-bold flex items-center gap-1.5 transition-all text-xs" id="btnConfigureGeminiKey" title="Configurar clave de Gemini AI">
              <span class="material-symbols-outlined text-[16px]">key</span>
              <span>${hasKey ? 'Gemini Configurado' : 'Configurar Gemini API Key'}</span>
            </button>
            <button aria-label="Notificaciones" class="w-9 h-9 rounded-full bg-surface-container-lowest text-on-surface-variant flex items-center justify-center shadow-sm hover:text-primary transition-colors flex-shrink-0" id="btnTestKitchenChime" title="Probar Alarma de Cocina">
              <span class="material-symbols-outlined text-[20px]">notifications_active</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Prompts Horizontal Scroll -->
      <div class="flex flex-col gap-space-xs">
        <div class="flex items-center justify-between px-0.5">
          <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold">Acciones Sugeridas</span>
          <span class="font-label-sm text-label-sm text-primary font-bold">4 disponibles</span>
        </div>
        <div class="flex items-center gap-space-xs overflow-x-auto pb-1 pt-0.5 -mx-margin px-margin no-scrollbar">
          <button class="ai-prompt-btn flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-container-lowest text-on-surface hover:bg-secondary-container transition-colors shadow-sm" data-prompt="Optimizar costos de receta del Pastel Tres Leches" type="button">
            <span class="material-symbols-outlined text-[16px] text-primary">lightbulb</span>
            <span class="font-label-md text-label-md">Optimizar costos de receta</span>
          </button>
          <button class="ai-prompt-btn flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-container-lowest text-on-surface hover:bg-secondary-container transition-colors shadow-sm" data-prompt="Calcular precios recomendados por inflación en mantequilla" type="button">
            <span class="material-symbols-outlined text-[16px] text-primary">trending_up</span>
            <span class="font-label-md text-label-md">Precios por inflación</span>
          </button>
          <button class="ai-prompt-btn flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-container-lowest text-on-surface hover:bg-secondary-container transition-colors shadow-sm" data-prompt="Sugerir receta con mermas de fresas y claras" type="button">
            <span class="material-symbols-outlined text-[16px] text-tertiary">bakery_dining</span>
            <span class="font-label-md text-label-md">Receta con stock sobrante</span>
          </button>
          <button class="ai-prompt-btn flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full bg-surface-container-lowest text-on-surface hover:bg-secondary-container transition-colors shadow-sm" data-prompt="Analizar rentabilidad del mes actual vs mes anterior" type="button">
            <span class="material-symbols-outlined text-[16px] text-secondary">receipt_long</span>
            <span class="font-label-md text-label-md">Rentabilidad del mes</span>
          </button>
        </div>
      </div>

      <!-- Smart Insight Cards Grid -->
      <div class="flex flex-col gap-space-sm" id="insights-container">
        <!-- Card 1: Sobreprecio de Insumo (Alert / Pricing) -->
        <div class="relative overflow-hidden rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-all duration-300 border border-surface-variant/40" id="card-cost-alert">
          <div class="flex items-start justify-between gap-space-xs mb-space-xs">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed-variant flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-[18px]">trending_up</span>
              </div>
              <span class="font-label-sm text-label-sm text-tertiary font-bold tracking-wide uppercase">Alerta de Insumo Crítico</span>
            </div>
            <span class="font-label-sm text-label-sm text-on-surface-variant">Hace 18 min</span>
          </div>
          <div class="flex flex-col gap-2">
            <p class="font-body-md text-body-md text-on-surface leading-snug">
              Detecté que el precio del <span class="font-bold text-on-surface">huevo fresco</span> subió un <span class="text-tertiary font-bold">+14%</span> este mes. Te sugiero ajustar el precio del <span class="font-bold text-on-surface">Pastel Red Velvet</span> para mantener tu margen objetivo del 58%.
            </p>
            <!-- Metric comparison -->
            <div class="my-1 p-2.5 rounded-lg bg-surface-container flex items-center justify-between text-on-surface">
              <div class="flex flex-col">
                <span class="font-label-sm text-label-sm text-on-surface-variant">Precio actual</span>
                <span class="font-headline-sm text-headline-sm line-through text-on-surface-variant">${settings.currency}25.00</span>
              </div>
              <div class="flex items-center justify-center text-primary">
                <span class="material-symbols-outlined text-[20px]">arrow_forward</span>
              </div>
              <div class="flex flex-col">
                <span class="font-label-sm text-label-sm text-primary font-semibold">Sugerido (+12%)</span>
                <span class="font-headline-sm text-headline-sm text-primary font-bold">${settings.currency}28.00</span>
              </div>
              <div class="flex flex-col items-end">
                <span class="font-label-sm text-label-sm text-on-surface-variant">Margen</span>
                <span class="font-headline-sm text-headline-sm text-secondary font-bold">58%</span>
              </div>
            </div>
          </div>
          <div class="mt-space-sm flex items-center justify-between gap-space-xs pt-1">
            <button class="flex-1 py-2.5 px-4 rounded-xl bg-tertiary text-on-tertiary font-label-md text-label-md flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity active:scale-[0.98] font-bold" id="btnApplyInflationAdjustment" type="button">
              <span class="material-symbols-outlined text-[18px]">check_circle</span>
              <span>Aplicar ajuste en 1 clic</span>
            </button>
            <button aria-label="Descartar recomendación" class="w-10 h-10 rounded-xl bg-surface-container text-on-surface-variant flex items-center justify-center hover:bg-surface-container-high transition-colors" id="btnDismissAlert" type="button">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        <!-- Card 2: Receta Antimerma (Culinary Innovation) -->
        <div class="rounded-xl bg-surface-container-lowest p-space-md shadow-sm transition-all duration-300 border border-surface-variant/40" id="card-recipe-rescue">
          <div class="flex items-start justify-between gap-space-xs mb-space-xs">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-secondary-fixed text-on-secondary-fixed-variant flex items-center justify-center flex-shrink-0">
                <span class="material-symbols-outlined text-[18px]">recycling</span>
              </div>
              <span class="font-label-sm text-label-sm text-secondary font-bold tracking-wide uppercase">Cero Mermas • Oportunidad</span>
            </div>
            <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-bold">
              Ahorro $48
            </span>
          </div>
          <div class="flex flex-col gap-space-xs">
            <p class="font-body-md text-body-md text-on-surface leading-snug">
              Tienes <span class="font-bold">4.2 kg de fresas frescas</span> próximas a madurar y <span class="font-bold">12 claras de huevo</span> en refrigeración. Creé una receta de alto rendimiento:
            </p>
            <!-- Recipe Teaser Preview Card -->
            <div class="flex gap-space-sm p-space-xs rounded-xl bg-surface-container-low items-center">
              <div class="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-surface-container">
                <img class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBNE-784HDJXB4kNP35FAQXvEwhuHkObvuW2SgU9tFfVE257l77KBRGI9Gg2zH1aeQzh3KINefMhOB5qhWFPMDT5btArKRjdgNVjjenJjJm_dn2COcCYGFjHYivh90FQEosh3nftZGQld4Edw0ydn6KOSanlyPNnxWeBL3Tq2DtufodUOpMW8aEsXsFpY57BsJREZA8K-h3dTlEbGiku3qIiO6JjcZ4_H5Gkb0qLg"/>
              </div>
              <div class="flex-1 min-w-0 flex flex-col justify-center">
                <span class="font-headline-sm text-headline-sm text-on-surface truncate font-bold">Pavlova de Frutos Rojos</span>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Rendimiento: 8 porciones individuales</span>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="font-label-sm text-label-sm text-primary font-bold">Costo unitario: ${settings.currency}1.15</span>
                  <span class="font-label-sm text-label-sm text-on-surface-variant">• PVP: ${settings.currency}4.50</span>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-space-sm flex items-center gap-space-xs pt-1">
            <button class="flex-1 py-2.5 px-4 rounded-xl bg-primary text-on-primary font-label-md text-label-md flex items-center justify-center gap-1.5 shadow-sm hover:opacity-95 transition-opacity active:scale-[0.98] font-bold" id="btnGoToPavlova" type="button">
              <span class="material-symbols-outlined text-[18px]">menu_book</span>
              <span>Ver receta sugerida</span>
            </button>
            <button class="py-2.5 px-3 rounded-xl bg-surface-container text-on-surface font-label-md text-label-md flex items-center justify-center gap-1 hover:bg-surface-container-high transition-colors font-medium" id="btnStartOvenTimer" type="button">
              <span class="material-symbols-outlined text-[18px] text-primary">timer</span>
              <span>Hornear hoy (35m)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Chat Conversacional con la IA Pastelera -->
      <div class="bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-variant/40 flex flex-col gap-3">
        <div class="flex items-center justify-between border-b border-surface-variant/40 pb-2.5">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">chat</span>
            <h3 class="font-headline-sm text-on-surface font-bold">Consulta Culinaria & Asesoría</h3>
          </div>
          <span class="text-[11px] font-semibold text-on-surface-variant px-2 py-0.5 rounded-full bg-surface-container-low">
            ${hasKey ? 'Gemini 2.5 Live' : 'Modo Asistente'}
          </span>
        </div>

        <!-- Chat messages container -->
        <div class="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1" id="aiChatMessages">
          ${chatHistory.map(msg => `
            <div class="flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}">
              <div class="max-w-[85%] p-3 rounded-2xl text-body-sm leading-relaxed ${msg.sender === 'user' ? 'bg-primary text-on-primary rounded-br-none' : 'bg-surface-container text-on-surface rounded-bl-none'}">
                ${msg.text}
              </div>
            </div>
          `).join("")}
        </div>

        <!-- Chat Input Bar -->
        <div class="flex items-center gap-2 mt-1">
          <input type="text" id="aiChatInput" class="flex-1 bg-surface-container-low px-3.5 py-2.5 rounded-xl text-on-surface outline-none text-body-md placeholder:text-outline focus:ring-2 focus:ring-primary" placeholder="Pregunta sobre recetas, sustitutos o mermas..." />
          <button class="w-11 h-11 rounded-xl bg-primary text-on-primary flex items-center justify-center shadow-sm hover:opacity-95 active:scale-95 transition-all flex-shrink-0" id="aiSendBtn">
            <span class="material-symbols-outlined text-[20px]">send</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Modal Configuración Gemini API Key -->
    <div id="geminiKeyModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm hidden flex items-center justify-center p-4">
      <div class="bg-surface-container-lowest w-full max-w-md rounded-3xl p-5 flex flex-col gap-4 shadow-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">key</span>
            <h3 class="font-headline-sm font-bold text-on-surface">Configurar Google Gemini</h3>
          </div>
          <button class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-colors" id="btnCloseGeminiModal">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <p class="text-xs text-on-surface-variant leading-relaxed">
          Ingresa tu clave de API de Google Gemini (Google AI Studio). La clave se almacena de forma segura en tu navegador y habilita el Chef IA en tiempo real, OCR de fotos y extractor de redes sociales.
        </p>

        <div class="flex flex-col gap-1.5">
          <label class="text-xs font-bold text-on-surface uppercase tracking-wider" for="geminiApiKeyInput">Gemini API Key</label>
          <div class="relative">
            <input type="password" id="geminiApiKeyInput" class="w-full bg-surface-container-low px-3.5 py-2.5 rounded-xl text-on-surface outline-none text-body-md font-mono pr-10 border border-surface-variant/40 focus:border-primary" placeholder="AIzaSy..." value="${GeminiAPI.getApiKey() || ''}" />
            <button class="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-primary" id="btnToggleKeyVisibility" type="button" title="Mostrar/Ocultar">
              <span class="material-symbols-outlined text-[18px]" id="iconKeyEye">visibility</span>
            </button>
          </div>
          <span class="text-[11px] text-on-surface-variant">Puedes obtener tu clave gratuita en <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" class="text-primary underline font-semibold">Google AI Studio</a>.</span>
        </div>

        <div class="p-3 bg-surface-container-low rounded-xl border border-surface-variant/30 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full ${hasKey ? 'bg-[#10b981]' : 'bg-tertiary'}"></span>
            <span class="text-xs font-bold text-on-surface">${hasKey ? 'API Key Configurada' : 'Sin configurar'}</span>
          </div>
          <span class="text-[11px] text-on-surface-variant">Modelos: 2.5-flash, 2.0-flash</span>
        </div>

        <div class="flex flex-col gap-2 pt-1">
          <button class="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold text-sm shadow-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity" id="btnSaveGeminiKey">
            <span class="material-symbols-outlined text-[18px]">save</span>
            <span>Guardar Configuración</span>
          </button>
          <button class="w-full py-2 rounded-xl bg-surface-container text-on-surface font-semibold text-xs hover:bg-surface-container-high transition-colors" id="btnRemoveGeminiKey">
            Eliminar clave guardada
          </button>
        </div>
      </div>
    </div>
  `;

  attachChefAIEvents(container);
}

function attachChefAIEvents(container) {
  const settings = store.getSettings();

  // Gemini API Key Modal
  const keyModal = container.querySelector("#geminiKeyModal");
  container.querySelector("#btnConfigureGeminiKey")?.addEventListener("click", () => {
    keyModal?.classList.remove("hidden");
  });
  container.querySelector("#btnCloseGeminiModal")?.addEventListener("click", () => {
    keyModal?.classList.add("hidden");
  });

  const keyInput = container.querySelector("#geminiApiKeyInput");
  const toggleEye = container.querySelector("#btnToggleKeyVisibility");
  toggleEye?.addEventListener("click", () => {
    if (keyInput) {
      const isPass = keyInput.type === "password";
      keyInput.type = isPass ? "text" : "password";
      const icon = container.querySelector("#iconKeyEye");
      if (icon) icon.innerText = isPass ? "visibility_off" : "visibility";
    }
  });

  container.querySelector("#btnSaveGeminiKey")?.addEventListener("click", () => {
    const val = keyInput?.value?.trim() || "";
    GeminiAPI.setApiKey(val);
    alert(val ? "✅ Clave de Google Gemini guardada con éxito." : "Clave eliminada.");
    keyModal?.classList.add("hidden");
    renderChefAIView(container);
  });

  container.querySelector("#btnRemoveGeminiKey")?.addEventListener("click", () => {
    GeminiAPI.setApiKey("");
    if (keyInput) keyInput.value = "";
    alert("Clave de Gemini eliminada.");
    keyModal?.classList.add("hidden");
    renderChefAIView(container);
  });

  // Prompt pill click
  container.querySelectorAll(".ai-prompt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const promptText = btn.getAttribute("data-prompt");
      handleUserChatMessage(promptText, container);
    });
  });

  // Apply Inflation Adjustment 1-click
  container.querySelector("#btnApplyInflationAdjustment")?.addEventListener("click", () => {
    const prod = store.getProduct("p1"); // Pastel Red Velvet
    if (prod) {
      prod.price = 28.00;
      store.saveProduct(prod);
      notifications.sendPush("✅ Precio Actualizado", {
        body: "Pastel Red Velvet ajustado a $28.00 para mantener 58% de margen."
      });
      alert("¡Ajuste aplicado! El precio en el POS y catálogo ahora es de $28.00.");
      container.querySelector("#card-cost-alert")?.remove();
    }
  });

  // Dismiss alert
  container.querySelector("#btnDismissAlert")?.addEventListener("click", () => {
    container.querySelector("#card-cost-alert")?.remove();
  });

  // Go to Pavlova recipe
  container.querySelector("#btnGoToPavlova")?.addEventListener("click", () => {
    window.location.hash = "#recetario";
  });

  // Start Kitchen Timer
  container.querySelector("#btnStartOvenTimer")?.addEventListener("click", () => {
    notifications.addBakingTimer("Pavlova de Frutos Rojos", 35);
  });

  // Test chime
  container.querySelector("#btnTestKitchenChime")?.addEventListener("click", () => {
    notifications.sendPush("🔔 Alarma de Cocina Activada", {
      body: "El sistema de alertas y temporizadores está funcionando."
    });
  });

  // Chat send
  const chatInput = container.querySelector("#aiChatInput");
  const sendBtn = container.querySelector("#aiSendBtn");

  const submitChat = () => {
    const text = chatInput?.value;
    if (!text || !text.trim()) return;
    chatInput.value = "";
    handleUserChatMessage(text.trim(), container);
  };

  sendBtn?.addEventListener("click", submitChat);
  chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitChat();
  });
}

async function handleUserChatMessage(text, container) {
  if (!text || !text.trim()) return;

  chatHistory.push({ sender: "user", text });

  // Render current user bubble
  renderChefAIView(container);
  const messagesContainer = container.querySelector("#aiChatMessages");

  // Show "Chef Dulce pensando..." loading indicator
  const thinkingEl = document.createElement("div");
  thinkingEl.id = "aiThinkingIndicator";
  thinkingEl.className = "flex justify-start";
  thinkingEl.innerHTML = `
    <div class="p-3 rounded-2xl text-body-sm leading-relaxed bg-surface-container text-primary font-medium flex items-center gap-2 rounded-bl-none shadow-sm">
      <span class="material-symbols-outlined text-[18px] animate-spin">sync</span>
      <span>Chef Dulce pensando...</span>
    </div>
  `;
  if (messagesContainer) {
    messagesContainer.appendChild(thinkingEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // 1. Check if live Google Gemini API call can be made
  let reply = null;

  if (GeminiAPI.hasApiKey()) {
    try {
      const inventory = store.getInventory();
      const recipes = store.getRecipes();
      const settings = store.getSettings();
      const currency = settings.currency || "$";

      const inventorySummary = inventory.slice(0, 30).map(item =>
        `- ${item.name}: stock ${item.stock} ${item.unit}, costo ${currency}${item.costPerUnit}/${item.unit}`
      ).join("\n");

      const recipesSummary = recipes.slice(0, 15).map(r =>
        `- ${r.name} (${r.category}): porciones ${r.portions}, precio ${currency}${r.actualPrice || r.suggestedPrice}, margen ${r.targetMargin}%`
      ).join("\n");

      const systemPrompt = `Eres el Chef Dulce IA, el Asesor Culinario Ejecutivo, Maestro Pastelero y Consultor de Costos de Sweet Smile Pastry & Bakery.
Tu misión es brindar asesoramiento experto, cálido y profesional en repostería fina, optimización de márgenes de ganancia, sustituciones técnicas de ingredientes y rescate de mermas de almacén.

DATOS EN VIVO DEL OBRADOR:
Moneda del negocio: ${currency}
Insumos activos en inventario:
${inventorySummary || "Sin insumos registrados"}

Recetas activas en catálogo:
${recipesSummary || "Sin recetas registradas"}

DIRECTRICES:
1. Responde siempre en español, con tono profesional, amable, motivador y culinariamente preciso.
2. Si te preguntan por costos, recetas o ingredientes, haz referencia directa a los insumos y precios reales del inventario listados arriba.
3. Sugiere sustituciones con fundamentos técnicos (por ejemplo, punto de fusión de grasas, hidratación de almidones, emulsiones).
4. Ofrece recomendaciones prácticas para maximizar el margen de ganancia y evitar desperdicios.`;

      reply = await GeminiAPI.chat(text, systemPrompt, chatHistory.slice(0, -1));
    } catch (err) {
      console.warn("[ChefAIView] Live Gemini chat call failed, providing culinary response:", err.message || err);
      reply = `🧑‍🍳 Hubo un detalle al conectar con Gemini: ${err.message}. Aún así, según tu inventario actual, te sugiero revisar las mermas de frutas y priorizar elaboraciones con más de 55% de margen.`;
    }
  }

  // 2. Intelligent Culinary Fallback (if no key configured or offline)
  if (!reply) {
    const q = text.toLowerCase();
    if (q.includes("costo") || q.includes("tres leches") || q.includes("optimizar")) {
      reply = "💡 Para optimizar costos en el Pastel Tres Leches: te sugiero reemplazar el 30% de crema de leche por leche evaporada aromatizada con vainilla. Reducirás el costo por porción de $1.40 a $1.08 aumentando tu margen al 62%.";
    } else if (q.includes("mantequilla") || q.includes("inflación")) {
      reply = "📈 Con la mantequilla en $10.00/kg, las recetas más sensibles son el Croissant Francés y la Selva Negra. Se recomienda un aumento de 5% a 8% en el precio de venta o elaborar lotes dobles para optimizar horas de horneado.";
    } else if (q.includes("fresa") || q.includes("sobrante") || q.includes("merma")) {
      reply = "🍓 ¡Excelente oportunidad de cero mermas! Con tus 4.2 kg de fresas y claras de huevo, elabora Pavlovas individuales o Coulis para congelar. El margen bruto de la Pavlova es del 74% y no requiere harinas especiales.";
    } else if (q.includes("sustituir") || q.includes("reemplazar")) {
      reply = "🔄 En pastelería, 100g de mantequilla pueden sustituirse por 85g de aceite de coco virgen (para masas más húmedas) o 80g de puré de manzana (para versiones saludables bajas en grasa).";
    } else {
      reply = `👩‍🍳 Basado en tus ${store.getInventory().length} insumos activos, te recomiendo enfocar la producción de este fin de semana en Cheesecake Vasco y Cupcakes de Vainilla, ya que tienen los márgenes más altos (>55%) y dispones de stock suficiente.\n\n💡 Sugerencia: Puedes configurar tu API Key gratuita de Google Gemini usando el botón superior para consultas culinarias ilimitadas en tiempo real.`;
    }
  }

  // Remove thinking element and render assistant response
  const currentThinking = container.querySelector("#aiThinkingIndicator");
  if (currentThinking) currentThinking.remove();

  chatHistory.push({ sender: "assistant", text: reply });
  renderChefAIView(container);

  const finalMessages = container.querySelector("#aiChatMessages");
  if (finalMessages) finalMessages.scrollTop = finalMessages.scrollHeight;
}
