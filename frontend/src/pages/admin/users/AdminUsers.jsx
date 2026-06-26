import { useState, useCallback }              from 'react';
import { Link, useSearchParams }              from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext'; 
import { motion, AnimatePresence }            from 'framer-motion';
import {
  Search, X, Users, Eye, ShieldCheck,
  Building2, Ticket, AlertCircle, RefreshCw,
  ChevronLeft, ChevronRight, UserX, UserCheck,
  MoreVertical, Mail,
} from 'lucide-react';
import { format }                             from 'date-fns';
import toast                                  from 'react-hot-toast';
import api                                    from '@/utils/api';
import { cn }                                 from '@/utils/cn';

// ─── Query keys ───────────────────────────────────────────────────────────────
const userKeys = {
  list: (params) => ['admin', 'users', 'list', params],
};

// ─── Role config ──────────────────────────────────────────────────────────────
const ROLE_TABS = [
  { value: '',          label: 'All Roles',  icon: Users      },
  { value: 'admin',     label: 'Admins',     icon: ShieldCheck },
  { value: 'exhibitor', label: 'Exhibitors', icon: Building2   },
  { value: 'attendee',  label: 'Attendees',  icon: Ticket      },
];

const ROLE_BADGE = {
  admin:     'badge-info',
  exhibitor: 'badge-success',
  attendee:  'badge-neutral',
};

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest first'  },
  { value: 'oldest',    label: 'Oldest first'  },
  { value: 'name',      label: 'Name A–Z'      },
  { value: 'lastLogin', label: 'Last active'   },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function RowSkeleton() {
  return (
    <tr className="border-b border-outline-variant">
      {[40, 24, 20, 24, 20, 16].map((w, i) => (
        <td key={i} className="px-4 py-density-high">
          <div className="skeleton h-4 rounded" style={{ width: `${w * 3}px` }} />
        </td>
      ))}
    </tr>
  );
}

// ─── Row action menu ──────────────────────────────────────────────────────────
function RowActions({ user, currentUserId, onToggleActive }) {
  const [open, setOpen] = useState(false);

  const isSelf = user._id === currentUserId;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container/100
                    hover:text-on-surface transition-colors border border-outline-variant"
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
              exit={{ opacity: 0, scale: 0.95,    y: -4  }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-8 z-50 min-w-[180px] rounded-md border
                         border-outline-variant bg-surface-bright shadow-level-2"
            >
              <Link
                to={`/admin/users/${user._id}`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                           text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <Eye size={14} /> View profile
              </Link>

              <a
                href={`mailto:${user.email}`}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2 px-3 py-2 text-body-sm
                           text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <Mail size={14} /> Send email
              </a>

              {!isSelf && user.role !== 'admin' && ( 
                <>
                  <div className="my-1 h-px bg-outline-variant" />
                  <button
                    onClick={() => { setOpen(false); onToggleActive(user); }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-body-sm transition-colors',
                      user.isActive
                        ? 'text-error hover:bg-error-container'
                        : 'text-secondary hover:bg-secondary-container/30'
                    )}
                  >
                    {user.isActive
                      ? <><UserX size={14} /> Deactivate</>
                      : <><UserCheck size={14} /> Reactivate</>}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Confirm modal ────────────────────────────────────────────────────────────
function ToggleActiveModal({ user, onConfirm, onCancel, isMutating }) {
  const isDeactivating = user.isActive;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1    }}
        exit={{ opacity: 0, scale: 0.96    }}
        transition={{ duration: 0.18 }}
        className="modal-panel max-w-md p-6"
      >
        <div className={cn(
          'mb-4 flex h-10 w-10 items-center justify-center rounded-md',
          isDeactivating ? 'bg-error-container' : 'bg-success-container'
        )}>
          {isDeactivating
            ? <UserX size={18} className="text-on-error-container" />
            : <UserCheck size={18} className="text-on-success-container" />}
        </div>
        <h2 className="mb-1 text-headline-sm font-semibold text-on-surface">
          {isDeactivating ? 'Deactivate account?' : 'Reactivate account?'}
        </h2>
        <p className="mb-5 text-body-sm text-on-surface-variant">
          {isDeactivating
            ? `${user.name} will lose access to the platform immediately. Their data is preserved.`
            : `${user.name} will regain access to the platform.`}
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={isMutating} className="btn-ghost">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={isMutating}
            className={isDeactivating ? 'btn-danger gap-1.5' : 'btn-secondary gap-1.5'}
          >
            {isMutating ? 'Processing…' : (
              isDeactivating
                ? <><UserX size={14} /> Deactivate</>
                : <><UserCheck size={14} /> Reactivate</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminUsers() {
  const { user: currentUser } = useAuth();  
  const [searchParams, setSearchParams]       = useSearchParams();
  const [toggleTarget, setToggleTarget]       = useState(null);
  const queryClient                           = useQueryClient();

  const page     = parseInt(searchParams.get('page')  || '1', 10);
  const search   = searchParams.get('search')  || '';
  const role     = searchParams.get('role')    || '';
  const isActive = searchParams.get('active');
  const sort     = searchParams.get('sort')    || 'newest';
  const LIMIT    = 20;

  const setParam = useCallback((key, value) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value !== undefined && value !== null && value !== '') next.set(key, value);
      else next.delete(key);
      if (key !== 'page') next.delete('page');
      return next;
    });
  }, [setSearchParams]);

  // ── Fetch users ─────────────────────────────────────────────────────────────
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: userKeys.list({ page, search, role, isActive, sort, limit: LIMIT }),
    queryFn:  async () => {
      const params = new URLSearchParams({
        page: String(page), limit: String(LIMIT), sort,
      });
      if (search)   params.set('search',   search);
      if (role)     params.set('role',     role);
      if (isActive !== null && isActive !== undefined && isActive !== '')
        params.set('isActive', isActive);
      const { data } = await api.get(`/users?${params}`);
      return data.data;
    },
    keepPreviousData: true,
  });

  // ── Toggle active mutation ──────────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async (user) => {
      if (user.isActive) {
        await api.delete(`/users/${user._id}`);
      } else {
        await api.patch(`/users/${user._id}`, { isActive: true });
      }
    },
    onSuccess: (_, user) => {
      toast.success(`${user.name} ${user.isActive ? 'deactivated' : 'reactivated'}.`);
      setToggleTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => toast.error(err.message || 'Failed to update account status.'),
  });

  const users      = data?.users      || [];
  const pagination = data?.pagination || {};

  return (
    <>
      <div className="flex flex-col gap-6">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Users</h1>
            <p className="page-subtitle">
              {pagination.total !== undefined
                ? `${pagination.total.toLocaleString()} total users`
                : 'Manage platform accounts'}
            </p>
          </div>
        </div>

        {/* ── Role tabs ────────────────────────────────────────────── */}
        <div className="flex gap-1 flex-wrap">
          {ROLE_TABS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setParam('role', value)}
              className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-body-sm font-medium transition-all duration-200',
                role === value
                  ? 'bg-primary text-on-primary'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}

          {/* Active / Inactive filter */}
          <div className="ml-auto flex items-center gap-1">
            {[
              { value: '',      label: 'All'        },
              { value: 'true',  label: 'Active'     },
              { value: 'false', label: 'Inactive'   },
            ].map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setParam('active', value)}
                className={cn(
                  'rounded px-2.5 py-1 font-mono text-label-sm transition-all duration-200',
                  (isActive ?? '') === value
                    ? 'bg-surface-container text-on-surface font-semibold'
                    : 'text-on-surface-variant hover:bg-surface-container/50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Search + sort ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="search"
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setParam('search', e.target.value)}
              className="input pl-9 pr-8"
            />
            {search && (
              <button onClick={() => setParam('search', '')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={sort}
            onChange={(e) => setParam('sort', e.target.value)}
            className="input w-auto shrink-0"
            aria-label="Sort users"
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* ── Table ───────────────────────────────────────────────── */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Active</th>
                <th>Joined</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle size={20} className="text-error" />
                      <span className="text-body-sm text-on-surface-variant">Failed to load users.</span>
                      <button onClick={() => refetch()} className="btn-ghost btn-sm gap-1 mt-1">
                        <RefreshCw size={13} /> Retry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16">
                    <div className="empty-state">
                      <div className="empty-state-icon mx-auto mb-3"><Users size={24} /></div>
                      <h3 className="empty-state-title">No users found</h3>
                      <p className="empty-state-body">
                        {search || role ? 'Try adjusting your filters.' : 'No users have registered yet.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {users.map((user, i) => (
                    <motion.tr
                      key={user._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, delay: i * 0.02 }}
                      className={cn(
                        'border-b border-outline-variant hover:bg-surface-container-low transition-colors duration-150',
                        !user.isActive && 'opacity-50'
                      )}
                    >
                      {/* User */}
                      <td className="px-4 py-density-high">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full
                                          bg-primary-container font-mono text-label-sm font-bold text-on-primary-container">
                            {user.avatar
                              ? <img src={user.avatar} alt={user.name}
                                  className="h-8 w-8 rounded-full object-cover" />
                              : user.name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <Link
                              to={`/admin/users/${user._id}`}
                              className="text-body-sm font-medium text-on-surface hover:text-secondary
                                         transition-colors truncate"
                            >
                              {user.name}
                            </Link>
                            <span className="font-mono text-label-sm text-on-surface-variant truncate">
                              {user.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-density-high">
                        <span className={cn('badge capitalize', ROLE_BADGE[user.role] || 'badge-neutral')}>
                          {user.role}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-density-high">
                        <span className={cn(
                          'badge',
                          user.isActive ? 'badge-success' : 'badge-error'
                        )}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Last active */}
                      <td className="px-4 py-density-high">
                        <span className="font-mono text-label-md text-on-surface-variant">
                          {user.lastLoginAt
                            ? format(new Date(user.lastLoginAt), 'MMM d, yyyy')
                            : 'Never'}
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="px-4 py-density-high">
                        <span className="font-mono text-label-md text-on-surface-variant">
                          {user.createdAt
                            ? format(new Date(user.createdAt), 'MMM d, yyyy')
                            : '—'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-density-high">
                        <RowActions
                          user={user}
                          currentUserId={currentUser?._id} 
                          onToggleActive={setToggleTarget}
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
              Page {pagination.page} of {pagination.totalPages} · {pagination.total?.toLocaleString()} users
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

      {/* ── Toggle active modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {toggleTarget && (
          <ToggleActiveModal
            user={toggleTarget}
            onConfirm={() => toggleMutation.mutate(toggleTarget)}
            onCancel={() => setToggleTarget(null)}
            isMutating={toggleMutation.isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}