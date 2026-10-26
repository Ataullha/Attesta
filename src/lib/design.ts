import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Fonts available on certificates                                     */
/* ------------------------------------------------------------------ */

export const FONTS = {
  'instrument-serif': { label: 'Instrument Serif', family: 'Instrument Serif', weights: [400], script: 'latin' },
  'playfair': { label: 'Playfair Display', family: 'Playfair Display', weights: [400, 700], script: 'latin' },
  'cormorant': { label: 'Cormorant Garamond', family: 'Cormorant Garamond', weights: [400, 700], script: 'latin' },
  'great-vibes': { label: 'Great Vibes (script)', family: 'Great Vibes', weights: [400], script: 'latin' },
  'instrument-sans': { label: 'Instrument Sans', family: 'Instrument Sans', weights: [400, 700], script: 'latin' },
  'jetbrains-mono': { label: 'JetBrains Mono', family: 'JetBrains Mono', weights: [400], script: 'latin' },
  'hind-siliguri': { label: 'Hind Siliguri (বাংলা)', family: 'Hind Siliguri', weights: [400, 700], script: 'bengali' },
  'noto-serif-bengali': { label: 'Noto Serif Bengali (বাংলা)', family: 'Noto Serif Bengali', weights: [400, 700], script: 'bengali' },
  'tiro-bangla': { label: 'Tiro Bangla (বাংলা)', family: 'Tiro Bangla', weights: [400], script: 'bengali' },
} as const;

export type FontId = keyof typeof FONTS;
export const FONT_IDS = Object.keys(FONTS) as [FontId, ...FontId[]];

/* ------------------------------------------------------------------ */
/* Page sizes (design units are CSS pixels at 96 dpi; 1px = 0.75pt)    */
/* ------------------------------------------------------------------ */

export const PAGE_SIZES = {
  'a4-landscape': { label: 'A4 landscape', width: 1123, height: 794 },
  'a4-portrait': { label: 'A4 portrait', width: 794, height: 1123 },
  'letter-landscape': { label: 'Letter landscape', width: 1056, height: 816 },
  'letter-portrait': { label: 'Letter portrait', width: 816, height: 1056 },
} as const;

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colours must look like #1a2b3c');
const num = (min: number, max: number) => z.number().finite().min(min).max(max);

export const RESERVED_KEYS = ['serial', 'verify_url'] as const;

export const fieldSchema = z.object({
  key: z
    .string()
    .regex(/^[a-z][a-z0-9_]{0,39}$/, 'Field keys use lowercase letters, numbers and underscores')
    .refine((k) => !(RESERVED_KEYS as readonly string[]).includes(k), 'That key is reserved'),
  label: z.string().trim().min(1).max(60),
  type: z.enum(['text', 'date', 'email']),
  required: z.boolean(),
  public: z.boolean(),
  sample: z.string().max(300),
});

const base = {
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/),
  name: z.string().max(60).optional(),
  x: num(-5000, 10000),
  y: num(-5000, 10000),
  w: num(1, 10000),
  h: num(1, 10000),
  locked: z.boolean().optional(),
};

const imageRef = {
  assetId: z.uuid().nullable(),
  localId: z.string().max(80).nullable(),
};

export const textElement = z.object({
  ...base,
  type: z.literal('text'),
  content: z.string().max(2000),
  font: z.enum(FONT_IDS),
  size: num(4, 400),
  weight: z.union([z.literal(400), z.literal(700)]),
  italic: z.boolean(),
  color: hex,
  align: z.enum(['left', 'center', 'right']),
  valign: z.enum(['top', 'middle', 'bottom']),
  lineHeight: num(0.6, 3),
  letterSpacing: num(-10, 50),
  uppercase: z.boolean(),
  shrink: z.boolean(),
});

export const imageElement = z.object({
  ...base,
  ...imageRef,
  type: z.literal('image'),
  role: z.enum(['signature', 'logo', 'seal', 'image']),
  fit: z.enum(['contain', 'cover', 'stretch']),
  opacity: num(0, 1),
});

export const qrElement = z.object({ ...base, type: z.literal('qr'), color: hex, background: hex.nullable() });
export const barcodeElement = z.object({ ...base, type: z.literal('barcode'), color: hex, showText: z.boolean() });
export const sealElement = z.object({ ...base, type: z.literal('seal'), color: hex });
export const rectElement = z.object({
  ...base,
  type: z.literal('rect'),
  fill: hex.nullable(),
  stroke: hex.nullable(),
  strokeWidth: num(0, 100),
  radius: num(0, 2000),
  opacity: num(0, 1),
});
export const lineElement = z.object({
  ...base,
  type: z.literal('line'),
  color: hex,
  thickness: num(0.25, 100),
  orientation: z.enum(['horizontal', 'vertical']),
});

export const elementSchema = z.discriminatedUnion('type', [
  textElement,
  imageElement,
  qrElement,
  barcodeElement,
  sealElement,
  rectElement,
  lineElement,
]);

export const designSchema = z
  .object({
    version: z.literal(1),
    page: z.object({
      width: num(200, 4000),
      height: num(200, 4000),
      background: z.object({ color: hex, ...imageRef, fit: z.enum(['stretch', 'cover', 'contain']) }),
    }),
    fields: z.array(fieldSchema).min(1).max(30),
    elements: z.array(elementSchema).max(80),
    settings: z.object({
      nameDisplay: z.enum(['partial', 'full', 'hidden']),
      indexable: z.boolean(),
    }),
  })
  .superRefine((d, ctx) => {
    const keys = new Set<string>();
    for (const f of d.fields) {
      if (keys.has(f.key)) ctx.addIssue({ code: 'custom', message: `Two fields use the key "${f.key}"` });
      keys.add(f.key);
    }
    if (!keys.has('recipient_name')) ctx.addIssue({ code: 'custom', message: 'The recipient_name field is required' });
    const ids = new Set<string>();
    for (const e of d.elements) {
      if (ids.has(e.id)) ctx.addIssue({ code: 'custom', message: `Duplicate element id ${e.id}` });
      ids.add(e.id);
    }
  });

export type Design = z.infer<typeof designSchema>;
export type DesignElement = z.infer<typeof elementSchema>;
export type TextEl = z.infer<typeof textElement>;
export type ImageEl = z.infer<typeof imageElement>;
export type Field = z.infer<typeof fieldSchema>;
export type ElementType = DesignElement['type'];

/* ------------------------------------------------------------------ */
/* Helpers shared by editor, renderer and server                       */
/* ------------------------------------------------------------------ */

const PLACEHOLDER = /\{\{\s*([a-z][a-z0-9_]*)\s*\}\}/g;

export function placeholdersIn(text: string) {
  return [...text.matchAll(PLACEHOLDER)].map((m) => m[1]);
}

export function fillPlaceholders(text: string, values: Record<string, string>) {
  // hasOwn: `{{constructor}}` must not pick up Object.prototype.constructor.
  return text.replace(PLACEHOLDER, (_, key: string) => (Object.hasOwn(values, key) ? values[key] ?? '' : ''));
}

/** Elements whose pixels differ from one recipient to the next. */
export function isDynamic(el: DesignElement) {
  if (el.type === 'qr' || el.type === 'barcode') return true;
  if (el.type === 'text') return placeholdersIn(el.content).length > 0;
  return false;
}

export function referencedAssetIds(d: Design) {
  const ids = new Set<string>();
  if (d.page.background.assetId) ids.add(d.page.background.assetId);
  for (const e of d.elements) if (e.type === 'image' && e.assetId) ids.add(e.assetId);
  return [...ids];
}

export function hasLocalImages(d: Design) {
  return !!d.page.background.localId || d.elements.some((e) => e.type === 'image' && !!e.localId);
}

export function todayLabel(date = new Date()) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Deterministic JSON with sorted keys, used for hashing and signing. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/**
 * The first user-perceived character: a Bangla conjunct such as ক্ষ, an emoji, or a letter plus
 * its accent stays whole, where `charAt(0)` would cut it. Segmenter is checked for at call time
 * because this module also loads in browsers that predate it.
 */
function firstLetter(text: string) {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) return segment;
  }
  return Array.from(text)[0] ?? '';
}

export function maskName(name: string, mode: 'partial' | 'full' | 'hidden') {
  if (mode === 'full') return name;
  if (mode === 'hidden') return 'Name withheld by the issuer';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${firstLetter(parts[parts.length - 1])}.`;
}

export function slugKey(label: string) {
  const k = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return /^[a-z]/.test(k) ? k : `field_${k || Math.random().toString(36).slice(2, 7)}`;
}
