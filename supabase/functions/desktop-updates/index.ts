import { createClient } from 'npm:@supabase/supabase-js@2.105.4';
import { AUDIENCE, BUCKET, CHUNK_SIZE, acceptsPublisher, compareVersions, makeRelease, manifest, byteRange, readParts } from './protocol.mjs';

const projectUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const client = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const store = client.storage.from(BUCKET);
const functionOrigin = `${projectUrl}/functions/v1/desktop-updates`;
const encoder = new TextEncoder();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
let jwks: { keys: JsonWebKey[] } | undefined, jwksUntil = 0;
function decode(encoded: string) {
  return Uint8Array.from(atob(encoded.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}
async function authorize(request: Request) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
  if (token.length > 16000) throw new Error('Unauthorized');
  const pieces = token.split('.');
  if (pieces.length !== 3) throw new Error('Unauthorized');
  const header = JSON.parse(new TextDecoder().decode(decode(pieces[0])));
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Unauthorized');
  if (!jwks || Date.now() > jwksUntil || !jwks.keys.some((k: JsonWebKey & { kid?: string }) => k.kid === header.kid)) {
    const response = await fetch('https://token.actions.githubusercontent.com/.well-known/jwks', { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Unauthorized');
    jwks = await response.json(); jwksUntil = Date.now() + 300000;
  }
  const key = jwks!.keys.find((k: JsonWebKey & { kid?: string }) => k.kid === header.kid);
  if (!key || key.kty !== 'RSA') throw new Error('Unauthorized');
  const imported = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', imported, decode(pieces[2]), encoder.encode(`${pieces[0]}.${pieces[1]}`));
  const claims = JSON.parse(new TextDecoder().decode(decode(pieces[1])));
  if (!valid || !acceptsPublisher(claims)) throw new Error('Unauthorized');
  return claims;
}
async function readJson(path: string) {
  const response = await fetch(`${projectUrl}/storage/v1/object/${BUCKET}/${path}?check=${Date.now()}`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(15000),
  });
  if (response.status === 404 || response.status === 400) return null;
  if (!response.ok) throw new Error('Metadata unavailable');
  return await response.json();
}
async function writeJson(path: string, value: unknown) {
  const { error } = await store.upload(path, encoder.encode(JSON.stringify(value)), { contentType: 'application/json', cacheControl: '0', upsert: true });
  if (error) throw new Error('Could not publish metadata');
}
async function ensureBucket() {
  const { data } = await client.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await client.storage.createBucket(BUCKET, { public: true, fileSizeLimit: CHUNK_SIZE, allowedMimeTypes: ['application/octet-stream', 'application/json'] });
    if (error) throw new Error('Could not create update storage');
  }
}
Deno.serve(async request => {
  try {
    const url = new URL(request.url);
    const asset = url.searchParams.get('asset') || decodeURIComponent(url.pathname.split('/').at(-1) || '');
    if (request.method === 'POST') {
      let claims;
      try { claims = await authorize(request); } catch { return json({ error: 'Unauthorized' }, 401); }
      const length = Number(request.headers.get('Content-Length'));
      if (length > 32000) return json({ error: 'Request too large' }, 413);
      const text = await request.text();
      if (text.length > 32000) return json({ error: 'Request too large' }, 413);
      const input = JSON.parse(text);
      if (input.revision !== claims.sha) return json({ error: 'Revision mismatch' }, 403);
      const release = makeRelease(input);
      await ensureBucket();
      const current = await readJson('latest.json');
      if (current && compareVersions(release.version, current.version) <= 0) return json({ error: 'Version must increase' }, 409);
      if (input.action === 'prepare') {
        const uploads = [];
        for (const file of release.files) for (const part of file.parts) {
          const { data, error } = await store.createSignedUploadUrl(part.path, { upsert: true });
          if (error) throw new Error('Could not prepare upload');
          uploads.push({ path: part.path, size: part.size, file: file.name, signedUrl: data.signedUrl });
        }
        return json({ uploads, publicKey: Deno.env.get('SUPABASE_ANON_KEY') });
      }
      if (input.action === 'finalize') {
        for (const file of release.files) for (const part of file.parts) {
          const { data, error } = await store.info(part.path);
          if (error || Number(data?.size) !== part.size) return json({ error: 'Release upload incomplete' }, 409);
        }
        await writeJson(`releases/${release.version}/release.json`, release);
        await writeJson('latest.json', release);
        return json({ published: true, version: release.version });
      }
      return json({ error: 'Invalid action' }, 400);
    }
    if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
    if (asset === 'latest.yml' || asset === 'release.json') {
      const release = await readJson('latest.json');
      if (!release) return json({ error: 'No release published' }, 404);
      const content = asset === 'latest.yml' ? manifest(release, functionOrigin) : JSON.stringify(release);
      return new Response(request.method === 'HEAD' ? null : content, { headers: { 'Content-Type': asset === 'latest.yml' ? 'text/yaml' : 'application/json', 'Cache-Control': 'no-store, max-age=0' } });
    }
    const match = /^DF-Moveis-Instalador-(\d+\.\d+\.\d+)-x64\.exe(?:\.blockmap)?$/.exec(asset);
    if (!match) return json({ error: 'Not found' }, 404);
    const release = await readJson(`releases/${match[1]}/release.json`);
    const file = release?.files.find((f: { name: string }) => f.name === asset);
    if (!file) return json({ error: 'Not found' }, 404);
    let range;
    try { range = byteRange(request.headers.get('Range'), file.size); }
    catch { return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${file.size}` } }); }
    const headers: Record<string, string> = {
      'Content-Type': 'application/octet-stream', 'Content-Length': String(range.end - range.start + 1),
      'Accept-Ranges': 'bytes', 'Content-Disposition': `attachment; filename="${asset}"`, 'Cache-Control': 'public, max-age=3600, immutable',
    };
    if (range.partial) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${file.size}`;
    if (request.method === 'HEAD') return new Response(null, { status: range.partial ? 206 : 200, headers });
    const controller = new AbortController();
    const iterator = readParts(file.parts, range, (path: string, start: number, end: number) => fetch(`${projectUrl}/storage/v1/object/public/${BUCKET}/${path}`, {
      headers: { Range: `bytes=${start}-${end}` }, signal: controller.signal,
    }));
    const stream = new ReadableStream({
      async pull(output) { try { const part = await iterator.next(); if (part.done) output.close(); else output.enqueue(part.value); } catch (error) { output.error(error); } },
      async cancel() { controller.abort(); await iterator.return(); },
    });
    return new Response(stream, { status: range.partial ? 206 : 200, headers });
  } catch { return json({ error: 'Update service unavailable' }, 500); }
});
