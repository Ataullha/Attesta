/** A small check mark for lists of what is included. Decorative: the text beside it says it all. */
export function Tick({ className = 'text-seal' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" className={`mt-[3px] shrink-0 ${className}`}>
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
