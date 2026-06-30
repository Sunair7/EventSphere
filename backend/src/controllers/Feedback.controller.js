"use strict";

const mongoose = require("mongoose");
const { validationResult } = require("express-validator");
const Feedback = require("../models/Feedback");
const Session = require("../models/Session");
const User = require("../models/User");
const Notification = require("../models/Notification");

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const handleValidationErrors = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    const err = new Error(messages[0]);
    err.statusCode = 422;
    err.errors = messages;
    throw err;
  }
};

// ─── Helper Functions ─────────────────────────────────────────────────────────
const canUserLeaveFeedback = async (sessionId, userId) => {
  const session = await Session.findById(sessionId)
    .select("attendees status endTime")
    .lean();

  if (!session) return { allowed: false, reason: "Session not found." };

  if (session.status !== "completed") {
    return {
      allowed: false,
      reason: "Session must be completed to leave feedback.",
    };
  }

  const attendee = session.attendees?.find(
    (a) => a.userId.toString() === userId.toString(),
  );

  if (!attendee) {
    return {
      allowed: false,
      reason: "You are not registered for this session.",
    };
  }

  if (!attendee.attended) {
    return {
      allowed: false,
      reason: "You must attend the session to leave feedback.",
    };
  }

  const existingFeedback = await Feedback.findOne({
    sessionId,
    userId,
  });

  // ✅ If feedback exists but is rejected, allow new submission
  if (existingFeedback && existingFeedback.status === "rejected") {
    return { allowed: true, existing: false };
  }

  if (existingFeedback) {
    return { allowed: true, existing: true, feedback: existingFeedback };
  }

  return { allowed: true, existing: false };
};

const getSessionSpeakers = async (sessionId) => {
  const session = await Session.findById(sessionId).select("speakers").lean();

  if (!session) return [];
  return session.speakers || [];
};

const getExhibitorUsersFromSpeakers = async (speakers) => {
  const userIds = speakers.filter((s) => s.userId).map((s) => s.userId);

  if (userIds.length === 0) return [];

  const users = await User.find({
    _id: { $in: userIds },
    role: "exhibitor",
    isActive: true,
  }).select("_id name email");

  return users;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

// ── Check if user can leave feedback ────────────────────────────────────────
const canLeaveFeedback = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return next(createError(400, "Invalid session ID."));
    }

    const result = await canUserLeaveFeedback(sessionId, userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
};

// ── Submit feedback ──────────────────────────────────────────────────────────
const submitFeedback = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { sessionId } = req.params;
    const { rating, comment, isAnonymous = false } = req.body;
    const userId = req.user._id;

    const eligibility = await canUserLeaveFeedback(sessionId, userId);

    if (!eligibility.allowed) {
      return next(createError(400, eligibility.reason));
    }

    if (eligibility.existing) {
      return res.status(200).json({
        success: true,
        message: "You already have feedback for this session.",
        data: eligibility.feedback,
      });
    }

    const feedback = await Feedback.create({
      sessionId,
      userId,
      rating,
      comment: comment || null,
      isAnonymous,
      status: "pending",
    });

    // Get session title for notifications
    const session = await Session.findById(sessionId).select("title").lean();

    // ── Send notifications ──────────────────────────────────────────────────
    const io = req.app.get("io");

    // 1. Notify Admin (all admins)
    const adminUsers = await User.find({ role: "admin", isActive: true })
      .select("_id")
      .lean();

    for (const admin of adminUsers) {
      await Notification.createAndEmit(io, {
        recipient: admin._id,
        type: "feedback_pending",
        title: "📝 New Feedback Pending Review",
        body: `New feedback for session "${session?.title || "Unknown"}" awaiting moderation.`,
        link: `/admin/feedback`,
        referenceId: feedback._id,
        referenceModel: "Feedback",
      });
    }

    // 2. Notify the user that feedback was submitted
    await Notification.createAndEmit(io, {
      recipient: userId,
      type: "feedback_submitted",
      title: "📝 Feedback Submitted",
      body: "Your feedback has been submitted and is awaiting admin review.",
      link: `/attendee/sessions`,
      referenceId: feedback._id,
      referenceModel: "Feedback",
    });

    return res.status(201).json({
      success: true,
      message: "Feedback submitted successfully. Awaiting admin approval.",
      data: feedback,
    });
  } catch (err) {
    return next(err);
  }
};

// ── Edit feedback ─────────────────────────────────────────────────────────────
const editFeedback = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return next(createError(404, "Feedback not found."));
    }

    if (!feedback.canEdit(userId)) {
      return next(
        createError(403, "You do not have permission to edit this feedback."),
      );
    }

    feedback.rating = rating;
    feedback.comment = comment || null;
    feedback.isEdited = true;
    feedback.editedAt = new Date();
    feedback.status = "pending";

    await feedback.save();

    const io = req.app.get("io");
    const adminUsers = await User.find({ role: "admin", isActive: true })
      .select("_id")
      .lean();

    for (const admin of adminUsers) {
      await Notification.createAndEmit(io, {
        recipient: admin._id,
        type: "feedback_edited",
        title: "✏️ Feedback Edited",
        body: `Feedback has been edited and needs re-review.`,
        link: `/admin/feedback`,
        referenceId: feedback._id,
        referenceModel: "Feedback",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Feedback updated successfully. Awaiting re-approval.",
      data: feedback,
    });
  } catch (err) {
    return next(err);
  }
};

// ── Delete feedback ──────────────────────────────────────────────────────────
const deleteFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const userRole = req.user.role;

    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return next(createError(404, "Feedback not found."));
    }

    if (!feedback.canDelete(userId, userRole)) {
      return next(
        createError(403, "You do not have permission to delete this feedback."),
      );
    }

    await feedback.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Feedback deleted successfully.",
    });
  } catch (err) {
    return next(err);
  }
};

// ── Get feedback for a session ──────────────────────────────────────────────
const getSessionFeedback = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { includePending = false } = req.query;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return next(createError(400, "Invalid session ID."));
    }

    let showPending = includePending === "true";
    if (showPending) {
      const session = await Session.findById(sessionId)
        .select("speakers")
        .lean();
      const isSpeaker = session?.speakers?.some(
        (s) => s.userId?.toString() === userId?.toString(),
      );
      const isAdmin = req.user?.role === "admin";

      if (!isAdmin && !isSpeaker) {
        showPending = false;
      }
    }

    // ✅ Get feedback - include user's own feedback always
    const feedback = await Feedback.find({
      $or: [
        {
          sessionId,
          status: showPending
            ? { $in: ["pending", "approved", "rejected"] }
            : "approved",
        },
        { sessionId, userId: req.user?._id }, // Always include user's own feedback
      ],
    })
      .populate("userId", "name avatar")
      .sort({ createdAt: -1 })
      .lean();

    // ✅ Remove duplicate feedback entries (if user's feedback is already in the first query)
    const uniqueFeedback = [];
    const seenIds = new Set();
    for (const item of feedback) {
      if (!seenIds.has(item._id.toString())) {
        seenIds.add(item._id.toString());
        uniqueFeedback.push(item);
      }
    }

    const average = await Feedback.getAverageRating(sessionId);
    const distribution = await Feedback.getRatingDistribution(sessionId);

    return res.status(200).json({
      success: true,
      data: {
        feedback: uniqueFeedback,
        stats: {
          average: average.average,
          total: average.count,
          distribution,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ── Get user's feedback for a session ────────────────────────────────────────
const getUserFeedback = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return next(createError(400, "Invalid session ID."));
    }

    const feedback = await Feedback.getUserFeedback(sessionId, userId);

    return res.status(200).json({
      success: true,
      data: feedback || null,
    });
  } catch (err) {
    return next(err);
  }
};

// ── Get current user's feedback history ─────────────────────────────────────
const getMyFeedback = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status } = req.query;

    const query = { userId };
    if (status) query.status = status;

    const feedback = await Feedback.find(query)
      .populate("sessionId", "title expoId startTime")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Feedback.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        feedback,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ── Admin: Get pending feedback ─────────────────────────────────────────────
const getPendingFeedback = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await Feedback.getPendingFeedback(
      parseInt(page),
      parseInt(limit),
    );

    const total = await Feedback.countDocuments({ status: "pending" });

    return res.status(200).json({
      success: true,
      data: {
        feedback: result,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ── Admin: Approve feedback ──────────────────────────────────────────────────
const approveFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const adminId = req.user._id;

    const feedback = await Feedback.findById(id).populate("sessionId", "title");
    if (!feedback) {
      return next(createError(404, "Feedback not found."));
    }

    if (feedback.status === "approved") {
      return res.status(200).json({
        success: true,
        message: "Feedback is already approved.",
        data: feedback,
      });
    }

    feedback.status = "approved";
    feedback.reviewedBy = adminId;
    feedback.reviewedAt = new Date();
    await feedback.save();

    const io = req.app.get("io");

    // Notify the user who submitted feedback
    await Notification.createAndEmit(io, {
      recipient: feedback.userId,
      type: "feedback_approved",
      title: "✅ Your Feedback Was Approved!",
      body: `Your feedback for "${feedback.sessionId?.title || "the session"}" has been approved and is now visible.`,
      link: `/attendee/sessions`,
      referenceId: feedback._id,
      referenceModel: "Feedback",
    });

    // Find and notify speakers/exhibitors
    const speakers = await getSessionSpeakers(feedback.sessionId._id);
    const exhibitorUsers = await getExhibitorUsersFromSpeakers(speakers);

    for (const exhibitor of exhibitorUsers) {
      await Notification.createAndEmit(io, {
        recipient: exhibitor._id,
        type: "feedback_received",
        title: "⭐ New Feedback Received!",
        body: `You received a ${feedback.rating}-star rating for "${feedback.sessionId?.title || "your session"}"`,
        link: `/exhibitor/sessions`,
        referenceId: feedback._id,
        referenceModel: "Feedback",
      });
    }

    // Notify admins (except the one who approved)
    const adminUsers = await User.find({ role: "admin", isActive: true })
      .select("_id")
      .lean();

    for (const admin of adminUsers) {
      if (admin._id.toString() !== adminId.toString()) {
        await Notification.createAndEmit(io, {
          recipient: admin._id,
          type: "feedback_approved_admin",
          title: "✅ Feedback Approved",
          body: `Feedback for "${feedback.sessionId?.title || "the session"}" was approved.`,
          link: `/admin/feedback`,
          referenceId: feedback._id,
          referenceModel: "Feedback",
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Feedback approved successfully.",
      data: feedback,
    });
  } catch (err) {
    return next(err);
  }
};

// ── Admin: Reject feedback ───────────────────────────────────────────────────
const rejectFeedback = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user._id;

    const feedback = await Feedback.findById(id).populate("sessionId", "title");
    if (!feedback) {
      return next(createError(404, "Feedback not found."));
    }

    if (feedback.status === "rejected") {
      return res.status(200).json({
        success: true,
        message: "Feedback is already rejected.",
        data: feedback,
      });
    }

    feedback.status = "rejected";
    feedback.reviewedBy = adminId;
    feedback.reviewedAt = new Date();
    feedback.rejectionReason = rejectionReason || null;
    await feedback.save();

    const io = req.app.get("io");

    await Notification.createAndEmit(io, {
      recipient: feedback.userId,
      type: "feedback_rejected",
      title: "❌ Your Feedback Was Not Approved",
      body: rejectionReason
        ? `Your feedback was not approved: ${rejectionReason}`
        : "Your feedback was not approved by the admin.",
      link: `/attendee/sessions`,
      referenceId: feedback._id,
      referenceModel: "Feedback",
    });

    await Notification.createAndEmit(io, {
      recipient: adminId,
      type: "feedback_rejected_admin",
      title: "❌ Feedback Rejected",
      body: `You rejected feedback for "${feedback.sessionId?.title || "the session"}"`,
      link: `/admin/feedback`,
      referenceId: feedback._id,
      referenceModel: "Feedback",
    });

    return res.status(200).json({
      success: true,
      message: "Feedback rejected successfully.",
      data: feedback,
    });
  } catch (err) {
    return next(err);
  }
};

// ── Exhibitor: Get feedback for their sessions ──────────────────────────────
const getExhibitorFeedback = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 20, status = "approved" } = req.query;

    const result = await Feedback.getFeedbackForSpeaker(userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      status,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return next(err);
  }
};

// ── Admin: Get all feedback (with filtering) ────────────────────────────────
const getAllFeedback = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const query = {};
    if (status && status !== "all") {
      query.status = status;
    }

    const feedback = await Feedback.find(query)
      .populate("userId", "name email avatar")
      .populate("sessionId", "title expoId")
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const total = await Feedback.countDocuments(query);

    // Get stats for each status
    const stats = await Feedback.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const statusCounts = stats.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        feedback,
        stats: {
          pending: statusCounts.pending || 0,
          approved: statusCounts.approved || 0,
          rejected: statusCounts.rejected || 0,
          total: await Feedback.countDocuments(),
        },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ── Export ──────────────────────────────────────────────────────────────────
module.exports = {
  canLeaveFeedback,
  submitFeedback,
  editFeedback,
  deleteFeedback,
  getSessionFeedback,
  getUserFeedback,
  getMyFeedback,
  getPendingFeedback,
  approveFeedback,
  rejectFeedback,
  getExhibitorFeedback,
  getAllFeedback,
};
