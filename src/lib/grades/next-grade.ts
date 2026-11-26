import type { GradeSchema } from "@/lib/types";
import { calculateGrade } from "@/lib/grades/schema";
import {
  gradeAverageDistanceToBetter,
  roundGradeAverage,
  truncateGradeAverage,
} from "@/lib/grades/grade-average";

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

export type NextGradeDirection = "better" | "worse";

export interface AdjacentGermanGradeInfo extends NextGradeInfo {
  /** better = nächstbessere Stufe, worse = nächstschlechtere */
  direction: NextGradeDirection | null;
}

/**
 * „Bis nächste Note“ für ein **Notenmittel** (Portfolio, StA mit Note-Kriterien):
 * Abstand in Notengraden vom abgeschnittenen Notenmittel bis zu dem Wert, ab dem
 * die nächstbessere Notenstufe herauskommt (gleiche Regel wie die Note).
 * Beispiel: 2,4 → 2,3; ab 2,1 → 2,0 ⇒ 0,3.
 * Richtung immer „better“; bei 1,0 kein nächster Wert.
 */
export function getAdjacentGermanGradeInfo(
  rawAverage: number
): AdjacentGermanGradeInfo {
  if (!Number.isFinite(rawAverage)) {
    return {
      currentGrade: 5,
      nextGrade: null,
      pointsNeeded: null,
      thresholdForNext: null,
      direction: null,
    };
  }
  const currentGrade = roundGradeAverage(rawAverage);
  const d = gradeAverageDistanceToBetter(rawAverage);
  if (!d) {
    return {
      currentGrade,
      nextGrade: null,
      pointsNeeded: null,
      thresholdForNext: null,
      direction: null,
    };
  }
  return {
    currentGrade,
    nextGrade: d.next,
    pointsNeeded: d.distance,
    thresholdForNext: d.next,
    direction: "better",
  };
}

/** @deprecated Alias für Adjacent-Logik */
export function getNextGermanGradeInfo(
  rawAverage: number
): AdjacentGermanGradeInfo {
  return getAdjacentGermanGradeInfo(rawAverage);
}

/**
 * Abstand des abgeschnittenen Notenmittels zur 4,0
 * (positiv = schlechter als 4,0, also nicht bestanden).
 */
export function gradePointsBelowPass(rawAverage: number | null): number | null {
  if (rawAverage == null || !Number.isFinite(rawAverage)) return null;
  const t = truncateGradeAverage(Math.min(5, Math.max(1, rawAverage)));
  return Math.round((t - 4) * 10) / 10;
}
