import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { DesignComesWithYou, LoginForm } from '@/components/site/AuthForms';
import { safeNextPath } from '@/lib/safe-redirect';
import { DRAFT_RETURN } from '@/components/editor/draft';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  if (await getUser()) redirect(safeNextPath(next));
  return (
    <div className="w-full max-w-[420px]">
      {next === DRAFT_RETURN && <DesignComesWithYou />}
      <h1 className="font-serif text-[40px] leading-tight">Sign in</h1>
      <p className="mb-7 mt-1 text-[15px] text-muted">
        New here?{' '}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-brass underline underline-offset-2 hover:text-brass-dark">
          Create a free account
        </Link>
      </p>
      <LoginForm next={next} />
    </div>
  );
}
