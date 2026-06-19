'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const AddressSchema = new mongoose.Schema(
  {
    venue:    { type: String, trim: true, default: null },
    street:   { type: String, trim: true, default: null },
    city:     { type: String, trim: true, required: [true, 'City is required.'] },
    state:    { type: String, trim: true, default: null },
    country:  { type: String, trim: true, required: [true, 'Country is required.'] },
    zipCode:  { type: String, trim: true, default: null },
  },
  { _id: false }
);

const FloorPlanConfigSchema = new mongoose.Schema(
  {
    rows:        { type: Number, required: true, min: [1, 'Floor plan must have at least 1 row.'],    max: [50, 'Floor plan cannot exceed 50 rows.'] },
    cols:        { type: Number, required: true, min: [1, 'Floor plan must have at least 1 column.'], max: [50, 'Floor plan cannot exceed 50 columns.'] },
    boothWidth:  { type: Number, default: 3, min: 1 },   // metres
    boothHeight: { type: Number, default: 3, min: 1 },   // metres
    aisleWidth:  { type: Number, default: 1.5, min: 0 }, // metres
  },
  { _id: false }
);

const BannerSchema = new mongoose.Schema(
  {
    url:      { type: String, default: null },
    altText:  { type: String, default: null },
  },
  { _id: false }
);

// ─── Expo Status Enum ─────────────────────────────────────────────────────────
const EXPO_STATUSES = Object.freeze(['draft', 'published', 'ongoing', 'completed', 'cancelled']);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const ExpoSchema = new mongoose.Schema(
  {
    title: {
      type:      String,
      required:  [true, 'Expo title is required.'],
      trim:      true,
      minlength: [3,   'Title must be at least 3 characters.'],
      maxlength: [150, 'Title must not exceed 150 characters.'],
    },

    slug: {
      type:      String,
      unique:    true,
      lowercase: true,
      trim:      true,
    },

    description: {
      type:      String,
      required:  [true, 'Expo description is required.'],
      trim:      true,
      minlength: [20,   'Description must be at least 20 characters.'],
      maxlength: [5000, 'Description must not exceed 5000 characters.'],
    },

    theme: {
      type:    String,
      trim:    true,
      default: null,
      maxlength: [100, 'Theme must not exceed 100 characters.'],
    },

    status: {
      type:    String,
      enum:    { values: EXPO_STATUSES, message: `Status must be one of: ${EXPO_STATUSES.join(', ')}.` },
      default: 'draft',
    },

    startDate: {
      type:     Date,
      required: [true, 'Expo start date is required.'],
    },

    endDate: {
      type:     Date,
      required: [true, 'Expo end date is required.'],
    },

    registrationDeadline: {
      type:    Date,
      default: null,
    },

    address: {
      type:     AddressSchema,
      required: [true, 'Expo address is required.'],
    },

    floorPlanConfig: {
      type:     FloorPlanConfigSchema,
      required: [true, 'Floor plan configuration is required.'],
    },

    banner: {
      type:    BannerSchema,
      default: () => ({}),
    },

    tags: {
      type:    [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 20,
        message:   'An expo cannot have more than 20 tags.',
      },
    },

    maxAttendees: {
      type:    Number,
      default: null,
      min:     [1, 'Max attendees must be at least 1.'],
    },

    isPublic: {
      type:    Boolean,
      default: true,
    },

    createdBy: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Expo creator is required.'],
    },

    // Denormalised counters — kept in sync via post-save hooks on child models
    boothCount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    sessionCount: {
      type:    Number,
      default: 0,
      min:     0,
    },

    attendeeCount: {
      type:    Number,
      default: 0,
      min:     0,
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
ExpoSchema.index({ slug: 1 });
ExpoSchema.index({ status: 1 });
ExpoSchema.index({ startDate: 1 });
ExpoSchema.index({ createdBy: 1 });
ExpoSchema.index({ tags: 1 });
ExpoSchema.index(
  { title: 'text', description: 'text', theme: 'text', tags: 'text' },
  { weights: { title: 10, theme: 5, tags: 3, description: 1 }, name: 'expo_text_search' }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
ExpoSchema.virtual('isRegistrationOpen').get(function () {
  if (!this.registrationDeadline) return this.status === 'published';
  return this.status === 'published' && new Date() <= this.registrationDeadline;
});

ExpoSchema.virtual('durationDays').get(function () {
  if (!this.startDate || !this.endDate) return null;
  return Math.ceil((this.endDate - this.startDate) / (1000 * 60 * 60 * 24));
});

ExpoSchema.virtual('isUpcoming').get(function () {
  return this.status === 'published' && new Date() < this.startDate;
});

ExpoSchema.virtual('isOngoing').get(function () {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate;
});

// ─── Pre-save Hook: Slug Generation ──────────────────────────────────────────
ExpoSchema.pre('save', async function (next) {
  if (!this.isModified('title') && this.slug) return next();

  const base = this.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

  let slug       = base;
  let counter    = 0;
  const Expo     = this.constructor;

  while (true) {
    const candidate = counter === 0 ? slug : `${slug}-${counter}`;
    // eslint-disable-next-line no-await-in-loop
    const conflict  = await Expo.findOne({ slug: candidate, _id: { $ne: this._id } }).lean();
    if (!conflict) {
      this.slug = candidate;
      break;
    }
    counter += 1;
  }

  return next();
});

// ─── Pre-save Validation: Date Ordering ───────────────────────────────────────
ExpoSchema.pre('save', function (next) {
  if (this.endDate <= this.startDate) {
    return next(new Error('End date must be after start date.'));
  }

  if (
    this.registrationDeadline &&
    this.registrationDeadline > this.startDate
  ) {
    return next(new Error('Registration deadline must be on or before the start date.'));
  }

  // Auto-transition status based on dates
  const now = new Date();
  if (this.status === 'published') {
    if (now >= this.startDate && now <= this.endDate) this.status = 'ongoing';
    else if (now > this.endDate)                       this.status = 'completed';
  }

  return next();
});

// ─── Static Methods ───────────────────────────────────────────────────────────
ExpoSchema.statics.findBySlug = function (slug) {
  return this.findOne({ slug: slug.toLowerCase().trim() });
};

ExpoSchema.statics.findPublished = function (filter = {}) {
  return this.find({ ...filter, status: { $in: ['published', 'ongoing'] }, isPublic: true });
};

// Increment/decrement denormalised counters safely
ExpoSchema.statics.incrementCounter = function (expoId, field, amount = 1) {
  return this.findByIdAndUpdate(expoId, { $inc: { [field]: amount } }, { new: true });
};

// ─── Instance Methods ─────────────────────────────────────────────────────────
ExpoSchema.methods.canBeEditedBy = function (userId, role) {
  if (role === 'admin') return true;
  return this.createdBy.toString() === userId.toString();
};

ExpoSchema.methods.publish = function () {
  if (this.status !== 'draft') {
    throw new Error(`Cannot publish an expo with status: ${this.status}.`);
  }
  this.status = 'published';
  return this.save();
};

ExpoSchema.methods.cancel = function () {
  if (['completed', 'cancelled'].includes(this.status)) {
    throw new Error(`Cannot cancel an expo with status: ${this.status}.`);
  }
  this.status = 'cancelled';
  return this.save();
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const Expo = mongoose.model('Expo', ExpoSchema);

module.exports = Expo;
module.exports.EXPO_STATUSES = EXPO_STATUSES;