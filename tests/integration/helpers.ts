import { randomBytes, randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { presetDesign } from '@/lib/presets';

/** Integration tests run only when TEST_DATABASE_URL points at a disposable Postgres database. */
export const hasDb = !!process.env.TEST_DATABASE_URL;

/** A user with a unique address, so tests never collide even though they share one database. */
export async function makeUser(over: Partial<typeof schema.users.$inferInsert> = {}) {
  const [user] = await db()
    .insert(schema.users)
    .values({ email: `${randomUUID()}@test.example`, name: 'Test User', passwordHash: 'not-a-real-hash', ...over })
    .returning();
  return user;
}

/** A bulk batch using the "podium" preset (fields: recipient_name, position, event, issue_date). */
export async function makeBatch(userId: string, over: Partial<typeof schema.batches.$inferInsert> = {}) {
  const [batch] = await db()
    .insert(schema.batches)
    .values({ userId, name: 'Test batch', design: presetDesign('podium'), designHash: 'test-hash', mode: 'bulk', ...over })
    .returning();
  return batch;
}

export type CertSpec = {
  name?: string;
  email?: string | null;
  /** An ISO string; may carry microseconds, which a JavaScript Date cannot hold. */
  issuedAt?: string;
  revoked?: boolean;
  values?: Record<string, string>;
  serial?: string;
};

const SERIAL_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function fakeSerial() {
  const bytes = randomBytes(12);
  const chars = Array.from(bytes, (b) => SERIAL_ALPHABET[b % 32]).join('');
  return `ATT-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

/** Inserts certificates straight into a batch, in chunks. Signatures are placeholders: these tests do not verify them. */
export async function makeCertificates(userId: string, batchId: string, specs: CertSpec[]) {
  const serials: string[] = [];
  for (let i = 0; i < specs.length; i += 500) {
    const rows = specs.slice(i, i + 500).map((s, k) => {
      const serial = s.serial ?? fakeSerial();
      serials.push(serial);
      const name = s.name ?? `Person ${i + k}`;
      return {
        serial,
        batchId,
        userId,
        recipientName: name,
        recipientEmail: s.email ?? null,
        values: { recipient_name: name, position: 'First place', event: 'Debate', issue_date: '1 January 2026', ...s.values },
        payload: '{}',
        contentHash: 'test',
        signature: 'test',
        keyId: 'test',
        issuedAt: s.issuedAt ? sql`${s.issuedAt}::timestamptz` : sql`now()`,
        revokedAt: s.revoked ? sql`now()` : null,
        revokeReason: s.revoked ? 'Issued by mistake' : null,
      };
    });
    await db().insert(schema.certificates).values(rows);
  }
  return serials;
}
