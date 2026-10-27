/** Shown while a dashboard or admin page fetches its data, so navigating never looks frozen. */
export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="animate-pulse">
      <span className="sr-only">Loading…</span>
      <div className="h-10 w-56 rounded-lg bg-rule" />
      <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-rule bg-rule sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 bg-card" />
        ))}
      </div>
      <div className="mt-10 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-lg border border-rule bg-card" />
        ))}
      </div>
    </div>
  );
}
