import {
  buildProjectArchive,
  projectArchiveFilename,
} from "@/lib/project-archive";
import { markProjectBackedUp } from "@/lib/backup-status";
import type { ExamProject } from "@/lib/types";
import { downloadJson } from "@/lib/utils";

/**
 * JSON-Sicherung herunterladen und Projekt als gesichert markieren.
 * `setProject` muss den Exam-Context-Updater sein.
 */
export function downloadAndMarkBackup(
  project: ExamProject,
  setProject: (
    updater: ExamProject | ((prev: ExamProject) => ExamProject)
  ) => void
): ExamProject {
  // Aktuellen Stand sichern (inkl. bisheriger Backup-Felder)
  downloadJson(projectArchiveFilename(project), buildProjectArchive(project));
  const marked = markProjectBackedUp(project);
  setProject(() => marked);
  return marked;
}
