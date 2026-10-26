'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export async function postJson(url: string, body: unknown, method = 'POST') {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error ?? 'Something went wrong.');
  return j;
}

/**
 * Copies text and says whether it worked. The async clipboard API only exists in secure contexts and
 * can be refused by permissions, and callers used to fire it and never look at the result, so a copy
 * that failed looked exactly like one that worked.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through to the older route, which works without permission on a user gesture.
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/** A copy button's state: `copy(text)` sets it for a moment, then it settles back to idle. */
export function useCopy(resetMs = 1800) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text);
      setState(ok ? 'copied' : 'failed');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState('idle'), resetMs);
    },
    [resetMs],
  );
  return [state, copy] as const;
}
