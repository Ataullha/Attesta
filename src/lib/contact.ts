import { toAscii } from './values';

/**
 * The details on a visiting card or an invitation, read the way a phone reads a contact: a phone
 * number, an email address, a website or an address becomes something to tap, and a designation,
 * company or department goes where a contacts app expects it. A detail is recognised by its value
 * when that is unambiguous (an email address), otherwise by its label, in English or Bangla.
 */
export type ContactKind = 'phone' | 'email' | 'url' | 'title' | 'org' | 'department' | 'address' | 'other';

export type ContactDetail = {
  label: string;
  value: string;
  kind: ContactKind;
  /** Where tapping it goes: tel:, mailto:, the website, or a map search for an address. */
  href?: string;
  /** For phone numbers: a mobile, or a landline or fax. */
  phoneType?: 'cell' | 'work' | 'fax';
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// A host name with an optional port and path, with or without the scheme.
const HOST = /^(?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+([a-z]{2,})(?::\d{2,5})?(?:[/?#]\S*)?$/i;
// Without a scheme, "md.rahim" must not be taken for a website, so a bare host needs a familiar ending.
const COMMON_TLDS = new Set(['com', 'net', 'org', 'bd', 'io', 'co', 'info', 'edu', 'gov', 'me', 'app', 'dev', 'xyz', 'biz', 'uk', 'in', 'us', 'ca', 'au', 'shop', 'store', 'online', 'site', 'tech', 'ai', 'gl', 'ly', 'page']);

const LABELS: [Exclude<ContactKind, 'email' | 'other'>, RegExp][] = [
  ['phone', /phone|mobile|cell|\btel|contact|whats ?app|hotline|fax|মোবাইল|ফোন|যোগাযোগ/i],
  ['url', /web|site|url|link|map|facebook|linkedin|portfolio|ওয়েব|লিংক/i],
  ['title', /designation|title|position|role|\bjob|\bpost\b|পদবি|পদ$/i],
  ['org', /company|organi[sz]ation|business|institution|employer|\bfirm|প্রতিষ্ঠান|কোম্পানি|সংস্থা/i],
  ['department', /department|\bdept|division|বিভাগ/i],
  ['address', /address|location|office|venue|ঠিকানা|স্থান|ভেন্যু/i],
];

/** A phone number's digits and the characters numbers are written with, nothing else. */
function phoneLike(value: string) {
  const v = toAscii(value).trim();
  const digits = v.replace(/\D/g, '').length;
  return /^\+?[\d\s()./-]+$/.test(v) && digits >= 6 && digits <= 15;
}

/** Without a label that says so, a number is a phone number only when written like one: +880…, or 01711…. */
function looksDialled(value: string) {
  const v = toAscii(value).trim();
  return phoneLike(v) && /^(\+|0)/.test(v) && v.replace(/\D/g, '').length >= 8;
}

function website(value: string, labelled: boolean) {
  const m = value.match(HOST);
  if (!m || EMAIL.test(value)) return null;
  const schemed = /^https?:\/\//i.test(value);
  if (!schemed && !labelled && !COMMON_TLDS.has(m[1].toLowerCase())) return null;
  return schemed ? value : `https://${value}`;
}

/** A Bangladeshi mobile number (01[3-9] and 8 more digits, with or without +880); anything else is a landline. */
function phoneType(label: string, number: string): ContactDetail['phoneType'] {
  if (/fax/i.test(label)) return 'fax';
  if (/mobile|cell|whats ?app|মোবাইল/i.test(label)) return 'cell';
  return /^(?:\+?880|0)1[3-9]\d{8}$/.test(number.replace(/[^\d+]/g, '')) ? 'cell' : 'work';
}

/** Phone numbers as a dialler wants them: ASCII digits, a leading +, spaces and hyphens. */
export function dialable(value: string) {
  return toAscii(value).replace(/[^\d+\s-]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * One detail, recognised. A value holding several phone numbers ("01711…, 01811…") becomes one
 * detail for each.
 */
export function classify(label: string, value: string): ContactDetail[] {
  const v = value.trim();
  if (!v) return [];
  if (EMAIL.test(v)) return [{ label, value: v, kind: 'email', href: `mailto:${v}` }];
  const byLabel = LABELS.find(([, re]) => re.test(label))?.[0];
  const parts = v.split(/\s*[,;]\s*|\s+\/\s+/).filter(Boolean);
  if ((byLabel === 'phone' && parts.every(phoneLike)) || (parts.length && parts.every(looksDialled))) {
    return parts.map((p) => ({ label, value: p, kind: 'phone' as const, href: `tel:${dialable(p).replace(/[\s-]/g, '')}`, phoneType: phoneType(label, dialable(p)) }));
  }
  const url = website(v, byLabel === 'url');
  if (url) return [{ label, value: v, kind: 'url', href: url }];
  if (byLabel === 'address') return [{ label, value: v, kind: 'address', href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}` }];
  if (byLabel === 'title' || byLabel === 'org' || byLabel === 'department') return [{ label, value: v, kind: byLabel }];
  return [{ label, value: v, kind: 'other' }];
}

export function contactDetails(fields: { label: string; value: string }[]) {
  return fields.flatMap((f) => classify(f.label, f.value));
}

/* ------------------------------------------------------------------ */
/* vCard 3.0 (RFC 2426), which iPhones and Android phones both import  */
/* ------------------------------------------------------------------ */

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const utf8 = new TextEncoder();

/** Lines longer than 75 octets are folded, never in the middle of a character. */
function fold(line: string) {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = utf8.encode(ch).length;
    // A continuation line starts with a space, which counts towards its 75.
    const limit = out.length ? 74 : 75;
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

/** "Md. Rahim Uddin" as family name "Uddin" and given names "Md. Rahim", for the N property. */
function nameParts(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return { family: '', given: words[0] ?? '' };
  return { family: words[words.length - 1], given: words.slice(0, -1).join(' ') };
}

export function vcard({ name, details, org }: { name: string; details: ContactDetail[]; org?: string | null }) {
  const first = (kind: ContactKind) => details.find((d) => d.kind === kind)?.value;
  const company = first('org') ?? org ?? null;
  const department = first('department');
  const { family, given } = nameParts(name);
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escapeText(family)};${escapeText(given)};;;`, `FN:${escapeText(name)}`];
  if (company || department) lines.push(`ORG:${escapeText(company ?? '')}${department ? `;${escapeText(department)}` : ''}`);
  const title = first('title');
  if (title) lines.push(`TITLE:${escapeText(title)}`);
  for (const d of details) {
    if (d.kind === 'phone') lines.push(`TEL;TYPE=${d.phoneType === 'cell' ? 'CELL' : d.phoneType === 'fax' ? 'WORK,FAX' : 'WORK,VOICE'}:${dialable(d.value)}`);
    else if (d.kind === 'email') lines.push(`EMAIL;TYPE=INTERNET:${escapeText(d.value)}`);
    else if (d.kind === 'url' && d.href) lines.push(`URL:${escapeText(d.href)}`);
    else if (d.kind === 'address') lines.push(`ADR;TYPE=WORK:;;${escapeText(d.value)};;;;`);
  }
  const notes = details.filter((d) => d.kind === 'other').map((d) => `${d.label}: ${d.value}`);
  if (notes.length) lines.push(`NOTE:${escapeText(notes.join('\n'))}`);
  lines.push('END:VCARD');
  return lines.map(fold).join('\r\n') + '\r\n';
}
