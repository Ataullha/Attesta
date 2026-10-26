import { afterAll, describe, expect, it } from 'vitest';
import {
  Browser,
  closeDb,
  continueWithGoogle,
  freshIp,
  googlePerson,
  googleUrl,
  issue,
  PASSWORD,
  signIn,
  signUp,
  signUpConfirmed,
  sql,
  tokenIn,
  uniqueEmail,
  waitForMail,
} from './helpers';

afterAll(closeDb);

const location = (res: { headers: Headers }) => res.headers.get('location');
const account = async (email: string) => (await sql()`select id, password_hash, google_sub, email_verified_at from users where email = ${email}`)[0];
const encode = (person: object) => Buffer.from(JSON.stringify(person)).toString('base64url');

describe('Continue with Google', () => {
  it('is offered on the sign-in and sign-up pages, keeping where the person was going', async () => {
    for (const page of ['/login', '/register']) {
      const html = (await new Browser().get(`${page}?next=${encodeURIComponent('/create?draft=1')}`)).text;
      expect(html, page).toContain('Continue with Google');
      expect(html, page).toContain('href="/api/auth/google?next=%2Fcreate%3Fdraft%3D1"');
    }
  });

  it('sends the browser to Google with a new state, nonce and PKCE challenge each time, kept in a short-lived cookie', async () => {
    const browser = new Browser();
    const first = await browser.get('/api/auth/google');
    expect(first.status).toBe(307);
    const atGoogle = new URL(location(first)!);
    expect(atGoogle.origin).toBe(googleUrl());
    expect(atGoogle.searchParams.get('code_challenge_method')).toBe('S256');
    const cookie = first.headers.getSetCookie().find((c) => c.startsWith('att_google='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\/api\/auth\/google/);
    expect(cookie).toMatch(/Max-Age=600/);
    const again = new URL(location(await browser.get('/api/auth/google'))!);
    for (const p of ['state', 'nonce', 'code_challenge']) expect(again.searchParams.get(p), p).not.toBe(atGoogle.searchParams.get(p));
  });
});

describe('someone new', () => {
  it('gets a confirmed account without a password, is signed in, and can issue straight away', async () => {
    const person = googlePerson('google-new', { name: 'Tahmina Akter' });
    const browser = new Browser();
    const res = await continueWithGoogle(browser, person);
    expect([res.status, location(res)]).toEqual([307, '/app']);
    expect(browser.cookie('att_session')).toBeTruthy();
    expect(browser.cookie('att_in')).toBe('1');

    const row = await account(person.email);
    expect([row.password_hash, row.google_sub]).toEqual([null, person.sub]);
    expect(row.email_verified_at).not.toBeNull();
    const dashboard = (await browser.get('/app')).text;
    expect(dashboard).toContain('Tahmina Akter');
    expect(dashboard).toContain('1 of 4 done'); // the address needs no confirming
    expect((await issue(browser, ['First Recipient'])).status).toBe(200);
  });

  it('is signed in to the same account next time, even after changing the address on their Google account', async () => {
    const person = googlePerson('google-again');
    await continueWithGoogle(new Browser(), person);
    const later = new Browser();
    expect(location(await continueWithGoogle(later, { ...person, email: uniqueEmail('google-moved') }))).toBe('/app');
    expect((await sql()`select count(*)::int as n from users where google_sub = ${person.sub}`)[0].n).toBe(1);
    expect((await later.get('/app/settings')).text).toContain(person.email);
  });

  it('goes back to where they were heading, and never off the site', async () => {
    expect(location(await continueWithGoogle(new Browser(), googlePerson('google-next'), '/create?draft=1'))).toBe('/create?draft=1');
    expect(location(await continueWithGoogle(new Browser(), googlePerson('google-evil'), '//evil.example/steal'))).toBe('/app');
  });

  it('cannot sign up with a throwaway inbox', async () => {
    const res = await continueWithGoogle(new Browser(), googlePerson('unused', { email: `someone-${Date.now()}@mailinator.com` }));
    expect(location(res)).toBe('/login?google=throwaway');
  });

  it('counts against the same sign-up allowance as signing up with a password', async () => {
    const ip = freshIp();
    const outcomes = [];
    for (let i = 0; i < 6; i++) outcomes.push(location(await continueWithGoogle(new Browser(ip), googlePerson('google-many'))));
    expect(outcomes).toEqual(['/app', '/app', '/app', '/app', '/app', '/login?google=busy']);
  });
});

describe('an account that already has the address', () => {
  it('is linked when its address was confirmed, and its password and other sessions keep working', async () => {
    const existing = await signUpConfirmed('google-link');
    expect(location(await continueWithGoogle(new Browser(), googlePerson('unused', { email: existing.email })))).toBe('/app');
    expect((await existing.browser.get('/app')).status).toBe(200);
    expect((await signIn(existing)).reply.status).toBe(200);
    expect((await account(existing.email)).google_sub).toBeTruthy();
  });

  it('is linked when its address was never confirmed, but whoever chose its password is shut out', async () => {
    // Someone registers the address first, hoping its owner will sign in with Google and use the account.
    const squatter = await signUp('google-squat');
    expect(location(await continueWithGoogle(new Browser(), googlePerson('unused', { email: squatter.email })))).toBe('/app');

    const theirSession = await squatter.browser.get('/app');
    expect([theirSession.status, location(theirSession)]).toEqual([307, '/login?next=%2Fapp']);
    expect((await signIn(squatter)).reply.status).toBe(401);
    const row = await account(squatter.email);
    expect(row.password_hash).toBeNull();
    expect(row.email_verified_at).not.toBeNull();
    const [log] = await sql()`select meta from audit_logs where action = 'auth.google_linked' and target = ${row.id}`;
    expect(log.meta).toEqual({ passwordRemoved: true });
  });

  it('cannot be taken by a different Google account that has the address later', async () => {
    const person = googlePerson('google-first');
    await continueWithGoogle(new Browser(), person);
    const res = await continueWithGoogle(new Browser(), googlePerson('unused', { email: person.email }));
    expect(location(res)).toBe('/login?google=other_google');
  });

  it('stays closed while it is suspended', async () => {
    const person = googlePerson('google-banned');
    await continueWithGoogle(new Browser(), person);
    await sql()`update users set banned_at = now() where google_sub = ${person.sub}`;
    const browser = new Browser();
    expect(location(await continueWithGoogle(browser, person))).toBe('/login?google=suspended');
    expect(browser.cookie('att_session')).toBeUndefined();
  });
});

describe('an account that only signs in with Google', () => {
  it('has no password to sign in with, says so in settings, and can add one by email', async () => {
    const person = googlePerson('google-password');
    const browser = new Browser();
    await continueWithGoogle(browser, person);

    const attempt = await new Browser().post('/api/auth/login', { email: person.email, password: PASSWORD });
    expect(attempt.status).toBe(401);
    expect(attempt.json.error).toContain('Continue with Google');
    const settings = (await browser.get('/app/settings')).text;
    expect(settings).toContain('Email me a link to set a password');
    expect(settings).not.toContain('Change password');
    const change = await browser.post('/api/auth/password', { currentPassword: 'anything at all', newPassword: 'a brand new password' });
    expect([change.status, change.json.code]).toEqual([400, 'no_password']);

    expect((await browser.post('/api/auth/forgot', { email: person.email })).status).toBe(200);
    const [mail] = await waitForMail(person.email);
    expect((await new Browser().post('/api/auth/reset', { token: tokenIn(mail), password: PASSWORD })).status).toBe(200);
    expect((await signIn({ email: person.email, password: PASSWORD })).reply.status).toBe(200);
    expect(location(await continueWithGoogle(new Browser(), person))).toBe('/app'); // and Google still works
  });
});

describe('a return from Google that cannot be trusted', () => {
  it('is refused when Google has not confirmed the address', async () => {
    const browser = new Browser();
    expect(location(await continueWithGoogle(browser, googlePerson('google-unconfirmed', { email_verified: false })))).toBe('/login?google=unverified');
    expect(browser.cookie('att_session')).toBeUndefined();
  });

  it('is refused when the ID token is for another sign-in or another app, from someone else, or out of date', async () => {
    const stale = Math.floor(Date.now() / 1000) - 3600;
    for (const claims of [{ nonce: 'another-sign-in' }, { aud: 'another-app.apps.googleusercontent.com' }, { iss: 'https://evil.example' }, { exp: stale }]) {
      const browser = new Browser();
      expect(location(await continueWithGoogle(browser, googlePerson('google-bad', { claims }))), JSON.stringify(claims)).toBe('/login?google=failed');
      expect(browser.cookie('att_session')).toBeUndefined();
    }
  });

  it('is refused in a browser that did not start the sign-in, so nobody can be signed in to someone else’s account', async () => {
    // The attacker starts a sign-in with their own Google account, then gets the victim's browser to finish it.
    const attacker = new Browser();
    const atGoogle = new URL(location(await attacker.get('/api/auth/google'))!);
    atGoogle.searchParams.set('as', encode(googlePerson('google-attacker')));
    const back = new URL(location(await fetch(atGoogle, { redirect: 'manual' }))!);
    const victim = new Browser();
    const res = await victim.get(back.pathname + back.search, { sameOrigin: false });
    expect(location(res)).toBe('/login?google=expired');
    expect(victim.cookie('att_session')).toBeUndefined();
  });

  it('is refused when the state does not match, and a return works only once', async () => {
    const browser = new Browser();
    const atGoogle = new URL(location(await browser.get('/api/auth/google'))!);
    atGoogle.searchParams.set('as', encode(googlePerson('google-replay')));
    const back = new URL(location(await fetch(atGoogle, { redirect: 'manual' }))!);
    const tampered = new URL(back);
    tampered.searchParams.set('state', 'not-the-state');
    expect(location(await browser.get(tampered.pathname + tampered.search, { sameOrigin: false }))).toBe('/login?google=expired');

    // The refused return used up the sign-in, so even the genuine one is refused now.
    expect(location(await browser.get(back.pathname + back.search, { sameOrigin: false }))).toBe('/login?google=expired');
    expect(browser.cookie('att_session')).toBeUndefined();
  });

  it('says so when the person cancels at Google, keeping where they were going', async () => {
    expect(location(await continueWithGoogle(new Browser(), 'deny', '/create?draft=1'))).toBe('/login?google=cancelled&next=%2Fcreate%3Fdraft%3D1');
  });

  it('is explained on the sign-in page, which ignores reasons it does not know', async () => {
    expect((await new Browser().get('/login?google=cancelled')).text).toContain('Google sign-in was cancelled');
    const odd = await new Browser().get('/login?google=toString');
    expect(odd.status).toBe(200);
    expect(odd.text).not.toContain('role="alert"');
  });
});
