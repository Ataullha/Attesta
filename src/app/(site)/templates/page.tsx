import type { Metadata } from 'next';
import Link from 'next/link';
import { CERTIFICATE_PRESETS, ID_CARD_PRESETS, INVITATION_PRESETS, VISITING_CARD_PRESETS, type Preset } from '@/lib/presets';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { CtaBand } from '@/components/site/CtaBand';

export const metadata: Metadata = {
  title: 'Free certificate, ID card, visiting card and invitation templates',
  description:
    'Free templates for certificates, ID cards, visiting cards and wedding or event invitations, with Bangla versions. Edit every field, add a QR code, and make one for everyone from a CSV.',
  alternates: { canonical: '/templates' },
};

const groups: { id: string; title: string; intro?: string; noun: string; presets: Preset[]; guide?: [string, string]; blank: [string, string, string] }[] = [
  {
    id: 'certificates',
    title: 'Certificates',
    noun: 'certificate',
    presets: CERTIFICATE_PRESETS,
    blank: ['/create?preset=blank', 'Start blank', 'Or upload your own design as the background.'],
  },
  {
    id: 'id-cards',
    title: 'ID cards',
    intro: 'Standard 85.6 × 54 mm cards with a photo for each person, printed on A4 sheets with cut marks or on a card printer.',
    noun: 'ID card',
    presets: ID_CARD_PRESETS,
    guide: ['/id-card-maker', 'How ID cards work'],
    blank: ['/create?preset=blank-id-card', 'Start a blank card', 'Or upload your own card design as the background.'],
  },
  {
    id: 'visiting-cards',
    title: 'Visiting cards',
    intro: '3.5 × 2 inch cards for a whole team, printed a sheet per person, with a QR code that saves the contact to a phone.',
    noun: 'visiting card',
    presets: VISITING_CARD_PRESETS,
    guide: ['/visiting-card-maker', 'How visiting cards work'],
    blank: ['/create?preset=blank-visiting-card', 'Start a blank visiting card', 'Or upload your own card design as the background.'],
  },
  {
    id: 'invitations',
    title: 'Invitations',
    intro: 'Wedding and event invitations with each guest’s name, to print or to send as images.',
    noun: 'invitation',
    presets: INVITATION_PRESETS,
    guide: ['/invitation-card-maker', 'How invitations work'],
    blank: ['/create?preset=blank-invitation', 'Start a blank invitation', 'Or upload your own invitation design as the background.'],
  },
];

export default function TemplatesPage() {
  return (
    <>
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h1 className="font-display text-[40px] leading-tight">Templates</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-ink-2">
          Every template is fully editable: move any box, change fonts and colours, add your own fields, or replace the background with your own artwork.
        </p>
        <nav aria-label="Kinds of template" className="mt-6 flex flex-wrap gap-2 text-[14.5px]">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="rounded-full border border-rule-2 bg-card px-3.5 py-1.5 text-ink-2 hover:border-accent hover:text-ink">
              {g.title}
            </a>
          ))}
        </nav>
        {groups.map((g, i) => (
          <section key={g.id} aria-labelledby={g.id} className={i ? 'mt-16' : 'mt-12'}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id={g.id} className="scroll-mt-24 font-display text-[26px] leading-tight">{g.title}</h2>
              {g.guide && (
                <Link href={g.guide[0]} className="text-[15px] text-accent underline underline-offset-4 hover:text-accent-dark">
                  {g.guide[1]}
                </Link>
              )}
            </div>
            {g.intro && <p className="mt-2 max-w-[62ch] text-[15.5px] text-ink-2">{g.intro}</p>}
            <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {g.presets.map((p) => (
                <li key={p.slug}>
                  <Link href={`/templates/${p.slug}`} className="group block">
                    <div className="rounded-xl border border-rule bg-card p-1.5 transition-colors group-hover:border-accent">
                      <TemplatePreview framed slug={p.slug} label={`${p.name} ${g.noun} template`} />
                    </div>
                    <h3 className="mt-3 text-[17px] font-medium">{p.name}</h3>
                    <p className="text-[14.5px] text-muted">{p.description}</p>
                  </Link>
                </li>
              ))}
              <li>
                <Link href={g.blank[0]} className="flex h-full min-h-48 flex-col justify-center rounded-xl border border-dashed border-rule-2 p-6 hover:border-accent">
                  <span className="font-display text-[22px]">{g.blank[1]}</span>
                  <span className="mt-1 text-[14.5px] text-muted">{g.blank[2]}</span>
                </Link>
              </li>
            </ul>
          </section>
        ))}
      </div>
      <CtaBand title="Make it yours in a few minutes">
        Open any template in the editor, change every word and colour, and issue it with a QR code that proves it.
      </CtaBand>
    </>
  );
}
