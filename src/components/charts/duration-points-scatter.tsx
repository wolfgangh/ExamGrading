"use client";

import { useMemo } from "react";
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
import { chartTooltipCursor } from "@/components/charts/chart-tooltip";

type ScatterPoint = {
  x: number;
  y: number;
  name: string;
  grade: number;
  bucket: GradeBucketKey;
  color: string;
};

const BUCKET_ORDER: GradeBucketKey[] = [
  "sehr gut",
  "gut",
  "befriedigend",
  "ausreichend",
  "nicht ausreichend",
];

export function DurationPointsScatterCard({
  project,
}: {
  project: ExamProject;
}) {
  if (!isOnlineStyleExam(project.examType)) return null;

  const { points, regression, lineData, nWithDuration } = useMemo(() => {
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
      const name = st
        ? `${st.lastName}, ${st.firstName}`
        : rec.matriculationNumber;
      pts.push({
        x: dur,
        y: total,
        name,
        grade,
        bucket,
        color: GRADE_BUCKET_COLORS[bucket],
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
  }, [project]);

  if (nWithDuration === 0) {
    return (
      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Bearbeitungsdauer und Punkte
          </CardTitle>
          <CardDescription>
            Keine Bearbeitungsdauer in den Punktedaten. Beim THE-/Moodle-Import
            die Spalte „Bearbeitungsdauer“ mit importieren (unter Importe →
            Punkte aktualisieren).
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const fileBase = `ExamGrade_${project.name || "Pruefung"}_Dauer_Punkte`;

  return (
    <Card className="surface-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Bearbeitungsdauer und Punkte
        </CardTitle>
        <CardDescription>
          Scatterplot: Dauer (x) → Punkte (y), Farbe = Notenstufe. n ={" "}
          {nWithDuration}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ExpandableChart
          title="Bearbeitungsdauer und Punkte"
          description="Regression Dauer → Punkte · Farbe nach Notenstufe"
          filenameBase={fileBase}
          chartClassName="h-[min(58vh,480px)]"
        >
          <div className="h-80 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                margin={{ top: 12, right: 16, left: 4, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Dauer"
                  unit=" min"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "Bearbeitungsdauer (min)",
                    position: "insideBottom",
                    offset: -2,
                    style: { fontSize: 11 },
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Punkte"
                  tick={{ fontSize: 11 }}
                  label={{
                    value: "Punkte",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: 11 },
                  }}
                />
                <Tooltip
                  cursor={chartTooltipCursor}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0]?.payload as ScatterPoint | undefined;
                    if (!p || p.name == null) {
                      // regression line hover
                      const linePt = payload[0]?.payload as {
                        x?: number;
                        yHat?: number;
                      };
                      if (linePt?.yHat != null) {
                        return (
                          <div className="rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md">
                            Regression:{" "}
                            {formatDurationMinutes(linePt.x ?? null)} →{" "}
                            {formatPoints(linePt.yHat)}
                          </div>
                        );
                      }
                      return null;
                    }
                    return (
                      <div className="rounded-md border bg-popover px-2 py-1.5 text-xs shadow-md">
                        <p className="font-medium">{p.name}</p>
                        <p>
                          Dauer: {formatDurationMinutes(p.x)} · Punkte:{" "}
                          {formatPoints(p.y)} · Note:{" "}
                          {p.grade.toFixed(1).replace(".", ",")}
                        </p>
                        <p className="text-muted-foreground">{p.bucket}</p>
                      </div>
                    );
                  }}
                />
                <Scatter name="Teilnehmer" data={points} isAnimationActive={false}>
                  {points.map((p, i) => (
                    <Cell key={i} fill={p.color} />
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
                    isAnimationActive={false}
                    legendType="line"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
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
              Lineare Regression: Punkte = a + b · Dauer
            </p>
            <ul className="mt-1 grid gap-0.5 text-xs sm:grid-cols-2">
              <li>
                a (Achsenabschnitt) ={" "}
                <span className="tabular-nums font-medium">
                  {formatStat(regression.intercept, 3)}
                </span>
              </li>
              <li>
                b (Steigung, Pkte/min) ={" "}
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
