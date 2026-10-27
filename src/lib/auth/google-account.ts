import 'server-only';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { audit } from '@/lib/audit';
import { emailConfigured } from '@/lib/email';
import { isUniqueViolation } from '@/lib/security/db-errors';
import { isDisposableEmail } from '@/lib/security/disposable';
import { rateLimit } from '@/lib/security/rate-limit';
import { HttpError } from '@/lib/security/request';
import { GoogleSignInError, type GoogleIdentity } from './google';

type Account = { id: string; role: 'user' | 'admin' };

const columns = {
  id: schema.users.id,
  role: schema.users.role,
  bannedAt: schema.users.bannedAt,
  googleSub: schema.users.googleSub,
  passwordHash: schema.users.passwordHash,
  emailVerifiedAt: schema.users.emailVerifiedAt,
};

/**
 * The account a Google sign-in opens: the one already linked to this Google account, else the one
 * with the same address (which is linked to it from then on), else a new one.
 */
export async function accountForGoogle(identity: GoogleIdentity, ipHash: string): Promise<Account> {
  try {
    return await resolve(identity, ipHash);
  } catch (err) {
    // Two sign-ins finishing at once can both decide to link or create; a unique index decides, and the
    // one that lost looks again and finds what the other made.
    if (isUniqueViolation(err)) return resolve(identity, ipHash);
    throw err;
  }
}

async function resolve(identity: GoogleIdentity, ipHash: string): Promise<Account> {
  const [linked] = await db().select(columns).from(schema.users).where(eq(schema.users.googleSub, identity.sub)).limit(1);
  if (linked) {
    if (linked.bannedAt) throw new GoogleSignInError('suspended');
    return linked;
  }

  const [sameAddress] = await db().select(columns).from(schema.users).where(eq(schema.users.email, identity.email)).limit(1);
  if (sameAddress) {
    if (sameAddress.bannedAt) throw new GoogleSignInError('suspended');
    // Linked already, to another Google account that had this address before.
    if (sameAddress.googleSub) throw new GoogleSignInError('other_google');
    // Google has shown that this person controls the address. Whoever chose the account's password has
    // not, unless the address was confirmed through our own email link: someone could register an
    // address first and wait for its owner to sign in with Google, keeping a password to the account the
    // owner then uses. So for an address that was never confirmed, the password goes and every session ends.
    const proven = !!sameAddress.emailVerifiedAt && emailConfigured();
    await db().transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({
          googleSub: identity.sub,
          emailVerifiedAt: sql`coalesce(${schema.users.emailVerifiedAt}, now())`,
          ...(proven ? {} : { passwordHash: null }),
        })
        .where(eq(schema.users.id, sameAddress.id));
      if (!proven) await tx.delete(schema.sessions).where(eq(schema.sessions.userId, sameAddress.id));
    });
    await audit(sameAddress.id, 'auth.google_linked', sameAddress.id, { passwordRemoved: !proven && !!sameAddress.passwordHash });
    return sameAddress;
  }

  if (isDisposableEmail(identity.email)) throw new GoogleSignInError('throwaway');
  // The same allowance as signing up with a password, so Google is no way round it.
  try {
    await rateLimit(`register:${ipHash}`, 5, 3600);
  } catch (err) {
    if (err instanceof HttpError && err.status === 429) throw new GoogleSignInError('busy');
    throw err;
  }
  const name = (identity.name.length >= 2 ? identity.name : identity.email.split('@')[0]).slice(0, 80);
  const [created] = await db()
    .insert(schema.users)
    // Google has confirmed the address, so there is no confirmation email to wait for.
    .values({ name, email: identity.email, passwordHash: null, googleSub: identity.sub, emailVerifiedAt: new Date() })
    .returning({ id: schema.users.id, role: schema.users.role });
  await audit(created.id, 'auth.google_signup', created.id);
  return created;
}
