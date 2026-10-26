import 'server-only';
import { createHash, createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256Hex(input: string | Buffer) {
  return createHash('sha256').update(input).digest('hex');
}

function salt() {
  const s = process.env.SECRET_SALT;
  if (!s && process.env.NODE_ENV === 'production') throw new Error('SECRET_SALT is not set');
  return s ?? 'dev-only-salt';
}

/** IPs are only ever stored as keyed hashes. */
export function hashIp(ip: string) {
  return createHmac('sha256', salt()).update(ip).digest('base64url').slice(0, 32);
}

/** A keyed signature for a value the browser carries for us but must not be able to change. */
export function signValue(value: string) {
  return createHmac('sha256', salt()).update(`signed:${value}`).digest('base64url');
}

export function signatureMatches(value: string, signature: string) {
  const expected = Buffer.from(signValue(value));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password: string) {
  const s = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), s, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${s.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, s, k] = parts;
  const expected = Buffer.from(k, 'base64');
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(s, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash to compare against when the email doesn't exist, so response time doesn't reveal accounts. */
export const DUMMY_PASSWORD_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
