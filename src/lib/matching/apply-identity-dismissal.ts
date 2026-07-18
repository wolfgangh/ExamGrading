import { createId } from "@/lib/id";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { buildEnrichedRows } from "@/lib/matching/match";
import { isOrphanRow } from "@/lib/matching/orphan-resolution";
import { isOnlineStyleExam } from "@/lib/types";
import type { ExamProject, IdentityDismissal } from "@/lib/types";

export type DismissResult =
  | { ok: true; project: ExamProject; dismissal: IdentityDismissal }
  | { ok: false; error: string };

/**
 * Orphan bewusst nicht zusammenführen – nach Prüfer-Sichtung dokumentieren.
 */
export function applyIdentityDismissal(
  project: ExamProject,
  input: {
    sourceMatriculation: string;
    reason: string;
    confirmedByNote: string;
  }
): DismissResult {
  const sourceMat = normalizeMatriculation(input.sourceMatriculation);
  const reason = input.reason.trim();
  const confirmedByNote = input.confirmedByNote.trim();

  if (!sourceMat) {
    return { ok: false, error: "Ungültige Matrikelnummer." };
  }
  if (!isOnlineStyleExam(project.examType)) {
    return {
      ok: false,
      error: "Ablehnung nur für THE / elektronische Prüfung vorgesehen.",
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

  const alreadyMerged = (project.identityMerges ?? []).some(
    (m) =>
      m.active && normalizeMatriculation(m.sourceMatriculation) === sourceMat
  );
  if (alreadyMerged) {
    return {
      ok: false,
      error: "Diese Matrikel ist bereits zusammengeführt.",
    };
  }

  const already = (project.identityDismissals ?? []).find(
    (d) =>
      d.active && normalizeMatriculation(d.sourceMatriculation) === sourceMat
  );
  if (already) {
    return {
      ok: false,
      error: "Diese Matrikel wurde bereits als geprüft (abgelehnt) dokumentiert.",
    };
  }

  const rows = buildEnrichedRows(project);
  const orphan = rows.find((r) => r.key === sourceMat && isOrphanRow(r));
  if (!orphan) {
    return {
      ok: false,
      error: `Kein offener Orphan unter Matrikel ${sourceMat}.`,
    };
  }

  const dismissal: IdentityDismissal = {
    id: createId("dismiss"),
    at: new Date().toISOString(),
    examType: project.examType,
    sourceMatriculation: sourceMat,
    sourceSnapshot: {
      lastName: orphan.student.lastName,
      firstName: orphan.student.firstName,
      email: orphan.student.email,
      totalPoints: orphan.totalPoints,
      finalGrade: orphan.finalGrade,
    },
    reason,
    confirmedByNote,
    active: true,
  };

  return {
    ok: true,
    dismissal,
    project: {
      ...project,
      identityDismissals: [...(project.identityDismissals ?? []), dismissal],
      updatedAt: new Date().toISOString(),
    },
  };
}
