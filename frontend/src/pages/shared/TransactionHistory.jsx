import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
  DollarSign,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { usePayment } from '@/hooks/usePayment';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';

export default function TransactionHistory() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const rolePrefix = isAdmin ? 'admin' : user?.role === 'exhibitor' ? 'exhibitor' : 'attendee';
  const { useTransactionHistory } = usePayment();
  
  const { data, isLoading, isError, refetch } = useTransactionHistory({
    page,
    limit: 10,
    status: statusFilter,
    isAdmin,
  });

  const transactions = data?.transactions || [];
  const pagination = data?.pagination || {};
  const stats = data?.stats;

  const handleFilterChange = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  };

  const statusConfig = {
    pending: { label: 'Pending', color: 'text-warning', bg: 'bg-warning-container/20', icon: Clock },
    paid: { label: 'Paid', color: 'text-success', bg: 'bg-success-container/20', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'text-error', bg: 'bg-error-container/20', icon: XCircle },
    cancelled: { label: 'Cancelled', color: 'text-on-surface-variant', bg: 'bg-surface-container', icon: AlertCircle },
    refunded: { label: 'Refunded', color: 'text-on-surface-variant', bg: 'bg-surface-container', icon: AlertCircle },
  };

  const typeConfig = {
    booth_reservation: { label: 'Booth', icon: Building2 },
    session_registration: { label: 'Session', icon: CreditCard },
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Receipt size={20} className="text-secondary" />
            {isAdmin ? 'All Transactions' : 'Transaction History'}
          </h1>
          <p className="page-subtitle">
            {isAdmin
              ? 'Platform-wide payment and reservation records'
              : 'View all your payment and reservation history'}
          </p>
        </div>
      </div>

      {isAdmin && stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Paid', value: stats.paidCount, color: 'text-success' },
            { label: 'Pending', value: stats.pendingCount, color: 'text-warning' },
            { label: 'Failed', value: stats.failedCount, color: 'text-error' },
            { label: 'Revenue', value: formatCurrency(stats.paidAmount || 0), color: 'text-secondary' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card py-3 text-center">
              <p className={cn('font-mono text-headline-sm font-bold', color)}>{value}</p>
              <p className="text-label-sm text-on-surface-variant">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleFilterChange('')}
          className={cn(
            'rounded-full px-4 py-1.5 text-body-sm font-medium transition-all',
            !statusFilter
              ? 'bg-primary text-on-primary'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          )}
        >
          All
        </button>
        {Object.entries(statusConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => handleFilterChange(key)}
            className={cn(
              'rounded-full px-4 py-1.5 text-body-sm font-medium transition-all',
              statusFilter === key
                ? `${config.bg} ${config.color} border border-current`
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            )}
          >
            <span className="flex items-center gap-1.5">
              <config.icon size={14} />
              {config.label}
            </span>
          </button>
        ))}
      </div>

      {/* Transactions list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-20 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="empty-state py-12">
          <AlertCircle size={24} className="text-error" />
          <h3 className="empty-state-title">Failed to load transactions</h3>
          <button onClick={() => refetch()} className="btn-ghost btn-sm mt-2">
            Retry
          </button>
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state py-12">
          <Receipt size={24} className="text-on-surface-variant" />
          <h3 className="empty-state-title">No transactions yet</h3>
          <p className="empty-state-body">
            You haven't made any payments or reservations yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {transactions.map((transaction, index) => {
            const status = statusConfig[transaction.status] || statusConfig.pending;
            const type = typeConfig[transaction.type] || { label: 'Other', icon: CreditCard };
            const Icon = status.icon;
            const TypeIcon = type.icon;

            return (
              <Link key={transaction._id} to={`/${rolePrefix}/transactions/${transaction._id}`}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="card flex flex-wrap items-center justify-between gap-4 hover:shadow-level-2 transition-shadow cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-full',
                    status.bg
                  )}>
                    <Icon size={18} className={status.color} />
                  </div>

                  <div>
                    <p className="text-body-sm font-semibold text-on-surface">
                      <span className="flex items-center gap-1.5">
                        <TypeIcon size={14} className="text-on-surface-variant" />
                        {type.label}
                      </span>
                    </p>
                    <p className="text-body-sm text-on-surface-variant">
                      {transaction.referenceId?.title || transaction.referenceId?.boothNumber || 'Unknown item'}
                    </p>
                    {isAdmin && transaction.userId?.name && (
                      <p className="text-label-sm text-on-surface-variant">
                        {transaction.userId.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right">
                    <p className="text-body-sm font-semibold text-secondary">
                      {formatCurrency(transaction.amount, transaction.currency)}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {transaction.currency}
                    </p>
                  </div>

                  <span className={cn('badge text-label-sm', status.bg, status.color)}>
                    {status.label}
                  </span>

                  <div className="text-right min-w-[120px]">
                    <p className="text-label-sm text-on-surface-variant">
                      {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {format(new Date(transaction.createdAt), 'HH:mm')}
                    </p>
                  </div>

                  {transaction.invoiceNumber && (
                    <div className="text-right">
                      <p className="font-mono text-label-sm text-on-surface-variant">
                        #{transaction.invoiceNumber}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-label-sm text-on-surface-variant">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} transactions
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="btn-ghost btn-sm disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="btn-ghost btn-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}