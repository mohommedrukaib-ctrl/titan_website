/**
 * First-run content. `store.init()` writes this to data/titan.json when no
 * database exists, so the site is never empty on a fresh install.
 */
import { STAT_SEED, SOCIAL, RESPONSE_TIME } from './constants.js';

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const seedEvent = (id, name, date, venue, category, type, poster, description, ticketLink = '') => ({
  id,
  name,
  date,
  time: '18:30',
  venue,
  category,
  type,
  poster,
  ticketLink,
  description,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export function seedData() {
  const now = new Date().toISOString();
  return {
    version: 1,
    meta: { createdAt: now, updatedAt: now, seeded: true },
    settings: {
      siteUrl: '',
      phonePrimary: '+94 77 123 4567',
      phoneSecondary: '+94 11 234 5678',
      whatsapp: '+94 77 123 4567',
      email: 'hello@titanevents.lk',
      address: 'No. 42, Galle Road, Colombo 03, Sri Lanka',
      responseTime: RESPONSE_TIME,
      hours: 'Mon – Sat · 9:00 AM – 7:00 PM',
      stats: STAT_SEED,
      socials: SOCIAL,
      analyticsId: '',
    },
    admin: null, // filled by store.init() (bcrypt hash)
    events: [
      seedEvent(
        'evt_golden-hour',
        'The Golden Hour Wedding Showcase',
        day(21),
        'Cinnamon Grand, Colombo',
        'wedding',
        'upcoming',
        '/uploads/seed/wedding.jpg',
        'An evening of bridal couture, floral installations and live styling demos from the Titan Creation team. Meet our planners, taste the menus and walk through a full reception set-up before you book.',
        'https://tickets.titanevents.lk/golden-hour'
      ),
      seedEvent(
        'evt_nye',
        'Titan NYE: Skyline Sessions',
        day(45),
        'Grand Ballroom, Shangri-La Colombo',
        'concert',
        'upcoming',
        '/uploads/seed/concert.jpg',
        'Sri Lanka\'s most anticipated New Year countdown — a full concert production with live bands, guest DJs, LED walls and a midnight fireworks finale over the Colombo skyline.',
        'https://tickets.titanevents.lk/skyline-sessions'
      ),
      seedEvent(
        'evt_summit',
        'Ceylon Business Summit & Gala',
        day(66),
        'Bentota Beach Resort',
        'corporate',
        'upcoming',
        '/uploads/seed/corporate.jpg',
        'Two days of keynote sessions, breakout workshops and an awards gala. Full production, simultaneous interpretation, delegate apps and live streaming by Titan Media.',
        'https://tickets.titanevents.lk/ceylon-summit'
      ),
      seedEvent(
        'evt_launch',
        'Aurora Fragrance Launch',
        day(30),
        'Kingsbury Hotel, Colombo',
        'corporate',
        'upcoming',
        '/uploads/seed/production.jpg',
        'A theatrical product reveal built around projection mapping, scent diffusion and a 40-piece live orchestra. Invitation only — joining instructions are emailed to registered guests.',
      ),
      seedEvent(
        'evt_anniversary',
        'Silver Anniversary Celebration',
        day(58),
        'Private Estate, Nuwara Eliya',
        'party',
        'upcoming',
        '/uploads/seed/party.jpg',
        'An intimate black-tie dinner for 180 guests with a five-course tasting menu, string quartet and a vintage photo gallery telling a 25-year love story.',
      ),
      seedEvent(
        'evt_rockfest',
        'Titan Rock Fest 10th Edition',
        day(90),
        'Colombo Racecourse Grounds',
        'concert',
        'upcoming',
        '/uploads/seed/concert.jpg',
        'Ten years of Titan Rock Fest, ten hours of music. Three stages, 14 acts, festival food village and a dedicated family zone — ticketing and gate management by Titan Tickets.',
        'https://tickets.titanevents.lk/rockfest'
      ),
      seedEvent(
        'evt_past_wedding',
        'Fernando & Perera Wedding',
        day(-34),
        'Bolawalana Church & Waters Edge',
        'wedding',
        'past',
        '/uploads/seed/wedding.jpg',
        'A 320-guest wedding across two venues with a live choir, white-floral ceremony styling and a same-day highlight reel delivered to guests before midnight.',
      ),
      seedEvent(
        'evt_past_gala',
        'National Excellence Awards 2024',
        day(-72),
        'BMICH, Colombo',
        'corporate',
        'past',
        '/uploads/seed/corporate.jpg',
        '900 delegates, 42 award categories and a live broadcast produced by Titan Media for a national audience across three channels.',
      ),
      seedEvent(
        'evt_past_beach',
        'Beach Sunset Sessions',
        day(-108),
        'Negombo Beach Club',
        'party',
        'past',
        '/uploads/seed/party.jpg',
        'A sunset-to-midnight beach party with fire performers, a resident DJ line-up and fully cashless gates powered by Titan Tickets.',
      ),
      seedEvent(
        'evt_past_concert',
        'Symphony Under The Stars',
        day(-150),
        'Independence Square, Colombo',
        'concert',
        'past',
        '/uploads/seed/production.jpg',
        'A 60-piece orchestra under open sky, with orchestral lighting design, delay towers for a 4,000-strong audience and free live streaming for 90,000 online viewers.',
      ),
    ].map((e) => ({ ...e, slug: e.id.replace(/^evt_/, '') })),
    announcements: [
      {
        id: 'ann_1',
        title: 'Titan Tickets now supports cashless gate entry',
        content:
          'Every event ticketed through Titan Tickets now runs on cashless QR scanning. Guests receive their pass instantly on WhatsApp, and organisers can watch live sales and entry counts from one dashboard.',
        createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: 'ann_2',
        title: 'New 12,000 sq ft production warehouse in Kaduwela',
        content:
          'We have expanded our inventory with a second warehouse housing new line-array systems, 48 moving-head fixtures and a 12m x 4m LED wall — cutting mobilisation time for large-scale concerts.',
        createdAt: new Date(Date.now() - 11 * 86400000).toISOString(),
      },
      {
        id: 'ann_3',
        title: 'Now booking 2026 weddings and destination celebrations',
        content:
          'Our 2026 calendar is open. Complimentary consultations are available at our Colombo studio, and destination weddings in Kandy, Galle and Nuwara Eliya are being scheduled now.',
        createdAt: new Date(Date.now() - 24 * 86400000).toISOString(),
      },
      {
        id: 'ann_4',
        title: 'Titan Media introduces same-day cinematic highlights',
        content:
          'A dedicated editing suite on site means your highlight film is colour-graded and delivered to guests the same night — ready to share on social media while the moment is still fresh.',
        createdAt: new Date(Date.now() - 39 * 86400000).toISOString(),
      },
    ],
    inquiries: [
      {
        id: 'inq_demo1',
        name: 'Dilani Rajapaksa',
        email: 'dilani.r@example.com',
        phone: '+94 71 555 0198',
        eventType: 'wedding',
        eventDate: day(190),
        message:
          'Good evening, we are planning a 250-guest wedding in Colombo next year and would like a quote for planning, décor and media coverage. We already have a venue hold at Waters Edge.',
        status: 'new',
        ip: '203.0.113.24',
        createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
      },
      {
        id: 'inq_demo2',
        name: 'Kanishka Fernando',
        email: 'kanishka@lankabrands.lk',
        phone: '+94 76 220 4411',
        eventType: 'corporate',
        eventDate: day(88),
        message:
          'We need a full production partner for a distributor conference for 400 people, including stage, sound and live streaming. Please send your corporate deck and indicative pricing.',
        status: 'new',
        ip: '203.0.113.51',
        createdAt: new Date(Date.now() - 30 * 3600000).toISOString(),
      },
      {
        id: 'inq_demo3',
        name: 'Ayesha Nawaz',
        email: 'ayesha.n@example.com',
        phone: '',
        eventType: 'party',
        eventDate: day(40),
        message: 'Looking for a 21st birthday party with DJ, lighting and a photo booth for about 120 guests.',
        status: 'read',
        ip: '203.0.113.77',
        createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      },
    ],
    activity: [
      { at: now, action: 'system.init', detail: 'Website database initialised with demo content', ip: 'local' },
    ],
  };
}
