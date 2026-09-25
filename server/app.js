/**
 * TITAN EVENTS — application entry point.
 *
 *   npm start        production
 *   npm run dev      auto-restart on file changes
 *
 * Default admin credentials come from .env (ADMIN_USERNAME / ADMIN_PASSWORD)
 * and are created automatically on first run.
 */
import express from 'express';
import session from 'express-session';
import path from 'node:path';
import fs from 'node:fs';
import { CONFIG, PUBLIC_DIR, VIEWS_DIR } from './config.js';
import { initStore } from './lib/store.js';
import {
  securityHeaders, sessionMiddleware, sessionSecureFlag, csrfProtection, attachLocals,
  flashMiddleware, notFound, errorHandler, startHousekeeping, clientIp,
} from './lib/middleware.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const app = express();
const startedAt = new Date();

initStore();
startHousekeeping();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', VIEWS_DIR);
app.set('etag', 'strong');

app.locals.startedAt = startedAt;
app.locals.settings = null;

/* ------------------------------------------------------------ tiny layout */

app.use((req, res, next) => {
  const render = res.render.bind(res);
  res.render = (view, options = {}, callback) => {
    const opts = { ...options };
    const layout = opts.layout === false ? null : opts.layout || 'public';
    delete opts.layout;
    render(view, opts, (err, html) => {
      if (err) return callback ? callback(err) : next(err);
      if (!layout) return callback ? callback(null, html) : res.send(html);
      return render(`layouts/${layout}`, { ...opts, body: html }, (err2, full) => {
        if (err2) return callback ? callback(err2) : next(err2);
        if (callback) return callback(null, full);
        return res.send(full);
      });
    });
  };
  next();
});

/* ----------------------------------------------------- core express stack */

app.use(securityHeaders);
app.use(
  express.static(PUBLIC_DIR, {
    index: false,
    maxAge: CONFIG.env === 'production' ? '30d' : '1h',
    setHeaders(res, filePath) {
      if (/\/uploads\//.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      if (/\.(png|jpg|jpeg|webp|svg|ico)$/i.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800');
    },
  })
);
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(sessionMiddleware(session));
app.use(sessionSecureFlag);
app.use(attachLocals);
app.use(flashMiddleware);
app.use(csrfProtection);

/* ---------------------------------------------------------------- routes */

app.use('/', publicRoutes);
app.use('/admin', adminRoutes);

app.use(notFound);
app.use(errorHandler);

/* ------------------------------------------------------------------ boot */

function ensureUploadDir() {
  fs.mkdirSync(CONFIG.uploadDir, { recursive: true });
}

ensureUploadDir();

const server = app.listen(CONFIG.port, CONFIG.host, () => {
  const addr = server.address();
  console.log(`\n  TITAN EVENTS  ·  ${CONFIG.tagline}`);
  console.log(`  ──────────────────────────────────────────────`);
  console.log(`  Website    http://localhost:${addr.port}/`);
  console.log(`  Admin      http://localhost:${addr.port}/admin`);
  console.log(`  Data       ${path.relative(CONFIG.root, CONFIG.dataDir)}/titan.json`);
  console.log(`  Env        ${CONFIG.env}${CONFIG.sessionSecret.length < 40 ? '  (set SESSION_SECRET in .env for production)' : ''}`);
  console.log(`  Started    ${startedAt.toISOString()}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${CONFIG.port} is already in use. Start with a different port:\n    PORT=3001 npm start\n`);
  } else {
    console.error('[server error]', err);
  }
  process.exit(1);
});

const shutdown = (signal) => {
  console.log(`\n  ${signal} received — shutting down.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
