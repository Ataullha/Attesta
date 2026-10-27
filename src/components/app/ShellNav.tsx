'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { site } from '@/lib/site';
import { SealMark } from '@/components/site/SealMark';
import { LogoutButton } from './Actions';

type Item = { href: string; label: string };

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  // /app and /admin are the homes of their sections, so they must not light up for every page below them.
  return href !== '/app' && href !== '/admin' && pathname.startsWith(href + '/');
}

/**
 * The sidebar on wide screens; on narrow ones a bar with a menu button that opens the same list
 * together with the account block (which is where "Sign out" lives).
 */
export function ShellNav({ nav, title, user }: { nav: Item[]; title: string; user: { name: string; email: string } }) {
  const pathname = usePathname();
  // Remembering which page the menu was opened on closes it by itself when the route changes.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const menuId = useId();
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpenOn(null);
      button.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="bg-card lg:flex lg:h-full lg:flex-col lg:px-3 lg:py-4">
      <div className="flex h-14 items-center justify-between px-4 lg:block lg:h-auto lg:px-2">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <SealMark size={24} className="text-accent" />
            <span className="font-display text-[20px] leading-none">{site.name}</span>
          </Link>
          <p className="mt-1 hidden text-[12.5px] text-muted lg:block">{title}</p>
        </div>
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpenOn(open ? null : pathname)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rule-2 px-3 text-[14.5px] text-ink hover:bg-paper lg:hidden"
        >
          {open ? 'Close' : 'Menu'}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            {open ? <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" /> : <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />}
          </svg>
        </button>
      </div>

      <div
        id={menuId}
        className={`${open ? 'flex' : 'hidden'} max-h-[calc(100dvh-3.5rem)] flex-col overflow-y-auto border-t border-rule lg:flex lg:max-h-none lg:flex-1 lg:overflow-visible lg:border-t-0`}
      >
        <nav aria-label={title} className="flex flex-col gap-0.5 px-3 py-2 lg:mt-5 lg:px-0 lg:py-0">
          {nav.map((n) => {
            const current = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={current ? 'page' : undefined}
                className={`flex min-h-11 items-center rounded-lg px-3 text-[14.5px] lg:min-h-10 ${current ? 'bg-paper font-medium text-ink' : 'text-ink-2 hover:bg-paper hover:text-ink'}`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-rule px-4 py-3 lg:mt-auto lg:px-0 lg:pt-3">
          <p className="truncate px-3 text-[13.5px] font-medium lg:px-3">{user.name}</p>
          <p className="truncate px-3 text-[12.5px] text-muted">{user.email}</p>
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </div>
    </div>
  );
}
