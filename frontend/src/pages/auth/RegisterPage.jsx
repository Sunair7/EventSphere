import { useState }          from 'react';
import { Link }              from 'react-router-dom';
import { useForm }           from 'react-hook-form';
import { zodResolver }       from '@hookform/resolvers/zod';
import { z }                 from 'zod';
import { motion }            from 'framer-motion';
import {
  Eye, EyeOff, UserPlus, CalendarDays, AlertCircle,
  Building2, Ticket, ShieldCheck,
} from 'lucide-react';
import { useAuth }           from '@/context/AuthContext';
import { cn }                from '@/utils/cn';

// ─── Validation Schema ────────────────────────────────────────────────────────
const registerSchema = z
  .object({
    name: z
      .string()
      .min(2,  'Name must be at least 2 characters.')
      .max(100, 'Name must not exceed 100 characters.')
      .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters.'),
    email: z
      .string()
      .min(1, 'Email address is required.')
      .email('Please enter a valid email address.'),
    role: z.enum(['exhibitor', 'attendee'], {
      required_error: 'Please select your account type.',
    }),
    password: z
      .string()
      .min(8,   'Password must be at least 8 characters.')
      .max(128, 'Password must not exceed 128 characters.')
      .regex(/[A-Z]/,                         'Must contain an uppercase letter.')
      .regex(/[a-z]/,                         'Must contain a lowercase letter.')
      .regex(/[0-9]/,                         'Must contain a number.')
      .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'Must contain a special character.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path:    ['confirmPassword'],
  });

// ─── Role option config ───────────────────────────────────────────────────────
const ROLE_OPTIONS = [
  {
    value:       'exhibitor',
    label:       'Exhibitor',
    description: 'Showcase your products and services at events.',
    icon:        Building2,
  },
  {
    value:       'attendee',
    label:       'Attendee',
    description: 'Discover expos, sessions, and exhibitors.',
    icon:        Ticket,
  },
];

// ─── Password strength calculator ────────────────────────────────────────────
const getPasswordStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8)                                           score++;
  if (password.length >= 12)                                          score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password))              score++;
  if (/[0-9]/.test(password))                                         score++;
  if (/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password))         score++;

  if (score <= 2) return { score, label: 'Weak',   color: 'bg-error'   };
  if (score <= 3) return { score, label: 'Fair',   color: 'bg-warning'  };
  if (score <= 4) return { score, label: 'Good',   color: 'bg-tertiary' };
  return              { score, label: 'Strong', color: 'bg-success'  };
};

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
export default function RegisterPage() {
  const { register: authRegister } = useAuth();
  const [showPw,        setShowPw]        = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [serverError,   setServerError]   = useState(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver:      zodResolver(registerSchema),
    defaultValues: { name: '', email: '', role: undefined, password: '', confirmPassword: '' },
  });

  const watchedPassword = watch('password', '');
  const watchedRole     = watch('role');
  const strength        = getPasswordStrength(watchedPassword);

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await authRegister(values);
    } catch (err) {
      setServerError(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center px-4 py-16">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="w-full max-w-lg"
      >
        {/* ── Brand ─────────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary shadow-level-2">
            <CalendarDays size={22} className="text-on-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-headline-md font-semibold text-on-surface">
              Create your account
            </h1>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              Join EventSphere to manage or discover events
            </p>
          </div>
        </motion.div>

        {/* ── Card ──────────────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="card">
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

            {/* Role selector */}
            <div className="flex flex-col gap-1.5">
              <span className="font-mono text-label-md text-on-surface">
                Account type <span className="text-error">*</span>
              </span>
              <div className="grid grid-cols-2 gap-3">
                {ROLE_OPTIONS.map((option) => {
                  const Icon     = option.icon;
                  const selected = watchedRole === option.value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setValue('role', option.value, { shouldValidate: true })}
                      className={cn(
                        'flex flex-col items-start gap-2 rounded border-2 p-4 text-left',
                        'transition-all duration-200',
                        selected
                          ? 'border-secondary bg-secondary-container/30'
                          : 'border-outline-variant bg-surface hover:border-outline hover:bg-surface-container-low'
                      )}
                      aria-pressed={selected}
                    >
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded',
                        selected
                          ? 'bg-secondary text-on-secondary'
                          : 'bg-surface-container text-on-surface-variant'
                      )}>
                        <Icon size={16} />
                      </div>
                      <div>
                        <p className={cn(
                          'text-body-sm font-semibold',
                          selected ? 'text-secondary' : 'text-on-surface'
                        )}>
                          {option.label}
                        </p>
                        <p className="mt-0.5 text-body-sm text-on-surface-variant line-clamp-2">
                          {option.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {errors.role && (
                <p className="text-body-sm text-error" role="alert">
                  {errors.role.message}
                </p>
              )}
              <input type="hidden" {...register('role')} />
            </div>

            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="name" className="font-mono text-label-md text-on-surface">
                Full name <span className="text-error">*</span>
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                autoFocus
                placeholder="Jane Smith"
                {...register('name')}
                className={cn('input', errors.name && 'input-error')}
                aria-invalid={!!errors.name}
              />
              {errors.name && (
                <p className="text-body-sm text-error" role="alert">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-email" className="font-mono text-label-md text-on-surface">
                Email address <span className="text-error">*</span>
              </label>
              <input
                id="reg-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...register('email')}
                className={cn('input', errors.email && 'input-error')}
                aria-invalid={!!errors.email}
              />
              {errors.email && (
                <p className="text-body-sm text-error" role="alert">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-password" className="font-mono text-label-md text-on-surface">
                Password <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  {...register('password')}
                  className={cn('input pr-10', errors.password && 'input-error')}
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant
                             hover:text-on-surface transition-colors"
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Strength meter */}
              {watchedPassword && (
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          'h-1 flex-1 rounded-full transition-all duration-300',
                          i <= strength.score ? strength.color : 'bg-surface-container-high'
                        )}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-label-sm text-on-surface-variant">
                    {strength.label}
                  </span>
                </div>
              )}

              {errors.password && (
                <p className="text-body-sm text-error" role="alert">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-password" className="font-mono text-label-md text-on-surface">
                Confirm password <span className="text-error">*</span>
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPw ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  {...register('confirmPassword')}
                  className={cn('input pr-10', errors.confirmPassword && 'input-error')}
                  aria-invalid={!!errors.confirmPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant
                             hover:text-on-surface transition-colors"
                  aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-body-sm text-error" role="alert">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Terms notice */}
            <p className="text-body-sm text-on-surface-variant">
              By creating an account you agree to our{' '}
              <span className="font-medium text-on-surface">Terms of Service</span>
              {' '}and{' '}
              <span className="font-medium text-on-surface">Privacy Policy</span>.
            </p>

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
                  Creating account…
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Create account
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* ── Sign in link ───────────────────────────────────────────── */}
        <motion.p
          variants={itemVariants}
          className="mt-6 text-center text-body-sm text-on-surface-variant"
        >
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-tertiary hover:text-secondary transition-colors">
            Sign in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}