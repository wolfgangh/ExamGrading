"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExamStatistics } from "@/lib/types";
import { formatGrade } from "@/lib/utils";
import {
  ChartTooltip,
  chartTooltipCursor,
} from "@/components/charts/chart-tooltip";

const SERIES_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export type ScenarioSeriesMeta = {
  /** Stable key used as dataKey in the chart */
  key: string;
  /** Short label for legend / tooltip */
  label: string;
};

export type ScenarioDistributionSeries = ScenarioSeriesMeta & {
  stats: ExamStatistics;
};

export type ScenarioBucketSeries = ScenarioSeriesMeta & {
  buckets: { name: string; count: number; share: number }[];
};

export function shortScenarioLabel(name: string, passThreshold: number): string {
  const cleaned = name
    .replace(" (Standard)", "")
    .replace(" (frei)", "")
    .trim();
  if (/^\d+(\.\d+)?$/.test(cleaned) || cleaned.includes("Pkt")) {
    return `${passThreshold} Pkt.`;
  }
  // "Szenario 45" → "45 Pkt." is clearer in charts
  if (/^Szenario\s+/i.test(cleaned)) {
    return `${passThreshold} Pkt.`;
  }
  return `${cleaned} (${passThreshold})`;
}

export function GradeDistributionChart({
  stats,
  mode = "count",
}: {
  stats: ExamStatistics;
  mode?: "count" | "share";
}) {
  const total = stats.gradeDistribution.reduce((s, g) => s + g.count, 0) || 1;
  const data = stats.gradeDistribution.map((g) => {
    const share = g.count / total;
    return {
      name: formatGrade(g.grade),
      count: g.count,
      sharePct: Math.round(share * 1000) / 10,
      label: `${g.count} (${Math.round(share * 100)} %)`,
    };
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 24, right: 8, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            domain={mode === "share" ? [0, 100] : undefined}
            unit={mode === "share" ? " %" : undefined}
          />
          <Tooltip
            cursor={chartTooltipCursor}
            content={
              <ChartTooltip
                labelFormatter={(l) => `Note ${l}`}
                formatter={(value, name) => {
                  if (name === "sharePct") return [`${value} %`, "Anteil"];
                  return [value ?? 0, "Anzahl"];
                }}
              />
            }
          />
          <Bar
            dataKey={mode === "share" ? "sharePct" : "count"}
            fill="var(--color-chart-1)"
            radius={[4, 4, 0, 0]}
          >
            <LabelList
              dataKey="label"
              position="top"
              className="fill-foreground text-[10px]"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gruppierte Notenverteilung: alle sichtbaren Szenarien nebeneinander */
export function ScenarioGradeDistributionChart({
  series,
  mode = "count",
}: {
  series: ScenarioDistributionSeries[];
  mode?: "count" | "share";
}) {
  if (series.length === 0) return null;

  // Single scenario → reuse simple chart
  if (series.length === 1) {
    return <GradeDistributionChart stats={series[0].stats} mode={mode} />;
  }

  const grades = series[0].stats.gradeDistribution.map((g) => g.grade);
  const data = grades.map((grade) => {
    const row: Record<string, string | number> = {
      name: formatGrade(grade),
    };
    for (const s of series) {
      const entry = s.stats.gradeDistribution.find(
        (g) => Math.abs(g.grade - grade) < 0.05
      );
      const count = entry?.count ?? 0;
      const total =
        s.stats.gradeDistribution.reduce((sum, g) => sum + g.count, 0) || 1;
      if (mode === "share") {
        row[s.key] = Math.round((count / total) * 1000) / 10;
      } else {
        row[s.key] = count;
      }
    }
    return row;
  });

  return (
    <div className="h-80 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 8, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            domain={mode === "share" ? [0, "auto"] : undefined}
            unit={mode === "share" ? " %" : undefined}
          />
          <Tooltip
            cursor={chartTooltipCursor}
            content={
              <ChartTooltip
                labelFormatter={(l) => `Note ${l}`}
                formatter={(value, name) => {
                  const label =
                    series.find((s) => s.key === name)?.label ?? String(name);
                  if (mode === "share") {
                    return [`${value ?? 0} %`, label];
                  }
                  return [value ?? 0, label];
                }}
              />
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) =>
              series.find((s) => s.key === value)?.label ?? String(value)
            }
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.key}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              radius={[3, 3, 0, 0]}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GradeBucketChart({
  buckets,
}: {
  buckets: { name: string; count: number; share: number }[];
}) {
  const data = buckets.map((b) => ({
    name: b.name,
    count: b.count,
    sharePct: Math.round(b.share * 1000) / 10,
    label: `${b.count} (${Math.round(b.share * 100)} %)`,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 24, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            cursor={chartTooltipCursor}
            content={
              <ChartTooltip
                labelFormatter={(l) => String(l)}
                formatter={(value) => [value ?? 0, "Anzahl"]}
              />
            }
          />
          <Bar dataKey="count" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="label"
              position="top"
              className="fill-foreground text-[10px]"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gruppierte Notenstufen: alle sichtbaren Szenarien nebeneinander */
export function ScenarioGradeBucketChart({
  series,
  mode = "count",
}: {
  series: ScenarioBucketSeries[];
  mode?: "count" | "share";
}) {
  if (series.length === 0) return null;

  if (series.length === 1) {
    return <GradeBucketChart buckets={series[0].buckets} />;
  }

  const bucketNames = series[0].buckets.map((b) => b.name);
  const data = bucketNames.map((name) => {
    const row: Record<string, string | number> = { name };
    for (const s of series) {
      const b = s.buckets.find((x) => x.name === name);
      if (mode === "share") {
        row[s.key] = Math.round((b?.share ?? 0) * 1000) / 10;
      } else {
        row[s.key] = b?.count ?? 0;
      }
    }
    return row;
  });

  return (
    <div className="h-72 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            unit={mode === "share" ? " %" : undefined}
          />
          <Tooltip
            cursor={chartTooltipCursor}
            content={
              <ChartTooltip
                labelFormatter={(l) => String(l)}
                formatter={(value, name) => {
                  const label =
                    series.find((s) => s.key === name)?.label ?? String(name);
                  if (mode === "share") {
                    return [`${value ?? 0} %`, label];
                  }
                  return [value ?? 0, label];
                }}
              />
            }
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(value) =>
              series.find((s) => s.key === value)?.label ?? String(value)
            }
          />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.key}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              radius={[3, 3, 0, 0]}
              maxBarSize={40}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
