// js/views/dashboardView.js - Stitch Screen 4: Inicio, Finanzas & Curva de Rentabilidad
import { store } from '../store.js';

export function renderDashboardView(container) {
  const settings = store.getSettings();
  const invoices = store.getInvoices();

  // Compute live financial totals from invoices
  const totalSales = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const totalOrders = invoices.length;
  const avgTicket = totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : "0.00";
  const estimatedExpenses = Math.round(totalSales * 0.631 * 100) / 100;
  const netProfit = Math.round((totalSales - estimatedExpenses) * 100) / 100;

  container.innerHTML = `
    <div class="flex flex-col w-full px-margin pb-6 gap-space-md">
      <!-- Saludo & Selector de Período -->
      <div class="flex items-center justify-between gap-space-xs mt-space-xs">
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-headline-md text-headline-md text-on-surface tracking-tight">¡Hola, Pastelera!</span>
            <span class="text-[20px] select-none">👋</span>
          </div>
          <p class="font-body-sm text-body-sm text-on-surface-variant truncate">Horneando éxitos hoy en el obrador</p>
        </div>
        <!-- Segmented Filter -->
        <div class="flex p-0.5 bg-surface-container rounded-full shadow-sm flex-shrink-0" id="period-selector">
          <button class="period-btn px-2.5 py-1 text-on-surface-variant font-label-sm text-label-sm rounded-full transition-all" data-period="hoy" type="button">Hoy</button>
          <button class="period-btn px-2.5 py-1 text-on-surface-variant font-label-sm text-label-sm rounded-full transition-all" data-period="semana" type="button">Semana</button>
          <button class="period-btn active bg-surface-container-lowest text-primary font-bold shadow-sm font-label-sm text-label-sm rounded-full transition-all" data-period="mes" type="button">Este Mes</button>
        </div>
      </div>

      <!-- Alerta Inteligente / Momento Dulce de Negocio -->
      <div class="relative overflow-hidden bg-primary-fixed/40 rounded-xl p-space-sm flex items-center justify-between gap-space-sm shadow-sm">
        <div class="flex items-center gap-space-sm min-w-0">
          <div class="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary flex-shrink-0 shadow-sm">
            <span class="material-symbols-outlined text-[24px]">cake</span>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1">
              <span class="font-label-sm text-label-sm text-primary uppercase font-bold tracking-wider">Top Rentabilidad</span>
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            </div>
            <p class="font-body-sm text-body-sm text-on-surface font-medium line-clamp-1">Cheesecake de Fresa lidera con 58% de margen</p>
          </div>
        </div>
        <button class="px-3 py-1.5 rounded-full bg-primary text-on-primary font-label-sm text-label-sm flex-shrink-0 shadow-sm hover:opacity-95 active:scale-95 transition-transform flex items-center gap-1" id="dashGoRecipesBtn" type="button">
          <span>Potenciar</span>
          <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      </div>

      <!-- Bento Grid de KPIs Clave -->
      <div class="grid grid-cols-2 gap-space-xs">
        <!-- Ganancia Neta (Hero KPI - 2 cols) -->
        <div class="col-span-2 bg-secondary-fixed/45 rounded-xl p-space-md shadow-sm flex flex-col justify-between relative overflow-hidden">
          <div class="flex items-start justify-between">
            <div>
              <span class="font-label-sm text-label-sm text-on-secondary-fixed-variant uppercase tracking-wider font-semibold">Ganancia Neta Disponible</span>
              <div class="flex items-baseline gap-2 mt-1">
                <span class="font-data-metric text-data-metric text-on-secondary-fixed tracking-tight" id="dashNetProfit">${settings.currency}${netProfit.toFixed(2)}</span>
                <div class="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-surface-container-lowest/80 text-primary font-label-sm text-label-sm shadow-xs">
                  <span class="material-symbols-outlined text-[14px]">trending_up</span>
                  <span>+18.4%</span>
                </div>
              </div>
            </div>
            <div class="w-9 h-9 rounded-xl bg-surface-container-lowest/70 flex items-center justify-center text-secondary shadow-xs">
              <span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
          </div>
          <div class="mt-space-sm pt-space-xs flex items-center justify-between font-body-sm text-body-sm text-on-secondary-fixed-variant">
            <span>Cálculo post-costeo de lotes horneados</span>
            <span class="font-medium text-primary">vs. ${settings.currency}1,200 mes ant.</span>
          </div>
        </div>

        <!-- Ventas Totales -->
        <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Ventas</span>
            <div class="w-7 h-7 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-[16px]">receipt_long</span>
            </div>
          </div>
          <div class="my-2">
            <span class="font-headline-md text-headline-md text-on-surface tracking-tight block" id="dashTotalSales">${settings.currency}${totalSales.toFixed(2)}</span>
            <span class="font-body-sm text-body-sm text-secondary font-medium">${totalOrders} facturas/tickets</span>
          </div>
          <div class="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <span class="material-symbols-outlined text-[14px] text-primary">check_circle</span>
            <span>Ticket prom: ${settings.currency}${avgTicket}</span>
          </div>
        </div>

        <!-- Gastos Operativos -->
        <div class="bg-surface-container-lowest rounded-xl p-space-sm shadow-sm flex flex-col justify-between">
          <div class="flex items-center justify-between">
            <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">Gastos</span>
            <div class="w-7 h-7 rounded-lg bg-error-container/70 flex items-center justify-center text-tertiary">
              <span class="material-symbols-outlined text-[16px]">shopping_bag</span>
            </div>
          </div>
          <div class="my-2">
            <span class="font-headline-md text-headline-md text-on-surface tracking-tight block">${settings.currency}${estimatedExpenses.toFixed(2)}</span>
            <span class="font-body-sm text-body-sm text-tertiary font-medium">Harinas, crema, cajas</span>
          </div>
          <div class="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <span class="material-symbols-outlined text-[14px] text-tertiary">tune</span>
            <span>63.1% de ventas</span>
          </div>
        </div>
      </div>

      <!-- Margen Rentabilidad Banner Resumen -->
      <div class="bg-surface-container-low rounded-xl p-space-sm flex items-center justify-between shadow-xs">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container">
            <span class="material-symbols-outlined text-[18px]">percent</span>
          </div>
          <div>
            <span class="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider block">Margen Operativo Global</span>
            <span class="font-headline-sm text-headline-sm text-on-surface font-bold">36.9% <span class="font-body-sm text-body-sm text-primary font-medium">(Saludable artesanal)</span></span>
          </div>
        </div>
        <div class="flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container-highest text-on-surface-variant font-label-sm text-label-sm">
          <span class="material-symbols-outlined text-[14px] text-primary">verified</span>
          <span>Meta: &gt;32%</span>
        </div>
      </div>

      <!-- Accesos Rápidos Táctiles (Barra de Acción) -->
      <div class="flex items-center justify-between gap-space-xs">
        <button class="flex-1 py-2.5 px-2 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg shadow-sm flex items-center justify-center gap-1.5 active:scale-98 transition-transform" id="dashNewSaleBtn" type="button">
          <span class="material-symbols-outlined text-[18px]">add_circle</span>
          <span class="truncate">Nueva Venta</span>
        </button>
        <button class="flex-1 py-2.5 px-2 bg-surface-container-high text-on-surface rounded-xl font-label-lg text-label-lg shadow-xs flex items-center justify-center gap-1.5 active:scale-98 transition-transform" id="dashAddStockBtn" type="button">
          <span class="material-symbols-outlined text-[18px] text-tertiary">post_add</span>
          <span class="truncate">Gasto Insumo</span>
        </button>
        <button aria-label="Ver Facturas" class="w-11 h-11 bg-surface-container-low text-primary rounded-xl flex items-center justify-center shadow-xs flex-shrink-0 active:scale-95 transition-transform" id="dashInvoicesListBtn" title="Ver Historial de Facturas" type="button">
          <span class="material-symbols-outlined text-[20px]">request_quote</span>
        </button>
      </div>

      <!-- Gráfica Interactiva: Rentabilidad Semanal (Ingresos vs Gastos) -->
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-headline-sm text-headline-sm text-on-surface">Curva de Rentabilidad Semanal</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Toca las barras para auditar el día</p>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-primary"></span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Ingresos</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-surface-container-highest"></span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Costos</span>
            </div>
          </div>
        </div>

        <!-- Contenedor Visual de Barras -->
        <div class="relative pt-6 pb-2">
          <!-- Tooltip dinámico contextual -->
          <div class="absolute -top-1 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-2.5 py-1 rounded-lg text-center shadow-md font-label-sm text-label-sm transition-all duration-200 pointer-events-none opacity-90" id="chart-tooltip">
            <span id="tooltip-text">Sábado: $820 Ingresos | $390 Gastos (+$430)</span>
          </div>

          <!-- Grid de Barras -->
          <div class="grid grid-cols-7 gap-1.5 h-36 items-end pt-2">
            <div class="chart-day flex flex-col items-center gap-1 group cursor-pointer" data-day="Lunes" data-exp="210" data-inc="340">
              <div class="w-full flex items-end justify-center gap-1 h-28">
                <div class="w-2.5 bg-surface-container-highest rounded-t-sm" style="height: 48%;"></div>
                <div class="w-2.5 bg-primary/70 rounded-t-sm" style="height: 60%;"></div>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant">L</span>
            </div>
            <div class="chart-day flex flex-col items-center gap-1 group cursor-pointer" data-day="Martes" data-exp="240" data-inc="410">
              <div class="w-full flex items-end justify-center gap-1 h-28">
                <div class="w-2.5 bg-surface-container-highest rounded-t-sm" style="height: 52%;"></div>
                <div class="w-2.5 bg-primary/70 rounded-t-sm" style="height: 68%;"></div>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant">M</span>
            </div>
            <div class="chart-day flex flex-col items-center gap-1 group cursor-pointer" data-day="Miércoles" data-exp="280" data-inc="390">
              <div class="w-full flex items-end justify-center gap-1 h-28">
                <div class="w-2.5 bg-surface-container-highest rounded-t-sm" style="height: 60%;"></div>
                <div class="w-2.5 bg-primary/70 rounded-t-sm" style="height: 65%;"></div>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant">X</span>
            </div>
            <div class="chart-day flex flex-col items-center gap-1 group cursor-pointer" data-day="Jueves" data-exp="310" data-inc="520">
              <div class="w-full flex items-end justify-center gap-1 h-28">
                <div class="w-2.5 bg-surface-container-highest rounded-t-sm" style="height: 64%;"></div>
                <div class="w-2.5 bg-primary/80 rounded-t-sm" style="height: 80%;"></div>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant">J</span>
            </div>
            <div class="chart-day flex flex-col items-center gap-1 group cursor-pointer" data-day="Viernes" data-exp="360" data-inc="680">
              <div class="w-full flex items-end justify-center gap-1 h-28">
                <div class="w-2.5 bg-surface-container-highest rounded-t-sm" style="height: 72%;"></div>
                <div class="w-2.5 bg-primary/90 rounded-t-sm" style="height: 92%;"></div>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant">V</span>
            </div>
            <div class="chart-day flex flex-col items-center gap-1 group cursor-pointer active-day" data-day="Sábado" data-exp="390" data-inc="820">
              <div class="w-full flex items-end justify-center gap-1 h-28 relative">
                <div class="w-2.5 bg-surface-container-highest rounded-t-sm" style="height: 78%;"></div>
                <div class="w-2.5 bg-primary rounded-t-sm shadow-xs" style="height: 100%;"></div>
              </div>
              <span class="font-label-sm text-label-sm text-primary font-bold">S</span>
            </div>
            <div class="chart-day flex flex-col items-center gap-1 group cursor-pointer" data-day="Domingo" data-exp="320" data-inc="690">
              <div class="w-full flex items-end justify-center gap-1 h-28">
                <div class="w-2.5 bg-surface-container-highest rounded-t-sm" style="height: 66%;"></div>
                <div class="w-2.5 bg-primary/80 rounded-t-sm" style="height: 94%;"></div>
              </div>
              <span class="font-label-sm text-label-sm text-on-surface-variant">D</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Desglose de Gastos en Barra Segmentada -->
      <div class="grid grid-cols-1 gap-space-xs">
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div class="flex items-center justify-between mb-space-sm">
            <div>
              <h2 class="font-headline-sm text-headline-sm text-on-surface">Distribución de Gastos</h2>
              <span class="font-body-sm text-body-sm text-on-surface-variant">Total mes estimado: ${settings.currency}${estimatedExpenses.toFixed(2)}</span>
            </div>
            <span class="material-symbols-outlined text-[20px] text-on-surface-variant">donut_large</span>
          </div>
          <!-- Segmented Visual Bar -->
          <div class="h-3.5 w-full rounded-full bg-surface-container flex overflow-hidden mb-space-sm shadow-inner">
            <div class="bg-primary h-full" style="width: 62%" title="Insumos: 62%"></div>
            <div class="bg-secondary h-full" style="width: 18%" title="Mano de obra: 18%"></div>
            <div class="bg-primary-container h-full" style="width: 12%" title="Servicios/Local: 12%"></div>
            <div class="bg-tertiary-container h-full" style="width: 8%" title="Empaques: 8%"></div>
          </div>
          <!-- Leyenda -->
          <div class="grid grid-cols-2 gap-y-2.5 gap-x-2 text-on-surface pt-1">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0"></span>
              <div class="min-w-0">
                <div class="flex items-baseline justify-between gap-1">
                  <span class="font-label-sm text-label-sm text-on-surface truncate">Insumos y Harinas</span>
                  <span class="font-label-sm text-label-sm font-bold text-on-surface">62%</span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant block">${settings.currency}1,506.29</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-secondary flex-shrink-0"></span>
              <div class="min-w-0">
                <div class="flex items-baseline justify-between gap-1">
                  <span class="font-label-sm text-label-sm text-on-surface truncate">Mano de Obra</span>
                  <span class="font-label-sm text-label-sm font-bold text-on-surface">18%</span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant block">${settings.currency}437.31</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-primary-container flex-shrink-0"></span>
              <div class="min-w-0">
                <div class="flex items-baseline justify-between gap-1">
                  <span class="font-label-sm text-label-sm text-on-surface truncate">Servicios / Hornos</span>
                  <span class="font-label-sm text-label-sm font-bold text-on-surface">12%</span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant block">${settings.currency}291.54</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-tertiary-container flex-shrink-0"></span>
              <div class="min-w-0">
                <div class="flex items-baseline justify-between gap-1">
                  <span class="font-label-sm text-label-sm text-on-surface truncate">Cajas y Empaques</span>
                  <span class="font-label-sm text-label-sm font-bold text-on-surface">8%</span>
                </div>
                <span class="font-body-sm text-body-sm text-on-surface-variant block">${settings.currency}194.36</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Margen por Especialidad -->
      <div class="bg-surface-container-low rounded-xl p-space-md flex flex-col gap-space-sm shadow-xs">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[20px] text-primary">local_florist</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface">Margen por Especialidad</h3>
          </div>
          <button class="font-label-sm text-label-sm text-primary font-bold hover:underline" id="dashViewAllRecipes">Ver Recetario</button>
        </div>
        <div class="flex flex-col gap-space-xs">
          <div class="bg-surface-container-lowest p-space-xs rounded-xl flex items-center justify-between shadow-xs">
            <div class="flex items-center gap-space-xs min-w-0">
              <img class="w-10 h-10 rounded-lg object-cover flex-shrink-0" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBg9SAdmLp8guizBKJd4Zwlr24RKxGScAotsml_LSxSZBobd6Nn90gIiHkMUj0AmiXkjqhxk5cPB5fV5BtDjLnXCLRceh0lO5JPqvxd5s86YV2263l5z7Ni_uXOxLgT7yPXakp-G4Yx1IcQH8JLuGP69Y_Oa-wvEtHMtItmgcBYAhBUq3WBQ5c0PJfud9AWVdz-JY-4c3mfHyRIEX8PsId95EUA8IVraZQ5HG6Gfg" />
              <div class="min-w-0">
                <h4 class="font-label-lg text-label-lg text-on-surface truncate">Cheesecake de Fresa</h4>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Costo $11.20 | Venta $28.00</span>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="font-label-lg text-label-lg text-primary font-bold block">+58%</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Margen</span>
            </div>
          </div>
          <div class="bg-surface-container-lowest p-space-xs rounded-xl flex items-center justify-between shadow-xs">
            <div class="flex items-center gap-space-xs min-w-0">
              <img class="w-10 h-10 rounded-lg object-cover flex-shrink-0" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC5SaRNBTOP1mUc2qrzbxq670soQBiefsSyD-hsk34UiMk_o9gm0yu64W2BXRPc7W6WVq5eSE9QcsuSZF7Wbh4V04Q63ZXtvPXVI5unVMw2-r4T1ZpsPwUL0btcC_DuJBdoyHV31YJ0Ut-j_CQO7yl3lNPiHci9_c-TDKX6SEtotyL633bQ6-XxYmlixxg0irbegGW5C-TZn5PHU3gafOMrgneEhO5d0fLFTdzNGw" />
              <div class="min-w-0">
                <h4 class="font-label-lg text-label-lg text-on-surface truncate">Croissant de Mantequilla</h4>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Costo $1.45 | Venta $3.80</span>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="font-label-lg text-label-lg text-primary font-bold block">+52%</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Margen</span>
            </div>
          </div>
          <div class="bg-surface-container-lowest p-space-xs rounded-xl flex items-center justify-between shadow-xs">
            <div class="flex items-center gap-space-xs min-w-0">
              <img class="w-10 h-10 rounded-lg object-cover flex-shrink-0" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUGUg7P1C8LywkVtJqLkY4D53zo4tyqUmnYtj_JEKHBXSQekjkhTphOh6O5krRL-kggUEmVtQpV5VAcJo-uhyGaHVaSkGFQmO88hOeySu-Lh67MNxdFHCT75hrbeY62OdASz7Ur-oMQGjNBfLa_BdtDuLJX48i78-dVjXW6Ou3GZ538o51lALo-LkBQ3e_oHxldp3tfiQgF8qu4XHz9NXMmvxLHqgoZcwI36eenA" />
              <div class="min-w-0">
                <h4 class="font-label-lg text-label-lg text-on-surface truncate">Selva Negra Especial 20cm</h4>
                <span class="font-body-sm text-body-sm text-on-surface-variant">Costo $13.90 | Venta $34.75</span>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <span class="font-label-lg text-label-lg text-primary font-bold block">+60%</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant">Margen</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Attach event handlers
  setupDashboardInteractions(container);
}

function setupDashboardInteractions(container) {
  // Period filter buttons
  const periodBtns = container.querySelectorAll(".period-btn");
  periodBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      periodBtns.forEach(b => {
        b.classList.remove("active", "bg-surface-container-lowest", "text-primary", "font-bold", "shadow-sm");
        b.classList.add("text-on-surface-variant");
      });
      btn.classList.add("active", "bg-surface-container-lowest", "text-primary", "font-bold", "shadow-sm");
      btn.classList.remove("text-on-surface-variant");
    });
  });

  // Chart interactivity
  const days = container.querySelectorAll(".chart-day");
  const tooltip = container.querySelector("#chart-tooltip");
  const tooltipText = container.querySelector("#tooltip-text");

  days.forEach(day => {
    day.addEventListener("click", () => {
      days.forEach(d => {
        const textSpan = d.querySelector("span:last-child");
        if (textSpan) {
          textSpan.classList.remove("text-primary", "font-bold");
          textSpan.classList.add("text-on-surface-variant");
        }
      });
      const activeSpan = day.querySelector("span:last-child");
      if (activeSpan) {
        activeSpan.classList.remove("text-on-surface-variant");
        activeSpan.classList.add("text-primary", "font-bold");
      }

      const dayName = day.getAttribute("data-day");
      const inc = day.getAttribute("data-inc");
      const exp = day.getAttribute("data-exp");
      const diff = (parseFloat(inc) - parseFloat(exp)).toFixed(0);

      if (tooltipText && tooltip) {
        tooltipText.innerText = `${dayName}: $${inc} Ingresos | $${exp} Gastos (+$${diff})`;
        tooltip.classList.add("scale-105");
        setTimeout(() => tooltip.classList.remove("scale-105"), 200);
      }
    });
  });

  // Navigation shortcuts
  container.querySelector("#dashNewSaleBtn")?.addEventListener("click", () => {
    window.location.hash = "#pos";
  });
  container.querySelector("#dashAddStockBtn")?.addEventListener("click", () => {
    window.location.hash = "#inventario";
  });
  container.querySelector("#dashInvoicesListBtn")?.addEventListener("click", () => {
    window.location.hash = "#pos-invoices";
  });
  container.querySelector("#dashGoRecipesBtn")?.addEventListener("click", () => {
    window.location.hash = "#recetario";
  });
  container.querySelector("#dashViewAllRecipes")?.addEventListener("click", () => {
    window.location.hash = "#recetario";
  });
}
