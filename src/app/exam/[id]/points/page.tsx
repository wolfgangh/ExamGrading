"use client";

import { useMemo } from "react";
import { useExamContext } from "@/components/exam/exam-context";
import { StudentsTable } from "@/components/grades/students-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { sumSubAreaPoints } from "@/lib/grades/schema";
import type { PointsRecord } from "@/lib/types";

export default function PointsPage() {
  const { project, setProject, rows } = useExamContext();

  const subAreaNames = useMemo(() => {
    const m: Record<string, string> = {};
    if (!project) return m;
    for (const sa of project.subAreas) {
      m[sa.id] = `Pkte ${sa.code}`;
    }
    return m;
  }, [project]);

  if (!project) return null;

  const upsertPoints = (
    key: string,
    mutator: (prev: PointsRecord | null) => PointsRecord
  ) => {
    setProject((prev) => {
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === key
      );
      const current = idx >= 0 ? prev.points[idx] : null;
      const nextRec = mutator(current);
      const points = [...prev.points];
      if (idx >= 0) points[idx] = nextRec;
      else points.push(nextRec);

      const student = prev.students[key] ?? {
        matriculationNumber: key,
        lastName: "",
        firstName: "",
      };

      return {
        ...prev,
        points,
        students: {
          ...prev.students,
          [key]: student,
        },
      };
    });
  };

  const onEditPoints = (
    key: string,
    subAreaId: string,
    value: number | null
  ) => {
    upsertPoints(key, (prev) => {
      const bySubArea = {
        ...(prev?.bySubArea ??
          Object.fromEntries(
            (project?.subAreas ?? []).map((sa) => [sa.id, null])
          )),
        [subAreaId]: value,
      };
      const totalPoints = sumSubAreaPoints(bySubArea);
      return {
        matriculationNumber: prev?.matriculationNumber ?? key,
        bySubArea,
        totalPoints,
        totalOverride: prev?.totalOverride,
        gradeOverride: prev?.gradeOverride,
        comment: prev?.comment,
        source: prev?.source === "moodle" ? "mixed" : prev?.source ?? "manual",
      };
    });
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Punkteerfassung
        </h1>
        <p className="text-muted-foreground">
          Teilgebiet-Punkte bearbeiten. Gesamtpunkte werden summiert; Note
          berechnet sich live über das Notenschema.
        </p>
      </div>

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {project.subAreas.map((s) => `${s.name} (max. ${s.maxPoints})`).join(" · ")}
          </CardTitle>
          <CardDescription>
            Max. gesamt {project.gradeSchema.maxPoints} Punkte · Zellen nach
            Eingabe mit Tab/Klick verlassen zum Speichern
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StudentsTable
            rows={rows}
            editable
            onEditPoints={onEditPoints}
            subAreaNames={subAreaNames}
          />
        </CardContent>
      </Card>
    </div>
  );
}
