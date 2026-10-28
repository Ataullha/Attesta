import { generateKeyPairSync } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { issueForUser } from '@/lib/issue';
import { getCertificateView } from '@/lib/verify';
import { verifyRecord } from '@/lib/signing';
import { presetDesign } from '@/lib/presets';
import { hasDb, makeUser } from './helpers';

// Issuing signs every record, so these tests sign with a key pair of their own. The signing module
// reads its keys when it first signs, which is after this runs.
beforeAll(() => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  vi.stubEnv('SIGNING_KEY_ID', 'k-id-cards-test');
  vi.stubEnv('SIGNING_PRIVATE_KEY', privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'));
  vi.stubEnv('SIGNING_PUBLIC_KEY', publicKey.export({ format: 'der', type: 'spki' }).toString('base64'));
});
afterAll(() => vi.unstubAllEnvs());

describe.skipIf(!hasDb)('issuing ID cards (real Postgres)', () => {
  it('signs the date each card is valid until, and says a card has expired once it has', async () => {
    const user = await makeUser({ emailVerifiedAt: new Date(), credits: 10 });
    const res = await issueForUser(
      { id: user.id, email: user.email, name: user.name, role: 'user', credits: 10, emailVerified: true },
      {
        design: presetDesign('club-member-card'),
        templateId: null,
        batchId: null,
        batchName: 'New members',
        mode: 'bulk',
        recipients: [
          { values: { recipient_name: 'Nusrat Jahan', role: 'General member', member_id: 'M1001', photo: 'photos/M1001.jpg', valid_until: '31/12/2099' } },
          { values: { recipient_name: 'Arif Hossain', role: 'Volunteer', member_id: 'M1002', photo: 'M1002.jpg', valid_until: '1 January 2020' } },
          { values: { recipient_name: 'Sadia Islam', member_id: 'M1003' } },
        ],
      },
    );
    const [current, lapsed, open] = res.issued.map((i) => i.serial);
    const rows = await db().select().from(schema.certificates).where(inArray(schema.certificates.serial, [current, lapsed, open]));
    const row = (serial: string) => rows.find((r) => r.serial === serial)!;

    // The end of the day in Bangladesh, and the date itself inside what was signed.
    expect(row(current).expiresAt?.toISOString()).toBe('2099-12-31T17:59:59.000Z');
    expect(JSON.parse(row(current).payload).expires).toBe('2099-12-31');
    expect(row(open).expiresAt).toBeNull();
    expect(JSON.parse(row(open).payload)).not.toHaveProperty('expires');
    for (const r of rows) expect(verifyRecord(r.payload, r.contentHash, r.signature, r.keyId).ok).toBe(true);

    // The photo's file name is kept for its owner, so the card can be matched to its photo again,
    // but it is no part of the public record.
    expect((row(current).values as Record<string, string>).photo).toBe('M1001.jpg');
    expect(JSON.parse(row(current).payload).fields).not.toHaveProperty('photo');

    const view = (await getCertificateView(current))!;
    expect(view).toMatchObject({ kind: 'id-card', status: 'valid', recipient: 'Nusrat Jahan' });
    expect(view.fields.map((f) => f.label)).toEqual(['Role', 'Member ID', 'Valid until']);
    expect(view.fields.find((f) => f.label === 'Valid until')?.value).toBe('31 December 2099');
    expect((await getCertificateView(lapsed))!.status).toBe('expired');
    expect((await getCertificateView(open))!.status).toBe('valid');
  });

  it('refuses a card whose date it is valid until is not a date, before anything is issued', async () => {
    const user = await makeUser({ emailVerifiedAt: new Date(), credits: 10 });
    await expect(
      issueForUser(
        { id: user.id, email: user.email, name: user.name, role: 'user', credits: 10, emailVerified: true },
        { design: presetDesign('staff-id-card'), templateId: null, batchId: null, batchName: 'Staff', mode: 'single', recipients: [{ values: { recipient_name: 'Tanvir Ahmed', valid_until: 'until he leaves' } }] },
      ),
    ).rejects.toThrow('Recipient 1: Valid until must be a date, such as 31 December 2026 or 2026-12-31');
    const issued = await db().select().from(schema.batches).where(inArray(schema.batches.userId, [user.id]));
    expect(issued).toHaveLength(0);
  });
});
