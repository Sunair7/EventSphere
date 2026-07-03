import { useState, useMemo, useRef, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Building2,
  BookOpen,
  Mic2,
  ShieldCheck,
  Star,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Globe,
} from 'lucide-react';
import { format, isPast, differenceInDays } from 'date-fns';
import toast from 'react-hot-toast';

import api from '@/utils/api';
import { cn } from '@/utils/cn';
import FeedbackStars from '@/components/feedback/FeedbackStars';
import FeedbackForm from '@/components/feedback/FeedbackForm';

function useAnimatedCounter(end, duration = 1.4, start = 0) {
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
  const { ref, display } = useAnimatedCounter(value, 1.2, 0);
  return (
    <span ref={ref} className="tabular-nums">
      {display.toLocaleString()}
      {suffix}
    </span>
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

function formatRelativeDate(dateStr) {
  const d = new Date(dateStr);
  const diff = differenceInDays(d, new Date());
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff > 1) return `In ${diff} days`;
  return format(d, 'MMM d, yyyy');
}

export default function AttendeeSessionDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);

  const expoKey = useMemo(() => ['sessions', 'public', id], [id]);

  const { data, isLoading, isError } = useQuery({
    queryKey: expoKey,
    queryFn: async () => {
      // If backend only supports expo/session endpoints that are auth-gated, we fall back later.
      const { data } = await api.get(`/sessions/${id}`);
      return data.data?.session ?? data.data;
    },
    retry: 1,
  });

  const session = data;

  // Auth state is optional here. The page should still render for public users.
  // If AuthContext is required, keep it minimal.
  // We avoid /sessions/me/* until user hits action.

  const { user } = (function useSafeAuth() {
    try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      // @ts-ignore
      const auth = require('@/context/AuthContext');
      // If require fails in bundlers, the page still works for public view.
      return auth?.useAuth ? auth.useAuth() : { user: null };
    } catch {
      return { user: null };
    }
  })();

  const isRegistered = false;
  const isBookmarked = false;

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

  const handleRegister = () => {
    if (!user) {
      // Redirect handled by AttendeeSessions/ExpoDetail after we wire return state.
      // Keep this page safe: show a toast.
      toast.error('Please sign in to register.');
      return;
    }
    setMutatingId(id);
    registerMutation.mutate(id, {
      onSettled: () => setMutatingId(null),
    });
  };

  const handleUnregister = () => {
    if (!user) {
      toast.error('Please sign in to unregister.');
      return;
    }
    setMutatingId(id);
    unregisterMutation.mutate(id, {
      onSettled: () => setMutatingId(null),
    });
  };

  const handleBookmark = () => {
    if (!user) {
      toast.error('Please sign in to bookmark.');
      return;
    }
    setMutatingId(id);
    bookmarkMutation.mutate(id, {
      onSettled: () => setMutatingId(null),
    });
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
        <Link to="/attendee/expos" className="btn-ghost btn-sm mt-3 gap-1.5">
          <ArrowLeft size={14} /> Browse Events
        </Link>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
        <Link to="/attendee/sessions" className="btn-ghost btn-sm gap-1.5 self-start">
          <ArrowLeft size={15} /> Back to Sessions
        </Link>
      </motion.div>

      {isLoading || !session ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-6">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton h-6 w-3/4 rounded mt-3" />
              <div className="skeleton h-4 w-1/2 rounded mt-2" />
              <div className="skeleton h-10 w-full rounded mt-4" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Hero */}
          <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface-container-low">
            <div className="absolute inset-0 opacity-30 pointer-events-none">
              <div className="h-full w-full bg-gradient-to-br from-secondary/[0.25] via-transparent to-tertiary/[0.25]" />
            </div>

            <div className="relative p-5 sm:p-7 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
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

                  <h1 className="text-headline-lg sm:text-display-sm font-semibold text-on-surface flex items-center gap-2">
                    <Sparkles size={22} className="text-secondary" />
                    {session.title}
                  </h1>

                  <div className="flex flex-wrap gap-4 text-body-sm text-on-surface-variant">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-secondary" />
                      <span>
                        {format(new Date(session.startTime), 'HH:mm')} —{' '}
                        {format(new Date(session.endTime), 'HH:mm')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CalendarDays size={14} className="text-secondary" />
                      <span>{format(new Date(session.startTime), 'MMM d, yyyy')} · {formatRelativeDate(session.startTime)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-secondary" />
                      <span className="line-clamp-1">
                        {session.location}
                      </span>
                    </div>
                  </div>

                  {session.speakers?.length > 0 && (
                    <div className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                      <Mic2 size={14} className="text-secondary" />
                      <span className="line-clamp-2">
                        {session.speakers.map((s) => s.name).join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 min-w-[220px]">
                  <button
                    onClick={handleBookmark}
                    disabled={mutatingId === id}
                    className={cn(
                      'btn-ghost btn-sm gap-2 w-full flex items-center justify-center',
                      mutatingId === id && 'opacity-70'
                    )}
                  >
                    {isBookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />} 
                    {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                  </button>

                  {isPast(new Date(session.endTime)) || session.status === 'cancelled' ? (
                    <div className="card px-4 py-3 text-center">
                      <p className="text-body-sm text-on-surface">Session ended</p>
                      <p className="mt-1 font-mono text-label-sm text-on-surface-variant">You can leave feedback if available</p>
                    </div>
                  ) : (
                    <button
                      onClick={handleRegister}
                      disabled={mutatingId === id || registerMutation.isPending}
                      className={cn(
                        'btn-secondary btn-sm gap-2 w-full',
                        (session.maxCapacity && (session.attendeeCount ?? 0) >= session.maxCapacity) && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      {mutatingId === id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Register
                    </button>
                  )}

                  {user && (
                    <div className="flex items-center gap-2 justify-center">
                      <ShieldCheck size={16} className="text-secondary" />
                      <span className="font-mono text-label-sm text-on-surface-variant">Private actions enabled</span>
                    </div>
                  )}
                </div>
              </div>

              {session.description ? (
                <p className="text-body-lg text-on-surface-variant leading-relaxed max-w-3xl">{session.description}</p>
              ) : null}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="card py-5 text-center">
              <p className="text-body-sm font-medium text-on-surface-variant">Capacity</p>
              <p className="mt-2 font-mono text-headline-sm font-bold text-on-surface">
                {(session.maxCapacity ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="card py-5 text-center">
              <p className="text-body-sm font-medium text-on-surface-variant">Registered</p>
              <p className="mt-2 font-mono text-headline-sm font-bold text-on-surface">
                {(session.attendeeCount ?? 0).toLocaleString()}
              </p>
            </div>
            <div className="card py-5 text-center">
              <p className="text-body-sm font-medium text-on-surface-variant">Expo</p>
              <p className="mt-2 flex items-center justify-center gap-2 font-mono text-headline-sm font-bold text-on-surface">
                <BookOpen size={18} className="text-secondary" />
                Expo
              </p>
            </div>
            <div className="card py-5 text-center">
              <p className="text-body-sm font-medium text-on-surface-variant">Format</p>
              <p className="mt-2 font-mono text-headline-sm font-bold text-on-surface">{session.format || 'Session'}</p>
            </div>
          </div>

          {/* Feedback */}
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
                <Star size={18} className="text-secondary" /> Feedback
              </h2>
              {!isPast(new Date(session.endTime)) && session.status !== 'cancelled' ? (
                <span className="font-mono text-label-sm text-on-surface-variant">Feedback opens after completion</span>
              ) : (
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="btn-ghost btn-sm gap-2"
                >
                  Leave feedback
                  <ArrowRightTiny />
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

function ArrowRightTiny() {
  // small inline helper to avoid additional imports
  return <span className="inline-flex">→</span>;
}

