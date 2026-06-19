'use strict';

const mongoose = require('mongoose');

// ─── Enums ────────────────────────────────────────────────────────────────────
const BOOTH_STATUSES  = Object.freeze(['available', 'pending', 'assigned']);
const BOOTH_SIZES     = Object.freeze(['small', 'medium', 'large', 'extra-large', 'custom']);
const BOOTH_TYPES     = Object.freeze(['standard', 'corner', 'island', 'peninsula', 'inline']);

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const GridCoordinatesSchema = new mongoose.Schema(
  {
    row: {
      type:     Number,
      required: [true, 'Grid row coordinate is required.'],
      min:      [0, 'Row must be 0 or greater.'],
    },
    col: {
      type:     Number,
      required: [true, 'Grid column coordinate is required.'],
      min:      [0, 'Column must be 0 or greater.'],
    },
    // Booths can span multiple grid cells (island / peninsula types)
    rowSpan: { type: Number, default: 1, min: 1, max: 4 },
    colSpan: { type: Number, default: 1, min: 1, max: 4 },
  },
  { _id: false }
);

const AmenitySchema = new mongoose.Schema(
  {
    power:      { type: Boolean, default: false },
    wifi:       { type: Boolean, default: false },
    water:      { type: Boolean, default: false },
    lighting:   { type: Boolean, default: false },
    storage:    { type: Boolean, default: false },
    carpeted:   { type: Boolean, default: false },
  },
  { _id: false }
);

const PricingSchema = new mongoose.Schema(
  {
    basePrice:    { type: Number, default: 0,    min: [0, 'Price cannot be negative.'] },
    currency:     { type: String, default: 'USD', trim: true, uppercase: true, maxlength: 3 },
    isPremium:    { type: Boolean, default: false },
  },
  { _id: false }
);

const StatusHistoryEntrySchema = new mongoose.Schema(
  {
    fromStatus:  { type: String, enum: [...BOOTH_STATUSES, 'new'] },
    toStatus:    { type: String, enum: BOOTH_STATUSES },
    changedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt:   { type: Date, default: () => new Date() },
    note:        { type: String, trim: true, maxlength: 300, default: null },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const BoothSchema = new mongoose.Schema(
  {
    expoId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Expo',
      required: [true, 'Expo reference is required.'],
    },

    boothNumber: {
      type:      String,
      required:  [true, 'Booth number is required.'],
      trim:      true,
      uppercase: true,
      maxlength: [20, 'Booth number must not exceed 20 characters.'],
      match:     [/^[A-Z0-9\-]+$/, 'Booth number may only contain letters, numbers, and hyphens.'],
    },

    label: {
      type:      String,
      trim:      true,
      maxlength: [60, 'Booth label must not exceed 60 characters.'],
      default:   null,
    },

    type: {
      type:    String,
      enum:    { values: BOOTH_TYPES, message: `Type must be one of: ${BOOTH_TYPES.join(', ')}.` },
      default: 'standard',
    },

    size: {
      type:    String,
      enum:    { values: BOOTH_SIZES, message: `Size must be one of: ${BOOTH_SIZES.join(', ')}.` },
      default: 'medium',
    },

    dimensions: {
      type:     String,
      required: [true, 'Booth dimensions are required (e.g. "3m x 3m").'],
      trim:     true,
      maxlength: [30, 'Dimensions string must not exceed 30 characters.'],
    },

    status: {
      type:    String,
      enum:    { values: BOOTH_STATUSES, message: `Status must be one of: ${BOOTH_STATUSES.join(', ')}.` },
      default: 'available',
    },

    assignedTo: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    // The exhibitor profile holding the active application for this booth
    exhibitorProfileId: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'ExhibitorProfile',
      default: null,
    },

    gridCoordinates: {
      type:     GridCoordinatesSchema,
      required: [true, 'Grid coordinates are required.'],
    },

    amenities: {
      type:    AmenitySchema,
      default: () => ({}),
    },

    pricing: {
      type:    PricingSchema,
      default: () => ({}),
    },

    description: {
      type:      String,
      trim:      true,
      maxlength: [500, 'Booth description must not exceed 500 characters.'],
      default:   null,
    },

    // Full audit trail of all status transitions
    statusHistory: {
      type:    [StatusHistoryEntrySchema],
      default: [],
      select:  false,
    },

    // Temporary optimistic UI lock — set when an exhibitor begins the
    // reservation flow; auto-expires so the node returns to available
    lockedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    lockedUntil: {
      type:    Date,
      default: null,
    },

    isActive: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Compound unique: one booth number per expo
BoothSchema.index({ expoId: 1, boothNumber: 1 }, { unique: true });

// Compound unique: one grid cell per expo (prevents overlapping assignments)
BoothSchema.index(
  { expoId: 1, 'gridCoordinates.row': 1, 'gridCoordinates.col': 1 },
  { unique: true }
);

BoothSchema.index({ expoId: 1, status: 1 });
BoothSchema.index({ assignedTo: 1 });
BoothSchema.index({ exhibitorProfileId: 1 });
BoothSchema.index({ lockedUntil: 1 }, { expireAfterSeconds: 0, sparse: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
BoothSchema.virtual('isLocked').get(function () {
  return this.lockedUntil && this.lockedUntil > new Date();
});

BoothSchema.virtual('isAvailableForSelection').get(function () {
  return this.status === 'available' && !this.isLocked && this.isActive;
});

// ─── Pre-save Hook: Status Transition Audit ───────────────────────────────────
BoothSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    const previousStatus = this._previousStatus || 'new';
      if (!this.statusHistory) this.statusHistory = [];

    this.statusHistory.push({
      fromStatus: previousStatus,
      toStatus:   this.status,
      changedBy:  this._changedBy || null,
      note:       this._statusNote || null,
    });

    // Clear transient fields used to carry context into the hook
    this._previousStatus = undefined;
    this._changedBy      = undefined;
    this._statusNote     = undefined;
  }

  // Auto-clear assignedTo when status reverts to available
  if (this.isModified('status') && this.status === 'available') {
    this.assignedTo         = null;
    this.exhibitorProfileId = null;
    this.lockedBy           = null;
    this.lockedUntil        = null;
  }

  return next();
});

// ─── Post-save Hook: Sync Expo boothCount ─────────────────────────────────────
BoothSchema.post('save', async function (doc) {
  if (doc.isNew) {
    try {
      const Expo = mongoose.model('Expo');
      await Expo.incrementCounter(doc.expoId, 'boothCount', 1);
    } catch (_) {
      // Non-blocking — counter sync failure should not affect the response
    }
  }
});

BoothSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    try {
      const Expo = mongoose.model('Expo');
      await Expo.incrementCounter(doc.expoId, 'boothCount', -1);
    } catch (_) {
      // Non-blocking
    }
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Acquire a soft lock for the UI reservation flow (30s default)
BoothSchema.methods.acquireLock = function (userId, durationMs = 30_000) {
  if (this.isLocked && this.lockedBy?.toString() !== userId.toString()) {
    throw new Error('This booth is currently being reserved by another user.');
  }
  this.lockedBy    = userId;
  this.lockedUntil = new Date(Date.now() + durationMs);
  return this.save({ validateBeforeSave: false });
};

// Release an existing soft lock
BoothSchema.methods.releaseLock = function () {
  this.lockedBy    = null;
  this.lockedUntil = null;
  return this.save({ validateBeforeSave: false });
};

// Transition status with full audit context
BoothSchema.methods.transitionStatus = function (newStatus, changedByUserId, note = null) {
  const allowed = {
    available: ['pending'],
    pending:   ['available', 'assigned'],
    assigned:  ['available'],
  };

  if (!allowed[this.status]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${this.status} → ${newStatus}. Allowed: ${(allowed[this.status] || []).join(', ')}.`
    );
  }

  this._previousStatus = this.status;
  this._changedBy      = changedByUserId;
  this._statusNote     = note;
  this.status          = newStatus;

  return this.save();
};

// ─── Static Methods ───────────────────────────────────────────────────────────

// Full floor plan grid for a given expo — used by the interactive map renderer
BoothSchema.statics.getFloorPlan = function (expoId) {
  return this.find({ expoId, isActive: true })
    .select('boothNumber label type size dimensions status assignedTo gridCoordinates amenities pricing lockedUntil lockedBy isActive')
    .populate('assignedTo', 'name email')
    .lean();
};

// Release all expired optimistic locks — called by a scheduled job or on-demand
BoothSchema.statics.releaseExpiredLocks = function () {
  return this.updateMany(
    { lockedUntil: { $lte: new Date() }, status: 'available' },
    { $set: { lockedBy: null, lockedUntil: null } }
  );
};

// Aggregate availability summary for an expo dashboard card
BoothSchema.statics.getAvailabilitySummary = function (expoId) {
  return this.aggregate([
    { $match: { expoId: new mongoose.Types.ObjectId(expoId), isActive: true } },
    {
      $group: {
        _id:       '$status',
        count:     { $sum: 1 },
        premium:   { $sum: { $cond: ['$pricing.isPremium', 1, 0] } },
        totalValue: { $sum: '$pricing.basePrice' },
      },
    },
    {
      $project: {
        status:     '$_id',
        count:      1,
        premium:    1,
        totalValue: 1,
        _id:        0,
      },
    },
  ]);
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const Booth = mongoose.model('Booth', BoothSchema);

module.exports = Booth;
module.exports.BOOTH_STATUSES = BOOTH_STATUSES;
module.exports.BOOTH_SIZES    = BOOTH_SIZES;
module.exports.BOOTH_TYPES    = BOOTH_TYPES;