import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { ImageTooLargeError, reencodeImage, sniffImage } from '@/lib/images';

/** Pseudo-random bytes (xorshift32 with a fixed seed, so failures reproduce) - noise is what defeats compression. */
function noise(w: number, h: number, channels: 3 | 4, amp = 256) {
  let s = 0x9e3779b9;
  const buf = Buffer.alloc(w * h * channels);
  for (let i = 0; i < buf.length; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    buf[i] = (s >>> 0) % amp;
  }
  return buf;
}
const png = (w: number, h: number, channels: 3 | 4 = 4, amp = 256) => sharp(noise(w, h, channels, amp), { raw: { width: w, height: h, channels } }).png({ compressionLevel: 1 }).toBuffer();

describe('sniffImage', () => {
  it('recognises PNG, JPEG and WebP by their bytes', async () => {
    expect(sniffImage(await png(8, 8))).toBe('png');
    expect(sniffImage(await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).jpeg().toBuffer())).toBe('jpeg');
    expect(sniffImage(await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).webp().toBuffer())).toBe('webp');
  });

  it('rejects everything else, whatever it claims to be', () => {
    expect(sniffImage(Buffer.from('GIF89a......'))).toBeNull();
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
    expect(sniffImage(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
    expect(sniffImage(Buffer.from('RIFF\x00\x00\x00\x00WAVEfmt '))).toBeNull(); // RIFF, but audio
    expect(sniffImage(Buffer.alloc(0))).toBeNull();
    expect(sniffImage(Buffer.from([0x89, 0x50]))).toBeNull();
    // Starts like a JPEG marker (FF D8 FF) in one byte but not the others.
    expect(sniffImage(Buffer.from([0xff, 0xaa, 0xff, 0x00, 0x00]))).toBeNull();
    expect(sniffImage(Buffer.from([0xff, 0xd8, 0x00, 0x00, 0x00]))).toBeNull();
  });
});

describe('reencodeImage', () => {
  it('keeps transparency as PNG and leaves a small image its size', async () => {
    const out = await reencodeImage(await png(300, 200), 'image');
    expect(out.mime).toBe('image/png');
    expect([out.width, out.height]).toEqual([300, 200]);
    expect(await sharp(out.data).metadata()).toMatchObject({ format: 'png', hasAlpha: true });
  });

  it('turns an opaque photo-like upload into a JPEG, but keeps signatures, logos and seals as PNG', async () => {
    const opaque = await sharp(noise(200, 100, 3), { raw: { width: 200, height: 100, channels: 3 } }).png().toBuffer();
    expect((await reencodeImage(opaque, 'background')).mime).toBe('image/jpeg');
    for (const kind of ['signature', 'logo', 'seal'] as const) expect((await reencodeImage(opaque, kind)).mime, kind).toBe('image/png');
  });

  it('never enlarges an image beyond 2600px on its longest side', async () => {
    const out = await reencodeImage(await sharp({ create: { width: 3000, height: 1500, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } }).png().toBuffer(), 'image');
    expect(Math.max(out.width, out.height)).toBe(2600);
    expect(out.height).toBe(1300);
  });

  it('applies EXIF orientation and drops all metadata', async () => {
    const jpeg = await sharp(noise(100, 50, 3), { raw: { width: 100, height: 50, channels: 3 } })
      .jpeg()
      .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'secret-owner-name' } } })
      .toBuffer();
    const out = await reencodeImage(jpeg, 'background');
    expect([out.width, out.height]).toEqual([50, 100]); // rotated upright
    const meta = await sharp(out.data).metadata();
    expect(meta.exif).toBeUndefined();
    expect(out.data.includes(Buffer.from('secret-owner-name'))).toBe(false);
  });

  // The regression this guards: re-encoding enlarged a grainy indexed PNG from 3.4 MB to 5 MB, past what a
  // serverless function can send back, so an accepted upload could never be loaded again.
  it('steps the resolution down until the stored image fits its size limit', async () => {
    const big = await png(900, 700, 4);
    const unconstrained = await reencodeImage(big, 'image', { maxBytes: 50_000_000 });
    expect(unconstrained.data.length).toBeGreaterThan(400_000);

    const cap = 400_000;
    const out = await reencodeImage(big, 'image', { maxBytes: cap });
    expect(out.data.length).toBeLessThanOrEqual(cap);
    expect(out.width).toBeLessThan(900);
    expect(out.width / out.height).toBeCloseTo(900 / 700, 1); // same shape, just smaller
  });

  it('gives up with a clear error rather than storing something it cannot serve', async () => {
    await expect(reencodeImage(await png(600, 600, 4), 'image', { maxBytes: 2_000 })).rejects.toBeInstanceOf(ImageTooLargeError);
    await expect(reencodeImage(await png(600, 600, 4), 'image', { maxBytes: 2_000 })).rejects.toThrow(/too detailed/);
  });

  it('refuses bytes that are not an image', async () => {
    await expect(reencodeImage(Buffer.from('definitely not an image'), 'image')).rejects.toThrow();
  });

  it('refuses a decompression bomb instead of exhausting memory', async () => {
    // 10000 x 10000 = 100 megapixels against a limit of 60; a solid colour compresses to a few KB, which is the danger.
    const bomb = await sharp({ create: { width: 10000, height: 10000, channels: 3, background: '#fff' } }).png({ compressionLevel: 9 }).toBuffer();
    expect(bomb.length).toBeLessThan(4 * 1024 * 1024);
    await expect(reencodeImage(bomb, 'background')).rejects.toThrow();
  }, 120_000);
});
