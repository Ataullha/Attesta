'use client';

import './fonts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { designSchema, type Design, type DesignElement, type ElementType, type Field } from '@/lib/design';
import { cleanValues } from '@/lib/values';
import { site } from '@/lib/site';
import { btn } from '@/components/ui/styles';
import { AssetStore, normaliseImageFile, type ImageRef } from './assets';
import { buildPdf, downloadBytes, safeFilename } from './pdf';
import { Stage } from './Stage';
import { Inspector, type ElementAction } from './Inspector';
import { LeftPanel } from './LeftPanel';
import { IssuePanel, type IssueError, type IssueResult } from './IssuePanel';
import { makeElement, makeText, newId, sampleValues } from './elements';
import { useHistory } from './useHistory';

export type EditorUser = { name: string; credits: number; freeLeft: number; emailVerified: boolean } | null;

type Props = {
  initialDesign: Design;
  initialName: string;
  templateId: string | null;
  user: EditorUser;
  guestLimit: number;
};

const PREVIEW_SERIAL = `${site.serialPrefix}-7K2Q-9M4D-X1TB`;

export function Editor({ initialDesign, initialName, templateId: initialTemplateId, user, guestLimit }: Props) {
  const router = useRouter();
  const history = useHistory<Design>(initialDesign);
  const design = history.value;
  const [name, setName] = useState(initialName);
  const [templateId, setTemplateId] = useState(initialTemplateId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [showBoxes, setShowBoxes] = useState(true);
  const [assetVersion, setAssetVersion] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState<string | null>(initialTemplateId ? JSON.stringify([initialDesign, initialName]) : null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<IssueResult | null>(null);
  const [error, setError] = useState<IssueError | null>(null);
  const assets = useMemo(() => new AssetStore(), []);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const selected = design.elements.find((e) => e.id === selectedId) ?? null;
  const previewValues = useMemo(
    () => ({ ...sampleValues(design, values), serial: PREVIEW_SERIAL, verify_url: `${site.url}/verify/${PREVIEW_SERIAL}` }),
    [design, values],
  );

  const snapshot = useMemo(() => JSON.stringify([design, name]), [design, name]);
  const dirty = saved !== snapshot;
  const saveState = saving ? 'saving' : dirty ? 'dirty' : 'saved';

  useEffect(() => {
    if (!user || !dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty, user]);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 4000);
  }, []);

  const patchSelected = useCallback(
    (patch: Partial<DesignElement>, mode: 'live' | 'set') => {
      if (!selectedId) return;
      const fn = (d: Design) => ({ ...d, elements: d.elements.map((e) => (e.id === selectedId ? ({ ...e, ...patch } as DesignElement) : e)) });
      if (mode === 'live') history.setLive(fn);
      else history.set(fn);
    },
    [selectedId, history],
  );

  function addElement(type: ElementType, role?: 'signature' | 'logo' | 'image') {
    const el = type === 'text' ? makeText(design) : makeElement(type, design, role);
    history.set((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }

  function addFieldBox(f: Field) {
    const el = makeText(design, { content: `{{${f.key}}}`, name: f.label, shrink: true, size: 24, h: 44 });
    // Find the first vertical slot (from the middle downwards, then upwards) not covered by
    // anything except page-sized frames, so the new box doesn't land on existing text.
    const { width: W, height: H } = design.page;
    const blockers = design.elements.filter((e) => !(e.w > W * 0.8 && e.h > H * 0.8));
    const free = (y: number) => blockers.every((b) => y + el.h <= b.y || y >= b.y + b.h || el.x + el.w <= b.x || el.x >= b.x + b.w);
    const start = H / 2 - el.h / 2;
    for (let step = 0; step < 40; step++) {
      const y = step % 2 === 0 ? start + (step / 2) * 24 : start - ((step + 1) / 2) * 24;
      if (y > 20 && y + el.h < H - 20 && free(y)) {
        el.y = y;
        break;
      }
    }
    history.set((d) => ({ ...d, fields: d.fields.some((x) => x.key === f.key) ? d.fields : [...d.fields, f], elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }

  const action = useCallback(
    (a: ElementAction) => {
      if (!selectedId) return;
      history.set((d) => {
        const i = d.elements.findIndex((e) => e.id === selectedId);
        if (i < 0) return d;
        const els = [...d.elements];
        const el = els[i];
        switch (a) {
          case 'delete':
            if (el.locked) return d;
            els.splice(i, 1);
            break;
          case 'duplicate': {
            const copy = { ...el, id: newId(el.type[0]), x: el.x + 16, y: el.y + 16, locked: false } as DesignElement;
            els.splice(i + 1, 0, copy);
            setTimeout(() => setSelectedId(copy.id));
            break;
          }
          case 'forward':
            if (i < els.length - 1) [els[i], els[i + 1]] = [els[i + 1], els[i]];
            break;
          case 'backward':
            if (i > 0) [els[i], els[i - 1]] = [els[i - 1], els[i]];
            break;
          case 'front':
            els.push(els.splice(i, 1)[0]);
            break;
          case 'back':
            els.unshift(els.splice(i, 1)[0]);
            break;
          case 'lock':
            els[i] = { ...el, locked: !el.locked };
            break;
        }
        return { ...d, elements: els };
      });
      if (a === 'delete') setSelectedId(null);
    },
    [selectedId, history],
  );

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) history.redo();
        else history.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        history.redo();
        return;
      }
      if (!selectedId) return;
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        action('duplicate');
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        action('delete');
      } else if (e.key === 'Escape') {
        setSelectedId(null);
      } else if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        history.set((d) => ({ ...d, elements: d.elements.map((el) => (el.id === selectedId && !el.locked ? { ...el, x: el.x + dx, y: el.y + dy } : el)) }));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, history, action]);

  async function uploadImage(file: File, kind: 'signature' | 'logo' | 'seal' | 'background' | 'image'): Promise<ImageRef & { width: number; height: number }> {
    const blob = await normaliseImageFile(file, kind === 'signature' || kind === 'seal' || kind === 'logo');
    const dims = await new Promise<{ width: number; height: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({ width: 0, height: 0 });
      img.src = URL.createObjectURL(blob);
    });
    if (!dims.width) throw new Error('That file could not be read as an image.');
    if (!user) return { assetId: null, localId: assets.addLocal(blob), ...dims };
    const fd = new FormData();
    fd.append('file', new File([blob], file.name || 'image', { type: blob.type }));
    fd.append('kind', kind);
    const res = await fetch('/api/assets', { method: 'POST', body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error ?? 'Upload failed.');
    return { assetId: j.id, localId: null, ...dims };
  }

  async function onUploadForSelected(file: File) {
    if (!selected || selected.type !== 'image') return;
    setUploading(true);
    try {
      const kind = selected.role === 'image' ? 'image' : selected.role;
      const ref = await uploadImage(file, kind);
      history.set((d) => ({
        ...d,
        elements: d.elements.map((e) => (e.id === selected.id ? ({ ...e, assetId: ref.assetId, localId: ref.localId } as DesignElement) : e)),
      }));
      setAssetVersion((v) => v + 1);
    } catch (err) {
      flash((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function onBackground(file: File, matchPage: boolean) {
    setUploading(true);
    try {
      const ref = await uploadImage(file, 'background');
      history.set((d) => {
        let { width, height } = d.page;
        if (matchPage && ref.width && ref.height) {
          const long = 1123;
          if (ref.width >= ref.height) {
            width = long;
            height = Math.round((long * ref.height) / ref.width);
          } else {
            height = long;
            width = Math.round((long * ref.width) / ref.height);
          }
        }
        const sx = width / d.page.width;
        const sy = height / d.page.height;
        return {
          ...d,
          page: { width, height, background: { ...d.page.background, assetId: ref.assetId, localId: ref.localId, fit: 'stretch' } },
          elements: d.elements.map((el) => ({ ...el, x: el.x * sx, y: el.y * sy, w: el.w * sx, h: el.h * sy })),
        };
      });
      setAssetVersion((v) => v + 1);
      flash('Background added. Now drag the field boxes to where the text should go.');
    } catch (err) {
      flash((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!user) {
      router.push(`/login?next=${encodeURIComponent('/create')}`);
      return;
    }
    const parsed = designSchema.safeParse(design);
    if (!parsed.success) {
      flash(`Can’t save yet: ${parsed.error.issues[0]?.message}`);
      return;
    }
    setSaving(true);
    const res = await fetch(templateId ? `/api/templates/${templateId}` : '/api/templates', {
      method: templateId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() || 'Untitled template', design }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      flash(j.error ?? 'Saving failed.');
      return;
    }
    if (!templateId && j.id) {
      setTemplateId(j.id);
      window.history.replaceState(null, '', `/create?template=${j.id}`);
    }
    setSaved(snapshot);
    flash('Template saved.');
  }

  async function issue() {
    setError(null);
    setResult(null);
    const clean = cleanValues(design, values);
    if (!clean.ok) {
      setError({ message: clean.errors.join('. ') + '.' });
      return;
    }
    const parsed = designSchema.safeParse(design);
    if (!parsed.success) {
      setError({ message: `The design has a problem: ${parsed.error.issues[0]?.message}` });
      return;
    }
    setBusy(true);
    setProgress('Registering…');
    try {
      const res = await fetch('/api/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ design, templateId, mode: 'single', batchName: name || 'Single certificate', recipients: [{ values: clean.values }] }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError({ message: j.error ?? 'Issuing failed.', code: j.code });
        return;
      }
      const { serial, verifyUrl } = j.issued[0] as { serial: string; verifyUrl: string };
      setProgress('Building PDF…');
      const pdf = await buildPdf([{ design, values: clean.values, serial, verifyUrl, watermark: !!j.guest }], assets);
      downloadBytes(pdf, `${safeFilename(clean.values.recipient_name)}-${serial}.pdf`);
      setResult({ serial, verifyUrl, guest: !!j.guest, remaining: j.remaining });
      if (!j.guest) router.refresh();
    } catch (err) {
      setError({ message: (err as Error).message || 'Something went wrong.' });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const quotaNote = user
    ? `${user.freeLeft} free certificate${user.freeLeft === 1 ? '' : 's'} left this month${user.credits ? ` · ${user.credits.toLocaleString()} package credits` : ''}. Each certificate gets a permanent verification page.`
    : `Without an account you can make ${guestLimit} watermarked certificates. A free account gives you verifiable ones.`;

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <header className="flex min-h-14 flex-wrap items-center gap-2 border-b border-rule bg-card px-3 py-2 sm:gap-3 sm:px-4">
        <Link href={user ? '/app' : '/'} className="mr-1 font-serif text-[22px] leading-none text-ink">
          {site.name}
        </Link>
        <span className="hidden h-6 w-px bg-rule sm:block" />
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Template name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="w-full rounded-[4px] border border-transparent bg-transparent px-2 py-1.5 text-[15px] hover:border-rule focus:border-brass focus:outline-none" />
        </label>
        <span className="hidden text-[12.5px] text-muted md:block" aria-live="polite">
          {user ? (saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved changes') : 'Guest mode — sign in to save'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" className={btn.small + ' text-ink-2 hover:bg-rule/60'} onClick={history.undo} disabled={!history.canUndo} aria-label="Undo">
            Undo
          </button>
          <button type="button" className={btn.small + ' text-ink-2 hover:bg-rule/60'} onClick={history.redo} disabled={!history.canRedo} aria-label="Redo">
            Redo
          </button>
          <label className="ml-1 hidden items-center gap-1.5 text-[13px] text-ink-2 sm:flex">
            <input type="checkbox" className="h-4 w-4 accent-brass" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} />
            Show field boxes
          </label>
          <button type="button" className={btn.small + ' ml-1 bg-ink text-card hover:bg-ink-2'} onClick={save} disabled={saveState === 'saving'}>
            {user ? 'Save template' : 'Sign in to save'}
          </button>
        </div>
      </header>

      {notice && (
        <div role="status" className="border-b border-brass/30 bg-brass-soft px-4 py-2 text-[13.5px] text-ink">
          {notice}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="order-2 max-h-[45dvh] shrink-0 border-t border-rule bg-paper lg:order-1 lg:max-h-none lg:w-[300px] lg:border-r lg:border-t-0">
          <LeftPanel
            design={design}
            selectedId={selectedId}
            setDesign={(fn) => history.set(fn)}
            onAdd={addElement}
            onAddFieldBox={addFieldBox}
            onSelect={setSelectedId}
            onBackground={onBackground}
            uploading={uploading}
          />
        </aside>

        <main className="order-1 h-[52dvh] min-w-0 flex-1 lg:order-2 lg:h-auto">
          <Stage
            design={design}
            values={previewValues}
            assets={assets}
            assetVersion={assetVersion}
            selectedId={selectedId}
            showBoxes={showBoxes}
            onSelect={setSelectedId}
            onChangeLive={(fn) => history.setLive(fn)}
            onCommit={history.commit}
            onEditText={(id) => {
              setSelectedId(id);
              setTimeout(() => contentRef.current?.focus(), 30);
            }}
          />
        </main>

        <aside className="order-3 shrink-0 overflow-y-auto border-t border-rule bg-paper lg:w-[330px] lg:border-l lg:border-t-0">
          {selected ? (
            <Inspector
              el={selected}
              design={design}
              live={(p) => patchSelected(p, 'live')}
              commit={history.commit}
              set={(p) => patchSelected(p, 'set')}
              onAction={action}
              onUpload={onUploadForSelected}
              uploading={uploading}
              contentRef={contentRef}
            />
          ) : (
            <IssuePanel
              design={design}
              values={values}
              onValue={(k, v) => setValues((s) => ({ ...s, [k]: v }))}
              onSettings={(p) => history.set((d) => ({ ...d, settings: { ...d.settings, ...p } }))}
              onIssue={issue}
              busy={busy}
              progress={progress}
              result={result}
              error={error}
              signedIn={!!user}
              quotaNote={quotaNote}
              templateId={templateId}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
