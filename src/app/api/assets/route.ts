import sharp from 'sharp';
import { and, count, desc, eq, isNull } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requireUser } from '@/lib/auth/session';
import { HttpError, json, route } from '@/lib/security/request';
import { rateLimit } from '@/lib/security/rate-limit';
import { limits } from '@/lib/site';

export const runtime = 'nodejs';

const KINDS = ['signature', 'logo', 'seal', 'background', 'image'] as const;

function sniff(buf: Buffer) {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

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
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? (kindRaw as (typeof KINDS)[number]) : 'image';
  if (!(file instanceof File)) throw new HttpError(400, 'Choose an image to upload.');
  if (file.size > limits.uploadMaxBytes) throw new HttpError(413, 'Images must be under 4 MB.');

  const input = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not the filename or the declared type.
  if (!sniff(input)) throw new HttpError(415, 'Use a PNG, JPEG or WebP image. SVG and other formats are not accepted.');

  const [{ n }] = await db()
    .select({ n: count() })
    .from(schema.assets)
    .where(and(eq(schema.assets.userId, user.id), isNull(schema.assets.deletedAt)));
  if (Number(n) >= limits.assetsPerUser) throw new HttpError(400, 'Your image library is full. Delete some images first.');

  let out: Buffer;
  let mime: 'image/png' | 'image/jpeg';
  let width: number;
  let height: number;
  try {
    // Re-encoding strips metadata and anything hidden in the original file.
    const img = sharp(input, { limitInputPixels: 60_000_000, failOn: 'error' }).rotate().resize({
      width: 2600,
      height: 2600,
      fit: 'inside',
      withoutEnlargement: true,
    });
    const meta = await img.metadata();
    const keepAlpha = meta.hasAlpha || kind === 'signature' || kind === 'seal' || kind === 'logo';
    const res = keepAlpha
      ? await img.png({ compressionLevel: 9, palette: false }).toBuffer({ resolveWithObject: true })
      : await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    out = res.data;
    mime = keepAlpha ? 'image/png' : 'image/jpeg';
    width = res.info.width;
    height = res.info.height;
  } catch {
    throw new HttpError(415, 'That file could not be read as an image.');
  }

  const name = (file.name || 'image').replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 80) || 'image';
  const [row] = await db()
    .insert(schema.assets)
    .values({ userId: user.id, kind, name, mime, width, height, size: out.length, bytes: out })
    .returning({ id: schema.assets.id });
  return json({ id: row.id, kind, name, width, height, mime });
});
