'use strict';

const express                = require('express');
const { body, param, query } = require('express-validator');

const {
  getInbox,
  getUnreadCount,
  getConversation,
  sendMessage,
  markConversationAsRead,
  deleteMessage,
  getExpoMessageStats,
  getAllConversations,
} = require('../controllers/message.controller');

const {
  protect,
  authorizeRoles,
  requireEmailVerified,
} = require('../middleware/Auth.middleware');

const { messageLimiter } = require('../config/rateLimiter'); // ← Use shared limiter

const { MESSAGE_TYPES } = require('../models/Message');

const router = express.Router();

// ─── Reusable Validators ──────────────────────────────────────────────────────
const mongoId = (field, location = param) =>
  location(field)
    .trim()
    .notEmpty().withMessage(`${field} is required.`)
    .isMongoId().withMessage(`Invalid ${field} format.`);

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.')
    .toInt(),
];

// ─── Validation Schemas ───────────────────────────────────────────────────────

const sendMessageValidation = [
  body('receiverId')
    .trim()
    .notEmpty().withMessage('Receiver ID is required.')
    .isMongoId().withMessage('Receiver ID must be a valid MongoDB ID.'),

  body('type')
    .optional()
    .isIn(MESSAGE_TYPES)
    .withMessage(`Message type must be one of: ${MESSAGE_TYPES.join(', ')}.`),

  body('content')
    .optional({ nullable: true })
    .isString().withMessage('Content must be a string.')
    .trim()
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message content must be between 1 and 2000 characters.')
    .custom((content, { req }) => {
      if (!content && !req.body.attachment) {
        throw new Error('Message must contain either text content or an attachment.');
      }
      return true;
    }),

  body('attachment')
    .optional({ nullable: true })
    .isObject().withMessage('Attachment must be an object.'),

  body('attachment.url')
    .if(body('attachment').exists().notEmpty())
    .trim()
    .notEmpty().withMessage('Attachment URL is required.')
    .isURL().withMessage('Attachment URL must be valid.')
    .isLength({ max: 1000 }).withMessage('Attachment URL must not exceed 1000 characters.'),

  body('attachment.fileName')
    .if(body('attachment').exists().notEmpty())
    .trim()
    .notEmpty().withMessage('Attachment file name is required.')
    .isLength({ max: 255 }).withMessage('File name must not exceed 255 characters.'),

  body('attachment.mimeType')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('MIME type must not exceed 100 characters.'),

  body('attachment.fileSizeBytes')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('File size must be a positive integer.')
    .toInt(),

  body('attachment.thumbnailUrl')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Thumbnail URL must be valid.'),

  body('replyTo')
    .optional({ nullable: true })
    .isMongoId().withMessage('replyTo must be a valid message ID.'),

  body('expoId')
    .optional({ nullable: true })
    .isMongoId().withMessage('expoId must be a valid MongoDB ID.'),
];

const conversationParamValidation = [
  mongoId('userId'),
  ...paginationValidation,
];

// ─── All routes require authentication ───────────────────────────────────────
router.use(protect);

// ─── User Inbox & Unread Badge ────────────────────────────────────────────────
router.get('/inbox',        getInbox);
router.get('/unread-count', getUnreadCount);

// ─── Admin Moderation Routes ──────────────────────────────────────────────────
router.get(
  '/admin/conversations',
  authorizeRoles('admin'),
  paginationValidation,
  getAllConversations
);

router.get(
  '/admin/expo/:expoId/stats',
  authorizeRoles('admin'),
  mongoId('expoId'),
  getExpoMessageStats
);

// ─── Conversation Thread Routes ───────────────────────────────────────────────
router.get(
  '/conversation/:userId',
  conversationParamValidation,
  getConversation
);

router.patch(
  '/conversation/:userId/read',
  mongoId('userId'),
  markConversationAsRead
);

// ─── Send Message ─────────────────────────────────────────────────────────────
router.post(
  '/',
  requireEmailVerified,
  messageLimiter,          // ← Shared limiter from config
  sendMessageValidation,
  sendMessage
);

// ─── Single Message Operations ────────────────────────────────────────────────
router.delete(
  '/:id',
  mongoId('id'),
  deleteMessage
);

module.exports = router;