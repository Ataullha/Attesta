'use client';

import { useEffect } from 'react';

// Replaces the root layout when that layout itself fails, so none of the app's styles or fonts are
// loaded here: it must bring its own <html>, <body> and (inline) styling.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#F8FAFC', color: '#0F172A', fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>
        <title>Something went wrong</title>
        <main style={{ maxWidth: 560, margin: '0 auto', padding: '18vh 20px 0' }}>
          <h1 style={{ margin: 0, fontWeight: 700, fontSize: 32, lineHeight: 1.15, letterSpacing: '-0.025em' }}>
            Something went wrong
          </h1>
          <p style={{ marginTop: 14, fontSize: 17, lineHeight: 1.55, color: '#334155' }}>
            The site could not load. This is a problem on our side. Try again in a moment.
          </p>
          {error.digest && <p style={{ marginTop: 12, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 13, color: '#64748B' }}>Reference: {error.digest}</p>}
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 28, minHeight: 44, padding: '0 20px', border: 0, borderRadius: 8, background: '#2563EB', color: '#FFFFFF', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
