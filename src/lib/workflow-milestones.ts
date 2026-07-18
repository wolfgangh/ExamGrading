import { hasOpenGrading } from "@/lib/grades/open-grading";
import { isOnlineStyleExam, type ExamProject } from "@/lib/types";

/** Alle relevanten XLSX-Importe vorhanden */
export function importsComplete(project: ExamProject): boolean {
  const hisOk = (project.hisRows?.length ?? 0) > 0;
  const pointsOk = (project.points?.length ?? 0) > 0;
  if (!hisOk || !pointsOk) return false;
  if (isOnlineStyleExam(project.examType)) {
    return (project.attendance?.length ?? 0) > 0;
  }
  return true;
}

export function gradesDataComplete(
  project: ExamProject,
  gradedCount: number
): boolean {
  return !hasOpenGrading(project) && gradedCount > 0;
}

export function backupAfterImportDone(project: ExamProject): boolean {
  return (
    importsComplete(project) &&
    Boolean(project.workflowMilestones?.backupAfterImportAt)
  );
}

export function backupAfterGradesDone(project: ExamProject): boolean {
  return Boolean(project.workflowMilestones?.backupAfterGradesAt);
}

/** Meilensteine beim JSON-Sichern setzen (wenn Voraussetzungen erfüllt) */
export function withWorkflowMilestonesOnBackup(
  project: ExamProject,
  options?: { gradesComplete?: boolean }
): ExamProject {
  const now = new Date().toISOString();
  const milestones = { ...project.workflowMilestones };
  if (importsComplete(project)) {
    milestones.backupAfterImportAt = now;
  }
  if (options?.gradesComplete) {
    milestones.backupAfterGradesAt = now;
  }
  return {
    ...project,
    workflowMilestones: milestones,
  };
}

/** Nach neuem XLSX-Import: Sicherungs-Meilensteine zurücksetzen */
export function clearWorkflowMilestonesOnImport(
  project: ExamProject
): ExamProject {
  if (
    !project.workflowMilestones?.backupAfterImportAt &&
    !project.workflowMilestones?.backupAfterGradesAt
  ) {
    return project;
  }
  return {
    ...project,
    workflowMilestones: {
      ...project.workflowMilestones,
      backupAfterImportAt: undefined,
      backupAfterGradesAt: undefined,
    },
  };
}

/** Nach erneuter offener Bewertung: Noten-Sicherung ungültig */
export function clearBackupAfterGradesMilestone(
  project: ExamProject
): ExamProject {
  if (!project.workflowMilestones?.backupAfterGradesAt) return project;
  return {
    ...project,
    workflowMilestones: {
      ...project.workflowMilestones,
      backupAfterGradesAt: undefined,
    },
  };
}
