import Link from 'next/link';
import { site } from '@/lib/site';
import { payByInWords } from '@/lib/payments/methods';
import { USE_CASES } from '@/lib/usecases';

const columns: { title: string; links: [string, string][] }[] = [
  {
    title: 'Product',
    links: [
      ['Certificate editor', '/create'],
      ['ID card maker', '/id-card-maker'],
      ['Templates', '/templates'],
      ['Bulk from CSV', '/certificate-maker/bulk-certificate-generator'],
      ['Pricing', '/pricing'],
      ['Verify a certificate', '/verify'],
    ],
  },
  {
    title: 'Certificates for',
    links: [
      ...USE_CASES.filter((u) => u.slug !== 'bulk-certificate-generator')
        .slice(0, 6)
        .map((u): [string, string] => [u.short, `/certificate-maker/${u.slug}`]),
      ['All use cases', '/certificate-maker'],
    ],
  },
  {
    title: 'Account',
    links: [
      ['Create a free account', '/register'],
      ['Sign in', '/login'],
      ['Dashboard', '/app'],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 text-[14px] sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
        <div>
          <p className="font-display text-[20px]">{site.name}</p>
          <p className="mt-2 max-w-[30ch] text-muted">{site.shortDescription}</p>
          <p className="mt-4 text-muted">
            Questions?{' '}
            <a href={`mailto:${site.supportEmail}`} className="text-ink-2 underline underline-offset-2 hover:text-ink">
              {site.supportEmail}
            </a>
          </p>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h2 className="font-semibold">{c.title}</h2>
            <ul className="mt-3 space-y-2 text-ink-2">
              {c.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h2 className="font-semibold">Company</h2>
          <ul className="mt-3 space-y-2 text-ink-2">
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-1 border-t border-rule px-5 py-5 text-[13px] text-muted">
        <span>© {new Date().getFullYear()} {site.name}. {site.operatedFrom}.</span>
        <span>Prices in taka. Pay by {payByInWords()}.</span>
      </div>
    </footer>
  );
}
