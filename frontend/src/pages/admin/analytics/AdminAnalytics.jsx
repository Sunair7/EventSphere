import { useState }                   from 'react';
import { useQuery }                   from '@tanstack/react-query';
import { motion, AnimatePresence }    from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Users, Building2, BookOpen, TrendingUp,
  RefreshCw, AlertCircle,
} from 'lucide-react';
import { format, parseISO }          from 'date-fns';
import api                           from '@/utils/api';
import { cn }                        from '@/utils/cn';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary:   '#131b2e',
  secondary: '#006a61',
  tertiary:  '#3980f4',
  warning:   '#f59e0b',
  error:     '#e11d48',
  success:   '#059669',
  muted:     '#e2e8f0',
};

const PIE_COLORS = [C.secondary, C.tertiary, C.warning, C.error, '#8b5cf6', '#ec4899'];

// ─── Query hooks ──────────────────────────────────────────────────────────────
const useExhibitorAnalytics = () =>
  useQuery({
    queryKey: ['analytics', 'exhibitors'],
    queryFn:  async () => { const { data } = await api.get('/analytics/exhibitors'); return data.data; },
    staleTime: 5 * 60 * 1000,
  });

const useSessionAnalytics = () =>
  useQuery({
    queryKey: ['analytics', 'sessions'],
    queryFn:  async () => { const { data } = await api.get('/analytics/sessions'); return data.data; },
    staleTime: 5 * 60 * 1000,
  });

const useUserAnalytics = () =>
  useQuery({
    queryKey: ['analytics', 'users'],
    queryFn:  async () => { const { data } = await api.get('/analytics/users'); return data.data; },
    staleTime: 5 * 60 * 1000,
  });

// ─── Skeleton helpers ─────────────────────────────────────────────────────────
function ChartSkeleton({ height = 240 }) {
  return <div className="skeleton w-full rounded-md" style={{ height }} />;
}

function MetricSkeleton() {
  return (
    <div className="card flex flex-col gap-2 p-4">
      <div className="skeleton h-4 w-20 rounded" />
      <div className="skeleton h-7 w-14 rounded" />
      <div className="skeleton h-3 w-28 rounded" />
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function SectionCard({ title, children, className }) {
  return (
    <div className={cn('card', className)}>
      <h3 className="mb-4 text-headline-sm font-semibold text-on-surface">{title}</h3>
      {children}
    </div>
  );
}

function MetricCard({ label, value, sub, color = 'bg-primary-container', iconColor = 'text-on-primary-container' }) {
  return (
    <div className="card p-4 flex flex-col gap-1">
      <p className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <p className="font-mono text-headline-md font-bold text-on-surface">{value ?? '—'}</p>
      {sub && <p className="font-mono text-label-sm text-on-surface-variant">{sub}</p>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="card shadow-level-2 !p-3 min-w-[130px]">
      {label && <p className="font-mono text-label-sm text-on-surface-variant mb-1">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
            <span className="font-mono text-label-sm text-on-surface-variant capitalize">
              {entry.name}
            </span>
          </span>
          <span className="font-mono text-label-md font-semibold text-on-surface">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'exhibitors', label: 'Exhibitors', icon: Building2 },
  { key: 'sessions',   label: 'Sessions',   icon: BookOpen  },
  { key: 'users',      label: 'Users',      icon: Users     },
];

// ─── Tab panels ───────────────────────────────────────────────────────────────
function ExhibitorPanel() {
  const { data, isLoading, isError } = useExhibitorAnalytics();

  if (isError) return <ErrorState />;

  return (
    <div className="flex flex-col gap-6">
      {/* Funnel metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
          : [
              { label: 'Total',      value: data?.funnel?.total,        sub: 'All registrations'     },
              { label: 'Pending',    value: data?.funnel?.pending,      sub: 'Awaiting review'       },
              { label: 'Approved',   value: data?.funnel?.approved,     sub: `${data?.funnel?.approvalRate ?? 0}% approval rate` },
              { label: 'Rejected',   value: data?.funnel?.rejected,     sub: 'Not approved'          },
            ].map(({ label, value, sub }) => (
              <MetricCard key={label} label={label} value={value?.toLocaleString()} sub={sub} />
            ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly applications */}
        <SectionCard title="Monthly Application Volume">
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={(data?.monthlyApplications || []).map((d) => ({
                  ...d,
                  month: format(parseISO(`${d.month}-01`), 'MMM yy'),
                }))}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.primary}   stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.primary}   stopOpacity={0}    />
                  </linearGradient>
                  <linearGradient id="approvedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.secondary} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.secondary} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.muted }} />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                <Area type="monotone" dataKey="total"    name="Total"    stroke={C.primary}   strokeWidth={2} fill="url(#totalGrad)"    dot={false} />
                <Area type="monotone" dataKey="approved" name="Approved" stroke={C.secondary} strokeWidth={2} fill="url(#approvedGrad)" dot={false} />
                <Area type="monotone" dataKey="rejected" name="Rejected" stroke={C.error}     strokeWidth={2} fill="none"               dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Industry breakdown */}
        <SectionCard title="Top Industries">
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data?.industryBreakdown || []}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
              >
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="industry" width={100} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#e5eeff' }} />
                <Bar dataKey="count" name="Companies" fill={C.secondary} radius={[0, 4, 4, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Document verification */}
      <SectionCard title="Document Verification Pipeline">
        {isLoading ? <ChartSkeleton height={160} /> : (
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'pending',  label: 'Awaiting Review', color: 'bg-warning-container',  text: 'text-on-warning-container'  },
              { key: 'verified', label: 'Verified',        color: 'bg-success-container',  text: 'text-on-success-container'  },
              { key: 'rejected', label: 'Flagged',         color: 'bg-error-container',    text: 'text-on-error-container'    },
            ].map(({ key, label, color, text }) => (
              <div key={key} className={cn('rounded-md p-4 text-center', color)}>
                <p className={cn('font-mono text-headline-md font-bold', text)}>
                  {data?.documentVerification?.[key]?.toLocaleString() ?? 0}
                </p>
                <p className={cn('mt-1 font-mono text-label-sm', text)}>{label}</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function SessionPanel() {
  const { data, isLoading, isError } = useSessionAnalytics();

  if (isError) return <ErrorState />;

  return (
    <div className="flex flex-col gap-6">

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Format breakdown pie */}
        <SectionCard title="Sessions by Format">
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data?.formatBreakdown || []}
                  dataKey="sessionCount"
                  nameKey="format"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={3}
                  label={({ format: f, percent }) =>
                    percent > 0.05 ? `${f} ${(percent * 100).toFixed(0)}%` : ''
                  }
                  labelLine={false}
                >
                  {(data?.formatBreakdown || []).map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [value, name]}
                  contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Hourly heatmap */}
        <SectionCard title="Sessions by Start Hour">
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data?.hourlyDistribution || []}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <XAxis
                  dataKey="hour"
                  tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                  tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#45464d' }}
                  axisLine={false}
                  tickLine={false}
                  interval={2}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`}
                  content={<CustomTooltip />}
                  cursor={{ fill: '#e5eeff' }}
                />
                <Bar dataKey="sessionCount" name="Sessions"  fill={C.tertiary}  radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="totalAttendees" name="Attendees" fill={C.secondary} radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Capacity utilisation table */}
      <SectionCard title="Top Sessions by Capacity Utilisation">
        {isLoading ? <ChartSkeleton height={200} /> : (
          <div className="table-wrapper !border-0 !rounded-none">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Format</th>
                  <th className="text-right">Registered</th>
                  <th className="text-right">Capacity</th>
                  <th className="text-right">Utilisation</th>
                </tr>
              </thead>
              <tbody>
                {(data?.capacityUtilisation || []).slice(0, 8).map((s) => (
                  <tr key={s._id} className="border-b border-outline-variant hover:bg-surface-container-low">
                    <td className="px-4 py-density-high">
                      <span className="line-clamp-1 text-body-sm font-medium text-on-surface">
                        {s.title}
                      </span>
                    </td>
                    <td className="px-4 py-density-high">
                      <span className="badge badge-neutral capitalize">{s.format}</span>
                    </td>
                    <td className="px-4 py-density-high text-right font-mono text-label-md text-on-surface">
                      {s.registered}
                    </td>
                    <td className="px-4 py-density-high text-right font-mono text-label-md text-on-surface">
                      {s.maxCapacity}
                    </td>
                    <td className="px-4 py-density-high text-right">
                      <span className={cn(
                        'font-mono text-label-md font-semibold',
                        s.utilisation >= 90 ? 'text-error'
                          : s.utilisation >= 70 ? 'text-warning'
                          : 'text-secondary'
                      )}>
                        {s.utilisation.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {!data?.capacityUtilisation?.length && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center font-mono text-label-sm text-on-surface-variant">
                      No session data available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Bookmark leaderboard */}
      <SectionCard title="Most Bookmarked Sessions">
        {isLoading ? <ChartSkeleton height={180} /> : (
          <div className="flex flex-col gap-2">
            {(data?.bookmarkLeaderboard || []).slice(0, 6).map((s, i) => (
              <div key={s._id} className="flex items-center gap-3 rounded px-3 py-2
                                          hover:bg-surface-container-low transition-colors">
                <span className="font-mono text-label-sm text-on-surface-variant w-5 shrink-0">
                  #{i + 1}
                </span>
                <span className="flex-1 text-body-sm font-medium text-on-surface line-clamp-1">
                  {s.title}
                </span>
                <span className="badge badge-info gap-1 shrink-0">
                  {s.bookmarkCount} bookmarks
                </span>
              </div>
            ))}
            {!data?.bookmarkLeaderboard?.length && (
              <p className="py-4 text-center font-mono text-label-sm text-on-surface-variant">
                No bookmark data available.
              </p>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function UserPanel() {
  const { data, isLoading, isError } = useUserAnalytics();

  if (isError) return <ErrorState />;

  // Pivot daily growth data for stacked chart
  const growthData = (data?.dailyGrowth || []).reduce((acc, { date, role, count }) => {
    const existing = acc.find((d) => d.date === date);
    if (existing) { existing[role] = count; }
    else           { acc.push({ date, [role]: count }); }
    return acc;
  }, []).map((d) => ({
    ...d,
    date: format(parseISO(d.date), 'MMM d'),
  }));

  const verification = data?.verificationRate || {};

  return (
    <div className="flex flex-col gap-6">

      {/* Verification metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
          : [
              { label: 'Total Users',      value: verification.total,       sub: 'All active accounts'   },
              { label: 'Email Verified',   value: verification.verified,    sub: `${verification.verificationRate ?? 0}% verified` },
              { label: 'Unverified',       value: verification.unverified,  sub: 'Pending verification'  },
              { label: 'Verification Rate',value: `${verification.verificationRate ?? 0}%`, sub: 'Of all accounts' },
            ].map(({ label, value, sub }) => (
              <MetricCard key={label} label={label} value={String(value ?? '—')} sub={sub} />
            ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily registrations by role */}
        <SectionCard title="Daily Registrations by Role (30 days)">
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={growthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  {[
                    { key: 'attendee', color: C.tertiary  },
                    { key: 'exhibitor',color: C.secondary },
                    { key: 'admin',    color: C.primary   },
                  ].map(({ key, color }) => (
                    <linearGradient key={key} id={`${key}Grad`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={color} stopOpacity={0}   />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.muted }} />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                <Area type="monotone" dataKey="attendee" name="Attendee" stroke={C.tertiary}  strokeWidth={2} fill={`url(#attendeeGrad)`}  dot={false} />
                <Area type="monotone" dataKey="exhibitor" name="Exhibitor" stroke={C.secondary} strokeWidth={2} fill={`url(#exhibitorGrad)`} dot={false} />
                <Area type="monotone" dataKey="admin"    name="Admin"    stroke={C.primary}   strokeWidth={2} fill={`url(#adminGrad)`}    dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        {/* Daily active users */}
        <SectionCard title="Daily Active Users (7 days)">
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={(data?.loginActivity || []).map((d) => ({
                  ...d,
                  date: format(parseISO(d.date), 'MMM d'),
                }))}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#e5eeff' }} />
                <Bar dataKey="activeUsers" name="Active users" fill={C.secondary} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      {/* Role distribution */}
      <SectionCard title="Role Distribution">
        {isLoading ? <ChartSkeleton height={100} /> : (
          <div className="flex flex-col gap-3">
            {(data?.roleDistribution || []).map(({ role, count }) => {
              const total = data.roleDistribution.reduce((s, d) => s + d.count, 0);
              const pct   = total > 0 ? Math.round((count / total) * 100) : 0;
              const colors = {
                admin:     { bar: 'bg-primary',   badge: 'badge-neutral' },
                exhibitor: { bar: 'bg-secondary', badge: 'badge-success' },
                attendee:  { bar: 'bg-tertiary',  badge: 'badge-info'    },
              };
              const cfg = colors[role] || { bar: 'bg-outline', badge: 'badge-neutral' };

              return (
                <div key={role} className="flex items-center gap-4">
                  <span className={cn('badge w-20 justify-center shrink-0 capitalize', cfg.badge)}>
                    {role}
                  </span>
                  <div className="flex-1">
                    <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
                        className={cn('h-full rounded-full', cfg.bar)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-24 shrink-0 justify-end">
                    <span className="font-mono text-label-md font-semibold text-on-surface">
                      {count.toLocaleString()}
                    </span>
                    <span className="font-mono text-label-sm text-on-surface-variant">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="empty-state py-20">
      <div className="empty-state-icon text-error">
        <AlertCircle size={28} />
      </div>
      <h3 className="empty-state-title">Failed to load analytics</h3>
      <p className="empty-state-body">Please refresh the page to try again.</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState('exhibitors');

  const PANELS = {
    exhibitors: ExhibitorPanel,
    sessions:   SessionPanel,
    users:      UserPanel,
  };

  const ActivePanel = PANELS[activeTab] || ExhibitorPanel;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics & Reporting</h1>
          <p className="page-subtitle">Platform-wide performance metrics and trends</p>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp size={15} className="text-secondary" />
          <span className="font-mono text-label-sm text-on-surface-variant">
            Data refreshes every 5 minutes
          </span>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-outline-variant">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2.5 text-body-sm font-medium',
              'transition-colors duration-200',
              activeTab === key
                ? 'text-secondary'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <Icon size={15} />
            {label}
            {activeTab === key && (
              <motion.span
                layoutId="analytics-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-t"
              />
            )}
          </button>
        ))}
      </div>

      {/* ── Active panel ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8  }}
          animate={{ opacity: 1, y: 0  }}
          exit={{ opacity: 0, y: -4    }}
          transition={{ duration: 0.2  }}
        >
          <ActivePanel />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}