import { generateKeyPairSync } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { issueForUser } from '@/lib/issue';
import { getCertificateView } from '@/lib/verify';
import { verifyRecord } from '@/lib/signing';
import { presetDesign } from '@/lib/presets';
import { hasDb, makeUser } from './helpers';

// Issuing signs every record, so these tests sign with a key pair of their own.
beforeAll(() => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  vi.stubEnv('SIGNING_KEY_ID', 'k-visiting-test');
  vi.stubEnv('SIGNING_PRIVATE_KEY', privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64'));
  vi.stubEnv('SIGNING_PUBLIC_KEY', publicKey.export({ format: 'der', type: 'spki' }).toString('base64'));
});
afterAll(() => vi.unstubAllEnvs());

const issuer = async () => {
  const user = await makeUser({ emailVerifiedAt: new Date(), credits: 10 });
  return { id: user.id, email: user.email, name: user.name, role: 'user' as const, credits: 10, emailVerified: true };
};

describe.skipIf(!hasDb)('visiting cards and invitations (real Postgres)', () => {
  it('sign what every card shares (the company, its website and address) with each person’s own details', async () => {
    const res = await issueForUser(await issuer(), {
      design: presetDesign('corporate-visiting-card'),
      templateId: null,
      batchId: null,
      batchName: 'Team',
      mode: 'bulk',
      recipients: [
        { values: { recipient_name: 'Nusrat Jahan', designation: 'Head of Marketing', mobile: '01711-123456', email: 'nusrat@example.com' } },
        { values: { recipient_name: 'Arif Hossain', designation: 'Accountant', company: 'Sister Concern Ltd' } },
      ],
    });
    const rows = await db().select().from(schema.certificates).where(inArray(schema.certificates.serial, res.issued.map((i) => i.serial)));
    const row = (name: string) => rows.find((r) => r.recipientName === name)!;
    const signed = (name: string) => JSON.parse(row(name).payload).fields;

    expect(signed('Nusrat Jahan')).toMatchObject({ company: 'Your Company Ltd', website: 'www.yourcompany.com', address: 'House 12, Road 5, Dhanmondi, Dhaka 1205', mobile: '01711-123456' });
    // A row's own value for a shared field wins.
    expect(signed('Arif Hossain').company).toBe('Sister Concern Ltd');
    for (const r of rows) expect(verifyRecord(r.payload, r.contentHash, r.signature, r.keyId).ok).toBe(true);

    const view = (await getCertificateView(row('Nusrat Jahan').serial))!;
    expect(view).toMatchObject({ kind: 'visiting-card', status: 'valid', recipient: 'Nusrat Jahan', credential: 'Head of Marketing' });
    expect(view.fields.map((f) => f.label)).toEqual(['Designation', 'Mobile', 'Email', 'Company', 'Website', 'Address']);
  });

  it('give each guest an invitation of their own, recorded as invitations', async () => {
    const res = await issueForUser(await issuer(), {
      design: presetDesign('bangla-wedding-invitation'),
      templateId: null,
      batchId: null,
      batchName: 'অতিথি',
      mode: 'bulk',
      recipients: [{ values: { recipient_name: 'জনাব করিম উদ্দিন ও পরিবার' } }, { values: { recipient_name: 'রহিমা বেগম' } }],
    });
    expect(res.issued).toHaveLength(2);
    const views = await Promise.all(res.issued.map((i) => getCertificateView(i.serial)));
    expect(views.map((v) => v!.kind)).toEqual(['invitation', 'invitation']);
    expect(views.map((v) => v!.recipient).sort()).toEqual(['জনাব করিম উদ্দিন ও পরিবার', 'রহিমা বেগম'].sort());
    expect(views[0]!.fields.find((f) => f.label === 'স্থান')?.value).toBe('সেনামালঞ্চ, ঢাকা সেনানিবাস');
    const [batch] = await db().select().from(schema.batches).where(inArray(schema.batches.id, [res.batchId]));
    expect(batch.count).toBe(2);
  });
});
