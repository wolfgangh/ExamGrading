import type { GradeSchema, GradeThreshold } from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";

/**
 * Erzeugt eine lineare Notenskala wie im Excel-Notenszenario:
 * Schrittweite = round((max − pass) / 10, 1)
 * 1,0 = pass + 9×step … 4,0 = pass, 5,0 = 0
 */
export function generateLinearGradeSchema(
  maxPoints: number,
  passThreshold: number,
  roundPointsUp = true
): GradeSchema {
  const safeMax = Math.max(0, maxPoints);
  const safePass = Math.min(Math.max(0, passThreshold), safeMax);
  const steps = 10; // 1.0 … 4.0 = 10 Intervalle
  const step =
    Math.round(((safeMax - safePass) / steps) * 10) / 10 || safeMax / steps;

  const thresholds: GradeThreshold[] = [];
  // GERMAN_GRADES ohne 5.0 zuerst (1.0 … 4.0)
  const passGrades = GERMAN_GRADES.filter((g) => g < 5);
  passGrades.forEach((grade, index) => {
    // index 0 = 1.0 → pass + 9*step
    const mult = passGrades.length - 1 - index;
    const minPoints =
      Math.round((safePass + mult * step) * 10) / 10;
    thresholds.push({ grade, minPoints });
  });
  thresholds.push({ grade: 5.0, minPoints: 0 });

  // absteigend nach minPoints (beste Note zuerst)
  thresholds.sort((a, b) => b.minPoints - a.minPoints);

  return {
    mode: "points",
    maxPoints: safeMax,
    passThreshold: safePass,
    thresholds,
    roundPointsUp,
  };
}

export function calculateGrade(
  points: number,
  schema: GradeSchema
): number {
  if (!Number.isFinite(points)) return 5.0;
  const p = schema.roundPointsUp ? Math.ceil(points - 1e-9) : points;
  const sorted = [...schema.thresholds].sort(
    (a, b) => b.minPoints - a.minPoints
  );
  for (const t of sorted) {
    if (p >= t.minPoints) return t.grade;
  }
  return 5.0;
}

export function effectiveTotalPoints(
  totalPoints: number | null | undefined,
  totalOverride?: number | null
): number | null {
  if (totalOverride != null && Number.isFinite(totalOverride)) {
    return totalOverride;
  }
  if (totalPoints != null && Number.isFinite(totalPoints)) {
    return totalPoints;
  }
  return null;
}

export function sumSubAreaPoints(
  bySubArea: Record<string, number | null | undefined>
): number | null {
  const values = Object.values(bySubArea).filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}

export function defaultGradeSchema(): GradeSchema {
  return generateLinearGradeSchema(90, 45, true);
}
