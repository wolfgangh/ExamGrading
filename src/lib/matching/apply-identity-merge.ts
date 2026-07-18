import { createId } from "@/lib/id";
import { flattenHisRows } from "@/lib/his-sources";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { buildEnrichedRows } from "@/lib/matching/match";
import { computeEffectiveTotal } from "@/lib/grades/points-total";
import { isOnlineStyleExam } from "@/lib/types";
import type {
  ExamProject,
  IdentityMerge,
  PointsRecord,
  Student,
} from "@/lib/types";

export interface ApplyIdentityMergeInput {
  sourceMatriculation: string;
  targetMatriculation: string;
  reason: string;
  confirmedByNote: string;
  /** Wenn Target bereits Punkte hat: trotzdem erzwingen */
  forceOverwriteTargetPoints?: boolean;
}

export type ApplyIdentityMergeResult =
  | { ok: true; project: ExamProject; merge: IdentityMerge }
  | { ok: false; error: string };

function findHisStudent(
  project: ExamProject,
  mat: string
): { lastName: string; firstName: string } | null {
  const his = flattenHisRows(project).find(
    (h) => normalizeMatriculation(h.matriculationNumber) === mat
  );
  if (!his) return null;
  return { lastName: his.lastName, firstName: his.firstName };
}

/**
 * Führt Orphan (falsche Matr.) manuell mit HIS-Matr. zusammen.
 * Physisch: Antritt/Punkte/Students umbiegen + Audit-Eintrag.
 */
export function applyIdentityMerge(
  project: ExamProject,
  input: ApplyIdentityMergeInput
): ApplyIdentityMergeResult {
  const sourceMat = normalizeMatriculation(input.sourceMatriculation);
  const targetMat = normalizeMatriculation(input.targetMatriculation);
  const reason = input.reason.trim();
  const confirmedByNote = input.confirmedByNote.trim();

  if (!sourceMat || !targetMat) {
    return { ok: false, error: "Ungültige Matrikelnummer(n)." };
  }
  if (sourceMat === targetMat) {
    return { ok: false, error: "Quell- und Ziel-Matrikel sind identisch." };
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

  if (!isOnlineStyleExam(project.examType)) {
    return {
      ok: false,
      error:
        "Zusammenführung ist nur für THE / elektronische Prüfung vorgesehen.",
    };
  }

  const alreadyDismissed = (project.identityDismissals ?? []).some(
    (d) =>
      d.active && normalizeMatriculation(d.sourceMatriculation) === sourceMat
  );
  if (alreadyDismissed) {
    return {
      ok: false,
      error:
        "Diese Matrikel wurde als „nicht zusammenführen“ dokumentiert. Bitte zuerst klären.",
    };
  }

  const hisTarget = findHisStudent(project, targetMat);
  if (!hisTarget) {
    return {
      ok: false,
      error: `Ziel-Matrikel ${targetMat} ist nicht in der HIS-Liste.`,
    };
  }

  const existing = (project.identityMerges ?? []).find(
    (m) =>
      m.active &&
      normalizeMatriculation(m.sourceMatriculation) === sourceMat
  );
  if (existing) {
    return {
      ok: false,
      error: `Quell-Matrikel ${sourceMat} ist bereits zusammengeführt (→ ${existing.targetMatriculation}).`,
    };
  }

  const rows = buildEnrichedRows(project);
  const orphanRow = rows.find((r) => r.key === sourceMat);
  const targetRow = rows.find((r) => r.key === targetMat && r.inHis);

  if (!orphanRow) {
    return {
      ok: false,
      error: `Keine Orphan-Daten unter Matrikel ${sourceMat} gefunden.`,
    };
  }
  if (orphanRow.inHis && !orphanRow.attendanceWithoutHis) {
    return {
      ok: false,
      error: "Quelle ist bereits eine HIS-Zeile – Zusammenführung abgebrochen.",
    };
  }
  if (!targetRow) {
    return {
      ok: false,
      error: `HIS-Zeile für ${targetMat} nicht gefunden.`,
    };
  }
  if (targetRow.hasPoints && orphanRow.hasPoints && !input.forceOverwriteTargetPoints) {
    return {
      ok: false,
      error:
        "Ziel hat bereits Punkte. Zusammenführung mit forceOverwriteTargetPoints bestätigen oder manuell klären.",
    };
  }

  const sourceStudent = project.students[sourceMat];
  const targetStudent = project.students[targetMat];
  const sourcePoints = project.points.find(
    (p) => normalizeMatriculation(p.matriculationNumber) === sourceMat
  );
  const targetPoints = project.points.find(
    (p) => normalizeMatriculation(p.matriculationNumber) === targetMat
  );

  const merge: IdentityMerge = {
    id: createId("merge"),
    at: new Date().toISOString(),
    examType: project.examType,
    sourceMatriculation: sourceMat,
    targetMatriculation: targetMat,
    sourceSnapshot: {
      lastName: orphanRow.student.lastName,
      firstName: orphanRow.student.firstName,
      email: orphanRow.student.email ?? sourceStudent?.email,
      totalPoints: orphanRow.totalPoints,
      finalGrade: orphanRow.finalGrade,
    },
    targetSnapshot: {
      lastName: targetRow.student.lastName || hisTarget.lastName,
      firstName: targetRow.student.firstName || hisTarget.firstName,
      statusBefore: targetRow.status,
    },
    reason,
    confirmedByNote,
    active: true,
  };

  // Attendance: Source entfernen, Target angetreten
  let attendance = project.attendance.filter(
    (a) => normalizeMatriculation(a.matriculationNumber) !== sourceMat
  );
  const targetAttIdx = attendance.findIndex(
    (a) => normalizeMatriculation(a.matriculationNumber) === targetMat
  );
  if (targetAttIdx >= 0) {
    attendance = attendance.map((a, i) =>
      i === targetAttIdx ? { ...a, attended: true } : a
    );
  } else if (orphanRow.attended === true || sourcePoints) {
    attendance = [
      ...attendance,
      { matriculationNumber: targetMat, attended: true },
    ];
  }

  // Points: Source → Target
  let points = [...project.points];
  if (sourcePoints) {
    points = points.filter(
      (p) => normalizeMatriculation(p.matriculationNumber) !== sourceMat
    );
    const auditComment = [
      sourcePoints.comment?.trim(),
      `Zusammengeführt aus Matr. ${sourceMat} am ${new Date(merge.at).toLocaleDateString("de-DE")}: ${reason}`,
    ]
      .filter(Boolean)
      .join(" · ");

    if (targetPoints && !input.forceOverwriteTargetPoints) {
      // nur Kommentar ergänzen wenn Target leer an Punkten
    }

    if (targetPoints) {
      if (input.forceOverwriteTargetPoints || !targetRow.hasPoints) {
        points = points.map((p) => {
          if (normalizeMatriculation(p.matriculationNumber) !== targetMat) {
            return p;
          }
          return {
            ...sourcePoints,
            matriculationNumber: targetMat,
            comment: auditComment || sourcePoints.comment,
            source:
              p.source === "manual" || sourcePoints.source === "manual"
                ? "mixed"
                : sourcePoints.source,
          } satisfies PointsRecord;
        });
      }
    } else {
      points.push({
        ...sourcePoints,
        matriculationNumber: targetMat,
        comment: auditComment || sourcePoints.comment,
      });
    }
  } else if (targetPoints) {
    // nur Antritt umbiegen – Kommentar am Target
    points = points.map((p) => {
      if (normalizeMatriculation(p.matriculationNumber) !== targetMat) return p;
      const c = [
        p.comment?.trim(),
        `Antritt zusammengeführt aus Matr. ${sourceMat}: ${reason}`,
      ]
        .filter(Boolean)
        .join(" · ");
      return { ...p, comment: c };
    });
  }

  // Students
  const students: Record<string, Student> = { ...project.students };
  const email =
    sourceStudent?.email ||
    orphanRow.student.email ||
    targetStudent?.email;
  students[targetMat] = {
    matriculationNumber: targetMat,
    lastName:
      hisTarget.lastName ||
      targetStudent?.lastName ||
      targetRow.student.lastName,
    firstName:
      hisTarget.firstName ||
      targetStudent?.firstName ||
      targetRow.student.firstName,
    email: email || undefined,
    attempt: targetStudent?.attempt ?? sourceStudent?.attempt,
  };
  delete students[sourceMat];

  const next: ExamProject = {
    ...project,
    attendance,
    points,
    students,
    identityMerges: [...(project.identityMerges ?? []), merge],
    updatedAt: new Date().toISOString(),
  };

  // Sanity: Target sollte Punkte haben wenn Source welche hatte
  if (sourcePoints) {
    const tp = next.points.find(
      (p) => normalizeMatriculation(p.matriculationNumber) === targetMat
    );
    if (!tp || computeEffectiveTotal(tp) == null) {
      return {
        ok: false,
        error: "Interner Fehler: Punkte wurden nicht auf das Ziel übertragen.",
      };
    }
  }

  return { ok: true, project: next, merge };
}
