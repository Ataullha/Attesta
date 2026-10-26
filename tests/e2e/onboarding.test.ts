import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { Browser, closeDb, giveCredits, issue, signUp, signUpConfirmed } from './helpers';
import { limits, packages } from '@/lib/site';

afterAll(closeDb);

/** [done, of] from the dashboard's set-up list, or undefined when the list is not shown. */
const progress = (html: string) => html.match(/(\d) of (\d) done/)?.slice(1).map(Number);
const OUT_OF_FREE = `You have used this month’s ${limits.freeMonthly} free certificates`;

describe('a new account', () => {
  it('is shown what is left to set up, starting with confirming its address', async () => {
    const { browser } = await signUp('setup');
    const page = (await browser.get('/app')).text;
    expect(progress(page)).toEqual([0, 4]);
    expect(page).toContain('Confirm your email address');
    expect(page).toContain('Send the link again');
  });

  it('has each step ticked off as it is done, and the list goes once all are', async () => {
    const { browser } = await signUpConfirmed('setup-done');
    expect(progress((await browser.get('/app')).text)).toEqual([1, 4]);

    expect((await browser.post('/api/org', { name: 'Dhaka Skills Institute', domain: '', website: '' })).status).toBe(200);
    expect(progress((await browser.get('/app')).text)).toEqual([2, 4]);

    const form = new FormData();
    const png = await sharp({ create: { width: 300, height: 100, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } }).png().toBuffer();
    form.append('file', new File([new Uint8Array(png)], 'signature.png', { type: 'image/png' }));
    form.append('kind', 'signature');
    expect((await browser.upload('/api/assets', form)).status).toBe(200);
    expect(progress((await browser.get('/app')).text)).toEqual([3, 4]);

    expect((await issue(browser, ['First Recipient'])).status).toBe(200);
    const page = (await browser.get('/app')).text;
    expect(progress(page)).toBeUndefined();
    expect(page).not.toContain('Get set up');
  });
});

describe('running out of free certificates', () => {
  it('turns the dashboard into an offer of a package, saying when more arrive', async () => {
    const { browser } = await signUpConfirmed('out-of-free');
    for (let i = 0; i < limits.freeMonthly - 1; i++) expect((await issue(browser, [`Recipient ${i}`])).status).toBe(200);
    expect((await browser.get('/app')).text).not.toContain(OUT_OF_FREE); // one left: not yet

    expect((await issue(browser, ['The Last Free One'])).status).toBe(200);
    const page = (await browser.get('/app')).text;
    expect(page).toContain(OUT_OF_FREE);
    expect(page).toMatch(/More arrive on 1 [A-Z][a-z]+ \d{4}\./);
    expect(page).toContain(`${packages[0].credits} certificates for`);
  });

  it('leaves an account that has package credits alone', async () => {
    const account = await signUpConfirmed('out-of-free-paid');
    for (let i = 0; i < limits.freeMonthly; i++) expect((await issue(account.browser, [`Recipient ${i}`])).status).toBe(200);
    await giveCredits(account.email, 10);
    expect((await account.browser.get('/app')).text).not.toContain(OUT_OF_FREE);
  });
});

describe('an account without credits', () => {
  it('is offered the packages on the bulk page, each opening its own checkout', async () => {
    const { browser } = await signUpConfirmed('bulk-offer');
    const page = (await browser.get('/app/bulk')).text;
    expect(page).toContain('Issue to a whole group at once');
    for (const p of packages) expect(page).toContain(`href="/app/billing?package=${p.id}"`);
  });

  it('finds the package it chose already selected at checkout, and the smallest one otherwise', async () => {
    const { browser } = await signUpConfirmed('checkout');
    const chosenOn = async (path: string) => {
      const cards = (await browser.get(path)).text.split('<label').filter((l) => l.includes('name="pkg"') && l.includes('checked'));
      expect(cards, path).toHaveLength(1);
      return cards[0];
    };
    expect(await chosenOn(`/app/billing?package=${packages[1].id}`)).toContain(`>${packages[1].name}`);
    expect(await chosenOn('/app/billing?package=no-such-package')).toContain(`>${packages[0].name}`);
    expect(await chosenOn('/app/billing')).toContain(`>${packages[0].name}`);
  });
});

describe('signing up from the editor', () => {
  // The editor keeps the design in the browser and comes back to /create?draft=1 (components/editor/draft.ts).
  const next = '/create?draft=1';

  it('tells a guest their design is kept, on sign-up and on sign-in, and keeps the way back between the two', async () => {
    const register = (await new Browser().get(`/register?next=${encodeURIComponent(next)}`)).text;
    expect(register).toContain('Your design is kept');
    expect(register).toContain(`href="/login?next=${encodeURIComponent(next)}"`);
    const login = (await new Browser().get(`/login?next=${encodeURIComponent(next)}`)).text;
    expect(login).toContain('Your design is kept');
    expect(login).toContain(`href="/register?next=${encodeURIComponent(next)}"`);
  });

  it('says nothing about a design to someone who did not come from the editor', async () => {
    expect((await new Browser().get('/register')).text).not.toContain('Your design is kept');
    expect((await new Browser().get(`/login?next=${encodeURIComponent('/app/billing')}`)).text).not.toContain('Your design is kept');
    expect((await new Browser().get(`/login?next=${encodeURIComponent('/create')}`)).text).not.toContain('Your design is kept');
  });
});
