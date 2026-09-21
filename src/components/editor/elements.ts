'use client';
import type { Design, DesignElement, ElementType, TextEl } from '@/lib/design';

export function newId(prefix = 'e') {
  return `${prefix}${Math.random().toString(36).slice(2, 9)}`;
}

export const ELEMENT_LABELS: Record<ElementType, string> = {
  text: 'Text',
  image: 'Image',
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

export function makeText(d: Design, overrides: Partial<TextEl> = {}): TextEl {
  const w = Math.min(520, d.page.width * 0.6);
  return {
    id: newId('t'),
    type: 'text',
    x: (d.page.width - w) / 2,
    y: d.page.height / 2 - 30,
    w,
    h: 60,
    content: 'Double-click to edit this text',
    font: 'instrument-sans',
    size: 22,
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

export function makeElement(type: Exclude<ElementType, 'text'>, d: Design, role?: 'signature' | 'logo' | 'image'): DesignElement {
  const cx = d.page.width / 2;
  const cy = d.page.height / 2;
  switch (type) {
    case 'image':
      return { id: newId('i'), type: 'image', role: role ?? 'image', assetId: null, localId: null, x: cx - 110, y: cy - 40, w: 220, h: role === 'signature' ? 70 : 120, fit: 'contain', opacity: 1, name: role === 'signature' ? 'Signature' : role === 'logo' ? 'Logo' : undefined };
    case 'qr':
      return { id: newId('q'), type: 'qr', x: cx - 50, y: cy - 50, w: 100, h: 100, color: '#191712', background: '#FFFFFF' };
    case 'barcode':
      return { id: newId('b'), type: 'barcode', x: cx - 140, y: cy - 25, w: 280, h: 50, color: '#191712', showText: false };
    case 'seal':
      return { id: newId('s'), type: 'seal', x: cx - 40, y: cy - 40, w: 80, h: 80, color: '#8A5D28' };
    case 'rect':
      return { id: newId('r'), type: 'rect', x: cx - 150, y: cy - 60, w: 300, h: 120, fill: null, stroke: '#191712', strokeWidth: 1.5, radius: 0, opacity: 1 };
    case 'line':
      return { id: newId('l'), type: 'line', x: cx - 120, y: cy - 4, w: 240, h: 8, color: '#191712', thickness: 1, orientation: 'horizontal' };
  }
}

export function sampleValues(d: Design, overrides: Record<string, string> = {}) {
  const out: Record<string, string> = {};
  for (const f of d.fields) {
    const v = overrides[f.key]?.trim();
    out[f.key] = v || f.sample || (f.type === 'date' ? new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : f.label);
  }
  return out;
}
