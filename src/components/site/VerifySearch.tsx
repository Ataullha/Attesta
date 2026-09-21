import { btn, field } from '@/components/ui/styles';

/** Plain GET form so it works before JavaScript loads. */
export function VerifySearch({ className = '', defaultValue = '' }: { className?: string; defaultValue?: string }) {
  return (
    <form action="/verify" method="get" role="search" className={`flex gap-2 ${className}`}>
      <label className="flex-1">
        <span className="sr-only">Certificate serial number</span>
        <input
          name="serial"
          defaultValue={defaultValue}
          required
          minLength={6}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          placeholder="ATT-XXXX-XXXX-XXXX"
          className={field.input + ' font-mono uppercase tracking-wider'}
        />
      </label>
      <button type="submit" className={btn.primary}>Check</button>
    </form>
  );
}
