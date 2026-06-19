import { useState }         from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useForm }          from 'react-hook-form';
import { zodResolver }      from '@hookform/resolvers/zod';
import { z }                from 'zod';
import { useMutation }      from '@tanstack/react-query';
import { motion }           from 'framer-motion';
import { Eye, EyeOff, Lock, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import api                  from '@/utils/api';
import { useAuth }          from '@/context/AuthContext';
import { cn }               from '@/utils/cn';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'At least 8 characters.')
      .max(128)
      .regex(/[A-Z]/, 'Needs an uppercase letter.')
      .regex(/[a-z]/, 'Needs a lowercase letter.')
      .regex(/[0-9]/, 'Needs a number.')
      .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'Needs a special character.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

function PasswordInput({ id, placeholder, registration, error, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...registration}
        className={cn('input pr-10', error && 'input-error')}
        aria-invalid={!!error}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant
                   hover:text-on-surface transition-colors"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { token }    = useParams();
  const navigate     = useNavigate();
  const { setAccessToken } = useAuth() || {};

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (values) => {
      const { data } = await api.patch(`/auth/reset-password/${token}`, values);
      return data;
    },
    onSuccess: () => {
      setTimeout(() => navigate('/login', { replace: true }), 2500);
    },
  });

  const onSubmit = (values) => mutation.mutate(values);

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0  }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <div className="mb-6">
          <Link to="/login" className="btn-ghost btn-sm gap-1.5 inline-flex">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>

        {mutation.isSuccess ? (
          <div className="card flex flex-col items-center gap-4 text-center py-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success-container">
              <CheckCircle2 size={26} className="text-on-success-container" />
            </div>
            <div>
              <h2 className="text-headline-sm font-semibold text-on-surface mb-1">
                Password reset successfully
              </h2>
              <p className="text-body-sm text-on-surface-variant">
                You're now signed in. Redirecting to your dashboard…
              </p>
            </div>
            <motion.div
              className="h-1 w-full rounded-full bg-surface-container-high overflow-hidden"
            >
              <motion.div
                className="h-full bg-secondary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.4, ease: 'linear' }}
              />
            </motion.div>
          </div>
        ) : (
          <>
            <div className="mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-container mb-4">
                <Lock size={22} className="text-on-primary-container" />
              </div>
              <h1 className="text-headline-md font-semibold text-on-surface">
                Set new password
              </h1>
              <p className="mt-2 text-body-sm text-on-surface-variant">
                Choose a strong password for your account.
              </p>
            </div>

            <div className="card">
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
                {mutation.isError && (
                  <div className="flex items-start gap-2 rounded bg-error-container px-3 py-2.5">
                    <AlertCircle size={15} className="shrink-0 mt-0.5 text-on-error-container" />
                    <p className="text-body-sm text-on-error-container">
                      {mutation.error?.message || 'Reset link is invalid or has expired.'}
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rp-pw" className="font-mono text-label-md text-on-surface">
                    New password <span className="text-error">*</span>
                  </label>
                  <PasswordInput
                    id="rp-pw"
                    placeholder="New password"
                    registration={register('password')}
                    error={errors.password}
                    autoComplete="new-password"
                  />
                  {errors.password && (
                    <p className="text-body-sm text-error" role="alert">{errors.password.message}</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="rp-confirm" className="font-mono text-label-md text-on-surface">
                    Confirm password <span className="text-error">*</span>
                  </label>
                  <PasswordInput
                    id="rp-confirm"
                    placeholder="Re-enter password"
                    registration={register('confirmPassword')}
                    error={errors.confirmPassword}
                    autoComplete="new-password"
                  />
                  {errors.confirmPassword && (
                    <p className="text-body-sm text-error" role="alert">{errors.confirmPassword.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || mutation.isPending}
                  className="btn-secondary w-full gap-2"
                >
                  {mutation.isPending ? (
                    <>
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                        className="inline-block h-4 w-4 rounded-full border-2 border-on-secondary/30 border-t-on-secondary"
                      />
                      Resetting…
                    </>
                  ) : (
                    <><Lock size={15} /> Reset Password</>
                  )}
                </button>
              </form>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}