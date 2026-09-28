import { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, Plus, Trash2, Edit2, AlertTriangle, 
  CheckCircle2, FileSpreadsheet, Download, Save, Layers, Search, Check, Loader2, Link2, Unlink, Sparkles,
  User, FolderKanban, Info, ClipboardPaste, FileText, Eye, EyeOff
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
import { BudgetItem, BudgetSettings, ProductItem } from '@/lib/orcamento/types';
import { parsePromobXML, parseTXT, parseCSV, parseJSON, parsePromobPDF, parsePromobTextTable } from '@/lib/orcamento/parsers';
import { 
  calculateItemPrice, recalculateBudget, CHAPA_AREA_M2, round2, isChapa,
  smartMatchPromobChapa, matchProduct, chapaSalePrice, resolveItemPrice, smartMatchAccessory,
  isSimilarPromobItem
} from '@/lib/orcamento/calculator';
import { generateBudgetPdf } from '@/lib/orcamento/pdf-generator';
import { BrandCatalog, CatalogByBrand } from '@/lib/orcamento/chapas-catalog';

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
  ) => void;
  onStartNewBudget: () => void;
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

  // Filter / Search inside current table
  const [filterSearch, setFilterSearch] = useState('');
  const [itemsViewFilter, setItemsViewFilter] = useState<'all' | 'leaves' | 'modules'>('all');

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

  // Available brands and categories in catalog
  const brandsList = Object.keys(catalog);

  // Accessories list from catalog
  const acessoriosList = useMemo(() => {
    const a = catalog['Acessórios'];
    return a && a.type === 'acessorios' ? a.items : [];
  }, [catalog]);

  const selectedAcessorio = useMemo(() => {
    return acessoriosList.find(a => a.id === selectedAcessorioId) || acessoriosList[0];
  }, [acessoriosList, selectedAcessorioId]);

  // Lines for selected brand in modal
  const brandLines = useMemo(() => {
    const b = catalog[selectedBrand];
    return b && b.type === 'brand' ? (b as BrandCatalog).lines : [];
  }, [catalog, selectedBrand]);

  // Current selected board price and m2 cost in modal
  const currentBoardPrice = useMemo(() => {
    if (selectedBrand === 'Acessórios') return 0;
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

  // Contagem de itens semelhantes identificados no orçamento
  const similarItemsCount = useMemo(() => {
    if (!linkingItem) return 0;
    const isAcc = selectedBrand === 'Acessórios';
    return items.filter(it => isSimilarPromobItem(linkingItem, it, isAcc)).length;
  }, [items, linkingItem, selectedBrand]);

  // Handle File Upload (Somente arquivos .xml do Promob)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let parsedCount = 0;
    const allRawItems: any[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const filename = file.name.toLowerCase();

        if (!filename.endsWith('.xml')) {
          toast.error(`Formato não aceito: ${file.name}. Somente arquivos XML (.xml) do Promob são permitidos.`);
          continue;
        }

        const content = await file.text();
        const parsed = parsePromobXML(content);

        allRawItems.push(...parsed);
        parsedCount += parsed.length;
      }

      if (allRawItems.length === 0) {
        toast.warning('Nenhum item válido encontrado no arquivo XML.');
        setIsUploading(false);
        return;
      }

      // Preserva preços de custo (tabela) e valores finais do Promob com alta precisão
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
        description: `Quantidades em m² quebrados e preços de tabela preservados com exatidão.`,
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
  const handleDirectSave = () => {
    if (items.length === 0) {
      toast.warning('Adicione ou importe itens antes de salvar o orçamento.');
      return;
    }

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      onSaveBudget(
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
      toast.error('Erro ao salvar orçamento localmente.');
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
            margin: it.margin,
            price_unlinked: it.price_unlinked,
          },
          database,
          settings
        ), id: it.id, price_unlinked: it.price_unlinked };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings);
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
            price_unlinked: it.price_unlinked,
          },
          database,
          settings
        ), id: it.id, price_unlinked: it.price_unlinked };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings);
    setItems(res.items);
  };

  // Atualizar quantidade de um item inline
  const handleUpdateItemQty = (itemId: string, newQty: number) => {
    const safeQty = isNaN(newQty) || newQty <= 0 ? 1 : newQty;
    const updated = items.map(it => {
      if (it.id === itemId) {
        return { ...it, ...calculateItemPrice(
          {
            code: it.code,
            description: it.description,
            quantity: safeQty,
            unit: it.original_unit || it.unit,
            unit_cost: it.unit_cost,
            margin: it.margin,
            price_unlinked: it.price_unlinked,
          },
          database,
          settings
        ), id: it.id, price_unlinked: it.price_unlinked };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings);
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
      toast.success('Proposta comercial em PDF baixada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao exportar PDF.');
    }
  };

  // Open Link Modal for Item (Chapas ou Acessórios)
  const handleOpenLinkModal = (item: BudgetItem) => {
    setLinkingItem(item);
    const raw = `${item.code} ${item.description}`.toLowerCase();

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

    if (isAccessory && catalog['Acessórios']) {
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

    setLinkModalOpen(true);
  };

  // Puxar valor da tabela de preço diretamente ao clicar no botão "Trazer Preço" de um item
  const handleConsultarVincularPreco = (item: BudgetItem) => {
    // 1. Tenta correspondência inteligente direta via resolveItemPrice (chapas, acessórios ou insumos)
    const res = resolveItemPrice(item, catalog, database);
    if (res.matched && res.unit_cost > 0) {
      const updated = items.map(it => {
        if (it.id === item.id) {
          const calculated = calculateItemPrice(
            {
              code: res.code || it.code,
              description: it.description,
              quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
              unit: res.unit || it.original_unit || it.unit,
              unit_cost: res.unit_cost,
              margin: it.margin,
              rep: it.rep,
              unit_quantity: it.unit_quantity,
              dimensions: it.dimensions,
              category: it.category,
              external_model: it.external_model,
              table_price: res.unit_cost,
              final_price: it.final_price,
              is_parent_module: it.is_parent_module,
              is_chapa: res.source === 'catalog_chapa' || res.source === 'mdf_padrao' || it.is_chapa,
              is_fita: it.is_fita,
              fita_metros: it.fita_metros,
            },
            database,
            settings,
            catalog
          );

          return {
            ...calculated,
            id: it.id,
            price_unlinked: false,
            found: true,
            table_price: res.unit_cost,
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
      // Pula módulos pais agrupadores do Promob (como Torre, Balcão 2 Portas)
      if (it.is_parent_module) return it;

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
            code: res.code || it.code,
            description: it.description,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: res.unit || it.original_unit || it.unit,
            unit_cost: res.unit_cost,
            margin: it.margin,
            rep: it.rep,
            unit_quantity: it.unit_quantity,
            dimensions: it.dimensions,
            category: it.category,
            external_model: it.external_model,
            table_price: res.unit_cost,
            final_price: it.final_price,
            is_parent_module: it.is_parent_module,
            is_chapa: res.source === 'catalog_chapa' || res.source === 'mdf_padrao' || it.is_chapa,
            is_fita: it.is_fita,
            fita_metros: it.fita_metros,
          },
          database,
          settings,
          catalog
        );

        return {
          ...calculated,
          id: it.id,
          price_unlinked: false,
          found: true,
          table_price: res.unit_cost,
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
          const calculated = calculateItemPrice(
            {
              code: selectedAcessorio.id || it.code,
              description: `${it.description} (${selectedAcessorio.name})`,
              quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
              unit: it.original_unit || it.unit || 'UN',
              unit_cost: unitCost,
              margin: it.margin,
              table_price: unitCost,
            },
            database,
            settings,
            catalog
          );
          return {
            ...calculated,
            id: it.id,
            price_unlinked: false,
            found: true,
            table_price: unitCost,
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
        ? isSimilarPromobItem(linkingItem, it, false)
        : it.id === linkingItem.id;

      if (isTarget) {
        matchedCount++;
        const calculated = calculateItemPrice(
          {
            code: `${selectedBrand.toUpperCase()}-${lineObj.name.toUpperCase().replace(/\s+/g, '_')}-${selectedThickness}`,
            description: `${it.description} [${selectedBrand} - ${lineObj.name} ${selectedThickness}]`,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.original_unit || it.unit,
            unit_cost: m2Cost,
            margin: it.margin,
            table_price: m2Cost,
          },
          database,
          settings,
          catalog
        );
        return {
          ...calculated,
          id: it.id,
          price_unlinked: false,
          found: true,
          table_price: m2Cost,
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
    const res = recalculateBudget(updated, database, settings);
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
    } else if (itemsViewFilter === 'modules') {
      result = result.filter(it => it.is_parent_module);
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

  return (
    <div className="space-y-6">
      {/* Resumo Financeiro Compacto com Botão de Ocultar Valores para Atendimento ao Cliente */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Resumo Financeiro
            </span>
            {hideFinancialValues && (
              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] text-amber-800 font-semibold py-0 h-5">
                Valores Ocultos (Modo Cliente)
              </Badge>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleHideFinancialValues}
            className="h-7 gap-1.5 px-2.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 bg-white shadow-xs rounded-lg transition-colors cursor-pointer"
            title={hideFinancialValues ? "Exibir valores financeiros" : "Ocultar valores do cliente"}
          >
            {hideFinancialValues ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-amber-600" />
                <span className="text-[11px] font-medium text-slate-700">Exibir Valores</span>
              </>
            ) : (
              <>
                <Eye className="h-3.5 w-3.5 text-slate-500" />
                <span className="text-[11px] font-medium text-slate-700">Ocultar Valores</span>
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <Card className="border-l-4 border-l-[#c92031] bg-white shadow-xs py-2 px-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Valor Total de Venda
              </span>
              <span className="text-[10px] text-slate-400">Total</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {hideFinancialValues
                  ? '••••••••'
                  : totals.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-slate-500 bg-white shadow-xs py-2 px-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Custo Total dos Materiais
              </span>
              <span className="text-[10px] text-slate-400">{totals.items_count} peças</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-base sm:text-lg font-bold text-slate-700 tracking-tight">
                {hideFinancialValues
                  ? '••••••••'
                  : totals.total_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </Card>

          <Card className="border-l-4 border-l-emerald-600 bg-white shadow-xs py-2 px-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Lucro Bruto Estimado
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold">Líquido</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="text-base sm:text-lg font-bold text-emerald-700 tracking-tight">
                {hideFinancialValues
                  ? '••••••••'
                  : totals.gross_profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Quadrante Cliente, Ambiente e Projeto */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#c92031]" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Identificação do Orçamento (Cliente & Projeto)
            </span>
          </div>
          {selectedClientId !== 'custom' && (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold">
              <Check className="mr-1 h-3 w-3" /> Cliente do Sistema Conectado
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 items-end">
          {/* Cliente Seletor */}
          <div className="md:col-span-4 space-y-1">
            <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Cliente Cadastrado
            </Label>
            <Select value={selectedClientId} onValueChange={handleSelectClient}>
              <SelectTrigger className="h-9 text-xs font-medium bg-slate-50/50">
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
            <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Nome do Cliente
            </Label>
            <Input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="Nome do cliente..."
              className="h-9 text-xs font-bold text-slate-900"
            />
          </div>

          {/* Projeto / Ambiente */}
          <div className="md:col-span-3 space-y-1">
            <Label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Ambiente / Projeto
            </Label>
            {selectedClientId !== 'custom' &&
            clientsList.find(c => c.id === selectedClientId)?.projetos &&
            (clientsList.find(c => c.id === selectedClientId)?.projetos?.length || 0) > 0 ? (
              <Select value={selectedProjectId} onValueChange={handleSelectProject}>
                <SelectTrigger className="h-9 text-xs font-medium bg-slate-50/50">
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
                className="h-9 text-xs font-medium text-slate-800"
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
              className="h-9 border-[#cbb27a] bg-[#cbb27a]/10 text-[#886e35] hover:bg-[#cbb27a]/20 text-xs font-semibold px-2.5"
              title="Baixar proposta em PDF"
            >
              <Download className="mr-1 h-3.5 w-3.5" />
              PDF
            </Button>

            <Button
              onClick={handleDirectSave}
              disabled={items.length === 0 || isSaving}
              size="sm"
              className={`h-9 font-semibold text-xs px-3 transition-all duration-300 ${
                saveSuccess
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
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
          <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-600">
            <FolderKanban className="h-3.5 w-3.5 text-blue-600" />
            <span>Nome do ambiente:</span>
            <Input
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="Ex: Cozinha Integrada"
              className="h-7 text-xs w-72"
            />
          </div>
        )}
      </div>

      {/* Toolbar: Import & Chapa Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".xml"
            multiple
            className="hidden"
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-[#17191d] text-xs text-white hover:bg-slate-800"
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {isUploading ? 'Processando Arquivo...' : 'Importar Promob (XML)'}
          </Button>

          <Button
            variant="outline"
            onClick={() => setPasteModalOpen(true)}
            className="border-slate-300 text-xs hover:bg-slate-50"
          >
            <ClipboardPaste className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
            Colar Relatório Promob
          </Button>

          <Button
            variant="outline"
            onClick={() => setAddItemModalOpen(true)}
            className="border-slate-300 text-xs hover:bg-slate-50"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5 text-emerald-600" />
            Adicionar Item Manual
          </Button>

          {items.length > 0 && (
            <Button
              variant="outline"
              onClick={handlePullAllPricesFromTable}
              className="border-blue-200 bg-blue-50/60 text-xs font-semibold text-blue-700 hover:bg-blue-100 hover:text-blue-800"
              title="Percorre os itens e traz o valor da tabela de preço para todas as chapas reconhecidas"
            >
              <Sparkles className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              Trazer Preços da Tabela
            </Button>
          )}

          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearBudget}
              className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="mr-1 h-3.5 w-3.5" />
              Limpar Lista
            </Button>
          )}
        </div>

        {/* Chapa Conversion Controls & View Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {items.length > 0 && (
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setItemsViewFilter('all')}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  itemsViewFilter === 'all'
                    ? 'bg-white shadow text-slate-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setItemsViewFilter('leaves')}
                className={`px-2 py-1 rounded-md font-medium transition-colors ${
                  itemsViewFilter === 'leaves'
                    ? 'bg-white shadow text-slate-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Peças de Corte ({items.filter(it => !it.is_parent_module).length})
              </button>
              {items.some(it => it.is_parent_module) && (
                <button
                  type="button"
                  onClick={() => setItemsViewFilter('modules')}
                  className={`px-2 py-1 rounded-md font-medium transition-colors ${
                    itemsViewFilter === 'modules'
                      ? 'bg-white shadow text-slate-900 font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Módulos ({items.filter(it => it.is_parent_module).length})
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <span className="font-medium text-slate-700">Chapas MDF:</span>
            <Select
              value={settings.chapa_mode}
              onValueChange={(val: 'm2' | 'chapa') => {
                const updatedSettings = { ...settings, chapa_mode: val };
                setSettings(updatedSettings);
                const res = recalculateBudget(items, database, updatedSettings);
                setItems(res.items);
              }}
            >
              <SelectTrigger className="h-7 border-0 bg-transparent p-0 font-semibold text-slate-900 focus:ring-0">
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
                  const res = recalculateBudget(items, database, updatedSettings);
                  setItems(res.items);
                }}
              >
                <SelectTrigger className="h-7 border-0 bg-transparent p-0 font-semibold text-slate-900 focus:ring-0">
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
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Filtrar peças..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main Table or Empty State */}
      {items.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
            <FileSpreadsheet className="h-8 w-8 text-[#c92031]" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">
            Nenhum arquivo ou item carregado
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Importe o arquivo XML exportado pelo <strong>Promob Plus ou Promob Start (.xml)</strong>. Os números quebrados em m² e dados das peças serão calculados com exatidão matemática.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#c92031] text-white hover:bg-[#aa1726]"
            >
              <Upload className="mr-2 h-4 w-4" />
              Selecionar Arquivo XML Promob
            </Button>
            <Button
              variant="outline"
              onClick={() => setPasteModalOpen(true)}
              className="border-slate-300"
            >
              <ClipboardPaste className="mr-2 h-4 w-4 text-blue-600" />
              Colar Relatório Promob
            </Button>
            <Button
              variant="outline"
              onClick={() => setAddItemModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Inserir Item Manualmente
            </Button>
          </div>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-[#17191d] text-[11px] uppercase tracking-wider text-white">
                <tr>
                  <th className="py-3 pl-3 pr-1 font-semibold w-10 text-center">#</th>
                  <th className="px-2 py-3 font-semibold">Código / Peça</th>
                  <th className="px-3 py-3 font-semibold">Descrição do Material / Dimensões</th>
                  <th className="px-2 py-3 text-center font-semibold w-12" title="Repetições da peça">Rep</th>
                  <th className="px-2 py-3 text-center font-semibold w-16" title="Quantidade unitária no Promob">Qtd Unit</th>
                  <th className="px-2 py-3 text-center font-semibold w-20" title="Quantidade total (Rep * Qtd Unit)">Qtd Total</th>
                  <th className="px-2 py-3 text-center font-semibold w-12">Un</th>
                  <th className="px-3 py-3 text-right font-semibold text-amber-300">
                    Custo Tabela (R$) ✏️
                  </th>
                  <th className="px-3 py-3 text-right font-semibold">Preço Unit.</th>
                  <th className="px-3 py-3 text-right font-semibold">Total Linha</th>
                  <th className="py-3 pl-2 pr-4 text-center font-semibold">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item, index) => {
                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="py-2.5 pl-3 pr-1 text-center font-medium text-slate-400">
                        {item.item_number || index + 1}
                      </td>

                      <td className="px-2 py-2.5 font-mono font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[180px]" title={item.code}>
                            {item.code}
                          </span>

                          {item.unit_cost === 0 || !item.found || item.price_unlinked ? (
                            <button
                              onClick={() => handleConsultarVincularPreco(item)}
                              className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shrink-0"
                              title="Trazer preço da tabela para este item"
                            >
                              <Link2 className="h-3 w-3 text-blue-600" />
                              Trazer Preço
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenLinkModal(item)}
                              className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 hover:underline shrink-0"
                              title="Item vinculado à tabela de preços. Clique para consultar ou trocar de linha."
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Vinculado</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-medium text-slate-800">{item.description}</span>
                            {item.is_parent_module && (
                              <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[9px] text-amber-800 font-semibold">
                                Módulo Promob
                              </Badge>
                            )}
                            {item.category && (
                              <Badge variant="outline" className="border-slate-300 bg-slate-100 text-[9px] text-slate-700">
                                {item.category}
                              </Badge>
                            )}
                            {item.external_model && (
                              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-[9px] text-emerald-700">
                                {item.external_model}
                              </Badge>
                            )}
                            {item.is_chapa && (
                              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[9px] text-blue-700">
                                Chapa
                              </Badge>
                            )}
                            {item.is_fita && (
                              <Badge variant="outline" className="border-purple-200 bg-purple-50 text-[9px] text-purple-700">
                                Fita
                              </Badge>
                            )}
                          </div>
                          {item.dimensions && (
                            <span className="block text-[10px] text-slate-500 font-mono">
                              Dimensões: {item.dimensions}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Repetição */}
                      <td className="px-2 py-2 text-center font-semibold text-slate-700">
                        {item.rep || 1}
                      </td>

                      {/* Quantidade Unitária */}
                      <td className="px-2 py-2 text-center font-mono text-slate-600 text-xs">
                        {item.unit_quantity !== undefined ? item.unit_quantity : item.quantity}
                      </td>

                      {/* Quantidade Total Efetiva */}
                      <td className="px-2 py-2 text-center">
                        <BudgetNumberInput
                          type="number"
                          step="any"
                          min="0.001"
                          value={item.quantity}
                          onCommit={value => handleUpdateItemQty(item.id, value)}
                          className="h-7 w-16 text-center text-xs font-semibold px-1 py-0 border-slate-200 mx-auto"
                        />
                      </td>

                      <td className="px-2 py-2.5 text-center">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 text-[11px]">
                          {item.unit}
                        </span>
                      </td>

                      {/* Custo Unitário Manual Inline */}
                      <td className="px-3 py-2 text-right">
                        {hideFinancialValues ? (
                          <span className="text-slate-400 font-mono text-xs">••••••</span>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-slate-400 text-[10px] font-medium">R$</span>
                            <BudgetNumberInput
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_cost === 0 ? '' : item.unit_cost}
                              onCommit={value => handleUpdateItemCost(item.id, value)}
                              placeholder="0,00"
                              className={`h-7 w-24 text-right text-xs font-bold px-2 py-0 border ${
                                item.unit_cost === 0
                                  ? 'border-amber-300 bg-amber-50/50 text-amber-900 placeholder:text-amber-400'
                                  : 'border-slate-200 text-slate-900 focus:border-[#c92031]'
                              }`}
                              title="Digite o custo unitário do material ou clique no link para trazer da tabela"
                            />
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-2.5 text-right font-medium text-slate-600">
                        {hideFinancialValues
                          ? '••••••'
                          : item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      <td className="px-3 py-2.5 text-right">
                        {hideFinancialValues ? (
                          <span className="font-bold text-slate-400 font-mono text-xs">••••••</span>
                        ) : (
                          <>
                            <span className="font-bold text-slate-900">
                              {item.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              Custo: {item.total_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </>
                        )}
                      </td>

                      <td className="py-2.5 pl-2 pr-4 text-center">
                        <div className="flex items-center justify-center gap-1">
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
                            className="h-7 w-7 text-blue-600 hover:bg-blue-50 hover:text-blue-800"
                            title={item.found && !item.price_unlinked ? "Desvincular preço da tabela" : "Vincular preço da tabela"}
                          >
                            {item.found && !item.price_unlinked ? <Unlink className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-7 w-7 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            title="Remover Item"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-2.5 text-[11px] text-slate-500">
            <span>
              {items.length} itens no orçamento ({items.filter(it => it.found && !it.price_unlinked).length} vinculados à tabela de preços)
            </span>
            <span className="text-slate-500">
              Margem de cálculo aplicada: <strong className="font-semibold text-slate-700">{settings.margin}%</strong> (definida em Configurações)
            </span>
          </div>
        </div>
      )}

      {/* MODAL: Vincular Chapa ou Acessório / Linha Inteligente */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-xl w-full max-h-[88vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Sparkles className="h-5 w-5 text-[#cbb27a]" />
              Vincular Preço da Tabela DF Móveis
            </DialogTitle>
          </DialogHeader>

          {linkingItem && (
            <div className="space-y-4 py-1">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs space-y-1.5 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Item Selecionado:</span>
                  <Badge variant="outline" className="border-slate-300 text-[10px] bg-white">
                    {linkingItem.unit || 'UN'}
                  </Badge>
                </div>
                <p className="font-mono font-bold text-slate-900 break-all">{linkingItem.code}</p>
                <p className="font-medium text-slate-700 break-words">{linkingItem.description}</p>
                {linkingItem.dimensions && (
                  <p className="text-[10px] text-slate-500 font-mono">Dimensões: {linkingItem.dimensions}</p>
                )}
                {similarItemsCount > 1 && (
                  <div className="flex items-center gap-1.5 pt-1 text-[11px] text-blue-700 font-medium border-t border-slate-200 mt-2">
                    <span>⚡</span>
                    <span><strong>{similarItemsCount} itens semelhantes</strong> encontrados no orçamento com este padrão/material.</span>
                  </div>
                )}
              </div>

              {selectedBrand === 'Acessórios' ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <Label className="text-xs font-semibold">1. Categoria</Label>
                      <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                        <SelectTrigger className="mt-1 text-xs w-full">
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
                      <Label className="text-xs font-semibold">2. Tipo</Label>
                      <div className="mt-1 flex h-9 items-center rounded-md border border-slate-200 bg-slate-100 px-3 text-xs font-medium text-slate-600">
                        Ferragem / Acessório
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Label className="text-xs font-semibold">3. Acessório / Ferragem da Tabela</Label>
                    <Select value={selectedAcessorioId} onValueChange={setSelectedAcessorioId}>
                      <SelectTrigger className="mt-1 text-xs font-semibold w-full">
                        <SelectValue placeholder="Selecione o acessório..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {acessoriosList.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name} {a.size ? `(${a.size})` : ''} — {a.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-emerald-900 block">Preço de Custo na Tabela:</span>
                      <span className="text-slate-600 block truncate">
                        {selectedAcessorio?.name} {selectedAcessorio?.size ? `(${selectedAcessorio.size})` : ''}
                      </span>
                    </div>
                    <div className="text-right ml-auto">
                      <span className="text-base font-black text-emerald-800 block">
                        {(selectedAcessorio?.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">custo unitário</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="min-w-0">
                      <Label className="text-xs font-semibold">1. Marca</Label>
                      <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                        <SelectTrigger className="mt-1 text-xs w-full">
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
                      <Label className="text-xs font-semibold">2. Espessura</Label>
                      <Select
                        value={selectedThickness}
                        onValueChange={(val: '6mm' | '15mm' | '18mm' | '25mm') => setSelectedThickness(val)}
                      >
                        <SelectTrigger className="mt-1 text-xs font-bold w-full">
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
                    <Label className="text-xs font-semibold">3. Linha / Padrão da Marca ({selectedBrand})</Label>
                    <Select value={selectedLine} onValueChange={setSelectedLine}>
                      <SelectTrigger className="mt-1 text-xs font-semibold w-full">
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

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-emerald-900 block">Preço de Custo na Tabela:</span>
                      <span className="text-slate-600 block truncate">
                        {selectedBrand} - {selectedLine || 'Selecione a linha'} ({selectedThickness})
                      </span>
                    </div>
                    <div className="text-right ml-auto">
                      <span className="text-base font-black text-emerald-800 block">
                        {currentM2Cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium block">
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
              className="text-xs flex-1 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold h-9"
            >
              📥 Trazer Preço para Este Item
            </Button>
            <Button
              type="button"
              onClick={() => handleApplyLink(true)}
              className="bg-[#c92031] text-white hover:bg-[#aa1726] text-xs flex-1 font-semibold h-9"
            >
              📥 Trazer para TODOS Similares ({similarItemsCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Inserir Item Manual */}
      <Dialog open={addItemModalOpen} onOpenChange={setAddItemModalOpen}>
        <DialogContent className="sm:max-w-lg w-full max-h-[88vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">Adicionar Item Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Código / Referência</Label>
              <Input
                placeholder="Ex: MDF-BRANCO-15"
                value={newItemCode}
                onChange={e => setNewItemCode(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold">Descrição do Item</Label>
              <Input
                placeholder="Ex: Tampo de Ilha 18mm"
                value={newItemDesc}
                onChange={e => setNewItemDesc(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <Label className="text-xs font-semibold">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItemQty}
                  onChange={e => setNewItemQty(parseFloat(e.target.value) || 1)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Unidade</Label>
                <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                  <SelectTrigger className="mt-1 text-xs w-full">
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
                <Label className="text-xs font-semibold">Custo Base (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={newItemCost}
                  onChange={e => setNewItemCost(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddItemModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleAddManualItem} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Colar Relatório Promob */}
      <Dialog open={pasteModalOpen} onOpenChange={setPasteModalOpen}>
        <DialogContent className="sm:max-w-2xl w-full max-h-[88vh] overflow-y-auto overflow-x-hidden p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <ClipboardPaste className="h-5 w-5 text-blue-600" />
              Colar Relatório / Tabela Promob
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-slate-600">
              Copie a tabela do relatório do <strong>Promob Plus ou Promob Start</strong> (ou o texto do PDF) e cole no campo abaixo. Os campos de cliente, repetições, m² quebrados e preços de tabela serão importados automaticamente:
            </p>
            <textarea
              rows={10}
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder="Cole aqui o texto do relatório Promob (Item, Rep, Qtd, Referência, Descrição, Preço Tabela, Preço Final)..."
              className="w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-[#c92031] focus:outline-none focus:ring-1 focus:ring-[#c92031]"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPasteModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handlePasteImport}
              className="bg-[#c92031] text-white hover:bg-[#aa1726]"
            >
              <Check className="mr-1.5 h-4 w-4" />
              Importar Relatório
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
