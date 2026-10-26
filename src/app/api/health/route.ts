import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { json, route } from '@/lib/security/request';
import { signPayload, verifyRecord } from '@/lib/signing';

export const runtime = 'nodejs';

/**
 * For uptime monitors and for checking a fresh deployment. 200 when the app can reach its database
 * and its signing keys work, 503 with the failing part named otherwise.
 *
 * The signing check signs a value and verifies it with the configured public key. That catches the
 * easy setup mistake of pasting a public key that does not belong to the private one - every
 * certificate would then be issued and shown as "could not be confirmed". Nothing secret is returned.
 */
export const GET = route(async () => {
  const checks = { database: 'failed', signing: 'failed' };
  try {
    await db().execute(sql`select 1`);
    checks.database = 'ok';
  } catch (err) {
    console.error('health: database check failed', err);
  }
  try {
    const record = signPayload('health-check');
    if (verifyRecord('health-check', record.contentHash, record.signature, record.keyId).ok) checks.signing = 'ok';
  } catch (err) {
    console.error('health: signing check failed', err);
  }
  const ok = checks.database === 'ok' && checks.signing === 'ok';
  return json({ ok, checks }, ok ? 200 : 503);
});
