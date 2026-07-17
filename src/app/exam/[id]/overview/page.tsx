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
import { buttonVariants } from "@/components/ui/button";
import { cn, formatGrade, formatPercent } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  FileSpreadsheet,
  PenLine,
  Table2,
  Download,
} from "lucide-react";

export default function OverviewPage() {
  const { id } = useParams<{ id: string }>();
  const { project, stats, rows } = useExamContext();
  if (!project || !stats) return null;

  const steps = [
    {
      done: project.hisRows.length > 0,
      label: "HIS-Masterliste",
      href: `/exam/${id}/import`,
      detail: `${project.hisRows.length} Anmeldungen`,
    },
    {
      done: project.attendance.length > 0,
      label: "Antrittsliste",
      href: `/exam/${id}/import`,
      detail: `${project.attendance.length} Moodle · ${stats.attended} gematcht${
        stats.attendedOrphan > 0
          ? ` · ${stats.attendedOrphan} ohne HIS`
          : ""
      }`,
    },
    {
      done: project.points.length > 0,
      label: "Punkte",
      href: `/exam/${id}/points`,
      detail: `${project.points.length} mit Punkten`,
    },
    {
      done: rows.some((r) => r.finalGrade != null),
      label: "Noten berechnet",
      href: `/exam/${id}/grades`,
      detail: `${stats.graded} Noten`,
    },
    {
      done: stats.exportReady > 0,
      label: "Exportbereit",
      href: `/exam/${id}/export`,
      detail: `${stats.exportReady} Zeilen`,
    },
  ];

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
          </p>
          <p className="mt-1 text-amber-900/90 dark:text-amber-100/90">
            Diese Personen sind in der Moodle-Antrittsliste, aber nicht in den
            HIS-Dateien. Bitte in der{" "}
            <Link href={`/exam/${id}/grades`} className="underline font-medium">
              Notenübersicht
            </Link>{" "}
            prüfen (Filter „Antritt ohne HIS“). Automatische Zuordnung erfolgt
            nicht – nur nach expliziter Prüfer-Freigabe (später).
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
          <CardHeader>
            <CardTitle>Workflow-Status</CardTitle>
            <CardDescription>
              Schritte bis zum HIS/QIS-Upload
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {steps.map((step) => (
              <div
                key={step.label}
                className="flex items-center gap-3 rounded-lg border px-3 py-2"
              >
                {step.done ? (
                  <CheckCircle2 className="size-5 text-emerald-600" />
                ) : (
                  <Circle className="size-5 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{step.label}</p>
                  <p className="text-sm text-muted-foreground">{step.detail}</p>
                </div>
                <Link
                  href={step.href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" })
                  )}
                >
                  Öffnen
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
        <SummaryPanel stats={stats} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="surface-panel">
          <CardHeader>
            <CardTitle className="text-base">Notenverteilung</CardTitle>
            <CardDescription>
              Ø Note {formatGrade(stats.averageGrade)} · Bestehen{" "}
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
          href={`/exam/${id}/export`}
          className={cn(buttonVariants(), "gap-1.5")}
        >
          <Download className="size-4" />
          Export
        </Link>
      </div>
    </div>
  );
}
