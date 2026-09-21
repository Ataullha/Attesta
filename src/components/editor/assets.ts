'use client';

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

/** Resolves image references to decoded images (for canvas) and raw bytes (for the PDF). */
export class AssetStore {
  private local = new Map<string, Blob>();
  private blobs = new Map<string, Promise<Blob | null>>();
  private images = new Map<string, Promise<HTMLImageElement | null>>();

  addLocal(blob: Blob) {
    const id = `local-${crypto.randomUUID()}`;
    this.local.set(id, blob);
    return id;
  }

  private blob(ref: ImageRef) {
    const key = refKey(ref);
    if (!key) return Promise.resolve(null);
    let p = this.blobs.get(key);
    if (!p) {
      p = ref.localId
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
