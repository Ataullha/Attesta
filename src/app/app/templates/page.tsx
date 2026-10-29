import Link from 'next/link';
import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { capitalised, kindNoun, type DesignKind } from '@/lib/design';
import { CERTIFICATE_PRESETS, ID_CARD_PRESETS, INVITATION_PRESETS, VISITING_CARD_PRESETS } from '@/lib/presets';
import { formatDate } from '@/lib/verify';
import { PageTitle } from '@/components/app/Shell';
import { DeleteTemplateButton } from '@/components/app/Actions';
import { btn, card } from '@/components/ui/styles';

/** Each kind of design, started from blank. */
const START: { kind: DesignKind; href: string; hint: string }[] = [
  { kind: 'certificate', href: '/create?preset=blank', hint: 'For a course, an event or an award' },
  { kind: 'id-card', href: '/create?preset=blank-id-card', hint: 'With each person’s photo' },
  { kind: 'visiting-card', href: '/create?preset=blank-visiting-card', hint: 'With a QR code that saves the contact' },
  { kind: 'invitation', href: '/create?preset=blank-invitation', hint: 'With each guest’s name' },
];

export default async function MyTemplates() {
  const user = await requireUserPage('/app/templates');
  const rows = await db()
    .select({ id: schema.templates.id, name: schema.templates.name, updatedAt: schema.templates.updatedAt, kind: sql<DesignKind | null>`${schema.templates.design}->>'kind'` })
    .from(schema.templates)
    .where(eq(schema.templates.userId, user.id))
    .orderBy(desc(schema.templates.updatedAt));
  return (
    <>
      <PageTitle title="Create and templates" />

      <section aria-labelledby="new" className="-mt-2 mb-12">
        <h2 id="new" className="mb-3 scroll-mt-24 text-[17px] font-semibold">Start something new</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {START.map((s) => (
            <li key={s.kind}>
              <Link href={s.href} className={`${card} block h-full p-4 hover:border-accent`}>
                <span className="block font-medium">Blank {kindNoun(s.kind)}</span>
                <span className="text-[13.5px] text-muted">{s.hint}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mb-3 text-[17px] font-semibold">Your templates</h2>
      {rows.length ? (
        <ul className={`${card} divide-y divide-rule`}>
          {rows.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block font-medium">
                  {t.name}
                  {t.kind && t.kind !== 'certificate' && (
                    <span className="ml-2 rounded-full bg-accent-soft px-2 py-px align-middle text-[12px] font-normal text-accent">{capitalised(kindNoun(t.kind))}</span>
                  )}
                </span>
                <span className="text-[13px] text-muted">Edited {formatDate(t.updatedAt)}</span>
              </span>
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
      {[
        { title: 'Start a certificate from a template', presets: CERTIFICATE_PRESETS },
        { title: 'Start an ID card from a template', presets: ID_CARD_PRESETS },
        { title: 'Start a visiting card from a template', presets: VISITING_CARD_PRESETS },
        { title: 'Start an invitation from a template', presets: INVITATION_PRESETS },
      ].map((group) => (
        <section key={group.title}>
          <h2 className="mb-3 mt-12 text-[17px] font-semibold">{group.title}</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {group.presets.map((p) => (
              <li key={p.slug}>
                <Link href={`/create?preset=${p.slug}`} className={`${card} block p-4 hover:border-accent`}>
                  <span className="block font-medium">{p.name}</span>
                  <span className="text-[13.5px] text-muted">{p.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
