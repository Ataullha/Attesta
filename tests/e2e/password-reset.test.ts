import { afterAll, describe, expect, it } from 'vitest';
import { Browser, closeDb, failMailTo, mailTo, PASSWORD, settle, signIn, signUp, sql, tokenIn, uniqueEmail, waitForMail } from './helpers';

afterAll(closeDb);

const NEW_PASSWORD = 'a brand new passphrase 77';

describe('resetting a forgotten password', () => {
  it('emails a link for each request, and the first one to be used wins', async () => {
    const account = await signUp('reset');
    const laptop = (await signIn(account)).browser;
    const phone = account.browser; // signed in by sign-up
    const stranger = new Browser();

    // Two requests, two links (the second request does not cancel the first).
    await stranger.post('/api/auth/forgot', { email: account.email });
    await stranger.post('/api/auth/forgot', { email: account.email });
    const [, first, second] = await waitForMail(account.email, { count: 3 }); // the first mail is the sign-up confirmation
    expect(tokenIn(first)).not.toBe(tokenIn(second));
    expect(first.subject).toMatch(/^Reset your/);

    const reset = await stranger.post('/api/auth/reset', { token: tokenIn(first), password: NEW_PASSWORD });
    expect(reset.status).toBe(200);
    expect(stranger.cookie('att_session')).toBeTruthy(); // opening the link signs this browser in
    expect((await stranger.get('/app')).status).toBe(200);

    // Everyone else was signed out, and both links are spent.
    expect((await laptop.get('/app')).status).toBe(307);
    expect((await phone.get('/app')).status).toBe(307);
    for (const mail of [first, second]) {
      const again = await stranger.post('/api/auth/reset', { token: tokenIn(mail), password: 'yet another passphrase' });
      expect(again.status).toBe(400);
      expect(again.json.error).toMatch(/expired or was already used/);
    }

    expect((await signIn({ email: account.email, password: PASSWORD })).reply.status).toBe(401);
    expect((await signIn({ email: account.email, password: NEW_PASSWORD })).reply.status).toBe(200);
    const audit = await sql()`select count(*)::int as n from audit_logs where action = 'auth.password_reset' and actor_user_id = (select id from users where email = ${account.email})`;
    expect(audit[0].n).toBe(1);
  });

  it('counts opening the link as confirming the address', async () => {
    const account = await signUp('reset-confirms');
    const stranger = new Browser();
    await stranger.post('/api/auth/forgot', { email: account.email });
    const [, link] = await waitForMail(account.email, { count: 2 });
    await stranger.post('/api/auth/reset', { token: tokenIn(link), password: NEW_PASSWORD });
    const [row] = await sql()`select email_verified_at is not null as confirmed from users where email = ${account.email}`;
    expect(row.confirmed).toBe(true);
  });

  // One link used by ten requests at once, each choosing a different password, used to succeed ten times:
  // whoever chose last had their password kept. It is spent atomically now. A fault here shows up only when
  // requests overlap in the wrong place, which a single round can miss, so the race is run three times.
  it('lets one link set one password, even when it is used many times at once', async () => {
    for (let round = 0; round < 3; round++) {
      const account = await signUp('reset-race');
      const stranger = new Browser();
      await stranger.post('/api/auth/forgot', { email: account.email });
      const [, mail] = await waitForMail(account.email, { count: 2 });
      const token = tokenIn(mail);

      const passwords = Array.from({ length: 30 }, (_, i) => `attacker chosen passphrase ${i}`);
      const replies = await Promise.all(passwords.map((password) => new Browser().post('/api/auth/reset', { token, password })));
      const tally = (status: number) => replies.filter((r) => r.status === status).length;
      expect({ round, accepted: tally(200), refused: tally(400) }).toEqual({ round, accepted: 1, refused: 29 });

      // Exactly the winner's password works.
      const winner = passwords[replies.findIndex((r) => r.status === 200)];
      const loser = passwords[replies.findIndex((r) => r.status === 400)];
      expect((await signIn({ email: account.email, password: winner })).reply.status).toBe(200);
      expect((await signIn({ email: account.email, password: loser })).reply.status).toBe(401);
    }
  });

  it('does not let an old link reopen an account that has since been suspended', async () => {
    const account = await signUp('reset-banned');
    const stranger = new Browser();
    await stranger.post('/api/auth/forgot', { email: account.email });
    const [, mail] = await waitForMail(account.email, { count: 2 });

    await sql()`update users set banned_at = now() where email = ${account.email}`;
    const refused = await stranger.post('/api/auth/reset', { token: tokenIn(mail), password: NEW_PASSWORD });
    expect(refused.status).toBe(403);
    expect(stranger.cookie('att_session')).toBeUndefined();

    // The refusal did not use the link up, so a restored account can still use it.
    await sql()`update users set banned_at = null where email = ${account.email}`;
    expect((await stranger.post('/api/auth/reset', { token: tokenIn(mail), password: NEW_PASSWORD })).status).toBe(200);
  });

  it('refuses a new password that is too short, without spending the link', async () => {
    const account = await signUp('reset-short');
    const stranger = new Browser();
    await stranger.post('/api/auth/forgot', { email: account.email });
    const [, mail] = await waitForMail(account.email, { count: 2 });
    const short = await stranger.post('/api/auth/reset', { token: tokenIn(mail), password: 'tiny' });
    expect([short.status, short.json.error]).toEqual([400, 'Use at least 10 characters']);
    expect((await stranger.post('/api/auth/reset', { token: tokenIn(mail), password: NEW_PASSWORD })).status).toBe(200);
  });
});

describe('asking for a reset link', () => {
  // The form must not reveal which addresses have accounts. It used to: while the mail provider was
  // down, an address with an account got a 500 and one without got a 200.
  it('answers identically for an address with an account and one without, even when the mail provider is down', async () => {
    const account = await signUp('uniform');
    const nobody = uniqueEmail('nobody');
    await waitForMail(account.email); // the sign-up confirmation
    await failMailTo(account.email);

    const known = await new Browser().post('/api/auth/forgot', { email: account.email });
    const unknown = await new Browser().post('/api/auth/forgot', { email: nobody });
    expect([known.status, unknown.status]).toEqual([200, 200]);
    expect(known.json).toEqual(unknown.json);
    expect(known.json).toEqual({ ok: true });

    // The difference is only in what happens afterwards: the provider was asked about one and not the other.
    await waitForMail(account.email, { count: 1, delivered: false });
    await settle();
    expect(await mailTo(nobody)).toHaveLength(0);
  });

  it('does not mail a suspended account', async () => {
    const account = await signUp('forgot-banned');
    await waitForMail(account.email);
    await sql()`update users set banned_at = now() where email = ${account.email}`;
    expect((await new Browser().post('/api/auth/forgot', { email: account.email })).status).toBe(200);
    await settle();
    expect(await mailTo(account.email)).toHaveLength(1); // only the sign-up confirmation
  });

  it('allows five requests an hour from one address, then says how long to wait', async () => {
    const browser = new Browser();
    let last;
    for (let i = 0; i < 6; i++) last = await browser.post('/api/auth/forgot', { email: uniqueEmail('limit') });
    expect(last!.status).toBe(429);
    expect(Number(last!.headers.get('retry-after'))).toBeGreaterThan(3000);
    expect(last!.json.error).toMatch(/^Too many attempts\. Try again in (an hour|\d+ minutes)\.$/);
  });
});
