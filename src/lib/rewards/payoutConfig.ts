import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";

// Spec Section 38: "Allow administrators to configure: Minimum withdrawal,
// Fees, Supported currencies, Payment schedules. Do not hard-code these
// values." Stored under SystemSetting (Phase 1's key-value config table)
// rather than a dedicated model, since it's a single small config object.

const SETTING_KEY = "payout.config";

export interface PayoutConfig {
  minimumWithdrawalMinorUnits: number;
  supportedCurrencies: string[];
  feeMinorUnits: number; // flat fee for now; percentage-based fees are a documented follow-up
}

const DEFAULT_CONFIG: PayoutConfig = {
  minimumWithdrawalMinorUnits: 2000, // e.g. GHS 20.00 — a reasonable default, not a claim it's the "right" number
  supportedCurrencies: ["GHS"],
  feeMinorUnits: 0,
};

export async function getPayoutConfig(): Promise<PayoutConfig> {
  const row = await db.systemSetting.findUnique({ where: { key: SETTING_KEY } });
  if (!row) return DEFAULT_CONFIG;
  return row.value as unknown as PayoutConfig;
}

export async function setPayoutConfig(config: PayoutConfig, updatedByUserId: string): Promise<PayoutConfig> {
  if (config.minimumWithdrawalMinorUnits < 0 || config.feeMinorUnits < 0) {
    throw new AppError("VALIDATION_ERROR", "Payout config amounts cannot be negative.");
  }
  if (config.supportedCurrencies.length === 0) {
    throw new AppError("VALIDATION_ERROR", "At least one supported currency is required.");
  }

  await db.systemSetting.upsert({
    where: { key: SETTING_KEY },
    update: { value: config as any, updatedBy: updatedByUserId },
    create: { key: SETTING_KEY, value: config as any, updatedBy: updatedByUserId },
  });

  return config;
}
