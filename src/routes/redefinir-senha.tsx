import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
export const Route = createFileRoute("/redefinir-senha")({ component: ResetPassword });
function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <main className="max-w-md mx-auto mt-20 rounded-xl border p-6 space-y-4">
      <h1 className="text-xl font-semibold">Redefinir senha</h1>
      {done ? (
        <>
          <p>Senha atualizada.</p>
          <Button asChild>
            <Link to="/">Entrar no sistema</Link>
          </Button>
        </>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (password.length < 6 || password !== confirmation) {
              toast.error("As senhas devem ser iguais e ter pelo menos 6 caracteres.");
              return;
            }
            setSaving(true);
            try {
              const { data, error: sessionError } = await supabase.auth.getUser();
              if (sessionError || !data.user)
                throw new Error("Link inválido ou expirado. Solicite uma nova recuperação.");
              const { error } = await supabase.auth.updateUser({ password });
              if (error) throw error;
              await supabase.auth.signOut();
              setDone(true);
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setSaving(false);
            }
          }}
        >
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Nova senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Input
            type="password"
            autoComplete="new-password"
            required
            minLength={6}
            placeholder="Confirme a nova senha"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          <Button disabled={saving}>Salvar senha</Button>
        </form>
      )}
    </main>
  );
}
