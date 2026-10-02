import { createFileRoute, redirect } from "@tanstack/react-router";
import { validateStoredAccess } from "@/hooks/use-auth";
import { useTeam, type MemberStatus } from "@/hooks/use-team";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Mail,
  User as UserIcon,
  Loader2,
  Check,
  Ban,
  Clock3,
  ShieldCheck,
  ShieldX,
  UserPlus,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useState } from "react";
import type { User } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_dashboard/admin/equipe")({
  beforeLoad: async () => {
    const access = await validateStoredAccess();
    const role = access.authorized ? access.account?.role : undefined;
    if (role !== "ADMIN") throw redirect({ to: "/projetista/dashboard" });
  },
  component: EquipePage,
});

const STATUS_META: Record<MemberStatus, { label: string; className: string }> = {
  PENDENTE: { label: "Pendente", className: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100" },
  ATIVO: { label: "Ativo", className: "bg-green-100 text-green-800 hover:bg-green-100" },
  BLOQUEADO: { label: "Bloqueado", className: "bg-red-100 text-red-800 hover:bg-red-100" },
};

interface MemberStats {
  totalVendido: number;
  projetosAtivos: number;
  totalLeads: number;
  taxaConversao: number;
}

const EMPTY_DESIGNER_FORM = {
  nome: "",
  email: "",
  password: "",
  adminPassword: "",
};

function EquipePage() {
  const { data: team, isLoading, updateStatus, deleteMember, createMember } = useTeam();
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_DESIGNER_FORM);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteAdminPassword, setDeleteAdminPassword] = useState("");

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteConfirmation("");
    setDeleteAdminPassword("");
  };

  const handleCreateMember = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createMember.mutateAsync(createForm);
      setCreateForm(EMPTY_DESIGNER_FORM);
      setShowNewPassword(false);
      setIsCreateOpen(false);
    } catch {
      // The mutation already displays a friendly error message.
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteTarget || deleteConfirmation !== "BLOQUEAR") return;
    try {
      await deleteMember.mutateAsync({
        id: deleteTarget.id,
        adminPassword: deleteAdminPassword,
      });
      closeDeleteDialog();
    } catch {
      // The mutation already displays a friendly error message.
    }
  };

  const handleShowStats = async (member: User) => {
    setSelectedMember(member);
    setIsStatsOpen(true);
    setLoadingStats(true);

    try {
      const { data: projects, error } = await supabase
        .from("projetos")
        .select("*")
        .eq("projetista_id", member.id);

      if (error) throw error;

      const totalVendido = projects
        .filter((p) => p.status_venda === "VENDEU")
        .reduce((acc, p) => acc + (Number(p.valor_venda) || 0), 0);

      const projetosAtivos = projects.filter((p) => p.status === "EM_EXECUCAO").length;
      const totalLeads = projects.length;
      const totalVendasCount = projects.filter((p) => p.status_venda === "VENDEU").length;
      const taxaConversao = totalLeads > 0 ? (totalVendasCount / totalLeads) * 100 : 0;

      setMemberStats({ totalVendido, projetosAtivos, totalLeads, taxaConversao });
    } catch (error) {
      console.error("Erro ao carregar stats do projetista:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const accessCounts = {
    pending: team?.filter((member) => member.status === "PENDENTE").length ?? 0,
    active: team?.filter((member) => member.status === "ATIVO").length ?? 0,
    blocked: team?.filter((member) => member.status === "BLOQUEADO").length ?? 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestão de Equipe</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione projetistas, aprove cadastros e gerencie todos os acessos.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
          Adicionar projetista
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "Aguardando aprovação",
            value: accessCounts.pending,
            icon: Clock3,
            style: "bg-amber-50 text-amber-700",
          },
          {
            label: "Acessos liberados",
            value: accessCounts.active,
            icon: ShieldCheck,
            style: "bg-emerald-50 text-emerald-700",
          },
          {
            label: "Acessos bloqueados",
            value: accessCounts.blocked,
            icon: ShieldX,
            style: "bg-rose-50 text-rose-700",
          },
        ].map((item) => (
          <Card key={item.label} className="workspace-card border-0 shadow-none">
            <CardContent className="flex items-center gap-4 p-4">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.style}`}
              >
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight text-slate-950">{item.value}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="h-32" />
              </Card>
            ))
          : team?.map((member) => {
              const status = (member.status as MemberStatus) || "PENDENTE";
              const meta = STATUS_META[status];
              return (
                <Card
                  key={member.id}
                  className={`overflow-hidden transition-colors hover:border-primary/50 ${
                    status === "PENDENTE" ? "border-amber-300 bg-amber-50/20" : ""
                  }`}
                >
                  <CardHeader className="flex flex-row items-center gap-4 pb-2">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                      <UserIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle
                          className="text-lg truncate cursor-pointer hover:text-primary"
                          onClick={() => handleShowStats(member)}
                        >
                          {member.nome}
                        </CardTitle>
                        <Badge className={meta.className} variant="secondary">
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground truncate">
                        <Mail className="mr-1 h-3 w-3" />
                        {member.email}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-2 mt-2 pt-4 border-t">
                      {status !== "ATIVO" && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          disabled={updateStatus.isPending}
                          onClick={() => updateStatus.mutate({ id: member.id, status: "ATIVO" })}
                        >
                          <Check className="mr-1 h-4 w-4" /> Aprovar Acesso
                        </Button>
                      )}
                      {status !== "BLOQUEADO" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({ id: member.id, status: "BLOQUEADO" })
                          }
                        >
                          <Ban className="mr-1 h-4 w-4" /> Bloquear Acesso
                        </Button>
                      )}
                      <div className="ml-auto">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          aria-label={`Excluir ${member.nome}`}
                          title="Bloquear acesso preservando histórico"
                          onClick={() => {
                            setDeleteConfirmation("");
                            setDeleteAdminPassword("");
                            setDeleteTarget(member);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <Dialog open={isStatsOpen} onOpenChange={setIsStatsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Desempenho: {selectedMember?.nome}</DialogTitle>
          </DialogHeader>
          {loadingStats ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando desempenho...</p>
            </div>
          ) : (
            <div className="grid gap-3 py-2 md:grid-cols-2">
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">
                    Total Vendido
                  </div>
                  <div className="text-2xl font-bold mt-1 text-primary">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      memberStats?.totalVendido || 0,
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">
                    Projetos Ativos
                  </div>
                  <div className="text-2xl font-bold mt-1 text-blue-600">
                    {memberStats?.projetosAtivos || 0} Projetos
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">
                    Taxa de Conversão
                  </div>
                  <div className="text-2xl font-bold mt-1 text-purple-600">
                    {memberStats?.taxaConversao.toFixed(1) || 0}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Baseado em {memberStats?.totalLeads || 0} leads
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/30 border-none">
                <CardContent className="pt-6">
                  <div className="text-sm font-medium text-muted-foreground uppercase">Acesso</div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">E-mail:</span>
                      <span className="font-medium">{selectedMember?.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-medium">
                        {STATUS_META[(selectedMember?.status as MemberStatus) || "PENDENTE"].label}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => setIsStatsOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setCreateForm(EMPTY_DESIGNER_FORM);
            setShowNewPassword(false);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleCreateMember} className="space-y-3">
            <DialogHeader>
              <DialogTitle>Adicionar projetista</DialogTitle>
              <DialogDescription>
                A conta será criada pelo administrador e já ficará com o acesso liberado.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor="designer-name">Nome completo</Label>
                <Input
                  id="designer-name"
                  value={createForm.nome}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, nome: event.target.value }))
                  }
                  placeholder="Nome da projetista"
                  required
                  minLength={2}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="designer-email">E-mail</Label>
                <Input
                  id="designer-email"
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="projetista@dfmoveis.com"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="designer-password">Senha inicial da projetista</Label>
                <div className="relative">
                  <Input
                    id="designer-password"
                    type={showNewPassword ? "text" : "password"}
                    value={createForm.password}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, password: event.target.value }))
                    }
                    className="pr-10"
                    autoComplete="new-password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    onClick={() => setShowNewPassword((current) => !current)}
                    aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Use pelo menos 6 caracteres.</p>
              </div>
              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <Label htmlFor="create-admin-password">Confirme sua senha de administrador</Label>
                <Input
                  id="create-admin-password"
                  type="password"
                  value={createForm.adminPassword}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      adminPassword: event.target.value,
                    }))
                  }
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMember.isPending}>
                {createMember.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Criar e liberar acesso
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteMember.isPending) {
            closeDeleteDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle>Bloquear acesso de {deleteTarget?.nome}?</DialogTitle>
            <DialogDescription>
              O acesso será bloqueado. O administrador poderá reativá-lo na lista da equipe.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-semibold">Projetos, clientes, comissões e documentos serão preservados.</p>
            <p className="mt-2">O bloqueio impede novas operações desta conta no sistema.</p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="delete-confirmation">
              Digite <strong>BLOQUEAR</strong> para confirmar
            </Label>
            <Input
              id="delete-confirmation"
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value.toUpperCase())}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="delete-admin-password">Senha do administrador</Label>
            <Input
              id="delete-admin-password"
              type="password"
              value={deleteAdminPassword}
              onChange={(event) => setDeleteAdminPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleteMember.isPending}
              onClick={closeDeleteDialog}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                deleteMember.isPending ||
                deleteConfirmation !== "BLOQUEAR" ||
                !deleteAdminPassword
              }
              onClick={handleDeleteMember}
            >
              {deleteMember.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Bloquear acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!isLoading && team?.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">Nenhum projetista cadastrado ainda.</p>
        </div>
      )}
    </div>
  );
}
