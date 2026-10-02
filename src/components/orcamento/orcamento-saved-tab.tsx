import { useState } from 'react';
import { 
  FileSpreadsheet, Download, Trash2, Eye, Layers, CheckSquare, Square 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { SavedBudget } from '@/lib/orcamento/types';
import { generateBudgetPdf } from '@/lib/orcamento/pdf-generator';

interface SavedTabProps {
  savedBudgets: SavedBudget[];
  onDeleteBudget: (budget: SavedBudget) => Promise<void>;
  onLoadBudget: (budget: SavedBudget) => void;
  onMergeBudgets: (selectedBudgets: SavedBudget[]) => void;
}

export function OrcamentoSavedTab({
  savedBudgets,
  onDeleteBudget,
  onLoadBudget,
  onMergeBudgets,
}: SavedTabProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleDeleteBudget = async (id: string) => {
    if (confirm('Deseja excluir este orçamento salvo?')) {
      const budget = savedBudgets.find(b => b.id === id);
      if (!budget) return;
      try { await onDeleteBudget(budget); }
      catch (error) { toast.error('Não foi possível excluir: ' + (error as Error).message); return; }
      setSelectedIds(prev => prev.filter(item => item !== id));
      toast.info('Orçamento excluído.');
    }
  };

  const handleMergeSelected = () => {
    const selected = savedBudgets.filter(b => selectedIds.includes(b.id));
    if (selected.length < 2) {
      toast.warning('Selecione ao menos 2 orçamentos para consolidar / agrupar.');
      return;
    }
    onMergeBudgets(selected);
    setSelectedIds([]);
  };

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <p className="text-xs text-slate-500">
            Total de orçamentos salvos: <strong>{savedBudgets.length}</strong>
          </p>
          {selectedIds.length > 0 && (
            <Badge className="bg-[#17191d] text-white">
              {selectedIds.length} selecionados
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length >= 2 && (
            <Button
              onClick={handleMergeSelected}
              className="bg-[#17191d] text-xs text-white hover:bg-slate-800"
            >
              <Layers className="mr-1.5 h-3.5 w-3.5 text-[#cbb27a]" />
              Agrupar Orçamentos Selecionados ({selectedIds.length})
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      {savedBudgets.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md">
            <FileSpreadsheet className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-slate-900">
            Nenhum orçamento salvo ainda
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Quando você importar uma lista do Promob e clicar em "Salvar Orçamento", ele aparecerá aqui para consulta, agrupamento de ambientes e exportação de PDF.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {savedBudgets.map(budget => {
            const isSelected = selectedIds.includes(budget.id);

            return (
              <Card
                key={budget.id}
                className={`relative transition-all ${
                  isSelected ? 'border-2 border-[#c92031] shadow-md' : 'border-slate-200 hover:shadow-sm'
                }`}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() => handleToggleSelect(budget.id)}
                      className="flex items-center gap-2 text-left"
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-[#c92031]" />
                      ) : (
                        <Square className="h-4 w-4 text-slate-300 hover:text-slate-500" />
                      )}
                      <div>
                        <CardTitle className="text-sm font-bold text-slate-900">
                          {budget.client_name || 'Cliente Sem Nome'}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {budget.project_environment || budget.name}
                        </CardDescription>
                      </div>
                    </button>

                    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-600">
                      {new Date(budget.created_at).toLocaleDateString('pt-BR')}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-2">
                  <div className="rounded-lg bg-slate-50 p-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Valor de Venda:</span>
                      <span className="font-bold text-slate-900">
                        {budget.totals.total_price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Custo Total:</span>
                      <span className="text-slate-700">
                        {budget.totals.total_cost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Margem Real:</span>
                      <span className="font-semibold text-emerald-600">
                        {budget.totals.profit_margin_percent}%
                      </span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-200 text-[11px]">
                      <span className="text-slate-400">Total de Itens:</span>
                      <span className="font-medium text-slate-600">{budget.items.length} itens</span>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onLoadBudget(budget)}
                      className="text-xs flex-1"
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
                      Carregar
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        generateBudgetPdf({
                          clientName: budget.client_name || 'Cliente DF Móveis',
                          clientPhone: budget.client_phone,
                          projectName: budget.project_environment || budget.name,
                          items: budget.items,
                          settings: budget.settings,
                          totals: budget.totals,
                        })
                      }
                      className="text-xs"
                    >
                      <Download className="h-3.5 w-3.5 text-[#cbb27a]" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBudget(budget.id)}
                      className="text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
