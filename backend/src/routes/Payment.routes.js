'use strict';

const express = require('express');
const { body, param, query } = require('express-validator');
const {
  createBoothPayment,
  createSessionPayment,
  confirmPayment,
  cancelTransaction,
  getTransactionHistory,
  getTransaction,
  getAllTransactions,
  confirmOnSitePayment,
  handleWebhook,
} = require('../controllers/payment.controller');
const { protect, authorizeRoles, requireEmailVerified } = require('../middleware/Auth.middleware');

const router = express.Router();

// ─── Validation Schemas ──────────────────────────────────────────────────────

const createBoothPaymentValidation = [
  body('boothId')
    .trim()
    .notEmpty().withMessage('Booth ID is required.')
    .isMongoId().withMessage('Invalid booth ID format.'),
  body('paymentMethod')
    .optional()
    .isIn(['mock', 'stripe', 'on_site']).withMessage('Invalid payment method.'),
];

const createSessionPaymentValidation = [
  body('sessionId')
    .trim()
    .notEmpty().withMessage('Session ID is required.')
    .isMongoId().withMessage('Invalid session ID format.'),
  body('paymentMethod')
    .optional()
    .isIn(['mock', 'stripe', 'on_site']).withMessage('Invalid payment method.'),
];

const confirmPaymentValidation = [
  body('transactionId')
    .trim()
    .notEmpty().withMessage('Transaction ID is required.')
    .isMongoId().withMessage('Invalid transaction ID format.'),
  body('paymentId')
    .trim()
    .notEmpty().withMessage('Payment ID is required.'),
];

const cancelTransactionValidation = [
  param('transactionId')
    .trim()
    .notEmpty().withMessage('Transaction ID is required.')
    .isMongoId().withMessage('Invalid transaction ID format.'),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Reason must not exceed 500 characters.'),
];

const getTransactionValidation = [
  param('transactionId')
    .trim()
    .notEmpty().withMessage('Transaction ID is required.')
    .isMongoId().withMessage('Invalid transaction ID format.'),
];

// ─── Webhook (no auth - handled by Stripe) ──────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), handleWebhook);

// ─── All routes require authentication ───────────────────────────────────────
router.use(protect);

// ─── User Routes ──────────────────────────────────────────────────────────────

// Create payment for booth reservation
router.post(
  '/booth',
  requireEmailVerified,
  createBoothPaymentValidation,
  createBoothPayment
);

// Create payment for session registration
router.post(
  '/session',
  requireEmailVerified,
  createSessionPaymentValidation,
  createSessionPayment
);

// Confirm payment
router.post(
  '/confirm',
  confirmPaymentValidation,
  confirmPayment
);

// Cancel transaction
router.delete(
  '/:transactionId',
  cancelTransactionValidation,
  cancelTransaction
);

// Get user's transaction history
router.get(
  '/history',
  getTransactionHistory
);

// ─── Admin Routes (must be before /:transactionId) ───────────────────────────
router.get(
  '/admin/all',
  authorizeRoles('admin'),
  getAllTransactions
);

router.post(
  '/admin/:transactionId/confirm-on-site',
  authorizeRoles('admin'),
  getTransactionValidation,
  confirmOnSitePayment
);

// Get a single transaction
router.get(
  '/:transactionId',
  getTransactionValidation,
  getTransaction
);

module.exports = router;