import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { DesignComesWithYou, RegisterForm } from '@/components/site/AuthForms';
import { GoogleButton } from '@/components/site/GoogleButton';
import { googleConfigured } from '@/lib/auth/google';
import { Tick } from '@/components/site/Tick';
import { safeNextPath } from '@/lib/safe-redirect';
import { DRAFT_RETURN } from '@/components/editor/draft';
import { formatMoney, limits, packages, paymentMethodsInWords } from '@/lib/site';

// robots.txt already disallows /register; noindex keeps it out of results if it is linked to elsewhere.
export const metadata: Metadata = {
  title: 'Create a free account',
  description: `Free account with ${limits.freeMonthly} verifiable certificates a month.`,
  robots: { index: false },
};

const benefits = [
  `${limits.freeMonthly} verifiable certificates every month, free`,
  'A QR code on every certificate that opens a page confirming it',
  'Templates, signatures and logos saved for next time',
  'Revoke a certificate whenever you need to, with a public reason',
  'Your organisation named as the issuer, and a verified badge once you prove your domain',
];

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  if (await getUser()) redirect(safeNextPath(next));
  return (
    <div className="grid w-full max-w-[420px] gap-12 lg:max-w-5xl lg:grid-cols-[420px_1fr] lg:gap-16">
      <div>
        {next === DRAFT_RETURN && <DesignComesWithYou />}
        <h1 className="font-display text-[32px] leading-tight">Create a free account</h1>
        <p className="mb-7 mt-1 text-[15px] text-muted">
          No card needed. Already registered?{' '}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-accent underline underline-offset-2 hover:text-accent-dark">
            Sign in
          </Link>
        </p>
        {googleConfigured() && <GoogleButton next={next} divider="or sign up with your email" />}
        <RegisterForm next={next} />
      </div>
      <section aria-labelledby="free-h" className="border-t border-rule pt-10 lg:mt-2 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0">
        <h2 id="free-h" className="font-display text-[24px] leading-tight">What the free account includes</h2>
        <ul className="mt-5 space-y-3 text-[15.5px] leading-snug text-ink-2">
          {benefits.map((b) => (
            <li key={b} className="flex gap-2.5">
              <Tick />
              {b}
            </li>
          ))}
        </ul>
        <p className="mt-7 border-t border-rule pt-5 text-[14.5px] leading-relaxed text-muted">
          Issuing to a whole class or event at once? Packages add bulk issuing from a spreadsheet, from {formatMoney(packages[0].price)} for{' '}
          {packages[0].credits.toLocaleString()} certificates, paid by {paymentMethodsInWords()}.{' '}
          <Link href="/pricing" className="text-ink-2 underline underline-offset-2 hover:text-ink">
            See pricing
          </Link>
        </p>
      </section>
    </div>
  );
}
