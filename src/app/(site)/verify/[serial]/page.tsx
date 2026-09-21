import type { Metadata } from 'next';
import Link from 'next/link';
import { getCertificateView, formatDate } from '@/lib/verify';
import { normalizeSerial } from '@/lib/signing';
import { site } from '@/lib/site';
import { SealMark } from '@/components/site/SealMark';
import { VerifySearch } from '@/components/site/VerifySearch';
import { ReportForm } from '@/components/site/ReportForm';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/verify/[serial]'>): Promise<Metadata> {
  const serial = normalizeSerial((await params).serial);
  if (serial.startsWith('GUEST-')) return { title: 'Unregistered guest certificate', robots: { index: false } };
  const v = await getCertificateView(serial);
  if (!v) return { title: 'Certificate not found', robots: { index: false, follow: false } };
  const state = v.status === 'valid' ? 'Valid certificate' : v.status === 'revoked' ? 'Revoked certificate' : 'Certificate record';
  return {
    title: `${state} ${v.serial}`,
    description: `${state} issued to ${v.recipient} by ${v.issuer.name} on ${formatDate(v.issuedAt)}.`,
    alternates: { canonical: `/verify/${v.serial}` },
    robots: v.indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-rule py-3.5 sm:grid-cols-[180px_1fr] sm:gap-6">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd className="text-[16px] text-ink">{children}</dd>
    </div>
  );
}

export default async function VerifyPage({ params }: PageProps<'/verify/[serial]'>) {
  const serial = normalizeSerial((await params).serial);

  if (serial.startsWith('GUEST-')) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20">
        <p className="font-mono text-[14px] text-muted">{serial}</p>
        <h1 className="mt-2 font-serif text-[44px] leading-tight">This is an unregistered guest certificate</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
          It was made with {site.name} without an account, so there is no record of who issued it. It cannot be verified. Ask the issuer for a registered copy.
        </p>
        <VerifySearch className="mt-10" />
      </div>
    );
  }

  const v = await getCertificateView(serial);
  if (!v) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20">
        <p className="font-mono text-[14px] text-muted">{serial || 'No serial'}</p>
        <h1 className="mt-2 font-serif text-[44px] leading-tight">No certificate has this serial</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
          Check each character against the printed certificate — serials never use the letters I, L, O or U. If it still doesn’t match, the certificate was not issued through {site.name}.
        </p>
        <VerifySearch className="mt-10" defaultValue={serial} />
      </div>
    );
  }

  const tone =
    v.status === 'valid'
      ? { box: 'border-seal/30 bg-seal-soft', text: 'text-seal', title: 'Valid certificate', color: '#2E6B4F' }
      : v.status === 'revoked'
        ? { box: 'border-revoked/30 bg-revoked-soft', text: 'text-revoked', title: 'This certificate was revoked', color: '#9E3B2B' }
        : { box: 'border-brass/30 bg-brass-soft', text: 'text-brass', title: 'The record could not be confirmed', color: '#8A5D28' };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalCredential',
    name: v.fields[0]?.value ?? 'Certificate',
    credentialCategory: 'certificate',
    identifier: v.serial,
    dateCreated: v.issuedAt.toISOString(),
    url: `${site.url}/verify/${v.serial}`,
    recognizedBy: { '@type': v.issuer.kind === 'organization' ? 'Organization' : 'Person', name: v.issuer.name, ...(v.issuer.domain ? { url: `https://${v.issuer.domain}` } : {}) },
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      {v.indexable && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      <div className={`flex items-start gap-4 border p-5 ${tone.box}`}>
        <SealMark size={44} color={tone.color} className="shrink-0" />
        <div>
          <h1 className={`font-serif text-[34px] leading-tight ${tone.text}`}>{tone.title}</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            {v.status === 'valid' && `Issued by ${v.issuer.name} on ${formatDate(v.issuedAt)}. The signed record matches.`}
            {v.status === 'revoked' && v.revokedAt && `Revoked on ${formatDate(v.revokedAt)}. Reason given: ${v.revokeReason ?? 'not stated'}.`}
            {v.status === 'unconfirmed' && 'The stored record does not match its signature. Do not rely on this certificate; contact the issuer.'}
          </p>
        </div>
      </div>

      <dl className="mt-8">
        <Row label="Serial number"><span className="font-mono tracking-wide">{v.serial}</span></Row>
        <Row label="Awarded to">{v.recipient}</Row>
        {v.fields.map((f) => (
          <Row key={f.label} label={f.label}>{f.value}</Row>
        ))}
        <Row label="Issued by">
          <span className="font-medium">{v.issuer.name}</span>
          {v.issuer.verified ? (
            <span className="ml-2 inline-flex items-center rounded-full bg-seal px-2.5 py-0.5 text-[12.5px] font-medium text-card">Verified organisation</span>
          ) : (
            <span className="ml-2 text-[13.5px] text-muted">{v.issuer.kind === 'organization' ? 'Organisation not verified' : 'Individual account'}</span>
          )}
          {v.issuer.domain && <span className="mt-0.5 block text-[14px] text-muted">Controls the domain {v.issuer.domain}</span>}
        </Row>
        <Row label="Issued on">{formatDate(v.issuedAt)}</Row>
        <Row label="Record">
          <span className="block text-[14px] text-ink-2">Digitally signed by {site.name} (key {v.keyId}).</span>
          <span className="mt-1 block break-all font-mono text-[12px] text-muted">SHA-256 {v.contentHash}</span>
        </Row>
      </dl>

      <p className="mt-6 text-[14px] leading-relaxed text-muted">
        {site.name} confirms this certificate was issued by the account above on the date shown. The issuer is responsible for what it certifies.
        {v.issuer.verified ? ' The issuer proved control of its domain.' : ''}
      </p>

      <details className="mt-10 border-t border-rule pt-6">
        <summary className="cursor-pointer text-[15px] font-medium text-ink-2">Report a problem with this certificate</summary>
        <ReportForm serial={v.serial} />
      </details>

      <div className="mt-12 border-t border-rule pt-8">
        <h2 className="text-[15px] font-semibold">Check another certificate</h2>
        <VerifySearch className="mt-3" />
        <p className="mt-6 text-[14px] text-muted">
          Need to issue certificates like this? <Link href="/" className="text-brass underline-offset-2 hover:underline">{site.name} is free to start</Link>.
        </p>
      </div>
    </div>
  );
}
