import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { usageThisMonth } from '@/lib/issue';
import { limits } from '@/lib/site';
import Link from 'next/link';
import { btn, card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { BulkIssuer } from '@/components/bulk/BulkIssuer';

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
        <div className={`${card} max-w-2xl p-6`}>
          <h2 className="font-serif text-[28px] leading-tight">Bulk issuing comes with a package</h2>
          <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">
            Packages start at 500 certificates and never expire. Your {limits.freeMonthly} free certificates each month still work one at a time from the editor.
          </p>
          <Link href="/app/billing" className={btn.brass + ' mt-5'}>See packages</Link>
        </div>
      ) : (
        <BulkIssuer
          templates={templates}
          initialTemplateId={typeof sp.template === 'string' ? sp.template : null}
          credits={user.credits}
          freeLeft={Math.max(0, limits.freeMonthly - used)}
        />
      )}
    </>
  );
}
