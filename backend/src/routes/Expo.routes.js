'use strict';

const express              = require('express');
const { body, param, query } = require('express-validator');

const {
  createExpo,
  getExpos,
  getExpoById,
  getExpoBySlug,
  updateExpo,
  updateExpoStatus,
  updateFloorPlanConfig,
  deleteExpo,
  getExpoStats,
  getUpcomingExpos,
} = require('../controllers/Expo.controller');

const {
  protect,
  authorizeRoles,
  optionalAuth,
} = require('../middleware/Auth.middleware');

const { EXPO_STATUSES } = require('../models/Expo');

const router = express.Router();

// ─── Reusable Validation Chains ───────────────────────────────────────────────

const mongoId = (field, location = param) =>
  location(field)
    .trim()
    .notEmpty().withMessage(`${field} is required.`)
    .isMongoId().withMessage(`Invalid ${field} format.`);

const dateField = (field, label) =>
  body(field)
    .notEmpty().withMessage(`${label} is required.`)
    .isISO8601().withMessage(`${label} must be a valid ISO 8601 date (e.g. 2025-09-01T09:00:00Z).`)
    .toDate();

const optionalDateField = (field, label) =>
  body(field)
    .optional({ nullable: true })
    .isISO8601().withMessage(`${label} must be a valid ISO 8601 date.`)
    .toDate();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createExpoValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Expo title is required.')
    .isLength({ min: 3, max: 150 }).withMessage('Title must be between 3 and 150 characters.'),

  body('description')
    .trim()
    .notEmpty().withMessage('Description is required.')
    .isLength({ min: 20, max: 5000 }).withMessage('Description must be between 20 and 5000 characters.'),

  body('theme')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Theme must not exceed 100 characters.'),

  dateField('startDate', 'Start date'),
  dateField('endDate',   'End date'),
  optionalDateField('registrationDeadline', 'Registration deadline'),

  body('endDate').custom((endDate, { req }) => {
    if (new Date(endDate) <= new Date(req.body.startDate)) {
      throw new Error('End date must be after start date.');
    }
    return true;
  }),

  body('registrationDeadline')
    .optional({ nullable: true })
    .custom((deadline, { req }) => {
      if (deadline && new Date(deadline) > new Date(req.body.startDate)) {
        throw new Error('Registration deadline must be on or before the start date.');
      }
      return true;
    }),

  // Address
  body('address')
    .notEmpty().withMessage('Address is required.')
    .isObject().withMessage('Address must be an object.'),

  body('address.city')
    .trim()
    .notEmpty().withMessage('City is required.')
    .isLength({ max: 100 }).withMessage('City must not exceed 100 characters.'),

  body('address.country')
    .trim()
    .notEmpty().withMessage('Country is required.')
    .isLength({ max: 100 }).withMessage('Country must not exceed 100 characters.'),

  body('address.venue')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 150 }).withMessage('Venue must not exceed 150 characters.'),

  body('address.street')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Street must not exceed 200 characters.'),

  body('address.zipCode')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Zip code must not exceed 20 characters.'),

  // Floor plan config
  body('floorPlanConfig')
    .notEmpty().withMessage('Floor plan configuration is required.')
    .isObject().withMessage('Floor plan configuration must be an object.'),

  body('floorPlanConfig.rows')
    .notEmpty().withMessage('Floor plan rows are required.')
    .isInt({ min: 1, max: 50 }).withMessage('Rows must be between 1 and 50.')
    .toInt(),

  body('floorPlanConfig.cols')
    .notEmpty().withMessage('Floor plan columns are required.')
    .isInt({ min: 1, max: 50 }).withMessage('Columns must be between 1 and 50.')
    .toInt(),

  body('floorPlanConfig.boothWidth')
    .optional()
    .isFloat({ min: 1 }).withMessage('Booth width must be at least 1 metre.')
    .toFloat(),

  body('floorPlanConfig.boothHeight')
    .optional()
    .isFloat({ min: 1 }).withMessage('Booth height must be at least 1 metre.')
    .toFloat(),

  body('floorPlanConfig.aisleWidth')
    .optional()
    .isFloat({ min: 0 }).withMessage('Aisle width must be 0 or greater.')
    .toFloat(),

  // Optional fields
  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array of up to 20 items.')
    .custom((tags) => {
      if (tags.some((t) => typeof t !== 'string' || t.length > 50)) {
        throw new Error('Each tag must be a string of up to 50 characters.');
      }
      return true;
    }),

  body('maxAttendees')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Max attendees must be a positive integer.')
    .toInt(),

  body('isPublic')
    .optional()
    .isBoolean().withMessage('isPublic must be a boolean.')
    .toBoolean(),
];

const updateExpoValidation = [
  mongoId('id'),

  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 150 }).withMessage('Title must be between 3 and 150 characters.'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 20, max: 5000 }).withMessage('Description must be between 20 and 5000 characters.'),

  body('theme')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Theme must not exceed 100 characters.'),

  optionalDateField('startDate', 'Start date'),
  optionalDateField('endDate',   'End date'),
  optionalDateField('registrationDeadline', 'Registration deadline'),

  body('endDate')
    .optional()
    .custom((endDate, { req }) => {
      const start = req.body.startDate;
      if (start && endDate && new Date(endDate) <= new Date(start)) {
        throw new Error('End date must be after start date.');
      }
      return true;
    }),

  body('address.city')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('City must not exceed 100 characters.'),

  body('address.country')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Country must not exceed 100 characters.'),

  body('tags')
    .optional()
    .isArray({ max: 20 }).withMessage('Tags must be an array of up to 20 items.'),

  body('maxAttendees')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('Max attendees must be a positive integer.')
    .toInt(),

  body('isPublic')
    .optional()
    .isBoolean().withMessage('isPublic must be a boolean.')
    .toBoolean(),
];

const updateStatusValidation = [
  mongoId('id'),

  body('status')
    .trim()
    .notEmpty().withMessage('Status is required.')
    .isIn(['published', 'cancelled'])
    .withMessage('Status must be "published" or "cancelled".'),
];

const updateFloorPlanValidation = [
  mongoId('id'),

  body('floorPlanConfig')
    .notEmpty().withMessage('floorPlanConfig is required.')
    .isObject().withMessage('floorPlanConfig must be an object.'),

  body('floorPlanConfig.rows')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Rows must be between 1 and 50.')
    .toInt(),

  body('floorPlanConfig.cols')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Columns must be between 1 and 50.')
    .toInt(),

  body('floorPlanConfig.boothWidth')
    .optional()
    .isFloat({ min: 1 }).withMessage('Booth width must be at least 1 metre.')
    .toFloat(),

  body('floorPlanConfig.boothHeight')
    .optional()
    .isFloat({ min: 1 }).withMessage('Booth height must be at least 1 metre.')
    .toFloat(),
];

const listQueryValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50.')
    .toInt(),

  query('status')
    .optional()
    .custom((val) => {
      const statuses = val.split(',').map((s) => s.trim());
      const invalid  = statuses.filter((s) => !EXPO_STATUSES.includes(s));
      if (invalid.length) throw new Error(`Invalid status value(s): ${invalid.join(', ')}.`);
      return true;
    }),

  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'start-asc', 'start-desc', 'title'])
    .withMessage('Sort must be one of: newest, oldest, start-asc, start-desc, title.'),

  query('startFrom')
    .optional()
    .isISO8601().withMessage('startFrom must be a valid ISO 8601 date.'),

  query('startTo')
    .optional()
    .isISO8601().withMessage('startTo must be a valid ISO 8601 date.'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search query must not exceed 100 characters.')
    .escape(),
];

// ─── Public Routes ────────────────────────────────────────────────────────────
router.get('/upcoming',                                      getUpcomingExpos);
router.get('/slug/:slug',         optionalAuth,              getExpoBySlug);
router.get('/',                   optionalAuth, listQueryValidation, getExpos);
router.get('/:id',                optionalAuth, mongoId('id'),       getExpoById);

// ─── Admin-Only Routes ────────────────────────────────────────────────────────
router.use(protect, authorizeRoles('admin'));

router.post('/',                  createExpoValidation,       createExpo);
router.put('/:id',                updateExpoValidation,       updateExpo);
router.patch('/:id/status',       updateStatusValidation,     updateExpoStatus);
router.patch('/:id/floor-plan',   updateFloorPlanValidation,  updateFloorPlanConfig);
router.get('/:id/stats',          mongoId('id'),              getExpoStats);
router.delete('/:id',             mongoId('id'),              deleteExpo);

module.exports = router;