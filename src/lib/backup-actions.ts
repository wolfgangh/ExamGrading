import {
  buildProjectArchive,
  projectArchiveFilename,
} from "@/lib/project-archive";
import { markProjectBackedUp } from "@/lib/backup-status";
import type { ExamProject } from "@/lib/types";
import { downloadJson } from "@/lib/download";
import type { BackupStage } from "@/lib/workflow-milestones";
import { inferBackupStage } from "@/lib/workflow-milestones";

/**
 * JSON-Sicherung herunterladen und Projekt als gesichert markieren.
 * `setProject` muss den Exam-Context-Updater sein.
 */
export function downloadAndMarkBackup(
  project: ExamProject,
  setProject: (
    updater: ExamProject | ((prev: ExamProject) => ExamProject)
  ) => void,
  options?: {
    gradedCount?: number;
    unresolvedOrphanCount?: number;
    stage?: BackupStage;
  }
): ExamProject {
  const stage =
    options?.stage ??
    inferBackupStage(project, {
      gradedCount: options?.gradedCount,
      unresolvedOrphanCount: options?.unresolvedOrphanCount,
    });

  void downloadJson(
    projectArchiveFilename(project, stage),
    buildProjectArchive(project)
  );
  const marked = markProjectBackedUp(project, {
    gradedCount: options?.gradedCount,
    unresolvedOrphanCount: options?.unresolvedOrphanCount,
    stage,
  });
  setProject(() => marked);
  return marked;
}
