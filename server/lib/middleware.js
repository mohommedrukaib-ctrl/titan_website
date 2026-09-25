/**
 * Security, session, CSRF, rate-limiting and shared view locals.
 */
import crypto from 'node:crypto';
import { CONFIG } from '../config.js';
import { readDb, rateLimit, pruneSecurityState } from './store.js';
import { getSettings } from './content.js';
import * as Icons from './icons.js';
import * as Format from './helpers.js';
import { CATEGORIES, DIVISIONS, SOCIAL, EVENT_CATEGORIES } from './constants.js';

export const clientIp = (req) => {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
};

/* ------------------------------------------------------- security headers */

export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "img-src 'self' data: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
      "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com",
    ].join('; ')
  );
  next();
}

export function noCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  next();
}

/* ---------------------------------------------------------------- sessions */

export function sessionMiddleware(session) {
  return session({
    name: 'titan.sid',
    secret: CONFIG.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // upgraded per-request when the site is served over https
      maxAge: 4 * 60 * 60 * 1000,
      path: '/',
    },
  });
}

/** Behind a TLS proxy express-session should mark the cookie secure. */
export function sessionSecureFlag(req, res, next) {
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    req.session?.cookie && (req.session.cookie.secure = true);
  }
  next();
}

/* -------------------------------------------------------------------- CSRF */

export function csrfToken(req) {
  if (!req.session) return '';
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  return req.session.csrf;
}

/**
 * Verify the per-session form token.
 * `csrfProtection` runs early for the whole app; multipart (file upload)
 * bodies are not parsed at that point, so those requests are deferred and
 * verified by `csrfAfterUpload` once multer has read the fields.
 */
function checkCsrfToken(req, res, next) {
  const sent = (req.body && req.body._csrf) || req.headers['x-csrf-token'] || req.query?._csrf || '';
  const expected = req.session?.csrf || '';
  if (!expected || !sent || String(sent).length !== expected.length) {
    return res.status(403).render('pages/error', {
      title: 'Session expired',
      code: 403,
      message: 'Your session token was missing or invalid. Please reload the page and try again.',
    });
  }
  const a = Buffer.from(String(sent));
  const b = Buffer.from(String(expected));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(403).render('pages/error', {
      title: 'Request blocked',
      code: 403,
      message: 'This request could not be verified as coming from your session. Please reload and try again.',
    });
  }
  return next();
}

export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const isMultipart = String(req.headers['content-type'] || '').startsWith('multipart/form-data');
  // uploads are verified right after multer parses the fields
  if (isMultipart) return next();
  return checkCsrfToken(req, res, next);
}

/** Use after multer on multipart routes: verifies the token from the parsed body. */
export const csrfAfterUpload = checkCsrfToken;

/* ------------------------------------------------------------------- flash */

export function flash(req, type, message) {
  if (!req.session) return;
  req.session.flash = req.session.flash || [];
  req.session.flash.push({ type, message });
}

export function flashMiddleware(req, res, next) {
  if (req.session?.flash && req.session.flash.length) {
    res.locals.flash = req.session.flash;
    req.session.flash = [];
  }
  res.locals.flash = res.locals.flash || [];
  res.locals.flashOk = res.locals.flash.find((f) => f.type === 'success') || null;
  res.locals.flashError = res.locals.flash.find((f) => f.type === 'error') || null;
  res.locals.flashInfo = res.locals.flash.find((f) => f.type === 'info') || null;
  next();
}

/* --------------------------------------------------------------- limiters */

export function rateLimitMiddleware({ bucket, max, windowMs = 3600_000, message, keyFn = clientIp }) {
  return (req, res, next) => {
    const rl = rateLimit(`${bucket}:${keyFn(req)}`, max, windowMs);
    if (!rl.allowed) {
      res.status(429);
      if (req.accepts(['html', 'json']) === 'json') {
        return res.json({ ok: false, message: message || 'Too many requests. Please try again later.' });
      }
      return res.render('pages/error', {
        title: 'Too many requests',
        code: 429,
        message: message || 'You have made too many requests. Please wait a little while and try again.',
      });
    }
    res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
    return next();
  };
}

/* ----------------------------------------------------------------- locals */

export function attachLocals(req, res, next) {
  const db = readDb();
  const settings = getSettings();
  const baseUrl = (settings.siteUrl || CONFIG.siteUrl || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  res.locals.baseUrl = baseUrl;
  res.locals.site = {
    name: CONFIG.siteName,
    tagline: CONFIG.tagline,
    url: baseUrl,
    env: CONFIG.env,
  };
  res.locals.settings = settings;
  res.locals.googleVerification = CONFIG.googleVerification;
  res.locals.bingVerification = process.env.BING_SITE_VERIFICATION || '';
  res.locals.showSplash = false;
  res.locals.categories = CATEGORIES;
  res.locals.eventCategories = EVENT_CATEGORIES;
  res.locals.divisions = DIVISIONS;
  res.locals.socials = SOCIAL;
  res.locals.icon = Icons.icon;
  res.locals.fmt = Format;
  res.locals.currentPath = req.path;
  res.locals.query = req.query || {};
  res.locals.body = req.body || {};
  res.locals.year = new Date().getFullYear();
  res.locals.csrf = csrfToken(req);
  res.locals.isAdmin = Boolean(req.session?.admin);
  res.locals.adminUser = req.session?.admin || null;
  res.locals.adminCounts = {
    upcoming: db.events.filter((e) => e.type === 'upcoming').length,
    past: db.events.filter((e) => e.type === 'past').length,
    inquiries: db.inquiries.length,
    newInquiries: db.inquiries.filter((i) => i.status === 'new').length,
    announcements: db.announcements.length,
  };
  res.locals.adminUpdatedAt = db.meta?.updatedAt || new Date().toISOString();
  res.locals.pageNoIndex = false;
  res.locals.noIndex = false;
  res.locals.pageDescription = '';
  res.locals.pageTitle = '';
  res.locals.canonicalPath = req.path;
  res.locals.analyticsId = process.env.GA_MEASUREMENT_ID || req.app.locals.settings?.analyticsId || '';
  next();
}

export function notFound(req, res) {
  res.status(404).render('pages/error', {
    title: 'Page not found',
    code: 404,
    message: 'We could not find that page. It may have been moved, or the link may be out of date.',
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error('[error]', err.message, err.stack?.split('\n')[1] || '');
  }
  res.status(status);
  if (req.accepts(['html', 'json']) === 'json') {
    return res.json({ ok: false, message: err.message || 'Something went wrong.' });
  }
  return res.render('pages/error', {
    title: status === 500 ? 'Something went wrong' : 'Request problem',
    code: status,
    message:
      status === 500
        ? 'An unexpected error occurred on our side. Please try again in a moment.'
        : err.message || 'That request could not be completed.',
  });
}

/* housekeeping: prune stale lockout + rate-limit records every 10 minutes */
export function startHousekeeping() {
  const tick = () => {
    try {
      pruneSecurityState();
    } catch {
      /* ignore */
    }
  };
  tick();
  const timer = setInterval(tick, 10 * 60 * 1000);
  timer.unref?.();
}
