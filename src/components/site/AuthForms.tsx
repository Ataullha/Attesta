'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { btn, field } from '@/components/ui/styles';
import { safeNextPath } from '@/lib/safe-redirect';

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'Something went wrong.');
  return j;
}

/** Shown when someone arrives from the editor: what they designed is kept for them (see editor/draft.ts). */
export function DesignComesWithYou() {
  return (
    <p className="mb-6 rounded-[4px] border border-seal/30 bg-seal-soft px-3.5 py-2.5 text-[14.5px] leading-snug text-seal">
      Your design is kept. You will be back in the editor with it as soon as you are signed in.
    </p>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? <p role="alert" className="rounded-[4px] border border-revoked/30 bg-revoked-soft px-3 py-2 text-[14px] text-revoked">{error}</p> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const j = await post('/api/auth/login', { email: fd.get('email'), password: fd.get('password') });
      router.replace(next ? safeNextPath(next) : j.role === 'admin' ? '/admin' : '/app');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className={field.label}>Email</span>
        <input name="email" type="email" autoComplete="email" required className={field.input} />
      </label>
      <label className="block">
        <span className={field.label}>Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={field.input} />
      </label>
      <ErrorLine error={error} />
      <button className={btn.primary + ' w-full'} disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="text-[14px]"><Link href="/forgot-password" className="text-brass underline underline-offset-2 hover:text-brass-dark">Forgot your password?</Link></p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await post('/api/auth/register', { name: fd.get('name'), email: fd.get('email'), password: fd.get('password') });
      router.replace(safeNextPath(next));
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className={field.label}>Your name</span>
        <input name="name" autoComplete="name" required minLength={2} maxLength={80} className={field.input} />
      </label>
      <label className="block">
        <span className={field.label}>Email</span>
        <input name="email" type="email" autoComplete="email" required className={field.input} />
      </label>
      <label className="block">
        <span className={field.label}>Password</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={10} className={field.input} />
        <span className={field.hint}>At least 10 characters. A short sentence is easier to remember.</span>
      </label>
      <ErrorLine error={error} />
      <button className={btn.primary + ' w-full'} disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      <p className="text-[13px] leading-snug text-muted">
        By creating an account you agree to the <Link href="/terms" className="underline">terms</Link> and <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    await post('/api/auth/forgot', { email: new FormData(e.currentTarget).get('email') }).catch(() => null);
    setSent(true);
  }
  if (sent) return <p className="text-[16px] leading-relaxed text-ink-2">If an account uses that email, a reset link is on its way. It works for one hour.</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className={field.label}>Email</span>
        <input name="email" type="email" autoComplete="email" required className={field.input} />
      </label>
      <button className={btn.primary + ' w-full'} disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await post('/api/auth/reset', { token, password: new FormData(e.currentTarget).get('password') });
      router.replace('/app');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className={field.label}>New password</span>
        <input name="password" type="password" autoComplete="new-password" required minLength={10} className={field.input} />
      </label>
      <ErrorLine error={error} />
      <button className={btn.primary + ' w-full'} disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</button>
    </form>
  );
}

export function VerifyEmailRunner({ token }: { token: string }) {
  const [state, setState] = useState<'working' | 'done' | 'error'>('working');
  const [error, setError] = useState('');
  // The link can be spent once. React Strict Mode runs effects twice in development, and the second
  // request would turn a successful confirmation into an "already used" error.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    post('/api/auth/verify-email', { token })
      .then(() => setState('done'))
      .catch((e: Error) => {
        setError(e.message);
        setState('error');
      });
  }, [token]);
  if (state === 'working') return <p className="text-ink-2">Confirming your email…</p>;
  if (state === 'error') return <ErrorLine error={error} />;
  return (
    <div>
      <p className="text-[16px] text-seal">Your email is confirmed. You can issue verifiable certificates now.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link href="/create" className={btn.primary}>Make a certificate</Link>
        <Link href="/app" className={btn.secondary}>Go to your dashboard</Link>
      </div>
    </div>
  );
}
