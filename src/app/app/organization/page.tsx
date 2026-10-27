import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { DnsCheck, OrgForm } from '@/components/app/OrgForms';

const STATUS = {
  unverified: { label: 'Not verified', cls: 'bg-rule text-ink-2' },
  pending: { label: 'DNS confirmed, waiting for review', cls: 'bg-warn-soft text-warn' },
  verified: { label: 'Verified', cls: 'bg-seal text-card' },
  rejected: { label: 'Not approved', cls: 'bg-revoked-soft text-revoked' },
} as const;

export default async function OrganizationPage() {
  const user = await requireUserPage('/app/organization');
  const [org] = await db().select().from(schema.organizations).where(eq(schema.organizations.ownerUserId, user.id)).limit(1);
  const s = org ? STATUS[org.status] : null;

  return (
    <>
      <PageTitle title="Organisation" />
      <div className="grid max-w-5xl gap-8 lg:grid-cols-[1fr_1fr]">
        <section className={`${card} p-6`}>
          <p className="mb-5 text-[15px] leading-relaxed text-ink-2">
            Certificates you issue show this name as the issuer. Without an organisation, your own name is shown.
          </p>
          {!user.emailVerified ? (
            <p className="text-revoked">Confirm your email address first.</p>
          ) : (
            <OrgForm initial={{ name: org?.name ?? '', domain: org?.domain ?? '', website: org?.website ?? '' }} />
          )}
        </section>

        {org && (
          <section className={`${card} p-6`}>
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-[24px] leading-none">Verified badge</h2>
              {s && <span className={`rounded-full px-3 py-1 text-[13px] ${s.cls}`}>{s.label}</span>}
            </div>
            {org.status === 'verified' ? (
              <p className="mt-4 text-[15px] leading-relaxed text-ink-2">Your verification pages show “Verified organisation” and your domain {org.domain}.</p>
            ) : !org.domain ? (
              <p className="mt-4 text-[15px] leading-relaxed text-ink-2">Add your domain on the left to start.</p>
            ) : (
              <>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-2">Prove you control <strong>{org.domain}</strong> by adding this TXT record where you manage its DNS (your domain registrar or Cloudflare):</p>
                <dl className="mt-4 space-y-2 rounded-lg border border-rule bg-paper p-4 text-[14px]">
                  <div><dt className="text-muted">Type</dt><dd className="font-mono">TXT</dd></div>
                  <div><dt className="text-muted">Name / host</dt><dd className="break-all font-mono">_attesta</dd></div>
                  <div><dt className="text-muted">Value</dt><dd className="break-all font-mono">attesta-verify={org.dnsToken}</dd></div>
                </dl>
                <p className="mt-3 text-[13.5px] text-muted">Some providers want the full name, <span className="font-mono">_attesta.{org.domain}</span>. Changes can take up to an hour to appear.</p>
                {org.status !== 'pending' && <div className="mt-5"><DnsCheck /></div>}
                {org.status === 'pending' && <p className="mt-5 text-[14.5px] text-ink-2">We found your record. An admin will review your organisation shortly.</p>}
                {org.status === 'rejected' && org.reviewNote && <p className="mt-4 text-[14px] text-revoked">Reviewer note: {org.reviewNote}</p>}
              </>
            )}
          </section>
        )}
      </div>
    </>
  );
}
