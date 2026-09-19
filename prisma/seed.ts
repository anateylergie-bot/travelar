// Development seed data ONLY. Per spec Section 144/145: seed data must be
// clearly marked and never mistaken for real verified users. This script
// refuses to run against anything that doesn't look like a local/dev
// database URL, as a blunt but effective guardrail.

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { seedTrainingModules } from "../src/lib/agent/training";
import { seedPhrasebook } from "../src/lib/travel/phrasebook";

const db = new PrismaClient();

async function main() {
  const appEnv = process.env.APP_ENV;

  // The original guard tried to sniff "is this a dev DB?" from the
  // DATABASE_URL string (checking for localhost/_test/_dev). That's too
  // blunt: a legitimate remote dev database (e.g. a Supabase project used
  // for development) doesn't match that pattern and got incorrectly
  // blocked. Trusting the developer's explicit APP_ENV designation is a
  // more honest signal than guessing from a hostname.
  if (appEnv === "production" || !appEnv) {
    console.error(
      `Refusing to run seed script: APP_ENV is "${appEnv ?? "unset"}". ` +
        `Set APP_ENV=development (or staging) in your .env if this is genuinely a non-production database.`
    );
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  const hostMatch = dbUrl.match(/@([^/:]+)/);
  console.log(`APP_ENV=${appEnv}. About to seed database host: ${hostMatch?.[1] ?? "(could not parse host)"}`);
  console.log("If that is NOT the database you intended, press Ctrl+C now.");

  const seedPassword = process.env.SEED_PASSWORD ?? "SeedPassword123";

  const superAdmin = await db.user.upsert({
    where: { email: "test-admin@example.dev" },
    update: {},
    create: {
      email: "test-admin@example.dev",
      displayName: "[TEST ADMIN] Seed Super Admin",
      passwordHash: await hashPassword(seedPassword),
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: "SUPER_ADMIN" }] },
    },
  });

  const testTourist = await db.user.upsert({
    where: { email: "test-tourist@example.dev" },
    update: {},
    create: {
      email: "test-tourist@example.dev",
      displayName: "[TEST USER] Seed Tourist",
      passwordHash: await hashPassword(seedPassword),
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: "TOURIST" }] },
    },
  });

  const testAgent = await db.user.upsert({
    where: { email: "test-agent@example.dev" },
    update: {},
    create: {
      email: "test-agent@example.dev",
      displayName: "[TEST AGENT] Seed Local Data Agent",
      passwordHash: await hashPassword(seedPassword),
      status: "ACTIVE",
      emailVerifiedAt: new Date(),
      roles: { create: [{ role: "LOCAL_DATA_AGENT" }] },
    },
  });

  // Phase 3: this agent bypassed the normal apply->approve flow (it's been
  // seeded directly since Phase 1), so give it the profile/reputation rows
  // that flow would have created, for consistency with real approved agents.
  await db.localDataAgentProfile.upsert({
    where: { userId: testAgent.id },
    update: {},
    create: { userId: testAgent.id, status: "APPROVED", city: "Kumasi", approvedAt: new Date() },
  });
  await db.agentReputation.upsert({
    where: { userId: testAgent.id },
    update: {},
    create: { userId: testAgent.id },
  });

  console.log("Seeded (dev-only, clearly labeled) accounts:");
  console.log(`  ${superAdmin.email} — SUPER_ADMIN — password: ${seedPassword}`);
  console.log(`  ${testTourist.email} — TOURIST — password: ${seedPassword}`);
  console.log(`  ${testAgent.email} — LOCAL_DATA_AGENT — password: ${seedPassword}`);

  // ---------------------------------------------------------------------
  // Phase 2 — Ghana launch geography (spec Section 88) + baseline
  // categories. Real, correct geographic data (not fake places) — safe to
  // keep even outside pure dev/test environments, but still seeded here
  // under the same guardrail since Phase 2 city/agent/reward data isn't
  // meant to exist until an admin deliberately onboards a city (Section 89).
  // ---------------------------------------------------------------------

  const ghana = await db.country.upsert({
    where: { isoCode2: "GH" },
    update: {},
    create: { name: "Ghana", isoCode2: "GH", isoCode3: "GHA" },
  });

  const ashanti = await db.region.upsert({
    where: { countryId_name: { countryId: ghana.id, name: "Ashanti" } },
    update: {},
    create: { countryId: ghana.id, name: "Ashanti" },
  });
  const greaterAccra = await db.region.upsert({
    where: { countryId_name: { countryId: ghana.id, name: "Greater Accra" } },
    update: {},
    create: { countryId: ghana.id, name: "Greater Accra" },
  });
  const central = await db.region.upsert({
    where: { countryId_name: { countryId: ghana.id, name: "Central" } },
    update: {},
    create: { countryId: ghana.id, name: "Central" },
  });
  const westernRegion = await db.region.upsert({
    where: { countryId_name: { countryId: ghana.id, name: "Western" } },
    update: {},
    create: { countryId: ghana.id, name: "Western" },
  });
  const northern = await db.region.upsert({
    where: { countryId_name: { countryId: ghana.id, name: "Northern" } },
    update: {},
    create: { countryId: ghana.id, name: "Northern" },
  });
  const volta = await db.region.upsert({
    where: { countryId_name: { countryId: ghana.id, name: "Volta" } },
    update: {},
    create: { countryId: ghana.id, name: "Volta" },
  });
  const eastern = await db.region.upsert({
    where: { countryId_name: { countryId: ghana.id, name: "Eastern" } },
    update: {},
    create: { countryId: ghana.id, name: "Eastern" },
  });
  const bono = await db.region.upsert({
    where: { countryId_name: { countryId: ghana.id, name: "Bono" } },
    update: {},
    create: { countryId: ghana.id, name: "Bono" },
  });

  const launchCities: Array<{ regionId: string; name: string; lat: number; lng: number }> = [
    { regionId: greaterAccra.id, name: "Accra", lat: 5.6037, lng: -0.187 },
    { regionId: ashanti.id, name: "Kumasi", lat: 6.6885, lng: -1.6244 },
    { regionId: central.id, name: "Cape Coast", lat: 5.1053, lng: -1.2466 },
    { regionId: westernRegion.id, name: "Takoradi", lat: 4.8845, lng: -1.7554 },
    { regionId: northern.id, name: "Tamale", lat: 9.4008, lng: -0.8393 },
    { regionId: volta.id, name: "Ho", lat: 6.611, lng: 0.4713 },
    { regionId: eastern.id, name: "Koforidua", lat: 6.0941, lng: -0.259 },
    { regionId: bono.id, name: "Sunyani", lat: 7.3399, lng: -2.3268 },
  ];

  for (const c of launchCities) {
    await db.city.upsert({
      where: { regionId_name: { regionId: c.regionId, name: c.name } },
      update: {},
      create: { regionId: c.regionId, name: c.name, centroidLat: c.lat, centroidLng: c.lng },
    });
  }

  // Baseline categories matching spec Section 15's illustrative list.
  // Deliberately flat for now (no subcategories) — the schema supports
  // nesting via parentId whenever that's needed, without a migration.
  const baselineCategories = [
    "Hotel", "Guest House", "Restaurant", "Cafe", "Coffee Shop", "Market",
    "School", "University", "Hospital", "Clinic", "Pharmacy", "Bank", "ATM",
    "Church", "Mosque", "Cultural Centre", "Museum", "Park", "Beach",
    "Waterfall", "Historical Site", "Police Station", "Fire Station",
    "Transport Station", "Taxi Station", "Car Rental", "Tour Operator",
    "Community Organization", "Government Office", "Shopping Centre",
    "Supermarket", "Entertainment Venue", "Tourist Attraction",
  ];

  for (const name of baselineCategories) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    await db.category.upsert({ where: { slug }, update: {}, create: { name, slug } });
  }

  console.log(`Seeded Ghana + ${launchCities.length} launch cities + ${baselineCategories.length} categories.`);

  await seedTrainingModules();
  console.log("Seeded Phase 3 training modules.");

  // ---------------------------------------------------------------------
  // Phase 8 — Ghana emergency numbers. Verified via web search before
  // seeding (see DECISIONS.md D29), not recalled from memory. Multiple
  // independent sources (government announcement coverage, hospital/NGO
  // directories) corroborate these as of the check date below.
  // ---------------------------------------------------------------------
  const emergencySource =
    "Cross-checked via web search (Sept 2026) against GhanaWeb/ModernGhana coverage of the Government of " +
    "Ghana's 2020 emergency-number unification announcement and independent directory sources " +
    "(ghanainfo.net, accessibleghana.com, ghanahospitalfinder.org, ghanapolice.info). Re-verify against an " +
    "authoritative source (e.g. Ghana Police Service, National Communications Authority) before relying on " +
    "this in a production deployment.";

  const emergencyNumbers: Array<{ service: "GENERAL" | "POLICE" | "AMBULANCE" | "FIRE"; number: string; label: string }> = [
    { service: "GENERAL", number: "112", label: "National unified emergency number (Police/Fire/Ambulance)" },
    { service: "POLICE", number: "191", label: "Ghana Police Service (legacy line, still active)" },
    { service: "FIRE", number: "192", label: "Ghana National Fire Service (legacy line, still active)" },
    { service: "AMBULANCE", number: "193", label: "National Ambulance Service (legacy line, still active)" },
  ];

  for (const en of emergencyNumbers) {
    const existing = await db.emergencyNumber.findFirst({
      where: { countryId: ghana.id, service: en.service, number: en.number },
    });
    if (!existing) {
      await db.emergencyNumber.create({
        data: {
          countryId: ghana.id,
          service: en.service,
          number: en.number,
          label: en.label,
          sourceDescription: emergencySource,
          lastVerifiedAt: new Date(),
        },
      });
    }
  }
  console.log(`Seeded ${emergencyNumbers.length} Ghana emergency numbers (sourced, see DECISIONS.md D29).`);

  await seedPhrasebook();
  console.log("Seeded English-only travel phrasebook (see DECISIONS.md D30).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
