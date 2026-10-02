import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ensureAuthStoreHydrated, validateStoredAccess } from "@/hooks/use-auth";
import { BrandIntro } from "@/components/BrandIntro";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDf from "@/assets/logo-df.png";

function LoginLogo({ className }: { className: string }) {
  return (
    <span className={`relative inline-block [container-type:inline-size] ${className}`}>
      <img src={logoDf} alt="DF Móveis" className="h-auto w-full object-contain" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-[68%] flex h-[18%] items-center justify-center bg-[#191c21] text-[10cqw] font-light leading-none tracking-[0.035em] text-white"
      >
        DARIO FERNANDES
      </span>
    </span>
  );
}

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") {
      return;
    }

    await ensureAuthStoreHydrated();

    const access = await validateStoredAccess();
    if (access.authorized && access.account) {
      throw redirect({
        to: access.account.role === "ADMIN" ? "/admin/dashboard" : "/projetista/dashboard",
      });
    }

    if (access.account && ["PENDING", "BLOCKED"].includes(access.reason)) {
      throw redirect({
        to: "/aguardando-aprovacao",
        search: { email: access.account.email },
      });
    }
  },
  component: LoginPage,
});

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingLogin, setPendingLogin] = useState<{
    nome: string;
    destination: "/admin/dashboard" | "/projetista/dashboard";
  } | null>(null);
  const navigate = useNavigate();
  const finishLogin = useCallback(() => {
    if (!pendingLogin) return;
    toast.success(`Bem-vindo, ${pendingLogin.nome}!`);
    void navigate({ to: pendingLogin.destination });
  }, [navigate, pendingLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || pendingLogin) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw new Error("E-mail ou senha incorretos.");
      const access = await validateStoredAccess(true);
      if (access.account && ["PENDING", "BLOCKED"].includes(access.reason)) {
        navigate({ to: "/aguardando-aprovacao", search: { email: access.account.email } });
        return;
      }
      if (!access.authorized || !access.account)
        throw new Error("Não foi possível validar seu acesso. Tente novamente.");
      setPendingLogin({
        nome: access.account.nome,
        destination: access.account.role === "ADMIN" ? "/admin/dashboard" : "/projetista/dashboard",
      });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "tente novamente";
      const msg = "Erro ao conectar com o servidor: " + detail;
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {pendingLogin && <BrandIntro onComplete={finishLogin} />}
      <div
        inert={Boolean(pendingLogin)}
        className="relative min-h-screen overflow-y-auto bg-[#f4f1eb] px-4 py-6 sm:px-6 lg:flex lg:items-center lg:py-10"
      >
        <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#cbb27a]/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#c92031]/10 blur-3xl" />

        <div className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_-35px_rgba(25,28,33,.38)] lg:grid-cols-[1.05fr_.95fr]">
          <section className="relative hidden min-h-[650px] overflow-hidden bg-[#191c21] p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-[#c92031]/25 blur-3xl" />
            <div className="absolute -bottom-20 left-8 h-64 w-64 rounded-full bg-[#cbb27a]/15 blur-3xl" />
            <LoginLogo className="relative w-52" />
            <div className="relative max-w-md">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#d6c08d]">
                Gestão DF Móveis
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em]">
                Projetos organizados do primeiro contato à entrega.
              </h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-white/55">
                Clientes, prazos, projetistas e reuniões em um fluxo único para toda a loja.
              </p>
            </div>
            <p className="relative text-[10px] uppercase tracking-[0.18em] text-white/30">
              © {new Date().getFullYear()} DF Móveis Planejados
            </p>
          </section>

          <main className="flex min-h-[650px] items-center px-5 py-8 sm:px-10 lg:px-12">
            <div className="w-full">
              <div className="mb-8 flex justify-center rounded-2xl bg-[#191c21] p-4 lg:hidden">
                <LoginLogo className="w-40" />
              </div>
              <div className="mb-7">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78948]">
                  Área da equipe
                </p>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
                  Bem-vindo de volta
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Entre com os dados cadastrados para acessar sua área de trabalho.
                </p>
              </div>

              <Card className="w-full border-0 bg-transparent shadow-none">
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="exemplo@dfmoveis.com"
                        required
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errorMessage) setErrorMessage(null);
                        }}
                        className="h-11 border-slate-200 bg-slate-50/70"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Senha</Label>
                        <Button
                          variant="link"
                          type="button"
                          onClick={async () => {
                            if (!email.trim()) {
                              toast.info("Informe seu e-mail para recuperar a senha.");
                              return;
                            }
                            const { error } = await supabase.auth.resetPasswordForEmail(
                              email.trim().toLowerCase(),
                              { redirectTo: `${window.location.origin}/redefinir-senha` },
                            );
                            if (error) toast.error("Não foi possível solicitar a recuperação.");
                            else
                              toast.success(
                                "Se o e-mail estiver cadastrado, você receberá as instruções.",
                              );
                          }}
                          className="px-0 font-normal text-xs text-muted-foreground h-auto"
                        >
                          Esqueceu a senha?
                        </Button>
                      </div>
                      <div className="relative">
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (errorMessage) setErrorMessage(null);
                          }}
                          className="h-11 border-slate-200 bg-slate-50/70 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    {errorMessage && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{errorMessage}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-col gap-3">
                    <Button
                      type="submit"
                      className="h-11 w-full bg-[#c92031] text-white shadow-lg shadow-[#c92031]/15 hover:bg-[#aa1726]"
                      disabled={isLoading}
                    >
                      {isLoading ? "Entrando..." : "Acessar Sistema"}
                    </Button>
                    <Link
                      to="/cadastro"
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Ainda não tem conta? Cadastre-se
                    </Link>
                  </CardFooter>
                </form>
              </Card>
              <p className="mt-6 text-center text-[10px] uppercase tracking-[0.16em] text-slate-400 lg:hidden">
                © {new Date().getFullYear()} DF Móveis Planejados
              </p>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
