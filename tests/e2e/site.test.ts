import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser, baseUrl, closeDb, signUp, signUpConfirmed, uniqueEmail, PASSWORD, type Account } from './helpers';

afterAll(closeDb);

const canonicalOf = (html: string) => {
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((tag) => /\brel="canonical"/.test(tag));
  return links.map((tag) => tag.match(/\bhref="([^"]*)"/)![1]);
};
const robotsOf = (html: string) => [...html.matchAll(/<meta\b[^>]*\bname="robots"[^>]*>/g)].map((m) => m[0].match(/\bcontent="([^"]*)"/)![1]);
const pathOf = (url: string) => new URL(url).pathname;
/** Next marks a prebuilt page with x-nextjs-prerender (the value can arrive repeated: "1, 1"). */
const prerendered = (res: { headers: Headers }) => (res.headers.get('x-nextjs-prerender') ?? '').split(',').some((v) => v.trim() === '1');

describe('what search engines are told', () => {
  // Metadata is inherited. A canonical set in the root layout would be inherited by every page that does not
  // set its own, telling search engines that /login, /register and every other page is a copy of the home page.
  it.each(['/', '/pricing', '/templates', '/verify', '/terms', '/privacy', '/create'])('%s names itself as the canonical address', async (path) => {
    const res = await new Browser().get(path);
    expect(res.status).toBe(200);
    expect(canonicalOf(res.text).map(pathOf)).toEqual([path]);
  });

  it.each(['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'])('%s declares no canonical address and asks not to be indexed', async (path) => {
    const res = await new Browser().get(path);
    expect(res.status).toBe(200);
    expect(canonicalOf(res.text)).toEqual([]);
    expect(robotsOf(res.text).join(',')).toContain('noindex');
  });

  it('keeps the dashboard out of search results', async () => {
    const { browser } = await signUp('seo');
    expect(robotsOf((await browser.get('/app')).text).join(',')).toContain('noindex');
  });

  it('lists the public pages in the sitemap and none of the private ones', async () => {
    const xml = (await new Browser().get('/sitemap.xml')).text;
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => pathOf(m[1]));
    expect(paths).toEqual(expect.arrayContaining(['/', '/pricing', '/templates', '/verify']));
    expect(paths.filter((p) => /^\/(app|admin|api|login|register)/.test(p))).toEqual([]);
  });

  it('disallows the private areas in robots.txt', async () => {
    const txt = (await new Browser().get('/robots.txt')).text;
    for (const path of ['/app', '/admin', '/api/', '/login', '/register']) expect(txt).toContain(`Disallow: ${path}`);
    expect(txt).toMatch(/Sitemap: \S+\/sitemap\.xml/);
  });
});

describe('the marketing pages', () => {
  // They are built once, not rendered per visit. Reading the session in the shared layout would silently make
  // every one of them dynamic, which costs speed and search ranking; the header learns whether someone is
  // signed in from a cookie in the browser instead.
  it.each(['/', '/pricing', '/templates', '/terms', '/privacy'])('%s is served prebuilt, and is identical for a signed-in visitor', async (path) => {
    const anonymous = await new Browser().get(path);
    expect(anonymous.headers.get('cache-control')).toMatch(/s-maxage=\d+/);
    expect(prerendered(anonymous)).toBe(true);
    const { browser } = await signUp('static');
    const signedIn = await browser.get(path);
    expect(signedIn.text).toBe(anonymous.text);
  });

  it('is distinguishable from a page that is rendered for each visit (so the check above can fail)', async () => {
    expect(prerendered(await new Browser().get('/login'))).toBe(false);
  });
});

describe('request checks', () => {
  const login = (options: Parameters<Browser['post']>[2]) => new Browser().post('/api/auth/login', { email: uniqueEmail(), password: PASSWORD }, options);

  it('refuses a state-changing request that does not say it came from the site', async () => {
    const res = await login({ sameOrigin: false });
    expect([res.status, res.json.error]).toEqual([403, 'This request did not come from this site.']);
  });

  it('refuses one that comes from another site', async () => {
    expect((await login({ sameOrigin: false, headers: { Origin: 'https://evil.example' } })).status).toBe(403);
    expect((await login({ sameOrigin: false, headers: { Origin: baseUrl(), 'Sec-Fetch-Site': 'cross-site' } })).status).toBe(403);
    expect((await login({ sameOrigin: false, headers: { Origin: baseUrl().replace('127.0.0.1', 'localhost') } })).status).toBe(403);
  });

  it('accepts the site’s own requests', async () => {
    expect((await login({})).status).toBe(401); // reaches the handler, and the made-up account does not exist
  });

  it('sends the standard hardening headers on pages and on the API', async () => {
    for (const path of ['/', '/login', '/api/health']) {
      const { headers } = await new Browser().get(path);
      expect(headers.get('x-frame-options'), path).toBe('DENY');
      expect(headers.get('x-content-type-options'), path).toBe('nosniff');
      expect(headers.get('referrer-policy'), path).toBe('strict-origin-when-cross-origin');
      expect(headers.get('content-security-policy'), path).toContain("default-src 'self'");
      expect(headers.get('content-security-policy'), path).toContain("frame-ancestors 'none'");
      expect(headers.get('x-powered-by'), path).toBeNull();
    }
  });

  it('answers an unknown page with a 404 that does not break the layout', async () => {
    const res = await new Browser().get('/no/such/page');
    expect(res.status).toBe(404);
    expect(res.text).toContain('<html');
  });
});

describe('the signed-in marker', () => {
  let account: Account;
  beforeAll(async () => {
    account = await signUpConfirmed('marker');
  });

  it('is set with the session, readable by scripts, and carries no secret', async () => {
    expect(account.browser.cookie('att_in')).toBe('1');
    expect(account.browser.cookie('att_session')).not.toBe('1');
  });
});
