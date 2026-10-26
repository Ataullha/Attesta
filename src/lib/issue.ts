import 'server-only';
import { and, count, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { canonicalJson, hasLocalImages, referencedAssetIds, type Design } from './design';
import { cleanValues } from './values';
import { newGuestSerial, newSerial, signPayload, verifyUrl } from './signing';
import { sha256Hex } from './security/crypto';
import { HttpError } from './security/request';
import { limits } from './site';
import type { SessionUser } from './auth/session';

export type IssueResult = { serial: string; verifyUrl: string }[];

type IssueInput = {
  design: Design;
  templateId: string | null;
  batchId: string | null;
  batchName: string;
  mode: 'single' | 'bulk';
  recipients: { values: Record<string, unknown> }[];
};

function monthStart() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** When this month's free certificates come back: the start of next month, by the same clock as the count. */
export function freeRenewsOn() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

export async function usageThisMonth(userId: string) {
  const rows = await db()
    .select({ n: count() })
    .from(schema.certificates)
    .where(and(eq(schema.certificates.userId, userId), gte(schema.certificates.issuedAt, monthStart())));
  return Number(rows[0]?.n ?? 0);
}

export async function issueForUser(user: SessionUser, input: IssueInput): Promise<{ batchId: string; issued: IssueResult }> {
  const { design, recipients, mode } = input;
  if (recipients.length < 1) throw new HttpError(400, 'Add at least one recipient.');
  if (recipients.length > limits.issueChunk) throw new HttpError(400, `Send at most ${limits.issueChunk} recipients per request.`);
  if (mode === 'single' && recipients.length !== 1) throw new HttpError(400, 'Single issue takes exactly one recipient.');
  if (hasLocalImages(design)) throw new HttpError(400, 'Some images on this design were never uploaded. Sign in again and re-add them.');

  // Every image the design points at must belong to this user.
  const assetIds = referencedAssetIds(design);
  if (assetIds.length) {
    const owned = await db()
      .select({ id: schema.assets.id })
      .from(schema.assets)
      .where(and(eq(schema.assets.userId, user.id), inArray(schema.assets.id, assetIds)));
    if (owned.length !== assetIds.length) throw new HttpError(403, 'This design uses an image that is not in your library.');
  }

  const issuedAt = new Date();
  const cleaned = recipients.map((r, i) => {
    const res = cleanValues(design, r.values ?? {}, issuedAt);
    if (!res.ok) throw new HttpError(400, `Recipient ${i + 1}: ${res.errors.join('; ')}`);
    return res.values;
  });

  const designHash = sha256Hex(canonicalJson(design));
  const publicKeys = design.fields.filter((f) => f.public && f.type !== 'email').map((f) => f.key);
  const emailKey = design.fields.find((f) => f.type === 'email')?.key;

  return db().transaction(async (tx) => {
    // Lock the user row so two parallel requests can't both spend the same allowance.
    const [u] = await tx.select().from(schema.users).where(eq(schema.users.id, user.id)).for('update');
    if (!u || u.bannedAt) throw new HttpError(403, 'This account cannot issue certificates.');

    const [{ n: usedRaw }] = await tx
      .select({ n: count() })
      .from(schema.certificates)
      .where(and(eq(schema.certificates.userId, user.id), gte(schema.certificates.issuedAt, monthStart())));
    const used = Number(usedRaw);
    const freeLeft = Math.max(0, limits.freeMonthly - used);

    if (mode === 'bulk' && u.credits <= 0) {
      throw new HttpError(402, 'Bulk issuing is part of the paid packages. Buy a package to continue.', 'needs_package');
    }
    const needed = cleaned.length;
    if (needed > freeLeft + u.credits) {
      throw new HttpError(
        402,
        u.credits > 0
          ? `This needs ${needed} certificates but you have ${freeLeft + u.credits} left. Top up your package to continue.`
          : `You have used your ${limits.freeMonthly} free certificates this month. Buy a package to issue more.`,
        'quota_exceeded',
      );
    }
    const fromCredits = Math.max(0, needed - freeLeft);

    const [org] = await tx.select().from(schema.organizations).where(eq(schema.organizations.ownerUserId, user.id)).limit(1);
    const issuerName = org?.name ?? u.name;

    let batchId = input.batchId;
    if (batchId) {
      const [b] = await tx
        .select({ id: schema.batches.id, designHash: schema.batches.designHash })
        .from(schema.batches)
        .where(and(eq(schema.batches.id, batchId), eq(schema.batches.userId, user.id)))
        .limit(1);
      if (!b) throw new HttpError(404, 'That batch does not exist.');
      if (b.designHash !== designHash) throw new HttpError(409, 'The design changed in the middle of a batch. Start a new batch.');
    } else {
      const [b] = await tx
        .insert(schema.batches)
        .values({
          userId: user.id,
          orgId: org?.id ?? null,
          templateId: input.templateId,
          name: input.batchName.slice(0, 120) || 'Certificates',
          design,
          designHash,
          mode,
        })
        .returning({ id: schema.batches.id });
      batchId = b.id;
    }

    const rows = cleaned.map((values) => {
      const serial = newSerial();
      const fields: Record<string, string> = {};
      for (const k of publicKeys) fields[k] = values[k] ?? '';
      const payload = canonicalJson({
        v: 1,
        serial,
        issued_at: issuedAt.toISOString(),
        issuer: { id: user.id, org: org?.id ?? null, name: issuerName },
        recipient: values.recipient_name,
        fields,
        design: designHash,
      });
      return {
        serial,
        batchId: batchId!,
        userId: user.id,
        orgId: org?.id ?? null,
        recipientName: values.recipient_name,
        recipientEmail: emailKey ? values[emailKey] || null : null,
        values,
        nameDisplay: design.settings.nameDisplay,
        indexable: design.settings.indexable,
        payload,
        issuedAt,
        ...signPayload(payload),
      };
    });

    await tx.insert(schema.certificates).values(rows);
    await tx
      .update(schema.batches)
      .set({ count: sql`${schema.batches.count} + ${rows.length}` })
      .where(eq(schema.batches.id, batchId!));
    if (fromCredits > 0) {
      await tx
        .update(schema.users)
        .set({ credits: sql`${schema.users.credits} - ${fromCredits}` })
        .where(eq(schema.users.id, user.id));
    }

    return { batchId: batchId!, issued: rows.map((r) => ({ serial: r.serial, verifyUrl: verifyUrl(r.serial) })) };
  });
}

/** Guests get a watermarked, unregistered certificate. Counting happens here, on the server. */
export async function issueForGuest(guestId: string, ipHash: string, design: Design, raw: Record<string, unknown>) {
  const res = cleanValues(design, raw);
  if (!res.ok) throw new HttpError(400, res.errors.join('; '));

  const since = new Date(Date.now() - 86400_000);
  const [byGuest] = await db().select({ n: count() }).from(schema.guestUsage).where(eq(schema.guestUsage.guestId, guestId));
  const [byIp] = await db()
    .select({ n: count() })
    .from(schema.guestUsage)
    .where(and(eq(schema.guestUsage.ipHash, ipHash), gte(schema.guestUsage.createdAt, since)));
  if (Number(byGuest.n) >= limits.guestLifetime || Number(byIp.n) >= limits.guestPerIpPerDay) {
    throw new HttpError(
      402,
      `You've made your ${limits.guestLifetime} free guest certificates. Create a free account for ${limits.freeMonthly} verifiable certificates a month.`,
      'guest_limit',
    );
  }
  await db().insert(schema.guestUsage).values({ guestId, ipHash });
  const serial = newGuestSerial();
  return { serial, verifyUrl: verifyUrl(serial), values: res.values, remaining: limits.guestLifetime - Number(byGuest.n) - 1 };
}
