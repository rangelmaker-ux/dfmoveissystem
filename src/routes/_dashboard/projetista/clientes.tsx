import { openProjectFile } from '@/lib/project-files';
import { ClientCommercialDialog } from '@/components/orcamento/client-commercial-dialog';
import { createFileRoute } from "@tanstack/react-router";
import { useAuthStore } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  UserPlus,
  Star,
  Plus,
  Hand,
  X,
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FileText,
  Loader2,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ClientSpreadsheetImport } from "@/components/client-spreadsheet-import";
import {
  calculateThirtyDaysDeadline,
  INDETERMINATE_DEADLINE,
  formatDate,
  isIndeterminateDeadline,
} from "@/lib/project-utils";

export const Route = createFileRoute("/_dashboard/projetista/clientes")({
  component: ProjetistaClientesPage,
});

interface ClienteRow {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  created_at: string;
  projetista_id: string | null;
  projetista: { id: string; nome: string } | null;
  projetos: Array<{
    id: string;
    nome: string | null;
    prazo_termino: string;
    status: string;
    created_at: string | null;
    projetista_id: string | null;
  }>;
}

const FONTES = [
  { value: "ARQUITETO", label: "Arquiteto" },
  { value: "VENDA_DIRETA", label: "Venda Direta" },
  { value: "INDICACAO", label: "Indicação" },
];

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "erro desconhecido";
}

function projectObservations(observacoes: string, fonte: string, nomeArquiteto: string) {
  const notes = observacoes.trim();
  const architect = fonte === "ARQUITETO" ? nomeArquiteto.trim() : "";
  return [architect ? `Arquiteto: ${architect}` : "", notes].filter(Boolean).join("\n") || null;
}

interface ClientFileItem {
  id: string;
  name: string;
  created_at?: string;
  metadata?: { size?: number };
}

function ClientFilesDialog({
  client,
  open,
  onOpenChange,
  isAdmin,
  currentUserId,
}: {
  client: ClienteRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isAdmin: boolean;
  currentUserId?: string;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  // O projeto do cliente utilizado para armazenar os anexos
  const primaryProject = client?.projetos?.[0] ?? null;
  const projectId = primaryProject?.id;

  // Privacidade: apenas o responsável, sem projetista (aberto) ou administrador acessam
  const isMine = Boolean(client?.projetista_id && client.projetista_id === currentUserId);
  const isUnassigned = !client?.projetista_id;
  const canAccessFiles = isAdmin || isMine || Boolean(client?.projetos?.some(p => p.projetista_id === currentUserId));

  const { data: files = [], isLoading, refetch } = useQuery({
    queryKey: ["client-files", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.storage
        .from("projetos_arquivos")
        .list(projectId, { sortBy: { column: "created_at", order: "desc" } });
      if (error) {
        console.warn("[client-files] list error", error);
        throw error;
      }
      return (data ?? []) as ClientFileItem[];
    },
    enabled: Boolean(projectId && open && canAccessFiles),
  });

  const handleUpload = async (file: File) => {
    if (!client) return;
    if (!canAccessFiles) {
      toast.error("Você não tem permissão para anexar arquivos neste cliente.");
      return;
    }

    setUploading(true);
    try {
      let targetProjectId = projectId;

      if (!targetProjectId) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: newProj, error: pErr } = await supabase
          .from("projetos")
          .insert([
            {
              cliente_id: client.id,
              status: "PRONTO",
              status_venda: "EM_NEGOCIACAO",
              data_inicio: today,
              prazo_termino: INDETERMINATE_DEADLINE,
              nome: "Documentos e Arquivos",
            },
          ])
          .select("id")
          .single();
        if (pErr) throw pErr;
        targetProjectId = newProj.id;
        queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
      }

      const cleanName = file.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${targetProjectId}/${Date.now()}_${cleanName}`;

      const { error: uploadErr } = await supabase.storage
        .from("projetos_arquivos")
        .upload(storagePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      toast.success(`Arquivo "${file.name}" anexado com sucesso!`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await queryClient.invalidateQueries({ queryKey: ["client-files", targetProjectId] });
      await refetch();
    } catch (err: unknown) {
      console.error("[client-files] upload error", err);
      toast.error("Erro ao subir arquivo: " + errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!projectId) return;
    if (!canAccessFiles) {
      toast.error("Sem permissão para remover este arquivo.");
      return;
    }
    try {
      const { error } = await supabase.storage
        .from("projetos_arquivos")
        .remove([`${projectId}/${fileName}`]);
      if (error) throw error;
      toast.success("Arquivo excluído.");
      await queryClient.invalidateQueries({ queryKey: ["client-files", projectId] });
      await refetch();
    } catch (err: unknown) {
      toast.error("Erro ao remover arquivo: " + errorMessage(err));
    }
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-amber-600" />
            <DialogTitle>Arquivos do Cliente</DialogTitle>
          </div>
          <DialogDescription>
            {client?.nome} · Documentos, contratos, fotos, plantas e especificações
          </DialogDescription>
        </DialogHeader>

        {!canAccessFiles ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Este cliente está atribuído a outro projetista. Para preservar a privacidade da
              carteira, apenas o responsável ou o administrador podem visualizar e anexar arquivos.
            </span>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-xs font-semibold text-slate-700">Anexar novo arquivo</p>
                <p className="text-[11px] text-slate-500">PDF, Imagens, DWG, Contratos</p>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload(f);
                }}
              />
              <Button
                size="sm"
                className="bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-1.5 h-4 w-4" /> Subir Arquivo
                  </>
                )}
              </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {isLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : files.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-xs text-slate-500">
                  Nenhum arquivo anexado para este cliente ainda. Clique em "Subir Arquivo" acima.
                </div>
              ) : (
                files.map((file) => {
                  const displayName = file.name.replace(/^\d+_/, "");
                  return (
                    <div
                      key={file.id || file.name}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 hover:bg-white transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <FileText className="h-5 w-5 text-slate-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-800 truncate" title={displayName}>
                            {displayName}
                          </p>
                          {file.metadata?.size && (
                            <p className="text-[10px] text-slate-400">
                              {(file.metadata.size / 1024).toFixed(1)} KB
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-600" onClick={() => projectId && openProjectFile(projectId, file.name)}>
                            <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(file.name)}
                          title="Excluir arquivo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProjetistaClientesPage() {
  const [commercialClient, setCommercialClient] = useState<{ id: string; nome: string } | null>(null);
  const { user, role } = useAuthStore();
  const isAdmin = role === "ADMIN";
  const queryClient = useQueryClient();

  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [pendingClient, setPendingClient] = useState<{ id: string; nome: string } | null>(null);
  const [filesClient, setFilesClient] = useState<ClienteRow | null>(null);

  const [clientForm, setClientForm] = useState({
    nome: "",
    telefone: "",
    fonte: "",
    nome_arquiteto: "",
    rt_arquiteto: "",
    prazo_tipo: "30_DIAS" as "30_DIAS" | "INDETERMINADO",
  });

  const [projectForm, setProjectForm] = useState({
    nome: "",
    fonte: "",
    nome_arquiteto: "",
    rt_arquiteto: "",
    valor_venda: "",
    data_inicio: new Date().toISOString().slice(0, 10),
    prazo_termino: calculateThirtyDaysDeadline(),
    prazo_tipo: "30_DIAS" as "30_DIAS" | "INDETERMINADO",
    observacoes: "",
    projetista_id: "",
  });

  const { data: clientes, isLoading } = useQuery({
    queryKey: ["clientes-global"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select(
          "id, nome, email, telefone, endereco, created_at, projetista_id, projetista:projetista_id(id, nome), projetos(id, nome, prazo_termino, status, created_at, projetista_id)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ClienteRow[];
    },
  });

  const { data: projetistas } = useQuery({
    queryKey: ["projetistas-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, nome")
        .eq("role", "PROJETISTA")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("clientes-compartilhados")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "clientes" },
        () => queryClient.invalidateQueries({ queryKey: ["clientes-global"] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const createClient = useMutation({
    mutationFn: async (data: typeof clientForm) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const today = new Date().toISOString().slice(0, 10);
      const calculatedDeadline =
        data.prazo_tipo === "INDETERMINADO"
          ? INDETERMINATE_DEADLINE
          : calculateThirtyDaysDeadline();

      const initialProject: TablesInsert<"projetos"> = {
        cliente_id: '',
        projetista_id: null,
        status: "PRONTO" as const,
        status_venda: "EM_NEGOCIACAO" as const,
        data_inicio: today,
        prazo_termino: calculatedDeadline,
        nome: null,
        fonte: data.fonte,
        observacoes: projectObservations("", data.fonte, data.nome_arquiteto),
        rt_arquiteto:
          data.fonte === "ARQUITETO" && data.rt_arquiteto
            ? parseFloat(data.rt_arquiteto)
            : null,
      };
      const { data: inserted, error } = await supabase.rpc('create_client_with_project', {
        p_client: { nome: data.nome.trim(), telefone: data.telefone.trim(), projetista_id: isAdmin ? null : user.id },
        p_project: initialProject,
      });
      if (error) throw error;
      return inserted as { id: string; nome: string };
    },
    onSuccess: async () => {
      setClientForm({
        nome: "",
        telefone: "",
        fonte: "",
        nome_arquiteto: "",
        rt_arquiteto: "",
        prazo_tipo: "30_DIAS",
      });
      setIsClientDialogOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clientes-global"] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["distribution-projects"] }),
        queryClient.invalidateQueries({ queryKey: ["admin-operation"] }),
      ]);
      toast.success("Cliente adicionado com sucesso!");
    },
    onError: (e: unknown) => {
      console.error("[clientes] insert error", e);
      toast.error("Erro ao salvar cliente: " + errorMessage(e));
    },
  });

  const createProject = useMutation({
    mutationFn: async (data: typeof projectForm) => {
      if (!user?.id || !pendingClient) throw new Error("Cliente não selecionado.");
      const today = new Date().toISOString().slice(0, 10);
      const chosenDeadline =
        data.prazo_tipo === "INDETERMINADO"
          ? INDETERMINATE_DEADLINE
          : (data.prazo_termino || calculateThirtyDaysDeadline());

      const payload: TablesInsert<"projetos"> = {
        cliente_id: pendingClient.id,
        projetista_id: null,
        status: "PRONTO" as const,
        status_venda: "EM_NEGOCIACAO" as const,
        data_inicio: data.data_inicio || today,
        prazo_termino: chosenDeadline,
        valor_venda: data.valor_venda ? parseFloat(data.valor_venda) : null,
        observacoes: projectObservations(data.observacoes, data.fonte, data.nome_arquiteto),
        nome: data.nome.trim() || null,
        fonte: data.fonte || null,
        rt_arquiteto:
          data.fonte === "ARQUITETO"
            ? data.rt_arquiteto
              ? parseFloat(data.rt_arquiteto)
              : null
            : null,
      };
      console.log("[projetos] inserting", payload);
      const { error } = await supabase.from("projetos").insert([payload]);
      if (error) {
        console.error("[projetos] insert error", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-projects"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
      queryClient.invalidateQueries({ queryKey: ["admin-operation"] });
      toast.success("Projeto cadastrado e enviado ao superusuário para distribuição!");
      setProjectForm({
        nome: "",
        fonte: "",
        nome_arquiteto: "",
        rt_arquiteto: "",
        valor_venda: "",
        data_inicio: new Date().toISOString().slice(0, 10),
        prazo_termino: calculateThirtyDaysDeadline(),
        prazo_tipo: "30_DIAS",
        observacoes: "",
        projetista_id: "",
      });
      setPendingClient(null);
      setIsProjectDialogOpen(false);
    },
    onError: (e: unknown) => toast.error("Erro ao criar projeto: " + errorMessage(e)),
  });

  const assignProjetista = useMutation({
    mutationFn: async ({
      clienteId,
      projetistaId,
    }: {
      clienteId: string;
      projetistaId: string;
    }) => {
      const { error } = await supabase
        .from("clientes")
        .update({ projetista_id: projetistaId })
        .eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
      toast.success("Atendimento atualizado!");
    },
    onError: (e: unknown) => toast.error("Erro ao atribuir: " + errorMessage(e)),
  });

  const releaseAssignment = useMutation({
    mutationFn: async (clienteId: string) => {
      if (!isAdmin) throw new Error("Apenas administradores podem liberar atribuições.");
      const { error } = await supabase
        .from("clientes")
        .update({ projetista_id: null })
        .eq("id", clienteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
      toast.success("Atribuição liberada. Cliente em aberto novamente.");
    },
    onError: (e: unknown) => toast.error("Erro ao liberar: " + errorMessage(e)),
  });

  const handleSaveClient = () => {
    if (!clientForm.nome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    if (!clientForm.telefone.trim()) {
      toast.error("Informe o WhatsApp do cliente.");
      return;
    }
    if (!clientForm.fonte) {
      toast.error("Informe de onde veio o cliente.");
      return;
    }
    if (clientForm.fonte === "ARQUITETO" && !clientForm.nome_arquiteto.trim()) {
      toast.error("Informe o nome do arquiteto.");
      return;
    }
    if (!user?.id) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }
    createClient.mutate(clientForm);
  };

  const handleSaveProject = () => {
    if (!user?.id) {
      toast.error("Sessão inválida. Faça login novamente.");
      return;
    }
    if (!pendingClient) {
      toast.error("Selecione um cliente.");
      return;
    }
    createProject.mutate(projectForm);
  };

  const visibleClientes = clientes;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="workspace-eyebrow">Entrada da operação</p>
          <h1 className="workspace-title mt-2">Clientes e novos atendimentos</h1>
          <p className="mt-2 text-sm text-slate-500">
            Cadastre clientes e consulte a base compartilhada por toda a equipe. Os projetos
            continuam visíveis apenas para o profissional liberado pelo superusuário.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {user?.id && (
            <ClientSpreadsheetImport
              userId={user.id}
              onImported={() => {
                queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
                queryClient.invalidateQueries({ queryKey: ["projects"] });
              }}
            />
          )}
          <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Adicionar cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar cliente</DialogTitle>
                <DialogDescription>
                  Informe os dados básicos e de onde veio este cliente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="nome">
                    Nome Completo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="nome"
                    value={clientForm.nome}
                    onChange={(e) => setClientForm({ ...clientForm, nome: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="tel">
                    Telefone / WhatsApp <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="tel"
                    placeholder="(00) 00000-0000"
                    value={clientForm.telefone}
                    onChange={(e) => setClientForm({ ...clientForm, telefone: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Origem do cliente</Label>
                  <Select
                    value={clientForm.fonte}
                    onValueChange={(fonte) =>
                      setClientForm({
                        ...clientForm,
                        fonte,
                        nome_arquiteto: fonte === "ARQUITETO" ? clientForm.nome_arquiteto : "",
                        rt_arquiteto: fonte === "ARQUITETO" ? clientForm.rt_arquiteto : "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent>
                      {FONTES.map((fonte) => (
                        <SelectItem key={fonte.value} value={fonte.value}>
                          {fonte.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {clientForm.fonte === "ARQUITETO" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="client-architect">Nome do arquiteto</Label>
                      <Input
                        id="client-architect"
                        placeholder="Ex: João Silva"
                        value={clientForm.nome_arquiteto}
                        onChange={(e) =>
                          setClientForm({ ...clientForm, nome_arquiteto: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="client-commission">% de comissão</Label>
                      <Input
                        id="client-commission"
                        type="number"
                        min="0"
                        max="100"
                        placeholder="Ex: 10"
                        value={clientForm.rt_arquiteto}
                        onChange={(e) =>
                          setClientForm({ ...clientForm, rt_arquiteto: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
                <div className="grid gap-2 pt-1 border-t">
                  <Label>Duração / Validade do Atendimento</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={clientForm.prazo_tipo === "30_DIAS" ? "default" : "outline"}
                      className={cn(
                        "w-full font-semibold transition-all",
                        clientForm.prazo_tipo === "30_DIAS"
                          ? "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                          : "text-slate-700 hover:bg-slate-100",
                      )}
                      onClick={() => setClientForm({ ...clientForm, prazo_tipo: "30_DIAS" })}
                    >
                      30 dias
                    </Button>
                    <Button
                      type="button"
                      variant={clientForm.prazo_tipo === "INDETERMINADO" ? "default" : "outline"}
                      className={cn(
                        "w-full font-semibold transition-all",
                        clientForm.prazo_tipo === "INDETERMINADO"
                          ? "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                          : "text-slate-700 hover:bg-slate-100",
                      )}
                      onClick={() => setClientForm({ ...clientForm, prazo_tipo: "INDETERMINADO" })}
                    >
                      Indeterminado
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {clientForm.prazo_tipo === "30_DIAS"
                      ? `Prazo padrão de 30 dias (${formatDate(calculateThirtyDaysDeadline())}).`
                      : "Atendimento sem prazo rígido pré-fixado."}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSaveClient} disabled={createClient.isPending}>
                  {createClient.isPending ? "Salvando cliente..." : "Salvar cliente"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Project dialog opened from a client's row action. */}
      <Dialog
        open={isProjectDialogOpen}
        onOpenChange={(open) => {
          setIsProjectDialogOpen(open);
          if (!open) setPendingClient(null);
        }}
      >
        <DialogContent className="gap-3 p-4 sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Dados do Projeto</DialogTitle>
            <DialogDescription>
              {pendingClient ? `Cliente: ${pendingClient.nome}` : "Selecione um cliente."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="nome-projeto">Nome do Projeto</Label>
              <Input
                id="nome-projeto"
                placeholder="Ex: Cozinha Planejada"
                value={projectForm.nome}
                onChange={(e) => setProjectForm({ ...projectForm, nome: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Fonte</Label>
              <Select
                value={projectForm.fonte}
                onValueChange={(v) => setProjectForm({ ...projectForm, fonte: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Como chegou esse cliente? (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {FONTES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {projectForm.fonte === "ARQUITETO" && (
              <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="nome-arquiteto">Nome do Arquiteto / Parceiro</Label>
                  <Input
                    id="nome-arquiteto"
                    placeholder="Ex: João Silva"
                    value={projectForm.nome_arquiteto}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, nome_arquiteto: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rt-arquiteto">% RT / Comissão</Label>
                  <Input
                    id="rt-arquiteto"
                    type="number"
                    placeholder="Ex: 10"
                    value={projectForm.rt_arquiteto}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, rt_arquiteto: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="data-inicio">Data de início</Label>
                <Input
                  id="data-inicio"
                  type="date"
                  value={projectForm.data_inicio}
                  onChange={(e) => setProjectForm({ ...projectForm, data_inicio: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Prazo de término</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={projectForm.prazo_tipo === "30_DIAS" ? "default" : "outline"}
                    className={cn(
                      "w-full font-semibold transition-all",
                      projectForm.prazo_tipo === "30_DIAS"
                        ? "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                    onClick={() =>
                      setProjectForm({
                        ...projectForm,
                        prazo_tipo: "30_DIAS",
                        prazo_termino: calculateThirtyDaysDeadline(),
                      })
                    }
                  >
                    30 dias
                  </Button>
                  <Button
                    type="button"
                    variant={projectForm.prazo_tipo === "INDETERMINADO" ? "default" : "outline"}
                    className={cn(
                      "w-full font-semibold transition-all",
                      projectForm.prazo_tipo === "INDETERMINADO"
                        ? "bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                        : "text-slate-700 hover:bg-slate-100",
                    )}
                    onClick={() =>
                      setProjectForm({
                        ...projectForm,
                        prazo_tipo: "INDETERMINADO",
                        prazo_termino: INDETERMINATE_DEADLINE,
                      })
                    }
                  >
                    Indeterminado
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {projectForm.prazo_tipo === "30_DIAS"
                    ? `Previsão: 30 dias (${formatDate(projectForm.prazo_termino)}).`
                    : "Sem prazo fixo pré-definido."}
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="valor">Valor estimado (R$) — opcional</Label>
              <Input
                id="valor"
                type="number"
                value={projectForm.valor_venda}
                onChange={(e) => setProjectForm({ ...projectForm, valor_venda: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea
                id="obs"
                rows={2}
                value={projectForm.observacoes}
                onChange={(e) => setProjectForm({ ...projectForm, observacoes: e.target.value })}
              />
            </div>
            {!isAdmin && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 sm:col-span-2">
                Após o cadastro, o superusuário escolherá a projetista e confirmará o prazo.
              </div>
            )}
          </div>
          <DialogFooter className="sticky -bottom-4 z-10 -mx-4 border-t bg-background px-4 pb-0 pt-3">
            <Button onClick={handleSaveProject} disabled={createProject.isPending}>
              {createProject.isPending ? "Salvando atendimento..." : "Salvar atendimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="workspace-card border-0 shadow-none">
        <CardHeader>
          <CardTitle>Base compartilhada de clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cadastro</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Projeto e prazo</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={7} className="h-12 bg-muted/20" />
                  </TableRow>
                ))
              ) : visibleClientes && visibleClientes.length > 0 ? (
                visibleClientes.map((c) => {
                  const isMine = c.projetista?.id && c.projetista.id === user?.id;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>
                        <div className="flex flex-col text-xs text-muted-foreground">
                          <span>{c.telefone || "-"}</span>
                          <span>{c.email || "-"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                        {c.endereco || "-"}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const allowedProjects = isAdmin
                            ? c.projetos ?? []
                            : (c.projetos ?? []).filter(
                                (project) => project.projetista_id === user?.id,
                              );
                          const latestProject = [...allowedProjects].sort(
                            (first, second) =>
                              new Date(second.created_at ?? 0).getTime() -
                              new Date(first.created_at ?? 0).getTime(),
                          )[0];
                          if (!latestProject) {
                            return (
                              <span className="text-xs text-slate-400">
                                {isAdmin ? "Sem projeto" : "Nenhum projeto liberado para você"}
                              </span>
                            );
                          }
                          const statusLabels: Record<string, string> = {
                            PRONTO: "Pronto",
                            EM_EXECUCAO: "Em execução",
                            PAUSADO: "Pausado",
                            ATRASADO: "Atrasado",
                            FINALIZADO: "Finalizado",
                            EM_ACOMPANHAMENTO: "Em acompanhamento",
                          };
                          return (
                            <div className="min-w-[150px]">
                              <p className="text-sm font-medium text-slate-800">
                                {latestProject.nome || "Projeto sem nome"}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                Prazo: {formatDate(latestProject.prazo_termino)}
                              </p>
                              <Badge variant="outline" className="mt-1 text-[10px]">
                                {statusLabels[latestProject.status] ?? latestProject.status}
                              </Badge>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const assigned = !!c.projetista_id;

                          // Caso 1: Cliente em aberto (sem projetista)
                          if (!assigned) {
                            if (isAdmin) {
                              // Admin pode atribuir qualquer projetista
                              return (
                                <Select
                                  value=""
                                  onValueChange={(v) =>
                                    assignProjetista.mutate({ clienteId: c.id, projetistaId: v })
                                  }
                                  disabled={assignProjetista.isPending}
                                >
                                  <SelectTrigger className="h-8 w-[200px]">
                                    <SelectValue placeholder="Em aberto — atribuir" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {projetistas?.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              );
                            }
                            // Projetista: cliente sem dono — apenas indicador
                            return (
                              <Badge variant="outline" className="h-8 px-3 text-muted-foreground">
                                Em aberto
                              </Badge>
                            );
                          }

                          // Caso 2: Cliente já atribuído
                          const badge = (
                            <Badge
                              className={cn(
                                "gap-1",
                                isMine
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                                  : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100",
                              )}
                            >
                              {isMine && <Star className="h-3 w-3 fill-current" />}
                              {isMine ? `Eu (${c.projetista?.nome})` : c.projetista?.nome}
                            </Badge>
                          );

                          if (!isAdmin) {
                            // Projetista NÃO pode alterar — só visualiza
                            return badge;
                          }

                          // Admin: badge + transferir + liberar
                          return (
                            <div className="flex items-center gap-2">
                              {badge}
                              <Select
                                value={c.projetista_id ?? ""}
                                onValueChange={(v) =>
                                  assignProjetista.mutate({ clienteId: c.id, projetistaId: v })
                                }
                                disabled={assignProjetista.isPending}
                              >
                                <SelectTrigger className="h-7 w-[150px] text-xs">
                                  <SelectValue placeholder="Transferir" />
                                </SelectTrigger>
                                <SelectContent>
                                  {projetistas
                                    ?.filter((p) => p.id !== c.projetista_id)
                                    .map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.nome}
                                      </SelectItem>
                                    ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2"
                                onClick={() => releaseAssignment.mutate(c.id)}
                                disabled={releaseAssignment.isPending}
                                title="Liberar atribuição"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setCommercialClient({ id: c.id, nome: c.nome })}>Orçamentos / Contratos</Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-slate-200 hover:bg-slate-100 text-xs"
                            onClick={() => setFilesClient(c)}
                            title="Arquivos e documentos deste cliente"
                          >
                            <FolderOpen className="h-3.5 w-3.5 mr-1 text-amber-600" />
                            Arquivos
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => {
                              setPendingClient({ id: c.id, nome: c.nome });
                              setIsProjectDialogOpen(true);
                            }}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Novo Projeto
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente cadastrado ainda.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ClientCommercialDialog key={commercialClient?.id || "closed"} client={commercialClient} onClose={() => setCommercialClient(null)} />
      <ClientFilesDialog
        client={filesClient}
        open={Boolean(filesClient)}
        onOpenChange={(open) => !open && setFilesClient(null)}
        isAdmin={isAdmin}
        currentUserId={user?.id}
      />
    </div>
  );
}
