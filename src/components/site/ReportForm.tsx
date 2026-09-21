'use client';

import { useState } from 'react';
import { btn, field } from '@/components/ui/styles';

export function ReportForm({ serial }: { serial: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setState('sending');
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serial, kind: fd.get('kind'), message: fd.get('message'), contact: fd.get('contact') }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error ?? 'Sending failed.');
      setState('idle');
      return;
    }
    setState('sent');
  }

  if (state === 'sent') return <p className="mt-4 text-[15px] text-seal">Thanks — the report was sent to our team.</p>;

  return (
    <form onSubmit={submit} className="mt-4 max-w-lg space-y-3">
      <label className="block">
        <span className={field.label}>What’s wrong?</span>
        <select name="kind" className={field.input}>
          <option value="mismatch">The details don’t match the printed certificate</option>
          <option value="deindex">I’m the recipient and want this page removed from search engines</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label className="block">
        <span className={field.label}>Details</span>
        <textarea name="message" required minLength={10} maxLength={2000} className={field.input + ' min-h-24 py-2'} />
      </label>
      <label className="block">
        <span className={field.label}>Your email or phone (optional)</span>
        <input name="contact" maxLength={200} className={field.input} />
      </label>
      {error && <p role="alert" className="text-[14px] text-revoked">{error}</p>}
      <button type="submit" className={btn.secondary} disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Send report'}
      </button>
    </form>
  );
}
