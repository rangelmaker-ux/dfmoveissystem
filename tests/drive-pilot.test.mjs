import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { pilotAllowed, PILOT_AUTH_ID, PILOT_EMAIL, seal, unseal, validState, verifiedFile } from '../server/drive-security.mjs';
import handler from '../api/drive-pilot.mjs';

const identity = { id: PILOT_AUTH_ID, email: PILOT_EMAIL };
const actor = { auth_user_id: PILOT_AUTH_ID, email: PILOT_EMAIL, role: 'ADMIN', status: 'ATIVO', is_hidden: true };

test('only the exact active hidden administrator is authorized', () => {
  assert.equal(pilotAllowed(identity, actor), true);
  for (const change of [{ is_hidden: false }, { role: 'PROJETISTA' }, { status: 'BLOQUEADO' }, { email: 'other@gmail.com' }, { auth_user_id: 'other' }]) assert.equal(pilotAllowed(identity, { ...actor, ...change }), false);
  assert.equal(pilotAllowed({ ...identity, id: 'different-account' }, actor), false);
  assert.equal(pilotAllowed({ ...identity, email: 'other@gmail.com' }, actor), false);
  assert.equal(pilotAllowed(null, actor), false);
});

test('encrypted credentials reject tampering and wrong keys', () => {
  const key = randomBytes(32).toString('base64');
  const value = { refresh_token: 'test-refresh-token' };
  const encrypted = seal(value, key);
  assert.ok(!encrypted.includes(value.refresh_token));
  assert.deepEqual(unseal(encrypted, key), value);
  const damaged = Buffer.from(encrypted, 'base64url'); damaged[20] ^= 1;
  assert.throws(() => unseal(damaged.toString('base64url'), key));
  assert.throws(() => unseal(encrypted, randomBytes(32).toString('base64')));
  assert.throws(() => seal(value, 'short'));
});

test('OAuth requires matching browser nonce, owner and expiry', () => {
  const now = Date.now(), nonce = 'n'.repeat(43);
  const state = { owner: PILOT_AUTH_ID, nonce, expires: now + 600000 };
  assert.equal(validState(state, nonce, now), true);
  assert.equal(validState(state, 'x'.repeat(43), now), false);
  assert.equal(validState(state, undefined, now), false);
  assert.equal(validState({ ...state, expires: now - 1 }, nonce, now), false);
  assert.equal(validState({ ...state, owner: 'other' }, nonce, now), false);
});

test('only the complete matching Drive object can be confirmed', () => {
  const record = { id: 'record', drive_file_id: 'file', folder_id: 'folder', owner_auth_id: PILOT_AUTH_ID, size_bytes: 128 };
  const remote = { id: 'file', parents: ['folder'], trashed: false, size: '128', appProperties: { pilotOwner: PILOT_AUTH_ID, recordId: 'record' } };
  assert.equal(verifiedFile(remote, record), true);
  for (const change of [{ size: '127' }, { id: 'other' }, { parents: ['other'] }, { trashed: true }, { appProperties: {} }]) assert.equal(verifiedFile({ ...remote, ...change }, record), false);
});

test('API rejects other administrators even with a valid Supabase token', async () => {
  const previousFetch = globalThis.fetch;
  const priorUrl = process.env.SUPABASE_URL, priorKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL = 'https://test.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  globalThis.fetch = async url => {
    if (String(url).includes('/auth/v1/user')) return Response.json({ id: 'other-admin', email: 'other@gmail.com' });
    return Response.json({ ...actor, auth_user_id: 'other-admin', email: 'other@gmail.com' });
  };
  const res = { code: 0, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  try {
    await handler({ url: '/api/drive-pilot?action=prepare', method: 'POST', headers: { authorization: 'Bearer test-token' }, body: {} }, res);
    assert.equal(res.code, 403);
    assert.match(res.body.error, /administrador oculto/);
  } finally {
    globalThis.fetch = previousFetch;
    if (priorUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = priorUrl;
    if (priorKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = priorKey;
  }
});

test('upload records its stable ID before transfer and confirms only complete content', async () => {
  const previousFetch = globalThis.fetch, previousEnv = { ...process.env };
  const key = randomBytes(32).toString('base64');
  Object.assign(process.env, { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key', GOOGLE_DRIVE_CLIENT_ID: 'test-client', GOOGLE_DRIVE_CLIENT_SECRET: 'test-secret', DRIVE_ENCRYPTION_KEY: key, DRIVE_APP_ORIGIN: 'https://test.example' });
  let record, remote, transferStarted = false;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url); calls.push(value);
    if (value.includes('/auth/v1/user')) return Response.json(identity);
    if (value.includes('/rest/v1/users')) return Response.json(actor);
    if (value.includes('/rest/v1/drive_pilot_connections')) return Response.json({ encrypted_refresh_token: seal({ refresh_token: 'refresh-secret' }, key), root_folder_id: 'root' });
    if (value === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'google-access-secret' });
    if (value.includes('/oauth2/v3/userinfo')) return Response.json({ email: PILOT_EMAIL, email_verified: true });
    if (value.includes('/rest/v1/projetos')) return Response.json({ id: '11111111-1111-1111-1111-111111111111', nome: 'Projeto', cliente_id: '22222222-2222-2222-2222-222222222222' });
    if (value.includes('/rest/v1/clientes')) return Response.json({ id: '22222222-2222-2222-2222-222222222222', nome: 'Cliente' });
    if (value.includes('/drive/v3/files?') && !value.includes('/upload/')) return Response.json({ files: [{ id: 'project-folder' }] });
    if (value.includes('/drive/v3/files/generateIds')) return Response.json({ ids: ['stable-drive-id'] });
    if (value.includes('/rest/v1/drive_pilot_files')) {
      if (options.method === 'POST') { record = JSON.parse(options.body); return Response.json(record); }
      if (options.method === 'PATCH') { Object.assign(record, JSON.parse(options.body)); return new Response(null, { status: 204 }); }
      return Response.json(record);
    }
    if (value.includes('/drive/v3/files/stable-drive-id')) return remote ? Response.json(remote) : Response.json({ error: 'missing' }, { status: 404 });
    if (value.includes('/upload/drive/')) {
      assert.ok(record, 'metadata must exist before upload');
      assert.equal(record.state, 'pending');
      assert.equal(JSON.parse(options.body).id, record.drive_file_id);
      transferStarted = true;
      return new Response(null, { status: 200, headers: { location: 'https://www.googleapis.com/upload/session-specific' } });
    }
    throw new Error(`Unexpected request: ${value}`);
  };
  function response() { return { code: 0, body: null, setHeader() {}, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } }; }
  async function request(action, input) {
    const res = response();
    await handler({ url: `/api/drive-pilot?action=${action}`, method: 'POST', headers: { authorization: 'Bearer valid-token', origin: 'https://test.example' }, body: input }, res);
    return res;
  }
  try {
    const prepared = await request('prepare', { projectId: '11111111-1111-1111-1111-111111111111', name: 'original.pdf', size: 128 });
    assert.equal(prepared.code, 200); assert.equal(transferStarted, true);
    assert.ok(!JSON.stringify(prepared.body).includes('google-access-secret'));
    const incomplete = await request('finish', { recordId: record.id });
    assert.equal(incomplete.code, 502); assert.equal(record.state, 'pending');
    remote = { id: record.drive_file_id, name: record.name, parents: [record.folder_id], trashed: false, size: '127', appProperties: { pilotOwner: PILOT_AUTH_ID, recordId: record.id } };
    const wrongSize = await request('finish', { recordId: record.id });
    assert.equal(wrongSize.code, 409); assert.equal(record.state, 'pending');
    remote.size = '128'; remote.md5Checksum = 'checked-content';
    const completed = await request('finish', { recordId: record.id });
    assert.equal(completed.code, 200); assert.equal(record.state, 'ready'); assert.equal(record.md5_checksum, 'checked-content');
    remote.md5Checksum = 'edited-content';
    const changed = await request('download', { recordId: record.id });
    assert.equal(changed.code, 409);
    assert.ok(!calls.some(value => value.includes('/storage/')), 'pilot never deletes or changes Supabase storage');
  } finally { globalThis.fetch = previousFetch; for (const name of Object.keys(process.env)) if (!(name in previousEnv)) delete process.env[name]; Object.assign(process.env, previousEnv); }
});
