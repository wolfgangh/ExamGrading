import {
  hasOpenGrading,
  openGradingSummary,
  countOpenGradingTasks,
} from "@/lib/grades/open-grading";
import { listUnresolvedOrphans } from "@/lib/matching/orphan-resolution";
import { orphanCount } from "@/lib/matching/merge-candidates";
import {
  backupStatusLabel,
  hasSubstantialData,
  isBackupStale,
} from "@/lib/backup-status";
import {
  backupAfterGradesDone,
  backupAfterImportDone,
  backupAfterMatchingDone,
  gradesDataComplete,
  importsComplete,
  matchingReadyForBackup,
} from "@/lib/workflow-milestones";
import {
  isSubAreaMappingComplete,
  needsSubAreaMapping,
  subAreaMappingSummary,
} from "@/lib/grades/subarea-mapping";
import {
  HISINONE_LABEL,
  isOnlineStyleExam,
  type EnrichedStudentRow,
  type ExamProject,
  type ExamStatistics,
} from "@/lib/types";

export type WorkflowStep = {
  id: string;
  done: boolean;
  label: string;
  href: string;
  detail: string;
  critical?: boolean;
  actionLabel?: string;
};

export {
  importsComplete,
  backupAfterImportDone,
  backupAfterGradesDone,
  backupAfterMatchingDone,
} from "@/lib/workflow-milestones";

export function gradesComplete(
  project: ExamProject,
  _rows: EnrichedStudentRow[],
  stats: ExamStatistics
): boolean {
  return gradesDataComplete(project, stats.graded);
}

function formatMilestoneAt(iso?: string): string {
  if (!iso) return "";
  try {
    return ` · ${new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } catch {
    return "";
  }
}

/**
 * Vollständige Workflow-Schritte für Übersicht und Sidebar.
 */
export function buildWorkflowSteps(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics,
  examId: string
): WorkflowStep[] {
  const isKlausur = project.examType === "written";
  const onlineStyle = isOnlineStyleExam(project.examType);
  const openGrading = hasOpenGrading(project);
  const openGradingCount = countOpenGradingTasks(project);
  const unresolvedN = onlineStyle
    ? listUnresolvedOrphans(project, rows).length
    : 0;
  const orphanN = onlineStyle ? orphanCount(project) : 0;
  const mergeN = (project.identityMerges ?? []).filter((m) => m.active).length;
  const dismissN = (project.identityDismissals ?? []).filter(
    (d) => d.active
  ).length;
  const backupOk = hasSubstantialData(project) && !isBackupStale(project);
  const backupStale = isBackupStale(project);
  const importsOk = importsComplete(project);
  const gradesOk = gradesComplete(project, rows, stats);
  const gradedExportReady = rows.filter(
    (r) => r.status === "export_ready"
  ).length;
  const importBackupDone = backupAfterImportDone(project);
  const matchingReady = matchingReadyForBackup(project, unresolvedN);
  const matchingBackupDone = backupAfterMatchingDone(project, unresolvedN);
  const gradesBackupDone = backupAfterGradesDone(project) && gradesOk;
  const subMapNeeded = needsSubAreaMapping(project);
  const subMapOk = isSubAreaMappingComplete(project);
  const pointsDone =
    project.points.length > 0 && !openGrading && (!subMapNeeded || subMapOk);

  const steps: WorkflowStep[] = [
    {
      id: "his",
      done: project.hisRows.length > 0,
      label: `${HISINONE_LABEL}-Masterliste`,
      href: `/exam/${examId}/import`,
      detail:
        project.hisRows.length > 0
          ? `${project.hisRows.length} Anmeldungen importiert`
          : "Noch nicht importiert",
      actionLabel: project.hisRows.length > 0 ? "Öffnen" : "Importieren",
    },
    ...(isKlausur
      ? []
      : [
          {
            id: "attendance",
            done: project.attendance.length > 0,
            label: "Antrittsliste",
            href: `/exam/${examId}/import`,
            detail:
              project.attendance.length > 0
                ? `${project.attendance.length} Moodle · ${stats.attended} gematcht${
                    stats.attendedOrphan > 0
                      ? ` · ${stats.attendedOrphan} ohne ${HISINONE_LABEL}`
                      : ""
                  }`
                : "Noch nicht importiert",
            actionLabel:
              project.attendance.length > 0 ? "Öffnen" : "Importieren",
          } satisfies WorkflowStep,
        ]),
    ...(onlineStyle
      ? [
          {
            id: "matching",
            done: unresolvedN === 0,
            label: "Matrikel-Zuordnung",
            href: `/exam/${examId}/matching`,
            detail:
              unresolvedN > 0
                ? `${unresolvedN} ungeprüfte Orphan(s) – Export gesperrt`
                : orphanN > 0 || mergeN + dismissN > 0
                  ? `Geprüft${mergeN > 0 ? ` · ${mergeN} Merge(s)` : ""}${
                      dismissN > 0 ? ` · ${dismissN} Ablehnung(en)` : ""
                    }`
                  : project.attendance.length === 0
                    ? "Zuerst Antrittsliste importieren"
                    : "Keine Sonderfälle",
            critical: unresolvedN > 0,
            actionLabel: unresolvedN > 0 ? "Jetzt prüfen" : "Zur Zuordnung",
          } satisfies WorkflowStep,
        ]
      : []),
    {
      id: "backup-import",
      done: importBackupDone,
      label: "Sicherung nach Import",
      href: `/exam/${examId}/export?stage=import#sicherung`,
      detail: !importsOk
        ? `Zuerst alle XLSX importieren (${HISINONE_LABEL}${
            isKlausur ? ", Punkte" : ", Antritt, Punkte"
          })`
        : importBackupDone
          ? `Erledigt${formatMilestoneAt(
              project.workflowMilestones?.backupAfterImportAt
            )}`
          : "JSON-Sicherung …_nach-Import",
      critical: importsOk && !importBackupDone,
      actionLabel: importBackupDone ? "Öffnen" : "Jetzt sichern",
    },
    {
      id: "points",
      done: pointsDone,
      label: isKlausur ? "Punkte (Vorlage)" : "Punkte & Bewertung",
      href:
        openGrading || (subMapNeeded && !subMapOk)
          ? `/exam/${examId}/detail-points`
          : `/exam/${examId}/import?focus=points`,
      detail:
        project.points.length === 0
          ? isKlausur
            ? "Vorlage exportieren & importieren"
            : "Noch keine Punkte importiert"
          : openGrading
            ? openGradingSummary(project)
            : subMapNeeded && !subMapOk
              ? subAreaMappingSummary(project)
              : `${project.points.length} mit Punkten · alle Aufgaben bewertet`,
      critical: openGrading || (subMapNeeded && !subMapOk),
      actionLabel: openGrading
        ? "Jetzt bewerten"
        : subMapNeeded && !subMapOk
          ? "Teilgebiete zuordnen"
          : project.points.length > 0
            ? "Öffnen"
            : "Importieren",
    },
    {
      id: "grades",
      done: gradesOk && (!subMapNeeded || subMapOk),
      label: "Noten berechnet",
      href:
        openGrading || (subMapNeeded && !subMapOk)
          ? `/exam/${examId}/detail-points`
          : `/exam/${examId}/grades`,
      detail: openGrading
        ? `Notenschlüssel gesperrt – ${openGradingCount.people} Person(en), ${openGradingCount.tasks} Aufgabe(n) offen`
        : subMapNeeded && !subMapOk
          ? "Zuerst Teilgebiet-Zuordnung bestätigen"
          : stats.graded > 0
            ? `${stats.graded} Noten vorhanden`
            : "Noch keine Noten",
      critical: openGrading || (subMapNeeded && !subMapOk),
      actionLabel: openGrading
        ? "Bewertung abschließen"
        : subMapNeeded && !subMapOk
          ? "Teilgebiete zuordnen"
          : "Zur Notenübersicht",
    },
    ...(onlineStyle
      ? [
          {
            id: "backup-matching",
            done: matchingBackupDone,
            label: "Sicherung nach Zuordnung",
            href: `/exam/${examId}/export?stage=matching#sicherung`,
            detail: !matchingReady
              ? unresolvedN > 0
                ? "Zuerst alle Orphans prüfen"
                : "Zuerst Antritt und HISinOne"
              : matchingBackupDone
                ? `Erledigt${formatMilestoneAt(
                    project.workflowMilestones?.backupAfterMatchingAt
                  )}`
                : "JSON-Sicherung …_nach-Zuordnung",
            critical: matchingReady && !matchingBackupDone,
            actionLabel: matchingBackupDone ? "Öffnen" : "Jetzt sichern",
          } satisfies WorkflowStep,
        ]
      : []),
    {
      id: "backup-grades",
      done: gradesBackupDone,
      label: "Sicherung nach Noten",
      href: `/exam/${examId}/export?stage=grades#sicherung`,
      detail: !gradesOk
        ? "Zuerst Bewertung abschließen und Noten berechnen"
        : gradesBackupDone
          ? `Erledigt${formatMilestoneAt(
              project.workflowMilestones?.backupAfterGradesAt
            )}`
          : "JSON-Sicherung …_nach-Noten – vor dem Export",
      critical: gradesOk && !gradesBackupDone,
      actionLabel: gradesBackupDone ? "Öffnen" : "Jetzt sichern",
    },
    {
      id: "documents",
      done:
        gradedExportReady > 0 &&
        backupOk &&
        !openGrading &&
        (!onlineStyle || unresolvedN === 0) &&
        (!subMapNeeded || subMapOk),
      label: "Dokumente / HISinOne-Export",
      href: !backupOk
        ? `/exam/${examId}/export#sicherung`
        : openGrading || (subMapNeeded && !subMapOk)
          ? `/exam/${examId}/detail-points`
          : onlineStyle && unresolvedN > 0
            ? `/exam/${examId}/matching`
            : `/exam/${examId}/documents`,
      detail: openGrading
        ? "Zuerst alle Aufgaben bewerten (Export gesperrt)"
        : subMapNeeded && !subMapOk
          ? "Zuerst Teilgebiet-Zuordnung"
          : !backupOk
            ? `Aktuelle Sicherung erforderlich (${backupStatusLabel(project)})`
            : onlineStyle && unresolvedN > 0
              ? "Zuerst Matrikel-Zuordnung abschließen"
              : gradedExportReady > 0
                ? `${gradedExportReady} mit Note exportbereit` +
                  (stats.noShow > 0 ? ` · ${stats.noShow} No-Show(s)` : "")
                : "Noch nicht exportbereit",
      critical:
        openGrading ||
        (subMapNeeded && !subMapOk) ||
        (backupStale && hasSubstantialData(project)) ||
        (onlineStyle && unresolvedN > 0),
      actionLabel: openGrading
        ? "Bewertung abschließen"
        : subMapNeeded && !subMapOk
          ? "Teilgebiete zuordnen"
          : !backupOk
            ? "Zuerst sichern"
            : onlineStyle && unresolvedN > 0
              ? "Zuordnung prüfen"
              : "Zu Dokumente",
    },
  ];

  return steps;
}

export function workflowProgress(steps: WorkflowStep[]): {
  doneCount: number;
  totalCount: number;
  progressPct: number;
  nextOpen: WorkflowStep | undefined;
} {
  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  return {
    doneCount,
    totalCount,
    progressPct: totalCount > 0 ? (doneCount / totalCount) * 100 : 0,
    nextOpen: steps.find((s) => !s.done),
  };
}
