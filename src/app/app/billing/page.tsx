import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { formatDate } from '@/lib/verify';
import { formatMoney } from '@/lib/site';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { BillingForm } from '@/components/app/BillingForm';
import { ResendVerification } from '@/components/app/Actions';

const STATUS = { pending: 'Waiting for confirmation', approved: 'Credits added', rejected: 'Not confirmed' } as const;

export default async function BillingPage({ searchParams }: PageProps<'/app/billing'>) {
  const user = await requireUserPage('/app/billing');
  const chosen = (await searchParams).package;
  const payments = await db().select().from(schema.payments).where(eq(schema.payments.userId, user.id)).orderBy(desc(schema.payments.createdAt)).limit(20);
  return (
    <>
      <PageTitle title="Packages and billing" />
      <p className="-mt-4 mb-8 text-[15.5px] text-ink-2">You have <strong>{user.credits.toLocaleString()}</strong> package credits. Credits never expire, and packages unlock bulk issuing.</p>
      <div className={`${card} max-w-4xl p-6`}>
        {user.emailVerified ? (
          <BillingForm initialPackage={typeof chosen === 'string' ? chosen : undefined} />
        ) : (
          <p className="text-[15px] text-ink-2">
            Confirm your email address before buying a package: the link went to {user.email}. <ResendVerification />
          </p>
        )}
      </div>
      {payments.length > 0 && (
        <section className="mt-10 max-w-4xl">
          <h2 className="mb-3 text-[17px] font-semibold">Your payments</h2>
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full min-w-[560px] text-left text-[14.5px]">
              <thead><tr className="border-b border-rule text-[13px] text-muted"><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Package</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Transaction</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-rule">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3">{p.credits.toLocaleString()} certificates</td>
                    <td className="px-4 py-3">{formatMoney(p.amount)}</td>
                    <td className="px-4 py-3 font-mono text-[13px]">{p.method} · {p.trxId}</td>
                    <td className="px-4 py-3">{STATUS[p.status]}{p.note && <span className="block text-[12.5px] text-muted">{p.note}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
