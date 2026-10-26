'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btn, field } from '@/components/ui/styles';
import { postJson } from './client-utils';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="min-h-10 w-full rounded-[4px] px-3 text-left text-[14.5px] text-ink-2 hover:bg-rule/60"
      onClick={async () => {
        await postJson('/api/auth/logout', {}).catch(() => null);
        router.replace('/');
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function ResendVerification() {
  const [state, setState] = useState<'idle' | 'sent' | 'error'>('idle');
  return (
    <button
      type="button"
      className="font-medium underline"
      disabled={state === 'sent'}
      onClick={() => postJson('/api/auth/resend', {}).then(() => setState('sent')).catch(() => setState('error'))}
    >
      {state === 'sent' ? 'Sent — check your inbox' : state === 'error' ? 'Try again later' : 'Send the link again'}
    </button>
  );
}

async function renderAndDownload(serial: string) {
  const [{ buildPdf, downloadBytes, safeFilename }, { AssetStore }] = await Promise.all([import('@/components/editor/pdf'), import('@/components/editor/assets'), import('@/components/editor/fonts')]);
  const res = await fetch(`/api/certificates/${serial}/render`);
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? 'Could not load the certificate.');
  const pdf = await buildPdf([{ design: j.design, values: j.values, serial: j.serial, verifyUrl: j.verifyUrl }], new AssetStore());
  downloadBytes(pdf, `${safeFilename(j.values.recipient_name ?? 'certificate')}-${serial}.pdf`);
}

export function CertificateActions({ serial, verifyUrl, revoked }: { serial: string; verifyUrl: string; revoked: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-start gap-1 md:justify-end">
      <button type="button" className={btn.small + ' hover:bg-rule/60'} disabled={busy} onClick={async () => {
        setBusy(true);
        setError(null);
        try { await renderAndDownload(serial); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
      }}>
        {busy ? 'Building…' : 'PDF'}
      </button>
      <button type="button" className={btn.small + ' hover:bg-rule/60'} onClick={() => { navigator.clipboard?.writeText(verifyUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? 'Copied' : 'Copy link'}
      </button>
      {!revoked && (
        <button type="button" className={btn.small + ' text-revoked hover:bg-revoked-soft'} onClick={() => setRevoking((v) => !v)}>Revoke</button>
      )}
      {revoking && (
        <form className="mt-2 flex w-full gap-2" onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            await postJson(`/api/certificates/${serial}/revoke`, { reason });
            setRevoking(false);
            router.refresh();
          } catch (err) { setError((err as Error).message); }
        }}>
          <input className={field.small} placeholder="Reason, shown publicly" value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} required autoFocus />
          <button className={btn.small + ' bg-revoked text-card'}>Confirm</button>
        </form>
      )}
      {error && <p role="alert" className="w-full text-[12.5px] text-revoked md:text-right">{error}</p>}
    </div>
  );
}

export function BatchDownload({ batchId }: { batchId: string }) {
  const [state, setState] = useState<string | null>(null);
  return (
    <button type="button" className={btn.small + ' hover:bg-rule/60'} disabled={!!state} onClick={async () => {
      try {
        setState('Loading…');
        const [{ buildPdf, downloadBytes, safeFilename }, { AssetStore }] = await Promise.all([import('@/components/editor/pdf'), import('@/components/editor/assets'), import('@/components/editor/fonts')]);
        const res = await fetch(`/api/batches/${batchId}`);
        const j = await res.json();
        if (!res.ok) throw new Error(j.error);
        const jobs = (j.certificates as { serial: string; verifyUrl: string; values: Record<string, string> }[]).map((c) => ({ design: j.design, values: c.values, serial: c.serial, verifyUrl: c.verifyUrl }));
        const assets = new AssetStore();
        const per = 250;
        const parts: Uint8Array[] = [];
        for (let s = 0; s < jobs.length; s += per) {
          parts.push(await buildPdf(jobs.slice(s, s + per), assets, (d) => setState(`${s + d}/${jobs.length}`)));
        }
        if (parts.length === 1) downloadBytes(parts[0], `${safeFilename(j.name)}.pdf`);
        else {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          parts.forEach((p, i) => zip.file(`${safeFilename(j.name)}-part-${i + 1}.pdf`, p));
          downloadBytes(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `${safeFilename(j.name)}.zip`, 'application/zip');
        }
      } catch (e) {
        alert((e as Error).message || 'Download failed.');
      } finally {
        setState(null);
      }
    }}>
      {state ?? 'Download all'}
    </button>
  );
}

export function DeleteTemplateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <button type="button" className={btn.small + ' text-revoked hover:bg-revoked-soft'} onClick={async () => {
      if (!confirm(`Delete the template “${name}”? Certificates already issued are not affected.`)) return;
      await postJson(`/api/templates/${id}`, undefined, 'DELETE').catch((e) => alert(e.message));
      router.refresh();
    }}>
      Delete
    </button>
  );
}
