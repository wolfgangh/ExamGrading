import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { ExamProject, PointsRecord } from "@/lib/types";

function anyFiniteValue(
  obj: Record<string, number | null | undefined> | undefined
): boolean {
  if (!obj) return false;
  return Object.values(obj).some((v) => v != null && Number.isFinite(v));
}

/**
 * Ob für die Person bereits Bewertungswerte (Note/Punkte/%) vorliegen.
 * Für Sichtbarkeit des „Nicht angetreten“-Umschalters.
 */
export function personHasAssessmentValues(
  project: ExamProject,
  rec: PointsRecord | undefined | null
): boolean {
  if (!rec) return false;
  if (anyFiniteValue(rec.criterionValues)) return true;
  if (anyFiniteValue(rec.portfolioGrades)) return true;
  if (rec.portfolioGradesByLecturer) {
    for (const byL of Object.values(rec.portfolioGradesByLecturer)) {
      if (anyFiniteValue(byL)) return true;
    }
  }
  if (rec.portfolioCriterionValues) {
    for (const byC of Object.values(rec.portfolioCriterionValues)) {
      if (anyFiniteValue(byC)) return true;
    }
  }
  if (rec.portfolioCriterionValuesByLecturer) {
    for (const byComp of Object.values(rec.portfolioCriterionValuesByLecturer)) {
      for (const byL of Object.values(byComp)) {
        if (anyFiniteValue(byL)) return true;
      }
    }
  }
  // Klausur-Punkte o. Ä.
  if (rec.totalPoints != null && Number.isFinite(rec.totalPoints)) return true;
  if (rec.gradeOverride != null && Number.isFinite(rec.gradeOverride)) return true;
  if (rec.byQuestion && anyFiniteValue(rec.byQuestion)) return true;
  if (rec.bySubArea && anyFiniteValue(rec.bySubArea)) return true;
  void project;
  return false;
}

/**
 * Person als „nicht angetreten“ markieren bzw. Markierung aufheben.
 * Portfolio/StA: keine Teilnoten nötig; Status no_show; Export mit leerer Note.
 */
export function setStudentNotAttended(
  project: ExamProject,
  matKey: string,
  notAttended: boolean
): ExamProject {
  const key = normalizeMatriculation(matKey) || matKey;
  if (!key) return project;

  const points = [...(project.points ?? [])];
  const idx = points.findIndex(
    (p) => normalizeMatriculation(p.matriculationNumber) === key
  );

  if (idx < 0) {
    if (!notAttended) return project;
    const empty: PointsRecord = {
      matriculationNumber: key,
      bySubArea: Object.fromEntries(
        (project.subAreas ?? []).map((sa) => [sa.id, null])
      ),
      totalPoints: null,
      source: "manual",
      notAttended: true,
    };
    return { ...project, points: [...points, empty] };
  }

  const next: PointsRecord = {
    ...points[idx],
    notAttended: notAttended ? true : undefined,
    source:
      points[idx].source === "moodle" ? "mixed" : points[idx].source || "manual",
  };
  if (!notAttended) {
    delete next.notAttended;
  }
  points[idx] = next;
  return { ...project, points };
}
