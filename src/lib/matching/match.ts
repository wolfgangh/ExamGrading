import {
  calculateGrade,
  effectiveTotalPoints,
  sumSubAreaPoints,
} from "@/lib/grades/schema";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { deriveStudentStatus } from "@/lib/matching/status";
import type {
  EnrichedStudentRow,
  ExamProject,
  MatriculationKey,
  Student,
} from "@/lib/types";

function emptyStudent(mat: string, last = "", first = ""): Student {
  return {
    matriculationNumber: mat,
    lastName: last,
    firstName: first,
  };
}

/**
 * Baut die angereicherte Studierendenliste:
 * HIS = Master, Antritte + Punkte per Matrikelnummer gematcht.
 * Orphans (Punkte/Antritt ohne HIS) erscheinen am Ende als mismatch.
 */
export function buildEnrichedRows(project: ExamProject): EnrichedStudentRow[] {
  const { gradeSchema, subAreas } = project;
  const rows: EnrichedStudentRow[] = [];
  const seen = new Set<MatriculationKey>();

  const attendanceByKey = new Map<string, boolean>();
  for (const a of project.attendance) {
    const key = normalizeMatriculation(a.matriculationNumber);
    if (!key) continue;
    attendanceByKey.set(key, a.attended);
  }

  const pointsByKey = new Map(
    project.points
      .map((p) => {
        const key = normalizeMatriculation(p.matriculationNumber);
        return key ? ([key, p] as const) : null;
      })
      .filter((x): x is readonly [string, (typeof project.points)[0]] => !!x)
  );

  // 1) HIS-Master
  const hisSorted = [...project.hisRows].sort(
    (a, b) => a.orderIndex - b.orderIndex
  );

  for (const his of hisSorted) {
    const key = normalizeMatriculation(his.matriculationNumber);
    if (!key) continue;
    seen.add(key);

    const stored = project.students[key];
    const student: Student = {
      matriculationNumber:
        stored?.matriculationNumber ?? his.matriculationNumber,
      lastName: stored?.lastName || his.lastName,
      firstName: stored?.firstName || his.firstName,
      email: stored?.email,
      attempt: stored?.attempt ?? null,
    };

    const attended = attendanceByKey.has(key)
      ? attendanceByKey.get(key)!
      : null;
    const pointsRec = pointsByKey.get(key);

    const subAreaPoints: Record<string, number | null> = {};
    for (const sa of subAreas) {
      subAreaPoints[sa.id] = pointsRec?.bySubArea[sa.id] ?? null;
    }

    const summed =
      pointsRec != null
        ? sumSubAreaPoints(pointsRec.bySubArea) ?? pointsRec.totalPoints
        : null;
    const totalPoints = effectiveTotalPoints(
      summed ?? pointsRec?.totalPoints ?? null,
      pointsRec?.totalOverride
    );
    const hasPoints = totalPoints != null;
    // Wenn Punkte da sind, aber kein Antritt importiert: als angetreten werten
    const effectiveAttended =
      attended === true || (attended == null && hasPoints)
        ? true
        : attended === false
          ? false
          : attended;

    const calculatedGrade =
      totalPoints != null
        ? calculateGrade(totalPoints, gradeSchema)
        : null;
    const gradeOverride = pointsRec?.gradeOverride ?? null;
    const finalGrade =
      gradeOverride != null ? gradeOverride : calculatedGrade;

    const status = deriveStudentStatus({
      inHis: true,
      attended: effectiveAttended,
      hasPoints,
      finalGrade,
      hasGradeOverride: gradeOverride != null,
    });

    const warnings: string[] = [];
    if (totalPoints != null && totalPoints > gradeSchema.maxPoints) {
      warnings.push("Punkte über Maximum");
    }
    if (totalPoints != null && totalPoints < 0) {
      warnings.push("Negative Punkte");
    }
    if (effectiveAttended === true && !hasPoints) {
      warnings.push("Angetreten, aber keine Punkte");
    }
    if (gradeOverride != null) {
      warnings.push("Note manuell überschrieben");
    }

    rows.push({
      key,
      student,
      inHis: true,
      attended: effectiveAttended,
      hasPoints,
      totalPoints,
      percent:
        totalPoints != null && gradeSchema.maxPoints > 0
          ? totalPoints / gradeSchema.maxPoints
          : null,
      calculatedGrade,
      finalGrade,
      status,
      warnings,
      subAreaPoints,
      gradeOverride,
      comment: pointsRec?.comment,
      attempt: student.attempt ?? null,
      orderIndex: his.orderIndex,
    });
  }

  // 2) Orphans: Antritt ohne HIS
  for (const [key, attended] of attendanceByKey) {
    if (seen.has(key)) continue;
    seen.add(key);
    const stored = project.students[key];
    const pointsRec = pointsByKey.get(key);
    const student = stored ?? emptyStudent(key);

    const subAreaPoints: Record<string, number | null> = {};
    for (const sa of subAreas) {
      subAreaPoints[sa.id] = pointsRec?.bySubArea[sa.id] ?? null;
    }
    const summed =
      pointsRec != null
        ? sumSubAreaPoints(pointsRec.bySubArea) ?? pointsRec.totalPoints
        : null;
    const totalPoints = effectiveTotalPoints(
      summed ?? pointsRec?.totalPoints ?? null,
      pointsRec?.totalOverride
    );

    rows.push({
      key,
      student,
      inHis: false,
      attended,
      hasPoints: totalPoints != null,
      totalPoints,
      percent:
        totalPoints != null && gradeSchema.maxPoints > 0
          ? totalPoints / gradeSchema.maxPoints
          : null,
      calculatedGrade:
        totalPoints != null
          ? calculateGrade(totalPoints, gradeSchema)
          : null,
      finalGrade:
        pointsRec?.gradeOverride ??
        (totalPoints != null
          ? calculateGrade(totalPoints, gradeSchema)
          : null),
      status: "mismatch",
      warnings: ["In Antrittsliste, aber nicht in HIS-Masterliste"],
      subAreaPoints,
      gradeOverride: pointsRec?.gradeOverride ?? null,
      comment: pointsRec?.comment,
      attempt: student.attempt ?? null,
      orderIndex: 10_000 + rows.length,
    });
  }

  // 3) Orphans: Punkte ohne HIS
  for (const [key, pointsRec] of pointsByKey) {
    if (seen.has(key)) continue;
    seen.add(key);
    const stored = project.students[key];
    const student =
      stored ?? emptyStudent(pointsRec.matriculationNumber);

    const subAreaPoints: Record<string, number | null> = {};
    for (const sa of subAreas) {
      subAreaPoints[sa.id] = pointsRec.bySubArea[sa.id] ?? null;
    }
    const summed =
      sumSubAreaPoints(pointsRec.bySubArea) ?? pointsRec.totalPoints;
    const totalPoints = effectiveTotalPoints(
      summed,
      pointsRec.totalOverride
    );

    rows.push({
      key,
      student,
      inHis: false,
      attended: true,
      hasPoints: totalPoints != null,
      totalPoints,
      percent:
        totalPoints != null && gradeSchema.maxPoints > 0
          ? totalPoints / gradeSchema.maxPoints
          : null,
      calculatedGrade:
        totalPoints != null
          ? calculateGrade(totalPoints, gradeSchema)
          : null,
      finalGrade:
        pointsRec.gradeOverride ??
        (totalPoints != null
          ? calculateGrade(totalPoints, gradeSchema)
          : null),
      status: "mismatch",
      warnings: ["Punkte vorhanden, aber nicht in HIS-Masterliste"],
      subAreaPoints,
      gradeOverride: pointsRec.gradeOverride ?? null,
      comment: pointsRec.comment,
      attempt: student.attempt ?? null,
      orderIndex: 20_000 + rows.length,
    });
  }

  return rows;
}
