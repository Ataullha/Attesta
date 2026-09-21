import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

export const alt = `${site.name} — certificates anyone can check in one scan`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#F7F4EE', padding: 72, border: '14px solid #191712' }}>
        <div style={{ display: 'flex', fontSize: 34, color: '#8A5D28' }}>{site.name}</div>
        <div style={{ display: 'flex', fontSize: 78, lineHeight: 1.05, color: '#191712', maxWidth: 900 }}>Certificates anyone can check in one scan.</div>
        <div style={{ display: 'flex', fontSize: 28, color: '#4A4438' }}>Templates · your own design · bulk from CSV · QR verification</div>
      </div>
    ),
    size,
  );
}
