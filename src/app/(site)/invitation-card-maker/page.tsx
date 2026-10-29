import type { Metadata } from 'next';
import Link from 'next/link';
import { INVITATION_PRESETS } from '@/lib/presets';
import { formatMoney, limits, packages, site } from '@/lib/site';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { CtaBand } from '@/components/site/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { btn } from '@/components/ui/styles';

export const metadata: Metadata = {
  title: { absolute: `Wedding Invitation Card Maker with Guest Names, in Bulk | ${site.name}` },
  description:
    'Make wedding and event invitations with each guest’s name on their own card, from your guest list. Print them, or download an image for every guest to send on WhatsApp or Messenger.',
  alternates: { canonical: '/invitation-card-maker' },
};

const steps = [
  ['Design the invitation', 'Start from a template or upload your own design. Type the date, the venue and the RSVP number once; every invitation shares them.'],
  ['Add your guest list', 'Upload a CSV with a row for each guest, written as it should be printed: “Mr. & Mrs. Rahman” or “Karim Uddin and family”.'],
  ['Check the names', 'Preview any guest’s invitation before anything is made. Empty names and repeated rows are flagged.'],
  ['Print or send', 'Download one PDF for the print shop, or a ZIP with an image for each guest, named after them, ready to send.'],
];

const features = [
  ['Every guest by name', 'Each invitation greets its own guest by name, so nobody has to write hundreds of names by hand.'],
  ['Images to send', 'Download a JPG for each guest, named after them, to send on WhatsApp, Messenger or by email.'],
  ['Directions in one scan', 'The QR code opens the invitation’s page, with the date, the venue on a map and the number to call.'],
  ['Checked at the door', 'Whoever welcomes guests can scan an invitation and see at once that it is genuine and whom it is for. Withdraw one, and its page says so.'],
  ['Bangla invitations', 'A ready-made শুভ বিবাহ template, with Bangla names and wording that render properly.'],
  ['Your own design', 'Upload invitation artwork made anywhere, and place each guest’s name where it belongs on it.'],
];

const faqs = [
  {
    q: 'What sizes can the invitations be?',
    a: '5 × 7 inches in portrait or landscape, A5, or a 6-inch square. Images are made 1600 pixels along the long side, sharp on any phone.',
  },
  {
    q: 'How do I send each guest their invitation?',
    a: 'Choose “Images” when you download. You get a ZIP with a JPG for each guest, named after them, ready to attach in WhatsApp or Messenger.',
  },
  {
    q: 'Can a print shop print them with the names?',
    a: 'Yes. Download one PDF with a page for each guest, each with their own name on it, and the print shop prints it as it is.',
  },
  {
    q: 'Do I need a QR code on a wedding card?',
    a: 'No. It is there for directions and for checking invitations at the door. Delete it in the editor if you would rather not have one.',
  },
  {
    q: 'Who can see a guest’s name?',
    a: 'Anyone holding the invitation, by scanning its code. Each invitation’s page has its own random address and is kept out of search engines unless you choose otherwise.',
  },
  {
    q: 'What does it cost?',
    a: `A free account makes ${limits.freeMonthly} invitations a month, one at a time. A whole guest list from a spreadsheet comes with a package, from ${formatMoney(packages[0].price)} for ${packages[0].credits.toLocaleString()}; each guest’s invitation uses one credit.`,
  },
];

export default function InvitationMakerPage() {
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
            <h1 className="font-display text-[34px] leading-[1.05] sm:text-[44px]">Invitations with every guest’s name</h1>
            <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">
              Design your wedding or event invitation once, add your guest list, and get a personal invitation for each guest: a PDF to print, or an
              image to send on WhatsApp or Messenger. The QR code on each one opens the venue on a map, and shows at the door that it is genuine.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/create?preset=wedding-invitation" className={btn.primary + ' min-h-12 px-6 text-[16px]'}>
                Design an invitation
              </Link>
              <Link href="/templates#invitations" className={btn.secondary + ' min-h-12 px-6 text-[16px]'}>
                Invitation templates
              </Link>
            </div>
            <p className="mt-4 text-[14px] text-muted">
              Free to start. A whole guest list with a package, from {formatMoney(packages[0].price)}.{' '}
              <Link href="/pricing" className="underline underline-offset-2 hover:text-ink">
                See pricing
              </Link>
            </p>
          </div>
          <div className="grid grid-cols-[0.72fr_1fr] items-center gap-4">
            <div className="overflow-hidden rounded-lg border border-rule-2 bg-card shadow-[0_20px_44px_-28px_rgba(15,23,42,0.5)]">
              <TemplatePreview slug="wedding-invitation" label="Wedding invitation with the guest’s name at the top" sizes="(min-width: 1024px) 230px, 42vw" priority />
            </div>
            <div className="overflow-hidden rounded-lg border border-rule-2 bg-card shadow-[0_20px_44px_-28px_rgba(15,23,42,0.5)]">
              <TemplatePreview slug="event-invitation" label="Event invitation with a code to show at the entrance" sizes="(min-width: 1024px) 320px, 58vw" priority />
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
          <h2 id="features-h" className="font-display text-[28px] leading-tight">Made for a whole guest list</h2>
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
            <h2 id="templates-h" className="font-display text-[28px] leading-tight">Invitation templates</h2>
            <Link href="/create?preset=blank-invitation" className="text-[15px] text-accent underline underline-offset-4 hover:text-accent-dark">
              Or start from a blank invitation
            </Link>
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {INVITATION_PRESETS.map((p) => (
              <li key={p.slug}>
                <Link href={`/templates/${p.slug}`} className="group block">
                  <div className="rounded-xl border border-rule bg-card p-1.5 transition-colors group-hover:border-accent">
                    <TemplatePreview framed slug={p.slug} label={`${p.name} invitation template`} sizes="(min-width: 1024px) 370px, (min-width: 640px) 50vw, 100vw" />
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
      <CtaBand title="Invite everyone by name">
        Pick a template, type the date and venue once, add your guest list, and download an invitation for every guest.
      </CtaBand>
    </>
  );
}
