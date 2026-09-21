import { desc, ilike, or } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireAdminPage } from '@/lib/auth/session';
import { formatDate } from '@/lib/verify';
import { btn, card, field } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { AdminAction, CreditsForm } from '@/components/app/AdminAction';

export default async function AdminUsers({ searchParams }: PageProps<'/admin/users'>) {
  const admin = await requireAdminPage();
  const q = String((await searchParams).q ?? '').trim().slice(0, 100);
  const rows = await db()
    .select()
    .from(schema.users)
    .where(q ? or(ilike(schema.users.email, `%${q}%`), ilike(schema.users.name, `%${q}%`)) : undefined)
    .orderBy(desc(schema.users.createdAt))
    .limit(100);
  return (
    <>
      <PageTitle title="Users" />
      <form className="mb-5 flex max-w-md gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Email or name" className={field.input} aria-label="Search users" />
        <button className={btn.secondary}>Search</button>
      </form>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full min-w-[900px] text-left text-[14px]">
          <thead><tr className="border-b border-rule text-[13px] text-muted"><th className="px-4 py-3 font-medium">User</th><th className="px-4 py-3 font-medium">Joined</th><th className="px-4 py-3 font-medium">Credits</th><th className="px-4 py-3 font-medium">State</th><th className="px-4 py-3 font-medium">Actions</th></tr></thead>
          <tbody className="divide-y divide-rule">
            {rows.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">{u.name}{u.role === 'admin' && <span className="ml-1.5 rounded bg-ink px-1.5 text-[11px] text-card">admin</span>}<span className="block text-[12.5px] text-muted">{u.email}</span></td>
                <td className="px-4 py-3">{formatDate(u.createdAt)}</td>
                <td className="px-4 py-3 tabular-nums">{u.credits.toLocaleString()}</td>
                <td className="px-4 py-3">{u.bannedAt ? <span className="text-revoked">Suspended</span> : u.emailVerifiedAt ? 'Active' : 'Email not confirmed'}</td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    <CreditsForm userId={u.id} />
                    {!u.emailVerifiedAt && <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: 'verify-email' }} label="Confirm email" />}
                    {u.id !== admin.id && (u.bannedAt
                      ? <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: 'unban' }} label="Restore" />
                      : <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: 'ban' }} label="Suspend" tone="bad" confirmText={`Suspend ${u.email}? They are signed out everywhere.`} />)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
