import { SEAL_D } from './seal-path';

export function SealMark({ size = 28, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="18.5" stroke={color} strokeWidth="1" />
      <circle cx="20" cy="20" r="13.5" stroke={color} strokeWidth="0.75" strokeDasharray="2 2.5" />
      <path d={SEAL_D} fill={color} />
    </svg>
  );
}
