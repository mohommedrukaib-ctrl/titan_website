/**
 * One-off asset preparation for TITAN EVENTS.
 * Generates the transparent logo mark, favicons, optimized hero/OG images
 * and the seeded event posters from the raw AI-generated source images.
 *
 *   node scripts/prepare-assets.mjs
 */
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const IMG = path.join(ROOT, 'public', 'img');
const SEED = path.join(ROOT, 'public', 'uploads', 'seed');

const log = (...a) => console.log('[assets]', ...a);

/** Turn the black-backed emblem into a transparent gold mark. */
async function transparentMark(src, size, out, pad = 0.02) {
  const buf = await sharp(src)
    .ensureAlpha()
    .resize(size, size, { fit: 'cover', position: 'centre' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = buf;
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // key out the near-black backdrop, keep the gold lines (with soft edges)
    let a = (lum - 10) * 1.9;
    a = a < 0 ? 0 : a > 255 ? 255 : a;
    data[i + 3] = Math.round(a);
    // slightly richer gold
    data[i] = Math.min(255, Math.round(r * 1.04));
    data[i + 1] = Math.min(255, Math.round(g * 1.02));
    data[i + 2] = Math.min(255, Math.round(b * 1.06));
  }

  const inner = Math.round(size * (1 - pad * 2));
  const composite = await sharp(data, { raw: { width, height, channels } })
    .trim({ threshold: 4 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, colours: 64, effort: 10 })
    .toBuffer();

  await sharp({
    create: {
      width: size, height: size, channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: composite, gravity: 'centre' }])
    .png({ compressionLevel: 9, palette: true, colours: 64, effort: 10 })
    .toFile(out);
  log('mark ->', path.relative(ROOT, out), `${size}px`);
}

/** Dark, warm grade + resize for photographic assets. */
async function photo(src, out, w, h, quality = 78) {
  const buf = await sharp(src)
    .resize(w, h, { fit: 'cover', position: 'centre' })
    .modulate({ brightness: 0.94, saturation: 1.04 })
    .sharpen({ sigma: 0.6 })
    .jpeg({ quality, mozjpeg: true, progressive: true })
    .toBuffer();
  await sharp(buf).toFile(out);
  const meta = await sharp(out).metadata();
  log('photo ->', path.relative(ROOT, out), `${meta.width}x${meta.height}`);
}

await mkdir(IMG, { recursive: true });
await mkdir(SEED, { recursive: true });

await transparentMark(path.join(ROOT, 'scripts', 'assets', 'logo-source.png'), 320, path.join(IMG, 'logo-mark.png'));
await transparentMark(path.join(ROOT, 'scripts', 'assets', 'logo-source.png'), 180, path.join(IMG, 'favicon.png'), 0.06);
await transparentMark(path.join(ROOT, 'scripts', 'assets', 'logo-source.png'), 192, path.join(IMG, 'icon-192.png'), 0.06);
await transparentMark(path.join(ROOT, 'scripts', 'assets', 'logo-source.png'), 512, path.join(IMG, 'icon-512.png'), 0.06);

await photo(path.join(IMG, 'hero.jpg'), path.join(IMG, 'hero.jpg'), 1920, 1080, 72);
await photo(path.join(IMG, 'og-image.jpg'), path.join(IMG, 'og-image.jpg'), 1200, 630, 80);

const seeds = ['wedding', 'concert', 'party', 'corporate', 'production'];
for (const name of seeds) {
  await photo(path.join(SEED, `${name}.jpg`), path.join(SEED, `${name}.jpg`), 1200, 800, 76);
}

log('done');
