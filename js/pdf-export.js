// js/pdf-export.js - Professional Recipe PDF & Kitchen Print Sheet Generator
import { CostingEngine } from './costing.js';
import { store } from './store.js';

export class RecipePdfExporter {
  /**
   * Generates a printable recipe document and opens print dialog for instant PDF saving.
   * @param {Object} recipe 
   */
  static printRecipePdf(recipe) {
    const calc = CostingEngine.calculateRecipe(recipe);
    const settings = store.getSettings();

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor permite ventanas emergentes para generar el PDF de la receta.");
      return;
    }

    const ingredientsRows = calc.ingredients.map(ing => `
      <tr style="border-bottom: 1px solid #e2e8fb;">
        <td style="padding: 8px 12px; width: 30px; text-align: center;">
          <input type="checkbox" style="width: 16px; height: 16px; cursor: pointer;" />
        </td>
        <td style="padding: 8px 12px; font-weight: 600; color: #151b29;">${ing.name}</td>
        <td style="padding: 8px 12px; text-align: right; color: #434751;">${ing.quantity} ${ing.unit}</td>
        <td style="padding: 8px 12px; text-align: right; color: #434751;">${settings.currency}${Number(ing.unitCost).toFixed(2)}</td>
        <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #345aa0;">${settings.currency}${Number(ing.totalCost).toFixed(2)}</td>
      </tr>
    `).join("");

    const instructionsRows = (recipe.instructions || []).map((step, idx) => `
      <li style="margin-bottom: 10px; line-height: 1.5; color: #151b29;">
        <strong style="color: #345aa0;">Paso ${idx + 1}:</strong> ${step}
      </li>
    `).join("");

    const htmlContent = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${recipe.name} - Ficha Técnica de Pastelería</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      color: #151b29;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #345aa0;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .logo-title {
      font-size: 24px;
      font-weight: 800;
      color: #345aa0;
      margin: 0;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      background: #e2e8fb;
      color: #345aa0;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      background: #f1f3ff;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
    }
    .meta-box span { display: block; font-size: 11px; color: #434751; text-transform: uppercase; }
    .meta-box strong { font-size: 16px; color: #151b29; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #345aa0; color: #ffffff; padding: 9px 12px; font-size: 12px; text-transform: uppercase; text-align: left; }
    th.right, td.right { text-align: right; }
    .cost-summary {
      background: #f9f9ff;
      border: 1px solid #dde2f5;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 20px;
    }
    .cost-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      text-align: center;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #dde2f5;
      padding-top: 10px;
      font-size: 11px;
      color: #747782;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background: #345aa0; color: white; padding: 10px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
    <span>Vista Previa de Impresión / Guardar como PDF</span>
    <button onclick="window.print()" style="background: white; color: #345aa0; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer;">
      🖨️ Imprimir / Guardar en PDF
    </button>
  </div>

  <div class="header">
    <div>
      <h1 class="logo-title">🍰 ${settings.storeName}</h1>
      <p style="margin: 3px 0 0 0; color: #434751; font-size: 13px;">Ficha Técnica de Producción y Costeo Culinario</p>
    </div>
    <div style="text-align: right;">
      <span class="badge">Receta ${recipe.code || '#001'}</span>
      <p style="margin: 4px 0 0 0; font-size: 12px; color: #747782;">Fecha: ${new Date().toLocaleDateString()}</p>
    </div>
  </div>

  <h2 style="font-size: 20px; color: #151b29; margin-top: 0; margin-bottom: 12px;">${recipe.name}</h2>

  <div class="meta-grid">
    <div class="meta-box">
      <span>Rendimiento</span>
      <strong>${recipe.portions} porciones</strong>
    </div>
    <div class="meta-box">
      <span>Tiempo Preparación</span>
      <strong>${recipe.prepTime || '1h 30m'}</strong>
    </div>
    <div class="meta-box">
      <span>Dificultad</span>
      <strong>${recipe.difficulty || 'Media'}</strong>
    </div>
    <div class="meta-box">
      <span>Categoría</span>
      <strong>${recipe.category}</strong>
    </div>
  </div>

  <h3 style="font-size: 15px; color: #345aa0; border-bottom: 1px solid #dde2f5; padding-bottom: 6px; margin-bottom: 10px;">
    📋 Lista de Insumos & Pesos
  </h3>

  <table>
    <thead>
      <tr>
        <th style="width: 30px; text-align: center;">✓</th>
        <th>Ingrediente</th>
        <th class="right">Cantidad</th>
        <th class="right">Costo Unit.</th>
        <th class="right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${ingredientsRows}
    </tbody>
  </table>

  <div class="cost-summary">
    <div class="cost-grid">
      <div>
        <span style="font-size: 12px; color: #434751;">Costo Insumos Directos</span>
        <div style="font-size: 18px; font-weight: bold; color: #151b29;">${settings.currency}${calc.directIngredientsCost.toFixed(2)}</div>
      </div>
      <div>
        <span style="font-size: 12px; color: #434751;">Costo Total (+Indirectos)</span>
        <div style="font-size: 18px; font-weight: bold; color: #151b29;">${settings.currency}${calc.totalProductionCost.toFixed(2)}</div>
      </div>
      <div>
        <span style="font-size: 12px; color: #434751;">Costo por Porción</span>
        <div style="font-size: 18px; font-weight: bold; color: #345aa0;">${settings.currency}${calc.unitCost.toFixed(2)}</div>
      </div>
    </div>
    <div style="margin-top: 10px; border-top: 1px dashed #c3c6d2; padding-top: 8px; display: flex; justify-content: space-between; font-size: 13px;">
      <span><strong>Margen Objetivo:</strong> ${calc.targetMargin}%</span>
      <span><strong>PVP Sugerido:</strong> ${settings.currency}${calc.suggestedPrice.toFixed(2)}</span>
      <span style="color: #445f8c;"><strong>Ganancia Estimada:</strong> +${settings.currency}${calc.grossProfit.toFixed(2)}</span>
    </div>
  </div>

  <h3 style="font-size: 15px; color: #345aa0; border-bottom: 1px solid #dde2f5; padding-bottom: 6px; margin-bottom: 10px;">
    👩‍🍳 Procedimiento de Elaboración
  </h3>

  <ol style="padding-left: 20px; margin: 0 0 20px 0;">
    ${instructionsRows}
  </ol>

  <div class="footer">
    <span>Sweet Smile Pastry & Bakery Manager • Generado para uso en cocina</span>
    <span>Firma Pastelera Responsable: _______________________</span>
  </div>
</body>
</html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
