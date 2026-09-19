# DEPLOYMENT.md (Phase 1)

## Environments
`APP_ENV` supports `development`, `staging`, `production`. Never point
local development at a production `DATABASE_URL` (spec Section 100).

## Required infrastructure for Phase 1
- PostgreSQL 15+ (any managed provider — RDS, Cloud SQL, Supabase, Neon,
  Render, etc. — or self-hosted). PostGIS extension is not required until
  Phase 2 but there's no harm enabling it now if your provider makes that
  easy.
- A Node.js 18+ runtime capable of running Next.js (Vercel, Render,
  Railway, Fly.io, a plain VM, etc.)

## Phase 2 addition: PostGIS + pg_trgm manual migration
After running `npx prisma migrate dev`, also run
`prisma/manual-sql/001-postgis-and-constraints.sql` against your database
once. This enables the `postgis` and `pg_trgm` extensions, adds coordinate
range CHECK constraints on `Place`, and creates a functional GiST index
for geospatial "nearby" queries. On Supabase: paste the file into
Dashboard -> SQL Editor -> Run. If `CREATE EXTENSION postgis` fails with a
permissions error, enable PostGIS from Dashboard -> Database -> Extensions
first, then re-run the rest of the file. Without this step, `/api/places`
nearby search will fail with a Postgres error about `st_dwithin` not
existing — that's the signal this step was skipped, not a code bug.

## Environment variables
See `.env.example` for the full list. At minimum for Phase 1:
`DATABASE_URL`, `APP_ORIGIN`, `NODE_ENV`, `APP_ENV`.

## Supabase-specific note
Supabase's default connection string routes through PgBouncer, which
doesn't support the prepared statements `prisma migrate` needs. The schema
uses `directUrl` (the Session/direct connection, port 5432) for migrations
and `url` (the Transaction pooler, port 6543, `?pgbouncer=true`) for the
running app. Both env vars (`DATABASE_URL`, `DIRECT_URL`) must be set —
see `.env.example`.

## Migrations
```bash
npx prisma migrate deploy   # production — applies committed migrations only
```
Never run `prisma migrate dev` against production; it's meant for local
schema iteration and can prompt for destructive resets.

## Reverse proxy / `x-forwarded-for` caveat
Phase 1's rate limiter and login-attempt logging trust the
`x-forwarded-for` header as-is. This is only safe if your deployment
platform's edge/proxy layer sets this header itself and strips any
client-supplied value before it reaches the app (true on Vercel; verify
for other hosts). If self-hosting behind nginx/Caddy, explicitly configure
the proxy to overwrite, not append to, this header.

## Secrets
Never commit `.env`. Use your platform's secret manager (Vercel
Environment Variables, AWS Secrets Manager, etc.) for `DATABASE_URL` and
any future provider API keys.

## What's NOT yet production-ready (see SECURITY.md for full list)
- In-memory rate limiting won't work correctly with more than one server
  instance — needs Redis before horizontal scaling.
- No MFA enforcement.
- No email/SMS delivery — verification tokens are issued but not sent.
- Phase 3 photo evidence storage is a local-filesystem dev adapter — it
  will not survive most redeploys and isn't safe for multiple instances.
  Replace `src/lib/storage/localFilesystemAdapter.ts` with a real
  S3-compatible adapter (implementing the same `PhotoStorageProvider`
  interface) before real users upload real photos. Supabase Storage is a
  natural fit since you're already on Supabase.

## Rollback
No destructive migrations exist yet in Phase 1 (only additive `CREATE
TABLE`s). Standard `prisma migrate resolve` / redeploy-previous-build
rollback applies. Disaster recovery procedures beyond this will be written
once there's real user data at stake (Phase 2+).
