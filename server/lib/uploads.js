/**
 * Image uploads: memory storage -> validation -> sharp processing
 * (auto-rotate, resize, compress to webp + jpeg) -> disk.
 * Nothing is written until the file has been proven to be a real image.
 */
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import { CONFIG } from '../config.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/tiff']);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CONFIG.upload.maxBytes, files: 1, fields: 25 },
  fileFilter(req, file, cb) {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    const err = new Error('Please upload a JPG, PNG, WEBP, AVIF or GIF image.');
    err.status = 400;
    return cb(err);
  },
});

/** Separate instance for JSON backup restores (no image filter, larger cap). */
export const uploadBackup = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CONFIG.backups.maxRestoreBytes, files: 1, fields: 10 },
});

const randomName = (ext) => `${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}.${ext}`;

/**
 * @returns {Promise<{ok:boolean, path?:string, thumb?:string, width?:number, height?:number, bytes?:number, message?:string}>}
 */
export async function processPoster(file) {
  if (!file || !file.buffer?.length) return { ok: false, message: 'No image received.' };

  let meta;
  try {
    meta = await sharp(file.buffer, { failOn: 'error' }).metadata();
  } catch {
    return { ok: false, message: 'That file could not be read as an image. Please try another one.' };
  }
  if (!meta.width || !meta.height) return { ok: false, message: 'That image appears to be empty or corrupt.' };
  if (meta.width < 240 || meta.height < 160) {
    // tiny images are still fine, we just upscale-free resize them
  }
  const MIN_PIXELS = 20_000;
  if (meta.width * meta.height < MIN_PIXELS) {
    return { ok: false, message: 'That image is too small to use as a poster (minimum around 200 x 100 pixels).' };
  }

  const { posterWidth, posterHeight, thumbWidth, thumbHeight } = CONFIG.upload;
  const base = randomName('').replace(/\.$/, '');
  const main = `${base}.jpg`;
  const thumb = `${base}-thumb.jpg`;

  const pipeline = (w, h) =>
    sharp(file.buffer)
      .rotate()
      .resize(w, h, { fit: 'cover', position: 'centre', withoutEnlargement: false })
      .modulate({ brightness: 1.0 })
      .sharpen({ sigma: 0.5 });

  await pipeline(posterWidth, posterHeight).jpeg({ quality: 78, mozjpeg: true, progressive: true }).toFile(path.join(CONFIG.uploadDir, main));
  await pipeline(thumbWidth, thumbHeight).jpeg({ quality: 72, mozjpeg: true, progressive: true }).toFile(path.join(CONFIG.uploadDir, thumb));

  const out = await sharp(path.join(CONFIG.uploadDir, main)).metadata();
  return {
    ok: true,
    path: `/uploads/events/${main}`,
    thumb: `/uploads/events/${thumb}`,
    width: out.width,
    height: out.height,
    bytes: out.size || 0,
    originalBytes: file.size,
    savedPercent: file.size ? Math.max(0, Math.round((1 - (out.size || 0) / file.size) * 100)) : 0,
  };
}

export const uploadLimits = {
  maxBytes: CONFIG.upload.maxBytes,
  label: `${Math.round(CONFIG.upload.maxBytes / (1024 * 1024))} MB`,
};
