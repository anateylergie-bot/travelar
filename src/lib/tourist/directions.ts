// Spec Section 42/137. See DECISIONS.md D27: this is a real, working
// feature (a plain URL, not an API call) — not a stub. A full embedded
// interactive map still needs a real Maps JS API key, which isn't
// configured here.
export function getDirectionsUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${latitude},${longitude}`,
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
