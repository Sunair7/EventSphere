'use strict';

const mongoose = require('mongoose');
const argon2   = require('argon2');
const crypto   = require('crypto');

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLES = Object.freeze(['admin', 'exhibitor', 'attendee']);

const ARGON2_OPTIONS = {
  type:        argon2.argon2id,
  memoryCost:  2 ** 16,   // 64 MB
  timeCost:    3,
  parallelism: 1,
};

// ─── Schema ───────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
    name: {
      type:      String,
      required:  [true, 'Full name is required.'],
      trim:      true,
      minlength: [2,  'Name must be at least 2 characters.'],
      maxlength: [100, 'Name must not exceed 100 characters.'],
    },

    email: {
      type:      String,
      required:  [true, 'Email address is required.'],
      unique:    true,
      lowercase: true,
      trim:      true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'Please provide a valid email address.',
      ],
    },

    password: {
      type:      String,
      required:  [true, 'Password is required.'],
      minlength: [8, 'Password must be at least 8 characters.'],
      select:    false,   // Never returned in queries by default
    },

    role: {
      type:     String,
      enum:     { values: ROLES, message: 'Role must be admin, exhibitor, or attendee.' },
      required: [true, 'User role is required.'],
    },

    profileIsComplete: {
      type:    Boolean,
      default: false,
    },

    avatar: {
      type:    String,
      default: null,
    },

    isActive: {
      type:    Boolean,
      default: true,
    },

    isEmailVerified: {
      type:    Boolean,
      default: false,
    },

    // ── Password Reset ──────────────────────────────────────────────────────
    passwordResetToken: {
      type:   String,
      select: false,
    },

    passwordResetExpiresAt: {
      type:   Date,
      select: false,
    },

    // ── Email Verification ──────────────────────────────────────────────────
    emailVerificationToken: {
      type:   String,
      select: false,
    },

    emailVerificationExpiresAt: {
      type:   Date,
      select: false,
    },

    // ── Security Audit ──────────────────────────────────────────────────────
    passwordChangedAt: {
      type:   Date,
      select: false,
    },

    lastLoginAt: {
      type:   Date,
      default: null,
    },

    failedLoginAttempts: {
      type:    Number,
      default: 0,
      select:  false,
    },

    lockedUntil: {
      type:   Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpiresAt;
        delete ret.emailVerificationToken;
        delete ret.emailVerificationExpiresAt;
        delete ret.passwordChangedAt;
        delete ret.failedLoginAttempts;
        delete ret.lockedUntil;
        delete ret.__v;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
UserSchema.index({ role: 1 });
UserSchema.index({ passwordResetToken: 1 }, { sparse: true });
UserSchema.index({ emailVerificationToken: 1 }, { sparse: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
UserSchema.virtual('isLocked').get(function () {
  return this.lockedUntil && this.lockedUntil > Date.now();
});

UserSchema.virtual('feedback', {
  ref: 'Feedback',
  localField: '_id',
  foreignField: 'userId',
});

// ─── Pre-save Hooks ───────────────────────────────────────────────────────────
// Hash password only when it has been modified (creation + explicit change)
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    this.password         = await argon2.hash(this.password, ARGON2_OPTIONS);
    this.passwordChangedAt = new Date(Date.now() - 1000); // Ensure JWTs issued before this are invalidated
    return next();
  } catch (err) {
    return next(err);
  }
});

// Deactivate account instead of hard-delete when removed via query
UserSchema.pre('findOneAndDelete', async function (next) {
  const filter = this.getFilter();
  await this.model.findOneAndUpdate(filter, { isActive: false });
  return next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Verify candidate password against stored Argon2id hash
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    throw new Error('Password field not selected. Use .select("+password") on the query.');
  }
  return argon2.verify(this.password, candidatePassword);
};

// Record successful login
UserSchema.methods.recordLogin = async function () {
  this.lastLoginAt          = new Date();
  this.failedLoginAttempts  = 0;
  this.lockedUntil          = undefined;
  return this.save({ validateBeforeSave: false });
};

// Increment failed login counter; lock account after 5 consecutive failures
UserSchema.methods.incrementFailedLogin = async function () {
  this.failedLoginAttempts += 1;

  if (this.failedLoginAttempts >= 5) {
    // Exponential back-off: lock doubles per threshold breach (max 24h)
    const lockMinutes = Math.min(
      Math.pow(2, this.failedLoginAttempts - 4) * 5,
      1440
    );
    this.lockedUntil = new Date(Date.now() + lockMinutes * 60 * 1000);
  }

  return this.save({ validateBeforeSave: false });
};

// Generate a cryptographically secure password-reset token
// Returns the raw token (sent in email) and stores the SHA-256 hash in DB
UserSchema.methods.createPasswordResetToken = function () {
  const rawToken  = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  this.passwordResetToken     = hashedToken;
  this.passwordResetExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  return rawToken;
};

// Generate a cryptographically secure email-verification token
UserSchema.methods.createEmailVerificationToken = function () {
  const rawToken    = crypto.randomBytes(32).toString('hex');
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  this.emailVerificationToken     = hashedToken;
  this.emailVerificationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  return rawToken;
};

// Invalidate all active access tokens issued before the last password change.
// Used in the auth guard: if JWT iat < passwordChangedAt → force re-login.
UserSchema.methods.wasPasswordChangedAfter = function (jwtIssuedAt) {
  if (!this.passwordChangedAt) return false;
  return Math.floor(this.passwordChangedAt.getTime() / 1000) > jwtIssuedAt;
};

// ─── Static Methods ───────────────────────────────────────────────────────────

// Lookup user by hashed reset token and ensure it hasn't expired
UserSchema.statics.findByResetToken = function (rawToken) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  return this.findOne({
    passwordResetToken:     hashedToken,
    passwordResetExpiresAt: { $gt: Date.now() },
    isActive:               true,
  }).select('+password +passwordResetToken +passwordResetExpiresAt +passwordChangedAt');
};

// Lookup user by hashed verification token and ensure it hasn't expired
UserSchema.statics.findByVerificationToken = function (rawToken) {
  const hashedToken = crypto
    .createHash('sha256')
    .update(rawToken)
    .digest('hex');

  return this.findOne({
    emailVerificationToken:     hashedToken,
    emailVerificationExpiresAt: { $gt: Date.now() },
    isActive:                   true,
  }).select('+emailVerificationToken +emailVerificationExpiresAt');
};

// Safe public projection — excludes all sensitive fields for list/profile endpoints
UserSchema.statics.publicFields = function () {
  return 'name email role avatar profileIsComplete isEmailVerified isActive lastLoginAt createdAt';
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const User = mongoose.model('User', UserSchema);

module.exports = User;
module.exports.ROLES = ROLES;