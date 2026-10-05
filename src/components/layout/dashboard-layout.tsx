import { supabase } from '@/integrations/supabase/client';
import {
  ArrowRight,
  Bell,
  BriefcaseBusiness,
  Calculator,
  CalendarDays,
  CircleDollarSign,
  ContactRound,
  LayoutDashboard,
  LogOut,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import logoDF from "@/assets/logo-df.png";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuthStore, validateStoredAccess } from "@/hooks/use-auth";
import { useAdminApprovals } from "@/hooks/use-admin-approvals";
import { DRIVE_PILOT_AUTH_ID, DRIVE_PILOT_EMAIL } from "@/lib/drive-pilot";

const PAGE_TITLES: Record<string, string> = {
  "/admin/dashboard": "Visão da operação",
  "/admin/equipe": "Equipe de projetos",
  "/admin/drive": "Google Drive — teste privado",
  "/admin/crm": "Pipeline comercial",
  "/admin/comissoes": "Comissões",
  "/projetista/dashboard": "Minha operação",
  "/projetista/meus-projetos": "Meus projetos",
  "/projetista/clientes": "Clientes e entradas",
  "/projetista/perfil": "Meu perfil",
  "/demandas": "Central de distribuição",
  "/agenda": "Agenda compartilhada",
  "/orcamento": "Calculadora de Orçamentos",
};

const adminLinks = [
  { title: "Visão geral", icon: LayoutDashboard, to: "/admin/dashboard" },
  { title: "Orçamento", icon: Calculator, to: "/orcamento" },
  { title: "Distribuição", icon: RouteIcon, to: "/demandas" },
  { title: "Clientes", icon: ContactRound, to: "/projetista/clientes" },
  { title: "Agenda da loja", icon: CalendarDays, to: "/agenda" },
  { title: "Equipe", icon: UsersRound, to: "/admin/equipe" },
  { title: "Pipeline", icon: BriefcaseBusiness, to: "/admin/crm" },
  { title: "Comissões", icon: CircleDollarSign, to: "/admin/comissoes" },
] as const;

const designerLinks = [
  { title: "Minha visão", icon: LayoutDashboard, to: "/projetista/dashboard" },
  { title: "Orçamento", icon: Calculator, to: "/orcamento" },
  { title: "Próximo da fila", icon: RouteIcon, to: "/demandas" },
  { title: "Meus projetos", icon: BriefcaseBusiness, to: "/projetista/meus-projetos" },
  { title: "Clientes", icon: ContactRound, to: "/projetista/clientes" },
  { title: "Agenda da loja", icon: CalendarDays, to: "/agenda" },
] as const;

export function DashboardLayout() {
  const { user, role, logout } = useAuthStore();
  const { items: approvalItems, pendingCount } = useAdminApprovals();
  const [approvalPopupOpen, setApprovalPopupOpen] = useState(false);
  const [drivePilotAllowed, setDrivePilotAllowed] = useState(false);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const links = role === "ADMIN" ? adminLinks : designerLinks;
  const pageTitle = PAGE_TITLES[pathname] ?? "DF Móveis";
  useEffect(() => {
    let live = true;
    setDrivePilotAllowed(false);
    if (role === 'ADMIN' && user?.email.toLowerCase() === DRIVE_PILOT_EMAIL) {
      void supabase.auth.getUser().then(async ({ data }) => {
        if (data.user?.id !== DRIVE_PILOT_AUTH_ID) return;
        const profile = await supabase.from('users').select('is_hidden,status,role').eq('auth_user_id', data.user.id).maybeSingle();
        if (live) setDrivePilotAllowed(profile.data?.is_hidden === true && profile.data.status === 'ATIVO' && profile.data.role === 'ADMIN');
      });
    }
    return () => { live = false; };
  }, [role, user?.id, user?.email]);
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());
  const approvalSignature = useMemo(
    () =>
      approvalItems
        .map((item) => item.id)
        .sort()
        .join(","),
    [approvalItems],
  );

  useEffect(() => {
    const defaultTitle = "DF Móveis Planejados";
    document.title =
      role === "ADMIN" && pendingCount > 0
        ? `(${pendingCount}) Aprovações | DF Móveis`
        : defaultTitle;

    return () => {
      document.title = defaultTitle;
    };
  }, [pendingCount, role]);

  useEffect(() => {
    if (role !== "ADMIN" || !user?.id) return;

    const storageKey = `df-admin-approval-popup:${user.id}`;

    if (pendingCount === 0) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // The notification still works when browser storage is unavailable.
      }
      return;
    }

    try {
      if (sessionStorage.getItem(storageKey) === approvalSignature) return;
      sessionStorage.setItem(storageKey, approvalSignature);
    } catch {
      // Show the popup without persistence when browser storage is unavailable.
    }

    if (pathname !== "/admin/equipe") setApprovalPopupOpen(true);
  }, [approvalSignature, pathname, pendingCount, role, user?.id]);

  useEffect(() => {
    let mounted = true;
    const verifyAccess = async () => {
      const access = await validateStoredAccess();
      if (!mounted || access.authorized) return;

      if (access.account && ["PENDING", "BLOCKED"].includes(access.reason)) {
        window.location.href = `/aguardando-aprovacao?email=${encodeURIComponent(access.account.email)}`;
        return;
      }
      window.location.href = "/";
    };

    const interval = window.setInterval(() => void verifyAccess(), 20_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    logout();
    try {
      localStorage.removeItem("df-auth-storage");
      if (user?.id) sessionStorage.removeItem(`df-admin-approval-popup:${user.id}`);
    } catch {
      // Storage may be unavailable in private browsing.
    }
    window.location.href = "/";
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-[#f5f4f0] text-slate-950">
        <Sidebar className="border-r-0 bg-[#17191d] text-white">
          <SidebarHeader className="border-b border-white/10 px-5 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f8f4e9] p-1.5 shadow-sm">
                <img src={logoDF} alt="DF Móveis" className="h-full w-full object-contain" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-wide">DF Móveis</p>
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#cbb27a]">
                  Central de projetos
                </p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-4">
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
                Operação
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {links.map((link) => {
                    const showsApprovalCount =
                      role === "ADMIN" && link.to === "/admin/equipe" && pendingCount > 0;

                    return (
                      <SidebarMenuItem key={link.to}>
                        <SidebarMenuButton
                          asChild
                          tooltip={link.title}
                          className="h-10 rounded-lg text-white/65 hover:bg-white/8 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white"
                          isActive={pathname === link.to}
                        >
                          <Link to={link.to} preload="intent" className="flex items-center gap-3">
                            <link.icon className="h-[18px] w-[18px]" />
                            <span className="font-medium">{link.title}</span>
                            {showsApprovalCount && (
                              <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-[#c92031] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white shadow-sm">
                                {pendingCount > 99 ? "99+" : pendingCount}
                              </span>
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                  {drivePilotAllowed && <SidebarMenuItem><SidebarMenuButton asChild isActive={pathname === '/admin/drive'} className="h-10 rounded-lg text-white/65 hover:text-white"><Link to="/admin/drive"><BriefcaseBusiness className="h-[18px] w-[18px]" /><span>Drive — teste privado</span></Link></SidebarMenuButton></SidebarMenuItem>}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {role === "ADMIN" && (
              <div className="mx-3 mt-5 rounded-xl border border-[#cbb27a]/20 bg-[#cbb27a]/8 p-3">
                <div className="flex items-center gap-2 text-[#dcc898]">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-xs font-semibold">Acesso de superusuário</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-4 text-white/45">
                  Você controla responsáveis, prazos e prioridades da equipe.
                </p>
              </div>
            )}
          </SidebarContent>

          <SidebarFooter className="border-t border-white/10 p-3">
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5">
              <UserAvatar
                src={user?.avatar_url}
                name={user?.nome}
                className="h-9 w-9 rounded-lg bg-[#c92031]"
                iconClassName="h-[18px] w-[18px]"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-white">{user?.nome}</p>
                <p className="truncate text-[10px] text-white/40">
                  {role === "ADMIN" ? "Superusuário" : "Projetista"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white/45 hover:bg-white/10 hover:text-white"
                onClick={signOut}
                aria-label="Sair do sistema"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[72px] items-center gap-4 border-b border-black/[0.06] bg-[#f5f4f0]/95 px-4 backdrop-blur md:px-7">
            <SidebarTrigger className="-ml-1" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-sm font-semibold text-slate-900 md:text-base">
                {pageTitle}
              </h1>
              <p className="hidden text-xs capitalize text-slate-500 sm:block">{today}</p>
            </div>
            {role === "ADMIN" && (
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-lg text-slate-600 hover:bg-white hover:text-slate-950"
              >
                <Link
                  to="/admin/equipe"
                  aria-label={
                    pendingCount > 0
                      ? `${pendingCount} aprovações pendentes`
                      : "Nenhuma aprovação pendente"
                  }
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {pendingCount > 0 && (
                    <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c92031] px-1 text-[9px] font-bold text-white ring-2 ring-[#f5f4f0]">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </Link>
              </Button>
            )}
            <Button
              asChild
              className="h-9 rounded-lg bg-[#c92031] px-3 text-xs text-white hover:bg-[#aa1726] md:px-4"
            >
              <Link to="/projetista/clientes">
                <Plus className="mr-1.5 h-4 w-4" />
                <span className="hidden sm:inline">Novo atendimento</span>
                <span className="sm:hidden">Novo</span>
              </Link>
            </Button>
          </header>
          <div className="mx-auto w-full max-w-[1600px] p-4 md:p-7 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>

      <Dialog open={approvalPopupOpen} onOpenChange={setApprovalPopupOpen}>
        <DialogContent className="overflow-hidden border-0 bg-white p-0 shadow-2xl sm:max-w-md">
          <div className="bg-gradient-to-br from-[#1c1e23] to-[#292c33] px-6 pb-6 pt-7 text-white">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#c92031] shadow-lg shadow-black/20">
              <UserRoundCheck className="h-6 w-6" />
            </div>
            <DialogHeader>
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#dcc898]">
                Central de pendências
              </p>
              <DialogTitle className="text-xl leading-tight text-white">
                {pendingCount === 1
                  ? "Novo cadastro aguardando sua aprovação"
                  : `${pendingCount} cadastros aguardando sua aprovação`}
              </DialogTitle>
              <DialogDescription className="pt-1 text-sm leading-5 text-white/60">
                Libere ou recuse o acesso antes que a projetista entre no painel.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="space-y-2 px-6 py-5">
            {approvalItems.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <UserAvatar
                  name={item.title}
                  className="h-9 w-9 rounded-lg bg-[#c92031]/10 text-[#c92031]"
                  iconClassName="h-[18px] w-[18px]"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="truncate text-xs text-slate-500">{item.description}</p>
                </div>
              </div>
            ))}
            {pendingCount > 3 && (
              <p className="px-1 pt-1 text-xs font-medium text-slate-500">
                E mais {pendingCount - 3} {pendingCount - 3 === 1 ? "cadastro" : "cadastros"}.
              </p>
            )}
          </div>

          <DialogFooter className="border-t border-slate-100 bg-slate-50 px-6 py-4 sm:justify-between">
            <Button
              variant="ghost"
              className="text-slate-500"
              onClick={() => setApprovalPopupOpen(false)}
            >
              Ver depois
            </Button>
            <Button
              asChild
              className="bg-[#c92031] text-white hover:bg-[#aa1726]"
              onClick={() => setApprovalPopupOpen(false)}
            >
              <Link to="/admin/equipe">
                Ver aprovações
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
