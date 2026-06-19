import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { io }          from 'socket.io-client';
import toast           from 'react-hot-toast';
import { useAuth }     from '@/context/AuthContext';
import { getAccessToken } from '@/context/AuthContext';

// ─── Context ──────────────────────────────────────────────────────────────────
const SocketContext = createContext(null);

// ─── Namespace URLs ───────────────────────────────────────────────────────────
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';

const NSP = {
  booths:        `${SOCKET_URL}/booths`,
  chat:          `${SOCKET_URL}/chat`,
  notifications: `${SOCKET_URL}/notifications`,
};

// ─── Socket factory ───────────────────────────────────────────────────────────
const createSocket = (namespace) =>
  io(namespace, {
    autoConnect:        false,
    withCredentials:    true,
    transports:         ['websocket', 'polling'],
    reconnection:       true,
    reconnectionAttempts: 5,
    reconnectionDelay:  1500,
    reconnectionDelayMax: 8000,
    auth: (cb) => cb({ token: `Bearer ${getAccessToken()}` }),
  });

// ─── Provider ─────────────────────────────────────────────────────────────────
export function SocketProvider({ children }) {
  const { isAuth, user } = useAuth();

  // Namespace socket refs — stable across renders
  const boothSocketRef  = useRef(null);
  const chatSocketRef   = useRef(null);
  const notifySocketRef = useRef(null);

  // Connection status per namespace
  const [connected, setConnected] = useState({
    booths:        false,
    chat:          false,
    notifications: false,
  });

  // ── Connect all namespaces ──────────────────────────────────────────────────
  const connectAll = useCallback(() => {
    // Create socket instances on first connect
    if (!boothSocketRef.current) {
      boothSocketRef.current  = createSocket(NSP.booths);
    }
    if (!chatSocketRef.current) {
      chatSocketRef.current   = createSocket(NSP.chat);
    }
    if (!notifySocketRef.current) {
      notifySocketRef.current = createSocket(NSP.notifications);
    }

    const attachNamespace = (socketRef, key) => {
      const socket = socketRef.current;
      if (!socket || socket.connected) return;

      socket.on('connect', () =>
        setConnected((prev) => ({ ...prev, [key]: true }))
      );

      socket.on('disconnect', (reason) => {
        setConnected((prev) => ({ ...prev, [key]: false }));
        // If server closed the connection intentionally, don't reconnect
        if (reason === 'io server disconnect') socket.connect();
      });

      socket.on('connect_error', (err) => {
        // Token expired mid-session — auth interceptor will handle refresh
        if (err.message?.includes('SOCKET_AUTH_EXPIRED')) {
          // Re-auth happens in the next reconnect attempt via auth callback
          return;
        }
        console.warn(`[Socket:${key}] connection error:`, err.message);
      });

      socket.on('error', (err) => {
        console.warn(`[Socket:${key}] server error:`, err?.message);
      });

      socket.connect();
    };

    attachNamespace(boothSocketRef,  'booths');
    attachNamespace(chatSocketRef,   'chat');
    attachNamespace(notifySocketRef, 'notifications');
  }, []);

  // ── Disconnect all namespaces ───────────────────────────────────────────────
  const disconnectAll = useCallback(() => {
    [boothSocketRef, chatSocketRef, notifySocketRef].forEach((ref) => {
      if (ref.current) {
        ref.current.removeAllListeners();
        ref.current.disconnect();
        ref.current = null;
      }
    });

    setConnected({ booths: false, chat: false, notifications: false });
  }, []);

  // ── Connect on auth, disconnect on logout ───────────────────────────────────
  useEffect(() => {
    if (isAuth) {
      connectAll();
    } else {
      disconnectAll();
    }

    return () => {
      // On unmount only — don't disconnect on every render
    };
  }, [isAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notification toast handler ──────────────────────────────────────────────
  // Global handler — page-level handlers can override with more specific UI
  useEffect(() => {
    const socket = notifySocketRef.current;
    if (!socket || !isAuth) return;

    const handlers = {
      'notification:new_message': (payload) => {
        toast(`💬 New message: ${payload.preview}`, {
          duration: 5000,
          icon:     '✉️',
        });
      },
      'notification:booth_approved': (payload) => {
        toast.success(`Booth ${payload.boothNumber} approved!`);
      },
      'notification:booth_rejected': () => {
        toast.error('Your booth reservation was not approved.');
      },
      'notification:application_approved': () => {
        toast.success('Your exhibitor application has been approved!');
      },
      'notification:application_rejected': () => {
        toast.error('Your exhibitor application was not approved. Please check your profile.');
      },
      'notification:session_live': (payload) => {
        toast(`🎙 "${payload.title}" is now live in ${payload.location}!`, {
          duration: 6000,
        });
      },
      'notification:session_cancelled': (payload) => {
        toast.error(`Session "${payload.title}" has been cancelled.`);
      },
      'notification:account_suspended': () => {
        toast.error('Your account has been suspended. Contact the organiser for assistance.', {
          duration: 8000,
        });
      },
    };

    Object.entries(handlers).forEach(([event, handler]) =>
      socket.on(event, handler)
    );

    return () => {
      Object.keys(handlers).forEach((event) => socket.off(event));
    };
  }, [isAuth]);

  // ─── Booth namespace helpers ───────────────────────────────────────────────
  const joinExpoFloorPlan = useCallback((expoId) => {
    boothSocketRef.current?.emit('booth:join_expo', { expoId });
  }, []);

  const leaveExpoFloorPlan = useCallback((expoId) => {
    boothSocketRef.current?.emit('booth:leave_expo', { expoId });
  }, []);

  const lockBoothOptimistic = useCallback((expoId, boothId) => {
    boothSocketRef.current?.emit('booth:lock_request', { expoId, boothId });
  }, []);

  const emitBoothStateUpdate = useCallback((payload) => {
    boothSocketRef.current?.emit('booth:state_update', payload);
  }, []);

  // ─── Chat namespace helpers ────────────────────────────────────────────────
  const joinExpoChat = useCallback((expoId) => {
    chatSocketRef.current?.emit('chat:join_expo', { expoId });
  }, []);

  const sendSocketMessage = useCallback((receiverId, content, tempId) => {
    chatSocketRef.current?.emit('chat:send_message', { receiverId, content, tempId });
  }, []);

  const sendTypingStart = useCallback((receiverId) => {
    chatSocketRef.current?.emit('chat:typing_start', { receiverId });
  }, []);

  const sendTypingStop = useCallback((receiverId) => {
    chatSocketRef.current?.emit('chat:typing_stop', { receiverId });
  }, []);

  const markMessagesRead = useCallback((senderId) => {
    chatSocketRef.current?.emit('chat:mark_read', { senderId });
  }, []);

  // ─── Event subscription helpers ────────────────────────────────────────────
  // Pages subscribe to specific events and clean up on unmount via useEffect.
  // Returns an unsubscribe function for use in cleanup.

  const onBoothEvent = useCallback((event, handler) => {
    boothSocketRef.current?.on(event, handler);
    return () => boothSocketRef.current?.off(event, handler);
  }, []);

  const onChatEvent = useCallback((event, handler) => {
    chatSocketRef.current?.on(event, handler);
    return () => chatSocketRef.current?.off(event, handler);
  }, []);

  const onNotifyEvent = useCallback((event, handler) => {
    notifySocketRef.current?.on(event, handler);
    return () => notifySocketRef.current?.off(event, handler);
  }, []);

  // ─── Context value ─────────────────────────────────────────────────────────
  const value = useMemo(() => ({
    // Connection status
    connected,
    isBoothConnected:  connected.booths,
    isChatConnected:   connected.chat,
    isNotifyConnected: connected.notifications,

    // Raw socket refs (escape hatch for complex page-level handling)
    boothSocket:  boothSocketRef,
    chatSocket:   chatSocketRef,
    notifySocket: notifySocketRef,

    // Booth helpers
    joinExpoFloorPlan,
    leaveExpoFloorPlan,
    lockBoothOptimistic,
    emitBoothStateUpdate,

    // Chat helpers
    joinExpoChat,
    sendSocketMessage,
    sendTypingStart,
    sendTypingStop,
    markMessagesRead,

    // Subscription helpers
    onBoothEvent,
    onChatEvent,
    onNotifyEvent,
  }), [
    connected,
    joinExpoFloorPlan,
    leaveExpoFloorPlan,
    lockBoothOptimistic,
    emitBoothStateUpdate,
    joinExpoChat,
    sendSocketMessage,
    sendTypingStart,
    sendTypingStop,
    markMessagesRead,
    onBoothEvent,
    onChatEvent,
    onNotifyEvent,
  ]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useSocket() {
  const context = useContext(SocketContext);

  if (!context) {
    throw new Error('useSocket must be used within a <SocketProvider>.');
  }

  return context;
}

export default SocketContext;