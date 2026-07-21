/**
 * Moodle/THE-Import: Punkte auf 0,5-Raster aufrunden (THE / elektrP).
 * 3,2 → 3,5 · 4,5 → 4,5 · 4,0 → 4,0 · 4,8 → 5,0
 */

import type { ExamProject, PointsRecord, QuestionDef, SubArea } from "@/lib/types";
import { isOnlineStyleExam } from "@/lib/types";
import { recomputePointsRecord } from "@/lib/grades/points-total";

/** Aufrunden auf das nächste Vielfache von 0,5 */
export function roundPointsUpToHalf(n: number): number {
  if (!Number.isFinite(n)) return n;
  // leichte FP-Korrektur, damit exakte .5 / .0 stabil bleiben
  return Math.ceil(n * 2 - 1e-12) / 2;
}

export function shouldRoundMoodlePointsToHalf(
  project: Pick<ExamProject, "examType" | "roundMoodlePointsToHalf">
): boolean {
  return (
    isOnlineStyleExam(project.examType) &&
    project.roundMoodlePointsToHalf !== false
  );
}

function mapRecord(
  rec: Record<string, number | null> | undefined
): Record<string, number | null> | undefined {
  if (!rec) return rec;
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] = v == null || !Number.isFinite(v) ? v : roundPointsUpToHalf(v);
  }
  return out;
}

/**
 * Rundet importierte Punkte (byQuestion → neu summiert, sonst total/bySubArea).
 */
export function applyHalfPointRoundingToRecord(
  rec: PointsRecord,
  questionDefs: QuestionDef[],
  subAreas: SubArea[]
): PointsRecord {
  const byQuestion = mapRecord(rec.byQuestion);
  const hasQuestions =
    byQuestion && Object.keys(byQuestion).length > 0 && questionDefs.length > 0;

  if (hasQuestions) {
    return recomputePointsRecord(
      {
        ...rec,
        byQuestion,
        // total/sub aus gerundeten Fragen neu
        totalPoints: null,
      },
      questionDefs,
      subAreas
    );
  }

  return {
    ...rec,
    bySubArea: mapRecord(rec.bySubArea) ?? rec.bySubArea,
    totalPoints:
      rec.totalPoints == null || !Number.isFinite(rec.totalPoints)
        ? rec.totalPoints
        : roundPointsUpToHalf(rec.totalPoints),
    totalOverride:
      rec.totalOverride == null || !Number.isFinite(rec.totalOverride)
        ? rec.totalOverride
        : roundPointsUpToHalf(rec.totalOverride),
  };
}

export function applyHalfPointRoundingToPointsList(
  points: PointsRecord[],
  questionDefs: QuestionDef[],
  subAreas: SubArea[]
): PointsRecord[] {
  return points.map((p) =>
    applyHalfPointRoundingToRecord(p, questionDefs, subAreas)
  );
}
