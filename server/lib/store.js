/**
 * JSON database + backup + activity-log layer.
 *
 * - Single JSON document at data/titan.json (atomic writes via tmp+rename)
 * - Automatic timestamped backup before every change, pruned to CONFIG.backups.keep
 * - Append-only activity log (JSON lines) of every admin action
 * - Login lockout + generic rate-limit state in data/security.json
 *
 * The file sizes here are tiny (a few hundred KB at most), so synchronous
 * reads/writes keep the code simple and race-free via the mutate() queue.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { CONFIG } from '../config.js';
import { seedData } from './seed.js';
import { slugify } from './helpers.js';

const DB_FILE = path.join(CONFIG.dataDir, 'titan.json');
const SECURITY_FILE = path.join(CONFIG.dataDir, 'security.json');
const BACKUP_DIR = path.join(CONFIG.dataDir, 'backups');
const ACTIVITY_FILE = path.join(CONFIG.dataDir, 'activity.jsonl');

let cache = null;
let cacheStamp = 0;
let queue = Promise.resolve();

/* ------------------------------------------------------------------ setup */

function ensureDirs() {
  for (const dir of [CONFIG.dataDir, BACKUP_DIR, CONFIG.uploadDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeJsonAtomic(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tmp, file);
}

function defaultSecurity() {
  return { attempts: {}, rate: {}, updatedAt: new Date().toISOString() };
}

function readSecurity() {
  try {
    return { ...defaultSecurity(), ...JSON.parse(fs.readFileSync(SECURITY_FILE, 'utf8')) };
  } catch {
    return defaultSecurity();
  }
}

function writeSecurity(state) {
  state.updatedAt = new Date().toISOString();
  writeJsonAtomic(SECURITY_FILE, state);
}

/** Normalise a database document coming from disk, a backup or a restore. */
export function normaliseDb(input) {
  const base = seedData();
  const db = input && typeof input === 'object' ? input : {};
  const out = {
    version: 1,
    meta: { ...base.meta, ...(db.meta || {}) },
    settings: { ...base.settings, ...(db.settings || {}) },
    admin: db.admin && typeof db.admin === 'object' ? db.admin : null,
    events: Array.isArray(db.events) ? db.events : base.events,
    announcements: Array.isArray(db.announcements) ? db.announcements : base.announcements,
    inquiries: Array.isArray(db.inquiries) ? db.inquiries : base.inquiries,
    activity: Array.isArray(db.activity) ? db.activity.slice(-400) : base.activity,
  };

  const seen = new Set();
  out.events = out.events
    .filter((e) => e && typeof e === 'object')
    .map((e) => {
      let id = String(e.id || `evt_${crypto.randomBytes(4).toString('hex')}`);
      while (seen.has(id)) id = `evt_${crypto.randomBytes(4).toString('hex')}`;
      seen.add(id);
      return {
        id,
        slug: slugify(e.slug || e.name || id) || id,
        name: String(e.name || 'Untitled event').slice(0, 160),
        date: String(e.date || '').slice(0, 10),
        time: String(e.time || '').slice(0, 5),
        endDate: String(e.endDate || '').slice(0, 10),
        venue: String(e.venue || '').slice(0, 200),
        category: String(e.category || 'other').toLowerCase(),
        type: e.type === 'past' ? 'past' : 'upcoming',
        poster: typeof e.poster === 'string' ? e.poster : '',
        ticketLink: typeof e.ticketLink === 'string' ? e.ticketLink.slice(0, 500) : '',
        description: String(e.description || '').slice(0, 4000),
        createdAt: e.createdAt || new Date().toISOString(),
        updatedAt: e.updatedAt || e.createdAt || new Date().toISOString(),
      };
    });

  out.announcements = out.announcements
    .filter((a) => a && typeof a === 'object')
    .map((a) => ({
      id: String(a.id || `ann_${crypto.randomBytes(4).toString('hex')}`),
      title: String(a.title || 'Untitled announcement').slice(0, 200),
      content: String(a.content || '').slice(0, 4000),
      createdAt: a.createdAt || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  out.inquiries = out.inquiries
    .filter((i) => i && typeof i === 'object')
    .map((i) => ({
      id: String(i.id || `inq_${crypto.randomBytes(4).toString('hex')}`),
      name: String(i.name || 'Unknown').slice(0, 120),
      email: String(i.email || '').slice(0, 160),
      phone: String(i.phone || '').slice(0, 40),
      eventType: String(i.eventType || 'other').toLowerCase(),
      eventDate: String(i.eventDate || '').slice(0, 10),
      message: String(i.message || '').slice(0, 4000),
      status: ['new', 'read', 'archived', 'spam'].includes(i.status) ? i.status : 'new',
      ip: String(i.ip || '').slice(0, 60),
      createdAt: i.createdAt || new Date().toISOString(),
    }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return out;
}

/* ------------------------------------------------------------------- core */

export function initStore() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    const seeded = normaliseDb(seedData());
    seeded.admin = {
      username: CONFIG.admin.username,
      passwordHash: bcrypt.hashSync(CONFIG.admin.password, 12),
      updatedAt: new Date().toISOString(),
    };
    writeJsonAtomic(DB_FILE, seeded);
    // eslint-disable-next-line no-console
    console.log(
      `\n  ↳ First run: admin account created\n` +
      `    username: ${CONFIG.admin.username}\n` +
      `    password: ${CONFIG.admin.password}\n` +
      (CONFIG.admin.passwordIsGenerated
        ? '    ⚠ this generated password is shown once — copy it now, then change it in Admin → Security\n'
        : '    (change it from the admin panel → Security)\n')
    );
    createBackup('initial-install', seeded);
  }
  if (!fs.existsSync(SECURITY_FILE)) writeSecurity(defaultSecurity());
  const db = readDb(true);
  if (!db.admin || !db.admin.passwordHash) {
    mutate((d) => {
      d.admin = {
        username: CONFIG.admin.username,
        passwordHash: bcrypt.hashSync(CONFIG.admin.password, 12),
        updatedAt: new Date().toISOString(),
      };
      return d;
    }, { reason: 'admin-bootstrap', silent: true });
  }
  return readDb(true);
}

export function readDb(force = false) {
  try {
    const stat = fs.statSync(DB_FILE);
    if (!force && cache && stat.mtimeMs === cacheStamp) return cache;
    cache = normaliseDb(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
    cacheStamp = stat.mtimeMs;
    return cache;
  } catch {
    if (cache) return cache;
    cache = normaliseDb(seedData());
    return cache;
  }
}

/** Serialised read-modify-write. Always writes a backup first. */
export function mutate(fn, { reason = 'update', backup = true, silent = false } = {}) {
  const run = () => {
    const db = readDb(true);
    const next = fn(db) || db;
    next.meta = { ...(next.meta || {}), updatedAt: new Date().toISOString() };
    if (backup) createBackup(reason, db);
    writeJsonAtomic(DB_FILE, next);
    cache = normaliseDb(next);
    cacheStamp = fs.statSync(DB_FILE).mtimeMs;
    if (!silent) logActivity({ action: reason, detail: '' });
    return cache;
  };
  const result = queue.then(run, run);
  queue = result.catch(() => {});
  return result;
}

/* ---------------------------------------------------------------- backups */

export const backupDir = BACKUP_DIR;

function backupName(reason = 'backup') {
  const d = new Date();
  const stamp = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('') + '-' + [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join('');
  const safeReason = slugify(reason) || 'backup';
  return `titan-${stamp}-${safeReason}-${crypto.randomBytes(2).toString('hex')}.json`;
}

export function createBackup(reason = 'backup', data = null) {
  ensureDirs();
  const payload = {
    _titanBackup: true,
    createdAt: new Date().toISOString(),
    reason,
    data: data || readDb(true),
  };
  const file = path.join(BACKUP_DIR, backupName(reason));
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  pruneBackups();
  return file;
}

export function pruneBackups(keep = CONFIG.backups.keep) {
  try {
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => ({ f, t: fs.statSync(path.join(BACKUP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { f } of files.slice(keep)) fs.unlinkSync(path.join(BACKUP_DIR, f));
  } catch {
    /* ignore */
  }
}

export function listBackups() {
  try {
    return fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const full = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(full);
        let reason = '';
        let createdAt = stat.mtime.toISOString();
        try {
          const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
          reason = parsed.reason || '';
          createdAt = parsed.createdAt || createdAt;
        } catch {
          /* ignore */
        }
        return { file: f, bytes: stat.size, reason, createdAt };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch {
    return [];
  }
}

export function readBackupFile(file) {
  if (!/^[A-Za-z0-9._-]+\.json$/.test(file)) throw new Error('Invalid backup name');
  const full = path.join(BACKUP_DIR, file);
  if (!full.startsWith(BACKUP_DIR)) throw new Error('Invalid backup path');
  const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
  return parsed.data ? parsed : { createdAt: new Date().toISOString(), reason: 'file', data: parsed };
}

export function exportSnapshot() {
  return {
    _titanBackup: true,
    site: 'TITAN EVENTS',
    createdAt: new Date().toISOString(),
    reason: 'manual-download',
    data: readDb(true),
  };
}

export function restoreSnapshot(snapshot, { reason = 'restore', actor = 'admin' } = {}) {
  const payload = snapshot && snapshot.data ? snapshot.data : snapshot;
  if (!payload || typeof payload !== 'object') throw new Error('Backup file is not valid JSON data');
  const hasContent = ['events', 'announcements', 'inquiries', 'settings'].some((k) => k in payload);
  if (!hasContent) throw new Error('Backup file does not contain Titan Events data');

  const current = readDb(true);
  createBackup(`${reason}-pre`, current);

  const restored = normaliseDb(payload);
  // never lose the live admin credentials unless the backup carries them
  restored.admin = current.admin;
  writeJsonAtomic(DB_FILE, restored);
  cache = normaliseDb(restored);
  cacheStamp = fs.statSync(DB_FILE).mtimeMs;
  logActivity({ action: 'backup.restore', detail: `Restored ${restored.events.length} events from ${reason}`, actor });
  return cache;
}

/* --------------------------------------------------------------- activity */

export function logActivity({ action, detail = '', ip = '', actor = 'admin' }) {
  const entry = { at: new Date().toISOString(), action, detail, ip, actor };
  try {
    ensureDirs();
    fs.appendFileSync(ACTIVITY_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
    const stat = fs.statSync(ACTIVITY_FILE);
    if (stat.size > 1024 * 1024) {
      const lines = fs.readFileSync(ACTIVITY_FILE, 'utf8').trim().split('\n');
      fs.writeFileSync(ACTIVITY_FILE, `${lines.slice(-1500).join('\n')}\n`, 'utf8');
    }
  } catch {
    /* ignore */
  }
  return entry;
}

export function readActivity(limit = 120) {
  try {
    if (!fs.existsSync(ACTIVITY_FILE)) return [];
    const lines = fs.readFileSync(ACTIVITY_FILE, 'utf8').trim().split('\n');
    return lines
      .slice(-limit)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  } catch {
    return [];
  }
}

/* --------------------------------------------------------------- security */

export function loginLock(ip) {
  const state = readSecurity();
  const rec = state.attempts[ip];
  if (!rec) return { locked: false, remaining: CONFIG.admin.maxAttempts, attempts: 0 };
  const blockedUntil = rec.blockedUntil ? new Date(rec.blockedUntil).getTime() : 0;
  if (blockedUntil > Date.now()) {
    return {
      locked: true,
      until: new Date(blockedUntil),
      minutes: Math.max(1, Math.ceil((blockedUntil - Date.now()) / 60000)),
      attempts: rec.count,
      remaining: 0,
    };
  }
  const windowMs = CONFIG.admin.windowMinutes * 60 * 1000;
  const fresh = Date.now() - new Date(rec.firstAt || 0).getTime() < windowMs;
  if (!fresh) return { locked: false, remaining: CONFIG.admin.maxAttempts, attempts: 0 };
  return { locked: false, attempts: rec.count, remaining: Math.max(0, CONFIG.admin.maxAttempts - rec.count) };
}

export function recordLoginFailure(ip) {
  const state = readSecurity();
  const now = Date.now();
  const windowMs = CONFIG.admin.windowMinutes * 60 * 1000;
  const rec = state.attempts[ip];
  const fresh = rec && now - new Date(rec.firstAt || 0).getTime() < windowMs;
  const count = fresh ? rec.count + 1 : 1;
  const entry = {
    count,
    firstAt: fresh ? rec.firstAt : new Date(now).toISOString(),
    lastAt: new Date(now).toISOString(),
    blockedUntil:
      count >= CONFIG.admin.maxAttempts
        ? new Date(now + CONFIG.admin.lockMinutes * 60 * 1000).toISOString()
        : null,
  };
  state.attempts[ip] = entry;
  writeSecurity(state);
  const locked = Boolean(entry.blockedUntil);
  return {
    attempts: count,
    remaining: Math.max(0, CONFIG.admin.maxAttempts - count),
    locked,
    minutes: locked ? CONFIG.admin.lockMinutes : 0,
  };
}

export function clearLoginFailures(ip) {
  const state = readSecurity();
  if (state.attempts[ip]) {
    delete state.attempts[ip];
    writeSecurity(state);
  }
}

/** Simple fixed-window limiter, shared by forms / login / backup endpoints. */
export function rateLimit(key, max, windowMs = 3600_000) {
  const state = readSecurity();
  const now = Date.now();
  const rec = state.rate[key];
  if (!rec || now > new Date(rec.resetAt).getTime()) {
    state.rate[key] = { count: 1, resetAt: new Date(now + windowMs).toISOString() };
    writeSecurity(state);
    return { allowed: true, remaining: max - 1, retryAfter: 0 };
  }
  rec.count += 1;
  const allowed = rec.count <= max;
  const out = {
    allowed,
    remaining: Math.max(0, max - rec.count),
    retryAfter: allowed ? 0 : Math.ceil((new Date(rec.resetAt).getTime() - now) / 1000),
  };
  writeSecurity(state);
  return out;
}

export function pruneSecurityState() {
  const state = readSecurity();
  const now = Date.now();
  let changed = false;
  for (const [ip, rec] of Object.entries(state.attempts)) {
    const blocked = rec.blockedUntil ? new Date(rec.blockedUntil).getTime() : 0;
    const windowMs = CONFIG.admin.windowMinutes * 60 * 1000;
    if (blocked < now && now - new Date(rec.firstAt || 0).getTime() > windowMs) {
      delete state.attempts[ip];
      changed = true;
    }
  }
  for (const [key, rec] of Object.entries(state.rate)) {
    if (now > new Date(rec.resetAt).getTime()) {
      delete state.rate[key];
      changed = true;
    }
  }
  if (changed) writeSecurity(state);
}

/* ------------------------------------------------------------------ admin */

export function verifyAdmin(username, password) {
  const db = readDb();
  const admin = db.admin;
  if (!admin || !admin.passwordHash) return false;
  const userOk = String(username || '').trim().toLowerCase() === String(admin.username).toLowerCase();
  const passOk = bcrypt.compareSync(String(password || ''), admin.passwordHash);
  return userOk && passOk;
}

export function updateAdmin({ username, password }) {
  return mutate((db) => {
    db.admin = {
      username: username || db.admin?.username || CONFIG.admin.username,
      passwordHash: password ? bcrypt.hashSync(password, 12) : db.admin?.passwordHash,
      updatedAt: new Date().toISOString(),
    };
    return db;
  }, { reason: 'security.credentials-updated' });
}
