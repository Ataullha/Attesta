import Link from 'next/link';
import { btn } from '@/components/ui/styles';

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-5">
      <h1 className="font-display text-[42px] leading-tight">This page doesn’t exist</h1>
      <p className="mt-3 text-[17px] text-ink-2">The link may be mistyped or out of date. To check a certificate, use its serial number on the verify page.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className={btn.primary}>Home</Link>
        <Link href="/verify" className={btn.secondary}>Verify a certificate</Link>
      </div>
    </main>
  );
}
