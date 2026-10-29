import { contactDetails } from '@/lib/contact';
import { formatDate, type CertificateView } from '@/lib/verify';
import { SealMark } from './SealMark';
import { DetailValue, RecordRows, Row, VerifyFooter, toneFor } from './VerifyParts';

/**
 * An invitation's page. Whoever checks guests at the door sees at once that it is genuine and whom
 * it is for; the guest sees the details again, with the venue on a map and a number to call.
 */
export function InvitationView({ v }: { v: CertificateView }) {
  const tone = toneFor(v.status);
  const details = contactDetails(v.fields);
  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <div className={`flex items-start gap-3 rounded-xl border p-4 ${tone.box}`}>
        <SealMark size={32} className={`mt-0.5 shrink-0 ${tone.text}`} />
        <p className={`text-[15px] leading-relaxed ${tone.text}`}>
          <span className="block text-[17px] font-semibold">
            {v.status === 'valid' && 'Genuine invitation'}
            {v.status === 'revoked' && 'This invitation was withdrawn'}
            {v.status === 'expired' && 'This invitation has expired'}
            {v.status === 'unconfirmed' && 'The record could not be confirmed'}
          </span>
          {v.status === 'valid' && `Issued by ${v.issuer.name} on ${formatDate(v.issuedAt)}${v.expiresAt ? `, valid until ${formatDate(v.expiresAt)}` : ''}. The signed record matches.`}
          {v.status === 'revoked' && v.revokedAt && `Withdrawn on ${formatDate(v.revokedAt)}. Reason given: ${v.revokeReason ?? 'not stated'}.`}
          {v.status === 'expired' && v.expiresAt && `It was valid until ${formatDate(v.expiresAt)}.`}
          {v.status === 'unconfirmed' && 'The stored record does not match its signature. Do not rely on this invitation; contact the host.'}
        </p>
      </div>

      <p className="mt-10 font-mono text-[12.5px] uppercase tracking-[0.12em] text-accent">Invitation for</p>
      <h1 className="mt-1 break-words font-display text-[36px] leading-tight">{v.recipient}</h1>
      <p className="mt-1 text-[16px] text-ink-2">From {v.issuer.name}</p>

      {details.length > 0 && (
        <dl className="mt-8 border-t border-rule">
          {details.map((d, i) => (
            <Row key={`${d.label}-${i}`} label={d.label}>
              <DetailValue detail={d} />
            </Row>
          ))}
        </dl>
      )}

      <details className="mt-8 border-t border-rule pt-5">
        <summary className="cursor-pointer text-[15px] font-medium text-ink-2">About this invitation</summary>
        <dl className="mt-2">
          <RecordRows v={v} />
        </dl>
      </details>

      <VerifyFooter v={v} />
    </div>
  );
}
