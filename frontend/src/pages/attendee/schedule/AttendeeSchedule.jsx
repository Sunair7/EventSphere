import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  CalendarDays, BookmarkCheck, Bookmark,
  CheckCircle2, MapPin, Clock, Mic2,
  Users, X, BookOpen, AlertCircle,
  ChevronLeft, ChevronRight, Sparkles,
  Star, ExternalLink, Globe,
} from 'lucide-react';
import {
  format, parseISO, isSameDay, startOfDay,
  addDays, differenceInMinutes, isPast,
} from 'date-fns';
import toast from 'react-hot-toast';
import api from '@/utils/api';
import { cn } from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const myRegKey       = ['sessions', 'me', 'registrations'];
const myBookmarkKey  = ['sessions', 'me', 'bookmarks'];

// ─── Fetch hooks ──────────────────────────────────────────────────────────────
const useMyRegistrations = () =>
  useQuery({
    queryKey: myRegKey,
    queryFn:  async () => { const { data } = await api.get('/sessions/me/registrations'); return data.data.sessions; },
  });

const useMyBookmarks = () =>
  useQuery({
    queryKey: myBookmarkKey,
    queryFn:  async () => { const { data } = await api.get('/sessions/me/bookmarks'); return data.data.sessions; },
  });

// ─── Format badge ─────────────────────────────────────────────────────────────
const FORMAT_COLOR = {
  keynote:      'bg-tertiary-container text-on-tertiary-container',
  panel:        'bg-surface-container-high text-on-surface-variant',
  workshop:     'bg-success-container text-on-success-container',
  presentation: 'bg-primary-container text-on-primary-container',
  networking:   'bg-warning-container text-on-warning-container',
  demo:         'bg-secondary-container text-on-secondary-container',
  other:        'bg-surface-container text-on-surface-variant',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function AgendaRowSkeleton() {
  return (
    <div className="flex items-start gap-3 py-2 px-4">
      <div className="skeleton h-10 w-14 rounded shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-1/2 rounded" />
      </div>
    </div>
  );
}

// ─── Session detail panel ─────────────────────────────────────────────────────
function SessionDetailPanel({ session, isRegistered, isBookmarked, onClose, onUnregister, onBookmark, isMutating }) {
  const isPastSes = isPast(new Date(session.endTime)) && session.status !== 'live';
  const duration  = differenceInMinutes(new Date(session.endTime), new Date(session.startTime));

  return (
    <motion.aside
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 30 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="flex w-80 shrink-0 flex-col gap-4 rounded-xl border border-outline-variant
                 bg-surface-bright p-5 shadow-level-2 overflow-y-auto max-h-[calc(100dvh-8rem)]
                 sticky top-20"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className={cn('badge text-label-sm capitalize mb-2 inline-block',
              FORMAT_COLOR[session.format] || FORMAT_COLOR.other)}
          >
            {session.format}
          </motion.span>
          <h3 className="text-body-md font-semibold text-on-surface leading-snug">
            {session.title}
          </h3>
        </div>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="shrink-0 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container
                     hover:text-on-surface transition-colors"
        >
          <X size={16} />
        </motion.button>
      </div>

      {/* Status badges */}
      <div className="flex items-center gap-2 flex-wrap">
        {session.status === 'live' && (
          <span className="badge badge-success gap-1">
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="h-1.5 w-1.5 rounded-full bg-success"
            />
            Live Now
          </span>
        )}
        {isRegistered && (
          <span className="badge badge-success gap-1">
            <CheckCircle2 size={11} /> Registered
          </span>
        )}
        {isBookmarked && (
          <span className="badge badge-info gap-1">
            <BookmarkCheck size={11} /> Saved
          </span>
        )}
      </div>

      <div className="divider" />

      {/* Meta */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-on-surface-variant shrink-0" />
          <span className="font-mono text-label-md text-on-surface">
            {format(new Date(session.startTime), 'HH:mm')} — {format(new Date(session.endTime), 'HH:mm')}
            <span className="ml-1.5 text-on-surface-variant">({duration} min)</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-on-surface-variant shrink-0" />
          <span className="text-body-sm text-on-surface">{session.location}</span>
        </div>
        {session.maxCapacity && (
          <div className="flex items-center gap-2">
            <Users size={14} className="text-on-surface-variant shrink-0" />
            <span className="font-mono text-label-md text-on-surface">
              {session.attendeeCount ?? 0} / {session.maxCapacity} registered
            </span>
            {/* Capacity bar */}
            <div className="flex-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(((session.attendeeCount ?? 0) / session.maxCapacity) * 100, 100)}%` }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className={cn(
                  'h-full rounded-full',
                  (session.attendeeCount ?? 0) / session.maxCapacity >= 0.9 ? 'bg-error'
                    : (session.attendeeCount ?? 0) / session.maxCapacity >= 0.7 ? 'bg-warning'
                    : 'bg-secondary'
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* Speakers */}
      {session.speakers?.length > 0 && (
        <>
          <div className="divider" />
          <div>
            <p className="mb-2 font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
              {session.speakers.length === 1 ? 'Speaker' : 'Speakers'}
            </p>
            <div className="flex flex-col gap-2">
              {session.speakers.map((speaker, i) => (
                <motion.div
                  key={speaker._id || speaker.name}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                                  bg-primary-container font-mono text-label-sm font-bold text-on-primary-container">
                    {speaker.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-body-sm font-medium text-on-surface">{speaker.name}</p>
                    {(speaker.title || speaker.company) && (
                      <p className="font-mono text-label-sm text-on-surface-variant">
                        {[speaker.title, speaker.company].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Description */}
      {session.description && (
        <>
          <div className="divider" />
          <p className="text-body-sm text-on-surface-variant leading-relaxed">
            {session.description}
          </p>
        </>
      )}

      {/* Tags */}
      {session.tags?.length > 0 && (
        <>
          <div className="divider" />
          <div className="flex flex-wrap gap-1.5">
            {session.tags.map((tag, i) => (
              <motion.span
                key={tag}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="badge badge-neutral"
              >
                {tag}
              </motion.span>
            ))}
          </div>
        </>
      )}

      {/* Resources */}
      {session.resources?.length > 0 && (
        <>
          <div className="divider" />
          <div>
            <p className="mb-2 font-mono text-label-sm uppercase tracking-wider text-on-surface-variant">
              Resources
            </p>
            {session.resources.map((r) => (
              <motion.a
                key={r._id}
                whileHover={{ x: 3 }}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-body-sm
                           text-tertiary hover:bg-surface-container transition-all"
              >
                <BookOpen size={13} />
                {r.label}
                <ExternalLink size={10} className="ml-auto opacity-50" />
              </motion.a>
            ))}
          </div>
        </>
      )}

      <div className="divider" />

      {/* Actions */}
      <div className="flex flex-col gap-2">
        {!isPastSes && isRegistered && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onUnregister}
            disabled={isMutating}
            className="btn-ghost w-full gap-1.5 text-error hover:bg-error-container justify-center"
          >
            <X size={14} /> Cancel Registration
          </motion.button>
        )}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onBookmark}
          disabled={isMutating}
          className={cn(
            'btn-ghost w-full gap-1.5 justify-center',
            isBookmarked && 'text-tertiary border-tertiary'
          )}
        >
          {isBookmarked
            ? <><BookmarkCheck size={14} /> Remove Bookmark</>
            : <><Bookmark size={14} /> Bookmark Session</>}
        </motion.button>
      </div>
    </motion.aside>
  );
}

// ─── Agenda session row ───────────────────────────────────────────────────────
function AgendaRow({ session, isRegistered, isBookmarked, onClick, isSelected }) {
  const isLive    = session.status === 'live';
  const isPastSes = isPast(new Date(session.endTime)) && !isLive;

  return (
    <motion.button
      layout
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.995 }}
      onClick={() => onClick(session)}
      className={cn(
        'flex w-full items-start gap-4 rounded-lg px-4 py-3 text-left transition-all duration-200',
        isSelected
          ? 'bg-primary-container ring-1 ring-primary/20 shadow-sm'
          : 'hover:bg-surface-container-low',
        isPastSes && 'opacity-50'
      )}
    >
      {/* Time column */}
      <div className="flex flex-col items-center gap-0.5 shrink-0 w-14 text-center">
        <span className="font-mono text-label-sm text-on-surface-variant leading-none">
          {format(new Date(session.startTime), 'HH:mm')}
        </span>
        <div className={cn(
          'h-3 w-0.5 my-0.5 rounded-full',
          isLive ? 'bg-success' : 'bg-outline-variant'
        )} />
        <span className="font-mono text-label-sm text-on-surface-variant leading-none">
          {format(new Date(session.endTime), 'HH:mm')}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1">
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className={cn('badge text-label-sm capitalize shrink-0',
              FORMAT_COLOR[session.format] || FORMAT_COLOR.other)}
          >
            {session.format}
          </motion.span>
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
          {isRegistered && (
            <span className="flex items-center gap-0.5 font-mono text-label-sm text-secondary shrink-0">
              <CheckCircle2 size={11} /> Registered
            </span>
          )}
          {isBookmarked && !isRegistered && (
            <span className="flex items-center gap-0.5 font-mono text-label-sm text-tertiary shrink-0">
              <BookmarkCheck size={11} /> Saved
            </span>
          )}
        </div>

        <p className="text-body-sm font-medium text-on-surface line-clamp-1 mb-0.5">
          {session.title}
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
            <MapPin size={10} />
            <span>{session.location}</span>
          </div>
          {session.speakers?.length > 0 && (
            <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant">
              <Mic2 size={10} />
              <span className="line-clamp-1">
                {session.speakers[0].name}
                {session.speakers.length > 1 && ` +${session.speakers.length - 1}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Arrow indicator */}
      <ChevronRight
        size={16}
        className={cn(
          'shrink-0 self-center transition-all',
          isSelected ? 'text-primary rotate-90' : 'text-on-surface-variant/30'
        )}
      />
    </motion.button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AttendeeSchedule() {
  const queryClient                     = useQueryClient();
  const [view, setView]                 = useState('registered');
  const [selectedSession, setSelected]  = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [mutatingId, setMutatingId]     = useState(null);

  const { data: registrations = [], isLoading: regLoading } = useMyRegistrations();
  const { data: bookmarks = [], isLoading: bmkLoading } = useMyBookmarks();

  const isLoading = regLoading || bmkLoading;

  const activeSessions = view === 'registered' ? registrations : bookmarks;

  const registeredIds = useMemo(() => new Set(registrations.map((s) => s._id)), [registrations]);
  const bookmarkedIds = useMemo(() => new Set(bookmarks.map((s) => s._id)), [bookmarks]);

  const groupedByDate = useMemo(() => {
    const groups = {};
    activeSessions.forEach((s) => {
      const key = startOfDay(new Date(s.startTime)).toISOString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    Object.values(groups).forEach((arr) =>
      arr.sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    );
    return groups;
  }, [activeSessions]);

  const sortedDates = useMemo(() =>
    Object.keys(groupedByDate).sort(),
    [groupedByDate]
  );

  const activeDateKey = selectedDate || sortedDates[0] || null;
  const sessionsForDay = activeDateKey ? (groupedByDate[activeDateKey] || []) : [];

  const dateIndex      = sortedDates.indexOf(activeDateKey);
  const hasPrevDate    = dateIndex > 0;
  const hasNextDate    = dateIndex < sortedDates.length - 1;

  // ── Mutations ────────────────────────────────────────────────────────────────
  const unregisterMutation = useMutation({
    mutationFn: (id) => api.delete(`/sessions/${id}/register`),
    onSuccess: () => {
      toast.success('Registration cancelled.');
      queryClient.invalidateQueries({ queryKey: myRegKey });
      if (selectedSession) setSelected(null);
      setMutatingId(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed to cancel.'); setMutatingId(null); },
  });

  const bookmarkMutation = useMutation({
    mutationFn: (id) => api.post(`/sessions/${id}/bookmark`),
    onSuccess: (res) => {
      const { isBookmarked } = res.data;
      toast.success(isBookmarked ? 'Bookmarked! 🔖' : 'Bookmark removed.');
      queryClient.invalidateQueries({ queryKey: myBookmarkKey });
      setMutatingId(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed.'); setMutatingId(null); },
  });

  const handleUnregister = (id) => { setMutatingId(id); unregisterMutation.mutate(id); };
  const handleBookmark   = (id) => { setMutatingId(id); bookmarkMutation.mutate(id); };

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
            My Schedule
          </h1>
          <p className="page-subtitle">Your personalised event agenda.</p>
        </div>

        {/* View toggle */}
        <div className="flex rounded-lg border border-outline-variant overflow-hidden shrink-0">
          {[
            { key: 'registered', label: `Registered`, icon: CheckCircle2, count: registrations.length },
            { key: 'bookmarked', label: `Saved`, icon: BookmarkCheck, count: bookmarks.length },
          ].map(({ key, label, icon: Icon, count }) => (
            <motion.button
              key={key}
              whileHover={{ backgroundColor: view !== key ? 'rgba(0,0,0,0.02)' : undefined }}
              onClick={() => { setView(key); setSelectedDate(null); setSelected(null); }}
              className={cn(
                'relative flex items-center gap-1.5 px-4 py-2 text-body-sm font-medium transition-all duration-200',
                view === key
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <Icon size={14} />
              <span className="hidden sm:inline">{label}</span>
              <span className={cn(
                'font-mono text-label-sm ml-0.5',
                view === key ? 'text-on-primary/70' : 'text-on-surface-variant/50'
              )}>
                ({count})
              </span>
              {view === key && (
                <motion.span
                  layoutId="schedule-tab-indicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-t"
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Empty state ───────────────────────────────────────────── */}
      {!isLoading && activeSessions.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="empty-state py-20"
        >
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="empty-state-icon"
          >
            {view === 'registered' ? <CheckCircle2 size={28} /> : <BookmarkCheck size={28} />}
          </motion.div>
          <h3 className="empty-state-title">
            {view === 'registered' ? 'No registered sessions' : 'No saved sessions'}
          </h3>
          <p className="empty-state-body">
            {view === 'registered'
              ? 'Browse sessions and register to build your schedule.'
              : 'Bookmark sessions to save them for later.'}
          </p>
        </motion.div>
      )}

      {/* ── Main schedule view ────────────────────────────────────── */}
      {(isLoading || activeSessions.length > 0) && (
        <div className="flex items-start gap-6">

          {/* Left: agenda */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">

            {/* Day navigation */}
            {!isLoading && sortedDates.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3"
              >
                <motion.button
                  whileHover={{ x: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDate(sortedDates[dateIndex - 1])}
                  disabled={!hasPrevDate}
                  className="btn-ghost btn-sm gap-1 disabled:opacity-40"
                  aria-label="Previous day"
                >
                  <ChevronLeft size={15} />
                </motion.button>

                {/* Date tabs */}
                <div className="flex gap-1 overflow-x-auto scrollbar-hidden flex-1 justify-center">
                  {sortedDates.map((dateKey) => {
                    const d         = new Date(dateKey);
                    const isActive  = dateKey === activeDateKey;
                    const count     = groupedByDate[dateKey]?.length || 0;
                    const isToday   = isSameDay(d, new Date());

                    return (
                      <motion.button
                        key={dateKey}
                        whileHover={{ y: -1 }}
                        whileTap={{ y: 0 }}
                        onClick={() => setSelectedDate(dateKey)}
                        className={cn(
                          'flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 shrink-0 relative',
                          'transition-all duration-150',
                          isActive
                            ? 'bg-primary text-on-primary shadow-sm'
                            : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                        )}
                      >
                        <span className="font-mono text-label-sm uppercase tracking-wide">
                          {format(d, 'EEE')}
                        </span>
                        <span className="font-mono text-headline-sm font-bold">
                          {format(d, 'd')}
                        </span>
                        <span className="font-mono text-label-sm">
                          {count} session{count !== 1 ? 's' : ''}
                        </span>
                        {isToday && !isActive && (
                          <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-secondary" />
                        )}
                        {isActive && (
                          <motion.span
                            layoutId="schedule-date-indicator"
                            className="absolute bottom-0 left-2 right-2 h-0.5 bg-secondary rounded-t"
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>

                <motion.button
                  whileHover={{ x: 2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedDate(sortedDates[dateIndex + 1])}
                  disabled={!hasNextDate}
                  className="btn-ghost btn-sm gap-1 disabled:opacity-40"
                  aria-label="Next day"
                >
                  <ChevronRight size={15} />
                </motion.button>
              </motion.div>
            )}

            {/* Date heading */}
            {activeDateKey && !isLoading && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2"
              >
                <CalendarDays size={16} className="text-secondary" />
                <h2 className="text-headline-sm font-semibold text-on-surface">
                  {format(new Date(activeDateKey), 'EEEE, MMMM d, yyyy')}
                </h2>
                <span className="font-mono text-label-sm text-on-surface-variant">
                  · {sessionsForDay.length} session{sessionsForDay.length !== 1 ? 's' : ''}
                </span>
              </motion.div>
            )}

            {/* Sessions list */}
            <div className="flex flex-col gap-1">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <AgendaRowSkeleton key={i} />)
              ) : sessionsForDay.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="card border-2 border-dashed py-10 text-center"
                >
                  <p className="text-body-sm text-on-surface-variant">
                    No {view === 'registered' ? 'registered' : 'saved'} sessions on this day.
                  </p>
                </motion.div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {sessionsForDay.map((session) => (
                    <AgendaRow
                      key={session._id}
                      session={session}
                      isRegistered={registeredIds.has(session._id)}
                      isBookmarked={bookmarkedIds.has(session._id)}
                      isSelected={selectedSession?._id === session._id}
                      onClick={(s) => setSelected(selectedSession?._id === s._id ? null : s)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Right: detail panel */}
          <AnimatePresence mode="wait">
            {selectedSession && (
              <SessionDetailPanel
                key={selectedSession._id}
                session={selectedSession}
                isRegistered={registeredIds.has(selectedSession._id)}
                isBookmarked={bookmarkedIds.has(selectedSession._id)}
                isMutating={mutatingId === selectedSession._id}
                onClose={() => setSelected(null)}
                onUnregister={() => handleUnregister(selectedSession._id)}
                onBookmark={()   => handleBookmark(selectedSession._id)}
              />
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}