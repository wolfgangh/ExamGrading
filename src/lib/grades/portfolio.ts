import type {
  AssessmentCriterion,
  CriterionScale,
  ExamProject,
  GradeSchema,
  PointsRecord,
  PortfolioComponent,
} from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";
import { calculateGrade } from "@/lib/grades/schema";
import {
  countMissingCriteria,
  gradeToUnit,
  normalizeCriterionValue,
} from "@/lib/grades/sta-criteria";

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

/** Gleichgewichtetes Mittel der Dozenten-Noten für eine Teilleistung */
export function averageLecturerGradesForComponent(
  byLecturer:
    | Record<string, Record<string, number | null | undefined>>
    | undefined,
  componentId: string,
  lecturers: string[]
): number | null {
  const names = lecturers.map((l) => l.trim()).filter(Boolean);
  if (names.length === 0) return null;
  const perComp = byLecturer?.[componentId] ?? {};
  let acc = 0;
  for (const name of names) {
    const g = perComp[name];
    if (g == null || !Number.isFinite(g)) return null;
    acc += Math.min(5, Math.max(1, g));
  }
  return Math.round((acc / names.length) * 1000) / 1000;
}

export type GradeFromCriteriaOptions = {
  /** Kriterium-IDs, die nicht in die Berechnung einfließen */
  disabledCriterionIds?: readonly string[] | Set<string>;
};

/**
 * Gewichtete Kriterien → deutsche Note (1,0 best … 5,0).
 * Alle *aktiven* Kriterien müssen gesetzt sein.
 */
export function gradeFromCriterionValues(
  values: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[] | undefined | null,
  options?: GradeFromCriteriaOptions
): number | null {
  const disabled = options?.disabledCriterionIds
    ? options.disabledCriterionIds instanceof Set
      ? options.disabledCriterionIds
      : new Set(options.disabledCriterionIds)
    : null;
  const list = (criteria ?? []).filter((c) => !disabled?.has(c.id));
  if (!list.length) return null;
  const vals = values ?? {};
  let wSum = 0;
  let acc = 0;
  for (const c of list) {
    const w = Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0;
    if (w <= 0) continue;
    const unit = normalizeCriterionValue(vals[c.id], c);
    if (unit == null) return null;
    wSum += w;
    acc += unit * w;
  }
  if (wSum <= 0) return null;
  const unitAvg = acc / wSum;
  // unit 1 = best → Note 1,0; unit 0 → Note 5,0
  return roundToNearestGermanGrade(5 - 4 * unitAvg);
}

export type PortfolioProjectSlice = Pick<
  ExamProject,
  | "portfolioPerLecturerGrading"
  | "portfolioCriteriaMode"
  | "lecturers"
  | "portfolioComponents"
  | "studentGroups"
>;

export type PortfolioGradeContext = {
  /** Gruppe des Studierenden (für gruppenweise deaktivierte Kriterien) */
  groupId?: string | null;
  /** Optional: nur diese Teilleistung (Füllstand / Missing) */
  componentId?: string | null;
  /**
   * Notenschlüssel für TL mit criteriaScale points/percent.
   * Ohne Schema: Fallback 5−4·unit (wie grade-Skala).
   */
  schema?: GradeSchema | null;
};

/** Einheitliche Kriterien-Skala einer TL (Migration + Default). */
export function resolveComponentCriteriaScale(
  component: PortfolioComponent
): CriterionScale {
  if (
    component.criteriaScale === "percent" ||
    component.criteriaScale === "points" ||
    component.criteriaScale === "grade"
  ) {
    return component.criteriaScale;
  }
  const scales = (component.criteria ?? []).map((k) => k.scale);
  if (scales.length === 0) return "grade";
  const counts: Record<string, number> = {};
  for (const s of scales) {
    counts[s] = (counts[s] ?? 0) + 1;
  }
  let best: CriterionScale = scales[0];
  let bestN = 0;
  for (const [s, n] of Object.entries(counts)) {
    if (n > bestN) {
      bestN = n;
      best = s as CriterionScale;
    }
  }
  return best;
}

/** Skala auf TL und alle Kriterien schreiben (eine Bewertungsart je TL). */
export function withComponentCriteriaScale(
  component: PortfolioComponent,
  scale: CriterionScale
): PortfolioComponent {
  const defaultMax = scale === "points" ? 6 : undefined;
  return {
    ...component,
    criteriaScale: scale,
    criteria: (component.criteria ?? []).map((k) => ({
      ...k,
      scale,
      maxPoints:
        scale === "points"
          ? k.maxPoints != null && k.maxPoints > 0
            ? k.maxPoints
            : defaultMax
          : k.maxPoints,
    })),
  };
}

/** Portfolio nutzt Szenarien, wenn mind. eine TL Punkte/Prozent-Kriterien hat. */
export function portfolioUsesGradeScenarios(
  project: Pick<
    ExamProject,
    "examType" | "portfolioCriteriaMode" | "portfolioComponents"
  >
): boolean {
  if (project.examType !== "portfolio") return false;
  if (project.portfolioCriteriaMode !== true) return false;
  return (project.portfolioComponents ?? []).some((c) => {
    const s = resolveComponentCriteriaScale(c);
    return s === "points" || s === "percent";
  });
}

/**
 * Unit 0…1 → Teilnote.
 * - scale grade (oder ohne Schema): linear 5−4·unit
 * - scale points/percent + Schema: calculateGrade(unit·max, schema) = aktives Szenario
 */
export function gradeFromUnitAvg(
  unitAvg: number,
  scale?: CriterionScale,
  schema?: GradeSchema | null
): number {
  const u = Math.min(1, Math.max(0, unitAvg));
  if (scale === "grade" || !schema || schema.maxPoints <= 0) {
    return roundToNearestGermanGrade(5 - 4 * u);
  }
  // points / percent: Notenschlüssel des aktiven Szenarios
  return calculateGrade(u * schema.maxPoints, schema);
}

/**
 * Vergleichsnote über Notenszenario (unit × max → calculateGrade).
 */
export function gradeFromUnitWithScenario(
  unitAvg: number,
  schema: GradeSchema
): number {
  return gradeFromUnitAvg(unitAvg, "points", schema);
}

/** Rohpunkte-Summe und Max einer TL (nur scale points). */
export function criterionPointsTotals(
  values: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[] | undefined | null,
  options?: GradeFromCriteriaOptions
): { raw: number; max: number } | null {
  const disabled = options?.disabledCriterionIds
    ? options.disabledCriterionIds instanceof Set
      ? options.disabledCriterionIds
      : new Set(options.disabledCriterionIds)
    : null;
  const list = (criteria ?? []).filter((c) => !disabled?.has(c.id));
  if (!list.length) return null;
  const vals = values ?? {};
  let raw = 0;
  let max = 0;
  let any = false;
  for (const c of list) {
    const w = Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 1;
    const cMax =
      c.scale === "points" && c.maxPoints != null && c.maxPoints > 0
        ? c.maxPoints
        : c.scale === "percent"
          ? 100
          : null;
    if (cMax == null) continue;
    const v = vals[c.id];
    if (v == null || !Number.isFinite(v)) return null;
    any = true;
    raw += Math.min(cMax, Math.max(0, v)) * w;
    max += cMax * w;
  }
  if (!any || max <= 0) return null;
  return { raw: Math.round(raw * 100) / 100, max: Math.round(max * 100) / 100 };
}

/**
 * Gewichteter Unit-Mittelwert 0…1 aus Kriterienwerten
 * (1 = best / Note 1,0; 0 = Note 5,0).
 */
export function unitAvgFromCriterionValues(
  values: Record<string, number | null | undefined> | undefined,
  criteria: AssessmentCriterion[] | undefined | null,
  options?: GradeFromCriteriaOptions
): number | null {
  const disabled = options?.disabledCriterionIds
    ? options.disabledCriterionIds instanceof Set
      ? options.disabledCriterionIds
      : new Set(options.disabledCriterionIds)
    : null;
  const list = (criteria ?? []).filter((c) => !disabled?.has(c.id));
  if (!list.length) return null;
  const vals = values ?? {};
  let wSum = 0;
  let acc = 0;
  for (const c of list) {
    const w = Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0;
    if (w <= 0) continue;
    const unit = normalizeCriterionValue(vals[c.id], c);
    if (unit == null) return null;
    wSum += w;
    acc += unit * w;
  }
  if (wSum <= 0) return null;
  return acc / wSum;
}

export type PortfolioFulfillment = {
  /** 0…1, gewichtet über Teilleistungen */
  unitAvg: number;
  /** Anzeige in der Notenübersicht: unitAvg × 100 (Erfüllungsäquivalent) */
  displayPoints: number;
  /** unitAvg als Anteil 0…1 für %-Spalte */
  percent: number;
};

/**
 * Portfolio-Erfüllung für Übersicht (Punkte / %):
 * Kriterien → Unit je TL (× Dozenten-Mittel), sonst Unit aus Teilnote.
 * Nur wenn alle TL vollständig (wie Gesamtnote).
 */
export function computePortfolioFulfillment(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  ctx?: PortfolioGradeContext
): PortfolioFulfillment | null {
  const components = project.portfolioComponents ?? [];
  if (!components.length) return null;

  const criteriaMode = project.portfolioCriteriaMode === true;
  const groupId = ctx?.groupId;
  const lecturers = (project.lecturers ?? [])
    .map((l) => l.trim())
    .filter(Boolean);

  let wSum = 0;
  let acc = 0;

  for (const c of components) {
    const w = Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 0;
    if (w <= 0) continue;

    let unit: number | null = null;

    if (criteriaMode) {
      const disabled = disabledCriteriaForGroup(project, groupId, c.id);
      if (!project.portfolioPerLecturerGrading) {
        unit = unitAvgFromCriterionValues(
          rec?.portfolioCriterionValues?.[c.id],
          c.criteria,
          { disabledCriterionIds: disabled }
        );
      } else {
        if (!lecturers.length) return null;
        let uAcc = 0;
        for (const name of lecturers) {
          const u = unitAvgFromCriterionValues(
            rec?.portfolioCriterionValuesByLecturer?.[c.id]?.[name],
            c.criteria,
            { disabledCriterionIds: disabled }
          );
          if (u == null) return null;
          uAcc += u;
        }
        unit = uAcc / lecturers.length;
      }
    } else {
      const grades = effectivePortfolioGrades(project, rec, ctx);
      const g = grades[c.id];
      if (g == null || !Number.isFinite(g)) return null;
      unit = gradeToUnit(g);
    }

    if (unit == null) return null;
    wSum += w;
    acc += unit * w;
  }

  if (wSum <= 0) return null;
  const unitAvg = acc / wSum;
  const displayPoints = Math.round(unitAvg * 1000) / 10; // 0…100, eine Nachkommastelle
  return {
    unitAvg,
    displayPoints,
    percent: unitAvg,
  };
}

/** Füllstand einer Gruppe / Person im Bewertungs-Scope */
export type PortfolioFillStatus = "empty" | "none" | "partial" | "complete";

/** Deaktivierte Kriterien einer TL für eine Gruppe */
export function disabledCriteriaForGroup(
  project: Pick<ExamProject, "studentGroups">,
  groupId: string | null | undefined,
  componentId: string
): string[] {
  if (!groupId) return [];
  const g = (project.studentGroups ?? []).find((x) => x.id === groupId);
  return g?.disabledPortfolioCriteria?.[componentId] ?? [];
}

/** Unit 0…1 einer TL (Kriterien ± Dozenten). */
export function unitAvgForPortfolioComponent(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  component: PortfolioComponent,
  groupId?: string | null
): number | null {
  const disabled = disabledCriteriaForGroup(project, groupId, component.id);
  const crits = (component.criteria ?? []).map((k) => ({
    ...k,
    scale: resolveComponentCriteriaScale(component),
  }));
  if (!project.portfolioPerLecturerGrading) {
    return unitAvgFromCriterionValues(
      rec?.portfolioCriterionValues?.[component.id],
      crits,
      { disabledCriterionIds: disabled }
    );
  }
  const lecturers = (project.lecturers ?? [])
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lecturers.length) return null;
  let acc = 0;
  for (const name of lecturers) {
    const u = unitAvgFromCriterionValues(
      rec?.portfolioCriterionValuesByLecturer?.[component.id]?.[name],
      crits,
      { disabledCriterionIds: disabled }
    );
    if (u == null) return null;
    acc += u;
  }
  return acc / lecturers.length;
}

/**
 * Effektive Teilnoten pro Teilleistung
 * (Note direkt, Dozenten-Mittel, oder aus Kriterien linear 5−4·unit).
 */
export function effectivePortfolioGrades(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  ctx?: PortfolioGradeContext
): Record<string, number | null> {
  const components = project.portfolioComponents ?? [];
  const criteriaMode = project.portfolioCriteriaMode === true;
  const groupId = ctx?.groupId;
  const out: Record<string, number | null> = {};

  if (criteriaMode) {
    const schema = ctx?.schema;
    for (const c of components) {
      const scale = resolveComponentCriteriaScale(c);
      const unit = unitAvgForPortfolioComponent(project, rec, c, groupId);
      out[c.id] =
        unit == null ? null : gradeFromUnitAvg(unit, scale, schema);
    }
    return out;
  }

  if (!project.portfolioPerLecturerGrading) {
    const src = rec?.portfolioGrades ?? {};
    for (const c of components) {
      const g = src[c.id];
      out[c.id] = g != null && Number.isFinite(g) ? g : null;
    }
    return out;
  }
  const lecturers = project.lecturers ?? [];
  const byL = rec?.portfolioGradesByLecturer;
  for (const c of components) {
    out[c.id] = averageLecturerGradesForComponent(byL, c.id, lecturers);
  }
  return out;
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

function portfolioComponentsForScope(
  project: PortfolioProjectSlice,
  componentId?: string | null
): PortfolioComponent[] {
  const all = project.portfolioComponents ?? [];
  if (!componentId) return all;
  return all.filter((c) => c.id === componentId);
}

/**
 * Pflichtzellen im Scope (für Füllstand: required − missing = filled).
 * Deaktivierte Kriterien der Gruppe zählen nicht.
 */
export function countRequiredPortfolioCells(
  project: PortfolioProjectSlice,
  ctx?: PortfolioGradeContext
): number {
  const components = portfolioComponentsForScope(project, ctx?.componentId);
  if (!components.length) return 0;

  const criteriaMode = project.portfolioCriteriaMode === true;
  const lecturers = (project.lecturers ?? [])
    .map((l) => l.trim())
    .filter(Boolean);
  const groupId = ctx?.groupId;

  if (criteriaMode) {
    let required = 0;
    for (const c of components) {
      const disabled = new Set(
        disabledCriteriaForGroup(project, groupId, c.id)
      );
      const crits = (c.criteria ?? []).filter((k) => !disabled.has(k.id));
      if (!crits.length) {
        required += 1; // TL ohne aktive Kriterien = 1 „Pflicht“ (unvollständig)
        continue;
      }
      if (!project.portfolioPerLecturerGrading) {
        required += crits.length;
      } else {
        required += Math.max(lecturers.length, 1) * crits.length;
      }
    }
    return required;
  }

  if (!project.portfolioPerLecturerGrading) {
    return components.length;
  }
  return components.length * Math.max(lecturers.length, 1);
}

/** Fehlende Zellen: Noten oder Kriterien (× Dozent); deaktivierte Kriterien ignorieren */
export function countMissingPortfolioCells(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  ctx?: PortfolioGradeContext
): number {
  const components = portfolioComponentsForScope(project, ctx?.componentId);
  if (!components.length) return 0;

  const criteriaMode = project.portfolioCriteriaMode === true;
  const lecturers = (project.lecturers ?? [])
    .map((l) => l.trim())
    .filter(Boolean);
  const groupId = ctx?.groupId;

  if (criteriaMode) {
    let missing = 0;
    for (const c of components) {
      const disabled = new Set(
        disabledCriteriaForGroup(project, groupId, c.id)
      );
      const crits = (c.criteria ?? []).filter((k) => !disabled.has(k.id));
      if (!crits.length) {
        missing += 1; // TL ohne aktive Kriterien = unvollständig
        continue;
      }
      if (!project.portfolioPerLecturerGrading) {
        missing += countMissingCriteria(
          rec?.portfolioCriterionValues?.[c.id],
          crits
        );
      } else {
        if (!lecturers.length) {
          missing += crits.length;
          continue;
        }
        for (const name of lecturers) {
          missing += countMissingCriteria(
            rec?.portfolioCriterionValuesByLecturer?.[c.id]?.[name],
            crits
          );
        }
      }
    }
    return missing;
  }

  if (!project.portfolioPerLecturerGrading) {
    return countMissingPortfolioGrades(rec?.portfolioGrades, components);
  }

  if (lecturers.length === 0) {
    return components.length;
  }
  const byL = rec?.portfolioGradesByLecturer ?? {};
  let missing = 0;
  for (const c of components) {
    const per = byL[c.id] ?? {};
    for (const name of lecturers) {
      const g = per[name];
      if (g == null || !Number.isFinite(g)) missing++;
    }
  }
  return missing;
}

/** Füllstand einer Person im Scope (eine TL oder alle TLs) */
export function personPortfolioFillStatus(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  ctx?: PortfolioGradeContext
): Exclude<PortfolioFillStatus, "empty"> {
  const required = countRequiredPortfolioCells(project, ctx);
  if (required <= 0) return "none";
  const missing = countMissingPortfolioCells(project, rec, ctx);
  if (missing <= 0) return "complete";
  if (missing >= required) return "none";
  return "partial";
}

/**
 * Aggregierter Füllstand einer Gruppe im Scope.
 * `memberKeys`: Matrikelnummern der Gruppenmitglieder.
 */
export function groupPortfolioFillStatus(
  project: PortfolioProjectSlice,
  memberKeys: readonly string[],
  getRecord: (matKey: string) => PointsRecord | undefined | null,
  ctx?: Omit<PortfolioGradeContext, "groupId"> & { groupId?: string | null }
): PortfolioFillStatus {
  if (memberKeys.length === 0) return "empty";
  let anyNone = false;
  let anyPartial = false;
  let anyComplete = false;
  for (const key of memberKeys) {
    const st = personPortfolioFillStatus(project, getRecord(key), {
      groupId: ctx?.groupId,
      componentId: ctx?.componentId,
    });
    if (st === "none") anyNone = true;
    else if (st === "partial") anyPartial = true;
    else anyComplete = true;
  }
  if (anyComplete && !anyNone && !anyPartial) return "complete";
  if (anyNone && !anyPartial && !anyComplete) return "none";
  return "partial";
}

/**
 * Portfolio-Gesamtnote.
 * Bei points/percent-TLs + Schema: unitAvg × max → calculateGrade (Szenario).
 * Sonst: Mittel der Teilnoten (linear bzw. schema-basierte TL-Noten), gerundet.
 */
export function computePortfolioGradeForProject(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  ctx?: PortfolioGradeContext
): number | null {
  if (
    portfolioUsesGradeScenarios(project as ExamProject) &&
    ctx?.schema != null &&
    ctx.schema.maxPoints > 0
  ) {
    const ful = computePortfolioFulfillment(project, rec, ctx);
    if (ful == null) return null;
    return gradeFromUnitWithScenario(ful.unitAvg, ctx.schema);
  }
  return computePortfolioGrade(
    effectivePortfolioGrades(project, rec, ctx),
    project.portfolioComponents ?? []
  );
}

/**
 * Vergleichs-Gesamtnote über Szenario (unit×max → calculateGrade),
 * falls Punkte/Prozent-TLs existieren; sonst lineare Gesamtnote.
 */
export function computePortfolioScenarioGrade(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  schema: GradeSchema,
  groupId?: string | null
): number | null {
  return computePortfolioGradeForProject(project, rec, {
    groupId,
    schema: portfolioUsesGradeScenarios(project as ExamProject)
      ? schema
      : undefined,
  });
}

/** Fehlende Schema-Punkte bis zur nächstbesseren Note (unit 0…1 × max). */
function nextGradeFromUnitAndSchema(
  unit: number,
  schema: GradeSchema
): {
  pointsNeeded: number | null;
  nextGrade: number | null;
  direction: "better" | "worse" | null;
} {
  if (!(schema.maxPoints > 0) || !Number.isFinite(unit)) {
    return { pointsNeeded: null, nextGrade: null, direction: null };
  }
  const points = Math.min(1, Math.max(0, unit)) * schema.maxPoints;
  const currentGrade = calculateGrade(points, schema);
  const sorted = [...schema.thresholds].sort(
    (a, b) => b.minPoints - a.minPoints
  );
  const better = sorted.filter((t) => t.grade < currentGrade - 1e-9);
  if (better.length === 0) {
    return { pointsNeeded: null, nextGrade: null, direction: null };
  }
  better.sort((a, b) => b.grade - a.grade);
  const next = better[0];
  const needed = Math.max(
    0,
    Math.round((next.minPoints - points) * 10) / 10
  );
  return {
    pointsNeeded: needed,
    nextGrade: next.grade,
    direction: "better",
  };
}

export type PortfolioComponentDetail = {
  grade: number | null;
  percent: number | null;
  pointsRaw?: number | null;
  pointsMax?: number | null;
  pointsToNext: number | null;
  nextGrade: number | null;
  nextGradeDirection: "better" | "worse" | null;
};

/** Details je TL für Notenübersicht (Note, %, optional Pkt., bis nächste Note). */
export function computePortfolioComponentDetails(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  groupId?: string | null,
  getAdjacent?: (raw: number) => {
    pointsNeeded: number | null;
    nextGrade: number | null;
    direction: "better" | "worse" | null;
  },
  schema?: GradeSchema | null
): Record<string, PortfolioComponentDetail> {
  const out: Record<string, PortfolioComponentDetail> = {};
  const components = project.portfolioComponents ?? [];
  const criteriaMode = project.portfolioCriteriaMode === true;
  const grades = effectivePortfolioGrades(project, rec, { groupId, schema });

  for (const c of components) {
    const grade = grades[c.id] ?? null;
    let percent: number | null = null;
    let pointsRaw: number | null | undefined;
    let pointsMax: number | null | undefined;

    if (criteriaMode) {
      const unit = unitAvgForPortfolioComponent(project, rec, c, groupId);
      percent = unit;
      const scale = resolveComponentCriteriaScale(c);
      if (scale === "points" || scale === "percent") {
        const disabled = disabledCriteriaForGroup(project, groupId, c.id);
        const crits = (c.criteria ?? []).map((k) => ({
          ...k,
          scale,
        }));
        if (!project.portfolioPerLecturerGrading) {
          const tot = criterionPointsTotals(
            rec?.portfolioCriterionValues?.[c.id],
            crits,
            { disabledCriterionIds: disabled }
          );
          if (tot) {
            pointsRaw = tot.raw;
            pointsMax = tot.max;
          }
        } else {
          const lecturers = (project.lecturers ?? [])
            .map((l) => l.trim())
            .filter(Boolean);
          if (lecturers.length) {
            let rAcc = 0;
            let mAcc = 0;
            let ok = true;
            for (const name of lecturers) {
              const tot = criterionPointsTotals(
                rec?.portfolioCriterionValuesByLecturer?.[c.id]?.[name],
                crits,
                { disabledCriterionIds: disabled }
              );
              if (!tot) {
                ok = false;
                break;
              }
              rAcc += tot.raw;
              mAcc += tot.max;
            }
            if (ok && lecturers.length) {
              pointsRaw = Math.round((rAcc / lecturers.length) * 100) / 100;
              pointsMax = Math.round((mAcc / lecturers.length) * 100) / 100;
            }
          }
        }
      }
    } else if (grade != null) {
      percent = gradeToUnit(grade);
    }

    let pointsToNext: number | null = null;
    let nextGrade: number | null = null;
    let nextGradeDirection: "better" | "worse" | null = null;
    const unitForRaw =
      percent != null
        ? percent
        : grade != null
          ? gradeToUnit(grade)
          : null;
    const scale =
      criteriaMode && components.length
        ? resolveComponentCriteriaScale(c)
        : "grade";
    // points/percent + Schema: Abstand in Schema-Punkten; sonst Adjacent-Notengrade
    if (
      unitForRaw != null &&
      schema != null &&
      schema.maxPoints > 0 &&
      (scale === "points" || scale === "percent")
    ) {
      const nx = nextGradeFromUnitAndSchema(unitForRaw, schema);
      pointsToNext = nx.pointsNeeded;
      nextGrade = nx.nextGrade;
      nextGradeDirection = nx.direction;
    } else if (unitForRaw != null && getAdjacent) {
      const rawNote = 5 - 4 * unitForRaw;
      const adj = getAdjacent(rawNote);
      pointsToNext = adj.pointsNeeded;
      nextGrade = adj.nextGrade;
      nextGradeDirection = adj.direction;
    }

    out[c.id] = {
      grade,
      percent,
      pointsRaw,
      pointsMax,
      pointsToNext,
      nextGrade,
      nextGradeDirection,
    };
  }
  return out;
}

export function computePortfolioRawAverageForProject(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  ctx?: PortfolioGradeContext
): number | null {
  return computePortfolioRawAverage(
    effectivePortfolioGrades(project, rec, ctx),
    project.portfolioComponents ?? []
  );
}

/** Teilnote einer TL aus Kriterien (ein Bewerter-Set) */
export function componentGradeFromCriteria(
  component: PortfolioComponent,
  values: Record<string, number | null | undefined> | undefined,
  options?: GradeFromCriteriaOptions
): number | null {
  return gradeFromCriterionValues(values, component.criteria, options);
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

/** Beim Einschalten des Dozenten-Modus: bestehende Teilnoten auf alle Dozenten kopieren */
export function seedLecturerGradesFromSimple(
  project: ExamProject
): ExamProject {
  const lecturers = (project.lecturers ?? []).map((l) => l.trim()).filter(Boolean);
  const components = project.portfolioComponents ?? [];
  if (!lecturers.length || !components.length) {
    return { ...project, portfolioPerLecturerGrading: true };
  }
  const points = project.points.map((rec) => {
    const simple = rec.portfolioGrades ?? {};
    const byL: Record<string, Record<string, number | null>> = {
      ...(rec.portfolioGradesByLecturer ?? {}),
    };
    for (const c of components) {
      const g = simple[c.id];
      if (g == null || !Number.isFinite(g)) continue;
      const per = { ...(byL[c.id] ?? {}) };
      for (const name of lecturers) {
        if (per[name] == null || !Number.isFinite(per[name]!)) {
          per[name] = g;
        }
      }
      byL[c.id] = per;
    }
    return { ...rec, portfolioGradesByLecturer: byL };
  });
  return {
    ...project,
    portfolioPerLecturerGrading: true,
    points,
  };
}

/** Beim Ausschalten: Dozenten-Mittel in portfolioGrades spiegeln */
export function collapseLecturerGradesToSimple(
  project: ExamProject
): ExamProject {
  const components = project.portfolioComponents ?? [];
  const lecturers = project.lecturers ?? [];
  const points = project.points.map((rec) => {
    const grades: Record<string, number | null> = {
      ...(rec.portfolioGrades ?? {}),
    };
    for (const c of components) {
      const avg = averageLecturerGradesForComponent(
        rec.portfolioGradesByLecturer,
        c.id,
        lecturers
      );
      if (avg != null) grades[c.id] = avg;
    }
    return { ...rec, portfolioGrades: grades };
  });
  return {
    ...project,
    portfolioPerLecturerGrading: false,
    points,
  };
}

/** Kurzer Dozenten-Label für Tabellenköpfe */
export function shortLecturerLabel(name: string, max = 14): string {
  const t = name.trim();
  if (t.length <= max) return t;
  // „Prof. Dr. Wolfgang Hößl“ → „W. Hößl“ o. ä.
  const parts = t.replace(/^Prof\.\s*Dr\.\s*/i, "").split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const first = parts[0];
    const short = `${first.charAt(0)}. ${last}`;
    return short.length <= max ? short : last.slice(0, max);
  }
  return t.slice(0, max - 1) + "…";
}
