import { useState, useCallback }    from 'react';
import { Link, useSearchParams }    from 'react-router-dom';
import { useQuery }                 from '@tanstack/react-query';
import { motion, AnimatePresence }  from 'framer-motion';
import {
  Search, X, Compass, MapPin, CalendarDays,
  LayoutGrid, BookOpen, ArrowRight, AlertCircle,
  RefreshCw, ChevronLeft, ChevronRight,
  CheckCircle2, Clock,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import api                          from '@/utils/api';
import { cn }                       from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const expoKeys = {
  list:             (p) => ['expos', 'exhibitor', 'list', p],
  boothAvailability:(id) => ['booths', 'expo', id, 'availability'],
};

// ─── Status tabs ──────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { value: '',          label: 'All Events'  },
  { value: 'ongoing',   label: '🔴 Live Now'  },
  { value: 'published', label: 'Open for Applications' },
  { value: 'completed', label: 'Past'         },
];

// ─── Skeleton ────────────────────────────────────────────────────────────────
function ExpoCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3">
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
    queryFn:  async () => {
      const { data } = await api.get(`/booths/expo/${expoId}/availability`);
      return data.data.summary;
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

  const available = data?.find((s) => s.status === 'available')?.count ?? 0;
  const pending   = data?.find((s) => s.status === 'pending')?.count   ?? 0;
  const assigned  = data?.find((s) => s.status === 'assigned')?.count  ?? 0;
  const total     = available + pending + assigned;

  return (
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: 'Available', count: available, color: 'text-secondary',         bg: 'bg-secondary-container/40'   },
        { label: 'Pending',   count: pending,   color: 'text-on-warning-container', bg: 'bg-warning-container/40' },
        { label: 'Assigned',  count: assigned,  color: 'text-on-surface-variant', bg: 'bg-surface-container'       },
      ].map(({ label, count, color, bg }) => (
        <div key={label} className={cn('rounded px-2 py-2 text-center', bg)}>
          <p className={cn('font-mono text-headline-sm font-bold', color)}>{count}</p>
          <p className="font-mono text-label-sm text-on-surface-variant">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Expo card ────────────────────────────────────────────────────────────────
function ExpoCard({ expo, index }) {
  const isOngoing   = expo.status === 'ongoing';
  const isCompleted = expo.status === 'completed';
  const startDate   = new Date(expo.startDate);
  const endDate     = new Date(expo.endDate);
  const daysUntil   = differenceInDays(startDate, new Date());
  const isOpen      = expo.status === 'published' || isOngoing;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8  }}
      animate={{ opacity: 1, y: 0  }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, delay: index * 0.04 }}
      className={cn(
        'card flex flex-col gap-4 hover:shadow-level-2 transition-shadow duration-200',
        isCompleted && 'opacity-60',
        isOngoing   && 'border-success/30'
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
          ) : daysUntil >= 0 ? (
            <span className="badge badge-info">
              {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}
            </span>
          ) : null}

          {isOpen && expo.registrationDeadline && (
            <span className="flex items-center gap-1 font-mono text-label-sm text-warning">
              <Clock size={11} />
              Deadline: {format(new Date(expo.registrationDeadline), 'MMM d')}
            </span>
          )}
        </div>
        {expo.theme && (
          <span className="font-mono text-label-sm text-on-surface-variant line-clamp-1 max-w-[130px]">
            {expo.theme}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-body-md font-semibold text-on-surface line-clamp-2 leading-snug">
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
          <span>{format(startDate, 'MMM d')} — {format(endDate, 'MMM d, yyyy')}</span>
        </div>
      </div>

      {/* Booth availability summary */}
      {isOpen && <BoothSummary expoId={expo._id} />}

      {/* Sessions count */}
      {!isOpen && (
        <div className="flex items-center gap-1.5 font-mono text-label-sm text-on-surface-variant">
          <BookOpen size={12} />
          <span>{expo.sessionCount ?? 0} sessions · {expo.boothCount ?? 0} booths</span>
        </div>
      )}

      {/* CTA */}
      {isOpen ? (
        <Link
          to={`/exhibitor/expos/${expo._id}/floor-plan`}
          className="btn-secondary gap-2 w-full justify-center"
        >
          <LayoutGrid size={15} /> View Floor Plan & Apply
        </Link>
      ) : (
        <Link
          to={`/exhibitor/expos/${expo._id}`}
          className="btn-ghost gap-2 w-full justify-center"
        >
          View Details <ArrowRight size={13} />
        </Link>
      )}
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExhibitorExpos() {
  const [searchParams, setSearchParams] = useSearchParams();

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
    queryKey: expoKeys.list({ page, search, status, limit: LIMIT }),
    queryFn:  async () => {
      const params = new URLSearchParams({
        page:   String(page),
        limit:  String(LIMIT),
        sort:   status === 'completed' ? 'start-desc' : 'start-asc',
      });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      else        params.set('status', 'published,ongoing,completed');
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
          <h1 className="page-title">Browse Expos</h1>
          <p className="page-subtitle">
            Find expos with available booth spaces and submit your application.
          </p>
        </div>
      </div>

      {/* ── Application tip ─────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-md bg-primary-container px-4 py-3">
        <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-on-primary-container" />
        <p className="text-body-sm text-on-primary-container">
          Your exhibitor application must be <span className="font-semibold">approved</span> before
          you can reserve a booth. Each expo card shows live booth availability.
          Click <span className="font-semibold">View Floor Plan & Apply</span> to select your space.
        </p>
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
      <div className="relative max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
        <input
          type="search"
          placeholder="Search expos…"
          value={search}
          onChange={(e) => setParam('search', e.target.value)}
          className="input pl-9 pr-8"
        />
        {search && (
          <button
            onClick={() => setParam('search', '')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Grid ─────────────────────────────────────────────────── */}
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
            {search || status
              ? 'Try adjusting your search or filters.'
              : 'No upcoming expos are currently accepting applications.'}
          </p>
          {(search || status) && (
            <button
              onClick={() => { setParam('search', ''); setParam('status', ''); }}
              className="btn-ghost btn-sm mt-3 gap-1"
            >
              <X size={13} /> Clear filters
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
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} expos
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