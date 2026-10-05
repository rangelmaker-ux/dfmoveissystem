import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const PILOT_EMAIL = 'rangelmaker@gmail.com';
export const PILOT_AUTH_ID = '44d949bf-2c99-47c8-bdb6-9038bfd3c713';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export function pilotAllowed(identity, actor) {
  return identity?.id === PILOT_AUTH_ID && identity.email?.toLowerCase() === PILOT_EMAIL
    && actor?.auth_user_id === identity.id && actor.email?.toLowerCase() === PILOT_EMAIL
    && actor.role === 'ADMIN' && actor.status === 'ATIVO' && actor.is_hidden === true;
}

export function seal(value, key) {
  const secret = Buffer.from(key || '', 'base64');
  if (secret.length !== 32) throw new Error('DRIVE_ENCRYPTION_KEY deve conter 32 bytes em base64.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

export function unseal(value, key) {
  const bytes = Buffer.from(value, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'base64'), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
}

export function validState(value, nonce, now = Date.now()) {
  return value?.owner === PILOT_AUTH_ID && typeof nonce === 'string' && nonce.length >= 32
    && value.nonce === nonce && value.expires > now && value.expires <= now + 10 * 60 * 1000;
}

export function verifiedFile(remote, record) {
  return remote?.id === record.drive_file_id && remote.trashed === false
    && remote.parents?.includes(record.folder_id)
    && remote.appProperties?.pilotOwner === record.owner_auth_id
    && remote.appProperties?.recordId === record.id
    && String(remote.size) === String(record.size_bytes);
}
