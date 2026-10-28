'use client';

import { photoRef, type Design } from '@/lib/design';

export type ImageRef = { assetId: string | null; localId: string | null };
type Bytes = { bytes: Uint8Array; mime: 'image/png' | 'image/jpeg' };

const MAX_DIM = 2600;

function refKey(ref: ImageRef) {
  return ref.assetId ? `a:${ref.assetId}` : ref.localId ? `l:${ref.localId}` : null;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to load'));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality),
  );
}

/**
 * Makes any image the browser can decode into a PNG or JPEG no larger than MAX_DIM,
 * which is what the PDF writer and the upload endpoint accept.
 */
export async function normaliseImageFile(file: File, keepAlpha: boolean): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const okType = file.type === 'image/png' || file.type === 'image/jpeg';
    if (scale === 1 && okType && file.size < 3.5 * 1024 * 1024) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const alpha = keepAlpha || file.type === 'image/png' || file.type === 'image/webp';
    return alpha ? canvasToBlob(c, 'image/png') : canvasToBlob(c, 'image/jpeg', 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * How large a photo needs to be: enough pixels for the largest photo frame on the design at
 * 400 dpi (design units are 96 per inch), within sensible bounds.
 */
export function photoSide(design: Design) {
  const frames = design.elements.filter((e) => e.type === 'photo');
  const longest = Math.max(0, ...frames.map((e) => Math.max(e.w, e.h)));
  return Math.min(1600, Math.max(320, Math.ceil((longest / 96) * 400)));
}

/**
 * A photo ready for a document: the right way up (browsers apply the camera's orientation when
 * drawing), on white where it was transparent, no longer than `side` pixels, as a JPEG. Phone
 * photos run to several megabytes; this keeps a PDF of hundreds of cards a sensible size.
 */
export async function preparePhoto(file: Blob, side: number): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await canvasToBlob(c, 'image/jpeg', 0.88);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resolves image references to decoded images (for canvas) and raw bytes (for the PDF). */
export class AssetStore {
  private local = new Map<string, Blob>();
  private photos = new Map<string, { file: Blob; side: number }>();
  private blobs = new Map<string, Promise<Blob | null>>();
  private images = new Map<string, Promise<HTMLImageElement | null>>();

  /**
   * A recipient's photo, found by its file name (see photoName). It stays in this page: it is
   * prepared when first drawn and never uploaded. Adding a photo under a name already used replaces it.
   */
  addPhoto(name: string, file: Blob, side: number) {
    const id = photoRef(name);
    if (!id) return null;
    this.photos.set(id, { file, side });
    this.blobs.delete(`l:${id}`);
    this.images.delete(`l:${id}`);
    return id;
  }

  hasPhoto(name: string) {
    const id = photoRef(name);
    return !!id && this.photos.has(id);
  }

  /** Prepares a photo now, so a file the browser cannot read is found before anything is issued. */
  async checkPhoto(name: string) {
    const id = photoRef(name);
    return !!id && !!(await this.blob({ assetId: null, localId: id }));
  }

  /** `id` is given when an image comes back from a kept draft, so the design's references still match. */
  addLocal(blob: Blob, id = `local-${crypto.randomUUID()}`) {
    this.local.set(id, blob);
    return id;
  }

  /** An image added without an account, which exists only in this page until it is uploaded. */
  getLocal(id: string) {
    return this.local.get(id);
  }

  private blob(ref: ImageRef) {
    const key = refKey(ref);
    if (!key) return Promise.resolve(null);
    let p = this.blobs.get(key);
    if (!p) {
      const photo = ref.localId ? this.photos.get(ref.localId) : undefined;
      p = photo
        ? preparePhoto(photo.file, photo.side).catch(() => null)
        : ref.localId
          ? Promise.resolve(this.local.get(ref.localId) ?? null)
          : fetch(`/api/assets/${ref.assetId}`, { credentials: 'same-origin' })
              .then((r) => (r.ok ? r.blob() : null))
              .catch(() => null);
      this.blobs.set(key, p);
    }
    return p;
  }

  image(ref: ImageRef): Promise<HTMLImageElement | null> {
    const key = refKey(ref);
    if (!key) return Promise.resolve(null);
    let p = this.images.get(key);
    if (!p) {
      p = this.blob(ref).then(async (b) => {
        if (!b) return null;
        try {
          return await loadImage(URL.createObjectURL(b));
        } catch {
          return null;
        }
      });
      this.images.set(key, p);
    }
    return p;
  }

  async bytes(ref: ImageRef): Promise<Bytes | null> {
    const b = await this.blob(ref);
    if (!b) return null;
    const bytes = new Uint8Array(await b.arrayBuffer());
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (isPng) return { bytes, mime: 'image/png' };
    if (isJpg) return { bytes, mime: 'image/jpeg' };
    return null;
  }
}
