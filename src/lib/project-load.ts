import type { ExamProject } from "@/lib/types";

/**
 * Welches Projekt beim Öffnen gilt: Draft oder gespeicherte Version.
 * Der neuere `updatedAt` gewinnt – Grundlage für Zwei-Tab-Konsistenz.
 */
export function pickNewerProject(
  draft: ExamProject | null | undefined,
  stored: ExamProject | null | undefined
): ExamProject | null {
  if (draft && stored) {
    const d = Date.parse(draft.updatedAt);
    const s = Date.parse(stored.updatedAt);
    if (Number.isFinite(d) && Number.isFinite(s)) {
      return d >= s ? draft : stored;
    }
    return draft.updatedAt >= stored.updatedAt ? draft : stored;
  }
  return draft ?? stored ?? null;
}
