'use client';

import '@/components/editor/fonts';
import Link from 'next/link';
import Papa from 'papaparse';
import { useEffect, useMemo, useRef, useState } from 'react';
import { designSchema, type Design } from '@/lib/design';
import { cleanValues, csvCell } from '@/lib/values';
import { limits } from '@/lib/site';
import { btn, card, field } from '@/components/ui/styles';
import { AssetStore } from '@/components/editor/assets';
import { ensureFonts, renderPage } from '@/components/editor/renderer';
import { buildPdf, downloadBytes, safeFilename, type PdfJob } from '@/components/editor/pdf';

type TemplateOption = { id: string; name: string };
type Row = { index: number; values: Record<string, string>; errors: string[]; duplicate: boolean };
type Issued = { serial: string; verifyUrl: string };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0980-\u09ff]/g, '');

function guessColumn(fieldKey: string, label: string, headers: string[]) {
  const candidates = [fieldKey, label, fieldKey.replace(/_/g, ''), ...(fieldKey === 'recipient_name' ? ['name', 'fullname', 'studentname', 'participant', 'নাম'] : []), ...(fieldKey === 'issue_date' ? ['date', 'তারিখ'] : [])].map(norm);
  const exact = headers.find((h) => candidates.includes(norm(h)));
  if (exact) return exact;
  // Then partial matches, e.g. "Course Title" for the "course" field.
  const key = norm(fieldKey);
  return headers.find((h) => norm(h).length > 2 && (norm(h).includes(key) || key.includes(norm(h)) || norm(label).includes(norm(h)))) ?? '';
}

function Preview({ design, values, assets }: { design: Design; values: Record<string, string>; assets: AssetStore }) {
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
      await renderPage(ctx, design, { ...values, serial: 'ATT-PREV-IEW0-0000', verify_url: 'https://example.com/verify/preview' }, assets, { preview: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [design, values, assets]);
  return <canvas ref={ref} role="img" aria-label="Preview of the selected row" className="block h-auto w-full border border-rule bg-card" style={{ aspectRatio: `${design.page.width} / ${design.page.height}` }} />;
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
  const [output, setOutput] = useState<'merged' | 'separate'>('merged');

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
      })
      .catch((e: Error) => setLoadError(e.message));
  }, [templateId]);

  useEffect(() => {
    if (!design) return;
    setMapping((m) => {
      const next: Record<string, string> = {};
      for (const f of design.fields) next[f.key] = headers.includes(m[f.key]) ? m[f.key] : guessColumn(f.key, f.label, headers);
      return next;
    });
  }, [design, headers]);

  const rows: Row[] = useMemo(() => {
    if (!design) return [];
    const seen = new Set<string>();
    return raw.map((r, index) => {
      const input: Record<string, string> = {};
      for (const f of design.fields) input[f.key] = mapping[f.key] ? (r[mapping[f.key]] ?? '') : '';
      const res = cleanValues(design, input);
      const values = res.ok ? res.values : input;
      const key = JSON.stringify(design.fields.map((f) => (values[f.key] ?? '').toLowerCase()));
      const duplicate = seen.has(key);
      seen.add(key);
      return { index, values, errors: res.ok ? [] : res.errors, duplicate };
    });
  }, [raw, mapping, design]);

  const ready = rows.filter((r) => !r.errors.length && !(skipDuplicates && r.duplicate));
  const problems = rows.filter((r) => r.errors.length);
  const duplicates = rows.filter((r) => r.duplicate && !r.errors.length);
  const unmappedRequired = design?.fields.filter((f) => f.required && !mapping[f.key]) ?? [];
  const available = freeLeft + credits;
  const previewRow = ready[Math.min(previewIndex, Math.max(0, ready.length - 1))];

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
    const head = design.fields.map((f) => csvCell(f.label)).join(',');
    const row = design.fields.map((f) => csvCell(f.sample || (f.type === 'date' ? '' : f.label))).join(',');
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
      for (let start = 0; start < ready.length; start += chunk) {
        if (out.slice(start, start + chunk).every(Boolean)) continue;
        setProgress({ done: start, total: ready.length, label: 'Registering certificates' });
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
      const indexCsv = ['Name,Serial,Verification link', ...jobs.map((j) => [csvCell(j.values.recipient_name), j.serial, j.verifyUrl].join(','))].join('\n');
      const base = safeFilename(templateName || 'certificates');
      if (output === 'merged') {
        const per = 250;
        const parts: Uint8Array[] = [];
        for (let s = 0; s < jobs.length; s += per) {
          parts.push(await buildPdf(jobs.slice(s, s + per), assets, (d) => setProgress({ done: s + d, total: jobs.length, label: 'Building PDF' })));
        }
        if (parts.length === 1) downloadBytes(parts[0], `${base}.pdf`);
        else {
          const zip = new JSZip();
          parts.forEach((p, i) => zip.file(`${base}-part-${i + 1}.pdf`, p));
          zip.file('certificates.csv', '\uFEFF' + indexCsv);
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
        zip.file('certificates.csv', '\uFEFF' + indexCsv);
        downloadBytes(await zip.generateAsync({ type: 'blob', compression: 'STORE' }), `${base}.zip`, 'application/zip');
      }
    } catch (e) {
      setError(`Building the files failed: ${(e as Error).message}. Your certificates are registered — you can download them again from the dashboard.`);
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
            Fields: {design.fields.map((f) => f.label).join(', ')}
          </p>
        )}
      </section>

      <section className={`${card} p-5`}>
        <h2 className="text-[17px] font-semibold">2. CSV file</h2>
        <p className="mt-1 text-[14px] text-muted">The first row must be column names. The file is read in your browser — it isn’t uploaded.</p>
        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-[4px] border border-dashed border-rule-2 bg-paper px-6 py-8 text-center hover:border-brass">
          <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          <span className="text-[15.5px] font-medium">{fileName ? `Loaded ${fileName} — ${raw.length.toLocaleString()} rows` : 'Choose a CSV file'}</span>
          <span className="mt-1 text-[13.5px] text-muted">Up to {limits.bulkMaxRows.toLocaleString()} rows · Excel: File → Save As → CSV UTF-8</span>
        </label>
      </section>

      {design && headers.length > 0 && (
        <section className={`${card} p-5`}>
          <h2 className="text-[17px] font-semibold">3. Match columns to fields</h2>
          <p className="mt-1 text-[14px] text-muted">Each field is a box on your template. Choose which column fills it.</p>
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
                      <code className="ml-2 font-mono text-[11.5px] text-brass">{`{${f.key}}`}</code>
                    </td>
                    <td className="py-2.5 pr-4">
                      <select className={field.small} value={mapping[f.key] ?? ''} disabled={busy || issued.some(Boolean)} onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}>
                        <option value="">{f.type === 'date' ? 'Not in file — use today' : 'Not in file'}</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </td>
                    <td className="max-w-[220px] truncate py-2.5 text-ink-2">{mapping[f.key] ? raw[0]?.[mapping[f.key]] : '—'}</td>
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
                  <Preview design={design} values={previewRow.values} assets={assets} />
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
              <dl className="grid grid-cols-2 gap-px overflow-hidden border border-rule bg-rule">
                <div className="bg-card p-3"><dt className="text-muted">Ready</dt><dd className="font-serif text-[30px] leading-none text-seal">{ready.length.toLocaleString()}</dd></div>
                <div className="bg-card p-3"><dt className="text-muted">Need fixing</dt><dd className={`font-serif text-[30px] leading-none ${problems.length ? 'text-revoked' : ''}`}>{problems.length.toLocaleString()}</dd></div>
              </dl>
              {duplicates.length > 0 && (
                <label className="flex items-start gap-2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brass" checked={skipDuplicates} disabled={busy || issued.some(Boolean)} onChange={(e) => setSkipDuplicates(e.target.checked)} />
                  Skip {duplicates.length} duplicate row{duplicates.length === 1 ? '' : 's'} (same values as an earlier row)
                </label>
              )}
              {problems.length > 0 && (
                <div className="rounded-[4px] border border-revoked/25 bg-revoked-soft/60 p-3">
                  <ul className="max-h-40 space-y-1 overflow-y-auto text-[13.5px] text-revoked">
                    {problems.slice(0, 50).map((r) => (
                      <li key={r.index}>Row {r.index + 2}: {r.errors.join('; ')}</li>
                    ))}
                  </ul>
                  <button type="button" className="mt-2 text-[13.5px] font-medium text-revoked underline" onClick={downloadProblems}>Download these rows as CSV</button>
                </div>
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
                <button type="button" className={btn.brass + ' w-full'} disabled={busy || !ready.length || ready.length > available} onClick={issueAll}>
                  {partlyIssued ? 'Continue issuing' : `Issue ${ready.length.toLocaleString()} certificates`}
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
                <div className="h-full bg-brass transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-[13px] text-muted">Keep this tab open until it finishes.</p>
            </div>
          )}

          {(phase === 'issued' || phase === 'building') && (
            <div className="mt-6 rounded-[4px] border border-seal/30 bg-seal-soft p-4">
              <p className="font-medium text-seal">{issued.filter(Boolean).length.toLocaleString()} certificates registered.</p>
              <fieldset className="mt-3 flex flex-wrap gap-4 text-[14.5px]" disabled={phase === 'building'}>
                <legend className="sr-only">Download format</legend>
                <label className="flex items-center gap-2"><input type="radio" name="out" className="accent-brass" checked={output === 'merged'} onChange={() => setOutput('merged')} />One PDF (250 pages per file)</label>
                <label className="flex items-center gap-2"><input type="radio" name="out" className="accent-brass" checked={output === 'separate'} onChange={() => setOutput('separate')} />Separate PDFs in a ZIP</label>
              </fieldset>
              <button type="button" className={btn.seal + ' mt-4'} disabled={phase === 'building'} onClick={buildOutput}>
                {phase === 'building' ? 'Building…' : 'Download certificates'}
              </button>
              <p className="mt-2 text-[13px] text-ink-2">The ZIP also contains a CSV of names, serials and verification links.</p>
            </div>
          )}
        </section>
      )}

      {error && <p role="alert" className="rounded-[4px] border border-revoked/30 bg-revoked-soft p-3 text-[14.5px] text-revoked">{error}</p>}
    </div>
  );
}
