import { ImageResponse } from 'next/og';
import { getCertificateView, formatDate } from '@/lib/verify';
import { contactDetails } from '@/lib/contact';
import { kindNoun } from '@/lib/design';
import { site } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Verification';

/** What a shared link to the page shows: the state for documents, the person for a visiting card, the guest for an invitation. */
function lines(v: NonNullable<Awaited<ReturnType<typeof getCertificateView>>>) {
  if (v.kind === 'visiting-card') {
    const details = contactDetails(v.fields);
    const title = details.find((d) => d.kind === 'title')?.value;
    const org = details.find((d) => d.kind === 'org')?.value ?? (v.issuer.kind === 'organization' ? v.issuer.name : null);
    return { heading: `${site.name} contact card`, title: v.recipient, sub: [title, org].filter(Boolean).join(' · '), foot: '' };
  }
  if (v.kind === 'invitation') return { heading: `${site.name} invitation`, title: `Invitation for ${v.recipient}`, sub: `From ${v.issuer.name}`, foot: '' };
  const noun = kindNoun(v.kind);
  const title = v.status === 'valid' ? `Valid ${noun}` : v.status === 'revoked' ? `Revoked ${noun}` : v.status === 'expired' ? `Expired ${noun}` : 'Unconfirmed record';
  return { heading: `${site.name} verification`, title, sub: `${v.recipient} · ${v.issuer.name}`, foot: `Issued ${formatDate(v.issuedAt)}` };
}

export default async function Image({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const v = await getCertificateView(serial).catch(() => null);
  const color = !v ? '#64748B' : v.status === 'valid' ? '#047857' : v.status === 'revoked' ? '#B91C1C' : '#B45309';
  const t = v ? lines(v) : { heading: `${site.name} verification`, title: 'Serial not found', sub: '', foot: '' };
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#FFFFFF', padding: 72, borderTop: `20px solid ${color}` }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#2563EB' }}>{t.heading}</div>
        <div style={{ display: 'flex', fontSize: 84, color: v?.kind === 'visiting-card' || v?.kind === 'invitation' ? '#0F172A' : color, marginTop: 40 }}>{t.title}</div>
        {t.sub && <div style={{ display: 'flex', fontSize: 40, color: '#334155', marginTop: 24 }}>{t.sub}</div>}
        {t.foot && <div style={{ display: 'flex', fontSize: 30, color: '#334155', marginTop: 16 }}>{t.foot}</div>}
        <div style={{ display: 'flex', fontSize: 30, color: '#64748B', marginTop: 'auto' }}>{serial.toUpperCase().slice(0, 40)}</div>
      </div>
    ),
    size,
  );
}
