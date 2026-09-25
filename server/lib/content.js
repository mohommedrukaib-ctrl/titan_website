/**
 * Content queries + mutations (events, announcements, inquiries, settings).
 * Everything funnels through store.mutate(), which snapshots a backup first.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CONFIG } from '../config.js';
import { readDb, mutate, logActivity } from './store.js';
import { slugify, isPastDate, parseDate } from './helpers.js';
import { CATEGORIES, STAT_SEED } from './constants.js';

const newId = (prefix) => `${prefix}_${crypto.randomBytes(5).toString('hex')}`;

export const categoryMeta = (key) =>
  CATEGORIES.find((c) => c.key === String(key || '').toLowerCase()) ||
  { key: 'other', label: 'Event', plural: 'Events', icon: 'star', blurb: 'Special occasion' };

const sortByDateAsc = (a, b) => (parseDate(a.date)?.getTime() || 0) - (parseDate(b.date)?.getTime() || 0);
const sortByDateDesc = (a, b) => (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0);

/** Turn a stored event into a view model with derived, display-ready fields. */
export function decorateEvent(event) {
  const cat = categoryMeta(event.category);
  const date = parseDate(event.date);
  return {
    ...event,
    categoryLabel: cat.label,
    categoryIcon: cat.icon,
    prettyDate: date
      ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Date to be announced',
    longDate: date
      ? date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : 'Date to be announced',
    dayNumber: date ? String(date.getDate()).padStart(2, '0') : '--',
    monthShort: date ? date.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase() : '',
    year: date ? date.getFullYear() : '',
    hasPoster: Boolean(event.poster),
    isSoldOut: /sold\s*out/i.test(event.description || ''),
  };
}

export function getEvents({ type = 'all', category = 'all', limit = 0, sort = 'date-asc' } = {}) {
  let list = [...readDb().events];
  if (type !== 'all') list = list.filter((e) => e.type === type);
  if (category !== 'all') list = list.filter((e) => e.category === category);
  list.sort(sort === 'date-desc' ? sortByDateDesc : sortByDateAsc);
  if (limit) list = list.slice(0, limit);
  return list.map(decorateEvent);
}

export const getUpcomingEvents = (limit = 0) => getEvents({ type: 'upcoming', limit, sort: 'date-asc' });
export const getPastEvents = (limit = 0) => getEvents({ type: 'past', limit, sort: 'date-desc' });

export function getEvent(id) {
  const event = readDb().events.find((e) => e.id === id || e.slug === id);
  return event ? decorateEvent(event) : null;
}

export function eventCounts() {
  const events = readDb().events;
  return {
    total: events.length,
    upcoming: events.filter((e) => e.type === 'upcoming').length,
    past: events.filter((e) => e.type === 'past').length,
    byCategory: CATEGORIES.reduce((acc, c) => {
      acc[c.key] = events.filter((e) => e.category === c.key).length;
      return acc;
    }, {}),
  };
}

function uniqueSlug(db, name, ignoreId = null) {
  const base = slugify(name) || 'event';
  let candidate = base;
  let i = 2;
  while (db.events.some((e) => e.slug === candidate && e.id !== ignoreId)) {
    candidate = `${base}-${i}`;
    i += 1;
  }
  return candidate;
}

export function saveEvent(data, id = null) {
  const isUpdate = Boolean(id);
  return mutate((db) => {
    const now = new Date().toISOString();
    if (isUpdate) {
      const idx = db.events.findIndex((e) => e.id === id);
      if (idx === -1) throw new Error('Event not found');
      const posterChanged = data.poster && data.poster !== db.events[idx].poster;
      db.events[idx] = {
        ...db.events[idx],
        ...data,
        poster: data.poster || db.events[idx].poster,
        slug: uniqueSlug(db, data.name || db.events[idx].name, id),
        updatedAt: now,
      };
      return db;
    }
    const event = {
      id: newId('evt'),
      slug: '',
      name: data.name,
      date: data.date,
      time: data.time || '',
      endDate: data.endDate || '',
      venue: data.venue || '',
      category: data.category || 'other',
      type: data.type === 'past' ? 'past' : 'upcoming',
      poster: data.poster || '',
      ticketLink: data.ticketLink || '',
      description: data.description || '',
      createdAt: now,
      updatedAt: now,
    };
    event.slug = uniqueSlug(db, event.name);
    db.events.push(event);
    return db;
  }, { reason: isUpdate ? 'event.update' : 'event.create' });
}

export function deleteEvent(id) {
  const existing = readDb().events.find((e) => e.id === id);
  const db = mutate((data) => {
    data.events = data.events.filter((e) => e.id !== id);
    return data;
  }, { reason: 'event.delete' });
  if (existing?.poster) removeUpload(existing.poster);
  return db;
}

/** Delete an uploaded poster if nothing else references it. */
export function removeUpload(publicPath) {
  try {
    if (!publicPath || !publicPath.startsWith('/uploads/events/')) return;
    const stillUsed = readDb().events.some((e) => e.poster === publicPath);
    if (stillUsed) return;
    const file = path.join(CONFIG.uploadDir, path.basename(publicPath));
    if (file.startsWith(CONFIG.uploadDir) && fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    /* ignore */
  }
}

/* ----------------------------------------------------------- announcements */

export function getAnnouncements(limit = 0) {
  const list = [...readDb().announcements].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return (limit ? list.slice(0, limit) : list).map((a) => ({
    ...a,
    prettyDate: new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
  }));
}

export function addAnnouncement({ title, content, createdAt }) {
  return mutate((db) => {
    db.announcements.unshift({
      id: newId('ann'),
      title,
      content,
      createdAt: createdAt || new Date().toISOString(),
    });
    return db;
  }, { reason: 'announcement.create' });
}

export function deleteAnnouncement(id) {
  return mutate((db) => {
    db.announcements = db.announcements.filter((a) => a.id !== id);
    return db;
  }, { reason: 'announcement.delete' });
}

/* --------------------------------------------------------------- inquiries */

export function getInquiries({ status = 'all' } = {}) {
  const list = [...readDb().inquiries];
  const filtered = status === 'all' ? list : list.filter((i) => i.status === status);
  return filtered
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((i) => ({
      ...i,
      categoryLabel: categoryMeta(i.eventType).label,
      prettyDate: new Date(i.createdAt).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      }),
    }));
}

export function inquiryCounts() {
  const inquiries = readDb().inquiries;
  return {
    total: inquiries.length,
    unread: inquiries.filter((i) => i.status === 'new').length,
  };
}

export function addInquiry(payload) {
  const inquiry = {
    id: newId('inq'),
    name: payload.name,
    email: payload.email,
    phone: payload.phone || '',
    eventType: payload.eventType || 'other',
    eventDate: payload.eventDate || '',
    message: payload.message,
    status: 'new',
    ip: payload.ip || '',
    createdAt: new Date().toISOString(),
  };
  mutate((db) => {
    db.inquiries.unshift(inquiry);
    return db;
  }, { reason: 'inquiry.received' });
  return inquiry;
}

export function setInquiryStatus(id, status) {
  return mutate((db) => {
    const found = db.inquiries.find((i) => i.id === id);
    if (found) found.status = status;
    return db;
  }, { reason: `inquiry.${status}` });
}

export function deleteInquiry(id) {
  return mutate((db) => {
    db.inquiries = db.inquiries.filter((i) => i.id !== id);
    return db;
  }, { reason: 'inquiry.delete' });
}

/* ---------------------------------------------------------------- settings */

export function getSettings() {
  const db = readDb();
  return {
    ...db.settings,
    stats: db.settings.stats?.length ? db.settings.stats : STAT_SEED,
  };
}

export function updateSettings(patch) {
  return mutate((db) => {
    db.settings = { ...db.settings, ...patch };
    return db;
  }, { reason: 'settings.update' });
}

/** Homepage stat row — live counts always override the marketing numbers. */
export function liveStats() {
  const settings = getSettings();
  const counts = eventCounts();
  return settings.stats.map((stat) => {
    if (stat.key === 'events') {
      // never advertise fewer events than are actually published
      const value = Number(stat.value) || 0;
      return { ...stat, value: Math.max(value, counts.total) };
    }
    if (stat.key === 'divisions') return { ...stat, value: 5 };
    return stat;
  });
}

export function activityFeed(limit = 40) {
  return readDb().activity.slice().reverse().slice(0, limit).map((a) => ({
    ...a,
    prettyAt: new Date(a.at).toLocaleString('en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    }),
  }));
}

export { logActivity };
