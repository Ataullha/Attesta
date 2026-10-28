'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { btn, field } from '@/components/ui/styles';
import { formatMoney, onlinePaymentMethods, orList, packages, paymentMethods, paymentMethodsInWords, perCertificate, savingVersusSmallest } from '@/lib/site';
import { postJson } from './client-utils';

const option = (selected: boolean) =>
  `cursor-pointer rounded-xl border p-4 has-focus-visible:ring-2 has-focus-visible:ring-accent ${selected ? 'border-accent bg-card ring-1 ring-accent' : 'border-rule bg-card/60 hover:border-rule-2'}`;

/**
 * `initialPackage` comes from the pricing page's "Buy" buttons (?package=), so the choice carries over.
 * With `online`, paying through SSLCommerz is offered first, and sending money yourself second.
 */
export function BillingForm({ initialPackage, online = false, phone = '' }: { initialPackage?: string; online?: boolean; phone?: string }) {
  const router = useRouter();
  const [pkg, setPkg] = useState(packages.some((p) => p.id === initialPackage) ? initialPackage! : packages[0].id);
  const [way, setWay] = useState<'online' | 'manual'>(online ? 'online' : 'manual');
  const [method, setMethod] = useState<string>(paymentMethods[0].id);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const chosen = packages.find((p) => p.id === pkg)!;
  const m = paymentMethods.find((x) => x.id === method)!;
  const manual = way === 'manual';

  // Coming back from the payment page with the Back button restores this page as it was left: busy.
  useEffect(() => {
    const restored = (e: PageTransitionEvent) => {
      if (e.persisted) setBusy(false);
    };
    window.addEventListener('pageshow', restored);
    return () => window.removeEventListener('pageshow', restored);
  }, []);

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const fd = new FormData(e.currentTarget);
        if (!manual) {
          try {
            const { url } = await postJson('/api/billing/checkout', { packageId: pkg, phone: fd.get('phone') });
            // Stays busy until the payment page has opened.
            window.location.assign(url);
          } catch (err) {
            setMsg({ ok: false, text: (err as Error).message });
            setBusy(false);
          }
          return;
        }
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
          {packages.map((p) => {
            const saving = savingVersusSmallest(p);
            return (
              // The radio itself is hidden, so the card shows where keyboard focus is.
              <label key={p.id} className={option(pkg === p.id)}>
                <input type="radio" name="pkg" className="sr-only" checked={pkg === p.id} onChange={() => setPkg(p.id)} />
                <span className="flex items-baseline justify-between gap-2 text-[14px] text-muted">
                  {p.name}
                  {saving > 0 && <span className="rounded-full bg-seal-soft px-2 py-px text-[12px] font-medium text-seal">Save {saving}%</span>}
                </span>
                <span className="block font-display text-[24px] leading-tight">{p.credits.toLocaleString()} certificates</span>
                <span className="block text-[16px] font-medium">{formatMoney(p.price)}</span>
                <span className="block text-[13px] text-muted">{formatMoney(perCertificate(p))} each</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 text-[15px] font-semibold">2. Pay</legend>
        {online && (
          <div className="mb-5 grid gap-3 md:grid-cols-2">
            <label className={option(!manual)}>
              <input type="radio" name="way" className="sr-only" checked={!manual} onChange={() => { setWay('online'); setMsg(null); }} />
              <span className="block text-[15.5px] font-semibold">Pay online</span>
              <span className="mt-1 block text-[14px] leading-snug text-ink-2">
                By {orList(onlinePaymentMethods)}. Credits are added as soon as the payment goes through.
              </span>
            </label>
            <label className={option(manual)}>
              <input type="radio" name="way" className="sr-only" checked={manual} onChange={() => { setWay('manual'); setMsg(null); }} />
              <span className="block text-[15.5px] font-semibold">Send money yourself</span>
              <span className="mt-1 block text-[14px] leading-snug text-ink-2">
                By {paymentMethodsInWords()}, then enter the transaction ID. Credits are added once it is confirmed, usually within a few hours.
              </span>
            </label>
          </div>
        )}
        {manual ? (
          <>
            <div className="flex flex-wrap gap-2">
              {paymentMethods.map((x) => (
                <label key={x.id} className={`cursor-pointer rounded-full border px-4 py-2 text-[14.5px] has-focus-visible:ring-2 has-focus-visible:ring-accent ${method === x.id ? 'border-accent bg-accent text-white has-focus-visible:ring-offset-2' : 'border-rule-2 bg-card'}`}>
                  <input type="radio" name="method" className="sr-only" checked={method === x.id} onChange={() => setMethod(x.id)} />
                  {x.label}
                </label>
              ))}
            </div>
            <p className="mt-3 rounded-lg border border-rule bg-card p-4 text-[15px] leading-relaxed">
              Send <strong>{formatMoney(chosen.price)}</strong> by {m.label}. {m.instructions}
            </p>
          </>
        ) : (
          <label className="block max-w-sm">
            <span className={field.label}>Mobile number</span>
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required minLength={6} maxLength={20} defaultValue={phone} aria-describedby="phone-hint" className={field.input} />
            <span id="phone-hint" className={`${field.hint} block`}>SSLCommerz asks for one with every payment.</span>
          </label>
        )}
      </fieldset>
      {manual && (
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
      )}
      {msg && <p role="status" className={`text-[14.5px] ${msg.ok ? 'text-seal' : 'text-revoked'}`}>{msg.text}</p>}
      {manual ? (
        <button className={btn.primary} disabled={busy}>{busy ? 'Submitting…' : 'Submit payment'}</button>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button className={btn.primary} disabled={busy}>{busy ? 'Opening the payment page…' : `Pay ${formatMoney(chosen.price)} online`}</button>
          <span className="text-[13.5px] text-muted">You pay on SSLCommerz’s page, then come back here.</span>
        </div>
      )}
    </form>
  );
}
