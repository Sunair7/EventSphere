import { useState, useMemo }                    from 'react';
import { useParams, Link }                       from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion }                                from 'framer-motion';
import {
  ArrowLeft, MapPin, CalendarDays, Users,
  Building2, BookOpen, LayoutGrid, Clock,
  CheckCircle2, Bookmark, BookmarkCheck,
  AlertCircle, RefreshCw, Tag, Globe,
  Mic2, ArrowRight, ChevronRight,
} from 'lucide-react';
import { format, isFuture, isPast, differenceInDays } from 'date-fns';
import toast                                    from 'react-hot-toast';
import api                                      from '@/utils/api';
import { cn }                                   from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const expoKey      = (id) => ['expos', 'attendee', id];
const sessionsKey  = (id) => ['sessions', 'expo', id, 'attendee', 'preview'];
const myRegKey     = ['sessions', 'me', 'registrations'];
const myBmkKey     = ['sessions', 'me', 'bookmarks'];

// ─── Format badge ─────────────────────────────────────────────────────────────
const FORMAT_BADGE = {
  keynote:      'badge-info',
  panel:        'badge-neutral',
  workshop:     'badge-success',
  presentation: 'badge-neutral',
  networking:   'badge-warning',
  demo:         'badge-info',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatRelativeDate = (dateStr) => {
  const d    = new Date(dateStr);
  const diff = differenceInDays(d, new Date());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 0)  return `In ${diff} days`;
  return format(d, 'MMM d, yyyy');
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function HeroSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="skeleton h-8 w-64 rounded" />
      <div className="skeleton h-4 w-full rounded" />
      <div className="skeleton h-4 w-3/4 rounded" />
      <div className="flex gap-3">
        <div className="skeleton h-9 w-32 rounded" />
        <div className="skeleton h-9 w-28 rounded" />
      </div>
    </div>
  );
}

function SessionCardSkeleton() {
  return (
    <div className="card flex flex-col gap-3">
      <div className="skeleton h-4 w-16 rounded-sm" />
      <div className="skeleton h-5 w-3/4 rounded" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="skeleton h-8 w-full rounded" />
    </div>
  );
}

// ─── Session preview card ─────────────────────────────────────────────────────
function SessionPreviewCard({ session, isRegistered, isBookmarked, onRegister, onUnregister, onBookmark, isMutating }) {
  const isLive    = session.status === 'live';
  const isFull    = session.maxCapacity && (session.attendeeCount ?? 0) >= session.maxCapacity;
  const isPastSes = isPast(new Date(session.endTime)) && !isLive;

  return (
    <div className={cn(
      'card flex flex-col gap-3 transition-shadow duration-200 hover:shadow-level-2',
      isLive && 'border-success/30 bg-success-container/5'
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('badge', FORMAT_BADGE[session.format] || 'badge-neutral')}>
            {session.format}
          </span>
          {isLive && (
            <span className="badge badge-success gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
              Live
            </span>
          )}
        </div>
        <button
          onClick={onBookmark}
          disabled={isMutating}
          className={cn(
            'rounded p-1 transition-colors shrink-0',
            isBookmarked
              ? 'text-tertiary'
              : 'text-on-surface-variant hover:text-tertiary'
          )}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          {isBookmarked ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
      </div>

      <h4 className="text-body-sm font-semibold text-on-surface line-clamp-2 leading-snug">
        {session.title}
      </h4>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
          <Clock size={11} />
          <span>{format(new Date(session.startTime), 'HH:mm')}</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
          <MapPin size={11} />
          <span className="line-clamp-1">{session.location}</span>
        </div>
      </div>

      {session.speakers?.length > 0 && (
        <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
          <Mic2 size={11} />
          <span className="line-clamp-1">{session.speakers[0].name}
            {session.speakers.length > 1 && ` +${session.speakers.length - 1}`}
          </span>
        </div>
      )}

      {!isPastSes && session.status !== 'cancelled' && (
        isRegistered ? (
          <button
            onClick={onUnregister}
            disabled={isMutating}
            className="flex items-center justify-center gap-1.5 rounded border border-success
                       bg-success-container/30 px-3 py-2 text-body-sm font-medium
                       text-on-success-container hover:bg-error-container/20 hover:border-error
                       hover:text-on-error-container transition-all duration-200"
          >
            <CheckCircle2 size={14} /> Registered
          </button>
        ) : (
          <button
            onClick={onRegister}
            disabled={isFull || isMutating}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded px-3 py-2 text-body-sm font-medium transition-all',
              !isFull ? 'btn-secondary' : 'border border-outline-variant text-on-surface-variant cursor-not-allowed'
            )}
          >
            {isFull ? 'Session Full' : 'Register'}
          </button>
        )
      )}
    </div>
  );
}

// ─── Exhibitor preview card ───────────────────────────────────────────────────
function ExhibitorPreviewCard({ exhibitor }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-outline-variant
                    bg-surface-bright px-4 py-3 hover:bg-surface-container-low
                    transition-colors duration-150">
      {exhibitor.logo ? (
        <img src={exhibitor.logo} alt={exhibitor.companyName}
          className="h-8 w-8 rounded border border-outline-variant object-contain bg-surface-bright shrink-0" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded
                        bg-primary-container text-on-primary-container">
          <Building2 size={14} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-medium text-on-surface truncate">{exhibitor.companyName}</p>
        {exhibitor.industry && (
          <p className="font-mono text-label-sm text-on-surface-variant truncate">{exhibitor.industry}</p>
        )}
      </div>
      {exhibitor.isVerified && (
        <CheckCircle2 size={13} className="text-secondary shrink-0" />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AttendeeExpoDetail() {
  const { id }          = useParams();
  const queryClient     = useQueryClient();
  const [mutatingId, setMutatingId] = useState(null);

  // ── Fetch expo ──────────────────────────────────────────────────────────────
  const { data: expo, isLoading: expoLoading, isError } = useQuery({
    queryKey: expoKey(id),
    queryFn:  async () => {
      const { data } = await api.get(`/expos/${id}`);
      return data.data.expo;
    },
  });

  // ── Fetch sessions preview (first 6) ────────────────────────────────────────
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: sessionsKey(id),
    queryFn:  async () => {
      const { data } = await api.get(`/sessions/expo/${id}?limit=6&sort=startTime`);
      return data.data;
    },
    enabled: !!expo,
  });

  // ── Fetch exhibitors preview ────────────────────────────────────────────────
  const { data: exhibitorsData } = useQuery({
    queryKey: ['exhibitors', 'public', 'preview', id],
    queryFn:  async () => {
      const { data } = await api.get('/exhibitors/public?limit=6');
      return data.data;
    },
    enabled: !!expo,
  });

  // ── Fetch user's registrations and bookmarks ────────────────────────────────
  const { data: myRegistrations = [] } = useQuery({
    queryKey: myRegKey,
    queryFn:  async () => {
      const { data } = await api.get('/sessions/me/registrations');
      return data.data.sessions;
    },
  });

  const { data: myBookmarks = [] } = useQuery({
    queryKey: myBmkKey,
    queryFn:  async () => {
      const { data } = await api.get('/sessions/me/bookmarks');
      return data.data.sessions;
    },
  });

  const registeredIds = useMemo(() => new Set(myRegistrations.map((s) => s._id)), [myRegistrations]);
  const bookmarkedIds = useMemo(() => new Set(myBookmarks.map((s) => s._id)), [myBookmarks]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: (sessionId) => api.post(`/sessions/${sessionId}/register`),
    onSuccess: () => {
      toast.success('Registered successfully.');
      queryClient.invalidateQueries({ queryKey: myRegKey });
      queryClient.invalidateQueries({ queryKey: sessionsKey(id) });
      setMutatingId(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed to register.'); setMutatingId(null); },
  });

  const unregisterMutation = useMutation({
    mutationFn: (sessionId) => api.delete(`/sessions/${sessionId}/register`),
    onSuccess: () => {
      toast.success('Registration cancelled.');
      queryClient.invalidateQueries({ queryKey: myRegKey });
      queryClient.invalidateQueries({ queryKey: sessionsKey(id) });
      setMutatingId(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed to cancel.'); setMutatingId(null); },
  });

  const bookmarkMutation = useMutation({
    mutationFn: (sessionId) => api.post(`/sessions/${sessionId}/bookmark`),
    onSuccess: (res) => {
      const { isBookmarked } = res.data;
      toast.success(isBookmarked ? 'Session bookmarked.' : 'Bookmark removed.');
      queryClient.invalidateQueries({ queryKey: myBmkKey });
      setMutatingId(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed.'); setMutatingId(null); },
  });

  const handleAction = (sessionId, action) => {
    setMutatingId(sessionId);
    if (action === 'register')   registerMutation.mutate(sessionId);
    if (action === 'unregister') unregisterMutation.mutate(sessionId);
    if (action === 'bookmark')   bookmarkMutation.mutate(sessionId);
  };

  // ── Error state ─────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="empty-state py-20">
        <div className="empty-state-icon text-error"><AlertCircle size={28} /></div>
        <h3 className="empty-state-title">Expo not found</h3>
        <Link to="/attendee/expos" className="btn-ghost btn-sm mt-3 gap-1.5">
          <ArrowLeft size={14} /> Browse Expos
        </Link>
      </div>
    );
  }

  const sessions   = sessionsData?.sessions   || [];
  const exhibitors = exhibitorsData?.profiles || [];
  const isOngoing  = expo?.status === 'ongoing';
  const daysUntil  = expo ? differenceInDays(new Date(expo.startDate), new Date()) : null;

  return (
    <div className="flex flex-col gap-8">

      {/* ── Back ────────────────────────────────────────────────── */}
      <Link to="/attendee/expos" className="btn-ghost btn-sm gap-1.5 self-start">
        <ArrowLeft size={15} /> All Expos
      </Link>

      {/* ── Hero section ─────────────────────────────────────────── */}
      {expoLoading ? <HeroSkeleton /> : expo && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0  }}
          transition={{ duration: 0.3  }}
          className="flex flex-col gap-5"
        >
          {/* Status + theme */}
          <div className="flex items-center gap-2 flex-wrap">
            {isOngoing ? (
              <span className="badge badge-success gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                Live Now
              </span>
            ) : expo.status === 'completed' ? (
              <span className="badge badge-neutral">Event Ended</span>
            ) : daysUntil !== null && daysUntil >= 0 ? (
              <span className="badge badge-info">{formatRelativeDate(expo.startDate)}</span>
            ) : null}
            {expo.theme && (
              <span className="font-mono text-label-sm text-on-surface-variant">{expo.theme}</span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-headline-lg font-semibold text-on-surface">{expo.title}</h1>

          {/* Description */}
          {expo.description && (
            <p className="text-body-lg text-on-surface-variant leading-relaxed max-w-2xl">
              {expo.description}
            </p>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <CalendarDays size={15} className="text-secondary shrink-0" />
              <span>
                {format(new Date(expo.startDate), 'MMM d')} —{' '}
                {format(new Date(expo.endDate), 'MMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <MapPin size={15} className="text-secondary shrink-0" />
              <span className="truncate">
                {expo.address?.venue
                  ? `${expo.address.venue}, ${expo.address.city}`
                  : `${expo.address?.city}, ${expo.address?.country}`}
              </span>
            </div>
            <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <Building2 size={15} className="text-secondary shrink-0" />
              <span>{expo.boothCount ?? 0} exhibiting companies</span>
            </div>
            <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
              <BookOpen size={15} className="text-secondary shrink-0" />
              <span>{expo.sessionCount ?? 0} sessions</span>
            </div>
          </div>

          {/* Tags */}
          {expo.tags?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag size={13} className="text-on-surface-variant" />
              {expo.tags.map((tag) => (
                <span key={tag} className="badge badge-neutral">{tag}</span>
              ))}
            </div>
          )}

          {/* Quick nav buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              to={`/attendee/sessions?expoId=${id}`}
              className="btn-secondary gap-2"
            >
              <BookOpen size={15} /> Browse Sessions
            </Link>
            <Link
              to="/attendee/exhibitors"
              className="btn-ghost gap-2"
            >
              <Building2 size={15} /> View Exhibitors
            </Link>
          </div>
        </motion.div>
      )}

      {/* ── Stats bar ─────────────────────────────────────────────── */}
      {!expoLoading && expo && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Building2, label: 'Exhibitors',   value: expo.boothCount     ?? 0 },
            { icon: BookOpen,  label: 'Sessions',     value: expo.sessionCount   ?? 0 },
            { icon: Users,     label: 'Attendees',    value: expo.attendeeCount  ?? 0 },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="card flex flex-col items-center gap-1 py-4 text-center">
              <Icon size={18} className="text-secondary" />
              <p className="font-mono text-headline-sm font-bold text-on-surface">
                {value.toLocaleString()}
              </p>
              <p className="text-body-sm text-on-surface-variant">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Session highlights ───────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-sm font-semibold text-on-surface">Session Highlights</h2>
          <Link
            to={`/attendee/sessions?expoId=${id}`}
            className="btn-tertiary btn-sm gap-1"
          >
            All sessions <ArrowRight size={13} />
          </Link>
        </div>

        {sessionsLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => <SessionCardSkeleton key={i} />)}
          </div>
        ) : sessions.length === 0 ? (
          <div className="card border-dashed border-2 py-10 text-center">
            <p className="text-body-sm text-on-surface-variant">No sessions scheduled yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <SessionPreviewCard
                key={session._id}
                session={session}
                isRegistered={registeredIds.has(session._id)}
                isBookmarked={bookmarkedIds.has(session._id)}
                isMutating={mutatingId === session._id}
                onRegister={()   => handleAction(session._id, 'register')}
                onUnregister={() => handleAction(session._id, 'unregister')}
                onBookmark={()   => handleAction(session._id, 'bookmark')}
              />
            ))}
          </div>
        )}

        {(sessionsData?.pagination?.total ?? 0) > 6 && (
          <Link
            to={`/attendee/sessions?expoId=${id}`}
            className="mt-4 flex items-center justify-center gap-1.5 rounded-md border
                       border-outline-variant py-3 text-body-sm font-medium text-on-surface-variant
                       hover:bg-surface-container hover:text-on-surface transition-colors"
          >
            View all {sessionsData.pagination.total} sessions
            <ChevronRight size={15} />
          </Link>
        )}
      </section>

      {/* ── Exhibitors preview ───────────────────────────────────── */}
      {exhibitors.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface">Exhibiting Companies</h2>
            <Link to="/attendee/exhibitors" className="btn-tertiary btn-sm gap-1">
              Directory <ArrowRight size={13} />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {exhibitors.map((exhibitor) => (
              <ExhibitorPreviewCard key={exhibitor._id} exhibitor={exhibitor} />
            ))}
          </div>
        </section>
      )}

      {/* ── Floor plan CTA ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3    }}
        className="card flex items-center justify-between gap-4 bg-primary-container border-primary/20"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary">
            <LayoutGrid size={18} className="text-on-primary" />
          </div>
          <div>
            <p className="text-body-sm font-semibold text-on-primary-container">
              Explore the Floor Plan
            </p>
            <p className="font-mono text-label-sm text-on-primary-container/70">
              See booth locations and exhibitor placements.
            </p>
          </div>
        </div>
        <Link
          to={`/attendee/sessions?expoId=${id}`}
          className="btn-secondary btn-sm gap-1.5 shrink-0"
        >
          <LayoutGrid size={14} /> View Map
        </Link>
      </motion.div>
    </div>
  );
}