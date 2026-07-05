'use strict';

const mongoose           = require('mongoose');
const { validationResult } = require('express-validator');
const Expo               = require('../models/Expo');
const Booth              = require('../models/Booth');
const Session            = require('../models/Session');
const Notification       = require('../models/Notification');
const { BOOTH_SIZES, BOOTH_TYPES } = require('../models/Booth'); 

// NOTE: Ensure these utilities are correctly imported based on your project structure
const { deleteCloudinaryImage, extractPublicId } = require('../middleware/Upload.middleware');

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
  const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 12));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

const buildSortStage = (sortParam) => {
  const map = {
    newest:    { createdAt: -1 },
    oldest:    { createdAt:  1 },
    'start-asc':  { startDate:  1 },
    'start-desc': { startDate: -1 },
    title:     { title:      1 },
  };
  return map[sortParam] || map.newest;
};

// ─── @route   POST /api/v1/expos ─────────────────────────────────────────────
// @access  Admin
const createExpo = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const {
      title, description, theme, startDate, endDate,
      registrationDeadline, address, floorPlanConfig,
      tags, maxAttendees, isPublic, boothPrice, boothCurrency,
    } = req.body;

    const expo = await Expo.create({
      title,
      description,
      theme,
      startDate:            new Date(startDate),
      endDate:              new Date(endDate),
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
      address,
      floorPlanConfig,
      tags:         tags         || [],
      maxAttendees: maxAttendees || null,
      isPublic:     isPublic !== undefined ? isPublic : true,
      boothPrice:   boothPrice   || 0,
      boothCurrency: boothCurrency || 'USD',
      createdBy:    req.user._id,
    });

    // Auto-generate booth grid based on floorPlanConfig
    const { rows, cols } = floorPlanConfig;
    const boothDocs = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const num = `${String.fromCharCode(65 + r)}${String(c + 1).padStart(2, '0')}`;
        boothDocs.push({
          expoId:          expo._id,
          boothNumber:     num,
          dimensions:      `${floorPlanConfig.boothWidth || 3}m x ${floorPlanConfig.boothHeight || 3}m`,
          gridCoordinates: { row: r, col: c },
          price:           boothPrice || 0,
          currency:        boothCurrency || 'USD',
        });
      }
    }

    if (boothDocs.length > 0) {
      await Booth.insertMany(boothDocs, { ordered: false });
      await Expo.findByIdAndUpdate(expo._id, { boothCount: boothDocs.length });
    }

    // Notify all admins via Socket.io
    const io = req.app.get('io');
    if (io?.notifyNsp) {
      io.notifyNsp.pushToRole('admin', 'notification:expo_created', {
        expoId:   expo._id,
        title:    expo.title,
        createdBy: req.user.name,
      });
    }

    
    if (expo.status === 'published') {
      // Notify exhibitors
      await Notification.notifyRole(req.app.get('io'), 'exhibitor', {
        type: 'expo_published',
        title: `New Expo: ${expo.title}`,
        body: `A new expo "${expo.title}" is now accepting applications.`,
        link: `/exhibitor/expos/${expo._id}`,
        referenceId: expo._id,
        referenceModel: 'Expo',
      });
      
      // Notify attendees
      await Notification.notifyRole(req.app.get('io'), 'attendee', {
        type: 'expo_published',
        title: `New Expo: ${expo.title}`,
        body: `"${expo.title}" has been announced. Browse sessions and register!`,
        link: `/attendee/expos/${expo._id}`,
        referenceId: expo._id,
        referenceModel: 'Expo',
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Expo created successfully.',
      data:    { expo },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/expos ──────────────────────────────────────────────
// @access  Public (published only) | Admin sees all
const getExpos = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { search, status, tags, startFrom, startTo, sort } = req.query;

    const isAdmin = req.user?.role === 'admin';
    const filter  = {};

    // ✅ Handle status filter properly
    if (isAdmin) {
      // Admin can see all statuses
      if (status) {
        filter.status = { $in: status.split(',').map((s) => s.trim()) };
      }
    } else {
      // Non-admin (attendee) - respect the status filter
      if (status) {
        // If status is provided, use it
        const statuses = status.split(',').map((s) => s.trim());
        filter.status = { $in: statuses };
        filter.isPublic = true;
      } else {
        // Default: show published and ongoing only (EXCLUDE completed)
        filter.isPublic = true;
        filter.status   = { $in: ['published', 'ongoing'] };
      }
    }

    // Date range filter
    if (startFrom || startTo) {
      filter.startDate = {};
      if (startFrom) filter.startDate.$gte = new Date(startFrom);
      if (startTo)   filter.startDate.$lte = new Date(startTo);
    }

    // Tag filter
    if (tags) {
      filter.tags = { $in: tags.split(',').map((t) => t.trim()) };
    }

    // Full-text search
    if (search && search.trim()) {
      filter.$text = { $search: search.trim() };
    }

    const sortStage = buildSortStage(sort);

    const [expos, total] = await Promise.all([
      Expo.find(filter)
        .select('-__v')
        .populate('createdBy', 'name email')
        .sort(sortStage)
        .skip(skip)
        .limit(limit)
        .lean(),
      Expo.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.setHeader('X-Total-Count', total);

    return res.status(200).json({
      success: true,
      data: {
        expos,
        pagination: {
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/expos/:id ─────────────────────────────────────────
// @access  Public (published) | Admin (any)
const getExpoById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const isAdmin = req.user?.role === 'admin';
    const filter  = { _id: id };
    if (!isAdmin) {
      filter.isPublic = true;
      filter.status   = { $in: ['published', 'ongoing', 'completed'] };
    }

    const expo = await Expo.findOne(filter)
      .populate('createdBy', 'name email')
      .lean();

    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    return res.status(200).json({
      success: true,
      data:    { expo },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/expos/slug/:slug ──────────────────────────────────
// @access  Public
const getExpoBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const expo = await Expo.findBySlug(slug)
      .populate('createdBy', 'name email')
      .lean();

    if (!expo || (!['published', 'ongoing', 'completed'].includes(expo.status) && req.user?.role !== 'admin')) {
      return next(createError(404, 'Expo not found.'));
    }

    return res.status(200).json({
      success: true,
      data:    { expo },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PUT /api/v1/expos/:id ─────────────────────────────────────────
// @access  Admin
const updateExpo = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const expo = await Expo.findById(id);
    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    if (!expo.canBeEditedBy(req.user._id, req.user.role)) {
      return next(createError(403, 'You do not have permission to edit this expo.'));
    }

    if (['completed', 'cancelled'].includes(expo.status)) {
      return next(createError(422, `Cannot edit an expo with status: ${expo.status}.`));
    }

    const allowedFields = [
      'title', 'description', 'theme', 'startDate', 'endDate',
      'registrationDeadline', 'address', 'tags', 'maxAttendees',
      'isPublic', 'banner', 'boothPrice', 'boothCurrency',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        if (['startDate', 'endDate', 'registrationDeadline'].includes(field)) {
          expo[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          expo[field] = req.body[field];
        }
      }
    });

    await expo.save();

    // If booth price is updated, update all existing booths as well
    if (req.body.boothPrice !== undefined) {
      await Booth.updateMany(
        { expoId: id },
        { 
          $set: { 
            price: req.body.boothPrice,
            currency: req.body.boothCurrency || 'USD'
          } 
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Expo updated successfully.',
      data:    { expo },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/expos/:id/status ────────────────────────────────
// @access  Admin
const updateExpoStatus = async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    if (!status) {
      return next(createError(422, 'Status is required.'));
    }

    const expo = await Expo.findById(id);
    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    if (status === 'published') {
      await expo.publish();
    } else if (status === 'cancelled') {
      await expo.cancel();
    } else {
      return next(createError(422, 'Status can only be set to published or cancelled via this endpoint.'));
    }

    // Broadcast status change to all connected clients
    const io = req.app.get('io');
    if (io?.notifyNsp) {
      io.notifyNsp.pushBroadcast('notification:expo_status_changed', {
        expoId: expo._id,
        title:  expo.title,
        status: expo.status,
      });
    }

    if (status === 'published') {
      // Notify exhibitors and attendees
      await Notification.notifyRole(req.app.get('io'), 'exhibitor', {
        type: 'expo_published',
        title: `New Expo: ${expo.title}`,
        body: `A new expo "${expo.title}" is now accepting applications.`,
        link: `/exhibitor/expos/${expo._id}`,
        referenceId: expo._id,
        referenceModel: 'Expo',
      });
      
      await Notification.notifyRole(req.app.get('io'), 'attendee', {
        type: 'expo_published',
        title: `New Expo: ${expo.title}`,
        body: `"${expo.title}" has been announced. Browse sessions and register!`,
        link: `/attendee/expos/${expo._id}`,
        referenceId: expo._id,
        referenceModel: 'Expo',
      });
    }

    return res.status(200).json({
      success: true,
      message: `Expo status updated to "${expo.status}".`,
      data:    { expo },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/expos/:id/floor-plan ────────────────────────────
// @access  Admin
const updateFloorPlanConfig = async (req, res, next) => {
  try {
    const { id }             = req.params;
    const { floorPlanConfig } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    if (!floorPlanConfig) {
      return next(createError(422, 'floorPlanConfig is required.'));
    }

    const expo = await Expo.findById(id);
    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    if (['completed', 'cancelled', 'ongoing'].includes(expo.status)) {
      return next(createError(422, `Cannot modify the floor plan of an expo with status: ${expo.status}.`));
    }

    const existingBooths = await Booth.countDocuments({ expoId: id });
    if (existingBooths > 0) {
      return next(
        createError(
          409,
          'Floor plan configuration cannot be changed after booths have been generated. Delete all booths first.'
        )
      );
    }

    expo.floorPlanConfig = { ...expo.floorPlanConfig.toObject(), ...floorPlanConfig };
    await expo.save();

    return res.status(200).json({
      success: true,
      message: 'Floor plan configuration updated successfully.',
      data:    { floorPlanConfig: expo.floorPlanConfig },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   DELETE /api/v1/expos/:id ──────────────────────────────────────
// @access  Admin
const deleteExpo = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const expo = await Expo.findById(id);
    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    if (expo.status === 'ongoing') {
      return next(createError(422, 'Cannot delete an expo that is currently ongoing.'));
    }

    // Cascade delete all related documents
    await Promise.all([
      Booth.deleteMany({ expoId: id }),
      Session.deleteMany({ expoId: id }),
      Expo.findByIdAndDelete(id),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Expo and all associated data deleted successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/expos/:id/stats ───────────────────────────────────
// @access  Admin
const getExpoStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const expo = await Expo.findById(id).lean();
    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    const [boothSummary, sessionSummary] = await Promise.all([
      Booth.getAvailabilitySummary(id),
      Session.getPopularitySummary(id),
    ]);

    const boothStats = boothSummary.reduce(
      (acc, item) => {
        acc[item.status]  = item.count;
        acc.totalRevenue += item.totalValue || 0;
        return acc;
      },
      { available: 0, pending: 0, assigned: 0, totalRevenue: 0 }
    );

    const sessionStats = {
      total:            sessionSummary.length,
      totalRegistrations: sessionSummary.reduce((s, x) => s + (x.registrations || 0), 0),
      totalBookmarks:     sessionSummary.reduce((s, x) => s + (x.bookmarks    || 0), 0),
      avgAttendanceRate:  sessionSummary.length
        ? (sessionSummary.reduce((s, x) => s + (x.attendanceRate || 0), 0) / sessionSummary.length).toFixed(1)
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
          attendeeCount: expo.attendeeCount,
          boothPrice:    expo.boothPrice || 0,
          boothCurrency: expo.boothCurrency || 'USD',
        },
        booths:   boothStats,
        sessions: sessionStats,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/expos/upcoming ────────────────────────────────────
// @access  Public
const getUpcomingExpos = async (req, res, next) => {
  try {
    const { limit } = parsePagination({ ...req.query, limit: req.query.limit || 6 });

    const expos = await Expo.find({
      status:    'published',
      isPublic:  true,
      startDate: { $gt: new Date() },
    })
      .select('title slug description startDate endDate address theme tags banner boothCount sessionCount boothPrice boothCurrency')
      .sort({ startDate: 1 })
      .limit(limit)
      .lean();

    return res.status(200).json({
      success: true,
      data:    { expos },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/expos/:id/banner ──────────────────────────────────
// @access  Admin
const uploadBanner = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    if (!req.file) {
      return next(createError(422, 'No banner image provided.'));
    }

    const expo = await Expo.findById(id);
    if (!expo) {
      // Clean up uploaded file if expo doesn't exist
      await deleteCloudinaryImage(req.file.public_id);
      return next(createError(404, 'Expo not found.'));
    }

    // Delete old banner from Cloudinary if exists
    if (expo.banner?.publicId) {
      await deleteCloudinaryImage(expo.banner.publicId);
    }

    // Update banner
    expo.banner = {
      url:       req.file.path,
      publicId:  req.file.filename || req.file.public_id,
      altText:   req.body.altText || expo.title,
    };

    await expo.save();

    return res.status(200).json({
      success: true,
      message: 'Banner uploaded successfully.',
      data:    { banner: expo.banner },
    });
  } catch (err) {
    // Clean up on error
    if (req.file?.public_id) {
      await deleteCloudinaryImage(req.file.public_id);
    }
    return next(err);
  }
};

// ─── @route   POST /api/v1/expos/:id/gallery ─────────────────────────────────
// @access  Admin
const uploadGallery = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    if (!req.files || req.files.length === 0) {
      return next(createError(422, 'No gallery images provided.'));
    }

    const expo = await Expo.findById(id);
    if (!expo) {
      // Clean up uploaded files
      await Promise.all(req.files.map((f) => deleteCloudinaryImage(f.public_id)));
      return next(createError(404, 'Expo not found.'));
    }

    // Check gallery limit
    const currentCount = expo.gallery?.length || 0;
    const newCount     = currentCount + req.files.length;
    if (newCount > 20) {
      await Promise.all(req.files.map((f) => deleteCloudinaryImage(f.public_id)));
      return next(createError(422, `Gallery limit reached. Maximum 20 images (currently ${currentCount}).`));
    }

    // Add new images to gallery
    const newImages = req.files.map((file) => ({
      url:      file.path,
      publicId: file.filename || file.public_id,
      altText:  `${expo.title} - Image ${currentCount + 1}`,
    }));

    expo.gallery = [...(expo.gallery || []), ...newImages];
    await expo.save();

    return res.status(200).json({
      success: true,
      message: `${req.files.length} image(s) added to gallery.`,
      data:    { gallery: expo.gallery },
    });
  } catch (err) {
    if (req.files?.length) {
      await Promise.all(req.files.map((f) => deleteCloudinaryImage(f.public_id)));
    }
    return next(err);
  }
};

// ─── @route   DELETE /api/v1/expos/:id/gallery/:imageId ──────────────────────
// @access  Admin
const deleteGalleryImage = async (req, res, next) => {
  try {
    const { id, imageId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const expo = await Expo.findById(id);
    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    const imageIndex = expo.gallery?.findIndex(
      (img) => img._id.toString() === imageId
    );

    if (imageIndex === -1 || imageIndex === undefined) {
      return next(createError(404, 'Gallery image not found.'));
    }

    // Delete from Cloudinary
    const image = expo.gallery[imageIndex];
    if (image.publicId) {
      await deleteCloudinaryImage(image.publicId);
    }

    // Remove from array
    expo.gallery.splice(imageIndex, 1);
    await expo.save();

    return res.status(200).json({
      success: true,
      message: 'Gallery image deleted.',
      data:    { gallery: expo.gallery },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   DELETE /api/v1/expos/:id/banner ────────────────────────────────
// @access  Admin
const deleteBanner = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const expo = await Expo.findById(id);
    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    if (!expo.banner?.publicId && !expo.banner?.url) {
      return next(createError(404, 'No banner to delete.'));
    }

    // Delete from Cloudinary
    const publicId = expo.banner.publicId || extractPublicId(expo.banner.url);
    if (publicId) {
      await deleteCloudinaryImage(publicId);
    }

    // Clear banner
    expo.banner = {};
    await expo.save();

    return res.status(200).json({
      success: true,
      message: 'Banner deleted.',
      data:    { banner: expo.banner },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createExpo,
  getExpos,
  getExpoById,
  getExpoBySlug,
  updateExpo,
  updateExpoStatus,
  updateFloorPlanConfig,
  deleteExpo,
  getExpoStats,
  getUpcomingExpos,
  uploadBanner,
  uploadGallery,
  deleteGalleryImage,
  deleteBanner,
};