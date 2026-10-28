import type { Design, Field } from './design';
import { todayLabel } from './design';

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX = 300;

export type RowResult = { ok: true; values: Record<string, string> } | { ok: false; errors: string[] };

/**
 * Normalises one recipient's values against the design's fields. The same rules run in the
 * browser (to show problems before issuing) and on the server (which is the one that counts).
 */
export function cleanValues(design: Pick<Design, 'fields'>, raw: Record<string, unknown>, issueDate = new Date()): RowResult {
  const values: Record<string, string> = {};
  const errors: string[] = [];
  for (const f of design.fields) {
    // Own properties only: a field called "constructor" must not read Object.prototype.constructor.
    const supplied = Object.hasOwn(raw, f.key) ? raw[f.key] : undefined;
    let v = typeof supplied === 'string' ? supplied : supplied == null ? '' : String(supplied);
    v = v.replace(CONTROL, '').replace(/\s+/g, ' ').trim();
    if (v.length > MAX) errors.push(`${f.label} is longer than ${MAX} characters`);
    if (!v && f.type === 'date') v = todayLabel(issueDate);
    if (!v && f.required) errors.push(`${f.label} is empty`);
    if (v && f.type === 'email' && !EMAIL.test(v)) errors.push(`${f.label} is not a valid email address`);
    // The photo itself never leaves the browser; what is kept is its file name, to find it again.
    if (v && f.type === 'photo') v = v.replace(/^.*[\\/]/, '');
    if (v && f.type === 'expiry') {
      const date = parseExpiry(v);
      if (date) v = expiryLabel(date, /[ঀ-৿]/.test(v));
      else errors.push(`${f.label} must be a date, such as 31 December 2026 or 2026-12-31`);
    }
    values[f.key] = v.slice(0, MAX);
  }
  return errors.length ? { ok: false, errors } : { ok: true, values };
}

/** Fields a verification page shows. Email addresses and photos never are. */
export function isPublicField(f: Field) {
  return f.public && f.type !== 'email' && f.type !== 'photo';
}

/* ------------------------------------------------------------------ */
/* Expiry dates                                                        */
/* ------------------------------------------------------------------ */

export type CalendarDate = { y: number; m: number; d: number };

const ENGLISH_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const BANGLA_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
// A Map, so a word such as "constructor" is not mistaken for a month.
const MONTHS = new Map<string, number>();
// NFC on both sides: Bangla য় can be typed as one character or as two, and NFC turns both into the same pair.
const monthKey = (name: string) => name.normalize('NFC').toLowerCase();
ENGLISH_MONTHS.forEach((name, i) => {
  MONTHS.set(monthKey(name), i + 1);
  MONTHS.set(monthKey(name.slice(0, 3)), i + 1);
});
MONTHS.set('sept', 9);
BANGLA_MONTHS.forEach((name, i) => MONTHS.set(monthKey(name), i + 1));
// Other spellings in common use.
for (const [name, n] of [['জানুয়ারী', 1], ['ফেব্রুয়ারী', 2], ['আগষ্ট', 8]] as const) MONTHS.set(monthKey(name), n);

const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯';
const toAscii = (s: string) => s.replace(/[০-৯]/g, (c) => String(BANGLA_DIGITS.indexOf(c)));
const toBangla = (s: string) => s.replace(/[0-9]/g, (c) => BANGLA_DIGITS[Number(c)]);

function real(y: number, m: number, d: number): CalendarDate | null {
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(y, m, 0)).getUTCDate()) return null;
  return { y, m, d };
}

const lastDay = (y: number, m: number) => real(y, m, new Date(Date.UTC(y < 100 ? y + 2000 : y, m, 0)).getUTCDate());

/**
 * Reads the date a document is valid until, as people write it: 2026-12-31, 31/12/2026 (day
 * first, as in Bangladesh), 31 December 2026, December 31, 2026, Bangla digits and month names, or
 * just a month (December 2026, 12/2026), which means its last day.
 */
export function parseExpiry(text: string): CalendarDate | null {
  const t = monthKey(toAscii(text)).trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return real(+m[1], +m[2], +m[3]);
  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})$/))) return real(+m[3], +m[2], +m[1]);
  if ((m = t.match(/^(\d{4})-(\d{1,2})$/))) return lastDay(+m[1], +m[2]);
  if ((m = t.match(/^(\d{1,2})[/.-](\d{4})$/))) return lastDay(+m[2], +m[1]);
  const month = (name: string) => MONTHS.get(name.replace(/\.$/, '')) ?? 0;
  let mo = 0;
  if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)? (\S+?)\.? (\d{4})$/)) && (mo = month(m[2]))) return real(+m[3], mo, +m[1]);
  if ((m = t.match(/^(\S+?)\.? (\d{1,2})(?:st|nd|rd|th)? (\d{4})$/)) && (mo = month(m[1]))) return real(+m[3], mo, +m[2]);
  if ((m = t.match(/^(\S+?)\.? (\d{4})$/)) && (mo = month(m[1]))) return lastDay(+m[2], mo);
  return null;
}

/** "31 December 2026" (as dates are written elsewhere on documents), or in Bangla "৩১ ডিসেম্বর ২০২৬". */
export function expiryLabel({ y, m, d }: CalendarDate, bangla = false) {
  return bangla ? toBangla(`${d} ${BANGLA_MONTHS[m - 1]} ${y}`) : `${d} ${ENGLISH_MONTHS[m - 1]} ${y}`;
}

/** "2026-12-31". */
export const isoDate = ({ y, m, d }: CalendarDate) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/**
 * When a recipient's document stops being valid: the end of its "valid until" day in Bangladesh
 * time (UTC+6, with no daylight saving), or null when the design has no such date or it was left empty.
 */
export function expiryOf(design: Pick<Design, 'fields'>, values: Record<string, string>) {
  const f = design.fields.find((x) => x.type === 'expiry');
  const date = f && values[f.key] ? parseExpiry(values[f.key]) : null;
  if (!date) return null;
  return { date: isoDate(date), at: new Date(Date.UTC(date.y, date.m - 1, date.d, 23, 59, 59) - 6 * 3600_000) };
}

/** Escapes a value for CSV export so spreadsheet apps don't execute it as a formula. */
export function csvCell(value: string) {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
