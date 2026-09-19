# ARCHITECTURE.md

## Overview
The platform is built as a modular monolith on Next.js (App Router) for
Phase 1–6, with clear internal boundaries (`src/lib/<domain>`) so pieces can
be extracted into separate services later without a rewrite. This matches
the spec's instruction not to over-engineer microservices before there's
load that requires them, while still avoiding a "big ball of mud."

## Layers (mapped to spec Section 4)

- **Layer A (Consumer Browser):** Out of scope for Phase 1–6. Per spec
  Section 5, this will be a Chromium-based native shell (Electron on
  desktop, Chromium-based WebView on Android, WKWebView-constrained
  implementation on iOS). Architecture decision deferred to Phase 7;
  the web platform (Layer B) is built first so browser chrome can embed
  it as the "new tab" / discovery surface.
- **Layer B (Tourist Web Platform):** Next.js app routes under `src/app/`.
- **Layer C (Local Data Agent Platform):** Phase 3. Will live under
  `src/app/agent/` and `src/lib/agent/`.
- **Layer D (Verification Engine):** Phase 2–3. `src/lib/verification/`.
- **Layer E (Administrative Platform):** `src/app/admin/` + `src/lib/admin/`.
  Phase 1 ships only a minimal user list as the foundation.
- **Layer F (Data Infrastructure):** PostgreSQL + Prisma. PostGIS added
  in Phase 2 migration when Place/geospatial models are introduced.

## Phase 1 Technology Choices

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router), TypeScript | Single deployable for web UI + API in early phases |
| ORM | Prisma | Type-safe schema, migration tooling, works with PostGIS via raw SQL extensions later |
| Database | PostgreSQL 15+ | Required for PostGIS in Phase 2; strong constraint/transaction support |
| Password hashing | bcryptjs | Pure JS — no native compilation step required in constrained build environments |
| Sessions | DB-backed opaque tokens, HttpOnly+Secure+SameSite cookies | Enables server-side revocation/listing (spec 8), avoids JWT revocation problems |
| Validation | Zod | Compile-time + runtime schema validation at every API boundary |
| Logging | Pino | Structured JSON logs, redaction support |
| Testing | Vitest | Fast, TS-native, Jest-compatible API |
| Rate limiting | In-memory token bucket (dev), documented Redis upgrade path | No Redis instance assumed available yet; see DECISIONS.md |

## Directory Structure

```
tourist-platform/
  prisma/
    schema.prisma
  src/
    app/                      # Next.js routes (UI + API)
      api/
        auth/{register,login,logout,me}/route.ts
        health/route.ts
      admin/page.tsx
      login/page.tsx
      register/page.tsx
      layout.tsx
      page.tsx
    lib/
      auth/                   # password hashing, session issuance/validation
      rbac/                   # role/permission model + guards
      errors/                 # structured AppError + API error formatting
      logging/                # pino instance + redaction config
      rateLimit.ts
      csrf.ts
      db.ts                   # Prisma client singleton
      featureFlags.ts
    components/
  tests/
    unit/
    integration/
  docs/
```

## Request Flow (Phase 1 example: login)

1. Client POSTs `{email, password}` to `/api/auth/login`.
2. Route handler validates body shape with Zod → 400 on failure.
3. Rate limiter checks IP+email bucket → 429 on abuse.
4. `lib/auth` looks up user, verifies bcrypt hash, checks account status.
5. On failure: record `LoginAttempt`, return generic "invalid credentials"
   (never reveal whether the email exists).
6. On success: create `Session` row (hashed token stored, raw token only
   ever sent to client), set HttpOnly cookie, write `AuditLog` entry,
   return user + roles (no password hash, ever).

## Why not JWT-only sessions
JWTs can't be individually revoked without an allow/deny-list, which
defeats the purpose. Spec Section 8 explicitly requires device/session
management (list and revoke sessions) — a DB-backed session table is the
straightforward way to support that from day one.

## Browser Engine Decision (Section 5) — deferred, recorded here for continuity
- **Desktop:** Electron with a hardened configuration (context isolation on,
  node integration off in renderers, strict CSP) wrapping Chromium, OR a
  more native Chromium Embedded Framework integration if lower overhead is
  required later. Final choice deferred to Phase 7 kickoff.
- **Android:** Chromium-based WebView / Trusted Web Activity wrapping the
  Tourist Web Platform, with native modules for GPS/camera/notifications.
- **iOS:** Must use WKWebView per App Store policy (Apple prohibits
  third-party browser engines using custom engines like Chromium as of
  current App Store review guidelines for standard apps). This constrains
  some "full browser" features on iOS; documented as a platform limitation,
  not something to work around by misrepresenting capability.

## Non-goals for Phase 1
No Places, no geospatial data, no agents, no rewards, no AI, no browser
shell. Phase 1 is auth + RBAC + admin foundation only, per spec Section 117.

## Phase 2 additions — Local Data Engine

- **Geographic hierarchy:** `Country -> Region -> City -> Neighborhood`,
  each a real table (not an enum), so new countries/cities can be added
  by an admin at runtime (spec Section 88/89) without a code change.
- **Categories:** self-referencing `Category` table (`parentId`), so new
  categories/subcategories don't require a schema migration (Section 15).
- **Place:** the central entity, per Section 16's full field list.
  `latitude`/`longitude` are plain floats — the single source of truth for
  coordinates (see DECISIONS.md D9 for why there's no separate PostGIS
  geography column).
- **Geospatial search:** `src/lib/places/geo.ts` builds parameterized raw
  SQL using PostGIS `ST_DWithin`/`ST_Distance` against a computed
  geography cast, backed by a functional GiST index. This requires running
  `prisma/manual-sql/001-postgis-and-constraints.sql` once, after the
  Prisma migration — see DEPLOYMENT.md.
- **Duplicate detection:** `src/lib/places/duplicateDetection.ts` holds
  pure, DB-free scoring functions (Haversine distance, Levenshtein-based
  name similarity, phone/website normalization). `duplicateService.ts`
  wraps these with a DB-backed candidate lookup (nearby places within
  500m). Per spec Section 24, this only ever produces a score + reasons
  for human review — it never auto-merges or auto-rejects.
- **Sources & change history:** `Source`/`PlaceSource` make every claim on
  a place traceable to who/what said it (Section 18). `PlaceChangeHistory`
  is append-only — nothing overwrites a field without a history row
  (Section 32).
- **New permissions:** `geography.manage`, `categories.manage`,
  `places.create` — see `src/lib/rbac/roles.ts`. Full agent task-assignment
  workflow (Section 21-23) is Phase 3; Phase 2's `places.create` endpoint
  is the direct-creation primitive that workflow will eventually call.

## Phase 3 additions — Agent Platform

- **Application/approval split:** `LocalDataAgentProfile` tracks the
  application; approving it (via `approveAgentApplication`) is a separate,
  admin-gated step that grants the `LOCAL_DATA_AGENT` role and creates the
  `AgentReputation` row — see DECISIONS.md D15.
- **Training:** `TrainingModule` holds real (if condensed) content per
  Section 20's 16-module list, each optionally gating specific `TaskType`s.
  `hasCompletedRequiredTraining()` is enforced inside `submitTask()` — not
  just checked in the UI, per Section 84.
- **Tasks:** `Task` covers all 7 types from Section 21. Assignment is
  currently a simple "any agent can accept an OPEN task" pool — Section 22
  lists richer factors (skill, workload, distance, reputation); that
  ranking logic doesn't exist yet and is a documented follow-up, not
  something silently skipped.
- **Task rejection vs. submission rejection:** two distinct states,
  deliberately not conflated — see DECISIONS.md D14.
- **Submissions & evidence:** `TaskSubmission` holds the Section 25
  checklist as structured booleans (not free text) plus GPS fields.
  `Evidence` (photos) goes through a `PhotoStorageProvider` interface
  (`src/lib/storage/`) with one adapter — local filesystem, dev-only, not
  production-ready (see DECISIONS.md D13). Swapping in a real
  S3-compatible adapter (e.g. Supabase Storage) means implementing the
  same interface; nothing else changes.
- **Review → Place updates:** `reviewSubmission()` in
  `src/lib/agent/review.ts` is the bridge between the agent workflow and
  Phase 2's Place records. See DECISIONS.md D12 for exactly which task
  types get a real, automated Place field update on approval versus just
  a recorded verification event.
- **Reputation:** `src/lib/agent/reputation.ts` computes accuracy and
  level purely from real `TaskSubmission.reviewStatus` rows — recalculated
  after every review, never manually set (mirrors spec Section 157's
  "never fake earnings" principle, applied to reputation).

## Phase 4 additions — Rewards

- **Never hard-coded amounts:** `RewardRule` (one row per
  `RewardActivityType`) is the only source of payment amounts. If no
  active rule exists for an approved task's activity, no earning is
  created — a safe default, not a bug (spec Section 34).
- **Ledger-first wallet:** `Wallet`'s four balance fields
  (pending/approved/paid/reversed) are cached aggregates; the
  `WalletTransaction` table is the real source of truth. Every function in
  `src/lib/rewards/wallet.ts` that changes a balance writes both the
  ledger row and the cache update inside one `db.$transaction` — see
  DECISIONS.md D18.
- **Two-stage approval:** Phase 3's submission review (data quality) is
  separate from Phase 4's earning confirmation (payability) — see D19.
  `reviewSubmission()` in `src/lib/agent/review.ts` only ever creates
  `EARNING_PENDING`; moving to `EARNING_APPROVED` requires a distinct
  `earnings.approve`-permitted action.
- **Fraud gating, not fraud accusation:** `evaluateFraudStatus()` in
  `src/lib/rewards/fraudStatus.ts` is recalculated alongside reputation
  after every review. `SUSPENDED` blocks new earnings and payout requests
  only — see D20.
- **Payout abstraction:** `src/lib/payments/PayoutProvider.ts` defines the
  interface; `manualPayoutProvider.ts` is the only implementation and
  never actually moves money (see D21) — a Finance Administrator asserts
  they completed the transfer externally and records a reference.
  Swapping in a real Mobile Money/bank API means implementing the same
  interface; the request/ledger/audit workflow around it doesn't change.
- **Money as integers:** every amount field is `Int` minor units (D17) —
  never a float, anywhere in the money-handling code path.

## Phase 5 additions — Business System

- **Claim -> human review -> owner:** `src/lib/business/claims.ts` mirrors
  Phase 3's agent application/approval split — submitting a claim never
  grants `BUSINESS_OWNER` by itself. Approval sets `Place.ownerUserId`,
  promotes `verificationStatus` to `OWNER_VERIFIED`, and records a
  `Source`/`PlaceSource`/`PlaceChangeHistory` trail, all inside one
  transaction.
- **No identity documents collected:** see DECISIONS.md D22 — claim
  evidence is a free-text description a human judges, not an uploaded ID
  or business registration document. A real verification-provider
  integration is future work, not simulated here.
- **Update requests always moderated:** `src/lib/business/updates.ts`
  never applies an owner's proposed change directly to `Place` — it
  creates a `BusinessUpdateRequest` that a Moderator/Data
  Manager/Super Admin must approve, at which point the diff is applied
  and every changed field gets its own `PlaceChangeHistory` row (D23).
- **Field allowlist, checked server-side:** owners can only propose
  changes to a fixed set of fields (`phone`, `whatsapp`, `email`,
  `website`, `description`, `openingHours`, `priceRange`,
  `paymentMethods`, `services`, `amenities`) — anything else (including
  `verificationStatus`, coordinates, or `ownerUserId` itself) is rejected
  before it ever reaches a reviewer, closing an obvious
  privilege-escalation path.
- **Ownership checked independently of role:** holding `BUSINESS_OWNER`
  is necessary but not sufficient — `submitUpdateRequest()` separately
  verifies `place.ownerUserId === callingUser.id` (spec Section 84).

## Phase 6 additions — Tourist Platform

- **Search has two modes:** `src/lib/tourist/search.ts` branches on
  whether lat/lng are given. Geospatial mode reuses Phase 2's
  `findNearbyPlaces` (now extended with a name filter); non-geospatial
  mode is a plain Prisma query for browsing by city/category without a
  location — e.g. planning a trip before arriving.
- **Open-now is a post-filter, not a SQL WHERE clause:** `isOpenNow()` in
  `src/lib/tourist/openingHours.ts` is a pure function evaluated in
  application code after fetching candidates (over-fetching 3x when
  `openNow=true` is requested, to keep enough results after filtering).
  This was simpler and more testable than expressing the day/time logic
  in raw SQL, at the cost of not being index-accelerated — acceptable at
  current data volume, worth revisiting if it becomes a bottleneck.
- **Reports feed real Tasks, not a parallel fix-it system:** see
  DECISIONS.md D25. `src/lib/tourist/reports.ts` maps each `ReportReason`
  to a `TaskType` (or `null` for reasons that need direct human judgment,
  like duplicates or offensive content) and calls Phase 3's existing
  `createTask()` — meaning a report, once actioned, flows through the
  exact same agent-verification and Place-update pipeline as any other
  task.
- **Directions vs. maps:** `getDirectionsUrl()` is a real, working
  feature requiring no API key (D27); an embedded interactive map is
  separate, documented, unbuilt scope requiring a real Maps provider key.

## Phase 7 (Browser) — deferred by agreement

Not built in this codebase. See BUILD_MASTER_CHECKLIST.md for the full
rationale: it requires native Electron/Chromium-WebView/WKWebView
projects outside this Next.js repo. The technology choices are still
recorded above ("Browser Engine Decision") for whenever that work starts.

## Phase 8 additions — Travel Services

- **Emergency numbers are sourced, not recalled:** unlike most seed data
  in this project (which is either structurally generic or created via
  the app's own workflows), Ghana's emergency numbers required an
  external fact check before being trusted as seed data — see
  DECISIONS.md D29. The `sourceDescription` field is mandatory at the
  schema-validation level, not just a convention.
- **Currency and translation follow the same "real interface, honest
  gap" pattern as storage (D13) and payouts (D21):** `CurrencyProvider`
  and the (unbuilt) translation-provider slot exist as abstractions ready
  for a real integration; today they either don't function
  (`UnavailableCurrencyProvider` always throws) or only carry English
  content (the phrasebook). Neither pretends to do more than it does.
- **Safety alert city/country-wide filtering caught a real Prisma
  gotcha during development:** passing `undefined` into a Prisma `where`
  filter means "don't filter on this field" — not "match null." An
  earlier draft of `listActiveSafetyAlerts()` would have silently
  ignored the city filter entirely. Fixed by building the city condition
  explicitly rather than passing the raw parameter through. Worth
  remembering for any future filter that mixes "specific value" and
  "global/null" semantics.

## Phase 9 (AI) — deferred by agreement

Not built. No AI provider API key is configured in this environment, and
building the assistant (Section 44-46) without one would mean either a
non-functional stub or, worse, a temptation to fabricate model responses
— both explicitly against spec Section 96. Revisit once a key is
available.

## Phase 10 additions — Global Scale

- **API versioning is scoped to the new external surface, not a
  retrofit** (D33): `/api/v1/*` is a small, deliberately curated,
  read-only set of endpoints for external consumers, authenticated by API
  key rather than session cookie. Internal routes (`/api/places`,
  `/api/agent/tasks`, etc.) are untouched.
- **API keys mirror the session-token security pattern from Phase 1**
  (D34): SHA-256 hash stored, raw value shown exactly once at creation.
  `requireApiKeyAccess()` is the single choke point every `/api/v1/*`
  route calls — it checks validity, revocation, expiry, scope, and rate
  limit in one place, so a new v1 endpoint can't accidentally skip a
  check by re-implementing this logic differently.
- **Coverage targets compute real numbers from real Place rows** —
  `getCityCoverageDashboard()` runs actual `count()` queries against the
  current data, never a cached or estimated figure. A city with zero
  configured targets returns an empty array, not a table of zeros that
  could be misread as "this city genuinely has zero of everything."
- **i18n ships as tested infrastructure, not UI-integrated yet** (D35):
  `src/lib/i18n/strings.ts` has real unit tests and real English content,
  but no existing page has been modified to call `t()` — that's future
  work, done deliberately separately from this phase to avoid touching
  already-verified UI without the ability to re-verify it visually.
