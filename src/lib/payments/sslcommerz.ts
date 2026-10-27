import 'server-only';
import { randomBytes } from 'node:crypto';
import { site, type PackageDef } from '@/lib/site';

/**
 * Online payment through SSLCommerz: cards, bKash, Nagad, Rocket, Upay and internet banking on one
 * page that SSLCommerz hosts. On when both store settings are present.
 */
export function sslcommerzConfigured() {
  return !!(process.env.SSLCOMMERZ_STORE_ID && process.env.SSLCOMMERZ_STORE_PASSWORD);
}

/** The sandbox unless SSLCOMMERZ_LIVE is "true". Overridable so the end-to-end tests can stand in for SSLCommerz. */
export function sslcommerzBase() {
  const base = process.env.SSLCOMMERZ_API_URL || (process.env.SSLCOMMERZ_LIVE === 'true' ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com');
  return base.replace(/\/$/, '');
}

export class GatewayError extends Error {}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Our id for one checkout, sent as tran_id: unguessable, and well inside SSLCommerz's 30 characters. */
export function newTranId() {
  let id = 'ATT';
  // 32 symbols divide 256 evenly, so every symbol is equally likely.
  for (const b of randomBytes(16)) id += ALPHABET[b % 32];
  return id;
}

export type GatewayEvent = 'success' | 'fail' | 'cancel' | 'ipn';
export const callbackUrl = (event: GatewayEvent) => `${site.url}/api/billing/sslcommerz/${event}`;

type Customer = { name: string; email: string; phone: string };

/**
 * The fields SSLCommerz's session API requires. It asks for an address as well, but credits are
 * digital and nothing is shipped, so the customer is not asked for one and the fields say so.
 */
export function sessionFields(tranId: string, pkg: PackageDef, customer: Customer): Record<string, string> {
  return {
    store_id: process.env.SSLCOMMERZ_STORE_ID ?? '',
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD ?? '',
    tran_id: tranId,
    total_amount: pkg.price.toFixed(2),
    currency: pkg.currency,
    success_url: callbackUrl('success'),
    fail_url: callbackUrl('fail'),
    cancel_url: callbackUrl('cancel'),
    ipn_url: callbackUrl('ipn'),
    cus_name: customer.name,
    cus_email: customer.email,
    cus_phone: customer.phone,
    cus_add1: 'Not collected',
    cus_city: 'Not collected',
    cus_postcode: '0000',
    cus_country: 'Bangladesh',
    shipping_method: 'NO',
    num_of_item: '1',
    product_name: `${site.name} ${pkg.name} package: ${pkg.credits} certificates`,
    product_category: 'Digital service',
    product_profile: 'non-physical-goods',
  };
}

/** Opens a checkout session; the customer is then sent to the returned page to pay. */
export async function startSession(tranId: string, pkg: PackageDef, customer: Customer) {
  const form = new FormData();
  for (const [key, value] of Object.entries(sessionFields(tranId, pkg, customer))) form.append(key, value);
  let res: Response;
  try {
    res = await fetch(`${sslcommerzBase()}/gwprocess/v4/api.php`, { method: 'POST', body: form, signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw new GatewayError(`SSLCommerz could not be reached: ${(err as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as { status?: string; failedreason?: string; sessionkey?: string; GatewayPageURL?: string };
  if (!res.ok || body.status !== 'SUCCESS') throw new GatewayError(`SSLCommerz did not open a session: ${body.failedreason || `HTTP ${res.status}`}`);
  // The customer is sent to this address, so it has to be SSLCommerz's own page.
  const page = URL.canParse(body.GatewayPageURL ?? '') ? new URL(body.GatewayPageURL!) : null;
  if (!page || (page.protocol !== 'https:' && page.origin !== new URL(sslcommerzBase()).origin)) {
    throw new GatewayError(`SSLCommerz sent an unusable payment page address: ${body.GatewayPageURL ?? 'none'}`);
  }
  return { gatewayUrl: page.href, sessionkey: body.sessionkey ?? '' };
}

/** What SSLCommerz's order validation API reports about one payment. */
export type Validation = {
  status?: string;
  tran_id?: string;
  val_id?: string;
  amount?: string;
  store_amount?: string;
  currency?: string;
  currency_type?: string;
  tran_date?: string;
  bank_tran_id?: string;
  card_type?: string;
  card_brand?: string;
  card_issuer?: string;
  risk_level?: string;
  risk_title?: string;
};

/** A GET to SSLCommerz's validation service. Throws GatewayError when it gives no usable answer. */
async function askSslcommerz(path: string, query: Record<string, string>) {
  const url = new URL(`${sslcommerzBase()}${path}`);
  url.search = new URLSearchParams({
    ...query,
    store_id: process.env.SSLCOMMERZ_STORE_ID ?? '',
    store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD ?? '',
    v: '1',
    format: 'json',
  }).toString();
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch (err) {
    throw new GatewayError(`SSLCommerz could not be reached: ${(err as Error).message}`);
  }
  if (!res.ok) throw new GatewayError(`SSLCommerz answered HTTP ${res.status}`);
  const body = (await res.json().catch(() => null)) as (Record<string, unknown> & { APIConnect?: string }) | null;
  if (!body) throw new GatewayError('SSLCommerz sent an answer that is not JSON');
  // DONE means the store was recognised; anything else (bad credentials, an inactive store) says nothing about the payment.
  if (body.APIConnect && body.APIConnect !== 'DONE') throw new GatewayError(`SSLCommerz refused the request: ${body.APIConnect}`);
  return body;
}

/** What SSLCommerz says about the payment behind a validation id. */
export async function fetchValidation(valId: string) {
  return (await askSslcommerz('/validator/api/validationserverAPI.php', { val_id: valId })) as Validation;
}

/**
 * Looks a checkout up by our transaction id, for when SSLCommerz's notices about it never arrived:
 * the validation id of a payment that went through, or null when there is none.
 */
export async function findValidPayment(tranId: string) {
  const body = await askSslcommerz('/validator/api/merchantTransIDvalidationAPI.php', { tran_id: tranId });
  const found = Array.isArray(body.element) ? (body.element as Validation[]) : [];
  return found.find((e) => (e.status === 'VALID' || e.status === 'VALIDATED') && e.val_id)?.val_id ?? null;
}

export type Verdict = { outcome: 'paid' | 'held' | 'invalid'; reason?: string };

/**
 * Whether a validated payment is the one we asked for, checked as SSLCommerz's own libraries check
 * it: the status, our transaction id, and the amount to within a taka (in BDT, its own currency).
 * A payment SSLCommerz rates risky (risk level 1) went through, but is held for a person to look at
 * before any credits are added.
 */
export function judgeValidation(v: Validation, expected: { tranId: string; amount: number; currency: string }): Verdict {
  if (v.status !== 'VALID' && v.status !== 'VALIDATED') return { outcome: 'invalid', reason: `status ${v.status ?? 'missing'}` };
  if ((v.tran_id ?? '').trim() !== expected.tranId) return { outcome: 'invalid', reason: 'a different transaction' };
  const currency = (v.currency_type ?? '').trim();
  if (currency && currency !== expected.currency) return { outcome: 'invalid', reason: `currency ${currency}` };
  const amount = Number(v.amount);
  if (!v.amount || !Number.isFinite(amount) || Math.abs(amount - expected.amount) >= 1) return { outcome: 'invalid', reason: `amount ${v.amount ?? 'missing'}` };
  if (String(v.risk_level ?? '').trim() === '1') return { outcome: 'held', reason: v.risk_title?.trim() || 'rated risky by SSLCommerz' };
  return { outcome: 'paid' };
}
