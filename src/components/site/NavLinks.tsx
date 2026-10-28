'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/templates', label: 'Templates' },
  { href: '/id-card-maker', label: 'ID cards' },
  { href: '/certificate-maker', label: 'Use cases' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/verify', label: 'Verify' },
];

/** The main navigation, marking the section the visitor is in (for sight and for screen readers). */
export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="order-3 flex w-full gap-5 text-[15px] text-ink-2 sm:order-none sm:w-auto">
      {LINKS.map((l) => {
        const current = path === l.href || path.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? 'page' : undefined}
            className={`py-1 hover:text-ink ${current ? 'text-ink underline decoration-accent decoration-2 underline-offset-[6px]' : ''}`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
