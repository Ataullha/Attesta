import { and, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUserPage } from '@/lib/auth/session';
import { PageTitle } from '@/components/app/Shell';
import { Library } from '@/components/app/Library';

export default async function LibraryPage() {
  const user = await requireUserPage('/app/library');
  const assets = await db()
    .select({ id: schema.assets.id, kind: schema.assets.kind, name: schema.assets.name, width: schema.assets.width, height: schema.assets.height, size: schema.assets.size })
    .from(schema.assets)
    .where(and(eq(schema.assets.userId, user.id), isNull(schema.assets.deletedAt)))
    .orderBy(desc(schema.assets.createdAt));
  return (
    <>
      <PageTitle title="Signatures and images" />
      <Library assets={assets} />
    </>
  );
}
