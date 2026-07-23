import { calculateGrade } from "@/lib/grades/schema";
import { computeEffectiveTotal } from "@/lib/grades/points-total";
import {
  getNextGradeInfo,
  isFailedGrade,
  pointsBelowPass,
} from "@/lib/grades/next-grade";
import { ensureScenarios, getActiveScenario } from "@/lib/grades/scenarios";
import { countMissingCriteria } from "@/lib/grades/sta-criteria";
import {
  computePortfolioGradeForProject,
  countMissingPortfolioCells,
} from "@/lib/grades/portfolio";
import { flattenHisRows, getHisSources } from "@/lib/his-sources";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { deriveStudentStatus } from "@/lib/matching/status";
import type {
  EnrichedStudentRow,
  ExamProject,
  GradeSchema,
  MatriculationKey,
  PointsRecord,
  Student,
} from "@/lib/types";
import {
  isHisManualAssessmentExam,
  isPortfolioExam,
  isStaCriteriaExam,
} from "@/lib/types";

function emptyStudent(mat: string, last = "", first = ""): Student {
  return {
    matriculationNumber: mat,
    lastName: last,
    firstName: first,
  };
}

/** Berechnete Note je Prüfungstyp (Portfolio = Teilnoten-Mittel, sonst Punkte) */
function calculatedGradeForRecord(
  project: ExamProject,
  pointsRec: PointsRecord | undefined,
  totalPoints: number | null,
  gradeSchema: GradeSchema,
  groupId?: string | null
): number | null {
  if (isPortfolioExam(project.examType)) {
    return computePortfolioGradeForProject(project, pointsRec, { groupId });
  }
  if (totalPoints != null) {
    return calculateGrade(totalPoints, gradeSchema);
  }
  return null;
}

function scenarioGradesForPoints(
  project: ExamProject,
  totalPoints: number | null,
  gradeOverride: number | null
): EnrichedStudentRow["scenarioGrades"] {
  const scenarios = ensureScenarios(project).filter(
    (sc) => !sc.editable || sc.enabled === true
  );
  return scenarios.map((sc) => {
    const grade =
      gradeOverride != null
        ? gradeOverride
        : totalPoints != null
          ? calculateGrade(totalPoints, sc.schema)
          : null;
    return { scenarioId: sc.id, name: sc.name, grade };
  });
}

function gradeExtras(
  totalPoints: number | null,
  finalGrade: number | null,
  schema: GradeSchema,
  project: ExamProject,
  gradeOverride: number | null
) {
  const next =
    totalPoints != null
      ? getNextGradeInfo(totalPoints, schema)
      : {
          currentGrade: 5,
          nextGrade: null,
          pointsNeeded: null,
          thresholdForNext: null,
        };

  return {
    pointsToNext: totalPoints != null ? next.pointsNeeded : null,
    nextGrade: totalPoints != null ? next.nextGrade : null,
    isFailed:
      finalGrade != null &&
      isFailedGrade(finalGrade) &&
      totalPoints != null,
    pointsBelowPass: pointsBelowPass(totalPoints, schema),
    scenarioGrades: scenarioGradesForPoints(
      project,
      totalPoints,
      gradeOverride
    ),
  };
}

/**
 * Baut die angereicherte Studierendenliste:
 * HIS = Master, Antritte + Punkte per Matrikelnummer gematcht.
 * Noten nach aktivem Szenario.
 */
export function buildEnrichedRows(project: ExamProject): EnrichedStudentRow[] {
  const active = getActiveScenario(project);
  const gradeSchema = active.schema;
  const { subAreas } = project;
  const totalOpts = {
    criteria: isStaCriteriaExam(project.examType)
      ? project.criteria
      : undefined,
    maxPoints: gradeSchema.maxPoints,
  };
  const rows: EnrichedStudentRow[] = [];
  const seen = new Set<MatriculationKey>();

  const hasAttendanceImport = project.attendance.length > 0;
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
      .filter((x): x is readonly [string, PointsRecord] => !!x)
  );

  const sources = getHisSources(project);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const flatHis = flattenHisRows(project);
  const matInSources = new Map<string, number>();
  for (const h of flatHis) {
    const k = normalizeMatriculation(h.matriculationNumber);
    if (!k) continue;
    matInSources.set(k, (matInSources.get(k) ?? 0) + 1);
  }

  const hisSorted = [...flatHis].sort((a, b) => {
    const sa = a.sourceId ?? "";
    const sb = b.sourceId ?? "";
    if (sa !== sb) return sa.localeCompare(sb);
    return a.orderIndex - b.orderIndex;
  });

  const mergesByTarget = new Map<string, string[]>();
  for (const m of project.identityMerges ?? []) {
    if (!m.active) continue;
    const t = normalizeMatriculation(m.targetMatriculation);
    const s = normalizeMatriculation(m.sourceMatriculation);
    if (!t || !s) continue;
    const list = mergesByTarget.get(t) ?? [];
    list.push(s);
    mergesByTarget.set(t, list);
  }

  for (const his of hisSorted) {
    const key = normalizeMatriculation(his.matriculationNumber);
    if (!key) continue;
    const rowUid = `${his.sourceId ?? "legacy"}:${key}`;
    if (seen.has(rowUid)) continue;
    seen.add(rowUid);
    // für Orphan-Erkennung: Matnr. als „in HIS“ markieren
    seen.add(key);

    const src = his.sourceId ? sourceById.get(his.sourceId) : undefined;
    const stored = project.students[key];
    const student: Student = {
      matriculationNumber:
        stored?.matriculationNumber ?? his.matriculationNumber,
      lastName: stored?.lastName || his.lastName,
      firstName: stored?.firstName || his.firstName,
      email: stored?.email,
      attempt: stored?.attempt ?? null,
      groupId: stored?.groupId ?? null,
    };

    // Mit Antrittsliste: fehlend = No-Show; ohne Liste: unbekannt (null)
    let attended: boolean | null = attendanceByKey.has(key)
      ? true
      : hasAttendanceImport
        ? false
        : null;
    const pointsRec = pointsByKey.get(key);

    const subAreaPoints: Record<string, number | null> = {};
    for (const sa of subAreas) {
      subAreaPoints[sa.id] = pointsRec?.bySubArea[sa.id] ?? null;
    }

    const totalPoints =
      pointsRec != null
        ? computeEffectiveTotal(pointsRec, totalOpts)
        : null;
    const gradeOverride = pointsRec?.gradeOverride ?? null;
    const calculatedGrade = calculatedGradeForRecord(
      project,
      pointsRec,
      totalPoints,
      gradeSchema,
      student.groupId
    );
    const finalGrade =
      gradeOverride != null ? gradeOverride : calculatedGrade;
    const hasPoints =
      totalPoints != null ||
      calculatedGrade != null ||
      (isHisManualAssessmentExam(project.examType) && gradeOverride != null);
    const needsGradingCount = pointsRec?.needsGrading?.length ?? 0;
    const missingCriteria =
      isStaCriteriaExam(project.examType) && project.criteria?.length
        ? countMissingCriteria(pointsRec?.criterionValues, project.criteria)
        : 0;
    const missingPortfolio =
      isPortfolioExam(project.examType) &&
      (project.portfolioComponents?.length ?? 0) > 0
        ? countMissingPortfolioCells(project, pointsRec, {
            groupId: student.groupId,
          })
        : 0;
    const hasOpenGrading =
      needsGradingCount > 0 || missingCriteria > 0 || missingPortfolio > 0;
    // Punkte retten Antritt (z. B. Moodle-Antritt fehlt, THE aber geschrieben)
    if (hasPoints && attended !== true) {
      attended = true;
    }
    // StA / Portfolio: kein No-Show über Antrittsliste
    const effectiveAttended = isHisManualAssessmentExam(project.examType)
      ? true
      : attended;

    const status = deriveStudentStatus({
      inHis: true,
      attended: effectiveAttended,
      hasPoints,
      finalGrade,
      hasGradeOverride: gradeOverride != null,
      hasOpenGrading,
      skipNoShow: isHisManualAssessmentExam(project.examType),
    });

    const warnings: string[] = [];
    if (
      !isPortfolioExam(project.examType) &&
      totalPoints != null &&
      totalPoints > gradeSchema.maxPoints
    ) {
      warnings.push("Punkte über Maximum");
    }
    if (totalPoints != null && totalPoints < 0) {
      warnings.push("Negative Punkte");
    }
    if (effectiveAttended === true && !hasPoints) {
      warnings.push(
        isPortfolioExam(project.examType)
          ? "Teilnoten unvollständig"
          : "Angetreten, aber keine Punkte"
      );
    }
    if (gradeOverride != null) {
      warnings.push("Note manuell überschrieben");
    }
    if (needsGradingCount > 0) {
      warnings.push(
        `${needsGradingCount} Aufgabe(n) „Bewertung notwendig“ – nicht exportbereit`
      );
    }
    if (missingCriteria > 0) {
      warnings.push(
        `${missingCriteria} Kriterium/Kriterien ohne Wert – Note noch nicht berechnet`
      );
    }
    if (missingPortfolio > 0) {
      warnings.push(
        `${missingPortfolio} Teilleistung(en) ohne Note – Gesamtnote fehlt`
      );
    }
    const multiProgram = (matInSources.get(key) ?? 0) > 1;
    if (multiProgram) {
      warnings.push("Matrikelnummer in mehreren HIS-/Studiengangsdateien");
    }
    const mergedFrom = mergesByTarget.get(key);
    if (mergedFrom?.length) {
      warnings.push(
        `Manuell zusammengeführt aus Matr. ${mergedFrom.join(", ")} (THE-Zuordnung)`
      );
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
      orderIndex: rows.length,
      hisSourceId: his.sourceId,
      programCode: src?.programCode,
      examNumber: his.examNumber || src?.examNumber,
      mergedFromMatriculation: mergedFrom?.[0],
      multiProgram,
      attendanceWithoutHis: false,
      needsGradingCount,
      ...gradeExtras(
        totalPoints,
        finalGrade,
        gradeSchema,
        project,
        gradeOverride
      ),
    });
  }

  for (const [key] of attendanceByKey) {
    if (seen.has(key)) continue;
    seen.add(key);
    const stored = project.students[key];
    const pointsRec = pointsByKey.get(key);
    const student = stored ?? emptyStudent(key);

    const subAreaPoints: Record<string, number | null> = {};
    for (const sa of subAreas) {
      subAreaPoints[sa.id] = pointsRec?.bySubArea[sa.id] ?? null;
    }
    const totalPoints =
      pointsRec != null
        ? computeEffectiveTotal(pointsRec, totalOpts)
        : null;
    const gradeOverride = pointsRec?.gradeOverride ?? null;
    const calculatedGrade = calculatedGradeForRecord(
      project,
      pointsRec,
      totalPoints,
      gradeSchema,
      student.groupId
    );
    const finalGrade =
      gradeOverride != null ? gradeOverride : calculatedGrade;

    rows.push({
      key,
      student,
      inHis: false,
      attended: true,
      hasPoints: totalPoints != null || calculatedGrade != null,
      totalPoints,
      percent:
        totalPoints != null && gradeSchema.maxPoints > 0
          ? totalPoints / gradeSchema.maxPoints
          : null,
      calculatedGrade,
      finalGrade,
      status: "mismatch",
      warnings: [
        "Antritt ohne HIS-Anmeldung – Prüfer-Prüfung erforderlich (keine automatische Zuordnung)",
      ],
      subAreaPoints,
      gradeOverride,
      comment: pointsRec?.comment,
      attempt: student.attempt ?? null,
      orderIndex: 10_000 + rows.length,
      multiProgram: false,
      attendanceWithoutHis: true,
      ...gradeExtras(
        totalPoints,
        finalGrade,
        gradeSchema,
        project,
        gradeOverride
      ),
    });
  }

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
    const totalPoints = computeEffectiveTotal(pointsRec, totalOpts);
    const gradeOverride = pointsRec.gradeOverride ?? null;
    const calculatedGrade = calculatedGradeForRecord(
      project,
      pointsRec,
      totalPoints,
      gradeSchema,
      student.groupId
    );
    const finalGrade =
      gradeOverride != null ? gradeOverride : calculatedGrade;

    rows.push({
      key,
      student,
      inHis: false,
      attended: true,
      hasPoints:
        totalPoints != null ||
        calculatedGrade != null ||
        gradeOverride != null,
      totalPoints,
      percent:
        totalPoints != null && gradeSchema.maxPoints > 0
          ? totalPoints / gradeSchema.maxPoints
          : null,
      calculatedGrade,
      finalGrade,
      status: "mismatch",
      warnings: ["Punkte vorhanden, aber nicht in HIS-Masterliste"],
      subAreaPoints,
      gradeOverride,
      comment: pointsRec.comment,
      attempt: student.attempt ?? null,
      orderIndex: 20_000 + rows.length,
      multiProgram: false,
      attendanceWithoutHis: false,
      ...gradeExtras(
        totalPoints,
        finalGrade,
        gradeSchema,
        project,
        gradeOverride
      ),
    });
  }

  // Manuell angelegte Studierende (ohne HIS/Antritt/Punkte-Import)
  for (const [rawKey, stored] of Object.entries(project.students ?? {})) {
    const key = normalizeMatriculation(rawKey);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const pointsRec = pointsByKey.get(key);
    const subAreaPoints: Record<string, number | null> = {};
    for (const sa of subAreas) {
      subAreaPoints[sa.id] = pointsRec?.bySubArea[sa.id] ?? null;
    }
    const totalPoints =
      pointsRec != null
        ? computeEffectiveTotal(pointsRec, totalOpts)
        : null;
    const gradeOverride = pointsRec?.gradeOverride ?? null;
    const calculatedGrade = calculatedGradeForRecord(
      project,
      pointsRec,
      totalPoints,
      gradeSchema,
      stored.groupId
    );
    const finalGrade =
      gradeOverride != null ? gradeOverride : calculatedGrade;
    const missingCriteria =
      isStaCriteriaExam(project.examType) && project.criteria?.length
        ? countMissingCriteria(pointsRec?.criterionValues, project.criteria)
        : 0;
    const missingPortfolio =
      isPortfolioExam(project.examType) &&
      (project.portfolioComponents?.length ?? 0) > 0
        ? countMissingPortfolioCells(project, pointsRec, {
            groupId: stored.groupId,
          })
        : 0;
    const warnings = ["Manuell hinzugefügt – nicht in HISinOne-Masterliste"];
    if (missingCriteria > 0) {
      warnings.push(`${missingCriteria} Kriterium/Kriterien ohne Wert`);
    }
    if (missingPortfolio > 0) {
      warnings.push(`${missingPortfolio} Teilleistung(en) ohne Note`);
    }

    rows.push({
      key,
      student: stored,
      inHis: false,
      attended: true,
      hasPoints:
        totalPoints != null ||
        calculatedGrade != null ||
        gradeOverride != null,
      totalPoints,
      percent:
        totalPoints != null && gradeSchema.maxPoints > 0
          ? totalPoints / gradeSchema.maxPoints
          : null,
      calculatedGrade,
      finalGrade,
      status: deriveStudentStatus({
        inHis: false,
        attended: true,
        hasPoints:
          totalPoints != null ||
          calculatedGrade != null ||
          gradeOverride != null,
        finalGrade,
        hasGradeOverride: gradeOverride != null,
        hasOpenGrading: missingCriteria > 0 || missingPortfolio > 0,
        skipNoShow: true,
      }),
      warnings,
      subAreaPoints,
      gradeOverride,
      comment: pointsRec?.comment,
      attempt: stored.attempt ?? null,
      orderIndex: 30_000 + rows.length,
      multiProgram: false,
      attendanceWithoutHis: false,
      ...gradeExtras(
        totalPoints,
        finalGrade,
        gradeSchema,
        project,
        gradeOverride
      ),
    });
  }

  return rows;
}

/** Für Szenario-Vergleich: Zeilen mit Schema eines bestimmten Szenarios */
export function buildEnrichedRowsForSchema(
  project: ExamProject,
  schema: GradeSchema
): EnrichedStudentRow[] {
  const single: ExamProject = {
    ...project,
    gradeSchema: schema,
    gradeScenarios: [
      {
        id: "temp",
        name: "temp",
        passThreshold: schema.passThreshold,
        editable: false,
        schema,
      },
    ],
    activeScenarioId: "temp",
  };
  return buildEnrichedRows(single);
}
