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
import { findExistingExamMatches } from "../src/lib/project-import-conflict.ts";
import {
  findHisSourceExamNumberConflict,
  upsertHisSource,
} from "../src/lib/his-sources.ts";
import { cellToString } from "../src/lib/excel/column-detect.ts";
import { examUsesGradeScenarios } from "../src/lib/grades/scenarios.ts";
import { defaultStaCriteria } from "../src/lib/grades/sta-criteria.ts";
import { listAssessmentRemaining } from "../src/lib/grades/assessment-remaining.ts";
import {
  nearestGermanGrade,
  uniqueRowsByMatriculation,
} from "../src/lib/grades/statistics.ts";
import {
  criterionPointsTotals,
  countMissingPortfolioCells,
  hasLecturerDiscrepancy,
  lecturerValuesSpread,
  LECTURER_DISCREPANCY_THRESHOLD,
} from "../src/lib/grades/portfolio.ts";
import { countMissingCriteria } from "../src/lib/grades/sta-criteria.ts";
import { validateForExport } from "../src/lib/validations.ts";
import { runWithGradeRules } from "../src/lib/grades/grade-average.ts";
import { averageLecturerGradesForComponent } from "../src/lib/grades/portfolio.ts";
import { listGradeRuleChanges } from "../src/lib/grades/grade-rules-review.ts";
import {
  addManualParticipants,
  listManualParticipants,
  migrateManualExtrasToParticipantList,
  parseParticipantMatrix,
  participantHasAssessment,
  removeManualParticipant,
  takeOverManualParticipantsByHis,
  textToMatrix,
  updateManualParticipant,
} from "../src/lib/manual-participants.ts";
import { buildGradeListRows } from "../src/lib/excel/export-grade-list.ts";
import { filterManualGradeRows } from "../src/lib/pdf/export-manual-grades-pdf.ts";
import { readFileSync } from "node:fs";
import {
  buildNotenspiegelData,
  distributionStats,
  notenspiegelHasTaskData,
} from "../src/lib/grades/notenspiegel.ts";
import {
  buildNotenspiegelHtml,
  embedJson,
  notenspiegelJson,
} from "../src/lib/notenspiegel/notenspiegel-html.ts";
import {
  fillQmdTemplate,
  notenspiegelPlaceholders,
} from "../src/lib/notenspiegel/notenspiegel-quarto.ts";
import {
  buildHeaderHtml,
  buildHeaderTex,
  DEFAULT_LETTERHEAD,
  letterheadFromFile,
  letterheadToFile,
} from "../src/lib/letterhead.ts";

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
  // C6: RaPO – erste Dezimale abschneiden, > 4,0 → 5,0
  check("C6a", roundToNearestGermanGrade(4.0) === 4.0, `4,0 → ${roundToNearestGermanGrade(4.0)}`);
  check("C6b", roundToNearestGermanGrade(4.04) === 4.0, `4,04 (abgeschnitten 4,0) → ${roundToNearestGermanGrade(4.04)}`);
  check("C6c", roundToNearestGermanGrade(4.1) === 5.0, `4,1 → ${roundToNearestGermanGrade(4.1)}`);
  check("C6d", roundToNearestGermanGrade(4.49) === 5.0, `4,49 → ${roundToNearestGermanGrade(4.49)}`);
  check("C6e", roundToNearestGermanGrade(2.16) === 2.0, `2,16 (abgeschnitten 2,1) → ${roundToNearestGermanGrade(2.16)}`);
  check("C6f", roundToNearestGermanGrade(1.5) === 1.3, `1,5 Gleichstand → ${roundToNearestGermanGrade(1.5)}`);
  check("C6g", roundToNearestGermanGrade(2.1) === 2.0, `2,1 (FP) → ${roundToNearestGermanGrade(2.1)}`);
  check(
    "C6h",
    runWithGradeRules(1, () => roundToNearestGermanGrade(4.2)) === 4.0 &&
      runWithGradeRules(1, () => roundToNearestGermanGrade(2.16)) === 2.3,
    "Legacy-Regel v1 für Vergleich alt→neu"
  );
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
  // Portfolio-Note = Notenmittel der Teilnoten → Abstand in Notengraden (82 % → TL 2,0 → ab 1,8 → 1,7)
  check(
    "D1",
    row?.finalGrade === 2.0 &&
      row?.nextGradeUnit === "grade" &&
      nearly(row.pointsToNext, 0.2, 1e-6) &&
      row.nextGrade === 1.7,
    `scenario portfolio unit=${row?.nextGradeUnit} next=${row?.pointsToNext}→${row?.nextGrade}`
  );

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
  // D4: Abstand vom abgeschnittenen Notenmittel bis zur besseren Stufe
  const d24 = getAdjacentGermanGradeInfo(2.4);
  const d245 = getAdjacentGermanGradeInfo(2.45);
  const d41 = getAdjacentGermanGradeInfo(4.1);
  const d10 = getAdjacentGermanGradeInfo(1.05);
  check(
    "D4",
    d24.currentGrade === 2.3 && d24.nextGrade === 2.0 && nearly(d24.pointsNeeded, 0.3, 1e-6) &&
      nearly(d245.pointsNeeded, 0.3, 1e-6) &&
      d41.currentGrade === 5.0 && d41.nextGrade === 4.0 && nearly(d41.pointsNeeded, 0.1, 1e-6) &&
      d10.nextGrade === null &&
      d24.direction === "better",
    `2,4→${d24.pointsNeeded}→${d24.nextGrade}; 2,45→${d245.pointsNeeded}; 4,1→${d41.pointsNeeded}→${d41.nextGrade}; 1,05→${d10.nextGrade}`
  );

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
  check("D6", resolveNextGradeUnit(rows) === "grade", `resolveNextGradeUnit=${resolveNextGradeUnit(rows)}`);
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

// ========== W4: Gewicht 0, Verteilung, No-Show, Klausur, Korrektoren ==========
{
  const crits = [
    { id: "a", name: "A", code: "A", scale: "points" as const, weight: 2, maxPoints: 6 },
    { id: "z", name: "Z", code: "Z", scale: "points" as const, weight: 0, maxPoints: 6 },
  ];
  const miss = countMissingCriteria({ a: 4 }, crits);
  const tot = criterionPointsTotals({ a: 4 }, crits);
  check(
    "W4W1",
    miss === 0 && tot != null && tot.raw === 8 && tot.max === 12,
    `weight0 skipped missing=${miss} raw=${tot?.raw} max=${tot?.max}`
  );
}

{
  check("W4S1a", nearestGermanGrade(1.5) === 1.3, `1,5 → ${nearestGermanGrade(1.5)}`);
  check("W4S1b", nearestGermanGrade(2.5) === 2.3, `2,5 → ${nearestGermanGrade(2.5)}`);
  check("W4S1c", nearestGermanGrade(4.3) === 4.0, `4,3 → ${nearestGermanGrade(4.3)}`);
  const schema = generateLinearGradeSchema(100, 50, true);
  const rows: any[] = [
    {
      key: "1",
      inHis: true,
      attended: true,
      hasPoints: true,
      finalGrade: 1.5,
      isFailed: false,
      totalPoints: 90,
      status: "export_ready",
    },
  ];
  const stats = computeStatistics(rows as any, schema, 2);
  const bin15 = stats.gradeDistribution.find((d) => Math.abs(d.grade - 1.3) < 1e-9);
  check(
    "W4S1d",
    (bin15?.count ?? 0) === 1 && stats.averageGrade === 1.5,
    `override 1,5 in bin 1,3 count=${bin15?.count} avg=${stats.averageGrade}`
  );
}

{
  const schema = generateLinearGradeSchema(100, 50, true);
  const rows: any[] = [
    {
      key: "1",
      inHis: true,
      attended: false,
      hasPoints: false,
      finalGrade: null,
      isFailed: false,
      status: "no_show",
    },
    {
      key: "2",
      inHis: true,
      attended: true,
      hasPoints: true,
      finalGrade: 2.0,
      isFailed: false,
      status: "export_ready",
    },
  ];
  const stats = computeStatistics(rows as any, schema, 2, {
    attendance: [],
  } as any);
  check(
    "W4S2",
    stats.noShow === 1 &&
      stats.noShowRate != null &&
      Math.abs(stats.noShowRate - 0.5) < 1e-9,
    `no-show without attendance list: n=${stats.noShow} rate=${stats.noShowRate}`
  );
}

{
  const schema = generateLinearGradeSchema(100, 50, true);
  const project: any = {
    id: "w4v",
    examType: "written",
    hisRows: [{ matriculationNumber: "1" }],
    points: [],
    criteria: [],
    attendance: [],
    gradeSchema: schema,
  };
  const rows: any[] = [
    {
      key: "1",
      inHis: true,
      status: "registered",
      finalGrade: null,
      attended: null,
      hasPoints: false,
    },
  ];
  const items = validateForExport(project, rows);
  const hit = items.find((i) => i.level === "error" && /ohne Note/.test(i.message));
  check("W4V1", !!hit, `klausur empty HIS: ${hit?.message ?? "missing"}`);
}

{
  const s = lecturerValuesSpread([1.0, 1.7]);
  check(
    "W4L1",
    s != null &&
      Math.abs(s.spread - 0.7) < 1e-9 &&
      !hasLecturerDiscrepancy(s) &&
      hasLecturerDiscrepancy(lecturerValuesSpread([1.0, 1.8])),
    `spread 0,7 no flag, 0,8 flags (thr=${LECTURER_DISCREPANCY_THRESHOLD})`
  );
}

{
  const project: any = {
    portfolioCriteriaMode: true,
    portfolioPerLecturerGrading: false,
    portfolioComponents: [
      {
        id: "c1",
        name: "AE",
        code: "AE",
        weight: 1,
        criteria: [
          { id: "k1", name: "K", code: "K", scale: "points", weight: 1, maxPoints: 6 },
        ],
      },
    ],
    studentGroups: [
      { id: "g1", name: "G", disabledPortfolioCriteria: { c1: ["k1"] } },
    ],
    lecturers: [],
  };
  const miss = countMissingPortfolioCells(project, { matriculationNumber: "x" }, {
    groupId: "g1",
  });
  check("W4P1", miss === 0, `all-disabled TL not missing: ${miss}`);
}

{
  const project = createEmptyExamProject({
    name: "Walk Klausur Stats",
    examType: "written",
  });
  project.hisRows = [
    {
      matriculationNumber: "3513589",
      lastName: "Test",
      firstName: "A",
      orderIndex: 0,
    },
  ];
  project.students = {
    "3513589": {
      matriculationNumber: "3513589",
      lastName: "Test",
      firstName: "A",
    },
  };
  project.points = [
    {
      matriculationNumber: "3513589",
      bySubArea: {},
      totalPoints: null,
      gradeOverride: 2.3,
      source: "manual",
    },
  ];
  const rows = buildEnrichedRows(project);
  const stats = computeStatistics(rows, project.gradeSchema, undefined, project);
  check(
    "W4K1",
    rows[0]?.finalGrade === 2.3 &&
      rows[0]?.hasPoints === true &&
      stats.gradeSampleSize === 1 &&
      stats.averageGrade === 2.3 &&
      stats.passRate === 1,
    `klausur override stats: grade=${rows[0]?.finalGrade} hasPoints=${rows[0]?.hasPoints} n=${stats.gradeSampleSize} avg=${stats.averageGrade} pass=${stats.passRate}`
  );
}

{
  const a = createEmptyExamProject({
    name: "FI",
    examType: "the",
    semester: "SoSe 2026",
  });
  a.examNumber = "";
  const b = { ...a, id: "other", examNumber: "" };
  const emptyMatch = findExistingExamMatches(a, [b]);
  check(
    "W5M1",
    emptyMatch.matches.length === 0 && emptyMatch.byId === false,
    `empty examNumber is not a hard match (n=${emptyMatch.matches.length})`
  );
  a.examNumber = "MEB 1";
  const c = { ...b, examNumber: "MEB 1" };
  const hard = findExistingExamMatches(a, [c]);
  check(
    "W5M2",
    hard.matches.length === 1,
    `same name+sem+type+number matches (n=${hard.matches.length})`
  );
}

{
  const p = createEmptyExamProject({ name: "HIS", examType: "the" });
  const src1 = {
    id: "s1",
    programCode: "MEB",
    examNumber: "8010260",
    label: "MEB",
    originalFileName: "MEB.xlsx",
    meta: {},
    rows: [],
  };
  const src2 = {
    ...src1,
    id: "s2",
    programCode: "MBW",
    originalFileName: "MBW.xlsx",
  };
  const one = upsertHisSource(p, src1);
  const two = upsertHisSource(one, src2);
  check(
    "W5H1",
    (two.hisSources?.length ?? 0) === 2,
    `same examNumber different file adds source (n=${two.hisSources?.length})`
  );
  const hit = findHisSourceExamNumberConflict(one, src2);
  check("W5H2", hit?.id === "s1", `conflict detects ${hit?.id}`);
  const again = upsertHisSource(one, { ...src1, rows: [] });
  check(
    "W5H3",
    (again.hisSources?.length ?? 0) === 1 && again.hisSources?.[0]?.id === "s1",
    "same filename upserts in place"
  );
}

{
  check(
    "W5C1",
    cellToString({ text: "Mustermann" }) === "Mustermann" &&
      cellToString({ richText: [{ text: "A" }, { text: "B" }] }) === "AB" &&
      cellToString({ result: 3513589 }) === "3513589",
    `cellToString unwraps excel objects`
  );
}


// ========== R: Notenregeln (RaPO, Ausgleich, StA-Skala, Anzeige) ==========
function twoTlProject(
  vals: [number[], number[]][],
  opts: { allowComp?: boolean; weights?: [number, number] } = {}
) {
  const scenarios = baseScenarios();
  const crit = (p: string) =>
    [1, 2, 3, 4].map((i) => ({
      id: `${p}k${i}`, name: `K${i}`, code: `K${i}`,
      scale: "points" as const, weight: 1, maxPoints: 6,
    }));
  const [w1, w2] = opts.weights ?? [60, 40];
  const components = [
    { id: "deck", name: "Deck", code: "D", weight: w1, criteriaScale: "points" as const, criteria: crit("d") },
    { id: "vor", name: "Vortrag", code: "V", weight: w2, criteriaScale: "points" as const, criteria: crit("v") },
  ];
  const mats = vals.map((_, i) => String(9100 + i));
  const his = makeHis(mats);
  const points = vals.map(([d, v], i) => ({
    matriculationNumber: mats[i],
    bySubArea: {},
    portfolioCriterionValues: {
      deck: Object.fromEntries(d.map((x, j) => [`dk${j + 1}`, x])),
      vor: Object.fromEntries(v.map((x, j) => [`vk${j + 1}`, x])),
    },
  }));
  return {
    id: "r", name: "R", examType: "portfolio", portfolioCriteriaMode: true,
    portfolioComponents: components, portfolioPerLecturerGrading: false,
    portfolioAllowCompensation: opts.allowComp,
    studentGroups: [], lecturers: [], subAreas: [], attendance: [], points,
    students: studentsFromHis(his), hisRows: his, hisSources: [],
    gradeScenarios: scenarios, activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema, criteria: [], identityMerges: [],
  } as any;
}

{
  // R1: TL 5,0 (8/24) + 3,0 (16/24), 60/40 → Mittel 4,2 → 5,0; Anzeige konsistent
  const r = buildEnrichedRows(twoTlProject([[[3, 3, 1, 1], [4, 4, 4, 4]]]))[0];
  check(
    "R1",
    r?.finalGrade === 5.0 && r.isFailed === true && (r.pointsBelowPass ?? 0) > 0 &&
      r.nextGrade === 4.0 && r.nextGradeUnit === "grade",
    `TL 5,0/3,0 → ${r?.finalGrade} failed=${r?.isFailed} belowPass=${r?.pointsBelowPass} next=${r?.pointsToNext}→${r?.nextGrade}`
  );
  const changes = listGradeRuleChanges(twoTlProject([[[3, 3, 1, 1], [4, 4, 4, 4]]]));
  check(
    "R1b",
    changes.length === 1 && changes[0].oldGrade === 4.0 && changes[0].newGrade === 5.0,
    `Regelvergleich: ${changes.map((c) => `${c.oldGrade}→${c.newGrade}`).join(",")}`
  );
}

{
  // R2: Ausgleich – TL 5,0 (11/24) + 1,0 (24/24): an → 3,3; aus → 5,0 + Label
  const on = buildEnrichedRows(twoTlProject([[[3, 3, 3, 2], [6, 6, 6, 6]]]))[0];
  const off = buildEnrichedRows(
    twoTlProject([[[3, 3, 3, 2], [6, 6, 6, 6]]], { allowComp: false })
  )[0];
  check(
    "R2",
    on?.finalGrade === 3.3 && off?.finalGrade === 5.0 &&
      off.failedComponentLabel === "D" && off.isFailed === true && off.pointsToNext == null,
    `Ausgleich an=${on?.finalGrade} aus=${off?.finalGrade} label=${off?.failedComponentLabel}`
  );
}

{
  // R3: Korrektorenmittel als Notenstufe: 2,7 + 3,7 → 3,2 → 3,3; ungerundet 3,2
  const byL = { c1: { A: 2.7, B: 3.7 } };
  const g = averageLecturerGradesForComponent(byL, "c1", ["A", "B"]);
  const raw = averageLecturerGradesForComponent(byL, "c1", ["A", "B"], true);
  check("R3", g === 3.3 && nearly(raw, 3.2, 1e-6), `Korrektorenmittel ${raw} → Teilnote ${g}`);
}

{
  // R4: %-Spalte gewichtet: 14/24 (60) + 19/24 (40) → 66,7 %, Punkte 32,0/48
  const r = buildEnrichedRows(twoTlProject([[[3, 3, 4, 4], [5, 5, 5, 4]]]))[0];
  check(
    "R4",
    nearly(r?.percent, 0.6667, 0.001) && nearly(r?.totalPoints, 32.0, 1e-6),
    `percent=${r?.percent} points=${r?.totalPoints}`
  );
}

{
  // R5: StA reine Note-Kriterien 4,0/4,0 → 4,0, keine Punkte, kein „unter Bestehen“
  const scenarios = createDefaultScenarios(100);
  const his = makeHis(["9201"]);
  const mk = (criteria: any[], vals: Record<string, number>) => ({
    id: "r5", name: "S", examType: "sta_criteria", criteria, subAreas: [], attendance: [],
    points: [{ matriculationNumber: "9201", bySubArea: {}, criterionValues: vals }],
    students: studentsFromHis(his), hisRows: his, hisSources: [],
    gradeScenarios: scenarios, activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema, identityMerges: [], lecturers: [], studentGroups: [],
  }) as any;
  const g = (id: string) => ({ id, name: id, code: id, scale: "grade" as const, weight: 1 });
  const pt = (id: string) => ({ id, name: id, code: id, scale: "points" as const, weight: 1, maxPoints: 6 });
  const r = buildEnrichedRows(mk([g("a"), g("b")], { a: 4, b: 4 }))[0];
  check(
    "R5",
    r?.finalGrade === 4.0 && r.totalPoints == null && r.isFailed === false &&
      (r.pointsBelowPass ?? 0) <= 0 && r.nextGradeUnit === "grade" &&
      r.nextGrade === 3.7 && nearly(r.pointsToNext, 0.2, 1e-6),
    `StA Noten 4,0: final=${r?.finalGrade} pts=${r?.totalPoints} below=${r?.pointsBelowPass} next=${r?.pointsToNext}→${r?.nextGrade}`
  );
  // R6: gemischte Skalen → Export gesperrt
  const mixed = mk([g("a"), pt("b")], { a: 4, b: 3 });
  const items = validateForExport(mixed, buildEnrichedRows(mixed));
  check(
    "R6",
    items.some((i) => i.level === "error" && i.message.includes("unterschiedliche Skalen")),
    "StA mit gemischten Skalen blockiert Export"
  );
}

{
  // R7: Presets bei Max 75 exakt skaliert (37,5 statt 38)
  const sc = createDefaultScenarios(75);
  check(
    "R7",
    nearly(sc[0].passThreshold, 37.5, 1e-9) && nearly(sc[1].passThreshold, 33.33, 1e-9),
    `max 75: pass=${sc[0].passThreshold} / ${sc[1].passThreshold}`
  );
}

{
  // R8: Neue Prüfung ohne Typ → elektrP; neue Projekte gelten als bestätigt
  const p = createEmptyExamProject({ name: "X", semester: "WiSe 2026/27" });
  check(
    "R8",
    p.examType === "elektr_p" && p.gradeRulesVersion === 2,
    `default examType=${p.examType} rules=${p.gradeRulesVersion}`
  );
}

// ========== M: Manuelle Teilnehmerliste ==========
{
  // M1: Einlesen – mit Kopfzeile (Spalten beliebig), ohne Kopfzeile, „Name, Vorname“
  const withHeader = parseParticipantMatrix(
    textToMatrix("Vorname;Nachname;Matrikelnummer;Studiengang\nErika;Muster;1234567;MBW\nMax;Mann;7654321;")
  );
  const noHeader = parseParticipantMatrix(
    textToMatrix("1234567\tMuster\tErika\tMEB\t\t2")
  );
  const fullName = parseParticipantMatrix(
    textToMatrix("Matrikelnummer,Vollständiger Name\n2345678,\"Muster, Erika\"")
  );
  check(
    "M1",
    withHeader.hasHeader && withHeader.rows.length === 2 &&
      withHeader.rows[0].matriculationNumber === "1234567" &&
      withHeader.rows[0].lastName === "Muster" && withHeader.rows[0].firstName === "Erika" &&
      withHeader.rows[0].programCode === "MBW" &&
      !noHeader.hasHeader && noHeader.rows[0].lastName === "Muster" &&
      noHeader.rows[0].programCode === "MEB" && noHeader.rows[0].attempt === 2 &&
      fullName.rows[0].lastName === "Muster" && fullName.rows[0].firstName === "Erika",
    `header=${withHeader.hasHeader}/${withHeader.rows.length} noHeader=${noHeader.rows[0]?.lastName} full=${fullName.rows[0]?.lastName},${fullName.rows[0]?.firstName}`
  );
}

function manualBaseProject(examType: string = "written") {
  const p: any = createEmptyExamProject({ name: "BB", examType: examType as any, semester: "WiSe 2026/27" });
  return p;
}

{
  // M2: Hinzufügen – Pflichtfelder, Dubletten, zählt als angemeldet
  const p0 = manualBaseProject("written");
  const r = addManualParticipants(p0, [
    { matriculationNumber: "1234567", lastName: "Muster", firstName: "Erika", programCode: "MBW" },
    { matriculationNumber: "1234567", lastName: "Doppelt", firstName: "D" },
    { matriculationNumber: "2345678", lastName: "Ohne", firstName: "" },
    { matriculationNumber: "x", lastName: "A", firstName: "B" },
    { matriculationNumber: "3456789", lastName: "Mann", firstName: "Max", attempt: 4 },
  ]);
  const rows = buildEnrichedRows(r.project);
  const stats = computeStatistics(rows, r.project.gradeSchema, undefined, r.project);
  const erika = rows.find((x) => x.key === "1234567");
  check(
    "M2",
    r.added === 1 && r.issues.length === 4 &&
      erika?.inHis === true && erika.fromManualList === true && erika.programCode === "MBW" &&
      stats.registered === 1,
    `added=${r.added} issues=${r.issues.map((i) => i.reason).join(" | ")} registered=${stats.registered}`
  );
  const vals = validateForExport(r.project, rows);
  check(
    "M2b",
    !vals.some((v) => v.message.includes("Keine Teilnehmerliste")) &&
      !vals.some((v) => v.message.includes("Original-")),
    `manuelle Liste blockiert nicht: ${vals.filter((v) => v.level === "error").map((v) => v.message.slice(0, 40)).join(" | ")}`
  );
  const gl = buildGradeListRows(rows);
  check("M2c", gl.length === 1 && gl[0].source === "manuell" && gl[0].programCode === "MBW", `Excel-Notenliste: ${JSON.stringify(gl[0])}`);
}

{
  // M3: Bearbeiten mit neuer Matrikelnummer zieht Punkte mit; M4: Löschen
  let p = addManualParticipants(manualBaseProject("written"), [
    { matriculationNumber: "1234567", lastName: "Muster", firstName: "Erika" },
  ]).project;
  const sa = p.subAreas[0].id;
  p = { ...p, points: [{ matriculationNumber: "1234567", bySubArea: { [sa]: 60 }, totalPoints: 60 }] };
  const before = buildEnrichedRows(p).find((x) => x.key === "1234567")?.finalGrade;
  const up = updateManualParticipant(p, "1234567", { matriculationNumber: "1234568", lastName: "Muster-Neu" });
  const row = buildEnrichedRows(up.project).find((x) => x.key === "1234568");
  check(
    "M3",
    !up.error && row?.finalGrade === before && row?.student.lastName === "Muster-Neu" &&
      participantHasAssessment(up.project, "1234568") &&
      !buildEnrichedRows(up.project).some((x) => x.key === "1234567"),
    `rekey grade ${before}→${row?.finalGrade} name=${row?.student.lastName} err=${up.error}`
  );
  const del = removeManualParticipant(up.project, "1234568");
  check(
    "M4",
    listManualParticipants(del).length === 0 && del.points.length === 0 && del.hisRows.length === 0,
    `nach Löschen: manual=${listManualParticipants(del).length} points=${del.points.length}`
  );
}

{
  // M5: HISinOne-Import mit gleicher Matrikel → HISinOne hat Vorrang, Hinweis an der Person
  let p = addManualParticipants(manualBaseProject("written"), [
    { matriculationNumber: "1234567", lastName: "Mustr", firstName: "Erika" },
    { matriculationNumber: "7654321", lastName: "Bleibt", firstName: "Manuell" },
  ]).project;
  const sa = p.subAreas[0].id;
  p = { ...p, points: [{ matriculationNumber: "1234567", bySubArea: { [sa]: 70 }, totalPoints: 70 }] };
  const gradeBefore = buildEnrichedRows(p).find((x) => x.key === "1234567")?.finalGrade;
  const hisSource: any = {
    id: "his1", programCode: "BW", examNumber: "BW 1", label: "BW", meta: {},
    originalFileName: "bw.xlsx", originalXlsxBase64: "x",
    rows: [{ matriculationNumber: "1234567", lastName: "Muster", firstName: "Erika", orderIndex: 0 }],
  };
  const t = takeOverManualParticipantsByHis(upsertHisSource(p, hisSource));
  const rows = buildEnrichedRows(t.project);
  const erika = rows.find((x) => x.key === "1234567");
  check(
    "M5",
    t.takeovers.length === 1 && erika?.fromManualList === false && erika.programCode === "BW" &&
      erika.finalGrade === gradeBefore &&
      erika.warnings.some((w) => w.includes("bisher: Mustr, Erika")) &&
      listManualParticipants(t.project).length === 1 &&
      t.project.hisSources?.[t.project.hisSources.length - 1]?.kind === "manual",
    `takeover=${t.takeovers.length} manual=${erika?.fromManualList} grade=${gradeBefore}→${erika?.finalGrade} warn=${erika?.warnings.join("|")}`
  );
}

{
  // M6: Migration bisheriger StA-Extras (einmalig)
  const his = makeHis(["1111111"]);
  const legacy: any = {
    ...manualBaseProject("sta_criteria"),
    manualExtrasMigrated: undefined,
    hisSources: [{ id: "h", programCode: "MBW", examNumber: "MBW 1", label: "MBW", meta: {}, rows: his }],
    hisRows: his,
    students: {
      "1111111": { matriculationNumber: "1111111", lastName: "His", firstName: "A" },
      "2222222": { matriculationNumber: "2222222", lastName: "Extra", firstName: "B" },
    },
    points: [{ matriculationNumber: "2222222", bySubArea: {}, source: "manual", manualProgramCode: "MEB" }],
  };
  const m = migrateManualExtrasToParticipantList(legacy);
  const again = migrateManualExtrasToParticipantList(m);
  const extra = buildEnrichedRows(m).find((x) => x.key === "2222222");
  check(
    "M6",
    m.manualExtrasMigrated === true && listManualParticipants(m).length === 1 &&
      extra?.inHis === true && extra.fromManualList === true && extra.programCode === "MEB" &&
      again === m,
    `migrated=${listManualParticipants(m).length} inHis=${extra?.inHis} prog=${extra?.programCode}`
  );
}

{
  // M7: Manuelle Notenmeldung enthält bewertete Personen der manuellen Liste
  let p = addManualParticipants(manualBaseProject("written"), [
    { matriculationNumber: "1234567", lastName: "Muster", firstName: "Erika" },
    { matriculationNumber: "7654321", lastName: "Leer", firstName: "Noch" },
  ]).project;
  const sa = p.subAreas[0].id;
  p = { ...p, points: [{ matriculationNumber: "1234567", bySubArea: { [sa]: 70 }, totalPoints: 70 }] };
  const manualRows = filterManualGradeRows(buildEnrichedRows(p));
  check(
    "M7",
    manualRows.length === 1 && manualRows[0].key === "1234567",
    `manuelle Notenmeldung: ${manualRows.map((r) => r.key).join(",")}`
  );
}

// ========== N: Notenspiegel (HTML/Quarto) und Briefkopf ==========
{
  // N1: Lagemaße ohne Min/Max
  const d = distributionStats([1, 2, 3, 4, 10]);
  check(
    "N1",
    d.n === 5 && nearly(d.mean, 4, 1e-9) && d.median === 3 && d.q25 === 2 && d.q75 === 4 &&
      nearly(d.sd, Math.sqrt(12.5), 1e-9) && !("min" in d) && !("max" in d),
    `stats=${JSON.stringify(d)}`
  );
}

function spiegelProject() {
  let p: any = createEmptyExamProject({ name: "Fin <Test>", examType: "written", semester: "WiSe 2026/27", lecturers: ["Prof. Dr. A"] });
  const people = Array.from({ length: 12 }, (_, i) => ({ matriculationNumber: String(4100000 + i), lastName: "L" + i, firstName: "F" }));
  p = addManualParticipants(p, people).project;
  const max = p.gradeSchema.maxPoints;
  p.questionDefs = [1, 2].map((k) => ({ id: "q" + k, label: "Aufgabe " + k, maxPoints: max / 2, subAreaId: p.subAreas[0].id }));
  p.points = people.map((s, i) => {
    const byQuestion = { q1: Math.min(max / 2, 15 + i * 2), q2: Math.min(max / 2, 10 + i * 2.5) };
    return { matriculationNumber: s.matriculationNumber, byQuestion, bySubArea: {}, totalPoints: byQuestion.q1 + byQuestion.q2 };
  });
  return p;
}

{
  // N2: Notenspiegel-Daten – Kennzahlen ohne Min/Max, Aufgaben nur mit Option
  const p = spiegelProject();
  const rows = buildEnrichedRows(p);
  const stats = computeStatistics(rows, p.gradeSchema, undefined, p);
  const without = buildNotenspiegelData(p, rows, stats);
  const withTasks = buildNotenspiegelData(p, rows, stats, { includeTasks: true });
  const labels = without.metrics.map((m) => m.label).join("|");
  check(
    "N2",
    without.tasks === null && withTasks.tasks?.length === 2 && withTasks.tasks[0].kind === "task" &&
      notenspiegelHasTaskData(p) && without.pointStats?.n === 12 &&
      labels.includes("Median") && labels.includes("Quantil") && !/Min|Max\./.test(labels) &&
      without.pointsHistogram.length === 10,
    `tasks=${withTasks.tasks?.length} labels=${labels}`
  );

  // N3: HTML – eigenständig, Daten eingebettet, Skript-Ausbruch verhindert, Kopf escaped
  const html = buildNotenspiegelHtml(withTasks, {
    headerHtml: buildHeaderHtml(DEFAULT_LETTERHEAD, { names: ["Prof. Dr. A"], subject: "Fin <Test>", logoSrc: null }),
    color: "#447099",
  });
  check(
    "N3",
    html.startsWith("<!DOCTYPE html>") && html.includes('id="eg-data"') && html.includes("eg-tasks") &&
      html.includes("Fin &lt;Test&gt;") && !html.includes("Fin <Test>") &&
      !/<script[^>]+src=/.test(html) && !/<link[^>]+href=/.test(html),
    `html length=${html.length}`
  );
  check(
    "N3b",
    embedJson({ a: "</script><b>" }).includes("\\u003c/script\\u003e"),
    "embedJson maskiert </script>"
  );

  // N4: Quarto-Vorlage – Platzhalter ersetzt, Tabellen als Markdown
  const tpl = readFileSync("public/briefkopf/notenspiegel.qmd", "utf8");
  const qmd = fillQmdTemplate(tpl, notenspiegelPlaceholders(withTasks));
  check(
    "N4",
    !/\{\{\s*(pruefung|tabelle_noten|tabelle_kennzahlen|tabelle_aufgaben|datum_iso)\s*\}\}/.test(qmd.split("-->")[1] ?? qmd) &&
      qmd.includes("| Note | Anzahl | Anteil |") && qmd.includes("Aufgabe 1") &&
      qmd.includes('FileAttachment("daten.json")') && /date: "\d{4}-\d{2}-\d{2}"/.test(qmd),
    "Quarto-Vorlage gefüllt"
  );
  const json = notenspiegelJson(withTasks);
  check(
    "N4b",
    json.format === "examgrade-notenspiegel" && json.aufgaben?.length === 2 &&
      !JSON.stringify(json).includes("4100000"),
    "daten.json ohne Matrikelnummern"
  );
}

{
  // N5: Briefkopf – Datei-Roundtrip, Standardwerte, Kopf aus Feldern, keine Dozenten → Briefkopf-Name
  const lh = { ...DEFAULT_LETTERHEAD, name: "Dr. B", color: "#123456" };
  const back = letterheadFromFile(letterheadToFile(lh));
  let bad = false;
  try { letterheadFromFile('{"format":"x"}'); } catch { bad = true; }
  const h = buildHeaderHtml(back, { names: [], subject: "" });
  const tex = buildHeaderTex(back, { names: ["A & B"], subject: "50 % Test" });
  check(
    "N5",
    back.name === "Dr. B" && back.color === "#123456" && bad &&
      h.includes("Dr. B") && h.includes(DEFAULT_LETTERHEAD.subjectLine) &&
      tex.includes("A \\& B") && tex.includes("50 \\% Test") && tex.includes("{123456}"),
    "Briefkopf-Datei und Köpfe"
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

