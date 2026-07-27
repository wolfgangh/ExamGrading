import type { GradeSchema } from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";
import { calculateGrade } from "@/lib/grades/schema";
import { roundToNearestGermanGrade } from "@/lib/grades/portfolio";

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
  _schema?: GradeSchema
): number {
  if (!Number.isFinite(points)) return 0;
  // schema optional (historisch für ROUNDUP); Notenfindung nutzt exakte Punkte
  void _schema;
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

/**
 * Nächstbessere deutsche Note aus dem ungerundeten Notenmittel (Portfolio / StA).
 * `pointsNeeded` = wie weit das Mittel noch sinken muss, bis die Rundung die
 * bessere Stufe liefert (Grenze = Mittel zwischen den Stufen, Bindung → besser).
 */
export function getNextGermanGradeInfo(rawAverage: number): NextGradeInfo {
  if (!Number.isFinite(rawAverage)) {
    return {
      currentGrade: 5,
      nextGrade: null,
      pointsNeeded: null,
      thresholdForNext: null,
    };
  }
  const raw = Math.min(5, Math.max(1, rawAverage));
  const currentGrade = roundToNearestGermanGrade(raw);
  const grades = [...GERMAN_GRADES];
  const idx = grades.findIndex((g) => Math.abs(g - currentGrade) < 1e-9);
  if (idx <= 0) {
    return {
      currentGrade,
      nextGrade: null,
      pointsNeeded: null,
      thresholdForNext: null,
    };
  }
  const nextGrade = grades[idx - 1];
  // Grenze: ab diesem Mittel (inkl.) rundet die Bindung auf die bessere Note
  const thresholdForNext = (nextGrade + currentGrade) / 2;
  const pointsNeeded = Math.max(
    0,
    Math.round((raw - thresholdForNext) * 1000) / 1000
  );
  return {
    currentGrade,
    nextGrade,
    pointsNeeded,
    thresholdForNext,
  };
}

/** Abstand des Roh-Mittels zur Note 4,0 (positiv = schlechter / darüber). */
export function gradePointsBelowPass(rawAverage: number | null): number | null {
  if (rawAverage == null || !Number.isFinite(rawAverage)) return null;
  return Math.round((rawAverage - 4) * 1000) / 1000;
}
