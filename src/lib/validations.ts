import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import {
  countOpenGradingTasks,
  hasOpenGrading,
} from "@/lib/grades/open-grading";

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
