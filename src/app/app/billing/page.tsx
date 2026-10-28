import Link from 'next/link';
import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { formatDate } from '@/lib/verify';
import { formatMoney, paymentMethods, site } from '@/lib/site';
import { sslcommerzConfigured } from '@/lib/payments/sslcommerz';
import { ONLINE } from '@/lib/payments/online';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { BillingForm } from '@/components/app/BillingForm';
import { ResendVerification } from '@/components/app/Actions';

type Payment = typeof schema.payments.$inferSelect;

const STATUS = {
  pending: { label: 'Waiting for confirmation', cls: 'bg-warn-soft text-warn' },
  approved: { label: 'Credits added', cls: 'bg-seal-soft text-seal' },
  rejected: { label: 'Not confirmed', cls: 'bg-revoked-soft text-revoked' },
  failed: { label: 'Didn’t go through', cls: 'bg-revoked-soft text-revoked' },
  cancelled: { label: 'Not completed', cls: 'bg-rule text-ink-2' },
} as const;

/** An online checkout SSLCommerz hasn't confirmed a payment for yet. */
const unpaid = (p: Payment) => p.method === ONLINE && p.status === 'pending' && !p.gateway?.val_id;

function statusOf(p: Payment) {
  if (unpaid(p)) return { label: 'Waiting for payment', cls: 'bg-rule text-ink-2', note: 'If you paid, the credits appear here once SSLCommerz confirms it.' };
  return { ...STATUS[p.status], note: p.note };
}

function methodOf(p: Payment) {
  if (p.method === ONLINE) return p.gateway?.card_type ? `Online · ${p.gateway.card_type}` : 'Online';
  return paymentMethods.find((m) => m.id === p.method)?.label ?? p.method;
}

/** How a checkout ended, for the customer arriving back from SSLCommerz's payment page. */
function CheckoutNotice({ payment }: { payment: Payment }) {
  const credits = `${payment.credits.toLocaleString()} certificates`;
  const [tone, title, text] =
    payment.status === 'approved'
      ? ['border-seal/30 bg-seal-soft text-seal', 'Payment received.', `${credits} were added to your account.`]
      : payment.status === 'pending' && !unpaid(payment)
        ? ['border-warn/30 bg-warn-soft text-warn', 'Payment received.', 'We’re checking it before adding the credits, usually within a working day. They will appear here.']
        : payment.status === 'pending'
          ? ['border-warn/30 bg-warn-soft text-warn', 'Waiting for SSLCommerz to confirm the payment.', 'If you paid, the credits appear here within a few minutes.']
          : payment.status === 'cancelled'
            ? ['border-rule bg-card text-ink', 'The payment wasn’t completed.', 'No credits were added. You can try again below.']
            : payment.status === 'rejected'
              ? ['border-revoked/30 bg-revoked-soft text-revoked', 'This payment wasn’t accepted.', payment.note ?? `Write to ${site.supportEmail} if you have a question about it.`]
              : ['border-revoked/30 bg-revoked-soft text-revoked', 'The payment didn’t go through.', payment.note ?? 'No credits were added. You can try again below, or pay another way.'];
  return (
    <div role="status" className={`mb-6 max-w-4xl rounded-xl border px-5 py-4 text-[15px] leading-relaxed ${tone}`}>
      <strong className="font-semibold">{title}</strong> <span className="text-ink">{text}</span>
      {unpaid(payment) && (
        <Link href={`/app/billing?checkout=${payment.trxId}`} className="ml-2 font-medium text-ink underline underline-offset-2">
          Check again
        </Link>
      )}
    </div>
  );
}

export default async function BillingPage({ searchParams }: PageProps<'/app/billing'>) {
  const user = await requireUserPage('/app/billing');
  const sp = await searchParams;
  const p = schema.payments;
  const payments = await db().select().from(p).where(eq(p.userId, user.id)).orderBy(desc(p.createdAt)).limit(20);
  const checkoutId = typeof sp.checkout === 'string' && /^[A-Z0-9]{8,30}$/.test(sp.checkout) ? sp.checkout : null;
  const [checkout] = checkoutId
    ? await db().select().from(p).where(and(eq(p.userId, user.id), eq(p.method, ONLINE), eq(p.trxId, checkoutId))).limit(1)
    : [];
  const online = sslcommerzConfigured();
  return (
    <>
      <PageTitle title="Packages and billing" />
      <p className="-mt-4 mb-8 text-[15.5px] text-ink-2">You have <strong>{user.credits.toLocaleString()}</strong> package credits. Credits never expire, and packages unlock bulk issuing.</p>
      {checkout && <CheckoutNotice payment={checkout} />}
      <div className={`${card} max-w-4xl p-6`}>
        {user.emailVerified ? (
          <BillingForm
            initialPackage={typeof sp.package === 'string' ? sp.package : checkout?.packageId}
            online={online}
            phone={payments.find((x) => x.method === ONLINE)?.sender}
          />
        ) : (
          <p className="text-[15px] text-ink-2">
            Confirm your email address before buying a package: the link went to {user.email}. <ResendVerification />
          </p>
        )}
      </div>
      {payments.length > 0 && (
        <section className="mt-10 max-w-4xl">
          <h2 id="payments-h" className="mb-3 text-[17px] font-semibold">Your payments</h2>
          {/* Focusable, so the table can be scrolled sideways from the keyboard on a narrow screen. */}
          <div className={`${card} overflow-x-auto`} role="region" aria-labelledby="payments-h" tabIndex={0}>
            <table className="w-full min-w-[600px] text-left text-[14.5px]">
              <thead><tr className="border-b border-rule text-[13px] text-muted"><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Package</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Transaction</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
              <tbody className="divide-y divide-rule">
                {payments.map((x) => {
                  const s = statusOf(x);
                  return (
                    <tr key={x.id} className="align-top">
                      <td className="px-4 py-3">{formatDate(x.createdAt)}</td>
                      <td className="px-4 py-3">{x.credits.toLocaleString()} certificates</td>
                      <td className="px-4 py-3">{formatMoney(x.amount)}</td>
                      <td className="px-4 py-3"><span className="font-mono text-[13px]">{x.trxId}</span><span className="block text-[12.5px] text-muted">{methodOf(x)}</span></td>
                      <td className="px-4 py-3">
                        <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12.5px] ${s.cls}`}>{s.label}</span>
                        {s.note && <span className="mt-1 block max-w-[30ch] text-[12.5px] leading-snug text-muted">{s.note}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
