"use client";

import {
  difficultyColor,
  type QuestionStat,
  type SubAreaStat,
} from "@/lib/grades/question-stats";
import { cn, formatPoints } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import {
  ChartTooltip,
  chartTooltipCursor,
} from "@/components/charts/chart-tooltip";

function pctColor(p: number | null) {
  const d = difficultyColor(p);
  return cn(
    d === "good" && "text-emerald-700 dark:text-emerald-300",
    d === "medium" && "text-amber-700 dark:text-amber-300",
    d === "hard" && "text-rose-700 dark:text-rose-300",
    d === "unknown" && "text-muted-foreground"
  );
}

function barFill(p: number | null) {
  const d = difficultyColor(p);
  if (d === "good") return "var(--color-chart-3)";
  if (d === "medium") return "var(--color-chart-4)";
  if (d === "hard") return "var(--color-chart-5)";
  return "var(--color-chart-1)";
}

export function QuestionStatsPanel({
  questionStats,
  subAreaStats,
}: {
  questionStats: QuestionStat[];
  subAreaStats: SubAreaStat[];
}) {
  const chartData = questionStats.map((q) => ({
    name: q.label,
    pct: q.averagePercent ?? 0,
    label:
      q.averagePercent != null
        ? `${q.averagePercent} %`
        : "–",
    fill: barFill(q.averagePercent),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Wie gut kamen die Studierenden mit den Aufgaben zurecht?
          </CardTitle>
          <CardDescription>
            Ø-Erreichungsgrad in % der Maximalpunkte (grün ≥70 %, gelb ≥40 %,
            rot darunter)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Aufgaben.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 20, right: 8, left: 0, bottom: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} unit=" %" tick={{ fontSize: 11 }} />
                  <Tooltip
                    cursor={chartTooltipCursor}
                    content={
                      <ChartTooltip
                        formatter={(v) => [`${v} %`, "Ø-Erreichungsgrad"]}
                      />
                    }
                  />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]} fill="var(--color-chart-1)">
                    <LabelList
                      dataKey="label"
                      position="top"
                      className="fill-foreground text-[10px]"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="surface-panel">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aufgaben im Detail</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto max-h-72">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aufg.</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Ø Pkte</TableHead>
                <TableHead>Median</TableHead>
                <TableHead>Q25</TableHead>
                <TableHead>Q75</TableHead>
                <TableHead>Ø %</TableHead>
                <TableHead>n</TableHead>
                <TableHead>offen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questionStats.map((q) => (
                <TableRow key={q.questionId}>
                  <TableCell className="font-medium">{q.label}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatPoints(q.maxPoints, 2)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatPoints(q.averagePoints, 2)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatPoints(q.medianPoints, 2)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatPoints(q.q25Points, 2)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatPoints(q.q75Points, 2)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "tabular-nums font-semibold",
                      pctColor(q.averagePercent)
                    )}
                  >
                    {q.averagePercent != null
                      ? `${q.averagePercent}\u00a0%`
                      : "–"}
                  </TableCell>
                  <TableCell className="tabular-nums">{q.nAnswered}</TableCell>
                  <TableCell
                    className={cn(
                      "tabular-nums",
                      q.nNeedsGrading > 0 && "text-amber-700 font-medium"
                    )}
                  >
                    {q.nNeedsGrading}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {subAreaStats.length > 0 && (
        <Card className="surface-panel lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Auswertung nach Teilgebiet</CardTitle>
            <CardDescription>
              Basiert auf der Zuordnung der Aufgaben zu den Teilgebieten
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subAreaStats.map((s) => (
                <div
                  key={s.subAreaId}
                  className="rounded-xl border bg-card px-4 py-3"
                >
                  <p className="font-medium">
                    {s.name}{" "}
                    <span className="text-muted-foreground text-sm">
                      ({s.code})
                    </span>
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    <span className={pctColor(s.averagePercent)}>
                      {s.averagePercent != null
                        ? `${s.averagePercent}\u00a0%`
                        : "–"}
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Ø {formatPoints(s.averagePoints)} / max {s.maxPoints} ·{" "}
                    {s.questionCount} Aufg. · n={s.nWithData}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
