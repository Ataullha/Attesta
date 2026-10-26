import type { Metadata } from 'next';
import Link from 'next/link';
import { btn } from '@/components/ui/styles';
import { CtaBand } from '@/components/site/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { SealMark } from '@/components/site/SealMark';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { Tick } from '@/components/site/Tick';
import { VerifySearch } from '@/components/site/VerifySearch';
import { PRESETS } from '@/lib/presets';
import { USE_CASES } from '@/lib/usecases';
import { formatMoney, limits, packages, paymentMethodsInWords, perCertificate, site } from '@/lib/site';

export const metadata: Metadata = { alternates: { canonical: '/' } };

const cheapest = Math.min(...packages.map(perCertificate));
const dearest = Math.max(...packages.map(perCertificate));

const faqs = [
  {
    q: 'Is it free?',
    a: `You can make ${limits.guestLifetime} certificates without an account. A free account gives you ${limits.freeMonthly} verifiable certificates every month. Bulk issuing and larger volumes use prepaid packages, from ${formatMoney(packages[0].price)} for ${packages[0].credits.toLocaleString()} certificates.`,
  },
  {
    q: 'How do I pay?',
    a: `Choose a package in your dashboard, send the amount by ${paymentMethodsInWords()}, and enter the transaction ID. Credits are added once the payment is confirmed, and they never expire.`,
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

const structuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    url: site.url,
    logo: `${site.url}/icon.svg`,
    email: site.supportEmail,
  },
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: site.name,
    url: site.url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: site.description,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BDT',
      lowPrice: 0,
      highPrice: Math.max(...packages.map((p) => p.price)),
      offerCount: packages.length + 1,
    },
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
];

const facts = [
  ['Signed, tamper-evident records', 'Each certificate’s record is digitally signed. Change one character and its verification page says so.'],
  ['Bangla that renders properly', 'Conjuncts like ক্ষ and ন্দ্র stay intact, with three Bangla typefaces built in.'],
  [`Up to ${limits.bulkMaxRows.toLocaleString()} at a time`, 'Issue a whole cohort from a CSV, with every row checked before anything is issued.'],
  ['Private by default', 'Verification pages show a first name and last initial unless you choose otherwise.'],
];

const audiences = [
  {
    who: 'For issuers',
    title: 'Protect your organisation’s name',
    body: 'Stop answering “is this certificate real?” emails. Issue a cohort in minutes, revoke a mistake in seconds, and show a verified-organisation badge.',
    link: ['How issuing works', '#how'],
  },
  {
    who: 'For recipients',
    title: 'Proof that travels',
    body: 'One link proves the certificate. Share it with an employer, print it with its QR code, or add it to a LinkedIn profile.',
    link: ['See an example', '#example'],
  },
  {
    who: 'For employers and admissions',
    title: 'Checked in seconds',
    body: 'Scan the QR code or type the serial — no account needed. See who issued it, when, and whether it has been revoked.',
    link: ['Verify a certificate', '/verify'],
  },
];

export default function Home() {
  return (
    <>
      <JsonLd data={structuredData} />

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div>
          <p className="font-mono text-[12.5px] uppercase tracking-[0.12em] text-brass">For training centres, universities, events and employers</p>
          <h1 className="mt-4 font-serif text-[44px] leading-[1.02] tracking-[-0.01em] sm:text-[64px]">Certificates anyone can check in one scan.</h1>
          <p className="mt-6 max-w-[54ch] text-[18px] leading-relaxed text-ink-2">
            Design once, issue one certificate or thousands from a spreadsheet, and give each one a signed verification page. Recipients prove it with a link, employers check it in seconds, and forgeries stand out.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/create" className={btn.primary + ' min-h-12 px-6 text-[16px]'}>
              Make a certificate
            </Link>
            <Link href="/pricing" className={btn.secondary + ' min-h-12 px-6 text-[16px]'}>
              See pricing
            </Link>
          </div>
          <ul className="mt-6 space-y-1.5 text-[14.5px] text-ink-2">
            <li className="flex gap-2"><Tick />Your first {limits.guestLifetime} need no account</li>
            <li className="flex gap-2"><Tick />{limits.freeMonthly} verifiable certificates a month on a free account</li>
            <li className="flex gap-2"><Tick />Pay in taka by {paymentMethodsInWords()}</li>
          </ul>
        </div>

        <div className="relative pb-6">
          <div className="rotate-[-1.2deg] border border-rule-2 bg-card p-2 shadow-[0_30px_60px_-30px_rgba(25,23,18,0.45)]">
            <TemplatePreview slug="classic-ledger" label="Example completion certificate with a QR code and a signature line" sizes="(min-width: 1024px) 540px, 100vw" priority />
          </div>
          <div className="absolute bottom-0 right-2 flex max-w-[260px] items-start gap-3 border border-seal/30 bg-seal-soft px-4 py-3 shadow-[0_12px_30px_-18px_rgba(46,107,79,0.6)] sm:right-6">
            <SealMark size={30} color="#2E6B4F" className="mt-0.5 shrink-0" />
            <p className="text-[13.5px] leading-snug text-seal">
              <span className="block font-semibold">Valid certificate</span>
              Issued 21 September 2026 · signature confirmed
            </p>
          </div>
        </div>
      </section>

      <section aria-label="Why it can be trusted" className="border-y border-rule bg-card">
        <dl className="mx-auto grid max-w-6xl gap-x-10 gap-y-7 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {facts.map(([t, d]) => (
            <div key={t}>
              <dt className="text-[15.5px] font-semibold">{t}</dt>
              <dd className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20" aria-labelledby="who-h">
        <h2 id="who-h" className="max-w-[24ch] font-serif text-[40px] leading-tight">One certificate, three people who need to trust it</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {audiences.map((a) => (
            <div key={a.who} className="flex flex-col border border-rule bg-card p-6">
              <p className="font-mono text-[12.5px] uppercase tracking-[0.1em] text-brass">{a.who}</p>
              <h3 className="mt-3 font-serif text-[27px] leading-tight">{a.title}</h3>
              <p className="mt-3 flex-1 text-[15.5px] leading-relaxed text-ink-2">{a.body}</p>
              <Link href={a.link[1]} className="mt-5 text-[15px] font-medium text-brass underline underline-offset-4 hover:text-brass-dark">
                {a.link[0]}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-t border-rule" aria-labelledby="how-h">
        <div className="mx-auto max-w-6xl px-5 py-20">
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
          <p className="mt-10">
            <Link href="/create" className={btn.primary}>
              Try the editor now
            </Link>
          </p>
        </div>
      </section>

      <section className="bg-ink text-card" aria-labelledby="features-h">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 id="features-h" className="max-w-[22ch] font-serif text-[40px] leading-tight">Built for organisations that issue a lot of certificates</h2>
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

      <section id="example" className="mx-auto grid max-w-6xl scroll-mt-20 items-center gap-12 px-5 py-20 lg:grid-cols-2" aria-labelledby="example-h">
        <div>
          <h2 id="example-h" className="font-serif text-[40px] leading-tight">What someone sees when they scan</h2>
          <p className="mt-4 max-w-[52ch] text-[16.5px] leading-relaxed text-ink-2">
            Every certificate has its own permanent page. It answers the questions an employer or admissions office would otherwise email you about.
          </p>
          <ul className="mt-6 space-y-2.5 text-[15.5px] text-ink-2">
            <li className="flex gap-2.5"><Tick />Who issued it, and whether the organisation is verified</li>
            <li className="flex gap-2.5"><Tick />When it was issued, and any revocation with its reason</li>
            <li className="flex gap-2.5"><Tick />A check of the digital signature on the stored record</li>
          </ul>
          <div className="mt-9 border-t border-rule pt-6">
            <h3 className="text-[15px] font-semibold">Holding a certificate? Check it now</h3>
            <VerifySearch className="mt-3 max-w-md" />
          </div>
        </div>
        <figure className="border border-rule bg-card p-5 shadow-[0_24px_50px_-34px_rgba(25,23,18,0.5)] sm:p-7">
          <div className="flex items-start gap-3 border border-seal/30 bg-seal-soft p-4">
            <SealMark size={34} color="#2E6B4F" className="shrink-0" />
            <div>
              <p className="font-serif text-[26px] leading-tight text-seal">Valid certificate</p>
              <p className="text-[13.5px] text-ink-2">Issued on 21 September 2026. The signed record matches.</p>
            </div>
          </div>
          <dl className="mt-4 text-[14.5px]">
            {[
              ['Serial number', <span key="s" className="font-mono tracking-wide">{site.serialPrefix}-7K2Q-9M4D-X1TB</span>],
              ['Awarded to', 'Nusrat J.'],
              ['Course', 'Foundations of Data Analysis'],
              [
                'Issued by',
                <span key="i">
                  Your organisation <span className="ml-1.5 inline-flex rounded-full bg-seal px-2 py-0.5 text-[11.5px] font-medium text-card">Verified organisation</span>
                </span>,
              ],
            ].map(([label, value]) => (
              <div key={String(label)} className="grid grid-cols-[120px_1fr] gap-3 border-b border-rule py-2.5 last:border-b-0">
                <dt className="text-muted">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <figcaption className="mt-3 text-[12.5px] text-muted">An example verification page.</figcaption>
        </figure>
      </section>

      <section className="border-t border-rule" aria-labelledby="uses-h">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="uses-h" className="font-serif text-[40px] leading-tight">Certificates for every occasion</h2>
            <Link href="/certificate-maker" className="text-[15px] text-brass underline underline-offset-4 hover:text-brass-dark">
              All use cases
            </Link>
          </div>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u) => (
              <li key={u.slug} lang={u.slug === 'bangla-certificate' ? 'bn' : undefined}>
                <Link href={`/certificate-maker/${u.slug}`} className="block h-full border border-rule bg-card p-5 transition-colors hover:border-brass">
                  <span className="block font-medium">{u.short}</span>
                  <span className="mt-1.5 block text-[14px] leading-snug text-muted">{u.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-rule" aria-labelledby="templates-h">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="templates-h" className="font-serif text-[40px] leading-tight">Start from a template</h2>
            <Link href="/templates" className="text-[15px] text-brass underline underline-offset-4 hover:text-brass-dark">
              See all {PRESETS.length} templates
            </Link>
          </div>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PRESETS.slice(0, 4).map((p) => (
              <li key={p.slug}>
                <Link href={`/templates/${p.slug}`} className="group block">
                  <div className="border border-rule bg-card p-1.5 transition-colors group-hover:border-brass">
                    <TemplatePreview framed slug={p.slug} label={`${p.name} template preview`} sizes="(min-width: 1024px) 270px, (min-width: 640px) 50vw, 100vw" />
                  </div>
                  <p className="mt-3 font-medium">{p.name}</p>
                  <p className="text-[14px] text-muted">{p.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-y border-rule bg-card" aria-labelledby="price-h">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <h2 id="price-h" className="font-serif text-[40px] leading-tight">Start free, pay when you issue in volume</h2>
          <div className="mt-10 grid gap-px overflow-hidden border border-rule bg-rule md:grid-cols-3">
            {[
              ['Without an account', `${limits.guestLifetime} certificates`, 'Not registered, so the QR code won’t confirm them. Good for trying the editor.'],
              ['Free account', `${limits.freeMonthly} a month`, 'Verifiable certificates with QR codes, saved templates and a signature library.'],
              ['Packages', `From ${formatMoney(packages[0].price)}`, `${formatMoney(dearest)} down to ${formatMoney(cheapest)} per certificate. Bulk issuing from CSV, and credits never expire.`],
            ].map(([t, p, d]) => (
              <div key={t} className="bg-card p-7">
                <h3 className="text-[15px] text-muted">{t}</h3>
                <p className="mt-2 font-serif text-[36px] leading-none">{p}</p>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">{d}</p>
              </div>
            ))}
          </div>
          <Link href="/pricing" className="mt-6 inline-block text-[15px] text-brass underline underline-offset-4 hover:text-brass-dark">
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

      <CtaBand />
    </>
  );
}
