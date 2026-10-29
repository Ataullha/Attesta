'use client';

import type { Design } from '@/lib/design';
import type { AssetStore } from './assets';
import { downloadBytes, safeFilename, watermarkNote, type PdfJob } from './pdf';
import { ensureFonts, renderPage } from './renderer';

/**
 * Pixels along an image's long side: sharp on a phone, and about the largest size chat apps send
 * without shrinking it first.
 */
const LONG_SIDE = 1600;
const PT = 0.75;

/** The guest note across the bottom of the image, as on a guest's PDF. */
function drawWatermark(ctx: CanvasRenderingContext2D, design: Design) {
  const { width: W, height: H } = design.page;
  const note = watermarkNote(design);
  // The PDF's sizes, in points, as design pixels.
  let size = (W * PT < 400 ? 6 : 8) / PT;
  const font = () => `${size}px Helvetica, Arial, sans-serif`;
  ctx.font = font();
  while (size > 3.5 / PT && ctx.measureText(note).width > W - 8 / PT) {
    size -= 0.25 / PT;
    ctx.font = font();
  }
  const band = size + 10 / PT;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, H - band, W, band);
  ctx.restore();
  ctx.fillStyle = '#59544D';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(note, W / 2, H - band / 2);
}

/** One document as a JPEG, drawn by the same renderer as the editor and the PDF. */
export async function renderImage(job: PdfJob, assets: AssetStore, longSide = LONG_SIDE): Promise<Blob> {
  const { design } = job;
  await ensureFonts(design);
  const scale = longSide / Math.max(design.page.width, design.page.height);
  const c = document.createElement('canvas');
  c.width = Math.round(design.page.width * scale);
  c.height = Math.round(design.page.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  await renderPage(ctx, design, { ...job.values, serial: job.serial, verify_url: job.verifyUrl }, assets, { preview: false });
  if (job.watermark) drawWatermark(ctx, design);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('The image could not be made.'))), 'image/jpeg', 0.92));
}

/** "Nusrat-Jahan-ATT-7K2Q-9M4D-X1TB.jpg", made unique within one download. */
function imageName(job: PdfJob, taken: Set<string>) {
  const stem = `${safeFilename(job.values.recipient_name ?? 'image')}-${job.serial}`;
  let name = `${stem}.jpg`;
  for (let i = 2; taken.has(name); i++) name = `${stem}-${i}.jpg`;
  taken.add(name);
  return name;
}

/**
 * Downloads documents as images: one JPEG on its own, or several in ZIP files of at most `per`
 * images each, so no single file grows too large to build in a browser. Each ZIP can carry an index
 * (a CSV of names, serials and links).
 */
export async function downloadImages(
  jobs: PdfJob[],
  assets: AssetStore,
  base: string,
  { index, onProgress, per = 200 }: { index?: { name: string; csv: string }; onProgress?: (done: number, total: number) => void; per?: number } = {},
) {
  if (jobs.length === 1) {
    downloadBytes(await renderImage(jobs[0], assets), imageName(jobs[0], new Set()), 'image/jpeg');
    onProgress?.(1, 1);
    return;
  }
  const JSZip = (await import('jszip')).default;
  const taken = new Set<string>();
  const parts = Math.ceil(jobs.length / per);
  for (let p = 0; p < parts; p++) {
    const zip = new JSZip();
    const slice = jobs.slice(p * per, (p + 1) * per);
    for (let i = 0; i < slice.length; i++) {
      zip.file(imageName(slice[i], taken), await renderImage(slice[i], assets));
      onProgress?.(p * per + i + 1, jobs.length);
    }
    if (index) zip.file(index.name, '﻿' + index.csv);
    // JPEGs are compressed already; storing them as they are keeps building the ZIP quick.
    downloadBytes(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), parts === 1 ? `${base}-images.zip` : `${base}-images-part-${p + 1}.zip`, 'application/zip');
  }
}
