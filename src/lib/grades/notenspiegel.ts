import { computeGradeBuckets } from "@/lib/grades/scenario-impact";
import { ensureScenarios } from "@/lib/grades/scenarios";
import {
  computeQuestionStats,
  computeSubAreaStats,
} from "@/lib/grades/question-stats";
import { uniqueRowsByMatriculation } from "@/lib/grades/statistics";
import { median, quantile } from "@/lib/stats/quantile";
import { portfolioDisplayPassAndMax } from "@/lib/grades/portfolio";
import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
} from "@/lib/types";
import {
  formatGrade,
  formatPercent,
  formatPoints,
  formatStat,
} from "@/lib/utils";

export type GradeBucketKey =
  | "sehr gut"
  | "gut"
  | "befriedigend"
  | "ausreichend"
  | "nicht ausreichend";

/** Druckgeeignete Stufenfarben */
export const GRADE_BUCKET_COLORS: Record<GradeBucketKey, string> = {
  "sehr gut": "#059669",
  gut: "#0284c7",
  befriedigend: "#4f46e5",
  ausreichend: "#d97706",
  "nicht ausreichend": "#e11d48",
};

export function gradeBucketForGrade(grade: number): GradeBucketKey {
  if (grade <= 1.5) return "sehr gut";
  if (grade <= 2.5) return "gut";
  if (grade <= 3.5) return "befriedigend";
  if (grade <= 4.0) return "ausreichend";
  return "nicht ausreichend";
}

export interface NotenspiegelRow {
  grade: number;
  label: string;
  count: number;
  share: number; // 0–1
  bucket: GradeBucketKey;
  color: string;
}

export interface NotenspiegelMetric {
  label: string;
  value: string;
}

/** Lagemaße einer Verteilung (ohne Min/Max – Datenschutz bei kleinen Gruppen) */
export interface DistributionStats {
  n: number;
  mean: number | null;
  median: number | null;
  q25: number | null;
  q75: number | null;
  sd: number | null;
}

/** Auswertung je Aufgabe bzw. Teilgebiet (optional) */
export interface NotenspiegelTaskRow {
  kind: "task" | "subArea";
  label: string;
  maxPoints: number;
  n: number;
  mean: number | null;
  median: number | null;
  q25: number | null;
  q75: number | null;
  /** Lösungsquote 0–1 (Mittelwert / Max) */
  solveRate: number | null;
}

export type NotenspiegelOptions = {
  /** Auswertung je Aufgabe / Teilgebiet einbeziehen */
  includeTasks?: boolean;
};

export function distributionStats(values: number[]): DistributionStats {
  const n = values.length;
  if (n === 0) {
    return { n: 0, mean: null, median: null, q25: null, q75: null, sd: null };
  }
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd =
    n > 1
      ? Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1))
      : null;
  return {
    n,
    mean,
    median: median(values),
    q25: quantile(values, 0.25),
    q75: quantile(values, 0.75),
    sd,
  };
}

/** Gibt es Aufgaben- oder Teilgebietspunkte für die Auswertung je Aufgabe? */
export function notenspiegelHasTaskData(project: ExamProject): boolean {
  const hasQ = (project.questionDefs?.length ?? 0) > 0;
  if (hasQ) {
    return project.points.some(
      (p) => p.byQuestion && Object.keys(p.byQuestion).length > 0
    );
  }
  return (project.subAreas?.length ?? 0) > 1;
}

export interface NotenspiegelData {
  title: string;
  examName: string;
  examNumber: string;
  semester: string;
  lecturers: string;
  scenarioName: string;
  passThreshold: number;
  maxPoints: number;
  generatedAt: string;
  graded: number;
  averageGrade: number | null;
  medianGrade: number | null;
  metrics: NotenspiegelMetric[];
  gradeRows: NotenspiegelRow[];
  bucketRows: {
    label: string;
    count: number;
    share: number;
    color: string;
  }[];
  /** Auswertung je Teilgebiet (nur bei mehreren Teilgebieten) */
  subAreaRows: {
    name: string;
    code: string;
    maxPoints: number;
    n: number;
    averagePoints: number | null;
    averagePercent: number | null;
  }[];
  /** Lagemaße der Noten (bewertet, ohne No-Shows) */
  gradeStats: DistributionStats;
  /** Lagemaße der Punkte; null ohne Punkte-Skala */
  pointStats: DistributionStats | null;
  /** Punkte-Histogramm (10 Klassen) */
  pointsHistogram: { from: number; to: number; count: number }[];
  /** Auswertung je Aufgabe/Teilgebiet (nur mit Option) */
  tasks: NotenspiegelTaskRow[] | null;
  note: string;
}

function activeScenarioLabel(project: ExamProject): string {
  const scenarios = ensureScenarios(project);
  const active =
    scenarios.find((s) => s.id === project.activeScenarioId) ?? scenarios[0];
  const disp = portfolioDisplayPassAndMax(project);
  const passLabel = disp
    ? `${String(disp.passThreshold).replace(".", ",")} Pkt. (von ${String(disp.maxPoints).replace(".", ",")})`
    : `${active?.passThreshold ?? project.gradeSchema.passThreshold} Pkt.`;
  if (!active) {
    return `Bestehen ab ${passLabel}`;
  }
  const name = active.name
    .replace(" (Standard)", "")
    .replace(" (frei)", "")
    .trim();
  return `${name} · Bestehen ab ${passLabel}`;
}

function shareOf(count: number, total: number): number {
  if (total <= 0) return 0;
  return count / total;
}

/**
 * Aggregierter Notenspiegel für das aktive Szenario (keine Personenliste).
 */
export function buildNotenspiegelData(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics,
  options: NotenspiegelOptions = {}
): NotenspiegelData {
  const total =
    stats.gradeDistribution.reduce((s, g) => s + g.count, 0) ||
    stats.graded ||
    0;

  const gradeRows: NotenspiegelRow[] = stats.gradeDistribution.map((g) => {
    const bucket = gradeBucketForGrade(g.grade);
    return {
      grade: g.grade,
      label: formatGrade(g.grade),
      count: g.count,
      share: shareOf(g.count, total),
      bucket,
      color: GRADE_BUCKET_COLORS[bucket],
    };
  });

  const buckets = computeGradeBuckets(rows);
  const bucketRows = buckets.map((b) => {
    const key = (
      b.name === "nicht ausr." ? "nicht ausreichend" : b.name
    ) as GradeBucketKey;
    const color =
      GRADE_BUCKET_COLORS[key] ?? GRADE_BUCKET_COLORS["nicht ausreichend"];
    return {
      label: b.name,
      count: b.count,
      share: b.share,
      color,
    };
  });

  // Lagemaße aus den bewerteten Personen (ohne No-Shows)
  const graded = uniqueRowsByMatriculation(rows).filter(
    (r) => r.finalGrade != null && r.attended !== false && r.status !== "no_show"
  );
  const gradeStats = distributionStats(graded.map((r) => r.finalGrade as number));
  const pointValues = graded
    .map((r) => r.totalPoints)
    .filter((p): p is number => p != null && Number.isFinite(p));
  const pointStats = pointValues.length > 0 ? distributionStats(pointValues) : null;
  const maxPointsDisplay =
    portfolioDisplayPassAndMax(project)?.maxPoints ?? project.gradeSchema.maxPoints;

  const metrics: NotenspiegelMetric[] = [
    { label: "Anmeldungen (Teilnehmerliste)", value: String(stats.registered) },
    { label: "Bewertet", value: String(stats.graded) },
    {
      label: "No-Shows",
      value:
        stats.hasAttendanceList || stats.noShow > 0
          ? String(stats.noShow)
          : "–",
    },
    {
      label: "Bestehensquote",
      value:
        (stats.gradeSampleSize ?? 0) > 0
          ? `${formatPercent(stats.passRate)} (n=${stats.gradeSampleSize})`
          : formatPercent(stats.passRate),
    },
    { label: "Durchfaller", value: String(stats.failCount) },
    { label: "Note: Mittelwert", value: formatStat(gradeStats.mean, 2) },
    { label: "Note: Median", value: formatGrade(gradeStats.median) },
    {
      label: "Note: 25 %- / 75 %-Quantil",
      value: `${formatStat(gradeStats.q25, 2)} / ${formatStat(gradeStats.q75, 2)}`,
    },
    { label: "Note: Standardabweichung", value: formatStat(gradeStats.sd, 2) },
    ...(pointStats
      ? [
          { label: "Punkte: Mittelwert", value: formatPoints(pointStats.mean) },
          { label: "Punkte: Median", value: formatPoints(pointStats.median) },
          {
            label: "Punkte: 25 %- / 75 %-Quantil",
            value: `${formatPoints(pointStats.q25)} / ${formatPoints(pointStats.q75)}`,
          },
          { label: "Punkte: Standardabweichung", value: formatStat(pointStats.sd, 2) },
          { label: "Erreichbare Punkte", value: formatPoints(maxPointsDisplay) },
        ]
      : []),
  ];

  // Auswertung je Aufgabe / Teilgebiet (optional)
  let tasks: NotenspiegelTaskRow[] | null = null;
  if (options.includeTasks && notenspiegelHasTaskData(project)) {
    if ((project.questionDefs?.length ?? 0) > 0) {
      tasks = computeQuestionStats(project).map((q) => ({
        kind: "task" as const,
        label: q.label,
        maxPoints: q.maxPoints,
        n: q.nAnswered,
        mean: q.averagePoints,
        median: q.medianPoints,
        q25: q.q25Points,
        q75: q.q75Points,
        solveRate: q.averagePercent != null ? q.averagePercent / 100 : null,
      }));
    } else {
      tasks = (project.subAreas ?? []).map((sa) => {
        const vals = graded
          .map((r) => r.subAreaPoints?.[sa.id])
          .filter((v): v is number => v != null && Number.isFinite(v));
        const d = distributionStats(vals);
        return {
          kind: "subArea" as const,
          label: sa.code ? `${sa.name} (${sa.code})` : sa.name,
          maxPoints: sa.maxPoints,
          n: d.n,
          mean: d.mean,
          median: d.median,
          q25: d.q25,
          q75: d.q75,
          solveRate:
            d.mean != null && sa.maxPoints > 0 ? d.mean / sa.maxPoints : null,
        };
      });
    }
  }

  // Teilgebiete: aus Enriched-Rows (bewertet) + Fallback computeSubAreaStats
  const subAreas = project.subAreas ?? [];
  let subAreaRows: NotenspiegelData["subAreaRows"] = [];
  if (subAreas.length > 1) {
    const gradedRows = rows.filter(
      (r) =>
        r.finalGrade != null &&
        r.attended !== false &&
        (r.hasPoints || r.totalPoints != null)
    );
    subAreaRows = subAreas.map((sa) => {
      const vals: number[] = [];
      for (const r of gradedRows) {
        const v = r.subAreaPoints?.[sa.id];
        if (v != null && Number.isFinite(v)) vals.push(v);
      }
      const n = vals.length;
      const averagePoints =
        n > 0
          ? Math.round(
              (vals.reduce((a, b) => a + b, 0) / n) * 100
            ) / 100
          : null;
      const averagePercent =
        averagePoints != null && sa.maxPoints > 0
          ? Math.round((averagePoints / sa.maxPoints) * 1000) / 10
          : null;
      return {
        name: sa.name,
        code: sa.code,
        maxPoints: sa.maxPoints,
        n,
        averagePoints,
        averagePercent,
      };
    });
    // Falls kaum subAreaPoints: Stats aus Fragen ergänzen
    if (subAreaRows.every((s) => s.n === 0)) {
      const fromQ = computeSubAreaStats(project);
      subAreaRows = fromQ.map((s) => ({
        name: s.name,
        code: s.code,
        maxPoints: s.maxPoints,
        n: s.nWithData,
        averagePoints: s.averagePoints,
        averagePercent: s.averagePercent,
      }));
    }
  }

  return {
    title: "Notenspiegel",
    examName: project.name || "Prüfung",
    examNumber: project.examNumber || "–",
    semester: project.semester || "–",
    lecturers: (project.lecturers ?? []).filter(Boolean).join(", ") || "–",
    scenarioName: activeScenarioLabel(project),
    passThreshold:
      portfolioDisplayPassAndMax(project)?.passThreshold ??
      project.gradeSchema.passThreshold,
    maxPoints:
      portfolioDisplayPassAndMax(project)?.maxPoints ??
      project.gradeSchema.maxPoints,
    generatedAt: new Date().toISOString(),
    graded: stats.graded,
    averageGrade: stats.averageGrade,
    medianGrade: stats.medianGrade,
    metrics,
    gradeRows,
    bucketRows,
    subAreaRows,
    gradeStats,
    pointStats,
    pointsHistogram: pointStats
      ? stats.pointsHistogram.map((b) => ({ from: b.from, to: b.to, count: b.count }))
      : [],
    tasks,
    note: "Aggregierte Auswertung ohne personenbezogene Daten. Bezug: aktives Notenszenario.",
  };
}

export function formatShareDe(share: number): string {
  return `${(share * 100).toFixed(1).replace(".", ",")}\u00a0%`;
}
