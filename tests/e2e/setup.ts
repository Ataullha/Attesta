import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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
 *   2. the mail stand-in and the Google stand-in;
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

  const [appPort, mailPort, googlePort] = [await freePort(), await freePort(), await freePort()];
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const mailUrl = `http://127.0.0.1:${mailPort}`;
  const googleUrl = `http://127.0.0.1:${googlePort}`;
  const mail = await startMailServer(mailPort);
  const google = await startGoogleServer(googlePort, `${baseUrl}/api/auth/google/callback`);

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
  project.provide('databaseUrl', databaseUrl);

  return async function teardown() {
    stop();
    await new Promise((r) => mail.close(r));
    await new Promise((r) => google.close(r));
    console.info(`\nThe app's own log for this run: ${logPath}`);
  };
}
