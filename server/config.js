import 'dotenv/config';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

export const CONFIG = {
  root: ROOT,
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',

  // Public site identity
  siteName: 'TITAN EVENTS',
  tagline: 'We Light Up Your Moments',
  locale: 'en_LK',

  // Where the JSON database, backups and activity log live
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
  uploadDir: process.env.UPLOAD_DIR || path.join(ROOT, 'public', 'uploads', 'events'),

  // Session signing / CSRF salt. Set SESSION_SECRET in production.
  sessionSecret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),

  // Admin security
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    // In production a random password is generated (and printed once) unless
    // ADMIN_PASSWORD is provided — so an install is never left on a default.
    password:
      process.env.ADMIN_PASSWORD ||
      ((process.env.NODE_ENV || 'development') === 'production'
        ? crypto.randomBytes(9).toString('base64url')
        : 'Titan@2025'),
    passwordIsGenerated: !process.env.ADMIN_PASSWORD && (process.env.NODE_ENV || 'development') === 'production',
    maxAttempts: num(process.env.ADMIN_MAX_ATTEMPTS, 5),
    windowMinutes: num(process.env.ADMIN_ATTEMPT_WINDOW, 15),
    lockMinutes: num(process.env.ADMIN_LOCK_MINUTES, 15),
  },

  // Rate limits (per IP, per window)
  limits: {
    loginPerHour: num(process.env.RATE_LOGIN_HOUR, 30),
    formPerHour: num(process.env.RATE_FORM_HOUR, 12),
    backupPerHour: num(process.env.RATE_BACKUP_HOUR, 10),
  },

  upload: {
    maxBytes: num(process.env.UPLOAD_MAX_BYTES, 12 * 1024 * 1024), // 12 MB
    posterWidth: 1600,
    posterHeight: 1000,
    thumbWidth: 640,
    thumbHeight: 400,
  },

  backups: {
    keep: num(process.env.BACKUP_KEEP, 25),
    maxRestoreBytes: 25 * 1024 * 1024,
  },

  analyticsId: process.env.GA_MEASUREMENT_ID || '',
  siteUrl: (process.env.SITE_URL || '').replace(/\/$/, ''),
  googleVerification: process.env.GOOGLE_SITE_VERIFICATION || '',
};

export const PUBLIC_DIR = path.join(ROOT, 'public');
export const VIEWS_DIR = path.join(ROOT, 'views');
