import { supabase } from '@/integrations/supabase/client';
import type { BudgetItem, BudgetSettings, ProductItem, SavedBudget } from './types';
import type { CatalogByBrand } from './chapas-catalog';

export interface OrcamentoWorkspaceState {
  currentItems: BudgetItem[];
  savedBudgets: SavedBudget[];
  settings: BudgetSettings;
  database: ProductItem[];
  catalog: CatalogByBrand;
  currentBudgetId: string | null;
}

export async function loadOrcamentoWorkspace(userId: string): Promise<OrcamentoWorkspaceState | null> {
  const { data, error } = await (supabase as any)
    .from('orcamento_workspace')
    .select('current_items, saved_budgets, settings, materials, catalog, current_budget_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    currentItems: data.current_items || [],
    savedBudgets: data.saved_budgets || [],
    settings: data.settings,
    database: data.materials || [],
    catalog: data.catalog,
    currentBudgetId: data.current_budget_id || null,
  };
}

export async function saveOrcamentoWorkspace(userId: string, state: OrcamentoWorkspaceState): Promise<void> {
  const { error } = await (supabase as any).from('orcamento_workspace').upsert({
    user_id: userId,
    current_items: state.currentItems,
    saved_budgets: state.savedBudgets,
    settings: state.settings,
    materials: state.database,
    catalog: state.catalog,
    current_budget_id: state.currentBudgetId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}
