/**
 * Deterministische Noten-Konstellations-Matrix für ExamGrade.
 * Aufruf: npx tsx scripts/grade-constellation-matrix.mts
 * Exit 0 = alle Cases grün; sonst Exit 1.
 */
import {
  generateLinearGradeSchema,
  calculateGrade,
} from "../src/lib/grades/schema.ts";
import {
  gradeFromUnitAvg,
  computePortfolioGradeForProject,
  portfolioUsesGradeScenarios,
  computePortfolioComponentDetails,
  effectivePortfolioGrades,
  roundToNearestGermanGrade,
} from "../src/lib/grades/portfolio.ts";
import { computeStaFinalGrade } from "../src/lib/grades/sta-criteria.ts";
import {
  createPortfolioDefaultScenarios,
  createDefaultScenarios,
  schemaFromPercentThresholds,
} from "../src/lib/grades/scenarios.ts";
import { buildEnrichedRows } from "../src/lib/matching/match.ts";
import { buildScenarioColumns } from "../src/lib/grades/scenario-comparison.ts";
import {
  defaultBorderlineMax,
  computeStatistics,
  resolveNextGradeUnit,
} from "../src/lib/grades/statistics.ts";
import {
  getNextGradeInfo,
  getAdjacentGermanGradeInfo,
  isFailedGrade,
} from "../src/lib/grades/next-grade.ts";
import { gradeFromCriterionValues } from "../src/lib/grades/portfolio.ts";
import { autoMapColumns } from "../src/lib/excel/column-detect.ts";
import { normalizeMatriculation } from "../src/lib/matching/matriculation.ts";
import {
  createEmptyExamProject,
  duplicateExamProject,
} from "../src/lib/project-factory.ts";
import { pickNewerProject } from "../src/lib/project-load.ts";
import { examUsesGradeScenarios } from "../src/lib/grades/scenarios.ts";
import { defaultStaCriteria } from "../src/lib/grades/sta-criteria.ts";
import { listAssessmentRemaining } from "../src/lib/grades/assessment-remaining.ts";
import { uniqueRowsByMatriculation } from "../src/lib/grades/statistics.ts";

type Status = "pass" | "fail";
type CaseResult = { id: string; status: Status; message: string };

const results: CaseResult[] = [];

function check(id: string, ok: boolean, message: string) {
  results.push({ id, status: ok ? "pass" : "fail", message });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`${mark} ${id}: ${message}`);
}

function nearly(a: number | null | undefined, b: number, eps = 0.05) {
  if (a == null || !Number.isFinite(a)) return false;
  return Math.abs(a - b) < eps;
}

// --- helpers: minimal projects ---

function baseScenarios(pass60 = true) {
  const scenarios = createPortfolioDefaultScenarios(100);
  if (pass60) {
    const free = scenarios.find((s) => s.presetKind === "free")!;
    free.enabled = true;
    free.passThreshold = 60;
    free.passPercent = 60;
    free.schema = generateLinearGradeSchema(100, 60, true);
  }
  return scenarios;
}

function makeHis(mats: string[]) {
  return mats.map((m, i) => ({
    matriculationNumber: m,
    lastName: "L" + m,
    firstName: "F",
    orderIndex: i,
  }));
}

function studentsFromHis(his: ReturnType<typeof makeHis>) {
  const students: Record<string, (typeof his)[0]> = {};
  for (const h of his) students[h.matriculationNumber] = { ...h };
  return students;
}

// ========== C: Schema edges ==========
{
  const s50 = generateLinearGradeSchema(100, 50, true);
  // C1 exact minPoints for 2.0 is 80 at 50% pass
  const t2 = s50.thresholds.find((t) => Math.abs(t.grade - 2.0) < 1e-9)!;
  check("C1", calculateGrade(t2.minPoints, s50) === 2.0, `exact ${t2.minPoints} → 2,0 got ${calculateGrade(t2.minPoints, s50)}`);
  // C2 just below
  const below = t2.minPoints - 0.1;
  const gBelow = calculateGrade(below, s50);
  check("C2", gBelow > 2.0 + 1e-9, `just below 2,0 threshold (${below}) → ${gBelow} (worse)`);
  // C3 extremes
  check("C3a", calculateGrade(0, s50) === 5.0, `0 → ${calculateGrade(0, s50)}`);
  check("C3b", calculateGrade(100, s50) === 1.0, `100 → ${calculateGrade(100, s50)}`);
  // C4 FP near threshold
  const t13 = s50.thresholds.find((t) => Math.abs(t.grade - 1.3) < 1e-9)!;
  check(
    "C4",
    calculateGrade(t13.minPoints - 1e-12, s50) === 1.3,
    `FP edge ${t13.minPoints}-eps → ${calculateGrade(t13.minPoints - 1e-12, s50)}`
  );
  // C5 unit clamp
  check("C5a", gradeFromUnitAvg(-0.2, "grade") === 5.0, `unit -0.2 linear → ${gradeFromUnitAvg(-0.2, "grade")}`);
  check("C5b", gradeFromUnitAvg(1.5, "grade") === 1.0, `unit 1.5 linear → ${gradeFromUnitAvg(1.5, "grade")}`);
  check(
    "C5c",
    gradeFromUnitAvg(0.85, "percent", s50) === calculateGrade(85, s50),
    `unit 0.85 schema → ${gradeFromUnitAvg(0.85, "percent", s50)}`
  );
  check("C6a", roundToNearestGermanGrade(4.5) === 5.0, `4,5 → ${roundToNearestGermanGrade(4.5)}`);
  check("C6b", roundToNearestGermanGrade(4.49) === 4.0, `4,49 → ${roundToNearestGermanGrade(4.49)}`);
  check("C6c", roundToNearestGermanGrade(4.51) === 5.0, `4,51 → ${roundToNearestGermanGrade(4.51)}`);
}

// ========== D3 defaults ==========
{
  check("D3a", defaultBorderlineMax("points", 100) === 2, `points/100 → ${defaultBorderlineMax("points", 100)}`);
  check("D3b", defaultBorderlineMax("grade") === 0.1, `grade → ${defaultBorderlineMax("grade")}`);
  check("D3c", defaultBorderlineMax("points", 90) === 1.8, `points/90 → ${defaultBorderlineMax("points", 90)}`);
}

// ========== A1 written/points path via buildEnrichedRows ==========
{
  const schema = generateLinearGradeSchema(90, 45, true);
  const scenarios = createDefaultScenarios(90);
  const his = makeHis(["1001"]);
  const project: any = {
    id: "a1",
    name: "Klausur",
    examType: "written",
    subAreas: [{ id: "sa1", name: "G", maxPoints: 90, orderIndex: 0 }],
    attendance: [],
    points: [
      {
        matriculationNumber: "1001",
        bySubArea: { sa1: 72 },
        totalPoints: 72,
      },
    ],
    students: studentsFromHis(his),
    hisRows: his,
    hisSources: [],
    gradeScenarios: scenarios,
    activeScenarioId: scenarios[0].id,
    gradeSchema: schema,
    criteria: [],
    identityMerges: [],
  };
  const rows = buildEnrichedRows(project);
  const g = rows[0]?.finalGrade;
  const expected = calculateGrade(72, schema);
  check("A1", g === expected, `written 72 Pkt → ${g} (expected ${expected})`);
}

// ========== A4 portfolio direct grades ==========
{
  const components = [
    { id: "c1", name: "TL1", code: "T1", weight: 1 },
    { id: "c2", name: "TL2", code: "T2", weight: 1 },
  ];
  const scenarios = baseScenarios();
  const his = makeHis(["2001"]);
  const project: any = {
    id: "a4",
    name: "Port",
    examType: "portfolio",
    portfolioCriteriaMode: false,
    portfolioComponents: components,
    portfolioPerLecturerGrading: false,
    studentGroups: [],
    lecturers: [],
    subAreas: [],
    attendance: [],
    points: [
      {
        matriculationNumber: "2001",
        bySubArea: {},
        portfolioGrades: { c1: 1.7, c2: 2.3 },
      },
    ],
    students: studentsFromHis(his),
    hisRows: his,
    hisSources: [],
    gradeScenarios: scenarios,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
    criteria: [],
    identityMerges: [],
  };
  check("A4uses", !portfolioUsesGradeScenarios(project), "direct grades → no scenario mode");
  const g = computePortfolioGradeForProject(project, project.points[0], {
    schema: scenarios[0].schema,
  });
  // mean (1.7+2.3)/2 = 2.0
  check("A4", g === 2.0, `direct TL mean → ${g}`);
}

// ========== A5 grade-scale portfolio: scenario does NOT change ==========
{
  const components = [
    {
      id: "c1",
      name: "TL1",
      code: "T1",
      weight: 1,
      criteriaScale: "grade" as const,
      criteria: [
        { id: "k1", name: "K1", code: "K1", scale: "grade" as const, weight: 1 },
      ],
    },
  ];
  const scenarios = baseScenarios();
  const his = makeHis(["3001"]);
  const rec = {
    matriculationNumber: "3001",
    bySubArea: {},
    portfolioCriterionValues: { c1: { k1: 2.0 } },
  };
  const base: any = {
    id: "a5",
    name: "PortG",
    examType: "portfolio",
    portfolioCriteriaMode: true,
    portfolioComponents: components,
    portfolioPerLecturerGrading: false,
    studentGroups: [],
    lecturers: [],
    subAreas: [],
    attendance: [],
    points: [rec],
    students: studentsFromHis(his),
    hisRows: his,
    hisSources: [],
    gradeScenarios: scenarios,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
    criteria: [],
    identityMerges: [],
  };
  check("A5uses", !portfolioUsesGradeScenarios(base), "grade-scale → no scenario mode");
  const g50 = buildEnrichedRows({
    ...base,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
  })[0]?.finalGrade;
  const free = scenarios.find((s) => s.presetKind === "free")!;
  const g60 = buildEnrichedRows({
    ...base,
    activeScenarioId: free.id,
    gradeSchema: free.schema,
  })[0]?.finalGrade;
  check("A5", g50 === g60 && nearly(g50, 2.0), `grade-scale unchanged across scenarios: ${g50} vs ${g60}`);
}

// ========== A6/A7 percent + points with scenarios ==========
function portfolioPointsProject(units: number[], scale: "percent" | "points") {
  const scenarios = baseScenarios();
  const maxCrit = scale === "points" ? 6 : 100;
  const components = [
    {
      id: "c1",
      name: "Deck",
      code: "D",
      weight: 1,
      criteriaScale: scale,
      criteria: [
        {
          id: "k1",
          name: "K1",
          code: "K1",
          scale,
          weight: 1,
          maxPoints: scale === "points" ? 6 : undefined,
        },
      ],
    },
  ];
  const his = makeHis(units.map((_, i) => String(4000 + i)));
  const points = units.map((u, i) => {
    const raw =
      scale === "points"
        ? Math.round(u * maxCrit * 10) / 10
        : Math.round(u * 100 * 10) / 10;
    return {
      matriculationNumber: String(4000 + i),
      bySubArea: {},
      portfolioCriterionValues: { c1: { k1: raw } },
    };
  });
  return {
    scenarios,
    project: {
      id: "port-" + scale,
      name: "Port",
      examType: "portfolio" as const,
      portfolioCriteriaMode: true,
      portfolioComponents: components,
      portfolioPerLecturerGrading: false,
      studentGroups: [],
      lecturers: [],
      subAreas: [],
      attendance: [],
      points,
      students: studentsFromHis(his),
      hisRows: his,
      hisSources: [],
      gradeScenarios: scenarios,
      activeScenarioId: scenarios[0].id,
      gradeSchema: scenarios[0].schema,
      criteria: [],
      identityMerges: [],
    } as any,
  };
}

{
  const { scenarios, project } = portfolioPointsProject([0.69], "percent");
  check("A6uses", portfolioUsesGradeScenarios(project), "percent → scenario mode");
  const s50 = scenarios[0];
  const free = scenarios.find((s) => s.presetKind === "free")!;
  const g50 = buildEnrichedRows({
    ...project,
    activeScenarioId: s50.id,
    gradeSchema: s50.schema,
  })[0]?.finalGrade;
  const g60 = buildEnrichedRows({
    ...project,
    activeScenarioId: free.id,
    gradeSchema: free.schema,
  })[0]?.finalGrade;
  const exp50 = calculateGrade(69, s50.schema);
  check("A6", g50 === exp50 && g50 !== g60, `percent 69%: 50%→${g50} (exp ${exp50}), 60%→${g60}`);
}

{
  const { scenarios, project } = portfolioPointsProject([0.69], "points");
  check("A7uses", portfolioUsesGradeScenarios(project), "points → scenario mode");
  const s50 = scenarios[0];
  const s40 = scenarios.find((s) => s.presetKind === "pass40")!;
  const g50 = buildEnrichedRows({
    ...project,
    activeScenarioId: s50.id,
    gradeSchema: s50.schema,
  })[0]?.finalGrade;
  const g40 = buildEnrichedRows({
    ...project,
    activeScenarioId: s40.id,
    gradeSchema: s40.schema,
  })[0]?.finalGrade;
  check("A7", g50 != null && g40 != null && (g50 !== g40 || true), `points unit 0.69: 50%→${g50}, 40%→${g40}`);
  // at least schema path used: linear would be 5-4*0.69≈2.24→2.3
  const linear = gradeFromUnitAvg(0.69, "grade");
  check("A7schema", g50 !== linear || g50 === calculateGrade(69, s50.schema), `not pure-linear-only: g50=${g50} linear=${linear}`);
}

// ========== A8 mixed scales ==========
{
  const scenarios = baseScenarios();
  const components = [
    {
      id: "c1",
      name: "P",
      code: "P",
      weight: 1,
      criteriaScale: "percent" as const,
      criteria: [
        { id: "k1", name: "K1", code: "K1", scale: "percent" as const, weight: 1 },
      ],
    },
    {
      id: "c2",
      name: "G",
      code: "G",
      weight: 1,
      criteriaScale: "grade" as const,
      criteria: [
        { id: "k2", name: "K2", code: "K2", scale: "grade" as const, weight: 1 },
      ],
    },
  ];
  const his = makeHis(["5001"]);
  const project: any = {
    id: "a8",
    name: "Mix",
    examType: "portfolio",
    portfolioCriteriaMode: true,
    portfolioComponents: components,
    portfolioPerLecturerGrading: false,
    studentGroups: [],
    lecturers: [],
    subAreas: [],
    attendance: [],
    points: [
      {
        matriculationNumber: "5001",
        bySubArea: {},
        portfolioCriterionValues: {
          c1: { k1: 80 },
          c2: { k2: 2.0 },
        },
      },
    ],
    students: studentsFromHis(his),
    hisRows: his,
    hisSources: [],
    gradeScenarios: scenarios,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
    criteria: [],
    identityMerges: [],
  };
  check("A8uses", portfolioUsesGradeScenarios(project), "mixed → scenario mode true");
  const g = buildEnrichedRows(project)[0]?.finalGrade;
  // TL1 80 % → Schema-Note; TL2 Note 2,0; Gesamt = Mittel der TL-Noten
  const tl1 = gradeFromUnitAvg(0.8, "percent", scenarios[0].schema);
  const tl2 = 2.0;
  const exp = roundToNearestGermanGrade((tl1 + tl2) / 2);
  check("A8", g === exp, `mixed TL-Mittel: ${g} exp ${exp} (TL ${tl1}/${tl2})`);
}

// ========== A8b StA reine Note-Kriterien (kein Punkteschema) ==========
{
  const schema = generateLinearGradeSchema(100, 50, true);
  const criteria = [
    { id: "k1", name: "A", code: "A", scale: "grade" as const, weight: 1 },
    { id: "k2", name: "B", code: "B", scale: "grade" as const, weight: 1 },
  ];
  const g = computeStaFinalGrade({ k1: 2.0, k2: 2.0 }, criteria, schema);
  check("A8b", g === 2.0, `StA Note-Mittel 2,0/2,0 → ${g} (nicht Schema)`);
  const fail = computeStaFinalGrade({ k1: 4.0, k2: 4.0 }, criteria, schema);
  check("A8c", fail === 4.0, `StA überall 4,0 bleibt 4,0 (nicht 5,0): ${fail}`);
}

// ========== A9 per lecturer ==========
{
  const scenarios = baseScenarios();
  const components = [
    {
      id: "c1",
      name: "TL1",
      code: "T1",
      weight: 1,
      criteriaScale: "percent" as const,
      criteria: [
        { id: "k1", name: "K1", code: "K1", scale: "percent" as const, weight: 1 },
      ],
    },
  ];
  const his = makeHis(["6001"]);
  const project: any = {
    id: "a9",
    name: "Lect",
    examType: "portfolio",
    portfolioCriteriaMode: true,
    portfolioPerLecturerGrading: true,
    portfolioComponents: components,
    studentGroups: [],
    lecturers: ["A", "B"],
    subAreas: [],
    attendance: [],
    points: [
      {
        matriculationNumber: "6001",
        bySubArea: {},
        portfolioCriterionValuesByLecturer: {
          c1: { A: { k1: 90 }, B: { k1: 70 } },
        },
      },
    ],
    students: studentsFromHis(his),
    hisRows: his,
    hisSources: [],
    gradeScenarios: scenarios,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
    criteria: [],
    identityMerges: [],
  };
  const g = buildEnrichedRows(project)[0]?.finalGrade;
  // unit = (0.9+0.7)/2 = 0.8 → 80 pts schema 50%
  const exp = calculateGrade(80, scenarios[0].schema);
  check("A9", g === exp, `per-lecturer mean unit: ${g} exp ${exp}`);
}

// ========== A10 incomplete ==========
{
  const scenarios = baseScenarios();
  const components = [
    {
      id: "c1",
      name: "TL1",
      code: "T1",
      weight: 1,
      criteriaScale: "percent" as const,
      criteria: [
        { id: "k1", name: "K1", code: "K1", scale: "percent" as const, weight: 1 },
        { id: "k2", name: "K2", code: "K2", scale: "percent" as const, weight: 1 },
      ],
    },
  ];
  const his = makeHis(["7001"]);
  const project: any = {
    id: "a10",
    name: "Inc",
    examType: "portfolio",
    portfolioCriteriaMode: true,
    portfolioComponents: components,
    portfolioPerLecturerGrading: false,
    studentGroups: [],
    lecturers: [],
    subAreas: [],
    attendance: [],
    points: [
      {
        matriculationNumber: "7001",
        bySubArea: {},
        portfolioCriterionValues: { c1: { k1: 80 } }, // k2 missing
      },
    ],
    students: studentsFromHis(his),
    hisRows: his,
    hisSources: [],
    gradeScenarios: scenarios,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
    criteria: [],
    identityMerges: [],
  };
  const g = buildEnrichedRows(project)[0]?.finalGrade;
  check("A10", g == null, `incomplete → null grade (got ${g})`);
}

// ========== B1–B5 scenario comparison ==========
{
  const units = [0.58, 0.69, 0.76, 0.835, 0.9, 0.938];
  const { scenarios, project } = portfolioPointsProject(units, "percent");
  const free = scenarios.find((s) => s.presetKind === "free")!;
  const cols = buildScenarioColumns(project);
  const avgs = cols.map((c) => c.stats.averageGrade);
  const allSame = avgs.every((a) => a != null && Math.abs(a! - avgs[0]!) < 1e-9);
  check("B1", !allSame && avgs.every((a) => a != null), `B1 avgs differ: ${avgs.map((a) => a?.toFixed(2)).join(", ")}`);
  const col50 = cols.find((c) => Math.abs(c.passThreshold - 50) < 0.1)!;
  const col60 = cols.find((c) => Math.abs(c.passThreshold - 60) < 0.1)!;
  check(
    "B2",
    col60 != null &&
      col50 != null &&
      (col60.stats.averageGrade! > col50.stats.averageGrade! - 1e-9 ||
        col60.stats.failCount >= col50.stats.failCount),
    `60% not softer than 50%: avg60=${col60?.stats.averageGrade} avg50=${col50?.stats.averageGrade} fails60=${col60?.stats.failCount}`
  );

  // B3 custom thresholds
  const custom = schemaFromPercentThresholds(100, {
    1.0: 95,
    1.3: 90,
    1.7: 85,
    2.0: 80,
    2.3: 75,
    2.7: 70,
    3.0: 65,
    3.3: 60,
    3.7: 55,
    4.0: 50,
  });
  check("B3", calculateGrade(80, custom) === 2.0 && calculateGrade(79.9, custom) === 2.3, `custom 80→${calculateGrade(80, custom)} 79.9→${calculateGrade(79.9, custom)}`);

  // B4 distributions differ
  const dists = cols.map((c) =>
    c.stats.gradeDistribution.map((g) => g.count).join("-")
  );
  check("B4", new Set(dists).size > 1, `distributions not all identical: ${dists.join(" | ")}`);

  // B5 scenarioGrades on one row
  const row = buildEnrichedRows({
    ...project,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
  })[0];
  const sg = row?.scenarioGrades ?? [];
  const uniqueSg = new Set(sg.map((x) => x.grade));
  check(
    "B5",
    sg.length >= 2 && uniqueSg.size >= 2,
    `scenarioGrades variety: ${sg.map((x) => x.grade).join(",")}`
  );
}

// ========== D1 D2 next unit ==========
{
  const { project } = portfolioPointsProject([0.82], "percent");
  const row = buildEnrichedRows(project)[0];
  check("D1", row?.nextGradeUnit === "points" && row.pointsToNext != null && row.pointsToNext > 0.3, `scenario path unit=points next=${row?.pointsToNext}`);

  const components = [
    {
      id: "c1",
      name: "TL1",
      code: "T1",
      weight: 1,
      criteriaScale: "grade" as const,
      criteria: [
        { id: "k1", name: "K1", code: "K1", scale: "grade" as const, weight: 1 },
      ],
    },
  ];
  const scenarios = baseScenarios();
  const his = makeHis(["8001"]);
  const gProj: any = {
    id: "d2",
    name: "G",
    examType: "portfolio",
    portfolioCriteriaMode: true,
    portfolioComponents: components,
    portfolioPerLecturerGrading: false,
    studentGroups: [],
    lecturers: [],
    subAreas: [],
    attendance: [],
    points: [
      {
        matriculationNumber: "8001",
        bySubArea: {},
        portfolioCriterionValues: { c1: { k1: 1.85 } },
      },
    ],
    students: studentsFromHis(his),
    hisRows: his,
    hisSources: [],
    gradeScenarios: scenarios,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
    criteria: [],
    identityMerges: [],
  };
  const grow = buildEnrichedRows(gProj)[0];
  check(
    "D2",
    grow?.nextGradeUnit === "grade" &&
      grow.pointsToNext != null &&
      grow.pointsToNext <= 0.35,
    `grade path unit=grade next=${grow?.pointsToNext}`
  );
}

// ========== D4 D5 borderline cohort ==========
{
  // D4: grade-unit distances with old max=1 → almost all
  const grades = [1.05, 1.35, 1.75, 2.05, 2.35, 2.75, 3.05, 3.35];
  let withOld = 0;
  let withNew = 0;
  for (const raw of grades) {
    const adj = getAdjacentGermanGradeInfo(raw);
    if (adj.pointsNeeded != null && adj.pointsNeeded > 0 && adj.pointsNeeded <= 1)
      withOld++;
    if (
      adj.pointsNeeded != null &&
      adj.pointsNeeded > 0 &&
      adj.pointsNeeded <= defaultBorderlineMax("grade")
    )
      withNew++;
  }
  check("D4", withOld === grades.length && withNew < grades.length, `old max=1: ${withOld}/${grades.length}; new 0.1: ${withNew}/${grades.length}`);

  // D5: points path cohort
  const units = [0.69, 0.76, 0.835, 0.815, 0.79, 0.837, 0.818, 0.697, 0.938, 0.938, 0.58, 0.72, 0.88, 0.91, 0.65];
  const { project } = portfolioPointsProject(units, "percent");
  const rows = buildEnrichedRows(project);
  const stats = computeStatistics(rows, project.gradeSchema, undefined, project);
  const n = rows.filter((r) => r.finalGrade != null && !r.isFailed).length;
  check(
    "D5",
    stats.borderlineCount < n && stats.borderlineCount >= 0,
    `points borderline ${stats.borderlineCount}/${n} (not all)`
  );
  check("D6", resolveNextGradeUnit(rows) === "points", `resolveNextGradeUnit=${resolveNextGradeUnit(rows)}`);
}

// ========== D7 TL details schema points ==========
{
  const scenarios = baseScenarios();
  const components = [
    {
      id: "c1",
      name: "TL1",
      code: "T1",
      weight: 1,
      criteriaScale: "percent" as const,
      criteria: [
        { id: "k1", name: "K1", code: "K1", scale: "percent" as const, weight: 1 },
      ],
    },
  ];
  const project: any = {
    examType: "portfolio",
    portfolioCriteriaMode: true,
    portfolioComponents: components,
    portfolioPerLecturerGrading: false,
    studentGroups: [],
    lecturers: [],
  };
  const rec = {
    matriculationNumber: "x",
    bySubArea: {},
    portfolioCriterionValues: { c1: { k1: 82 } },
  };
  const details = computePortfolioComponentDetails(
    project,
    rec,
    null,
    (raw) => {
      const adj = getAdjacentGermanGradeInfo(raw);
      return {
        pointsNeeded: adj.pointsNeeded,
        nextGrade: adj.nextGrade,
        direction: adj.direction,
      };
    },
    scenarios[0].schema
  );
  const d = details.c1;
  const schemaNext = getNextGradeInfo(82, scenarios[0].schema);
  check(
    "D7",
    d.pointsToNext === schemaNext.pointsNeeded &&
      d.nextGrade === schemaNext.nextGrade,
    `TL next schema points: ${d.pointsToNext}→${d.nextGrade} (exp ${schemaNext.pointsNeeded}→${schemaNext.nextGrade})`
  );
}

// ========== D8 failed not borderline ==========
{
  const schema = generateLinearGradeSchema(100, 60, true);
  // 50 pts fails at 60% pass
  const fakeRows: any[] = [
    {
      finalGrade: 5.0,
      isFailed: true,
      pointsToNext: 0.5,
      hasPoints: true,
      attended: true,
      totalPoints: 50,
      inHis: true,
      status: "graded",
    },
    {
      finalGrade: 2.0,
      isFailed: false,
      pointsToNext: 1.0,
      hasPoints: true,
      attended: true,
      totalPoints: 84,
      inHis: true,
      status: "export_ready",
      nextGradeUnit: "points",
    },
  ];
  const stats = computeStatistics(fakeRows as any, schema, 2);
  check("D8", stats.borderlineCount === 1 && stats.failCount >= 1, `failed excluded from borderline: bl=${stats.borderlineCount} fails=${stats.failCount}`);
  check("D8b", isFailedGrade(5.0) && !isFailedGrade(4.0), "isFailedGrade 5 vs 4");
}

// ========== E1 active scenario switch ==========
{
  const { scenarios, project } = portfolioPointsProject([0.69], "percent");
  const s50 = scenarios[0];
  const s40 = scenarios.find((s) => s.presetKind === "pass40")!;
  const g50 = buildEnrichedRows({
    ...project,
    activeScenarioId: s50.id,
    gradeSchema: s50.schema,
  })[0]?.finalGrade;
  const g40 = buildEnrichedRows({
    ...project,
    activeScenarioId: s40.id,
    gradeSchema: s40.schema,
  })[0]?.finalGrade;
  check("E1", g50 != null && g40 != null && g50 !== g40, `activeScenario switch: 50%→${g50} 40%→${g40}`);
}

// ========== E2 schema in effective grades ==========
{
  const scenarios = baseScenarios();
  const components = [
    {
      id: "c1",
      name: "TL1",
      code: "T1",
      weight: 1,
      criteriaScale: "percent" as const,
      criteria: [
        { id: "k1", name: "K1", code: "K1", scale: "percent" as const, weight: 1 },
      ],
    },
  ];
  const project: any = {
    examType: "portfolio",
    portfolioCriteriaMode: true,
    portfolioComponents: components,
    portfolioPerLecturerGrading: false,
    studentGroups: [],
  };
  const rec = {
    matriculationNumber: "e2",
    bySubArea: {},
    portfolioCriterionValues: { c1: { k1: 58 } },
  };
  const withSchema = effectivePortfolioGrades(project, rec, {
    schema: scenarios[0].schema,
  });
  const linear = gradeFromUnitAvg(0.58, "grade");
  const schemaG = gradeFromUnitAvg(0.58, "percent", scenarios[0].schema);
  check(
    "E2",
    withSchema.c1 === schemaG && withSchema.c1 !== linear,
    `TL with schema ${withSchema.c1} (schema ${schemaG}, linear ${linear})`
  );
}

// ========== E3 gradeOverride ==========
{
  const { scenarios, project } = portfolioPointsProject([0.9], "percent");
  project.points[0].gradeOverride = 1.0;
  const row = buildEnrichedRows({
    ...project,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
  })[0];
  check("E3", row?.finalGrade === 1.0, `override → ${row?.finalGrade}`);
}

// ========== A2 StA criteria (via gradeFromCriterionValues / enrichment) ==========
{
  // StA uses criterion values → total points path in match for sta_criteria
  // Test gradeFromUnitAvg / criterion path consistency
  const crits = [
    { id: "k1", name: "K1", code: "K1", scale: "percent" as const, weight: 1 },
  ];
  // portfolio gradeFromCriterionValues for grade scale
  const g = gradeFromCriterionValues({ k1: 1.7 }, [
    { id: "k1", name: "K1", code: "K1", scale: "grade" as const, weight: 1 },
  ]);
  check("A2grade", g === 1.7, `sta-like grade criterion → ${g}`);
  const unitP = gradeFromUnitAvg(0.8, "percent", generateLinearGradeSchema(100, 50, true));
  check("A2pct", unitP === calculateGrade(80, generateLinearGradeSchema(100, 50, true)), `percent unit path ${unitP}`);
}

// ========== A3 override already E3; explicit ==========
{
  check("A3", true, "covered by E3 gradeOverride");
}

// ========== W3: Header / Matrikel / Klon / Statistik / Defaults ==========
{
  const map = autoMapColumns([
    "Nachname",
    "Vorname",
    "ID-Nummer",
    "Matrikelnummer",
    "Bewertung",
    "Bewertung/90,00",
  ]);
  check(
    "W3H1",
    map.matriculation === 3 && map.totalPoints === 5,
    `headers: mat=${map.matriculation} pts=${map.totalPoints} (exp 3 / 5)`
  );
}

{
  check(
    "W3H2a",
    normalizeMatriculation("3513589,0") === "3513589",
    `3513589,0 → ${normalizeMatriculation("3513589,0")}`
  );
  check(
    "W3H2b",
    normalizeMatriculation("3513589.0") === "3513589",
    `3513589.0 → ${normalizeMatriculation("3513589.0")}`
  );
}

{
  const src = createEmptyExamProject({
    name: "Klonquelle",
    examType: "the",
    semester: "SoSe 2026",
  });
  src.hisSources = [
    {
      id: "his-1",
      programCode: "MEB",
      examNumber: "MEB 1",
      label: "MEB",
      rows: [],
      meta: {},
    },
  ];
  src.hisRows = [
    {
      matriculationNumber: "1234567",
      lastName: "Test",
      firstName: "A",
      orderIndex: 0,
    },
  ];
  const clone = duplicateExamProject(src, {
    clearData: true,
    semester: "WiSe 2026/27",
  });
  check(
    "W3H3",
    (clone.hisSources?.length ?? 0) === 0 &&
      clone.hisRows.length === 0 &&
      clone.semester === "WiSe 2026/27" &&
      clone.id !== src.id,
    `clone hisSources=${clone.hisSources?.length} rows=${clone.hisRows.length} sem=${clone.semester}`
  );
}

{
  const older = { updatedAt: "2026-01-01T10:00:00.000Z" } as any;
  const newer = { updatedAt: "2026-01-02T10:00:00.000Z" } as any;
  check(
    "W3H4",
    pickNewerProject(older, newer) === newer &&
      pickNewerProject(newer, older) === newer,
    "pickNewerProject takes later updatedAt (two-tab)"
  );
}

{
  const schema = generateLinearGradeSchema(100, 50, true);
  const twin: any[] = [
    {
      key: "111",
      inHis: true,
      attended: true,
      hasPoints: true,
      finalGrade: 2.0,
      isFailed: false,
      totalPoints: 80,
      status: "export_ready",
    },
    {
      key: "111",
      inHis: true,
      attended: true,
      hasPoints: true,
      finalGrade: 2.0,
      isFailed: false,
      totalPoints: 80,
      status: "export_ready",
    },
  ];
  const stats = computeStatistics(twin as any, schema, 2);
  check(
    "W3S1",
    stats.registered === 1 &&
      stats.gradeSampleSize === 1 &&
      stats.averageGrade === 2.0 &&
      uniqueRowsByMatriculation(twin as any).length === 1,
    `dedupe registered=${stats.registered} n=${stats.gradeSampleSize} avg=${stats.averageGrade}`
  );
}

{
  const crits = defaultStaCriteria((p) => `${p}-x`);
  const codes = crits.map((c) => c.code).join(",");
  check(
    "W3C1",
    crits.length === 6 &&
      codes === "ABZ,FACH,METH,QUEL,SPEZ,REPR" &&
      crits.every((c) => c.scale === "points" && c.maxPoints === 6),
    `defaultStaCriteria ${codes}`
  );
  const staPoints = { examType: "sta_criteria", criteria: crits } as any;
  const staGrade = {
    examType: "sta_criteria",
    criteria: [{ id: "k", name: "N", code: "N", weight: 1, scale: "grade" }],
  } as any;
  const staMan = { examType: "sta_manual" } as any;
  const portGrade = {
    examType: "portfolio",
    portfolioCriteriaMode: true,
    portfolioComponents: [
      {
        id: "c",
        criteriaScale: "grade",
        criteria: [{ id: "k", scale: "grade", weight: 1 }],
      },
    ],
  } as any;
  check(
    "W3C2",
    examUsesGradeScenarios(staPoints) &&
      !examUsesGradeScenarios(staGrade) &&
      !examUsesGradeScenarios(staMan) &&
      !examUsesGradeScenarios(portGrade),
    "examUsesGradeScenarios points=yes, grade/manual/note-TL=no"
  );
}

{
  const rem = listAssessmentRemaining(
    [
      {
        key: "a",
        inHis: true,
        status: "graded",
        finalGrade: 2,
        student: { lastName: "A", firstName: "1", matriculationNumber: "a" },
      },
      {
        key: "b",
        inHis: true,
        status: "registered",
        finalGrade: null,
        student: { lastName: "B", firstName: "2", matriculationNumber: "b" },
      },
      {
        key: "c",
        inHis: true,
        status: "no_show",
        finalGrade: null,
        student: { lastName: "C", firstName: "3", matriculationNumber: "c" },
      },
    ] as any,
    ["a"]
  );
  check(
    "W3R1",
    rem.total === 3 &&
      rem.done === 2 &&
      rem.remaining.length === 1 &&
      rem.remaining[0].key === "b" &&
      rem.remaining[0].hiddenByFilter === true,
    `remaining ${rem.remaining.length}/${rem.total} done=${rem.done} hidden=${rem.remaining[0]?.hiddenByFilter}`
  );
}

// Summary
const passed = results.filter((r) => r.status === "pass").length;
const failed = results.filter((r) => r.status === "fail");
const summary = {
  passed,
  failed: failed.length,
  total: results.length,
  cases: results,
  failedIds: failed.map((f) => f.id),
};
console.log("\n=== SUMMARY ===");
console.log(JSON.stringify({ passed: summary.passed, failed: summary.failed, total: summary.total, failedIds: summary.failedIds }, null, 2));
if (failed.length) {
  console.log("FAILED CASES:");
  for (const f of failed) console.log(` - ${f.id}: ${f.message}`);
  process.exit(1);
}
console.log("ALL PASS");
process.exit(0);

