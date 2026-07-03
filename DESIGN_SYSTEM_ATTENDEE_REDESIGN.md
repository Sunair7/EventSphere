# EventSphere UI Design System (Attendee Redesign Reference)

This document extracts the existing visual identity and UI primitives from the repo (source of truth: `frontend/src/index.css` and existing UI usage). It is intended to be used as the baseline when updating Attendee pages.

---

## 1) Brand identity (from code)
- **Product name:** `EventSphere`
  - Source: `frontend/src/layouts/DashboardLayout.jsx` (sidebar)
- **Role labels:** `Admin`, `Exhibitor`, `Attendee`
  - Source: `frontend/src/layouts/DashboardLayout.jsx`

---

## 2) Central theme tokens (from `frontend/src/index.css`)

### Fonts
- `--font-sans: "Inter"`
- `--font-mono: "JetBrains Mono"`

### Core colors
- Primary: `--color-primary: #131b2e`
- Secondary (brand accent): `--color-secondary: #006a61`
- Tertiary: `--color-tertiary: #3980f4`
- Error: `--color-error: #e11d48`
- Warning: `--color-warning: #f59e0b`
- Success: `--color-success: #059669`

### Surfaces / backgrounds
- Background: `--color-background: #f8fafc`
- Surface bright (cards): `--color-surface-bright: #ffffff`
- Surface containers:
  - `--color-surface-container-low: #e5eeff`
  - `--color-surface-container-high: #dce9ff`

### Typography scale tokens (examples)
- Display / headline / body:
  - `--text-display-lg`
  - `--text-headline-lg / --text-headline-md / --text-headline-sm`
  - `--text-body-lg / --text-body-md / --text-body-sm`
- Label tokens (used in badges/buttons):
  - `--text-label-md`
  - `--text-label-sm`

### Radii / shadows / spacing
- Radii:
  - `--radius-sm: 0.25rem`
  - `--radius: 0.5rem`
  - `--radius-md: 0.75rem`
  - `--radius-xl: 1.5rem`
- Shadows:
  - `--shadow-level-2`, `--shadow-level-3`, `--shadow-focus-ring`
- Spacing:
  - `--spacing-container-pad: 2rem`
  - `--spacing-section-gap: 2.5rem`
  - `--spacing-card-padding: 1.5rem`

### Animations
- `--animate-scale-in`
- `--animate-shimmer`

---

## 3) Reusable UI primitives (from `frontend/src/index.css`)

### Buttons
Base classes:
- `.btn-primary`
- `.btn-secondary` (used widely in Attendee actions)
- `.btn-ghost` (outline)
- `.btn-danger`
- `.btn-tertiary`
Sizing:
- `.btn-sm`
- `.btn-lg`

Usage principle:
- Prefer `.btn-secondary` for primary actions.
- Use `.btn-ghost` for secondary/tertiary navigation and inline actions.
- Use `.btn-tertiary` for accent links.

### Cards
- `.card`

Card behavior:
- Shared border radius, border, background and padding are centralized in `.card`.

### Badges / status chips
Base classes:
- `.badge`
- `.badge-success`, `.badge-warning`, `.badge-error`, `.badge-info`, `.badge-neutral`

Usage principle:
- Use badges for **status** and **format** labeling.
- Badge typography is mono (`--font-mono`) and standardized by the theme.

### Typography/layout helpers
- `.page-header`
- `.page-title`
- `.page-subtitle`

### Empty states
- `.empty-state`
- `.empty-state-icon`
- `.empty-state-title`
- `.empty-state-body`

### Loading skeletons
- `.skeleton` (shimmer)

### Inputs
- `.input`
- `.input-error`

### Modal primitives
- `.modal-overlay`
- `.modal-panel`

(Existing modals also use token-aligned Tailwind classes, but these definitions are the base.)

### Dividers / tables
- `.divider`
- `.data-table` (and its internal thead/tbody styling)

---

## 4) Attendee page patterns to inherit (from existing pages)

### Page composition pattern
Across Attendee pages, headers follow:
- `.page-header`
- `.page-title` (often with icon)
- `.page-subtitle`

### Content blocks
- Lists are built from repeated `.card` elements.
- Status is expressed via `.badge*`.
- Primary actions use `.btn-secondary`; cancel/back uses `.btn-ghost`.

### Empty/loading behavior
- Loading: `.skeleton` blocks.
- Empty: `.empty-state` with the same icon + title/body structure.

### Detail side panel (Schedule)
Attendee schedule includes a right-side detail panel pattern:
- `.card` with `sticky top-*` positioning
- consistent badge + typography hierarchy

---

## 5) Copy + labels already present in the repo (do not invent)
When redesigning Attendee UI, keep wording consistent with existing strings in the codebase.

Examples pulled from Attendee components:
- Page titles/sections:
  - “My Schedule”
  - “Upcoming Events”
  - “Saved Sessions”
  - “Registered Sessions”
  - “Quick Actions”
  - “Sessions Dashboard”
- Empty states:
  - “No events yet”
  - “No saved sessions”
  - “No registered sessions”
  - “No sessions yet”
  - “No public sessions found”
- Buttons/actions:
  - “Register Now”
  - “Session Full”
  - “Registered”
  - “Cancel Registration”
  - “Bookmark Session”
  - “Remove Bookmark”
- Modal/payment-related copy:
  - uses `PaymentModal.jsx` headings and warnings (do not change unless explicitly requested).

---

## 6) Implementation checklist (for your Attendee UI updates)
When you update Attendee pages:
1. Replace custom one-off styling with shared primitives from `index.css`:
   - `.card`, `.page-header`, `.page-title`, `.page-subtitle`, `.badge*`, `.btn-*`, `.input`, `.empty-state`, `.skeleton`.
2. Keep existing labels/copy strings consistent with the current code.
3. Maintain the established information hierarchy:
   - Title → subtitle/metadata → badge status → action buttons.
4. Ensure empty/loading states use `.empty-state` + `.skeleton` patterns.

---

## Source-of-truth files referenced
- `frontend/src/index.css`
- `frontend/src/layouts/DashboardLayout.jsx`
- Attendee pages already using these primitives (examples observed during extraction):
  - `frontend/src/pages/attendee/AttendeeDashboard.jsx`
  - `frontend/src/pages/attendee/schedule/AttendeeSchedule.jsx`
  - `frontend/src/pages/attendee/sessions/AttendeeSessions.jsx`
  - `frontend/src/pages/attendee/exhibitors/AttendeeExhibitors.jsx`
  - `frontend/src/pages/attendee/expos/AttendeeExpoDetail.jsx`

