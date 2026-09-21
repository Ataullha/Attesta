import Link from 'next/link';
import { site } from '@/lib/site';
import { USE_CASES } from '@/lib/usecases';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 text-[14px] sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-serif text-[24px]">{site.name}</p>
          <p className="mt-2 max-w-[30ch] text-muted">{site.shortDescription}</p>
        </div>
        <div>
          <h2 className="font-semibold">Product</h2>
          <ul className="mt-3 space-y-2 text-ink-2">
            <li><Link href="/create" className="hover:text-ink">Certificate editor</Link></li>
            <li><Link href="/templates" className="hover:text-ink">Templates</Link></li>
            <li><Link href="/verify" className="hover:text-ink">Verify a certificate</Link></li>
            <li><Link href="/pricing" className="hover:text-ink">Pricing</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">Certificates for</h2>
          <ul className="mt-3 space-y-2 text-ink-2">
            {USE_CASES.slice(0, 6).map((u) => (
              <li key={u.slug}><Link href={`/certificate-maker/${u.slug}`} className="hover:text-ink">{u.short}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-semibold">Company</h2>
          <ul className="mt-3 space-y-2 text-ink-2">
            <li><Link href="/privacy" className="hover:text-ink">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-ink">Terms</Link></li>
            <li><a href={`mailto:${site.supportEmail}`} className="hover:text-ink">{site.supportEmail}</a></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-6xl border-t border-rule px-5 py-5 text-[13px] text-muted">
        © {new Date().getFullYear()} {site.name}. {site.operatedFrom}.
      </div>
    </footer>
  );
}
