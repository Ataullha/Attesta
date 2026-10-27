import { getPreset } from '@/lib/presets';

/**
 * A template as a picture: images pre-rendered by scripts/render-previews.mjs with the real
 * certificate renderer. Unlike drawing the template in the browser, this costs the visitor no
 * JavaScript and no certificate fonts, and its size is known before it loads, so nothing shifts.
 */
export function TemplatePreview({
  slug,
  label,
  sizes = '(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw',
  priority = false,
  framed = false,
  className = '',
}: {
  slug: string;
  label: string;
  /** How wide the image is shown, so the browser picks the smaller file where it can. */
  sizes?: string;
  /** The main image of the page: load it first rather than when it scrolls into view. */
  priority?: boolean;
  /** Fit inside a landscape frame, so a portrait template does not stretch a grid row. */
  framed?: boolean;
  className?: string;
}) {
  const preset = getPreset(slug);
  if (!preset) return null;
  const { width, height } = preset.design.page;
  // A portrait page sits inside the landscape frame; a faint shadow shows where the page ends.
  const portrait = height > width;
  const img = (
    <img
      src={`/previews/${slug}-1280.webp`}
      srcSet={`/previews/${slug}-640.webp 640w, /previews/${slug}-1280.webp 1280w`}
      sizes={sizes}
      alt={label}
      width={width}
      height={height}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={
        framed
          ? `block h-full w-full object-contain ${portrait ? 'drop-shadow-[0_1px_3px_rgb(0_0_0/0.14)]' : 'rounded-md'} ${className}`
          : `block h-auto w-full rounded-md bg-card ${className}`
      }
    />
  );
  return framed ? <div className={`aspect-[297/210] rounded-md bg-card ${portrait ? 'py-3' : ''}`}>{img}</div> : img;
}
