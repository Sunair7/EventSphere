'use strict';

const express                    = require('express');
const { body, param, query }     = require('express-validator');

const {
  createSession,
  getSessionsByExpo,
  getSessionById,
  updateSession,
  deleteSession,
  updateSessionStatus,
  registerForSession,
  unregisterFromSession,
  checkInAttendee,
  toggleBookmark,
  getMyRegistrations,
  getMyBookmarks,
  getExpoSchedule,
  getSessionAttendees,
} = require('../controllers/session.controller');

const {
  protect,
  authorizeRoles,
  optionalAuth,
} = require('../middleware/Auth.middleware');

const { SESSION_STATUSES, SESSION_FORMATS } = require('../models/Session');

const router = express.Router();

// ─── Reusable Validators ──────────────────────────────────────────────────────
const mongoId = (field, location = param) =>
  location(field)
    .trim()
    .notEmpty().withMessage(`${field} is required.`)
    .isMongoId().withMessage(`Invalid ${field} format.`);

const isoDate = (field, label, optional = false) => {
  const chain = body(field);
  if (optional) chain.optional({ nullable: true });
  else chain.notEmpty().withMessage(`${label} is required.`);
  return chain
    .isISO8601().withMessage(`${label} must be a valid ISO 8601 datetime.`)
    .toDate();
};

// ─── Speaker Validation ───────────────────────────────────────────────────────
const speakerValidation = [
  body('speakers')
    .optional()
    .isArray({ max: 10 }).withMessage('Speakers must be an array of up to 10 entries.'),

  body('speakers.*.name')
    .if(body('speakers').exists())
    .trim()
    .notEmpty().withMessage('Each speaker must have a name.')
    .isLength({ max: 100 }).withMessage('Speaker name must not exceed 100 characters.'),

  body('speakers.*.title')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 150 }).withMessage('Speaker title must not exceed 150 characters.'),

  body('speakers.*.company')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Speaker company must not exceed 100 characters.'),

  body('speakers.*.bio')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 1000 }).withMessage('Speaker bio must not exceed 1000 characters.'),

  body('speakers.*.avatar')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Speaker avatar must be a valid URL.'),

  body('speakers.*.userId')
    .optional({ nullable: true })
    .isMongoId().withMessage('Speaker userId must be a valid MongoDB ID.'),
];

// ─── Resource Validation ──────────────────────────────────────────────────────
const resourceValidation = [
  body('resources')
    .optional()
    .isArray().withMessage('Resources must be an array.'),

  body('resources.*.label')
    .if(body('resources').exists())
    .trim()
    .notEmpty().withMessage('Each resource must have a label.')
    .isLength({ max: 100 }).withMessage('Resource label must not exceed 100 characters.'),

  body('resources.*.url')
    .if(body('resources').exists())
    .trim()
    .notEmpty().withMessage('Each resource must have a URL.')
    .isURL().withMessage('Resource URL must be valid.'),

  body('resources.*.type')
    .optional()
    .trim()
    .isLength({ max: 30 }).withMessage('Resource type must not exceed 30 characters.'),
];

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createSessionValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Session title is required.')
    .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters.'),

  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 3000 }).withMessage('Description must not exceed 3000 characters.'),

  body('format')
    .optional()
    .isIn(SESSION_FORMATS)
    .withMessage(`Format must be one of: ${SESSION_FORMATS.join(', ')}.`),

  body('location')
    .trim()
    .notEmpty().withMessage('Session location or room is required.')
    .isLength({ max: 150 }).withMessage('Location must not exceed 150 characters.'),

  isoDate('startTime', 'Start time'),
  isoDate('endTime',   'End time'),

  body('endTime').custom((endTime, { req }) => {
    if (new Date(endTime) <= new Date(req.body.startTime)) {
      throw new Error('End time must be after start time.');
    }
    return true;
  }),

  ...speakerValidation,

  body('tags')
    .optional()
    .isArray({ max: 15 }).withMessage('Tags must be an array of up to 15 items.')
    .custom((tags) => {
      if (tags.some((t) => typeof t !== 'string' || t.length > 50)) {
        throw new Error('Each tag must be a string of up to 50 characters.');
      }
      return true;
    }),

  body('maxCapacity')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Max capacity must be a positive integer.')
    .toInt(),

  body('isPublic')
    .optional()
    .isBoolean().withMessage('isPublic must be a boolean.')
    .toBoolean(),

  body('isFeatured')
    .optional()
    .isBoolean().withMessage('isFeatured must be a boolean.')
    .toBoolean(),

  body('streamUrl')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Stream URL must be a valid URL.')
    .isLength({ max: 500 }).withMessage('Stream URL must not exceed 500 characters.'),
];

const updateSessionValidation = [
  mongoId('id'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters.'),

  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 3000 }).withMessage('Description must not exceed 3000 characters.'),

  body('format')
    .optional()
    .isIn(SESSION_FORMATS)
    .withMessage(`Format must be one of: ${SESSION_FORMATS.join(', ')}.`),

  body('location')
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage('Location must not exceed 150 characters.'),

  isoDate('startTime', 'Start time', true),
  isoDate('endTime',   'End time',   true),

  body('endTime')
    .optional()
    .custom((endTime, { req }) => {
      const start = req.body.startTime;
      if (start && endTime && new Date(endTime) <= new Date(start)) {
        throw new Error('End time must be after start time.');
      }
      return true;
    }),

  ...speakerValidation,
  ...resourceValidation,

  body('tags')
    .optional()
    .isArray({ max: 15 }).withMessage('Tags must be an array of up to 15 items.'),

  body('maxCapacity')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Max capacity must be a positive integer.')
    .toInt(),

  body('isPublic')
    .optional()
    .isBoolean().withMessage('isPublic must be a boolean.')
    .toBoolean(),

  body('isFeatured')
    .optional()
    .isBoolean().withMessage('isFeatured must be a boolean.')
    .toBoolean(),

  body('streamUrl')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Stream URL must be a valid URL.'),
];

const updateStatusValidation = [
  mongoId('id'),
  body('status')
    .trim()
    .notEmpty().withMessage('Status is required.')
    .isIn(SESSION_STATUSES)
    .withMessage(`Status must be one of: ${SESSION_STATUSES.join(', ')}.`),
];

const listQueryValidation = [
  mongoId('expoId'),

  query('format')
    .optional()
    .isIn(SESSION_FORMATS)
    .withMessage(`Format must be one of: ${SESSION_FORMATS.join(', ')}.`),

  query('status')
    .optional()
    .custom((val) => {
      const statuses = val.split(',').map((s) => s.trim());
      const invalid  = statuses.filter((s) => !SESSION_STATUSES.includes(s));
      if (invalid.length) throw new Error(`Invalid status value(s): ${invalid.join(', ')}.`);
      return true;
    }),

  query('date')
    .optional()
    .isISO8601().withMessage('date must be a valid ISO 8601 date (YYYY-MM-DD).'),

  query('location')
    .optional()
    .trim()
    .isLength({ max: 150 }).withMessage('Location filter must not exceed 150 characters.'),

  query('isFeatured')
    .optional()
    .isBoolean().withMessage('isFeatured must be true or false.'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search query must not exceed 100 characters.')
    .escape(),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50.').toInt(),
];

const myQueryValidation = [
  query('expoId')
    .optional()
    .isMongoId().withMessage('expoId must be a valid MongoDB ID.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────
// CRITICAL ORDERING: named paths (me/*, expo/*) before param paths (/:id)
// to prevent Express swallowing "me" or "expo" as an ObjectId segment.

// ── Authenticated user's own schedule data ────────────────────────────────────
router.get(
  '/me/registrations',
  protect,
  myQueryValidation,
  getMyRegistrations
);

router.get(
  '/me/bookmarks',
  protect,
  myQueryValidation,
  getMyBookmarks
);

// ── Expo-scoped routes ────────────────────────────────────────────────────────
router.get(
  '/expo/:expoId/schedule',
  optionalAuth,
  mongoId('expoId'),
  query('date').optional().isISO8601().withMessage('date must be a valid ISO 8601 date.'),
  getExpoSchedule
);

router.get(
  '/expo/:expoId',
  optionalAuth,
  listQueryValidation,
  getSessionsByExpo
);

router.post(
  '/expo/:expoId',
  protect,
  authorizeRoles('admin'),
  mongoId('expoId'),
  createSessionValidation,
  createSession
);

// ── Single session routes ─────────────────────────────────────────────────────
router.get(
  '/:id',
  optionalAuth,
  mongoId('id'),
  getSessionById
);

router.put(
  '/:id',
  protect,
  authorizeRoles('admin'),
  updateSessionValidation,
  updateSession
);

router.delete(
  '/:id',
  protect,
  authorizeRoles('admin'),
  mongoId('id'),
  deleteSession
);

// ── Session workflow routes ───────────────────────────────────────────────────
router.patch(
  '/:id/status',
  protect,
  authorizeRoles('admin'),
  updateStatusValidation,
  updateSessionStatus
);

router.get(
  '/:id/attendees',
  protect,
  authorizeRoles('admin'),
  mongoId('id'),
  getSessionAttendees
);

router.post(
  '/:id/checkin/:userId',
  protect,
  authorizeRoles('admin'),
  [mongoId('id'), mongoId('userId')],
  checkInAttendee
);

router.post(
  '/:id/register',
  protect,
  authorizeRoles('attendee', 'exhibitor'),
  mongoId('id'),
  registerForSession
);

router.delete(
  '/:id/register',
  protect,
  authorizeRoles('attendee', 'exhibitor'),
  mongoId('id'),
  unregisterFromSession
);

router.post(
  '/:id/bookmark',
  protect,
  mongoId('id'),
  toggleBookmark
);

module.exports = router;