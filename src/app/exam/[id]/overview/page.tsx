"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { GradeDistributionChart } from "@/components/charts/grade-distribution-chart";
import { PointsHistogramChart } from "@/components/charts/points-histogram-chart";
import { ExpandableChart } from "@/components/charts/expandable-chart";
import { MoreOptions, PageHeader, StatusNotice } from "@/components/layout/page-kit";
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
import { listUnresolvedOrphans } from "@/lib/matching/orphan-resolution";
import {
  EXAM_TYPE_LABELS,
  isOnlineStyleExam,
  isStaCriteriaExam,
  isStaManualExam,
} from "@/lib/types";
import { examUsesGradeScenarios } from "@/lib/grades/scenarios";
import { mergeDefaultStaCriteria } from "@/lib/grades/sta-criteria";
import { createId } from "@/lib/id";
import {
  buildWorkflowSteps,
  isWorkflowManuallyCompleted,
  workflowProgress,
} from "@/lib/workflow-steps";
import {
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { project, stats, rows, setProject } = useExamContext();
  if (!project || !stats) return null;

  const onlineStyle = isOnlineStyleExam(project.examType);
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

  const usesScenarios = examUsesGradeScenarios(project);
  const showPointsChart =
    !isStaManualExam(project.examType) &&
    stats.averagePoints != null &&
    (stats.pointsHistogram ?? []).some((b) => b.count > 0);

  const seedDefaultCriteria = () => {
    setProject((prev) => ({
      ...prev,
      criteria: mergeDefaultStaCriteria(prev.criteria, createId),
    }));
  };

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
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Übersicht"
        description={
          <>
            <span className="font-medium text-foreground">
              {project.name || "Prüfung"}
            </span>
            {" · "}
            {EXAM_TYPE_LABELS[project.examType]}
            {project.semester?.trim() ? ` · ${project.semester.trim()}` : ""}
            {examNumberChips.length > 0 ? ` · ${examNumberChips.join(", ")}` : ""}
            {lecturers.length > 0 ? ` · ${lecturers.join(", ")}` : ""}
            {usesScenarios
              ? ` · ${scenarioLabel}, Bestehen ab ${project.gradeSchema.passThreshold} Pkt.`
              : ""}
            {" · "}
            <Link
              href={`/exam/${id}/settings`}
              className="text-primary underline-offset-2 hover:underline"
            >
              bearbeiten
            </Link>
          </>
        }
      />

      {/* 1. Nächster Schritt */}
      <Card
        className={cn(
          "surface-panel border-2",
          displayComplete ? "border-emerald-500/60" : "border-primary/50"
        )}
      >
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nächster Schritt
            </p>
            {nextOpen && !(manualComplete && !autoComplete) ? (
              <>
                <p className="mt-0.5 text-lg font-semibold">
                  {nextOpen.label}
                  {nextOpen.critical && (
                    <Badge className="ml-2 border-transparent bg-amber-600/20 align-middle text-amber-950 dark:text-amber-50">
                      erforderlich
                    </Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{nextOpen.detail}</p>
              </>
            ) : (
              <p className="mt-0.5 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                {manualComplete && !autoComplete
                  ? "Als abgeschlossen markiert"
                  : "Alle Schritte erledigt – bereit für den Export"}
              </p>
            )}
          </div>
          <Link
            href={nextOpen && !(manualComplete && !autoComplete) ? nextOpen.href : `/exam/${id}/documents`}
            className={cn(buttonVariants({ size: "lg" }), "shrink-0")}
          >
            {nextOpen && !(manualComplete && !autoComplete)
              ? (nextOpen.actionLabel ?? "Öffnen")
              : "Zu den Dokumenten"}
          </Link>
        </CardContent>
      </Card>

      {/* Hinweise nur bei Bedarf */}
      {stats.attendedOrphan > 0 && (
        <StatusNotice
          tone="warning"
          href={onlineStyle ? `/exam/${id}/matching` : undefined}
          linkLabel="Zur Zuordnung"
        >
          <span className="font-medium">
            {stats.attendedOrphan} Antritt ohne Teilnehmerliste
            {onlineStyle && unresolvedN > 0 && ` · ${unresolvedN} ungeprüft`}
          </span>
          <span className="block text-xs">
            Oft Tippfehler in der Moodle-Matrikel; ungeprüfte Fälle sperren den Export.
            {(mergeN > 0 || dismissN > 0) &&
              ` · ${mergeN} zusammengeführt${dismissN > 0 ? `, ${dismissN} abgelehnt` : ""}`}
          </span>
          {orphans.length > 0 && orphans.length <= 6 && (
            <span className="block text-xs">
              {orphans
                .map((r) => `${r.student.lastName}, ${r.student.firstName} (${r.key})`)
                .join(" · ")}
            </span>
          )}
        </StatusNotice>
      )}
      {isStaCriteriaExam(project.examType) &&
        (project.criteria?.length ?? 0) === 0 && (
          <StatusNotice tone="info">
            <span className="font-medium">Noch keine Bewertungskriterien.</span>{" "}
            Standardkatalog (ABZ, FACH, METH, QUEL, SPEZ, REPR, Punkte 0–6) einfügen?{" "}
            <Button type="button" size="xs" className="ml-1" onClick={seedDefaultCriteria}>
              Standardkatalog einfügen
            </Button>
          </StatusNotice>
        )}

      {/* 2. Fortschritt */}
      <Card className="surface-panel">
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Fortschritt · {doneCount} von {totalCount} erledigt
            </p>
            <div
              className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={autoComplete ? totalCount : doneCount}
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-label="Workflow-Fortschritt"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  autoComplete ? "bg-emerald-600" : "bg-primary"
                )}
                style={{ width: `${autoComplete ? 100 : progressPct}%` }}
              />
            </div>
          </div>
          <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {steps.map((step, index) => {
              const isCritical = Boolean(step.critical && !step.done);
              return (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    title={step.detail}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                      step.done && "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/25",
                      isCritical && "border-amber-400 bg-amber-50/90 dark:border-amber-700 dark:bg-amber-950/35"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold",
                        step.done ? "bg-emerald-600 text-white" : isCritical ? "bg-amber-600 text-white" : "bg-muted text-muted-foreground"
                      )}
                      aria-hidden
                    >
                      {step.done ? <CheckCircle2 className="size-3.5" /> : index + 1}
                    </span>
                    <span className="min-w-0 truncate">{step.label}</span>
                    {isCritical && <AlertCircle className="ml-auto size-3.5 shrink-0 text-amber-600" aria-label="erforderlich" />}
                  </Link>
                </li>
              );
            })}
          </ol>
          <MoreOptions label="Workflow manuell abschließen">
            {manualComplete && !autoComplete ? (
              <div className="space-y-2 text-sm">
                <p>
                  Manuell als abgeschlossen markiert
                  {project.workflowManuallyCompletedAt
                    ? ` · ${new Date(project.workflowManuallyCompletedAt).toLocaleString("de-DE")}`
                    : ""}
                  . Offene Schritte bleiben sichtbar; Export-Regeln sind unverändert.
                </p>
                <Button type="button" size="sm" variant="outline" onClick={clearWorkflowComplete}>
                  Manuelle Markierung aufheben
                </Button>
              </div>
            ) : autoComplete ? (
              <p className="text-sm text-muted-foreground">Alle Schritte sind erledigt.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-muted-foreground">
                  Prüfung auf der Startseite als abgeschlossen anzeigen, auch wenn noch Schritte offen sind.
                </p>
                <Button type="button" size="sm" variant="secondary" onClick={markWorkflowComplete}>
                  <CheckCircle2 className="size-3.5" />
                  Als abgeschlossen markieren
                </Button>
              </div>
            )}
          </MoreOptions>
        </CardContent>
      </Card>

      {/* 3. Kennzahlen stehen in der Leiste oben (keine Doppelung) */}
      {noShows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {stats.noShow} No-Show(s)
          {stats.noShowRate != null ? ` · Quote ${formatPercent(stats.noShowRate)}` : ""}
          {stats.hasAttendanceList
            ? ` · Moodle ${stats.attendanceImported} · gematcht ${stats.attended} · Teilnehmerliste ${stats.registered}`
            : " · manuell als nicht angetreten markiert"}
        </p>
      )}

      {/* 4. Verteilungen */}
      <div className={cn("grid items-stretch gap-4", showPointsChart && "lg:grid-cols-2")}>
        <Card className="surface-panel min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Notenverteilung</CardTitle>
            <CardDescription>
              Ø {formatGrade(stats.averageGrade)} · Median {formatGrade(stats.medianGrade)} · Q25{" "}
              {formatGrade(stats.q25Grade)} · Q75 {formatGrade(stats.q75Grade)} · Bestehen{" "}
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
        {showPointsChart && (
          <Card className="surface-panel min-w-0">
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
                <PointsHistogramChart stats={stats} className="h-56 w-full" />
              </ExpandableChart>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
