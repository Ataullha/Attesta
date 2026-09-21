import 'server-only';
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { designSchema, hasLocalImages, referencedAssetIds, type Design } from './design';
import { HttpError } from './security/request';

export function parseDesign(raw: unknown): Design {
  const res = designSchema.safeParse(raw);
  if (!res.success) {
    const issue = res.error.issues[0];
    throw new HttpError(400, `The design is not valid: ${issue?.message ?? 'unknown problem'}${issue?.path?.length ? ` (at ${issue.path.join('.')})` : ''}`);
  }
  return res.data;
}

export async function assertDesignAssetsOwned(design: Design, userId: string) {
  if (hasLocalImages(design)) throw new HttpError(400, 'Upload every image before saving.');
  const ids = referencedAssetIds(design);
  if (!ids.length) return;
  const owned = await db()
    .select({ id: schema.assets.id })
    .from(schema.assets)
    .where(and(eq(schema.assets.userId, userId), inArray(schema.assets.id, ids)));
  if (owned.length !== ids.length) throw new HttpError(403, 'This design uses an image that is not in your library.');
}

export function isUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
