import React, { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  CalendarDays,
  LayoutGrid,
  BookOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Tag,
  Users,
  Building2,
  Info,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Image,
  Sparkles,
  Globe,
  ExternalLink,
  RefreshCw,
  XCircle,
  DollarSign,
} from "lucide-react";
import { format, differenceInDays, isPast } from "date-fns";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/utils/cn";
import { useBooth } from "@/hooks/useBooth";

// ─── Query keys ───────────────────────────────────────────────────────────────
const expoKey = (id) => ["expos", "exhibitor", "detail", id];
const sessionsKey = (id) => ["sessions", "expo", id, "exhibitor", "preview"];
const profileKey = ["exhibitor", "profile", "me"];
const myRegKey = ["sessions", "me", "registrations"];
const myBmkKey = ["sessions", "me", "bookmarks"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Field = ({ label, value, icon: Icon }) => (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col gap-0.5"
  >
    <span className="font-mono text-label-sm text-on-surface-variant flex items-center gap-1">
      {Icon && <Icon size={11} />}
      {label}
    </span>
    <span className="text-body-sm font-medium text-on-surface">
      {value || "—"}
    </span>
  </motion.div>
);

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({
  session,
  isRegistered,
  isBookmarked,
  onRegister,
  onUnregister,
  onBookmark,
  isMutating,
}) {
  const isLive = session.status === "live";
  const isFull =
    session.maxCapacity && (session.attendeeCount ?? 0) >= session.maxCapacity;
  const isPastSes = isPast(new Date(session.endTime)) && !isLive;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "card flex flex-col gap-2 hover:shadow-level-2 transition-all duration-200",
        isLive && "border-success/30 bg-success-container/5",
        isPastSes && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="badge badge-neutral capitalize text-label-sm">
            {session.format}
          </span>
          {isLive && (
            <span className="flex items-center gap-1 font-mono text-label-sm text-success">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full bg-success"
              />
              Live
            </span>
          )}
        </div>
        <motion.button
          whileHover={{ scale: 1.15 }}
          whileTap={{ scale: 0.9 }}
          onClick={onBookmark}
          disabled={isMutating}
          className={cn(
            "rounded p-1 transition-colors shrink-0",
            isBookmarked
              ? "text-tertiary"
              : "text-on-surface-variant hover:text-tertiary",
          )}
          aria-label={isBookmarked ? "Remove bookmark" : "Bookmark session"}
        >
          {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        </motion.button>
      </div>

      <p className="text-body-sm font-semibold text-on-surface line-clamp-2 leading-snug">
        {session.title}
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-label-sm text-on-surface-variant flex items-center gap-1">
          <Clock size={10} />
          {format(new Date(session.startTime), "MMM d, HH:mm")}
        </span>
        <span className="font-mono text-label-sm text-on-surface-variant flex items-center gap-1">
          <MapPin size={10} />
          {session.location}
        </span>
        {session.maxCapacity && (
          <span className="font-mono text-label-sm text-on-surface-variant flex items-center gap-1">
            <Users size={10} />
            {session.attendeeCount ?? 0}/{session.maxCapacity}
          </span>
        )}
      </div>

      {!isPastSes &&
        session.status !== "cancelled" &&
        (isRegistered ? (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onUnregister}
            disabled={isMutating}
            className="mt-1 flex items-center justify-center gap-1 rounded-lg border border-success
                       bg-success-container/30 px-3 py-1.5 text-body-sm font-medium
                       text-on-success-container hover:bg-error-container/30 hover:border-error
                       hover:text-on-error-container transition-all"
          >
            <CheckCircle2 size={13} />
            {isMutating ? "Processing…" : "Registered"}
          </motion.button>
        ) : (
          <motion.button
            whileHover={!isFull ? { scale: 1.01 } : {}}
            whileTap={!isFull ? { scale: 0.99 } : {}}
            onClick={onRegister}
            disabled={isFull || isMutating}
            className={cn(
              "mt-1 rounded-lg px-3 py-1.5 text-body-sm font-medium transition-all",
              !isFull
                ? "btn-secondary"
                : "border border-outline-variant text-on-surface-variant cursor-not-allowed",
            )}
          >
            {isFull ? "Fully Booked" : isMutating ? "Processing…" : "Register"}
          </motion.button>
        ))}
    </motion.div>
  );
}

// ─── Booth status card ────────────────────────────────────────────────────────
function BoothStatusCard({ expoId, profile, onCancel }) {
  // Check if profile exists and has assignedBooths
  if (!profile || !profile.assignedBooths) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card border-dashed border-2 flex flex-col gap-3 text-center py-8"
      >
        <motion.div
          animate={{ y: [0, -5, 0] }}
          transition={{ repeat: Infinity, duration: 3 }}
          className="empty-state-icon mx-auto"
        >
          <LayoutGrid size={22} />
        </motion.div>
        <p className="text-body-sm font-medium text-on-surface">
          Complete your profile first
        </p>
        <p className="text-body-sm text-on-surface-variant">
          Create your exhibitor profile to apply for a booth.
        </p>
        <Link
          to="/exhibitor/profile"
          className="btn-secondary btn-sm gap-1 self-center"
        >
          <Building2 size={13} /> Complete Profile
        </Link>
      </motion.div>
    );
  }

  if (profile.applicationStatus !== "approved") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card flex flex-col gap-3"
      >
        <div className="flex items-start gap-3">
          <motion.div
            whileHover={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.3 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-warning-container"
          >
            <Clock size={17} className="text-on-warning-container" />
          </motion.div>
          <div>
            <p className="text-body-sm font-semibold text-on-surface">
              Application {profile.applicationStatus}
            </p>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Your exhibitor application must be approved before reserving a
              booth.
            </p>
          </div>
        </div>
        <Link
          to="/exhibitor/profile"
          className="btn-ghost btn-sm gap-1 self-start group/link"
        >
          View Application
          <ChevronRight
            size={13}
            className="transition-transform group-hover/link:translate-x-0.5"
          />
        </Link>
      </motion.div>
    );
  }

  // Find ALL booths for this specific expo
  const myBooths = profile.assignedBooths.filter((ab) => {
    const abExpoId =
      ab.expoId?._id?.toString() || ab.expoId?.toString() || ab.expoId;
    return abExpoId === expoId;
  });

  // If no booths found for this expo
  if (myBooths.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card flex flex-col gap-3"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary-container">
            <LayoutGrid size={17} className="text-on-secondary-container" />
          </div>
          <div>
            <p className="text-body-sm font-semibold text-on-surface">
              No booth reserved yet
            </p>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Browse the interactive floor plan to select and reserve your
              space.
            </p>
          </div>
        </div>
        <Link
          to={`/exhibitor/expos/${expoId}/floor-plan`}
          className="btn-secondary gap-2 self-start"
        >
          <LayoutGrid size={15} /> Reserve a Booth
        </Link>
      </motion.div>
    );
  }

  // Show ALL booths for this expo
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col gap-3 border-secondary/30 bg-secondary-container/10"
    >
      <div className="flex items-center gap-2">
        <LayoutGrid size={16} className="text-secondary" />
        <p className="text-body-sm font-semibold text-on-surface">
          {myBooths.length} Booth{myBooths.length > 1 ? "s" : ""} Assigned
        </p>
        <span className="badge badge-success">
          {myBooths.filter((b) => b.boothId?.status !== "pending").length}{" "}
          Confirmed
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {myBooths.map((myBooth, index) => {
          const boothData = myBooth.boothId || myBooth;

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-bright px-3 py-2 hover:shadow-sm transition-all duration-200 group"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary-container font-mono text-label-sm font-bold text-on-primary-container">
                {boothData?.boothNumber || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-medium text-on-surface">
                  Booth {boothData?.boothNumber}
                </p>
                <p className="font-mono text-label-sm text-on-surface-variant">
                  {boothData?.dimensions || "3m x 3m"} ·{" "}
                  {boothData?.status || "Assigned"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to={`/exhibitor/expos/${expoId}/floor-plan`}
                  className="btn-ghost btn-sm gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <LayoutGrid size={13} /> Map
                </Link>
                <button
                  onClick={() => onCancel(boothData?._id || myBooth.boothId)}
                  className="btn-ghost btn-sm gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-error hover:bg-error-container"
                  title="Cancel reservation"
                >
                  <XCircle size={13} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      <Link
        to={`/exhibitor/expos/${expoId}/floor-plan`}
        className="btn-ghost btn-sm gap-1 self-start group/link"
      >
        <LayoutGrid size={13} /> View All on Floor Plan
        <ChevronRight
          size={13}
          className="transition-transform group-hover/link:translate-x-0.5"
        />
      </Link>
    </motion.div>
  );
}

// ─── Expo Banner Hero ─────────────────────────────────────────────────────────
function ExpoBannerHero({ banner, title, status }) {
  if (banner?.url) {
    return (
      <div className="relative -mx-container-pad -mt-section-gap mb-6 h-48 sm:h-56 lg:h-64 overflow-hidden">
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
      </div>
    );
  }

  // Gradient placeholder
  return (
    <div className="relative -mx-container-pad -mt-section-gap mb-6 h-48 sm:h-56 lg:h-64 overflow-hidden bg-gradient-to-br from-primary via-primary/90 to-secondary/80">
      <div className="absolute inset-0 opacity-10">
        <div
          className="h-full w-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 25% 50%, rgba(255,255,255,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(255,255,255,0.1) 0%, transparent 50%)",
          }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      <div className="absolute bottom-4 left-container-pad">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {status === "ongoing" && (
            <span className="badge badge-success gap-1.5 shadow-lg backdrop-blur-sm bg-success/90 text-white">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-2 w-2 rounded-full bg-white"
              />
              Live Now
            </span>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExhibitorExpoDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [mutatingId, setMutatingId] = useState(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedBoothId, setSelectedBoothId] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // ── Fetch expo ──────────────────────────────────────────────────────────────
  const {
    data: expo,
    isLoading: expoLoading,
    isError,
  } = useQuery({
    queryKey: expoKey(id),
    queryFn: async () => {
      const { data } = await api.get(`/expos/${id}`);
      return data.data.expo;
    },
  });

  // ── Fetch sessions preview ──────────────────────────────────────────────────
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: sessionsKey(id),
    queryFn: async () => {
      const { data } = await api.get(`/sessions/expo/${id}?limit=4`);
      return data.data;
    },
    enabled: !!expo,
  });

  // ── Fetch exhibitor profile ─────────────────────────────────────────────────
  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: profileKey,
    queryFn: async () => {
      const { data } = await api.get("/exhibitors/profile/me");
      return data.data.profile;
    },
    staleTime: 0,
    refetchOnMount: true,
    retry: false,
  });

  // ── Fetch registrations + bookmarks ────────────────────────────────────────
  const { data: myReg = [] } = useQuery({
    queryKey: myRegKey,
    queryFn: async () => {
      const { data } = await api.get("/sessions/me/registrations");
      return data.data.sessions;
    },
  });

  const { data: myBmk = [] } = useQuery({
    queryKey: myBmkKey,
    queryFn: async () => {
      const { data } = await api.get("/sessions/me/bookmarks");
      return data.data.sessions;
    },
  });

  const registeredIds = useMemo(
    () => new Set(myReg.map((s) => s._id)),
    [myReg],
  );
  const bookmarkedIds = useMemo(
    () => new Set(myBmk.map((s) => s._id)),
    [myBmk],
  );

  // ── Mutations ────────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: (sid) => api.post(`/sessions/${sid}/register`),
    onSuccess: () => {
      toast.success("Registered for session.", { icon: "✅" });
      queryClient.invalidateQueries({ queryKey: myRegKey });
      setMutatingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to register.");
      setMutatingId(null);
    },
  });

  const unregisterMutation = useMutation({
    mutationFn: (sid) => api.delete(`/sessions/${sid}/register`),
    onSuccess: () => {
      toast.success("Registration cancelled.", { icon: "❌" });
      queryClient.invalidateQueries({ queryKey: myRegKey });
      setMutatingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed.");
      setMutatingId(null);
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: (sid) => api.post(`/sessions/${sid}/bookmark`),
    onSuccess: (res) => {
      toast.success(
        res.data.isBookmarked ? "Bookmarked! 🔖" : "Removed bookmark.",
      );
      queryClient.invalidateQueries({ queryKey: myBmkKey });
      setMutatingId(null);
    },
    onError: (err) => {
      toast.error(err.message || "Failed.");
      setMutatingId(null);
    },
  });

  const handleAction = (sid, action) => {
    setMutatingId(sid);
    if (action === "register") registerMutation.mutate(sid);
    if (action === "unregister") unregisterMutation.mutate(sid);
    if (action === "bookmark") bookmarkMutation.mutate(sid);
  };

  // ── Cancel booth handler ──────────────────────────────────────────────────────
  const { cancelBoothReservation } = useBooth();

  const handleCancelBooth = (boothId) => {
    if (!boothId) {
      toast.error("Cannot cancel: Booth ID not found.");
      return;
    }

    setSelectedBoothId(boothId);
    setCancelModalOpen(true);
  };

  const confirmCancelBooth = async () => {
    if (!selectedBoothId) return;

    try {
      setIsCancelling(true);

      await cancelBoothReservation.mutateAsync(selectedBoothId);
      await refetchProfile();

      toast.success("Booth reservation cancelled");
      setCancelModalOpen(false);
      setSelectedBoothId(null);
    } catch (error) {
      toast.error(error?.message || "Failed to cancel reservation");
    } finally {
      setIsCancelling(false);
    }
  };

  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="empty-state py-20"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="empty-state-icon text-error"
        >
          <AlertCircle size={28} />
        </motion.div>
        <h3 className="empty-state-title">Expo not found</h3>
        <Link to="/exhibitor/expos" className="btn-ghost btn-sm mt-3 gap-1.5">
          <ArrowLeft size={14} /> Browse Expos
        </Link>
      </motion.div>
    );
  }

  const sessions = sessionsData?.sessions || [];
  const daysUntil = expo
    ? differenceInDays(new Date(expo.startDate), new Date())
    : null;
  const isOngoing = expo?.status === "ongoing";

  // Format booth price for display
  const formattedBoothPrice = expo?.boothPrice > 0 
    ? `$${(expo.boothPrice / 100).toFixed(2)} ${expo.boothCurrency || 'USD'}` 
    : 'Free';

  return (
    <div className="flex flex-col">
      {/* ── Banner Hero ──────────────────────────────────────────── */}
      {!expoLoading && expo && (
        <ExpoBannerHero
          banner={expo.banner}
          title={expo.title}
          status={expo.status}
        />
      )}

      <div className="flex flex-col gap-8">
        {/* ── Back ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <Link
            to="/exhibitor/expos"
            className="btn-ghost btn-sm gap-1.5 self-start"
          >
            <ArrowLeft size={15} /> All Expos
          </Link>
        </motion.div>

        {/* ── Hero content ────────────────────────────────────────── */}
        {expoLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="skeleton h-4 rounded"
                style={{ width: `${(4 - i) * 20}%` }}
              />
            ))}
          </div>
        ) : (
          expo && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-center gap-2 flex-wrap">
                {isOngoing ? (
                  <span className="badge badge-success gap-1">
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="h-1.5 w-1.5 rounded-full bg-success"
                    />
                    Live Now
                  </span>
                ) : daysUntil !== null && daysUntil >= 0 ? (
                  <span className="badge badge-info">
                    {daysUntil === 0
                      ? "Starts today"
                      : `${daysUntil} days away`}
                  </span>
                ) : null}
                {expo.theme && (
                  <span className="badge badge-neutral font-mono text-label-sm">
                    {expo.theme}
                  </span>
                )}
              </div>

              <h1 className="text-headline-lg font-semibold text-on-surface flex items-center gap-2">
                <Sparkles size={20} className="text-secondary" />
                {expo.title}
              </h1>

              {expo.description && (
                <p className="text-body-md text-on-surface-variant leading-relaxed max-w-2xl">
                  {expo.description}
                </p>
              )}

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field
                  label="Start Date"
                  value={format(new Date(expo.startDate), "MMM d, yyyy")}
                  icon={CalendarDays}
                />
                <Field
                  label="End Date"
                  value={format(new Date(expo.endDate), "MMM d, yyyy")}
                  icon={CalendarDays}
                />
                <Field
                  label="Location"
                  value={
                    expo.address?.city
                      ? `${expo.address.city}, ${expo.address.country}`
                      : "—"
                  }
                  icon={MapPin}
                />
                <Field
                  label="Booth Price"
                  value={formattedBoothPrice}
                  icon={DollarSign}
                />
                <Field
                  label="Reg. Deadline"
                  value={
                    expo.registrationDeadline
                      ? format(
                          new Date(expo.registrationDeadline),
                          "MMM d, yyyy",
                        )
                      : "No deadline"
                  }
                  icon={Clock}
                />
              </div>

              {expo.tags?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag size={13} className="text-on-surface-variant" />
                  {expo.tags.map((tag, i) => (
                    <motion.span
                      key={tag}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="badge badge-neutral"
                    >
                      {tag}
                    </motion.span>
                  ))}
                </div>
              )}
            </motion.div>
          )
        )}

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Booth status */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <LayoutGrid size={16} className="text-secondary" />
                Your Booth
              </h2>
              <button
                onClick={() => refetchProfile()}
                className="btn-ghost btn-sm gap-1"
                title="Refresh booth status"
              >
                <RefreshCw
                  size={13}
                  className="transition-transform hover:rotate-180 duration-500"
                />
              </button>
            </div>
            <BoothStatusCard
              expoId={id}
              profile={profile}
              onCancel={handleCancelBooth}
            />
          </motion.section>

          {/* Sessions */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <BookOpen size={16} className="text-secondary" />
                Sessions
              </h2>
              <Link
                to={`/exhibitor/sessions`}
                className="btn-tertiary btn-sm gap-1 group/link"
              >
                All
                <ArrowRight
                  size={13}
                  className="transition-transform group-hover/link:translate-x-0.5"
                />
              </Link>
            </div>

            {sessionsLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="skeleton h-24 rounded-md" />
                ))}
              </div>
            ) : sessions.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card border-dashed border-2 py-8 text-center"
              >
                <motion.div
                  animate={{ y: [0, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                >
                  <BookOpen
                    size={24}
                    className="mx-auto text-on-surface-variant/30"
                  />
                </motion.div>
                <p className="text-body-sm text-on-surface-variant mt-2">
                  No sessions scheduled yet.
                </p>
              </motion.div>
            ) : (
              <div className="flex flex-col gap-3">
                {sessions.map((session) => (
                  <SessionCard
                    key={session._id}
                    session={session}
                    isRegistered={registeredIds.has(session._id)}
                    isBookmarked={bookmarkedIds.has(session._id)}
                    isMutating={mutatingId === session._id}
                    onRegister={() => handleAction(session._id, "register")}
                    onUnregister={() => handleAction(session._id, "unregister")}
                    onBookmark={() => handleAction(session._id, "bookmark")}
                  />
                ))}
              </div>
            )}
          </motion.section>
        </div>

        {/* ── Floor plan CTA ───────────────────────────────────────── */}
        {(expo?.status === "published" || expo?.status === "ongoing") && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Link
              to={`/exhibitor/expos/${id}/floor-plan`}
              className="card flex items-center justify-between gap-4
                         bg-primary-container border-primary/20 hover:shadow-level-2
                         transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  whileHover={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 0.3 }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary"
                >
                  <LayoutGrid size={18} className="text-on-primary" />
                </motion.div>
                <div>
                  <p className="text-body-sm font-semibold text-on-primary-container">
                    Interactive Floor Plan
                  </p>
                  <p className="font-mono text-label-sm text-on-primary-container/70">
                    Browse available booths and submit your reservation.
                  </p>
                </div>
              </div>
              <ArrowRight
                size={18}
                className="text-on-primary-container opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0"
              />
            </Link>
          </motion.div>
        )}
      </div>
      {cancelModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => {
            if (!isCancelling) {
              setCancelModalOpen(false);
              setSelectedBoothId(null);
            }
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-outline-variant bg-surface p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container">
                <XCircle size={24} className="text-on-error-container" />
              </div>

              <div className="flex-1">
                <h3 className="text-headline-sm font-semibold text-on-surface">
                  Cancel Booth Reservation?
                </h3>

                <p className="mt-2 text-body-sm text-on-surface-variant">
                  This will release your reserved booth and cannot be undone.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => {
                  setCancelModalOpen(false);
                  setSelectedBoothId(null);
                }}
                className="rounded-xl border border-outline-variant bg-surface px-4 py-2 text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
              >
                Keep Reservation
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={confirmCancelBooth}
                className="rounded-xl bg-error-container px-4 py-2 text-on-error-container shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling..." : "Cancel Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}