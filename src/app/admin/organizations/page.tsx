import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/session';
import { formatDate } from '@/lib/verify';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { AdminAction } from '@/components/app/AdminAction';

export default async function AdminOrgs() {
  await requireAdminPage();
  const rows = await db()
    .select({ o: schema.organizations, email: schema.users.email })
    .from(schema.organizations)
    .innerJoin(schema.users, eq(schema.users.id, schema.organizations.ownerUserId))
    .orderBy(sql`case ${schema.organizations.status} when 'pending' then 0 when 'verified' then 1 else 2 end`, desc(schema.organizations.createdAt))
    .limit(300);
  return (
    <>
      <PageTitle title="Organisations" />
      <p className="-mt-4 mb-6 max-w-[70ch] text-[14.5px] text-ink-2">
        “Pending” means the DNS record was found, so the account controls the domain. Before approving, check the name matches the organisation that owns that domain — a real school should not be verified under someone else’s domain.
      </p>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[820px] text-left text-[14px]">
          <thead><tr className="border-b border-rule text-[13px] text-muted"><th className="px-4 py-3 font-medium">Organisation</th><th className="px-4 py-3 font-medium">Domain</th><th className="px-4 py-3 font-medium">Owner</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-rule">
            {rows.map(({ o, email }) => (
              <tr key={o.id}>
                <td className="px-4 py-3 font-medium">{o.name}<span className="block text-[12.5px] font-normal text-muted">since {formatDate(o.createdAt)}</span></td>
                <td className="px-4 py-3">{o.domain ? <a className="text-accent underline" href={`https://${o.domain}`} target="_blank" rel="noreferrer">{o.domain}</a> : '—'}</td>
                <td className="px-4 py-3">{email}</td>
                <td className="px-4 py-3">{o.status}</td>
                <td className="px-4 py-3">
                  <span className="flex justify-end gap-1">
                    {o.status === 'pending' && <AdminAction url={`/api/admin/orgs/${o.id}`} body={{ action: 'approve' }} label="Approve" tone="good" />}
                    {o.status === 'pending' && <AdminAction url={`/api/admin/orgs/${o.id}`} body={{ action: 'reject' }} label="Reject" tone="bad" ask="Note for the owner" />}
                    {o.status === 'verified' && <AdminAction url={`/api/admin/orgs/${o.id}`} body={{ action: 'unverify' }} label="Remove badge" tone="bad" ask="Reason" />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
