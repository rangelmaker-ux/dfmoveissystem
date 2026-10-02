const test = require('node:test');
const assert = require('node:assert/strict');
const { isAppUrl, isDocumentUrl, parseRelease, needsUpdate } = require('../src/update-policy.cjs');
test('somente a origem oficial abre como sistema', () => {
  assert.equal(isAppUrl('https://dfmoveis-system.vercel.app/admin/dashboard'), true);
  for (const url of ['https://dfmoveis-system.vercel.app.evil.test', 'http://dfmoveis-system.vercel.app', 'file:///etc/passwd', 'javascript:alert(1)']) assert.equal(isAppUrl(url), false);
});
test('documentos privados e PDFs gerados podem abrir; arquivos locais não', () => {
  assert.equal(isDocumentUrl('https://rcwilkmovlrdxhfviemo.supabase.co/storage/v1/object/sign/projetos_arquivos/a/render.png?token=x'), true);
  assert.equal(isDocumentUrl('blob:https://dfmoveis-system.vercel.app/abcdef'), true);
  assert.equal(isDocumentUrl('https://rcwilkmovlrdxhfviemo.supabase.co/auth/v1/admin/users'), false);
  assert.equal(isDocumentUrl('file:///C:/Windows/system.ini'), false);
});
test('avisa somente quando muda a versão já utilizada', () => {
  assert.equal(needsUpdate(null, 'new'), false);
  assert.equal(needsUpdate('same', 'same'), false);
  assert.equal(needsUpdate('old', 'new'), true);
});
test('recusa manifesto incompleto ou adulterado', () => {
  const release = { schema: 1, revision: 'a'.repeat(40), publishedAt: '2026-10-02T04:00:00Z' };
  assert.equal(parseRelease(release).revision, release.revision);
  assert.throws(() => parseRelease({ ...release, revision: '../payload.exe' }));
  assert.throws(() => parseRelease({ ...release, publishedAt: 'invalid' }));
  assert.throws(() => parseRelease('<html>login</html>'));
});
