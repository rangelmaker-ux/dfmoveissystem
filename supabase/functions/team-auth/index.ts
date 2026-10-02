import { createClient } from 'npm:@supabase/supabase-js@2.105.4';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (request.method !== 'POST') return respond({ error: 'Método inválido.' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
    const { data: identity, error: identityError } = await admin.auth.getUser(token);
    if (identityError || !identity.user) return respond({ error: 'Sessão inválida.' }, 401);
    const { data: actor, error: actorError } = await admin.from('users').select('id,email,role,status').eq('auth_user_id', identity.user.id).single();
    if (actorError || actor.role !== 'ADMIN' || actor.status !== 'ATIVO') return respond({ error: 'Somente o administrador pode gerenciar acessos.' }, 403);
    const input = await request.json();
    // Reauthenticate destructive/privileged actions without replacing the administrator's browser session.
    const verifier = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: verification, error: verifyError } = await verifier.auth.signInWithPassword({ email: actor.email, password: input.adminPassword || '' });
    if (verifyError || verification.user?.id !== identity.user.id) return respond({ error: 'Senha do administrador incorreta.' }, 403);
    await verifier.auth.signOut();
    if (input.action === 'create') {
      const nome = String(input.nome || '').trim();
      const email = String(input.email || '').trim().toLowerCase();
      if (nome.length < 2 || !email.includes('@') || String(input.password || '').length < 6) return respond({ error: 'Informe nome, e-mail e senha válidos.' }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({ email, password: input.password, email_confirm: true, user_metadata: { nome } });
      if (error) return respond({ error: 'Não foi possível criar a conta. Verifique o e-mail e tente novamente.' }, 400);
      const { data: approved, error: approvalError } = await admin.from('users').update({ status: 'ATIVO', approved_by: actor.id, approved_at: new Date().toISOString() }).eq('auth_user_id', created.user.id).select('id').single();
      if (approvalError || !approved) {
        // Keep account pending; do not erase a profile through cascading FKs.
        return respond({ error: 'Conta criada como pendente. Aprove o acesso na lista da equipe.' }, 409);
      }
      return respond({ id: approved.id });
    }
    if (input.action === 'archive') {
      const { data: target, error } = await admin.from('users').select('id,role,auth_user_id').eq('id', input.id).single();
      if (error || target.role !== 'PROJETISTA') return respond({ error: 'Projetista não encontrado.' }, 404);
      const { error: blockError } = await admin.from('users').update({ status: 'BLOQUEADO' }).eq('id', target.id);
      if (blockError) throw blockError;
      // Blocking the profile is enforced by RLS immediately. Preserve projects and financial history.
      return respond({ id: target.id, archived: true });
    }
    return respond({ error: 'Ação inválida.' }, 400);
  } catch {
    return respond({ error: 'Não foi possível concluir a operação.' }, 500);
  }
});
