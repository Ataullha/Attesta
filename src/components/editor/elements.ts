'use client';
import { photoFields, type Design, type DesignElement, type ElementType, type PhotoEl, type TextEl } from '@/lib/design';
import { expiryLabel, parseExpiry } from '@/lib/values';

export function newId(prefix = 'e') {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

export const ELEMENT_LABELS: Record<ElementType, string> = {
  text: 'Text',
  image: 'Image',
  photo: 'Photo',
  qr: 'QR code',
  barcode: 'Barcode',
  seal: 'Seal',
  rect: 'Rectangle',
  line: 'Line',
};

export function elementLabel(el: DesignElement) {
  if (el.name) return el.name;
  if (el.type === 'text') return el.content.replace(/\s+/g, ' ').slice(0, 32) || 'Empty text';
  if (el.type === 'image') return el.role === 'signature' ? 'Signature' : el.role === 'logo' ? 'Logo' : 'Image';
  return ELEMENT_LABELS[el.type];
}

/**
 * New elements are sized for a page of A4 or Letter. On a smaller page, such as a card or an
 * invitation, they are scaled down to suit it, though not so far that text cannot be read or a QR
 * code scanned.
 */
export function unitFor(d: Design) {
  const longest = Math.max(d.page.width, d.page.height);
  return longest >= 1000 ? 1 : Math.max(0.4, longest / 1123);
}

export function makeText(d: Design, overrides: Partial<TextEl> = {}): TextEl {
  const u = unitFor(d);
  const w = Math.min(520 * u, d.page.width * 0.6);
  return {
    id: newId('t'),
    type: 'text',
    x: (d.page.width - w) / 2,
    y: d.page.height / 2 - 30 * u,
    w,
    h: 60 * u,
    content: 'Double-click to edit this text',
    font: 'instrument-sans',
    size: 22 * u,
    weight: 400,
    italic: false,
    color: '#191712',
    align: 'center',
    valign: 'middle',
    lineHeight: 1.35,
    letterSpacing: 0,
    uppercase: false,
    shrink: false,
    ...overrides,
  };
}

/** A photo frame for `field`, in the usual 4 : 5 portrait shape. */
export function makePhoto(d: Design, field: string): PhotoEl {
  const w = Math.min(160, d.page.width * 0.3);
  const h = Math.min(w * 1.25, d.page.height * 0.8);
  return { id: newId('p'), type: 'photo', field, x: (d.page.width - w) / 2, y: (d.page.height - h) / 2, w, h, radius: 0, stroke: null, strokeWidth: 1, name: 'Photo' };
}

export function makeElement(type: Exclude<ElementType, 'text' | 'photo'>, d: Design, role?: 'signature' | 'logo' | 'image'): DesignElement {
  const u = unitFor(d);
  const cx = d.page.width / 2;
  const cy = d.page.height / 2;
  const box = (w: number, h: number) => ({ x: cx - (w * u) / 2, y: cy - (h * u) / 2, w: w * u, h: h * u });
  switch (type) {
    case 'image':
      return { id: newId('i'), type: 'image', role: role ?? 'image', assetId: null, localId: null, ...box(220, role === 'signature' ? 70 : 120), fit: 'contain', opacity: 1, name: role === 'signature' ? 'Signature' : role === 'logo' ? 'Logo' : undefined };
    case 'qr':
      return { id: newId('q'), type: 'qr', ...box(100, 100), color: '#191712', background: '#FFFFFF' };
    case 'barcode':
      return { id: newId('b'), type: 'barcode', ...box(280, 50), color: '#191712', showText: false };
    case 'seal':
      return { id: newId('s'), type: 'seal', ...box(80, 80), color: '#8A5D28' };
    case 'rect':
      return { id: newId('r'), type: 'rect', ...box(300, 120), fill: null, stroke: '#191712', strokeWidth: 1.5 * u, radius: 0, opacity: 1 };
    case 'line':
      return { id: newId('l'), type: 'line', ...box(240, 8), color: '#191712', thickness: 1, orientation: 'horizontal' };
  }
}

/** The design's photo field, or a new one called "Photo" for a design that has none yet. */
export function photoFieldFor(d: Design) {
  return photoFields(d)[0] ?? { key: d.fields.some((f) => f.key === 'photo') ? `photo_${d.fields.length + 1}` : 'photo', label: 'Photo', type: 'photo' as const, required: false, public: false, sample: '' };
}

export function sampleValues(d: Design, overrides: Record<string, string> = {}) {
  const out: Record<string, string> = {};
  const inAYear = new Date();
  for (const f of d.fields) {
    let v = overrides[f.key]?.trim();
    // A date it is valid until prints the way it will be issued: 30/06/2027 as 30 June 2027.
    const date = v && f.type === 'expiry' ? parseExpiry(v) : null;
    if (date) v = expiryLabel(date, /[\u0980-\u09FF]/.test(v!));
    out[f.key] =
      v ||
      f.sample ||
      (f.type === 'date'
        ? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : f.type === 'expiry'
          ? expiryLabel({ y: inAYear.getFullYear() + 1, m: inAYear.getMonth() + 1, d: Math.min(28, inAYear.getDate()) })
          : f.label);
  }
  return out;
}
