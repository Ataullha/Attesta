'use client';

import { btn } from '@/components/ui/styles';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto flex min-h-[60dvh] max-w-xl flex-col justify-center px-5">
      <h1 className="font-serif text-[44px] leading-tight">This page failed to load</h1>
      <p className="mt-3 text-[17px] text-ink-2">It’s a problem on our side. Try again — if it keeps happening, email support.</p>
      <button type="button" onClick={reset} className={btn.primary + ' mt-8 self-start'}>Try again</button>
    </main>
  );
}
