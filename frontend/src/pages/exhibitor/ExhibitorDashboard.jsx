import { useMemo, useRef, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import {
  Building2,
  LayoutGrid,
  BookOpen,
  MessageSquare,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  FileText,
  Compass,
  ChevronRight,
  User,
  Ban,
  Sparkles,
  Star,
  Mic2,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { format, isPast, isFuture } from "date-fns";
import toast from "react-hot-toast";
import api from "@/utils/api";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/utils/cn";
import { useBooth } from "@/hooks/useBooth";
import FeedbackStars from "@/components/feedback/FeedbackStars"; // Adjust import path as needed

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

// ─── Query hooks ──────────────────────────────────────────────────────────────
const useMyProfile = () =>
  useQuery({
    queryKey: ["exhibitor", "profile", "me"],
    queryFn: async () => {
      const { data } = await api.get("/exhibitors/profile/me");
      return data.data.profile;
    },
    retry: false,
    staleTime: 0,
    refetchOnMount: true,
  });

const useMyRegistrations = () =>
  useQuery({
    queryKey: ["sessions", "me", "registrations"],
    queryFn: async () => {
      const { data } = await api.get("/sessions/me/registrations");
      return data.data.sessions;
    },
  });

// ─── Skeleton components ──────────────────────────────────────────────────────
function CardSkeleton({ className }) {
  return (
    <div className={cn("skeleton rounded-md", className)}>
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="h-full w-full"
      />
    </div>
  );
}

// ─── Status config ────────────────────────────────────────────────────────────
const APPLICATION_STATUS = {
  pending: {
    icon: Clock,
    iconBg: "bg-warning-container",
    iconFg: "text-on-warning-container",
    badge: "badge-warning",
    title: "Application Pending",
    body: "Your exhibitor application is under review. You'll be notified once a decision is made.",
    cta: null,
    pulse: true,
  },
  approved: {
    icon: CheckCircle2,
    iconBg: "bg-success-container",
    iconFg: "text-on-success-container",
    badge: "badge-success",
    title: "Application Approved",
    body: "Your application has been approved. You can now browse expos and reserve booth spaces.",
    cta: { label: "Browse Expos", to: "/exhibitor/expos" },
  },
  rejected: {
    icon: XCircle,
    iconBg: "bg-error-container",
    iconFg: "text-on-error-container",
    badge: "badge-error",
    title: "Application Not Approved",
    body: "Your application was not approved. Update your profile with the requested changes and resubmit.",
    cta: { label: "Update Profile", to: "/exhibitor/profile" },
  },
  suspended: {
    icon: Ban,
    iconBg: "bg-error-container",
    iconFg: "text-on-error-container",
    badge: "badge-error",
    title: "Account Suspended",
    body: "Your account has been suspended. Please contact the event organiser for assistance.",
    cta: { label: "Contact via Messages", to: "/exhibitor/messages" },
  },
};

// ─── Profile status card ──────────────────────────────────────────────────────
function ApplicationStatusCard({ profile, isLoading }) {
  if (isLoading) return <CardSkeleton className="h-36" />;

  if (!profile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="card border-2 border-dashed border-outline-variant hover:border-secondary/30 transition-all duration-300"
      >
        <div className="flex items-start gap-4">
          <motion.div
            whileHover={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 0.3 }}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-container"
          >
            <User size={18} className="text-on-primary-container" />
          </motion.div>
          <div className="flex-1">
            <h3 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
              Complete your profile{" "}
              <Sparkles size={14} className="text-secondary" />
            </h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Set up your company profile to start applying for booth spaces at
              upcoming expos.
            </p>
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-block mt-3"
            >
              <Link
                to="/exhibitor/profile"
                className="btn-secondary btn-sm gap-1.5 inline-flex"
              >
                <Building2 size={14} /> Create profile
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.div>
    );
  }

  const cfg =
    APPLICATION_STATUS[profile.applicationStatus] || APPLICATION_STATUS.pending;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="card hover:shadow-level-2 transition-shadow duration-200"
    >
      <div className="flex items-start gap-4">
        <motion.div
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg relative",
            cfg.iconBg,
          )}
        >
          <Icon size={18} className={cfg.iconFg} />
          {cfg.pulse && (
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warning" />
            </span>
          )}
        </motion.div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-headline-sm font-semibold text-on-surface">
              {cfg.title}
            </h3>
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
              className={cn("badge", cfg.badge)}
            >
              {profile.applicationStatus}
            </motion.span>
            {profile.isVerified && (
              <motion.span
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-1 font-mono text-label-sm text-secondary"
              >
                <ShieldCheck size={13} /> Verified
              </motion.span>
            )}
          </div>
          <p className="mt-1 text-body-sm text-on-surface-variant">
            {cfg.body}
          </p>
          {profile.applicationNote && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-2 rounded-lg bg-surface-container px-3 py-2 border border-outline-variant"
            >
              <p className="font-mono text-label-sm text-on-surface-variant">
                Organiser note:{" "}
                <span className="text-on-surface">
                  {profile.applicationNote}
                </span>
              </p>
            </motion.div>
          )}
          {cfg.cta && (
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="inline-block mt-3"
            >
              <Link
                to={cfg.cta.to}
                className="btn-secondary btn-sm gap-1.5 inline-flex"
              >
                {cfg.cta.label} <ArrowRight size={13} />
              </Link>
            </motion.div>
          )}
        </div>
        <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <Link
            to="/exhibitor/profile"
            className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            title="Edit profile"
          >
            <ChevronRight size={16} />
          </Link>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconFg, label, value, to, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -3 }}
    >
      <Link
        to={to}
        className="card flex items-center gap-4 hover:shadow-level-2 transition-all duration-200 group block relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-secondary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <motion.div
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.3 }}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg relative z-10",
            iconBg,
          )}
        >
          <Icon size={18} className={iconFg} />
        </motion.div>
        <div className="flex-1 min-w-0 relative z-10">
          <p className="font-mono text-headline-sm font-bold text-on-surface">
            <CountUp end={value} />
          </p>
          <p className="text-body-sm text-on-surface-variant">{label}</p>
        </div>
        <ArrowRight
          size={15}
          className="text-on-surface-variant opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0 relative z-10"
        />
      </Link>
    </motion.div>
  );
}

// ─── Assigned booth card ──────────────────────────────────────────────────────
function AssignedBoothCard({ booth, index, onCancel }) {
  const boothData = booth.boothId || booth;
  const expoData = booth.expoId || booth.expo;

  if (!boothData) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.05 }}
        className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-bright px-4 py-3 opacity-60"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-container font-mono text-label-md text-on-surface-variant">
          ?
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-on-surface line-clamp-1">
            {expoData?.title ?? "Unknown Expo"}
          </p>
          <p className="font-mono text-label-sm text-on-surface-variant">
            Booth details loading...
          </p>
        </div>
      </motion.div>
    );
  }

  const expoId = expoData?._id || booth.expoId;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ x: 3 }}
      className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-bright px-4 py-3 hover:shadow-sm hover:border-secondary/30 transition-all duration-200 group"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          delay: index * 0.05 + 0.1,
        }}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary-container font-mono text-label-md font-bold text-on-primary-container"
      >
        {boothData?.boothNumber ?? "—"}
      </motion.div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-medium text-on-surface line-clamp-1">
          {expoData?.title ?? "Expo"}
        </p>
        <p className="font-mono text-label-sm text-on-surface-variant">
          {boothData?.dimensions ?? "3m x 3m"} ·{" "}
          {boothData?.status ?? "Assigned"}
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
          onClick={() => onCancel(boothData?._id || booth.boothId)}
          className="btn-ghost btn-sm gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-error hover:bg-error-container"
          title="Cancel reservation"
        >
          <XCircle size={13} />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ session, index }) {
  const isLive = session.status === "live";
  const past = isPast(new Date(session.endTime));

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ x: 3 }}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-4 py-3 transition-all duration-200",
        isLive
          ? "border-success bg-success-container/20 hover:shadow-sm"
          : "border-outline-variant bg-surface-bright hover:shadow-sm hover:border-secondary/30",
      )}
    >
      <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[48px]">
        <span className="font-mono text-label-sm text-on-surface-variant">
          {format(new Date(session.startTime), "MMM d")}
        </span>
        <span className="font-mono text-label-md font-semibold text-on-surface">
          {format(new Date(session.startTime), "HH:mm")}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-body-sm font-medium text-on-surface line-clamp-1">
            {session.title}
          </p>
          {isLive && (
            <span className="badge badge-success gap-1">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full bg-success"
              />
              Live
            </span>
          )}
          {past && !isLive && (
            <span className="badge badge-neutral">Ended</span>
          )}
        </div>
        <p className="font-mono text-label-sm text-on-surface-variant line-clamp-1">
          {session.location} · {session.format}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Quick action ─────────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, to, description, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Link
        to={to}
        className="card flex items-start gap-3 hover:shadow-level-2 transition-all duration-200 group hover:border-secondary/20"
      >
        <motion.div
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.3 }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container group-hover:bg-secondary-container/30 transition-colors duration-200"
        >
          <Icon
            size={16}
            className="text-on-surface-variant group-hover:text-secondary transition-colors"
          />
        </motion.div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-on-surface group-hover:text-secondary transition-colors">
            {label}
          </p>
          <p className="font-mono text-label-sm text-on-surface-variant line-clamp-1">
            {description}
          </p>
        </div>
        <ArrowRight
          size={14}
          className="shrink-0 text-on-surface-variant opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all mt-0.5"
        />
      </Link>
    </motion.div>
  );
}

// ─── Feedback item card ───────────────────────────────────────────────────────
function FeedbackItem({ feedback }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 3 }}
      className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-bright px-4 py-3 hover:shadow-sm hover:border-secondary/30 transition-all duration-200"
    >
      <FeedbackStars rating={feedback.rating} size="sm" readonly />
      <p className="text-body-sm text-on-surface flex-1 line-clamp-1">
        {feedback.comment || "No comment provided."}
      </p>
      <span className="font-mono text-label-sm text-on-surface-variant shrink-0">
        {feedback.sessionId?.title || "Session"}
      </span>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExhibitorDashboard() {
  const { user } = useAuth();
  const {
    data: profile,
    isLoading: profileLoading,
    refetch: refetchProfile,
  } = useMyProfile();
  const { data: sessions = [], isLoading: sessionsLoading } =
    useMyRegistrations();
  const { cancelBoothReservation } = useBooth();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [selectedBoothId, setSelectedBoothId] = useState(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // Inside the component, add this useEffect:
  const queryClient = useQueryClient();

  // useEffect(() => {
  //   // Clear cache on mount to prevent stale data
  //   queryClient.removeQueries({ queryKey: ["exhibitor", "profile", "me"] });
  //   queryClient.removeQueries({ queryKey: ["feedback", "exhibitor", "stats"] });
  // }, []);

  // Fetch sessions where the exhibitor is a speaker
  const { data: speakingSessions = [] } = useQuery({
    queryKey: ["sessions", "me", "speaking"],
    queryFn: async () => {
      const { data } = await api.get("/sessions/me/speaking");
      return data.data.sessions;
    },
    enabled: !!user?._id,
  });

  // Fetch exhibitor feedback stats
  const { data: exhibitorFeedbackData } = useQuery({
    queryKey: ["feedback", "exhibitor", "stats"],
    queryFn: async () => {
      const { data } = await api.get(
        "/feedback/exhibitor/sessions?status=approved&limit=100",
      );
      return data.data;
    },
    enabled: !!user?._id,
  });

  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter((s) => isFuture(new Date(s.endTime)) || s.status === "live")
        .slice(0, 4),
    [sessions],
  );

  // Calculate feedback stats
  const feedbackStats = useMemo(() => {
    const allFeedback = exhibitorFeedbackData?.feedback || [];
    if (allFeedback.length === 0) return null;

    const total = allFeedback.length;
    const avg = allFeedback.reduce((sum, f) => sum + f.rating, 0) / total;
    const distribution = {};
    allFeedback.forEach((f) => {
      distribution[f.rating] = (distribution[f.rating] || 0) + 1;
    });

    return { total, average: avg.toFixed(1), distribution };
  }, [exhibitorFeedbackData]);

  // Get assigned booths from profile
  const assignedBooths = (profile?.assignedBooths || []).filter(
    (booth) => booth.boothId !== null && booth.boothId !== undefined,
  );

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

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12
      ? "Good morning"
      : greetingHour < 18
        ? "Good afternoon"
        : "Good evening";

  return (
    <div className="flex flex-col gap-section-gap">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-1"
      >
        <h1 className="text-headline-lg font-semibold text-on-surface flex items-center gap-2">
          <Sparkles size={22} className="text-secondary" />
          {greeting}, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Here's your exhibitor portal overview.
        </p>
      </motion.div>

      <ApplicationStatusCard profile={profile} isLoading={profileLoading} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          icon={LayoutGrid}
          iconBg="bg-primary-container"
          iconFg="text-on-primary-container"
          label="Assigned Booths"
          value={assignedBooths.length}
          to="/exhibitor/expos"
          delay={0}
        />
        <StatCard
          icon={BookOpen}
          iconBg="bg-secondary-container"
          iconFg="text-on-secondary-container"
          label="Registered Sessions"
          value={sessions.length}
          to="/exhibitor/sessions"
          delay={0.05}
        />
        <StatCard
          icon={FileText}
          iconBg="bg-tertiary-container"
          iconFg="text-on-tertiary-container"
          label="Documents Uploaded"
          value={profile?.documents?.length ?? 0}
          to="/exhibitor/profile"
          delay={0.1}
        />
        {feedbackStats && (
          <StatCard
            icon={Star}
            iconBg="bg-warning-container"
            iconFg="text-on-warning-container"
            label="Average Rating"
            value={parseFloat(feedbackStats.average)}
            to="/exhibitor/sessions"
            delay={0.15}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
              <LayoutGrid size={16} className="text-secondary" />
              Your Booths
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetchProfile()}
                className="btn-ghost btn-sm gap-1"
                title="Refresh booths"
              >
                <RefreshCw
                  size={13}
                  className="transition-transform hover:rotate-180 duration-500"
                />
              </button>
              <Link
                to="/exhibitor/expos"
                className="btn-tertiary btn-sm gap-1 group/link"
              >
                Browse Expos
                <ArrowRight
                  size={13}
                  className="transition-transform group-hover/link:translate-x-0.5"
                />
              </Link>
            </div>
          </div>
          {profileLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <CardSkeleton key={i} className="h-16" />
              ))}
            </div>
          ) : assignedBooths.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card border-dashed border-2 text-center py-10 hover:border-secondary/30 transition-all"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut",
                }}
                className="empty-state-icon mx-auto mb-3"
              >
                <LayoutGrid size={22} />
              </motion.div>
              <p className="text-body-sm font-medium text-on-surface">
                No booths assigned yet
              </p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Browse expos and reserve a booth space to get started.
              </p>
              {profile?.applicationStatus === "approved" && (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-block mt-4"
                >
                  <Link
                    to="/exhibitor/expos"
                    className="btn-secondary btn-sm inline-flex gap-1"
                  >
                    <Compass size={14} /> Find an Expo
                  </Link>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              {assignedBooths.slice(0, 4).map((booth, i) => (
                <AssignedBoothCard
                  key={i}
                  booth={booth}
                  index={i}
                  onCancel={handleCancelBooth}
                />
              ))}
              {assignedBooths.length > 4 && (
                <Link
                  to="/exhibitor/expos"
                  className="text-center py-2 text-body-sm text-tertiary hover:text-secondary transition-colors font-medium"
                >
                  View all {assignedBooths.length} booths →
                </Link>
              )}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
              <BookOpen size={16} className="text-secondary" />
              Upcoming Sessions
            </h2>
            <Link
              to="/exhibitor/sessions"
              className="btn-tertiary btn-sm gap-1 group/link"
            >
              All Sessions
              <ArrowRight
                size={13}
                className="transition-transform group-hover/link:translate-x-0.5"
              />
            </Link>
          </div>
          {sessionsLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} className="h-16" />
              ))}
            </div>
          ) : upcomingSessions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card border-dashed border-2 text-center py-10 hover:border-secondary/30 transition-all"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{
                  repeat: Infinity,
                  duration: 3,
                  ease: "easeInOut",
                }}
                className="empty-state-icon mx-auto mb-3"
              >
                <BookOpen size={22} />
              </motion.div>
              <p className="text-body-sm font-medium text-on-surface">
                No upcoming sessions
              </p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Register for sessions to add them to your schedule.
              </p>
            </motion.div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingSessions.map((session, i) => (
                <SessionCard key={session._id} session={session} index={i} />
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* My Speaking Sessions - Full Width */}
      {speakingSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          className="flex flex-col gap-3"
        >
          <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
            <Mic2 size={16} className="text-secondary" />
            My Speaking Sessions
          </h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {speakingSessions.slice(0, 4).map((session, i) => (
              <SessionCard key={session._id} session={session} index={i} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Feedback */}
      {exhibitorFeedbackData?.feedback?.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
              <Star size={16} className="text-warning fill-warning" />
              Recent Feedback
            </h2>
            <Link
              to="/exhibitor/sessions"
              className="btn-tertiary btn-sm gap-1 group/link"
            >
              View All
              <ArrowRight
                size={13}
                className="transition-transform group-hover/link:translate-x-0.5"
              />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {exhibitorFeedbackData.feedback.slice(0, 3).map((item) => (
              <FeedbackItem key={item._id} feedback={item} />
            ))}
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        <h2 className="mb-3 text-headline-sm font-semibold text-on-surface flex items-center gap-2">
          <Star size={16} className="text-secondary" />
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            icon={Building2}
            label="My Profile"
            description="Update company info and documents"
            to="/exhibitor/profile"
            delay={0.3}
          />
          <QuickAction
            icon={Compass}
            label="Browse Expos"
            description="Find and apply for upcoming events"
            to="/exhibitor/expos"
            delay={0.35}
          />
          <QuickAction
            icon={BookOpen}
            label="Sessions"
            description="Register for talks and workshops"
            to="/exhibitor/sessions"
            delay={0.4}
          />
          <QuickAction
            icon={MessageSquare}
            label="Messages"
            description="Chat with organisers and exhibitors"
            to="/exhibitor/messages"
            delay={0.45}
          />
        </div>
      </motion.div>

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
                className="
      rounded-xl
      border border-outline-variant
      bg-surface
      px-4 py-2
      text-on-surface
      transition-colors
      hover:bg-surface-container
      disabled:opacity-50
    "
              >
                Keep Reservation
              </button>

              <button
                type="button"
                disabled={isCancelling}
                onClick={confirmCancelBooth}
                className="
      rounded-xl
      bg-error-container
      px-4 py-2
      text-on-error-container
      shadow-sm
      transition-all
      hover:opacity-90
      disabled:opacity-50
    "
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
