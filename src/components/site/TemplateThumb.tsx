'use client';

import '@/components/editor/fonts';
import { useEffect, useMemo, useRef } from 'react';
import type { Design } from '@/lib/design';
import { getPreset } from '@/lib/presets';
import { site } from '@/lib/site';
import { AssetStore } from '@/components/editor/assets';
import { ensureFonts, renderPage } from '@/components/editor/renderer';
import { sampleValues } from '@/components/editor/elements';

const SERIAL = `${site.serialPrefix}-7K2Q-9M4D-X1TB`;

/** Renders a preset exactly as the editor and PDF would, at thumbnail size. */
export function TemplateThumb({ slug, design: given, label, className = '' }: { slug?: string; design?: Design; label: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const design = useMemo(() => given ?? getPreset(slug)?.design, [given, slug]);
  const assets = useMemo(() => new AssetStore(), []);

  useEffect(() => {
    const c = ref.current;
    if (!c || !design) return;
    let cancelled = false;
    const draw = async () => {
      await ensureFonts(design);
      if (cancelled) return;
      const w = c.clientWidth || 400;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (w / design.page.width) * dpr;
      c.width = Math.round(design.page.width * scale);
      c.height = Math.round(design.page.height * scale);
      const ctx = c.getContext('2d')!;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      await renderPage(ctx, design, { ...sampleValues(design), serial: SERIAL, verify_url: `${site.url}/verify/${SERIAL}` }, assets, { preview: false });
    };
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [design, assets]);

  if (!design) return null;
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className={`block h-auto w-full bg-card ${className}`}
      style={{ aspectRatio: `${design.page.width} / ${design.page.height}` }}
    />
  );
}
