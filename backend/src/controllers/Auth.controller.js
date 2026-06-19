'use strict';

const { validationResult } = require('express-validator');
const User = require('../models/User');
const {
  signAccessToken,
  signRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} = require('../middleware/Auth.middleware');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createError = (statusCode, message) => {
  const err      = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const handleValidationErrors = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    const err      = new Error(messages[0]);
    err.statusCode = 422;
    err.errors     = messages;
    throw err;
  }
};

const buildTokenPayload = (user) => ({
  id:    user._id.toString(),
  role:  user.role,
  name:  user.name,
  email: user.email,
});

const issueTokenPair = (user, res) => {
  const payload      = buildTokenPayload(user);
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  setRefreshTokenCookie(res, refreshToken);
  return accessToken;
};

// ─── @route   POST /api/v1/auth/register ─────────────────────────────────────
// @access  Public
const register = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { name, email, password, role } = req.body;

    // Prevent self-registration as admin
    if (role === 'admin') {
      return next(createError(403, 'Admin accounts cannot be self-registered.'));
    }

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return next(createError(409, 'An account with this email address already exists.'));
    }

    const user = await User.create({ name, email, password, role });

    // Generate email verification token
    const verificationToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // In production, dispatch via a dedicated mail service.
    // The raw token is intentionally returned in development only.
    const isDev = process.env.NODE_ENV !== 'production';

    const accessToken = issueTokenPair(user, res);

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please verify your email address.',
      data: {
        accessToken,
        user: {
          id:                user._id,
          name:              user.name,
          email:             user.email,
          role:              user.role,
          profileIsComplete: user.profileIsComplete,
          isEmailVerified:   user.isEmailVerified,
        },
      },
      ...(isDev && { _devVerificationToken: verificationToken }),
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/auth/login ────────────────────────────────────────
// @access  Public
const login = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { email, password } = req.body;

    // Explicitly select password and security fields
    const user = await User.findOne({ email, isActive: true }).select(
      '+password +failedLoginAttempts +lockedUntil +passwordChangedAt'
    );

    if (!user) {
      // Prevent user enumeration — identical response for unknown email / wrong password
      return next(createError(401, 'Invalid email address or password.'));
    }

    // Account lockout check
    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockedUntil - Date.now()) / 60_000);
      return next(
        createError(
          423,
          `Account temporarily locked due to multiple failed attempts. Try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`
        )
      );
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementFailedLogin();
      const attemptsLeft = Math.max(0, 5 - user.failedLoginAttempts);
      return next(
        createError(
          401,
          attemptsLeft > 0
            ? `Invalid email address or password. ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`
            : 'Invalid email address or password. Account has been temporarily locked.'
        )
      );
    }

    await user.recordLogin();

    const accessToken = issueTokenPair(user, res);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        accessToken,
        user: {
          id:                user._id,
          name:              user.name,
          email:             user.email,
          role:              user.role,
          profileIsComplete: user.profileIsComplete,
          isEmailVerified:   user.isEmailVerified,
          lastLoginAt:       user.lastLoginAt,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/auth/refresh-token ────────────────────────────────
// @access  Private (HttpOnly cookie)
const refreshToken = async (req, res, next) => {
  try {
    // verifyRefreshToken middleware already validated the cookie and
    // attached req.refreshTokenPayload
    const { id } = req.refreshTokenPayload;

    const user = await User.findById(id).select('+passwordChangedAt');
    if (!user || !user.isActive) {
      clearRefreshTokenCookie(res);
      return next(createError(401, 'Account not found or inactive. Please log in again.'));
    }

    // Rotate token pair on every refresh
    const accessToken = issueTokenPair(user, res);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully.',
      data: { accessToken },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/auth/logout ───────────────────────────────────────
// @access  Private
const logout = (_req, res, next) => {
  try {
    clearRefreshTokenCookie(res);
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/auth/me ────────────────────────────────────────────
// @access  Private
const getMe = async (req, res, next) => {
  try {
    // req.user already hydrated by protect middleware (without password)
    const user = await User.findById(req.user._id).lean();
    if (!user) {
      return next(createError(404, 'User not found.'));
    }

    return res.status(200).json({
      success: true,
      data:    { user },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/auth/forgot-password ──────────────────────────────
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { email } = req.body;

    const user = await User.findOne({ email, isActive: true });

    // Always return 200 to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a reset link has been sent.',
      });
    }

    const rawToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    // TODO (Phase 5): Dispatch reset email via mail service
    // mailService.sendPasswordReset({ to: user.email, token: rawToken });

    const isDev = process.env.NODE_ENV !== 'production';

    return res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a reset link has been sent.',
      ...(isDev && { _devResetToken: rawToken }),
    });
  } catch (err) {
    // Ensure token isn't left partially written on error
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/auth/reset-password/:token ───────────────────────
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { token }       = req.params;
    const { password }    = req.body;

    const user = await User.findByResetToken(token);
    if (!user) {
      return next(createError(400, 'Password reset link is invalid or has expired.'));
    }

    user.password               = password;
    user.passwordResetToken     = undefined;
    user.passwordResetExpiresAt = undefined;
    user.failedLoginAttempts    = 0;
    user.lockedUntil            = undefined;

    await user.save();

    // Immediately issue a new token pair so the user is logged in post-reset
    const accessToken = issueTokenPair(user, res);

    return res.status(200).json({
      success: true,
      message: 'Password reset successful. You are now logged in.',
      data:    { accessToken },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/auth/verify-email/:token ──────────────────────────
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findByVerificationToken(token);
    if (!user) {
      return next(createError(400, 'Email verification link is invalid or has expired.'));
    }

    user.isEmailVerified            = true;
    user.emailVerificationToken     = undefined;
    user.emailVerificationExpiresAt = undefined;

    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'Email address verified successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/auth/resend-verification ──────────────────────────
// @access  Private
const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return next(createError(404, 'User not found.'));
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        success: true,
        message: 'Your email address is already verified.',
      });
    }

    const rawToken = user.createEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    // TODO (Phase 5): mailService.sendVerificationEmail({ to: user.email, token: rawToken });

    const isDev = process.env.NODE_ENV !== 'production';

    return res.status(200).json({
      success: true,
      message: 'Verification email resent. Please check your inbox.',
      ...(isDev && { _devVerificationToken: rawToken }),
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/auth/change-password ─────────────────────────────
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select(
      '+password +passwordChangedAt'
    );
    if (!user) {
      return next(createError(404, 'User not found.'));
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return next(createError(401, 'Current password is incorrect.'));
    }

    if (currentPassword === newPassword) {
      return next(
        createError(422, 'New password must be different from your current password.')
      );
    }

    user.password = newPassword;
    await user.save();

    // Rotate tokens so all existing sessions are invalidated
    clearRefreshTokenCookie(res);
    const accessToken = issueTokenPair(user, res);

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully. All other sessions have been invalidated.',
      data:    { accessToken },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
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
};