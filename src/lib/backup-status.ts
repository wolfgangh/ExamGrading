import type { ExamProject } from "@/lib/types";
import { hasOpenGrading } from "@/lib/grades/open-grading";
import { withWorkflowMilestonesOnBackup } from "@/lib/workflow-milestones";

/** Mindestens ein Import / Datenbestand vorhanden */
export function hasSubstantialData(project: ExamProject): boolean {
  return (
    (project.hisRows?.length ?? 0) > 0 ||
    (project.attendance?.length ?? 0) > 0 ||
    (project.points?.length ?? 0) > 0 ||
    (project.questionDefs?.length ?? 0) > 0
  );
}

/** Sicherung nötig und noch nie oder veraltet */
export function isBackupStale(project: ExamProject): boolean {
  if (!hasSubstantialData(project)) return false;
  if (!project.lastBackupAt || !project.lastBackupSyncedUpdatedAt) {
    return true;
  }
  return project.updatedAt !== project.lastBackupSyncedUpdatedAt;
}

/** Geschützte Exporte (HIS-Excel, PDFs) freigeben */
export function canAccessProtectedExport(project: ExamProject): boolean {
  return !isBackupStale(project);
}

export function backupStatusLabel(project: ExamProject): string {
  if (!hasSubstantialData(project)) {
    return "Noch keine Importdaten";
  }
  if (!project.lastBackupAt) {
    return "Noch keine Sicherung";
  }
  if (isBackupStale(project)) {
    return "Sicherung veraltet";
  }
  try {
    const d = new Date(project.lastBackupAt);
    return `Gesichert ${d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "Gesichert";
  }
}

/**
 * Markiert das aktuelle Projekt als soeben gesichert.
 * Setzt updatedAt und Sync-Felder auf denselben Zeitstempel,
 * damit Auto-Save das Backup nicht sofort wieder „stale“ macht.
 * Setzt Workflow-Meilensteine (Sicherung nach Import / nach Noten), wenn fällig.
 */
export function markProjectBackedUp(
  project: ExamProject,
  options?: { gradedCount?: number }
): ExamProject {
  const now = new Date().toISOString();
  const gradesComplete =
    !hasOpenGrading(project) && (options?.gradedCount ?? 0) > 0;
  const withMilestones = withWorkflowMilestonesOnBackup(project, {
    gradesComplete,
  });
  return {
    ...withMilestones,
    updatedAt: now,
    lastBackupAt: now,
    lastBackupSyncedUpdatedAt: now,
  };
}

/**
 * Nach JSON-Import: als frisch gesichert markieren
 * (Quelle war gerade die Sicherungsdatei).
 */
export function markProjectRestoredFromBackup(
  project: ExamProject
): ExamProject {
  const now = new Date().toISOString();
  const gradesComplete =
    !hasOpenGrading(project) &&
    (project.points?.some((p) => p.gradeOverride != null || p.totalPoints != null) ??
      false);
  // Nach Restore: Meilensteine wie frische Sicherung setzen, wenn Daten passen
  const withMilestones = withWorkflowMilestonesOnBackup(project, {
    gradesComplete: !hasOpenGrading(project) && gradesComplete,
  });
  return {
    ...withMilestones,
    updatedAt: now,
    lastBackupAt: now,
    lastBackupSyncedUpdatedAt: now,
  };
}
