import { useState, useCallback }          from 'react';
import { Link, useSearchParams }          from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }        from 'framer-motion';
import {
  Plus, Search, Calendar, MapPin, LayoutGrid,
  BookOpen, MoreVertical, Edit2, Trash2,
  Eye, Send, X, AlertCircle, RefreshCw,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { format }                         from 'date-fns';
import toast                              from 'react-hot-toast';
import api                                from '@/utils/api';
import { cn }                             from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const expoKeys = {
  all:  ['expos'],
  list: (params) => [...expoKeys.all, 'list', params],
};

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { value: '',          label: 'All'       },
  { value: 'draft',     label: 'Draft'     },
  { value: 'published', label: 'Published' },
  { value: 'ongoing',   label: 'Live'      },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_BADGE = {
  draft:     'badge-neutral',
  published: 'badge-info',
  ongoing:   'badge-success',
  completed: 'badge-neutral',
  cancelled: 'badge-error',
};

// ─── Skeleton row ─────────────────────────────────────────────────────────────
function TableRowSkeleton() {
  return (
    <tr className="border-b border-outline-variant">
      {[40, 24, 32, 24, 20, 16].map((w, i) => (
        <td key={i} className="px-4 py-density-high">
          <div className={`skeleton h-4 rounded`} style={{ width: `${w * 3}px` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function DeleteModal({ expo, onConfirm, onCancel, isDeleting }) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-title">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1    }}
        exit={{ opacity: 0, scale: 0.96    }}
        transition={{ duration: 0.18 }}
        className="modal-panel max-w-md p-6"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-error-container">
          <Trash2 size={18} className="text-on-error-container" />
        </div>
        <h2 id="delete-title" className="mb-1 text-headline-sm font-semibold text-on-surface">
          Delete expo?
        </h2>
        <p className="mb-5 text-body-sm text-on-surface-variant">
          <span className="font-medium text-on-surface">"{expo.title}"</span> and all associated
          booths and sessions will be permanently deleted. This cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={isDeleting} className="btn-ghost">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting} className="btn-danger">
            {isDeleting ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  className="inline-block h-4 w-4 rounded-full border-2 border-on-error/30 border-t-on-error"
                />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 size={14} /> Delete expo
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Row Action Menu ──────────────────────────────────────────────────────────
function RowActions({ expo, onDelete }) {
  const [open, setOpen] = useState(false);
  const queryClient     = useQueryClient();

  const publishMutation = useMutation({
    mutationFn: async () => api.patch(`/expos/${expo._id}/status`, { status: 'published' }),
    onSuccess:  () => {
      toast.success(`"${expo.title}" published successfully.`);
      queryClient.invalidateQueries({ queryKey: expoKeys.all });
    },
    onError: (err) => toast.error(err.message || 'Failed to publish expo.'),
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                   hover:text-on-surface transition-colors duration-200"
        aria-label="Row actions"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <MoreVertical size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1,    y: 0   }}
              exit={{ opacity: 0, scale: 0.95, y: -4   }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-8 z-50 min-w-[160px] rounded-md border
                         border-outline-variant bg-surface-bright shadow-level-2"
            >
              <Link
                to={`/admin/expos/${expo._id}`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                           text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <Eye size={14} /> View detail
              </Link>

              <Link
                to={`/admin/expos/${expo._id}/floor-plan`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                           text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <LayoutGrid size={14} /> Floor plan
              </Link>

              <Link
                to={`/admin/expos/${expo._id}/edit`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                           text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <Edit2 size={14} /> Edit
              </Link>

              {expo.status === 'draft' && (
                <button
                  onClick={() => { setOpen(false); publishMutation.mutate(); }}
                  disabled={publishMutation.isPending}
                  className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                             text-secondary hover:bg-secondary-container/30 transition-colors"
                >
                  <Send size={14} />
                  {publishMutation.isPending ? 'Publishing…' : 'Publish'}
                </button>
              )}

              <div className="my-1 h-px bg-outline-variant" />

              <button
                onClick={() => { setOpen(false); onDelete(expo); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                           text-error hover:bg-error-container transition-colors"
              >
                <Trash2 size={14} /> Delete
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminExpos() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [deleteTarget, setDeleteTarget] = useState(null);

  const page   = parseInt(searchParams.get('page')   || '1', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || '';
  const LIMIT  = 12;

  const queryClient = useQueryClient();

  // ── Fetch expos ─────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: expoKeys.list({ page, search, status, limit: LIMIT }),
    queryFn:  async () => {
      const params = new URLSearchParams({
        page:  String(page),
        limit: String(LIMIT),
        sort:  'newest',
      });
      if (search) params.set('search', search);
      if (status) params.set('status', status);
      const { data } = await api.get(`/expos?${params}`);
      return data.data;
    },
    keepPreviousData: true,
  });

  // ── Delete mutation ─────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/expos/${id}`),
    onSuccess: () => {
      toast.success('Expo deleted successfully.');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: expoKeys.all });
    },
    onError: (err) => toast.error(err.message || 'Failed to delete expo.'),
  });

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

  const expos      = data?.expos      || [];
  const pagination = data?.pagination || {};

  return (
    <>
      <div className="flex flex-col gap-6">

        {/* ── Page header ───────────────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Expos</h1>
            <p className="page-subtitle">
              {pagination.total !== undefined
                ? `${pagination.total} expo${pagination.total !== 1 ? 's' : ''} total`
                : 'Manage your events'}
            </p>
          </div>
          <Link to="/admin/expos/create" className="btn-secondary gap-2">
            <Plus size={16} /> New Expo
          </Link>
        </div>

        {/* ── Filters ───────────────────────────────────────────────── */}
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
              placeholder="Search expos…"
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
                <th>Expo</th>
                <th>Status</th>
                <th>Date</th>
                <th>Location</th>
                <th className="text-center">Booths</th>
                <th className="text-center">Sessions</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <TableRowSkeleton key={i} />)
              ) : isError ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-on-surface-variant">
                      <AlertCircle size={20} className="text-error" />
                      <span className="text-body-sm">Failed to load expos.</span>
                      <button onClick={() => refetch()} className="btn-ghost btn-sm gap-1">
                        <RefreshCw size={13} /> Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : expos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="empty-state">
                      <div className="empty-state-icon">
                        <Calendar size={24} />
                      </div>
                      <h3 className="empty-state-title">No expos found</h3>
                      <p className="empty-state-body mb-4">
                        {search || status
                          ? 'Try adjusting your search or filters.'
                          : 'Create your first expo to get started.'}
                      </p>
                      {!search && !status && (
                        <Link to="/admin/expos/create" className="btn-secondary btn-sm gap-1">
                          <Plus size={14} /> Create expo
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {expos.map((expo, i) => (
                    <motion.tr
                      key={expo._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.03 }}
                      className="border-b border-outline-variant hover:bg-surface-container-low
                                 transition-colors duration-150"
                    >
                      {/* Title */}
                      <td className="px-4 py-density-high">
                        <div className="flex flex-col gap-0.5">
                          <Link
                            to={`/admin/expos/${expo._id}`}
                            className="font-medium text-on-surface hover:text-secondary
                                       transition-colors duration-200 line-clamp-1"
                          >
                            {expo.title}
                          </Link>
                          {expo.theme && (
                            <span className="font-mono text-label-sm text-on-surface-variant line-clamp-1">
                              {expo.theme}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-density-high">
                        <span className={cn('badge', STATUS_BADGE[expo.status] || 'badge-neutral')}>
                          {expo.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-density-high">
                        <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                          <Calendar size={13} className="shrink-0" />
                          <span className="font-mono text-label-md whitespace-nowrap">
                            {format(new Date(expo.startDate), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-density-high">
                        <div className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
                          <MapPin size={13} className="shrink-0" />
                          <span className="line-clamp-1">
                            {expo.address?.city}, {expo.address?.country}
                          </span>
                        </div>
                      </td>

                      {/* Booths */}
                      <td className="px-4 py-density-high text-center">
                        <span className="font-mono text-label-md text-on-surface">
                          {expo.boothCount ?? 0}
                        </span>
                      </td>

                      {/* Sessions */}
                      <td className="px-4 py-density-high text-center">
                        <span className="font-mono text-label-md text-on-surface">
                          {expo.sessionCount ?? 0}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-density-high">
                        <RowActions expo={expo} onDelete={setDeleteTarget} />
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────── */}
        {!isLoading && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="font-mono text-label-sm text-on-surface-variant">
              Page {pagination.page} of {pagination.totalPages} ·{' '}
              {pagination.total} total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setParam('page', String(page - 1))}
                disabled={!pagination.hasPrevPage}
                className="btn-ghost btn-sm gap-1 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft size={15} /> Prev
              </button>
              <button
                onClick={() => setParam('page', String(page + 1))}
                disabled={!pagination.hasNextPage}
                className="btn-ghost btn-sm gap-1 disabled:opacity-40"
                aria-label="Next page"
              >
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ──────────────────────────────── */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            expo={deleteTarget}
            onConfirm={() => deleteMutation.mutate(deleteTarget._id)}
            onCancel={() => setDeleteTarget(null)}
            isDeleting={deleteMutation.isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}