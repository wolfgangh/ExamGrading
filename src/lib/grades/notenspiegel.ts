import { computeGradeBuckets } from "@/lib/grades/scenario-impact";
import { ensureScenarios } from "@/lib/grades/scenarios";
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

export interface NotenspiegelRow {
  label: string;
  count: number;
  share: number; // 0–1
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
  metrics: NotenspiegelMetric[];
  gradeRows: NotenspiegelRow[];
  bucketRows: NotenspiegelRow[];
  note: string;
}

function activeScenarioLabel(project: ExamProject): string {
  const scenarios = ensureScenarios(project);
  const active =
    scenarios.find((s) => s.id === project.activeScenarioId) ?? scenarios[0];
  if (!active) {
    return `Bestehen ab ${project.gradeSchema.passThreshold} Pkt.`;
  }
  const name = active.name
    .replace(" (Standard)", "")
    .replace(" (frei)", "")
    .trim();
  return `${name} · Bestehen ab ${active.passThreshold} Pkt.`;
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

  const gradeRows: NotenspiegelRow[] = stats.gradeDistribution.map((g) => ({
    label: formatGrade(g.grade),
    count: g.count,
    share: shareOf(g.count, total),
  }));

  const buckets = computeGradeBuckets(rows);
  const bucketRows: NotenspiegelRow[] = buckets.map((b) => ({
    label: b.name,
    count: b.count,
    share: b.share,
  }));

  const metrics: NotenspiegelMetric[] = [
    { label: "Anmeldungen (HIS)", value: String(stats.registered) },
    { label: "Bewertet", value: String(stats.graded) },
    {
      label: "No-Shows",
      value: stats.hasAttendanceList ? String(stats.noShow) : "–",
    },
    { label: "Ø Note", value: formatGrade(stats.averageGrade) },
    { label: "Median Note", value: formatGrade(stats.medianGrade) },
    { label: "Stabw. Note", value: formatStat(stats.stdDevGrade, 2) },
    { label: "Bestehensquote", value: formatPercent(stats.passRate) },
    { label: "Durchfaller", value: String(stats.failCount) },
    { label: "Ø Punkte", value: formatPoints(stats.averagePoints) },
    { label: "Median Punkte", value: formatPoints(stats.medianPoints) },
    {
      label: "Max. Punkte",
      value: formatPoints(project.gradeSchema.maxPoints),
    },
  ];

  return {
    title: "Notenspiegel",
    examName: project.name || "Prüfung",
    examNumber: project.examNumber || "–",
    semester: project.semester || "–",
    lecturers: (project.lecturers ?? []).filter(Boolean).join(", ") || "–",
    scenarioName: activeScenarioLabel(project),
    passThreshold: project.gradeSchema.passThreshold,
    maxPoints: project.gradeSchema.maxPoints,
    generatedAt: new Date().toISOString(),
    graded: stats.graded,
    metrics,
    gradeRows,
    bucketRows,
    note: "Aggregierte Auswertung ohne personenbezogene Daten. Bezug: aktives Notenszenario.",
  };
}

export function formatShareDe(share: number): string {
  return `${(share * 100).toFixed(1).replace(".", ",")}\u00a0%`;
}
