import { useState, useCallback }              from 'react';
import { Link, useSearchParams }              from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }            from 'framer-motion';
import {
  Search, X, Building2, Eye, CheckCircle2,
  XCircle, AlertCircle, RefreshCw, ChevronLeft,
  ChevronRight, MoreVertical, ShieldCheck,
  Clock, Ban,
} from 'lucide-react';
import toast                                  from 'react-hot-toast';
import api                                    from '@/utils/api';
import { cn }                                 from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const exhibitorKeys = {
  all:  ['exhibitors'],
  list: (params) => [...exhibitorKeys.all, 'list', params],
};

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
        <div className={cn('mb-4 flex h-10 w-10 items-center justify-center rounded-md', config.iconBg)}>
          <Icon size={18} className={config.iconFg} />
        </div>
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
            <button onClick={() => onConfirm(null)} disabled={isMutating} className={config.btn}>
              {isMutating ? 'Processing…' : config.label}
            </button>
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
        <button
          onClick={() => onSubmit(note || null)}
          disabled={isMutating || (required && !note.trim())}
          className={btnClass}
        >
          {isMutating ? 'Processing…' : btnLabel}
        </button>
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
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                   hover:text-on-surface transition-colors"
        aria-label="Row actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>

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
                         border-outline-variant bg-surface-bright shadow-level-2"
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
  const [modal, setModal]               = useState(null); // { action, exhibitor }
  const queryClient                     = useQueryClient();

  const page   = parseInt(searchParams.get('page')   || '1', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const LIMIT  = 15;

  // ── Fetch exhibitors ────────────────────────────────────────────────────────
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

  // ── Mutations ────────────────────────────────────────────────────────────────
  const mutationConfig = (action) => ({
    onSuccess: () => {
      toast.success(`Exhibitor ${action}d successfully.`);
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

  // ── Handlers ────────────────────────────────────────────────────────────────
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
        <div className="page-header">
          <div>
            <h1 className="page-title">Exhibitors</h1>
            <p className="page-subtitle">
              {pagination.total !== undefined
                ? `${pagination.total} exhibitor${pagination.total !== 1 ? 's' : ''}`
                : 'Manage applications and company profiles'}
            </p>
          </div>
          <Link to="/admin/exhibitors?status=pending" className="btn-secondary gap-2">
            <Clock size={15} />
            Review Queue
            {statusCounts.pending > 0 && (
              <span className="ml-0.5 flex h-5 min-w-[20px] items-center justify-center
                               rounded-full bg-warning-container px-1.5 font-mono
                               text-label-sm text-on-warning-container">
                {statusCounts.pending}
              </span>
            )}
          </Link>
        </div>

        {/* ── Status count cards ───────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            : [
                { key: 'pending',   label: 'Pending',   color: 'bg-warning-container text-on-warning-container'   },
                { key: 'approved',  label: 'Approved',  color: 'bg-success-container text-on-success-container'   },
                { key: 'rejected',  label: 'Rejected',  color: 'bg-error-container text-on-error-container'       },
                { key: 'suspended', label: 'Suspended', color: 'bg-surface-container text-on-surface-variant'     },
              ].map(({ key, label, color }) => {
                const Icon = STATUS_ICON[key];
                return (
                  <button
                    key={key}
                    onClick={() => setParam('status', status === key ? '' : key)}
                    className={cn(
                      'card flex items-center gap-3 p-4 text-left transition-all duration-200',
                      'hover:shadow-level-2',
                      status === key && 'ring-2 ring-secondary'
                    )}
                  >
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded shrink-0', color)}>
                      <Icon size={17} />
                    </div>
                    <div>
                      <p className="font-mono text-headline-sm font-bold text-on-surface">
                        {statusCounts[key] ?? 0}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">{label}</p>
                    </div>
                  </button>
                );
              })}
        </div>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1">
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
              <button
                onClick={() => setParam('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2
                           text-on-surface-variant hover:text-on-surface transition-colors"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* ── Table ─────────────────────────────────────────────────── */}
        <div className="table-wrapper">
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
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle size={20} className="text-error" />
                      <span className="text-body-sm text-on-surface-variant">
                        Failed to load exhibitors.
                      </span>
                      <button onClick={() => refetch()} className="btn-ghost btn-sm gap-1">
                        <RefreshCw size={13} /> Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Building2 size={24} />
                      </div>
                      <h3 className="empty-state-title">No exhibitors found</h3>
                      <p className="empty-state-body">
                        {search || status
                          ? 'Try adjusting your search or filters.'
                          : 'No exhibitors have registered yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {profiles.map((profile, i) => (
                    <motion.tr
                      key={profile._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className="border-b border-outline-variant hover:bg-surface-container-low
                                 transition-colors duration-150"
                    >
                      {/* Company */}
                      <td className="px-4 py-density-high">
                        <div className="flex items-center gap-3">
                          {profile.logo ? (
                            <img
                              src={profile.logo}
                              alt={profile.companyName}
                              className="h-8 w-8 rounded object-contain border border-outline-variant bg-surface-bright"
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
                        <span className={cn('badge', STATUS_BADGE[profile.applicationStatus])}>
                          {profile.applicationStatus}
                        </span>
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
                          <div className="flex items-center gap-1 text-secondary">
                            <ShieldCheck size={15} />
                            <span className="font-mono text-label-sm">Verified</span>
                          </div>
                        ) : (
                          <span className="font-mono text-label-sm text-on-surface-variant">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-density-high">
                        <RowActions
                          exhibitor={profile}
                          onAction={(action, exhibitor) => setModal({ action, exhibitor })}
                        />
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ───────────────────────────────────────────── */}
        {!isLoading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="font-mono text-label-sm text-on-surface-variant">
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
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