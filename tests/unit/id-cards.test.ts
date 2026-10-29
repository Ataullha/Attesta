import { describe, expect, it } from 'vitest';
import { CERTIFICATE_PRESETS, ID_CARD_PRESETS, INVITATION_PRESETS, PRESETS, VISITING_CARD_PRESETS, blankIdCard, presetDesign } from '@/lib/presets';
import { PAGE_SIZES, designKind, designSchema, isDynamic, kindNoun, photoFields, photoName, photoRef, type Design } from '@/lib/design';
import { cleanValues, expiryLabel, expiryOf, isPublicField, isoDate, parseExpiry } from '@/lib/values';
import { A4, cutMarks, sheetLayout, slot } from '@/components/editor/sheet';

const PT = 0.75;
const card = () => structuredClone(presetDesign('club-member-card')) as Design;
const problems = (d: unknown) => {
  const res = designSchema.safeParse(d);
  return res.success ? [] : res.error.issues.map((i) => i.message);
};

describe('ID card designs', () => {
  it('are a design kind of their own, at the standard card size', () => {
    for (const p of ID_CARD_PRESETS) {
      expect(designKind(p.design), p.slug).toBe('id-card');
      const sizes = [PAGE_SIZES['card-landscape'], PAGE_SIZES['card-portrait']].map((s) => `${s.width}x${s.height}`);
      expect(sizes, p.slug).toContain(`${p.design.page.width}x${p.design.page.height}`);
    }
    expect(designKind(blankIdCard())).toBe('id-card');
    // Designs saved before ID cards existed have no kind, and are certificates.
    expect(designKind(presetDesign('classic-ledger'))).toBe('certificate');
    expect(designSchema.safeParse(blankIdCard()).success).toBe(true);
  });

  it('measure 85.6 × 54 mm, to within a twentieth of a millimetre', () => {
    const mm = (px: number) => (px / 96) * 25.4;
    expect(Math.abs(mm(PAGE_SIZES['card-landscape'].width) - 85.6)).toBeLessThan(0.05);
    expect(Math.abs(mm(PAGE_SIZES['card-landscape'].height) - 53.98)).toBeLessThan(0.05);
  });

  it('are listed apart from the certificates, and every template is in exactly one kind’s list', () => {
    expect(ID_CARD_PRESETS.length).toBeGreaterThan(0);
    expect(CERTIFICATE_PRESETS.every((p) => designKind(p.design) === 'certificate')).toBe(true);
    const lists = [CERTIFICATE_PRESETS, ID_CARD_PRESETS, VISITING_CARD_PRESETS, INVITATION_PRESETS];
    expect(lists.reduce((n, l) => n + l.length, 0)).toBe(PRESETS.length);
    expect(new Set(lists.flat().map((p) => p.slug)).size).toBe(PRESETS.length);
  });

  it('show their verification page the full name, and keep it out of search engines, by default', () => {
    for (const p of ID_CARD_PRESETS) expect(p.design.settings, p.slug).toEqual({ nameDisplay: 'full', indexable: false });
  });

  it('fill their photo frames from a photo field, which is never shown on a verification page', () => {
    for (const p of ID_CARD_PRESETS) {
      const frames = p.design.elements.filter((e) => e.type === 'photo');
      expect(frames.length, p.slug).toBeGreaterThan(0);
      expect(frames.every(isDynamic)).toBe(true);
      const fields = photoFields(p.design);
      expect(fields.map((f) => f.key)).toEqual(['photo']);
      expect(fields.every((f) => !isPublicField(f))).toBe(true);
    }
  });
});

describe('the design rules for photos and dates', () => {
  it('refuse a photo frame that names a field which is not a photo', () => {
    const d = card();
    const frame = d.elements.find((e) => e.type === 'photo')!;
    (frame as { field: string }).field = 'role';
    expect(problems(d)).toContain('A photo frame uses "role", which is not a photo field');
  });

  it('allow one "valid until" date at most', () => {
    const d = card();
    d.fields.push({ key: 'valid_again', label: 'Valid again', type: 'expiry', required: false, public: true, sample: '' });
    expect(problems(d)).toContain('Only one field can be the date it is valid until');
  });

  it('keep the name as text', () => {
    const d = card();
    d.fields[0].type = 'photo';
    expect(problems(d)).toContain('The recipient_name field must be text');
  });

  it('call things by their kind', () => {
    expect([kindNoun('id-card'), kindNoun('id-card', true), kindNoun('certificate'), kindNoun('certificate', true)]).toEqual(['ID card', 'ID cards', 'certificate', 'certificates']);
  });
});

describe('matching photos by file name', () => {
  it('ignores folders, the image extension and capitals', () => {
    for (const v of ['1001', '1001.jpg', '1001.JPG', 'photos/1001.jpeg', 'C:\\Members\\1001.png', '  1001.webp ']) expect(photoName(v), v).toBe('1001');
    expect(photoName('Rahim Uddin.jpg')).toBe('rahim uddin');
    // Only an image extension is taken off.
    expect(photoName('1001.backup')).toBe('1001.backup');
    expect(photoRef('M1001.jpg')).toBe('photo:m1001');
    expect(photoRef('   ')).toBeNull();
  });

  it('keeps the file name of a photo, without the folder it came from, never the picture', () => {
    const d = card();
    const res = cleanValues(d, { recipient_name: 'Nusrat Jahan', photo: 'members\\2026/nusrat.jpg' });
    expect(res.ok && res.values.photo).toBe('nusrat.jpg');
  });

  it('reports a required photo that is missing', () => {
    const d = card();
    d.fields.find((f) => f.key === 'photo')!.required = true;
    const res = cleanValues(d, { recipient_name: 'Nusrat Jahan' });
    expect(res.ok ? [] : res.errors).toEqual(['Photo is empty']);
  });
});

describe('dates a document is valid until', () => {
  const end2027 = { y: 2027, m: 12, d: 31 };

  it('are read the way people write them, day first', () => {
    for (const s of ['2027-12-31', '31/12/2027', '31-12-27', '31.12.2027', '31 December 2027', '31st Dec 2027', 'December 31, 2027', 'Dec. 31 2027', 'december 31 2027']) {
      expect(parseExpiry(s), s).toEqual(end2027);
    }
  });

  it('take a month alone to mean its last day, leap years included', () => {
    for (const s of ['December 2027', 'Dec 2027', '12/2027', '2027-12']) expect(parseExpiry(s), s).toEqual(end2027);
    expect(parseExpiry('February 2028')).toEqual({ y: 2028, m: 2, d: 29 });
    expect(parseExpiry('February 2027')).toEqual({ y: 2027, m: 2, d: 28 });
  });

  it('are read in Bangla too, digits and month names', () => {
    expect(parseExpiry('৩১ ডিসেম্বর ২০২৭')).toEqual(end2027);
    expect(parseExpiry('৩১/১২/২০২৭')).toEqual(end2027);
    expect(parseExpiry('ডিসেম্বর ২০২৭')).toEqual(end2027);
    // Spellings in common use, and য় typed either as one character or as two.
    expect(parseExpiry('১ জানুয়ারী ২০২৮')).toEqual({ y: 2028, m: 1, d: 1 });
    expect(parseExpiry('১ জানুয\u09BCারি ২০২৮')).toEqual({ y: 2028, m: 1, d: 1 });
    expect(parseExpiry('১ জানু\u09DFারি ২০২৮')).toEqual({ y: 2028, m: 1, d: 1 });
  });

  it('refuse what is not a real date', () => {
    for (const s of ['12/31/2027', '30 February 2027', '2027-02-29', '31 Smarch 2027', 'constructor 2027', 'soon', '1999-12-31', '2101-01-01', '']) {
      expect(parseExpiry(s), s).toBeNull();
    }
  });

  it('print in one form, so a card reads the same whoever typed it', () => {
    expect(expiryLabel(end2027)).toBe('31 December 2027');
    expect(expiryLabel(end2027, true)).toBe('৩১ ডিসেম্বর ২০২৭');
    expect(isoDate({ y: 2027, m: 6, d: 5 })).toBe('2027-06-05');
    const d = card();
    const cleaned = (v: string) => {
      const res = cleanValues(d, { recipient_name: 'A', valid_until: v });
      return res.ok ? res.values.valid_until : res.errors;
    };
    expect(cleaned('31/12/2027')).toBe('31 December 2027');
    expect(cleaned('৩১/১২/২০২৭')).toBe('৩১ ডিসেম্বর ২০২৭');
    // Cleaning twice changes nothing: the browser cleans, then the server does.
    expect(cleaned(cleaned('December 2027') as string)).toBe('31 December 2027');
    expect(cleaned('')).toBe('');
    expect(cleaned('next year')).toEqual(['Valid until must be a date, such as 31 December 2026 or 2026-12-31']);
  });

  it('end at the end of that day in Bangladesh', () => {
    const d = card();
    expect(expiryOf(d, { valid_until: '31 December 2027' })).toEqual({ date: '2027-12-31', at: new Date('2027-12-31T17:59:59.000Z') });
    expect(expiryOf(d, { valid_until: '' })).toBeNull();
    expect(expiryOf(presetDesign('classic-ledger'), { issue_date: '31 December 2027' })).toBeNull();
  });
});

describe('A4 print sheets', () => {
  const landscape = sheetLayout(PAGE_SIZES['card-landscape'].width * PT, PAGE_SIZES['card-landscape'].height * PT)!;
  const portrait = sheetLayout(PAGE_SIZES['card-portrait'].width * PT, PAGE_SIZES['card-portrait'].height * PT)!;

  it('fit 10 landscape cards or 9 portrait ones, and no certificates', () => {
    expect([landscape.cols, landscape.rows, landscape.perSheet]).toEqual([2, 5, 10]);
    expect([portrait.cols, portrait.rows, portrait.perSheet]).toEqual([3, 3, 9]);
    expect(sheetLayout(PAGE_SIZES['a4-landscape'].width * PT, PAGE_SIZES['a4-landscape'].height * PT)).toBeNull();
  });

  it('place each card inside the paper, edge to edge, in reading order, starting a new sheet when one is full', () => {
    for (const layout of [landscape, portrait]) {
      const spots = Array.from({ length: layout.perSheet }, (_, i) => slot(layout, i));
      for (const s of spots) {
        expect(s.x).toBeGreaterThanOrEqual(28);
        expect(s.y).toBeGreaterThanOrEqual(28);
        expect(s.x + layout.cardW).toBeLessThanOrEqual(A4.width - 28);
        expect(s.y + layout.cardH).toBeLessThanOrEqual(A4.height - 28);
      }
      // The second card is to the right of the first, touching it.
      expect(spots[1].x - spots[0].x).toBeCloseTo(layout.cardW);
      expect(spots[1].y).toBeCloseTo(spots[0].y);
      // The next row is below.
      expect(spots[0].y - spots[layout.cols].y).toBeCloseTo(layout.cardH);
      expect(slot(layout, layout.perSheet)).toEqual(slot(layout, 0));
    }
  });

  it('mark both ends of every cut, in the margins and never on a card', () => {
    for (const layout of [landscape, portrait]) {
      const marks = cutMarks(layout);
      expect(marks).toHaveLength((layout.cols + 1) * 2 + (layout.rows + 1) * 2);
      const gridLeft = layout.x0;
      const gridRight = layout.x0 + layout.cols * layout.cardW;
      const gridTop = A4.height - layout.top;
      const gridBottom = gridTop - layout.rows * layout.cardH;
      for (const [x1, y1, x2, y2] of marks) {
        const outside = (x: number, y: number) => x < gridLeft || x > gridRight || y < gridBottom || y > gridTop;
        expect(outside(x1, y1) && outside(x2, y2)).toBe(true);
        for (const [x, y] of [[x1, y1], [x2, y2]]) {
          expect(x).toBeGreaterThan(0);
          expect(x).toBeLessThan(A4.width);
          expect(y).toBeGreaterThan(0);
          expect(y).toBeLessThan(A4.height);
        }
      }
    }
  });
});
