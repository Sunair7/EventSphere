import { useState, useCallback, useRef }               from 'react';
import { useForm }                              from 'react-hook-form';
import { zodResolver }                          from '@hookform/resolvers/zod';
import { z }                                   from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence }              from 'framer-motion';
import {
  Building2, FileText, LayoutGrid, Upload,
  Trash2, CheckCircle2, Clock, XCircle,
  ShieldCheck, AlertCircle, Save, Plus,
  ExternalLink, Ban, ChevronDown, ChevronUp,
  X,
} from 'lucide-react';
import toast                                    from 'react-hot-toast';
import api                                      from '@/utils/api';
import { cn }                                   from '@/utils/cn';

import axios from 'axios';  // Add axios import

// ─── Query key ────────────────────────────────────────────────────────────────
const profileKey = ['exhibitor', 'profile', 'me'];

// ─── Validation schemas ───────────────────────────────────────────────────────
const profileSchema = z.object({
  companyName: z
    .string().min(2, 'Company name must be at least 2 characters.')
    .max(150, 'Company name must not exceed 150 characters.'),
  description: z
    .string().min(20, 'Description must be at least 20 characters.')
    .max(3000, 'Description must not exceed 3000 characters.'),
  tagline: z.string().max(200).optional().or(z.literal('')),
  industry: z.string().max(100).optional().or(z.literal('')),
  logo: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
  bannerImage: z.string().url('Must be a valid URL.').optional().or(z.literal('')),
  'contactPerson.name':  z.string().min(1, 'Contact name is required.').max(100),
  'contactPerson.email': z.string().email('Enter a valid email.'),
  'contactPerson.title': z.string().max(100).optional().or(z.literal('')),
  'contactPerson.phone': z.string().max(30).optional().or(z.literal('')),
  'socialLinks.website':  z.string().url().optional().or(z.literal('')),
  'socialLinks.linkedin': z.string().url().optional().or(z.literal('')),
  'socialLinks.twitter':  z.string().url().optional().or(z.literal('')),
});

const documentSchema = z.object({
  type:     z.enum(['business_registration','tax_certificate','identity_document','product_catalog','insurance_certificate','other']),
  fileUrl:  z.string().url('Enter a valid URL.').min(1, 'File URL is required.'),
  fileName: z.string().min(1, 'File name is required.').max(255),
  label:    z.string().max(100).optional().or(z.literal('')),
});

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  pending:   { badge: 'badge-warning', icon: Clock,         text: 'Pending Review'  },
  approved:  { badge: 'badge-success', icon: CheckCircle2,  text: 'Approved'        },
  rejected:  { badge: 'badge-error',   icon: XCircle,       text: 'Not Approved'    },
  suspended: { badge: 'badge-error',   icon: Ban,           text: 'Suspended'       },
};

const DOC_STATUS = {
  pending:  { badge: 'badge-warning', label: 'Awaiting Review' },
  verified: { badge: 'badge-success', label: 'Verified'        },
  rejected: { badge: 'badge-error',   label: 'Flagged'         },
};

const DOC_TYPES = [
  { value: 'business_registration', label: 'Business Registration' },
  { value: 'tax_certificate',       label: 'Tax Certificate'       },
  { value: 'identity_document',     label: 'Identity Document'     },
  { value: 'product_catalog',       label: 'Product Catalog'       },
  { value: 'insurance_certificate', label: 'Insurance Certificate' },
  { value: 'other',                 label: 'Other'                 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const Field = ({ label, htmlFor, error, hint, required, children }) => (
  <div className="flex flex-col gap-1.5">
    {label && (
      <label htmlFor={htmlFor} className="font-mono text-label-md text-on-surface">
        {label} {required && <span className="text-error">*</span>}
      </label>
    )}
    {children}
    {hint  && !error && <p className="font-mono text-label-sm text-on-surface-variant">{hint}</p>}
    {error &&           <p className="text-body-sm text-error" role="alert">{error}</p>}
  </div>
);

const Section = ({ icon: Icon, title, description, children, action }) => (
  <div className="card flex flex-col gap-5">
    <div className="flex items-start justify-between gap-3 border-b border-outline-variant pb-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-primary-container">
          <Icon size={17} className="text-on-primary-container" />
        </div>
        <div>
          <h2 className="text-headline-sm font-semibold text-on-surface">{title}</h2>
          {description && <p className="mt-0.5 text-body-sm text-on-surface-variant">{description}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </div>
);

// ─── Products tag input ───────────────────────────────────────────────────────
function ProductsInput({ value = [], onChange }) {
  const [input, setInput] = useState('');
  const add = () => {
    const tag = input.trim();
    if (!tag || value.includes(tag) || value.length >= 30) return;
    onChange([...value, tag]);
    setInput('');
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 min-h-[2rem]">
        {value.map((p) => (
          <span key={p} className="badge badge-info gap-1">
            {p}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== p))}
              className="hover:text-error transition-colors" aria-label={`Remove ${p}`}>
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
          placeholder="Add a product and press Enter…"
          className="input flex-1" maxLength={100}
        />
        <button type="button" onClick={add} disabled={!input.trim()} className="btn-ghost btn-sm gap-1 shrink-0">
          <Plus size={14} /> Add
        </button>
      </div>
      <p className="font-mono text-label-sm text-on-surface-variant">{value.length}/30 products</p>
    </div>
  );
}

// ─── Document upload form ─────────────────────────────────────────────────────
function DocumentUploadForm({ onClose, onSuccess }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(documentSchema),
    defaultValues: { type: 'business_registration', fileUrl: '', fileName: '', label: '' },
  });

  const mutation = useMutation({
    mutationFn: async (values) => {
      const { data } = await api.post('/exhibitors/profile/documents', values);
      return data;
    },
    onSuccess: () => { toast.success('Document uploaded.'); onSuccess(); onClose(); },
    onError:   (err) => toast.error(err.message || 'Failed to upload document.'),
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0  }}
      exit={{ opacity: 0, y: -8    }}
      className="rounded-md border border-outline-variant bg-surface-container-low p-4"
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Document Type" required htmlFor="doc-type" error={errors.type?.message}>
            <select id="doc-type" {...register('type')} className="input">
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Label (optional)" htmlFor="doc-label" error={errors.label?.message}>
            <input id="doc-label" type="text" placeholder="e.g. Q1 2026 Registration"
              {...register('label')} className="input" />
          </Field>
        </div>
        <Field label="File URL" required htmlFor="doc-url" error={errors.fileUrl?.message}
          hint="Paste a direct link to your uploaded document (Google Drive, Dropbox, etc.)">
          <input id="doc-url" type="url" placeholder="https://drive.google.com/file/…"
            {...register('fileUrl')} className={cn('input', errors.fileUrl && 'input-error')} />
        </Field>
        <Field label="File Name" required htmlFor="doc-name" error={errors.fileName?.message}>
          <input id="doc-name" type="text" placeholder="e.g. Business_Registration_2026.pdf"
            {...register('fileName')} className={cn('input', errors.fileName && 'input-error')} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
          <button type="submit" disabled={isSubmitting || mutation.isPending} className="btn-secondary btn-sm gap-1.5">
            {mutation.isPending ? 'Uploading…' : <><Upload size={13} /> Upload Document</>}
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ExhibitorProfile() {
  const queryClient        = useQueryClient();
  const [showDocForm, setShowDocForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [products, setProducts]       = useState([]);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Cloudinary upload helper
  const uploadToCloudinary = async (file) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'eventsphere_chat'); // Same preset as chat
    formData.append('folder', 'eventsphere/exhibitors');

    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const { data } = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
      formData
    );
    return data.secure_url;
  };

  // ── Fetch profile ───────────────────────────────────────────────────────────
  const { data: profile, isLoading } = useQuery({
    queryKey: profileKey,
    queryFn:  async () => {
      const { data } = await api.get('/exhibitors/profile/me');
      return data.data.profile;
    },
    onSuccess: (p) => {
      if (p?.products) setProducts(p.products);
    },
    retry: false,
  });

  // ── Profile form ────────────────────────────────────────────────────────────
  const {
    register, handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(profileSchema),
    values: profile ? {
      companyName:           profile.companyName   || '',
      description:           profile.description   || '',
      tagline:               profile.tagline        || '',
      industry:              profile.industry       || '',
      logo:                  profile.logo           || '',
      bannerImage:           profile.bannerImage    || '',
      'contactPerson.name':  profile.contactPerson?.name  || '',
      'contactPerson.email': profile.contactPerson?.email || '',
      'contactPerson.title': profile.contactPerson?.title || '',
      'contactPerson.phone': profile.contactPerson?.phone || '',
      'socialLinks.website':  profile.socialLinks?.website  || '',
      'socialLinks.linkedin': profile.socialLinks?.linkedin || '',
      'socialLinks.twitter':  profile.socialLinks?.twitter  || '',
    } : {},
  });

  const saveMutation = useMutation({
    mutationFn: async (values) => {
      const payload = {
        companyName:  values.companyName,
        description:  values.description,
        tagline:      values.tagline    || undefined,
        industry:     values.industry   || undefined,
        logo:         values.logo       || undefined,
        bannerImage:  values.bannerImage || undefined,
        products,
        contactPerson: {
          name:  values['contactPerson.name'],
          email: values['contactPerson.email'],
          title: values['contactPerson.title'] || undefined,
          phone: values['contactPerson.phone'] || undefined,
        },
        socialLinks: {
          website:  values['socialLinks.website']  || undefined,
          linkedin: values['socialLinks.linkedin'] || undefined,
          twitter:  values['socialLinks.twitter']  || undefined,
        },
      };
      const endpoint = profile ? '/exhibitors/profile/me' : '/exhibitors/profile';
      const method   = profile ? 'put' : 'post';
      const { data } = await api[method](endpoint, payload);
      return data.data.profile;
    },
    onSuccess: (p) => {
      toast.success(profile ? 'Profile updated successfully.' : 'Profile created successfully.');
      queryClient.invalidateQueries({ queryKey: profileKey });
      if (p?.products) setProducts(p.products);
    },
    onError: (err) => toast.error(err.message || 'Failed to save profile.'),
  });

  // ── Delete document ─────────────────────────────────────────────────────────
  const deleteDocMutation = useMutation({
    mutationFn: (docId) => api.delete(`/exhibitors/profile/documents/${docId}`),
    onSuccess:  () => {
      toast.success('Document removed.');
      queryClient.invalidateQueries({ queryKey: profileKey });
    },
    onError: (err) => toast.error(err.message || 'Failed to remove document.'),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl flex flex-col gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-48 rounded-md" />
        ))}
      </div>
    );
  }

  const StatusIcon = STATUS[profile?.applicationStatus]?.icon || Clock;
  const statusCfg  = STATUS[profile?.applicationStatus] || STATUS.pending;

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-6">

      {/* ── Page header ───────────────────────────────────────────── */}
      <div>
        <h1 className="page-title">Company Profile</h1>
        <p className="page-subtitle">
          {profile
            ? 'Update your exhibitor profile and manage documents.'
            : 'Create your company profile to begin the application process.'}
        </p>
      </div>

      {/* ── Application status banner ──────────────────────────────── */}
      {profile && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-start gap-3">
            <div className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded',
              statusCfg.badge === 'badge-success' ? 'bg-success-container'
              : statusCfg.badge === 'badge-warning' ? 'bg-warning-container'
              : 'bg-error-container'
            )}>
              <StatusIcon size={17} className={
                statusCfg.badge === 'badge-success' ? 'text-on-success-container'
                : statusCfg.badge === 'badge-warning' ? 'text-on-warning-container'
                : 'text-on-error-container'
              } />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-body-md font-semibold text-on-surface">
                  Application {statusCfg.text}
                </h3>
                <span className={cn('badge', statusCfg.badge)}>
                  {profile.applicationStatus}
                </span>
                {profile.isVerified && (
                  <span className="flex items-center gap-1 font-mono text-label-sm text-secondary">
                    <ShieldCheck size={13} /> Verified
                  </span>
                )}
              </div>
              {profile.applicationNote && (
                <div className="mt-2 rounded bg-surface-container px-3 py-2">
                  <p className="font-mono text-label-sm text-on-surface-variant">
                    Organiser note: <span className="text-on-surface">{profile.applicationNote}</span>
                  </p>
                </div>
              )}
            </div>

            {/* History toggle */}
            <button
              onClick={() => setShowHistory((v) => !v)}
              className="flex items-center gap-1 shrink-0 btn-ghost btn-sm"
            >
              History
              {showHistory ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </motion.div>
      )}

      {/* ── Company info form ──────────────────────────────────────── */}
      <form onSubmit={handleSubmit((v) => saveMutation.mutate(v))} noValidate>
        <div className="flex flex-col gap-6">

          <Section icon={Building2} title="Company Information"
            description="This information is displayed publicly to attendees.">
            <Field label="Company Name" required htmlFor="companyName" error={errors.companyName?.message}>
              <input id="companyName" type="text" {...register('companyName')}
                className={cn('input', errors.companyName && 'input-error')} />
            </Field>

            <Field label="Tagline" htmlFor="tagline" error={errors.tagline?.message}
              hint="Short phrase displayed under your company name.">
              <input id="tagline" type="text" placeholder="e.g. Innovating healthcare logistics"
                {...register('tagline')} className="input" />
            </Field>

            <Field label="Description" required htmlFor="description" error={errors.description?.message}
              hint="Full company description. Minimum 20 characters.">
              <textarea id="description" rows={5} {...register('description')}
                className={cn('input resize-none', errors.description && 'input-error')} />
            </Field>

            <Field label="Industry" htmlFor="industry" error={errors.industry?.message}>
              <input id="industry" type="text" placeholder="e.g. Healthcare Technology"
                {...register('industry')} className="input" />
            </Field>

            <Field label="Products / Services" hint="Press Enter or comma to add. Up to 30 items.">
              <ProductsInput value={products} onChange={setProducts} />
            </Field>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
  <Field label="Logo" htmlFor="logo" error={errors.logo?.message}>
    <div className="flex gap-2">
      <input id="logo" type="url" placeholder="https://…"
        {...register('logo')} className={cn('input flex-1', errors.logo && 'input-error')} />
      <button
        type="button"
        onClick={() => logoInputRef.current?.click()}
        disabled={uploadingLogo}
        className="btn-ghost btn-sm gap-1 shrink-0"
      >
        {uploadingLogo ? 'Uploading…' : <><Upload size={14} /> Upload</>}
      </button>
      <input
        ref={logoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploadingLogo(true);
          try {
            const url = await uploadToCloudinary(file);
            // Set the form value
            const event = { target: { name: 'logo', value: url } };
            register('logo').onChange(event);
            toast.success('Logo uploaded!');
          } catch (err) {
            toast.error('Upload failed.');
          } finally {
            setUploadingLogo(false);
            e.target.value = '';
          }
        }}
      />
    </div>
  </Field>
  <Field label="Banner Image" htmlFor="banner" error={errors.bannerImage?.message}>
    <div className="flex gap-2">
      <input id="banner" type="url" placeholder="https://…"
        {...register('bannerImage')} className={cn('input flex-1', errors.bannerImage && 'input-error')} />
      <button
        type="button"
        onClick={() => bannerInputRef.current?.click()}
        disabled={uploadingBanner}
        className="btn-ghost btn-sm gap-1 shrink-0"
      >
        {uploadingBanner ? 'Uploading…' : <><Upload size={14} /> Upload</>}
      </button>
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setUploadingBanner(true);
          try {
            const url = await uploadToCloudinary(file);
            const event = { target: { name: 'bannerImage', value: url } };
            register('bannerImage').onChange(event);
            toast.success('Banner uploaded!');
          } catch (err) {
            toast.error('Upload failed.');
          } finally {
            setUploadingBanner(false);
            e.target.value = '';
          }
        }}
      />
    </div>
  </Field>
</div>
          </Section>

          <Section icon={FileText} title="Contact Person"
            description="Primary point of contact for organiser communications.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full Name" required htmlFor="cp-name" error={errors['contactPerson.name']?.message}>
                <input id="cp-name" type="text" {...register('contactPerson.name')}
                  className={cn('input', errors['contactPerson.name'] && 'input-error')} />
              </Field>
              <Field label="Email" required htmlFor="cp-email" error={errors['contactPerson.email']?.message}>
                <input id="cp-email" type="email" {...register('contactPerson.email')}
                  className={cn('input', errors['contactPerson.email'] && 'input-error')} />
              </Field>
              <Field label="Job Title" htmlFor="cp-title" error={errors['contactPerson.title']?.message}>
                <input id="cp-title" type="text" placeholder="e.g. Chief Marketing Officer"
                  {...register('contactPerson.title')} className="input" />
              </Field>
              <Field label="Phone" htmlFor="cp-phone" error={errors['contactPerson.phone']?.message}>
                <input id="cp-phone" type="tel" placeholder="+1 555 000 0000"
                  {...register('contactPerson.phone')} className="input" />
              </Field>
            </div>
          </Section>

          <Section icon={Building2} title="Social Links" description="Optional. Public-facing links.">
            <div className="grid grid-cols-1 gap-4">
              {[
                { key: 'socialLinks.website',  label: 'Website',  placeholder: 'https://yourcompany.com' },
                { key: 'socialLinks.linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/…' },
                { key: 'socialLinks.twitter',  label: 'Twitter',  placeholder: 'https://twitter.com/…' },
              ].map(({ key, label, placeholder }) => (
                <Field key={key} label={label} htmlFor={key}
                  error={errors[key]?.message}>
                  <input id={key} type="url" placeholder={placeholder}
                    {...register(key)} className={cn('input', errors[key] && 'input-error')} />
                </Field>
              ))}
            </div>
          </Section>

          {/* Save button */}
          <div className="flex justify-end gap-3 sticky bottom-4">
            <button
              type="submit"
              disabled={(!isDirty && products === profile?.products) || saveMutation.isPending}
              className="btn-secondary gap-2 shadow-level-2"
            >
              {saveMutation.isPending ? (
                <>
                  <motion.span animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                    className="inline-block h-4 w-4 rounded-full border-2 border-on-secondary/30 border-t-on-secondary" />
                  Saving…
                </>
              ) : (
                <><Save size={15} /> {profile ? 'Save Changes' : 'Create Profile'}</>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* ── Documents section ──────────────────────────────────────── */}
      <Section
        icon={Upload}
        title="Verification Documents"
        description="Upload required documents for organiser review. Max 10 documents."
        action={
          !showDocForm && (
            <button
              onClick={() => setShowDocForm(true)}
              className="btn-ghost btn-sm gap-1 shrink-0"
              disabled={(profile?.documents?.length || 0) >= 10}
            >
              <Plus size={14} /> Add Document
            </button>
          )
        }
      >
        <AnimatePresence>
          {showDocForm && (
            <DocumentUploadForm
              onClose={() => setShowDocForm(false)}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: profileKey })}
            />
          )}
        </AnimatePresence>

        {!profile?.documents?.length && !showDocForm ? (
          <div className="empty-state py-8">
            <div className="empty-state-icon mx-auto mb-3"><Upload size={20} /></div>
            <p className="empty-state-title text-body-sm">No documents uploaded</p>
            <p className="empty-state-body text-label-sm">
              Upload business registration, tax certificates, or other required documents.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {(profile?.documents || []).map((doc) => {
              const dCfg = DOC_STATUS[doc.status] || DOC_STATUS.pending;
              return (
                <div key={doc._id}
                  className="flex items-center gap-3 rounded-md border border-outline-variant
                             bg-surface-bright px-4 py-3">
                  <FileText size={16} className="text-on-surface-variant shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-on-surface truncate">
                      {doc.label || doc.fileName}
                    </p>
                    <p className="font-mono text-label-sm text-on-surface-variant capitalize">
                      {DOC_TYPES.find((t) => t.value === doc.type)?.label || doc.type}
                    </p>
                  </div>
                  <span className={cn('badge shrink-0', dCfg.badge)}>{dCfg.label}</span>
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-surface-container
                               hover:text-on-surface transition-colors">
                    <ExternalLink size={14} />
                  </a>
                  {doc.status !== 'verified' && (
                    <button
                      onClick={() => deleteDocMutation.mutate(doc._id)}
                      disabled={deleteDocMutation.isPending}
                      className="shrink-0 rounded p-1.5 text-on-surface-variant hover:bg-error-container
                                 hover:text-error transition-colors"
                      aria-label="Remove document"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Assigned booths history ────────────────────────────────── */}
      {profile?.assignedBooths?.length > 0 && (
        <Section icon={LayoutGrid} title="Booth Assignments"
          description="Your confirmed booth spaces across all expos.">
          <div className="flex flex-col gap-2">
            {profile.assignedBooths.map((ab, i) => (
              <div key={i}
                className="flex items-center gap-3 rounded-md border border-outline-variant
                           bg-surface-bright px-4 py-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm
                                bg-primary-container font-mono text-label-md font-bold text-on-primary-container">
                  {ab.boothId?.boothNumber ?? '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm font-medium text-on-surface">
                    {ab.expoId?.title ?? 'Expo'}
                  </p>
                  <p className="font-mono text-label-sm text-on-surface-variant">
                    {ab.boothId?.dimensions ?? ''}{ab.assignedAt ? ` · Assigned ${new Date(ab.assignedAt).toLocaleDateString()}` : ''}
                  </p>
                </div>
                <span className={cn(
                  'badge shrink-0',
                  ab.boothId?.status === 'pending' ? 'badge-warning' : 'badge-success'
                )}>
                  {ab.boothId?.status === 'pending' ? 'Pending' : 'Assigned'}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}