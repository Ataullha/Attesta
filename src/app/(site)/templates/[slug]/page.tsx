import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PRESETS, getPreset } from '@/lib/presets';
import { USE_CASES } from '@/lib/usecases';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { CtaBand } from '@/components/site/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { btn } from '@/components/ui/styles';
import { site } from '@/lib/site';
import { designKind } from '@/lib/design';

export function generateStaticParams() {
  return PRESETS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<'/templates/[slug]'>): Promise<Metadata> {
  const p = getPreset((await params).slug);
  if (!p) return {};
  const card = designKind(p.design) === 'id-card';
  return {
    title: `${p.name} ${card ? 'ID card' : 'certificate'} template`,
    description: card
      ? `${p.description} Free to edit: move every field, add your logo and a QR code, and make a card for everyone from a CSV and their photos.`
      : `${p.description} Free to edit: move every field, add a signature, QR code and barcode, and issue in bulk from CSV.`,
    alternates: { canonical: `/templates/${p.slug}` },
  };
}

export default async function TemplatePage({ params }: PageProps<'/templates/[slug]'>) {
  const p = getPreset((await params).slug);
  if (!p) notFound();
  const useCase = USE_CASES.find((u) => u.preset === p.slug);
  const card = designKind(p.design) === 'id-card';
  const kindLabel = card ? 'ID card' : 'certificate';
  return (
    <>
      <div className="mx-auto max-w-6xl px-5 py-14">
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'Templates', item: `${site.url}/templates` },
              { '@type': 'ListItem', position: 2, name: p.name, item: `${site.url}/templates/${p.slug}` },
            ],
          }}
        />
        <nav aria-label="Breadcrumb" className="text-[14px] text-muted">
          <Link href="/templates" className="hover:text-ink">Templates</Link> <span aria-hidden>/</span> {p.name}
        </nav>
        <div className="mt-6 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <div className={`rounded-xl border border-rule-2 bg-card p-2 ${card && p.design.page.height > p.design.page.width ? 'mx-auto w-full max-w-[360px]' : ''}`}>
            <TemplatePreview slug={p.slug} label={`${p.name} ${kindLabel} template, full preview`} sizes="(min-width: 1024px) 640px, 100vw" priority />
          </div>
          <div>
            <h1 className="font-display text-[38px] leading-[1.05]">{p.name}</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-ink-2">{p.description}</p>
            <h2 className="mt-8 text-[15px] font-semibold">Fields on this template</h2>
            <ul className="mt-2 space-y-1.5 text-[15px] text-ink-2">
              {p.design.fields.map((f) => (
                <li key={f.key} className="flex justify-between gap-4 border-b border-rule pb-1.5">
                  <span>{f.label}</span>
                  <code className="font-mono text-[12.5px] text-accent">{`{{${f.key}}}`}</code>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[14px] text-muted">
              {card ? 'Each person’s photo fills the photo frame, matched by file name when you issue from a CSV. ' : ''}Add as many of your own fields as you need in the editor.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/create?preset=${p.slug}`} className={btn.primary}>Use this template</Link>
              {useCase && <Link href={`/certificate-maker/${useCase.slug}`} className={btn.secondary}>{useCase.short} guide</Link>}
              {card && <Link href="/id-card-maker" className={btn.secondary}>How ID cards work</Link>}
            </div>
          </div>
        </div>
      </div>
      <CtaBand />
    </>
  );
}
