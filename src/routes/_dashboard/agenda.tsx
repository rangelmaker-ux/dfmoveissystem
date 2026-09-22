import { createFileRoute } from '@tanstack/react-router';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar as CalendarIcon, Clock, User, Plus, Search, Edit2, Trash2, X, 
  AlertCircle, Check, CheckCircle2, Lock, ShieldAlert 
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { format, startOfDay, isSameDay, parseISO, areIntervalsOverlapping, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';

export const Route = createFileRoute('/_dashboard/agenda')({
  component: AgendaPage,
});

const TIPO_LABELS: Record<string, string> = {
  'REUNIAO': 'Reunião com Cliente',
  'ATENDIMENTO': 'Atendimento',
  'VISITA': 'Tirar Medida',
  'BLOQUEIO': '🔒 Agenda Travada (Admin)'
};

const TIPO_COLORS: Record<string, string> = {
  'REUNIAO': 'bg-red-500 text-white',
  'ATENDIMENTO': 'bg-blue-500 text-white',
  'VISITA': 'bg-green-500 text-white',
  'BLOQUEIO': 'bg-slate-900 text-amber-300'
};

const TIPO_BADGE_COLORS: Record<string, string> = {
  'REUNIAO': 'bg-red-100 text-red-700',
  'ATENDIMENTO': 'bg-blue-100 text-blue-700',
  'VISITA': 'bg-green-100 text-green-700',
  'BLOQUEIO': 'bg-slate-900 text-amber-300 border border-slate-700'
};

interface AgendaForm {
  titulo: string;
  descricao: string;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  tipo: string;
  cliente_id: string;
}

interface AgendaEvent {
  id: string;
  titulo: string;
  descricao: string | null;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  status: string;
  cliente_id: string | null;
  criado_por_id: string;
  criado_por: { nome: string } | null;
  cliente: { nome: string } | null;
  data_sugerida_inicio?: string | null;
  data_sugerida_fim?: string | null;
  motivo_alteracao?: string | null;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'erro desconhecido';
}

function AgendaPage() {
  const { user, role } = useAuthStore();
  const isAdmin = role === 'ADMIN';
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    data: '',
    hora_inicio: '',
    hora_fim: '',
    tipo: 'REUNIAO',
    cliente_id: ''
  });

  // Modal exclusivo para Administrador: Travar Agenda
  const [isLockDialogOpen, setIsLockDialogOpen] = useState(false);
  const [lockFormData, setLockFormData] = useState({
    titulo: '🔒 Agenda Travada pelo Administrador',
    motivo: 'Indisponível para compromissos',
    data_inicio: format(new Date(), 'yyyy-MM-dd'),
    data_fim: format(new Date(), 'yyyy-MM-dd'),
    dia_inteiro: true,
    hora_inicio: '08:00',
    hora_fim: '18:00',
  });

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ['agendamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('id, titulo, descricao, data_inicio, data_fim, tipo, status, cliente_id, criado_por_id:criado_por, criado_por:users(nome), cliente:clientes(nome), data_sugerida_inicio, data_sugerida_fim, motivo_alteracao')
        .order('data_inicio', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as AgendaEvent[];
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel('agenda-compartilhada')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agendamentos' },
        () => queryClient.invalidateQueries({ queryKey: ['agendamentos'] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const { data: clientes } = useQuery({
    queryKey: ['clientes-agenda'],
    queryFn: async () => {
      const { data, error } = await supabase.from('clientes').select('id, nome').order('nome');
      if (error) throw error;
      return data;
    }
  });

  const filteredEvents = useMemo(() => {
    if (!events || !selectedDate) return [];
    return events.filter(e => isSameDay(parseISO(e.data_inicio), selectedDate));
  }, [events, selectedDate]);

  const dayTooltips = useMemo(() => {
    const tooltips: Record<string, React.ReactNode> = {};
    if (!events) return tooltips;

    const grouped = events.reduce<Record<string, AgendaEvent[]>>((acc, event) => {
      const dateKey = event.data_inicio.split('T')[0];
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(event);
      return acc;
    }, {});

    Object.keys(grouped).forEach(dateKey => {
      tooltips[dateKey] = (
        <div className="space-y-2">
          {grouped[dateKey].slice(0, 3).map((e) => (
            <div key={e.id} className="text-[10px] border-b border-border last:border-0 pb-1">
              <p className="font-bold truncate">{e.titulo}</p>
              <p className="text-muted-foreground">
                {format(parseISO(e.data_inicio), "HH:mm")} - {e.cliente?.nome || 'Sem cliente'}
              </p>
            </div>
          ))}
          {grouped[dateKey].length > 3 && (
            <p className="text-[9px] text-center font-bold">+ {grouped[dateKey].length - 3} compromissos</p>
          )}
        </div>
      );
    });

    return tooltips;
  }, [events]);

  const modifiers = useMemo(() => {
    const mods: Record<string, Date[]> = { REUNIAO: [], ATENDIMENTO: [], VISITA: [], BLOQUEIO: [] };
    events?.forEach(e => {
      if (mods[e.tipo]) {
        mods[e.tipo].push(parseISO(e.data_inicio));
      }
    });
    return mods;
  }, [events]);

  const saveMutation = useMutation({
    mutationFn: async (event: AgendaForm) => {
      if (!event.titulo?.trim()) throw new Error('Informe o título do compromisso.');
      if (!event.data) throw new Error('Selecione a data.');
      if (!event.hora_inicio) throw new Error('Informe o horário de início.');
      if (!event.hora_fim) throw new Error('Informe o horário de término.');
      if (!user?.id) throw new Error('Sessão inválida. Faça login novamente.');

      if (event.tipo === 'BLOQUEIO' && !isAdmin) {
        throw new Error('Apenas administradores têm permissão para travar a agenda.');
      }

      const data_inicio = new Date(`${event.data}T${event.hora_inicio}`);
      if (isNaN(data_inicio.getTime())) {
        throw new Error('Data ou hora inválida.');
      }
      const data_fim = new Date(`${event.data}T${event.hora_fim}`);
      if (isNaN(data_fim.getTime()) || data_fim <= data_inicio) {
        throw new Error('O horário final precisa ser posterior ao horário inicial.');
      }

      // Validação: Impedir qualquer compromisso em período com Agenda Travada pelo Administrador
      if (event.tipo !== 'BLOQUEIO') {
        const conflictingLock = events?.find(e => {
          if (editingEventId && e.id === editingEventId) return false;
          if (e.tipo !== 'BLOQUEIO') return false;

          const lockStart = parseISO(e.data_inicio);
          const lockEnd = parseISO(e.data_fim);

          return areIntervalsOverlapping(
            { start: data_inicio, end: data_fim },
            { start: lockStart, end: lockEnd }
          );
        });

        if (conflictingLock) {
          const lockStartStr = format(parseISO(conflictingLock.data_inicio), 'HH:mm');
          const lockEndStr = format(parseISO(conflictingLock.data_fim), 'HH:mm');
          throw new Error(
            `A agenda está travada pelo Administrador das ${lockStartStr} às ${lockEndStr} ("${conflictingLock.titulo}"). Escolha outro horário ou dia.`
          );
        }
      }

      const scheduleOwnerId = editingEventId
        ? events?.find((item) => item.id === editingEventId)?.criado_por_id ?? user.id
        : user.id;
      const conflictingMeeting = event.tipo === 'REUNIAO' ? events?.find(e => {
        if (editingEventId && e.id === editingEventId) return false;
        if (e.tipo !== 'REUNIAO') return false;
        if (e.criado_por_id !== scheduleOwnerId) return false;
        
        const eStart = parseISO(e.data_inicio);
        const eEnd = parseISO(e.data_fim);
        
        return areIntervalsOverlapping(
          { start: data_inicio, end: data_fim },
          { start: eStart, end: eEnd }
        );
      }) : undefined;

      if (conflictingMeeting) {
        const conflictStart = format(parseISO(conflictingMeeting.data_inicio), 'HH:mm');
        const conflictEnd = format(parseISO(conflictingMeeting.data_fim), 'HH:mm');
        const owner = conflictingMeeting.criado_por?.nome
          ? ` por ${conflictingMeeting.criado_por.nome}`
          : '';
        throw new Error(
          `Já existe uma reunião marcada das ${conflictStart} às ${conflictEnd}${owner}. Escolha outro horário.`,
        );
      }

      const payload = {
        titulo: event.titulo,
        descricao: event.descricao,
        data_inicio: data_inicio.toISOString(),
        data_fim: data_fim.toISOString(),
        tipo: event.tipo,
        cliente_id: event.cliente_id || null,
      };

      if (editingEventId) {
        const targetEvent = events?.find((item) => item.id === editingEventId);
        if (!targetEvent) throw new Error('Agendamento não encontrado.');

        // Se for projetista (não admin), envia a solicitação para autorização do Administrador
        if (!isAdmin) {
          if (targetEvent.criado_por_id !== user.id) {
            throw new Error('Você só pode solicitar alteração de agendamentos que você criou.');
          }

          const { error: reqError } = await supabase
            .from('agendamentos')
            .update({
              data_sugerida_inicio: data_inicio.toISOString(),
              data_sugerida_fim: data_fim.toISOString(),
              motivo_alteracao: event.descricao || 'Alteração de horário solicitada pelo projetista',
              status: 'ALTERACAO_SOLICITADA',
            })
            .eq('id', editingEventId);

          if (reqError) {
            console.error('[agenda] request change error', reqError);
            throw reqError;
          }

          return { isRequest: true };
        }

        // Se for Administrador, aplica a alteração imediatamente e oficializa
        const { error: adminError } = await supabase
          .from('agendamentos')
          .update({
            ...payload,
            data_sugerida_inicio: null,
            data_sugerida_fim: null,
            motivo_alteracao: null,
            status: 'CONFIRMADO',
          })
          .eq('id', editingEventId);

        if (adminError) {
          console.error('[agenda] update error', adminError);
          if (adminError.code === '23P01' && event.tipo === 'REUNIAO') {
            throw new Error('Outra pessoa acabou de marcar uma reunião neste horário. Escolha outro horário.');
          }
          throw adminError;
        }

        return { isRequest: false };
      } else {
        const { error: insertError } = await supabase
          .from('agendamentos')
          .insert([{ ...payload, status: 'CONFIRMADO', criado_por: user.id }]);

        if (insertError) {
          console.error('[agenda] insert error', insertError);
          if (insertError.code === '23P01' && event.tipo === 'REUNIAO') {
            throw new Error('Outra pessoa acabou de marcar uma reunião neste horário. Escolha outro horário.');
          }
          throw insertError;
        }

        return { isRequest: false };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
      setIsDialogOpen(false);
      setEditingEventId(null);
      setFormData({ titulo: '', descricao: '', data: '', hora_inicio: '', hora_fim: '', tipo: 'REUNIAO', cliente_id: '' });
      if (result?.isRequest) {
        toast.info('Solicitação de alteração enviada ao Administrador! O novo horário entrará em vigor assim que for autorizado.');
      } else {
        toast.success(editingEventId ? 'Agendamento atualizado com sucesso!' : 'Agendamento cadastrado com sucesso!');
      }
    },
    onError: (error: unknown) => {
      toast.error('Erro ao salvar: ' + errorMessage(error));
    }
  });

  const approveChangeMutation = useMutation({
    mutationFn: async (event: AgendaEvent) => {
      if (!isAdmin) throw new Error('Apenas o Administrador pode aprovar alterações de horário.');
      if (!event.data_sugerida_inicio || !event.data_sugerida_fim) {
        throw new Error('Nenhum horário sugerido foi encontrado para este compromisso.');
      }
      const { error } = await supabase
        .from('agendamentos')
        .update({
          data_inicio: event.data_sugerida_inicio,
          data_fim: event.data_sugerida_fim,
          data_sugerida_inicio: null,
          data_sugerida_fim: null,
          motivo_alteracao: null,
          status: 'CONFIRMADO',
        })
        .eq('id', event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
      toast.success('Alteração de horário autorizada com sucesso! O novo horário agora é oficial para todos.');
    },
    onError: (err: unknown) => toast.error('Erro ao aprovar: ' + errorMessage(err)),
  });

  const rejectChangeMutation = useMutation({
    mutationFn: async (event: AgendaEvent) => {
      if (!isAdmin) throw new Error('Apenas o Administrador pode recusar alterações.');
      const { error } = await supabase
        .from('agendamentos')
        .update({
          data_sugerida_inicio: null,
          data_sugerida_fim: null,
          motivo_alteracao: null,
          status: 'CONFIRMADO',
        })
        .eq('id', event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
      toast.info('Solicitação recusada. O horário original foi mantido.');
    },
    onError: (err: unknown) => toast.error('Erro ao recusar: ' + errorMessage(err)),
  });

  const lockMutation = useMutation({
    mutationFn: async (data: typeof lockFormData) => {
      if (!isAdmin) throw new Error('Apenas administradores podem travar a agenda.');
      if (!user?.id) throw new Error('Sessão inválida. Faça login novamente.');
      if (!data.data_inicio) throw new Error('Informe a data inicial.');
      if (!data.data_fim) throw new Error('Informe a data final.');

      const startDay = new Date(`${data.data_inicio}T00:00:00`);
      const endDay = new Date(`${data.data_fim}T00:00:00`);
      if (endDay < startDay) {
        throw new Error('A data final deve ser igual ou posterior à data inicial.');
      }

      // Criar bloqueios para cada dia do intervalo selecionado
      const inserts = [];
      let cur = new Date(startDay);
      while (cur <= endDay) {
        const curDateStr = format(cur, 'yyyy-MM-dd');
        const hInicio = data.dia_inteiro ? '00:00' : data.hora_inicio;
        const hFim = data.dia_inteiro ? '23:59' : data.hora_fim;

        const dInicio = new Date(`${curDateStr}T${hInicio}`);
        const dFim = new Date(`${curDateStr}T${hFim}`);

        inserts.push({
          titulo: data.titulo.trim() || '🔒 Agenda Travada pelo Administrador',
          descricao: data.motivo.trim() || 'Agenda bloqueada pelo Administrador',
          data_inicio: dInicio.toISOString(),
          data_fim: dFim.toISOString(),
          tipo: 'BLOQUEIO',
          status: 'CONFIRMADO',
          cliente_id: null,
          criado_por: user.id,
        });

        cur = addDays(cur, 1);
      }

      const { error } = await supabase.from('agendamentos').insert(inserts);
      if (error) {
        console.error('[agenda] lock error', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
      setIsLockDialogOpen(false);
      toast.success('Agenda travada com sucesso!');
    },
    onError: (error: unknown) => {
      toast.error('Erro ao travar agenda: ' + errorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (event: AgendaEvent) => {
      if (!user?.id) throw new Error('Sessão inválida. Faça login novamente.');
      if (!isAdmin) {
        throw new Error('Apenas o Administrador tem autorização para excluir agendamentos da agenda.');
      }
      const { data: deleted, error } = await supabase
        .from('agendamentos')
        .delete()
        .eq('id', event.id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!deleted) throw new Error('Agendamento não encontrado.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
      toast.success('Agendamento cancelado com sucesso!');
    },
    onError: (error: unknown) => {
      toast.error('Erro ao cancelar: ' + errorMessage(error));
    }
  });

  const confirmMutation = useMutation({
    mutationFn: async (event: AgendaEvent) => {
      if (!user?.id) throw new Error('Sessão inválida. Faça login novamente.');
      if (!isAdmin && event.criado_por_id !== user.id) {
        throw new Error('Você só pode confirmar os agendamentos que criou.');
      }
      let confirmQuery = supabase
        .from('agendamentos')
        .update({ status: 'CONFIRMADO' })
        .eq('id', event.id);
      if (!isAdmin) confirmQuery = confirmQuery.eq('criado_por', user.id);
      const { data: confirmed, error } = await confirmQuery.select('id').maybeSingle();
      if (error) throw error;
      if (!confirmed) throw new Error('Você não tem permissão para confirmar este agendamento.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agendamentos'] });
      toast.success('Agendamento confirmado!');
    },
    onError: (error: unknown) => {
      toast.error('Erro ao confirmar: ' + errorMessage(error));
    }
  });

  const handleEdit = (event: AgendaEvent) => {
    if (!isAdmin && event.criado_por_id !== user?.id) {
      toast.error('Você só pode alterar os agendamentos que criou.');
      return;
    }
    const start = parseISO(event.data_inicio);
    const end = parseISO(event.data_fim);
    setFormData({
      titulo: event.titulo,
      descricao: event.descricao || '',
      data: format(start, 'yyyy-MM-dd'),
      hora_inicio: format(start, 'HH:mm'),
      hora_fim: format(end, 'HH:mm'),
      tipo: event.tipo,
      cliente_id: event.cliente_id || ''
    });
    setEditingEventId(event.id);
    setIsDialogOpen(true);
  };

  const handleDelete = (event: AgendaEvent) => {
    if (!isAdmin) {
      toast.error('Apenas o Administrador tem autorização para excluir agendamentos da agenda.');
      return;
    }
    const isLock = event.tipo === 'BLOQUEIO';
    if (confirm(isLock ? 'Deseja destravar a agenda neste período?' : 'Deseja realmente cancelar este agendamento?')) {
      deleteMutation.mutate(event);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="workspace-eyebrow">Um calendário para toda a equipe</p>
          <h1 className="workspace-title mt-2">Agenda compartilhada</h1>
          <p className="mt-2 text-sm text-slate-500">
            Todos enxergam os compromissos. Cada projetista administra somente a própria agenda; o
            administrador pode travar períodos da agenda e gerenciar todos.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Botão Travar Agenda - Exclusivo para Administrador */}
          {isAdmin && (
            <Dialog open={isLockDialogOpen} onOpenChange={setIsLockDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-slate-900 text-amber-300 hover:bg-slate-800 border border-slate-700 shadow-sm font-semibold text-xs">
                  <Lock className="mr-1.5 h-4 w-4 text-amber-400" />
                  Travar Agenda
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-slate-900">
                    <Lock className="h-5 w-5 text-amber-500" />
                    Travar Agenda (Exclusivo Administrador)
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500">
                    Bloqueie um dia específico ou intervalo de datas para impedir que qualquer usuário conte com você ou marque reuniões nesse período.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 py-2 text-xs">
                  <div className="grid gap-1.5">
                    <Label htmlFor="lock-titulo">Título / Aviso</Label>
                    <Input
                      id="lock-titulo"
                      value={lockFormData.titulo}
                      onChange={e => setLockFormData({ ...lockFormData, titulo: e.target.value })}
                      placeholder="Ex: 🔒 Agenda Travada pelo Administrador"
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="lock-motivo">Motivo / Observação</Label>
                    <Input
                      id="lock-motivo"
                      value={lockFormData.motivo}
                      onChange={e => setLockFormData({ ...lockFormData, motivo: e.target.value })}
                      placeholder="Ex: Indisponível, Férias, Reunião de Diretoria"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="lock-inicio">Data Inicial</Label>
                      <Input
                        id="lock-inicio"
                        type="date"
                        value={lockFormData.data_inicio}
                        onChange={e => setLockFormData({ ...lockFormData, data_inicio: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="lock-fim">Data Final</Label>
                      <Input
                        id="lock-fim"
                        type="date"
                        value={lockFormData.data_fim}
                        onChange={e => setLockFormData({ ...lockFormData, data_fim: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <input
                      type="checkbox"
                      id="dia-inteiro"
                      checked={lockFormData.dia_inteiro}
                      onChange={e => setLockFormData({ ...lockFormData, dia_inteiro: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <label htmlFor="dia-inteiro" className="text-xs font-semibold text-slate-800 cursor-pointer">
                      Travar o Dia Todo (00:00 às 23:59)
                    </label>
                  </div>

                  {!lockFormData.dia_inteiro && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="grid gap-1.5">
                        <Label htmlFor="lock-hora-inicio">Hora Inicial</Label>
                        <Input
                          id="lock-hora-inicio"
                          type="time"
                          value={lockFormData.hora_inicio}
                          onChange={e => setLockFormData({ ...lockFormData, hora_inicio: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <Label htmlFor="lock-hora-fim">Hora Término</Label>
                        <Input
                          id="lock-hora-fim"
                          type="time"
                          value={lockFormData.hora_fim}
                          onChange={e => setLockFormData({ ...lockFormData, hora_fim: e.target.value })}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-[11px] text-amber-800">
                    <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Nenhum outro usuário poderá agendar compromissos neste período. O calendário exibirá os dias marcados em preto com cadeado.
                    </span>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    onClick={() => lockMutation.mutate(lockFormData)}
                    disabled={lockMutation.isPending}
                    className="w-full bg-slate-900 text-amber-300 hover:bg-slate-800 font-bold"
                  >
                    {lockMutation.isPending ? 'Travando Agenda...' : 'Confirmar e Travar Agenda'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingEventId(null);
              setFormData({ titulo: '', descricao: '', data: '', hora_inicio: '', hora_fim: '', tipo: 'REUNIAO', cliente_id: '' });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 shadow-sm text-xs">
                <Plus className="mr-2 h-4 w-4" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
              <DialogHeader>
                <DialogTitle>
                  {editingEventId
                    ? isAdmin
                      ? 'Editar Compromisso'
                      : 'Solicitar Alteração de Horário'
                    : 'Agendar Compromisso'}
                </DialogTitle>
                {!isAdmin && editingEventId && (
                  <DialogDescription className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2.5 rounded-lg mt-1">
                    Como projetista, você pode sugerir a alteração de horário. A solicitação será enviada ao Administrador e passará a valer para toda a equipe assim que autorizada.
                  </DialogDescription>
                )}
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="titulo">Título</Label>
                  <Input id="titulo" value={formData.titulo} onChange={(e) => setFormData({...formData, titulo: e.target.value})} placeholder="Ex: Reunião de Briefing" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="data">Data</Label>
                    <Input id="data" type="date" value={formData.data} onChange={(e) => setFormData({...formData, data: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tipo">Tipo de Compromisso</Label>
                    <Select value={formData.tipo} onValueChange={(v) => setFormData({...formData, tipo: v})}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VISITA">📏 Tirar Medida (Verde)</SelectItem>
                        <SelectItem value="ATENDIMENTO">📞 Atendimento (Azul)</SelectItem>
                        <SelectItem value="REUNIAO">🤝 Reunião Cliente (Vermelho)</SelectItem>
                        {isAdmin && (
                          <SelectItem value="BLOQUEIO">🔒 Agenda Travada (Admin)</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="inicio">Hora início</Label>
                    <Input id="inicio" type="time" value={formData.hora_inicio} onChange={(e) => setFormData({...formData, hora_inicio: e.target.value})} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="fim">Hora término</Label>
                    <Input id="fim" type="time" value={formData.hora_fim} onChange={(e) => setFormData({...formData, hora_fim: e.target.value})} />
                  </div>
                </div>
                <div
                  className={cn(
                    'flex items-start gap-2 rounded-xl border p-3 text-xs leading-5',
                    formData.tipo === 'REUNIAO'
                      ? 'border-red-200 bg-red-50 text-red-800'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-800',
                  )}
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {formData.tipo === 'REUNIAO'
                      ? 'A reunião pode coincidir com a agenda de outro projetista, mas não com outra reunião sua.'
                      : 'Este compromisso pode coincidir com outros horários, pois cada projetista possui sua própria agenda.'}
                  </span>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="cliente">Cliente Vinculado (Opcional)</Label>
                  <Select value={formData.cliente_id} onValueChange={(v) => setFormData({...formData, cliente_id: v})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} className="w-full sm:w-auto">
                  {editingEventId
                    ? isAdmin
                      ? 'Salvar Alterações'
                      : 'Enviar Solicitação ao Administrador'
                    : 'Confirmar Agendamento'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card className="workspace-card lg:col-span-5 border-none shadow-none h-fit">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg">Calendário</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              locale={ptBR}
              className="rounded-md w-full"
              modifiers={modifiers}
              dayTooltips={dayTooltips}
              modifiersClassNames={{
                VISITA: "bg-green-100 text-green-700 font-bold border-b-2 border-green-500",
                ATENDIMENTO: "bg-blue-100 text-blue-700 font-bold border-b-2 border-blue-500",
                REUNIAO: "bg-red-100 text-red-700 font-bold border-b-2 border-red-500",
                BLOQUEIO: "bg-slate-900 text-amber-300 font-bold border-b-2 border-amber-400 shadow-sm"
              }}
            />
            <div className="mt-4 p-3 border-t grid grid-cols-1 gap-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Legendas:</p>
              <div className="flex items-center gap-2 text-xs font-medium">
                <div className="w-3 h-3 rounded bg-green-500" />
                <span>📏 Tirar Medida (Verde)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <div className="w-3 h-3 rounded bg-blue-500" />
                <span>📞 Atendimento (Azul)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <div className="w-3 h-3 rounded bg-red-500" />
                <span>🤝 Reunião com Cliente (Vermelho)</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <div className="w-3 h-3 rounded bg-slate-900 border border-amber-400" />
                <span>🔒 Agenda Travada (Admin)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Compromissos do Dia: {selectedDate ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR }) : ''}
            </h2>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredEvents.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center">
                <CalendarIcon className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">Nenhum compromisso para este dia.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filteredEvents.map((event) => {
                const isConfirmed = event.status === 'CONFIRMADO';
                const isPendingChange = event.status === 'ALTERACAO_SOLICITADA';
                const isBloqueio = event.tipo === 'BLOQUEIO';
                const canManage = isAdmin || (!isBloqueio && event.criado_por_id === user?.id);

                return (
                <Card
                  key={event.id}
                  className={cn(
                    "hover:shadow-md transition-all border-l-4 overflow-hidden group",
                    isBloqueio
                      ? "border-l-slate-900 bg-slate-900/5 border-slate-200"
                      : isPendingChange
                      ? "border-l-amber-500 bg-amber-50/20 ring-1 ring-amber-300"
                      : isConfirmed && "ring-2 ring-emerald-400/60 bg-emerald-50/30"
                  )}
                  style={{
                    borderLeftColor: isBloqueio
                      ? '#0f172a'
                      : isPendingChange
                      ? '#f59e0b'
                      : event.tipo === 'REUNIAO'
                      ? '#ef4444'
                      : event.tipo === 'ATENDIMENTO'
                      ? '#3b82f6'
                      : '#22c55e'
                  }}
                >
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${isBloqueio ? 'bg-slate-900 text-amber-300' : isPendingChange ? 'bg-amber-100 text-amber-700' : isConfirmed ? 'bg-emerald-100 text-emerald-600' : 'bg-muted/50 text-muted-foreground'}`}>
                        {isBloqueio ? <Lock className="h-5 w-5 text-amber-400" /> : isPendingChange ? <Clock className="h-5 w-5 text-amber-600" /> : isConfirmed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Clock className="h-5 w-5" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className={cn("font-bold text-foreground", isBloqueio && "text-slate-900 font-black")}>
                            {event.titulo}
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIPO_BADGE_COLORS[event.tipo] || 'bg-slate-100'}`}>
                            {TIPO_LABELS[event.tipo] || event.tipo}
                          </span>
                          {isBloqueio && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                              Exclusivo Admin
                            </span>
                          )}
                          {!isBloqueio && isConfirmed && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Confirmado
                            </span>
                          )}
                          {!isBloqueio && isPendingChange && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                              <Clock className="h-3 w-3 text-amber-600" /> Alteração Solicitada
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-primary/80">
                            {format(parseISO(event.data_inicio), "HH:mm")} - {format(parseISO(event.data_fim), "HH:mm")}
                          </span>
                          <span className="flex items-center gap-1 border-l pl-3">
                            <User className="h-3 w-3" />
                            {event.criado_por?.nome || (isBloqueio ? 'Administrador' : 'Usuário')}
                          </span>
                          {event.descricao && (
                            <span className="text-slate-500 italic border-l pl-3">
                              {event.descricao}
                            </span>
                          )}
                          {event.cliente && (
                            <span className="font-medium bg-muted px-2 rounded">
                              Cliente: {event.cliente.nome}
                            </span>
                          )}
                        </div>

                        {isPendingChange && event.data_sugerida_inicio && event.data_sugerida_fim && (
                          <div className="mt-2.5 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1.5">
                            <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                              <span>Alteração solicitada pelo projetista (Aguardando autorização do Administrador):</span>
                            </div>
                            <p className="text-slate-800">
                              Novo Horário Sugerido: <strong className="text-amber-900">{format(parseISO(event.data_sugerida_inicio), "dd/MM/yyyy 'às' HH:mm")} até {format(parseISO(event.data_sugerida_fim), "HH:mm")}</strong>
                            </p>
                            {event.motivo_alteracao && (
                              <p className="text-slate-600 italic">
                                Motivo: {event.motivo_alteracao}
                              </p>
                            )}
                            {isAdmin && (
                              <div className="pt-1 flex items-center gap-2">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                  onClick={() => approveChangeMutation.mutate(event)}
                                  disabled={approveChangeMutation.isPending}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Autorizar Alteração
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                                  onClick={() => rejectChangeMutation.mutate(event)}
                                  disabled={rejectChangeMutation.isPending}
                                >
                                  Recusar
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 self-end md:self-center">
                      {!isConfirmed && !isBloqueio && !isPendingChange && canManage && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                          onClick={() => confirmMutation.mutate(event)}
                          disabled={confirmMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Confirmar
                        </Button>
                      )}
                      <div className="flex items-center gap-1">
                        {canManage && !isBloqueio && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary"
                            onClick={() => handleEdit(event)}
                            title={isAdmin ? "Editar compromisso" : "Solicitar alteração de horário"}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        )}
                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => handleDelete(event)}
                            title={isBloqueio ? "Destravar Agenda neste dia/horário" : "Cancelar agendamento"}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
