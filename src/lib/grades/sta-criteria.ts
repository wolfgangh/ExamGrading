import type {
  AssessmentCriterion,
  CriterionScale,
  ExamProject,
  PointsRecord,
} from "@/lib/types";

export const CRITERION_SCALE_LABELS: Record<CriterionScale, string> = {
  percent: "Prozent (0–100)",
  points: "Punkte",
  grade: "Note (1,0–5,0)",
};

/** Note → 0…1 (1,0 = best, 5,0 = 0) */
export function gradeToUnit(grade: number): number {
  if (!Number.isFinite(grade)) return 0;
  return Math.min(1, Math.max(0, (5 - grade) / 4));
}

/** Einzelkriterium → Norm 0…1; null wenn ungültig/leer */
export function normalizeCriterionValue(
  value: number | null | undefined,
  criterion: AssessmentCriterion
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  switch (criterion.scale) {
    case "percent":
      return Math.min(1, Math.max(0, value / 100));
    case "points": {
      const max = criterion.maxPoints && criterion.maxPoints > 0
        ? criterion.maxPoints
        : 0;
      if (max <= 0) return null;
      return Math.min(1, Math.max(0, value / max));
    }
    case "grade":
      return gradeToUnit(value);
    default:
      return null;
  }
}

/**
 * Gewichteter Gesamtwert auf Skala 0…maxPoints.
 * Nur wenn **alle** Kriterien einen Wert haben; sonst null.
 */
export function computeCriteriaTotalPoints(
  criterionValues: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[],
  maxPoints: number
): number | null {
  if (!criteria.length) return null;
  const vals = criterionValues ?? {};
  let weightSum = 0;
  let acc = 0;
  for (const c of criteria) {
    const w = Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0;
    if (w <= 0) continue;
    const unit = normalizeCriterionValue(vals[c.id], c);
    if (unit == null) return null;
    weightSum += w;
    acc += unit * w;
  }
  if (weightSum <= 0) return null;
  const safeMax = Math.max(0, maxPoints);
  return Math.round((acc / weightSum) * safeMax * 100) / 100;
}

export function criteriaAllFilled(
  criterionValues: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[]
): boolean {
  if (!criteria.length) return false;
  const vals = criterionValues ?? {};
  return criteria.every((c) => {
    const v = vals[c.id];
    return v != null && Number.isFinite(v);
  });
}

export function countMissingCriteria(
  criterionValues: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[]
): number {
  if (!criteria.length) return 0;
  const vals = criterionValues ?? {};
  return criteria.filter((c) => {
    const v = vals[c.id];
    return v == null || !Number.isFinite(v);
  }).length;
}

/** Punkte-Record nach Kriterien neu berechnen */
export function recomputeStaCriteriaRecord(
  rec: PointsRecord,
  criteria: AssessmentCriterion[],
  maxPoints: number
): PointsRecord {
  const totalPoints = computeCriteriaTotalPoints(
    rec.criterionValues,
    criteria,
    maxPoints
  );
  return {
    ...rec,
    totalPoints,
    source: rec.source === "moodle" ? "mixed" : rec.source || "manual",
  };
}

export function projectHasCriteria(project: ExamProject): boolean {
  return (project.criteria?.length ?? 0) > 0;
}
