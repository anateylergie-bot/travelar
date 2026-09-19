import { db } from "@/lib/db";

// Spec Section 49. See DECISIONS.md D30 — only English content is
// authored here; `translations` stays an empty JSON object until a real
// translation provider or professional reviewer fills it in.
export const PHRASEBOOK_SEED: Array<{ category: string; englishText: string }> = [
  { category: "greetings", englishText: "Hello" },
  { category: "greetings", englishText: "Thank you" },
  { category: "greetings", englishText: "Please" },
  { category: "greetings", englishText: "Yes" },
  { category: "greetings", englishText: "No" },
  { category: "greetings", englishText: "Excuse me" },
  { category: "directions", englishText: "Where is the nearest hospital?" },
  { category: "directions", englishText: "Where is the nearest police station?" },
  { category: "directions", englishText: "How do I get to...?" },
  { category: "directions", englishText: "Is it far from here?" },
  { category: "emergency", englishText: "Help!" },
  { category: "emergency", englishText: "I need a doctor." },
  { category: "emergency", englishText: "Please call the police." },
  { category: "emergency", englishText: "There has been an accident." },
  { category: "emergency", englishText: "I am lost." },
  { category: "shopping", englishText: "How much does this cost?" },
  { category: "shopping", englishText: "That is too expensive." },
  { category: "shopping", englishText: "Do you accept cards?" },
];

export async function seedPhrasebook() {
  // Parallelized — same fix as seedTrainingModules() (D16-adjacent):
  // each phrase is a distinct string, so no two concurrent
  // check-then-create operations target the same row, making this safe
  // to run concurrently rather than as ~18 sequential network round-trips.
  await Promise.all(
    PHRASEBOOK_SEED.map(async (phrase) => {
      const existing = await db.travelPhrase.findFirst({
        where: { category: phrase.category, englishText: phrase.englishText },
      });
      if (!existing) {
        await db.travelPhrase.create({ data: phrase });
      }
    })
  );
}

export async function listPhrases(category?: string) {
  return db.travelPhrase.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ category: "asc" }, { englishText: "asc" }],
  });
}
