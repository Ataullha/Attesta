import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { ASSET_KINDS, ImageTooLargeError, reencodeImage, sniffImage, type AssetKind } from '@/lib/images';
import { HttpError, json, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { limits } from '@/lib/site';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const user = await requireUser();
  const rows = await db()
    .select({
      id: schema.assets.id,
      kind: schema.assets.kind,
      name: schema.assets.name,
      width: schema.assets.width,
      height: schema.assets.height,
      size: schema.assets.size,
      createdAt: schema.assets.createdAt,
    })
    .from(schema.assets)
    .where(and(eq(schema.assets.userId, user.id), isNull(schema.assets.deletedAt)))
    .orderBy(desc(schema.assets.createdAt));
  return json({ assets: rows });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  await rateLimit(`upload:${user.id}`, 30, 600);
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > limits.uploadMaxBytes + 64 * 1024) throw new HttpError(413, 'Images must be under 4 MB.');

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  const kindRaw = String(form?.get('kind') ?? 'image');
  const kind: AssetKind = (ASSET_KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as AssetKind) : 'image';
  if (!(file instanceof File)) throw new HttpError(400, 'Choose an image to upload.');
  if (file.size > limits.uploadMaxBytes) throw new HttpError(413, 'Images must be under 4 MB.');

  const input = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not the filename or the declared type.
  if (!sniffImage(input)) throw new HttpError(415, 'Use a PNG, JPEG or WebP image. SVG and other formats are not accepted.');

  const [{ n }] = await db()
    .select({ n: count() })
    .from(schema.assets)
    .where(and(eq(schema.assets.userId, user.id), isNull(schema.assets.deletedAt)));
  if (Number(n) >= limits.assetsPerUser) throw new HttpError(400, 'Your image library is full. Delete some images first.');

  let stored;
  try {
    // Re-encoding strips metadata and anything hidden in the original file, and keeps the result small enough to serve back.
    stored = await reencodeImage(input, kind);
  } catch (err) {
    if (err instanceof ImageTooLargeError) throw new HttpError(413, err.message);
    throw new HttpError(415, 'That file could not be read as an image.');
  }

  const name = (file.name || 'image').replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 80) || 'image';
  const { data, mime, width, height } = stored;
  const [row] = await db()
    .insert(schema.assets)
    .values({ userId: user.id, kind, name, mime, width, height, size: data.length, bytes: data })
    .returning({ id: schema.assets.id });
  return json({ id: row.id, kind, name, width, height, mime });
});
