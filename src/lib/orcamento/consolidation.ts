import type { BudgetItem, SavedBudget } from "./types";

/** Preserve each environment and its hierarchy; never merge similarly named parts. */
export function consolidateBudgets(budgets: SavedBudget[]): BudgetItem[] {
  if (budgets.length < 2) throw new Error("Selecione pelo menos dois ambientes.");
  const client = budgets[0].client_id || budgets[0].client_name?.trim().toLocaleLowerCase("pt-BR");
  if (
    !client ||
    budgets.some(
      (b) => (b.client_id || b.client_name?.trim().toLocaleLowerCase("pt-BR")) !== client,
    )
  ) {
    throw new Error("Agrupe somente ambientes do mesmo cliente.");
  }
  return budgets.flatMap((budget) => {
    const ids = new Map(
      budget.items.map((item, index) => [item.id, `${budget.id}:${item.id || index}`]),
    );
    return budget.items.map((item, index) => ({
      ...item,
      id: ids.get(item.id)!,
      item_number: index + 1,
      parentId: item.parentId ? ids.get(item.parentId) : undefined,
      environment_id: budget.id,
      // Preserve the negotiated sale totals rather than reprice with another environment's settings.
      final_price: item.final_price ?? item.salePrice ?? item.total_price,
      price_origin: "imported" as const,
    }));
  });
}
