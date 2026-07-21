import { createId } from "@/lib/id";
import { defaultGradeSchema } from "@/lib/grades/schema";
import { createDefaultScenarios } from "@/lib/grades/scenarios";
import {
  resolveExamDisplayName,
  resolveSubAreasForExamName,
  type CatalogSubArea,
} from "@/lib/exam-catalog";
import {
  isHisManualAssessmentExam,
  isOnlineStyleExam,
  type ExamProject,
  type ExamType,
  type SubArea,
} from "@/lib/types";
import { defaultPortfolioComponents } from "@/lib/grades/portfolio";

export interface CreateExamInput {
  name: string;
  examNumber?: string;
  semester?: string;
  lecturers?: string[];
  examType?: ExamType;
  maxPoints?: number;
  passThreshold?: number;
  subAreas?: CatalogSubArea[];
}

function toSubAreas(defs: CatalogSubArea[]): SubArea[] {
  return defs.map((sa) => ({
    id: createId("sa"),
    name: sa.name,
    code: sa.code,
    maxPoints: sa.maxPoints,
  }));
}

export function createEmptyExamProject(input: CreateExamInput): ExamProject {
  const now = new Date().toISOString();
  const displayName = resolveExamDisplayName(input.name);

  const examType = input.examType ?? "the";
  const isHisManual = isHisManualAssessmentExam(examType);

  let subAreas: SubArea[];
  if (isHisManual) {
    subAreas = toSubAreas([
      { name: "Gesamt", code: "G", maxPoints: input.maxPoints ?? 100 },
    ]);
  } else if (input.subAreas && input.subAreas.length > 0) {
    subAreas = toSubAreas(input.subAreas);
  } else {
    subAreas = toSubAreas(resolveSubAreasForExamName(input.name));
  }

  const sumMax = subAreas.reduce((s, sa) => s + sa.maxPoints, 0);
  const maxPoints = isHisManual
    ? input.maxPoints ?? 100
    : sumMax || input.maxPoints || 90;
  const scenarios = createDefaultScenarios(maxPoints);

  return {
    id: createId("exam"),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 2,
    name: displayName,
    examNumber: input.examNumber?.trim() ?? "",
    semester: input.semester?.trim() ?? "",
    lecturers: (input.lecturers ?? []).map((l) => l.trim()).filter(Boolean),
    examType,
    subAreas,
    gradeScenarios: scenarios,
    activeScenarioId: scenarios[0].id,
    gradeSchema: scenarios[0].schema,
    hisRows: [],
    attendance: [],
    points: [],
    students: {},
    identityMerges: [],
    identityDismissals: [],
    importLogs: [],
    // THE/elektrP: Moodle-Punkte standardmäßig auf 0,5 aufrunden
    roundMoodlePointsToHalf: isOnlineStyleExam(examType) ? true : undefined,
    criteria: examType === "sta_criteria" ? [] : undefined,
    portfolioComponents:
      examType === "portfolio" ? defaultPortfolioComponents(createId) : undefined,
  };
}

export function duplicateExamProject(
  source: ExamProject,
  options?: { clearData?: boolean; semester?: string }
): ExamProject {
  const now = new Date().toISOString();
  const clear = options?.clearData ?? false;

  return {
    ...structuredClone(source),
    id: createId("exam"),
    createdAt: now,
    updatedAt: now,
    name: `${source.name} (Kopie)`,
    semester: options?.semester ?? source.semester,
    hisRows: clear ? [] : structuredClone(source.hisRows),
    attendance: clear ? [] : structuredClone(source.attendance),
    points: clear ? [] : structuredClone(source.points),
    students: clear ? {} : structuredClone(source.students),
    importLogs: clear ? [] : structuredClone(source.importLogs),
    hisTemplateMeta: clear
      ? undefined
      : structuredClone(source.hisTemplateMeta),
  };
}

export { defaultGradeSchema };
