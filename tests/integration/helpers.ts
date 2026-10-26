import { randomUUID } from 'node:crypto';
import { db, schema } from '@/lib/db';

/** Integration tests run only when TEST_DATABASE_URL points at a disposable Postgres database. */
export const hasDb = !!process.env.TEST_DATABASE_URL;

/** A user with a unique address, so tests never collide even though they share one database. */
export async function makeUser(over: Partial<typeof schema.users.$inferInsert> = {}) {
  const [user] = await db()
    .insert(schema.users)
    .values({ email: `${randomUUID()}@test.example`, name: 'Test User', passwordHash: 'not-a-real-hash', ...over })
    .returning();
  return user;
}
