import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { LoginForm } from '@/components/site/AuthForms';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  if (await getUser()) redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : '/app');
  return (
    <>
      <h1 className="font-serif text-[40px] leading-tight">Sign in</h1>
      <p className="mb-7 mt-1 text-[15px] text-muted">
        New here? <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="text-brass underline-offset-2 hover:underline">Create a free account</Link>
      </p>
      <LoginForm next={next} />
    </>
  );
}
