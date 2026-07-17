import type { EnrichedStudentRow, ExamProject, GradeScenario } from "@/lib/types";
import { buildEnrichedRows } from "@/lib/matching/match";
import { ensureScenarios } from "@/lib/grades/scenarios";

export interface ImpactRow {
  key: string;
  lastName: string;
  firstName: string;
  gradeA: number | null;
  gradeB: number | null;
  /** gradeB - gradeA; negativ = besser (kleinere Note) */
  delta: number | null;
  newlyPassed: boolean;
  newlyFailed: boolean;
}

export interface ScenarioImpact {
  scenarioA: GradeScenario;
  scenarioB: GradeScenario;
  improved: number;
  worsened: number;
  unchanged: number;
  newlyPassed: number;
  newlyFailed: number;
  rows: ImpactRow[];
}

export function computeScenarioImpact(
  project: ExamProject,
  scenarioIdA: string,
  scenarioIdB: string
): ScenarioImpact | null {
  const scenarios = ensureScenarios(project);
  const scenarioA = scenarios.find((s) => s.id === scenarioIdA);
  const scenarioB = scenarios.find((s) => s.id === scenarioIdB);
  if (!scenarioA || !scenarioB) return null;

  const rowsA = buildEnrichedRows({
    ...project,
    gradeSchema: scenarioA.schema,
    activeScenarioId: scenarioA.id,
    gradeScenarios: scenarios,
  });
  const rowsB = buildEnrichedRows({
    ...project,
    gradeSchema: scenarioB.schema,
    activeScenarioId: scenarioB.id,
    gradeScenarios: scenarios,
  });

  const mapB = new Map(rowsB.map((r) => [r.key, r]));
  const impactRows: ImpactRow[] = [];
  let improved = 0;
  let worsened = 0;
  let unchanged = 0;
  let newlyPassed = 0;
  let newlyFailed = 0;

  for (const a of rowsA) {
    if (!a.inHis || a.attended === false || a.finalGrade == null) continue;
    const b = mapB.get(a.key);
    if (!b || b.finalGrade == null) continue;

    const gA = a.finalGrade;
    const gB = b.finalGrade;
    const delta = Math.round((gB - gA) * 10) / 10;
    const passedA = gA <= 4.0;
    const passedB = gB <= 4.0;
    const np = !passedA && passedB;
    const nf = passedA && !passedB;
    if (np) newlyPassed++;
    if (nf) newlyFailed++;

    if (Math.abs(delta) < 0.05) unchanged++;
    else if (delta < 0) improved++;
    else worsened++;

    impactRows.push({
      key: a.key,
      lastName: a.student.lastName,
      firstName: a.student.firstName,
      gradeA: gA,
      gradeB: gB,
      delta,
      newlyPassed: np,
      newlyFailed: nf,
    });
  }

  impactRows.sort((x, y) => {
    const ax = x.delta ?? 0;
    const ay = y.delta ?? 0;
    // largest absolute change first
    return Math.abs(ay) - Math.abs(ax);
  });

  return {
    scenarioA,
    scenarioB,
    improved,
    worsened,
    unchanged,
    newlyPassed,
    newlyFailed,
    rows: impactRows,
  };
}

export function gradeBucketLabel(grade: number): string {
  if (grade <= 1.5) return "sehr gut";
  if (grade <= 2.5) return "gut";
  if (grade <= 3.5) return "befriedigend";
  if (grade <= 4.0) return "ausreichend";
  return "nicht ausreichend";
}

export function computeGradeBuckets(rows: EnrichedStudentRow[]) {
  const graded = rows.filter(
    (r) => r.finalGrade != null && r.attended !== false && r.hasPoints
  );
  const n = graded.length || 1;
  const buckets = [
    { key: "sehr gut", max: 1.5, count: 0 },
    { key: "gut", max: 2.5, count: 0 },
    { key: "befriedigend", max: 3.5, count: 0 },
    { key: "ausreichend", max: 4.0, count: 0 },
    { key: "nicht ausr.", max: 5.0, count: 0 },
  ];
  for (const r of graded) {
    const g = r.finalGrade!;
    if (g <= 1.5) buckets[0].count++;
    else if (g <= 2.5) buckets[1].count++;
    else if (g <= 3.5) buckets[2].count++;
    else if (g <= 4.0) buckets[3].count++;
    else buckets[4].count++;
  }
  return buckets.map((b) => ({
    name: b.key,
    count: b.count,
    share: b.count / n,
  }));
}
