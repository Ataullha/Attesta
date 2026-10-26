const PLACEHOLDER_ORIGIN = 'http://attesta.invalid';

const isSitePath = (path: string) => path.startsWith('/') && !path.startsWith('//');

/**
 * Returns `next` only when it is a path on this site, otherwise `fallback`.
 *
 * Checking for a leading `/` and no `//` is not enough: browsers treat `\` like `/` and strip
 * tabs and newlines while parsing, so `/\evil.com` and `/<tab>/evil.com` both end up on another
 * origin. Backslashes and control characters are therefore refused outright, and whatever
 * remains is parsed to confirm it really stays on our origin.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/app'): string {
  if (!next || next.length > 2000) return fallback;
  if (/[\\\u0000-\u001F\u007F]/.test(next)) return fallback;
  if (!isSitePath(next)) return fallback;
  try {
    const url = new URL(next, PLACEHOLDER_ORIGIN);
    const normalised = url.pathname + url.search + url.hash;
    // Dot-segment removal can turn `/.//evil.com` into `//evil.com`, so the string actually
    // returned is checked again rather than trusting the one that was checked on the way in.
    return url.origin === PLACEHOLDER_ORIGIN && isSitePath(normalised) ? normalised : fallback;
  } catch {
    return fallback;
  }
}
