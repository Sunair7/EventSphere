import { useState }                              from 'react';
import { useParams, Link }                       from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }               from 'framer-motion';
import {
  ArrowLeft, Users, CheckCircle2, Clock,
  MapPin, Mic2, BookOpen, Send, XCircle,
  AlertCircle, RefreshCw, ExternalLink,
  UserCheck, Tag, Wifi, Search, X,
} from 'lucide-react';
import { format, differenceInMinutes }          from 'date-fns';
import toast                                    from 'react-hot-toast';
import api                                      from '@/utils/api';
import { cn }                                   from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const sessionKey   = (id) => ['admin', 'sessions', 'detail', id];
const attendeesKey = (id) => ['admin', 'sessions', id, 'attendees'];

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_TRANSITIONS = {
  scheduled: [
    { to: 'live',      label: 'Go Live',   icon: Send,     cls: 'btn-secondary' },
    { to: 'cancelled', label: 'Cancel',    icon: XCircle,  cls: 'btn-danger'    },
  ],
  live: [
    { to: 'completed', label: 'End Session', icon: CheckCircle2, cls: 'btn-secondary' },
    { to: 'cancelled', label: 'Cancel',      icon: XCircle,      cls: 'btn-danger'    },
  ],
  completed: [],
  cancelled: [],
};

const STATUS_BADGE = {
  scheduled: 'badge-info',
  live:      'badge-success',
  completed: 'badge-neutral',
  cancelled: 'badge-error',
};

const FORMAT_BADGE = {
  keynote:      'badge-info',
  panel:        'badge-neutral',
  workshop:     'badge-success',
  presentation: 'badge-neutral',
  networking:   'badge-warning',
  demo:         'badge-info',
  other:        'badge-neutral',
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="skeleton h-8 w-64 rounded" />
      <div className="skeleton h-40 rounded-md" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="skeleton h-48 rounded-md" />
        <div className="skeleton h-48 rounded-md" />
      </div>
    </div>
  );
}

// ─── Attendee row ─────────────────────────────────────────────────────────────
function AttendeeRow({ attendee, sessionId, isLive, onCheckedIn }) {
  const queryClient = useQueryClient();

  const checkinMutation = useMutation({
    mutationFn: () =>
      api.post(`/sessions/${sessionId}/checkin/${attendee.userId?._id || attendee.userId}`),
    onSuccess: () => {
      toast.success(`${attendee.userId?.name || 'Attendee'} checked in.`);
      queryClient.invalidateQueries({ queryKey: attendeesKey(sessionId) });
      onCheckedIn?.();
    },
    onError: (err) => toast.error(err.message || 'Check-in failed.'),
  });

  const name  = attendee.userId?.name  || 'Unknown';
  const email = attendee.userId?.email || '—';

  return (
    <tr className={cn(
      'border-b border-outline-variant transition-colors duration-150',
      attendee.attended ? 'bg-success-container/10' : 'hover:bg-surface-container-low'
    )}>
      {/* Name + email */}
      <td className="px-4 py-density-high">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                          bg-primary-container font-mono text-label-sm font-bold text-on-primary-container">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-body-sm font-medium text-on-surface truncate">{name}</p>
            <p className="font-mono text-label-sm text-on-surface-variant truncate">{email}</p>
          </div>
        </div>
      </td>

      {/* Registered at */}
      <td className="px-4 py-density-high">
        <span className="font-mono text-label-sm text-on-surface-variant">
          {attendee.registeredAt
            ? format(new Date(attendee.registeredAt), 'MMM d, HH:mm')
            : '—'}
        </span>
      </td>

      {/* Check-in status */}
      <td className="px-4 py-density-high">
        {attendee.attended ? (
          <div className="flex items-center gap-1.5 text-secondary">
            <CheckCircle2 size={14} />
            <span className="font-mono text-label-sm">
              {attendee.checkedInAt
                ? format(new Date(attendee.checkedInAt), 'HH:mm')
                : 'Checked in'}
            </span>
          </div>
        ) : (
          <span className="font-mono text-label-sm text-on-surface-variant">Not checked in</span>
        )}
      </td>

      {/* Action */}
      <td className="px-4 py-density-high">
        {!attendee.attended && isLive && (
          <button
            onClick={() => checkinMutation.mutate()}
            disabled={checkinMutation.isPending}
            className="btn-ghost btn-sm gap-1 text-secondary hover:bg-secondary-container/30"
          >
            <UserCheck size={13} />
            {checkinMutation.isPending ? 'Checking in…' : 'Check In'}
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminSessionDetail() {
  const { id: expoId, sid } = useParams();
  const queryClient          = useQueryClient();
  const [attendeeSearch, setAttendeeSearch] = useState('');

  // ── Fetch session ───────────────────────────────────────────────────────────
  const { data: session, isLoading, isError, refetch } = useQuery({
    queryKey: sessionKey(sid),
    queryFn:  async () => {
      const { data } = await api.get(`/sessions/${sid}`);
      return data.data.session;
    },
  });

  // ── Fetch attendees ─────────────────────────────────────────────────────────
  const { data: attendeeData, isLoading: attendeesLoading } = useQuery({
    queryKey: attendeesKey(sid),
    queryFn:  async () => {
      const { data } = await api.get(`/sessions/${sid}/attendees`);
      return data.data;
    },
    enabled:         !!session,
    refetchInterval: session?.status === 'live' ? 30_000 : false,
  });

  // ── Status transition mutation ──────────────────────────────────────────────
  const statusMutation = useMutation({
    mutationFn: (status) => api.patch(`/sessions/${sid}/status`, { status }),
    onSuccess: (_, status) => {
      toast.success(`Session is now ${status}.`);
      queryClient.invalidateQueries({ queryKey: sessionKey(sid) });
      queryClient.invalidateQueries({ queryKey: ['admin', 'sessions', expoId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to update status.'),
  });

  // ── States ──────────────────────────────────────────────────────────────────
  if (isLoading) return <PageSkeleton />;

  if (isError || !session) {
    return (
      <div className="empty-state py-20">
        <div className="empty-state-icon text-error"><AlertCircle size={28} /></div>
        <h3 className="empty-state-title">Session not found</h3>
        <div className="flex gap-2 mt-3">
          <button onClick={() => refetch()} className="btn-ghost btn-sm gap-1">
            <RefreshCw size={13} /> Retry
          </button>
          <Link to={`/admin/expos/${expoId}/sessions`} className="btn-ghost btn-sm gap-1.5">
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </div>
    );
  }

  const attendees      = attendeeData?.attendees || [];
  const checkedInCount = attendeeData?.checkedIn || 0;
  const totalCount     = attendeeData?.total     || 0;
  const duration       = differenceInMinutes(new Date(session.endTime), new Date(session.startTime));
  const isLive         = session.status === 'live';
  const transitions    = STATUS_TRANSITIONS[session.status] || [];

  const filteredAttendees = attendees.filter((a) => {
    if (!attendeeSearch.trim()) return true;
    const q    = attendeeSearch.toLowerCase();
    const name  = (a.userId?.name  || '').toLowerCase();
    const email = (a.userId?.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to={`/admin/expos/${expoId}/sessions`} className="btn-ghost btn-sm gap-1.5">
            <ArrowLeft size={15} /> Sessions
          </Link>
        </div>

        {/* Status transition buttons */}
        {transitions.length > 0 && (
          <div className="flex items-center gap-2">
            {transitions.map(({ to, label, icon: Icon, cls }) => (
              <button
                key={to}
                onClick={() => statusMutation.mutate(to)}
                disabled={statusMutation.isPending}
                className={cn(cls, 'btn-sm gap-1.5')}
              >
                <Icon size={14} />
                {statusMutation.isPending ? 'Processing…' : label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Session overview card ────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card flex flex-col gap-4"
      >
        {/* Title + badges */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn('badge', FORMAT_BADGE[session.format] || 'badge-neutral')}>
              {session.format}
            </span>
            <span className={cn('badge', STATUS_BADGE[session.status] || 'badge-neutral')}>
              {session.status}
            </span>
            {session.isFeatured && <span className="badge badge-info">⭐ Featured</span>}
            {isLive && (
              <span className="badge badge-success gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
                Live Now
              </span>
            )}
          </div>
          <h1 className="text-headline-md font-semibold text-on-surface">{session.title}</h1>
          {session.description && (
            <p className="mt-2 text-body-sm text-on-surface-variant leading-relaxed line-clamp-3">
              {session.description}
            </p>
          )}
        </div>

        {/* Meta grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-label-sm text-on-surface-variant">Date</span>
            <span className="text-body-sm font-medium text-on-surface">
              {format(new Date(session.startTime), 'MMM d, yyyy')}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-label-sm text-on-surface-variant">Time</span>
            <span className="font-mono text-label-md text-on-surface">
              {format(new Date(session.startTime), 'HH:mm')} — {format(new Date(session.endTime), 'HH:mm')}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-label-sm text-on-surface-variant">Duration</span>
            <span className="text-body-sm font-medium text-on-surface">{duration} min</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-label-sm text-on-surface-variant">Room</span>
            <div className="flex items-center gap-1 text-body-sm font-medium text-on-surface">
              <MapPin size={12} className="text-secondary shrink-0" />
              {session.location}
            </div>
          </div>
        </div>

        {/* Capacity bar */}
        {session.maxCapacity && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-label-sm text-on-surface-variant">Capacity</span>
              <span className="font-mono text-label-md text-on-surface">
                {session.attendeeCount ?? 0} / {session.maxCapacity}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface-container-high overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, ((session.attendeeCount ?? 0) / session.maxCapacity) * 100)}%` }}
                transition={{ duration: 0.6 }}
                className={cn(
                  'h-full rounded-full',
                  ((session.attendeeCount ?? 0) / session.maxCapacity) >= 0.9
                    ? 'bg-error' : 'bg-secondary'
                )}
              />
            </div>
          </div>
        )}

        {/* Tags */}
        {session.tags?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag size={13} className="text-on-surface-variant" />
            {session.tags.map((tag) => (
              <span key={tag} className="badge badge-neutral">{tag}</span>
            ))}
          </div>
        )}

        {/* Stream URL */}
        {session.streamUrl && (
          <a href={session.streamUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 font-mono text-label-sm text-tertiary hover:text-secondary transition-colors">
            <Wifi size={13} /> Stream Link <ExternalLink size={11} />
          </a>
        )}
      </motion.div>

      {/* ── Speakers ─────────────────────────────────────────────── */}
      {session.speakers?.length > 0 && (
        <div className="card flex flex-col gap-4">
          <h2 className="text-headline-sm font-semibold text-on-surface border-b border-outline-variant pb-3 flex items-center gap-2">
            <Mic2 size={16} className="text-secondary" />
            {session.speakers.length === 1 ? 'Speaker' : `Speakers (${session.speakers.length})`}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {session.speakers.map((speaker) => (
              <div key={speaker._id || speaker.name}
                className="flex items-start gap-3 rounded-md border border-outline-variant px-3 py-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full
                                bg-primary-container font-mono text-label-md font-bold text-on-primary-container">
                  {speaker.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-on-surface">{speaker.name}</p>
                  {(speaker.title || speaker.company) && (
                    <p className="font-mono text-label-sm text-on-surface-variant truncate">
                      {[speaker.title, speaker.company].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  {speaker.bio && (
                    <p className="text-body-sm text-on-surface-variant line-clamp-2 mt-0.5">
                      {speaker.bio}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Resources ────────────────────────────────────────────── */}
      {session.resources?.length > 0 && (
        <div className="card flex flex-col gap-3">
          <h2 className="text-headline-sm font-semibold text-on-surface border-b border-outline-variant pb-3">
            Resources
          </h2>
          {session.resources.map((r) => (
            <a key={r._id} href={r.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 rounded px-2 py-2 text-body-sm text-tertiary
                         hover:bg-surface-container hover:text-secondary transition-colors">
              <BookOpen size={14} className="shrink-0" />
              {r.label}
              <ExternalLink size={11} className="ml-auto" />
            </a>
          ))}
        </div>
      )}

      {/* ── Attendees ─────────────────────────────────────────────── */}
      <div className="card flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant pb-3 flex-wrap">
          <div>
            <h2 className="text-headline-sm font-semibold text-on-surface flex items-center gap-2">
              <Users size={17} className="text-secondary" />
              Attendees ({totalCount})
            </h2>
            {isLive && (
              <p className="font-mono text-label-sm text-on-surface-variant mt-0.5">
                {checkedInCount} / {totalCount} checked in
              </p>
            )}
          </div>

          {/* Check-in summary for live sessions */}
          {isLive && totalCount > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-24 overflow-hidden rounded-full bg-surface-container-high">
                <div
                  className="h-full bg-success transition-all duration-500"
                  style={{ width: `${(checkedInCount / totalCount) * 100}%` }}
                />
              </div>
              <span className="font-mono text-label-sm text-secondary">
                {Math.round((checkedInCount / totalCount) * 100)}% checked in
              </span>
            </div>
          )}
        </div>

        {/* Search */}
        {totalCount > 5 && (
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="search"
              placeholder="Search attendees…"
              value={attendeeSearch}
              onChange={(e) => setAttendeeSearch(e.target.value)}
              className="input pl-9 pr-8 py-2 text-body-sm"
            />
            {attendeeSearch && (
              <button onClick={() => setAttendeeSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* Table */}
        {attendeesLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded" />
            ))}
          </div>
        ) : filteredAttendees.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-body-sm text-on-surface-variant">
              {attendeeSearch ? 'No attendees match your search.' : 'No registered attendees yet.'}
            </p>
          </div>
        ) : (
          <div className="table-wrapper !border-0 !rounded-none -mx-1">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Registered</th>
                  <th>Check-in</th>
                  <th className="w-28" />
                </tr>
              </thead>
              <tbody>
                {filteredAttendees.map((attendee) => (
                  <AttendeeRow
                    key={attendee.userId?._id || attendee.userId}
                    attendee={attendee}
                    sessionId={sid}
                    isLive={isLive}
                    onCheckedIn={() =>
                      queryClient.invalidateQueries({ queryKey: attendeesKey(sid) })
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}