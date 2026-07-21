import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
  FailerAnalysis,
  GradeSchema,
} from "@/lib/types";

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Quantil p ∈ [0, 1] mit linearer Interpolation (R type-7 / Excel PERCENTILE).
 */
function quantile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  if (p <= 0) return Math.min(...values);
  if (p >= 1) return Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const t = idx - lo;
  return sorted[lo] * (1 - t) + sorted[hi] * t;
}

/** Stichproben-Standardabweichung (n−1) */
function stdDevSample(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function computeStatistics(
  rows: EnrichedStudentRow[],
  schema: GradeSchema,
  borderlineMax = 1,
  project?: ExamProject | null
): ExamStatistics {
  const hasAttendanceList = (project?.attendance.length ?? 0) > 0;
  const attendanceImported = project?.attendance.length ?? 0;

  const inHis = rows.filter((r) => r.inHis);
  const registered = inHis.length;
  const attended = inHis.filter((r) => r.attended === true).length;
  const attendedOrphan = rows.filter(
    (r) => r.attendanceWithoutHis || (!r.inHis && r.attended === true)
  ).length;
  const noShow = inHis.filter(
    (r) => r.status === "no_show" || r.attended === false
  ).length;
  const withPoints = rows.filter((r) => r.hasPoints).length;
  const graded = rows.filter((r) => r.finalGrade != null).length;
  const exportReady = rows.filter(
    (r) => r.status === "export_ready" || r.status === "no_show"
  ).length;
  const mismatches = rows.filter((r) => r.status === "mismatch").length;

  const grades = rows
    .filter((r) => r.finalGrade != null && r.attended !== false && r.hasPoints)
    .map((r) => r.finalGrade as number);

  const points = rows
    .filter((r) => r.totalPoints != null)
    .map((r) => r.totalPoints as number);

  const passed = grades.filter((g) => g <= 4.0).length;
  const failCount = rows.filter((r) => r.isFailed).length;
  const borderlineCount = rows.filter(
    (r) =>
      r.pointsToNext != null &&
      r.pointsToNext <= borderlineMax &&
      r.pointsToNext > 0 &&
      !r.isFailed
  ).length;

  const gradeKeys = [1, 1.3, 1.7, 2, 2.3, 2.7, 3, 3.3, 3.7, 4, 5];
  const gradeDistribution = gradeKeys.map((grade) => ({
    grade,
    count: grades.filter((g) => Math.abs(g - grade) < 0.05).length,
  }));

  const maxP = schema.maxPoints || 100;
  const binCount = 10;
  const binWidth = maxP / binCount;
  const pointsHistogram = Array.from({ length: binCount }, (_, i) => {
    const from = Math.round(i * binWidth * 10) / 10;
    const to = Math.round((i + 1) * binWidth * 10) / 10;
    const count = points.filter((p) =>
      i === binCount - 1 ? p >= from && p <= to : p >= from && p < to
    ).length;
    return { bin: `${from}–${to}`, from, to, count };
  });

  return {
    registered,
    attended,
    attendanceImported,
    attendedOrphan,
    noShow: hasAttendanceList ? noShow : 0,
    noShowRate:
      hasAttendanceList && registered > 0 ? noShow / registered : null,
    hasAttendanceList,
    withPoints,
    graded,
    exportReady,
    mismatches,
    averageGrade:
      grades.length > 0
        ? grades.reduce((a, b) => a + b, 0) / grades.length
        : null,
    medianGrade: median(grades),
    q25Grade: quantile(grades, 0.25),
    q75Grade: quantile(grades, 0.75),
    stdDevGrade: stdDevSample(grades),
    passRate: grades.length > 0 ? passed / grades.length : null,
    averagePoints:
      points.length > 0
        ? points.reduce((a, b) => a + b, 0) / points.length
        : null,
    medianPoints: median(points),
    stdDevPoints: stdDevSample(points),
    failCount,
    borderlineCount,
    gradeDistribution,
    pointsHistogram,
  };
}

/** Interne Prüfer-Analyse der Durchfaller (keine Studierenden-Kommunikation) */
export function computeFailerAnalysis(
  rows: EnrichedStudentRow[]
): FailerAnalysis {
  const failers = rows.filter((r) => r.isFailed);
  const pts = failers
    .map((r) => r.totalPoints)
    .filter((p): p is number => p != null);

  const nearPass = [0.5, 1, 1.5, 2, 3, 5].map((within) => ({
    within,
    count: failers.filter(
      (r) =>
        r.pointsBelowPass != null &&
        r.pointsBelowPass > 0 &&
        r.pointsBelowPass <= within
    ).length,
  }));

  return {
    count: failers.length,
    averagePoints:
      pts.length > 0 ? pts.reduce((a, b) => a + b, 0) / pts.length : null,
    medianPoints: median(pts),
    nearPass,
    rows: failers,
  };
}
