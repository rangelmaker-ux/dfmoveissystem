import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@/types/database";
import { toast } from "sonner";
import { useAuthStore } from "@/hooks/use-auth";
import { ADMIN_APPROVALS_QUERY_KEY } from "@/hooks/use-admin-approvals";

export type MemberStatus = "PENDENTE" | "ATIVO" | "BLOQUEADO";

export interface CreateDesignerInput {
  nome: string;
  email: string;
  password: string;
  adminPassword: string;
}

export interface DeleteDesignerInput {
  id: string;
  adminPassword: string;
}

export function useTeam() {
  const queryClient = useQueryClient();
  const administrator = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, nome, email, role, status, avatar_url, created_at")
        .eq("role", "PROJETISTA")
        .order("status", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as unknown as User[];
    },
    refetchInterval: 15_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MemberStatus }) => {
      if (!administrator?.id || administrator.role !== "ADMIN") {
        throw new Error("Somente o superusuário pode alterar acessos.");
      }

      const { error } = await supabase
        .from("users")
        .update({ status })
        .eq("id", id)
        .eq("role", "PROJETISTA");
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ADMIN_APPROVALS_QUERY_KEY });
      const label =
        vars.status === "ATIVO"
          ? "aprovado"
          : vars.status === "BLOQUEADO"
            ? "bloqueado"
            : "atualizado";
      toast.success(`Projetista ${label} com sucesso!`);
    },
    onError: (error: Error) => toast.error("Erro ao atualizar status: " + error.message),
  });

  const deleteMember = useMutation({
    mutationFn: async ({ id, adminPassword }: DeleteDesignerInput) => {
      if (!administrator?.id || administrator.role !== "ADMIN") {
        throw new Error("Somente o superusuário pode remover usuários.");
      }

      const { data, error } = await supabase.functions.invoke("team-auth", {
        body: { action: "archive", id, adminPassword },
      });
      if (data?.error) throw new Error(data.error);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ADMIN_APPROVALS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-global"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-agenda"] });
      queryClient.invalidateQueries({ queryKey: ["agendamentos"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-projects"] });
      toast.success("Acesso da projetista bloqueado; projetos e histórico preservados.");
    },
    onError: (error: Error) => toast.error("Erro ao remover usuário: " + error.message),
  });

  const createMember = useMutation({
    mutationFn: async ({ nome, email, password, adminPassword }: CreateDesignerInput) => {
      if (!administrator?.id || administrator.role !== "ADMIN") {
        throw new Error("Somente o superusuário pode adicionar projetistas.");
      }

      const { data, error } = await supabase.functions.invoke("team-auth", {
        body: { action: "create", nome, email, password, adminPassword },
      });
      if (data?.error) throw new Error(data.error);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ADMIN_APPROVALS_QUERY_KEY });
      toast.success("Projetista adicionada com acesso liberado!");
    },
    onError: (error: Error) => toast.error("Erro ao adicionar projetista: " + error.message),
  });

  return { ...query, updateStatus, deleteMember, createMember };
}
