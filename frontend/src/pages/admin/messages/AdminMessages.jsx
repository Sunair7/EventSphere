import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient }             from '@tanstack/react-query';
import { motion, AnimatePresence }                           from 'framer-motion';
import {
  Search, Send, MessageSquare, X, Check,
  CheckCheck, Loader2, User, ArrowLeft,
  MoreVertical, Trash2, AlertCircle,
} from 'lucide-react';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import toast                                       from 'react-hot-toast';
import api                                         from '@/utils/api';
import { useAuth }                                 from '@/context/AuthContext';
import { useSocket }                               from '@/context/SocketContext';
import { messageKeys }                             from '@/hooks/useMessages';
import { cn }                                      from '@/utils/cn';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatMessageTime = (dateStr) => {
  const d = new Date(dateStr);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
};

const formatThreadTime = (dateStr) => {
  const d = new Date(dateStr);
  if (isToday(d))     return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
};

const getParticipant = (thread, currentUserId) => {
  if (!thread) return null;
  const isSender = thread.senderId?._id === currentUserId || thread.senderId === currentUserId;
  return isSender ? thread.receiver : thread.sender;
};

// ─── Skeletons ────────────────────────────────────────────────────────────────
function ThreadSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="skeleton h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="skeleton h-4 w-28 rounded" />
        <div className="skeleton h-3 w-40 rounded" />
      </div>
      <div className="skeleton h-3 w-10 rounded" />
    </div>
  );
}

function MessageBubbleSkeleton({ mine }) {
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div className={cn('skeleton h-10 rounded-md', mine ? 'w-48' : 'w-56')} />
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = 'md' }) {
  const sz = size === 'sm' ? 'h-8 w-8 text-label-sm' : 'h-10 w-10 text-body-sm';
  return (
    <div className={cn(
      'flex shrink-0 items-center justify-center rounded-full bg-primary-container font-mono font-semibold text-on-primary-container',
      sz
    )}>
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className={cn('rounded-full object-cover', size === 'sm' ? 'h-8 w-8' : 'h-10 w-10')}
        />
      ) : (
        (user?.name || '?').charAt(0).toUpperCase()
      )}
    </div>
  );
}

// ─── Thread list item ─────────────────────────────────────────────────────────
function ThreadItem({ thread, currentUserId, isActive, onClick }) {
  const participant = getParticipant(thread, currentUserId);
  const isUnread    = thread.unreadCount > 0;
  const preview     = thread.content || (thread.type === 'file' ? '📎 Attachment' : '');

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150',
        isActive
          ? 'bg-surface-container-low border-r-2 border-secondary'
          : 'hover:bg-surface-container-low border-r-2 border-transparent'
      )}
    >
      <div className="relative shrink-0">
        <Avatar user={participant} />
        {isUnread && (
          <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5 rounded-full bg-error ring-2 ring-surface-bright" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn(
            'text-body-sm truncate',
            isUnread ? 'font-semibold text-on-surface' : 'font-medium text-on-surface'
          )}>
            {participant?.name || 'Unknown'}
          </span>
          <span className="font-mono text-label-sm text-on-surface-variant shrink-0">
            {thread.createdAt ? formatThreadTime(thread.createdAt) : ''}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className={cn(
            'text-body-sm truncate',
            isUnread ? 'text-on-surface' : 'text-on-surface-variant'
          )}>
            {preview}
          </span>
          {isUnread && (
            <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center
                             rounded-full bg-error px-1.5 font-mono text-label-sm text-on-error">
              {thread.unreadCount > 9 ? '9+' : thread.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ message, isMine, showAvatar, participant, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn('flex items-end gap-2', isMine ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar (only for received messages) */}
      {!isMine && (
        <div className="shrink-0 mb-1">
          {showAvatar
            ? <Avatar user={participant} size="sm" />
            : <div className="h-8 w-8" />}
        </div>
      )}

      {/* Bubble */}
      <div className={cn('group relative max-w-[70%]', isMine ? 'items-end' : 'items-start', 'flex flex-col gap-0.5')}>
        <div className={cn(
          'rounded-md px-3 py-2 text-body-sm leading-relaxed',
          isMine
            ? 'rounded-br-sm bg-secondary text-on-secondary'
            : 'rounded-bl-sm bg-surface-container text-on-surface border border-outline-variant'
        )}>
          {message.content}
        </div>

        {/* Timestamp + read receipt */}
        <div className={cn(
          'flex items-center gap-1 font-mono text-label-sm text-on-surface-variant',
          isMine ? 'flex-row-reverse' : 'flex-row'
        )}>
          <span>{formatMessageTime(message.createdAt)}</span>
          {isMine && (
            message.isRead
              ? <CheckCheck size={12} className="text-secondary" />
              : <Check size={12} />
          )}
        </div>

        {/* Delete menu */}
        {isMine && (
          <div className={cn(
            'absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity',
            isMine ? 'right-full mr-1' : 'left-full ml-1'
          )}>
            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded p-1 text-on-surface-variant hover:bg-surface-container transition-colors"
              >
                <MoreVertical size={13} />
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1   }}
                      exit={{ opacity: 0, scale: 0.95   }}
                      transition={{ duration: 0.1 }}
                      className="absolute right-0 top-6 z-50 rounded-md border border-outline-variant
                                 bg-surface-bright shadow-level-2 min-w-[120px]"
                    >
                      <button
                        onClick={() => { setMenuOpen(false); onDelete(message._id); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                                   text-error hover:bg-error-container transition-colors"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Conversation view ────────────────────────────────────────────────────────
function ConversationView({ participantId, onBack }) {
  const { user }                            = useAuth();
  const queryClient                         = useQueryClient();
  const { onChatEvent, sendSocketMessage,
          sendTypingStart, sendTypingStop,
          markMessagesRead }                = useSocket();

  const [input,      setInput]      = useState('');
  const [isTyping,   setIsTyping]   = useState(false);   // peer is typing
  const [localMessages, setLocalMessages] = useState([]); // optimistic messages
  const typingTimerRef  = useRef(null);
  const bottomRef       = useRef(null);
  const inputRef        = useRef(null);

  // Fetch conversation history
  const { data, isLoading } = useQuery({
    queryKey: messageKeys.conversation(participantId),
    queryFn:  async () => {
      const { data } = await api.get(`/messages/conversation/${participantId}`);
      return data.data;
    },
    enabled: !!participantId,
    staleTime: 10 * 1000,
  });

  const participant  = data?.participant;
  const serverMessages = useMemo(() =>
    (data?.messages || []).slice().reverse(),
    [data?.messages]
  );

  // Merge server + local optimistic messages
  const allMessages = useMemo(() => {
    const serverIds = new Set(serverMessages.map((m) => m._id));
    const localOnly = localMessages.filter((m) => !serverIds.has(m._id));
    return [...serverMessages, ...localOnly];
  }, [serverMessages, localMessages]);

  // Socket.io event subscriptions
  useEffect(() => {
    if (!participantId) return;

    const unsubMsg = onChatEvent('chat:new_message', (msg) => {
      if (
        msg.senderId?._id === participantId ||
        msg.senderId === participantId
      ) {
        queryClient.invalidateQueries({ queryKey: messageKeys.conversation(participantId) });
        queryClient.invalidateQueries({ queryKey: messageKeys.inbox() });
        queryClient.invalidateQueries({ queryKey: messageKeys.unreadCount() });
        markMessagesRead(participantId);
      }
    });

    const unsubTypingStart = onChatEvent('chat:peer_typing', ({ userId }) => {
      if (userId === participantId) setIsTyping(true);
    });

    const unsubTypingStop = onChatEvent('chat:peer_stopped_typing', ({ userId }) => {
      if (userId === participantId) setIsTyping(false);
    });

    const unsubRead = onChatEvent('chat:messages_read', ({ by }) => {
      if (by === participantId) {
        queryClient.invalidateQueries({ queryKey: messageKeys.conversation(participantId) });
      }
    });

    markMessagesRead(participantId);

    return () => {
      unsubMsg();
      unsubTypingStart();
      unsubTypingStop();
      unsubRead();
    };
  }, [participantId, onChatEvent, queryClient, markMessagesRead]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allMessages.length, isTyping]);

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: async (content) => {
      const { data } = await api.post('/messages', {
        receiverId: participantId,
        content,
        type: 'text',
      });
      return data.data.message;
    },
    onSuccess: (msg) => {
      setLocalMessages((prev) => prev.filter((m) => !m._optimistic));
      queryClient.invalidateQueries({ queryKey: messageKeys.conversation(participantId) });
      queryClient.invalidateQueries({ queryKey: messageKeys.inbox() });
    },
    onError: (err) => {
      setLocalMessages((prev) => prev.filter((m) => !m._optimistic));
      toast.error(err.message || 'Failed to send message.');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (messageId) => api.delete(`/messages/${messageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messageKeys.conversation(participantId) });
      toast.success('Message deleted.');
    },
    onError: (err) => toast.error(err.message || 'Failed to delete message.'),
  });

  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content || sendMutation.isPending) return;

    setInput('');
    sendTypingStop(participantId);

    // Optimistic message
    const optimistic = {
      _id:        `opt-${Date.now()}`,
      _optimistic: true,
      senderId:   user._id,
      receiverId: participantId,
      content,
      isRead:     false,
      createdAt:  new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimistic]);

    sendMutation.mutate(content);
    sendSocketMessage(participantId, content, optimistic._id);
  }, [input, sendMutation, participantId, sendTypingStop, sendSocketMessage, user._id]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);

    // Typing indicator debounce
    sendTypingStart(participantId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => sendTypingStop(participantId), 2000);
  };

  if (!participantId) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-outline-variant
                      bg-surface-bright px-4">
        <button
          onClick={onBack}
          className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                     hover:text-on-surface transition-colors lg:hidden"
          aria-label="Back to inbox"
        >
          <ArrowLeft size={18} />
        </button>

        {isLoading ? (
          <div className="flex items-center gap-3">
            <div className="skeleton h-10 w-10 rounded-full" />
            <div className="skeleton h-4 w-32 rounded" />
          </div>
        ) : (
          <>
            <Avatar user={participant} />
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-semibold text-on-surface truncate">
                {participant?.name}
              </p>
              <p className="font-mono text-label-sm text-on-surface-variant capitalize">
                {participant?.role}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <MessageBubbleSkeleton key={i} mine={i % 3 === 0} />
            ))}
          </div>
        ) : allMessages.length === 0 ? (
          <div className="empty-state flex-1">
            <div className="empty-state-icon">
              <MessageSquare size={24} />
            </div>
            <h3 className="empty-state-title">Start the conversation</h3>
            <p className="empty-state-body">
              Send a message to {participant?.name || 'this user'}.
            </p>
          </div>
        ) : (
          allMessages.map((msg, i) => {
            const isMine     = msg.senderId?._id === user._id || msg.senderId === user._id;
            const prevMsg    = allMessages[i - 1];
            const prevIsMine = prevMsg
              ? (prevMsg.senderId?._id === user._id || prevMsg.senderId === user._id)
              : null;
            const showAvatar = !isMine && prevIsMine !== false;

            return (
              <MessageBubble
                key={msg._id}
                message={msg}
                isMine={isMine}
                showAvatar={showAvatar}
                participant={participant}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            );
          })
        )}

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4   }}
              className="flex items-end gap-2"
            >
              <Avatar user={participant} size="sm" />
              <div className="flex items-center gap-1 rounded-md border border-outline-variant
                              bg-surface-container px-3 py-2.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-on-surface-variant"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-outline-variant bg-surface-bright p-4">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${participant?.name || ''}…`}
            rows={1}
            className="input flex-1 resize-none overflow-hidden py-2.5 leading-relaxed"
            style={{ minHeight: '42px', maxHeight: '120px' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMutation.isPending}
            className="btn-secondary h-[42px] w-[42px] shrink-0 p-0 flex items-center
                       justify-center disabled:opacity-50"
            aria-label="Send message"
          >
            {sendMutation.isPending
              ? <Loader2 size={16} className="animate-spin-slow" />
              : <Send size={16} />
            }
          </button>
        </div>
        <p className="mt-1.5 font-mono text-label-sm text-on-surface-variant">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminMessages() {
  const { user }                = useAuth();
  const [search, setSearch]     = useState('');
  const [activeId, setActiveId] = useState(null);
  const [mobileView, setMobileView] = useState('inbox'); // 'inbox' | 'conversation'

  const { data: inbox = [], isLoading, isError, refetch } = useQuery({
    queryKey:       messageKeys.inbox(),
    queryFn:        async () => {
      const { data } = await api.get('/messages/inbox');
      return data.data.threads;
    },
    staleTime:      30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const filtered = useMemo(() =>
    inbox.filter((t) => {
      const participant = getParticipant(t, user._id);
      return (participant?.name || '').toLowerCase().includes(search.toLowerCase());
    }),
    [inbox, search, user._id]
  );

  const handleSelectThread = (thread) => {
    const participant = getParticipant(thread, user._id);
    if (!participant) return;
    setActiveId(participant._id);
    setMobileView('conversation');
  };

  return (
    <div className="-mx-container-pad -my-section-gap flex h-[calc(100dvh-4rem)] overflow-hidden
                    border-t border-outline-variant">

      {/* ── Thread list (inbox) ──────────────────────────────────── */}
      <div className={cn(
        'flex flex-col border-r border-outline-variant bg-surface-bright',
        'w-full lg:w-80 xl:w-96 lg:flex shrink-0',
        mobileView === 'conversation' ? 'hidden lg:flex' : 'flex'
      )}>
        {/* Inbox header */}
        <div className="flex h-16 items-center justify-between border-b border-outline-variant px-4">
          <h2 className="text-headline-sm font-semibold text-on-surface">Messages</h2>
          <span className="font-mono text-label-sm text-on-surface-variant">
            {inbox.filter((t) => t.unreadCount > 0).length} unread
          </span>
        </div>

        {/* Search */}
        <div className="border-b border-outline-variant px-4 py-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="search"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 py-2 text-body-sm"
            />
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <ThreadSkeleton key={i} />)
          ) : isError ? (
            <div className="p-4 text-center">
              <AlertCircle size={20} className="mx-auto mb-2 text-error" />
              <p className="text-body-sm text-on-surface-variant">Failed to load messages.</p>
              <button onClick={() => refetch()} className="btn-ghost btn-sm mt-2">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon mx-auto mb-3">
                <MessageSquare size={22} />
              </div>
              <p className="empty-state-title text-body-sm">
                {search ? 'No conversations found' : 'No messages yet'}
              </p>
            </div>
          ) : (
            filtered.map((thread) => {
              const participant = getParticipant(thread, user._id);
              return (
                <ThreadItem
                  key={thread.conversationId}
                  thread={thread}
                  currentUserId={user._id}
                  isActive={activeId === participant?._id}
                  onClick={() => handleSelectThread(thread)}
                />
              );
            })
          )}
        </div>
      </div>

      {/* ── Conversation panel ───────────────────────────────────── */}
      <div className={cn(
        'flex flex-1 flex-col overflow-hidden',
        mobileView === 'inbox' && !activeId ? 'hidden lg:flex' : 'flex'
      )}>
        {activeId ? (
          <ConversationView
            participantId={activeId}
            onBack={() => { setActiveId(null); setMobileView('inbox'); }}
          />
        ) : (
          <div className="empty-state flex-1">
            <div className="empty-state-icon">
              <MessageSquare size={28} />
            </div>
            <h3 className="empty-state-title">Select a conversation</h3>
            <p className="empty-state-body">
              Choose a thread from the inbox to start messaging.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}