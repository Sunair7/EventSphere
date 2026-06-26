'use strict';

const express = require('express');
const { param } = require('express-validator');

const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notification.controller');

const { protect } = require('../middleware/Auth.middleware');

const router = express.Router();

// ─── All routes require authentication ───────────────────────────────────────
router.use(protect);

// ─── Validators ──────────────────────────────────────────────────────────────
const mongoId = (field) =>
  param(field)
    .trim()
    .notEmpty().withMessage(`${field} is required.`)
    .isMongoId().withMessage(`Invalid ${field} format.`);

// ─── Routes ──────────────────────────────────────────────────────────────────
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', mongoId('id'), markAsRead);
router.delete('/:id', mongoId('id'), deleteNotification);

module.exports = router;