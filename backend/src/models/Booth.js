'use strict';

const mongoose = require('mongoose');

// ─── Enums ────────────────────────────────────────────────────────────────────
const BOOTH_STATUSES = Object.freeze([
  'available',    // Free to reserve
  'pending',      // Reserved but not yet confirmed (payment pending)
  'assigned',     // Confirmed and assigned to exhibitor
  'maintenance',  // Temporarily unavailable
]);

const BOOTH_SIZES = Object.freeze([
  'Standard',
  'Large',
  'Premium',
  'Corner',
  'Island',
  'Double',
]);

const BOOTH_TYPES = Object.freeze([
  'Standard',
  'Premium',
  'Corner',
  'Island',
  'Double',
  'Custom',
]);

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const AmenitiesSchema = new mongoose.Schema(
  {
    power: { type: Boolean, default: false },
    wifi: { type: Boolean, default: false },
    water: { type: Boolean, default: false },
    lighting: { type: Boolean, default: false },
    storage: { type: Boolean, default: false },
    carpeted: { type: Boolean, default: false },
  },
  { _id: false }
);

const PricingSchema = new mongoose.Schema(
  {
    basePrice: {
      type: Number,
      default: 0,
      min: 0,
      description: 'Price in cents',
    },
    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP'],
    },
    isPremium: {
      type: Boolean,
      default: false,
      description: 'Whether this booth is premium priced',
    },
    premiumMultiplier: {
      type: Number,
      default: 1.0,
      min: 0.5,
      max: 2.0,
      description: 'Multiplier for premium booths',
    },
  },
  { _id: false }
);

const GridCoordinatesSchema = new mongoose.Schema(
  {
    row: {
      type: Number,
      required: true,
      min: 0,
    },
    col: {
      type: Number,
      required: true,
      min: 0,
    },
    rowSpan: {
      type: Number,
      default: 1,
      min: 1,
      max: 4,
    },
    colSpan: {
      type: Number,
      default: 1,
      min: 1,
      max: 4,
    },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const BoothSchema = new mongoose.Schema(
  {
    expoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expo',
      required: [true, 'Expo reference is required.'],
      index: true,
    },

    boothNumber: {
      type: String,
      required: [true, 'Booth number is required.'],
      trim: true,
      uppercase: true,
      maxlength: [20, 'Booth number must not exceed 20 characters.'],
    },

    // Grid position within the expo floor plan
    gridCoordinates: {
      type: GridCoordinatesSchema,
      required: [true, 'Grid coordinates are required.'],
    },

    status: {
      type: String,
      enum: {
        values: BOOTH_STATUSES,
        message: `Status must be one of: ${BOOTH_STATUSES.join(', ')}.`,
      },
      default: 'available',
      index: true,
    },

    // Assigned exhibitor (when status is 'assigned' or 'pending')
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    assignedAt: {
      type: Date,
      default: null,
    },

    // For pending reservations - lock the booth during payment flow
    reservationLocked: {
      type: Boolean,
      default: false,
    },

    reservationExpiresAt: {
      type: Date,
      default: null,
    },

    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Pricing (overrides expo default if set)
    pricing: {
      type: PricingSchema,
      default: () => ({}),
    },

    dimensions: {
      type: String,
      trim: true,
      maxlength: [50, 'Dimensions must not exceed 50 characters.'],
      default: '3m x 3m',
    },

    size: {
      type: String,
      enum: {
        values: BOOTH_SIZES,
        message: `Size must be one of: ${BOOTH_SIZES.join(', ')}.`,
      },
      default: 'Standard',
    },

    type: {
      type: String,
      enum: {
        values: BOOTH_TYPES,
        message: `Type must be one of: ${BOOTH_TYPES.join(', ')}.`,
      },
      default: 'Standard',
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description must not exceed 500 characters.'],
      default: null,
    },

    label: {
      type: String,
      trim: true,
      maxlength: [60, 'Label must not exceed 60 characters.'],
      default: null,
    },

    amenities: {
      type: AmenitiesSchema,
      default: () => ({}),
    },

    isPremium: {
      type: Boolean,
      default: false,
    },

    // Additional metadata
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes must not exceed 1000 characters.'],
      default: null,
    },

    // Track booth history (for audit)
    history: {
      type: [
        {
          status: {
            type: String,
            enum: {
              values: BOOTH_STATUSES,
              message: `Status must be one of: ${BOOTH_STATUSES.join(', ')}.`,
            },
          },
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
          changedAt: {
            type: Date,
            default: () => new Date(),
          },
          note: {
            type: String,
            trim: true,
            maxlength: [500, 'Note must not exceed 500 characters.'],
            default: null,
          },
        },
      ],
      default: [],
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.isDeleted;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
BoothSchema.index({ expoId: 1, boothNumber: 1 }, { unique: true });
BoothSchema.index({ expoId: 1, status: 1 });
BoothSchema.index({ expoId: 1, 'gridCoordinates.row': 1, 'gridCoordinates.col': 1 }, { unique: true });
BoothSchema.index({ assignedTo: 1, status: 1 });
BoothSchema.index({ expoId: 1, isPremium: 1 });
BoothSchema.index({ reservationExpiresAt: 1 }, { sparse: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
BoothSchema.virtual('isAvailable').get(function () {
  return this.status === 'available' && !this.reservationLocked;
});

BoothSchema.virtual('isReserved').get(function () {
  return this.status === 'pending' && this.reservationLocked;
});

BoothSchema.virtual('isAssigned').get(function () {
  return this.status === 'assigned';
});

BoothSchema.virtual('isLocked').get(function () {
  return this.reservationLocked && this.reservationExpiresAt && new Date() < this.reservationExpiresAt;
});

BoothSchema.virtual('isLockExpired').get(function () {
  return this.reservationLocked && this.reservationExpiresAt && new Date() >= this.reservationExpiresAt;
});

BoothSchema.virtual('displayPrice').get(function () {
  const price = this.pricing?.basePrice ?? 0;
  if (this.pricing?.isPremium && this.pricing?.premiumMultiplier) {
    return Math.round(price * this.pricing.premiumMultiplier);
  }
  return price;
});

BoothSchema.virtual('displayCurrency').get(function () {
  return this.pricing?.currency || 'USD';
});

BoothSchema.virtual('displayPriceFormatted').get(function () {
  const price = this.displayPrice;
  const currency = this.displayCurrency;
  return `${currency} $${(price / 100).toFixed(2)}`;
});

// ─── Pre-save Hooks ───────────────────────────────────────────────────────────

// Auto-generate booth number if not provided
BoothSchema.pre('save', async function (next) {
  if (this.isNew && !this.boothNumber) {
    const count = await this.constructor.countDocuments({ expoId: this.expoId });
    this.boothNumber = `B${String(count + 1).padStart(3, '0')}`;
  }
  return next();
});

// Auto-cleanup expired locks before save
BoothSchema.pre('save', function (next) {
  if (this.reservationLocked && this.reservationExpiresAt && new Date() >= this.reservationExpiresAt) {
    this.reservationLocked = false;
    this.reservationExpiresAt = null;
    if (this.status === 'pending') {
      this.status = 'available';
    }
  }
  return next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Reserve a booth (start the payment flow)
BoothSchema.methods.reserve = async function (userId, expiresInMinutes = 15) {
  if (this.status !== 'available') {
    throw new Error(`Booth is already ${this.status}.`);
  }

  if (this.reservationLocked) {
    throw new Error('Booth is currently locked by another user.');
  }

  // ✅ Initialize history if it doesn't exist
  if (!this.history) {
    this.history = [];
  }

  // Add to history
  this.history.push({
    status: 'pending',
    userId,
    note: 'Booth reserved, awaiting payment',
  });

  this.status = 'pending';
  this.assignedTo = userId;
  this.reservationLocked = true;
  this.lockedBy = userId;
  this.reservationExpiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  return this.save();
};

// Confirm a booth reservation (after successful payment)
BoothSchema.methods.confirm = async function (userId) {
  if (this.status !== 'pending') {
    throw new Error(`Cannot confirm a booth with status: ${this.status}.`);
  }

  if (this.assignedTo?.toString() !== userId.toString()) {
    throw new Error('You are not the reserving party for this booth.');
  }

  // ✅ Initialize history FIRST
  if (!this.history) {
    this.history = [];
  }

  this.history.push({
    status: 'assigned',
    userId,
    note: 'Booth confirmed after successful payment',
  });

  this.status = 'assigned';
  this.reservationLocked = false;
  this.reservationExpiresAt = null;
  this.lockedBy = null;
  this.assignedAt = new Date();

  return this.save();
};
// Cancel a reservation (before payment)
BoothSchema.methods.cancelReservation = async function (userId, reason = null) {
  if (this.status !== 'pending') {
    throw new Error(`Cannot cancel a booth with status: ${this.status}.`);
  }

  // ✅ Initialize history FIRST
  if (!this.history) {
    this.history = [];
  }

  // Then push to it
  this.history.push({
    status: 'available',
    userId,
    note: reason || 'Reservation cancelled',
  });

  this.status = 'available';
  this.assignedTo = null;
  this.reservationLocked = false;
  this.reservationExpiresAt = null;
  this.lockedBy = null;
  this.assignedAt = null;

  return this.save();
};

// Release a booth (for admin - force release)
BoothSchema.methods.release = async function (adminId, reason = null) {
  if (this.status === 'available') {
    throw new Error('Booth is already available.');
  }

  // ✅ Initialize history FIRST
  if (!this.history) {
    this.history = [];
  }

  this.history.push({
    status: 'available',
    userId: adminId,
    note: reason || 'Booth force-released by admin',
  });

  this.status = 'available';
  this.assignedTo = null;
  this.reservationLocked = false;
  this.reservationExpiresAt = null;
  this.lockedBy = null;
  this.assignedAt = null;

  return this.save();
};

// Clean up expired locks (called by cron job)
BoothSchema.methods.cleanupExpiredLock = async function () {
  if (this.reservationLocked && this.reservationExpiresAt && new Date() >= this.reservationExpiresAt) {
    // ✅ Initialize history if it doesn't exist
    if (!this.history) {
      this.history = [];
    }
    
    return this.cancelReservation(
      this.lockedBy,
      'Reservation expired - payment not completed within time limit'
    );
  }
  return this;
};
// Check if a user can reserve this booth
BoothSchema.methods.canReserve = function (userId) {
  if (this.status !== 'available') {
    return { allowed: false, reason: `Booth is already ${this.status}` };
  }

  if (this.reservationLocked) {
    return { allowed: false, reason: 'Booth is currently locked' };
  }

  if (this.assignedTo && this.status === 'assigned') {
    return { allowed: false, reason: 'Booth is already assigned' };
  }

  return { allowed: true };
};

// Check if a user owns this booth
BoothSchema.methods.isOwnedBy = function (userId) {
  if (!userId || !this.assignedTo) return false;
  return this.assignedTo.toString() === userId.toString();
};

// ─── Static Methods ───────────────────────────────────────────────────────────

// Get all available booths for an expo
BoothSchema.statics.getAvailableBooths = function (expoId) {
  return this.find({
    expoId,
    status: 'available',
    reservationLocked: false,
    isDeleted: false,
  }).sort({ 'gridCoordinates.row': 1, 'gridCoordinates.col': 1 });
};

// Get all pending booths for an expo (reserved but not confirmed)
BoothSchema.statics.getPendingBooths = function (expoId) {
  return this.find({
    expoId,
    status: 'pending',
    isDeleted: false,
  }).populate('assignedTo', 'name email avatar');
};

// Get all assigned booths for an expo
BoothSchema.statics.getAssignedBooths = function (expoId) {
  return this.find({
    expoId,
    status: 'assigned',
    isDeleted: false,
  }).populate('assignedTo', 'name email avatar company');
};

// Get booths assigned to a specific user
BoothSchema.statics.getUserBooths = function (userId, expoId = null) {
  const query = {
    assignedTo: userId,
    status: { $in: ['pending', 'assigned'] },
    isDeleted: false,
  };
  if (expoId) query.expoId = expoId;
  return this.find(query).populate('expoId', 'title startDate endDate');
};

// Get floor plan layout for an expo (grid view)
BoothSchema.statics.getFloorPlan = function (expoId) {
  return this.find({
    expoId,
    isDeleted: false,
  })
    .populate('assignedTo', 'name avatar email')
    .sort({ 'gridCoordinates.row': 1, 'gridCoordinates.col': 1 })
    .lean();
};

// Get booth count by status for an expo
BoothSchema.statics.getStatusCounts = function (expoId) {
  return this.aggregate([
    { $match: { expoId: new mongoose.Types.ObjectId(expoId), isDeleted: false } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);
};

// Availability summary for analytics (status breakdown + revenue per status)
BoothSchema.statics.getAvailabilitySummary = async function (expoId) {
  const oid = new mongoose.Types.ObjectId(expoId);
  const rows = await this.aggregate([
    { $match: { expoId: oid, isDeleted: false } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalValue: {
          $sum: {
            $cond: [{ $eq: ['$status', 'assigned'] }, '$pricing.basePrice', 0],
          },
        },
      },
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        totalValue: 1,
        _id: 0,
      },
    },
  ]);

  return rows;
};

// Format booth number consistently (e.g. A01, B12)
BoothSchema.statics.formatBoothNumber = function (row, col) {
  return `${String.fromCharCode(65 + row)}${String(col + 1).padStart(2, '0')}`;
};

// Find a booth by its grid coordinates
BoothSchema.statics.findByCoordinates = function (expoId, row, col) {
  return this.findOne({
    expoId,
    'gridCoordinates.row': row,
    'gridCoordinates.col': col,
    isDeleted: false,
  });
};

// Clean up all expired locks (called by cron job)
BoothSchema.statics.cleanupExpiredLocks = async function () {
  const now = new Date();
  const expired = await this.find({
    reservationLocked: true,
    reservationExpiresAt: { $lt: now },
    isDeleted: false,
  });

  const results = [];
  for (const booth of expired) {
    results.push(await booth.cleanupExpiredLock());
  }

  return results;
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const Booth = mongoose.model('Booth', BoothSchema);

// ⬇️ EXPORT EVERYTHING
module.exports = Booth;
module.exports.BOOTH_STATUSES = BOOTH_STATUSES;
module.exports.BOOTH_SIZES = BOOTH_SIZES;
module.exports.BOOTH_TYPES = BOOTH_TYPES;