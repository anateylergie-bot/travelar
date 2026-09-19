# DECISIONS.md

Record of choices made where the spec allowed judgment, per Section 151
("choose the safest reasonable interpretation, document it").

## D1 — Framework: Next.js App Router
Chosen to serve web UI + API from one deployable in early phases, per
spec Section 5's "prefer React/Next.js where appropriate." Revisit if load
requires splitting API into a dedicated service.

## D2 — bcrypt over Argon2
Argon2's Node bindings (`argon2` npm package) require native compilation
at install time. In a network-isolated or restricted-build sandbox this
can fail outright. bcryptjs is pure JavaScript, has no build step, and is
still an industry-accepted password hashing algorithm. If your deployment
target can reliably compile native modules, switching to Argon2id is a
reasonable hardening step — tracked here as an open option, not a rejection.

## D3 — DB-backed sessions instead of stateless JWT
Spec Section 8 requires "device/session management" (list/revoke). JWTs
without a server-side revocation list can't be un-issued before expiry.
Chose opaque random tokens hashed with SHA-256 at rest, mirroring how
password reset/email verification tokens are handled.

## D4 — In-memory rate limiting for Phase 1
No Redis instance is assumed to exist yet. An in-memory limiter is
adequate for local dev and single-instance deployments but is explicitly
documented (SECURITY.md) as insufficient for a horizontally-scaled
production deployment. This is a known, tracked gap — not a claim that
rate limiting is production-ready.

## D5 — CSRF via Origin-header check, not yet double-submit tokens
Sufficient baseline for the two state-changing routes that exist in Phase
1 (register, login, logout). A double-submit CSRF token will be added when
non-auth forms (place submission, reports, etc.) are introduced, since
those will need it more than auth endpoints (which are also protected by
the fact that a successful CSRF forgery still requires already knowing the
victim's credentials to log in as them).

## D6 — Multiple roles per user, not a single role field
Spec lists role types as if mutually exclusive job titles, but real users
plausibly hold more than one (e.g. Business Owner + Local Data Agent).
Modeled roles as a many-to-many join table rather than a single enum
column on User.

## D7 — MFA architecture without enforcement in Phase 1
Spec Section 8 requires MFA for "sensitive administrator actions." No TOTP
library or SMS/authenticator delivery mechanism is wired up yet. Rather
than fake an MFA challenge, the schema has the fields (`mfaEnabled`,
`mfaSecret`) and the login code has an explicit checkpoint comment marking
where the challenge belongs, but the checkpoint is not yet enforced. This
is documented in SECURITY.md as a known gap, not silently skipped.

## D8 — Environment/network constraints during authoring
The initial Phase 1 code was written in a sandbox with no outbound network
access and no live PostgreSQL server (see PROJECT_AUDIT.md). All code was
written to be correct, but integration tests requiring a live DB could not
be executed by me before hand-off. This is disclosed rather than the
checklist being marked VERIFIED without evidence. (Phase 1 was
subsequently verified against a live Supabase database — see
BUILD_MASTER_CHECKLIST.md. Phase 2's integration tests have the same
constraint and are pending the same live verification.)

## D9 — On-the-fly geography casts instead of a stored `geography` column
Prisma's schema DSL has no first-class PostGIS type support (it would
require `Unsupported("geography(Point,4326)")` plus manual sync triggers
to keep it consistent with lat/lng). Instead, `latitude`/`longitude` stay
as plain `Float` columns — the single source of truth — and geospatial
queries cast them to `geography` at query time via raw SQL
(`ST_SetSRID(ST_MakePoint(lng,lat),4326)::geography`), backed by a
functional GiST index (see `prisma/manual-sql/001-postgis-and-constraints.sql`).
This avoids a second copy of the coordinates that could drift out of sync,
at the cost of a slightly more complex query. Revisit if query planner
behavior on the functional index proves inadequate at scale.

## D10 — Duplicate detection: scoring, never boolean, never auto-merge
Spec Section 24 explicitly forbids auto-merging uncertain matches. The
scorer in `duplicateDetection.ts` returns a 0-100 score plus human-readable
reasons — nothing in Phase 2 rejects a submission or merges a record based
on this score alone. The 250m distance / 60% name-similarity thresholds
and point weights (distance 40, name 40, phone 15, website 15, category 5)
are a reasonable starting heuristic, not a validated model — expect to
tune these once real submission data exists. The 70-point "strong match"
threshold used in `placeService.ts` only controls whether a
`PlaceChangeHistory` flag is written for later human review; it still
never blocks creation.

## D12 — Phase 3 scope: task review updates verification status generically, not a full field-diff engine
Spec Section 23's full pipeline (submit → validate → duplicate check →
automated review → risk scoring → human review → field verification →
approve → publish → reward) is described at a level that implies a mature
moderation system. Building a complete per-field diff/merge engine for
every task type (contact verification, location verification, photo task,
generic update) in one phase would either be superficial or take
disproportionate time relative to Phase 3's core goal (agent lifecycle +
reputation). Scoped decision: task review always writes a
`PlaceChangeHistory` entry and a `PlaceSource` attribution, and for the
task types where the spec gives a concrete outcome (FIELD_VERIFICATION →
`FIELD_VERIFIED` status + refreshed `lastVerifiedAt`/`nextReviewAt`;
CLOSURE → `CLOSED`; NEW_PLACE → creates the place via the existing Phase 2
`createPlace`), the place record is actually updated. For
CONTACT_VERIFICATION/LOCATION_VERIFICATION/UPDATE/PHOTO_TASK, Phase 3
records the verification event (source + history + reputation credit) but
does not yet attempt automated field-level updates — an admin still edits
the specific field. This is a real gap, tracked here rather than faked.

## D13 — Photo evidence: local filesystem adapter, not real object storage
No S3/GCS/equivalent credentials exist in this environment. Per spec
Section 152, built a `PhotoStorageProvider` interface with one adapter:
a local-filesystem implementation that writes into `public/uploads/` for
development only. This is **not production-ready** — it doesn't survive
redeploys on most hosts, isn't multi-instance safe, and does not strip
EXIF metadata (spec Section 27 asks for EXIF stripping; no image-processing
library was added because common options require native compilation,
same risk as D2's Argon2 decision). `Evidence.exifStrippedAt` is nullable
and stays null until that's implemented — a real object-storage adapter
(S3-compatible, e.g. Supabase Storage since you're already on Supabase) is
the natural next step before any real users upload real photos.

## D14 — Task rejection (by agent) vs. submission rejection (by reviewer) are different states
Spec Section 22 says agents can reject unsafe/unwanted task assignments;
Section 33 tracks a "rejection rate" as a reputation signal from
*reviewer* rejections of submitted work. Conflating these would
incorrectly penalize an agent's reputation for declining a task they
judged unsafe — exactly the outcome Section 91 warns against. Modeled as
two separate fields: `Task.status = REJECTED_BY_AGENT` (no reputation
effect) vs. `TaskSubmission.reviewStatus = REJECTED` (feeds reputation).

## D15 — Agent approval is a distinct step from applying
Spec Section 19 describes an "application process." Applying
(`POST /api/agent/apply`) does not itself grant the `LOCAL_DATA_AGENT`
role or `places.create` permission — an admin/data manager must approve
the application first. This matches Section 7's RBAC model (roles are
granted, not self-assigned) and Section 36's anti-fraud posture (don't
hand out task-assignment/earning-eligible capability on request alone).

## D16 — Integration tests must run with `fileParallelism: false`
Discovered while verifying Phase 3: Vitest's default parallel file
execution caused two integration test files (each hitting the same live
Supabase database over its pooled/PgBouncer connection) to intermittently
fail with "foreign key constraint violated" on rows that had, in fact,
just been committed by the other file's concurrent writes moments
earlier. This is a connection-pooling/session-visibility timing artifact
between concurrent Prisma clients sharing one transaction-mode pooler —
not a data-integrity bug in the application code. Confirmed by re-running
the exact same tests with `fileParallelism: false`: all 73 tests passed
with zero flakiness. The trade-off is a slower total test run (integration
tests now execute one file at a time); that's the right trade for tests
whose entire purpose is proving real behavior against a real database.

## D17 — Money stored as integer minor units, never floats
All monetary amounts (`RewardRule`, `WalletTransaction`, `Payout`) are
`Int` fields representing minor currency units (e.g. pesewas, not cedis) —
standard practice to avoid floating-point rounding errors compounding
across a ledger. A formatting helper converts to major units only for
display.

## D18 — Wallet balances are cached aggregates, recomputed transactionally from the ledger — never written directly
Spec Section 35: "never directly modify wallet balance without an
auditable transaction." Every balance change happens as: (1) write a
`WalletTransaction` row, (2) update the `Wallet` row's cached
pending/approved/paid/reversed totals, both inside the same
`db.$transaction`. There is no code path that updates `Wallet` without
also writing the ledger entry that justifies it. If the cached totals
and the ledger ever disagree, the ledger (sum of `WalletTransaction` rows)
is authoritative — a reconciliation job to detect drift is a reasonable
Phase 4+ follow-up, not built yet (no drift has ever been observed since
every write path is atomic, but "never observed" isn't "impossible").

## D19 — Two-stage earning approval: submission review, then a separate finance step
Reviewing a task submission (Phase 3) marks data as verified — it does
NOT by itself make an earning payable. Approval creates an
`EARNING_PENDING` ledger entry; a Finance Administrator (or Super Admin)
must separately confirm it via `POST /api/admin/wallet/confirm-earning`,
moving it to `EARNING_APPROVED` (now part of the payable balance). This
mirrors Section 37's role split (data reviewers vs. Finance Administrator)
and gives a second, independent checkpoint before money becomes
withdrawable — consistent with Section 127 ("never allow monetization to
compromise... data integrity") applied to the earnings side too.

## D20 — Fraud status is heuristic and advisory, gates payouts but never auto-accuses
Spec Section 36: "flag suspicious activity... do not automatically accuse
users of fraud." `AgentReputation.fraudStatus` (NORMAL/REVIEW/SUSPENDED) is
computed from crude signals (rejection rate, accuracy at volume) — the
exact thresholds are a starting point, not a validated fraud model.
`SUSPENDED` blocks new earnings from being created and blocks new payout
requests, but never reverses already-approved earnings automatically and
never labels the account "fraudulent" anywhere in the UI/API — only
"under review," with a human expected to investigate.

## D21 — Payout provider is a manual/recording-only adapter, not a real money mover
No real payment processor credentials exist in this environment (spec
Section 152 pattern, same as D13's storage adapter). `PayoutProvider` is
an interface; the only implementation (`ManualPayoutProvider`) doesn't
move any money — it just requires a human (Finance Administrator) to
mark a payout `PAID` with a reference number after moving money through
whatever real channel they used outside this system, or `FAILED` with a
reason. This is honest about what Phase 4 actually automates (the ledger
and approval workflow) versus what it doesn't (actually disbursing funds)
— a real Mobile Money/bank-transfer integration is future work.

## D22 — Business ownership verification is evidence-description-based, not an automated identity check
Spec Section 29's workflow (CLAIM → IDENTITY/OWNERSHIP CHECK → REVIEW →
APPROVE → OWNER_VERIFIED) implies some identity verification step. No
document-verification or business-registry API is configured in this
environment. Consistent with Section 19's guidance ("use a secure
third-party verification/payment provider rather than storing unnecessary
identity documents yourself"), Phase 5 does NOT collect or store ID
documents. Instead, a claim carries a free-text `evidenceDescription`
(e.g. "I'm the manager, my number matches the listed phone; here's our
business registration number: X") that a human reviewer (Moderator/Data
Manager/Super Admin) judges manually before approving. This is honest
about what's automated (none of the identity check) versus what a human
must do (all of it) — a real business-registry or document-verification
API integration is future work, not faked here.

## D23 — Business update requests always go through moderation, never apply instantly
Spec Section 29: "Changes may require moderation." Phase 5 treats this as
mandatory, not optional — every `BusinessUpdateRequest` from an owner sits
`PENDING` until a Moderator/Data Manager/Super Admin approves it, at which
point the diff is applied to the `Place` record and logged to
`PlaceChangeHistory` per field. This errs toward the spec's data-integrity
priority (Section 127) over convenience — an owner can't unilaterally
change published information the moment they're verified, only propose
changes.

## D24 — One approved owner per place; competing claims require human resolution
If a place already has an `ownerUserId` (an approved claim), Phase 5
rejects new claims outright with a clear error rather than queuing a
"dispute." Multi-claim dispute resolution (spec Section 112's "business
disputes" admin view) is real, unbuilt scope — not something to
half-implement with an ad hoc tie-breaking rule invented here. An admin
can resolve a real dispute manually via direct DB access today; a proper
dispute workflow is a documented follow-up.

## D25 — Tourist reports feed the existing Task/verification loop, not a separate fix-it path
Spec Section 68's workflow is REPORT → REVIEW → VERIFY → UPDATE. Rather
than inventing a second, parallel way to change Place data, reviewing a
report can create a real `Task` (of the type matching the report reason —
e.g. `CLOSED_BUSINESS` → a `CLOSURE` task, `WRONG_PHONE` →
`CONTACT_VERIFICATION`) using Phase 3's existing task-creation service. An
agent then verifies it in the field exactly like any other task, and
approval flows through Phase 3's existing `reviewSubmission()` — which
already updates the Place record for the relevant task types. This is the
literal "TRAVELERS REPORT CHANGES → DATA QUALITY IMPROVES" loop from the
spec's own diagram, implemented by connecting two things that already
exist rather than building a third parallel mechanism.

## D26 — "Open now" filtering uses one configurable timezone, not real per-place timezones
Spec Section 87 forbids hard-coding Ghana assumptions into core
architecture. At the same time, `Place` has no timezone field, and adding
real per-country timezone resolution is a meaningfully larger feature
(timezone database, DST handling, etc.) than Phase 6's search filters
warrant right now. Compromise: `openingHours` uses a simple structured
shape (day-of-week → `{open, close}` in 24h local time), and "open now"
evaluates against one app-wide configurable timezone
(`DEFAULT_TIMEZONE` env var, defaulting to `UTC` — which happens to match
Ghana). This is configurable, not hard-coded, satisfying Section 87's
letter; the honest limitation is that a future city outside that timezone
will get wrong "open now" answers until real per-place timezone support
is built. Documented, not hidden.

## D27 — "Get Directions" is a real deep link; an embedded interactive map is not
A Google Maps "directions" URL (`https://www.google.com/maps/dir/?api=1&destination=lat,lng`)
requires no API key and works today — Phase 6 ships this as a genuine,
functional feature, not a stub. A full embedded interactive map (spec
Section 42) requires a real Maps JavaScript API key/provider, which isn't
configured in this environment. The `MapProvider`-style abstraction
pattern (Section 137) is used for the parts that do need a real key;
directions deep-linking is separated out specifically because it doesn't.

## D28 — No fabricated "top rated" sort
Spec Section 41 lists "TOP RATED" as a search filter, but no phase in the
10-phase plan builds a ratings/review system (Section 132/133 describe
one only conditionally: "if reviews are introduced"). Rather than sort by
a number that doesn't exist, Phase 6's search supports `sort=distance`,
`sort=freshness` (most recently verified first), and `sort=name` —
real, computable orderings — and simply does not offer a `top_rated`
option. Adding it later requires a real review system first.

## D29 — Emergency numbers are sourced and cited, not recalled from memory
Spec Section 155/47: emergency contact data must never be fabricated. Ghana's
emergency numbers were verified via web search before seeding, not
recalled from training data — multiple independent sources (government
announcements, NGO/hospital directories) corroborate: 112 is the unified
national emergency number (introduced ~2020), with legacy service-specific
numbers 191 (police), 192 (fire), and 193 (ambulance) still active. Each
seeded `EmergencyNumber` row records a `sourceDescription` and
`lastVerifiedAt` reflecting when this check happened — not a claim of
official government confirmation. An admin with access to authoritative
sources (e.g. National Communications Authority, Ghana Police Service)
should periodically re-verify and update `lastVerifiedAt`, exactly as the
spec's data-freshness pattern intends this field to be used elsewhere.

## D30 — No translation content beyond English is seeded; the architecture is real, the content is not fabricated
Spec Section 49 asks for a translation architecture, including "emergency
phrases." Mistranslating a phrase like "I need a doctor" or "call the
police" could cause real harm if it's wrong. This environment has no
translation-provider API key configured, and I do not have reliable
enough confidence in Twi/Ga/other local-language translation to seed
phrases as if they were verified-accurate emergency content. Phase 8
therefore ships the full `TravelPhrase` architecture (categories, phrase
records, a translation field structurally ready for multiple languages)
seeded with English content only. Non-English translations are a
documented gap requiring either a real translation-provider integration
(Section 152 pattern) or professional human translation review — not
something to fill in with unverified guesses.

## D31 — No fabricated currency exchange rates
Spec Section 50 explicitly warns against implying an estimate is exact —
but the deeper issue is that a wrong exchange rate could cause a tourist
real financial harm (under- or over-paying, misjudging affordability). No
exchange-rate provider API key is configured. Rather than hardcode a
static rate that will silently go stale, `CurrencyProvider` is an
interface (Section 152 pattern) with only a "not configured" adapter that
returns a clear "conversion unavailable" response. This mirrors D21's
payment-provider honesty: the workflow/API shape is real, the actual
external data source is not faked.

## D32 — Safety alerts are admin-curated, not auto-ingested from unverified sources
Spec Section 52: "only use reliable sources... do not spread rumors." No
weather/government-alert API is integrated. `SafetyAlert` records are
created only by Data Manager/Super Admin roles (not open submission,
not scraped), each requiring a `sourceDescription`. This is a deliberate,
narrow scope: a real broadcast mechanism for information a human
authority has already verified, not an automated aggregator that could
surface unverified rumors.

## D33 — API versioning applies to the new external B2B surface, not a retrofit of every internal route
Spec Section 60 says to "implement API versioning from the beginning,"
in the specific context of the future B2B Local Data API (Section 60's
own heading). Phases 1-8 built internal-first-party routes
(`/api/places`, `/api/agent/tasks`, etc.) that the project's own UI pages
already call directly. Retroactively renaming all of them to `/api/v1/...`
at this stage would be a large, blast-radius-heavy refactor across every
existing page and test, undertaken without the ability to visually verify
the UI still works afterward — a bad trade for a versioning scheme whose
actual audience (external B2B consumers) doesn't exist yet. Phase 10
instead introduces a new, deliberately curated `/api/v1/` surface
(read-only: places search/detail, categories, countries, cities) built
specifically for external API-key-authenticated consumers, versioned from
its own beginning. Internal routes keep their existing paths; migrating
them to a versioned scheme, if ever needed, is a separate future decision
with its own migration plan.

## D34 — API keys are hashed at rest, shown once, scoped, and rate-limited per key
Mirrors the session-token pattern (Phase 1): `ApiKey.keyHash` stores only
a SHA-256 hash; the raw key is returned exactly once, at creation, and
never recoverable afterward — if lost, the only remedy is revoking and
issuing a new one. Each key carries an explicit `scopes` list (e.g.
`["places.read"]`) checked independently of just "is this key valid,"
and its own per-minute rate limit tracked separately from the anonymous
IP-based limiter Phases 2/6 already use for the internal search endpoint.

## D35 — i18n is architecture-only in Phase 10, not retrofitted into existing UI pages
Spec Section 87 requires supporting multiple languages. Consistent with
D30's phrasebook decision, no professional translations exist for this
project's UI strings, and I do not have reliable enough confidence to
generate them myself for user-facing text. Phase 10 ships a real,
tested `t()`/locale-dictionary module with English fully populated —
but does not retrofit it into the existing, already-verified pages
(explore, place detail, agent/business dashboards, emergency), since
doing so purely to demonstrate the architecture would touch several
working pages without any way to visually confirm they still render
correctly afterward. Wiring it into pages, and adding real non-English
content, are documented follow-ups.

## D11 — Manual SQL for PostGIS/pg_trgm extensions and CHECK constraints
Prisma migrations can express tables/columns/indexes but not
`CREATE EXTENSION` or functional indexes on expressions cleanly. Rather
than fight the tool, these live in `prisma/manual-sql/`, run once after
`prisma migrate dev`, with instructions for both Supabase's SQL editor and
plain `psql`. This is a deliberate, documented exception to "everything
goes through Prisma migrations" — the alternative (skipping PostGIS
entirely, or faking geospatial search with an application-level bounding
box) would violate spec Section 86 more than a documented manual step does.
