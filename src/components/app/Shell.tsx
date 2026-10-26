import { ShellNav } from './ShellNav';

export function Shell({ nav, title, user, children }: { nav: { href: string; label: string }[]; title: string; user: { name: string; email: string }; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[240px_1fr]">
      {/* Sticky on every size, so on a phone the menu button is always within reach. */}
      <aside className="sticky top-0 z-40 border-b border-rule bg-card lg:h-dvh lg:border-b-0 lg:border-r">
        <ShellNav nav={nav} title={title} user={user} />
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
