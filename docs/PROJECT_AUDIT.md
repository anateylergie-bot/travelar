# PROJECT_AUDIT.md

**Date:** 2026-09-13
**Status:** Greenfield project — no pre-existing repository.

## Current Architecture
None. This is a new build. This audit documents the baseline decisions made
before Phase 1 implementation, and the constraints of the environment the
code was authored in.

## Existing Functionality
None.

## Existing Dependencies
None.

## Existing Database
None.

## Existing Routes / APIs
None.

## Existing Security Controls
None.

## Build Environment Constraints (IMPORTANT — read before assuming test results)

The initial scaffold was authored inside a sandboxed container with:

- **No outbound network access** (verified: requests to `registry.npmjs.org`
  return `403 host_not_allowed`). This means `npm install`, `prisma migrate`,
  and any command requiring package-registry or database-server network
  access **could not be executed or verified inside that environment**.
- **No running PostgreSQL server** and no way to start one without network
  access to fetch/install it.

**Consequence:** code, schema, and tests for Phase 1 were written to be
correct and complete, but were **not run** in the authoring environment.
They must be installed and run in a real environment (local machine, CI,
or cloud dev environment) before any checklist item is marked `TESTING` or
`VERIFIED`. This is called out explicitly to comply with the project rule
that nothing is marked verified without passing tests.

## Recommended Architecture (Phase 1 baseline)

- **Framework:** Next.js 14 (App Router) + TypeScript, chosen so the same
  codebase can serve the Tourist Web Platform (Layer B) and Admin Command
  Centre (Layer E) UI, plus API routes, without a separate backend service
  in early phases. A dedicated API service can be split out later if load
  requires it — the API route handlers are written as thin wrappers around
  framework-agnostic service functions in `src/lib/` for exactly this reason.
- **Database:** PostgreSQL via Prisma ORM. PostGIS extension is required
  starting Phase 2 (geospatial Place queries) — not needed for Phase 1.
- **Auth:** Custom email/password + DB-backed session tokens (not JWT-in-cookie),
  so sessions can be listed, revoked, and audited server-side (spec Section 8:
  "device/session management"). Phone/OTP and social auth are designed for via
  an `AuthProvider` abstraction but not implemented in Phase 1 (no SMS provider
  configured — see DECISIONS.md).
- **Password hashing:** bcrypt (via `bcryptjs`, pure-JS, no native build step —
  chosen deliberately since native modules (e.g. `argon2`) cannot be compiled
  in network-restricted CI/sandbox environments; revisit in DECISIONS.md if a
  build environment with native compilation is confirmed).
- **Validation:** Zod schemas at every API boundary (spec Section 83 — never
  trust client input).
- **Logging:** Pino structured logger, redacting sensitive fields (Section 81).

## Migration Requirements
N/A for Phase 1 (greenfield). Future phases must write additive Prisma
migrations — never hand-edit production schema (Section 101).

## Missing Infrastructure (tracked, not blocking Phase 1)
- PostGIS-backed geospatial layer (Phase 2)
- Object storage abstraction for photos (Phase 3)
- Payment/payout provider abstraction (Phase 4)
- Threat intelligence provider (Phase 7)
- AI provider abstraction (Phase 9)
- Map/geocoding/currency/translation provider abstractions (Phase 6/8)

All of the above will be built as interface + local adapter + feature flag,
per Section 152, when their phase arrives — not stubbed with fake data now.
