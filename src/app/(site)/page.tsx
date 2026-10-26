import type { Metadata } from 'next';
import Link from 'next/link';
import { btn } from '@/components/ui/styles';
import { TemplateThumb } from '@/components/site/TemplateThumb';
import { VerifySearch } from '@/components/site/VerifySearch';
import { AdSlot } from '@/components/site/AdSlot';
import { SealMark } from '@/components/site/SealMark';
import { PRESETS } from '@/lib/presets';
import { limits, packages, formatMoney, site } from '@/lib/site';

export const metadata: Metadata = { alternates: { canonical: '/' } };

const faqs = [
  {
    q: 'Is it free?',
    a: `You can make ${limits.guestLifetime} certificates without an account. A free account gives you ${limits.freeMonthly} verifiable certificates every month. Bulk issuing and larger volumes use prepaid packages starting at ${packages[0].credits} certificates.`,
  },
  {
    q: 'Can I place the name and other details wherever I want?',
    a: 'Yes. Every piece of text, the signature, QR code and barcode is a box you can drag, resize and style. You can add your own fields — roll number, grade, department — and place each one anywhere.',
  },
  {
    q: 'Can I use a certificate I designed in Canva or Photoshop?',
    a: 'Yes. Export it as PNG or JPG with the name area left empty, upload it as the background, and drag field boxes onto it.',
  },
  {
    q: 'How does verification work?',
    a: 'Each certificate gets a random serial and a digitally signed record of who issued it and when. Scanning the QR code opens its verification page, which also shows if it has been revoked.',
  },
  {
    q: 'What does the recipient’s verification page show?',
    a: 'By default, the first name and last initial, the issuer, the date and the fields you mark as public. You can choose to show the full name or hide it entirely.',
  },
  {
    q: 'Does it work in Bangla?',
    a: 'Yes. Certificates render in your browser, so Bangla conjuncts display correctly, and three Bangla typefaces are included.',
  },
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};

const orgJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: site.name,
  url: site.url,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: site.description,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BDT' },
};

export default function Home() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([orgJsonLd, faqJsonLd]).replace(/</g, '\\u003c') }} />

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <h1 className="font-serif text-[44px] leading-[1.02] tracking-[-0.01em] sm:text-[64px]">
            Certificates anyone can check in one scan.
          </h1>
          <p className="mt-6 max-w-[52ch] text-[18px] leading-relaxed text-ink-2">
            Design from a template or your own artwork, place every field exactly where you want it, and issue one certificate or thousands from a CSV. Each one carries a QR code that opens its permanent record.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/create" className={btn.primary + ' min-h-12 px-6 text-[16px]'}>
              Make a certificate
            </Link>
            <Link href="/templates" className={btn.secondary + ' min-h-12 px-6 text-[16px]'}>
              Browse templates
            </Link>
          </div>
          <p className="mt-4 text-[14px] text-muted">No account needed for your first {limits.guestLifetime}.</p>
        </div>

        <div className="relative">
          <div className="rotate-[-1.2deg] border border-rule-2 bg-card p-2 shadow-[0_30px_60px_-30px_rgba(25,23,18,0.45)]">
            <TemplateThumb slug="classic-ledger" label="Example completion certificate with QR code and signature" />
          </div>
          <div className="absolute -bottom-6 right-2 flex max-w-[260px] items-start gap-3 border border-seal/30 bg-seal-soft px-4 py-3 shadow-[0_12px_30px_-18px_rgba(46,107,79,0.6)] sm:right-6">
            <SealMark size={30} color="#2E6B4F" className="mt-0.5 shrink-0" />
            <p className="text-[13.5px] leading-snug text-seal">
              <span className="block font-semibold">Valid certificate</span>
              Issued 21 September 2026 · signature confirmed
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="verify-h" className="border-y border-rule bg-card">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="verify-h" className="font-serif text-[28px] leading-tight">Holding a certificate?</h2>
            <p className="text-[15px] text-muted">Type its serial number to see who issued it and whether it is still valid.</p>
          </div>
          <VerifySearch className="w-full md:max-w-md" />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20" aria-labelledby="how-h">
        <h2 id="how-h" className="font-serif text-[40px] leading-tight">From design to a checkable record</h2>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {[
            ['Design', 'Start from a template or upload your own certificate image. Drag boxes for the name, course, date, signature, QR code and any custom fields you add.'],
            ['Issue', 'Fill in one person’s details, or upload a CSV and match its columns to your boxes. Download one PDF or a ZIP of separate files.'],
            ['Verify', 'Anyone scans the QR code or enters the serial. The page shows the issuer, the date, the signed record and any revocation.'],
          ].map(([t, d], i) => (
            <li key={t} className="border-t border-ink pt-5">
              <span className="font-mono text-[13px] text-brass">Step {i + 1}</span>
              <h3 className="mt-2 font-serif text-[28px] leading-none">{t}</h3>
              <p className="mt-3 text-[15.5px] leading-relaxed text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <AdSlot slot="1000000001" />

      <section className="bg-ink text-card" aria-labelledby="features-h">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 id="features-h" className="max-w-[20ch] font-serif text-[40px] leading-tight">Built for organisations that issue a lot of certificates</h2>
          <dl className="mt-12 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {[
              ['Every box where you want it', 'Drag, resize and snap any element. Add custom fields like roll number or grade and place each one precisely, with undo and keyboard nudging.'],
              ['Your own artwork', 'Upload a PNG or JPG designed anywhere as the page background. The page resizes to match it.'],
              ['Bulk from CSV', `Up to ${limits.bulkMaxRows.toLocaleString()} rows at a time, with column matching, row checks and duplicate detection before anything is issued.`],
              ['QR code and barcode', 'A QR code for phones and a Code 128 barcode for scanners, both unique to each certificate.'],
              ['Verified organisations', 'Prove you own your domain and every certificate you issue shows a verified issuer badge.'],
              ['Revocation that sticks', 'Revoke a certificate and its page says so permanently, with your reason and the date.'],
            ].map(([t, d]) => (
              <div key={t} className="border-l border-gold/50 pl-5">
                <dt className="text-[18px] font-semibold">{t}</dt>
                <dd className="mt-2 text-[15.5px] leading-relaxed text-[#D9D2C3]">{d}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20" aria-labelledby="templates-h">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="templates-h" className="font-serif text-[40px] leading-tight">Start from a template</h2>
          <Link href="/templates" className="text-[15px] text-brass underline-offset-4 hover:underline">
            See all {PRESETS.length} templates
          </Link>
        </div>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.slice(0, 4).map((p) => (
            <li key={p.slug}>
              <Link href={`/templates/${p.slug}`} className="group block">
                <div className="border border-rule bg-card p-1.5 transition-colors group-hover:border-brass">
                  <TemplateThumb slug={p.slug} label={`${p.name} template preview`} />
                </div>
                <p className="mt-3 font-medium">{p.name}</p>
                <p className="text-[14px] text-muted">{p.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-y border-rule bg-card" aria-labelledby="price-h">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 id="price-h" className="font-serif text-[40px] leading-tight">Start free, pay when you issue in volume</h2>
          <div className="mt-10 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
            {[
              ['Without an account', `${limits.guestLifetime} certificates`, 'Watermarked, not registered. Good for trying the editor.'],
              ['Free account', `${limits.freeMonthly} a month`, 'Verifiable certificates with QR codes, saved templates, signature library.'],
              ['Packages', `From ${formatMoney(packages[0].price)}`, `${packages[0].credits}+ certificates, bulk CSV issuing, credits never expire.`],
            ].map(([t, p, d]) => (
              <div key={t} className="bg-card p-7">
                <h3 className="text-[15px] text-muted">{t}</h3>
                <p className="mt-2 font-serif text-[36px] leading-none">{p}</p>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{d}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="mt-6 inline-block text-[15px] text-brass underline-offset-4 hover:underline">
            Compare packages
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-20" aria-labelledby="faq-h">
        <h2 id="faq-h" className="font-serif text-[40px] leading-tight">Questions</h2>
        <div className="mt-8 divide-y divide-rule border-y border-rule">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-medium">
                {f.q}
                <span className="text-brass transition-transform group-open:rotate-45" aria-hidden>+</span>
              </summary>
              <p className="mt-3 max-w-[65ch] text-[15.5px] leading-relaxed text-ink-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
