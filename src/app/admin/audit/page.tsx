import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/session';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';

export default async function AdminAudit() {
  await requireAdminPage();
  const rows = await db()
    .select({ a: schema.auditLogs, email: schema.users.email })
    .from(schema.auditLogs)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLogs.actorUserId))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(200);
  return (
    <>
      <PageTitle title="Audit log" />
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[760px] text-left text-[13.5px]">
          <thead><tr className="border-b border-rule text-[13px] text-muted"><th className="px-4 py-3 font-medium">When</th><th className="px-4 py-3 font-medium">Who</th><th className="px-4 py-3 font-medium">Action</th><th className="px-4 py-3 font-medium">Target</th><th className="px-4 py-3 font-medium">Details</th></tr></thead>
          <tbody className="divide-y divide-rule">
            {rows.map(({ a, email }) => (
              <tr key={a.id}>
                <td className="whitespace-nowrap px-4 py-2.5">{a.createdAt.toISOString().replace('T', ' ').slice(0, 16)}</td>
                <td className="px-4 py-2.5">{email ?? '—'}</td>
                <td className="px-4 py-2.5 font-mono text-[12.5px]">{a.action}</td>
                <td className="px-4 py-2.5 font-mono text-[12.5px]">{a.target}</td>
                <td className="max-w-[280px] truncate px-4 py-2.5 text-muted">{a.meta ? JSON.stringify(a.meta) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
