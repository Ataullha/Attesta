import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/session';
import { normalizeSerial } from '@/lib/signing';
import { formatDate } from '@/lib/verify';
import { btn, card, field } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { AdminAction } from '@/components/app/AdminAction';

export default async function AdminCertificates({ searchParams }: PageProps<'/admin/certificates'>) {
  await requireAdminPage();
  const serial = normalizeSerial(String((await searchParams).serial ?? ''));
  const [row] = serial
    ? await db()
        .select({ c: schema.certificates, email: schema.users.email })
        .from(schema.certificates)
        .innerJoin(schema.users, eq(schema.users.id, schema.certificates.userId))
        .where(eq(schema.certificates.serial, serial))
        .limit(1)
    : [];
  return (
    <>
      <PageTitle title="Certificates" />
      <form className="mb-6 flex max-w-md gap-2" role="search">
        <input name="serial" defaultValue={serial} placeholder="ATT-XXXX-XXXX-XXXX" className={field.input + ' font-mono uppercase'} aria-label="Serial" />
        <button className={btn.secondary}>Find</button>
      </form>
      {serial && !row && <p className="text-muted">No certificate with that serial.</p>}
      {row && (
        <div className={`${card} max-w-2xl p-5 text-[14.5px]`}>
          <p className="font-mono">{row.c.serial}</p>
          <p className="mt-2">Recipient: <strong>{row.c.recipientName}</strong></p>
          <p>Issued by {row.email} on {formatDate(row.c.issuedAt)}</p>
          <p>Status: {row.c.revokedAt ? `revoked — ${row.c.revokeReason}` : 'valid'}{row.c.deindexed ? ' · removed from search' : ''}</p>
          <pre className="mt-3 max-h-52 overflow-auto rounded bg-paper p-3 font-mono text-[12px]">{JSON.stringify(row.c.values, null, 2)}</pre>
          <div className="mt-4 flex gap-2">
            <Link href={`/verify/${row.c.serial}`} target="_blank" className={btn.small + ' border border-rule-2'}>Open public page</Link>
            {!row.c.revokedAt && <AdminAction url={`/api/admin/certificates/${row.c.serial}`} body={{ action: 'revoke' }} label="Revoke" tone="bad" ask="Reason, shown publicly" askMin={3} />}
          </div>
        </div>
      )}
    </>
  );
}
