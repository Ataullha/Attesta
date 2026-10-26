import { generateKeyPairSync } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Keys = { priv: string; pub: string };

function keypair(): Keys {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  return {
    priv: privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'),
    pub: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
  };
}

/** Loads a fresh copy of the module configured as a deployment with these keys would be. */
async function signingWith(id: string, keys: Keys, old?: Record<string, string>) {
  vi.resetModules();
  vi.stubEnv('SIGNING_KEY_ID', id);
  vi.stubEnv('SIGNING_PRIVATE_KEY', keys.priv);
  vi.stubEnv('SIGNING_PUBLIC_KEY', keys.pub);
  vi.stubEnv('SIGNING_PUBLIC_KEYS_OLD', old ? JSON.stringify(old) : '');
  return import('@/lib/signing');
}

afterEach(() => vi.unstubAllEnvs());

const PAYLOAD = '{"design":"d","fields":{},"issued_at":"2026-09-21T10:00:00.000Z","recipient":"Nusrat Jahan Mim","serial":"ATT-7K2Q-9M4D-X1TB","v":1}';

describe('signing and verifying a record', () => {
  it('signs a payload and verifies it', async () => {
    const s = await signingWith('k1', keypair());
    const rec = s.signPayload(PAYLOAD);
    expect(rec.keyId).toBe('k1');
    expect(rec.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(rec.signature).toMatch(/^[A-Za-z0-9_-]{86}$/); // 64-byte Ed25519 signature, base64url
    expect(s.verifyRecord(PAYLOAD, rec.contentHash, rec.signature, rec.keyId)).toEqual({ ok: true });
  });

  it('rejects an edited payload (hash no longer matches)', async () => {
    const s = await signingWith('k1', keypair());
    const rec = s.signPayload(PAYLOAD);
    const edited = PAYLOAD.replace('Nusrat', 'Nusrut');
    expect(s.verifyRecord(edited, rec.contentHash, rec.signature, rec.keyId)).toEqual({ ok: false, reason: 'hash' });
  });

  it('rejects an edit even when the attacker also recomputes the hash', async () => {
    const s = await signingWith('k1', keypair());
    const rec = s.signPayload(PAYLOAD);
    const edited = PAYLOAD.replace('Nusrat', 'Nusrut');
    const { createHash } = await import('node:crypto');
    const forgedHash = createHash('sha256').update(edited).digest('hex');
    expect(s.verifyRecord(edited, forgedHash, rec.signature, rec.keyId)).toEqual({ ok: false, reason: 'signature' });
  });

  it('rejects a record signed by someone else who claims our key id', async () => {
    // The module reads its environment when it is used, so these two steps must happen in order:
    // the attacker signs with their own key but labels the record "k1"...
    const forged = (await signingWith('k1', keypair())).signPayload(PAYLOAD);
    // ...then our deployment, holding the real k1, is asked to vouch for it.
    const ours = await signingWith('k1', keypair());
    expect(ours.verifyRecord(PAYLOAD, forged.contentHash, forged.signature, 'k1')).toEqual({ ok: false, reason: 'signature' });
  });

  it('reports an unknown key id instead of guessing', async () => {
    const s = await signingWith('k1', keypair());
    const rec = s.signPayload(PAYLOAD);
    expect(s.verifyRecord(PAYLOAD, rec.contentHash, rec.signature, 'k-missing')).toEqual({ ok: false, reason: 'unknown-key' });
  });

  it('treats a malformed signature as a failed signature, never an exception', async () => {
    const s = await signingWith('k1', keypair());
    const { contentHash } = s.signPayload(PAYLOAD);
    for (const bad of ['', '!!!', 'AAAA', 'x'.repeat(200), '\u0000']) {
      expect(s.verifyRecord(PAYLOAD, contentHash, bad, 'k1'), JSON.stringify(bad)).toEqual({ ok: false, reason: 'signature' });
    }
  });

  it('refuses to sign without a private key, with a message that says what to do', async () => {
    vi.resetModules();
    vi.stubEnv('SIGNING_PRIVATE_KEY', '');
    const s = await import('@/lib/signing');
    expect(() => s.signPayload(PAYLOAD)).toThrow(/SIGNING_PRIVATE_KEY is not set.*keys:generate/);
  });
});

describe('key rotation', () => {
  it('still verifies certificates signed under a retired key listed in SIGNING_PUBLIC_KEYS_OLD', async () => {
    const a = keypair();
    const b = keypair();
    const before = (await signingWith('kA', a)).signPayload(PAYLOAD);

    const after = await signingWith('kB', b, { kA: a.pub });
    expect(after.verifyRecord(PAYLOAD, before.contentHash, before.signature, 'kA')).toEqual({ ok: true });
    const fresh = after.signPayload(PAYLOAD);
    expect(fresh.keyId).toBe('kB');
    expect(after.verifyRecord(PAYLOAD, fresh.contentHash, fresh.signature, 'kB')).toEqual({ ok: true });
  });

  it('cannot verify the old certificates once the old public key is dropped', async () => {
    const a = keypair();
    const before = (await signingWith('kA', a)).signPayload(PAYLOAD);
    const after = await signingWith('kB', keypair());
    expect(after.verifyRecord(PAYLOAD, before.contentHash, before.signature, 'kA')).toEqual({ ok: false, reason: 'unknown-key' });
  });

  it('survives garbage in SIGNING_PUBLIC_KEYS_OLD', async () => {
    const s = await signingWith('k1', keypair());
    vi.stubEnv('SIGNING_PUBLIC_KEYS_OLD', '{not json');
    const rec = s.signPayload(PAYLOAD);
    expect(s.verifyRecord(PAYLOAD, rec.contentHash, rec.signature, 'kOld')).toEqual({ ok: false, reason: 'unknown-key' });
  });
});

describe('serial numbers', () => {
  it('match the shared pattern and avoid the confusable letters I, L, O, U', async () => {
    const s = await signingWith('k1', keypair());
    for (let i = 0; i < 2000; i++) {
      const serial = s.newSerial();
      expect(serial).toMatch(/^ATT-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
      expect(serial).toMatch(s.SERIAL_PATTERN);
    }
    expect(s.newGuestSerial()).toMatch(/^GUEST-/);
    expect(s.newGuestSerial()).toMatch(s.SERIAL_PATTERN);
  });

  it('are not repeated, and use every symbol of the alphabet', async () => {
    const s = await signingWith('k1', keypair());
    const seen = new Set<string>();
    const symbols = new Set<string>();
    for (let i = 0; i < 20_000; i++) {
      const serial = s.newSerial();
      seen.add(serial);
      for (const ch of serial.slice(4).replaceAll('-', '')) symbols.add(ch);
    }
    expect(seen.size).toBe(20_000);
    expect(symbols.size).toBe(32);
  });

  it('build verification links from APP_URL without a doubled slash', async () => {
    vi.stubEnv('APP_URL', 'https://certs.example.com/');
    const s = await signingWith('k1', keypair());
    expect(s.verifyUrl('ATT-7K2Q-9M4D-X1TB')).toBe('https://certs.example.com/verify/ATT-7K2Q-9M4D-X1TB');
  });
});

describe('normalizeSerial', () => {
  const CANON = 'ATT-7K2Q-9M4D-X1TB';

  it.each([
    ['already canonical', CANON],
    ['lower case', 'att-7k2q-9m4d-x1tb'],
    ['spaces around and between groups', '  att 7k2q 9m4d x1tb  '],
    ['no separators at all', 'ATT7K2Q9M4DX1TB'],
    ['mixed separators', 'ATT-7K2Q 9M4D_X1TB'],
    ['typographic dashes from a phone keyboard', 'ATT–7K2Q—9M4D‑X1TB'],
    ['full-width characters', 'ＡＴＴ－７Ｋ２Ｑ－９Ｍ４Ｄ－Ｘ１ＴＢ'],
    ['stray punctuation from copy and paste', '"ATT-7K2Q-9M4D-X1TB".'],
  ])('reads a serial typed with %s', async (_label, typed) => {
    const s = await signingWith('k1', keypair());
    expect(s.normalizeSerial(typed)).toBe(CANON);
  });

  it('reads the letters I, L and O as 1, 1 and 0, because real serials never contain them', async () => {
    const s = await signingWith('k1', keypair());
    // The same serial, "1" and "0" typed as the look-alike letters.
    expect(s.normalizeSerial('ATT-7K2Q-9M4D-XITB')).toBe('ATT-7K2Q-9M4D-X1TB');
    expect(s.normalizeSerial('ATT-7K2Q-9M4D-XLTB')).toBe('ATT-7K2Q-9M4D-X1TB');
    expect(s.normalizeSerial('ATT-OK2Q-9M4D-X1TB')).toBe('ATT-0K2Q-9M4D-X1TB');
    // ...but never inside the prefix, where a letter really is a letter.
    expect(s.normalizeSerial('GUEST-1234-ABCD-5678')).toBe('GUEST-1234-ABCD-5678');
  });

  it('also accepts guest serials', async () => {
    const s = await signingWith('k1', keypair());
    expect(s.normalizeSerial('guest 7k2q 9m4d x1tb')).toBe('GUEST-7K2Q-9M4D-X1TB');
  });

  it('does not invent a serial out of input that is not one', async () => {
    const s = await signingWith('k1', keypair());
    expect(s.normalizeSerial('ATT-7K2Q-9M4D-X1TB<script>')).not.toMatch(s.SERIAL_PATTERN);
    expect(s.normalizeSerial('ATT-7K2Q-9M4D')).not.toMatch(s.SERIAL_PATTERN);
    expect(s.normalizeSerial('ATT-7K2Q-9M4D-X1TB-EXTRA')).not.toMatch(s.SERIAL_PATTERN);
    expect(s.normalizeSerial('x'.repeat(100))).toHaveLength(40);
    expect(s.normalizeSerial('')).toBe('');
  });

  it('only tidies input that is not a serial, so the "not found" page shows what was typed', async () => {
    const s = await signingWith('k1', keypair());
    expect(s.normalizeSerial('zz–12—34')).toBe('ZZ-12-34'); // typographic dashes become hyphens
    // Too long to be a serial: left as typed, not cut into a serial-shaped string that was never entered.
    expect(s.normalizeSerial('ATT-7K2Q-9M4D-X1TB-EXTRA')).toBe('ATT-7K2Q-9M4D-X1TB-EXTRA');
    expect(s.normalizeSerial('guest-7k2q-9m4d-x1tb-extra')).toBe('GUEST-7K2Q-9M4D-X1TB-EXTRA');
  });

  it('is idempotent', async () => {
    const s = await signingWith('k1', keypair());
    for (const typed of ['att 7k2q 9m4d x1tb', 'ATT7K2Q9M4DX1TB', 'junk!!', 'GUEST-1234-ABCD-5678', '']) {
      const once = s.normalizeSerial(typed);
      expect(s.normalizeSerial(once), JSON.stringify(typed)).toBe(once);
    }
  });
});
