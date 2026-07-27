import { createId } from "@/lib/id";
import { generateLinearGradeSchema } from "@/lib/grades/schema";
import { portfolioUsesGradeScenarios } from "@/lib/grades/portfolio";
import { parseProgramCode, summarizeExamNumbers } from "@/lib/his-sources";
import type {
  ExamProject,
  GradeScenario,
  GradeSchema,
  GradeThreshold,
} from "@/lib/types";
import { GERMAN_GRADES } from "@/lib/types";

/** Pass-Schwellen relativ zu max=90 (Excel-Vorbild) */
const PRESET_PASS_45 = 45;
const PRESET_PASS_40 = 40;

/** Portfolio-Szenarien: kanonisches Maximum = 100 (Prozent-Skala) */
export const PORTFOLIO_SCENARIO_MAX = 100;

function scalePass(maxPoints: number, referencePass: number): number {
  if (maxPoints <= 0) return referencePass;
  if (Math.abs(maxPoints - 90) < 0.01) return referencePass;
  return Math.round((maxPoints * referencePass) / 90);
}

export function scoreToPercent(score: number, maxPoints: number): number {
  if (!(maxPoints > 0) || !Number.isFinite(score)) return 0;
  return Math.round((score / maxPoints) * 1000) / 10;
}

export function percentToScore(percent: number, maxPoints: number): number {
  if (!(maxPoints > 0) || !Number.isFinite(percent)) return 0;
  return Math.round((percent / 100) * maxPoints * 10) / 10;
}

/** Anzeige „≥ 50 Pkt. (50 %)“ */
export function formatThresholdDual(
  minPoints: number,
  maxPoints: number
): { points: number; percent: number; label: string } {
  const percent = scoreToPercent(minPoints, maxPoints);
  const pts = Math.round(minPoints * 10) / 10;
  return {
    points: pts,
    percent,
    label: `≥ ${String(pts).replace(".", ",")} Pkt. (${String(percent).replace(".", ",")} %)`,
  };
}

export function createDefaultScenarios(maxPoints: number): GradeScenario[] {
  const max = maxPoints > 0 ? maxPoints : 90;
  const pass45 = scalePass(max, PRESET_PASS_45);
  const pass40 = scalePass(max, PRESET_PASS_40);

  const s45: GradeScenario = {
    id: createId("sc"),
    name: "Szenario 45 (Standard)",
    passThreshold: pass45,
    passPercent: scoreToPercent(pass45, max),
    editable: false,
    presetKind: "pass50",
    schema: generateLinearGradeSchema(max, pass45, true),
  };
  const s40: GradeScenario = {
    id: createId("sc"),
    name: "Szenario 40",
    passThreshold: pass40,
    passPercent: scoreToPercent(pass40, max),
    editable: false,
    presetKind: "pass40",
    schema: generateLinearGradeSchema(max, pass40, true),
  };
  const s3: GradeScenario = {
    id: createId("sc"),
    name: "Szenario 3 (frei)",
    passThreshold: pass45,
    passPercent: scoreToPercent(pass45, max),
    editable: true,
    enabled: false,
    presetKind: "free",
    schema: generateLinearGradeSchema(max, pass45, true),
  };
  return [s45, s40, s3];
}

/**
 * Portfolio-Kriterien (Punkte/Prozent): 50 % / 40 % fix,
 * frei (Bestehens-%) und eigene Grenzen.
 */
export function createPortfolioDefaultScenarios(
  maxPoints: number = PORTFOLIO_SCENARIO_MAX
): GradeScenario[] {
  const max = maxPoints > 0 ? maxPoints : PORTFOLIO_SCENARIO_MAX;
  const pass50 = percentToScore(50, max);
  const pass40 = percentToScore(40, max);

  const s50: GradeScenario = {
    id: createId("sc"),
    name: "50 % Bestehen (Standard)",
    passThreshold: pass50,
    passPercent: 50,
    editable: false,
    presetKind: "pass50",
    schema: generateLinearGradeSchema(max, pass50, true),
  };
  const s40: GradeScenario = {
    id: createId("sc"),
    name: "40 % Bestehen",
    passThreshold: pass40,
    passPercent: 40,
    editable: false,
    presetKind: "pass40",
    schema: generateLinearGradeSchema(max, pass40, true),
  };
  const sFree: GradeScenario = {
    id: createId("sc"),
    name: "Frei (Bestehens-%)",
    passThreshold: pass50,
    passPercent: 50,
    editable: true,
    enabled: false,
    customThresholds: false,
    presetKind: "free",
    schema: generateLinearGradeSchema(max, pass50, true),
  };
  const sCustom: GradeScenario = {
    id: createId("sc"),
    name: "Eigene Grenzen",
    passThreshold: pass50,
    passPercent: 50,
    editable: true,
    enabled: false,
    customThresholds: true,
    presetKind: "custom",
    schema: generateLinearGradeSchema(max, pass50, true),
  };
  return [s50, s40, sFree, sCustom];
}

/** Schema aus %-Schwellen je Note (1,0…4,0 + 5,0=0). */
export function schemaFromPercentThresholds(
  maxPoints: number,
  /** Note → Mindest-% (0–100); 5,0 wird 0 */
  percentByGrade: Record<number, number>
): GradeSchema {
  const max = maxPoints > 0 ? maxPoints : PORTFOLIO_SCENARIO_MAX;
  const thresholds: GradeThreshold[] = GERMAN_GRADES.map((grade) => {
    if (grade >= 5) return { grade: 5.0, minPoints: 0 };
    const pct = percentByGrade[grade] ?? 0;
    return {
      grade,
      minPoints: percentToScore(Math.min(100, Math.max(0, pct)), max),
    };
  });
  thresholds.sort((a, b) => b.minPoints - a.minPoints);
  const pass =
    thresholds.find((t) => Math.abs(t.grade - 4.0) < 1e-9)?.minPoints ?? 0;
  return {
    mode: "points",
    maxPoints: max,
    passThreshold: pass,
    thresholds,
    roundPointsUp: false,
  };
}

/** Sichtbare Szenarien: Presets immer, editierbares nur wenn enabled */
export function isScenarioVisible(sc: GradeScenario): boolean {
  if (!sc.editable) return true;
  return sc.enabled === true;
}

export function visibleScenarios(project: ExamProject): GradeScenario[] {
  return ensureScenarios(project).filter(isScenarioVisible);
}

export function getEditableScenario(
  project: ExamProject
): GradeScenario | undefined {
  return ensureScenarios(project).find(
    (s) => s.editable && s.customThresholds !== true
  );
}

export function getCustomThresholdsScenario(
  project: ExamProject
): GradeScenario | undefined {
  return ensureScenarios(project).find(
    (s) => s.editable && s.customThresholds === true
  );
}

/** Portfolio: Szenarien auf Max 100 + 50/40/frei/eigen. */
export function ensurePortfolioScenarios(project: ExamProject): ExamProject {
  if (!portfolioUsesGradeScenarios(project)) return project;
  const max = PORTFOLIO_SCENARIO_MAX;
  const existing = project.gradeScenarios ?? [];
  const looksPortfolio =
    existing.some((s) => s.presetKind === "pass50" && s.name.includes("%")) ||
    existing.some((s) => s.name.includes("% Bestehen"));

  if (
    looksPortfolio &&
    existing.length >= 3 &&
    existing.every((s) => Math.abs(s.schema.maxPoints - max) < 0.01)
  ) {
    // Max ok – active schema spiegeln
    const active =
      existing.find((s) => s.id === project.activeScenarioId) ?? existing[0];
    const activeOk =
      active && (!active.editable || active.enabled === true)
        ? active
        : existing.find((s) => !s.editable) ?? existing[0];
    return {
      ...project,
      gradeScenarios: existing,
      activeScenarioId: activeOk.id,
      gradeSchema: activeOk.schema,
    };
  }

  const scenarios = createPortfolioDefaultScenarios(max);
  // Pass-% aus altem editierbarem Szenario übernehmen wenn sinnvoll
  const oldFree = existing.find((s) => s.editable && !s.customThresholds);
  if (oldFree) {
    const pct =
      oldFree.passPercent ??
      scoreToPercent(oldFree.passThreshold, oldFree.schema.maxPoints || max);
    const freeIdx = scenarios.findIndex((s) => s.presetKind === "free");
    if (freeIdx >= 0) {
      const pass = percentToScore(pct, max);
      scenarios[freeIdx] = {
        ...scenarios[freeIdx],
        passThreshold: pass,
        passPercent: pct,
        enabled: oldFree.enabled === true,
        schema: generateLinearGradeSchema(max, pass, true),
      };
    }
  }

  return {
    ...project,
    gradeScenarios: scenarios,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
  };
}

/** Szenario 3 ein-/ausschalten; bei Aus und aktiv → erstes Preset */
export function setEditableScenarioEnabled(
  project: ExamProject,
  enabled: boolean
): ExamProject {
  const scenarios = [
    ...(project.gradeScenarios ??
      createDefaultScenarios(project.gradeSchema.maxPoints)),
  ];
  const idx = scenarios.findIndex(
    (s) => s.editable && s.customThresholds !== true
  );
  if (idx < 0) return project;

  scenarios[idx] = { ...scenarios[idx], enabled };

  let next: ExamProject = {
    ...project,
    gradeScenarios: scenarios,
  };

  if (!enabled) {
    const activeId = project.activeScenarioId ?? scenarios[0]?.id;
    if (activeId === scenarios[idx].id) {
      const fallback = scenarios.find((s) => !s.editable) ?? scenarios[0];
      next = withActiveScenario(next, fallback.id);
    }
  }

  return next;
}

export function getActiveScenario(project: ExamProject): GradeScenario {
  const scenarios = project.gradeScenarios;
  if (!scenarios?.length) {
    const fallback = createDefaultScenarios(
      project.gradeSchema?.maxPoints ?? 90
    );
    return fallback[0];
  }
  const active =
    scenarios.find((s) => s.id === project.activeScenarioId) ?? scenarios[0];
  return active;
}

export function withActiveScenario(
  project: ExamProject,
  scenarioId: string
): ExamProject {
  const scenarios = project.gradeScenarios ?? createDefaultScenarios(
    project.gradeSchema.maxPoints
  );
  const active = scenarios.find((s) => s.id === scenarioId) ?? scenarios[0];
  return {
    ...project,
    gradeScenarios: scenarios,
    activeScenarioId: active.id,
    gradeSchema: active.schema,
  };
}

export function updateEditableScenario(
  project: ExamProject,
  passThreshold: number
): ExamProject {
  const scenarios = [
    ...(project.gradeScenarios ??
      createDefaultScenarios(project.gradeSchema.maxPoints)),
  ];
  const max = project.gradeSchema.maxPoints;
  const idx = scenarios.findIndex(
    (s) => s.editable && s.customThresholds !== true
  );
  if (idx < 0) return project;

  const schema = generateLinearGradeSchema(max, passThreshold, true);
  scenarios[idx] = {
    ...scenarios[idx],
    passThreshold,
    passPercent: scoreToPercent(passThreshold, max),
    schema,
  };

  const activeId = project.activeScenarioId ?? scenarios[0].id;
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0];

  return {
    ...project,
    gradeScenarios: scenarios,
    activeScenarioId: active.id,
    gradeSchema: active.schema,
  };
}

/** Frei-Szenario: Bestehen in % vom Maximum. */
export function updateEditableScenarioPassPercent(
  project: ExamProject,
  passPercent: number
): ExamProject {
  const max = project.gradeSchema.maxPoints || PORTFOLIO_SCENARIO_MAX;
  const pct = Math.min(100, Math.max(0, passPercent));
  const pass = percentToScore(pct, max);
  return updateEditableScenario(project, pass);
}

/** Eigene Grenzen: %-Schwellen je Note speichern. */
export function updateCustomScenarioThresholds(
  project: ExamProject,
  percentByGrade: Record<number, number>
): ExamProject {
  const scenarios = [...ensureScenarios(project)];
  const idx = scenarios.findIndex(
    (s) => s.editable && s.customThresholds === true
  );
  if (idx < 0) return project;
  const max = scenarios[idx].schema.maxPoints || PORTFOLIO_SCENARIO_MAX;
  const schema = schemaFromPercentThresholds(max, percentByGrade);
  scenarios[idx] = {
    ...scenarios[idx],
    schema,
    passThreshold: schema.passThreshold,
    passPercent: scoreToPercent(schema.passThreshold, max),
    enabled: true,
  };
  const activeId = project.activeScenarioId ?? scenarios[idx].id;
  let active = scenarios.find((s) => s.id === activeId) ?? scenarios[idx];
  if (active.id === scenarios[idx].id) {
    active = scenarios[idx];
  }
  return {
    ...project,
    gradeScenarios: scenarios,
    activeScenarioId: active.id,
    gradeSchema: active.schema,
  };
}

export function setCustomScenarioEnabled(
  project: ExamProject,
  enabled: boolean
): ExamProject {
  const scenarios = [...ensureScenarios(project)];
  const idx = scenarios.findIndex(
    (s) => s.editable && s.customThresholds === true
  );
  if (idx < 0) return project;
  scenarios[idx] = { ...scenarios[idx], enabled };
  let next: ExamProject = { ...project, gradeScenarios: scenarios };
  if (!enabled && project.activeScenarioId === scenarios[idx].id) {
    const fallback = scenarios.find((s) => !s.editable) ?? scenarios[0];
    next = withActiveScenario(next, fallback.id);
  }
  return next;
}

/** Bei maxPoints-Änderung alle Szenarien neu berechnen */
export function rebuildScenariosForMaxPoints(
  project: ExamProject,
  maxPoints: number
): ExamProject {
  const old = project.gradeScenarios;
  if (!old?.length) {
    const scenarios = createDefaultScenarios(maxPoints);
    return {
      ...project,
      gradeScenarios: scenarios,
      activeScenarioId: scenarios[0].id,
      gradeSchema: scenarios[0].schema,
    };
  }

  const scenarios = old.map((s) => {
    let pass = s.passThreshold;
    if (!s.editable) {
      // Presets proportional halten
      if (s.name.includes("40")) {
        pass = scalePass(maxPoints, PRESET_PASS_40);
      } else {
        pass = scalePass(maxPoints, PRESET_PASS_45);
      }
    } else {
      // editierbares Szenario: Pass-Anteil beibehalten
      const oldMax = s.schema.maxPoints || maxPoints;
      pass = Math.round((s.passThreshold * maxPoints) / (oldMax || 1));
    }
    const schema = generateLinearGradeSchema(maxPoints, pass, true);
    return { ...s, passThreshold: pass, schema };
  });

  const active =
    scenarios.find((s) => s.id === project.activeScenarioId) ?? scenarios[0];

  return {
    ...project,
    gradeScenarios: scenarios,
    activeScenarioId: active.id,
    gradeSchema: active.schema,
  };
}

export function migrateExamProject(raw: ExamProject): ExamProject {
  const max =
    raw.gradeSchema?.maxPoints ??
    raw.subAreas?.reduce((s, a) => s + a.maxPoints, 0) ??
    90;

  let project: ExamProject = { ...raw };

  // --- Szenarien (v2) ---
  if (
    !(
      project.schemaVersion >= 2 &&
      project.gradeScenarios &&
      project.gradeScenarios.length >= 3
    )
  ) {
    const scenarios = createDefaultScenarios(max);
    if (project.gradeSchema?.passThreshold != null) {
      const p = project.gradeSchema.passThreshold;
      if (
        p !== scenarios[0].passThreshold &&
        p !== scenarios[1].passThreshold
      ) {
        scenarios[2] = {
          ...scenarios[2],
          passThreshold: p,
          schema: generateLinearGradeSchema(max, p, true),
        };
      }
    }
    project = {
      ...project,
      schemaVersion: 2,
      gradeScenarios: scenarios,
      activeScenarioId: scenarios[0].id,
      gradeSchema: scenarios[0].schema,
    };
  } else {
    // enabled-Flag für editierbares Szenario normalisieren
    const scenarios = project.gradeScenarios!.map((s) => {
      if (!s.editable) return s;
      if (s.enabled === true || s.enabled === false) return s;
      // fehlend: aktiv halten wenn gerade gewählt, sonst deaktiviert
      const isActive = s.id === project.activeScenarioId;
      return { ...s, enabled: isActive };
    });
    const active =
      scenarios.find((s) => s.id === project.activeScenarioId) ?? scenarios[0];
    // falls aktives Szenario editierbar und disabled → Fallback
    const activeOk =
      active && (!active.editable || active.enabled === true)
        ? active
        : scenarios.find((s) => !s.editable) ?? scenarios[0];
    project = {
      ...project,
      gradeScenarios: scenarios,
      gradeSchema: activeOk.schema,
      activeScenarioId: activeOk.id,
    };
  }

  // --- Multi-HIS (v3) ---
  if (!project.hisSources?.length && project.hisRows?.length) {
    const id = createId("his");
    const examNumber =
      project.examNumber ||
      project.hisTemplateMeta?.examNumber ||
      "";
    const programCode = parseProgramCode(examNumber) ?? "ALL";
    const source = {
      id,
      programCode,
      examNumber,
      label: examNumber || "HIS",
      originalFileName: project.hisTemplateMeta?.originalFileName,
      meta: project.hisTemplateMeta ?? {},
      rows: project.hisRows.map((r) => ({ ...r, sourceId: id })),
    };
    project = {
      ...project,
      schemaVersion: 3,
      hisSources: [source],
      hisRows: source.rows,
      examNumber: summarizeExamNumbers([source]) || project.examNumber,
    };
  } else if (project.hisSources?.length) {
    project = {
      ...project,
      schemaVersion: Math.max(project.schemaVersion ?? 2, 3) as 1 | 2 | 3,
      hisRows: project.hisSources.flatMap((s) =>
        s.rows.map((r) => ({ ...r, sourceId: r.sourceId ?? s.id }))
      ),
    };
  }

  // Portfolio points/percent: Szenarien 50/40/frei/eigen auf Max 100
  if (portfolioUsesGradeScenarios(project)) {
    project = ensurePortfolioScenarios(project);
  }

  return project;
}

export function ensureScenarios(project: ExamProject): GradeScenario[] {
  return (
    project.gradeScenarios ??
    createDefaultScenarios(project.gradeSchema?.maxPoints ?? 90)
  );
}

export type { GradeSchema };
