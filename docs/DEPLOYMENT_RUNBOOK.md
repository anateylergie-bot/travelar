# DEPLOYMENT_RUNBOOK.md

A concrete, ordered walkthrough for taking this project from "runs on my
machine against Supabase" to a real production deployment. This
complements `docs/DEPLOYMENT.md` (which documents *what* needs
configuring); this document is the *order of operations* for doing it.

---

## Recommended stack for launch

- **Hosting:** Vercel. It's built by the Next.js team, has zero-config
  support for the App Router, and its edge network handles static assets
  well. Alternatives (Railway, Render, a plain VM) work too, but Vercel
  is the path of least resistance for this specific framework.
- **Database:** the existing Supabase Postgres instance, upgraded from
  the free tier to a paid plan before real users arrive (see "Database
  sizing" below).
- **Object storage** (once Phase 1 of `PRODUCTION_READINESS_PLAN.md`
  lands): Supabase Storage, same account.
- **Domain/SSL:** Vercel handles SSL automatically for any domain
  attached to a project — no separate certificate management needed.

---

## Phase A — Pre-deployment hardening (do this before the first real deploy)

These are things that are fine for development but must change before
real users and real money are involved.

- [ ] **Close the security gaps already documented in `SECURITY.md`:**
      - Add MFA enforcement for admin roles (currently architecture-only, D-noted in Phase 1)
      - Replace the in-memory rate limiter with a Redis-backed one (every phase's docs flag this — it silently stops working correctly the moment there's more than one server instance, which Vercel's serverless model makes likely by default)
      - Add a CAPTCHA/challenge on registration (currently unprotected against bot signups)
- [ ] **Rotate every secret used during development.** Any API keys, database passwords, or session secrets that existed during this build-and-test process should be treated as potentially exposed (they were typed into a terminal, pasted into chat logs, etc.) and rotated before production traffic touches them.
- [ ] **Complete at least the highest-priority item from `PRODUCTION_READINESS_PLAN.md`** (the wallet reconciliation job) — cheap insurance, do it before real money moves through the system.
- [ ] **Legal review.** Per spec Section 92/93, Terms of Service, Privacy Policy, Agent Agreement, and the other policy documents referenced throughout the spec have not been drafted or reviewed by a lawyer. Do not launch to real users, especially ones being paid money, without this.

## Phase B — Infrastructure setup

1. **Upgrade the Supabase project off the free tier** if it's still on
   it. Free-tier Supabase projects pause after a period of inactivity and
   have low connection limits — both are unacceptable for production.
   Check current connection pool limits against expected concurrent
   traffic (the pooled `DATABASE_URL` you're already using handles most
   of this, but verify the plan's stated connection ceiling).
2. **Enable Supabase's automated backups** (Point-in-Time Recovery, if
   the plan supports it) — spec Section 102 requires a backup strategy;
   Supabase's built-in PITR is the simplest way to satisfy this without
   building custom backup tooling.
3. **Create a Vercel project**, connect it to the Git repository.
4. **Configure environment variables in Vercel** (Project Settings →
   Environment Variables), for the **Production** environment
   specifically (Vercel supports separate values per environment —
   Development/Preview/Production):
   - `DATABASE_URL`, `DIRECT_URL` (Supabase pooled/direct connection strings)
   - `APP_ORIGIN` (the real production domain, e.g. `https://travelsafe.example.com`)
   - `NODE_ENV=production`, `APP_ENV=production`
   - `BCRYPT_COST` (12 is a reasonable production default; do not lower it)
   - `SESSION_TTL_HOURS`, `MAX_LOGIN_ATTEMPTS`, `LOGIN_ATTEMPT_WINDOW_MINUTES`
   - Feature flags as appropriate for launch scope
   - `DEFAULT_TIMEZONE=UTC`
   - Any new provider keys added per `PRODUCTION_READINESS_PLAN.md`
     (payment provider secret key, currency API key, etc.) — **never**
     prefixed with `NEXT_PUBLIC_`, which would expose them to the browser
5. **Do not reuse development credentials in production.** If the
   Supabase project used throughout this build-and-test process is meant
   to become the real production database, that's fine — but audit its
   contents first (see Phase C, step 2) rather than assuming it's clean.

## Phase C — Database migration to production

1. **Decide: is the Supabase project used during development becoming
   production, or is this a fresh database?**
   - If **reusing** the same project: proceed to step 2.
   - If **fresh**: create a new Supabase project, set up `DATABASE_URL`/`DIRECT_URL`
     for it, and run every migration from scratch:
     ```bash
     npx prisma migrate deploy
     ```
     then run the manual SQL file (`prisma/manual-sql/001-postgis-and-constraints.sql`)
     once, then decide separately whether to run `npm run seed` — **the
     seed script creates clearly-labeled test accounts and Ghana
     geography/category data; the geography/category/emergency-number/
     phrasebook data is real and fine to keep, but the `test-*@example.dev`
     accounts should be deleted before real launch** (or the seed script
     extended to skip account creation in a "production seed" mode —
     currently it does both in one pass).
2. **If reusing the development database:** audit and clean it before
   calling it production:
   - [ ] Delete the three `test-*@example.dev` seed accounts (or rotate
         their passwords and demote them — do not leave known
         credentials with SUPER_ADMIN/LOCAL_DATA_AGENT access sitting in
         a production database)
   - [ ] Review every `Place`, `BusinessClaim`, `Task`, `WalletTransaction`,
         etc. created during testing — anything with a name containing
         "Test" was created by an integration test's `afterAll` cleanup,
         but confirm no test data survived a failed/interrupted test run
         (check for orphaned rows: places with `Test` in the name, users
         with `test-` email prefixes beyond the three intentional seed
         accounts)
   - [ ] Confirm the Ghana emergency numbers and phrasebook data are
         still accurate — re-verify against an authoritative source per
         D29's own recommendation, since time has passed since the
         original web-search verification
3. **Run `npx prisma migrate deploy` (not `migrate dev`)** against
   production — `deploy` applies existing migrations without prompting
   or attempting to generate new ones, which is the safe production mode.
4. **Verify `_prisma_migrations` table state** matches what's expected —
   if the drift issues encountered during development (the manual SQL
   baseline migration, the BOM encoding issue) affected this database,
   confirm `prisma migrate status` reports clean before deploying application code.

## Phase D — Deploy

1. Push to the branch Vercel is configured to deploy from (or trigger a manual deploy).
2. Watch the build logs — `npm run build` runs `next build`, which will
   fail loudly on any TypeScript error. This is a genuine safety net: if
   something doesn't compile, it doesn't deploy.
3. **Do not run `npm run seed` against production** as a routine deploy
   step — it's a development/staging tool. If it's ever needed against
   production (e.g. adding a new launch city's geography), run it
   manually, once, deliberately, watching its output — never as part of
   an automated CI/CD pipeline.

## Phase E — Post-deploy verification

Walk through the same manual checklist used throughout development,
against the real production URL:
- [ ] `GET /api/health` returns `{"status":"ok"}`
- [ ] Register a real account, log in, log out
- [ ] `/explore` search returns results (assuming place data exists for the launch city)
- [ ] `/emergency` shows real numbers with working `tel:` links (test this on an actual phone, not just a desktop browser — `tel:` links behave differently across devices)
- [ ] Admin login → `/admin` and each of the 9 admin sub-pages load without error for a SUPER_ADMIN account
- [ ] Attempt an action that should be denied (e.g. visit `/admin` while logged in as a TOURIST account) and confirm it's actually denied
- [ ] Check Vercel's function logs for any unexpected errors in the first hour of real traffic

## Phase F — Ongoing operations

- **Monitoring:** Vercel provides basic request/error metrics out of the
  box. For anything beyond that (spec Section 81's "structured logs,
  error tracking, performance monitoring"), integrate a dedicated service
  (Sentry for error tracking is a common, low-effort addition to a
  Next.js project) — not built in this project yet, tracked as a gap.
- **Backups:** confirmed via Supabase's PITR (Phase B, step 2) — document
  the actual restoration procedure once, by testing it against a
  non-production database, before you ever need it for real (spec
  Section 102's "document backup frequency, retention, restoration
  procedure" — the restoration procedure is only real once it's been
  tried, not just written down).
- **Secret rotation:** establish a routine (e.g. quarterly) for rotating
  API keys and database credentials, not just doing it once at launch.
- **Dependency updates:** the Prisma major-version upgrade notice seen
  repeatedly during development (5.22.0 → 8.0.0) should be revisited
  deliberately once Prisma 8 reaches a stable (non-RC) release — as its
  own planned upgrade task with a test pass, not an incidental `npm i` in
  the middle of unrelated work.

## Rollback plan

- Vercel keeps previous deployments available — reverting application
  code is a one-click "promote to production" on a prior deployment in
  the Vercel dashboard.
- Database rollback is harder: Prisma migrations in this project so far
  have all been additive (new tables/columns, no destructive changes).
  If a future migration is destructive, write and test its down-migration
  path before deploying it, or take a manual Supabase backup immediately
  before applying it.
- If a bad deploy is already affecting users, prioritize reverting the
  application code first (fast, safe) — only attempt database-level
  rollback if the application-code revert doesn't resolve the issue.
