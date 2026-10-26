import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { cleanValues, csvCell } from '@/lib/values';
import type { Field } from '@/lib/design';

const field = (over: Partial<Field> & Pick<Field, 'key'>): Field => ({ label: over.key, type: 'text', required: false, public: true, sample: '', ...over });

const design = {
  fields: [
    field({ key: 'recipient_name', label: 'Recipient name', required: true }),
    field({ key: 'course', label: 'Course', required: true }),
    field({ key: 'issue_date', label: 'Date', type: 'date' }),
    field({ key: 'email', label: 'Email', type: 'email', public: false }),
  ],
};

const ok = (raw: Record<string, unknown>, when?: Date) => {
  const res = cleanValues(design, raw, when);
  if (!res.ok) throw new Error(`expected ok, got: ${res.errors.join('; ')}`);
  return res.values;
};
const errors = (raw: Record<string, unknown>) => {
  const res = cleanValues(design, raw);
  if (res.ok) throw new Error('expected errors');
  return res.errors;
};

describe('cleanValues', () => {
  it('trims and collapses whitespace, including tabs and newlines', () => {
    const v = ok({ recipient_name: '  Nusrat \t Jahan\n\nMim  ', course: ' Data  Analysis ' });
    expect(v.recipient_name).toBe('Nusrat Jahan Mim');
    expect(v.course).toBe('Data Analysis');
  });

  it('removes control characters but keeps zero-width joiners that Bangla needs', () => {
    const v = ok({ recipient_name: 'A\u0000B\u0007C\u007fD', course: 'র‍্যাব ‌ক' });
    expect(v.recipient_name).toBe('ABCD');
    expect(v.course).toBe('র‍্যাব ‌ক');
  });

  it('reports each missing required field by its label', () => {
    expect(errors({})).toEqual(['Recipient name is empty', 'Course is empty']);
    expect(errors({ recipient_name: '   ', course: 'x' })).toEqual(['Recipient name is empty']);
  });

  it('fills an empty date field with the issue date, but not a typed one', () => {
    expect(ok({ recipient_name: 'A', course: 'B' }, new Date('2026-09-21T12:00:00Z')).issue_date).toBe('21 September 2026');
    expect(ok({ recipient_name: 'A', course: 'B', issue_date: '1 Jan 2020' }).issue_date).toBe('1 Jan 2020');
  });

  it('validates email fields only when something was entered', () => {
    expect(ok({ recipient_name: 'A', course: 'B' }).email).toBe('');
    expect(ok({ recipient_name: 'A', course: 'B', email: 'a@b.co' }).email).toBe('a@b.co');
    for (const bad of ['plain', 'a@b', 'a b@c.com', '@c.com', 'a@.c']) {
      expect(errors({ recipient_name: 'A', course: 'B', email: bad }), bad).toEqual(['Email is not a valid email address']);
    }
  });

  it('refuses values longer than 300 characters rather than silently cutting them', () => {
    expect(errors({ recipient_name: 'x'.repeat(301), course: 'B' })).toEqual(['Recipient name is longer than 300 characters']);
    expect(ok({ recipient_name: 'x'.repeat(300), course: 'B' }).recipient_name).toHaveLength(300);
  });

  it('turns non-string input into text and ignores fields the design does not have', () => {
    const v = ok({ recipient_name: 42, course: true, surplus: 'dropped' });
    expect(v.recipient_name).toBe('42');
    expect(v.course).toBe('true');
    expect('surplus' in v).toBe(false);
  });

  it('only reads values the caller actually supplied', () => {
    // A field called "constructor" is legal; with no value supplied it must be empty,
    // not the text of Object.prototype.constructor.
    const withConstructor = { fields: [...design.fields, field({ key: 'constructor', label: 'Constructor' })] };
    const res = cleanValues(withConstructor, JSON.parse('{"recipient_name":"A","course":"B"}'));
    expect(res.ok && res.values.constructor).toBe('');
  });
});

describe('csvCell', () => {
  it('leaves plain text alone and quotes what CSV requires', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it.each(['=SUM(A1:A9)', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1'])('neutralises the spreadsheet formula %j', (value) => {
    const cell = csvCell(value);
    expect(cell.replace(/^"/, '').startsWith("'")).toBe(true);
  });

  it('neutralises and still quotes a formula that also contains a comma', () => {
    expect(csvCell('=HYPERLINK("http://evil","x"),1')).toBe(`"'=HYPERLINK(""http://evil"",""x""),1"`);
  });

  it('round-trips through a real CSV parser without ever producing a formula cell', () => {
    const values = ['Nusrat, Jahan', 'He said "hi"', '=cmd|calc', '+1', '-1', '@x', 'multi\nline', 'ক্ষমা', ''];
    const text = values.map(csvCell).join(',') + '\n';
    const parsed = Papa.parse<string[]>(text).data[0];
    expect(parsed).toHaveLength(values.length);
    for (const cell of parsed) expect(/^[=+\-@\t\r]/.test(cell), cell).toBe(false);
    expect(parsed[0]).toBe('Nusrat, Jahan');
    expect(parsed[1]).toBe('He said "hi"');
    expect(parsed[6]).toBe('multi\nline');
    expect(parsed[7]).toBe('ক্ষমা');
  });
});
