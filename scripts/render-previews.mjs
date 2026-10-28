// Renders public/previews/<template>-640.webp and -1280.webp with the real certificate renderer.
//
// Marketing pages show these images rather than drawing templates in the browser, which would ship
// the renderer and every certificate font to each visitor. Run this after adding or changing a
// template in src/lib/presets.ts; a unit test fails while any template is missing its images.
//
//   npm run dev                  (in one terminal)
//   npm run previews             (in another; needs Playwright: npm i --no-save playwright)
//   npm run previews -- staff-id-card club-member-card   (only these templates)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const base = (process.env.PREVIEW_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const out = new URL('../public/previews/', import.meta.url);

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    // A global install is found through NODE_PATH, which only require() consults.
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    console.error('This script needs Playwright. Install it for this run with: npm i --no-save playwright && npx playwright install chromium');
    process.exit(1);
  }
}

mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 1 });

const index = await page.goto(`${base}/preview`);
if (!index?.ok()) {
  console.error(`${base}/preview did not load (status ${index?.status()}). Is \`npm run dev\` running?`);
  process.exit(1);
}
const only = process.argv.slice(2);
const slugs = (await page.$$eval('a[href^="/preview/"]', (links) => links.map((a) => a.getAttribute('href').split('/').pop()))).filter((s) => !only.length || only.includes(s));
if (!slugs.length) {
  console.error(`No templates called ${only.join(', ')}.`);
  process.exit(1);
}

for (const slug of slugs) {
  await page.goto(`${base}/preview/${slug}`);
  await page.waitForSelector('canvas[data-rendered="true"]', { timeout: 30_000 });
  const dataUrl = await page.$eval('canvas', (c) => c.toDataURL('image/png'));
  const png = Buffer.from(dataUrl.split(',')[1], 'base64');
  for (const width of [640, 1280]) {
    const file = new URL(`${slug}-${width}.webp`, out);
    const info = await sharp(png).resize({ width }).webp({ quality: 82 }).toFile(fileURLToPath(file));
    console.log(`${slug}-${width}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`);
  }
}

await browser.close();
