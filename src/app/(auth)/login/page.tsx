import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { DesignComesWithYou, LoginForm } from '@/components/site/AuthForms';
import { GoogleButton } from '@/components/site/GoogleButton';
import { GOOGLE_FAILURE_MESSAGES, googleConfigured, type GoogleFailure } from '@/lib/auth/google';
import { safeNextPath } from '@/lib/safe-redirect';
import { DRAFT_RETURN } from '@/components/editor/draft';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  if (await getUser()) redirect(safeNextPath(next));
  // Why a Google sign-in came back here (see api/auth/google/callback).
  const googleFailure = typeof sp.google === 'string' && Object.hasOwn(GOOGLE_FAILURE_MESSAGES, sp.google) ? GOOGLE_FAILURE_MESSAGES[sp.google as GoogleFailure] : null;
  return (
    <div className="w-full max-w-[420px]">
      {next === DRAFT_RETURN && <DesignComesWithYou />}
      {googleFailure && (
        <p role="alert" className="mb-6 rounded-[4px] border border-revoked/30 bg-revoked-soft px-3.5 py-2.5 text-[14.5px] leading-snug text-revoked">
          {googleFailure}
        </p>
      )}
      <h1 className="font-serif text-[40px] leading-tight">Sign in</h1>
      <p className="mb-7 mt-1 text-[15px] text-muted">
        New here?{' '}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-brass underline underline-offset-2 hover:text-brass-dark">
          Create a free account
        </Link>
      </p>
      {googleConfigured() && <GoogleButton next={next} divider="or sign in with your email" />}
      <LoginForm next={next} />
    </div>
  );
}
