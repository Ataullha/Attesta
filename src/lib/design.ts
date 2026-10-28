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

/** What a design is. It decides the wording around it (the verification page, file names) and how it prints. */
export type DesignKind = 'certificate' | 'id-card';

export const PAGE_SIZES = {
  'a4-landscape': { label: 'A4 landscape', width: 1123, height: 794, kind: 'certificate' },
  'a4-portrait': { label: 'A4 portrait', width: 794, height: 1123, kind: 'certificate' },
  'letter-landscape': { label: 'Letter landscape', width: 1056, height: 816, kind: 'certificate' },
  'letter-portrait': { label: 'Letter portrait', width: 816, height: 1056, kind: 'certificate' },
  // The standard ID card (ISO/IEC 7810 ID-1, "CR80"): 85.6 × 54 mm, the size card printers take.
  'card-landscape': { label: 'ID card landscape (85.6 × 54 mm)', width: 323.5, height: 204, kind: 'id-card' },
  'card-portrait': { label: 'ID card portrait (54 × 85.6 mm)', width: 204, height: 323.5, kind: 'id-card' },
} as const satisfies Record<string, { label: string; width: number; height: number; kind: DesignKind }>;

export type PageSizeId = keyof typeof PAGE_SIZES;

/* ------------------------------------------------------------------ */
/* Schema                                                              */
/* ------------------------------------------------------------------ */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colours must look like #1a2b3c');
const num = (min: number, max: number) => z.number().finite().min(min).max(max);

export const RESERVED_KEYS = ['serial', 'verify_url'] as const;

const fieldKey = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, 'Field keys use lowercase letters, numbers and underscores');

export const fieldSchema = z.object({
  key: fieldKey.refine((k) => !(RESERVED_KEYS as readonly string[]).includes(k), 'That key is reserved'),
  label: z.string().trim().min(1).max(60),
  // photo: each recipient's picture, named by its file name. expiry: the date the document stops being valid.
  type: z.enum(['text', 'date', 'email', 'photo', 'expiry']),
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

/** A frame filled with each recipient's own photo, from the photo field it names. */
export const photoElement = z.object({
  ...base,
  type: z.literal('photo'),
  field: fieldKey,
  radius: num(0, 2000),
  stroke: hex.nullable(),
  strokeWidth: num(0, 100),
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
  photoElement,
  qrElement,
  barcodeElement,
  sealElement,
  rectElement,
  lineElement,
]);

export const designSchema = z
  .object({
    version: z.literal(1),
    // Absent on designs saved before ID cards existed, which are all certificates.
    kind: z.enum(['certificate', 'id-card']).optional(),
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
    if (d.fields.find((f) => f.key === 'recipient_name')?.type !== 'text' && keys.has('recipient_name')) {
      ctx.addIssue({ code: 'custom', message: 'The recipient_name field must be text' });
    }
    if (d.fields.filter((f) => f.type === 'expiry').length > 1) ctx.addIssue({ code: 'custom', message: 'Only one field can be the date it is valid until' });
    const photoKeys = new Set(d.fields.filter((f) => f.type === 'photo').map((f) => f.key));
    const ids = new Set<string>();
    for (const e of d.elements) {
      if (ids.has(e.id)) ctx.addIssue({ code: 'custom', message: `Duplicate element id ${e.id}` });
      ids.add(e.id);
      if (e.type === 'photo' && !photoKeys.has(e.field)) ctx.addIssue({ code: 'custom', message: `A photo frame uses "${e.field}", which is not a photo field` });
    }
  });

export type Design = z.infer<typeof designSchema>;
export type DesignElement = z.infer<typeof elementSchema>;
export type TextEl = z.infer<typeof textElement>;
export type ImageEl = z.infer<typeof imageElement>;
export type PhotoEl = z.infer<typeof photoElement>;
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

export function designKind(d: Pick<Design, 'kind'>): DesignKind {
  return d.kind ?? 'certificate';
}

/** "certificate" or "ID card", for a sentence; `plural` for "certificates" or "ID cards". */
export function kindNoun(kind: DesignKind, plural = false) {
  return kind === 'id-card' ? (plural ? 'ID cards' : 'ID card') : plural ? 'certificates' : 'certificate';
}

/** The fields filled with each recipient's photo. */
export function photoFields(d: Pick<Design, 'fields'>) {
  return d.fields.filter((f) => f.type === 'photo');
}

/**
 * How a photo is looked up: by its file name, ignoring folders, the image extension and case, so a
 * CSV cell of "1001", "1001.jpg" or "photos/1001.JPG" all find the file 1001.jpg.
 */
export function photoName(value: string) {
  return value
    .trim()
    .replace(/^.*[\\/]/, '')
    .replace(/\.(jpe?g|png|webp|gif|bmp|avif|heic|heif)$/i, '')
    .normalize('NFC')
    .toLowerCase();
}

/** The image store's id for the photo with this file name. */
export function photoRef(value: string) {
  const name = photoName(value);
  return name ? `photo:${name}` : null;
}

/** Elements whose pixels differ from one recipient to the next. */
export function isDynamic(el: DesignElement) {
  if (el.type === 'qr' || el.type === 'barcode' || el.type === 'photo') return true;
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

/** Images that so far exist only in the browser that added them, each once, with what it is used as. */
export function localImages(d: Design) {
  const found = new Map<string, 'background' | 'signature' | 'logo' | 'seal' | 'image'>();
  if (d.page.background.localId) found.set(d.page.background.localId, 'background');
  for (const e of d.elements) if (e.type === 'image' && e.localId && !found.has(e.localId)) found.set(e.localId, e.role);
  return [...found].map(([localId, kind]) => ({ localId, kind }));
}

/** The design with every local image that has since been uploaded pointing at its upload instead. */
export function withUploadedImages(d: Design, uploaded: Map<string, string>): Design {
  const swap = <T extends { assetId: string | null; localId: string | null }>(ref: T): T =>
    ref.localId && uploaded.has(ref.localId) ? { ...ref, assetId: uploaded.get(ref.localId)!, localId: null } : ref;
  return {
    ...d,
    page: { ...d.page, background: swap(d.page.background) },
    elements: d.elements.map((e) => (e.type === 'image' ? swap(e) : e)),
  };
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
