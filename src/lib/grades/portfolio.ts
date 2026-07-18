import type {
  ExamProject,
  PointsRecord,
  PortfolioComponent,
} from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";

/** Nächste zulässige deutsche Note (1,0 … 5,0) */
export function roundToNearestGermanGrade(raw: number): number {
  if (!Number.isFinite(raw)) return 5.0;
  const clamped = Math.min(5, Math.max(1, raw));
  let best: number = GERMAN_GRADES[GERMAN_GRADES.length - 1];
  let bestDist = Infinity;
  for (const g of GERMAN_GRADES) {
    const d = Math.abs(g - clamped);
    if (d < bestDist - 1e-9 || (Math.abs(d - bestDist) < 1e-9 && g < best)) {
      best = g;
      bestDist = d;
    }
  }
  return best;
}

/**
 * Gewichteter Mittelwert der Teilnoten.
 * Nur wenn alle Teilleistungen eine Note haben.
 */
export function computePortfolioRawAverage(
  portfolioGrades: Record<string, number | null | undefined> | undefined,
  components: PortfolioComponent[]
): number | null {
  if (!components.length) return null;
  const vals = portfolioGrades ?? {};
  let wSum = 0;
  let acc = 0;
  for (const c of components) {
    const w = Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0;
    if (w <= 0) continue;
    const g = vals[c.id];
    if (g == null || !Number.isFinite(g)) return null;
    const note = Math.min(5, Math.max(1, g));
    wSum += w;
    acc += note * w;
  }
  if (wSum <= 0) return null;
  return Math.round((acc / wSum) * 1000) / 1000;
}

export function computePortfolioGrade(
  portfolioGrades: Record<string, number | null | undefined> | undefined,
  components: PortfolioComponent[]
): number | null {
  const raw = computePortfolioRawAverage(portfolioGrades, components);
  if (raw == null) return null;
  return roundToNearestGermanGrade(raw);
}

export function countMissingPortfolioGrades(
  portfolioGrades: Record<string, number | null | undefined> | undefined,
  components: PortfolioComponent[]
): number {
  if (!components.length) return 0;
  const vals = portfolioGrades ?? {};
  return components.filter((c) => {
    const g = vals[c.id];
    return g == null || !Number.isFinite(g);
  }).length;
}

export function recomputePortfolioRecord(rec: PointsRecord): PointsRecord {
  // Keine Fake-Punkte; Note wird im Enrichment aus portfolioGrades berechnet
  return {
    ...rec,
    source: rec.source === "moodle" ? "mixed" : rec.source || "manual",
  };
}

export function defaultPortfolioComponents(
  createId: (prefix: string) => string
): PortfolioComponent[] {
  return [
    {
      id: createId("pc"),
      name: "Teilleistung 1",
      code: "TL1",
      weight: 1,
    },
    {
      id: createId("pc"),
      name: "Teilleistung 2",
      code: "TL2",
      weight: 1,
    },
  ];
}

export function projectHasPortfolioComponents(project: ExamProject): boolean {
  return (project.portfolioComponents?.length ?? 0) > 0;
}
