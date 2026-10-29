'use client';

import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { FONTS, fillPlaceholders, photoRef, type Design, type DesignElement, type PhotoEl, type TextEl } from '@/lib/design';
import type { AssetStore } from './assets';
import { FONT_SAMPLE } from './fonts';

export type RenderValues = Record<string, string>;

export const SEAL_PATH =
  'M20 7.5 L22.3 16.2 L31 13.8 L24.7 20 L31 26.2 L22.3 23.8 L20 32.5 L17.7 23.8 L9 26.2 L15.3 20 L9 13.8 L17.7 16.2 Z';

const SERIF = new Set(['instrument-serif', 'playfair', 'cormorant', 'great-vibes']);

export function fontCss(el: Pick<TextEl, 'font' | 'weight' | 'italic'>, size: number) {
  const f = FONTS[el.font];
  const weights = f.weights as readonly number[];
  const weight = weights.includes(el.weight) ? el.weight : weights[0];
  // Bangla text inside a Latin font falls back to a bundled Bangla face instead of whatever the
  // computer happens to have, so every browser produces the same certificate.
  const fallback = f.script === 'bengali' ? '' : SERIF.has(el.font) ? ', "Noto Serif Bengali"' : ', "Hind Siliguri"';
  return `${el.italic ? 'italic ' : ''}${weight} ${size}px "${f.family}"${fallback}`;
}

export async function ensureFonts(design: Design) {
  const specs = new Set<string>(['400 40px "JetBrains Mono"']);
  for (const el of design.elements) if (el.type === 'text') specs.add(fontCss(el, 40));
  await Promise.all([...specs].map((s) => document.fonts.load(s, FONT_SAMPLE).catch(() => [])));
}

export function textFor(el: TextEl, values: RenderValues) {
  const t = fillPlaceholders(el.content, values);
  return el.uppercase ? t.toLocaleUpperCase() : t;
}

/* ---------------- text layout ---------------- */

function setFont(ctx: CanvasRenderingContext2D, el: TextEl, size: number) {
  ctx.font = fontCss(el, size);
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${el.letterSpacing * (size / el.size)}px`;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/).filter((w) => w.length);
    let line = '';
    for (const word of words) {
      const test = line + word;
      if (ctx.measureText(test.trimEnd()).width <= maxWidth || !line.trim()) {
        line = test;
        // A single word wider than the box gets broken by character.
        if (ctx.measureText(line.trim()).width > maxWidth && !/\s/.test(line.trim())) {
          let chunk = '';
          for (const ch of Array.from(line.trim())) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              out.push(chunk);
              chunk = ch;
            } else chunk += ch;
          }
          line = chunk;
        }
      } else {
        out.push(line.trim());
        line = word.trimStart();
      }
    }
    out.push(line.trim());
  }
  return out;
}

export function drawText(ctx: CanvasRenderingContext2D, el: TextEl, text: string) {
  if (!text.trim()) return;
  let size = el.size;
  setFont(ctx, el, size);
  let lines = wrap(ctx, text, el.w);
  if (el.shrink) {
    const widest = () => Math.max(...lines.map((l) => ctx.measureText(l).width));
    let guard = 0;
    while (size > 5 && guard++ < 200 && (lines.length * size * el.lineHeight > el.h + 0.5 || widest() > el.w + 0.5)) {
      size = Math.max(5, size - Math.max(0.5, size * 0.04));
      setFont(ctx, el, size);
      lines = wrap(ctx, text, el.w);
    }
  }
  const lh = size * el.lineHeight;
  const total = lines.length * lh;
  const top = el.valign === 'top' ? el.y : el.valign === 'bottom' ? el.y + el.h - total : el.y + (el.h - total) / 2;
  ctx.fillStyle = el.color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = el.align;
  const x = el.align === 'left' ? el.x : el.align === 'right' ? el.x + el.w : el.x + el.w / 2;
  lines.forEach((ln, i) => ctx.fillText(ln, x, top + lh * i + lh / 2));
}

/* ---------------- other elements ---------------- */

export function drawSeal(ctx: CanvasRenderingContext2D, el: Extract<DesignElement, { type: 'seal' }>) {
  ctx.save();
  ctx.translate(el.x, el.y);
  ctx.scale(el.w / 40, el.h / 40);
  ctx.strokeStyle = el.color;
  ctx.fillStyle = el.color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(20, 20, 18.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([2, 2.5]);
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.arc(20, 20, 13.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fill(new Path2D(SEAL_PATH));
  ctx.restore();
}

export function qrModules(text: string) {
  const qr = QRCode.create(text || ' ', { errorCorrectionLevel: 'M' });
  return { size: qr.modules.size, data: qr.modules.data as unknown as ArrayLike<number> };
}

export function qrGeometry(el: { x: number; y: number; w: number; h: number; background: string | null }, size: number) {
  const margin = el.background ? 2 : 0;
  const side = Math.min(el.w, el.h);
  const cell = side / (size + margin * 2);
  const ox = el.x + (el.w - side) / 2;
  const oy = el.y + (el.h - side) / 2;
  return { margin, side, cell, ox, oy };
}

export function drawQr(ctx: CanvasRenderingContext2D, el: Extract<DesignElement, { type: 'qr' }>, text: string) {
  const { size, data } = qrModules(text);
  const g = qrGeometry(el, size);
  if (el.background) {
    ctx.fillStyle = el.background;
    ctx.fillRect(g.ox, g.oy, g.side, g.side);
  }
  // One pixel per module, scaled up without smoothing: square modules with no hairline seams between
  // them, at any zoom and in images, where drawing each module as its own rectangle leaves faint gaps.
  const modules = document.createElement('canvas');
  modules.width = modules.height = size;
  const mctx = modules.getContext('2d')!;
  const px = mctx.createImageData(size, size);
  const n = parseInt(el.color.slice(1), 16);
  for (let i = 0; i < size * size; i++) {
    if (!data[i]) continue;
    px.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
  }
  mctx.putImageData(px, 0, 0);
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(modules, g.ox + g.margin * g.cell, g.oy + g.margin * g.cell, size * g.cell, size * g.cell);
  ctx.imageSmoothingEnabled = smoothing;
}

export function barcodeCanvas(value: string, el: Extract<DesignElement, { type: 'barcode' }>) {
  const c = document.createElement('canvas');
  JsBarcode(c, value || 'SERIAL', {
    format: 'CODE128',
    lineColor: el.color,
    background: 'rgba(0,0,0,0)',
    width: 3,
    height: 120,
    displayValue: el.showText,
    font: 'JetBrains Mono',
    fontSize: 28,
    textMargin: 6,
    margin: 0,
  });
  return c;
}

export function drawBarcode(ctx: CanvasRenderingContext2D, el: Extract<DesignElement, { type: 'barcode' }>, value: string) {
  const c = barcodeCanvas(value, el);
  const prev = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(c, el.x, el.y, el.w, el.h);
  ctx.imageSmoothingEnabled = prev;
}

export function fitRect(fit: 'contain' | 'cover' | 'stretch', iw: number, ih: number, x: number, y: number, w: number, h: number) {
  if (fit === 'stretch') return { x, y, w, h };
  const s = fit === 'contain' ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  return { x: x + (w - dw) / 2, y: y + (h - dh) / 2, w: dw, h: dh };
}

/**
 * Where a photo goes in its frame: filling it, like `cover`, but when the photo is taller than the
 * frame it is cropped mostly from the bottom, since faces sit in the upper part of a portrait.
 */
export function photoRect(iw: number, ih: number, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  return { x: x + (w - dw) / 2, y: y + (h - dh) * 0.3, w: dw, h: dh };
}

function roundedPath(ctx: CanvasRenderingContext2D, el: PhotoEl) {
  const r = Math.min(el.radius, el.w / 2, el.h / 2);
  ctx.beginPath();
  if (r > 0 && 'roundRect' in ctx) ctx.roundRect(el.x, el.y, el.w, el.h, r);
  else ctx.rect(el.x, el.y, el.w, el.h);
}

/** A neutral head and shoulders, standing in for a photo in the editor and in template pictures. */
export function drawSilhouette(ctx: CanvasRenderingContext2D, el: PhotoEl) {
  ctx.save();
  roundedPath(ctx, el);
  ctx.clip();
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(el.x, el.y, el.w, el.h);
  const s = Math.min(el.w, el.h * 0.9);
  const cx = el.x + el.w / 2;
  const head = el.y + el.h * 0.4;
  ctx.fillStyle = '#94A3B8';
  ctx.beginPath();
  ctx.arc(cx, head, s * 0.21, 0, Math.PI * 2);
  ctx.fill();
  // The shoulders run past the bottom of the frame, which cuts them off as a photo would.
  ctx.beginPath();
  ctx.ellipse(cx, head + s * 0.66, s * 0.44, s * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPhotoBorder(ctx: CanvasRenderingContext2D, el: PhotoEl) {
  if (!el.stroke || el.strokeWidth <= 0) return;
  ctx.save();
  roundedPath(ctx, el);
  ctx.strokeStyle = el.stroke;
  ctx.lineWidth = el.strokeWidth;
  ctx.stroke();
  ctx.restore();
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, el: DesignElement, label: string) {
  ctx.save();
  ctx.strokeStyle = '#B7AE9C';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1;
  ctx.strokeRect(el.x + 0.5, el.y + 0.5, el.w - 1, el.h - 1);
  ctx.setLineDash([]);
  ctx.fillStyle = '#8C8373';
  ctx.font = '500 13px "Instrument Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, el.x + el.w / 2, el.y + el.h / 2);
  ctx.restore();
}

export async function drawElement(
  ctx: CanvasRenderingContext2D,
  el: DesignElement,
  values: RenderValues,
  assets: AssetStore,
  preview: boolean,
  photoPlaceholders = preview,
) {
  switch (el.type) {
    case 'photo': {
      const ref = photoRef(values[el.field] ?? '');
      const img = ref ? await assets.image({ assetId: null, localId: ref }) : null;
      if (img) {
        const d = photoRect(img.naturalWidth, img.naturalHeight, el.x, el.y, el.w, el.h);
        ctx.save();
        roundedPath(ctx, el);
        ctx.clip();
        ctx.drawImage(img, d.x, d.y, d.w, d.h);
        ctx.restore();
      } else if (photoPlaceholders) {
        drawSilhouette(ctx, el);
      }
      drawPhotoBorder(ctx, el);
      return;
    }
    case 'text':
      drawText(ctx, el, textFor(el, values));
      return;
    case 'seal':
      drawSeal(ctx, el);
      return;
    case 'qr':
      drawQr(ctx, el, values.verify_url ?? '');
      return;
    case 'barcode':
      drawBarcode(ctx, el, values.serial ?? '');
      return;
    case 'line': {
      ctx.strokeStyle = el.color;
      ctx.lineWidth = el.thickness;
      ctx.beginPath();
      if (el.orientation === 'horizontal') {
        const y = el.y + el.h / 2;
        ctx.moveTo(el.x, y);
        ctx.lineTo(el.x + el.w, y);
      } else {
        const x = el.x + el.w / 2;
        ctx.moveTo(x, el.y);
        ctx.lineTo(x, el.y + el.h);
      }
      ctx.stroke();
      return;
    }
    case 'rect': {
      ctx.save();
      ctx.globalAlpha = el.opacity;
      ctx.beginPath();
      const r = Math.min(el.radius, el.w / 2, el.h / 2);
      if (r > 0 && 'roundRect' in ctx) ctx.roundRect(el.x, el.y, el.w, el.h, r);
      else ctx.rect(el.x, el.y, el.w, el.h);
      if (el.fill) {
        ctx.fillStyle = el.fill;
        ctx.fill();
      }
      if (el.stroke && el.strokeWidth > 0) {
        ctx.strokeStyle = el.stroke;
        ctx.lineWidth = el.strokeWidth;
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    case 'image': {
      const img = await assets.image(el);
      if (!img) {
        if (preview) drawPlaceholder(ctx, el, el.role === 'signature' ? 'Upload a signature' : 'Upload an image');
        return;
      }
      const d = fitRect(el.fit, img.naturalWidth, img.naturalHeight, el.x, el.y, el.w, el.h);
      ctx.save();
      ctx.globalAlpha = el.opacity;
      if (el.fit === 'cover') {
        ctx.beginPath();
        ctx.rect(el.x, el.y, el.w, el.h);
        ctx.clip();
      }
      ctx.drawImage(img, d.x, d.y, d.w, d.h);
      ctx.restore();
      return;
    }
  }
}

export async function drawBackground(ctx: CanvasRenderingContext2D, design: Design, assets: AssetStore) {
  const { width, height, background } = design.page;
  ctx.fillStyle = background.color;
  ctx.fillRect(0, 0, width, height);
  const img = await assets.image(background);
  if (img) {
    const d = fitRect(background.fit, img.naturalWidth, img.naturalHeight, 0, 0, width, height);
    ctx.drawImage(img, d.x, d.y, d.w, d.h);
  }
}

/**
 * Draws a whole page. The context must already be scaled from design units to pixels.
 * `photoPlaceholders` shows a stand-in where a photo is missing (it defaults to `preview`).
 */
export async function renderPage(
  ctx: CanvasRenderingContext2D,
  design: Design,
  values: RenderValues,
  assets: AssetStore,
  opts: { preview: boolean; photoPlaceholders?: boolean; skipBackground?: boolean; elements?: DesignElement[] },
) {
  if (!opts.skipBackground) await drawBackground(ctx, design, assets);
  // Resolve images first so drawing order is never interleaved with awaits.
  const els = opts.elements ?? design.elements;
  await Promise.all(
    els.map((e) => {
      if (e.type === 'image') return assets.image(e);
      const ref = e.type === 'photo' ? photoRef(values[e.field] ?? '') : null;
      return ref ? assets.image({ assetId: null, localId: ref }) : null;
    }),
  );
  for (const el of els) await drawElement(ctx, el, values, assets, opts.preview, opts.photoPlaceholders ?? opts.preview);
}
