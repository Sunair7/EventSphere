import { useState }              from 'react';
import { Link, useLocation }     from 'react-router-dom';
import { useForm }               from 'react-hook-form';
import { zodResolver }           from '@hookform/resolvers/zod';
import { z }                     from 'zod';
import { motion }                from 'framer-motion';
import { Eye, EyeOff, LogIn, CalendarDays, AlertCircle } from 'lucide-react';
import { useAuth }               from '@/context/AuthContext';
import { cn }                    from '@/utils/cn';

// ─── Validation Schema ────────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required.')
    .email('Please enter a valid email address.'),
  password: z
    .string()
    .min(1, 'Password is required.')
    .max(128, 'Password is too long.'),
});

// ─── Animation variants ───────────────────────────────────────────────────────
const containerVariants = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] } },
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login }      = useAuth();
  const location       = useLocation();
  const [showPw, setShowPw]   = useState(false);
  const [serverError, setServerError] = useState(null);

  const from = location.state?.from || null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver:      zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await login(values);
      // Navigation handled inside AuthContext.login()
    } catch (err) {
      setServerError(err.message || 'Invalid email or password. Please try again.');
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-md"
      >
        {/* ── Brand mark ────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary shadow-level-2">
            <CalendarDays size={22} className="text-on-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-headline-md font-semibold text-on-surface">
              Welcome back
            </h1>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Sign in to your EventSphere account
            </p>
          </div>
        </motion.div>

        {/* ── Card ──────────────────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="card"
        >
          {/* Redirect notice */}
          {from && (
            <div className="mb-5 flex items-start gap-2 rounded bg-warning-container px-3 py-2.5">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-on-warning-container" />
              <p className="text-body-sm text-on-warning-container">
                Please sign in to continue.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">

            {/* Server error */}
            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-2 rounded bg-error-container px-3 py-2.5"
              >
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-on-error-container" />
                <p className="text-body-sm text-on-error-container">{serverError}</p>
              </motion.div>
            )}

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="email"
                className="font-mono text-label-md text-on-surface"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                {...register('email')}
                className={cn('input', errors.email && 'input-error')}
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p id="email-error" className="text-body-sm text-error" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="font-mono text-label-md text-on-surface"
                >
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-body-sm text-tertiary hover:text-secondary transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className={cn('input pr-10', errors.password && 'input-error')}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2
                             text-on-surface-variant hover:text-on-surface transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {errors.password && (
                <p id="password-error" className="text-body-sm text-error" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-secondary w-full"
            >
              {isSubmitting ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    className="inline-block h-4 w-4 rounded-full border-2
                               border-on-secondary/30 border-t-on-secondary"
                  />
                  Signing in…
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Sign in
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* ── Sign up link ───────────────────────────────────────────── */}
        <motion.p
          variants={itemVariants}
          className="mt-6 text-center text-body-sm text-on-surface-variant"
        >
          Don't have an account?{' '}
          <Link to="/register" className="font-medium text-tertiary hover:text-secondary transition-colors">
            Create one
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}