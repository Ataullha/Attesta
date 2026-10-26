'use client';

import { useCopy } from '@/components/app/client-utils';
import { btn } from '@/components/ui/styles';

/**
 * For the person the certificate belongs to: the verification link is the proof, so make it easy
 * to pass on, and to add to a LinkedIn profile where recruiters will click through to this page.
 */
export function ShareCertificate({ url, linkedInAddUrl }: { url: string; linkedInAddUrl: string }) {
  const [copied, copy] = useCopy();
  const cls = btn.small + ' border border-rule-2 bg-card hover:border-brass';
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" className={cls} onClick={() => copy(url)}>
        {copied === 'copied' ? 'Link copied' : copied === 'failed' ? 'Could not copy' : 'Copy link'}
        <span className="sr-only" role="status">{copied === 'copied' ? 'Link copied' : copied === 'failed' ? 'Could not copy the link' : ''}</span>
      </button>
      <a href={linkedInAddUrl} target="_blank" rel="noopener noreferrer" className={cls}>
        Add to LinkedIn profile
      </a>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={cls}>
        Share on LinkedIn
      </a>
    </div>
  );
}
