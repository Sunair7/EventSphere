'use strict';

const express                = require('express');
const { body, param, query } = require('express-validator');
const mongoose               = require('mongoose');
const { validationResult }   = require('express-validator');
const User                   = require('../models/User');
const ExhibitorProfile       = require('../models/ExhibitorProfile');

const {
  protect,
  authorizeRoles,
} = require('../middleware/Auth.middleware');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createError = (statusCode, message) => {
  const err      = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const handleValidationErrors = (req, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    const err      = new Error(messages[0]);
    err.statusCode = 422;
    err.errors     = messages;
    return next(err);
  }
  return null;
};

// ─── Validators ───────────────────────────────────────────────────────────────
const mongoId = (field, location = param) =>
  location(field)
    .trim()
    .notEmpty().withMessage(`${field} is required.`)
    .isMongoId().withMessage(`Invalid ${field} format.`);

const updateMeValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name contains invalid characters.'),

  body('avatar')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Avatar must be a valid URL.')
    .isLength({ max: 500 }).withMessage('Avatar URL must not exceed 500 characters.'),
];

const adminUpdateUserValidation = [
  mongoId('id'),

  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters.'),

  body('role')
    .optional()
    .isIn(['admin', 'exhibitor', 'attendee'])
    .withMessage('Role must be admin, exhibitor, or attendee.'),

  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean.')
    .toBoolean(),

  body('avatar')
    .optional({ nullable: true })
    .trim()
    .isURL().withMessage('Avatar must be a valid URL.'),
];

const listUsersValidation = [
  query('role')
    .optional()
    .isIn(['admin', 'exhibitor', 'attendee'])
    .withMessage('Role must be admin, exhibitor, or attendee.'),

  query('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be true or false.'),

  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search must not exceed 100 characters.')
    .escape(),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer.').toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50.').toInt(),

  query('sort')
    .optional()
    .isIn(['newest', 'oldest', 'name', 'lastLogin'])
    .withMessage('Sort must be one of: newest, oldest, name, lastLogin.'),
];

// ─── All routes require authentication ───────────────────────────────────────
router.use(protect);

// ─── @route   GET /api/v1/users/me ───────────────────────────────────────────
// @access  Authenticated
router.get('/me', async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).lean();
    if (!user) return next(createError(404, 'User not found.'));

    return res.status(200).json({ success: true, data: { user } });
  } catch (err) {
    return next(err);
  }
});

// ─── @route   PATCH /api/v1/users/me ─────────────────────────────────────────
// @access  Authenticated
router.patch('/me', updateMeValidation, async (req, res, next) => {
  try {
    if (handleValidationErrors(req, next)) return;

    const allowedFields = ['name', 'avatar'];
    const updates       = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return next(createError(422, 'No valid fields provided for update.'));
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data:    { user },
    });
  } catch (err) {
    return next(err);
  }
});

// ─── @route   DELETE /api/v1/users/me ────────────────────────────────────────
// @access  Authenticated
// Soft-deactivates the requesting user's own account
router.delete('/me', async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });

    // Clear refresh token cookie
    res.clearCookie('refreshToken', { httpOnly: true, path: '/api/v1/auth' });

    return res.status(200).json({
      success: true,
      message: 'Your account has been deactivated successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

// ─── @route   GET /api/v1/users/search ───────────────────────────────────────
// @access  Authenticated
// Used by the chat compose dialog to find users to message
router.get(
  '/search',
  query('q')
    .trim()
    .notEmpty().withMessage('Search query is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Query must be between 2 and 100 characters.')
    .escape(),
  query('role')
    .optional()
    .isIn(['admin', 'exhibitor', 'attendee'])
    .withMessage('Role must be admin, exhibitor, or attendee.'),
  async (req, res, next) => {
    try {
      if (handleValidationErrors(req, next)) return;

      const { q, role } = req.query;

      const filter = {
        isActive: true,
        _id:      { $ne: req.user._id },
        $or: [
          { name:  { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ],
      };

      if (role) filter.role = role;

      const users = await User.find(filter)
        .select('name email role avatar')
        .limit(15)
        .lean();

      return res.status(200).json({
        success: true,
        data:    { users, total: users.length },
      });
    } catch (err) {
      return next(err);
    }
  }
);

// ─── Admin-Only Routes ────────────────────────────────────────────────────────
router.use(authorizeRoles('admin'));

// ─── @route   GET /api/v1/users ──────────────────────────────────────────────
router.get('/', listUsersValidation, async (req, res, next) => {
  try {
    if (handleValidationErrors(req, next)) return;

    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;

    const { role, isActive, search, sort } = req.query;

    const filter = {};
    if (role !== undefined)     filter.role     = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    if (search?.trim()) {
      filter.$or = [
        { name:  { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const sortMap = {
      newest:    { createdAt: -1 },
      oldest:    { createdAt:  1 },
      name:      { name:       1 },
      lastLogin: { lastLoginAt: -1 },
    };
    const sortStage = sortMap[sort] || sortMap.newest;

    const [users, total] = await Promise.all([
      User.find(filter)
        .select(User.publicFields())
        .sort(sortStage)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    res.setHeader('X-Total-Count', total);

    return res.status(200).json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages:  Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});

// ─── @route   GET /api/v1/users/:id ──────────────────────────────────────────
router.get('/:id', mongoId('id'), async (req, res, next) => {
  try {
    if (handleValidationErrors(req, next)) return;

    const user = await User.findById(req.params.id)
      .select(User.publicFields())
      .lean();

    if (!user) return next(createError(404, 'User not found.'));

    // Attach exhibitor profile snapshot if applicable
    let exhibitorProfile = null;
    if (user.role === 'exhibitor') {
      exhibitorProfile = await ExhibitorProfile.findOne({ userId: user._id })
        .select('companyName applicationStatus isVerified industry logo')
        .lean();
    }

    return res.status(200).json({
      success: true,
      data:    { user, exhibitorProfile },
    });
  } catch (err) {
    return next(err);
  }
});

// ─── @route   PATCH /api/v1/users/:id ────────────────────────────────────────
router.patch('/:id', adminUpdateUserValidation, async (req, res, next) => {
  try {
    if (handleValidationErrors(req, next)) return;

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid user ID format.'));
    }

    // Prevent admins from demoting themselves
    if (id === req.user._id.toString() && req.body.role && req.body.role !== 'admin') {
      return next(createError(403, 'Admins cannot change their own role.'));
    }

    const allowedFields = ['name', 'role', 'isActive', 'avatar'];
    const updates       = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return next(createError(422, 'No valid fields provided for update.'));
    }

    const user = await User.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select(User.publicFields()).lean();

    if (!user) return next(createError(404, 'User not found.'));

    return res.status(200).json({
      success: true,
      message: 'User updated successfully.',
      data:    { user },
    });
  } catch (err) {
    return next(err);
  }
});

// ─── @route   DELETE /api/v1/users/:id ───────────────────────────────────────
// Soft-deactivates a user account — data is preserved for audit purposes
router.delete('/:id', mongoId('id'), async (req, res, next) => {
  try {
    if (handleValidationErrors(req, next)) return;

    const { id } = req.params;

    if (id === req.user._id.toString()) {
      return next(createError(403, 'Admins cannot deactivate their own account via this endpoint. Use DELETE /users/me.'));
    }

    const user = await User.findById(id);
    if (!user) return next(createError(404, 'User not found.'));

    if (!user.isActive) {
      return next(createError(422, 'This account is already deactivated.'));
    }

    user.isActive = false;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'User account deactivated successfully.',
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;