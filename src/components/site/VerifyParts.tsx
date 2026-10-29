import Link from 'next/link';
import type { ContactDetail } from '@/lib/contact';
import { KINDS, kindNoun } from '@/lib/design';
import { formatMoney, packages, site } from '@/lib/site';
import { formatDate, type CertificateView } from '@/lib/verify';
import { btn } from '@/components/ui/styles';
import { ReportForm } from './ReportForm';
import { VerifySearch } from './VerifySearch';

/** Pieces every kind of verification page shares: a certificate's, an ID card's, a contact card's, an invitation's. */

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-rule py-3.5 sm:grid-cols-[180px_1fr] sm:gap-6">
      <dt className="text-[14px] text-muted">{label}</dt>
      <dd className="break-words text-[16px] text-ink">{children}</dd>
    </div>
  );
}

/** A detail as a link when it is one: a phone number to call, an address to find on a map. */
export function DetailValue({ detail }: { detail: ContactDetail }) {
  if (!detail.href) return <>{detail.value}</>;
  // Issuers type these links, so search engines are told not to follow them as endorsements.
  const external = /^https?:/.test(detail.href);
  return (
    <a
      href={detail.href}
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
      {...(external ? { target: '_blank', rel: 'nofollow ugc noopener noreferrer' } : {})}
    >
      {detail.value}
    </a>
  );
}

export function IssuerValue({ issuer }: { issuer: CertificateView['issuer'] }) {
  return (
    <>
      <span className="font-medium">{issuer.name}</span>
      {issuer.verified ? (
        <span className="ml-2 inline-flex items-center rounded-full bg-seal px-2.5 py-0.5 text-[12.5px] font-medium text-card">Verified organisation</span>
      ) : (
        <span className="ml-2 text-[13.5px] text-muted">{issuer.kind === 'organization' ? 'Organisation not verified' : 'Individual account'}</span>
      )}
      {issuer.domain && <span className="mt-0.5 block text-[14px] text-muted">Controls the domain {issuer.domain}</span>}
    </>
  );
}

export function RecordValue({ v }: { v: CertificateView }) {
  return (
    <>
      <span className="block text-[14px] text-ink-2">Digitally signed by {site.name} (key {v.keyId}).</span>
      <span className="mt-1 block break-all font-mono text-[12px] text-muted">SHA-256 {v.contentHash}</span>
    </>
  );
}

/** Serial, issuer, date and the signed record, the facts behind the page. */
export function RecordRows({ v }: { v: CertificateView }) {
  return (
    <>
      <Row label="Serial number"><span className="font-mono tracking-wide">{v.serial}</span></Row>
      <Row label="Issued by"><IssuerValue issuer={v.issuer} /></Row>
      <Row label="Issued on">{formatDate(v.issuedAt)}</Row>
      <Row label="Record"><RecordValue v={v} /></Row>
    </>
  );
}

/** Green when valid, red when revoked, amber otherwise. */
export function toneFor(status: CertificateView['status']) {
  return status === 'valid'
    ? { box: 'border-seal/30 bg-seal-soft', text: 'text-seal' }
    : status === 'revoked'
      ? { box: 'border-revoked/30 bg-revoked-soft', text: 'text-revoked' }
      : { box: 'border-warn/30 bg-warn-soft', text: 'text-warn' };
}

const CTA: Record<CertificateView['kind'], { title: string; body: string }> = {
  certificate: {
    title: 'Issue certificates people can check like this',
    body: 'Give every certificate your organisation issues a page like this one, with a QR code that opens it.',
  },
  'id-card': {
    title: 'Make ID cards people can check like this',
    body: 'Give every ID card your organisation issues a page like this one, with a QR code that opens it.',
  },
  'visiting-card': {
    title: 'Make visiting cards for your whole team',
    body: 'One design, a card for everyone from a spreadsheet, and a QR code on each that saves the contact to a phone.',
  },
  invitation: {
    title: 'Make invitations with every guest’s name',
    body: 'Design one invitation, add your guest list, and download a personal invitation for each guest to print or send.',
  },
};

/** Report a problem, check another serial, and make your own: the end of every verification page. */
export function VerifyFooter({ v }: { v: CertificateView }) {
  const cta = CTA[v.kind];
  return (
    <>
      <details className="mt-10 border-t border-rule pt-6">
        <summary className="cursor-pointer text-[15px] font-medium text-ink-2">Report a problem with this {kindNoun(v.kind)}</summary>
        <ReportForm serial={v.serial} />
      </details>

      <div className="mt-12 border-t border-rule pt-8">
        <h2 className="text-[15px] font-semibold">Check another serial</h2>
        <VerifySearch className="mt-3" />
      </div>

      {v.status !== 'unconfirmed' && (
        <section aria-labelledby="issue-h" className="mt-12 rounded-xl border border-rule bg-card p-6">
          <h2 id="issue-h" className="font-display text-[24px] leading-tight">{cta.title}</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            {cta.body} Free to start, with packages from {formatMoney(packages[0].price)} for bulk issuing.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={v.kind === 'certificate' ? '/' : KINDS[v.kind].landing} className={btn.primary}>See how it works</Link>
            <Link href="/pricing" className={btn.secondary}>Pricing</Link>
          </div>
        </section>
      )}
    </>
  );
}
