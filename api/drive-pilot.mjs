import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { PILOT_AUTH_ID, PILOT_EMAIL, DRIVE_SCOPE, pilotAllowed, seal, unseal, validState, verifiedFile } from '../server/drive-security.mjs';
import { describeDriveError } from '../server/drive-errors.mjs';

const API = 'https://www.googleapis.com/drive/v3';
const COOKIE = 'df_drive_oauth';
const fileFields = 'id,name,size,mimeType,md5Checksum,trashed,parents,appProperties,webViewLink';
class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function check(result) {
  if (result.error) throw new ApiError('Não foi possível registrar os dados do teste. Tente novamente.', 503);
  return result.data;
}
function configuration() {
  const names = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'DRIVE_ENCRYPTION_KEY', 'DRIVE_APP_ORIGIN'];
  const missing = names.filter(name => !process.env[name]);
  if (missing.length) throw new ApiError(`Configuração pendente: ${missing.join(', ')}.`, 503);
  const origin = new URL(process.env.DRIVE_APP_ORIGIN).origin;
  if (!origin.startsWith('https://') && !origin.startsWith('http://localhost:')) throw new ApiError('Origem do teste inválida.', 503);
  return { origin, callback: `${origin}/api/drive-pilot?action=callback`, key: process.env.DRIVE_ENCRYPTION_KEY };
}
function database() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new ApiError('Configure o acesso do servidor ao Supabase.', 503);
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function actorFor(db, token) {
  if (!token) throw new ApiError('Entre novamente no sistema.', 401);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ApiError('Sessão inválida.', 401);
  await requirePilot(db, data.user);
  return data.user;
}
async function requirePilot(db, identity) {
  const { data: actor, error } = await db.from('users').select('auth_user_id,email,role,status,is_hidden').eq('auth_user_id', identity.id).maybeSingle();
  if (error || !pilotAllowed(identity, actor)) throw new ApiError('Teste disponível somente para o administrador oculto autorizado.', 403);
}
async function googleToken(params) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID, client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET, ...params }),
  });
  if (!response.ok) throw new ApiError('A conexão do Google expirou ou foi revogada. Conecte o Drive novamente.', 409);
  return response.json();
}
async function drive(token, path, options = {}) {
  const response = await fetch(`${API}/${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(describeDriveError(response.status, body), 502);
  }
  return response.json();
}
async function folder(token, owner, parent, name, marker) {
  // Only folders created by this app are discoverable with drive.file.
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and appProperties has { key='pilotOwner' and value='${owner}' } and appProperties has { key='folderKey' and value='${marker}' }${parent ? ` and '${parent}' in parents` : ''}`;
  const found = await drive(token, `files?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '10' })}`);
  if (found.files[0]) return found.files[0].id;
  const created = await drive(token, 'files?fields=id', { method: 'POST', body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parent ? { parents: [parent] } : {}), appProperties: { pilotOwner: owner, folderKey: marker } }) });
  return created.id;
}
async function connectionFor(db, owner, config) {
  const connection = check(await db.from('drive_pilot_connections').select('*').eq('owner_auth_id', owner).maybeSingle());
  if (!connection) throw new ApiError('Conecte seu Google Drive primeiro.', 409);
  const secret = unseal(connection.encrypted_refresh_token, config.key);
  const tokens = await googleToken({ grant_type: 'refresh_token', refresh_token: secret.refresh_token });
  // Fail closed when the selected Google account is no longer the pilot owner.
  const profile = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const info = profile.ok ? await profile.json() : null;
  if (!info?.email_verified || info.email?.toLowerCase() !== PILOT_EMAIL) throw new ApiError('Conecte o Google Drive de rangelmaker@gmail.com.', 403);
  return { connection, token: tokens.access_token };
}
async function callback(req, res, db, config, url) {
  const nonce = String(req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/api/drive-pilot; Max-Age=0`);
  let state;
  try { state = unseal(url.searchParams.get('state') || '', config.key); } catch { throw new ApiError('Autorização inválida. Reinicie a conexão.', 403); }
  if (!validState(state, nonce)) throw new ApiError('Autorização expirada. Reinicie a conexão.', 403);
  if (url.searchParams.has('error')) throw new ApiError('Você cancelou a conexão com o Google.');
  const { data, error } = await db.auth.admin.getUserById(state.owner);
  if (error || !data.user) throw new ApiError('Conta indisponível.', 403);
  await requirePilot(db, data.user);
  const tokens = await googleToken({ grant_type: 'authorization_code', code: url.searchParams.get('code') || '', redirect_uri: config.callback, code_verifier: state.verifier });
  if (!String(tokens.scope || '').split(' ').includes(DRIVE_SCOPE)) throw new ApiError('Autorize o acesso aos arquivos criados pelo sistema.');
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const info = response.ok ? await response.json() : null;
  if (!info?.email_verified || info.email?.toLowerCase() !== PILOT_EMAIL) throw new ApiError('Selecione a conta Google rangelmaker@gmail.com.', 403);
  if (!tokens.refresh_token) throw new ApiError('Autorize novamente para permitir a conexão persistente.');
  const root = await folder(tokens.access_token, state.owner, null, 'DF Móveis — Teste Rangel Maker', 'root');
  const old = check(await db.from('drive_pilot_connections').select('root_folder_id').eq('owner_auth_id', state.owner).maybeSingle());
  if (old && old.root_folder_id !== root) throw new ApiError('A pasta anterior não está acessível. Restaure o acesso antes de reconectar.', 409);
  check(await db.from('drive_pilot_connections').upsert({ owner_auth_id: state.owner, google_email: info.email, root_folder_id: root, encrypted_refresh_token: seal({ refresh_token: tokens.refresh_token }, config.key), updated_at: new Date().toISOString() }));
  res.statusCode = 303;
  res.setHeader('Location', `${config.origin}/admin/drive`);
  res.end();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  try {
    const url = new URL(req.url, 'http://localhost');
    const action = url.searchParams.get('action') || 'status';
    const db = database();
    if (action === 'callback') {
      if (req.method !== 'GET') throw new ApiError('Método inválido.', 405);
      return await callback(req, res, db, configuration(), url);
    }
    const identity = await actorFor(db, String(req.headers.authorization || '').replace(/^Bearer /, ''));
    if (action === 'status' && req.method === 'GET') {
      const missing = ['GOOGLE_DRIVE_CLIENT_ID', 'GOOGLE_DRIVE_CLIENT_SECRET', 'DRIVE_ENCRYPTION_KEY', 'DRIVE_APP_ORIGIN'].filter(name => !process.env[name]);
      if (missing.length) return res.status(200).json({ configured: false, connected: false, missing });
      const connection = check(await db.from('drive_pilot_connections').select('google_email,root_folder_id').eq('owner_auth_id', identity.id).maybeSingle());
      return res.status(200).json({ configured: true, connected: !!connection, email: connection?.google_email, folderId: connection?.root_folder_id });
    }
    if (req.method !== 'POST') throw new ApiError('Método inválido.', 405);
    const config = configuration();
    if (req.headers.origin !== config.origin) throw new ApiError('Origem não autorizada.', 403);
    const input = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (action === 'connect') {
      const nonce = randomBytes(32).toString('base64url');
      const verifier = randomBytes(32).toString('base64url');
      const state = seal({ owner: identity.id, nonce, verifier, expires: Date.now() + 600000 }, config.key);
      res.setHeader('Set-Cookie', `${COOKIE}=${nonce}; HttpOnly; ${config.origin.startsWith('https:') ? 'Secure; ' : ''}SameSite=Lax; Path=/api/drive-pilot; Max-Age=600`);
      const params = new URLSearchParams({ client_id: process.env.GOOGLE_DRIVE_CLIENT_ID, redirect_uri: config.callback, response_type: 'code', access_type: 'offline', prompt: 'consent', login_hint: PILOT_EMAIL, scope: `openid email ${DRIVE_SCOPE}`, state, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' });
      return res.status(200).json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }
    const { connection, token } = await connectionFor(db, identity.id, config);
    if (action === 'list') {
      const files = check(await db.from('drive_pilot_files').select('id,project_id,name,size_bytes,state,source_path,created_at').eq('owner_auth_id', identity.id).eq('project_id', input.projectId).order('created_at', { ascending: false }));
      return res.status(200).json({ files });
    }
    if (action === 'prepare') {
      if (!/^[\da-f-]{36}$/i.test(input.projectId || '')) throw new ApiError('Selecione um projeto válido.');
      const project = check(await db.from('projetos').select('id,nome,cliente_id').eq('id', input.projectId).maybeSingle());
      if (!project) throw new ApiError('Projeto não encontrado.', 404);
      const client = check(await db.from('clientes').select('id,nome').eq('id', project.cliente_id).maybeSingle());
      if (!client) throw new ApiError('Cliente não encontrado.', 404);
      const name = String(input.name || '').trim();
      if (!name || name.length > 255 || /[\x00-\x1f]/.test(name)) throw new ApiError('Nome de arquivo inválido.');
      const size = Number(input.size);
      if (!Number.isSafeInteger(size) || size <= 0 || size > 100 * 1024 * 1024) throw new ApiError('Neste teste, envie arquivos de até 100 MB.');
      const sourcePath = input.sourcePath || null;
      if (sourcePath && (typeof sourcePath !== 'string' || !sourcePath.startsWith(`${project.id}/`) || sourcePath.split('/').length !== 2)) throw new ApiError('Arquivo de origem inválido.');
      const clientFolder = await folder(token, identity.id, connection.root_folder_id, `${client.nome} — ${client.id.slice(0, 8)}`, `client:${client.id}`);
      const projectFolder = await folder(token, identity.id, clientFolder, `${project.nome} — ${project.id.slice(0, 8)}`, `project:${project.id}`);
      // A generated Drive ID is stored BEFORE transfer. Retrying a source copy cannot overwrite the original or create a second record.
      let record = sourcePath ? check(await db.from('drive_pilot_files').select('*').eq('owner_auth_id', identity.id).eq('source_path', sourcePath).maybeSingle()) : null;
      if (record?.state === 'ready') return res.status(200).json({ completed: true });
      if (record && (Number(record.size_bytes) !== size || record.name !== name)) throw new ApiError('A origem mudou desde a tentativa anterior. Preserve as duas versões e revise o arquivo.', 409);
      if (!record) {
        const generated = await drive(token, 'files/generateIds?count=1&space=drive&type=files');
        const value = { id: randomUUID(), owner_auth_id: identity.id, project_id: project.id, name, size_bytes: size, source_path: sourcePath, drive_file_id: generated.ids[0], folder_id: projectFolder, state: 'pending' };
        const insert = await db.from('drive_pilot_files').insert(value).select('*').single();
        if (insert.error?.code === '23505' && sourcePath) record = check(await db.from('drive_pilot_files').select('*').eq('owner_auth_id', identity.id).eq('source_path', sourcePath).single());
        else record = check(insert);
      }
      const existing = await fetch(`${API}/files/${record.drive_file_id}?fields=${fileFields}`, { headers: { Authorization: `Bearer ${token}` } });
      if (existing.ok) {
        const remote = await existing.json();
        if (!verifiedFile(remote, record)) throw new ApiError('A cópia no Drive não corresponde ao registro. O original foi preservado.', 409);
        check(await db.from('drive_pilot_files').update({ state: 'ready', md5_checksum: remote.md5Checksum || null }).eq('id', record.id));
        return res.status(200).json({ completed: true });
      }
      if (existing.status !== 404) throw new ApiError('Não foi possível conferir a tentativa anterior no Drive.', 502);
      const upload = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,size,md5Checksum', {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Upload-Content-Type': 'application/octet-stream', 'X-Upload-Content-Length': String(size), Origin: config.origin },
        body: JSON.stringify({ id: record.drive_file_id, name, parents: [record.folder_id], appProperties: { pilotOwner: identity.id, recordId: record.id } }),
      });
      const uploadUrl = upload.headers.get('location');
      if (!upload.ok || !uploadUrl?.startsWith('https://www.googleapis.com/')) throw new ApiError('Não foi possível iniciar o envio ao Drive.', 502);
      return res.status(200).json({ recordId: record.id, uploadUrl });
    }
    if (action === 'finish' || action === 'download') {
      const record = check(await db.from('drive_pilot_files').select('*').eq('id', input.recordId).eq('owner_auth_id', identity.id).maybeSingle());
      if (!record) throw new ApiError('Arquivo não encontrado.', 404);
      const remote = await drive(token, `files/${record.drive_file_id}?fields=${fileFields}`);
      if (!verifiedFile(remote, record)) throw new ApiError('O arquivo não corresponde ao registro do sistema. O original do Supabase foi preservado.', 409);
      if (action === 'finish') {
        check(await db.from('drive_pilot_files').update({ state: 'ready', md5_checksum: remote.md5Checksum || null }).eq('id', record.id));
        return res.status(200).json({ completed: true });
      }
      if (record.state !== 'ready') throw new ApiError('Conclua a verificação do envio primeiro.', 409);
      if (record.md5_checksum && remote.md5Checksum !== record.md5_checksum) throw new ApiError('O arquivo foi alterado diretamente no Drive. Revise essa versão antes de baixar.', 409);
      // Stream the file with the server credential; never expose the owner's Drive token.
      const media = await fetch(`${API}/files/${record.drive_file_id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } });
      if (!media.ok || !media.body) throw new ApiError('Não foi possível baixar o arquivo.', 502);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(record.name)}`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const { Readable } = await import('node:stream');
      const { pipeline } = await import('node:stream/promises');
      await pipeline(Readable.fromWeb(media.body), res);
      return;
    }
    throw new ApiError('Ação inválida.');
  } catch (error) {
    if (res.headersSent) { res.end(); return; }
    res.status(error instanceof ApiError ? error.status : 500).json({ error: error instanceof ApiError ? error.message : 'Não foi possível concluir o teste. Os arquivos existentes foram preservados.' });
  }
}
