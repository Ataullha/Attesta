import Link from 'next/link';
import { btn } from '@/components/ui/styles';
import { limits, site } from '@/lib/site';

/**
 * How a marketing page ends: one clear next step for someone ready to try, and a direct line for an
 * organisation weighing a large volume, who would rather talk than read further.
 */
export function CtaBand({ title = 'Issue your first verifiable certificate today', children }: { title?: string; children?: React.ReactNode }) {
  return (
    <section aria-labelledby="cta-h" className="border-t border-rule bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 px-5 py-16 md:flex-row md:items-center md:justify-between">
        <div className="max-w-[46ch]">
          <h2 id="cta-h" className="font-display text-[28px] leading-tight sm:text-[32px]">
            {title}
          </h2>
          <p className="mt-2 text-[16px] leading-relaxed text-ink-2">
            {children ?? `Your first ${limits.guestLifetime} need no account, and a free account adds ${limits.freeMonthly} verifiable certificates every month.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/create" className={btn.primary + ' min-h-12 px-6 text-[16px]'}>
            Make a certificate
          </Link>
          <a href={`mailto:${site.supportEmail}?subject=${encodeURIComponent(`${site.name} for our organisation`)}`} className={btn.secondary + ' min-h-12 px-6 text-[16px]'}>
            Talk to us about volume
          </a>
        </div>
      </div>
    </section>
  );
}
