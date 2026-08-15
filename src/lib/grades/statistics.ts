import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
  FailerAnalysis,
  GradeSchema,
} from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";
import { median, quantile } from "@/lib/stats/quantile";

/** Nächste zulässige deutsche Note (Gleichstand → bessere Note). Für die Verteilung. */
export function nearestGermanGrade(grade: number): number {
  if (!Number.isFinite(grade)) return 5.0;
  let best: number = GERMAN_GRADES[GERMAN_GRADES.length - 1];
  let bestDist = Infinity;
  for (const g of GERMAN_GRADES) {
    const d = Math.abs(g - grade);
    if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) < 1e-9 && g < best)) {
      best = g;
      bestDist = d;
    }
  }
  return best;
}

/** Stichproben-Standardabweichung (n−1) */
function stdDevSample(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Sinnvolle Grenzfall-Schwelle für „bis nächste Note“.
 * - Notengrade: 0,1 (Stufen ≈ 0,3 – nicht die ganze Kohorte)
 * - Punkte: ca. max/50, geklemmt auf 0,5…2 (bei max 100 → 2 Pkt.)
 */
export function defaultBorderlineMax(
  unit: "points" | "grade" = "points",
  maxPoints?: number
): number {
  if (unit === "grade") return 0.1;
  const max = maxPoints != null && maxPoints > 0 ? maxPoints : 100;
  const raw = Math.round((max / 50) * 10) / 10;
  return Math.min(2, Math.max(0.5, raw));
}

/** Einheit aus Zeilen ableiten (Mehrheit / erste gesetzte). */
export function resolveNextGradeUnit(
  rows: EnrichedStudentRow[]
): "points" | "grade" {
  for (const r of rows) {
    if (r.nextGradeUnit === "grade" || r.nextGradeUnit === "points") {
      return r.nextGradeUnit;
    }
  }
  return "points";
}

/**
 * Dieselbe Person in mehreren HIS-Quellen erscheint mehrfach in `rows`.
 * Kennzahlen (Ø, Quote, Anmeldungen) zählen jede Matrikel nur einmal.
 */
export function uniqueRowsByMatriculation(
  rows: EnrichedStudentRow[]
): EnrichedStudentRow[] {
  const seen = new Set<string>();
  const out: EnrichedStudentRow[] = [];
  for (const r of rows) {
    const k = r.key?.trim();
    if (!k) {
      out.push(r);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export function computeStatistics(
  rows: EnrichedStudentRow[],
  schema: GradeSchema,
  borderlineMax?: number,
  project?: ExamProject | null
): ExamStatistics {
  const unique = uniqueRowsByMatriculation(rows);
  const unit = resolveNextGradeUnit(unique);
  const effectiveBorderline =
    borderlineMax ?? defaultBorderlineMax(unit, schema.maxPoints);
  const hasAttendanceList = (project?.attendance.length ?? 0) > 0;
  const attendanceImported = project?.attendance.length ?? 0;

  const inHis = unique.filter((r) => r.inHis);
  const registered = inHis.length;
  const attended = inHis.filter((r) => r.attended === true).length;
  const attendedOrphan = unique.filter(
    (r) => r.attendanceWithoutHis || (!r.inHis && r.attended === true)
  ).length;
  const noShow = inHis.filter((r) => r.status === "no_show").length;
  const withPoints = unique.filter((r) => r.hasPoints).length;
  const graded = unique.filter((r) => r.finalGrade != null).length;
  const exportReady = unique.filter(
    (r) => r.status === "export_ready" || r.status === "no_show"
  ).length;
  const mismatches = unique.filter((r) => r.status === "mismatch").length;

  const grades = unique
    .filter((r) => r.finalGrade != null && r.attended !== false && r.hasPoints)
    .map((r) => r.finalGrade as number);

  const points = unique
    .filter((r) => r.totalPoints != null)
    .map((r) => r.totalPoints as number);

  const passed = grades.filter((g) => g <= 4.0).length;
  const failCount = unique.filter((r) => r.isFailed).length;
  const borderlineCount = unique.filter(
    (r) =>
      r.pointsToNext != null &&
      r.pointsToNext <= effectiveBorderline &&
      r.pointsToNext > 0 &&
      !r.isFailed
  ).length;

  const snapped = grades.map(nearestGermanGrade);
  const gradeKeys = [...GERMAN_GRADES];
  const gradeDistribution = gradeKeys.map((grade) => ({
    grade,
    count: snapped.filter((g) => Math.abs(g - grade) < 1e-9).length,
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
    noShow,
    noShowRate:
      registered > 0 && (hasAttendanceList || noShow > 0)
        ? noShow / registered
        : null,
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
    gradeSampleSize: grades.length,
    gradeDistribution,
    pointsHistogram,
  };
}

/** Interne Prüfer-Analyse der Durchfaller (keine Studierenden-Kommunikation) */
export function computeFailerAnalysis(
  rows: EnrichedStudentRow[]
): FailerAnalysis {
  const failers = uniqueRowsByMatriculation(rows).filter((r) => r.isFailed);
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
