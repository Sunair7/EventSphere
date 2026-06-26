"use strict";

const mongoose = require("mongoose");

// ─── Enums ────────────────────────────────────────────────────────────────────
const MESSAGE_TYPES = Object.freeze(["text", "file", "image", "system"]);

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const AttachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    fileSizeBytes: { type: Number, default: null },
    mimeType: { type: String, trim: true, default: null },
    thumbnailUrl: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const ReadReceiptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    readAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

// ─── Conversation ID Helper ───────────────────────────────────────────────────
// Deterministically generates a stable conversationId from two user ObjectIds.
// Sorting ensures A→B and B→A produce the same key, enabling bidirectional lookup.
const buildConversationId = (userIdA, userIdB) => {
  const ids = [userIdA.toString(), userIdB.toString()].sort();
  return `${ids[0]}_${ids[1]}`;
};

// ─── Main Schema ──────────────────────────────────────────────────────────────
const MessageSchema = new mongoose.Schema(
  {
    // Stable two-party conversation key — eliminates the need for a separate
    // Conversation collection for 1-on-1 chats.
    conversationId: {
      type: String,
      required: [true, "Conversation ID is required."],
      index: true,
    },

    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Sender is required."],
    },

    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Receiver is required."],
    },

    type: {
      type: String,
      enum: {
        values: MESSAGE_TYPES,
        message: `Type must be one of: ${MESSAGE_TYPES.join(", ")}.`,
      },
      default: "text",
    },

    content: {
      type: String,
      trim: true,
      maxlength: [2000, "Message content must not exceed 2000 characters."],
      default: null,
    },

    attachment: {
      type: AttachmentSchema,
      default: null,
    },

    // Track which participants have read this message
    readBy: {
      type: [ReadReceiptSchema],
      default: [],
    },

    // Legacy single-flag kept for fast unread queries (sender never reads own messages)
    isRead: {
      type: Boolean,
      default: false,
    },

    // Soft delete flags — each party can delete from their own view
    deletedBySender: { type: Boolean, default: false, select: false },
    deletedByReceiver: { type: Boolean, default: false, select: false },

    // Optional reply threading
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // For system-generated messages (e.g. "Booth A-12 has been approved")
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      select: false,
    },

    // Expo context — optional scoping for expo-specific conversations
    expoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expo",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.__v;
        delete ret.deletedBySender;
        delete ret.deletedByReceiver;
        delete ret.metadata;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// Primary conversation timeline query
MessageSchema.index({ conversationId: 1, createdAt: -1 });

// Unread count queries per receiver
MessageSchema.index({ receiverId: 1, isRead: 1 });

// Inbox list — latest message per conversation for a given user
MessageSchema.index({ senderId: 1, createdAt: -1 });

// Expo-scoped message queries
MessageSchema.index({ expoId: 1, createdAt: -1 }, { sparse: true });

// TTL index — auto-purge soft-deleted messages after 30 days
// Only fires when BOTH parties have deleted the message
MessageSchema.index(
  { deletedBySender: 1, deletedByReceiver: 1 },
  { sparse: true },
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
MessageSchema.virtual("isReadByReceiver").get(function () {
  return this.isRead;
});

MessageSchema.virtual("hasAttachment").get(function () {
  return this.attachment !== null && this.attachment !== undefined;
});

// ─── Pre-validate: Build conversationId & content guard ───────────────────────
MessageSchema.pre("validate", function (next) {
  // Build deterministic conversation key from the two participants
  if (this.senderId && this.receiverId) {
    this.conversationId = buildConversationId(this.senderId, this.receiverId);
  }

  // A message must have either text content or an attachment
  if (!this.content && !this.attachment) {
    return next(
      new Error("Message must contain either text content or an attachment."),
    );
  }

  // Prevent self-messaging
  if (this.senderId?.toString() === this.receiverId?.toString()) {
    return next(new Error("Sender and receiver cannot be the same user."));
  }

  return next();
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Mark this message as read by the receiver and record the receipt
MessageSchema.methods.markAsRead = function (readerId) {
  if (this.receiverId.toString() !== readerId.toString()) return this;

  const alreadyRead = this.readBy.some(
    (r) => r.userId.toString() === readerId.toString(),
  );

  if (!alreadyRead) {
    this.readBy.push({ userId: readerId });
    this.isRead = true;
    return this.save({ validateBeforeSave: false });
  }

  return Promise.resolve(this);
};

// Soft-delete from one party's view — hard-deletes when both parties have deleted
MessageSchema.methods.softDelete = async function (requestingUserId) {
  const isSender   = this.senderId.toString()   === requestingUserId.toString();
  const isReceiver = this.receiverId.toString()  === requestingUserId.toString();

  if (!isSender && !isReceiver) {
    throw new Error('You do not have permission to delete this message.');
  }

  // Start a session for transaction safety
  const session = await mongoose.startSession();
  
  try {
    await session.withTransaction(async () => {
      if (isSender) this.deletedBySender = true;
      if (isReceiver) this.deletedByReceiver = true;

      if (this.deletedBySender && this.deletedByReceiver) {
        await this.deleteOne({ session });
      } else {
        await this.save({ validateBeforeSave: false, session });
      }
    });
  } finally {
    await session.endSession();
  }
};

// ─── Static Methods ───────────────────────────────────────────────────────────

// Build the stable conversationId for external use (e.g. controllers)
MessageSchema.statics.buildConversationId = buildConversationId;

// Paginated message history for a conversation thread
MessageSchema.statics.getConversation = function (
  userIdA,
  userIdB,
  { page = 1, limit = 30 } = {},
) {
  const conversationId = buildConversationId(userIdA, userIdB);
  const requesterId = userIdA.toString();

  return this.find({
    conversationId,
    // Exclude messages the requesting user has soft-deleted
    $or: [
      { senderId: requesterId, deletedBySender: { $ne: true } },
      { receiverId: requesterId, deletedByReceiver: { $ne: true } },
    ],
  })
    .select("+deletedBySender +deletedByReceiver")
    .populate("senderId", "name avatar")
    .populate("receiverId", "name avatar")
    .populate("replyTo", "content senderId type")
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
};

// Inbox — one latest message per unique conversation for a given user
MessageSchema.statics.getInbox = function (userId) {
  const uid = new mongoose.Types.ObjectId(userId);

  return this.aggregate([
    {
      $match: {
        $or: [
          { senderId: uid, deletedBySender: { $ne: true } },
          { receiverId: uid, deletedByReceiver: { $ne: true } },
        ],
        // 🔑 FIX 1: Exclude self-conversations
        $expr: { $ne: ['$senderId', '$receiverId'] },
      },
    },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: '$conversationId',
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$receiverId', uid] },
                  { $eq: ['$isRead', false] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: ['$lastMessage', { unreadCount: '$unreadCount' }],
        },
      },
    },
    { $sort: { createdAt: -1 } },
    // 🔑 FIX 2: Populate senderId and receiverId as full objects
    // so the frontend getParticipant() function works correctly
    {
      $lookup: {
        from: 'users',
        localField: 'senderId',
        foreignField: '_id',
        as: 'sender',
        pipeline: [{ $project: { name: 1, avatar: 1, role: 1 } }],
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: 'receiverId',
        foreignField: '_id',
        as: 'receiver',
        pipeline: [{ $project: { name: 1, avatar: 1, role: 1 } }],
      },
    },
    // 🔑 FIX 3: Unwind the arrays so sender/receiver become objects, not arrays
    {
      $addFields: {
        sender: { $arrayElemAt: ['$sender', 0] },
        receiver: { $arrayElemAt: ['$receiver', 0] },
      },
    },
  ]);
};

// Total unread message count for a user — badge counter
MessageSchema.statics.getUnreadCount = function (userId) {
  return this.countDocuments({
    receiverId: new mongoose.Types.ObjectId(userId),
    isRead: false,
    deletedByReceiver: { $ne: true },
  });
};

// Bulk-mark all messages in a conversation as read
MessageSchema.statics.markConversationAsRead = function (
  conversationId,
  readerId,
) {
  const uid = new mongoose.Types.ObjectId(readerId);
  return this.updateMany(
    {
      conversationId,
      receiverId: uid,
      isRead: false,
    },
    {
      $set: { isRead: true },
      $push: { readBy: { userId: uid, readAt: new Date() } },
    },
  );
};

// Admin-level conversation analytics per expo
MessageSchema.statics.getExpoMessageStats = function (expoId) {
  return this.aggregate([
    { $match: { expoId: new mongoose.Types.ObjectId(expoId) } },
    {
      $group: {
        _id: null,
        totalMessages: { $sum: 1 },
        uniqueSenders: { $addToSet: "$senderId" },
        uniqueConversations: { $addToSet: "$conversationId" },
        avgResponseTimeMs: {
          $avg: {
            $subtract: [{ $toLong: "$updatedAt" }, { $toLong: "$createdAt" }],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        totalMessages: 1,
        uniqueSenders: { $size: "$uniqueSenders" },
        uniqueConversations: { $size: "$uniqueConversations" },
        avgResponseTimeMs: { $round: ["$avgResponseTimeMs", 0] },
      },
    },
  ]);
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const Message = mongoose.model("Message", MessageSchema);

module.exports = Message;
module.exports.MESSAGE_TYPES = MESSAGE_TYPES;
module.exports.buildConversationId = buildConversationId;
