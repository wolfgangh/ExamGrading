"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { recomputeStaCriteriaRecord } from "@/lib/grades/sta-criteria";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { isStaCriteriaExam } from "@/lib/types";
import { cn, formatGrade, formatPoints } from "@/lib/utils";
import { Settings } from "lucide-react";

export default function AssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject, rows } = useExamContext();

  const criteria = project?.criteria ?? [];
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.student.lastName.localeCompare(b.student.lastName, "de")
      ),
    [rows]
  );

  if (!project) return null;

  if (!isStaCriteriaExam(project.examType)) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-6">
        <h1 className="text-xl font-semibold">Kriterienbewertung</h1>
        <p className="text-muted-foreground">
          Diese Seite gilt nur für den Prüfungstyp „Studienarbeit (StA) –
          Kriterien“.
        </p>
        <Link
          href={`/exam/${id}/overview`}
          className={buttonVariants({ variant: "outline" })}
        >
          Zur Übersicht
        </Link>
      </div>
    );
  }

  const setCriterionValue = (
    matKey: string,
    criterionId: string,
    raw: string
  ) => {
    const num =
      raw.trim() === "" ? null : Number(raw.trim().replace(",", "."));
    const value = num != null && Number.isFinite(num) ? num : null;
    setProject((prev) => {
      const criteriaList = prev.criteria ?? [];
      const max = prev.gradeSchema.maxPoints;
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === matKey
      );
      const base =
        idx >= 0
          ? prev.points[idx]
          : {
              matriculationNumber: matKey,
              bySubArea: Object.fromEntries(
                prev.subAreas.map((s) => [s.id, null])
              ),
              totalPoints: null as number | null,
              source: "manual" as const,
              criterionValues: {},
            };
      const criterionValues = {
        ...(base.criterionValues ?? {}),
        [criterionId]: value,
      };
      const next = recomputeStaCriteriaRecord(
        { ...base, criterionValues },
        criteriaList,
        max
      );
      const points = [...prev.points];
      if (idx >= 0) points[idx] = next;
      else points.push(next);
      return { ...prev, points };
    });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Kriterienbewertung
          </h1>
          <p className="text-muted-foreground">
            Werte je Kriterium eintragen. Gesamtwert und Note werden gewichtet
            berechnet (Notenschlüssel unter Szenarien).
          </p>
        </div>
        <Link
          href={`/exam/${id}/settings`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <Settings className="size-4" />
          Kriterien bearbeiten
        </Link>
      </div>

      {criteria.length === 0 ? (
        <Card className="surface-panel border-amber-400">
          <CardHeader>
            <CardTitle className="text-base">Keine Kriterien</CardTitle>
            <CardDescription>
              Legen Sie unter Einstellungen mindestens ein Kriterium mit
              Gewicht und Skala an.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/exam/${id}/settings`} className={buttonVariants()}>
              Zu Einstellungen
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card className="surface-panel overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bewertungsmatrix</CardTitle>
            <CardDescription>
              {criteria.length} Kriterien · Gewichte relativ · Max. Gesamtwert{" "}
              {project.gradeSchema.maxPoints}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[min(70vh,720px)] overflow-auto">
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    <TableHead className="sticky left-0 z-20 min-w-[140px] bg-card">
                      Name
                    </TableHead>
                    <TableHead className="min-w-[88px]">Matr.</TableHead>
                    {criteria.map((c) => (
                      <TableHead
                        key={c.id}
                        className="min-w-[100px] text-center"
                        title={`${c.name} · Gewicht ${c.weight} · ${c.scale}`}
                      >
                        <div className="font-semibold">{c.code || c.name}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">
                          {c.scale === "percent"
                            ? "%"
                            : c.scale === "grade"
                              ? "Note"
                              : `P/${c.maxPoints ?? "–"}`}{" "}
                          · w{c.weight}
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="min-w-[72px] text-center bg-muted/40">
                      Gesamt
                    </TableHead>
                    <TableHead className="min-w-[64px] text-center bg-muted/50">
                      Note
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4 + criteria.length}
                        className="h-20 text-center text-muted-foreground"
                      >
                        Noch keine Personen – bitte HISinOne importieren oder
                        manuell hinzufügen.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedRows.map((r) => {
                      const rec = project.points.find(
                        (p) =>
                          normalizeMatriculation(p.matriculationNumber) ===
                          r.key
                      );
                      return (
                        <TableRow key={r.key}>
                          <TableCell className="sticky left-0 z-10 bg-card font-medium whitespace-nowrap">
                            {r.student.lastName}, {r.student.firstName}
                            {!r.inHis && (
                              <Badge
                                variant="outline"
                                className="ml-1 text-[10px]"
                              >
                                manuell
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {r.key}
                          </TableCell>
                          {criteria.map((c) => {
                            const v = rec?.criterionValues?.[c.id];
                            return (
                              <TableCell key={c.id} className="p-1 text-center">
                                <Input
                                  className="mx-auto h-8 w-[4.5rem] text-center text-sm"
                                  defaultValue={
                                    v != null
                                      ? String(v).replace(".", ",")
                                      : ""
                                  }
                                  key={`${r.key}-${c.id}-${project.updatedAt}`}
                                  placeholder="–"
                                  onBlur={(e) =>
                                    setCriterionValue(
                                      r.key,
                                      c.id,
                                      e.target.value
                                    )
                                  }
                                />
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center tabular-nums text-sm bg-muted/20">
                            {formatPoints(r.totalPoints)}
                          </TableCell>
                          <TableCell className="text-center tabular-nums font-semibold bg-muted/30">
                            {formatGrade(r.finalGrade)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
