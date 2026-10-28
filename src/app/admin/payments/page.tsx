import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/session';
import { formatDate } from '@/lib/verify';
import { formatMoney, paymentMethods } from '@/lib/site';
import { awaitingReview, ONLINE } from '@/lib/payments/online';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { AdminAction } from '@/components/app/AdminAction';

type Payment = typeof schema.payments.$inferSelect;

/** What SSLCommerz reported, for checking the payment in its merchant panel. */
function GatewayDetails({ p }: { p: Payment }) {
  const g = p.gateway ?? {};
  if (!g.val_id) return <>Online checkout, not paid<br />TrxID {p.trxId}<br />phone {p.sender}</>;
  return (
    <>
      Online (SSLCommerz) · {g.card_type || 'paid'}
      <br />TrxID {p.trxId}
      <br />Val ID {g.val_id}
      {g.bank_tran_id && <><br />Bank TrxID {g.bank_tran_id}</>}
      {g.amount && <><br />Paid {g.amount}{g.store_amount && `, you receive ${g.store_amount}`}</>}
      {g.risk_title && <><br />Risk: {g.risk_title}{g.risk_level === '1' && ' (held for review)'}</>}
      <br />phone {p.sender}
    </>
  );
}

export default async function AdminPayments({ searchParams }: PageProps<'/admin/payments'>) {
  await requireAdminPage();
  const all = (await searchParams).status === 'all';
  const rows = await db()
    .select({ p: schema.payments, email: schema.users.email, name: schema.users.name, reviewable: awaitingReview })
    .from(schema.payments)
    .innerJoin(schema.users, eq(schema.users.id, schema.payments.userId))
    .where(all ? undefined : awaitingReview)
    .orderBy(desc(schema.payments.createdAt))
    .limit(200);
  return (
    <>
      <PageTitle title="Payments">
        <a href={all ? '?' : '?status=all'} className="text-[14px] text-accent underline">{all ? 'Show those to confirm only' : 'Show all'}</a>
      </PageTitle>
      <p className="-mt-4 mb-6 max-w-[80ch] text-[14.5px] text-ink-2">
        Match each transaction ID against your bKash, Nagad or bank statement before confirming. Confirming adds the credits immediately. Online payments through SSLCommerz add their credits by themselves; one appears here only when SSLCommerz rated it risky, so check it in your SSLCommerz panel first, and refund it there if you reject it.
      </p>
      {rows.length === 0 ? <p className="text-muted">Nothing here.</p> : (
        <div className={`${card} overflow-x-auto`} role="region" aria-label="Payments" tabIndex={0}>
          <table className="w-full min-w-[860px] text-left text-[14px]">
            <thead><tr className="border-b border-rule text-[13px] text-muted"><th className="px-4 py-3 font-medium">Submitted</th><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Package</th><th className="px-4 py-3 font-medium">Payment</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-rule">
              {rows.map(({ p, email, name, reviewable }) => (
                <tr key={p.id} className="align-top">
                  <td className="px-4 py-3">{formatDate(p.createdAt)}</td>
                  <td className="px-4 py-3">{name}<span className="block text-[12.5px] text-muted">{email}</span></td>
                  <td className="px-4 py-3">{p.credits.toLocaleString()} · {formatMoney(p.amount)}</td>
                  <td className="px-4 py-3 font-mono text-[12.5px]">
                    {p.method === ONLINE ? <GatewayDetails p={p} /> : <>{paymentMethods.find((m) => m.id === p.method)?.label ?? p.method}<br />TrxID {p.trxId}<br />from {p.sender}</>}
                  </td>
                  <td className="px-4 py-3">{p.status}{p.note && <span className="block text-[12.5px] text-muted">{p.note}</span>}</td>
                  <td className="px-4 py-3 text-right">
                    {reviewable && (
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
