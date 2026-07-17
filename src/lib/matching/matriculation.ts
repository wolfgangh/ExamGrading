/**
 * Normalisiert Matrikelnummern für Matching.
 * "3513589", 3513589, " 3.513.589 ", "3513589.0" → "3513589"
 */
export function normalizeMatriculation(raw: unknown): string | null {
  if (raw == null) return null;

  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    return String(Math.trunc(raw));
  }

  let s = String(raw).trim();
  if (!s) return null;

  // Excel-Float-Artefakte
  if (/^\d+\.0+$/.test(s)) {
    s = s.replace(/\.0+$/, "");
  }

  // Tausendertrenner entfernen
  s = s.replace(/[.\s]/g, "");

  // nur Ziffern behalten
  const digits = s.replace(/\D/g, "");
  if (!digits || digits.length < 4) return null;
  // führende Nullen entfernen, aber nicht alles leeren
  const normalized = digits.replace(/^0+/, "") || "0";
  return normalized;
}

export function displayMatriculation(raw: string): string {
  return normalizeMatriculation(raw) ?? raw;
}
