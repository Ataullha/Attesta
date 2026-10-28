import 'server-only';
import { and, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/security/rate-limit';
import { site } from '@/lib/site';
import { fetchValidation, findValidPayment, judgeValidation, sslcommerzConfigured, type Validation } from './sslcommerz';

/** The method stored on payments made through SSLCommerz. */
export const ONLINE = 'sslcommerz';

const p = schema.payments;
type Payment = typeof p.$inferSelect;

const valId = sql`${p.gateway}->>'val_id'`;

/** An online checkout that was opened but that SSLCommerz has not confirmed a payment for. */
export const unpaidCheckout = sql`(${p.method} = ${ONLINE} and ${valId} is null)`;

/** Payments for a person to look at: manual ones, and online ones SSLCommerz held as risky. */
export const awaitingReview = sql<boolean>`(${p.status} = 'pending' and not ${unpaidCheckout})`;

/** A checkout that a confirmed payment may still settle: unpaid, or closed as failed or cancelled. */
const settleable = or(inArray(p.status, ['failed', 'cancelled']), and(eq(p.status, 'pending'), isNull(valId)));

/** What the customer reads beside an online payment in their history. */
export const onlineNotes = {
  held: 'Paid online. We’re checking this payment before adding the credits, usually within a working day.',
  unconfirmed: `SSLCommerz couldn’t confirm this payment, so no credits were added. If money left your account, write to ${site.supportEmail}.`,
  cancelled: 'Cancelled on the payment page.',
};

export type Settled = 'paid' | 'held' | 'failed' | 'unknown';

function settledState(payment: Payment): Settled | null {
  if (payment.status === 'approved') return 'paid';
  if (payment.status === 'rejected') return 'failed';
  if (payment.status === 'pending' && payment.gateway?.val_id) return 'held';
  return null;
}

const KEPT = ['val_id', 'amount', 'store_amount', 'bank_tran_id', 'card_type', 'card_brand', 'card_issuer', 'risk_level', 'risk_title', 'tran_date'] as const;

/** What is kept of SSLCommerz's answer, for the admin page and for support. */
function gatewayRecord(previous: Record<string, string> | null, v: Validation) {
  const out: Record<string, string> = { ...previous, validation: String(v.status ?? '') };
  for (const k of KEPT) if (v[k] != null && v[k] !== '') out[k] = String(v[k]).slice(0, 200);
  return out;
}

/**
 * Settles an online payment from what SSLCommerz's validation API says about it, the one source
 * trusted here: what is posted to our callbacks could come from anyone. The customer's return from
 * the payment page and SSLCommerz's server-to-server notice (IPN) both land here, often at the same
 * moment, so every change is conditional on the state it moves from. Credits are added once, and a
 * payment already confirmed, held for review or rejected by an admin stays as it is.
 *
 * Throws GatewayError when SSLCommerz cannot be asked, so the caller can try again later.
 */
export async function settleOnline(tranId: string, givenValId: string): Promise<Settled> {
  const [payment] = await db().select().from(p).where(and(eq(p.method, ONLINE), eq(p.trxId, tranId))).limit(1);
  if (!payment) return 'unknown';
  const already = settledState(payment);
  if (already) return already;
  // Each check is a request to SSLCommerz, so a stream of made-up validation ids for one checkout is cut off.
  await rateLimit(`sslcommerz:${payment.id}`, 20, 3600);
  const v = await fetchValidation(givenValId);
  if ((v.tran_id ?? '').trim() !== payment.trxId) {
    // An unknown validation id, or one for another payment: it says nothing about this one.
    await audit(null, 'payment.online.mismatch', payment.id, { valId: givenValId, reported: v.tran_id ?? null, status: v.status ?? null });
    return 'unknown';
  }
  const verdict = judgeValidation(v, { tranId: payment.trxId, amount: payment.amount, currency: payment.currency });
  const gateway = gatewayRecord(payment.gateway, v);
  const thisOne = eq(p.id, payment.id);

  if (verdict.outcome === 'paid') {
    const done = await db().transaction(async (tx) => {
      const [row] = await tx.update(p).set({ status: 'approved', note: null, gateway, reviewedAt: new Date() }).where(and(thisOne, settleable)).returning();
      if (row) await tx.update(schema.users).set({ credits: sql`${schema.users.credits} + ${row.credits}` }).where(eq(schema.users.id, row.userId));
      return row;
    });
    if (done) {
      await audit(null, 'payment.online.paid', payment.id, { valId: v.val_id, amount: v.amount, card: v.card_type ?? null });
      return 'paid';
    }
    // Settled by the other notice in the meantime.
    const [now] = await db().select().from(p).where(thisOne);
    return (now && settledState(now)) ?? 'unknown';
  }

  if (verdict.outcome === 'held') {
    const [row] = await db().update(p).set({ status: 'pending', note: onlineNotes.held, gateway }).where(and(thisOne, settleable)).returning({ id: p.id });
    if (row) await audit(null, 'payment.online.held', payment.id, { valId: v.val_id, reason: verdict.reason });
    return 'held';
  }

  // SSLCommerz knows the payment but does not call it paid: failed, cancelled, or not what we asked for.
  await db().update(p).set({ status: 'failed', note: onlineNotes.unconfirmed, gateway }).where(and(thisOne, eq(p.status, 'pending'), isNull(valId)));
  await audit(null, 'payment.online.unconfirmed', payment.id, { valId: givenValId, reason: verdict.reason });
  return 'failed';
}

/**
 * Closes a checkout that SSLCommerz says failed, or that was cancelled or abandoned. Only one with no
 * confirmed payment changes: a payment SSLCommerz has confirmed always wins over a report like this.
 */
export async function closeCheckout(tranId: string, status: 'failed' | 'cancelled', note: string | null = null) {
  const [row] = await db()
    .update(p)
    .set({ status, note })
    .where(and(eq(p.method, ONLINE), eq(p.trxId, tranId), eq(p.status, 'pending'), isNull(valId)))
    .returning({ id: p.id });
  return !!row;
}

/**
 * Closes checkouts left unpaid for a day. SSLCommerz is asked about each one first, in case it took a
 * payment whose notices never arrived; one it cannot answer about is left for the next run.
 */
export async function closeStaleCheckouts() {
  const stale = await db()
    .select({ trxId: p.trxId })
    .from(p)
    .where(and(eq(p.status, 'pending'), unpaidCheckout, lt(p.createdAt, sql`now() - interval '1 day'`)))
    .orderBy(p.createdAt)
    .limit(50);
  const deadline = Date.now() + 20_000;
  const counts = { settled: 0, closed: 0 };
  for (const { trxId } of stale) {
    if (Date.now() > deadline) break;
    try {
      const found = sslcommerzConfigured() ? await findValidPayment(trxId) : null;
      if (found) {
        if ((await settleOnline(trxId, found)) !== 'unknown') counts.settled++;
      } else if (await closeCheckout(trxId, 'cancelled')) {
        counts.closed++;
      }
    } catch (err) {
      console.error(`Checkout ${trxId} could not be checked with SSLCommerz`, err);
    }
  }
  return counts;
}
