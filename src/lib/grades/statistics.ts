import type {
  EnrichedStudentRow,
  ExamStatistics,
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

export function computeStatistics(
  rows: EnrichedStudentRow[],
  schema: GradeSchema
): ExamStatistics {
  const inHis = rows.filter((r) => r.inHis);
  const registered = inHis.length;
  const attended = inHis.filter((r) => r.attended === true).length;
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

  // Notenverteilung (feste deutsche Noten)
  const gradeKeys = [1, 1.3, 1.7, 2, 2.3, 2.7, 3, 3.3, 3.7, 4, 5];
  const gradeDistribution = gradeKeys.map((grade) => ({
    grade,
    count: grades.filter((g) => Math.abs(g - grade) < 0.05).length,
  }));

  // Punkte-Histogramm in 10 Bins
  const maxP = schema.maxPoints || 100;
  const binCount = 10;
  const binWidth = maxP / binCount;
  const pointsHistogram = Array.from({ length: binCount }, (_, i) => {
    const from = Math.round(i * binWidth * 10) / 10;
    const to = Math.round((i + 1) * binWidth * 10) / 10;
    const count = points.filter((p) =>
      i === binCount - 1 ? p >= from && p <= to : p >= from && p < to
    ).length;
    return {
      bin: `${from}–${to}`,
      from,
      to,
      count,
    };
  });

  return {
    registered,
    attended,
    noShow,
    noShowRate: registered > 0 ? noShow / registered : null,
    withPoints,
    graded,
    exportReady,
    mismatches,
    averageGrade:
      grades.length > 0
        ? grades.reduce((a, b) => a + b, 0) / grades.length
        : null,
    medianGrade: median(grades),
    passRate: grades.length > 0 ? passed / grades.length : null,
    averagePoints:
      points.length > 0
        ? points.reduce((a, b) => a + b, 0) / points.length
        : null,
    gradeDistribution,
    pointsHistogram,
  };
}
