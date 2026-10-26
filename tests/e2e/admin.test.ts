import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser, closeDb, issue, signIn, signUp, signUpConfirmed, sql, type Account } from './helpers';

afterAll(closeDb);

const userId = async (email: string) => (await sql()`select id from users where email = ${email}`)[0].id as string;
const creditsOf = async (email: string) => (await sql()`select credits from users where email = ${email}`)[0].credits as number;

describe('the admin API', () => {
  let admin: Account;
  let member: Account;
  let memberId = '';

  beforeAll(async () => {
    admin = await signUpConfirmed('admin');
    await sql()`update users set role = 'admin' where email = ${admin.email}`;
    member = await signUpConfirmed('member');
    memberId = await userId(member.email);
  });

  const act = (action: Record<string, unknown>) => admin.browser.post(`/api/admin/users/${memberId}`, action);

  it('turns away ordinary accounts and signed-out visitors', async () => {
    expect((await member.browser.post(`/api/admin/users/${memberId}`, { action: 'credits', amount: 5 })).status).toBe(403);
    expect((await new Browser().post(`/api/admin/users/${memberId}`, { action: 'credits', amount: 5 })).status).toBe(401);
    expect(await creditsOf(member.email)).toBe(0);
  });

  it('adds and removes credits, and never goes below zero', async () => {
    expect((await act({ action: 'credits', amount: 12 })).status).toBe(200);
    expect(await creditsOf(member.email)).toBe(12);
    await act({ action: 'credits', amount: -5 });
    expect(await creditsOf(member.email)).toBe(7);
    await act({ action: 'credits', amount: -1000 });
    expect(await creditsOf(member.email)).toBe(0);
  });

  it('refuses an amount that is not a whole number or is absurdly large', async () => {
    expect((await act({ action: 'credits', amount: 1.5 })).status).toBe(400);
    expect((await act({ action: 'credits', amount: 5_000_000 })).status).toBe(400);
    expect((await act({ action: 'credits', amount: '12' })).status).toBe(400);
    expect(await creditsOf(member.email)).toBe(0);
  });

  it('suspends an account, which signs it out everywhere and keeps it out until it is restored', async () => {
    const elsewhere = (await signIn(member)).browser;
    expect((await act({ action: 'ban' })).status).toBe(200);
    expect((await member.browser.get('/app')).status).toBe(307);
    expect((await elsewhere.get('/app')).status).toBe(307);
    const refused = await signIn(member);
    expect(refused.reply.status).toBe(403);
    expect(refused.reply.json.error).toMatch(/suspended/);

    expect((await act({ action: 'unban' })).status).toBe(200);
    expect((await signIn(member, member.browser)).reply.status).toBe(200); // and the browser that was signed out can sign in again
  });

  it('cannot suspend itself', async () => {
    const res = await admin.browser.post(`/api/admin/users/${await userId(admin.email)}`, { action: 'ban' });
    expect([res.status, res.json.error]).toEqual([400, 'You cannot suspend your own account.']);
  });

  it('confirms an address by hand, which unlocks issuing', async () => {
    const stuck = await signUp('stuck'); // never opened its confirmation link
    expect((await issue(stuck.browser, ['Waiting Person'])).status).toBe(403);
    expect((await admin.browser.post(`/api/admin/users/${await userId(stuck.email)}`, { action: 'verify-email' })).status).toBe(200);
    expect((await issue(stuck.browser, ['Waiting Person'])).status).toBe(200);
  });

  it('records what an administrator did, and to whom', async () => {
    const rows = await sql()`select action, target from audit_logs where actor_user_id = ${await userId(admin.email)} order by created_at`;
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['admin.user.credits', 'admin.user.ban', 'admin.user.unban', 'admin.user.verify-email']));
    expect(rows.find((r) => r.action === 'admin.user.ban')!.target).toBe(memberId);
  });

  it('revokes someone else’s certificate with a reason that the public page shows', async () => {
    const { serial } = (await issue(member.browser, ['Wrongly Issued'])).json.issued[0];
    expect((await member.browser.post(`/api/admin/certificates/${serial}`, { action: 'revoke', reason: 'Reported as fraudulent' })).status).toBe(403);
    expect((await admin.browser.post(`/api/admin/certificates/${serial}`, { action: 'revoke', reason: 'no' })).status).toBe(400);
    expect((await admin.browser.post(`/api/admin/certificates/${serial}`, { action: 'revoke', reason: 'Reported as fraudulent' })).status).toBe(200);
    const page = await new Browser().get(`/verify/${serial}`);
    expect(page.text).toContain('This certificate was revoked');
    expect(page.text).toContain('Reported as fraudulent');
  });
});

describe('payments', () => {
  let admin: Account;
  beforeAll(async () => {
    admin = await signUpConfirmed('payments-admin');
    await sql()`update users set role = 'admin' where email = ${admin.email}`;
  });

  const pay = (account: Account, trxId: string) => account.browser.post('/api/billing', { packageId: 'starter', method: 'bkash', trxId, sender: '01700000000' });
  const paymentId = async (trxId: string) => (await sql()`select id from payments where trx_id = ${trxId.toUpperCase()}`)[0].id as string;
  const trx = (label: string) => `${label}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();

  it('adds a package’s credits once, however many times the payment is confirmed', async () => {
    const customer = await signUpConfirmed('customer');
    const trxId = trx('OK');
    expect((await pay(customer, trxId)).status).toBe(200);
    const id = await paymentId(trxId);
    const confirmations = await Promise.all([1, 2, 3].map(() => admin.browser.post(`/api/admin/payments/${id}`, { action: 'approve' })));
    expect(confirmations.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(await creditsOf(customer.email)).toBe(500);
    expect((await customer.browser.get('/app/billing')).text).toContain('Credits added');
  });

  it('shows the customer why a payment was not confirmed', async () => {
    const customer = await signUpConfirmed('declined');
    const trxId = trx('NO');
    await pay(customer, trxId);
    const res = await admin.browser.post(`/api/admin/payments/${await paymentId(trxId)}`, { action: 'reject', note: 'No such transaction in the statement' });
    expect(res.status).toBe(200);
    const page = await customer.browser.get('/app/billing');
    expect(page.text).toContain('Not confirmed');
    expect(page.text).toContain('No such transaction in the statement');
    expect(await creditsOf(customer.email)).toBe(0);
  });

  it('refuses a transaction ID that was already submitted, and bad details', async () => {
    const customer = await signUpConfirmed('twice');
    const trxId = trx('DUP');
    expect((await pay(customer, trxId)).status).toBe(200);
    const again = await pay(await signUpConfirmed('twice-other'), trxId);
    expect([again.status, again.json.error]).toEqual([409, 'That transaction ID has already been submitted.']);
    const bad = await customer.browser.post('/api/billing', { packageId: 'starter', method: 'bkash', trxId: 'a b', sender: '01700000000' });
    expect(bad.status).toBe(400);
    expect((await pay(await signUp('unconfirmed'), trx('UNC'))).status).toBe(403); // confirm the address first
  });
});
