import { DecimalInput } from "@/components/ui/decimal-input";
import { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, Plus, Trash2, Edit2, AlertTriangle, 
  CheckCircle2, FileSpreadsheet, Download, Save, Layers, Search, Check, Loader2, Link2, Unlink, Sparkles,
  User, FolderKanban, Info, ClipboardPaste, FileText, Eye, EyeOff,
  ChevronDown, ChevronRight, Wrench, FolderTree, Box
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { BudgetItem, SavedBudget, BudgetSettings, ProductItem, ModuleGroup } from '@/lib/orcamento/types';
import { parsePromobXML, parseTXT, parseCSV, parseJSON, parsePromobPDF, parsePromobTextTable, formatDimensionsCm } from '@/lib/orcamento/parsers';
import { 
  calculateItemPrice, recalculateBudget, CHAPA_AREA_M2, round2, isChapa,
  smartMatchPromobChapa, matchProduct, chapaSalePrice, resolveItemPrice, smartMatchAccessory,
  smartMatchMaoDeObra, isSimilarPromobItem, groupItemsByModule, isEletrodomestico
} from '@/lib/orcamento/calculator';
import { generateBudgetPdf } from '@/lib/orcamento/pdf-generator';
import { BrandCatalog, CatalogByBrand, MaoDeObraCatalog } from '@/lib/orcamento/chapas-catalog';

function BudgetNumberInput({ value, onCommit, ...props }: Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & { value: number | string; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const normalized = draft.includes(',') ? draft.replace(/\./g, '').replace(',', '.') : draft;
    const parsed = Number(normalized);
    if (!draft.trim() || !Number.isFinite(parsed) || parsed < 0) {
      setDraft(String(value));
      return;
    }
    if (parsed !== Number(value)) onCommit(parsed);
  };
  return <Input {...props} type="text" inputMode="decimal" value={draft}
    onChange={event => setDraft(event.target.value)}
    onBlur={commit}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
      if (event.key === 'Escape') { event.preventDefault(); setDraft(String(value)); }
    }} />;
}

export interface ClientWithProjects {
  id: string;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  projetos?: Array<{
    id: string;
    nome: string | null;
    status?: string | null;
  }> | null;
}

interface CurrentTabProps {
  items: BudgetItem[];
  setItems: React.Dispatch<React.SetStateAction<BudgetItem[]>>;
  database: ProductItem[];
  catalog: CatalogByBrand;
  settings: BudgetSettings;
  setSettings: React.Dispatch<React.SetStateAction<BudgetSettings>>;
  totals: {
    total_cost: number;
    total_price: number;
    gross_profit: number;
    profit_margin_percent: number;
    items_count: number;
  };
  clientsList?: ClientWithProjects[];
  onSaveBudget: (
    clientName: string,
    projectName: string,
    extra?: { clientId?: string; clientPhone?: string; projetoId?: string }
  ) => void | Promise<void>;
  onStartNewBudget: () => void;
  loadedBudget?: SavedBudget;
}

export function OrcamentoCurrentTab({
  items,
  setItems,
  database,
  catalog,
  settings,
  setSettings,
  totals,
  clientsList = [],
  onSaveBudget,
  onStartNewBudget,
  loadedBudget,
}: CurrentTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);

  // Client & Project Info (with link to registered client & project)
  const [selectedClientId, setSelectedClientId] = useState<string>('custom');
  const [clientName, setClientName] = useState('Cliente DF Móveis');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('custom');
  const [projectName, setProjectName] = useState('Ambiente Planejado');

  const lastLoadedBudgetId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!loadedBudget) { lastLoadedBudgetId.current = undefined; return; }
    if (lastLoadedBudgetId.current === loadedBudget.id) return;
    lastLoadedBudgetId.current = loadedBudget.id;
    setSelectedClientId(loadedBudget.client_id || 'custom');
    setSelectedProjectId(loadedBudget.projeto_id || 'custom');
    setClientName(loadedBudget.client_name || 'Cliente DF Móveis');
    setClientPhone(loadedBudget.client_phone || '');
    setProjectName(loadedBudget.project_environment || loadedBudget.name);
  }, [loadedBudget]);

  // Filter / Search inside current table
  const [filterSearch, setFilterSearch] = useState('');
  const [itemsViewFilter, setItemsViewFilter] = useState<'grouped' | 'leaves' | 'all'>('grouped');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Modal para colar texto / tabela exportada do Promob
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Add manual item form
  const [newItemCode, setNewItemCode] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemQty, setNewItemQty] = useState(1);
  const [newItemUnit, setNewItemUnit] = useState('M2');
  const [newItemCost, setNewItemCost] = useState('');

  // Modal de Vinculação Rápida de Chapa (ex: Arauco.Beige Matt)
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkingItem, setLinkingItem] = useState<BudgetItem | null>(null);
  const [selectedBrand, setSelectedBrand] = useState('Arauco');
  const [selectedLine, setSelectedLine] = useState('');
  const [selectedThickness, setSelectedThickness] = useState<'6mm' | '15mm' | '18mm' | '25mm'>('15mm');
  const [selectedAcessorioId, setSelectedAcessorioId] = useState('');
  const [selectedMaoDeObraId, setSelectedMaoDeObraId] = useState('');

  // Available brands and categories in catalog
  const brandsList = useMemo(() => {
    const list = Object.keys(catalog).filter(b => b !== 'Acessórios' && b !== 'Mão de Obra Fixa');
    return ['Acessórios', 'Mão de Obra Fixa', ...list];
  }, [catalog]);

  // Accessories list from Catálogo Geral de Materiais (database)
  const acessoriosList = useMemo(() => {
    const dbAcc = database
      .filter(p => p.category === 'FERRAGEM' || p.category === 'ACESSORIO' || p.category === 'FITA' || p.category === 'OUTROS')
      .map(p => ({
        id: p.code,
        name: p.description,
        size: '',
        price: p.unit_price,
        unit: p.unit || 'UN',
      }));

    if (dbAcc.length > 0) return dbAcc;

    const a = (catalog as any)['Acessórios'];
    return a && a.type === 'acessorios' ? a.items : [];
  }, [database, catalog]);

  const selectedAcessorio = useMemo(() => {
    return acessoriosList.find((a: { id: string }) => a.id === selectedAcessorioId) || acessoriosList[0];
  }, [acessoriosList, selectedAcessorioId]);

  // Mão de Obra Fixa list from catalog
  const maoDeObraList = useMemo(() => {
    const mo = catalog['Mão de Obra Fixa'];
    return mo && mo.type === 'maodeobra' ? (mo as MaoDeObraCatalog).items : [];
  }, [catalog]);

  const selectedMaoDeObra = useMemo(() => {
    return maoDeObraList.find(m => m.id === selectedMaoDeObraId) || maoDeObraList[0];
  }, [maoDeObraList, selectedMaoDeObraId]);

  // Lines for selected brand in modal
  const brandLines = useMemo(() => {
    const b = catalog[selectedBrand];
    return b && b.type === 'brand' ? (b as BrandCatalog).lines : [];
  }, [catalog, selectedBrand]);

  // Current selected board price and m2 cost in modal
  const currentBoardPrice = useMemo(() => {
    if (selectedBrand === 'Acessórios' || selectedBrand === 'Mão de Obra Fixa') return 0;
    const brandData = catalog[selectedBrand] as BrandCatalog;
    const lineObj = brandData?.lines?.find(l => l.name === selectedLine);
    if (!lineObj) return 0;
    return lineObj.prices[selectedThickness] || 0;
  }, [catalog, selectedBrand, selectedLine, selectedThickness]);

  const currentM2Cost = useMemo(() => {
    return chapaSalePrice(currentBoardPrice);
  }, [currentBoardPrice]);

  // Ocultar valores financeiros para atendimento com cliente na tela
  const [hideFinancialValues, setHideFinancialValues] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('df_orcamento_hide_values') === 'true';
  });

  const toggleHideFinancialValues = () => {
    setHideFinancialValues(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('df_orcamento_hide_values', String(next));
      }
      return next;
    });
  };

  // Contagem de itens semelhantes identificados no orçamento que precisam de preço
  const similarItemsCount = useMemo(() => {
    if (!linkingItem) return 0;
    const isAcc = selectedBrand === 'Acessórios';
    return items.filter(it => isSimilarPromobItem(
      { ...linkingItem, targetThickness: selectedThickness },
      it,
      isAcc,
      true
    )).length;
  }, [items, linkingItem, selectedBrand, selectedThickness]);

  // Handle File Upload (Aceita arquivos .xml, .pdf, .txt, .csv do Promob)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let parsedCount = 0;
    const allRawItems: any[] = [];
    let recognizedClient = '';
    let recognizedPhone = '';
    let recognizedProject = '';

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = file.name.toLowerCase();

        if (filename.endsWith('.pdf')) {
          const buffer = await file.arrayBuffer();
          const res = await parsePromobPDF(buffer);
          if (res.metadata.client_name && !recognizedClient) recognizedClient = res.metadata.client_name;
          if (res.metadata.client_phone && !recognizedPhone) recognizedPhone = res.metadata.client_phone;
          if (res.metadata.project_name && !recognizedProject) recognizedProject = res.metadata.project_name;
          allRawItems.push(...res.items);
          parsedCount += res.items.length;
        } else if (filename.endsWith('.xml')) {
          const content = await file.text();
          const res = parsePromobXML(content);
          const xmlItems = Array.isArray(res) ? res : res.items;
          if (!Array.isArray(res) && res.metadata) {
            if (res.metadata.client_name && !recognizedClient) recognizedClient = res.metadata.client_name;
            if (res.metadata.client_phone && !recognizedPhone) recognizedPhone = res.metadata.client_phone;
            if (res.metadata.project_name && !recognizedProject) recognizedProject = res.metadata.project_name;
          }
          allRawItems.push(...xmlItems);
          parsedCount += xmlItems.length;
        } else if (filename.endsWith('.txt') || filename.endsWith('.csv')) {
          const content = await file.text();
          const res = parsePromobTextTable(content);
          if (res.items.length > 0) {
            if (res.metadata.client_name && !recognizedClient) recognizedClient = res.metadata.client_name;
            if (res.metadata.client_phone && !recognizedPhone) recognizedPhone = res.metadata.client_phone;
            if (res.metadata.project_name && !recognizedProject) recognizedProject = res.metadata.project_name;
            allRawItems.push(...res.items);
            parsedCount += res.items.length;
          } else {
            const parsed = filename.endsWith('.csv') ? parseCSV(content) : parseTXT(content);
            allRawItems.push(...parsed);
            parsedCount += parsed.length;
          }
        } else {
          toast.error(`Formato não aceito: ${file.name}. Formatos aceitos: .xml, .pdf, .txt, .csv do Promob.`);
          continue;
        }
      }

      if (allRawItems.length === 0) {
        toast.warning('Nenhum item válido encontrado no(s) arquivo(s) selecionado(s).');
        setIsUploading(false);
        return;
      }

      if (recognizedClient) setClientName(recognizedClient);
      if (recognizedPhone) setClientPhone(recognizedPhone);
      if (recognizedProject) setProjectName(recognizedProject);

      // Preserva repetições, consumo em m² e preços de tabela do Promob com alta precisão
      const newBudgetItems: BudgetItem[] = allRawItems.map((raw, idx) => {
        const calculated = calculateItemPrice(
          {
            code: raw.code,
            description: raw.description,
            quantity: raw.quantity,
            unit: raw.unit,
            unit_cost: raw.unit_cost !== undefined ? raw.unit_cost : raw.table_price,
            margin: settings.margin,
            rep: raw.rep,
            unit_quantity: raw.unit_quantity,
            dimensions: raw.dimensions,
            category: raw.category,
            external_model: raw.external_model,
            table_price: raw.table_price,
            final_price: raw.final_price,
            is_parent_module: raw.is_parent_module,
          },
          database,
          settings,
          catalog
        );
        return {
          ...calculated,
          item_number: raw.item_number || idx + 1,
        };
      });

      setItems(newBudgetItems);
      onStartNewBudget();

      toast.success(`${parsedCount} itens importados do Promob com sucesso!`, {
        description: `Repetições de peças e consumo em m² lidos e calculados com exatidão matemática.`,
      });
    } catch (err: any) {
      console.error('Erro ao processar arquivo:', err);
      toast.error(`Erro na importação: ${err.message || 'Arquivo inválido'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Importar relatório colado do Promob (Ctrl+V / texto)
  const handlePasteImport = () => {
    if (!pastedText.trim()) {
      toast.error('Cole o conteúdo do relatório do Promob na caixa de texto.');
      return;
    }

    try {
      const res = parsePromobTextTable(pastedText);
      if (res.items.length === 0) {
        toast.warning('Nenhum item válido encontrado no texto colado. Verifique se o relatório contém as colunas Item, Qtd e Tabela.');
        return;
      }

      if (res.metadata.client_name) setClientName(res.metadata.client_name);
      if (res.metadata.client_phone) setClientPhone(res.metadata.client_phone);
      if (res.metadata.project_name) setProjectName(res.metadata.project_name);

      const newBudgetItems: BudgetItem[] = res.items.map((raw, idx) => {
        const calculated = calculateItemPrice(
          {
            code: raw.code,
            description: raw.description,
            quantity: raw.quantity,
            unit: raw.unit,
            unit_cost: raw.unit_cost !== undefined ? raw.unit_cost : raw.table_price,
            margin: settings.margin,
            rep: raw.rep,
            unit_quantity: raw.unit_quantity,
            dimensions: raw.dimensions,
            category: raw.category,
            external_model: raw.external_model,
            table_price: raw.table_price,
            final_price: raw.final_price,
            is_parent_module: raw.is_parent_module,
          },
          database,
          settings,
          catalog
        );
        return {
          ...calculated,
          item_number: raw.item_number || idx + 1,
        };
      });

      setItems(newBudgetItems);
      onStartNewBudget();
      setPasteModalOpen(false);
      setPastedText('');

      toast.success(`${res.items.length} itens importados do relatório colado!`, {
        description: `Cliente "${res.metadata.client_name || clientName}" e valores calculados com precisão.`,
      });
    } catch (err: any) {
      console.error('Erro ao processar texto colado:', err);
      toast.error(`Erro ao importar texto: ${err.message || 'Formato não reconhecido'}`);
    }
  };

  // Direct Save Budget without blocking modal
  const handleDirectSave = async () => {
    if (items.length === 0) {
      toast.warning('Adicione ou importe itens antes de salvar o orçamento.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onSaveBudget(
        clientName.trim() || 'Cliente DF Móveis',
        projectName.trim() || 'Orçamento',
        {
          clientId: selectedClientId !== 'custom' ? selectedClientId : undefined,
          clientPhone: clientPhone || undefined,
          projetoId: selectedProjectId !== 'custom' ? selectedProjectId : undefined,
        }
      );
      setIsSaving(false);
      setSaveSuccess(true);
      toast.success('Orçamento salvo com sucesso!', {
        description: `Vinculado a "${clientName}". Salvo na aba "Meus Orçamentos & Agrupados".`,
      });

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (e: any) {
      setIsSaving(false);
      console.error('Erro ao salvar orçamento:', e);
      toast.error('Não foi possível salvar no servidor. Seu rascunho foi mantido.');
    }
  };

  // Atualizar custo unitário manualmente inline
  const handleUpdateItemCost = (itemId: string, newCost: number) => {
    const safeCost = isNaN(newCost) || newCost < 0 ? 0 : newCost;
    const updated = items.map(it => {
      if (it.id === itemId) {
        return { ...it, ...calculateItemPrice(
          {
            code: it.code,
            description: it.description,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.original_unit || it.unit,
            unit_cost: safeCost,
            table_price: safeCost,
            rep: it.rep,
            unit_quantity: it.unit_quantity,
            dimensions: it.dimensions,
            category: it.category,
            is_parent_module: it.is_parent_module,
            margin: it.margin,
            margin_override: it.margin_override,
            price_origin: it.price_origin,
            price_unlinked: it.price_unlinked,
          },
          database,
          settings,
          catalog
        ), id: it.id, price_unlinked: it.price_unlinked };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings, catalog);
    setItems(res.items);
  };

  // Atualizar margem individual do item inline
  const handleUpdateItemMargin = (itemId: string, newMargin: number) => {
    const safeMargin = isNaN(newMargin) || newMargin < 0 ? 0 : newMargin;
    const updated = items.map(it => {
      if (it.id === itemId) {
        return { ...it, ...calculateItemPrice(
          {
            code: it.code,
            description: it.description,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.original_unit || it.unit,
            unit_cost: it.unit_cost,
            margin: safeMargin,
            rep: it.rep,
            unit_quantity: it.unit_quantity,
            dimensions: it.dimensions,
            category: it.category,
            is_parent_module: it.is_parent_module,
            margin_override: true,
            price_unlinked: it.price_unlinked,
          },
          database,
          settings,
          catalog
        ), id: it.id, price_unlinked: it.price_unlinked };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings, catalog);
    setItems(res.items);
  };

  // Atualizar repetição (número de peças) inline
  const handleUpdateItemRep = (itemId: string, newRep: number) => {
    const safeRep = isNaN(newRep) || newRep < 1 ? 1 : Math.round(newRep);
    const updated = items.map(it => {
      if (it.id === itemId) {
        const unitQty = it.unit_quantity !== undefined ? it.unit_quantity : (it.quantity / (it.rep || 1));
        const newTotalQty = Math.round((safeRep * unitQty + Number.EPSILON) * 10000) / 10000;
        const calculated = calculateItemPrice(
          {
            code: it.code,
            description: it.description,
            quantity: newTotalQty,
            unit: it.original_unit || it.unit,
            unit_cost: it.unit_cost,
            margin: it.margin,
            margin_override: it.margin_override,
            price_origin: it.price_origin,
            price_unlinked: it.price_unlinked,
            rep: safeRep,
            unit_quantity: unitQty,
            dimensions: it.dimensions,
            category: it.category,
            external_model: it.external_model,
            table_price: it.table_price,
            final_price: it.final_price,
            is_parent_module: it.is_parent_module,
            is_chapa: it.is_chapa,
            is_fita: it.is_fita,
            fita_metros: it.fita_metros,
          },
          database,
          settings,
          catalog
        );
        return {
          ...it,
          ...calculated,
          id: it.id,
          rep: safeRep,
          unit_quantity: unitQty,
          price_unlinked: it.price_unlinked,
        };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings, catalog);
    setItems(res.items);
  };

  // Atualizar quantidade unitária (m² por peça ou fração) inline
  const handleUpdateItemUnitQty = (itemId: string, newUnitQty: number) => {
    const safeUnitQty = isNaN(newUnitQty) || newUnitQty <= 0 ? 0.01 : newUnitQty;
    const updated = items.map(it => {
      if (it.id === itemId) {
        const rep = it.rep || 1;
        const newTotalQty = Math.round((rep * safeUnitQty + Number.EPSILON) * 10000) / 10000;
        const calculated = calculateItemPrice(
          {
            code: it.code,
            description: it.description,
            quantity: newTotalQty,
            unit: it.original_unit || it.unit,
            unit_cost: it.unit_cost,
            margin: it.margin,
            margin_override: it.margin_override,
            price_origin: it.price_origin,
            price_unlinked: it.price_unlinked,
            rep,
            unit_quantity: safeUnitQty,
            dimensions: it.dimensions,
            category: it.category,
            external_model: it.external_model,
            table_price: it.table_price,
            final_price: it.final_price,
            is_parent_module: it.is_parent_module,
            is_chapa: it.is_chapa,
            is_fita: it.is_fita,
            fita_metros: it.fita_metros,
          },
          database,
          settings,
          catalog
        );
        return {
          ...it,
          ...calculated,
          id: it.id,
          rep,
          unit_quantity: safeUnitQty,
          price_unlinked: it.price_unlinked,
        };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings, catalog);
    setItems(res.items);
  };

  // Atualizar consumo total de matéria-prima inline
  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    const safeQty = isNaN(newQty) || newQty <= 0 ? 1 : newQty;
    const updated = items.map(it => {
      if (it.id === itemId) {
        const rep = it.rep || 1;
        const unitQty = Math.round((safeQty / rep + Number.EPSILON) * 10000) / 10000;
        const calculated = calculateItemPrice(
          {
            code: it.code,
            description: it.description,
            quantity: safeQty,
            unit: it.original_unit || it.unit,
            unit_cost: it.unit_cost,
            margin: it.margin,
            margin_override: it.margin_override,
            price_origin: it.price_origin,
            price_unlinked: it.price_unlinked,
            rep,
            unit_quantity: unitQty,
            dimensions: it.dimensions,
            category: it.category,
            external_model: it.external_model,
            table_price: it.table_price,
            final_price: it.final_price,
            is_parent_module: it.is_parent_module,
            is_chapa: it.is_chapa,
            is_fita: it.is_fita,
            fita_metros: it.fita_metros,
          },
          database,
          settings,
          catalog
        );
        return {
          ...it,
          ...calculated,
          id: it.id,
          rep,
          unit_quantity: unitQty,
          price_unlinked: it.price_unlinked,
        };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings, catalog);
    setItems(res.items);
  };

  // Seleção de cliente cadastrado
  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    if (clientId === 'custom') {
      setSelectedProjectId('custom');
      return;
    }
    const foundClient = clientsList.find(c => c.id === clientId);
    if (foundClient) {
      setClientName(foundClient.nome);
      if (foundClient.telefone) setClientPhone(foundClient.telefone);
      // Se tiver projetos vinculados, seleciona o primeiro por padrão
      if (foundClient.projetos && foundClient.projetos.length > 0) {
        const firstProj = foundClient.projetos[0];
        setSelectedProjectId(firstProj.id);
        if (firstProj.nome) setProjectName(firstProj.nome);
      } else {
        setSelectedProjectId('custom');
      }
    }
  };

  // Seleção de projeto do cliente
  const handleSelectProject = (projId: string) => {
    setSelectedProjectId(projId);
    if (projId === 'custom') return;
    const foundClient = clientsList.find(c => c.id === selectedClientId);
    const foundProj = foundClient?.projetos?.find(p => p.id === projId);
    if (foundProj && foundProj.nome) {
      setProjectName(foundProj.nome);
    }
  };

  // Direct PDF Export
  const handleDirectExportPDF = () => {
    if (items.length === 0) {
      toast.warning('Adicione ou importe itens antes de gerar o PDF.');
      return;
    }

    try {
      generateBudgetPdf({
        clientName: clientName || 'Cliente DF Móveis',
        projectName: projectName || 'Móveis Planejados',
        items,
        settings,
        totals,
      });
      toast.success('Orçamento interno em PDF baixado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao exportar PDF.');
    }
  };

  // Open Link Modal for Item (Chapas, Acessórios ou Mão de Obra)
  const handleOpenLinkModal = (item: BudgetItem) => {
    setLinkingItem(item);
    const raw = `${item.code} ${item.description}`.toLowerCase();

    const isLabor = raw.includes('processo') ||
      raw.includes('porta reta') ||
      raw.includes('porta cava') ||
      raw.includes('frente cava') ||
      raw.includes('cava horizontal') ||
      raw.includes('usinagem') ||
      raw.includes('mao de obra') ||
      raw.includes('mão de obra') ||
      item.is_processo ||
      item.is_mao_de_obra ||
      (item.category || '').toLowerCase().includes('processo');

    if (isLabor && catalog['Mão de Obra Fixa']) {
      setSelectedBrand('Mão de Obra Fixa');
      const match = smartMatchMaoDeObra(item.code, item.description, catalog, database);
      if (match.matched && match.code) {
        setSelectedMaoDeObraId(match.code);
      } else if (maoDeObraList.length > 0) {
        setSelectedMaoDeObraId(maoDeObraList[0].id);
      }
    } else {
      // Se for acessório ou ferragem conhecida:
      const isAccessory = raw.includes('dobradica') ||
        raw.includes('corredica') ||
        raw.includes('telescopica') ||
        raw.includes('pistao') ||
        raw.includes('puxador') ||
        raw.includes('ponteira') ||
        raw.includes('cabideiro') ||
        raw.includes('rodizio') ||
        raw.includes('lixeira') ||
        raw.includes('tabua') ||
        raw.includes('parafuso');

      if (isAccessory) {
        setSelectedBrand('Acessórios');
        const match = smartMatchAccessory(item.code, item.description, item.dimensions, catalog, database);
        if (match.matched && match.code) {
          setSelectedAcessorioId(match.code);
        } else if (acessoriosList.length > 0) {
          setSelectedAcessorioId(acessoriosList[0].id);
        }
      } else {
        // É uma Chapa de MDF / MDP
        const smart = smartMatchPromobChapa(item.code, item.description, catalog);
        const foundBrand = smart.brand || brandsList.find(b => catalog[b]?.type === 'brand' && raw.includes(b.toLowerCase()));
        const targetBrand = foundBrand && catalog[foundBrand] ? foundBrand : (catalog['Arauco'] ? 'Arauco' : (brandsList.find(b => catalog[b]?.type === 'brand') || 'Arauco'));
        setSelectedBrand(targetBrand);
        setSelectedThickness(smart.thickness || '15mm');

        const b = catalog[targetBrand] as BrandCatalog;
        if (b && b.lines) {
          setSelectedLine(smart.line || b.lines[0]?.name || '');
        }
      }
    }

    setLinkModalOpen(true);
  };

  // Puxar valor da tabela de preço diretamente ao clicar no botão "Trazer Preço" de um item
  const handleConsultarVincularPreco = (item: BudgetItem) => {
    if (isEletrodomestico(item.code, item.description, item.category)) {
      toast.info('Eletrodomésticos são informativos / fornecidos pelo cliente e não possuem cobrança.');
      return;
    }

    // 1. Tenta correspondência inteligente direta via resolveItemPrice (chapas, acessórios ou insumos)
    const res = resolveItemPrice(item, catalog, database);
    if (res.matched && res.unit_cost > 0) {
      const updated = items.map(it => {
        if (it.id === item.id) {
          const calculated = calculateItemPrice(
            {
              code: it.code,
              description: it.description,
              quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
              unit: res.unit || it.original_unit || it.unit,
              unit_cost: res.unit_cost,
              margin: it.margin,
            margin_override: it.margin_override,
            price_origin: it.price_origin,
              rep: it.rep,
              unit_quantity: it.unit_quantity,
              dimensions: it.dimensions,
              category: it.category,
              external_model: it.external_model,
              table_price: res.unit_cost,
              final_price: it.final_price,
              is_parent_module: false,
              is_chapa: res.source === 'catalog_chapa' || res.source === 'mdf_padrao' || it.is_chapa,
              is_fita: it.is_fita,
              fita_metros: it.fita_metros,
            },
            database,
            settings,
            catalog
          );

          return {
            ...it,
            ...calculated,
            id: it.id,
            code: it.code,
            item_number: it.item_number,
            rep: it.rep,
            unit_quantity: it.unit_quantity,
            dimensions: it.dimensions,
            category: it.category,
            external_model: it.external_model,
            is_parent_module: false,
            price_unlinked: false,
            found: true,
            table_price: res.unit_cost,
            unit_cost: res.unit_cost,
          };
        }
        return it;
      });

      const recalculated = recalculateBudget(updated, database, settings, catalog);
      setItems(recalculated.items);

      toast.success(`Preço ${res.unit_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vinculado da tabela!`, {
        description: res.matched_name || res.description,
      });
      return;
    }

    // 2. Se não houver correspondência 100% automática, abre o modal de consulta para o usuário escolher
    handleOpenLinkModal(item);
    toast.info('Consulte e selecione o material correspondente para trazer o preço.');
  };

  // Vincular automaticamente todas as peças que possuem correspondência na tabela DF Móveis
  const handlePullAllPricesFromTable = () => {
    let chapaCount = 0;
    let acessorioCount = 0;
    let prodCount = 0;

    const updated = items.map(it => {
      // Pula eletrodomésticos e módulos pais que não possuam preço definido
      if (isEletrodomestico(it.code, it.description, it.category)) return it;
      if (it.is_parent_module && (!it.table_price || it.table_price <= 0)) return it;

      const res = resolveItemPrice(it, catalog, database);
      if (res.matched && res.unit_cost > 0) {
        if (res.source === 'catalog_chapa' || res.source === 'mdf_padrao') {
          chapaCount++;
        } else if (res.source === 'catalog_acessorio') {
          acessorioCount++;
        } else {
          prodCount++;
        }

        const calculated = calculateItemPrice(
          {
            code: it.code,
            description: it.description,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: res.unit || it.original_unit || it.unit,
            unit_cost: res.unit_cost,
            margin: it.margin,
            margin_override: it.margin_override,
            price_origin: it.price_origin,
            rep: it.rep,
            unit_quantity: it.unit_quantity,
            dimensions: it.dimensions,
            category: it.category,
            external_model: it.external_model,
            table_price: res.unit_cost,
            final_price: it.final_price,
            is_parent_module: false,
            is_chapa: res.source === 'catalog_chapa' || res.source === 'mdf_padrao' || it.is_chapa,
            is_fita: it.is_fita,
            fita_metros: it.fita_metros,
          },
          database,
          settings,
          catalog
        );

        return {
          ...it,
          ...calculated,
          id: it.id,
          code: it.code,
          item_number: it.item_number,
          rep: it.rep,
          unit_quantity: it.unit_quantity,
          dimensions: it.dimensions,
          category: it.category,
          external_model: it.external_model,
          is_parent_module: false,
          price_unlinked: false,
          found: true,
          table_price: res.unit_cost,
          unit_cost: res.unit_cost,
        };
      }

      return it;
    });

    const totalMatched = chapaCount + acessorioCount + prodCount;
    if (totalMatched > 0) {
      const res = recalculateBudget(updated, database, settings, catalog);
      setItems(res.items);

      const parts = [];
      if (chapaCount > 0) parts.push(`${chapaCount} chapa(s)`);
      if (acessorioCount > 0) parts.push(`${acessorioCount} acessório(s)/ferragem`);
      if (prodCount > 0) parts.push(`${prodCount} produto(s) do banco`);

      toast.success(`${totalMatched} itens vinculados com preços da tabela DF Móveis!`, {
        description: `${parts.join(', ')} atualizados com sucesso no orçamento.`,
      });
    } else {
      toast.info('Nenhuma chapa ou acessório pendente com correspondência foi localizado na tabela de preços.');
    }
  };

  // Apply Linker to single item or all similar items
  const handleApplyLink = (applyToAllSimilar: boolean) => {
    if (!linkingItem) return;

    if (selectedBrand === 'Acessórios') {
      if (!selectedAcessorio) return;
      const unitCost = selectedAcessorio.price;
      let matchedCount = 0;

      const updated = items.map(it => {
        const isTarget = applyToAllSimilar
          ? isSimilarPromobItem(linkingItem, it, true)
          : it.id === linkingItem.id;

        if (isTarget) {
          matchedCount++;
          const baseDesc = it.description.replace(/\s*\([^)]*\)\s*$/, '').trim();
          const newDesc = `${baseDesc} (${selectedAcessorio.name})`;

          const calculated = calculateItemPrice(
            {
              code: it.code,
              description: newDesc,
              quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
              unit: selectedAcessorio.unit || it.original_unit || it.unit || 'UN',
              unit_cost: unitCost,
              margin: it.margin,
            margin_override: it.margin_override,
            price_origin: it.price_origin,
              table_price: unitCost,
              rep: it.rep,
              unit_quantity: it.unit_quantity,
              dimensions: it.dimensions,
              category: it.category || 'Acessórios',
              external_model: it.external_model,
              is_parent_module: false,
            },
            database,
            settings,
            catalog
          );
          return {
            ...it,
            ...calculated,
            id: it.id,
            code: it.code,
            item_number: it.item_number,
            description: newDesc,
            rep: it.rep,
            unit_quantity: it.unit_quantity,
            dimensions: it.dimensions,
            category: it.category || 'Acessórios',
            external_model: it.external_model,
            is_parent_module: false,
            price_unlinked: false,
            found: true,
            table_price: unitCost,
            unit_cost: unitCost,
          };
        }
        return it;
      });

      const res = recalculateBudget(updated, database, settings, catalog);
      setItems(res.items);
      setLinkModalOpen(false);

      if (applyToAllSimilar) {
        toast.success(`Vinculado "${selectedAcessorio.name}" a ${matchedCount} itens semelhantes!`, {
          description: `Preço de custo definido como ${unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
        });
      } else {
        toast.success(`Preço ${unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vinculado de ${selectedAcessorio.name}!`);
      }
      return;
    }

    if (selectedBrand === 'Mão de Obra Fixa') {
      if (!selectedMaoDeObra) return;
      const unitCost = selectedMaoDeObra.price;
      let matchedCount = 0;

      const updated = items.map(it => {
        const isTarget = applyToAllSimilar
          ? isSimilarPromobItem(linkingItem, it, false)
          : it.id === linkingItem.id;

        if (isTarget) {
          matchedCount++;
          const baseDesc = it.description.replace(/\s*\([^)]*\)\s*$/, '').trim();
          const newDesc = `${baseDesc} (${selectedMaoDeObra.name})`;

          const calculated = calculateItemPrice(
            {
              code: it.code,
              description: newDesc,
              quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
              unit: selectedMaoDeObra.unit || it.original_unit || it.unit || 'UN',
              unit_cost: unitCost,
              margin: it.margin,
            margin_override: it.margin_override,
            price_origin: it.price_origin,
              table_price: unitCost,
              rep: it.rep,
              unit_quantity: it.unit_quantity,
              dimensions: it.dimensions,
              category: 'Processo de Fabricação',
              external_model: it.external_model,
              is_parent_module: false,
              is_processo: true,
              is_mao_de_obra: true,
            },
            database,
            settings,
            catalog
          );
          return {
            ...it,
            ...calculated,
            id: it.id,
            code: it.code,
            item_number: it.item_number,
            description: newDesc,
            rep: it.rep,
            unit_quantity: it.unit_quantity,
            dimensions: it.dimensions,
            category: 'Processo de Fabricação',
            external_model: it.external_model,
            is_parent_module: false,
            is_processo: true,
            is_mao_de_obra: true,
            price_unlinked: false,
            found: true,
            table_price: unitCost,
            unit_cost: unitCost,
          };
        }
        return it;
      });

      const res = recalculateBudget(updated, database, settings, catalog);
      setItems(res.items);
      setLinkModalOpen(false);

      if (applyToAllSimilar) {
        toast.success(`Vinculado "${selectedMaoDeObra.name}" a ${matchedCount} processos semelhantes!`, {
          description: `Preço de custo definido como ${unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
        });
      } else {
        toast.success(`Preço ${unitCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vinculado de ${selectedMaoDeObra.name}!`);
      }
      return;
    }

    // Caso de Chapa
    const brandData = catalog[selectedBrand] as BrandCatalog;
    const lineObj = brandData?.lines?.find(l => l.name === selectedLine);
    if (!lineObj) return;

    const boardPrice = lineObj.prices[selectedThickness] || 0;
    const m2Cost = chapaSalePrice(boardPrice, lineObj.width * lineObj.height);

    if (boardPrice <= 0) { toast.error('Esta espessura não tem preço cadastrado.'); return; }

    let matchedCount = 0;

    const updated = items.map(it => {
      const isTarget = applyToAllSimilar
        ? isSimilarPromobItem({ ...linkingItem, targetThickness: selectedThickness }, it, false)
        : it.id === linkingItem.id;

      if (isTarget) {
        matchedCount++;
        const baseDesc = it.description.replace(/\s*\[[^\]]+\]\s*$/, '').trim();
        const newDesc = `${baseDesc} [${selectedBrand} - ${lineObj.name} ${selectedThickness}]`;

        const isCaixaUnit = (it.unit || '').toUpperCase() === 'UN' && it.description.toLowerCase().includes('caixa');
        const effectiveUnitCost = (isCaixaUnit && it.table_price && it.table_price > 0) ? it.table_price : m2Cost;

        const calculated = calculateItemPrice(
          {
            code: it.code,
            description: newDesc,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.original_unit || it.unit,
            unit_cost: effectiveUnitCost,
            margin: it.margin,
            margin_override: it.margin_override,
            price_origin: it.price_origin,
            table_price: effectiveUnitCost,
            rep: it.rep,
            unit_quantity: it.unit_quantity,
            dimensions: it.dimensions,
            category: it.category,
            external_model: it.external_model,
            is_parent_module: false,
            is_chapa: !isCaixaUnit,
          },
          database,
          settings,
          catalog
        );
        return {
          ...it,
          ...calculated,
          id: it.id,
          code: it.code,
          item_number: it.item_number,
          description: newDesc,
          rep: it.rep,
          unit_quantity: it.unit_quantity,
          dimensions: it.dimensions,
          category: it.category,
          external_model: it.external_model,
          is_parent_module: false,
          price_unlinked: false,
          found: true,
          table_price: effectiveUnitCost,
          unit_cost: effectiveUnitCost,
        };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings, catalog);
    setItems(res.items);
    setLinkModalOpen(false);

    if (applyToAllSimilar) {
      toast.success(`Vinculado a ${matchedCount} peças semelhantes (${selectedThickness})!`, {
        description: `Preço de custo definido como ${m2Cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m².`,
      });
    } else {
      toast.success(`Preço ${m2Cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m² vinculado de ${selectedBrand} - ${lineObj.name}!`);
    }
  };

  // Add Manual Item
  const handleAddManualItem = () => {
    if (!newItemCode.trim() && !newItemDesc.trim()) {
      toast.error('Informe ao menos o código ou descrição do item.');
      return;
    }

    const costNumber = newItemCost ? parseFloat(newItemCost.replace(',', '.')) : undefined;

    const calculated = calculateItemPrice(
      {
        code: newItemCode.trim(),
        description: newItemDesc.trim() || newItemCode.trim(),
        quantity: newItemQty || 1,
        unit: newItemUnit,
        unit_cost: costNumber,
        margin: settings.margin,
      },
      database,
      settings,
      catalog
    );

    const updated = [...items, { ...calculated, item_number: items.length + 1 }];
    const res = recalculateBudget(updated, database, settings, catalog);
    setItems(res.items);

    setNewItemCode('');
    setNewItemDesc('');
    setNewItemQty(1);
    setNewItemUnit('M2');
    setNewItemCost('');
    setAddItemModalOpen(false);
    toast.success('Item adicionado ao orçamento!');
  };

  // Remove Item
  const handleRemoveItem = (id: string) => {
    const updated = items.filter(it => it.id !== id);
    const res = recalculateBudget(updated, database, settings, catalog);
    setItems(res.items);
    toast.info('Item removido.');
  };

  // Clear Budget
  const handleClearBudget = () => {
    if (confirm('Deseja limpar todos os itens do orçamento atual?')) {
      setItems([]);
      onStartNewBudget();
      toast.info('Orçamento limpo.');
    }
  };

  // Filtered items list
  const filteredItems = useMemo(() => {
    let result = items;

    if (itemsViewFilter === 'leaves') {
      result = result.filter(it => !it.is_parent_module);
    }

    if (!filterSearch.trim()) return result;
    const term = filterSearch.toLowerCase();
    return result.filter(
      it =>
        it.code.toLowerCase().includes(term) ||
        it.description.toLowerCase().includes(term) ||
        (it.category && it.category.toLowerCase().includes(term)) ||
        (it.dimensions && it.dimensions.toLowerCase().includes(term))
    );
  }, [items, filterSearch, itemsViewFilter]);

  // Agrupamento hierárquico por Móvel / Módulo
  const moduleGroups = useMemo(() => {
    return groupItemsByModule(items);
  }, [items]);

  const filteredModuleGroups = useMemo(() => {
    if (!filterSearch.trim()) return moduleGroups;
    const term = filterSearch.toLowerCase();
    return moduleGroups
      .map(g => {
        const matchesGroup =
          g.name.toLowerCase().includes(term) ||
          (g.category && g.category.toLowerCase().includes(term)) ||
          (g.dimensions && g.dimensions.toLowerCase().includes(term));
        const matchingItems = g.items.filter(
          it =>
            it.code.toLowerCase().includes(term) ||
            it.description.toLowerCase().includes(term) ||
            (it.dimensions && it.dimensions.toLowerCase().includes(term))
        );
        if (matchesGroup) return g;
        if (matchingItems.length > 0) {
          return {
            ...g,
            items: matchingItems,
          };
        }
        return null;
      })
      .filter(Boolean) as ModuleGroup[];
  }, [moduleGroups, filterSearch]);

  const handleToggleModuleExpand = (groupId: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [groupId]: prev[groupId] === false ? true : false,
    }));
  };

  const handleExpandAllModules = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    moduleGroups.forEach(g => {
      next[g.id] = expand;
    });
    setExpandedModules(next);
  };

  const renderItemRow = (item: BudgetItem, index: number) => {
    const isAppliance = isEletrodomestico(item.code, item.description, item.category);
    const isCaixa = item.description.toLowerCase().includes('caixa');

    return (
      <tr
        key={item.id}
        className="group border-b border-stone-100 hover:bg-stone-50/80 transition-colors"
      >
        <td className="py-2.5 pl-3 pr-1 text-center font-mono text-[11px] font-medium text-stone-400">
          {item.item_number || index + 1}
        </td>

        <td className="px-2.5 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-slate-900 truncate max-w-[170px]" title={item.code}>
              {item.code}
            </span>

            {isAppliance ? (
              <span className="inline-flex items-center rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500 border border-stone-200">
                Eletro (Informativo)
              </span>
            ) : item.unit_cost === 0 || !item.found || item.price_unlinked ? (
              <button
                onClick={() => handleConsultarVincularPreco(item)}
                className="inline-flex items-center gap-1 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-700 hover:bg-[#c92031]/10 hover:text-[#c92031] hover:border-[#c92031]/30 border border-stone-200 transition-colors shrink-0 shadow-2xs"
                title="Trazer preço da tabela para este item"
              >
                <Link2 className="h-3 w-3 text-[#c92031]" />
                Trazer Preço
              </button>
            ) : (
              <button
                onClick={() => handleOpenLinkModal(item)}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors shrink-0"
                title="Item vinculado à tabela de preços. Clique para consultar ou trocar de linha."
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                <span>Vinculado</span>
              </button>
            )}
          </div>
        </td>

        <td className="px-3 py-2.5">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-xs text-slate-800 leading-snug">{item.description}</span>
              {item.is_parent_module && !isCaixa && !isAppliance && (
                <span className="inline-flex items-center rounded border border-amber-300/80 bg-amber-50 px-1.5 py-0.2 text-[9px] font-semibold text-amber-800">
                  Módulo Promob
                </span>
              )}
              {isAppliance && (
                <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.2 text-[9px] font-medium text-blue-700">
                  Sem Cobrança / Equipamento
                </span>
              )}
              {item.category && !isAppliance && (
                <span className="inline-flex items-center rounded border border-stone-200 bg-stone-100 px-1.5 py-0.2 text-[9px] font-medium text-stone-600">
                  {item.category}
                </span>
              )}
              {item.external_model && (
                <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.2 text-[9px] font-medium text-emerald-700">
                  {item.external_model}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] text-stone-500">
              {item.dimensions && (
                <span 
                  className="font-mono text-stone-700 bg-stone-100 border border-stone-200/60 px-1.5 py-0.5 rounded-sm"
                  title={`Dimensões em milímetros: ${item.dimensions} mm (${formatDimensionsCm(item.dimensions)})`}
                >
                  {item.dimensions} mm <span className="text-[9px] text-stone-600 font-normal">({formatDimensionsCm(item.dimensions)})</span>
                </span>
              )}
              {!isAppliance && item.found && !item.price_unlinked && (
                <span className="text-emerald-700 font-medium flex items-center gap-0.5">
                  ✓ Na Tabela
                </span>
              )}
              {item.is_fita && item.fita_metros && (
                <span className="font-mono text-indigo-700 bg-indigo-50 border border-indigo-200 px-1 py-0.2 rounded">
                  Fita: {item.fita_metros.toFixed(2)}m
                </span>
              )}
              {item.is_parent_module && !isCaixa && !isAppliance && (!item.table_price || item.table_price <= 0) && (!item.unit_cost || item.unit_cost <= 0) && (
                <span className="text-amber-700 italic text-[10px]">
                  (Composto pelas peças de corte abaixo)
                </span>
              )}
            </div>
          </div>
        </td>

        {/* Repetição de Peças (coluna Rep do Promob) */}
        <td className="px-2 py-2 text-center">
          <BudgetNumberInput
            type="number"
            step="1"
            min="1"
            value={item.rep || 1}
            onCommit={value => handleUpdateItemRep(item.id, value)}
            className="h-7 w-12 text-center text-xs font-bold text-slate-800 px-1 py-0 border-stone-200 mx-auto bg-stone-50/70 hover:bg-white focus:bg-white focus:ring-1 focus:ring-[#c92031]/30 focus:border-[#c92031] rounded-md transition-all"
            title="Alterar repetição de peças"
          />
        </td>

        {/* Quantidade Unitária (M² ou UN por peça) */}
        <td className="px-2 py-2 text-center">
          <BudgetNumberInput
            type="number"
            step="any"
            min="0.001"
            value={item.unit_quantity !== undefined ? item.unit_quantity : item.quantity}
            onCommit={value => handleUpdateItemUnitQty(item.id, value)}
            className="h-7 w-16 text-center text-xs font-mono text-stone-700 px-1 py-0 border-stone-200 mx-auto bg-white focus:ring-1 focus:ring-[#c92031]/30 focus:border-[#c92031] rounded-md transition-all"
            title="Matéria-prima unitária por peça (m² ou UN)"
          />
        </td>

        {/* Consumo Total Efetivo de Matéria-prima */}
        <td className="px-2 py-2 text-center">
          <BudgetNumberInput
            type="number"
            step="any"
            min="0.001"
            value={item.quantity}
            onCommit={value => handleUpdateItemQty(item.id, value)}
            className="h-7 w-16 text-center text-xs font-bold text-slate-900 px-1 py-0 border-stone-200 mx-auto bg-stone-50/70 hover:bg-white focus:bg-white focus:ring-1 focus:ring-[#c92031]/30 focus:border-[#c92031] rounded-md transition-all"
            title="Consumo total de matéria-prima (Rep × Qtd Unit)"
          />
        </td>

        <td className="px-2 py-2.5 text-center">
          <span className="rounded bg-stone-100 border border-stone-200/60 px-1.5 py-0.5 font-medium text-stone-600 text-[10px]">
            {item.unit}
          </span>
        </td>

        {/* Custo Unitário Manual Inline */}
        <td className="px-3 py-2 text-right">
          {hideFinancialValues ? (
            <span className="text-stone-400 font-mono text-xs select-none">••••••</span>
          ) : isAppliance ? (
            <span className="text-stone-400 font-mono text-xs select-none tabular-nums">—</span>
          ) : (
            <div className="flex items-center justify-end gap-1">
              <span className="text-stone-400 text-[10px] font-medium font-mono">R$</span>
              <BudgetNumberInput
                type="number"
                step="0.01"
                min="0"
                value={item.unit_cost === 0 ? '' : item.unit_cost}
                onCommit={value => handleUpdateItemCost(item.id, value)}
                placeholder="0,00"
                className={`h-7 w-24 text-right text-xs font-mono font-bold px-2 py-0 border rounded-md transition-all ${
                  item.unit_cost === 0
                    ? 'border-amber-300 bg-amber-50/60 text-amber-900 placeholder:text-amber-400 focus:border-amber-400'
                    : 'border-stone-200 text-slate-900 bg-white focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30'
                }`}
                title="Custo unitário da matéria-prima"
              />
            </div>
          )}
        </td>

        {/* Total Custo da Peça/Linha */}
        <td className="px-3 py-2.5 text-right font-mono tabular-nums">
          {hideFinancialValues ? (
            <span className="font-bold text-stone-400 text-xs select-none">••••••</span>
          ) : isAppliance ? (
            <>
              <span className="font-bold text-stone-400 text-xs block select-none">—</span>
              <span className="text-[10px] text-stone-400 font-normal block">Sem Custo</span>
            </>
          ) : (
            <span className="font-bold text-slate-900 text-xs block">
              {item.total_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          )}
        </td>

        <td className="py-2.5 pl-2 pr-4 text-center">
          <div className="flex items-center justify-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
            {!isAppliance && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (item.found && !item.price_unlinked) {
                    setItems(prev => recalculateBudget(prev.map(it => it.id === item.id
                      ? { ...it, price_unlinked: true, found: false, unit_cost: 0 }
                      : it), database, settings, catalog).items);
                    toast.success('Preço desvinculado.');
                  } else handleConsultarVincularPreco(item);
                }}
                className="h-7 w-7 text-stone-600 hover:text-slate-900 hover:bg-stone-100 rounded-md"
                title={item.found && !item.price_unlinked ? "Desvincular preço da tabela" : "Vincular preço da tabela"}
              >
                {item.found && !item.price_unlinked ? <Unlink className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveItem(item.id)}
              className="h-7 w-7 text-stone-400 hover:bg-red-50 hover:text-red-600 rounded-md"
              title="Remover Item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {/* Resumo Financeiro Compacto & Discreto */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tracking-wide text-stone-700">
              Resumo Executivo do Orçamento
            </span>
            {hideFinancialValues && (
              <span className="inline-flex items-center rounded-md border border-amber-300/80 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                Modo Apresentação (Valores Ocultos)
              </span>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleHideFinancialValues}
            className="h-7 gap-1.5 px-2.5 text-xs text-stone-600 hover:text-slate-900 hover:bg-stone-100 border border-stone-200 bg-white shadow-2xs rounded-lg transition-colors cursor-pointer"
            title={hideFinancialValues ? "Exibir valores financeiros" : "Ocultar valores do cliente"}
          >
            {hideFinancialValues ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[11px] font-medium text-stone-700">Exibir Valores</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-stone-400" />
                <span className="text-[11px] font-medium text-stone-700">Ocultar do Cliente</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {/* 1. Custo Total dos Materiais */}
          <div className="group relative rounded-xl border border-stone-200/90 bg-white/95 p-3 shadow-2xs transition-all hover:border-stone-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-stone-500" />
                <span className="text-[11px] font-semibold text-stone-700">Custo Total de Materiais</span>
              </div>
              <span className="font-mono text-[10px] text-stone-400">{totals.items_count} peças</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="font-mono text-base sm:text-lg font-bold tracking-tight text-stone-800 tabular-nums">
                {hideFinancialValues
                  ? '••••••••'
                  : totals.total_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <span className="text-[10px] text-stone-400 font-medium">Soma de Custo</span>
            </div>
          </div>

          {/* 2. Lucro Bruto Estimado (+200% somado no final) */}
          <div className="group relative rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3 shadow-2xs transition-all hover:border-emerald-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                <span className="text-[11px] font-bold text-emerald-800">Lucro Bruto Estimado</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded">
                +{settings.margin}% no Final
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="font-mono text-base sm:text-lg font-bold tracking-tight text-emerald-700 tabular-nums">
                {hideFinancialValues
                  ? '••••••••'
                  : totals.gross_profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <span className="text-[10px] text-emerald-600 font-medium">Margem</span>
            </div>
          </div>

          {/* 3. Valor Final de Venda */}
          <div className="group relative rounded-xl border border-stone-200/90 bg-white/95 p-3 shadow-2xs transition-all hover:border-stone-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c92031]" />
                <span className="text-[11px] font-bold text-slate-900">Valor Final de Venda</span>
              </div>
              <span className="font-mono text-[10px] text-stone-400">Total Proposta</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="font-mono text-base sm:text-lg font-bold tracking-tight text-slate-900 tabular-nums">
                {hideFinancialValues
                  ? '••••••••'
                  : totals.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
              <span className="text-[10px] text-stone-500 font-medium">Custo + Lucro + Adic.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quadrante Cliente, Ambiente e Projeto */}
      <div className="rounded-xl border border-stone-200/90 bg-white/95 p-4 shadow-2xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between border-b border-stone-100 pb-2.5 gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#17191d] text-[#cbb27a]">
              <User className="h-3.5 w-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block leading-tight">
                Dados do Cliente & Ambiente
              </span>
              <span className="text-[11px] text-stone-500">
                Vinculação com a carteira ou atendimento avulso
              </span>
            </div>
          </div>
          {selectedClientId !== 'custom' && (
            <Badge className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
              <Check className="mr-1 h-3 w-3" /> Cliente Conectado
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 items-end">
          {/* Cliente Seletor */}
          <div className="md:col-span-4 space-y-1">
            <Label className="text-xs font-medium text-stone-600">
              Cliente Cadastrado
            </Label>
            <Select value={selectedClientId} onValueChange={handleSelectClient}>
              <SelectTrigger className="h-9 text-xs font-medium bg-stone-50/60 border-stone-200 hover:bg-white focus:bg-white rounded-lg">
                <SelectValue placeholder="Selecione ou digite manual..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom" className="font-semibold text-slate-700">
                  ✏️ Manual / Cliente Avulso
                </SelectItem>
                {clientsList.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs font-medium">
                    👤 {c.nome} {c.telefone ? `(${c.telefone})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Nome do Cliente (Exibição / Edição) */}
          <div className="md:col-span-3 space-y-1">
            <Label className="text-xs font-medium text-stone-600">
              Nome do Cliente
            </Label>
            <Input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Nome do cliente..."
              className="h-9 text-xs font-semibold text-slate-900 bg-white border-stone-200 focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30 rounded-lg"
            />
          </div>

          {/* Projeto / Ambiente */}
          <div className="md:col-span-3 space-y-1">
            <Label className="text-xs font-medium text-stone-600">
              Ambiente / Projeto
            </Label>
            {selectedClientId !== 'custom' &&
            clientsList.find(c => c.id === selectedClientId)?.projetos &&
            (clientsList.find(c => c.id === selectedClientId)?.projetos?.length || 0) > 0 ? (
              <Select value={selectedProjectId} onValueChange={handleSelectProject}>
                <SelectTrigger className="h-9 text-xs font-medium bg-stone-50/60 border-stone-200 hover:bg-white focus:bg-white rounded-lg">
                  <SelectValue placeholder="Selecione o projeto..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom" className="font-semibold text-slate-700">
                    📂 Novo Ambiente / Avulso
                  </SelectItem>
                  {clientsList
                    .find(c => c.id === selectedClientId)
                    ?.projetos?.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        📐 {p.nome || 'Projeto sem nome'} {p.status ? `(${p.status})` : ''}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="Ex: Cozinha Planejada + Ilha"
                className="h-9 text-xs font-medium text-slate-800 bg-white border-stone-200 focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30 rounded-lg"
              />
            )}
          </div>

          {/* Action Buttons: Direct Save & PDF */}
          <div className="md:col-span-2 flex items-center gap-1.5 justify-end">
            <Button
              onClick={handleDirectExportPDF}
              disabled={items.length === 0}
              variant="outline"
              size="sm"
              className="h-9 border-[#cbb27a]/60 bg-[#cbb27a]/10 text-[#886e35] hover:bg-[#cbb27a]/20 text-xs font-semibold px-3 rounded-lg shadow-2xs"
              title="Baixar proposta em PDF"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              PDF Comercial
            </Button>

            <Button
              onClick={handleDirectSave}
              disabled={items.length === 0 || isSaving}
              size="sm"
              className={`h-9 font-semibold text-xs px-3.5 rounded-lg transition-all duration-300 shadow-2xs ${
                saveSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                  : 'bg-[#c92031] text-white hover:bg-[#aa1726]'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Salvo!
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Input descritivo manual de ambiente caso tenha selecionado um projeto específico ou queira customizar */}
        {selectedClientId !== 'custom' && selectedProjectId !== 'custom' && (
          <div className="flex items-center gap-2 pt-1 text-[11px] text-stone-600">
            <FolderKanban className="h-3.5 w-3.5 text-stone-500" />
            <span>Nome descritivo do ambiente:</span>
            <Input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Ex: Cozinha Integrada"
              className="h-7 text-xs w-72 bg-white border-stone-200 rounded-md"
            />
          </div>
        )}
      </div>

      {/* Workbench Toolbar: Import & Chapa Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200/90 bg-white/95 p-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xml,.pdf,.txt,.csv"
            multiple
            className="hidden"
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-[#17191d] text-xs text-white hover:bg-stone-800 rounded-lg shadow-2xs h-9 px-3.5 font-medium"
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {isUploading ? 'Processando Arquivo...' : 'Importar Promob (XML / PDF)'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setPasteModalOpen(true)}
            className="border-stone-200 bg-white text-stone-700 text-xs hover:bg-stone-50 rounded-lg h-9 px-3 shadow-2xs font-medium"
          >
            <ClipboardPaste className="mr-1.5 h-3.5 w-3.5 text-stone-500" />
            Colar Relatório
          </Button>

          <Button
            variant="outline"
            onClick={() => setAddItemModalOpen(true)}
            className="border-stone-200 bg-white text-stone-700 text-xs hover:bg-stone-50 rounded-lg h-9 px-3 shadow-2xs font-medium"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5 text-stone-500" />
            Adicionar Item Manual
          </Button>

          {items.length > 0 && (
            <Button
              variant="outline"
              onClick={handlePullAllPricesFromTable}
              className="border-[#c92031]/25 bg-[#c92031]/5 text-xs font-semibold text-[#c92031] hover:bg-[#c92031]/10 rounded-lg h-9 px-3 shadow-2xs"
              title="Percorre os itens e traz o valor da tabela de preço para todas as chapas reconhecidas"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-[#c92031]" />
              Trazer Preços da Tabela
            </Button>
          )}

          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearBudget}
              className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 rounded-lg h-9 px-2.5"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>

        {/* Chapa Conversion Controls & View Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-stone-200 bg-stone-100/90 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setItemsViewFilter('grouped')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    itemsViewFilter === 'grouped'
                      ? 'bg-white shadow-2xs text-slate-900 font-semibold'
                      : 'text-stone-600 hover:text-slate-900'
                  }`}
                >
                  <Box className="h-3.5 w-3.5 text-[#886e35]" />
                  <span>Por Móvel ({moduleGroups.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setItemsViewFilter('leaves')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    itemsViewFilter === 'leaves'
                      ? 'bg-white shadow-2xs text-slate-900 font-semibold'
                      : 'text-stone-600 hover:text-slate-900'
                  }`}
                >
                  <span>Peças de Corte ({items.filter(it => !it.is_parent_module).length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setItemsViewFilter('all')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    itemsViewFilter === 'all'
                      ? 'bg-white shadow-2xs text-slate-900 font-semibold'
                      : 'text-stone-600 hover:text-slate-900'
                  }`}
                >
                  <span>Todas ({items.length})</span>
                </button>
              </div>

              {itemsViewFilter === 'grouped' && (
                <div className="flex items-center gap-1 text-[11px] text-stone-500">
                  <button
                    type="button"
                    onClick={() => handleExpandAllModules(true)}
                    className="px-1.5 py-0.5 text-stone-600 hover:text-slate-900 hover:underline font-medium cursor-pointer"
                  >
                    Expandir
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleExpandAllModules(false)}
                    className="px-1.5 py-0.5 text-stone-500 hover:text-slate-900 hover:underline cursor-pointer"
                  >
                    Recolher
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50/80 px-2.5 py-1 text-xs">
            <Layers className="h-3.5 w-3.5 text-stone-500" />
            <span className="font-medium text-stone-600">MDF:</span>
            <Select
              value={settings.chapa_mode}
              onValueChange={(val: 'm2' | 'chapa') => {
                const updatedSettings = { ...settings, chapa_mode: val };
                setSettings(updatedSettings);
                const res = recalculateBudget(items, database, updatedSettings, catalog);
                setItems(res.items);
              }}
            >
              <SelectTrigger className="h-6 border-0 bg-transparent p-0 font-semibold text-slate-900 focus:ring-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="m2">Exibir em M²</SelectItem>
                <SelectItem value="chapa">Exibir em Chapas (5,09m²)</SelectItem>
              </SelectContent>
            </Select>

            {settings.chapa_mode === 'chapa' && (
              <Select
                value={settings.chapa_rounding}
                onValueChange={(val: 'up' | 'down' | 'exact') => {
                  const updatedSettings = { ...settings, chapa_rounding: val };
                  setSettings(updatedSettings);
                  const res = recalculateBudget(items, database, updatedSettings, catalog);
                  setItems(res.items);
                }}
              >
                <SelectTrigger className="h-6 border-0 bg-transparent p-0 font-semibold text-slate-900 focus:ring-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="up">Teto (p/ Cima)</SelectItem>
                  <SelectItem value="down">Piso (p/ Baixo)</SelectItem>
                  <SelectItem value="exact">Exato</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {items.length > 0 && (
            <div className="relative w-44">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-stone-400" />
              <Input
                placeholder="Filtrar peças..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="h-9 pl-8 text-xs bg-white border-stone-200 rounded-lg focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Table or Empty State */}
      {items.length === 0 ? (
        <Card className="border-dashed border-2 border-stone-200 bg-stone-50/40 p-12 text-center rounded-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-xs border border-stone-200/80">
            <FileSpreadsheet className="h-8 w-8 text-[#c92031]" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900 tracking-tight">
            Nenhum arquivo ou item carregado
          </h3>
          <p className="mx-auto mt-2 max-w-md text-xs sm:text-sm text-stone-500 leading-relaxed">
            Importe o arquivo exportado pelo <strong>Promob Plus ou Promob Start (.xml ou .pdf)</strong>. As repetições de peças e o consumo em m² quebrados serão calculados com exatidão matemática.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#c92031] text-white hover:bg-[#aa1726] shadow-xs font-semibold text-xs h-9 px-4 rounded-lg"
            >
              <Upload className="mr-2 h-4 w-4" />
              Selecionar Arquivo Promob (XML / PDF)
            </Button>
            <Button
              variant="outline"
              onClick={() => setPasteModalOpen(true)}
              className="border-stone-200 bg-white text-stone-700 text-xs hover:bg-stone-50 h-9 px-3.5 rounded-lg shadow-2xs font-medium"
            >
              <ClipboardPaste className="mr-2 h-4 w-4 text-stone-500" />
              Colar Relatório Promob
            </Button>
            <Button
              variant="outline"
              onClick={() => setAddItemModalOpen(true)}
              className="border-stone-200 bg-white text-stone-700 text-xs hover:bg-stone-50 h-9 px-3.5 rounded-lg shadow-2xs font-medium"
            >
              <Plus className="mr-2 h-4 w-4 text-stone-500" />
              Inserir Item Manualmente
            </Button>
          </div>
        </Card>
      ) : itemsViewFilter === 'grouped' ? (
        <div className="space-y-4">
          {filteredModuleGroups.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-xs text-stone-500">
              Nenhum móvel ou módulo encontrado com o filtro pesquisado.
            </div>
          ) : (
            filteredModuleGroups.map(group => {
              const isExpanded = expandedModules[group.id] !== false;
              return (
                <div
                  key={group.id}
                  className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-2xs transition-all hover:border-stone-300"
                >
                  {/* Cabeçalho do Móvel / Módulo */}
                  <div
                    onClick={() => handleToggleModuleExpand(group.id)}
                    className="flex flex-wrap items-center justify-between gap-3 bg-stone-50/80 hover:bg-stone-100/70 px-4 py-3 cursor-pointer transition-colors border-b border-stone-200/60 select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        className="p-1 rounded-md hover:bg-stone-200/70 text-stone-500 transition-colors shrink-0"
                        title={isExpanded ? 'Recolher peças' : 'Expandir peças'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-stone-600" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-stone-600" />
                        )}
                      </button>

                      {group.is_hardware_only ? (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-700 border border-stone-200 shrink-0 shadow-2xs">
                          <Wrench className="h-4 w-4" />
                        </div>
                      ) : group.is_process_only ? (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-700 border border-purple-200 shrink-0 shadow-2xs">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f8f4e9] text-[#886e35] border border-[#cbb27a]/30 shrink-0 shadow-2xs">
                          <Box className="h-4 w-4" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-sm text-slate-900 truncate tracking-tight">
                            {group.name}
                          </span>
                          {group.category && (
                            <span className="rounded border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-medium text-stone-600">
                              {group.category}
                            </span>
                          )}
                          {group.dimensions && (
                            <span 
                              className="font-mono text-[10px] font-semibold text-stone-700 bg-stone-100 border border-stone-200/70 px-2 py-0.5 rounded"
                              title={`Dimensões em milímetros: ${group.dimensions} mm (${formatDimensionsCm(group.dimensions)})`}
                            >
                              {group.dimensions} mm <span className="text-[9px] font-normal text-stone-600">({formatDimensionsCm(group.dimensions)})</span>
                            </span>
                          )}
                          <span className="text-xs text-stone-500 font-normal">
                            ({group.items.length} {group.items.length === 1 ? 'peça' : 'peças'})
                          </span>
                        </div>
                        {group.parent_item && (
                          <span className="text-[11px] text-stone-500 block truncate mt-0.5">
                            Módulo Promob: <span className="font-mono text-stone-700 font-medium">{group.parent_item.code}</span> {group.parent_item.dimensions ? `(${group.parent_item.dimensions})` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Subtotais do Móvel */}
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <span className="text-[10px] uppercase font-medium text-stone-400 block tracking-wider">Custo Materiais</span>
                        <span className="font-mono font-semibold text-xs text-stone-700 tabular-nums">
                          {hideFinancialValues
                            ? '••••••'
                            : group.subtotal_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                      <div className="border-l border-stone-200 pl-3.5">
                        <span className="text-[10px] uppercase font-semibold text-[#c92031]/80 block tracking-wider">Preço de Venda</span>
                        <span className="font-mono font-bold text-sm text-[#c92031] tabular-nums">
                          {hideFinancialValues
                            ? '••••••'
                            : group.subtotal_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Peças do Móvel */}
                  {isExpanded && (
                    <div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-700">
                          <thead className="bg-[#17191d] text-[10px] uppercase tracking-wider text-white font-semibold">
                            <tr>
                              <th className="py-2.5 pl-3 pr-1 font-semibold w-10 text-center text-stone-400">#</th>
                              <th className="px-2.5 py-2.5 font-semibold">Código / Peça</th>
                              <th className="px-3 py-2.5 font-semibold">Descrição do Material / Dimensões</th>
                              <th className="px-2 py-2.5 text-center font-semibold w-16" title="Repetições da peça">Rep (Peças)</th>
                              <th className="px-2 py-2.5 text-center font-semibold w-20" title="Matéria-prima unitária por peça (m²)">Qtd Unit. (M²)</th>
                              <th className="px-2 py-2.5 text-center font-semibold w-20" title="Consumo total de matéria-prima">Total Matéria</th>
                              <th className="px-2 py-2.5 text-center font-semibold w-12">Un</th>
                              <th className="px-3 py-2.5 text-right font-semibold text-amber-300" title="Custo unitário base do item (definido pelo operador ou tabela)">Custo Unit. (R$) ✏️</th>
                              <th className="px-3 py-2.5 text-right font-semibold" title="Custo total acumulado do item (Qtd × Custo Unitário)">Total Custo (R$)</th>
                              <th className="py-2.5 pl-2 pr-4 text-center font-semibold w-16">Ação</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100 bg-white">
                            {group.items.map((item, idx) => renderItemRow(item, idx))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/70 px-4 py-2 text-[11px] text-stone-600">
                        <span>Subtotal deste móvel: {group.items.length} itens</span>
                        <div className="flex items-center gap-3 font-mono">
                          <span>
                            Custo Total: {hideFinancialValues ? '••••••' : group.subtotal_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                          <span className="text-stone-300">•</span>
                          <span className="font-bold text-slate-900">
                            Venda (+{settings.margin}%): {hideFinancialValues ? '••••••' : group.subtotal_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200/90 bg-white/95 px-4 py-3 text-xs text-stone-600 shadow-2xs">
            <span>
              {moduleGroups.length} móveis / módulos ({items.length} peças totais, {items.filter(it => it.found && !it.price_unlinked).length} vinculados à tabela de preços)
            </span>
            <span className="text-stone-500">
              Margem de cálculo aplicada: <strong className="font-semibold text-slate-800">{settings.margin}%</strong> (definida em Parâmetros)
            </span>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#17191d] text-[10px] uppercase tracking-wider text-white font-semibold">
                <tr>
                  <th className="py-2.5 pl-3 pr-1 font-semibold w-10 text-center text-stone-400">#</th>
                  <th className="px-2.5 py-2.5 font-semibold">Código / Peça</th>
                  <th className="px-3 py-2.5 font-semibold">Descrição do Material / Dimensões</th>
                  <th className="px-2 py-2.5 text-center font-semibold w-16" title="Repetições da peça">Rep (Peças)</th>
                  <th className="px-2 py-2.5 text-center font-semibold w-20" title="Matéria-prima unitária por peça (m²)">Qtd Unit. (M²)</th>
                  <th className="px-2 py-2.5 text-center font-semibold w-20" title="Consumo total de matéria-prima">Total Matéria</th>
                  <th className="px-2 py-2.5 text-center font-semibold w-12">Un</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-amber-300" title="Custo unitário base do item (definido pelo operador ou tabela)">
                    Custo Unit. (R$) ✏️
                  </th>
                  <th className="px-3 py-2.5 text-right font-semibold" title="Custo total acumulado do item (Qtd × Custo Unitário)">Total Custo (R$)</th>
                  <th className="py-2.5 pl-2 pr-4 text-center font-semibold w-16">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 bg-white">
                {filteredItems.map((item, index) => renderItemRow(item, index))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 bg-stone-50/70 px-4 py-2.5 text-[11px] text-stone-600">
            <span>
              {items.length} itens no orçamento ({items.filter(it => it.found && !it.price_unlinked).length} vinculados à tabela de preços)
            </span>
            <span className="text-stone-500">
              Margem de cálculo aplicada: <strong className="font-semibold text-slate-800">{settings.margin}%</strong> (definida em Parâmetros)
            </span>
          </div>
        </div>
      )}

      {/* MODAL: Vincular Chapa ou Acessório / Linha Inteligente */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-xl w-full max-h-[88vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 tracking-tight">
              <Sparkles className="h-4 w-4 text-[#c92031]" />
              Vincular Preço da Tabela DF Móveis
            </DialogTitle>
          </DialogHeader>

          {linkingItem && (
            <div className="space-y-4 py-1">
              <div className="rounded-xl border border-stone-200/90 bg-stone-50/80 p-3.5 text-xs space-y-1.5 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">Item Selecionado:</span>
                  <span className="rounded border border-stone-200 bg-white px-2 py-0.5 text-[10px] font-mono text-stone-700">
                    {linkingItem.unit || 'UN'}
                  </span>
                </div>
                <p className="font-mono font-bold text-slate-900 break-all">{linkingItem.code}</p>
                <p className="font-medium text-stone-700 break-words">{linkingItem.description}</p>
                {linkingItem.dimensions && (
                  <p className="text-[10px] text-stone-600 font-mono">
                    Dimensões: {linkingItem.dimensions} mm <span className="text-stone-600 font-normal">({formatDimensionsCm(linkingItem.dimensions)})</span>
                  </p>
                )}
                {similarItemsCount > 1 && (
                  <div className="flex items-center gap-1.5 pt-1.5 text-[11px] text-blue-700 font-medium border-t border-stone-200 mt-2">
                    <span>⚡</span>
                    <span><strong>{similarItemsCount} itens semelhantes</strong> encontrados no orçamento com este padrão/material.</span>
                  </div>
                )}
              </div>

              {selectedBrand === 'Acessórios' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <Label className="text-xs font-semibold text-stone-700">1. Categoria</Label>
                      <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                        <SelectTrigger className="mt-1 text-xs w-full bg-white border-stone-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {brandsList.map(b => (
                            <SelectItem key={b} value={b}>
                              {b === 'Acessórios' ? 'Acessórios & Ferragens (Catálogo Geral)' : b}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0">
                      <Label className="text-xs font-semibold text-stone-700">2. Origem</Label>
                      <div className="mt-1 flex h-9 items-center rounded-lg border border-stone-200 bg-stone-100/80 px-3 text-xs font-medium text-stone-600">
                        Catálogo Geral de Materiais
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Label className="text-xs font-semibold text-stone-700">3. Acessório / Ferragem do Catálogo Geral</Label>
                    <Select value={selectedAcessorioId} onValueChange={setSelectedAcessorioId}>
                      <SelectTrigger className="mt-1 text-xs font-semibold w-full bg-white border-stone-200 rounded-lg">
                        <SelectValue placeholder="Selecione o acessório..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {acessoriosList.map((a: { id: string; name: string; price: number }) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} — {a.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/80 p-3.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                    <div className="min-w-0">
                      <span className="font-bold text-emerald-900 block">Preço de Custo na Tabela:</span>
                      <span className="text-stone-600 block truncate">
                        {selectedAcessorio?.name} {selectedAcessorio?.size ? `(${selectedAcessorio.size})` : ''}
                      </span>
                    </div>
                    <div className="text-right ml-auto">
                      <span className="text-base font-bold text-emerald-800 block font-mono tabular-nums">
                        {(selectedAcessorio?.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium">custo unitário</span>
                    </div>
                  </div>
                </>
              ) : selectedBrand === 'Mão de Obra Fixa' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <Label className="text-xs font-semibold text-stone-700">1. Categoria</Label>
                      <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                        <SelectTrigger className="mt-1 text-xs w-full bg-white border-stone-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {brandsList.map(b => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0">
                      <Label className="text-xs font-semibold text-stone-700">2. Tipo</Label>
                      <div className="mt-1 flex h-9 items-center rounded-lg border border-stone-200 bg-stone-100/80 px-3 text-xs font-medium text-stone-600">
                        Processo / Mão de Obra Fixa
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Label className="text-xs font-semibold text-stone-700">3. Processo / Mão de Obra da Tabela</Label>
                    <Select value={selectedMaoDeObraId} onValueChange={setSelectedMaoDeObraId}>
                      <SelectTrigger className="mt-1 text-xs font-semibold w-full bg-white border-stone-200 rounded-lg">
                        <SelectValue placeholder="Selecione o processo de fabricação..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {maoDeObraList.map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} — {m.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} / {m.unit || 'UN'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/80 p-3.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                    <div className="min-w-0">
                      <span className="font-bold text-emerald-900 block">Preço Unitário do Processo:</span>
                      <span className="text-stone-600 block truncate">
                        {selectedMaoDeObra?.name}
                      </span>
                    </div>
                    <div className="text-right ml-auto">
                      <span className="text-base font-bold text-emerald-800 block font-mono tabular-nums">
                        {(selectedMaoDeObra?.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium">por {selectedMaoDeObra?.unit || 'unidade'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <Label className="text-xs font-semibold text-stone-700">1. Marca</Label>
                      <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                        <SelectTrigger className="mt-1 text-xs w-full bg-white border-stone-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                          {brandsList.map(b => (
                            <SelectItem key={b} value={b}>{b}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="min-w-0">
                      <Label className="text-xs font-semibold text-stone-700">2. Espessura</Label>
                      <Select
                        value={selectedThickness}
                        onValueChange={(val: '6mm' | '15mm' | '18mm' | '25mm') => setSelectedThickness(val)}
                      >
                        <SelectTrigger className="mt-1 text-xs font-bold w-full bg-white border-stone-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6mm">6mm (Fundo)</SelectItem>
                          <SelectItem value="15mm">15mm (Padrão)</SelectItem>
                          <SelectItem value="18mm">18mm (Estrutura)</SelectItem>
                          <SelectItem value="25mm">25mm (Engrosso)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Label className="text-xs font-semibold text-stone-700">3. Linha / Padrão da Marca ({selectedBrand})</Label>
                    <Select value={selectedLine} onValueChange={setSelectedLine}>
                      <SelectTrigger className="mt-1 text-xs font-semibold w-full bg-white border-stone-200 rounded-lg">
                        <SelectValue placeholder="Selecione a linha..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {brandLines.map(line => {
                          const p = line.prices[selectedThickness];
                          return (
                            <SelectItem key={line.id} value={line.name}>
                              {line.name} {p ? `— R$ ${p.toFixed(2)}/chapa` : ''}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-xl border border-emerald-300/80 bg-emerald-50/80 p-3.5 text-xs flex flex-wrap items-center justify-between gap-2 shadow-2xs">
                    <div className="min-w-0">
                      <span className="font-bold text-emerald-900 block">Preço de Custo na Tabela:</span>
                      <span className="text-stone-600 block truncate">
                        {selectedBrand} - {selectedLine || 'Selecione a linha'} ({selectedThickness})
                      </span>
                    </div>
                    <div className="text-right ml-auto">
                      <span className="text-base font-bold text-emerald-800 block font-mono tabular-nums">
                        {currentM2Cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                      </span>
                      <span className="text-[10px] text-stone-500 font-medium block">
                        (Chapa inteira: {currentBoardPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleApplyLink(false)}
              className="text-xs flex-1 border-stone-200 bg-white text-stone-700 hover:bg-stone-50 font-semibold h-9 rounded-lg"
            >
              📥 Trazer Preço para Este Item
            </Button>
            <Button
              type="button"
              onClick={() => handleApplyLink(true)}
              className="bg-[#c92031] text-white hover:bg-[#aa1726] text-xs flex-1 font-semibold h-9 rounded-lg shadow-2xs"
            >
              📥 Trazer para TODOS Similares ({similarItemsCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Inserir Item Manual */}
      <Dialog open={addItemModalOpen} onOpenChange={setAddItemModalOpen}>
        <DialogContent className="sm:max-w-lg w-full max-h-[88vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Plus className="h-4 w-4 text-[#c92031]" />
              Adicionar Item Manual
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold text-stone-700">Código / Referência</Label>
              <Input
                placeholder="Ex: MDF-BRANCO-15"
                value={newItemCode}
                onChange={e => setNewItemCode(e.target.value)}
                className="mt-1 text-xs bg-white border-stone-200 rounded-lg focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30 font-mono"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-stone-700">Descrição do Item</Label>
              <Input
                placeholder="Ex: Tampo de Ilha 18mm"
                value={newItemDesc}
                onChange={e => setNewItemDesc(e.target.value)}
                className="mt-1 text-xs bg-white border-stone-200 rounded-lg focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <Label className="text-xs font-semibold text-stone-700">Quantidade</Label>
                <DecimalInput
                  type="number"
                  step="0.01"
                  value={newItemQty}
                  onChange={e => setNewItemQty(parseFloat(e.target.value) || 1)}
                  className="mt-1 text-xs bg-white border-stone-200 rounded-lg font-mono focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-stone-700">Unidade</Label>
                <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                  <SelectTrigger className="mt-1 text-xs w-full bg-white border-stone-200 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M2">M²</SelectItem>
                    <SelectItem value="UN">UN</SelectItem>
                    <SelectItem value="M">Metros (M)</SelectItem>
                    <SelectItem value="PAR">Par</SelectItem>
                    <SelectItem value="CENTO">Cento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-stone-700">Custo Base (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={newItemCost}
                  onChange={e => setNewItemCost(e.target.value)}
                  className="mt-1 text-xs bg-white border-stone-200 rounded-lg font-mono focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddItemModalOpen(false)} className="rounded-lg border-stone-200 text-xs">
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddManualItem} className="bg-[#c92031] text-white hover:bg-[#aa1726] rounded-lg shadow-2xs text-xs font-semibold">
              Adicionar ao Orçamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Colar Relatório Promob */}
      <Dialog open={pasteModalOpen} onOpenChange={setPasteModalOpen}>
        <DialogContent className="sm:max-w-2xl w-full max-h-[88vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 tracking-tight">
              <ClipboardPaste className="h-4 w-4 text-stone-600" />
              Colar Relatório / Tabela Promob
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-stone-600 leading-relaxed">
              Copie a tabela do relatório do <strong>Promob Plus ou Promob Start</strong> (ou o texto do PDF) e cole no campo abaixo. Os campos de cliente, repetições, m² e preços de tabela serão importados com precisão:
            </p>
            <textarea
              rows={10}
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder="Cole aqui o texto do relatório Promob (Item, Rep, Qtd, Referência, Descrição, Preço Tabela, Preço Final)..."
              className="w-full rounded-xl border border-stone-300 p-3 font-mono text-xs focus:border-[#c92031] focus:outline-none focus:ring-1 focus:ring-[#c92031]/30 bg-stone-50/50"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPasteModalOpen(false)} className="rounded-lg border-stone-200 text-xs">
              Cancelar
            </Button>
            <Button
              onClick={handlePasteImport}
              className="bg-[#c92031] text-white hover:bg-[#aa1726] rounded-lg shadow-2xs text-xs font-semibold"
            >
              <Check className="mr-1.5 h-4 w-4" />
              Processar e Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
