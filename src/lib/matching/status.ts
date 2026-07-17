import type { StudentStatus } from "@/lib/types";

export function deriveStudentStatus(input: {
  inHis: boolean;
  attended: boolean | null;
  hasPoints: boolean;
  finalGrade: number | null;
  hasGradeOverride: boolean;
}): StudentStatus {
  const { inHis, attended, hasPoints, finalGrade, hasGradeOverride } = input;

  if (!inHis) {
    if (hasPoints || attended) return "mismatch";
    return "mismatch";
  }

  // No-Show: angemeldet und (explizit nicht angetreten ODER keine Antrittsinfo und keine Punkte)
  if (attended === false) {
    return "no_show";
  }

  if (!hasPoints && attended !== true) {
    // nur in HIS, weder Antritt noch Punkte
    return "registered";
  }

  if (attended === true && !hasPoints) {
    return "attended";
  }

  if (hasPoints) {
    if (finalGrade != null) {
      return inHis ? "export_ready" : "graded";
    }
    return "points";
  }

  if (hasGradeOverride && finalGrade != null) {
    return "export_ready";
  }

  return "registered";
}

/** No-Show gilt als exportbereit (leere Note in HIS). */
export function isExportReadyStatus(status: StudentStatus): boolean {
  return status === "export_ready" || status === "no_show";
}
