import { existsSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { PRESETS } from '@/lib/presets';

// Marketing pages show pre-rendered pictures of the templates (scripts/render-previews.mjs).
// A template added without them would show a broken image.
describe('template preview images', () => {
  it.each(PRESETS.map((p) => [p.slug, p] as const))('%s has both sizes, in its own proportions', async (_slug, p) => {
    for (const width of [640, 1280]) {
      const file = `public/previews/${p.slug}-${width}.webp`;
      expect(existsSync(file), `${file} is missing: run \`npm run previews\` with the dev server running`).toBe(true);
      const meta = await sharp(file).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.width).toBe(width);
      expect(Math.abs(meta.height! / meta.width! - p.design.page.height / p.design.page.width)).toBeLessThan(0.01);
    }
  });
});
