import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getUser } from '@/lib/auth/session';
import { clientIp, HttpError, json, readJson, route } from '@/lib/security/request';
import { hashIp } from '@/lib/security/crypto';
import { rateLimit } from '@/lib/security/rate-limit';
import { guestId } from '@/lib/security/guest';
import { issueForGuest, issueForUser } from '@/lib/issue';
import { isUuid, parseDesign } from '@/lib/validate';
import { limits } from '@/lib/site';

export const runtime = 'nodejs';

const body = z.object({
  design: z.unknown(),
  templateId: z.string().nullable().optional(),
  batchId: z.string().nullable().optional(),
  batchName: z.string().max(120).optional(),
  mode: z.enum(['single', 'bulk']),
  recipients: z.array(z.object({ values: z.record(z.string(), z.unknown()) })).min(1).max(limits.issueChunk),
});

export const POST = route(async (req) => {
  const parsed = body.safeParse(await readJson(req, 1_500_000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'The request is not valid.');
  const design = parseDesign(parsed.data.design);
  const user = await getUser();

  if (!user) {
    if (parsed.data.mode !== 'single' || parsed.data.recipients.length !== 1) {
      throw new HttpError(401, 'Sign in to issue certificates in bulk.', 'unauthenticated');
    }
    const ip = hashIp(await clientIp());
    await rateLimit(`issue:guest:${ip}`, 10, 60);
    const gid = await guestId();
    const res = await issueForGuest(gid, ip, design, parsed.data.recipients[0].values);
    return json({ guest: true, issued: [{ serial: res.serial, verifyUrl: res.verifyUrl }], remaining: res.remaining });
  }

  if (!user.emailVerified) throw new HttpError(403, 'Confirm your email address before issuing — check your inbox for the link.', 'email_unverified');
  await rateLimit(`issue:user:${user.id}`, 120, 60);

  let templateId: string | null = null;
  if (parsed.data.templateId && isUuid(parsed.data.templateId)) {
    const [t] = await db()
      .select({ id: schema.templates.id })
      .from(schema.templates)
      .where(and(eq(schema.templates.id, parsed.data.templateId), eq(schema.templates.userId, user.id)))
      .limit(1);
    templateId = t?.id ?? null;
  }
  const batchId = parsed.data.batchId && isUuid(parsed.data.batchId) ? parsed.data.batchId : null;

  const res = await issueForUser(user, {
    design,
    templateId,
    batchId,
    batchName: parsed.data.batchName ?? (parsed.data.mode === 'bulk' ? 'Bulk batch' : 'Single certificate'),
    mode: parsed.data.mode,
    recipients: parsed.data.recipients,
  });
  return json({ guest: false, batchId: res.batchId, issued: res.issued });
});
