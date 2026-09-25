/**
 * Brand-level content: the five divisions, event categories,
 * trust signals and the vision/mission narrative.
 * Editing this file updates the Services page, homepage and footer.
 */

export const CATEGORIES = [
  { key: 'wedding', label: 'Wedding', plural: 'Weddings', icon: 'rings', blurb: 'Ceremonies, receptions & destination weddings' },
  { key: 'party', label: 'Party', plural: 'Parties', icon: 'sparkles', blurb: 'Birthdays, anniversaries & private celebrations' },
  { key: 'concert', label: 'Concert', plural: 'Concerts', icon: 'music', blurb: 'Live shows, festivals & artist tours' },
  { key: 'corporate', label: 'Corporate', plural: 'Corporate', icon: 'briefcase', blurb: 'Conferences, galas & product launches' },
  { key: 'other', label: 'Other', plural: 'Other', icon: 'star', blurb: 'Something else entirely' },
];

export const EVENT_CATEGORIES = CATEGORIES.filter((c) => c.key !== 'other');

export const DIVISIONS = [
  {
    slug: 'titan-events',
    name: 'Titan Events',
    tagline: 'Event Planning & Management',
    icon: 'calendar-star',
    short: 'End-to-end planning and on-site management that turns your date into a flawless production.',
    description:
      'The parent division that owns your event from the first conversation to the final curtain call. We build the concept, lock the timeline, manage every vendor and stand beside you on the day so nothing is left to chance.',
    services: [
      'Wedding planning & day-of coordination',
      'Corporate conferences, AGMs & launches',
      'Birthday, anniversary & private celebrations',
      'Venue sourcing, décor & seating layouts',
      'Vendor negotiation & budget management',
      'Guest logistics, hospitality & transport',
    ],
  },
  {
    slug: 'titan-creation',
    name: 'Titan Creation',
    tagline: 'Creative Concepts & Design',
    icon: 'palette',
    short: 'Concepts, styling, florals and set design that give your event a signature look.',
    description:
      'Design is where an event becomes unforgettable. Titan Creation develops the storytelling, mood boards and 3D layouts, then builds them for real — from entrance installations and floral architecture to printed stationery and stage sets.',
    services: [
      'Concept development & mood boards',
      'Stage, set & entrance installations',
      'Floral architecture & table styling',
      'Invitations, stationery & signage',
      'Lighting design & colour direction',
      '3D venue mock-ups & walkthroughs',
    ],
  },
  {
    slug: 'titan-production',
    name: 'Titan Production',
    tagline: 'Sound, Lighting & Stage',
    icon: 'sliders',
    short: 'Concert-grade sound, lighting, staging and rigging with certified technicians.',
    description:
      'Our technical division keeps every performance clean and every speech audible. Line arrays, LED walls, moving-head lighting, trussing and power distribution — installed and operated by our own certified crew.',
    services: [
      'Line array PA systems & monitor engineering',
      'Moving-head lighting & architectural washes',
      'LED walls, projection mapping & screens',
      'Staging, trussing & rigging',
      'Generators, power & cable management',
      'Show calling & technical direction',
    ],
  },
  {
    slug: 'titan-tickets',
    name: 'Titan Tickets',
    tagline: 'Ticketing & Gate Management',
    icon: 'ticket',
    short: 'Secure online ticketing, QR scanning and gate control for sold-out crowds.',
    description:
      'Sell, scan and settle with confidence. Titan Tickets provides branded online ticket pages, secure payments, instant QR e-tickets and a gate team that keeps queues short and counterfeit tickets out.',
    services: [
      'Branded online ticket sales pages',
      'Secure payment collection & settlement',
      'QR e-tickets with WhatsApp & email delivery',
      'Gate scanning, turnstiles & crowd flow',
      'Guest-list, VIP & complimentary passes',
      'Real-time sales dashboards & reporting',
    ],
  },
  {
    slug: 'titan-media',
    name: 'Titan Media',
    tagline: 'Photography, Videography & Streaming',
    icon: 'camera',
    short: 'Cinematic coverage, same-day edits and live streams that reach everyone.',
    description:
      'Every moment, captured properly. Titan Media covers your event with cinema cameras, drones and multi-camera live streaming, then delivers a same-day highlight reel your guests can share before the night ends.',
    services: [
      'Wedding & event photography',
      'Cinematic videography & drone coverage',
      'Multi-camera live streaming',
      'Same-day highlight edits',
      'Official event reels & social content',
      'Photo booths & instant printing',
    ],
  },
];

export const WHY_US = [
  {
    icon: 'layers',
    title: 'All-In-One Service',
    text: 'Planning, design, production, ticketing and media under one roof — one team, one timeline, one invoice.',
  },
  {
    icon: 'shield-check',
    title: 'Trusted by Clients',
    text: 'Hotels, brands, families and artists return to us season after season because we keep our promises.',
  },
  {
    icon: 'bolt',
    title: 'Fast & Reliable',
    text: 'Quotes within 24 hours, crews on site early, backups for the backups. Deadlines are not negotiable.',
  },
  {
    icon: 'gem',
    title: 'Premium Quality',
    text: 'Cinema-grade equipment, vetted vendors and obsessive attention to the details guests actually notice.',
  },
];

export const VISION = {
  eyebrow: 'Vision & Mission',
  title: 'Built to light up Sri Lanka\'s biggest moments',
  lead:
    'Titan Events was founded on a simple belief: a great event is engineered, not improvised. We bring creative ambition and technical discipline together so that families, brands and artists can simply enjoy the moment they worked so hard for.',
  vision:
    'To become Sri Lanka\'s most trusted event group — the first call for any occasion that has to be perfect, from an intimate wedding to a stadium concert.',
  mission:
    'To plan and produce world-class events through one accountable team, delivering premium quality on time, on budget and without drama.',
  values: [
    { icon: 'star', title: 'Excellence', text: 'Good enough is never part of the plan.' },
    { icon: 'shield-check', title: 'Integrity', text: 'Transparent quotes, honest timelines.' },
    { icon: 'bolt', title: 'Agility', text: 'We solve problems before you notice them.' },
    { icon: 'gem', title: 'Craft', text: 'Detail is the difference between nice and unforgettable.' },
  ],
};

export const STAT_SEED = [
  { key: 'events', label: 'Events Organized', value: 500, suffix: '+' },
  { key: 'years', label: 'Years of Experience', value: 12, suffix: '' },
  { key: 'guests', label: 'Happy Guests Served', value: 250000, suffix: '+', format: 'compact' },
  { key: 'divisions', label: 'Specialized Divisions', value: 5, suffix: '' },
];

export const PROCESS = [
  { step: '01', title: 'Consultation', text: 'Tell us the occasion, the date and the feeling you want in the room.' },
  { step: '02', title: 'Concept & Costing', text: 'We return with a creative direction, a 3D layout and a transparent quote.' },
  { step: '03', title: 'Production', text: 'Our crews build, rig, rehearse and rehearse again until it is clean.' },
  { step: '04', title: 'Showtime', text: 'You host. We handle every cue, cable and contingency behind the scenes.' },
];

export const SOCIAL = [
  { key: 'facebook', name: 'Facebook', url: 'https://facebook.com/' },
  { key: 'instagram', name: 'Instagram', url: 'https://instagram.com/' },
  { key: 'youtube', name: 'YouTube', url: 'https://youtube.com/' },
  { key: 'tiktok', name: 'TikTok', url: 'https://tiktok.com/' },
];

export const RESPONSE_TIME = 'Within 24 hours';
