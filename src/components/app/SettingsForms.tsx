'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btn, field } from '@/components/ui/styles';
import { postJson } from './client-utils';

type Message = { ok: boolean; text: string } | null;

function Status({ msg }: { msg: Message }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? 'status' : 'alert'} className={`text-[14px] ${msg.ok ? 'text-seal' : 'text-revoked'}`}>
      {msg.text}
    </p>
  );
}

export function PasswordForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const type = show ? 'text' : 'password';

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        if (fd.get('newPassword') !== fd.get('confirm')) {
          setMsg({ ok: false, text: 'The two new passwords are not the same.' });
          return;
        }
        setBusy(true);
        setMsg(null);
        try {
          const j = await postJson('/api/auth/password', { currentPassword: fd.get('currentPassword'), newPassword: fd.get('newPassword') });
          form.reset();
          setMsg({
            ok: true,
            text: j.signedOutElsewhere ? `Password changed. ${j.signedOutElsewhere} other ${j.signedOutElsewhere === 1 ? 'device was' : 'devices were'} signed out.` : 'Password changed.',
          });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block max-w-sm">
        <span className={field.label}>Current password</span>
        <input name="currentPassword" type={type} autoComplete="current-password" required className={field.input} />
      </label>
      <div className="max-w-sm">
        <label className="block">
          <span className={field.label}>New password</span>
          <input name="newPassword" type={type} autoComplete="new-password" required minLength={10} maxLength={200} aria-describedby="new-password-hint" className={field.input} />
        </label>
        {/* A description, not part of the label, so the field is announced as "New password" and the hint follows. */}
        <p id="new-password-hint" className={field.hint}>
          At least 10 characters. A short sentence is easier to remember than a jumble.
        </p>
      </div>
      <label className="block max-w-sm">
        <span className={field.label}>New password again</span>
        <input name="confirm" type={type} autoComplete="new-password" required minLength={10} maxLength={200} className={field.input} />
      </label>
      <label className="flex items-center gap-2 text-[14px] text-ink-2">
        <input type="checkbox" className="h-4 w-4 accent-brass" checked={show} onChange={(e) => setShow(e.target.checked)} />
        Show passwords
      </label>
      <Status msg={msg} />
      <button className={btn.primary} disabled={busy}>
        {busy ? 'Saving…' : 'Change password'}
      </button>
    </form>
  );
}

/** For an account that signs in with Google only: emails a link to choose a password, as "Forgot your password?" does. */
export function AddPasswordByEmail({ email }: { email: string }) {
  const [msg, setMsg] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <button
        type="button"
        className={btn.secondary}
        disabled={busy || !!msg?.ok}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            await postJson('/api/auth/forgot', { email });
            setMsg({ ok: true, text: `We sent a link to ${email}. Open it within an hour to choose your password.` });
          } catch (err) {
            setMsg({ ok: false, text: (err as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Sending…' : 'Email me a link to set a password'}
      </button>
      <Status msg={msg} />
    </div>
  );
}

export function SignOutElsewhere({ others }: { others: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState<Message>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-ink-2">
        {others > 0
          ? `You are also signed in on ${others} other ${others === 1 ? 'device or browser' : 'devices or browsers'}.`
          : 'You are not signed in anywhere else.'}{' '}
        Signing them out is a good idea if you used a shared computer or lost a phone.
      </p>
      <button
        type="button"
        className={btn.secondary}
        disabled={busy || others === 0}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            const j = await postJson('/api/auth/sessions', undefined, 'DELETE');
            setMsg({ ok: true, text: j.ended ? `Signed out ${j.ended} other ${j.ended === 1 ? 'device' : 'devices'}.` : 'There was nobody else to sign out.' });
            router.refresh();
          } catch (err) {
            setMsg({ ok: false, text: (err as Error).message });
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Signing out…' : 'Sign out everywhere else'}
      </button>
      <Status msg={msg} />
    </div>
  );
}
