import Link from 'next/link';
import { site } from '@/lib/site';
import { HeaderActions } from './HeaderActions';
import { SealMark } from './SealMark';

export function SiteHeader() {
  return (
    <header className="border-b border-rule bg-paper/95">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <SealMark size={26} color="#8A5D28" />
          <span className="font-serif text-[26px] leading-none">{site.name}</span>
        </Link>
        <nav aria-label="Main" className="order-3 flex w-full gap-5 text-[15px] text-ink-2 sm:order-none sm:w-auto">
          <Link href="/templates" className="hover:text-ink">Templates</Link>
          <Link href="/verify" className="hover:text-ink">Verify</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
