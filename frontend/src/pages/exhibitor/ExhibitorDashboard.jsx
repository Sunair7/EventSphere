import { useMemo }                      from 'react';
import { Link }                         from 'react-router-dom';
import { useQuery }                     from '@tanstack/react-query';
import { motion }                       from 'framer-motion';
import {
  Building2, LayoutGrid, BookOpen, MessageSquare,
  CheckCircle2, Clock, XCircle, AlertCircle,
  ArrowRight, ShieldCheck, FileText, Compass,
  ChevronRight, User, Ban,
} from 'lucide-react';
import { format, isPast, isFuture }     from 'date-fns';
import api                              from '@/utils/api';
import { useAuth }                      from '@/context/AuthContext';
import { cn }                           from '@/utils/cn';

// ─── Query hooks ──────────────────────────────────────────────────────────────
const useMyProfile = () =>
  useQuery({
    queryKey: ['exhibitor', 'profile', 'me'],
    queryFn:  async () => {
      const { data } = await api.get('/exhibitors/profile/me');
      return data.data.profile;
    },
    retry: false,
  });

const useMyRegistrations = () =>
  useQuery({
    queryKey: ['sessions', 'me', 'registrations'],
    queryFn:  async () => {
      const { data } = await api.get('/sessions/me/registrations');
      return data.data.sessions;
    },
  });

// ─── Skeleton components ──────────────────────────────────────────────────────
function CardSkeleton({ className }) {
  return <div className={cn('skeleton rounded-md', className)} />;
}

// ─── Status config ────────────────────────────────────────────────────────────
const APPLICATION_STATUS = {
  pending: {
    icon:      Clock,
    iconBg:    'bg-warning-container',
    iconFg:    'text-on-warning-container',
    badge:     'badge-warning',
    title:     'Application Pending',
    body:      'Your exhibitor application is under review. You\'ll be notified once a decision is made.',
    cta:       null,
  },
  approved: {
    icon:      CheckCircle2,
    iconBg:    'bg-success-container',
    iconFg:    'text-on-success-container',
    badge:     'badge-success',
    title:     'Application Approved',
    body:      'Your application has been approved. You can now browse expos and reserve booth spaces.',
    cta:       { label: 'Browse Expos', to: '/exhibitor/expos' },
  },
  rejected: {
    icon:      XCircle,
    iconBg:    'bg-error-container',
    iconFg:    'text-on-error-container',
    badge:     'badge-error',
    title:     'Application Not Approved',
    body:      'Your application was not approved. Update your profile with the requested changes and resubmit.',
    cta:       { label: 'Update Profile', to: '/exhibitor/profile' },
  },
  suspended: {
    icon:      Ban,
    iconBg:    'bg-error-container',
    iconFg:    'text-on-error-container',
    badge:     'badge-error',
    title:     'Account Suspended',
    body:      'Your account has been suspended. Please contact the event organiser for assistance.',
    cta:       { label: 'Contact via Messages', to: '/exhibitor/messages' },
  },
};

// ─── Profile status card ──────────────────────────────────────────────────────
function ApplicationStatusCard({ profile, isLoading }) {
  if (isLoading) {
    return <CardSkeleton className="h-36" />;
  }

  if (!profile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card border-2 border-dashed border-outline-variant"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary-container">
            <User size={18} className="text-on-primary-container" />
          </div>
          <div className="flex-1">
            <h3 className="text-headline-sm font-semibold text-on-surface">
              Complete your profile
            </h3>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Set up your company profile to start applying for booth spaces at upcoming expos.
            </p>
            <Link to="/exhibitor/profile" className="btn-secondary btn-sm mt-3 gap-1.5 inline-flex">
              <Building2 size={14} /> Create profile
            </Link>
          </div>
        </div>
      </motion.div>
    );
  }

  const cfg = APPLICATION_STATUS[profile.applicationStatus] || APPLICATION_STATUS.pending;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="card"
    >
      <div className="flex items-start gap-4">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', cfg.iconBg)}>
          <Icon size={18} className={cfg.iconFg} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-headline-sm font-semibold text-on-surface">{cfg.title}</h3>
            <span className={cn('badge', cfg.badge)}>{profile.applicationStatus}</span>
            {profile.isVerified && (
              <span className="flex items-center gap-1 font-mono text-label-sm text-secondary">
                <ShieldCheck size={13} /> Verified
              </span>
            )}
          </div>
          <p className="mt-1 text-body-sm text-on-surface-variant">{cfg.body}</p>
          {profile.applicationNote && (
            <div className="mt-2 rounded bg-surface-container px-3 py-2">
              <p className="font-mono text-label-sm text-on-surface-variant">
                Organiser note: <span className="text-on-surface">{profile.applicationNote}</span>
              </p>
            </div>
          )}
          {cfg.cta && (
            <Link to={cfg.cta.to} className="btn-secondary btn-sm mt-3 gap-1.5 inline-flex">
              {cfg.cta.label} <ArrowRight size={13} />
            </Link>
          )}
        </div>
        <Link
          to="/exhibitor/profile"
          className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                     hover:text-on-surface transition-colors"
          title="Edit profile"
        >
          <ChevronRight size={16} />
        </Link>
      </div>
    </motion.div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconFg, label, value, to, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ delay, duration: 0.25 }}
    >
      <Link
        to={to}
        className="card flex items-center gap-4 hover:shadow-level-2
                   transition-shadow duration-200 group block"
      >
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded', iconBg)}>
          <Icon size={18} className={iconFg} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-headline-sm font-bold text-on-surface">{value}</p>
          <p className="text-body-sm text-on-surface-variant">{label}</p>
        </div>
        <ArrowRight
          size={15}
          className="text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        />
      </Link>
    </motion.div>
  );
}

// ─── Assigned booth card ──────────────────────────────────────────────────────
function AssignedBoothCard({ booth }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-outline-variant bg-surface-bright px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm
                      bg-primary-container font-mono text-label-md font-bold text-on-primary-container">
        {booth.boothId?.boothNumber ?? '—'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-medium text-on-surface">
          {booth.expoId?.title ?? 'Expo'}
        </p>
        <p className="font-mono text-label-sm text-on-surface-variant">
          {booth.boothId?.dimensions ?? ''} · {booth.expoId?.status ?? ''}
        </p>
      </div>
      <Link
        to={`/exhibitor/expos/${booth.expoId?._id}/floor-plan`}
        className="btn-ghost btn-sm gap-1 shrink-0"
      >
        <LayoutGrid size={13} /> Map
      </Link>
    </div>
  );
}

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ session }) {
  const isLive = session.status === 'live';
  const past   = isPast(new Date(session.endTime));

  return (
    <div className={cn(
      'flex items-start gap-3 rounded-md border px-4 py-3 transition-colors',
      isLive
        ? 'border-success bg-success-container/20'
        : 'border-outline-variant bg-surface-bright'
    )}>
      <div className="flex flex-col items-center gap-0.5 shrink-0 min-w-[48px]">
        <span className="font-mono text-label-sm text-on-surface-variant">
          {format(new Date(session.startTime), 'MMM d')}
        </span>
        <span className="font-mono text-label-md font-semibold text-on-surface">
          {format(new Date(session.startTime), 'HH:mm')}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-body-sm font-medium text-on-surface line-clamp-1">
            {session.title}
          </p>
          {isLive && (
            <span className="badge badge-success gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
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
    </div>
  );
}

// ─── Quick action ─────────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, to, description }) {
  return (
    <Link
      to={to}
      className="card flex items-start gap-3 hover:shadow-level-2 transition-shadow duration-200 group"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded
                      bg-surface-container group-hover:bg-secondary-container/40
                      transition-colors duration-200">
        <Icon size={16} className="text-on-surface-variant group-hover:text-secondary transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-medium text-on-surface group-hover:text-secondary transition-colors">
          {label}
        </p>
        <p className="font-mono text-label-sm text-on-surface-variant line-clamp-1">{description}</p>
      </div>
      <ArrowRight
        size={14}
        className="shrink-0 text-on-surface-variant opacity-0 group-hover:opacity-100
                   transition-opacity mt-0.5"
      />
    </Link>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExhibitorDashboard() {
  const { user }     = useAuth();
  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: sessions = [], isLoading: sessionsLoading } = useMyRegistrations();

  const upcomingSessions = useMemo(() =>
    sessions
      .filter((s) => isFuture(new Date(s.endTime)) || s.status === 'live')
      .slice(0, 4),
    [sessions]
  );

  const assignedBooths = profile?.assignedBooths || [];

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex flex-col gap-section-gap">

      {/* ── Welcome header ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="text-headline-lg font-semibold text-on-surface">
          {greeting}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Here's your exhibitor portal overview.
        </p>
      </motion.div>

      {/* ── Application status ──────────────────────────────────── */}
      <ApplicationStatusCard profile={profile} isLoading={profileLoading} />

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
      </div>

      {/* ── Two-column lower section ──────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Assigned booths */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface">
              Your Booths
            </h2>
            <Link
              to="/exhibitor/expos"
              className="btn-tertiary btn-sm gap-1"
            >
              Browse Expos <ArrowRight size={13} />
            </Link>
          </div>

          {profileLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-md" />
              ))}
            </div>
          ) : assignedBooths.length === 0 ? (
            <div className="card border-dashed border-2 text-center py-10">
              <div className="empty-state-icon mx-auto mb-3">
                <LayoutGrid size={22} />
              </div>
              <p className="text-body-sm font-medium text-on-surface">No booths assigned yet</p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Browse expos and reserve a booth space to get started.
              </p>
              {profile?.applicationStatus === 'approved' && (
                <Link to="/exhibitor/expos" className="btn-secondary btn-sm mt-4 inline-flex gap-1">
                  <Compass size={14} /> Find an Expo
                </Link>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {assignedBooths.slice(0, 4).map((booth, i) => (
                <AssignedBoothCard key={i} booth={booth} />
              ))}
              {assignedBooths.length > 4 && (
                <Link
                  to="/exhibitor/expos"
                  className="text-center py-2 text-body-sm text-tertiary hover:text-secondary transition-colors"
                >
                  View all {assignedBooths.length} booths →
                </Link>
              )}
            </div>
          )}
        </motion.div>

        {/* Upcoming sessions */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface">
              Upcoming Sessions
            </h2>
            <Link to="/exhibitor/sessions" className="btn-tertiary btn-sm gap-1">
              All Sessions <ArrowRight size={13} />
            </Link>
          </div>

          {sessionsLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-md" />
              ))}
            </div>
          ) : upcomingSessions.length === 0 ? (
            <div className="card border-dashed border-2 text-center py-10">
              <div className="empty-state-icon mx-auto mb-3">
                <BookOpen size={22} />
              </div>
              <p className="text-body-sm font-medium text-on-surface">No upcoming sessions</p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Register for sessions to add them to your schedule.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingSessions.map((session) => (
                <SessionCard key={session._id} session={session} />
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <h2 className="mb-3 text-headline-sm font-semibold text-on-surface">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            icon={Building2}
            label="My Profile"
            description="Update company info and documents"
            to="/exhibitor/profile"
          />
          <QuickAction
            icon={Compass}
            label="Browse Expos"
            description="Find and apply for upcoming events"
            to="/exhibitor/expos"
          />
          <QuickAction
            icon={BookOpen}
            label="Sessions"
            description="Register for talks and workshops"
            to="/exhibitor/sessions"
          />
          <QuickAction
            icon={MessageSquare}
            label="Messages"
            description="Chat with organisers and exhibitors"
            to="/exhibitor/messages"
          />
        </div>
      </motion.div>
    </div>
  );
}