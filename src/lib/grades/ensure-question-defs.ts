import type { ExamProject, QuestionDef } from "@/lib/types";

/**
 * Stellt questionDefs bereit:
 * 1) aus Projekt
 * 2) aus byQuestion-Keys rekonstruieren
 */
export function ensureQuestionDefs(project: ExamProject): QuestionDef[] {
  if (project.questionDefs && project.questionDefs.length > 0) {
    return project.questionDefs;
  }

  const ids = new Set<string>();
  for (const p of project.points ?? []) {
    if (p.byQuestion) {
      for (const id of Object.keys(p.byQuestion)) ids.add(id);
    }
  }
  if (ids.size === 0) return [];

  const frmId =
    project.subAreas.find(
      (s) => /^f$/i.test(s.code) || /frm|finanz/i.test(s.name)
    )?.id ?? project.subAreas[0]?.id;

  return [...ids]
    .sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, ""), 10) || 0;
      const nb = parseInt(b.replace(/\D/g, ""), 10) || 0;
      return na - nb;
    })
    .map((id, orderIndex) => {
      const num = id.replace(/\D/g, "") || String(orderIndex + 1);
      return {
        id,
        label: `F ${num}`,
        maxPoints: 0,
        orderIndex,
        subAreaId: frmId,
      };
    });
}

/** Persistiert rekonstruierte Defs einmalig ins Projekt (optional call) */
export function projectWithEnsuredQuestionDefs(
  project: ExamProject
): ExamProject {
  if (project.questionDefs && project.questionDefs.length > 0) {
    return project;
  }
  const defs = ensureQuestionDefs(project);
  if (defs.length === 0) return project;
  return { ...project, questionDefs: defs };
}
