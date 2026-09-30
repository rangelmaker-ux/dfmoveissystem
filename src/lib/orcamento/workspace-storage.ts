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
    .select('current_items, saved_budgets, settings, materials, catalog, current_budget_id, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Busca também se outro projetista atualizou o catálogo de chapas ou materiais mais recentemente
  let latestMaterials = data.materials || [];
  let latestCatalog = data.catalog;

  try {
    const { data: latestCompany } = await (supabase as any)
      .from('orcamento_workspace')
      .select('materials, catalog, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestCompany) {
      if (Array.isArray(latestCompany.materials) && latestCompany.materials.length > 0) {
        latestMaterials = latestCompany.materials;
      }
      if (latestCompany.catalog && Object.keys(latestCompany.catalog).length > 0) {
        latestCatalog = latestCompany.catalog;
      }
    }
  } catch (err) {
    console.warn('Uso de catálogo local por fallback:', err);
  }

  return {
    currentItems: data.current_items || [],
    savedBudgets: data.saved_budgets || [],
    settings: data.settings,
    database: latestMaterials,
    catalog: latestCatalog,
    currentBudgetId: data.current_budget_id || null,
  };
}

export async function saveOrcamentoWorkspace(userId: string, state: OrcamentoWorkspaceState): Promise<void> {
  const now = new Date().toISOString();

  // 1. Salva o workspace particular do usuário (itens do rascunho, orçamentos salvos)
  const { error } = await (supabase as any).from('orcamento_workspace').upsert({
    user_id: userId,
    current_items: state.currentItems,
    saved_budgets: state.savedBudgets,
    settings: state.settings,
    materials: state.database,
    catalog: state.catalog,
    current_budget_id: state.currentBudgetId,
    updated_at: now,
  }, { onConflict: 'user_id' });
  if (error) throw error;

  // 2. Propaga imediatamente as alterações de catálogo de chapas e acessórios para todos os projetistas
  try {
    await (supabase as any).from('orcamento_workspace').update({
      materials: state.database,
      catalog: state.catalog,
      updated_at: now,
    }).neq('user_id', '00000000-0000-0000-0000-000000000000');
  } catch (syncErr) {
    console.warn('Aviso ao sincronizar catálogo compartilhado da empresa:', syncErr);
  }
}
