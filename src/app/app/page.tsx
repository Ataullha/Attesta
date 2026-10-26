import Link from 'next/link';
import { and, asc, count, desc, eq, ilike, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { usageThisMonth } from '@/lib/issue';
import { emailConfigured } from '@/lib/email';
import { verifyUrl } from '@/lib/signing';
import { formatDate } from '@/lib/verify';
import { limits } from '@/lib/site';
import { btn, card, field } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { BatchDownload, CertificateActions, ResendVerification } from '@/components/app/Actions';

const PER_PAGE = 25;

/**
 * Column template shared by the certificate list's header and rows from `xl` up; below that each
 * certificate is a stacked card. The last two tracks are fixed, not `auto`: `auto` sizes to the
 * content of each separate grid, so the header and the rows would not line up.
 */
const CERT_COLS = 'xl:grid xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.4fr)_minmax(0,1fr)_72px_232px] xl:items-start xl:gap-x-4';

export default async function Dashboard({ searchParams }: PageProps<'/app'>) {
  const user = await requireUserPage('/app');
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim().slice(0, 80) : '';
  const page = Math.max(1, Number(sp.page) || 1);

  const where = and(
    eq(schema.certificates.userId, user.id),
    q ? or(ilike(schema.certificates.recipientName, `%${q}%`), ilike(schema.certificates.serial, `%${q.toUpperCase()}%`)) : undefined,
  );
  const [used, [{ total }], [{ all }], certs, batches] = await Promise.all([
    usageThisMonth(user.id),
    db().select({ total: count() }).from(schema.certificates).where(where),
    db().select({ all: count() }).from(schema.certificates).where(eq(schema.certificates.userId, user.id)),
    db()
      .select({ serial: schema.certificates.serial, name: schema.certificates.recipientName, issuedAt: schema.certificates.issuedAt, revokedAt: schema.certificates.revokedAt, batch: schema.batches.name })
      .from(schema.certificates)
      .innerJoin(schema.batches, eq(schema.batches.id, schema.certificates.batchId))
      .where(where)
      // Every certificate in a bulk batch shares one issuedAt, and Postgres does not promise a stable
      // order among ties, so without a tiebreaker LIMIT/OFFSET pages are not guaranteed to line up.
      .orderBy(desc(schema.certificates.issuedAt), asc(schema.certificates.serial))
      .limit(PER_PAGE)
      .offset((page - 1) * PER_PAGE),
    db()
      .select({ id: schema.batches.id, name: schema.batches.name, count: schema.batches.count, createdAt: schema.batches.createdAt })
      .from(schema.batches)
      .where(and(eq(schema.batches.userId, user.id), eq(schema.batches.mode, 'bulk')))
      .orderBy(desc(schema.batches.createdAt))
      .limit(5),
  ]);
  const pages = Math.max(1, Math.ceil(Number(total) / PER_PAGE));
  const freeLeft = Math.max(0, limits.freeMonthly - used);

  return (
    <>
      <PageTitle title="Certificates">
        <Link href="/app/bulk" className={btn.secondary}>Bulk from CSV</Link>
        <Link href="/create" className={btn.primary}>New certificate</Link>
      </PageTitle>

      {!user.emailVerified && emailConfigured() && (
        <div role="status" className="mb-6 rounded-[4px] border border-brass/30 bg-brass-soft p-4 text-[14.5px]">
          Confirm your email address to start issuing. We sent a link to {user.email}. <ResendVerification />
        </div>
      )}

      <dl className="mb-10 grid grid-cols-3 gap-px overflow-hidden border border-rule bg-rule">
        <div className="bg-card p-3 sm:p-5"><dt className="text-[12.5px] text-muted sm:text-[13.5px]">Free left this month</dt><dd className="mt-1 font-serif text-[28px] leading-none sm:text-[36px]">{freeLeft} <span className="text-[15px] text-muted sm:text-[18px]">of {limits.freeMonthly}</span></dd></div>
        <div className="bg-card p-3 sm:p-5"><dt className="text-[12.5px] text-muted sm:text-[13.5px]">Package credits</dt><dd className="mt-1 font-serif text-[28px] leading-none sm:text-[36px]">{user.credits.toLocaleString()}</dd>{user.credits === 0 && <Link href="/app/billing" className="mt-1 inline-block text-[12.5px] text-brass underline sm:text-[13.5px]">Buy a package</Link>}</div>
        <div className="bg-card p-3 sm:p-5"><dt className="text-[12.5px] text-muted sm:text-[13.5px]">Issued in total</dt><dd className="mt-1 font-serif text-[28px] leading-none sm:text-[36px]">{Number(all).toLocaleString()}</dd></div>
      </dl>

      {batches.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-[17px] font-semibold">Recent bulk batches</h2>
          <ul className={`${card} divide-y divide-rule`}>
            {batches.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-[14.5px]">
                <span className="min-w-0"><span className="block truncate font-medium">{b.name}</span><span className="text-[13px] text-muted">{b.count.toLocaleString()} certificates · {formatDate(b.createdAt)}</span></span>
                <BatchDownload batchId={b.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <form className="mb-4 flex max-w-md gap-2" role="search">
        <label className="flex-1"><span className="sr-only">Search by name or serial</span><input name="q" defaultValue={q} placeholder="Search by name or serial" className={field.input} /></label>
        <button className={btn.secondary}>Search</button>
      </form>

      {certs.length === 0 ? (
        <div className={`${card} p-8 text-center`}>
          <p className="text-[16px]">{q ? 'Nothing matches that search.' : 'You haven’t issued any certificates yet.'}</p>
          {!q && <Link href="/create" className={btn.primary + ' mt-4'}>Make your first certificate</Link>}
        </div>
      ) : (
        // A list rather than a table: one set of markup is a row of aligned columns from `md` up and a
        // stacked card per certificate below it, so Status and the actions (Revoke, PDF…) are never
        // pushed off a phone's screen. The stateful action buttons are rendered once, not per layout.
        <div className={card}>
          <div className={`hidden border-b border-rule px-4 py-3 text-[13px] text-muted xl:grid ${CERT_COLS}`} aria-hidden="true">
            <span>Recipient</span>
            <span>Serial</span>
            <span>Issued</span>
            <span>Status</span>
            <span />
          </div>
          <ul className="divide-y divide-rule">
            {certs.map((c) => {
              const status = c.revokedAt ? (
                <span className="rounded-full bg-revoked-soft px-2.5 py-0.5 text-[12.5px] text-revoked">Revoked</span>
              ) : (
                <span className="rounded-full bg-seal-soft px-2.5 py-0.5 text-[12.5px] text-seal">Valid</span>
              );
              return (
                <li key={c.serial} className={`px-4 py-3.5 text-[14.5px] ${CERT_COLS}`}>
                  <div className="flex items-start justify-between gap-3 xl:block">
                    <div className="min-w-0">
                      <p className="break-words font-medium">{c.name}</p>
                      <p className="break-words text-[12.5px] text-muted">{c.batch}</p>
                    </div>
                    <span className="shrink-0 xl:hidden">{status}</span>
                  </div>
                  {/* `contents` hands these four to the grid on wide screens; below that they are one wrapping row. */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-2 xl:contents">
                    <Link href={`/verify/${c.serial}`} className="font-mono text-[13px] hover:text-brass" target="_blank">
                      {c.serial}
                    </Link>
                    <span className="text-[13.5px] text-ink-2 xl:text-[14.5px]">{formatDate(c.issuedAt)}</span>
                    <div className="hidden xl:block">{status}</div>
                    <div className="w-full md:ml-auto md:w-auto xl:ml-0 xl:w-full">
                      <CertificateActions serial={c.serial} verifyUrl={verifyUrl(c.serial)} revoked={!!c.revokedAt} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-[14px]">
          {page > 1 && <Link className={btn.small + ' border border-rule-2'} href={`/app?${new URLSearchParams({ q, page: String(page - 1) })}`}>Previous</Link>}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages && <Link className={btn.small + ' border border-rule-2'} href={`/app?${new URLSearchParams({ q, page: String(page + 1) })}`}>Next</Link>}
        </nav>
      )}
    </>
  );
}
