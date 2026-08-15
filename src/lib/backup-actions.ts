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
 * JSON-Sicherung herunterladen und erst bei Erfolg als gesichert markieren.
 */
export async function downloadAndMarkBackup(
  project: ExamProject,
  setProject: (
    updater: ExamProject | ((prev: ExamProject) => ExamProject)
  ) => void,
  options?: {
    gradedCount?: number;
    unresolvedOrphanCount?: number;
    stage?: BackupStage;
  }
): Promise<ExamProject> {
  const stage =
    options?.stage ??
    inferBackupStage(project, {
      gradedCount: options?.gradedCount,
      unresolvedOrphanCount: options?.unresolvedOrphanCount,
    });

  const result = await downloadJson(
    projectArchiveFilename(project, stage),
    buildProjectArchive(project)
  );
  if (result.method === "failed") {
    throw new Error(
      result.error || "Sicherung konnte nicht heruntergeladen werden."
    );
  }
  const marked = markProjectBackedUp(project, {
    gradedCount: options?.gradedCount,
    unresolvedOrphanCount: options?.unresolvedOrphanCount,
    stage,
  });
  setProject(() => marked);
  return marked;
}
