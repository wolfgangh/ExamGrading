import { computeGradeBuckets } from "@/lib/grades/scenario-impact";
import { ensureScenarios } from "@/lib/grades/scenarios";
import { computeSubAreaStats } from "@/lib/grades/question-stats";
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
  stats: ExamStatistics
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

  const metrics: NotenspiegelMetric[] = [
    { label: "Anmeldungen (HISinOne)", value: String(stats.registered) },
    { label: "Bewertet", value: String(stats.graded) },
    {
      label: "No-Shows",
      value:
        stats.hasAttendanceList || stats.noShow > 0
          ? String(stats.noShow)
          : "–",
    },
    { label: "Ø Note (Mittelwert)", value: formatGrade(stats.averageGrade) },
    { label: "Median Note", value: formatGrade(stats.medianGrade) },
    { label: "Stabw. Note", value: formatStat(stats.stdDevGrade, 2) },
    {
      label: "Bestehensquote",
      value:
        (stats.gradeSampleSize ?? 0) > 0
          ? `${formatPercent(stats.passRate)} (n=${stats.gradeSampleSize})`
          : formatPercent(stats.passRate),
    },
    { label: "Durchfaller", value: String(stats.failCount) },
    { label: "Ø Punkte", value: formatPoints(stats.averagePoints) },
    { label: "Median Punkte", value: formatPoints(stats.medianPoints) },
    {
      label: "Max. Punkte",
      value: formatPoints(
        portfolioDisplayPassAndMax(project)?.maxPoints ??
          project.gradeSchema.maxPoints
      ),
    },
  ];

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
    note: "Aggregierte Auswertung ohne personenbezogene Daten. Bezug: aktives Notenszenario.",
  };
}

export function formatShareDe(share: number): string {
  return `${(share * 100).toFixed(1).replace(".", ",")}\u00a0%`;
}
