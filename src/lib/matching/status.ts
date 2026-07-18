import type { StudentStatus } from "@/lib/types";

export function deriveStudentStatus(input: {
  inHis: boolean;
  attended: boolean | null;
  hasPoints: boolean;
  finalGrade: number | null;
  hasGradeOverride: boolean;
  /** Offene Detailaufgaben („Bewertung notwendig“) */
  hasOpenGrading?: boolean;
  /** Studienarbeit o. Ä.: kein No-Show-Konzept über Antrittsliste */
  skipNoShow?: boolean;
}): StudentStatus {
  const {
    inHis,
    attended,
    hasPoints,
    finalGrade,
    hasGradeOverride,
    hasOpenGrading,
    skipNoShow,
  } = input;

  if (!inHis) {
    // Manuell hinzugefügt: mit Note „graded“, sonst mismatch
    if (finalGrade != null && !hasOpenGrading) return "graded";
    if (hasPoints || attended) return "mismatch";
    return "mismatch";
  }

  if (!skipNoShow && attended === false) {
    return "no_show";
  }

  // Manuelle Note (z. B. StA manuell) ohne Punkte
  if (hasGradeOverride && finalGrade != null && !hasOpenGrading) {
    return "export_ready";
  }

  if (!hasPoints && attended !== true) {
    return "registered";
  }

  if (attended === true && !hasPoints) {
    return "attended";
  }

  if (hasPoints) {
    if (hasOpenGrading) {
      return "points";
    }
    if (finalGrade != null) {
      return "export_ready";
    }
    return "points";
  }

  return "registered";
}

/** No-Show gilt als exportbereit (leere Note in HIS). */
export function isExportReadyStatus(status: StudentStatus): boolean {
  return status === "export_ready" || status === "no_show";
}
