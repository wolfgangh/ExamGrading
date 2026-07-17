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
import { Button } from "@/components/ui/button";
import { formatGrade, formatPercent } from "@/lib/utils";
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
      detail: `${project.attendance.length} Antritte`,
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Übersicht</h1>
        <p className="text-muted-foreground">
          {project.examNumber && `${project.examNumber} · `}
          {project.semester || "ohne Semester"} ·{" "}
          {project.lecturers.join(", ") || "ohne Dozenten"}
        </p>
      </div>

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
                <Button variant="outline" size="sm" render={<Link href={step.href} />}>
                  Öffnen
                </Button>
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
        <Button variant="outline" render={<Link href={`/exam/${id}/import`} />}>
          <FileSpreadsheet className="size-4" />
          Importe
        </Button>
        <Button variant="outline" render={<Link href={`/exam/${id}/points`} />}>
          <PenLine className="size-4" />
          Punkte
        </Button>
        <Button variant="outline" render={<Link href={`/exam/${id}/grades`} />}>
          <Table2 className="size-4" />
          Noten
        </Button>
        <Button render={<Link href={`/exam/${id}/export`} />}>
          <Download className="size-4" />
          Export
        </Button>
      </div>
    </div>
  );
}
