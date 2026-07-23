import type {
  EnrichedStudentRow,
  ExamProject,
  ExamType,
  StudentGroup,
} from "@/lib/types";
import { supportsStudentGroups } from "@/lib/types";
import { createId } from "@/lib/id";
import { normalizeMatriculation } from "@/lib/matching/matriculation";

export type GroupFilterId = "all" | "none" | string;

export function projectSupportsGroups(project: ExamProject): boolean {
  return supportsStudentGroups(project.examType);
}

export function sortedStudentGroups(
  project: ExamProject
): StudentGroup[] {
  return [...(project.studentGroups ?? [])].sort(
    (a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name, "de")
  );
}

export function createStudentGroup(
  name: string,
  existing: StudentGroup[] = []
): StudentGroup {
  const maxOrder = existing.reduce((m, g) => Math.max(m, g.orderIndex), -1);
  return {
    id: createId("grp"),
    name: name.trim() || `Gruppe ${existing.length + 1}`,
    orderIndex: maxOrder + 1,
  };
}

export function countInGroup(
  rows: EnrichedStudentRow[],
  groupId: GroupFilterId
): number {
  if (groupId === "all") return rows.length;
  if (groupId === "none") {
    return rows.filter((r) => !r.student.groupId).length;
  }
  return rows.filter((r) => r.student.groupId === groupId).length;
}

export function filterRowsByGroup(
  rows: EnrichedStudentRow[],
  groupId: GroupFilterId
): EnrichedStudentRow[] {
  if (groupId === "all") return rows;
  if (groupId === "none") {
    return rows.filter((r) => !r.student.groupId);
  }
  return rows.filter((r) => r.student.groupId === groupId);
}

export function setStudentGroupId(
  project: ExamProject,
  matKey: string,
  groupId: string | null
): ExamProject {
  return setStudentGroupIds(project, [matKey], groupId);
}

/** Mehrere Matrikelnummern in einem Update einer Gruppe (oder keiner) zuordnen */
/**
 * Portfolio-Kriterium für eine Gruppe aktivieren/deaktivieren.
 * Deaktivierte Kriterien zählen nicht für die Notenberechnung dieser Gruppe.
 */
export function setGroupPortfolioCriterionDisabled(
  project: ExamProject,
  groupId: string,
  componentId: string,
  criterionId: string,
  disabled: boolean
): ExamProject {
  const groups = [...(project.studentGroups ?? [])];
  const idx = groups.findIndex((g) => g.id === groupId);
  if (idx < 0) return project;
  const g = groups[idx];
  const map: Record<string, string[]> = {
    ...(g.disabledPortfolioCriteria ?? {}),
  };
  const prev = new Set(map[componentId] ?? []);
  if (disabled) prev.add(criterionId);
  else prev.delete(criterionId);
  if (prev.size === 0) delete map[componentId];
  else map[componentId] = [...prev];
  groups[idx] = {
    ...g,
    disabledPortfolioCriteria:
      Object.keys(map).length > 0 ? map : undefined,
  };
  return { ...project, studentGroups: groups };
}

export function getGroupDisabledPortfolioCriteria(
  project: ExamProject,
  groupId: string | null | undefined,
  componentId: string
): string[] {
  if (!groupId) return [];
  const g = (project.studentGroups ?? []).find((x) => x.id === groupId);
  return g?.disabledPortfolioCriteria?.[componentId] ?? [];
}

export function setStudentGroupIds(
  project: ExamProject,
  matKeys: string[],
  groupId: string | null
): ExamProject {
  if (matKeys.length === 0) return project;
  const students = { ...project.students };
  let changed = false;
  for (const matKey of matKeys) {
    const key = normalizeMatriculation(matKey);
    if (!key) continue;
    const prev = students[key];
    const next = prev
      ? { ...prev, groupId }
      : {
          matriculationNumber: matKey,
          lastName: "",
          firstName: "",
          groupId,
        };
    if (prev?.groupId === groupId && prev) continue;
    students[key] = next;
    changed = true;
  }
  return changed ? { ...project, students } : project;
}

export function removeStudentGroup(
  project: ExamProject,
  groupId: string
): ExamProject {
  const studentGroups = (project.studentGroups ?? []).filter(
    (g) => g.id !== groupId
  );
  const students = { ...project.students };
  for (const [k, s] of Object.entries(students)) {
    if (s.groupId === groupId) {
      students[k] = { ...s, groupId: null };
    }
  }
  return { ...project, studentGroups, students };
}

export function examTypeSupportsGroups(examType: ExamType): boolean {
  return supportsStudentGroups(examType);
}
