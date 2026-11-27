import { GERMAN_GRADES } from "@/lib/types";

/**
 * Notenmittel → Notenstufe (RaPO Bayern / APO OTH Regensburg).
 *
 * Version 2 (aktuell):
 *  1. Notenmittel auf eine Dezimalstelle **abschneiden** (nicht runden)
 *  2. > 4,0 → 5,0 (nicht bestanden)
 *  3. sonst nächste Notenstufe, Gleichstand → bessere Stufe (1,5 → 1,3)
 *  Korrektorenmittel je Teilleistung werden ebenfalls auf eine Stufe gebracht.
 *
 * Version 1 (bis v0.4.74): nächste Stufe ohne Abschneiden, erst ab 4,5 → 5,0,
 * Korrektorenmittel ungerundet. Nur noch für den Vergleich alt → neu
 * (Hinweisdialog beim Öffnen älterer Projekte).
 */
export const GRADE_RULES_VERSION = 2;
export type GradeRulesVersion = 1 | 2;

let activeRules: GradeRulesVersion = GRADE_RULES_VERSION;

/** Berechnung synchron unter einer bestimmten Regelversion ausführen. */
export function runWithGradeRules<T>(
  version: GradeRulesVersion,
  fn: () => T
): T {
  const prev = activeRules;
  activeRules = version;
  try {
    return fn();
  } finally {
    activeRules = prev;
  }
}

export function activeGradeRules(): GradeRulesVersion {
  return activeRules;
}

/** Auf eine Dezimalstelle abschneiden (FP-sicher: 2,1 bleibt 2,1). */
export function truncateGradeAverage(raw: number): number {
  return Math.floor(raw * 10 + 1e-9) / 10;
}

function nearestPassingStep(value: number): number {
  let best: number = 4.0;
  let bestDist = Infinity;
  for (const g of GERMAN_GRADES) {
    if (g >= 5) continue;
    const d = Math.abs(g - value);
    if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) < 1e-9 && g < best)) {
      best = g;
      bestDist = d;
    }
  }
  return best;
}

/** Notenmittel → Notenstufe nach aktiver Regelversion. */
export function roundGradeAverage(raw: number): number {
  if (!Number.isFinite(raw)) return 5.0;
  const clamped = Math.min(5, Math.max(1, raw));
  if (activeRules === 1) {
    if (clamped + 1e-12 >= 4.5) return 5.0;
    return nearestPassingStep(clamped);
  }
  const t = truncateGradeAverage(clamped);
  if (t > 4.0 + 1e-9) return 5.0;
  return nearestPassingStep(t);
}

/** Korrektorenmittel je Teilleistung auf eine Stufe bringen? (ab Version 2) */
export function roundsLecturerMean(): boolean {
  return activeRules >= 2;
}

/**
 * Abstand (in Notengraden, auf das abgeschnittene Notenmittel bezogen) bis zur
 * nächstbesseren Notenstufe. null bei 1,0.
 * Beispiel: 2,4 → 2,3; ab 2,1 ergibt sich 2,0 → 0,3.
 */
export function gradeAverageDistanceToBetter(
  raw: number
): { current: number; next: number; distance: number } | null {
  if (!Number.isFinite(raw)) return null;
  const clamped = Math.min(5, Math.max(1, raw));
  const current = roundGradeAverage(clamped);
  if (current <= 1.0 + 1e-9) return null;
  const t = truncateGradeAverage(clamped);
  // Abwärts in 0,1-Schritten suchen, bis eine bessere Stufe herauskommt
  for (let k = 1; k <= 40; k++) {
    const cand = Math.round((t - k / 10) * 10) / 10;
    if (cand < 1 - 1e-9) break;
    const g = roundGradeAverage(cand);
    if (g < current - 1e-9) {
      return {
        current,
        next: g,
        distance: Math.round((t - cand) * 10) / 10,
      };
    }
  }
  return null;
}
