import type { Metadata } from 'next';
import { requireUserPage } from '@/lib/auth/session';
import { Shell } from '@/components/app/Shell';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

const nav = [
  { href: '/app', label: 'Certificates' },
  { href: '/create', label: 'New certificate' },
  { href: '/app/bulk', label: 'Bulk from CSV' },
  { href: '/app/templates', label: 'Templates' },
  { href: '/app/library', label: 'Signatures and images' },
  { href: '/app/organization', label: 'Organisation' },
  { href: '/app/billing', label: 'Packages and billing' },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUserPage('/app');
  const items = user.role === 'admin' ? [...nav, { href: '/admin', label: 'Admin panel' }] : nav;
  return <Shell nav={items} title="Your account" user={user}>{children}</Shell>;
}
