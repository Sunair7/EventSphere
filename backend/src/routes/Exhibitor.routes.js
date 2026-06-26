'use strict';

const express            = require('express');
const { body, param, query } = require('express-validator');

const {
  createProfile,
  getMyProfile,
  updateMyProfile,
  getAllExhibitors,
  getPendingApplications,
  getExhibitorById,
  getPublicExhibitors,
  approveApplication,
  rejectApplication,
  suspendExhibitor,
  uploadDocument,
  deleteDocument,
  reviewDocument,
} = require('../controllers/exhibitor.controller');

const {
  protect,
  authorizeRoles,
} = require('../middleware/Auth.middleware');

const { APPLICATION_STATUSES, DOCUMENT_STATUSES, DOCUMENT_TYPES } = require('../models/Exhibitorprofile');

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
  .isLength({ max: 1000 }).withMessage('Note must not exceed 1000 characters.')
  .escape();

const requiredNote = body('note')
  .trim()
  .notEmpty().withMessage('A reason is required.')
  .isLength({ min: 10, max: 1000 }).withMessage('Reason must be between 10 and 1000 characters.')
  .escape();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const contactPersonValidation = [
  body('contactPerson.name')
    .trim()
    .notEmpty().withMessage('Contact person name is required.')
    .isLength({ max: 100 }).withMessage('Contact name must not exceed 100 characters.'),

  body('contactPerson.email')
    .trim()
    .notEmpty().withMessage('Contact person email is required.')
    .isEmail().withMessage('Contact person email must be valid.')
    .normalizeEmail(),

  body('contactPerson.title')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Contact title must not exceed 100 characters.'),

  body('contactPerson.phone')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 30 }).withMessage('Phone number must not exceed 30 characters.')
    .matches(/^[+\d\s\-().]*$/).withMessage('Phone number contains invalid characters.'),
];

const createProfileValidation = [
  body('companyName')
    .trim()
    .notEmpty().withMessage('Company name is required.')
    .isLength({ min: 2, max: 150 }).withMessage('Company name must be between 2 and 150 characters.'),

  body('description')
    .trim()
    .notEmpty().withMessage('Company description is required.')
    .isLength({ min: 20, max: 3000 }).withMessage('Description must be between 20 and 3000 characters.'),

  body('tagline')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Tagline must not exceed 200 characters.'),

  body('industry')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Industry must not exceed 100 characters.'),

  body('products')
    .optional()
    .isArray({ max: 30 }).withMessage('Products must be an array of up to 30 items.')
    .custom((products) => {
      if (products.some((p) => typeof p !== 'string' || p.length > 100)) {
        throw new Error('Each product must be a string of up to 100 characters.');
      }
      return true;
    }),

  body('logo')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Logo must be a valid URL.')
    .isLength({ max: 500 }).withMessage('Logo URL must not exceed 500 characters.'),

  body('bannerImage')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Banner image must be a valid URL.')
    .isLength({ max: 500 }).withMessage('Banner image URL must not exceed 500 characters.'),

  ...contactPersonValidation,

  body('socialLinks.website')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Website must be a valid URL.'),

  body('socialLinks.linkedin')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('LinkedIn must be a valid URL.'),

  body('socialLinks.twitter')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Twitter must be a valid URL.'),

  body('socialLinks.instagram')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Instagram must be a valid URL.'),
];

const updateProfileValidation = [
  body('companyName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 150 }).withMessage('Company name must be between 2 and 150 characters.'),

  body('description')
    .optional()
    .trim()
    .isLength({ min: 20, max: 3000 }).withMessage('Description must be between 20 and 3000 characters.'),

  body('tagline')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 200 }).withMessage('Tagline must not exceed 200 characters.'),

  body('industry')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Industry must not exceed 100 characters.'),

  body('products')
    .optional()
    .isArray({ max: 30 }).withMessage('Products must be an array of up to 30 items.')
    .custom((products) => {
      if (products.some((p) => typeof p !== 'string' || p.length > 100)) {
        throw new Error('Each product must be a string of up to 100 characters.');
      }
      return true;
    }),

  body('logo')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Logo must be a valid URL.'),

  body('bannerImage')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Banner image must be a valid URL.'),

  body('contactPerson.name')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Contact name must not exceed 100 characters.'),

  body('contactPerson.email')
    .optional()
    .trim()
    .isEmail().withMessage('Contact person email must be valid.')
    .normalizeEmail(),

  body('contactPerson.title')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Contact title must not exceed 100 characters.'),

  body('contactPerson.phone')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 30 }).withMessage('Phone number must not exceed 30 characters.')
    .matches(/^[+\d\s\-().]*$/).withMessage('Phone number contains invalid characters.'),

  body('socialLinks.website')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Website must be a valid URL.'),

  body('socialLinks.linkedin')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('LinkedIn must be a valid URL.'),
];

const uploadDocumentValidation = [
  body('type')
    .trim()
    .notEmpty().withMessage('Document type is required.')
    .isIn(DOCUMENT_TYPES).withMessage(`Document type must be one of: ${DOCUMENT_TYPES.join(', ')}.`),

  body('fileUrl')
    .trim()
    .notEmpty().withMessage('File URL is required.')
    .isURL().withMessage('fileUrl must be a valid URL.')
    .isLength({ max: 1000 }).withMessage('File URL must not exceed 1000 characters.'),

  body('fileName')
    .trim()
    .notEmpty().withMessage('File name is required.')
    .isLength({ max: 255 }).withMessage('File name must not exceed 255 characters.'),

  body('label')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('Label must not exceed 100 characters.'),

  body('fileSizeBytes')
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage('File size must be a positive integer.')
    .toInt(),

  body('mimeType')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 100 }).withMessage('MIME type must not exceed 100 characters.'),
];

const reviewDocumentValidation = [
  mongoId('id'),
  mongoId('docId'),

  body('status')
    .trim()
    .notEmpty().withMessage('Review status is required.')
    .isIn(['verified', 'rejected'])
    .withMessage('Status must be "verified" or "rejected".'),

  body('note')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 500 }).withMessage('Note must not exceed 500 characters.')
    .escape(),
];

const listQueryValidation = [
  query('status')
    .optional()
    .custom((val) => {
      const statuses = val.split(',').map((s) => s.trim());
      const invalid  = statuses.filter((s) => !APPLICATION_STATUSES.includes(s));
      if (invalid.length) throw new Error(`Invalid status value(s): ${invalid.join(', ')}.`);
      return true;
    }),

  query('isVerified')
    .optional()
    .isBoolean().withMessage('isVerified must be true or false.'),

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

// ─── All routes require authentication ───────────────────────────────────────
router.use(protect);

// ─── Exhibitor Profile Routes ─────────────────────────────────────────────────
// IMPORTANT: /profile/me and /profile/documents must be registered BEFORE
// /:id to prevent Express matching "me" as a MongoDB ObjectId param.

router.post(
  '/profile',
  authorizeRoles('exhibitor'),
  createProfileValidation,
  createProfile
);

router.get(
  '/profile/me',
  authorizeRoles('exhibitor'),
  getMyProfile
);

router.put(
  '/profile/me',
  authorizeRoles('exhibitor'),
  updateProfileValidation,
  updateMyProfile
);

router.post(
  '/profile/documents',
  authorizeRoles('exhibitor'),
  uploadDocumentValidation,
  uploadDocument
);

router.delete(
  '/profile/documents/:docId',
  authorizeRoles('exhibitor'),
  mongoId('docId'),
  deleteDocument
);

// ─── Public-Facing Exhibitor Directory ───────────────────────────────────────
// Must be before /:id to prevent collision
router.get(
  '/public',
  query('search').optional().trim().isLength({ max: 100 }).escape(),
  query('industry').optional().trim().isLength({ max: 100 }),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  getPublicExhibitors
);

// ─── Admin-Only Routes ────────────────────────────────────────────────────────
// Named sub-paths before /:id param
router.get(
  '/pending',
  authorizeRoles('admin'),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 50 }).toInt(),
  getPendingApplications
);

router.get(
  '/',
  authorizeRoles('admin'),
  listQueryValidation,
  getAllExhibitors
);

router.get(
  '/:id',
  authorizeRoles('admin'),
  mongoId('id'),
  getExhibitorById
);

router.patch(
  '/:id/approve',
  authorizeRoles('admin'),
  mongoId('id'),
  optionalNote,
  approveApplication
);

router.patch(
  '/:id/reject',
  authorizeRoles('admin'),
  mongoId('id'),
  requiredNote,
  rejectApplication
);

router.patch(
  '/:id/suspend',
  authorizeRoles('admin'),
  mongoId('id'),
  optionalNote,
  suspendExhibitor
);

router.patch(
  '/:id/documents/:docId/review',
  authorizeRoles('admin'),
  reviewDocumentValidation,
  reviewDocument
);

module.exports = router;