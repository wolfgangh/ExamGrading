"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScenarioImpact } from "@/lib/grades/scenario-impact";
import {
  ChartTooltip,
  chartTooltipCursor,
} from "@/components/charts/chart-tooltip";
/** Theme-aware fills (readable in light + night) */
const COLORS = {
  better: "var(--chart-2, #059669)",
  worse: "var(--destructive, #e11d48)",
  same: "var(--muted-foreground, #64748b)",
  pass: "var(--chart-2, #10b981)",
  fail: "var(--chart-5, #f43f5e)",
};

export function ScenarioImpactPanel({ impact }: { impact: ScenarioImpact }) {
  const barData = [
    { name: "besser", count: impact.improved, fill: COLORS.better },
    { name: "unverändert", count: impact.unchanged, fill: COLORS.same },
    { name: "schlechter", count: impact.worsened, fill: COLORS.worse },
  ];
  const passData = [
    { name: "neu bestanden", count: impact.newlyPassed, fill: COLORS.pass },
    {
      name: "neu durchgefallen",
      count: impact.newlyFailed,
      fill: COLORS.fail,
    },
  ];

  const aName = impact.scenarioA.name
    .replace(" (Standard)", "")
    .replace(" (frei)", "");
  const bName = impact.scenarioB.name
    .replace(" (Standard)", "")
    .replace(" (frei)", "");

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Vergleich{" "}
        <span className="font-medium text-foreground">{aName}</span>
        {" → "}
        <span className="font-medium text-foreground">{bName}</span>
        {" · Bestehen "}
        {impact.scenarioA.passThreshold} / {impact.scenarioB.passThreshold}{" "}
        Pkt.
      </p>

      <div className="flex flex-wrap gap-2 text-sm">
        <span className="rounded-lg bg-emerald-100 px-2 py-1 dark:bg-emerald-900/60 dark:text-emerald-50">
          besser: <strong>{impact.improved}</strong>
        </span>
        <span className="rounded-lg bg-rose-100 px-2 py-1 dark:bg-rose-900/60 dark:text-rose-50">
          schlechter: <strong>{impact.worsened}</strong>
        </span>
        <span className="rounded-lg border px-2 py-1">
          unverändert: <strong>{impact.unchanged}</strong>
        </span>
        <span className="rounded-lg bg-emerald-50 px-2 py-1 dark:bg-emerald-950/50">
          neu bestanden: <strong>{impact.newlyPassed}</strong>
        </span>
        <span className="rounded-lg bg-rose-50 px-2 py-1 dark:bg-rose-950/50">
          neu durchgefallen: <strong>{impact.newlyFailed}</strong>
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="h-40 w-full min-w-0">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Notenänderung (Anzahl Personen)
          </p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 4, right: 12, left: 8, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                cursor={chartTooltipCursor}
                content={
                  <ChartTooltip
                    formatter={(v) => [v ?? 0, "Personen"]}
                  />
                }
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {barData.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-40 w-full min-w-0">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Bestehen gewechselt
          </p>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart
              data={passData}
              margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip
                cursor={chartTooltipCursor}
                content={
                  <ChartTooltip
                    formatter={(v) => [v ?? 0, "Personen"]}
                  />
                }
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {passData.map((d) => (
                  <Cell key={d.name} fill={d.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Szenario A ab {impact.scenarioA.passThreshold} Pkt., B ab{" "}
        {impact.scenarioB.passThreshold} Pkt. (Note ≤ 4,0 = bestanden).
      </p>
    </div>
  );
}
