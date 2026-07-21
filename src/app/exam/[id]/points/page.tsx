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
import { sumSubAreaPoints } from "@/lib/grades/schema";

export default function PointsPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject, rows } = useExamContext();
  const [detailKey, setDetailKey] = useState<string | null>(null);

  const isKlausur = project?.examType === "written";

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

  const emptyPointsBase = (matKey: string): PointsRecord => ({
    matriculationNumber: matKey,
    bySubArea: Object.fromEntries(
      project.subAreas.map((s) => [s.id, null as number | null])
    ),
    totalPoints: null,
    source: "manual",
  });

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

  /** Gesamtpunkte manuell (Klausur) – ohne THE-Aufgabenmatrix */
  const editTotalPoints = (matKey: string, value: number | null) => {
    setProject((prev) => {
      const key = normalizeMatriculation(matKey);
      if (!key) return prev;
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === key
      );
      const base =
        idx >= 0 ? { ...prev.points[idx] } : emptyPointsBase(matKey);
      let bySubArea = { ...(base.bySubArea ?? {}) };
      // Ein Teilgebiet „Gesamt“: Wert dort spiegeln
      if (prev.subAreas.length === 1) {
        bySubArea = { [prev.subAreas[0].id]: value };
      }
      // Manuelle Gesamtpunkte: Aufgaben-Detail nicht mehr priorisieren
      const next: PointsRecord = {
        ...base,
        bySubArea,
        byQuestion:
          prev.examType === "written" ? undefined : base.byQuestion,
        totalPoints: value,
        totalOverride: undefined,
        source: "manual",
      };
      const points = [...prev.points];
      if (idx >= 0) points[idx] = next;
      else points.push(next);
      return { ...prev, points };
    });
  };

  /** Teilgebietspunkte manuell (Klausur) → Summe als Gesamtpunkte */
  const editSubAreaPoints = (
    matKey: string,
    subAreaId: string,
    value: number | null
  ) => {
    setProject((prev) => {
      const key = normalizeMatriculation(matKey);
      if (!key) return prev;
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === key
      );
      const base =
        idx >= 0 ? { ...prev.points[idx] } : emptyPointsBase(matKey);
      const bySubArea = {
        ...(base.bySubArea ??
          Object.fromEntries(prev.subAreas.map((s) => [s.id, null]))),
        [subAreaId]: value,
      };
      const totalPoints = sumSubAreaPoints(bySubArea);
      const next: PointsRecord = {
        ...base,
        bySubArea,
        byQuestion:
          prev.examType === "written" ? undefined : base.byQuestion,
        totalPoints,
        totalOverride: undefined,
        source: "manual",
      };
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
            {isKlausur
              ? "Gesamtpunkte und Teilgebietspunkte manuell bearbeiten (Dezimaltrenner: Komma oder Punkt, je nach Tastatur/System). Vorlage-Import bleibt optional."
              : "Gesamtpunkte sind berechnet und nicht editierbar. Detailpunkte (Aufgaben) in der Detailansicht oder per THE-Import."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isKlausur && project.hisRows.length > 0 && (
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
          {!isKlausur && (
            <Link
              href={`/exam/${id}/detail-points`}
              className={cn(buttonVariants(), "gap-1.5")}
            >
              <ListChecks className="size-4" />
              Matrix-Detailansicht
            </Link>
          )}
          <Link
            href={`/exam/${id}/import?focus=points`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <RefreshCw className="size-4" />
            {isKlausur ? "Punkte importieren" : "Punkte neu laden"}
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isKlausur && (
          <Badge variant="secondary">
            {project.questionDefs?.length ?? 0} Aufgaben definiert
          </Badge>
        )}
        {openCount > 0 && (
          <Badge className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
            {openCount} Person(en) mit offener Bewertung
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {rows.filter((r) => r.hasPoints).length} mit Punkten
          {isKlausur
            ? " · Punkte-Spalte anklicken/ändern (Tab/Blur speichert)"
            : " · Note anklicken öffnet Details"}
        </span>
      </div>

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="size-4" />
            {isKlausur ? "Punkteübersicht (editierbar)" : "Übersicht (nur Lesen)"}
          </CardTitle>
          <CardDescription>
            {isKlausur
              ? "Gesamtpunkte und Teilgebiete direkt in der Tabelle ändern. Optional: Vorlage exportieren, ausfüllen und unter Importe einlesen."
              : "Auf die Note klicken → Detailpunkte je Aufgabe. Alternativ THE-Excel bearbeiten und re-importieren."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentsTable
            rows={rows}
            editable={isKlausur}
            onEditGrade={
              isKlausur ? undefined : (key) => setDetailKey(key)
            }
            onEditTotalPoints={isKlausur ? editTotalPoints : undefined}
            onEditPoints={isKlausur ? editSubAreaPoints : undefined}
            subAreaNames={subAreaNames}
          />
          {!isKlausur && (
            <>
              <p className="mt-2 text-xs text-muted-foreground">
                Hinweis: Spalte „Note“ öffnet hier die Detailpunkte (Gesamt:{" "}
                berechnet, z. B.{" "}
                {formatPoints(
                  rows.find((r) => r.hasPoints)?.totalPoints
                )}
                ).
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={
                  !rows.some(
                    (r) => r.hasPoints || (r.needsGradingCount ?? 0) > 0
                  )
                }
                onClick={() => {
                  const first =
                    rows.find((r) => (r.needsGradingCount ?? 0) > 0) ??
                    rows.find((r) => r.hasPoints);
                  if (first) setDetailKey(first.key);
                }}
              >
                Erste offene / vorhandene Detailpunkte öffnen
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {detailRow && !isKlausur && (
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
