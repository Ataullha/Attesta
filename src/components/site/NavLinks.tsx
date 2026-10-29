'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const MAKE = [
  { href: '/certificate-maker', label: 'Certificates', hint: 'Courses, events and awards' },
  { href: '/id-card-maker', label: 'ID cards', hint: 'Members, staff and students, with photos' },
  { href: '/visiting-card-maker', label: 'Visiting cards', hint: 'A card for everyone in your team' },
  { href: '/invitation-card-maker', label: 'Invitations', hint: 'Weddings and events, each guest by name' },
];

const LINKS = [
  { href: '/templates', label: 'Templates' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/verify', label: 'Verify' },
];

const isIn = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/**
 * The main navigation, marking the section the visitor is in (for sight and for screen readers).
 * What can be made sits behind one "Create" button, so the header stays a single row on a phone; its
 * links are in the page from the start, for search engines and for anyone without JavaScript yet.
 */
export function NavLinks() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const making = MAKE.some((m) => isIn(path, m.href));

  // Closes on the next page, on a click elsewhere, and on Escape (handing focus back to the button).
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', key);
    };
  }, [open]);

  const linkClass = (current: boolean) => `py-1 hover:text-ink ${current ? 'text-ink underline decoration-accent decoration-2 underline-offset-[6px]' : ''}`;

  return (
    <nav aria-label="Main" className="order-3 flex w-full items-center gap-5 text-[15px] text-ink-2 sm:order-none sm:w-auto">
      <div ref={wrap} className="relative">
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-controls="create-menu"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-1 ${linkClass(making)}`}
        >
          Create
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <div id="create-menu" hidden={!open} className="absolute left-0 top-full z-50 mt-2 w-72 rounded-xl border border-rule bg-card p-1.5 shadow-[0_18px_40px_-20px_rgba(15,23,42,0.45)]">
          <ul>
            {MAKE.map((m) => {
              const current = isIn(path, m.href);
              return (
                <li key={m.href}>
                  <Link
                    href={m.href}
                    aria-current={current ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={`block rounded-lg px-3 py-2.5 hover:bg-paper ${current ? 'bg-accent-soft' : ''}`}
                  >
                    <span className="block font-medium text-ink">{m.label}</span>
                    <span className="block text-[13px] text-muted">{m.hint}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      {LINKS.map((l) => {
        const current = isIn(path, l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={current ? 'page' : undefined} className={linkClass(current)}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
