// Módulo centralizado de persistência no Supabase para o módulo de Orçamento
// Substitui todo uso de localStorage por chamadas ao Supabase

import { supabase } from '@/integrations/supabase/client';
import { BudgetSettings, ProductItem, SavedBudget } from '@/lib/orcamento/types';
import { CatalogByBrand } from '@/lib/orcamento/chapas-catalog';

// =====================================================
// SETTINGS (configurações globais - só admin altera)
// =====================================================

const GLOBAL_SETTINGS_ID = '00000000-0000-0000-0000-000000000001';

export async function loadSettings(): Promise<BudgetSettings | null> {
  const { data, error } = await supabase
    .from('orcamento_settings')
    .select('settings')
    .eq('id', GLOBAL_SETTINGS_ID)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar configurações:', error);
    return null;
  }
  return data?.settings as BudgetSettings | null;
}

export async function saveSettings(settings: BudgetSettings, userId?: string): Promise<boolean> {
  const { error } = await supabase
    .from('orcamento_settings')
    .upsert({
      id: GLOBAL_SETTINGS_ID,
      settings: settings as any,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    });

  if (error) {
    console.error('Erro ao salvar configurações:', error);
    return false;
  }
  return true;
}

// =====================================================
// PRODUCTS (catálogo geral de materiais - todos editam)
// =====================================================

export async function loadProducts(): Promise<ProductItem[]> {
  const { data, error } = await supabase
    .from('orcamento_products')
    .select('*')
    .order('code');

  if (error) {
    console.error('Erro ao carregar produtos:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  return data.map(row => ({
    id: row.id,
    code: row.code,
    subcodes: (row.subcodes as string[]) || [],
    description: row.description,
    unit: row.unit,
    unit_price: Number(row.unit_price) || 0,
    unit_cost: row.unit_cost ? Number(row.unit_cost) : undefined,
    fita_metros: row.fita_metros ? Number(row.fita_metros) : undefined,
    category: (row.category || 'GERAL') as ProductItem['category'],
    notes: row.notes || undefined,
  }));
}

export async function saveAllProducts(products: ProductItem[]): Promise<boolean> {
  const rows = products.map(p => ({
    id: p.id,
    code: p.code,
    subcodes: p.subcodes as any,
    description: p.description,
    unit: p.unit,
    unit_price: p.unit_price,
    unit_cost: p.unit_cost ?? null,
    fita_metros: p.fita_metros ?? null,
    category: p.category || 'GERAL',
    notes: p.notes || null,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('orcamento_products')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error('Erro ao salvar produtos:', error);
    return false;
  }
  return true;
}

export async function updateProductField(
  productId: string,
  field: string,
  value: number
): Promise<boolean> {
  const { error } = await supabase
    .from('orcamento_products')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (error) {
    console.error('Erro ao atualizar produto:', error);
    return false;
  }
  return true;
}

export async function deleteProduct(productId: string): Promise<boolean> {
  const { error } = await supabase
    .from('orcamento_products')
    .delete()
    .eq('id', productId);

  if (error) {
    console.error('Erro ao excluir produto:', error);
    return false;
  }
  return true;
}

// =====================================================
// CHAPAS CATALOG (catálogo por marca - todos editam)
// =====================================================

export async function loadChapasCatalog(): Promise<CatalogByBrand | null> {
  const { data, error } = await supabase
    .from('orcamento_chapas')
    .select('brand, catalog_data');

  if (error) {
    console.error('Erro ao carregar catálogo de chapas:', error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const catalog: CatalogByBrand = {};
  for (const row of data) {
    catalog[row.brand] = row.catalog_data as any;
  }
  return catalog;
}

export async function saveChapasBrand(
  brand: string,
  catalogData: any,
  userId?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('orcamento_chapas')
    .upsert({
      brand,
      catalog_data: catalogData,
      updated_at: new Date().toISOString(),
      updated_by: userId || null,
    }, { onConflict: 'brand' });

  if (error) {
    console.error('Erro ao salvar marca de chapas:', error);
    return false;
  }
  return true;
}

export async function saveFullChapasCatalog(
  catalog: CatalogByBrand,
  userId?: string
): Promise<boolean> {
  const rows = Object.entries(catalog).map(([brand, data]) => ({
    brand,
    catalog_data: data as any,
    updated_at: new Date().toISOString(),
    updated_by: userId || null,
  }));

  const { error } = await supabase
    .from('orcamento_chapas')
    .upsert(rows, { onConflict: 'brand' });

  if (error) {
    console.error('Erro ao salvar catálogo de chapas:', error);
    return false;
  }
  return true;
}

export async function deleteChapasBrand(brand: string): Promise<boolean> {
  const { error } = await supabase
    .from('orcamento_chapas')
    .delete()
    .eq('brand', brand);

  if (error) {
    console.error('Erro ao excluir marca:', error);
    return false;
  }
  return true;
}

// =====================================================
// BUDGETS (orçamentos salvos)
// =====================================================

export async function loadBudgets(
  userId: string,
  isAdmin: boolean
): Promise<(SavedBudget & { _isOwner: boolean; _canSeeValues: boolean })[]> {
  const { data, error } = await supabase
    .from('orcamento_budgets')
    .select('*')
    .eq('is_draft', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Erro ao carregar orçamentos:', error);
    return [];
  }

  if (!data) return [];

  return data.map(row => {
    const isOwner = row.user_id === userId;
    const canSeeValues = isOwner || isAdmin;

    return {
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      client_name: row.client_name || undefined,
      client_phone: canSeeValues ? (row.client_phone || undefined) : undefined,
      client_id: row.client_id || undefined,
      projeto_id: row.projeto_id || undefined,
      project_environment: row.project_environment || undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
      status: row.status as SavedBudget['status'],
      items: canSeeValues ? (row.items as any[] || []) : [],
      settings: canSeeValues ? (row.settings as any || {}) : ({} as any),
      totals: canSeeValues
        ? (row.totals as any || { total_cost: 0, total_price: 0, gross_profit: 0, profit_margin_percent: 0, items_count: 0 })
        : { total_cost: 0, total_price: 0, gross_profit: 0, profit_margin_percent: 0, items_count: 0 },
      merged_from_ids: row.merged_from_ids as string[] | undefined,
      _isOwner: isOwner,
      _canSeeValues: canSeeValues,
    };
  });
}

export async function saveBudget(
  userId: string,
  budget: SavedBudget
): Promise<boolean> {
  const { error } = await supabase
    .from('orcamento_budgets')
    .upsert({
      id: budget.id,
      user_id: userId,
      name: budget.name,
      client_name: budget.client_name || null,
      client_phone: budget.client_phone || null,
      client_id: budget.client_id || null,
      projeto_id: budget.projeto_id || null,
      project_environment: budget.project_environment || null,
      status: budget.status,
      items: budget.items as any,
      settings: budget.settings as any,
      totals: budget.totals as any,
      merged_from_ids: budget.merged_from_ids || null,
      is_draft: false,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    console.error('Erro ao salvar orçamento:', error);
    return false;
  }
  return true;
}

export async function deleteBudget(budgetId: string): Promise<boolean> {
  const { error } = await supabase
    .from('orcamento_budgets')
    .delete()
    .eq('id', budgetId);

  if (error) {
    console.error('Erro ao excluir orçamento:', error);
    return false;
  }
  return true;
}

// =====================================================
// DRAFT (rascunho do orçamento atual do usuário)
// =====================================================

const DRAFT_PREFIX = 'draft-';

export async function loadDraft(userId: string): Promise<any[] | null> {
  const { data, error } = await supabase
    .from('orcamento_budgets')
    .select('items')
    .eq('user_id', userId)
    .eq('is_draft', true)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar rascunho:', error);
    return null;
  }

  return data?.items as any[] | null;
}

export async function saveDraft(userId: string, items: any[]): Promise<boolean> {
  const draftId = `${DRAFT_PREFIX}${userId}`;

  const { error } = await supabase
    .from('orcamento_budgets')
    .upsert({
      id: draftId,
      user_id: userId,
      name: 'Rascunho',
      status: 'RASCUNHO',
      items: items as any,
      settings: {} as any,
      totals: {} as any,
      is_draft: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

  if (error) {
    console.error('Erro ao salvar rascunho:', error);
    return false;
  }
  return true;
}
