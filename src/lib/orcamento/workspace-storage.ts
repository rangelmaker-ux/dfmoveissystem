import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { BudgetItem, BudgetSettings, ProductItem, SavedBudget } from "./types";
import type { CatalogByBrand } from "./chapas-catalog";

export interface OrcamentoWorkspaceState {
  currentItems: BudgetItem[];
  savedBudgets: SavedBudget[];
  settings: BudgetSettings;
  database: ProductItem[];
  catalog: CatalogByBrand;
  currentBudgetId: string | null;
  revision: number;
  catalogRevision: number;
}
const json = (value: unknown) => value as Json;

export async function loadOrcamentoWorkspace(userId: string): Promise<OrcamentoWorkspaceState> {
  const [workspace, catalog, budgets] = await Promise.all([
    supabase.from("orcamento_workspace").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("orcamento_catalog").select("*").eq("id", 1).maybeSingle(),
    supabase.from("orcamento_budgets").select("*").order("updated_at", { ascending: false }),
  ]);
  for (const response of [workspace, catalog, budgets]) if (response.error) throw response.error;
  if (!catalog.data) throw new Error("A base de preços da loja não foi encontrada no servidor.");
  return {
    currentItems: (workspace.data?.current_items || []) as unknown as BudgetItem[],
    savedBudgets: (budgets.data || []).map((row) => ({
      ...(row.data as unknown as SavedBudget),
      revision: row.revision,
      user_id: row.user_id,
    })),
    settings: (workspace.data?.settings || {}) as unknown as BudgetSettings,
    database: (catalog.data?.materials || []) as unknown as ProductItem[],
    catalog: (catalog.data?.catalog || {}) as unknown as CatalogByBrand,
    currentBudgetId: workspace.data?.current_budget_id || null,
    revision: workspace.data?.revision || 0,
    catalogRevision: catalog.data?.revision || 0,
  };
}

export async function saveOrcamentoWorkspace(
  state: Pick<OrcamentoWorkspaceState, "currentItems" | "settings" | "currentBudgetId">,
  revision: number,
): Promise<number> {
  const { data, error } = await supabase.rpc("save_budget_workspace", {
    p_items: json(state.currentItems),
    p_settings: json(state.settings),
    p_budget_id: state.currentBudgetId,
    p_revision: revision,
  });
  if (error) throw error;
  return data;
}

export async function saveCompanyCatalog(
  database: ProductItem[],
  catalog: CatalogByBrand,
  revision: number,
): Promise<number> {
  const { data, error } = await supabase.rpc("save_company_catalog", {
    p_materials: json(database),
    p_catalog: json(catalog),
    p_revision: revision,
  });
  if (error) throw error;
  return data;
}

export async function saveBudgetRecord(budget: SavedBudget): Promise<SavedBudget> {
  const { revision, user_id, ...record } = budget;
  const { data, error } = await supabase.rpc("save_budget_record", {
    p_id: budget.id,
    p_data: json(record),
    p_revision: revision ?? null,
  });
  if (error) throw error;
  return { ...record, revision: data, user_id };
}

export async function deleteBudgetRecord(id: string, revision: number): Promise<void> {
  const { data, error } = await supabase
    .from("orcamento_budgets")
    .delete()
    .eq("id", id)
    .eq("revision", revision)
    .select("id");
  if (error) throw error;
  if (!data?.length)
    throw new Error("O orçamento mudou em outra sessão. Recarregue antes de excluir.");
}
