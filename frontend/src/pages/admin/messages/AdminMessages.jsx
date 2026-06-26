import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import axios from "axios";
import {
  Search,
  Send,
  MessageSquare,
  ExternalLink,
  Download,
  Paperclip,
  Image,
  FileText,
  X,
  Check,
  CheckCheck,
  Loader2,
  User,
  ArrowLeft,
  Trash2,
  AlertCircle,
  PenSquare,
  ChevronRight,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/context/SocketContext";
import { cn } from "@/utils/cn";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatMessageTime = (dateStr) => {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "MMM d, HH:mm");
};

const formatThreadTime = (dateStr) => {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMM d");
};

const getParticipant = (thread, currentUserId) => {
  if (!thread) return null;
  if (thread.participant?._id) return thread.participant;

  const isSender =
    thread.sender?._id === currentUserId ||
    thread.senderId?.toString() === currentUserId ||
    thread.senderId?._id === currentUserId;
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
    <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
      <div className={cn("skeleton h-10 rounded-md", mine ? "w-48" : "w-56")} />
    </div>
  );
}

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Avatar({ user, size = "md" }) {
  const sz = size === "sm" ? "h-8 w-8 text-label-sm" : "h-10 w-10 text-body-sm";
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary-container font-mono font-semibold text-on-primary-container",
        sz,
      )}
    >
      {user?.avatar ? (
        <img
          src={user.avatar}
          alt={user.name}
          className={cn(
            "rounded-full object-cover",
            size === "sm" ? "h-8 w-8" : "h-10 w-10",
          )}
        />
      ) : (
        (user?.name || "?").charAt(0).toUpperCase()
      )}
    </div>
  );
}

// ─── Thread list item ─────────────────────────────────────────────────────────
function ThreadItem({ thread, currentUserId, isActive, onClick }) {
  const participant = getParticipant(thread, currentUserId);
  const isUnread = thread.unreadCount > 0;
  const preview =
    thread.content || (thread.type === "file" ? "📎 Attachment" : "");

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-150",
        isActive
          ? "bg-surface-container-low border-r-2 border-secondary"
          : "hover:bg-surface-container-low border-r-2 border-transparent",
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
          <span
            className={cn(
              "text-body-sm truncate",
              isUnread
                ? "font-semibold text-on-surface"
                : "font-medium text-on-surface",
            )}
          >
            {participant?.name || "Unknown"}
          </span>
          <span className="font-mono text-label-sm text-on-surface-variant shrink-0">
            {thread.createdAt ? formatThreadTime(thread.createdAt) : ""}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span
            className={cn(
              "text-body-sm truncate",
              isUnread ? "text-on-surface" : "text-on-surface-variant",
            )}
          >
            {preview}
          </span>
          {isUnread && (
            <span
              className="flex h-5 min-w-[20px] shrink-0 items-center justify-center
                             rounded-full bg-error px-1.5 font-mono text-label-sm text-on-error"
            >
              {thread.unreadCount > 9 ? "9+" : thread.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── New Conversation Panel ─────────────────────────────────────────────────
function NewConversationPanel({ currentUserId, onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["users", "chat-search", debounced],
    queryFn: async () => {
      const { data } = await api.get("/users/chat-search", {
        params: { search: debounced, limit: 12 },
      });
      return (data.data?.users || []).filter((u) => u._id !== currentUserId);
    },
    enabled: debounced.length >= 1,
    staleTime: 30 * 1000,
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-16 items-center justify-between border-b border-outline-variant px-4 shrink-0">
        <h2 className="text-headline-sm font-semibold text-on-surface">
          New Message
        </h2>
        <button
          onClick={onClose}
          className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                     hover:text-on-surface transition-colors"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="border-b border-outline-variant px-4 py-3 shrink-0">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
          />
          <input
            type="search"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-8 py-2 text-body-sm"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {debounced.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 py-16
                          text-on-surface-variant"
          >
            <User size={28} strokeWidth={1.5} />
            <p className="text-body-sm">
              Type a name to find someone to message.
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col gap-1 p-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="skeleton h-9 w-9 rounded-full shrink-0" />
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="skeleton h-3.5 w-28 rounded" />
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 py-16
                          text-on-surface-variant"
          >
            <User size={24} strokeWidth={1.5} />
            <p className="text-body-sm">No users found for "{debounced}".</p>
          </div>
        ) : (
          <ul className="p-2">
            {results.map((u) => (
              <li key={u._id}>
                <button
                  onClick={() => onSelect(u)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5
                             text-left transition-colors hover:bg-surface-container-low"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center
                                  rounded-full bg-primary-container font-mono text-sm
                                  font-semibold text-on-primary-container overflow-hidden"
                  >
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt={u.name}
                        className="h-9 w-9 object-cover"
                      />
                    ) : (
                      (u.name || "?").charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-on-surface truncate">
                      {u.name}
                    </p>
                    <p className="font-mono text-label-sm text-on-surface-variant capitalize truncate">
                      {u.role}
                      {u.email ? ` · ${u.email}` : ""}
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    className="shrink-0 text-on-surface-variant"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Delete Modal ────────────────────────────────────────────────────────────
function DeleteMessageModal({ open, onClose, onConfirm, isMine, loading }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-bright shadow-xl"
            >
              <div className="border-b border-outline-variant p-4">
                <h3 className="text-title-medium font-semibold text-on-surface">
                  Delete Message
                </h3>
              </div>
              <div className="p-4">
                <p className="text-body-sm text-on-surface">
                  {isMine
                    ? "Are you sure you want to delete this message? This action cannot be undone."
                    : "Delete this message from your view? The sender will still keep their copy."}
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t border-outline-variant p-4">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className="rounded-lg bg-error px-4 py-2 text-on-error transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ message, isMine, showAvatar, participant, onDelete }) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await fetch(message.attachment.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = message.attachment.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch {
      window.open(message.attachment.url, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = () => {
    onDelete(message._id, isMine);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex items-end gap-2",
        isMine ? "flex-row-reverse" : "flex-row",
      )}
    >
      {!isMine && (
        <div className="shrink-0 mb-1">
          {showAvatar ? (
            <Avatar user={participant} size="sm" />
          ) : (
            <div className="h-8 w-8" />
          )}
        </div>
      )}

      <div
        className={cn(
          "group relative max-w-[70%]",
          isMine ? "items-end" : "items-start",
          "flex flex-col gap-0.5",
        )}
      >
        <div
          className={cn(
            "rounded-md px-3 py-2 text-body-sm leading-relaxed",
            isMine
              ? "rounded-br-sm bg-secondary text-on-secondary"
              : "rounded-bl-sm bg-surface-container text-on-surface border border-outline-variant",
          )}
        >
          {message.content}
          {message.attachment && (
            <div
              className={cn(
                "mt-2 flex items-center gap-2 rounded px-2 py-1.5 text-label-sm",
                isMine
                  ? "bg-on-secondary/10 text-on-secondary"
                  : "bg-surface-container-high text-on-surface",
              )}
            >
              {message.attachment.mimeType?.startsWith("image/") ? (
                <Image size={14} className="shrink-0" />
              ) : (
                <FileText size={14} className="shrink-0" />
              )}
              <span className="truncate max-w-[120px]">
                {message.attachment.fileName}
              </span>
              <div className="flex items-center gap-1 ml-auto">
                <a
                  href={message.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "rounded p-1 transition-colors",
                    isMine
                      ? "hover:bg-on-secondary/20 text-on-secondary/80"
                      : "hover:bg-surface-container-highest text-on-surface/60",
                  )}
                  title="Open file"
                >
                  <ExternalLink size={12} />
                </a>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className={cn(
                    "rounded p-1 transition-colors",
                    isMine
                      ? "hover:bg-on-secondary/20 text-on-secondary/80"
                      : "hover:bg-surface-container-highest text-on-surface/60",
                  )}
                  title="Download file"
                >
                  {downloading ? (
                    <Loader2 size={12} className="animate-spin-slow" />
                  ) : (
                    <Download size={12} />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex items-center gap-1 font-mono text-label-sm text-on-surface-variant",
            isMine ? "flex-row-reverse" : "flex-row",
          )}
        >
          <span>{formatMessageTime(message.createdAt)}</span>
          {isMine &&
            (message.isRead ? (
              <CheckCheck size={12} className="text-secondary" />
            ) : (
              <Check size={12} />
            ))}

          <div
            className={cn(
              "mb-1 opacity-0 group-hover:opacity-100 transition-opacity",
              isMine ? "self-end" : "self-start",
            )}
          >
            <button
              onClick={handleDelete}
              className="text-on-surface-variant hover:text-error transition-colors"
              aria-label="Delete message"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Conversation view ────────────────────────────────────────────────────────
function ConversationView({ participantId, onBack }) {
  const { user } = useAuth();
  const currentUserId = (user?._id ?? user?.id)?.toString();
  if (!currentUserId) return null;

  const queryClient = useQueryClient();
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const {
    onChatEvent,
    sendSocketMessage,
    sendTypingStart,
    sendTypingStop,
    markMessagesRead,
  } = useSocket();

  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [localMessages, setLocalMessages] = useState([]);
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    messageId: null,
    isMine: false,
  });
  const typingTimerRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // ── Conversation history ─────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['messages', 'conversation', participantId, user._id],
    queryFn: async () => {
      const { data } = await api.get(`/messages/conversation/${participantId}`);
      return data.data;
    },
    enabled: !!participantId, //&& !!user?._id, // ← add user._id guard
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
  });

  const participant = data?.participant;
  const serverMessages = useMemo(
    () => (data?.messages || []).slice().reverse(),
    [data?.messages],
  );

  const allMessages = useMemo(() => {
    const serverIds = new Set(serverMessages.map((m) => m._id));
    const localOnly = localMessages.filter((m) => !serverIds.has(m._id));
    return [...serverMessages, ...localOnly];
  }, [serverMessages, localMessages]);

  // ── Socket event subscriptions ──────────────────────────────────────
  useEffect(() => {
    if (!participantId) return;

    const unsubMsg = onChatEvent("chat:new_message", (msg) => {
      try {
        if (
          msg.senderId?._id === participantId ||
          msg.senderId === participantId
        ) {
          // Update conversation cache with user-specific key
          queryClient.setQueryData(
            ['messages', 'conversation', participantId, user._id],
            (old) => {
              if (!old) return old;
              const messageExists = old.messages.some((m) => m._id === msg._id);
              if (messageExists) return old;
              return {
                ...old,
                messages: [msg, ...old.messages],
              };
            },
          );

          // Invalidate inbox and unread with user-specific keys
          queryClient.invalidateQueries({
            queryKey: ['messages', 'inbox', user._id],
          });
          queryClient.invalidateQueries({
            queryKey: ['messages', 'unreadCount', user._id],
          });
          markMessagesRead(participantId);
        }
      } catch (error) {
        console.error("Error handling new message:", error);
        queryClient.invalidateQueries({
          queryKey: ['messages', 'conversation', participantId, user._id],
        });
      }
    });

    const unsubTypingStart = onChatEvent("chat:peer_typing", ({ userId }) => {
      try {
        if (userId === participantId) setIsTyping(true);
      } catch (error) {
        console.error("Error handling typing start:", error);
      }
    });

    const unsubTypingStop = onChatEvent(
      "chat:peer_stopped_typing",
      ({ userId }) => {
        try {
          if (userId === participantId) setIsTyping(false);
        } catch (error) {
          console.error("Error handling typing stop:", error);
        }
      },
    );

    const unsubRead = onChatEvent("chat:messages_read", ({ by }) => {
      try {
        if (by === participantId) {
          queryClient.invalidateQueries({
            queryKey: ['messages', 'conversation', participantId, user._id],
          });
        }
      } catch (error) {
        console.error("Error handling read receipt:", error);
      }
    });

    markMessagesRead(participantId);

    return () => {
      unsubMsg();
      unsubTypingStart();
      unsubTypingStop();
      unsubRead();
    };
  }, [participantId, onChatEvent, queryClient, markMessagesRead, user._id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length, isTyping]);

  // ── Send mutation ────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: async ({ content, attachment: att }) => {
      const payload = {
        receiverId: participantId,
        content,
        type: att ? "file" : "text",
      };
      if (att) {
        payload.attachment = {
          url: att.url,
          fileName: att.fileName,
          mimeType: att.mimeType,
          fileSizeBytes: att.fileSizeBytes,
        };
      }
      const { data } = await api.post("/messages", payload);
      return data.data.message;
    },
    onSuccess: async (msg, variables) => {
  await queryClient.refetchQueries({
    queryKey: ['messages', 'conversation', participantId, user._id],
    exact: true,
  });
  // Only remove optimistic AFTER the server data is in the cache
  setLocalMessages((prev) =>
    prev.filter((m) => m._id !== variables.optimisticId),
  );
  queryClient.invalidateQueries({ queryKey: ['messages', 'inbox', user._id] });
},
    onError: (err, variables) => {
      setLocalMessages((prev) =>
        prev.filter((m) => m._id !== variables.optimisticId),
      );
      toast.error(
        err.response?.data?.message || err.message || "Failed to send message.",
      );
    },
  });

  // ── Delete mutation ─────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (messageId) => api.delete(`/messages/${messageId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['messages', 'conversation', participantId, user._id],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'inbox', user._id],
      });
      toast.success("Message deleted.");
    },
    onError: (err) => {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to delete message.";
      toast.error(errorMessage);
      console.error("Delete error:", err);
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────
  const handleSend = useCallback(() => {
    const content = input.trim();
    if (!content && !attachment) return;
    if (sendMutation.isPending) return;

    setInput("");
    const currentAttachment = attachment;
    setAttachment(null);
    sendTypingStop(participantId);

    const optimisticId = `opt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const optimistic = {
      _id: optimisticId,
      _optimistic: true,
      senderId: user._id,
      receiverId: participantId,
      content: content || "📎 Attachment",
      attachment: currentAttachment,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, optimistic]);

    sendMutation.mutate({
      content,
      attachment: currentAttachment,
      optimisticId,
    });
    sendSocketMessage(participantId, content, optimisticId);
  }, [
    input,
    attachment,
    sendMutation,
    participantId,
    sendTypingStop,
    sendSocketMessage,
    user._id,
  ]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    sendTypingStart(participantId);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(
      () => sendTypingStop(participantId),
      2000,
    );
  };

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
        sendTypingStop(participantId);
      }
    };
  }, [participantId, sendTypingStop]);

  if (!participantId) return null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex h-16 shrink-0 items-center gap-3 border-b border-outline-variant
                      bg-surface-bright px-4"
      >
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
              Send a message to {participant?.name || "this user"}.
            </p>
          </div>
        ) : (
          allMessages.map((msg, i) => {
            const senderIdValue =
  msg.senderId?._id?.toString() ||
  msg.senderId?.toString?.() ||
  String(msg.senderId ?? "");
const isMine = senderIdValue === currentUserId;

            const prevMsg = allMessages[i - 1];
            const prevIsMine = prevMsg
              ? (prevMsg.senderId?._id?.toString() ||
                  prevMsg.senderId?.toString() ||
                  prevMsg.senderId) === user._id
              : null;

            const showAvatar = !isMine && prevIsMine !== false;

            return (
              <MessageBubble
                key={msg._id}
                message={msg}
                isMine={isMine}
                showAvatar={showAvatar}
                participant={participant}
                onDelete={(id, isMine) =>
                  setDeleteModal({
                    open: true,
                    messageId: id,
                    isMine,
                  })
                }
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
              exit={{ opacity: 0, y: 4 }}
              className="flex items-end gap-2"
            >
              <Avatar user={participant} size="sm" />
              <div
                className="flex items-center gap-1 rounded-md border border-outline-variant
                              bg-surface-container px-3 py-2.5"
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-on-surface-variant"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 0.9,
                      delay: i * 0.15,
                    }}
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
        {attachment && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface-container px-3 py-2">
            <FileText size={14} className="text-secondary shrink-0" />
            <span className="text-body-sm text-on-surface truncate flex-1">
              {attachment.fileName}
            </span>
            <button
              onClick={() => setAttachment(null)}
              className="rounded p-1 text-on-surface-variant hover:text-error transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-ghost h-[42px] w-[42px] shrink-0 p-0 flex items-center justify-center"
            aria-label="Attach file"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${participant?.name || ""}…`}
            rows={1}
            className="input flex-1 resize-none overflow-hidden py-2.5 leading-relaxed"
            style={{ minHeight: "42px", maxHeight: "120px" }}
            onInput={(e) => {
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
          />

          <button
            onClick={handleSend}
            disabled={(!input.trim() && !attachment) || sendMutation.isPending}
            className="btn-secondary h-[42px] w-[42px] shrink-0 p-0 flex items-center justify-center disabled:opacity-50"
            aria-label="Send message"
          >
            {sendMutation.isPending ? (
              <Loader2 size={16} className="animate-spin-slow" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
              toast.error("File must be under 10MB.");
              return;
            }

            const toastId = toast.loading(`Uploading ${file.name}...`);

            try {
              const formData = new FormData();
              formData.append("file", file);
              formData.append("upload_preset", "eventsphere_chat");
              formData.append("folder", "eventsphere/chat");

              const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
              const { data } = await axios.post(
                `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
                formData,
              );

              setAttachment({
                url: data.secure_url,
                fileName: file.name,
                mimeType: file.type,
                fileSizeBytes: file.size,
              });

              toast.success(`"${file.name}" attached.`, { id: toastId });
            } catch (err) {
              toast.error("Upload failed.", { id: toastId });
            }

            e.target.value = "";
          }}
        />

        <p className="mt-1.5 font-mono text-label-sm text-on-surface-variant">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>

      <DeleteMessageModal
        open={deleteModal.open}
        isMine={deleteModal.isMine}
        loading={deleteMutation.isPending}
        onClose={() =>
          setDeleteModal({
            open: false,
            messageId: null,
            isMine: false,
          })
        }
        onConfirm={() => {
          deleteMutation.mutate(deleteModal.messageId);
          setDeleteModal({
            open: false,
            messageId: null,
            isMine: false,
          });
        }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminMessages() {
  const { user } = useAuth();
  const { onChatEvent } = useSocket();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [mobileView, setMobileView] = useState("inbox");
  const [composing, setComposing] = useState(false);

  // ── Inbox query ─────────────────────────────────────────────────────
  const { data: inbox = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['messages', 'inbox', user._id],
    queryFn: async () => {
      const { data } = await api.get("/messages/inbox");
      return data.data.threads;
    },
    //enabled: !!user?._id,
    staleTime: 0,
refetchInterval: 30 * 1000,
refetchOnMount: "always",
refetchOnWindowFocus: true,
  });

  useEffect(() => {
  const unsub = onChatEvent("chat:new_message", () => {
    queryClient.invalidateQueries({ queryKey: ['messages', 'inbox', user._id] });
  });
  return unsub;
}, [onChatEvent, queryClient, user._id]);

  // ── Auto-open chat from navigation state ───────────────────────────
  useEffect(() => {
    const openChatWith = location.state?.openChatWith;
    if (openChatWith && inbox.length > 0) {
      const existingThread = inbox.find((t) => {
        const participant = getParticipant(t, user._id);
        return participant?._id === openChatWith;
      });

      if (existingThread) {
        const participant = getParticipant(existingThread, user._id);
        if (participant) {
          setActiveId(participant._id);
          setMobileView("conversation");
        }
      } else {
        setActiveId(openChatWith);
        setMobileView("conversation");
      }

      window.history.replaceState({}, document.title);
    }
  }, [location.state, inbox, user._id]);

  const filtered = useMemo(
    () =>
      inbox.filter((t) => {
        const participant = getParticipant(t, user._id);
        return (participant?.name || "")
          .toLowerCase()
          .includes(search.toLowerCase());
      }),
    [inbox, search, user._id],
  );

  const handleSelectThread = (thread) => {
    const participant = getParticipant(thread, user._id);
    if (!participant) return;
    setActiveId(participant._id);
    setMobileView("conversation");
  };

  return (
    <div
      className="-mx-container-pad -my-section-gap flex h-[calc(100dvh-4rem)] overflow-hidden
                    border-t border-outline-variant"
    >
      {/* ── Thread list (inbox) ──────────────────────────────────── */}
      <div
        className={cn(
          "flex flex-col border-r border-outline-variant bg-surface-bright",
          "w-full lg:w-80 xl:w-96 lg:flex shrink-0",
          mobileView === "conversation" ? "hidden lg:flex" : "flex",
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-outline-variant px-4">
          <h2 className="text-headline-sm font-semibold text-on-surface">
            Messages
          </h2>
          <div className="flex items-center gap-3">
            <span className="font-mono text-label-sm text-on-surface-variant">
              {inbox.filter((t) => t.unreadCount > 0).length} unread
            </span>
            <button
              onClick={() => setComposing(true)}
              className="flex h-8 w-8 items-center justify-center rounded-lg
                 text-on-surface-variant transition-colors
                 hover:bg-surface-container hover:text-[#006a61]"
              aria-label="New conversation"
              title="New message"
            >
              <PenSquare size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <div className="border-b border-outline-variant px-4 py-3">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="search"
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-8 py-2 text-body-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {composing ? (
            <NewConversationPanel
              currentUserId={user._id}
              onSelect={(selectedUser) => {
                setActiveId(selectedUser._id);
                setMobileView("conversation");
                setComposing(false);
              }}
              onClose={() => setComposing(false)}
            />
          ) : isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <ThreadSkeleton key={i} />)
          ) : isError ? (
            <div className="p-4 text-center">
              <AlertCircle size={20} className="mx-auto mb-2 text-error" />
              <p className="text-body-sm text-on-surface-variant">
                Failed to load messages.
              </p>
              <button
                onClick={() => refetch()}
                className="btn-ghost btn-sm mt-2"
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state py-12">
              <div className="empty-state-icon mx-auto mb-3">
                <MessageSquare size={22} />
              </div>
              <p className="empty-state-title text-body-sm">
                {search ? "No conversations found" : "No messages yet"}
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
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          mobileView === "inbox" && !activeId ? "hidden lg:flex" : "flex",
        )}
      >
        {activeId ? (
          <ConversationView
            key={activeId}
            participantId={activeId}
            onBack={() => {
              setActiveId(null);
              setMobileView("inbox");
            }}
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