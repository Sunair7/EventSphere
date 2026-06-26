'use strict';

const jwt        = require('jsonwebtoken');
const mongoose   = require('mongoose');

// Lazy-load to avoid circular dependency issues at boot time
const getUserModel = () => require('../models/User');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createError = (statusCode, message) => {
  const err    = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const extractBearerToken = (req) => {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    return header.slice(7).trim();
  }
  return null;
};

// ─── protect ─────────────────────────────────────────────────────────────────
// Verifies the access JWT, hydrates req.user from DB, blocks expired / invalid tokens.
const protect = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      return next(createError(401, 'Access denied. No authentication token provided.'));
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(createError(401, 'Access token has expired. Please refresh your session.'));
      }
      return next(createError(401, 'Invalid access token.'));
    }

    if (!payload.id || !mongoose.Types.ObjectId.isValid(payload.id)) {
      return next(createError(401, 'Malformed token payload.'));
    }

    const User = getUserModel();
    const user = await User.findById(payload.id).select('-password').lean();

    if (!user) {
      return next(createError(401, 'Account associated with this token no longer exists.'));
    }

    // 🔑 ADD THIS CHECK:
if (!user.isActive) {
  return next(createError(403, 'Your account has been deactivated. Please contact support.'));
}


    // Attach the hydrated user to the request context
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

// ─── authorizeRoles ───────────────────────────────────────────────────────────
// Restricts access to one or more explicit roles.
// Must be chained AFTER protect().
// Usage: router.get('/admin-only', protect, authorizeRoles('admin'), handler)
const authorizeRoles = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(createError(401, 'Authentication required.'));
  }

  if (!roles.includes(req.user.role)) {
    return next(
      createError(
        403,
        `Access denied. Required role: [${roles.join(', ')}]. Your role: ${req.user.role}.`
      )
    );
  }

  return next();
};

// ─── verifyRefreshToken ───────────────────────────────────────────────────────
// Used exclusively by the auth/refresh-token route.
// Reads the refresh JWT from the HttpOnly cookie and validates it.
const verifyRefreshToken = (req, _res, next) => {
  try {
    const token = req.cookies?.refreshToken;

    if (!token) {
      return next(createError(401, 'No refresh token provided.'));
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(createError(401, 'Refresh token has expired. Please log in again.'));
      }
      return next(createError(401, 'Invalid refresh token.'));
    }

    if (!payload.id || !mongoose.Types.ObjectId.isValid(payload.id)) {
      return next(createError(401, 'Malformed refresh token payload.'));
    }

    req.refreshTokenPayload = payload;
    return next();
  } catch (err) {
    return next(err);
  }
};

// ─── optionalAuth ─────────────────────────────────────────────────────────────
// Silently attaches req.user if a valid token is present.
// Does NOT block the request if no token / invalid token is found.
// Useful for public routes that render differently for authenticated users.
const optionalAuth = async (req, _res, next) => {
  try {
    const token = extractBearerToken(req);
    if (!token) return next();

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    } catch {
      return next();
    }

    if (!payload.id || !mongoose.Types.ObjectId.isValid(payload.id)) return next();

    const User = getUserModel();
    const user = await User.findById(payload.id).select('-password').lean();
    if (user) req.user = user;

    return next();
  } catch {
    return next();
  }
};

// ─── requireProfileComplete ───────────────────────────────────────────────────
// Blocks exhibitors who have not yet completed their profile setup.
// Chain after protect().
const requireProfileComplete = (req, _res, next) => {
  if (!req.user) {
    return next(createError(401, 'Authentication required.'));
  }

  if (req.user.role === 'exhibitor' && !req.user.profileIsComplete) {
    return next(
      createError(
        403,
        'Your exhibitor profile is incomplete. Please finish your profile setup before continuing.'
      )
    );
  }

  return next();
};

// ─── requireEmailVerified ─────────────────────────────────────────────────────
// Blocks users who haven't verified their email address.
// Chain after protect().
const requireEmailVerified = (req, _res, next) => {
  if (!req.user) {
    return next(createError(401, 'Authentication required.'));
  }

  if (!req.user.isEmailVerified) {
    return next(
      createError(
        403,
        'Please verify your email address before performing this action. Check your inbox for the verification link.'
      )
    );
  }

  return next();
};

// ─── requireOwnerOrAdmin ──────────────────────────────────────────────────────
// Ensures the requesting user is either an admin or the resource owner.
// Expects the target userId to be available as req.params.userId or
// a custom field injected by a preceding controller step via req.resourceOwnerId.
const requireOwnerOrAdmin = (req, _res, next) => {
  if (!req.user) {
    return next(createError(401, 'Authentication required.'));
  }

  const { role, _id } = req.user;

  if (role === 'admin') return next();

  const ownerId = req.resourceOwnerId?.toString() || req.params.userId;

  if (!ownerId) {
    return next(createError(403, 'Unable to verify resource ownership.'));
  }

  if (_id.toString() !== ownerId.toString()) {
    return next(createError(403, 'You do not have permission to access this resource.'));
  }

  return next();
};

// ─── Token Issuers ────────────────────────────────────────────────────────────
// Centralised JWT generation used by auth controllers.

const signAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    algorithm: 'HS256',
  });

const signRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    algorithm: 'HS256',
  });

// ─── Cookie Setter ────────────────────────────────────────────────────────────
// Applies the refresh token into a hardened HttpOnly cookie.
const setRefreshTokenCookie = (res, token) => {
  const IS_PRODUCTION = process.env.NODE_ENV === 'production';

  res.cookie('refreshToken', token, {
    httpOnly:  true,
    secure:    IS_PRODUCTION,
    sameSite:  IS_PRODUCTION ? 'strict' : 'lax',
    maxAge:    7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path:      '/api/v1/auth',           // Scoped — not sent on every request
  });
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    path:     '/api/v1/auth',
  });
};

module.exports = {
  protect,
  authorizeRoles,
  verifyRefreshToken,
  optionalAuth,
  requireProfileComplete,
  requireOwnerOrAdmin,
  requireEmailVerified,
  signAccessToken,
  signRefreshToken,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
};