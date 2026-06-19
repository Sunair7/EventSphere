import { useEffect }        from 'react';
import { Link, useParams }  from 'react-router-dom';
import { useMutation }      from '@tanstack/react-query';
import { motion }           from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import api                  from '@/utils/api';

export default function VerifyEmailPage() {
  const { token } = useParams();

  const mutation = useMutation({
    mutationFn: async () => {
      await api.post(`/auth/verify-email/${token}`);
    },
  });

  // Auto-trigger verification on mount
  useEffect(() => {
    if (token) mutation.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="card flex flex-col items-center gap-5 py-10 text-center">
          {/* Loading */}
          {mutation.isPending && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-container">
                <Loader2 size={26} className="text-on-primary-container animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-headline-sm font-semibold text-on-surface mb-1">
                  Verifying your email…
                </h2>
                <p className="text-body-sm text-on-surface-variant">
                  Please wait while we verify your email address.
                </p>
              </div>
            </>
          )}

          {/* Success */}
          {mutation.isSuccess && (
            <>
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1   }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container"
              >
                <CheckCircle2 size={28} className="text-on-success-container" />
              </motion.div>
              <div>
                <h2 className="text-headline-sm font-semibold text-on-surface mb-1">
                  Email verified!
                </h2>
                <p className="text-body-sm text-on-surface-variant">
                  Your email address has been successfully verified.
                  You now have full access to all platform features.
                </p>
              </div>
              <Link to="/login" className="btn-secondary gap-2">
                <Mail size={15} /> Continue to Sign In
              </Link>
            </>
          )}

          {/* Error */}
          {mutation.isError && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-error-container">
                <XCircle size={28} className="text-on-error-container" />
              </div>
              <div>
                <h2 className="text-headline-sm font-semibold text-on-surface mb-1">
                  Verification failed
                </h2>
                <p className="text-body-sm text-on-surface-variant">
                  {mutation.error?.message || 'This verification link is invalid or has expired.'}
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                <Link to="/login" className="btn-secondary w-full gap-1.5 justify-center">
                  Sign in to resend verification
                </Link>
                <button
                  onClick={() => mutation.mutate()}
                  className="btn-ghost w-full gap-1.5"
                >
                  Try again
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}