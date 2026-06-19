'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const argon2   = require('argon2');

// ─── Models ───────────────────────────────────────────────────────────────────
const User             = require('../models/User');
const Expo             = require('../models/Expo');
const Booth            = require('../models/Booth');
const ExhibitorProfile = require('../models/ExhibitorProfile');
const Session          = require('../models/Session');
const Message          = require('../models/Message');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const log  = (msg)  => console.log(`\x1b[36m[SEED]\x1b[0m ${msg}`);
const ok   = (msg)  => console.log(`\x1b[32m[OK]\x1b[0m   ${msg}`);
const warn = (msg)  => console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`);
const err  = (msg)  => console.error(`\x1b[31m[ERR]\x1b[0m  ${msg}`);

const pad  = (n)    => String(n).padStart(2, '0');
const date = (daysFromNow, h = 9, m = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(h, m, 0, 0);
  return d;
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

const USERS = [
  // Admin
  {
    name:  'Sarah Chen',
    email: 'admin@eventsphere.io',
    password: 'Admin@1234!',
    role: 'admin',
    isEmailVerified: true,
    profileIsComplete: true,
  },
  // Exhibitors
  {
    name:  'Marcus Webb',
    email: 'marcus@techvision.io',
    password: 'Exhibitor@1234!',
    role: 'exhibitor',
    isEmailVerified: true,
    profileIsComplete: true,
  },
  {
    name:  'Priya Sharma',
    email: 'priya@greenenergy.co',
    password: 'Exhibitor@1234!',
    role: 'exhibitor',
    isEmailVerified: true,
    profileIsComplete: true,
  },
  {
    name:  'Daniel Okafor',
    email: 'daniel@healthtech.ng',
    password: 'Exhibitor@1234!',
    role: 'exhibitor',
    isEmailVerified: false,
    profileIsComplete: false,
  },
  {
    name:  'Ling Wu',
    email: 'ling@smartmanufacture.cn',
    password: 'Exhibitor@1234!',
    role: 'exhibitor',
    isEmailVerified: true,
    profileIsComplete: true,
  },
  // Attendees
  {
    name:  'James Thornton',
    email: 'james@attendee.com',
    password: 'Attendee@1234!',
    role: 'attendee',
    isEmailVerified: true,
    profileIsComplete: false,
  },
  {
    name:  'Amara Diallo',
    email: 'amara@attendee.com',
    password: 'Attendee@1234!',
    role: 'attendee',
    isEmailVerified: true,
    profileIsComplete: false,
  },
  {
    name:  'Carlos Rivera',
    email: 'carlos@attendee.com',
    password: 'Attendee@1234!',
    role: 'attendee',
    isEmailVerified: false,
    profileIsComplete: false,
  },
];

const EXPO_DATA = [
  {
    title: 'TechConnect Global 2026',
    description: 'The world\'s leading technology expo bringing together innovators, startups, and enterprise leaders across AI, cloud infrastructure, cybersecurity, and emerging platforms. Three days of keynotes, workshops, and unparalleled networking opportunities.',
    theme: 'Technology & Innovation',
    startDaysOffset: 14,
    endDaysOffset:   16,
    regDeadlineDaysOffset: 10,
    status: 'published',
    address: {
      venue:   'Dubai World Trade Centre',
      city:    'Dubai',
      country: 'United Arab Emirates',
      street:  'Sheikh Zayed Road',
      zipCode: '12345',
    },
    floorPlanConfig: { rows: 6, cols: 8, boothWidth: 3, boothHeight: 3, aisleWidth: 1.5 },
    tags: ['Technology', 'AI', 'Cloud', 'Cybersecurity', 'Startups'],
    maxAttendees: 5000,
    isPublic: true,
  },
  {
    title: 'GreenFuture Sustainability Expo 2026',
    description: 'A dedicated platform for sustainable technologies, renewable energy solutions, and circular economy innovations. Connecting policymakers, businesses, and NGOs committed to building a greener tomorrow.',
    theme: 'Sustainability & Clean Energy',
    startDaysOffset: 45,
    endDaysOffset:   47,
    regDeadlineDaysOffset: 38,
    status: 'published',
    address: {
      venue:   'Amsterdam RAI Convention Centre',
      city:    'Amsterdam',
      country: 'Netherlands',
      street:  'Europaplein 24',
      zipCode: '1078 GZ',
    },
    floorPlanConfig: { rows: 5, cols: 6, boothWidth: 3, boothHeight: 3, aisleWidth: 1.5 },
    tags: ['Sustainability', 'CleanEnergy', 'ESG', 'CircularEconomy'],
    maxAttendees: 3000,
    isPublic: true,
  },
  {
    title: 'HealthTech Summit 2025',
    description: 'A completed landmark event that united healthcare professionals, medical device manufacturers, and digital health innovators. Sessions covered telemedicine, AI diagnostics, wearable health, and hospital operations.',
    theme: 'Healthcare Technology',
    startDaysOffset: -30,
    endDaysOffset:   -28,
    regDeadlineDaysOffset: -40,
    status: 'completed',
    address: {
      venue:   'Singapore Expo',
      city:    'Singapore',
      country: 'Singapore',
      street:  '1 Expo Drive',
      zipCode: '486150',
    },
    floorPlanConfig: { rows: 4, cols: 5, boothWidth: 3, boothHeight: 3, aisleWidth: 1.5 },
    tags: ['Healthcare', 'MedTech', 'Telemedicine', 'AI'],
    maxAttendees: 2000,
    isPublic: true,
  },
];

const SESSION_DATA = [
  // TechConnect sessions (expo index 0)
  {
    expoIndex: 0,
    title: 'Opening Keynote: The Age of Autonomous AI',
    description: 'A deep dive into how autonomous AI agents are reshaping industries, with live demonstrations and a panel of global CTO voices.',
    format: 'keynote',
    location: 'Main Auditorium',
    startOffset: { days: 14, hours: 9,  minutes: 0  },
    endOffset:   { days: 14, hours: 10, minutes: 30 },
    speakers: [
      { name: 'Dr. Elena Marchetti', title: 'Chief AI Officer', company: 'FutureCore Labs' },
      { name: 'Raj Patel',           title: 'VP Engineering',   company: 'Anthropic'       },
    ],
    maxCapacity: 800,
    tags: ['AI', 'Keynote', 'Autonomous'],
    isFeatured: true,
  },
  {
    expoIndex: 0,
    title: 'Workshop: Building Scalable Microservices on Kubernetes',
    description: 'Hands-on workshop covering container orchestration, service meshes, and zero-downtime deployments.',
    format: 'workshop',
    location: 'Workshop Room A',
    startOffset: { days: 14, hours: 11, minutes: 0  },
    endOffset:   { days: 14, hours: 13, minutes: 0  },
    speakers: [
      { name: 'Sofia Andersson', title: 'Platform Engineer', company: 'Spotify' },
    ],
    maxCapacity: 80,
    tags: ['Kubernetes', 'DevOps', 'Cloud'],
    isFeatured: false,
  },
  {
    expoIndex: 0,
    title: 'Panel: The Future of Cybersecurity in a Post-Quantum World',
    description: 'Industry leaders discuss quantum computing threats, post-quantum cryptography standards, and zero-trust architectures.',
    format: 'panel',
    location: 'Conference Hall B',
    startOffset: { days: 14, hours: 14, minutes: 0  },
    endOffset:   { days: 14, hours: 15, minutes: 30 },
    speakers: [
      { name: 'James Kimura',  title: 'CISO',            company: 'BlackRock'  },
      { name: 'Yuki Tanaka',   title: 'Security Lead',   company: 'Cloudflare' },
      { name: 'Nina Volkov',   title: 'Quantum Researcher', company: 'IBM'     },
    ],
    maxCapacity: 200,
    tags: ['Cybersecurity', 'Quantum', 'ZeroTrust'],
    isFeatured: true,
  },
  {
    expoIndex: 0,
    title: 'Demo: Real-Time AI Vision in Retail Environments',
    description: 'Live demonstration of computer vision systems for inventory management, loss prevention, and customer behaviour analytics.',
    format: 'demo',
    location: 'Innovation Stage',
    startOffset: { days: 15, hours: 10, minutes: 0  },
    endOffset:   { days: 15, hours: 11, minutes: 0  },
    speakers: [
      { name: 'Marcus Webb', title: 'CEO', company: 'TechVision Systems' },
    ],
    maxCapacity: 150,
    tags: ['AI', 'ComputerVision', 'Retail'],
    isFeatured: false,
  },
  {
    expoIndex: 0,
    title: 'Networking: Tech Leaders Roundtable',
    description: 'An exclusive networking session for C-suite executives and senior engineering leaders. Refreshments provided.',
    format: 'networking',
    location: 'Executive Lounge',
    startOffset: { days: 15, hours: 17, minutes: 0  },
    endOffset:   { days: 15, hours: 19, minutes: 0  },
    speakers: [],
    maxCapacity: 100,
    tags: ['Networking', 'Executive'],
    isFeatured: false,
  },
  // GreenFuture sessions (expo index 1)
  {
    expoIndex: 1,
    title: 'Keynote: Accelerating the Net Zero Transition',
    description: 'Global climate leaders present the roadmap to net zero, featuring policy frameworks, corporate commitments, and technology enablers.',
    format: 'keynote',
    location: 'Plenary Hall',
    startOffset: { days: 45, hours: 9,  minutes: 0  },
    endOffset:   { days: 45, hours: 10, minutes: 30 },
    speakers: [
      { name: 'Priya Sharma', title: 'CEO', company: 'GreenEnergy Solutions' },
    ],
    maxCapacity: 600,
    tags: ['NetZero', 'ClimatePolicy', 'Keynote'],
    isFeatured: true,
  },
  {
    expoIndex: 1,
    title: 'Workshop: Solar & Storage System Design',
    description: 'Technical deep-dive into utility-scale solar farm design, battery storage integration, and grid stability.',
    format: 'workshop',
    location: 'Technical Workshop Room',
    startOffset: { days: 45, hours: 13, minutes: 0  },
    endOffset:   { days: 45, hours: 15, minutes: 30 },
    speakers: [
      { name: 'Lars Hansen', title: 'Head of Engineering', company: 'Vestas Wind' },
    ],
    maxCapacity: 60,
    tags: ['Solar', 'BatteryStorage', 'Grid'],
    isFeatured: false,
  },
];

const EXHIBITOR_PROFILES = [
  {
    userIndex: 1, // Marcus Webb
    companyName: 'TechVision Systems',
    tagline: 'Seeing the future, delivering it today.',
    description: 'TechVision Systems is a leading provider of AI-powered computer vision solutions for retail, logistics, and smart city applications. Our proprietary edge inference platform processes 10,000+ frames per second with sub-5ms latency.',
    industry: 'Artificial Intelligence',
    products: ['EdgeVision SDK', 'RetailIQ Platform', 'LogisticsEye', 'SmartCity Monitor', 'Vision Analytics Dashboard'],
    applicationStatus: 'approved',
    isVerified: true,
    contactPerson: {
      name:  'Marcus Webb',
      email: 'marcus@techvision.io',
      title: 'CEO & Co-Founder',
      phone: '+1 415 555 0192',
    },
    socialLinks: {
      website:  'https://techvision.io',
      linkedin: 'https://linkedin.com/company/techvision-systems',
    },
    documents: [
      {
        type:     'business_registration',
        label:    'Delaware Corporation Certificate',
        fileUrl:  'https://example.com/docs/techvision-cert.pdf',
        fileName: 'TechVision_Corp_Certificate.pdf',
        status:   'verified',
      },
    ],
  },
  {
    userIndex: 2, // Priya Sharma
    companyName: 'GreenEnergy Solutions',
    tagline: 'Powering a sustainable tomorrow.',
    description: 'GreenEnergy Solutions designs and deploys utility-scale renewable energy infrastructure across South Asia and the Middle East. We specialise in solar farm design, wind integration, and battery storage systems with a combined installed capacity exceeding 2GW.',
    industry: 'Renewable Energy',
    products: ['SolarDesign Pro', 'WindIntegrator', 'StoragePlanner', 'GridOptimiser', 'CarbonTracker'],
    applicationStatus: 'approved',
    isVerified: true,
    contactPerson: {
      name:  'Priya Sharma',
      email: 'priya@greenenergy.co',
      title: 'CEO',
      phone: '+91 98765 43210',
    },
    socialLinks: {
      website:  'https://greenenergy.co',
      linkedin: 'https://linkedin.com/company/greenenergy-solutions',
      twitter:  'https://twitter.com/greenenergyco',
    },
    documents: [
      {
        type:     'business_registration',
        label:    'India MCA Certificate',
        fileUrl:  'https://example.com/docs/greenenergy-mca.pdf',
        fileName: 'GreenEnergy_MCA_Certificate.pdf',
        status:   'verified',
      },
      {
        type:     'tax_certificate',
        label:    'GST Registration',
        fileUrl:  'https://example.com/docs/greenenergy-gst.pdf',
        fileName: 'GreenEnergy_GST.pdf',
        status:   'verified',
      },
    ],
  },
  {
    userIndex: 3, // Daniel Okafor
    companyName: 'HealthBridge Technologies',
    tagline: 'Bridging healthcare gaps with technology.',
    description: 'HealthBridge Technologies builds telemedicine and diagnostic AI platforms for underserved communities across sub-Saharan Africa. Our mobile-first approach enables high-quality healthcare delivery in low-bandwidth environments.',
    industry: 'Healthcare Technology',
    products: ['TeleMed Mobile', 'DiagnosticAI', 'PatientFlow', 'HealthRecord Lite'],
    applicationStatus: 'pending',
    isVerified: false,
    contactPerson: {
      name:  'Daniel Okafor',
      email: 'daniel@healthtech.ng',
      title: 'Founder & CTO',
      phone: '+234 803 555 0147',
    },
    socialLinks: {
      website: 'https://healthbridge.ng',
    },
    documents: [
      {
        type:     'business_registration',
        label:    'CAC Certificate',
        fileUrl:  'https://example.com/docs/healthbridge-cac.pdf',
        fileName: 'HealthBridge_CAC.pdf',
        status:   'pending',
      },
    ],
  },
  {
    userIndex: 4, // Ling Wu
    companyName: 'SmartManufacture AI',
    tagline: 'Industry 4.0 intelligence, delivered.',
    description: 'SmartManufacture AI provides industrial AI solutions for predictive maintenance, quality control automation, and supply chain optimisation. Our platform integrates with major SCADA systems and has reduced unplanned downtime by an average of 67% for our clients.',
    industry: 'Manufacturing Technology',
    products: ['PredictMaint Pro', 'QualityVision', 'SupplyChainIQ', 'FactoryOS', 'SCADABridge'],
    applicationStatus: 'approved',
    isVerified: true,
    contactPerson: {
      name:  'Ling Wu',
      email: 'ling@smartmanufacture.cn',
      title: 'CTO',
      phone: '+86 138 0013 8000',
    },
    socialLinks: {
      website:  'https://smartmanufacture.ai',
      linkedin: 'https://linkedin.com/company/smartmanufacture-ai',
    },
    documents: [
      {
        type:     'business_registration',
        label:    'SAMR Business License',
        fileUrl:  'https://example.com/docs/smartmfg-license.pdf',
        fileName: 'SmartMfg_Business_License.pdf',
        status:   'verified',
      },
    ],
  },
];

// ─── Main Seed Function ───────────────────────────────────────────────────────
async function seed() {
  // ── Connect ─────────────────────────────────────────────────────────────────
  log('Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });
  ok(`Connected to: ${mongoose.connection.host}`);

  // ── Wipe existing data ───────────────────────────────────────────────────────
  log('Clearing existing collections…');
  await Promise.all([
    User.deleteMany({}),
    Expo.deleteMany({}),
    Booth.deleteMany({}),
    ExhibitorProfile.deleteMany({}),
    Session.deleteMany({}),
    Message.deleteMany({}),
  ]);
  ok('Collections cleared.');

  // ── Users ────────────────────────────────────────────────────────────────────
  log('Seeding users…');
  const hashedUsers = await Promise.all(
    USERS.map(async (u) => ({
      ...u,
      password: await argon2.hash(u.password, {
        type:        argon2.argon2id,
        memoryCost:  2 ** 16,
        timeCost:    3,
        parallelism: 1,
      }),
    }))
  );
  const users = await User.insertMany(hashedUsers);
  ok(`${users.length} users seeded.`);

  const adminUser    = users[0];
  const exhibitorUsers = users.slice(1, 5);
  const attendeeUsers  = users.slice(5);

  // ── Expos ────────────────────────────────────────────────────────────────────
  log('Seeding expos…');
  const expoDocuments = await Promise.all(
    EXPO_DATA.map(async (e) => {
      const expo = new Expo({
        title:       e.title,
        description: e.description,
        theme:       e.theme,
        status:      e.status,
        startDate:   date(e.startDaysOffset, 9,  0),
        endDate:     date(e.endDaysOffset,   18, 0),
        registrationDeadline: date(e.regDeadlineDaysOffset, 23, 59),
        address:         e.address,
        floorPlanConfig: e.floorPlanConfig,
        tags:            e.tags,
        maxAttendees:    e.maxAttendees,
        isPublic:        e.isPublic,
        createdBy:       adminUser._id,
      });
      return expo.save();
    })
  );
  ok(`${expoDocuments.length} expos seeded.`);

  // ── Booths (auto-generate grid for each expo) ─────────────────────────────
  log('Seeding booth grids…');
  let totalBooths = 0;

  for (const expo of expoDocuments) {
    const { rows, cols, boothWidth, boothHeight } = expo.floorPlanConfig;
    const boothDocs = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const letter = String.fromCharCode(65 + r);
        const num    = String(c + 1).padStart(2, '0');
        boothDocs.push({
          expoId:          expo._id,
          boothNumber:     `${letter}${num}`,
          dimensions:      `${boothWidth}m x ${boothHeight}m`,
          type:            c % 4 === 0 ? 'corner' : 'standard',
          size:            r === 0 ? 'large' : 'medium',
          status:          'available',
          gridCoordinates: { row: r, col: c },
          pricing: {
            basePrice: r === 0 ? 5000 : 3000,
            currency:  'USD',
            isPremium: r === 0,
          },
          amenities: {
            power:    true,
            wifi:     true,
            lighting: r === 0,
            storage:  r < 2,
          },
        });
      }
    }

    await Booth.insertMany(boothDocs, { ordered: false });
    await Expo.findByIdAndUpdate(expo._id, { boothCount: boothDocs.length });
    totalBooths += boothDocs.length;
  }
  ok(`${totalBooths} booths seeded across ${expoDocuments.length} expos.`);

  // ── Assign some booths to approved exhibitors ─────────────────────────────
  log('Assigning booths to exhibitors…');

  const techExpo   = expoDocuments[0]; // TechConnect
  const greenExpo  = expoDocuments[1]; // GreenFuture

  // TechVision → Booth A01 in TechConnect (assigned)
  const techBooth = await Booth.findOne({
    expoId:      techExpo._id,
    boothNumber: 'A01',
  }).select('+statusHistory');
  if (techBooth) {
    techBooth._previousStatus = 'available';
    techBooth._changedBy      = adminUser._id;
    techBooth._statusNote     = 'Admin assigned via seed.';
    techBooth.status          = 'assigned';
    techBooth.assignedTo      = exhibitorUsers[0]._id; // Marcus
    await techBooth.save();
  }

  // GreenEnergy → Booth B02 in TechConnect (pending)
  const greenBoothTech = await Booth.findOne({
    expoId:      techExpo._id,
    boothNumber: 'B02',
  }).select('+statusHistory');
  if (greenBoothTech) {
    greenBoothTech._previousStatus = 'available';
    greenBoothTech._changedBy      = exhibitorUsers[1]._id; // Priya
    greenBoothTech._statusNote     = 'Exhibitor reserved via seed.';
    greenBoothTech.status          = 'pending';
    greenBoothTech.assignedTo      = exhibitorUsers[1]._id;
    await greenBoothTech.save();
  }

  // SmartManufacture → Booth A01 in GreenFuture (assigned)
  const smartBooth = await Booth.findOne({
    expoId:      greenExpo._id,
    boothNumber: 'A01',
  }).select('+statusHistory');
  if (smartBooth) {
    smartBooth._previousStatus = 'available';
    smartBooth._changedBy      = adminUser._id;
    smartBooth._statusNote     = 'Admin assigned via seed.';
    smartBooth.status          = 'assigned';
    smartBooth.assignedTo      = exhibitorUsers[3]._id; // Ling Wu
    await smartBooth.save();
  }

  ok('Booth assignments complete.');

  // ── Exhibitor Profiles ────────────────────────────────────────────────────
  log('Seeding exhibitor profiles…');
  const profileDocs = [];

  for (const profileData of EXHIBITOR_PROFILES) {
    const user = users[profileData.userIndex];

    const profile = await ExhibitorProfile.create({
      userId:            user._id,
      companyName:       profileData.companyName,
      tagline:           profileData.tagline,
      description:       profileData.description,
      industry:          profileData.industry,
      products:          profileData.products,
      applicationStatus: profileData.applicationStatus,
      isVerified:        profileData.isVerified,
      contactPerson:     profileData.contactPerson,
      socialLinks:       profileData.socialLinks || {},
      documents:         profileData.documents || [],
      reviewedBy:        profileData.applicationStatus === 'approved' ? adminUser._id : null,
      reviewedAt:        profileData.applicationStatus === 'approved' ? new Date()    : null,
    });

    // Sync profileIsComplete on User
    if (profileData.applicationStatus === 'approved') {
      await User.findByIdAndUpdate(user._id, { profileIsComplete: true });
    }

    // Attach booth assignment records
    if (profileData.userIndex === 1 && techBooth) {
      // Marcus — TechConnect A01
      profile.assignedBooths.push({
        boothId:    techBooth._id,
        expoId:     techExpo._id,
        assignedBy: adminUser._id,
      });
      await profile.save();
    }
    if (profileData.userIndex === 4 && smartBooth) {
      // Ling Wu — GreenFuture A01
      profile.assignedBooths.push({
        boothId:    smartBooth._id,
        expoId:     greenExpo._id,
        assignedBy: adminUser._id,
      });
      await profile.save();
    }

    profileDocs.push(profile);
  }

  // Link exhibitorProfileId on assigned booths
  if (techBooth) {
    await Booth.findByIdAndUpdate(techBooth._id, {
      exhibitorProfileId: profileDocs[0]._id,
    });
  }
  if (smartBooth) {
    await Booth.findByIdAndUpdate(smartBooth._id, {
      exhibitorProfileId: profileDocs[3]._id,
    });
  }

  ok(`${profileDocs.length} exhibitor profiles seeded.`);

  // ── Sessions ──────────────────────────────────────────────────────────────
  log('Seeding sessions…');
  const sessionDocs = [];

  for (const s of SESSION_DATA) {
    const expo = expoDocuments[s.expoIndex];

    const startTime = date(s.startOffset.days, s.startOffset.hours, s.startOffset.minutes);
    const endTime   = date(s.endOffset.days,   s.endOffset.hours,   s.endOffset.minutes);

    const session = await Session.create({
      expoId:      expo._id,
      title:       s.title,
      description: s.description,
      format:      s.format,
      location:    s.location,
      startTime,
      endTime,
      speakers:    s.speakers,
      maxCapacity: s.maxCapacity,
      tags:        s.tags,
      isFeatured:  s.isFeatured,
      isPublic:    true,
      createdBy:   adminUser._id,
      status:      'scheduled',
    });

    // Register some attendees
    const attendeesToAdd = attendeeUsers.slice(0, 2);
    session.attendees.push(
      ...attendeesToAdd.map((u) => ({ userId: u._id }))
    );

    // Add a bookmark from the first attendee
    session.bookmarkedBy.push(attendeeUsers[0]._id);

    await session.save();
    sessionDocs.push(session);
  }

  // Update expo session counts
  for (const expo of expoDocuments) {
    const count = sessionDocs.filter(
      (s) => s.expoId.toString() === expo._id.toString()
    ).length;
    await Expo.findByIdAndUpdate(expo._id, { sessionCount: count });
  }

  ok(`${sessionDocs.length} sessions seeded.`);

  // ── Messages ──────────────────────────────────────────────────────────────
  log('Seeding messages…');

  const messageThreads = [
    // Admin → Exhibitor 1 (Marcus)
    {
      senderId:   adminUser._id,
      receiverId: exhibitorUsers[0]._id,
      content:    'Hi Marcus, welcome to TechConnect Global 2026! Your booth A01 has been confirmed. Please ensure your display materials arrive by Day 1.',
    },
    {
      senderId:   exhibitorUsers[0]._id,
      receiverId: adminUser._id,
      content:    'Thank you Sarah! We\'re very excited to be part of TechConnect this year. Our team will be setting up on the morning of Day 1. Is early access available?',
    },
    {
      senderId:   adminUser._id,
      receiverId: exhibitorUsers[0]._id,
      content:    'Absolutely! Exhibitors can access the venue from 7:00 AM on Day 1 for setup. Security will be briefed to expect your team.',
      isRead:     true,
    },
    // Admin → Exhibitor 3 (Daniel — pending application)
    {
      senderId:   adminUser._id,
      receiverId: exhibitorUsers[2]._id,
      content:    'Hi Daniel, we\'ve received your application for HealthBridge Technologies. We are currently reviewing your documentation. We\'ll be in touch within 48 hours.',
    },
    {
      senderId:   exhibitorUsers[2]._id,
      receiverId: adminUser._id,
      content:    'Thank you for the update. Please let me know if any additional documents are needed. We\'re very keen to participate.',
    },
    // Attendee → Exhibitor 1 (James → Marcus)
    {
      senderId:   attendeeUsers[0]._id,
      receiverId: exhibitorUsers[0]._id,
      content:    'Hello! I\'ll be attending TechConnect and I\'m very interested in the EdgeVision SDK. Will you have a live demo at your booth?',
    },
    {
      senderId:   exhibitorUsers[0]._id,
      receiverId: attendeeUsers[0]._id,
      content:    'Hi James! Yes, we\'ll have a full live demo station running throughout all three days. Come by Booth A01 — we\'d love to show you what EdgeVision can do!',
      isRead:     false,
    },
  ];

  const messageDocs = await Promise.all(
    messageThreads.map((m) => Message.create(m))
  );

  ok(`${messageDocs.length} messages seeded.`);

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────────────');
  console.log('\x1b[32m✓ Seed complete!\x1b[0m');
  console.log('─────────────────────────────────────────────────');
  console.log('\nTest Accounts:');
  console.log('  Admin:     admin@eventsphere.io    / Admin@1234!');
  console.log('  Exhibitor: marcus@techvision.io    / Exhibitor@1234!');
  console.log('  Exhibitor: priya@greenenergy.co    / Exhibitor@1234!');
  console.log('  Exhibitor: daniel@healthtech.ng    / Exhibitor@1234!  (pending)');
  console.log('  Exhibitor: ling@smartmanufacture.cn / Exhibitor@1234!');
  console.log('  Attendee:  james@attendee.com      / Attendee@1234!');
  console.log('  Attendee:  amara@attendee.com      / Attendee@1234!');
  console.log('  Attendee:  carlos@attendee.com     / Attendee@1234!  (unverified)');
  console.log('\nData Summary:');
  console.log(`  Users:              ${users.length}`);
  console.log(`  Expos:              ${expoDocuments.length}`);
  console.log(`  Booths:             ${totalBooths}`);
  console.log(`  Exhibitor Profiles: ${profileDocs.length}`);
  console.log(`  Sessions:           ${sessionDocs.length}`);
  console.log(`  Messages:           ${messageDocs.length}`);
  console.log('─────────────────────────────────────────────────\n');

  await mongoose.connection.close();
  process.exit(0);
}

// ─── Run ──────────────────────────────────────────────────────────────────────
seed().catch((e) => {
  err(e.message);
  console.error(e.stack);
  process.exit(1);
});