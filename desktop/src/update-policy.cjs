const SITE_ORIGIN = 'https://dfmoveis-system.vercel.app';
const STORAGE_ORIGIN = 'https://rcwilkmovlrdxhfviemo.supabase.co';
function isAppUrl(value) {
  try { return new URL(value).origin === SITE_ORIGIN; } catch { return false; }
}
function isDocumentUrl(value) {
  try {
    const url = new URL(value);
    return (url.origin === STORAGE_ORIGIN && url.pathname.startsWith('/storage/v1/object/sign/')) ||
      (url.protocol === 'blob:' && url.origin === SITE_ORIGIN);
  } catch { return false; }
}
function parseRelease(data) {
  if (!data || data.schema !== 1 || !/^[a-f0-9]{40}$/.test(data.revision) ||
    typeof data.publishedAt !== 'string' || !Number.isFinite(Date.parse(data.publishedAt))) {
    throw new Error('Versão publicada inválida.');
  }
  return { revision: data.revision, publishedAt: data.publishedAt };
}
function needsUpdate(installed, published) { return Boolean(installed && installed !== published); }
module.exports = { SITE_ORIGIN, isAppUrl, isDocumentUrl, parseRelease, needsUpdate };
