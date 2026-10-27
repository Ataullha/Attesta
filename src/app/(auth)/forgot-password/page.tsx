import type { Metadata } from 'next';
import { ForgotForm } from '@/components/site/AuthForms';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default function ForgotPage() {
  return (
    <div className="w-full max-w-[420px]">
      <h1 className="font-display text-[32px] leading-tight">Reset your password</h1>
      <p className="mb-7 mt-1 text-[15px] text-muted">We’ll email you a link to choose a new one.</p>
      <ForgotForm />
    </div>
  );
}
