import type { ExamProject } from "@/lib/types";
import { buildEnrichedRows } from "@/lib/matching/match";
import { uniqueRowsByMatriculation } from "@/lib/grades/statistics";
import {
  GRADE_RULES_VERSION,
  runWithGradeRules,
} from "@/lib/grades/grade-average";

export type GradeRuleChange = {
  key: string;
  lastName: string;
  firstName: string;
  oldGrade: number | null;
  newGrade: number | null;
};

/** Projekt wurde noch nicht mit den aktuellen Notenregeln bestätigt. */
export function needsGradeRulesReview(
  project: Pick<ExamProject, "gradeRulesVersion">
): boolean {
  return (project.gradeRulesVersion ?? 1) < GRADE_RULES_VERSION;
}

/**
 * Berechnete Noten (ohne manuelle Overrides) nach alter (v1) und neuer Regel
 * vergleichen. Nur Personen in HISinOne, deren Note sich ändert.
 */
export function listGradeRuleChanges(project: ExamProject): GradeRuleChange[] {
  const before = runWithGradeRules(1, () =>
    uniqueRowsByMatriculation(buildEnrichedRows(project))
  );
  const after = uniqueRowsByMatriculation(buildEnrichedRows(project));
  const oldByKey = new Map(before.map((r) => [r.key, r.calculatedGrade]));
  const out: GradeRuleChange[] = [];
  for (const r of after) {
    if (!r.inHis) continue;
    const oldGrade = oldByKey.get(r.key) ?? null;
    const newGrade = r.calculatedGrade;
    const same =
      oldGrade == null || newGrade == null
        ? oldGrade === newGrade
        : Math.abs(oldGrade - newGrade) < 1e-9;
    if (same) continue;
    out.push({
      key: r.key,
      lastName: r.student.lastName,
      firstName: r.student.firstName,
      oldGrade,
      newGrade,
    });
  }
  out.sort(
    (a, b) =>
      a.lastName.localeCompare(b.lastName, "de") ||
      a.firstName.localeCompare(b.firstName, "de")
  );
  return out;
}

/** Bestätigung speichern (danach kein Hinweis mehr). */
export function acknowledgeGradeRules(project: ExamProject): ExamProject {
  return { ...project, gradeRulesVersion: GRADE_RULES_VERSION };
}
