import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Bell, CheckCheck, X, Loader2 } from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import api from '@/utils/api';
import { cn } from '@/utils/cn';

const NOTIFICATION_ICONS = {
  application_submitted: '📝',
  application_approved: '✅',
  application_rejected: '❌',
  application_suspended: '🚫',
  document_uploaded: '📄',
  document_verified: '✅',
  document_flagged: '⚠️',
  booth_reserved: '🏗️',
  booth_approved: '🎉',
  booth_rejected: '❌',
  booth_released: '🔓',
  expo_published: '📢',
  expo_cancelled: '🚫',
  session_registered: '📅',
  session_cancelled: '❌',
  session_live: '🔴',
  system: 'ℹ️',
};

export default function NotificationPanel({ onClose }) {
  const queryClient = useQueryClient();
  const { isLoading: authLoading } = useAuth();

  const { data, isLoading: notifLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: async () => {
      const { data } = await api.get('/notifications?limit=10');
      return data.data;
    },
    refetchOnMount: true,
  });

  const markAllMutation = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markOneMutation = useMutation({
    mutationFn: (id) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.96 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-12 z-50 w-80 sm:w-96 max-h-[70vh] overflow-hidden rounded-xl border border-outline-variant bg-surface-bright shadow-level-3"
    >
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-secondary" />
          <h3 className="text-body-sm font-semibold text-on-surface">Notifications</h3>
          {unreadCount > 0 && <span className="badge badge-error text-label-sm">{unreadCount} new</span>}
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="rounded p-1 text-on-surface-variant hover:text-secondary transition-colors"
              title="Mark all read"
            >
              <CheckCheck size={15} />
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded p-1 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[60vh]">
        {notifLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin-slow text-on-surface-variant" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Bell size={28} className="text-on-surface-variant/30 mb-2" />
            <p className="text-body-sm text-on-surface-variant">No notifications yet</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const target = notif.link || '#';

            return (
              <Link
                key={notif._id}
                to={target}
                onClick={(e) => {
                  // Defer navigation while auth context is still hydrating after refresh.
                  // This prevents protected-route guards from redirecting to /unauthorised.
                  if (authLoading) {
                    e.preventDefault();
                    return;
                  }

                  if (!notif.isRead) markOneMutation.mutate(notif._id);
                  onClose();
                }}
                className={cn(
                  'flex items-start gap-3 px-4 py-3 border-b border-outline-variant/50',
                  'hover:bg-surface-container-low transition-colors',
                  !notif.isRead && 'bg-secondary-container/10'
                )}
              >
                <span className="text-lg shrink-0 mt-0.5">{NOTIFICATION_ICONS[notif.type] || 'ℹ️'}</span>

                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      'text-body-sm line-clamp-2',
                      !notif.isRead ? 'font-semibold text-on-surface' : 'text-on-surface'
                    )}
                  >
                    {notif.title}
                  </p>

                  {notif.body && (
                    <p className="text-body-sm text-on-surface-variant line-clamp-1 mt-0.5">{notif.body}</p>
                  )}

                  <p className="font-mono text-label-sm text-on-surface-variant mt-1">
                    {format(new Date(notif.createdAt), 'MMM d, HH:mm')}
                  </p>
                </div>

                {!notif.isRead && <span className="h-2 w-2 rounded-full bg-secondary shrink-0 mt-2" />}
              </Link>
            );
          })
        )}
      </div>
    </motion.div>
  );
}

