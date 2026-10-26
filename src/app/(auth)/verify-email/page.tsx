import type { Metadata } from 'next';
import { VerifyEmailRunner } from '@/components/site/AuthForms';

export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } };

export default async function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  const token = (await searchParams).token;
  return (
    <div className="w-full max-w-[420px]">
      <h1 className="mb-6 font-serif text-[40px] leading-tight">Confirm your email</h1>
      {typeof token === 'string' ? <VerifyEmailRunner token={token} /> : <p className="text-ink-2">Open the link from the email we sent you.</p>}
    </div>
  );
}
