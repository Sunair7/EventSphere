'use strict';

const mongoose = require('mongoose');

// ─── Enums ────────────────────────────────────────────────────────────────────
const PAYMENT_STATUSES = Object.freeze([
  'pending',      // Created but not paid
  'paid',         // Payment successful
  'failed',       // Payment failed
  'refunded',     // Refunded
  'cancelled',    // Cancelled by user or expired
]);

const PAYMENT_METHODS = Object.freeze([
  'stripe',
  'paypal',
  'mock',         // For development
  'on_site',      // Pay at venue
]);

const TRANSACTION_TYPES = Object.freeze([
  'booth_reservation',
  'session_registration',
]);

// ─── Schema ───────────────────────────────────────────────────────────────────
const TransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: {
        values: TRANSACTION_TYPES,
        message: `Type must be one of: ${TRANSACTION_TYPES.join(', ')}.`,
      },
      required: true,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'referenceModel',
    },

    referenceModel: {
      type: String,
      enum: ['Booth', 'Session'],
      required: true,
    },

    expoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expo',
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
      description: 'Amount in cents',
    },

    currency: {
      type: String,
      default: 'USD',
      enum: ['USD', 'EUR', 'GBP'],
    },

    status: {
      type: String,
      enum: {
        values: PAYMENT_STATUSES,
        message: `Status must be one of: ${PAYMENT_STATUSES.join(', ')}.`,
      },
      default: 'pending',
    },

    paymentMethod: {
      type: String,
      enum: {
        values: PAYMENT_METHODS,
        message: `Payment method must be one of: ${PAYMENT_METHODS.join(', ')}.`,
      },
      default: null,
    },

    providerTransactionId: {
      type: String,
      trim: true,
      default: null,
    },

    providerMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    invoiceNumber: {
      type: String,
      trim: true,
      default: null,
      // ✅ NO unique: true here
    },

    receiptUrl: {
      type: String,
      trim: true,
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    refundReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.providerMetadata;
        return ret;
      },
    },
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
TransactionSchema.index({ userId: 1, status: 1, createdAt: -1 });
TransactionSchema.index({ referenceId: 1, type: 1 });
TransactionSchema.index({ expoId: 1, status: 1 });
// Only auto-delete expired *pending* transactions — paid records must be kept for history
TransactionSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 0, partialFilterExpression: { status: 'pending' } }
);
// ✅ REMOVED: TransactionSchema.index({ invoiceNumber: 1 }, { unique: true, sparse: true });

// ─── Virtuals ─────────────────────────────────────────────────────────────────
TransactionSchema.virtual('isExpired').get(function () {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
});

TransactionSchema.virtual('isPending').get(function () {
  return this.status === 'pending';
});

TransactionSchema.virtual('displayAmount').get(function () {
  return (this.amount / 100).toFixed(2);
});

// ─── Pre-save Hooks ───────────────────────────────────────────────────────────
TransactionSchema.pre('save', function (next) {
  if (this.isNew && this.status === 'pending' && !this.expiresAt) {
    this.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  }

  // Only generate invoiceNumber on explicit transition TO 'paid', never on pending/cancelled
  if (this.isModified('status') && this.status === 'paid' && !this.invoiceNumber) {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = require('crypto').randomBytes(4).toString('hex').toUpperCase();
    this.invoiceNumber = `EVT-${date}-${random}`;
  }

  // Clear invoiceNumber on cancellation so it doesn't block future transactions
  if (this.isModified('status') && this.status === 'cancelled') {
    this.invoiceNumber = null;
  }

  return next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

TransactionSchema.methods.markAsPaid = async function (paymentMethod, providerTransactionId = null) {
  if (this.status !== 'pending') {
    throw new Error(`Cannot mark transaction as paid. Current status: ${this.status}`);
  }

  this.status = 'paid';
  this.paymentMethod = paymentMethod;
  this.providerTransactionId = providerTransactionId;
  this.paidAt = new Date();
  this.expiresAt = null;

  return this.save();
};

TransactionSchema.methods.markAsFailed = function (reason) {
  this.status = 'failed';
  this.cancellationReason = reason;
  return this.save();
};

TransactionSchema.methods.cancel = function (reason) {
  if (this.status === 'paid' || this.status === 'refunded') {
    throw new Error(`Cannot cancel a ${this.status} transaction.`);
  }
  this.status = 'cancelled';
  this.cancellationReason = reason;
  return this.save();
};

// ─── Static Methods ───────────────────────────────────────────────────────────

TransactionSchema.statics.getPendingForUser = function (userId) {
  return this.find({
    userId,
    status: 'pending',
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
};

TransactionSchema.statics.getHistoryForUser = function (userId, { page = 1, limit = 20 } = {}) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

TransactionSchema.statics.findByInvoice = function (invoiceNumber) {
  return this.findOne({ invoiceNumber: invoiceNumber.toUpperCase().trim() });
};

TransactionSchema.statics.createPending = async function (data) {
  return this.create({
    ...data,
    status: 'pending',
  });
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
module.exports.PAYMENT_METHODS = PAYMENT_METHODS;
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;