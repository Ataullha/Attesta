import type { Metadata } from 'next';
import Link from 'next/link';
import { PRESETS } from '@/lib/presets';
import { TemplatePreview } from '@/components/site/TemplatePreview';
import { CtaBand } from '@/components/site/CtaBand';

export const metadata: Metadata = {
  title: 'Free certificate templates',
  description: 'Free certificate templates for course completion, internships, events, training, competitions and appreciation — including a Bangla template. Edit every field and add a QR code.',
  alternates: { canonical: '/templates' },
};

export default function TemplatesPage() {
  return (
    <>
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h1 className="font-display text-[40px] leading-tight">Certificate templates</h1>
        <p className="mt-3 max-w-[60ch] text-[17px] text-ink-2">
          Every template is fully editable: move any box, change fonts and colours, add your own fields, or replace the background with your own artwork.
        </p>
        <ul className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {PRESETS.map((p) => (
            <li key={p.slug}>
              <Link href={`/templates/${p.slug}`} className="group block">
                <div className="rounded-xl border border-rule bg-card p-1.5 transition-colors group-hover:border-accent">
                  <TemplatePreview framed slug={p.slug} label={`${p.name} certificate template`} />
                </div>
                <h2 className="mt-3 text-[17px] font-medium">{p.name}</h2>
                <p className="text-[14.5px] text-muted">{p.description}</p>
              </Link>
            </li>
          ))}
          <li>
            <Link href="/create" className="flex h-full min-h-48 flex-col justify-center rounded-xl border border-dashed border-rule-2 p-6 hover:border-accent">
              <span className="font-display text-[22px]">Start blank</span>
              <span className="mt-1 text-[14.5px] text-muted">Or upload your own design as the background.</span>
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
