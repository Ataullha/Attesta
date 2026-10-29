import { describe, expect, it } from 'vitest';
import { INVITATION_PRESETS, VISITING_CARD_PRESETS, blankInvitation, blankVisitingCard, presetDesign } from '@/lib/presets';
import { KINDS, PAGE_SIZES, capitalised, designKind, designSchema, isCard, kindNoun, withArticle, type Design } from '@/lib/design';
import { cleanValues } from '@/lib/values';
import { contactDetails, vcard } from '@/lib/contact';
import { sheetFor } from '@/components/editor/sheet';

const inches = (px: number) => px / 96;
const mm = (px: number) => (px / 96) * 25.4;

describe('visiting cards and invitations', () => {
  it('come in the sizes they are printed at', () => {
    expect([inches(PAGE_SIZES['visiting-landscape'].width), inches(PAGE_SIZES['visiting-landscape'].height)]).toEqual([3.5, 2]);
    expect([inches(PAGE_SIZES['visiting-portrait'].width), inches(PAGE_SIZES['visiting-portrait'].height)]).toEqual([2, 3.5]);
    expect([inches(PAGE_SIZES['invitation-5x7'].width), inches(PAGE_SIZES['invitation-5x7'].height)]).toEqual([5, 7]);
    expect([inches(PAGE_SIZES['invitation-7x5'].width), inches(PAGE_SIZES['invitation-7x5'].height)]).toEqual([7, 5]);
    expect([inches(PAGE_SIZES['invitation-square'].width), inches(PAGE_SIZES['invitation-square'].height)]).toEqual([6, 6]);
    expect(Math.abs(mm(PAGE_SIZES['invitation-a5'].width) - 148)).toBeLessThan(0.05);
    expect(Math.abs(mm(PAGE_SIZES['invitation-a5'].height) - 210)).toBeLessThan(0.05);
  });

  it('are kinds of their own, called by their names', () => {
    for (const p of VISITING_CARD_PRESETS) expect(designKind(p.design), p.slug).toBe('visiting-card');
    for (const p of INVITATION_PRESETS) expect(designKind(p.design), p.slug).toBe('invitation');
    expect([kindNoun('visiting-card'), kindNoun('visiting-card', true), kindNoun('invitation'), kindNoun('invitation', true)]).toEqual(['visiting card', 'visiting cards', 'invitation', 'invitations']);
    expect([withArticle('certificate'), withArticle('id-card'), withArticle('visiting-card'), withArticle('invitation')]).toEqual(['a certificate', 'an ID card', 'a visiting card', 'an invitation']);
    expect(capitalised(kindNoun('visiting-card'))).toBe('Visiting card');
    expect([KINDS['visiting-card'].page, KINDS.invitation.page]).toEqual(['contact page', 'invitation page']);
    expect([isCard('id-card'), isCard('visiting-card'), isCard('invitation'), isCard('certificate')]).toEqual([true, true, false, false]);
  });

  it('have templates that are valid designs, with a QR code, the full name shown and their pages kept out of search engines', () => {
    for (const p of [...VISITING_CARD_PRESETS, ...INVITATION_PRESETS]) {
      const res = designSchema.safeParse(p.design);
      expect(res.success, `${p.slug}: ${res.success ? '' : res.error.issues[0]?.message}`).toBe(true);
      expect(p.design.elements.some((e) => e.type === 'qr'), p.slug).toBe(true);
      expect(p.design.settings, p.slug).toEqual({ nameDisplay: 'full', indexable: false });
    }
    for (const d of [blankVisitingCard(), blankInvitation()]) expect(designSchema.safeParse(d).success).toBe(true);
  });

  it('print visiting cards ten to an A4 sheet in landscape and nine in portrait, and invitations one to a page', () => {
    const sheet = (id: keyof typeof PAGE_SIZES) => sheetFor({ kind: PAGE_SIZES[id].kind, page: { width: PAGE_SIZES[id].width, height: PAGE_SIZES[id].height, background: { color: '#FFFFFF', assetId: null, localId: null, fit: 'cover' } } });
    expect(sheet('visiting-landscape')?.perSheet).toBe(10);
    expect(sheet('visiting-portrait')?.perSheet).toBe(9);
    for (const id of ['invitation-5x7', 'invitation-7x5', 'invitation-a5', 'invitation-square'] as const) expect(sheet(id), id).toBeNull();
  });

  it('keep the company’s details on visiting cards the same for everyone, and each person’s own', () => {
    for (const p of VISITING_CARD_PRESETS) {
      const fixed = p.design.fields.filter((f) => f.fixed).map((f) => f.key);
      expect(fixed, p.slug).toEqual(expect.arrayContaining(['company', 'address']));
      expect(fixed, p.slug).not.toContain('recipient_name');
      expect(p.design.fields.every((f) => f.public && f.type === 'text'), p.slug).toBe(true);
    }
  });

  it('keep the event’s details on invitations the same for every guest, and only the name for each guest to give', () => {
    for (const p of INVITATION_PRESETS) {
      const own = p.design.fields.filter((f) => !f.fixed);
      expect(own.map((f) => f.key), p.slug).toEqual(['recipient_name']);
      expect(p.design.fields.find((f) => f.key === 'event')?.fixed, p.slug).toBe(true);
    }
  });
});

describe('a field that is the same for everyone', () => {
  const design = () => structuredClone(presetDesign('wedding-invitation')) as Design;

  it('takes the design’s value when a recipient has none, and theirs when they do', () => {
    const res = cleanValues(design(), { recipient_name: 'Mr. & Mrs. Rahman' });
    expect(res.ok && res.values.venue).toBe('Senamalancha, Dhaka Cantonment');
    const own = cleanValues(design(), { recipient_name: 'Karim', venue: '  Bashundhara   Convention Center ' });
    expect(own.ok && own.values.venue).toBe('Bashundhara Convention Center');
  });

  it('counts as filled in for a required field, as long as the design has a value', () => {
    const d = design();
    const venue = d.fields.find((f) => f.key === 'venue')!;
    venue.required = true;
    expect(cleanValues(d, { recipient_name: 'A' }).ok).toBe(true);
    venue.sample = '';
    expect(cleanValues(d, { recipient_name: 'A' })).toEqual({ ok: false, errors: ['Venue is empty'] });
  });

  it('follows its type: a shared date it is valid until is read and printed like any other', () => {
    const d = design();
    d.fields.push({ key: 'valid_until', label: 'Valid until', type: 'expiry', required: false, public: true, fixed: true, sample: '11/12/2026' });
    const res = cleanValues(d, { recipient_name: 'A' });
    expect(res.ok && res.values.valid_until).toBe('11 December 2026');
  });

  it('never stands in for a photo, which is always someone’s own', () => {
    const d = structuredClone(presetDesign('club-member-card')) as Design;
    const photo = d.fields.find((f) => f.type === 'photo')!;
    Object.assign(photo, { fixed: true, sample: 'everyone.jpg' });
    const res = cleanValues(d, { recipient_name: 'A' });
    expect(res.ok && res.values.photo).toBe('');
  });

  it('is optional in saved designs, so designs saved before it existed still load', () => {
    const d = structuredClone(presetDesign('classic-ledger'));
    expect(d.fields.some((f) => 'fixed' in f)).toBe(false);
    expect(designSchema.safeParse(d).success).toBe(true);
  });
});

describe('a visiting card template’s details', () => {
  it('make a contact whose company comes from the card', () => {
    const d = presetDesign('corporate-visiting-card');
    const res = cleanValues(d, { recipient_name: 'Nusrat Jahan', designation: 'Head of Marketing', mobile: '01711-123456', email: 'nusrat@example.com' });
    if (!res.ok) throw new Error(res.errors.join('; '));
    const fields = d.fields.filter((f) => f.public && f.key !== 'recipient_name' && res.values[f.key]).map((f) => ({ label: f.label, value: res.values[f.key] }));
    const contact = vcard({ name: res.values.recipient_name, details: contactDetails(fields), org: 'Issuing account' });
    expect(contact).toContain('ORG:Your Company Ltd\r\n');
    expect(contact).toContain('TEL;TYPE=CELL:01711-123456\r\n');
    expect(contact).toContain('URL:https://www.yourcompany.com\r\n');
  });
});
