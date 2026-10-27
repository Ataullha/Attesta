import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { formatMoney, packages } from '@/lib/site';
import {
  atSslcommerz,
  baseUrl,
  Browser,
  closeDb,
  postFromSslcommerz,
  signUp,
  signUpConfirmed,
  sql,
  sslcommerzMode,
  sslcommerzUrl,
  type Account,
} from './helpers';

afterAll(closeDb);
// A test that takes the stand-in down must not leave it down for the next.
afterEach(async () => {
  await sslcommerzMode({ init: 'ok', validation: 'ok' });
});

const growth = packages.find((p) => p.id === 'growth')!;
const creditsOf = async (email: string) => (await sql()`select credits from users where email = ${email}`)[0].credits as number;
const paymentOf = async (tranId: string) => (await sql()`select * from payments where method = 'sslcommerz' and trx_id = ${tranId}`)[0];
const auditOf = async (paymentId: string) => (await sql()`select action from audit_logs where target = ${paymentId} order by created_at`).map((r) => r.action as string);

/** Starts a checkout as the billing page does: the payment page to send the customer to, and our transaction id. */
async function checkout(account: Account, packageId = growth.id, phone = '01712 345678') {
  const res = await account.browser.post('/api/billing/checkout', { packageId, phone });
  expect(res.status, res.text).toBe(200);
  const [row] = await sql()`
    select trx_id from payments
    where method = 'sslcommerz' and user_id = (select id from users where email = ${account.email})
    order by created_at desc limit 1`;
  return { url: res.json.url as string, tranId: row.trx_id as string };
}

/** The customer's browser coming back from the payment page: where the app sends it, as a path. */
async function comeBack(url: string, fields: Record<string, string>) {
  const res = await postFromSslcommerz(url, fields);
  expect(res.status).toBe(303);
  const location = new URL(res.headers.get('location')!);
  expect(location.origin).toBe(baseUrl());
  return location.pathname + location.search;
}

const notify = async (ipn: string, fields: Record<string, string>) => {
  const res = await postFromSslcommerz(ipn, fields);
  return [res.status, await res.text()];
};

describe('paying online through SSLCommerz', () => {
  it('opens a checkout with the package, the customer and the addresses to come back to', async () => {
    const customer = await signUpConfirmed('online');
    const page = (await customer.browser.get('/app/billing')).text;
    expect(page).toContain('Pay online');
    expect(page).toContain(`Pay ${formatMoney(packages[0].price)} online`);

    const { url, tranId } = await checkout(customer);
    expect(tranId).toMatch(/^ATT[A-Z0-9]{16}$/);
    expect(url.startsWith(`${sslcommerzUrl()}/pay/`)).toBe(true);

    const session = (await (await fetch(`${sslcommerzUrl()}/__session?tranId=${tranId}`)).json()) as { fields: Record<string, string>; sessionkey: string };
    expect(session.fields).toMatchObject({
      total_amount: '5000.00',
      currency: 'BDT',
      cus_email: customer.email,
      cus_phone: '01712345678',
      success_url: `${baseUrl()}/api/billing/sslcommerz/success`,
      fail_url: `${baseUrl()}/api/billing/sslcommerz/fail`,
      cancel_url: `${baseUrl()}/api/billing/sslcommerz/cancel`,
      ipn_url: `${baseUrl()}/api/billing/sslcommerz/ipn`,
      product_profile: 'non-physical-goods',
      shipping_method: 'NO',
    });
    const row = await paymentOf(tranId);
    expect(row).toMatchObject({ status: 'pending', amount: growth.price, credits: growth.credits, sender: '01712345678' });
    expect(row.gateway.sessionkey).toBe(session.sessionkey);

    // The history says it is waiting, and the number is ready for next time.
    const after = (await customer.browser.get('/app/billing')).text;
    expect(after).toContain('Waiting for payment');
    expect(after).toContain('value="01712345678"');
  });

  it('adds the credits once when the customer comes back, however often SSLCommerz tells the app after', async () => {
    const customer = await signUpConfirmed('paid');
    const { tranId } = await checkout(customer);
    const back = await atSslcommerz(tranId, 'success');

    const landing = await comeBack(back.url, back.fields);
    expect(landing).toBe(`/app/billing?checkout=${tranId}`);
    expect(await creditsOf(customer.email)).toBe(growth.credits);
    expect(await notify(back.ipn, back.fields)).toEqual([200, 'OK']);
    expect(await notify(back.ipn, back.fields)).toEqual([200, 'OK']);
    await comeBack(back.url, back.fields); // the Back button and a resubmitted form
    expect(await creditsOf(customer.email)).toBe(growth.credits);

    const row = await paymentOf(tranId);
    expect(row.status).toBe('approved');
    expect(row.gateway).toMatchObject({ val_id: back.fields.val_id, card_type: 'BKASH-BKash', risk_level: '0' });
    expect(await auditOf(row.id)).toEqual(['payment.online.paid']);

    const page = (await customer.browser.get(landing)).text;
    expect(page).toContain('Payment received.');
    expect(page).toContain(`${growth.credits.toLocaleString()} certificates were added to your account.`);
    expect(page).toContain('Credits added');
    expect(page).toContain('Online · BKASH-BKash');
  });

  it('adds them once when the return and the notices arrive at the same moment', async () => {
    const customer = await signUpConfirmed('race');
    const { tranId } = await checkout(customer);
    const back = await atSslcommerz(tranId, 'success');
    await Promise.all([1, 2, 3].flatMap(() => [postFromSslcommerz(back.url, back.fields), postFromSslcommerz(back.ipn, back.fields)]));
    expect(await creditsOf(customer.email)).toBe(growth.credits);
    expect(await auditOf((await paymentOf(tranId)).id)).toEqual(['payment.online.paid']);
  });

  it('settles from SSLCommerz’s notice alone when the customer never comes back', async () => {
    const customer = await signUpConfirmed('ipn-only');
    const { tranId } = await checkout(customer, 'starter');
    const back = await atSslcommerz(tranId, 'success');
    expect(await notify(back.ipn, back.fields)).toEqual([200, 'OK']);
    expect(await creditsOf(customer.email)).toBe(packages[0].credits);
  });

  it('believes SSLCommerz’s validation API, never what is posted to it', async () => {
    const customer = await signUpConfirmed('forged');
    const { tranId } = await checkout(customer);
    const back = await atSslcommerz(tranId, 'success');

    // A validation id SSLCommerz never issued.
    await comeBack(back.url, { ...back.fields, val_id: 'FORGED1234567890' });
    // A real one, from someone else's cheaper payment.
    const other = await signUpConfirmed('forged-other');
    const theirs = await atSslcommerz((await checkout(other, 'starter')).tranId, 'success');
    await comeBack(back.url, { ...back.fields, val_id: theirs.fields.val_id });
    expect(await notify(back.ipn, { ...back.fields, val_id: theirs.fields.val_id })).toEqual([200, 'OK']);

    const row = await paymentOf(tranId);
    expect(row.status).toBe('pending');
    expect(row.gateway.val_id).toBeUndefined();
    expect(await creditsOf(customer.email)).toBe(0);
    expect(await auditOf(row.id)).toEqual(['payment.online.mismatch', 'payment.online.mismatch', 'payment.online.mismatch']);

    // The genuine one still counts.
    await comeBack(back.url, back.fields);
    expect(await creditsOf(customer.email)).toBe(growth.credits);
  });

  it('adds nothing when SSLCommerz took less than the package costs', async () => {
    const customer = await signUpConfirmed('short');
    const { tranId } = await checkout(customer);
    const back = await atSslcommerz(tranId, 'success', { amount: '50.00' });
    const landing = await comeBack(back.url, back.fields);
    expect(await creditsOf(customer.email)).toBe(0);
    const row = await paymentOf(tranId);
    expect(row.status).toBe('failed');
    expect(row.note).toMatch(/couldn’t confirm this payment/);
    expect(await auditOf(row.id)).toEqual(['payment.online.unconfirmed']);
    expect((await customer.browser.get(landing)).text).toContain('The payment didn’t go through.');
  });

  it('holds a payment SSLCommerz rates risky until an admin confirms it', async () => {
    const admin = await signUpConfirmed('online-admin');
    await sql()`update users set role = 'admin' where email = ${admin.email}`;
    const customer = await signUpConfirmed('risky');
    const { tranId } = await checkout(customer);
    const back = await atSslcommerz(tranId, 'success', { risky: true });
    const landing = await comeBack(back.url, back.fields);
    await notify(back.ipn, back.fields);

    expect(await creditsOf(customer.email)).toBe(0);
    const row = await paymentOf(tranId);
    expect(row).toMatchObject({ status: 'pending', note: expect.stringMatching(/checking this payment/) });
    expect(row.gateway).toMatchObject({ val_id: back.fields.val_id, risk_level: '1', risk_title: 'Not Safe' });
    expect((await customer.browser.get(landing)).text).toContain('We’re checking it before adding the credits');

    const queue = (await admin.browser.get('/admin/payments')).text;
    expect(queue).toContain(tranId);
    expect(queue).toContain('(held for review)');
    expect((await admin.browser.post(`/api/admin/payments/${row.id}`, { action: 'approve' })).status).toBe(200);
    expect(await creditsOf(customer.email)).toBe(growth.credits);
    await notify(back.ipn, back.fields); // a late notice changes nothing
    expect(await creditsOf(customer.email)).toBe(growth.credits);
  });

  it('keeps checkouts nobody has paid out of the admin queue, and out of the limit on payments to review', async () => {
    const admin = await signUpConfirmed('queue-admin');
    await sql()`update users set role = 'admin' where email = ${admin.email}`;
    const customer = await signUpConfirmed('unpaid');
    const { tranId } = await checkout(customer);
    expect((await admin.browser.get('/admin/payments')).text).not.toContain(tranId);
    expect((await admin.browser.get('/admin/payments?status=all')).text).toContain(tranId);
    const refused = await admin.browser.post(`/api/admin/payments/${(await paymentOf(tranId)).id}`, { action: 'approve' });
    expect(refused.status).toBe(409);
    expect(await creditsOf(customer.email)).toBe(0);

    for (const n of [1, 2, 3]) {
      const res = await customer.browser.post('/api/billing', { packageId: 'starter', method: 'bkash', trxId: `UNPAID${Date.now().toString(36)}${n}`, sender: '01700000000' });
      expect(res.status, res.text).toBe(200);
    }
  });

  it('closes a checkout that failed or was cancelled, and still counts a payment made after', async () => {
    const customer = await signUpConfirmed('retry');
    const { tranId } = await checkout(customer);
    const failed = await atSslcommerz(tranId, 'fail');
    const landing = await comeBack(failed.url, failed.fields);
    expect(landing).toBe(`/app/billing?checkout=${tranId}`);
    expect((await paymentOf(tranId)).status).toBe('failed');
    expect((await customer.browser.get(landing)).text).toContain('The payment didn’t go through.');

    // The customer tries another card on the same page, and it works.
    const paid = await atSslcommerz(tranId, 'success');
    await comeBack(paid.url, paid.fields);
    expect((await paymentOf(tranId)).status).toBe('approved');
    expect(await creditsOf(customer.email)).toBe(growth.credits);
    // A failure reported late doesn't undo it.
    expect(await notify(failed.ipn, failed.fields)).toEqual([200, 'OK']);
    expect((await paymentOf(tranId)).status).toBe('approved');

    const second = await checkout(customer, 'starter');
    const cancelled = await atSslcommerz(second.tranId, 'cancel');
    const back = await comeBack(cancelled.url, cancelled.fields);
    expect(await paymentOf(second.tranId)).toMatchObject({ status: 'cancelled', note: 'Cancelled on the payment page.' });
    expect((await customer.browser.get(back)).text).toContain('The payment wasn’t completed.');
    expect(await creditsOf(customer.email)).toBe(growth.credits);
  });

  it('waits when SSLCommerz cannot be asked, and settles once it can', async () => {
    const customer = await signUpConfirmed('down');
    const { tranId } = await checkout(customer);
    const back = await atSslcommerz(tranId, 'success');
    await sslcommerzMode({ validation: 'down' });

    const landing = await comeBack(back.url, back.fields);
    expect((await paymentOf(tranId)).status).toBe('pending');
    const page = (await customer.browser.get(landing)).text;
    expect(page).toContain('Waiting for SSLCommerz to confirm the payment.');
    expect(page).toContain('Check again');
    // Not acknowledged, so SSLCommerz sends the notice again later.
    expect((await notify(back.ipn, back.fields))[0]).toBe(503);

    await sslcommerzMode({ validation: 'ok' });
    expect(await notify(back.ipn, back.fields)).toEqual([200, 'OK']);
    expect(await creditsOf(customer.email)).toBe(growth.credits);
  });

  it('says so, and keeps nothing, when SSLCommerz will not open a checkout', async () => {
    const customer = await signUpConfirmed('refused');
    await sslcommerzMode({ init: 'fail' });
    const res = await customer.browser.post('/api/billing/checkout', { packageId: 'starter', phone: '01712345678' });
    expect(res.status).toBe(502);
    expect(res.json.error).toMatch(/couldn’t be opened/);
    expect(await sql()`select 1 from payments where user_id = (select id from users where email = ${customer.email})`).toHaveLength(0);
  });

  it('keeps one checkout open at a time, and still counts an earlier one that is paid', async () => {
    const customer = await signUpConfirmed('two-tabs');
    const first = await checkout(customer);
    const second = await checkout(customer, 'starter');
    expect((await paymentOf(first.tranId)).status).toBe('cancelled');
    expect((await paymentOf(second.tranId)).status).toBe('pending');

    const back = await atSslcommerz(first.tranId, 'success');
    await comeBack(back.url, back.fields);
    expect((await paymentOf(first.tranId)).status).toBe('approved');
    expect(await creditsOf(customer.email)).toBe(growth.credits);
  });

  it('needs a confirmed address, a session, a request from this site and a phone number', async () => {
    const unconfirmed = await signUp('online-unconfirmed');
    expect((await unconfirmed.browser.post('/api/billing/checkout', { packageId: 'starter', phone: '01712345678' })).status).toBe(403);
    expect((await new Browser().post('/api/billing/checkout', { packageId: 'starter', phone: '01712345678' })).status).toBe(401);
    const customer = await signUpConfirmed('online-checks');
    const crossSite = await customer.browser.post('/api/billing/checkout', { packageId: 'starter', phone: '01712345678' }, { sameOrigin: false, headers: { 'Sec-Fetch-Site': 'cross-site' } });
    expect(crossSite.status).toBe(403);
    const noPhone = await customer.browser.post('/api/billing/checkout', { packageId: 'starter', phone: 'call me' });
    expect([noPhone.status, noPhone.json.error]).toEqual([400, 'Enter your mobile number, for example 01712345678.']);
    expect((await customer.browser.post('/api/billing/checkout', { packageId: 'platinum', phone: '01712345678' })).status).toBe(400);
  });

  it('answers only at its four return addresses, and changes nothing for a visit by link', async () => {
    expect((await postFromSslcommerz(`${baseUrl()}/api/billing/sslcommerz/refund`, { tran_id: 'ATTXXXXXXXXXXXXXXXX' })).status).toBe(404);
    expect((await fetch(`${baseUrl()}/api/billing/sslcommerz/ipn`)).status).toBe(404);
    const visit = await fetch(`${baseUrl()}/api/billing/sslcommerz/success?tran_id=ATT2345`, { redirect: 'manual' });
    expect(visit.status).toBe(303);
    expect(visit.headers.get('location')).toBe(`${baseUrl()}/app/billing`);
    const noId = await postFromSslcommerz(`${baseUrl()}/api/billing/sslcommerz/success`, { status: 'VALID' });
    expect(noId.headers.get('location')).toBe(`${baseUrl()}/app/billing`);
  });
});

describe('the daily check of unfinished checkouts', () => {
  let paidLost: string;
  let abandoned: string;
  let recent: string;
  let customer: Account;

  beforeAll(async () => {
    customer = await signUpConfirmed('stale');
    paidLost = (await checkout(customer)).tranId;
    // Paid, but neither the customer's return nor SSLCommerz's notice ever arrived.
    await atSslcommerz(paidLost, 'success');
    // Each new checkout closes the one before, so these two are put back as they were left.
    abandoned = (await checkout(customer, 'starter')).tranId;
    recent = (await checkout(customer, 'starter')).tranId;
    await sql()`update payments set status = 'pending', created_at = now() - interval '400 days' where trx_id in (${paidLost}, ${abandoned})`;
    await sql()`update payments set status = 'pending' where trx_id = ${recent}`;
  });

  it('settles the ones SSLCommerz was paid for and closes the rest, leaving recent ones alone', async () => {
    const res = await fetch(`${baseUrl()}/api/cron/cleanup`, { headers: { authorization: 'Bearer e2e-cron-secret' } });
    expect(res.status).toBe(200);
    expect(await paymentOf(paidLost)).toMatchObject({ status: 'approved' });
    expect(await creditsOf(customer.email)).toBe(growth.credits);
    expect(await paymentOf(abandoned)).toMatchObject({ status: 'cancelled', note: null });
    expect(await paymentOf(recent)).toMatchObject({ status: 'pending' });
  });
});
