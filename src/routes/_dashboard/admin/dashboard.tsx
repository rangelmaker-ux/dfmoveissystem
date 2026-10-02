import { useMemo, useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CirclePause,
  Clock3,
  ContactRound,
  FolderKanban,
  Route as RouteIcon,
  Sparkles,
  UserRoundCheck,
  UsersRound,
  Calculator,
  Search,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Phone,
  Mail,
  ShieldCheck,
  Check,
  X,
  Eye,
  AlertTriangle,
  Building2,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

import logoDF from "@/assets/logo-df.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import {
  deadlineState,
  formatDate,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
} from "@/lib/project-utils";
import type { ProjectStatus } from "@/types/database";
import { validateStoredAccess } from "@/hooks/use-auth";

export const Route = createFileRoute("/_dashboard/admin/dashboard")({
  beforeLoad: async () => {
    const access = await validateStoredAccess();
    const role = access.authorized ? access.account?.role : undefined;
    if (role !== "ADMIN") throw redirect({ to: "/projetista/dashboard" });
  },
  component: AdminDashboard,
});

interface OperationProject {
  id: string;
  nome: string | null;
  status: ProjectStatus;
  prazo_termino: string | null;
  projetista_id: string | null;
  observacoes?: string | null;
  cliente: { id?: string; nome: string; telefone?: string | null; email?: string | null } | null;
  projetista: { id: string; nome: string; avatar_url: string | null } | null;
}

interface OperationDesigner {
  id: string;
  nome: string;
  avatar_url: string | null;
  telefone?: string | null;
  email?: string | null;
}

interface AgendaItem {
  id: string;
  titulo: string;
  descricao?: string | null;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  status: string;
  data_sugerida_inicio?: string | null;
  data_sugerida_fim?: string | null;
  motivo_alteracao?: string | null;
  criado_por: { id?: string; nome: string } | null;
  cliente: { id?: string; nome: string } | null;
}

function statusWithDeadline(project: OperationProject): ProjectStatus {
  const deadline = deadlineState(project.prazo_termino);
  if (
    deadline.days !== null &&
    deadline.days < 0 &&
    !["PAUSADO", "FINALIZADO"].includes(project.status)
  ) {
    return "ATRASADO";
  }
  return project.status;
}

function AdminDashboard() {
  const queryClient = useQueryClient();
  const [selectedProject, setSelectedProject] = useState<OperationProject | null>(null);
  const [attentionFilter, setAttentionFilter] = useState<"ALL" | "UNASSIGNED" | "DELAYED" | "PAUSED">("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-operation"],
    staleTime: 1000 * 60 * 3, // Cache ativo de 3 minutos para navegação instantânea em 0ms
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      const today = new Date().toISOString();
      const [projectResult, designerResult, agendaResult] = await Promise.all([
        supabase
          .from("projetos")
          .select(
            "id, nome, status, prazo_termino, projetista_id, observacoes, cliente:clientes(id, nome, telefone, email), projetista:users(id, nome, avatar_url)",
          )
          .order("created_at", { ascending: false }),
        supabase
          .from("users")
          .select("id, nome, avatar_url, email")
          .eq("role", "PROJETISTA")
          .eq("status", "ATIVO")
          .order("nome"),
        supabase
          .from("agendamentos")
          .select(
            "id, titulo, descricao, data_inicio, data_fim, tipo, status, data_sugerida_inicio, data_sugerida_fim, motivo_alteracao, criado_por:users(id, nome), cliente:clientes(id, nome)",
          )
          .order("data_inicio", { ascending: true }),
      ]);

      if (projectResult.error) {
        console.error("Erro ao buscar projetos:", projectResult.error);
        throw projectResult.error;
      }
      if (designerResult.error) {
        console.error("Erro ao buscar projetistas:", designerResult.error);
        throw designerResult.error;
      }
      if (agendaResult.error) {
        console.error("Erro ao buscar agenda:", agendaResult.error);
        throw agendaResult.error;
      }

      const allAgendas = (agendaResult.data ?? []) as unknown as AgendaItem[];
      const pendingScheduleChanges = allAgendas.filter((a) => a.status === "ALTERACAO_SOLICITADA");
      const upcomingAgenda = allAgendas.filter((a) => a.data_inicio >= today).slice(0, 6);

      return {
        projects: (projectResult.data ?? []) as unknown as OperationProject[],
        designers: (designerResult.data ?? []) as OperationDesigner[],
        agenda: upcomingAgenda,
        pendingScheduleChanges: pendingScheduleChanges,
      };
    },
  });

  const projects = useMemo(() => data?.projects ?? [], [data?.projects]);
  const designers = useMemo(() => data?.designers ?? [], [data?.designers]);
  const agenda = data?.agenda ?? [];
  const pendingScheduleChanges = data?.pendingScheduleChanges ?? [];

  // Mutações para autorizar / recusar solicitação de alteração da agenda diretamente na Visão Geral
  const approveChangeMutation = useMutation({
    mutationFn: async (event: AgendaItem) => {
      if (!event.data_sugerida_inicio || !event.data_sugerida_fim) {
        throw new Error("Nenhum horário sugerido foi encontrado para este compromisso.");
      }
      const { error } = await supabase
        .from("agendamentos")
        .update({
          data_inicio: event.data_sugerida_inicio,
          data_fim: event.data_sugerida_fim,
          data_sugerida_inicio: null,
          data_sugerida_fim: null,
          motivo_alteracao: null,
          status: "CONFIRMADO",
        })
        .eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-operation"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.success("Alteração de horário autorizada com sucesso! O novo horário agora é oficial.");
    },
    onError: (err: unknown) => {
      toast.error("Erro ao aprovar: " + (err instanceof Error ? err.message : String(err)));
    },
  });

  const rejectChangeMutation = useMutation({
    mutationFn: async (event: AgendaItem) => {
      const { error } = await supabase
        .from("agendamentos")
        .update({
          data_sugerida_inicio: null,
          data_sugerida_fim: null,
          motivo_alteracao: null,
          status: "CONFIRMADO",
        })
        .eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-operation"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      toast.info("Solicitação recusada. O horário original foi mantido.");
    },
    onError: (err: unknown) => {
      toast.error("Erro ao recusar: " + (err instanceof Error ? err.message : String(err)));
    },
  });

  // Projetos que requerem atenção gerencial
  const allAttentionProjects = useMemo(() => {
    return projects
      .filter((project) => {
        const deadline = deadlineState(project.prazo_termino);
        return (
          !project.projetista_id ||
          project.status === "PAUSADO" ||
          (deadline.days !== null && deadline.days <= 2 && project.status !== "FINALIZADO")
        );
      })
      .sort((a, b) => {
        if (!a.projetista_id && b.projetista_id) return -1;
        if (a.projetista_id && !b.projetista_id) return 1;
        return (a.prazo_termino || "9999-12-31").localeCompare(b.prazo_termino || "9999-12-31");
      });
  }, [projects]);

  // Filtros aplicados sobre a lista de atenção
  const filteredAttentionProjects = useMemo(() => {
    return allAttentionProjects.filter((project) => {
      const deadline = deadlineState(project.prazo_termino);
      const isUnassigned = !project.projetista_id;
      const isPaused = project.status === "PAUSADO";
      const isDelayed = deadline.days !== null && deadline.days <= 2 && project.status !== "FINALIZADO";

      if (attentionFilter === "UNASSIGNED" && !isUnassigned) return false;
      if (attentionFilter === "DELAYED" && !isDelayed) return false;
      if (attentionFilter === "PAUSED" && !isPaused) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const projectName = (project.nome || "").toLowerCase();
        const clientName = (project.cliente?.nome || "").toLowerCase();
        const designerName = (project.projetista?.nome || "").toLowerCase();
        return projectName.includes(term) || clientName.includes(term) || designerName.includes(term);
      }

      return true;
    });
  }, [allAttentionProjects, attentionFilter, searchTerm]);

  // Carga de trabalho dos projetistas
  const workload = useMemo(() => {
    return designers.map((designer) => {
      const own = projects.filter((project) => project.projetista_id === designer.id);
      const active = own.filter((project) =>
        ["EM_EXECUCAO", "ATRASADO", "EM_ACOMPANHAMENTO"].includes(project.status),
      );
      const pending = own.filter((project) => project.status === "PRONTO");
      const dueSoon = active.filter((project) => {
        const days = deadlineState(project.prazo_termino).days;
        return days !== null && days <= 2;
      });
      return {
        ...designer,
        total: own.length,
        active: active.length,
        pending: pending.length,
        paused: own.filter((project) => project.status === "PAUSADO").length,
        dueSoon: dueSoon.length,
      };
    });
  }, [designers, projects]);

  // Contagens dos indicadores
  const unassignedCount = projects.filter((project) => !project.projetista_id).length;
  const pendingAcceptanceCount = projects.filter(
    (project) => project.projetista_id && project.status === "PRONTO",
  ).length;
  const inProgressCount = projects.filter(
    (project) => statusWithDeadline(project) === "EM_EXECUCAO",
  ).length;
  const pausedCount = projects.filter((project) => project.status === "PAUSADO").length;
  const criticalCount = projects.filter(
    (project) => statusWithDeadline(project) === "ATRASADO",
  ).length;

  if (isLoading && !data) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        <div className="h-44 animate-pulse rounded-3xl bg-slate-200/80" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO EXECUTIVO — IDENTIDADE DÁRIO FERNANDES       */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c0d10] via-[#14161b] to-[#1c1f26] border border-white/10 p-6 md:p-8 text-white shadow-xl">
        {/* Efeitos de iluminação ambiente nas cores da marca: Vermelho Carmim e Ouro Nobre */}
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#c52227]/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 h-32 w-64 bg-[#c5a059]/15 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          {/* Identificação Corporativa */}
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-2.5 border border-white/15 backdrop-blur-md shadow-inner">
              <img src={logoDF} alt="DF Móveis Planejados" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c5a059]/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ebd7a7] border border-[#c5a059]/30">
                  <Sparkles className="h-3 w-3 text-[#c5a059]" /> DÁRIO FERNANDES · GESTÃO E OPERAÇÃO
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Operação Ativa
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
                Visão Geral Operacional
              </h1>
              <p className="mt-1 max-w-2xl text-xs md:text-sm text-slate-300/80 leading-relaxed">
                Acompanhamento em tempo real da carteira de projetos, distribuição de demandas, capacidade produtiva e compromissos da loja.
              </p>
            </div>
          </div>

          {/* Barra de Ações Rápidas Corporativas */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Botão de Destaque Vermelho DF */}
            <Button asChild className="bg-[#c52227] hover:bg-[#aa1726] text-white font-semibold text-xs shadow-md transition-all h-9 px-4">
              <Link to="/demandas">
                <RouteIcon className="mr-1.5 h-4 w-4" /> Distribuir Projetos
              </Link>
            </Button>

            {/* Botão Dourado Corporativo Orçamento */}
            <Button
              asChild
              variant="outline"
              className="border-[#c5a059]/60 bg-[#c5a059]/10 hover:bg-[#c5a059]/20 text-[#ebd7a7] hover:text-white font-semibold text-xs h-9 px-3.5 transition-all"
            >
              <Link to="/orcamento">
                <Calculator className="mr-1.5 h-4 w-4 text-[#c5a059]" /> Novo Orçamento
              </Link>
            </Button>

            {/* Botões Auxiliares de Navegação */}
            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white text-xs h-9 px-3"
            >
              <Link to="/agenda">
                <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-[#ebd7a7]" /> Agenda
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white text-xs h-9 px-3"
            >
              <Link to="/projetista/clientes">
                <ContactRound className="mr-1.5 h-3.5 w-3.5 text-[#ebd7a7]" /> Clientes
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. ALERTA EXECUTIVO DE SOLICITAÇÕES DE HORÁRIO DA AGENDA  */}
      {/* ========================================================= */}
      {pendingScheduleChanges.length > 0 && (
        <section className="rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500 text-white shadow-sm shrink-0">
                <Clock3 className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-amber-950">
                    Solicitações de Alteração de Horário Pendentes ({pendingScheduleChanges.length})
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                    Aguardando sua autorização
                  </span>
                </div>
                <p className="text-xs text-amber-800 mt-0.5">
                  Projetistas solicitaram alterações na agenda. O novo horário só começará a valer para a equipe após sua autorização explícita.
                </p>
              </div>
            </div>

            <Button asChild size="sm" variant="outline" className="border-amber-400 bg-white text-amber-900 hover:bg-amber-100 text-xs shrink-0 font-semibold">
              <Link to="/agenda">
                Gerenciar na Agenda <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="mt-3 grid gap-2">
            {pendingScheduleChanges.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-white border border-amber-200 p-3 shadow-xs"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {item.titulo} — <span className="text-slate-600 font-normal">{item.cliente?.nome || "Sem cliente"}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Solicitado por: <strong className="text-slate-700">{item.criado_por?.nome || "Projetista"}</strong> · Motivo: <span className="italic">{item.motivo_alteracao || "Alteração solicitada"}</span>
                  </p>
                  {item.data_sugerida_inicio && item.data_sugerida_fim && (
                    <p className="text-[11px] font-semibold text-amber-900 mt-0.5">
                      Novo Horário Proposto: {new Date(item.data_sugerida_inicio).toLocaleDateString("pt-BR")} das {new Date(item.data_sugerida_inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} às {new Date(item.data_sugerida_fim).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    onClick={() => approveChangeMutation.mutate(item)}
                    disabled={approveChangeMutation.isPending}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Autorizar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => rejectChangeMutation.mutate(item)}
                    disabled={rejectChangeMutation.isPending}
                  >
                    <X className="h-3.5 w-3.5 mr-1" />
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ========================================================= */}
      {/* 3. CARDS DE INDICADORES (KPIS CORPORATIVOS CLICÁVEIS)    */}
      {/* ========================================================= */}
      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        {/* Card 1: Novas Entradas (Aguardando Distribuição) */}
        <Link
          to="/demandas"
          className="group block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 border-l-[#c5a059]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Novas Entradas</p>
              <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-slate-900 group-hover:text-[#c5a059] transition-colors">
                {unassignedCount}
              </p>
              <p className="mt-1 text-[11px] font-medium text-[#a08753] flex items-center gap-1">
                Aguardando distribuição <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c5a059]/15 text-[#a08753]">
              <RouteIcon className="h-5 w-5" />
            </div>
          </div>
        </Link>

        {/* Card 2: Pendentes de Aceite */}
        <Link
          to="/demandas"
          className="group block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 border-l-violet-500"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Aguardando Aceite</p>
              <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-slate-900 group-hover:text-violet-700 transition-colors">
                {pendingAcceptanceCount}
              </p>
              <p className="mt-1 text-[11px] font-medium text-violet-600 flex items-center gap-1">
                Enviados aos projetistas <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <UserRoundCheck className="h-5 w-5" />
            </div>
          </div>
        </Link>

        {/* Card 3: Em Desenvolvimento */}
        <Link
          to="/demandas"
          className="group block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 border-l-sky-500"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Em Desenvolvimento</p>
              <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-slate-900 group-hover:text-sky-700 transition-colors">
                {inProgressCount}
              </p>
              <p className="mt-1 text-[11px] font-medium text-sky-600 flex items-center gap-1">
                Na carga ativa da equipe <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>
        </Link>

        {/* Card 4: Atenção ao Prazo (Críticos/Atrasados) */}
        <div
          onClick={() => setAttentionFilter("DELAYED")}
          className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 border-l-[#c52227] ${
            attentionFilter === "DELAYED" ? "ring-2 ring-[#c52227]" : "border-slate-200/80"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Atenção ao Prazo</p>
              <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-[#c52227]">
                {criticalCount}
              </p>
              <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                Vencidos ou em risco
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-[#c52227]">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Card 5: Pausados */}
        <div
          onClick={() => setAttentionFilter("PAUSED")}
          className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 border-l-slate-400 ${
            attentionFilter === "PAUSED" ? "ring-2 ring-slate-400" : "border-slate-200/80"
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Pausados</p>
              <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-slate-700">
                {pausedCount}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-500 flex items-center gap-1">
                Fora da carga ativa
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <CirclePause className="h-5 w-5" />
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. PROJETOS PRIORITÁRIOS & AGENDA DA LOJA                 */}
      {/* ========================================================= */}
      <section className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        {/* Bloco da Esquerda: Gestão Prioritária de Projetos */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden flex flex-col">
          {/* Header da Tabela com Filtros */}
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#c52227]" />
                  Projetos Prioritários & Gestão de Prazos
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Projetos que exigem acompanhamento, distribuição ou intervenção
                </p>
              </div>

              <Button asChild variant="ghost" size="sm" className="text-xs text-[#c52227] hover:text-[#aa1726] hover:bg-rose-50 font-semibold self-start sm:self-auto">
                <Link to="/demandas">
                  Central de Demandas <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>

            {/* Filtros por Categoria e Busca */}
            <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAttentionFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    attentionFilter === "ALL"
                      ? "bg-slate-900 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Todos ({allAttentionProjects.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAttentionFilter("UNASSIGNED")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    attentionFilter === "UNASSIGNED"
                      ? "bg-[#c5a059] text-white shadow-xs"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  Sem Projetista ({unassignedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAttentionFilter("DELAYED")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    attentionFilter === "DELAYED"
                      ? "bg-[#c52227] text-white shadow-xs"
                      : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  Perto do Prazo / Atrasados ({criticalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setAttentionFilter("PAUSED")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    attentionFilter === "PAUSED"
                      ? "bg-slate-700 text-white shadow-xs"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Pausados ({pausedCount})
                </button>
              </div>

              {/* Busca Rápida */}
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Filtrar projeto..."
                  className="h-8 pl-8 text-xs bg-slate-50 border-slate-200 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Lista de Projetos Prioritários */}
          {filteredAttentionProjects.length === 0 ? (
            <div className="p-12 text-center my-auto">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800">Operação Totalmente em Dia</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Não há nenhum projeto pendente nesta categoria no momento. Todos os projetos estão alocados e dentro dos prazos estipulados.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[460px]">
              {filteredAttentionProjects.map((project) => {
                const status = statusWithDeadline(project);
                const deadline = deadlineState(project.prazo_termino);
                const hasDesigner = Boolean(project.projetista_id);

                return (
                  <div
                    key={project.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Identificação do Projeto & Cliente */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {project.nome || "Projeto sem nome"}
                        </p>
                        {!hasDesigner && (
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                            Sem Projetista
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        Cliente: <strong className="text-slate-700">{project.cliente?.nome ?? "Cliente não informado"}</strong>
                        {project.cliente?.telefone && ` · ${project.cliente.telefone}`}
                      </p>
                    </div>

                    {/* Projetista Responsável */}
                    <div className="flex items-center gap-2 min-w-[150px]">
                      <UserAvatar
                        src={project.projetista?.avatar_url}
                        name={project.projetista?.nome ?? "Sem responsável"}
                        className="h-7 w-7 rounded-lg"
                      />
                      <span className="text-xs font-medium text-slate-700 truncate">
                        {project.projetista?.nome ?? "Não distribuído"}
                      </span>
                    </div>

                    {/* Prazo e Situação */}
                    <div className="sm:text-right min-w-[120px]">
                      <Badge
                        variant="outline"
                        className={`rounded-full text-[10px] font-bold ${PROJECT_STATUS_STYLES[status]}`}
                      >
                        {PROJECT_STATUS_LABELS[status]}
                      </Badge>
                      <p
                        className={`mt-1 text-[11px] ${
                          deadline.tone === "danger"
                            ? "font-bold text-rose-600"
                            : deadline.tone === "warning"
                            ? "font-semibold text-amber-600"
                            : "text-slate-400"
                        }`}
                      >
                        {formatDate(project.prazo_termino)}
                      </p>
                    </div>

                    {/* Ações Rápidas */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                        onClick={() => setSelectedProject(project)}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1 text-slate-500" /> Detalhes
                      </Button>
                      <Button asChild size="sm" className="h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium">
                        <Link to="/demandas">
                          Gerenciar
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bloco da Direita: Agenda da Loja */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#c5a059]" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Agenda da Loja</h3>
                <p className="text-xs text-slate-500">Próximos compromissos comerciais</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-[#c5a059] hover:text-[#a08753] hover:bg-amber-50 font-semibold">
              <Link to="/agenda">
                Ver Agenda <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          {agenda.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 my-auto">
              <CalendarDays className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              Nenhum compromisso agendado para os próximos dias.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[460px]">
              {agenda.map((item) => {
                const date = new Date(item.data_inicio);
                const isMeeting = item.tipo === "REUNIAO";
                const isVisit = item.tipo === "VISITA";
                const isLocked = item.tipo === "BLOQUEIO";

                return (
                  <div key={item.id} className="flex items-start gap-3 p-4 hover:bg-slate-50/70 transition-colors">
                    {/* Bloco de Data Nobre */}
                    <div className="w-12 shrink-0 rounded-xl bg-slate-900 text-amber-300 py-2 text-center shadow-xs">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#ebd7a7]">
                        {date.toLocaleDateString("pt-BR", { month: "short" })}
                      </p>
                      <p className="text-base font-black leading-tight text-white">
                        {date.getDate()}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-bold text-slate-900 truncate">{item.titulo}</p>
                        {isLocked && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            Bloqueio
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {item.cliente?.nome ?? item.criado_por?.nome ?? "Equipe DF Móveis"}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            isMeeting
                              ? "bg-red-100 text-red-700"
                              : isVisit
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {item.tipo}
                        </span>
                        {item.status === "CONFIRMADO" && (
                          <span className="text-[9px] text-emerald-700 font-semibold flex items-center gap-0.5">
                            <Check className="h-3 w-3" /> Confirmado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. CAPACIDADE E CARGA DE TRABALHO DA EQUIPE               */}
      {/* ========================================================= */}
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <UsersRound className="h-4 w-4 text-[#c5a059]" />
              <h3 className="text-base font-bold text-slate-900">Capacidade & Carga Produtiva da Equipe</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Distribuição operacional e monitoramento de projetos ativos por projetista
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="text-xs font-semibold self-start sm:self-auto border-slate-300">
            <Link to="/admin/equipe">
              Gerenciar Equipe <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {workload.map((designer) => {
            const isHighLoad = designer.active >= 5;
            const isAvailable = designer.active <= 2;

            return (
              <div
                key={designer.id}
                className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 transition-all hover:bg-slate-50 hover:shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar
                    src={designer.avatar_url}
                    name={designer.nome}
                    className="h-11 w-11 rounded-xl shadow-xs"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900">{designer.nome}</p>
                    <p className="text-[11px] text-slate-500">Projetista de Ambientes</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold tracking-tight text-slate-900">
                      {designer.active}
                    </span>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Ativos</p>
                  </div>
                </div>

                {/* Badge de Nível de Carga */}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-medium">Status de capacidade:</span>
                  <span
                    className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      isHighLoad
                        ? "bg-rose-100 text-rose-700"
                        : isAvailable
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {isHighLoad ? "Carga Elevada" : isAvailable ? "Disponível para Projetos" : "Carga Equilibrada"}
                  </span>
                </div>

                {/* Métricas Detalhadas */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-white border border-slate-200/60 p-2 text-center">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">Aceite</p>
                    <p
                      className={`mt-0.5 text-sm font-bold ${
                        designer.pending ? "text-violet-600" : "text-slate-700"
                      }`}
                    >
                      {designer.pending}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200/60 p-2 text-center">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">
                      Prazo Crítico
                    </p>
                    <p
                      className={`mt-0.5 text-sm font-bold ${
                        designer.dueSoon ? "text-rose-600" : "text-slate-700"
                      }`}
                    >
                      {designer.dueSoon}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200/60 p-2 text-center">
                    <p className="text-[9px] uppercase tracking-wide text-slate-400 font-bold">Pausados</p>
                    <p className="mt-0.5 text-sm font-bold text-slate-700">{designer.paused}</p>
                  </div>
                </div>

                {/* Atalho para Distribuir ou Ver Projetos daquele Projetista */}
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">Total geral: {designer.total}</span>
                  <Button asChild size="sm" variant="ghost" className="h-7 text-xs text-primary font-semibold hover:bg-slate-200/60 p-1">
                    <Link to="/demandas">
                      Ver na central <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 6. MODAL DE DETALHES RÁPIDOS DO PROJETO                   */}
      {/* ========================================================= */}
      <Dialog open={Boolean(selectedProject)} onOpenChange={(open) => !open && setSelectedProject(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#c52227]" />
              <DialogTitle className="text-slate-900 font-bold text-lg">
                {selectedProject?.nome || "Projeto Sem Título"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-slate-500">
              Ficha resumida com dados operacionais e de contato
            </DialogDescription>
          </DialogHeader>

          {selectedProject && (
            <div className="space-y-4 py-2 text-xs">
              {/* Card do Cliente */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Dados do Cliente
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {selectedProject.cliente?.nome || "Não informado"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                  {selectedProject.cliente?.telefone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{selectedProject.cliente.telefone}</span>
                      <a
                        href={`https://wa.me/55${selectedProject.cliente.telefone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-600 font-bold hover:underline ml-1"
                        title="Abrir no WhatsApp"
                      >
                        (WhatsApp)
                      </a>
                    </div>
                  )}
                  {selectedProject.cliente?.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">{selectedProject.cliente.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Informações de Produção */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Projetista Responsável
                  </p>
                  <p className="mt-1 font-semibold text-slate-800">
                    {selectedProject.projetista?.nome || "Aguardando atribuição"}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    Prazo Estipulado
                  </p>
                  <p className="mt-1 font-bold text-[#c52227]">
                    {formatDate(selectedProject.prazo_termino)}
                  </p>
                </div>
              </div>

              {/* Status Atual */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100">
                <span className="font-semibold text-slate-700">Situação do Projeto:</span>
                <Badge
                  variant="outline"
                  className={`rounded-full text-xs font-bold ${
                    PROJECT_STATUS_STYLES[statusWithDeadline(selectedProject)]
                  }`}
                >
                  {PROJECT_STATUS_LABELS[statusWithDeadline(selectedProject)]}
                </Badge>
              </div>

              {selectedProject.observacoes && (
                <div className="p-3 rounded-xl bg-white border border-slate-200">
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Observações</p>
                  <p className="text-slate-700 italic">{selectedProject.observacoes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setSelectedProject(null)}
              className="text-xs"
            >
              Fechar
            </Button>
            <Button asChild className="bg-[#c52227] hover:bg-[#aa1726] text-white text-xs font-semibold">
              <Link to="/demandas">
                Abrir na Central de Demandas <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
export default AdminDashboard;
