"use strict";

const mongoose = require("mongoose");

// ─── Enums ────────────────────────────────────────────────────────────────────
const SESSION_STATUSES = Object.freeze([
  "scheduled",
  "live",
  "completed",
  "cancelled",
]);
const SESSION_FORMATS = Object.freeze([
  "keynote",
  "panel",
  "workshop",
  "presentation",
  "networking",
  "demo",
  "other",
]);

// ─── Sub-schemas ──────────────────────────────────────────────────────────────
const SpeakerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Speaker name is required."],
      trim: true,
      maxlength: [100, "Speaker name must not exceed 100 characters."],
    },
    title: {
      type: String,
      trim: true,
      maxlength: [150, "Speaker title must not exceed 150 characters."],
      default: null,
    },
    company: {
      type: String,
      trim: true,
      maxlength: [100, "Company name must not exceed 100 characters."],
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: [1000, "Speaker bio must not exceed 1000 characters."],
      default: null,
    },
    avatar: {
      type: String,
      default: null,
      trim: true,
    },
    // Link to an exhibitor's user account if the speaker is also an exhibitor
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: true },
);

const AttendeeRegistrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    registeredAt: { type: Date, default: () => new Date() },
    attended: { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },
  },
  { _id: false },
);

const ResourceSchema = new mongoose.Schema(
  {
    label: { type: String, trim: true, required: true, maxlength: 100 },
    url: { type: String, trim: true, required: true },
    type: { type: String, trim: true, default: "link", maxlength: 30 }, // link, pdf, slides, recording
  },
  { _id: true },
);

// ─── Main Schema ──────────────────────────────────────────────────────────────
const SessionSchema = new mongoose.Schema(
  {
    expoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expo",
      required: [true, "Expo reference is required."],
    },

    title: {
      type: String,
      required: [true, "Session title is required."],
      trim: true,
      minlength: [3, "Title must be at least 3 characters."],
      maxlength: [200, "Title must not exceed 200 characters."],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [3000, "Description must not exceed 3000 characters."],
      default: null,
    },

    format: {
      type: String,
      enum: {
        values: SESSION_FORMATS,
        message: `Format must be one of: ${SESSION_FORMATS.join(", ")}.`,
      },
      default: "presentation",
    },

    status: {
      type: String,
      enum: {
        values: SESSION_STATUSES,
        message: `Status must be one of: ${SESSION_STATUSES.join(", ")}.`,
      },
      default: "scheduled",
    },

    location: {
      type: String,
      required: [true, "Session location or room is required."],
      trim: true,
      maxlength: [150, "Location must not exceed 150 characters."],
    },

    startTime: {
      type: Date,
      required: [true, "Session start time is required."],
    },

    endTime: {
      type: Date,
      required: [true, "Session end time is required."],
    },

    speakers: {
      type: [SpeakerSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 10,
        message: "A session cannot have more than 10 speakers.",
      },
    },

    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 15,
        message: "A session cannot have more than 15 tags.",
      },
    },

    maxCapacity: {
      type: Number,
      default: null,
      min: [1, "Max capacity must be at least 1."],
    },

    price: {
      type: Number,
      default: 0,
      min: 0,
      description: "Price in cents (USD) - 0 = free",
    },
    currency: {
      type: String,
      default: "USD",
      enum: ["USD", "EUR", "GBP"],
    },
    isPaid: {
      type: Boolean,
      default: false,
    },

    // Registered attendee sub-documents
    attendees: {
      type: [AttendeeRegistrationSchema],
      default: [],
      select: false,
    },

    // Lightweight bookmark list — only user IDs, no sub-document overhead
    bookmarkedBy: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
      select: false,
    },

    // Post-session resources (slides, recordings, links)
    resources: {
      type: [ResourceSchema],
      default: [],
    },

    // Stream / virtual attendance link
    streamUrl: {
      type: String,
      trim: true,
      default: null,
    },

    isPublic: {
      type: Boolean,
      default: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Session creator is required."],
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
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
SessionSchema.index({ expoId: 1, startTime: 1 });
SessionSchema.index({ expoId: 1, status: 1 });
SessionSchema.index({ expoId: 1, location: 1, startTime: 1 });
SessionSchema.index({ expoId: 1, isFeatured: 1 });
SessionSchema.index({ "attendees.userId": 1 }, { sparse: true });
SessionSchema.index({ bookmarkedBy: 1 }, { sparse: true });
SessionSchema.index({ tags: 1 });
SessionSchema.index(
  { title: "text", description: "text", tags: "text", location: "text" },
  {
    weights: { title: 10, tags: 4, location: 2, description: 1 },
    name: "session_text_search",
  },
);

// ─── Virtuals ─────────────────────────────────────────────────────────────────
SessionSchema.virtual("durationMinutes").get(function () {
  if (!this.startTime || !this.endTime) return null;
  return Math.round((this.endTime - this.startTime) / 60_000);
});

SessionSchema.virtual("isAtCapacity").get(function () {
  if (!this.maxCapacity) return false;
  const count = this.attendees?.length ?? 0;
  return count >= this.maxCapacity;
});

SessionSchema.virtual("spotsRemaining").get(function () {
  if (!this.maxCapacity) return null;
  return Math.max(0, this.maxCapacity - (this.attendees?.length ?? 0));
});

SessionSchema.virtual("attendeeCount").get(function () {
  return this.attendees?.length ?? 0;
});

SessionSchema.virtual("bookmarkCount").get(function () {
  return this.bookmarkedBy?.length ?? 0;
});

SessionSchema.virtual("isLive").get(function () {
  return this.status === "live";
});

SessionSchema.virtual('isPaidSession').get(function () {
  return this.price > 0;
});

// ─── Pre-save: Date & Status Validation ───────────────────────────────────────
SessionSchema.pre("save", function (next) {
  if (this.endTime <= this.startTime) {
    return next(new Error("Session end time must be after start time."));
  }

  // Auto-transition based on current time
  if (this.status === "scheduled") {
    const now = new Date();
    if (now >= this.startTime && now < this.endTime) this.status = "live";
    else if (now >= this.endTime) this.status = "completed";
  }

  return next();
});

// ─── Post-save: Sync Expo sessionCount ────────────────────────────────────────
SessionSchema.post("save", async function (doc) {
  if (doc.isNew) {
    try {
      const Expo = mongoose.model("Expo");
      await Expo.incrementCounter(doc.expoId, "sessionCount", 1);
    } catch (_) {
      /* Non-blocking */
    }
  }
});

SessionSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    try {
      const Expo = mongoose.model("Expo");
      await Expo.incrementCounter(doc.expoId, "sessionCount", -1);
    } catch (_) {
      /* Non-blocking */
    }
  }
});

// ─── Instance Methods ─────────────────────────────────────────────────────────

// Register an attendee — enforces capacity and prevents duplicate registration
// SessionSchema.methods.registerAttendee = function (userId) {
//   const alreadyRegistered = this.attendees.some(
//     (a) => a.userId.toString() === userId.toString()
//   );

//   if (alreadyRegistered) {
//     throw new Error('You are already registered for this session.');
//   }

//   if (this.maxCapacity && this.attendees.length >= this.maxCapacity) {
//     throw new Error('This session has reached maximum capacity.');
//   }

//   if (['completed', 'cancelled'].includes(this.status)) {
//     throw new Error(`Cannot register for a session with status: ${this.status}.`);
//   }

//   this.attendees.push({ userId });
//   return this.save();
// };

// Replace the registerAttendee method with:
SessionSchema.methods.registerAttendee = function (userId) {
  const alreadyRegistered = this.attendees.some(
    (a) => a.userId.toString() === userId.toString(),
  );

  if (alreadyRegistered) {
    throw new Error("You are already registered for this session.");
  }

  if (this.maxCapacity && this.attendees.length >= this.maxCapacity) {
    throw new Error("This session has reached maximum capacity.");
  }

  if (["completed", "cancelled"].includes(this.status)) {
    throw new Error(
      `Cannot register for a session with status: ${this.status}.`,
    );
  }

  // If session is paid, we need a paid transaction first
  // The registration will be completed after payment

  this.attendees.push({ userId });
  return this.save();
};

// New method: Check if user can register (for paid sessions)
SessionSchema.methods.canRegister = function (userId) {
  const alreadyRegistered = this.attendees.some(
    (a) => a.userId.toString() === userId.toString(),
  );

  if (alreadyRegistered)
    return { allowed: false, reason: "Already registered" };
  if (this.maxCapacity && this.attendees.length >= this.maxCapacity) {
    return { allowed: false, reason: "Session is full" };
  }
  if (["completed", "cancelled"].includes(this.status)) {
    return { allowed: false, reason: `Session is ${this.status}` };
  }
  if (this.price > 0) {
    return { allowed: true, requiresPayment: true };
  }
  return { allowed: true, requiresPayment: false };
};

// Unregister an attendee
SessionSchema.methods.unregisterAttendee = function (userId) {
  const before = this.attendees.length;
  this.attendees = this.attendees.filter(
    (a) => a.userId.toString() !== userId.toString(),
  );

  if (this.attendees.length === before) {
    throw new Error("You are not registered for this session.");
  }

  return this.save();
};

// Mark an attendee as physically checked in
SessionSchema.methods.checkInAttendee = function (userId) {
  const record = this.attendees.find(
    (a) => a.userId.toString() === userId.toString(),
  );

  if (!record) {
    throw new Error("Attendee is not registered for this session.");
  }

  if (record.attended) {
    throw new Error("Attendee has already been checked in.");
  }

  record.attended = true;
  record.checkedInAt = new Date();

  return this.save();
};

// Toggle bookmark for a given user
SessionSchema.methods.toggleBookmark = function (userId) {
  const idx = this.bookmarkedBy.findIndex(
    (id) => id.toString() === userId.toString(),
  );

  let isBookmarked;
  if (idx > -1) {
    this.bookmarkedBy.splice(idx, 1);
    isBookmarked = false;
  } else {
    this.bookmarkedBy.push(userId);
    isBookmarked = true;
  }

  return this.save().then(() => ({ isBookmarked }));
};

// Transition session status
SessionSchema.methods.transitionStatus = function (newStatus) {
  const allowed = {
    scheduled: ["live", "cancelled"],
    live: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };

  if (!allowed[this.status]?.includes(newStatus)) {
    throw new Error(
      `Invalid status transition: ${this.status} → ${newStatus}.`,
    );
  }

  this.status = newStatus;
  return this.save();
};

// ─── Static Methods ───────────────────────────────────────────────────────────

// Full schedule for an expo — sorted chronologically by room then time
SessionSchema.statics.getExpoSchedule = function (expoId, filters = {}) {
  const query = { expoId, isPublic: true, ...filters };
  return this.find(query)
    .select("-attendees -bookmarkedBy")
    .sort({ startTime: 1, location: 1 })
    .lean();
};

// All sessions a specific user has registered for
SessionSchema.statics.getUserRegistrations = function (userId, expoId = null) {
  const match = { "attendees.userId": new mongoose.Types.ObjectId(userId) };
  if (expoId) match.expoId = new mongoose.Types.ObjectId(expoId);
  return this.find(match)
    .select("-attendees -bookmarkedBy")
    .sort({ startTime: 1 })
    .lean();
};

// All sessions bookmarked by a user
SessionSchema.statics.getUserBookmarks = function (userId, expoId = null) {
  const match = { bookmarkedBy: new mongoose.Types.ObjectId(userId) };
  if (expoId) match.expoId = new mongoose.Types.ObjectId(expoId);
  return this.find(match)
    .select("-attendees -bookmarkedBy")
    .sort({ startTime: 1 })
    .lean();
};

// Detect scheduling conflicts for a given room + time window (used during creation)
SessionSchema.statics.detectConflicts = function (
  expoId,
  location,
  startTime,
  endTime,
  excludeId = null,
) {
  const query = {
    expoId,
    location,
    status: { $nin: ["cancelled"] },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };

  if (excludeId) query._id = { $ne: excludeId };

  return this.find(query).select("title startTime endTime location").lean();
};

// Popularity analytics — sessions ranked by registrations and bookmarks
SessionSchema.statics.getPopularitySummary = function (expoId) {
  return this.aggregate([
    { $match: { expoId: new mongoose.Types.ObjectId(expoId), isPublic: true } },
    {
      $project: {
        title: 1,
        format: 1,
        status: 1,
        startTime: 1,
        location: 1,
        isFeatured: 1,
        registrations: { $size: { $ifNull: ["$attendees", []] } },
        bookmarks: { $size: { $ifNull: ["$bookmarkedBy", []] } },
        attendanceRate: {
          $cond: [
            { $gt: [{ $size: { $ifNull: ["$attendees", []] } }, 0] },
            {
              $multiply: [
                {
                  $divide: [
                    {
                      $size: {
                        $filter: {
                          input: { $ifNull: ["$attendees", []] },
                          as: "a",
                          cond: "$$a.attended",
                        },
                      },
                    },
                    { $size: { $ifNull: ["$attendees", []] } },
                  ],
                },
                100,
              ],
            },
            0,
          ],
        },
      },
    },
    { $sort: { registrations: -1, bookmarks: -1 } },
  ]);
};

// ─── Model Export ─────────────────────────────────────────────────────────────
const Session = mongoose.model("Session", SessionSchema);

module.exports = Session;
module.exports.SESSION_STATUSES = SESSION_STATUSES;
module.exports.SESSION_FORMATS = SESSION_FORMATS;
