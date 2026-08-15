import type {
  AssessmentCriterion,
  CriterionScale,
  ExamProject,
  GradeSchema,
  PointsRecord,
} from "@/lib/types";
import { calculateGrade } from "@/lib/grades/schema";
import { roundToNearestGermanGrade } from "@/lib/grades/portfolio";

export const CRITERION_SCALE_LABELS: Record<CriterionScale, string> = {
  percent: "Prozent (0–100)",
  points: "Punkte",
  grade: "Note (1,0–5,0)",
};

/** Kurze Skalenangabe für Spaltenköpfe (z. B. „0–100 %“) */
export function criterionScaleShort(c: AssessmentCriterion): string {
  switch (c.scale) {
    case "percent":
      return "0–100 %";
    case "grade":
      return "Note 1–5";
    case "points": {
      const max =
        c.maxPoints != null && c.maxPoints > 0 ? c.maxPoints : null;
      return max != null ? `Punkte 0–${max}` : "Punkte";
    }
    default:
      return CRITERION_SCALE_LABELS[c.scale] ?? "Wert";
  }
}

/** Placeholder im Eingabefeld */
export function criterionPlaceholder(c: AssessmentCriterion): string {
  switch (c.scale) {
    case "percent":
      return "0–100";
    case "grade":
      return "1,0–5,0";
    case "points": {
      const max =
        c.maxPoints != null && c.maxPoints > 0 ? c.maxPoints : null;
      return max != null ? `0–${max}` : "Punkte";
    }
    default:
      return "–";
  }
}

/**
 * Ausführlicher Hinweis für Tooltip / aria / title:
 * Skala, Bereich, Gewicht, Dezimalformat.
 */
export function criterionScaleHint(c: AssessmentCriterion): string {
  const scaleLine =
    c.scale === "points" && c.maxPoints != null && c.maxPoints > 0
      ? `Punkte von 0 bis ${c.maxPoints} (Max. des Kriteriums)`
      : CRITERION_SCALE_LABELS[c.scale];
  const name = c.name?.trim() || c.code || "Kriterium";
  const weight =
    Number.isFinite(c.weight) && c.weight > 0
      ? `Relatives Gewicht: ${c.weight}`
      : "Gewicht: –";
  return [
    name,
    `Eingabe: ${scaleLine}`,
    weight,
    "Dezimalzahlen mit Komma oder Punkt (z. B. 1,3 oder 12,5).",
  ].join(" · ");
}

/**
 * Hover-Text für Bewertung: ausführliche Beschreibung + technische Hinweise.
 * Mehrzeilig (TooltipContent mit whitespace-pre-wrap).
 */
export function criterionDetailTooltip(c: AssessmentCriterion): string {
  const name = c.name?.trim() || c.code || "Kriterium";
  const desc = c.description?.trim() ?? "";
  const scaleLine =
    c.scale === "points" && c.maxPoints != null && c.maxPoints > 0
      ? `Punkte 0–${c.maxPoints}`
      : CRITERION_SCALE_LABELS[c.scale];
  const weight =
    Number.isFinite(c.weight) && c.weight > 0
      ? `Gewicht ${c.weight}`
      : "Gewicht –";
  const meta = `${name} · ${scaleLine} · ${weight}`;
  if (!desc) {
    return [
      meta,
      "Dezimalzahlen mit Komma oder Punkt (z. B. 1,3 oder 12,5).",
    ].join("\n");
  }
  return [
    name,
    desc,
    `${scaleLine} · ${weight}`,
    "Dezimalzahlen mit Komma oder Punkt.",
  ].join("\n\n");
}

/** Note → 0…1 (1,0 = best, 5,0 = 0) */
export function gradeToUnit(grade: number): number {
  if (!Number.isFinite(grade)) return 0;
  return Math.min(1, Math.max(0, (5 - grade) / 4));
}

/** Einzelkriterium → Norm 0…1; null wenn ungültig/leer */
export function normalizeCriterionValue(
  value: number | null | undefined,
  criterion: AssessmentCriterion
): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  switch (criterion.scale) {
    case "percent":
      return Math.min(1, Math.max(0, value / 100));
    case "points": {
      const max = criterion.maxPoints && criterion.maxPoints > 0
        ? criterion.maxPoints
        : 0;
      if (max <= 0) return null;
      return Math.min(1, Math.max(0, value / max));
    }
    case "grade":
      return gradeToUnit(value);
    default:
      return null;
  }
}

/**
 * Gewichteter Gesamtwert auf Skala 0…maxPoints.
 * Nur wenn **alle** Kriterien einen Wert haben; sonst null.
 */
export function computeCriteriaTotalPoints(
  criterionValues: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[],
  maxPoints: number
): number | null {
  if (!criteria.length) return null;
  const vals = criterionValues ?? {};
  let weightSum = 0;
  let acc = 0;
  for (const c of criteria) {
    const w = Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0;
    if (w <= 0) continue;
    const unit = normalizeCriterionValue(vals[c.id], c);
    if (unit == null) return null;
    weightSum += w;
    acc += unit * w;
  }
  if (weightSum <= 0) return null;
  const safeMax = Math.max(0, maxPoints);
  return Math.round((acc / weightSum) * safeMax * 100) / 100;
}

/** Gewicht ≤ 0 = Kriterium/TL deaktiviert (überall gleich). */
export function isActiveWeight(weight: number | null | undefined): boolean {
  return Number.isFinite(weight) && (weight as number) > 0;
}

export function activeCriteria(
  criteria: AssessmentCriterion[] | undefined | null
): AssessmentCriterion[] {
  return (criteria ?? []).filter((c) => isActiveWeight(c.weight));
}

export function criteriaAllFilled(
  criterionValues: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[]
): boolean {
  const list = activeCriteria(criteria);
  if (!list.length) return false;
  const vals = criterionValues ?? {};
  return list.every((c) => {
    const v = vals[c.id];
    return v != null && Number.isFinite(v);
  });
}

export function countMissingCriteria(
  criterionValues: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[]
): number {
  if (!criteria.length) return 0;
  const vals = criterionValues ?? {};
  return criteria.filter((c) => {
    const w = Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0;
    if (w <= 0) return false;
    const v = vals[c.id];
    return v == null || !Number.isFinite(v);
  }).length;
}

/** Alle aktiven Kriterien (Gewicht > 0) haben die Skala Note. */
export function staCriteriaAllGradeScale(
  criteria: AssessmentCriterion[] | undefined | null
): boolean {
  const active = (criteria ?? []).filter(
    (c) => Number.isFinite(c.weight) && c.weight > 0
  );
  return active.length > 0 && active.every((c) => c.scale === "grade");
}

/**
 * Amtsnote StA: reine Note-Kriterien → gewichtetes Notenmittel;
 * sonst Erfüllung × Schema (wie bisher).
 */
export function computeStaFinalGrade(
  criterionValues: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[],
  schema: GradeSchema
): number | null {
  const active = criteria.filter(
    (c) => Number.isFinite(c.weight) && c.weight > 0
  );
  if (!active.length) return null;
  if (staCriteriaAllGradeScale(criteria)) {
    const vals = criterionValues ?? {};
    let wSum = 0;
    let acc = 0;
    for (const c of active) {
      const v = vals[c.id];
      if (v == null || !Number.isFinite(v)) return null;
      const w = c.weight;
      acc += Math.min(5, Math.max(1, v)) * w;
      wSum += w;
    }
    if (wSum <= 0) return null;
    return roundToNearestGermanGrade(acc / wSum);
  }
  const pts = computeCriteriaTotalPoints(criterionValues, criteria, schema.maxPoints);
  if (pts == null) return null;
  return calculateGrade(pts, schema);
}

/** Punkte-Record nach Kriterien neu berechnen */
export function recomputeStaCriteriaRecord(
  rec: PointsRecord,
  criteria: AssessmentCriterion[],
  maxPoints: number
): PointsRecord {
  const totalPoints = computeCriteriaTotalPoints(
    rec.criterionValues,
    criteria,
    maxPoints
  );
  return {
    ...rec,
    totalPoints,
    source: rec.source === "moodle" ? "mixed" : rec.source || "manual",
  };
}

export function projectHasCriteria(project: ExamProject): boolean {
  return (project.criteria?.length ?? 0) > 0;
}

/** Einheitliche KI-taugliche Punktskala für Standardkriterien */
export const DEFAULT_CRITERION_MAX_POINTS = 6;

export const DEFAULT_STA_CRITERION_CODES = [
  "ABZ",
  "FACH",
  "METH",
  "QUEL",
  "SPEZ",
  "REPR",
] as const;

export type DefaultStaCriterionCode =
  (typeof DEFAULT_STA_CRITERION_CODES)[number];

/** Portfolio-TL Arbeitsergebnis */
export const PORTFOLIO_RESULT_CRITERION_CODES = [
  "ABZ",
  "FACH",
  "SPEZ",
] as const;

/** Portfolio-TL Nachvollziehbarkeit */
export const PORTFOLIO_TRACE_CRITERION_CODES = [
  "METH",
  "QUEL",
  "REPR",
] as const;

type DefaultStaDef = {
  name: string;
  weight: number;
  full: string;
  mid: string;
  none: string;
};

const DEFAULT_STA_DEFS: Record<DefaultStaCriterionCode, DefaultStaDef> = {
  ABZ: {
    name: "Aufgabenbezug und Fragestellung",
    weight: 2,
    full: "Aufgabenstellung vollständig und konkret getroffen.",
    mid: "Bezug erkennbar, aber teilweise allgemein oder unvollständig.",
    none: "Fragestellung verfehlt oder nur oberflächlich berührt.",
  },
  FACH: {
    name: "Fachliche Korrektheit",
    weight: 3,
    full: "Rechnung, Code oder Begriffe in der Stichprobe korrekt.",
    mid: "Wesentliche Teile richtig, einzelne fachliche Fehler.",
    none: "Zentrale Aussagen fachlich falsch oder nicht prüfbar.",
  },
  METH: {
    name: "Methode und Begründung",
    weight: 2,
    full: "Vorgehen begründet, Alternativen und Grenzen benannt.",
    mid: "Methode erkennbar, Begründung dünn oder lückenhaft.",
    none: "Kein nachvollziehbares Vorgehen oder reine Behauptung.",
  },
  QUEL: {
    name: "Quellen und Belege",
    weight: 2,
    full: "Zentrale Belege vorhanden, prüfbar und inhaltlich passend.",
    mid: "Quellen vorhanden, aber lückenhaft oder schwach belegt.",
    none: "Fehlende, tote oder erfundene Belege (DOI/Seiten/Inhalt).",
  },
  SPEZ: {
    name: "Spezifität statt Generik",
    weight: 2,
    full: "Eigene Daten, Fall oder Zahlen – keine Lehrbuchphrasen.",
    mid: "Teilweise konkret, teilweise austauschbar allgemein.",
    none: "Rein generischer Text ohne erkennbaren eigenen Bezug.",
  },
  REPR: {
    name: "Reproduzierbarkeit",
    weight: 2,
    full: "Workflow/Notebook ausführbar, Ergebnis nachvollziehbar.",
    mid: "Schritte grob nachvollziehbar, Ausführung lückenhaft.",
    none: "Nicht ausführbar oder nur beschreibend ohne Artefakt.",
  },
};

/** Stufenanker 6 / 3 / 0 für die Punkte-Skala */
export function criterionPointsRubric(
  full: string,
  mid: string,
  none: string
): string {
  return `Skala 0–6 Punkte.\n6: ${full}\n3: ${mid}\n0: ${none}`;
}

export function defaultStaCriteria(
  createId: (prefix: string) => string,
  codes: readonly DefaultStaCriterionCode[] = DEFAULT_STA_CRITERION_CODES
): AssessmentCriterion[] {
  return codes.map((code) => {
    const d = DEFAULT_STA_DEFS[code];
    return {
      id: createId("crit"),
      name: d.name,
      code,
      weight: d.weight,
      scale: "points" as const,
      maxPoints: DEFAULT_CRITERION_MAX_POINTS,
      description: criterionPointsRubric(d.full, d.mid, d.none),
    };
  });
}

/**
 * Fehlende Standardkriterien anhängen (bestehende IDs/Werte bleiben).
 */
export function mergeDefaultStaCriteria(
  existing: AssessmentCriterion[] | undefined,
  createId: (prefix: string) => string,
  codes: readonly DefaultStaCriterionCode[] = DEFAULT_STA_CRITERION_CODES
): AssessmentCriterion[] {
  const current = existing ?? [];
  const have = new Set(current.map((c) => c.code.trim().toUpperCase()));
  const missing = codes.filter((code) => !have.has(code));
  if (missing.length === 0) return current;
  return [...current, ...defaultStaCriteria(createId, missing)];
}

export function defaultCriteriaForPortfolioComponent(
  component: { code?: string; name?: string },
  index: number,
  createId: (prefix: string) => string
): AssessmentCriterion[] {
  const blob = `${component.code ?? ""} ${component.name ?? ""}`.toLowerCase();
  if (
    index === 0 ||
    /arbeit|ergebnis|\bae\b|tl1/.test(blob)
  ) {
    return defaultStaCriteria(createId, PORTFOLIO_RESULT_CRITERION_CODES);
  }
  if (
    index === 1 ||
    /nachvoll|\bnv\b|tl2/.test(blob)
  ) {
    return defaultStaCriteria(createId, PORTFOLIO_TRACE_CRITERION_CODES);
  }
  return defaultStaCriteria(createId, ["ABZ", "FACH"]);
}
