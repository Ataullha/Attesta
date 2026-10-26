'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { btn } from '@/components/ui/styles';
import { hasPresenceCookie } from '@/lib/auth/presence';

// Cookies fire no change events, so re-check when the tab regains attention or is restored from
// the back/forward cache (the cases where someone signed in or out elsewhere in the meantime).
function subscribe(onChange: () => void) {
  window.addEventListener('focus', onChange);
  window.addEventListener('pageshow', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    window.removeEventListener('focus', onChange);
    window.removeEventListener('pageshow', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}

/**
 * The header's account buttons. The page itself is static, so the HTML always ships the signed-out
 * buttons (which is also what search engines see); a signed-in visitor gets "Dashboard" after load.
 */
export function HeaderActions() {
  const signedIn = useSyncExternalStore(
    subscribe,
    () => hasPresenceCookie(document.cookie),
    () => false,
  );
  if (signedIn) {
    return (
      <>
        <Link href="/create" className={btn.ghost + ' hidden sm:inline-flex'}>
          New certificate
        </Link>
        <Link href="/app" className={btn.primary}>
          Dashboard
        </Link>
      </>
    );
  }
  return (
    <>
      <Link href="/login" className={btn.ghost}>
        Sign in
      </Link>
      <Link href="/create" className={btn.primary}>
        Make a certificate
      </Link>
    </>
  );
}
