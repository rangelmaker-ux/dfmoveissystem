import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes, createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const source = (await readFile(new URL('../src/lib/server-status.ts', import.meta.url), 'utf8')).replace("'zustand'", JSON.stringify(pathToFileURL(require.resolve('zustand')).href));
const { useServerStatus, indicatorState, trackServerTask, observedServerFetch, setSyncScope, setServerConnected } = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source)).toString('base64')}`);
const reset = () => useServerStatus.setState({ connected: true, pending: 0, errors: {}, scopes: {} });
const color = () => indicatorState(useServerStatus.getState());

test('overlapping uploads remain yellow until every transfer finishes', async () => {
  reset();
  let finishA, finishB;
  const a = trackServerTask('a', () => new Promise(resolve => { finishA = resolve; }));
  const b = trackServerTask('b', () => new Promise(resolve => { finishB = resolve; }));
  assert.equal(color(), 'yellow');
  finishA(); await a;
  assert.equal(color(), 'yellow');
  finishB(); await b;
  assert.equal(color(), 'green');
});

test('healthy connection cannot hide a failed upload; successful retry clears it', async () => {
  reset();
  await assert.rejects(trackServerTask('upload', async () => { throw new Error('failure'); }));
  setServerConnected(true);
  assert.equal(color(), 'red');
  await trackServerTask('upload', async () => {});
  assert.equal(color(), 'green');
  setSyncScope('budget', 'error');
  await trackServerTask('heartbeat', async () => {}, false);
  assert.equal(color(), 'red');
});

test('HTTP error response remains readable and a successful read cannot mask failed write', async () => {
  reset();
  const originalFetch = globalThis.fetch;
  try {
    const failed = new Response('{"error":"conflict"}', { status: 409 });
    globalThis.fetch = async () => failed;
    const response = await observedServerFetch('https://example.test/rest/v1/budget', { method: 'POST' });
    assert.equal(response, failed);
    assert.equal((await response.json()).error, 'conflict');
    globalThis.fetch = async () => new Response('{}');
    await observedServerFetch('https://example.test/rest/v1/budget');
    assert.equal(color(), 'red');
    await observedServerFetch('https://example.test/rest/v1/budget', { method: 'POST' });
    assert.equal(color(), 'green');
  } finally { globalThis.fetch = originalFetch; }
});
