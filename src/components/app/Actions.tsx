'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { DesignKind } from '@/lib/design';
import { useDialogs } from '@/components/ui/Dialogs';
import { btn, field } from '@/components/ui/styles';
import { postJson, useCopy } from './client-utils';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="min-h-10 w-full rounded-lg px-3 text-left text-[14.5px] text-ink-2 hover:bg-rule/60"
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

/** The PDF and image builders and what goes with them, loaded only when a download is asked for. */
function loadPdfTools() {
  return Promise.all([
    import('@/components/editor/pdf'),
    import('@/components/editor/assets'),
    import('@/lib/design'),
    import('@/components/editor/photo-files'),
    import('@/components/editor/images'),
    import('@/components/editor/fonts'),
  ]);
}

type Format = 'pdf' | 'jpg';

async function renderAndDownload(serial: string, format: Format, photo?: File) {
  const [{ buildPdf, downloadBytes, safeFilename }, { AssetStore, photoSide }, { photoFields }, , { downloadImages }] = await loadPdfTools();
  const res = await fetch(`/api/certificates/${serial}/render`);
  const j = await res.json();
  if (!res.ok) throw new Error(j.error ?? 'Could not load the certificate.');
  const assets = new AssetStore();
  const values: Record<string, string> = { ...j.values };
  // The photo was never stored, so the one chosen now is put where the card names its photo.
  if (photo) for (const f of photoFields(j.design)) assets.addPhoto((values[f.key] ||= photo.name), photo, photoSide(j.design));
  const job = { design: j.design, values, serial: j.serial, verifyUrl: j.verifyUrl };
  if (format === 'jpg') await downloadImages([job], assets, safeFilename(j.values.recipient_name ?? 'image'));
  else downloadBytes(await buildPdf([job], assets), `${safeFilename(j.values.recipient_name ?? 'certificate')}-${serial}.pdf`);
}

/** "Choose a photo" for a document whose photo is not kept, as a button that opens the file picker. */
function PhotoButton({ multiple = false, disabled, onFiles, children }: { multiple?: boolean; disabled?: boolean; onFiles: (files: File[]) => void; children: React.ReactNode }) {
  return (
    <label className={`${btn.small} cursor-pointer border border-rule-2 hover:bg-card has-focus-visible:ring-2 has-focus-visible:ring-accent ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <input
        type="file"
        multiple={multiple}
        accept={multiple ? 'image/jpeg,image/png,image/webp,.zip,application/zip' : 'image/jpeg,image/png,image/webp'}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
      {children}
    </label>
  );
}

export function CertificateActions({ serial, verifyUrl, revoked, photo = false }: { serial: string; verifyUrl: string; revoked: boolean; photo?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Format | null>(null);
  // Which download is waiting for this person's photo to be chosen again.
  const [askPhoto, setAskPhoto] = useState<Format | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, copy] = useCopy();

  async function download(format: Format, file?: File) {
    setBusy(format);
    setError(null);
    try {
      await renderAndDownload(serial, format, file);
      setAskPhoto(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const ask = (format: Format) => (photo ? setAskPhoto((v) => (v === format ? null : format)) : download(format));

  return (
    <div className="flex flex-wrap items-center justify-start gap-1 md:justify-end">
      <button type="button" className={btn.small + ' hover:bg-rule/60'} disabled={!!busy} aria-expanded={photo ? askPhoto === 'pdf' : undefined} onClick={() => ask('pdf')}>
        {busy === 'pdf' ? 'Building…' : 'PDF'}
      </button>
      <button type="button" className={btn.small + ' hover:bg-rule/60'} disabled={!!busy} aria-expanded={photo ? askPhoto === 'jpg' : undefined} onClick={() => ask('jpg')}>
        {busy === 'jpg' ? 'Building…' : 'Image'}
      </button>
      <button type="button" className={btn.small + ' hover:bg-rule/60'} onClick={() => copy(verifyUrl)}>
        {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Could not copy' : 'Copy link'}
        <span className="sr-only" role="status">{copied === 'copied' ? 'Link copied' : copied === 'failed' ? 'Could not copy the link' : ''}</span>
      </button>
      {!revoked && (
        <button type="button" className={btn.small + ' text-revoked hover:bg-revoked-soft'} onClick={() => setRevoking((v) => !v)}>Revoke</button>
      )}
      {askPhoto && (
        <div className="mt-2 flex w-full flex-wrap items-center gap-2 text-[12.5px] text-ink-2 md:justify-end">
          <span>Photos aren’t kept, so add this person’s again:</span>
          <PhotoButton disabled={!!busy} onFiles={([f]) => download(askPhoto, f)}>Choose photo</PhotoButton>
          <button type="button" className={btn.small + ' hover:bg-rule/60'} disabled={!!busy} onClick={() => download(askPhoto)}>Without photo</button>
        </div>
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

type Layout = 'copies' | 'sheets' | 'cards' | 'pdf' | 'images';

/** The ways a batch of each kind can come: cards on A4 sheets or at card size, documents as PDFs, anything as images. */
const LAYOUTS: Record<DesignKind, [Layout, string][]> = {
  certificate: [['pdf', 'PDF'], ['images', 'Images (JPG)']],
  'id-card': [['sheets', 'A4 sheets with cut marks'], ['cards', 'Card size'], ['images', 'Images (JPG)']],
  'visiting-card': [['copies', 'A4, a full sheet per person'], ['sheets', 'A4, one card each'], ['cards', 'Card size'], ['images', 'Images (JPG)']],
  invitation: [['pdf', 'PDF'], ['images', 'Images (JPG)']],
};

/**
 * Downloads a whole batch again, in any of its kind's layouts. Since photos are never kept, a batch
 * with photos asks for them again (files or a ZIP), matched by the file names its rows recorded.
 */
export function BatchDownload({ batchId, kind, photos = false }: { batchId: string; kind: DesignKind; photos?: boolean }) {
  const { toast } = useDialogs();
  const [state, setState] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const layouts = LAYOUTS[kind];
  const [layout, setLayout] = useState<Layout>(layouts[0][0]);

  async function download(files: File[] = []) {
    try {
      setState('Loading…');
      const [{ buildPdf, buildSheetPdf, downloadBytes, safeFilename }, { AssetStore, photoSide }, { photoFields, photoName }, { readPhotoFiles }, { downloadImages }] = await loadPdfTools();
      const res = await fetch(`/api/batches/${batchId}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'Could not load the batch.');
      const jobs = (j.certificates as { serial: string; verifyUrl: string; values: Record<string, string> }[]).map((c) => ({ design: j.design, values: c.values, serial: c.serial, verifyUrl: c.verifyUrl }));
      const assets = new AssetStore();
      let matched = 0;
      if (files.length) {
        setState('Reading photos…');
        const { photos: found } = await readPhotoFiles(files);
        const names = new Set(found.map((p) => photoName(p.name)));
        for (const p of found) assets.addPhoto(p.name, p.file, photoSide(j.design));
        const keys = photoFields(j.design).map((f) => f.key);
        matched = jobs.filter((job) => keys.some((k) => job.values[k] && names.has(photoName(job.values[k])))).length;
      }
      if (layout === 'images') {
        await downloadImages(jobs, assets, safeFilename(j.name), { onProgress: (d, t) => setState(`${d}/${t}`) });
      } else {
        const sheets = layout === 'sheets' || layout === 'copies';
        // About 250 pages a file; for shared sheets, a whole number of sheets of 9 or of 10.
        const per = layout === 'sheets' ? 270 : 250;
        const base = `${safeFilename(j.name)}${sheets ? '-A4' : ''}`;
        const parts: Uint8Array[] = [];
        for (let s = 0; s < jobs.length; s += per) {
          const part = jobs.slice(s, s + per);
          const progress = (d: number) => setState(`${s + d}/${jobs.length}`);
          parts.push(sheets ? await buildSheetPdf(part, assets, progress, { fill: layout === 'copies' }) : await buildPdf(part, assets, progress));
        }
        if (parts.length === 1) downloadBytes(parts[0], `${base}.pdf`);
        else {
          const JSZip = (await import('jszip')).default;
          const zip = new JSZip();
          parts.forEach((p, i) => zip.file(`${base}-part-${i + 1}.pdf`, p));
          downloadBytes(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `${safeFilename(j.name)}.zip`, 'application/zip');
        }
      }
      if (files.length && matched < jobs.length) toast(`${jobs.length - matched} of ${jobs.length} had no matching photo and were built without one.`, 'error');
      setOpen(false);
    } catch (e) {
      toast((e as Error).message || 'Download failed.', 'error');
    } finally {
      setState(null);
    }
  }

  return (
    <>
      <button type="button" className={btn.small + ' hover:bg-rule/60'} disabled={!!state} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {state ?? 'Download all'}
      </button>
      {open && (
        <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-2">
          <fieldset className="flex flex-wrap gap-x-4 gap-y-1">
            <legend className="sr-only">Layout</legend>
            {layouts.map(([id, label]) => (
              <label key={id} className="flex items-center gap-1.5">
                <input type="radio" name={`layout-${batchId}`} className="accent-accent" checked={layout === id} onChange={() => setLayout(id)} />
                {label}
              </label>
            ))}
          </fieldset>
          {photos ? (
            <span className="flex flex-wrap items-center gap-2">
              <span>Photos aren’t kept, so add them again:</span>
              <PhotoButton multiple disabled={!!state} onFiles={download}>Choose photos or a ZIP</PhotoButton>
              <button type="button" className={btn.small + ' hover:bg-rule/60'} disabled={!!state} onClick={() => download()}>Without photos</button>
            </span>
          ) : (
            <button type="button" className={btn.small + ' border border-rule-2 hover:bg-card'} disabled={!!state} onClick={() => download()}>Download</button>
          )}
        </div>
      )}
    </>
  );
}

export function DeleteTemplateButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { confirm, toast } = useDialogs();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" className={btn.small + ' text-revoked hover:bg-revoked-soft'} disabled={busy} onClick={async () => {
      const ok = await confirm({
        title: 'Delete this template?',
        message: `“${name}” will be removed. Certificates already issued from it are not affected.`,
        confirmLabel: 'Delete template',
        tone: 'danger',
      });
      if (!ok) return;
      setBusy(true);
      try {
        await postJson(`/api/templates/${id}`, undefined, 'DELETE');
        router.refresh();
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setBusy(false);
      }
    }}>
      Delete
    </button>
  );
}
