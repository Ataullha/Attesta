import { resolveTxt } from 'node:dns/promises';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireVerifiedUser } from '@/lib/auth/session';
import { HttpError, json, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { audit } from '@/lib/audit';

export const runtime = 'nodejs';

export const POST = route(async () => {
  const user = await requireVerifiedUser();
  await rateLimit(`dns:${user.id}`, 10, 600);
  const [org] = await db().select().from(schema.organizations).where(eq(schema.organizations.ownerUserId, user.id)).limit(1);
  if (!org?.domain) throw new HttpError(400, 'Add your organisation’s domain first.');
  if (org.status === 'verified') return json({ ok: true, status: 'verified' });

  let records: string[] = [];
  try {
    records = (await resolveTxt(`_attesta.${org.domain}`)).map((chunks) => chunks.join(''));
  } catch {
    records = [];
  }
  await db().update(schema.organizations).set({ dnsCheckedAt: new Date() }).where(eq(schema.organizations.id, org.id));
  if (!records.includes(`attesta-verify=${org.dnsToken}`)) {
    throw new HttpError(400, 'The TXT record was not found yet. DNS changes can take up to an hour to appear — try again later.', 'dns_missing');
  }
  await db().update(schema.organizations).set({ status: 'pending' }).where(eq(schema.organizations.id, org.id));
  await audit(user.id, 'org.dns_verified', org.domain);
  return json({ ok: true, status: 'pending' });
});
