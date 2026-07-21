/**
 * Analyse Bearbeitungsdauer ↔ Punkte (THE/Moodle) – gemeinsam für UI und Export.
 */

import type { ExamProject } from "@/lib/types";
import { isOnlineStyleExam } from "@/lib/types";
import { calculateGrade } from "@/lib/grades/schema";
import { computeEffectiveTotal } from "@/lib/grades/points-total";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import {
  formatPValue,
  linearRegression,
  type LinearRegressionResult,
} from "@/lib/grades/linear-regression";
import {
  gradeBucketForGrade,
  GRADE_BUCKET_COLORS,
  type GradeBucketKey,
} from "@/lib/grades/notenspiegel";
import { formatStat } from "@/lib/utils";

export type DurationYMode = "points" | "percent";

export type DurationScatterPoint = {
  x: number;
  y: number;
  totalPoints: number;
  name: string;
  lastName: string;
  firstName: string;
  matnr: string;
  programCode: string;
  grade: number;
  gradeLabel: string;
  bucket: GradeBucketKey;
  color: string;
  kind: "student";
};

export type DurationHistogramBin = {
  bin: string;
  from: number;
  to: number;
  count: number;
};

export type DurationPointsAnalysis = {
  available: boolean;
  yMode: DurationYMode;
  maxPoints: number;
  yAxisLabel: string;
  yUnitShort: string;
  slopeUnit: string;
  points: DurationScatterPoint[];
  regression: LinearRegressionResult | null;
  lineData: { x: number; yHat: number }[];
  nWithDuration: number;
  durations: number[];
};

function resolveProgramCode(
  project: ExamProject,
  matKey: string,
  manual?: string | null
): string {
  for (const src of project.hisSources ?? []) {
    const row = src.rows?.find(
      (hr) => normalizeMatriculation(hr.matriculationNumber) === matKey
    );
    if (row && src.programCode) return src.programCode;
  }
  const his = project.hisRows?.find(
    (hr) => normalizeMatriculation(hr.matriculationNumber) === matKey
  );
  if (his?.sourceId) {
    return (
      project.hisSources?.find((s) => s.id === his.sourceId)?.programCode ??
      ""
    );
  }
  return manual?.trim() || "";
}

export function buildDurationPointsAnalysis(
  project: ExamProject,
  yMode: DurationYMode = "points"
): DurationPointsAnalysis {
  const maxPoints = Math.max(1, project.gradeSchema.maxPoints || 1);
  const yAxisLabel =
    yMode === "percent" ? `% von max. (${maxPoints} Pkt.)` : "Punkte";
  const yUnitShort = yMode === "percent" ? "%" : "Pkt.";
  const slopeUnit = yMode === "percent" ? "%/min" : "Pkte/min";
  const empty: DurationPointsAnalysis = {
    available: false,
    yMode,
    maxPoints,
    yAxisLabel,
    yUnitShort,
    slopeUnit,
    points: [],
    regression: null,
    lineData: [],
    nWithDuration: 0,
    durations: [],
  };

  if (!isOnlineStyleExam(project.examType)) return empty;

  const pts: DurationScatterPoint[] = [];
  const durations: number[] = [];

  for (const rec of project.points ?? []) {
    const dur = rec.processingDurationMinutes;
    const total = computeEffectiveTotal(rec);
    if (dur == null || !Number.isFinite(dur) || dur <= 0) continue;
    if (total == null || !Number.isFinite(total)) continue;

    const grade =
      rec.gradeOverride != null && Number.isFinite(rec.gradeOverride)
        ? rec.gradeOverride
        : calculateGrade(total, project.gradeSchema);
    const bucket = gradeBucketForGrade(grade);
    const key =
      normalizeMatriculation(rec.matriculationNumber) ??
      rec.matriculationNumber;
    const st = project.students[key] ?? null;
    const lastName = st?.lastName?.trim() || "";
    const firstName = st?.firstName?.trim() || "";
    const name =
      lastName || firstName
        ? `${lastName}${lastName && firstName ? ", " : ""}${firstName}`
        : key;
    const programCode = resolveProgramCode(
      project,
      key,
      rec.manualProgramCode
    );
    const y =
      yMode === "percent"
        ? Math.round((total / maxPoints) * 1000) / 10
        : total;

    durations.push(dur);
    pts.push({
      x: dur,
      y,
      totalPoints: total,
      name,
      lastName,
      firstName,
      matnr: key,
      programCode,
      grade,
      gradeLabel: grade.toFixed(1).replace(".", ","),
      bucket,
      color: GRADE_BUCKET_COLORS[bucket],
      kind: "student",
    });
  }

  const reg = linearRegression(
    pts.map((p) => p.x),
    pts.map((p) => p.y)
  );
  let line: { x: number; yHat: number }[] = [];
  if (reg && pts.length >= 2) {
    const xs = pts.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    line = [
      { x: minX, yHat: reg.predict(minX) },
      { x: maxX, yHat: reg.predict(maxX) },
    ];
  }

  return {
    available: pts.length > 0,
    yMode,
    maxPoints,
    yAxisLabel,
    yUnitShort,
    slopeUnit,
    points: pts,
    regression: reg,
    lineData: line,
    nWithDuration: pts.length,
    durations,
  };
}

/** Histogramm der Bearbeitungsdauer (Minuten). */
export function buildDurationHistogram(
  durations: number[],
  preferredBinWidthMin = 10
): DurationHistogramBin[] {
  if (durations.length === 0) return [];
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const lo = Math.floor(min / preferredBinWidthMin) * preferredBinWidthMin;
  let hi =
    Math.ceil(max / preferredBinWidthMin) * preferredBinWidthMin;
  if (hi <= lo) hi = lo + preferredBinWidthMin;

  let binWidth = preferredBinWidthMin;
  let binCount = Math.round((hi - lo) / binWidth);
  // zu viele Balken → breitere Bins
  if (binCount > 14) {
    binWidth = Math.ceil(binCount / 12) * preferredBinWidthMin;
    binCount = Math.ceil((hi - lo) / binWidth);
    hi = lo + binCount * binWidth;
  }
  // zu wenige bei großer Spanne
  if (binCount < 4 && max - min > preferredBinWidthMin) {
    binWidth = Math.max(5, Math.ceil((max - min) / 8 / 5) * 5);
    binCount = Math.max(1, Math.ceil((hi - lo) / binWidth));
    hi = lo + binCount * binWidth;
  }

  return Array.from({ length: binCount }, (_, i) => {
    const from = lo + i * binWidth;
    const to = from + binWidth;
    const count = durations.filter((d) =>
      i === binCount - 1 ? d >= from && d <= to : d >= from && d < to
    ).length;
    return {
      bin: `${from}–${to}`,
      from,
      to,
      count,
    };
  });
}

export type RegressionTableRow = {
  name: string;
  symbol: string;
  value: string;
  unit: string;
  se: string;
  t: string;
  pValue: string;
};

export type FitStatRow = {
  name: string;
  symbol: string;
  value: string;
  note?: string;
};

/** Zeilen für Koeffizienten-Tabelle (a, b) inkl. p-Wert. */
export function regressionCoefficientRows(
  reg: LinearRegressionResult,
  opts: { yUnitShort: string; slopeUnit: string; yMode: DurationYMode }
): RegressionTableRow[] {
  const yUnit = opts.yMode === "percent" ? "%" : opts.yUnitShort;
  return [
    {
      name: "Achsenabschnitt",
      symbol: "a",
      value: formatStat(reg.intercept, 3),
      unit: yUnit,
      se: formatStat(reg.seIntercept, 4),
      t: formatStat(reg.tStatIntercept, 3),
      pValue: formatPValue(reg.pValueIntercept),
    },
    {
      name: "Steigung",
      symbol: "b",
      value: formatStat(reg.slope, 4),
      unit: opts.slopeUnit,
      se: formatStat(reg.seSlope, 4),
      t: formatStat(reg.tStat, 3),
      pValue: formatPValue(reg.pValue),
    },
  ];
}

/** Weitere Gütemaße strukturiert. */
export function regressionFitRows(
  reg: LinearRegressionResult
): FitStatRow[] {
  return [
    {
      name: "Bestimmtheitsmaß",
      symbol: "R²",
      value: formatStat(reg.rSquared, 3),
      note: "Anteil erklärter Varianz",
    },
    {
      name: "Pearson-Korrelation",
      symbol: "r",
      value: formatStat(reg.r, 3),
      note: "linearer Zusammenhang",
    },
    {
      name: "Residual-Standardfehler",
      symbol: "s",
      value: formatStat(reg.residualSe, 3),
      note: "√(SSE / df)",
    },
    {
      name: "Stichprobenumfang",
      symbol: "n",
      value: String(reg.n),
    },
    {
      name: "Freiheitsgrade",
      symbol: "df",
      value: String(reg.df),
      note: "n − 2",
    },
    {
      name: "Mittelwert Dauer",
      symbol: "t̄",
      value: formatStat(reg.meanX, 2),
      note: "min",
    },
    {
      name: "Mittelwert y",
      symbol: "ȳ",
      value: formatStat(reg.meanY, 2),
    },
  ];
}

/** Modellformel als Klartext (PDF/Excel, Latin-1-sicher). */
export function regressionModelFormulaText(
  yMode: DurationYMode,
  maxPoints: number
): string {
  if (yMode === "percent") {
    return `ŷ = a + b · t   mit  ŷ = % von max. (${maxPoints} Pkt.), t = Dauer (min)`;
  }
  return "ŷ = a + b · t   mit  ŷ = Punkte, t = Bearbeitungsdauer (min)";
}
