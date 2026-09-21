'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btn } from '@/components/ui/styles';
import { postJson } from './client-utils';

/** A button that posts one admin action, optionally asking for a note first. */
export function AdminAction({ url, body, label, tone = 'neutral', confirmText, ask }: { url: string; body: Record<string, unknown>; label: string; tone?: 'neutral' | 'good' | 'bad'; confirmText?: string; ask?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const cls = tone === 'good' ? 'bg-seal text-card hover:bg-[#24553F]' : tone === 'bad' ? 'text-revoked hover:bg-revoked-soft' : 'border border-rule-2 hover:bg-paper';
  return (
    <button type="button" className={`${btn.small} ${cls}`} disabled={busy} onClick={async () => {
      if (confirmText && !confirm(confirmText)) return;
      let extra: Record<string, unknown> = {};
      if (ask) {
        const v = prompt(ask);
        if (v === null) return;
        extra = { note: v, reason: v };
      }
      setBusy(true);
      try {
        await postJson(url, { ...body, ...extra });
        router.refresh();
      } catch (e) {
        alert((e as Error).message);
      } finally {
        setBusy(false);
      }
    }}>{busy ? '…' : label}</button>
  );
}

export function CreditsForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  return (
    <form className="flex gap-1" onSubmit={async (e) => {
      e.preventDefault();
      const n = parseInt(amount, 10);
      if (!Number.isFinite(n) || n === 0) return;
      try {
        await postJson(`/api/admin/users/${userId}`, { action: 'credits', amount: n });
        setAmount('');
        router.refresh();
      } catch (err) { alert((err as Error).message); }
    }}>
      <label className="sr-only" htmlFor={`cr-${userId}`}>Credits to add or remove</label>
      <input id={`cr-${userId}`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" placeholder="±credits" className="min-h-9 w-24 rounded-[4px] border border-rule-2 bg-card px-2 text-[13.5px]" />
      <button className={`${btn.small} border border-rule-2 hover:bg-paper`}>Apply</button>
    </form>
  );
}
