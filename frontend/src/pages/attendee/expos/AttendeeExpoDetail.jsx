import { useState, useMemo, useRef, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import {
  ArrowLeft, MapPin, CalendarDays, Users,
  Building2, BookOpen, LayoutGrid, Clock,
  CheckCircle2, Bookmark, BookmarkCheck,
  AlertCircle, RefreshCw, Tag, Globe,
  Mic2, ArrowRight, ChevronRight, Sparkles,
  Star,
} from "lucide-react";
import { format, isPast, differenceInDays } from "date-fns";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { cn } from "@/utils/cn";
import FeedbackStars from "@/components/feedback/FeedbackStars";
import FeedbackForm from "@/components/feedback/FeedbackForm";

// ─── Animated Counter ─────────────────────────────────────────────────────────
function CountUp({ end, duration = 1.2 }) {
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
const expoKey = (id) => ["expos", "attendee", id];
const sessionsKey = (id) => ["sessions", "expo", id, "attendee", "preview"];
const myRegKey = ["sessions", "me", "registrations"];
const myBmkKey = ["sessions", "me", "bookmarks"];
const feedbackKey = (sessionId) => ["feedback", "session", sessionId];

// ─── Format badge ─────────────────────────────────────────────────────────────
const FORMAT_BADGE = {
  keynote: "badge-info",
  panel: "badge-neutral",
  workshop: "badge-success",
  presentation: "badge-neutral",
  networking: "badge-warning",
  demo: "badge-info",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatRelativeDate = (dateStr) => {
  const d = new Date(dateStr);
  const diff = differenceInDays(d, new Date());
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 0) return `In ${diff} days`;
  return format(d, "MMM d, yyyy");
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="skeleton h-[300px] rounded-xl" />
      <div className="skeleton h-6 w-24 rounded-full" />
      <div className="skeleton h-10 w-3/4 rounded" />
      <div className="skeleton h-5 w-full rounded" />
      <div className="skeleton h-5 w-2/3 rounded" />
      <div className="flex gap-3">
        <div className="skeleton h-10 w-36 rounded-lg" />
        <div className="skeleton h-10 w-28 rounded-lg" />
      </div>
    </div>
  );
}

function SessionCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3">
      <div className="skeleton h-4 w-16 rounded-sm" />
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-9 w-full rounded" />
    </div>
  );
}

// ─── Expo Banner Hero ─────────────────────────────────────────────────────────
function ExpoBannerHero({ banner, title, status, startDate, theme }) {
  const isOngoing = status === "ongoing";

  if (banner?.url) {
    return (
      <div className="relative -mx-container-pad -mt-section-gap mb-6 h-56 sm:h-72 lg:h-80 overflow-hidden">
        <motion.img
          initial={{ scale: 1.05 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          src={banner.url}
          alt={banner.altText || title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-transparent" />
        <div className="absolute bottom-6 left-container-pad">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            {isOngoing && (
              <span className="badge badge-success gap-1.5 shadow-lg backdrop-blur-sm bg-success/90 text-white text-body-sm px-3 py-1">
                <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="h-2 w-2 rounded-full bg-white" />
                Live Now
              </span>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative -mx-container-pad -mt-section-gap mb-6 h-56 sm:h-72 lg:h-80 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-secondary/80">
      <div className="absolute inset-0 opacity-10">
        <div className="h-full w-full" style={{ backgroundImage: "radial-gradient(circle at 25% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)" }} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="absolute bottom-6 left-container-pad">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          {isOngoing && (
            <span className="badge badge-success gap-1.5 shadow-lg backdrop-blur-sm bg-success/90 text-white">
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="h-2 w-2 rounded-full bg-white" />
              Live Now
            </span>
          )}
        </motion.div>
      </div>
      {theme && (
        <div className="absolute top-6 right-container-pad">
          <span className="badge bg-white/10 text-white backdrop-blur-sm border border-white/20">{theme}</span>
        </div>
      )}
    </div>
  );
}

// ─── Session preview card ─────────────────────────────────────────────────────
function SessionPreviewCard({ 
  session, 
  isRegistered, 
  isBookmarked, 
  onRegister, 
  onUnregister, 
  onBookmark, 
  isMutating, 
  index,
  onFeedbackSubmit 
}) {
  const isLive = session.status === "live";
  const isFull = session.maxCapacity && (session.attendeeCount ?? 0) >= session.maxCapacity;
  const isPastSes = isPast(new Date(session.endTime)) && !isLive;
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  // Fetch feedback data for completed sessions
  const { data: feedbackData, refetch: refetchFeedback } = useQuery({
    queryKey: feedbackKey(session._id),
    queryFn: async () => {
      const { data } = await api.get(`/feedback/session/${session._id}`);
      return data.data;
    },
    enabled: session.status === "completed",
  });

  const avgRating = feedbackData?.stats?.average || 0;
  const totalReviews = feedbackData?.stats?.total || 0;

  const handleFeedbackSuccess = () => {
    refetchFeedback();
    setShowFeedbackForm(false);
    setSelectedFeedback(null);
    onFeedbackSubmit?.();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.25 }} whileHover={{ y: -3 }}
        className={cn("card flex flex-col gap-3 transition-all duration-200 hover:shadow-level-2", isLive && "border-success/30 bg-success-container/5", isPastSes && "opacity-60")}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("badge text-label-sm", FORMAT_BADGE[session.format] || "badge-neutral")}>{session.format}</span>
            {isLive && <span className="badge badge-success gap-1 text-label-sm"><motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="h-1.5 w-1.5 rounded-full bg-success" />Live</span>}
            {isFull && !isRegistered && !isPastSes && <span className="badge badge-warning text-label-sm">Full</span>}
          </div>
          <motion.button whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} onClick={onBookmark} disabled={isMutating}
            className={cn("rounded-lg p-1 transition-colors shrink-0", isBookmarked ? "text-tertiary bg-tertiary-container/30" : "text-on-surface-variant hover:text-tertiary hover:bg-surface-container")}
            aria-label={isBookmarked ? "Remove bookmark" : "Bookmark"}>
            {isBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </motion.button>
        </div>
        <h4 className="text-body-sm font-semibold text-on-surface line-clamp-2 leading-snug">{session.title}</h4>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant"><Clock size={11} className="shrink-0" /><span>{format(new Date(session.startTime), "MMM d, HH:mm")} — {format(new Date(session.endTime), "HH:mm")}</span></div>
          <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant"><MapPin size={11} className="shrink-0" /><span className="line-clamp-1">{session.location}</span></div>
        </div>
        {session.speakers?.length > 0 && (
          <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant"><Mic2 size={11} className="shrink-0" /><span className="line-clamp-1">{session.speakers[0].name}{session.speakers.length > 1 && ` +${session.speakers.length - 1}`}</span></div>
        )}

        {/* Feedback display for completed sessions */}
        {session.status === "completed" && (
          <div className="mt-1 flex items-center gap-3">
            {totalReviews > 0 ? (
              <button 
                onClick={() => setShowFeedbackForm(true)}
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              >
                <FeedbackStars rating={avgRating} size="sm" readonly />
                <span className="font-mono text-label-sm text-on-surface-variant">
                  ({totalReviews})
                </span>
              </button>
            ) : (
              <button
                onClick={() => setShowFeedbackForm(true)}
                className="font-mono text-label-sm text-tertiary hover:text-secondary transition-colors flex items-center gap-1"
              >
                <Star size={12} />
                Leave feedback
              </button>
            )}
          </div>
        )}

        {!isPastSes && session.status !== "cancelled" && (isRegistered ? (
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={onUnregister} disabled={isMutating}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-success bg-success-container/30 px-3 py-2 text-body-sm font-medium text-on-success-container hover:bg-error-container/20 hover:border-error hover:text-on-error-container transition-all duration-200 mt-1">
            <CheckCircle2 size={14} /> Registered
          </motion.button>
        ) : (
          <motion.button whileHover={!isFull ? { scale: 1.01 } : {}} whileTap={!isFull ? { scale: 0.99 } : {}} onClick={onRegister} disabled={isFull || isMutating}
            className={cn("flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-body-sm font-medium transition-all mt-1", !isFull ? "btn-secondary" : "border border-outline-variant text-on-surface-variant cursor-not-allowed")}>
            {isFull ? "Session Full" : isMutating ? "Registering…" : "Register Now"}
          </motion.button>
        ))}
      </motion.div>

      {/* Feedback Form Modal */}
      <FeedbackForm
        isOpen={showFeedbackForm}
        onClose={() => {
          setShowFeedbackForm(false);
          setSelectedFeedback(null);
        }}
        sessionId={session._id}
        sessionTitle={session.title}
        existingFeedback={selectedFeedback}
        onSuccess={handleFeedbackSuccess}
      />
    </>
  );
}

// ─── Exhibitor preview card ───────────────────────────────────────────────────
function ExhibitorPreviewCard({ exhibitor, index }) {
  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }} whileHover={{ x: 3 }}
      className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-bright px-4 py-3 hover:bg-surface-container-low hover:border-secondary/20 transition-all duration-200">
      {exhibitor.logo ? (
        <motion.img whileHover={{ scale: 1.1 }} src={exhibitor.logo} alt={exhibitor.companyName} className="h-9 w-9 rounded-lg border border-outline-variant object-contain bg-surface-bright shrink-0" />
      ) : (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container"><Building2 size={15} /></div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-medium text-on-surface truncate">{exhibitor.companyName}</p>
        {exhibitor.industry && <p className="font-mono text-label-sm text-on-surface-variant truncate">{exhibitor.industry}</p>}
      </div>
      {exhibitor.isVerified && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}><CheckCircle2 size={14} className="text-secondary shrink-0" /></motion.span>}
      <ChevronRight size={14} className="text-on-surface-variant/30 shrink-0" />
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AttendeeExpoDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [mutatingId, setMutatingId] = useState(null);

  // ── Fetch expo ──────────────────────────────────────────────────────────────
  const { data: expo, isLoading: expoLoading, isError } = useQuery({
    queryKey: expoKey(id),
    queryFn: async () => { const { data } = await api.get(`/expos/${id}`); return data.data.expo; },
  });

  // ── Fetch sessions preview ──────────────────────────────────────────────────
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: sessionsKey(id),
    queryFn: async () => { const { data } = await api.get(`/sessions/expo/${id}?limit=6&sort=startTime`); return data.data; },
    enabled: !!expo,
  });

  // ── Fetch exhibitors preview ────────────────────────────────────────────────
  const { data: exhibitorsData } = useQuery({
    queryKey: ["exhibitors", "public", "preview", id],
    queryFn: async () => { const { data } = await api.get("/exhibitors/public?limit=6"); return data.data; },
    enabled: !!expo,
  });

  // ── Fetch public booth grid for attendees ───────────────────────────────────
  const { data: boothGridData } = useQuery({
    queryKey: ['booths', 'public-grid', id],
    queryFn: async () => { const { data } = await api.get(`/booths/expo/${id}/public-grid`); return data.data; },
    enabled: !!expo,
  });

  const boothGrid = boothGridData?.booths || [];
  const boothSummary = boothGridData?.summary || {};
  const assignedBoothCount = boothSummary?.assigned || 0;
  const totalBooths = boothSummary?.total || expo?.boothCount || 0;

  const boothOccupancyMap = useMemo(() => {
    const map = {};
    boothGrid.forEach((booth) => {
      if (booth.isOccupied && booth.gridCoordinates) {
        const key = `${booth.gridCoordinates.row}-${booth.gridCoordinates.col}`;
        map[key] = booth.exhibitor;
      }
      // Fallback: also index by booth number for legacy data
      if (booth.isOccupied && booth.boothNumber) {
        map[booth.boothNumber] = booth.exhibitor;
      }
    });
    return map;
  }, [boothGrid]);

  // ── Fetch user's registrations and bookmarks ────────────────────────────────
  const { data: myRegistrations = [] } = useQuery({
    queryKey: myRegKey,
    queryFn: async () => { const { data } = await api.get("/sessions/me/registrations"); return data.data.sessions; },
  });

  const { data: myBookmarks = [] } = useQuery({
    queryKey: myBmkKey,
    queryFn: async () => { const { data } = await api.get("/sessions/me/bookmarks"); return data.data.sessions; },
  });

  const registeredIds = useMemo(() => new Set(myRegistrations.map((s) => s._id)), [myRegistrations]);
  const bookmarkedIds = useMemo(() => new Set(myBookmarks.map((s) => s._id)), [myBookmarks]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: (sessionId) => api.post(`/sessions/${sessionId}/register`),
    onSuccess: () => { toast.success("Registered successfully! 🎉"); queryClient.invalidateQueries({ queryKey: myRegKey }); queryClient.invalidateQueries({ queryKey: sessionsKey(id) }); setMutatingId(null); },
    onError: (err) => { toast.error(err.message || "Failed to register."); setMutatingId(null); },
  });

  const unregisterMutation = useMutation({
    mutationFn: (sessionId) => api.delete(`/sessions/${sessionId}/register`),
    onSuccess: () => { toast.success("Registration cancelled."); queryClient.invalidateQueries({ queryKey: myRegKey }); queryClient.invalidateQueries({ queryKey: sessionsKey(id) }); setMutatingId(null); },
    onError: (err) => { toast.error(err.message || "Failed to cancel."); setMutatingId(null); },
  });

  const bookmarkMutation = useMutation({
    mutationFn: (sessionId) => api.post(`/sessions/${sessionId}/bookmark`),
    onSuccess: (res) => { toast.success(res.data.isBookmarked ? "Bookmarked! 🔖" : "Bookmark removed."); queryClient.invalidateQueries({ queryKey: myBmkKey }); setMutatingId(null); },
    onError: (err) => { toast.error(err.message || "Failed."); setMutatingId(null); },
  });

  const handleAction = (sessionId, action) => {
    setMutatingId(sessionId);
    if (action === "register") registerMutation.mutate(sessionId);
    if (action === "unregister") unregisterMutation.mutate(sessionId);
    if (action === "bookmark") bookmarkMutation.mutate(sessionId);
  };

  // ── Error state ─────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="empty-state py-20">
        <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, delay: 0.3 }} className="empty-state-icon text-error"><AlertCircle size={28} /></motion.div>
        <h3 className="empty-state-title">Event not found</h3>
        <Link to="/attendee/expos" className="btn-ghost btn-sm mt-3 gap-1.5"><ArrowLeft size={14} /> Browse Events</Link>
      </motion.div>
    );
  }

  const sessions = sessionsData?.sessions || [];
  const exhibitors = exhibitorsData?.profiles || [];
  const isOngoing = expo?.status === "ongoing";
  const daysUntil = expo ? differenceInDays(new Date(expo.startDate), new Date()) : null;

  return (
    <div className="flex flex-col">
      {!expoLoading && expo && (
        <ExpoBannerHero banner={expo.banner} title={expo.title} status={expo.status} startDate={expo.startDate} theme={expo.theme} />
      )}

      <div className="flex flex-col gap-8">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <Link to="/attendee/expos" className="btn-ghost btn-sm gap-1.5 self-start"><ArrowLeft size={15} /> All Events</Link>
        </motion.div>

        {expoLoading ? <HeroSkeleton /> : expo && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} className="flex flex-col gap-5">
            <div className="flex items-center gap-2 flex-wrap">
              {isOngoing ? (
                <span className="badge badge-success gap-1"><motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="h-1.5 w-1.5 rounded-full bg-success" />Live Now</span>
              ) : expo.status === "completed" ? (
                <span className="badge badge-neutral">Event Ended</span>
              ) : daysUntil !== null && daysUntil >= 0 ? (
                <span className="badge badge-info">{formatRelativeDate(expo.startDate)}</span>
              ) : null}
              {expo.theme && <span className="badge badge-neutral font-mono text-label-sm">{expo.theme}</span>}
            </div>
            <h1 className="text-headline-lg sm:text-display-sm font-semibold text-on-surface flex items-center gap-2"><Sparkles size={22} className="text-secondary" />{expo.title}</h1>
            {expo.description && <p className="text-body-lg text-on-surface-variant leading-relaxed max-w-3xl">{expo.description}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant"><CalendarDays size={15} className="text-secondary shrink-0" /><span>{format(new Date(expo.startDate), "MMM d")} — {format(new Date(expo.endDate), "MMM d, yyyy")}</span></div>
              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant"><MapPin size={15} className="text-secondary shrink-0" /><span className="truncate">{expo.address?.venue || `${expo.address?.city}, ${expo.address?.country}`}</span></div>
              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant"><Building2 size={15} className="text-secondary shrink-0" /><span>{expo.boothCount ?? 0} exhibitors</span></div>
              <div className="flex items-center gap-2 text-body-sm text-on-surface-variant"><BookOpen size={15} className="text-secondary shrink-0" /><span>{expo.sessionCount ?? 0} sessions</span></div>
            </div>
            {expo.tags?.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap"><Tag size={13} className="text-on-surface-variant" />{expo.tags.map((tag, i) => (<motion.span key={tag} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03 }} className="badge badge-neutral">{tag}</motion.span>))}</div>
            )}
            <div className="flex flex-wrap gap-3">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Link to={`/attendee/sessions?expoId=${id}`} className="btn-secondary gap-2 inline-flex"><BookOpen size={15} /> Browse Sessions</Link></motion.div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}><Link to="/attendee/exhibitors" className="btn-ghost gap-2 inline-flex"><Building2 size={15} /> View Exhibitors</Link></motion.div>
            </div>
          </motion.div>
        )}

        {!expoLoading && expo && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-3 gap-4">
            {[
              { icon: Building2, label: "Exhibitors", value: assignedBoothCount },
              { icon: BookOpen, label: "Sessions", value: expo.sessionCount ?? 0 },
              { icon: Users, label: "Attendees", value: expo.attendeeCount ?? 0 },
            ].map(({ icon: Icon, label, value }, i) => (
              <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.05 }} whileHover={{ y: -2 }}
                className="card flex flex-col items-center gap-1 py-5 text-center hover:shadow-level-2 transition-all duration-200">
                <motion.div whileHover={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 0.3 }}><Icon size={20} className="text-secondary" /></motion.div>
                <p className="font-mono text-headline-sm font-bold text-on-surface"><CountUp end={value} /></p>
                <p className="text-body-sm text-on-surface-variant">{label}</p>
              </motion.div>
            ))}
          </motion.div>
        )}

        <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2"><Star size={17} className="text-secondary" />Session Highlights</h2>
            <Link to={`/attendee/sessions?expoId=${id}`} className="btn-tertiary btn-sm gap-1 group/link">All sessions<ArrowRight size={13} className="transition-transform group-hover/link:translate-x-0.5" /></Link>
          </div>
          {sessionsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <SessionCardSkeleton key={i} />)}</div>
          ) : sessions.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card border-2 border-dashed py-12 text-center">
              <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 3 }}><BookOpen size={28} className="mx-auto text-on-surface-variant/20" /></motion.div>
              <p className="mt-3 text-body-sm text-on-surface-variant">No sessions announced yet.</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session, i) => (
                <SessionPreviewCard 
                  key={session._id} 
                  session={session} 
                  index={i} 
                  isRegistered={registeredIds.has(session._id)} 
                  isBookmarked={bookmarkedIds.has(session._id)}
                  isMutating={mutatingId === session._id} 
                  onRegister={() => handleAction(session._id, "register")}
                  onUnregister={() => handleAction(session._id, "unregister")} 
                  onBookmark={() => handleAction(session._id, "bookmark")}
                  onFeedbackSubmit={() => {
                    queryClient.invalidateQueries({ queryKey: feedbackKey(session._id) });
                  }}
                />
              ))}
            </div>
          )}
          {(sessionsData?.pagination?.total ?? 0) > 6 && (
            <Link to={`/attendee/sessions?expoId=${id}`} className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant py-3 text-body-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface hover:border-secondary/30 transition-all duration-200">
              View all {sessionsData.pagination.total} sessions<ChevronRight size={15} />
            </Link>
          )}
        </motion.section>

        {exhibitors.length > 0 && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2"><Building2 size={17} className="text-secondary" />Exhibiting Companies</h2>
              <Link to="/attendee/exhibitors" className="btn-tertiary btn-sm gap-1 group/link">Full Directory<ArrowRight size={13} className="transition-transform group-hover/link:translate-x-0.5" /></Link>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {exhibitors.map((exhibitor, i) => <ExhibitorPreviewCard key={exhibitor._id} exhibitor={exhibitor} index={i} />)}
            </div>
          </motion.section>
        )}

        {/* ── Floor Plan ──────────────────────────────────────────── */}
        {expo?.floorPlanConfig && totalBooths > 0 && (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2"><MapPin size={17} className="text-secondary" />Floor Plan</h2>
              <span className="font-mono text-label-sm text-on-surface-variant">{assignedBoothCount}/{totalBooths} booths occupied</span>
            </div>

            <div className="card overflow-hidden">
              <div className="mb-4 p-4 bg-surface-container-low rounded-lg border border-outline-variant">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-mono text-label-sm text-on-surface-variant flex items-center gap-1.5"><LayoutGrid size={13} />Event Layout</p>
                  <span className="font-mono text-label-sm text-on-surface-variant">{expo.floorPlanConfig.rows}×{expo.floorPlanConfig.cols} grid</span>
                </div>

                <div className="grid gap-1 mx-auto" style={{ gridTemplateColumns: `repeat(${Math.min(expo.floorPlanConfig.cols, 10)}, minmax(0, 1fr))`, maxWidth: `${Math.min(expo.floorPlanConfig.cols, 10) * 36}px` }}>
                  {Array.from({ length: Math.min(expo.floorPlanConfig.rows * expo.floorPlanConfig.cols, 80) }).map((_, i) => {
                    const row = Math.floor(i / expo.floorPlanConfig.cols);
                    const col = i % expo.floorPlanConfig.cols;
                    const boothNumber = `${String.fromCharCode(65 + row)}${String(col + 1).padStart(2, "0")}`;
                    const coordKey = `${row}-${col}`;
                    const exhibitor = boothOccupancyMap[coordKey] || boothOccupancyMap[boothNumber];
                    const isOccupied = !!exhibitor;

                    return (
                      <motion.div key={i} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.008 }}
                        whileHover={{ scale: 1.3, zIndex: 10 }}
                        className={cn("aspect-square rounded-sm border transition-colors cursor-pointer relative group/cell", isOccupied ? "bg-secondary/30 border-secondary/50 hover:bg-secondary/50" : "bg-surface-bright border-outline-variant/50 hover:border-outline-variant")}
                        title={isOccupied ? `Booth ${boothNumber} — ${exhibitor?.companyName || 'Occupied'}` : `Booth ${boothNumber} — Available`}
                      >
                        {isOccupied && exhibitor?.companyName && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover/cell:block z-20 pointer-events-none">
                            <div className="bg-primary text-white text-[10px] font-medium rounded px-2 py-1 whitespace-nowrap shadow-lg">
                              {exhibitor.companyName}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-primary" />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                <div className="flex items-center gap-4 mt-3 justify-center">
                  <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm bg-secondary/30 border border-secondary/50" /><span className="font-mono text-label-sm text-on-surface-variant">Occupied</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm bg-surface-bright border border-outline-variant/50" /><span className="font-mono text-label-sm text-on-surface-variant">Available</span></div>
                </div>
              </div>

              {boothGrid.filter(b => b.isOccupied && b.exhibitor?.companyName).length > 0 && (
                <div>
                  <p className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant mb-2 px-1">Exhibitors on the Map</p>
                  <div className="space-y-1">
                    {boothGrid.filter(b => b.isOccupied && b.exhibitor?.companyName).slice(0, 8).map((booth, i) => (
                      <motion.div key={booth.boothId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} whileHover={{ x: 3 }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-low transition-all duration-200">
                        {booth.exhibitor?.logo ? (
                          <img src={booth.exhibitor.logo} alt={booth.exhibitor.companyName} className="h-8 w-8 rounded border object-contain shrink-0 bg-surface-bright" />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary-container text-on-primary-container"><Building2 size={13} /></div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-body-sm font-medium text-on-surface truncate">{booth.exhibitor.companyName}</p>
                          <p className="font-mono text-label-sm text-secondary">Booth {booth.boothNumber}</p>
                        </div>
                        <span className="badge badge-success text-label-sm">On Map</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        {exhibitors.length === 0 && !expoLoading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="card flex items-center justify-between gap-4 bg-primary-container border-primary/20 hover:shadow-level-2 transition-all duration-200 group">
            <div className="flex items-center gap-3">
              <motion.div whileHover={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 0.3 }} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary"><Building2 size={18} className="text-on-primary" /></motion.div>
              <div><p className="text-body-sm font-semibold text-on-primary-container">Discover Exhibiting Companies</p><p className="font-mono text-label-sm text-on-primary-container/70">Browse the full directory of companies at this event.</p></div>
            </div>
            <Link to="/attendee/exhibitors" className="btn-secondary btn-sm gap-1.5 shrink-0 group/btn"><Building2 size={14} /> View Directory<ArrowRight size={13} className="transition-transform group-hover/btn:translate-x-0.5" /></Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}