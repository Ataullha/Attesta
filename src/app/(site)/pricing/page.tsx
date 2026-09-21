import type { Metadata } from 'next';
import Link from 'next/link';
import { btn } from '@/components/ui/styles';
import { formatMoney, limits, packages } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description: `Make ${limits.guestLifetime} certificates without an account, ${limits.freeMonthly} verifiable certificates a month free, and prepaid packages for bulk issuing.`,
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <h1 className="font-serif text-[48px] leading-tight">Pricing</h1>
      <p className="mt-3 max-w-[62ch] text-[17px] text-ink-2">
        Try it without signing up, keep issuing a few a month for free, and buy a package when you need bulk issuing. Package credits never expire.
      </p>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section className="border border-rule bg-card p-7">
          <h2 className="text-[15px] text-muted">Without an account</h2>
          <p className="mt-2 font-serif text-[40px] leading-none">Free · {limits.guestLifetime} certificates</p>
          <ul className="mt-5 space-y-2 text-[15px] text-ink-2">
            <li>Full editor, all templates, your own background</li>
            <li>Signature, QR code and barcode</li>
            <li>PDF carries a note that it is not registered</li>
            <li>No verification page</li>
          </ul>
          <Link href="/create" className={btn.secondary + ' mt-7'}>Open the editor</Link>
        </section>
        <section className="border border-ink bg-card p-7">
          <h2 className="text-[15px] text-muted">Free account</h2>
          <p className="mt-2 font-serif text-[40px] leading-none">Free · {limits.freeMonthly} a month</p>
          <ul className="mt-5 space-y-2 text-[15px] text-ink-2">
            <li>Every certificate gets a signed verification record</li>
            <li>Saved templates and a signature library</li>
            <li>Revoke certificates at any time</li>
            <li>Verified organisation badge after domain check</li>
          </ul>
          <Link href="/register" className={btn.primary + ' mt-7'}>Create a free account</Link>
        </section>
      </div>

      <h2 className="mt-16 font-serif text-[34px]">Packages</h2>
      <p className="mt-2 max-w-[62ch] text-[15.5px] text-ink-2">
        Packages add certificate credits and unlock bulk issuing from CSV. Your {limits.freeMonthly} free monthly certificates are used first.
      </p>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-ink text-[13.5px] text-muted">
              <th scope="col" className="py-3 pr-4 font-medium">Package</th>
              <th scope="col" className="py-3 pr-4 font-medium">Certificates</th>
              <th scope="col" className="py-3 pr-4 font-medium">Price</th>
              <th scope="col" className="py-3 pr-4 font-medium">Per certificate</th>
              <th scope="col" className="py-3 font-medium">Suits</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id} className="border-b border-rule">
                <th scope="row" className="py-4 pr-4 font-semibold">{p.name}</th>
                <td className="py-4 pr-4 tabular-nums">{p.credits.toLocaleString()}</td>
                <td className="py-4 pr-4 tabular-nums">{formatMoney(p.price)}</td>
                <td className="py-4 pr-4 tabular-nums text-muted">{formatMoney(Math.round((p.price / p.credits) * 100) / 100)}</td>
                <td className="py-4 text-ink-2">{p.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-[14.5px] text-muted">Pay by bKash, Nagad or bank transfer from your dashboard. Credits are added once the payment is confirmed.</p>
      <Link href="/app/billing" className={btn.brass + ' mt-6'}>Buy a package</Link>
    </div>
  );
}
