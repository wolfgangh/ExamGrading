"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { GradeDistributionChart } from "@/components/charts/grade-distribution-chart";
import { PointsHistogramChart } from "@/components/charts/points-histogram-chart";
import { SummaryPanel } from "@/components/layout/summary-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  backupStatusLabel,
  hasSubstantialData,
  isBackupStale,
} from "@/lib/backup-status";
import { cn, formatGrade, formatPercent, formatStat } from "@/lib/utils";
import { orphanCount } from "@/lib/matching/merge-candidates";
import { listUnresolvedOrphans } from "@/lib/matching/orphan-resolution";
import {
  countOpenGradingTasks,
  hasOpenGrading,
  openGradingSummary,
} from "@/lib/grades/open-grading";
import { HISINONE_LABEL, isOnlineStyleExam } from "@/lib/types";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  GitMerge,
  PenLine,
  Table2,
  Download,
} from "lucide-react";

type WorkflowStep = {
  id: string;
  done: boolean;
  label: string;
  href: string;
  detail: string;
  /** Sicherung ausstehend / blockierend */
  critical?: boolean;
  actionLabel?: string;
};

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { project, stats, rows } = useExamContext();
  if (!project || !stats) return null;

  const backupOk = hasSubstantialData(project) && !isBackupStale(project);
  const backupStale = isBackupStale(project);

  const isKlausur = project.examType === "written";
  const onlineStyle = isOnlineStyleExam(project.examType);
  const orphanN = onlineStyle ? orphanCount(project) : 0;
  const unresolvedN = onlineStyle
    ? listUnresolvedOrphans(project, rows).length
    : 0;
  const mergeN = (project.identityMerges ?? []).filter((m) => m.active).length;
  const dismissN = (project.identityDismissals ?? []).filter(
    (d) => d.active
  ).length;

  const openGrading = hasOpenGrading(project);
  const openGradingCount = countOpenGradingTasks(project);
  /** Echte Noten exportbereit – No-Shows allein zählen nicht als „Export erledigt“ */
  const gradedExportReady = rows.filter(
    (r) => r.status === "export_ready"
  ).length;

  const steps: WorkflowStep[] = [
    {
      id: "his",
      done: project.hisRows.length > 0,
      label: `${HISINONE_LABEL}-Masterliste`,
      href: `/exam/${id}/import`,
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
            href: `/exam/${id}/import`,
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
    {
      id: "points",
      // Erst erledigt, wenn importiert UND keine „Bewertung notwendig“ mehr
      done: project.points.length > 0 && !openGrading,
      label: isKlausur ? "Punkte (Vorlage)" : "Punkte & Bewertung",
      href: openGrading
        ? `/exam/${id}/detail-points`
        : `/exam/${id}/import?focus=points`,
      detail:
        project.points.length === 0
          ? isKlausur
            ? "Vorlage exportieren & importieren"
            : "Noch keine Punkte importiert"
          : openGrading
            ? openGradingSummary(project)
            : `${project.points.length} mit Punkten · alle Aufgaben bewertet`,
      critical: openGrading,
      actionLabel: openGrading
        ? "Jetzt bewerten"
        : project.points.length > 0
          ? "Öffnen"
          : "Importieren",
    },
    {
      id: "grades",
      // Noten erst „fertig“, wenn Bewertung abgeschlossen und Noten existieren
      done: !openGrading && stats.graded > 0,
      label: "Noten berechnet",
      href: openGrading ? `/exam/${id}/detail-points` : `/exam/${id}/grades`,
      detail: openGrading
        ? `Notenschlüssel gesperrt – ${openGradingCount.people} Person(en), ${openGradingCount.tasks} Aufgabe(n) offen`
        : stats.graded > 0
          ? `${stats.graded} Noten vorhanden`
          : "Noch keine Noten",
      critical: openGrading,
      actionLabel: openGrading ? "Bewertung abschließen" : "Zur Notenübersicht",
    },
    ...(onlineStyle
      ? [
          {
            id: "matching",
            done: unresolvedN === 0,
            label: "Matrikel-Zuordnung",
            href: `/exam/${id}/matching`,
            detail:
              unresolvedN > 0
                ? `${unresolvedN} ungeprüfte Orphan(s) – Export gesperrt`
                : orphanN > 0 || mergeN + dismissN > 0
                  ? `Geprüft${mergeN > 0 ? ` · ${mergeN} Merge(s)` : ""}${
                      dismissN > 0 ? ` · ${dismissN} Ablehnung(en)` : ""
                    }`
                  : "Keine Sonderfälle",
            critical: unresolvedN > 0,
            actionLabel:
              unresolvedN > 0 ? "Jetzt prüfen" : "Zur Zuordnung",
          } satisfies WorkflowStep,
        ]
      : []),
    {
      id: "backup",
      done: backupOk,
      label: "Datensicherung (JSON)",
      href: `/exam/${id}/export#sicherung`,
      detail: backupStatusLabel(project),
      critical: backupStale && hasSubstantialData(project),
      actionLabel: backupOk ? "Öffnen" : "Jetzt sichern",
    },
    {
      id: "documents",
      done:
        gradedExportReady > 0 &&
        backupOk &&
        !openGrading &&
        (!onlineStyle || unresolvedN === 0),
      label: "Dokumente / HISinOne-Export",
      href: !backupOk
        ? `/exam/${id}/export#sicherung`
        : openGrading
          ? `/exam/${id}/detail-points`
          : onlineStyle && unresolvedN > 0
            ? `/exam/${id}/matching`
            : `/exam/${id}/documents`,
      detail: openGrading
        ? "Zuerst alle Aufgaben bewerten (Export gesperrt)"
        : !backupOk
          ? "Zuerst JSON-Sicherung"
          : onlineStyle && unresolvedN > 0
            ? "Zuerst Matrikel-Zuordnung abschließen"
            : gradedExportReady > 0
              ? `${gradedExportReady} mit Note exportbereit` +
                (stats.noShow > 0 ? ` · ${stats.noShow} No-Show(s)` : "")
              : "Noch nicht exportbereit",
      critical: openGrading || (backupStale && hasSubstantialData(project)),
      actionLabel: openGrading
        ? "Bewertung abschließen"
        : !backupOk
          ? "Zuerst sichern"
          : onlineStyle && unresolvedN > 0
            ? "Zuordnung prüfen"
            : "Zu Dokumente",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const totalCount = steps.length;
  const progressPct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;
  const nextOpen = steps.find((s) => !s.done);

  const orphans = rows.filter((r) => r.attendanceWithoutHis);
  const noShows = rows.filter((r) => r.status === "no_show");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Übersicht</h1>
        <p className="text-muted-foreground">
          {project.examNumber && `${project.examNumber} · `}
          {project.semester || "ohne Semester"} ·{" "}
          {project.lecturers.join(", ") || "ohne Dozenten"}
          {" · "}
          Szenario Bestehen {project.gradeSchema.passThreshold} Pkt.
          {stats.failCount > 0 && (
            <> · {stats.failCount} Durchfaller</>
          )}
        </p>
      </div>

      {stats.attendedOrphan > 0 && (
        <div className="rounded-xl border border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">
            {stats.attendedOrphan} Antritt/Antritte ohne HIS-Anmeldung
            {onlineStyle && orphanN > 0 && (
              <span className="font-normal">
                {" "}
                · {orphanN} mögliche Matrikel-Konflikte
                {unresolvedN > 0 && ` · ${unresolvedN} ungeprüft`}
              </span>
            )}
          </p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Diese Personen sind in der Moodle-Antrittsliste, aber nicht in den{" "}
            {HISINONE_LABEL}-Dateien
            {onlineStyle
              ? " – oft Tippfehler in der selbst eingetragenen Matrikelnummer."
              : "."}{" "}
            Bitte in der{" "}
            <Link href={`/exam/${id}/grades`} className="font-medium underline">
              Notenübersicht
            </Link>
            {onlineStyle ? (
              <>
                {" "}
                oder unter{" "}
                <Link
                  href={`/exam/${id}/matching`}
                  className="inline-flex items-center gap-1 font-medium underline"
                >
                  <GitMerge className="size-3.5" />
                  Zuordnung
                </Link>{" "}
                zusammenführen oder ablehnen (nie automatisch). Ungeprüfte
                Fälle blockieren Notenliste und {HISINONE_LABEL}-Export.
              </>
            ) : (
              <> prüfen (Filter „Antritt ohne HIS“).</>
            )}
            {(mergeN > 0 || dismissN > 0) && (
              <>
                {" "}
                · {mergeN} Zusammenführung(en)
                {dismissN > 0 && `, ${dismissN} Ablehnung(en)`} dokumentiert.
              </>
            )}
          </p>
          {orphans.length > 0 && orphans.length <= 8 && (
            <ul className="mt-2 list-inside list-disc">
              {orphans.map((r) => (
                <li key={r.key}>
                  {r.student.lastName}, {r.student.firstName} ({r.key})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {stats.hasAttendanceList && noShows.length > 0 && (
        <div className="rounded-xl border border-orange-300 bg-orange-50/80 px-4 py-3 text-sm dark:border-orange-800 dark:bg-orange-950/30">
          <p className="font-medium">
            {stats.noShow} No-Show(s) · Quote{" "}
            {formatPercent(stats.noShowRate)}
          </p>
          <p className="mt-1 text-muted-foreground">
            In HIS angemeldet, aber nicht in der Antrittsliste. Kennzahlen:
            Moodle {stats.attendanceImported} · gematcht {stats.attended} ·
            HIS {stats.registered}.
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="surface-panel lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Workflow-Status</CardTitle>
                <CardDescription>
                  Schritte bis zum {HISINONE_LABEL}-Upload
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className="tabular-nums font-medium"
              >
                {doneCount} von {totalCount} erledigt
              </Badge>
            </div>
            <div className="mt-3 space-y-1.5">
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={doneCount}
                aria-valuemin={0}
                aria-valuemax={totalCount}
                aria-label="Workflow-Fortschritt"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    doneCount === totalCount
                      ? "bg-emerald-600"
                      : "bg-primary"
                  )}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {nextOpen ? (
                <p className="text-xs text-muted-foreground">
                  Als Nächstes:{" "}
                  <span className="font-medium text-foreground">
                    {nextOpen.label}
                  </span>
                  {nextOpen.critical ? " (erforderlich)" : ""}
                </p>
              ) : (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Alle Schritte erledigt – bereit für den Export.
                </p>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps.map((step, index) => {
              const isCritical = Boolean(step.critical && !step.done);
              return (
                <div
                  key={step.id}
                  className={cn(
                    "flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 sm:flex-nowrap",
                    step.done &&
                      "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/25",
                    !step.done &&
                      !isCritical &&
                      "border-border bg-muted/25",
                    isCritical &&
                      "border-amber-400 bg-amber-50/90 dark:border-amber-700 dark:bg-amber-950/35"
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                        step.done &&
                          "bg-emerald-600 text-white dark:bg-emerald-500",
                        !step.done &&
                          !isCritical &&
                          "bg-muted text-muted-foreground ring-1 ring-border",
                        isCritical &&
                          "bg-amber-600 text-white dark:bg-amber-500"
                      )}
                      aria-hidden
                    >
                      {step.done ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={cn(
                            "font-medium",
                            step.done && "text-emerald-950 dark:text-emerald-50"
                          )}
                        >
                          {step.label}
                        </p>
                        {step.done ? (
                          <Badge className="border-transparent bg-emerald-600/15 text-emerald-800 hover:bg-emerald-600/15 dark:bg-emerald-500/20 dark:text-emerald-100">
                            Erledigt
                          </Badge>
                        ) : isCritical ? (
                          <Badge className="border-transparent bg-amber-600/20 text-amber-950 hover:bg-amber-600/20 dark:bg-amber-500/25 dark:text-amber-50">
                            <AlertCircle className="mr-1 size-3" />
                            Erforderlich
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Ausstehend
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {step.detail}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={step.href}
                    className={cn(
                      buttonVariants({
                        variant: step.done
                          ? "outline"
                          : isCritical
                            ? "default"
                            : "secondary",
                        size: "sm",
                      }),
                      "shrink-0"
                    )}
                  >
                    {step.actionLabel ?? "Öffnen"}
                  </Link>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <SummaryPanel stats={stats} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">Notenverteilung</CardTitle>
            <CardDescription>
              Ø {formatGrade(stats.averageGrade)} · Med{" "}
              {formatGrade(stats.medianGrade)} · s{" "}
              {formatStat(stats.stdDevGrade, 2)} · Bestehen{" "}
              {formatPercent(stats.passRate)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GradeDistributionChart stats={stats} />
          </CardContent>
        </Card>
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">Punkteverteilung</CardTitle>
            <CardDescription>
              Max. {project.gradeSchema.maxPoints} Punkte · Bestehensgrenze{" "}
              {project.gradeSchema.passThreshold}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PointsHistogramChart stats={stats} />
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/exam/${id}/export#sicherung`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <Download className="size-4" />
          Projekt sichern
        </Link>
        <Link
          href={`/exam/${id}/import`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <FileSpreadsheet className="size-4" />
          Importe
        </Link>
        <Link
          href={`/exam/${id}/points`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <PenLine className="size-4" />
          Punkte
        </Link>
        <Link
          href={`/exam/${id}/grades`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <Table2 className="size-4" />
          Noten
        </Link>
        <Link
          href={`/exam/${id}/documents`}
          className={cn(buttonVariants(), "gap-1.5")}
        >
          <Download className="size-4" />
          Dokumente
        </Link>
      </div>
    </div>
  );
}
