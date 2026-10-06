import { DecimalInput } from "@/components/ui/decimal-input";
import { useState, useRef } from 'react';
import { 
  Search, Plus, Trash2, Edit2, RotateCcw, Package, Layers, Download, Upload, 
  Check, DollarSign, ArrowRight, ShieldAlert, Sparkles, Filter, Wrench, Palette, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { toast } from 'sonner';
import { ProductItem, BudgetSettings } from '@/lib/orcamento/types';
import { DEFAULT_MATERIALS } from '@/lib/orcamento/default-materials';
import { 
  INITIAL_CHAPAS_CATALOG, CatalogByBrand, ChapaLineItem, AcessorioItem, BrandCatalog, AcessoriosCatalog, MaoDeObraItem, MaoDeObraCatalog 
} from '@/lib/orcamento/chapas-catalog';
import { CHAPA_AREA_M2, round2, chapaSalePrice, calculateAdditionsFactor } from '@/lib/orcamento/calculator';
import { parseLocaleNumber } from '@/lib/orcamento/parsers';

interface DatabaseTabProps {
  database: ProductItem[];
  setDatabase: React.Dispatch<React.SetStateAction<ProductItem[]>>;
  settings: BudgetSettings;
  catalog: CatalogByBrand;
  setCatalog: React.Dispatch<React.SetStateAction<CatalogByBrand>>;
}

const BRAND_ORDER = ['Arauco', 'Berneck', 'Duratex', 'Eucatex', 'Fórmica', 'Greenplac', 'Guararapes', 'Sudati', 'Mão de Obra Fixa'];

export function OrcamentoDatabaseTab({ database, setDatabase, settings, catalog, setCatalog }: DatabaseTabProps) {
  const [subTab, setSubTab] = useState<'chapas' | 'produtos'>('chapas');

  const [selectedBrand, setSelectedBrand] = useState<string>('Arauco');
  const [brandSearch, setBrandSearch] = useState('');

  // Editing state for Chapa Line
  const [editLineModalOpen, setEditLineModalOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ChapaLineItem | null>(null);
  const [editLineColors, setEditLineColors] = useState('');
  const [editPrice6mm, setEditPrice6mm] = useState('');
  const [editPrice15mm, setEditPrice15mm] = useState('');
  const [editPrice18mm, setEditPrice18mm] = useState('');
  const [editPrice25mm, setEditPrice25mm] = useState('');
  const [editPrice30mm, setEditPrice30mm] = useState('');

  // Add line modal
  const [addLineModalOpen, setAddLineModalOpen] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [newLineColors, setNewLineColors] = useState('');

  // View colors modal
  const [viewingColorsLine, setViewingColorsLine] = useState<ChapaLineItem | null>(null);
  const [viewColorsModalOpen, setViewColorsModalOpen] = useState(false);
  const [colorModalSearch, setColorModalSearch] = useState('');

  // State for Mão de Obra Fixa
  const [editMoModalOpen, setEditMoModalOpen] = useState(false);
  const [editingMo, setEditingMo] = useState<MaoDeObraItem | null>(null);
  const [editMoName, setEditMoName] = useState('');
  const [editMoUnit, setEditMoUnit] = useState('UN');
  const [editMoPrice, setEditMoPrice] = useState('');
  const [editMoDesc, setEditMoDesc] = useState('');
  const [addMoModalOpen, setAddMoModalOpen] = useState(false);

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

  const safeCatalog = (catalog && typeof catalog === 'object' && Object.keys(catalog).length > 0)
    ? catalog
    : INITIAL_CHAPAS_CATALOG;
  const safeDatabase = Array.isArray(database) ? database : [];

  // Ordenação oficial das 8 marcas e exclusão de alias/acessórios
  const brandNames = Object.keys(safeCatalog)
    .filter(b => b !== 'Acessórios' && b !== 'Bernek')
    .sort((a, b) => {
      const idxA = BRAND_ORDER.indexOf(a);
      const idxB = BRAND_ORDER.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });

  const activeBrandName = brandNames.includes(selectedBrand) ? selectedBrand : (brandNames[0] || 'Arauco');
  const activeBrandData = safeCatalog[activeBrandName] || safeCatalog['Arauco'] || Object.values(safeCatalog)[0];

  const activeBrandTotalColors = (activeBrandData && activeBrandData.type === 'brand' && Array.isArray(activeBrandData.lines))
    ? activeBrandData.lines.reduce((acc, l) => acc + (Array.isArray(l.colors) ? l.colors.length : 0), 0)
    : 0;

  // Filter lines for active brand (pesquisa por nome da Linha E por nome da Cor/Padrão)
  const brandQuery = brandSearch.trim().toLowerCase();
  const filteredLines = (activeBrandData && activeBrandData.type === 'brand' && Array.isArray(activeBrandData.lines))
    ? activeBrandData.lines.filter(l => {
        if (!l) return false;
        if (!brandQuery) return true;
        if (l.name && l.name.toLowerCase().includes(brandQuery)) return true;
        if (Array.isArray(l.colors) && l.colors.some(c => typeof c === 'string' && c.toLowerCase().includes(brandQuery))) return true;
        return false;
      })
    : [];

  const filteredMaoDeObra = (activeBrandData && activeBrandData.type === 'maodeobra' && Array.isArray(activeBrandData.items))
    ? activeBrandData.items.filter(m =>
        m && (
          (m.name && m.name.toLowerCase().includes(brandSearch.toLowerCase())) ||
          (m.description && m.description.toLowerCase().includes(brandSearch.toLowerCase()))
        )
      )
    : [];

  // Handlers para o Catálogo Geral de Materiais (Adicionar / Editar / Excluir)
  const handleOpenAddProduct = () => {
    setEditingProdId(null);
    setProdCode('');
    setProdSubcodes('');
    setProdDescription('');
    setProdCategory('FERRAGEM');
    setProdUnit('UN');
    setProdUnitPrice('');
    setProdFitaMetros('20');
    setProdModalOpen(true);
  };

  const handleOpenEditProduct = (p: ProductItem) => {
    setEditingProdId(p.id);
    setProdCode(p.code);
    setProdSubcodes((p.subcodes || []).join(', '));
    setProdDescription(p.description);
    setProdCategory(p.category || 'OUTROS');
    setProdUnit(p.unit);
    setProdUnitPrice(p.unit_price.toString());
    setProdFitaMetros(p.fita_metros ? p.fita_metros.toString() : '20');
    setProdModalOpen(true);
  };

  const handleSaveProduct = () => {
    if (!prodCode.trim()) {
      toast.error('Informe o código do material.');
      return;
    }
    if (!prodDescription.trim()) {
      toast.error('Informe a descrição do material.');
      return;
    }
    const priceNum = parseLocaleNumber(prodUnitPrice, -1);
    if (priceNum < 0) {
      toast.error('Informe um valor de preço válido.');
      return;
    }

    const subArr = prodSubcodes
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    const previous = database.find(p => p.id === editingProdId);
    const oldCodes = [previous?.code, ...(previous?.subcodes || [])].filter(Boolean).map(code => code!.trim().toLowerCase());
    const newCodes = [prodCode.trim(), ...subArr].map(code => code.toLowerCase());
    const conflict = database.find(p => p.id !== editingProdId && [p.code, ...(p.subcodes || [])].some(code => newCodes.includes(code.trim().toLowerCase()) && !oldCodes.includes(code.trim().toLowerCase())));
    if (conflict) {
      toast.error(`Código ou apelido já utilizado por ${conflict.description} (${conflict.code}). Use um vínculo exclusivo para evitar preço incorreto.`);
      return;
    }

    if (editingProdId) {
      setDatabase(prev => prev.map(p => {
        if (p.id === editingProdId) {
          return {
            ...p,
            code: prodCode.trim().toUpperCase(),
            subcodes: subArr,
            description: prodDescription.trim(),
            category: prodCategory as any,
            unit: prodUnit.trim().toUpperCase(),
            catalog_brand: priceNum !== p.unit_price || prodUnit !== p.unit ? undefined : p.catalog_brand,
            catalog_line_id: priceNum !== p.unit_price || prodUnit !== p.unit ? undefined : p.catalog_line_id,
            catalog_thickness: priceNum !== p.unit_price || prodUnit !== p.unit ? undefined : p.catalog_thickness,
            unit_price: priceNum,
            fita_metros: prodCategory === 'FITA' ? Number(prodFitaMetros) || 20 : undefined,
          };
        }
        return p;
      }));
      toast.success(`Material "${prodCode}" atualizado com sucesso!`);
    } else {
      const newProd: ProductItem = {
        id: `mat-${Date.now()}`,
        code: prodCode.trim().toUpperCase(),
        subcodes: subArr,
        description: prodDescription.trim(),
        category: prodCategory as any,
        unit: prodUnit.trim().toUpperCase() || 'UN',
        unit_price: priceNum,
        fita_metros: prodCategory === 'FITA' ? Number(prodFitaMetros) || 20 : undefined,
      };
      setDatabase(prev => [newProd, ...prev]);
      toast.success(`Material "${newProd.code}" cadastrado com sucesso!`);
    }

    setProdModalOpen(false);
  };

  const handleDeleteProduct = (id: string, code: string) => {
    if (confirm(`Deseja realmente excluir o material "${code}" do catálogo geral?`)) {
      setDatabase(prev => prev.filter(p => p.id !== id));
      toast.success(`Material "${code}" removido.`);
    }
  };

  const handleResetDatabase = () => {
    if (confirm('Deseja restaurar todos os materiais do Catálogo Geral para os valores padrão da DF Móveis?')) {
      setDatabase(DEFAULT_MATERIALS);
      toast.success('Catálogo Geral restaurado com sucesso!');
    }
  };

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
    setEditLineColors((line.colors || []).join(', '));
    setEditPrice6mm(line.prices?.['6mm'] ? line.prices['6mm']!.toString() : '');
    setEditPrice15mm(line.prices?.['15mm'] ? line.prices['15mm']!.toString() : '');
    setEditPrice18mm(line.prices?.['18mm'] ? line.prices['18mm']!.toString() : '');
    setEditPrice25mm(line.prices?.['25mm'] ? line.prices['25mm']!.toString() : '');
    setEditPrice30mm(line.prices?.['30mm'] ? line.prices['30mm']!.toString() : '');
    setEditLineModalOpen(true);
  };

  // Save Line Edits
  const handleSaveLine = () => {
    if (!editingLine) return;

    const parsePrice = (value: string) => value.trim() ? parseLocaleNumber(value, -1) : null;
    const p6 = parsePrice(editPrice6mm);
    const p15 = parsePrice(editPrice15mm);
    const p18 = parsePrice(editPrice18mm);
    const p25 = parsePrice(editPrice25mm);
    const p30 = parsePrice(editPrice30mm);
    if ([p6, p15, p18, p25, p30].some(price => price !== null && price <= 0)) {
      toast.error('Os preços informados precisam ser maiores que zero.');
      return;
    }

    const updatedColors = editLineColors
      .split(/[,;\n]/)
      .map(c => c.trim())
      .filter(Boolean);

    setCatalog(prev => {
      const brandObj = prev[selectedBrand];
      if (brandObj.type !== 'brand') return prev;

      const updatedLines = brandObj.lines.map(l =>
        l.id === editingLine.id
          ? {
              ...l,
              colors: updatedColors,
              prices: {
                '6mm': p6,
                '15mm': p15,
                '18mm': p18,
                '25mm': p25,
        '30mm': p30,
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
    syncLineToDatabase(selectedBrand, editingLine, { p6, p15, p18, p25, p30 });

    setEditLineModalOpen(false);
    toast.success(`Valores da linha "${editingLine.name}" atualizados com sucesso!`);
  };

  // Keep linked product views in sync; the catalogue remains the price authority.
  const syncLineToDatabase = (
    brand: string,
    line: ChapaLineItem,
    prices: { p6: number | null; p15: number | null; p18: number | null; p25: number | null; p30: number | null }
  ) => {
    const values = { '6mm': prices.p6, '15mm': prices.p15, '18mm': prices.p18, '25mm': prices.p25, '30mm': prices.p30 };
    setDatabase(prev => prev.map(product => {
      if (product.catalog_brand !== brand || product.catalog_line_id !== line.id || !product.catalog_thickness) return product;
      const board = values[product.catalog_thickness];
      return { ...product, unit_price: board ? chapaSalePrice(board, line.width * line.height) : 0 };
    }));
  };

  const handleAddNewLine = () => {
    if (!newLineName.trim()) {
      toast.error('Informe o nome da linha ou padrão.');
      return;
    }

    const parsePrice = (value: string) => value.trim() ? parseLocaleNumber(value, -1) : null;
    const p6 = parsePrice(editPrice6mm);
    const p15 = parsePrice(editPrice15mm);
    const p18 = parsePrice(editPrice18mm);
    const p25 = parsePrice(editPrice25mm);
    const p30 = parsePrice(editPrice30mm);
    if ([p6, p15, p18, p25, p30].some(price => price !== null && price <= 0)) {
      toast.error('Os preços informados precisam ser maiores que zero.');
      return;
    }

    const parsedColors = newLineColors
      .split(/[,;\n]/)
      .map(c => c.trim())
      .filter(Boolean);

    const newLine: ChapaLineItem = {
      id: `${selectedBrand.toLowerCase()}-${Date.now()}`,
      name: newLineName.trim(),
      colors: parsedColors,
      width: 2.75,
      height: 1.85,
      area: CHAPA_AREA_M2,
      prices: {
        '6mm': p6,
        '15mm': p15,
        '18mm': p18,
        '25mm': p25,
        '30mm': p30,
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

    syncLineToDatabase(selectedBrand, newLine, { p6, p15, p18, p25, p30 });

    setAddLineModalOpen(false);
    setNewLineName('');
    setNewLineColors('');
    setEditPrice6mm('');
    setEditPrice15mm('');
    setEditPrice18mm('');
    setEditPrice25mm('');
    setEditPrice30mm('');
    toast.success(`Linha "${newLine.name}" cadastrada na marca ${selectedBrand}!`);
  };

  // Mão de Obra Fixa Handlers
  const handleOpenEditMo = (mo: MaoDeObraItem) => {
    setEditingMo(mo);
    setEditMoName(mo.name);
    setEditMoUnit(mo.unit || 'UN');
    setEditMoPrice(mo.price ? mo.price.toString() : '0');
    setEditMoDesc(mo.description || '');
    setEditMoModalOpen(true);
  };

  const handleSaveMo = () => {
    if (!editingMo) return;
    const priceNum = parseLocaleNumber(editMoPrice, -1);
    if (priceNum < 0) {
      toast.error('Informe um valor de preço válido.');
      return;
    }
    setCatalog(prev => {
      const moCat = prev['Mão de Obra Fixa'];
      if (!moCat || moCat.type !== 'maodeobra') return prev;
      return {
        ...prev,
        'Mão de Obra Fixa': {
          ...moCat,
          items: moCat.items.map(item => item.id === editingMo.id
            ? { ...item, name: editMoName.trim() || item.name, unit: editMoUnit.trim() || 'UN', price: priceNum, description: editMoDesc.trim() || undefined }
            : item
          )
        }
      };
    });

    // Sincroniza com database
    setDatabase(prev => prev.map(p => {
      if (p.category === 'MAO_DE_OBRA' && (p.code.toLowerCase().includes(editingMo.id.toLowerCase()) || p.description.toLowerCase().includes(editingMo.name.toLowerCase()))) {
        return { ...p, unit_price: priceNum };
      }
      return p;
    }));

    setEditMoModalOpen(false);
    toast.success(`Preço de "${editMoName}" atualizado para R$ ${priceNum.toFixed(2)}!`);
  };

  const handleAddNewMo = () => {
    if (!editMoName.trim()) {
      toast.error('Informe o nome da mão de obra ou processo.');
      return;
    }
    const priceNum = parseLocaleNumber(editMoPrice, -1);
    if (priceNum < 0) {
      toast.error('Informe um valor de preço válido.');
      return;
    }
    const newMo: MaoDeObraItem = {
      id: `mo-${Date.now()}`,
      name: editMoName.trim(),
      unit: editMoUnit.trim() || 'UN',
      price: priceNum,
      description: editMoDesc.trim() || undefined,
    };
    setCatalog(prev => {
      const moCat = prev['Mão de Obra Fixa'];
      if (!moCat || moCat.type !== 'maodeobra') return prev;
      return {
        ...prev,
        'Mão de Obra Fixa': {
          ...moCat,
          items: [newMo, ...moCat.items],
        }
      };
    });
    setAddMoModalOpen(false);
    setEditMoName('');
    setEditMoPrice('');
    setEditMoDesc('');
    toast.success(`Mão de obra "${newMo.name}" adicionada com sucesso!`);
  };

  const handleDeleteMo = (id: string, name: string) => {
    if (confirm(`Deseja remover "${name}" da tabela de mão de obra fixa?`)) {
      setCatalog(prev => {
        const moCat = prev['Mão de Obra Fixa'];
        if (!moCat || moCat.type !== 'maodeobra') return prev;
        return {
          ...prev,
          'Mão de Obra Fixa': {
            ...moCat,
            items: moCat.items.filter(item => item.id !== id),
          }
        };
      });
      toast.success(`"${name}" removido.`);
    }
  };

  // Reset to original catalog
  const handleResetCatalog = () => {
    if (confirm('Deseja restaurar todos os preços de chapas para a tabela padrão?')) {
      const cleanCatalog = { ...INITIAL_CHAPAS_CATALOG };
      delete cleanCatalog['Acessórios'];
      setCatalog(cleanCatalog);
      toast.success('Catálogo de chapas restaurado com sucesso!');
    }
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
            Catálogo Geral de Materiais ({safeDatabase.length})
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {subTab === 'chapas' ? (
            <Button variant="outline" size="sm" onClick={handleResetCatalog} className="text-xs">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restaurar Tabela de Chapas
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleResetDatabase} className="text-xs">
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Restaurar Catálogo Geral
            </Button>
          )}
        </div>
      </div>

      {/* VIEW 1: CHAPAS POR MARCA */}
      {subTab === 'chapas' && (
        <div className="space-y-4">
          {/* Brand Selector Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {brandNames.map(brand => {
              const isSelected = activeBrandName === brand;
              const bData = safeCatalog[brand];
              if (!bData) return null;
              const count =
                bData.type === 'brand'
                  ? (Array.isArray((bData as BrandCatalog).lines) ? (bData as BrandCatalog).lines.length : 0)
                  : bData.type === 'acessorios'
                  ? (Array.isArray((bData as AcessoriosCatalog).items) ? (bData as AcessoriosCatalog).items.length : 0)
                  : (Array.isArray((bData as MaoDeObraCatalog).items) ? (bData as MaoDeObraCatalog).items.length : 0);

              return (
                <button
                  key={brand}
                  onClick={() => {
                    setSelectedBrand(brand);
                    setBrandSearch('');
                  }}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[#c92031] text-white shadow-xs'
                      : 'border border-stone-200/90 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50 shadow-2xs'
                  }`}
                >
                  <span>{brand}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Brand Toolbar: Search and Add Line */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200/90 bg-white/95 p-3 shadow-2xs">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                <Input
                  placeholder={`Buscar linhas e cores em ${selectedBrand}...`}
                  value={brandSearch}
                  onChange={e => setBrandSearch(e.target.value)}
                  className="pl-9 text-xs bg-white border-stone-200 rounded-lg focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 text-xs text-stone-600 bg-stone-50/80 px-3 py-1.5 rounded-lg border border-stone-200">
                <span>Margem ativa:</span>
                <strong className="text-[#c92031] font-mono">{settings.margin}%</strong>
                <span className="text-[10px] text-stone-400">(Preço de Venda sugerido automático)</span>
              </div>

              {activeBrandData && activeBrandData.type === 'brand' && (
                <Button
                  onClick={() => {
                    setNewLineName('');
                    setEditPrice6mm('');
                    setEditPrice15mm('');
                    setEditPrice18mm('');
                    setEditPrice25mm('');
                    setEditPrice30mm('');
                    setAddLineModalOpen(true);
                  }}
                  className="bg-[#17191d] text-xs text-white hover:bg-stone-800 rounded-lg shadow-2xs h-9 px-3.5 font-medium"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5 text-[#cbb27a]" />
                  Nova Linha em {selectedBrand}
                </Button>
              )}

              {activeBrandData && activeBrandData.type === 'maodeobra' && (
                <Button
                  onClick={() => {
                    setEditMoName('');
                    setEditMoPrice('');
                    setEditMoUnit('UN');
                    setEditMoDesc('');
                    setAddMoModalOpen(true);
                  }}
                  className="bg-[#17191d] text-xs text-white hover:bg-stone-800 rounded-lg shadow-2xs h-9 px-3.5 font-medium"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5 text-[#cbb27a]" />
                  Nova Mão de Obra Fixa
                </Button>
              )}
            </div>
          </div>

          {/* Table of Brand Lines */}
          {activeBrandData && activeBrandData.type === 'brand' ? (
            <div className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-[#17191d] text-[10px] uppercase tracking-wider text-white font-semibold">
                    <tr>
                      <th className="py-3 pl-4 pr-3 font-semibold">Linha</th>
                      <th className="px-3 py-3 font-semibold">
                        <div className="flex items-center gap-1.5">
                          <Palette className="h-3.5 w-3.5 text-[#cbb27a]" />
                          <span>Cores / Padrões ({activeBrandTotalColors})</span>
                        </div>
                      </th>
                      <th className="px-3 py-3 text-center font-semibold">Dimensões</th>
                      <th className="px-3 py-3 text-right font-semibold">6mm (Custo / Venda)</th>
                      <th className="px-3 py-3 text-right font-semibold bg-white/5">15mm (Custo / Venda)</th>
                      <th className="px-3 py-3 text-right font-semibold">18mm (Custo / Venda)</th>
                      <th className="px-3 py-3 text-right font-semibold">25mm (Custo)</th>
                      <th className="px-3 py-3 text-right font-semibold">30mm (Custo)</th>
                      <th className="py-3 pl-2 pr-4 text-center font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLines.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400">
                          Nenhuma linha encontrada com o termo "{brandSearch}".
                        </td>
                      </tr>
                    ) : (
                      filteredLines.map(line => {
                        const p6 = line?.prices ? line.prices['6mm'] : null;
                        const p15 = line?.prices ? line.prices['15mm'] : null;
                        const p18 = line?.prices ? line.prices['18mm'] : null;
                        const p25 = line?.prices ? line.prices['25mm'] : null;

                        const width = line?.width || 2.75;
                        const height = line?.height || 1.85;
                        const area = line?.area || round2(width * height);

                        const sale15 = getSalePrice(p15);
                        const sale18 = getSalePrice(p18);

                        const colors = Array.isArray(line?.colors) ? line.colors : [];
                        const query = brandSearch.trim().toLowerCase();
                        // Se o operador está buscando uma cor específica, prioriza exibi-la nas tags
                        const sortedColors = query
                          ? [...colors].sort((a, b) => {
                              const matchA = typeof a === 'string' && a.toLowerCase().includes(query) ? -1 : 1;
                              const matchB = typeof b === 'string' && b.toLowerCase().includes(query) ? -1 : 1;
                              return matchA - matchB;
                            })
                          : colors;

                        return (
                          <tr key={line.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 pl-4 pr-3 align-top min-w-[150px]">
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-900 leading-tight">{line.name}</span>
                                <span className="text-[10px] text-stone-400 mt-0.5">{selectedBrand}</span>
                              </div>
                            </td>

                            {/* Coluna Cores / Padrões do Promob Plus */}
                            <td className="px-3 py-3 align-top max-w-[340px]">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-[10px] font-semibold bg-stone-100 text-stone-700 border-stone-200">
                                    {colors.length} {colors.length === 1 ? 'padrão' : 'padrões'}
                                  </Badge>
                                  {colors.length > 3 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingColorsLine(line);
                                        setColorModalSearch('');
                                        setViewColorsModalOpen(true);
                                      }}
                                      className="text-[10px] font-semibold text-[#c92031] hover:underline flex items-center gap-0.5"
                                    >
                                      <Eye className="h-3 w-3" />
                                      <span>Ver todas</span>
                                    </button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {sortedColors.slice(0, 4).map(color => {
                                    const isMatch = query && color.toLowerCase().includes(query);
                                    return (
                                      <span
                                        key={color}
                                        className={`inline-block rounded px-1.5 py-0.5 text-[11px] leading-tight ${
                                          isMatch
                                            ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300'
                                            : 'bg-stone-50 text-stone-600 border border-stone-200'
                                        }`}
                                      >
                                        {color}
                                      </span>
                                    );
                                  })}
                                  {colors.length > 4 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setViewingColorsLine(line);
                                        setColorModalSearch('');
                                        setViewColorsModalOpen(true);
                                      }}
                                      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-medium bg-red-50 text-[#c92031] hover:bg-red-100 transition-colors"
                                    >
                                      +{colors.length - 4} mais
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-3 text-center text-slate-500 font-mono text-[11px] align-top">
                              {width}m × {height}m ({area}m²)
                            </td>

                            {/* 6mm */}
                            <td className="px-3 py-3 text-right">
                              {p6 ? (
                                <div>
                                  <span className="font-bold text-slate-900 text-sm">
                                    {(chapaSalePrice(p6, width * height)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                                  </span>
                                  <span className="block text-[10px] text-slate-400 mt-0.5">
                                    Chapa: {p6.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                  <span className="font-bold text-slate-900 text-sm">
                                    {(chapaSalePrice(p15, width * height)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                                  </span>
                                  {sale15 && (
                                    <span className="block text-[10px] font-semibold text-emerald-700 mt-0.5">
                                      Venda: {sale15.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  )}
                                  <span className="block text-[10px] text-slate-400 mt-0.5">
                                    Chapa: {p15.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                                  <span className="font-bold text-slate-900 text-sm">
                                    {(chapaSalePrice(p18, width * height)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                                  </span>
                                  {sale18 && (
                                    <span className="block text-[10px] font-semibold text-emerald-700 mt-0.5">
                                      Venda: {sale18.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </span>
                                  )}
                                  <span className="block text-[10px] text-slate-400 mt-0.5">
                                    Chapa: {p18.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            {/* 25mm */}
                            <td className="px-3 py-3 text-right">
                              {p25 ? (
                                <div>
                                  <span className="font-bold text-slate-900 text-sm">
                                    {(chapaSalePrice(p25, width * height)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²
                                  </span>
                                  <span className="block text-[10px] text-slate-400 mt-0.5">
                                    Chapa: {p25.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>

                            <td className="px-3 py-3 text-right">
                              {line.prices['30mm'] ? (
                                <div>
                                  <span className="font-bold text-slate-900 text-sm">{chapaSalePrice(line.prices['30mm'], width * height).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/m²</span>
                                  <span className="block text-[10px] text-slate-400 mt-0.5">Chapa: {line.prices['30mm'].toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                                </div>
                              ) : <span className="text-slate-300">—</span>}
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
          ) : activeBrandData && activeBrandData.type === 'maodeobra' ? (
            /* MÃO DE OBRA FIXA & PROCESSOS DE FABRICAÇÃO */
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-[#17191d] text-[11px] uppercase tracking-wider text-white">
                    <tr>
                      <th className="py-3.5 pl-4 pr-3 font-semibold">Processo / Mão de Obra</th>
                      <th className="px-3 py-3.5 font-semibold">Descrição do Processo</th>
                      <th className="px-3 py-3.5 text-center font-semibold">Unidade</th>
                      <th className="px-3 py-3.5 text-right font-semibold">Custo Base (Tabela)</th>
                      <th className="px-3 py-3.5 text-right font-semibold">Preço Sugerido ({settings.margin}%)</th>
                      <th className="py-3.5 pl-2 pr-4 text-center font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMaoDeObra.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400">
                          Nenhum processo de mão de obra encontrado com "{brandSearch}".
                        </td>
                      </tr>
                    ) : (
                      filteredMaoDeObra.map(mo => {
                        const price = typeof mo?.price === 'number' ? mo.price : 0;
                        const sale = getSalePrice(price);
                        return (
                          <tr key={mo.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 pl-4 pr-3 font-bold text-slate-900">
                              <div className="flex items-center gap-2">
                                <Wrench className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                <span>{mo.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-slate-500 text-[11px]">
                              {mo.description || 'Processo de fabricação padrão'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700 text-[10px]">
                                {mo.unit || 'UN'}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-right font-black text-slate-900">
                              {price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </td>
                            <td className="px-3 py-3 text-right font-bold text-emerald-700">
                              {sale ? sale.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                            </td>
                            <td className="py-3 pl-2 pr-4 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenEditMo(mo)}
                                  className="h-7 text-xs hover:bg-[#17191d] hover:text-white"
                                >
                                  <Edit2 className="mr-1 h-3 w-3" />
                                  Editar Preço
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteMo(mo.id, mo.name)}
                                  className="h-7 w-7 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* VIEW 2: CATÁLOGO GERAL DE MATERIAIS */}
      {subTab === 'produtos' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200/90 bg-white/95 p-3 shadow-2xs">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                <Input
                  placeholder="Buscar produto, código ou subcódigo..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9 text-xs bg-white border-stone-200 rounded-lg focus:border-[#c92031] focus:ring-1 focus:ring-[#c92031]/30"
                />
              </div>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-44 text-xs bg-white border-stone-200 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas Categorias</SelectItem>
                  <SelectItem value="FERRAGEM">Ferragens & Acessórios</SelectItem>
                  <SelectItem value="MDF">MDF / MDP</SelectItem>
                  <SelectItem value="FITA">Fitas de Borda</SelectItem>
                  <SelectItem value="MAO_DE_OBRA">Mão de Obra Fixa</SelectItem>
                  <SelectItem value="OUTROS">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={handleOpenAddProduct}
                className="bg-[#17191d] text-xs text-white hover:bg-stone-800 rounded-lg shadow-2xs h-9 px-3.5 font-medium"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5 text-[#cbb27a]" />
                Novo Material / Acessório
              </Button>
            </div>
          </div>

          {/* Products Table */}
          <div className="overflow-hidden rounded-xl border border-stone-200/90 bg-white shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-[#17191d] text-[10px] uppercase tracking-wider text-white font-semibold">
                  <tr>
                    <th className="py-3 pl-4 pr-2 font-semibold">Código</th>
                    <th className="px-3 py-3 font-semibold">Subcódigos / Apelidos</th>
                    <th className="px-3 py-3 font-semibold">Descrição do Material</th>
                    <th className="px-3 py-3 text-center font-semibold">Categoria</th>
                    <th className="px-3 py-3 text-center font-semibold">Unidade</th>
                    <th className="px-3 py-3 text-right font-semibold">Preço Custo / Preço Final</th>
                    <th className="px-3 py-3 text-right font-semibold">Preço por Chapa (5,09m²)</th>
                    <th className="py-3 pl-2 pr-4 text-center font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {safeDatabase
                    .filter(p => {
                      if (!p) return false;
                      const term = searchTerm.toLowerCase();
                      const code = (p.code || '').toLowerCase();
                      const desc = (p.description || '').toLowerCase();
                      const subMatch = Array.isArray(p.subcodes) && p.subcodes.some(s => typeof s === 'string' && s.toLowerCase().includes(term));
                      const match = code.includes(term) || desc.includes(term) || subMatch;
                      const catMatch = categoryFilter === 'ALL' || p.category === categoryFilter;
                      return match && catMatch;
                    })
                    .map(p => {
                      const unitPrice = typeof p.unit_price === 'number' ? p.unit_price : 0;
                      const isMDF = p.category === 'MDF' || p.unit === 'M2';
                      const chapaPrice = isMDF ? round2(unitPrice * CHAPA_AREA_M2) : null;

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
                                  : p.category === 'FERRAGEM'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : p.category === 'MAO_DE_OBRA'
                                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                              }
                            >
                              {p.category === 'FERRAGEM' ? 'FERRAGEM' : (p.category || 'GERAL')}
                            </Badge>
                          </td>

                          <td className="px-3 py-3 text-center font-semibold text-slate-600">
                            {p.unit}
                          </td>

                          <td className="px-3 py-3 text-right font-bold text-slate-900">
                            {unitPrice === 0 && (p.category === 'FERRAGEM' || p.category === 'ACESSORIO') ? (
                              <span className="text-amber-700 font-normal text-[11px] italic bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                A definir pelo operador
                              </span>
                            ) : (
                              unitPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            )}
                          </td>

                          <td className="px-3 py-3 text-right font-medium text-slate-600">
                            {chapaPrice !== null
                              ? chapaPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                              : '—'}
                          </td>

                          <td className="py-3 pl-2 pr-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenEditProduct(p)}
                                className="h-7 text-xs hover:bg-[#17191d] hover:text-white"
                              >
                                <Edit2 className="mr-1 h-3 w-3" />
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteProduct(p.id, p.code)}
                                className="h-7 w-7 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
        </div>
      )}

      {/* MODAL: Ver Cores e Padrões da Linha */}
      <Dialog open={viewColorsModalOpen} onOpenChange={setViewColorsModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Palette className="h-5 w-5 text-[#cbb27a]" />
              <span>{selectedBrand} — {viewingColorsLine?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-stone-500">
              {viewingColorsLine?.colors?.length || 0} padrões e cores catalogados no Promob Plus
            </DialogDescription>
          </DialogHeader>

          <div className="relative my-2">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-stone-400" />
            <Input
              placeholder="Filtrar cores desta linha..."
              value={colorModalSearch}
              onChange={e => setColorModalSearch(e.target.value)}
              className="pl-8 text-xs bg-stone-50 h-8"
            />
          </div>

          <div className="overflow-y-auto max-h-[50vh] pr-1 space-y-1">
            <div className="grid grid-cols-2 gap-2">
              {(viewingColorsLine?.colors || [])
                .filter(c => !colorModalSearch || c.toLowerCase().includes(colorModalSearch.toLowerCase().trim()))
                .map((color, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg border border-stone-200 bg-stone-50/70 hover:bg-stone-100 transition-colors text-xs text-stone-800"
                  >
                    <span className="h-2 w-2 rounded-full bg-[#c92031] shrink-0" />
                    <span className="font-medium truncate" title={color}>{color}</span>
                  </div>
                ))}
            </div>
            {viewingColorsLine?.colors?.filter(c => !colorModalSearch || c.toLowerCase().includes(colorModalSearch.toLowerCase().trim())).length === 0 && (
              <p className="text-center py-6 text-xs text-stone-400">
                Nenhuma cor encontrada com o termo "{colorModalSearch}".
              </p>
            )}
          </div>

          <DialogFooter className="mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewColorsModalOpen(false)}
              className="text-xs"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Editar Preços e Cores da Linha */}
      <Dialog open={editLineModalOpen} onOpenChange={setEditLineModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Editar Linha: {selectedBrand} — {editingLine?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500">
              Altere os valores de custo por chapa inteira (2,75m × 1,85m) e as cores correspondentes do Promob. O sistema recalcula automaticamente o metro quadrado e o preço de venda.
            </p>

            <div className="rounded-lg bg-stone-50 p-3 border border-stone-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5 text-[#cbb27a]" />
                  <span>Cores e Padrões ({editingLine?.colors?.length || 0})</span>
                </Label>
                <span className="text-[10px] text-stone-400">Separados por vírgula</span>
              </div>
              <textarea
                rows={3}
                value={editLineColors}
                onChange={e => setEditLineColors(e.target.value)}
                placeholder="Ex: Branco Supremo, Cacao, Canela..."
                className="w-full text-xs font-mono rounded-md border border-stone-200 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#c92031]"
              />
            </div>

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
              <div>
                <Label className="text-xs font-semibold">Chapa 30mm (R$)</Label>
                <Input placeholder="Ex: 400,00" value={editPrice30mm} onChange={e => setEditPrice30mm(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLineModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveLine} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Salvar Alterações
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

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Cores e Padrões Promob</Label>
                <span className="text-[10px] text-stone-400">Separados por vírgula</span>
              </div>
              <textarea
                rows={2}
                placeholder="Ex: Padrão 1, Padrão 2, Padrão 3..."
                value={newLineColors}
                onChange={e => setNewLineColors(e.target.value)}
                className="mt-1 w-full text-xs font-mono rounded-md border border-stone-200 p-2 bg-white focus:outline-none focus:ring-1 focus:ring-[#c92031]"
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
              <div>
                <Label className="text-xs">Chapa 30mm (R$)</Label>
                <Input placeholder="Ex: 400,00" value={editPrice30mm} onChange={e => setEditPrice30mm(e.target.value)} className="mt-1" />
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

      {/* MODAL: Editar Mão de Obra Fixa */}
      <Dialog open={editMoModalOpen} onOpenChange={setEditMoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Wrench className="h-5 w-5 text-amber-600" />
              Editar Mão de Obra / Processo
            </DialogTitle>
          </DialogHeader>
          {editingMo && (
            <div className="space-y-3 py-2 text-xs">
              <div>
                <Label className="text-xs font-semibold">Nome do Processo</Label>
                <Input
                  value={editMoName}
                  onChange={e => setEditMoName(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Preço de Custo Base (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={editMoPrice}
                    onChange={e => setEditMoPrice(e.target.value)}
                    className="mt-1 font-bold"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Unidade</Label>
                  <Input
                    placeholder="UN"
                    value={editMoUnit}
                    onChange={e => setEditMoUnit(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Descrição do Serviço (Opcional)</Label>
                <Input
                  placeholder="Ex: Usinagem e fita de borda"
                  value={editMoDesc}
                  onChange={e => setEditMoDesc(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveMo} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Adicionar Mão de Obra Fixa */}
      <Dialog open={addMoModalOpen} onOpenChange={setAddMoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Plus className="h-5 w-5 text-emerald-600" />
              Nova Mão de Obra Fixa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold">Nome do Processo / Serviço</Label>
              <Input
                placeholder="Ex: Porta Cava 45°, Montagem de Ilha"
                value={editMoName}
                onChange={e => setEditMoName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Preço de Custo Base (R$)</Label>
                <Input
                  placeholder="70,00"
                  value={editMoPrice}
                  onChange={e => setEditMoPrice(e.target.value)}
                  className="mt-1 font-bold"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Unidade</Label>
                <Input
                  placeholder="UN"
                  value={editMoUnit}
                  onChange={e => setEditMoUnit(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Descrição do Serviço (Opcional)</Label>
              <Input
                placeholder="Ex: Usinagem e acabamento especial"
                value={editMoDesc}
                onChange={e => setEditMoDesc(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMoModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddNewMo} className="bg-[#c92031] text-white hover:bg-[#aa1726]">
              Cadastrar Mão de Obra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: Adicionar / Editar Material no Catálogo Geral */}
      <Dialog open={prodModalOpen} onOpenChange={setProdModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingProdId ? 'Editar Preço do Material' : 'Cadastrar Novo Material / Acessório'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Código</Label>
              <Input
                value={prodCode}
                onChange={e => setProdCode(e.target.value)}
                placeholder="Ex: CORREDICA-TELESC-45 ou DOBRADICA-AMORT-35"
                className="mt-1 font-mono uppercase"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Subcódigos / Apelidos (separados por vírgula)</Label>
              <Input
                value={prodSubcodes}
                onChange={e => setProdSubcodes(e.target.value)}
                placeholder="Ex: CORR_45, TELESC_450"
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Descrição do Material</Label>
              <Input
                value={prodDescription}
                onChange={e => setProdDescription(e.target.value)}
                placeholder="Ex: Corrediça Telescópica Larga 450mm"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
                <Select value={prodCategory} onValueChange={setProdCategory}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FERRAGEM">Ferragem / Acessório</SelectItem>
                    <SelectItem value="MDF">MDF / MDP</SelectItem>
                    <SelectItem value="FITA">Fita de Borda</SelectItem>
                    <SelectItem value="MAO_DE_OBRA">Mão de Obra Fixa</SelectItem>
                    <SelectItem value="OUTROS">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Unidade</Label>
                <Select value={prodUnit} onValueChange={setProdUnit}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UN">UN (Unidade)</SelectItem>
                    <SelectItem value="PAR">PAR (Par)</SelectItem>
                    <SelectItem value="M2">M2 (Metro quadrado)</SelectItem>
                    <SelectItem value="M">M (Metro linear)</SelectItem>
                    <SelectItem value="CENTO">CENTO (100 un)</SelectItem>
                    <SelectItem value="KG">KG (Quilograma)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                {prodCategory === 'FERRAGEM' || prodCategory === 'ACESSORIO'
                  ? 'Preço Final do Acessório (R$) [Definido pelo Operador]'
                  : 'Preço Custo Base (R$)'}
              </Label>
              <DecimalInput
                type="number"
                step="0.01"
                value={prodUnitPrice}
                onChange={e => setProdUnitPrice(e.target.value)}
                placeholder="0,00"
                className="mt-1 font-mono font-bold"
              />
              {(prodCategory === 'FERRAGEM' || prodCategory === 'ACESSORIO') && (
                <p className="text-[11px] text-stone-500 mt-1">
                  Acessórios e ferragens (unitários ou par) não possuem preço de custo separado; o operador define diretamente o preço final.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setProdModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveProduct} className="bg-[#17191d] text-white">
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
