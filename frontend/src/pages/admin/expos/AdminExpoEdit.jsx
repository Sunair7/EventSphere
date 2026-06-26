import { useState, useEffect, useRef }             from 'react';
import { useParams, useNavigate, Link }    from 'react-router-dom';
import { useForm, Controller }             from 'react-hook-form';
import { zodResolver }                     from '@hookform/resolvers/zod';
import { z }                               from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion }                          from 'framer-motion';
import {
  ArrowLeft, Save, CalendarDays,
  MapPin, Info, Tag, X, Plus,
  AlertCircle, Image, Upload, Loader2, Trash2,
} from 'lucide-react';
import toast                               from 'react-hot-toast';
import api                                 from '@/utils/api';
import { cn }                             from '@/utils/cn';

// ─── Validation schema (all fields optional on edit) ─────────────────────────
const editExpoSchema = z
  .object({
    title: z
      .string()
      .min(3, 'Title must be at least 3 characters.')
      .max(150, 'Title must not exceed 150 characters.'),

    description: z
      .string()
      .min(20, 'Description must be at least 20 characters.')
      .max(5000, 'Description must not exceed 5000 characters.'),

    theme: z.string().max(100).optional().or(z.literal('')),

    startDate:            z.string().min(1, 'Start date is required.'),
    endDate:              z.string().min(1, 'End date is required.'),
    registrationDeadline: z.string().optional().or(z.literal('')),

    'address.venue':   z.string().max(150).optional().or(z.literal('')),
    'address.city':    z.string().min(1, 'City is required.').max(100),
    'address.country': z.string().min(1, 'Country is required.').max(100),
    'address.street':  z.string().max(200).optional().or(z.literal('')),
    'address.zipCode': z.string().max(20).optional().or(z.literal('')),

    maxAttendees: z
      .number({ invalid_type_error: 'Must be a number.' })
      .int()
      .min(1)
      .optional()
      .nullable(),

    isPublic: z.boolean().optional(),

    'banner.url':     z.string().url('Must be a valid URL.').optional().or(z.literal('')),
    'banner.altText': z.string().max(200).optional().or(z.literal('')),
  })
  .refine(
    (d) => !d.endDate || !d.startDate || new Date(d.endDate) > new Date(d.startDate),
    { message: 'End date must be after start date.', path: ['endDate'] }
  )
  .refine(
    (d) =>
      !d.registrationDeadline ||
      !d.startDate ||
      new Date(d.registrationDeadline) <= new Date(d.startDate),
    {
      message: 'Registration deadline must be on or before the start date.',
      path:    ['registrationDeadline'],
    }
  );

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toLocalDatetime = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const Field = ({ label, htmlFor, error, hint, required, children }) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label htmlFor={htmlFor} className="font-mono text-label-md text-on-surface">
        {label} {required && <span className="text-error">*</span>}
      </label>
    )}
    {children}
    {hint && !error && <p className="font-mono text-label-sm text-on-surface-variant">{hint}</p>}
    {error &&          <p className="text-body-sm text-error" role="alert">{error}</p>}
  </div>
);

const Section = ({ icon: Icon, title, description, children }) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.22 }}
    className="card flex flex-col gap-5"
  >
    <div className="flex items-start gap-3 border-b border-outline-variant pb-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary-container">
        <Icon size={17} className="text-on-primary-container" />
      </div>
      <div>
        <h2 className="text-headline-sm font-semibold text-on-surface">{title}</h2>
        {description && <p className="mt-0.5 text-body-sm text-on-surface-variant">{description}</p>}
      </div>
    </div>
    {children}
  </motion.div>
);

// ─── Tag input (same as create) ───────────────────────────────────────────────
function TagInput({ value = [], onChange }) {
  const [input, setInput] = useState('');

  const add = () => {
    const tag = input.trim().toLowerCase();
    if (!tag || value.includes(tag) || value.length >= 20) return;
    onChange([...value, tag]);
    setInput('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {value.map((tag) => (
          <span key={tag} className="badge badge-info gap-1">
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="hover:text-error transition-colors"
              aria-label={`Remove ${tag}`}
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      {value.length < 20 && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
            }}
            placeholder="Type and press Enter…"
            className="input flex-1"
            maxLength={50}
          />
          <button type="button" onClick={add} disabled={!input.trim()}
            className="btn-ghost btn-sm gap-1 shrink-0">
            <Plus size={14} /> Add
          </button>
        </div>
      )}
      <p className="font-mono text-label-sm text-on-surface-variant">{value.length}/20 tags</p>
    </div>
  );
}

// ─── Banner Upload Component ──────────────────────────────────────────────────
function BannerUpload({ expoId, currentBanner, onBannerChange }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB.');
      return;
    }

    // Show local preview immediately
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    
    // Upload to Cloudinary
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('banner', file);
      
      const { data } = await api.post(`/expos/${expoId}/banner`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      toast.success('Banner uploaded successfully!');
      onBannerChange?.(data.data.banner);
    } catch (err) {
      toast.error(err.message || 'Failed to upload banner.');
      setPreview(null);
      URL.revokeObjectURL(localPreview);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    try {
      await api.delete(`/expos/${expoId}/banner`);
      toast.success('Banner removed.');
      setPreview(null);
      onBannerChange?.(null);
    } catch (err) {
      toast.error(err.message || 'Failed to remove banner.');
    }
  };

  const displayUrl = preview || currentBanner?.url;

  return (
    <div className="flex flex-col gap-3">
      {/* Banner preview or upload area */}
      {displayUrl ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative group rounded-lg overflow-hidden border border-outline-variant aspect-video bg-surface-container-low"
        >
          <img
            src={displayUrl}
            alt={currentBanner?.altText || 'Expo banner'}
            className="w-full h-full object-cover"
          />
          
          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-ghost btn-sm gap-1.5 bg-white/20 text-white hover:bg-white/30"
            >
              <Upload size={14} /> Change
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="btn-ghost btn-sm gap-1.5 bg-white/20 text-white hover:bg-error/60"
            >
              <Trash2 size={14} /> Remove
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed aspect-video',
            'cursor-pointer transition-all duration-200',
            uploading
              ? 'border-secondary/50 bg-secondary/5'
              : 'border-outline-variant hover:border-secondary/50 hover:bg-surface-container-low'
          )}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={24} className="animate-spin-slow text-secondary" />
              <span className="font-mono text-label-sm text-on-surface-variant">Uploading…</span>
            </div>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <Image size={18} />
              </div>
              <div className="text-center">
                <p className="text-body-sm font-medium text-on-surface">Upload banner image</p>
                <p className="font-mono text-label-sm text-on-surface-variant mt-0.5">
                  Click to browse · 1200×630 recommended · Max 10MB
                </p>
              </div>
            </>
          )}
        </motion.div>
      )}

      {/* Alt text field */}
      <Field label="Alt Text" htmlFor="bannerAlt" hint="Describe the banner image for accessibility and SEO.">
        <input
          id="bannerAlt"
          type="text"
          placeholder="e.g. TechConnect 2026 venue exterior"
          defaultValue={currentBanner?.altText || ''}
          onChange={(e) => {
            // Update alt text in parent via the banner change handler
            if (currentBanner?.url || preview) {
              onBannerChange?.({
                url: currentBanner?.url || preview,
                altText: e.target.value,
              });
            }
          }}
          className="input"
        />
      </Field>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AdminExpoEdit() {
  const { id }          = useParams();
  const navigate        = useNavigate();
  const queryClient     = useQueryClient();
  const [tags, setTags] = useState([]);
  const [bannerData, setBannerData] = useState(null); // Track uploaded banner

  // ── Fetch existing expo ─────────────────────────────────────────────────────
  const { data: expo, isLoading, isError } = useQuery({
    queryKey: ['expos', id],
    queryFn:  async () => {
      const { data } = await api.get(`/expos/${id}`);
      return data.data.expo;
    },
  });

  // ── Form setup ──────────────────────────────────────────────────────────────
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({ resolver: zodResolver(editExpoSchema) });

  // Populate form when expo data arrives
  useEffect(() => {
    if (!expo) return;
    setTags(expo.tags || []);
    setBannerData(expo.banner || null);
    reset({
      title:               expo.title               || '',
      description:         expo.description         || '',
      theme:               expo.theme               || '',
      startDate:           toLocalDatetime(expo.startDate),
      endDate:             toLocalDatetime(expo.endDate),
      registrationDeadline: expo.registrationDeadline
        ? toLocalDatetime(expo.registrationDeadline) : '',
      'address.venue':    expo.address?.venue   || '',
      'address.city':     expo.address?.city    || '',
      'address.country':  expo.address?.country || '',
      'address.street':   expo.address?.street  || '',
      'address.zipCode':  expo.address?.zipCode || '',
      maxAttendees:       expo.maxAttendees      || null,
      isPublic:           expo.isPublic          !== false,
      'banner.url':       expo.banner?.url       || '',
      'banner.altText':   expo.banner?.altText   || '',
    });
  }, [expo, reset]);

  // ── Handle banner change ────────────────────────────────────────────────────
  const handleBannerChange = (newBanner) => {
    if (newBanner) {
      setBannerData(newBanner);
      setValue('banner.url', newBanner.url || '', { shouldDirty: true });
      setValue('banner.altText', newBanner.altText || '', { shouldDirty: true });
    } else {
      setBannerData(null);
      setValue('banner.url', '', { shouldDirty: true });
      setValue('banner.altText', '', { shouldDirty: true });
    }
  };

  // ── Update mutation ─────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        title:       values.title,
        description: values.description,
        theme:       values.theme       || undefined,
        startDate:   new Date(values.startDate).toISOString(),
        endDate:     new Date(values.endDate).toISOString(),
        registrationDeadline: values.registrationDeadline
          ? new Date(values.registrationDeadline).toISOString()
          : null,
        address: {
          venue:   values['address.venue']   || undefined,
          city:    values['address.city'],
          country: values['address.country'],
          street:  values['address.street']  || undefined,
          zipCode: values['address.zipCode'] || undefined,
        },
        tags,
        maxAttendees: values.maxAttendees || null,
        isPublic:     values.isPublic,
        banner:       bannerData || null, // Use the tracked banner data
      };
      const { data } = await api.put(`/expos/${id}`, payload);
      return data.data.expo;
    },
    onSuccess: (updatedExpo) => {
      toast.success(`"${updatedExpo.title}" updated successfully.`);
      queryClient.invalidateQueries({ queryKey: ['expos', id] });
      queryClient.invalidateQueries({ queryKey: ['expos'] });
      navigate(`/admin/expos/${id}`);
    },
    onError: (err) => toast.error(err.message || 'Failed to update expo.'),
  });

  // ── States ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-52 rounded-md" />
        ))}
      </div>
    );
  }

  if (isError || !expo) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="empty-state py-20"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="empty-state-icon text-error"
        >
          <AlertCircle size={28} />
        </motion.div>
        <h3 className="empty-state-title">Expo not found</h3>
        <Link to="/admin/expos" className="btn-ghost btn-sm mt-3 gap-1.5">
          <ArrowLeft size={14} /> Back to expos
        </Link>
      </motion.div>
    );
  }

  if (['completed', 'cancelled'].includes(expo.status)) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="empty-state py-20"
      >
        <div className="empty-state-icon text-warning"><AlertCircle size={28} /></div>
        <h3 className="empty-state-title">Cannot edit this expo</h3>
        <p className="empty-state-body">
          Expos with status <span className="font-semibold capitalize">{expo.status}</span> cannot be edited.
        </p>
        <Link to={`/admin/expos/${id}`} className="btn-ghost btn-sm mt-3 gap-1.5">
          <ArrowLeft size={14} /> View Expo
        </Link>
      </motion.div>
    );
  }

  const isPending = isSubmitting || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-3xl">
      {/* ── Back + header ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 flex items-center gap-3"
      >
        <Link to={`/admin/expos/${id}`} className="btn-ghost btn-sm gap-1.5">
          <ArrowLeft size={15} /> Detail
        </Link>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mb-8"
      >
        <h1 className="page-title flex items-center gap-2">
          Edit Expo
        </h1>
        <p className="page-subtitle">
          Editing: <span className="font-semibold text-on-surface">{expo.title}</span>
        </p>
      </motion.div>

      {/* Floor plan lock notice */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 flex items-start gap-2 rounded-md bg-primary-container px-4 py-3"
      >
        <Info size={15} className="shrink-0 mt-0.5 text-on-primary-container" />
        <p className="text-body-sm text-on-primary-container">
          Floor plan configuration cannot be changed after booths have been generated.
          Use the{' '}
          <Link to={`/admin/expos/${id}/floor-plan`} className="font-semibold underline">
            Floor Plan
          </Link>{' '}
          page to manage individual booths.
        </p>
      </motion.div>

      <form
        onSubmit={handleSubmit((v) => updateMutation.mutate(v))}
        noValidate
        className="flex flex-col gap-6"
      >
        {/* ── Event details ──────────────────────────────────────── */}
        <Section icon={CalendarDays} title="Event Details">
          <Field label="Title" required htmlFor="title" error={errors.title?.message}>
            <input id="title" type="text" {...register('title')}
              className={cn('input', errors.title && 'input-error')} autoFocus />
          </Field>

          <Field label="Description" required htmlFor="description" error={errors.description?.message}>
            <textarea id="description" rows={5} {...register('description')}
              className={cn('input resize-none', errors.description && 'input-error')} />
          </Field>

          <Field label="Theme / Category" htmlFor="theme" error={errors.theme?.message}>
            <input id="theme" type="text" {...register('theme')} className="input" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Start Date" required htmlFor="startDate" error={errors.startDate?.message}>
              <input id="startDate" type="datetime-local" {...register('startDate')}
                className={cn('input', errors.startDate && 'input-error')} />
            </Field>
            <Field label="End Date" required htmlFor="endDate" error={errors.endDate?.message}>
              <input id="endDate" type="datetime-local" {...register('endDate')}
                className={cn('input', errors.endDate && 'input-error')} />
            </Field>
            <Field label="Registration Deadline" htmlFor="regDeadline"
              error={errors.registrationDeadline?.message}>
              <input id="regDeadline" type="datetime-local" {...register('registrationDeadline')}
                className={cn('input', errors.registrationDeadline && 'input-error')} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Max Attendees" htmlFor="maxAttendees"
              error={errors.maxAttendees?.message} hint="Leave blank for unlimited.">
              <input id="maxAttendees" type="number" min={1}
                {...register('maxAttendees', { valueAsNumber: true })}
                className={cn('input', errors.maxAttendees && 'input-error')} />
            </Field>

            <Field label="Visibility" htmlFor="isPublic">
              <div className="flex h-10 items-center gap-3 rounded border border-outline-variant
                              bg-surface-bright px-3">
                <Controller
                  name="isPublic"
                  control={control}
                  render={({ field }) => (
                    <input id="isPublic" type="checkbox"
                      checked={field.value ?? true}
                      onChange={field.onChange}
                      className="h-4 w-4 accent-secondary rounded" />
                  )}
                />
                <label htmlFor="isPublic" className="text-body-sm text-on-surface cursor-pointer">
                  Publicly visible to attendees
                </label>
              </div>
            </Field>
          </div>

          <Field label="Tags" hint="Press Enter or comma to add. Up to 20 tags.">
            <TagInput value={tags} onChange={setTags} />
          </Field>
        </Section>

        {/* ── Venue & location ───────────────────────────────────── */}
        <Section icon={MapPin} title="Venue & Location">
          <Field label="Venue Name" htmlFor="venue" error={errors['address.venue']?.message}>
            <input id="venue" type="text" {...register('address.venue')} className="input" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="City" required htmlFor="city" error={errors['address.city']?.message}>
              <input id="city" type="text" {...register('address.city')}
                className={cn('input', errors['address.city'] && 'input-error')} />
            </Field>
            <Field label="Country" required htmlFor="country" error={errors['address.country']?.message}>
              <input id="country" type="text" {...register('address.country')}
                className={cn('input', errors['address.country'] && 'input-error')} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Street Address" htmlFor="street" error={errors['address.street']?.message}>
              <input id="street" type="text" {...register('address.street')} className="input" />
            </Field>
            <Field label="ZIP / Postal Code" htmlFor="zipCode" error={errors['address.zipCode']?.message}>
              <input id="zipCode" type="text" {...register('address.zipCode')} className="input" />
            </Field>
          </div>
        </Section>

        {/* ── Banner ────────────────────────────────────────────────── */}
        <Section icon={Image} title="Banner Image" description="Upload a hero image displayed on the expo listing page.">
          <BannerUpload
            expoId={id}
            currentBanner={bannerData}
            onBannerChange={handleBannerChange}
          />
        </Section>

        {/* ── Submit bar ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-between rounded-md border border-outline-variant
                      bg-surface-bright px-6 py-4 shadow-level-2 sticky bottom-4"
        >
          <p className="hidden text-body-sm text-on-surface-variant sm:block">
            {isDirty ? 'You have unsaved changes.' : 'No changes to save.'}
          </p>
          <div className="flex gap-3 ml-auto">
            <Link to={`/admin/expos/${id}`} className="btn-ghost">
              Discard
            </Link>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={(!isDirty && !bannerData !== !expo?.banner) || isPending}
              className="btn-secondary gap-2"
            >
              {isPending ? (
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
            </motion.button>
          </div>
        </motion.div>
      </form>
    </div>
  );
}