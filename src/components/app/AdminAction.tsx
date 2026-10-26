'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDialogs } from '@/components/ui/Dialogs';
import { btn } from '@/components/ui/styles';
import { postJson } from './client-utils';

/** A button that posts one admin action, optionally confirming first or asking for a note. */
export function AdminAction({ url, body, label, tone = 'neutral', confirmText, ask, askMin = 0 }: { url: string; body: Record<string, unknown>; label: string; tone?: 'neutral' | 'good' | 'bad'; confirmText?: string; ask?: string; askMin?: number }) {
  const router = useRouter();
  const dialogs = useDialogs();
  const [busy, setBusy] = useState(false);
  const cls = tone === 'good' ? 'bg-seal text-card hover:bg-[#24553F]' : tone === 'bad' ? 'text-revoked hover:bg-revoked-soft' : 'border border-rule-2 hover:bg-paper';
  return (
    <button type="button" className={`${btn.small} ${cls}`} disabled={busy} onClick={async () => {
      if (confirmText && !(await dialogs.confirm({ title: label, message: confirmText, confirmLabel: label, tone: tone === 'bad' ? 'danger' : 'neutral' }))) return;
      let extra: Record<string, unknown> = {};
      if (ask) {
        const v = await dialogs.ask({ title: label, label: ask, confirmLabel: label, minLength: askMin });
        if (v === null) return;
        extra = { note: v, reason: v };
      }
      setBusy(true);
      try {
        await postJson(url, { ...body, ...extra });
        router.refresh();
      } catch (e) {
        dialogs.toast((e as Error).message, 'error');
      } finally {
        setBusy(false);
      }
    }}>{busy ? '…' : label}</button>
  );
}

export function CreditsForm({ userId }: { userId: string }) {
  const router = useRouter();
  const { toast } = useDialogs();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form className="flex gap-1" onSubmit={async (e) => {
      e.preventDefault();
      const text = amount.trim();
      // Whole numbers only: parseInt would quietly turn "12abc" into 12.
      if (!/^[+-]?\d{1,7}$/.test(text) || Number(text) === 0) {
        toast('Enter a whole number of credits, such as 25 to add or -10 to remove.', 'error');
        return;
      }
      setBusy(true);
      try {
        await postJson(`/api/admin/users/${userId}`, { action: 'credits', amount: Number(text) });
        setAmount('');
        router.refresh();
      } catch (err) {
        toast((err as Error).message, 'error');
      } finally {
        setBusy(false);
      }
    }}>
      <label className="sr-only" htmlFor={`cr-${userId}`}>Credits to add or remove</label>
      {/* No numeric keypad: phone keypads for numbers have no minus sign, and removing credits needs one. */}
      <input id={`cr-${userId}`} value={amount} onChange={(e) => setAmount(e.target.value)} autoComplete="off" placeholder="±credits" className="min-h-9 w-24 rounded-[4px] border border-rule-2 bg-card px-2 text-[13.5px]" />
      <button className={`${btn.small} border border-rule-2 hover:bg-paper`} disabled={busy}>Apply</button>
    </form>
  );
}
