'use client';

import Script from 'next/script';
import { useEffect, useRef } from 'react';

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

/**
 * Google AdSense unit. Renders nothing until NEXT_PUBLIC_ADSENSE_CLIENT is set,
 * and is only placed on public pages — never inside the editor or dashboards.
 */
export function AdSlot({ slot, className = '' }: { slot: string; className?: string }) {
  const pushed = useRef(false);
  useEffect(() => {
    if (!CLIENT || pushed.current) return;
    pushed.current = true;
    try {
      ((window as unknown as { adsbygoogle: unknown[] }).adsbygoogle ||= []).push({});
    } catch {
      /* ad blockers */
    }
  }, []);
  if (!CLIENT) return null;
  return (
    <aside aria-label="Advertisement" className={`mx-auto max-w-6xl px-5 ${className}`}>
      <Script id="adsbygoogle-init" strategy="afterInteractive" crossOrigin="anonymous" src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`} />
      <p className="mb-1 text-[11px] text-muted">Advertisement</p>
      <ins className="adsbygoogle block" style={{ display: 'block' }} data-ad-client={CLIENT} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
