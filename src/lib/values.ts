import type { Design } from './design';
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
    values[f.key] = v.slice(0, MAX);
  }
  return errors.length ? { ok: false, errors } : { ok: true, values };
}

/** Escapes a value for CSV export so spreadsheet apps don't execute it as a formula. */
export function csvCell(value: string) {
  let v = value;
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
