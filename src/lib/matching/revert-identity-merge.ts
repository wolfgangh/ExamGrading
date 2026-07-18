import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { flattenHisRows } from "@/lib/his-sources";
import { isOnlineStyleExam } from "@/lib/types";
import type {
  ExamProject,
  IdentityMerge,
  PointsRecord,
  Student,
} from "@/lib/types";

export type RevertMergeResult =
  | { ok: true; project: ExamProject; merge: IdentityMerge }
  | { ok: false; error: string };

function canRevert(merge: IdentityMerge): boolean {
  // Mindestens Source-Student-Snapshot oder Points für sinnvollen Undo
  return (
    merge.sourcePointsRecord !== undefined ||
    merge.sourceStudent !== undefined ||
    merge.sourceAttended !== undefined
  );
}

/**
 * Hebt eine aktive Zusammenführung auf und stellt Orphan-Daten wieder her.
 */
export function revertIdentityMerge(
  project: ExamProject,
  mergeId: string,
  input: { reason: string; confirmedByNote: string }
): RevertMergeResult {
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

  const merges = [...(project.identityMerges ?? [])];
  const idx = merges.findIndex((m) => m.id === mergeId);
  if (idx < 0) {
    return { ok: false, error: "Zusammenführung nicht gefunden." };
  }
  const merge = merges[idx];
  if (!merge.active) {
    return { ok: false, error: "Diese Zusammenführung ist bereits aufgehoben." };
  }

  const sourceMat = normalizeMatriculation(merge.sourceMatriculation);
  const targetMat = normalizeMatriculation(merge.targetMatriculation);
  if (!sourceMat || !targetMat) {
    return { ok: false, error: "Ungültige Matrikelnummern im Merge-Eintrag." };
  }

  if (!canRevert(merge)) {
    return {
      ok: false,
      error:
        "Dieser Merge enthält keine Undo-Snapshots (älterer Eintrag). Bitte Daten manuell korrigieren oder neu importieren.",
    };
  }

  // Points
  let points = project.points.filter(
    (p) => normalizeMatriculation(p.matriculationNumber) !== targetMat
  );
  // Target vor Merge wiederherstellen
  if (merge.targetPointsBefore) {
    points.push({
      ...merge.targetPointsBefore,
      matriculationNumber: targetMat,
    });
  }
  // Source wieder anlegen
  if (merge.sourcePointsRecord) {
    // falls schon vorhanden (sollte nicht), ersetzen
    points = points.filter(
      (p) => normalizeMatriculation(p.matriculationNumber) !== sourceMat
    );
    const undoComment = [
      merge.sourcePointsRecord.comment?.trim(),
      `Merge aufgehoben am ${new Date().toLocaleDateString("de-DE")}: ${reason}`,
    ]
      .filter(Boolean)
      .join(" · ");
    points.push({
      ...merge.sourcePointsRecord,
      matriculationNumber: sourceMat,
      comment: undoComment,
    } satisfies PointsRecord);
  } else if (merge.targetPointsBefore === null || merge.targetPointsBefore === undefined) {
    // Target hatte keine Punkte, Source-Snapshot fehlt – Target-Punkte (die vom Source kamen) entfernen
    // already filtered target above if we only had source on target - if sourcePointsRecord missing,
    // remove target points that look like merged (best effort already done by not restoring)
  }

  // Wenn Source-Points fehlten, aber Target jetzt Punkte hat die vom Merge stammen:
  // ohne sourcePointsRecord können wir sie nicht dem Source zuordnen – Target bleibt ohne
  // (bereits entfernt wenn targetPointsBefore null und wir target rausgenommen haben)

  // Attendance
  const attendance = project.attendance.filter((a) => {
    const k = normalizeMatriculation(a.matriculationNumber);
    return k !== sourceMat && k !== targetMat;
  });
  if (merge.sourceAttended) {
    attendance.push({ matriculationNumber: sourceMat, attended: true });
  }
  if (merge.targetAttendedBefore === true) {
    attendance.push({ matriculationNumber: targetMat, attended: true });
  } else if (merge.targetAttendedBefore === false) {
    attendance.push({ matriculationNumber: targetMat, attended: false });
  }
  // null = kein Attendance-Eintrag für Target vorher

  // Students
  const students: Record<string, Student> = { ...project.students };
  const his = flattenHisRows(project).find(
    (h) => normalizeMatriculation(h.matriculationNumber) === targetMat
  );
  // Target: HIS-Name, E-Mail von target student ohne Source-Übernahme
  students[targetMat] = {
    matriculationNumber: targetMat,
    lastName:
      his?.lastName ||
      merge.targetSnapshot.lastName ||
      students[targetMat]?.lastName ||
      "",
    firstName:
      his?.firstName ||
      merge.targetSnapshot.firstName ||
      students[targetMat]?.firstName ||
      "",
    email: students[targetMat]?.email,
    attempt: students[targetMat]?.attempt,
  };
  // Source wiederherstellen
  if (merge.sourceStudent) {
    students[sourceMat] = {
      ...merge.sourceStudent,
      matriculationNumber: sourceMat,
    };
  } else {
    students[sourceMat] = {
      matriculationNumber: sourceMat,
      lastName: merge.sourceSnapshot.lastName,
      firstName: merge.sourceSnapshot.firstName,
      email: merge.sourceSnapshot.email,
    };
  }

  const updated: IdentityMerge = {
    ...merge,
    active: false,
    undoneAt: new Date().toISOString(),
    undoReason: reason,
    undoConfirmedByNote: confirmedByNote,
  };
  merges[idx] = updated;

  return {
    ok: true,
    merge: updated,
    project: {
      ...project,
      points,
      attendance,
      students,
      identityMerges: merges,
      updatedAt: new Date().toISOString(),
    },
  };
}
