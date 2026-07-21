import type { ExamProject, PointsRecord } from "@/lib/types";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { computeEffectiveTotal } from "@/lib/grades/points-total";

export interface QuestionStat {
  questionId: string;
  label: string;
  maxPoints: number;
  nAnswered: number;
  nNeedsGrading: number;
  averagePoints: number | null;
  averagePercent: number | null;
  /** 0–100, für Farbcode */
  difficultyScore: number | null;
}

export interface SubAreaStat {
  subAreaId: string;
  name: string;
  code: string;
  maxPoints: number;
  averagePoints: number | null;
  averagePercent: number | null;
  nWithData: number;
  questionCount: number;
}

function relevantRecords(project: ExamProject): PointsRecord[] {
  return project.points.filter((p) => {
    const total = computeEffectiveTotal(p);
    return (
      total != null ||
      (p.byQuestion && Object.keys(p.byQuestion).length > 0) ||
      (p.needsGrading && p.needsGrading.length > 0)
    );
  });
}

export function computeQuestionStats(project: ExamProject): QuestionStat[] {
  const defs = project.questionDefs ?? [];
  const records = relevantRecords(project);

  return defs.map((q) => {
    const values: number[] = [];
    let nNeeds = 0;
    for (const rec of records) {
      if (rec.needsGrading?.includes(q.id)) {
        nNeeds++;
      }
      const v = rec.byQuestion?.[q.id];
      if (v != null && Number.isFinite(v)) values.push(v);
    }
    const averagePoints =
      values.length > 0
        ? Math.round(
            (values.reduce((a, b) => a + b, 0) / values.length) * 100
          ) / 100
        : null;
    const averagePercent =
      averagePoints != null && q.maxPoints > 0
        ? Math.round((averagePoints / q.maxPoints) * 1000) / 10
        : null;

    return {
      questionId: q.id,
      label: q.label,
      maxPoints: q.maxPoints,
      nAnswered: values.length,
      nNeedsGrading: nNeeds,
      averagePoints,
      averagePercent,
      difficultyScore: averagePercent,
    };
  });
}

export function computeSubAreaStats(project: ExamProject): SubAreaStat[] {
  const defs = project.questionDefs ?? [];
  const records = relevantRecords(project);
  const subAreas = project.subAreas;

  const unassigned = defs.filter((q) => !q.subAreaId);

  return subAreas.map((sa, saIndex) => {
    const assigned = defs.filter((q) => q.subAreaId === sa.id);
    // Unzugeordnete Aufgaben dem ersten Teilgebiet zurechnen
    const questions =
      saIndex === 0 ? [...assigned, ...unassigned] : assigned;

    const maxPoints = questions.reduce((s, q) => s + (q.maxPoints || 0), 0);
    const personTotals: number[] = [];

    for (const rec of records) {
      let sum = 0;
      let any = false;
      for (const q of questions) {
        const v = rec.byQuestion?.[q.id];
        if (v != null && Number.isFinite(v)) {
          sum += v;
          any = true;
        }
      }
      if (!any && rec.bySubArea[sa.id] != null) {
        personTotals.push(rec.bySubArea[sa.id] as number);
      } else if (any) {
        personTotals.push(Math.round(sum * 100) / 100);
      }
    }

    const averagePoints =
      personTotals.length > 0
        ? Math.round(
            (personTotals.reduce((a, b) => a + b, 0) / personTotals.length) *
              100
          ) / 100
        : null;
    const averagePercent =
      averagePoints != null && maxPoints > 0
        ? Math.round((averagePoints / maxPoints) * 1000) / 10
        : null;

    return {
      subAreaId: sa.id,
      name: sa.name,
      code: sa.code,
      maxPoints: maxPoints || sa.maxPoints,
      averagePoints,
      averagePercent,
      nWithData: personTotals.length,
      questionCount: questions.length,
    };
  });
}

/** Personenzeilen für die Matrix */
export function matrixRows(project: ExamProject): {
  key: string;
  lastName: string;
  firstName: string;
  record: PointsRecord;
  total: number | null;
  durationMinutes: number | null;
}[] {
  const out: {
    key: string;
    lastName: string;
    firstName: string;
    record: PointsRecord;
    total: number | null;
    durationMinutes: number | null;
  }[] = [];

  for (const rec of project.points) {
    const key =
      normalizeMatriculation(rec.matriculationNumber) ?? rec.matriculationNumber;
    const st = project.students[key];
    out.push({
      key,
      lastName: st?.lastName || "",
      firstName: st?.firstName || "",
      record: rec,
      total: computeEffectiveTotal(rec),
      durationMinutes:
        rec.processingDurationMinutes != null &&
        Number.isFinite(rec.processingDurationMinutes)
          ? rec.processingDurationMinutes
          : null,
    });
  }

  out.sort((a, b) => {
    const c = a.lastName.localeCompare(b.lastName, "de");
    if (c !== 0) return c;
    return a.firstName.localeCompare(b.firstName, "de");
  });
  return out;
}

export function difficultyColor(
  percent: number | null
): "good" | "medium" | "hard" | "unknown" {
  if (percent == null) return "unknown";
  if (percent >= 70) return "good";
  if (percent >= 40) return "medium";
  return "hard";
}
