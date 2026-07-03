import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  Building2,
  BookOpen,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Star,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import api from '@/utils/api';
import { cn } from '@/utils/cn';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary: '#131b2e',
  secondary: '#006a61',
  tertiary: '#3980f4',
  warning: '#f59e0b',
  error: '#e11d48',
  muted: '#e2e8f0',
};

const PIE_COLORS = [C.secondary, C.tertiary, C.warning, C.error, '#8b5cf6', '#ec4899'];

// ─── Animated Counter ─────────────────────────────────────────────────────────
function CountUp({ end, duration = 1.2, className = '' }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });

  useEffect(() => {
    if (!inView || end === undefined || end === null) return;
    let startTime;
    const startValue = 0;
    const endValue = typeof end === 'string' ? parseInt(end) : end;
    if (isNaN(endValue)) return;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(startValue + (endValue - startValue) * eased));
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }, [inView, end, duration]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {display.toLocaleString()}
    </span>
  );
}

// ─── Query hooks ──────────────────────────────────────────────────────────────
const useExhibitorAnalytics = () =>
  useQuery({
    queryKey: ['analytics', 'exhibitors'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/exhibitors');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

const useSessionAnalytics = () =>
  useQuery({
    queryKey: ['analytics', 'sessions'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/sessions');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

const useUserAnalytics = () =>
  useQuery({
    queryKey: ['analytics', 'users'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/users');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

const useRevenueAnalytics = () =>
  useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/analytics/dashboard');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });

// ─── Skeleton helpers ─────────────────────────────────────────────────────────
function ChartSkeleton({ height = 240 }) {
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

function MetricSkeleton() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card flex flex-col gap-2 p-4">
      <div className="skeleton h-4 w-20 rounded" />
      <div className="skeleton h-7 w-14 rounded" />
      <div className="skeleton h-3 w-28 rounded" />
    </motion.div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function SectionCard({ title, children, className, icon: Icon }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn('card group', className)}
    >
      <h3 className="mb-4 text-headline-sm font-semibold text-on-surface flex items-center gap-2">
        {Icon && <Icon size={16} className="text-secondary" />}
        {title}
      </h3>
      {children}
    </motion.div>
  );
}

function MetricCard({ label, value, sub, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="card p-4 flex flex-col gap-1 hover:shadow-level-2 transition-shadow relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-transparent to-secondary/[0.02] opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      <p className="font-mono text-label-sm uppercase tracking-wider text-on-surface-variant relative z-10">{label}</p>
      <p className="font-mono text-headline-md font-bold text-on-surface relative z-10">
        {typeof value === 'number' ? <CountUp end={value} /> : value ?? '—'}
      </p>
      {sub && <p className="font-mono text-label-sm text-on-surface-variant relative z-10">{sub}</p>}
    </motion.div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="card shadow-level-2 !p-3 min-w-[130px]">
      {label && <p className="font-mono text-label-sm text-on-surface-variant mb-1">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
            <span className="font-mono text-label-sm text-on-surface-variant capitalize">{entry.name}</span>
          </span>
          <span className="font-mono text-label-md font-semibold text-on-surface">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </motion.div>
  );
}

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'exhibitors', label: 'Exhibitors', icon: Building2 },
  { key: 'sessions', label: 'Sessions', icon: BookOpen },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'revenue', label: 'Revenue', icon: TrendingUp },
];

function ErrorState() {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="empty-state py-20">
      <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.5, delay: 0.3 }} className="empty-state-icon text-error">
        <AlertCircle size={28} />
      </motion.div>
      <h3 className="empty-state-title">Failed to load analytics</h3>
      <p className="empty-state-body">Please refresh the page to try again.</p>
    </motion.div>
  );
}

function ExhibitorPanel() {
  const { data, isLoading, isError } = useExhibitorAnalytics();
  if (isError) return <ErrorState />;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
          : [
              { label: 'Total', value: data?.funnel?.total, sub: 'All registrations', delay: 0 },
              { label: 'Pending', value: data?.funnel?.pending, sub: 'Awaiting review', delay: 0.05 },
              { label: 'Approved', value: data?.funnel?.approved, sub: `${data?.funnel?.approvalRate ?? 0}% approval rate`, delay: 0.1 },
              { label: 'Rejected', value: data?.funnel?.rejected, sub: 'Not approved', delay: 0.15 },
            ].map(({ label, value, sub, delay }) => (
              <MetricCard key={label} label={label} value={value} sub={sub} delay={delay} />
            ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Monthly Application Volume" icon={TrendingUp}>
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
                    <stop offset="5%" stopColor={C.primary} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="approvedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.secondary} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.secondary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.muted }} />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                <Area type="monotone" dataKey="total" name="Total" stroke={C.primary} strokeWidth={2} fill="url(#totalGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                <Area type="monotone" dataKey="approved" name="Approved" stroke={C.secondary} strokeWidth={2} fill="url(#approvedGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                <Area type="monotone" dataKey="rejected" name="Rejected" stroke={C.error} strokeWidth={2} fill="none" dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Top Industries" icon={Building2}>
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.industryBreakdown || []} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="industry" width={100} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#e5eeff' }} />
                <Bar dataKey="count" name="Companies" fill={C.secondary} radius={[0, 4, 4, 0]} maxBarSize={20}>
                  {(data?.industryBreakdown || []).map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Document Verification Pipeline" icon={CheckCircle2}>
        {isLoading ? <ChartSkeleton height={160} /> : (
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'pending', label: 'Awaiting Review', color: 'bg-warning-container', text: 'text-on-warning-container', icon: Clock },
              { key: 'verified', label: 'Verified', color: 'bg-success-container', text: 'text-on-success-container', icon: CheckCircle2 },
              { key: 'rejected', label: 'Flagged', color: 'bg-error-container', text: 'text-on-error-container', icon: XCircle },
            ].map(({ key, label, color, text, icon: Icon }) => (
              <motion.div key={key} whileHover={{ scale: 1.02 }} transition={{ type: 'spring', stiffness: 400, damping: 25 }} className={cn('rounded-md p-4 text-center', color)}>
                <Icon size={20} className={cn('mx-auto mb-2', text)} />
                <p className={cn('font-mono text-headline-md font-bold', text)}>
                  <CountUp end={data?.documentVerification?.[key] ?? 0} />
                </p>
                <p className={cn('mt-1 font-mono text-label-sm', text)}>{label}</p>
              </motion.div>
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
        <SectionCard title="Sessions by Format" icon={BookOpen}>
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
                  label={({ format: f, percent }) => (percent > 0.05 ? `${f} ${(percent * 100).toFixed(0)}%` : '')}
                  labelLine={false}
                  animationBegin={0}
                  animationDuration={800}
                >
                  {(data?.formatBreakdown || []).map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Sessions by Start Hour" icon={TrendingUp}>
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data?.hourlyDistribution || []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, '0')}:00`} tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(h) => `${String(h).padStart(2, '0')}:00`} content={<CustomTooltip />} cursor={{ fill: '#e5eeff' }} />
                <Bar dataKey="sessionCount" name="Sessions" fill={C.tertiary} radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="totalAttendees" name="Attendees" fill={C.secondary} radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Top Sessions by Capacity Utilisation" icon={Users}>
        {isLoading ? <ChartSkeleton height={200} /> : (
          <div className="table-wrapper !border-0 !rounded-none overflow-x-auto">
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
                {(data?.capacityUtilisation || []).slice(0, 8).map((s) => {
                  const utilisationPct = Number(s?.utilisation ?? 0);
                  return (
                    <tr key={s._id} className="border-b border-outline-variant hover:bg-surface-container-low transition-colors">
                      <td className="px-4 py-density-high">
                        <span className="line-clamp-1 text-body-sm font-medium text-on-surface">{s.title}</span>
                      </td>
                      <td className="px-4 py-density-high">
                        <span className="badge badge-neutral capitalize">{s.format}</span>
                      </td>
                      <td className="px-4 py-density-high text-right font-mono text-label-md text-on-surface tabular-nums">{s.registered}</td>
                      <td className="px-4 py-density-high text-right font-mono text-label-md text-on-surface tabular-nums">{s.maxCapacity}</td>
                      <td className="px-4 py-density-high text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-surface-container-high overflow-hidden">
                            <div
                              style={{ width: `${utilisationPct}%` }}
                              className={cn(
                                'h-full rounded-full',
                                utilisationPct >= 90 ? 'bg-error' : utilisationPct >= 70 ? 'bg-warning' : 'bg-secondary'
                              )}
                            />
                          </div>
                          <span
                            className={cn(
                              'font-mono text-label-md font-semibold tabular-nums w-10 text-right',
                              utilisationPct >= 90 ? 'text-error' : utilisationPct >= 70 ? 'text-warning' : 'text-secondary'
                            )}
                          >
                            {utilisationPct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
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

      <SectionCard title="Most Bookmarked Sessions" icon={Star}>
        {isLoading ? <ChartSkeleton height={180} /> : (
          <div className="flex flex-col gap-2">
            {(data?.bookmarkLeaderboard || []).slice(0, 6).map((s, i) => (
              <div key={s._id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-container-low transition-all cursor-pointer">
                <span
                  className={cn(
                    'font-mono text-label-sm w-6 shrink-0 text-center font-bold',
                    i === 0
                      ? 'text-warning'
                      : i === 1
                        ? 'text-on-surface-variant/60'
                        : i === 2
                          ? 'text-error/60'
                          : 'text-on-surface-variant/40'
                  )}
                >
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span className="flex-1 text-body-sm font-medium text-on-surface line-clamp-1">{s.title}</span>
                <span className="badge badge-info gap-1 shrink-0">
                  <Star size={10} fill="currentColor" />
                  {s.bookmarkCount}
                </span>
              </div>
            ))}
            {!data?.bookmarkLeaderboard?.length && (
              <p className="py-4 text-center font-mono text-label-sm text-on-surface-variant">No bookmark data available.</p>
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

  const growthData = (data?.dailyGrowth || []).reduce((acc, { date, role, count }) => {
    const existing = acc.find((d) => d.date === date);
    if (existing) existing[role] = count;
    else acc.push({ date, [role]: count });
    return acc;
  }, []).map((d) => ({ ...d, date: format(parseISO(d.date), 'MMM d') }));

  const verification = data?.verificationRate || {};

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
          : [
              { label: 'Total Users', value: verification.total, sub: 'All active accounts', delay: 0 },
              { label: 'Email Verified', value: verification.verified, sub: `${verification.verificationRate ?? 0}% verified`, delay: 0.05 },
              { label: 'Unverified', value: verification.unverified, sub: 'Pending verification', delay: 0.1 },
              { label: 'Verification Rate', value: verification.verificationRate, sub: 'Of all accounts', delay: 0.15 },
            ].map(({ label, value, sub, delay }) => (
              <MetricCard key={label} label={label} value={value} sub={sub} delay={delay} />
            ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Daily Registrations by Role (30 days)" icon={TrendingUp}>
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={growthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  {[
                    { key: 'attendee', color: C.tertiary },
                    { key: 'exhibitor', color: C.secondary },
                    { key: 'admin', color: C.primary },
                  ].map(({ key, color }) => (
                    <linearGradient key={key} id={`${key}Grad`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} interval={4} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.muted }} />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                <Area type="monotone" dataKey="attendee" name="Attendee" stroke={C.tertiary} strokeWidth={2} fill="url(#attendeeGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                <Area type="monotone" dataKey="exhibitor" name="Exhibitor" stroke={C.secondary} strokeWidth={2} fill="url(#exhibitorGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
                <Area type="monotone" dataKey="admin" name="Admin" stroke={C.primary} strokeWidth={2} fill="url(#adminGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Daily Active Users (7 days)" icon={Users}>
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={(data?.loginActivity || []).map((d) => ({ ...d, date: format(parseISO(d.date), 'MMM d') }))}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#e5eeff' }} />
                <Bar dataKey="activeUsers" name="Active users" fill={C.secondary} radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {(data?.loginActivity || []).map((_, idx) => (
                    <Cell key={idx} fill={C.secondary} style={{ filter: `brightness(${1 + idx * 0.03})` }} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </SectionCard>
      </div>

      <SectionCard title="Role Distribution" icon={Users}>
        {isLoading ? <ChartSkeleton height={100} /> : (
          <div className="flex flex-col gap-3">
            {(data?.roleDistribution || []).map(({ role, count }, i) => {
              const total = data.roleDistribution.reduce((s, d) => s + d.count, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const cfg =
                role === 'admin'
                  ? { bar: 'bg-primary', badge: 'badge-neutral' }
                  : role === 'exhibitor'
                    ? { bar: 'bg-secondary', badge: 'badge-success' }
                    : role === 'attendee'
                      ? { bar: 'bg-tertiary', badge: 'badge-info' }
                      : { bar: 'bg-outline', badge: 'badge-neutral' };

              return (
                <motion.div key={role} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center gap-4">
                  <span className={cn('badge w-20 justify-center shrink-0 capitalize', cfg.badge)}>{role}</span>
                  <div className="flex-1">
                    <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.1 }}
                        className={cn('h-full rounded-full', cfg.bar)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-28 justify-end">
                    <span className="font-mono text-label-md font-semibold text-on-surface tabular-nums">{count}</span>
                    <span className="font-mono text-label-sm text-on-surface-variant tabular-nums">{pct}%</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Revenue tab logic (admin revenue)
// ─────────────────────────────────────────────────────────────
function RevenuePanel() {
  const { data, isLoading, isError } = useRevenueAnalytics();
  if (isError) return <ErrorState />;

  const booths = data?.booths || {};
  const totalRevenue = Number(booths?.totalRevenue ?? 0) || 0;
  const occupancyRate = Number(booths?.occupancyRate ?? 0) || 0;

  // The dashboard endpoint does not currently provide a revenue breakdown by booth type.
  // So we compute an *actual* breakdown by querying booth type pricing directly would require a new API.
  // For now, we keep the table stable and show a meaningful placeholder when breakdown is missing.
  const byType = Array.isArray(booths?.byType) ? booths.byType : [];

  const revenueRows = byType
    .map((x) => ({
      label: x?.type ?? x?.label ?? x?._id ?? 'Unknown',
      value: Number(x?.totalRevenue ?? x?.revenue ?? 0),
      count: Number(x?.count ?? x?.size ?? 0),
    }))
    .filter((r) => Number.isFinite(r.value) && r.value >= 0);

  const showNoRevenueBreakdown = !revenueRows.length;


  // Backend stores money fields as cents.
  const fmtCurrency = (amount) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '—';
    const value = n / 100;
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(value);
  };

  // Revenue Trend: /analytics/dashboard does not provide time-series.
  // Replace fabricated data with a single-point chart so the tab renders reliably.
  // Convert backend cents (or large integer money) into display units for charts/ticks.
  const toDisplayMoney = (amount) => {
    const n = Number(amount);
    if (!Number.isFinite(n)) return 0;
    const looksLikeCents = Number.isInteger(n) && n >= 1000;
    return looksLikeCents ? n / 100 : n;
  };

  const monthlyTrend = [{ month: 'Total', revenue: toDisplayMoney(totalRevenue) }];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
          : [
              {
                label: 'Expected Revenue (Assigned)',
                value: totalRevenue * (booths?.assigned && booths?.total ? (booths.assigned / booths.total) : 0),
                sub: 'Assumes each booth is priced similarly (approx)',
                delay: 0,
              },
              {
                label: 'Actual Revenue (All Booths)',
                value: totalRevenue,
                sub: 'Sum of all booths (available + pending + assigned)',
                delay: 0.05,
              },
              { label: 'Assigned Booths', value: booths?.assigned ?? 0, sub: `Occupancy: ${occupancyRate.toFixed(1)}%`, delay: 0.1 },
              { label: 'Occupancy Rate', value: occupancyRate, sub: '% filled', delay: 0.15 },
            ].map(({ label, value, sub, delay }) => (
              <MetricCard
                key={label}
                label={label}
                value={typeof value === 'number' ? value : 0}
                sub={sub}
                delay={delay}
              />
            ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Revenue Trend (approx)" icon={TrendingUp}>
          {isLoading ? <ChartSkeleton /> : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={monthlyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.secondary} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.secondary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fontFamily: 'JetBrains Mono', fill: '#45464d' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => {
                    const n = Number(v);
                    if (!Number.isFinite(n)) return '0';
                    // compact formatting to avoid repeated zeros on large numbers
                    if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                    if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
                    return n.toFixed(0);
                  }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.muted }} />
                <Legend wrapperStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11 }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke={C.secondary} strokeWidth={2} fill="url(#revGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </SectionCard>

        <SectionCard title="Revenue by Booth Type" icon={TrendingUp}>
          {isLoading ? <ChartSkeleton height={240} /> : (
            <div className="flex flex-col gap-3">
              <div className="text-label-sm text-on-surface-variant font-mono">
                Uses the existing analytics dashboard endpoint booth pricing totals.
              </div>
              <div className="table-wrapper !border-0 !rounded-none overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th className="text-right">Count</th>
                      <th className="text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueRows.length ? (
                      revenueRows.slice(0, 8).map((r, i) => (
                        <tr key={`${r.label}-${i}`} className="border-b border-outline-variant">
                          <td className="px-4 py-density-high font-medium">{r.label}</td>
                          <td className="px-4 py-density-high text-right tabular-nums">{r.count.toLocaleString()}</td>
                          <td className="px-4 py-density-high text-right tabular-nums">{fmtCurrency(r.value)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-8 text-center font-mono text-label-sm text-on-surface-variant">
                          No revenue breakdown available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminAnalytics() {
  const [activeTab, setActiveTab] = useState('exhibitors');

  const PANELS = {
    exhibitors: ExhibitorPanel,
    sessions: SessionPanel,
    users: UserPanel,
    revenue: RevenuePanel,
  };

  const ActivePanel = PANELS[activeTab] || ExhibitorPanel;

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="page-header"
      >
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Sparkles size={20} className="text-secondary" />
            Analytics & Reporting
          </h1>
          <p className="page-subtitle">Platform-wide performance metrics and trends</p>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
            <Activity size={14} className="text-secondary" />
          </motion.div>
          <span className="font-mono text-label-sm text-on-surface-variant">Auto-refreshes every 5 min</span>
        </div>
      </motion.div>

      <div className="flex gap-1 border-b border-outline-variant">
        {TABS.map(({ key, label, icon: Icon }) => (
          <motion.button
            key={key}
            onClick={() => setActiveTab(key)}
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2.5 text-body-sm font-medium',
              'transition-colors duration-200 rounded-t-lg',
              activeTab === key
                ? 'text-secondary bg-secondary/5'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            )}
          >
            <Icon size={15} />
            {label}
            {activeTab === key && (
              <motion.span
                layoutId="analytics-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-t"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        >
          <ActivePanel />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

