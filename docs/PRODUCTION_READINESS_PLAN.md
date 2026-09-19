# PRODUCTION_READINESS_PLAN.md

This document plans out the work needed to close three categories of
known gap in the current build, tracked throughout `docs/DECISIONS.md`
and `docs/BUILD_MASTER_CHECKLIST.md`. Nothing here is built yet — this is
a plan, written so the next phase of work (by me or another engineer) has
a concrete starting point instead of a blank page.

---

## 1. Photo Storage: Local Filesystem → Real Object Storage + EXIF Stripping

### Current state (see DECISIONS.md D13)
`src/lib/storage/localFilesystemAdapter.ts` writes evidence photos to
`public/uploads/evidence/` on the server's local disk. This is
development-only: it doesn't survive most redeploys, isn't safe for more
than one server instance, and does not strip EXIF metadata (which can
contain the capturing device's GPS coordinates — a real privacy leak if
photos are ever published unmodified).

### Target architecture
The `PhotoStorageProvider` interface (`src/lib/storage/PhotoStorageProvider.ts`)
already exists and is the only thing every caller depends on
(`src/lib/agent/submissions.ts`). Closing this gap means writing one new
class that implements the same interface — nothing else in the codebase
changes.

### Recommended provider: Supabase Storage
Given the project is already on Supabase for Postgres, Supabase Storage
is the lowest-friction choice — same account, same billing, S3-compatible
API, no new vendor relationship to set up.

**Steps:**
1. In the Supabase dashboard: Storage → create a bucket named
   `evidence-photos`, set to private (not public) — evidence photos
   should not be directly guessable/URLable without authorization.
2. Add `SUPABASE_SERVICE_ROLE_KEY` to environment config (server-side
   only, never exposed to the client) — this is a different, more
   privileged key than the database connection string.
3. Implement `SupabaseStoragePhotoAdapter implements PhotoStorageProvider`:
   - `upload()`: call the Supabase JS client's `storage.from('evidence-photos').upload()`,
     return `{ storageKey: path, url: signedUrl }` where `signedUrl` is a
     time-limited signed URL (Supabase Storage supports this natively),
     not a permanent public link — evidence photos are internal review
     material, not meant for public CDN-style hosting.
   - `delete()`: call `storage.from('evidence-photos').remove([path])`.
4. Add EXIF stripping **before** upload, not after: use a pure-JS library
   with no native compilation step (avoiding the same native-binary risk
   flagged for Argon2 in D2) — `exifr` (read-only, for detecting GPS data
   present) combined with `piexifjs` (pure JS, can strip/rewrite EXIF on
   JPEGs) is a reasonable pairing. Strip all EXIF unconditionally rather
   than trying to selectively keep "safe" fields — simpler and safer.
5. Update `Evidence.exifStrippedAt` to actually be set to `new Date()`
   after a successful strip — currently it's permanently `null` by
   design (D13); this is the one field that should flip from "honestly
   null" to "honestly populated" once this work lands.
6. Feature-flag the swap: keep both adapters, select via
   `PHOTO_STORAGE_PROVIDER=local|supabase` env var, so staging/local dev
   can still avoid needing real Supabase Storage credentials.
7. **Data migration**: any evidence photos already stored locally (if any
   real ones exist by the time this lands) need a one-time migration
   script to re-upload them to Supabase Storage and update their `url`/
   `storageKey` — do not attempt this live in production without a
   maintenance window, since it involves rewriting foreign-referenced URLs.

### Effort estimate
- Adapter implementation + EXIF stripping: 1-2 days
- Testing (unit tests for EXIF stripping correctness, integration test
  against a real Supabase Storage bucket): 1 day
- Migration script for any existing local photos: half a day, only if needed

### Acceptance criteria before calling this done
- [ ] A newly uploaded photo has no EXIF GPS data when downloaded back
- [ ] Photos survive a full redeploy (not just a server restart)
- [ ] `Evidence.exifStrippedAt` is populated for every new upload
- [ ] Old local-adapter code path removed or clearly marked dev-only-fallback

---

## 2. Real External Providers: Payment, Currency, Translation

Each of these follows the same shape: an interface already exists
(Section 152 pattern), only a "not configured" or "manual" adapter is
implemented today, and closing the gap means writing one new adapter
class per provider — never touching the calling code.

### 2a. Payment/Payout Provider (see DECISIONS.md D21)

**Current state:** `ManualPayoutProvider` never moves money; a Finance
Administrator manually transfers funds outside the system and records a
reference number.

**Recommended provider for Ghana launch: a Mobile Money aggregator**
(e.g. Paystack, Flutterwave, or Hubtel — all support Ghanaian Mobile
Money networks — MTN MoMo, Vodafone Cash, AirtelTigo Money). Paystack has
the most mature developer documentation for Ghana specifically as of
early 2026 knowledge; verify current provider coverage/pricing before
committing, since fintech provider terms change.

**Steps:**
1. Register a business account with the chosen provider; obtain API
   secret key (server-side only).
2. Implement `PaystackPayoutProvider implements PayoutProvider`:
   - `processPayout()`: call the provider's transfer API with the
     recipient's Mobile Money number (this means `Payout`/`User` needs a
     new field to capture the recipient's Mobile Money number and network
     — not currently collected anywhere; add `MobileMoneyAccount` model:
     `userId`, `network` (MTN/VODAFONE/AIRTELTIGO), `phoneNumber`,
     `verifiedAt`).
   - Handle the provider's webhook callback for transfer status updates
     (transfers are often asynchronous — "PROCESSING" then later
     "SUCCESS"/"FAILED" via webhook, not a synchronous response). This
     needs a new webhook endpoint (`POST /api/webhooks/payout-provider`)
     with signature verification (every provider signs webhook payloads;
     verify this or the endpoint is spoofable).
3. Map provider status callbacks to existing `Payout.status` transitions
   via the existing `processPayout()` ledger logic in
   `src/lib/rewards/payouts.ts` — the ledger/ (D18) already handles
   PAID/FAILED correctly; the only change is what triggers those calls
   (a webhook instead of an admin's manual API call).
4. **Critical: idempotency.** Payment webhooks can be delivered more than
   once. Before applying a PAID/FAILED transition, check the payout isn't
   already in a terminal state (the existing code already does this via
   the `status !== "PENDING" && status !== "PROCESSING"` guard — verify
   it still holds once webhooks can arrive concurrently with admin action).
5. Sandbox-test thoroughly with the provider's test/sandbox credentials
   before any real transfer — a bug here moves real money.

**Effort estimate:** 1-2 weeks including webhook handling, idempotency
hardening, and sandbox testing. This is the highest-risk integration in
this plan (real money) — budget real QA time, not just implementation time.

### 2b. Currency Conversion Provider (see DECISIONS.md D31)

**Current state:** `UnavailableCurrencyProvider` always throws.

**Recommended provider:** exchangerate-api.com or Open Exchange Rates —
both have a free tier sufficient for a launch-stage product (1,500
requests/month typically covers currency-display use cases if rates are
cached, see below).

**Steps:**
1. Get a free-tier API key.
2. Implement `ExchangeRateApiCurrencyProvider implements CurrencyProvider`:
   `convert()` calls the provider's `/latest/{base}` endpoint, returns
   `{ fromCurrency, toCurrency, rate, asOf: <provider's timestamp>, source: "exchangerate-api.com" }`.
3. **Cache aggressively** — exchange rates don't need to be looked up on
   every request. Cache per currency-pair for e.g. 1 hour (a `SystemSetting`-style
   cached-value table, or Redis if that's already been introduced for
   rate limiting by then) to stay well within free-tier limits and avoid
   adding latency to every currency-display request.
4. Update the `/api/travel/currency` route to no longer hard-return 503 —
   it should now return real rates, still labeled with `asOf` and
   `source` per spec Section 50's "never imply exact" requirement.
5. Add a fallback: if the provider call fails (rate-limited, down, etc.),
   return the 503 "unavailable" response Phase 8 already implemented —
   don't fall back to a stale cached rate presented as current without a
   clear "as of [older timestamp]" label.

**Effort estimate:** 2-3 days including caching.

### 2c. Translation Provider (see DECISIONS.md D30)

**Current state:** `TravelPhrase.translations` is an empty JSON object
for every phrase; only English content exists.

**Two real options, not mutually exclusive:**

**Option A — Machine translation via a real API** (DeepL, Google
Translate API, or Anthropic/OpenAI for phrase-level translation with a
careful prompt). Fast, cheap, but machine translation of short
safety-critical phrases ("call the police," "I need a doctor") can still
be subtly wrong in ways a fluent speaker would catch immediately.
**Recommendation: use this only for non-critical categories** (greetings,
shopping) and require human review before publishing anything in the
`emergency` category.

**Option B — Professional human translation**, at minimum for the
`emergency` and `directions` categories, given the safety stakes
identified in D30. This could be a small paid engagement (translating 18
short phrases into, say, Twi and French is not a large task) rather than
a full localization program.

**Steps (recommended hybrid):**
1. Implement a `TranslationProvider` interface (doesn't exist yet — add
   it, same Section 152 pattern) with a machine-translation adapter for
   bulk/non-critical content.
2. For the `emergency` category specifically, do not auto-populate from
   the machine adapter — leave those rows for manual entry via the
   (currently nonexistent, would need building) admin phrase-editing UI,
   after human translation review.
3. Add a `TravelPhrase.translationSource` field (`"machine"` |
   `"human_reviewed"`) so the app can, if desired, visually distinguish
   machine-translated content from reviewed content to the end user —
   transparency about translation quality/provenance matters more for
   safety-critical phrases.

**Effort estimate:** Machine-translation adapter: 2-3 days. Human
translation sourcing for emergency/directions phrases: depends on finding
a translator, likely 1-2 weeks of calendar time (mostly waiting), small
implementation cost.

---

## 3. Remaining Architectural Gaps (from item #8)

### 3a. Business Claim Dispute Resolution (see DECISIONS.md D24)

**Current state:** a place with an approved owner rejects all further
claims outright. No mechanism exists for a legitimate second claimant
(e.g. a business changed hands, or the wrong person was approved) to
contest this.

**Proposed design:**
1. New `BusinessClaimDispute` model: `id`, `placeId`, `disputingUserId`,
   `currentOwnerUserId`, `reason`, `evidenceDescription`, `status`
   (`PENDING`, `RESOLVED_KEPT_CURRENT_OWNER`, `RESOLVED_TRANSFERRED`),
   `resolvedByUserId`, `resolvedAt`, `resolutionNotes`.
2. New endpoint: `POST /api/business/claims/dispute` — lets an
   authenticated user file a dispute against an already-owned place
   (separate from the existing `submitClaim`, which still rejects
   outright for owned places — the dispute path is the deliberate
   escape hatch).
3. Admin review endpoint: `POST /api/admin/business/disputes/:id/resolve`
   with `decision: "KEEP_CURRENT_OWNER" | "TRANSFER_TO_DISPUTANT"`.
   `TRANSFER_TO_DISPUTANT` should: revoke the current owner's
   `BUSINESS_OWNER` role **only if they own no other places** (check
   before revoking — a business owner with multiple listings shouldn't
   lose the role entirely over one disputed listing), set
   `Place.ownerUserId` to the disputant, grant them `BUSINESS_OWNER`,
   and write a `PlaceChangeHistory` entry documenting the transfer with
   the dispute's reasoning attached for auditability.
4. This should almost certainly require **more evidence** than an
   initial claim (Section 112's "business disputes" implies a
   higher-scrutiny process) — consider requiring the disputant to explain
   why the current owner is wrong, not just why they themselves are right.

**Effort estimate:** 3-4 days (schema, two endpoints, careful handling of
the "owns other places" edge case, tests).

### 3b. Wallet Ledger Reconciliation Job (see DECISIONS.md D18)

**Current state:** `Wallet`'s four cached balance fields are always
updated in the same transaction as the `WalletTransaction` that
justifies the change — by construction, they should never drift. No
process currently *verifies* that assumption continues to hold as the
codebase grows and more people touch this code.

**Proposed design:**
1. A scheduled job (cron, or a Vercel/hosting-platform scheduled
   function) run e.g. daily: for every `Wallet` row, recompute
   pending/approved/paid/reversed totals by summing `WalletTransaction`
   rows by type, and compare against the cached `Wallet` fields.
2. Any mismatch is a serious bug — log loudly (not just a warning) and
   ideally alert a human (email/Slack webhook) rather than silently
   auto-correcting the cached value, since auto-correcting could mask a
   real bug that then keeps happening. A `WalletReconciliationLog` table
   recording each run's findings (even "no drift found") gives an audit
   trail showing this check has actually been running.
3. This is pure insurance — if it never finds drift, that's success, not
   evidence it was unnecessary to build.

**Effort estimate:** 1-2 days.

### 3c. True Offline-Sync Engine (see spec Section 51, current state: data export only)

**Current state:** `GET /api/travel/offline-package` returns a JSON
snapshot (saved places + emergency numbers) with a `syncedAt` timestamp.
There is no client-side caching, no service worker, no conflict
resolution, and no incremental sync (every call re-fetches everything).

**Proposed design (meaningfully larger effort than the other items here):**
1. This is fundamentally a **client-side** (browser/mobile app) feature,
   not primarily a backend one — a service worker (for the web platform)
   or platform-native local storage (for a future native app, tying back
   to the deferred Phase 7) needs to actually cache the exported package
   and serve it when offline.
2. Incremental sync: change the export endpoint to accept a
   `since=<lastSyncedAt>` parameter and return only what changed
   (new/updated saved places, changed emergency numbers) rather than a
   full snapshot every time — meaningful for users with many saved places.
3. Conflict resolution is largely a non-issue for this specific data (saved
   places and emergency numbers are effectively read-only from the
   client's perspective — the client caches, it doesn't edit offline and
   sync back). If offline *editing* is ever added (e.g. drafting a report
   while offline), that's a substantially bigger problem requiring a real
   conflict-resolution strategy (last-write-wins at minimum, ideally
   operational-transform or CRDT-based for anything more sophisticated) —
   out of scope until offline editing is actually a real requirement.

**Effort estimate:** Incremental sync backend change: 2-3 days. Real
client-side offline caching: this is really a separate, substantial
project (service worker architecture, cache invalidation, testing across
browsers) — budget 2-3 weeks if pursued seriously, and it may make more
sense to build once a decision is made about Phase 7's native app
direction, since a native app's offline story looks quite different from
a PWA's.

---

## Suggested Prioritization

If tackling these in order of (safety/financial risk × user impact) ÷ effort:

1. **Wallet reconciliation job** (3a) — cheap insurance, do this first regardless of what else happens.
2. **Photo storage → Supabase Storage + EXIF stripping** (1) — closes a real privacy gap, moderate effort.
3. **Currency provider** (2b) — cheap, clear user value, low risk (worst case is "unavailable," same as today).
4. **Payment/payout provider** (2a) — highest effort and highest risk (real money), but also the item most necessary before agents can actually be paid in practice. Budget real QA time.
5. **Translation provider** (2c) — valuable but not urgent; sequence the human-review track for emergency phrases in parallel with everything else since it's mostly calendar time, not engineering time.
6. **Business dispute resolution** (3a) — build once real claim volume makes disputes a real (not hypothetical) problem.
7. **True offline-sync** (3c) — the biggest and most architecture-dependent item; reasonable to defer until Phase 7's native-app direction is decided, since that decision changes what "offline" even means for this product.
