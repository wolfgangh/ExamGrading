"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { GradeDistributionChart } from "@/components/charts/grade-distribution-chart";
import { PointsHistogramChart } from "@/components/charts/points-histogram-chart";
import { ExpandableChart } from "@/components/charts/expandable-chart";
import { SummaryPanel } from "@/components/layout/summary-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, formatGrade, formatPercent } from "@/lib/utils";
import { orphanCount } from "@/lib/matching/merge-candidates";
import { listUnresolvedOrphans } from "@/lib/matching/orphan-resolution";
import { HISINONE_LABEL, isOnlineStyleExam } from "@/lib/types";
import {
  buildWorkflowSteps,
  isWorkflowManuallyCompleted,
  workflowProgress,
} from "@/lib/workflow-steps";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  GitMerge,
  PenLine,
  Table2,
  Download,
} from "lucide-react";

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { project, stats, rows, setProject } = useExamContext();
  if (!project || !stats) return null;

  const onlineStyle = isOnlineStyleExam(project.examType);
  const orphanN = onlineStyle ? orphanCount(project) : 0;
  const unresolvedN = onlineStyle
    ? listUnresolvedOrphans(project, rows).length
    : 0;
  const mergeN = (project.identityMerges ?? []).filter((m) => m.active).length;
  const dismissN = (project.identityDismissals ?? []).filter(
    (d) => d.active
  ).length;

  const steps = buildWorkflowSteps(project, rows, stats, id);
  const { doneCount, totalCount, progressPct, nextOpen } =
    workflowProgress(steps);
  const autoComplete = totalCount > 0 && doneCount === totalCount;
  const manualComplete = isWorkflowManuallyCompleted(project);
  const displayComplete = autoComplete || manualComplete;

  const markWorkflowComplete = () => {
    setProject((prev) => ({
      ...prev,
      workflowManuallyCompletedAt: new Date().toISOString(),
    }));
  };

  const clearWorkflowComplete = () => {
    setProject((prev) => {
      const next = { ...prev };
      delete next.workflowManuallyCompletedAt;
      return next;
    });
  };

  const orphans = rows.filter((r) => r.attendanceWithoutHis);
  const noShows = rows.filter((r) => r.status === "no_show");

  const quickLinks = (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/exam/${id}/export#sicherung`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5"
        )}
      >
        <Download className="size-3.5" />
        Sichern
      </Link>
      <Link
        href={`/exam/${id}/import`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5"
        )}
      >
        <FileSpreadsheet className="size-3.5" />
        Importe
      </Link>
      <Link
        href={`/exam/${id}/points`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5"
        )}
      >
        <PenLine className="size-3.5" />
        Punkte
      </Link>
      <Link
        href={`/exam/${id}/grades`}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "gap-1.5"
        )}
      >
        <Table2 className="size-3.5" />
        Noten
      </Link>
      <Link
        href={`/exam/${id}/documents`}
        className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
      >
        <Download className="size-3.5" />
        Dokumente
      </Link>
    </div>
  );

  const examNumberChips = (project.examNumber || "")
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lecturers = (project.lecturers ?? []).map((l) => l.trim()).filter(Boolean);
  const activeScenario = (project.gradeScenarios ?? []).find(
    (s) => s.id === project.activeScenarioId
  );
  const scenarioLabel =
    activeScenario?.name?.replace(/\s*\(Standard\)\s*/i, "").trim() ||
    "Aktives Szenario";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Übersicht</h1>
        <p className="text-muted-foreground">
          Status und Kennzahlen zur Prüfung
        </p>
      </div>

      {/* Prüfungsinfos | Notenverteilung */}
      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prüfungsdaten</CardTitle>
            <CardDescription>
              Stammdaten und aktives Notenszenario
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Prüfung
              </p>
              <p className="text-base font-semibold leading-snug">
                {project.name || "–"}
              </p>
            </div>

            <dl className="space-y-2.5">
              <div className="grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:items-start sm:gap-3">
                <dt className="text-muted-foreground">Prüfungsnr.</dt>
                <dd className="min-w-0">
                  {examNumberChips.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {examNumberChips.map((num) => (
                        <Badge
                          key={num}
                          variant="secondary"
                          className="max-w-full whitespace-normal font-normal tabular-nums"
                        >
                          {num}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:items-start sm:gap-3">
                <dt className="text-muted-foreground">Semester</dt>
                <dd className="font-medium">
                  {project.semester?.trim() || "–"}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:items-start sm:gap-3">
                <dt className="text-muted-foreground">Dozent(en)</dt>
                <dd className="min-w-0">
                  {lecturers.length > 0 ? (
                    <ul className="space-y-0.5">
                      {lecturers.map((name) => (
                        <li key={name} className="leading-snug">
                          {name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </dd>
              </div>
              <div className="grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:items-start sm:gap-3">
                <dt className="text-muted-foreground">Szenario</dt>
                <dd>
                  <span className="font-medium">{scenarioLabel}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · Bestehen ab {project.gradeSchema.passThreshold} Pkt.
                  </span>
                </dd>
              </div>
              {stats.failCount > 0 && (
                <div className="grid gap-1 sm:grid-cols-[7.5rem_1fr] sm:items-start sm:gap-3">
                  <dt className="text-muted-foreground">Durchfaller</dt>
                  <dd className="font-semibold tabular-nums text-rose-700 dark:text-rose-300">
                    {stats.failCount}
                  </dd>
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card className="surface-panel min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notenverteilung</CardTitle>
            <CardDescription>
              Ø {formatGrade(stats.averageGrade)} · Med{" "}
              {formatGrade(stats.medianGrade)} · Q25{" "}
              {formatGrade(stats.q25Grade)} · Q75{" "}
              {formatGrade(stats.q75Grade)} · Bestehen{" "}
              {formatPercent(stats.passRate)}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <ExpandableChart
              title="Notenverteilung"
              description={`Ø ${formatGrade(stats.averageGrade)} · Med ${formatGrade(stats.medianGrade)} · Q25 ${formatGrade(stats.q25Grade)} · Q75 ${formatGrade(stats.q75Grade)} · Bestehen ${formatPercent(stats.passRate)}`}
              filenameBase={`ExamGrade_${project.name || "Pruefung"}_Notenverteilung`}
            >
              <GradeDistributionChart stats={stats} className="h-56 w-full" />
            </ExpandableChart>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        {/* Linke Spalte: Hinweise (kompakt) + Workflow – rechte Spalte startet oben */}
        <div className="flex flex-col gap-4 lg:col-span-7">
          {stats.attendedOrphan > 0 && (
            <div className="rounded-xl border border-amber-400 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">
                    {stats.attendedOrphan} Antritt ohne {HISINONE_LABEL}
                    {onlineStyle && orphanN > 0 && (
                      <span className="font-normal">
                        {" "}
                        · {orphanN} Matrikel-Konflikt
                        {orphanN === 1 ? "" : "e"}
                        {unresolvedN > 0 && ` · ${unresolvedN} ungeprüft`}
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100/90">
                    Oft Tippfehler in der Moodle-Matrikel. Ungeprüfte Fälle
                    blockieren Export.
                    {(mergeN > 0 || dismissN > 0) && (
                      <>
                        {" "}
                        · {mergeN} Merge(s)
                        {dismissN > 0 && `, ${dismissN} Ablehnung(en)`}
                      </>
                    )}
                  </p>
                  {orphans.length > 0 && orphans.length <= 6 && (
                    <ul className="mt-1.5 list-inside list-disc text-xs">
                      {orphans.map((r) => (
                        <li key={r.key}>
                          {r.student.lastName}, {r.student.firstName} ({r.key})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {onlineStyle && (
                  <Link
                    href={`/exam/${id}/matching`}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "shrink-0 gap-1.5"
                    )}
                  >
                    <GitMerge className="size-3.5" />
                    Zur Zuordnung
                  </Link>
                )}
              </div>
            </div>
          )}

          {stats.hasAttendanceList && noShows.length > 0 && (
            <div className="rounded-xl border border-orange-300 bg-orange-50/80 px-3 py-2.5 text-sm dark:border-orange-800 dark:bg-orange-950/30">
              <p className="font-medium leading-snug">
                {stats.noShow} No-Show(s) · Quote{" "}
                {formatPercent(stats.noShowRate)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                In {HISINONE_LABEL} angemeldet, nicht in der Antrittsliste ·
                Moodle {stats.attendanceImported} · gematcht {stats.attended} ·
                HIS {stats.registered}
              </p>
            </div>
          )}

          <Card className="surface-panel">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle>Workflow-Status</CardTitle>
                <CardDescription>
                  Schritte bis zum {HISINONE_LABEL}-Upload (inkl.
                  JSON-Sicherungen)
                </CardDescription>
              </div>
              <Badge
                variant="secondary"
                className="tabular-nums font-medium"
              >
                {doneCount} von {totalCount} erledigt
                {manualComplete && !autoComplete ? " · manuell" : ""}
              </Badge>
            </div>
            <div className="mt-3 space-y-1.5">
              <div
                className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuenow={displayComplete ? totalCount : doneCount}
                aria-valuemin={0}
                aria-valuemax={totalCount}
                aria-label="Workflow-Fortschritt"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    displayComplete ? "bg-emerald-600" : "bg-primary"
                  )}
                  style={{
                    width: `${displayComplete ? 100 : progressPct}%`,
                  }}
                />
              </div>
              {manualComplete && !autoComplete ? (
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  Manuell als abgeschlossen markiert
                  {project.workflowManuallyCompletedAt
                    ? ` · ${new Date(
                        project.workflowManuallyCompletedAt
                      ).toLocaleString("de-DE")}`
                    : ""}
                  . Offene Schritte bleiben sichtbar; Export-Regeln sind
                  unverändert.
                </p>
              ) : nextOpen ? (
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
              <div className="flex flex-wrap gap-2 pt-1">
                {!displayComplete || (manualComplete && !autoComplete) ? (
                  manualComplete && !autoComplete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={clearWorkflowComplete}
                    >
                      Manuelle Markierung aufheben
                    </Button>
                  ) : !autoComplete ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={markWorkflowComplete}
                      title="Prüfung auf der Startseite als abgeschlossen anzeigen, auch wenn noch Schritte offen sind"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Als abgeschlossen markieren
                    </Button>
                  ) : null
                ) : null}
              </div>
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
                          <Badge
                            variant="outline"
                            className="text-muted-foreground"
                          >
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
        </div>

        <div className="flex flex-col gap-4 lg:col-span-5 lg:sticky lg:top-4 lg:self-start">
          <SummaryPanel stats={stats} />

          <Card className="surface-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Schnellaktionen</CardTitle>
            </CardHeader>
            <CardContent>{quickLinks}</CardContent>
          </Card>

          <Card className="surface-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Punkteverteilung</CardTitle>
              <CardDescription>
                Max. {project.gradeSchema.maxPoints} Punkte · Bestehensgrenze{" "}
                {project.gradeSchema.passThreshold}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ExpandableChart
                title="Punkteverteilung"
                description={`Max. ${project.gradeSchema.maxPoints} · Bestehen ab ${project.gradeSchema.passThreshold}`}
                filenameBase={`ExamGrade_${project.name || "Pruefung"}_Punkteverteilung`}
              >
                <PointsHistogramChart stats={stats} className="h-52 w-full" />
              </ExpandableChart>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
