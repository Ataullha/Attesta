'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btn, field } from '@/components/ui/styles';
import { postJson } from './client-utils';

export function OrgForm({ initial }: { initial: { name: string; domain: string; website: string } }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg(null);
        const fd = new FormData(e.currentTarget);
        try {
          const j = await postJson('/api/org', { name: fd.get('name'), domain: fd.get('domain'), website: fd.get('website') });
          setMsg({ ok: true, text: j.reverify ? 'Saved. Because the name or domain changed, verification starts again.' : 'Saved.' });
          router.refresh();
        } catch (err) {
          setMsg({ ok: false, text: (err as Error).message });
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block">
        <span className={field.label}>Organisation name, as it should appear on verification pages</span>
        <input name="name" required minLength={2} maxLength={120} defaultValue={initial.name} className={field.input} />
      </label>
      <label className="block">
        <span className={field.label}>Domain you control</span>
        <input name="domain" defaultValue={initial.domain} placeholder="example.edu.bd" className={field.input} />
        <span className={field.hint}>Needed for the verified badge. Use the domain of your official website or email.</span>
      </label>
      <label className="block">
        <span className={field.label}>Website (optional)</span>
        <input name="website" type="url" defaultValue={initial.website} placeholder="https://example.edu.bd" className={field.input} />
      </label>
      {msg && <p role="status" className={`text-[14px] ${msg.ok ? 'text-seal' : 'text-revoked'}`}>{msg.text}</p>}
      <button className={btn.primary} disabled={busy}>{busy ? 'Saving…' : 'Save organisation'}</button>
    </form>
  );
}

export function DnsCheck() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <button type="button" className={btn.seal} disabled={busy} onClick={async () => {
        setBusy(true);
        setMsg(null);
        try {
          await postJson('/api/org/check', {});
          setMsg({ ok: true, text: 'Record found. Your organisation is now waiting for a quick manual review.' });
          router.refresh();
        } catch (e) {
          setMsg({ ok: false, text: (e as Error).message });
        } finally {
          setBusy(false);
        }
      }}>{busy ? 'Checking…' : 'Check DNS record'}</button>
      {msg && <p role="status" className={`mt-3 text-[14px] ${msg.ok ? 'text-seal' : 'text-revoked'}`}>{msg.text}</p>}
    </div>
  );
}
