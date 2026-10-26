import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser, closeDb, signUp, signUpConfirmed, sql, type Account } from './helpers';

afterAll(closeDb);

// Every screen a person can reach. A page that throws while rendering answers 500, and nothing else in the
// suite would notice a screen nobody happened to open.
const ACCOUNT_PAGES = ['/app', '/app/batches', '/app/bulk', '/app/templates', '/app/library', '/app/organization', '/app/billing', '/app/settings', '/create'];
const ADMIN_PAGES = ['/admin', '/admin/payments', '/admin/organizations', '/admin/reports', '/admin/users', '/admin/certificates', '/admin/audit'];

describe('signed in', () => {
  let account: Account;
  beforeAll(async () => {
    account = await signUpConfirmed('pages');
  });

  it.each(ACCOUNT_PAGES)('%s renders', async (path) => {
    const res = await account.browser.get(path);
    expect(res.status).toBe(200);
  });

  it.each(ADMIN_PAGES)('%s sends an ordinary account back to its dashboard', async (path) => {
    const res = await account.browser.get(path);
    expect([res.status, res.headers.get('location')]).toEqual([307, '/app']);
  });
});

describe('an administrator', () => {
  let admin: Account;
  beforeAll(async () => {
    admin = await signUpConfirmed('pages-admin');
    await sql()`update users set role = 'admin' where email = ${admin.email}`;
  });

  it.each(ADMIN_PAGES)('can open %s', async (path) => {
    expect((await admin.browser.get(path)).status).toBe(200);
  });
});

describe('signed out', () => {
  it.each([...ACCOUNT_PAGES.filter((p) => p !== '/create'), ...ADMIN_PAGES])('%s sends you to sign in, and back afterwards', async (path) => {
    const res = await new Browser().get(path);
    expect([res.status, res.headers.get('location')]).toEqual([307, `/login?next=${encodeURIComponent(path)}`]);
  });

  it('keeps the query string through sign-in, so a link to one template still opens it', async () => {
    const res = await new Browser().get('/app/bulk?template=abc');
    expect(res.headers.get('location')).toBe('/login?next=%2Fapp%2Fbulk%3Ftemplate%3Dabc');
  });

  it('lets anyone open the editor, because guests can issue', async () => {
    expect((await new Browser().get('/create')).status).toBe(200);
  });

  it('shows a session that no longer exists the sign-in page, not an error', async () => {
    const account = await signUp('gone');
    await sql()`delete from sessions where user_id = (select id from users where email = ${account.email})`;
    const res = await account.browser.get('/app');
    expect([res.status, res.headers.get('location')]).toEqual([307, '/login?next=%2Fapp']);
  });
});
