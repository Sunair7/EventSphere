'use strict';

const mongoose             = require('mongoose');
const { validationResult } = require('express-validator');
const Booth                = require('../models/Booth');
const Expo                 = require('../models/Expo');
const ExhibitorProfile     = require('../models/ExhibitorProfile');

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
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

// Emit a booth state change to all floor plan viewers of the expo
const emitBoothStateChange = (req, expoId, payload) => {
  const io = req.app.get('io');
  if (io?.boothNsp) {
    io.boothNsp.to(`expo:${expoId}`).emit('booth:state_changed', {
      ...payload,
      updatedAt: new Date().toISOString(),
    });
  }
};

const emitNotification = (req, target, event, payload) => {
  const io = req.app.get('io');
  if (!io?.notifyNsp) return;

  if (target.userId)  io.notifyNsp.pushToUser(target.userId.toString(), event, payload);
  if (target.role)    io.notifyNsp.pushToRole(target.role, event, payload);
};

// ─── @route   GET /api/v1/booths/expo/:expoId/floor-plan ─────────────────────
// @access  Public (published expos) | Admin (any)
const getFloorPlan = async (req, res, next) => {
  try {
    const { expoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const isAdmin = req.user?.role === 'admin';
    const expoFilter = { _id: expoId };
    if (!isAdmin) expoFilter.status = { $in: ['published', 'ongoing'] };

    const expo = await Expo.findOne(expoFilter).select('title floorPlanConfig status').lean();
    if (!expo) return next(createError(404, 'Expo not found or not publicly accessible.'));

    // Release any expired optimistic locks before serving the grid
    await Booth.releaseExpiredLocks();

    const booths = await Booth.getFloorPlan(expoId);

    return res.status(200).json({
      success: true,
      data: {
        expo: {
          id:              expo._id,
          title:           expo.title,
          status:          expo.status,
          floorPlanConfig: expo.floorPlanConfig,
        },
        booths,
        summary: {
          total:     booths.length,
          available: booths.filter((b) => b.status === 'available').length,
          pending:   booths.filter((b) => b.status === 'pending').length,
          assigned:  booths.filter((b) => b.status === 'assigned').length,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/booths/expo/:expoId ────────────────────────────────
// @access  Admin
const getBoothsByExpo = async (req, res, next) => {
  try {
    const { expoId }        = req.params;
    const { page, limit, skip } = parsePagination(req.query);
    const { status, type, size } = req.query;

    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const filter = { expoId, isActive: true };
    if (status) filter.status = { $in: status.split(',').map((s) => s.trim()) };
    if (type)   filter.type   = type;
    if (size)   filter.size   = size;

    const [booths, total] = await Promise.all([
      Booth.find(filter)
        .populate('assignedTo',         'name email')
        .populate('exhibitorProfileId', 'companyName applicationStatus')
        .sort({ 'gridCoordinates.row': 1, 'gridCoordinates.col': 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booth.countDocuments(filter),
    ]);

    res.setHeader('X-Total-Count', total);

    return res.status(200).json({
      success: true,
      data: {
        booths,
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

// ─── @route   GET /api/v1/booths/:id ─────────────────────────────────────────
// @access  Authenticated
const getBoothById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid booth ID format.'));
    }

    const booth = await Booth.findById(id)
      .populate('expoId',             'title status floorPlanConfig')
      .populate('assignedTo',         'name email')
      .populate('exhibitorProfileId', 'companyName logo applicationStatus')
      .lean();

    if (!booth || !booth.isActive) {
      return next(createError(404, 'Booth not found.'));
    }

    return res.status(200).json({
      success: true,
      data:    { booth },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/booths/expo/:expoId ───────────────────────────────
// @access  Admin
const createBooth = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { expoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const expo = await Expo.findById(expoId).lean();
    if (!expo) return next(createError(404, 'Expo not found.'));

    if (['completed', 'cancelled'].includes(expo.status)) {
      return next(createError(422, `Cannot add booths to an expo with status: ${expo.status}.`));
    }

    const {
      boothNumber, label, type, size, dimensions,
      gridCoordinates, amenities, pricing, description,
    } = req.body;

    // Check grid cell is not already occupied
    const cellConflict = await Booth.findOne({
      expoId,
      'gridCoordinates.row': gridCoordinates.row,
      'gridCoordinates.col': gridCoordinates.col,
      isActive: true,
    }).lean();

    if (cellConflict) {
      return next(createError(409, `Grid cell (${gridCoordinates.row}, ${gridCoordinates.col}) is already occupied by booth ${cellConflict.boothNumber}.`));
    }

    const booth = await Booth.create({
      expoId, boothNumber, label, type, size, dimensions,
      gridCoordinates, amenities, pricing, description,
    });

    emitBoothStateChange(req, expoId, {
      boothId:     booth._id,
      boothNumber: booth.boothNumber,
      status:      booth.status,
      gridCoordinates: booth.gridCoordinates,
    });

    return res.status(201).json({
      success: true,
      message: 'Booth created successfully.',
      data:    { booth },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PUT /api/v1/booths/:id ─────────────────────────────────────────
// @access  Admin
const updateBooth = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid booth ID format.'));
    }

    const booth = await Booth.findById(id);
    if (!booth || !booth.isActive) return next(createError(404, 'Booth not found.'));

    if (booth.status !== 'available') {
      return next(createError(422, `Cannot edit a booth with status: ${booth.status}. Reset the booth first.`));
    }

    const allowedFields = ['label', 'type', 'size', 'dimensions', 'amenities', 'pricing', 'description'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) booth[field] = req.body[field];
    });

    await booth.save();

    return res.status(200).json({
      success: true,
      message: 'Booth updated successfully.',
      data:    { booth },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   DELETE /api/v1/booths/:id ──────────────────────────────────────
// @access  Admin
const deleteBooth = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid booth ID format.'));
    }

    const booth = await Booth.findById(id);
    if (!booth || !booth.isActive) return next(createError(404, 'Booth not found.'));

    if (booth.status === 'assigned') {
      return next(createError(422, 'Cannot delete an assigned booth. Unassign it first.'));
    }

    await Booth.findByIdAndDelete(id);

    emitBoothStateChange(req, booth.expoId.toString(), {
      boothId:     booth._id,
      boothNumber: booth.boothNumber,
      status:      'deleted',
    });

    return res.status(200).json({
      success: true,
      message: 'Booth deleted successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/booths/:id/reserve ────────────────────────────────
// @access  Exhibitor
// Exhibitor initiates the booth reservation — transitions available → pending
const reserveBooth = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid booth ID format.'));
    }

    // Verify exhibitor has an approved profile
    const profile = await ExhibitorProfile.findByUserId(req.user._id);
    if (!profile) {
      return next(createError(403, 'You must complete your exhibitor profile before reserving a booth.'));
    }

    if (profile.applicationStatus !== 'approved') {
      return next(createError(403, `Your exhibitor application must be approved before reserving a booth. Current status: ${profile.applicationStatus}.`));
    }

    const booth = await Booth.findById(id).select('+statusHistory');
    if (!booth || !booth.isActive) return next(createError(404, 'Booth not found.'));

    // Verify booth belongs to a live expo
    const expo = await Expo.findById(booth.expoId).select('status title isRegistrationOpen').lean();
    if (!expo) return next(createError(404, 'Associated expo not found.'));

    if (!['published', 'ongoing'].includes(expo.status)) {
      return next(createError(422, 'Booth reservations are only available for published or ongoing expos.'));
    }

    if (booth.status !== 'available') {
      return next(createError(409, `This booth is not available for reservation. Current status: ${booth.status}.`));
    }

    if (booth.isLocked && booth.lockedBy?.toString() !== req.user._id.toString()) {
      return next(createError(409, 'This booth is currently being reserved by another user. Please try again shortly.'));
    }

    // Check exhibitor hasn't already reserved a booth in this expo
    const existingReservation = await Booth.findOne({
      expoId:     booth.expoId,
      assignedTo: req.user._id,
      status:     { $in: ['pending', 'assigned'] },
    }).lean();

    if (existingReservation) {
      return next(createError(409, `You already have an active booth reservation in this expo (Booth ${existingReservation.boothNumber}).`));
    }

    // Transition: available → pending
    await booth.transitionStatus('pending', req.user._id, 'Exhibitor initiated reservation.');

    booth.assignedTo         = req.user._id;
    booth.exhibitorProfileId = profile._id;
    booth.lockedBy           = null;
    booth.lockedUntil        = null;
    await booth.save();

    // Notify admins of the new pending reservation
    emitNotification(req,
      { role: 'admin' },
      'notification:booth_reservation',
      {
        boothId:     booth._id,
        boothNumber: booth.boothNumber,
        expoId:      booth.expoId,
        expoTitle:   expo.title,
        exhibitor:   { id: req.user._id, name: req.user.name, company: profile.companyName },
      }
    );

    // Update floor plan for all viewers
    emitBoothStateChange(req, booth.expoId.toString(), {
      boothId:     booth._id,
      boothNumber: booth.boothNumber,
      status:      booth.status,
      assignedTo:  { _id: req.user._id, name: req.user.name },
    });

    return res.status(200).json({
      success: true,
      message: 'Booth reserved successfully. Your reservation is pending admin approval.',
      data: {
        booth: {
          id:          booth._id,
          boothNumber: booth.boothNumber,
          status:      booth.status,
          expoId:      booth.expoId,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/booths/:id/approve ───────────────────────────────
// @access  Admin
// Admin confirms the reservation — transitions pending → assigned
const approveBooth = async (req, res, next) => {
  try {
    const { id }   = req.params;
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid booth ID format.'));
    }

    const booth = await Booth.findById(id).select('+statusHistory');
    if (!booth || !booth.isActive) return next(createError(404, 'Booth not found.'));

    if (booth.status !== 'pending') {
      return next(createError(422, `Cannot approve a booth with status: ${booth.status}.`));
    }

    await booth.transitionStatus('assigned', req.user._id, note || 'Admin approved.');

    // Sync the exhibitor profile's assigned booths list
    if (booth.exhibitorProfileId) {
      await ExhibitorProfile.findByIdAndUpdate(
        booth.exhibitorProfileId,
        {
          $push: {
            assignedBooths: {
              boothId:    booth._id,
              expoId:     booth.expoId,
              assignedBy: req.user._id,
            },
          },
        }
      );
    }

    // Notify the exhibitor
    emitNotification(req,
      { userId: booth.assignedTo },
      'notification:booth_approved',
      {
        boothId:     booth._id,
        boothNumber: booth.boothNumber,
        expoId:      booth.expoId,
        message:     `Your reservation for Booth ${booth.boothNumber} has been approved.`,
      }
    );

    emitBoothStateChange(req, booth.expoId.toString(), {
      boothId:     booth._id,
      boothNumber: booth.boothNumber,
      status:      booth.status,
    });

    return res.status(200).json({
      success: true,
      message: `Booth ${booth.boothNumber} approved and assigned successfully.`,
      data:    { booth },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/booths/:id/reject ────────────────────────────────
// @access  Admin
// Admin rejects the reservation — transitions pending → available
const rejectBooth = async (req, res, next) => {
  try {
    const { id }   = req.params;
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid booth ID format.'));
    }

    const booth = await Booth.findById(id).select('+statusHistory');
    if (!booth || !booth.isActive) return next(createError(404, 'Booth not found.'));

    if (booth.status !== 'pending') {
      return next(createError(422, `Cannot reject a booth with status: ${booth.status}.`));
    }

    const previousAssignee = booth.assignedTo;

    // available transition clears assignedTo / exhibitorProfileId automatically via pre-save hook
    await booth.transitionStatus('available', req.user._id, note || 'Admin rejected reservation.');

    // Notify the exhibitor
    if (previousAssignee) {
      emitNotification(req,
        { userId: previousAssignee },
        'notification:booth_rejected',
        {
          boothId:     booth._id,
          boothNumber: booth.boothNumber,
          expoId:      booth.expoId,
          reason:      note || null,
          message:     `Your reservation for Booth ${booth.boothNumber} was not approved.`,
        }
      );
    }

    emitBoothStateChange(req, booth.expoId.toString(), {
      boothId:     booth._id,
      boothNumber: booth.boothNumber,
      status:      'available',
      assignedTo:  null,
    });

    return res.status(200).json({
      success: true,
      message: `Booth ${booth.boothNumber} reservation rejected and released back to available.`,
      data:    { booth },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/booths/:id/release ───────────────────────────────
// @access  Admin
// Force-release any booth back to available (admin override)
const releaseBooth = async (req, res, next) => {
  try {
    const { id }   = req.params;
    const { note } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid booth ID format.'));
    }

    const booth = await Booth.findById(id).select('+statusHistory');
    if (!booth || !booth.isActive) return next(createError(404, 'Booth not found.'));

    if (booth.status === 'available') {
      return next(createError(422, 'Booth is already available.'));
    }

    const previousAssignee       = booth.assignedTo;
    const previousProfileId      = booth.exhibitorProfileId;

    await booth.transitionStatus('available', req.user._id, note || 'Admin force-released booth.');

    // Remove from exhibitor profile's assigned booths list
    if (previousProfileId) {
      await ExhibitorProfile.findByIdAndUpdate(
        previousProfileId,
        {
          $pull: {
            assignedBooths: { boothId: booth._id },
          },
        }
      );
    }

    if (previousAssignee) {
      emitNotification(req,
        { userId: previousAssignee },
        'notification:booth_released',
        {
          boothId:     booth._id,
          boothNumber: booth.boothNumber,
          expoId:      booth.expoId,
          message:     `Booth ${booth.boothNumber} has been released by the organiser.`,
        }
      );
    }

    emitBoothStateChange(req, booth.expoId.toString(), {
      boothId:     booth._id,
      boothNumber: booth.boothNumber,
      status:      'available',
      assignedTo:  null,
    });

    return res.status(200).json({
      success: true,
      message: `Booth ${booth.boothNumber} released back to available.`,
      data:    { booth },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/booths/:id/lock ───────────────────────────────────
// @access  Exhibitor
// Acquire a 30-second optimistic UI lock during the reservation form flow
const lockBooth = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid booth ID format.'));
    }

    const booth = await Booth.findById(id);
    if (!booth || !booth.isActive) return next(createError(404, 'Booth not found.'));

    if (booth.status !== 'available') {
      return next(createError(409, 'Only available booths can be locked.'));
    }

    await booth.acquireLock(req.user._id, 30_000);

    // Broadcast soft lock to all floor plan viewers
    const io = req.app.get('io');
    if (io?.boothNsp) {
      io.boothNsp.to(`expo:${booth.expoId}`).emit('booth:locked_preview', {
        boothId:   booth._id,
        lockedBy:  req.user._id,
        expiresAt: booth.lockedUntil.toISOString(),
      });
    }

    return res.status(200).json({
      success:   true,
      message:   'Booth locked for 30 seconds.',
      expiresAt: booth.lockedUntil,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/booths/expo/:expoId/availability ───────────────────
// @access  Authenticated
const getAvailabilitySummary = async (req, res, next) => {
  try {
    const { expoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const summary = await Booth.getAvailabilitySummary(expoId);

    return res.status(200).json({
      success: true,
      data:    { summary },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getFloorPlan,
  getBoothsByExpo,
  getBoothById,
  createBooth,
  updateBooth,
  deleteBooth,
  reserveBooth,
  approveBooth,
  rejectBooth,
  releaseBooth,
  lockBooth,
  getAvailabilitySummary,
};