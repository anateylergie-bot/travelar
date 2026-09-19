import { db } from "@/lib/db";
import { logger } from "@/lib/logging/logger";

export async function writeAuditLog(params: {
  actorUserId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata as any,
        ipAddress: params.ipAddress ?? null,
      },
    });
  } catch (err) {
    // Audit logging must never crash the request it's observing, but a
    // failure here is itself a security-relevant event worth a loud log.
    logger.error({ err, action: params.action }, "Failed to write audit log");
  }
}
