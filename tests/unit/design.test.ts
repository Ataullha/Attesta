import { describe, expect, it } from 'vitest';
import { PRESETS, blankDesign, presetDesign } from '@/lib/presets';
import { USE_CASES } from '@/lib/usecases';
import {
  canonicalJson,
  designSchema,
  fillPlaceholders,
  hasLocalImages,
  isDynamic,
  localImages,
  maskName,
  placeholdersIn,
  referencedAssetIds,
  slugKey,
  withUploadedImages,
  type Design,
} from '@/lib/design';

/** A deep copy that tests can corrupt freely; the helper hides the casts. */
function mutate(fn: (d: any) => void): unknown {
  const d = structuredClone(presetDesign('classic-ledger')) as any;
  fn(d);
  return d;
}
const firstText = (d: any) => d.elements.find((e: any) => e.type === 'text');
const rejects = (design: unknown) => expect(designSchema.safeParse(design).success).toBe(false);

describe('designSchema', () => {
  it.each(PRESETS.map((p) => [p.slug, p.design] as const))('accepts the "%s" preset', (_slug, design) => {
    const res = designSchema.safeParse(design);
    expect(res.success ? [] : res.error.issues).toEqual([]);
  });

  it('accepts the blank design', () => {
    expect(designSchema.safeParse(blankDesign()).success).toBe(true);
  });

  it.each(PRESETS.map((p) => [p.slug, p.design] as const))('"%s": every {{placeholder}} names a real field', (_slug, design) => {
    const known = new Set([...design.fields.map((f) => f.key), 'serial', 'verify_url']);
    const unknown = design.elements.flatMap((e) => (e.type === 'text' ? placeholdersIn(e.content) : [])).filter((k) => !known.has(k));
    expect(unknown).toEqual([]);
  });

  it('every use-case page points at a template that exists', () => {
    const slugs = new Set(PRESETS.map((p) => p.slug));
    expect(USE_CASES.filter((u) => !slugs.has(u.preset)).map((u) => u.slug)).toEqual([]);
    expect(new Set(USE_CASES.map((u) => u.slug)).size).toBe(USE_CASES.length);
    expect(new Set(PRESETS.map((p) => p.slug)).size).toBe(PRESETS.length);
  });

  it('rejects colours that are not #rrggbb', () => {
    rejects(mutate((d) => (firstText(d).color = 'red')));
    rejects(mutate((d) => (firstText(d).color = '#fff')));
    rejects(mutate((d) => (d.page.background.color = 'rgb(0,0,0)')));
  });

  it('requires the recipient_name field', () => {
    rejects(mutate((d) => (d.fields = d.fields.filter((f: any) => f.key !== 'recipient_name'))));
  });

  it('rejects duplicate field keys and duplicate element ids', () => {
    rejects(mutate((d) => d.fields.push({ ...d.fields[1] })));
    rejects(mutate((d) => d.elements.push({ ...d.elements[0] })));
  });

  it.each(['serial', 'verify_url'])('rejects the reserved field key "%s"', (key) => {
    rejects(mutate((d) => d.fields.push({ key, label: 'x', type: 'text', required: false, public: true, sample: '' })));
  });

  it.each(['Name', '1abc', 'has space', 'dash-ed', '', 'a'.repeat(41)])('rejects the field key %j', (key) => {
    rejects(mutate((d) => (d.fields[1].key = key)));
  });

  it('enforces size limits on fields and elements', () => {
    rejects(mutate((d) => (d.fields = [])));
    rejects(
      mutate((d) => {
        for (let i = 0; i < 30; i++) d.fields.push({ key: `extra_${i}`, label: 'x', type: 'text', required: false, public: true, sample: '' });
      }),
    );
    rejects(
      mutate((d) => {
        const template = d.elements[d.elements.length - 1];
        d.elements = Array.from({ length: 81 }, (_, i) => ({ ...template, id: `e${i}` }));
      }),
    );
  });

  it('rejects non-finite and out-of-range numbers', () => {
    rejects(mutate((d) => (d.elements[0].x = Infinity)));
    rejects(mutate((d) => (d.elements[0].w = Number.NaN)));
    rejects(mutate((d) => (d.elements[0].w = 0)));
    rejects(mutate((d) => (d.page.width = 100)));
    rejects(mutate((d) => (d.page.height = 5000)));
    rejects(mutate((d) => (firstText(d).size = 3)));
  });

  it('rejects unknown element types, fonts, versions and bad asset ids', () => {
    rejects(mutate((d) => (d.elements[0].type = 'script')));
    rejects(mutate((d) => (firstText(d).font = 'comic-sans')));
    rejects(mutate((d) => (d.version = 2)));
    rejects(mutate((d) => (d.page.background.assetId = 'not-a-uuid')));
    rejects(mutate((d) => (firstText(d).content = 'x'.repeat(2001))));
  });

  it('strips unknown properties, so only known data is hashed and stored', () => {
    const polluted = mutate((d) => {
      d.evil = '<script>';
      d.elements[0].onclick = 'x';
    });
    const res = designSchema.parse(polluted) as any;
    expect(res.evil).toBeUndefined();
    expect(res.elements[0].onclick).toBeUndefined();
  });
});

describe('design helpers', () => {
  it('lists every asset a design references once, and spots un-uploaded images', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    const d = presetDesign('classic-ledger') as any;
    d.page.background.assetId = a;
    d.elements.find((e: any) => e.type === 'image').assetId = a;
    d.elements.push({ id: 'img2', type: 'image', role: 'logo', assetId: b, localId: null, x: 0, y: 0, w: 10, h: 10, fit: 'contain', opacity: 1 });
    expect(referencedAssetIds(d).sort()).toEqual([a, b]);
    expect(hasLocalImages(d)).toBe(false);
    d.elements.find((e: any) => e.id === 'img2').localId = 'local-1';
    expect(hasLocalImages(d)).toBe(true);
  });

  // A guest's images live only in their browser. When they sign up, each is uploaded once, as what it is
  // used for, and the design is pointed at the uploads (components/editor/draft.ts).
  it('lists the images that are only in the browser, once each, with what each is used as', () => {
    const d = mutate((d) => {
      d.page.background.localId = 'local-bg';
      d.elements.push({ id: 's1', type: 'image', role: 'signature', assetId: null, localId: 'local-sig', x: 0, y: 0, w: 10, h: 10, fit: 'contain', opacity: 1 });
      d.elements.push({ id: 's2', type: 'image', role: 'signature', assetId: null, localId: 'local-sig', x: 20, y: 0, w: 10, h: 10, fit: 'contain', opacity: 1 });
      d.elements.push({ id: 'l1', type: 'image', role: 'logo', assetId: 'already-uploaded', localId: null, x: 40, y: 0, w: 10, h: 10, fit: 'contain', opacity: 1 });
    }) as Design;
    expect(localImages(d)).toEqual([
      { localId: 'local-bg', kind: 'background' },
      { localId: 'local-sig', kind: 'signature' },
    ]);
    expect(localImages(presetDesign('classic-ledger'))).toEqual([]);
  });

  it('points every use of an uploaded image at the upload, and leaves the rest alone', () => {
    const d = mutate((d) => {
      d.page.background.localId = 'local-bg';
      d.elements.push({ id: 's1', type: 'image', role: 'signature', assetId: null, localId: 'local-sig', x: 0, y: 0, w: 10, h: 10, fit: 'contain', opacity: 1 });
      d.elements.push({ id: 's2', type: 'image', role: 'signature', assetId: null, localId: 'local-sig', x: 20, y: 0, w: 10, h: 10, fit: 'contain', opacity: 1 });
    }) as Design;
    const uploaded = '33333333-3333-4333-8333-333333333333';
    const after = withUploadedImages(d, new Map([['local-sig', uploaded]]));
    const image = (id: string) => after.elements.find((e) => e.id === id) as { assetId: string | null; localId: string | null };
    expect([image('s1').assetId, image('s1').localId]).toEqual([uploaded, null]);
    expect([image('s2').assetId, image('s2').localId]).toEqual([uploaded, null]);
    expect(after.page.background).toMatchObject({ assetId: null, localId: 'local-bg' }); // not uploaded (yet)
    expect(designSchema.safeParse(after).success).toBe(true);
    expect(localImages(withUploadedImages(after, new Map([['local-bg', '44444444-4444-4444-8444-444444444444']])))).toEqual([]);
  });

  it('knows which elements change from recipient to recipient', () => {
    const d = presetDesign('classic-ledger');
    const byType = (t: string) => d.elements.find((e) => e.type === t)!;
    expect(isDynamic(byType('qr'))).toBe(true);
    expect(isDynamic(byType('rect'))).toBe(false);
    expect(isDynamic(d.elements.find((e) => e.type === 'text' && e.content.includes('{{recipient_name}}'))!)).toBe(true);
    expect(isDynamic(d.elements.find((e) => e.type === 'text' && e.content === 'Certificate of completion')!)).toBe(false);
  });
});

describe('canonicalJson', () => {
  it('sorts keys, omits undefined, keeps null', () => {
    expect(canonicalJson({ b: 1, a: 2, c: undefined, d: null })).toBe('{"a":2,"b":1,"d":null}');
  });

  it('does not depend on key order at any depth', () => {
    expect(canonicalJson({ a: 1, b: { d: 1, c: [{ y: 1, x: 2 }] } })).toBe(canonicalJson({ b: { c: [{ x: 2, y: 1 }], d: 1 }, a: 1 }));
  });

  it('keeps array order and escapes like JSON', () => {
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalJson({ s: 'quote " and \\ and \n and é and 🙂' })).toBe(JSON.stringify({ s: 'quote " and \\ and \n and é and 🙂' }));
  });

  // The signed payload and each batch's design hash are built from this output. If it ever changes,
  // a multi-request bulk batch would be rejected as "design changed" - so the format is pinned.
  it('matches a pinned golden string', () => {
    const payload = {
      v: 1,
      serial: 'ATT-7K2Q-9M4D-X1TB',
      issued_at: '2026-09-21T10:00:00.000Z',
      issuer: { id: 'u1', org: null, name: 'Acme Academy' },
      recipient: 'Nusrat Jahan Mim',
      fields: { course: 'Data Analysis', issue_date: '21 September 2026' },
      design: 'abc123',
    };
    expect(canonicalJson(payload)).toBe(
      '{"design":"abc123","fields":{"course":"Data Analysis","issue_date":"21 September 2026"},"issued_at":"2026-09-21T10:00:00.000Z","issuer":{"id":"u1","name":"Acme Academy","org":null},"recipient":"Nusrat Jahan Mim","serial":"ATT-7K2Q-9M4D-X1TB","v":1}',
    );
  });

  it('gives the same string for a design however its keys were ordered', () => {
    const d = presetDesign('podium');
    const reversed = JSON.parse(JSON.stringify(d, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v))) as Design;
    expect(canonicalJson(reversed)).toBe(canonicalJson(d));
  });
});

describe('placeholders', () => {
  it('finds placeholders, tolerating inner spaces', () => {
    expect(placeholdersIn('Hi {{ recipient_name }}, see {{serial}} {{x}}')).toEqual(['recipient_name', 'serial', 'x']);
    expect(placeholdersIn('no fields, {single} and {{Upper}} are ignored')).toEqual([]);
  });

  it('fills known keys, blanks unknown ones, and never expands values twice', () => {
    expect(fillPlaceholders('{{a}}-{{ b }}-{{missing}}', { a: '1', b: '2' })).toBe('1-2-');
    expect(fillPlaceholders('{{a}}', { a: '{{b}}', b: 'X' })).toBe('{{b}}');
  });

  it('does not leak Object.prototype members into the certificate', () => {
    expect(fillPlaceholders('[{{constructor}}]', {})).toBe('[]');
    expect(fillPlaceholders('[{{constructor}}]', { constructor: 'Builder' })).toBe('[Builder]');
  });
});

describe('maskName', () => {
  it('shows first name and last initial by default', () => {
    expect(maskName('Nusrat Jahan Mim', 'partial')).toBe('Nusrat M.');
    expect(maskName('  Arif   Hossain ', 'partial')).toBe('Arif H.');
  });

  it('leaves a single name alone, and honours full and hidden', () => {
    expect(maskName('Nusrat', 'partial')).toBe('Nusrat');
    expect(maskName('Nusrat Jahan Mim', 'full')).toBe('Nusrat Jahan Mim');
    expect(maskName('Nusrat Jahan Mim', 'hidden')).toBe('Name withheld by the issuer');
  });

  it('takes the initial as a whole character, not half of one', () => {
    // An astral-plane character is two UTF-16 units; splitting it leaves a broken surrogate.
    expect(maskName('Sam 🙂Lee', 'partial')).toBe('Sam 🙂.');
    // A decomposed accent travels with its letter.
    expect(maskName('Zoe Élodie', 'partial')).toBe('Zoe É.');
  });

  // A Bangla conjunct (ক্ষ = ক + ্ + ষ) is one letter to a reader; cutting after "ক" shows a different
  // letter. Treating it as one unit needs the runtime's ICU to know Unicode 15.1's conjunct rule.
  const icuKnowsConjuncts = [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment('ক্ষ')].length === 1;
  it.skipIf(!icuKnowsConjuncts)('keeps a Bangla conjunct whole', () => {
    expect(maskName('রাহিম ক্ষমা', 'partial')).toBe('রাহিম ক্ষ.');
  });
});

describe('slugKey', () => {
  it('turns labels into field keys', () => {
    expect(slugKey('Roll number')).toBe('roll_number');
    expect(slugKey('  Course / Title  ')).toBe('course_title');
    expect(slugKey('Grade')).toBe('grade');
  });

  it('never returns a key the schema would refuse', () => {
    const labels = ['123', '', '   ', 'রোল নম্বর', '🙂🙂🙂', 'x'.repeat(200), 'Ünïcödé Låbel', '___', '-- --', 'ａｂｃ'];
    const keyOk = /^[a-z][a-z0-9_]{0,39}$/;
    for (const label of labels) expect(slugKey(label), JSON.stringify(label)).toMatch(keyOk);
  });
});
