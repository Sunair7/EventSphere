'use strict';

const express                    = require('express');
const { body, param, query }     = require('express-validator');

const {
  getFloorPlan,
  getBoothsByExpo,
  getBoothById,
  createBooth,
  updateBooth,
  deleteBooth,
  reserveBooth,
  approveBooth,
  rejectBooth,
  releaseBooth,
  lockBooth,
  getAvailabilitySummary,
  getPublicGrid,
  generateBooths,   
  regenerateBooths,
  cancelBoothReservation,
} = require('../controllers/Booth.controller');

const {
  protect,
  authorizeRoles,
  optionalAuth,
  requireProfileComplete,
  requireEmailVerified,
} = require('../middleware/Auth.middleware');

const { BOOTH_STATUSES, BOOTH_SIZES, BOOTH_TYPES } = require('../models/Booth');

const router = express.Router();

// ─── Reusable Validators ──────────────────────────────────────────────────────
const mongoId = (field, location = param) =>
  location(field)
    .trim()
    .notEmpty().withMessage(`${field} is required.`)
    .isMongoId().withMessage(`Invalid ${field} format.`);

const optionalNote = body('note')
  .optional({ nullable: true })
  .trim()
  .isLength({ max: 500 }).withMessage('Note must not exceed 500 characters.')
  .escape();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createBoothValidation = [
  body('boothNumber')
    .trim()
    .notEmpty().withMessage('Booth number is required.')
    .toUpperCase()
    .matches(/^[A-Z0-9\-]+$/).withMessage('Booth number may only contain letters, numbers, and hyphens.')
    .isLength({ max: 20 }).withMessage('Booth number must not exceed 20 characters.'),

  body('dimensions')
    .trim()
    .notEmpty().withMessage('Dimensions are required (e.g. "3m x 3m").')
    .isLength({ max: 30 }).withMessage('Dimensions must not exceed 30 characters.'),

  body('label')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 60 }).withMessage('Label must not exceed 60 characters.'),

  body('type')
    .optional()
    .isIn(BOOTH_TYPES)
    .withMessage(`Type must be one of: ${BOOTH_TYPES.join(', ')}.`),

  body('size')
    .optional()
    .isIn(BOOTH_SIZES)
    .withMessage(`Size must be one of: ${BOOTH_SIZES.join(', ')}.`),

  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters.'),

  body('gridCoordinates')
    .notEmpty().withMessage('Grid coordinates are required.')
    .isObject().withMessage('Grid coordinates must be an object.'),

  body('gridCoordinates.row')
    .notEmpty().withMessage('Grid row is required.')
    .isInt({ min: 0 }).withMessage('Row must be a non-negative integer.')
    .toInt(),

  body('gridCoordinates.col')
    .notEmpty().withMessage('Grid column is required.')
    .isInt({ min: 0 }).withMessage('Column must be a non-negative integer.')
    .toInt(),

  body('gridCoordinates.rowSpan')
    .optional()
    .isInt({ min: 1, max: 4 }).withMessage('Row span must be between 1 and 4.')
    .toInt(),

  body('gridCoordinates.colSpan')
    .optional()
    .isInt({ min: 1, max: 4 }).withMessage('Column span must be between 1 and 4.')
    .toInt(),

  // Amenities
  body('amenities.power')
    .optional().isBoolean().withMessage('amenities.power must be a boolean.').toBoolean(),
  body('amenities.wifi')
    .optional().isBoolean().withMessage('amenities.wifi must be a boolean.').toBoolean(),
  body('amenities.water')
    .optional().isBoolean().withMessage('amenities.water must be a boolean.').toBoolean(),
  body('amenities.lighting')
    .optional().isBoolean().withMessage('amenities.lighting must be a boolean.').toBoolean(),
  body('amenities.storage')
    .optional().isBoolean().withMessage('amenities.storage must be a boolean.').toBoolean(),
  body('amenities.carpeted')
    .optional().isBoolean().withMessage('amenities.carpeted must be a boolean.').toBoolean(),

  // Pricing
  body('pricing.basePrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Base price must be 0 or greater.')
    .toFloat(),
  body('pricing.currency')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter ISO code (e.g. USD).')
    .isAlpha().withMessage('Currency must contain only letters.')
    .toUpperCase(),
  body('pricing.isPremium')
    .optional().isBoolean().withMessage('isPremium must be a boolean.').toBoolean(),
];

const updateBoothValidation = [
  mongoId('id'),

  body('label')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 60 }).withMessage('Label must not exceed 60 characters.'),

  body('type')
    .optional()
    .isIn(BOOTH_TYPES)
    .withMessage(`Type must be one of: ${BOOTH_TYPES.join(', ')}.`),

  body('size')
    .optional()
    .isIn(BOOTH_SIZES)
    .withMessage(`Size must be one of: ${BOOTH_SIZES.join(', ')}.`),

  body('dimensions')
    .optional()
    .trim()
    .isLength({ max: 30 }).withMessage('Dimensions must not exceed 30 characters.'),

  body('description')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Description must not exceed 500 characters.'),

  body('pricing.basePrice')
    .optional()
    .isFloat({ min: 0 }).withMessage('Base price must be 0 or greater.')
    .toFloat(),

  body('pricing.currency')
    .optional()
    .trim()
    .isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter ISO code.')
    .isAlpha().withMessage('Currency must contain only letters.')
    .toUpperCase(),

  body('pricing.isPremium')
    .optional().isBoolean().withMessage('isPremium must be a boolean.').toBoolean(),
];

const listBoothsValidation = [
  mongoId('expoId'),

  query('status')
    .optional()
    .custom((val) => {
      const statuses = val.split(',').map((s) => s.trim());
      const invalid  = statuses.filter((s) => !BOOTH_STATUSES.includes(s));
      if (invalid.length) throw new Error(`Invalid status value(s): ${invalid.join(', ')}.`);
      return true;
    }),

  query('type')
    .optional()
    .isIn(BOOTH_TYPES)
    .withMessage(`Type must be one of: ${BOOTH_TYPES.join(', ')}.`),

  query('size')
    .optional()
    .isIn(BOOTH_SIZES)
    .withMessage(`Size must be one of: ${BOOTH_SIZES.join(', ')}.`),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100.').toInt(),
];

const approveRejectValidation = [
  mongoId('id'),
  optionalNote,
];

// ─── Expo-Scoped Routes ───────────────────────────────────────────────────────
// IMPORTANT: Specific sub-paths (/floor-plan, /availability) must be registered
// before the generic /:expoId param route to avoid Express path conflicts.

// Public — floor plan is visible to anyone browsing the expo
router.get(
  '/expo/:expoId/floor-plan',
  optionalAuth,
  mongoId('expoId'),
  getFloorPlan
);

// Authenticated — availability summary (used in exhibitor discovery)
router.get(
  '/expo/:expoId/availability',
  protect,
  mongoId('expoId'),
  getAvailabilitySummary
);

// Public — lightweight booth occupancy grid for attendees
router.get(
  '/expo/:expoId/public-grid',
  optionalAuth,
  mongoId('expoId'),
  getPublicGrid
);

// Admin — full paginated booth list for the management table
router.get(
  '/expo/:expoId',
  protect,
  authorizeRoles('admin'),
  listBoothsValidation,
  getBoothsByExpo
);

// Admin — create a single booth inside an expo
router.post(
  '/expo/:expoId',
  protect,
  authorizeRoles('admin'),
  mongoId('expoId'),
  createBoothValidation,
  createBooth
);

// ─── Single Booth Routes ──────────────────────────────────────────────────────

// Authenticated — booth detail view
router.get(
  '/:id',
  protect,
  mongoId('id'),
  getBoothById
);

// Admin — update booth metadata
router.put(
  '/:id',
  protect,
  authorizeRoles('admin'),
  updateBoothValidation,
  updateBooth
);

// Admin — hard delete a booth
router.delete(
  '/:id',
  protect,
  authorizeRoles('admin'),
  mongoId('id'),
  deleteBooth
);

// ─── Booth Workflow Routes ────────────────────────────────────────────────────

// Exhibitor — acquire a 30-second optimistic UI lock
router.post(
  '/:id/lock',
  protect,
  authorizeRoles('exhibitor'),
  requireEmailVerified,
  requireProfileComplete,
  mongoId('id'),
  lockBooth
);

// Exhibitor — submit a reservation (available → pending)
router.post(
  '/:id/reserve',
  protect,
  authorizeRoles('exhibitor'),
  requireEmailVerified,
  requireProfileComplete,
  mongoId('id'),
  reserveBooth
);

router.delete(
  '/:id/cancel',
  protect,
  authorizeRoles('exhibitor'),
  requireEmailVerified,
  mongoId('id'),
  cancelBoothReservation
);

// Admin — approve reservation (pending → assigned)
router.patch(
  '/:id/approve',
  protect,
  authorizeRoles('admin'),
  approveRejectValidation,
  approveBooth
);

// Admin — reject reservation (pending → available)
router.patch(
  '/:id/reject',
  protect,
  authorizeRoles('admin'),
  approveRejectValidation,
  rejectBooth
);

// Admin — force-release any booth back to available
router.patch(
  '/:id/release',
  protect,
  authorizeRoles('admin'),
  approveRejectValidation,
  releaseBooth
);

// Admin — generate booths for an expo
router.post(
  '/expo/:expoId/generate',
  protect,
  authorizeRoles('admin'),
  mongoId('expoId'),
  generateBooths
);

// Admin — regenerate booths (clear and recreate)
router.post(
  '/expo/:expoId/regenerate',
  protect,
  authorizeRoles('admin'),
  mongoId('expoId'),
  regenerateBooths
);

module.exports = router;