# TESTING_STRATEGY.md (Phase 1)

## Levels

**Unit tests** (`tests/unit/`) — no database, no network. Cover pure logic:
password hashing/strength, RBAC permission resolution, error formatting,
rate limiter behavior. These run anywhere, including CI with no services.

**Integration tests** (`tests/integration/`) — require a real PostgreSQL
database reachable via `DATABASE_URL`. Cover the actual register → login →
session → revoke flow against real Prisma queries. These were **written
but not executed** during authoring (see PROJECT_AUDIT.md) — running them
is the first thing to do after cloning this project.

**End-to-end tests** — not yet written. Section 104 calls for E2E coverage
of tourist search, agent workflow, admin approval, business claim, and
report workflow — none of those features exist yet in Phase 1, so E2E
tests for them would be testing nothing. E2E for the auth pages (register
→ login → view admin page) is a reasonable Phase 1 addition using
Playwright; tracked as a near-term follow-up, not done in this pass to
keep Phase 1 scope honest.

## How to run

```bash
npm install
cp .env.example .env
# edit .env: set DATABASE_URL to a real Postgres instance

npx prisma generate
npx prisma migrate dev --name init

npm test              # unit + integration (integration needs DATABASE_URL)
npm run seed          # optional: creates clearly-labeled test accounts
npm run dev           # http://localhost:3000
```

## What "VERIFIED" requires for a Phase 1 checklist item
1. `npm test` passes with a real Postgres database.
2. The corresponding manual flow works via the UI (register, log in, view
   `/admin` with a seeded SUPER_ADMIN account, confirm a TOURIST account
   is denied).
3. No `console.error`/unhandled rejection in server logs during that flow.

Until you've done this and reported results, checklist items stay at
`IMPLEMENTED`, not `VERIFIED` — see BUILD_MASTER_CHECKLIST.md.

## Security-relevant test gaps to close before Phase 1 is truly done
- SQL injection / IDOR: Prisma parameterizes queries by default, but no
  explicit test currently exercises malicious input against the API routes.
- Session fixation / cookie tampering: no test yet forges a plausible-looking
  but invalid token to confirm rejection (partially covered by the
  "garbage token" integration test, but not an adversarial fuzz pass).
- Rate limit bypass via header spoofing (`x-forwarded-for` is trusted as-is
  in Phase 1, which is a known weakness behind a reverse proxy that doesn't
  set/sanitize it — see DEPLOYMENT.md).

## Integration tests run sequentially, not in parallel (see DECISIONS.md D16)
`vitest.config.ts` sets `fileParallelism: false`. All integration test
files share one live remote database (Supabase) over a pooled connection;
running them concurrently caused intermittent, spurious foreign-key
errors as a connection-pooling timing artifact, not a real bug. If you add
new integration test files, they'll automatically run sequentially with
the rest — no per-file configuration needed. Unit tests are unaffected
(they don't touch the database) and still run fast.
