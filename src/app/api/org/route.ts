import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireVerifiedUser } from '@/lib/auth/session';
import { HttpError, json, readJson, route } from '@/lib/security/request';
import { randomToken } from '@/lib/security/crypto';

const domainRe = /^(?=.{3,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

const body = z.object({
  name: z.string().trim().min(2).max(120),
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((d) => d.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, ''))
    .refine((d) => d === '' || domainRe.test(d), 'Enter a domain like example.edu.bd'),
  website: z.union([z.literal(''), z.url().max(200)]),
});

export const POST = route(async (req) => {
  const user = await requireVerifiedUser();
  const parsed = body.safeParse(await readJson(req, 4000));
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Check the form.');
  const { name, domain, website } = parsed.data;
  const [existing] = await db().select().from(schema.organizations).where(eq(schema.organizations.ownerUserId, user.id)).limit(1);

  if (!existing) {
    await db().insert(schema.organizations).values({ ownerUserId: user.id, name, domain: domain || null, website: website || null, dnsToken: randomToken(16) });
    return json({ ok: true });
  }
  const domainChanged = (existing.domain ?? '') !== domain;
  const nameChanged = existing.name !== name;
  await db()
    .update(schema.organizations)
    .set({
      name,
      domain: domain || null,
      website: website || null,
      // A verified badge covers a specific name and domain; changing either needs a fresh review.
      ...(domainChanged || (nameChanged && existing.status === 'verified')
        ? { status: 'unverified' as const, verifiedAt: null, dnsToken: domainChanged ? randomToken(16) : existing.dnsToken }
        : {}),
    })
    .where(eq(schema.organizations.id, existing.id));
  return json({ ok: true, reverify: domainChanged || (nameChanged && existing.status === 'verified') });
});
