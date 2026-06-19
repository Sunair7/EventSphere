import { useState, useCallback }    from 'react';
import { Link, useSearchParams }    from 'react-router-dom';
import { useQuery }                 from '@tanstack/react-query';
import { motion, AnimatePresence }  from 'framer-motion';
import {
  Search, X, Compass, MapPin, CalendarDays,
  Building2, BookOpen, ArrowRight, AlertCircle,
  RefreshCw, ChevronLeft, ChevronRight, Tag,
} from 'lucide-react';
import { format, isFuture, isPast } from 'date-fns';
import api                          from '@/utils/api';
import { cn }                       from '@/utils/cn';

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
    <div className="card flex flex-col gap-3">
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
      <div className="skeleton h-8 w-32 rounded mt-1" />
    </div>
  );
}

// ─── Expo card ────────────────────────────────────────────────────────────────
function ExpoCard({ expo, index }) {
  const isOngoing   = expo.status === 'ongoing';
  const isCompleted = expo.status === 'completed';
  const startDate   = new Date(expo.startDate);
  const endDate     = new Date(expo.endDate);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className={cn(
        'card flex flex-col gap-3 hover:shadow-level-2 transition-shadow duration-200 group',
        isOngoing   && 'border-success/30 bg-success-container/5',
        isCompleted && 'opacity-70'
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isOngoing ? (
            <span className="badge badge-success gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
              Live Now
            </span>
          ) : isCompleted ? (
            <span className="badge badge-neutral">Ended</span>
          ) : (
            <span className="badge badge-info">
              {format(startDate, 'MMM d, yyyy')}
            </span>
          )}
        </div>
        {expo.theme && (
          <span className="font-mono text-label-sm text-on-surface-variant line-clamp-1 max-w-[140px]">
            {expo.theme}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-body-md font-semibold text-on-surface line-clamp-2 leading-snug
                     group-hover:text-secondary transition-colors">
        {expo.title}
      </h3>

      {/* Description */}
      {expo.description && (
        <p className="text-body-sm text-on-surface-variant line-clamp-2 leading-relaxed">
          {expo.description}
        </p>
      )}

      {/* Location */}
      <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
        <MapPin size={13} className="shrink-0" />
        <span className="line-clamp-1">
          {expo.address?.venue
            ? `${expo.address.venue}, ${expo.address.city}`
            : `${expo.address?.city}, ${expo.address?.country}`}
        </span>
      </div>

      {/* Date range */}
      {!isOngoing && (
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <CalendarDays size={12} className="shrink-0" />
          <span>
            {format(startDate, 'MMM d')} — {format(endDate, 'MMM d, yyyy')}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <Building2 size={12} />
          <span>{expo.boothCount ?? 0} booths</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <BookOpen size={12} />
          <span>{expo.sessionCount ?? 0} sessions</span>
        </div>
        {expo.attendeeCount > 0 && (
          <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
            <span>{expo.attendeeCount.toLocaleString()} attendees</span>
          </div>
        )}
      </div>

      {/* Tags */}
      {expo.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {expo.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="badge badge-neutral text-label-sm">{tag}</span>
          ))}
          {expo.tags.length > 4 && (
            <span className="badge badge-neutral text-label-sm">+{expo.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* CTA */}
      <Link
        to={`/attendee/expos/${expo._id}`}
        className="btn-secondary btn-sm gap-1.5 mt-auto self-start"
      >
        Explore Expo <ArrowRight size={13} />
      </Link>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AttendeeExpos() {
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
    queryFn:  async () => {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(LIMIT),
        sort:  status === 'completed' ? 'start-desc' : 'start-asc',
      });
      if (search)    params.set('search', search);
      if (status)    params.set('status', status);
      else           params.set('status', 'published,ongoing,completed');
      if (activeTag) params.set('tags',   activeTag);
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
      <div className="page-header">
        <div>
          <h1 className="page-title">Discover Expos</h1>
          <p className="page-subtitle">
            {pagination.total !== undefined
              ? `${pagination.total} event${pagination.total !== 1 ? 's' : ''} available`
              : 'Browse upcoming and ongoing events.'}
          </p>
        </div>
      </div>

      {/* ── Status tabs ──────────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setParam('status', tab.value)}
            className={cn(
              'rounded px-3 py-1.5 text-body-sm font-medium transition-all duration-200',
              status === tab.value
                ? 'bg-primary text-on-primary'
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Search ───────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            type="search"
            placeholder="Search expos by title, theme, or location…"
            value={search}
            onChange={(e) => setParam('search', e.target.value)}
            className="input pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setParam('search', '')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant
                         hover:text-on-surface transition-colors"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
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
          <button
            key={tag}
            onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
            className={cn(
              'badge transition-all duration-200 cursor-pointer',
              activeTag === tag
                ? 'bg-secondary text-on-secondary'
                : 'badge-neutral hover:bg-surface-container-high'
            )}
          >
            {tag}
            {activeTag === tag && (
              <X size={10} className="ml-0.5" />
            )}
          </button>
        ))}
        {activeTag && !POPULAR_TAGS.includes(activeTag) && (
          <span className="badge bg-secondary text-on-secondary gap-1">
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
        <div className="empty-state py-16">
          <div className="empty-state-icon text-error"><AlertCircle size={24} /></div>
          <h3 className="empty-state-title">Failed to load expos</h3>
          <button onClick={() => refetch()} className="btn-ghost btn-sm mt-3 gap-1">
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      ) : expos.length === 0 ? (
        <div className="empty-state py-16">
          <div className="empty-state-icon"><Compass size={28} /></div>
          <h3 className="empty-state-title">No expos found</h3>
          <p className="empty-state-body">
            {search || activeTag || status
              ? 'Try adjusting your search or filters.'
              : 'No events are currently available. Check back soon.'}
          </p>
          {(search || activeTag || status) && (
            <button
              onClick={() => {
                setParam('search', '');
                setParam('status', '');
                setActiveTag('');
              }}
              className="btn-ghost btn-sm mt-3 gap-1"
            >
              <X size={13} /> Clear all filters
            </button>
          )}
        </div>
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
        <div className="flex items-center justify-between">
          <p className="font-mono text-label-sm text-on-surface-variant">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} events
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setParam('page', String(page - 1))}
              disabled={!pagination.hasPrevPage}
              className="btn-ghost btn-sm gap-1 disabled:opacity-40"
            >
              <ChevronLeft size={15} /> Prev
            </button>
            <button
              onClick={() => setParam('page', String(page + 1))}
              disabled={!pagination.hasNextPage}
              className="btn-ghost btn-sm gap-1 disabled:opacity-40"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}