"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { StudentsTable } from "@/components/grades/students-table";
import { DetailPointsPanel } from "@/components/points/detail-points-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatPoints } from "@/lib/utils";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { PointsRecord } from "@/lib/types";
import { Download, ListChecks, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportPointsTemplate } from "@/lib/excel/export-points-template";

export default function PointsPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject, rows } = useExamContext();
  const [detailKey, setDetailKey] = useState<string | null>(null);

  const subAreaNames = useMemo(() => {
    const m: Record<string, string> = {};
    if (!project) return m;
    for (const sa of project.subAreas) {
      m[sa.id] = `Pkte ${sa.code}`;
    }
    return m;
  }, [project]);

  const openCount = useMemo(
    () =>
      project?.points.filter((p) => (p.needsGrading?.length ?? 0) > 0)
        .length ?? 0,
    [project?.points]
  );

  if (!project) return null;

  const detailRow = rows.find((r) => r.key === detailKey);
  const detailRec =
    project.points.find(
      (p) => normalizeMatriculation(p.matriculationNumber) === detailKey
    ) ?? null;

  const saveDetail = (next: PointsRecord) => {
    setProject((prev) => {
      const key = normalizeMatriculation(next.matriculationNumber);
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === key
      );
      const points = [...prev.points];
      if (idx >= 0) points[idx] = next;
      else points.push(next);
      return { ...prev, points };
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Punkteerfassung
          </h1>
          <p className="text-muted-foreground">
            Gesamtpunkte sind berechnet und nicht editierbar. Detailpunkte
            (Aufgaben) nur in der Detailansicht nach Freischaltung.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {project.examType === "written" && project.hisRows.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void exportPointsTemplate(project)}
            >
              <Download className="size-4" />
              Punkte-Vorlage
            </Button>
          )}
          <Link
            href={`/exam/${id}/detail-points`}
            className={cn(buttonVariants(), "gap-1.5")}
          >
            <ListChecks className="size-4" />
            Matrix-Detailansicht
          </Link>
          <Link
            href={`/exam/${id}/import?focus=points`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <RefreshCw className="size-4" />
            Punkte neu laden
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {project.questionDefs?.length ?? 0} Aufgaben definiert
        </Badge>
        {openCount > 0 && (
          <Badge className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            {openCount} Person(en) mit offener Bewertung
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {project.points.length} Punktedatensätze · Note anklicken öffnet
          Details
        </span>
      </div>

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="size-4" />
            Übersicht (nur Lesen)
          </CardTitle>
          <CardDescription>
            Auf die Note klicken → Detailpunkte je Aufgabe. Alternativ THE-Excel
            bearbeiten und re-importieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentsTable
            rows={rows}
            editable={false}
            onEditGrade={(key) => setDetailKey(key)}
            subAreaNames={subAreaNames}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Hinweis: Spalte „Note“ öffnet hier die Detailpunkte (Gesamt:{" "}
            berechnet, z. B. {formatPoints(rows.find((r) => r.hasPoints)?.totalPoints)}).
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={!rows.some((r) => r.hasPoints || (r.needsGradingCount ?? 0) > 0)}
            onClick={() => {
              const first =
                rows.find((r) => (r.needsGradingCount ?? 0) > 0) ??
                rows.find((r) => r.hasPoints);
              if (first) setDetailKey(first.key);
            }}
          >
            Erste offene / vorhandene Detailpunkte öffnen
          </Button>
        </CardContent>
      </Card>

      {detailRow && (
        <DetailPointsPanel
          open={!!detailKey}
          onOpenChange={(o) => !o && setDetailKey(null)}
          student={detailRow.student}
          record={detailRec}
          questionDefs={project.questionDefs ?? []}
          subAreas={project.subAreas}
          onSave={saveDetail}
        />
      )}
    </div>
  );
}
