"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExamProject } from "@/lib/types";
import { isOnlineStyleExam } from "@/lib/types";
import {
  buildDurationHistogram,
  buildDurationPointsAnalysis,
} from "@/lib/grades/duration-points-analysis";
import { formatDurationMinutes } from "@/lib/excel/parse-duration";
import { ExpandableChart } from "@/components/charts/expandable-chart";
import {
  ChartTooltip,
  chartTooltipCursor,
} from "@/components/charts/chart-tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** Skaliert mit html font-size (--app-font-size) */
const TICK_FS = "0.75rem";
const LABEL_FS = "0.8125rem";

export function DurationHistogramCard({
  project,
}: {
  project: ExamProject;
}) {
  const online = isOnlineStyleExam(project.examType);

  const { bins, n, meanMin, medianMin, minMin, maxMin } = useMemo(() => {
    if (!online) {
      return {
        bins: [] as { name: string; count: number; from: number; to: number }[],
        n: 0,
        meanMin: null as number | null,
        medianMin: null as number | null,
        minMin: null as number | null,
        maxMin: null as number | null,
      };
    }
    const analysis = buildDurationPointsAnalysis(project, "points");
    const durs = analysis.durations;
    const hist = buildDurationHistogram(durs);
    const sorted = [...durs].sort((a, b) => a - b);
    const mean =
      durs.length > 0
        ? durs.reduce((s, v) => s + v, 0) / durs.length
        : null;
    let median: number | null = null;
    if (sorted.length > 0) {
      const mid = Math.floor(sorted.length / 2);
      median =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
    }
    return {
      bins: hist.map((b) => ({
        name: b.bin,
        count: b.count,
        from: b.from,
        to: b.to,
      })),
      n: durs.length,
      meanMin: mean,
      medianMin: median,
      minMin: durs.length ? Math.min(...durs) : null,
      maxMin: durs.length ? Math.max(...durs) : null,
    };
  }, [project, online]);

  if (!online) return null;

  if (n === 0) {
    return (
      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Histogramm Bearbeitungsdauer
          </CardTitle>
          <CardDescription>
            Keine Dauer in den Punktedaten. Beim THE-/Moodle-Import die Spalte
            „Dauer“ mit importieren.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="surface-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          Histogramm Bearbeitungsdauer
        </CardTitle>
        <CardDescription>
          Verteilung der Bearbeitungszeit (Moodle „Dauer“). n = {n}
          {meanMin != null && (
            <>
              {" "}
              · Ø {formatDurationMinutes(meanMin)}
            </>
          )}
          {medianMin != null && (
            <>
              {" "}
              · Median {formatDurationMinutes(medianMin)}
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ExpandableChart
          title="Histogramm Bearbeitungsdauer"
          description={`n = ${n}`}
          filenameBase={`ExamGrade_${project.name || "Pruefung"}_Dauer_Histogramm`}
          chartClassName="h-[min(48vh,380px)]"
        >
          <div className="h-72 w-full min-w-0 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={bins}
                margin={{ top: 12, right: 16, left: 8, bottom: 28 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: TICK_FS }}
                  interval={0}
                  angle={bins.length > 8 ? -30 : 0}
                  textAnchor={bins.length > 8 ? "end" : "middle"}
                  height={bins.length > 8 ? 56 : 36}
                  label={{
                    value: "Dauer (min)",
                    position: "insideBottom",
                    offset: -16,
                    style: { fontSize: LABEL_FS },
                  }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: TICK_FS }}
                  label={{
                    value: "Anzahl",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: LABEL_FS, textAnchor: "middle" },
                  }}
                />
                <Tooltip
                  cursor={chartTooltipCursor}
                  content={
                    <ChartTooltip
                      labelFormatter={(l) => `Dauer ${l} min`}
                      formatter={(value) => [value ?? 0, "Anzahl"]}
                    />
                  }
                />
                <Bar
                  dataKey="count"
                  fill="var(--color-chart-2)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ExpandableChart>
        {(minMin != null || maxMin != null) && (
          <p className="mt-2 text-xs text-muted-foreground">
            Spanne:{" "}
            {minMin != null ? formatDurationMinutes(minMin) : "–"} –{" "}
            {maxMin != null ? formatDurationMinutes(maxMin) : "–"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
