"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ExamStatistics } from "@/lib/types";
import { formatGrade } from "@/lib/utils";

export function GradeDistributionChart({
  stats,
}: {
  stats: ExamStatistics;
}) {
  const data = stats.gradeDistribution.map((g) => ({
    name: formatGrade(g.grade),
    count: g.count,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => [value ?? 0, "Anzahl"]}
            labelFormatter={(l) => `Note ${l}`}
          />
          <Bar dataKey="count" fill="var(--color-chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
