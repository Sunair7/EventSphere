"use strict";

const mongoose = require("mongoose");

// ─── Notification Types ───────────────────────────────────────────────────────
const NOTIFICATION_TYPES = Object.freeze([
  "application_submitted", // New exhibitor application
  "application_approved", // Exhibitor approved
  "application_rejected", // Exhibitor rejected
  "application_suspended", // Exhibitor suspended
  "document_uploaded", // New document for review
  "document_verified", // Document verified
  "document_flagged", // Document flagged
  "booth_reserved", // Booth reservation submitted
  "booth_approved", // Booth approved
  "booth_rejected", // Booth rejected
  "booth_released", // Booth force-released
  "session_registered", // Registered for session
  "session_cancelled", // Session cancelled by admin
  "session_live", // Session went live
  "session_reminder", // Upcoming session reminder
  "expo_published", // New expo available
  "expo_cancelled", // Expo cancelled
  "message_received", // New message (already handled by socket)
  "system", // Generic system notification
  "payment_pending", // Payment is pending
  "payment_success", // Payment successful
  "payment_failed", // Payment failed
  "payment_reminder", // Payment reminder (15 min warning)
  "booth_reserved", // Booth reserved (already there)
  "booth_confirmed", // Booth confirmed after payment
  "booth_reservation_expired", // Expired reservation
  "session_registered", // Already there
  "session_confirmed", // Session confirmed after payment
]);

// ─── Target Roles ─────────────────────────────────────────────────────────────
const TARGET_ROLES = Object.freeze(["admin", "exhibitor", "attendee"]);

// ─── Schema ───────────────────────────────────────────────────────────────────
const NotificationSchema = new mongoose.Schema(
  {
    // Who receives this notification
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // What type of notification
    type: {
      type: String,
      enum: {
        values: NOTIFICATION_TYPES,
        message: `Type must be one of: ${NOTIFICATION_TYPES.join(", ")}.`,
      },
      required: true,
    },

    // Human-readable title
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    // Optional longer description
    body: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },

    // Link to the relevant resource
    link: {
      type: String,
      trim: true,
      default: null,
    },

    // Reference to the related entity (optional)
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // What kind of entity this relates to
    referenceModel: {
      type: String,
      enum: [
        "Expo",
        "Booth",
        "Session",
        "ExhibitorProfile",
        "User",
        "Message",
        null,
      ],
      default: null,
    },

    // Read status
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
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
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });

// ─── Static Methods ───────────────────────────────────────────────────────────

// Get unread count for a user
NotificationSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({
    recipient: userId,
    isRead: false,
  });
};

// Get paginated notifications for a user
NotificationSchema.statics.getForUser = function (
  userId,
  { page = 1, limit = 20 } = {},
) {
  return this.find({ recipient: userId })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

// Mark all as read for a user
NotificationSchema.statics.markAllRead = function (userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } },
  );
};

// Mark a single notification as read
NotificationSchema.methods.markAsRead = function () {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save({ validateBeforeSave: false });
  }
  return Promise.resolve(this);
};

// ─── Helper: Create and emit a notification ───────────────────────────────────
NotificationSchema.statics.createAndEmit = async function (
  io,
  { recipient, type, title, body, link, referenceId, referenceModel },
) {
  // Create in DB
  const notification = await this.create({
    recipient,
    type,
    title,
    body,
    link,
    referenceId,
    referenceModel,
  });

  // Emit via Socket.io for real-time update
  if (io?.notifyNsp) {
    io.notifyNsp.pushToUser(recipient.toString(), "notification:new", {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      isRead: false,
      createdAt: notification.createdAt,
    });

    // Also send the updated unread count
    const unreadCount = await this.getUnreadCount(recipient);
    io.notifyNsp.pushToUser(recipient.toString(), "notification:unread_count", {
      unreadCount,
    });
  }

  return notification;
};

// ─── Helper: Notify all users of a specific role ──────────────────────────────
NotificationSchema.statics.notifyRole = async function (
  io,
  role,
  { type, title, body, link, referenceId, referenceModel },
) {
  const User = mongoose.model("User");
  const users = await User.find({ role, isActive: true }).select("_id").lean();

  const notifications = await Promise.all(
    users.map((user) =>
      this.createAndEmit(io, {
        recipient: user._id,
        type,
        title,
        body,
        link,
        referenceId,
        referenceModel,
      }),
    ),
  );

  return notifications;
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const Notification = mongoose.model("Notification", NotificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
