import Papa from 'papaparse';
import { describe, expect, it } from 'vitest';
import { certificatesCsv } from '@/lib/export';
import { fakeSerial, hasDb, makeBatch, makeCertificates, makeUser } from './helpers';

async function csv(gen: AsyncGenerator<string>) {
  let out = '';
  for await (const chunk of gen) out += chunk;
  return out;
}
const parse = (text: string) => Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: true }).data;

describe.skipIf(!hasDb)('certificate CSV export (real Postgres)', () => {
  it('starts with a byte-order mark and the column headings', async () => {
    const user = await makeUser();
    const text = await csv(certificatesCsv(user.id));
    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text.slice(1).split('\r\n')[0]).toBe('Serial,Verification link,Recipient,Email,Issued (UTC),Status,Revoked (UTC),Revocation reason,Batch');
  });

  it('lists a certificate with its link, date, status and batch', async () => {
    const user = await makeUser();
    const batch = await makeBatch(user.id, { name: 'October cohort' });
    const [serial] = await makeCertificates(user.id, batch.id, [{ name: 'Nusrat Jahan Mim', email: 'n@example.com', issuedAt: '2026-10-01T09:30:00.000Z' }]);
    const [, row] = parse(await csv(certificatesCsv(user.id)));
    expect(row).toEqual([serial, `http://localhost:3000/verify/${serial}`, 'Nusrat Jahan Mim', 'n@example.com', '2026-10-01T09:30:00.000Z', 'Valid', '', '', 'October cohort']);
  });

  it('shows revocations with their date and reason', async () => {
    const user = await makeUser();
    const batch = await makeBatch(user.id);
    await makeCertificates(user.id, batch.id, [{ revoked: true }]);
    const [, row] = parse(await csv(certificatesCsv(user.id)));
    expect(row[5]).toBe('Revoked');
    expect(row[6]).toMatch(/^\d{4}-\d\d-\d\dT/);
    expect(row[7]).toBe('Issued by mistake');
  });

  it("never includes anyone else's certificates", async () => {
    const mine = await makeUser();
    const theirs = await makeUser();
    await makeCertificates(mine.id, (await makeBatch(mine.id)).id, [{ name: 'Mine' }]);
    await makeCertificates(theirs.id, (await makeBatch(theirs.id)).id, [{ name: 'Not mine' }]);
    const rows = parse(await csv(certificatesCsv(mine.id)));
    expect(rows.slice(1).map((r) => r[2])).toEqual(['Mine']);
  });

  it('lists newest first and breaks ties by serial, so the order is stable', async () => {
    const user = await makeUser();
    const batch = await makeBatch(user.id);
    // Serials are unique across the whole database and it persists between runs, so each test makes its own.
    const stem = fakeSerial().slice(0, -1);
    await makeCertificates(user.id, batch.id, [
      { name: 'old', issuedAt: '2026-01-01T00:00:00Z' },
      { name: 'b', issuedAt: '2026-06-01T00:00:00Z', serial: `${stem}B` },
      { name: 'a', issuedAt: '2026-06-01T00:00:00Z', serial: `${stem}A` },
      { name: 'new', issuedAt: '2026-09-01T00:00:00Z' },
    ]);
    const names = parse(await csv(certificatesCsv(user.id))).slice(1).map((r) => r[2]);
    expect(names).toEqual(['new', 'a', 'b', 'old']);
  });

  it('keeps commas, quotes, newlines and Bangla intact', async () => {
    const user = await makeUser();
    const batch = await makeBatch(user.id);
    const names = ['Rahman, Abdul', 'Say "hello"', 'Two\nLines', 'রাহিম ক্ষমা চৌধুরী'];
    await makeCertificates(user.id, batch.id, names.map((name, i) => ({ name, issuedAt: `2026-01-0${i + 1}T00:00:00Z` })));
    const got = parse(await csv(certificatesCsv(user.id))).slice(1).map((r) => r[2]);
    expect(got.sort()).toEqual([...names].sort());
  });

  it('cannot be used to run a spreadsheet formula', async () => {
    const user = await makeUser();
    const batch = await makeBatch(user.id);
    await makeCertificates(user.id, batch.id, [{ name: '=HYPERLINK("http://evil.example","click")' }, { name: '+1+1' }, { name: '@SUM(A1)' }, { name: '-2+3' }]);
    const rows = parse(await csv(certificatesCsv(user.id))).slice(1);
    for (const r of rows) expect(/^[=+\-@\t\r]/.test(r[2]), r[2]).toBe(false);
    expect(rows.map((r) => r[2]).sort()).toEqual(["'+1+1", "'-2+3", `'=HYPERLINK("http://evil.example","click")`, "'@SUM(A1)"].sort());
  });

  it('applies the same search as the dashboard, treating % and _ literally', async () => {
    const user = await makeUser();
    const batch = await makeBatch(user.id);
    await makeCertificates(user.id, batch.id, [{ name: '50% Off Winner' }, { name: '50 Xylophone' }, { name: 'a_b Person' }, { name: 'aXb Person' }, { name: 'Nusrat Jahan' }]);
    const search = async (q: string) => parse(await csv(certificatesCsv(user.id, { q }))).slice(1).map((r) => r[2]).sort();
    expect(await search('50%')).toEqual(['50% Off Winner']);
    expect(await search('a_b')).toEqual(['a_b Person']);
    expect(await search('NUSRAT')).toEqual(['Nusrat Jahan']);
    expect(await search('nothing matches this')).toEqual([]);
    expect(await search('')).toHaveLength(5);
  });

  it('finds a certificate by part of its serial', async () => {
    const user = await makeUser();
    const batch = await makeBatch(user.id);
    const target = fakeSerial();
    await makeCertificates(user.id, batch.id, [{ name: 'Target', serial: target }, { name: 'Other' }]);
    const search = async (q: string) => parse(await csv(certificatesCsv(user.id, { q }))).slice(1).map((r) => r[2]);
    expect(await search(target.toLowerCase())).toEqual(['Target']); // whole serial, whatever the case
    expect(await search(target.slice(0, 8))).toContain('Target'); // just its first group
  });

  it("adds a batch's own fields as columns when exporting one batch", async () => {
    const user = await makeUser();
    const a = await makeBatch(user.id, { name: 'A' });
    const b = await makeBatch(user.id, { name: 'B' });
    await makeCertificates(user.id, a.id, [{ name: 'In A', values: { position: 'Second place', event: 'Spelling bee' } }]);
    await makeCertificates(user.id, b.id, [{ name: 'In B' }]);
    const rows = parse(await csv(certificatesCsv(user.id, { batchId: a.id })));
    expect(rows[0].slice(9)).toEqual(['Position', 'Competition', 'Date']); // labels of the podium preset's fields
    expect(rows).toHaveLength(2);
    expect(rows[1][2]).toBe('In A');
    expect(rows[1].slice(9)).toEqual(['Second place', 'Spelling bee', '1 January 2026']);
  });

  it("gives nothing for someone else's batch", async () => {
    const me = await makeUser();
    const them = await makeUser();
    const theirBatch = await makeBatch(them.id);
    await makeCertificates(them.id, theirBatch.id, [{ name: 'Secret' }]);
    const rows = parse(await csv(certificatesCsv(me.id, { batchId: theirBatch.id })));
    expect(rows).toHaveLength(1); // the header only...
    expect(rows[0]).toHaveLength(9); // ...and not even their field labels (Position, Competition, ...) in it
    expect(JSON.stringify(rows)).not.toContain('Secret');
    expect(JSON.stringify(rows)).not.toContain('Position');
  });

  // The regression this guards: a cursor held as a JavaScript Date loses the microseconds Postgres keeps, so
  // rows sharing a timestamp are skipped or repeated at a page boundary. 2,350 rows cross two boundaries (at
  // rows 1000 and 2000). The 37 instants are chosen so that neither boundary falls between two instants: the
  // rows that tie with the last row of a page must continue on the next one - the case the serial tiebreak is for.
  it('returns every certificate exactly once across page boundaries, even with microsecond timestamps', async () => {
    const user = await makeUser();
    const batch = await makeBatch(user.id);
    const specs = Array.from({ length: 2350 }, (_, i) => ({
      name: `Person ${String(i).padStart(4, '0')}`,
      // 37 distinct instants, some differing only in the microseconds, about 63 rows sharing each one
      issuedAt: `2026-03-01T10:00:00.${String(123400 + (i % 37)).padStart(6, '0')}Z`,
    }));
    const serials = await makeCertificates(user.id, batch.id, specs);

    const rows = parse(await csv(certificatesCsv(user.id))).slice(1);
    expect(rows).toHaveLength(2350);
    expect(new Set(rows.map((r) => r[0])).size).toBe(2350); // none repeated
    expect([...rows.map((r) => r[0])].sort()).toEqual([...serials].sort()); // none missing
  }, 120_000);
});
