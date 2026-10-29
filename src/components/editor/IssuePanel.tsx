'use client';

import Link from 'next/link';
import { useState } from 'react';
import { KINDS, capitalised, designKind, kindNoun, type Design, type Field } from '@/lib/design';
import { useCopy } from '@/components/app/client-utils';
import { btn, field } from '@/components/ui/styles';

export type IssueResult = { serial: string; verifyUrl: string; guest: boolean; remaining?: number };
export type IssueError = { message: string; code?: string };

type Props = {
  design: Design;
  values: Record<string, string>;
  onValue: (key: string, v: string) => void;
  /** A photo file chosen for a photo field. */
  onPhoto: (key: string, file: File) => void;
  /** A value that is the same on every document, changed in the design itself. */
  onFixed: (key: string, v: string) => void;
  /** Downloads what was just issued again, laid out on an A4 sheet for printing. */
  onSheet?: () => Promise<void>;
  sheetLabel: string;
  /** Downloads what was just issued again as an image. */
  onImage?: () => Promise<void>;
  onSettings: (patch: Partial<Design['settings']>) => void;
  onIssue: () => void;
  busy: boolean;
  progress: string | null;
  result: IssueResult | null;
  error: IssueError | null;
  signedIn: boolean;
  quotaNote: string;
  templateId: string | null;
  /** Goes to sign in or sign up, keeping the design. */
  onAccount: (path: '/login' | '/register') => void;
};

/** A button that runs a download and says so while it is being built. */
function DownloadAgain({ onClick, children }: { onClick: () => Promise<void>; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="mt-1 block text-left text-[12.5px] font-medium text-seal underline underline-offset-2"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? 'Building…' : children}
    </button>
  );
}

function FieldInput({ f, value, onChange, placeholder }: { f: Field; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className={field.label}>
        {f.label}
        {f.required && <span className="text-revoked"> *</span>}
      </span>
      <input className={field.input} type={f.type === 'email' ? 'email' : 'text'} value={value} maxLength={300} required={f.required && !f.fixed} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function IssuePanel({ design, values, onValue, onPhoto, onFixed, onSheet, sheetLabel, onImage, onSettings, onIssue, busy, progress, result, error, signedIn, quotaNote, templateId, onAccount }: Props) {
  const [copied, copy] = useCopy();
  const kind = designKind(design);
  const noun = kindNoun(kind);
  const { holder, page } = KINDS[kind];
  const fixed = design.fields.filter((f) => f.fixed && f.type !== 'photo');
  const own = design.fields.filter((f) => !(f.fixed && f.type !== 'photo'));
  return (
    <div className="text-[14px]">
      <div className="border-b border-rule px-4 py-3">
        <h2 className="font-display text-[18px] leading-tight">Issue one {noun}</h2>
        <p className="mt-1 text-[12.5px] leading-snug text-muted">Fill in the details. The preview updates as you type.</p>
      </div>
      <form
        className="space-y-3.5 px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          onIssue();
        }}
      >
        {fixed.length > 0 && (
          <fieldset className="space-y-3 rounded-lg border border-rule bg-paper/60 p-3">
            <legend className="px-1 text-[12.5px] text-ink-2">Same on every {noun}</legend>
            {fixed.map((f) => (
              <FieldInput key={f.key} f={f} value={f.sample} placeholder={f.label} onChange={(v) => onFixed(f.key, v)} />
            ))}
            <p className="text-[12px] leading-snug text-muted">Saved with the design, so every {noun} you issue from it, one by one or from a CSV, shows these.</p>
          </fieldset>
        )}
        {fixed.length > 0 && own.length > 0 && <h3 className="pt-1 text-[12.5px] font-medium text-ink-2">For this {holder}</h3>}
        {own.map((f) =>
          f.type === 'photo' ? (
            <div key={f.key}>
              <span className={field.label} id={`${f.key}-label`}>
                {f.label}
                {f.required && <span className="text-revoked"> *</span>}
              </span>
              <label className={`${btn.secondary} w-full cursor-pointer has-focus-visible:ring-2 has-focus-visible:ring-accent`}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-labelledby={`${f.key}-label`}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPhoto(f.key, file);
                    e.target.value = '';
                  }}
                />
                {values[f.key] ? 'Choose another photo' : 'Choose a photo'}
              </label>
              <span className={`${field.hint} block`}>{values[f.key] ? `${values[f.key]} · ` : ''}The photo stays on this device; it is never uploaded.</span>
            </div>
          ) : (
            <FieldInput
              key={f.key}
              f={f}
              value={values[f.key] ?? ''}
              placeholder={f.type === 'date' ? 'Leave empty for today' : f.type === 'expiry' ? 'e.g. 31 December 2026' : f.sample || ''}
              onChange={(v) => onValue(f.key, v)}
            />
          ),
        )}

        {signedIn && (
          <fieldset className="space-y-2.5 rounded-lg border border-rule bg-paper/60 p-3">
            <legend className="px-1 text-[12.5px] text-ink-2">{capitalised(page)}</legend>
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted">Show the {holder}’s name as</span>
              <select className={field.small} value={design.settings.nameDisplay} onChange={(e) => onSettings({ nameDisplay: e.target.value as Design['settings']['nameDisplay'] })}>
                <option value="partial">First name and last initial</option>
                <option value="full">Full name</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
            <label className="flex items-start gap-2 text-[12.5px] leading-snug">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={design.settings.indexable} onChange={(e) => onSettings({ indexable: e.target.checked })} />
              Let search engines list the {page}
            </label>
          </fieldset>
        )}

        <button type="submit" className={btn.primary + ' w-full'} disabled={busy}>
          {busy ? progress ?? 'Working…' : 'Issue and download PDF'}
        </button>
        <p className="text-[12.5px] leading-snug text-muted">{quotaNote}</p>
        {signedIn && templateId && (
          <Link href={`/app/bulk?template=${templateId}`} className="block text-[13px] text-accent underline-offset-2 hover:underline">
            {kind === 'invitation' ? 'Make one for every guest from a list instead' : 'Issue many from a CSV file instead'}
          </Link>
        )}
      </form>

      {error && (
        <div role="alert" className="mx-4 mb-4 rounded-lg border border-revoked/30 bg-revoked-soft p-3 text-[13px] leading-snug text-revoked">
          {error.message}
          {error.code === 'guest_limit' && (
            <button type="button" onClick={() => onAccount('/register')} className="mt-2 block text-left font-medium underline">
              Create a free account — this design comes with you
            </button>
          )}
          {(error.code === 'quota_exceeded' || error.code === 'needs_package') && (
            <Link href="/app/billing" className="mt-2 block font-medium underline">
              See packages
            </Link>
          )}
          {error.code === 'unauthenticated' && (
            <button type="button" onClick={() => onAccount('/login')} className="mt-2 block text-left font-medium underline">
              Sign in — this design comes with you
            </button>
          )}
        </div>
      )}

      {result && (
        <div className="mx-4 mb-6 rounded-lg border border-seal/30 bg-seal-soft p-3.5" aria-live="polite">
          <p className="text-[13.5px] font-medium text-seal">{result.guest ? 'Downloaded (guest copy)' : 'Issued and downloaded'}</p>
          {onSheet && <DownloadAgain onClick={onSheet}>{sheetLabel}</DownloadAgain>}
          {onImage && <DownloadAgain onClick={onImage}>Download it as an image (JPG)</DownloadAgain>}
          <p className="mt-1 font-mono text-[12.5px] tracking-wide text-ink">{result.serial}</p>
          {result.guest ? (
            <p className="mt-2 text-[12.5px] leading-snug text-ink-2">
              Guest {kindNoun(kind, true)} carry a footer note and are not registered, so the QR code won’t confirm them.
              {typeof result.remaining === 'number' && ` ${result.remaining} guest ${result.remaining === 1 ? noun : kindNoun(kind, true)} left.`}{' '}
              <button type="button" onClick={() => onAccount('/register')} className="font-medium text-accent underline">
                Sign up free
              </button>{' '}
              for verifiable {kindNoun(kind, true)}; this design comes with you.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              <a href={result.verifyUrl} target="_blank" rel="noreferrer" className={btn.small + ' bg-seal text-card hover:bg-seal-dark'}>
                Open {page}
              </a>
              <button type="button" className={btn.small + ' border border-seal/40 text-seal hover:bg-card'} onClick={() => copy(result.verifyUrl)}>
                {copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Could not copy' : 'Copy link'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
