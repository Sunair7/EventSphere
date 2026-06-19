'use strict';

const mongoose             = require('mongoose');
const { validationResult } = require('express-validator');
const ExhibitorProfile     = require('../models/ExhibitorProfile');
const User                 = require('../models/User');

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

const parsePagination = (query) => {
  const page  = Math.max(1, parseInt(query.page,  10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

const emitNotification = (req, target, event, payload) => {
  const io = req.app.get('io');
  if (!io?.notifyNsp) return;
  if (target.userId) io.notifyNsp.pushToUser(target.userId.toString(), event, payload);
  if (target.role)   io.notifyNsp.pushToRole(target.role, event, payload);
};

// ─── @route   POST /api/v1/exhibitors/profile ────────────────────────────────
// @access  Exhibitor
// Creates the exhibitor's company profile (one per user account)
const createProfile = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const existing = await ExhibitorProfile.findOne({ userId: req.user._id });
    if (existing) {
      return next(createError(409, 'An exhibitor profile already exists for your account.'));
    }

    if (req.user.role !== 'exhibitor') {
      return next(createError(403, 'Only users with the exhibitor role can create a company profile.'));
    }

    const {
      companyName, tagline, description, industry,
      products, logo, bannerImage, contactPerson, socialLinks,
    } = req.body;

    const profile = await ExhibitorProfile.create({
      userId:        req.user._id,
      companyName,
      tagline,
      description,
      industry,
      products:      products     || [],
      logo:          logo         || null,
      bannerImage:   bannerImage  || null,
      contactPerson,
      socialLinks:   socialLinks  || {},
    });

    // Notify admins of a new profile awaiting review
    emitNotification(req,
      { role: 'admin' },
      'notification:new_exhibitor_profile',
      {
        profileId:   profile._id,
        companyName: profile.companyName,
        exhibitor:   { id: req.user._id, name: req.user.name, email: req.user.email },
      }
    );

    return res.status(201).json({
      success: true,
      message: 'Exhibitor profile created successfully. Your application is pending review.',
      data:    { profile },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/exhibitors/profile/me ──────────────────────────────
// @access  Exhibitor
const getMyProfile = async (req, res, next) => {
  try {
    const profile = await ExhibitorProfile.findByUserId(req.user._id)
      .populate('userId',               'name email isEmailVerified createdAt')
      .populate('assignedBooths.boothId', 'boothNumber dimensions status gridCoordinates')
      .populate('assignedBooths.expoId',  'title startDate endDate status');

    if (!profile) {
      return next(createError(404, 'Exhibitor profile not found. Please create your profile first.'));
    }

    return res.status(200).json({
      success: true,
      data:    { profile },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PUT /api/v1/exhibitors/profile/me ──────────────────────────────
// @access  Exhibitor
const updateMyProfile = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const profile = await ExhibitorProfile.findByUserId(req.user._id);
    if (!profile) {
      return next(createError(404, 'Exhibitor profile not found.'));
    }

    if (profile.applicationStatus === 'suspended') {
      return next(createError(403, 'Your account has been suspended. Contact the organiser for assistance.'));
    }

    const allowedFields = [
      'companyName', 'tagline', 'description', 'industry',
      'products', 'logo', 'bannerImage', 'contactPerson', 'socialLinks',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) profile[field] = req.body[field];
    });

    // If profile was previously rejected, resubmission resets to pending
    if (profile.applicationStatus === 'rejected') {
      profile.applicationHistory.push({
        fromStatus: 'rejected',
        toStatus:   'pending',
        changedBy:  req.user._id,
        reason:     'Exhibitor resubmitted updated profile for review.',
      });
      profile.applicationStatus = 'pending';
      profile.reviewedBy        = null;
      profile.reviewedAt        = null;
      profile.applicationNote   = null;
    }

    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data:    { profile },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/exhibitors ─────────────────────────────────────────
// @access  Admin
const getAllExhibitors = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { status, search, isVerified } = req.query;

    const filter = { isActive: true };

    if (status)     filter.applicationStatus = { $in: status.split(',').map((s) => s.trim()) };
    if (isVerified !== undefined) filter.isVerified = isVerified === 'true';
    if (search?.trim()) filter.$text = { $search: search.trim() };

    const [profiles, total, statusCounts] = await Promise.all([
      ExhibitorProfile.find(filter)
        .populate('userId', 'name email lastLoginAt createdAt')
        .select('companyName industry applicationStatus isVerified logo products contactPerson createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ExhibitorProfile.countDocuments(filter),
      ExhibitorProfile.getApplicationStatusCounts(),
    ]);

    res.setHeader('X-Total-Count', total);

    return res.status(200).json({
      success: true,
      data: {
        profiles,
        statusCounts,
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
};

// ─── @route   GET /api/v1/exhibitors/pending ─────────────────────────────────
// @access  Admin
// Convenience endpoint for the admin review queue
const getPendingApplications = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);

    const [profiles, total] = await Promise.all([
      ExhibitorProfile.getPendingApplications(page, limit),
      ExhibitorProfile.countDocuments({ applicationStatus: 'pending', isActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        profiles,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/exhibitors/:id ─────────────────────────────────────
// @access  Admin
const getExhibitorById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid exhibitor profile ID format.'));
    }

    const profile = await ExhibitorProfile.findById(id)
      .populate('userId',                 'name email lastLoginAt createdAt isEmailVerified')
      .populate('reviewedBy',             'name email')
      .populate('assignedBooths.boothId', 'boothNumber dimensions status')
      .populate('assignedBooths.expoId',  'title startDate status')
      .populate('documents.reviewedBy',   'name email')
      .select('+applicationHistory')
      .lean();

    if (!profile || !profile.isActive) {
      return next(createError(404, 'Exhibitor profile not found.'));
    }

    return res.status(200).json({
      success: true,
      data:    { profile },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/exhibitors/public ──────────────────────────────────
// @access  Authenticated (Attendees browse approved exhibitors)
const getPublicExhibitors = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { search, industry }  = req.query;

    const filter = {
      applicationStatus: 'approved',
      isActive:          true,
    };

    if (industry?.trim()) filter.industry = { $regex: industry.trim(), $options: 'i' };
    if (search?.trim())   filter.$text    = { $search: search.trim() };

    const [profiles, total] = await Promise.all([
      ExhibitorProfile.find(filter)
        .select('companyName tagline description industry products logo bannerImage socialLinks isVerified companyNameSlug')
        .sort({ companyName: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ExhibitorProfile.countDocuments(filter),
    ]);

    res.setHeader('X-Total-Count', total);

    return res.status(200).json({
      success: true,
      data: {
        profiles,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/exhibitors/:id/approve ───────────────────────────
// @access  Admin
const approveApplication = async (req, res, next) => {
  try {
    const { id }   = req.params;
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid exhibitor profile ID format.'));
    }

    const profile = await ExhibitorProfile.findById(id).select('+applicationHistory');
    if (!profile || !profile.isActive) {
      return next(createError(404, 'Exhibitor profile not found.'));
    }

    await profile.transitionApplicationStatus('approved', req.user._id, note || null);

    emitNotification(req,
      { userId: profile.userId },
      'notification:application_approved',
      {
        profileId:   profile._id,
        companyName: profile.companyName,
        message:     'Congratulations! Your exhibitor application has been approved.',
        note:        note || null,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Application for "${profile.companyName}" approved successfully.`,
      data:    { profile },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/exhibitors/:id/reject ────────────────────────────
// @access  Admin
const rejectApplication = async (req, res, next) => {
  try {
    const { id }   = req.params;
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid exhibitor profile ID format.'));
    }

    if (!note?.trim()) {
      return next(createError(422, 'A rejection reason is required.'));
    }

    const profile = await ExhibitorProfile.findById(id).select('+applicationHistory');
    if (!profile || !profile.isActive) {
      return next(createError(404, 'Exhibitor profile not found.'));
    }

    await profile.transitionApplicationStatus('rejected', req.user._id, note);

    emitNotification(req,
      { userId: profile.userId },
      'notification:application_rejected',
      {
        profileId:   profile._id,
        companyName: profile.companyName,
        reason:      note,
        message:     'Your exhibitor application was not approved. Please review the feedback and resubmit.',
      }
    );

    return res.status(200).json({
      success: true,
      message: `Application for "${profile.companyName}" rejected.`,
      data:    { profile },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/exhibitors/:id/suspend ───────────────────────────
// @access  Admin
const suspendExhibitor = async (req, res, next) => {
  try {
    const { id }   = req.params;
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid exhibitor profile ID format.'));
    }

    const profile = await ExhibitorProfile.findById(id).select('+applicationHistory');
    if (!profile || !profile.isActive) {
      return next(createError(404, 'Exhibitor profile not found.'));
    }

    await profile.transitionApplicationStatus('suspended', req.user._id, note || null);

    emitNotification(req,
      { userId: profile.userId },
      'notification:account_suspended',
      {
        profileId: profile._id,
        message:   'Your exhibitor account has been suspended. Contact the organiser for details.',
        note:      note || null,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Exhibitor "${profile.companyName}" suspended.`,
      data:    { profile },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/exhibitors/profile/documents ──────────────────────
// @access  Exhibitor
// Adds a new document entry (URL-based — actual file upload handled by a dedicated upload service)
const uploadDocument = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const profile = await ExhibitorProfile.findByUserId(req.user._id);
    if (!profile) {
      return next(createError(404, 'Exhibitor profile not found.'));
    }

    if (profile.applicationStatus === 'suspended') {
      return next(createError(403, 'Suspended accounts cannot upload documents.'));
    }

    if (profile.documents.length >= 10) {
      return next(createError(422, 'Maximum of 10 documents allowed per profile.'));
    }

    const { type, label, fileUrl, fileName, fileSizeBytes, mimeType } = req.body;

    profile.documents.push({ type, label, fileUrl, fileName, fileSizeBytes, mimeType });
    await profile.save();

    const newDoc = profile.documents[profile.documents.length - 1];

    // Notify admins of the new document
    emitNotification(req,
      { role: 'admin' },
      'notification:document_uploaded',
      {
        profileId:   profile._id,
        companyName: profile.companyName,
        documentId:  newDoc._id,
        documentType: type,
      }
    );

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully.',
      data:    { document: newDoc },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   DELETE /api/v1/exhibitors/profile/documents/:docId ─────────────
// @access  Exhibitor
const deleteDocument = async (req, res, next) => {
  try {
    const { docId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(docId)) {
      return next(createError(400, 'Invalid document ID format.'));
    }

    const profile = await ExhibitorProfile.findByUserId(req.user._id);
    if (!profile) {
      return next(createError(404, 'Exhibitor profile not found.'));
    }

    const doc = profile.documents.id(docId);
    if (!doc) {
      return next(createError(404, 'Document not found on your profile.'));
    }

    if (doc.status === 'verified') {
      return next(createError(422, 'Verified documents cannot be deleted. Contact the organiser.'));
    }

    doc.deleteOne();
    await profile.save();

    return res.status(200).json({
      success: true,
      message: 'Document removed successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/exhibitors/:id/documents/:docId/review ────────────
// @access  Admin
const reviewDocument = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { id, docId } = req.params;
    const { status, note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(docId)) {
      return next(createError(400, 'Invalid ID format.'));
    }

    const profile = await ExhibitorProfile.findById(id);
    if (!profile || !profile.isActive) {
      return next(createError(404, 'Exhibitor profile not found.'));
    }

    await profile.reviewDocument(docId, status, req.user._id, note || null);

    emitNotification(req,
      { userId: profile.userId },
      'notification:document_reviewed',
      {
        profileId:   profile._id,
        documentId:  docId,
        status,
        note:        note || null,
        message:     `Your document has been ${status === 'verified' ? 'verified' : 'flagged for review'}.`,
      }
    );

    return res.status(200).json({
      success: true,
      message: `Document marked as "${status}".`,
      data:    { document: profile.documents.id(docId) },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
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
};