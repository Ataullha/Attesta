import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser, SERIAL, baseUrl, closeDb, design, giveCredits, issue, signUp, signUpConfirmed, sql, type Account } from './helpers';

afterAll(closeDb);

/** An address as written in an HTML attribute, & included. */
const hrefTo = (html: string, prefix: string) => html.match(new RegExp(`href="(${prefix.replace(/[.?]/g, '\\$&')}[^"]*)"`))?.[1].replaceAll('&amp;', '&');

describe('a certificate, from issuing to revocation', () => {
  let owner: Account;
  let serial = '';

  beforeAll(async () => {
    owner = await signUpConfirmed('issuer');
  });

  it('is issued with a registered serial and a link to its public page', async () => {
    const res = await issue(owner.browser, ['Nusrat Mim']);
    expect(res.status).toBe(200);
    expect(res.json.guest).toBe(false);
    const [issued] = res.json.issued;
    expect(issued.serial).toMatch(SERIAL);
    expect(issued.verifyUrl).toBe(`${baseUrl()}/verify/${issued.serial}`);
    serial = issued.serial;
  });

  it('can be checked by anyone, and the public page shows the name only in part', async () => {
    const page = await new Browser().get(`/verify/${serial}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain('Valid certificate');
    expect(page.text).toContain('Nusrat M.');
    expect(page.text).not.toContain('Nusrat Mim');
  });

  it('lets its recipient add it to LinkedIn already filled in, and tells other visitors how to issue their own', async () => {
    const page = await new Browser().get(`/verify/${serial}`);
    const add = hrefTo(page.text, 'https://www.linkedin.com/profile/add?');
    expect(add).toBeDefined();
    expect(Object.fromEntries(new URL(add!).searchParams)).toMatchObject({
      startTask: 'CERTIFICATION_NAME',
      name: 'Foundations of Data Analysis', // the course: its first public text field
      certId: serial,
      certUrl: `${baseUrl()}/verify/${serial}`,
    });
    expect(hrefTo(page.text, 'https://www.linkedin.com/sharing/share-offsite/?')).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(`${baseUrl()}/verify/${serial}`)}`,
    );
    expect(page.text).toContain('Issue certificates people can check like this');
  });

  it('is on its issuer’s dashboard', async () => {
    const page = await owner.browser.get('/app');
    expect(page.text).toContain(serial);
    expect(page.text).toContain('Nusrat Mim'); // the issuer sees the whole name
  });

  it('cannot be revoked by another account, or without a reason', async () => {
    const intruder = await signUp('intruder');
    const theirs = await intruder.browser.post(`/api/certificates/${serial}/revoke`, { reason: 'I just do not like it' });
    expect(theirs.status).toBe(404);
    const noReason = await owner.browser.post(`/api/certificates/${serial}/revoke`, { reason: 'x' });
    expect(noReason.status).toBe(400);
    expect((await new Browser().get(`/verify/${serial}`)).text).toContain('Valid certificate');
  });

  it('shows as revoked, with the reason, as soon as its issuer revokes it', async () => {
    const res = await owner.browser.post(`/api/certificates/${serial}/revoke`, { reason: 'Issued to the wrong cohort' });
    expect(res.status).toBe(200);
    const page = await new Browser().get(`/verify/${serial}`);
    expect(page.text).toContain('This certificate was revoked');
    expect(page.text).toContain('Issued to the wrong cohort');
    expect(page.text).not.toContain('Valid certificate');
    expect(page.text).not.toContain('linkedin.com'); // nothing to show off any more
  });

  it('cannot be revoked twice', async () => {
    expect((await owner.browser.post(`/api/certificates/${serial}/revoke`, { reason: 'Revoking it again' })).status).toBe(404);
  });
});

describe('the public verification page', () => {
  it('says plainly when a serial does not exist', async () => {
    const page = await new Browser().get('/verify/ATT-ZZZZ-ZZZZ-ZZZZ');
    expect(page.text).toContain('No certificate has this serial');
    expect(page.text).toContain('noindex'); // not something for search engines to list
  });

  it('accepts a serial typed the way people type them: any case, spaces for dashes', async () => {
    const owner = await signUpConfirmed('typed');
    const { serial } = (await issue(owner.browser, ['Typed Carefully'])).json.issued[0];
    const typed = serial.toLowerCase().replaceAll('-', '%20');
    expect((await new Browser().get(`/verify/${typed}`)).text).toContain('Valid certificate');
  });
});

describe('guests', () => {
  it('can make two single certificates, which are marked as unregistered, and no more', async () => {
    const guest = new Browser();
    const first = await issue(guest, ['Guest One']);
    expect(first.status).toBe(200);
    expect(first.json.guest).toBe(true);
    expect(first.json.issued[0].serial).toMatch(/^GUEST-/);
    expect(first.json.remaining).toBe(1);
    expect((await issue(guest, ['Guest Two'])).json.remaining).toBe(0);
    const third = await issue(guest, ['Guest Three']);
    expect(third.status).toBe(402);
    expect(third.json.code).toBe('guest_limit');
  });

  it('are told that their certificate cannot be verified', async () => {
    const { serial } = (await issue(new Browser(), ['Guest Person'])).json.issued[0];
    expect((await new Browser().get(`/verify/${serial}`)).text).toContain('unregistered guest certificate');
  });

  it('cannot issue in bulk', async () => {
    const res = await issue(new Browser(), ['Guest A', 'Guest B'], 'bulk');
    expect([res.status, res.json.code]).toEqual([401, 'unauthenticated']);
  });
});

describe('allowances', () => {
  it('give a new account five free certificates a month, then ask for a package', async () => {
    const { browser } = await signUpConfirmed('quota');
    for (let i = 0; i < 5; i++) expect((await issue(browser, [`Person ${i}`])).status).toBe(200);
    const sixth = await issue(browser, ['One Too Many']);
    expect([sixth.status, sixth.json.code]).toEqual([402, 'quota_exceeded']);
  });

  it('keep bulk issuing for paid packages', async () => {
    const { browser } = await signUpConfirmed('bulk-free');
    const res = await issue(browser, ['Bulk One', 'Bulk Two'], 'bulk');
    expect([res.status, res.json.code]).toEqual([402, 'needs_package']);
  });

  it('spend credits only on what the free allowance does not cover', async () => {
    const account = await signUpConfirmed('credits');
    await giveCredits(account.email, 3);
    const names = Array.from({ length: 7 }, (_, i) => `Credit Person ${i}`);
    const res = await issue(account.browser, names, 'bulk');
    expect(res.status).toBe(200);
    expect(res.json.issued).toHaveLength(7);
    const [{ credits }] = await sql()`select credits from users where email = ${account.email}`;
    expect(credits).toBe(1); // 7 issued: 5 free, 2 from credits
  });

  // Two requests that each pass the "do you have enough?" check before either one spends would let the
  // same allowance be used twice. The account row is locked while it is checked and spent.
  it('cannot be overspent by requests made at the same moment', async () => {
    const { browser, email } = await signUpConfirmed('overspend');
    const replies = await Promise.all(Array.from({ length: 9 }, (_, i) => issue(browser, [`Parallel ${i}`])));
    const statuses = replies.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 200, 200, 200, 200, 402, 402, 402, 402]);
    const [{ n }] = await sql()`select count(*)::int as n from certificates where user_id = (select id from users where email = ${email})`;
    expect(n).toBe(5);
  });
});

describe('the issue endpoint', () => {
  it('refuses a design or a value that does not fit, with a reason', async () => {
    const { browser } = await signUpConfirmed('invalid');
    const noName = await browser.post('/api/issue', { design: design(), mode: 'single', recipients: [{ values: { recipient_name: '', course: 'Anything' } }] });
    expect(noName.status).toBe(400);
    expect(noName.json.error).toMatch(/Recipient name is empty/);
    const notADesign = await browser.post('/api/issue', { design: { hello: 'world' }, mode: 'single', recipients: [{ values: { recipient_name: 'Someone Real' } }] });
    expect(notADesign.status).toBe(400);
  });

  it('only accepts requests that come from the site itself', async () => {
    const { browser } = await signUpConfirmed('csrf');
    const res = await browser.post('/api/issue', {}, { sameOrigin: false });
    expect(res.status).toBe(403);
  });
});
