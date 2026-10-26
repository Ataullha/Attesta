import { notFound } from 'next/navigation';
import { getPreset } from '@/lib/presets';
import { TemplateThumb } from '@/components/site/TemplateThumb';

export const metadata = { robots: { index: false, follow: false } };

/** The same date the Bangla template and the home page's sample verification badge use. */
const SAMPLE_DATE = '21 September 2026';

/**
 * Development only: one template drawn by the real certificate renderer, which
 * scripts/render-previews.mjs photographs into public/previews. Marketing pages show those images
 * instead of shipping the renderer and its fonts to every visitor.
 */
export default async function PreviewPage({ params }: PageProps<'/preview/[slug]'>) {
  if (process.env.NODE_ENV === 'production') notFound();
  const preset = getPreset((await params).slug);
  if (!preset) notFound();
  // A date field left empty would show today's date, which would then age inside the image.
  const dates = Object.fromEntries(preset.design.fields.filter((f) => f.type === 'date' && !f.sample).map((f) => [f.key, SAMPLE_DATE]));
  return (
    <main style={{ width: 1280, background: '#FFFDFA' }}>
      <TemplateThumb slug={preset.slug} label={preset.name} values={dates} />
    </main>
  );
}
