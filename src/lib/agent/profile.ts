import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";

// Spec Section 19: application process, collecting only necessary info.
// Spec Section 7/D15: applying does NOT grant the LOCAL_DATA_AGENT role —
// only approval does.

export interface ApplyAsAgentInput {
  userId: string;
  city?: string;
  area?: string;
  preferredLanguage?: string;
  availability?: string;
  experience?: string;
}

export async function applyAsAgent(input: ApplyAsAgentInput) {
  const existing = await db.localDataAgentProfile.findUnique({ where: { userId: input.userId } });
  if (existing) {
    throw new AppError("CONFLICT", `You already have an agent application (status: ${existing.status}).`);
  }

  return db.localDataAgentProfile.create({
    data: {
      userId: input.userId,
      city: input.city,
      area: input.area,
      preferredLanguage: input.preferredLanguage,
      availability: input.availability,
      experience: input.experience,
      status: "PENDING_APPROVAL",
    },
  });
}

export async function approveAgentApplication(userId: string, approvedByUserId: string) {
  const profile = await db.localDataAgentProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError("NOT_FOUND", "No agent application found for this user.");
  if (profile.status === "APPROVED") throw new AppError("CONFLICT", "Application already approved.");

  const [updatedProfile] = await db.$transaction([
    db.localDataAgentProfile.update({
      where: { userId },
      data: { status: "APPROVED", approvedAt: new Date(), approvedByUserId },
    }),
    db.userRole.upsert({
      where: { userId_role: { userId, role: "LOCAL_DATA_AGENT" } },
      update: {},
      create: { userId, role: "LOCAL_DATA_AGENT", grantedBy: approvedByUserId },
    }),
    db.agentReputation.upsert({
      where: { userId },
      update: {},
      create: { userId },
    }),
  ]);

  return updatedProfile;
}

export async function rejectAgentApplication(userId: string, rejectedByUserId: string, reason: string) {
  const profile = await db.localDataAgentProfile.findUnique({ where: { userId } });
  if (!profile) throw new AppError("NOT_FOUND", "No agent application found for this user.");

  return db.localDataAgentProfile.update({
    where: { userId },
    data: { status: "REJECTED", rejectionReason: reason, approvedByUserId: rejectedByUserId },
  });
}
