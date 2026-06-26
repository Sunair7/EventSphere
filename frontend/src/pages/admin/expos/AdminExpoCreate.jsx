import { useState, useMemo }        from 'react';
import { useNavigate, Link }        from 'react-router-dom';
import { useForm, Controller }      from 'react-hook-form';
import { zodResolver }              from '@hookform/resolvers/zod';
import { z }                        from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion }                   from 'framer-motion';
import {
  ArrowLeft, Plus, X, LayoutGrid,
  CalendarDays, MapPin, Info, Save, Image
} from 'lucide-react';
import toast                        from 'react-hot-toast';
import api                          from '@/utils/api';
import { cn }                       from '@/utils/cn';
import ImageUpload                  from '@/components/ui/ImageUpload';

// ─── Validation schema ────────────────────────────────────────────────────────
const createExpoSchema = z
  .object({
    title: z
      .string()
      .min(3,   'Title must be at least 3 characters.')
      .max(150, 'Title must not exceed 150 characters.'),

    description: z
      .string()
      .min(20,   'Description must be at least 20 characters.')
      .max(5000, 'Description must not exceed 5000 characters.'),

    theme: z
      .string()
      .max(100, 'Theme must not exceed 100 characters.')
      .optional()
      .or(z.literal('')),

    startDate: z
      .string()
      .min(1, 'Start date is required.'),

    endDate: z
      .string()
      .min(1, 'End date is required.'),

    registrationDeadline: z.string().optional().or(z.literal('')),

    address: z.object({
      venue:   z.string().max(150, 'Venue must not exceed 150 characters.').optional().or(z.literal('')),
      city:    z.string().min(1, 'City is required.').max(100, 'City must not exceed 100 characters.'),
      country: z.string().min(1, 'Country is required.').max(100, 'Country must not exceed 100 characters.'),
      street:  z.string().max(200, 'Street must not exceed 200 characters.').optional().or(z.literal('')),
      zipCode: z.string().max(20, 'Zip code must not exceed 20 characters.').optional().or(z.literal('')),
    }),

    rows: z
      .number({ invalid_type_error: 'Rows must be a number.' })
      .int()
      .min(1,  'Minimum 1 row.')
      .max(50, 'Maximum 50 rows.'),

    cols: z
      .number({ invalid_type_error: 'Columns must be a number.' })
      .int()
      .min(1,  'Minimum 1 column.')
      .max(50, 'Maximum 50 columns.'),

    boothWidth: z
      .number({ invalid_type_error: 'Booth width must be a number.' })
      .min(1, 'Minimum 1 metre.')
      .optional(),

    boothHeight: z
      .number({ invalid_type_error: 'Booth height must be a number.' })
      .min(1, 'Minimum 1 metre.')
      .optional(),

    maxAttendees: z
      .number({ invalid_type_error: 'Must be a number.' })
      .int()
      .min(1, 'Must be at least 1.')
      .optional()
      .nullable(),

    isPublic: z.boolean().optional(),
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

// ─── Floor plan mini-preview ──────────────────────────────────────────────────
const MAX_PREVIEW_CELLS = 400; // cap rendering

function FloorPlanPreview({ rows, cols }) {
  const totalCells = rows * cols;
  const tooLarge   = totalCells > MAX_PREVIEW_CELLS;

  const cells = useMemo(() => {
    if (tooLarge) return [];
    return Array.from({ length: totalCells });
  }, [totalCells, tooLarge]);

  if (!rows || !cols || rows < 1 || cols < 1) return null;

  return (
    <div className="mt-3 rounded-md border border-outline-variant bg-surface-container-low p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-label-sm text-on-surface-variant">
          Grid preview — {rows} × {cols} = {totalCells} booths
        </span>
      </div>

      {tooLarge ? (
        <p className="text-body-sm text-on-surface-variant italic">
          Preview hidden for large grids ({totalCells} cells). The grid will be generated correctly on save.
        </p>
      ) : (
        <div
          className="inline-grid gap-1"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          aria-label={`Floor plan preview: ${rows} rows by ${cols} columns`}
        >
          {cells.map((_, i) => (
            <div
              key={i}
              className="h-4 w-4 rounded-sm border border-outline-variant bg-surface-container-low
                          hover:bg-secondary-container/50 transition-colors duration-100"
              title={`Row ${Math.floor(i / cols)}, Col ${i % cols}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tag input ────────────────────────────────────────────────────────────────
function TagInput({ value = [], onChange, maxTags = 20 }) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const tag = input.trim().toLowerCase();
    if (!tag || value.includes(tag) || value.length >= maxTags) return;
    onChange([...value, tag]);
    setInput('');
  };

  const removeTag = (tag) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {value.map((tag) => (
          <span
            key={tag}
            className="badge badge-info gap-1"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 hover:text-error transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      {value.length < maxTags && (
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="Type a tag and press Enter…"
            className="input flex-1"
            maxLength={50}
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!input.trim()}
            className="btn-ghost btn-sm gap-1 shrink-0"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}
      <p className="font-mono text-label-sm text-on-surface-variant">
        {value.length} / {maxTags} tags
      </p>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function FormSection({ title, description, icon: Icon, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0  }}
      transition={{ duration: 0.25 }}
      className="card flex flex-col gap-5"
    >
      <div className="flex items-start gap-3 border-b border-outline-variant pb-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary-container">
          <Icon size={17} className="text-on-primary-container" />
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
function Field({ label, required, error, hint, children, htmlFor }) {
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminExpoCreate() {
  const navigate  = useNavigate();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState([]);
  const [bannerFile, setBannerFile] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver:      zodResolver(createExpoSchema),
    defaultValues: {
      title:               '',
      description:         '',
      theme:               '',
      startDate:           '',
      endDate:             '',
      registrationDeadline:'',
      address: {
        venue:   '',
        city:    '',
        country: '',
        street:  '',
        zipCode: '',
      },
      rows:                8,
      cols:                10,
      boothWidth:          3,
      boothHeight:         3,
      maxAttendees:        null,
      isPublic:            true,
    },
  });

  const watchedRows = watch('rows');
  const watchedCols = watch('cols');

  // ── Create mutation ─────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post('/expos', payload);
      return data.data.expo;
    },
    onSuccess: (expo) => {
      toast.success(`"${expo.title}" created successfully.`);
      queryClient.invalidateQueries({ queryKey: ['expos'] });
      // Removed navigation from here so we can upload the banner first in onSubmit
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to create expo. Please try again.');
    },
  });

  // ── Submit ──────────────────────────────────────────────────────────────────
  const onSubmit = async (values) => {
    const payload = {
      title:       values.title,
      description: values.description,
      theme:       values.theme || undefined,
      startDate:   new Date(values.startDate).toISOString(),
      endDate:     new Date(values.endDate).toISOString(),
      registrationDeadline: values.registrationDeadline
        ? new Date(values.registrationDeadline).toISOString()
        : undefined,
      address: {
        venue:   values.address.venue   || undefined,
        city:    values.address.city,
        country: values.address.country,
        street:  values.address.street  || undefined,
        zipCode: values.address.zipCode || undefined,
      },
      floorPlanConfig: {
        rows:        Number(values.rows),
        cols:        Number(values.cols),
        boothWidth:  Number(values.boothWidth  || 3),
        boothHeight: Number(values.boothHeight || 3),
      },
      tags,
      maxAttendees: values.maxAttendees || undefined,
      isPublic:     values.isPublic,
    };

    try {
      const expo = await createMutation.mutateAsync(payload);
      
      // Upload banner if selected
      if (bannerFile) {
        const formData = new FormData();
        formData.append('banner', bannerFile);
        formData.append('altText', values.title);
        
        await api.post(`/expos/${expo._id}/banner`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      
      navigate(`/admin/expos/${expo._id}`);
    } catch (error) {
      // Error handling is managed by createMutation's onError, 
      // but you could add banner-specific fallback logic here if needed.
    }
  };

  return (
    <div className="mx-auto max-w-3xl">

      {/* ── Back + header ─────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/admin/expos"
          className="btn-ghost btn-sm gap-1.5"
        >
          <ArrowLeft size={15} /> Expos
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="page-title">Create New Expo</h1>
        <p className="page-subtitle">
          Fill in the event details. Booths will be auto-generated from your floor plan configuration.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">

        {/* ── Section 1: Basic info ──────────────────────────────── */}
        <FormSection
          title="Event Details"
          description="Core information displayed to exhibitors and attendees."
          icon={CalendarDays}
        >
          <Field label="Expo Title" required htmlFor="title" error={errors.title?.message}>
            <input
              id="title"
              type="text"
              placeholder="e.g. TechConnect Global 2026"
              {...register('title')}
              className={cn('input', errors.title && 'input-error')}
              autoFocus
            />
          </Field>

          <Field label="Description" required htmlFor="description" error={errors.description?.message}
            hint="Displayed on the public expo page. Minimum 20 characters.">
            <textarea
              id="description"
              rows={5}
              placeholder="Describe the expo, its goals, audience, and highlights…"
              {...register('description')}
              className={cn('input resize-none', errors.description && 'input-error')}
            />
          </Field>

          <Field label="Theme / Category" htmlFor="theme" error={errors.theme?.message}
            hint="Optional tag line like 'Technology & Innovation' or 'Healthcare'.">
            <input
              id="theme"
              type="text"
              placeholder="e.g. Sustainable Technology"
              {...register('theme')}
              className={cn('input', errors.theme && 'input-error')}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Start Date" required htmlFor="startDate" error={errors.startDate?.message}>
              <input
                id="startDate"
                type="datetime-local"
                {...register('startDate')}
                className={cn('input', errors.startDate && 'input-error')}
              />
            </Field>

            <Field label="End Date" required htmlFor="endDate" error={errors.endDate?.message}>
              <input
                id="endDate"
                type="datetime-local"
                {...register('endDate')}
                className={cn('input', errors.endDate && 'input-error')}
              />
            </Field>

            <Field label="Registration Deadline" htmlFor="regDeadline"
              error={errors.registrationDeadline?.message}
              hint="Optional cutoff for exhibitor sign-ups.">
              <input
                id="regDeadline"
                type="datetime-local"
                {...register('registrationDeadline')}
                className={cn('input', errors.registrationDeadline && 'input-error')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Max Attendees" htmlFor="maxAttendees"
              error={errors.maxAttendees?.message}
              hint="Leave blank for unlimited.">
              <input
                id="maxAttendees"
                type="number"
                min={1}
                placeholder="e.g. 5000"
                {...register('maxAttendees', { valueAsNumber: true })}
                className={cn('input', errors.maxAttendees && 'input-error')}
              />
            </Field>

            <Field label="Visibility" htmlFor="isPublic">
              <div className="flex h-10 items-center gap-3 rounded border border-outline-variant
                              bg-surface-bright px-3">
                <Controller
                  name="isPublic"
                  control={control}
                  render={({ field }) => (
                    <input
                      id="isPublic"
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="h-4 w-4 accent-secondary rounded"
                    />
                  )}
                />
                <label htmlFor="isPublic" className="text-body-sm text-on-surface cursor-pointer">
                  Publicly visible to attendees
                </label>
              </div>
            </Field>
          </div>

          {/* Tags */}
          <Field label="Tags" hint="Press Enter or comma to add. Up to 20 tags.">
            <TagInput value={tags} onChange={setTags} />
          </Field>
        </FormSection>

        {/* ── Section 2: Location ────────────────────────────────── */}
        <FormSection
          title="Venue & Location"
          description="Physical location details for the expo."
          icon={MapPin}
        >
          <Field label="Venue Name" htmlFor="venue" error={errors.address?.venue?.message}>
            <input
              id="venue"
              type="text"
              placeholder="e.g. Dubai World Trade Centre"
              {...register('address.venue')}
              className={cn('input', errors.address?.venue && 'input-error')}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="City" required htmlFor="city" error={errors.address?.city?.message}>
              <input
                id="city"
                type="text"
                placeholder="e.g. Dubai"
                {...register('address.city')}
                className={cn('input', errors.address?.city && 'input-error')}
              />
            </Field>

            <Field label="Country" required htmlFor="country" error={errors.address?.country?.message}>
              <input
                id="country"
                type="text"
                placeholder="e.g. United Arab Emirates"
                {...register('address.country')}
                className={cn('input', errors.address?.country && 'input-error')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Street Address" htmlFor="street" error={errors.address?.street?.message}>
              <input
                id="street"
                type="text"
                placeholder="e.g. Sheikh Zayed Road"
                {...register('address.street')}
                className={cn('input', errors.address?.street && 'input-error')}
              />
            </Field>

            <Field label="ZIP / Postal Code" htmlFor="zipCode" error={errors.address?.zipCode?.message}>
              <input
                id="zipCode"
                type="text"
                placeholder="e.g. 12345"
                {...register('address.zipCode')}
                className={cn('input', errors.address?.zipCode && 'input-error')}
              />
            </Field>
          </div>
        </FormSection>

        {/* ── Section 3: Floor plan ──────────────────────────────── */}
        <FormSection
          title="Floor Plan Configuration"
          description="Defines the booth grid layout. Booths are auto-generated on save."
          icon={LayoutGrid}
        >
          <div className="flex items-start gap-2 rounded bg-primary-container px-3 py-2.5">
            <Info size={15} className="mt-0.5 shrink-0 text-on-primary-container" />
            <p className="text-body-sm text-on-primary-container">
              Booths are labelled <span className="font-mono font-semibold">A01, A02 … B01, B02</span> and
              auto-generated when you save. The floor plan cannot be changed after booths are assigned.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Rows" required htmlFor="rows" error={errors.rows?.message}>
              <input
                id="rows"
                type="number"
                min={1}
                max={50}
                {...register('rows', { valueAsNumber: true })}
                className={cn('input', errors.rows && 'input-error')}
              />
            </Field>

            <Field label="Columns" required htmlFor="cols" error={errors.cols?.message}>
              <input
                id="cols"
                type="number"
                min={1}
                max={50}
                {...register('cols', { valueAsNumber: true })}
                className={cn('input', errors.cols && 'input-error')}
              />
            </Field>

            <Field label="Booth Width (m)" htmlFor="boothWidth" error={errors.boothWidth?.message}>
              <input
                id="boothWidth"
                type="number"
                min={1}
                step={0.5}
                {...register('boothWidth', { valueAsNumber: true })}
                className={cn('input', errors.boothWidth && 'input-error')}
              />
            </Field>

            <Field label="Booth Height (m)" htmlFor="boothHeight" error={errors.boothHeight?.message}>
              <input
                id="boothHeight"
                type="number"
                min={1}
                step={0.5}
                {...register('boothHeight', { valueAsNumber: true })}
                className={cn('input', errors.boothHeight && 'input-error')}
              />
            </Field>
          </div>

          {/* Live preview */}
          <FloorPlanPreview
            rows={watchedRows}
            cols={watchedCols}
          />
        </FormSection>

        {/* ── Section 4: Banner Image ────────────────────────────── */}
        <FormSection
          title="Banner Image"
          description="Upload a banner image for the expo listing page."
          icon={Image}
        >
          <ImageUpload
            onUpload={(files) => setBannerFile(files[0])}
            multiple={false}
          />
        </FormSection>

        {/* ── Submit bar ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between rounded-md border border-outline-variant
                        bg-surface-bright px-6 py-4 shadow-level-2 sticky bottom-4">
          <p className="text-body-sm text-on-surface-variant hidden sm:block">
            All required fields must be filled before saving.
          </p>
          <div className="flex gap-3 ml-auto">
            <Link to="/admin/expos" className="btn-ghost">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || createMutation.isPending}
              className="btn-secondary gap-2"
            >
              {isSubmitting || createMutation.isPending ? (
                <>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    className="inline-block h-4 w-4 rounded-full border-2
                               border-on-secondary/30 border-t-on-secondary"
                  />
                  Creating…
                </>
              ) : (
                <>
                  <Save size={15} /> Create Expo
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}