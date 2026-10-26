'use client';

import dynamic from 'next/dynamic';

/**
 * The bulk issuer brings the certificate renderer, the PDF writer and the CSV parser with it. Imported
 * straight into the page, all of that loads even for an account without credits, which is only shown
 * the packages; loaded through here, it comes only when the issuer is actually on the page.
 */
export const LazyBulkIssuer = dynamic(() => import('./BulkIssuer').then((m) => m.BulkIssuer), {
  loading: () => <p className="text-[15px] text-muted">Loading the bulk issuer…</p>,
});
