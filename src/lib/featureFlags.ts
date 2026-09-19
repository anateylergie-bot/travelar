import { db } from "@/lib/db";

// Spec Section 116. DB is the source of truth so admins can toggle flags
// without a redeploy (Section 128); env vars act only as the initial
// default when a flag row doesn't exist yet (e.g. right after migration).
export async function isFeatureEnabled(key: string): Promise<boolean> {
  const row = await db.featureFlag.findUnique({ where: { key } });
  if (row) return row.enabled;

  const envKey = key.toUpperCase();
  return process.env[envKey] === "true";
}

export async function setFeatureFlag(key: string, enabled: boolean, updatedBy: string): Promise<void> {
  await db.featureFlag.upsert({
    where: { key },
    update: { enabled, updatedBy },
    create: { key, enabled, updatedBy },
  });
}
