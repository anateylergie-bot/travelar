# BUILD_MASTER_CHECKLIST.md

Status values: NOT STARTED | IN PROGRESS | IMPLEMENTED | TESTING | BLOCKED | VERIFIED

**A feature is only ever marked VERIFIED after it has been run against a real
database in a real environment and its tests pass there.** Phases 1-4 have
all been run against a live Supabase Postgres instance: migrations applied
cleanly, PostGIS/pg_trgm enabled, and all 94 tests (unit + integration)
pass with test files running sequentially (see DECISIONS.md D16). Manual
UI/HTTP-route verification is still pending — see notes below.

## PHASE 1 — FOUNDATION

| Feature | Status | Notes |
|---|---|---|
| Project structure (Next.js + TS) | VERIFIED | `npm install` + `npm run dev` path confirmed working |
| Environment config (.env.example, dev/staging/prod) | VERIFIED | Supabase pooled + direct URL pattern confirmed working |
| PostgreSQL schema (User, Role, Session, AuditLog, etc.) | VERIFIED | `prisma migrate dev` applied cleanly against live Supabase DB |
| Password hashing (bcrypt) | VERIFIED | Unit + integration tests pass against real DB |
| Session management (DB-backed, revocable) | VERIFIED | Integration tests confirm issuance, resolution, and revocation |
| CSRF protection | IMPLEMENTED | Origin-check logic in place; not yet exercised by an automated test |
| Rate limiting (auth endpoints) | IMPLEMENTED | Unit-tested in isolation; still single-instance-only, see SECURITY.md |
| Brute-force / login-attempt tracking | IMPLEMENTED | Logic in place; not yet exercised by an automated test |
| RBAC (roles + permission checks) | VERIFIED | 10 RBAC unit tests pass |
| Structured error handling | VERIFIED | 5 error-handling unit tests pass |
| Structured logging (redacts secrets) | IMPLEMENTED | No automated test yet confirming redaction fires correctly |
| Audit logging (login, role changes) | IMPLEMENTED | Write path exists and is called from routes; not yet asserted in a test |
| Core UI shell (home, login, register) | IMPLEMENTED | Not yet manually clicked through in a browser — pending |
| Admin foundation (protected route, user list) | IMPLEMENTED | Not yet manually verified (SUPER_ADMIN sees list / TOURIST denied) — pending |
| Health check endpoint | IMPLEMENTED | Not yet manually hit — pending |
| Testing framework (Vitest) | VERIFIED | 30/30 tests passing against live DB |
| Feature flag system | IMPLEMENTED | No test yet; not exercised by any route in Phase 1 |
| Documentation set | IMPLEMENTED | Complete for Phase 1 scope |

## PHASE 2 — LOCAL DATA ENGINE

| Feature | Status | Notes |
|---|---|---|
| Country/Region/City/Neighborhood models | VERIFIED | Migrated successfully; seed script created Ghana + 8 cities |
| Category model (self-referencing, extensible) | VERIFIED | Seed script created 33 baseline categories |
| Place model (full field set per Section 16) | VERIFIED | Integration tests create/read real rows |
| Verification status enum (11 statuses, Section 17) | VERIFIED | Exercised in integration tests (DRAFT on creation) |
| Source / PlaceSource models (Section 18) | IMPLEMENTED | Schema verified via migration; not yet exercised by a test (no route creates Source records yet — arrives with Phase 3 agent attribution) |
| PlaceChangeHistory (append-only, Section 32) | VERIFIED | Integration test confirms a history row is written on place creation |
| Geospatial nearby search (PostGIS) | VERIFIED | Manual SQL migration run confirmed; integration test confirms correct radius inclusion/exclusion |
| Duplicate detection engine (name/distance/phone/website scoring) | VERIFIED | 16 unit tests + 1 integration test (real near-duplicate scored >70) all pass |
| Admin geography endpoints (create country/region/city/neighborhood) | IMPLEMENTED | Service layer VERIFIED via seed script + integration tests; HTTP routes not yet manually hit |
| Category admin endpoint | IMPLEMENTED | Service layer VERIFIED via seed script; HTTP route not yet manually hit |
| Public place search API | IMPLEMENTED | Underlying `findNearbyPlaces` VERIFIED; HTTP route (`GET /api/places`) not yet manually hit |
| Place create API | IMPLEMENTED | Underlying `createPlace` VERIFIED; HTTP route (`POST /api/places`) not yet manually hit |
| Ghana launch geography + baseline categories seed data | VERIFIED | Seed ran successfully: Ghana + 8 cities + 33 categories confirmed created |
| Unit tests (duplicate-detection math) | VERIFIED | 16/16 pass |
| Integration tests (geography, place creation, geospatial search, duplicate flagging) | VERIFIED | 7/7 pass against live Supabase + PostGIS |

Not started in Phase 2 (deferred to later phases per spec):
Task assignment, agent submission workflow, field verification UI, GPS
capture, photo upload/moderation, wallet/rewards, business claims, admin
moderation-queue UI, tourist-facing search UI (the API exists; no page
consumes it yet).

## PHASE 3 — AGENT PLATFORM

| Feature | Status | Notes |
|---|---|---|
| Agent application (apply) | VERIFIED | Integration test confirms role is NOT granted on apply |
| Agent approval workflow | VERIFIED | Integration test confirms role grant + reputation row creation |
| Agent rejection workflow | IMPLEMENTED | Service logic only exercised indirectly; no dedicated test yet |
| Training modules (16, matching Section 20) | VERIFIED | Seeded and queried successfully in integration test; confirmed via `npm run seed` against live DB |
| Training completion tracking + gating enforcement | VERIFIED | Integration test confirms submission is blocked pre-training and allowed post-training |
| Task model + creation (7 types) | VERIFIED | FIELD_VERIFICATION and CONTACT_VERIFICATION types exercised; other 5 types implemented but not individually tested |
| Task assignment (accept) | VERIFIED | |
| Task rejection by agent (no reputation penalty) | VERIFIED | Integration test confirms reputation is unchanged after rejection |
| Field verification checklist (Section 25) | VERIFIED | |
| GPS evidence capture | VERIFIED | Stored and asserted in integration test |
| Photo evidence upload | IMPLEMENTED | Storage adapter logic not yet exercised by an automated test (no test file attached in the lifecycle test) — still NOT production-ready regardless, see D13 |
| Submission review (approve/reject/needs-more-info) | VERIFIED | APPROVED path fully tested (Place update, reputation, change history); REJECTED/NEEDS_MORE_INFO paths implemented but not individually tested |
| Agent reputation (accuracy score + 5 levels) | VERIFIED | 11 unit tests + integration test confirm real calculation from actual submission outcomes |
| Agent dashboard page | IMPLEMENTED | Not yet manually viewed in a browser |
| New RBAC permissions (agents.manage, tasks.manage, tasks.review) | VERIFIED | Exercised throughout the integration test via service-layer calls |
| Unit tests (reputation math) | VERIFIED | 11/11 pass |
| Integration tests (full apply→approve→task→train-gate→submit→review→reputation lifecycle) | VERIFIED | 9/9 pass against live Supabase DB |

Explicitly NOT built in Phase 3 (deferred per spec):
Wallet/earnings (Phase 4 — Section 34 forbids paying "simply because a form
was submitted," so no ledger exists until reward rules do), business claim
system (Phase 5), City Data Lead role/permissions (mentioned in spec
Section 40 but no elevated capability beyond LOCAL_DATA_AGENT is granted
yet), smart task-assignment ranking beyond simple city/category filters,
low-connectivity/offline submission queueing (Section 63 — a real gap,
tracked, not faked), automated field-level Place updates for non-terminal
task types (see D12).

## PHASE 4 — REWARDS

| Feature | Status | Notes |
|---|---|---|
| Reward rules (configurable, never hard-coded) | VERIFIED | Integration test confirms rule amount flows through to actual earning |
| Wallet (pending/approved/paid/reversed) | VERIFIED | Full balance lifecycle asserted at every stage |
| WalletTransaction ledger (append-only) | VERIFIED | |
| Earning creation on submission approval | VERIFIED | |
| Two-stage earning approval (review → finance confirm) | VERIFIED | Including rejection of over-confirmation |
| Fraud status heuristic (NORMAL/REVIEW/SUSPENDED) | VERIFIED | 7 unit tests; integration test confirms SUSPENDED blocks payout requests |
| Payout request + configurable minimum/currency | VERIFIED | Both rejection paths (below minimum, unsupported currency) confirmed |
| Payout processing (PAID with reference / FAILED with reversal) | VERIFIED | Both paths confirmed, including reference requirement and balance reversal on failure |
| Payout provider abstraction | IMPLEMENTED | Exercised indirectly (called, ignored per D21) — no dedicated test of the interface itself |
| Manual bonus/adjustment (always requires a reason) | IMPLEMENTED | Used as test scaffolding in the integration test; not directly asserted via its own test case |
| New RBAC permissions (rewards.manage, earnings.approve, payouts.manage) | IMPLEMENTED | Exercised via service-layer calls in integration test, not yet via HTTP with role checks |
| Agent dashboard earnings display | IMPLEMENTED | Not yet manually viewed in a browser |
| Unit tests (fraud thresholds, money formatting) | VERIFIED | 11/11 pass |
| Integration tests (full reward→confirm→payout→PAID/FAILED lifecycle, minimum/currency validation, fraud gate) | VERIFIED | 10/10 pass against live Supabase DB |

Explicitly NOT built in Phase 4 (deferred/out of scope, tracked not faked):
Real payment provider integration (Mobile Money API, bank transfer API —
no credentials exist; the abstraction is ready for them), percentage-based
payout fees (flat fee only), payment schedules/batching (Section 38
mentions "payment schedules" — payouts are on-demand per request, not
batched), reconciliation job to detect ledger/cache drift (see D18),
admin UI for reward rules/payouts (API only).

## PHASE 5 — BUSINESS SYSTEM

| Feature | Status | Notes |
|---|---|---|
| Business claim submission | VERIFIED | Integration test confirms role NOT granted on submission |
| Claim review (approve/reject) | VERIFIED | Role grant, ownership, OWNER_VERIFIED status, and full audit trail confirmed |
| One-owner-per-place enforcement | VERIFIED | |
| Business update requests (owner-submitted) | VERIFIED | Non-owner rejection and allowlist rejection both confirmed |
| Update request review (moderated, never instant) | VERIFIED | Diff application, per-field change history, and reject-leaves-unchanged all confirmed |
| Business owner dashboard page | IMPLEMENTED | Not yet manually viewed in a browser |
| New RBAC permissions (business.claims.review, business.updates.review, business.updates.submit) | VERIFIED | Exercised via service-layer calls in integration test |
| Unit tests (update field allowlist validation) | VERIFIED | 6/6 pass |
| Integration tests (full claim→approve→update-request→approve/reject lifecycle, ownership/duplicate/allowlist rejections) | VERIFIED | 9/9 pass against live Supabase DB |

Explicitly NOT built in Phase 5 (deferred, tracked not faked):
Real identity/ownership verification (D22 — evidence is free-text judged
by a human, no document upload or business-registry API), dispute
resolution for competing claims (D24), photo updates via this path (goes
through the agent evidence pipeline instead), listing-view analytics
(Section 80), the tourist-facing "report incorrect information" system
that would feed the "Reports" section of the business dashboard (Phase 6).

## PHASE 6 — TOURIST PLATFORM

| Search (geospatial "nearby" mode) | VERIFIED | Extended in this phase with name query, openNow filter, confirmed via integration test |
| Search (non-geospatial browse-by-city/category mode) | VERIFIED | |
| Open-now filtering | VERIFIED | 9/9 unit tests pass covering same-day/overnight/malformed/timezone-offset cases — see D26 |
| Sort: distance / freshness / name | IMPLEMENTED | Exercised indirectly; no dedicated sort-order test written |
| Place detail page | IMPLEMENTED | Not yet manually viewed in a browser |
| Get Directions (Google Maps deep link) | IMPLEMENTED | Not yet exercised by an automated test (trivial URL construction, low risk) |
| Saved places (bookmarks) | VERIFIED | Save/unsave/list and idempotent double-save all confirmed |
| Tourist incorrect-information reports | VERIFIED | |
| Report review -> real verification Task creation | VERIFIED | Correct task-type mapping and linkage confirmed |
| Report manual resolution | VERIFIED | |
| Minimal `/explore` and `/places/[id]` UI pages | IMPLEMENTED | Not yet manually clicked through in a browser |
| New RBAC permission (reports.review) | VERIFIED | |
| Unit tests (open-now logic) | VERIFIED | 9/9 pass |
| Integration tests (search modes, saved places, report->task pipeline, unmappable-reason rejection) | VERIFIED | 7/7 pass against live Supabase DB |

Explicitly NOT built in Phase 6 (deferred, tracked not faked):
Embedded interactive map (needs a real Maps JS API key — D27), review/
rating system (so no "top rated" sort or star ratings anywhere — D28),
listing-view analytics, real per-place timezone support for open-now
(D26), offline/cached search (Phase 8).

## PHASE 7 — BROWSER
**DEFERRED — out of scope for this codebase, by deliberate agreement with the user.**
Spec Section 5 calls for a Chromium/Electron desktop shell, a Chromium-based
Android app, and a WKWebView-constrained iOS app — three native
application projects, not a Next.js web feature. Building these requires
separate native tooling, build pipelines, and platform-specific testing
that don't fit inside this repository. `docs/ARCHITECTURE.md` already
records the intended technology choices for when that work starts
(Electron for desktop with hardened config, Chromium WebView for Android,
WKWebView for iOS). Nothing in Phase 7 (secure browsing, Travel Mode,
tracker protection, phishing warnings, download protection, permission
centre) has been built. The Tourist Web Platform (Phases 2/6) is designed
to be the content such a browser shell would eventually embed.

## PHASE 8 — TRAVEL SERVICES

| Feature | Status | Notes |
|---|---|---|
| Emergency numbers (Ghana) | VERIFIED | Real numbers, sourced and cited (D29); source-required validation confirmed, seeded and live in your database |
| Emergency number admin management | VERIFIED | Upsert-not-duplicate behavior confirmed via integration test |
| Emergency Mode page | IMPLEMENTED | Not yet manually tested in a browser |
| Safety alerts (admin-curated) | VERIFIED | Country-wide/city-specific/expired filtering all confirmed — including the Prisma `undefined`-vs-`null` bug fix |
| Travel phrasebook | VERIFIED | Seeded successfully; confirmed translations remain empty (D30) |
| Currency conversion | VERIFIED | Confirmed it always fails rather than fabricating a rate (D31) |
| Offline data package export | VERIFIED | Confirmed via integration test |
| New RBAC permissions (emergency_numbers.manage, safety_alerts.manage) | VERIFIED | |
| Unit tests (currency provider never fabricates a rate) | VERIFIED | 2/2 pass |
| Integration tests (emergency numbers, safety alert filtering incl. the bug fix, phrasebook, offline package) | VERIFIED | 9/9 pass against live Supabase DB |

Explicitly NOT built in Phase 8 (deferred, tracked not faked):
Real translation-provider integration (D30), real exchange-rate provider
integration (D31), automated weather/government-alert ingestion (D32 —
alerts are human-curated only), a true offline-sync engine with conflict
resolution (only a data export exists), location auto-detection on the
Emergency page (hardcoded to look up Ghana by ISO code).

## PHASE 9 — AI
**DEFERRED at user's request — no AI provider API key available yet.**
Building the AI Tourist Assistant (Section 44-46, 96-98) with a real
model call requires a configured provider key; without one, anything
built would either be non-functional or fabricate responses, both of
which the spec explicitly forbids (Section 96: "the AI must not invent
businesses... when uncertain, say so"). Revisit once a key is available —
the data-priority hierarchy (Section 97: verified platform data first)
and prompt-injection defense (Section 98) can be designed properly at
that point, grounded in what this project already has: Phase 2's
verification statuses and Phase 6's search, ready to be the "verified
platform data" tier of that hierarchy.

## PHASE 10 — GLOBAL SCALE

| Feature | Status | Notes |
|---|---|---|
| Country default currency/language fields | IMPLEMENTED | Additive schema fields; not yet surfaced anywhere in the UI |
| B2B API key model (hashed, scoped, rate-limited) | IMPLEMENTED | Mirrors the Phase 1 session-token hashing pattern — see D34 |
| API key admin management (create/list/revoke) | IMPLEMENTED | Raw key shown exactly once at creation, never recoverable after |
| Versioned external API (`/api/v1/places`, `/places/:id`, `/categories`, `/geography/countries`, `/geography/cities`) | IMPLEMENTED | Deliberately scoped to this new surface, not a retrofit of internal routes — see D33 |
| Per-key scopes and rate limiting | IMPLEMENTED | Each key's scope checked independently of "is this key valid"; rate limit tracked per key, separate from the anonymous IP limiter |
| City data coverage targets + dashboard (Section 90) | IMPLEMENTED | Real target/current/verified/gap computed from actual Place rows, not fabricated; a city with no configured targets returns an empty list, not zeros |
| i18n architecture (locale dictionary + `t()` helper) | IMPLEMENTED | English fully populated; NOT wired into existing UI pages — see D35 |
| New RBAC permissions (api_keys.manage, coverage_targets.manage) | IMPLEMENTED | |
| Unit tests (i18n lookup/fallback, bearer-token extraction) | IMPLEMENTED | 9 tests, no DB needed |
| Integration tests (full API key lifecycle incl. scope/revocation/rate-limit-adjacent usage tracking, coverage dashboard against real place counts) | IMPLEMENTED | Written; requires live DB run |

Explicitly NOT built in Phase 10 (deferred, tracked not faked):
Retrofitting existing internal routes to a versioned scheme (D33), non-
English translation content (D35), wiring i18n into any existing page,
a UI for API key management or coverage targets (API only), true
multi-currency *display* logic in the tourist-facing UI (the data model
supports it; the UI still assumes GHS/English throughout).

## POST-PHASE-10 ADDITION — Admin UI for previously API-only surfaces

Real admin UI pages were added for every area that previously required
curl/Postman: Reward Rules, Payouts, Business Claims, Business Updates,
Reports, Emergency Numbers, Safety Alerts, API Keys, and Coverage
Targets — each gated by the same permission the underlying API already
enforces, consuming the same service functions (no new schema, no new
migration needed for this batch). See `docs/PRODUCTION_READINESS_PLAN.md`
and `docs/DEPLOYMENT_RUNBOOK.md` for the planning/deployment work done
alongside this. Status: IMPLEMENTED, not yet manually clicked through in
a browser.

---
Last updated: Phase 9 (AI) formally deferred pending an API provider key; Phase 10 (Global Scale) implementation added, plus post-Phase-10 admin UI and planning docs — pending your live-DB test run and a browser click-through of the new pages.
