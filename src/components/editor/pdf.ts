'use client';

import {
  PDFDocument,
  StandardFonts,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  rectangle,
  clip,
  endPath,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import { isDynamic, type Design, type DesignElement } from '@/lib/design';
import { site } from '@/lib/site';
import type { AssetStore, ImageRef } from './assets';
import { SEAL_PATH, barcodeCanvas, drawText, ensureFonts, fitRect, qrGeometry, qrModules, textFor, type RenderValues } from './renderer';

export type PdfJob = {
  design: Design;
  values: Record<string, string>;
  serial: string;
  verifyUrl: string;
  watermark?: boolean;
};

/** Raster resolution for text, in pixels per design pixel (3 ≈ 288 dpi). */
const SCALE = 3;
const PT = 0.75;

type Raster = { png: Uint8Array; x: number; y: number; w: number; h: number };

// Static text looks identical on every certificate of a design, so it is rasterised once
// and reused across every PDF built in this session.
const staticText = new WeakMap<Design, Map<string, Raster | null>>();

function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function canvasPng(c: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

async function rasterText(el: Extract<DesignElement, { type: 'text' }>, text: string): Promise<Raster | null> {
  if (!text.trim()) return null;
  // Generous padding so text that overflows its box is not cut off.
  const px = el.w * 0.25 + 20;
  const py = el.h + 20;
  const w = el.w + px * 2;
  const h = el.h + py * 2;
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * SCALE);
  c.height = Math.ceil(h * SCALE);
  const ctx = c.getContext('2d')!;
  ctx.scale(SCALE, SCALE);
  ctx.translate(px - el.x, py - el.y);
  drawText(ctx, el, text);
  return { png: await canvasPng(c), x: el.x - px, y: el.y - py, w, h };
}

function roundedRectPath(w: number, h: number, r: number) {
  const k = 0.5523 * r;
  return [
    `M ${r} 0`,
    `L ${w - r} 0`,
    `C ${w - r + k} 0 ${w} ${r - k} ${w} ${r}`,
    `L ${w} ${h - r}`,
    `C ${w} ${h - r + k} ${w - r + k} ${h} ${w - r} ${h}`,
    `L ${r} ${h}`,
    `C ${r - k} ${h} 0 ${h - r + k} 0 ${h - r}`,
    `L 0 ${r}`,
    `C 0 ${r - k} ${r - k} 0 ${r} 0`,
    'Z',
  ].join(' ');
}

class PageWriter {
  private images = new Map<string, PDFImage | null>();
  constructor(
    private doc: PDFDocument,
    private assets: AssetStore,
  ) {}

  async image(ref: ImageRef) {
    const key = ref.assetId ? `a:${ref.assetId}` : ref.localId ? `l:${ref.localId}` : null;
    if (!key) return null;
    if (this.images.has(key)) return this.images.get(key)!;
    const b = await this.assets.bytes(ref);
    const img = b ? (b.mime === 'image/png' ? await this.doc.embedPng(b.bytes) : await this.doc.embedJpg(b.bytes)) : null;
    this.images.set(key, img);
    return img;
  }

  async raster(r: Raster) {
    return this.doc.embedPng(r.png);
  }
}

function place(page: PDFPage, H: number, x: number, y: number, w: number, h: number) {
  return { x: x * PT, y: (H - y - h) * PT, width: w * PT, height: h * PT };
}

async function drawElement(page: PDFPage, writer: PageWriter, design: Design, el: DesignElement, values: RenderValues) {
  const H = design.page.height;
  switch (el.type) {
    case 'rect': {
      const r = Math.min(el.radius, el.w / 2, el.h / 2);
      const fill = el.fill ? hexRgb(el.fill) : undefined;
      const stroke = el.stroke && el.strokeWidth > 0 ? hexRgb(el.stroke) : undefined;
      if (!fill && !stroke) return;
      if (r > 0) {
        page.drawSvgPath(roundedRectPath(el.w * PT, el.h * PT, r * PT), {
          x: el.x * PT,
          y: (H - el.y) * PT,
          color: fill,
          borderColor: stroke,
          borderWidth: stroke ? el.strokeWidth * PT : 0,
          opacity: el.opacity,
          borderOpacity: el.opacity,
        });
      } else {
        page.drawRectangle({ ...place(page, H, el.x, el.y, el.w, el.h), color: fill, borderColor: stroke, borderWidth: stroke ? el.strokeWidth * PT : 0, opacity: el.opacity, borderOpacity: el.opacity });
      }
      return;
    }
    case 'line': {
      const color = hexRgb(el.color);
      if (el.orientation === 'horizontal') {
        const y = (H - (el.y + el.h / 2)) * PT;
        page.drawLine({ start: { x: el.x * PT, y }, end: { x: (el.x + el.w) * PT, y }, thickness: el.thickness * PT, color });
      } else {
        const x = (el.x + el.w / 2) * PT;
        page.drawLine({ start: { x, y: (H - el.y) * PT }, end: { x, y: (H - el.y - el.h) * PT }, thickness: el.thickness * PT, color });
      }
      return;
    }
    case 'seal': {
      const sx = el.w / 40;
      const sy = el.h / 40;
      const color = hexRgb(el.color);
      const cx = (el.x + el.w / 2) * PT;
      const cy = (H - el.y - el.h / 2) * PT;
      const avg = ((sx + sy) / 2) * PT;
      page.drawEllipse({ x: cx, y: cy, xScale: 18.5 * sx * PT, yScale: 18.5 * sy * PT, borderColor: color, borderWidth: 1 * avg });
      page.drawEllipse({ x: cx, y: cy, xScale: 13.5 * sx * PT, yScale: 13.5 * sy * PT, borderColor: color, borderWidth: 0.75 * avg, borderDashArray: [2 * avg, 2.5 * avg] });
      page.drawSvgPath(SEAL_PATH, { x: el.x * PT, y: (H - el.y) * PT, scale: avg, color });
      return;
    }
    case 'image': {
      const img = await writer.image(el);
      if (!img) return;
      const d = fitRect(el.fit, img.width, img.height, el.x, el.y, el.w, el.h);
      if (el.fit === 'cover') {
        const box = place(page, H, el.x, el.y, el.w, el.h);
        page.pushOperators(pushGraphicsState(), rectangle(box.x, box.y, box.width, box.height), clip(), endPath());
        page.drawImage(img, { ...place(page, H, d.x, d.y, d.w, d.h), opacity: el.opacity });
        page.pushOperators(popGraphicsState());
      } else {
        page.drawImage(img, { ...place(page, H, d.x, d.y, d.w, d.h), opacity: el.opacity });
      }
      return;
    }
    case 'qr': {
      const { size, data } = qrModules(values.verify_url);
      const g = qrGeometry(el, size);
      if (el.background) page.drawRectangle({ ...place(page, H, g.ox, g.oy, g.side, g.side), color: hexRgb(el.background) });
      const color = hexRgb(el.color);
      for (let r = 0; r < size; r++) {
        let c = 0;
        while (c < size) {
          if (!data[r * size + c]) {
            c++;
            continue;
          }
          let run = 1;
          while (c + run < size && data[r * size + c + run]) run++;
          const x = g.ox + (c + g.margin) * g.cell;
          const y = g.oy + (r + g.margin) * g.cell;
          // A hair of overlap avoids visible seams between modules in some viewers.
          page.drawRectangle({ x: x * PT, y: (H - y - g.cell) * PT - 0.01, width: run * g.cell * PT + 0.02, height: g.cell * PT + 0.02, color });
          c += run;
        }
      }
      return;
    }
    case 'barcode': {
      const png = await writer.raster({ png: await canvasPng(barcodeCanvas(values.serial, el)), x: el.x, y: el.y, w: el.w, h: el.h });
      page.drawImage(png, place(page, H, el.x, el.y, el.w, el.h));
      return;
    }
    case 'text': {
      const r = await rasterText(el, textFor(el, values));
      if (!r) return;
      const img = await writer.raster(r);
      page.drawImage(img, place(page, H, r.x, r.y, r.w, r.h));
      return;
    }
  }
}

export async function buildPdf(jobs: PdfJob[], assets: AssetStore, onProgress?: (done: number, total: number) => void) {
  const doc = await PDFDocument.create();
  doc.setCreator(site.name);
  doc.setProducer(site.name);
  doc.setTitle(jobs.length === 1 ? `Certificate ${jobs[0].serial}` : `${jobs.length} certificates`);
  const writer = new PageWriter(doc, assets);
  const staticImages = new WeakMap<Design, Map<string, PDFImage>>();
  let helvetica: Awaited<ReturnType<PDFDocument['embedFont']>> | null = null;
  const fontsReady = new WeakSet<Design>();

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const { design } = job;
    if (!fontsReady.has(design)) {
      await ensureFonts(design);
      fontsReady.add(design);
    }
    const W = design.page.width;
    const H = design.page.height;
    const page = doc.addPage([W * PT, H * PT]);
    const values: RenderValues = { ...job.values, serial: job.serial, verify_url: job.verifyUrl };

    page.drawRectangle({ x: 0, y: 0, width: W * PT, height: H * PT, color: hexRgb(design.page.background.color) });
    const bg = await writer.image(design.page.background);
    if (bg) {
      const d = fitRect(design.page.background.fit, bg.width, bg.height, 0, 0, W, H);
      page.drawImage(bg, place(page, H, d.x, d.y, d.w, d.h));
    }

    let perDesign = staticImages.get(design);
    if (!perDesign) staticImages.set(design, (perDesign = new Map()));
    for (const el of design.elements) {
      // Static text is embedded into this document once and reused on every page.
      if (el.type === 'text' && !isDynamic(el)) {
        let img = perDesign.get(el.id);
        let cache = staticText.get(design);
        if (!cache) staticText.set(design, (cache = new Map()));
        if (!cache.has(el.id)) cache.set(el.id, await rasterText(el, textFor(el, values)));
        const r = cache.get(el.id);
        if (!r) continue;
        if (!img) {
          img = await writer.raster(r);
          perDesign.set(el.id, img);
        }
        page.drawImage(img, place(page, H, r.x, r.y, r.w, r.h));
        continue;
      }
      await drawElement(page, writer, design, el, values);
    }

    if (job.watermark) {
      helvetica ??= await doc.embedFont(StandardFonts.Helvetica);
      const note = `Guest certificate made with ${site.name}. It was not registered and cannot be verified.`;
      const size = 8;
      const w = helvetica.widthOfTextAtSize(note, size);
      page.drawRectangle({ x: 0, y: 0, width: W * PT, height: 18, color: rgb(1, 1, 1), opacity: 0.85 });
      page.drawText(note, { x: (W * PT - w) / 2, y: 6, size, font: helvetica, color: rgb(0.35, 0.33, 0.3) });
    }
    onProgress?.(i + 1, jobs.length);
    if (i % 5 === 4) await new Promise((r) => setTimeout(r, 0));
  }
  return doc.save({ useObjectStreams: true });
}

export function downloadBytes(bytes: Uint8Array | Blob, filename: string, type = 'application/pdf') {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function safeFilename(s: string) {
  return (
    s
      .normalize('NFKC')
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 80) || 'certificate'
  );
}
