import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  codeChallenge,
  googleAuthUrl,
  googleConfigured,
  googleFailurePath,
  GoogleSignInError,
  identityFromIdToken,
  openAttempt,
  sameState,
  sealAttempt,
} from '@/lib/auth/google';
import { site } from '@/lib/site';

afterEach(() => vi.unstubAllEnvs());

const CLIENT = 'client-123.apps.googleusercontent.com';
const NOW = Date.UTC(2026, 9, 26, 12, 0, 0);
const nowSeconds = NOW / 1000;

/** An ID token as Google's token endpoint returns one. The signature part is never read. */
function idToken(claims: Record<string, unknown>) {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'RS256', kid: 'k1', typ: 'JWT' })}.${part(claims)}.c2lnbmF0dXJl`;
}
const good = {
  iss: 'https://accounts.google.com',
  azp: CLIENT,
  aud: CLIENT,
  sub: '110169484474386276334',
  email: 'Nusrat.Mim@Gmail.com',
  email_verified: true,
  name: '  Nusrat Jahan Mim ',
  iat: nowSeconds - 10,
  exp: nowSeconds + 3600,
  nonce: 'n-0S6_WzA2Mj',
};
const read = (claims: Record<string, unknown>, nonce = good.nonce) => identityFromIdToken(idToken(claims), { clientId: CLIENT, nonce, now: NOW });
const refusal = (claims: Record<string, unknown>, nonce?: string) => {
  try {
    read(claims, nonce);
  } catch (err) {
    expect(err).toBeInstanceOf(GoogleSignInError);
    return (err as GoogleSignInError).reason;
  }
  throw new Error('the token was accepted');
};

describe('the ID token', () => {
  it('gives the account id, the address in lower case and the name', () => {
    expect(read(good)).toEqual({ sub: good.sub, email: 'nusrat.mim@gmail.com', name: 'Nusrat Jahan Mim' });
    expect(read({ ...good, name: undefined }).name).toBe('');
    expect(read({ ...good, iss: 'accounts.google.com' }).sub).toBe(good.sub); // Google uses both forms
    expect(read({ ...good, email_verified: 'true' }).sub).toBe(good.sub); // and has sent this one as a string
  });

  it('must come from Google, for this app', () => {
    expect(refusal({ ...good, iss: 'https://evil.example' })).toBe('failed');
    expect(refusal({ ...good, aud: 'someone-else.apps.googleusercontent.com' })).toBe('failed');
    expect(refusal({ ...good, aud: [CLIENT, 'other'], azp: 'other' })).toBe('failed');
    expect(read({ ...good, aud: [CLIENT, 'other'], azp: CLIENT }).sub).toBe(good.sub);
  });

  it('must be for this sign-in', () => {
    expect(refusal(good, 'a-different-nonce')).toBe('failed');
    expect(refusal({ ...good, nonce: undefined })).toBe('failed');
  });

  it('must be current, allowing for clocks that differ by a minute or two', () => {
    expect(read({ ...good, exp: nowSeconds - 60 }).sub).toBe(good.sub);
    expect(refusal({ ...good, exp: nowSeconds - 600 })).toBe('failed');
    expect(refusal({ ...good, exp: undefined })).toBe('failed');
    expect(refusal({ ...good, iat: nowSeconds + 600 })).toBe('failed');
  });

  it('must name an account and an address that Google has confirmed', () => {
    expect(refusal({ ...good, sub: '' })).toBe('failed');
    expect(refusal({ ...good, email: 'not an address' })).toBe('failed');
    expect(refusal({ ...good, email_verified: false })).toBe('unverified');
    expect(refusal({ ...good, email_verified: undefined })).toBe('unverified');
  });

  it('must be a token at all', () => {
    expect(() => identityFromIdToken('not-a-token', { clientId: CLIENT, nonce: good.nonce })).toThrow(GoogleSignInError);
    expect(() => identityFromIdToken('a.%%%.c', { clientId: CLIENT, nonce: good.nonce })).toThrow(GoogleSignInError);
  });
});

describe('the request to Google', () => {
  it('uses PKCE as RFC 7636 defines it', () => {
    // The example in RFC 7636, appendix B.
    expect(codeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('asks for a code, for the address and name only, and comes back to this site', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', CLIENT);
    const url = new URL(googleAuthUrl({ state: 'the-state', nonce: 'the-nonce', verifier: 'the-verifier' }));
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: CLIENT,
      redirect_uri: `${site.url}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      state: 'the-state',
      nonce: 'the-nonce',
      code_challenge: codeChallenge('the-verifier'),
      code_challenge_method: 'S256',
      prompt: 'select_account',
    });
  });

  it('is on only when both the client id and its secret are set', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', CLIENT);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(googleConfigured()).toBe(false);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
    expect(googleConfigured()).toBe(true);
  });
});

describe('the sign-in in progress', () => {
  const attempt = { state: 's', nonce: 'n', verifier: 'v', next: '/create?draft=1' };

  it('comes back from its cookie as it went in', () => {
    expect(openAttempt(sealAttempt(attempt))).toEqual(attempt);
  });

  it('is refused when the cookie was changed, made up or signed with another secret', () => {
    const sealed = sealAttempt(attempt);
    const [value, signature] = sealed.split('.');
    const altered = Buffer.from(JSON.stringify({ ...attempt, next: '/admin' })).toString('base64url');
    expect(openAttempt(`${altered}.${signature}`)).toBeNull();
    expect(openAttempt(`${value}.${signature.slice(1)}x`)).toBeNull();
    expect(openAttempt(value)).toBeNull();
    expect(openAttempt(undefined)).toBeNull();
    expect(openAttempt('garbage')).toBeNull();
    vi.stubEnv('SECRET_SALT', 'another-secret');
    expect(openAttempt(sealed)).toBeNull();
  });

  it('compares the state exactly', () => {
    expect(sameState('abc', 'abc')).toBe(true);
    expect(sameState('abd', 'abc')).toBe(false);
    expect(sameState('', 'abc')).toBe(false);
  });

  it('sends a failure to the sign-in page, keeping where the person was going', () => {
    expect(googleFailurePath('cancelled', '/create?draft=1')).toBe('/login?google=cancelled&next=%2Fcreate%3Fdraft%3D1');
    expect(googleFailurePath('expired', '')).toBe('/login?google=expired');
  });
});
