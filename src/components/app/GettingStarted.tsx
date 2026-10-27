import Link from 'next/link';
import { btn, card } from '@/components/ui/styles';

export type SetupStep = {
  done: boolean;
  title: string;
  /** Why it is worth doing, shown until it is done. */
  why: string;
  href?: string;
  action?: string;
  /** In place of the link, for a step done on the spot (sending the confirmation email again). */
  control?: React.ReactNode;
  /** Nothing can be issued until it is done. */
  blocking?: boolean;
};

/** The steps between signing up and issuing as an organisation. Gone once every step is done. */
export function GettingStarted({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <section aria-labelledby="setup-h" className={`${card} mb-8 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="setup-h" className="font-display text-[22px] leading-tight">Get set up</h2>
        <p className="text-[13.5px] text-muted">{`${done} of ${steps.length} done`}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rule" aria-hidden="true">
        <div className="h-full rounded-full bg-seal" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 divide-y divide-rule">
        {steps.map((s, i) => (
          // On a phone the button goes under the text rather than squeezing it into a narrow column.
          <li
            key={s.title}
            className={`grid grid-cols-[1.5rem_1fr] items-start gap-x-3 gap-y-2.5 py-3.5 sm:grid-cols-[1.5rem_1fr_auto] ${s.blocking && !s.done ? '-mx-3 rounded-lg bg-accent-soft px-3' : ''}`}
          >
            <span
              aria-hidden="true"
              className={`mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[12px] ${s.done ? 'bg-seal text-card' : 'border border-rule-2 text-accent'}`}
            >
              {s.done ? '✓' : i + 1}
            </span>
            <div className="min-w-0">
              <p className={s.done ? 'text-muted line-through decoration-rule-2' : 'font-medium'}>
                {s.title}
                {s.done && <span className="sr-only"> (done)</span>}
              </p>
              {!s.done && <p className="mt-0.5 text-[14px] leading-snug text-ink-2">{s.why}</p>}
            </div>
            {!s.done && (
              <div className="col-start-2 sm:col-start-3">
                {s.control ?? (s.href && <Link href={s.href} className={`${btn.small} border border-rule-2 bg-card hover:border-accent`}>{s.action}</Link>)}
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
