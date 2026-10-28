import type { Metadata } from 'next';
import Link from 'next/link';
import { ID_CARD_PRESETS } from '@/lib/presets';
import { formatMoney, limits, packages, site } from '@/lib/site';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { CtaBand } from '@/components/site/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { btn } from '@/components/ui/styles';

export const metadata: Metadata = {
  title: { absolute: `ID Card Maker with Photos, Bulk from CSV and QR Verification | ${site.name}` },
  description:
    'Make ID cards for clubs, schools and organisations: a template or your own design, everyone’s photo matched from a spreadsheet, print-ready A4 sheets with cut marks, and a QR code that shows each card is genuine.',
  alternates: { canonical: '/id-card-maker' },
};

const steps = [
  ['Design the card', 'Start from a template or upload a card you designed elsewhere, then place the photo frame and the details where you want them.'],
  ['Add everyone at once', 'Upload your member list as a CSV, and the photos, one by one or as a ZIP. Each photo is matched to its row by file name, such as 1001.jpg for member 1001.'],
  ['Check before you issue', 'Preview any row. A missing photo, an empty name or a date that isn’t one is flagged before anything is issued.'],
  ['Print and cut', 'Download A4 sheets with cut marks for an office printer, or card-size pages for a PVC card printer.'],
];

const features = [
  ['Photos stay on your computer', 'Photos are placed on the cards in your browser and never uploaded, so nobody is handed a folder of your members’ faces.'],
  ['A QR code on every card', 'Scanning it opens a page that shows the card holder, your organisation, and whether the card is valid, expired or revoked.'],
  ['Valid until, and revoke', 'Give cards an end date and the page says when one has expired. Revoke a card when someone leaves, and the page says so at once.'],
  ['The standard card size', 'Cards are 85.6 × 54 mm, landscape or portrait: the size card printers print and card holders are made for.'],
  ['Your own design', 'Upload a background made in Canva, Illustrator or Photoshop and drop the name, the photo frame and the QR code onto it.'],
  ['Bangla cards', 'Bangla names and wording render with proper conjuncts, and there is a ready-made সদস্য পরিচয়পত্র template.'],
];

const faqs = [
  {
    q: 'What size are the cards?',
    a: 'The standard ID card size, 85.6 × 54 mm (ISO/IEC 7810 ID-1, often called CR80), in landscape or portrait. It is the size PVC card printers print, and the size card holders and lanyard sleeves are made for.',
  },
  {
    q: 'How do I print them on an ordinary printer?',
    a: 'Download them as A4 sheets: 10 landscape or 9 portrait cards to a page, edge to edge, with cut marks in the margins. Print at actual size (100%, not “fit to page”), cut along the marks, then laminate them or put them in card holders.',
  },
  {
    q: 'Can I print on PVC cards?',
    a: 'Yes. Download one card per page at card size and print from your card printer’s software at actual size.',
  },
  {
    q: 'How are photos matched to people?',
    a: 'By file name. Name each photo after a column in your spreadsheet, such as the member ID (1001.jpg), or add a column holding each photo’s file name. Photos can be JPEG, PNG or WebP, chosen one by one or as a ZIP.',
  },
  {
    q: 'Are the photos uploaded?',
    a: 'No. They are used in your browser to build the PDF and never leave your computer. To download a card again later, you choose its photo again.',
  },
  {
    q: 'What does it cost?',
    a: `A free account makes ${limits.freeMonthly} verifiable certificates or ID cards a month, one at a time. Making cards for a whole group from a spreadsheet comes with a package, from ${formatMoney(packages[0].price)}; each card uses one credit, the same as a certificate.`,
  },
  {
    q: 'What does someone see when they scan the QR code?',
    a: `A page on ${site.name} with the card holder’s name, the details you chose to show (such as role and member ID), your organisation, and whether the card is valid, expired or revoked. Photos and private details are never shown.`,
  },
];

export default function IdCardMakerPage() {
  return (
    <>
      <article className="mx-auto max-w-6xl px-5 py-14">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
          }}
        />
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <h1 className="font-display text-[34px] leading-[1.05] sm:text-[44px]">ID cards for clubs, schools and organisations</h1>
            <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">
              Design a member, staff or student ID card once, then make one for everyone from a spreadsheet and their photos. Print them on A4 sheets
              with cut marks or on a card printer, and every card carries a QR code that shows it is genuine.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create?preset=club-member-card" className={btn.primary + ' min-h-12 px-6 text-[16px]'}>
                Design an ID card
              </Link>
              <Link href="/templates#id-cards" className={btn.secondary + ' min-h-12 px-6 text-[16px]'}>
                ID card templates
              </Link>
            </div>
            <p className="mt-4 text-[14px] text-muted">
              Free to start. Bulk from a spreadsheet with a package, from {formatMoney(packages[0].price)}.{' '}
              <Link href="/pricing" className="underline underline-offset-2 hover:text-ink">
                See pricing
              </Link>
            </p>
          </div>
          <div className="grid grid-cols-[0.63fr_1fr] items-center gap-4">
            <div className="overflow-hidden rounded-lg border border-rule-2 bg-card shadow-[0_20px_44px_-28px_rgba(15,23,42,0.5)]">
              <TemplatePreview slug="club-member-card" label="Club member ID card, portrait" sizes="(min-width: 1024px) 200px, 38vw" priority />
            </div>
            <div className="overflow-hidden rounded-lg border border-rule-2 bg-card shadow-[0_20px_44px_-28px_rgba(15,23,42,0.5)]">
              <TemplatePreview slug="staff-id-card" label="Staff ID card, landscape" sizes="(min-width: 1024px) 320px, 60vw" priority />
            </div>
          </div>
        </div>

        <section aria-labelledby="how-h" className="mt-20">
          <h2 id="how-h" className="font-display text-[28px] leading-tight">How it works</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-4">
            {steps.map(([title, body], i) => (
              <li key={title} className="border-t-2 border-accent pt-5">
                <span className="font-mono text-[13px] text-accent">{i + 1}</span>
                <h3 className="mt-1 text-[18px] font-semibold">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="features-h" className="mt-20">
          <h2 id="features-h" className="font-display text-[28px] leading-tight">Made for issuing cards to a whole group</h2>
          <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([title, body]) => (
              <div key={title}>
                <h3 className="text-[17px] font-semibold">{title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="templates-h" className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="templates-h" className="font-display text-[28px] leading-tight">ID card templates</h2>
            <Link href="/create?preset=blank-id-card" className="text-[15px] text-accent underline underline-offset-4 hover:text-accent-dark">
              Or start from a blank card
            </Link>
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ID_CARD_PRESETS.map((p) => (
              <li key={p.slug}>
                <Link href={`/templates/${p.slug}`} className="group block">
                  <div className="rounded-xl border border-rule bg-card p-1.5 transition-colors group-hover:border-accent">
                    <TemplatePreview framed slug={p.slug} label={`${p.name} ID card template`} sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw" />
                  </div>
                  <p className="mt-3 font-medium">{p.name}</p>
                  <p className="text-[14px] text-muted">{p.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq-h" className="mx-auto mt-20 max-w-3xl">
          <h2 id="faq-h" className="font-display text-[28px]">Questions</h2>
          <dl className="mt-6 divide-y divide-rule border-y border-rule">
            {faqs.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="text-[17px] font-medium">{f.q}</dt>
                <dd className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </article>
      <CtaBand title="Make your first ID card in a few minutes">
        Pick a template, add a name and a photo, and download a card that anyone can check with their phone.
      </CtaBand>
    </>
  );
}
