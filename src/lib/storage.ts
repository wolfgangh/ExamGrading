import localforage from "localforage";
import type { ExamProject } from "@/lib/types";

const projectsStore = localforage.createInstance({
  name: "exam-grade",
  storeName: "projects",
  description: "Prüfungsprojekte ExamGrade",
});

const draftStore = localforage.createInstance({
  name: "exam-grade",
  storeName: "drafts",
  description: "Auto-Save Drafts",
});

export async function listExams(): Promise<ExamProject[]> {
  const items: ExamProject[] = [];
  await projectsStore.iterate<ExamProject, void>((value) => {
    items.push(value);
  });
  return items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getExam(id: string): Promise<ExamProject | null> {
  return (await projectsStore.getItem<ExamProject>(id)) ?? null;
}

export async function saveExam(project: ExamProject): Promise<void> {
  const toSave: ExamProject = {
    ...project,
    updatedAt: new Date().toISOString(),
  };
  await projectsStore.setItem(toSave.id, toSave);
  await clearDraft(toSave.id);
}

export async function deleteExam(id: string): Promise<void> {
  await projectsStore.removeItem(id);
  await clearDraft(id);
}

export async function saveDraft(project: ExamProject): Promise<void> {
  await draftStore.setItem(project.id, {
    ...project,
    updatedAt: new Date().toISOString(),
  });
}

export async function getDraft(id: string): Promise<ExamProject | null> {
  return (await draftStore.getItem<ExamProject>(id)) ?? null;
}

export async function clearDraft(id: string): Promise<void> {
  await draftStore.removeItem(id);
}

export function exportExamJson(project: ExamProject): string {
  return JSON.stringify(project, null, 2);
}

export function parseExamJson(json: string): ExamProject {
  const data = JSON.parse(json) as ExamProject;
  if (!data || typeof data !== "object" || !data.id || !data.name) {
    throw new Error("Ungültiges Prüfungsprojekt-JSON");
  }
  if (!data.schemaVersion) {
    data.schemaVersion = 1;
  }
  data.hisRows = data.hisRows ?? [];
  data.attendance = data.attendance ?? [];
  data.points = data.points ?? [];
  data.students = data.students ?? {};
  data.importLogs = data.importLogs ?? [];
  data.subAreas = data.subAreas ?? [];
  data.lecturers = data.lecturers ?? [];
  return data;
}
