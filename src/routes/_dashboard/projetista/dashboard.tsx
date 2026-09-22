import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CirclePause,
  Clock3,
  ContactRound,
  FolderKanban,
  Sparkles,
  UserRoundCheck,
  Calculator,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

import logoDF from "@/assets/logo-df.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  deadlineState,
  formatDate,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_STYLES,
} from "@/lib/project-utils";
import type { ProjectStatus } from "@/types/database";

export const Route = createFileRoute("/_dashboard/projetista/dashboard")({
  component: DesignerDashboard,
});

interface DesignerProject {
  id: string;
  nome: string | null;
  status: ProjectStatus;
  prazo_termino: string | null;
  estagio_andamento: string | null;
  cliente: { id: string; nome: string; telefone: string | null } | null;
}

interface AgendaItem {
  id: string;
  titulo: string;
  data_inicio: string;
  cliente: { nome: string } | null;
}

function effectiveStatus(project: DesignerProject): ProjectStatus {
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

function DesignerDashboard() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ["designer-operation", user?.id],
    staleTime: 1000 * 60 * 3, // Cache ativo de 3 minutos para navegação instantânea em 0ms
    gcTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!user?.id) return { projects: [], agenda: [], clientCount: 0 };
      const [projectResult, agendaResult, clientResult] = await Promise.all([
        supabase
          .from("projetos")
          .select(
            "id, nome, status, prazo_termino, estagio_andamento, cliente:clientes(id, nome, telefone)",
          )
          .eq("projetista_id", user.id)
          .order("prazo_termino", { ascending: true }),
        supabase
          .from("agendamentos")
          .select("id, titulo, data_inicio, cliente:clientes(nome)")
          .gte("data_inicio", new Date().toISOString())
          .order("data_inicio", { ascending: true })
          .limit(5),
        supabase.from("clientes").select("id", { count: "exact", head: true }),
      ]);
      if (projectResult.error) throw projectResult.error;
      if (agendaResult.error) throw agendaResult.error;
      if (clientResult.error) throw clientResult.error;
      return {
        projects: (projectResult.data ?? []) as unknown as DesignerProject[],
        agenda: (agendaResult.data ?? []) as unknown as AgendaItem[],
        clientCount: clientResult.count ?? 0,
      };
    },
    enabled: Boolean(user?.id),
  });

  const projects = useMemo(() => data?.projects ?? [], [data?.projects]);
  const agenda = data?.agenda ?? [];
  const priorities = useMemo(
    () =>
      projects
        .filter((project) => project.status !== "FINALIZADO")
        .sort((a, b) => {
          return (a.prazo_termino || "9999-12-31").localeCompare(b.prazo_termino || "9999-12-31");
        }),
    [projects],
  );

  const pendingAcceptanceCount = projects.filter((p) => p.status === "PRONTO").length;
  const activeCount = projects.filter((p) =>
    ["EM_EXECUCAO", "ATRASADO", "EM_ACOMPANHAMENTO"].includes(effectiveStatus(p)),
  ).length;
  const criticalCount = projects.filter((project) => {
    const days = deadlineState(project.prazo_termino).days;
    return days !== null && days <= 2 && project.status !== "FINALIZADO";
  }).length;
  const pausedCount = projects.filter((p) => p.status === "PAUSADO").length;

  if (isLoading && !data) return <div className="h-44 animate-pulse rounded-3xl bg-slate-200/80 max-w-7xl mx-auto" />;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO EXECUTIVO DO PROJETISTA                      */}
      {/* ========================================================= */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c0d10] via-[#14161b] to-[#1c1f26] border border-white/10 p-6 md:p-8 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#c52227]/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 h-32 w-64 bg-[#c5a059]/15 blur-3xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="flex items-start gap-4">
            <div className="hidden sm:flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 p-2.5 border border-white/15 backdrop-blur-md shadow-inner">
              <img src={logoDF} alt="DF Móveis Planejados" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c5a059]/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ebd7a7] border border-[#c5a059]/30">
                  <Sparkles className="h-3 w-3 text-[#c5a059]" /> DÁRIO FERNANDES · ÁREA DO PROJETISTA
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Mesa de Trabalho Ativa
                </span>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">
                Olá, {user?.nome?.split(" ")[0]}.
              </h1>
              <p className="mt-1 max-w-xl text-xs md:text-sm text-slate-300/80 leading-relaxed">
                Acompanhe suas demandas atribuídas, mantenha os prazos alinhados e avance cada etapa de projeto.
              </p>
            </div>
          </div>

          {/* Atalhos Rápidos */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild className="bg-[#c52227] hover:bg-[#aa1726] text-white font-semibold text-xs shadow-md transition-all h-9 px-4">
              <Link to="/demandas">
                Próximo da Fila <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-[#c5a059]/60 bg-[#c5a059]/10 hover:bg-[#c5a059]/20 text-[#ebd7a7] hover:text-white font-semibold text-xs h-9 px-3.5 transition-all"
            >
              <Link to="/orcamento">
                <Calculator className="mr-1.5 h-4 w-4 text-[#c5a059]" /> Calculadora
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white text-xs h-9 px-3"
            >
              <Link to="/projetista/meus-projetos">
                <BriefcaseBusiness className="mr-1.5 h-3.5 w-3.5 text-[#ebd7a7]" /> Meus Projetos
              </Link>
            </Button>

            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white text-xs h-9 px-3"
            >
              <Link to="/agenda">
                <CalendarDays className="mr-1.5 h-3.5 w-3.5 text-[#ebd7a7]" /> Agenda
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 2. KPIS OPERACIONAIS DO PROJETISTA                        */}
      {/* ========================================================= */}
      <section className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
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
                Demandas liberadas <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <UserRoundCheck className="h-5 w-5" />
            </div>
          </div>
        </Link>

        <Link
          to="/projetista/meus-projetos"
          className="group block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 border-l-sky-500"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Em Andamento</p>
              <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-slate-900 group-hover:text-sky-700 transition-colors">
                {activeCount}
              </p>
              <p className="mt-1 text-[11px] font-medium text-sky-600 flex items-center gap-1">
                Na sua mesa <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
              <FolderKanban className="h-5 w-5" />
            </div>
          </div>
        </Link>

        <Link
          to="/projetista/meus-projetos"
          className="group block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 border-l-[#c52227]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Perto do Prazo</p>
              <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-[#c52227]">
                {criticalCount}
              </p>
              <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                Prioridade máxima <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-[#c52227]">
              <Clock3 className="h-5 w-5" />
            </div>
          </div>
        </Link>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs border-l-4 border-l-slate-400">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Pausados</p>
              <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-slate-700">
                {pausedCount}
              </p>
              <p className="mt-1 text-[11px] font-medium text-slate-500">
                Aguardando cliente
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
              <CirclePause className="h-5 w-5" />
            </div>
          </div>
        </div>

        <Link
          to="/projetista/clientes"
          className="group block rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md border-l-4 border-l-[#c5a059]"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500">Base de Clientes</p>
              <p className="mt-1.5 text-2xl md:text-3xl font-bold tracking-tight text-slate-900 group-hover:text-[#c5a059] transition-colors">
                {data?.clientCount ?? 0}
              </p>
              <p className="mt-1 text-[11px] font-medium text-[#a08753] flex items-center gap-1">
                Clientes cadastrados <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c5a059]/15 text-[#a08753]">
              <ContactRound className="h-5 w-5" />
            </div>
          </div>
        </Link>
      </section>

      {/* ========================================================= */}
      {/* 3. LISTAS DE PROJETOS E AGENDA DA LOJA                    */}
      {/* ========================================================= */}
      <section className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 p-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Prioridades de Projeto</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ordenado pelo prazo de entrega mais próximo</p>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-[#c52227] hover:bg-rose-50 font-semibold">
              <Link to="/projetista/meus-projetos">Ver todos os projetos</Link>
            </Button>
          </div>

          {priorities.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 my-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              Nenhum projeto pendente na sua fila neste momento.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[460px]">
              {priorities.map((project) => {
                const status = project.status === "PRONTO" ? "PRONTO" : effectiveStatus(project);
                const deadline = deadlineState(project.prazo_termino);
                return (
                  <div
                    key={project.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-900">
                        {project.nome || "Projeto sem nome"}
                      </p>
                      <p className="truncate text-xs text-slate-500 mt-0.5">
                        {project.cliente?.nome} · Etapa: <span className="font-semibold text-slate-700">{project.estagio_andamento || "Briefing"}</span>
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`w-fit rounded-full text-[10px] font-bold ${
                        project.status === "PRONTO"
                          ? "border-violet-200 bg-violet-50 text-violet-700"
                          : PROJECT_STATUS_STYLES[status]
                      }`}
                    >
                      {project.status === "PRONTO"
                        ? "Liberado pela gestão"
                        : PROJECT_STATUS_LABELS[status]}
                    </Badge>
                    <div className="sm:text-right min-w-[110px]">
                      <p className="text-xs font-semibold text-slate-800">
                        {formatDate(project.prazo_termino)}
                      </p>
                      <p
                        className={`mt-0.5 text-[10px] ${
                          deadline.tone === "danger" ? "font-bold text-rose-600" : "text-slate-400"
                        }`}
                      >
                        {deadline.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Agenda da Loja */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 p-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-[#c5a059]" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">Agenda da Loja</h3>
                <p className="text-xs text-slate-500">Próximos compromissos compartilhados</p>
              </div>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-[#c5a059] hover:bg-amber-50 font-semibold">
              <Link to="/agenda">Ver Agenda</Link>
            </Button>
          </div>

          {agenda.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 my-auto">
              Nenhum compromisso agendado para os próximos dias.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[460px]">
              {agenda.map((item) => {
                const date = new Date(item.data_inicio);
                return (
                  <div key={item.id} className="flex items-start gap-3 p-4 hover:bg-slate-50/70 transition-colors">
                    <div className="w-12 shrink-0 rounded-xl bg-slate-900 text-amber-300 py-2 text-center shadow-xs">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-[#ebd7a7]">
                        {date.toLocaleDateString("pt-BR", { month: "short" })}
                      </p>
                      <p className="text-base font-black leading-tight text-white">
                        {date.getDate()}
                      </p>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900">{item.titulo}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                        {item.cliente?.nome ?? "Equipe DF Móveis"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
export default DesignerDashboard;
