import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/safe-redirect';

const SITE = 'http://localhost:3000';
// A value the URL parser rejects outright is not a safe redirect target either.
const leavesSite = (path: string) => {
  try {
    return new URL(path, SITE).origin !== SITE;
  } catch {
    return true;
  }
};

describe('safeNextPath', () => {
  it('keeps ordinary same-site paths, including query and hash', () => {
    expect(safeNextPath('/app')).toBe('/app');
    expect(safeNextPath('/app/bulk?template=abc-123')).toBe('/app/bulk?template=abc-123');
    expect(safeNextPath('/create?preset=blank#editor')).toBe('/create?preset=blank#editor');
    expect(safeNextPath('/verify/ATT-7K2Q-9M4D-X1TB')).toBe('/verify/ATT-7K2Q-9M4D-X1TB');
  });

  it('normalises dot segments instead of passing them through', () => {
    expect(safeNextPath('/app/../admin')).toBe('/admin');
  });

  // Found by the exhaustive test below: dot-segment removal turns this into `//evil.com`,
  // which a browser would read as a protocol-relative URL to another site.
  it('refuses a path that only becomes protocol-relative after normalisation', () => {
    expect(new URL('/.//evil.com', 'http://x.invalid').pathname).toBe('//evil.com');
    expect(safeNextPath('/.//evil.com')).toBe('/app');
    expect(safeNextPath('/a/..//evil.com')).toBe('/app');
  });

  it('falls back for empty or missing values', () => {
    expect(safeNextPath(undefined)).toBe('/app');
    expect(safeNextPath(null)).toBe('/app');
    expect(safeNextPath('')).toBe('/app');
    expect(safeNextPath('', '/create')).toBe('/create');
  });

  // These were each confirmed to redirect off-site on the previous startsWith('/') check.
  it.each([
    ['backslash', '/\\evil.com'],
    ['double backslash', '/\\\\evil.com'],
    ['tab smuggled between slashes', '/\t/evil.com'],
    ['newline smuggled between slashes', '/\n/evil.com'],
    ['carriage return', '/\r/evil.com'],
  ])('rejects %s', (_name, payload) => {
    expect(leavesSite(payload)).toBe(true); // proves the payload is dangerous, not just odd-looking
    expect(safeNextPath(payload)).toBe('/app');
  });

  it.each([
    ['protocol-relative', '//evil.com'],
    ['triple slash', '///evil.com'],
    ['absolute https', 'https://evil.com'],
    ['absolute http', 'http://evil.com/app'],
    ['javascript scheme', 'javascript:alert(1)'],
    ['data scheme', 'data:text/html,<script>alert(1)</script>'],
    ['relative without slash', 'app/bulk'],
    ['leading space', ' /app'],
    ['leading space before //', ' //evil.com'],
    ['userinfo trick', '@evil.com'],
    ['NUL byte', '/app\u0000'],
    ['DEL character', '/app\u007f'],
  ])('rejects %s', (_name, payload) => {
    expect(safeNextPath(payload)).toBe('/app');
  });

  it('rejects absurdly long values', () => {
    expect(safeNextPath('/' + 'a'.repeat(3000))).toBe('/app');
  });

  it('keeps percent-encoded slashes as ordinary same-site path text', () => {
    const out = safeNextPath('/%2Fevil.com');
    expect(out).toBe('/%2Fevil.com');
    expect(leavesSite(out)).toBe(false);
  });

  // Exhaustive over a small hostile alphabet: whatever goes in, nothing that leaves the site may come out.
  it('never returns a value that leaves the site (exhaustive, length <= 5)', () => {
    const alphabet = ['/', '\\', '\t', '\n', 'a', ':', '.', '%', '@', '?'];
    const violations: string[] = [];
    let checked = 0;
    const walk = (prefix: string, depth: number) => {
      const out = safeNextPath(prefix);
      if (!out.startsWith('/') || out.startsWith('//') || leavesSite(out)) violations.push(`${JSON.stringify(prefix)} -> ${JSON.stringify(out)}`);
      checked++;
      if (depth === 0) return;
      for (const ch of alphabet) walk(prefix + ch, depth - 1);
    };
    walk('', 5);
    expect(checked).toBeGreaterThan(100_000);
    expect(violations).toEqual([]);
  });
});
