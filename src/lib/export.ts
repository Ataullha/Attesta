import 'server-only';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { certificateFilter } from './certificates';
import type { Design } from './design';
import { verifyUrl } from './signing';
import { csvCell } from './values';

const PAGE = 1000;
const BASE_COLUMNS = ['Serial', 'Verification link', 'Recipient', 'Email', 'Issued (UTC)', 'Status', 'Revoked (UTC)', 'Revocation reason', 'Batch'];

/** The row's timestamp at full precision. A Date only holds milliseconds, and a keyset cursor must match exactly. */
const exactIssuedAt = sql<string>`to_char(${schema.certificates.issuedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

type Cursor = { ts: string; serial: string };
type Options = { q?: string; batchId?: string };

/** One page, newest first, starting after `after`. A keyset cursor keeps every page as cheap as the first. */
function fetchPage(userId: string, opts: Options, after: Cursor | null) {
  return db()
    .select({
      serial: schema.certificates.serial,
      recipient: schema.certificates.recipientName,
      email: schema.certificates.recipientEmail,
      issuedAt: schema.certificates.issuedAt,
      ts: exactIssuedAt,
      revokedAt: schema.certificates.revokedAt,
      reason: schema.certificates.revokeReason,
      values: schema.certificates.values,
      batch: schema.batches.name,
    })
    .from(schema.certificates)
    .innerJoin(schema.batches, eq(schema.batches.id, schema.certificates.batchId))
    .where(
      and(
        certificateFilter(userId, opts.q ?? ''),
        opts.batchId ? eq(schema.certificates.batchId, opts.batchId) : undefined,
        after
          ? sql`(${schema.certificates.issuedAt} < ${after.ts}::timestamptz or (${schema.certificates.issuedAt} = ${after.ts}::timestamptz and ${schema.certificates.serial} > ${after.serial}))`
          : undefined,
      ),
    )
    .orderBy(desc(schema.certificates.issuedAt), asc(schema.certificates.serial))
    .limit(PAGE);
}

/**
 * A user's certificates as CSV, yielded in chunks so a large registry never sits in memory.
 *
 * With `batchId` the columns also include that batch's own fields (course, position, ...). Every
 * cell goes through csvCell, so a recipient called "=HYPERLINK(...)" cannot run as a formula when the
 * file is opened in a spreadsheet.
 */
export async function* certificatesCsv(userId: string, opts: Options = {}): AsyncGenerator<string> {
  let fields: { key: string; label: string }[] = [];
  if (opts.batchId) {
    const [batch] = await db()
      .select({ design: schema.batches.design })
      .from(schema.batches)
      .where(and(eq(schema.batches.id, opts.batchId), eq(schema.batches.userId, userId)))
      .limit(1);
    const design = batch?.design as Design | undefined;
    // The recipient and email already have columns of their own.
    fields = (design?.fields ?? []).filter((f) => f.key !== 'recipient_name' && f.type !== 'email').map((f) => ({ key: f.key, label: f.label }));
  }

  // The byte-order mark makes Excel read the file as UTF-8, which Bangla names need.
  yield '\uFEFF' + [...BASE_COLUMNS, ...fields.map((f) => f.label)].map(csvCell).join(',') + '\r\n';

  let after: Cursor | null = null;
  for (;;) {
    const rows = await fetchPage(userId, opts, after);
    if (!rows.length) return;

    yield rows
      .map((r) => {
        const values = (r.values ?? {}) as Record<string, string>;
        const cells = [
          r.serial,
          verifyUrl(r.serial),
          r.recipient,
          r.email ?? '',
          r.issuedAt.toISOString(),
          r.revokedAt ? 'Revoked' : 'Valid',
          r.revokedAt ? r.revokedAt.toISOString() : '',
          r.reason ?? '',
          r.batch,
          ...fields.map((f) => (Object.hasOwn(values, f.key) ? values[f.key] : '')),
        ];
        return cells.map((cell) => csvCell(String(cell))).join(',') + '\r\n';
      })
      .join('');

    if (rows.length < PAGE) return;
    const last = rows[rows.length - 1];
    after = { ts: last.ts, serial: last.serial };
  }
}
