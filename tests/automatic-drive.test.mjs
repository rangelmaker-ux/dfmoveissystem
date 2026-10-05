import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const authId = '44d949bf-2c99-47c8-bdb6-9038bfd3c713';
const source = stripTypeScriptTypes(fs.readFileSync(new URL('../src/lib/automatic-drive-backup.ts', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, ''), { mode: 'transform' });
let sequence = 0;
async function load(fixture) {
  globalThis.__driveFixture = fixture;
  const code = `const {supabase,useAuthStore,pilotRequest,uploadPilot,toast,localStorage}=globalThis.__driveFixture; const DRIVE_PILOT_AUTH_ID='${authId}'; const DRIVE_PILOT_EMAIL='rangelmaker@gmail.com';\n${source}\n// instance ${sequence++}`;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}
function fixture() {
  const saved = new Map(), copies = [], messages = [];
  return {
    copies, messages, saved,
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) },
    useAuthStore: { getState: () => ({ role: 'ADMIN', user: { id: authId, email: 'rangelmaker@gmail.com' } }) },
    supabase: { auth: { getUser: async () => ({ data: { user: { id: authId } } }) }, storage: { from: () => ({ download: async () => ({ data: new Blob(['original']), error: null }) }) } },
    pilotRequest: async () => ({ connected: true }),
    uploadPilot: async (...args) => { copies.push(args); },
    toast: { info: value => messages.push(value), warning: value => messages.push(value), success: value => messages.push(value) },
  };
}
test('normal upload automatically copies to its existing project without extra selection', async () => {
  const f = fixture(), api = await load(f);
  await api.copyUploadedFileAutomatically('project', 'project/123_document.pdf', new Blob(['original']));
  assert.equal(f.copies.length, 1);
  assert.equal(f.copies[0][0], 'project');
  assert.equal(f.copies[0][2], '123_document.pdf');
  assert.equal(f.copies[0][4], 'project/123_document.pdf');
  assert.deepEqual(JSON.parse([...f.saved.values()][0]), []);
});
test('failed copies survive a reload and are removed only after verification succeeds', async () => {
  const f = fixture();
  f.uploadPilot = async () => { throw new Error('Google unavailable'); };
  const first = await load(f);
  await first.copyUploadedFileAutomatically('project', 'project/original.pdf', new Blob(['original']));
  assert.equal(JSON.parse([...f.saved.values()][0]).length, 1);
  assert.ok(f.messages.some(message => message.includes('pendente')));
  f.uploadPilot = async (...args) => { f.copies.push(args); };
  const reloaded = await load(f);
  await reloaded.retryAutomaticDriveCopies();
  assert.equal(f.copies.length, 1);
  assert.deepEqual(JSON.parse([...f.saved.values()][0]), []);
});
test('other employees never enqueue files or use the hidden administrator connection', async () => {
  const f = fixture();
  f.useAuthStore.getState = () => ({ role: 'ADMIN', user: { id: 'other-admin', email: 'other@gmail.com' } });
  const api = await load(f);
  await api.copyUploadedFileAutomatically('project', 'project/file.pdf', new Blob(['original']));
  assert.equal(f.saved.size, 0);
  assert.equal(f.copies.length, 0);
});
