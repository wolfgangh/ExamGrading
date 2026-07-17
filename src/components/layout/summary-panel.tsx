"use client";

import type { ExamStatistics } from "@/lib/types";
import { formatGrade, formatPercent } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function SummaryPanel({
  stats,
  compact = false,
}: {
  stats: ExamStatistics | null;
  compact?: boolean;
}) {
  if (!stats) {
    return (
      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Kennzahlen</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Noch keine Daten
        </CardContent>
      </Card>
    );
  }

  const items = [
    { label: "Anmeldungen", value: String(stats.registered) },
    { label: "Antritte", value: String(stats.attended) },
    { label: "No-Shows", value: String(stats.noShow) },
    {
      label: "No-Show-Quote",
      value: formatPercent(stats.noShowRate),
    },
    {
      label: "Ø Note",
      value: formatGrade(stats.averageGrade),
    },
    {
      label: "Bestehensquote",
      value: formatPercent(stats.passRate),
    },
    {
      label: "Unstimmigkeiten",
      value: String(stats.mismatches),
    },
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 6).map((item) => (
          <div
            key={item.label}
            className="rounded-lg border bg-card px-3 py-1.5 text-sm"
          >
            <span className="text-muted-foreground">{item.label}: </span>
            <span className="font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="surface-panel">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Kennzahlen</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-semibold tabular-nums">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
