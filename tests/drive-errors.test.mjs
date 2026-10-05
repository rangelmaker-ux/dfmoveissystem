import test from 'node:test';
import assert from 'node:assert/strict';
import { describeDriveError } from '../server/drive-errors.mjs';

test('disabled API gives an activation step instead of a false storage warning', () => {
  const message = describeDriveError(403, { error: { details: [{ reason: 'SERVICE_DISABLED' }] } });
  assert.match(message, /API está desativada/);
  assert.match(message, /project=cinemakerpro/);
  assert.doesNotMatch(message, /espaço.*acabou/);
});
test('quota, revoked access and missing scope have distinct recovery steps', () => {
  assert.match(describeDriveError(403, { error: { errors: [{ reason: 'storageQuotaExceeded' }] } }), /espaço.*acabou/);
  assert.match(describeDriveError(401, {}), /expirou/);
  assert.match(describeDriveError(403, { error: { details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] } }), /permissão/);
});
test('provider responses cannot leak credentials or arbitrary messages', () => {
  const message = describeDriveError(400, { error: { message: 'secret-access-token', errors: [{ reason: 'secret-access-token' }] } });
  assert.doesNotMatch(message, /secret-access-token/);
  assert.match(message, /HTTP 400/);
});
