# TODO - Attendee/Landing UX redesign

## Step 0 — Backup / Undo
- [x] Created git branch `blackboxai/attendee-ui` (undo by resetting to previous branch)

## Step 1 — Public browsing UX (no login until registration)
- [ ] Update LandingPage expo cards so unauthenticated users can explore expo pages.
- [ ] Update attendee expo/sessions actions so login is required only when pressing Register/Unregister/Bookmark.

## Step 2 — Add missing Attendee Session Detail page (shows all session info)
- [x] Create `frontend/src/pages/attendee/sessions/AttendeeSessionDetail.jsx`
- [x] Wire route in `frontend/src/App.jsx` for `/attendee/sessions/:id`
- [ ] Add navigation from AttendeeSessions cards and AttendeeExpoDetail session cards to the detail page.


## Step 3 — UI polish to match LandingPage
- [ ] Refactor `frontend/src/pages/attendee/AttendeeDashboard.jsx` visual style to match LandingPage sections/cards.
- [ ] Add richer visuals (banner image blocks + lightweight animations) to AttendeeDashboard sections.

## Step 4 — Expo detail polish
- [ ] Ensure `frontend/src/pages/attendee/expos/AttendeeExpoDetail.jsx` uses consistent CTA style and has good imagery/animations.

## Step 5 — Test
- [ ] Run frontend build / lint (if available) and manually verify flows.
- [ ] Verify unauthenticated browsing works end-to-end.

