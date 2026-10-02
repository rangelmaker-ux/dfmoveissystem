import { ProjectFileThumbnail } from "@/components/project-file-thumbnail";
import { DecimalInput } from "@/components/ui/decimal-input";
import { openProjectFile } from '@/lib/project-files';
import { calculateInstallments, parseMoney } from '@/lib/finance';
import { invalidateOperation } from '@/lib/invalidate-operation';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { 
  Briefcase, Calendar, CheckCircle2, DollarSign, Lock, AlertCircle, 
  FileText, Upload, Trash2, Download, MessageSquare, History, XCircle, ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDate, isIndeterminateDeadline } from '@/lib/project-utils';

export const Route = createFileRoute('/_dashboard/projetista/meus-projetos')({
  component: MeusProjetosPage,
});

const STAGES = ['Início', 'Meio', 'Render', 'Fim'] as const;
type Stage = typeof STAGES[number];

const STAGE_COLORS: Record<string, string> = {
  'Início': 'bg-slate-100 text-slate-700 border-slate-200',
  'Meio': 'bg-blue-100 text-blue-700 border-blue-200',
  'Render': 'bg-purple-100 text-purple-700 border-purple-200',
  'Fim': 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

interface Anotacao {
  id: string;
  conteudo: string;
  autor_nome: string;
  created_at: string;
}

interface ProjetoRow {
  id: string;
  nome: string | null;
  status: string;
  status_venda: string;
  estagio_andamento: string | null;
  valor_venda: number | null;
  percentual_comissao: number | null;
  rt_arquiteto: number | null;
  nome_arquiteto: string | null;
  valor_entrada: number | null;
  forma_pagamento_entrada: string | null;
  numero_parcelas: number | null;
  data_inicio: string;
  prazo_termino: string;
  motivo_perda?: string | null;
  cliente: { id: string; nome: string; telefone: string | null } | null;
}

function MeusProjetosPage() {
  const { user, role } = useAuthStore();
  const isAdmin = role === "ADMIN";
  const queryClient = useQueryClient();
  const [viewingProject, setViewingProject] = useState<ProjetoRow | null>(null);
  const [closingProject, setClosingProject] = useState<ProjetoRow | null>(null);
  const [lostProject, setLostProject] = useState<ProjetoRow | null>(null);
  
  // Form estados
  const [valorVenda, setValorVenda] = useState('');
  const [percentualComissao, setPercentualComissao] = useState('');
  const [rtArquiteto, setRtArquiteto] = useState('');
  const [nomeArquiteto, setNomeArquiteto] = useState('');
  const [valorEntrada, setValorEntrada] = useState('');
  const [formaPagamentoEntrada, setFormaPagamentoEntrada] = useState('Pix');
  const [numParcelas, setNumParcelas] = useState('1');
  let paymentPlan: ReturnType<typeof calculateInstallments> | null = null;
  try { paymentPlan = calculateInstallments(parseMoney(valorVenda), parseMoney(valorEntrada || '0'), Number(numParcelas)); } catch { /* Show validation through the closing form. */ }
  const [motivoPerda, setMotivoPerda] = useState('');

  const { data: projetos, isLoading } = useQuery({
    queryKey: ['meus-projetos', user?.id, role],
    queryFn: async () => {
      if (!user?.id) return [];
      let query = supabase
        .from('projetos')
        .select(`
          id, nome, status, status_venda, estagio_andamento, valor_venda, 
          data_inicio, prazo_termino, motivo_perda, percentual_comissao, rt_arquiteto, nome_arquiteto, valor_entrada, forma_pagamento_entrada, numero_parcelas,
          cliente:clientes(id, nome, telefone)
        `)
        .order('created_at', { ascending: false });
      if (!isAdmin) query = query.eq('projetista_id', user.id);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ProjetoRow[];
    },
    enabled: !!user?.id,
  });

  const updateStage = useMutation({
    mutationFn: async ({ id, estagio }: { id: string; estagio: Stage }) => {
      const { error } = await supabase
        .from('projetos')
        .update({ estagio_andamento: estagio })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void invalidateOperation(queryClient);
      toast.success('Estágio atualizado!');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message ?? 'tente novamente')),
  });

  const concluir = useMutation({
    mutationFn: async (data: any) => {
      const sale = parseMoney(data.valorVenda);
      const entry = parseMoney(data.valorEntrada || '0');
      const count = Number(data.numParcelas);
      const percentage = parseMoney(data.percentualComissao || '0');
      const rt = parseMoney(data.rtArquiteto || '0');
      if (!Number.isFinite(rt) || rt < 0 || rt > 100) throw new Error('RT deve estar entre 0 e 100%.');
      const installments = calculateInstallments(sale, entry, count);
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new Error('Comissão deve estar entre 0 e 100%.');
      const update = { 
        status: 'FINALIZADO' as const, 
        estagio_andamento: 'Fim', 
        status_venda: 'VENDEU' as const,
        valor_venda: sale,
        percentual_comissao: percentage,
        rt_arquiteto: rt,
        nome_arquiteto: data.nomeArquiteto.trim() || null,
        valor_entrada: entry,
        forma_pagamento_entrada: data.formaPagamentoEntrada,
        numero_parcelas: count,
        valor_parcela: installments.regular
      };
      const { error } = await supabase.from('projetos').update(update).eq('id', data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void invalidateOperation(queryClient);
      toast.success('Projeto finalizado com sucesso!');
      setClosingProject(null);
      resetFinanceForm();
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message ?? 'tente novamente')),
  });

  const marcarComoPerdido = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from('projetos')
        .update({ 
          status: 'FINALIZADO', 
          status_venda: 'NAO_VENDEU',
          motivo_perda: motivo 
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      void invalidateOperation(queryClient);
      toast.success('Projeto arquivado como venda perdida.');
      setLostProject(null);
      setMotivoPerda('');
    },
    onError: (e: any) => toast.error('Erro: ' + (e?.message ?? 'tente novamente')),
  });

  const resetFinanceForm = () => {
    setValorVenda('');
    setPercentualComissao('');
    setRtArquiteto('');
    setNomeArquiteto('');
    setValorEntrada('');
    setFormaPagamentoEntrada('Pix');
    setNumParcelas('1');
  };

  const openFinance = (project: ProjetoRow) => {
    setValorVenda(String(project.valor_venda ?? ''));
    setPercentualComissao(String(project.percentual_comissao ?? ''));
    setRtArquiteto(String(project.rt_arquiteto ?? ''));
    setNomeArquiteto(project.nome_arquiteto ?? '');
    setValorEntrada(String(project.valor_entrada ?? ''));
    setFormaPagamentoEntrada(project.forma_pagamento_entrada ?? 'Pix');
    setNumParcelas(String(project.numero_parcelas ?? 1));
    setClosingProject(project);
  };

  const ativos = (projetos ?? []).filter(p => p.status !== 'FINALIZADO');
  const concluidos = (projetos ?? []).filter(p => p.status === 'FINALIZADO');

  if (viewingProject) {
    return <DetalhesProjeto projeto={viewingProject} onBack={() => setViewingProject(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            {isAdmin ? "Projetos da Equipe" : "Meus Projetos"}
          </h1>
          <p className="text-muted-foreground">
            Acompanhe e atualize o estágio de cada projeto.
          </p>
        </div>
      </div>

      <Tabs defaultValue="ativos">
        <TabsList>
          <TabsTrigger value="ativos">
            Em Andamento {ativos.length > 0 && `(${ativos.length})`}
          </TabsTrigger>
          <TabsTrigger value="concluidos">
            Histórico {concluidos.length > 0 && `(${concluidos.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ativos" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="animate-pulse h-56 bg-muted/20" />
              ))}
            </div>
          ) : ativos.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum projeto em andamento.</p>
                <p className="text-sm">Assuma novas demandas na aba "Demandas".</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {ativos.map((p) => (
                <ProjetoCard
                  key={p.id}
                  projeto={p}
                  onStageChange={(s) => updateStage.mutate({ id: p.id, estagio: s })}
                  onClose={() => openFinance(p)}
                  onMarkLost={() => setLostProject(p)}
                  onView={() => setViewingProject(p)}
                  isUpdating={updateStage.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="concluidos" className="mt-4">
          {concluidos.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nenhum projeto no histórico ainda.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {concluidos.map((p) => (
                <Card key={p.id} className={cn(
                  "border-l-4 opacity-90 transition-all hover:opacity-100 cursor-pointer",
                  p.status_venda === 'VENDEU' ? "border-l-emerald-400" : "border-l-rose-400"
                )} onClick={() => setViewingProject(p)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base truncate">{p.nome || 'Projeto'}</CardTitle>
                      <Badge className={p.status_venda === 'VENDEU' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>
                        {p.status_venda === 'VENDEU' ? 'Vendido' : 'Perdido'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{p.cliente?.nome ?? '—'}</p>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {p.status_venda === 'VENDEU' && p.valor_venda && (
                      <div className="flex items-center gap-1 text-emerald-700 font-semibold">
                        <DollarSign className="h-4 w-4" />
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(p.valor_venda))}
                      </div>
                    )}
                    {p.status_venda === 'VENDEU' && (
                      <Button size="sm" variant="outline" onClick={event => { event.stopPropagation(); openFinance(p); }}>Editar comissão / RT e pagamento</Button>
                    )}
                    {p.status_venda === 'NAO_VENDEU' && p.motivo_perda && (
                      <div className="text-rose-600 text-xs italic line-clamp-1">
                        Motivo: {p.motivo_perda}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Finalizado em: {new Date().toLocaleDateString('pt-BR')}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Conclusão Financeira */}
      <Dialog open={!!closingProject} onOpenChange={(o) => { if (!o) { setClosingProject(null); resetFinanceForm(); } }}>
        <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{closingProject?.status_venda === 'VENDEU' ? 'Dados da Venda' : 'Concluir Venda'}</DialogTitle>
            <DialogDescription>
              Preencha os dados financeiros obrigatórios para fechar o projeto <strong>{closingProject?.nome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="valor_total">Valor Total (R$)</Label>
                <DecimalInput id="valor_total" type="number" value={valorVenda} onChange={(e) => setValorVenda(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="comissao">% Comissão</Label>
                <DecimalInput id="comissao" type="number" value={percentualComissao} onChange={(e) => setPercentualComissao(e.target.value)} placeholder="5" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="sale-architect">Arquiteto / Parceiro</Label>
                <Input id="sale-architect" value={nomeArquiteto} onChange={e => setNomeArquiteto(e.target.value)} placeholder="Nome (opcional)" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sale-rt">RT do Arquiteto (%)</Label>
                <DecimalInput id="sale-rt" value={rtArquiteto} onChange={e => setRtArquiteto(e.target.value)} placeholder="Ex: 2,5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Comissão e RT são calculadas sobre o valor vendido. Contrato e imagens podem ser anexados em Arquivos do projeto.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="entrada">Valor Entrada (R$)</Label>
                <DecimalInput id="entrada" type="number" value={valorEntrada} onChange={(e) => setValorEntrada(e.target.value)} placeholder="0,00" />
              </div>
              <div className="space-y-1">
                <Label>Pagamento Entrada</Label>
                <Select value={formaPagamentoEntrada} onValueChange={setFormaPagamentoEntrada}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pix">Pix</SelectItem>
                    <SelectItem value="Boleto">Boleto</SelectItem>
                    <SelectItem value="Cartão">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="parcelas">Nº Parcelas Restante</Label>
                <DecimalInput id="parcelas" type="number" value={numParcelas} onChange={(e) => setNumParcelas(e.target.value)} min="0" max="120" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v_parcela">Valor da Parcela (R$)</Label>
                <DecimalInput id="v_parcela" type="number" value={paymentPlan?.regular ?? ''} readOnly placeholder="0,00" />
              </div>
            </div>
          </div>
          {paymentPlan && <p className="text-xs text-slate-500">Parcelas: {paymentPlan.amounts.map((amount, i) => `${i + 1}ª: ${amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`).join(' · ') || 'Quitado na entrada'}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosingProject(null)}>Cancelar</Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!paymentPlan || concluir.isPending}
              onClick={() => {
                concluir.mutate({
                  id: closingProject?.id,
                  valorVenda,
                  percentualComissao,
                  rtArquiteto,
                  nomeArquiteto,
                  valorEntrada,
                  formaPagamentoEntrada,
                  numParcelas,
                });
              }}
            >
              {closingProject?.status_venda === 'VENDEU' ? 'Salvar Dados da Venda' : 'Confirmar e Vender'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Venda Perdida */}
      <Dialog open={!!lostProject} onOpenChange={(o) => { if (!o) { setLostProject(null); setMotivoPerda(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Venda Perdida</DialogTitle>
            <DialogDescription>Qual o motivo de não ter fechado com o cliente?</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Select value={motivoPerda} onValueChange={setMotivoPerda}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Achou caro">Achou caro</SelectItem>
                <SelectItem value="Concorrência">Concorrência</SelectItem>
                <SelectItem value="Desistiu">Desistiu</SelectItem>
                <SelectItem value="Prazo">Prazo longo</SelectItem>
                <SelectItem value="Outros">Outros</SelectItem>
              </SelectContent>
            </Select>
            {motivoPerda === 'Outros' && (
              <Textarea placeholder="Descreva brevemente..." rows={2} onChange={(e) => setMotivoPerda(e.target.value)} />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLostProject(null)}>Voltar</Button>
            <Button 
              variant="destructive"
              disabled={!motivoPerda || marcarComoPerdido.isPending}
              onClick={() => marcarComoPerdido.mutate({ id: lostProject!.id, motivo: motivoPerda })}
            >
              Arquivar Projeto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetalhesProjeto({ projeto, onBack }: { projeto: ProjetoRow, onBack: () => void }) {
  const [anotacao, setAnotacao] = useState('');
  const [activeTab, setActiveTab] = useState('diario');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: anotacoes, isLoading: loadingAnotacoes } = useQuery({
    queryKey: ['anotacoes', projeto.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('anotacoes_projeto')
        .select('*')
        .eq('projeto_id', projeto.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Anotacao[];
    }
  });

  const { data: arquivos, isLoading: loadingArquivos } = useQuery({
    queryKey: ['arquivos', projeto.id],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('projetos_arquivos').list(projeto.id);
      if (error) throw error;
      return data;
    }
  });

  const addAnotacao = useMutation({
    mutationFn: async (text: string) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      const { error } = await supabase.from('anotacoes_projeto').insert({
        projeto_id: projeto.id,
        autor_id: user.id,
        autor_nome: user.nome || 'Projetista',
        conteudo: text
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anotacoes', projeto.id] });
      setAnotacao('');
      toast.success('Anotação salva!');
    }
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      const cleanName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${Date.now()}_${cleanName}`;
      const { error } = await supabase.storage
        .from('projetos_arquivos')
        .upload(`${projeto.id}/${fileName}`, file, { upsert: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arquivos', projeto.id] });
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Arquivo enviado com sucesso!');
    },
    onError: (e: any) => toast.error('Erro no upload: ' + (e?.message ?? 'tente novamente'))
  });

  const deleteFile = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.storage
        .from('projetos_arquivos')
        .remove([`${projeto.id}/${name}`]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['arquivos', projeto.id] });
      toast.success('Arquivo removido');
    }
  });



  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft /></Button>
        <div>
          <h1 className="text-2xl font-bold">{projeto.nome}</h1>
          <p className="text-muted-foreground">Cliente: {projeto.cliente?.nome}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="diario"><MessageSquare className="mr-2 h-4 w-4" /> Diário de Bordo</TabsTrigger>
              <TabsTrigger value="arquivos"><Upload className="mr-2 h-4 w-4" /> Arquivos</TabsTrigger>
            </TabsList>
            
            <TabsContent value="diario" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Textarea 
                  placeholder="Escreva uma atualização do projeto..." 
                  value={anotacao}
                  onChange={(e) => setAnotacao(e.target.value)}
                />
                <Button 
                  onClick={() => addAnotacao.mutate(anotacao)} 
                  disabled={!anotacao || addAnotacao.isPending}
                >
                  Salvar Anotação
                </Button>
              </div>

              <div className="space-y-4 mt-8">
                {loadingAnotacoes ? (
                   <div className="animate-pulse space-y-2"><div className="h-20 bg-muted rounded"></div></div>
                ) : anotacoes?.map((a) => (
                  <div key={a.id} className="border rounded-lg p-4 bg-card shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-sm">{a.autor_nome}</span>
                      <span className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{a.conteudo}</p>
                  </div>
                ))}
                {anotacoes?.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground italic">Nenhuma anotação ainda.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="arquivos" className="space-y-4 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Arquivos do Projeto (Renders, PDFs, Contratos)</h3>
                <Button onClick={() => fileInputRef.current?.click()} size="sm">
                  <Upload className="mr-2 h-4 w-4" /> Upload
                </Button>
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files?.[0] && uploadFile.mutate(e.target.files[0])} 
                />
              </div>

              <div className="grid gap-3">
                {arquivos?.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <ProjectFileThumbnail projectId={projeto.id} name={file.name} />
                      <span className="text-sm truncate">{file.name}</span>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button variant="ghost" size="icon" onClick={() => openProjectFile(projeto.id, file.name)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteFile.mutate(file.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {arquivos?.length === 0 && !loadingArquivos && (
                  <div className="text-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                    Arraste arquivos ou clique no botão acima para anexar.
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <Card className="h-fit">
          <CardHeader><CardTitle className="text-lg">Resumo</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status:</span>
              <Badge variant="outline">{projeto.status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estágio:</span>
              <Badge>{projeto.estagio_andamento}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Prazo:</span>
              <span className="font-medium">{formatDate(projeto.prazo_termino)}</span>
            </div>
            <hr />
            {projeto.status_venda === 'VENDEU' && projeto.valor_venda && (
              <div className="space-y-2">
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>Vendido por:</span>
                  <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(projeto.valor_venda)}</span>
                </div>
                <p>Comissão do projetista: {Number(projeto.percentual_comissao ?? 0).toLocaleString('pt-BR')}% · {(Math.round(projeto.valor_venda * Number(projeto.percentual_comissao ?? 0)) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                <p>RT {projeto.nome_arquiteto || 'do arquiteto'}: {Number(projeto.rt_arquiteto ?? 0).toLocaleString('pt-BR')}% · {(Math.round(projeto.valor_venda * Number(projeto.rt_arquiteto ?? 0)) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ProjetoCard({
  projeto, onStageChange, onClose, onMarkLost, onView, isUpdating,
}: {
  projeto: ProjetoRow;
  onStageChange: (s: Stage) => void;
  onClose: () => void;
  onMarkLost: () => void;
  onView: () => void;
  isUpdating: boolean;
}) {
  const stage = (projeto.estagio_andamento as Stage) || 'Início';
  const isDelayed = Boolean(
    projeto.prazo_termino &&
      !isIndeterminateDeadline(projeto.prazo_termino) &&
      new Date(projeto.prazo_termino) < new Date() &&
      projeto.status !== 'FINALIZADO',
  );
  
  return (
    <Card className={cn(
      "hover:shadow-lg transition-all border-l-4",
      isDelayed ? "border-l-destructive bg-destructive/5 animate-pulse-subtle" : "border-l-primary/60"
    )}>
      <CardHeader className="pb-3 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base line-clamp-1 cursor-pointer hover:underline" onClick={onView}>
            {projeto.nome || 'Projeto sem nome'}
          </CardTitle>
          <Badge variant="outline" className={cn(STAGE_COLORS[stage], "shrink-0")}>{stage}</Badge>
        </div>
        <div className="flex items-center gap-2">
           <p className="text-sm text-muted-foreground line-clamp-1 flex-1">
            Cliente: <span className="font-medium text-foreground">{projeto.cliente?.nome ?? '—'}</span>
          </p>
          {isDelayed && <Badge variant="destructive" className="animate-bounce">ATRASADO</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          Prazo: <span className={cn(isDelayed && "text-destructive font-bold")}>
            {formatDate(projeto.prazo_termino)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onView} className="text-xs h-8">
            <FileText className="mr-1 h-3 w-3" /> Detalhes
          </Button>
          <Button variant="outline" size="sm" onClick={onMarkLost} className="text-xs h-8 text-rose-600 hover:text-rose-700">
            <XCircle className="mr-1 h-3 w-3" /> Perdi Venda
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Alterar Estágio</Label>
          <Select value={stage} onValueChange={(v) => onStageChange(v as Stage)} disabled={isUpdating}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-9"
          onClick={onClose}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Concluir Venda
        </Button>
      </CardContent>
    </Card>
  );
}
