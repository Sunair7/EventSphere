'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const {
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
} = require('../controllers/feedback.controller');
const {
  protect,
  authorizeRoles,
  requireEmailVerified,
} = require('../middleware/Auth.middleware');

const router = express.Router();

// ─── Validation Schemas ──────────────────────────────────────────────────────

const submitFeedbackValidation = [
  body('rating')
    .notEmpty().withMessage('Rating is required.')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
  body('comment')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Comment must not exceed 1000 characters.')
    .escape(),
  body('isAnonymous')
    .optional()
    .isBoolean().withMessage('isAnonymous must be a boolean.')
    .toBoolean(),
];

const editFeedbackValidation = [
  body('rating')
    .notEmpty().withMessage('Rating is required.')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5.'),
  body('comment')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Comment must not exceed 1000 characters.')
    .escape(),
];

const rejectFeedbackValidation = [
  body('rejectionReason')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Rejection reason must not exceed 500 characters.')
    .escape(),
];

const mongoId = (field, location = param) =>
  location(field)
    .trim()
    .notEmpty().withMessage(`${field} is required.`)
    .isMongoId().withMessage(`Invalid ${field} format.`);

// ─── All routes require authentication ──────────────────────────────────────
router.use(protect);

// ─── User Routes ─────────────────────────────────────────────────────────────

// Check if user can leave feedback
router.get(
  '/session/:sessionId/can-review',
  mongoId('sessionId'),
  canLeaveFeedback
);

// Submit feedback
router.post(
  '/session/:sessionId',
  requireEmailVerified,
  mongoId('sessionId'),
  submitFeedbackValidation,
  submitFeedback
);

// Get feedback for a session
router.get(
  '/session/:sessionId',
  mongoId('sessionId'),
  getSessionFeedback
);

// Get user's feedback for a session
router.get(
  '/session/:sessionId/user',
  mongoId('sessionId'),
  getUserFeedback
);

// Get current user's feedback history
router.get(
  '/me',
  getMyFeedback
);

// Edit feedback
router.put(
  '/:id',
  mongoId('id'),
  editFeedbackValidation,
  editFeedback
);

// Delete feedback
router.delete(
  '/:id',
  mongoId('id'),
  deleteFeedback
);

// ─── Exhibitor Routes ────────────────────────────────────────────────────────
router.get(
  '/exhibitor/sessions',
  authorizeRoles('exhibitor'),
  getExhibitorFeedback
);

// ─── Admin Routes ────────────────────────────────────────────────────────────

// Get pending feedback
router.get(
  '/admin/pending',
  authorizeRoles('admin'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  getPendingFeedback
);

// Get all feedback (with status filter)
router.get(
  '/admin/all',
  authorizeRoles('admin'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'all']),
  getAllFeedback
);

// Approve feedback
router.patch(
  '/:id/approve',
  authorizeRoles('admin'),
  mongoId('id'),
  approveFeedback
);

// Reject feedback
router.patch(
  '/:id/reject',
  authorizeRoles('admin'),
  mongoId('id'),
  rejectFeedbackValidation,
  rejectFeedback
);

module.exports = router;