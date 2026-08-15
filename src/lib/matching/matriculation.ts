/**
 * Normalisiert Matrikelnummern für Matching.
 * "3513589", 3513589, " 3.513.589 ", "3513589.0" → "3513589"
 */
export function normalizeMatriculation(raw: unknown): string | null {
  if (raw == null) return null;

  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    const nearest = Math.round(raw);
    const n =
      Math.abs(raw - nearest) < 1e-6 ? nearest : Math.trunc(raw);
    return String(n);
  }

  let s = String(raw).trim();
  if (!s) return null;

  // Excel-Float-Artefakte: 3513589.0 / 3513589,0 / 3513589,00
  if (/^\d+[.,]0+$/.test(s)) {
    s = s.replace(/[.,]0+$/, "");
  }

  // Tausendertrenner entfernen
  s = s.replace(/[.\s]/g, "");
  // Nach Entfernen der Punkte nochmals deutsches ,0-Suffix
  if (/^\d+,0+$/.test(s)) {
    s = s.replace(/,0+$/, "");
  }

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
