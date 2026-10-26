'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useDialogs } from '@/components/ui/Dialogs';
import { btn, card, field } from '@/components/ui/styles';
import { normaliseImageFile } from '@/components/editor/assets';
import { postJson } from './client-utils';

type Asset = { id: string; kind: string; name: string; width: number; height: number; size: number };

const KIND_LABEL: Record<string, string> = { signature: 'Signature', logo: 'Logo', seal: 'Seal or stamp', background: 'Background', image: 'Image' };

export function Library({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const { confirm, toast } = useDialogs();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState('signature');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});

  // Images are private, so they're fetched with the session and shown as object URLs.
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    Promise.all(
      assets.map(async (a) => {
        const r = await fetch(`/api/assets/${a.id}`);
        if (!r.ok) return null;
        const u = URL.createObjectURL(await r.blob());
        made.push(u);
        return [a.id, u] as const;
      }),
    ).then((pairs) => alive && setUrls(Object.fromEntries(pairs.filter(Boolean) as [string, string][])));
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [assets]);

  async function remove(a: Asset) {
    const ok = await confirm({
      title: 'Remove this image?',
      message: `“${a.name}” will be removed from your library. Certificates already issued keep it.`,
      confirmLabel: 'Remove image',
      tone: 'danger',
    });
    if (!ok) return;
    setRemoving(a.id);
    try {
      await postJson(`/api/assets/${a.id}`, undefined, 'DELETE');
      router.refresh();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setRemoving(null);
    }
  }

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const blob = await normaliseImageFile(file, kind !== 'background' && kind !== 'image');
      const fd = new FormData();
      fd.append('file', new File([blob], file.name, { type: blob.type }));
      fd.append('kind', kind);
      const res = await fetch('/api/assets', { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? 'Upload failed.');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={`${card} flex flex-wrap items-end gap-3 p-5`}>
        <label className="min-w-48">
          <span className={field.label}>This image is a</span>
          <select className={field.input} value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ''; }} />
        <button type="button" className={btn.primary} disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : 'Upload image'}</button>
        <p className="w-full text-[13.5px] text-muted">For signatures, sign on white paper, photograph it in good light, and remove the background (or upload a transparent PNG). Images are private to your account.</p>
        {error && <p role="alert" className="w-full text-[14px] text-revoked">{error}</p>}
      </div>
      {assets.length === 0 ? (
        <p className="mt-6 text-[15px] text-ink-2">No images yet. Images you upload in the editor also appear here.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((a) => (
            <li key={a.id} className={`${card} overflow-hidden`}>
              <div className="flex h-36 items-center justify-center bg-[repeating-conic-gradient(#F2EEE6_0%_25%,#FFFDFA_0%_50%)] bg-[length:16px_16px] p-3">
                {urls[a.id] ? <img src={urls[a.id]} alt={a.name} className="max-h-full max-w-full object-contain" /> : <span className="text-[13px] text-muted">Loading…</span>}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-rule px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium">{a.name}</span>
                  <span className="text-[12.5px] text-muted">{KIND_LABEL[a.kind]} · {a.width}×{a.height}</span>
                </span>
                <button type="button" className={btn.small + ' text-revoked hover:bg-revoked-soft'} disabled={removing === a.id} onClick={() => remove(a)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
