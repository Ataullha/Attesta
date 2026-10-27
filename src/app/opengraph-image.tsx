import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

export const alt = `${site.name} — certificates anyone can check in one scan`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#F8FAFC', padding: 72, borderTop: '18px solid #2563EB' }}>
        <div style={{ display: 'flex', fontSize: 34, color: '#2563EB' }}>{site.name}</div>
        <div style={{ display: 'flex', fontSize: 76, lineHeight: 1.08, color: '#0F172A', maxWidth: 960 }}>Certificates anyone can check in one scan.</div>
        <div style={{ display: 'flex', fontSize: 28, color: '#334155' }}>Templates · your own design · bulk from CSV · QR verification</div>
      </div>
    ),
    size,
  );
}
