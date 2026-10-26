import Papa from 'papaparse';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Browser, SERIAL, baseUrl, closeDb, giveCredits, issue, signUp, signUpConfirmed, type Account } from './helpers';

afterAll(closeDb);

const rows = (text: string) => Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: true }).data;

describe('GET /api/certificates/export', () => {
  let owner: Account;
  let batchId = '';
  let serials: string[] = [];

  beforeAll(async () => {
    owner = await signUpConfirmed('exporter');
    await giveCredits(owner.email, 50);
    const res = await issue(owner.browser, ['Rahman, Abdul', 'Say "hello"', '=HYPERLINK("http://evil.example","click")', 'রাহিম চৌধুরী'], 'bulk', { batchName: 'October cohort' });
    expect(res.status).toBe(200);
    batchId = res.json.batchId;
    serials = res.json.issued.map((c: { serial: string }) => c.serial);
  });

  it('is only for signed-in accounts', async () => {
    const res = await new Browser().get('/api/certificates/export');
    expect(res.status).toBe(401);
  });

  it('downloads a CSV that Excel opens correctly: UTF-8 with a byte-order mark, CRLF lines', async () => {
    const res = await owner.browser.get('/api/certificates/export');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="certificates-\d{4}-\d\d-\d\d\.csv"$/);
    expect([...res.bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(res.text.split('\r\n').length).toBe(6); // header, four certificates, and the empty piece after the last CRLF
    expect(res.text.slice(1).split('\r\n')[0]).toBe('Serial,Verification link,Recipient,Email,Issued (UTC),Status,Revoked (UTC),Revocation reason,Batch');
  });

  it('lists every certificate with its public link and batch, and keeps commas, quotes and Bangla intact', async () => {
    const [, ...data] = rows((await owner.browser.get('/api/certificates/export')).text);
    expect(data).toHaveLength(4);
    for (const row of data) {
      expect(row[0]).toMatch(SERIAL);
      expect(row[1]).toBe(`${baseUrl()}/verify/${row[0]}`);
      expect(row[5]).toBe('Valid');
      expect(row[8]).toBe('October cohort');
    }
    expect(data.map((r) => r[2])).toEqual(expect.arrayContaining(['Rahman, Abdul', 'Say "hello"', 'রাহিম চৌধুরী']));
    expect(data.map((r) => r[0]).sort()).toEqual([...serials].sort());
  });

  it('cannot be used to run a spreadsheet formula', async () => {
    const [, ...data] = rows((await owner.browser.get('/api/certificates/export')).text);
    const names = data.map((r) => r[2]);
    expect(names).toContain(`'=HYPERLINK("http://evil.example","click")`);
    expect(names.some((n) => n.startsWith('='))).toBe(false);
  });

  it('applies the dashboard’s search', async () => {
    const [, ...data] = rows((await owner.browser.get('/api/certificates/export?q=rahman')).text);
    expect(data.map((r) => r[2])).toEqual(['Rahman, Abdul']);
    const none = rows((await owner.browser.get('/api/certificates/export?q=nobody+is+called+this')).text);
    expect(none).toHaveLength(1); // the header alone
  });

  it('adds a batch’s own fields as columns when asked for one batch', async () => {
    const [header, ...data] = rows((await owner.browser.get(`/api/certificates/export?batch=${batchId}`)).text);
    expect(header.slice(9).length).toBeGreaterThanOrEqual(2); // the course and the date at least
    expect(data).toHaveLength(4);
    expect(data.every((r) => r[9 + header.slice(9).findIndex((h) => /course|achievement/i.test(h))] === 'Foundations of Data Analysis')).toBe(true);
  });

  it('shows revocations with their reason', async () => {
    const revoked = await signUpConfirmed('exporter-revoked');
    const { serial } = (await issue(revoked.browser, ['Soon Revoked'])).json.issued[0];
    await revoked.browser.post(`/api/certificates/${serial}/revoke`, { reason: 'Spelling error' });
    const [, row] = rows((await revoked.browser.get('/api/certificates/export')).text);
    expect([row[5], row[7]]).toEqual(['Revoked', 'Spelling error']);
    expect(row[6]).toMatch(/^\d{4}-\d\d-\d\dT/);
  });

  it('never includes another account’s certificates, or lets one ask for their batch', async () => {
    const other = await signUp('exporter-other');
    expect(rows((await other.browser.get('/api/certificates/export')).text)).toHaveLength(1);
    const theirs = await other.browser.get(`/api/certificates/export?batch=${batchId}`);
    expect(theirs.status).toBe(404);
    expect((await owner.browser.get('/api/certificates/export?batch=not-an-id')).status).toBe(404);
  });
});
