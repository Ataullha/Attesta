import { afterAll, describe, expect, it } from 'vitest';
import { Browser, closeDb, failMailTo, healMailTo, mailTo, PASSWORD, settle, signIn, signUp, tokenIn, uniqueEmail, waitForMail, baseUrl, issue, sql } from './helpers';

afterAll(closeDb);

const loginRedirect = (res: { status: number; headers: Headers }) => [res.status, res.headers.get('location')];

describe('one account, from sign-up to sign-out', () => {
  const email = uniqueEmail('journey');
  const me = new Browser();
  const otherDevice = new Browser();
  let token = '';
  const newPassword = 'a different horse battery staple';

  it('signing up signs the browser in and says the address needs confirming', async () => {
    const res = await me.post('/api/auth/register', { name: 'Journey Tester', email, password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, needsVerification: true });
    expect(me.cookie('att_session')).toBeTruthy();
    expect(me.cookie('att_in')).toBe('1'); // what lets the static pages show "Dashboard" instead of "Sign in"
  });

  it('emails one confirmation link, to the address given, pointing at this site', async () => {
    const [mail] = await waitForMail(email);
    expect(mail.subject).toMatch(/^Confirm your email/);
    expect(mail.text).toContain(`${baseUrl()}/verify-email?token=`);
    token = tokenIn(mail);
    await settle();
    expect(await mailTo(email)).toHaveLength(1);
  });

  it('shows the dashboard, with a way to ask for the link again', async () => {
    const res = await me.get('/app');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Send the link again');
  });

  it('will not issue until the address is confirmed', async () => {
    const res = await issue(me, ['Not Yet']);
    expect(res.status).toBe(403);
    expect(res.json.code).toBe('email_unverified');
  });

  it('confirms the address when the emailed link is used', async () => {
    const res = await me.post('/api/auth/verify-email', { token });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true });
    expect((await issue(me, ['Now Allowed'])).status).toBe(200);
  });

  it('says "confirmed" again when the same link is opened twice, as mail scanners and double clicks do', async () => {
    expect((await me.post('/api/auth/verify-email', { token })).status).toBe(200);
  });

  it('refuses a link that was never issued', async () => {
    const res = await me.post('/api/auth/verify-email', { token: 'x'.repeat(43) });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/expired or was already used/);
  });

  it('signs in from another device with the right password only', async () => {
    const wrong = await signIn({ email, password: 'not the password' }, otherDevice);
    expect(wrong.reply.status).toBe(401);
    expect(otherDevice.cookie('att_session')).toBeUndefined();
    const right = await signIn({ email, password: PASSWORD }, otherDevice);
    expect(right.reply.status).toBe(200);
    expect(right.reply.json).toEqual({ ok: true, role: 'user' });
    expect((await otherDevice.get('/app')).status).toBe(200);
  });

  it('asks for the current password before changing it', async () => {
    const wrong = await me.post('/api/auth/password', { currentPassword: 'guess', newPassword });
    expect(wrong.status).toBe(403);
    expect(wrong.json.code).toBe('wrong_password');
    expect((await me.post('/api/auth/password', { currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400);
    expect((await me.post('/api/auth/password', { currentPassword: PASSWORD, newPassword: 'short' })).status).toBe(400);
  });

  it('changing the password keeps this device signed in and signs the others out', async () => {
    const res = await me.post('/api/auth/password', { currentPassword: PASSWORD, newPassword });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ ok: true, signedOutElsewhere: 1 });
    expect((await me.get('/app')).status).toBe(200);
    expect(loginRedirect(await otherDevice.get('/app'))).toEqual([307, '/login?next=%2Fapp']);
    expect((await signIn({ email, password: PASSWORD })).reply.status).toBe(401);
    expect((await signIn({ email, password: newPassword })).reply.status).toBe(200);
  });

  it('"sign out everywhere else" ends the other sessions and keeps this one', async () => {
    const phone = (await signIn({ email, password: newPassword })).browser;
    const laptop = (await signIn({ email, password: newPassword })).browser;
    const res = await me.delete('/api/auth/sessions');
    expect(res.status).toBe(200);
    expect(res.json.ended).toBeGreaterThanOrEqual(2);
    expect((await me.get('/app')).status).toBe(200);
    expect((await phone.get('/app')).status).toBe(307);
    expect((await laptop.get('/app')).status).toBe(307);
  });

  it('both changes are in the audit log', async () => {
    const rows = await sql()`select action from audit_logs where actor_user_id = (select id from users where email = ${email}) order by created_at`;
    expect(rows.map((r) => r.action)).toEqual(['auth.password_change', 'auth.sessions_ended']);
  });

  it('signing out ends the session and clears the cookies', async () => {
    const res = await me.post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(me.cookie('att_session')).toBeUndefined();
    expect(me.cookie('att_in')).toBeUndefined();
    expect(loginRedirect(await me.get('/app'))).toEqual([307, '/login?next=%2Fapp']);
  });
});

describe('sign-up', () => {
  it('rejects a weak password, a bad address and a throwaway inbox, each with a reason', async () => {
    const b = new Browser();
    const short = await b.post('/api/auth/register', { name: 'Short Pass', email: uniqueEmail(), password: 'short' });
    expect([short.status, short.json.error]).toEqual([400, 'Use at least 10 characters']);
    const bad = await b.post('/api/auth/register', { name: 'Bad Mail', email: 'not-an-email', password: PASSWORD });
    expect([bad.status, bad.json.error]).toEqual([400, 'Enter a valid email address']);
    const throwaway = await b.post('/api/auth/register', { name: 'Throwaway', email: `x${Date.now()}@mailinator.com`, password: PASSWORD });
    expect(throwaway.status).toBe(400);
    expect(throwaway.json.error).toMatch(/permanent email address/);
  });

  it('treats an address as the same whatever its capitals, and says so', async () => {
    const email = uniqueEmail('Case');
    expect((await new Browser().post('/api/auth/register', { name: 'First Person', email, password: PASSWORD })).status).toBe(200);
    const again = await new Browser().post('/api/auth/register', { name: 'Second Person', email: email.toUpperCase(), password: PASSWORD });
    expect(again.status).toBe(409);
    expect(again.json.error).toBe('An account with this email already exists. Sign in instead.');
  });

  // Two sign-ups for one address that both get past the "already exists?" check used to end in a 500 for
  // the loser. The unique index decides now, and the loser is told the truth.
  it('answers simultaneous sign-ups for one address with one account and clean refusals, never an error', async () => {
    const email = uniqueEmail('race');
    const replies = await Promise.all(Array.from({ length: 8 }, (_, i) => new Browser().post('/api/auth/register', { name: `Racer ${i}`, email, password: PASSWORD })));
    const statuses = replies.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409, 409, 409, 409, 409, 409, 409]);
    const [{ n }] = await sql()`select count(*)::int as n from users where email = ${email}`;
    expect(n).toBe(1);
    await waitForMail(email);
    await settle();
    expect(await mailTo(email)).toHaveLength(1); // one account, one confirmation email
  });

  it('limits sign-ups from one address, and says when to come back', async () => {
    const b = new Browser();
    let last;
    for (let i = 0; i < 6; i++) last = await b.post('/api/auth/register', { name: 'Many Accounts', email: uniqueEmail('many'), password: PASSWORD });
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(last!.json.error).toMatch(/^Too many attempts\. Try again in /);
  });
});

describe('when the mail provider is down', () => {
  it('still creates the account, and the dashboard can send the link again once it is back', async () => {
    const browser = new Browser();
    const email = uniqueEmail('outage');
    await failMailTo(email);

    const res = await browser.post('/api/auth/register', { name: 'Outage Tester', email, password: PASSWORD });
    expect(res.status).toBe(200); // the outage must not turn a sign-up into an error
    const [lost] = await waitForMail(email, { delivered: false });
    expect(lost.subject).toMatch(/^Confirm your email/);

    await healMailTo(email);
    expect((await browser.post('/api/auth/resend')).status).toBe(200);
    const [fresh] = await waitForMail(email);
    // Asking again replaces the earlier link rather than adding to it.
    expect((await browser.post('/api/auth/verify-email', { token: tokenIn(lost) })).status).toBe(400);
    expect((await browser.post('/api/auth/verify-email', { token: tokenIn(fresh) })).status).toBe(200);
  });
});

describe('signing in', () => {
  it('gives the same answer for a wrong password and for an unknown address', async () => {
    const { email } = await signUp('known');
    const wrong = await new Browser().post('/api/auth/login', { email, password: 'definitely wrong' });
    const unknown = await new Browser().post('/api/auth/login', { email: uniqueEmail('nobody'), password: 'definitely wrong' });
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(wrong.json).toEqual(unknown.json);
  });

  it('refuses a suspended account, and a session it already had stops working', async () => {
    const account = await signUp('banned');
    await sql()`update users set banned_at = now() where email = ${account.email}`;
    expect((await signIn(account)).reply.status).toBe(403);
    expect((await account.browser.get('/app')).status).toBe(307);
  });

  it('signing in again on the same browser ends the session it replaces', async () => {
    const account = await signUp('relogin');
    const first = account.browser.cookie('att_session')!;
    expect((await signIn(account, account.browser)).reply.status).toBe(200);
    expect(account.browser.cookie('att_session')).not.toBe(first);
    expect((await account.browser.get('/app')).status).toBe(200);
    // Someone who kept the old cookie (a copied cookie jar, a shared computer) gets nothing from it.
    const stale = await new Browser().get('/app', { headers: { Cookie: `att_session=${first}` } });
    expect([stale.status, stale.headers.get('location')]).toEqual([307, '/login?next=%2Fapp']);
  });

  it('slows down guessing: eight wrong passwords for one address, then a pause', async () => {
    const { email } = await signUp('guess');
    const attempts = [];
    for (let i = 0; i < 9; i++) attempts.push((await new Browser().post('/api/auth/login', { email, password: `wrong ${i}` })).status);
    expect(attempts.slice(0, 8).every((s) => s === 401)).toBe(true);
    expect(attempts[8]).toBe(429);
  });
});
