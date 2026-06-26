import { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useSearchParams }              from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Search, X, Building2, Eye, CheckCircle2,
  XCircle, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, MoreVertical, ShieldCheck,
  Clock, Ban, Sparkles,
} from 'lucide-react';
import toast                                  from 'react-hot-toast';
import api                                    from '@/utils/api';
import { cn }                                 from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const exhibitorKeys = {
  all:  ['exhibitors'],
  list: (params) => [...exhibitorKeys.all, 'list', params],
};

// ─── Animated Counter (inline) ────────────────────────────────────────────────
function CountUp({ end, duration = 1 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView || !end) return;
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

  return <span ref={ref} className="tabular-nums">{display.toLocaleString()}</span>;
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { value: '',          label: 'All',       icon: null          },
  { value: 'pending',   label: 'Pending',   icon: Clock         },
  { value: 'approved',  label: 'Approved',  icon: CheckCircle2  },
  { value: 'rejected',  label: 'Rejected',  icon: XCircle       },
  { value: 'suspended', label: 'Suspended', icon: Ban           },
];

const STATUS_BADGE = {
  pending:   'badge-warning',
  approved:  'badge-success',
  rejected:  'badge-error',
  suspended: 'badge-neutral',
};

const STATUS_ICON = {
  pending:   Clock,
  approved:  CheckCircle2,
  rejected:  XCircle,
  suspended: Ban,
};

// ─── Skeletons ────────────────────────────────────────────────────────────────
function TableRowSkeleton() {
  return (
    <tr className="border-b border-outline-variant">
      {[48, 20, 28, 24, 20, 16].map((w, i) => (
        <td key={i} className="px-4 py-density-high">
          <div className="skeleton h-4 rounded" style={{ width: `${w * 3}px` }} />
        </td>
      ))}
    </tr>
  );
}

function StatCardSkeleton() {
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className="skeleton h-9 w-9 rounded" />
      <div className="flex flex-col gap-1.5">
        <div className="skeleton h-5 w-12 rounded" />
        <div className="skeleton h-3 w-20 rounded" />
      </div>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ConfirmModal({ action, exhibitor, onConfirm, onCancel, isMutating }) {
  const isApprove = action === 'approve';
  const isReject  = action === 'reject';
  const isSuspend = action === 'suspend';

  const config = {
    approve: {
      title:  'Approve application?',
      body:   `"${exhibitor.companyName}" will be approved and can proceed to book booths.`,
      icon:   CheckCircle2,
      iconBg: 'bg-success-container',
      iconFg: 'text-on-success-container',
      btn:    'btn-secondary',
      label:  'Approve',
    },
    reject: {
      title:  'Reject application?',
      body:   `"${exhibitor.companyName}" will be notified that their application was not approved.`,
      icon:   XCircle,
      iconBg: 'bg-error-container',
      iconFg: 'text-on-error-container',
      btn:    'btn-danger',
      label:  'Reject',
    },
    suspend: {
      title:  'Suspend exhibitor?',
      body:   `"${exhibitor.companyName}" will lose access to booth reservations and expo participation.`,
      icon:   Ban,
      iconBg: 'bg-warning-container',
      iconFg: 'text-on-warning-container',
      btn:    'btn-danger',
      label:  'Suspend',
    },
  }[action] || {};

  const Icon = config.icon;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1    }}
        exit={{ opacity: 0, scale: 0.96    }}
        transition={{ duration: 0.18 }}
        className="modal-panel max-w-md p-6"
      >
        <motion.div
          initial={{ rotate: -10, scale: 0 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
          className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-md', config.iconBg)}
        >
          <Icon size={18} className={config.iconFg} />
        </motion.div>
        <h2 className="mb-1 text-headline-sm font-semibold text-on-surface">{config.title}</h2>
        <p className="mb-5 text-body-sm text-on-surface-variant">{config.body}</p>

        {isReject || isSuspend ? (
          <ReasonForm
            onSubmit={(note) => onConfirm(note)}
            onCancel={onCancel}
            isMutating={isMutating}
            btnClass={config.btn}
            btnLabel={config.label}
            required={isReject}
          />
        ) : (
          <div className="flex justify-end gap-3">
            <button onClick={onCancel} disabled={isMutating} className="btn-ghost">
              Cancel
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onConfirm(null)}
              disabled={isMutating}
              className={config.btn}
            >
              {isMutating ? (
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin-slow" />
                  Processing…
                </span>
              ) : config.label}
            </motion.button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ReasonForm({ onSubmit, onCancel, isMutating, btnClass, btnLabel, required }) {
  const [note, setNote] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-label-md text-on-surface">
          Reason {required && <span className="text-error">*</span>}
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={required ? 'Provide a reason for the applicant…' : 'Optional note…'}
          className="input resize-none"
          maxLength={1000}
          autoFocus
        />
        <p className="font-mono text-label-sm text-on-surface-variant text-right">
          {note.length}/1000
        </p>
      </div>
      <div className="flex justify-end gap-3">
        <button onClick={onCancel} disabled={isMutating} className="btn-ghost">
          Cancel
        </button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSubmit(note || null)}
          disabled={isMutating || (required && !note.trim())}
          className={btnClass}
        >
          {isMutating ? (
            <span className="flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin-slow" />
              Processing…
            </span>
          ) : btnLabel}
        </motion.button>
      </div>
    </div>
  );
}

// ─── Row action menu ──────────────────────────────────────────────────────────
function RowActions({ exhibitor, onAction }) {
  const [open, setOpen] = useState(false);
  const { applicationStatus } = exhibitor;

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                   hover:text-on-surface transition-colors"
        aria-label="Row actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1,    y: 0   }}
              exit={{ opacity: 0, scale: 0.95, y: -4     }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-8 z-50 min-w-[180px] rounded-md border
                         border-outline-variant bg-surface-bright shadow-level-2 overflow-hidden"
            >
              <Link
                to={`/admin/exhibitors/${exhibitor._id}`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                           text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <Eye size={14} /> View profile
              </Link>

              {applicationStatus === 'pending' && (
                <>
                  <button
                    onClick={() => { setOpen(false); onAction('approve', exhibitor); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                               text-secondary hover:bg-secondary-container/30 transition-colors"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button
                    onClick={() => { setOpen(false); onAction('reject', exhibitor); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                               text-error hover:bg-error-container transition-colors"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </>
              )}

              {applicationStatus === 'approved' && (
                <button
                  onClick={() => { setOpen(false); onAction('suspend', exhibitor); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                             text-error hover:bg-error-container transition-colors"
                >
                  <Ban size={14} /> Suspend
                </button>
              )}

              {(applicationStatus === 'rejected' || applicationStatus === 'suspended') && (
                <button
                  onClick={() => { setOpen(false); onAction('approve', exhibitor); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                             text-secondary hover:bg-secondary-container/30 transition-colors"
                >
                  <CheckCircle2 size={14} /> Re-approve
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminExhibitors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modal, setModal]               = useState(null);
  const queryClient                     = useQueryClient();

  const page   = parseInt(searchParams.get('page')   || '1', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const LIMIT  = 15;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: exhibitorKeys.list({ page, search, status, limit: LIMIT }),
    queryFn:  async () => {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(LIMIT),
      });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const { data } = await api.get(`/exhibitors?${params}`);
      return data.data;
    },
    keepPreviousData: true,
  });

  const mutationConfig = (action) => ({
    onSuccess: () => {
      toast.success(`Exhibitor ${action}d successfully.`, {
        icon: action === 'approve' ? '✅' : action === 'reject' ? '❌' : '⚠️',
      });
      setModal(null);
      queryClient.invalidateQueries({ queryKey: exhibitorKeys.all });
    },
    onError: (err) => toast.error(err.message || `Failed to ${action} exhibitor.`),
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, note }) => api.patch(`/exhibitors/${id}/approve`, { note }),
    ...mutationConfig('approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) => api.patch(`/exhibitors/${id}/reject`,  { note }),
    ...mutationConfig('reject'),
  });

  const suspendMutation = useMutation({
    mutationFn: ({ id, note }) => api.patch(`/exhibitors/${id}/suspend`, { note }),
    ...mutationConfig('suspend'),
  });

  const isMutating =
    approveMutation.isPending ||
    rejectMutation.isPending  ||
    suspendMutation.isPending;

  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else        next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  const handleConfirm = useCallback((note) => {
    if (!modal) return;
    const payload = { id: modal.exhibitor._id, note };
    if (modal.action === 'approve') approveMutation.mutate(payload);
    if (modal.action === 'reject')  rejectMutation.mutate(payload);
    if (modal.action === 'suspend') suspendMutation.mutate(payload);
  }, [modal, approveMutation, rejectMutation, suspendMutation]);

  const profiles    = data?.profiles    || [];
  const pagination  = data?.pagination  || {};
  const statusCounts = data?.statusCounts?.reduce(
    (acc, { status, count }) => ({ ...acc, [status]: count }),
    {}
  ) || {};

  return (
    <>
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
              Exhibitors
            </h1>
            <p className="page-subtitle">
              {pagination.total !== undefined
                ? `${pagination.total.toLocaleString()} exhibitor${pagination.total !== 1 ? 's' : ''}`
                : 'Manage applications and company profiles'}
            </p>
          </div>
          <Link to="/admin/exhibitors?status=pending" className="btn-secondary gap-2 group">
            <Clock size={15} />
            Review Queue
            {statusCounts.pending > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center
                             rounded-full bg-warning-container px-1.5 font-mono
                             text-label-sm text-on-warning-container"
              >
                {statusCounts.pending > 99 ? '99+' : statusCounts.pending}
              </motion.span>
            )}
          </Link>
        </motion.div>

        {/* ── Status count cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : [
                { key: 'pending',   label: 'Pending',   color: 'bg-warning-container text-on-warning-container'   },
                { key: 'approved',  label: 'Approved',  color: 'bg-success-container text-on-success-container'   },
                { key: 'rejected',  label: 'Rejected',  color: 'bg-error-container text-on-error-container'       },
                { key: 'suspended', label: 'Suspended', color: 'bg-surface-container text-on-surface-variant'     },
              ].map(({ key, label, color }, i) => {
                const Icon = STATUS_ICON[key];
                const count = statusCounts[key] ?? 0;
                return (
                  <motion.button
                    key={key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                    whileHover={{ y: -2, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setParam('status', status === key ? '' : key)}
                    className={cn(
                      'card flex items-center gap-3 p-4 text-left transition-all duration-200 relative overflow-hidden',
                      'hover:shadow-level-2',
                      status === key && 'ring-2 ring-secondary'
                    )}
                  >
                    {/* Gradient highlight on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-secondary/[0.02] opacity-0 hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    
                    <motion.div
                      whileHover={{ rotate: [0, -5, 5, 0] }}
                      transition={{ duration: 0.3 }}
                      className={cn('flex h-9 w-9 items-center justify-center rounded shrink-0 relative z-10', color)}
                    >
                      <Icon size={17} />
                      {/* Live pulse for pending */}
                      {key === 'pending' && count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warning" />
                        </span>
                      )}
                    </motion.div>
                    <div className="relative z-10">
                      <p className="font-mono text-headline-sm font-bold text-on-surface">
                        <CountUp end={count} />
                      </p>
                      <p className="text-body-sm text-on-surface-variant">{label}</p>
                    </div>
                  </motion.button>
                );
              })}
        </div>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((tab) => (
              <motion.button
                key={tab.value}
                whileHover={{ y: -1 }}
                whileTap={{ y: 0 }}
                onClick={() => setParam('status', tab.value)}
                className={cn(
                  'relative rounded px-3 py-1.5 text-body-sm font-medium transition-all duration-200',
                  status === tab.value
                    ? 'bg-primary text-on-primary'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )}
              >
                {tab.label}
                {tab.value && statusCounts[tab.value] > 0 && (
                  <span className="ml-1.5 font-mono text-label-sm opacity-70">
                    {statusCounts[tab.value]}
                  </span>
                )}
                {status === tab.value && (
                  <motion.span
                    layoutId="exhibitor-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-t"
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </motion.button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"
            />
            <input
              type="search"
              placeholder="Search company or industry…"
              value={search}
              onChange={(e) => setParam('search', e.target.value)}
              className="input pl-9 pr-8"
            />
            {search && (
              <motion.button
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                onClick={() => setParam('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label="Clear search"
              >
                <X size={14} />
              </motion.button>
            )}
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="table-wrapper"
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Status</th>
                <th>Industry</th>
                <th>Contact</th>
                <th>Verified</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                      >
                        <AlertCircle size={20} className="text-error" />
                      </motion.div>
                      <span className="text-body-sm text-on-surface-variant">
                        Failed to load exhibitors.
                      </span>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => refetch()}
                        className="btn-ghost btn-sm gap-1"
                      >
                        <RefreshCw size={13} /> Retry
                      </motion.button>
                    </motion.div>
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="empty-state"
                    >
                      <motion.div
                        animate={{ y: [0, -8, 0] }}
                        transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                        className="empty-state-icon"
                      >
                        <Building2 size={24} />
                      </motion.div>
                      <h3 className="empty-state-title">No exhibitors found</h3>
                      <p className="empty-state-body">
                        {search || status
                          ? 'Try adjusting your search or filters.'
                          : 'No exhibitors have registered yet.'}
                      </p>
                    </motion.div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {profiles.map((profile, i) => (
                    <motion.tr
                      key={profile._id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2, delay: i * 0.03 }}
                      className="border-b border-outline-variant hover:bg-surface-container-low
                                 transition-colors duration-150 group"
                    >
                      {/* Company */}
                      <td className="px-4 py-density-high">
                        <div className="flex items-center gap-3">
                          {profile.logo ? (
                            <motion.img
                              whileHover={{ scale: 1.1 }}
                              src={profile.logo}
                              alt={profile.companyName}
                              className="h-8 w-8 rounded object-contain border border-outline-variant bg-surface-bright transition-transform"
                            />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center
                                            rounded bg-primary-container text-on-primary-container">
                              <Building2 size={14} />
                            </div>
                          )}
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <Link
                              to={`/admin/exhibitors/${profile._id}`}
                              className="font-medium text-on-surface hover:text-secondary
                                         transition-colors line-clamp-1"
                            >
                              {profile.companyName}
                            </Link>
                            <span className="font-mono text-label-sm text-on-surface-variant">
                              {profile.userId?.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-density-high">
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: i * 0.03 + 0.1, type: 'spring', stiffness: 300 }}
                          className={cn('badge', STATUS_BADGE[profile.applicationStatus])}
                        >
                          {profile.applicationStatus === 'pending' && (
                            <span className="relative flex h-1.5 w-1.5 mr-1">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-warning" />
                            </span>
                          )}
                          {profile.applicationStatus}
                        </motion.span>
                      </td>

                      {/* Industry */}
                      <td className="px-4 py-density-high">
                        <span className="text-body-sm text-on-surface-variant">
                          {profile.industry || '—'}
                        </span>
                      </td>

                      {/* Contact */}
                      <td className="px-4 py-density-high">
                        <span className="text-body-sm text-on-surface">
                          {profile.contactPerson?.name || '—'}
                        </span>
                      </td>

                      {/* Verified */}
                      <td className="px-4 py-density-high">
                        {profile.isVerified ? (
                          <motion.div
                            initial={{ opacity: 0, x: -5 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 + 0.15 }}
                            className="flex items-center gap-1 text-secondary"
                          >
                            <ShieldCheck size={15} />
                            <span className="font-mono text-label-sm">Verified</span>
                          </motion.div>
                        ) : (
                          <span className="font-mono text-label-sm text-on-surface-variant">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-density-high">
                        <div className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
                          <RowActions
                            exhibitor={profile}
                            onAction={(action, exhibitor) => setModal({ action, exhibitor })}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </motion.div>

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

      {/* ── Action modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {modal && (
          <ConfirmModal
            action={modal.action}
            exhibitor={modal.exhibitor}
            onConfirm={handleConfirm}
            onCancel={() => setModal(null)}
            isMutating={isMutating}
          />
        )}
      </AnimatePresence>
    </>
  );
}