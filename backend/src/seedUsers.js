/**
 * EventSphere Management — Dedicated User/Role Seed Script
 *
 * Usage:
 * node src/seedUsers.js
 *
 * Seeded accounts:
 * admin@eventsphere.io      / Admin1234!
 * exhibitor@eventsphere.io  / Exhibitor1234!
 * exhibitor2@eventsphere.io / Exhibitor1234!
 * attendee@eventsphere.io   / Attendee1234!
 * attendee2@eventsphere.io  / Attendee1234!
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import argon2 from 'argon2';

// ─── Models ───────────────────────────────────────────────────────────────────
import User from './models/User.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const log  = (msg) => console.log(`\x1b[36m[seed-users]\x1b[0m ${msg}`);
const ok   = (msg) => console.log(`\x1b[32m[✓]\x1b[0m ${msg}`);
const err  = (msg) => console.error(`\x1b[31m[✗]\x1b[0m ${msg}`);

async function hashPassword(plain) {
  return argon2.hash(plain, { 
    type: argon2.argon2id, 
    memoryCost: 2 ** 16, 
    timeCost: 3, 
    parallelism: 1 
  });
}

// ─── Connect ──────────────────────────────────────────────────────────────────
async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    err('MONGODB_URI is not set in .env');
    process.exit(1);
  }
  await mongoose.connect(uri);
  ok(`Connected to MongoDB: ${mongoose.connection.host}`);
}

// ─── Main Execution ───────────────────────────────────────────────────────────
async function main() {
  console.log('\n\x1b[1m EventSphere Management — Role & User Baseline Seeder\x1b[0m\n');

  try {
    await connect();

    // Only wipe out the User collection
    log('Clearing existing users collection...');
    await User.deleteMany({});
    ok('User collection cleared.');

    log('Hashing role-specific passwords...');
    const adminPw     = await hashPassword('Admin1234!');
    const exhibitorPw = await hashPassword('Exhibitor1234!');
    const attendeePw  = await hashPassword('Attendee1234!');

    log('Inserting user credentials...');
    const users = await User.insertMany([
      {
        name: 'Alex Morgan',
        email: 'admin@eventsphere.io',
        password: adminPw,
        role: 'admin',
        isVerified: true,
        isActive: true,
      },
      {
        name: 'Sophia Chen',
        email: 'exhibitor@eventsphere.io',
        password: exhibitorPw,
        role: 'exhibitor',
        isVerified: true,
        isActive: true,
      },
      {
        name: 'Marcus Rivera',
        email: 'exhibitor2@eventsphere.io',
        password: exhibitorPw,
        role: 'exhibitor',
        isVerified: true,
        isActive: true,
      },
      {
        name: 'Priya Patel',
        email: 'attendee@eventsphere.io',
        password: attendeePw,
        role: 'attendee',
        isVerified: true,
        isActive: true,
      },
      {
        name: 'James Okafor',
        email: 'attendee2@eventsphere.io',
        password: attendeePw,
        role: 'attendee',
        isVerified: true,
        isActive: true,
      },
    ]);

    console.log('\n\x1b[1m\x1b[32m User baseline seed complete\x1b[0m\n');
    console.log('  Accounts injected into database:\n');
    console.log('  \x1b[36mAdmin\x1b[0m      admin@eventsphere.io       / Admin1234!');
    console.log('  \x1b[36mExhibitor\x1b[0m  exhibitor@eventsphere.io   / Exhibitor1234!');
    console.log('  \x1b[36mExhibitor\x1b[0m  exhibitor2@eventsphere.io  / Exhibitor1234!');
    console.log('  \x1b[36mAttendee\x1b[0m   attendee@eventsphere.io    / Attendee1234!');
    console.log('  \x1b[36mAttendee\x1b[0m   attendee2@eventsphere.io   / Attendee1234!\n');

  } catch (e) {
    err(e.message);
    console.error(e);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();