import 'server-only';
import { createHash, timingSafeEqual } from 'node:crypto';
import { signatureMatches, signValue } from '@/lib/security/crypto';
import { site } from '@/lib/site';

/**
 * Sign in with Google: OpenID Connect's authorisation code flow, with PKCE, a state value and a
 * nonce. It is on when both settings are present, and the sign-in pages offer it only then.
 */
export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Overridable so the end-to-end tests can stand in for Google, as they do for the mail provider.
const authUrl = () => process.env.GOOGLE_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth';
const tokenUrl = () => process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token';

/** Must be listed exactly, character for character, among the client's authorised redirect URIs. */
export const googleRedirectUri = () => `${site.url}/api/auth/google/callback`;

/** Why a Google sign-in ended without one; the sign-in page explains each. */
export type GoogleFailure = 'cancelled' | 'expired' | 'unverified' | 'throwaway' | 'suspended' | 'other_google' | 'busy' | 'failed' | 'unavailable';

/** What the sign-in page says for each of them. */
export const GOOGLE_FAILURE_MESSAGES: Record<GoogleFailure, string> = {
  cancelled: 'Google sign-in was cancelled. Try again, or use your email and password.',
  expired: 'That Google sign-in took too long, or began in another browser. Please try again.',
  unverified: 'Google has not confirmed that email address yet, so it cannot be used to sign in here.',
  throwaway: 'Use a permanent email address — temporary inboxes are not accepted.',
  suspended: 'This account has been suspended. Contact support if you think this is a mistake.',
  other_google: 'That email address belongs to an account linked to a different Google account. Use that one, or your password.',
  busy: 'Too many sign-ins from your network just now. Try again in a little while.',
  failed: 'Google sign-in did not work. Try again, or use your email and password.',
  unavailable: 'Google sign-in is not available here. Use your email and password.',
};

export function googleFailurePath(reason: GoogleFailure, next: string) {
  return `/login?${new URLSearchParams({ google: reason, ...(next ? { next } : {}) })}`;
}

export class GoogleSignInError extends Error {
  constructor(
    public reason: GoogleFailure,
    /** For the server log; the person sees the message for `reason`. */
    detail: string = reason,
  ) {
    super(detail);
  }
}

/**
 * One sign-in in progress, kept in a cookie between leaving for Google and coming back. It is signed,
 * so a cookie planted by someone else (to sign this browser in to their account) is refused.
 */
export type GoogleAttempt = { state: string; nonce: string; verifier: string; next: string };

export const GOOGLE_COOKIE = 'att_google';
/** The cookie is sent only to the two Google routes. */
export const GOOGLE_COOKIE_PATH = '/api/auth/google';

export function sealAttempt(attempt: GoogleAttempt) {
  const value = Buffer.from(JSON.stringify(attempt)).toString('base64url');
  return `${value}.${signValue(value)}`;
}

export function openAttempt(sealed: string | undefined): GoogleAttempt | null {
  if (!sealed || sealed.length > 2000) return null;
  const dot = sealed.lastIndexOf('.');
  const value = sealed.slice(0, dot);
  if (dot < 1 || !signatureMatches(value, sealed.slice(dot + 1))) return null;
  try {
    const a = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (typeof a.state === 'string' && typeof a.nonce === 'string' && typeof a.verifier === 'string' && typeof a.next === 'string') {
      return { state: a.state, nonce: a.nonce, verifier: a.verifier, next: a.next };
    }
  } catch {
    // not ours
  }
  return null;
}

export function sameState(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function codeChallenge(verifier: string) {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function googleAuthUrl({ state, nonce, verifier }: { state: string; nonce: string; verifier: string }) {
  const url = new URL(authUrl());
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge(verifier),
    code_challenge_method: 'S256',
    // Lets someone with several Google accounts choose, rather than being signed in with whichever is current.
    prompt: 'select_account',
  }).toString();
  return url.toString();
}

/** Trades the one-time code Google sent back for the person's ID token. */
export async function exchangeCode(code: string, verifier: string) {
  let res: Response;
  try {
    res = await fetch(tokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: googleRedirectUri(),
        client_id: process.env.GOOGLE_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new GoogleSignInError('failed', `token request failed: ${(err as Error).message}`);
  }
  const body = (await res.json().catch(() => ({}))) as { id_token?: unknown; error?: unknown };
  if (!res.ok || typeof body.id_token !== 'string') throw new GoogleSignInError('failed', `token endpoint answered ${res.status} ${String(body.error ?? '')}`);
  return body.id_token;
}

export type GoogleIdentity = { sub: string; email: string; name: string };

const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
/** Leeway for the difference between our clock and Google's. */
const SKEW_SECONDS = 120;

/**
 * Reads the ID token that `exchangeCode` returned and checks its claims: who issued it, that it was
 * issued to us, for this sign-in (the nonce), that it is current, and that Google has verified the
 * address. Its signature is not checked: the token came straight from Google's token endpoint over
 * HTTPS, in answer to a request made with our client secret, and OpenID Connect accepts that in
 * place of the signature (Core 1.0, section 3.1.3.7).
 */
export function identityFromIdToken(idToken: string, expected: { clientId: string; nonce: string; now?: number }): GoogleIdentity {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new GoogleSignInError('failed', 'the ID token is not a JWT');
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    throw new GoogleSignInError('failed', 'the ID token could not be read');
  }
  const now = Math.floor((expected.now ?? Date.now()) / 1000);
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

  if (!ISSUERS.has(String(claims.iss))) throw new GoogleSignInError('failed', `unexpected issuer ${String(claims.iss)}`);
  if (!expected.clientId || !audiences.includes(expected.clientId)) throw new GoogleSignInError('failed', 'the ID token was issued to another client');
  // With several audiences, the party it was issued to must be us.
  if (audiences.length > 1 && claims.azp !== expected.clientId) throw new GoogleSignInError('failed', 'the ID token was issued to another party');
  if (typeof claims.exp !== 'number' || claims.exp + SKEW_SECONDS < now) throw new GoogleSignInError('failed', 'the ID token has expired');
  if (typeof claims.iat === 'number' && claims.iat - SKEW_SECONDS > now) throw new GoogleSignInError('failed', 'the ID token was issued in the future');
  if (!expected.nonce || claims.nonce !== expected.nonce) throw new GoogleSignInError('failed', 'the ID token is for a different sign-in');
  if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 255) throw new GoogleSignInError('failed', 'the ID token names no account');
  if (typeof claims.email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(claims.email) || claims.email.length > 200) {
    throw new GoogleSignInError('failed', 'the ID token carries no usable email address');
  }
  // Google states this for every Gmail and Workspace address; for others it is true only once confirmed.
  if (claims.email_verified !== true && claims.email_verified !== 'true') throw new GoogleSignInError('unverified');

  return { sub: claims.sub, email: claims.email.toLowerCase(), name: typeof claims.name === 'string' ? claims.name.trim() : '' };
}
