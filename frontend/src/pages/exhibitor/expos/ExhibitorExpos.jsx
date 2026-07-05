import { useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Compass,
  MapPin,
  CalendarDays,
  LayoutGrid,
  BookOpen,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Image,
  Sparkles,
  Users,
  Tag,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import api from "@/utils/api";
import { cn } from "@/utils/cn";

// ─── Query keys ───────────────────────────────────────────────────────────────
const expoKeys = {
  list: (p) => ["expos", "exhibitor", "list", p],
  boothAvailability: (id) => ["booths", "expo", id, "availability"],
};

// ─── Status tabs ──────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { value: "", label: "All Events" },
  { value: "ongoing", label: "🔴 Live Now" },
  { value: "published", label: "Open for Applications" },
  { value: "completed", label: "Past" },
];

// ─── Skeleton ────────────────────────────────────────────────────────────────
function ExpoCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3 overflow-hidden">
      <div className="skeleton h-40 -mx-6 -mt-6 rounded-b-none" />
      <div className="flex items-start justify-between">
        <div className="skeleton h-5 w-16 rounded-sm" />
        <div className="skeleton h-4 w-24 rounded" />
      </div>
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
      <div className="grid grid-cols-3 gap-2 mt-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-12 rounded" />
        ))}
      </div>
      <div className="skeleton h-9 w-full rounded mt-1" />
    </div>
  );
}

// ─── Booth availability mini-summary ─────────────────────────────────────────
function BoothSummary({ expoId }) {
  const { data, isLoading } = useQuery({
    queryKey: expoKeys.boothAvailability(expoId),
    queryFn: async () => {
      const { data } = await api.get(`/booths/expo/${expoId}/availability`);
      return data.data;
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-12 rounded" />
        ))}
      </div>
    );
  }

  const available = data?.available ?? 0;
  const pending = data?.pending ?? 0;
  const assigned = data?.assigned ?? 0;
  const total = data?.total ?? available + pending + assigned;

  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        {
          label: "Available",
          count: available,
          color: "text-secondary",
          bg: "bg-secondary-container/40",
        },
        {
          label: "Pending",
          count: pending,
          color: "text-on-warning-container",
          bg: "bg-warning-container/40",
        },
        {
          label: "Assigned",
          count: assigned,
          color: "text-on-surface-variant",
          bg: "bg-surface-container",
        },
      ].map(({ label, count, color, bg }) => (
        <div key={label} className={cn("rounded-lg px-2 py-2 text-center", bg)}>
          <p className={cn("font-mono text-headline-sm font-bold", color)}>
            {count}
          </p>
          <p className="font-mono text-label-sm text-on-surface-variant">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ─── Expo Banner ──────────────────────────────────────────────────────────────
function ExpoBanner({ banner, title, status, theme }) {
  if (banner?.url) {
    return (
      <div className="relative -mx-6 -mt-6 mb-4 h-40 overflow-hidden rounded-t-xl">
        <img
          src={banner.url}
          alt={banner.altText || title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Status badge overlay */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
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
          {status === "completed" && (
            <span className="badge badge-neutral shadow-lg backdrop-blur-sm bg-black/50 text-white">
              Ended
            </span>
          )}
        </div>

        {/* Theme tag */}
        {theme && (
          <div className="absolute bottom-3 left-3">
            <span className="badge bg-white/20 text-white backdrop-blur-sm border border-white/20 text-label-sm">
              {theme}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Placeholder banner
  return (
    <div className={cn(
      "relative -mx-6 -mt-6 mb-4 h-40 overflow-hidden rounded-t-xl",
      "bg-gradient-to-br from-primary/10 via-surface-container-low to-secondary/10",
      "flex items-center justify-center"
    )}>
      <Image size={32} className="text-on-surface-variant/20" />
      
      {/* Status badge */}
      <div className="absolute top-3 left-3">
        {status === "ongoing" && (
          <span className="badge badge-success gap-1.5">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="h-2 w-2 rounded-full bg-success"
            />
            Live Now
          </span>
        )}
        {status === "completed" && (
          <span className="badge badge-neutral">Ended</span>
        )}
      </div>

      {theme && (
        <div className="absolute bottom-3 left-3">
          <span className="badge badge-neutral text-label-sm">
            {theme}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Expo card ────────────────────────────────────────────────────────────────
function ExpoCard({ expo, index }) {
  const isOngoing = expo.status === "ongoing";
  const isCompleted = expo.status === "completed";
  const startDate = new Date(expo.startDate);
  const endDate = new Date(expo.endDate);
  const daysUntil = differenceInDays(startDate, new Date());
  const isOpen = expo.status === "published" || isOngoing;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
      whileHover={!isCompleted ? { y: -4, transition: { duration: 0.2 } } : {}}
      className={cn(
        "card flex flex-col gap-3 hover:shadow-level-2 transition-all duration-300 group overflow-hidden",
        isCompleted && "opacity-60 hover:opacity-70 border-outline-variant/50",
        isOngoing && "ring-1 ring-success/20",
      )}
    >
      {/* Banner */}
      <ExpoBanner
        banner={expo.banner}
        title={expo.title}
        status={expo.status}
        theme={expo.theme}
      />

      {/* Status badge (if not shown on banner for published) */}
      {!isOngoing && !isCompleted && (
        <div className="flex items-center gap-2 flex-wrap">
          {daysUntil >= 0 ? (
            <span className="badge badge-info">
              {daysUntil === 0
                ? "Starts Today"
                : daysUntil === 1
                  ? "Starts Tomorrow"
                  : `Starts in ${daysUntil} days`}
            </span>
          ) : null}

          {isOpen && expo.registrationDeadline && (
            <span className="flex items-center gap-1 font-mono text-label-sm text-warning">
              <Clock size={11} />
              Deadline: {format(new Date(expo.registrationDeadline), "MMM d")}
            </span>
          )}
        </div>
      )}

      {/* Title */}
      <h3 className={cn(
        "text-body-md font-semibold line-clamp-2 leading-snug transition-colors",
        isCompleted 
          ? "text-on-surface-variant" 
          : "text-on-surface group-hover:text-secondary"
      )}>
        {expo.title}
      </h3>

      {/* Location + date */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          <MapPin size={13} className="shrink-0" />
          <span className="line-clamp-1">
            {expo.address?.venue
              ? `${expo.address.venue}, ${expo.address.city}`
              : `${expo.address?.city}, ${expo.address?.country}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <CalendarDays size={12} className="shrink-0" />
          <span>
            {format(startDate, "MMM d")} — {format(endDate, "MMM d, yyyy")}
          </span>
          {isCompleted && (
            <span className="ml-1.5 badge badge-neutral text-label-sm">
              Ended
            </span>
          )}
        </div>
      </div>

      {/* Booth availability summary - only show for active expos */}
      {isOpen && <BoothSummary expoId={expo._id} />}

      {/* Sessions count - for completed expos */}
      {!isOpen && (
        <div className="flex items-center gap-3 font-mono text-label-sm text-on-surface-variant">
          <div className="flex items-center gap-1">
            <BookOpen size={12} />
            <span>{expo.sessionCount ?? 0} sessions</span>
          </div>
          <div className="flex items-center gap-1">
            <LayoutGrid size={12} />
            <span>{expo.boothCount ?? 0} booths</span>
          </div>
          {expo.attendeeCount > 0 && (
            <div className="flex items-center gap-1">
              <Users size={12} />
              <span>{expo.attendeeCount.toLocaleString()} attendees</span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {expo.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {expo.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="badge badge-neutral text-label-sm">
              {tag}
            </span>
          ))}
          {expo.tags.length > 3 && (
            <span className="badge badge-neutral text-label-sm">
              +{expo.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* CTA */}
      <motion.div
        whileHover={!isCompleted ? { scale: 1.01 } : {}}
        whileTap={!isCompleted ? { scale: 0.99 } : {}}
        className="mt-auto"
      >
        {isCompleted ? (
          <div className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant 
                          bg-surface-container px-4 py-2 text-body-sm font-medium text-on-surface-variant cursor-not-allowed">
            <Clock size={14} />
            Event Ended
          </div>
        ) : (
          <Link
            to={`/exhibitor/expos/${expo._id}`}
            className={cn(
              "btn gap-2 w-full justify-center transition-all duration-200",
              isOpen
                ? "btn-secondary group/btn"
                : "btn-ghost",
            )}
          >
            {isOpen ? (
              <>
                <LayoutGrid size={15} />
                View Details & Apply
                <ArrowRight size={14} className="transition-transform group-hover/btn:translate-x-1" />
              </>
            ) : (
              <>
                View Details <ArrowRight size={13} />
              </>
            )}
          </Link>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExhibitorExpos() {
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get("page") || "1", 10);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const LIMIT = 9;

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

  // ── Fetch expos ─────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: expoKeys.list({ page, search, status, limit: LIMIT }),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        sort: status === "completed" ? "start-desc" : "start-asc",
      });
      if (search) params.set("search", search);
      
      // ✅ Status handling: Only show completed when on Past tab
      if (status === "completed") {
        params.set("status", "completed");
      } else if (status === "ongoing") {
        params.set("status", "ongoing");
      } else if (status === "published") {
        params.set("status", "published");
      } else {
        // All Events - show published and ongoing (exclude completed)
        params.set("status", "published,ongoing");
      }
      
      const { data } = await api.get(`/expos?${params}`);
      return data.data;
    },
    keepPreviousData: true,
  });

  const expos = data?.expos || [];
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
            Browse Expos
          </h1>
          <p className="page-subtitle">
            Find expos with available booth spaces and submit your application.
          </p>
        </div>
      </motion.div>

      {/* ── Application tip ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-start gap-3 rounded-lg bg-primary-container px-4 py-3 border border-primary/10"
      >
        <CheckCircle2
          size={16}
          className="shrink-0 mt-0.5 text-on-primary-container"
        />
        <p className="text-body-sm text-on-primary-container">
          Your exhibitor application must be{" "}
          <span className="font-semibold">approved</span> before you can reserve
          a booth. Each expo card shows live booth availability. Select an {" "}
          <span className="font-semibold">Expo</span> then go to the {" "}
          <span className="font-semibold">Interactive Floor Plan</span> to
          select your space.
        </p>
      </motion.div>

      {/* ── Status tabs ──────────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <motion.button
            key={tab.value}
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
            onClick={() => setParam("status", tab.value)}
            className={cn(
              "relative rounded-lg px-3 py-1.5 text-body-sm font-medium transition-all duration-200",
              status === tab.value
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            )}
          >
            {tab.label}
            {status === tab.value && (
              <motion.span
                layoutId="exhibitor-expo-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-t"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <div className="relative max-w-md">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          type="search"
          placeholder="Search expos by name or theme…"
          value={search}
          onChange={(e) => setParam("search", e.target.value)}
          className="input pl-9 pr-8"
        />
        {search && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setParam("search", "")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            aria-label="Clear search"
          >
            <X size={14} />
          </motion.button>
        )}
      </div>

      {/* ── Grid ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ExpoCardSkeleton key={i} />
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
          <h3 className="empty-state-title">Failed to load expos</h3>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => refetch()}
            className="btn-ghost btn-sm mt-3 gap-1"
          >
            <RefreshCw size={13} /> Retry
          </motion.button>
        </motion.div>
      ) : expos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="empty-state py-16"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="empty-state-icon"
          >
            <Compass size={28} />
          </motion.div>
          <h3 className="empty-state-title">No expos found</h3>
          <p className="empty-state-body">
            {search || status
              ? "Try adjusting your search or filters."
              : "No upcoming expos are currently accepting applications."}
          </p>
          {(search || status) && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setParam("search", "");
                setParam("status", "");
              }}
              className="btn-ghost btn-sm mt-3 gap-1"
            >
              <X size={13} /> Clear filters
            </motion.button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {expos.map((expo, i) => (
              <ExpoCard key={expo._id} expo={expo} index={i} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* ── Pagination ───────────────────────────────────────────── */}
      {!isLoading && pagination.totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between"
        >
          <p className="font-mono text-label-sm text-on-surface-variant">
            Page {pagination.page} of {pagination.totalPages} ·{" "}
            {pagination.total.toLocaleString()} expos
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
    </div>
  );
}