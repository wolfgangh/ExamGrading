import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import {
  countOpenGradingTasks,
  hasOpenGrading,
} from "@/lib/grades/open-grading";
import {
  getHisSources,
  sourcesMissingOriginalTemplate,
} from "@/lib/his-sources";

export interface ValidationItem {
  level: "error" | "warning" | "info";
  message: string;
  count?: number;
}

export function validateForExport(
  project: ExamProject,
  rows: EnrichedStudentRow[]
): ValidationItem[] {
  const items: ValidationItem[] = [];

  if (project.hisRows.length === 0) {
    items.push({
      level: "error",
      message: "Keine HIS-Masterliste importiert – Export unvollständig.",
    });
  }

  const missingOriginal = sourcesMissingOriginalTemplate(project);
  if (missingOriginal.length > 0 && getHisSources(project).length > 0) {
    items.push({
      level: "error",
      message:
        "Original-HIS-Datei fehlt für formatgetreuen HisinOne-Export – bitte HIS-Datei(en) unter Import erneut einlesen.",
      count: missingOriginal.length,
    });
  }

  if (hasOpenGrading(project)) {
    const { people, tasks } = countOpenGradingTasks(project);
    items.push({
      level: "error",
      message: `Offene Aufgaben „Bewertung notwendig“ (${people} Person(en), ${tasks} Aufgabe(n)) – Export und PDF gesperrt, bis alle bewertet sind.`,
      count: tasks,
    });
  }

  const missingPoints = rows.filter(
    (r) => r.inHis && r.attended === true && !r.hasPoints
  );
  if (missingPoints.length > 0) {
    items.push({
      level: "warning",
      message: "Angetretene ohne Punkte",
      count: missingPoints.length,
    });
  }

  const mismatches = rows.filter((r) => r.status === "mismatch");
  if (mismatches.length > 0) {
    items.push({
      level: "warning",
      message: "Unstimmigkeiten (nicht in HIS oder nur in Antritt/Punkte)",
      count: mismatches.length,
    });
  }

  const overMax = rows.filter(
    (r) =>
      r.totalPoints != null &&
      r.totalPoints > project.gradeSchema.maxPoints
  );
  if (overMax.length > 0) {
    items.push({
      level: "warning",
      message: "Punktzahlen über dem Maximum",
      count: overMax.length,
    });
  }

  const overrides = rows.filter((r) => r.gradeOverride != null);
  if (overrides.length > 0) {
    items.push({
      level: "info",
      message: "Manuelle Notenüberschreibungen",
      count: overrides.length,
    });
  }

  const noShows = rows.filter((r) => r.status === "no_show");
  if (noShows.length > 0) {
    items.push({
      level: "info",
      message: "No-Shows (leere Note im Export)",
      count: noShows.length,
    });
  }

  const orphans = rows.filter(
    (r) =>
      (!r.inHis || r.attendanceWithoutHis) &&
      (r.attended === true || r.hasPoints)
  );
  if (orphans.length > 0 && project.examType === "the") {
    items.push({
      level: "warning",
      message:
        "Antritt/Punkte ohne HIS (mögliche Matrikel-Tippfehler) – unter Zuordnung prüfen",
      count: orphans.length,
    });
  }

  const merges = (project.identityMerges ?? []).filter((m) => m.active);
  if (merges.length > 0) {
    items.push({
      level: "info",
      message: "Manuelle Matrikel-Zusammenführungen (dokumentiert)",
      count: merges.length,
    });
  }

  const exportReady = rows.filter(
    (r) => r.inHis && (r.status === "export_ready" || r.status === "no_show")
  );
  items.push({
    level: "info",
    message: "Für Export vorgesehene HIS-Zeilen",
    count: exportReady.length,
  });

  if (items.every((i) => i.level !== "error") && project.hisRows.length > 0) {
    items.unshift({
      level: "info",
      message: "Keine blockierenden Fehler – Export möglich.",
    });
  }

  return items;
}
