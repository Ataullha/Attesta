import 'server-only';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { randomToken, sha256Hex } from '@/lib/security/crypto';

export type TokenPurpose = 'verify' | 'reset';

const LIFETIME_MS: Record<TokenPurpose, number> = { verify: 24 * 3600_000, reset: 3600_000 };

/** Anything that can run an UPDATE or INSERT: the connection, or a transaction on it. */
type Executor = Pick<ReturnType<typeof db>, 'insert' | 'update'>;

/** Creates a single-use token for the user and returns the raw value for the emailed link. Only its hash is stored. */
export async function issueEmailToken(userId: string, purpose: TokenPurpose, executor: Executor = db()) {
  const token = randomToken(32);
  await executor.insert(schema.emailTokens).values({
    id: sha256Hex(token),
    userId,
    purpose,
    expiresAt: new Date(Date.now() + LIFETIME_MS[purpose]),
  });
  return token;
}

/**
 * Spends a token and returns the user it belongs to, or null when it is unknown, expired, already
 * used, or meant for something else.
 *
 * Checking and marking happen in one `UPDATE … RETURNING`, so two requests racing with the same
 * link cannot both win: Postgres makes the second wait for the first, then re-evaluates its
 * conditions and finds the token already used. (Selecting first and updating afterwards let nine
 * of ten simultaneous requests through in testing.)
 */
export async function consumeEmailToken(token: string, purpose: TokenPurpose, executor: Executor = db()) {
  const [row] = await executor
    .update(schema.emailTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.emailTokens.id, sha256Hex(token)),
        eq(schema.emailTokens.purpose, purpose),
        isNull(schema.emailTokens.usedAt),
        gt(schema.emailTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.emailTokens.userId });
  return row?.userId ?? null;
}
