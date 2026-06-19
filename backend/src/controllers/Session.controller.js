'use strict';

const mongoose             = require('mongoose');
const { validationResult } = require('express-validator');
const Session              = require('../models/Session');
const Expo                 = require('../models/Expo');

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

const emitSessionUpdate = (req, expoId, event, payload) => {
  const io = req.app.get('io');
  if (!io?.notifyNsp) return;
  io.notifyNsp.pushBroadcast(event, { expoId, ...payload });
};

// ─── @route   POST /api/v1/sessions/expo/:expoId ─────────────────────────────
// @access  Admin
const createSession = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { expoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const expo = await Expo.findById(expoId).select('status title startDate endDate').lean();
    if (!expo) return next(createError(404, 'Expo not found.'));

    if (['completed', 'cancelled'].includes(expo.status)) {
      return next(createError(422, `Cannot add sessions to an expo with status: ${expo.status}.`));
    }

    const {
      title, description, format, location,
      startTime, endTime, speakers, tags,
      maxCapacity, isPublic, isFeatured, streamUrl,
    } = req.body;

    const start = new Date(startTime);
    const end   = new Date(endTime);

    // Validate session times fall within expo dates
    if (start < expo.startDate || end > expo.endDate) {
      return next(createError(422, 'Session times must fall within the expo start and end dates.'));
    }

    // Detect room scheduling conflicts before creating
    const conflicts = await Session.detectConflicts(expoId, location, start, end);
    if (conflicts.length > 0) {
      const conflict = conflicts[0];
      return next(
        createError(
          409,
          `Room "${location}" is already booked: "${conflict.title}" runs from ${new Date(conflict.startTime).toISOString()} to ${new Date(conflict.endTime).toISOString()}.`
        )
      );
    }

    const session = await Session.create({
      expoId,
      title,
      description:  description  || null,
      format:       format       || 'presentation',
      location,
      startTime:    start,
      endTime:      end,
      speakers:     speakers     || [],
      tags:         tags         || [],
      maxCapacity:  maxCapacity  || null,
      isPublic:     isPublic     !== undefined ? isPublic : true,
      isFeatured:   isFeatured   || false,
      streamUrl:    streamUrl    || null,
      createdBy:    req.user._id,
    });

    emitSessionUpdate(req, expoId, 'session:created', {
      sessionId: session._id,
      title:     session.title,
      location:  session.location,
      startTime: session.startTime,
      endTime:   session.endTime,
      format:    session.format,
    });

    return res.status(201).json({
      success: true,
      message: 'Session created successfully.',
      data:    { session },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/sessions/expo/:expoId ──────────────────────────────
// @access  Public (published expos) | Admin (any)
const getSessionsByExpo = async (req, res, next) => {
  try {
    const { expoId }        = req.params;
    const { page, limit, skip } = parsePagination(req.query);
    const { format, status, location, search, date, isFeatured } = req.query;

    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const isAdmin = req.user?.role === 'admin';
    const filter  = { expoId };

    if (!isAdmin) filter.isPublic = true;
    if (format)     filter.format   = format;
    if (status)     filter.status   = { $in: status.split(',').map((s) => s.trim()) };
    if (location)   filter.location = { $regex: location.trim(), $options: 'i' };
    if (isFeatured) filter.isFeatured = isFeatured === 'true';

    // Filter by a specific calendar date (YYYY-MM-DD)
    if (date) {
      const dayStart = new Date(date);
      const dayEnd   = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      dayEnd.setUTCHours(23, 59, 59, 999);
      filter.startTime = { $gte: dayStart, $lte: dayEnd };
    }

    if (search?.trim()) filter.$text = { $search: search.trim() };

    const [sessions, total] = await Promise.all([
      Session.find(filter)
        .select('-attendees -bookmarkedBy')
        .sort({ startTime: 1, location: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Session.countDocuments(filter),
    ]);

    // Attach registration status for the requesting user
    let enrichedSessions = sessions;
    if (req.user) {
      const userId = req.user._id.toString();
      const [registrations, bookmarks] = await Promise.all([
        Session.find({ expoId, 'attendees.userId': req.user._id }).select('_id').lean(),
        Session.find({ expoId, bookmarkedBy: req.user._id }).select('_id').lean(),
      ]);
      const registeredIds = new Set(registrations.map((s) => s._id.toString()));
      const bookmarkedIds = new Set(bookmarks.map((s) => s._id.toString()));

      enrichedSessions = sessions.map((s) => ({
        ...s,
        isRegistered:  registeredIds.has(s._id.toString()),
        isBookmarked:  bookmarkedIds.has(s._id.toString()),
      }));
    }

    res.setHeader('X-Total-Count', total);

    return res.status(200).json({
      success: true,
      data: {
        sessions: enrichedSessions,
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

// ─── @route   GET /api/v1/sessions/:id ───────────────────────────────────────
// @access  Authenticated
const getSessionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid session ID format.'));
    }

    const session = await Session.findById(id)
      .select('-attendees -bookmarkedBy')
      .populate('expoId',    'title status startDate endDate')
      .populate('createdBy', 'name email')
      .lean();

    if (!session) return next(createError(404, 'Session not found.'));

    if (!session.isPublic && req.user?.role !== 'admin') {
      return next(createError(403, 'This session is not publicly accessible.'));
    }

    // Attach per-user flags
    let isRegistered = false;
    let isBookmarked = false;

    if (req.user) {
      const userId = req.user._id;
      const [regCheck, bookmarkCheck] = await Promise.all([
        Session.findOne({ _id: id, 'attendees.userId': userId }).select('_id').lean(),
        Session.findOne({ _id: id, bookmarkedBy: userId }).select('_id').lean(),
      ]);
      isRegistered = !!regCheck;
      isBookmarked = !!bookmarkCheck;
    }

    return res.status(200).json({
      success: true,
      data:    { session: { ...session, isRegistered, isBookmarked } },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PUT /api/v1/sessions/:id ───────────────────────────────────────
// @access  Admin
const updateSession = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid session ID format.'));
    }

    const session = await Session.findById(id);
    if (!session) return next(createError(404, 'Session not found.'));

    if (session.status === 'cancelled') {
      return next(createError(422, 'Cannot edit a cancelled session.'));
    }

    const allowedFields = [
      'title', 'description', 'format', 'location',
      'speakers', 'tags', 'maxCapacity', 'isPublic',
      'isFeatured', 'streamUrl', 'resources',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) session[field] = req.body[field];
    });

    // Handle date updates with conflict re-check
    const newStart = req.body.startTime ? new Date(req.body.startTime) : session.startTime;
    const newEnd   = req.body.endTime   ? new Date(req.body.endTime)   : session.endTime;
    const newLoc   = req.body.location  || session.location;

    if (req.body.startTime || req.body.endTime || req.body.location) {
      const expo = await Expo.findById(session.expoId).select('startDate endDate').lean();

      if (newStart < expo.startDate || newEnd > expo.endDate) {
        return next(createError(422, 'Session times must fall within the expo dates.'));
      }

      const conflicts = await Session.detectConflicts(
        session.expoId, newLoc, newStart, newEnd, id
      );

      if (conflicts.length > 0) {
        return next(
          createError(
            409,
            `Room "${newLoc}" is already booked during the requested time slot.`
          )
        );
      }

      session.startTime = newStart;
      session.endTime   = newEnd;
      session.location  = newLoc;
    }

    await session.save();

    emitSessionUpdate(req, session.expoId.toString(), 'session:updated', {
      sessionId: session._id,
      title:     session.title,
      location:  session.location,
      startTime: session.startTime,
      endTime:   session.endTime,
    });

    return res.status(200).json({
      success: true,
      message: 'Session updated successfully.',
      data:    { session },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   DELETE /api/v1/sessions/:id ────────────────────────────────────
// @access  Admin
const deleteSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid session ID format.'));
    }

    const session = await Session.findById(id).select('+attendees');
    if (!session) return next(createError(404, 'Session not found.'));

    if (session.status === 'live') {
      return next(createError(422, 'Cannot delete a live session. Cancel it first.'));
    }

    const expoId = session.expoId.toString();
    await Session.findByIdAndDelete(id);

    emitSessionUpdate(req, expoId, 'session:deleted', { sessionId: id });

    return res.status(200).json({
      success: true,
      message: 'Session deleted successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/sessions/:id/status ──────────────────────────────
// @access  Admin
const updateSessionStatus = async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid session ID format.'));
    }

    const session = await Session.findById(id);
    if (!session) return next(createError(404, 'Session not found.'));

    await session.transitionStatus(status);

    emitSessionUpdate(req, session.expoId.toString(), 'session:status_changed', {
      sessionId: session._id,
      title:     session.title,
      status:    session.status,
    });

    // Notify all registered attendees when a session goes live or is cancelled
    if (['live', 'cancelled'].includes(session.status)) {
      const fullSession = await Session.findById(id).select('+attendees').lean();
      const attendeeIds = (fullSession?.attendees || []).map((a) => a.userId);

      attendeeIds.forEach((userId) => {
        emitNotification(req,
          { userId },
          session.status === 'live'
            ? 'notification:session_live'
            : 'notification:session_cancelled',
          {
            sessionId: session._id,
            title:     session.title,
            location:  session.location,
            message:   session.status === 'live'
              ? `"${session.title}" is now live in ${session.location}!`
              : `"${session.title}" has been cancelled.`,
          }
        );
      });
    }

    return res.status(200).json({
      success: true,
      message: `Session status updated to "${session.status}".`,
      data:    { session },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/sessions/:id/register ─────────────────────────────
// @access  Attendee, Exhibitor
const registerForSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid session ID format.'));
    }

    const session = await Session.findById(id).select('+attendees');
    if (!session) return next(createError(404, 'Session not found.'));

    if (!session.isPublic) {
      return next(createError(403, 'This session is not open for public registration.'));
    }

    await session.registerAttendee(req.user._id);

    // Update the expo attendee count on first session registration for this user
    await Expo.findByIdAndUpdate(session.expoId, { $inc: { attendeeCount: 0 } });

    return res.status(200).json({
      success:      true,
      message:      `Successfully registered for "${session.title}".`,
      spotsRemaining: session.spotsRemaining,
    });
  } catch (err) {
    if (err.message.includes('already registered') || err.message.includes('capacity')) {
      return next(createError(409, err.message));
    }
    return next(err);
  }
};

// ─── @route   DELETE /api/v1/sessions/:id/register ───────────────────────────
// @access  Attendee, Exhibitor
const unregisterFromSession = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid session ID format.'));
    }

    const session = await Session.findById(id).select('+attendees');
    if (!session) return next(createError(404, 'Session not found.'));

    if (session.status === 'completed') {
      return next(createError(422, 'Cannot unregister from a completed session.'));
    }

    await session.unregisterAttendee(req.user._id);

    return res.status(200).json({
      success: true,
      message: `Successfully unregistered from "${session.title}".`,
    });
  } catch (err) {
    if (err.message.includes('not registered')) {
      return next(createError(404, err.message));
    }
    return next(err);
  }
};

// ─── @route   POST /api/v1/sessions/:id/checkin/:userId ──────────────────────
// @access  Admin
const checkInAttendee = async (req, res, next) => {
  try {
    const { id, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return next(createError(400, 'Invalid ID format.'));
    }

    const session = await Session.findById(id).select('+attendees');
    if (!session) return next(createError(404, 'Session not found.'));

    if (session.status !== 'live') {
      return next(createError(422, 'Check-in is only available for live sessions.'));
    }

    await session.checkInAttendee(userId);

    return res.status(200).json({
      success: true,
      message: 'Attendee checked in successfully.',
    });
  } catch (err) {
    if (err.message.includes('not registered') || err.message.includes('already been')) {
      return next(createError(409, err.message));
    }
    return next(err);
  }
};

// ─── @route   POST /api/v1/sessions/:id/bookmark ─────────────────────────────
// @access  Authenticated
const toggleBookmark = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid session ID format.'));
    }

    const session = await Session.findById(id).select('+bookmarkedBy');
    if (!session) return next(createError(404, 'Session not found.'));

    const { isBookmarked } = await session.toggleBookmark(req.user._id);

    return res.status(200).json({
      success:     true,
      message:     isBookmarked ? 'Session bookmarked.' : 'Bookmark removed.',
      isBookmarked,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/sessions/me/registrations ──────────────────────────
// @access  Authenticated
const getMyRegistrations = async (req, res, next) => {
  try {
    const { expoId } = req.query;

    if (expoId && !mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const sessions = await Session.getUserRegistrations(req.user._id, expoId || null);

    return res.status(200).json({
      success: true,
      data:    { sessions, total: sessions.length },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/sessions/me/bookmarks ──────────────────────────────
// @access  Authenticated
const getMyBookmarks = async (req, res, next) => {
  try {
    const { expoId } = req.query;

    if (expoId && !mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const sessions = await Session.getUserBookmarks(req.user._id, expoId || null);

    return res.status(200).json({
      success: true,
      data:    { sessions, total: sessions.length },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/sessions/expo/:expoId/schedule ─────────────────────
// @access  Public
// Returns a room-grouped schedule object for the agenda view
const getExpoSchedule = async (req, res, next) => {
  try {
    const { expoId } = req.params;
    const { date }   = req.query;

    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const filter = {};
    if (date) {
      const dayStart = new Date(date);
      const dayEnd   = new Date(date);
      dayStart.setUTCHours(0, 0, 0, 0);
      dayEnd.setUTCHours(23, 59, 59, 999);
      filter.startTime = { $gte: dayStart, $lte: dayEnd };
    }

    const sessions = await Session.getExpoSchedule(expoId, filter);

    // Group by room / location for the agenda grid view
    const byRoom = sessions.reduce((acc, session) => {
      const room = session.location;
      if (!acc[room]) acc[room] = [];
      acc[room].push(session);
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      data: {
        sessions,
        byRoom,
        total: sessions.length,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/sessions/:id/attendees ─────────────────────────────
// @access  Admin
const getSessionAttendees = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid session ID format.'));
    }

    const session = await Session.findById(id)
      .select('+attendees')
      .populate('attendees.userId', 'name email')
      .lean();

    if (!session) return next(createError(404, 'Session not found.'));

    return res.status(200).json({
      success: true,
      data: {
        attendees:     session.attendees,
        total:         session.attendees.length,
        checkedIn:     session.attendees.filter((a) => a.attended).length,
        notCheckedIn:  session.attendees.filter((a) => !a.attended).length,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  createSession,
  getSessionsByExpo,
  getSessionById,
  updateSession,
  deleteSession,
  updateSessionStatus,
  registerForSession,
  unregisterFromSession,
  checkInAttendee,
  toggleBookmark,
  getMyRegistrations,
  getMyBookmarks,
  getExpoSchedule,
  getSessionAttendees,
};