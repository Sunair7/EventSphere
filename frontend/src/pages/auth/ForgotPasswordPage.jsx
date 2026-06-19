import { useState }            from 'react';
import { Link }                from 'react-router-dom';
import { useForm }             from 'react-hook-form';
import { zodResolver }         from '@hookform/resolvers/zod';
import { z }                   from 'zod';
import { useMutation }         from '@tanstack/react-query';
import { motion }              from 'framer-motion';
import {
  Mail, ArrowLeft, Send, CheckCircle2,
  CalendarDays, AlertCircle,
} from 'lucide-react';
import api                     from '@/utils/api';
import { cn }                  from '@/utils/cn';

const schema = z.object({
  email: z.string().min(1, 'Email address is required.').email('Please enter a valid email address.'),
});

const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
};

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted]     = useState(false);
  const [submittedEmail, setEmail]    = useState('');
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: '' } });

  const mutation = useMutation({
    mutationFn: async ({ email }) => {
      const { data } = await api.post('/auth/forgot-password', { email });
      return data;
    },
    onSuccess: (_, { email }) => { setSubmittedEmail(email); setSubmitted(true); },
    onError:   (err) => setServerError(err.message || 'Unable to send reset email. Please try again.'),
  });

  const onSubmit = (values) => { setServerError(null); mutation.mutate(values); };

  if (submitted) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16">
        <motion.div variants={containerVariants} initial="hidden" animate="visible"
          className="w-full max-w-md text-center">
          <motion.div variants={itemVariants} className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full
                            bg-success-container shadow-level-2">
              <CheckCircle2 size={32} className="text-on-success-container" />
            </div>
          </motion.div>
          <motion.h1 variants={itemVariants} className="text-headline-md font-semibold text-on-surface mb-2">
            Check your inbox
          </motion.h1>
          <motion.p variants={itemVariants} className="text-body-md text-on-surface-variant mb-1">
            If an account exists for
          </motion.p>
          <motion.p variants={itemVariants} className="font-mono text-label-md font-semibold text-on-surface mb-4">
            {submittedEmail}
          </motion.p>
          <motion.p variants={itemVariants} className="text-body-sm text-on-surface-variant mb-8">
            a password reset link has been sent. The link expires in{' '}
            <span className="font-medium text-on-surface">15 minutes</span>.
            Check your spam folder if you don't see it.
          </motion.p>
          <motion.div variants={itemVariants} className="flex flex-col gap-3">
            <button onClick={() => { setSubmitted(false); setServerError(null); }}
              className="btn-ghost w-full gap-2 justify-center">
              <Mail size={15} /> Try a different email
            </button>
            <Link to="/login" className="btn-secondary w-full gap-2 justify-center">
              <ArrowLeft size={15} /> Back to Sign In
            </Link>
          </motion.div>
          <motion.p variants={itemVariants} className="mt-6 font-mono text-label-sm text-on-surface-variant">
            Didn't get an email? Wait a few minutes before requesting again.
          </motion.p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16">
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full max-w-md">
        <motion.div variants={itemVariants} className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary shadow-level-2">
            <CalendarDays size={22} className="text-on-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-headline-md font-semibold text-on-surface">Reset your password</h1>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Enter your account email and we'll send a reset link.
            </p>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="card">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
            {serverError && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded bg-error-container px-3 py-2.5">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-on-error-container" />
                <p className="text-body-sm text-on-error-container">{serverError}</p>
              </motion.div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fp-email" className="font-mono text-label-md text-on-surface">
                Email address <span className="text-error">*</span>
              </label>
              <input id="fp-email" type="email" autoComplete="email" autoFocus
                placeholder="you@company.com" {...register('email')}
                className={cn('input', errors.email && 'input-error')}
                aria-invalid={!!errors.email} />
              {errors.email && (
                <p className="text-body-sm text-error" role="alert">{errors.email.message}</p>
              )}
            </div>
            <button type="submit" disabled={isSubmitting || mutation.isPending}
              className="btn-secondary w-full gap-2 justify-center">
              {mutation.isPending ? (
                <>
                  <motion.span animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    className="inline-block h-4 w-4 rounded-full border-2 border-on-secondary/30 border-t-on-secondary" />
                  Sending…
                </>
              ) : <><Send size={15} /> Send Reset Link</>}
            </button>
          </form>
        </motion.div>

        <motion.div variants={itemVariants} className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-body-sm
                                        text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft size={14} /> Back to Sign In
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}