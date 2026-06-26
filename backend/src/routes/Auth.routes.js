'use strict';

const express = require('express');
const { body, param } = require('express-validator');

const {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  changePassword,
} = require('../controllers/Auth.controller');

const {
  loginLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter,
  registerLimiter,
} = require('../config/rateLimiter');

const {
  protect,
  verifyRefreshToken,
} = require('../middleware/Auth.middleware');

const router = express.Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters.')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name contains invalid characters.'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail()
    .isLength({ max: 254 }).withMessage('Email address is too long.'),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .isLength({ max: 128 }).withMessage('Password must not exceed 128 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/)
    .withMessage('Password must contain at least one special character.'),

  body('role')
    .notEmpty().withMessage('Role is required.')
    .isIn(['exhibitor', 'attendee']).withMessage('Role must be exhibitor or attendee.'),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ max: 128 }).withMessage('Password is too long.'),
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email address is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),
];

const resetPasswordValidation = [
  param('token')
    .trim()
    .notEmpty().withMessage('Reset token is required.')
    .isHexadecimal().withMessage('Invalid reset token format.')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid reset token length.'),

  body('password')
    .notEmpty().withMessage('New password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .isLength({ max: 128 }).withMessage('Password must not exceed 128 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/)
    .withMessage('Password must contain at least one special character.'),

  body('confirmPassword')
    .notEmpty().withMessage('Please confirm your new password.')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
];

const verifyEmailValidation = [
  param('token')
    .trim()
    .notEmpty().withMessage('Verification token is required.')
    .isHexadecimal().withMessage('Invalid verification token format.')
    .isLength({ min: 64, max: 64 }).withMessage('Invalid verification token length.'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty().withMessage('Current password is required.')
    .isLength({ max: 128 }).withMessage('Password is too long.'),

  body('newPassword')
    .notEmpty().withMessage('New password is required.')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .isLength({ max: 128 }).withMessage('Password must not exceed 128 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.')
    .matches(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/)
    .withMessage('Password must contain at least one special character.')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error('New password must be different from your current password.');
      }
      return true;
    }),

  body('confirmNewPassword')
    .notEmpty().withMessage('Please confirm your new password.')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Passwords do not match.');
      }
      return true;
    }),
];

// ─── Public Routes ────────────────────────────────────────────────────────────
router.post('/register', registerLimiter, registerValidation, register);
router.post('/login', loginLimiter, loginValidation, login);
router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordValidation, forgotPassword);
router.patch('/reset-password/:token',  resetPasswordValidation,   resetPassword);
router.post('/verify-email/:token',     verifyEmailValidation,     verifyEmail);

// ─── Cookie-Authenticated Routes ──────────────────────────────────────────────
router.post('/refresh-token', verifyRefreshToken, refreshToken);

// ─── Protected Routes ─────────────────────────────────────────────────────────
router.use(protect);

router.get('/me',                                       getMe);
router.post('/logout',                                  logout);
router.post('/resend-verification', protect, resendVerificationLimiter, resendVerification);
router.patch('/change-password', changePasswordValidation, changePassword);

module.exports = router;