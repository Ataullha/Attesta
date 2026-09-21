import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth/session';
import { RegisterForm } from '@/components/site/AuthForms';
import { limits } from '@/lib/site';

export const metadata: Metadata = { title: 'Create a free account', description: `Free account with ${limits.freeMonthly} verifiable certificates a month.` };

export default async function RegisterPage({ searchParams }: PageProps<'/register'>) {
  const sp = await searchParams;
  const next = typeof sp.next === 'string' ? sp.next : undefined;
  if (await getUser()) redirect('/app');
  return (
    <>
      <h1 className="font-serif text-[40px] leading-tight">Create a free account</h1>
      <p className="mb-7 mt-1 text-[15px] text-muted">
        {limits.freeMonthly} verifiable certificates every month. Already registered? <Link href="/login" className="text-brass underline-offset-2 hover:underline">Sign in</Link>
      </p>
      <RegisterForm next={next} />
    </>
  );
}
