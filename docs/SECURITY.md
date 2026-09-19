# SECURITY.md

## Scope
This document covers Phase 1 security controls only. It will be extended
every phase (Section 146 requires a pre-launch security audit across all
of these categories eventually).

## Authentication
- Passwords hashed with bcrypt, cost factor 12 (configurable via
  `BCRYPT_COST` env var). Never stored or logged in plaintext.
- Generic error message on login failure ("Invalid email or password") —
  does not reveal whether the account exists.
- Failed attempts recorded per (email, IP) pair; after
  `MAX_LOGIN_ATTEMPTS` (default 5) within `LOGIN_ATTEMPT_WINDOW_MINUTES`
  (default 15), further attempts for that pair are rejected with 429
  regardless of credential correctness.
- Sessions are opaque random 256-bit tokens. Only a SHA-256 hash of the
  token is stored server-side — a leaked database does not directly yield
  usable session tokens.
- Cookies: `HttpOnly`, `Secure` (in production), `SameSite=Lax`.
- CSRF: state-changing routes (`POST`/`PATCH`/`DELETE`) verify the
  `Origin` header matches the configured app origin. This is a baseline;
  a double-submit CSRF token is planned to be layered on when forms beyond
  auth are added in later phases.
- MFA for administrator roles is **architected but not implemented** in
  Phase 1 — `User.mfaEnabled` / `User.mfaSecret` fields exist in the schema
  as nullable, and login logic has a checkpoint for it, but no TOTP library
  is wired up yet. Tracked in DECISIONS.md. Do not treat admin accounts as
  MFA-protected until this lands.

## Authorization
- Every API route independently checks the caller's session AND role
  server-side (`requireRole()` guard in `src/lib/rbac`). No route relies on
  the UI hiding a button (spec Section 84).
- Role list matches spec Section 7 exactly (Tourist, Local Data Agent,
  Field Verifier, Business Owner, Moderator, Data Manager, Finance Admin,
  Security Admin, Super Admin). A user can hold multiple roles.

## Input Validation
- All API request bodies validated with Zod schemas before touching
  business logic. Invalid input → 400 with field-level errors, never a
  stack trace.

## Logging
- Pino logger configured with `redact` for `password`, `passwordHash`,
  `token`, `sessionToken`, `otp`, `authorization` header — matches spec
  Section 81 ("never log passwords, OTPs, payment credentials").

## Audit Logging
- `AuditLog` table records: actor user id, action, target type/id,
  metadata (JSON, no secrets), IP, timestamp. Written for: login success,
  login failure (without exposing which existed), logout, session
  revocation, role changes.
- Audit logs are insert-only from the application layer — no update/delete
  API exists for them in Phase 1. True tamper-resistance (e.g. write-once
  storage or hash chaining) is deferred; noted as a gap, not claimed as solved.

## Known Gaps (Phase 1, explicitly not hidden)
- No MFA implementation yet (architecture only).
- No CAPTCHA/challenge on registration yet (in-memory rate limiting only —
  insufficient against a distributed attacker; needs Redis + a challenge
  provider before production launch).
- No email/phone verification delivery (no email/SMS provider configured —
  `EmailVerificationToken` model and issuance logic exist, but actual
  sending is a `NotificationProvider` interface with only a console/dev
  adapter registered).
- In-memory rate limiter does not work across multiple server instances —
  fine for single-instance dev, unsafe for horizontally-scaled production
  as-is. Documented, not disguised.

## Pre-Launch Security Checklist (tracked, not yet executed — Section 146)
- [ ] Authentication audit
- [ ] Authorization audit
- [ ] API audit
- [ ] Database audit
- [ ] File-upload audit (N/A until Phase 3 photo uploads)
- [ ] Payment audit (N/A until Phase 4)
- [ ] AI audit (N/A until Phase 9)
- [ ] Browser security audit (N/A until Phase 7)
- [ ] Privacy audit
- [ ] Logging audit

## Phase 2 additions

- **SQL injection:** all geospatial queries in `src/lib/places/geo.ts` use
  Prisma's tagged-template `Prisma.sql`/`$queryRaw`, which parameterizes
  every value — coordinates, radius, category/city IDs are never string-
  interpolated into the query text (spec Section 105).
- **Input validation:** latitude/longitude are validated in three places
  independently — Zod schema at the API boundary, an explicit range check
  in `placeService.ts`/`geo.ts`, and a Postgres `CHECK` constraint from the
  manual SQL migration. Redundant on purpose (defense in depth).
- **Rate limiting:** `/api/places` (nearby search) is rate-limited at
  60 requests/minute/IP using the same in-memory limiter as Phase 1 — same
  known limitation (single-instance only, see above).
- **Duplicate-detection scores are not a security control** — they're a
  data-quality heuristic. Nothing in Phase 2 uses duplicate score to gate
  access or trust a user; it only ever produces a review flag.

## Phase 3 additions

- **File upload validation:** evidence photo uploads are checked for MIME
  type (JPEG/PNG/WebP only) and size (10MB max) in `submitTask()` before
  anything is written to disk. Filenames are never trusted for storage —
  `LocalFilesystemPhotoStorage` generates a random UUID-based key and
  restricts the extension to an allowlist, preventing path traversal via a
  crafted filename.
- **Ownership checks on task actions:** accepting, rejecting, and
  submitting a task all verify `task.assignedAgentId === callingUser.id`
  server-side — a user cannot act on another agent's task even if they
  guess its ID (spec Section 84).
- **Training-gate enforcement is server-side**, inside `submitTask()`, not
  just hidden in the UI — an API client that skips the training-check
  screen still gets rejected.
- **Known gap — photo storage is not production-safe:** see DECISIONS.md
  D13. No EXIF stripping happens yet, so uploaded photos currently retain
  any embedded metadata (potentially including GPS coordinates baked into
  the image itself by the capturing device) until a real image-processing
  step is added. Do not treat Phase 3 photo evidence as safe for public
  publication as-is.

## Phase 4 additions

- **Financial input validation:** every money-related API route validates
  amount positivity/non-negativity, 3-letter currency codes, and (for
  payout requests) minimum-withdrawal and supported-currency checks —
  server-side, in the service layer, not just Zod shape checks.
- **No client-supplied reward amounts:** the client never sends an amount
  to be paid — `POST /api/admin/rewards/rules` sets the *rule*, and actual
  earnings always read the amount from that stored rule at approval time
  (spec Section 83: "never trust... reward amounts sent by client").
- **Payout provider never fabricates success:** `ManualPayoutProvider`
  always returns `success: false` — see DECISIONS.md D21. A `PAID` status
  can only be recorded by a human with `payouts.manage` permission
  supplying a reference, which is logged to the audit trail
  (`payout.process` action).
- **Fraud gating is defense-in-depth, not the only check:** `SUSPENDED`
  blocks new earning creation and payout requests, but every payout
  request is independently re-validated against the live approved balance
  regardless of fraud status — a SUSPENDED flag being wrong in either
  direction can't cause an over-payment.

## Phase 5 additions

- **Privilege-escalation-resistant update allowlist:** `validateChanges()`
  in `src/lib/business/updates.ts` rejects any field not on a fixed list
  before the request is even stored — an owner cannot smuggle a change to
  `ownerUserId`, `verificationStatus`, coordinates, or any other sensitive
  field through the business-update path. Covered by unit tests
  specifically targeting escalation attempts.
- **Ownership re-verified at both submit and review time:** the
  `place.ownerUserId === callingUser.id` check happens in the service
  layer, not just via the `business.updates.submit` role permission — so
  even if role assignment were ever misconfigured, a non-owner still
  can't modify someone else's listing.
- **No documents collected, so nothing sensitive to protect (yet):**
  because D22 uses free-text evidence descriptions rather than uploaded
  ID/business documents, Phase 5 has no new sensitive-file-handling
  surface to secure. This will change if/when real identity verification
  is integrated — that integration should get its own security review.

## Phase 6 additions

- **Reports require login:** unlike some spec-listed features that could
  plausibly be anonymous, reports require an authenticated caller (spec
  Section 131's spam-prevention guidance works far better with an
  accountable identity), and are rate-limited per user (20/hour) on top
  of the existing per-IP search rate limit.
- **Report-to-task mapping is a fixed, server-side lookup table** — the
  client cannot specify what `TaskType` gets created; it only supplies a
  `ReportReason`, and `taskTypeForReportReason()` decides. This prevents a
  malicious reporter from, say, requesting a `CLOSURE` task (which could
  eventually mark a legitimate business closed) via a report reason that
  shouldn't produce one.
- **Search rate limiting is unchanged from Phase 2** (60/min/IP) — the new
  non-geospatial and openNow-filtered modes still route through the same
  limiter, so they don't open a new scraping vector.

## Phase 8 additions

- **Emergency and safety-alert data requires a source at the validation
  layer**, not just as a UI convention — `upsertEmergencyNumber()` and
  `createSafetyAlert()` both throw `VALIDATION_ERROR` if
  `sourceDescription` is empty, so this can't be bypassed by a client
  that skips a form field.
- **No financial harm from a fabricated exchange rate:** the currency
  endpoint fails loudly (503) rather than ever returning a number. This
  is a deliberate security/trust property, not a missing feature to
  quietly patch with a hardcoded value.
- **No health/safety harm from fabricated translations:** the phrasebook
  ships English-only rather than guessed translations of emergency
  phrases, for the same reason.

## Phase 10 additions

- **API keys are the first non-user credential type in this system** —
  hashed at rest identically to session tokens (SHA-256, never plaintext),
  with the same "shown once, unrecoverable" property as nothing else in
  the app currently has (even passwords can be reset; a lost API key
  must be revoked and replaced).
- **Scope checks are independent of validity checks:** a valid, active,
  non-expired key with the wrong scope is still rejected — tested
  explicitly (a `places.read`-only key rejected for a `categories.read`
  request) rather than assumed to work from the data model alone.
- **Per-key rate limiting reuses the existing in-memory limiter**
  (`checkRateLimit`), keyed by `apikey:<id>` — inherits the same
  single-instance limitation documented in Phase 1's SECURITY.md; a
  horizontally-scaled deployment serving the B2B API needs the same
  Redis upgrade already flagged there.
- **Usage tracking is fire-and-forget** (an unawaited `.catch()`) so a
  transient DB hiccup updating `requestCount`/`lastUsedAt` can never
  cause a legitimate, already-authorized API request to fail.

