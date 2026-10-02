import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, RefreshCw, ShieldAlert } from "lucide-react";

import logoDf from "@/assets/logo-df.png";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/aguardando-aprovacao")({
  validateSearch: (search: Record<string, unknown>) => ({
    email: typeof search.email === "string" ? search.email : "",
  }),
  component: WaitingApprovalPage,
});

function WaitingApprovalPage() {
  const { email } = Route.useSearch();
  const normalizedEmail = email.trim().toLowerCase();

  const {
    data: account,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["pending-access", normalizedEmail],
    queryFn: async () => {
      const { data: identity } = await supabase.auth.getUser();
      if (!identity.user) return null;
      const { data, error } = await supabase
        .from("users")
        .select("id, nome, email, status")
        .eq("auth_user_id", identity.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(normalizedEmail),
    refetchInterval: (query) =>
      query.state.data?.status === "PENDENTE" || !query.state.data ? 5000 : false,
  });

  const status = account?.status ?? "PENDENTE";
  const isApproved = status === "ATIVO";
  const isBlocked = status === "BLOQUEADO";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f1eb] px-4 py-8">
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#cbb27a]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-[#c92031]/10 blur-3xl" />

      <main className="relative w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_30px_90px_-35px_rgba(25,28,33,.38)]">
        <div className="flex justify-center bg-[#191c21] px-6 py-5">
          <img src={logoDf} alt="DF Móveis" className="h-20 w-auto object-contain" />
        </div>

        <div className="px-6 py-9 text-center sm:px-12 sm:py-11">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
              isApproved
                ? "bg-emerald-50 text-emerald-600"
                : isBlocked
                  ? "bg-rose-50 text-rose-600"
                  : "bg-amber-50 text-amber-600"
            }`}
          >
            {isApproved ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : isBlocked ? (
              <ShieldAlert className="h-8 w-8" />
            ) : (
              <Clock3 className="h-8 w-8" />
            )}
          </div>

          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78948]">
            Acesso da equipe
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
            {isApproved
              ? "Acesso autorizado"
              : isBlocked
                ? "Acesso não autorizado"
                : "Aguardando autorização"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
            {isApproved
              ? "A administração liberou sua conta. Você já pode entrar no painel da DF Móveis."
              : isBlocked
                ? "A administração não liberou esta conta. Fale com o responsável pela loja para revisar o acesso."
                : "Seu cadastro foi recebido. O administrador precisa aprovar seu acesso antes que o painel de projetista seja liberado."}
          </p>

          {normalizedEmail && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Conta cadastrada
              </p>
              <p className="mt-1 break-all text-sm font-medium text-slate-700">
                {account?.email ?? normalizedEmail}
              </p>
            </div>
          )}

          {isApproved ? (
            <Button asChild className="mt-6 h-11 w-full bg-[#c92031] text-white hover:bg-[#aa1726]">
              <Link to="/">Entrar no sistema</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="mt-6 h-11 w-full border-slate-200"
              disabled={isLoading || isFetching || !normalizedEmail}
              onClick={() => refetch()}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              {isFetching ? "Verificando..." : "Verificar autorização agora"}
            </Button>
          )}

          <Link to="/" className="mt-5 inline-block text-xs text-slate-500 hover:text-slate-900">
            Voltar e usar outra conta
          </Link>

          {!isApproved && !isBlocked && (
            <p className="mt-7 text-[10px] uppercase tracking-[0.14em] text-slate-400">
              Esta tela atualiza automaticamente
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
