import { NextResponse } from 'next/server';
import { site } from '@/lib/site';
import { sslcommerzConfigured } from '@/lib/payments/sslcommerz';
import { closeCheckout, onlineNotes, settleOnline } from '@/lib/payments/online';

type Ctx = { params: Promise<{ event: string }> };

const EVENTS = ['success', 'fail', 'cancel', 'ipn'];
const TRAN_ID = /^[A-Z0-9]{8,30}$/;
const VAL_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** The customer's way back: their billing page, which shows how this checkout ended. */
function backToBilling(tranId: string | null) {
  return NextResponse.redirect(`${site.url}/app/billing${tranId ? `?checkout=${tranId}` : ''}`, 303);
}

/**
 * SSLCommerz posts here: the customer's browser on its way back from the payment page (success, fail,
 * cancel), and SSLCommerz's own server with its payment notice (ipn). Neither comes from this site, so
 * there is no same-origin check and no session. What is posted only points to a checkout; whether it
 * was paid is asked of SSLCommerz's validation API before any credits are added.
 */
export async function POST(req: Request, ctx: Ctx) {
  const { event } = await ctx.params;
  if (!sslcommerzConfigured() || !EVENTS.includes(event)) return new Response('Not found', { status: 404 });
  let form: FormData;
  try {
    if (Number(req.headers.get('content-length') ?? 0) > 32_000) throw new Error('Too large');
    form = await req.formData();
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === 'string' ? value.trim() : '';
  };
  const tranId = TRAN_ID.test(field('tran_id')) ? field('tran_id') : null;
  const valId = VAL_ID.test(field('val_id')) ? field('val_id') : null;
  const status = field('status').toUpperCase();

  if (event === 'ipn') {
    if (!tranId) return new Response('OK');
    try {
      if ((status === 'VALID' || status === 'VALIDATED') && valId) await settleOnline(tranId, valId);
      else if (status === 'FAILED') await closeCheckout(tranId, 'failed');
      else if (status === 'CANCELLED') await closeCheckout(tranId, 'cancelled', onlineNotes.cancelled);
      else if (status === 'UNATTEMPTED' || status === 'EXPIRED') await closeCheckout(tranId, 'cancelled');
    } catch (err) {
      console.error('SSLCommerz notice not settled', err);
      // SSLCommerz sends the notice again when it isn't acknowledged.
      return new Response('Try again later', { status: 503 });
    }
    return new Response('OK');
  }

  if (tranId) {
    try {
      if (event === 'success') {
        if (valId) await settleOnline(tranId, valId);
      } else if (event === 'fail') {
        await closeCheckout(tranId, 'failed');
      } else {
        await closeCheckout(tranId, 'cancelled', onlineNotes.cancelled);
      }
    } catch (err) {
      // The notice or the daily check settles it later; meanwhile the billing page says it is waiting.
      console.error(`SSLCommerz return (${event}) not settled`, err);
    }
  }
  return backToBilling(tranId);
}

/** Arriving by a link rather than from the payment page changes nothing. */
export async function GET(req: Request, ctx: Ctx) {
  const { event } = await ctx.params;
  if (!sslcommerzConfigured() || event === 'ipn' || !EVENTS.includes(event)) return new Response('Not found', { status: 404 });
  const tranId = new URL(req.url).searchParams.get('tran_id') ?? '';
  return backToBilling(TRAN_ID.test(tranId) ? tranId : null);
}
