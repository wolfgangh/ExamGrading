import { createId } from "@/lib/id";
import { defaultGradeSchema, generateLinearGradeSchema } from "@/lib/grades/schema";
import type { ExamProject, ExamType, SubArea } from "@/lib/types";

export interface CreateExamInput {
  name: string;
  examNumber?: string;
  semester?: string;
  lecturers?: string[];
  examType?: ExamType;
  maxPoints?: number;
  passThreshold?: number;
  subAreas?: { name: string; code: string; maxPoints: number }[];
}

export function createEmptyExamProject(input: CreateExamInput): ExamProject {
  const now = new Date().toISOString();
  const maxPoints = input.maxPoints ?? 90;
  const passThreshold = input.passThreshold ?? Math.round(maxPoints / 2);

  let subAreas: SubArea[];
  if (input.subAreas && input.subAreas.length > 0) {
    subAreas = input.subAreas.map((sa) => ({
      id: createId("sa"),
      name: sa.name,
      code: sa.code,
      maxPoints: sa.maxPoints,
    }));
  } else {
    const half = maxPoints / 2;
    subAreas = [
      { id: createId("sa"), name: "Teilgebiet 1", code: "A", maxPoints: half },
      { id: createId("sa"), name: "Teilgebiet 2", code: "B", maxPoints: half },
    ];
  }

  const sumMax = subAreas.reduce((s, sa) => s + sa.maxPoints, 0);

  return {
    id: createId("exam"),
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    name: input.name.trim(),
    examNumber: input.examNumber?.trim() ?? "",
    semester: input.semester?.trim() ?? "",
    lecturers: (input.lecturers ?? []).map((l) => l.trim()).filter(Boolean),
    examType: input.examType ?? "the",
    subAreas,
    gradeSchema: generateLinearGradeSchema(
      sumMax || maxPoints,
      passThreshold,
      true
    ),
    hisRows: [],
    attendance: [],
    points: [],
    students: {},
    importLogs: [],
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
    hisTemplateMeta: clear ? undefined : structuredClone(source.hisTemplateMeta),
  };
}

export function createDefaultSubAreas(): SubArea[] {
  return [
    { id: createId("sa"), name: "FRM", code: "F", maxPoints: 45 },
    { id: createId("sa"), name: "Investition", code: "I", maxPoints: 45 },
  ];
}

export { defaultGradeSchema };
