import { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useSearchParams }    from 'react-router-dom';
import { useQuery }                 from '@tanstack/react-query';
import { motion, AnimatePresence, useInView }  from 'framer-motion';
import {
  Search, X, Compass, MapPin, CalendarDays,
  Building2, BookOpen, ArrowRight, AlertCircle,
  RefreshCw, ChevronLeft, ChevronRight, Tag,
  Sparkles, Image, Users, Clock, Globe,
} from 'lucide-react';
import { format, isFuture, isPast, differenceInDays } from 'date-fns';
import api                          from '@/utils/api';
import { cn }                       from '@/utils/cn';
import { useAuth }                  from '@/context/AuthContext';

// ─── Animated Counter ─────────────────────────────────────────────────────────
function CountUp({ end, duration = 1, suffix = '' }) {
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

// ─── Query keys ───────────────────────────────────────────────────────────────
const expoKeys = {
  list: (params) => ['expos', 'attendee', 'list', params],
};

// ─── Status tabs ──────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { value: '',          label: 'All Events'  },
  { value: 'ongoing',   label: '🔴 Live Now'  },
  { value: 'published', label: 'Upcoming'    },
  { value: 'completed', label: 'Past Events' },
];

// ─── Popular tags (rendered as quick-filter pills) ────────────────────────────
const POPULAR_TAGS = [
  'Technology', 'Healthcare', 'Finance', 'Retail',
  'Manufacturing', 'Education', 'Sustainability', 'AI',
];

// ─── Skeleton card ────────────────────────────────────────────────────────────
function ExpoCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3 overflow-hidden">
      <div className="skeleton h-44 -mx-6 -mt-6 rounded-b-none" />
      <div className="flex items-start justify-between">
        <div className="skeleton h-5 w-16 rounded-sm" />
        <div className="skeleton h-4 w-24 rounded" />
      </div>
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-4 w-1/2 rounded" />
      <div className="skeleton h-3 w-2/3 rounded" />
      <div className="flex gap-3 mt-1">
        <div className="skeleton h-3 w-20 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
      <div className="skeleton h-9 w-32 rounded mt-1" />
    </div>
  );
}

// ─── Expo Banner ──────────────────────────────────────────────────────────────
function ExpoBanner({ banner, title, status, theme, startDate }) {
  const daysUntil = differenceInDays(new Date(startDate), new Date());
  const isOngoing = status === 'ongoing';
  const isSoon = daysUntil >= 0 && daysUntil <= 7;

  if (banner?.url) {
    return (
      <div className="relative -mx-6 -mt-6 mb-4 h-44 overflow-hidden rounded-t-xl">
        <img
          src={banner.url}
          alt={banner.altText || title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Status badge */}
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
            ) : isSoon ? `Starts in ${daysUntil}d` : format(new Date(startDate), 'MMM d, yyyy')}
          </span>
        </div>

        {/* Theme tag */}
        {theme && (
          <div className="absolute bottom-3 left-3">
            <span className="badge bg-black/30 text-white backdrop-blur-sm border border-white/10 text-label-sm">
              {theme}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Gradient placeholder
  const gradients = [
    'from-secondary/20 via-surface-container-low to-secondary/5',
    'from-tertiary/20 via-surface-container-low to-tertiary/5',
    'from-primary/20 via-surface-container-low to-primary/5',
    'from-warning/10 via-surface-container-low to-success/10',
  ];
  const gradient = gradients[Math.floor(Math.random() * gradients.length)];

  return (
    <div className={cn(
      'relative -mx-6 -mt-6 mb-4 h-44 overflow-hidden rounded-t-xl bg-gradient-to-br',
      gradient
    )}>
      {/* Decorative elements */}
      <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-white/10" />
      <div className="absolute bottom-4 left-4 w-12 h-12 rounded-full bg-white/5" />
      
      <div className="absolute inset-0 flex items-center justify-center">
        <Image size={40} className="text-on-surface-variant/15" />
      </div>

      {/* Status badge */}
      <div className="absolute top-3 left-3">
        {isOngoing ? (
          <span className="badge badge-success gap-1.5 shadow-sm">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="h-1.5 w-1.5 rounded-full bg-success"
            />
            Live Now
          </span>
        ) : (
          <span className="badge badge-info">
            {format(new Date(startDate), 'MMM d, yyyy')}
          </span>
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
function ExpoCard({ expo, index, basePath }) {
  const isOngoing   = expo.status === 'ongoing';
  const isCompleted = expo.status === 'completed';
  const startDate   = new Date(expo.startDate);
  const endDate     = new Date(expo.endDate);
  // ✅ isPast is already imported at the top, so this works
  const isPastEvent = isPast(endDate);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.05, ease: [0.4, 0, 0.2, 1] }}
      whileHover={!isCompleted ? { y: -4 } : {}}
      className={cn(
        'card flex flex-col hover:shadow-level-2 transition-all duration-300 group overflow-hidden rounded-xl',
        isOngoing   && 'ring-1 ring-success/20',
        isCompleted && 'opacity-60 hover:opacity-70 border-outline-variant/50'
      )}
    >
      {/* Banner */}
      <ExpoBanner
        banner={expo.banner}
        title={expo.title}
        status={expo.status}
        theme={expo.theme}
        startDate={expo.startDate}
      />

      {/* Title */}
      <h3 className={cn(
        "text-body-md font-semibold line-clamp-2 leading-snug transition-colors",
        isCompleted 
          ? "text-on-surface-variant" 
          : "text-on-surface group-hover:text-secondary"
      )}>
        {expo.title}
      </h3>

      {/* Description */}
      {expo.description && (
        <p className="text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed mt-1">
          {expo.description}
        </p>
      )}

      {/* Location */}
      <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant mt-2">
        <MapPin size={13} className="shrink-0" />
        <span className="line-clamp-1">
          {expo.address?.venue
            ? `${expo.address.venue}, ${expo.address.city}`
            : `${expo.address?.city}, ${expo.address?.country}`}
        </span>
      </div>

      {/* Date range */}
      <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant mt-1">
        <CalendarDays size={12} className="shrink-0" />
        <span>
          {format(startDate, 'MMM d')} — {format(endDate, 'MMM d, yyyy')}
        </span>
        {isCompleted && (
          <span className="ml-1.5 badge badge-neutral text-label-sm">
            Ended
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <Building2 size={11} />
          <span>{expo.boothCount ?? 0} booths</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <BookOpen size={11} />
          <span>{expo.sessionCount ?? 0} sessions</span>
        </div>
        {expo.attendeeCount > 0 && (
          <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
            <Users size={11} />
            <span>{expo.attendeeCount.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {expo.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
          {expo.tags.slice(0, 4).map((tag, i) => (
            <motion.span
              key={tag}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 + i * 0.03 }}
              className={cn(
                "badge text-label-sm",
                isCompleted ? "badge-neutral" : "badge-neutral"
              )}
            >
              {tag}
            </motion.span>
          ))}
          {expo.tags.length > 4 && (
            <span className="badge badge-neutral text-label-sm">+{expo.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* CTA */}
      {isCompleted ? (
        <div className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-outline-variant 
                        bg-surface-container px-4 py-2 text-body-sm font-medium text-on-surface-variant cursor-not-allowed">
          <Clock size={14} />
          Event Ended
        </div>
      ) : (
        <Link
          to={`${basePath}/expos/${expo._id}`}
          className="btn-secondary btn-sm gap-1.5 mt-auto group/btn"
        >
          Explore Event
          <ArrowRight size={13} className="transition-transform group-hover/btn:translate-x-0.5" />
        </Link>
      )}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AttendeeExpos() {
  const { user }                        = useAuth();
  const basePath                        = user?.role === 'attendee' ? '/attendee' : '/events';
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTag, setActiveTag]       = useState('');

  const page   = parseInt(searchParams.get('page')   || '1', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const LIMIT  = 9;

  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else        next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }, [setSearchParams]);

 // ── Fetch expos ─────────────────────────────────────────────────────────────
const { data, isLoading, isError, refetch } = useQuery({
  queryKey: expoKeys.list({ page, search, status, tag: activeTag, limit: LIMIT }),
  queryFn: async () => {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(LIMIT),
      sort: status === 'completed' ? 'start-desc' : 'start-asc',
    });
    
    if (search) params.set('search', search);
    
    // ✅ Status handling
    if (status === 'completed') {
      // Past Events tab - only show completed
      params.set('status', 'completed');
    } else if (status === 'ongoing') {
      // Live Now tab - only show ongoing
      params.set('status', 'ongoing');
    } else if (status === 'published') {
      // Upcoming tab - only show published
      params.set('status', 'published');
    } else {
      // All Events tab - show published and ongoing (exclude completed)
      params.set('status', 'published,ongoing');
    }
    
    if (activeTag) params.set('tags', activeTag);
    
    const { data } = await api.get(`/expos?${params}`);
    return data.data;
  },
  keepPreviousData: true,
});

  const expos      = data?.expos      || [];
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
            Discover Events
          </h1>
          <p className="page-subtitle">
            {!isLoading && pagination.total !== undefined
              ? <span><CountUp end={pagination.total} /> event{pagination.total !== 1 ? 's' : ''} available</span>
              : 'Browse upcoming and ongoing events.'}
          </p>
        </div>
      </motion.div>

      {/* ── Status tabs ──────────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <motion.button
            key={tab.value}
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
            onClick={() => setParam('status', tab.value)}
            className={cn(
              'relative rounded-lg px-3 py-1.5 text-body-sm font-medium transition-all duration-200',
              status === tab.value
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            )}
          >
            {tab.label}
            {status === tab.value && (
              <motion.span
                layoutId="attendee-expo-tab"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-t"
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-lg">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="search"
            placeholder="Search by title, theme, or location…"
            value={search}
            onChange={(e) => setParam('search', e.target.value)}
            className="input pl-9 pr-8"
          />
          {search && (
            <motion.button
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setParam('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant
                         hover:text-on-surface transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Tag filter pills ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant shrink-0">
          <Tag size={13} />
          <span>Topics:</span>
        </div>
        {POPULAR_TAGS.map((tag) => (
          <motion.button
            key={tag}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
            className={cn(
              'badge transition-all duration-200 cursor-pointer',
              activeTag === tag
                ? 'bg-secondary text-on-secondary shadow-sm'
                : 'badge-neutral hover:bg-surface-container-high'
            )}
          >
            {tag}
            {activeTag === tag && (
              <X size={10} className="ml-0.5" />
            )}
          </motion.button>
        ))}
        {activeTag && !POPULAR_TAGS.includes(activeTag) && (
          <span className="badge bg-secondary text-on-secondary gap-1 shadow-sm">
            {activeTag}
            <button onClick={() => setActiveTag('')} aria-label="Remove tag filter">
              <X size={10} />
            </button>
          </span>
        )}
      </div>

      {/* ── Expo grid ────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <ExpoCardSkeleton key={i} />)}
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
          <h3 className="empty-state-title">Failed to load events</h3>
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
          <h3 className="empty-state-title">No events found</h3>
          <p className="empty-state-body">
            {search || activeTag || status
              ? 'Try adjusting your search or filters.'
              : 'No events are currently available. Check back soon.'}
          </p>
          {(search || activeTag || status) && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                setParam('search', '');
                setParam('status', '');
                setActiveTag('');
              }}
              className="btn-ghost btn-sm mt-3 gap-1"
            >
              <X size={13} /> Clear all filters
            </motion.button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {expos.map((expo, i) => (
              <ExpoCard key={expo._id} expo={expo} index={i} basePath={basePath} />
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
            Page {pagination.page} of {pagination.totalPages} · {pagination.total.toLocaleString()} total
          </p>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ x: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setParam('page', String(page - 1))}
              disabled={!pagination.hasPrevPage}
              className="btn-ghost btn-sm gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Prev
            </motion.button>
            <motion.button
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setParam('page', String(page + 1))}
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