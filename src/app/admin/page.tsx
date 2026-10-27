import Link from 'next/link';
import { count, eq, gte, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/session';
import { PageTitle } from '@/components/app/Shell';
import { awaitingReview } from '@/lib/payments/online';

async function n(q: Promise<{ n: number }[]>) {
  return Number((await q)[0]?.n ?? 0);
}

export default async function AdminHome() {
  await requireAdminPage();
  const day = new Date(Date.now() - 86400_000);
  const d = db();
  const [users, certs, today, pendingPay, pendingOrg, openReports, revenue] = await Promise.all([
    n(d.select({ n: count() }).from(schema.users)),
    n(d.select({ n: count() }).from(schema.certificates)),
    n(d.select({ n: count() }).from(schema.certificates).where(gte(schema.certificates.issuedAt, day))),
    n(d.select({ n: count() }).from(schema.payments).where(awaitingReview)),
    n(d.select({ n: count() }).from(schema.organizations).where(eq(schema.organizations.status, 'pending'))),
    n(d.select({ n: count() }).from(schema.reports).where(eq(schema.reports.status, 'open'))),
    n(d.select({ n: sql<number>`coalesce(sum(${schema.payments.amount}), 0)` }).from(schema.payments).where(eq(schema.payments.status, 'approved'))),
  ]);
  const queue = [
    { href: '/admin/payments', label: 'Payments to confirm', value: pendingPay },
    { href: '/admin/organizations', label: 'Organisations to review', value: pendingOrg },
    { href: '/admin/reports', label: 'Open reports', value: openReports },
  ];
  return (
    <>
      <PageTitle title="Overview" />
      <h2 className="mb-3 text-[15px] font-semibold">Needs attention</h2>
      <ul className="grid gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-3">
        {queue.map((q) => (
          <li key={q.href} className="bg-card">
            <Link href={q.href} className="block p-5 hover:bg-paper">
              <span className="text-[13.5px] text-muted">{q.label}</span>
              <span className={`mt-1 block font-display text-[32px] leading-none ${q.value ? 'text-accent' : ''}`}>{q.value}</span>
            </Link>
          </li>
        ))}
      </ul>
      <h2 className="mb-3 mt-10 text-[15px] font-semibold">Totals</h2>
      <dl className="grid gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-4">
        {[['Users', users], ['Certificates', certs], ['Issued in last 24 h', today], ['Confirmed revenue (৳)', revenue]].map(([k, v]) => (
          <div key={k as string} className="bg-card p-5"><dt className="text-[13.5px] text-muted">{k}</dt><dd className="mt-1 font-display text-[28px] leading-none">{Number(v).toLocaleString()}</dd></div>
        ))}
      </dl>
    </>
  );
}
