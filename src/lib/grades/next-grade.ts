import type { GradeSchema } from "@/lib/types";
import { calculateGrade } from "@/lib/grades/schema";

export interface NextGradeInfo {
  currentGrade: number;
  nextGrade: number | null;
  pointsNeeded: number | null;
  thresholdForNext: number | null;
}

/**
 * Effektive Punkte für Notenlogik / „bis nächste Note“.
 * Unverändert (kein ganzzahliges Aufrunden) – konsistent mit calculateGrade.
 */
export function effectivePointsForGrading(
  points: number,
  _schema: GradeSchema
): number {
  if (!Number.isFinite(points)) return 0;
  return points;
}

/**
 * Fehlende Punkte bis zur nächstbesseren deutschen Note.
 * Bei Note 1,0: null. Bei 5,0: Punkte bis 4,0 (Bestehensschwelle).
 */
export function getNextGradeInfo(
  points: number,
  schema: GradeSchema
): NextGradeInfo {
  const p = effectivePointsForGrading(points, schema);
  const currentGrade = calculateGrade(points, schema);

  const sorted = [...schema.thresholds].sort(
    (a, b) => b.minPoints - a.minPoints
  );

  // Bessere Noten = kleinere grade-Zahl und höheres minPoints
  const better = sorted.filter((t) => t.grade < currentGrade - 1e-9);
  if (better.length === 0) {
    return {
      currentGrade,
      nextGrade: null,
      pointsNeeded: null,
      thresholdForNext: null,
    };
  }

  // nächste bessere Stufe (geringster Sprung nach oben in der Notenskala)
  better.sort((a, b) => b.grade - a.grade);
  const next = better[0];
  const needed = Math.max(0, Math.round((next.minPoints - p) * 10) / 10);

  return {
    currentGrade,
    nextGrade: next.grade,
    pointsNeeded: needed,
    thresholdForNext: next.minPoints,
  };
}

/** Nicht bestanden: Note schlechter als 4,0 */
export function isFailedGrade(grade: number | null | undefined): boolean {
  if (grade == null || !Number.isFinite(grade)) return false;
  return grade > 4.0 + 1e-9;
}

export function pointsBelowPass(
  points: number | null,
  schema: GradeSchema
): number | null {
  if (points == null || !Number.isFinite(points)) return null;
  const p = effectivePointsForGrading(points, schema);
  return Math.round((schema.passThreshold - p) * 10) / 10;
}
