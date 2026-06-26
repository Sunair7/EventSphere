'use strict';

const mongoose         = require('mongoose');
const Expo             = require('../models/Expo');
const Booth            = require('../models/Booth');
const Session          = require('../models/Session');
const ExhibitorProfile = require('../models/Exhibitorprofile');
const User             = require('../models/User');
const Message          = require('../models/Message');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createError = (statusCode, message) => {
  const err      = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const toObjectId = (id) => new mongoose.Types.ObjectId(id);

// ─── @route   GET /api/v1/analytics/dashboard ────────────────────────────────
// @access  Admin
// Platform-wide KPI summary for the Logistics Command Overview
const getDashboardOverview = async (_req, res, next) => {
  try {
    const now = new Date();

    const [
      userStats,
      expoStats,
      boothStats,
      applicationStats,
      recentActivity,
    ] = await Promise.all([

      // ── User Counts by Role ────────────────────────────────────────────────
      User.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id:   '$role',
            count: { $sum: 1 },
          },
        },
        { $project: { role: '$_id', count: 1, _id: 0 } },
      ]),

      // ── Expo Status Breakdown ──────────────────────────────────────────────
      Expo.aggregate([
        {
          $group: {
            _id:      '$status',
            count:    { $sum: 1 },
            upcoming: {
              $sum: {
                $cond: [{ $gt: ['$startDate', now] }, 1, 0],
              },
            },
          },
        },
        { $project: { status: '$_id', count: 1, upcoming: 1, _id: 0 } },
      ]),

      // ── Global Booth Allocation Summary ───────────────────────────────────
      Booth.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id:          '$status',
            count:        { $sum: 1 },
            totalRevenue: { $sum: '$pricing.basePrice' },
          },
        },
        { $project: { status: '$_id', count: 1, totalRevenue: 1, _id: 0 } },
      ]),

      // ── Exhibitor Application Pipeline ────────────────────────────────────
      ExhibitorProfile.getApplicationStatusCounts(),

      // ── Last 7 Days Registrations ─────────────────────────────────────────
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            isActive:  true,
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', count: 1, _id: 0 } },
      ]),
    ]);

    // Normalise user stats into a flat object
    const users = userStats.reduce(
      (acc, { role, count }) => { acc[role] = count; return acc; },
      { admin: 0, exhibitor: 0, attendee: 0 }
    );
    users.total = users.admin + users.exhibitor + users.attendee;

    // Normalise expo stats
    const expos = expoStats.reduce(
      (acc, { status, count }) => { acc[status] = count; return acc; },
      { draft: 0, published: 0, ongoing: 0, completed: 0, cancelled: 0 }
    );
    expos.total = Object.values(expos).reduce((s, v) => s + v, 0);

    // Normalise booth stats
    const booths = boothStats.reduce(
      (acc, { status, count, totalRevenue }) => {
        acc[status]       = count;
        acc.totalRevenue += totalRevenue || 0;
        return acc;
      },
      { available: 0, pending: 0, assigned: 0, totalRevenue: 0 }
    );
    booths.total        = booths.available + booths.pending + booths.assigned;
    booths.occupancyRate = booths.total > 0
      ? +((booths.assigned / booths.total) * 100).toFixed(1)
      : 0;

    // Normalise application stats
    const applications = applicationStats.reduce(
      (acc, { status, count }) => { acc[status] = count; return acc; },
      { pending: 0, approved: 0, rejected: 0, suspended: 0 }
    );

    return res.status(200).json({
      success: true,
      data: {
        users,
        expos,
        booths,
        applications,
        recentRegistrations: recentActivity,
        generatedAt:         new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/analytics/expo/:expoId ─────────────────────────────
// @access  Admin
// Deep performance report for a single expo
const getExpoAnalytics = async (req, res, next) => {
  try {
    const { expoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const expo = await Expo.findById(expoId)
      .select('title status startDate endDate boothCount sessionCount attendeeCount')
      .lean();

    if (!expo) return next(createError(404, 'Expo not found.'));

    const oid = toObjectId(expoId);

    const [
      boothSummary,
      sessionSummary,
      registrationTimeline,
      boothRevenueByType,
      sessionsByFormat,
      topSessions,
    ] = await Promise.all([

      // ── Booth Availability Breakdown ──────────────────────────────────────
      Booth.getAvailabilitySummary(expoId),

      // ── Session Popularity ────────────────────────────────────────────────
      Session.getPopularitySummary(expoId),

      // ── Daily Session Registration Timeline ───────────────────────────────
      Session.aggregate([
        { $match: { expoId: oid } },
        { $unwind: { path: '$attendees', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$attendees.registeredAt' },
            },
            registrations: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', registrations: 1, _id: 0 } },
      ]),

      // ── Booth Revenue Breakdown by Booth Type ─────────────────────────────
      Booth.aggregate([
        { $match: { expoId: oid, isDeleted: false } },
        {
          $group: {
            _id:          '$type',
            count:        { $sum: 1 },
            assigned:     { $sum: { $cond: [{ $eq: ['$status', 'assigned'] }, 1, 0] } },
            totalRevenue: { $sum: '$pricing.basePrice' },
            premiumCount: { $sum: { $cond: ['$pricing.isPremium', 1, 0] } },
          },
        },
        {
          $project: {
            type:         '$_id',
            count:        1,
            assigned:     1,
            totalRevenue: 1,
            premiumCount: 1,
            fillRate: {
              $cond: [
                { $gt: ['$count', 0] },
                { $multiply: [{ $divide: ['$assigned', '$count'] }, 100] },
                0,
              ],
            },
            _id: 0,
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),

      // ── Sessions by Format Distribution ──────────────────────────────────
      Session.aggregate([
        { $match: { expoId: oid, isPublic: true } },
        {
          $group: {
            _id:              '$format',
            count:            { $sum: 1 },
            totalCapacity:    { $sum: { $ifNull: ['$maxCapacity', 0] } },
            totalRegistered:  { $sum: { $size: { $ifNull: ['$attendees', []] } } },
          },
        },
        { $project: { format: '$_id', count: 1, totalCapacity: 1, totalRegistered: 1, _id: 0 } },
        { $sort: { count: -1 } },
      ]),

      // ── Top 5 Sessions by Registrations ──────────────────────────────────
      Session.aggregate([
        { $match: { expoId: oid, isPublic: true } },
        {
          $project: {
            title:         1,
            format:        1,
            location:      1,
            startTime:     1,
            registrations: { $size: { $ifNull: ['$attendees',    []] } },
            bookmarks:     { $size: { $ifNull: ['$bookmarkedBy', []] } },
          },
        },
        { $sort: { registrations: -1 } },
        { $limit: 5 },
      ]),
    ]);

    // Compute booth summary totals
    const boothTotals = boothSummary.reduce(
      (acc, item) => {
        acc[item.status]  = item.count;
        acc.totalRevenue += item.totalValue || 0;
        return acc;
      },
      { available: 0, pending: 0, assigned: 0, totalRevenue: 0 }
    );
    boothTotals.total        = boothTotals.available + boothTotals.pending + boothTotals.assigned;
    boothTotals.occupancyRate = boothTotals.total > 0
      ? +((boothTotals.assigned / boothTotals.total) * 100).toFixed(1)
      : 0;

    // Compute session totals
    const sessionTotals = {
      total:               sessionSummary.length,
      totalRegistrations:  sessionSummary.reduce((s, x) => s + (x.registrations || 0), 0),
      totalBookmarks:      sessionSummary.reduce((s, x) => s + (x.bookmarks    || 0), 0),
      avgAttendanceRate:   sessionSummary.length
        ? +( sessionSummary.reduce((s, x) => s + (x.attendanceRate || 0), 0) / sessionSummary.length ).toFixed(1)
        : 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        expo: {
          id:            expo._id,
          title:         expo.title,
          status:        expo.status,
          startDate:     expo.startDate,
          endDate:       expo.endDate,
        },
        booths: {
          ...boothTotals,
          byType: boothRevenueByType,
        },
        sessions: {
          ...sessionTotals,
          byFormat:    sessionsByFormat,
          topSessions,
          timeline:    registrationTimeline,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/analytics/exhibitors ───────────────────────────────
// @access  Admin
// Exhibitor application funnel and verification pipeline
const getExhibitorAnalytics = async (_req, res, next) => {
  try {
    const [
      funnelStats,
      industryBreakdown,
      topExhibitorsByBooths,
      verificationStats,
      monthlyApplications,
    ] = await Promise.all([

      // ── Application Status Funnel ─────────────────────────────────────────
      ExhibitorProfile.getApplicationStatusCounts(),

      // ── Industry Distribution ─────────────────────────────────────────────
      ExhibitorProfile.aggregate([
        { $match: { isActive: true, industry: { $ne: null } } },
        { $group: { _id: '$industry', count: { $sum: 1 } } },
        { $project: { industry: '$_id', count: 1, _id: 0 } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),

      // ── Top Exhibitors by Number of Assigned Booths ───────────────────────
      ExhibitorProfile.aggregate([
        { $match: { isActive: true, applicationStatus: 'approved' } },
        {
          $project: {
            companyName:   1,
            industry:      1,
            boothsAssigned: { $size: '$assignedBooths' },
          },
        },
        { $sort: { boothsAssigned: -1 } },
        { $limit: 10 },
      ]),

      // ── Document Verification Stats ───────────────────────────────────────
      ExhibitorProfile.aggregate([
        { $match: { isActive: true } },
        { $unwind: { path: '$documents', preserveNullAndEmptyArrays: false } },
        {
          $group: {
            _id:   '$documents.status',
            count: { $sum: 1 },
          },
        },
        { $project: { status: '$_id', count: 1, _id: 0 } },
      ]),

      // ── Monthly Application Volume (last 6 months) ────────────────────────
      ExhibitorProfile.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m', date: '$createdAt' },
            },
            total:    { $sum: 1 },
            approved: { $sum: { $cond: [{ $eq: ['$applicationStatus', 'approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$applicationStatus', 'rejected'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { month: '$_id', total: 1, approved: 1, rejected: 1, _id: 0 } },
      ]),
    ]);

    const funnel = funnelStats.reduce(
      (acc, { status, count }) => { acc[status] = count; return acc; },
      { pending: 0, approved: 0, rejected: 0, suspended: 0 }
    );
    funnel.total        = Object.values(funnel).reduce((s, v) => s + v, 0);
    funnel.approvalRate = funnel.total > 0
      ? +((funnel.approved / funnel.total) * 100).toFixed(1)
      : 0;

    const docStats = verificationStats.reduce(
      (acc, { status, count }) => { acc[status] = count; return acc; },
      { pending: 0, verified: 0, rejected: 0 }
    );

    return res.status(200).json({
      success: true,
      data: {
        funnel,
        industryBreakdown,
        topExhibitorsByBooths,
        documentVerification: docStats,
        monthlyApplications,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/analytics/sessions ─────────────────────────────────
// @access  Admin
// Cross-expo session engagement metrics
const getSessionAnalytics = async (req, res, next) => {
  try {
    const { expoId } = req.query;

    const matchStage = expoId && mongoose.Types.ObjectId.isValid(expoId)
      ? { expoId: toObjectId(expoId) }
      : {};

    const [
      formatBreakdown,
      capacityUtilisation,
      bookmarkLeaderboard,
      hourlyDistribution,
    ] = await Promise.all([

      // ── Sessions by Format ────────────────────────────────────────────────
      Session.aggregate([
        { $match: { ...matchStage, isPublic: true } },
        {
          $group: {
            _id:             '$format',
            sessionCount:    { $sum: 1 },
            totalAttendees:  { $sum: { $size: { $ifNull: ['$attendees', []] } } },
            avgCapacity:     { $avg: { $ifNull: ['$maxCapacity', 0] } },
          },
        },
        { $project: { format: '$_id', sessionCount: 1, totalAttendees: 1, avgCapacity: { $round: ['$avgCapacity', 0] }, _id: 0 } },
        { $sort: { totalAttendees: -1 } },
      ]),

      // ── Capacity Utilisation ──────────────────────────────────────────────
      Session.aggregate([
        {
          $match: {
            ...matchStage,
            maxCapacity: { $gt: 0 },
            isPublic:    true,
          },
        },
        {
          $project: {
            title:       1,
            format:      1,
            maxCapacity: 1,
            registered:  { $size: { $ifNull: ['$attendees', []] } },
            utilisation: {
              $multiply: [
                { $divide: [{ $size: { $ifNull: ['$attendees', []] } }, '$maxCapacity'] },
                100,
              ],
            },
          },
        },
        { $sort: { utilisation: -1 } },
        { $limit: 20 },
      ]),

      // ── Most Bookmarked Sessions ──────────────────────────────────────────
      Session.aggregate([
        { $match: { ...matchStage, isPublic: true } },
        {
          $project: {
            title:         1,
            format:        1,
            startTime:     1,
            bookmarkCount: { $size: { $ifNull: ['$bookmarkedBy', []] } },
          },
        },
        { $sort: { bookmarkCount: -1 } },
        { $limit: 10 },
      ]),

      // ── Sessions by Start Hour (0–23) — identifies peak demand slots ──────
      Session.aggregate([
        { $match: { ...matchStage, isPublic: true } },
        {
          $group: {
            _id:          { $hour: '$startTime' },
            sessionCount: { $sum: 1 },
            totalAttendees: { $sum: { $size: { $ifNull: ['$attendees', []] } } },
          },
        },
        { $project: { hour: '$_id', sessionCount: 1, totalAttendees: 1, _id: 0 } },
        { $sort: { hour: 1 } },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        formatBreakdown,
        capacityUtilisation,
        bookmarkLeaderboard,
        hourlyDistribution,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/analytics/users ────────────────────────────────────
// @access  Admin
// User growth and engagement metrics
const getUserAnalytics = async (_req, res, next) => {
  try {
    const [
      roleDistribution,
      dailyGrowth,
      loginActivity,
      verificationRate,
    ] = await Promise.all([

      // ── Role Distribution ─────────────────────────────────────────────────
      User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } },
        { $project: { role: '$_id', count: 1, _id: 0 } },
      ]),

      // ── Daily Registrations (last 30 days) ────────────────────────────────
      User.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
            isActive:  true,
          },
        },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              role: '$role',
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
        { $project: { date: '$_id.date', role: '$_id.role', count: 1, _id: 0 } },
      ]),

      // ── Login Activity (last 7 days) ──────────────────────────────────────
      User.aggregate([
        {
          $match: {
            lastLoginAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            isActive:    true,
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$lastLoginAt' },
            },
            activeUsers: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $project: { date: '$_id', activeUsers: 1, _id: 0 } },
      ]),

      // ── Email Verification Rate ───────────────────────────────────────────
      User.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id:      null,
            total:    { $sum: 1 },
            verified: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
          },
        },
        {
          $project: {
            total:            1,
            verified:         1,
            unverified:       { $subtract: ['$total', '$verified'] },
            verificationRate: {
              $round: [
                { $multiply: [{ $divide: ['$verified', '$total'] }, 100] },
                1,
              ],
            },
            _id: 0,
          },
        },
      ]),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        roleDistribution,
        dailyGrowth,
        loginActivity,
        verificationRate: verificationRate[0] || { total: 0, verified: 0, unverified: 0, verificationRate: 0 },
        generatedAt:      new Date().toISOString(),
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getDashboardOverview,
  getExpoAnalytics,
  getExhibitorAnalytics,
  getSessionAnalytics,
  getUserAnalytics,
};