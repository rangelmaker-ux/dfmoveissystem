import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, Component, ReactNode, ErrorInfo, useRef } from "react";
import {
  Calculator,
  FileSpreadsheet,
  Database,
  Settings,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BudgetItem, BudgetSettings, ProductItem, SavedBudget } from "@/lib/orcamento/types";
import { DEFAULT_MATERIALS } from "@/lib/orcamento/default-materials";
import { recalculateBudget, round2 } from "@/lib/orcamento/calculator";
import {
  INITIAL_CHAPAS_CATALOG,
  CatalogByBrand,
  sanitizeAndMergeCatalog,
} from "@/lib/orcamento/chapas-catalog";
import {
  loadOrcamentoWorkspace,
  saveOrcamentoWorkspace,
  saveCompanyCatalog,
  saveBudgetRecord,
  deleteBudgetRecord,
} from "@/lib/orcamento/workspace-storage";
import { consolidateBudgets } from "@/lib/orcamento/consolidation";
import { useAuthStore } from "@/hooks/use-auth";
import { OrcamentoCurrentTab } from "@/components/orcamento/orcamento-current-tab";
import { OrcamentoDatabaseTab } from "@/components/orcamento/orcamento-database-tab";
import { OrcamentoSettingsTab } from "@/components/orcamento/orcamento-settings-tab";
import { clearPendingScope, setSyncScope } from '@/lib/server-status';
import { OrcamentoSavedTab } from "@/components/orcamento/orcamento-saved-tab";

interface ErrorBoundaryProps {
  children: ReactNode;
  tabName: string;
  onResetCatalog?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class TabErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Erro na aba ${this.props.tabName}:`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50/70 p-6 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Instabilidade detectada na aba {this.props.tabName}
          </h3>
          <p className="text-xs text-stone-600 max-w-md mx-auto">
            Houve um conflito nos dados locais ou formato das tabelas. Você pode restaurar a tabela
            oficial do Promob Plus com segurança sem perder seus orçamentos.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false })}
              className="text-xs bg-white"
            >
              Tentar Novamente
            </Button>
            {this.props.onResetCatalog && (
              <Button
                size="sm"
                onClick={() => {
                  this.props.onResetCatalog?.();
                  this.setState({ hasError: false });
                }}
                className="bg-[#c92031] text-white hover:bg-[#aa1726] text-xs font-semibold"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Restaurar Tabela de Chapas Padrão
              </Button>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Route = createFileRoute("/_dashboard/orcamento")({
  component: OrcamentoPage,
});

const DEFAULT_SETTINGS: BudgetSettings = {
  margin: 200,
  frete: 5,
  montagem: 10,
  comissao_vendas: 4,
  comissao_executivo: 2,
  outros: [],
  chapa_mode: "m2",
  chapa_rounding: "up",
  fita_mode: "metros",
  pdf_show_unit_price: true,
  pdf_show_item_total: true,
};

function OrcamentoPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("current");
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [database, setDatabase] = useState<ProductItem[]>(DEFAULT_MATERIALS);
  const [settings, setSettings] = useState<BudgetSettings>(DEFAULT_SETTINGS);
  const [savedBudgets, setSavedBudgets] = useState<SavedBudget[]>([]);
  const [catalog, setCatalog] = useState<CatalogByBrand>(INITIAL_CHAPAS_CATALOG);
  const [loadedBudgetId, setLoadedBudgetId] = useState<string | null>(null);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Carregando…");
  useEffect(() => {
    const state = /Falha|não sincronizada/.test(syncStatus) ? 'error' : /Carregando|pendentes|Sincronizando/.test(syncStatus) ? 'saving' : 'idle';
    setSyncScope('orcamento', state);
  }, [syncStatus]);
  useEffect(() => () => clearPendingScope('orcamento'), []);
  const userId = useAuthStore((state) => state.user?.id);
  const revision = useRef(0);
  const catalogRevision = useRef(0);
  const catalogSnapshot = useRef("");
  const draftSnapshot = useRef("");
  const writeQueue = useRef(Promise.resolve());
  const syncFailed = useRef(false);
  const currentCatalog = useRef({ database, catalog });
  currentCatalog.current = { database, catalog };

  // Fetch registered clients and their projects from Supabase
  const { data: clientsList = [] } = useQuery({
    queryKey: ["orcamento-clientes-projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, email, projetos(id, nome, status)")
        .order("nome");
      if (error) {
        console.error("Erro ao buscar clientes no orçamento:", error);
        return [];
      }
      return data || [];
    },
  });

  useEffect(() => {
    let cancelled = false;
    setWorkspaceLoaded(false);
    syncFailed.current = false;
    if (!userId) return;
    loadOrcamentoWorkspace(userId)
      .then((remote) => {
        if (cancelled) return;
        revision.current = remote.revision;
        catalogRevision.current = remote.catalogRevision;
        const nextSettings = { ...DEFAULT_SETTINGS, ...remote.settings };
        const nextDatabase = remote.database;
        const nextCatalog = Object.keys(remote.catalog).length ? sanitizeAndMergeCatalog(remote.catalog) : {};
        setItems(recalculateBudget(remote.currentItems, nextDatabase, nextSettings, nextCatalog).items);
        setSettings(nextSettings);
        setSavedBudgets(remote.savedBudgets);
        setLoadedBudgetId(remote.currentBudgetId);
        setDatabase(nextDatabase);
        setCatalog(nextCatalog);
        catalogSnapshot.current = JSON.stringify([nextDatabase, nextCatalog]);
        draftSnapshot.current = JSON.stringify([
          remote.currentItems,
          nextSettings,
          remote.currentBudgetId,
        ]);
        setWorkspaceLoaded(true);
        setSyncStatus("Salvo no servidor");
      })
      .catch((error) => {
        if (cancelled) return;
        setSyncStatus("Falha ao carregar. Recarregue para tentar novamente.");
        toast.error("Não foi possível carregar seus orçamentos: " + error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!workspaceLoaded || !userId) return;
    const snapshot = JSON.stringify([items, settings, loadedBudgetId]);
    if (snapshot === draftSnapshot.current) return;
    // Recovery copies are scoped to the signed-in account and never imported automatically.
    try {
      localStorage.setItem(`df_orcamento_recovery:${userId}`, snapshot);
    } catch {
      toast.warning("Não foi possível criar a cópia local de recuperação.");
    }
    setSyncStatus("Alterações pendentes");
    const timer = window.setTimeout(() => {
      writeQueue.current = writeQueue.current
        .then(async () => {
          if (syncFailed.current) return;
          setSyncStatus("Sincronizando…");
          revision.current = await saveOrcamentoWorkspace(
            { currentItems: items, settings, currentBudgetId: loadedBudgetId },
            revision.current,
          );
          draftSnapshot.current = snapshot;
          setSyncStatus("Salvo no servidor");
        })
        .catch((error) => {
          syncFailed.current = true;
          setSyncStatus("Falha na sincronização. Cópia de recuperação preservada; recarregue.");
          toast.error("Rascunho não sincronizado: " + error.message);
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [workspaceLoaded, userId, items, settings, loadedBudgetId]);

  useEffect(() => {
    if (!workspaceLoaded) return;
    const snapshot = JSON.stringify([database, catalog]);
    if (snapshot === catalogSnapshot.current) return;
    setSyncStatus('Alterações pendentes');
    const timer = window.setTimeout(() => {
      writeQueue.current = writeQueue.current
        .then(async () => {
          if (syncFailed.current) return;
          catalogRevision.current = await saveCompanyCatalog(
            database,
            catalog,
            catalogRevision.current,
          );
          catalogSnapshot.current = snapshot;
          setSyncStatus('Salvo no servidor');
        })
        .catch((error) => {
          syncFailed.current = true;
          setSyncStatus("Tabela não sincronizada. Recarregue para resolver o conflito.");
          toast.error("Tabela de preços não salva: " + error.message);
        });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [workspaceLoaded, database, catalog]);

  useEffect(() => {
    if (!workspaceLoaded) return;
    let cancelled = false;
    const refresh = async () => {
      if (
        JSON.stringify([currentCatalog.current.database, currentCatalog.current.catalog]) !==
        catalogSnapshot.current
      )
        return;
      const { data, error } = await supabase
        .from("orcamento_catalog")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (cancelled || error || !data || data.revision <= catalogRevision.current) return;
      // Recheck after the request: a local edit may have started while it was in flight.
      if (
        JSON.stringify([currentCatalog.current.database, currentCatalog.current.catalog]) !==
        catalogSnapshot.current
      )
        return;
      const nextDatabase = data.materials as unknown as ProductItem[];
      const nextCatalog = sanitizeAndMergeCatalog(data.catalog);
      catalogRevision.current = data.revision;
      catalogSnapshot.current = JSON.stringify([nextDatabase, nextCatalog]);
      setDatabase(nextDatabase);
      setCatalog(nextCatalog);
    };
    const channel = supabase
      .channel(`company-catalog:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamento_catalog" },
        () => void refresh(),
      )
      .subscribe();
    const interval = window.setInterval(() => void refresh(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [workspaceLoaded, userId]);

  // Linked XML materials use the current shared catalogue; stored costs are not
  // an independent price table that can silently diverge from the server.
  useEffect(() => {
    if (!workspaceLoaded) return;
    setItems(current => {
      const recalculated = recalculateBudget(current, database, settings, catalog).items;
      return JSON.stringify(current) === JSON.stringify(recalculated) ? current : recalculated;
    });
  }, [workspaceLoaded, database, settings, catalog]);

  // Totals calculation
  const { totals } = recalculateBudget(items, database, settings, catalog);

  // Save Settings: Persist and immediately propagate new margin to all budget items
  const handleSaveSettings = (newSettings: BudgetSettings) => {
    setSettings(newSettings);
    try {
      localStorage.setItem(`df_orcamento_settings:${userId}`, JSON.stringify(newSettings));
    } catch (e) {
      console.error(e);
    }

    // Update all items in the active budget with the new margin
    if (items.length > 0) {
      const updatedItems = items.map((it) => ({
        ...it,
        margin: newSettings.margin,
      }));
      const res = recalculateBudget(updatedItems, database, newSettings, catalog);
      setItems(res.items);
    }
  };

  // Save current budget
  const handleSaveBudget = async (
    clientName: string,
    projectName: string,
    extra?: { clientId?: string; clientPhone?: string; projetoId?: string },
  ) => {
    const existing = loadedBudgetId
      ? savedBudgets.find((budget) => budget.id === loadedBudgetId)
      : undefined;
    const recalculated = recalculateBudget(items, database, settings, catalog);
    const newBudget: SavedBudget = {
      id: existing?.id || crypto.randomUUID(),
      revision: existing?.revision,
      user_id: existing?.user_id || userId,
      name: `${clientName} - ${projectName || "Orçamento"}`,
      client_name: clientName,
      client_phone: extra?.clientPhone,
      client_id: extra?.clientId,
      projeto_id: extra?.projetoId,
      project_environment: projectName,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: existing?.status || "RASCUNHO",
      items: recalculated.items,
      settings: { ...settings },
      totals: { ...recalculated.totals },
    };

    const persisted = await saveBudgetRecord(newBudget);
    setSavedBudgets((prev) =>
      existing
        ? prev.map((budget) => (budget.id === existing.id ? persisted : budget))
        : [persisted, ...prev],
    );
    setLoadedBudgetId(newBudget.id);
    void queryClient.invalidateQueries({ queryKey: ["client-budgets"] });
    void queryClient.invalidateQueries({ queryKey: ["client-commercial"] });
    toast.success(existing ? "Orçamento atualizado com sucesso!" : "Orçamento salvo com sucesso!");
  };

  // Load a saved budget into current workspace
  const handleLoadBudget = (budget: SavedBudget) => {
    const restoredSettings = { ...DEFAULT_SETTINGS, ...budget.settings };
    setItems(recalculateBudget(budget.items, database, restoredSettings, catalog).items);
    setSettings(restoredSettings);
    setLoadedBudgetId(budget.id);
    setActiveTab("current");
    toast.info(`Orçamento "${budget.name}" carregado para a tela de trabalho.`);
  };

  // Merge multiple saved budgets (Agrupamento de Orçamentos)
  const handleMergeBudgets = (selectedBudgets: SavedBudget[]) => {
    let consolidatedItems: BudgetItem[];
    try {
      consolidatedItems = consolidateBudgets(selectedBudgets);
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }
    const mergeSettings = selectedBudgets[0]?.settings || settings;
    const recalculated = recalculateBudget(consolidatedItems, database, mergeSettings, catalog);
    setItems(recalculated.items);
    setSettings(mergeSettings);
    setLoadedBudgetId(null);
    setActiveTab("current");

    const names = selectedBudgets.map((b) => b.project_environment || b.name).join(" + ");
    toast.success(`Orçamentos agrupados com sucesso! (${names})`);
  };

  return (
    <div className="space-y-6">
      {activeTab === 'settings' && <details className="rounded-lg border border-stone-200 p-3">
      <summary className="cursor-pointer text-sm text-stone-600">Sincronização e recuperação</summary>
      <div className="mt-3 space-y-3">
      <p className="text-xs text-stone-500" role="status">
        {syncStatus}
      </p>
      {workspaceLoaded && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            try {
              const recovery = localStorage.getItem(`df_orcamento_recovery:${userId}`);
              if (!recovery) {
                toast.info("Nenhuma cópia local de recuperação disponível.");
                return;
              }
              const [recoveredItems, recoveredSettings, recoveredId] = JSON.parse(recovery);
              if (!Array.isArray(recoveredItems) || !recoveredSettings)
                throw new Error("Cópia inválida.");
              if (
                !window.confirm(
                  "Recuperar este rascunho local na tela de edição? Os orçamentos salvos não serão alterados.",
                )
              )
                return;
              setItems(recoveredItems);
              setSettings({ ...DEFAULT_SETTINGS, ...recoveredSettings });
              setLoadedBudgetId(recoveredId);
            } catch {
              toast.error("Não foi possível recuperar o rascunho.");
            }
          }}
        >
          Recuperar rascunho local
        </Button>
      )}
      {workspaceLoaded && <p className="text-xs text-stone-500">
        Base compartilhada carregada do servidor · {database.length} materiais · {Object.values(catalog).filter(value => value.type === 'brand').length} marcas
      </p>}
      </div>
      </details>}
      {!workspaceLoaded ? (
        <Button onClick={() => window.location.reload()}>Recarregar orçamentos</Button>
      ) : (
        <>
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200/80 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md bg-[#17191d] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#cbb27a]">
                  Marcenaria Sob Medida
                </span>
                <span className="text-xs text-stone-400">•</span>
                <span className="text-xs font-medium text-stone-500">
                  Engenharia de Custos & Produção
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                Calculadora de Orçamentos
              </h2>
              <p className="text-xs text-stone-500 max-w-2xl">
                Importação de arquivos Promob XML/PDF, agrupamento de móveis e ferragens,
                vinculação instantânea com a tabela de chapas e geração de propostas comerciais.
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
              <TabErrorBoundary tabName="Orçamento em Edição">
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
                  loadedBudget={savedBudgets.find((b) => b.id === loadedBudgetId)}
                  onStartNewBudget={() => setLoadedBudgetId(null)}
                />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="saved">
              <TabErrorBoundary tabName="Projetos Salvos & Agrupados">
                <OrcamentoSavedTab
                  savedBudgets={savedBudgets}
                  onDeleteBudget={async (budget) => {
                    await deleteBudgetRecord(budget.id, budget.revision || 0);
                    setSavedBudgets((prev) => prev.filter((b) => b.id !== budget.id));
                    void queryClient.invalidateQueries({ queryKey: ["client-budgets"] });
                    void queryClient.invalidateQueries({ queryKey: ["client-commercial"] });
                    if (loadedBudgetId === budget.id) setLoadedBudgetId(null);
                  }}
                  onLoadBudget={handleLoadBudget}
                  onMergeBudgets={handleMergeBudgets}
                />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="database">
              <TabErrorBoundary
                tabName="Tabela de Preços & Chapas"
                onResetCatalog={() => {
                  setCatalog(INITIAL_CHAPAS_CATALOG);
                  toast.success("Tabela de chapas e acabamentos restaurada para a versão oficial!");
                }}
              >
                <OrcamentoDatabaseTab
                  database={database}
                  setDatabase={setDatabase}
                  catalog={catalog}
                  setCatalog={setCatalog}
                  settings={settings}
                />
              </TabErrorBoundary>
            </TabsContent>

            <TabsContent value="settings">
              <TabErrorBoundary tabName="Margens & Parâmetros">
                <OrcamentoSettingsTab
                  settings={settings}
                  setSettings={setSettings}
                  onSaveSettings={handleSaveSettings}
                />
              </TabErrorBoundary>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
