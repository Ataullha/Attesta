import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/session';
import { formatDate } from '@/lib/verify';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { AdminAction } from '@/components/app/AdminAction';

const KIND = { mismatch: 'Details don’t match', deindex: 'Remove from search', other: 'Other' } as const;

export default async function AdminReports() {
  await requireAdminPage();
  const rows = await db().select().from(schema.reports).where(eq(schema.reports.status, 'open')).orderBy(desc(schema.reports.createdAt)).limit(200);
  return (
    <>
      <PageTitle title="Reports" />
      {rows.length === 0 ? <p className="text-muted">No open reports.</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`${card} p-4`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px]"><strong>{KIND[r.kind]}</strong> · <Link href={`/verify/${r.serial}`} target="_blank" className="font-mono text-accent underline">{r.serial}</Link> · {formatDate(r.createdAt)}</span>
                <span className="flex gap-1">
                  {r.kind === 'deindex' && r.certificateId && <AdminAction url={`/api/admin/reports/${r.id}`} body={{ action: 'deindex' }} label="Remove from search" tone="good" />}
                  <AdminAction url={`/api/admin/reports/${r.id}`} body={{ action: 'resolve' }} label="Mark resolved" />
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[14.5px] text-ink-2">{r.message}</p>
              {r.contact && <p className="mt-1 text-[13px] text-muted">Contact: {r.contact}</p>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
