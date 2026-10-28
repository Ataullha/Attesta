import type { Metadata } from 'next';
import Link from 'next/link';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { formatDate } from '@/lib/verify';
import { btn, card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { BatchDownload } from '@/components/app/Actions';
import { batchKind } from '@/lib/certificates';

export const metadata: Metadata = { title: 'Bulk batches' };

const PER_PAGE = 20;

export default async function BatchesPage({ searchParams }: PageProps<'/app/batches'>) {
  const user = await requireUserPage('/app/batches');
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const mine = and(eq(schema.batches.userId, user.id), eq(schema.batches.mode, 'bulk'));

  const [[{ total }], batches] = await Promise.all([
    db().select({ total: count() }).from(schema.batches).where(mine),
    db()
      .select({ id: schema.batches.id, name: schema.batches.name, count: schema.batches.count, createdAt: schema.batches.createdAt, ...batchKind })
      .from(schema.batches)
      .where(mine)
      .orderBy(desc(schema.batches.createdAt), asc(schema.batches.id))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
  ]);
  const pages = Math.max(1, Math.ceil(Number(total) / PER_PAGE));

  return (
    <>
      <PageTitle title="Bulk batches">
        <Link href="/app/bulk" className={btn.primary}>New bulk batch</Link>
      </PageTitle>
      <p className="-mt-4 mb-8 max-w-[62ch] text-[15.5px] text-ink-2">
        Every batch you have issued from a CSV file. Download the certificates or ID cards again as PDFs at any time, or export the list as a spreadsheet.
      </p>

      {batches.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <p className="text-[16px]">You haven’t issued a bulk batch yet.</p>
          <Link href="/app/bulk" className={btn.primary + ' mt-4'}>Issue from a CSV file</Link>
        </div>
      ) : (
        <ul className={`${card} divide-y divide-rule`}>
          {batches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 text-[14.5px]">
              <span className="min-w-0">
                <span className="block break-words font-medium">{b.name}</span>
                <span className="text-[13px] text-muted">
                  {b.count.toLocaleString()} {b.card ? (b.count === 1 ? 'ID card' : 'ID cards') : b.count === 1 ? 'certificate' : 'certificates'} · {formatDate(b.createdAt)}
                </span>
              </span>
              <span className="flex flex-wrap items-center justify-end gap-1">
                <BatchDownload batchId={b.id} card={b.card} photos={b.photos} />
                <a href={`/api/certificates/export?batch=${b.id}`} download className={btn.small + ' hover:bg-rule/60'}>
                  Export CSV
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-[14px]">
          {page > 1 && <Link className={btn.small + ' border border-rule-2'} href={`/app/batches?page=${page - 1}`}>Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link className={btn.small + ' border border-rule-2'} href={`/app/batches?page=${page + 1}`}>Next</Link>}
        </nav>
      )}
    </>
  );
}
