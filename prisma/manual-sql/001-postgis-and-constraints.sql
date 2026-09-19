-- Phase 2 manual migration.
-- Run this AFTER `npx prisma migrate dev` has created the Place table.
--
-- Why manual, not a Prisma migration:
-- 1. Prisma's schema DSL has no way to express `CREATE EXTENSION` or a
--    functional GiST index on an expression, so this has to be raw SQL.
-- 2. On Supabase, enabling extensions sometimes requires the dashboard
--    (Database -> Extensions -> postgis) rather than a plain SQL grant,
--    depending on your plan/role. If the CREATE EXTENSION line below
--    fails with a permissions error, enable "postgis" from the Supabase
--    dashboard first, then re-run just the CHECK/INDEX statements below.
--
-- How to run on Supabase: Dashboard -> SQL Editor -> paste this file -> Run.
-- How to run locally: psql "$DIRECT_URL" -f prisma/manual-sql/001-postgis-and-constraints.sql

-- 1. Enable PostGIS (idempotent).
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Defense-in-depth: enforce valid coordinate ranges at the DB level,
--    even though the application layer also validates this (spec Section
--    123). A CHECK constraint means bad data can't get in even via a
--    direct DB write, a bug, or a future service that forgets to validate.
ALTER TABLE "Place"
  ADD CONSTRAINT place_latitude_range
  CHECK (latitude >= -90 AND latitude <= 90);

ALTER TABLE "Place"
  ADD CONSTRAINT place_longitude_range
  CHECK (longitude >= -180 AND longitude <= 180);

-- 3. Functional GiST index on a computed geography point, so "nearby"
--    queries (ST_DWithin) can actually use an index instead of scanning
--    every row. ST_MakePoint/::geography are immutable, so a functional
--    index is legal here.
CREATE INDEX IF NOT EXISTS place_geo_idx
  ON "Place"
  USING GIST (
    (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
  );

-- 4. Trigram similarity support for fuzzy name matching in duplicate
--    detection (spec Section 24). pg_trgm ships with Postgres contrib and
--    is enabled by default on Supabase in most plans.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS place_name_trgm_idx
  ON "Place"
  USING GIN (name gin_trgm_ops);
