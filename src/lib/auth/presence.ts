/**
 * A marker that says "this browser has a session", readable by scripts.
 *
 * The real session cookie is httpOnly, so client code cannot tell whether someone is signed in.
 * The marketing pages are statically rendered and must stay that way, so they cannot ask the
 * server either. This second cookie carries no secret and grants nothing: it only lets the page
 * header swap "Sign in" for "Dashboard" after load. It shares the session's expiry, and the
 * server still checks the real session on every protected page, so a stale marker costs a
 * redirect to the sign-in page and nothing more.
 */
export const PRESENCE_COOKIE = 'att_in';

export function hasPresenceCookie(cookieString: string) {
  return cookieString.split(';').some((part) => part.trim() === `${PRESENCE_COOKIE}=1`);
}
