import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { USE_CASES, getUseCase } from '@/lib/usecases';
import { getPreset } from '@/lib/presets';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { AdSlot } from '@/components/site/AdSlot';
import { CtaBand } from '@/components/site/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { btn } from '@/components/ui/styles';
import { formatMoney, packages, site } from '@/lib/site';

export function generateStaticParams() {
  return USE_CASES.map((u) => ({ slug: u.slug }));
}

export async function generateMetadata({ params }: PageProps<'/certificate-maker/[slug]'>): Promise<Metadata> {
  const u = getUseCase((await params).slug);
  if (!u) return {};
  return { title: { absolute: u.metaTitle }, description: u.description, alternates: { canonical: `/certificate-maker/${u.slug}` } };
}

export default async function UseCasePage({ params }: PageProps<'/certificate-maker/[slug]'>) {
  const u = getUseCase((await params).slug);
  if (!u) notFound();
  const preset = getPreset(u.preset);
  const isBangla = u.slug === 'bangla-certificate';
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: u.faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Use cases', item: `${site.url}/certificate-maker` },
        { '@type': 'ListItem', position: 2, name: u.short, item: `${site.url}/certificate-maker/${u.slug}` },
      ],
    },
  ];
  return (
    <>
      <article lang={isBangla ? 'bn' : undefined} className="mx-auto max-w-6xl px-5 py-14">
        <JsonLd data={structuredData} />
        <nav aria-label="Breadcrumb" lang="en" className="text-[14px] text-muted">
          <Link href="/certificate-maker" className="hover:text-ink">Use cases</Link> <span aria-hidden>/</span> <span lang={isBangla ? 'bn' : undefined}>{u.short}</span>
        </nav>
        <div className="mt-6 grid items-center gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <h1 className="font-serif text-[42px] leading-[1.05] sm:text-[52px]">{u.title}</h1>
            <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-ink-2">{u.intro}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/create?preset=${u.preset}`} className={btn.primary}>{isBangla ? 'সনদপত্র তৈরি শুরু করুন' : 'Start with this template'}</Link>
              <Link href="/templates" className={btn.secondary}>{isBangla ? 'সব টেমপ্লেট' : 'All templates'}</Link>
            </div>
            <p className="mt-4 text-[14px] text-muted">
              {isBangla
                ? `বিনামূল্যে শুরু করুন — একসাথে অনেক সনদের জন্য প্যাকেজ ${formatMoney(packages[0].price)} থেকে।`
                : `Free to start. Packages for bulk issuing from ${formatMoney(packages[0].price)}.`}{' '}
              <Link href="/pricing" className="underline underline-offset-2 hover:text-ink">{isBangla ? 'মূল্য দেখুন' : 'See pricing'}</Link>
            </p>
          </div>
          {preset && (
            <div className="border border-rule-2 bg-card p-2">
              <TemplatePreview slug={preset.slug} label={`${preset.name} template example`} sizes="(min-width: 1024px) 540px, 100vw" priority />
            </div>
          )}
        </div>

        <section className="mt-20 grid gap-10 md:grid-cols-3">
          {u.points.map((p) => (
            <div key={p.title} className="border-t border-ink pt-5">
              <h2 className="text-[19px] font-semibold">{p.title}</h2>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{p.body}</p>
            </div>
          ))}
        </section>

        <section className="mx-auto mt-20 max-w-3xl">
          <h2 className="font-serif text-[34px]">{isBangla ? 'প্রশ্ন ও উত্তর' : 'Questions'}</h2>
          <dl className="mt-6 divide-y divide-rule border-y border-rule">
            {u.faqs.map((f) => (
              <div key={f.q} className="py-5">
                <dt className="text-[17px] font-medium">{f.q}</dt>
                <dd className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <AdSlot slot="1000000002" className="mt-16" />

        <nav aria-label="Other certificate types" className="mt-16 border-t border-rule pt-8">
          <h2 className="text-[15px] font-semibold">More certificate types</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {USE_CASES.filter((x) => x.slug !== u.slug).map((x) => (
              <li key={x.slug}>
                <Link href={`/certificate-maker/${x.slug}`} className="inline-block rounded-full border border-rule-2 px-3.5 py-1.5 text-[14px] text-ink-2 hover:border-brass hover:text-ink">
                  {x.short}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
      <CtaBand />
    </>
  );
}
