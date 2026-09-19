import { db } from "@/lib/db";
import { AppError } from "@/lib/errors/AppError";

export async function savePlace(userId: string, placeId: string) {
  const place = await db.place.findUnique({ where: { id: placeId } });
  if (!place) throw new AppError("NOT_FOUND", "Place not found.");

  return db.savedPlace.upsert({
    where: { userId_placeId: { userId, placeId } },
    update: {},
    create: { userId, placeId },
  });
}

export async function unsavePlace(userId: string, placeId: string) {
  await db.savedPlace.deleteMany({ where: { userId, placeId } });
}

export async function listSavedPlaces(userId: string) {
  return db.savedPlace.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { place: { include: { category: true, city: true } } },
  });
}
