import { ensureQuestionDefs } from "@/lib/grades/ensure-question-defs";
import type { ExamProject, QuestionDef, SubArea } from "@/lib/types";

/** Mehrere Teilgebiete und Aufgaben → Zuordnung ist relevant */
export function needsSubAreaMapping(project: ExamProject): boolean {
  if ((project.subAreas?.length ?? 0) <= 1) return false;
  const defs = ensureQuestionDefs(project);
  return defs.length > 0;
}

export function validSubAreaIds(subAreas: SubArea[]): Set<string> {
  return new Set(subAreas.map((s) => s.id));
}

/** Jede Aufgabe hat ein explizites, gültiges subAreaId */
export function isSubAreaMappingAssigned(project: ExamProject): boolean {
  if (!needsSubAreaMapping(project)) return true;
  const ids = validSubAreaIds(project.subAreas);
  const defs = ensureQuestionDefs(project);
  return defs.every((q) => q.subAreaId != null && ids.has(q.subAreaId));
}

/** Mindestens eine Aufgabe pro Teilgebiet */
export function isSubAreaMappingBalanced(project: ExamProject): boolean {
  if (!needsSubAreaMapping(project)) return true;
  if (!isSubAreaMappingAssigned(project)) return false;
  const defs = ensureQuestionDefs(project);
  for (const sa of project.subAreas) {
    if (!defs.some((q) => q.subAreaId === sa.id)) return false;
  }
  return true;
}

/**
 * Zuordnung vollständig: alle Aufgaben zugeordnet und explizit bestätigt.
 * (Bestätigen speichert `subAreaMappingConfirmedAt`.)
 */
export function isSubAreaMappingComplete(project: ExamProject): boolean {
  if (!needsSubAreaMapping(project)) return true;
  if (!isSubAreaMappingAssigned(project)) return false;
  return Boolean(project.subAreaMappingConfirmedAt);
}

export function subAreaMappingIssues(project: ExamProject): string[] {
  if (!needsSubAreaMapping(project)) return [];
  const issues: string[] = [];
  const ids = validSubAreaIds(project.subAreas);
  const defs = ensureQuestionDefs(project);
  const unassigned = defs.filter(
    (q) => q.subAreaId == null || !ids.has(q.subAreaId)
  );
  if (unassigned.length > 0) {
    issues.push(
      `${unassigned.length} Aufgabe(n) ohne Teilgebiet-Zuordnung (${unassigned
        .slice(0, 4)
        .map((q) => q.label)
        .join(", ")}${unassigned.length > 4 ? "…" : ""})`
    );
  } else if (!project.subAreaMappingConfirmedAt) {
    const empty = project.subAreas.filter(
      (sa) => !defs.some((q) => q.subAreaId === sa.id)
    );
    if (empty.length > 0) {
      issues.push(
        `Keine Aufgabe für: ${empty.map((s) => s.name).join(", ")} – bitte prüfen und bestätigen`
      );
    } else {
      issues.push("Zuordnung noch nicht bestätigt");
    }
  }
  return issues;
}

export function countQuestionsPerSubArea(
  defs: QuestionDef[],
  subAreas: SubArea[]
): { subArea: SubArea; count: number; maxPoints: number }[] {
  return subAreas.map((sa) => {
    const qs = defs.filter((q) => q.subAreaId === sa.id);
    return {
      subArea: sa,
      count: qs.length,
      maxPoints: qs.reduce((s, q) => s + (q.maxPoints || 0), 0),
    };
  });
}

export function subAreaMappingSummary(project: ExamProject): string {
  const issues = subAreaMappingIssues(project);
  if (issues.length === 0) {
    if (!needsSubAreaMapping(project)) return "Kein Multi-Teilgebiet";
    return project.subAreaMappingConfirmedAt
      ? "Teilgebiete bestätigt"
      : "Teilgebiete zugeordnet";
  }
  return issues[0];
}
