import { useMemo }                   from 'react';
import { Link }                      from 'react-router-dom';
import { useQuery }                  from '@tanstack/react-query';
import { motion }                    from 'framer-motion';
import {
  Compass, CalendarDays, BookOpen, BookmarkCheck,
  MessageSquare, MapPin, ArrowRight, Clock,
  Building2, Users, TrendingUp, ChevronRight,
} from 'lucide-react';
import {
  format, isFuture, isPast, differenceInDays,
  isToday, isTomorrow,
} from 'date-fns';
import api                           from '@/utils/api';
import { useAuth }                   from '@/context/AuthContext';
import { cn }                        from '@/utils/cn';

// ─── Query hooks ──────────────────────────────────────────────────────────────
const useUpcomingExpos = () =>
  useQuery({
    queryKey: ['expos', 'upcoming'],
    queryFn:  async () => {
      const { data } = await api.get('/expos/upcoming?limit=6');
      return data.data.expos;
    },
    staleTime: 5 * 60 * 1000,
  });

const useMyRegistrations = () =>
  useQuery({
    queryKey: ['sessions', 'me', 'registrations'],
    queryFn:  async () => {
      const { data } = await api.get('/sessions/me/registrations');
      return data.data.sessions;
    },
  });

const useMyBookmarks = () =>
  useQuery({
    queryKey: ['sessions', 'me', 'bookmarks'],
    queryFn:  async () => {
      const { data } = await api.get('/sessions/me/bookmarks');
      return data.data.sessions;
    },
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatRelativeDate = (dateStr) => {
  const d = new Date(dateStr);
  if (isToday(d))    return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  const diff = differenceInDays(d, new Date());
  if (diff < 7)      return `In ${diff} days`;
  return format(d, 'MMM d, yyyy');
};

// ─── Skeleton components ──────────────────────────────────────────────────────
function ExpoCardSkeleton() {
  return (
    <div className="card min-w-[260px] flex flex-col gap-3 snap-start">
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
      <div className="skeleton h-8 w-24 rounded mt-1" />
    </div>
  );
}

function SessionRowSkeleton() {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="skeleton h-10 w-12 rounded shrink-0" />
      <div className="flex flex-col gap-1.5 flex-1">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

// ─── Expo card (horizontal scroll) ───────────────────────────────────────────
function ExpoCard({ expo, index }) {
  const daysUntil = differenceInDays(new Date(expo.startDate), new Date());
  const isOngoing = expo.status === 'ongoing';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0  }}
      transition={{ delay: index * 0.06, duration: 0.25 }}
      className="card min-w-[260px] max-w-[280px] flex flex-col gap-3 snap-start
                 hover:shadow-level-2 transition-shadow duration-200"
    >
      {/* Status */}
      <div className="flex items-center justify-between">
        <span className={cn(
          'badge',
          isOngoing ? 'badge-success' : 'badge-info'
        )}>
          {isOngoing ? '🔴 Live Now' : formatRelativeDate(expo.startDate)}
        </span>
        {expo.theme && (
          <span className="font-mono text-label-sm text-on-surface-variant line-clamp-1 max-w-[120px]">
            {expo.theme}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-body-md font-semibold text-on-surface line-clamp-2 leading-snug">
        {expo.title}
      </h3>

      {/* Location */}
      <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
        <MapPin size={13} className="shrink-0" />
        <span className="line-clamp-1">
          {expo.address?.city}, {expo.address?.country}
        </span>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
          <Building2 size={12} />
          <span>{expo.boothCount ?? 0} booths</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
          <BookOpen size={12} />
          <span>{expo.sessionCount ?? 0} sessions</span>
        </div>
      </div>

      {/* CTA */}
      <Link
        to={`/attendee/expos/${expo._id}`}
        className="btn-secondary btn-sm gap-1.5 mt-auto"
      >
        Explore <ArrowRight size={13} />
      </Link>
    </motion.div>
  );
}

// ─── Session timeline row ─────────────────────────────────────────────────────
function SessionTimelineRow({ session, index }) {
  const isLive = session.status === 'live';
  const ended  = isPast(new Date(session.endTime)) && !isLive;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0  }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      className={cn(
        'flex items-start gap-3 rounded-md px-3 py-2.5 transition-colors',
        isLive
          ? 'bg-success-container/30 border border-success/30'
          : ended
          ? 'opacity-50'
          : 'hover:bg-surface-container-low'
      )}
    >
      {/* Time */}
      <div className="flex flex-col items-center gap-0.5 shrink-0 w-12 text-center">
        <span className="font-mono text-label-sm text-on-surface-variant">
          {format(new Date(session.startTime), 'MMM d')}
        </span>
        <span className="font-mono text-label-md font-semibold text-on-surface">
          {format(new Date(session.startTime), 'HH:mm')}
        </span>
      </div>

      {/* Divider line */}
      <div className={cn(
        'mt-1.5 h-full w-0.5 shrink-0 rounded-full self-stretch min-h-[32px]',
        isLive ? 'bg-success' : 'bg-outline-variant'
      )} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-body-sm font-medium text-on-surface line-clamp-1 flex-1">
            {session.title}
          </p>
          {isLive && (
            <span className="badge badge-success gap-1 shrink-0">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
              Live
            </span>
          )}
        </div>
        <p className="font-mono text-label-sm text-on-surface-variant mt-0.5">
          {session.location} · {session.format}
        </p>
      </div>
    </motion.div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconFg, label, value, to, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.22 }}
    >
      <Link
        to={to}
        className="card flex items-center gap-3 hover:shadow-level-2
                   transition-shadow duration-200 group block"
      >
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded', iconBg)}>
          <Icon size={17} className={iconFg} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-headline-sm font-bold text-on-surface">{value}</p>
          <p className="text-body-sm text-on-surface-variant">{label}</p>
        </div>
        <ChevronRight
          size={15}
          className="text-on-surface-variant opacity-0 group-hover:opacity-100
                     transition-opacity shrink-0"
        />
      </Link>
    </motion.div>
  );
}

// ─── Quick action ─────────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, description, to, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.22 }}
    >
      <Link
        to={to}
        className="card flex items-center gap-3 hover:shadow-level-2
                   transition-shadow duration-200 group"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded
                        bg-surface-container group-hover:bg-secondary-container/40
                        transition-colors duration-200">
          <Icon
            size={16}
            className="text-on-surface-variant group-hover:text-secondary transition-colors"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-sm font-medium text-on-surface group-hover:text-secondary transition-colors">
            {label}
          </p>
          <p className="font-mono text-label-sm text-on-surface-variant truncate">
            {description}
          </p>
        </div>
        <ArrowRight
          size={14}
          className="shrink-0 text-on-surface-variant opacity-0 group-hover:opacity-100
                     transition-opacity"
        />
      </Link>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AttendeeDashboard() {
  const { user } = useAuth();

  const { data: expos    = [], isLoading: expoLoading   } = useUpcomingExpos();
  const { data: sessions = [], isLoading: sessionLoading } = useMyRegistrations();
  const { data: bookmarks = [], isLoading: bookmarkLoading } = useMyBookmarks();

  // Split into upcoming and past sessions
  const { upcomingSessions, pastSessions } = useMemo(() => ({
    upcomingSessions: sessions
      .filter((s) => isFuture(new Date(s.endTime)) || s.status === 'live')
      .slice(0, 6),
    pastSessions: sessions
      .filter((s) => isPast(new Date(s.endTime)) && s.status !== 'live')
      .slice(0, 3),
  }), [sessions]);

  const upcomingBookmarks = useMemo(() =>
    bookmarks
      .filter((s) => isFuture(new Date(s.endTime)))
      .slice(0, 4),
    [bookmarks]
  );

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12
    ? 'Good morning'
    : greetingHour < 18
    ? 'Good afternoon'
    : 'Good evening';

  return (
    <div className="flex flex-col gap-section-gap">

      {/* ── Welcome ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-1"
      >
        <h1 className="text-headline-lg font-semibold text-on-surface">
          {greeting}, {user?.name?.split(' ')[0]} 👋
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Discover upcoming expos and manage your event schedule.
        </p>
      </motion.div>

      {/* ── Stats row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={CalendarDays}
          iconBg="bg-secondary-container"
          iconFg="text-on-secondary-container"
          label="Registered Sessions"
          value={sessions.length}
          to="/attendee/sessions"
          delay={0}
        />
        <StatCard
          icon={BookmarkCheck}
          iconBg="bg-tertiary-container"
          iconFg="text-on-tertiary-container"
          label="Bookmarked Sessions"
          value={bookmarks.length}
          to="/attendee/schedule"
          delay={0.05}
        />
        <StatCard
          icon={Compass}
          iconBg="bg-primary-container"
          iconFg="text-on-primary-container"
          label="Upcoming Expos"
          value={expos.length}
          to="/attendee/expos"
          delay={0.1}
        />
      </div>

      {/* ── Upcoming expos (horizontal scroll) ───────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-sm font-semibold text-on-surface">Upcoming Expos</h2>
          <Link to="/attendee/expos" className="btn-tertiary btn-sm gap-1">
            See all <ArrowRight size={13} />
          </Link>
        </div>

        {expoLoading ? (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <ExpoCardSkeleton key={i} />
            ))}
          </div>
        ) : expos.length === 0 ? (
          <div className="card border-dashed border-2 py-10 text-center">
            <div className="empty-state-icon mx-auto mb-3">
              <Compass size={22} />
            </div>
            <p className="text-body-sm font-medium text-on-surface">No upcoming expos</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Check back later for new events.
            </p>
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hidden">
            {expos.map((expo, i) => (
              <ExpoCard key={expo._id} expo={expo} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* ── Two-column: schedule + bookmarks ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* My Schedule */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface">
              My Schedule
            </h2>
            <Link to="/attendee/schedule" className="btn-tertiary btn-sm gap-1">
              Full schedule <ArrowRight size={13} />
            </Link>
          </div>

          {sessionLoading ? (
            <div className="flex flex-col gap-1">
              {Array.from({ length: 4 }).map((_, i) => (
                <SessionRowSkeleton key={i} />
              ))}
            </div>
          ) : upcomingSessions.length === 0 && pastSessions.length === 0 ? (
            <div className="card border-dashed border-2 py-10 text-center">
              <div className="empty-state-icon mx-auto mb-3">
                <CalendarDays size={22} />
              </div>
              <p className="text-body-sm font-medium text-on-surface">
                No sessions registered
              </p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Explore expos and register for sessions.
              </p>
              <Link
                to="/attendee/expos"
                className="btn-secondary btn-sm mt-4 inline-flex gap-1"
              >
                <Compass size={14} /> Browse Expos
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {upcomingSessions.length > 0 && (
                <>
                  <p className="mb-1 font-mono text-label-sm uppercase tracking-wider text-on-surface-variant px-3">
                    Upcoming
                  </p>
                  {upcomingSessions.map((s, i) => (
                    <SessionTimelineRow key={s._id} session={s} index={i} />
                  ))}
                </>
              )}

              {pastSessions.length > 0 && (
                <>
                  <p className="mt-3 mb-1 font-mono text-label-sm uppercase tracking-wider
                                text-on-surface-variant px-3">
                    Recent
                  </p>
                  {pastSessions.map((s, i) => (
                    <SessionTimelineRow key={s._id} session={s} index={i} />
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        {/* Bookmarked sessions */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface">
              Saved Sessions
            </h2>
            <Link to="/attendee/schedule" className="btn-tertiary btn-sm gap-1">
              View all <ArrowRight size={13} />
            </Link>
          </div>

          {bookmarkLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-md" />
              ))}
            </div>
          ) : upcomingBookmarks.length === 0 ? (
            <div className="card border-dashed border-2 py-10 text-center">
              <div className="empty-state-icon mx-auto mb-3">
                <BookmarkCheck size={22} />
              </div>
              <p className="text-body-sm font-medium text-on-surface">
                No bookmarked sessions
              </p>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                Tap the bookmark icon on any session to save it here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {upcomingBookmarks.map((session, i) => (
                <motion.div
                  key={session._id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                  className="flex items-start gap-3 rounded-md border border-outline-variant
                             bg-surface-bright px-4 py-3 hover:bg-surface-container-low
                             transition-colors"
                >
                  <BookmarkCheck size={15} className="text-tertiary shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-on-surface line-clamp-1">
                      {session.title}
                    </p>
                    <p className="font-mono text-label-sm text-on-surface-variant mt-0.5">
                      {format(new Date(session.startTime), 'MMM d, HH:mm')} · {session.location}
                    </p>
                  </div>
                  <span className="badge badge-neutral shrink-0 capitalize">
                    {session.format}
                  </span>
                </motion.div>
              ))}

              {bookmarks.length > 4 && (
                <Link
                  to="/attendee/schedule"
                  className="text-center py-1.5 font-mono text-label-sm text-tertiary
                             hover:text-secondary transition-colors"
                >
                  +{bookmarks.length - 4} more bookmarks →
                </Link>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Quick actions ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-headline-sm font-semibold text-on-surface">Explore</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickAction
            icon={Compass}
            label="Browse Expos"
            description="Find upcoming events near you"
            to="/attendee/expos"
            delay={0}
          />
          <QuickAction
            icon={BookOpen}
            label="Sessions"
            description="Register for talks and workshops"
            to="/attendee/sessions"
            delay={0.04}
          />
          <QuickAction
            icon={Building2}
            label="Exhibitors"
            description="Discover companies and products"
            to="/attendee/exhibitors"
            delay={0.08}
          />
          <QuickAction
            icon={MessageSquare}
            label="Messages"
            description="Chat with exhibitors and organisers"
            to="/attendee/messages"
            delay={0.12}
          />
        </div>
      </section>
    </div>
  );
}