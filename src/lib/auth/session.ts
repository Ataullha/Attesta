import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { and, count, eq, gt, ne } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { randomToken, sha256Hex } from '@/lib/security/crypto';
import { HttpError } from '@/lib/security/request';
import { PRESENCE_COOKIE } from './presence';

export const SESSION_COOKIE = 'att_session';
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  credits: number;
  emailVerified: boolean;
};

export async function createSession(userId: string) {
  const jar = await cookies();
  // A browser that signs in again must not leave its previous session alive on the server.
  const previous = jar.get(SESSION_COOKIE)?.value;
  if (previous && previous.length <= 100) await db().delete(schema.sessions).where(eq(schema.sessions.id, sha256Hex(previous)));

  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db().insert(schema.sessions).values({ id: sha256Hex(token), userId, expiresAt });
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
  // Not httpOnly on purpose: see ./presence.ts. It holds no secret.
  jar.set(PRESENCE_COOKIE, '1', {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

/** The stored id (a hash) of the session this request is using, or null when it has none. */
export async function currentSessionId() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token && token.length <= 100 ? sha256Hex(token) : null;
}

/** Sessions the user has that are still valid, other than `keepSessionId`. */
export async function countOtherSessions(userId: string, keepSessionId: string | null) {
  const [row] = await db()
    .select({ n: count() })
    .from(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), gt(schema.sessions.expiresAt, new Date()), keepSessionId ? ne(schema.sessions.id, keepSessionId) : undefined));
  return Number(row?.n ?? 0);
}

/** Ends every session of the user except `keepSessionId` (the one making the request). Returns how many ended. */
export async function endOtherSessions(userId: string, keepSessionId: string | null) {
  const ended = await db()
    .delete(schema.sessions)
    .where(and(eq(schema.sessions.userId, userId), keepSessionId ? ne(schema.sessions.id, keepSessionId) : undefined))
    .returning({ id: schema.sessions.id });
  return ended.length;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().delete(schema.sessions).where(eq(schema.sessions.id, sha256Hex(token)));
  jar.delete(SESSION_COOKIE);
  jar.delete(PRESENCE_COOKIE);
}

/** The signed-in user for this request, or null. Cached per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const rows = await db()
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      credits: schema.users.credits,
      emailVerifiedAt: schema.users.emailVerifiedAt,
      bannedAt: schema.users.bannedAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256Hex(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u || u.bannedAt) return null;
  return { id: u.id, email: u.email, name: u.name, role: u.role, credits: u.credits, emailVerified: !!u.emailVerifiedAt };
});

/** For pages: redirect to sign-in if there is no user. */
export async function requireUserPage(next = '/app') {
  const user = await getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdminPage() {
  const user = await requireUserPage('/admin');
  if (user.role !== 'admin') redirect('/app');
  return user;
}

/** For API routes. */
export async function requireUser() {
  const user = await getUser();
  if (!user) throw new HttpError(401, 'Sign in to do this.', 'unauthenticated');
  return user;
}

export async function requireVerifiedUser() {
  const user = await requireUser();
  if (!user.emailVerified) throw new HttpError(403, 'Confirm your email address first — check your inbox for the link.', 'email_unverified');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') throw new HttpError(403, 'Admins only.');
  return user;
}
