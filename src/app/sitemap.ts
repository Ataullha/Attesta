import type { MetadataRoute } from 'next';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { PRESETS } from '@/lib/presets';
import { USE_CASES } from '@/lib/usecases';
import { site } from '@/lib/site';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${site.url}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${site.url}/create`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${site.url}/templates`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${site.url}/id-card-maker`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${site.url}/visiting-card-maker`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${site.url}/invitation-card-maker`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${site.url}/certificate-maker`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${site.url}/verify`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${site.url}/pricing`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${site.url}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${site.url}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    ...PRESETS.map((p) => ({ url: `${site.url}/templates/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
    ...USE_CASES.map((u) => ({ url: `${site.url}/certificate-maker/${u.slug}`, changeFrequency: 'monthly' as const, priority: 0.8 })),
  ];
  // Public verification pages the issuer allowed search engines to list (newest 20,000).
  if (!process.env.DATABASE_URL) return pages;
  try {
    const { db, schema } = await import('@/lib/db');
    const rows = await db()
      .select({ serial: schema.certificates.serial, issuedAt: schema.certificates.issuedAt })
      .from(schema.certificates)
      .where(and(eq(schema.certificates.indexable, true), eq(schema.certificates.deindexed, false), isNull(schema.certificates.revokedAt)))
      .orderBy(desc(schema.certificates.issuedAt))
      .limit(20000);
    return [...pages, ...rows.map((r) => ({ url: `${site.url}/verify/${r.serial}`, lastModified: r.issuedAt, changeFrequency: 'yearly' as const, priority: 0.4 }))];
  } catch {
    return pages;
  }
}
