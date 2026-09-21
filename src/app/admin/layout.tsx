import type { Metadata } from 'next';
import { requireAdminPage } from '@/lib/auth/session';
import { Shell } from '@/components/app/Shell';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

const nav = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/organizations', label: 'Organisations' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/certificates', label: 'Certificates' },
  { href: '/admin/audit', label: 'Audit log' },
  { href: '/app', label: 'Back to my account' },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  return <Shell nav={nav} title="Admin panel" user={user}>{children}</Shell>;
}
