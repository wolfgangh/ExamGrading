"use client";

import { useMemo, useState } from "react";
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
import { formatPercent } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { cn, formatGrade } from "@/lib/utils";
import { Check } from "lucide-react";
import { computeScenarioImpact } from "@/lib/grades/scenario-impact";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function ScenariosPage() {
  const { project, setProject } = useExamContext();
  const [editPass, setEditPass] = useState<string | null>(null);
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [onlyChanged, setOnlyChanged] = useState(true);

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

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">
          Notenszenarien
        </h1>
        <p className="text-muted-foreground">
          Vergleich der Bestehensgrenzen. Das aktive Szenario steuert Noten,
          Export und Grenzfälle. Nur intern – keine Studierenden-Kommunikation.
        </p>
      </div>

      {/* Aktive Schwellen + Szenario-Wahl kompakt */}
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
                      value={editPass ?? editable.passThreshold}
                      onChange={(e) => setEditPass(e.target.value)}
                    />
                    <span className="text-xs text-muted-foreground">Pkt.</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
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

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Direktvergleich</CardTitle>
          <CardDescription>
            Max. {project.gradeSchema.maxPoints} Punkte
            {scenarios.length < 2 && " · Szenario 3 aktivieren für mehr Vergleiche"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Kennzahl</TableHead>
                {comparison.map(({ scenario }) => (
                  <TableHead
                    key={scenario.id}
                    className={cn(
                      "whitespace-nowrap",
                      scenario.id === activeId && "bg-primary/10 font-semibold"
                    )}
                  >
                    {scenario.name.replace(" (Standard)", "").replace(" (frei)", "")}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Bestehensgrenze</TableCell>
                {comparison.map(({ scenario }) => (
                  <TableCell
                    key={scenario.id}
                    className={cn(
                      "tabular-nums",
                      scenario.id === activeId && "bg-primary/5"
                    )}
                  >
                    {scenario.passThreshold}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Ø Note</TableCell>
                {comparison.map(({ scenario, stats }) => (
                  <TableCell
                    key={scenario.id}
                    className={cn(
                      "tabular-nums",
                      scenario.id === activeId && "bg-primary/5"
                    )}
                  >
                    {formatGrade(stats.averageGrade)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Bestehensquote</TableCell>
                {comparison.map(({ scenario, stats }) => (
                  <TableCell
                    key={scenario.id}
                    className={cn(
                      "tabular-nums",
                      scenario.id === activeId && "bg-primary/5"
                    )}
                  >
                    {formatPercent(stats.passRate)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Durchfaller</TableCell>
                {comparison.map(({ scenario, stats }) => (
                  <TableCell
                    key={scenario.id}
                    className={cn(
                      "tabular-nums font-medium text-rose-700 dark:text-rose-300",
                      scenario.id === activeId && "bg-primary/5"
                    )}
                  >
                    {stats.failCount}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Grenzfälle (≤1 Pkt.)</TableCell>
                {comparison.map(({ scenario, stats }) => (
                  <TableCell
                    key={scenario.id}
                    className={cn(
                      "tabular-nums text-amber-800 dark:text-amber-200",
                      scenario.id === activeId && "bg-primary/5"
                    )}
                  >
                    {stats.borderlineCount}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {impact && scenarios.length >= 2 && (
        <Card className="surface-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Wer profitiert / wer verliert?
            </CardTitle>
            <CardDescription>
              Vergleich zweier Szenarien (Note kleiner = besser). Nur intern.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label className="text-xs">Von</Label>
                <Select
                  value={idA}
                  onValueChange={(v) => v && setCompareA(v)}
                >
                  <SelectTrigger className="w-44">
                    <SelectValue>
                      {scenarios.find((s) => s.id === idA)?.name.replace(
                        " (Standard)",
                        ""
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name.replace(" (Standard)", "")}
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
                  <SelectTrigger className="w-44">
                    <SelectValue>
                      {scenarios.find((s) => s.id === idB)?.name.replace(
                        " (Standard)",
                        ""
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {scenarios.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name.replace(" (Standard)", "")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={onlyChanged}
                  onChange={(e) => setOnlyChanged(e.target.checked)}
                />
                nur Änderungen
              </label>
            </div>

            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-lg bg-emerald-100 px-2 py-1 dark:bg-emerald-950">
                besser: <strong>{impact.improved}</strong>
              </span>
              <span className="rounded-lg bg-rose-100 px-2 py-1 dark:bg-rose-950">
                schlechter: <strong>{impact.worsened}</strong>
              </span>
              <span className="rounded-lg border px-2 py-1">
                unverändert: <strong>{impact.unchanged}</strong>
              </span>
              <span className="rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-950/40">
                neu bestanden: <strong>{impact.newlyPassed}</strong>
              </span>
              <span className="rounded-lg bg-rose-50 px-2 py-1 dark:bg-rose-950/40">
                neu durchgefallen: <strong>{impact.newlyFailed}</strong>
              </span>
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Matr.</TableHead>
                    <TableHead>Note A</TableHead>
                    <TableHead>Note B</TableHead>
                    <TableHead>Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {impactRows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
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
                          {r.newlyPassed && " ✓"}
                          {r.newlyFailed && " ✗"}
                        </TableCell>
                      </TableRow>
                    ))
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
