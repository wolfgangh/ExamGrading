import type { ExamProject } from "@/lib/types";
import { migrateExamProject } from "@/lib/grades/scenarios";
import {
  buildProjectArchive,
  parseProjectArchive,
} from "@/lib/project-archive";

type LocalForage = typeof import("localforage");
type Store = Awaited<ReturnType<LocalForage["createInstance"]>>;

let projectsStore: Store | null = null;
let draftStore: Store | null = null;
let initPromise: Promise<void> | null = null;

async function ensureStores(): Promise<{
  projects: Store;
  drafts: Store;
}> {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB ist nur im Browser verfügbar.");
  }
  if (projectsStore && draftStore) {
    return { projects: projectsStore, drafts: draftStore };
  }
  if (!initPromise) {
    initPromise = (async () => {
      const localforage = (await import("localforage")).default;
      projectsStore = localforage.createInstance({
        name: "exam-grade",
        storeName: "projects",
        description: "Prüfungsprojekte ExamGrade",
      });
      draftStore = localforage.createInstance({
        name: "exam-grade",
        storeName: "drafts",
        description: "Auto-Save Drafts",
      });
    })();
  }
  await initPromise;
  return { projects: projectsStore!, drafts: draftStore! };
}

export async function listExams(): Promise<ExamProject[]> {
  const { projects } = await ensureStores();
  const items: ExamProject[] = [];
  await projects.iterate<ExamProject, void>((value) => {
    items.push(migrateExamProject(value));
  });
  return items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getExam(id: string): Promise<ExamProject | null> {
  const { projects } = await ensureStores();
  const raw = await projects.getItem<ExamProject>(id);
  return raw ? migrateExamProject(raw) : null;
}

/**
 * Persistiert das Projekt. `updatedAt` kommt vom Caller
 * (setProject / markBackup) – hier nicht überschreiben,
 * sonst wäre jede Sicherung sofort wieder „veraltet“.
 */
export async function saveExam(project: ExamProject): Promise<void> {
  const { projects, drafts } = await ensureStores();
  const migrated = migrateExamProject(project);
  const toSave: ExamProject = {
    ...migrated,
    updatedAt: migrated.updatedAt || new Date().toISOString(),
  };
  await projects.setItem(toSave.id, toSave);
  await drafts.removeItem(toSave.id);
}

export async function deleteExam(id: string): Promise<void> {
  const { projects, drafts } = await ensureStores();
  await projects.removeItem(id);
  await drafts.removeItem(id);
}

export async function saveDraft(project: ExamProject): Promise<void> {
  const { drafts } = await ensureStores();
  await drafts.setItem(project.id, {
    ...project,
    updatedAt: project.updatedAt || new Date().toISOString(),
  });
}

export async function getDraft(id: string): Promise<ExamProject | null> {
  const { drafts } = await ensureStores();
  const raw = await drafts.getItem<ExamProject>(id);
  return raw ? migrateExamProject(raw) : null;
}

export async function clearDraft(id: string): Promise<void> {
  if (typeof window === "undefined") return;
  const { drafts } = await ensureStores();
  await drafts.removeItem(id);
}

/** Vollständige Projektsicherung (Archive-Format) */
export function exportExamJson(project: ExamProject): string {
  return buildProjectArchive(project);
}

export function parseExamJson(json: string): ExamProject {
  return parseProjectArchive(json);
}

export { buildProjectArchive, parseProjectArchive };
