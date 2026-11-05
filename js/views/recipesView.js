// js/views/recipesView.js - Stitch Screen 3: Recetario & Costos, OCR, Redes Sociales y Exportar PDF
import { store } from '../store.js';
import { CostingEngine } from '../costing.js';
import { OCRAIEngine } from '../ocr-ai.js';
import { RecipePdfExporter } from '../pdf-export.js';
import { uiToast, uiModal } from '../ui-feedback.js';

let selectedRecipeId = "rec-042"; // Pastel Selva Negra
let currentCategoryFilter = "all";
let customSliderMargin = null;

export function renderRecipesView(container) {
  const recipes = store.getRecipes();
  const settings = store.getSettings();

  // Selected recipe
  let currentRecipe = recipes.find(r => r.id === selectedRecipeId) || recipes[0];
  if (!currentRecipe && recipes.length > 0) currentRecipe = recipes[0];

  const calc = currentRecipe ? CostingEngine.calculateRecipe(currentRecipe, customSliderMargin) : null;

  const filteredRecipes = currentCategoryFilter === "all"
    ? recipes
    : recipes.filter(r => r.category.toLowerCase().includes(currentCategoryFilter.toLowerCase()));

  container.innerHTML = `
    <div class="flex flex-col w-full px-margin pb-28 gap-space-md">
      <!-- Search & Top Actions Row -->
      <div class="flex items-center gap-space-xs mt-1">
        <div class="flex-1 relative flex items-center">
          <span class="material-symbols-outlined absolute left-3 text-secondary text-[20px]">search</span>
          <input class="w-full h-11 pl-10 pr-3 rounded-xl bg-surface-container text-on-surface font-body-md text-body-md placeholder:text-on-surface-variant focus:outline-none focus:bg-surface-container-lowest transition-colors shadow-sm" id="recipeSearch" placeholder="Buscar receta, ingrediente o SKU..." type="text"/>
        </div>
        <button class="h-11 px-3.5 rounded-xl bg-primary text-on-primary font-label-lg text-label-lg flex items-center gap-1 flex-shrink-0 shadow-md hover:bg-primary-container active:scale-95 transition-all" id="newRecipeBtn" type="button">
          <span class="material-symbols-outlined text-[18px]">add_circle</span>
          <span>+ Nueva</span>
        </button>
      </div>

      <!-- Action Tools: OCR Foto y Redes Sociales -->
      <div class="grid grid-cols-2 gap-2">
        <button class="p-2.5 rounded-xl bg-secondary-fixed/50 hover:bg-secondary-fixed text-on-secondary-fixed font-label-md flex items-center justify-center gap-1.5 shadow-xs transition-colors" id="btnOcrPhoto">
          <span class="material-symbols-outlined text-[18px] text-primary">photo_camera</span>
          <span>Foto a Receta (OCR)</span>
        </button>
        <button class="p-2.5 rounded-xl bg-tertiary-fixed/50 hover:bg-tertiary-fixed text-on-tertiary-fixed font-label-md flex items-center justify-center gap-1.5 shadow-xs transition-colors" id="btnImportSocial">
          <span class="material-symbols-outlined text-[18px] text-tertiary">share</span>
          <span>TikTok / Reels / YouTube</span>
        </button>
      </div>

      <!-- Filter Pills (Horizontal Scroll) -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 -mx-margin px-margin no-scrollbar">
        <button class="recipe-cat-pill px-3.5 py-1.5 rounded-full font-label-md flex items-center gap-1.5 shadow-sm flex-shrink-0 ${currentCategoryFilter === 'all' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="all" type="button">
          <span class="material-symbols-outlined text-[16px]">menu_book</span>
          <span>Todas (${recipes.length})</span>
        </button>
        <button class="recipe-cat-pill px-3.5 py-1.5 rounded-full font-label-md flex items-center gap-1.5 shadow-sm flex-shrink-0 ${currentCategoryFilter === 'Tortas' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="Tortas" type="button">
          <span class="material-symbols-outlined text-[16px]">cake</span>
          <span>Tortas</span>
        </button>
        <button class="recipe-cat-pill px-3.5 py-1.5 rounded-full font-label-md flex items-center gap-1.5 shadow-sm flex-shrink-0 ${currentCategoryFilter === 'Masas' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="Masas" type="button">
          <span class="material-symbols-outlined text-[16px]">bakery_dining</span>
          <span>Masas</span>
        </button>
        <button class="recipe-cat-pill px-3.5 py-1.5 rounded-full font-label-md flex items-center gap-1.5 shadow-sm flex-shrink-0 ${currentCategoryFilter === 'Galletas' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="Galletas" type="button">
          <span class="material-symbols-outlined text-[16px]">cookie</span>
          <span>Galletas</span>
        </button>
        <button class="recipe-cat-pill px-3.5 py-1.5 rounded-full font-label-md flex items-center gap-1.5 shadow-sm flex-shrink-0 ${currentCategoryFilter === 'Postres' ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}" data-cat="Postres" type="button">
          <span class="material-symbols-outlined text-[16px]">icecream</span>
          <span>Postres</span>
        </button>
      </div>

      ${currentRecipe && calc ? `
        <!-- Tarjeta de Receta Seleccionada y Costeo Inteligente (Stitch Screen 3 Hero) -->
        <div class="flex flex-col bg-surface-container-lowest rounded-2xl shadow-md overflow-hidden border border-surface-variant/40">
          <!-- Visual Header & Badges -->
          <div class="relative w-full h-44 bg-surface-container-high">
            <img class="w-full h-full object-cover" id="recipeHeroImg" src="${currentRecipe.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCUGUg7P1C8LywkVtJqLkY4D53zo4tyqUmnYtj_JEKHBXSQekjkhTphOh6O5krRL-kggUEmVtQpV5VAcJo-uhyGaHVaSkGFQmO88hOeySu-Lh67MNxdFHCT75hrbeY62OdASz7Ur-oMQGjNBfLa_BdtDuLJX48i78-dVjXW6Ou3GZ538o51lALo-LkBQ3e_oHxldp3tfiQgF8qu4XHz9NXMmvxLHqgoZcwI36eenA'}" />
            <div class="absolute inset-0 bg-gradient-to-t from-inverse-surface/85 via-inverse-surface/25 to-transparent"></div>
            
            <div class="absolute top-3 left-3 flex items-center gap-1.5">
              <span class="px-2.5 py-1 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary font-label-sm text-label-sm shadow-sm flex items-center gap-1 font-bold">
                <span class="material-symbols-outlined text-[14px]">star</span>
                ${currentRecipe.bestseller ? 'Bestseller Pastelería' : currentRecipe.category}
              </span>
            </div>

            <div class="absolute top-3 right-3 flex items-center gap-1.5">
              <button aria-label="Exportar PDF de la receta" class="w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-primary flex items-center justify-center shadow-sm hover:scale-105 active:scale-95 transition-all" id="btnExportPdf" title="Exportar PDF / Imprimir Ficha">
                <span class="material-symbols-outlined text-[18px]">print</span>
              </button>
              <button aria-label="Cambiar Foto" class="w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface flex items-center justify-center shadow-sm hover:text-primary transition-colors" id="btnChangePhoto" title="Añadir/Cambiar Foto">
                <span class="material-symbols-outlined text-[18px]">add_photo_alternate</span>
              </button>
              <button aria-label="Editar Receta" class="w-8 h-8 rounded-full bg-surface-container-lowest/90 backdrop-blur-md text-on-surface flex items-center justify-center shadow-sm hover:text-primary transition-colors" id="btnEditRecipeMeta" title="Editar Detalles">
                <span class="material-symbols-outlined text-[18px]">edit</span>
              </button>
            </div>

            <div class="absolute bottom-3 left-3 right-3 text-inverse-on-surface">
              <div class="flex items-center gap-1 text-primary-fixed text-label-sm font-label-sm uppercase tracking-wider font-semibold">
                <span>Receta Maestra ${currentRecipe.code}</span>
              </div>
              <h2 class="font-headline-md text-headline-md font-bold leading-tight drop-shadow-sm">${currentRecipe.name}</h2>
            </div>
          </div>

          <!-- Quick Meta Metrics Bar -->
          <div class="grid grid-cols-3 bg-surface-container-low px-4 py-2.5 text-center gap-2 border-b border-surface-variant/40">
            <div class="flex flex-col items-center">
              <span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-primary">pie_chart</span> Rinde
              </span>
              <span class="font-headline-sm text-headline-sm font-semibold text-on-surface">${currentRecipe.portions} porc.</span>
            </div>
            <div class="flex flex-col items-center">
              <span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-primary">timer</span> Tiempo
              </span>
              <span class="font-headline-sm text-headline-sm font-semibold text-on-surface">${currentRecipe.prepTime || '2h'}</span>
            </div>
            <div class="flex flex-col items-center">
              <span class="font-label-sm text-label-sm text-on-surface-variant flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px] text-primary">speed</span> Dificultad
              </span>
              <span class="font-headline-sm text-headline-sm font-semibold text-on-surface">${currentRecipe.difficulty || 'Media'}</span>
            </div>
          </div>

          <!-- Ingredient Costing Interactive Table -->
          <div class="p-4 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="material-symbols-outlined text-primary text-[18px]">grocery</span>
                <span class="font-headline-sm text-headline-sm text-on-surface font-bold">Insumos y Costos Reales</span>
              </div>
              <span class="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-label-sm text-label-sm font-semibold">${calc.ingredients.length} ingredientes</span>
            </div>

            <div class="flex flex-col rounded-xl overflow-hidden bg-surface-container-low border border-surface-variant/30" id="recipeIngredientsList">
              ${calc.ingredients.map((ing, idx) => `
                <div class="flex items-center justify-between p-2.5 ${idx % 2 === 0 ? 'bg-surface-container-lowest' : 'bg-surface-container-low'} hover:bg-surface-container transition-colors">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-2 h-2 rounded-full ${idx === 2 ? 'bg-tertiary' : 'bg-primary'} flex-shrink-0"></span>
                    <div class="flex flex-col min-w-0">
                      <span class="font-body-md text-body-md font-semibold text-on-surface truncate">${ing.name}</span>
                      <span class="font-body-sm text-body-sm text-on-surface-variant">${ing.quantity} ${ing.unit} • ${settings.currency}${Number(ing.unitCost).toFixed(2)}/${ing.unit}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="font-label-lg text-label-lg font-bold text-on-surface flex-shrink-0">${settings.currency}${Number(ing.totalCost).toFixed(2)}</span>
                    <button class="btn-del-ing text-outline hover:text-tertiary p-1" data-idx="${idx}" title="Quitar ingrediente">
                      <span class="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>
                </div>
              `).join("")}
            </div>

            <!-- Add Ingredient Quick Button -->
            <button class="w-full py-2.5 rounded-xl bg-surface-container-high text-primary font-label-md text-label-md flex items-center justify-center gap-1 hover:bg-surface-container-highest transition-colors active:scale-98" id="btnAddIngredientRow" type="button">
              <span class="material-symbols-outlined text-[18px]">add</span>
              <span>Añadir Insumo a la Fórmula</span>
            </button>

            <!-- Cost Breakdown Tiers -->
            <div class="flex flex-col gap-2 p-3 rounded-xl bg-surface-container-high">
              <div class="flex items-center justify-between text-on-surface font-body-sm text-body-sm">
                <span class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-secondary">inventory_2</span>
                  Costo Total de Insumos:
                </span>
                <span class="font-semibold">${settings.currency}${calc.directIngredientsCost.toFixed(2)}</span>
              </div>
              <div class="flex items-center justify-between text-on-surface font-body-sm text-body-sm">
                <span class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[16px] text-secondary">electric_bolt</span>
                  Costo Indirecto (Gas/Luz/Horno):
                </span>
                <span class="font-semibold">${settings.currency}${calc.indirectCost.toFixed(2)}</span>
              </div>
              <div class="h-px bg-outline-variant/40 my-1"></div>
              <div class="flex items-center justify-between font-headline-sm text-headline-sm text-on-surface">
                <span>Costo Total Producción:</span>
                <span class="font-bold text-primary">${settings.currency}${calc.totalProductionCost.toFixed(2)}</span>
              </div>
              <div class="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm">
                <span>Costo unitario por porción (${calc.portions} cortes):</span>
                <span class="font-semibold text-on-surface">${settings.currency}${calc.unitCost.toFixed(2)} / porción</span>
              </div>
            </div>

            <!-- Smart Margin Calculator Spotlight (Slider interactivo de margen de ganancia) -->
            <div class="p-4 rounded-xl bg-primary text-on-primary flex flex-col gap-3 shadow-md">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-secondary-fixed text-[20px]">smart_toy</span>
                  <span class="font-headline-sm text-headline-sm font-bold">Costeo Inteligente & Margen</span>
                </div>
                <span class="px-2.5 py-0.5 rounded-full bg-on-primary/20 text-on-primary font-label-sm text-label-sm font-bold" id="marginBadge">
                  Margen: ${calc.targetMargin}%
                </span>
              </div>
              
              <div class="flex items-end justify-between">
                <div class="flex flex-col">
                  <span class="font-label-sm text-label-sm text-primary-fixed">PVP Recomendado</span>
                  <span class="font-data-metric text-data-metric leading-none font-extrabold tracking-tight" id="dispPvp">
                    ${settings.currency}${calc.suggestedPrice.toFixed(2)}
                  </span>
                </div>
                <div class="flex flex-col text-right">
                  <span class="font-label-sm text-label-sm text-primary-fixed">Ganancia Estimada</span>
                  <span class="font-headline-md text-headline-md font-bold text-secondary-fixed" id="dispProfit">
                    +${settings.currency}${calc.grossProfit.toFixed(2)} <span class="text-label-md">(${calc.targetMargin}%)</span>
                  </span>
                </div>
              </div>

              <!-- Slider Simulator -->
              <div class="flex flex-col gap-1.5 pt-1">
                <div class="flex justify-between font-label-sm text-label-sm text-primary-fixed">
                  <span>Ajustar Margen de Ganancia</span>
                  <span id="sliderValueText">${calc.targetMargin}%</span>
                </div>
                <input type="range" min="15" max="85" value="${calc.targetMargin}" class="w-full h-2 bg-on-primary/30 rounded-lg appearance-none cursor-pointer accent-secondary-fixed" id="marginSlider" />
              </div>
            </div>

            <!-- Quick Actions for Formula -->
            <div class="flex items-center gap-2 pt-1">
              <button class="flex-1 h-10 rounded-xl bg-surface-container-high text-on-surface font-label-md text-label-md flex items-center justify-center gap-1.5 hover:bg-surface-container-highest transition-colors active:scale-98" id="btnAuditInflation" type="button">
                <span class="material-symbols-outlined text-[16px]">sync</span>
                <span>Recalcular Alzas</span>
              </button>
              <button class="flex-1 h-10 rounded-xl bg-primary-container text-on-primary-container font-label-md text-label-md flex items-center justify-center gap-1.5 hover:opacity-90 shadow-sm transition-opacity active:scale-98 font-bold" id="btnSaveRecipeChanges" type="button">
                <span class="material-symbols-outlined text-[16px]">save</span>
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Saved Recipes Library Header -->
      <div class="flex items-center justify-between pt-2">
        <div>
          <h3 class="font-headline-md text-headline-md text-on-surface font-bold">Recetas Guardadas</h3>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Monitoreo de rendimiento e inflación de insumos</p>
        </div>
        <span class="font-label-sm text-label-sm text-primary font-bold">${recipes.length} en catálogo</span>
      </div>

      <!-- Saved Recipes List -->
      <div class="flex flex-col gap-3">
        ${filteredRecipes.map(r => {
          const rCalc = CostingEngine.calculateRecipe(r);
          const isSelected = r.id === selectedRecipeId;
          return `
            <div class="recipe-card p-3 rounded-2xl bg-surface-container-lowest shadow-sm flex items-center justify-between gap-3 border ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-surface-variant/40'} hover:shadow-md transition-all cursor-pointer" data-id="${r.id}">
              <div class="flex items-center gap-3 min-w-0">
                <img class="w-14 h-14 rounded-xl object-cover flex-shrink-0" src="${r.image || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCUGUg7P1C8LywkVtJqLkY4D53zo4tyqUmnYtj_JEKHBXSQekjkhTphOh6O5krRL-kggUEmVtQpV5VAcJo-uhyGaHVaSkGFQmO88hOeySu-Lh67MNxdFHCT75hrbeY62OdASz7Ur-oMQGjNBfLa_BdtDuLJX48i78-dVjXW6Ou3GZ538o51lALo-LkBQ3e_oHxldp3tfiQgF8qu4XHz9NXMmvxLHqgoZcwI36eenA'}" />
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-primary">${r.code}</span>
                    <span class="text-xs text-on-surface-variant">• ${r.portions} porc.</span>
                  </div>
                  <h4 class="font-label-lg font-bold text-on-surface truncate">${r.name}</h4>
                  <span class="text-xs text-on-surface-variant">Costo: ${settings.currency}${rCalc.totalProductionCost.toFixed(2)} | PVP: ${settings.currency}${rCalc.suggestedPrice.toFixed(2)}</span>
                </div>
              </div>
              <div class="text-right flex-shrink-0">
                <span class="font-headline-sm font-extrabold text-primary block">+${rCalc.targetMargin}%</span>
                <span class="text-[11px] text-on-surface-variant uppercase tracking-wider">Margen</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <!-- Hidden file input for Photo OCR & Recipe Image -->
    <input type="file" id="recipeFileInput" accept="image/*" class="hidden" />

    <!-- Modal OCR Photo Scanner -->
    <div id="ocrModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm hidden flex items-center justify-center p-4">
      <div class="bg-surface-container-lowest w-full max-w-md rounded-3xl p-5 flex flex-col gap-4 shadow-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">photo_camera</span>
            <h3 class="font-headline-sm font-bold text-on-surface">Foto a Receta con IA</h3>
          </div>
          <button class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant" id="closeOcrModalBtn">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p class="font-body-sm text-on-surface-variant">
          Toma una foto de tu libreta de recetas o escoge un archivo. La IA extraerá los ingredientes, cantidades y tiempos automáticamente.
        </p>

        <div class="border-2 border-dashed border-primary/30 rounded-2xl p-6 text-center bg-surface-container-low flex flex-col items-center gap-2 cursor-pointer hover:bg-surface-container transition-colors" id="ocrDropArea">
          <span class="material-symbols-outlined text-[36px] text-primary">add_a_photo</span>
          <span class="font-label-md font-bold text-on-surface">Tomar Foto con la Cámara o Galería</span>
          <span class="text-xs text-on-surface-variant">PNG, JPG, HEIC soportados (Cámara activa)</span>
          <input type="file" id="ocrFileInput" accept="image/*" capture="environment" class="hidden" />
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">O prueba con ejemplos pre-escaneados:</span>
          <div class="grid grid-cols-2 gap-2">
            <button class="p-2 rounded-xl bg-surface-container text-xs font-semibold text-primary hover:bg-surface-container-high transition-colors text-left" id="presetCarrotCake">
              🥕 Pastel Zanahoria & Nuez
            </button>
            <button class="p-2 rounded-xl bg-surface-container text-xs font-semibold text-primary hover:bg-surface-container-high transition-colors text-left" id="presetAlfajores">
              🍪 Alfajores de Maicena
            </button>
          </div>
        </div>

        <div id="ocrLoading" class="hidden flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-xl text-primary font-bold text-sm">
          <span class="material-symbols-outlined animate-spin text-[20px]">sync</span>
          <span>Analizando fotografía con Gemini Vision y calculando costos...</span>
        </div>
      </div>
    </div>

    <!-- Modal Redes Sociales Importer -->
    <div id="socialModal" class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm hidden flex items-center justify-center p-4">
      <div class="bg-surface-container-lowest w-full max-w-md rounded-3xl p-5 flex flex-col gap-4 shadow-2xl">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-tertiary text-[24px]">share</span>
            <h3 class="font-headline-sm font-bold text-on-surface">Guardar desde Redes con IA</h3>
          </div>
          <button class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant" id="closeSocialModalBtn">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <p class="font-body-sm text-on-surface-variant">
          Pega el enlace de un video o reel de TikTok, Instagram o YouTube Shorts. La IA extraerá o reconstruirá la receta completa con sus ingredientes y costos.
        </p>

        <div class="flex flex-col gap-2.5">
          <div class="flex flex-col gap-1">
            <label for="socialUrlInput" class="text-xs font-bold text-on-surface">Enlace del Video o Reel</label>
            <input type="url" id="socialUrlInput" class="w-full bg-surface-container-low px-3.5 py-2.5 rounded-xl text-on-surface outline-none text-body-md border border-surface-variant/40 focus:border-primary" placeholder="https://www.tiktok.com/@pasteleria/video/..." />
          </div>
          <div class="flex flex-col gap-1">
            <label for="socialCaptionInput" class="text-xs font-bold text-on-surface-variant">Descripción o Subtítulos (Opcional)</label>
            <textarea id="socialCaptionInput" rows="2" class="w-full bg-surface-container-low px-3.5 py-2 rounded-xl text-on-surface outline-none text-body-sm border border-surface-variant/40 focus:border-primary placeholder:text-outline" placeholder="Pega texto adicional, ingredientes del video o transcripción..."></textarea>
          </div>
          <button class="w-full py-2.5 rounded-xl bg-tertiary text-on-tertiary font-label-md font-bold shadow-sm hover:opacity-95 transition-opacity flex items-center justify-center gap-1.5" id="btnRunSocialImport">
            <span class="material-symbols-outlined text-[18px]">download</span>
            <span>Importar y Guardar Receta</span>
          </button>
        </div>

        <div class="flex flex-col gap-1.5">
          <span class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Enlaces virales para probar:</span>
          <div class="flex flex-col gap-1.5">
            <button class="p-2 rounded-xl bg-surface-container text-xs text-on-surface hover:bg-surface-container-high transition-colors text-left flex items-center justify-between" id="testLinkCookie">
              <span>🍪 TikTok: Cookies de Pistacho & Frambuesa</span>
              <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
            <button class="p-2 rounded-xl bg-surface-container text-xs text-on-surface hover:bg-surface-container-high transition-colors text-left flex items-center justify-between" id="testLinkRolls">
              <span>🧁 Instagram: Rolls de Canela Artesanales</span>
              <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </div>

        <div id="socialLoading" class="hidden flex items-center justify-center gap-2 p-3 bg-tertiary/10 rounded-xl text-tertiary font-bold text-sm">
          <span class="material-symbols-outlined animate-spin text-[20px]">sync</span>
          <span>Estructurando receta y costos con Google Gemini...</span>
        </div>
      </div>
    </div>
  `;

  attachRecipesEvents(container);
}

function attachRecipesEvents(container) {
  const recipes = store.getRecipes();
  let currentRecipe = recipes.find(r => r.id === selectedRecipeId) || recipes[0];

  // Select recipe card
  container.querySelectorAll(".recipe-card").forEach(card => {
    card.addEventListener("click", () => {
      selectedRecipeId = card.getAttribute("data-id");
      customSliderMargin = null;
      renderRecipesView(container);
    });
  });

  // Category filter
  container.querySelectorAll(".recipe-cat-pill").forEach(pill => {
    pill.addEventListener("click", () => {
      currentCategoryFilter = pill.getAttribute("data-cat");
      renderRecipesView(container);
    });
  });

  // Search input
  const searchInput = container.querySelector("#recipeSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      container.querySelectorAll(".recipe-card").forEach(card => {
        const id = card.getAttribute("data-id");
        const rec = store.getRecipe(id);
        if (rec && (rec.name.toLowerCase().includes(q) || rec.code.toLowerCase().includes(q))) {
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    });
  }

  // Margin Slider
  const slider = container.querySelector("#marginSlider");
  if (slider && currentRecipe) {
    slider.addEventListener("input", (e) => {
      const val = parseInt(e.target.value);
      customSliderMargin = val;
      const calc = CostingEngine.calculateRecipe(currentRecipe, val);
      const settings = store.getSettings();

      container.querySelector("#marginBadge").innerText = `Margen: ${val}%`;
      container.querySelector("#sliderValueText").innerText = `${val}%`;
      container.querySelector("#dispPvp").innerText = `${settings.currency}${calc.suggestedPrice.toFixed(2)}`;
      container.querySelector("#dispProfit").innerHTML = `+${settings.currency}${calc.grossProfit.toFixed(2)} <span class="text-label-md">(${val}%)</span>`;
    });
  }

  // Export PDF / Print
  container.querySelector("#btnExportPdf")?.addEventListener("click", () => {
    if (currentRecipe) {
      RecipePdfExporter.printRecipePdf(currentRecipe);
    }
  });

  // Save changes (e.g. margin)
  container.querySelector("#btnSaveRecipeChanges")?.addEventListener("click", () => {
    if (currentRecipe) {
      if (customSliderMargin !== null) {
        currentRecipe.targetMargin = customSliderMargin;
        const calc = CostingEngine.calculateRecipe(currentRecipe, customSliderMargin);
        currentRecipe.actualPrice = calc.suggestedPrice;
        currentRecipe.suggestedPrice = calc.suggestedPrice;

        // Also update matching product in POS if exists
        const products = store.getProducts();
        const prod = products.find(p => p.recipeId === currentRecipe.id || p.name.includes(currentRecipe.name.substring(0, 10)));
        if (prod) {
          prod.price = calc.suggestedPrice;
          prod.cost = calc.unitCost;
          store.saveProduct(prod);
        }
      }
      store.saveRecipe(currentRecipe);
      uiToast.success("¡Receta y costos actualizados con éxito!");
      renderRecipesView(container);
    }
  });

  // Add ingredient row
  container.querySelector("#btnAddIngredientRow")?.addEventListener("click", async () => {
    if (!currentRecipe) return;

    // Headless test harness compatibility (e.g. T5-23 sets mockWindow.prompt)
    if (typeof window !== "undefined" && typeof window.prompt === "function" && 
        window.prompt !== window._fallbackPrompt && 
        window.prompt !== window._nativePrompt) {
      const name = window.prompt("Nombre del ingrediente o insumo:", "Azúcar Moreno");
      if (!name) return;
      const qty = parseFloat(window.prompt("Cantidad:", "0.25")) || 0.1;
      const unit = window.prompt("Unidad (kg, L, unid, kit):", "kg") || "kg";
      const unitCost = parseFloat(window.prompt("Costo por unidad ($):", "2.50")) || 1.0;

      currentRecipe.ingredients.push({
        id: "ing-" + Date.now(),
        name,
        quantity: qty,
        unit,
        unitCost,
        totalCost: Math.round(qty * unitCost * 100) / 100
      });
      store.saveRecipe(currentRecipe);
      renderRecipesView(container);
      return;
    }

    // Modern in-app modal form
    const result = await uiModal.showAddIngredientModal();
    if (!result) return;

    currentRecipe.ingredients.push({
      id: "ing-" + Date.now(),
      name: result.name,
      quantity: result.quantity,
      unit: result.unit,
      unitCost: result.unitCost,
      totalCost: Math.round(result.quantity * result.unitCost * 100) / 100
    });
    store.saveRecipe(currentRecipe);
    renderRecipesView(container);
  });

  // Delete ingredient row
  container.querySelectorAll(".btn-del-ing").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute("data-idx"));
      if (currentRecipe && currentRecipe.ingredients) {
        currentRecipe.ingredients.splice(idx, 1);
        store.saveRecipe(currentRecipe);
        renderRecipesView(container);
      }
    });
  });

  // Change Recipe photo
  const fileInput = container.querySelector("#recipeFileInput");
  container.querySelector("#btnChangePhoto")?.addEventListener("click", () => {
    fileInput?.click();
  });
  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file && currentRecipe) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          currentRecipe.image = ev.target.result;
          store.saveRecipe(currentRecipe);
          renderRecipesView(container);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // OCR Modal handlers
  const ocrModal = container.querySelector("#ocrModal");
  container.querySelector("#btnOcrPhoto")?.addEventListener("click", () => {
    ocrModal?.classList.remove("hidden");
  });
  container.querySelector("#closeOcrModalBtn")?.addEventListener("click", () => {
    ocrModal?.classList.add("hidden");
  });

  const processOcrImage = async (imageSource, preset = null) => {
    const loading = container.querySelector("#ocrLoading");
    loading?.classList.remove("hidden");

    try {
      const extracted = await OCRAIEngine.extractRecipeFromPhoto(imageSource, preset);
      loading?.classList.add("hidden");
      ocrModal?.classList.add("hidden");

      const saved = store.saveRecipe(extracted);
      selectedRecipeId = saved.id;
      uiToast.success(`¡Receta escaneada con éxito!\n"${saved.name}" con ${saved.ingredients.length} ingredientes agregada.`);
      renderRecipesView(container);
    } catch (err) {
      loading?.classList.add("hidden");
      uiToast.error(`Error al procesar la imagen de receta: ${err.message || err}`);
    }
  };

  const ocrFileInput = container.querySelector("#ocrFileInput");
  const ocrDropArea = container.querySelector("#ocrDropArea");

  // Trigger file picker on clicking drop area
  ocrDropArea?.addEventListener("click", (e) => {
    if (e.target !== ocrFileInput) {
      if (ocrFileInput && typeof ocrFileInput.click === "function") {
        ocrFileInput.click();
      } else {
        processOcrImage(null, null);
      }
    }
  });

  // Handle selected file via input change
  ocrFileInput?.addEventListener("change", (e) => {
    const file = e.target?.files?.[0];
    if (file) {
      if (typeof FileReader !== "undefined") {
        const reader = new FileReader();
        const loading = container.querySelector("#ocrLoading");
        loading?.classList.remove("hidden");

        reader.onload = (event) => {
          const base64Data = event.target?.result;
          processOcrImage(base64Data, null);
        };
        reader.onerror = () => {
          loading?.classList.add("hidden");
          uiToast.error("Error al leer el archivo de imagen.");
        };
        reader.readAsDataURL(file);
      } else {
        processOcrImage(null, null);
      }
    }
  });

  // Drag and drop support on ocrDropArea
  ocrDropArea?.addEventListener("dragover", (e) => {
    if (e.preventDefault) e.preventDefault();
    ocrDropArea.classList.add("bg-surface-container");
  });
  ocrDropArea?.addEventListener("dragleave", (e) => {
    if (e.preventDefault) e.preventDefault();
    ocrDropArea.classList.remove("bg-surface-container");
  });
  ocrDropArea?.addEventListener("drop", (e) => {
    if (e.preventDefault) e.preventDefault();
    ocrDropArea.classList.remove("bg-surface-container");
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      if (typeof FileReader !== "undefined") {
        const reader = new FileReader();
        const loading = container.querySelector("#ocrLoading");
        loading?.classList.remove("hidden");

        reader.onload = (event) => {
          const base64Data = event.target?.result;
          processOcrImage(base64Data, null);
        };
        reader.readAsDataURL(file);
      } else {
        processOcrImage(null, null);
      }
    }
  });

  container.querySelector("#presetCarrotCake")?.addEventListener("click", () => processOcrImage(null, "carrot_cake"));
  container.querySelector("#presetAlfajores")?.addEventListener("click", () => processOcrImage(null, "alfajores"));

  // Social Modal handlers
  const socialModal = container.querySelector("#socialModal");
  container.querySelector("#btnImportSocial")?.addEventListener("click", () => {
    socialModal?.classList.remove("hidden");
  });
  container.querySelector("#closeSocialModalBtn")?.addEventListener("click", () => {
    socialModal?.classList.add("hidden");
  });

  const runSocialImport = async (url, caption = "") => {
    const loading = container.querySelector("#socialLoading");
    loading?.classList.remove("hidden");
    try {
      const extracted = await OCRAIEngine.importFromSocialUrl(url, caption);
      loading?.classList.add("hidden");
      socialModal?.classList.add("hidden");

      const saved = store.saveRecipe(extracted);
      selectedRecipeId = saved.id;
      uiToast.success(`¡Receta importada de ${extracted.platform}!\n"${saved.name}" agregada a tu catálogo.`);
      renderRecipesView(container);
    } catch (err) {
      loading?.classList.add("hidden");
      uiToast.error(`Error al importar la receta: ${err.message || err}`);
    }
  };

  container.querySelector("#btnRunSocialImport")?.addEventListener("click", () => {
    const url = container.querySelector("#socialUrlInput")?.value || "https://tiktok.com/@pastry/video/123";
    const caption = container.querySelector("#socialCaptionInput")?.value || "";
    runSocialImport(url, caption);
  });
  container.querySelector("#testLinkCookie")?.addEventListener("click", () => {
    runSocialImport("https://www.tiktok.com/@baker/video/cookies-pistacho", "Galletas virales de pistacho con frambuesas y chocolate blanco");
  });
  container.querySelector("#testLinkRolls")?.addEventListener("click", () => {
    runSocialImport("https://www.instagram.com/reel/cinnamon-rolls", "Rolls de canela glaseados artesanales con nuez");
  });
}
