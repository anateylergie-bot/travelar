import { db } from "@/lib/db";

// Spec Section 51: "design architecture for future offline access,"
// explicitly listing saved places and emergency information as the
// content to cache, and requiring the sync timestamp to be shown. This
// is a real, working data export — not a full offline-sync engine (no
// service worker, no conflict resolution) — a genuine starting point,
// not a stub.
export async function buildOfflinePackage(userId: string, countryId: string) {
  const [savedPlaces, emergencyNumbers] = await Promise.all([
    db.savedPlace.findMany({
      where: { userId },
      include: { place: { include: { category: true, city: true } } },
    }),
    db.emergencyNumber.findMany({ where: { countryId } }),
  ]);

  return {
    syncedAt: new Date().toISOString(),
    savedPlaces: savedPlaces.map((sp) => ({
      id: sp.place.id,
      name: sp.place.name,
      category: sp.place.category.name,
      city: sp.place.city?.name ?? null,
      latitude: sp.place.latitude,
      longitude: sp.place.longitude,
      phone: sp.place.phone,
      verificationStatus: sp.place.verificationStatus,
    })),
    emergencyNumbers: emergencyNumbers.map((e) => ({
      service: e.service,
      number: e.number,
      label: e.label,
    })),
  };
}
