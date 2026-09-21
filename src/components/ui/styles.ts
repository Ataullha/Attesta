export const btn = {
  base: 'inline-flex items-center justify-center gap-2 min-h-11 px-5 rounded-[4px] text-[15px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
  get primary() { return `${this.base} bg-ink text-card hover:bg-[#2B2821]`; },
  get brass() { return `${this.base} bg-brass text-card hover:bg-brass-dark`; },
  get secondary() { return `${this.base} border border-rule-2 text-ink bg-transparent hover:bg-card`; },
  get ghost() { return `${this.base} px-3 text-ink-2 hover:bg-rule/60`; },
  get danger() { return `${this.base} px-3 text-revoked hover:bg-revoked-soft`; },
  get seal() { return `${this.base} bg-seal text-card hover:bg-[#24553F]`; },
  small: 'inline-flex items-center justify-center gap-1.5 min-h-9 px-3 rounded-[4px] text-[13.5px] transition-colors cursor-pointer disabled:opacity-50',
};

export const field = {
  input: 'w-full min-h-11 px-3 rounded-[4px] border border-rule-2 bg-card text-[15px] text-ink placeholder:text-muted/80 focus:border-brass focus:outline-none',
  small: 'w-full min-h-9 px-2.5 rounded-[4px] border border-rule-2 bg-card text-[14px] text-ink focus:border-brass focus:outline-none',
  label: 'block text-[13px] text-ink-2 mb-1.5',
  hint: 'text-[12.5px] leading-snug text-muted mt-1',
};

export const card = 'bg-card border border-rule rounded-md';
