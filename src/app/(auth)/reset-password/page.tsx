import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetForm } from '@/components/site/AuthForms';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPage({ searchParams }: PageProps<'/reset-password'>) {
  const token = (await searchParams).token;
  return (
    <div className="w-full max-w-[420px]">
      <h1 className="mb-7 font-serif text-[40px] leading-tight">Choose a new password</h1>
      {typeof token === 'string' && token.length > 20 ? (
        <ResetForm token={token} />
      ) : (
        <p className="text-ink-2">This link is incomplete. <Link href="/forgot-password" className="text-brass underline">Ask for a new one</Link>.</p>
      )}
    </div>
  );
}
