export const btn = {
  base: 'inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-lg text-[15px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
  // The main action on a screen.
  get primary() { return `${this.base} bg-accent text-white shadow-sm hover:bg-accent-dark`; },
  get secondary() { return `${this.base} border border-rule-2 bg-card text-ink shadow-sm hover:bg-paper`; },
  get ghost() { return `${this.base} px-3 text-ink-2 hover:bg-rule/60`; },
  get danger() { return `${this.base} px-3 text-revoked hover:bg-revoked-soft`; },
  get seal() { return `${this.base} bg-seal text-white hover:bg-seal-dark`; },
  small: 'inline-flex items-center justify-center gap-1.5 min-h-9 px-3 rounded-lg text-[13.5px] transition-colors cursor-pointer disabled:opacity-50',
};

export const field = {
  // The ring replaces the outline, so keyboard focus stays plain to see.
  input: 'w-full min-h-11 px-3 rounded-lg border border-rule-2 bg-card text-[15px] text-ink shadow-sm placeholder:text-muted/80 focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20',
  small: 'w-full min-h-9 px-2.5 rounded-lg border border-rule-2 bg-card text-[14px] text-ink focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20',
  label: 'block text-[13px] text-ink-2 mb-1.5',
  hint: 'text-[12.5px] leading-snug text-muted mt-1',
};

export const card = 'bg-card border border-rule rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
