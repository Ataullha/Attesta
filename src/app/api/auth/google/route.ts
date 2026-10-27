import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, googleAuthUrl, googleConfigured, googleFailurePath, sealAttempt } from '@/lib/auth/google';
import { randomToken } from '@/lib/security/crypto';
import { safeNextPath } from '@/lib/safe-redirect';

/**
 * "Continue with Google": remembers this attempt in a short-lived cookie, then sends the browser to
 * Google. Reached by a link rather than a form, because the content security policy only lets forms
 * post to this site, and that includes where a form's redirect leads.
 */
export async function GET(req: NextRequest) {
  const asked = req.nextUrl.searchParams.get('next');
  const next = asked ? safeNextPath(asked) : '';
  if (!googleConfigured()) redirect(googleFailurePath('unavailable', next));

  const attempt = { state: randomToken(24), nonce: randomToken(24), verifier: randomToken(48), next };
  (await cookies()).set(GOOGLE_COOKIE, sealAttempt(attempt), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Lax, so the cookie comes back with Google's redirect, which is a top-level navigation from another site.
    sameSite: 'lax',
    path: GOOGLE_COOKIE_PATH,
    maxAge: 600,
  });
  redirect(googleAuthUrl(attempt));
}
