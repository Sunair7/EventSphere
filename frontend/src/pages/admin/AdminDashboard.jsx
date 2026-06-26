import { useMemo, useState, useRef, useEffect } from "react";
import { useInView } from "framer-motion"; // ← Add to existing framer-motion import
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import {
  Users,
  CalendarDays,
  Building2,
  LayoutGrid,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RefreshCw,
  Sparkles,
  Activity,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import api from "@/utils/api";
import { cn } from "@/utils/cn";

// ─── Query ────────────────────────────────────────────────────────────────────
const useDashboardOverview = () =>
  useQuery({
    queryKey: ["analytics", "dashboard"],
    queryFn: async () => {
      const { data } = await api.get("/analytics/dashboard");
      return data.data;
    },
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

// ─── Design tokens for charts ─────────────────────────────────────────────────
const COLORS = {
  primary: "#131b2e",
  secondary: "#006a61",
  tertiary: "#3980f4",
  warning: "#f59e0b",
  error: "#e11d48",
  success: "#059669",
  muted: "#e2e8f0",
};

// ─── Animated Counter (inline for this file) ──────────────────────────────────
function CountUp({ end, duration = 1.5, className = "" }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!inView || !end) return;
    let startTime;
    const startValue = 0;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      setDisplay(Math.floor(startValue + (end - startValue) * eased));

      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };

    requestAnimationFrame(step);
  }, [inView, end, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
    </span>
  );
}

// Need to add this import at top:


// ─── Skeleton components ──────────────────────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="card flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="skeleton h-9 w-9 rounded" />
        <div className="skeleton h-5 w-16 rounded-sm" />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="skeleton h-8 w-24 rounded" />
        <div className="skeleton h-4 w-32 rounded" />
      </div>
    </div>
  );
}

function ChartSkeleton({ height = 200 }) {
  return (
    <div className="flex items-center justify-center" style={{ height }}>
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="flex flex-col items-center gap-3"
      >
        <Activity size={24} className="text-on-surface-variant/30" />
        <span className="font-mono text-label-sm text-on-surface-variant/40">
          Loading chart data…
        </span>
      </motion.div>
    </div>
  );
}

function PipelineRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-density-high">
      <div className="flex items-center gap-3">
        <div className="skeleton h-6 w-16 rounded-sm" />
        <div className="skeleton h-4 w-24 rounded" />
      </div>
      <div className="skeleton h-6 w-10 rounded" />
    </div>
  );
}

// ─── Stat Card (Enhanced with pulse animation) ────────────────────────────────
function StatCard({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  value,
  sub,
  badge,
  badgeColor,
  delay = 0,
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.15 } }}
      className="card group flex flex-col gap-4 hover:shadow-level-2 transition-shadow duration-200 relative overflow-hidden"
    >
      {/* Subtle gradient highlight on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-secondary/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div className="flex items-start justify-between relative z-10">
        <motion.div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded",
            iconBg,
          )}
          whileHover={{ rotate: [0, -5, 5, 0], transition: { duration: 0.3 } }}
        >
          <Icon size={18} className={iconColor} />
        </motion.div>
        {badge !== undefined && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + 0.2, type: "spring", stiffness: 300 }}
            className={cn("badge font-mono", badgeColor)}
          >
            {badge}
          </motion.span>
        )}
      </div>

      <div className="flex flex-col gap-0.5 relative z-10">
        <p className="font-mono text-display-lg font-bold leading-none text-on-surface tabular-nums">
          {typeof value === "number" ? <CountUp end={value} /> : (value ?? "—")}
        </p>
        <p className="text-body-sm font-medium text-on-surface">{label}</p>
        {sub && (
          <p className="font-mono text-label-sm text-on-surface-variant">
            {sub}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, action, icon: Icon }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} className="text-secondary" />}
        <h2 className="text-headline-sm font-semibold text-on-surface">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, valueLabel = "Count" }) {
  if (!active || !payload?.length) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="card shadow-level-2 !p-3 min-w-[120px]"
    >
      <p className="font-mono text-label-sm text-on-surface-variant mb-1">
        {label}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          className="font-mono text-label-md font-semibold text-on-surface"
        >
          {entry.value}{" "}
          <span className="text-on-surface-variant font-normal">
            {valueLabel}
          </span>
        </p>
      ))}
    </motion.div>
  );
}

// ─── Application Pipeline Row ──────────────────────────────────────────────────
const PIPELINE_CONFIG = {
  pending: {
    label: "Pending Review",
    color: "badge-warning",
    dot: "bg-warning",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color: "badge-success",
    dot: "bg-success",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    color: "badge-error",
    dot: "bg-error",
    icon: XCircle,
  },
  suspended: {
    label: "Suspended",
    color: "badge-neutral",
    dot: "bg-outline",
    icon: Activity,
  },
};

function PipelineRow({ status, count, total }) {
  const cfg = PIPELINE_CONFIG[status] || {};
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center gap-4 py-density-high border-b border-outline-variant last:border-0 group hover:bg-surface-container-low/50 transition-colors rounded px-2 -mx-2"
    >
      <span
        className={cn("badge w-28 justify-center shrink-0 gap-1.5", cfg.color)}
      >
        {Icon && <Icon size={11} />}
        {cfg.label}
      </span>
      <div className="flex-1">
        <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.3 }}
            className={cn("h-full rounded-full relative", cfg.dot)}
          >
            {/* Shimmer effect on progress bar */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </div>
      </div>
      <span className="font-mono text-label-md font-semibold text-on-surface w-8 text-right shrink-0 tabular-nums">
        {count}
      </span>
      <span className="font-mono text-label-sm text-on-surface-variant w-8 text-right shrink-0 tabular-nums">
        {pct}%
      </span>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { data, isLoading, isError, refetch, isFetching } =
    useDashboardOverview();

  // ── Derived chart data ──────────────────────────────────────────────────────
  const registrationChartData = useMemo(() => {
    if (!data?.recentRegistrations) return [];
    return data.recentRegistrations.map((r) => ({
      date: format(parseISO(r.date), "MMM d"),
      count: r.count,
    }));
  }, [data]);

  const boothChartData = useMemo(() => {
    if (!data?.booths) return [];
    return [
      {
        name: "Available",
        value: data.booths.available,
        color: COLORS.secondary,
      },
      { name: "Pending", value: data.booths.pending, color: COLORS.warning },
      { name: "Assigned", value: data.booths.assigned, color: COLORS.primary },
    ].filter((d) => d.value > 0);
  }, [data]);

  const applicationTotal = useMemo(() => {
    if (!data?.applications) return 0;
    return Object.values(data.applications).reduce((s, v) => s + v, 0);
  }, [data]);

  // ── Error state ─────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="empty-state"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="empty-state-icon text-error"
        >
          <XCircle size={28} />
        </motion.div>
        <h2 className="empty-state-title">Failed to load dashboard</h2>
        <p className="empty-state-body mb-4">
          Unable to fetch analytics data. Please try again.
        </p>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => refetch()}
          className="btn-ghost btn-sm gap-2"
        >
          <RefreshCw size={14} /> Retry
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-section-gap">
      {/* ── Page header ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="page-header"
      >
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles size={20} className="text-secondary" />
            Logistics Command Overview
          </h1>
          <p className="page-subtitle">Platform-wide performance at a glance</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost btn-sm gap-2"
          aria-label="Refresh dashboard"
        >
          <RefreshCw
            size={14}
            className={cn(
              "transition-transform",
              isFetching && "animate-spin-slow",
            )}
          />
          {isFetching ? "Refreshing…" : "Refresh"}
        </motion.button>
      </motion.div>

      {/* ── KPI Stat Cards ───────────────────────────────────────────── */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <AnimatePresence mode="wait">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <StatCardSkeleton key={i} />
              ))
            ) : (
              <>
                <StatCard
                  icon={Users}
                  iconBg="bg-primary-container"
                  iconColor="text-on-primary-container"
                  label="Total Users"
                  value={data?.users?.total}
                  sub={`${data?.users?.admin ?? 0} admin · ${data?.users?.exhibitor ?? 0} exhibitors · ${data?.users?.attendee ?? 0} attendees`}
                  delay={0}
                />
                <StatCard
                  icon={CalendarDays}
                  iconBg="bg-secondary-container"
                  iconColor="text-on-secondary-container"
                  label="Total Expos"
                  value={data?.expos?.total}
                  badge={
                    data?.expos?.ongoing > 0
                      ? `${data.expos.ongoing} Live`
                      : undefined
                  }
                  badgeColor="badge-success"
                  sub={`${data?.expos?.published ?? 0} published · ${data?.expos?.draft ?? 0} draft`}
                  delay={0.05}
                />
                <StatCard
                  icon={LayoutGrid}
                  iconBg="bg-tertiary-container"
                  iconColor="text-on-tertiary-container"
                  label="Booths"
                  value={data?.booths?.total}
                  badge={
                    data?.booths?.occupancyRate !== undefined
                      ? `${data.booths.occupancyRate}%`
                      : undefined
                  }
                  badgeColor="badge-info"
                  sub={`${data?.booths?.assigned ?? 0} assigned · ${data?.booths?.pending ?? 0} pending`}
                  delay={0.1}
                />
                <StatCard
                  icon={Building2}
                  iconBg="bg-warning-container"
                  iconColor="text-on-warning-container"
                  label="Applications"
                  value={applicationTotal}
                  badge={
                    data?.applications?.pending > 0
                      ? `${data.applications.pending} Pending`
                      : undefined
                  }
                  badgeColor="badge-warning"
                  sub={`${data?.applications?.approved ?? 0} approved · ${data?.applications?.rejected ?? 0} rejected`}
                  delay={0.15}
                />
              </>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* ── Charts Row ───────────────────────────────────────────────── */}
      <section aria-label="Analytics charts">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Registration trend */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="card group"
          >
            <SectionHeader
              title="New Registrations (7 days)"
              icon={TrendingUp}
              action={
                <Link
                  to="/admin/users"
                  className="btn-tertiary btn-sm gap-1 group/link"
                >
                  All Users
                  <ArrowRight
                    size={13}
                    className="transition-transform group-hover/link:translate-x-0.5"
                  />
                </Link>
              }
            />
            {isLoading ? (
              <ChartSkeleton height={200} />
            ) : registrationChartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-body-sm text-on-surface-variant">
                No registration data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={registrationChartData}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="regGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor={COLORS.secondary}
                        stopOpacity={0.2}
                      />
                      <stop
                        offset="95%"
                        stopColor={COLORS.secondary}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{
                      fontSize: 11,
                      fontFamily: "JetBrains Mono",
                      fill: "#45464d",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fontSize: 11,
                      fontFamily: "JetBrains Mono",
                      fill: "#45464d",
                    }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<ChartTooltip valueLabel="users" />}
                    cursor={{ stroke: COLORS.muted, strokeWidth: 1 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={COLORS.secondary}
                    strokeWidth={2.5}
                    fill="url(#regGradient)"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: COLORS.secondary,
                      strokeWidth: 2,
                      stroke: "#fff",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Booth allocation bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.25 }}
            className="card"
          >
            <SectionHeader
              title="Booth Allocation"
              icon={LayoutGrid}
              action={
                <Link
                  to="/admin/expos"
                  className="btn-tertiary btn-sm gap-1 group/link"
                >
                  Manage Expos
                  <ArrowRight
                    size={13}
                    className="transition-transform group-hover/link:translate-x-0.5"
                  />
                </Link>
              }
            />
            {isLoading ? (
              <ChartSkeleton height={200} />
            ) : boothChartData.length === 0 ? (
              <div className="flex h-48 items-center justify-center text-body-sm text-on-surface-variant">
                No booth data available.
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart
                    data={boothChartData}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <XAxis
                      dataKey="name"
                      tick={{
                        fontSize: 11,
                        fontFamily: "JetBrains Mono",
                        fill: "#45464d",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{
                        fontSize: 11,
                        fontFamily: "JetBrains Mono",
                        fill: "#45464d",
                      }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltip valueLabel="booths" />}
                      cursor={{ fill: "#e5eeff" }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                      {boothChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Revenue summary with animation */}
                {data?.booths?.totalRevenue > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    transition={{ delay: 0.5 }}
                    className="mt-3 flex items-center justify-between rounded-lg bg-success-container/30 px-3 py-2.5 border border-success/10"
                  >
                    <span className="text-body-sm text-on-success-container flex items-center gap-1.5">
                      <Activity size={13} />
                      Projected revenue from assigned booths
                    </span>
                    <span className="font-mono text-label-md font-semibold text-on-success-container tabular-nums">
                      ${(data.booths.totalRevenue / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Bottom Row: Pipeline + Expo Summary ─────────────────────── */}
      <section aria-label="Application pipeline and expo summary">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Application pipeline */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="card"
          >
            <SectionHeader
              title="Application Pipeline"
              icon={CheckCircle2}
              action={
                <Link
                  to="/admin/exhibitors?status=pending"
                  className="btn-tertiary btn-sm gap-1 group/link"
                >
                  Review Queue
                  <ArrowRight
                    size={13}
                    className="transition-transform group-hover/link:translate-x-0.5"
                  />
                </Link>
              }
            />
            {isLoading ? (
              <div className="flex flex-col divide-y divide-outline-variant">
                {Array.from({ length: 4 }).map((_, i) => (
                  <PipelineRowSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div>
                {["pending", "approved", "rejected", "suspended"].map(
                  (status) => (
                    <PipelineRow
                      key={status}
                      status={status}
                      count={data?.applications?.[status] ?? 0}
                      total={applicationTotal}
                    />
                  ),
                )}
                {applicationTotal === 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-6 text-center text-body-sm text-on-surface-variant"
                  >
                    No applications yet.
                  </motion.p>
                )}
              </div>
            )}
          </motion.div>

          {/* Expo status summary */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.35 }}
            className="card"
          >
            <SectionHeader
              title="Expo Status Summary"
              icon={CalendarDays}
              action={
                <Link
                  to="/admin/expos/create"
                  className="btn-secondary btn-sm gap-1 group/link"
                >
                  New Expo
                  <ArrowRight
                    size={13}
                    className="transition-transform group-hover/link:translate-x-0.5"
                  />
                </Link>
              }
            />
            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 rounded" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {[
                  {
                    status: "ongoing",
                    label: "Live Now",
                    icon: TrendingUp,
                    color: "text-success",
                    bg: "bg-success-container/30",
                    dot: "bg-success",
                  },
                  {
                    status: "published",
                    label: "Published",
                    icon: CheckCircle2,
                    color: "text-tertiary",
                    bg: "bg-tertiary-container/30",
                    dot: "bg-tertiary",
                  },
                  {
                    status: "draft",
                    label: "Draft",
                    icon: Clock,
                    color: "text-on-surface-variant",
                    bg: "bg-surface-container",
                    dot: "bg-on-surface-variant",
                  },
                  {
                    status: "completed",
                    label: "Completed",
                    icon: CheckCircle2,
                    color: "text-secondary",
                    bg: "bg-secondary-container/30",
                    dot: "bg-secondary",
                  },
                  {
                    status: "cancelled",
                    label: "Cancelled",
                    icon: XCircle,
                    color: "text-error",
                    bg: "bg-error-container/30",
                    dot: "bg-error",
                  },
                ].map(({ status, label, icon: Icon, color, bg, dot }, i) => {
                  const count = data?.expos?.[status] ?? 0;
                  return (
                    <motion.div
                      key={status}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.05 }}
                    >
                      <Link
                        to={`/admin/expos?status=${status}`}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5
                                   hover:bg-surface-container-low transition-all duration-200 group/item"
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 relative",
                            bg,
                          )}
                        >
                          {/* Live pulse dot */}
                          {status === "ongoing" && (
                            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
                            </span>
                          )}
                          <Icon size={15} className={color} />
                        </div>
                        <span className="flex-1 text-body-sm font-medium text-on-surface">
                          {label}
                        </span>
                        <span className="font-mono text-label-md font-semibold text-on-surface tabular-nums">
                          {count}
                        </span>
                        <motion.div
                          initial={{ opacity: 0, x: -5 }}
                          whileHover={{ opacity: 1, x: 0 }}
                          className="opacity-0 group-hover/item:opacity-100 transition-opacity"
                        >
                          <ArrowRight
                            size={14}
                            className="text-on-surface-variant"
                          />
                        </motion.div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>
      </section>
    </div>
  );
}
