/** Run once after the SQL migration, with server-side credentials. Never expose this key in VITE_* variables. */
import { createClient } from "@supabase/supabase-js";
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente de execução.");
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { data: profiles, error } = await admin
  .from("users")
  .select("id,nome,email,password,auth_user_id");
if (error) throw error;
let failures = 0;
for (const profile of profiles) {
  if (profile.auth_user_id) continue;
  if (!profile.password) {
    console.error(
      `Perfil ${profile.id}: sem credencial legada; precisa de recuperação administrativa.`,
    );
    failures++;
    continue;
  }
  const { error: creationError } = await admin.auth.admin.createUser({
    email: profile.email,
    password: profile.password,
    email_confirm: true,
    user_metadata: { nome: profile.nome },
    app_metadata: { legacy_profile_id: profile.id },
  });
  if (creationError) {
    console.error(
      `Perfil ${profile.id}: migração não concluída (${creationError.code || "erro do Auth"}).`,
    );
    failures++;
  } else console.log(`Perfil ${profile.id}: migrado mantendo o ID e as permissões.`);
}
if (failures) process.exitCode = 1;
