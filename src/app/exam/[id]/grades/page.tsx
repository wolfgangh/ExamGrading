"use client";

import { useEffect, useMemo, useState } from "react";
import { useExamContext } from "@/components/exam/exam-context";
import {
  StudentsTable,
  type BorderlineFilter,
} from "@/components/grades/students-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { PointsRecord } from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cn,
  formatGrade,
  formatPercent,
  formatPoints,
  formatStat,
} from "@/lib/utils";
import {
  PageSectionNav,
  SECTION_SCROLL_MT,
} from "@/components/layout/page-section-nav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  computeFailerAnalysis,
  computeStatistics,
  defaultBorderlineMax,
  resolveNextGradeUnit,
} from "@/lib/grades/statistics";
import {
  ensureScenarios,
  formatThresholdDual,
  visibleScenarios,
  withActiveScenario,
} from "@/lib/grades/scenarios";
import { portfolioUsesGradeScenarios } from "@/lib/grades/portfolio";
import {
  computeGradeBuckets,
  computeScenarioImpact,
} from "@/lib/grades/scenario-impact";
import { buildEnrichedRows } from "@/lib/matching/match";
import {
  ScenarioGradeBucketChart,
  ScenarioGradeDistributionChart,
  shortScenarioLabel,
} from "@/components/charts/grade-distribution-chart";
import { ExpandableChart } from "@/components/charts/expandable-chart";
import {
  hasOpenGrading,
  openGradingSummary,
} from "@/lib/grades/open-grading";
import { exportNotenspiegelPdf } from "@/lib/pdf/export-notenspiegel-pdf";
import { exportNotenspiegelExcel } from "@/lib/excel/export-notenspiegel";
import {
  canAccessProtectedExport,
} from "@/lib/backup-status";
import { hasUnresolvedOrphans } from "@/lib/matching/orphan-resolution";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileSpreadsheet, FileText, ListChecks } from "lucide-react";
import {
  isPortfolioExam,
  isStaCriteriaExam,
  isStaManualExam,
  supportsStudentGroups,
} from "@/lib/types";
import { GroupFilterBar } from "@/components/exam/group-filter-bar";
import {
  filterRowsByGroup,
  type GroupFilterId,
} from "@/lib/student-groups";

export default function GradesPage() {
  const { id } = useParams<{ id: string }>();
  const { project, setProject, rows, stats } = useExamContext();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState<string>("");
  const [comment, setComment] = useState("");
  const [borderlineFilter, setBorderlineFilter] =
    useState<BorderlineFilter>("off");
  const [borderlineCustom, setBorderlineCustom] = useState<number | null>(null);
  const [failersOnly, setFailersOnly] = useState(false);
  const [noShowOnly, setNoShowOnly] = useState(false);
  const [orphanOnly, setOrphanOnly] = useState(false);
  const [showFailerPanel, setShowFailerPanel] = useState(false);
  const [spiegelBusy, setSpiegelBusy] = useState<string | null>(null);
  const [spiegelMsg, setSpiegelMsg] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState<GroupFilterId>("all");

  const editRow = useMemo(
    () => rows.find((r) => r.key === editKey) ?? null,
    [rows, editKey]
  );

  const failerAnalysis = useMemo(
    () => computeFailerAnalysis(rows),
    [rows]
  );

  /** #durchfaller nur nutzbar, wenn Panel im DOM – bei Hash öffnen */
  useEffect(() => {
    if (failerAnalysis.count <= 0) return;
    const openFromHash = () => {
      if (typeof window === "undefined") return;
      if (window.location.hash === "#durchfaller") {
        setShowFailerPanel(true);
        requestAnimationFrame(() => {
          document
            .getElementById("durchfaller")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    };
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [failerAnalysis.count]);

  const scenarios = useMemo(
    () => (project ? visibleScenarios(project) : []),
    [project]
  );

  /** Stats + Buckets je sichtbares Szenario für Vergleichsgrafiken */
  const scenarioChartSeries = useMemo(() => {
    if (!project || scenarios.length === 0) return [];
    const all = ensureScenarios(project);
    return scenarios.map((sc) => {
      const scRows = buildEnrichedRows({
        ...project,
        gradeSchema: sc.schema,
        gradeScenarios: all,
        activeScenarioId: sc.id,
      });
      const scStats = computeStatistics(scRows, sc.schema, undefined, project);
      return {
        key: sc.id,
        label: shortScenarioLabel(sc.name, sc.passThreshold),
        stats: scStats,
        buckets: computeGradeBuckets(scRows),
        passThreshold: sc.passThreshold,
      };
    });
  }, [project, scenarios]);

  const impactVs40 = useMemo(() => {
    if (!project || scenarios.length < 2) return null;
    const a =
      scenarios.find((s) => s.id === project.activeScenarioId) ?? scenarios[0];
    const b =
      scenarios.find((s) => s.id !== a.id && !s.editable) ??
      scenarios.find((s) => s.id !== a.id) ??
      scenarios[1];
    if (!b) return null;
    return computeScenarioImpact(project, a.id, b.id);
  }, [project, scenarios]);

  const nextGradeUnit = useMemo(() => resolveNextGradeUnit(rows), [rows]);
  const defaultBl = useMemo(
    () =>
      defaultBorderlineMax(
        nextGradeUnit,
        project?.gradeSchema.maxPoints
      ),
    [nextGradeUnit, project?.gradeSchema.maxPoints]
  );
  const unitLabelShort =
    nextGradeUnit === "grade" ? "Notengrade" : "Pkt.";
  const highlightMax =
    borderlineFilter === "off"
      ? defaultBl
      : borderlineFilter === "custom"
        ? (borderlineCustom ?? defaultBl)
        : Number(borderlineFilter);

  if (!project) return null;

  const gradingLocked = hasOpenGrading(project);
  const backupOk = canAccessProtectedExport(project);
  const orphansLocked = hasUnresolvedOrphans(project, rows);
  const notenspiegelReady =
    !gradingLocked &&
    !orphansLocked &&
    backupOk &&
    stats != null &&
    stats.graded > 0;

  const runNotenspiegel = (key: "pdf" | "xlsx", fn: () => void | Promise<void>) => {
    if (!notenspiegelReady || !stats) return;
    setSpiegelBusy(key);
    setSpiegelMsg(null);
    void (async () => {
      try {
        await fn();
        setSpiegelMsg(
          key === "pdf"
            ? "Notenspiegel (PDF) heruntergeladen."
            : "Notenspiegel (Excel) heruntergeladen."
        );
      } catch (e) {
        setSpiegelMsg(
          e instanceof Error ? e.message : "Export fehlgeschlagen"
        );
      } finally {
        setSpiegelBusy(null);
      }
    })();
  };

  const openEdit = (key: string) => {
    const row = rows.find((r) => r.key === key);
    setEditKey(key);
    setGradeValue(
      row?.gradeOverride != null
        ? String(row.gradeOverride)
        : row?.calculatedGrade != null
          ? String(row.calculatedGrade)
          : ""
    );
    setComment(row?.comment ?? "");
  };

  const saveOverride = () => {
    if (!editKey) return;
    const parsed =
      gradeValue.trim() === ""
        ? null
        : Number(gradeValue.replace(",", "."));
    const gradeOverride =
      parsed != null && Number.isFinite(parsed) ? parsed : null;

    setProject((prev) => {
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === editKey
      );
      const base: PointsRecord =
        idx >= 0
          ? prev.points[idx]
          : {
              matriculationNumber: editKey,
              bySubArea: Object.fromEntries(
                prev.subAreas.map((sa) => [sa.id, null])
              ),
              totalPoints: null,
              source: "manual",
            };
      const calculated = editRow?.calculatedGrade ?? null;
      const previousGrade =
        gradeOverride != null
          ? (base.previousGrade ?? calculated)
          : base.previousGrade;
      const next: PointsRecord = {
        ...base,
        gradeOverride,
        previousGrade: gradeOverride != null ? previousGrade : null,
        comment: comment.trim() || undefined,
        source: base.source === "moodle" ? "mixed" : base.source,
      };
      const points = [...prev.points];
      if (idx >= 0) points[idx] = next;
      else points.push(next);
      return { ...prev, points };
    });
    setEditKey(null);
  };

  const clearOverride = () => {
    if (!editKey) return;
    setProject((prev) => {
      const idx = prev.points.findIndex(
        (p) => normalizeMatriculation(p.matriculationNumber) === editKey
      );
      if (idx < 0) {
        setEditKey(null);
        return prev;
      }
      const points = [...prev.points];
      points[idx] = {
        ...points[idx],
        gradeOverride: null,
        previousGrade: null,
        comment: comment.trim() || undefined,
      };
      return { ...prev, points };
    });
    setEditKey(null);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Notenübersicht
        </h1>
        <p className="text-muted-foreground">
          Aktives Szenario steuert Noten und Grenzfälle. Auswertung nur
          intern für Prüfer.
        </p>
      </div>

      <PageSectionNav
        sections={[
          ...(scenarioChartSeries.length > 0
            ? [{ id: "szenario-charts", label: "Szenario-Grafiken" }]
            : []),
          { id: "kennzahlen", label: "Kennzahlen" },
          { id: "notenliste", label: "Notenliste" },
          ...(failerAnalysis && failerAnalysis.count > 0
            ? [{ id: "durchfaller", label: "Durchfaller" }]
            : []),
        ]}
      />

      {gradingLocked && (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-50"
        >
          <ListChecks className="mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Notenschlüssel gesperrt</p>
            <p className="mt-0.5 opacity-95">
              {openGradingSummary(project)}. Szenario-Wechsel und Export erst
              nach vollständiger Bewertung.
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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Szenario:</span>
        {scenarios.map((sc) => {
          const dual = formatThresholdDual(
            sc.passThreshold,
            sc.schema.maxPoints
          );
          const port = portfolioUsesGradeScenarios(project);
          return (
            <Button
              key={sc.id}
              size="sm"
              variant={
                sc.id === project.activeScenarioId ? "default" : "outline"
              }
              disabled={gradingLocked}
              className="h-auto min-h-8 flex-col items-start gap-0 py-1"
              title={
                gradingLocked
                  ? "Zuerst alle Aufgaben bewerten"
                  : `${sc.name} · ${dual.label}`
              }
              onClick={() =>
                setProject((prev) => withActiveScenario(prev, sc.id))
              }
            >
              <span className="text-xs font-semibold leading-tight">
                {sc.name
                  .replace(" (Standard)", "")
                  .replace(" (frei)", "")
                  .replace(" (Bestehens-%)", "")}
              </span>
              <span className="text-[10px] font-normal opacity-90">
                {port
                  ? `${String(dual.percent).replace(".", ",")} % · ${String(dual.points).replace(".", ",")} Pkt.`
                  : `${String(dual.points).replace(".", ",")} Pkt.`}
              </span>
            </Button>
          );
        })}
        <Link
          href={`/exam/${id}/scenarios`}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "gap-1"
          )}
        >
          Notenszenarien verwalten
        </Link>
        {portfolioUsesGradeScenarios(project) && (
          <p className="w-full text-xs text-muted-foreground">
            Aktives Szenario steuert Teilnoten und Gesamtnote bei Punkte-/Prozent-TLs
            (Klausur-Schlüssel auf Erfüllung %).
          </p>
        )}
      </div>

      {scenarioChartSeries.length > 0 && (
        <div
          id="szenario-charts"
          className={cn("grid gap-4 lg:grid-cols-2", SECTION_SCROLL_MT)}
        >
          <Card className="surface-panel min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Notenverteilung im Szenario-Vergleich
              </CardTitle>
              <CardDescription>
                {scenarioChartSeries.length > 1
                  ? `Gruppierte Balken je Note · ${scenarioChartSeries
                      .map((s) => s.label)
                      .join(" · ")}`
                  : "Anteil je Note (aktives Szenario)"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpandableChart
                title="Notenverteilung im Szenario-Vergleich"
                description={
                  scenarioChartSeries.length > 1
                    ? scenarioChartSeries.map((s) => s.label).join(" · ")
                    : "Anteil je Note"
                }
                filenameBase={`ExamGrade_${project.name || "Pruefung"}_Szenarien_Notenverteilung`}
              >
                <ScenarioGradeDistributionChart
                  series={scenarioChartSeries}
                  mode="share"
                  activeKey={project.activeScenarioId}
                />
              </ExpandableChart>
            </CardContent>
          </Card>
          <Card className="surface-panel min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Notenstufen im Szenario-Vergleich
              </CardTitle>
              <CardDescription>
                sehr gut … nicht ausreichend
                {scenarioChartSeries.length > 1
                  ? " · Szenarien nebeneinander"
                  : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExpandableChart
                title="Notenstufen im Szenario-Vergleich"
                description="sehr gut … nicht ausreichend"
                filenameBase={`ExamGrade_${project.name || "Pruefung"}_Szenarien_Notenstufen`}
              >
                <ScenarioGradeBucketChart
                  series={scenarioChartSeries}
                  mode="count"
                  activeKey={project.activeScenarioId}
                />
              </ExpandableChart>
            </CardContent>
          </Card>
        </div>
      )}

      {stats && (
        <div
          id="kennzahlen"
          className={cn("flex flex-wrap items-end gap-3", SECTION_SCROLL_MT)}
        >
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {[
              { l: "Bewertet", v: String(stats.graded) },
              { l: "Ø Note", v: formatGrade(stats.averageGrade) },
              { l: "Median", v: formatGrade(stats.medianGrade) },
              { l: "25%-Quantil", v: formatGrade(stats.q25Grade) },
              { l: "75%-Quantil", v: formatGrade(stats.q75Grade) },
              { l: "Stabw.", v: formatStat(stats.stdDevGrade, 2) },
              { l: "Bestehen", v: formatPercent(stats.passRate) },
              {
                l: "Durchfaller",
                v: `${stats.failCount}`,
                href:
                  stats.failCount > 0
                    ? ("#durchfaller" as const)
                    : undefined,
              },
            ].map((c) => {
              const body = (
                <>
                  <p className="text-muted-foreground">{c.l}</p>
                  <p className="text-lg font-semibold tabular-nums">{c.v}</p>
                </>
              );
              const shell =
                "min-w-[7rem] flex-1 rounded-xl border bg-card px-3 py-2 text-sm sm:max-w-[10rem]";
              if ("href" in c && c.href) {
                return (
                  <a
                    key={c.l}
                    href={c.href}
                    className={cn(
                      shell,
                      "transition-colors hover:border-rose-300 hover:bg-rose-50/60 dark:hover:border-rose-800 dark:hover:bg-rose-950/30"
                    )}
                    onClick={() => setShowFailerPanel(true)}
                  >
                    {body}
                  </a>
                );
              }
              return (
                <div key={c.l} className={shell}>
                  {body}
                </div>
              );
            })}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-xs text-muted-foreground">Notenspiegel</span>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!notenspiegelReady || spiegelBusy != null}
                title={
                  !backupOk
                    ? "Zuerst Projektsicherung"
                    : gradingLocked
                      ? "Zuerst alle Aufgaben bewerten"
                      : stats.graded <= 0
                        ? "Noch keine Noten"
                        : "Notenspiegel als PDF"
                }
                onClick={() =>
                  runNotenspiegel("pdf", () =>
                    exportNotenspiegelPdf(project, rows, stats)
                  )
                }
              >
                <FileText className="size-3.5" />
                {spiegelBusy === "pdf" ? "…" : "PDF"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!notenspiegelReady || spiegelBusy != null}
                title={
                  !backupOk
                    ? "Zuerst Projektsicherung"
                    : gradingLocked
                      ? "Zuerst alle Aufgaben bewerten"
                      : stats.graded <= 0
                        ? "Noch keine Noten"
                        : "Notenspiegel als Excel"
                }
                onClick={() =>
                  runNotenspiegel("xlsx", () =>
                    exportNotenspiegelExcel(project, rows, stats)
                  )
                }
              >
                <FileSpreadsheet className="size-3.5" />
                {spiegelBusy === "xlsx" ? "…" : "Excel"}
              </Button>
            </div>
            {spiegelMsg && (
              <p className="max-w-[16rem] text-right text-xs text-muted-foreground">
                {spiegelMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {impactVs40 && (
        <Card className="surface-panel border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Szenario-Effekt: {impactVs40.scenarioA.name.replace(" (Standard)", "")}{" "}
              → {impactVs40.scenarioB.name.replace(" (Standard)", "")}
            </CardTitle>
            <CardDescription>
              Positiv = bessere Note (kleinere Zahl) beim Wechsel von aktivem
              Szenario zum Vergleich. Details unter Notenszenarien.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-lg bg-emerald-100 px-2 py-1 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">
              besser: {impactVs40.improved}
            </span>
            <span className="rounded-lg bg-rose-100 px-2 py-1 text-rose-900 dark:bg-rose-950 dark:text-rose-100">
              schlechter: {impactVs40.worsened}
            </span>
            <span className="rounded-lg border px-2 py-1">
              unverändert: {impactVs40.unchanged}
            </span>
            <span className="rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-950/40">
              neu bestanden: {impactVs40.newlyPassed}
            </span>
            <span className="rounded-lg bg-rose-50 px-2 py-1 dark:bg-rose-950/40">
              neu durchgefallen: {impactVs40.newlyFailed}
            </span>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3">
        <div className="grid gap-1">
          <Label className="text-xs">
            Grenzfälle (bis nächste Note, {unitLabelShort})
          </Label>
          <Select
            value={borderlineFilter}
            onValueChange={(v) =>
              v && setBorderlineFilter(v as BorderlineFilter)
            }
          >
            <SelectTrigger className="w-52">
              <SelectValue>
                {borderlineFilter === "off"
                  ? `Markierung ≤ ${String(defaultBl).replace(".", ",")} ${unitLabelShort}`
                  : borderlineFilter === "custom"
                    ? `≤ ${String(borderlineCustom ?? defaultBl).replace(".", ",")} ${unitLabelShort}`
                    : `≤ ${String(borderlineFilter).replace(".", ",")} ${unitLabelShort}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">
                Standard (≤ {String(defaultBl).replace(".", ",")}{" "}
                {unitLabelShort})
              </SelectItem>
              {nextGradeUnit === "grade" ? (
                <>
                  <SelectItem value="0.05">≤ 0,05 Notengrade</SelectItem>
                  <SelectItem value="0.1">≤ 0,1 Notengrade</SelectItem>
                  <SelectItem value="0.15">≤ 0,15 Notengrade</SelectItem>
                </>
              ) : (
                <>
                  <SelectItem value="0.5">≤ 0,5 Punkte</SelectItem>
                  <SelectItem value="1">≤ 1,0 Punkte</SelectItem>
                  <SelectItem value="2">≤ 2,0 Punkte</SelectItem>
                  <SelectItem value="3">≤ 3,0 Punkte</SelectItem>
                </>
              )}
              <SelectItem value="custom">Benutzerdefiniert…</SelectItem>
            </SelectContent>
          </Select>
          <p className="max-w-xs text-[10px] text-muted-foreground">
            Markierung: Abstand zur nächsten Note ≤ Schwelle
            {nextGradeUnit === "grade"
              ? " (Notengrade, z. B. 0,1)."
              : " (Schema-Punkte)."}
          </p>
        </div>
        {borderlineFilter === "custom" && (
          <div className="grid gap-1">
            <Label className="text-xs">
              Max. Abstand ({unitLabelShort})
            </Label>
            <Input
              type="number"
              step={nextGradeUnit === "grade" ? "0.05" : "0.1"}
              min={0}
              className="w-24"
              value={borderlineCustom ?? defaultBl}
              onChange={(e) =>
                setBorderlineCustom(Number(e.target.value) || 0)
              }
            />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={failersOnly}
            onChange={(e) => setFailersOnly(e.target.checked)}
          />
          Nur Durchfaller
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={noShowOnly}
            onChange={(e) => setNoShowOnly(e.target.checked)}
          />
          Nur No-Shows
        </label>
        <label className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
          <input
            type="checkbox"
            className="size-4"
            checked={orphanOnly}
            onChange={(e) => setOrphanOnly(e.target.checked)}
          />
          Antritt ohne HIS
        </label>
        {failerAnalysis.count > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFailerPanel((v) => !v)}
            aria-expanded={showFailerPanel}
            aria-controls="durchfaller"
          >
            {showFailerPanel
              ? "Durchfaller-Analyse ausblenden"
              : "Durchfaller-Analyse (intern)"}
          </Button>
        )}
        <div className="ml-auto flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 shrink-0 rounded border border-amber-400/60 bg-amber-50 dark:border-yellow-500/50 dark:bg-yellow-950"
              aria-hidden
            />
            Grenzfall
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 shrink-0 rounded border border-rose-300/70 bg-rose-100 dark:border-rose-500/50 dark:bg-rose-950"
              aria-hidden
            />
            Durchfaller
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="size-3 shrink-0 rounded border border-orange-300/70 bg-orange-50 dark:border-orange-500/50 dark:bg-orange-950"
              aria-hidden
            />
            No-Show
          </span>
        </div>
      </div>

      {failerAnalysis.count > 0 && (
        <Card
          id="durchfaller"
          className={cn(
            "border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20",
            SECTION_SCROLL_MT
          )}
        >
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div className="min-w-0 space-y-1">
              <CardTitle className="text-base">
                Durchfaller-Analyse (nur Prüfer)
              </CardTitle>
              <CardDescription>
                Interne Auswertung – keine Weitergabe an Studierende, kein
                E-Mail-Versand. Anzahl:{" "}
                <strong className="text-foreground tabular-nums">
                  {failerAnalysis.count}
                </strong>
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => setShowFailerPanel((v) => !v)}
              aria-expanded={showFailerPanel}
            >
              {showFailerPanel ? "Details einklappen" : "Details anzeigen"}
            </Button>
          </CardHeader>
          {showFailerPanel && (
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-4 text-sm">
                <span>
                  Anzahl: <strong>{failerAnalysis.count}</strong>
                </span>
                <span>
                  Ø Punkte:{" "}
                  <strong>{formatPoints(failerAnalysis.averagePoints)}</strong>
                </span>
                <span>
                  Median:{" "}
                  <strong>{formatPoints(failerAnalysis.medianPoints)}</strong>
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Nahe Bestehensgrenze (fehlende Punkte):
              </p>
              <div className="flex flex-wrap gap-2 text-sm">
                {failerAnalysis.nearPass.map((n) => (
                  <span
                    key={n.within}
                    className="rounded-md border bg-background px-2 py-1"
                  >
                    ≤ {formatPoints(n.within)}: <strong>{n.count}</strong>
                  </span>
                ))}
              </div>
              {failerAnalysis.rows.length > 0 && (
                <div className="max-h-48 overflow-auto rounded-lg border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Matr.</TableHead>
                        <TableHead>Punkte</TableHead>
                        <TableHead>bis Bestehen</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failerAnalysis.rows.map((r) => (
                        <TableRow key={r.key}>
                          <TableCell>
                            {r.student.lastName}, {r.student.firstName}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {r.key}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatPoints(r.totalPoints)}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatPoints(r.pointsBelowPass)}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {formatGrade(r.finalGrade)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {project && supportsStudentGroups(project.examType) && (
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Gruppe wählen</CardTitle>
            <CardDescription>
              {isStaManualExam(project.examType)
                ? "Noten für eine Gruppe eintragen und mit den Schaltflächen wechseln."
                : "Tabelle auf eine Arbeitsgruppe einschränken."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <GroupFilterBar
              project={project}
              rows={rows}
              value={groupFilter}
              onChange={setGroupFilter}
            />
          </CardContent>
        </Card>
      )}

      <div id="notenliste" className={SECTION_SCROLL_MT}>
      <StudentsTable
        rows={
          project && supportsStudentGroups(project.examType)
            ? filterRowsByGroup(rows, groupFilter)
            : rows
        }
        onEditGrade={openEdit}
        showNextGrade
        borderlineFilter={borderlineFilter}
        borderlineCustom={borderlineCustom ?? defaultBl}
        failersOnly={failersOnly}
        noShowOnly={noShowOnly}
        orphanOnly={orphanOnly}
        highlightBorderlineMax={highlightMax}
        subAreaNames={
          project.subAreas.length > 1
            ? Object.fromEntries(
                project.subAreas.map((sa) => [sa.id, sa.code || sa.name])
              )
            : {}
        }
        portfolioComponents={
          project.examType === "portfolio"
            ? (project.portfolioComponents ?? []).map((c) => ({
                id: c.id,
                code: c.code || c.name,
                name: c.name,
              }))
            : []
        }
        assessmentHrefForRow={
          isPortfolioExam(project.examType) ||
          isStaCriteriaExam(project.examType)
            ? (r) => {
                const params = new URLSearchParams();
                params.set("mat", r.key);
                if (r.student.groupId) {
                  params.set("group", r.student.groupId);
                } else if (supportsStudentGroups(project.examType)) {
                  params.set("group", "none");
                }
                return `/exam/${id}/assessment?${params.toString()}`;
              }
            : undefined
        }
      />
      </div>

      <Dialog open={!!editKey} onOpenChange={(o) => !o && setEditKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Note bearbeiten</DialogTitle>
            <DialogDescription>
              {editRow
                ? `${editRow.student.lastName}, ${editRow.student.firstName} (${editRow.key})`
                : ""}
              {editRow?.calculatedGrade != null && (
                <> · berechnet: {formatGrade(editRow.calculatedGrade)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Note (Override)</Label>
              <Select
                value={gradeValue}
                onValueChange={(v) => v && setGradeValue(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Note wählen">
                    {gradeValue
                      ? formatGrade(Number(gradeValue))
                      : "Note wählen"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {GERMAN_GRADES.map((g) => (
                    <SelectItem key={g} value={String(g)}>
                      {formatGrade(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                step="0.1"
                min={1}
                max={5}
                value={gradeValue}
                onChange={(e) => setGradeValue(e.target.value)}
                placeholder="oder manuell eingeben"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="comment">Begründung / Kommentar</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="z. B. Nachkorrektur…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button type="button" variant="outline" onClick={clearOverride}>
              Override entfernen
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditKey(null)}
              >
                Abbrechen
              </Button>
              <Button type="button" onClick={saveOverride}>
                Speichern
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
