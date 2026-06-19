import { useState }                    from 'react';
import { useForm }                     from 'react-hook-form';
import { zodResolver }                 from '@hookform/resolvers/zod';
import { z }                           from 'zod';
import { useMutation }                 from '@tanstack/react-query';
import { motion, AnimatePresence }     from 'framer-motion';
import {
  User, Lock, Mail, ShieldCheck, Trash2,
  Eye, EyeOff, CheckCircle2, AlertCircle,
  Save, RefreshCw, LogOut,
} from 'lucide-react';
import toast                           from 'react-hot-toast';
import api                             from '@/utils/api';
import { useAuth }                     from '@/context/AuthContext';
import { cn }                          from '@/utils/cn';

// ─── Validation schemas ───────────────────────────────────────────────────────
const profileSchema = z.object({
  name: z
    .string()
    .min(2,   'Name must be at least 2 characters.')
    .max(100, 'Name must not exceed 100 characters.')
    .regex(/^[a-zA-Z\s'-]+$/, 'Name contains invalid characters.'),
  avatar: z
    .string()
    .url('Avatar must be a valid URL.')
    .max(500, 'URL is too long.')
    .optional()
    .or(z.literal('')),
});

const passwordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, 'Current password is required.')
      .max(128, 'Password is too long.'),
    newPassword: z
      .string()
      .min(8,   'Password must be at least 8 characters.')
      .max(128, 'Password must not exceed 128 characters.')
      .regex(/[A-Z]/,                               'Must contain an uppercase letter.')
      .regex(/[a-z]/,                               'Must contain a lowercase letter.')
      .regex(/[0-9]/,                               'Must contain a number.')
      .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, 'Must contain a special character.'),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password.'),
  })
  .refine((d) => d.newPassword === d.confirmNewPassword, {
    message: 'Passwords do not match.',
    path:    ['confirmNewPassword'],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: 'New password must differ from current password.',
    path:    ['newPassword'],
  });

// ─── Section wrapper ──────────────────────────────────────────────────────────
function SettingsSection({ icon: Icon, title, description, children, danger }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'card flex flex-col gap-5',
        danger && 'border-error/30 bg-error-container/10'
      )}
    >
      <div className={cn(
        'flex items-start gap-3 border-b pb-4',
        danger ? 'border-error/20' : 'border-outline-variant'
      )}>
        <div className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded',
          danger ? 'bg-error-container' : 'bg-primary-container'
        )}>
          <Icon size={17} className={danger ? 'text-on-error-container' : 'text-on-primary-container'} />
        </div>
        <div>
          <h2 className="text-headline-sm font-semibold text-on-surface">{title}</h2>
          {description && (
            <p className="mt-0.5 text-body-sm text-on-surface-variant">{description}</p>
          )}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, htmlFor, error, hint, required, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={htmlFor} className="font-mono text-label-md text-on-surface">
          {label} {required && <span className="text-error">*</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="font-mono text-label-sm text-on-surface-variant">{hint}</p>
      )}
      {error && (
        <p className="text-body-sm text-error" role="alert">{error}</p>
      )}
    </div>
  );
}

// ─── Password field ───────────────────────────────────────────────────────────
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

// ─── Deactivate confirmation modal ────────────────────────────────────────────
function DeactivateModal({ onConfirm, onCancel, isLoading }) {
  const [typed, setTyped]   = useState('');
  const CONFIRM_PHRASE      = 'DELETE MY ACCOUNT';
  const canConfirm          = typed === CONFIRM_PHRASE;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1    }}
        exit={{ opacity: 0, scale: 0.96    }}
        transition={{ duration: 0.18 }}
        className="modal-panel max-w-md p-6"
      >
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-error-container">
          <Trash2 size={18} className="text-on-error-container" />
        </div>
        <h2 className="mb-1 text-headline-sm font-semibold text-on-surface">
          Deactivate account?
        </h2>
        <p className="mb-4 text-body-sm text-on-surface-variant">
          Your account will be deactivated immediately. All active booth reservations and
          session registrations will remain in the system for audit purposes.
        </p>

        <div className="mb-4 flex flex-col gap-1.5">
          <label className="font-mono text-label-md text-on-surface">
            Type <span className="font-bold text-error">{CONFIRM_PHRASE}</span> to confirm
          </label>
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className={cn('input font-mono', canConfirm ? 'border-error' : '')}
            placeholder={CONFIRM_PHRASE}
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} disabled={isLoading} className="btn-ghost">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm || isLoading}
            className="btn-danger gap-1.5"
          >
            {isLoading ? (
              <>
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                  className="inline-block h-4 w-4 rounded-full border-2 border-on-error/30 border-t-on-error"
                />
                Deactivating…
              </>
            ) : (
              <><Trash2 size={14} /> Deactivate Account</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AccountSettings() {
  const { user, updateUser, refreshUser, logout } = useAuth();
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  // ── Profile form ────────────────────────────────────────────────────────────
  const {
    register:     registerProfile,
    handleSubmit: handleProfileSubmit,
    formState:    { errors: profileErrors, isSubmitting: profileSubmitting, isDirty: profileDirty },
    reset:        resetProfile,
  } = useForm({
    resolver:      zodResolver(profileSchema),
    defaultValues: { name: user?.name || '', avatar: user?.avatar || '' },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (values) => {
      const { data } = await api.patch('/users/me', {
        name:   values.name,
        avatar: values.avatar || undefined,
      });
      return data.data.user;
    },
    onSuccess: (updatedUser) => {
      updateUser(updatedUser);
      resetProfile({ name: updatedUser.name, avatar: updatedUser.avatar || '' });
      toast.success('Profile updated successfully.');
    },
    onError: (err) => toast.error(err.message || 'Failed to update profile.'),
  });

  // ── Password form ────────────────────────────────────────────────────────────
  const {
    register:     registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState:    { errors: passwordErrors, isSubmitting: passwordSubmitting },
    reset:        resetPassword,
  } = useForm({ resolver: zodResolver(passwordSchema) });

  const changePasswordMutation = useMutation({
    mutationFn: async (values) => {
      const { data } = await api.patch('/auth/change-password', {
        currentPassword:    values.currentPassword,
        newPassword:        values.newPassword,
        confirmNewPassword: values.confirmNewPassword,
      });
      return data;
    },
    onSuccess: () => {
      resetPassword();
      toast.success('Password changed. All other sessions have been signed out.');
    },
    onError: (err) => toast.error(err.message || 'Failed to change password.'),
  });

  // ── Resend verification ──────────────────────────────────────────────────────
  const resendMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/auth/resend-verification');
      return data;
    },
    onSuccess: () => toast.success('Verification email sent. Check your inbox.'),
    onError:   (err) => toast.error(err.message || 'Failed to send verification email.'),
  });

  // ── Deactivate ───────────────────────────────────────────────────────────────
  const deactivateMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/users/me');
    },
    onSuccess: () => {
      toast.success('Your account has been deactivated.');
      logout({ silent: true });
    },
    onError: (err) => toast.error(err.message || 'Failed to deactivate account.'),
  });

  const roleLabel = { admin: 'Admin', exhibitor: 'Exhibitor', attendee: 'Attendee' }[user?.role] || 'User';

  return (
    <>
      <div className="mx-auto max-w-2xl flex flex-col gap-6">

        {/* ── Page header ───────────────────────────────────────── */}
        <div>
          <h1 className="page-title">Account Settings</h1>
          <p className="page-subtitle">Manage your profile and security preferences.</p>
        </div>

        {/* ── Account overview ──────────────────────────────────── */}
        <div className="card flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full
                          bg-primary text-on-primary text-headline-sm font-bold">
            {user?.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-14 w-14 rounded-full object-cover" />
            ) : (
              user?.name?.charAt(0).toUpperCase()
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-md font-semibold text-on-surface truncate">{user?.name}</p>
            <p className="font-mono text-label-sm text-on-surface-variant truncate">{user?.email}</p>
            <div className="mt-1 flex items-center gap-2">
              <span className="badge badge-info capitalize">{roleLabel}</span>
              {user?.isEmailVerified ? (
                <span className="flex items-center gap-1 font-mono text-label-sm text-secondary">
                  <ShieldCheck size={12} /> Verified
                </span>
              ) : (
                <span className="flex items-center gap-1 font-mono text-label-sm text-warning">
                  <AlertCircle size={12} /> Email unverified
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Profile section ───────────────────────────────────── */}
        <SettingsSection
          icon={User}
          title="Profile Information"
          description="Update your display name and avatar URL."
        >
          <form
            onSubmit={handleProfileSubmit((v) => updateProfileMutation.mutate(v))}
            noValidate
            className="flex flex-col gap-4"
          >
            <Field
              label="Full name"
              htmlFor="name"
              required
              error={profileErrors.name?.message}
            >
              <input
                id="name"
                type="text"
                autoComplete="name"
                {...registerProfile('name')}
                className={cn('input', profileErrors.name && 'input-error')}
              />
            </Field>

            <Field
              label="Email address"
              htmlFor="email-display"
              hint="Email cannot be changed. Contact support if needed."
            >
              <input
                id="email-display"
                type="email"
                value={user?.email || ''}
                readOnly
                disabled
                className="input cursor-not-allowed"
              />
            </Field>

            <Field
              label="Avatar URL"
              htmlFor="avatar"
              error={profileErrors.avatar?.message}
              hint="Paste a direct link to a publicly accessible image."
            >
              <input
                id="avatar"
                type="url"
                placeholder="https://example.com/photo.jpg"
                {...registerProfile('avatar')}
                className={cn('input', profileErrors.avatar && 'input-error')}
              />
            </Field>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  !profileDirty ||
                  profileSubmitting ||
                  updateProfileMutation.isPending
                }
                className="btn-secondary gap-2"
              >
                {updateProfileMutation.isPending ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                      className="inline-block h-4 w-4 rounded-full border-2
                                 border-on-secondary/30 border-t-on-secondary"
                    />
                    Saving…
                  </>
                ) : (
                  <><Save size={15} /> Save Changes</>
                )}
              </button>
            </div>
          </form>
        </SettingsSection>

        {/* ── Email verification section ────────────────────────── */}
        {!user?.isEmailVerified && (
          <SettingsSection
            icon={Mail}
            title="Email Verification"
            description="Verify your email address to unlock all platform features."
          >
            <div className="flex items-start gap-3 rounded bg-warning-container px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-on-warning-container" />
              <div className="flex-1">
                <p className="text-body-sm font-medium text-on-warning-container">
                  Your email address is not verified.
                </p>
                <p className="mt-0.5 text-body-sm text-on-warning-container/80">
                  A verification link will be sent to{' '}
                  <span className="font-semibold">{user?.email}</span>.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => resendMutation.mutate()}
                disabled={resendMutation.isPending || resendMutation.isSuccess}
                className="btn-ghost gap-2"
              >
                {resendMutation.isPending ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                      className="inline-block h-4 w-4 rounded-full border-2
                                 border-outline/30 border-t-outline"
                    />
                    Sending…
                  </>
                ) : resendMutation.isSuccess ? (
                  <><CheckCircle2 size={15} className="text-success" /> Email sent</>
                ) : (
                  <><RefreshCw size={15} /> Resend Verification Email</>
                )}
              </button>
            </div>
          </SettingsSection>
        )}

        {/* ── Password section ──────────────────────────────────── */}
        <SettingsSection
          icon={Lock}
          title="Change Password"
          description="Use a strong password. Changing it signs out all other active sessions."
        >
          <form
            onSubmit={handlePasswordSubmit((v) => changePasswordMutation.mutate(v))}
            noValidate
            className="flex flex-col gap-4"
          >
            <Field
              label="Current password"
              htmlFor="current-pw"
              required
              error={passwordErrors.currentPassword?.message}
            >
              <PasswordInput
                id="current-pw"
                placeholder="Your current password"
                registration={registerPassword('currentPassword')}
                error={passwordErrors.currentPassword}
                autoComplete="current-password"
              />
            </Field>

            <Field
              label="New password"
              htmlFor="new-pw"
              required
              error={passwordErrors.newPassword?.message}
              hint="Min 8 characters with uppercase, lowercase, number and special character."
            >
              <PasswordInput
                id="new-pw"
                placeholder="New password"
                registration={registerPassword('newPassword')}
                error={passwordErrors.newPassword}
                autoComplete="new-password"
              />
            </Field>

            <Field
              label="Confirm new password"
              htmlFor="confirm-pw"
              required
              error={passwordErrors.confirmNewPassword?.message}
            >
              <PasswordInput
                id="confirm-pw"
                placeholder="Re-enter new password"
                registration={registerPassword('confirmNewPassword')}
                error={passwordErrors.confirmNewPassword}
                autoComplete="new-password"
              />
            </Field>

            {changePasswordMutation.isError && (
              <div className="flex items-start gap-2 rounded bg-error-container px-3 py-2.5">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-on-error-container" />
                <p className="text-body-sm text-on-error-container">
                  {changePasswordMutation.error?.message || 'Failed to change password.'}
                </p>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordSubmitting || changePasswordMutation.isPending}
                className="btn-secondary gap-2"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                      className="inline-block h-4 w-4 rounded-full border-2
                                 border-on-secondary/30 border-t-on-secondary"
                    />
                    Updating…
                  </>
                ) : (
                  <><Lock size={15} /> Update Password</>
                )}
              </button>
            </div>
          </form>
        </SettingsSection>

        {/* ── Sign out all devices ──────────────────────────────── */}
        <SettingsSection
          icon={LogOut}
          title="Sign Out"
          description="End your current session and return to the login page."
        >
          <div className="flex items-center justify-between">
            <p className="text-body-sm text-on-surface-variant">
              Signed in as <span className="font-medium text-on-surface">{user?.email}</span>
            </p>
            <button onClick={() => logout()} className="btn-ghost gap-2">
              <LogOut size={15} /> Sign out
            </button>
          </div>
        </SettingsSection>

        {/* ── Danger zone ───────────────────────────────────────── */}
        <SettingsSection
          icon={Trash2}
          title="Danger Zone"
          description="Permanently deactivate your account. This action cannot be undone."
          danger
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-body-sm font-medium text-on-surface">Deactivate Account</p>
              <p className="mt-0.5 text-body-sm text-on-surface-variant">
                Your data is preserved for audit and compliance purposes. Active booth
                reservations remain in the system.
              </p>
            </div>
            <button
              onClick={() => setShowDeactivateModal(true)}
              className="btn-danger btn-sm shrink-0 gap-1.5"
            >
              <Trash2 size={14} /> Deactivate
            </button>
          </div>
        </SettingsSection>
      </div>

      {/* ── Deactivate modal ──────────────────────────────────────── */}
      <AnimatePresence>
        {showDeactivateModal && (
          <DeactivateModal
            onConfirm={() => deactivateMutation.mutate()}
            onCancel={() => setShowDeactivateModal(false)}
            isLoading={deactivateMutation.isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}