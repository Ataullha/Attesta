import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { createSession } from '@/lib/auth/session';
import {
  exchangeCode,
  GOOGLE_COOKIE,
  GOOGLE_COOKIE_PATH,
  googleConfigured,
  googleFailurePath,
  GoogleSignInError,
  identityFromIdToken,
  openAttempt,
  sameState,
  type GoogleFailure,
} from '@/lib/auth/google';
import { accountForGoogle } from '@/lib/auth/google-account';
import { hashIp } from '@/lib/security/crypto';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, HttpError } from '@/lib/security/request';
import { safeNextPath } from '@/lib/safe-redirect';

/**
 * Where Google sends the browser back to. Every outcome is a redirect: into the app when it worked,
 * otherwise to the sign-in page with the reason, so the person is never left on a bare error.
 */
export async function GET(req: NextRequest) {
  // redirect() works by throwing, so it is called here, outside the try in finish().
  redirect(await finish(req));
}

async function finish(req: NextRequest) {
  const jar = await cookies();
  const attempt = openAttempt(jar.get(GOOGLE_COOKIE)?.value);
  // Used once, whatever happens next.
  jar.set(GOOGLE_COOKIE, '', { path: GOOGLE_COOKIE_PATH, maxAge: 0 });
  const next = attempt?.next ? safeNextPath(attempt.next) : '';
  const params = req.nextUrl.searchParams;

  try {
    if (!googleConfigured()) throw new GoogleSignInError('unavailable');
    const error = params.get('error');
    if (error) throw new GoogleSignInError(error === 'access_denied' ? 'cancelled' : 'failed', `Google answered ${error}`);
    if (!attempt) throw new GoogleSignInError('expired', 'no sign-in was in progress in this browser');
    if (!sameState(params.get('state') ?? '', attempt.state)) throw new GoogleSignInError('expired', 'the state does not match');
    const code = params.get('code');
    if (!code || code.length > 2000) throw new GoogleSignInError('failed', 'Google sent no code');

    const ip = hashIp(await clientIp());
    await rateLimit(`google:${ip}`, 30, 900);
    const identity = identityFromIdToken(await exchangeCode(code, attempt.verifier), { clientId: process.env.GOOGLE_CLIENT_ID ?? '', nonce: attempt.nonce });
    const account = await accountForGoogle(identity, ip);
    await createSession(account.id);
    return next || (account.role === 'admin' ? '/admin' : '/app');
  } catch (err) {
    const reason: GoogleFailure = err instanceof GoogleSignInError ? err.reason : err instanceof HttpError && err.status === 429 ? 'busy' : 'failed';
    // A refusal the person can act on is not news; anything else is something the operator needs to see,
    // such as a wrong client secret or a redirect address Google does not know.
    if (reason === 'failed') console.error('Google sign-in failed:', err instanceof Error ? err.message : err);
    return googleFailurePath(reason, next);
  }
}
