import postgres from 'postgres';
import { inject } from 'vitest';
import { presetDesign } from '@/lib/presets';

export const baseUrl = () => inject('baseUrl');
const mailUrl = () => inject('mailUrl');
export const googleUrl = () => inject('googleUrl');
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const PASSWORD = 'correct horse battery staple';

// ---------------------------------------------------------------------------------------------
// Unique data. The database outlives a run, so every test makes its own people.
// ---------------------------------------------------------------------------------------------

const run = Date.now().toString(36);
let counter = 0;
export const uniqueEmail = (label = 'user') => `${label}-${run}-${++counter}@example.com`;

const usedIps = new Set<string>();
/**
 * The app's limits are per client address, read from x-forwarded-for. Each browser gets its own
 * address from the range reserved for benchmarking, so one test's sign-ups cannot use up another's allowance.
 */
export function freshIp() {
  for (;;) {
    const ip = `198.${18 + Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 256)}.${1 + Math.floor(Math.random() * 254)}`;
    if (!usedIps.has(ip)) {
      usedIps.add(ip);
      return ip;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// A browser: cookies kept between requests, and the headers a real one sends on the site's own pages.
// ---------------------------------------------------------------------------------------------

export type Reply = {
  status: number;
  headers: Headers;
  text: string;
  /** The body parsed as JSON, or null when it is not JSON. */
  json: any;
  bytes: Uint8Array;
};

type Options = {
  body?: unknown;
  /** A multipart form, as a file upload sends, in place of a JSON body. */
  form?: FormData;
  headers?: Record<string, string>;
  /** Pretend to come from another address (a different person on the same network). */
  ip?: string;
  /** false sends neither Origin nor Sec-Fetch-Site, as a script outside a browser would. */
  sameOrigin?: boolean;
};

export class Browser {
  private jar = new Map<string, string>();
  constructor(public ip = freshIp()) {}

  cookie(name: string) {
    return this.jar.get(name);
  }

  async request(method: string, path: string, { body, form, headers = {}, ip = this.ip, sameOrigin = true }: Options = {}): Promise<Reply> {
    const base = baseUrl();
    const sent: Record<string, string> = {
      'x-forwarded-for': ip,
      ...(sameOrigin ? { Origin: base, 'Sec-Fetch-Site': 'same-origin' } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    };
    if (this.jar.size) sent.Cookie = [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
    // Redirects are left alone: a test about "sends you to sign in" needs to see the redirect itself.
    const res = await fetch(base + path, { method, headers: sent, body: form ?? (body === undefined ? undefined : JSON.stringify(body)), redirect: 'manual' });
    this.keepCookies(res);
    const bytes = new Uint8Array(await res.arrayBuffer());
    // ignoreBOM keeps a leading U+FEFF in the text, so a test can see it.
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // not JSON
    }
    return { status: res.status, headers: res.headers, text, json, bytes };
  }

  get = (path: string, options?: Options) => this.request('GET', path, options);
  post = (path: string, body: unknown = {}, options?: Options) => this.request('POST', path, { ...options, body });
  delete = (path: string, options?: Options) => this.request('DELETE', path, options);
  upload = (path: string, form: FormData, options?: Options) => this.request('POST', path, { ...options, form });

  private keepCookies(res: Response) {
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(';').map((part) => part.trim());
      const at = pair.indexOf('=');
      const name = pair.slice(0, at);
      const value = pair.slice(at + 1);
      const expired = value === '' || attributes.some((a) => /^max-age=0$/i.test(a) || /^expires=.*1970/i.test(a));
      if (expired) this.jar.delete(name);
      else this.jar.set(name, value);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Mail. The app sends after it has answered, so it is read the way a person reads it: by looking.
// ---------------------------------------------------------------------------------------------

export type Mail = { to: string; from: string; subject: string; text: string; delivered: boolean };

/** Every attempt to mail this address, delivered or not. */
export async function mailTo(email: string): Promise<Mail[]> {
  const res = await fetch(`${mailUrl()}/__attempts?to=${encodeURIComponent(email)}`);
  return (await res.json()) as Mail[];
}

export async function waitForMail(email: string, { count = 1, delivered = true, timeoutMs = 15_000 } = {}): Promise<Mail[]> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = (await mailTo(email)).filter((m) => m.delivered === delivered);
    if (found.length >= count) return found;
    if (Date.now() > deadline) throw new Error(`Expected ${count} ${delivered ? 'delivered' : 'undelivered'} mail(s) to ${email} but found ${found.length}.`);
    await sleep(100);
  }
}

/** "No mail" can only be shown by waiting a moment and looking again. */
export async function settle() {
  await sleep(700);
}

export const linkIn = (mail: Mail) => mail.text.match(/https?:\/\/\S+/)![0];
export const tokenIn = (mail: Mail) => new URL(linkIn(mail)).searchParams.get('token')!;

const control = (action: '__fail' | '__heal', email: string) => fetch(`${mailUrl()}/${action}`, { method: 'POST', body: JSON.stringify({ to: email }) });
/** From now on the mail provider refuses mail to this address. */
export const failMailTo = (email: string) => control('__fail', email);
export const healMailTo = (email: string) => control('__heal', email);

// ---------------------------------------------------------------------------------------------
// Database, for what a test cannot do through the app: suspend an account, grant credits, read the audit log.
// ---------------------------------------------------------------------------------------------

let client: ReturnType<typeof postgres> | undefined;
export const sql = () => (client ??= postgres(inject('databaseUrl'), { max: 2 }));
export async function closeDb() {
  await client?.end();
  client = undefined;
}
export async function giveCredits(email: string, credits: number) {
  await sql()`update users set credits = ${credits} where email = ${email}`;
}

// ---------------------------------------------------------------------------------------------
// People and certificates
// ---------------------------------------------------------------------------------------------

export type Account = { browser: Browser; email: string; password: string };

/** Signs up through the real endpoint. The browser is left signed in, as after sign-up in the app. */
export async function signUp(label = 'user'): Promise<Account> {
  const browser = new Browser();
  const email = uniqueEmail(label);
  const res = await browser.post('/api/auth/register', { name: 'E2E Tester', email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Sign-up failed: ${res.status} ${res.text}`);
  return { browser, email, password: PASSWORD };
}

/** Signs up and follows the confirmation link from the email, as a person would. */
export async function signUpConfirmed(label = 'user'): Promise<Account> {
  const account = await signUp(label);
  const [mail] = await waitForMail(account.email);
  const res = await account.browser.post('/api/auth/verify-email', { token: tokenIn(mail) });
  if (res.status !== 200) throw new Error(`Confirming the address failed: ${res.status} ${res.text}`);
  return account;
}

/** A second browser signing in to an existing account. */
export async function signIn(account: Pick<Account, 'email' | 'password'>, browser = new Browser()) {
  const reply = await browser.post('/api/auth/login', { email: account.email, password: account.password });
  return { browser, reply };
}

export const design = () => presetDesign('classic-ledger');
export const recipient = (name: string, course = 'Foundations of Data Analysis') => ({ values: { recipient_name: name, course, issue_date: '' } });

export function issue(browser: Browser, names: string[], mode: 'single' | 'bulk' = 'single', extra: Record<string, unknown> = {}) {
  return browser.post('/api/issue', { design: design(), mode, recipients: names.map((name) => recipient(name)), ...extra });
}

export const SERIAL = /^ATT-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/;

// ---------------------------------------------------------------------------------------------
// Google. The person's part, at Google's consent screen, is played against the stand-in (setup.ts).
// ---------------------------------------------------------------------------------------------

export type GooglePerson = { sub: string; email: string; name?: string; email_verified?: boolean; claims?: Record<string, unknown> };
let googleCounter = 0;
export const googlePerson = (label = 'google', extra: Partial<GooglePerson> = {}): GooglePerson => ({
  sub: `${Date.now()}${++googleCounter}`,
  email: uniqueEmail(label),
  name: 'Google Person',
  ...extra,
});

/**
 * "Continue with Google" as a browser does it: the app sends it to Google, the person chooses an
 * account (or `deny`s), and Google sends it back. Returns the app's answer to that return, which is a
 * redirect: into the app, or to the sign-in page with the reason.
 */
export async function continueWithGoogle(browser: Browser, person: GooglePerson | 'deny', next?: string) {
  const start = await browser.get(`/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  if (start.status !== 307) throw new Error(`Starting Google sign-in answered ${start.status}: ${start.text.slice(0, 200)}`);
  const atGoogle = new URL(start.headers.get('location')!);
  if (person === 'deny') atGoogle.searchParams.set('deny', '1');
  else atGoogle.searchParams.set('as', Buffer.from(JSON.stringify(person)).toString('base64url'));
  const consent = await fetch(atGoogle, { redirect: 'manual' });
  if (consent.status !== 302) throw new Error(`The Google stand-in refused the request the app made: ${consent.status} ${await consent.text()}`);
  const back = new URL(consent.headers.get('location')!);
  // Google's redirect back is a navigation from another site, so it carries no Origin of ours.
  return browser.get(back.pathname + back.search, { sameOrigin: false, headers: { 'Sec-Fetch-Site': 'cross-site' } });
}

// ---------------------------------------------------------------------------------------------
// SSLCommerz. The customer's part, on its payment page, is played against the stand-in (setup.ts).
// ---------------------------------------------------------------------------------------------

export const sslcommerzUrl = () => inject('sslcommerzUrl');

export type PostBack = { url: string; ipn: string; fields: Record<string, string> };

/** The customer pays, fails or cancels on SSLCommerz's page: what SSLCommerz then posts back to the app, and where. */
export async function atSslcommerz(tranId: string, outcome: 'success' | 'fail' | 'cancel', extra: { risky?: boolean; amount?: string } = {}): Promise<PostBack> {
  const res = await fetch(`${sslcommerzUrl()}/__pay`, { method: 'POST', body: JSON.stringify({ tranId, outcome, ...extra }) });
  if (!res.ok) throw new Error(`The SSLCommerz stand-in has no checkout ${tranId}: ${res.status}`);
  return (await res.json()) as PostBack;
}

export const sslcommerzMode = (mode: { init?: 'ok' | 'fail'; validation?: 'ok' | 'down' }) =>
  fetch(`${sslcommerzUrl()}/__mode`, { method: 'POST', body: JSON.stringify(mode) });

/**
 * A form posted from another site, as SSLCommerz's page (through the customer's browser) and its
 * server post to the app: no Origin of ours, and no cookies, since the session cookie is SameSite=Lax.
 */
export function postFromSslcommerz(url: string, fields: Record<string, string>) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: 'https://sandbox.sslcommerz.com', 'Sec-Fetch-Site': 'cross-site', 'x-forwarded-for': freshIp() },
    body: new URLSearchParams(fields),
    redirect: 'manual',
  });
}
