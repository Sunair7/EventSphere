import { useState, useMemo }                    from 'react';
import { useParams, Link }                      from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion }                               from 'framer-motion';
import {
  ArrowLeft, MapPin, CalendarDays, LayoutGrid,
  BookOpen, Clock, CheckCircle2, AlertCircle,
  ChevronRight, Tag, Users, Building2,
  Info, ArrowRight, Bookmark, BookmarkCheck,
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';
import toast                                from 'react-hot-toast';
import api                                  from '@/utils/api';
import { useAuth }                          from '@/context/AuthContext';
import { cn }                               from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const expoKey         = (id) => ['expos', 'exhibitor', 'detail', id];
const sessionsKey     = (id) => ['sessions', 'expo', id, 'exhibitor', 'preview'];
const profileKey          = ['exhibitor', 'profile', 'me'];
const myRegKey            = ['sessions', 'me', 'registrations'];
const myBmkKey            = ['sessions', 'me', 'bookmarks'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Field = ({ label, value }) => (
  <div className="flex flex-col gap-0.5">
    <span className="font-mono text-label-sm text-on-surface-variant">{label}</span>
    <span className="text-body-sm font-medium text-on-surface">{value || '—'}</span>
  </div>
);

// ─── Session card ─────────────────────────────────────────────────────────────
function SessionCard({ session, isRegistered, isBookmarked, onRegister, onUnregister, onBookmark, isMutating }) {
  const isLive    = session.status === 'live';
  const isFull    = session.maxCapacity && (session.attendeeCount ?? 0) >= session.maxCapacity;
  const isPastSes = isPast(new Date(session.endTime)) && !isLive;

  return (
    <div className={cn(
      'card flex flex-col gap-2 hover:shadow-level-2 transition-shadow duration-200',
      isLive && 'border-success/30 bg-success-container/5'
    )}>
      <div className="flex items-start justify-between gap-2">
        <span className="badge badge-neutral capitalize text-label-sm">{session.format}</span>
        <button
          onClick={onBookmark}
          disabled={isMutating}
          className={cn(
            'rounded p-1 transition-colors shrink-0',
            isBookmarked ? 'text-tertiary' : 'text-on-surface-variant hover:text-tertiary'
          )}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark session'}
        >
          {isBookmarked ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        </button>
      </div>

      <p className="text-body-sm font-semibold text-on-surface line-clamp-2 leading-snug">
        {session.title}
      </p>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-mono text-label-sm text-on-surface-variant flex items-center gap-1">
          <Clock size={10} />
          {format(new Date(session.startTime), 'MMM d, HH:mm')}
        </span>
        <span className="font-mono text-label-sm text-on-surface-variant flex items-center gap-1">
          <MapPin size={10} />
          {session.location}
        </span>
      </div>

      {!isPastSes && session.status !== 'cancelled' && (
        isRegistered ? (
          <button
            onClick={onUnregister}
            disabled={isMutating}
            className="mt-1 flex items-center justify-center gap-1 rounded border border-success
                       bg-success-container/30 px-3 py-1.5 text-body-sm font-medium
                       text-on-success-container hover:bg-error-container/30 hover:border-error
                       hover:text-on-error-container transition-all"
          >
            <CheckCircle2 size={13} />
            {isMutating ? 'Processing…' : 'Registered'}
          </button>
        ) : (
          <button
            onClick={onRegister}
            disabled={isFull || isMutating}
            className={cn(
              'mt-1 rounded px-3 py-1.5 text-body-sm font-medium transition-all',
              !isFull ? 'btn-secondary' : 'border border-outline-variant text-on-surface-variant cursor-not-allowed'
            )}
          >
            {isFull ? 'Full' : isMutating ? 'Processing…' : 'Register'}
          </button>
        )
      )}
    </div>
  );
}

// ─── Booth status card ────────────────────────────────────────────────────────
function BoothStatusCard({ expoId, profile }) {
  const myBooth = profile?.assignedBooths?.find(
    (ab) => ab.expoId?._id === expoId || ab.expoId === expoId
  );

  if (!profile) {
    return (
      <div className="card border-dashed border-2 flex flex-col gap-3 text-center py-8">
        <div className="empty-state-icon mx-auto"><LayoutGrid size={22} /></div>
        <p className="text-body-sm font-medium text-on-surface">Complete your profile first</p>
        <p className="text-body-sm text-on-surface-variant">
          Create your exhibitor profile to apply for a booth.
        </p>
        <Link to="/exhibitor/profile" className="btn-secondary btn-sm gap-1 self-center">
          <Building2 size={13} /> Complete Profile
        </Link>
      </div>
    );
  }

  if (profile.applicationStatus !== 'approved') {
    return (
      <div className="card flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-warning-container">
            <Clock size={17} className="text-on-warning-container" />
          </div>
          <div>
            <p className="text-body-sm font-semibold text-on-surface">
              Application {profile.applicationStatus}
            </p>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Your exhibitor application must be approved before reserving a booth.
            </p>
          </div>
        </div>
        <Link to="/exhibitor/profile" className="btn-ghost btn-sm gap-1 self-start">
          View Application <ChevronRight size={13} />
        </Link>
      </div>
    );
  }

  if (myBooth) {
    return (
      <div className="card flex flex-col gap-3 border-secondary/30 bg-secondary-container/10">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-secondary text-on-secondary font-mono font-bold text-label-sm">
            {myBooth.boothId?.boothNumber ?? '✓'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-body-sm font-semibold text-on-surface">Booth Assigned</p>
              <span className="badge badge-success">Confirmed</span>
            </div>
            <p className="font-mono text-label-sm text-on-surface-variant mt-0.5">
              {myBooth.boothId?.boothNumber} · {myBooth.boothId?.dimensions}
            </p>
          </div>
        </div>
        <Link
          to={`/exhibitor/expos/${expoId}/floor-plan`}
          className="btn-ghost btn-sm gap-1 self-start"
        >
          <LayoutGrid size={13} /> View on Floor Plan
        </Link>
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-secondary-container">
          <LayoutGrid size={17} className="text-on-secondary-container" />
        </div>
        <div>
          <p className="text-body-sm font-semibold text-on-surface">No booth reserved yet</p>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            Browse the interactive floor plan to select and reserve your space.
          </p>
        </div>
      </div>
      <Link
        to={`/exhibitor/expos/${expoId}/floor-plan`}
        className="btn-secondary gap-2 self-start"
      >
        <LayoutGrid size={15} /> Reserve a Booth
      </Link>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExhibitorExpoDetail() {
  const { id }          = useParams();
  const queryClient     = useQueryClient();
  const { user }        = useAuth();
  const [mutatingId, setMutatingId] = React.useState(null);

  // ── Fetch expo ──────────────────────────────────────────────────────────────
  const { data: expo, isLoading: expoLoading, isError } = useQuery({
    queryKey: expoKey(id),
    queryFn:  async () => {
      const { data } = await api.get(`/expos/${id}`);
      return data.data.expo;
    },
  });

  // ── Fetch sessions preview ──────────────────────────────────────────────────
  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: sessionsKey(id),
    queryFn:  async () => {
      const { data } = await api.get(`/sessions/expo/${id}?limit=4`);
      return data.data;
    },
    enabled: !!expo,
  });

  // ── Fetch exhibitor profile ─────────────────────────────────────────────────
  const { data: profile } = useQuery({
    queryKey: profileKey,
    queryFn:  async () => {
      const { data } = await api.get('/exhibitors/profile/me');
      return data.data.profile;
    },
    retry: false,
  });

  // ── Fetch registrations + bookmarks ────────────────────────────────────────
  const { data: myReg = [] } = useQuery({
    queryKey: myRegKey,
    queryFn:  async () => {
      const { data } = await api.get('/sessions/me/registrations');
      return data.data.sessions;
    },
  });

  const { data: myBmk = [] } = useQuery({
    queryKey: myBmkKey,
    queryFn:  async () => {
      const { data } = await api.get('/sessions/me/bookmarks');
      return data.data.sessions;
    },
  });

  const registeredIds = useMemo(() => new Set(myReg.map((s) => s._id)), [myReg]);
  const bookmarkedIds = useMemo(() => new Set(myBmk.map((s) => s._id)), [myBmk]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const registerMutation = useMutation({
    mutationFn: (sid) => api.post(`/sessions/${sid}/register`),
    onSuccess: () => {
      toast.success('Registered for session.');
      queryClient.invalidateQueries({ queryKey: myRegKey });
      setMutatingId(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed to register.'); setMutatingId(null); },
  });

  const unregisterMutation = useMutation({
    mutationFn: (sid) => api.delete(`/sessions/${sid}/register`),
    onSuccess: () => {
      toast.success('Registration cancelled.');
      queryClient.invalidateQueries({ queryKey: myRegKey });
      setMutatingId(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed.'); setMutatingId(null); },
  });

  const bookmarkMutation = useMutation({
    mutationFn: (sid) => api.post(`/sessions/${sid}/bookmark`),
    onSuccess: (res) => {
      toast.success(res.data.isBookmarked ? 'Bookmarked.' : 'Removed.');
      queryClient.invalidateQueries({ queryKey: myBmkKey });
      setMutatingId(null);
    },
    onError: (err) => { toast.error(err.message || 'Failed.'); setMutatingId(null); },
  });

  const handleAction = (sid, action) => {
    setMutatingId(sid);
    if (action === 'register')   registerMutation.mutate(sid);
    if (action === 'unregister') unregisterMutation.mutate(sid);
    if (action === 'bookmark')   bookmarkMutation.mutate(sid);
  };

  if (isError) {
    return (
      <div className="empty-state py-20">
        <div className="empty-state-icon text-error"><AlertCircle size={28} /></div>
        <h3 className="empty-state-title">Expo not found</h3>
        <Link to="/exhibitor/expos" className="btn-ghost btn-sm mt-3 gap-1.5">
          <ArrowLeft size={14} /> Browse Expos
        </Link>
      </div>
    );
  }

  const sessions   = sessionsData?.sessions || [];
  const daysUntil  = expo ? differenceInDays(new Date(expo.startDate), new Date()) : null;
  const isOngoing  = expo?.status === 'ongoing';

  return (
    <div className="flex flex-col gap-8">

      {/* ── Back ────────────────────────────────────────────────── */}
      <Link to="/exhibitor/expos" className="btn-ghost btn-sm gap-1.5 self-start">
        <ArrowLeft size={15} /> All Expos
      </Link>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      {expoLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-4 rounded" style={{ width: `${(4 - i) * 20}%` }} />
          ))}
        </div>
      ) : expo && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {isOngoing ? (
              <span className="badge badge-success gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                Live Now
              </span>
            ) : daysUntil !== null && daysUntil >= 0 ? (
              <span className="badge badge-info">
                {daysUntil === 0 ? 'Starts today' : `${daysUntil} days away`}
              </span>
            ) : null}
            {expo.theme && (
              <span className="font-mono text-label-sm text-on-surface-variant">{expo.theme}</span>
            )}
          </div>

          <h1 className="text-headline-lg font-semibold text-on-surface">{expo.title}</h1>

          {expo.description && (
            <p className="text-body-md text-on-surface-variant leading-relaxed max-w-2xl line-clamp-3">
              {expo.description}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Start Date"  value={format(new Date(expo.startDate), 'MMM d, yyyy')} />
            <Field label="End Date"    value={format(new Date(expo.endDate),   'MMM d, yyyy')} />
            <Field label="Location"    value={expo.address?.city ? `${expo.address.city}, ${expo.address.country}` : '—'} />
            <Field label="Reg. Deadline" value={expo.registrationDeadline
              ? format(new Date(expo.registrationDeadline), 'MMM d, yyyy')
              : 'No deadline'} />
          </div>

          {expo.tags?.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag size={13} className="text-on-surface-variant" />
              {expo.tags.map((tag) => (
                <span key={tag} className="badge badge-neutral">{tag}</span>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ── Two-column layout ────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Booth status */}
        <section>
          <h2 className="mb-3 text-headline-sm font-semibold text-on-surface">Your Booth</h2>
          <BoothStatusCard expoId={id} profile={profile} />
        </section>

        {/* Sessions */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-headline-sm font-semibold text-on-surface">Sessions</h2>
            <Link to={`/exhibitor/sessions`} className="btn-tertiary btn-sm gap-1">
              All <ArrowRight size={13} />
            </Link>
          </div>

          {sessionsLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-md" />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="card border-dashed border-2 py-8 text-center">
              <p className="text-body-sm text-on-surface-variant">No sessions scheduled yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sessions.map((session) => (
                <SessionCard
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
        </section>
      </div>

      {/* ── Floor plan CTA ───────────────────────────────────────── */}
      {(expo?.status === 'published' || expo?.status === 'ongoing') && (
        <Link
          to={`/exhibitor/expos/${id}/floor-plan`}
          className="card flex items-center justify-between gap-4
                     bg-primary-container border-primary/20 hover:shadow-level-2
                     transition-shadow duration-200 group"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-primary">
              <LayoutGrid size={18} className="text-on-primary" />
            </div>
            <div>
              <p className="text-body-sm font-semibold text-on-primary-container">
                Interactive Floor Plan
              </p>
              <p className="font-mono text-label-sm text-on-primary-container/70">
                Browse available booths and submit your reservation.
              </p>
            </div>
          </div>
          <ArrowRight
            size={18}
            className="text-on-primary-container opacity-60 group-hover:opacity-100 transition-opacity shrink-0"
          />
        </Link>
      )}
    </div>
  );
}

// ─── React import needed for useState ────────────────────────────────────────
import React from 'react';