import { useState, useRef } from 'react';
import { 
  Settings, Plus, Trash2, CheckCircle2, Percent, Loader2, Check, 
  Building2, Upload, Image, Shield, AlertCircle 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BudgetSettings, AdditionItem, CompanyInfo } from '@/lib/orcamento/types';
import { calculateAdditionsFactor } from '@/lib/orcamento/calculator';

interface SettingsTabProps {
  settings: BudgetSettings;
  setSettings: React.Dispatch<React.SetStateAction<BudgetSettings>>;
  onSaveSettings: (newSettings: BudgetSettings) => void;
  isAdmin?: boolean;
}

export function OrcamentoSettingsTab({ 
  settings, 
  setSettings, 
  onSaveSettings, 
  isAdmin = true 
}: SettingsTabProps) {
  const [form, setForm] = useState<BudgetSettings>({ 
    ...settings,
    company: settings.company || {
      razao_social: 'DF Móveis Planejados Ltda',
      nome_fantasia: 'DF Móveis Planejados',
      cnpj: '',
      telefone: '',
      email: '',
      endereco: '',
      logo_url: '',
    }
  });
  const [newAdditionName, setNewAdditionName] = useState('');
  const [newAdditionVal, setNewAdditionVal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const additionsFactor = calculateAdditionsFactor(form);
  const additionsTotalPercent = (additionsFactor - 1) * 100;

  // Handle Logo Upload (converts image to base64 Data URL)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isAdmin) {
      toast.error('Apenas o administrador pode alterar o logo da empresa.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem válido (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('O logo deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setForm(prev => ({
        ...prev,
        company: {
          ...(prev.company || {}),
          logo_url: base64,
        }
      }));
      toast.success('Logo carregado com sucesso!');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    if (!isAdmin) return;
    setForm(prev => ({
      ...prev,
      company: {
        ...(prev.company || {}),
        logo_url: '',
      }
    }));
    if (logoInputRef.current) logoInputRef.current.value = '';
    toast.info('Logo removido.');
  };

  const handleCompanyChange = (field: keyof CompanyInfo, val: string) => {
    setForm(prev => ({
      ...prev,
      company: {
        ...(prev.company || {}),
        [field]: val,
      }
    }));
  };

  const handleAddCustomAddition = () => {
    if (!newAdditionName.trim()) {
      toast.error('Informe o nome do acréscimo.');
      return;
    }
    const val = parseFloat(newAdditionVal.replace(',', '.')) || 0;
    const newItem: AdditionItem = {
      id: `add-${Date.now()}`,
      nome: newAdditionName.trim(),
      valor: val,
    };
    setForm(prev => ({
      ...prev,
      outros: [...(prev.outros || []), newItem],
    }));
    setNewAdditionName('');
    setNewAdditionVal('');
    toast.success('Acréscimo adicionado!');
  };

  const handleRemoveAddition = (id: string) => {
    setForm(prev => ({
      ...prev,
      outros: prev.outros.filter(o => o.id !== id),
    }));
  };

  const handleSave = () => {
    setIsSaving(true);
    setSaveSuccess(false);

    setTimeout(() => {
      setSettings(form);
      onSaveSettings(form);
      setIsSaving(false);
      setSaveSuccess(true);

      toast.success('Configurações salvas com sucesso!', {
        description: `Dados da empresa e margem de ${form.margin}% atualizados para todas as propostas.`,
      });

      setTimeout(() => {
        setSaveSuccess(false);
      }, 3500);
    }, 450);
  };

  return (
    <div className="max-w-4xl space-y-6">
      {/* Banner de Sucesso pós-salvamento */}
      {saveSuccess && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Check className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-sm">Configurações Atualizadas com Sucesso!</p>
            <p className="text-xs text-emerald-700">
              Os dados da empresa, o logotipo e a margem padrão de <strong>{form.margin}%</strong> foram salvos e serão aplicados automaticamente nas propostas em PDF.
            </p>
          </div>
        </div>
      )}

      {/* Dados da Empresa & Identidade Visual (PDF) - Exclusivo Administrador */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#c92031]" />
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Dados da Empresa & Identidade Visual (Proposta em PDF)
                </CardTitle>
                <CardDescription className="text-xs">
                  Estes dados e o logotipo da sua empresa serão impressos no cabeçalho das propostas comerciais em PDF geradas no sistema.
                </CardDescription>
              </div>
            </div>
            {isAdmin ? (
              <Badge className="bg-slate-900 text-amber-300 text-[10px] font-bold">
                <Shield className="mr-1 h-3 w-3 text-amber-400" /> Exclusivo Admin
              </Badge>
            ) : (
              <Badge variant="outline" className="border-slate-200 text-slate-500 text-[10px]">
                Somente Leitura
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          {!isAdmin && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-600">
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Apenas o Superusuário / Administrador pode editar os dados cadastrais e o logo da empresa.</span>
            </div>
          )}

          {/* Logo Upload Section */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="flex h-20 w-36 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-2 overflow-hidden shadow-xs">
              {form.company?.logo_url ? (
                <img 
                  src={form.company.logo_url} 
                  alt="Logo Empresa" 
                  className="max-h-full max-w-full object-contain" 
                />
              ) : (
                <div className="text-center text-slate-400">
                  <Image className="mx-auto h-6 w-6 mb-1 opacity-50" />
                  <span className="text-[10px]">Sem logotipo</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 flex-1">
              <p className="text-xs font-bold text-slate-900">Logotipo da Empresa</p>
              <p className="text-[11px] text-slate-500">
                Formatos recomendados: PNG ou JPG com fundo transparente (máx. 2MB).
              </p>
              {isAdmin && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="file"
                    ref={logoInputRef}
                    onChange={handleLogoUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    className="h-8 text-xs font-semibold"
                  >
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                    {form.company?.logo_url ? 'Alterar Logo' : 'Subir Logotipo'}
                  </Button>
                  {form.company?.logo_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveLogo}
                      className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Remover
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Razão Social</Label>
              <Input
                disabled={!isAdmin}
                value={form.company?.razao_social || ''}
                onChange={e => handleCompanyChange('razao_social', e.target.value)}
                placeholder="Ex: DF Móveis Planejados Ltda"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Nome Fantasia (Marca)</Label>
              <Input
                disabled={!isAdmin}
                value={form.company?.nome_fantasia || ''}
                onChange={e => handleCompanyChange('nome_fantasia', e.target.value)}
                placeholder="Ex: DF Móveis Planejados"
                className="mt-1 text-xs font-bold"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">CNPJ</Label>
              <Input
                disabled={!isAdmin}
                value={form.company?.cnpj || ''}
                onChange={e => handleCompanyChange('cnpj', e.target.value)}
                placeholder="00.000.000/0001-00"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Telefone / WhatsApp Comercial</Label>
              <Input
                disabled={!isAdmin}
                value={form.company?.telefone || ''}
                onChange={e => handleCompanyChange('telefone', e.target.value)}
                placeholder="(61) 99999-9999"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">E-mail de Contato</Label>
              <Input
                disabled={!isAdmin}
                value={form.company?.email || ''}
                onChange={e => handleCompanyChange('email', e.target.value)}
                placeholder="contato@dfmoveis.com.br"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Endereço Comercial / Showroom</Label>
              <Input
                disabled={!isAdmin}
                value={form.company?.endereco || ''}
                onChange={e => handleCompanyChange('endereco', e.target.value)}
                placeholder="SIA Trecho 3, Lote 100 - Brasília/DF"
                className="mt-1 text-xs"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Margem Padrão de Lucro */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-[#c92031]" />
            <div>
              <CardTitle className="text-base font-bold text-slate-900">
                Margem Padrão de Lucro
              </CardTitle>
              <CardDescription className="text-xs">
                Defina o percentual de markup padrão. Todo arquivo ou item importado utilizará automaticamente este percentual.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-48">
              <Label className="text-xs font-semibold text-slate-700">Margem Padrão (%)</Label>
              <div className="relative mt-1">
                <Input
                  type="number"
                  value={form.margin}
                  onChange={e => setForm({ ...form, margin: parseFloat(e.target.value) || 0 })}
                  className="pr-8 text-base font-bold text-slate-900 focus:border-[#c92031]"
                />
                <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600 flex-1">
              <p className="font-semibold text-slate-800">Cálculo Automático na Importação:</p>
              <p className="mt-0.5">
                Ao importar qualquer arquivo do <strong>Promob (XML/TXT/CSV)</strong>, cada peça de material receberá automaticamente a margem de{' '}
                <strong className="text-[#c92031]">{form.margin}%</strong>, sem necessidade de alteração manual.
              </p>
              <p className="mt-1 text-slate-500">
                Exemplo: Custo de R$ 100,00 → Preço base com margem:{' '}
                <strong>
                  {(100 * (1 + form.margin / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Global Additions */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-bold text-slate-900">
            Acréscimos Operacionais & Comissões
          </CardTitle>
          <CardDescription className="text-xs">
            Taxas agregadas automaticamente no cálculo final de cada produto do orçamento.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-xs font-medium text-slate-700">Frete (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.frete}
                onChange={e => setForm({ ...form, frete: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-semibold"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Montagem (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.montagem}
                onChange={e => setForm({ ...form, montagem: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-semibold"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Comissão de Vendas (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.comissao_vendas}
                onChange={e => setForm({ ...form, comissao_vendas: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-semibold"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-slate-700">Comissão Executivo (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={form.comissao_executivo}
                onChange={e => setForm({ ...form, comissao_executivo: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-semibold"
              />
            </div>
          </div>

          {/* Custom Additions List */}
          <div className="border-t border-slate-100 pt-4">
            <Label className="text-xs font-semibold text-slate-700">Outros Acréscimos Personalizados</Label>
            <div className="mt-2 space-y-2">
              {(form.outros || []).map(o => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-800">{o.nome}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-[#c92031]">+{o.valor}%</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveAddition(o.id)}
                      className="h-6 w-6 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder="Nome do acréscimo (ex: Reserva Técnica)"
                  value={newAdditionName}
                  onChange={e => setNewAdditionName(e.target.value)}
                  className="text-xs flex-1"
                />
                <Input
                  type="number"
                  placeholder="Valor (%)"
                  value={newAdditionVal}
                  onChange={e => setNewAdditionVal(e.target.value)}
                  className="w-28 text-xs"
                />
                <Button onClick={handleAddCustomAddition} variant="outline" className="text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          {/* Additions Total Factor Card */}
          <div className="rounded-xl bg-[#17191d] p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400">Fator de Acréscimos Totais</p>
                <p className="text-lg font-bold text-[#cbb27a]">
                  +{additionsTotalPercent.toFixed(1)}% (Multiplicador {additionsFactor.toFixed(3)})
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PDF Settings */}
      <Card className="border-slate-200 bg-white shadow-sm">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-base font-bold text-slate-900">
            Colunas Visíveis na Proposta Comercial (PDF)
          </CardTitle>
          <CardDescription className="text-xs">
            Escolha quais informações de preço aparecem para o cliente no PDF final.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Exibir Preço Unitário por Item</p>
              <p className="text-xs text-slate-500">Mostra a coluna de valor unitário na tabela do PDF.</p>
            </div>
            <Switch
              checked={form.pdf_show_unit_price}
              onCheckedChange={val => setForm({ ...form, pdf_show_unit_price: val })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Exibir Valor Total por Item</p>
              <p className="text-xs text-slate-500">Mostra a coluna de total de cada item na proposta.</p>
            </div>
            <Switch
              checked={form.pdf_show_item_total}
              onCheckedChange={val => setForm({ ...form, pdf_show_item_total: val })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Botão de Salvar com Animação Visual Clara */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className={`h-11 px-6 font-semibold transition-all duration-300 ${
            saveSuccess
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
              : 'bg-[#c92031] text-white hover:bg-[#aa1726]'
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando Configurações...
            </>
          ) : saveSuccess ? (
            <>
              <Check className="mr-2 h-5 w-5 animate-bounce" />
              Salvo com Sucesso!
            </>
          ) : (
            'Salvar Configurações'
          )}
        </Button>
      </div>
    </div>
  );
}
