const test = require('node:test');
const assert = require('node:assert/strict');
const { shouldShowIntro } = require('../src/startup-policy.cjs');

test('abertura da marca aparece na primeira vez, sem repetir na mesma versão', () => {
  assert.equal(shouldShowIntro(null, '1.0.1'), true);
  assert.equal(shouldShowIntro({}, '1.0.1'), true);
  assert.equal(shouldShowIntro({ version: '1.0.1', pendingUpdate: false }, '1.0.1'), false);
});

test('atualizações nativas e web habilitam uma nova abertura da marca', () => {
  assert.equal(shouldShowIntro({ version: '1.0.0' }, '1.0.1'), true);
  assert.equal(shouldShowIntro({ version: '1.0.1', pendingUpdate: true }, '1.0.1'), true);
  assert.equal(shouldShowIntro({ version: '1.0.1', pendingUpdate: false }, '1.0.1'), false);
});
