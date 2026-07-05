import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Timer,
  MapPin,
  Users,
  Mic2,
  ShieldCheck,
  Star,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

import api from '@/utils/api';
import { cn } from '@/utils/cn';
import { useAuth } from '@/context/AuthContext';
import FeedbackForm from '@/components/feedback/FeedbackForm';

// ── Small helpers ────────────────────────────────────────────────────────

function useAnimatedCounter(end, duration = 1.2, start = 0) {
  const [display, setDisplay] = useState(start);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    if (!end && end !== 0) return;

    let startTime;
    let rafId;
    const step = (ts) => {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(start + (end - start) * eased));
      if (progress < 1) rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [inView, end, start, duration]);

  return { ref, display };
}

function CountUp({ value, suffix = '' }) {
  const { ref, display } = useAnimatedCounter(value ?? 0);
  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}

function formatRelativeDate(dateStr) {
  const d = new Date(dateStr);
  const diff = differenceInDays(d, new Date());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1) return `In ${diff} days`;
  return format(d, 'MMM d, yyyy');
}

function formatDuration(start, end) {
  const ms = new Date(end) - new Date(start);
  if (!Number.isFinite(ms) || ms <= 0) return '—';
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function getInitials(name = '') {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?'
  );
}

function SessionStatusBadge({ session }) {
  const isLive = session.status === 'live';
  const ended = isPast(new Date(session.endTime)) && !isLive;
  const isFull =
    session.maxCapacity && (session.attendeeCount ?? 0) >= session.maxCapacity;

  if (isLive) {
    return (
      <span className="badge badge-success gap-1 text-label-sm">
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="h-1.5 w-1.5 rounded-full bg-success"
        />
        Live Now
      </span>
    );
  }

  if (ended) return <span className="badge badge-neutral">Session Ended</span>;
  if (session.status === 'cancelled') return <span className="badge badge-error">Cancelled</span>;
  if (isFull) return <span className="badge badge-warning">Full</span>;

  const daysUntil = differenceInDays(new Date(session.startTime), new Date());
  if (daysUntil === 0) return <span className="badge badge-info">Starts today</span>;
  if (daysUntil === 1) return <span className="badge badge-info">Starts tomorrow</span>;
  if (daysUntil > 1) return <span className="badge badge-info">In {daysUntil} days</span>;

  return <span className="badge badge-neutral">Upcoming</span>;
}

// ── Details strip: date / time / location / duration, given real room ────

function MetaItem({ icon: Icon, label, value, sub }) {
  return (
    <div className="flex items-center gap-4 px-5 py-5 sm:px-6 sm:py-6">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary/10">
        <Icon size={19} className="text-secondary" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-mono text-label-sm uppercase tracking-wide text-on-surface-variant">
          {label}
        </span>
        <span className="truncate text-body-lg font-semibold text-on-surface">{value}</span>
        {sub ? (
          <span className="truncate text-label-sm text-on-surface-variant">{sub}</span>
        ) : null}
      </div>
    </div>
  );
}

function DetailsStrip({ session }) {
  return (
    <div className="card overflow-hidden p-0">
      <div className="grid grid-cols-1 divide-y divide-outline-variant sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
        <MetaItem
          icon={CalendarDays}
          label="Date"
          value={format(new Date(session.startTime), 'MMM d, yyyy')}
          sub={formatRelativeDate(session.startTime)}
        />
        <MetaItem
          icon={Clock}
          label="Time"
          value={`${format(new Date(session.startTime), 'HH:mm')} – ${format(
            new Date(session.endTime),
            'HH:mm'
          )}`}
        />
        <MetaItem icon={MapPin} label="Location" value={session.location || 'TBA'} />
        <MetaItem
          icon={Timer}
          label="Duration"
          value={formatDuration(session.startTime, session.endTime)}
        />
      </div>
    </div>
  );
}

// ── Speakers ───────────────────────────────────────────────────────────

function SpeakerChip({ speaker }) {
  const subtitle = [speaker.title, speaker.company].filter(Boolean).join(' · ');
  return (
    <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-tertiary/15 font-mono text-label-lg font-bold text-tertiary">
        {getInitials(speaker.name)}
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-body-md font-semibold text-on-surface">{speaker.name}</span>
        {subtitle ? (
          <span className="truncate text-label-sm text-on-surface-variant">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── Capacity ───────────────────────────────────────────────────────────

function CapacityBar({ registered, capacity }) {
  if (!capacity) return null;
  const pct = Math.min(100, Math.round((registered / capacity) * 100));
  const tone = pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-warning' : 'bg-success';

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-body-sm text-on-surface-variant">Seats filled</span>
        <span className="font-mono text-body-sm font-semibold text-on-surface">
          {registered.toLocaleString()} / {capacity.toLocaleString()} · {pct}%
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-container-highest">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className={cn('h-full rounded-full', tone)}
        />
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────

export default function AttendeeSessionDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  const expoKey = useMemo(() => ['sessions', 'public', id], [id]);

  const { data, isLoading, isError } = useQuery({
    queryKey: expoKey,
    queryFn: async () => {
      const { data } = await api.get(`/sessions/${id}`);
      return data.data?.session ?? data.data;
    },
    retry: 1,
  });

  const session = data;

  // Auth is optional for viewing. Actions will redirect unauthenticated users.
  const { user } = useAuth();
  const basePath = user?.role === 'attendee' ? '/attendee' : '/events';

  const { data: myRegistrations = [] } = useQuery({
    queryKey: ['sessions', 'me', 'registrations'],
    queryFn: async () => {
      const { data } = await api.get('/sessions/me/registrations');
      return data.data.sessions;
    },
    enabled: !!user,
  });

  const { data: myBookmarks = [] } = useQuery({
    queryKey: ['sessions', 'me', 'bookmarks'],
    queryFn: async () => {
      const { data } = await api.get('/sessions/me/bookmarks');
      return data.data.sessions;
    },
    enabled: !!user,
  });

  const isRegistered = !!user && myRegistrations.some((s) => s._id === id);
  const isBookmarked = !!user && myBookmarks.some((s) => s._id === id);

  const registerMutation = useMutation({
    mutationFn: (sessionId) => api.post(`/sessions/${sessionId}/register`),
    onSuccess: () => {
      toast.success('Registered successfully! 🎉');
      queryClient.invalidateQueries({ queryKey: ['sessions', 'me', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: expoKey });
    },
    onError: (err) => toast.error(err?.message || 'Failed to register.'),
  });

  const unregisterMutation = useMutation({
    mutationFn: (sessionId) => api.delete(`/sessions/${sessionId}/register`),
    onSuccess: () => {
      toast.success('Registration cancelled.');
      queryClient.invalidateQueries({ queryKey: ['sessions', 'me', 'registrations'] });
      queryClient.invalidateQueries({ queryKey: expoKey });
    },
    onError: (err) => toast.error(err?.message || 'Failed to cancel registration.'),
  });

  const bookmarkMutation = useMutation({
    mutationFn: (sessionId) => api.post(`/sessions/${sessionId}/bookmark`),
    onSuccess: (res) => {
      toast.success(res?.data?.isBookmarked ? 'Bookmarked! 🔖' : 'Bookmark removed.');
      queryClient.invalidateQueries({ queryKey: ['sessions', 'me', 'bookmarks'] });
    },
    onError: (err) => toast.error(err?.message || 'Failed to toggle bookmark.'),
  });

  const [mutatingId, setMutatingId] = useState(null);

  const navigate = useNavigate();
  const loginRedirectState = { from: `${basePath}/sessions/${id}` };

  const handleRegister = () => {
    if (!user) {
      toast('Please sign in to register.', { icon: '🔒' });
      navigate('/login', { state: loginRedirectState });
      return;
    }
    setMutatingId(id);
    registerMutation.mutate(id, { onSettled: () => setMutatingId(null) });
  };

  const handleUnregister = () => {
    if (!user) {
      navigate('/login', { state: loginRedirectState });
      return;
    }
    setMutatingId(id);
    unregisterMutation.mutate(id, { onSettled: () => setMutatingId(null) });
  };

  const handleBookmark = () => {
    if (!user) {
      toast('Please sign in to bookmark sessions.', { icon: '🔒' });
      navigate('/login', { state: loginRedirectState });
      return;
    }
    setMutatingId(id);
    bookmarkMutation.mutate(id, { onSettled: () => setMutatingId(null) });
  };

  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="empty-state py-16"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="empty-state-icon text-error"
        >
          <AlertCircle size={26} />
        </motion.div>
        <h3 className="empty-state-title">Session not found</h3>
        <Link to={`${basePath}/expos`} className="btn-ghost btn-sm mt-3 gap-1.5">
          <ArrowLeft size={14} /> Browse Events
        </Link>
      </motion.div>
    );
  }

  const ended = session && (isPast(new Date(session.endTime)) || session.status === 'cancelled');
  const isFull =
    session?.maxCapacity && (session.attendeeCount ?? 0) >= session.maxCapacity;

  return (
    <div className="flex flex-col gap-8">
      {/* Back */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <Link to={`${basePath}/sessions`} className="btn-ghost btn-sm gap-1.5 self-start">
          <ArrowLeft size={15} /> Back to Sessions
        </Link>
      </motion.div>

      {isLoading || !session ? (
        <div className="flex flex-col gap-6">
          <div className="card h-56 animate-pulse" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-6">
                <div className="skeleton h-4 w-24 rounded" />
                <div className="skeleton mt-3 h-6 w-3/4 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
            <div className="pointer-events-none absolute inset-0 opacity-30">
              <div className="h-full w-full bg-gradient-to-br from-secondary/[0.25] via-transparent to-tertiary/[0.25]" />
            </div>

            <div className="relative flex flex-col gap-5 p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="flex min-w-0 flex-1 flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-neutral font-mono">{session.format || 'Session'}</span>
                    <SessionStatusBadge session={session} />
                    {session.isFeatured && (
                      <span className="badge badge-info gap-1">
                        <Star size={12} /> Featured
                      </span>
                    )}
                    {session.price > 0 && (
                      <span className="badge badge-warning font-mono">
                        ${(session.price / 100).toFixed(2)}
                      </span>
                    )}
                  </div>

                  <h1 className="flex items-center gap-2.5 text-headline-lg font-semibold text-on-surface sm:text-display-sm">
                    <Sparkles size={24} className="shrink-0 text-secondary" />
                    <span>{session.title}</span>
                  </h1>

                  {session.description ? (
                    <p className="max-w-2xl text-body-lg leading-relaxed text-on-surface-variant">
                      {session.description}
                    </p>
                  ) : null}
                </div>

                {/* Actions */}
                <div className="flex min-w-[220px] flex-col gap-2">
                  <button
                    onClick={handleBookmark}
                    disabled={mutatingId === id}
                    className={cn(
                      'btn-ghost btn-sm flex w-full items-center justify-center gap-2',
                      mutatingId === id && 'opacity-70'
                    )}
                  >
                    {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                    {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                  </button>

                  {ended ? (
                    <div className="card px-4 py-3 text-center">
                      <p className="text-body-sm text-on-surface">Session ended</p>
                      <p className="mt-1 font-mono text-label-sm text-on-surface-variant">
                        You can leave feedback if available
                      </p>
                    </div>
                  ) : isRegistered ? (
                    <button
                      onClick={handleUnregister}
                      disabled={mutatingId === id || unregisterMutation.isPending}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-success bg-success-container/30 px-3 py-2 text-body-sm font-medium text-on-success-container transition-all duration-200 hover:border-error hover:bg-error-container/20 hover:text-on-error-container"
                    >
                      {mutatingId === id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Registered
                    </button>
                  ) : (
                    <button
                      onClick={handleRegister}
                      disabled={mutatingId === id || registerMutation.isPending || isFull}
                      className={cn(
                        'btn-secondary btn-sm w-full gap-2',
                        isFull && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      {mutatingId === id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      {isFull ? 'Session Full' : 'Register'}
                    </button>
                  )}

                  {!user ? (
                    <p className="text-center font-mono text-label-sm text-on-surface-variant">
                      Sign in to register or bookmark sessions.
                    </p>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <ShieldCheck size={16} className="text-secondary" />
                      <span className="font-mono text-label-sm text-on-surface-variant">
                        Private actions enabled
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details strip — date, time, location, duration get real room */}
          <DetailsStrip session={session} />

          {/* Speakers */}
          {session.speakers?.length > 0 && (
            <div className="card p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-headline-sm font-semibold text-on-surface">
                <Mic2 size={18} className="text-secondary" />
                Speaking
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {session.speakers.map((speaker, i) => (
                  <SpeakerChip key={speaker._id ?? i} speaker={speaker} />
                ))}
              </div>
            </div>
          )}

          {/* Capacity */}
{session.maxCapacity ? (
  <div className="card p-5 sm:p-6">
    {/* Header */}
    <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
      <h2 className="flex items-center gap-2 text-headline-sm font-semibold text-on-surface">
        <Users size={18} className="text-secondary" />
        Attendance
      </h2>
      <div className="flex items-baseline gap-1.5 font-mono">
        <span className="text-headline-sm font-bold text-on-surface">
          <CountUp value={session.attendeeCount ?? 0} />
        </span>
        <span className="text-body-sm text-on-surface-variant">
          / <CountUp value={session.maxCapacity ?? 0} /> seats
        </span>
      </div>
    </div>

    {/* Inline Capacity Bar - ✅ Fixed: removed index */}
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{
            width: `${Math.min(100, (session.attendeeCount / session.maxCapacity) * 100)}%`,
          }}
          transition={{ duration: 0.6, ease: "easeOut" }} // ✅ Removed delay: index * 0.03
          className={cn(
            "h-full rounded-full",
            session.attendeeCount / session.maxCapacity >= 0.9
              ? "bg-error"
              : session.attendeeCount / session.maxCapacity >= 0.7
                ? "bg-warning"
                : "bg-secondary",
          )}
        />
      </div>
      <div className="flex items-center gap-1 font-mono text-label-sm text-on-surface-variant shrink-0">
        <Users size={11} />
        <span>
          {session.attendeeCount ?? 0} / {session.maxCapacity}
        </span>
      </div>
    </div>
  </div>
) : null}

          {/* Feedback */}
          <div className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-headline-sm font-semibold text-on-surface">
                <Star size={18} className="text-secondary" /> Feedback
              </h2>
              {!ended ? (
                <span className="font-mono text-label-sm text-on-surface-variant">
                  Feedback opens after completion
                </span>
              ) : (
                <button onClick={() => setShowFeedbackForm(true)} className="btn-ghost btn-sm gap-2">
                  Leave feedback
                  <span className="inline-flex">→</span>
                </button>
              )}
            </div>

            <AnimatePresence>
              {showFeedbackForm && (
                <FeedbackForm
                  isOpen={showFeedbackForm}
                  onClose={() => {
                    setShowFeedbackForm(false);
                    setSelectedFeedback(null);
                  }}
                  sessionId={session._id}
                  sessionTitle={session.title}
                  existingFeedback={selectedFeedback}
                  onSuccess={() => {
                    toast.success('Feedback submitted. Thank you!');
                    setShowFeedbackForm(false);
                    queryClient.invalidateQueries({ queryKey: ['feedback', 'session', session._id] });
                  }}
                />
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}