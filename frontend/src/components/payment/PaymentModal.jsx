import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CreditCard,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  QrCode,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/utils/api';
import { cn } from '@/utils/cn';

export default function PaymentModal({
  isOpen,
  onClose,
  transaction,
  onSuccess,
  onCancel,
  type,
  itemName,
  amount,
  currency = 'USD',
  expiresAt,
  isFree = false,
}) {
  const [paymentMethod, setPaymentMethod] = useState('mock');
  const [isProcessing, setIsProcessing] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!expiresAt || !isOpen) return;

    const updateCountdown = () => {
      const now = new Date();
      const expiry = new Date(expiresAt);
      const diff = Math.floor((expiry - now) / 1000);

      if (diff <= 0) {
        setCountdown('Expired');
        return;
      }

      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, isOpen]);

  const handlePayment = async () => {
    if (isProcessing) return;

    setIsProcessing(true);
    setError(null);

    try {
      // ✅ For free booths, just confirm without payment
      if (isFree) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Mark as paid in backend
        const { data } = await api.post('/payments/confirm', {
          transactionId: transaction._id,
          paymentId: `free_${Date.now()}`,
        });

        toast.success('Reservation confirmed! 🎉');
        onSuccess?.(data.data);
        onClose();
        return;
      }

      // ✅ For mock payments
      if (paymentMethod === 'mock') {
        // Simulate payment processing with a nice loading animation
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const { data } = await api.post('/payments/confirm', {
          transactionId: transaction._id,
          paymentId: `mock_${Date.now()}`,
        });

        toast.success('Payment successful! 🎉');
        onSuccess?.(data.data);
        onClose();
        return;
      }

      if (paymentMethod === 'on_site') {
        toast.success('Reservation confirmed! Pay at the venue.');
        // For on-site, we just confirm the transaction
        const { data } = await api.post('/payments/confirm', {
          transactionId: transaction._id,
          paymentId: `onsite_${Date.now()}`,
        });
        onSuccess?.(data.data);
        onClose();
        return;
      }

      // For Stripe - would integrate here
      if (paymentMethod === 'stripe') {
        toast.error('Stripe payment coming soon!');
        setIsProcessing(false);
        return;
      }

    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Payment failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

 
const handleCancel = async () => {
  if (isProcessing) return;
  onCancel?.();
  onClose();
};
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format((amount || 0) / 100);
  };

  if (!isOpen) return null;

  const isExpired = countdown === 'Expired';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-bright shadow-xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-outline-variant p-4">
                <div className="flex items-center gap-2">
                  <DollarSign size={18} className="text-secondary" />
                  <h2 className="text-headline-sm font-semibold text-on-surface">
                    {isFree ? 'Confirm Reservation' : 'Complete Payment'}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="rounded p-1 text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 space-y-4">
                {/* Item details */}
                <div className="rounded-lg bg-surface-container p-3">
                  <p className="text-body-sm text-on-surface-variant">Item</p>
                  <p className="text-body-md font-semibold text-on-surface">
                    {itemName || 'Item'}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-body-sm text-on-surface-variant">
                      {isFree ? 'Price' : 'Amount'}
                    </span>
                    <span className="text-headline-sm font-bold text-secondary">
                      {isFree ? 'FREE' : formatCurrency(amount)}
                    </span>
                  </div>
                </div>

                {/* Countdown */}
                <div className="flex items-center gap-2 rounded-lg bg-warning-container/20 px-3 py-2">
                  <Clock size={14} className="text-warning" />
                  <span className="text-body-sm text-on-surface">
                    {isExpired ? (
                      <span className="text-error font-semibold">Reservation Expired</span>
                    ) : (
                      <>
                        {isFree ? 'Confirm within' : 'Complete payment within'} {' '}
                        <span className="font-mono font-semibold">{countdown}</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Payment methods - only show if not free */}
                {!isFree && (
                  <div>
                    <p className="mb-2 text-body-sm font-medium text-on-surface">
                      Payment Method
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setPaymentMethod('mock')}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all',
                          paymentMethod === 'mock'
                            ? 'border-secondary bg-secondary-container/20'
                            : 'border-outline-variant hover:border-outline'
                        )}
                      >
                        <CreditCard size={18} className={paymentMethod === 'mock' ? 'text-secondary' : 'text-on-surface-variant'} />
                        <span className="text-label-sm">Test</span>
                      </button>

                      <button
                        onClick={() => setPaymentMethod('on_site')}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all',
                          paymentMethod === 'on_site'
                            ? 'border-secondary bg-secondary-container/20'
                            : 'border-outline-variant hover:border-outline'
                        )}
                      >
                        <Building2 size={18} className={paymentMethod === 'on_site' ? 'text-secondary' : 'text-on-surface-variant'} />
                        <span className="text-label-sm">On Site</span>
                      </button>

                      <button
                        onClick={() => setPaymentMethod('stripe')}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border-2 p-2 transition-all',
                          paymentMethod === 'stripe'
                            ? 'border-secondary bg-secondary-container/20'
                            : 'border-outline-variant hover:border-outline'
                        )}
                        disabled
                      >
                        <QrCode size={18} className={paymentMethod === 'stripe' ? 'text-secondary' : 'text-on-surface-variant'} />
                        <span className="text-label-sm">Stripe</span>
                      </button>
                    </div>

                    <p className="mt-2 text-label-sm text-on-surface-variant">
                      {paymentMethod === 'mock' && '💳 Test payment - no real money will be charged'}
                      {paymentMethod === 'on_site' && '🏢 Pay at the venue registration desk'}
                      {paymentMethod === 'stripe' && '💳 Secure payment with Stripe (coming soon)'}
                    </p>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg bg-error-container/20 px-3 py-2">
                    <AlertCircle size={14} className="text-error shrink-0 mt-0.5" />
                    <span className="text-body-sm text-on-error-container">{error}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-2 border-t border-outline-variant p-4">
                <button
                  onClick={handleCancel}
                  disabled={isProcessing}
                  className="btn-ghost flex-1"
                >
                  Cancel
                </button>

                <button
                  onClick={handlePayment}
                  disabled={isProcessing || isExpired}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 transition-all',
                    isExpired
                      ? 'bg-surface-container text-on-surface-variant cursor-not-allowed'
                      : isFree
                        ? 'btn-secondary'
                        : 'btn-secondary'
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 size={16} className="animate-spin-slow" />
                      {isFree ? 'Confirming...' : 'Processing...'}
                    </>
                  ) : isExpired ? (
                    'Expired'
                  ) : isFree ? (
                    <>
                      <CheckCircle2 size={16} />
                      Confirm Reservation
                    </>
                  ) : (
                    <>
                      <CreditCard size={16} />
                      Pay Now
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}