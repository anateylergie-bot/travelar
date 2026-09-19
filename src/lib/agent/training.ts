import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";
import type { TaskType } from "@prisma/client";

// Spec Section 20: 16 training modules, gating higher-value task types
// until completed. Content below is real (not lorem-ipsum placeholder)
// but intentionally concise — this is baseline onboarding copy, not a
// final product-authored curriculum; expect a content team to refine it.
// This is the seed list; `seedTrainingModules()` upserts it idempotently.

export const TRAINING_MODULE_SEED: Array<{
  slug: string;
  order: number;
  title: string;
  content: string;
  requiredForTaskTypes: TaskType[];
}> = [
  {
    slug: "platform-overview",
    order: 1,
    title: "What this platform is",
    content:
      "This platform helps travelers find accurate, verified information about places — hotels, " +
      "restaurants, hospitals, and more. As a Local Data Agent, your job is to collect and verify " +
      "that information about places in your own city or community.",
    requiredForTaskTypes: ["NEW_PLACE"],
  },
  {
    slug: "what-counts-as-a-valid-place",
    order: 2,
    title: "What counts as a valid place",
    content:
      "A valid place is a real, currently operating (or clearly historical) business, attraction, or " +
      "public service with a fixed physical location. It must be legal, publicly accessible or " +
      "publicly relevant, and not a private residence unless it also operates as a public business " +
      "(e.g. a guest house run from a home).",
    requiredForTaskTypes: ["NEW_PLACE"],
  },
  {
    slug: "collecting-accurate-information",
    order: 3,
    title: "How to collect accurate information",
    content:
      "Always use the place's own signage, staff, or official materials as your primary source. Do " +
      "not guess at hours, prices, or services. If you're unsure about a detail, leave it blank rather " +
      "than estimate — an empty field is more honest than a wrong one.",
    requiredForTaskTypes: ["NEW_PLACE", "UPDATE"],
  },
  {
    slug: "verifying-phone-numbers",
    order: 4,
    title: "How to verify phone numbers",
    content:
      "Call or message the number before submitting it. Confirm someone associated with the business " +
      "answers. Never publish a number you haven't personally confirmed is reachable.",
    requiredForTaskTypes: ["CONTACT_VERIFICATION"],
  },
  {
    slug: "verifying-addresses",
    order: 5,
    title: "How to verify addresses",
    content:
      "Confirm the address matches what's posted at the location itself (signage, building number) " +
      "rather than relying only on a map app's guess, which is often wrong in areas with informal " +
      "addressing.",
    requiredForTaskTypes: ["FIELD_VERIFICATION", "LOCATION_VERIFICATION"],
  },
  {
    slug: "capturing-coordinates",
    order: 6,
    title: "How to capture GPS coordinates",
    content:
      "Stand as close to the place's entrance as safely possible before capturing GPS. Check the " +
      "accuracy reading — if it's worse than about 20 meters, wait a few seconds and try again before " +
      "submitting.",
    requiredForTaskTypes: ["FIELD_VERIFICATION", "LOCATION_VERIFICATION"],
  },
  {
    slug: "photographing-locations",
    order: 7,
    title: "How to photograph locations appropriately",
    content:
      "Photograph the exterior, signage, or relevant public features only. Do not photograph people " +
      "without their clear consent, and never photograph private property that isn't the subject of " +
      "the task.",
    requiredForTaskTypes: ["PHOTO_TASK"],
  },
  {
    slug: "avoiding-duplicates",
    order: 8,
    title: "How to avoid duplicate submissions",
    content:
      "Before submitting a new place, check whether it might already exist under a slightly different " +
      "name or address. The app will show you possible matches — review them carefully before " +
      "proceeding.",
    requiredForTaskTypes: ["NEW_PLACE"],
  },
  {
    slug: "recognizing-false-information",
    order: 9,
    title: "How to recognize false information",
    content:
      "Be skeptical of information that seems designed to attract customers dishonestly — implausibly " +
      "low prices, vague or missing contact details, or claims that don't match what you observe in " +
      "person.",
    requiredForTaskTypes: ["FIELD_VERIFICATION"],
  },
  {
    slug: "privacy-rules",
    order: 10,
    title: "Privacy rules",
    content:
      "Only collect and publish information about the business itself, not about private individuals " +
      "who happen to be present. Never publish a private person's home address, personal phone number, " +
      "or photo without their explicit, informed consent.",
    requiredForTaskTypes: [],
  },
  {
    slug: "handling-personal-information",
    order: 11,
    title: "Handling personal information",
    content:
      "If a task involves a community representative or business owner's personal contact details, " +
      "confirm they consent to that information being made public before submitting it.",
    requiredForTaskTypes: [],
  },
  {
    slug: "community-etiquette",
    order: 12,
    title: "Community etiquette",
    content:
      "Introduce yourself clearly, explain the platform, and be respectful of people's time. If someone " +
      "declines to participate, respect that and move on.",
    requiredForTaskTypes: ["FIELD_VERIFICATION"],
  },
  {
    slug: "business-owner-interaction",
    order: 13,
    title: "Business-owner interaction",
    content:
      "You are not authorized to make promises on the platform's behalf (pricing, placement, etc.). " +
      "Direct business owners with questions about claiming their listing to the business claim process.",
    requiredForTaskTypes: ["FIELD_VERIFICATION"],
  },
  {
    slug: "safety-during-field-work",
    order: 14,
    title: "Safety during field work",
    content:
      "You may decline any task that feels unsafe — a task you decline for safety reasons does not " +
      "count against you. Never enter private property without permission, and avoid areas you judge " +
      "unsafe at the time.",
    requiredForTaskTypes: ["FIELD_VERIFICATION"],
  },
  {
    slug: "fraud-prevention",
    order: 15,
    title: "Fraud prevention",
    content:
      "Never submit a place you haven't actually visited or verified, never reuse someone else's " +
      "photos as your own evidence, and never coordinate with other agents to submit fabricated " +
      "confirmations.",
    requiredForTaskTypes: ["NEW_PLACE", "FIELD_VERIFICATION"],
  },
  {
    slug: "payment-and-reward-rules",
    order: 16,
    title: "Payment and reward rules",
    content:
      "You are paid only for approved, verified work — not simply for submitting a form. Reward rates " +
      "are set by the platform and may change; check your dashboard for current rates before starting " +
      "a task.",
    requiredForTaskTypes: [],
  },
];

export async function seedTrainingModules() {
  // Parallelized: each upsert targets a distinct row (unique slug), so
  // these are safe to run concurrently — cuts ~16 sequential network
  // round-trips down to roughly the time of the slowest one.
  await Promise.all(
    TRAINING_MODULE_SEED.map((m) =>
      db.trainingModule.upsert({
        where: { slug: m.slug },
        update: { order: m.order, title: m.title, content: m.content, requiredForTaskTypes: m.requiredForTaskTypes },
        create: m,
      })
    )
  );
}

export async function listTrainingModules() {
  return db.trainingModule.findMany({ orderBy: { order: "asc" } });
}

export async function completeTrainingModule(agentUserId: string, moduleId: string) {
  const module_ = await db.trainingModule.findUnique({ where: { id: moduleId } });
  if (!module_) throw new AppError("NOT_FOUND", "Unknown training module.");

  return db.agentTrainingCompletion.upsert({
    where: { agentUserId_moduleId: { agentUserId, moduleId } },
    update: {},
    create: { agentUserId, moduleId },
  });
}

/**
 * Spec Section 20: "require training completion before unlocking certain
 * task types." Returns true only if every module gating this task type
 * has been completed by this agent.
 */
export async function hasCompletedRequiredTraining(agentUserId: string, taskType: TaskType): Promise<boolean> {
  const requiredModules = await db.trainingModule.findMany({
    where: { requiredForTaskTypes: { has: taskType } },
    select: { id: true },
  });
  if (requiredModules.length === 0) return true;

  const completions = await db.agentTrainingCompletion.findMany({
    where: { agentUserId, moduleId: { in: requiredModules.map((m) => m.id) } },
    select: { moduleId: true },
  });

  const completedIds = new Set(completions.map((c) => c.moduleId));
  return requiredModules.every((m) => completedIds.has(m.id));
}
