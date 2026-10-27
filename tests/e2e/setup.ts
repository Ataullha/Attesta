import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { closeSync, existsSync, mkdtempSync, openSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createServer as createSocketServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postgres from 'postgres';
import type { TestProject } from 'vitest/node';
import { assertTestDatabase, setupError } from '../setup/test-db';

declare module 'vitest' {
  export interface ProvidedContext {
    /** Where the app answers, e.g. http://127.0.0.1:41233 */
    baseUrl: string;
    /** The stand-in mail provider the app posts to (see startMailServer). */
    mailUrl: string;
    /** The stand-in for Google's sign-in endpoints (see startGoogleServer). */
    googleUrl: string;
    /** The stand-in for SSLCommerz, the payment gateway (see startSslcommerzServer). */
    sslcommerzUrl: string;
    databaseUrl: string;
  }
}

const root = process.cwd();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createSocketServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

function readBody(req: IncomingMessage) {
  return new Promise<string>((resolve) => {
    let text = '';
    req.setEncoding('utf8');
    req.on('data', (c) => (text += c));
    req.on('end', () => resolve(text));
  });
}

type Attempt = { to: string; from: string; subject: string; text: string; delivered: boolean };

/**
 * A stand-in for Resend's HTTP API. It records every message the app sends, so a test can read the
 * confirmation or reset link the way a person would, and it can be told that one address's mail
 * fails, to see what the app does when its provider is down.
 *
 *   POST /emails            what the app calls (Resend's shape)
 *   GET  /__attempts?to=    every attempt, delivered or not, as JSON
 *   POST /__fail {to}       make mail to this address fail with a 503
 *   POST /__heal {to}       stop failing it
 */
function startMailServer(port: number): Promise<Server> {
  const attempts: Attempt[] = [];
  const failing = new Set<string>();
  const reply = (res: ServerResponse, status: number, body: unknown = {}) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const handle = (req: IncomingMessage, res: ServerResponse, url: URL, body: string) => {
    if (req.method === 'POST' && url.pathname === '/emails') {
      const m = JSON.parse(body) as { to: string; from: string; subject: string; text: string };
      const to = String(m.to).toLowerCase();
      const delivered = !failing.has(to);
      attempts.push({ to, from: m.from, subject: m.subject, text: m.text, delivered });
      return delivered ? reply(res, 200, { id: `msg_${attempts.length}` }) : reply(res, 503, { message: 'The provider is unavailable.' });
    }
    if (req.method === 'GET' && url.pathname === '/__attempts') {
      const to = url.searchParams.get('to')?.toLowerCase();
      return reply(res, 200, attempts.filter((a) => !to || a.to === to));
    }
    if (req.method === 'POST' && (url.pathname === '/__fail' || url.pathname === '/__heal')) {
      const to = String((JSON.parse(body) as { to: string }).to).toLowerCase();
      if (url.pathname === '/__fail') failing.add(to);
      else failing.delete(to);
      return reply(res, 200);
    }
    return reply(res, 404);
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://mail.invalid');
    const body = await readBody(req);
    try {
      handle(req, res, url, body);
    } catch {
      reply(res, 400, { message: 'bad request' });
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export const GOOGLE_CLIENT = { id: 'e2e-client.apps.googleusercontent.com', secret: 'e2e-google-secret' };

/**
 * A stand-in for Google's sign-in (OpenID Connect) endpoints, as strict as Google about what the app
 * sends: its client id and secret, the redirect address, PKCE, and that a code is used once.
 * A test plays the person at Google's consent screen by adding `as` (who they are: base64url JSON,
 * with `claims` to override anything in the ID token) or `deny=1` to the address the app sent the
 * browser to; the stand-in then sends the browser back as Google would.
 *
 *   GET  /auth     where the app sends the browser
 *   POST /token    what the app calls to trade the code for an ID token
 */
function startGoogleServer(port: number, redirectUri: string): Promise<Server> {
  type Grant = { identity: Record<string, unknown>; nonce: string; challenge: string; used: boolean };
  const grants = new Map<string, Grant>();
  const reply = (res: ServerResponse, status: number, body: unknown = {}) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const handle = (req: IncomingMessage, res: ServerResponse, url: URL, body: string) => {
    if (req.method === 'GET' && url.pathname === '/auth') {
      const p = url.searchParams;
      const wrong = [
        p.get('client_id') !== GOOGLE_CLIENT.id && 'client_id',
        p.get('redirect_uri') !== redirectUri && 'redirect_uri',
        p.get('response_type') !== 'code' && 'response_type',
        !(p.get('scope') ?? '').split(' ').includes('openid') && 'scope',
        p.get('code_challenge_method') !== 'S256' && 'code_challenge_method',
        !p.get('code_challenge') && 'code_challenge',
        !p.get('state') && 'state',
        !p.get('nonce') && 'nonce',
      ].filter(Boolean);
      if (wrong.length) return reply(res, 400, { error: 'invalid_request', wrong });
      const back = new URL(redirectUri);
      if (p.get('deny')) back.searchParams.set('error', 'access_denied');
      else {
        const code = `e2e-code-${grants.size + 1}-${Math.random().toString(36).slice(2)}`;
        const identity = JSON.parse(Buffer.from(p.get('as') ?? '', 'base64url').toString('utf8') || '{}') as Record<string, unknown>;
        grants.set(code, { identity, nonce: p.get('nonce')!, challenge: p.get('code_challenge')!, used: false });
        back.searchParams.set('code', code);
      }
      back.searchParams.set('state', p.get('state')!);
      res.writeHead(302, { location: back.toString() });
      return res.end();
    }
    if (req.method === 'POST' && url.pathname === '/token') {
      const f = new URLSearchParams(body);
      if (f.get('client_id') !== GOOGLE_CLIENT.id || f.get('client_secret') !== GOOGLE_CLIENT.secret) return reply(res, 401, { error: 'invalid_client' });
      const grant = grants.get(f.get('code') ?? '');
      if (f.get('grant_type') !== 'authorization_code' || f.get('redirect_uri') !== redirectUri || !grant || grant.used) return reply(res, 400, { error: 'invalid_grant' });
      if (createHash('sha256').update(f.get('code_verifier') ?? '').digest('base64url') !== grant.challenge) return reply(res, 400, { error: 'invalid_grant', error_description: 'code_verifier' });
      grant.used = true;
      const now = Math.floor(Date.now() / 1000);
      const { claims, ...person } = grant.identity as { claims?: Record<string, unknown> };
      const payload = { iss: 'https://accounts.google.com', azp: GOOGLE_CLIENT.id, aud: GOOGLE_CLIENT.id, email_verified: true, iat: now, exp: now + 3600, nonce: grant.nonce, ...person, ...claims };
      const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      return reply(res, 200, { access_token: 'e2e-access', token_type: 'Bearer', expires_in: 3599, scope: 'openid email profile', id_token: `${part({ alg: 'RS256', kid: 'e2e' })}.${part(payload)}.e2e-signature` });
    }
    return reply(res, 404);
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://google.invalid');
    const body = await readBody(req);
    try {
      handle(req, res, url, body);
    } catch {
      reply(res, 400, { error: 'bad request' });
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export const SSLCOMMERZ_STORE = { id: 'attesta-e2e', password: 'attesta-e2e@ssl' };

/** What SSLCommerz's session API refuses to open a checkout without. */
const SSLCOMMERZ_REQUIRED = [
  'store_id', 'store_passwd', 'tran_id', 'total_amount', 'currency', 'success_url', 'fail_url', 'cancel_url',
  'cus_name', 'cus_email', 'cus_add1', 'cus_city', 'cus_postcode', 'cus_country', 'cus_phone',
  'shipping_method', 'product_name', 'product_category', 'product_profile',
];

/**
 * A stand-in for SSLCommerz: its session API, its validation APIs, and its payment page, which posts
 * back to the app as SSLCommerz does. A test plays the customer at the payment page with /__pay,
 * then posts what it returns to the app itself, as the browser (to `url`) or as SSLCommerz's server
 * (to `ipn`), in whatever order and as often as it likes.
 *
 *   POST /gwprocess/v4/api.php                            what the app calls to open a checkout
 *   GET  /validator/api/validationserverAPI.php           a payment by val_id: VALID the first time, VALIDATED after
 *   GET  /validator/api/merchantTransIDvalidationAPI.php  the payments for a tran_id
 *   GET  /pay/:sessionkey                                 the payment page, for a person to click through
 *   POST /__pay {tranId, outcome, risky?, amount?}        the customer pays (success), fails or cancels: the fields to post back, and where
 *   GET  /__session?tranId=                               what the app sent to open that checkout
 *   GET  /__calls?valId=                                  how many times the app asked about that payment
 *   POST /__mode {init?, validation?}                     'fail' every new checkout, or take the validation API 'down'; 'ok' undoes it
 */
function startSslcommerzServer(port: number): Promise<Server> {
  const base = `http://127.0.0.1:${port}`;
  type Session = { fields: Record<string, string>; sessionkey: string };
  type Payment = Record<string, string> & { tran_id: string; val_id: string };
  const sessions = new Map<string, Session>();
  const payments = new Map<string, Payment & { validated?: boolean }>();
  const calls = new Map<string, number>();
  const mode = { init: 'ok', validation: 'ok' };
  let counter = 0;

  const reply = (res: ServerResponse, status: number, body: unknown = {}) => {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const asStored = ({ validated, ...p }: Payment & { validated?: boolean }) => ({ ...p, status: validated ? 'VALIDATED' : 'VALID' });

  /** The customer's turn on the payment page: what SSLCommerz posts back afterwards, and where. */
  const pay = (tranId: string, outcome: string, { risky = false, amount }: { risky?: boolean; amount?: string } = {}) => {
    const s = sessions.get(tranId);
    if (!s) return null;
    const f = s.fields;
    const common = { tran_id: tranId, currency: 'BDT', currency_type: f.currency, currency_amount: f.total_amount, tran_date: new Date().toISOString().slice(0, 19).replace('T', ' '), value_a: '', verify_sign: 'not-checked', verify_key: 'status,tran_id' };
    if (outcome === 'fail') return { url: f.fail_url, ipn: f.ipn_url, fields: { ...common, status: 'FAILED', amount: f.total_amount, error: 'Declined by the bank', bank_tran_id: '' } };
    if (outcome === 'cancel') return { url: f.cancel_url, ipn: f.ipn_url, fields: { ...common, status: 'CANCELLED', amount: f.total_amount, error: 'Cancelled by the customer' } };
    const paid = amount ?? f.total_amount;
    const payment: Payment = {
      ...common,
      tran_id: tranId,
      val_id: `${Date.now()}${++counter}E2E${randomBytes(4).toString('hex')}`,
      amount: paid,
      store_amount: (Number(paid) * 0.975).toFixed(2),
      bank_tran_id: `BT${randomBytes(5).toString('hex').toUpperCase()}`,
      card_type: 'BKASH-BKash',
      card_brand: 'MOBILEBANKING',
      card_issuer: 'BKash Mobile Banking',
      risk_level: risky ? '1' : '0',
      risk_title: risky ? 'Not Safe' : 'Safe',
    };
    payments.set(payment.val_id, payment);
    return { url: f.success_url, ipn: f.ipn_url, fields: { ...payment, status: 'VALID' } };
  };

  /** A page that posts the fields to the app straight away, as SSLCommerz's page does when it is done. */
  const postPage = (url: string, fields: Record<string, string>) =>
    `<!doctype html><title>SSLCommerz stand-in</title><form method="post" action="${url}">${Object.entries(fields)
      .map(([k, v]) => `<input type="hidden" name="${k}" value="${String(v).replace(/"/g, '&quot;')}">`)
      .join('')}</form><script>document.forms[0].submit()</script>`;

  const handle = async (req: IncomingMessage, res: ServerResponse, url: URL, body: string) => {
    const q = url.searchParams;
    const storeOk = q.get('store_id') === SSLCOMMERZ_STORE.id && q.get('store_passwd') === SSLCOMMERZ_STORE.password;

    if (req.method === 'POST' && url.pathname === '/gwprocess/v4/api.php') {
      const form = await new Request(base, { method: 'POST', headers: { 'content-type': req.headers['content-type'] ?? '' }, body }).formData();
      const f = Object.fromEntries([...form].map(([k, v]) => [k, String(v)]));
      if (f.store_id !== SSLCOMMERZ_STORE.id || f.store_passwd !== SSLCOMMERZ_STORE.password) return reply(res, 200, { status: 'FAILED', failedreason: 'Store Credential Error Or Store is De-active' });
      if (mode.init === 'fail') return reply(res, 200, { status: 'FAILED', failedreason: 'The stand-in was told to fail' });
      const missing = SSLCOMMERZ_REQUIRED.filter((k) => !f[k]);
      if (missing.length) return reply(res, 200, { status: 'FAILED', failedreason: `Missing ${missing.join(', ')}` });
      if (sessions.has(f.tran_id)) return reply(res, 200, { status: 'FAILED', failedreason: 'Duplicate tran_id' });
      const sessionkey = randomBytes(16).toString('hex').toUpperCase();
      sessions.set(f.tran_id, { fields: f, sessionkey });
      return reply(res, 200, { status: 'SUCCESS', failedreason: '', sessionkey, GatewayPageURL: `${base}/pay/${sessionkey}` });
    }
    if (req.method === 'GET' && url.pathname === '/validator/api/validationserverAPI.php') {
      if (mode.validation === 'down') return reply(res, 503, { error: 'down' });
      if (!storeOk) return reply(res, 200, { APIConnect: 'FAILED' });
      const valId = q.get('val_id') ?? '';
      calls.set(valId, (calls.get(valId) ?? 0) + 1);
      const p = payments.get(valId);
      if (!p) return reply(res, 200, { status: 'INVALID_TRANSACTION', APIConnect: 'DONE' });
      const answer = asStored(p);
      p.validated = true;
      return reply(res, 200, { ...answer, validated_on: new Date().toISOString(), APIConnect: 'DONE', gw_version: '' });
    }
    if (req.method === 'GET' && url.pathname === '/validator/api/merchantTransIDvalidationAPI.php') {
      if (mode.validation === 'down') return reply(res, 503, { error: 'down' });
      if (!storeOk) return reply(res, 200, { APIConnect: 'FAILED' });
      const element = [...payments.values()].filter((p) => p.tran_id === q.get('tran_id')).map(asStored);
      return reply(res, 200, { APIConnect: 'DONE', no_of_trans_found: element.length, element });
    }
    const page = url.pathname.match(/^\/pay\/([0-9A-F]+)(?:\/(success|fail|cancel))?$/);
    if (req.method === 'GET' && page) {
      const s = [...sessions.values()].find((x) => x.sessionkey === page[1]);
      if (!s) return reply(res, 404);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      if (!page[2]) {
        return res.end(`<!doctype html><title>SSLCommerz stand-in</title><h1>Pay ৳${s.fields.total_amount} to ${s.fields.cus_name}'s order</h1><p>${s.fields.product_name}</p>${['success', 'fail', 'cancel']
          .map((o) => `<p><a href="/pay/${s.sessionkey}/${o}">${o === 'success' ? 'Pay' : o === 'fail' ? 'Fail the payment' : 'Cancel'}</a></p>`)
          .join('')}`);
      }
      const back = pay(s.fields.tran_id, page[2])!;
      // SSLCommerz's own server tells the app as well, a moment later.
      if (back.ipn) setTimeout(() => void fetch(back.ipn, { method: 'POST', body: new URLSearchParams(back.fields) }).catch(() => {}), 300);
      return res.end(postPage(back.url, back.fields));
    }
    if (req.method === 'POST' && url.pathname === '/__pay') {
      const { tranId, outcome, ...extra } = JSON.parse(body) as { tranId: string; outcome: string; risky?: boolean; amount?: string };
      const back = pay(tranId, outcome, extra);
      return back ? reply(res, 200, back) : reply(res, 404, { error: 'no such checkout' });
    }
    if (req.method === 'GET' && url.pathname === '/__session') {
      const s = sessions.get(q.get('tranId') ?? '');
      return s ? reply(res, 200, s) : reply(res, 404);
    }
    if (req.method === 'GET' && url.pathname === '/__calls') return reply(res, 200, { calls: calls.get(q.get('valId') ?? '') ?? 0 });
    if (req.method === 'POST' && url.pathname === '/__mode') {
      Object.assign(mode, JSON.parse(body));
      return reply(res, 200, mode);
    }
    return reply(res, 404);
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', base);
    const body = await readBody(req);
    try {
      await handle(req, res, url, body);
    } catch {
      reply(res, 400, { error: 'bad request' });
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

function newestModification(dir: string): number {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestModification(path) : statSync(path).mtimeMs);
  }
  return newest;
}

function tail(path: string, lines = 60) {
  try {
    return readFileSync(path, 'utf8').trim().split('\n').slice(-lines).join('\n');
  } catch {
    return '(no log)';
  }
}

/**
 * Starts the built app and everything around it, once, for every end-to-end test file:
 *   1. the test database, migrated;
 *   2. the stand-ins for mail, Google and SSLCommerz;
 *   3. `next start` on a free port, with its own freshly generated signing keys.
 *
 * Needs TEST_DATABASE_URL (a database whose name contains "test") and a current `npm run build`.
 */
export default async function setup(project: TestProject) {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) throw setupError('End-to-end tests need TEST_DATABASE_URL, e.g. postgres://user:pass@127.0.0.1:5432/attesta_test (the name must contain "test").');
  assertTestDatabase(databaseUrl);

  const built = join(root, '.next', 'BUILD_ID');
  if (!existsSync(built)) throw setupError('There is no production build. Run `npm run build` first.');
  if (statSync(built).mtimeMs < newestModification(join(root, 'src'))) {
    throw setupError('The production build is older than the source, so these tests would not be testing it. Run `npm run build` again.');
  }

  const migrate = spawnSync(process.execPath, ['scripts/migrate.mjs'], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_URL_UNPOOLED: '' }, encoding: 'utf8' });
  if (migrate.status !== 0) throw setupError(`Migrating the test database failed:\n${migrate.stdout}\n${migrate.stderr}`);
  // Earlier runs leave their limiter counters behind; start from none.
  const sql = postgres(databaseUrl, { max: 1 });
  await sql`delete from rate_limits`;
  await sql.end();

  const keys = Object.fromEntries(
    execFileSync(process.execPath, ['scripts/generate-keys.mjs'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
      .split('\n')
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  );

  const [appPort, mailPort, googlePort, sslcommerzPort] = [await freePort(), await freePort(), await freePort(), await freePort()];
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const mailUrl = `http://127.0.0.1:${mailPort}`;
  const googleUrl = `http://127.0.0.1:${googlePort}`;
  const sslcommerzUrl = `http://127.0.0.1:${sslcommerzPort}`;
  const mail = await startMailServer(mailPort);
  const google = await startGoogleServer(googlePort, `${baseUrl}/api/auth/google/callback`);
  const sslcommerz = await startSslcommerzServer(sslcommerzPort);

  const logPath = join(mkdtempSync(join(tmpdir(), 'attesta-e2e-')), 'server.log');
  const log = openSync(logPath, 'a');
  const app = spawn(process.execPath, [join(root, 'node_modules/next/dist/bin/next'), 'start', '-p', String(appPort), '-H', '127.0.0.1'], {
    cwd: root,
    // Its own process group, so stopping it also stops the server process it starts.
    detached: true,
    stdio: ['ignore', log, log],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      // Everything the app reads is set here, so a developer's .env.local cannot leak into a test run.
      DATABASE_URL: databaseUrl,
      DATABASE_URL_UNPOOLED: '',
      APP_URL: baseUrl,
      SIGNING_KEY_ID: keys.SIGNING_KEY_ID,
      SIGNING_PRIVATE_KEY: keys.SIGNING_PRIVATE_KEY,
      SIGNING_PUBLIC_KEY: keys.SIGNING_PUBLIC_KEY,
      SIGNING_PUBLIC_KEYS_OLD: '',
      SECRET_SALT: keys.SECRET_SALT,
      CRON_SECRET: 'e2e-cron-secret',
      RESEND_API_KEY: 'e2e-key',
      EMAIL_FROM: 'Attesta <no-reply@e2e.invalid>',
      RESEND_API_URL: `${mailUrl}/emails`,
      GOOGLE_CLIENT_ID: GOOGLE_CLIENT.id,
      GOOGLE_CLIENT_SECRET: GOOGLE_CLIENT.secret,
      GOOGLE_AUTH_URL: `${googleUrl}/auth`,
      GOOGLE_TOKEN_URL: `${googleUrl}/token`,
      SSLCOMMERZ_STORE_ID: SSLCOMMERZ_STORE.id,
      SSLCOMMERZ_STORE_PASSWORD: SSLCOMMERZ_STORE.password,
      SSLCOMMERZ_API_URL: sslcommerzUrl,
      SSLCOMMERZ_LIVE: '',
    },
  });
  closeSync(log);
  const stop = () => {
    try {
      if (app.pid) process.kill(-app.pid, 'SIGTERM');
    } catch {
      // already gone
    }
  };
  process.once('exit', stop);

  const deadline = Date.now() + 90_000;
  for (;;) {
    if (app.exitCode !== null) throw setupError(`The app exited with code ${app.exitCode} before it was ready.\n${tail(logPath)}`);
    if (Date.now() > deadline) {
      stop();
      throw setupError(`The app was not ready after 90 seconds.\n${tail(logPath)}`);
    }
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) break;
      if (res.status === 503) {
        stop();
        throw setupError(`The app started but reports itself unhealthy: ${await res.text()}\n${tail(logPath)}`);
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('The app started')) throw err;
    }
    await sleep(400);
  }

  project.provide('baseUrl', baseUrl);
  project.provide('mailUrl', mailUrl);
  project.provide('googleUrl', googleUrl);
  project.provide('sslcommerzUrl', sslcommerzUrl);
  project.provide('databaseUrl', databaseUrl);

  return async function teardown() {
    stop();
    await new Promise((r) => mail.close(r));
    await new Promise((r) => google.close(r));
    await new Promise((r) => sslcommerz.close(r));
    console.info(`\nThe app's own log for this run: ${logPath}`);
  };
}
