"use client";

import { useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExamProject } from "@/lib/types";
import { isOnlineStyleExam } from "@/lib/types";
import {
  buildDurationPointsAnalysis,
  type DurationScatterPoint,
  type DurationYMode,
} from "@/lib/grades/duration-points-analysis";
import { GRADE_BUCKET_COLORS, type GradeBucketKey } from "@/lib/grades/notenspiegel";
import { formatDurationMinutes } from "@/lib/excel/parse-duration";
import { formatPoints } from "@/lib/utils";
import { ExpandableChart } from "@/components/charts/expandable-chart";
import { RegressionResultsPanel } from "@/components/charts/regression-results-panel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chartTooltipCursor } from "@/components/charts/chart-tooltip";

function isStudentPoint(p: unknown): p is DurationScatterPoint {
  return (
    !!p &&
    typeof p === "object" &&
    (p as DurationScatterPoint).kind === "student" &&
    typeof (p as DurationScatterPoint).matnr === "string"
  );
}

const BUCKET_ORDER: GradeBucketKey[] = [
  "sehr gut",
  "gut",
  "befriedigend",
  "ausreichend",
  "nicht ausreichend",
];

/** Skaliert mit html font-size (--app-font-size) */
const TICK_FS = "0.75rem";
const LABEL_FS = "0.8125rem";

/** Achsen-Ticks: sauber runden, DE-Komma, keine Float-Artefakte */
function formatAxisTick(value: number, decimals: number): string {
  if (!Number.isFinite(value)) return "";
  const f = 10 ** decimals;
  const r = Math.round(value * f) / f;
  if (decimals <= 0 || Number.isInteger(r)) {
    return String(Math.round(r));
  }
  return r.toFixed(decimals).replace(".", ",");
}

export function DurationPointsScatterCard({
  project,
}: {
  project: ExamProject;
}) {
  const online = isOnlineStyleExam(project.examType);
  const [yMode, setYMode] = useState<DurationYMode>("points");
  const chartAreaRef = useRef<HTMLDivElement>(null);

  const analysis = useMemo(
    () => buildDurationPointsAnalysis(project, yMode),
    [project, yMode]
  );

  // Feste Achsen-Domains aus aktuellen Daten – verhindert, dass Recharts nach
  // Y-Modus-Wechsel Hover-Hitboxen und Skalen auseinanderlaufen.
  const { xDomain, yDomain } = useMemo(() => {
    const { points: pts, lineData: line } = analysis;
    if (pts.length === 0) {
      return {
        xDomain: [0, 1] as [number, number],
        yDomain: [0, 1] as [number, number],
      };
    }
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    for (const l of line) {
      if (Number.isFinite(l.yHat)) ys.push(l.yHat);
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const padX = (maxX - minX) * 0.05 || 1;
    const xDomain: [number, number] = [minX - padX, maxX + padX];

    if (yMode === "percent") {
      // Untergrenze am Datenbereich (mit Padding), Obergrenze fest 100 %
      // (nur bei Werten > 100 % etwas darüber skalieren)
      const padY = (maxY - minY) * 0.08 || 2;
      let yMin = minY - padY;
      if (yMin < 0) yMin = 0;
      // wenn ohnehin nah an 0, von 0 starten
      if (minY <= 5) yMin = 0;
      const yMax = maxY > 100 ? Math.ceil(maxY * 10) / 10 : 100;
      // Untergrenze nie über Obergrenze
      if (yMin >= yMax) yMin = Math.max(0, yMax - 10);
      return { xDomain, yDomain: [yMin, yMax] as [number, number] };
    }

    const padY = (maxY - minY) * 0.08 || 1;
    return {
      xDomain,
      yDomain: [
        Math.max(0, minY - padY),
        maxY + padY,
      ] as [number, number],
    };
  }, [analysis, yMode]);

  if (!online) return null;

  const {
    points,
    regression,
    lineData,
    nWithDuration,
    maxPoints,
    yAxisLabel,
    yUnitShort,
    slopeUnit,
  } = analysis;

  if (nWithDuration === 0) {
    return (
      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Bearbeitungsdauer und Punkte
          </CardTitle>
          <CardDescription>
            Keine Dauer in den Punktedaten. Beim THE-/Moodle-Import die Spalte
            „Dauer“ mit importieren (unter Importe → Punkte aktualisieren).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const fileBase = `ExamGrade_${project.name || "Pruefung"}_Dauer_${
    yMode === "percent" ? "Prozent" : "Punkte"
  }`;

  return (
    <Card className="surface-panel">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">
              Bearbeitungsdauer und Punkte
            </CardTitle>
            <CardDescription>
              Scatterplot: Dauer (x) → {yAxisLabel} (y), Farbe = Notenstufe. n
              = {nWithDuration}
            </CardDescription>
          </div>
          <div className="grid w-full gap-1 sm:w-52">
            <Label htmlFor="scatter-y-mode" className="text-xs">
              Y-Achse
            </Label>
            <Select
              value={yMode}
              onValueChange={(v) =>
                v && setYMode(v === "percent" ? "percent" : "points")
              }
            >
              <SelectTrigger id="scatter-y-mode" className="w-full">
                <SelectValue>
                  {yMode === "percent"
                    ? `% von max. (${maxPoints})`
                    : "Punkte"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="points">Punkte</SelectItem>
                <SelectItem value="percent">
                  % von max. ({maxPoints} Pkt.)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ExpandableChart
          title={`Bearbeitungsdauer und ${
            yMode === "percent" ? "Punkte (%)" : "Punkte"
          }`}
          description={`Regression Dauer → ${yAxisLabel} · Farbe nach Notenstufe`}
          filenameBase={fileBase}
          chartClassName="h-[min(58vh,520px)]"
        >
          <div
            ref={chartAreaRef}
            className="relative h-72 w-full min-w-0 overflow-hidden sm:h-80"
          >
            {/* key erzwingt Remount bei Y-Modus-Wechsel (Hover-Skala neu) */}
            <ResponsiveContainer
              key={`scatter-rc-${yMode}`}
              width="100%"
              height="100%"
            >
              <ComposedChart
                key={`scatter-chart-${yMode}`}
                margin={{ top: 12, right: 20, left: 8, bottom: 28 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Dauer"
                  domain={xDomain}
                  allowDataOverflow={false}
                  tick={{ fontSize: TICK_FS }}
                  tickFormatter={(v) =>
                    formatAxisTick(Number(v), 0)
                  }
                  label={{
                    value: "Bearbeitungsdauer (min)",
                    position: "insideBottom",
                    offset: -16,
                    style: { fontSize: LABEL_FS },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name={yMode === "percent" ? "Prozent" : "Punkte"}
                  domain={yDomain}
                  allowDataOverflow={false}
                  tick={{ fontSize: TICK_FS }}
                  tickFormatter={(v) =>
                    formatAxisTick(
                      Number(v),
                      yMode === "percent" ? 0 : 1
                    )
                  }
                  label={{
                    value: yAxisLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: LABEL_FS, textAnchor: "middle" },
                  }}
                />
                <Tooltip
                  cursor={chartTooltipCursor}
                  shared={false}
                  // im Chart halten; zusätzliches Spiegeln bei Rand-Hover
                  allowEscapeViewBox={{ x: false, y: false }}
                  offset={12}
                  wrapperStyle={{
                    zIndex: 50,
                    outline: "none",
                    pointerEvents: "none",
                    maxWidth: "min(18rem, 85%)",
                  }}
                  content={({ active, payload, coordinate }) => {
                    if (!active || !payload?.length) return null;
                    const student = payload
                      .map((item) => item.payload)
                      .find(isStudentPoint);

                    const chartW = chartAreaRef.current?.clientWidth ?? 400;
                    const chartH = chartAreaRef.current?.clientHeight ?? 320;
                    const cx = coordinate?.x ?? 0;
                    const cy = coordinate?.y ?? 0;
                    // rechts / unten: Tooltip zur freien Seite spiegeln
                    // (Student-Tooltip ist hoch → früher nach oben klappen)
                    const flipLeft = cx > chartW * 0.52;
                    const flipUp = cy > chartH * 0.42;
                    const tipTransform = `translate(${
                      flipLeft ? "calc(-100% - 8px)" : "0"
                    }, ${flipUp ? "calc(-100% - 8px)" : "0"})`;

                    if (student) {
                      return (
                        <div
                          className="rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
                          style={{
                            maxWidth: "min(18rem, 70vw)",
                            transform: tipTransform,
                          }}
                        >
                          <p className="font-semibold leading-tight text-[0.95em]">
                            {student.name}
                          </p>
                          <dl className="mt-1.5 space-y-0.5 text-[0.85em]">
                            <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">
                                Matr.-Nr.
                              </dt>
                              <dd className="font-mono tabular-nums">
                                {student.matnr}
                              </dd>
                            </div>
                            {student.programCode ? (
                              <div className="flex justify-between gap-4">
                                <dt className="text-muted-foreground">
                                  Studiengang
                                </dt>
                                <dd>{student.programCode}</dd>
                              </div>
                            ) : null}
                            <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">Dauer</dt>
                              <dd className="tabular-nums">
                                {formatDurationMinutes(student.x)}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">Punkte</dt>
                              <dd className="tabular-nums font-medium">
                                {formatPoints(student.totalPoints)}
                                {yMode === "percent" && (
                                  <span className="ml-1 text-muted-foreground font-normal">
                                    (
                                    {String(student.y).replace(".", ",")}
                                    &nbsp;%)
                                  </span>
                                )}
                              </dd>
                            </div>
                            <div className="flex justify-between gap-4">
                              <dt className="text-muted-foreground">Note</dt>
                              <dd className="tabular-nums font-semibold">
                                {student.gradeLabel}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between gap-4 pt-0.5">
                              <dt className="text-muted-foreground">Stufe</dt>
                              <dd className="inline-flex items-center gap-1.5">
                                <span
                                  className="inline-block size-2.5 rounded-full"
                                  style={{ backgroundColor: student.color }}
                                />
                                {student.bucket}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      );
                    }
                    const linePt = payload[0]?.payload as {
                      x?: number;
                      yHat?: number;
                    };
                    if (linePt?.yHat != null && linePt.x != null) {
                      return (
                        <div
                          className="rounded-md border border-border bg-popover px-2 py-1.5 text-[0.85em] text-popover-foreground shadow-md"
                          style={{ transform: tipTransform }}
                        >
                          Regression: {formatDurationMinutes(linePt.x)} →{" "}
                          {yMode === "percent"
                            ? `${String(Math.round(linePt.yHat * 10) / 10).replace(".", ",")} %`
                            : `${formatPoints(linePt.yHat)} Pkt.`}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Scatter
                  key={`scatter-pts-${yMode}`}
                  name="Teilnehmer"
                  data={points}
                  isAnimationActive={false}
                  fillOpacity={0.9}
                >
                  {points.map((p, i) => (
                    <Cell
                      key={`${yMode}-${p.matnr}-${i}`}
                      fill={p.color}
                      stroke="var(--color-background)"
                      strokeWidth={1}
                    />
                  ))}
                </Scatter>
                {lineData.length === 2 && (
                  <Line
                    key={`scatter-line-${yMode}`}
                    name="Regression"
                    data={lineData}
                    dataKey="yHat"
                    type="linear"
                    stroke="var(--color-foreground)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                    legendType="line"
                    tooltipType="none"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.75em] text-muted-foreground">
            {BUCKET_ORDER.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 rounded-full"
                  style={{ backgroundColor: GRADE_BUCKET_COLORS[b] }}
                />
                {b}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-foreground" />
              Regression
            </span>
          </div>
        </ExpandableChart>

        {regression && (
          <RegressionResultsPanel
            regression={regression}
            yMode={yMode}
            yUnitShort={yUnitShort}
            slopeUnit={slopeUnit}
            maxPoints={maxPoints}
          />
        )}
        {!regression && nWithDuration >= 1 && (
          <p className="text-xs text-muted-foreground">
            Für die Regression werden mindestens 3 Personen mit Dauer und
            Punkten benötigt.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
