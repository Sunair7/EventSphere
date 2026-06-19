import { useMemo }                        from 'react';
import { Link }                            from 'react-router-dom';
import { useQuery }                        from '@tanstack/react-query';
import { motion }                          from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  Users, CalendarDays, Building2, LayoutGrid,
  TrendingUp, Clock, CheckCircle2, XCircle,
  ArrowRight, RefreshCw,
} from 'lucide-react';
import { format, parseISO }                from 'date-fns';
import api                                 from '@/utils/api';
import { cn }                              from '@/utils/cn';

// ─── Query ────────────────────────────────────────────────────────────────────
const useDashboardOverview = () =>
  useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn:  async () => {
      const { data } = await api.get('/analytics/dashboard');
      return data.data;
    },
    staleTime:      60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

// ─── Design tokens for charts ─────────────────────────────────────────────────
const COLORS = {
  primary:   '#131b2e',
  secondary: '#006a61',
  tertiary:  '#3980f4',
  warning:   '#f59e0b',
  error:     '#e11d48',
  success:   '#059669',
  muted:     '#e2e8f0',
};

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
    <div
      className="skeleton w-full rounded-md"
      style={{ height }}
      aria-hidden="true"
    />
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconColor, label, value, sub, badge, badgeColor, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.3, delay, ease: [0.4, 0, 0.2, 1] }}
      className="card flex flex-col gap-4"
    >
      <div className="flex items-start justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded', iconBg)}>
          <Icon size={18} className={iconColor} />
        </div>
        {badge !== undefined && (
          <span className={cn('badge font-mono', badgeColor)}>
            {badge}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="font-mono text-display-lg font-bold leading-none text-on-surface">
          {value ?? '—'}
        </p>
        <p className="text-body-sm font-medium text-on-surface">{label}</p>
        {sub && (
          <p className="font-mono text-label-sm text-on-surface-variant">{sub}</p>
        )}
      </div>
    </motion.div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SectionHeader({ title, action }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-headline-sm font-semibold text-on-surface">{title}</h2>
      {action}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, valueLabel = 'Count' }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card shadow-level-2 !p-3 min-w-[120px]">
      <p className="font-mono text-label-sm text-on-surface-variant mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-mono text-label-md font-semibold text-on-surface">
          {entry.value} <span className="text-on-surface-variant font-normal">{valueLabel}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Application Pipeline Row ──────────────────────────────────────────────────
const PIPELINE_CONFIG = {
  pending:   { label: 'Pending Review',  color: 'badge-warning', dot: 'bg-warning'  },
  approved:  { label: 'Approved',        color: 'badge-success', dot: 'bg-success'  },
  rejected:  { label: 'Rejected',        color: 'badge-error',   dot: 'bg-error'    },
  suspended: { label: 'Suspended',       color: 'badge-neutral', dot: 'bg-outline'  },
};

function PipelineRow({ status, count, total }) {
  const cfg  = PIPELINE_CONFIG[status] || {};
  const pct  = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 py-density-high border-b border-outline-variant last:border-0">
      <span className={cn('badge w-28 justify-center shrink-0', cfg.color)}>
        {cfg.label}
      </span>
      <div className="flex-1">
        <div className="h-1.5 w-full rounded-full bg-surface-container-high overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
            className={cn('h-full rounded-full', cfg.dot)}
          />
        </div>
      </div>
      <span className="font-mono text-label-md font-semibold text-on-surface w-8 text-right shrink-0">
        {count}
      </span>
      <span className="font-mono text-label-sm text-on-surface-variant w-8 text-right shrink-0">
        {pct}%
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { data, isLoading, isError, refetch, isFetching } = useDashboardOverview();

  // ── Derived chart data ──────────────────────────────────────────────────────
  const registrationChartData = useMemo(() => {
    if (!data?.recentRegistrations) return [];
    return data.recentRegistrations.map((r) => ({
      date:  format(parseISO(r.date), 'MMM d'),
      count: r.count,
    }));
  }, [data]);

  const boothChartData = useMemo(() => {
    if (!data?.booths) return [];
    return [
      { name: 'Available', value: data.booths.available, color: COLORS.secondary },
      { name: 'Pending',   value: data.booths.pending,   color: COLORS.warning   },
      { name: 'Assigned',  value: data.booths.assigned,  color: COLORS.primary   },
    ].filter((d) => d.value > 0);
  }, [data]);

  const applicationTotal = useMemo(() => {
    if (!data?.applications) return 0;
    return Object.values(data.applications).reduce((s, v) => s + v, 0);
  }, [data]);

  // ── Error state ─────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon text-error">
          <XCircle size={28} />
        </div>
        <h2 className="empty-state-title">Failed to load dashboard</h2>
        <p className="empty-state-body mb-4">Unable to fetch analytics data. Please try again.</p>
        <button onClick={() => refetch()} className="btn-ghost btn-sm gap-2">
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-section-gap">

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Logistics Command Overview</h1>
          <p className="page-subtitle">
            Platform-wide performance at a glance
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost btn-sm gap-2"
          aria-label="Refresh dashboard"
        >
          <RefreshCw
            size={14}
            className={cn('transition-transform', isFetching && 'animate-spin-slow')}
          />
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* ── KPI Stat Cards ───────────────────────────────────────────── */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard
                icon={Users}
                iconBg="bg-primary-container"
                iconColor="text-on-primary-container"
                label="Total Users"
                value={data?.users?.total?.toLocaleString()}
                sub={`${data?.users?.admin ?? 0} admin · ${data?.users?.exhibitor ?? 0} exhibitors · ${data?.users?.attendee ?? 0} attendees`}
                delay={0}
              />
              <StatCard
                icon={CalendarDays}
                iconBg="bg-secondary-container"
                iconColor="text-on-secondary-container"
                label="Total Expos"
                value={data?.expos?.total?.toLocaleString()}
                badge={data?.expos?.ongoing > 0 ? `${data.expos.ongoing} Live` : undefined}
                badgeColor="badge-success"
                sub={`${data?.expos?.published ?? 0} published · ${data?.expos?.draft ?? 0} draft`}
                delay={0.05}
              />
              <StatCard
                icon={LayoutGrid}
                iconBg="bg-tertiary-container"
                iconColor="text-on-tertiary-container"
                label="Booths"
                value={data?.booths?.total?.toLocaleString()}
                badge={data?.booths?.occupancyRate !== undefined ? `${data.booths.occupancyRate}%` : undefined}
                badgeColor="badge-info"
                sub={`${data?.booths?.assigned ?? 0} assigned · ${data?.booths?.pending ?? 0} pending`}
                delay={0.1}
              />
              <StatCard
                icon={Building2}
                iconBg="bg-warning-container"
                iconColor="text-on-warning-container"
                label="Applications"
                value={applicationTotal?.toLocaleString()}
                badge={data?.applications?.pending > 0 ? `${data.applications.pending} Pending` : undefined}
                badgeColor="badge-warning"
                sub={`${data?.applications?.approved ?? 0} approved · ${data?.applications?.rejected ?? 0} rejected`}
                delay={0.15}
              />
            </>
          )}
        </div>
      </section>

      {/* ── Charts Row ───────────────────────────────────────────────── */}
      <section aria-label="Analytics charts">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* Registration trend */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ duration: 0.35, delay: 0.2 }}
            className="card"
          >
            <SectionHeader
              title="New Registrations (7 days)"
              action={
                <Link to="/admin/users" className="btn-tertiary btn-sm gap-1">
                  All Users <ArrowRight size={13} />
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
                <AreaChart data={registrationChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="regGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={COLORS.secondary} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }}
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
                    strokeWidth={2}
                    fill="url(#regGradient)"
                    dot={{ fill: COLORS.secondary, r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: COLORS.secondary, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </motion.div>

          {/* Booth allocation bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ duration: 0.35, delay: 0.25 }}
            className="card"
          >
            <SectionHeader
              title="Booth Allocation"
              action={
                <Link to="/admin/expos" className="btn-tertiary btn-sm gap-1">
                  Manage Expos <ArrowRight size={13} />
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
                  <BarChart data={boothChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<ChartTooltip valueLabel="booths" />}
                      cursor={{ fill: '#e5eeff' }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={56}>
                      {boothChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>

                {/* Revenue summary */}
                {data?.booths?.totalRevenue > 0 && (
                  <div className="mt-3 flex items-center justify-between rounded bg-success-container/40 px-3 py-2">
                    <span className="text-body-sm text-on-success-container">
                      Projected revenue from assigned booths
                    </span>
                    <span className="font-mono text-label-md font-semibold text-on-success-container">
                      ${data.booths.totalRevenue.toLocaleString()}
                    </span>
                  </div>
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
            animate={{ opacity: 1, y: 0  }}
            transition={{ duration: 0.35, delay: 0.3 }}
            className="card"
          >
            <SectionHeader
              title="Application Pipeline"
              action={
                <Link to="/admin/exhibitors?status=pending" className="btn-tertiary btn-sm gap-1">
                  Review Queue <ArrowRight size={13} />
                </Link>
              }
            />
            {isLoading ? (
              <div className="flex flex-col divide-y divide-outline-variant">
                {Array.from({ length: 4 }).map((_, i) => <PipelineRowSkeleton key={i} />)}
              </div>
            ) : (
              <div>
                {['pending', 'approved', 'rejected', 'suspended'].map((status) => (
                  <PipelineRow
                    key={status}
                    status={status}
                    count={data?.applications?.[status] ?? 0}
                    total={applicationTotal}
                  />
                ))}
                {applicationTotal === 0 && (
                  <p className="py-6 text-center text-body-sm text-on-surface-variant">
                    No applications yet.
                  </p>
                )}
              </div>
            )}
          </motion.div>

          {/* Expo status summary */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ duration: 0.35, delay: 0.35 }}
            className="card"
          >
            <SectionHeader
              title="Expo Status Summary"
              action={
                <Link to="/admin/expos/create" className="btn-secondary btn-sm gap-1">
                  New Expo <ArrowRight size={13} />
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
              <div className="flex flex-col gap-2">
                {[
                  { status: 'ongoing',   label: 'Live Now',    icon: TrendingUp,    color: 'text-success',  bg: 'bg-success-container'  },
                  { status: 'published', label: 'Published',   icon: CheckCircle2,  color: 'text-tertiary', bg: 'bg-tertiary-container' },
                  { status: 'draft',     label: 'Draft',       icon: Clock,         color: 'text-on-surface-variant', bg: 'bg-surface-container' },
                  { status: 'completed', label: 'Completed',   icon: CheckCircle2,  color: 'text-secondary',bg: 'bg-secondary-container' },
                  { status: 'cancelled', label: 'Cancelled',   icon: XCircle,       color: 'text-error',    bg: 'bg-error-container'    },
                ].map(({ status, label, icon: Icon, color, bg }) => {
                  const count = data?.expos?.[status] ?? 0;
                  return (
                    <Link
                      key={status}
                      to={`/admin/expos?status=${status}`}
                      className="flex items-center gap-3 rounded px-3 py-2.5
                                 hover:bg-surface-container transition-colors duration-200 group"
                    >
                      <div className={cn('flex h-8 w-8 items-center justify-center rounded shrink-0', bg)}>
                        <Icon size={15} className={color} />
                      </div>
                      <span className="flex-1 text-body-sm font-medium text-on-surface">
                        {label}
                      </span>
                      <span className="font-mono text-label-md font-semibold text-on-surface">
                        {count}
                      </span>
                      <ArrowRight
                        size={14}
                        className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </Link>
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