import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser, baseUrl, closeDb, signUp, signUpConfirmed, uniqueEmail, PASSWORD, type Account } from './helpers';
import { packages } from '@/lib/site';

afterAll(closeDb);

const canonicalOf = (html: string) => {
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => m[0]).filter((tag) => /\brel="canonical"/.test(tag));
  return links.map((tag) => tag.match(/\bhref="([^"]*)"/)![1]);
};
const robotsOf = (html: string) => [...html.matchAll(/<meta\b[^>]*\bname="robots"[^>]*>/g)].map((m) => m[0].match(/\bcontent="([^"]*)"/)![1]);
const pathOf = (url: string) => new URL(url).pathname;
/** Next marks a prebuilt page with x-nextjs-prerender (the value can arrive repeated: "1, 1"). */
const prerendered = (res: { headers: Headers }) => (res.headers.get('x-nextjs-prerender') ?? '').split(',').some((v) => v.trim() === '1');
const structuredDataOf = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">([^<]*)<\/script>/g)].flatMap((m) => JSON.parse(m[1]));

const MARKETING = [
  '/',
  '/pricing',
  '/templates',
  '/templates/classic-ledger',
  '/templates/club-member-card',
  '/templates/corporate-visiting-card',
  '/templates/wedding-invitation',
  '/id-card-maker',
  '/visiting-card-maker',
  '/invitation-card-maker',
  '/certificate-maker',
  '/certificate-maker/course-completion',
  '/terms',
  '/privacy',
];

describe('what search engines are told', () => {
  // Metadata is inherited. A canonical set in the root layout would be inherited by every page that does not
  // set its own, telling search engines that /login, /register and every other page is a copy of the home page.
  it.each([...MARKETING, '/verify', '/create'])('%s names itself as the canonical address', async (path) => {
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
    expect(paths).toEqual(
      expect.arrayContaining([
        '/',
        '/pricing',
        '/templates',
        '/verify',
        '/certificate-maker',
        '/certificate-maker/course-completion',
        '/templates/classic-ledger',
        '/id-card-maker',
        '/templates/club-member-card',
        '/visiting-card-maker',
        '/invitation-card-maker',
        '/templates/corporate-visiting-card',
        '/templates/wedding-invitation',
      ]),
    );
    expect(paths.filter((p) => /^\/(app|admin|api|login|register)/.test(p))).toEqual([]);
  });

  it('disallows the private areas in robots.txt', async () => {
    const txt = (await new Browser().get('/robots.txt')).text;
    for (const path of ['/app', '/admin', '/api/', '/login', '/register']) expect(txt).toContain(`Disallow: ${path}`);
    expect(txt).toMatch(/Sitemap: \S+\/sitemap\.xml/);
  });

  it('describes the business, the product and its prices in structured data that matches the pricing page', async () => {
    const home = structuredDataOf((await new Browser().get('/')).text);
    expect(home.map((d) => d['@type'])).toEqual(expect.arrayContaining(['Organization', 'SoftwareApplication', 'FAQPage']));
    const app = home.find((d) => d['@type'] === 'SoftwareApplication');
    expect(app.offers).toMatchObject({ '@type': 'AggregateOffer', lowPrice: 0, highPrice: Math.max(...packages.map((p) => p.price)), offerCount: packages.length + 1 });

    const pricing = structuredDataOf((await new Browser().get('/pricing')).text);
    const offers = pricing.find((d) => d['@type'] === 'SoftwareApplication').offers;
    expect(offers.map((o: { price: number }) => o.price)).toEqual([0, ...packages.map((p) => p.price)]);
    const faq = pricing.find((d) => d['@type'] === 'FAQPage');
    expect(faq.mainEntity.length).toBeGreaterThan(0);
    for (const q of faq.mainEntity) expect(q.acceptedAnswer.text.length).toBeGreaterThan(0);
  });

  it('gives the use-case and template pages a breadcrumb trail', async () => {
    for (const path of ['/certificate-maker', '/certificate-maker/course-completion', '/templates/classic-ledger']) {
      const trail = structuredDataOf((await new Browser().get(path)).text).find((d) => d['@type'] === 'BreadcrumbList');
      expect(trail, path).toBeDefined();
      expect(pathOf(trail.itemListElement.at(-1).item), path).toBe(path);
    }
  });
});

describe('links on the public pages', () => {
  // A link to a page that does not exist costs a visitor and tells search engines the site is neglected.
  it('all lead somewhere, and every picture loads', async () => {
    const targets = new Set<string>();
    for (const path of [...MARKETING, '/verify']) {
      const html = (await new Browser().get(path)).text;
      for (const m of html.matchAll(/<a\b[^>]*\bhref="(\/[^"/][^"]*|\/)"/g)) targets.add(m[1].replaceAll('&amp;', '&').split('#')[0]);
      for (const m of html.matchAll(/<img\b[^>]*\bsrc="(\/[^"]+)"/g)) targets.add(m[1]);
      for (const m of html.matchAll(/\bsrcSet="([^"]+)"/gi)) for (const candidate of m[1].split(',')) targets.add(candidate.trim().split(/\s+/)[0]);
    }
    expect(targets.size).toBeGreaterThan(30); // the pattern above still finds the links
    const broken: string[] = [];
    for (const target of targets) {
      const res = await new Browser().get(target);
      if (res.status >= 400) broken.push(`${target} → ${res.status}`);
      if (target.startsWith('/previews/') && res.headers.get('content-type') !== 'image/webp') broken.push(`${target} is ${res.headers.get('content-type')}`);
    }
    expect(broken).toEqual([]);
  });

  it('send a buyer straight to the package they chose', async () => {
    const html = (await new Browser().get('/pricing')).text;
    for (const p of packages) expect(html).toContain(`href="/app/billing?package=${p.id}"`);
  });

  it('do not include the development-only template pictures pages', async () => {
    expect((await new Browser().get('/preview')).status).toBe(404);
    expect((await new Browser().get('/preview/classic-ledger')).status).toBe(404);
  });
});

describe('the marketing pages', () => {
  // They are built once, not rendered per visit. Reading the session in the shared layout would silently make
  // every one of them dynamic, which costs speed and search ranking; the header learns whether someone is
  // signed in from a cookie in the browser instead.
  it.each(MARKETING)('%s is served prebuilt, and is identical for a signed-in visitor', async (path) => {
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
