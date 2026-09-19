# API_DOCUMENTATION.md (Phase 1)

No `/api/v1/` versioning prefix yet — Section 60's versioning requirement
applies to the future public/B2B API surface. These are internal
first-party auth endpoints; versioning will be introduced when the public
API (Phase 10) is built, at which point these may be namespaced too.

All responses are JSON. All errors follow:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": {} } }
```

## POST /api/auth/register
Body: `{ "email": string, "password": string, "displayName"?: string }`

- 201 → `{ "user": { "id", "email", "displayName", "status" } }`
- 400 `VALIDATION_ERROR` — bad email/missing fields/weak password
- 409 `CONFLICT` — account could not be created (deliberately vague, see D-notes on anti-enumeration)
- 429 `RATE_LIMITED`
- 403 `CSRF_FAILED` — Origin header mismatch

New accounts get the `TOURIST` role and `PENDING_VERIFICATION` status.
Email verification delivery is not yet wired to a real provider.

## POST /api/auth/login
Body: `{ "email": string, "password": string }`

- 200 → `{ "user": { "id", "email", "displayName", "roles": string[] } }`, sets `session_token` HttpOnly cookie
- 400 `VALIDATION_ERROR`
- 401 `UNAUTHENTICATED` — invalid credentials (generic message either way)
- 403 `UNAUTHORIZED` — account suspended/deactivated
- 429 `RATE_LIMITED` — after `MAX_LOGIN_ATTEMPTS` failures per (email, IP) within the configured window

## POST /api/auth/logout
No body required. Revokes the current session (if any) and clears the cookie.
- 200 → `{ "success": true }`

## GET /api/auth/me
Requires a valid session cookie.
- 200 → `{ "user": { "id", "email", "displayName", "roles" } }`
- 401 `UNAUTHENTICATED`

## GET /api/health
No auth required. For infra/monitoring only — not for end users.
- 200 → `{ "status": "ok", "checks": { "database": "ok" } }`
- 503 → `{ "status": "degraded", "checks": { "database": "error" } }`

## Not yet implemented
Password reset flow (`PasswordResetToken` model exists, no route yet),
MFA challenge routes, admin role-management routes (the admin page is
currently read-only for Phase 1). These will be added as their features
land.

---

# Phase 2 — Local Data Engine

## GET /api/categories
Public. No auth required.
- 200 → `{ "categories": [{ "id", "slug", "name", "parentId" }] }`

## POST /api/categories
Requires `categories.manage` permission (DATA_MANAGER, SUPER_ADMIN).
Body: `{ "name": string, "slug"?: string, "parentId"?: uuid }`
- 201 → `{ "category": {...} }`
- 409 `CONFLICT` — slug already exists

## GET/POST /api/admin/geography/countries
GET is public (list). POST requires `geography.manage`.
Body: `{ "name": string, "isoCode2": string (2 letters), "isoCode3"?: string (3 letters) }`
- 201 → `{ "country": {...} }` · 409 on duplicate ISO code

## GET/POST /api/admin/geography/regions
GET accepts `?countryId=` filter, public. POST requires `geography.manage`.
Body: `{ "countryId": uuid, "name": string }`

## GET/POST /api/admin/geography/cities
GET accepts `?regionId=` filter, public. POST requires `geography.manage`.
Body: `{ "regionId": uuid, "name": string, "centroidLat"?: number, "centroidLng"?: number }`

## GET/POST /api/admin/geography/neighborhoods
GET accepts `?cityId=` filter, public. POST requires `geography.manage`.
Body: `{ "cityId": uuid, "name": string }`

## GET /api/places
Public, rate-limited (60 requests/minute/IP). Query params:
`lat`, `lng` (required), `radiusMeters` (default 2000, max 100000),
`categoryId`, `cityId`, `verifiedOnly` (`"true"`/omit).
- 200 → `{ "places": [{ "id", "name", "categoryId", "latitude", "longitude", "verificationStatus", "distanceMeters" }] }`,
  sorted nearest-first. Excludes `REJECTED`/`CLOSED` places always.

## GET /api/places/:id
Public. Returns full place detail including category/geography names and sources.
- 200 → `{ "place": {...} }` · 404 `NOT_FOUND`

## POST /api/places
Requires `places.create` (LOCAL_DATA_AGENT, FIELD_VERIFIER, MODERATOR,
DATA_MANAGER, SUPER_ADMIN). Body per Section 16's core fields (name,
categoryId, countryId, latitude, longitude required; region/city/
neighborhood/contact/description optional).
- 201 → `{ "place": { "id", "name", "verificationStatus" }, "potentialDuplicates": [...] }`
  — `verificationStatus` always starts `DRAFT`. `potentialDuplicates` is
  informational; creation is never blocked by it (spec Section 24).

## POST /api/places/check-duplicates
Same permission as place creation. Lets a client preview duplicate
signals before submitting (e.g. to warn a Local Data Agent in the field).
Body: `{ "name", "latitude", "longitude", "categoryId", "phone"?, "website"? }`
- 200 → `{ "potentialDuplicates": [{ "candidateId", "score", "reasons", "distanceMeters", "nameSimilarity" }] }`

## Not yet implemented (Phase 2 gaps, tracked)
Category update/delete, geography update/delete, place update (only
create exists — updates arrive with the agent submission/verification
workflow in Phase 3), moderation queue for duplicate flags, admin merge UI.

---

# Phase 3 — Agent Platform

## POST /api/agent/apply
Requires login (any role). Body:
`{ "city"?, "area"?, "preferredLanguage"?, "availability"?, "experience"? }`
- 201 → `{ "profile": {...} }` (status `PENDING_APPROVAL`)
- 409 `CONFLICT` — already applied

## POST /api/admin/agents/:userId/approve
Requires `agents.manage`. Grants `LOCAL_DATA_AGENT` role + creates the
agent's reputation row.
- 200 → `{ "profile": {...} }` (status `APPROVED`)

## POST /api/admin/agents/:userId/reject
Requires `agents.manage`. Body: `{ "reason": string }`
- 200 → `{ "profile": {...} }` (status `REJECTED`)

## GET /api/training/modules
Requires login. Returns all 16 training modules (title, content, which
task types they gate).

## POST /api/training/modules/:id/complete
Requires login. Marks a module complete for the caller. Idempotent.

## POST /api/admin/tasks
Requires `tasks.manage`. Body:
`{ "type", "title", "instructions"?, "placeId"?, "cityId"?, "categoryId"?, "dueAt"? }`
`placeId` is required for every type except `NEW_PLACE`.
- 201 → `{ "task": {...} }` (status `OPEN`)

## GET /api/agent/tasks
Requires `places.create` (i.e. an approved agent role). Query params:
`cityId`, `categoryId`, `type` filter the open pool; `mine=true` instead
returns tasks assigned to the caller.

## POST /api/agent/tasks/:id/accept
Requires `places.create`. Moves an `OPEN` task to `ASSIGNED` for the caller.
- 409 `CONFLICT` — task no longer open

## POST /api/agent/tasks/:id/reject
Requires `places.create`; caller must be the assigned agent. Body:
`{ "reason": string }`. No reputation effect (see DECISIONS.md D14).

## POST /api/agent/tasks/:id/submit
Requires `places.create`; caller must be the assigned agent; task must be
`ASSIGNED`; required training for the task's type must be complete.
**multipart/form-data**, not JSON, so photo files can ride along:
- Text fields: `placeExists`, `nameMatches`, `locationMatches`,
  `appearsOperational`, `contactVerified`, `openingInfoChecked` (each
  `"true"`/`"false"`), `notes`, `gpsLat`, `gpsLng`, `gpsAccuracyMeters`,
  `proposedPlaceData` (JSON string, required for `NEW_PLACE` tasks)
- File field: `photos` (repeatable), JPEG/PNG/WebP, 10MB max each
- 201 → `{ "submission": {...} }` — task moves to `SUBMITTED`
- 401 `UNAUTHORIZED` — required training incomplete (message names the task type)

## POST /api/admin/submissions/:id/review
Requires `tasks.review`. Body: `{ "decision": "APPROVED"|"REJECTED"|"NEEDS_MORE_INFO", "reviewNotes"? }`
- `APPROVED` on a `NEW_PLACE` task creates the Place (via Phase 2's
  `createPlace`) and sets it `DIGITALLY_VERIFIED`; on `FIELD_VERIFICATION`
  sets the existing place `FIELD_VERIFIED`; on `CLOSURE` sets it `CLOSED`;
  other types record the verification event without changing overall
  status (see DECISIONS.md D12).
- Always recalculates the agent's reputation.
- `NEEDS_MORE_INFO` resets the task to `ASSIGNED` so the agent can resubmit.

## Not yet implemented (Phase 3 gaps, tracked)
Application-status/training-progress UI (API only), smart task-assignment
ranking, low-connectivity submission queueing, automated field-level Place
updates for CONTACT_VERIFICATION/LOCATION_VERIFICATION/UPDATE/PHOTO_TASK
(D12), real object storage for evidence photos (D13), EXIF stripping.

---

# Phase 4 — Rewards

## GET /api/agent/wallet
Requires login. Returns the caller's own wallet balances and 50 most
recent transactions.

## POST /api/agent/wallet/payout-request
Requires login. Rate-limited (5/hour/user). Body:
`{ "amountMinorUnits": number, "currency": string }`
- 201 → `{ "payout": {...} }` (status `PENDING`) — reserves the amount
  from the caller's approved balance immediately
- 400 `VALIDATION_ERROR` — below minimum withdrawal, unsupported currency
- 401 `UNAUTHORIZED` — fraud status is SUSPENDED
- 409 `CONFLICT` — insufficient approved balance

## GET /api/admin/rewards/rules
## POST /api/admin/rewards/rules
Requires `rewards.manage`. Body (POST):
`{ "activity": RewardActivityType, "amountMinorUnits": number, "currency": string }`
Upserts — posting again for the same activity updates the amount.

## POST /api/admin/wallet/confirm-earning
Requires `earnings.approve`. Body:
`{ "userId": uuid, "amountMinorUnits": number, "currency": string, "submissionId"?: uuid }`
Moves an amount from pending to approved. 409 if it exceeds the pending balance.

## POST /api/admin/wallet/bonus
Requires `earnings.approve`. Body:
`{ "userId": uuid, "amountMinorUnits": number, "currency": string, "reason": string }`
`reason` is mandatory — there is no bonus without one.

## GET /api/admin/payouts/config
## PUT /api/admin/payouts/config
GET is public (so a client can show minimums before requesting). PUT
requires `payouts.manage`. Body:
`{ "minimumWithdrawalMinorUnits": number, "supportedCurrencies": string[], "feeMinorUnits": number }`

## GET /api/admin/payouts
Requires `payouts.manage`. Query param `status` (default `PENDING`).

## POST /api/admin/payouts/:id/process
Requires `payouts.manage`. Body:
`{ "decision": "PAID"|"FAILED", "reference"?: string, "failureReason"?: string }`
`reference` is required when `decision` is `PAID`. `FAILED` returns the
reserved amount to the agent's approved balance.

## Not yet implemented (Phase 4 gaps, tracked)
Real payment provider integration, percentage-based fees, payout
batching/schedules, admin UI (API only), a reconciliation job comparing
Wallet cache totals against the WalletTransaction ledger sum.

---

# Phase 5 — Business System

## POST /api/business/claims
Requires login. Rate-limited (10/hour/user). Body:
`{ "placeId": uuid, "justification"?: string, "evidenceDescription"?: string }`
- 201 → `{ "claim": {...} }` (status `PENDING`)
- 409 `CONFLICT` — place already has a verified owner, or you already have a pending claim on it

## GET /api/admin/business/claims
Requires `business.claims.review`. Query param `status` (default `PENDING`).

## POST /api/admin/business/claims/:id/review
Requires `business.claims.review`. Body:
`{ "decision": "APPROVED"|"REJECTED", "rejectionReason"?: string }`
`rejectionReason` required when rejecting. Approval grants `BUSINESS_OWNER`,
sets ownership, and marks the place `OWNER_VERIFIED`.

## POST /api/business/updates
Requires `business.updates.submit` (i.e. the `BUSINESS_OWNER` role) — and
the caller must actually own the target place. Body:
`{ "placeId": uuid, "changes": { <allowed field>: <value>, ... } }`
Allowed fields: `phone`, `whatsapp`, `email`, `website`, `description`,
`openingHours`, `priceRange`, `paymentMethods`, `services`, `amenities`.
- 201 → `{ "updateRequest": {...} }` (status `PENDING` — nothing applied yet)
- 401 `UNAUTHORIZED` — caller doesn't own this place
- 400 `VALIDATION_ERROR` — a field outside the allowlist was included

## GET /api/business/dashboard
Requires login. Returns the caller's own owned places, claims, and update
requests (Section 113). No listing-view analytics or reports yet — both
are later-phase scope, not fabricated here.

## GET /api/admin/business/updates
Requires `business.updates.review`. Query param `status` (default `PENDING`).

## POST /api/admin/business/updates/:id/review
Requires `business.updates.review`. Body:
`{ "decision": "APPROVED"|"REJECTED", "reviewNotes"?: string }`
Approval applies the diff to the Place record and writes one
`PlaceChangeHistory` row per changed field.

## Not yet implemented (Phase 5 gaps, tracked)
Real identity/business-registry verification (D22), competing-claim
dispute resolution (D24), photo updates through this path, admin UI for
claims/updates (API only).

---

# Phase 6 — Tourist Platform

## GET /api/places
Public, rate-limited (60/min/IP). Now supports two modes:

**Geospatial** (provide `lat` + `lng`): `radiusMeters` (default 2000, max
100000), plus all filters below.

**Non-geospatial** (omit `lat`/`lng`): requires at least one of
`categoryId`, `cityId`, `q`.

Common query params: `categoryId`, `cityId`, `q` (name search),
`verifiedOnly` (`"true"`), `openNow` (`"true"`), `sort`
(`distance`|`freshness`|`name`), `limit` (max 100).

Response items now also include `lastVerifiedAt` and `openNow`
(`true`/`false`/`null` — `null` means opening hours simply aren't known,
never conflated with "closed").

## GET /api/places/:id/directions
Public. Returns `{ "url": "https://www.google.com/maps/dir/?..." }` — a
real, working deep link (spec Section 42, see DECISIONS.md D27).

## POST /api/places/:id/save
## DELETE /api/places/:id/save
Requires login. Idempotent — saving twice is not an error.

## GET /api/tourist/saved-places
Requires login. Returns the caller's saved places with place/category/city detail.

## POST /api/places/:id/report
Requires login. Rate-limited (20/hour/user). Body:
`{ "reason": ReportReason, "details"?: string }`
ReportReason: `WRONG_PHONE`, `CLOSED_BUSINESS`, `WRONG_LOCATION`,
`WRONG_HOURS`, `DUPLICATE`, `MISLEADING_INFORMATION`,
`UNSAFE_INFORMATION`, `INCORRECT_CATEGORY`, `OFFENSIVE_CONTENT`, `OTHER`.

## GET /api/admin/reports
Requires `reports.review`. Query param `status` (default `PENDING`).

## POST /api/admin/reports/:id/review
Requires `reports.review`. Body:
`{ "decision": "CREATE_VERIFICATION_TASK"|"DISMISS", "resolutionNotes"?: string }`
`CREATE_VERIFICATION_TASK` fails with 400 for reasons that have no task
mapping (`DUPLICATE`, `OFFENSIVE_CONTENT`) — use `DISMISS` or
`POST /api/admin/reports/:id/resolve` for those instead.

## POST /api/admin/reports/:id/resolve
Requires `reports.review`. Manually marks a report `RESOLVED` (e.g. after
its linked task's outcome, or direct investigation, satisfies it). Body:
`{ "resolutionNotes"?: string }`

## Not yet implemented (Phase 6 gaps, tracked)
Embedded interactive map (D27), review/rating system and "top rated" sort
(D28), listing-view analytics, admin UI for reports (API only).

---

# Phase 7 — Browser: not applicable
Deferred as native-app scope outside this codebase. See
BUILD_MASTER_CHECKLIST.md and ARCHITECTURE.md.

---

# Phase 8 — Travel Services

## GET /api/travel/emergency-numbers?countryId=
Public. Returns emergency numbers for a country, each with `service`,
`number`, `label`, `sourceDescription`, `lastVerifiedAt`.

## POST /api/admin/travel/emergency-numbers
Requires `emergency_numbers.manage`. Body:
`{ "countryId", "service": "GENERAL"|"POLICE"|"AMBULANCE"|"FIRE"|"OTHER", "number", "label"?, "sourceDescription", "sourceUrl"? }`
`sourceDescription` is mandatory — 400 without it. Upserts by
(country, service, number) — re-submitting the same number refreshes
`lastVerifiedAt`.

## GET /api/travel/safety-alerts?countryId=&cityId=
Public. Returns currently-active alerts (not expired, already started) —
country-wide alerts always included; city-specific alerts only when that
city is queried.

## POST /api/admin/travel/safety-alerts
Requires `safety_alerts.manage`. Body:
`{ "countryId", "cityId"?, "title", "description", "severity": "INFO"|"ADVISORY"|"WARNING", "sourceDescription", "sourceUrl"?, "expiresAt"? }`
`sourceDescription` mandatory.

## GET /api/travel/phrases?category=
Public. Returns phrasebook entries (English only — see D30). Categories:
`greetings`, `directions`, `emergency`, `shopping`.

## GET /api/travel/currency?from=&to=
Public. **Always returns 503** in the current build — see D31. Response:
`{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "..." } }`. This
is intentional, not a bug — do not "fix" it by hardcoding a rate.

## GET /api/travel/offline-package?countryId=
Requires login. Returns `{ syncedAt, savedPlaces: [...], emergencyNumbers: [...] }`
for the caller — a real, minimal offline-cacheable data export.

## Not yet implemented (Phase 8 gaps, tracked)
Real translation-provider integration, real exchange-rate provider,
automated alert ingestion from external sources, a true offline-sync
engine, location auto-detection on the Emergency page.

---

# Phase 9 — AI: not applicable
Deferred pending an AI provider API key. See BUILD_MASTER_CHECKLIST.md
and ARCHITECTURE.md.

---

# Phase 10 — Global Scale

## Admin API Key Management

### POST /api/admin/api-keys
Requires `api_keys.manage`. Body:
`{ "label", "organizationName"?, "scopes": ["places.read"|"categories.read"|"geography.read", ...], "rateLimitPerMinute"?, "expiresAt"? }`
- 201 → `{ "apiKey": { id, keyPrefix, label, scopes }, "rawKey": "tpk_..." }`
  **The `rawKey` is shown exactly once, in this response only.** There is
  no way to retrieve it again — losing it means revoking and creating a
  new key.

### GET /api/admin/api-keys
Requires `api_keys.manage`. Lists all keys (never including the hash).

### POST /api/admin/api-keys/:id/revoke
Requires `api_keys.manage`. Immediately blocks further use of that key.

## Versioned External API (v1)

All `/api/v1/*` routes require `Authorization: Bearer <rawKey>` instead
of a session cookie, and are read-only.

### GET /api/v1/places
Same query parameters as the internal `/api/places` search (Phase 6),
requires the `places.read` scope.

### GET /api/v1/places/:id
Requires `places.read`.

### GET /api/v1/categories
Requires `categories.read`.

### GET /api/v1/geography/countries
### GET /api/v1/geography/cities
Requires `geography.read`. `cities` accepts an optional `?regionId=` filter.

All v1 routes return:
- 401 `UNAUTHENTICATED` — missing or invalid key
- 403 `UNAUTHORIZED` — key revoked, expired, or missing the required scope
- 429 `RATE_LIMITED` — exceeded that key's configured per-minute limit

## City Coverage Targets

### POST /api/admin/coverage-targets
Requires `coverage_targets.manage`. Body: `{ "cityId", "categoryId", "targetCount" }`. Upserts.

### GET /api/admin/coverage-targets/:cityId
Requires `coverage_targets.manage`. Returns
`{ "coverage": [{ categoryId, categoryName, target, current, verified, gap }] }`
for every category with a configured target in that city.

## Not yet implemented (Phase 10 gaps, tracked)
Retrofitting internal routes to `/api/v1/` (D33 — deliberate), non-English
i18n content, i18n wired into any page, admin UI for API keys/coverage
targets (API only).
