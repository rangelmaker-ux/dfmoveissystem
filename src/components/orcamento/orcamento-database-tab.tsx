import { useState, useRef, useEffect } from 'react';
import { 
  Search, Plus, Trash2, Edit2, RotateCcw, Package, Layers, Download, Upload, 
  Check, DollarSign, ArrowRight, ShieldAlert, Sparkles, Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ProductItem, BudgetSettings } from '@/lib/orcamento/types';
import { DEFAULT_MATERIALS } from '@/lib/orcamento/default-materials';
import { 
  INITIAL_CHAPAS_CATALOG, CatalogByBrand, ChapaLineItem, AcessorioItem, BrandCatalog, AcessoriosCatalog 
} from '@/lib/orcamento/chapas-catalog';
import { CHAPA_AREA_M2, round2, calculateAdditionsFactor } from '@/lib/orcamento/calculator';
import {
  loadChapasCatalog,
  saveFullChapasCatalog,
  saveChapasBrand,
  updateProductField as sbUpdateProductField,
} from '@/lib/orcamento/supabase-storage';

interface DatabaseTabProps {
  database: ProductItem[];
  setDatabase: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  settings: BudgetSettings;
  isAdmin?: boolean;
}

export function OrcamentoDatabaseTab({ database, setDatabase, settings, isAdmin }: DatabaseTabProps) {
  const [subTab, setSubTab] = useState<'chapas' | 'produtos'>('chapas');
  const [catalog, setCatalog] = useState<CatalogByBrand>(INITIAL_CHAPAS_CATALOG);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [selectedBrand, setSelectedBrand] = useState<string>('Duratex');
  const [brandSearch, setBrandSearch] = useState('');

  // Editing state for Chapa Line
  const [editLineModalOpen, setEditLineModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ChapaLineItem | null>(null);
  const [editPrice6mm, setEditPrice6mm] = useState('');
  const [editPrice15mm, setEditPrice15mm] = useState('');
  const [editPrice18mm, setEditPrice18mm] = useState('');
  const [editPrice25mm, setEditPrice25mm] = useState('');

  // Add line modal
  const [addLineModalOpen, setAddLineModalOpen] = useState(false);
  const [newLineName, setNewLineName] = useState('');

  // Add brand modal
  const [addBrandModalOpen, setAddBrandModalOpen] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  // General Products tab states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProdId, setEditingProdId] = useState<string | null>(null);
  const [prodCode, setProdCode] = useState('');
  const [prodSubcodes, setProdSubcodes] = useState('');
  const [prodDescription, setProdDescription] = useState('');
  const [prodUnit, setProdUnit] = useState('M2');
  const [prodUnitPrice, setProdUnitPrice] = useState('');
  const [prodFitaMetros, setProdFitaMetros] = useState('20');
  const [prodCategory, setProdCategory] = useState('MDF');

  const jsonInputRef = useRef<HTMLInputElement>(null);

  // Load catalog from Supabase on mount
  useEffect(() => {
    const load = async () => {
      const cloudCatalog = await loadChapasCatalog();
      if (cloudCatalog && Object.keys(cloudCatalog).length > 0) {
        setCatalog(cloudCatalog);
      } else {
        // First time: seed initial catalog to Supabase
        await saveFullChapasCatalog(INITIAL_CHAPAS_CATALOG);
      }
      setCatalogLoaded(true);
    };
    load();
  }, []);

  // Auto-save catalog to Supabase with debounce
  const catalogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!catalogLoaded) return;

    if (catalogTimerRef.current) clearTimeout(catalogTimerRef.current);
    catalogTimerRef.current = setTimeout(() => {
      saveFullChapasCatalog(catalog);
    }, 2000);

    return () => {
      if (catalogTimerRef.current) clearTimeout(catalogTimerRef.current);
    };
  }, [catalog, catalogLoaded]);

  const brandNames = Object.keys(catalog);
  const activeBrandData = catalog[selectedBrand];

  // Filter lines for active brand
  const filteredLines = activeBrandData && activeBrandData.type === 'brand'
    ? activeBrandData.lines.filter(l => l.name.toLowerCase().includes(brandSearch.toLowerCase()))
    : [];

  const filteredAcessorios = activeBrandData && activeBrandData.type === 'acessorios'
    ? activeBrandData.items.filter(a => a.name.toLowerCase().includes(brandSearch.toLowerCase()))
    : [];

  // Calculate sale price with user margin and global additions
  const additionsFactor = calculateAdditionsFactor(settings);
  const getSalePrice = (cost: number | null) => {
    if (!cost || cost <= 0) return null;
    const baseWithMargin = cost * (1 + settings.margin / 100);
    return round2(baseWithMargin * additionsFactor);
  };

  // Open Edit Line Modal
  const handleOpenEditLine = (line: ChapaLineItem) => {
    setEditingLine(line);
    setEditPrice6mm(line.prices['6mm'] ? line.prices['6mm']!.toString() : '');
    setEditPrice15mm(line.prices['15mm'] ? line.prices['15mm']!.toString() : '');
    setEditPrice18mm(line.prices['18mm'] ? line.prices['18mm']!.toString() : '');
    setEditPrice25mm(line.prices['25mm'] ? line.prices['25mm']!.toString() : '');
    setEditLineModalOpen(true);
  };

  // Save Line Edits
  const handleSaveLine = () => {
    if (!editingLine) return;

    const p6 = parseFloat(editPrice6mm.replace(',', '.')) || null;
    const p15 = parseFloat(editPrice15mm.replace(',', '.')) || null;
    const p18 = parseFloat(editPrice18mm.replace(',', '.')) || null;
    const p25 = parseFloat(editPrice25mm.replace(',', '.')) || null;

    setCatalog(prev => {
      const brandObj = prev[selectedBrand];
      if (brandObj.type !== 'brand') return prev;

      const updatedLines = brandObj.lines.map(l =>
        l.id === editingLine.id
          ? {
              ...l,
              prices: {
                '6mm': p6,
                '15mm': p15,
                '18mm': p18,
                '25mm': p25,
              },
            }
          : l
      );

      return {
        ...prev,
        [selectedBrand]: {
          ...brandObj,
          lines: updatedLines,
        },
      };
    });

    // Also sync into product database for Promob matching
    syncLineToDatabase(selectedBrand, editingLine.name, { p6, p15, p18, p25 });

    setEditLineModalOpen(false);
    toast.success(`Valores da linha "${editingLine.name}" atualizados com sucesso!`);
  };

  // Synchronize board into main product database
  const syncLineToDatabase = (
    brand: string,
    lineName: string,
    prices: { p6: number | null; p15: number | null; p18: number | null; p25: number | null }
  ) => {
    setDatabase(prev => {
      let next = [...prev];
      const thicknesses = [
        { th: '15mm', price: prices.p15 },
        { th: '18mm', price: prices.p18 },
        { th: '6mm', price: prices.p6 },
        { th: '25mm', price: prices.p25 },
      ];

      for (const item of thicknesses) {
        if (!item.price) continue;
        const code = `${brand.toUpperCase()}-${lineName.toUpperCase().replace(/\\s+/g, '_')}-${item.th.toUpperCase()}`;
        const m2Price = round2(item.price / CHAPA_AREA_M2);

        const existingIdx = next.findIndex(p => p.code === code);
        const subcodes = [
          `${brand} ${lineName} ${item.th}`,
          `${lineName} ${item.th}`,
          `${brand} ${lineName}`,
        ];

        if (existingIdx !== -1) {
          next[existingIdx] = {
            ...next[existingIdx],
            unit_price: m2Price,
            description: `MDF ${brand} ${lineName} ${item.th}`,
          };
        } else {
          next.push({
            id: `chapa-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            code,
            subcodes,
            description: `MDF ${brand} ${lineName} ${item.th}`,
            unit: 'M2',
            unit_price: m2Price,
            category: 'MDF',
          });
        }
      }

      return next;
    });
  };

  // Add new line to current brand
  const handleAddNewLine = () => {
    if (!newLineName.trim()) {
      toast.error('Informe o nome da linha ou padrão.');
      return;
    }

    const p6 = parseFloat(editPrice6mm.replace(',', '.')) || null;
    const p15 = parseFloat(editPrice15mm.replace(',', '.')) || null;
    const p18 = parseFloat(editPrice18mm.replace(',', '.')) || null;
    const p25 = parseFloat(editPrice25mm.replace(',', '.')) || null;

    const newLine: ChapaLineItem = {
      id: `${selectedBrand.toLowerCase()}-${Date.now()}`,
      name: newLineName.trim(),
      width: 2.75,
      height: 1.85,
      area: 5.09,
      prices: {
        '6mm': p6,
        '15mm': p15,
        '18mm': p18,
        '25mm': p25,
      },
    };

    setCatalog(prev => {
      const brandObj = prev[selectedBrand];
      if (brandObj.type !== 'brand') return prev;
      return {
        ...prev,
        [selectedBrand]: {
          ...brandObj,
          lines: [newLine, ...brandObj.lines],
        },
      };
    });

    syncLineToDatabase(selectedBrand, newLine.name, { p6, p15, p18, p25 });

    setAddLineModalOpen(false);
    setNewLineName('');
    setEditPrice6mm('');
    setEditPrice15mm('');
    setEditPrice18mm('');
    setEditPrice25mm('');
    toast.success(`Linha "${newLine.name}" cadastrada na marca ${selectedBrand}!`);
  };

  // Reset to original 2025 Excel catalog
  const handleResetCatalog = () => {
    if (confirm('Deseja restaurar todos os preços de chapas para a tabela original 2025?')) {
      setCatalog(INITIAL_CHAPAS_CATALOG);
      toast.success('Catálogo de chapas 2025 restaurado com sucesso!');
    }
  };

  // Update a product field (unit_price) inline – available to ALL users
  const handleUpdateProductField = (productId: string, field: 'unit_price', value: number) => {
    setDatabase(prev => {
      const updated = prev.map(p =>
        p.id === productId ? { ...p, [field]: value } : p
      );
      return updated;
    });
    // Persist to Supabase
    sbUpdateProductField(productId, field, value);
  };

  // Add a new brand to the catalog – available to ALL users
  const handleAddBrand = () => {
    const trimmed = newBrandName.trim();
    if (!trimmed) {
      toast.error('Informe o nome da marca.');
      return;
    }
    if (catalog[trimmed]) {
      toast.error(`A marca "${trimmed}" já existe no catálogo.`);
      return;
    }
    setCatalog(prev => ({
      ...prev,
      [trimmed]: { type: 'brand' as const, lines: [] },
    }));
    setSelectedBrand(trimmed);
    setAddBrandModalOpen(false);
    setNewBrandName('');
    toast.success(`Marca "${trimmed}" adicionada com sucesso!`);
  };

  return (
    <div className="space-y-6">
      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant={subTab === 'chapas' ? 'default' : 'outline'}
            onClick={() => setSubTab('chapas')}
            className={
              subTab === 'chapas'
                ? 'bg-[#17191d] text-white shadow-sm'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }
          >
            <Layers className="mr-2 h-4 w-4 text-[#cbb27a]" />
            Chapas por Marca & Linha
          </Button>

          <Button
            variant={subTab === 'produtos' ? 'default' : 'outline'}
            onClick={() => setSubTab('produtos')}
            className={
              subTab === 'produtos'
                ? 'bg-[#17191d] text-white shadow-sm'
                : 'border-slate-300 text-slate-700 hover:bg-slate-50'
            }
          >
            <Package className="mr-2 h-4 w-4 text-emerald-500" />
            Catálogo Geral de Materiais ({database.length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleResetCatalog} className="text-xs">
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Restaurar Planilha 2025
          </Button>
        </div>
      </div>

      {/* VIEW 1: CHAPAS POR MARCA (Catálogo 2025 da Planilha) */}
      {subTab === 'chapas' && (
        <div className="space-y-4">
          {/* Brand Selector Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {brandNames.map(brand => {
              const isSelected = selectedBrand === brand;
              const count =
                catalog[brand].type === 'brand'
                  ? (catalog[brand] as BrandCatalog).lines.length
                  : (catalog[brand] as AcessoriosCatalog).items.length;

              return (
                <button
                  key={brand}
                  onClick={() => {
                    setSelectedBrand(brand);
                    setBrandSearch('');
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#c92031] text-white shadow-md shadow-[#c92031]/20'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span>{brand}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Brand Toolbar: Search and Add Line */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={`Buscar linhas e cores em ${selectedBrand}...`}
                  value={brandSearch}
                  onChange={e => setBrandSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <span>Margem ativa:</span>
                <strong className="text-[#c92031]">{settings.margin}%</strong>
                <span className="text-[10px] text-slate-400">(Preço de Venda sugerido automático)</span>
              </div>

              <Button
                onClick={() => {
                  setNewBrandName('');
                  setAddBrandModalOpen(true);
                }}
                variant="outline"
                className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                Nova Marca
              </Button>

              {activeBrandData.type === 'brand' && (
                <Button
                  onClick={() => {
                    setNewLineName('');
                    setEditPrice6mm('');
                    setEditPrice15mm('');
                    setEditPrice18mm('');
                    setEditPrice25mm('');
                    setAddLineModalOpen(true);
                  }}
                  className="bg-[#17191d] text-xs text-white hover:bg-slate-800"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
                  Nova Linha em {selectedBrand}
                </Button>
              )}
            </div>
          </div>

          {/* Table of Brand Lines */}
          {activeBrandData.type === 'brand' ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-[#17191d] text-[11px] uppercase tracking-wider text-white">
                    <tr>
                      <th className="py-3.5 pl-4 pr-3 font-semibold">Linha / Padrão</th>
                      <th className="px-3 py-3.5 text-center font-semibold">Dimensões</th>
                      <th className="px-3 py-3.5 text-right font-semibold">6mm (Custo / Venda)</th>
                      <th className="px-3 py-3.5 text-right font-semibold bg-white/5">15mm (Custo / Venda)</th>
                      <th className="px-3 py-3.5 text-right font-semibold">18mm (Custo / Venda)</th>
                      <th className="px-3 py-3.5 text-right font-semibold">25mm (Custo)</th>
                      <th className="py-3.5 pl-2 pr-4 text-center font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Nenhuma linha encontrada com o termo "{brandSearch}".
                        </td>
                      </tr>
                    ) : (
                      filteredLines.map(line => {
                        const p6 = line.prices['6mm'];
                        const p15 = line.prices['15mm'];
                        const p18 = line.prices['18mm'];
                        const p25 = line.prices['25mm'];

                        const sale15 = getSalePrice(p15);
                        const sale18 = getSalePrice(p18);

                        return (
                          <tr key={line.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 pl-4 pr-3">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{line.name}</span>
                                <Badge variant="outline" className="text-[9px] border-slate-200 bg-slate-50 text-slate-500">
                                  {selectedBrand}
                                </Badge>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-center text-slate-500 font-mono text-[11px]">
                              {line.width}m × {line.height}m ({line.area}m²)
                            </td>

                            {/* 6mm */}
                            <td className="px-3 py-3 text-right">
                              {p6 ? (
                                <div>
                                  <span className="font-semibold text-slate-900">
                                    {p6.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                  <span className="block text-[10px] text-slate-400">
                                    {(p6 / line.area).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* 15mm (Most common, highlighted) */}
                            <td className="px-3 py-3 text-right bg-amber-50/30">
                              {p15 ? (
                                <div>
                                  <span className="font-bold text-slate-900">
                                    {p15.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                  {sale15 && (
                                    <span className="block text-[10px] font-semibold text-emerald-700">
                                      Venda: {sale15.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  )}
                                  <span className="block text-[10px] text-slate-400">
                                    {(p15 / line.area).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* 18mm */}
                            <td className="px-3 py-3 text-right">
                              {p18 ? (
                                <div>
                                  <span className="font-bold text-slate-900">
                                    {p18.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                  {sale18 && (
                                    <span className="block text-[10px] font-semibold text-emerald-700">
                                      Venda: {sale18.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  )}
                                  <span className="block text-[10px] text-slate-400">
                                    {(p18 / line.area).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* 25mm */}
                            <td className="px-3 py-3 text-right">
                              {p25 ? (
                                <span className="font-medium text-slate-800">
                                  {p25.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* Action */}
                            <td className="py-3 pl-2 pr-4 text-center">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditLine(line)}
                                className="h-7 text-xs hover:bg-[#17191d] hover:text-white"
                              >
                                <Edit2 className="mr-1 h-3 w-3" />
                                Editar Preço
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* ACESSÓRIOS TABLE */
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-[#17191d] text-[11px] uppercase tracking-wider text-white">
                    <tr>
                      <th className="py-3.5 pl-4 pr-3 font-semibold">Acessório / Descrição</th>
                      <th className="px-3 py-3.5 font-semibold">Tamanho / Especificação</th>
                      <th className="px-3 py-3.5 text-right font-semibold">Preço de Custo</th>
                      <th className="px-3 py-3.5 text-right font-semibold">Preço Sugerido com Margem ({settings.margin}%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAcessorios.map(a => {
                      const sale = getSalePrice(a.price);
                      return (
                        <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pl-4 pr-3 font-bold text-slate-900">
                            {a.name}
                          </td>
                          <td className="px-3 py-3 text-slate-600 font-medium">
                            {a.size || '—'}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-slate-900">
                            {a.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                          </td>
                          <td className="px-3 py-3 text-right font-bold text-emerald-700">
                            {sale ? sale.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rodapé com data da última atualização */}
          <div className="flex items-center justify-end gap-2 text-[11px] text-slate-400 pt-1">
            <span>📅 Última atualização de valores:</span>
            <strong className="text-slate-500">
              {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </strong>
          </div>
        </div>
      )}

      {/* VIEW 2: CATÁLOGO GERAL DE MATERIAIS */}
      {subTab === 'produtos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar produto, código ou subcódigo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas Categorias</SelectItem>
                  <SelectItem value="MDF">MDF / MDP</SelectItem>
                  <SelectItem value="FITA">Fitas de Borda</SelectItem>
                  <SelectItem value="FERRAGEM">Ferragens</SelectItem>
                  <SelectItem value="OUTROS">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => {
                setEditingProdId(null);
                setProdCode('');
                setProdSubcodes('');
                setProdDescription('');
                setProdUnit('M2');
                setProdUnitPrice('');
                setProdFitaMetros('20');
                setProdCategory('MDF');
                setProdModalOpen(true);
              }}
              className="bg-[#17191d] text-xs text-white hover:bg-slate-800"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5 text-emerald-400" />
              Novo Produto
            </Button>
          </div>

          {/* Products Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-[#17191d] text-[11px] uppercase tracking-wider text-white">
                  <tr>
                    <th className="py-3 pl-4 pr-2 font-semibold">Código</th>
                    <th className="px-3 py-3 font-semibold">Subcódigos / Apelidos</th>
                    <th className="px-3 py-3 font-semibold">Descrição do Material</th>
                    <th className="px-3 py-3 text-center font-semibold">Categoria</th>
                    <th className="px-3 py-3 text-center font-semibold">Unidade</th>
                    <th className="px-3 py-3 text-right font-semibold">Preço Custo Base</th>
                    <th className="px-3 py-3 text-right font-semibold">Preço por Chapa (5,09m²)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {database
                    .filter(p => {
                      const term = searchTerm.toLowerCase();
                      const match =
                        p.code.toLowerCase().includes(term) ||
                        p.description.toLowerCase().includes(term) ||
                        (p.subcodes && p.subcodes.some(s => s.toLowerCase().includes(term)));
                      const catMatch = categoryFilter === 'ALL' || p.category === categoryFilter;
                      return match && catMatch;
                    })
                    .map(p => {
                      const isMDF = p.category === 'MDF' || p.unit === 'M2';
                      const chapaPrice = isMDF ? round2(p.unit_price * CHAPA_AREA_M2) : null;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 pl-4 pr-2 font-mono font-bold text-slate-900">
                            {p.code}
                          </td>

                          <td className="px-3 py-3">
                            {p.subcodes && p.subcodes.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {p.subcodes.map(sub => (
                                  <span
                                    key={sub}
                                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                                  >
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="px-3 py-3 font-medium text-slate-800">
                            {p.description}
                          </td>

                          <td className="px-3 py-3 text-center">
                            <Badge
                              variant="outline"
                              className={
                                p.category === 'MDF'
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : p.category === 'FITA'
                                  ? 'border-purple-200 bg-purple-50 text-purple-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                              }
                            >
                              {p.category || 'GERAL'}
                            </Badge>
                          </td>

                          <td className="px-3 py-3 text-center font-semibold text-slate-600">
                            {p.unit}
                          </td>

                          <td className="px-3 py-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={p.unit_price}
                              onChange={e => handleUpdateProductField(p.id, 'unit_price', parseFloat(e.target.value) || 0)}
                              className="w-28 ml-auto text-right font-bold text-slate-900 text-xs"
                            />
                          </td>

                          <td className="px-3 py-3 text-right">
                            {chapaPrice !== null ? (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={chapaPrice}
                                onChange={e => {
                                  const newChapaPrice = parseFloat(e.target.value) || 0;
                                  const newUnitPrice = round2(newChapaPrice / CHAPA_AREA_M2);
                                  handleUpdateProductField(p.id, 'unit_price', newUnitPrice);
                                }}
                                className="w-28 ml-auto text-right font-medium text-slate-600 text-xs"
                              />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Editar Preços da Linha */}
      <Dialog open={editLineModalOpen} onOpenChange={setEditLineModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Editar Preços: {selectedBrand} — {editingLine?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500">
              Altere os valores de custo por chapa inteira (2,75m × 1,85m). O sistema recalcula automaticamente o metro quadrado e o preço de venda com a margem cadastrada.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Chapa 6mm (R$)</Label>
                <Input
                  placeholder="Ex: 280,00"
                  value={editPrice6mm}
                  onChange={e => setEditPrice6mm(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Chapa 15mm (R$)</Label>
                <Input
                  placeholder="Ex: 395,00"
                  value={editPrice15mm}
                  onChange={e => setEditPrice15mm(e.target.value)}
                  className="mt-1 font-bold text-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Chapa 18mm (R$)</Label>
                <Input
                  placeholder="Ex: 457,00"
                  value={editPrice18mm}
                  onChange={e => setEditPrice18mm(e.target.value)}
                  className="mt-1 font-bold text-slate-900"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Chapa 25mm (R$)</Label>
                <Input
                  placeholder="Ex: 650,00"
                  value={editPrice25mm}
                  onChange={e => setEditPrice25mm(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLineModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLine} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Salvar Novos Preços
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Adicionar Linha */}
      <Dialog open={addLineModalOpen} onOpenChange={setAddLineModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Linha em {selectedBrand}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Nome da Linha / Padrão</Label>
              <Input
                placeholder="Ex: Nova Coleção Carvalho"
                value={newLineName}
                onChange={e => setNewLineName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Chapa 6mm (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={editPrice6mm}
                  onChange={e => setEditPrice6mm(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Chapa 15mm (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={editPrice15mm}
                  onChange={e => setEditPrice15mm(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Chapa 18mm (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={editPrice18mm}
                  onChange={e => setEditPrice18mm(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Chapa 25mm (R$)</Label>
                <Input
                  placeholder="0,00"
                  value={editPrice25mm}
                  onChange={e => setEditPrice25mm(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLineModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddNewLine} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Cadastrar Linha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Adicionar Nova Marca */}
      <Dialog open={addBrandModalOpen} onOpenChange={setAddBrandModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Marca</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-slate-500">
              Crie uma nova marca no catálogo. Após criar, você poderá adicionar linhas e padrões de cores dentro dela.
            </p>
            <div>
              <Label className="text-xs font-semibold">Nome da Marca</Label>
              <Input
                placeholder="Ex: Eucatex, Berneck, Guararapes..."
                value={newBrandName}
                onChange={e => setNewBrandName(e.target.value)}
                className="mt-1"
                onKeyDown={e => e.key === 'Enter' && handleAddBrand()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBrandModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddBrand} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Criar Marca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
