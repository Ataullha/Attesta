import { describe, expect, it } from 'vitest';
import { classify, contactDetails, dialable, vcard } from '@/lib/contact';

const kindOf = (label: string, value: string) => classify(label, value).map((d) => d.kind);

describe('details on a visiting card or an invitation', () => {
  it('are recognised by their value when it is unmistakable', () => {
    expect(classify('Anything', 'nusrat@example.com')).toEqual([{ label: 'Anything', value: 'nusrat@example.com', kind: 'email', href: 'mailto:nusrat@example.com' }]);
    expect(classify('Anything', '+880 1711-123456')[0]).toMatchObject({ kind: 'phone', href: 'tel:+8801711123456', phoneType: 'cell' });
    expect(classify('Anything', 'https://example.com/team')[0]).toMatchObject({ kind: 'url', href: 'https://example.com/team' });
    expect(classify('Anything', 'example.com.bd')[0]).toMatchObject({ kind: 'url', href: 'https://example.com.bd' });
  });

  it('are recognised by their label otherwise, in English or Bangla', () => {
    expect(kindOf('Designation', 'Head of Marketing')).toEqual(['title']);
    expect(kindOf('পদবি', 'বিপণন প্রধান')).toEqual(['title']);
    expect(kindOf('Company', 'Example Ltd')).toEqual(['org']);
    expect(kindOf('Department', 'Finance')).toEqual(['department']);
    expect(classify('Venue', 'Senamalancha, Dhaka')[0]).toMatchObject({ kind: 'address', href: 'https://www.google.com/maps/search/?api=1&query=Senamalancha%2C%20Dhaka' });
    expect(kindOf('ঠিকানা', 'বাড়ি ১২, ধানমন্ডি')).toEqual(['address']);
    expect(kindOf('Phone', '9 123 456')).toEqual(['phone']);
    expect(kindOf('Website', 'example.app/page')).toEqual(['url']);
  });

  it('do not mistake a name, an ID or a year for a link or a number to call', () => {
    expect(kindOf('Name', 'Md.Rahim')).toEqual(['other']);
    expect(kindOf('Member ID', '2026-117')).toEqual(['other']);
    expect(kindOf('Guests', '2')).toEqual(['other']);
    expect(kindOf('Note', 'Dress code: smart casual')).toEqual(['other']);
    expect(kindOf('RSVP', '01XXX-XXXXXX')).toEqual(['other']);
  });

  it('split a value holding several numbers into one each, and tell mobiles from landlines', () => {
    const phones = classify('Contact', '01711-123456, 02-9123456');
    expect(phones.map((p) => [p.value, p.phoneType])).toEqual([
      ['01711-123456', 'cell'],
      ['02-9123456', 'work'],
    ]);
    expect(classify('Fax', '02-9123457')[0].phoneType).toBe('fax');
    // Bangla digits dial as ASCII ones.
    expect(classify('মোবাইল', '০১৭১১-১২৩৪৫৬')[0]).toMatchObject({ kind: 'phone', href: 'tel:01711123456', phoneType: 'cell' });
    expect(dialable('(০২) ৯১২৩৪৫৬')).toBe('02 9123456');
  });

  it('never make a link from anything but a web address', () => {
    for (const v of ['javascript:alert(1)', 'data:text/html,hi', 'ftp://example.com']) {
      expect(classify('Website', v).every((d) => !d.href || /^https:\/\//.test(d.href))).toBe(true);
    }
  });
});

describe('a visiting card as a contact', () => {
  const details = contactDetails([
    { label: 'Designation', value: 'Head of Marketing' },
    { label: 'Mobile', value: '01711-123456' },
    { label: 'Email', value: 'nusrat@example.com' },
    { label: 'Website', value: 'example.com' },
    { label: 'Address', value: 'House 12; Road 5, Dhanmondi' },
    { label: 'Department', value: 'Growth' },
    { label: 'Languages', value: 'Bangla, English' },
  ]);

  it('is a vCard 3.0 phones can import, with each detail where contacts apps expect it', () => {
    const card = vcard({ name: 'Nusrat Jahan', details, org: 'Example Ltd' });
    expect(card.split('\r\n')).toEqual([
      'BEGIN:VCARD',
      'VERSION:3.0',
      'N:Jahan;Nusrat;;;',
      'FN:Nusrat Jahan',
      'ORG:Example Ltd;Growth',
      'TITLE:Head of Marketing',
      'TEL;TYPE=CELL:01711-123456',
      'EMAIL;TYPE=INTERNET:nusrat@example.com',
      'URL:https://example.com',
      'ADR;TYPE=WORK:;;House 12\\; Road 5\\, Dhanmondi;;;;',
      'NOTE:Languages: Bangla\\, English',
      'END:VCARD',
      '',
    ]);
  });

  it('takes the company from the card when it names one, over the issuer', () => {
    const card = vcard({ name: 'A B', details: contactDetails([{ label: 'Company', value: 'Own Co' }]), org: 'Issuer Org' });
    expect(card).toContain('ORG:Own Co\r\n');
    expect(vcard({ name: 'Solo', details: [], org: null })).not.toContain('ORG:');
  });

  it('folds long lines at 75 bytes without splitting a Bangla letter', () => {
    const name = 'নুসরাত জাহান মিম '.repeat(4).trim();
    const card = vcard({ name, details: [], org: null });
    const lines = card.split('\r\n');
    for (const l of lines) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    // Unfolding gives back the name intact.
    const unfolded = card.replace(/\r\n /g, '');
    expect(unfolded).toContain(`FN:${name}\r\n`);
  });
});
