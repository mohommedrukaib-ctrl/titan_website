/**
 * Public site routes: home, events (+ detail), services, contact,
 * sitemap / robots / manifest for SEO.
 */
import express from 'express';
import { CONFIG } from '../config.js';
import { getUpcomingEvents, getPastEvents, getEvents, getEvent, getAnnouncements, liveStats, addInquiry, getSettings } from '../lib/content.js';
import { CATEGORIES, EVENT_CATEGORIES, DIVISIONS, VISION, WHY_US, PROCESS } from '../lib/constants.js';
import { rateLimitMiddleware, flash, clientIp } from '../lib/middleware.js';
import { clean, isEmail, truncate } from '../lib/helpers.js';

const router = express.Router();

const pageUrl = (req, p = '') => `${CONFIG.siteUrl || `${req.protocol}://${req.get('host')}`}${p || req.path}`;

/** Shared structured data for every page (LocalBusiness / Organization). */
function businessJsonLd(req, settings) {
  const base = CONFIG.siteUrl || `${req.protocol}://${req.get('host')}`;
  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'EventVenue'],
    '@id': `${base}/#business`,
    name: 'TITAN EVENTS',
    alternateName: 'Titan Events Sri Lanka',
    slogan: CONFIG.tagline,
    description:
      "Sri Lanka's premier event organizers — weddings, parties, concerts and corporate events delivered by five specialized divisions: Titan Events, Titan Creation, Titan Production, Titan Tickets and Titan Media.",
    url: base,
    logo: `${base}/img/logo-mark.png`,
    image: `${base}/img/og-image.jpg`,
    telephone: [settings.phonePrimary, settings.phoneSecondary].filter(Boolean),
    email: settings.email,
    priceRange: '$$$',
    currenciesAccepted: 'LKR',
    paymentAccepted: 'Cash, Bank Transfer, Card',
    address: {
      '@type': 'PostalAddress',
      streetAddress: settings.address || '',
      addressLocality: 'Colombo',
      addressRegion: 'Western Province',
      addressCountry: 'LK',
    },
    areaServed: { '@type': 'Country', name: 'Sri Lanka' },
    openingHours: settings.hours || 'Mo-Sa 09:00-19:00',
    sameAs: (settings.socials || []).map((s) => s.url),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Event Services',
      itemListElement: DIVISIONS.map((d) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: d.name, description: d.short },
      })),
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.9',
      bestRating: '5',
      reviewCount: '186',
    },
  };
}

/* ------------------------------------------------------------------- home */

router.get('/', (req, res) => {
  const settings = getSettings();
  const upcoming = getUpcomingEvents(6);
  const past = getPastEvents(3);
  const announcements = getAnnouncements(3);
  const stats = liveStats();

  res.render('pages/home', {
    pageTitle: `${CONFIG.siteName} — ${CONFIG.tagline} | Event Planners in Sri Lanka`,
    pageDescription:
      'Titan Events plans, designs, produces, tickets and films premium weddings, parties, concerts and corporate events across Sri Lanka. Five specialized divisions, one accountable team.',
    pageImage: '/img/og-image.jpg',
    canonical: pageUrl(req, '/'),
    jsonLd: [
      businessJsonLd(req, settings),
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: CONFIG.siteName,
        url: CONFIG.siteUrl || `${req.protocol}://${req.get('host')}`,
        description: CONFIG.tagline,
      },
    ],
    showSplash: true,
    ogType: 'website',
    upcoming,
    past,
    announcements,
    stats,
    divisions: DIVISIONS,
    whyUs: WHY_US,
    vision: VISION,
    process: PROCESS,
  });
});

/* ----------------------------------------------------------------- events */

router.get('/events', (req, res) => {
  const type = ['upcoming', 'past'].includes(String(req.query.type)) ? String(req.query.type) : 'upcoming';
  const category = ['all', ...CATEGORIES.map((c) => c.key)].includes(String(req.query.category))
    ? String(req.query.category)
    : 'all';
  const search = clean(req.query.q || '', 80);

  let events = getEvents({ type, category, sort: type === 'past' ? 'date-desc' : 'date-asc' });
  if (search) {
    const needle = search.toLowerCase();
    events = events.filter((e) =>
      [e.name, e.venue, e.description, e.categoryLabel].join(' ').toLowerCase().includes(needle)
    );
  }
  const counts = {
    upcoming: getEvents({ type: 'upcoming' }).length,
    past: getEvents({ type: 'past' }).length,
  };

  res.render('pages/events', {
    pageTitle: `${type === 'past' ? 'Past Events' : 'Upcoming Events'} | ${CONFIG.siteName}`,
    pageDescription: `Browse ${type} weddings, parties, concerts and corporate events produced by Titan Events across Sri Lanka. Ticket links, venues and dates included.`,
    pageImage: events[0]?.poster || '/img/og-image.jpg',
    canonical: pageUrl(req, type === 'upcoming' && category === 'all' ? '/events' : `/events?type=${type}&category=${category}`),
    pageNoIndex: events.length === 0,
    jsonLd: [
      businessJsonLd(req, getSettings()),
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: type === 'past' ? 'Past events by Titan Events' : 'Upcoming events by Titan Events',
        itemListElement: events.slice(0, 20).map((e, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${CONFIG.siteUrl || `${req.protocol}://${req.get('host')}`}/events/${e.slug}`,
          name: e.name,
        })),
      },
    ],
    events,
    counts,
    filters: { type, category, search },
    categories: EVENT_CATEGORIES,
  });
});

router.get('/events/:slug', (req, res, next) => {
  const event = getEvent(req.params.slug);
  if (!event) return next();
  const related = getEvents({ type: event.type === 'past' ? 'past' : 'upcoming', sort: event.type === 'past' ? 'date-desc' : 'date-asc' })
    .filter((e) => e.id !== event.id)
    .slice(0, 3);
  const base = CONFIG.siteUrl || `${req.protocol}://${req.get('host')}`;

  return res.render('pages/event', {
    pageTitle: `${event.name} — ${event.prettyDate} | ${CONFIG.siteName}`,
    pageDescription: truncate(
      `${event.categoryLabel} in ${event.venue || 'Sri Lanka'} on ${event.prettyDate}. ${event.description || ''}`,
      180
    ),
    pageImage: event.poster || '/img/og-image.jpg',
    canonical: `${base}/events/${event.slug}`,
    jsonLd: [
      businessJsonLd(req, getSettings()),
      {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: event.name,
        description: truncate(event.description, 300),
        image: event.poster ? `${base}${event.poster}` : `${base}/img/og-image.jpg`,
        startDate: event.time ? `${event.date}T${event.time}:00+05:30` : event.date,
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
          '@type': 'Place',
          name: event.venue || 'Sri Lanka',
          address: { '@type': 'PostalAddress', addressLocality: event.venue || 'Colombo', addressCountry: 'LK' },
        },
        organizer: { '@type': 'Organization', name: 'TITAN EVENTS', url: base },
        offers: event.ticketLink
          ? { '@type': 'Offer', url: event.ticketLink, availability: 'https://schema.org/InStock', priceCurrency: 'LKR' }
          : undefined,
      },
    ],
    event,
    related,
  });
});

/* --------------------------------------------------------------- services */

router.get('/services', (req, res) => {
  res.render('pages/services', {
    pageTitle: `Our Services & Divisions | ${CONFIG.siteName}`,
    pageDescription:
      'Event planning, creative design, sound & lighting production, ticketing and media coverage — explore the five specialized divisions of Titan Events Sri Lanka.',
    pageImage: '/img/og-image.jpg',
    canonical: pageUrl(req, '/services'),
    jsonLd: [
      businessJsonLd(req, getSettings()),
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${CONFIG.siteUrl || pageUrl(req, '/')}` },
          { '@type': 'ListItem', position: 2, name: 'Services', item: pageUrl(req, '/services') },
        ],
      },
    ],
    divisions: DIVISIONS,
    whyUs: WHY_US,
    process: PROCESS,
    stats: liveStats(),
  });
});

/* ---------------------------------------------------------------- contact */

const renderContact = (req, res, { errors = {}, values = {}, sent = false } = {}) =>
  res.render('pages/contact', {
    pageTitle: `Contact Us | ${CONFIG.siteName}`,
    pageDescription:
      'Talk to Titan Events about your wedding, party, concert or corporate event in Sri Lanka. Call, WhatsApp or send an inquiry — we reply within 24 hours.',
    pageImage: '/img/og-image.jpg',
    canonical: pageUrl(req, '/contact'),
    jsonLd: [businessJsonLd(req, getSettings()), {
      '@context': 'https://schema.org',
      '@type': 'ContactPage',
      name: 'Contact Titan Events',
      url: pageUrl(req, '/contact'),
    }],
    errors,
    values,
    sent,
  });

router.get('/contact', (req, res) => {
  const state = req.session?.contactState || {};
  if (req.session) delete req.session.contactState;
  renderContact(req, res, state);
});

router.post(
  '/contact',
  rateLimitMiddleware({
    bucket: 'contact',
    max: CONFIG.limits.formPerHour,
    message: 'You have sent several inquiries already. Please call us directly if it is urgent.',
  }),
  (req, res) => {
    const body = req.body || {};
    const errors = {};
    const values = {
      name: clean(body.name, 120),
      email: clean(body.email, 160),
      phone: clean(body.phone, 40),
      eventType: clean(body.eventType, 30).toLowerCase(),
      eventDate: clean(body.eventDate, 10),
      message: clean(body.message, 4000),
    };

    // bot traps
    const honeypot = clean(body.website || body.company, 200);
    const elapsed = Date.now() - Number(body.formOpenedAt || 0);
    if (honeypot || (Number.isFinite(elapsed) && elapsed > 0 && elapsed < 1500)) {
      flash(req, 'error', 'Your inquiry could not be submitted. Please try again.');
      return res.redirect('/contact#form');
    }

    if (values.name.length < 2) errors.name = 'Please tell us your name.';
    if (!isEmail(values.email)) errors.email = 'Please enter a valid email address.';
    if (values.phone && values.phone.replace(/\D/g, '').length < 7) errors.phone = 'That phone number looks too short.';
    if (values.message.length < 10) errors.message = 'Please add a few details about your event (10 characters minimum).';
    if (values.eventType && !CATEGORIES.some((c) => c.key === values.eventType)) errors.eventType = 'Please choose an event type.';

    if (Object.keys(errors).length) {
      if (req.session) {
        req.session.contactState = { errors, values };
        req.session.csrf = req.session.csrf; // keep token
      }
      flash(req, 'error', 'Please check the highlighted fields and try again.');
      return res.redirect('/contact#form');
    }

    addInquiry({ ...values, ip: clientIp(req) });
    flash(req, 'success', `Thank you ${values.name.split(' ')[0]} — your inquiry is with our team. We reply within 24 hours.`);
    if (req.session) delete req.session.contactState;
    return res.redirect('/contact?sent=1#form');
  }
);

/* ------------------------------------------------------------------- SEO */

router.get('/robots.txt', (req, res) => {
  const base = CONFIG.siteUrl || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /admin/',
      'Disallow: /uploads/events/',
      '',
      `Sitemap: ${base}/sitemap.xml`,
      `Host: ${base.replace(/^https?:\/\//, '')}`,
      '',
    ].join('\n')
  );
});

router.get('/sitemap.xml', (req, res) => {
  const base = CONFIG.siteUrl || `${req.protocol}://${req.get('host')}`;
  const now = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: `${base}/`, priority: '1.0', changefreq: 'weekly' },
    { loc: `${base}/events`, priority: '0.9', changefreq: 'daily' },
    { loc: `${base}/services`, priority: '0.8', changefreq: 'monthly' },
    { loc: `${base}/contact`, priority: '0.8', changefreq: 'monthly' },
    ...[...getUpcomingEvents(), ...getPastEvents()].map((e) => ({
      loc: `${base}/events/${e.slug}`,
      priority: e.type === 'upcoming' ? '0.7' : '0.5',
      changefreq: e.type === 'upcoming' ? 'weekly' : 'yearly',
      lastmod: (e.updatedAt || e.createdAt || '').slice(0, 10) || now,
    })),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc.replace(/&/g, '&amp;')}</loc><lastmod>${u.lastmod || now}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
  )
  .join('\n')}
</urlset>
`;
  res.type('application/xml').send(body);
});

router.get('/manifest.webmanifest', (req, res) => {
  res.type('application/manifest+json').send(
    JSON.stringify(
      {
        name: 'TITAN EVENTS',
        short_name: 'Titan Events',
        description: CONFIG.tagline,
        start_url: '/',
        display: 'standalone',
        background_color: '#000000',
        theme_color: '#C9A84C',
        icons: [
          { src: '/img/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      null,
      2
    )
  );
});

router.get('/healthz', (req, res) => res.json({ ok: true, service: 'titan-events', time: new Date().toISOString() }));

export default router;
