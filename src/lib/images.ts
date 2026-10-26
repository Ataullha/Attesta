import 'server-only';
import sharp from 'sharp';
import { limits } from './site';

export const ASSET_KINDS = ['signature', 'logo', 'seal', 'background', 'image'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export type StoredImage = { data: Buffer; mime: 'image/png' | 'image/jpeg'; width: number; height: number };

export class ImageTooLargeError extends Error {
  constructor() {
    super('This image is too detailed to store. Export it at a smaller size or as a JPEG and try again.');
  }
}

/** What the bytes really are, whatever the filename or declared type says. */
export function sniffImage(buf: Buffer): 'png' | 'jpeg' | 'webp' | null {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.length > 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

const MAX_SIDE = 2600;
const MIN_SIDE = 400;

/**
 * Re-encodes an upload as a clean PNG (when it needs transparency) or JPEG, which strips metadata and
 * anything hidden in the original file, fixes its orientation, and caps its size.
 *
 * The size cap matters because the stored image is served back from a serverless function, and
 * platforms like Vercel refuse responses above 4.5 MB. Re-encoding can make a file bigger than it
 * was - a grainy 3.4 MB indexed-colour PNG becomes about 5 MB once expanded to full colour - and an
 * image that uploads but can never be loaded again fails silently in the editor and the PDF. So if
 * the result is too big, the resolution is stepped down until it fits.
 */
export async function reencodeImage(input: Buffer, kind: AssetKind, opts: { maxBytes?: number } = {}): Promise<StoredImage> {
  const maxBytes = opts.maxBytes ?? limits.storedImageMaxBytes;
  const open = () => sharp(input, { limitInputPixels: 60_000_000, failOn: 'error' }).rotate();
  const meta = await open().metadata();
  const keepAlpha = !!meta.hasAlpha || kind === 'signature' || kind === 'seal' || kind === 'logo';

  for (let side = MAX_SIDE; ; side = Math.floor(side * 0.8)) {
    const img = open().resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true });
    const { data, info } = keepAlpha
      ? await img.png({ compressionLevel: 9, palette: false }).toBuffer({ resolveWithObject: true })
      : await img.jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    if (data.length <= maxBytes) return { data, mime: keepAlpha ? 'image/png' : 'image/jpeg', width: info.width, height: info.height };
    if (side <= MIN_SIDE) throw new ImageTooLargeError();
  }
}
