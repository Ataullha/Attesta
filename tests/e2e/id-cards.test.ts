import { afterAll, describe, expect, it } from 'vitest';
import { presetDesign } from '@/lib/presets';
import { ID_CARD_PRESETS } from '@/lib/presets';
import { Browser, closeDb, giveCredits, signUpConfirmed, sql } from './helpers';

afterAll(closeDb);

const card = (slug = 'club-member-card') => presetDesign(slug);
const member = (values: Record<string, string>) => ({ values: { recipient_name: 'Nusrat Jahan', role: 'General member', member_id: 'M1001', photo: 'M1001.jpg', ...values } });
const issueCard = (browser: Browser, values: Record<string, string> = {}, design: unknown = card()) =>
  browser.post('/api/issue', { design, mode: 'single', batchName: 'Club cards', recipients: [member(values)] });
const robotsOf = (html: string) => [...html.matchAll(/<meta\b[^>]*\bname="robots"[^>]*>/g)].map((m) => m[0].match(/\bcontent="([^"]*)"/)![1]);

describe('an ID card', () => {
  it('has a verification page that calls it an ID card, with its holder and the date it is valid until', async () => {
    const { browser } = await signUpConfirmed('card');
    const res = await issueCard(browser, { valid_until: '31/12/2099' });
    expect(res.status, res.text).toBe(200);
    const page = await new Browser().get(`/verify/${res.json.issued[0].serial}`);
    expect(page.text).toContain('Valid ID card');
    expect(page.text).toContain('Card holder');
    expect(page.text).toContain('Nusrat Jahan'); // ID cards show the full name
    expect(page.text).toContain('valid until 31 December 2099');
    expect(page.text).toContain('General member');
    // The photo is never part of the public record, and an ID card is no LinkedIn credential.
    expect(page.text).not.toContain('M1001.jpg');
    expect(page.text).not.toContain('linkedin.com/profile/add');
    expect(robotsOf(page.text).join(',')).toContain('noindex');
  });

  it('says so once the date it was valid until has passed', async () => {
    const { browser } = await signUpConfirmed('card-expired');
    const res = await issueCard(browser, { valid_until: '1 January 2020' });
    expect(res.status, res.text).toBe(200);
    const page = await new Browser().get(`/verify/${res.json.issued[0].serial}`);
    expect(page.text).toContain('This ID card has expired');
    expect(page.text).toContain('It was valid until 1 January 2020');
    expect((await browser.get('/app')).text).toContain('Expired');
  });

  it('is refused, with the reason, when its valid-until date is not a date', async () => {
    const { browser } = await signUpConfirmed('card-baddate');
    const res = await issueCard(browser, { valid_until: 'when membership ends' });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('Recipient 1: Valid until must be a date, such as 31 December 2026 or 2026-12-31');
  });

  it('cannot fill a photo frame from a field that is not a photo', async () => {
    const { browser } = await signUpConfirmed('card-badframe');
    const design = card();
    const frame = design.elements.find((e) => e.type === 'photo') as { field: string };
    frame.field = 'role';
    const res = await issueCard(browser, {}, design);
    expect(res.status).toBe(400);
    expect(res.json.error).toContain('A photo frame uses "role", which is not a photo field');
  });

  it('can be made without an account, as an unregistered guest copy', async () => {
    const res = await issueCard(new Browser(), { valid_until: 'December 2099' }, card('staff-id-card'));
    expect(res.status, res.text).toBe(200);
    expect(res.json.guest).toBe(true);
  });

  it('keeps the file name of each photo for its owner, to match the photo again on a later download', async () => {
    const account = await signUpConfirmed('card-batch');
    await giveCredits(account.email, 20);
    const res = await account.browser.post('/api/issue', {
      design: card('student-id-card'),
      mode: 'bulk',
      batchName: 'Students 2026',
      recipients: [
        { values: { recipient_name: 'Farhan Kabir', class: 'BBA', roll: '117', photo: 'students/117.jpg', valid_until: '30 June 2099' } },
        { values: { recipient_name: 'Sadia Islam', class: 'BBA', roll: '118', photo: '118.png', valid_until: '30 June 2099' } },
      ],
    });
    expect(res.status, res.text).toBe(200);
    const batch = await account.browser.get(`/api/batches/${res.json.batchId}`);
    expect(batch.json.design.kind).toBe('id-card');
    // Cards issued in one request share their time of issue, so the batch lists them in no fixed order.
    expect(batch.json.certificates.map((c: { values: Record<string, string> }) => c.values.photo).sort()).toEqual(['117.jpg', '118.png']);
    expect((await new Browser().get(`/api/batches/${res.json.batchId}`)).status).toBe(401);
    // Listed as ID cards. (React marks where one piece of text meets the next with <!-- -->.)
    const dashboard = (await account.browser.get('/app')).text.replaceAll('<!-- -->', '');
    expect(dashboard).toContain('2 ID cards');
    expect(dashboard).toContain('ID card · Students 2026');
    const [{ expires_at }] = await sql()`select expires_at from certificates where batch_id = ${res.json.batchId} limit 1`;
    expect(new Date(expires_at).toISOString()).toBe('2099-06-30T17:59:59.000Z');
  });
});

describe('the ID card pages', () => {
  it('explain ID cards, and are linked from the header', async () => {
    const page = (await new Browser().get('/id-card-maker')).text;
    expect(page).toContain('ID cards for clubs, schools and organisations');
    expect(page).toContain('href="/create?preset=club-member-card"');
    expect(page).toContain('"@type":"FAQPage"');
    expect((await new Browser().get('/')).text).toContain('href="/id-card-maker"');
  });

  it('list every ID card template apart from the certificates, each opening in the editor', async () => {
    const templates = (await new Browser().get('/templates')).text;
    expect(templates).toContain('id="id-cards"');
    for (const p of ID_CARD_PRESETS) {
      expect(templates).toContain(`href="/templates/${p.slug}"`);
      const detail = await new Browser().get(`/templates/${p.slug}`);
      expect(detail.status).toBe(200);
      expect(detail.text).toContain(`<title>${p.name.replace(/&/g, '&amp;')} ID card template`);
      expect(detail.text).toContain(`href="/create?preset=${p.slug}"`);
    }
  });

  it('open a blank ID card in the editor', async () => {
    const res = await new Browser().get('/create?preset=blank-id-card');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ID card editor');
  });
});
