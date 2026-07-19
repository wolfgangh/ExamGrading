"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ClearableInput } from "@/components/ui/clearable-input";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  isPortfolioExam,
  isStaCriteriaExam,
  type EnrichedStudentRow,
} from "@/lib/types";
import { cn, formatGrade, formatPoints } from "@/lib/utils";
import { Search, Settings, Users } from "lucide-react";
import { GroupFilterBar } from "@/components/exam/group-filter-bar";
import { StudentGroupSelect } from "@/components/exam/student-group-select";
import {
  countInGroup,
  filterRowsByGroup,
  setStudentGroupId,
  setStudentGroupIds,
  sortedStudentGroups,
  type GroupFilterId,
} from "@/lib/student-groups";

/** Ein Begriff oder mehrere (Komma/Semikolon/Zeilenumbruch = ODER) */
function matchesNameSearch(row: EnrichedStudentRow, query: string): boolean {
  const terms = query
    .split(/[,;\n]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (terms.length === 0) return true;
  const last = (row.student.lastName ?? "").toLowerCase();
  const first = (row.student.firstName ?? "").toLowerCase();
  const full = `${last}, ${first}`;
  const fullSpace = `${last} ${first}`;
  const mat = (row.key ?? "").toLowerCase();
  const hay = `${last} ${first} ${full} ${fullSpace} ${mat}`;
  return terms.some(
    (q) =>
      last.includes(q) ||
      first.includes(q) ||
      full.includes(q) ||
      fullSpace.includes(q) ||
      mat.includes(q) ||
      hay.includes(q)
  );
}

export default function AssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject, rows } = useExamContext();
  const [groupFilter, setGroupFilter] = useState<GroupFilterId>("all");
  const [nameQuery, setNameQuery] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const criteria = project?.criteria ?? [];
  const components = project?.portfolioComponents ?? [];
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        a.student.lastName.localeCompare(b.student.lastName, "de")
      ),
    [rows]
  );
  const searchActive = nameQuery.trim().length > 0;
  const filteredRows = useMemo(() => {
    // Bei aktiver Namenssuche über alle Gruppen – erleichtert die Zuordnung
    const base = searchActive
      ? sortedRows
      : filterRowsByGroup(sortedRows, groupFilter);
    if (!searchActive) return base;
    return base.filter((r) => matchesNameSearch(r, nameQuery));
  }, [sortedRows, groupFilter, nameQuery, searchActive]);

  const isCriteria = project ? isStaCriteriaExam(project.examType) : false;
  const isPortfolio = project ? isPortfolioExam(project.examType) : false;
  const hasGroups =
    project != null && sortedStudentGroups(project).length > 0;
  const unassignedTotal = hasGroups
    ? countInGroup(sortedRows, "none")
    : 0;

  const visibleKeys = useMemo(
    () => filteredRows.map((r) => r.key),
    [filteredRows]
  );
  const allVisibleSelected =
    visibleKeys.length > 0 &&
    visibleKeys.every((k) => selectedKeys.includes(k));
  const someVisibleSelected =
    visibleKeys.some((k) => selectedKeys.includes(k)) && !allVisibleSelected;

  const toggleKey = (key: string, on: boolean) => {
    setSelectedKeys((prev) =>
      on ? (prev.includes(key) ? prev : [...prev, key]) : prev.filter((k) => k !== key)
    );
  };

  const toggleAllVisible = (on: boolean) => {
    setSelectedKeys((prev) => {
      if (on) {
        const set = new Set(prev);
        for (const k of visibleKeys) set.add(k);
        return [...set];
      }
      return prev.filter((k) => !visibleKeys.includes(k));
    });
  };

  const assignSelectedToGroup = (groupId: string | null) => {
    if (selectedKeys.length === 0) return;
    setProject((prev) => setStudentGroupIds(prev, selectedKeys, groupId));
    setSelectedKeys([]);
  };

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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base">Bewertungsmatrix</CardTitle>
                <CardDescription>
                  {isPortfolio
                    ? `${components.length} Teilleistungen · Gewichte relativ`
                    : `${criteria.length} Kriterien · Gewichte relativ · Max. Gesamtwert ${project.gradeSchema.maxPoints}`}
                  {" · "}
                  {filteredRows.length} von {sortedRows.length} Person(en)
                  {searchActive && (
                    <span className="text-foreground">
                      {" "}
                      · Suche über alle Gruppen
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="w-full min-w-[14rem] max-w-xs sm:w-72">
                <label className="sr-only" htmlFor="assessment-name-search">
                  Name oder Matrikelnummer suchen
                </label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <ClearableInput
                    id="assessment-name-search"
                    value={nameQuery}
                    onChange={setNameQuery}
                    placeholder="Suche Name / Matr.…"
                    className="h-9 pl-8"
                    autoComplete="off"
                    clearLabel="Suche löschen"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Gruppenübergreifend · mehrere Namen mit Komma · per Checkbox
                  Sammelzuordnung.
                </p>
              </div>
            </div>
            {hasGroups && selectedKeys.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <Users className="size-4 shrink-0 text-primary" />
                <span className="text-sm font-medium tabular-nums">
                  {selectedKeys.length} ausgewählt
                </span>
                <span className="text-xs text-muted-foreground">
                  Gruppe zuweisen:
                </span>
                <StudentGroupSelect
                  project={project}
                  groupId={null}
                  rows={sortedRows}
                  className="min-w-[10rem]"
                  compact
                  onChange={(gid) => assignSelectedToGroup(gid)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedKeys([])}
                >
                  Auswahl aufheben
                </Button>
              </div>
            )}
            {hasGroups && unassignedTotal > 0 && selectedKeys.length === 0 && (
              <p className="mt-2 text-[11px] text-amber-900 dark:text-amber-100">
                {unassignedTotal} Person(en) ohne Gruppe – markiert in der
                Matrix; Checkboxen für Sammelzuordnung nutzen.
              </p>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[min(70vh,720px)] overflow-auto">
              <Table className="min-w-max">
                <TableHeader className="sticky top-0 z-10 bg-card shadow-sm">
                  <TableRow>
                    {hasGroups && (
                      <TableHead className="w-10 px-2">
                        <Checkbox
                          checked={allVisibleSelected}
                          indeterminate={someVisibleSelected}
                          onCheckedChange={(v) =>
                            toggleAllVisible(v === true)
                          }
                          aria-label="Alle sichtbaren Personen auswählen"
                          disabled={visibleKeys.length === 0}
                        />
                      </TableHead>
                    )}
                    <TableHead
                      className={cn(
                        "sticky z-20 min-w-[140px] bg-card",
                        hasGroups ? "left-10" : "left-0"
                      )}
                    >
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
                        colSpan={5 + cols.length + (hasGroups ? 1 : 0)}
                        className="h-20 text-center text-muted-foreground"
                      >
                        {sortedRows.length === 0
                          ? "Noch keine Personen – bitte HISinOne importieren oder manuell hinzufügen."
                          : searchActive
                            ? "Keine Person passt zur Suche."
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
                      const ungrouped =
                        hasGroups && !r.student.groupId;
                      const selected = selectedKeys.includes(r.key);
                      const rowBg = ungrouped
                        ? "bg-amber-50/90 dark:bg-amber-950/35"
                        : selected
                          ? "bg-primary/5"
                          : undefined;
                      const stickyBg = ungrouped
                        ? "bg-amber-50 dark:bg-amber-950/50"
                        : selected
                          ? "bg-primary/5"
                          : "bg-card";

                      return (
                        <TableRow
                          key={r.key}
                          className={cn(rowBg, ungrouped && "border-l-2 border-l-amber-500")}
                        >
                          {hasGroups && (
                            <TableCell className={cn("w-10 px-2", rowBg)}>
                              <Checkbox
                                checked={selected}
                                onCheckedChange={(v) =>
                                  toggleKey(r.key, v === true)
                                }
                                aria-label={`${r.student.lastName}, ${r.student.firstName} auswählen`}
                              />
                            </TableCell>
                          )}
                          <TableCell
                            className={cn(
                              "sticky z-10 font-medium whitespace-nowrap",
                              hasGroups ? "left-10" : "left-0",
                              stickyBg
                            )}
                          >
                            {r.student.lastName}, {r.student.firstName}
                            {ungrouped && (
                              <Badge
                                variant="outline"
                                className="ml-1 border-amber-500/60 bg-amber-100/80 text-[10px] text-amber-950 dark:bg-amber-900 dark:text-amber-50"
                              >
                                ohne Gruppe
                              </Badge>
                            )}
                            {!r.inHis && (
                              <Badge
                                variant="outline"
                                className="ml-1 text-[10px]"
                              >
                                manuell
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className={cn("font-mono text-xs", rowBg)}>
                            {r.key}
                          </TableCell>
                          <TableCell className={cn("p-1", rowBg)}>
                            <StudentGroupSelect
                              project={project}
                              groupId={r.student.groupId}
                              rows={sortedRows}
                              compact
                              highlightEmpty
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
                                    className={cn("p-1 text-center", rowBg)}
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
                                    className={cn("p-1 text-center", rowBg)}
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
                            <TableCell
                              className={cn(
                                "text-center tabular-nums text-sm bg-muted/20",
                                ungrouped && "bg-amber-100/40 dark:bg-amber-950/20"
                              )}
                            >
                              {formatPoints(r.totalPoints)}
                            </TableCell>
                          )}
                          {isPortfolio && (
                            <TableCell
                              className={cn(
                                "text-center tabular-nums text-sm bg-muted/20",
                                ungrouped && "bg-amber-100/40 dark:bg-amber-950/20"
                              )}
                            >
                              {rawAvg != null
                                ? formatGrade(rawAvg)
                                : "–"}
                            </TableCell>
                          )}
                          <TableCell
                            className={cn(
                              "text-center tabular-nums font-semibold bg-muted/30",
                              ungrouped && "bg-amber-100/50 dark:bg-amber-950/25"
                            )}
                          >
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
