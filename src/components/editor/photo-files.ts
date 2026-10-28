'use client';

const IMAGE = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;

export type PhotoFile = { name: string; file: Blob };

/**
 * The photos among the files someone chose: image files, and the images inside any ZIP. Each keeps
 * its file name without folders, which is what rows are matched by. Anything else is listed as
 * skipped, by name, so it can be pointed out (iPhone HEIC photos, most often).
 */
export async function readPhotoFiles(files: Iterable<File>): Promise<{ photos: PhotoFile[]; skipped: string[] }> {
  const photos: PhotoFile[] = [];
  const skipped: string[] = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name) || f.type === 'application/zip' || f.type === 'application/x-zip-compressed') {
      const JSZip = (await import('jszip')).default;
      const zip = await JSZip.loadAsync(f);
      for (const entry of Object.values(zip.files)) {
        // Folders, and the metadata macOS adds to the ZIPs it makes.
        if (entry.dir || entry.name.startsWith('__MACOSX/')) continue;
        const name = entry.name.replace(/^.*\//, '');
        if (!name || name.startsWith('.')) continue;
        if (IMAGE.test(name)) photos.push({ name, file: await entry.async('blob') });
        else skipped.push(name);
      }
    } else if ((f.type.startsWith('image/') && !/heic|heif/i.test(f.type)) || IMAGE.test(f.name)) {
      photos.push({ name: f.name, file: f });
    } else {
      skipped.push(f.name);
    }
  }
  return { photos, skipped };
}

/** A sentence about files that were not photos, or null when there were none. */
export function skippedNote(skipped: string[]) {
  if (!skipped.length) return null;
  const heic = skipped.filter((n) => /\.(heic|heif)$/i.test(n)).length;
  const list = skipped.slice(0, 5).join(', ') + (skipped.length > 5 ? ` and ${skipped.length - 5} more` : '');
  return `${skipped.length} file${skipped.length === 1 ? ' is' : 's are'} not a JPEG, PNG or WebP photo and ${skipped.length === 1 ? 'was' : 'were'} left out: ${list}.${heic ? ' iPhone photos (HEIC) can be saved as JPEG first, or set the camera to “Most compatible”.' : ''}`;
}
