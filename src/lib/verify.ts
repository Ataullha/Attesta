import 'server-only';
import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { maskName, type Design } from './design';
import { normalizeSerial, verifyRecord } from './signing';

export type CertificateView = {
  serial: string;
  status: 'valid' | 'revoked' | 'unconfirmed';
  recipient: string;
  fields: { label: string; value: string }[];
  issuedAt: Date;
  revokedAt: Date | null;
  revokeReason: string | null;
  issuer: { name: string; verified: boolean; domain: string | null; kind: 'organization' | 'individual'; since: Date };
  indexable: boolean;
  contentHash: string;
  keyId: string;
};

export const getCertificateView = cache(async (raw: string): Promise<CertificateView | null> => {
  const serial = normalizeSerial(raw);
  if (!/^[A-Z]{2,6}-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/.test(serial)) return null;
  const rows = await db()
    .select({ c: schema.certificates, design: schema.batches.design, userName: schema.users.name, userCreated: schema.users.createdAt, org: schema.organizations })
    .from(schema.certificates)
    .innerJoin(schema.batches, eq(schema.batches.id, schema.certificates.batchId))
    .innerJoin(schema.users, eq(schema.users.id, schema.certificates.userId))
    .leftJoin(schema.organizations, eq(schema.organizations.id, schema.certificates.orgId))
    .where(eq(schema.certificates.serial, serial))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const { c, org } = row;
  const design = row.design as Design;
  const values = c.values as Record<string, string>;
  const check = verifyRecord(c.payload, c.contentHash, c.signature, c.keyId);
  const fields = design.fields
    .filter((f) => f.public && f.type !== 'email' && f.key !== 'recipient_name' && values[f.key])
    .map((f) => ({ label: f.label, value: values[f.key] }));
  return {
    serial: c.serial,
    status: c.revokedAt ? 'revoked' : check.ok ? 'valid' : 'unconfirmed',
    recipient: maskName(c.recipientName, c.nameDisplay),
    fields,
    issuedAt: c.issuedAt,
    revokedAt: c.revokedAt,
    revokeReason: c.revokeReason,
    issuer: org
      ? { name: org.name, verified: org.status === 'verified', domain: org.status === 'verified' ? org.domain : null, kind: 'organization', since: org.createdAt }
      : { name: row.userName, verified: false, domain: null, kind: 'individual', since: row.userCreated },
    indexable: c.indexable && !c.deindexed && !c.revokedAt,
    contentHash: c.contentHash,
    keyId: c.keyId,
  };
});

export function formatDate(d: Date) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Dhaka' });
}
