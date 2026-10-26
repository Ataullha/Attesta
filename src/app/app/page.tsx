import Link from 'next/link';
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { certificateFilter } from '@/lib/certificates';
import { freeRenewsOn, usageThisMonth } from '@/lib/issue';
import { emailConfigured } from '@/lib/email';
import { verifyUrl } from '@/lib/signing';
import { formatDate } from '@/lib/verify';
import { formatMoney, limits, packages } from '@/lib/site';
import { btn, card, field } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { GettingStarted } from '@/components/app/GettingStarted';
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

  const where = certificateFilter(user.id, q);
  const [used, [{ total }], [{ all }], certs, batches, [org], [{ marks }]] = await Promise.all([
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
    db().select({ id: schema.organizations.id }).from(schema.organizations).where(eq(schema.organizations.ownerUserId, user.id)).limit(1),
    db()
      .select({ marks: count() })
      .from(schema.assets)
      .where(and(eq(schema.assets.userId, user.id), isNull(schema.assets.deletedAt), inArray(schema.assets.kind, ['signature', 'logo', 'seal']))),
  ]);
  const pages = Math.max(1, Math.ceil(Number(total) / PER_PAGE));
  const freeLeft = Math.max(0, limits.freeMonthly - used);
  const mustConfirm = !user.emailVerified && emailConfigured();
  const smallest = packages[0];

  return (
    <>
      <PageTitle title="Certificates">
        <Link href="/app/bulk" className={btn.secondary}>Bulk from CSV</Link>
        <Link href="/create" className={btn.primary}>New certificate</Link>
      </PageTitle>

      <GettingStarted
        steps={[
          ...(emailConfigured()
            ? [
                {
                  done: !mustConfirm,
                  blocking: true,
                  title: 'Confirm your email address',
                  why: `You can issue certificates once it is confirmed. The link went to ${user.email}.`,
                  control: <span className="text-[14px]"><ResendVerification /></span>,
                },
              ]
            : []),
          {
            done: !!org,
            title: 'Add your organisation',
            why: 'Its name then appears as the issuer on every certificate and verification page, rather than yours.',
            href: '/app/organization',
            action: 'Add organisation',
          },
          {
            done: Number(marks) > 0,
            title: 'Upload a signature or logo',
            why: 'Upload it once and place it on any template.',
            href: '/app/library',
            action: 'Upload',
          },
          {
            done: Number(all) > 0,
            title: 'Issue your first certificate',
            why: 'Start from a template and fill in a name. Its QR code opens a page that confirms it.',
            href: '/create',
            action: 'Open the editor',
          },
        ]}
      />

      {freeLeft === 0 && user.credits === 0 && (
        <section aria-labelledby="out-h" className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-md border border-brass/40 bg-brass-soft p-5">
          <div className="max-w-[62ch]">
            <h2 id="out-h" className="text-[17px] font-semibold">{`You have used this month’s ${limits.freeMonthly} free certificates`}</h2>
            <p className="mt-1 text-[14.5px] leading-relaxed text-ink-2">
              {`More arrive on ${formatDate(freeRenewsOn())}. To keep issuing now, buy a package: ${smallest.credits.toLocaleString()} certificates for ${formatMoney(smallest.price)}, with bulk issuing from CSV included. Credits never expire.`}
            </p>
          </div>
          <Link href="/app/billing" className={btn.brass}>Buy a package</Link>
        </section>
      )}

      <dl className="mb-10 grid grid-cols-3 gap-px overflow-hidden border border-rule bg-rule">
        <div className="bg-card p-3 sm:p-5"><dt className="text-[12.5px] text-muted sm:text-[13.5px]">Free left this month</dt><dd className="mt-1 font-serif text-[28px] leading-none sm:text-[36px]">{freeLeft} <span className="text-[15px] text-muted sm:text-[18px]">of {limits.freeMonthly}</span></dd></div>
        <div className="bg-card p-3 sm:p-5">
          <dt className="text-[12.5px] text-muted sm:text-[13.5px]">Package credits</dt>
          <dd className="mt-1 font-serif text-[28px] leading-none sm:text-[36px]">{user.credits.toLocaleString()}</dd>
          {user.credits === 0 && <dd className="mt-1"><Link href="/app/billing" className="text-[12.5px] text-brass underline sm:text-[13.5px]">Buy a package</Link></dd>}
        </div>
        <div className="bg-card p-3 sm:p-5"><dt className="text-[12.5px] text-muted sm:text-[13.5px]">Issued in total</dt><dd className="mt-1 font-serif text-[28px] leading-none sm:text-[36px]">{Number(all).toLocaleString()}</dd></div>
      </dl>

      {batches.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-[17px] font-semibold">Recent bulk batches</h2>
            <Link href="/app/batches" className="text-[14px] text-brass underline-offset-2 hover:underline">View all batches</Link>
          </div>
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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <form className="flex w-full max-w-md gap-2" role="search">
          <label className="flex-1"><span className="sr-only">Search by name or serial</span><input name="q" defaultValue={q} placeholder="Search by name or serial" className={field.input} /></label>
          <button className={btn.secondary}>Search</button>
        </form>
        {certs.length > 0 && (
          // A plain link, not <Link>: it is a file download, so the browser should handle it.
          <a href={`/api/certificates/export${q ? `?q=${encodeURIComponent(q)}` : ''}`} download className={btn.small + ' border border-rule-2 hover:bg-card'}>
            {q ? 'Export these results as CSV' : 'Export all as CSV'}
          </a>
        )}
      </div>

      {certs.length === 0 && q ? (
        <div className={`${card} p-8 text-center`}>
          <p className="text-[16px]">Nothing matches that search.</p>
          <Link href="/app" className="mt-2 inline-block text-[14px] text-brass underline underline-offset-2">Show all certificates</Link>
        </div>
      ) : certs.length === 0 ? (
        <section aria-labelledby="none-h" className={`${card} p-6 sm:p-8`}>
          <h2 id="none-h" className="font-serif text-[26px] leading-tight">No certificates yet</h2>
          <p className="mt-2 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
            Everything you issue is listed here with its serial and status, to download again, share or revoke whenever you need to.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link href="/create" className="block rounded-md border border-rule-2 p-4 transition-colors hover:border-brass">
              <span className="block font-medium">Make one certificate</span>
              <span className="mt-1 block text-[14px] leading-snug text-muted">Start from a template, fill in a name and download the PDF.</span>
            </Link>
            <Link href="/app/bulk" className="block rounded-md border border-rule-2 p-4 transition-colors hover:border-brass">
              <span className="block font-medium">Issue a whole group from CSV</span>
              <span className="mt-1 block text-[14px] leading-snug text-muted">
                {user.credits > 0 ? 'One row per person; each certificate uses a credit.' : `One row per person. Comes with a package, from ${formatMoney(smallest.price)}.`}
              </span>
            </Link>
          </div>
        </section>
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
