"use client";

import { useMemo, useState } from "react";
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
import { computePortfolioRawAverage } from "@/lib/grades/portfolio";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { isPortfolioExam, isStaCriteriaExam } from "@/lib/types";
import { cn, formatGrade, formatPoints } from "@/lib/utils";
import { Settings } from "lucide-react";
import { GroupFilterBar } from "@/components/exam/group-filter-bar";
import { StudentGroupSelect } from "@/components/exam/student-group-select";
import {
  filterRowsByGroup,
  setStudentGroupId,
  type GroupFilterId,
} from "@/lib/student-groups";

export default function AssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject, rows } = useExamContext();
  const [groupFilter, setGroupFilter] = useState<GroupFilterId>("all");

  const criteria = project?.criteria ?? [];
  const components = project?.portfolioComponents ?? [];
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.student.lastName.localeCompare(b.student.lastName, "de")
      ),
    [rows]
  );
  const filteredRows = useMemo(
    () => filterRowsByGroup(sortedRows, groupFilter),
    [sortedRows, groupFilter]
  );

  const isCriteria = project ? isStaCriteriaExam(project.examType) : false;
  const isPortfolio = project ? isPortfolioExam(project.examType) : false;

  if (!project) return null;

  if (!isCriteria && !isPortfolio) {
    return (
      <div className="mx-auto max-w-lg space-y-3 p-6">
        <h1 className="text-xl font-semibold">Bewertung</h1>
        <p className="text-muted-foreground">
          Diese Seite gilt für „Studienarbeit (StA) – Kriterien“ und
          „Portfolioprüfung“.
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

  const setPortfolioGrade = (
    matKey: string,
    componentId: string,
    raw: string
  ) => {
    const num =
      raw.trim() === "" ? null : Number(raw.trim().replace(",", "."));
    let value: number | null =
      num != null && Number.isFinite(num) ? num : null;
    if (value != null) value = Math.min(5, Math.max(1, value));
    setProject((prev) => {
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
              portfolioGrades: {},
            };
      const portfolioGrades = {
        ...(base.portfolioGrades ?? {}),
        [componentId]: value,
      };
      const next = { ...base, portfolioGrades, source: "manual" as const };
      const points = [...prev.points];
      if (idx >= 0) points[idx] = next;
      else points.push(next);
      return { ...prev, points };
    });
  };

  const cols = isPortfolio ? components : criteria;
  const emptyMsg = isPortfolio
    ? "Noch keine Teilleistungen – unter Einstellungen festlegen (Standard: 2)."
    : "Noch keine Kriterien – unter Einstellungen anlegen.";

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isPortfolio ? "Teilnoten (Portfolio)" : "Kriterienbewertung"}
          </h1>
          <p className="text-muted-foreground">
            {isPortfolio
              ? "Teilnoten je Teilleistung eintragen. Gesamtnote = gewichteter Mittelwert, gerundet auf die nächste deutsche Note (1,0 … 5,0)."
              : "Werte je Kriterium eintragen. Gesamtwert und Note werden gewichtet berechnet (Notenschlüssel unter Szenarien)."}
          </p>
        </div>
        <Link
          href={`/exam/${id}/settings`}
          className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
        >
          <Settings className="size-4" />
          {isPortfolio ? "Teilleistungen / Gruppen" : "Kriterien / Gruppen"}
        </Link>
      </div>

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Gruppe wählen</CardTitle>
          <CardDescription>
            Nur Studierende der gewählten Gruppe in der Matrix – schnell
            wechseln mit den Schaltflächen.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GroupFilterBar
            project={project}
            rows={sortedRows}
            value={groupFilter}
            onChange={setGroupFilter}
          />
        </CardContent>
      </Card>

      {cols.length === 0 ? (
        <Card className="surface-panel border-amber-400">
          <CardHeader>
            <CardTitle className="text-base">
              {isPortfolio ? "Keine Teilleistungen" : "Keine Kriterien"}
            </CardTitle>
            <CardDescription>{emptyMsg}</CardDescription>
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
              {isPortfolio
                ? `${components.length} Teilleistungen · Gewichte relativ`
                : `${criteria.length} Kriterien · Gewichte relativ · Max. Gesamtwert ${project.gradeSchema.maxPoints}`}
              {" · "}
              {filteredRows.length} von {sortedRows.length} Person(en)
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
                    <TableHead className="min-w-[7.5rem]">Gruppe</TableHead>
                    {isPortfolio
                      ? components.map((c) => (
                          <TableHead
                            key={c.id}
                            className="min-w-[100px] text-center"
                            title={`${c.name} · Gewicht ${c.weight}`}
                          >
                            <div className="font-semibold">
                              {c.code || c.name}
                            </div>
                            <div className="text-[10px] font-normal text-muted-foreground">
                              Note · w{c.weight}
                            </div>
                          </TableHead>
                        ))
                      : criteria.map((c) => (
                          <TableHead
                            key={c.id}
                            className="min-w-[100px] text-center"
                            title={`${c.name} · Gewicht ${c.weight} · ${c.scale}`}
                          >
                            <div className="font-semibold">
                              {c.code || c.name}
                            </div>
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
                    {isCriteria && (
                      <TableHead className="min-w-[72px] text-center bg-muted/40">
                        Gesamt
                      </TableHead>
                    )}
                    {isPortfolio && (
                      <TableHead className="min-w-[72px] text-center bg-muted/40">
                        Mittel
                      </TableHead>
                    )}
                    <TableHead className="min-w-[64px] text-center bg-muted/50">
                      Note
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5 + cols.length}
                        className="h-20 text-center text-muted-foreground"
                      >
                        {sortedRows.length === 0
                          ? "Noch keine Personen – bitte HISinOne importieren oder manuell hinzufügen."
                          : "Keine Personen in dieser Gruppe."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => {
                      const rec = project.points.find(
                        (p) =>
                          normalizeMatriculation(p.matriculationNumber) ===
                          r.key
                      );
                      const rawAvg = isPortfolio
                        ? computePortfolioRawAverage(
                            rec?.portfolioGrades,
                            components
                          )
                        : null;
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
                          <TableCell className="p-1">
                            <StudentGroupSelect
                              project={project}
                              groupId={r.student.groupId}
                              compact
                              onChange={(gid) =>
                                setProject((prev) =>
                                  setStudentGroupId(prev, r.key, gid)
                                )
                              }
                            />
                          </TableCell>
                          {isPortfolio
                            ? components.map((c) => {
                                const v = rec?.portfolioGrades?.[c.id];
                                return (
                                  <TableCell
                                    key={c.id}
                                    className="p-1 text-center"
                                  >
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
                                        setPortfolioGrade(
                                          r.key,
                                          c.id,
                                          e.target.value
                                        )
                                      }
                                    />
                                  </TableCell>
                                );
                              })
                            : criteria.map((c) => {
                                const v = rec?.criterionValues?.[c.id];
                                return (
                                  <TableCell
                                    key={c.id}
                                    className="p-1 text-center"
                                  >
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
                          {isCriteria && (
                            <TableCell className="text-center tabular-nums text-sm bg-muted/20">
                              {formatPoints(r.totalPoints)}
                            </TableCell>
                          )}
                          {isPortfolio && (
                            <TableCell className="text-center tabular-nums text-sm bg-muted/20">
                              {rawAvg != null
                                ? formatGrade(rawAvg)
                                : "–"}
                            </TableCell>
                          )}
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
