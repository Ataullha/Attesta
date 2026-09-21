import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/session';
import { formatDate } from '@/lib/verify';
import { formatMoney } from '@/lib/site';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { AdminAction } from '@/components/app/AdminAction';

export default async function AdminPayments({ searchParams }: PageProps<'/admin/payments'>) {
  await requireAdminPage();
  const status = (await searchParams).status === 'all' ? null : 'pending';
  const rows = await db()
    .select({ p: schema.payments, email: schema.users.email, name: schema.users.name })
    .from(schema.payments)
    .innerJoin(schema.users, eq(schema.users.id, schema.payments.userId))
    .where(status ? eq(schema.payments.status, status) : undefined)
    .orderBy(desc(schema.payments.createdAt))
    .limit(200);
  return (
    <>
      <PageTitle title="Payments">
        <a href={status ? '?status=all' : '?'} className="text-[14px] text-brass underline">{status ? 'Show all' : 'Show pending only'}</a>
      </PageTitle>
      <p className="-mt-4 mb-6 text-[14.5px] text-ink-2">Match each transaction ID against your bKash, Nagad or bank statement before confirming. Confirming adds the credits immediately.</p>
      {rows.length === 0 ? <p className="text-muted">Nothing here.</p> : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[860px] text-left text-[14px]">
            <thead><tr className="border-b border-rule text-[13px] text-muted"><th className="px-4 py-3 font-medium">Submitted</th><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Package</th><th className="px-4 py-3 font-medium">Payment</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-rule">
              {rows.map(({ p, email, name }) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3">{name}<span className="block text-[12.5px] text-muted">{email}</span></td>
                  <td className="px-4 py-3">{p.credits.toLocaleString()} · {formatMoney(p.amount)}</td>
                  <td className="px-4 py-3 font-mono text-[12.5px]">{p.method}<br />TrxID {p.trxId}<br />from {p.sender}</td>
                  <td className="px-4 py-3">{p.status}{p.note && <span className="block text-[12.5px] text-muted">{p.note}</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {p.status === 'pending' && (
                      <span className="flex justify-end gap-1">
                        <AdminAction url={`/api/admin/payments/${p.id}`} body={{ action: 'approve' }} label="Confirm" tone="good" confirmText={`Add ${p.credits} credits to ${email}?`} />
                        <AdminAction url={`/api/admin/payments/${p.id}`} body={{ action: 'reject' }} label="Reject" tone="bad" ask="Reason shown to the user" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
