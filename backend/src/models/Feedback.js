'use strict';

const mongoose = require('mongoose');

// ─── Enums ────────────────────────────────────────────────────────────────────
const FEEDBACK_STATUSES = Object.freeze([
  'pending',    // Awaiting admin moderation
  'approved',   // Visible to everyone
  'rejected',   // Hidden, rejected by admin
]);

// ─── Schema ───────────────────────────────────────────────────────────────────
const FeedbackSchema = new mongoose.Schema(
  {
    // Which session this feedback is for
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: [true, 'Session ID is required.'],
      index: true,
    },

    // Who wrote the feedback
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required.'],
      index: true,
    },

    // Rating (1-5 stars)
    rating: {
      type: Number,
      required: [true, 'Rating is required.'],
      min: [1, 'Rating must be at least 1 star.'],
      max: [5, 'Rating cannot exceed 5 stars.'],
    },

    // Optional comment
    comment: {
      type: String,
      trim: true,
      maxlength: [1000, 'Comment must not exceed 1000 characters.'],
      default: null,
    },

    // Moderation status
    status: {
      type: String,
      enum: {
        values: FEEDBACK_STATUSES,
        message: `Status must be one of: ${FEEDBACK_STATUSES.join(', ')}.`,
      },
      default: 'pending',
      index: true,
    },

    // Admin who reviewed this feedback
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Rejection reason must not exceed 500 characters.'],
      default: null,
    },

    // Anonymity
    isAnonymous: {
      type: Boolean,
      default: false,
    },

    // Track if feedback was edited
    isEdited: {
      type: Boolean,
      default: false,
    },

    editedAt: {
      type: Date,
      default: null,
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
FeedbackSchema.index({ sessionId: 1, status: 1 });
FeedbackSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
FeedbackSchema.index({ status: 1, createdAt: -1 });
FeedbackSchema.index({ sessionId: 1, rating: 1 });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
FeedbackSchema.virtual('isPending').get(function () {
  return this.status === 'pending';
});

FeedbackSchema.virtual('isApproved').get(function () {
  return this.status === 'approved';
});

FeedbackSchema.virtual('isRejected').get(function () {
  return this.status === 'rejected';
});

FeedbackSchema.virtual('displayName').get(function () {
  if (this.isAnonymous) return 'Anonymous';
  return this._user?.name || 'Unknown';
});

// ─── Pre-save Hooks ───────────────────────────────────────────────────────────
FeedbackSchema.pre('save', function (next) {
  // If status is changing to approved, set reviewedAt
  if (this.isModified('status') && this.status === 'approved') {
    this.reviewedAt = new Date();
  }

  // If comment is modified and document already exists, mark as edited
  if (this.isModified('comment') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }

  return next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Check if a user can edit this feedback
FeedbackSchema.methods.canEdit = function (userId) {
  // Only the author can edit, and only if not rejected
  if (this.userId.toString() !== userId.toString()) return false;
  if (this.status === 'rejected') return false;
  return true;
};

// Check if a user can delete this feedback
FeedbackSchema.methods.canDelete = function (userId, userRole) {
  // Author can delete, or admin can delete
  if (this.userId.toString() === userId.toString()) return true;
  if (userRole === 'admin') return true;
  return false;
};

// ─── Static Methods ───────────────────────────────────────────────────────────

// Get all feedback for a session (only approved for public)
FeedbackSchema.statics.getForSession = function (sessionId, options = {}) {
  const { includePending = false, userId = null } = options;

  const query = { sessionId };

  if (!includePending) {
    query.status = 'approved';
  }

  return this.find(query)
    .populate('userId', 'name avatar')
    .sort({ createdAt: -1 })
    .lean();
};

// Get a user's feedback for a session
FeedbackSchema.statics.getUserFeedback = function (sessionId, userId) {
  return this.findOne({
    sessionId,
    userId,
  }).lean();
};

// Get average rating for a session
FeedbackSchema.statics.getAverageRating = async function (sessionId) {
  const result = await this.aggregate([
    { $match: { sessionId, status: 'approved' } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 },
        ratings: { $push: '$rating' },
      },
    },
  ]);

  if (result.length === 0) {
    return { average: 0, count: 0 };
  }

  return {
    average: Math.round(result[0].average * 10) / 10,
    count: result[0].count,
    ratings: result[0].ratings,
  };
};

// Get rating distribution for a session
FeedbackSchema.statics.getRatingDistribution = async function (sessionId) {
  const result = await this.aggregate([
    { $match: { sessionId, status: 'approved' } },
    {
      $group: {
        _id: '$rating',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: -1 } },
  ]);

  const distribution = {};
  for (let i = 1; i <= 5; i++) {
    const found = result.find((r) => r._id === i);
    distribution[i] = found ? found.count : 0;
  }

  return distribution;
};

// Get pending feedback for admin moderation
FeedbackSchema.statics.getPendingFeedback = function (page = 1, limit = 20) {
  return this.find({ status: 'pending' })
    .populate('userId', 'name email avatar')
    .populate('sessionId', 'title expoId')
    .sort({ createdAt: 1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

// Get feedback for sessions where user is a speaker/exhibitor
FeedbackSchema.statics.getFeedbackForSpeaker = async function (userId, options = {}) {
  const { page = 1, limit = 20, status = 'approved' } = options;

  // First, find all sessions where this user is a speaker
  const Session = mongoose.model('Session');
  const sessions = await Session.find({
    'speakers.userId': userId,
  }).select('_id title');

  const sessionIds = sessions.map((s) => s._id);

  if (sessionIds.length === 0) {
    return { feedback: [], pagination: { total: 0, page, limit, totalPages: 0 } };
  }

  const query = { sessionId: { $in: sessionIds } };
  if (status) query.status = status;

  const feedback = await this.find(query)
    .populate('userId', 'name avatar')
    .populate('sessionId', 'title')
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const total = await this.countDocuments(query);

  return {
    feedback,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    sessions,
  };
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const Feedback = mongoose.model('Feedback', FeedbackSchema);

module.exports = Feedback;
module.exports.FEEDBACK_STATUSES = FEEDBACK_STATUSES;