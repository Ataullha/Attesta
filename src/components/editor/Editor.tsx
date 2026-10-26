'use client';

import './fonts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { designSchema, type Design, type DesignElement, type ElementType, type Field } from '@/lib/design';
import { cleanValues } from '@/lib/values';
import { site } from '@/lib/site';
import { btn } from '@/components/ui/styles';
import { SealMark } from '@/components/site/SealMark';
import { AssetStore, normaliseImageFile, type ImageRef } from './assets';
import { buildPdf, downloadBytes, safeFilename } from './pdf';
import { Stage } from './Stage';
import { Inspector, type ElementAction } from './Inspector';
import { LeftPanel } from './LeftPanel';
import { IssuePanel, type IssueError, type IssueResult } from './IssuePanel';
import { ELEMENT_LABELS, makeElement, makeText, newId, sampleValues } from './elements';
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

// Undo / redo arrows (Lucide, ISC licence), drawn inline so the header needs no icon package.
function ArrowIcon({ redo = false }: { redo?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {redo ? (
        <>
          <path d="m15 14 5-5-5-5" />
          <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
        </>
      ) : (
        <>
          <path d="M9 14 4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
        </>
      )}
    </svg>
  );
}

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
  // Below the `lg` breakpoint only one side panel is shown at a time; at `lg` and above both always are.
  const [panel, setPanel] = useState<'tools' | 'details'>('details');
  const [typing, setTyping] = useState(false);
  const typingTimer = useRef<number | undefined>(undefined);
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

  // On a narrow screen, tapping an element should show that element's settings, from the top.
  // (At `lg` the window never scrolls and both panels are visible, so this is a no-op there.)
  useEffect(() => {
    if (!selectedId) return;
    setPanel('details');
    window.scrollTo({ top: 0 });
  }, [selectedId]);

  function showPanel(next: 'tools' | 'details') {
    setPanel(next);
    // The stage is sticky, so the top of the page puts the start of the chosen panel just beneath it.
    window.scrollTo({ top: 0 });
  }

  // A phone keyboard covers half the screen, so the sticky stage gives way while a text field is
  // being edited; otherwise the field you are typing in can end up hidden behind the stage.
  useEffect(() => () => window.clearTimeout(typingTimer.current), []);
  function onFieldFocus(e: React.FocusEvent) {
    if (!(e.target as HTMLElement).matches('textarea, select, input:not([type=checkbox], [type=radio], [type=range], [type=color], [type=file])')) return;
    window.clearTimeout(typingTimer.current);
    setTyping(true);
  }
  function onFieldBlur() {
    // Moving from one field to the next blurs then focuses; waiting avoids a resize flicker in between.
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => setTyping(false), 200);
  }

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

  const iconButton =
    'inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-[4px] text-ink-2 transition-colors hover:bg-rule/60 disabled:pointer-events-none disabled:opacity-40 sm:min-w-0 sm:px-2.5 sm:text-[13.5px]';

  return (
    // Below `lg` the page scrolls: a sticky header and stage stay in view while the panels pass beneath.
    // From `lg` up it is a fixed-height three-column workspace.
    <div className="flex min-h-dvh flex-col bg-paper lg:h-dvh">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-rule bg-card px-3 sm:gap-3 sm:px-4 lg:static">
        <Link href={user ? '/app' : '/'} className="flex shrink-0 items-center gap-2 text-ink" aria-label={`${site.name} — ${user ? 'your dashboard' : 'home'}`}>
          <SealMark size={24} color="#8A5D28" />
          <span className="hidden font-serif text-[22px] leading-none sm:inline">{site.name}</span>
        </Link>
        <span className="hidden h-6 w-px bg-rule sm:block" />
        <label className="min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Template name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className="w-full truncate rounded-[4px] border border-transparent bg-transparent px-2 py-1.5 text-[15px] hover:border-rule focus:border-brass focus:outline-none" />
        </label>
        <span className="hidden text-[12.5px] text-muted md:block" aria-live="polite">
          {user ? (saveState === 'saved' ? 'Saved' : saveState === 'saving' ? 'Saving…' : 'Unsaved changes') : 'Guest mode — sign in to save'}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
          <button type="button" className={iconButton} onClick={history.undo} disabled={!history.canUndo} aria-label="Undo">
            <ArrowIcon />
            <span className="hidden sm:inline">Undo</span>
          </button>
          <button type="button" className={iconButton} onClick={history.redo} disabled={!history.canRedo} aria-label="Redo">
            <ArrowIcon redo />
            <span className="hidden sm:inline">Redo</span>
          </button>
          <label className="ml-1 hidden items-center gap-1.5 text-[13px] text-ink-2 sm:flex">
            <input type="checkbox" className="h-4 w-4 accent-brass" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} />
            Show field boxes
          </label>
          <button
            type="button"
            className={btn.small + ' ml-1 min-h-10 bg-ink px-3.5 text-card hover:bg-ink-2'}
            onClick={save}
            disabled={saveState === 'saving'}
            // The visible label is shortened on phones, so the full meaning is stated once, here.
            aria-label={user ? (saveState === 'dirty' ? 'Save template (unsaved changes)' : 'Save template') : 'Sign in to save'}
          >
            {user ? (
              <>
                <span className="sm:hidden">Save</span>
                <span className="hidden sm:inline">Save template</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">Sign in</span>
                <span className="hidden sm:inline">Sign in to save</span>
              </>
            )}
            {user && saveState === 'dirty' && <span className="h-2 w-2 rounded-full bg-gold md:hidden" aria-hidden="true" />}
          </button>
        </div>
      </header>

      {/* A toast rather than an in-flow banner, so messages never push the stage around. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-4 z-50 flex justify-center">
        {notice && (
          <div className="max-w-md rounded-[6px] border border-brass/30 bg-brass-soft px-4 py-2.5 text-[13.5px] text-ink shadow-[0_10px_30px_-12px_rgba(25,23,18,0.5)]">{notice}</div>
        )}
      </div>

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        {/* DOM order is the narrow-screen order: stage, then the panels. `lg:order-*` rearranges it into
            tools | stage | settings on wide screens. */}
        <main
          id="main"
          className={`sticky top-14 z-20 flex shrink-0 flex-col border-b border-rule bg-[#EAE5DA] [@media(max-height:560px)]:static lg:static lg:order-2 lg:h-auto lg:min-w-0 lg:flex-1 lg:border-b-0 ${
            typing ? 'h-[26dvh]' : 'h-[clamp(220px,44dvh,560px)]'
          }`}
        >
          <div className="min-h-0 flex-1">
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
          </div>
          <div role="group" aria-label="Editor panel" className="flex h-11 shrink-0 items-stretch border-t border-rule bg-card lg:hidden">
            <button
              type="button"
              aria-pressed={panel === 'tools'}
              onClick={() => showPanel('tools')}
              className={`flex-1 border-b-2 px-2 text-[14px] ${panel === 'tools' ? 'border-brass font-medium text-ink' : 'border-transparent text-muted'}`}
            >
              Design tools
            </button>
            <button
              type="button"
              aria-pressed={panel === 'details'}
              onClick={() => showPanel('details')}
              className={`flex-1 truncate border-b-2 px-2 text-[14px] ${panel === 'details' ? 'border-brass font-medium text-ink' : 'border-transparent text-muted'}`}
            >
              {selected ? `Edit ${ELEMENT_LABELS[selected.type].toLowerCase()}` : 'Fill & issue'}
            </button>
            <label className="flex items-center gap-1.5 border-l border-rule px-3 text-[12.5px] text-ink-2 sm:hidden">
              <input type="checkbox" className="h-4 w-4 accent-brass" checked={showBoxes} onChange={(e) => setShowBoxes(e.target.checked)} />
              Boxes
            </label>
          </div>
        </main>

        <aside
          aria-label="Design tools"
          onFocus={onFieldFocus}
          onBlur={onFieldBlur}
          className={`${panel === 'tools' ? '' : 'hidden'} bg-paper lg:order-1 lg:block lg:w-[300px] lg:shrink-0 lg:border-r`}
        >
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

        <aside
          aria-label={selected ? 'Element settings' : 'Issue a certificate'}
          onFocus={onFieldFocus}
          onBlur={onFieldBlur}
          className={`${panel === 'details' ? '' : 'hidden'} bg-paper lg:order-3 lg:block lg:w-[330px] lg:shrink-0 lg:overflow-y-auto lg:border-l`}
        >
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
