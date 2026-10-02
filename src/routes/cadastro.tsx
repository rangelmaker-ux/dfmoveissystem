import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logoDf from "@/assets/logo-df.png";

export const Route = createFileRoute("/cadastro")({
  component: CadastroPage,
});

function CadastroPage() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail, password,
        options: { data: { nome: nome.trim() } },
      });

      if (error) throw error;

      toast.success("Cadastro realizado! Aguarde a aprovação do Administrador para acessar.");
      navigate({
        to: "/aguardando-aprovacao",
        search: { email: normalizedEmail },
      });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "tente novamente";
      const msg = detail.includes("duplicate")
        ? "Este e-mail já está cadastrado."
        : "Erro ao cadastrar: " + detail;
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-y-auto bg-[#f4f1eb] px-4 py-6 sm:px-6 lg:flex lg:items-center lg:py-10">
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-[#cbb27a]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-[#c92031]/10 blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_-35px_rgba(25,28,33,.38)] lg:grid-cols-[.9fr_1.1fr]">
        <section className="relative hidden min-h-[680px] overflow-hidden bg-[#191c21] p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute -right-24 -top-20 h-72 w-72 rounded-full bg-[#c92031]/25 blur-3xl" />
          <img src={logoDf} alt="DF Móveis" className="relative w-52 object-contain" />
          <div className="relative">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d6c08d]">
              Entrada da equipe
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.04em]">
              Sua conta começa com a aprovação da administração.
            </h1>
            <div className="mt-7 space-y-4 text-sm text-white/60">
              {[
                "Cadastre seus dados como projetista",
                "Aguarde a análise do administrador",
                "Receba acesso somente após a liberação",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#d6c08d]" /> {item}
                </div>
              ))}
            </div>
          </div>
          <p className="relative text-[10px] uppercase tracking-[0.18em] text-white/30">
            © {new Date().getFullYear()} DF Móveis Planejados
          </p>
        </section>

        <main className="flex min-h-[680px] items-center px-5 py-8 sm:px-10 lg:px-14">
          <div className="w-full">
            <div className="mb-7 flex justify-center rounded-2xl bg-[#191c21] p-4 lg:hidden">
              <img src={logoDf} alt="DF Móveis" className="w-40 object-contain" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#a78948]">
              Novo cadastro
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-slate-950">
              Cadastro de projetista
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Preencha seus dados. O painel só será liberado depois da aprovação do administrador.
            </p>

            <Card className="mt-6 border-0 bg-transparent shadow-none">
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome Completo</Label>
                    <Input
                      id="nome"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Seu nome"
                      className="h-11 border-slate-200 bg-slate-50/70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="exemplo@dfmoveis.com"
                      className="h-11 border-slate-200 bg-slate-50/70"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-11 border-slate-200 bg-slate-50/70 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
                    {isLoading ? "Cadastrando..." : "Cadastrar"}
                  </Button>
                  <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
                    Já tem conta? Faça login
                  </Link>
                </CardFooter>
              </form>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
