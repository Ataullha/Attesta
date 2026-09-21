import 'server-only';
import { createPrivateKey, createPublicKey, randomInt, sign, verify, type KeyObject } from 'node:crypto';
import { sha256Hex } from './security/crypto';
import { site } from './site';

let cachedPrivate: KeyObject | null = null;
const cachedPublic = new Map<string, KeyObject>();

function currentKeyId() {
  return process.env.SIGNING_KEY_ID ?? 'dev';
}

function privateKey() {
  if (cachedPrivate) return cachedPrivate;
  const b64 = process.env.SIGNING_PRIVATE_KEY;
  if (!b64) throw new Error('SIGNING_PRIVATE_KEY is not set. Run `npm run keys:generate` and add the values to your environment.');
  cachedPrivate = createPrivateKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'pkcs8' });
  return cachedPrivate;
}

function publicKeyFor(keyId: string) {
  const hit = cachedPublic.get(keyId);
  if (hit) return hit;
  let b64: string | undefined;
  if (keyId === currentKeyId()) b64 = process.env.SIGNING_PUBLIC_KEY;
  else {
    try {
      b64 = (JSON.parse(process.env.SIGNING_PUBLIC_KEYS_OLD ?? '{}') as Record<string, string>)[keyId];
    } catch {
      b64 = undefined;
    }
  }
  if (!b64) return null;
  const key = createPublicKey({ key: Buffer.from(b64, 'base64'), format: 'der', type: 'spki' });
  cachedPublic.set(keyId, key);
  return key;
}

export function signPayload(payload: string) {
  return {
    contentHash: sha256Hex(payload),
    signature: sign(null, Buffer.from(payload), privateKey()).toString('base64url'),
    keyId: currentKeyId(),
  };
}

export function verifyRecord(payload: string, contentHash: string, signature: string, keyId: string) {
  if (sha256Hex(payload) !== contentHash) return { ok: false, reason: 'hash' as const };
  const key = publicKeyFor(keyId);
  if (!key) return { ok: false, reason: 'unknown-key' as const };
  try {
    return verify(null, Buffer.from(payload), key, Buffer.from(signature, 'base64url'))
      ? { ok: true as const }
      : { ok: false, reason: 'signature' as const };
  } catch {
    return { ok: false, reason: 'signature' as const };
  }
}

// Crockford base32 without I, L, O, U — easy to read aloud and type from paper.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 60 random bits: ATT-XXXX-XXXX-XXXX. Never sequential, so records can't be enumerated. */
export function newSerial(prefix: string = site.serialPrefix) {
  const groups: string[] = [];
  for (let g = 0; g < 3; g++) {
    let s = '';
    for (let i = 0; i < 4; i++) s += ALPHABET[randomInt(32)];
    groups.push(s);
  }
  return `${prefix}-${groups.join('-')}`;
}

export function newGuestSerial() {
  return newSerial('GUEST');
}

export function normalizeSerial(input: string) {
  return input.trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9-]/g, '').slice(0, 40);
}

export function verifyUrl(serial: string) {
  return `${site.url}/verify/${serial}`;
}
