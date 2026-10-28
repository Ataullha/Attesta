import type { Metadata } from 'next';
import Link from 'next/link';
import { CERTIFICATE_PRESETS, ID_CARD_PRESETS } from '@/lib/presets';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { CtaBand } from '@/components/site/CtaBand';

export const metadata: Metadata = {
  title: 'Free certificate and ID card templates',
  description:
    'Free certificate templates for course completion, internships, events, training, competitions and appreciation, and ID card templates for clubs, staff and students — with Bangla versions. Edit every field and add a QR code.',
  alternates: { canonical: '/templates' },
};

export default function TemplatesPage() {
  return (
    <>
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h1 className="font-display text-[40px] leading-tight">Templates</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-ink-2">
          Every template is fully editable: move any box, change fonts and colours, add your own fields, or replace the background with your own artwork.
        </p>
        <h2 id="certificates" className="mt-12 scroll-mt-24 font-display text-[26px] leading-tight">Certificates</h2>
        <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {CERTIFICATE_PRESETS.map((p) => (
            <li key={p.slug}>
              <Link href={`/templates/${p.slug}`} className="group block">
                <div className="rounded-xl border border-rule bg-card p-1.5 transition-colors group-hover:border-accent">
                  <TemplatePreview framed slug={p.slug} label={`${p.name} certificate template`} />
                </div>
                <h3 className="mt-3 text-[17px] font-medium">{p.name}</h3>
                <p className="text-[14.5px] text-muted">{p.description}</p>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/create?preset=blank" className="flex h-full min-h-48 flex-col justify-center rounded-xl border border-dashed border-rule-2 p-6 hover:border-accent">
              <span className="font-display text-[22px]">Start blank</span>
              <span className="mt-1 text-[14.5px] text-muted">Or upload your own design as the background.</span>
            </Link>
          </li>
        </ul>

        <div className="mt-16 flex flex-wrap items-end justify-between gap-4">
          <h2 id="id-cards" className="scroll-mt-24 font-display text-[26px] leading-tight">ID cards</h2>
          <Link href="/id-card-maker" className="text-[15px] text-accent underline underline-offset-4 hover:text-accent-dark">
            How ID cards work
          </Link>
        </div>
        <p className="mt-2 max-w-[62ch] text-[15.5px] text-ink-2">Standard 85.6 × 54 mm cards with a photo for each person, printed on A4 sheets with cut marks or on a card printer.</p>
        <ul className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {ID_CARD_PRESETS.map((p) => (
            <li key={p.slug}>
              <Link href={`/templates/${p.slug}`} className="group block">
                <div className="rounded-xl border border-rule bg-card p-1.5 transition-colors group-hover:border-accent">
                  <TemplatePreview framed slug={p.slug} label={`${p.name} ID card template`} />
                </div>
                <h3 className="mt-3 text-[17px] font-medium">{p.name}</h3>
                <p className="text-[14.5px] text-muted">{p.description}</p>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/create?preset=blank-id-card" className="flex h-full min-h-48 flex-col justify-center rounded-xl border border-dashed border-rule-2 p-6 hover:border-accent">
              <span className="font-display text-[22px]">Start a blank card</span>
              <span className="mt-1 text-[14.5px] text-muted">Or upload your own card design as the background.</span>
            </Link>
          </li>
        </ul>
      </div>
      <CtaBand title="Make it yours in a few minutes">
        Open any template in the editor, change every word and colour, and issue it with a QR code that proves it.
      </CtaBand>
    </>
  );
}
