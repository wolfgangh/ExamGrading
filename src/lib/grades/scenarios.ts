import { createId } from "@/lib/id";
import { generateLinearGradeSchema } from "@/lib/grades/schema";
import { parseProgramCode, summarizeExamNumbers } from "@/lib/his-sources";
import type { ExamProject, GradeScenario, GradeSchema } from "@/lib/types";

/** Pass-Schwellen relativ zu max=90 (Excel-Vorbild) */
const PRESET_PASS_45 = 45;
const PRESET_PASS_40 = 40;

function scalePass(maxPoints: number, referencePass: number): number {
  if (maxPoints <= 0) return referencePass;
  if (Math.abs(maxPoints - 90) < 0.01) return referencePass;
  return Math.round((maxPoints * referencePass) / 90);
}

export function createDefaultScenarios(maxPoints: number): GradeScenario[] {
  const max = maxPoints > 0 ? maxPoints : 90;
  const pass45 = scalePass(max, PRESET_PASS_45);
  const pass40 = scalePass(max, PRESET_PASS_40);

  const s45: GradeScenario = {
    id: createId("sc"),
    name: "Szenario 45 (Standard)",
    passThreshold: pass45,
    editable: false,
    schema: generateLinearGradeSchema(max, pass45, true),
  };
  const s40: GradeScenario = {
    id: createId("sc"),
    name: "Szenario 40",
    passThreshold: pass40,
    editable: false,
    schema: generateLinearGradeSchema(max, pass40, true),
  };
  const s3: GradeScenario = {
    id: createId("sc"),
    name: "Szenario 3 (frei)",
    passThreshold: pass45,
    editable: true,
    enabled: false,
    schema: generateLinearGradeSchema(max, pass45, true),
  };
  return [s45, s40, s3];
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
  return ensureScenarios(project).find((s) => s.editable);
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
  const idx = scenarios.findIndex((s) => s.editable);
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
  const idx = scenarios.findIndex((s) => s.editable);
  if (idx < 0) return project;

  const schema = generateLinearGradeSchema(max, passThreshold, true);
  scenarios[idx] = {
    ...scenarios[idx],
    passThreshold,
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

  return project;
}

export function ensureScenarios(project: ExamProject): GradeScenario[] {
  return (
    project.gradeScenarios ??
    createDefaultScenarios(project.gradeSchema?.maxPoints ?? 90)
  );
}

export type { GradeSchema };
