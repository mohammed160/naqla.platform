# Naqla: project context (for AI coding agents)

**What it is.** Naqla (نقلة) is an Arabic-first (RTL) course platform for teachers, lecturers and doctors who want to become digital content creators.
One **lifetime membership** (single payment) unlocks **three tracks**: graphic content design, building platforms with vibe coding, and paid ads.
Tagline: "One step, real impact".

**Stack.** React 18 + Vite, React Router 6, Framer Motion, Supabase (Auth, Postgres + RLS, Storage, Edge Functions). No custom server.
Forked from the "Design Tips" platform; some legacy CSS in `src/styles.css` and friends is still in use.

## Where things live
- `src/App.jsx`: routes. Public: `/`, `/courses`, `/join`, `/faq`, `/watch/:lectureId`, `/login`, `/signup`, `/verify-email`. `/projects/*` redirects to `/faq`. Protected: `/dashboard`, `/join/checkout`, `/checkout/:courseId` (legacy single-course). Admin lives under `VITE_ADMIN_PORTAL_PATH`; admin screens are lazy-loaded (`React.lazy`) so they stay out of the student bundle.
- `src/naqla.css`: **brand layer, loaded last**, overrides the legacy theme. Put new styles here.
- `src/lib/tracks.js`: the three tracks (colors, shapes, demo data). `src/lib/membership.js`: `usePlan()`, `useMembership()`.
- `src/components/`: `TrackStage` (hero carousel), `TrackTile`, `PlanCard`, `BrandShapes` (the 4 logo shapes), `LoadingScreen`.
- `src/config/siteDefaults.js`: default copy/nav/hero; editable at runtime from the admin "محتوى المنصة" page (stored in `site_settings`).
- `src/pages/admin/AdminPlan.jsx`: plan price/text, member list, grant/revoke.
- `supabase/migrations/20260920_naqla_lifetime_membership.sql`: plans, memberships, access rules, code redemption.
- `supabase/migrations/20260926_profile_guard_and_admin_bootstrap.sql`: lets the SQL Editor (no JWT) promote the first admin; makes `role`, `is_active` and `email` on `profiles` admin-only.
- `supabase/naqla_full_setup.sql`: GENERATED one-paste setup (all migrations, alphabetical). Rebuild with `npm run db:bundle`; `npm run verify` fails if it is stale.

## Auth and email confirmation
Works with Supabase "Confirm email" on or off. `signup()` returns `needsConfirmation: true` when there is no session; the app then shows `/verify-email` (resend button). Login with an unconfirmed email also routes there. Email links land on `VITE_APP_URL` + `/dashboard` or `/update-password`, so both must be allowed under Supabase Auth > Redirect URLs.

## Reviews (social proof)
`StudentReviewsGrid` shows only real, non-hidden rows from `student_reviews` (via `get_student_reviews`) and computes the average from them. It renders nothing until at least one review exists. Never add invented testimonials or numbers.

## FAQ page
`/faq` (`src/pages/Faq.jsx`) replaces the student-projects gallery. Content lives in `src/config/faqDefaults.js` (5 categories, 26 Q&As) and is editable at runtime from the admin content page (`site_settings.faqItems`).
`{price}` in an answer is replaced with the current plan price. An item may have `cta: { label, to }` or `cta: { label, support: true }` (WhatsApp link from `settings.support.whatsappUrl`, hidden when empty).
The page has live search (Arabic-normalised), category tabs, deep links (`/faq#price`) and FAQPage JSON-LD.

## Disabled: student projects gallery
The public gallery, its home-page showcase, the student "مشاريعي" tab and the admin projects page are unplugged from routes and navigation.
The code (`ProjectsGallery`, `ProjectDetails`, `StudentProjectsPanel`, `StudentProjectsVoyageCarousel`, `AdminProjects`) and the `projects` tables are intentionally left in place so it can be re-enabled by restoring the routes and nav entries.

## Access model (important)
Content access is decided in Postgres by `can_access_course()`: admin, **or** active membership, **or** legacy per-course enrollment.
Lectures, materials, video sources and storage policies all call it, so never re-implement access checks in the frontend.
Memberships are granted only by server-side code: `grant_membership()` (service role), `admin_review_payment`, `redeem_activation_code`.

## Brand
Colors: purple `#694AFF`, orange `#FF5500`, pink `#FB4C7D`, teal `#54E6D4`, ink `#101516`.
Dark-first. Latin font: Marble (self-hosted, `src/assets/fonts/marble`). Arabic font: Readex Pro (`@fontsource-variable/readex-pro`), chosen because the brand pack has no Arabic font.
Logo assets in `public/brand`. Pill-shaped buttons, large radii, the pattern (`/brand/pattern.svg`) as a quiet divider.
Track colors: graphic = pink, vibe coding = purple, ads = orange.

## Conventions
- Arabic UI copy, sentence case, plain verbs. Keep Arabic letter-spacing at 0.
- Respect `prefers-reduced-motion`.
- Never put `service_role` or secrets in Vite env vars.
- Before finishing a change: `npm run build` (it runs `scripts/verify-project.mjs`, which lists required files).

## Known gaps
- Edge Functions `create-payment-session`, `verify-trc20-payment`, `capture-paypal-order` are referenced by `Checkout.jsx` but are not in this repo. They must accept `planId` and call `grant_membership`.
- Seed price (1999 EGP) is a placeholder.
- FAQ answers contain assumptions the owner must confirm: refund handling, device/session limits, payment methods, and the support channel (`support.whatsappUrl` is empty by default).
- The three courses have no lectures yet.
- All migrations were run and re-run against Postgres 16 with a Supabase-like stub (auth/storage schemas, anon/authenticated/service_role roles), plus a 37-case RLS/business test. Not yet run on a live Supabase project.
