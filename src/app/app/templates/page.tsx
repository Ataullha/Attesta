import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { PRESETS } from '@/lib/presets';
import { formatDate } from '@/lib/verify';
import { btn, card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { DeleteTemplateButton } from '@/components/app/Actions';

export default async function MyTemplates() {
  const user = await requireUserPage('/app/templates');
  const rows = await db()
    .select({ id: schema.templates.id, name: schema.templates.name, updatedAt: schema.templates.updatedAt })
    .from(schema.templates)
    .where(eq(schema.templates.userId, user.id))
    .orderBy(desc(schema.templates.updatedAt));
  return (
    <>
      <PageTitle title="Templates">
        <Link href="/create?preset=blank" className={btn.primary}>New blank template</Link>
      </PageTitle>
      {rows.length ? (
        <ul className={`${card} divide-y divide-rule`}>
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span><span className="block font-medium">{t.name}</span><span className="text-[13px] text-muted">Edited {formatDate(t.updatedAt)}</span></span>
              <span className="flex gap-1">
                <Link href={`/create?template=${t.id}`} className={btn.small + ' border border-rule-2 hover:bg-paper'}>Edit</Link>
                <Link href={`/app/bulk?template=${t.id}`} className={btn.small + ' border border-rule-2 hover:bg-paper'}>Bulk issue</Link>
                <DeleteTemplateButton id={t.id} name={t.name} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[15.5px] text-ink-2">No saved templates yet. Start from one below, customise it and press “Save template”.</p>
      )}
      <h2 className="mb-3 mt-12 text-[17px] font-semibold">Start from a preset</h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRESETS.map((p) => (
          <li key={p.slug}>
            <Link href={`/create?preset=${p.slug}`} className={`${card} block p-4 hover:border-brass`}>
              <span className="block font-medium">{p.name}</span>
              <span className="text-[13.5px] text-muted">{p.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
