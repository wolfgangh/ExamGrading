import type {
  AssessmentCriterion,
  ExamProject,
  PointsRecord,
  PortfolioComponent,
} from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";
import {
  countMissingCriteria,
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
};

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

/**
 * Effektive Teilnoten pro Teilleistung
 * (Note direkt, Dozenten-Mittel, oder aus Kriterien).
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
    if (!project.portfolioPerLecturerGrading) {
      for (const c of components) {
        out[c.id] = gradeFromCriterionValues(
          rec?.portfolioCriterionValues?.[c.id],
          c.criteria,
          {
            disabledCriterionIds: disabledCriteriaForGroup(
              project,
              groupId,
              c.id
            ),
          }
        );
      }
      return out;
    }
    const lecturers = (project.lecturers ?? [])
      .map((l) => l.trim())
      .filter(Boolean);
    for (const c of components) {
      const disabled = disabledCriteriaForGroup(project, groupId, c.id);
      const activeCrits = (c.criteria ?? []).filter(
        (k) => !disabled.includes(k.id)
      );
      if (!lecturers.length || !activeCrits.length) {
        out[c.id] = null;
        continue;
      }
      let acc = 0;
      let ok = true;
      for (const name of lecturers) {
        const g = gradeFromCriterionValues(
          rec?.portfolioCriterionValuesByLecturer?.[c.id]?.[name],
          c.criteria,
          { disabledCriterionIds: disabled }
        );
        if (g == null) {
          ok = false;
          break;
        }
        acc += g;
      }
      out[c.id] = ok
        ? Math.round((acc / lecturers.length) * 1000) / 1000
        : null;
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

/** Fehlende Zellen: Noten oder Kriterien (× Dozent); deaktivierte Kriterien ignorieren */
export function countMissingPortfolioCells(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  ctx?: PortfolioGradeContext
): number {
  const components = project.portfolioComponents ?? [];
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

export function computePortfolioGradeForProject(
  project: PortfolioProjectSlice,
  rec: PointsRecord | undefined | null,
  ctx?: PortfolioGradeContext
): number | null {
  return computePortfolioGrade(
    effectivePortfolioGrades(project, rec, ctx),
    project.portfolioComponents ?? []
  );
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
