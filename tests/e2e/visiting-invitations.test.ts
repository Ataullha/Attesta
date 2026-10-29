import { afterAll, describe, expect, it } from 'vitest';
import { INVITATION_PRESETS, VISITING_CARD_PRESETS, presetDesign } from '@/lib/presets';
import { Browser, closeDb, giveCredits, signUpConfirmed } from './helpers';

afterAll(closeDb);

const robotsOf = (html: string) => [...html.matchAll(/<meta\b[^>]*\bname="robots"[^>]*>/g)].map((m) => m[0].match(/\bcontent="([^"]*)"/)![1]);
// React marks where one piece of text meets the next with <!-- -->, and escapes & in attributes.
const plain = (html: string) => html.replaceAll('<!-- -->', '').replaceAll('&amp;', '&');

const card = { recipient_name: 'Nusrat Jahan', designation: 'Head of Marketing', mobile: '+880 1711-123456', email: 'nusrat@example.com' };
const issueCard = (browser: Browser, values: Record<string, string> = card) =>
  browser.post('/api/issue', { design: presetDesign('corporate-visiting-card'), mode: 'single', batchName: 'Team cards', recipients: [{ values }] });

describe('a visiting card', () => {
  it('opens a contact page with the person’s details to tap, and the company’s that every card shares', async () => {
    const { browser } = await signUpConfirmed('vcard');
    const res = await issueCard(browser);
    expect(res.status, res.text).toBe(200);
    const serial = res.json.issued[0].serial as string;
    const page = plain((await new Browser().get(`/verify/${serial}`)).text);
    expect(page).toMatch(/<h1[^>]*>Nusrat Jahan<\/h1>/);
    expect(page).toContain('Head of Marketing');
    expect(page).toContain(`href="/verify/${serial}/vcard"`);
    expect(page).toContain('href="tel:+8801711123456"');
    expect(page).toContain('href="mailto:nusrat@example.com"');
    // The company and its website and address are typed once in the design, not in every row.
    expect(page).toContain('Your Company Ltd');
    expect(page).toContain('href="https://www.yourcompany.com"');
    expect(page).toContain('https://www.google.com/maps/search/?api=1&query=House%2012%2C%20Road%205%2C%20Dhanmondi%2C%20Dhaka%201205');
    // Links the issuer typed are not endorsements.
    expect(page).toMatch(/href="https:\/\/www\.yourcompany\.com"[^>]*rel="nofollow ugc noopener noreferrer"/);
    expect(robotsOf(page).join(',')).toContain('noindex');
    expect(page).toContain('<title>Nusrat Jahan, Head of Marketing');
  });

  it('saves to a phone as a contact, with each detail where contacts apps expect it', async () => {
    const { browser } = await signUpConfirmed('vcard-save');
    const serial = (await issueCard(browser)).json.issued[0].serial as string;
    const res = await new Browser().get(`/verify/${serial}/vcard`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/vcard; charset=utf-8');
    expect(res.headers.get('content-disposition')).toBe(`attachment; filename="Nusrat-Jahan.vcf"; filename*=UTF-8''Nusrat%20Jahan.vcf`);
    const lines = res.text.split('\r\n');
    expect(lines.slice(0, 4)).toEqual(['BEGIN:VCARD', 'VERSION:3.0', 'N:Jahan;Nusrat;;;', 'FN:Nusrat Jahan']);
    expect(lines).toEqual(
      expect.arrayContaining([
        'ORG:Your Company Ltd',
        'TITLE:Head of Marketing',
        'TEL;TYPE=CELL:+880 1711-123456',
        'EMAIL;TYPE=INTERNET:nusrat@example.com',
        'URL:https://www.yourcompany.com',
        'ADR;TYPE=WORK:;;House 12\\, Road 5\\, Dhanmondi\\, Dhaka 1205;;;;',
        'END:VCARD',
      ]),
    );
  });

  it('stops offering the contact once revoked, and says the card is no longer in use', async () => {
    const { browser } = await signUpConfirmed('vcard-revoked');
    const serial = (await issueCard(browser)).json.issued[0].serial as string;
    expect((await browser.post(`/api/certificates/${serial}/revoke`, { reason: 'Left the company' })).status).toBe(200);
    const page = plain((await new Browser().get(`/verify/${serial}`)).text);
    expect(page).toContain('This card is no longer in use');
    expect(page).toContain('Reason given: Left the company.');
    expect(page).not.toContain('Save contact');
    expect((await new Browser().get(`/verify/${serial}/vcard`)).status).toBe(404);
  });

  it('is the only kind that has a contact to save', async () => {
    const { browser } = await signUpConfirmed('vcard-cert');
    const res = await browser.post('/api/issue', {
      design: presetDesign('classic-ledger'),
      mode: 'single',
      batchName: 'One certificate',
      recipients: [{ values: { recipient_name: 'Arif Hossain', course: 'Bookkeeping', issue_date: '' } }],
    });
    expect((await new Browser().get(`/verify/${res.json.issued[0].serial}/vcard`)).status).toBe(404);
    expect((await new Browser().get('/verify/ATT-0000-0000-0000/vcard')).status).toBe(404);
  });

  it('can be made without an account, as an unregistered guest copy', async () => {
    const res = await issueCard(new Browser());
    expect(res.status, res.text).toBe(200);
    expect(res.json.guest).toBe(true);
  });
});

describe('invitations', () => {
  it('greet each guest by name, share the event’s details, and show at the door that they are genuine', async () => {
    const account = await signUpConfirmed('invite');
    await giveCredits(account.email, 10);
    const res = await account.browser.post('/api/issue', {
      design: presetDesign('wedding-invitation'),
      mode: 'bulk',
      batchName: 'Wedding guests',
      recipients: [
        { values: { recipient_name: 'Mr. & Mrs. Rahman' } },
        // A guest's own value wins over the one every invitation shares.
        { values: { recipient_name: 'Karim Uddin and family', venue: 'Bashundhara Convention Center, Dhaka' } },
      ],
    });
    expect(res.status, res.text).toBe(200);
    const [first, second] = (res.json.issued as { serial: string }[]).map((i) => i.serial);

    const page = plain((await new Browser().get(`/verify/${first}`)).text);
    expect(page).toContain('Genuine invitation');
    expect(page).toContain('Invitation for');
    expect(page).toContain('Mr. & Mrs. Rahman');
    expect(page).toContain('The wedding of Ayesha and Rahim');
    expect(page).toContain('Friday, 11 December 2026 at 7:00 pm');
    expect(page).toContain('https://www.google.com/maps/search/?api=1&query=Senamalancha%2C%20Dhaka%20Cantonment');
    expect(page).toContain('<title>Invitation for Mr. & Mrs. Rahman');
    expect(robotsOf(page).join(',')).toContain('noindex');
    expect(plain((await new Browser().get(`/verify/${second}`)).text)).toContain('Bashundhara Convention Center, Dhaka');

    const batch = await account.browser.get(`/api/batches/${res.json.batchId}`);
    expect(batch.json.design.kind).toBe('invitation');
    const dashboard = plain((await account.browser.get('/app')).text);
    expect(dashboard).toContain('2 invitations');
    expect(dashboard).toContain('Invitation · Wedding guests');
  });

  it('say so once withdrawn', async () => {
    const { browser } = await signUpConfirmed('invite-withdrawn');
    const res = await browser.post('/api/issue', { design: presetDesign('event-invitation'), mode: 'single', batchName: 'Dinner', recipients: [{ values: { recipient_name: 'Tanvir Ahmed' } }] });
    const serial = res.json.issued[0].serial as string;
    await browser.post(`/api/certificates/${serial}/revoke`, { reason: 'Event cancelled' });
    const page = plain((await new Browser().get(`/verify/${serial}`)).text);
    expect(page).toContain('This invitation was withdrawn');
    expect(page).toContain('Reason given: Event cancelled.');
  });
});

describe('the visiting card and invitation pages', () => {
  it.each([
    ['/visiting-card-maker', 'Visiting cards for your whole team', '/create?preset=corporate-visiting-card'],
    ['/invitation-card-maker', 'Invitations with every guest’s name', '/create?preset=wedding-invitation'],
  ])('%s explains them, and is linked from the header menu', async (path, heading, start) => {
    const page = (await new Browser().get(path)).text;
    expect(page).toContain(heading);
    expect(page).toContain(`href="${start}"`);
    expect(page).toContain('"@type":"FAQPage"');
    expect((await new Browser().get('/pricing')).text).toContain(`href="${path}"`);
  });

  it('list every template of each kind, each opening in the editor', async () => {
    const templates = (await new Browser().get('/templates')).text;
    expect(templates).toContain('id="visiting-cards"');
    expect(templates).toContain('id="invitations"');
    for (const [presets, noun] of [[VISITING_CARD_PRESETS, 'visiting card'], [INVITATION_PRESETS, 'invitation']] as const) {
      for (const p of presets) {
        expect(templates).toContain(`href="/templates/${p.slug}"`);
        const detail = await new Browser().get(`/templates/${p.slug}`);
        expect(detail.status).toBe(200);
        expect(detail.text).toContain(`<title>${p.name.replace(/&/g, '&amp;')} ${noun} template`);
        expect(detail.text).toContain(`href="/create?preset=${p.slug}"`);
      }
    }
  });

  it.each([
    ['blank-visiting-card', 'Visiting card editor'],
    ['blank-invitation', 'Invitation editor'],
    ['wedding-invitation', 'Invitation editor'],
  ])('open %s in the editor', async (preset, title) => {
    const res = await new Browser().get(`/create?preset=${preset}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain(title);
  });
});
