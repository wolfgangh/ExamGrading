import { createId } from "@/lib/id";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { buildEnrichedRows } from "@/lib/matching/match";
import { isOrphanRow } from "@/lib/matching/orphan-resolution";
import { clearStructuralBackupMilestones } from "@/lib/workflow-milestones";
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
    project: clearStructuralBackupMilestones({
      ...project,
      identityDismissals: [...(project.identityDismissals ?? []), dismissal],
      updatedAt: new Date().toISOString(),
    }),
  };
}

export type BulkDismissResult =
  | {
      ok: true;
      project: ExamProject;
      dismissals: IdentityDismissal[];
      count: number;
    }
  | { ok: false; error: string };

/**
 * Alle übergebenen Orphans mit derselben Begründung ablehnen.
 * Typisch: ungeprüfte Orphans ohne Merge-Vorschlag.
 */
export function applyIdentityDismissalBulk(
  project: ExamProject,
  input: {
    sourceMatriculations: string[];
    reason: string;
    confirmedByNote: string;
  }
): BulkDismissResult {
  const reason = input.reason.trim();
  const confirmedByNote = input.confirmedByNote.trim();
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
  if (!input.sourceMatriculations.length) {
    return { ok: false, error: "Keine Orphans zum Ablehnen ausgewählt." };
  }

  let current = project;
  const created: IdentityDismissal[] = [];
  for (const mat of input.sourceMatriculations) {
    const result = applyIdentityDismissal(current, {
      sourceMatriculation: mat,
      reason,
      confirmedByNote,
    });
    if (!result.ok) {
      // bereits abgelehnt/merged: überspringen wenn „bereits“, sonst abbrechen
      if (
        result.error.includes("bereits") ||
        result.error.includes("Kein offener Orphan")
      ) {
        continue;
      }
      return { ok: false, error: result.error };
    }
    current = result.project;
    created.push({ ...result.dismissal, bulk: true });
  }

  if (created.length === 0) {
    return {
      ok: false,
      error: "Keine Orphans konnten abgelehnt werden (bereits erledigt?).",
    };
  }

  // bulk-Flag auf den gerade erzeugten Einträgen setzen
  const ids = new Set(created.map((d) => d.id));
  const identityDismissals = (current.identityDismissals ?? []).map((d) =>
    ids.has(d.id) ? { ...d, bulk: true } : d
  );

  return {
    ok: true,
    count: created.length,
    dismissals: created,
    project: clearStructuralBackupMilestones({
      ...current,
      identityDismissals,
      updatedAt: new Date().toISOString(),
    }),
  };
}
