'use strict';

const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const Booth = require('../models/Booth');
const Expo = require('../models/Expo');
const User = require('../models/User');

// ─── Helpers ──────────────────────────────────────────────────────────────────
const createError = (statusCode, message) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const handleValidationErrors = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    const err = new Error(messages[0]);
    err.statusCode = 422;
    err.errors = messages;
    throw err;
  }
};

const formatBoothForClient = (booth) => ({
  ...booth,
  lockedUntil: booth.reservationExpiresAt || null,
});

// ─── Get floor plan (public) ─────────────────────────────────────────────────
const getFloorPlan = async (req, res, next) => {
  try {
    const { expoId } = req.params;

    // Clean up expired locks first
    await Booth.cleanupExpiredLocks();

    const expo = await Expo.findById(expoId)
      .select('title floorPlanConfig boothPrice boothCurrency status')
      .lean();

    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    // Check if booths exist
    let existingBooths = await Booth.find({ expoId, isDeleted: false }).lean();
    
    // If no booths exist, generate them
    if (existingBooths.length === 0) {
      console.log(`🔄 No booths found for expo ${expoId}. Generating...`);
      
      const { rows, cols } = expo.floorPlanConfig;
      const boothsToCreate = [];
      
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const boothNumber = Booth.formatBoothNumber(row, col);
          
          boothsToCreate.push({
            expoId: expoId,
            boothNumber: boothNumber,
            gridCoordinates: {
              row: row,
              col: col,
              rowSpan: 1,
              colSpan: 1,
            },
            status: 'available',
            dimensions: `${expo.floorPlanConfig.boothWidth}m x ${expo.floorPlanConfig.boothHeight}m`,
            size: 'Standard',
            type: 'Standard',
            pricing: {
              basePrice: expo.boothPrice || 0,
              currency: expo.boothCurrency || 'USD',
              isPremium: false,
              premiumMultiplier: 1.0,
            },
            amenities: {
              power: false,
              wifi: false,
              water: false,
              lighting: false,
              storage: false,
              carpeted: false,
            },
            isDeleted: false,
          });
        }
      }
      
      if (boothsToCreate.length > 0) {
        try {
          // Use insertMany with ordered: false to skip duplicates
          await Booth.insertMany(boothsToCreate, { ordered: false });
          console.log(`✅ Generated ${boothsToCreate.length} booths for expo ${expoId}`);
          
          // Get the newly created booths
          existingBooths = await Booth.find({ expoId, isDeleted: false }).lean();
        } catch (insertError) {
          // If there are duplicate errors, fetch existing booths
          console.warn('⚠️ Some booths already exist. Fetching existing...');
          existingBooths = await Booth.find({ expoId, isDeleted: false }).lean();
        }
      }
    }

    const booths = (await Booth.getFloorPlan(expoId)).map(formatBoothForClient);

    // Get status counts
    const statusCounts = await Booth.getStatusCounts(expoId);
    const summary = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        expo,
        booths,
        summary: {
          available: summary.available || 0,
          pending: summary.pending || 0,
          assigned: summary.assigned || 0,
          maintenance: summary.maintenance || 0,
        },
      },
    });
  } catch (err) {
    console.error('❌ Error in getFloorPlan:', err);
    return next(err);
  }
};

// ─── Generate booths for an expo (admin) ────────────────────────────────────
const generateBooths = async (req, res, next) => {
  try {
    const { expoId } = req.params;

    const expo = await Expo.findById(expoId)
      .select('title floorPlanConfig boothPrice boothCurrency')
      .lean();

    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    // Check if booths already exist
    const existingCount = await Booth.countDocuments({ expoId, isDeleted: false });
    if (existingCount > 0) {
      return res.status(200).json({
        success: true,
        message: `Booths already exist for this expo (${existingCount} booths).`,
        data: {
          total: existingCount,
          alreadyExists: true,
        },
      });
    }

    const { rows, cols } = expo.floorPlanConfig;
    const boothsToCreate = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const boothNumber = Booth.formatBoothNumber(row, col);
        
        boothsToCreate.push({
          expoId: expoId,
          boothNumber: boothNumber,
          gridCoordinates: {
            row: row,
            col: col,
            rowSpan: 1,
            colSpan: 1,
          },
          status: 'available',
          dimensions: `${expo.floorPlanConfig.boothWidth}m x ${expo.floorPlanConfig.boothHeight}m`,
          size: 'Standard',
          type: 'Standard',
          pricing: {
            basePrice: expo.boothPrice || 0,
            currency: expo.boothCurrency || 'USD',
            isPremium: false,
            premiumMultiplier: 1.0,
          },
          amenities: {
            power: false,
            wifi: false,
            water: false,
            lighting: false,
            storage: false,
            carpeted: false,
          },
          isDeleted: false,
        });
      }
    }
    
    let createdCount = 0;
    if (boothsToCreate.length > 0) {
      try {
        const result = await Booth.insertMany(boothsToCreate, { ordered: false });
        createdCount = result.length;
      } catch (insertError) {
        // Some may have been created, check count
        const newCount = await Booth.countDocuments({ expoId, isDeleted: false });
        createdCount = newCount - existingCount;
        console.warn(`⚠️ Partial generation: ${createdCount} booths created`);
      }
    }

    // Update expo booth count
    await Expo.incrementCounter(expoId, 'boothCount', createdCount);

    return res.status(201).json({
      success: true,
      message: `Generated ${createdCount} booths successfully.`,
      data: {
        total: createdCount,
        rows,
        cols,
      },
    });
  } catch (err) {
    console.error('❌ Error in generateBooths:', err);
    return next(err);
  }
};

// ─── Regenerate booths (admin - clears existing and regenerates) ────────────
const regenerateBooths = async (req, res, next) => {
  try {
    const { expoId } = req.params;

    const expo = await Expo.findById(expoId)
      .select('title floorPlanConfig boothPrice boothCurrency')
      .lean();

    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    // Delete all existing booths for this expo
    await Booth.deleteMany({ expoId });

    const { rows, cols } = expo.floorPlanConfig;
    const boothsToCreate = [];
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const boothNumber = Booth.formatBoothNumber(row, col);
        
        boothsToCreate.push({
          expoId: expoId,
          boothNumber: boothNumber,
          gridCoordinates: {
            row: row,
            col: col,
            rowSpan: 1,
            colSpan: 1,
          },
          status: 'available',
          dimensions: `${expo.floorPlanConfig.boothWidth}m x ${expo.floorPlanConfig.boothHeight}m`,
          size: 'Standard',
          type: 'Standard',
          pricing: {
            basePrice: expo.boothPrice || 0,
            currency: expo.boothCurrency || 'USD',
            isPremium: false,
            premiumMultiplier: 1.0,
          },
          amenities: {
            power: false,
            wifi: false,
            water: false,
            lighting: false,
            storage: false,
            carpeted: false,
          },
          isDeleted: false,
        });
      }
    }
    
    if (boothsToCreate.length > 0) {
      await Booth.insertMany(boothsToCreate);
    }

    // Update expo booth count
    await Expo.incrementCounter(expoId, 'boothCount', boothsToCreate.length);

    return res.status(201).json({
      success: true,
      message: `Regenerated ${boothsToCreate.length} booths successfully.`,
      data: {
        total: boothsToCreate.length,
        rows,
        cols,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Get booths by expo (admin paginated) ────────────────────────────────────
const getBoothsByExpo = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { expoId } = req.params;
    const { page = 1, limit = 20, status, type, size } = req.query;

    const query = { expoId, isDeleted: false };
    if (status) query.status = { $in: status.split(',') };
    if (type) query.type = type;
    if (size) query.size = size;

    const booths = await Booth.find(query)
      .populate('assignedTo', 'name email avatar company')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const total = await Booth.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        booths,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Get booth by ID ──────────────────────────────────────────────────────────
const getBoothById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booth = await Booth.findById(id)
      .populate('assignedTo', 'name email avatar company')
      .populate('expoId', 'title boothPrice boothCurrency')
      .lean();

    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    return res.status(200).json({
      success: true,
      data: booth,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Create booth (admin) ─────────────────────────────────────────────────────
const createBooth = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { expoId } = req.params;
    const userId = req.user._id;

    // Check if expo exists
    const expo = await Expo.findById(expoId);
    if (!expo) {
      return next(createError(404, 'Expo not found.'));
    }

    // Check if booth already exists at these coordinates
    const { gridCoordinates } = req.body;
    const existing = await Booth.findByCoordinates(
      expoId,
      gridCoordinates.row,
      gridCoordinates.col
    );

    if (existing) {
      return next(createError(409, 'A booth already exists at these grid coordinates.'));
    }

    const booth = await Booth.create({
      ...req.body,
      expoId,
      createdBy: userId,
    });

    // Increment booth count on expo
    await Expo.incrementCounter(expoId, 'boothCount', 1);

    return res.status(201).json({
      success: true,
      message: 'Booth created successfully.',
      data: booth,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Update booth (admin) ─────────────────────────────────────────────────────
const updateBooth = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { id } = req.params;
    const updates = req.body;

    const booth = await Booth.findById(id);
    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    // Don't allow changing booth number or expo
    delete updates.boothNumber;
    delete updates.expoId;

    Object.assign(booth, updates);
    await booth.save();

    return res.status(200).json({
      success: true,
      message: 'Booth updated successfully.',
      data: booth,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Delete booth (admin) ─────────────────────────────────────────────────────
const deleteBooth = async (req, res, next) => {
  try {
    const { id } = req.params;

    const booth = await Booth.findById(id);
    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    if (booth.status === 'assigned') {
      return next(createError(400, 'Cannot delete an assigned booth. Release it first.'));
    }

    // Soft delete
    booth.isDeleted = true;
    await booth.save();

    // Decrement booth count on expo
    await Expo.incrementCounter(booth.expoId, 'boothCount', -1);

    return res.status(200).json({
      success: true,
      message: 'Booth deleted successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Reserve booth (exhibitor) ───────────────────────────────────────────────
const reserveBooth = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const booth = await Booth.findById(id);
    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    const canReserve = booth.canReserve(userId);
    if (!canReserve.allowed) {
      return next(createError(400, canReserve.reason));
    }

    await booth.reserve(userId);

    return res.status(200).json({
      success: true,
      message: 'Booth reserved successfully. Awaiting admin approval.',
      data: booth,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Approve booth reservation (admin) ───────────────────────────────────────
const approveBooth = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.user._id;

    const booth = await Booth.findById(id);
    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    if (booth.status !== 'pending') {
      return next(createError(400, `Cannot approve a booth with status: ${booth.status}.`));
    }

    await booth.confirm(booth.assignedTo);

    // Sync assigned booth to exhibitor profile
    const ExhibitorProfile = require('../models/Exhibitorprofile');
    const profile = await ExhibitorProfile.findOne({ userId: booth.assignedTo });
    if (profile) {
      const alreadyAssigned = profile.assignedBooths.some(
        (ab) => ab.boothId?.toString() === booth._id.toString()
      );
      if (!alreadyAssigned) {
        profile.assignedBooths.push({
          boothId: booth._id,
          expoId: booth.expoId,
          assignedBy: adminId,
          assignedAt: new Date(),
        });
        await profile.save();
      }
    }

    // Add admin note to history
    if (note) {
      booth.history.push({
        status: 'assigned',
        userId: adminId,
        note: `Admin approved: ${note}`,
      });
      await booth.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Booth approved and assigned successfully.',
      data: booth,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Reject booth reservation (admin) ────────────────────────────────────────
const rejectBooth = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.user._id;

    const booth = await Booth.findById(id);
    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    if (booth.status !== 'pending') {
      return next(createError(400, `Cannot reject a booth with status: ${booth.status}.`));
    }

    await booth.cancelReservation(booth.assignedTo, note || 'Rejected by admin');

    // Add admin note to history
    if (note) {
      booth.history.push({
        status: 'available',
        userId: adminId,
        note: `Admin rejected: ${note}`,
      });
      await booth.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Booth reservation rejected.',
      data: booth,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Release booth (admin force-release) ─────────────────────────────────────
const releaseBooth = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { id } = req.params;
    const { note } = req.body;
    const adminId = req.user._id;

    const booth = await Booth.findById(id);
    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    if (booth.status === 'available') {
      return next(createError(400, 'Booth is already available.'));
    }

    await booth.release(adminId, note || 'Force-released by admin');

    return res.status(200).json({
      success: true,
      message: 'Booth released successfully.',
      data: booth,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Lock booth (exhibitor optimistic lock) ──────────────────────────────────
const lockBooth = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const booth = await Booth.findById(id);
    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    if (booth.status !== 'available') {
      return next(createError(400, `Booth is already ${booth.status}.`));
    }

    if (booth.reservationLocked) {
      return next(createError(400, 'Booth is currently locked by another user.'));
    }

    // Lock for 30 seconds (optimistic UI lock)
    booth.reservationLocked = true;
    booth.lockedBy = userId;
    booth.reservationExpiresAt = new Date(Date.now() + 30 * 1000);
    await booth.save();

    return res.status(200).json({
      success: true,
      message: 'Booth locked successfully.',
      data: {
        expiresAt: booth.reservationExpiresAt,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Get availability summary ────────────────────────────────────────────────
const getAvailabilitySummary = async (req, res, next) => {
  try {
    const { expoId } = req.params;

    const statusCounts = await Booth.getStatusCounts(expoId);
    const summary = statusCounts.reduce((acc, curr) => {
      acc[curr._id] = curr.count;
      return acc;
    }, {});

    const total = await Booth.countDocuments({ expoId, isDeleted: false });

    return res.status(200).json({
      success: true,
      data: {
        total,
        available: summary.available || 0,
        pending: summary.pending || 0,
        assigned: summary.assigned || 0,
        maintenance: summary.maintenance || 0,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Get public grid (lightweight for attendees) ─────────────────────────────
const getPublicGrid = async (req, res, next) => {
  try {
    const { expoId } = req.params;

    const booths = await Booth.find({
      expoId,
      isDeleted: false,
    })
      .select('boothNumber gridCoordinates status assignedTo')
      .populate('assignedTo', 'name avatar')
      .sort({ 'gridCoordinates.row': 1, 'gridCoordinates.col': 1 })
      .lean();

    // Load exhibitor profiles for assigned booths
    const assignedUserIds = booths
      .filter((b) => b.status === 'assigned' && b.assignedTo?._id)
      .map((b) => b.assignedTo._id);

    const ExhibitorProfile = require('../models/Exhibitorprofile');
    const profiles = assignedUserIds.length > 0
      ? await ExhibitorProfile.find({ userId: { $in: assignedUserIds } })
          .select('userId companyName logo')
          .lean()
      : [];

    const profileByUser = profiles.reduce((acc, p) => {
      acc[p.userId.toString()] = p;
      return acc;
    }, {});

    const formattedBooths = booths.map((booth) => {
      const isOccupied = booth.status === 'assigned';
      const profile = booth.assignedTo?._id
        ? profileByUser[booth.assignedTo._id.toString()]
        : null;

      return {
        _id: booth._id,
        boothId: booth._id,
        boothNumber: booth.boothNumber,
        gridCoordinates: booth.gridCoordinates,
        status: booth.status,
        isOccupied,
        exhibitor: isOccupied
          ? {
              companyName: profile?.companyName || booth.assignedTo?.name || 'Exhibitor',
              logo: profile?.logo || null,
            }
          : null,
      };
    });

    const summary = formattedBooths.reduce(
      (acc, b) => {
        acc[b.status] = (acc[b.status] || 0) + 1;
        return acc;
      },
      { available: 0, pending: 0, assigned: 0, maintenance: 0 }
    );
    summary.total = formattedBooths.length;

    return res.status(200).json({
      success: true,
      data: {
        booths: formattedBooths,
        summary,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── Cancel booth reservation (exhibitor) ────────────────────────────────────
const cancelBoothReservation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const booth = await Booth.findById(id);
    if (!booth) {
      return next(createError(404, 'Booth not found.'));
    }

    // Check if the user owns this booth
    if (booth.assignedTo?.toString() !== userId.toString()) {
      return next(createError(403, 'You do not have permission to cancel this reservation.'));
    }

    // Only allow cancellation if status is 'pending' or 'assigned'
    if (!['pending', 'assigned'].includes(booth.status)) {
      return next(createError(400, `Cannot cancel a booth with status: ${booth.status}.`));
    }

    // Remove from exhibitor profile
    const ExhibitorProfile = require('../models/Exhibitorprofile');
    const profile = await ExhibitorProfile.findOne({ userId });
    if (profile) {
      // Remove this booth from assignedBooths
      profile.assignedBooths = profile.assignedBooths.filter(
        (ab) => ab.boothId?.toString() !== booth._id.toString()
      );
      await profile.save();
    }

    // Reset booth status
    booth.status = 'available';
    booth.assignedTo = null;
    booth.assignedAt = null;
    booth.reservationLocked = false;
    booth.reservationExpiresAt = null;
    booth.lockedBy = null;
    await booth.save();

    // Send notification
    const Notification = require('../models/Notification');
    const io = req.app.get('io');
    await Notification.createAndEmit(io, {
      recipient: userId,
      type: 'booth_released',
      title: '📌 Booth Reservation Cancelled',
      body: `You have cancelled your reservation for booth ${booth.boothNumber}.`,
      link: `/exhibitor/expos/${booth.expoId}/floor-plan`,
      referenceId: booth._id,
      referenceModel: 'Booth',
    });

    return res.status(200).json({
      success: true,
      message: 'Booth reservation cancelled successfully.',
      data: booth,
    });

  } catch (err) {
    return next(err);
  }
};

// ─── Export ──────────────────────────────────────────────────────────────────
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
  getPublicGrid,
  generateBooths,      // ✅ ADD THIS
  regenerateBooths,    // ✅ ADD THIS
  cancelBoothReservation,
};