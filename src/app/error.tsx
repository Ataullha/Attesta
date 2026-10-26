'use client';

import { useEffect } from 'react';
import { btn } from '@/components/ui/styles';
import { site } from '@/lib/site';

// `retry` re-fetches the segment from the server; `reset` would only re-render the payload that
// already failed, so "Try again" after a transient database error would show the same error.
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-xl flex-col justify-center px-5">
      <h1 className="font-serif text-[44px] leading-tight">This page failed to load</h1>
      <p className="mt-3 text-[17px] text-ink-2">
        It’s a problem on our side. Try again — if it keeps happening, email{' '}
        <a href={`mailto:${site.supportEmail}`} className="text-brass underline underline-offset-2">
          {site.supportEmail}
        </a>
        {error.digest ? ' and quote the reference below.' : '.'}
      </p>
      {error.digest && <p className="mt-3 font-mono text-[13px] text-muted">Reference: {error.digest}</p>}
      <button type="button" onClick={() => retry()} className={btn.primary + ' mt-8 self-start'}>
        Try again
      </button>
    </main>
  );
}
