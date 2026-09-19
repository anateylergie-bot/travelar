# TravelSafe Platform — Phase 1 (Foundation)

This is Phase 1 of the multi-phase build described in the project spec:
authentication, RBAC, audit logging, and a minimal admin foundation.
**No Places, agents, rewards, browser, or AI features exist yet** — those
are later phases (see `docs/BUILD_MASTER_CHECKLIST.md`).

## ⚠️ Before you trust anything here
This codebase was authored in a network-isolated sandbox and **has not
been run** — no `npm install`, no live database, no executed test suite.
Everything is written to be correct and complete, but "written correctly"
and "verified working" are different claims, and the project's own rules
(see spec Section 1, 170) require I not blur that line. Follow the setup
below, run the tests, and tell me what breaks — I'll fix it immediately.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env — set DATABASE_URL and DIRECT_URL (see Supabase note below).

npx prisma generate
npx prisma migrate dev --name init          # Phase 1 tables
npx prisma migrate dev --name phase2_local_data_engine   # Phase 2 tables
npx prisma migrate dev --name phase3_agent_platform       # Phase 3 tables
npx prisma migrate dev --name phase4_rewards              # Phase 4 tables
npx prisma migrate dev --name phase5_business_system       # Phase 5 tables
npx prisma migrate dev --name phase6_tourist_platform       # Phase 6 tables
npx prisma migrate dev --name phase8_travel_services         # Phase 8 tables (Phase 7 is deferred, see docs)
npx prisma migrate dev --name phase10_global_scale            # Phase 10 tables (Phase 9 is deferred, see docs)

# Then, ONCE, run this against your DB (Supabase: SQL Editor; else: psql):
#   prisma/manual-sql/001-postgis-and-constraints.sql
# Enables PostGIS + pg_trgm, adds coordinate CHECK constraints, and a
# geospatial index. Nearby-place search will error without this step.

npm test            # runs unit tests always; integration tests need DATABASE_URL (+ PostGIS for Phase 2/3 tests)
npm run seed        # creates test accounts + Ghana launch geography + baseline categories + training modules
npm run dev         # http://localhost:3000
```

### Supabase connection strings
Supabase's pooled connection (PgBouncer) can't run migrations. Get both
from Project Settings -> Database -> Connection string:
- `DATABASE_URL` = Transaction pooler (port 6543), append `?pgbouncer=true`
- `DIRECT_URL` = Session/direct connection (port 5432)

Seeded accounts (only if you run `npm run seed`), all password
`SeedPassword123` unless you set `SEED_PASSWORD`:
- `test-admin@example.dev` — SUPER_ADMIN — can view `/admin`
- `test-tourist@example.dev` — TOURIST — cannot view `/admin`
- `test-agent@example.dev` — LOCAL_DATA_AGENT — can create places via the API

## What to check after setup
1. `npm test` — unit tests need zero setup; integration tests need a real
   DB (Phase 2's also need the PostGIS manual SQL step above).
2. Register a new account at `/register`, then log in at `/login`.
3. Log in as the seeded SUPER_ADMIN and confirm `/admin` shows a user list.
4. Log in as the seeded TOURIST and confirm `/admin` shows "no permission."
5. Hit `/api/health` and confirm `{"status":"ok"}`.
6. After seeding, try `GET /api/places?lat=6.6885&lng=-1.6244&radiusMeters=5000`
   (Kumasi coordinates) — should return `{"places":[]}` until you create a
   place via `POST /api/places` (needs a `places.create` role — log in as
   the seeded agent and use its session cookie, or a REST client).
7. Visit `/agent` while logged in as `test-agent@example.dev` — should
   show the agent dashboard (reputation, tasks, earnings) since that seed
   account already has an APPROVED profile.
8. Visit `/business` while logged in as any account — will show "no
   verified listings yet" until a claim is approved (no business seed
   account exists yet; submit a claim via the API and approve it as
   `test-admin@example.dev` to see the full dashboard).
9. Visit `/explore` and search for "Place" (matches seeded Ghana data if
   you've created any places) — try both with and without a city ID.
10. Click into a place's `/places/[id]` page — try Save, Get Directions,
    and submitting a report.
11. Visit `/emergency` — should show Ghana's emergency numbers as
    clickable `tel:` links, and a "Share my location" button (uses your
    browser's real geolocation permission prompt).
12. Try `GET /api/travel/currency?from=USD&to=GHS` — should return a 503
    with a clear "unavailable" message. **This is correct, expected
    behavior**, not a bug — see docs/DECISIONS.md D31 for why we didn't
    hardcode a fake exchange rate.
13. As `test-admin@example.dev`, create an API key via
    `POST /api/admin/api-keys` with `{"label":"test","scopes":["places.read"]}`
    — copy the `rawKey` from the response (shown only once), then try
    `GET /api/v1/places?lat=6.6885&lng=-1.6244&radiusMeters=5000` with
    header `Authorization: Bearer <rawKey>`.

All 10 phases are now either built-and-verified or deliberately deferred
with a documented reason (Phase 7: native app, out of scope for this
codebase; Phase 9: needs a real AI provider key). Report back what
passes/fails on this batch, and let me know if/when you want to revisit
Phase 7 or 9.

## Documentation index
- `docs/PROJECT_AUDIT.md` — baseline & environment constraints
- `docs/ARCHITECTURE.md` — tech choices and structure
- `docs/SECURITY.md` — controls implemented + known gaps
- `docs/DATABASE_SCHEMA.md` — model rationale
- `docs/API_DOCUMENTATION.md` — endpoint reference
- `docs/TESTING_STRATEGY.md` — how to verify this actually works
- `docs/DEPLOYMENT.md` — running this for real
- `docs/DATA_GOVERNANCE.md` — what personal data exists and its status
- `docs/DECISIONS.md` — judgment calls and why
- `docs/BUILD_MASTER_CHECKLIST.md` — feature-by-feature status, all phases
