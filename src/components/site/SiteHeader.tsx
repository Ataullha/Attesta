import Link from 'next/link';
import { site } from '@/lib/site';
import { HeaderActions } from './HeaderActions';
import { NavLinks } from './NavLinks';
import { SealMark } from './SealMark';

export function SiteHeader() {
  return (
    // Sticky from tablet up, so the way to start is always in reach; on a phone it would cost too much screen.
    <header className="z-40 border-b border-rule bg-paper/95 backdrop-blur-sm md:sticky md:top-0">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <SealMark size={26} className="text-accent" />
          <span className="font-display text-[22px] leading-none">{site.name}</span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex items-center gap-2">
          <HeaderActions />
        </div>
      </div>
    </header>
  );
}
