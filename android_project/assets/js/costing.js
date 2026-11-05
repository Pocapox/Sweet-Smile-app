// js/costing.js - High-Precision Culinary Costing & Profit Margin Engine

export class CostingEngine {
  /**
   * Calculates recipe total costs, margins, and recommended retail prices.
   * @param {Object} recipe 
   * @param {number} customMargin - Optional override for profit margin (0-95%)
   */
  static calculateRecipe(recipe, customMargin = null) {
    const ingredients = recipe.ingredients || [];
    let directIngredientsCost = 0;

    const itemized = ingredients.map(ing => {
      const qty = parseFloat(ing.quantity) || 0;
      const uCost = parseFloat(ing.unitCost) || 0;
      const total = Math.round(qty * uCost * 100) / 100;
      directIngredientsCost += total;
      return {
        ...ing,
        totalCost: total
      };
    });

    const indirectCost = parseFloat(recipe.indirectCost) || 0;
    const totalProductionCost = Math.round((directIngredientsCost + indirectCost) * 100) / 100;
    
    const portions = Math.max(1, parseInt(recipe.portions) || 1);
    const unitCost = Math.round((totalProductionCost / portions) * 100) / 100;

    const margin = customMargin !== null ? parseFloat(customMargin) : (parseFloat(recipe.targetMargin) || 60);
    const clampedMargin = Math.min(95, Math.max(5, margin));

    // PVP = Cost / (1 - Margin%)
    const rawPvp = totalProductionCost / (1 - (clampedMargin / 100));
    const suggestedPrice = Math.round(rawPvp * 100) / 100;
    const suggestedUnitPrice = Math.round((suggestedPrice / portions) * 100) / 100;

    const grossProfit = Math.round((suggestedPrice - totalProductionCost) * 100) / 100;
    const actualPrice = parseFloat(recipe.actualPrice) || suggestedPrice;
    const actualGrossProfit = Math.round((actualPrice - totalProductionCost) * 100) / 100;
    const actualMargin = actualPrice > 0 
      ? Math.round(((actualPrice - totalProductionCost) / actualPrice) * 1000) / 10 
      : 0;

    return {
      directIngredientsCost,
      indirectCost,
      totalProductionCost,
      portions,
      unitCost,
      targetMargin: clampedMargin,
      suggestedPrice,
      suggestedUnitPrice,
      grossProfit,
      actualPrice,
      actualGrossProfit,
      actualMargin,
      ingredients: itemized
    };
  }

  /**
   * Re-evaluates a recipe when an inventory ingredient price changes.
   */
  static simulatePriceIncrease(recipe, ingredientName, newUnitCost) {
    const cloned = JSON.parse(JSON.stringify(recipe));
    const ing = cloned.ingredients.find(i => i.name.toLowerCase().includes(ingredientName.toLowerCase()));
    if (ing) {
      ing.unitCost = newUnitCost;
    }
    return this.calculateRecipe(cloned);
  }
}
