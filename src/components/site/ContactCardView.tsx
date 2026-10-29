import { contactDetails } from '@/lib/contact';
import { firstLetter } from '@/lib/design';
import { formatDate, type CertificateView } from '@/lib/verify';
import { btn } from '@/components/ui/styles';
import { SealMark } from './SealMark';
import { DetailValue, IssuerValue, RecordValue, Row, VerifyFooter, toneFor } from './VerifyParts';

/**
 * A visiting card's page: the card holder as a contact, with "Save contact" for a phone's address
 * book, and the details to tap. The facts that prove it (issuer, date, signed record) come after.
 */
export function ContactCardView({ v }: { v: CertificateView }) {
  const details = contactDetails(v.fields);
  const first = (kind: string) => details.find((d) => d.kind === kind);
  const title = first('title')?.value;
  const org = first('org')?.value ?? (v.issuer.kind === 'organization' ? v.issuer.name : null);
  const department = first('department')?.value;
  const phone = first('phone');
  const email = first('email');
  const rest = details.filter((d) => d.kind !== 'title' && d.kind !== 'org' && d.kind !== 'department');
  const live = v.status === 'valid';
  const tone = toneFor(v.status);

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      {!live && (
        <div className={`mb-6 flex items-start gap-3 rounded-xl border p-4 ${tone.box}`}>
          <SealMark size={30} className={`mt-0.5 shrink-0 ${tone.text}`} />
          <p className={`text-[15px] leading-relaxed ${tone.text}`}>
            {v.status === 'revoked' && (
              <>
                <span className="block font-semibold">This card is no longer in use</span>
                {v.revokedAt && `Withdrawn by ${v.issuer.name} on ${formatDate(v.revokedAt)}. Reason given: ${v.revokeReason ?? 'not stated'}.`}
              </>
            )}
            {v.status === 'expired' && (
              <>
                <span className="block font-semibold">This card has expired</span>
                {v.expiresAt && `It was valid until ${formatDate(v.expiresAt)}.`}
              </>
            )}
            {v.status === 'unconfirmed' && (
              <>
                <span className="block font-semibold">The record could not be confirmed</span>
                The stored record does not match its signature. Do not rely on these details; contact the issuer.
              </>
            )}
          </p>
        </div>
      )}

      <section aria-labelledby="holder" className="rounded-2xl border border-rule bg-card p-6 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.5)] sm:p-8">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-[28px] text-accent">
            {firstLetter(v.recipient)}
          </span>
          <div className="min-w-0">
            <h1 id="holder" className="break-words font-display text-[30px] leading-tight">{v.recipient}</h1>
            {title && <p className="mt-0.5 text-[16.5px] text-ink-2">{title}</p>}
            {(org || department) && <p className="text-[15px] text-muted">{[org, department].filter(Boolean).join(' · ')}</p>}
          </div>
        </div>

        {live && (
          <div className="mt-6 flex flex-wrap gap-2">
            {/* A plain link: the browser hands the .vcf to the phone's contacts app. */}
            <a href={`/verify/${v.serial}/vcard`} className={btn.primary}>Save contact</a>
            {phone?.href && <a href={phone.href} className={btn.secondary}>Call</a>}
            {email?.href && <a href={email.href} className={btn.secondary}>Email</a>}
          </div>
        )}

        {rest.length > 0 && (
          <dl className="mt-6 divide-y divide-rule border-t border-rule">
            {rest.map((d, i) => (
              <div key={`${d.label}-${i}`} className="grid gap-0.5 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
                <dt className="text-[14px] text-muted">{d.label}</dt>
                <dd className="break-words text-[16px]"><DetailValue detail={d} /></dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {live && (
        <p className="mt-5 flex items-start gap-2.5 text-[14.5px] leading-relaxed text-ink-2">
          <SealMark size={22} className="mt-0.5 shrink-0 text-seal" />
          <span>
            A genuine card, issued by {v.issuer.name} on {formatDate(v.issuedAt)}. The signed record matches.
          </span>
        </p>
      )}

      <details className="mt-8 border-t border-rule pt-5">
        <summary className="cursor-pointer text-[15px] font-medium text-ink-2">About this card</summary>
        <dl className="mt-2">
          <Row label="Serial number"><span className="font-mono tracking-wide">{v.serial}</span></Row>
          <Row label="Issued by"><IssuerValue issuer={v.issuer} /></Row>
          <Row label="Issued on">{formatDate(v.issuedAt)}</Row>
          <Row label="Record"><RecordValue v={v} /></Row>
        </dl>
      </details>

      <VerifyFooter v={v} />
    </div>
  );
}
