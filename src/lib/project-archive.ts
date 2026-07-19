import { z } from "zod";
import { migrateExamProject } from "@/lib/grades/scenarios";
import {
  assertJsonSizeLimit,
  MAX_PROJECT_ARCHIVE_BYTES,
} from "@/lib/import-limits";
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

/**
 * Sanfte Validierung: Pflichtfelder id/name, Rest passthrough.
 * Vermeidet Breaks bei Legacy-Sicherungen und Zusatzfeldern.
 */
const projectCoreSchema = z
  .object({
    id: z.string().min(1, "Ungültiges Prüfungsprojekt (ID fehlt)."),
    name: z.string().min(1, "Ungültiges Prüfungsprojekt (Name fehlt)."),
  })
  .passthrough();

const archiveWrapperSchema = z
  .object({
    format: z.literal(ARCHIVE_FORMAT),
    project: z.unknown(),
  })
  .passthrough();

export function isExamGradeArchive(data: unknown): data is ExamGradeArchive {
  return archiveWrapperSchema.safeParse(data).success;
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
  const parsed = projectCoreSchema.safeParse(raw);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    throw new Error(msg || "Ungültiges Prüfungsprojekt.");
  }

  const data: ExamProject = { ...(parsed.data as unknown as ExamProject) };
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
  return migrateExamProject(data);
}

/**
 * Parst Archiv-Wrapper oder Legacy-Rohprojekt (reines ExamProject-JSON).
 * Größenlimit und sanfte Zod-Pflichtfeldprüfung.
 */
export function parseProjectArchive(json: string): ExamProject {
  assertJsonSizeLimit(json, MAX_PROJECT_ARCHIVE_BYTES);

  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error("Datei ist kein gültiges JSON.");
  }

  if (isExamGradeArchive(data)) {
    return normalizeProject(data.project as ExamProject);
  }
  return normalizeProject(data as ExamProject);
}

export type { BackupStage } from "@/lib/workflow-milestones";

const STAGE_SUFFIX: Record<
  import("@/lib/workflow-milestones").BackupStage,
  string
> = {
  import: "nach-Import",
  matching: "nach-Zuordnung",
  grades: "nach-Noten",
  general: "Sicherung",
};

export function projectArchiveFilename(
  project: ExamProject,
  stage: import("@/lib/workflow-milestones").BackupStage = "general"
): string {
  const suffix = STAGE_SUFFIX[stage] ?? "Sicherung";
  const base = `ExamGrade_${project.name || "Pruefung"}_${suffix}`;
  // Datum + Schritt im Namen genügen – ohne Uhrzeit
  return datedExportFilename(base, "json", { withTime: false });
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
