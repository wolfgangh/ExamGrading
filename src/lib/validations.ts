import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import { HISINONE_LABEL, isOnlineStyleExam } from "@/lib/types";
import {
  countOpenGradingTasks,
  hasOpenGrading,
} from "@/lib/grades/open-grading";
import {
  getHisSources,
  sourcesMissingOriginalTemplate,
} from "@/lib/his-sources";
import {
  hasUnresolvedOrphans,
  listUnresolvedOrphans,
} from "@/lib/matching/orphan-resolution";
import {
  isSubAreaMappingComplete,
  needsSubAreaMapping,
  subAreaMappingIssues,
} from "@/lib/grades/subarea-mapping";
import {
  isPortfolioExam,
  isStaCriteriaExam,
  isStaManualExam,
} from "@/lib/types";
import { countMissingCriteria } from "@/lib/grades/sta-criteria";
import { countMissingPortfolioCells } from "@/lib/grades/portfolio";
import { normalizeMatriculation } from "@/lib/matching/matriculation";

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
      message: `Keine ${HISINONE_LABEL}-Masterliste importiert – Export unvollständig.`,
    });
  }

  const missingOriginal = sourcesMissingOriginalTemplate(project);
  if (missingOriginal.length > 0 && getHisSources(project).length > 0) {
    items.push({
      level: "error",
      message: `Original-${HISINONE_LABEL}-Datei fehlt für formatgetreuen Export – bitte Datei(en) unter Import erneut einlesen.`,
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

  if (isOnlineStyleExam(project.examType) && hasUnresolvedOrphans(project, rows)) {
    const n = listUnresolvedOrphans(project, rows).length;
    items.push({
      level: "error",
      message: `${n} Antritt/Punkte ohne ${HISINONE_LABEL} noch ungeprüft – unter Zuordnung zusammenführen oder ablehnen (Notenliste und ${HISINONE_LABEL}-Export gesperrt).`,
      count: n,
    });
  }

  if (needsSubAreaMapping(project) && !isSubAreaMappingComplete(project)) {
    const issues = subAreaMappingIssues(project);
    items.push({
      level: "error",
      message: `Teilgebiet-Zuordnung unvollständig: ${issues[0] ?? "Aufgaben den Teilgebieten zuordnen (Detailpunkte)"}.`,
      count: issues.length,
    });
  }

  if (isStaCriteriaExam(project.examType)) {
    if (!(project.criteria?.length)) {
      items.push({
        level: "error",
        message:
          "Keine Bewertungskriterien definiert – unter Einstellungen anlegen.",
      });
    } else {
      const incomplete = rows.filter((r) => {
        if (!r.inHis) return false;
        const rec = project.points.find(
          (p) => normalizeMatriculation(p.matriculationNumber) === r.key
        );
        return (
          countMissingCriteria(rec?.criterionValues, project.criteria ?? []) >
          0
        );
      });
      if (incomplete.length > 0) {
        items.push({
          level: "error",
          message: `Kriterien unvollständig bei ${incomplete.length} Person(en) in HISinOne.`,
          count: incomplete.length,
        });
      }
    }
  }

  if (isStaManualExam(project.examType)) {
    const missingGrade = rows.filter(
      (r) => r.inHis && r.finalGrade == null
    );
    if (missingGrade.length > 0) {
      items.push({
        level: "error",
        message: `Manuelle Note fehlt bei ${missingGrade.length} Person(en) in HISinOne.`,
        count: missingGrade.length,
      });
    }
  }

  if (isPortfolioExam(project.examType)) {
    if (!(project.portfolioComponents?.length)) {
      items.push({
        level: "error",
        message:
          "Keine Teilleistungen definiert – unter Einstellungen anlegen (Standard: 2).",
      });
    } else {
      const incomplete = rows.filter((r) => {
        if (!r.inHis) return false;
        const rec = project.points.find(
          (p) => normalizeMatriculation(p.matriculationNumber) === r.key
        );
        return countMissingPortfolioCells(project, rec) > 0;
      });
      if (incomplete.length > 0) {
        items.push({
          level: "error",
          message: `Teilnoten unvollständig bei ${incomplete.length} Person(en) in HISinOne.`,
          count: incomplete.length,
        });
      }
    }
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
      message: `Unstimmigkeiten (nicht in ${HISINONE_LABEL} oder nur in Antritt/Punkte)`,
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

  const merges = (project.identityMerges ?? []).filter((m) => m.active);
  if (merges.length > 0) {
    items.push({
      level: "info",
      message: "Manuelle Matrikel-Zusammenführungen (dokumentiert)",
      count: merges.length,
    });
  }

  const dismissals = (project.identityDismissals ?? []).filter((d) => d.active);
  if (dismissals.length > 0) {
    items.push({
      level: "info",
      message: "Matrikel-Sonderfälle geprüft und abgelehnt",
      count: dismissals.length,
    });
  }

  const exportReady = rows.filter(
    (r) => r.inHis && (r.status === "export_ready" || r.status === "no_show")
  );
  items.push({
    level: "info",
    message: `Für ${HISINONE_LABEL}-Export vorgesehene Zeilen`,
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
