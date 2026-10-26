import type { Metadata } from 'next';
import Link from 'next/link';
import { CtaBand } from '@/components/site/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { USE_CASES } from '@/lib/usecases';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Certificate maker for every occasion',
  description: 'Course completion, internship, workshop, training, competition, appreciation and Bangla certificates — each with a template, the fields it needs, bulk issuing from CSV and a QR code that verifies it.',
  alternates: { canonical: '/certificate-maker' },
};

export default function UseCasesPage() {
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
            { '@type': 'ListItem', position: 2, name: 'Use cases', item: `${site.url}/certificate-maker` },
          ],
        }}
      />
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h1 className="font-serif text-[48px] leading-tight">Certificates for every occasion</h1>
        <p className="mt-3 max-w-[62ch] text-[17px] leading-relaxed text-ink-2">
          Pick what you are issuing to see a template that suits it, the fields it needs, and how organisations issue it to a whole group at once.
        </p>
        <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <li key={u.slug} lang={u.slug === 'bangla-certificate' ? 'bn' : undefined}>
              <Link href={`/certificate-maker/${u.slug}`} className="group block">
                <div className="border border-rule bg-card p-1.5 transition-colors group-hover:border-brass">
                  <TemplatePreview framed slug={u.preset} label={`${u.short}: example certificate`} />
                </div>
                <h2 className="mt-3 text-[17px] font-medium">{u.short}</h2>
                <p className="text-[14.5px] leading-snug text-muted">{u.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <CtaBand />
    </>
  );
}
