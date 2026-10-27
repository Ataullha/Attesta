import type { Metadata, Viewport } from 'next';
// One variable file per script covers every weight the interface uses. (The certificate editor loads
// the certificate typefaces itself: components/editor/fonts.ts.)
import '@fontsource-variable/inter';
import '@fontsource/jetbrains-mono/400.css';
// Bangla faces only: the browser downloads them on pages that contain Bangla text, and never otherwise.
import '@fontsource/hind-siliguri/bengali-400.css';
import '@fontsource/hind-siliguri/bengali-600.css';
import '@fontsource/hind-siliguri/bengali-700.css';
import './globals.css';
import { site } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} — Certificate maker with QR verification`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
  // No default canonical here: metadata is inherited, so a root-level one would make every page that
  // does not set its own (login, register, 404…) claim to be a duplicate of the home page.
  openGraph: { type: 'website', siteName: site.name, locale: 'en_US', url: site.url },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large' } },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#F8FAFC',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-card">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
