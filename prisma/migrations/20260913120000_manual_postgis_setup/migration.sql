CREATE EXTENSION IF NOT EXISTS postgis;

ALTER TABLE "Place"
  ADD CONSTRAINT place_latitude_range
  CHECK (latitude >= -90 AND latitude <= 90);

ALTER TABLE "Place"
  ADD CONSTRAINT place_longitude_range
  CHECK (longitude >= -180 AND longitude <= 180);

CREATE INDEX IF NOT EXISTS place_geo_idx
  ON "Place"
  USING GIST (
    (ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
  );

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS place_name_trgm_idx
  ON "Place"
  USING GIN (name gin_trgm_ops);
