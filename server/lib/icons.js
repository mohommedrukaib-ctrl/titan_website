/**
 * Inline SVG icon set (stroke-based, currentColor) used across the
 * public site, the services data and the admin panel.
 * `icon(name, cls, size)` returns safe, hand-written markup.
 */

const P = {
  'calendar-star':
    '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/><path d="M12 12.6l1.3 2.4 2.2.4-1.6 1.8.3 2.4-2.2-1.1-2.2 1.1.3-2.4-1.6-1.8 2.2-.4z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  rings:
    '<circle cx="9.5" cy="14" r="5.5"/><circle cx="15.5" cy="14" r="5.5"/><path d="M12 3.5l2 3h-4z"/>',
  sparkles:
    '<path d="M12 3l1.7 4.8L18.5 9.5 13.7 11.2 12 16l-1.7-4.8L5.5 9.5l4.8-1.7z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  music: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  briefcase:
    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M3 12h18"/>',
  palette:
    '<path d="M12 21a9 9 0 110-18c4.97 0 9 3.58 9 8 0 2.2-1.8 3-3.4 3H16a2 2 0 00-2 2c0 .7.4 1.3.4 2 0 1.7-1.1 3-2.4 3z"/><circle cx="8" cy="9.5" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="15.8" cy="10" r="1.2"/>',
  sliders:
    '<path d="M4 8h10M18 8h2M4 16h4M12 16h8"/><circle cx="16" cy="8" r="2"/><circle cx="10" cy="16" r="2"/>',
  ticket:
    '<path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4z"/><path d="M14 6v2M14 11v2M14 16v2"/>',
  camera:
    '<path d="M3 8.5A2 2 0 015 6.5h2.2l1.2-2h7.2l1.2 2H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><circle cx="12" cy="13" r="3.6"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  'shield-check': '<path d="M12 3l7 3v6c0 4.2-2.9 7.8-7 9-4.1-1.2-7-4.8-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
  bolt: '<path d="M13 2L4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9.5 3L8 9l4 12 4-12-1.5-6"/>',
  star: '<path d="M12 3.5l2.6 5.6 6 .8-4.4 4.2 1.1 6-5.3-3-5.3 3 1.1-6L3.4 9.9l6-.8z"/>',
  phone: '<path d="M5 3h3.5l1.8 4.4-2.3 1.6a12.5 12.5 0 006 6l1.6-2.3L20 14.5V18a3 3 0 01-3.3 3A16.5 16.5 0 014 6.3A3 3 0 015 3z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  pin: '<path d="M12 22s7-6.1 7-11a7 7 0 10-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="11" r="2.6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3.2 2"/>',
  users: '<circle cx="9" cy="8" r="3.4"/><path d="M2.8 20a6.4 6.4 0 0112.4 0"/><path d="M16.5 5.6a3.4 3.4 0 010 6.6M18 19.8a6.5 6.5 0 00-2-4.6"/>',
  megaphone: '<path d="M3 11v2a1 1 0 001 1h2l4.5 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M15 8.5a5 5 0 010 7"/><path d="M18 6a9 9 0 010 12"/>',
  check: '<path d="M4 12.5l5 5L20 6.5"/>',
  arrowRight: '<path d="M4 12h15"/><path d="M13 6l6 6-6 6"/>',
  arrowDown: '<path d="M12 4v15"/><path d="M6 13l6 6 6-6"/>',
  arrowLeft: '<path d="M20 12H5"/><path d="M11 6l-6 6 6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
  download: '<path d="M12 4v11"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  upload: '<path d="M12 20V9"/><path d="M7 13l5-5 5 5"/><path d="M4 20h16"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5"/><path d="M12 14.5v3"/>',
  eye: '<path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M4 4l16 16"/><path d="M9.5 5.4A9.6 9.6 0 0112 5c6 0 9.5 6 9.5 6a17 17 0 01-2.6 3.2M6.4 7.6A17 17 0 002.5 11s3.5 6 9.5 6a9.4 9.4 0 003.5-.7"/>',
  dashboard: '<rect x="3" y="3" width="8" height="8" rx="1.6"/><rect x="13" y="3" width="8" height="5" rx="1.6"/><rect x="13" y="10" width="8" height="11" rx="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.6"/>',
  chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 17v-5M12 17V8M16 17v-7M20 17v-3"/>',
  backup: '<path d="M12 3v10"/><path d="M8 7l4-4 4 4"/><path d="M4 14v4a2 2 0 002 2h12a2 2 0 002-2v-4"/>',
  activity: '<path d="M3 12h4l2.5-7 4 14L16 12h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 3 2.6 15 0 18M12 3c-2.6 3-2.6 15 0 18"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-8.5 8.5"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  quote: '<path d="M9 7c-2.8 0-4.5 2-4.5 5.2 0 2.6 1.6 4.3 3.8 4.3 1.9 0 3.2-1.3 3.2-3.1 0-1.7-1.1-2.9-2.7-2.9-.3 0-.6 0-.9.1.3-1.3 1.3-2.1 2.6-2.1V7zm8.5 0c-2.8 0-4.5 2-4.5 5.2 0 2.6 1.6 4.3 3.8 4.3 1.9 0 3.2-1.3 3.2-3.1 0-1.7-1.1-2.9-2.7-2.9-.3 0-.6 0-.9.1.3-1.3 1.3-2.1 2.6-2.1V7z"/>',
  facebook:
    '<path d="M13.5 21v-7h2.4l.4-3h-2.8V9.2c0-.9.3-1.5 1.6-1.5h1.4V5c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H7.6v3h2.5v7z" fill="currentColor" stroke="none"/>',
  instagram:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r="1.1" fill="currentColor" stroke="none"/>',
  youtube:
    '<rect x="2.5" y="6" width="19" height="12" rx="4"/><path d="M11 9.7l4 2.3-4 2.3z" fill="currentColor" stroke="none"/>',
  tiktok:
    '<path d="M15 4c.4 2.4 1.9 3.8 4.3 4v2.6c-1.6.1-3-.4-4.3-1.3v5.4c0 3.3-2.4 5.4-5.2 5.4A5 5 0 019.5 10c.4 0 .8 0 1.2.2v2.7a2.6 2.6 0 00-1.2-.3 2.4 2.4 0 00.1 4.7c1.4 0 2.4-1 2.4-2.7V4z" fill="currentColor" stroke="none"/>',
  whatsapp:
    '<path d="M12 3a9 9 0 00-7.7 13.6L3 21l4.5-1.2A9 9 0 1012 3z" /><path d="M8.8 8.6c.3-.6 1.4-.6 1.7 0l.6 1.2-.8 1c.5 1 1.4 1.9 2.4 2.4l1-.8 1.2.6c.6.3.6 1.4 0 1.7-1.9 1-5.9-2.2-6.9-4.4-.3-.6-.4-1.2.8-1.7z" fill="currentColor" stroke="none"/>',
  sparkle: '<path d="M12 2l1.4 5.6L19 9l-5.6 1.4L12 16l-1.4-5.6L5 9l5.6-1.4z"/>',
  diamond: '<path d="M12 2l4 6-4 14-4-14z"/>',
  file: '<path d="M6 2.5h7l5 5V21.5H6z"/><path d="M13 2.5v5h5"/>',
  gear: '<circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.2M12 18.3v2.2M4.9 7.4l1.9 1.1M17.2 15.5l1.9 1.1M4.9 16.6l1.9-1.1M17.2 8.5l1.9-1.1"/>',
};

const ALIASES = {
  rings: 'rings',
  'twitter-x': 'external',
};

export function icon(name, cls = 'ico', size = 20) {
  const key = ALIASES[name] || name;
  const body = P[key] || P.star;
  return (
    `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" ` +
    'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ' +
    `aria-hidden="true" focusable="false">${body}</svg>`
  );
}

export const ICON_NAMES = Object.keys(P);
