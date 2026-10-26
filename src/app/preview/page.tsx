import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PRESETS } from '@/lib/presets';

export const metadata = { robots: { index: false, follow: false } };

/** Development only: the list scripts/render-previews.mjs works through. */
export default function PreviewIndex() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <ul>
      {PRESETS.map((p) => (
        <li key={p.slug}>
          <Link href={`/preview/${p.slug}`}>{p.name}</Link>
        </li>
      ))}
    </ul>
  );
}
