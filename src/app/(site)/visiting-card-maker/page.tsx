import type { Metadata } from 'next';
import Link from 'next/link';
import { VISITING_CARD_PRESETS } from '@/lib/presets';
import { formatMoney, limits, packages, site } from '@/lib/site';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { CtaBand } from '@/components/site/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { btn } from '@/components/ui/styles';

export const metadata: Metadata = {
  title: { absolute: `Visiting Card Maker: Business Cards for Your Whole Team, in Bulk | ${site.name}` },
  description:
    'Make visiting cards for your whole team from one design and a spreadsheet. Print a sheet of ten for each person on A4, or send card-size PDFs to a print shop. A QR code on each card saves the contact to a phone.',
  alternates: { canonical: '/visiting-card-maker' },
};

const steps = [
  ['Design the card', 'Start from a template or upload a card designed elsewhere. Type the company name, website and address once: every card shares them.'],
  ['Add your team', 'Upload a CSV with one row per person: name, designation, mobile and email. Each row becomes a card.'],
  ['Check before you issue', 'Preview anyone’s card. Empty names and repeated rows are flagged before anything is issued.'],
  ['Print and cut', 'Download a full A4 sheet of cards for each person, with cut marks, or card-size pages for a print shop.'],
];

const features = [
  ['A QR code that saves the contact', 'Scanning a card opens its contact page. One tap on Save contact puts the name, number, email, website and address into the phone.'],
  ['A sheet for each person', 'Visiting cards are printed by the hundred, so each person gets an A4 sheet of their own: ten cards, edge to edge, ready to cut.'],
  ['Ready for a print shop', 'Or download every card at 3.5 × 2 inches, one to a page, for a print shop or a card printer. Text is drawn at about 576 dpi.'],
  ['Retire a card when someone leaves', 'Revoke a card and its contact page says it is no longer in use, so nobody saves an old number from it.'],
  ['Your own design', 'Upload a background made in Canva, Illustrator or Photoshop and drop the name, the details and the QR code onto it.'],
  ['Bangla cards', 'Bangla names and wording render with proper conjuncts, and there is a ready-made Bangla visiting card template.'],
];

const faqs = [
  {
    q: 'What size are the cards?',
    a: 'The visiting card size used in Bangladesh and India, 3.5 × 2 inches (88.9 × 50.8 mm), in landscape or portrait. It is also the standard business card size in the United States.',
  },
  {
    q: 'How do I print them on an ordinary printer?',
    a: 'Download A4 sheets: ten landscape or nine portrait cards to a page, edge to edge, with cut marks in the margins. Print at actual size (100%, not “fit to page”) on the thickest card your printer takes, then cut along the marks.',
  },
  {
    q: 'Can a print shop print them?',
    a: 'Yes. Download the cards at card size, one to a page, and send the PDF. Each person’s card is a page of its own, so the shop can print as many of each as you need.',
  },
  {
    q: 'What happens when someone scans the QR code?',
    a: `Their phone opens the card’s contact page on ${site.name}, with buttons to save the contact, call and email. Saving adds the name, designation, company, phone numbers, email, website and address to their contacts.`,
  },
  {
    q: 'Does every card need the company details typed in?',
    a: 'No. Details marked “same for everyone”, such as the company name, website and office address, are typed once in the editor and appear on every card, so your spreadsheet only needs each person’s own details.',
  },
  {
    q: 'What does it cost?',
    a: `A free account makes ${limits.freeMonthly} cards a month, one at a time. Making cards for a whole team from a spreadsheet comes with a package, from ${formatMoney(packages[0].price)}; each person’s card uses one credit, however many copies you print.`,
  },
];

export default function VisitingCardMakerPage() {
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
            <h1 className="font-display text-[34px] leading-[1.05] sm:text-[44px]">Visiting cards for your whole team</h1>
            <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">
              Design your company’s card once, then make one for everyone from a spreadsheet. Each card carries a QR code that saves the contact to
              a phone, and prints ten to an A4 sheet or at 3.5 × 2 inches for a print shop.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create?preset=corporate-visiting-card" className={btn.primary + ' min-h-12 px-6 text-[16px]'}>
                Design a visiting card
              </Link>
              <Link href="/templates#visiting-cards" className={btn.secondary + ' min-h-12 px-6 text-[16px]'}>
                Visiting card templates
              </Link>
            </div>
            <p className="mt-4 text-[14px] text-muted">
              Free to start. Cards for a whole team with a package, from {formatMoney(packages[0].price)}.{' '}
              <Link href="/pricing" className="underline underline-offset-2 hover:text-ink">
                See pricing
              </Link>
            </p>
          </div>
          <div className="grid grid-cols-[1fr_0.57fr] items-center gap-4">
            <div className="overflow-hidden rounded-lg border border-rule-2 bg-card shadow-[0_20px_44px_-28px_rgba(15,23,42,0.5)]">
              <TemplatePreview slug="corporate-visiting-card" label="Corporate visiting card with a QR code that saves the contact" sizes="(min-width: 1024px) 330px, 60vw" priority />
            </div>
            <div className="overflow-hidden rounded-lg border border-rule-2 bg-card shadow-[0_20px_44px_-28px_rgba(15,23,42,0.5)]">
              <TemplatePreview slug="bold-visiting-card" label="Dark portrait visiting card with gold accents" sizes="(min-width: 1024px) 190px, 34vw" priority />
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
          <h2 id="features-h" className="font-display text-[28px] leading-tight">Made for printing cards for a whole team</h2>
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
            <h2 id="templates-h" className="font-display text-[28px] leading-tight">Visiting card templates</h2>
            <Link href="/create?preset=blank-visiting-card" className="text-[15px] text-accent underline underline-offset-4 hover:text-accent-dark">
              Or start from a blank card
            </Link>
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VISITING_CARD_PRESETS.map((p) => (
              <li key={p.slug}>
                <Link href={`/templates/${p.slug}`} className="group block">
                  <div className="rounded-xl border border-rule bg-card p-1.5 transition-colors group-hover:border-accent">
                    <TemplatePreview framed slug={p.slug} label={`${p.name} visiting card template`} sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw" />
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
      <CtaBand title="Make your team’s cards in a few minutes">
        Pick a template, type your company’s details once, and download a sheet of cards for everyone, each with a QR code that saves the contact.
      </CtaBand>
    </>
  );
}
