export const CHUNK_SIZE = 32 * 1024 * 1024;
export const AUDIENCE = 'df-moveis-desktop-publisher';
export const BUCKET = 'desktop-updates';
export const REPOSITORY = 'rangelmaker-ux/dfmoveissystem';
export const WORKFLOW = `${REPOSITORY}/.github/workflows/windows-desktop.yml@refs/heads/main`;
export const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function compareVersions(a, b) {
  if (!VERSION_PATTERN.test(a) || !VERSION_PATTERN.test(b)) throw new Error('Invalid version');
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return Math.sign(x[i] - y[i]);
  return 0;
}
export function acceptsPublisher(claims, now = Date.now() / 1000) {
  return claims.iss === 'https://token.actions.githubusercontent.com' &&
    (claims.aud === AUDIENCE || (Array.isArray(claims.aud) && claims.aud.includes(AUDIENCE))) &&
    claims.repository === REPOSITORY && claims.repository_id === '1239121209' &&
    claims.ref === 'refs/heads/main' && claims.workflow_ref === WORKFLOW &&
    ['push', 'workflow_dispatch'].includes(claims.event_name) && /^[a-f0-9]{40}$/.test(claims.sha || '') &&
    Number.isFinite(claims.exp) && claims.exp > now && Number.isFinite(claims.nbf) && claims.nbf <= now + 30 &&
    Number.isFinite(claims.iat) && claims.iat <= now + 30 && claims.iat > now - 600;
}
export function makeRelease(input) {
  if (!VERSION_PATTERN.test(input.version || '') || input.version.split('.').some(n => Number(n) > 2147483647) ||
      !/^[a-f0-9]{40}$/.test(input.revision || '') || !Array.isArray(input.files) || input.files.length !== 2) throw new Error('Invalid release');
  const executable = `DF-Moveis-Instalador-${input.version}-x64.exe`;
  const names = [executable, `${executable}.blockmap`];
  const files = names.map((name, index) => {
    const file = input.files.find(f => f.name === name);
    if (!file || !Number.isSafeInteger(file.size) || file.size < 1 || file.size > (index ? 8 : 512) * 1024 * 1024 ||
        !/^[A-Za-z0-9+/]{86}==$/.test(file.sha512 || '')) throw new Error('Invalid release file');
    const parts = [];
    for (let offset = 0, part = 0; offset < file.size; offset += CHUNK_SIZE, part++) parts.push({
      path: `releases/${input.version}/${input.revision}/${index ? 'blockmap' : 'installer'}.part${String(part).padStart(2, '0')}`,
      size: Math.min(CHUNK_SIZE, file.size - offset),
    });
    return { name, size: file.size, sha512: file.sha512, parts };
  });
  return { schema: 1, version: input.version, revision: input.revision, publishedAt: new Date().toISOString(), files };
}
export function manifest(release, origin) {
  const file = release.files[0];
  const url = `${origin}/${file.name}`;
  return `version: ${release.version}\nfiles:\n  - url: ${url}\n    sha512: ${file.sha512}\n    size: ${file.size}\npath: ${url}\nsha512: ${file.sha512}\nreleaseDate: '${release.publishedAt}'\n`;
}
export function byteRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) throw new Error('Invalid range');
  let start, end;
  if (!match[1]) { start = Math.max(0, size - Number(match[2])); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new Error('Invalid range');
  return { start, end, partial: true };
}
export async function* readParts(parts, range, getPart) {
  let offset = 0;
  for (const part of parts) {
    const start = Math.max(0, range.start - offset), end = Math.min(part.size - 1, range.end - offset);
    offset += part.size;
    if (start > end || end < 0 || start >= part.size) continue;
    const response = await getPart(part.path, start, end);
    if (!response.ok || !response.body) throw new Error('Download failed');
    const reader = response.body.getReader();
    let skip = response.status === 206 ? 0 : start, remaining = end - start + 1;
    try {
      while (remaining > 0) {
        const { value, done } = await reader.read();
        if (done) throw new Error('Incomplete download');
        if (skip >= value.length) { skip -= value.length; continue; }
        const bytes = value.subarray(skip, skip + remaining); skip = 0;
        remaining -= bytes.length;
        yield bytes;
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
}
