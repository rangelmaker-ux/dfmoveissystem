import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Calculator, FileSpreadsheet, Database, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { BudgetItem, BudgetSettings, ProductItem, SavedBudget } from '@/lib/orcamento/types';
import { DEFAULT_MATERIALS } from '@/lib/orcamento/default-materials';
import { recalculateBudget, round2 } from '@/lib/orcamento/calculator';
import { INITIAL_CHAPAS_CATALOG, CatalogByBrand } from '@/lib/orcamento/chapas-catalog';
import { loadOrcamentoWorkspace, saveOrcamentoWorkspace } from '@/lib/orcamento/workspace-storage';
import { useAuthStore } from '@/hooks/use-auth';
import { OrcamentoCurrentTab } from '@/components/orcamento/orcamento-current-tab';
import { OrcamentoDatabaseTab } from '@/components/orcamento/orcamento-database-tab';
import { OrcamentoSettingsTab } from '@/components/orcamento/orcamento-settings-tab';
import { OrcamentoSavedTab } from '@/components/orcamento/orcamento-saved-tab';

export const Route = createFileRoute('/_dashboard/orcamento')({
  component: OrcamentoPage,
});

const DEFAULT_SETTINGS: BudgetSettings = {
  margin: 50,
  frete: 5,
  montagem: 10,
  comissao_vendas: 4,
  comissao_executivo: 2,
  outros: [],
  chapa_mode: 'm2',
  chapa_rounding: 'up',
  fita_mode: 'metros',
  pdf_show_unit_price: true,
  pdf_show_item_total: true,
};

function OrcamentoPage() {
  const [activeTab, setActiveTab] = useState('current');
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [database, setDatabase] = useState<ProductItem[]>(DEFAULT_MATERIALS);
  const [settings, setSettings] = useState<BudgetSettings>(DEFAULT_SETTINGS);
  const [savedBudgets, setSavedBudgets] = useState<SavedBudget[]>([]);
  const [catalog, setCatalog] = useState<CatalogByBrand>(INITIAL_CHAPAS_CATALOG);
  const [loadedBudgetId, setLoadedBudgetId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : localStorage.getItem('df_orcamento_loaded_budget_id')
  );
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const userId = useAuthStore(state => state.user?.id);

  // Fetch registered clients and their projects from Supabase
  const { data: clientsList = [] } = useQuery({
    queryKey: ['orcamento-clientes-projetos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, telefone, email, projetos(id, nome, status)')
        .order('nome');
      if (error) {
        console.error('Erro ao buscar clientes no orçamento:', error);
        return [];
      }
      return data || [];
    },
  });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedDb = localStorage.getItem('df_orcamento_database');
      if (savedDb) {
        try {
          const parsed = JSON.parse(savedDb);
          if (Array.isArray(parsed)) {
            const existingCodes = new Set(parsed.map((p: any) => p.code));
            const merged = [...parsed];
            for (const def of DEFAULT_MATERIALS) {
              if (!existingCodes.has(def.code)) {
                merged.push(def);
              }
            }
            setDatabase(merged);
          } else {
            setDatabase(DEFAULT_MATERIALS);
          }
        } catch {
          setDatabase(DEFAULT_MATERIALS);
        }
      } else {
        setDatabase(DEFAULT_MATERIALS);
        localStorage.setItem('df_orcamento_database', JSON.stringify(DEFAULT_MATERIALS));
      }

      const savedSet = localStorage.getItem('df_orcamento_settings');
      if (savedSet) {
        setSettings(JSON.parse(savedSet));
      }

      const savedList = localStorage.getItem('df_orcamento_saved_list');
      if (savedList) {
        setSavedBudgets(JSON.parse(savedList));
      }

      const currentDraft = localStorage.getItem('df_orcamento_current_items');
      if (currentDraft) {
        setItems(JSON.parse(currentDraft));
      }

      const savedCatalog = localStorage.getItem('df_orcamento_chapas_catalog');
      if (savedCatalog) {
        try {
          const parsedCat = JSON.parse(savedCatalog);
          if (parsedCat['Acessórios']) {
            delete parsedCat['Acessórios'];
            localStorage.setItem('df_orcamento_chapas_catalog', JSON.stringify(parsedCat));
          }
          setCatalog(parsedCat);
        } catch (e) {
          console.error(e);
        }
      }
    } catch (e) {
      console.error('Erro ao ler dados do localStorage:', e);
    }
  }, []);

  // Prefer the shared workspace when available; localStorage remains an offline fallback.
  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setWorkspaceLoaded(true);
      return;
    }
    loadOrcamentoWorkspace(userId)
      .then(remote => {
        if (cancelled || !remote) return;
        setItems(remote.currentItems || []);
        setSavedBudgets(remote.savedBudgets || []);
        if (remote.settings && Object.keys(remote.settings).length) setSettings({ ...DEFAULT_SETTINGS, ...remote.settings });
        if (remote.database?.length) setDatabase(remote.database);
        if (remote.catalog && Object.keys(remote.catalog).length) setCatalog(remote.catalog);
        setLoadedBudgetId(remote.currentBudgetId || null);
      })
      .catch(error => console.warn('Sincronização remota indisponível; usando dados locais.', error))
      .finally(() => { if (!cancelled) setWorkspaceLoaded(true); });
    return () => { cancelled = true; };
  }, [userId]);

  // Sync database changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('df_orcamento_database', JSON.stringify(database));
    } catch (e) {
      console.error(e);
    }
  }, [database]);

  // Sync current items to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('df_orcamento_current_items', JSON.stringify(items));
    } catch (e) {
      console.error(e);
    }
  }, [items]);

  // Sync saved budgets to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('df_orcamento_saved_list', JSON.stringify(savedBudgets));
    } catch (e) {
      console.error(e);
    }
  }, [savedBudgets]);

  useEffect(() => {
    try {
      localStorage.setItem('df_orcamento_chapas_catalog', JSON.stringify(catalog));
    } catch (e) {
      console.error(e);
    }
  }, [catalog]);

  useEffect(() => {
    if (loadedBudgetId) localStorage.setItem('df_orcamento_loaded_budget_id', loadedBudgetId);
    else localStorage.removeItem('df_orcamento_loaded_budget_id');
  }, [loadedBudgetId]);

  useEffect(() => {
    if (!workspaceLoaded || !userId) return;
    const timer = window.setTimeout(() => {
      saveOrcamentoWorkspace(userId, {
        currentItems: items,
        savedBudgets,
        settings,
        database,
        catalog,
        currentBudgetId: loadedBudgetId,
      }).catch(error => console.warn('Não foi possível sincronizar o orçamento; cópia local preservada.', error));
    }, 700);
    return () => window.clearTimeout(timer);
  }, [workspaceLoaded, userId, items, savedBudgets, settings, database, catalog, loadedBudgetId]);

  // Totals calculation
  const { totals } = recalculateBudget(items, database, settings);

  // Save Settings: Persist and immediately propagate new margin to all budget items
  const handleSaveSettings = (newSettings: BudgetSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem('df_orcamento_settings', JSON.stringify(newSettings));
    } catch (e) {
      console.error(e);
    }

    // Update all items in the active budget with the new margin
    if (items.length > 0) {
      const updatedItems = items.map(it => ({
        ...it,
        margin: newSettings.margin,
      }));
      const res = recalculateBudget(updatedItems, database, newSettings);
      setItems(res.items);
    }
  };

  // Save current budget
  const handleSaveBudget = (
    clientName: string,
    projectName: string,
    extra?: { clientId?: string; clientPhone?: string; projetoId?: string }
  ) => {
    const existing = loadedBudgetId ? savedBudgets.find(budget => budget.id === loadedBudgetId) : undefined;
    const newBudget: SavedBudget = {
      id: existing?.id || `budget-${Date.now()}`,
      name: `${clientName} - ${projectName || 'Orçamento'}`,
      client_name: clientName,
      client_phone: extra?.clientPhone,
      client_id: extra?.clientId,
      projeto_id: extra?.projetoId,
      project_environment: projectName,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'RASCUNHO',
      items: [...items],
      settings: { ...settings },
      totals: { ...totals },
    };

    setSavedBudgets(prev => existing
      ? prev.map(budget => budget.id === existing.id ? newBudget : budget)
      : [newBudget, ...prev]);
    setLoadedBudgetId(newBudget.id);
    toast.success(existing ? 'Orçamento atualizado com sucesso!' : 'Orçamento salvo com sucesso!');
  };

  // Load a saved budget into current workspace
  const handleLoadBudget = (budget: SavedBudget) => {
    setItems(budget.items);
    setSettings({ ...DEFAULT_SETTINGS, ...budget.settings });
    setLoadedBudgetId(budget.id);
    setActiveTab('current');
    toast.info(`Orçamento "${budget.name}" carregado para a tela de trabalho.`);
  };

  // Merge multiple saved budgets (Agrupamento de Orçamentos)
  const handleMergeBudgets = (selectedBudgets: SavedBudget[]) => {
    const combinedMap = new Map<string, BudgetItem>();

    for (const b of selectedBudgets) {
      for (const item of b.items) {
        const key = `${item.code.toLowerCase()}|||${item.description.toLowerCase()}`;
        if (combinedMap.has(key)) {
          const existing = combinedMap.get(key)!;
          const existingQuantity = existing.original_quantity ?? existing.quantity;
          const itemQuantity = item.original_quantity ?? item.quantity;
          existing.quantity = round2(existingQuantity + itemQuantity);
          existing.original_quantity = existing.quantity;
          existing.total_cost = round2(existing.unit_cost * existing.quantity);
          existing.total_price = round2(existing.unit_price * existing.quantity);
        } else {
          const quantity = item.original_quantity ?? item.quantity;
          combinedMap.set(key, { ...item, quantity, original_quantity: quantity });
        }
      }
    }

    const consolidatedItems = Array.from(combinedMap.values()).map((it, idx) => ({
      ...it,
      id: `merged-${idx}-${Date.now()}`,
      item_number: idx + 1,
    }));

    const mergeSettings = selectedBudgets[0]?.settings || settings;
    const recalculated = recalculateBudget(consolidatedItems, database, mergeSettings);
    setItems(recalculated.items);
    setSettings(mergeSettings);
    setLoadedBudgetId(null);
    setActiveTab('current');

    const names = selectedBudgets.map(b => b.project_environment || b.name).join(' + ');
    toast.success(`Orçamentos agrupados com sucesso! (${names})`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[#17191d] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#cbb27a]">
              Marcenaria Sob Medida
            </span>
            <span className="text-xs text-stone-400">•</span>
            <span className="text-xs font-medium text-stone-500">Engenharia de Custos & Produção</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            Calculadora de Orçamentos
          </h2>
          <p className="text-xs text-stone-500 max-w-2xl">
            Importação precisa de arquivos Promob XML/PDF, decomposição de módulos e ferragens, vinculação instantânea com a tabela de chapas e geração de propostas comerciais.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-11 inline-flex items-center gap-1 rounded-xl border border-stone-200/90 bg-stone-100/90 p-1 text-xs shadow-2xs">
            <TabsTrigger
              value="current"
              className="h-9 px-3.5 text-xs font-medium text-stone-600 transition-all data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-xs rounded-lg"
            >
              <Calculator className="mr-2 h-3.5 w-3.5 text-[#c92031]" />
              Orçamento em Edição
              {items.length > 0 && (
                <span className="ml-2 rounded-full bg-[#c92031] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                  {items.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="saved"
              className="h-9 px-3.5 text-xs font-medium text-stone-600 transition-all data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-xs rounded-lg"
            >
              <FileSpreadsheet className="mr-2 h-3.5 w-3.5 text-slate-600" />
              Projetos Salvos & Agrupados
              {savedBudgets.length > 0 && (
                <span className="ml-2 rounded-full bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold leading-none text-stone-800">
                  {savedBudgets.length}
                </span>
              )}
            </TabsTrigger>

            <TabsTrigger
              value="database"
              className="h-9 px-3.5 text-xs font-medium text-stone-600 transition-all data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-xs rounded-lg"
            >
              <Database className="mr-2 h-3.5 w-3.5 text-slate-600" />
              Tabela de Preços & Chapas
            </TabsTrigger>

            <TabsTrigger
              value="settings"
              className="h-9 px-3.5 text-xs font-medium text-stone-600 transition-all data-[state=active]:bg-white data-[state=active]:font-semibold data-[state=active]:text-slate-900 data-[state=active]:shadow-xs rounded-lg"
            >
              <Settings className="mr-2 h-3.5 w-3.5 text-slate-600" />
              Margens & Parâmetros
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="current">
          <OrcamentoCurrentTab
            items={items}
            setItems={setItems}
            database={database}
            catalog={catalog}
            settings={settings}
            setSettings={setSettings}
            totals={totals}
            clientsList={clientsList}
            onSaveBudget={handleSaveBudget}
            onStartNewBudget={() => setLoadedBudgetId(null)}
          />
        </TabsContent>

        <TabsContent value="saved">
          <OrcamentoSavedTab
            savedBudgets={savedBudgets}
            setSavedBudgets={setSavedBudgets}
            onLoadBudget={handleLoadBudget}
            onMergeBudgets={handleMergeBudgets}
          />
        </TabsContent>

        <TabsContent value="database">
          <OrcamentoDatabaseTab 
            database={database} 
            setDatabase={setDatabase} 
            catalog={catalog}
            setCatalog={setCatalog}
            settings={settings} 
          />
        </TabsContent>

        <TabsContent value="settings">
          <OrcamentoSettingsTab
            settings={settings}
            setSettings={setSettings}
            onSaveSettings={handleSaveSettings}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
