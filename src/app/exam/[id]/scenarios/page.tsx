"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useExamContext } from "@/components/exam/exam-context";
import {
  ensureScenarios,
  getEditableScenario,
  setEditableScenarioEnabled,
  updateEditableScenario,
  visibleScenarios,
  withActiveScenario,
} from "@/lib/grades/scenarios";
import { buildEnrichedRows } from "@/lib/matching/match";
import { computeStatistics } from "@/lib/grades/statistics";
import {
  hasOpenGrading,
  openGradingSummary,
} from "@/lib/grades/open-grading";
import { formatPercent } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn, formatGrade, formatStat } from "@/lib/utils";
import { Check, Download, FileDown, ListChecks } from "lucide-react";
import { computeScenarioImpact } from "@/lib/grades/scenario-impact";
import { ScenarioImpactPanel } from "@/components/grades/scenario-impact-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  buildScenarioComparisonBundle,
  scenarioSeriesForCharts,
} from "@/lib/grades/scenario-comparison";
import {
  ScenarioGradeBucketChart,
  ScenarioGradeDistributionChart,
} from "@/components/charts/grade-distribution-chart";
import { ExpandableChart } from "@/components/charts/expandable-chart";
import { exportScenarioComparisonPdf } from "@/lib/pdf/export-scenario-comparison-pdf";

export default function ScenariosPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject } = useExamContext();
  const [editPass, setEditPass] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const allScenarios = useMemo(
    () => (project ? ensureScenarios(project) : []),
    [project]
  );
  const scenarios = useMemo(
    () => (project ? visibleScenarios(project) : []),
    [project]
  );
  const editable = useMemo(
    () => (project ? getEditableScenario(project) : undefined),
    [project]
  );
  const s3Enabled = editable?.enabled === true;
  const gradingLocked = project ? hasOpenGrading(project) : false;

  const comparison = useMemo(() => {
    if (!project) return [];
    return scenarios.map((sc) => {
      const rows = buildEnrichedRows({
        ...project,
        gradeSchema: sc.schema,
        gradeScenarios: allScenarios,
        activeScenarioId: sc.id,
      });
      const stats = computeStatistics(rows, sc.schema);
      return { scenario: sc, stats, rows };
    });
  }, [project, scenarios, allScenarios]);

  const comparisonBundle = useMemo(() => {
    if (!project) return null;
    return buildScenarioComparisonBundle(project, compareA, compareB);
  }, [project, compareA, compareB, scenarios]);

  const chartSeries = useMemo(
    () =>
      comparisonBundle
        ? scenarioSeriesForCharts(comparisonBundle.columns)
        : [],
    [comparisonBundle]
  );

  if (!project) return null;

  const activeId = project.activeScenarioId ?? scenarios[0]?.id;
  const active =
    scenarios.find((s) => s.id === activeId) ?? scenarios[0] ?? null;
  const idA = compareA ?? scenarios[0]?.id;
  const idB =
    compareB ??
    scenarios.find((s) => s.id !== idA)?.id ??
    scenarios[1]?.id;
  const impact =
    idA && idB && scenarios.length >= 2
      ? computeScenarioImpact(project, idA, idB)
      : null;
  const impactRows = impact
    ? onlyChanged
      ? impact.rows.filter((r) => r.delta != null && Math.abs(r.delta) >= 0.05)
      : impact.rows
    : [];

  const thresholds = active
    ? [...active.schema.thresholds].sort((a, b) => a.grade - b.grade)
    : [];

  const runPdfExport = () => {
    setExportMsg(null);
    setExportBusy(true);
    try {
      exportScenarioComparisonPdf(project, {
        impactA: idA,
        impactB: idB,
      });
      setExportMsg("PDF Szenarienvergleich heruntergeladen.");
    } catch (e) {
      setExportMsg(
        e instanceof Error ? e.message : "PDF-Export fehlgeschlagen"
      );
    } finally {
      setExportBusy(false);
    }
  };

  const fileBase = `ExamGrade_${project.name || "Pruefung"}`;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Notenszenarien
        </h1>
        <p className="text-muted-foreground">
          Vergleich der Bestehensgrenzen. Das aktive Szenario steuert Noten,
          Export und Grenzfälle. Nur intern – keine Studierenden-Kommunikation.
        </p>
      </div>

      {gradingLocked && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <ListChecks className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Notenschlüssel gesperrt</p>
            <p className="mt-0.5 opacity-95">
              {openGradingSummary(project)}. Bitte zuerst alle Aufgaben in den
              Detailpunkten bewerten.
            </p>
          </div>
          <Link
            href={`/exam/${id}/detail-points`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            Zu Detailpunkten
          </Link>
        </div>
      )}

      {/* Aktive Schwellen + Szenario-Wahl */}
      <Card className="surface-panel">
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Aktive Notenschwelle</span>
              {active && (
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {active.name.replace(" (Standard)", "")} · Bestehen ab{" "}
                  {active.passThreshold} Pkt.
                </span>
              )}
            </div>
            <div className="flex max-w-full flex-wrap gap-1.5">
              {thresholds.map((t) => (
                <span
                  key={t.grade}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs tabular-nums"
                  title={`Note ${formatGrade(t.grade)} ab ${t.minPoints} Punkten`}
                >
                  <span className="font-semibold">{formatGrade(t.grade)}</span>
                  <span className="text-muted-foreground">≥{t.minPoints}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-1.5">
              {scenarios.map((sc) => {
                const isActive = sc.id === activeId;
                return (
                  <Button
                    key={sc.id}
                    type="button"
                    size="sm"
                    variant={isActive ? "default" : "outline"}
                    disabled={gradingLocked}
                    onClick={() =>
                      setProject((prev) => withActiveScenario(prev, sc.id))
                    }
                  >
                    {isActive && <Check className="size-3.5" />}
                    {sc.name.replace(" (Standard)", "").replace(" (frei)", "")}
                    <span className="opacity-80">{sc.passThreshold} Pkt.</span>
                  </Button>
                );
              })}
            </div>

            {editable && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5">
                <Switch
                  checked={s3Enabled}
                  disabled={gradingLocked}
                  onCheckedChange={(on) =>
                    setProject((prev) =>
                      setEditableScenarioEnabled(prev, on === true)
                    )
                  }
                  id="s3-toggle"
                />
                <Label htmlFor="s3-toggle" className="cursor-pointer text-sm">
                  Szenario 3 (frei)
                </Label>
                {s3Enabled && (
                  <>
                    <Input
                      type="number"
                      step="0.5"
                      className="h-8 w-20"
                      title="Bestehensgrenze"
                      disabled={gradingLocked}
                      value={editPass ?? editable.passThreshold}
                      onChange={(e) => setEditPass(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">Pkt.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={gradingLocked}
                      onClick={() => {
                        const p = Number(
                          (editPass ?? editable.passThreshold)
                            .toString()
                            .replace(",", ".")
                        );
                        if (!Number.isFinite(p)) return;
                        setProject((prev) => updateEditableScenario(prev, p));
                        setEditPass(null);
                      }}
                    >
                      Übernehmen
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vergleich links | Impact rechts */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <Card className="surface-panel min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Direktvergleich</CardTitle>
            <CardDescription>
              Max. {project.gradeSchema.maxPoints} Punkte
              {scenarios.length < 2 &&
                " · Szenario 3 aktivieren für mehr Vergleiche"}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">Kennzahl</TableHead>
                  {comparison.map(({ scenario }) => (
                    <TableHead
                      key={scenario.id}
                      className={cn(
                        "whitespace-nowrap",
                        scenario.id === activeId &&
                          "bg-primary/10 font-semibold"
                      )}
                    >
                      {scenario.name
                        .replace(" (Standard)", "")
                        .replace(" (frei)", "")}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(
                  [
                    [
                      "Bestehensgrenze",
                      (sc: (typeof comparison)[0]) =>
                        String(sc.scenario.passThreshold),
                    ],
                    [
                      "Ø Note",
                      (sc: (typeof comparison)[0]) =>
                        formatGrade(sc.stats.averageGrade),
                    ],
                    [
                      "Median",
                      (sc: (typeof comparison)[0]) =>
                        formatGrade(sc.stats.medianGrade),
                    ],
                    [
                      "Stabw.",
                      (sc: (typeof comparison)[0]) =>
                        formatStat(sc.stats.stdDevGrade, 2),
                    ],
                    [
                      "Bestehen %",
                      (sc: (typeof comparison)[0]) =>
                        formatPercent(sc.stats.passRate),
                    ],
                    [
                      "Durchfaller",
                      (sc: (typeof comparison)[0]) =>
                        String(sc.stats.failCount),
                    ],
                    [
                      "Grenzfälle",
                      (sc: (typeof comparison)[0]) =>
                        String(sc.stats.borderlineCount),
                    ],
                  ] as const
                ).map(([label, val]) => (
                  <TableRow key={label}>
                    <TableCell className="text-sm">{label}</TableCell>
                    {comparison.map((col) => (
                      <TableCell
                        key={col.scenario.id}
                        className={cn(
                          "tabular-nums text-sm",
                          col.scenario.id === activeId && "bg-primary/5",
                          label === "Durchfaller" &&
                            "font-medium text-rose-700 dark:text-rose-300",
                          label === "Grenzfälle" &&
                            "text-amber-800 dark:text-amber-200"
                        )}
                      >
                        {val(col)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {impact && scenarios.length >= 2 ? (
          <Card className="surface-panel min-w-0">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <CardTitle className="text-base">
                    Auswirkung des Szenario-Wechsels
                  </CardTitle>
                  <CardDescription>
                    Grafik + Kennzahlen (intern)
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-1">
                    <Label className="text-xs">Von</Label>
                    <Select
                      value={idA}
                      onValueChange={(v) => v && setCompareA(v)}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue>
                          {scenarios
                            .find((s) => s.id === idA)
                            ?.name.replace(" (Standard)", "")
                            .replace(" (frei)", "")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {scenarios.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name
                              .replace(" (Standard)", "")
                              .replace(" (frei)", "")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <Label className="text-xs">Nach</Label>
                    <Select
                      value={idB}
                      onValueChange={(v) => v && setCompareB(v)}
                    >
                      <SelectTrigger className="h-8 w-36">
                        <SelectValue>
                          {scenarios
                            .find((s) => s.id === idB)
                            ?.name.replace(" (Standard)", "")
                            .replace(" (frei)", "")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {scenarios.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name
                              .replace(" (Standard)", "")
                              .replace(" (frei)", "")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScenarioImpactPanel impact={impact} />
            </CardContent>
          </Card>
        ) : (
          <Card className="surface-panel min-w-0">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              Mindestens zwei Szenarien aktivieren, um den grafischen
              Wirkungsvergleich zu sehen.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Noten- und Stufenvergleich + Export */}
      {comparisonBundle && comparisonBundle.columns.length > 0 && (
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="text-base">
                  Noten und Notenstufen im Szenario-Vergleich
                </CardTitle>
                <CardDescription>
                  Anzahl und Anteil der bewerteten Studierenden je Note bzw.
                  Notenstufe – zum internen Abgleich der Szenarien.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  className="gap-1.5"
                  disabled={exportBusy}
                  onClick={runPdfExport}
                >
                  <FileDown className="size-4" />
                  PDF Export
                </Button>
              </div>
            </div>
            {exportMsg && (
              <p className="mt-2 text-xs text-muted-foreground">{exportMsg}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card">
                      Note
                    </TableHead>
                    {comparisonBundle.columns.map((c) => (
                      <TableHead
                        key={c.id}
                        className="min-w-[5.5rem] text-center"
                      >
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonBundle.gradeMatrix.map((row) => (
                    <TableRow key={row.grade}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium tabular-nums">
                        {row.gradeLabel}
                      </TableCell>
                      {row.cells.map((cell, i) => (
                        <TableCell
                          key={comparisonBundle.columns[i]?.id ?? i}
                          className="text-center text-sm tabular-nums"
                        >
                          <span className="font-medium">{cell.count}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {Math.round(cell.share * 1000) / 10} %
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 z-10 bg-card">
                      Notenstufe
                    </TableHead>
                    {comparisonBundle.columns.map((c) => (
                      <TableHead
                        key={c.id}
                        className="min-w-[5.5rem] text-center"
                      >
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparisonBundle.bucketMatrix.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">
                        {row.name}
                      </TableCell>
                      {row.cells.map((cell, i) => (
                        <TableCell
                          key={comparisonBundle.columns[i]?.id ?? i}
                          className={cn(
                            "text-center text-sm tabular-nums",
                            row.name.startsWith("nicht") &&
                              "text-rose-700 dark:text-rose-300"
                          )}
                        >
                          <span className="font-medium">{cell.count}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {Math.round(cell.share * 1000) / 10} %
                          </span>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">
                  Visualisierung Noten (Anteil)
                </p>
                <ExpandableChart
                  title="Notenverteilung je Szenario"
                  description="Anteil der Studierenden je Note"
                  filenameBase={`${fileBase}_Szenarien_Notenverteilung`}
                >
                  <ScenarioGradeDistributionChart
                    series={chartSeries}
                    mode="share"
                  />
                </ExpandableChart>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">
                  Visualisierung Notenstufen (Anzahl)
                </p>
                <ExpandableChart
                  title="Notenstufen je Szenario"
                  description="sehr gut … nicht ausreichend"
                  filenameBase={`${fileBase}_Szenarien_Notenstufen`}
                >
                  <ScenarioGradeBucketChart
                    series={chartSeries}
                    mode="count"
                  />
                </ExpandableChart>
              </div>
            </div>

            {/* Durchfaller-Analyse kompakt */}
            <div>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">
                    Durchfaller über Szenarien
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {comparisonBundle.failers.length} Person(en) mit Note 5,0 in
                    mindestens einem Szenario · Details im PDF-Export
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={exportBusy}
                  onClick={runPdfExport}
                >
                  <Download className="size-3.5" />
                  Analyse als PDF
                </Button>
              </div>
              <div className="max-h-72 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Matr.</TableHead>
                      <TableHead>Pkt.</TableHead>
                      {comparisonBundle.columns.map((c) => (
                        <TableHead key={c.id} className="text-center">
                          {c.label}
                        </TableHead>
                      ))}
                      <TableHead className="hidden md:table-cell">
                        Hinweis
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparisonBundle.failers.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4 + comparisonBundle.columns.length}
                          className="text-center text-muted-foreground"
                        >
                          Keine Durchfaller in den sichtbaren Szenarien.
                        </TableCell>
                      </TableRow>
                    ) : (
                      comparisonBundle.failers.map((f) => (
                        <TableRow key={f.key}>
                          <TableCell className="whitespace-nowrap">
                            {f.lastName}, {f.firstName}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {f.key}
                          </TableCell>
                          <TableCell className="tabular-nums text-sm">
                            {f.totalPoints != null
                              ? formatStat(f.totalPoints, 1)
                              : "–"}
                          </TableCell>
                          {f.grades.map((g, i) => (
                            <TableCell
                              key={comparisonBundle.columns[i]?.id ?? i}
                              className={cn(
                                "text-center tabular-nums text-sm",
                                f.failsIn[i] &&
                                  "font-semibold text-rose-700 dark:text-rose-300"
                              )}
                            >
                              {formatGrade(g)}
                            </TableCell>
                          ))}
                          <TableCell className="hidden max-w-[12rem] text-xs text-muted-foreground md:table-cell">
                            {f.statusNote}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {impact && scenarios.length >= 2 && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <Card className="surface-panel h-fit min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Filter</CardTitle>
              <CardDescription>
                Personenebene (Note kleiner = besser)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={onlyChanged}
                  onChange={(e) => setOnlyChanged(e.target.checked)}
                />
                nur Änderungen
              </label>
              <div className="space-y-1.5 rounded-lg border bg-muted/30 px-2.5 py-2 text-xs">
                <p>
                  Angezeigt:{" "}
                  <strong className="tabular-nums">{impactRows.length}</strong>
                </p>
                <p className="text-emerald-700 dark:text-emerald-300">
                  besser: {impact.improved}
                </p>
                <p className="text-rose-700 dark:text-rose-300">
                  schlechter: {impact.worsened}
                </p>
                <p className="text-muted-foreground">
                  unverändert: {impact.unchanged}
                </p>
                <p className="text-emerald-700 dark:text-emerald-300">
                  neu bestanden: {impact.newlyPassed}
                </p>
                <p className="text-rose-700 dark:text-rose-300">
                  neu durchgefallen: {impact.newlyFailed}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="surface-panel min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Detail: Wer profitiert / wer verliert?
              </CardTitle>
              <CardDescription>
                {scenarios
                  .find((s) => s.id === idA)
                  ?.name.replace(" (Standard)", "")
                  .replace(" (frei)", "")}{" "}
                →{" "}
                {scenarios
                  .find((s) => s.id === idB)
                  ?.name.replace(" (Standard)", "")
                  .replace(" (frei)", "")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Matr.</TableHead>
                      <TableHead>Note A</TableHead>
                      <TableHead>Note B</TableHead>
                      <TableHead>Δ</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {impactRows.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          Keine Änderungen zwischen den Szenarien.
                        </TableCell>
                      </TableRow>
                    ) : (
                      impactRows.map((r) => (
                        <TableRow
                          key={r.key}
                          className={cn(
                            r.delta != null &&
                              r.delta < 0 &&
                              "bg-emerald-50/80 dark:bg-emerald-950/20",
                            r.delta != null &&
                              r.delta > 0 &&
                              "bg-rose-50/80 dark:bg-rose-950/20"
                          )}
                        >
                          <TableCell>
                            {r.lastName}, {r.firstName}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {r.key}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatGrade(r.gradeA)}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatGrade(r.gradeB)}
                          </TableCell>
                          <TableCell className="tabular-nums font-medium">
                            {r.delta == null
                              ? "–"
                              : r.delta > 0
                                ? `+${r.delta.toFixed(1)}`
                                : r.delta.toFixed(1)}
                          </TableCell>
                          <TableCell className="hidden text-xs sm:table-cell">
                            {r.newlyPassed && (
                              <span className="text-emerald-700 dark:text-emerald-300">
                                neu bestanden
                              </span>
                            )}
                            {r.newlyFailed && (
                              <span className="text-rose-700 dark:text-rose-300">
                                neu durchgefallen
                              </span>
                            )}
                            {!r.newlyPassed &&
                              !r.newlyFailed &&
                              r.delta != null &&
                              Math.abs(r.delta) >= 0.05 && (
                                <span className="text-muted-foreground">
                                  Note geändert
                                </span>
                              )}
                            {!r.newlyPassed &&
                              !r.newlyFailed &&
                              (r.delta == null ||
                                Math.abs(r.delta) < 0.05) && (
                                <span className="text-muted-foreground">
                                  –
                                </span>
                              )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
