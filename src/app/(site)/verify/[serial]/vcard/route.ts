import { getCertificateView } from '@/lib/verify';
import { contactDetails, vcard } from '@/lib/contact';
import { HttpError, route } from '@/lib/security/request';

type Ctx = { params: Promise<{ serial: string }> };

/** A visiting card's holder as a contact (a .vcf file), for "Save contact" on the card's page. */
export const GET = route<Ctx>(async (_req, ctx) => {
  const v = await getCertificateView((await ctx.params).serial);
  // Only a card in use: once revoked, its details are no longer its holder's to hand out.
  if (!v || v.kind !== 'visiting-card' || v.status !== 'valid') throw new HttpError(404, 'No visiting card in use has this serial.');
  const body = vcard({ name: v.recipient, details: contactDetails(v.fields), org: v.issuer.kind === 'organization' ? v.issuer.name : null });
  const ascii = v.recipient.normalize('NFKD').replace(/[^\w .-]+/g, '').trim().replace(/\s+/g, '-') || 'contact';
  return new Response(body, {
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      // The plain name for old browsers, the real one (Bangla included) for the rest.
      'Content-Disposition': `attachment; filename="${ascii}.vcf"; filename*=UTF-8''${encodeURIComponent(v.recipient)}.vcf`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
});
