import { ImageResponse } from 'next/og';
import { getCertificateView, formatDate } from '@/lib/verify';
import { site } from '@/lib/site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Certificate verification';

export default async function Image({ params }: { params: Promise<{ serial: string }> }) {
  const { serial } = await params;
  const v = await getCertificateView(serial).catch(() => null);
  const color = !v ? '#6B6455' : v.status === 'valid' ? '#2E6B4F' : v.status === 'revoked' ? '#9E3B2B' : '#8A5D28';
  const title = !v ? 'Certificate not found' : v.status === 'valid' ? 'Valid certificate' : v.status === 'revoked' ? 'Revoked certificate' : 'Unconfirmed record';
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#FFFDFA', padding: 72, borderTop: `20px solid ${color}` }}>
        <div style={{ display: 'flex', fontSize: 30, color: '#8A5D28' }}>{site.name} verification</div>
        <div style={{ display: 'flex', fontSize: 84, color, marginTop: 40 }}>{title}</div>
        {v && <div style={{ display: 'flex', fontSize: 40, color: '#191712', marginTop: 24 }}>{`${v.recipient} · ${v.issuer.name}`}</div>}
        {v && <div style={{ display: 'flex', fontSize: 30, color: '#4A4438', marginTop: 16 }}>{`Issued ${formatDate(v.issuedAt)}`}</div>}
        <div style={{ display: 'flex', fontSize: 30, color: '#6B6455', marginTop: 'auto' }}>{serial.toUpperCase().slice(0, 40)}</div>
      </div>
    ),
    size,
  );
}
