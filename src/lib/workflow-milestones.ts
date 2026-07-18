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

/** THE/elektrP: Matching-Sicherung nach gelösten Orphans */
export function matchingReadyForBackup(
  project: ExamProject,
  unresolvedOrphanCount: number
): boolean {
  if (!isOnlineStyleExam(project.examType)) return false;
  return (
    (project.attendance?.length ?? 0) > 0 &&
    (project.hisRows?.length ?? 0) > 0 &&
    unresolvedOrphanCount === 0
  );
}

export function backupAfterMatchingDone(
  project: ExamProject,
  unresolvedOrphanCount: number
): boolean {
  return (
    matchingReadyForBackup(project, unresolvedOrphanCount) &&
    Boolean(project.workflowMilestones?.backupAfterMatchingAt)
  );
}

export function backupAfterGradesDone(project: ExamProject): boolean {
  return Boolean(project.workflowMilestones?.backupAfterGradesAt);
}

export type BackupStage = "import" | "matching" | "grades" | "general";

/**
 * Leitet den Dateinamen-Schritt aus dem Projektstand ab
 * (fehlende Meilensteine zuerst: Import → Zuordnung → Noten).
 */
export function inferBackupStage(
  project: ExamProject,
  options?: { gradedCount?: number; unresolvedOrphanCount?: number }
): BackupStage {
  const unresolved = options?.unresolvedOrphanCount ?? 0;
  const graded = options?.gradedCount ?? 0;

  if (
    importsComplete(project) &&
    !project.workflowMilestones?.backupAfterImportAt
  ) {
    return "import";
  }
  if (
    matchingReadyForBackup(project, unresolved) &&
    !project.workflowMilestones?.backupAfterMatchingAt
  ) {
    return "matching";
  }
  if (
    gradesDataComplete(project, graded) &&
    !project.workflowMilestones?.backupAfterGradesAt
  ) {
    return "grades";
  }
  if (gradesDataComplete(project, graded)) return "grades";
  if (matchingReadyForBackup(project, unresolved)) return "matching";
  if (importsComplete(project)) return "import";
  return "general";
}

/** Meilensteine beim JSON-Sichern setzen (wenn Voraussetzungen erfüllt) */
export function withWorkflowMilestonesOnBackup(
  project: ExamProject,
  options?: {
    gradesComplete?: boolean;
    matchingComplete?: boolean;
    stage?: BackupStage;
  }
): ExamProject {
  const now = new Date().toISOString();
  const milestones = { ...project.workflowMilestones };
  const stage = options?.stage ?? "general";

  const setImport =
    importsComplete(project) &&
    (stage === "import" || stage === "general");
  const setMatching =
    Boolean(options?.matchingComplete) &&
    (stage === "matching" || stage === "general");
  const setGrades =
    Boolean(options?.gradesComplete) &&
    (stage === "grades" || stage === "general");

  if (setImport) milestones.backupAfterImportAt = now;
  if (setMatching) milestones.backupAfterMatchingAt = now;
  if (setGrades) milestones.backupAfterGradesAt = now;

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
    !project.workflowMilestones?.backupAfterMatchingAt &&
    !project.workflowMilestones?.backupAfterGradesAt
  ) {
    return project;
  }
  return {
    ...project,
    workflowMilestones: {
      ...project.workflowMilestones,
      backupAfterImportAt: undefined,
      backupAfterMatchingAt: undefined,
      backupAfterGradesAt: undefined,
    },
  };
}

/** Nach erneut ungeprüften Orphans: Matching-Sicherung ungültig */
export function clearBackupAfterMatchingMilestone(
  project: ExamProject
): ExamProject {
  if (!project.workflowMilestones?.backupAfterMatchingAt) return project;
  return {
    ...project,
    workflowMilestones: {
      ...project.workflowMilestones,
      backupAfterMatchingAt: undefined,
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
