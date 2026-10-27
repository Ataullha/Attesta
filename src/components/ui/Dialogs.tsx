'use client';

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { btn, field } from './styles';

/**
 * In-page replacements for window.confirm / prompt / alert.
 *
 * Browsers' own dialogs freeze the page, cannot be styled or translated, are poorly supported by
 * assistive technology, and are often suppressed outright in in-app and embedded mobile browsers (the
 * action then silently never runs). These use the native <dialog> element, which supplies focus
 * trapping, Escape to cancel, an inert page behind and focus returning to where it came from.
 */

type ConfirmOptions = { title: string; message?: string; confirmLabel?: string; tone?: 'neutral' | 'danger' };
type AskOptions = {
  title: string;
  label: string;
  message?: string;
  confirmLabel?: string;
  placeholder?: string;
  /** Fewest characters accepted once trimmed. 0 (the default) makes the answer optional. */
  minLength?: number;
  maxLength?: number;
};
type ToastTone = 'info' | 'success' | 'error';
type ToastItem = { id: number; text: string; tone: ToastTone };

type Pending = { id: number } & (
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (ok: boolean) => void }
  | { kind: 'ask'; options: AskOptions; resolve: (value: string | null) => void }
);

type Dialogs = {
  /** Resolves true when the person confirms, false when they cancel (button, Escape). */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Resolves the entered text (possibly empty when optional), or null when they cancel. */
  ask: (options: AskOptions) => Promise<string | null>;
  toast: (text: string, tone?: ToastTone) => void;
};

const DialogContext = createContext<Dialogs | null>(null);

export function useDialogs() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside <DialogProvider>');
  return ctx;
}

const TOAST_MS: Record<ToastTone, number> = { info: 5000, success: 4000, error: 9000 };

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<Pending | null>(null);
  // What is on screen and what is waiting. Kept outside state updaters, which React may run twice.
  const shown = useRef<Pending | null>(null);
  const waiting = useRef<Pending[]>([]);
  const nextId = useRef(1);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const enqueue = useCallback((p: Pending) => {
    if (shown.current) {
      waiting.current.push(p);
      return;
    }
    shown.current = p;
    setCurrent(p);
  }, []);

  // Once a dialog has been answered, show the next one waiting, if any.
  const finish = useCallback(() => {
    shown.current = waiting.current.shift() ?? null;
    setCurrent(shown.current);
  }, []);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => enqueue({ id: nextId.current++, kind: 'confirm', options, resolve })),
    [enqueue],
  );
  const ask = useCallback(
    (options: AskOptions) => new Promise<string | null>((resolve) => enqueue({ id: nextId.current++, kind: 'ask', options, resolve })),
    [enqueue],
  );

  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (text: string, tone: ToastTone = 'info') => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-3), { id, text, tone }]);
      window.setTimeout(() => dismissToast(id), TOAST_MS[tone]);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ confirm, ask, toast }), [confirm, ask, toast]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {current && <DialogView key={current.id} pending={current} onDone={finish} />}
      <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[60] flex flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            // Errors interrupt a screen reader; everything else waits for a pause.
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex max-w-md items-start gap-3 rounded-xl border px-4 py-2.5 text-[14px] shadow-[0_10px_30px_-12px_rgba(15,23,42,0.5)] ${
              t.tone === 'error' ? 'border-revoked/30 bg-revoked-soft text-revoked' : t.tone === 'success' ? 'border-seal/30 bg-seal-soft text-seal' : 'border-accent/30 bg-accent-soft text-ink'
            }`}
          >
            <span className="min-w-0 flex-1">{t.text}</span>
            <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss" className="-mr-1 shrink-0 rounded px-1.5 text-[18px] leading-none opacity-60 hover:opacity-100">
              ×
            </button>
          </div>
        ))}
      </div>
    </DialogContext.Provider>
  );
}

function DialogView({ pending, onDone }: { pending: Pending; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const problemId = useId();
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const settled = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // React does not emit the autofocus attribute, so choose the starting point ourselves: the
    // field when there is one, otherwise the safe answer for a destructive question.
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);

  function settle(result: boolean | string | null) {
    if (settled.current) return;
    settled.current = true;
    if (pending.kind === 'confirm') pending.resolve(result === true);
    else pending.resolve(typeof result === 'string' ? result : null);
    ref.current?.close();
    onDone();
  }
  const cancel = () => settle(pending.kind === 'confirm' ? false : null);

  const { options } = pending;
  const danger = pending.kind === 'confirm' && pending.options.tone === 'danger';

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={options.message ? descId : undefined}
      // Escape is the native cancel; closing by any other route counts as "no" too, so the page is
      // never left waiting for an answer.
      onCancel={(e) => {
        e.preventDefault();
        cancel();
      }}
      onClose={cancel}
      className="m-auto w-[min(92vw,26rem)] rounded-xl border border-rule bg-card p-0 text-ink shadow-[0_24px_60px_-20px_rgba(15,23,42,0.55)] backdrop:bg-ink/40"
    >
      <form
        method="dialog"
        className="p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (pending.kind === 'confirm') return settle(true);
          const value = text.trim();
          const min = pending.options.minLength ?? 0;
          if (value.length < min) {
            setProblem(min <= 1 ? 'Enter something first.' : `Enter at least ${min} characters.`);
            return;
          }
          settle(value);
        }}
      >
        <h2 id={titleId} className="font-display text-[22px] leading-tight">
          {options.title}
        </h2>
        {options.message && (
          <p id={descId} className="mt-2 text-[15px] leading-relaxed text-ink-2">
            {options.message}
          </p>
        )}
        {pending.kind === 'ask' && (
          <label className="mt-4 block">
            <span className={field.label}>{pending.options.label}</span>
            <input
              data-autofocus
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setProblem(null);
              }}
              maxLength={pending.options.maxLength ?? 300}
              placeholder={pending.options.placeholder}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? problemId : undefined}
              className={field.input}
            />
            {problem && (
              <span id={problemId} role="alert" className="mt-1.5 block text-[13px] text-revoked">
                {problem}
              </span>
            )}
          </label>
        )}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" data-autofocus={danger ? '' : undefined} className={btn.secondary} onClick={cancel}>
            Cancel
          </button>
          <button
            type="submit"
            data-autofocus={pending.kind === 'confirm' && !danger ? '' : undefined}
            className={danger ? `${btn.base} bg-revoked text-card hover:bg-revoked-dark` : btn.primary}
          >
            {options.confirmLabel ?? (danger ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
