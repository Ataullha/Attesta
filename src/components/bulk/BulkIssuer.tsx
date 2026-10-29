'use client';

import '@/components/editor/fonts';
import Link from 'next/link';
import Papa from 'papaparse';
import { useEffect, useMemo, useRef, useState } from 'react';
import { KINDS, capitalised, designKind, designSchema, kindNoun, photoFields, photoName, type Design, type DesignKind } from '@/lib/design';
import { cleanValues, csvCell } from '@/lib/values';
import { limits } from '@/lib/site';
import { btn, card, field } from '@/components/ui/styles';
import { AssetStore, photoSide } from '@/components/editor/assets';
import { ensureFonts, renderPage } from '@/components/editor/renderer';
import { buildPdf, buildSheetPdf, downloadBytes, safeFilename, type PdfJob } from '@/components/editor/pdf';
import { sheetFor } from '@/components/editor/sheet';
import { downloadImages } from '@/components/editor/images';
import { readPhotoFiles, skippedNote } from '@/components/editor/photo-files';

type TemplateOption = { id: string; name: string };
type Row = { index: number; values: Record<string, string>; errors: string[]; duplicate: boolean };
type Issued = { serial: string; verifyUrl: string };
type Output = 'copies' | 'sheets' | 'merged' | 'separate' | 'images';

/** What a batch of each kind downloads as unless another layout is chosen: cards ready to print and cut, documents as one PDF. */
function defaultOutput(kind: DesignKind, sheets: boolean): Output {
  if (sheets && kind === 'visiting-card') return 'copies';
  return sheets ? 'sheets' : 'merged';
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]/g, '');

const EXTRA_NAMES: Record<string, string[]> = {
  recipient_name: ['name', 'fullname', 'studentname', 'participant', 'membername', 'employeename', 'guest', 'guestname', 'invitee', 'নাম', 'অতিথি', 'অতিথিরনাম'],
  issue_date: ['date', 'তারিখ'],
};
const TYPE_NAMES: Partial<Record<Design['fields'][number]['type'], string[]>> = {
  photo: ['photo', 'photos', 'picture', 'image', 'pic', 'file', 'filename', 'photofile', 'ছবি'],
  expiry: ['validuntil', 'validity', 'valid', 'expiry', 'expires', 'expirydate', 'expiresat', 'মেয়াদ'],
};

function guessColumn(fieldKey: string, label: string, headers: string[], type?: Design['fields'][number]['type']) {
  const candidates = [fieldKey, label, fieldKey.replace(/_/g, ''), ...(EXTRA_NAMES[fieldKey] ?? []), ...((type && TYPE_NAMES[type]) ?? [])].map(norm);
  const exact = headers.find((h) => candidates.includes(norm(h)));
  if (exact) return exact;
  // Then partial matches, e.g. "Course Title" for the "course" field.
  const key = norm(fieldKey);
  return headers.find((h) => norm(h).length > 2 && (norm(h).includes(key) || key.includes(norm(h)) || norm(label).includes(norm(h)))) ?? '';
}

function Preview({ design, values, assets, photoVersion }: { design: Design; values: Record<string, string>; assets: AssetStore; photoVersion: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = ref.current;
      if (!c) return;
      await ensureFonts(design);
      if (cancelled) return;
      const scale = ((c.clientWidth || 600) / design.page.width) * Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(design.page.width * scale);
      c.height = Math.round(design.page.height * scale);
      const ctx = c.getContext('2d')!;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      // A photo that is missing shows as a stand-in here, so it is noticed before issuing.
      await renderPage(ctx, design, { ...values, serial: 'ATT-PREV-IEW0-0000', verify_url: 'https://example.com/verify/preview' }, assets, { preview: false, photoPlaceholders: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [design, values, assets, photoVersion]);
  // A small page, such as a card or an invitation, is shown at a sensible size rather than across the whole column.
  const longest = Math.max(design.page.width, design.page.height);
  const landscape = design.page.width > design.page.height;
  const maxWidth = longest < 400 ? (landscape ? 480 : 320) : longest < 800 ? (landscape ? 600 : 420) : undefined;
  return <canvas ref={ref} role="img" aria-label="Preview of the selected row" className="block h-auto w-full rounded-lg border border-rule bg-card" style={{ aspectRatio: `${design.page.width} / ${design.page.height}`, maxWidth }} />;
}

export function BulkIssuer({ templates, initialTemplateId, credits, freeLeft }: { templates: TemplateOption[]; initialTemplateId: string | null; credits: number; freeLeft: number }) {
  const assets = useMemo(() => new AssetStore(), []);
  const [templateId, setTemplateId] = useState(initialTemplateId ?? templates[0]?.id ?? '');
  const [templateName, setTemplateName] = useState('');
  const [design, setDesign] = useState<Design | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [raw, setRaw] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [phase, setPhase] = useState<'setup' | 'issuing' | 'issued' | 'building'>('setup');
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<(Issued | null)[]>([]);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [output, setOutput] = useState<Output>('merged');
  // Photos are matched to rows by file name and stay in this page; `photoNames` is what was chosen.
  const [photoNames, setPhotoNames] = useState<Set<string>>(new Set());
  const [photoVersion, setPhotoVersion] = useState(0);
  const [photoNote, setPhotoNote] = useState<string | null>(null);
  const [readingPhotos, setReadingPhotos] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    setDesign(null);
    setLoadError(null);
    fetch(`/api/templates/${templateId}`)
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'Could not load the template.');
        const parsed = designSchema.safeParse(j.design);
        if (!parsed.success) throw new Error('This template has a problem. Open it in the editor and save it again.');
        setDesign(parsed.data);
        setTemplateName(j.name);
        // Cards are printed: A4 sheets with cut marks is the useful default.
        setOutput(defaultOutput(designKind(parsed.data), !!sheetFor(parsed.data)));
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [templateId]);

  useEffect(() => {
    if (!design) return;
    setMapping((m) => {
      const next: Record<string, string> = {};
      for (const f of design.fields) next[f.key] = headers.includes(m[f.key]) ? m[f.key] : guessColumn(f.key, f.label, headers, f.type);
      return next;
    });
  }, [design, headers]);

  // Photos named after a column, such as a member ID, are matched by that column: once photos are
  // added, a photo field with no column yet takes the one whose values name the most of them.
  useEffect(() => {
    if (!design || !photoNames.size) return;
    setMapping((m) => {
      const next = { ...m };
      let changed = false;
      for (const f of photoFields(design)) {
        if (next[f.key]) continue;
        const hits = (h: string) => raw.filter((r) => photoNames.has(photoName(r[h] ?? ''))).length;
        const best = headers.map((h) => [h, hits(h)] as const).sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] > 0) {
          next[f.key] = best[0];
          changed = true;
        }
      }
      return changed ? next : m;
    });
  }, [design, headers, raw, photoNames]);

  const photoKeys = design ? photoFields(design) : [];
  const rows: Row[] = useMemo(() => {
    if (!design) return [];
    const seen = new Set<string>();
    return raw.map((r, index) => {
      const input: Record<string, string> = {};
      for (const f of design.fields) input[f.key] = mapping[f.key] ? (r[mapping[f.key]] ?? '') : '';
      const res = cleanValues(design, input);
      const values = res.ok ? res.values : input;
      const errors = res.ok ? [] : res.errors;
      for (const f of photoFields(design)) {
        const name = values[f.key];
        // A row that names a photo must have it; one that names none simply has no photo, unless it is required.
        if (name && !photoNames.has(photoName(name))) errors.push(`No photo called ${name}`);
      }
      const key = JSON.stringify(design.fields.map((f) => (values[f.key] ?? '').toLowerCase()));
      const duplicate = seen.has(key);
      seen.add(key);
      return { index, values, errors, duplicate };
    });
  }, [raw, mapping, design, photoNames]);

  const ready = rows.filter((r) => !r.errors.length && !(skipDuplicates && r.duplicate));
  const problems = rows.filter((r) => r.errors.length);
  const duplicates = rows.filter((r) => r.duplicate && !r.errors.length);
  // A field the same for everyone needs no column: the design holds its value.
  const sharedValue = (f: Design['fields'][number]) => !!f.fixed && f.type !== 'photo' && !!f.sample.trim();
  const unmappedRequired = design?.fields.filter((f) => f.required && !mapping[f.key] && !sharedValue(f)) ?? [];
  const available = freeLeft + credits;
  const previewRow = ready[Math.min(previewIndex, Math.max(0, ready.length - 1))];
  const kind = design ? designKind(design) : 'certificate';
  const nouns = kindNoun(kind, true);
  const withoutPhoto = photoKeys.length ? ready.filter((r) => photoKeys.some((f) => !r.values[f.key])).length : 0;
  const sheet = design ? sheetFor(design) : null;
  const { holder, page } = KINDS[kind];

  async function onPhotos(files: FileList) {
    if (!design) return;
    setReadingPhotos(true);
    setPhotoNote(null);
    try {
      const { photos, skipped } = await readPhotoFiles(Array.from(files));
      const side = photoSide(design);
      const names = new Set(photoNames);
      for (const p of photos) {
        assets.addPhoto(p.name, p.file, side);
        names.add(photoName(p.name));
      }
      setPhotoNames(names);
      setPhotoVersion((v) => v + 1);
      setPhotoNote(skippedNote(skipped));
    } catch (e) {
      setPhotoNote(`The photos could not be read: ${(e as Error).message}`);
    } finally {
      setReadingPhotos(false);
    }
  }

  function onFile(file: File) {
    setError(null);
    setIssued([]);
    setBatchId(null);
    setPhase('setup');
    if (file.size > 10 * 1024 * 1024) {
      setError('The CSV file is larger than 10 MB. Split it into smaller files.');
      return;
    }
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.replace(/^\uFEFF/, '').trim(),
      complete: (res) => {
        const hs = (res.meta.fields ?? []).filter(Boolean);
        if (!hs.length) {
          setError('No column headers were found. The first row of the CSV must contain column names.');
          return;
        }
        if (res.data.length > limits.bulkMaxRows) {
          setError(`This file has ${res.data.length.toLocaleString()} rows. Issue at most ${limits.bulkMaxRows.toLocaleString()} at a time — split the file.`);
          return;
        }
        setFileName(file.name);
        setHeaders(hs);
        setRaw(res.data);
        setPreviewIndex(0);
      },
      error: () => setError('The file could not be read as CSV. In Excel, use File → Save As → CSV UTF-8.'),
    });
  }

  function sampleCsv() {
    if (!design) return;
    // Only what differs from one person to the next: the design already holds what is the same for everyone.
    const own = design.fields.filter((f) => !sharedValue(f));
    const head = own.map((f) => csvCell(f.label)).join(',');
    const row = own.map((f) => csvCell(f.sample || (f.type === 'date' ? '' : f.type === 'photo' ? 'photo-1.jpg' : f.label))).join(',');
    downloadBytes(new Blob(['\uFEFF' + head + '\n' + row + '\n'], { type: 'text/csv' }), `${safeFilename(templateName || 'template')}-sample.csv`, 'text/csv');
  }

  function downloadProblems() {
    const hs = [...headers, 'Problem'];
    const lines = [hs.map(csvCell).join(',')];
    for (const r of problems) lines.push([...headers.map((h) => csvCell(raw[r.index][h] ?? '')), csvCell(r.errors.join('; '))].join(','));
    downloadBytes(new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv' }), 'rows-to-fix.csv', 'text/csv');
  }

  async function issueAll() {
    if (!design) return;
    setError(null);
    setPhase('issuing');
    const out: (Issued | null)[] = issued.length === ready.length ? [...issued] : ready.map(() => null);
    let bid = batchId;
    const chunk = limits.issueChunk;
    try {
      // Every photo is opened before anything is registered, so one the browser cannot read stops
      // the batch while nothing has been spent on it.
      const named = [...new Set(ready.flatMap((r) => photoKeys.map((f) => r.values[f.key]).filter(Boolean)))];
      const unreadable: string[] = [];
      for (let i = 0; i < named.length; i++) {
        if (i % 10 === 0) setProgress({ done: i, total: named.length, label: 'Checking photos' });
        if (!(await assets.checkPhoto(named[i]))) unreadable.push(named[i]);
      }
      if (unreadable.length) {
        setError(`${unreadable.length} photo${unreadable.length === 1 ? '' : 's'} could not be opened: ${unreadable.slice(0, 8).join(', ')}${unreadable.length > 8 ? '…' : ''}. Save ${unreadable.length === 1 ? 'it' : 'them'} as JPEG or PNG and add ${unreadable.length === 1 ? 'it' : 'them'} again. Nothing was issued.`);
        setPhase('setup');
        return;
      }
      for (let start = 0; start < ready.length; start += chunk) {
        if (out.slice(start, start + chunk).every(Boolean)) continue;
        setProgress({ done: start, total: ready.length, label: `Registering ${nouns}` });
        const part = ready.slice(start, start + chunk);
        const res = await fetch('/api/issue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ design, templateId, batchId: bid, batchName: `${templateName} — ${fileName}`.slice(0, 120), mode: 'bulk', recipients: part.map((r) => ({ values: r.values })) }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? 'Issuing stopped.');
        bid = j.batchId;
        setBatchId(bid);
        (j.issued as Issued[]).forEach((it, k) => (out[start + k] = it));
        setIssued([...out]);
      }
      setProgress({ done: ready.length, total: ready.length, label: 'Registered' });
      setPhase('issued');
    } catch (e) {
      setIssued([...out]);
      setError(`${(e as Error).message} ${out.filter(Boolean).length} of ${ready.length} were registered — you can continue from where it stopped.`);
      setPhase('setup');
    }
  }

  async function buildOutput() {
    if (!design) return;
    const jobs: PdfJob[] = ready.flatMap((r, i) => (issued[i] ? [{ design, values: r.values, serial: issued[i]!.serial, verifyUrl: issued[i]!.verifyUrl }] : []));
    setPhase('building');
    setError(null);
    try {
      const JSZip = (await import('jszip')).default;
      const indexCsv = [`Name,Serial,${capitalised(page)}`, ...jobs.map((j) => [csvCell(j.values.recipient_name), j.serial, j.verifyUrl].join(','))].join('\n');
      const base = safeFilename(templateName || nouns);
      const indexName = `${nouns.toLowerCase().replace(/\s+/g, '-')}.csv`;
      if (output === 'images') {
        await downloadImages(jobs, assets, base, { index: { name: indexName, csv: indexCsv }, onProgress: (d, t) => setProgress({ done: d, total: t, label: 'Making images' }) });
      } else if (output === 'merged' || output === 'sheets' || output === 'copies') {
        // Parts of about 250 pages; for shared sheets, a whole number of sheets, so no sheet is left half full mid-way.
        const per = output === 'sheets' && sheet ? sheet.perSheet * Math.floor(250 / sheet.perSheet) : 250;
        const onSheets = output !== 'merged';
        const suffix = onSheets ? '-A4' : '';
        const parts: Uint8Array[] = [];
        for (let s = 0; s < jobs.length; s += per) {
          const part = jobs.slice(s, s + per);
          const onProgress = (d: number) => setProgress({ done: s + d, total: jobs.length, label: 'Building PDF' });
          parts.push(onSheets ? await buildSheetPdf(part, assets, onProgress, { fill: output === 'copies' }) : await buildPdf(part, assets, onProgress));
        }
        if (parts.length === 1) downloadBytes(parts[0], `${base}${suffix}.pdf`);
        else {
          const zip = new JSZip();
          parts.forEach((p, i) => zip.file(`${base}${suffix}-part-${i + 1}.pdf`, p));
          zip.file(indexName, '\uFEFF' + indexCsv);
          downloadBytes(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `${base}.zip`, 'application/zip');
        }
      } else {
        const zip = new JSZip();
        const names = new Set<string>();
        for (let i = 0; i < jobs.length; i++) {
          const j = jobs[i];
          let name = `${safeFilename(j.values.recipient_name)}-${j.serial}.pdf`;
          while (names.has(name)) name = name.replace('.pdf', '-1.pdf');
          names.add(name);
          zip.file(name, await buildPdf([j], assets));
          setProgress({ done: i + 1, total: jobs.length, label: 'Building PDFs' });
        }
        zip.file(indexName, '\uFEFF' + indexCsv);
        downloadBytes(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `${base}.zip`, 'application/zip');
      }
    } catch (e) {
      setError(`Building the files failed: ${(e as Error).message}. Your ${nouns} are registered — you can download them again from the dashboard.`);
    } finally {
      setPhase('issued');
    }
  }

  if (!templates.length) {
    return (
      <div className={`${card} p-6`}>
        <p className="text-[16px]">Bulk issuing uses one of your saved templates.</p>
        <Link href="/create" className={btn.primary + ' mt-4'}>Design and save a template</Link>
      </div>
    );
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const busy = phase === 'issuing' || phase === 'building';
  const partlyIssued = issued.some(Boolean) && phase === 'setup';

  return (
    <div className="space-y-8">
      <section className={`${card} p-5`}>
        <h2 className="text-[17px] font-semibold">1. Template</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1">
            <span className={field.label}>Saved template</span>
            <select className={field.input} value={templateId} disabled={busy || issued.some(Boolean)} onChange={(e) => setTemplateId(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <Link href={`/create?template=${templateId}`} className={btn.secondary}>Edit template</Link>
          <button type="button" className={btn.ghost} onClick={sampleCsv} disabled={!design}>Download a sample CSV</button>
        </div>
        {loadError && <p role="alert" className="mt-3 text-[14px] text-revoked">{loadError}</p>}
        {design && (
          <p className="mt-3 text-[14px] text-muted">
            Fields: {design.fields.filter((f) => !sharedValue(f)).map((f) => f.label).join(', ')}
            {design.fields.some(sharedValue) && <> · The same for everyone: {design.fields.filter(sharedValue).map((f) => f.label).join(', ')}</>}
          </p>
        )}
      </section>

      <section className={`${card} p-5`}>
        <h2 className="text-[17px] font-semibold">2. CSV file</h2>
        <p className="mt-1 text-[14px] text-muted">The first row must be column names. The file is read in your browser — it isn’t uploaded.</p>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-rule-2 bg-paper px-6 py-8 text-center hover:border-accent">
          <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <span className="text-[15.5px] font-medium">{fileName ? `Loaded ${fileName} — ${raw.length.toLocaleString()} rows` : 'Choose a CSV file'}</span>
          <span className="mt-1 text-[13.5px] text-muted">Up to {limits.bulkMaxRows.toLocaleString()} rows · Excel: File → Save As → CSV UTF-8</span>
        </label>
      </section>

      {design && photoKeys.length > 0 && (
        <section className={`${card} p-5`} aria-labelledby="photos-h">
          <h2 id="photos-h" className="text-[17px] font-semibold">Photos</h2>
          <p className="mt-1 max-w-[70ch] text-[14px] leading-relaxed text-muted">
            Choose everyone’s photos, or a ZIP of them. Each one is matched to its row by file name: name the files after a column such as the
            ID (<code className="font-mono text-[12.5px]">1001.jpg</code>), or add a column holding each photo’s file name. Photos are read in
            your browser and never uploaded.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className={`${btn.secondary} cursor-pointer has-focus-visible:ring-2 has-focus-visible:ring-accent`}>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp,.zip,application/zip"
                className="sr-only"
                disabled={busy || readingPhotos}
                onChange={(e) => {
                  if (e.target.files?.length) onPhotos(e.target.files);
                  e.target.value = '';
                }}
              />
              {readingPhotos ? 'Reading photos…' : photoNames.size ? 'Add more photos' : 'Choose photos or a ZIP'}
            </label>
            <span className="text-[14px] text-ink-2" aria-live="polite">
              {photoNames.size ? `${photoNames.size.toLocaleString()} photo${photoNames.size === 1 ? '' : 's'} added` : 'No photos added yet'}
            </span>
          </div>
          {photoNote && <p role="status" className="mt-3 text-[13.5px] text-warn">{photoNote}</p>}
        </section>
      )}

      {design && headers.length > 0 && (
        <section className={`${card} p-5`}>
          <h2 className="text-[17px] font-semibold">3. Match columns to fields</h2>
          <p className="mt-1 text-[14px] text-muted">Each field is a box on your template. Choose which column fills it{photoKeys.length ? ', and which column holds the photo file names' : ''}.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[14.5px]">
              <thead>
                <tr className="border-b border-rule text-[13px] text-muted">
                  <th className="py-2 pr-4 font-medium">Field on template</th>
                  <th className="py-2 pr-4 font-medium">CSV column</th>
                  <th className="py-2 font-medium">First value</th>
                </tr>
              </thead>
              <tbody>
                {design.fields.map((f) => (
                  <tr key={f.key} className="border-b border-rule">
                    <td className="py-2.5 pr-4">
                      {f.label}
                      {f.required && <span className="text-revoked"> *</span>}
                      <code className="ml-2 font-mono text-[11.5px] text-accent">{`{${f.key}}`}</code>
                    </td>
                    <td className="py-2.5 pr-4">
                      <select className={field.small} aria-label={`CSV column for ${f.label}`} value={mapping[f.key] ?? ''} disabled={busy || issued.some(Boolean)} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}>
                        <option value="">
                          {sharedValue(f)
                            ? `Same for everyone: ${f.sample.length > 40 ? `${f.sample.slice(0, 40)}…` : f.sample}`
                            : f.type === 'date'
                              ? 'Not in file — use today'
                              : f.type === 'expiry'
                                ? 'Not in file — no end date'
                                : f.type === 'photo'
                                  ? 'Not in file — no photos'
                                  : 'Not in file'}
                        </option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </td>
                    <td className="max-w-[220px] truncate py-2.5 text-ink-2">
                      {mapping[f.key] ? raw[0]?.[mapping[f.key]] : sharedValue(f) ? f.sample : '—'}
                      {f.type === 'photo' && mapping[f.key] && raw.length > 0 && (
                        <span className="block text-[12.5px] text-muted">
                          {raw.filter((r) => photoNames.has(photoName(r[mapping[f.key]] ?? ''))).length.toLocaleString()} of {raw.length.toLocaleString()} rows have a photo
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unmappedRequired.length > 0 && <p className="mt-3 text-[14px] text-revoked">Choose a column for: {unmappedRequired.map((f) => f.label).join(', ')}.</p>}
        </section>
      )}

      {design && raw.length > 0 && unmappedRequired.length === 0 && (
        <section className={`${card} p-5`}>
          <h2 className="text-[17px] font-semibold">4. Check and issue</h2>
          <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div>
              {previewRow ? (
                <>
                  <Preview design={design} values={previewRow.values} assets={assets} photoVersion={photoVersion} />
                  <div className="mt-2 flex items-center justify-between text-[13.5px] text-muted">
                    <span>Row {previewRow.index + 2} of the file</span>
                    <span className="flex gap-1">
                      <button type="button" className={btn.small + ' border border-rule-2'} disabled={previewIndex === 0} onClick={() => setPreviewIndex((i) => Math.max(0, i - 1))}>Previous</button>
                      <button type="button" className={btn.small + ' border border-rule-2'} disabled={previewIndex >= ready.length - 1} onClick={() => setPreviewIndex((i) => Math.min(ready.length - 1, i + 1))}>Next</button>
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-[14.5px] text-muted">No rows are ready yet.</p>
              )}
            </div>
            <div className="space-y-4 text-[14.5px]">
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule bg-rule">
                <div className="bg-card p-3"><dt className="text-muted">Ready</dt><dd className="font-display text-[24px] leading-none text-seal">{ready.length.toLocaleString()}</dd></div>
                <div className="bg-card p-3"><dt className="text-muted">Need fixing</dt><dd className={`font-display text-[24px] leading-none ${problems.length ? 'text-revoked' : ''}`}>{problems.length.toLocaleString()}</dd></div>
              </dl>
              {duplicates.length > 0 && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={skipDuplicates} disabled={busy || issued.some(Boolean)} onChange={(e) => setSkipDuplicates(e.target.checked)} />
                  Skip {duplicates.length} duplicate row{duplicates.length === 1 ? '' : 's'} (same values as an earlier row)
                </label>
              )}
              {problems.length > 0 && (
                <div className="rounded-lg border border-revoked/25 bg-revoked-soft/60 p-3">
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-[13.5px] text-revoked">
                    {problems.slice(0, 50).map((r) => (
                      <li key={r.index}>Row {r.index + 2}: {r.errors.join('; ')}</li>
                    ))}
                  </ul>
                  <button type="button" className="mt-2 text-[13.5px] font-medium text-revoked underline" onClick={downloadProblems}>Download these rows as CSV</button>
                </div>
              )}
              {withoutPhoto > 0 && (
                <p className="text-warn">
                  {withoutPhoto.toLocaleString()} {withoutPhoto === 1 ? 'row has' : 'rows have'} no photo and will be issued without one.
                </p>
              )}
              <p className="text-ink-2">
                Uses {Math.min(ready.length, freeLeft)} free and {Math.max(0, ready.length - freeLeft).toLocaleString()} package credits. You have {available.toLocaleString()} available.
              </p>
              {ready.length > available && (
                <p className="text-revoked">
                  Not enough credits for all rows. <Link href="/app/billing" className="font-medium underline">Buy a package</Link>
                </p>
              )}
              {phase !== 'issued' && phase !== 'building' && (
                <button type="button" className={btn.primary + ' w-full'} disabled={busy || !ready.length || ready.length > available} onClick={issueAll}>
                  {partlyIssued ? 'Continue issuing' : `Issue ${ready.length.toLocaleString()} ${ready.length === 1 ? kindNoun(kind) : nouns}`}
                </button>
              )}
            </div>
          </div>

          {busy && (
            <div className="mt-6" aria-live="polite">
              <div className="flex justify-between text-[13.5px] text-ink-2">
                <span>{progress.label}…</span>
                <span className="tabular-nums">{progress.done.toLocaleString()} / {progress.total.toLocaleString()}</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                <div className="h-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-muted">Keep this tab open until it finishes.</p>
            </div>
          )}

          {(phase === 'issued' || phase === 'building') && (
            <div className="mt-6 rounded-lg border border-seal/30 bg-seal-soft p-4">
              <p className="font-medium text-seal">{issued.filter(Boolean).length.toLocaleString()} {nouns} registered.</p>
              <fieldset className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[14.5px]" disabled={phase === 'building'}>
                <legend className="sr-only">Download format</legend>
                {sheet && kind === 'visiting-card' && (
                  <label className="flex items-center gap-2">
                    <input type="radio" name="out" className="accent-accent" checked={output === 'copies'} onChange={() => setOutput('copies')} />
                    A4 sheets, a full sheet of {sheet.perSheet} for each person
                  </label>
                )}
                {sheet && (
                  <label className="flex items-center gap-2">
                    <input type="radio" name="out" className="accent-accent" checked={output === 'sheets'} onChange={() => setOutput('sheets')} />
                    {kind === 'visiting-card' ? `A4 sheets, one card for each person (${sheet.perSheet} per page)` : `A4 sheets for printing (${sheet.perSheet} per page, with cut marks)`}
                  </label>
                )}
                <label className="flex items-center gap-2">
                  <input type="radio" name="out" className="accent-accent" checked={output === 'merged'} onChange={() => setOutput('merged')} />
                  {sheet ? 'One PDF at card size, for card printers and print shops' : 'One PDF (250 pages per file)'}
                </label>
                <label className="flex items-center gap-2"><input type="radio" name="out" className="accent-accent" checked={output === 'separate'} onChange={() => setOutput('separate')} />Separate PDFs in a ZIP</label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="out" className="accent-accent" checked={output === 'images'} onChange={() => setOutput('images')} />
                  Images (JPG) in a ZIP, one for each {holder}{kind === 'invitation' ? ', to send by WhatsApp or Messenger' : ''}
                </label>
              </fieldset>
              <button type="button" className={btn.seal + ' mt-4'} disabled={phase === 'building'} onClick={buildOutput}>
                {phase === 'building' ? 'Building…' : `Download ${nouns}`}
              </button>
              <p className="mt-2 text-[13px] text-ink-2">
                A ZIP also contains a CSV of names, serials and links to each {page}.{output === 'images' && ready.length > 200 ? ' Images come in ZIP files of 200 each.' : ''}
              </p>
            </div>
          )}
        </section>
      )}

      {error && <p role="alert" className="rounded-lg border border-revoked/30 bg-revoked-soft p-3 text-[14.5px] text-revoked">{error}</p>}
    </div>
  );
}
