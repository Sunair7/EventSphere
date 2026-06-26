'use strict';

const rateLimit = require('express-rate-limit');

// ─── Base configurations ──────────────────────────────────────────────────────
const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests. Please try again later.',
    },
    standardHeaders: true,  // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,   // Disable `X-RateLimit-*` headers
    skipSuccessfulRequests: false,
  });

// ─── Auth Limiters ────────────────────────────────────────────────────────────

// Login: 10 attempts per 15 minutes per IP
const loginLimiter = createLimiter(
  15 * 60 * 1000,  // 15 minutes
  10,               // 10 attempts
  'Too many login attempts. Please try again in 15 minutes.'
);

// Forgot Password: 3 attempts per 15 minutes per IP
const forgotPasswordLimiter = createLimiter(
  15 * 60 * 1000,  // 15 minutes
  3,                // 3 attempts
  'Too many password reset requests. Please try again in 15 minutes.'
);

// Resend Verification: 2 attempts per 5 minutes per IP
const resendVerificationLimiter = createLimiter(
  5 * 60 * 1000,   // 5 minutes
  2,                // 2 attempts
  'Too many verification emails sent. Please wait 5 minutes.'
);

// Register: 3 attempts per hour per IP
const registerLimiter = createLimiter(
  60 * 60 * 1000,   // 1 hour
  3,                 // 3 attempts
  'Too many registration attempts. Please try again in an hour.'
);

// ─── General API Limiter ──────────────────────────────────────────────────────
const apiLimiter = createLimiter(
  60 * 1000,        // 1 minute
  100,              // 100 requests per minute
  'Too many requests. Please slow down.'
);

// ─── Message Sending Limiter ──────────────────────────────────────────────────
const messageLimiter = createLimiter(
  60 * 1000,        // 1 minute
  30,               // 30 messages per minute
  'Too many messages sent. Please wait a moment.'
);

// ─── File Upload Limiter ──────────────────────────────────────────────────────
const uploadLimiter = createLimiter(
  60 * 1000,        // 1 minute
  10,               // 10 uploads per minute
  'Too many uploads. Please wait a moment.'
);

module.exports = {
  loginLimiter,
  forgotPasswordLimiter,
  resendVerificationLimiter,
  registerLimiter,
  apiLimiter,
  messageLimiter,
  uploadLimiter,
};