import type { Metadata } from 'next';
import Link from 'next/link';
import { btn } from '@/components/ui/styles';
import { CtaBand } from '@/components/site/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { Tick } from '@/components/site/Tick';
import { formatMoney, limits, onlinePaymentMethods, orList, packages, paymentMethodsInWords, perCertificate, savingVersusSmallest, site } from '@/lib/site';
import { payByInWords } from '@/lib/payments/methods';
import { sslcommerzConfigured } from '@/lib/payments/sslcommerz';

export const metadata: Metadata = {
  title: 'Pricing',
  description: `Start free: ${limits.guestLifetime} certificates without an account and ${limits.freeMonthly} verifiable certificates a month on a free account. Prepaid packages from ${formatMoney(packages[0].price)} for bulk issuing, paid in taka by ${payByInWords()}.`,
  alternates: { canonical: '/pricing' },
};

const largest = packages[packages.length - 1];
const online = sslcommerzConfigured();

const included = [
  `Bulk issuing from CSV, up to ${limits.bulkMaxRows.toLocaleString()} rows at a time`,
  'A signed record and a verification page for every certificate',
  'Revocation with a public reason, whenever you need it',
  'Saved templates, custom fields and a signature library',
  'Your free monthly certificates are used first',
  'Credits never expire',
];

const faqs = [
  { q: 'Do credits expire?', a: 'No. Credits stay on your account until you use them.' },
  { q: 'Do ID cards use credits too?', a: 'Yes, one credit per ID card, the same as a certificate. Your free monthly allowance covers ID cards as well.' },
  {
    q: 'Which certificates use a credit?',
    a: `Each registered certificate you issue uses one: your ${limits.freeMonthly} free certificates for the month first, then package credits. Certificates made without an account use none, but they are not registered, so their QR code does not confirm them.`,
  },
  { q: 'Can I issue in bulk on a free account?', a: 'Bulk issuing from a CSV comes with a package. On a free account you issue certificates one at a time from the editor.' },
  { q: 'If I revoke a certificate, do I get the credit back?', a: 'No. A revoked certificate keeps its verification page, which shows that it was revoked and why, so the record still exists.' },
  {
    q: 'How long does it take for credits to arrive?',
    a: online
      ? 'Paid online, they are added as soon as the payment goes through. If you send the money yourself, they are added once your transaction ID is matched against the payment, usually within a few hours.'
      : 'Credits are added once your transaction ID is matched against the payment, usually within a few hours.',
  },
  {
    q: 'Can I pay by card?',
    a: online
      ? `Yes. Pay online by ${orList(onlinePaymentMethods)} on the payment page of SSLCommerz, a Bangladeshi payment gateway. Your card and account details go to SSLCommerz, never to us.`
      : `Not at the moment. Payments are by ${paymentMethodsInWords()}.`,
  },
];

const structuredData = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: site.name,
    url: `${site.url}/pricing`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: [
      { '@type': 'Offer', name: 'Free account', price: 0, priceCurrency: 'BDT', description: `${limits.freeMonthly} verifiable certificates a month` },
      ...packages.map((p) => ({ '@type': 'Offer', name: `${p.name} package`, price: p.price, priceCurrency: p.currency, description: `${p.credits.toLocaleString()} certificates` })),
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  },
];

export default function PricingPage() {
  return (
    <>
      <JsonLd data={structuredData} />
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h1 className="font-display text-[40px] leading-tight">Simple, prepaid pricing</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed text-ink-2">
          Start free, and buy credits when you issue in volume. There is no subscription: credits never expire, and you pay in taka by {payByInWords()}.
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="guest-h" className="flex flex-col rounded-xl border border-rule bg-card p-7">
            <h2 id="guest-h" className="text-[15px] text-muted">Without an account</h2>
            <p className="mt-2 font-display text-[32px] leading-none">Free · {limits.guestLifetime} certificates</p>
            <ul className="mt-5 flex-1 space-y-2 text-[15px] text-ink-2">
              <li className="flex gap-2"><Tick />Full editor, all templates, your own background</li>
              <li className="flex gap-2"><Tick />Signature, QR code and barcode</li>
              <li className="flex gap-2"><Tick className="text-muted" />The PDF notes that it is not registered, and there is no verification page</li>
            </ul>
            <Link href="/create" className={btn.secondary + ' mt-7 self-start'}>Open the editor</Link>
          </section>
          <section aria-labelledby="free-h" className="flex flex-col rounded-xl border border-accent bg-card p-7 ring-1 ring-accent">
            <h2 id="free-h" className="text-[15px] text-muted">Free account</h2>
            <p className="mt-2 font-display text-[32px] leading-none">Free · {limits.freeMonthly} a month</p>
            <ul className="mt-5 flex-1 space-y-2 text-[15px] text-ink-2">
              <li className="flex gap-2"><Tick />Every certificate gets a signed verification record</li>
              <li className="flex gap-2"><Tick />Saved templates and a signature library</li>
              <li className="flex gap-2"><Tick />Revoke certificates at any time</li>
              <li className="flex gap-2"><Tick />Verified organisation badge after a domain check</li>
            </ul>
            <Link href="/register" className={btn.primary + ' mt-7 self-start'}>Create a free account</Link>
          </section>
        </div>

        <section aria-labelledby="packages-h" className="mt-20">
          <h2 id="packages-h" className="font-display text-[30px] leading-tight">Packages for bulk issuing</h2>
          <p className="mt-2 max-w-[62ch] text-[15.5px] leading-relaxed text-ink-2">
            Packages add certificate credits and unlock bulk issuing from CSV. The larger the package, the less each certificate costs.
          </p>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {packages.map((p) => {
              const saving = savingVersusSmallest(p);
              return (
                <li key={p.id} className="flex flex-col rounded-xl border border-rule bg-card p-7">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[19px] font-semibold">{p.name}</h3>
                    {saving > 0 && <span className="rounded-full bg-seal-soft px-2.5 py-0.5 text-[12.5px] font-medium text-seal">Save {saving}% per certificate</span>}
                  </div>
                  <p className="mt-1 text-[14.5px] text-muted">{p.note}</p>
                  <p className="mt-6 font-display text-[36px] leading-none">{formatMoney(p.price)}</p>
                  <p className="mt-2 text-[15px] text-ink-2">
                    {p.credits.toLocaleString()} certificates · <span className="tabular-nums">{formatMoney(perCertificate(p))}</span> each
                  </p>
                  <Link href={`/app/billing?package=${p.id}`} className={btn.primary + ' mt-7'}>
                    Buy {p.name}
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="text-[17px] font-semibold">Every package includes</h3>
              <ul className="mt-4 space-y-2.5 text-[15px] text-ink-2">
                {included.map((i) => (
                  <li key={i} className="flex gap-2"><Tick />{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-[17px] font-semibold">How paying works</h3>
              <ol className="mt-4 space-y-3 text-[15px] text-ink-2">
                {(online
                  ? [
                      'Choose a package in your dashboard.',
                      `Pay online by ${orList(onlinePaymentMethods)}.`,
                      'Credits are added as soon as the payment goes through.',
                      `Or send the amount yourself by ${paymentMethodsInWords()} and enter the transaction ID. Credits are added once it is confirmed, usually within a few hours.`,
                    ]
                  : [
                      'Choose a package in your dashboard.',
                      `Send the amount by ${paymentMethodsInWords()}.`,
                      'Enter the transaction ID and the number or account you paid from.',
                      'Credits are added once the payment is confirmed, usually within a few hours.',
                    ]
                ).map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-rule-2 font-mono text-[12.5px] text-accent">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <p className="mt-10 border-t border-rule pt-6 text-[15px] text-ink-2">
            Issuing more than {largest.credits.toLocaleString()} certificates a year, or need something specific?{' '}
            <a href={`mailto:${site.supportEmail}?subject=${encodeURIComponent(`${site.name} for our organisation`)}`} className="font-medium text-accent underline underline-offset-2 hover:text-accent-dark">
              Email us
            </a>
            .
          </p>
        </section>

        <section aria-labelledby="pricing-faq-h" className="mx-auto mt-20 max-w-3xl">
          <h2 id="pricing-faq-h" className="font-display text-[30px] leading-tight">Questions about paying</h2>
          <dl className="mt-6 divide-y divide-rule border-y border-rule">
            {faqs.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="text-[17px] font-medium">{f.q}</dt>
                <dd className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <CtaBand title="Start free today">
        No payment is needed to start. Buy a package only when you want to issue in bulk.
      </CtaBand>
    </>
  );
}
