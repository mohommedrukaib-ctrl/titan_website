/**
 * Admin control panel — private area under /admin.
 * Login + lockout, dashboard, event CRUD, announcements, inquiries,
 * backup/restore, activity log and credential management.
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from '../config.js';
import {
  readDb, verifyAdmin, updateAdmin, loginLock, recordLoginFailure, clearLoginFailures,
  logActivity, listBackups, readBackupFile, createBackup, exportSnapshot, restoreSnapshot, backupDir,
} from '../lib/store.js';
import {
  getEvents, getEvent, saveEvent, deleteEvent, getAnnouncements, addAnnouncement, deleteAnnouncement,
  getInquiries, setInquiryStatus, deleteInquiry, getSettings, updateSettings, eventCounts, inquiryCounts,
} from '../lib/content.js';
import { upload, uploadBackup, processPoster, uploadLimits } from '../lib/uploads.js';
import { flash, clientIp, noCache, rateLimitMiddleware, csrfAfterUpload } from '../lib/middleware.js';
import { clean, isEmail, todayISO, parseDate, humanFileSize } from '../lib/helpers.js';
import { CATEGORIES, EVENT_CATEGORIES, STAT_SEED } from '../lib/constants.js';

const router = express.Router();

/* ------------------------------------------------------------------ utils */

const safeReferer = (req, fallback = '/admin') => {
  const ref = req.get('Referer') || '';
  try {
    const url = new URL(ref, `${req.protocol}://${req.get('host')}`);
    if (url.host === req.get('host')) return url.pathname;
  } catch {
    /* ignore */
  }
  return fallback;
};

const requireAuth = (req, res, next) => {
  if (req.session?.admin) return next();
  flash(req, 'info', 'Please sign in to open the control panel.');
  const target = req.method === 'GET' ? `?next=${encodeURIComponent(req.originalUrl)}` : '';
  return res.redirect(`/admin/login${target}`);
};

function posterUpload(req, res, next) {
  upload.single('poster')(req, res, (err) => {
    if (!err) return next();
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? `That image is larger than the ${uploadLimits.label} limit. Please compress it and try again.`
        : err.message || 'The image could not be uploaded.';
    flash(req, 'error', message);
    return res.redirect(safeReferer(req));
  });
}

function readEventForm(req) {
  const body = req.body || {};
  const values = {
    name: clean(body.name, 160),
    date: clean(body.date, 10),
    time: clean(body.time, 5),
    endDate: clean(body.endDate, 10),
    venue: clean(body.venue, 200),
    category: clean(body.category, 30).toLowerCase(),
    type: clean(body.type, 10).toLowerCase() === 'past' ? 'past' : 'upcoming',
    ticketLink: clean(body.ticketLink, 500),
    description: clean(body.description, 4000),
    removePoster: body.removePoster === '1',
  };
  const errors = {};
  if (values.name.length < 3) errors.name = 'Give the event a name (at least 3 characters).';
  if (!parseDate(values.date)) errors.date = 'Choose a valid event date.';
  if (values.venue.length < 2) errors.venue = 'Where is the event taking place?';
  if (!EVENT_CATEGORIES.some((c) => c.key === values.category)) errors.category = 'Choose a category.';
  if (values.ticketLink && !/^https?:\/\/.+/i.test(values.ticketLink)) {
    errors.ticketLink = 'Ticket links must start with http:// or https://';
  }
  if (values.description.length < 10) errors.description = 'Add a short description (10 characters minimum).';
  return { values, errors };
}

const renderAdmin = (res, view, data = {}) =>
  res.render(`admin/${view}`, { layout: 'admin', pageTitle: '', ...data });

/* ------------------------------------------------------------------ login */

router.use(noCache);

router.get('/login', (req, res) => {
  if (req.session?.admin) return res.redirect('/admin');
  return renderAdmin(res, 'login', {
    pageTitle: 'Admin Login',
    noIndex: true,
    lock: loginLock(clientIp(req)),
    next: typeof req.query.next === 'string' ? req.query.next : '',
    values: { username: '' },
  });
});

router.post(
  '/login',
  rateLimitMiddleware({
    bucket: 'login',
    max: CONFIG.limits.loginPerHour,
    windowMs: 3600_000,
    message: 'Too many sign-in attempts from this connection. Please try again later.',
  }),
  (req, res) => {
    const ip = clientIp(req);
    const lock = loginLock(ip);
    const username = clean(req.body.username, 60);
    const password = String(req.body.password || '');
    const nextUrl = typeof req.body.next === 'string' && req.body.next.startsWith('/') ? req.body.next : '/admin';

    if (lock.locked) {
      logActivity({ action: 'login.blocked', detail: `Locked out (${lock.minutes} min)`, ip });
      flash(req, 'error', `Too many failed attempts. Sign-in is locked for ${lock.minutes} more minute(s).`);
      return renderAdmin(res, 'login', { pageTitle: 'Admin Login', noIndex: true, lock: loginLock(ip), next: req.body.next || '', values: { username } });
    }

    if (!username || !password) {
      flash(req, 'error', 'Enter both your username and password.');
      return renderAdmin(res, 'login', { pageTitle: 'Admin Login', noIndex: true, lock, next: req.body.next || '', values: { username } });
    }

    if (!verifyAdmin(username, password)) {
      const result = recordLoginFailure(ip);
      logActivity({ action: 'login.failed', detail: `Bad credentials for "${username}"`, ip });
      flash(
        req,
        'error',
        result.locked
          ? `Too many failed attempts. Sign-in is locked for ${result.minutes} minute(s).`
          : `Incorrect username or password. ${result.remaining} attempt(s) remaining before this connection is locked.`
      );
      return renderAdmin(res, 'login', {
        pageTitle: 'Admin Login',
        noIndex: true,
        lock: loginLock(ip),
        next: req.body.next || '',
        values: { username },
      });
    }

    clearLoginFailures(ip);
    const returnTo = nextUrl;
    // prevent session fixation
    req.session.regenerate((err) => {
      if (err) {
        flash(req, 'error', 'Could not start a secure session. Please try again.');
        return res.redirect('/admin/login');
      }
      req.session.admin = { username, ip, since: new Date().toISOString() };
      req.session.csrf = undefined;
      logActivity({ action: 'login.success', detail: `Signed in as ${username}`, ip });
      flash(req, 'success', `Welcome back, ${username}.`);
      return res.redirect(returnTo);
    });
  }
);

router.post('/logout', (req, res) => {
  const ip = clientIp(req);
  logActivity({ action: 'logout', detail: 'Signed out', ip });
  req.session.destroy(() => {
    res.clearCookie('titan.sid');
    res.redirect('/admin/login');
  });
});

/* --------------------------------------------------------------- dashboard */

router.get('/', requireAuth, (req, res) => {
  const db = readDb();
  renderAdmin(res, 'dashboard', {
    pageTitle: 'Dashboard',
    noIndex: true,
    stats: {
      upcoming: eventCounts().upcoming,
      past: eventCounts().past,
      inquiries: inquiryCounts().total,
      newInquiries: inquiryCounts().unread,
      announcements: db.announcements.length,
      events: eventCounts().total,
    },
    upcoming: getEvents({ type: 'upcoming', sort: 'date-asc' }),
    past: getEvents({ type: 'past', sort: 'date-desc' }),
    announcements: getAnnouncements(8),
    inquiries: getInquiries().slice(0, 4),
    activity: db.activity.slice(-8).reverse(),
    lastUpdated: db.meta.updatedAt,
    eventCategories: EVENT_CATEGORIES,
    today: todayISO(),
    uploadLimits,
    active: 'dashboard',
  });
});

/* ----------------------------------------------------------------- events */

router.get('/events/new', requireAuth, (req, res) => {
  renderAdmin(res, 'event-form', {
    pageTitle: 'Add Event',
    noIndex: true,
    mode: 'create',
    event: null,
    values: {
      name: '', date: todayISO(), time: '18:30', venue: '', category: 'wedding',
      type: 'upcoming', ticketLink: '', description: '',
    },
    errors: {},
    eventCategories: EVENT_CATEGORIES,
    uploadLimits,
    active: 'add-event',
  });
});

router.post('/events', requireAuth, posterUpload, csrfAfterUpload, async (req, res) => {
  const { values, errors } = readEventForm(req);
  let poster = '';
  let uploadNote = '';

  if (req.file) {
    const result = await processPoster(req.file);
    if (!result.ok) errors.poster = result.message;
    else {
      poster = result.path;
      uploadNote = ` Image optimised to ${result.width}×${result.height}px (${result.savedPercent}% smaller).`;
    }
  }

  if (Object.keys(errors).length) {
    flash(req, 'error', 'Please fix the highlighted fields.');
    return renderAdmin(res, 'event-form', {
      pageTitle: 'Add Event', noIndex: true, mode: 'create', event: null,
      values, errors, eventCategories: EVENT_CATEGORIES, uploadLimits, active: 'add-event',
    });
  }

  saveEvent({ ...values, poster }, null);
  logActivity({ action: 'event.create', detail: `Created "${values.name}"`, ip: clientIp(req) });
  flash(req, 'success', `"${values.name}" was published to the website.${uploadNote}`);
  return res.redirect('/admin');
});

router.get('/events/:id/edit', requireAuth, (req, res, next) => {
  const event = getEvent(req.params.id);
  if (!event) return next();
  return renderAdmin(res, 'event-form', {
    pageTitle: `Edit — ${event.name}`,
    noIndex: true,
    mode: 'edit',
    event,
    values: {
      name: event.name, date: event.date, time: event.time, venue: event.venue,
      category: event.category, type: event.type, ticketLink: event.ticketLink,
      description: event.description, removePoster: false,
    },
    errors: {},
    eventCategories: EVENT_CATEGORIES,
    uploadLimits,
    active: 'dashboard',
  });
});

router.post('/events/:id', requireAuth, posterUpload, csrfAfterUpload, async (req, res, next) => {
  const existing = getEvent(req.params.id);
  if (!existing) return next();
  const { values, errors } = readEventForm(req);
  let poster = values.removePoster ? '' : existing.poster;
  let uploadNote = '';

  if (req.file) {
    const result = await processPoster(req.file);
    if (!result.ok) errors.poster = result.message;
    else {
      poster = result.path;
      uploadNote = ` New poster optimised to ${result.width}×${result.height}px.`;
    }
  }

  if (Object.keys(errors).length) {
    flash(req, 'error', 'Please fix the highlighted fields.');
    return renderAdmin(res, 'event-form', {
      pageTitle: `Edit — ${existing.name}`, noIndex: true, mode: 'edit', event: existing,
      values, errors, eventCategories: EVENT_CATEGORIES, uploadLimits, active: 'dashboard',
    });
  }

  saveEvent({ ...values, poster }, existing.id);
  logActivity({ action: 'event.update', detail: `Updated "${values.name}"`, ip: clientIp(req) });
  flash(req, 'success', `"${values.name}" was updated.${uploadNote}`);
  return res.redirect('/admin');
});

router.post('/events/:id/delete', requireAuth, (req, res) => {
  const existing = getEvent(req.params.id);
  if (!existing) {
    flash(req, 'error', 'That event no longer exists.');
    return res.redirect(safeReferer(req));
  }
  deleteEvent(existing.id);
  logActivity({ action: 'event.delete', detail: `Deleted "${existing.name}"`, ip: clientIp(req) });
  flash(req, 'success', `"${existing.name}" was deleted. A backup of the previous data was saved.`);
  return res.redirect(safeReferer(req));
});

router.post('/events/:id/toggle-type', requireAuth, (req, res) => {
  const existing = getEvent(req.params.id);
  if (!existing) {
    flash(req, 'error', 'That event no longer exists.');
    return res.redirect(safeReferer(req));
  }
  const type = existing.type === 'upcoming' ? 'past' : 'upcoming';
  saveEvent({ ...existing, type }, existing.id);
  logActivity({ action: 'event.move', detail: `Moved "${existing.name}" to ${type}`, ip: clientIp(req) });
  flash(req, 'success', `"${existing.name}" moved to ${type} events.`);
  return res.redirect(safeReferer(req));
});

/* ---------------------------------------------------------- announcements */

router.post('/announcements', requireAuth, (req, res) => {
  const title = clean(req.body.title, 200);
  const content = clean(req.body.content, 4000);
  const errors = {};
  if (title.length < 4) errors.title = 'Give the announcement a title (4 characters minimum).';
  if (content.length < 10) errors.content = 'Add the announcement content (10 characters minimum).';

  if (Object.keys(errors).length) {
    flash(req, 'error', Object.values(errors)[0]);
    return res.redirect('/admin#announcements');
  }
  addAnnouncement({ title, content });
  logActivity({ action: 'announcement.create', detail: `Posted "${title}"`, ip: clientIp(req) });
  flash(req, 'success', `Announcement "${title}" is now live on the homepage.`);
  return res.redirect('/admin#announcements');
});

router.post('/announcements/:id/delete', requireAuth, (req, res) => {
  const found = getAnnouncements().find((a) => a.id === req.params.id);
  deleteAnnouncement(req.params.id);
  logActivity({ action: 'announcement.delete', detail: `Deleted "${found?.title || req.params.id}"`, ip: clientIp(req) });
  flash(req, 'success', 'Announcement deleted.');
  return res.redirect(safeReferer(req, '/admin#announcements'));
});

/* ------------------------------------------------------------- inquiries */

router.get('/inquiries', requireAuth, (req, res) => {
  const status = ['all', 'new', 'read', 'archived', 'spam'].includes(String(req.query.status))
    ? String(req.query.status)
    : 'all';
  renderAdmin(res, 'inquiries', {
    pageTitle: 'Inquiries',
    noIndex: true,
    inquiries: getInquiries({ status }),
    counts: inquiryCounts(),
    status,
    active: 'inquiries',
  });
});

router.post('/inquiries/:id/status', requireAuth, (req, res) => {
  const status = ['new', 'read', 'archived', 'spam'].includes(String(req.body.status)) ? String(req.body.status) : 'read';
  setInquiryStatus(req.params.id, status);
  logActivity({ action: `inquiry.${status}`, detail: `Inquiry ${req.params.id} marked ${status}`, ip: clientIp(req) });
  flash(req, 'success', `Inquiry marked as ${status}.`);
  return res.redirect(safeReferer(req, '/admin/inquiries'));
});

router.post('/inquiries/:id/delete', requireAuth, (req, res) => {
  deleteInquiry(req.params.id);
  logActivity({ action: 'inquiry.delete', detail: `Deleted inquiry ${req.params.id}`, ip: clientIp(req) });
  flash(req, 'success', 'Inquiry deleted.');
  return res.redirect(safeReferer(req, '/admin/inquiries'));
});

router.post('/inquiries/mark-all-read', requireAuth, (req, res) => {
  const newOnes = getInquiries({ status: 'new' });
  newOnes.forEach((i) => setInquiryStatus(i.id, 'read'));
  if (newOnes.length) logActivity({ action: 'inquiry.read-all', detail: `${newOnes.length} inquiries marked read`, ip: clientIp(req) });
  flash(req, 'success', newOnes.length ? `${newOnes.length} inquiry(ies) marked as read.` : 'Nothing new to mark.');
  return res.redirect('/admin/inquiries');
});

/* --------------------------------------------------------- settings/stat */

router.get('/settings', requireAuth, (req, res) => {
  renderAdmin(res, 'settings', {
    pageTitle: 'Website Settings',
    noIndex: true,
    settings: getSettings(),
    statSeed: STAT_SEED,
    active: 'settings',
  });
});

router.post('/settings', requireAuth, (req, res) => {
  const b = req.body || {};
  const patch = {
    phonePrimary: clean(b.phonePrimary, 40),
    phoneSecondary: clean(b.phoneSecondary, 40),
    whatsapp: clean(b.whatsapp, 40),
    email: clean(b.email, 160),
    address: clean(b.address, 300),
    hours: clean(b.hours, 160),
    responseTime: clean(b.responseTime, 120),
    siteUrl: clean(b.siteUrl, 200).replace(/\/$/, ''),
    analyticsId: clean(b.analyticsId, 40),
  };
  if (patch.email && !isEmail(patch.email)) {
    flash(req, 'error', 'That contact email address does not look valid.');
    return res.redirect('/admin/settings');
  }
  if (patch.siteUrl && !/^https?:\/\//i.test(patch.siteUrl)) patch.siteUrl = `https://${patch.siteUrl}`;

  const stats = (getSettings().stats || STAT_SEED).map((stat) => ({
    ...stat,
    value: Number.isFinite(Number(b[`stat_${stat.key}`])) ? Math.max(0, Number(b[`stat_${stat.key}`])) : stat.value,
  }));
  updateSettings({ ...patch, stats });
  logActivity({ action: 'settings.update', detail: 'Contact details / stats updated', ip: clientIp(req) });
  flash(req, 'success', 'Website settings saved.');
  return res.redirect('/admin/settings');
});

/* ----------------------------------------------------------------- backup */

router.get('/backup', requireAuth, (req, res) => {
  const db = readDb();
  renderAdmin(res, 'backup', {
    pageTitle: 'Backup & Restore',
    noIndex: true,
    backups: listBackups(),
    counts: {
      events: db.events.length,
      announcements: db.announcements.length,
      inquiries: db.inquiries.length,
      hasAdmin: Boolean(db.admin?.passwordHash),
    },
    lastUpdated: db.meta.updatedAt,
    keep: CONFIG.backups.keep,
    active: 'backup',
    humanFileSize,
  });
});

router.get('/backup/download', requireAuth, (req, res) => {
  const snapshot = exportSnapshot();
  logActivity({ action: 'backup.download', detail: 'Downloaded full data backup', ip: clientIp(req) });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="titan-events-backup-${stamp}.json"`);
  res.send(JSON.stringify(snapshot, null, 2));
});

router.post('/backup/create', requireAuth, (req, res) => {
  const file = createBackup(`manual-${req.session.admin.username}`);
  logActivity({ action: 'backup.create', detail: `Snapshot ${path.basename(file)} created`, ip: clientIp(req) });
  flash(req, 'success', `Snapshot saved to the server (${path.basename(file)}).`);
  return res.redirect('/admin/backup');
});

router.get('/backup/:file/download', requireAuth, (req, res) => {
  let payload;
  try {
    payload = readBackupFile(req.params.file);
  } catch {
    flash(req, 'error', 'That backup file could not be read.');
    return res.redirect('/admin/backup');
  }
  logActivity({ action: 'backup.download', detail: `Downloaded ${req.params.file}`, ip: clientIp(req) });
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.file}"`);
  return res.send(JSON.stringify(payload, null, 2));
});

router.post('/backup/:file/restore', requireAuth, (req, res) => {
  try {
    const payload = readBackupFile(req.params.file);
    restoreSnapshot(payload, { reason: req.params.file, actor: req.session.admin.username });
    flash(req, 'success', 'Data restored from the selected snapshot. A safety copy of the previous state was saved first.');
  } catch (err) {
    flash(req, 'error', `Restore failed: ${err.message}`);
  }
  return res.redirect('/admin/backup');
});

router.post('/backup/:file/delete', requireAuth, (req, res) => {
  const file = path.join(backupDir, path.basename(req.params.file));
  try {
    if (file.startsWith(backupDir) && fs.existsSync(file)) fs.unlinkSync(file);
    logActivity({ action: 'backup.delete', detail: `Deleted ${req.params.file}`, ip: clientIp(req) });
    flash(req, 'success', 'Backup file deleted.');
  } catch {
    flash(req, 'error', 'That backup file could not be deleted.');
  }
  return res.redirect('/admin/backup');
});

router.post(
  '/backup/restore',
  requireAuth,
  rateLimitMiddleware({ bucket: 'restore', max: CONFIG.limits.backupPerHour, message: 'Too many restore attempts. Please wait before trying again.' }),
  uploadBackup.single('backup'),
  csrfAfterUpload,
  (req, res) => {
    try {
      if (!req.file?.buffer?.length) throw new Error('Choose a backup .json file to upload.');
      if (req.file.size > CONFIG.backups.maxRestoreBytes) throw new Error('That file is too large to be a Titan backup.');
      const parsed = JSON.parse(req.file.buffer.toString('utf8'));
      restoreSnapshot(parsed, { reason: 'uploaded-file', actor: req.session.admin.username });
      flash(req, 'success', 'Backup restored successfully. Events, announcements and inquiries were replaced.');
    } catch (err) {
      flash(req, 'error', `Restore failed: ${err.message.startsWith('Unexpected') ? 'that file is not valid JSON.' : err.message}`);
    }
    return res.redirect('/admin/backup');
  }
);

/* --------------------------------------------------------- activity/security */

router.get('/activity', requireAuth, (req, res) => {
  const db = readDb();
  renderAdmin(res, 'activity', {
    pageTitle: 'Activity Log',
    noIndex: true,
    activity: [...db.activity].reverse().slice(0, 200),
    active: 'activity',
  });
});

router.get('/security', requireAuth, (req, res) => {
  renderAdmin(res, 'security', {
    pageTitle: 'Security',
    noIndex: true,
    adminUser: req.session.admin.username,
    maxAttempts: CONFIG.admin.maxAttempts,
    windowMinutes: CONFIG.admin.windowMinutes,
    lockMinutes: CONFIG.admin.lockMinutes,
    loginLimit: CONFIG.limits.loginPerHour,
    formLimit: CONFIG.limits.formPerHour,
    active: 'security',
  });
});

router.post('/security', requireAuth, (req, res) => {
  const current = String(req.body.currentPassword || '');
  const username = clean(req.body.username, 40) || req.session.admin.username;
  const password = String(req.body.newPassword || '');
  const confirm = String(req.body.confirmPassword || '');

  if (!verifyAdmin(req.session.admin.username, current)) {
    logActivity({ action: 'security.denied', detail: 'Wrong current password on credential change', ip: clientIp(req) });
    flash(req, 'error', 'Your current password is incorrect.');
    return res.redirect('/admin/security');
  }
  if (!/^[A-Za-z0-9._-]{3,40}$/.test(username)) {
    flash(req, 'error', 'Usernames may only use letters, numbers, dots, dashes and underscores (3–40 characters).');
    return res.redirect('/admin/security');
  }
  if (password && password.length < 8) {
    flash(req, 'error', 'Choose a password with at least 8 characters.');
    return res.redirect('/admin/security');
  }
  if (password !== confirm) {
    flash(req, 'error', 'The new passwords do not match.');
    return res.redirect('/admin/security');
  }

  updateAdmin({ username, password: password || null });
  logActivity({ action: 'security.update', detail: password ? `Credentials updated for ${username}` : `Username changed to ${username}`, ip: clientIp(req) });
  req.session.admin.username = username;
  flash(req, 'success', password ? 'Credentials updated. Use the new password next time you sign in.' : 'Username updated.');
  return res.redirect('/admin/security');
});

export default router;
