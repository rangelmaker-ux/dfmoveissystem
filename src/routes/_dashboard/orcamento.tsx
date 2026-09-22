import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Calculator, FileSpreadsheet, Database, Settings } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { BudgetItem, BudgetSettings, ProductItem, SavedBudget } from '@/lib/orcamento/types';
import { DEFAULT_MATERIALS } from '@/lib/orcamento/default-materials';
import { recalculateBudget, round2 } from '@/lib/orcamento/calculator';
import {
  loadSettings as sbLoadSettings,
  saveSettings as sbSaveSettings,
  loadProducts as sbLoadProducts,
  saveAllProducts as sbSaveAllProducts,
  loadBudgets as sbLoadBudgets,
  saveBudget as sbSaveBudget,
  deleteBudget as sbDeleteBudget,
  loadDraft as sbLoadDraft,
  saveDraft as sbSaveDraft,
} from '@/lib/orcamento/supabase-storage';
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
  const { role, user } = useAuthStore();
  const isAdmin = role === 'ADMIN';
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState('current');
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [database, setDatabase] = useState<ProductItem[]>(DEFAULT_MATERIALS);
  const [settings, setSettings] = useState<BudgetSettings>(DEFAULT_SETTINGS);
  const [savedBudgets, setSavedBudgets] = useState<SavedBudget[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);

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

  // Load ALL data from Supabase on mount
  useEffect(() => {
    if (!userId) return;

    const loadAll = async () => {
      try {
        // 1. Settings (globais)
        const cloudSettings = await sbLoadSettings();
        if (cloudSettings) setSettings(cloudSettings);

        // 2. Produtos (catálogo geral)
        const cloudProducts = await sbLoadProducts();
        if (cloudProducts.length > 0) {
          setDatabase(cloudProducts);
        } else {
          // First time: seed default materials to Supabase
          await sbSaveAllProducts(DEFAULT_MATERIALS);
        }

        // 3. Orçamentos salvos
        const cloudBudgets = await sbLoadBudgets(userId, isAdmin);
        if (cloudBudgets.length > 0) setSavedBudgets(cloudBudgets);

        // 4. Rascunho atual
        const cloudDraft = await sbLoadDraft(userId);
        if (cloudDraft && cloudDraft.length > 0) setItems(cloudDraft as BudgetItem[]);

        setDataLoaded(true);
      } catch (e) {
        console.error('Erro ao carregar dados do Supabase:', e);
        setDataLoaded(true);
      }
    };

    loadAll();
  }, [userId, isAdmin]);

  // Auto-save draft to Supabase with debounce (3 seconds)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!userId || !dataLoaded) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      sbSaveDraft(userId, items);
    }, 3000);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [items, userId, dataLoaded]);

  // Auto-save database changes to Supabase with debounce
  const dbTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!dataLoaded) return;

    if (dbTimerRef.current) clearTimeout(dbTimerRef.current);
    dbTimerRef.current = setTimeout(() => {
      sbSaveAllProducts(database);
    }, 2000);

    return () => {
      if (dbTimerRef.current) clearTimeout(dbTimerRef.current);
    };
  }, [database, dataLoaded]);

  // Totals calculation
  const { totals } = recalculateBudget(items, database, settings);

  // Save Settings: Persist to Supabase and propagate new margin
  const handleSaveSettings = async (newSettings: BudgetSettings) => {
    setSettings(newSettings);

    const ok = await sbSaveSettings(newSettings, userId);
    if (ok) {
      toast.success('Configurações salvas na nuvem!');
    } else {
      toast.error('Erro ao salvar configurações.');
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

  // Save current budget to Supabase
  const handleSaveBudget = async (
    clientName: string,
    projectName: string,
    extra?: { clientId?: string; clientPhone?: string; projetoId?: string }
  ) => {
    if (!userId) {
      toast.error('Sessão inválida. Faça login novamente.');
      return;
    }

    const newBudget: SavedBudget = {
      id: `budget-${Date.now()}`,
      name: `${clientName} - ${projectName || 'Orçamento'}`,
      client_name: clientName,
      client_phone: extra?.clientPhone,
      client_id: extra?.clientId,
      projeto_id: extra?.projetoId,
      project_environment: projectName,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'RASCUNHO',
      items: [...items],
      settings: { ...settings },
      totals: { ...totals },
    };

    const ok = await sbSaveBudget(userId, newBudget);
    if (ok) {
      setSavedBudgets(prev => [newBudget, ...prev]);
      toast.success('Orçamento salvo na nuvem com sucesso!');
    } else {
      toast.error('Erro ao salvar orçamento.');
    }
  };

  // Load a saved budget into current workspace
  const handleLoadBudget = (budget: SavedBudget) => {
    setItems(budget.items);
    setSettings(budget.settings);
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
          existing.quantity += item.quantity;
          existing.total_cost = round2(existing.unit_cost * existing.quantity);
          existing.total_price = round2(existing.unit_price * existing.quantity);
        } else {
          combinedMap.set(key, { ...item });
        }
      }
    }

    const consolidatedItems = Array.from(combinedMap.values()).map((it, idx) => ({
      ...it,
      id: `merged-${idx}-${Date.now()}`,
      item_number: idx + 1,
    }));

    setItems(consolidatedItems);
    setActiveTab('current');

    const names = selectedBudgets.map(b => b.project_environment || b.name).join(' + ');
    toast.success(`Orçamentos agrupados com sucesso! (${names})`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.06] pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
            Calculadora de Orçamentos (DF Móveis)
          </h2>
          <p className="text-xs text-slate-500">
            Conectada aos Clientes e Projetos cadastrados, com inserção de custos sob demanda, margem automática e exportação comercial em PDF.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-200/70 p-1">
          <TabsTrigger value="current" className="text-xs font-semibold data-[state=active]:bg-white">
            <Calculator className="mr-1.5 h-3.5 w-3.5 text-[#c92031]" />
            Orçamento Atual
            {items.length > 0 && (
              <span className="ml-1.5 rounded-full bg-[#c92031] px-1.5 py-0.2 text-[10px] font-bold text-white">
                {items.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="saved" className="text-xs font-semibold data-[state=active]:bg-white">
            <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
            Meus Orçamentos & Agrupados
            {savedBudgets.length > 0 && (
              <span className="ml-1.5 rounded-full bg-slate-300 px-1.5 py-0.2 text-[10px] font-bold text-slate-800">
                {savedBudgets.length}
              </span>
            )}
          </TabsTrigger>

          <TabsTrigger value="database" className="text-xs font-semibold data-[state=active]:bg-white">
            <Database className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Chapas por Marca e Linha
          </TabsTrigger>

          <TabsTrigger value="settings" className="text-xs font-semibold data-[state=active]:bg-white">
            <Settings className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
            Margens & Acréscimos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="current">
          <OrcamentoCurrentTab
            items={items}
            setItems={setItems}
            database={database}
            settings={settings}
            setSettings={setSettings}
            totals={totals}
            clientsList={clientsList}
            onSaveBudget={handleSaveBudget}
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
            settings={settings}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="settings">
          <OrcamentoSettingsTab
            settings={settings}
            setSettings={setSettings}
            onSaveSettings={handleSaveSettings}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
