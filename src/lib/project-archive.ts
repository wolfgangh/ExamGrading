import { migrateExamProject } from "@/lib/grades/scenarios";
import type { ExamProject } from "@/lib/types";
import { datedExportFilename } from "@/lib/utils";

export const ARCHIVE_FORMAT = "examgrade-project" as const;
export const ARCHIVE_FORMAT_VERSION = 1 as const;

export interface ExamGradeArchive {
  format: typeof ARCHIVE_FORMAT;
  formatVersion: typeof ARCHIVE_FORMAT_VERSION;
  exportedAt: string;
  appHint: "ExamGrade";
  project: ExamProject;
}

export function isExamGradeArchive(data: unknown): data is ExamGradeArchive {
  if (!data || typeof data !== "object") return false;
  const o = data as Record<string, unknown>;
  return (
    o.format === ARCHIVE_FORMAT &&
    o.project != null &&
    typeof o.project === "object"
  );
}

export function buildProjectArchive(project: ExamProject): string {
  const archive: ExamGradeArchive = {
    format: ARCHIVE_FORMAT,
    formatVersion: ARCHIVE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    appHint: "ExamGrade",
    project,
  };
  return JSON.stringify(archive, null, 2);
}

function normalizeProject(raw: ExamProject): ExamProject {
  if (!raw || typeof raw !== "object" || !raw.name) {
    throw new Error("Ungültiges Prüfungsprojekt (Name fehlt).");
  }
  const data: ExamProject = { ...raw };
  if (!data.schemaVersion) {
    data.schemaVersion = 1;
  }
  data.hisRows = data.hisRows ?? [];
  data.attendance = data.attendance ?? [];
  data.points = data.points ?? [];
  data.students = data.students ?? {};
  data.importLogs = data.importLogs ?? [];
  data.subAreas = data.subAreas ?? [];
  data.lecturers = data.lecturers ?? [];
  if (!data.id) {
    throw new Error("Ungültiges Prüfungsprojekt (ID fehlt).");
  }
  return migrateExamProject(data);
}

/**
 * Parst Archiv-Wrapper oder Legacy-Rohprojekt (reines ExamProject-JSON).
 */
export function parseProjectArchive(json: string): ExamProject {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Datei ist kein gültiges JSON.");
  }

  if (isExamGradeArchive(data)) {
    return normalizeProject(data.project);
  }
  return normalizeProject(data as ExamProject);
}

export function projectArchiveFilename(project: ExamProject): string {
  const base = `ExamGrade_${project.name || "Pruefung"}_Sicherung`;
  return datedExportFilename(base, "json");
}

/** Kurzinfo für Import-Meldung */
export function projectArchiveSummary(project: ExamProject): string {
  return [
    `„${project.name}“`,
    `${project.hisRows?.length ?? 0} HIS`,
    `${project.attendance?.length ?? 0} Antritte`,
    `${project.points?.length ?? 0} Punkte`,
  ].join(" · ");
}
