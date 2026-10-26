import { afterEach, describe, expect, it, vi } from 'vitest';
import { DUMMY_PASSWORD_HASH, hashIp, hashPassword, randomToken, sha256Hex, verifyPassword } from '@/lib/security/crypto';

afterEach(() => vi.unstubAllEnvs());

describe('sha256Hex', () => {
  it('matches the published test vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('passwords', () => {
  it('verify against their own hash and nothing else', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterz', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
    expect(await verifyPassword('Correct horse battery', hash)).toBe(false);
  });

  it('are stored as self-describing scrypt hashes with a fresh salt each time', async () => {
    const [a, b] = await Promise.all([hashPassword('same password'), hashPassword('same password')]);
    expect(a).toMatch(/^scrypt\$32768\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('same password');
  });

  it('treat visually identical Unicode spellings as the same password', async () => {
    // Full-width "ｐａｓｓ１２３４５６" typed on a phone IME vs the ASCII a laptop produces.
    const hash = await hashPassword('ｐａｓｓｗｏｒｄ１２３４');
    expect(await verifyPassword('password1234', hash)).toBe(true);
  });

  it('say "no" to a malformed stored hash instead of throwing', async () => {
    for (const stored of ['', 'plain', 'scrypt$x', 'bcrypt$32768$8$1$AAAA$AAAA', 'scrypt$32768$8$1$AAAA']) {
      expect(await verifyPassword('anything', stored), JSON.stringify(stored)).toBe(false);
    }
  });

  it('keep the dummy hash well-formed, so a missing account costs the same work as a real one', async () => {
    expect(DUMMY_PASSWORD_HASH.split('$')).toHaveLength(6);
    expect(await verifyPassword('anything at all', DUMMY_PASSWORD_HASH)).toBe(false);
  });
});

describe('hashIp', () => {
  it('is stable for one salt, differs across salts and addresses, and hides the address', () => {
    vi.stubEnv('SECRET_SALT', 'salt-one');
    const a = hashIp('203.0.113.7');
    expect(hashIp('203.0.113.7')).toBe(a);
    expect(hashIp('203.0.113.8')).not.toBe(a);
    expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(a).not.toContain('203');

    vi.stubEnv('SECRET_SALT', 'salt-two');
    expect(hashIp('203.0.113.7')).not.toBe(a);
  });

  it('refuses to run in production without a salt, rather than hashing with a guessable one', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SECRET_SALT', '');
    expect(() => hashIp('203.0.113.7')).toThrow(/SECRET_SALT is not set/);
  });
});

describe('randomToken', () => {
  it('is URL-safe, long enough to be unguessable, and never repeats', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const t = randomToken(32);
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
      seen.add(t);
    }
    expect(seen.size).toBe(1000);
  });
});
