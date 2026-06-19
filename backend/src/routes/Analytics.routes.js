'use strict';

const express      = require('express');
const { param, query } = require('express-validator');

const {
  getDashboardOverview,
  getExpoAnalytics,
  getExhibitorAnalytics,
  getSessionAnalytics,
  getUserAnalytics,
} = require('../controllers/analytics.controller');

const {
  protect,
  authorizeRoles,
} = require('../middleware/Auth.middleware');

const router = express.Router();

// ─── All analytics routes are admin-only ─────────────────────────────────────
router.use(protect, authorizeRoles('admin'));

// ─── Validators ───────────────────────────────────────────────────────────────
const mongoIdParam = (field) =>
  param(field)
    .trim()
    .notEmpty().withMessage(`${field} is required.`)
    .isMongoId().withMessage(`Invalid ${field} format.`);

const optionalExpoIdQuery =
  query('expoId')
    .optional()
    .isMongoId().withMessage('expoId must be a valid MongoDB ID.');

// ─── Routes ───────────────────────────────────────────────────────────────────

// Platform-wide KPI overview — Logistics Command Overview dashboard
router.get('/dashboard', getDashboardOverview);

// Deep performance report for a single expo
router.get('/expo/:expoId', mongoIdParam('expoId'), getExpoAnalytics);

// Exhibitor application funnel and industry breakdown
router.get('/exhibitors', getExhibitorAnalytics);

// Session engagement metrics — optional ?expoId= scope
router.get('/sessions', optionalExpoIdQuery, getSessionAnalytics);

// User growth and activity metrics
router.get('/users', getUserAnalytics);

module.exports = router;