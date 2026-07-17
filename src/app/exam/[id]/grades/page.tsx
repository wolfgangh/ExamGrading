"use client";

import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
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
import { formatGrade, formatPoints } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { computeFailerAnalysis } from "@/lib/grades/statistics";
import { ensureScenarios, withActiveScenario } from "@/lib/grades/scenarios";
import {
  computeGradeBuckets,
  computeScenarioImpact,
} from "@/lib/grades/scenario-impact";
import {
  GradeBucketChart,
  GradeDistributionChart,
} from "@/components/charts/grade-distribution-chart";
import { formatPercent } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
export default function GradesPage() {
  const { project, setProject, rows, stats } = useExamContext();
  const [editKey, setEditKey] = useState<string | null>(null);
  const [gradeValue, setGradeValue] = useState<string>("");
  const [comment, setComment] = useState("");
  const [borderlineFilter, setBorderlineFilter] =
    useState<BorderlineFilter>("off");
  const [borderlineCustom, setBorderlineCustom] = useState(1);
  const [failersOnly, setFailersOnly] = useState(false);
  const [noShowOnly, setNoShowOnly] = useState(false);
  const [orphanOnly, setOrphanOnly] = useState(false);
  const [showFailerPanel, setShowFailerPanel] = useState(false);

  const editRow = useMemo(
    () => rows.find((r) => r.key === editKey) ?? null,
    [rows, editKey]
  );

  const failerAnalysis = useMemo(
    () => computeFailerAnalysis(rows),
    [rows]
  );

  const scenarios = useMemo(
    () => (project ? ensureScenarios(project) : []),
    [project]
  );

  const buckets = useMemo(() => computeGradeBuckets(rows), [rows]);

  const impactVs40 = useMemo(() => {
    if (!project || scenarios.length < 2) return null;
    const a =
      scenarios.find((s) => s.id === project.activeScenarioId) ?? scenarios[0];
    const b =
      scenarios.find((s) => s.id !== a.id && !s.editable) ?? scenarios[1];
    return computeScenarioImpact(project, a.id, b.id);
  }, [project, scenarios]);

  const highlightMax =
    borderlineFilter === "off"
      ? 1
      : borderlineFilter === "custom"
        ? borderlineCustom
        : Number(borderlineFilter);

  if (!project) return null;

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
      const next: PointsRecord = {
        ...base,
        gradeOverride,
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

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Szenario:</span>
        {scenarios.map((sc) => (
          <Button
            key={sc.id}
            size="sm"
            variant={
              sc.id === project.activeScenarioId ? "default" : "outline"
            }
            onClick={() =>
              setProject((prev) => withActiveScenario(prev, sc.id))
            }
          >
            {sc.passThreshold} Pkt.
          </Button>
        ))}
      </div>

      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="surface-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                Notenverteilung (Anteil &amp; Anzahl)
              </CardTitle>
              <CardDescription>
                Je Note: absolute Anzahl und Anteil der bewerteten Teilnehmer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GradeDistributionChart stats={stats} mode="share" />
            </CardContent>
          </Card>
          <Card className="surface-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Notenstufen</CardTitle>
              <CardDescription>
                sehr gut … nicht ausreichend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <GradeBucketChart buckets={buckets} />
            </CardContent>
          </Card>
        </div>
      )}

      {stats && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              l: "Bewertet",
              v: String(stats.graded),
            },
            {
              l: "Ø Note",
              v: formatGrade(stats.averageGrade),
            },
            {
              l: "Bestehen",
              v: formatPercent(stats.passRate),
            },
            {
              l: "Durchfaller",
              v: `${stats.failCount}`,
            },
          ].map((c) => (
            <div
              key={c.l}
              className="rounded-xl border bg-card px-3 py-2 text-sm"
            >
              <p className="text-muted-foreground">{c.l}</p>
              <p className="text-lg font-semibold tabular-nums">{c.v}</p>
            </div>
          ))}
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
          <Label className="text-xs">Grenzfälle (bis nächste Note)</Label>
          <Select
            value={borderlineFilter}
            onValueChange={(v) =>
              v && setBorderlineFilter(v as BorderlineFilter)
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue>
                {borderlineFilter === "off"
                  ? "Filter aus"
                  : borderlineFilter === "custom"
                    ? `≤ ${borderlineCustom}`
                    : `≤ ${borderlineFilter} Pkt.`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="off">Filter aus</SelectItem>
              <SelectItem value="0.5">≤ 0,5 Punkte</SelectItem>
              <SelectItem value="1">≤ 1,0 Punkte</SelectItem>
              <SelectItem value="1.5">≤ 1,5 Punkte</SelectItem>
              <SelectItem value="2">≤ 2,0 Punkte</SelectItem>
              <SelectItem value="custom">Benutzerdefiniert…</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {borderlineFilter === "custom" && (
          <div className="grid gap-1">
            <Label className="text-xs">Max. fehlende Punkte</Label>
            <Input
              type="number"
              step="0.1"
              min={0}
              className="w-24"
              value={borderlineCustom}
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
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowFailerPanel((v) => !v)}
        >
          Durchfaller-Analyse (intern)
        </Button>
        <div className="ml-auto flex gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-3 rounded bg-amber-200" /> Grenzfall
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-3 rounded bg-rose-200" /> Durchfaller
          </span>
        </div>
      </div>

      {showFailerPanel && (
        <Card className="border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20">
          <CardHeader>
            <CardTitle className="text-base">
              Durchfaller-Analyse (nur Prüfer)
            </CardTitle>
            <CardDescription>
              Interne Auswertung – keine Weitergabe an Studierende, kein
              E-Mail-Versand.
            </CardDescription>
          </CardHeader>
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
        </Card>
      )}

      <StudentsTable
        rows={rows}
        onEditGrade={openEdit}
        showNextGrade
        borderlineFilter={borderlineFilter}
        borderlineCustom={borderlineCustom}
        failersOnly={failersOnly}
        noShowOnly={noShowOnly}
        orphanOnly={orphanOnly}
        highlightBorderlineMax={highlightMax}
      />

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
