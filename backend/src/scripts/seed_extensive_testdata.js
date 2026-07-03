'use strict';

/**
 * EventSphere — Extensive Test Data Seeder
 *
 * Goals:
 *  - Create a large-ish dataset to exercise list endpoints, pagination, filtering, and UI rendering.
 *  - Follow the expected data “channels” to avoid schema/flow breaks.
 *  - Use placeholder image/logo URLs (no Cloudinary required).
 *
 * Usage:
 *   node src/scripts/seed_extensive_testdata.js
 *
 * Notes:
 *  - Requires: .env with MONGODB_URI
 *  - By default it wipes: User, Expo, Booth, ExhibitorProfile, Session, Message, Transaction, Notification
 *    and then reseeds.
 */

require('dotenv').config();

const mongoose = require('mongoose');
const argon2 = require('argon2');

const User = require('../models/User');
const Expo = require('../models/Expo');
const Booth = require('../models/Booth');
const ExhibitorProfile = require('../models/Exhibitorprofile');
const Session = require('../models/Session');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');

const log = (msg) => console.log(`\x1b[36m[seed-extensive]\x1b[0m ${msg}`);
const ok = (msg) => console.log(`\x1b[32m[OK]\x1b[0m   ${msg}`);
const warn = (msg) => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`);
const err = (msg) => console.error(`\x1b[31m[ERR]\x1b[0m  ${msg}`);

const pad2 = (n) => String(n).padStart(2, '0');
const date = (daysFromNow, h = 9, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(h, m, 0, 0);
  return d;
};

const clampInt = (v, min, max) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
};

const mkPlaceholderImage = (label) => {
  // Stable, no auth, no Cloudinary.
  // (We keep it simple: the UI typically just needs a URL string.)
  return `https://placehold.co/600x400/png?text=${encodeURIComponent(label)}`;
};

const SESSION_FORMATS = ['keynote', 'panel', 'workshop', 'presentation', 'networking', 'demo', 'other'];
const SESSION_STATUSES = ['scheduled', 'live', 'completed', 'cancelled'];
const SPEAKER_FIRST = ['Ava', 'Noah', 'Mia', 'Ethan', 'Sophia', 'Liam', 'Olivia', 'Lucas', 'Amir', 'Zara'];
const SPEAKER_LAST = ['Stone', 'Rahman', 'Nguyen', 'Patel', 'Kim', 'Sato', 'Garcia', 'Khan', 'Wang', 'Johnson'];
const COMPANY = ['NovaWorks', 'ByteCrafters', 'CloudHarbor', 'SecureNest', 'GridPulse', 'VisionForge', 'QuantumLeaf', 'AutoPilot Labs'];
const TAGS_POOL = ['AI', 'Cloud', 'Cybersecurity', 'DevOps', 'Sustainability', 'ESG', 'Startups', 'Data', 'Healthcare', 'FinTech', 'IoT', 'Quantum'];

async function hashPassword(plain) {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
}

function pick(arr, i) {
  return arr[i % arr.length];
}

function shuffleDeterministic(arr, seed) {
  // Simple deterministic shuffle for consistent runs.
  const a = [...arr];
  let x = seed;
  for (let i = a.length - 1; i > 0; i--) {
    x = (x * 9301 + 49297) % 233280;
    const j = Math.floor((x / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  const { MONGODB_URI } = process.env;
  if (!MONGODB_URI) {
    err('Missing MONGODB_URI in .env');
    process.exit(1);
  }

  // Sizes (configurable from env)
  const EXPO_COUNT = clampInt(process.env.SEED_EXPO_COUNT || 4, 1, 20);
  const SESSIONS_PER_EXPO = clampInt(process.env.SEED_SESSIONS_PER_EXPO || 18, 5, 120);
  const BOOTH_ROWS = clampInt(process.env.SEED_BOOTH_ROWS || 4, 2, 20);
  const BOOTH_COLS = clampInt(process.env.SEED_BOOTH_COLS || 10, 4, 30);
  const EXHIBITORS_PER_EXPO = clampInt(process.env.SEED_EXHIBITORS_PER_EXPO || 6, 1, 60);
  const ATTENDEES_COUNT = clampInt(process.env.SEED_ATTENDEES_COUNT || 25, 5, 400);

  // Default for attendees/exhibitors: we create extra global pool.
  const ADMIN_COUNT = 1;
  const exhibitorsTotal = EXHIBITORS_PER_EXPO * EXPO_COUNT;

  log(`Connecting to MongoDB…`);
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  ok(`Connected: ${mongoose.connection.host}`);

  // Wipe
  log('Clearing collections…');
  await Promise.all([
    User.deleteMany({}),
    Expo.deleteMany({}),
    Booth.deleteMany({}),
    ExhibitorProfile.deleteMany({}),
    Session.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
    Transaction.deleteMany({}),
  ]);
  ok('Collections cleared.');

  // Create placeholders for images/logos
  const LOGO_URLS = {
    admin: mkPlaceholderImage('Admin Logo'),
    exhibitor: mkPlaceholderImage('Exhibitor Logo'),
    expo: mkPlaceholderImage('Expo Logo'),
    session: mkPlaceholderImage('Session Banner'),
    avatar: mkPlaceholderImage('Avatar'),
  };

  // Seed users
  log('Seeding users…');

  const passwordAdmin = await hashPassword('Admin@1234!');
  const passwordExhibitor = await hashPassword('Exhibitor@1234!');
  const passwordAttendee = await hashPassword('Attendee@1234!');

  const users = [];

  // Admins
  for (let i = 0; i < ADMIN_COUNT; i++) {
    users.push({
      name: `Admin User ${i + 1}`,
      email: `admin${i + 1}@eventsphere.io`,
      password: passwordAdmin,
      role: 'admin',
      isEmailVerified: true,
      profileIsComplete: true,
      isActive: true,
      avatar: LOGO_URLS.admin,
    });
  }

  // Exhibitors
  for (let i = 0; i < exhibitorsTotal; i++) {
    const exhibName = `Exhibitor ${i + 1}`;
    users.push({
      name: exhibName,
      email: `exhibitor${i + 1}@eventsphere.io`,
      password: passwordExhibitor,
      role: 'exhibitor',
      isEmailVerified: i % 6 !== 3, // some unverified to test UI paths
      profileIsComplete: i % 6 !== 3,
      isActive: true,
      avatar: LOGO_URLS.exhibitor,
    });
  }

  // Attendees
  for (let i = 0; i < ATTENDEES_COUNT; i++) {
    const attendeeName = `Attendee ${i + 1}`;
    users.push({
      name: attendeeName,
      email: `attendee${i + 1}@eventsphere.io`,
      password: passwordAttendee,
      role: 'attendee',
      isEmailVerified: i % 7 !== 0,
      profileIsComplete: i % 5 !== 0,
      isActive: true,
      avatar: LOGO_URLS.avatar,
    });
  }

  const insertedUsers = await User.insertMany(users);

  const adminUsers = insertedUsers.filter((u) => u.role === 'admin');
  const exhibitorUsers = insertedUsers.filter((u) => u.role === 'exhibitor');
  const attendeeUsers = insertedUsers.filter((u) => u.role === 'attendee');

  ok(`Users seeded: admin=${adminUsers.length}, exhibitor=${exhibitorUsers.length}, attendee=${attendeeUsers.length}`);

  const adminUser = adminUsers[0];

  // Seed expos
  log('Seeding expos…');
  const expoDocs = [];

  const expoThemes = [
    'Technology & Innovation',
    'Sustainability & Clean Energy',
    'Healthcare Technology',
    'Finance & FinTech',
    'Cybersecurity Summit',
  ];

  const expoStatuses = ['published', 'published', 'ongoing', 'completed', 'cancelled'];

  for (let e = 0; e < EXPO_COUNT; e++) {
    const status = expoStatuses[e % expoStatuses.length];
    const startOffset = status === 'completed'
      ? -1 * (25 + e * 3)
      : status === 'cancelled'
        ? 30 + e * 2
        : 10 + e * 10;

    const endOffset = startOffset + (status === 'completed' ? 2 : 3);

    const title = `Expo ${e + 1}: ${expoThemes[e % expoThemes.length]}`;

    const expo = await Expo.create({
      title,
      description: `A ${title} used for performance testing and UI validation.`,
      theme: expoThemes[e % expoThemes.length],
      status,
      startDate: date(startOffset, 9, 0),
      endDate: date(endOffset, 18, 0),
      registrationDeadline: date(startOffset - 5, 23, 59),
      address: {
        venue: `Venue ${e + 1}`,
        city: `City ${e + 1}`,
        country: 'Testland',
        street: `Main St ${e + 1}`,
        zipCode: `10${pad2(e)}0${pad2(e)}`,
      },
      floorPlanConfig: { rows: BOOTH_ROWS, cols: BOOTH_COLS, boothWidth: 3, boothHeight: 3, aisleWidth: 1.5 },
      tags: shuffleDeterministic(TAGS_POOL, e).slice(0, 5),
      maxAttendees: 1000 + e * 250,
      isPublic: true,
      createdBy: adminUser._id,
      posterUrl: LOGO_URLS.expo,
      logoUrl: mkPlaceholderImage(`Expo ${e + 1} Logo`),
    });

    expoDocs.push(expo);
  }

  ok(`Expos seeded: ${expoDocs.length}`);

  // Seed booth grids
  log('Seeding booths…');

  const expoBooths = new Map(); // expoId -> Map(boothNumber -> boothDoc)
  let totalBooths = 0;

  for (let e = 0; e < expoDocs.length; e++) {
    const expo = expoDocs[e];
    const { rows, cols, boothWidth, boothHeight } = expo.floorPlanConfig;

    const boothDocs = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const letter = String.fromCharCode(65 + r);
        const num = String(c + 1).padStart(2, '0');
        const boothNumber = `${letter}${num}`;

        boothDocs.push({
          expoId: expo._id,
        boothNumber,
          // Booth model expects: boothNumber, dimensions, size/type enums, gridCoordinates, status.
          dimensions: `${boothWidth}m x ${boothHeight}m`,
          // Use Booth model enums exactly.
          type: c % 4 === 0 ? 'Corner' : 'Standard',
          size: r === 0 ? 'Large' : 'Standard',
          status: 'available',
          gridCoordinates: { row: r, col: c },
          assignedTo: null,
          pricing: {
            basePrice: r === 0 ? 5000 : 3000,
            currency: 'USD',
            isPremium: r === 0,
            premiumMultiplier: r === 0 ? 1.6 : 1.0,
          },
          amenities: {
            power: true,
            wifi: true,
            lighting: r === 0,
            storage: r < 2,
          },
        });
      }
    }

    const created = await Booth.insertMany(boothDocs, { ordered: false });
    totalBooths += created.length;

    await Expo.findByIdAndUpdate(expo._id, { boothCount: created.length });

    const m = new Map();
    created.forEach((b) => m.set(b.boothNumber, b));
    expoBooths.set(expo._id.toString(), m);
  }

  ok(`Booths seeded: ${totalBooths}`);

  // Seed exhibitor profiles + assign random booths per expo
  log('Seeding exhibitor profiles and booth assignments…');

  const profileDocs = [];
  const usedBooths = new Set();

  for (let e = 0; e < expoDocs.length; e++) {
    const expo = expoDocs[e];
    const boothMap = expoBooths.get(expo._id.toString());

    // Pick exhibitor users for this expo
    const startIdx = e * EXHIBITORS_PER_EXPO;
    const selectedExhibitors = exhibitorUsers.slice(startIdx, startIdx + EXHIBITORS_PER_EXPO);

    for (let i = 0; i < selectedExhibitors.length; i++) {
      const u = selectedExhibitors[i];

      const profile = await ExhibitorProfile.create({
        userId: u._id,
        companyName: `Company ${u.name.replace('Exhibitor ', '')}`,
        tagline: pick(['Building the future', 'Secure by design', 'Connecting people', 'Powering systems'], i),
        description: `Seeded profile for ${u.name}. Used to test exhibitors dashboard and messages.`,
        industry: pick(['Artificial Intelligence', 'Renewable Energy', 'Cybersecurity', 'Healthcare Technology', 'FinTech'], e + i),
        products: shuffleDeterministic(['Platform', 'SDK', 'Dashboard', 'Edge Tools', 'Automation Suite', 'Storage', 'Analytics'], e + i).slice(0, 5),
        applicationStatus: u.isEmailVerified ? 'approved' : 'pending',
        isVerified: u.isEmailVerified,
        contactPerson: {
          name: u.name,
          email: u.email,
          title: pick(['CEO', 'CTO', 'Head of Engineering', 'Founder'], e + i),
          phone: `+1-555-${pad2(e * 3 + i)}${pad2(e * 7 + i)}`,
        },
        socialLinks: {
          website: 'https://example.com',
          linkedin: 'https://linkedin.com',
        },
        documents: [
          {
            type: 'business_registration',
            label: 'Seed Document',
            fileUrl: 'https://example.com/docs/seed.pdf',
            fileName: 'seed.pdf',
            status: u.isEmailVerified ? 'verified' : 'pending',
          },
        ],
        logoUrl: mkPlaceholderImage(`${u.name} Logo`),
        reviewedBy: u.isEmailVerified ? adminUser._id : null,
        reviewedAt: u.isEmailVerified ? new Date() : null,
      });

      // Sync profile completion on User
      if (profile.applicationStatus === 'approved') {
        await User.findByIdAndUpdate(u._id, { profileIsComplete: true });
      }

      // Assign 1 booth (if possible)
      // Use first available booths deterministically
      const boothNumbers = Array.from(boothMap.keys());
      const shuffled = shuffleDeterministic(boothNumbers, e * 1000 + i);

      let assigned = false;
      for (const boothNumber of shuffled) {
        const booth = boothMap.get(boothNumber);
        const key = `${expo._id.toString()}_${boothNumber}`;
        if (!booth || usedBooths.has(key) || booth.status !== 'available') continue;

        booth.status = 'assigned';
        booth.assignedTo = u._id;
        booth.exhibitorProfileId = profile._id;
        booth._previousStatus = 'available';
        booth._changedBy = adminUser._id;
        booth._statusNote = 'Seed: assigned booth.';

        await booth.save();

        profile.assignedBooths = profile.assignedBooths || [];
        profile.assignedBooths.push({
          boothId: booth._id,
          expoId: expo._id,
          assignedBy: adminUser._id,
        });
        await profile.save();

        usedBooths.add(key);
        assigned = true;
        break;
      }

      if (!assigned) {
        warn(`No available booth found for ${u.email} in expo ${expo.title}`);
      }

      profileDocs.push(profile);
    }
  }

  ok(`Exhibitor profiles seeded: ${profileDocs.length}`);

  // Seed sessions
  log('Seeding sessions…');

  const sessionDocs = [];

  for (let e = 0; e < expoDocs.length; e++) {
    const expo = expoDocs[e];

    const sessionCount = SESSIONS_PER_EXPO;

    // decide session statuses relative to expo date
    for (let s = 0; s < sessionCount; s++) {
      const format = SESSION_FORMATS[(e + s) % SESSION_FORMATS.length];

      // Some sessions live soon, others scheduled/completed/cancelled for coverage.
      let status = 'scheduled';
      const mod = s % 20;
      if (mod === 0) status = 'cancelled';
      else if (mod === 1) status = 'completed';
      else if (mod === 2) status = 'live';

      // Ensure times fit within expo date range (controller expects within expo dates on creation).
      // We'll generate start/end relative to expo start.
      const expoStart = expo.startDate;
      const expoEnd = expo.endDate;
      const expoSpanMs = expoEnd.getTime() - expoStart.getTime();

      const startOffsetRatio = (s / Math.max(1, sessionCount)) * 0.85;
      const startTime = new Date(expoStart.getTime() + expoSpanMs * startOffsetRatio);
      const durationMinutes = 30 + ((s * 7) % 90);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60_000);

      // Keep inside expo range
      if (endTime > expoEnd) {
        endTime.setTime(expoEnd.getTime() - 5 * 60_000);
      }

      const maxCapacity = 10 + ((e + s) % 10) * 10; // 10..~110

      const price = (s % 4 === 0) ? 2500 : 0; // 25.00 for paid sessions
      const currency = 'USD';

      const speakerCount = (format === 'keynote' || format === 'panel') ? 2 + (s % 2) : s % 3;
      const speakers = [];
      for (let k = 0; k < Math.max(0, Math.min(10, speakerCount)); k++) {
        const fullName = `${pick(SPEAKER_FIRST, e + s + k)} ${pick(SPEAKER_LAST, e + s * 2 + k)}`;
        speakers.push({
          name: fullName,
          title: pick(['Chief Architect', 'Research Lead', 'Engineer', 'Director', 'Founder'], s + k),
          company: pick(COMPANY, e + s + k),
          bio: 'Seeded speaker bio for testing.',
          avatar: mkPlaceholderImage(`Speaker ${k + 1}`),
        });
      }

      const location = pick(['Room A', 'Room B', 'Auditorium', 'Workshop Room', 'Innovation Stage', 'Conference Hall'], e + s);

      const title = `${format.toUpperCase()} Session ${s + 1} @ ${expo.title}`;

      const tags = shuffleDeterministic(TAGS_POOL, e * 999 + s).slice(0, 4);

      const session = await Session.create({
        expoId: expo._id,
        title,
        description: `Seeded session ${s + 1} for ${expo.title}.`,
        format,
        location,
        startTime,
        endTime,
        speakers,
        maxCapacity,
        tags,
        isFeatured: s % 9 === 0,
        isPublic: true,
        createdBy: adminUser._id,
        status,
        price,
        currency,
        streamUrl: null,
      });

      // Register a portion of attendees (avoid capacity overflow)
      const attendeesToRegister = attendeeUsers
        .slice((s * 2) % attendeeUsers.length, (s * 2) % attendeeUsers.length + Math.min(8, attendeeUsers.length));

      for (const au of attendeesToRegister) {
        if (session.attendees.length >= session.maxCapacity) break;
        // Avoid duplicates
        const already = session.attendees.some((a) => a.userId.toString() === au._id.toString());
        if (!already) {
          session.attendees.push({ userId: au._id, attended: false, registeredAt: new Date() });
        }
      }

      // Bookmarks from first attendee in list
      if (attendeesToRegister.length > 0) {
        const bmUser = attendeesToRegister[0];
        if (!session.bookmarkedBy.some((id) => id.toString() === bmUser._id.toString())) {
          session.bookmarkedBy.push(bmUser._id);
        }
      }

      // Some marked attended to populate attendance rate
      if (session.attendees && session.attendees.length > 0 && s % 5 === 0) {
        const toMark = Math.max(1, Math.floor(session.attendees.length / 2));
        session.attendees.slice(0, toMark).forEach((a, idx) => {
          a.attended = idx % 2 === 0;
          if (a.attended) a.checkedInAt = new Date(a.registeredAt.getTime() + 30_000);
        });
      }

      // Avoid mongoose versioning conflicts in this seeder.
      // Also keep versioning from failing on rare doc cache mismatches.
      await session
        .save({ validateBeforeSave: false, optimisticConcurrency: false })
        .catch(() => session.save({ validateBeforeSave: false }));
      sessionDocs.push(session);


    }
  }

  // Update expo session counts
  for (const expo of expoDocs) {
    const count = sessionDocs.filter((s) => s.expoId.toString() === expo._id.toString()).length;
    await Expo.findByIdAndUpdate(expo._id, { sessionCount: count });
  }

  ok(`Sessions seeded: ${sessionDocs.length}`);

  // Seed messages between roles
  log('Seeding messages…');

  const messageDocs = [];
  const msgTemplates = [
    'Hi! I have a question about booth details.',
    'Thanks for the update—what are your hours during the expo?',
    'Do you have any upcoming workshops we can join?',
    'Could you share pricing or availability for the booth add-ons?',
    'We are planning to attend the keynote; see you there!',
  ];

  // Admin ↔ Exhibitor
  for (const expo of expoDocs) {
    const boothMap = expoBooths.get(expo._id.toString());
    if (!boothMap) continue;

    // pick assigned booths
    const assigned = Array.from(boothMap.values()).filter((b) => b.status === 'assigned' && b.assignedTo);
    const picked = assigned.slice(0, Math.min(3, assigned.length));

    for (let i = 0; i < picked.length; i++) {
      const booth = picked[i];
      const exUserId = booth.assignedTo;
      const exUser = exhibitorUsers.find((u) => u._id.toString() === exUserId.toString());
      if (!exUser) continue;

      const m1 = await Message.create({
        conversationId: `${adminUser._id.toString()}_${exUser._id.toString()}`,
        senderId: adminUser._id,
        receiverId: exUser._id,
        type: 'text',
        content: msgTemplates[(expoDocs.indexOf(expo) + i) % msgTemplates.length],
      });
      messageDocs.push(m1);

      const m2 = await Message.create({
        conversationId: `${adminUser._id.toString()}_${exUser._id.toString()}`,
        senderId: exUser._id,
        receiverId: adminUser._id,
        type: 'text',
        content: 'Great—our team will be ready as discussed.',
        isRead: i % 2 === 0,
      });
      messageDocs.push(m2);
    }
  }

  // Attendee ↔ first exhibitor per expo
  for (const expo of expoDocs) {
    const boothMap = expoBooths.get(expo._id.toString());
    if (!boothMap) continue;

    const assigned = Array.from(boothMap.values()).filter((b) => b.status === 'assigned' && b.assignedTo);
    if (assigned.length === 0) continue;

    const exUserId = assigned[0].assignedTo;
    const exUser = exhibitorUsers.find((u) => u._id.toString() === exUserId.toString());
    if (!exUser) continue;

    for (let i = 0; i < Math.min(8, attendeeUsers.length); i++) {
      const au = attendeeUsers[(i * 3 + expoDocs.indexOf(expo)) % attendeeUsers.length];
      const msg = await Message.create({
        conversationId: `${au._id.toString()}_${exUser._id.toString()}`,
        senderId: au._id,
        receiverId: exUser._id,
        type: 'text',
        content: 'Hi! I would love to learn more about your offerings.',
        isRead: true,
      });
      messageDocs.push(msg);
    }
  }

  ok(`Messages seeded: ${messageDocs.length}`);

  // Notifications (light coverage; doesn’t need full correctness here)
  // Seed notifications
  // IMPORTANT: Notification schema requires `recipient`, `type`, `title` and optional `body`, `link`, etc.
  log('Seeding notifications…');
  const notifications = [];
  for (const au of attendeeUsers.slice(0, Math.min(12, attendeeUsers.length))) {
    notifications.push({
      recipient: au._id,
      type: 'system',
      title: 'Seed notification',
      body: 'This is a test notification for UI rendering.',
      link: null,
      referenceId: null,
      referenceModel: null,
      isRead: false,
    });
  }

  if (notifications.length) {
    await Notification.insertMany(notifications);
  }
  ok(`Notifications seeded: ${notifications.length}`);

  // Transactions (optional; keep minimal to avoid breaking payment logic)

  // We do not create completed transactions unless you confirm your Transaction schema.

  // Done
  console.log('\n─────────────────────────────────────────────────');
  console.log('\x1b[32m✓ Extensive seed complete!\x1b[0m');
  console.log('─────────────────────────────────────────────────');
  console.log('\nSeed Config:');
  console.log(`  EXPO_COUNT:            ${EXPO_COUNT}`);
  console.log(`  SESSIONS_PER_EXPO:    ${SESSIONS_PER_EXPO}`);
  console.log(`  BOOTH_ROWS x COLS:    ${BOOTH_ROWS} x ${BOOTH_COLS}`);
  console.log(`  EXHIBITORS_PER_EXPO:  ${EXHIBITORS_PER_EXPO}`);
  console.log(`  ATTENDEES_COUNT:      ${ATTENDEES_COUNT}`);
  console.log('\nLogin Accounts (examples):');
  console.log(`  Admin:     ${adminUsers[0].email} / Admin@1234!`);
  console.log(`  Exhibitor: ${exhibitorUsers[0].email} / Exhibitor@1234!`);
  console.log(`  Attendee:  ${attendeeUsers[0].email} / Attendee@1234!`);
  console.log('─────────────────────────────────────────────────\n');

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((e) => {
  err(e.message || 'Seed failed');
  console.error(e.stack);
  process.exit(1);
});

