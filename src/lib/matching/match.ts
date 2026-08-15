import { calculateGrade } from "@/lib/grades/schema";
import { computeEffectiveTotal } from "@/lib/grades/points-total";
import {
  getAdjacentGermanGradeInfo,
  getNextGradeInfo,
  gradePointsBelowPass,
  isFailedGrade,
  pointsBelowPass,
} from "@/lib/grades/next-grade";
import { ensureScenarios, getActiveScenario } from "@/lib/grades/scenarios";
import {
  computeStaFinalGrade,
  countMissingCriteria,
} from "@/lib/grades/sta-criteria";
import {
  computePortfolioComponentDetails,
  computePortfolioCriterionPointTotals,
  computePortfolioFulfillment,
  computePortfolioGradeForProject,
  computePortfolioRawAverageForProject,
  computePortfolioScenarioGrade,
  countMissingPortfolioCells,
  effectivePortfolioGrades,
  portfolioUsesGradeScenarios,
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
    return computePortfolioGradeForProject(project, pointsRec, {
      groupId,
      schema: gradeSchema,
    });
  }
  if (isStaCriteriaExam(project.examType) && (project.criteria?.length ?? 0) > 0) {
    return computeStaFinalGrade(
      pointsRec?.criterionValues,
      project.criteria ?? [],
      gradeSchema
    );
  }
  if (totalPoints != null) {
    return calculateGrade(totalPoints, gradeSchema);
  }
  return null;
}

function scenarioGradesForPoints(
  project: ExamProject,
  totalPoints: number | null,
  gradeOverride: number | null,
  groupId?: string | null,
  pointsRec?: PointsRecord
): EnrichedStudentRow["scenarioGrades"] {
  const scenarios = ensureScenarios(project).filter(
    (sc) => !sc.editable || sc.enabled === true
  );
  if (isPortfolioExam(project.examType)) {
    if (gradeOverride != null) {
      return scenarios.map((sc) => ({
        scenarioId: sc.id,
        name: sc.name,
        grade: gradeOverride,
      }));
    }
    // Vergleichsnoten: bei points/percent über jeweiligen Szenario-Schlüssel
    if (portfolioUsesGradeScenarios(project)) {
      return scenarios.map((sc) => ({
        scenarioId: sc.id,
        name: sc.name,
        grade: computePortfolioScenarioGrade(
          project,
          pointsRec,
          sc.schema,
          groupId
        ),
      }));
    }
    const g = computePortfolioGradeForProject(project, pointsRec, {
      groupId,
    });
    return scenarios.map((sc) => ({
      scenarioId: sc.id,
      name: sc.name,
      grade: g,
    }));
  }
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
  gradeOverride: number | null,
  opts?: {
    portfolioRawAverage?: number | null;
    groupId?: string | null;
    pointsRec?: PointsRecord;
    /** Schema-Skala (unit×schema.max) für next-grade; kann von Anzeige-totalPoints abweichen */
    schemaPoints?: number | null;
  }
) {
  if (isPortfolioExam(project.examType)) {
    const raw = opts?.portfolioRawAverage ?? null;
    const usesScenarios = portfolioUsesGradeScenarios(project);
    const schemaPts =
      opts?.schemaPoints != null ? opts.schemaPoints : totalPoints;
    if (usesScenarios && schemaPts != null) {
      const next = getNextGradeInfo(schemaPts, schema);
      return {
        pointsToNext: next.pointsNeeded,
        nextGrade: next.nextGrade,
        nextGradeDirection: "better" as const,
        nextGradeUnit: "points" as const,
        isFailed: finalGrade != null && isFailedGrade(finalGrade),
        pointsBelowPass: pointsBelowPass(schemaPts, schema),
        scenarioGrades: scenarioGradesForPoints(
          project,
          schemaPts,
          gradeOverride,
          opts?.groupId,
          opts?.pointsRec
        ),
      };
    }
    const next =
      raw != null
        ? getAdjacentGermanGradeInfo(raw)
        : {
            currentGrade: 5,
            nextGrade: null as number | null,
            pointsNeeded: null as number | null,
            thresholdForNext: null as number | null,
            direction: null as "better" | "worse" | null,
          };
    return {
      pointsToNext: raw != null ? next.pointsNeeded : null,
      nextGrade: raw != null ? next.nextGrade : null,
      nextGradeDirection: raw != null ? next.direction : null,
      nextGradeUnit: "grade" as const,
      isFailed: finalGrade != null && isFailedGrade(finalGrade),
      pointsBelowPass:
        raw != null && isFailedGrade(finalGrade)
          ? gradePointsBelowPass(raw)
          : raw != null && finalGrade != null && !isFailedGrade(finalGrade)
            ? Math.min(0, gradePointsBelowPass(raw) ?? 0)
            : null,
      scenarioGrades: scenarioGradesForPoints(
        project,
        totalPoints,
        gradeOverride,
        opts?.groupId,
        opts?.pointsRec
      ),
    };
  }

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
    nextGradeDirection: totalPoints != null ? ("better" as const) : null,
    nextGradeUnit: "points" as const,
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
 * Punkte / % / Rohmittel für die Notenübersicht.
 * Portfolio: Erfüllungsäquivalent (0–100) und Unit-%; sonst Klausur-Punkte.
 */
function resolveOverviewMetrics(
  project: ExamProject,
  pointsRec: PointsRecord | undefined,
  totalOpts: { criteria?: ExamProject["criteria"]; maxPoints?: number },
  gradeSchema: GradeSchema,
  groupId?: string | null
): {
  totalPoints: number | null;
  percent: number | null;
  rawAverage: number | null;
  /** unit×schema.max für Notenschlüssel / bis nächste Note */
  schemaPoints: number | null;
} {
  if (isPortfolioExam(project.examType)) {
    const ctx = { groupId, schema: gradeSchema };
    const ful = computePortfolioFulfillment(project, pointsRec, ctx);
    const rawAverage = computePortfolioRawAverageForProject(
      project,
      pointsRec,
      ctx
    );
    const maxPoints = gradeSchema.maxPoints;
    const schemaPoints =
      ful != null && maxPoints > 0
        ? Math.round(ful.unitAvg * maxPoints * 10) / 10
        : null;
    const critPts = computePortfolioCriterionPointTotals(
      project,
      pointsRec,
      ctx
    );
    // Anzeige: echte Kriterien-Rohpunkte wenn reine Punkte-Skala; sonst unit×100
    let totalPoints: number | null = null;
    let percent: number | null = ful?.percent ?? null;
    if (critPts != null && critPts.max > 0) {
      totalPoints = critPts.raw;
      percent = critPts.raw / critPts.max;
    } else if (ful != null) {
      totalPoints =
        portfolioUsesGradeScenarios(project) && maxPoints > 0
          ? schemaPoints
          : ful.displayPoints;
    }
    return {
      totalPoints,
      percent,
      rawAverage,
      schemaPoints,
    };
  }
  const totalPoints =
    pointsRec != null ? computeEffectiveTotal(pointsRec, totalOpts) : null;
  const maxPoints = gradeSchema.maxPoints;
  return {
    totalPoints,
    percent:
      totalPoints != null && maxPoints > 0 ? totalPoints / maxPoints : null,
    rawAverage: null,
    schemaPoints: totalPoints,
  };
}

function portfolioComponentGradesForRow(
  project: ExamProject,
  pointsRec: PointsRecord | undefined,
  groupId: string | null | undefined,
  schema: GradeSchema
): Record<string, number | null> | undefined {
  if (!isPortfolioExam(project.examType)) return undefined;
  if (!(project.portfolioComponents?.length)) return undefined;
  return effectivePortfolioGrades(project, pointsRec, { groupId, schema });
}

function portfolioComponentDetailsForRow(
  project: ExamProject,
  pointsRec: PointsRecord | undefined,
  groupId: string | null | undefined,
  schema: GradeSchema
) {
  if (!isPortfolioExam(project.examType)) return undefined;
  if (!(project.portfolioComponents?.length)) return undefined;
  return computePortfolioComponentDetails(
    project,
    pointsRec,
    groupId,
    (raw) => {
      const adj = getAdjacentGermanGradeInfo(raw);
      return {
        pointsNeeded: adj.pointsNeeded,
        nextGrade: adj.nextGrade,
        direction: adj.direction,
      };
    },
    schema
  );
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

    const {
      totalPoints,
      percent,
      rawAverage: portfolioRaw,
      schemaPoints,
    } = resolveOverviewMetrics(
      project,
      pointsRec,
      totalOpts,
      gradeSchema,
      student.groupId
    );
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
    const notAttended = pointsRec?.notAttended === true;
    const missingCriteria =
      !notAttended &&
      isStaCriteriaExam(project.examType) &&
      project.criteria?.length
        ? countMissingCriteria(pointsRec?.criterionValues, project.criteria)
        : 0;
    const missingPortfolio =
      !notAttended &&
      isPortfolioExam(project.examType) &&
      (project.portfolioComponents?.length ?? 0) > 0
        ? countMissingPortfolioCells(project, pointsRec, {
            groupId: student.groupId,
          })
        : 0;
    const hasOpenGrading =
      !notAttended &&
      (needsGradingCount > 0 || missingCriteria > 0 || missingPortfolio > 0);
    // Punkte retten Antritt (z. B. Moodle-Antritt fehlt, THE aber geschrieben)
    if (hasPoints && attended !== true && !notAttended) {
      attended = true;
    }
    // StA / Portfolio: standardmäßig als angetreten; manuell „nicht angetreten“ ausnehmen
    const effectiveAttended = notAttended
      ? false
      : isHisManualAssessmentExam(project.examType)
        ? true
        : attended;

    const status = deriveStudentStatus({
      inHis: true,
      attended: effectiveAttended,
      hasPoints: notAttended ? false : hasPoints,
      finalGrade: notAttended ? null : finalGrade,
      hasGradeOverride: gradeOverride != null,
      hasOpenGrading,
      skipNoShow: isHisManualAssessmentExam(project.examType),
      notAttended,
    });

    const warnings: string[] = [];
    if (notAttended) {
      warnings.push("Als nicht angetreten markiert – keine Teilnoten nötig");
    }
    if (
      !isPortfolioExam(project.examType) &&
      totalPoints != null &&
      totalPoints > gradeSchema.maxPoints
    ) {
      warnings.push("Punkte über Maximum");
    }
    if (
      !isPortfolioExam(project.examType) &&
      totalPoints != null &&
      totalPoints < 0
    ) {
      warnings.push("Negative Punkte");
    }
    if (!notAttended && effectiveAttended === true && !hasPoints) {
      warnings.push(
        isPortfolioExam(project.examType)
          ? "Teilnoten unvollständig"
          : "Angetreten, aber keine Punkte"
      );
    }
    if (gradeOverride != null) {
      warnings.push("Note manuell überschrieben");
    }
    if (needsGradingCount > 0 && !notAttended) {
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
      hasPoints: notAttended ? false : hasPoints,
      totalPoints: notAttended ? null : totalPoints,
      percent: notAttended ? null : percent,
      calculatedGrade: notAttended ? null : calculatedGrade,
      finalGrade: notAttended ? null : finalGrade,
      status,
      warnings,
      subAreaPoints,
      gradeOverride: notAttended ? null : gradeOverride,
      comment: pointsRec?.comment,
      attempt: student.attempt ?? null,
      orderIndex: rows.length,
      hisSourceId: his.sourceId,
      programCode: src?.programCode,
      examNumber: his.examNumber || src?.examNumber,
      mergedFromMatriculation: mergedFrom?.[0],
      multiProgram,
      attendanceWithoutHis: false,
      needsGradingCount: notAttended ? 0 : needsGradingCount,
      portfolioComponentGrades: portfolioComponentGradesForRow(
        project,
        pointsRec,
        student.groupId,
        gradeSchema
      ),
      portfolioComponentDetails: portfolioComponentDetailsForRow(
        project,
        pointsRec,
        student.groupId,
        gradeSchema
      ),
      ...gradeExtras(
        totalPoints,
        finalGrade,
        gradeSchema,
        project,
        gradeOverride,
        {
          portfolioRawAverage: portfolioRaw,
          groupId: student.groupId,
          pointsRec,
          schemaPoints,
        }
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
    const {
      totalPoints,
      percent,
      rawAverage: portfolioRaw,
      schemaPoints,
    } = resolveOverviewMetrics(
      project,
      pointsRec,
      totalOpts,
      gradeSchema,
      student.groupId
    );
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
      percent,
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
      portfolioComponentGrades: portfolioComponentGradesForRow(
        project,
        pointsRec,
        student.groupId,
        gradeSchema
      ),
      portfolioComponentDetails: portfolioComponentDetailsForRow(
        project,
        pointsRec,
        student.groupId,
        gradeSchema
      ),
      ...gradeExtras(
        totalPoints,
        finalGrade,
        gradeSchema,
        project,
        gradeOverride,
        {
          portfolioRawAverage: portfolioRaw,
          groupId: student.groupId,
          pointsRec,
          schemaPoints,
        }
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
    const {
      totalPoints,
      percent,
      rawAverage: portfolioRaw,
      schemaPoints,
    } = resolveOverviewMetrics(
      project,
      pointsRec,
      totalOpts,
      gradeSchema,
      student.groupId
    );
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
      percent,
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
      portfolioComponentGrades: portfolioComponentGradesForRow(
        project,
        pointsRec,
        student.groupId,
        gradeSchema
      ),
      portfolioComponentDetails: portfolioComponentDetailsForRow(
        project,
        pointsRec,
        student.groupId,
        gradeSchema
      ),
      ...gradeExtras(
        totalPoints,
        finalGrade,
        gradeSchema,
        project,
        gradeOverride,
        {
          portfolioRawAverage: portfolioRaw,
          groupId: student.groupId,
          pointsRec,
          schemaPoints,
        }
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
    const {
      totalPoints,
      percent,
      rawAverage: portfolioRaw,
      schemaPoints,
    } = resolveOverviewMetrics(
      project,
      pointsRec,
      totalOpts,
      gradeSchema,
      stored.groupId
    );
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
    const notAttended = pointsRec?.notAttended === true;
    const missingCriteria =
      !notAttended &&
      isStaCriteriaExam(project.examType) &&
      project.criteria?.length
        ? countMissingCriteria(pointsRec?.criterionValues, project.criteria)
        : 0;
    const missingPortfolio =
      !notAttended &&
      isPortfolioExam(project.examType) &&
      (project.portfolioComponents?.length ?? 0) > 0
        ? countMissingPortfolioCells(project, pointsRec, {
            groupId: stored.groupId,
          })
        : 0;
    const warnings = ["Manuell hinzugefügt – nicht in HISinOne-Masterliste"];
    if (notAttended) {
      warnings.push("Als nicht angetreten markiert");
    }
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
      attended: notAttended ? false : true,
      hasPoints: notAttended
        ? false
        : totalPoints != null ||
          calculatedGrade != null ||
          gradeOverride != null,
      totalPoints: notAttended ? null : totalPoints,
      percent: notAttended ? null : percent,
      calculatedGrade: notAttended ? null : calculatedGrade,
      finalGrade: notAttended ? null : finalGrade,
      status: deriveStudentStatus({
        inHis: false,
        attended: notAttended ? false : true,
        hasPoints: notAttended
          ? false
          : totalPoints != null ||
            calculatedGrade != null ||
            gradeOverride != null,
        finalGrade: notAttended ? null : finalGrade,
        hasGradeOverride: gradeOverride != null,
        hasOpenGrading:
          !notAttended && (missingCriteria > 0 || missingPortfolio > 0),
        skipNoShow: true,
        notAttended,
      }),
      warnings,
      subAreaPoints,
      gradeOverride,
      comment: pointsRec?.comment,
      attempt: stored.attempt ?? null,
      orderIndex: 30_000 + rows.length,
      multiProgram: false,
      attendanceWithoutHis: false,
      portfolioComponentGrades: portfolioComponentGradesForRow(
        project,
        pointsRec,
        stored.groupId,
        gradeSchema
      ),
      portfolioComponentDetails: portfolioComponentDetailsForRow(
        project,
        pointsRec,
        stored.groupId,
        gradeSchema
      ),
      ...gradeExtras(
        totalPoints,
        finalGrade,
        gradeSchema,
        project,
        gradeOverride,
        {
          portfolioRawAverage: portfolioRaw,
          groupId: stored.groupId,
          pointsRec,
          schemaPoints,
        }
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
