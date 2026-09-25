/** Small, dependency-free formatting + sanitising helpers. */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const escapeHtml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Escape then turn newlines into <br> — safe for user supplied text. */
export const nl2br = (str = '') => escapeHtml(str).replace(/\r?\n/g, '<br>');

/** Escape, split on blank lines and wrap each block in a <p>. */
export function paragraphs(str = '') {
  return String(str)
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${nl2br(block)}</p>`)
    .join('');
}

export const truncate = (str = '', len = 160) => {
  const s = String(str).trim().replace(/\s+/g, ' ');
  return s.length <= len ? s : `${s.slice(0, len - 1).trimEnd()}…`;
};

export function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(value));
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value, { withYear = true, withDay = false, long = false } = {}) {
  const d = parseDate(value);
  if (!d) return 'Date to be announced';
  const month = long ? MONTHS[d.getMonth()] : MONTHS[d.getMonth()].slice(0, 3);
  const parts = [];
  if (withDay) parts.push(DAYS[d.getDay()]);
  parts.push(String(d.getDate()));
  parts.push(month);
  if (withYear) parts.push(String(d.getFullYear()));
  return parts.join(' ');
}

export function formatTime(value) {
  const d = parseDate(value);
  if (!d || (!d.getHours() && !d.getMinutes())) return '';
  const h = d.getHours();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
}

export function formatDateTime(value) {
  const d = parseDate(value);
  if (!d) return '—';
  return `${formatDate(d)} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** "in 12 days" / "3 months ago" style label. */
export function relativeDate(value) {
  const d = parseDate(value);
  if (!d) return '';
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((target - startOfToday) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1 && days < 30) return `In ${days} days`;
  if (days < 0 && days > -30) return `${Math.abs(days)} days ago`;
  const months = Math.round(Math.abs(days) / 30.4);
  if (months < 12) return days > 0 ? `In ${months} month${months > 1 ? 's' : ''}` : `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.round(months / 12);
  return days > 0 ? `In ${years} year${years > 1 ? 's' : ''}` : `${years} year${years > 1 ? 's' : ''} ago`;
}

export function timeAgo(value) {
  const d = parseDate(value);
  if (!d) return '—';
  const secs = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatDate(d);
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const isPastDate = (value) => {
  const d = parseDate(value);
  if (!d) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
};

export const compactNumber = (n) => {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 === 0 ? 0 : 1)}K`;
  return String(v);
};

export function slugify(str = '') {
  return String(str)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export const safeJson = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');

/** Very light phone normaliser for tel: links (keeps digits and a leading +). */
export const telHref = (phone = '') => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

export const isEmail = (value = '') => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value).trim());

export const clean = (value = '', max = 5000) => String(value ?? '').replace(/\u0000/g, '').trim().slice(0, max);

export const humanFileSize = (bytes = 0) => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = Number(bytes) || 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const pluralise = (n, single, plural) => `${n} ${n === 1 ? single : plural || `${single}s`}`;
