import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { clientIp, HttpError, json, readJson, route } from '@/lib/security/request';
import { hashIp } from '@/lib/security/crypto';
import { rateLimit } from '@/lib/security/rate-limit';
import { normalizeSerial } from '@/lib/signing';

const body = z.object({
  serial: z.string().min(4).max(40),
  kind: z.enum(['mismatch', 'deindex', 'other']),
  message: z.string().trim().min(10, 'Tell us a little more (at least 10 characters).').max(2000),
  contact: z.string().trim().max(200).optional(),
});

export const POST = route(async (req) => {
  const ip = hashIp(await clientIp());
  await rateLimit(`report:${ip}`, 5, 3600);
  const parsed = body.safeParse(await readJson(req, 8000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Check the form.');
  const serial = normalizeSerial(parsed.data.serial);
  const [cert] = await db().select({ id: schema.certificates.id }).from(schema.certificates).where(eq(schema.certificates.serial, serial)).limit(1);
  await db().insert(schema.reports).values({
    certificateId: cert?.id ?? null,
    serial,
    kind: parsed.data.kind,
    message: parsed.data.message,
    contact: parsed.data.contact || null,
    ipHash: ip,
  });
  return json({ ok: true });
});
