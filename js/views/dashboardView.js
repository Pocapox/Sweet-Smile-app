// js/views/dashboardView.js - Stitch Screen 4: Inicio, Finanzas & Curva de Rentabilidad
import { store } from '../store.js';
import { uiToast, uiModal } from '../ui-feedback.js';

/**
 * Aggregates daily sales, expenses, and net profits over a rolling 7-day window.
 * Derives true accounting figures from store.getInvoices() and store.getExpenses().
 */
export function calculateWeeklyChartData(storeInstance = store) {
  const invoices = typeof storeInstance.getInvoices === 'function' ? storeInstance.getInvoices() : (storeInstance.state?.invoices || []);
  const expenses = typeof storeInstance.getExpenses === 'function' ? storeInstance.getExpenses() : (storeInstance.state?.expenses || []);

  const now = new Date();
  let anchor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const salesByDate = {};
  let maxDateStr = "";
  for (let i = 0; i < invoices.length; i++) {
    const inv = invoices[i];
    if (inv && inv.date) {
      const dStr = String(inv.date).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        salesByDate[dStr] = (salesByDate[dStr] || 0) + (parseFloat(inv.total) || 0);
        if (dStr > maxDateStr) maxDateStr = dStr;
      }
    }
  }

  const expensesByDate = {};
  for (let i = 0; i < expenses.length; i++) {
    const exp = expenses[i];
    if (exp && exp.date) {
      const dStr = String(exp.date).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
        expensesByDate[dStr] = (expensesByDate[dStr] || 0) + (parseFloat(exp.amount) || 0);
        if (dStr > maxDateStr) maxDateStr = dStr;
      }
    }
  }

  if (maxDateStr) {
    const parts = maxDateStr.split("-").map(Number);
    if (parts.length === 3) {
      const maxDate = new Date(parts[0], parts[1] - 1, parts[2]);
      if (maxDate > anchor) {
        anchor = maxDate;
      }
    }
  }

  const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const dayShorts = ["D", "L", "M", "X", "J", "V", "S"];

  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const dayNum = String(d.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${dayNum}`;
    const dayIndex = d.getDay();

    const daySales = Math.round((salesByDate[dateStr] || 0) * 100) / 100;
    const dayExpenses = Math.round((expensesByDate[dateStr] || 0) * 100) / 100;
    const netProfit = Math.round((daySales - dayExpenses) * 100) / 100;
    const margin = daySales > 0 ? Math.round((netProfit / daySales) * 1000) / 10 : 0.0;

    days.push({
      dateStr,
      dateShort: `${dayNum}/${month}`,
      dayIndex,
      dayName: dayNames[dayIndex],
      dayShort: dayShorts[dayIndex],
      sales: daySales,
      expenses: dayExpenses,
      netProfit,
      margin,
      isToday: i === 0
    });
  }

  const maxVal = Math.max(
    ...days.map(d => Math.max(d.sales, d.expenses, Math.max(0, d.netProfit))),
    50
  );

  return { days, maxVal };
}

const CATEGORIES_CONFIG = [
  { key: "Insumos", label: "Insumos y Harinas", color: "bg-primary", barClass: "bg-primary" },
  { key: "Servicios", label: "Servicios / Hornos", color: "bg-primary-container", barClass: "bg-primary-container" },
  { key: "Empaques", label: "Cajas y Empaques", color: "bg-tertiary-container", barClass: "bg-tertiary-container" },
  { key: "Mano de Obra", label: "Mano de Obra", color: "bg-secondary", barClass: "bg-secondary" },
  { key: "Mantenimiento", label: "Mantenimiento", color: "bg-amber-600", barClass: "bg-amber-600" },
  { key: "Otros", label: "Otros Gastos", color: "bg-outline", barClass: "bg-outline" }
];

const KNOWN_CATEGORY_KEYS = new Set(CATEGORIES_CONFIG.map(c => c.key));

const CATEGORY_BADGES = {
  "Insumos": "bg-primary/10 text-primary border-primary/20",
  "Servicios": "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  "Empaques": "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  "Mano de Obra": "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  "Mantenimiento": "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  "Otros": "bg-surface-container text-on-surface-variant border-outline-variant/30"
};

export function renderDashboardView(container) {
  const settings = store.getSettings();
  const fin = store.getFinancialSummary();

  const totalSales = fin.totalSales;
  const totalOrders = fin.totalOrders;
  const avgTicket = fin.avgTicket;
  const totalExpenses = fin.totalExpenses;
  const totalCogs = fin.totalCogs;
  const grossProfit = fin.grossProfit;
  const grossMargin = fin.grossMargin;
  const netProfit = fin.netProfit;
  const netMargin = fin.netMargin;

  const currency = settings.currency || "$";
  const formatMoney = (val) => {
    const num = typeof val === "number" ? val : (parseFloat(val) || 0);
    if (num < 0) {
      return `-${currency}${Math.abs(num).toFixed(2)}`;
    }
    return `${currency}${num.toFixed(2)}`;
  };

  const salesFormatted = formatMoney(totalSales);
  const expensesFormatted = formatMoney(totalExpenses);
  const cogsFormatted = formatMoney(totalCogs);
  const grossProfitFormatted = formatMoney(grossProfit);
  const netProfitFormatted = formatMoney(netProfit);
  const todayDate = new Date().toISOString().slice(0, 10);

  // Retrieve current expenses list
  const expensesList = store.getExpenses ? store.getExpenses() : (store.state.expenses || []);

  let extraOtros = 0;
  if (fin.expensesByCategory) {
    Object.keys(fin.expensesByCategory).forEach(cat => {
      if (!KNOWN_CATEGORY_KEYS.has(cat)) {
        extraOtros += (fin.expensesByCategory[cat] || 0);
      }
    });
  }

  const breakdown = CATEGORIES_CONFIG.map(cfg => {
    let amt = fin.expensesByCategory ? (fin.expensesByCategory[cfg.key] || 0) : 0;
    if (cfg.key === "Otros") {
      amt += extraOtros;
    }
    const pct = totalExpenses > 0 ? Math.round((amt / totalExpenses) * 100) : 0;
    return { ...cfg, amount: amt, percent: pct };
  });

  const categoryBadges = CATEGORY_BADGES;

  // Status badges & meter scale for Gross Margin and Net Margin
  let grossBadgeText = "Saludable";
  let grossBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300";
  let grossBadgeIcon = "check_circle";
  if (grossMargin < 30) {
    grossBadgeText = "Alerta";
    grossBadgeClass = "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300";
    grossBadgeIcon = "warning";
  } else if (grossMargin < 50) {
    grossBadgeText = "Ajustado";
    grossBadgeClass = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300";
    grossBadgeIcon = "info";
  }

  let netBadgeText = "Saludable";
  let netBadgeClass = "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-300";
  let netBadgeIcon = "check_circle";
  if (netMargin < 15) {
    netBadgeText = "Alerta";
    netBadgeClass = "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/40 dark:text-rose-300";
    netBadgeIcon = "warning";
  } else if (netMargin < 30) {
    netBadgeText = "Ajustado";
    netBadgeClass = "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300";
    netBadgeIcon = "info";
  }

  const grossMeterWidth = Math.max(0, Math.min(100, Math.round(grossMargin)));
  const netMeterWidth = Math.max(0, Math.min(100, Math.round(netMargin)));

  // Calculate 7-Day Trend Chart SVG elements
  const chartData = calculateWeeklyChartData(store);
  const { days, maxVal } = chartData;
  const lastDay = days[days.length - 1] || { dayName: "Hoy", sales: 0, expenses: 0, netProfit: 0, margin: 0, dateStr: todayDate };
  const initialTooltipText = `${lastDay.dayName}: $${lastDay.sales.toFixed(2)} Ventas | $${lastDay.expenses.toFixed(2)} Gastos (${lastDay.netProfit >= 0 ? '+' : ''}$${lastDay.netProfit.toFixed(2)})`;

  const svgBars = days.map((d, i) => {
    const colWidth = 60;
    const centerX = i * colWidth + 30;
    const barW = 10;
    const xSales = centerX - 16;
    const xExp = centerX - 5;
    const xProf = centerX + 6;

    const hSales = maxVal > 0 ? Math.max(d.sales > 0 ? 4 : 0, Math.round((d.sales / maxVal) * 105)) : 0;
    const ySales = 125 - hSales;

    const hExp = maxVal > 0 ? Math.max(d.expenses > 0 ? 4 : 0, Math.round((d.expenses / maxVal) * 105)) : 0;
    const yExp = 125 - hExp;

    const isProfPos = d.netProfit >= 0;
    const hProf = maxVal > 0 ? Math.max(Math.abs(d.netProfit) > 0 ? 4 : 0, Math.round((Math.abs(d.netProfit) / maxVal) * 105)) : 0;
    const yProf = isProfPos ? (125 - hProf) : 125;
    const fillProf = isProfPos ? "#8b5cf6" : "#ef4444";

    return `
      <g class="chart-day cursor-pointer group" tabindex="0" role="button" aria-label="${d.dayName} ${d.dateStr}: Ventas $${d.sales.toFixed(2)}, Gastos $${d.expenses.toFixed(2)}, Beneficio $${d.netProfit.toFixed(2)}" data-day="${d.dayName}" data-date="${d.dateStr}" data-inc="${d.sales.toFixed(2)}" data-exp="${d.expenses.toFixed(2)}" data-profit="${d.netProfit.toFixed(2)}" data-margin="${d.margin.toFixed(1)}">
        <rect class="bar-sales" x="${xSales}" y="${ySales}" width="${barW}" height="${hSales}" fill="#10b981" rx="2"/>
        <rect class="bar-expenses" x="${xExp}" y="${yExp}" width="${barW}" height="${hExp}" fill="#f43f5e" rx="2"/>
        <rect class="bar-profit" x="${xProf}" y="${yProf}" width="${barW}" height="${isProfPos ? hProf : Math.min(hProf, 15)}" fill="${fillProf}" rx="2"/>
        <text x="${centerX}" y="145" text-anchor="middle" font-size="11" font-weight="bold" fill="currentColor" class="fill-on-surface-variant chart-day-label">${d.dayShort}</text>
        <span class="hidden chart-day-span">${d.dayShort}</span>
      </g>
    `;
  }).join("");

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
                <span class="font-data-metric text-data-metric text-on-secondary-fixed tracking-tight" id="dashNetProfit">${netProfitFormatted}</span>
                <div class="flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-surface-container-lowest/80 text-primary font-label-sm text-label-sm shadow-xs" id="dashNetMarginBadge">
                  <span class="material-symbols-outlined text-[14px]">${netMargin >= 0 ? "trending_up" : "trending_down"}</span>
                  <span id="dashNetMargin">${netMargin >= 0 ? "+" : ""}${netMargin.toFixed(1)}%</span>
                </div>
              </div>
            </div>
            <div class="w-9 h-9 rounded-xl bg-surface-container-lowest/70 flex items-center justify-center text-secondary shadow-xs">
              <span class="material-symbols-outlined text-[20px]">account_balance_wallet</span>
            </div>
          </div>
          <div class="mt-space-sm pt-space-xs flex items-center justify-between font-body-sm text-body-sm text-on-secondary-fixed-variant">
            <span>Cálculo contable real (Ventas - Costos - Gastos)</span>
            <span class="font-medium text-primary">Margen Neto: ${netMargin.toFixed(1)}%</span>
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
            <span class="font-headline-md text-headline-md text-on-surface tracking-tight block" id="dashTotalSales">${salesFormatted}</span>
            <span class="font-body-sm text-body-sm text-secondary font-medium">${totalOrders} facturas/tickets</span>
          </div>
          <div class="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <span class="material-symbols-outlined text-[14px] text-primary">check_circle</span>
            <span>Ticket prom: ${formatMoney(avgTicket)}</span>
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
            <span class="font-headline-md text-headline-md text-on-surface tracking-tight block" id="dashTotalExpenses">${expensesFormatted}</span>
            <span class="font-body-sm text-body-sm text-tertiary font-medium">${fin.expenseCount} registrados</span>
          </div>
          <div class="flex items-center gap-1 font-label-sm text-label-sm text-on-surface-variant">
            <span class="material-symbols-outlined text-[14px] text-tertiary">tune</span>
            <span id="dashCogs">COGS: ${cogsFormatted}</span>
          </div>
        </div>
      </div>

      <!-- Medidor Comparativo de Márgenes (Margen Bruto vs Margen Neto) -->
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm" id="marginsComparisonCard">
        <div class="flex items-center justify-between border-b border-surface-variant/30 pb-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">speed</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface font-bold">Medidor de Rentabilidad & Márgenes</h3>
          </div>
          <span class="text-xs text-on-surface-variant font-medium">Margen Bruto vs Margen Neto</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-1">
          <!-- Margen Bruto -->
          <div class="bg-surface-container-low rounded-xl p-space-sm flex flex-col gap-2 border border-outline-variant/30">
            <div class="flex items-start justify-between">
              <div>
                <span class="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">Margen Bruto</span>
                <div class="font-headline-md text-on-surface font-extrabold flex items-baseline gap-1">
                  <span id="dashGrossMargin">${grossMargin.toFixed(1)}%</span>
                  <span class="text-xs text-primary font-medium">(${grossProfitFormatted})</span>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold border ${grossBadgeClass}" id="dashGrossMarginBadge">${grossBadgeText}</span>
            </div>
            <div class="h-2.5 w-full bg-surface-container rounded-full overflow-hidden shadow-inner">
              <div class="h-full bg-primary rounded-full transition-all duration-300" style="width: ${grossMeterWidth}%" id="dashGrossMeterBar"></div>
            </div>
            <div class="flex justify-between text-[10px] text-on-surface-variant">
              <span>Meta: &gt;50%</span>
              <span>Ventas - Insumos</span>
            </div>
          </div>

          <!-- Margen Neto -->
          <div class="bg-surface-container-low rounded-xl p-space-sm flex flex-col gap-2 border border-outline-variant/30">
            <div class="flex items-start justify-between">
              <div>
                <span class="font-label-sm text-label-sm text-on-surface-variant uppercase font-medium">Margen Neto</span>
                <div class="font-headline-md text-on-surface font-extrabold flex items-baseline gap-1">
                  <span id="dashNetMarginCompare">${netMargin >= 0 ? "+" : ""}${netMargin.toFixed(1)}%</span>
                  <span class="text-xs ${netProfit >= 0 ? 'text-primary' : 'text-tertiary'} font-medium">(${netProfitFormatted})</span>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-full text-[11px] font-bold border ${netBadgeClass}" id="dashNetMarginCompareBadge">${netBadgeText}</span>
            </div>
            <div class="h-2.5 w-full bg-surface-container rounded-full overflow-hidden shadow-inner">
              <div class="h-full ${netMargin >= 0 ? 'bg-secondary' : 'bg-tertiary'} rounded-full transition-all duration-300" style="width: ${netMeterWidth}%" id="dashNetMeterBar"></div>
            </div>
            <div class="flex justify-between text-[10px] text-on-surface-variant">
              <span>Meta: &gt;30%</span>
              <span>Ventas - Costos - Gastos</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Accesos Rápidos Táctiles (Barra de Acción) -->
      <div class="flex items-center justify-between gap-space-xs">
        <button class="flex-1 py-2.5 px-2 bg-primary text-on-primary rounded-xl font-label-lg text-label-lg shadow-sm flex items-center justify-center gap-1.5 active:scale-98 transition-transform" id="dashNewSaleBtn" type="button">
          <span class="material-symbols-outlined text-[18px]">add_circle</span>
          <span class="truncate">Nueva Venta</span>
        </button>
        <button class="flex-1 py-2.5 px-2 bg-primary-fixed text-on-primary-fixed font-bold rounded-xl font-label-lg text-label-lg shadow-sm flex items-center justify-center gap-1.5 active:scale-98 transition-transform hover:opacity-95" id="btnOpenExpenseModal" type="button">
          <span class="material-symbols-outlined text-[18px] text-primary">add_card</span>
          <span class="truncate">+ Registrar Gasto</span>
        </button>
        <button class="hidden" id="dashAddStockBtn" type="button"></button>
        <button aria-label="Ver Facturas" class="w-11 h-11 bg-surface-container-low text-primary rounded-xl flex items-center justify-center shadow-xs flex-shrink-0 active:scale-95 transition-transform" id="dashInvoicesListBtn" title="Ver Historial de Facturas" type="button">
          <span class="material-symbols-outlined text-[20px]">request_quote</span>
        </button>
      </div>

      <!-- Cascada Contable / Estado de Resultados -->
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-xs">
        <div class="flex items-center justify-between border-b border-surface-variant/40 pb-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[20px]">analytics</span>
            <h3 class="font-headline-sm text-headline-sm text-on-surface font-bold">Estado de Resultados</h3>
          </div>
          <span class="text-xs text-on-surface-variant font-medium">Contabilidad Operativa Real</span>
        </div>
        <div class="flex flex-col gap-1.5 text-xs pt-1">
          <div class="flex justify-between py-1 border-b border-surface-variant/20">
            <span class="text-on-surface font-medium">(+) Ventas Totales</span>
            <span class="font-bold text-on-surface">${salesFormatted}</span>
          </div>
          <div class="flex justify-between py-1 border-b border-surface-variant/20">
            <span class="text-on-surface-variant font-medium">(-) Costo Mercancía Vendida (COGS)</span>
            <span class="font-medium text-tertiary">-${cogsFormatted}</span>
          </div>
          <div class="flex justify-between py-1 bg-surface-container-low px-2 rounded-lg font-bold">
            <span class="text-primary">(=) Ganancia Bruta</span>
            <span class="text-primary">${grossProfitFormatted} (${grossMargin.toFixed(1)}%)</span>
          </div>
          <div class="flex justify-between py-1 border-b border-surface-variant/20">
            <span class="text-on-surface-variant font-medium">(-) Gastos Operativos Totales</span>
            <span class="font-medium text-tertiary">-${expensesFormatted}</span>
          </div>
          <div class="flex justify-between py-1.5 bg-secondary-fixed/40 px-2 rounded-lg font-extrabold text-sm">
            <span class="text-on-secondary-fixed">(=) Ganancia Neta</span>
            <span class="${netProfit >= 0 ? 'text-primary' : 'text-tertiary'}">${netProfitFormatted} (${netMargin >= 0 ? '+' : ''}${netMargin.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      <!-- Gráfica Interactiva: Rentabilidad Semanal (Ventas vs Gastos vs Beneficio) -->
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm" id="weeklyTrendCard">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">Curva de Rentabilidad Semanal</h2>
            <p class="font-body-sm text-body-sm text-on-surface-variant">Toca o pasa el cursor sobre las barras para auditar el día</p>
          </div>
          <div class="flex items-center gap-3 text-xs">
            <div class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Ventas</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Gastos</span>
            </div>
            <div class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-primary"></span>
              <span class="font-label-sm text-label-sm text-on-surface-variant font-medium">Beneficio</span>
            </div>
          </div>
        </div>

        <!-- Contenedor Visual SVG -->
        <div class="relative pt-6 pb-2 select-none" id="chart-container">
          <!-- Tooltip dinámico contextual -->
          <div class="absolute -top-1 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface px-3 py-1.5 rounded-lg text-center shadow-lg font-label-sm text-label-sm transition-all duration-200 pointer-events-none z-10 opacity-95" id="chart-tooltip">
            <span id="tooltip-text">${initialTooltipText}</span>
          </div>

          <!-- Responsive SVG Grouped Bar Chart -->
          <div class="w-full overflow-x-auto no-scrollbar">
            <svg id="trendChartSvg" class="w-full h-44 overflow-visible min-w-[340px]" viewBox="0 0 420 160" preserveAspectRatio="none" role="img" aria-label="Gráfica de tendencia semanal de ventas, gastos y beneficio">
              <!-- Background grid & reference lines -->
              <line x1="15" y1="20" x2="405" y2="20" stroke="currentColor" stroke-dasharray="3,3" class="stroke-outline-variant/30" stroke-width="1"/>
              <text x="12" y="23" text-anchor="end" font-size="8" fill="currentColor" class="fill-on-surface-variant/70">$${Math.round(maxVal)}</text>

              <line x1="15" y1="72" x2="405" y2="72" stroke="currentColor" stroke-dasharray="3,3" class="stroke-outline-variant/20" stroke-width="1"/>
              <text x="12" y="75" text-anchor="end" font-size="8" fill="currentColor" class="fill-on-surface-variant/70">$${Math.round(maxVal * 0.5)}</text>

              <line x1="15" y1="125" x2="405" y2="125" stroke="currentColor" class="stroke-outline-variant/50" stroke-width="1.5"/>
              <text x="12" y="128" text-anchor="end" font-size="8" fill="currentColor" class="fill-on-surface-variant/70">$0</text>

              <!-- 7 Daily grouped bar columns -->
              ${svgBars}
            </svg>
          </div>

          <!-- Resumen de auditoría interactiva del día activo -->
          <div class="mt-2 pt-2 border-t border-surface-variant/30 flex flex-wrap items-center justify-between gap-1 text-xs text-on-surface-variant" id="chartAuditSummary">
            <div class="flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px] text-primary">analytics</span>
              <span id="chartActiveDayDetail">Día: ${lastDay.dayName} (${lastDay.dateStr})</span>
            </div>
            <div class="flex items-center gap-2 font-mono text-[11px]">
              <span class="text-emerald-700 dark:text-emerald-400 font-bold" id="auditDaySales">Ventas: $${lastDay.sales.toFixed(2)}</span>
              <span class="text-rose-700 dark:text-rose-400 font-bold" id="auditDayExpenses">Gastos: -$${lastDay.expenses.toFixed(2)}</span>
              <span class="${lastDay.netProfit >= 0 ? 'text-primary' : 'text-tertiary'} font-bold" id="auditDayProfit">Neto: ${lastDay.netProfit >= 0 ? '+' : ''}$${lastDay.netProfit.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Desglose Dinámico de Gastos por Categoría -->
      <div class="grid grid-cols-1 gap-space-xs">
        <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm">
          <div class="flex items-center justify-between mb-space-sm">
            <div>
              <h2 class="font-headline-sm text-headline-sm text-on-surface">Distribución de Gastos</h2>
              <span class="font-body-sm text-body-sm text-on-surface-variant">Total registrado: ${expensesFormatted}</span>
            </div>
            <span class="material-symbols-outlined text-[20px] text-on-surface-variant">donut_large</span>
          </div>

          <!-- Segmented Visual Bar -->
          <div class="h-3.5 w-full rounded-full bg-surface-container flex overflow-hidden mb-space-sm shadow-inner" id="expenseSegmentedBar">
            ${
              totalExpenses > 0
                ? breakdown.filter(b => b.percent > 0).map(b => `<span class="inline-block ${b.barClass} h-full transition-all duration-300" style="width: ${b.percent}%" title="${b.label}: ${b.percent}% (${formatMoney(b.amount)})" data-category="${b.key}"></span>`).join("")
                : `<span class="bg-surface-container-highest w-full h-full text-center text-[10px] text-on-surface-variant flex items-center justify-center font-medium" title="Sin gastos registrados">Sin gastos registrados</span>`
            }
          </div>

          <!-- Leyenda de Categorías -->
          <div class="grid grid-cols-2 gap-y-2.5 gap-x-2 text-on-surface pt-1">
            ${
              breakdown.map(b => `
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full ${b.color} flex-shrink-0"></span>
                  <div class="min-w-0">
                    <div class="flex items-baseline justify-between gap-1">
                      <span class="font-label-sm text-label-sm text-on-surface truncate">${b.label}</span>
                      <span class="font-label-sm text-label-sm font-bold text-on-surface">${b.percent}%</span>
                    </div>
                    <span class="font-body-sm text-body-sm text-on-surface-variant block">${formatMoney(b.amount)}</span>
                  </div>
                </div>
              `).join("")
            }
          </div>
        </div>
      </div>

      <!-- Libro de Gastos / Expense Ledger Table -->
      <div class="bg-surface-container-lowest rounded-xl p-space-md shadow-sm flex flex-col gap-space-sm">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-surface-variant/40 pb-2">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-tertiary text-[20px]">payments</span>
            <div>
              <h2 class="font-headline-sm text-headline-sm text-on-surface font-bold">Libro de Gastos</h2>
              <p class="font-body-sm text-body-sm text-on-surface-variant">Auditoría y registro detallado de egresos</p>
            </div>
          </div>
          <!-- Filtro de Categoría -->
          <div class="flex items-center gap-1.5 self-start sm:self-auto">
            <label for="expenseCategoryFilter" class="text-xs text-on-surface-variant font-medium">Filtrar:</label>
            <select id="expenseCategoryFilter" class="bg-surface-container px-2.5 py-1 rounded-lg text-xs font-semibold text-on-surface border border-outline-variant/30 focus:outline-none focus:ring-1 focus:ring-primary">
              <option value="all">Todas las Categorías</option>
              <option value="Insumos">Insumos</option>
              <option value="Servicios">Servicios</option>
              <option value="Empaques">Empaques</option>
              <option value="Mano de Obra">Mano de Obra</option>
              <option value="Mantenimiento">Mantenimiento</option>
              <option value="Otros">Otros</option>
            </select>
          </div>
        </div>

        <!-- Tabla de Gastos -->
        <div class="overflow-x-auto w-full">
          <table class="w-full text-left text-xs" id="expenseLedgerTable">
            <thead>
              <tr class="border-b border-surface-variant/50 text-on-surface-variant font-semibold">
                <th class="py-2 px-2">Fecha</th>
                <th class="py-2 px-2">Categoría</th>
                <th class="py-2 px-2">Concepto</th>
                <th class="py-2 px-2 text-right">Monto</th>
                <th class="py-2 px-2 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody id="expenseLedgerBody">
              ${
                expensesList.length === 0
                  ? `<tr><td colspan="5" class="py-4 text-center text-on-surface-variant font-medium">No hay gastos registrados</td></tr>`
                  : expensesList.map(exp => {
                      const badgeClass = categoryBadges[exp.category] || categoryBadges["Otros"];
                      return `
                        <tr class="border-b border-surface-variant/20 hover:bg-surface-container/30 transition-colors expense-row" data-category="${exp.category || 'Otros'}">
                          <td class="py-2.5 px-2 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">${exp.date || "-"}</td>
                          <td class="py-2.5 px-2 whitespace-nowrap">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}">${exp.category || "Otros"}</span>
                          </td>
                          <td class="py-2.5 px-2">
                            <div class="font-medium text-on-surface leading-tight">${exp.concept || "-"}</div>
                            ${exp.receipt ? `<span class="text-[10px] text-on-surface-variant">Comprobante: ${exp.receipt}</span>` : ""}
                          </td>
                          <td class="py-2.5 px-2 text-right font-bold text-tertiary whitespace-nowrap">
                            -${formatMoney(exp.amount)}
                          </td>
                          <td class="py-2.5 px-2 text-center whitespace-nowrap">
                            <button class="btn-delete-expense w-7 h-7 rounded-lg text-tertiary hover:bg-error-container/60 inline-flex items-center justify-center transition-colors" data-id="${exp.id}" title="Eliminar gasto" aria-label="Eliminar gasto ${exp.concept}">
                              <span class="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join("")
              }
            </tbody>
          </table>
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

    <!-- Modal para Registrar Gasto (#expenseModal) -->
    <div id="expenseModal" class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-surface-container-lowest w-full max-w-lg rounded-3xl p-5 sm:p-6 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between border-b border-surface-variant/40 pb-3">
          <div class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-xl bg-error-container/60 flex items-center justify-center text-tertiary">
              <span class="material-symbols-outlined text-[20px]">add_card</span>
            </div>
            <div>
              <h3 class="font-headline-sm font-bold text-on-surface">Registrar Nuevo Gasto</h3>
              <p class="text-xs text-on-surface-variant">Ingresa los datos para la contabilidad del negocio</p>
            </div>
          </div>
          <button id="closeExpenseModalBtn" class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors" type="button" aria-label="Cerrar modal">
            <span class="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form id="expenseForm" class="flex flex-col gap-3.5" novalidate>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Monto -->
            <div>
              <label for="expenseAmount" class="block text-xs font-bold text-on-surface mb-1">Monto ($) <span class="text-tertiary">*</span></label>
              <input type="number" step="0.01" min="0.01" id="expenseAmount" name="amount" required placeholder="0.00" class="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40 text-on-surface font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            <!-- Categoría -->
            <div>
              <label for="expenseCategory" class="block text-xs font-bold text-on-surface mb-1">Categoría <span class="text-tertiary">*</span></label>
              <select id="expenseCategory" name="category" required class="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40 text-on-surface font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="Insumos">Insumos (Harinas, lácteos, etc.)</option>
                <option value="Servicios">Servicios (Gas hornos, luz, agua)</option>
                <option value="Empaques">Empaques (Cajas, bases, bolsas)</option>
                <option value="Mano de Obra">Mano de Obra (Sueldos, horas)</option>
                <option value="Mantenimiento">Mantenimiento (Equipos, batidoras)</option>
                <option value="Otros">Otros gastos operativos</option>
              </select>
            </div>
          </div>

          <!-- Concepto -->
          <div>
            <label for="expenseConcept" class="block text-xs font-bold text-on-surface mb-1">Concepto o Descripción <span class="text-tertiary">*</span></label>
            <input type="text" id="expenseConcept" name="concept" required placeholder="Ej. Compra de harina de fuerza y mantequilla" class="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Fecha -->
            <div>
              <label for="expenseDate" class="block text-xs font-bold text-on-surface mb-1">Fecha <span class="text-tertiary">*</span></label>
              <input type="date" id="expenseDate" name="date" required value="${todayDate}" class="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            <!-- Método de Pago -->
            <div>
              <label for="expensePaymentMethod" class="block text-xs font-bold text-on-surface mb-1">Método de Pago</label>
              <select id="expensePaymentMethod" name="paymentMethod" class="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                <option value="Efectivo">Efectivo</option>
                <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                <option value="Tarjeta de Débito">Tarjeta de Débito</option>
                <option value="Tarjeta de Crédito">Tarjeta de Crédito</option>
                <option value="WhatsApp / Zelle">WhatsApp / Zelle</option>
                <option value="Otros">Otros</option>
              </select>
            </div>
          </div>

          <!-- Comprobante / Recibo -->
          <div>
            <label for="expenseReceipt" class="block text-xs font-bold text-on-surface mb-1">Nº Comprobante / Recibo <span class="text-on-surface-variant font-normal">(Opcional)</span></label>
            <input type="text" id="expenseReceipt" name="receipt" placeholder="Ej. FAC-PROV-901 o TK-442" class="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          <!-- Notas -->
          <div>
            <label for="expenseNotes" class="block text-xs font-bold text-on-surface mb-1">Notas Adicionales <span class="text-on-surface-variant font-normal">(Opcional)</span></label>
            <textarea id="expenseNotes" name="notes" rows="2" placeholder="Detalles del proveedor, condiciones..." class="w-full px-3 py-2 bg-surface-container-low rounded-xl border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary"></textarea>
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-variant/40 mt-1">
            <button type="button" id="cancelExpenseBtn" class="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-bold hover:bg-surface-container-high transition-colors">Cancelar</button>
            <button type="submit" id="btnSaveExpense" class="px-5 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:opacity-95 transition-transform active:scale-98 flex items-center gap-1.5">
              <span class="material-symbols-outlined text-[16px]">check</span>
              <span>Guardar Gasto</span>
            </button>
          </div>
        </form>
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

  // Chart interactivity & day selection
  const days = container.querySelectorAll(".chart-day");
  const tooltip = container.querySelector("#chart-tooltip");
  const tooltipText = container.querySelector("#tooltip-text");
  const auditDetail = container.querySelector("#chartActiveDayDetail");
  const auditSales = container.querySelector("#auditDaySales");
  const auditExpenses = container.querySelector("#auditDayExpenses");
  const auditProfit = container.querySelector("#auditDayProfit");

  function selectDay(day) {
    days.forEach(d => {
      d.classList.remove("active-day");
      const textSpan = d.querySelector("span:last-child");
      if (textSpan) {
        textSpan.classList.remove("text-primary", "font-bold");
        textSpan.classList.add("text-on-surface-variant");
      }
      const labelText = d.querySelector(".chart-day-label");
      if (labelText) {
        labelText.classList.remove("fill-primary");
        labelText.classList.add("fill-on-surface-variant");
      }
    });

    day.classList.add("active-day");
    const activeSpan = day.querySelector("span:last-child");
    if (activeSpan) {
      activeSpan.classList.remove("text-on-surface-variant");
      activeSpan.classList.add("text-primary", "font-bold");
    }
    const activeLabel = day.querySelector(".chart-day-label");
    if (activeLabel) {
      activeLabel.classList.remove("fill-on-surface-variant");
      activeLabel.classList.add("fill-primary");
    }

    const dayName = day.getAttribute("data-day") || "Día";
    const dateStr = day.getAttribute("data-date") || "";
    const inc = parseFloat(day.getAttribute("data-inc") || "0");
    const exp = parseFloat(day.getAttribute("data-exp") || "0");
    const profit = parseFloat(day.getAttribute("data-profit") || (inc - exp).toString());
    const margin = day.getAttribute("data-margin") || (inc > 0 ? ((profit / inc) * 100).toFixed(1) : "0.0");
    const sign = profit >= 0 ? "+" : "";

    if (tooltipText && tooltip) {
      tooltipText.innerText = `${dayName}: $${inc.toFixed(2)} Ventas | $${exp.toFixed(2)} Gastos (${sign}$${profit.toFixed(2)})`;
      tooltip.classList.add("scale-105");
      setTimeout(() => tooltip.classList.remove("scale-105"), 200);
    }

    if (auditDetail) {
      auditDetail.innerText = `Día: ${dayName}${dateStr ? ` (${dateStr})` : ''}`;
    }
    if (auditSales) {
      auditSales.innerText = `Ventas: $${inc.toFixed(2)}`;
    }
    if (auditExpenses) {
      auditExpenses.innerText = `Gastos: -$${exp.toFixed(2)}`;
    }
    if (auditProfit) {
      auditProfit.innerText = `Neto: ${sign}$${profit.toFixed(2)} (${margin}%)`;
      if (profit >= 0) {
        auditProfit.className = "text-primary font-bold";
      } else {
        auditProfit.className = "text-tertiary font-bold";
      }
    }
  }

  days.forEach(day => {
    day.addEventListener("click", () => selectDay(day));
    day.addEventListener("pointerdown", () => selectDay(day));
    day.addEventListener("mouseenter", () => selectDay(day));
    day.addEventListener("focus", () => selectDay(day));
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

  // Expense Modal Handling
  const modal = container.querySelector("#expenseModal");
  const openModalBtn = container.querySelector("#btnOpenExpenseModal");
  const closeModalBtn = container.querySelector("#closeExpenseModalBtn");
  const cancelBtn = container.querySelector("#cancelExpenseBtn");
  const form = container.querySelector("#expenseForm");

  const openModal = () => {
    if (!modal) return;
    modal.classList.remove("hidden");
    const amountInput = container.querySelector("#expenseAmount");
    if (amountInput) {
      amountInput.value = "";
      setTimeout(() => amountInput.focus(), 50);
    }
    const conceptInput = container.querySelector("#expenseConcept");
    if (conceptInput) conceptInput.value = "";
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.add("hidden");
  };

  openModalBtn?.addEventListener("click", openModal);
  closeModalBtn?.addEventListener("click", closeModal);
  cancelBtn?.addEventListener("click", closeModal);

  modal?.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // Form submission
  form?.addEventListener("submit", (e) => {
    if (e.preventDefault) e.preventDefault();

    const amountInput = container.querySelector("#expenseAmount");
    const conceptInput = container.querySelector("#expenseConcept");
    const categoryInput = container.querySelector("#expenseCategory");
    const dateInput = container.querySelector("#expenseDate");
    const paymentMethodInput = container.querySelector("#expensePaymentMethod");
    const receiptInput = container.querySelector("#expenseReceipt");
    const notesInput = container.querySelector("#expenseNotes");

    const rawAmount = amountInput ? amountInput.value : "";
    const amount = parseFloat(rawAmount);
    const concept = conceptInput ? conceptInput.value.trim() : "";
    const category = categoryInput ? categoryInput.value : "Otros";
    const date = dateInput ? (dateInput.value || new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10);
    const paymentMethod = paymentMethodInput ? paymentMethodInput.value : "Efectivo";
    const receipt = receiptInput ? receiptInput.value.trim() : "";
    const notes = notesInput ? notesInput.value.trim() : "";

    if (isNaN(amount) || amount <= 0) {
      uiToast.error("Por favor ingresa un monto válido mayor a 0", "Dato Inválido");
      amountInput?.focus();
      return;
    }

    if (!concept) {
      uiToast.error("El concepto o descripción del gasto es requerido", "Dato Requerido");
      conceptInput?.focus();
      return;
    }

    try {
      store.saveExpense({
        amount,
        concept,
        category,
        date,
        paymentMethod,
        receipt,
        notes
      });
      uiToast.success(`Gasto registrado: $${amount.toFixed(2)} (${concept})`, "Gasto Guardado");
      closeModal();
    } catch (err) {
      uiToast.error(err.message || "Error al registrar el gasto", "Error");
    }
  });

  // Expense Ledger Category Filter
  const categoryFilter = container.querySelector("#expenseCategoryFilter");
  categoryFilter?.addEventListener("change", () => {
    const selected = categoryFilter.value;
    const rows = container.querySelectorAll(".expense-row");
    rows.forEach(row => {
      const rowCat = row.getAttribute("data-category");
      if (selected === "all" || rowCat === selected) {
        row.style.display = "";
      } else {
        row.style.display = "none";
      }
    });
  });

  // Delete Expense buttons
  const deleteBtns = container.querySelectorAll(".btn-delete-expense");
  deleteBtns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if (e.stopPropagation) e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const exp = store.getExpense(id);
      if (!exp) return;

      const confirmed = await uiModal.confirm({
        title: "Eliminar Gasto",
        message: `¿Estás seguro de que deseas eliminar el gasto "${exp.concept}" ($${exp.amount.toFixed(2)})? Esta acción recalculará los balances financieros.`,
        confirmText: "Eliminar",
        cancelText: "Cancelar",
        type: "danger"
      });

      if (confirmed) {
        store.deleteExpense(id);
        uiToast.success("Gasto eliminado exitosamente", "Contabilidad Actualizada");
      }
    });
  });

  // Reactive subscription for financial events
  if (!container._hasDashboardStoreSub) {
    container._hasDashboardStoreSub = true;
    const unsubscribe = store.subscribe((event) => {
      if (container.isConnected === false || typeof container.querySelector !== "function" || !container.querySelector("#weeklyTrendCard") || !container.querySelector("#trendChartSvg")) {
        unsubscribe();
        container._hasDashboardStoreSub = false;
        return;
      }
      if (event === "expenses_changed" || event === "invoices_changed" || event === "state_reloaded") {
        renderDashboardView(container);
      }
    });
  }
}
