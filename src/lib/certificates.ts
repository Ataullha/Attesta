import 'server-only';
import { and, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { schema } from '@/lib/db';

/** What a batch's design is (certificate or ID card) and whether it has photos, read from its stored design. */
export const batchKind = {
  card: sql<boolean>`coalesce(${schema.batches.design}->>'kind' = 'id-card', false)`,
  photos: sql<boolean>`coalesce((${schema.batches.design}->'fields') @> '[{"type":"photo"}]'::jsonb, false)`,
};

/** Makes `%`, `_` and `\` in a search term match themselves instead of acting as LIKE wildcards. */
export function likeEscape(term: string) {
  return term.replace(/[\\%_]/g, '\\$&');
}

/**
 * Which of a user's certificates a search term selects: part of the recipient's name or of the
 * serial. Shared by the dashboard and the CSV export, so "export what I am looking at" is exact.
 */
export function certificateFilter(userId: string, term: string): SQL | undefined {
  const q = term.trim().slice(0, 80);
  return and(
    eq(schema.certificates.userId, userId),
    q
      ? or(
          ilike(schema.certificates.recipientName, `%${likeEscape(q)}%`),
          ilike(schema.certificates.serial, `%${likeEscape(q.toUpperCase())}%`),
        )
      : undefined,
  );
}
