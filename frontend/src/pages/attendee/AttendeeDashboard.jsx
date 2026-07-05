import { useMemo, useRef, useEffect, useState } from 'react';
import { Link }                      from 'react-router-dom';
import { useQuery }                  from '@tanstack/react-query';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  Compass, CalendarDays, BookOpen, BookmarkCheck,
  MessageSquare, MapPin, ArrowRight, Clock,
  Building2, Users, TrendingUp, ChevronRight,
  Sparkles, Star, Zap, Globe, Ticket,
  ArrowUpRight, Play, Pause, Search, Filter, X,
} from 'lucide-react';
import {
  format, isFuture, isPast, differenceInDays,
  isToday, isTomorrow,
} from 'date-fns';
import api                           from '@/utils/api';
import { useAuth }                   from '@/context/AuthContext';
import { cn }                        from '@/utils/cn';

// ─── Animated Counter ─────────────────────────────────────────────────────────
function CountUp({ end, duration = 1.5, suffix = '' }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || !end && end !== 0) return;
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
      {display.toLocaleString()}{suffix}
    </span>
  );
}

// ─── Mouse Parallax Hook ──────────────────────────────────────────────────────
function useMouseParallax(strength = 20) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const { clientX, clientY } = e;
      const { innerWidth, innerHeight } = window;
      setOffset({
        x: (clientX / innerWidth - 0.5) * strength,
        y: (clientY / innerHeight - 0.5) * strength,
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [strength]);

  return offset;
}

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
function HeroSkeleton() {
  return (
    <div className="relative -mx-container-pad -mt-section-gap h-[400px] sm:h-[500px] overflow-hidden bg-surface-container-low">
      <motion.div
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 bg-gradient-to-br from-primary/10 to-secondary/5"
      />
      <div className="absolute bottom-0 left-0 right-0 p-container-pad pb-12">
        <div className="max-w-2xl space-y-4">
          <div className="skeleton h-6 w-32 rounded-full" />
          <div className="skeleton h-12 w-3/4 rounded-lg" />
          <div className="skeleton h-5 w-1/2 rounded" />
          <div className="flex gap-3">
            <div className="skeleton h-10 w-36 rounded-lg" />
            <div className="skeleton h-10 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpoCardSkeleton() {
  return (
    <div className="card min-w-[280px] flex flex-col gap-3 snap-start overflow-hidden">
      <div className="skeleton h-40 -mx-6 -mt-6 rounded-b-none" />
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
      <div className="skeleton h-9 w-full rounded mt-1" />
    </div>
  );
}

// ─── Hero Section ─────────────────────────────────────────────────────────────
function HeroSection({ greeting, userName, expos }) {
  const { x, y } = useMouseParallax(15);
  const nextExpo = expos?.[0];

  return (
    <div className="relative -mx-container-pad -mt-section-gap overflow-hidden">
      {/* Background */}
         <div className="relative h-[420px] sm:h-[500px] bg-gradient-to-br from-primary via-primary/95 to-secondary/80 overflow-hidden">
        
        {/* NEW: Banner Image Layer */}
  <div
    className="pointer-events-none absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-15"
    style={{
      backgroundImage: "url('/banner.jpg')",
    }}
    aria-hidden="true"
  />
        
        {/* Animated orbs */}
        <motion.div
          className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(0,106,97,0.4) 0%, transparent 70%)',
            x: x * 0.3,
            y: y * 0.3,
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(57,128,244,0.3) 0%, transparent 70%)',
            x: x * -0.2,
            y: y * -0.2,
          }}
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Content */}
        <div className="relative h-full mx-auto max-w-container px-container-pad flex flex-col justify-end pb-12 sm:pb-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            className="max-w-2xl"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-4"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 font-mono text-label-md text-white">
                <Sparkles size={14} className="text-secondary" />
                {expos?.length > 0 ? `${expos.length} upcoming event${expos.length !== 1 ? 's' : ''}` : 'Discover Events'}
              </span>
            </motion.div>

            {/* Heading */}
            <h1 className="font-sans text-display-lg sm:text-display-xl font-bold leading-tight text-white">
              {greeting}, {userName?.split(' ')[0]} 👋
            </h1>
            <p className="mt-3 text-body-lg text-white/70 leading-relaxed max-w-xl">
              {nextExpo
                ? `"${nextExpo.title}" starts ${formatRelativeDate(nextExpo.startDate)}. Explore sessions, exhibitors, and more.`
                : 'Discover extraordinary events, connect with exhibitors, and build your perfect schedule.'}
            </p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mt-6 flex flex-col sm:flex-row gap-3"
            >
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/attendee/expos"
                  className="btn-secondary btn-lg gap-2 inline-flex shadow-lg shadow-secondary/30"
                >
                  <Compass size={18} /> Explore Events
                </Link>
              </motion.div>
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link
                  to="/attendee/schedule"
                  className="btn-lg gap-2 rounded-lg border border-white/20 bg-white/10 backdrop-blur-sm
                             text-white hover:bg-white/20 transition-all inline-flex items-center"
                >
                  <CalendarDays size={18} /> My Schedule
                </Link>
              </motion.div>
            </motion.div>

            {/* Quick stats */}
            {expos?.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-8 flex gap-6"
              >
                {[
                  { label: 'Events', value: expos.length },
                  { label: 'Booths', value: expos.reduce((s, e) => s + (e.boothCount || 0), 0) },
                  { label: 'Sessions', value: expos.reduce((s, e) => s + (e.sessionCount || 0), 0) },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-baseline gap-1.5">
                    <span className="font-mono text-headline-sm font-bold text-white">
                      <CountUp end={stat.value} suffix="+" />
                    </span>
                    <span className="font-mono text-label-sm text-white/50">{stat.label}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>

        {/* Bottom gradient fade */}
        {/* <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" /> */}
      </div>
    </div>
  );
}

// ─── Expo Card (with banner) ──────────────────────────────────────────────────
function ExpoCard({ expo, index }) {
  const daysUntil = differenceInDays(new Date(expo.startDate), new Date());
  const isOngoing = expo.status === 'ongoing';
  const isSoon = daysUntil >= 0 && daysUntil <= 7;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      whileHover={{ y: -4 }}
      className="card min-w-[280px] max-w-[300px] flex flex-col snap-start overflow-hidden
                 hover:shadow-level-2 transition-all duration-300 group"
    >
      {/* Banner */}
      <div className="relative -mx-6 -mt-6 mb-4 h-40 overflow-hidden">
        {expo.banner?.url ? (
          <img
            src={expo.banner.url}
            alt={expo.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary/20 via-surface-container-low to-secondary/10" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        
        {/* Badges */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className={cn(
            'badge shadow-lg backdrop-blur-sm text-white border-0',
            isOngoing ? 'bg-success/90' : isSoon ? 'bg-warning/90' : 'bg-white/20'
          )}>
            {isOngoing ? (
              <span className="flex items-center gap-1">
                <motion.span
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="h-1.5 w-1.5 rounded-full bg-white"
                />
                Live Now
              </span>
            ) : formatRelativeDate(expo.startDate)}
          </span>
        </div>

        {expo.theme && (
          <div className="absolute bottom-3 left-3">
            <span className="badge bg-black/30 text-white backdrop-blur-sm border border-white/10 text-label-sm">
              {expo.theme}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <h3 className="text-body-md font-semibold text-on-surface line-clamp-2 leading-snug group-hover:text-secondary transition-colors">
        {expo.title}
      </h3>

      <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant mt-1.5">
        <MapPin size={13} className="shrink-0" />
        <span className="line-clamp-1">{expo.address?.city}, {expo.address?.country}</span>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
          <Building2 size={11} />
          <span>{expo.boothCount ?? 0} booths</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
          <BookOpen size={11} />
          <span>{expo.sessionCount ?? 0} sessions</span>
        </div>
      </div>

      <Link
        to={`/attendee/expos/${expo._id}`}
        className="btn-secondary btn-sm gap-1.5 mt-4 group/btn"
      >
        Explore
        <ArrowRight size={13} className="transition-transform group-hover/btn:translate-x-0.5" />
      </Link>
    </motion.div>
  );
}

// ─── Session Timeline Row ─────────────────────────────────────────────────────
function SessionTimelineRow({ session, index }) {
  const isLive = session.status === 'live';
  const ended = isPast(new Date(session.endTime)) && !isLive;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.2 }}
      whileHover={{ x: 3 }}
      className={cn(
        'flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-200',
        isLive
          ? 'bg-success-container/20 border border-success/20'
          : ended
          ? 'opacity-50'
          : 'hover:bg-surface-container-low'
      )}
    >
      <div className="flex flex-col items-center gap-0.5 shrink-0 w-12 text-center">
        <span className="font-mono text-label-sm text-on-surface-variant">
          {format(new Date(session.startTime), 'MMM d')}
        </span>
        <span className="font-mono text-label-md font-semibold text-on-surface">
          {format(new Date(session.startTime), 'HH:mm')}
        </span>
      </div>

      <div className={cn(
        'mt-1.5 w-0.5 shrink-0 rounded-full self-stretch min-h-[32px]',
        isLive ? 'bg-success' : 'bg-outline-variant'
      )} />

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-body-sm font-medium text-on-surface line-clamp-1 flex-1">
            {session.title}
          </p>
          {isLive && (
            <span className="badge badge-success gap-1 shrink-0">
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="h-1.5 w-1.5 rounded-full bg-success"
              />
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

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, iconBg, iconFg, label, value, to, delay, suffix }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      whileHover={{ y: -3 }}
    >
      <Link
        to={to}
        className="card flex items-center gap-4 hover:shadow-level-2
                   transition-all duration-200 group relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-transparent to-secondary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
        <motion.div
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.3 }}
          className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl relative z-10', iconBg)}
        >
          <Icon size={19} className={iconFg} />
        </motion.div>
        <div className="flex-1 min-w-0 relative z-10">
          <p className="font-mono text-headline-sm font-bold text-on-surface">
            <CountUp end={value} suffix={suffix || ''} />
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

// ─── Quick Action ─────────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, description, to, delay, color }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Link
        to={to}
        className="card flex items-center gap-4 hover:shadow-level-2
                   transition-all duration-200 group hover:border-secondary/20"
      >
        <motion.div
          whileHover={{ rotate: [0, -5, 5, 0] }}
          transition={{ duration: 0.3 }}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
            color || 'bg-surface-container group-hover:bg-secondary-container/30'
          )}
        >
          <Icon
            size={18}
            className={cn(
              'transition-colors',
              color ? 'text-white' : 'text-on-surface-variant group-hover:text-secondary'
            )}
          />
        </motion.div>
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
                     group-hover:translate-x-1 transition-all"
        />
      </Link>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AttendeeDashboard() {
  const { user } = useAuth();

  const { data: expos = [], isLoading: expoLoading } = useUpcomingExpos();
  const { data: sessions = [], isLoading: sessionLoading } = useMyRegistrations();
  const { data: bookmarks = [], isLoading: bookmarkLoading } = useMyBookmarks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExpoId, setSelectedExpoId] = useState('');

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

  // Search functionality
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['dashboard-search', searchQuery, selectedExpoId],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return { expos: [], sessions: [] };
      
      const results = { expos: [], sessions: [] };
      
      // Search expos
      const expoParams = new URLSearchParams();
      expoParams.set('status', 'published,ongoing');
      expoParams.set('limit', '5');
      expoParams.set('search', searchQuery);
      if (selectedExpoId) expoParams.set('expoId', selectedExpoId);
      
      try {
        const { data: expoData } = await api.get(`/expos?${expoParams}`);
        results.expos = expoData.data.expos || [];
      } catch (error) {
        console.error('Error searching expos:', error);
      }

      // Search sessions if expo selected
      if (selectedExpoId) {
        const sessionParams = new URLSearchParams();
        sessionParams.set('limit', '5');
        sessionParams.set('search', searchQuery);
        
        try {
          const { data: sessionData } = await api.get(`/sessions/expo/${selectedExpoId}?${sessionParams}`);
          results.sessions = sessionData.data.sessions || [];
        } catch (error) {
          console.error('Error searching sessions:', error);
        }
      }

      return results;
    },
    enabled: searchQuery.length >= 2,
    staleTime: 30000,
  });

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12
    ? 'Good morning'
    : greetingHour < 18
    ? 'Good afternoon'
    : 'Good evening';

  // Quick Search Component
  function QuickSearch() {
    if (!searchQuery || searchQuery.length < 2) return null;

    const hasResults = searchResults?.expos?.length > 0 || searchResults?.sessions?.length > 0;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-4 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-body-sm font-semibold text-on-surface flex items-center gap-2">
            <Search size={16} className="text-secondary" />
            Search Results for "{searchQuery}"
          </h3>
          <button
            onClick={() => setSearchQuery('')}
            className="text-on-surface-variant hover:text-on-surface"
          >
            <X size={16} />
          </button>
        </div>

        {searchLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : !hasResults ? (
          <p className="text-body-sm text-on-surface-variant text-center py-6">
            No results found for "{searchQuery}"
          </p>
        ) : (
          <div className="space-y-4">
            {/* Expos Results */}
            {searchResults.expos.length > 0 && (
              <div>
                <p className="text-label-sm text-on-surface-variant mb-2">Expos</p>
                <div className="space-y-2">
                  {searchResults.expos.map((expo) => (
                    <Link
                      key={expo._id}
                      to={`/attendee/expos/${expo._id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-outline-variant hover:border-secondary/30 hover:bg-surface-container-low transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-medium text-on-surface line-clamp-1">
                          {expo.title}
                        </p>
                        <p className="text-label-sm text-on-surface-variant">
                          {expo.address?.city}, {expo.address?.country} · {expo.sessionCount ?? 0} sessions
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-on-surface-variant shrink-0 ml-2" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Sessions Results */}
            {searchResults.sessions.length > 0 && (
              <div>
                <p className="text-label-sm text-on-surface-variant mb-2">Sessions</p>
                <div className="space-y-2">
                  {searchResults.sessions.map((session) => (
                    <Link
                      key={session._id}
                      to={`/attendee/sessions?expoId=${selectedExpoId}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-outline-variant hover:border-tertiary/30 hover:bg-surface-container-low transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm font-medium text-on-surface line-clamp-1">
                          {session.title}
                        </p>
                        <p className="text-label-sm text-on-surface-variant">
                          {format(new Date(session.startTime), 'MMM d, HH:mm')} · {session.location}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-on-surface-variant shrink-0 ml-2" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {hasResults && (
              <Link
                to="/attendee/expos"
                className="text-body-sm text-secondary hover:text-secondary/80 flex items-center gap-1 mt-2"
              >
                View all results <ArrowRight size={14} />
              </Link>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col">

      {/* ── Hero Section ──────────────────────────────────────────── */}
      {expoLoading ? (
        <HeroSkeleton />
      ) : (
        <HeroSection
          greeting={greeting}
          userName={user?.name}
          expos={expos}
        />
      )}


      <div className="flex flex-col gap-section-gap">

        {/* ── Stats Row ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
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
              label="Saved Sessions"
              value={bookmarks.length}
              to="/attendee/schedule"
              delay={0.05}
            />
            <StatCard
              icon={Compass}
              iconBg="bg-primary-container"
              iconFg="text-on-primary-container"
              label="Upcoming Events"
              value={expos.length}
              to="/attendee/expos"
              delay={0.1}
            />
          </div>
        </motion.div>

        {/* ── Upcoming Expos (Horizontal Scroll) ───────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-headline-lg font-semibold text-on-surface flex items-center gap-2">
              <Sparkles size={20} className="text-secondary" />
              Upcoming Events
            </h2>
            <Link to="/attendee/expos" className="btn-tertiary btn-sm gap-1 group/link">
              View All
              <ArrowRight size={13} className="transition-transform group-hover/link:translate-x-0.5" />
            </Link>
          </div>

          {expoLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <ExpoCardSkeleton key={i} />
              ))}
            </div>
          ) : expos.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="card border-2 border-dashed py-16 text-center hover:border-secondary/30 transition-all"
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
              >
                <Globe size={40} className="mx-auto text-on-surface-variant/20" />
              </motion.div>
              <h3 className="mt-4 text-headline-sm font-semibold text-on-surface">No events yet</h3>
              <p className="mt-2 text-body-sm text-on-surface-variant max-w-md mx-auto">
                New events will appear here once they're published. Check back soon!
              </p>
            </motion.div>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hidden -mx-container-pad px-container-pad">
              {expos.map((expo, i) => (
                <ExpoCard key={expo._id} expo={expo} index={i} />
              ))}
            </div>
          )}
        </motion.section>

        {/* ── Two Column: Schedule + Bookmarks ─────────────────────── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* My Schedule */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <CalendarDays size={18} className="text-secondary" />
                My Schedule
              </h2>
              <Link to="/attendee/schedule" className="btn-tertiary btn-sm gap-1 group/link">
                Full Schedule
                <ArrowRight size={13} className="transition-transform group-hover/link:translate-x-0.5" />
              </Link>
            </div>

            <div className="card">
              {sessionLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton h-14 rounded-lg" />
                  ))}
                </div>
              ) : upcomingSessions.length === 0 && pastSessions.length === 0 ? (
                <div className="py-10 text-center">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                  >
                    <CalendarDays size={28} className="mx-auto text-on-surface-variant/20" />
                  </motion.div>
                  <p className="mt-3 text-body-sm font-medium text-on-surface">No sessions yet</p>
                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    Register for sessions to build your schedule.
                  </p>
                  <Link to="/attendee/expos" className="btn-secondary btn-sm mt-4 inline-flex gap-1">
                    <Compass size={14} /> Browse Events
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  {upcomingSessions.length > 0 && (
                    <>
                      <p className="mb-2 font-mono text-label-sm uppercase tracking-wider text-on-surface-variant px-3">
                        Upcoming
                      </p>
                      {upcomingSessions.map((s, i) => (
                        <SessionTimelineRow key={s._id} session={s} index={i} />
                      ))}
                    </>
                  )}
                  {pastSessions.length > 0 && (
                    <>
                      <p className="mt-4 mb-2 font-mono text-label-sm uppercase tracking-wider text-on-surface-variant px-3">
                        Recent
                      </p>
                      {pastSessions.map((s, i) => (
                        <SessionTimelineRow key={s._id} session={s} index={i} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.section>

          {/* Saved Sessions */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <BookmarkCheck size={18} className="text-secondary" />
                Saved Sessions
              </h2>
              <Link to="/attendee/schedule" className="btn-tertiary btn-sm gap-1 group/link">
                View All
                <ArrowRight size={13} className="transition-transform group-hover/link:translate-x-0.5" />
              </Link>
            </div>

            <div className="card">
              {bookmarkLoading ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton h-14 rounded-lg" />
                  ))}
                </div>
              ) : upcomingBookmarks.length === 0 ? (
                <div className="py-10 text-center">
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ repeat: Infinity, duration: 3 }}
                  >
                    <BookmarkCheck size={28} className="mx-auto text-on-surface-variant/20" />
                  </motion.div>
                  <p className="mt-3 text-body-sm font-medium text-on-surface">No saved sessions</p>
                  <p className="mt-1 text-body-sm text-on-surface-variant">
                    Bookmark sessions to save them for later.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {upcomingBookmarks.map((session, i) => (
                    <motion.div
                      key={session._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      whileHover={{ x: 3 }}
                      className="flex items-start gap-3 rounded-lg border border-outline-variant
                                 px-4 py-3 hover:bg-surface-container-low hover:border-secondary/20
                                 transition-all duration-200"
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
                      <span className="badge badge-neutral shrink-0 capitalize text-label-sm">
                        {session.format}
                      </span>
                    </motion.div>
                  ))}
                  {bookmarks.length > 4 && (
                    <Link
                      to="/attendee/schedule"
                      className="text-center py-2 font-mono text-label-sm text-tertiary
                                 hover:text-secondary transition-colors"
                    >
                      +{bookmarks.length - 4} more →
                    </Link>
                  )}
                </div>
              )}
            </div>
          </motion.section>
        </div>

        {/* ── Quick Actions ─────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="mb-3 text-headline-sm font-semibold text-on-surface flex items-center gap-2">
            <Zap size={18} className="text-secondary" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              icon={Search}
              label="Search Events"
              description="Find expos & sessions"
              to="/attendee/expos"
              delay={0}
              color="bg-secondary text-white"
            />
            <QuickAction
              icon={CalendarDays}
              label="My Schedule"
              description="View registered sessions"
              to="/attendee/schedule"
              delay={0.05}
              color="bg-tertiary text-white"
            />
            <QuickAction
              icon={BookOpen}
              label="Browse Sessions"
              description="Explore talks & workshops"
              to="/attendee/sessions"
              delay={0.1}
              color="bg-primary text-white"
            />
            <QuickAction
              icon={Building2}
              label="Exhibitors"
              description="Meet companies & brands"
              to="/attendee/exhibitors"
              delay={0.15}
            />
          </div>
        </motion.section>
      </div>
    </div>
  );
}