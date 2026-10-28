import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { getUser } from '@/lib/auth/session';
import { designSchema, type Design } from '@/lib/design';
import { blankIdCard, getPreset, presetDesign } from '@/lib/presets';
import { usageThisMonth } from '@/lib/issue';
import { isUuid } from '@/lib/validate';
import { limits } from '@/lib/site';
import { Editor, type EditorUser } from '@/components/editor/Editor';

export const metadata: Metadata = {
  title: 'Certificate and ID card editor',
  description: 'Free online certificate and ID card editor: drag and resize every field, add custom fields, photos, a signature, QR code and barcode, or use your own design as the background.',
  alternates: { canonical: '/create' },
};

export default async function CreatePage({ searchParams }: PageProps<'/create'>) {
  const sp = await searchParams;
  const user = await getUser();
  const presetSlug = typeof sp.preset === 'string' ? sp.preset : null;
  const templateParam = typeof sp.template === 'string' ? sp.template : null;

  let design: Design = presetDesign(presetSlug ?? 'classic-ledger');
  let name = getPreset(presetSlug ?? 'classic-ledger')?.name ?? 'Untitled template';
  let templateId: string | null = null;
  if (presetSlug === 'blank') {
    design = presetDesign(null);
    name = 'Untitled template';
  } else if (presetSlug === 'blank-id-card') {
    design = blankIdCard();
    name = 'Untitled ID card';
  }

  if (user && templateParam && isUuid(templateParam)) {
    const [t] = await db()
      .select()
      .from(schema.templates)
      .where(and(eq(schema.templates.id, templateParam), eq(schema.templates.userId, user.id)))
      .limit(1);
    const parsed = t ? designSchema.safeParse(t.design) : null;
    if (t && parsed?.success) {
      design = parsed.data;
      name = t.name;
      templateId = t.id;
    }
  }

  let editorUser: EditorUser = null;
  if (user) {
    const used = await usageThisMonth(user.id);
    editorUser = { name: user.name, credits: user.credits, freeLeft: Math.max(0, limits.freeMonthly - used), emailVerified: user.emailVerified };
  }

  return <Editor key={templateId ?? presetSlug ?? 'new'} initialDesign={design} initialName={name} templateId={templateId} user={editorUser} guestLimit={limits.guestLifetime} />;
}
