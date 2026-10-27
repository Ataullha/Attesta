import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { VerifySearch } from '@/components/site/VerifySearch';
import { normalizeSerial } from '@/lib/signing';

export const metadata: Metadata = {
  title: 'Verify a certificate',
  description: 'Check whether a certificate is genuine. Enter the serial number printed on it or scan its QR code.',
  alternates: { canonical: '/verify' },
};

export default async function VerifyIndex({ searchParams }: PageProps<'/verify'>) {
  const sp = await searchParams;
  const raw = typeof sp.serial === 'string' ? sp.serial : '';
  if (raw) redirect(`/verify/${encodeURIComponent(normalizeSerial(raw))}`);
  return (
    <div className="mx-auto max-w-2xl px-5 py-20">
      <h1 className="font-display text-[40px] leading-tight">Verify a certificate</h1>
      <p className="mt-3 text-[17px] text-ink-2">
        Enter the serial number printed near the QR code. It looks like <span className="font-mono text-[15px]">ATT-7K2Q-9M4D-X1TB</span>.
      </p>
      <VerifySearch className="mt-8" />
      <p className="mt-6 text-[14.5px] text-muted">Scanning the QR code on the certificate opens its page directly.</p>
    </div>
  );
}
