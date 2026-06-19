'use strict';

const jwt = require('jsonwebtoken');
const cookie = require('cookie');

// ─── Namespaces ───────────────────────────────────────────────────────────────
const NAMESPACE_BOOTH   = '/booths';
const NAMESPACE_CHAT    = '/chat';
const NAMESPACE_NOTIFY  = '/notifications';

// ─── In-memory presence registry  ────────────────────────────────────────────
// Maps userId → Set<socketId> per namespace so one user can have multiple tabs.
const presenceMap = new Map();

const addPresence = (userId, socketId) => {
  if (!presenceMap.has(userId)) presenceMap.set(userId, new Set());
  presenceMap.get(userId).add(socketId);
};

const removePresence = (userId, socketId) => {
  if (!presenceMap.has(userId)) return;
  presenceMap.get(userId).delete(socketId);
  if (presenceMap.get(userId).size === 0) presenceMap.delete(userId);
};

const isOnline = (userId) => presenceMap.has(userId) && presenceMap.get(userId).size > 0;

// ─── JWT Socket Middleware ────────────────────────────────────────────────────
const socketAuthMiddleware = (socket, next) => {
  try {
    let token = null;

    // 1. Try Authorization header (Bearer token)
    const authHeader = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    }

    // 2. Fall back to HttpOnly cookie
    if (!token && socket.handshake.headers?.cookie) {
      const cookies = cookie.parse(socket.handshake.headers.cookie);
      token = cookies.accessToken || null;
    }

    if (!token) {
      return next(new Error('SOCKET_AUTH_MISSING: No authentication token provided.'));
    }

    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    socket.user = {
      id:    payload.id,
      role:  payload.role,
      name:  payload.name,
      email: payload.email,
    };

    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return next(new Error('SOCKET_AUTH_EXPIRED: Access token has expired.'));
    }
    return next(new Error('SOCKET_AUTH_INVALID: Authentication failed.'));
  }
};

// ─── Role Guard Factory ───────────────────────────────────────────────────────
const requireRole = (...roles) => (socket, next) => {
  if (!socket.user || !roles.includes(socket.user.role)) {
    return next(new Error('SOCKET_FORBIDDEN: Insufficient permissions for this namespace.'));
  }
  return next();
};

// ─── Booth Namespace Handler ──────────────────────────────────────────────────
const initBoothNamespace = (io) => {
  const nsp = io.of(NAMESPACE_BOOTH);

  nsp.use(socketAuthMiddleware);

  nsp.on('connection', (socket) => {
    const { id: userId, role } = socket.user;
    addPresence(userId, socket.id);

    // Join expo-specific room for scoped broadcasts
    socket.on('booth:join_expo', ({ expoId }) => {
      if (!expoId || typeof expoId !== 'string') return;
      socket.join(`expo:${expoId}`);
      socket.emit('booth:joined', { expoId });
    });

    socket.on('booth:leave_expo', ({ expoId }) => {
      if (!expoId || typeof expoId !== 'string') return;
      socket.leave(`expo:${expoId}`);
    });

    // Admins can push authoritative booth-state updates to all expo viewers
    // Shape: { expoId, boothId, boothNumber, status, assignedTo }
    socket.on('booth:state_update', (payload) => {
      if (role !== 'admin') {
        socket.emit('error', { message: 'Only admins can broadcast booth state updates.' });
        return;
      }

      const { expoId, boothId, boothNumber, status, assignedTo } = payload || {};

      if (!expoId || !boothId || !status) {
        socket.emit('error', { message: 'Invalid booth_state_update payload.' });
        return;
      }

      const allowedStatuses = ['available', 'pending', 'assigned'];
      if (!allowedStatuses.includes(status)) {
        socket.emit('error', { message: `Invalid status value: ${status}` });
        return;
      }

      // Broadcast to all clients watching this expo (including sender)
      nsp.to(`expo:${expoId}`).emit('booth:state_changed', {
        boothId,
        boothNumber,
        status,
        assignedTo: assignedTo || null,
        updatedAt:  new Date().toISOString(),
        updatedBy:  userId,
      });
    });

    // Exhibitor requests temporary optimistic lock on a booth tile
    socket.on('booth:lock_request', ({ expoId, boothId }) => {
      if (!expoId || !boothId) return;
      socket.to(`expo:${expoId}`).emit('booth:locked_preview', {
        boothId,
        lockedBy: userId,
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
      });
    });

    socket.on('disconnect', () => {
      removePresence(userId, socket.id);
    });
  });

  return nsp;
};

// ─── Chat Namespace Handler ───────────────────────────────────────────────────
const initChatNamespace = (io) => {
  const nsp = io.of(NAMESPACE_CHAT);

  nsp.use(socketAuthMiddleware);

  nsp.on('connection', (socket) => {
    const { id: userId } = socket.user;
    addPresence(userId, socket.id);

    // Each user joins their own private room for direct message delivery
    socket.join(`user:${userId}`);

    // Join an expo-scoped broadcast room for system announcements
    socket.on('chat:join_expo', ({ expoId }) => {
      if (!expoId || typeof expoId !== 'string') return;
      socket.join(`chat_expo:${expoId}`);
    });

    // Private direct message relay
    // Shape: { receiverId, content, tempId }
    socket.on('chat:send_message', (payload) => {
      const { receiverId, content, tempId } = payload || {};

      if (!receiverId || !content || typeof content !== 'string') {
        socket.emit('error', { message: 'Invalid message payload.' });
        return;
      }

      const sanitizedContent = content.trim().slice(0, 2000);
      if (!sanitizedContent) return;

      const messageEnvelope = {
        tempId:     tempId || null,
        senderId:   userId,
        senderName: socket.user.name,
        receiverId,
        content:    sanitizedContent,
        createdAt:  new Date().toISOString(),
        isRead:     false,
      };

      // Deliver to recipient's room (all their active tabs/devices)
      nsp.to(`user:${receiverId}`).emit('chat:new_message', messageEnvelope);

      // Confirm delivery to sender (ack with tempId for optimistic UI reconciliation)
      socket.emit('chat:message_sent', { tempId, createdAt: messageEnvelope.createdAt });
    });

    // Mark messages as read
    socket.on('chat:mark_read', ({ senderId }) => {
      if (!senderId) return;
      // Notify the original sender their messages were read
      nsp.to(`user:${senderId}`).emit('chat:messages_read', {
        by:        userId,
        timestamp: new Date().toISOString(),
      });
    });

    // Typing indicator relay
    socket.on('chat:typing_start', ({ receiverId }) => {
      if (!receiverId) return;
      nsp.to(`user:${receiverId}`).emit('chat:peer_typing', {
        userId,
        name: socket.user.name,
      });
    });

    socket.on('chat:typing_stop', ({ receiverId }) => {
      if (!receiverId) return;
      nsp.to(`user:${receiverId}`).emit('chat:peer_stopped_typing', { userId });
    });

    socket.on('disconnect', () => {
      removePresence(userId, socket.id);
    });
  });

  return nsp;
};

// ─── Notification Namespace Handler ───────────────────────────────────────────
const initNotificationNamespace = (io) => {
  const nsp = io.of(NAMESPACE_NOTIFY);

  nsp.use(socketAuthMiddleware);

  nsp.on('connection', (socket) => {
    const { id: userId, role } = socket.user;
    addPresence(userId, socket.id);

    // Personal notification room
    socket.join(`notify:${userId}`);

    // Role-based broadcast rooms (admins can address entire role tiers)
    socket.join(`role:${role}`);

    socket.on('disconnect', () => {
      removePresence(userId, socket.id);
    });
  });

  // Expose helper so controllers can push notifications without importing io directly
  nsp.pushToUser = (userId, event, payload) => {
    nsp.to(`notify:${userId}`).emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  };

  nsp.pushToRole = (role, event, payload) => {
    nsp.to(`role:${role}`).emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  };

  nsp.pushBroadcast = (event, payload) => {
    nsp.emit(event, {
      ...payload,
      timestamp: new Date().toISOString(),
    });
  };

  return nsp;
};

// ─── Root Namespace Connection Tracker ────────────────────────────────────────
const initRootNamespace = (io) => {
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const { id: userId } = socket.user;
    addPresence(userId, socket.id);

    socket.on('disconnect', () => {
      removePresence(userId, socket.id);
    });
  });
};

// ─── Main Initializer (called by server.js) ───────────────────────────────────
const initSocketHandlers = (io) => {
  initRootNamespace(io);

  const boothNsp  = initBoothNamespace(io);
  const chatNsp   = initChatNamespace(io);
  const notifyNsp = initNotificationNamespace(io);

  // Attach namespaces to io for access via app.get('io')
  io.boothNsp  = boothNsp;
  io.chatNsp   = chatNsp;
  io.notifyNsp = notifyNsp;

  // Presence utility exposed to the rest of the application
  io.isUserOnline = isOnline;

  console.log('[SOCKET] Namespaces initialized → /booths  /chat  /notifications');
};

module.exports = initSocketHandlers;