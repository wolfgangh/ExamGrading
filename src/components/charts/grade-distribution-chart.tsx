"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExamStatistics } from "@/lib/types";
import { formatGrade } from "@/lib/utils";

export function GradeDistributionChart({
  stats,
  mode = "count",
}: {
  stats: ExamStatistics;
  /** count = absolute Anzahl; share = Anteil in % */
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
            formatter={(value, name) => {
              if (name === "sharePct") return [`${value} %`, "Anteil"];
              return [value ?? 0, "Anzahl"];
            }}
            labelFormatter={(l) => `Note ${l}`}
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
            formatter={(value) => [value ?? 0, "Anzahl"]}
            labelFormatter={(l) => String(l)}
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
