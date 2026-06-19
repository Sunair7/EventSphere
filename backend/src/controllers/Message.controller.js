'use strict';

const mongoose             = require('mongoose');
const { validationResult } = require('express-validator');
const Message              = require('../models/Message');
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
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 30));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

// Relay a persisted message to the recipient via Socket.io chat namespace
const relayToSocket = (req, message) => {
  const io = req.app.get('io');
  if (!io?.chatNsp) return;

  io.chatNsp.to(`user:${message.receiverId.toString()}`).emit('chat:new_message', {
    _id:            message._id,
    conversationId: message.conversationId,
    senderId:       message.senderId,
    receiverId:     message.receiverId,
    type:           message.type,
    content:        message.content,
    attachment:     message.attachment,
    replyTo:        message.replyTo,
    isRead:         message.isRead,
    createdAt:      message.createdAt,
  });

  // Push an unread badge notification
  const notifyNsp = io.notifyNsp;
  if (notifyNsp) {
    notifyNsp.pushToUser(message.receiverId.toString(), 'notification:new_message', {
      senderId:   message.senderId,
      messageId:  message._id,
      preview:    message.content
        ? message.content.slice(0, 60)
        : '📎 Attachment',
    });
  }
};

// ─── @route   GET /api/v1/messages/inbox ─────────────────────────────────────
// @access  Authenticated
// Returns one latest message per unique conversation thread with unread counts
const getInbox = async (req, res, next) => {
  try {
    const threads = await Message.getInbox(req.user._id);

    return res.status(200).json({
      success: true,
      data: {
        threads,
        total: threads.length,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/messages/unread-count ──────────────────────────────
// @access  Authenticated
// Lightweight endpoint for the nav sidebar unread badge
const getUnreadCount = async (req, res, next) => {
  try {
    const count = await Message.getUnreadCount(req.user._id);

    return res.status(200).json({
      success: true,
      data:    { unreadCount: count },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/messages/conversation/:userId ──────────────────────
// @access  Authenticated
// Paginated message history between the requester and another user
const getConversation = async (req, res, next) => {
  try {
    const { userId }        = req.params;
    const { page, limit }   = parsePagination(req.query);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(createError(400, 'Invalid user ID format.'));
    }

    if (userId === req.user._id.toString()) {
      return next(createError(400, 'Cannot retrieve a conversation with yourself.'));
    }

    // Verify the other participant exists
    const otherUser = await User.findById(userId)
      .select('name avatar role isActive')
      .lean();

    if (!otherUser || !otherUser.isActive) {
      return next(createError(404, 'User not found.'));
    }

    const messages = await Message.getConversation(req.user._id, userId, { page, limit });

    // Auto-mark as read — all unread messages in this thread from the other user
    const conversationId = Message.buildConversationId(req.user._id, userId);
    const markResult     = await Message.markConversationAsRead(
      conversationId,
      req.user._id
    );

    // Notify the sender their messages were read
    if (markResult.modifiedCount > 0) {
      const io = req.app.get('io');
      if (io?.chatNsp) {
        io.chatNsp.to(`user:${userId}`).emit('chat:messages_read', {
          by:            req.user._id,
          conversationId,
          timestamp:     new Date().toISOString(),
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        messages,
        participant: otherUser,
        pagination: {
          page,
          limit,
          hasMore: messages.length === limit,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   POST /api/v1/messages ──────────────────────────────────────────
// @access  Authenticated
// Persist a message and relay it in real time via Socket.io
const sendMessage = async (req, res, next) => {
  try {
    handleValidationErrors(req);

    const { receiverId, content, type, attachment, replyTo, expoId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return next(createError(400, 'Invalid receiver ID format.'));
    }

    if (receiverId === req.user._id.toString()) {
      return next(createError(400, 'You cannot send a message to yourself.'));
    }

    // Verify receiver exists and is active
    const receiver = await User.findById(receiverId).select('_id isActive name').lean();
    if (!receiver || !receiver.isActive) {
      return next(createError(404, 'Recipient not found.'));
    }

    // Validate replyTo reference if provided
    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return next(createError(400, 'Invalid replyTo message ID.'));
      }

      const parentMsg = await Message.findById(replyTo)
        .select('conversationId')
        .lean();

      if (!parentMsg) {
        return next(createError(404, 'The message you are replying to was not found.'));
      }

      const expectedConvId = Message.buildConversationId(req.user._id, receiverId);
      if (parentMsg.conversationId !== expectedConvId) {
        return next(createError(422, 'Cannot reply to a message from a different conversation.'));
      }
    }

    const message = await Message.create({
      senderId:   req.user._id,
      receiverId,
      type:       type       || 'text',
      content:    content    ? content.trim().slice(0, 2000) : null,
      attachment: attachment || null,
      replyTo:    replyTo    || null,
      expoId:     expoId     || null,
    });

    // Populate sender info before relaying
    await message.populate('senderId', 'name avatar');

    // Real-time relay (non-blocking)
    relayToSocket(req, message);

    return res.status(201).json({
      success: true,
      message: 'Message sent.',
      data:    { message },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   PATCH /api/v1/messages/conversation/:userId/read ───────────────
// @access  Authenticated
// Explicitly mark all unread messages in a thread as read
// (also triggered automatically on getConversation, provided here for Socket-only flows)
const markConversationAsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(createError(400, 'Invalid user ID format.'));
    }

    const conversationId = Message.buildConversationId(req.user._id, userId);
    const result         = await Message.markConversationAsRead(conversationId, req.user._id);

    if (result.modifiedCount > 0) {
      const io = req.app.get('io');
      if (io?.chatNsp) {
        io.chatNsp.to(`user:${userId}`).emit('chat:messages_read', {
          by:            req.user._id,
          conversationId,
          timestamp:     new Date().toISOString(),
        });
      }
    }

    return res.status(200).json({
      success:       true,
      message:       `${result.modifiedCount} message(s) marked as read.`,
      markedAsRead:  result.modifiedCount,
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   DELETE /api/v1/messages/:id ────────────────────────────────────
// @access  Authenticated (sender or receiver only)
// Soft-deletes from the requester's view; hard-deletes when both parties delete
const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createError(400, 'Invalid message ID format.'));
    }

    const message = await Message.findById(id)
      .select('+deletedBySender +deletedByReceiver');

    if (!message) {
      return next(createError(404, 'Message not found.'));
    }

    const isSender   = message.senderId.toString()   === req.user._id.toString();
    const isReceiver = message.receiverId.toString()  === req.user._id.toString();

    if (!isSender && !isReceiver) {
      return next(createError(403, 'You do not have permission to delete this message.'));
    }

    await message.softDelete(req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully.',
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/messages/admin/expo/:expoId/stats ──────────────────
// @access  Admin
// Analytics — total messages, unique senders, conversations for an expo
const getExpoMessageStats = async (req, res, next) => {
  try {
    const { expoId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(expoId)) {
      return next(createError(400, 'Invalid expo ID format.'));
    }

    const [stats] = await Message.getExpoMessageStats(expoId);

    return res.status(200).json({
      success: true,
      data:    { stats: stats || { totalMessages: 0, uniqueSenders: 0, uniqueConversations: 0 } },
    });
  } catch (err) {
    return next(err);
  }
};

// ─── @route   GET /api/v1/messages/admin/conversations ───────────────────────
// @access  Admin
// Surface all conversations across the platform for moderation
const getAllConversations = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const pipeline = [
      {
        $group: {
          _id:         '$conversationId',
          lastMessage: { $last:  '$$ROOT' },
          total:       { $sum:   1 },
          unread:      { $sum:   { $cond: ['$isRead', 0, 1] } },
        },
      },
      { $sort:  { 'lastMessage.createdAt': -1 } },
      { $skip:  skip  },
      { $limit: limit },
      {
        $lookup: {
          from:         'users',
          localField:   'lastMessage.senderId',
          foreignField: '_id',
          as:           'sender',
          pipeline:     [{ $project: { name: 1, email: 1, role: 1 } }],
        },
      },
      {
        $lookup: {
          from:         'users',
          localField:   'lastMessage.receiverId',
          foreignField: '_id',
          as:           'receiver',
          pipeline:     [{ $project: { name: 1, email: 1, role: 1 } }],
        },
      },
      {
        $addFields: {
          sender:   { $arrayElemAt: ['$sender',   0] },
          receiver: { $arrayElemAt: ['$receiver', 0] },
        },
      },
      { $project: { lastMessage: 1, total: 1, unread: 1, sender: 1, receiver: 1 } },
    ];

    const [conversations, totalGroups] = await Promise.all([
      Message.aggregate(pipeline),
      Message.aggregate([{ $group: { _id: '$conversationId' } }, { $count: 'total' }]),
    ]);

    const total = totalGroups[0]?.total || 0;

    return res.status(200).json({
      success: true,
      data: {
        conversations,
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

module.exports = {
  getInbox,
  getUnreadCount,
  getConversation,
  sendMessage,
  markConversationAsRead,
  deleteMessage,
  getExpoMessageStats,
  getAllConversations,
};