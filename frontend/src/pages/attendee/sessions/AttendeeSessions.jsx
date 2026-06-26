import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  Search,
  X,
  BookOpen,
  MapPin,
  Clock,
  Users,
  BookmarkCheck,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Mic2,
  Filter,
  Sparkles,
  Star,
  Zap,
  Tag,
  Loader2,
} from "lucide-react";
import { format, isPast, isFuture } from "date-fns";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/utils/cn";
import { usePayment } from "@/hooks/usePayment"; // ✅ ADD THIS
import PaymentModal from "@/components/payment/PaymentModal"; // ✅ ADD THIS

// ─── Animated Counter ─────────────────────────────────────────────────────────
function CountUp({ end, duration = 1 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || (!end && end !== 0)) return;
    let startTime;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(end * eased));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, end, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString()}
    </span>
  );
}

// ─── Query keys ───────────────────────────────────────────────────────────────
const sessionKeys = {
  list: (params) => ["sessions", "list", params],
  myReg: () => ["sessions", "me", "registrations"],
  myBookmarks: () => ["sessions", "me", "bookmarks"],
  expoList: () => ["expos", "published"],
};

// ─── Format config ────────────────────────────────────────────────────────────
const FORMAT_TABS = [
  { value: "", label: "All Formats" },
  { value: "keynote", label: "Keynotes" },
  { value: "panel", label: "Panels" },
  { value: "workshop", label: "Workshops" },
  { value: "presentation", label: "Presentations" },
  { value: "networking", label: "Networking" },
  { value: "demo", label: "Demos" },
];

const FORMAT_BADGE = {
  keynote: "badge-info",
  panel: "badge-neutral",
  workshop: "badge-success",
  presentation: "badge-neutral",
  networking: "badge-warning",
  demo: "badge-info",
  other: "badge-neutral",
};

// ─── Skeleton card ────────────────────────────────────────────────────────────
function SessionCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="skeleton h-4 w-16 rounded-sm" />
        <div className="skeleton h-4 w-24 rounded" />
      </div>
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
      <div className="flex items-center gap-4 mt-1">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-3 w-16 rounded" />
      </div>
      <div className="flex gap-2 mt-2">
        <div className="skeleton h-9 flex-1 rounded-lg" />
        <div className="skeleton h-9 w-9 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  isRegistered,
  isBookmarked,
  onRegister,
  onUnregister,
  onBookmark,
  isMutating,
  index,
}) {
  const { createSessionPayment, showPaymentModal, transaction, setShowPaymentModal } = usePayment();
  const [isProcessing, setIsProcessing] = useState(false);
  const isLive = session.status === "live";
  const isFull =
    session.maxCapacity && session.attendeeCount >= session.maxCapacity;
  const isPastSes = isPast(new Date(session.endTime)) && !isLive;
  const canRegister =
    !isRegistered && !isFull && !isPastSes && session.status !== "cancelled";

  const handleRegister = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    // Check if session requires payment
    if (session.price > 0) {
      try {
        await createSessionPayment.mutateAsync({
          sessionId: session._id,
          paymentMethod: 'mock',
        });
      } catch (error) {
        // Error handled by mutation
        console.error('Registration failed:', error);
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Free session - register directly
      await onRegister();
      setIsProcessing(false);
    }
  };

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{
          duration: 0.25,
          delay: index * 0.04,
          ease: [0.4, 0, 0.2, 1],
        }}
        whileHover={{ y: -3 }}
        className={cn(
          "card flex flex-col gap-3 transition-all duration-200 hover:shadow-level-2",
          isLive &&
            "border-success/40 bg-success-container/5 ring-1 ring-success/20",
          isPastSes && "opacity-60",
        )}
      >
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, delay: index * 0.04 }}
              className={cn(
                "badge text-label-sm",
                FORMAT_BADGE[session.format] || "badge-neutral",
              )}
            >
              {session.format}
            </motion.span>
            {isLive && (
              <span className="badge badge-success gap-1 text-label-sm">
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="h-1.5 w-1.5 rounded-full bg-success"
                />
                Live Now
              </span>
            )}
            {session.isFeatured && (
              <span className="badge badge-info gap-1 text-label-sm">
                <Star size={10} /> Featured
              </span>
            )}
            {session.price > 0 && (
              <span className="badge badge-warning text-label-sm">
                ${(session.price / 100).toFixed(2)}
              </span>
            )}
            {isFull && !isRegistered && (
              <span className="badge badge-error text-label-sm">Full</span>
            )}
            {session.status === "cancelled" && (
              <span className="badge badge-error text-label-sm">Cancelled</span>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant shrink-0">
            <Clock size={11} />
            <span>{format(new Date(session.startTime), "HH:mm")}</span>
            <span>—</span>
            <span>{format(new Date(session.endTime), "HH:mm")}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-body-md font-semibold text-on-surface line-clamp-2 leading-snug group-hover:text-secondary transition-colors">
          {session.title}
        </h3>

        {/* Speakers */}
        {session.speakers?.length > 0 && (
          <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
            <Mic2 size={13} className="shrink-0" />
            <span className="line-clamp-1">
              {session.speakers.map((s) => s.name).join(", ")}
            </span>
          </div>
        )}

        {/* Location & date */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
            <MapPin size={13} className="shrink-0" />
            <span className="line-clamp-1">{session.location}</span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
            <CalendarDays size={12} className="shrink-0" />
            <span>{format(new Date(session.startTime), "MMM d, yyyy")}</span>
          </div>
        </div>

        {/* Capacity */}
        {session.maxCapacity && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, (session.attendeeCount / session.maxCapacity) * 100)}%`,
                }}
                transition={{ duration: 0.6, delay: index * 0.03 }}
                className={cn(
                  "h-full rounded-full",
                  session.attendeeCount / session.maxCapacity >= 0.9
                    ? "bg-error"
                    : session.attendeeCount / session.maxCapacity >= 0.7
                      ? "bg-warning"
                      : "bg-secondary",
                )}
              />
            </div>
            <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant shrink-0">
              <Users size={11} />
              <span>
                {session.attendeeCount ?? 0} / {session.maxCapacity}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-1">
          {isPastSes || session.status === "cancelled" ? (
            <div
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant
                            px-3 py-2 text-body-sm text-on-surface-variant bg-surface-container"
            >
              {isPastSes ? "Session ended" : "Cancelled"}
            </div>
          ) : isRegistered ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={onUnregister}
              disabled={isMutating}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border
                         border-success bg-success-container/30 px-3 py-2 text-body-sm
                         font-medium text-on-success-container hover:bg-error-container/30
                         hover:border-error hover:text-on-error-container transition-all duration-200"
            >
              <CheckCircle2 size={14} />
              {isMutating ? "Processing…" : "Registered"}
            </motion.button>
          ) : (
            <motion.button
              whileHover={canRegister ? { scale: 1.01 } : {}}
              whileTap={canRegister ? { scale: 0.99 } : {}}
              onClick={handleRegister}
              disabled={!canRegister || isMutating || isProcessing}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2",
                "text-body-sm font-medium transition-all duration-200",
                canRegister
                  ? "btn-secondary"
                  : "border border-outline-variant text-on-surface-variant cursor-not-allowed bg-surface-container",
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={14} className="animate-spin-slow" />
                  Processing…
                </>
              ) : isMutating ? (
                "Processing…"
              ) : isFull ? (
                "Session Full"
              ) : session.price > 0 ? (
                `Register $${(session.price / 100).toFixed(2)}`
              ) : (
                "Register Now"
              )}
            </motion.button>
          )}

          {/* Bookmark */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onBookmark}
            disabled={isMutating}
            className={cn(
              "rounded-lg border p-2 transition-all duration-200",
              isBookmarked
                ? "border-tertiary bg-tertiary-container/30 text-tertiary"
                : "border-outline-variant text-on-surface-variant hover:border-tertiary hover:bg-tertiary-container/20 hover:text-tertiary",
            )}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark session"}
            title={isBookmarked ? "Remove bookmark" : "Bookmark session"}
          >
            {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
          </motion.button>
        </div>
      </motion.div>

      {/* Payment Modal */}
      {showPaymentModal && transaction && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          transaction={transaction}
          type="session"
          itemName={session.title}
          amount={transaction.amount}
          currency={transaction.currency}
          expiresAt={transaction.expiresAt}
          onSuccess={() => {
            setShowPaymentModal(false);
            // Refresh sessions
            queryClient.invalidateQueries({ queryKey: sessionKeys.list({ expoId }) });
          }}
          onCancel={() => {
            setShowPaymentModal(false);
          }}
        />
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AttendeeSessions() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [mutatingId, setMutatingId] = useState(null);
  const queryClient = useQueryClient();

  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const format_ = searchParams.get("format") || "";
  const expoId = searchParams.get("expoId") || "";
  const date = searchParams.get("date") || "";
  const LIMIT = 12;

  const setParam = useCallback(
    (key, value) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== "page") next.delete("page");
        return next;
      });
    },
    [setSearchParams],
  );

  // ── Fetch published expos for the selector ──────────────────────────────────
  const { data: expos = [] } = useQuery({
    queryKey: sessionKeys.expoList(),
    queryFn: async () => {
      const { data } = await api.get(
        "/expos?status=published,ongoing&limit=50&sort=start-asc",
      );
      return data.data.expos;
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Fetch sessions ──────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: sessionKeys.list({
      page,
      search,
      format: format_,
      expoId,
      date,
      limit: LIMIT,
    }),
    queryFn: async () => {
      if (!expoId) return { sessions: [], pagination: { total: 0 } };
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) params.set("search", search);
      if (format_) params.set("format", format_);
      if (date) params.set("date", date);
      const { data } = await api.get(`/sessions/expo/${expoId}?${params}`);
      return data.data;
    },
    enabled: !!expoId,
    keepPreviousData: true,
  });

  // ── Fetch user's registrations and bookmarks ────────────────────────────────
  const { data: myRegistrations = [] } = useQuery({
    queryKey: sessionKeys.myReg(),
    queryFn: async () => {
      const { data } = await api.get("/sessions/me/registrations");
      return data.data.sessions;
    },
  });

  const { data: myBookmarks = [] } = useQuery({
    queryKey: sessionKeys.myBookmarks(),
    queryFn: async () => {
      const { data } = await api.get("/sessions/me/bookmarks");
      return data.data.sessions;
    },
  });

  const registeredIds = useMemo(
    () => new Set(myRegistrations.map((s) => s._id)),
    [myRegistrations],
  );

  const bookmarkedIds = useMemo(
    () => new Set(myBookmarks.map((s) => s._id)),
    [myBookmarks],
  );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: (sessionId) => api.post(`/sessions/${sessionId}/register`),
    onSuccess: (_, sessionId) => {
      toast.success("Registered successfully! 🎉");
      queryClient.invalidateQueries({ queryKey: sessionKeys.myReg() });
      queryClient.invalidateQueries({
        queryKey: sessionKeys.list({
          page,
          search,
          format: format_,
          expoId,
          date,
          limit: LIMIT,
        }),
      });
      setMutatingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to register.");
      setMutatingId(null);
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: (sessionId) => api.delete(`/sessions/${sessionId}/register`),
    onSuccess: () => {
      toast.success("Registration cancelled.");
      queryClient.invalidateQueries({ queryKey: sessionKeys.myReg() });
      queryClient.invalidateQueries({
        queryKey: sessionKeys.list({
          page,
          search,
          format: format_,
          expoId,
          date,
          limit: LIMIT,
        }),
      });
      setMutatingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to cancel registration.");
      setMutatingId(null);
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: (sessionId) => api.post(`/sessions/${sessionId}/bookmark`),
    onSuccess: (res, sessionId) => {
      const { isBookmarked } = res.data;
      toast.success(isBookmarked ? "Bookmarked! 🔖" : "Bookmark removed.");
      queryClient.invalidateQueries({ queryKey: sessionKeys.myBookmarks() });
      setMutatingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to toggle bookmark.");
      setMutatingId(null);
    },
  });

  const handleAction = (sessionId, action) => {
    setMutatingId(sessionId);
    if (action === "register") registerMutation.mutate(sessionId);
    if (action === "unregister") unregisterMutation.mutate(sessionId);
    if (action === "bookmark") bookmarkMutation.mutate(sessionId);
  };

  const sessions = data?.sessions || [];
  const pagination = data?.pagination || {};

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="page-header"
      >
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles size={20} className="text-secondary" />
            Sessions
          </h1>
          <p className="page-subtitle">
            {!isLoading && pagination.total > 0 ? (
              <span>
                <CountUp end={pagination.total} /> sessions available
              </span>
            ) : (
              "Browse and register for talks, workshops, and keynotes."
            )}
          </p>
        </div>
      </motion.div>

      {/* ── Expo selector ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="flex items-center gap-2 shrink-0">
          <CalendarDays size={16} className="text-secondary" />
          <span className="text-body-sm font-medium text-on-surface">
            Select Event
          </span>
        </div>
        <select
          value={expoId}
          onChange={(e) => setParam("expoId", e.target.value)}
          className="input flex-1"
          aria-label="Select expo"
        >
          <option value="">— Choose an event to browse sessions —</option>
          {expos.map((expo) => (
            <option key={expo._id} value={expo._id}>
              {expo.title} · {format(new Date(expo.startDate), "MMM d, yyyy")}
            </option>
          ))}
        </select>
      </motion.div>

      {/* Only show filters/sessions if an expo is selected */}
      {!expoId ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="empty-state py-20"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            className="empty-state-icon"
          >
            <BookOpen size={28} />
          </motion.div>
          <h3 className="empty-state-title">Select an event above</h3>
          <p className="empty-state-body">
            Choose an event to browse its session schedule.
          </p>
        </motion.div>
      ) : (
        <>
          {/* ── Format tabs ─────────────────────────────────────── */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hidden pb-1">
            {FORMAT_TABS.map((tab) => (
              <motion.button
                key={tab.value}
                whileHover={{ y: -1 }}
                whileTap={{ y: 0 }}
                onClick={() => setParam("format", tab.value)}
                className={cn(
                  "relative shrink-0 rounded-lg px-3 py-1.5 text-body-sm font-medium transition-all duration-200",
                  format_ === tab.value
                    ? "bg-primary text-on-primary shadow-sm"
                    : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface",
                )}
              >
                {tab.label}
                {format_ === tab.value && (
                  <motion.span
                    layoutId="session-format-tab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-t"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </div>

          {/* ── Search + date ─────────────────────────────────── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center w-full">
            <div className="relative flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
              />
              <input
                type="search"
                placeholder="Search by title, speaker, or topic…"
                value={search}
                onChange={(e) => setParam("search", e.target.value)}
                className="input pl-9 pr-8 w-full"
              />
              {search && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setParam("search", "")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <X size={14} />
                </motion.button>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Filter size={14} className="text-on-surface-variant" />
              <input
                type="date"
                value={date}
                onChange={(e) => setParam("date", e.target.value)}
                className="input w-auto"
                aria-label="Filter by date"
              />
              {date && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={() => setParam("date", "")}
                  className="text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  <X size={14} />
                </motion.button>
              )}
            </div>
          </div>

          {/* ── Sessions grid ─────────────────────────────────── */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SessionCardSkeleton key={i} />
              ))}
            </div>
          ) : isError ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="empty-state py-16"
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="empty-state-icon text-error"
              >
                <AlertCircle size={24} />
              </motion.div>
              <h3 className="empty-state-title">Failed to load sessions</h3>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => refetch()}
                className="btn-ghost btn-sm mt-3 gap-1"
              >
                <RefreshCw size={13} /> Retry
              </motion.button>
            </motion.div>
          ) : sessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="empty-state py-16"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut",
                }}
                className="empty-state-icon"
              >
                <BookOpen size={24} />
              </motion.div>
              <h3 className="empty-state-title">No sessions found</h3>
              <p className="empty-state-body">
                {search || format_ || date
                  ? "Try adjusting your filters."
                  : "No sessions have been scheduled for this event yet."}
              </p>
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sessions.map((session, i) => (
                  <SessionCard
                    key={session._id}
                    session={session}
                    index={i}
                    isRegistered={registeredIds.has(session._id)}
                    isBookmarked={bookmarkedIds.has(session._id)}
                    isMutating={mutatingId === session._id}
                    onRegister={() => handleAction(session._id, "register")}
                    onUnregister={() => handleAction(session._id, "unregister")}
                    onBookmark={() => handleAction(session._id, "bookmark")}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}

          {/* ── Pagination ────────────────────────────────────── */}
          {!isLoading && pagination.totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-center justify-between"
            >
              <p className="font-mono text-label-sm text-on-surface-variant">
                Page {pagination.page} of {pagination.totalPages} ·{" "}
                {pagination.total.toLocaleString()} sessions
              </p>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setParam("page", String(page - 1))}
                  disabled={!pagination.hasPrevPage}
                  className="btn-ghost btn-sm gap-1 disabled:opacity-40"
                >
                  <ChevronLeft size={15} /> Prev
                </motion.button>
                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setParam("page", String(page + 1))}
                  disabled={!pagination.hasNextPage}
                  className="btn-ghost btn-sm gap-1 disabled:opacity-40"
                >
                  Next <ChevronRight size={15} />
                </motion.button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}