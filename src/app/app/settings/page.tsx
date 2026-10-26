import type { Metadata } from 'next';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { countOtherSessions, currentSessionId, requireUserPage } from '@/lib/auth/session';
import { emailConfigured } from '@/lib/email';
import { formatDate } from '@/lib/verify';
import { card } from '@/components/ui/styles';
import { PageTitle } from '@/components/app/Shell';
import { ResendVerification } from '@/components/app/Actions';
import { AddPasswordByEmail, PasswordForm, SignOutElsewhere } from '@/components/app/SettingsForms';

export const metadata: Metadata = { title: 'Account settings' };

export default async function SettingsPage() {
  const user = await requireUserPage('/app/settings');
  const [[row], others] = await Promise.all([
    db()
      .select({ createdAt: schema.users.createdAt, hasPassword: sql<boolean>`${schema.users.passwordHash} is not null`, google: sql<boolean>`${schema.users.googleSub} is not null` })
      .from(schema.users)
      .where(eq(schema.users.id, user.id))
      .limit(1),
    currentSessionId().then((keep) => countOtherSessions(user.id, keep)),
  ]);

  return (
    <>
      <PageTitle title="Account settings" />
      <div className="max-w-3xl space-y-8">
        <section className={`${card} p-6`} aria-labelledby="account-h">
          <h2 id="account-h" className="font-serif text-[26px] leading-none">Your account</h2>
          <dl className="mt-5 space-y-3 text-[15px]">
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
              <dt className="text-muted">Email</dt>
              <dd>
                {/* Only the address may break anywhere; the badge must stay in one piece. */}
                <span className="break-all">{user.email}</span>{' '}
                {user.emailVerified ? (
                  <span className="ml-1 inline-block whitespace-nowrap rounded-full bg-seal-soft px-2.5 py-0.5 text-[12.5px] text-seal">Confirmed</span>
                ) : (
                  <span className="ml-1 inline-block whitespace-nowrap rounded-full bg-brass-soft px-2.5 py-0.5 text-[12.5px] text-brass">Not confirmed</span>
                )}
                {!user.emailVerified && emailConfigured() && (
                  <span className="mt-1 block text-[14px]">
                    <ResendVerification />
                  </span>
                )}
              </dd>
            </div>
            {row && (
              <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
                <dt className="text-muted">Signs in with</dt>
                <dd>{row.google && row.hasPassword ? 'Google, or email and password' : row.google ? 'Google' : 'Email and password'}</dd>
              </div>
            )}
            {row && (
              <div className="grid gap-1 sm:grid-cols-[140px_1fr]">
                <dt className="text-muted">Member since</dt>
                <dd>{formatDate(row.createdAt)}</dd>
              </div>
            )}
          </dl>
          <p className="mt-5 text-[13.5px] leading-relaxed text-muted">
            Your name is shown as the issuer on certificates you issue without an organisation, so it can’t be changed here — certificates already issued
            carry the name they were signed with. To change it, or to close your account, write to support.
          </p>
        </section>

        <section className={`${card} p-6`} aria-labelledby="password-h">
          <h2 id="password-h" className="font-serif text-[26px] leading-none">Password</h2>
          {row && !row.hasPassword ? (
            <>
              <p className="mb-5 mt-2 text-[15px] leading-relaxed text-ink-2">
                You sign in with Google, so this account has no password. Add one to be able to sign in with your email address as well.
              </p>
              {emailConfigured() ? <AddPasswordByEmail email={user.email} /> : <p className="text-[15px] text-ink-2">To add one, write to support.</p>}
            </>
          ) : (
            <>
              <p className="mb-5 mt-2 text-[15px] text-ink-2">Changing it signs out your other devices; this one stays signed in.</p>
              <PasswordForm />
            </>
          )}
        </section>

        <section className={`${card} p-6`} aria-labelledby="devices-h">
          <h2 id="devices-h" className="mb-3 font-serif text-[26px] leading-none">Where you’re signed in</h2>
          <SignOutElsewhere others={others} />
        </section>
      </div>
    </>
  );
}
