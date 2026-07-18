import { isOnlineStyleExam } from "@/lib/types";
import type { ExamProject, IdentityDismissal } from "@/lib/types";

export type RevertDismissalResult =
  | { ok: true; project: ExamProject; dismissal: IdentityDismissal }
  | { ok: false; error: string };

/**
 * Hebt eine aktive Ablehnung auf – Orphan ist wieder ungeprüft.
 * updatedAt ändert sich → JSON-Sicherung wird wieder erforderlich.
 */
export function revertIdentityDismissal(
  project: ExamProject,
  dismissalId: string,
  input: { reason: string; confirmedByNote: string }
): RevertDismissalResult {
  const reason = input.reason.trim();
  const confirmedByNote = input.confirmedByNote.trim();

  if (!isOnlineStyleExam(project.examType)) {
    return {
      ok: false,
      error: "Aufheben nur für THE / elektronische Prüfung vorgesehen.",
    };
  }
  if (reason.length < 8) {
    return {
      ok: false,
      error: "Bitte eine aussagekräftige Begründung angeben (mind. 8 Zeichen).",
    };
  }
  if (confirmedByNote.length < 4) {
    return {
      ok: false,
      error: "Bitte bestätigen, dass die Daten gesichtet wurden.",
    };
  }

  const list = [...(project.identityDismissals ?? [])];
  const idx = list.findIndex((d) => d.id === dismissalId);
  if (idx < 0) {
    return { ok: false, error: "Ablehnung nicht gefunden." };
  }
  const d = list[idx];
  if (!d.active) {
    return { ok: false, error: "Diese Ablehnung ist bereits aufgehoben." };
  }

  const updated: IdentityDismissal = {
    ...d,
    active: false,
    undoneAt: new Date().toISOString(),
    undoReason: reason,
    undoConfirmedByNote: confirmedByNote,
  };
  list[idx] = updated;

  return {
    ok: true,
    dismissal: updated,
    project: {
      ...project,
      identityDismissals: list,
      updatedAt: new Date().toISOString(),
    },
  };
}
