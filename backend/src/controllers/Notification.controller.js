'use strict';

const mongoose = require('mongoose');
const Notification = require('../models/Notification');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ─── @route   GET /api/v1/notifications ──────────────────────────────────────
// @access  Authenticated
const getNotifications = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.getForUser(req.user._id, { page, limit }),
      Notification.countDocuments({ recipient: req.user._id }),
      Notification.getUnreadCount(req.user._id),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/notifications/unread-count ─────────────────────────
// @access  Authenticated
const getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.getUnreadCount(req.user._id);

    return res.status(200).json({
      success: true,
      data: { unreadCount },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/notifications/:id/read ───────────────────────────
// @access  Authenticated
const markAsRead = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid notification ID.'));
    }

    const notification = await Notification.findOne({
      _id: id,
      recipient: req.user._id,
    });

    if (!notification) {
      return next(createError(404, 'Notification not found.'));
    }

    await notification.markAsRead();

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read.',
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/notifications/read-all ───────────────────────────
// @access  Authenticated
const markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.markAllRead(req.user._id);

    return res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notification(s) marked as read.`,
      markedCount: result.modifiedCount,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   DELETE /api/v1/notifications/:id ───────────────────────────────
// @access  Authenticated
const deleteNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid notification ID.'));
    }

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: req.user._id,
    });

    if (!notification) {
      return next(createError(404, 'Notification not found.'));
    }

    return res.status(200).json({
      success: true,
      message: 'Notification deleted.',
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};