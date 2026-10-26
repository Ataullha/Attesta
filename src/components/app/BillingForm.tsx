'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btn, field } from '@/components/ui/styles';
import { formatMoney, packages, paymentMethods } from '@/lib/site';
import { postJson } from './client-utils';

/** `initialPackage` comes from the pricing page's "Buy" buttons (?package=), so the choice carries over. */
export function BillingForm({ initialPackage }: { initialPackage?: string }) {
  const router = useRouter();
  const [pkg, setPkg] = useState(packages.some((p) => p.id === initialPackage) ? initialPackage! : packages[0].id);
  const [method, setMethod] = useState<string>(paymentMethods[0].id);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = packages.find((p) => p.id === pkg)!;
  const m = paymentMethods.find((x) => x.id === method)!;

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const fd = new FormData(e.currentTarget);
        try {
          await postJson('/api/billing', { packageId: pkg, method, trxId: fd.get('trxId'), sender: fd.get('sender') });
          setMsg({ ok: true, text: 'Payment submitted. Credits are added as soon as it is confirmed — usually within a few hours.' });
          (e.target as HTMLFormElement).reset();
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset>
        <legend className="mb-3 text-[15px] font-semibold">1. Choose a package</legend>
        <div className="grid gap-3 md:grid-cols-3">
          {packages.map((p) => (
            <label key={p.id} className={`cursor-pointer rounded-[4px] border p-4 ${pkg === p.id ? 'border-ink bg-card' : 'border-rule bg-card/60 hover:border-rule-2'}`}>
              <input type="radio" name="pkg" className="sr-only" checked={pkg === p.id} onChange={() => setPkg(p.id)} />
              <span className="block text-[14px] text-muted">{p.name}</span>
              <span className="block font-serif text-[30px] leading-tight">{p.credits.toLocaleString()} certificates</span>
              <span className="block text-[16px] font-medium">{formatMoney(p.price)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-[15px] font-semibold">2. Pay</legend>
        <div className="flex flex-wrap gap-2">
          {paymentMethods.map((x) => (
            <label key={x.id} className={`cursor-pointer rounded-full border px-4 py-2 text-[14.5px] ${method === x.id ? 'border-ink bg-ink text-card' : 'border-rule-2'}`}>
              <input type="radio" name="method" className="sr-only" checked={method === x.id} onChange={() => setMethod(x.id)} />
              {x.label}
            </label>
          ))}
        </div>
        <p className="mt-3 rounded-[4px] border border-rule bg-card p-4 text-[15px] leading-relaxed">
          Send <strong>{formatMoney(chosen.price)}</strong> by {m.label}. {m.instructions}
        </p>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-3 text-[15px] font-semibold">3. Tell us about the payment</legend>
        <label className="block max-w-sm">
          <span className={field.label}>Transaction ID</span>
          <input name="trxId" required minLength={4} maxLength={60} className={field.input + ' font-mono uppercase'} />
        </label>
        <label className="block max-w-sm">
          <span className={field.label}>Number or account you paid from</span>
          <input name="sender" required minLength={4} maxLength={60} className={field.input} />
        </label>
      </fieldset>
      {msg && <p role="status" className={`text-[14.5px] ${msg.ok ? 'text-seal' : 'text-revoked'}`}>{msg.text}</p>}
      <button className={btn.brass} disabled={busy}>{busy ? 'Submitting…' : 'Submit payment'}</button>
    </form>
  );
}
