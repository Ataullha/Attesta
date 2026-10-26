import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { usageThisMonth } from '@/lib/issue';
import { formatMoney, limits, packages, perCertificate } from '@/lib/site';
import Link from 'next/link';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { LazyBulkIssuer } from '@/components/bulk/LazyBulkIssuer';

export default async function BulkPage({ searchParams }: PageProps<'/app/bulk'>) {
  const user = await requireUserPage('/app/bulk');
  const sp = await searchParams;
  const templates = await db()
    .select({ id: schema.templates.id, name: schema.templates.name })
    .from(schema.templates)
    .where(eq(schema.templates.userId, user.id))
    .orderBy(desc(schema.templates.updatedAt));
  const used = await usageThisMonth(user.id);

  return (
    <>
      <PageTitle title="Bulk from CSV" />
      {user.credits <= 0 ? (
        <section aria-labelledby="bulk-h" className={`${card} max-w-3xl p-6 sm:p-8`}>
          <h2 id="bulk-h" className="font-serif text-[30px] leading-tight">Issue to a whole group at once</h2>
          <p className="mt-2 max-w-[62ch] text-[15.5px] leading-relaxed text-ink-2">
            Bulk issuing comes with a package. Upload a spreadsheet with one row per person, and every certificate gets its own serial, QR code and
            verification page.
          </p>
          <ol className="mt-6 grid gap-4 text-[14.5px] leading-snug text-ink-2 sm:grid-cols-3">
            {[
              'Upload a CSV file, up to ' + limits.bulkMaxRows.toLocaleString() + ' rows. Excel and Google Sheets both save one.',
              'Match its columns to your template’s fields. Gaps and duplicates are flagged before anything is issued.',
              'Download one PDF, or a ZIP with a file per person.',
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span aria-hidden="true" className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rule-2 font-mono text-[12px] text-brass">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <h3 className="mt-8 text-[15px] font-semibold">Choose a package</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {packages.map((p) => (
              <li key={p.id}>
                <Link href={`/app/billing?package=${p.id}`} className="block h-full rounded-md border border-rule-2 p-4 transition-colors hover:border-brass">
                  <span className="block text-[13.5px] text-muted">{p.name}</span>
                  <span className="block font-serif text-[24px] leading-tight">{p.credits.toLocaleString()} certificates</span>
                  <span className="mt-1 block text-[14.5px]">
                    {formatMoney(p.price)} <span className="text-muted">· {formatMoney(perCertificate(p))} each</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-[14px] leading-relaxed text-muted">
            Credits never expire. Your {limits.freeMonthly} free certificates each month still work one at a time from the editor.
          </p>
        </section>
      ) : (
        <LazyBulkIssuer
          templates={templates}
          initialTemplateId={typeof sp.template === 'string' ? sp.template : null}
          credits={user.credits}
          freeLeft={Math.max(0, limits.freeMonthly - used)}
        />
      )}
    </>
  );
}
