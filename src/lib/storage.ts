import localforage from "localforage";
import { migrateExamProject } from "@/lib/grades/scenarios";
import {
  buildProjectArchive,
  parseProjectArchive,
} from "@/lib/project-archive";
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
    items.push(migrateExamProject(value));
  });
  return items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getExam(id: string): Promise<ExamProject | null> {
  const raw = await projectsStore.getItem<ExamProject>(id);
  return raw ? migrateExamProject(raw) : null;
}

export async function saveExam(project: ExamProject): Promise<void> {
  const migrated = migrateExamProject(project);
  const toSave: ExamProject = {
    ...migrated,
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
  const raw = await draftStore.getItem<ExamProject>(id);
  return raw ? migrateExamProject(raw) : null;
}

export async function clearDraft(id: string): Promise<void> {
  await draftStore.removeItem(id);
}

/** Vollständige Projektsicherung (Archive-Format) */
export function exportExamJson(project: ExamProject): string {
  return buildProjectArchive(project);
}

export function parseExamJson(json: string): ExamProject {
  return parseProjectArchive(json);
}

export { buildProjectArchive, parseProjectArchive };
