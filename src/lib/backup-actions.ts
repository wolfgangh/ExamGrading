import {
  buildProjectArchive,
  projectArchiveFilename,
} from "@/lib/project-archive";
import { markProjectBackedUp } from "@/lib/backup-status";
import type { ExamProject } from "@/lib/types";
import { downloadJson } from "@/lib/download";

/**
 * JSON-Sicherung herunterladen und Projekt als gesichert markieren.
 * `setProject` muss den Exam-Context-Updater sein.
 */
export function downloadAndMarkBackup(
  project: ExamProject,
  setProject: (
    updater: ExamProject | ((prev: ExamProject) => ExamProject)
  ) => void,
  options?: { gradedCount?: number }
): ExamProject {
  // Aktuellen Stand sichern (inkl. bisheriger Backup-Felder)
  // Download ist async (Teams-Fallback); Markierung sofort, damit Workflow weiterläuft
  void downloadJson(
    projectArchiveFilename(project),
    buildProjectArchive(project)
  );
  const marked = markProjectBackedUp(project, {
    gradedCount: options?.gradedCount,
  });
  setProject(() => marked);
  return marked;
}
