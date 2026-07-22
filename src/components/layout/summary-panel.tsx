"use client";

import type { ExamStatistics } from "@/lib/types";
import { cn, formatGrade, formatPercent, formatStat } from "@/lib/utils";
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

  const items: {
    label: string;
    value: string;
    warn?: boolean;
  }[] = [
    { label: "Anmeldungen (HIS)", value: String(stats.registered) },
    {
      label: "Antritte gematcht",
      value: String(stats.attended),
    },
    {
      label: "Antritte (Moodle)",
      value: String(stats.attendanceImported),
    },
    {
      label: "Antritt ohne HIS",
      value: String(stats.attendedOrphan),
      warn: stats.attendedOrphan > 0,
    },
    {
      label: "No-Shows",
      value: stats.hasAttendanceList ? String(stats.noShow) : "–",
    },
    {
      label: "No-Show-Quote",
      value: stats.hasAttendanceList
        ? formatPercent(stats.noShowRate)
        : "–",
    },
    {
      label: "Ø Note",
      value: formatGrade(stats.averageGrade),
    },
    {
      label: "Median Note",
      value: formatGrade(stats.medianGrade),
    },
    {
      label: "25%-Quantil",
      value: formatGrade(stats.q25Grade),
    },
    {
      label: "75%-Quantil",
      value: formatGrade(stats.q75Grade),
    },
    {
      label: "Stabw. Note",
      value: formatStat(stats.stdDevGrade, 2),
    },
    {
      label: "Bestehensquote",
      value: formatPercent(stats.passRate),
    },
    {
      label: "Unstimmigkeiten",
      value: String(stats.mismatches),
      warn: stats.mismatches > 0,
    },
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.label}
            className={cn(
              "rounded-lg border bg-card px-3 py-1.5 text-sm",
              item.warn &&
                "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40"
            )}
          >
            <span className="text-muted-foreground">{item.label}: </span>
            <span className="font-semibold tabular-nums">{item.value}</span>
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
            <span
              className={cn(
                "text-muted-foreground",
                item.warn && "text-amber-800 dark:text-amber-200"
              )}
            >
              {item.label}
            </span>
            <span
              className={cn(
                "font-semibold tabular-nums",
                item.warn && "text-amber-900 dark:text-amber-100"
              )}
            >
              {item.value}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
