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
import { calculateGrade } from "@/lib/grades/schema";
import { computeEffectiveTotal } from "@/lib/grades/points-total";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import {
  formatPValue,
  linearRegression,
} from "@/lib/grades/linear-regression";
import {
  gradeBucketForGrade,
  GRADE_BUCKET_COLORS,
  type GradeBucketKey,
} from "@/lib/grades/notenspiegel";
import { formatDurationMinutes } from "@/lib/excel/parse-duration";
import { formatPoints, formatStat } from "@/lib/utils";
import { ExpandableChart } from "@/components/charts/expandable-chart";
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

type YMode = "points" | "percent";

type ScatterPoint = {
  /** Dauer in Minuten */
  x: number;
  /** Y-Wert (Punkte oder % von max) */
  y: number;
  totalPoints: number;
  name: string;
  lastName: string;
  firstName: string;
  matnr: string;
  programCode: string;
  grade: number;
  gradeLabel: string;
  bucket: GradeBucketKey;
  color: string;
  kind: "student";
};

function isStudentPoint(p: unknown): p is ScatterPoint {
  return (
    !!p &&
    typeof p === "object" &&
    (p as ScatterPoint).kind === "student" &&
    typeof (p as ScatterPoint).matnr === "string"
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

export function DurationPointsScatterCard({
  project,
}: {
  project: ExamProject;
}) {
  const online = isOnlineStyleExam(project.examType);
  const [yMode, setYMode] = useState<YMode>("points");
  const chartAreaRef = useRef<HTMLDivElement>(null);
  const maxPoints = Math.max(1, project.gradeSchema.maxPoints || 1);

  const { points, regression, lineData, nWithDuration } = useMemo(() => {
    if (!online) {
      return {
        points: [] as ScatterPoint[],
        regression: null,
        lineData: [] as { x: number; yHat: number }[],
        nWithDuration: 0,
      };
    }
    const pts: ScatterPoint[] = [];
    for (const rec of project.points ?? []) {
      const dur = rec.processingDurationMinutes;
      const total = computeEffectiveTotal(rec);
      if (dur == null || !Number.isFinite(dur) || dur <= 0) continue;
      if (total == null || !Number.isFinite(total)) continue;
      const grade =
        rec.gradeOverride != null && Number.isFinite(rec.gradeOverride)
          ? rec.gradeOverride
          : calculateGrade(total, project.gradeSchema);
      const bucket = gradeBucketForGrade(grade);
      const key =
        normalizeMatriculation(rec.matriculationNumber) ??
        rec.matriculationNumber;
      const st = project.students[key] ?? null;
      const lastName = st?.lastName?.trim() || "";
      const firstName = st?.firstName?.trim() || "";
      const name =
        lastName || firstName
          ? `${lastName}${lastName && firstName ? ", " : ""}${firstName}`
          : key;
      let programCode = "";
      for (const src of project.hisSources ?? []) {
        const row = src.rows?.find(
          (hr) =>
            normalizeMatriculation(hr.matriculationNumber) === key
        );
        if (row && src.programCode) {
          programCode = src.programCode;
          break;
        }
      }
      if (!programCode) {
        const his = project.hisRows?.find(
          (hr) => normalizeMatriculation(hr.matriculationNumber) === key
        );
        programCode = his?.sourceId
          ? project.hisSources?.find((s) => s.id === his.sourceId)
              ?.programCode ?? ""
          : "";
      }
      const y =
        yMode === "percent"
          ? Math.round((total / maxPoints) * 1000) / 10
          : total;
      pts.push({
        x: dur,
        y,
        totalPoints: total,
        name,
        lastName,
        firstName,
        matnr: key,
        programCode: programCode || rec.manualProgramCode?.trim() || "",
        grade,
        gradeLabel: grade.toFixed(1).replace(".", ","),
        bucket,
        color: GRADE_BUCKET_COLORS[bucket],
        kind: "student",
      });
    }
    const reg = linearRegression(
      pts.map((p) => p.x),
      pts.map((p) => p.y)
    );
    let line: { x: number; yHat: number }[] = [];
    if (reg && pts.length >= 2) {
      const xs = pts.map((p) => p.x);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      line = [
        { x: minX, yHat: reg.predict(minX) },
        { x: maxX, yHat: reg.predict(maxX) },
      ];
    }
    return {
      points: pts,
      regression: reg,
      lineData: line,
      nWithDuration: pts.length,
    };
  }, [project, online, yMode, maxPoints]);

  if (!online) return null;

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

  const yAxisLabel =
    yMode === "percent" ? `% von max. (${maxPoints} Pkt.)` : "Punkte";
  const slopeUnit = yMode === "percent" ? "%/min" : "Pkte/min";
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
          chartClassName="h-[min(58vh,480px)]"
        >
          <div
            ref={chartAreaRef}
            className="relative h-80 w-full min-w-0 overflow-hidden"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
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
                  tick={{ fontSize: TICK_FS }}
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
                  domain={
                    yMode === "percent"
                      ? [0, (dataMax: number) => Math.max(100, dataMax)]
                      : ["auto", "auto"]
                  }
                  tick={{ fontSize: TICK_FS }}
                  tickFormatter={(v) =>
                    yMode === "percent"
                      ? `${v}`
                      : String(v).replace(".", ",")
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
                  // im Chart-Bereich halten (kein Überlauf rechts)
                  allowEscapeViewBox={{ x: false, y: true }}
                  offset={14}
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

                    // Bei Hover rechts: Tooltip nach links spiegeln
                    const chartW = chartAreaRef.current?.clientWidth ?? 400;
                    const cx = coordinate?.x ?? 0;
                    const flipLeft = cx > chartW * 0.52;

                    if (student) {
                      return (
                        <div
                          className="rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md"
                          style={{
                            maxWidth: "min(18rem, 70vw)",
                            transform: flipLeft
                              ? "translateX(calc(-100% - 8px))"
                              : "translateX(0)",
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
                          style={{
                            transform: flipLeft
                              ? "translateX(calc(-100% - 8px))"
                              : undefined,
                          }}
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
                  name="Teilnehmer"
                  data={points}
                  isAnimationActive={false}
                  fillOpacity={0.9}
                >
                  {points.map((p, i) => (
                    <Cell
                      key={`${p.matnr}-${i}`}
                      fill={p.color}
                      stroke="var(--color-background)"
                      strokeWidth={1}
                    />
                  ))}
                </Scatter>
                {lineData.length === 2 && (
                  <Line
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
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <p className="font-medium">
              Lineare Regression:{" "}
              {yMode === "percent" ? "%-Anteil" : "Punkte"} = a + b · Dauer
            </p>
            <ul className="mt-1 grid gap-0.5 text-xs sm:grid-cols-2">
              <li>
                a (Achsenabschnitt) ={" "}
                <span className="tabular-nums font-medium">
                  {formatStat(regression.intercept, 3)}
                  {yMode === "percent" ? " %" : ""}
                </span>
              </li>
              <li>
                b (Steigung, {slopeUnit}) ={" "}
                <span className="tabular-nums font-medium">
                  {formatStat(regression.slope, 4)}
                </span>
              </li>
              <li>
                R² ={" "}
                <span className="tabular-nums font-medium">
                  {formatStat(regression.rSquared, 3)}
                </span>
              </li>
              <li>
                r (Pearson) ={" "}
                <span className="tabular-nums font-medium">
                  {formatStat(regression.r, 3)}
                </span>
              </li>
              <li>
                t (Steigung) ={" "}
                <span className="tabular-nums font-medium">
                  {formatStat(regression.tStat, 3)}
                </span>{" "}
                (df = {regression.df})
              </li>
              <li>
                p-Wert (zweiseitig, Steigung) ={" "}
                <span className="tabular-nums font-medium">
                  {formatPValue(regression.pValue)}
                </span>
              </li>
              <li className="sm:col-span-2 text-muted-foreground">
                n = {regression.n} · SE(b) ={" "}
                {formatStat(regression.seSlope, 4)}
              </li>
            </ul>
          </div>
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
