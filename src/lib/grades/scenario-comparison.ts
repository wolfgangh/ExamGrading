import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
} from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";
import { buildEnrichedRows } from "@/lib/matching/match";
import {
  computeStatistics,
  defaultBorderlineMax,
  resolveNextGradeUnit,
} from "@/lib/grades/statistics";
import { ensureScenarios, visibleScenarios } from "@/lib/grades/scenarios";
import {
  computeGradeBuckets,
  computeScenarioImpact,
  type ScenarioImpact,
} from "@/lib/grades/scenario-impact";
import { formatGrade } from "@/lib/utils";

function shortScenarioLabel(name: string, passThreshold: number): string {
  const cleaned = name
    .replace(" (Standard)", "")
    .replace(" (frei)", "")
    .trim();
  if (/^\d+(\.\d+)?$/.test(cleaned) || cleaned.includes("Pkt")) {
    return `${passThreshold} Pkt.`;
  }
  if (/^Szenario\s+/i.test(cleaned)) {
    return `${passThreshold} Pkt.`;
  }
  return `${cleaned} (${passThreshold})`;
}

export type ScenarioColumn = {
  id: string;
  label: string;
  passThreshold: number;
  stats: ExamStatistics;
  rows: EnrichedStudentRow[];
  buckets: { name: string; count: number; share: number }[];
};

export type GradeMatrixRow = {
  grade: number;
  gradeLabel: string;
  cells: { count: number; share: number }[];
};

export type BucketMatrixRow = {
  name: string;
  cells: { count: number; share: number }[];
};

export type CrossScenarioFailer = {
  key: string;
  lastName: string;
  firstName: string;
  totalPoints: number | null;
  grades: (number | null)[];
  failsIn: boolean[];
  /** Kurzer Status: z. B. „nur S1 durchgefallen“ */
  statusNote: string;
};

export type ScenarioComparisonBundle = {
  columns: ScenarioColumn[];
  gradeMatrix: GradeMatrixRow[];
  bucketMatrix: BucketMatrixRow[];
  failers: CrossScenarioFailer[];
  impact: ScenarioImpact | null;
};

export function buildScenarioColumns(project: ExamProject): ScenarioColumn[] {
  const all = ensureScenarios(project);
  const scenarios = visibleScenarios(project);
  return scenarios.map((sc) => {
    const rows = buildEnrichedRows({
      ...project,
      gradeSchema: sc.schema,
      gradeScenarios: all,
      activeScenarioId: sc.id,
    });
    const blMax = defaultBorderlineMax(
      resolveNextGradeUnit(rows),
      sc.schema.maxPoints
    );
    const stats = computeStatistics(rows, sc.schema, blMax, project);
    return {
      id: sc.id,
      label: shortScenarioLabel(sc.name, sc.passThreshold),
      passThreshold: sc.passThreshold,
      stats,
      rows,
      buckets: computeGradeBuckets(rows),
    };
  });
}

export function buildGradeMatrix(columns: ScenarioColumn[]): GradeMatrixRow[] {
  return GERMAN_GRADES.map((grade) => ({
    grade,
    gradeLabel: formatGrade(grade),
    cells: columns.map((col) => {
      const entry = col.stats.gradeDistribution.find(
        (g) => Math.abs(g.grade - grade) < 0.05
      );
      const count = entry?.count ?? 0;
      const total =
        col.stats.gradeDistribution.reduce((s, g) => s + g.count, 0) || 1;
      return { count, share: count / total };
    }),
  }));
}

export function buildBucketMatrix(columns: ScenarioColumn[]): BucketMatrixRow[] {
  if (columns.length === 0) return [];
  const names = columns[0].buckets.map((b) => b.name);
  return names.map((name, i) => ({
    name,
    cells: columns.map((col) => {
      const b = col.buckets[i] ?? { count: 0, share: 0 };
      return { count: b.count, share: b.share };
    }),
  }));
}

export function computeCrossScenarioFailers(
  columns: ScenarioColumn[]
): CrossScenarioFailer[] {
  if (columns.length === 0) return [];
  const keys = new Set<string>();
  for (const col of columns) {
    for (const r of col.rows) {
      if (r.inHis && r.finalGrade != null && r.isFailed) keys.add(r.key);
    }
  }

  const result: CrossScenarioFailer[] = [];
  for (const key of keys) {
    const sample =
      columns.map((c) => c.rows.find((r) => r.key === key)).find(Boolean) ??
      null;
    if (!sample) continue;
    const grades = columns.map((c) => {
      const r = c.rows.find((row) => row.key === key);
      return r?.finalGrade ?? null;
    });
    const failsIn = grades.map((g) => g != null && g > 4.0 + 1e-9);
    const failLabels = columns
      .filter((_, i) => failsIn[i])
      .map((c) => c.label);
    const passLabels = columns
      .filter((_, i) => grades[i] != null && !failsIn[i])
      .map((c) => c.label);
    let statusNote = "";
    if (failLabels.length === columns.length) {
      statusNote = "in allen Szenarien durchgefallen";
    } else if (failLabels.length === 1) {
      statusNote = `nur bei ${failLabels[0]} durchgefallen`;
    } else if (passLabels.length === 1) {
      statusNote = `besteht nur bei ${passLabels[0]}`;
    } else {
      statusNote = `durchgefallen: ${failLabels.join(", ")}`;
    }
    result.push({
      key,
      lastName: sample.student.lastName,
      firstName: sample.student.firstName,
      totalPoints: sample.totalPoints,
      grades,
      failsIn,
      statusNote,
    });
  }

  result.sort((a, b) =>
    a.lastName.localeCompare(b.lastName, "de") ||
    a.firstName.localeCompare(b.firstName, "de")
  );
  return result;
}

export function buildScenarioComparisonBundle(
  project: ExamProject,
  impactA?: string | null,
  impactB?: string | null
): ScenarioComparisonBundle {
  const columns = buildScenarioColumns(project);
  const gradeMatrix = buildGradeMatrix(columns);
  const bucketMatrix = buildBucketMatrix(columns);
  const failers = computeCrossScenarioFailers(columns);
  let impact: ScenarioImpact | null = null;
  if (columns.length >= 2) {
    const a = impactA ?? columns[0].id;
    const b =
      impactB ?? columns.find((c) => c.id !== a)?.id ?? columns[1].id;
    impact = computeScenarioImpact(project, a, b);
  }
  return { columns, gradeMatrix, bucketMatrix, failers, impact };
}

export function scenarioSeriesForCharts(columns: ScenarioColumn[]) {
  return columns.map((c) => ({
    key: c.id,
    label: c.label,
    stats: c.stats,
    buckets: c.buckets,
    passThreshold: c.passThreshold,
  }));
}

