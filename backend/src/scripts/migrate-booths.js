'use strict';

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Import models
const Booth = require('../models/Booth');
const Expo = require('../models/Expo');

// ─── Migration Script ──────────────────────────────────────────────────────────
async function migrateBooths() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    console.log('🔄 Starting booth migration...');

    // Get all booths
    const booths = await Booth.find({});
    console.log(`📊 Found ${booths.length} booths to migrate`);

    let updated = 0;
    let skipped = 0;

    for (const booth of booths) {
      let needsUpdate = false;
      const updateData = {};

      // Add reservation fields if missing
      if (booth.reservationLocked === undefined) {
        updateData.reservationLocked = false;
        needsUpdate = true;
      }

      if (booth.reservationExpiresAt === undefined) {
        updateData.reservationExpiresAt = null;
        needsUpdate = true;
      }

      if (booth.lockedBy === undefined) {
        updateData.lockedBy = null;
        needsUpdate = true;
      }

      if (booth.assignedAt === undefined) {
        // If booth is assigned, set assignedAt to createdAt
        if (booth.status === 'assigned') {
          updateData.assignedAt = booth.createdAt || new Date();
        } else {
          updateData.assignedAt = null;
        }
        needsUpdate = true;
      }

      // Add pricing if missing
      if (!booth.pricing || Object.keys(booth.pricing).length === 0) {
        // Check if expo has booth pricing
        const expo = await Expo.findById(booth.expoId);
        if (expo) {
          updateData.pricing = {
            basePrice: expo.boothPrice || 0,
            currency: expo.boothCurrency || 'USD',
            isPremium: booth.isPremium || false,
            premiumMultiplier: 1.0,
          };
        } else {
          updateData.pricing = {
            basePrice: 0,
            currency: 'USD',
            isPremium: false,
            premiumMultiplier: 1.0,
          };
        }
        needsUpdate = true;
      }

      // Add history if missing
      if (!booth.history || booth.history.length === 0) {
        updateData.history = [
          {
            status: booth.status,
            userId: booth.assignedTo || booth.createdBy || null,
            changedAt: booth.createdAt || new Date(),
            note: 'Initial booth state (migration)',
          },
        ];
        needsUpdate = true;
      }

      // Add isDeleted if missing
      if (booth.isDeleted === undefined) {
        updateData.isDeleted = false;
        needsUpdate = true;
      }

      // Add dimensions/size/type if missing
      if (!booth.dimensions) {
        updateData.dimensions = '3m x 3m';
        needsUpdate = true;
      }

      if (!booth.size) {
        updateData.size = 'Standard';
        needsUpdate = true;
      }

      if (!booth.type) {
        updateData.type = 'Standard';
        needsUpdate = true;
      }

      // Clean up expired locks
      if (booth.reservationLocked && booth.reservationExpiresAt) {
        const now = new Date();
        if (now >= booth.reservationExpiresAt) {
          updateData.reservationLocked = false;
          updateData.reservationExpiresAt = null;
          if (booth.status === 'pending') {
            updateData.status = 'available';
          }
          // Add to history
          if (!updateData.history) {
            updateData.history = booth.history || [];
          }
          updateData.history.push({
            status: 'available',
            userId: booth.lockedBy || null,
            changedAt: new Date(),
            note: 'Expired lock cleaned up during migration',
          });
          needsUpdate = true;
        }
      }

      // Apply updates
      if (needsUpdate) {
        await Booth.updateOne({ _id: booth._id }, { $set: updateData });
        updated++;
        console.log(`✅ Updated booth ${booth.boothNumber} (${booth._id})`);
      } else {
        skipped++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Updated: ${updated} booths`);
    console.log(`   ⏭️  Skipped: ${skipped} booths`);
    console.log(`   📊 Total:   ${booths.length} booths`);

    // Create indexes
    console.log('\n🔄 Creating indexes...');
    await Booth.createIndexes();
    console.log('✅ Indexes created successfully');

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the migration
migrateBooths();