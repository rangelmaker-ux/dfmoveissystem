import type { BudgetItem } from './types';

export function displayItemKey(item: BudgetItem) {
  // Prices, finishes and units must agree before rows can share one editor.
  return JSON.stringify([item.environment_id, item.code, item.promob_description || item.description,
    item.dimensions?.replace(/\s/g, ''), item.external_model, item.unit, item.original_unit,
    item.unit_cost, item.unit_price, item.margin, item.price_origin, item.price_unlinked,
    item.itemCategory, item.category, item.is_chapa, item.is_fita, item.fita_metros,
    item.catalog_override, item.catalog_match, item.has_children ? item.id : undefined]);
}
export function isEmptyGroupingItem(item: BudgetItem) {
  return item.itemCategory !== 'ACCESSORY' && (item.itemCategory === 'MODULE' || item.itemCategory === 'SUBMODULE' || item.is_parent_module || item.is_module_header)
    && item.total_cost === 0 && item.total_price === 0;
}
export function consolidateDisplayItems(items: BudgetItem[]): BudgetItem[] {
  const rows = new Map<string, BudgetItem>();
  for (const item of items) {
    if (isEmptyGroupingItem(item)) continue;
    const key = displayItemKey(item);
    const previous = rows.get(key);
    if (!previous) { rows.set(key, { ...item }); continue; }
    const quantity = previous.quantity + item.quantity;
    const rep = item.unit.toUpperCase() === 'UN' && Number.isInteger(quantity) ? quantity : (previous.rep || 1) + (item.rep || 1);
    rows.set(key, { ...previous, quantity: Math.round(quantity * 10000) / 10000,
      original_quantity: quantity, rep, unit_quantity: quantity / rep,
      total_cost: Math.round((previous.total_cost + item.total_cost) * 100) / 100,
      total_price: Math.round((previous.total_price + item.total_price) * 100) / 100 });
  }
  return [...rows.values()];
}
export function displaySourceIds(items: BudgetItem[], id: string): Set<string> {
  const original = items.find(item => item.id === id);
  if (!original) return new Set([id]);
  const key = displayItemKey(original);
  return new Set(items.filter(item => displayItemKey(item) === key).map(item => item.id));
}
export function redistributeDisplayQuantity(items: BudgetItem[], ids: Set<string>, quantity: number): BudgetItem[] {
  const sources = items.filter(item => ids.has(item.id));
  const total = sources.reduce((sum, item) => sum + item.quantity, 0);
  let allocated = 0;
  return items.map(item => {
    if (!ids.has(item.id)) return item;
    const last = item.id === sources.at(-1)?.id;
    const next = last ? Math.round((quantity - allocated) * 10000) / 10000 : Math.round(quantity * (total > 0 ? item.quantity / total : 1 / sources.length) * 10000) / 10000;
    allocated += next;
    return { ...item, quantity: next, original_quantity: next, rep: 1, unit_quantity: next };
  });
}
