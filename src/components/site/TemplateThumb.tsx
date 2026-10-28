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
export function TemplateThumb({ slug, design: given, label, values, className = '' }: { slug?: string; design?: Design; label: string; values?: Record<string, string>; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const design = useMemo(() => given ?? getPreset(slug)?.design, [given, slug]);
  const assets = useMemo(() => new AssetStore(), []);

  useEffect(() => {
    const c = ref.current;
    if (!c || !design) return;
    let cancelled = false;
    let latest = 0;
    const draw = async () => {
      // Draws overlap (the resize observer fires once on mount); only the last may report it is done.
      const mine = ++latest;
      c.dataset.rendered = 'false';
      await ensureFonts(design);
      if (cancelled || mine !== latest) return;
      const w = c.clientWidth || 400;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (w / design.page.width) * dpr;
      c.width = Math.round(design.page.width * scale);
      c.height = Math.round(design.page.height * scale);
      const ctx = c.getContext('2d')!;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      // A template picture shows a stand-in where each person's photo will go.
      await renderPage(ctx, design, { ...sampleValues(design, values), serial: SERIAL, verify_url: `${site.url}/verify/${SERIAL}` }, assets, { preview: false, photoPlaceholders: true });
      // Lets scripts/render-previews.mjs know the drawing is finished.
      if (!cancelled && mine === latest) c.dataset.rendered = 'true';
    };
    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    return () => {
      cancelled = true;
      ro.disconnect();
    };
  }, [design, assets, values]);

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
