# DATABASE_SCHEMA.md (Phase 1)

Full source of truth is `prisma/schema.prisma`. This document explains the
*why* behind each model; regenerate ER diagrams from the schema file as
the project grows rather than hand-maintaining one here.

## User
Core account. `passwordHash` only — no plaintext ever stored or logged.
`status` gates login (`SUSPENDED`/`DEACTIVATED` block session creation even
with a valid password). Optional tourist-profile fields (`homeCountry`,
`preferredLanguage`, `preferredCurrency`) are nullable by design (spec
Section 9 — genuinely optional).

## UserRole
Many-to-many join between User and the `Role` enum, because a person can
legitimately hold multiple roles (e.g. a Local Data Agent who is also a
Business Owner). `grantedBy` tracks who assigned a role for audit purposes;
self-registration (default TOURIST role) leaves it null.

## Session
DB-backed, revocable sessions. Stores only a SHA-256 hash of the session
token — never the raw token. `expiresAt` enforces TTL; `revokedAt` +
`revokedReason` support explicit logout, admin-forced logout, and future
"log out all devices" functionality without deleting the audit trail.

## LoginAttempt
Feeds brute-force detection. Deliberately allows `userId` to be null
(failed attempts against an email that doesn't exist still get logged for
rate-limiting purposes, without creating a fake user reference).

## EmailVerificationToken / PasswordResetToken
Standard token-hash-with-expiry pattern, same rationale as Session (never
store the raw secret). Issuance logic exists; actual email delivery is
pending a `NotificationProvider` integration (Phase 2+/gap noted in
PROJECT_AUDIT.md).

## AuditLog
Append-only from the application's perspective — there is no update/delete
route. `metadata` is a JSON blob for action-specific context (e.g. which
role was granted) and must never contain secrets (enforced by convention +
code review, not yet by a schema-level check).

## FeatureFlag / SystemSetting
Key-value config, DB-backed so admins can change behavior without a
redeploy. `FeatureFlag` is specifically boolean on/off (spec Section 116);
`SystemSetting` holds arbitrary JSON for future configurable values
(reward rates, payout minimums, etc. — not populated yet, Phase 4).

## Deferred to later phases (not yet in the schema)
Agent-specific profile fields, Task, Submission, Evidence, Wallet,
Transaction, Payout, BusinessClaim, Report, and their relations — these
arrive with Phases 3-5 as additive migrations.

---

# Phase 2 additions

## Country / Region / City / Neighborhood
Real tables, not enums — spec Section 87 explicitly forbids hard-coding
Ghana (or any country) into the architecture. Each level cascades
`onDelete: Restrict` from its parent, so you can't accidentally delete a
Country that still has Regions under it; that's a deliberate safety choice
over `Cascade`, since deleting a whole country's data tree by accident
would be catastrophic and there's no legitimate Phase 2 workflow that
needs to do it in one click.

## Category
Self-referencing (`parentId` -> `Category.id`) so new categories or
subcategories never require a schema migration (Section 15). Flat for the
initial seed data; nesting is available whenever it's needed.

## Place
The central entity (Section 16). Notably: `latitude`/`longitude` are
plain `Float`, not a PostGIS geometry column — see DECISIONS.md D9 for why.
`openingHours` is `Json`, intentionally structured rather than free text
(Section 123) — the exact shape (e.g. per-weekday open/close times) will
be finalized when the tourist-facing "open now" filter is built (Phase 6).
`alternativeNames`/`paymentMethods`/`languages`/`services`/`amenities` are
Postgres native arrays (`String[]`) rather than join tables — appropriate
for small, order-independent lists that are always read/written as a
whole with the place record.

## Source / PlaceSource
`Source` is a reusable reference (e.g. one row per Local Data Agent, or
one row for "Ghana Tourism Authority"); `PlaceSource` is the join that
says "this source attests to this place," with its own `confidence`. This
lets one source back multiple places, and one place have multiple
independent sources — required for the trust model in Section 158.

## PlaceChangeHistory
Append-only. `approvalStatus` defaults to `PENDING` for anything that
needs review (e.g. a flagged duplicate signal) but the initial "place was
created" entry is `AUTO_APPLIED`, since creation itself isn't gated —
only the DRAFT record's promotion to a verified status is (Phase 3).

## Why CHECK constraints and PostGIS live in manual SQL, not schema.prisma
See DECISIONS.md D11.

---

# Phase 3 additions

## LocalDataAgentProfile
One row per applicant, keyed directly on `userId` (1:1, not a separate
UUID) since a user can only ever have one agent application. `status`
distinguishes application state from the `LOCAL_DATA_AGENT` role itself —
having the role means approved; the profile row is the application record
and audit trail (who approved/rejected, when, why).

## TrainingModule / AgentTrainingCompletion
`requiredForTaskTypes` is a `TaskType[]` column — a module can gate zero,
one, or several task types. `AgentTrainingCompletion` is a simple
join-with-timestamp; there's no quiz/scoring model yet (Section 20 doesn't
require one, just "completion").

## Task
`placeId` is nullable specifically because `NEW_PLACE` tasks don't have an
existing place yet — every other type requires one (enforced in
`createTask()`, not just convention). `assignedAgentId` and
`createdByUserId` both point at `User` with `onDelete: SetNull` — deleting
a user shouldn't cascade-delete task history.

## TaskSubmission
The Section 25 checklist is six explicit nullable booleans rather than a
JSON blob, so the fields are queryable/reportable (e.g. "how often does
'contactVerified' come back false") without JSON path queries.
`proposedPlaceData` stays JSON because its shape mirrors `CreatePlaceInput`
from Phase 2, which itself may evolve — locking it to strict columns here
would create two places to update every time a Place field is added.

## Evidence
`exifStrippedAt` is nullable and stays null in Phase 3 — see DECISIONS.md
D13. Never set this to a timestamp unless stripping actually happened;
that field existing as non-null is meant to be trustworthy proof later.

## AgentReputation
Deliberately has no manual-edit path anywhere in the codebase — every
write goes through `recalculateReputation()`, driven only by real
`TaskSubmission.reviewStatus` counts. If you ever need to manually adjust
someone's reputation (e.g. correcting an error), do it by fixing the
underlying submission records, not by writing directly to this table.

---

# Phase 4 additions

## RewardRule
One row per `RewardActivityType`, unique on that column — there is
exactly one active amount per activity at a time (no historical versioning
of amounts yet; changing a rule overwrites it, though the `updatedAt`
timestamp and audit log preserve when a change happened).

## Wallet / WalletTransaction
See DECISIONS.md D18 for the caching relationship. `WalletTransaction`
amounts are always stored positive — direction of effect is entirely
determined by `type` (see `ledgerTypeToBalanceUpdate()` in
`src/lib/rewards/wallet.ts`), which keeps the ledger easy to sum for
reporting ("total ever earned" = sum of EARNING_APPROVED + BONUS, etc.)
without sign-based arithmetic mistakes.

## Payout
`provider` defaults to `MANUAL` since that's the only implemented
adapter (D21). `onDelete: Restrict` on the `user` relation — a payout
record must never silently disappear if a user account is later deleted;
that would destroy financial history.

## AgentReputation.fraudStatus
Lives on the same row as reputation (not a separate table) since it's
recalculated at the exact same time, from related signals. See
DECISIONS.md D20 for the threshold logic and its limitations.

---

# Phase 5 additions

## Place.ownerUserId
Nullable — most places have no verified owner. Set only by
`reviewClaim()` on approval, never directly. No foreign-key `onDelete`
cascade concern here since it's a plain optional reference alongside the
existing `createdByUserId` pattern.

## BusinessClaim
One row per claim attempt (not per place) — a place can accumulate a
history of rejected claims before one is eventually approved, all
preserved for audit. `evidenceDescription` is free text by design (D22) —
there is no document/file field, deliberately, since no verification
provider exists to make use of one yet.

## BusinessUpdateRequest
`changes` is a JSON diff (`field -> proposed value`), validated against a
hard-coded allowlist in the service layer before it's ever persisted —
the JSON's flexibility is a convenience for storage, not an invitation to
accept arbitrary fields. On approval, the reviewer service reads the
Place's *current* value for each changed field to populate
`PlaceChangeHistory.previousValue` before applying the update, so the
history row is always accurate even if multiple update requests are
reviewed out of submission order.

---

# Phase 6 additions

## SavedPlace
Simple bookmark join table, `@@unique([userId, placeId])` so saving twice
is a no-op (upsert) rather than a duplicate row or an error — matches the
UI expectation that clicking "Save" repeatedly is harmless.

## Report
One row per report (not deduplicated against other reports on the same
place/reason — multiple tourists reporting the same wrong phone number is
itself a useful signal, not noise to collapse). `linkedTaskId` is a plain
reference (not a foreign key) to the `Task` created when a reviewer
chooses `CREATE_VERIFICATION_TASK` — kept loose deliberately, consistent
with `PlaceSource`'s `relatedTaskId` pattern elsewhere in the schema, so a
task being deleted (not currently possible via any route, but
theoretically) can't cascade-delete report history.

## Place.openingHours shape (finalized this phase)
`Json` field, shape: `{ mon?: {open, close} | null, tue?: ..., ... }`,
each day's value either a `{open, close}` object in `"HH:MM"` 24h format,
`null` for explicitly closed, or the key omitted entirely for "unknown."
See `src/lib/tourist/openingHours.ts` and DECISIONS.md D26 for the
single-timezone limitation.

---

# Phase 8 additions

## EmergencyNumber
`sourceDescription` is non-nullable in the schema (not just app-validated)
— there is no way to insert a row without one, even via a future script
that forgets to call the validation layer. Unique-ish by
(countryId, service, number) via application-level upsert logic rather
than a DB constraint, since a country could plausibly have more than one
legitimate number per service type (e.g. a regional variant) — the schema
stays permissive, the service layer's upsert-by-triple is the practical
dedup mechanism.

## SafetyAlert
`cityId` nullable = country-wide; non-null = scoped to that city. See
`src/lib/travel/safetyAlerts.ts` for the query logic and the Prisma
`undefined`-vs-`null` bug that was caught and fixed while building this
(documented in ARCHITECTURE.md's Phase 8 section).

## TravelPhrase
`translations` is `Json @default("{}")` — genuinely empty by default, not
a placeholder object with fake keys. See DECISIONS.md D30.

---

# Phase 10 additions

## Country.defaultCurrency / defaultLanguage
Both nullable — most countries in the system may never need these set
explicitly if the UI never branches on them (which, honestly, it doesn't
yet — see D35). Added now so the data model doesn't need another
migration when the UI eventually does branch per-country.

## ApiKey
`keyHash` is `@unique` (used directly as the lookup key during
validation — same pattern as `Session.tokenHash`). `keyPrefix` stores
just enough of the raw key (first 12 chars, including the `tpk_` marker)
to let an admin recognize a key in a list without ever re-exposing the
full secret. `scopes` is a plain `String[]` rather than an enum-backed
join table — scopes are simple, few, and don't need relational integrity
the way, say, Task types do.

## CityCoverageTarget
`@@unique([cityId, categoryId])` — one target per city/category pair;
setting a new target for the same pair overwrites rather than
accumulating duplicate rows. No historical record of target changes is
kept (unlike `PlaceChangeHistory`'s pattern elsewhere) — targets are
operational configuration, not verified factual claims about a place, so
the same audit rigor didn't seem warranted; the `updatedAt` timestamp is
enough to know a target changed, even without knowing its prior value.
