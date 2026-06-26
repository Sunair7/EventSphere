import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Building2,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '@/utils/api';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/cn';

export default function TransactionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const rolePrefix = user?.role === 'admin' ? 'admin' : user?.role === 'exhibitor' ? 'exhibitor' : 'attendee';
  const backPath = `/${rolePrefix}/transactions`;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['transactions', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/payments/${id}`);
      return data.data;
    },
    retry: false,
  });

  const statusConfig = {
    pending: { label: 'Pending', color: 'text-warning', bg: 'bg-warning-container/20', icon: Clock },
    paid: { label: 'Paid', color: 'text-success', bg: 'bg-success-container/20', icon: CheckCircle2 },
    failed: { label: 'Failed', color: 'text-error', bg: 'bg-error-container/20', icon: XCircle },
    cancelled: { label: 'Cancelled', color: 'text-on-surface-variant', bg: 'bg-surface-container', icon: AlertCircle },
    refunded: { label: 'Refunded', color: 'text-on-surface-variant', bg: 'bg-surface-container', icon: AlertCircle },
  };

  const typeConfig = {
    booth_reservation: { label: 'Booth Reservation', icon: Building2 },
    session_registration: { label: 'Session Registration', icon: CreditCard },
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="skeleton h-8 w-32 rounded" />
        <div className="skeleton h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="empty-state py-20">
        <AlertCircle size={28} className="text-error" />
        <h3 className="empty-state-title">Transaction not found</h3>
        <p className="empty-state-body">The transaction you're looking for doesn't exist.</p>
        <Link to={backPath} className="btn-ghost btn-sm mt-3">
          Back to Transactions
        </Link>
      </div>
    );
  }

  const transaction = data;
  const status = statusConfig[transaction.status] || statusConfig.pending;
  const type = typeConfig[transaction.type] || { label: 'Transaction', icon: CreditCard };
  const Icon = status.icon;
  const TypeIcon = type.icon;

  const formatCurrency = (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount / 100);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={backPath} className="btn-ghost btn-sm gap-1.5">
          <ArrowLeft size={15} /> Back
        </Link>
        <h1 className="page-title flex items-center gap-2">
          <Receipt size={20} className="text-secondary" />
          Transaction Details
        </h1>
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card max-w-3xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <TypeIcon size={18} className="text-on-surface-variant" />
              <span className="text-body-sm font-medium text-on-surface-variant">
                {type.label}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <h2 className="text-headline-md font-semibold text-on-surface">
                {formatCurrency(transaction.amount, transaction.currency)}
              </h2>
              <span className={cn('badge text-label-sm', status.bg, status.color)}>
                <Icon size={12} className="inline mr-1" />
                {status.label}
              </span>
            </div>
          </div>
          {transaction.invoiceNumber && (
            <div className="text-right">
              <p className="font-mono text-label-sm text-on-surface-variant">
                Invoice #{transaction.invoiceNumber}
              </p>
            </div>
          )}
        </div>

        <div className="divider" />

        {/* Details Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="font-mono text-label-sm text-on-surface-variant">Item</p>
            <p className="text-body-md font-medium text-on-surface">
              {transaction.referenceId?.title || transaction.referenceId?.boothNumber || 'Unknown'}
            </p>
          </div>

          <div>
            <p className="font-mono text-label-sm text-on-surface-variant">Expo</p>
            <p className="text-body-md font-medium text-on-surface">
              {transaction.expoId?.title || 'Unknown'}
            </p>
          </div>

          <div>
            <p className="font-mono text-label-sm text-on-surface-variant">Customer</p>
            <div className="flex items-center gap-2 mt-0.5">
              {transaction.userId?.avatar ? (
                <img
                  src={transaction.userId.avatar}
                  alt={transaction.userId.name}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-container">
                  <User size={12} className="text-on-primary-container" />
                </div>
              )}
              <span className="text-body-sm font-medium text-on-surface">
                {transaction.userId?.name || 'Unknown'}
              </span>
            </div>
            <p className="text-label-sm text-on-surface-variant">
              {transaction.userId?.email || ''}
            </p>
          </div>

          <div>
            <p className="font-mono text-label-sm text-on-surface-variant">Payment Method</p>
            <p className="text-body-md font-medium text-on-surface capitalize">
              {transaction.paymentMethod || 'Not specified'}
            </p>
          </div>

          <div>
            <p className="font-mono text-label-sm text-on-surface-variant">Created At</p>
            <p className="text-body-sm text-on-surface">
              {format(new Date(transaction.createdAt), 'MMM d, yyyy HH:mm')}
            </p>
          </div>

          <div>
            <p className="font-mono text-label-sm text-on-surface-variant">Status Updated</p>
            <p className="text-body-sm text-on-surface">
              {format(new Date(transaction.updatedAt), 'MMM d, yyyy HH:mm')}
            </p>
          </div>

          {transaction.paidAt && (
            <div>
              <p className="font-mono text-label-sm text-on-surface-variant">Paid At</p>
              <p className="text-body-sm text-on-surface">
                {format(new Date(transaction.paidAt), 'MMM d, yyyy HH:mm')}
              </p>
            </div>
          )}

          {transaction.providerTransactionId && (
            <div>
              <p className="font-mono text-label-sm text-on-surface-variant">Transaction ID</p>
              <p className="font-mono text-label-sm text-on-surface break-all">
                {transaction.providerTransactionId}
              </p>
            </div>
          )}
        </div>

        {transaction.cancellationReason && (
          <>
            <div className="divider" />
            <div>
              <p className="font-mono text-label-sm text-on-surface-variant">Cancellation Reason</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                {transaction.cancellationReason}
              </p>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}