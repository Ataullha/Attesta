import type { Metadata } from 'next';
import { getCertificateView, formatDate, type CertificateView } from '@/lib/verify';
import { normalizeSerial } from '@/lib/signing';
import { site } from '@/lib/site';
import { contactDetails } from '@/lib/contact';
import { capitalised, kindNoun } from '@/lib/design';
import { SealMark } from '@/components/site/SealMark';
import { VerifySearch } from '@/components/site/VerifySearch';
import { JsonLd } from '@/components/site/JsonLd';
import { ShareCertificate } from '@/components/site/ShareCertificate';
import { ContactCardView } from '@/components/site/ContactCardView';
import { InvitationView } from '@/components/site/InvitationView';
import { IssuerValue, RecordValue, Row, VerifyFooter, toneFor } from '@/components/site/VerifyParts';

/** "Valid ID card", "This certificate was revoked" and so on: what the page says it found. */
function stateTitle(v: Pick<CertificateView, 'kind' | 'status'>) {
  const noun = kindNoun(v.kind);
  if (v.status === 'valid') return `Valid ${noun}`;
  if (v.status === 'revoked') return `This ${noun} was revoked`;
  if (v.status === 'expired') return `This ${noun} has expired`;
  return 'The record could not be confirmed';
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: PageProps<'/verify/[serial]'>): Promise<Metadata> {
  const serial = normalizeSerial((await params).serial);
  if (serial.startsWith('GUEST-')) return { title: 'Unregistered guest copy', robots: { index: false } };
  const v = await getCertificateView(serial);
  if (!v) return { title: 'Serial not found', robots: { index: false, follow: false } };
  const robots = v.indexable ? { index: true, follow: true } : { index: false, follow: false };
  const alternates = { canonical: `/verify/${v.serial}` };
  if (v.kind === 'visiting-card') {
    const details = contactDetails(v.fields);
    const title = details.find((d) => d.kind === 'title')?.value;
    const org = details.find((d) => d.kind === 'org')?.value ?? (v.issuer.kind === 'organization' ? v.issuer.name : null);
    return {
      title: [v.recipient, title].filter(Boolean).join(', '),
      description: `${[v.recipient, title].filter(Boolean).join(', ')}${org ? ` at ${org}` : ''}. Contact details from a visiting card issued by ${v.issuer.name}.`,
      alternates,
      robots,
    };
  }
  if (v.kind === 'invitation') {
    return { title: `Invitation for ${v.recipient}`, description: `An invitation from ${v.issuer.name}, issued on ${formatDate(v.issuedAt)}.`, alternates, robots };
  }
  const noun = kindNoun(v.kind);
  const state = v.status === 'valid' ? `Valid ${noun}` : v.status === 'revoked' ? `Revoked ${noun}` : v.status === 'expired' ? `Expired ${noun}` : `${capitalised(noun)} record`;
  return {
    title: `${state} ${v.serial}`,
    description: `${state} issued to ${v.recipient} by ${v.issuer.name} on ${formatDate(v.issuedAt)}.`,
    alternates,
    robots,
  };
}

export default async function VerifyPage({ params }: PageProps<'/verify/[serial]'>) {
  const serial = normalizeSerial((await params).serial);

  if (serial.startsWith('GUEST-')) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20">
        <p className="font-mono text-[14px] text-muted">{serial}</p>
        <h1 className="mt-2 font-display text-[36px] leading-tight">This is an unregistered guest copy</h1>
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
        <h1 className="mt-2 font-display text-[36px] leading-tight">Nothing was issued with this serial</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-2">
          Check each character against the printed serial — serials never use the letters I, L, O or U. If it still doesn’t match, it was not issued through {site.name}.
        </p>
        <VerifySearch className="mt-10" defaultValue={serial} />
      </div>
    );
  }

  if (v.kind === 'visiting-card') return <ContactCardView v={v} />;
  if (v.kind === 'invitation') return <InvitationView v={v} />;

  const noun = kindNoun(v.kind);
  const card = v.kind === 'id-card';
  const tone = toneFor(v.status);

  const url = `${site.url}/verify/${v.serial}`;
  // LinkedIn's "add a certification" form, filled in: the recipient only has to confirm it.
  const linkedInAddUrl = `https://www.linkedin.com/profile/add?${new URLSearchParams({
    startTask: 'CERTIFICATION_NAME',
    name: v.credential,
    organizationName: v.issuer.name,
    issueYear: String(v.issuedAt.getUTCFullYear()),
    issueMonth: String(v.issuedAt.getUTCMonth() + 1),
    certUrl: url,
    certId: v.serial,
  })}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalCredential',
    name: v.credential,
    credentialCategory: 'certificate',
    identifier: v.serial,
    dateCreated: v.issuedAt.toISOString(),
    url,
    recognizedBy: { '@type': v.issuer.kind === 'organization' ? 'Organization' : 'Person', name: v.issuer.name, ...(v.issuer.domain ? { url: `https://${v.issuer.domain}` } : {}) },
  };

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      {v.indexable && !card && <JsonLd data={jsonLd} />}
      <div className={`flex items-start gap-4 rounded-xl border p-5 ${tone.box}`}>
        <SealMark size={44} className={`shrink-0 ${tone.text}`} />
        <div>
          <h1 className={`font-display text-[28px] leading-tight ${tone.text}`}>{stateTitle(v)}</h1>
          <p className="mt-1 text-[15px] text-ink-2">
            {v.status === 'valid' && `Issued by ${v.issuer.name} on ${formatDate(v.issuedAt)}${v.expiresAt ? `, valid until ${formatDate(v.expiresAt)}` : ''}. The signed record matches.`}
            {v.status === 'expired' && v.expiresAt && `It was valid until ${formatDate(v.expiresAt)}. Issued by ${v.issuer.name} on ${formatDate(v.issuedAt)}; the signed record matches.`}
            {v.status === 'revoked' && v.revokedAt && `Revoked on ${formatDate(v.revokedAt)}. Reason given: ${v.revokeReason ?? 'not stated'}.`}
            {v.status === 'unconfirmed' && `The stored record does not match its signature. Do not rely on this ${noun}; contact the issuer.`}
          </p>
        </div>
      </div>

      <dl className="mt-8">
        <Row label="Serial number"><span className="font-mono tracking-wide">{v.serial}</span></Row>
        <Row label={card ? 'Card holder' : 'Awarded to'}>{v.recipient}</Row>
        {v.fields.map((f) => (
          <Row key={f.label} label={f.label}>{f.value}</Row>
        ))}
        <Row label="Issued by"><IssuerValue issuer={v.issuer} /></Row>
        <Row label="Issued on">{formatDate(v.issuedAt)}</Row>
        <Row label="Record"><RecordValue v={v} /></Row>
      </dl>

      <p className="mt-6 text-[14px] leading-relaxed text-muted">
        {site.name} confirms this {noun} was issued by the account above on the date shown. The issuer is responsible for what it {card ? 'states' : 'certifies'}.
        {v.issuer.verified ? ' The issuer proved control of its domain.' : ''}
      </p>

      {v.status === 'valid' && !card && (
        <section aria-labelledby="share-h" className="mt-8">
          <h2 id="share-h" className="text-[15px] font-semibold">Is this your certificate? Share the proof</h2>
          <ShareCertificate url={url} linkedInAddUrl={linkedInAddUrl} />
        </section>
      )}

      <VerifyFooter v={v} />
    </div>
  );
}
