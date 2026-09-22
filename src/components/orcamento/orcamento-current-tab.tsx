import { useState, useRef, useMemo, useEffect } from 'react';
import { 
  Upload, Plus, Trash2, Edit2, AlertTriangle, 
  CheckCircle2, FileSpreadsheet, Download, Save, Layers, Search, Check, Loader2, Link2, Unlink, Sparkles,
  User, FolderKanban, Info
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
import { parsePromobXML, parseTXT, parseCSV, parseJSON } from '@/lib/orcamento/parsers';
import { 
  calculateItemPrice, recalculateBudget, CHAPA_AREA_M2, round2, isChapa,
  smartMatchPromobChapa, matchProduct, chapaSalePrice
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

  // Available brands in catalog
  const brandsList = Object.keys(catalog).filter(
    b => catalog[b].type === 'brand'
  );

  // Lines for selected brand in modal
  const brandLines = useMemo(() => {
    const b = catalog[selectedBrand];
    return b && b.type === 'brand' ? (b as BrandCatalog).lines : [];
  }, [catalog, selectedBrand]);

  // Current selected board price and m2 cost in modal
  const currentBoardPrice = useMemo(() => {
    const brandData = catalog[selectedBrand] as BrandCatalog;
    const lineObj = brandData?.lines.find(l => l.name === selectedLine);
    if (!lineObj) return 0;
    return lineObj.prices[selectedThickness] || 0;
  }, [catalog, selectedBrand, selectedLine, selectedThickness]);

  const currentM2Cost = useMemo(() => {
    return chapaSalePrice(currentBoardPrice);
  }, [currentBoardPrice]);

  // Handle File Upload (Promob XML, TXT, CSV, JSON)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    let parsedCount = 0;
    const allRawItems: any[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await file.text();
        const filename = file.name.toLowerCase();

        let parsed: any[] = [];
        if (filename.endsWith('.xml')) {
          parsed = parsePromobXML(content);
        } else if (filename.endsWith('.txt')) {
          parsed = parseTXT(content);
        } else if (filename.endsWith('.csv')) {
          parsed = parseCSV(content);
        } else if (filename.endsWith('.json')) {
          parsed = parseJSON(content);
        } else {
          toast.error(`Formato não suportado: ${file.name}. Use XML, TXT, CSV ou JSON.`);
          continue;
        }

        allRawItems.push(...parsed);
        parsedCount += parsed.length;
      }

      if (allRawItems.length === 0) {
        toast.warning('Nenhum item válido encontrado nos arquivos.');
        setIsUploading(false);
        return;
      }

      // O usuário solicitou deixar os custos zerados/limpos na importação
      // para inserir manualmente de forma organizada e limpa
      const newBudgetItems: BudgetItem[] = allRawItems.map((raw, idx) => {
        const calculated = calculateItemPrice(
          {
            code: raw.code,
            description: raw.description,
            quantity: raw.quantity,
            unit: raw.unit,
            unit_cost: 0, // Custo inicial limpo / manual conforme instrução do usuário
            margin: settings.margin, // Sempre herda a margem configurada!
          },
          [], // Não vincula preço automático para manter o orçamento limpo
          settings
        );
        return {
          ...calculated,
          item_number: idx + 1,
        };
      });

      setItems(newBudgetItems);
      onStartNewBudget();

      toast.success(`${parsedCount} itens importados com sucesso!`, {
        description: `Custos unitários limpos para preenchimento manual conforme sua tabela.`,
      });
    } catch (err: any) {
      console.error('Erro ao processar arquivo:', err);
      toast.error(`Erro na importação: ${err.message || 'Arquivo inválido'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Open Link Modal for Item
  const handleOpenLinkModal = (item: BudgetItem) => {
    setLinkingItem(item);

    // Usa smart match para identificar a marca e linha mais adequadas
    const smart = smartMatchPromobChapa(item.code, item.description, catalog);
    if (smart.brand && brandsList.includes(smart.brand)) {
      setSelectedBrand(smart.brand);
      setSelectedThickness(smart.thickness);
      if (smart.line) {
        setSelectedLine(smart.line);
      } else {
        const brandData = catalog[smart.brand] as BrandCatalog;
        setSelectedLine(brandData?.lines[0]?.name || '');
      }
    } else {
      const raw = `${item.code} ${item.description}`.toLowerCase();
      const foundBrand = brandsList.find(b => raw.includes(b.toLowerCase()));
      if (foundBrand) setSelectedBrand(foundBrand);

      if (/\b6mm\b|\.6\./i.test(raw)) setSelectedThickness('6mm');
      else if (/\b18mm\b|\.18\./i.test(raw)) setSelectedThickness('18mm');
      else if (/\b25mm\b|\.25\./i.test(raw)) setSelectedThickness('25mm');
      else setSelectedThickness('15mm');

      const b = catalog[foundBrand || 'Arauco'] as BrandCatalog;
      setSelectedLine(b?.lines[0]?.name || '');
    }

    setLinkModalOpen(true);
  };

  // Puxar valor da tabela de preço diretamente ao clicar no botão "Consultar / Vincular Chapa da Tabela"
  const handleConsultarVincularPreco = (item: BudgetItem) => {
    // 1. Tenta correspondência inteligente no catálogo de chapas (Arauco, Duratex, Guararapes, etc.)
    const smart = smartMatchPromobChapa(item.code, item.description, catalog);
    if (smart.matched && smart.m2Cost > 0) {
      const updated = items.map(it => {
        if (it.id === item.id) {
          return { ...it, ...calculateItemPrice(
            {
              code: `${smart.brand?.toUpperCase()}-${smart.line?.toUpperCase().replace(/\s+/g, '_')}-${smart.thickness}`,
              description: it.description,
              quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
              unit: it.original_unit || it.unit,
              unit_cost: smart.m2Cost,
              margin: it.margin,
            },
            database,
            settings
          ), id: it.id, price_unlinked: false };
        }
        return it;
      });

      const res = recalculateBudget(updated, database, settings);
      setItems(res.items);

      toast.success(`Preço ${smart.m2Cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m² vinculado da tabela!`, {
        description: `${smart.brand} - ${smart.line} (${smart.thickness}) | Chapa inteira: R$ ${smart.boardPrice.toFixed(2)}`,
      });
      return;
    }

    // 2. Tenta encontrar no banco de materiais/produtos cadastrados (database)
    const prodMatch = matchProduct(item.code, item.description, database);
    if (prodMatch.product && prodMatch.product.unit_price > 0) {
      const cost = prodMatch.product.unit_price;
      const updated = items.map(it => {
        if (it.id === item.id) {
          return { ...it, ...calculateItemPrice(
            {
              code: it.code,
              description: it.description,
              quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
              unit: it.original_unit || it.unit,
              unit_cost: cost,
              margin: it.margin,
            },
            database,
            settings
          ), id: it.id, price_unlinked: false };
        }
        return it;
      });

      const res = recalculateBudget(updated, database, settings);
      setItems(res.items);

      toast.success(`Preço ${cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} vinculado da tabela de materiais!`, {
        description: prodMatch.product.description,
      });
      return;
    }

    // 3. Se não houver correspondência 100% automática, abre o modal de consulta para o usuário escolher a linha/marca
    handleOpenLinkModal(item);
    toast.info('Consulte e selecione a linha da chapa para trazer o preço.');
  };

  // Vincular automaticamente todas as peças que possuem correspondência direta na tabela
  const handlePullAllPricesFromTable = () => {
    let matchedCount = 0;
    const updated = items.map(it => {
      // Se já tiver custo definido e for maior que 0, preserva


      const smart = smartMatchPromobChapa(it.code, it.description, catalog);
      if (smart.matched && smart.m2Cost > 0) {
        matchedCount++;
        return { ...it, ...calculateItemPrice(
          {
            code: `${smart.brand?.toUpperCase()}-${smart.line?.toUpperCase().replace(/\s+/g, '_')}-${smart.thickness}`,
            description: it.description,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.original_unit || it.unit,
            unit_cost: smart.m2Cost,
            margin: it.margin,
          },
          database,
          settings
        ), id: it.id, price_unlinked: false };
      }

      const prodMatch = matchProduct(it.code, it.description, database);
      if (prodMatch.product && prodMatch.product.unit_price > 0) {
        matchedCount++;
        return { ...it, ...calculateItemPrice(
          {
            code: it.code,
            description: it.description,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.original_unit || it.unit,
            unit_cost: prodMatch.product.unit_price,
            margin: it.margin,
          },
          database,
          settings
        ), id: it.id, price_unlinked: false };
      }

      return it;
    });

    if (matchedCount > 0) {
      const res = recalculateBudget(updated, database, settings);
      setItems(res.items);
      toast.success(`${matchedCount} materiais vinculados com valores da tabela de preços!`);
    } else {
      toast.info('Nenhuma chapa pendente com correspondência direta foi encontrada.');
    }
  };

  // Apply Linker to single item or all similar items
  const handleApplyLink = (applyToAllSimilar: boolean) => {
    if (!linkingItem || !selectedLine) return;

    const brandData = catalog[selectedBrand] as BrandCatalog;
    const lineObj = brandData?.lines.find(l => l.name === selectedLine);
    if (!lineObj) return;

    const boardPrice = lineObj.prices[selectedThickness] || 0;
    const m2Cost = chapaSalePrice(boardPrice, lineObj.width * lineObj.height);

    if (boardPrice <= 0) { toast.error('Esta espessura não tem preço cadastrado.'); return; }

    // Filter key to match similar items: e.g. "Arauco.Beige Matt"
    const targetCode = linkingItem.code;

    const updated = items.map(it => {
      const isTarget = applyToAllSimilar
        ? it.code === targetCode || it.description === linkingItem.description
        : it.id === linkingItem.id;

      if (isTarget) {
        return { ...it, ...calculateItemPrice(
          {
            code: `${selectedBrand.toUpperCase()}-${lineObj.name.toUpperCase().replace(/\s+/g, '_')}-${selectedThickness}`,
            description: `${it.description} [${selectedBrand} - ${lineObj.name} ${selectedThickness}]`,
            quantity: it.original_quantity !== undefined ? it.original_quantity : it.quantity,
            unit: it.original_unit || it.unit,
            unit_cost: m2Cost,
            margin: it.margin,
          },
          database,
          settings
        ), id: it.id, price_unlinked: false };
      }
      return it;
    });

    const res = recalculateBudget(updated, database, settings);
    setItems(res.items);
    setLinkModalOpen(false);

    if (applyToAllSimilar) {
      toast.success(`Vinculado a todos os itens com "${linkingItem.code}"!`, {
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
      settings
    );

    const updated = [...items, { ...calculated, item_number: items.length + 1 }];
    const res = recalculateBudget(updated, database, settings);
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
    if (!filterSearch.trim()) return items;
    const term = filterSearch.toLowerCase();
    return items.filter(
      it =>
        it.code.toLowerCase().includes(term) ||
        it.description.toLowerCase().includes(term)
    );
  }, [items, filterSearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-[#c92031] bg-white shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Valor Total de Venda
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-900">
              {totals.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-slate-500">
            Com margem de <strong>{settings.margin}%</strong> e acréscimos
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-slate-600 bg-white shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Custo Total dos Materiais
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-slate-700">
              {totals.total_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-slate-500">
            {totals.items_count} peças processadas
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-600 bg-white shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Lucro Bruto Estimado
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-700">
              {totals.gross_profit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-slate-500">
            Diferença líquida sobre os insumos
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-[#cbb27a] bg-white shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Margem Real / Markup
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-[#b09657]">
              {totals.profit_margin_percent}%
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs text-slate-500">
            Margem aplicada sobre custo total
          </CardContent>
        </Card>
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
            accept=".xml,.txt,.csv,.json"
            multiple
            className="hidden"
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="bg-[#17191d] text-xs text-white hover:bg-slate-800"
          >
            <Upload className="mr-1.5 h-4 w-4" />
            {isUploading ? 'Processando Arquivo...' : 'Importar Promob (XML / TXT / CSV)'}
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

        {/* Chapa Conversion Controls */}
        <div className="flex flex-wrap items-center gap-3">
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
            Importe a lista de peças exportada pelo <strong>Promob (XML ou TXT)</strong>. O orçamento inicia limpo para você inserir os custos manuais diretamente na tabela, consultando a aba de Tabela de Preços por Marca quando desejar.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-[#c92031] text-white hover:bg-[#aa1726]"
            >
              <Upload className="mr-2 h-4 w-4" />
              Selecionar Arquivo Promob
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
                  <th className="py-3 pl-4 pr-2 font-semibold">#</th>
                  <th className="px-3 py-3 font-semibold">Código / Peça</th>
                  <th className="px-3 py-3 font-semibold">Descrição do Material</th>
                  <th className="px-2 py-3 text-center font-semibold">Qtd</th>
                  <th className="px-2 py-3 text-center font-semibold">Un</th>
                  <th className="px-3 py-3 text-right font-semibold text-amber-300">
                    Custo Unit. (R$) ✏️
                  </th>
                  <th className="px-2 py-3 text-center font-semibold">Margem</th>
                  <th className="px-3 py-3 text-right font-semibold">Preço Unit.</th>
                  <th className="px-3 py-3 text-right font-semibold">Total</th>
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
                      <td className="py-2.5 pl-4 pr-2 font-medium text-slate-400">
                        {index + 1}
                      </td>

                      <td className="px-3 py-2.5 font-mono font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate max-w-[220px]" title={item.code}>
                            {item.code}
                          </span>

                          {item.unit_cost === 0 ? (
                            <button
                              onClick={() => {
                              if (item.found && !item.price_unlinked) {
                                setItems(prev => recalculateBudget(prev.map(it => it.id === item.id
                                  ? { ...it, price_unlinked: true, found: false, unit_cost: 0 }
                                  : it), database, settings).items);
                                toast.success('Preço desvinculado. Informe um valor ou vincule novamente.');
                              } else handleConsultarVincularPreco(item);
                            }}
                              className="flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shrink-0"
                              title="Consultar/Vincular Chapa da tabela para trazer o valor do custo unitário"
                            >
                              <Link2 className="h-3 w-3 text-blue-600" />
                              Trazer Preço
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenLinkModal(item)}
                              className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 hover:underline shrink-0"
                              title="Chapa vinculada à tabela de preços. Clique para consultar ou trocar de linha."
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span>Vinculado</span>
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-2.5">
                        <span className="font-medium text-slate-800">{item.description}</span>
                        {item.is_chapa && (
                          <Badge variant="outline" className="ml-1.5 border-blue-200 bg-blue-50 text-[9px] text-blue-700">
                            Chapa
                          </Badge>
                        )}
                        {item.is_fita && (
                          <Badge variant="outline" className="ml-1.5 border-purple-200 bg-purple-50 text-[9px] text-purple-700">
                            Fita
                          </Badge>
                        )}
                      </td>

                      <td className="px-2 py-2 text-center">
                        <BudgetNumberInput
                          type="number"
                          step="any"
                          min="0.01"
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
                      </td>

                      {/* Margem Individual Inline */}
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <BudgetNumberInput
                            type="number"
                            step="1"
                            min="0"
                            value={item.margin}
                            onCommit={value => handleUpdateItemMargin(item.id, value)}
                            className="h-7 w-14 text-center text-xs font-medium px-1 py-0 border-slate-200"
                          />
                          <span className="text-slate-400 text-[10px]">%</span>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 text-right font-medium text-slate-600">
                        {item.unit_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>

                      <td className="px-3 py-2.5 text-right font-bold text-slate-900">
                        {item.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                  : it), database, settings).items);
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
        </div>
      )}

      {/* MODAL: Vincular Chapa / Linha Inteligente */}
      <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#cbb27a]" />
              Vincular Marca & Linha de Chapa
            </DialogTitle>
          </DialogHeader>

          {linkingItem && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <p className="text-slate-500">Item Selecionado:</p>
                <p className="font-mono font-bold text-slate-900">{linkingItem.code}</p>
                <p className="font-medium text-slate-700">{linkingItem.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">1. Marca</Label>
                  <Select value={selectedBrand} onValueChange={setSelectedBrand}>
                    <SelectTrigger className="mt-1 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {brandsList.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-semibold">2. Espessura</Label>
                  <Select
                    value={selectedThickness}
                    onValueChange={(val: '6mm' | '15mm' | '18mm' | '25mm') => setSelectedThickness(val)}
                  >
                    <SelectTrigger className="mt-1 text-xs font-bold">
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

              <div>
                <Label className="text-xs font-semibold">3. Linha / Padrão da Marca ({selectedBrand})</Label>
                <Select value={selectedLine} onValueChange={setSelectedLine}>
                  <SelectTrigger className="mt-1 text-xs font-semibold">
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
              {/* Preço Calculado da Chapa e do M² */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-900 block">Preço de Custo na Tabela:</span>
                  <span className="text-slate-600">
                    {selectedBrand} - {selectedLine || 'Selecione a linha'} ({selectedThickness})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-base font-black text-emerald-800 block">
                    {currentM2Cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium">
                    (Chapa inteira: {currentBoardPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => handleApplyLink(false)}
              className="text-xs flex-1 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-semibold"
            >
              📥 Trazer Preço para Este Item
            </Button>
            <Button
              onClick={() => handleApplyLink(true)}
              className="bg-[#c92031] text-white hover:bg-[#aa1726] text-xs flex-1 font-semibold"
            >
              📥 Trazer para TODOS Similares
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Inserir Item Manual */}
      <Dialog open={addItemModalOpen} onOpenChange={setAddItemModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Item Manual</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Código / Referência</Label>
              <Input
                placeholder="Ex: MDF-BRANCO-15"
                value={newItemCode}
                onChange={e => setNewItemCode(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Descrição do Item</Label>
              <Input
                placeholder="Ex: Tampo de Ilha 18mm"
                value={newItemDesc}
                onChange={e => setNewItemDesc(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItemQty}
                  onChange={e => setNewItemQty(parseFloat(e.target.value) || 1)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={newItemUnit} onValueChange={setNewItemUnit}>
                  <SelectTrigger className="mt-1 text-xs">
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
                <Label className="text-xs">Custo Base (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={newItemCost}
                  onChange={e => setNewItemCost(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddManualItem} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Adicionar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
