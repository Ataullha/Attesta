import Link from 'next/link';
import { site } from '@/lib/site';
import { SealMark } from '@/components/site/SealMark';
import { LogoutButton } from './Actions';

export function Shell({ nav, title, user, children }: { nav: { href: string; label: string }[]; title: string; user: { name: string; email: string }; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="border-b border-rule bg-card lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col px-3 py-4">
          <Link href="/" className="flex items-center gap-2 px-2">
            <SealMark size={24} color="#8A5D28" />
            <span className="font-serif text-[24px] leading-none">{site.name}</span>
          </Link>
          <p className="mt-1 px-2 text-[12.5px] text-muted">{title}</p>
          <nav aria-label={title} className="mt-5 flex gap-1 overflow-x-auto lg:flex-col">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="flex min-h-10 shrink-0 items-center rounded-[4px] px-3 text-[14.5px] text-ink-2 hover:bg-paper hover:text-ink">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-auto hidden border-t border-rule pt-3 lg:block">
            <p className="truncate px-3 text-[13.5px] font-medium">{user.name}</p>
            <p className="truncate px-3 text-[12.5px] text-muted">{user.email}</p>
            <div className="mt-2"><LogoutButton /></div>
          </div>
        </div>
      </aside>
      <main id="main" className="min-w-0 px-5 py-8 lg:px-10">{children}</main>
    </div>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <h1 className="font-serif text-[40px] leading-none">{title}</h1>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
