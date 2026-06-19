'use strict';

const mongoose = require('mongoose');

// ─── Enums ────────────────────────────────────────────────────────────────────
const APPLICATION_STATUSES = Object.freeze(['pending', 'approved', 'rejected', 'suspended']);
const DOCUMENT_STATUSES    = Object.freeze(['pending', 'verified', 'rejected']);
const DOCUMENT_TYPES       = Object.freeze([
  'business_registration',
  'tax_certificate',
  'identity_document',
  'product_catalog',
  'insurance_certificate',
  'other',
]);

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const SocialLinksSchema = new mongoose.Schema(
  {
    website:   { type: String, trim: true, default: null, maxlength: 200 },
    linkedin:  { type: String, trim: true, default: null, maxlength: 200 },
    twitter:   { type: String, trim: true, default: null, maxlength: 200 },
    instagram: { type: String, trim: true, default: null, maxlength: 200 },
  },
  { _id: false }
);

const ContactPersonSchema = new mongoose.Schema(
  {
    name:     { type: String, trim: true, required: true, maxlength: 100 },
    title:    { type: String, trim: true, default: null, maxlength: 100 },
    email:    { type: String, trim: true, lowercase: true, required: true },
    phone:    { type: String, trim: true, default: null, maxlength: 30 },
  },
  { _id: false }
);

const UploadedDocumentSchema = new mongoose.Schema(
  {
    type: {
      type:     String,
      enum:     { values: DOCUMENT_TYPES, message: `Document type must be one of: ${DOCUMENT_TYPES.join(', ')}.` },
      required: true,
    },
    label:        { type: String, trim: true, maxlength: 100, default: null },
    fileUrl:      { type: String, required: true, trim: true },
    fileName:     { type: String, required: true, trim: true, maxlength: 255 },
    fileSizeBytes:{ type: Number, default: null },
    mimeType:     { type: String, trim: true, default: null },
    status: {
      type:    String,
      enum:    { values: DOCUMENT_STATUSES, message: `Document status must be one of: ${DOCUMENT_STATUSES.join(', ')}.` },
      default: 'pending',
    },
    reviewNote:   { type: String, trim: true, maxlength: 500, default: null },
    reviewedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt:   { type: Date, default: null },
    uploadedAt:   { type: Date, default: () => new Date() },
  },
  { _id: true }
);

const ApplicationHistoryEntrySchema = new mongoose.Schema(
  {
    fromStatus:   { type: String, enum: [...APPLICATION_STATUSES, 'new'] },
    toStatus:     { type: String, enum: APPLICATION_STATUSES },
    changedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    changedAt:    { type: Date, default: () => new Date() },
    reason:       { type: String, trim: true, maxlength: 500, default: null },
  },
  { _id: false }
);

const BoothAssignmentSchema = new mongoose.Schema(
  {
    boothId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Booth', required: true },
    expoId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Expo',  required: true },
    assignedAt:   { type: Date, default: () => new Date() },
    assignedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const ExhibitorProfileSchema = new mongoose.Schema(
  {
    userId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'User reference is required.'],
      unique:   true,
    },

    companyName: {
      type:      String,
      required:  [true, 'Company name is required.'],
      trim:      true,
      minlength: [2,   'Company name must be at least 2 characters.'],
      maxlength: [150, 'Company name must not exceed 150 characters.'],
    },

    companyNameSlug: {
      type:      String,
      lowercase: true,
      trim:      true,
    },

    tagline: {
      type:      String,
      trim:      true,
      maxlength: [200, 'Tagline must not exceed 200 characters.'],
      default:   null,
    },

    description: {
      type:      String,
      trim:      true,
      maxlength: [3000, 'Description must not exceed 3000 characters.'],
      default:   null,
    },

    industry: {
      type:      String,
      trim:      true,
      maxlength: [100, 'Industry must not exceed 100 characters.'],
      default:   null,
    },

    products: {
      type:     [String],
      default:  [],
      validate: {
        validator: (arr) => arr.length <= 30,
        message:   'Cannot list more than 30 products.',
      },
    },

    logo: {
      type:    String,
      default: null,
      trim:    true,
    },

    bannerImage: {
      type:    String,
      default: null,
      trim:    true,
    },

    contactPerson: {
      type:     ContactPersonSchema,
      required: [true, 'Primary contact person is required.'],
    },

    socialLinks: {
      type:    SocialLinksSchema,
      default: () => ({}),
    },

    applicationStatus: {
      type:    String,
      enum:    { values: APPLICATION_STATUSES, message: `Status must be one of: ${APPLICATION_STATUSES.join(', ')}.` },
      default: 'pending',
    },

    applicationNote: {
      type:      String,
      trim:      true,
      maxlength: [1000, 'Application note must not exceed 1000 characters.'],
      default:   null,
    },

    reviewedBy: {
      type:    mongoose.Schema.Types.ObjectId,
      ref:     'User',
      default: null,
    },

    reviewedAt: {
      type:    Date,
      default: null,
    },

    // Full audit trail of every status decision
    applicationHistory: {
      type:    [ApplicationHistoryEntrySchema],
      default: [],
      select:  false,
    },

    // Verification documents uploaded by the exhibitor
    documents: {
      type:    [UploadedDocumentSchema],
      default: [],
    },

    // All booth assignments across all expos
    assignedBooths: {
      type:    [BoothAssignmentSchema],
      default: [],
    },

    // Persisted across expos — allows exhibitors to be known repeat participants
    isVerified: {
      type:    Boolean,
      default: false,
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
ExhibitorProfileSchema.index({ userId: 1 });
ExhibitorProfileSchema.index({ applicationStatus: 1 });
ExhibitorProfileSchema.index({ companyNameSlug: 1 });
ExhibitorProfileSchema.index({ isVerified: 1 });
ExhibitorProfileSchema.index({ 'assignedBooths.expoId': 1 });
ExhibitorProfileSchema.index(
  { companyName: 'text', description: 'text', products: 'text', industry: 'text' },
  { weights: { companyName: 10, industry: 4, products: 3, description: 1 }, name: 'exhibitor_text_search' }
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
ExhibitorProfileSchema.virtual('isApproved').get(function () {
  return this.applicationStatus === 'approved';
});

ExhibitorProfileSchema.virtual('isPending').get(function () {
  return this.applicationStatus === 'pending';
});

ExhibitorProfileSchema.virtual('totalBooths').get(function () {
  return this.assignedBooths?.length ?? 0;
});

ExhibitorProfileSchema.virtual('allDocumentsVerified').get(function () {
  if (!this.documents || this.documents.length === 0) return false;
  return this.documents.every((doc) => doc.status === 'verified');
});

// ─── Pre-save: Slug Generation ────────────────────────────────────────────────
ExhibitorProfileSchema.pre('save', function (next) {
  if (!this.isModified('companyName')) return next();

  this.companyNameSlug = this.companyName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

  return next();
});

// ─── Pre-save: Sync profileIsComplete on User ─────────────────────────────────
ExhibitorProfileSchema.pre('save', async function (next) {
  // Mark the linked User's profileIsComplete once all critical fields are present
  if (
    this.isModified('companyName') ||
    this.isModified('contactPerson') ||
    this.isModified('description')
  ) {
    const isComplete =
      !!this.companyName &&
      !!this.contactPerson?.name &&
      !!this.contactPerson?.email &&
      !!this.description;

    if (isComplete) {
      try {
        const User = mongoose.model('User');
        await User.findByIdAndUpdate(this.userId, { profileIsComplete: true });
      } catch (_) {
        // Non-blocking — profile completion sync failure should not block save
      }
    }
  }
  return next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Transition application status with full audit context
ExhibitorProfileSchema.methods.transitionApplicationStatus = function (
  newStatus,
  reviewerUserId,
  reason = null
) {
  const allowed = {
    pending:   ['approved', 'rejected'],
    approved:  ['suspended'],
    rejected:  ['pending'],
    suspended: ['approved', 'rejected'],
  };

  if (!allowed[this.applicationStatus]?.includes(newStatus)) {
    throw new Error(
      `Invalid application status transition: ${this.applicationStatus} → ${newStatus}.`
    );
  }

  this.applicationHistory.push({
    fromStatus: this.applicationStatus,
    toStatus:   newStatus,
    changedBy:  reviewerUserId,
    reason,
  });

  this.applicationStatus = newStatus;
  this.reviewedBy        = reviewerUserId;
  this.reviewedAt        = new Date();
  this.applicationNote   = reason;

  if (newStatus === 'approved') this.isVerified = true;

  return this.save();
};

// Attach a booth assignment record
ExhibitorProfileSchema.methods.assignBooth = function (boothId, expoId, assignedByUserId) {
  const alreadyAssigned = this.assignedBooths.some(
    (ab) => ab.boothId.toString() === boothId.toString() &&
            ab.expoId.toString()  === expoId.toString()
  );

  if (alreadyAssigned) {
    throw new Error('This booth is already assigned to this exhibitor profile.');
  }

  this.assignedBooths.push({
    boothId,
    expoId,
    assignedBy: assignedByUserId,
  });

  return this.save();
};

// Remove a booth assignment record
ExhibitorProfileSchema.methods.unassignBooth = function (boothId, expoId) {
  const before = this.assignedBooths.length;

  this.assignedBooths = this.assignedBooths.filter(
    (ab) =>
      !(ab.boothId.toString() === boothId.toString() &&
        ab.expoId.toString()  === expoId.toString())
  );

  if (this.assignedBooths.length === before) {
    throw new Error('Booth assignment not found on this profile.');
  }

  return this.save();
};

// Update a single document's review status
ExhibitorProfileSchema.methods.reviewDocument = function (
  documentId,
  newStatus,
  reviewerUserId,
  note = null
) {
  const doc = this.documents.id(documentId);
  if (!doc) throw new Error('Document not found on this profile.');

  doc.status     = newStatus;
  doc.reviewNote = note;
  doc.reviewedBy = reviewerUserId;
  doc.reviewedAt = new Date();

  return this.save();
};

// ─── Static Methods ───────────────────────────────────────────────────────────
ExhibitorProfileSchema.statics.findByUserId = function (userId) {
  return this.findOne({ userId, isActive: true });
};

ExhibitorProfileSchema.statics.getPendingApplications = function (page = 1, limit = 20) {
  return this.find({ applicationStatus: 'pending', isActive: true })
    .populate('userId', 'name email createdAt')
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

ExhibitorProfileSchema.statics.getApplicationStatusCounts = function () {
  return this.aggregate([
    { $match: { isActive: true } },
    { $group: { _id: '$applicationStatus', count: { $sum: 1 } } },
    { $project: { status: '$_id', count: 1, _id: 0 } },
  ]);
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const ExhibitorProfile = mongoose.model('ExhibitorProfile', ExhibitorProfileSchema);

module.exports = ExhibitorProfile;
module.exports.APPLICATION_STATUSES = APPLICATION_STATUSES;
module.exports.DOCUMENT_STATUSES    = DOCUMENT_STATUSES;
module.exports.DOCUMENT_TYPES       = DOCUMENT_TYPES;