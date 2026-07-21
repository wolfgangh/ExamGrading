/**
 * Moodle/THE-Import: Punkte auf 0,5- oder 0,25-Raster aufrunden (THE / elektrP).
 *
 * 0,5:  3,2 → 3,5 · 4,8 → 5,0
 * 0,25: 3,1 → 3,25 · 3,2 → 3,25 · 4,8 → 5,0
 */

import type {
  ExamProject,
  MoodlePointsRoundStep,
  PointsRecord,
  QuestionDef,
  SubArea,
} from "@/lib/types";
import { isOnlineStyleExam } from "@/lib/types";
import { recomputePointsRecord } from "@/lib/grades/points-total";

export const MOODLE_ROUND_STEP_OPTIONS: {
  value: MoodlePointsRoundStep;
  label: string;
  example: string;
}[] = [
  {
    value: 0.5,
    label: "Aufrunden auf 0,5",
    example: "3,2 → 3,5 · 4,1 → 4,5 · 4,8 → 5,0",
  },
  {
    value: 0.25,
    label: "Aufrunden auf 0,25",
    example: "3,1 → 3,25 · 3,2 → 3,25 · 4,8 → 5,0",
  },
  {
    value: "none",
    label: "Keine Rundung",
    example: "Importwerte unverändert (z. B. 3,2 bleibt 3,2)",
  },
];

/** Default für neue THE/elektrP-Prüfungen */
export const DEFAULT_MOODLE_ROUND_STEP: MoodlePointsRoundStep = 0.5;

export function isMoodleRoundStepActive(
  step: MoodlePointsRoundStep | undefined | null
): step is 0.25 | 0.5 {
  return step === 0.25 || step === 0.5;
}

/**
 * Wirksames Raster für den Import.
 * Legacy: roundMoodlePointsToHalf false → none, sonst (undefined/true) → 0,5.
 */
export function getMoodlePointsRoundStep(
  project: Pick<
    ExamProject,
    "examType" | "moodlePointsRoundStep" | "roundMoodlePointsToHalf"
  >
): MoodlePointsRoundStep {
  if (!isOnlineStyleExam(project.examType)) return "none";
  if (
    project.moodlePointsRoundStep === "none" ||
    project.moodlePointsRoundStep === 0.25 ||
    project.moodlePointsRoundStep === 0.5
  ) {
    return project.moodlePointsRoundStep;
  }
  // Legacy-Boolean
  if (project.roundMoodlePointsToHalf === false) return "none";
  return DEFAULT_MOODLE_ROUND_STEP;
}

/** @deprecated nutze getMoodlePointsRoundStep / isMoodleRoundStepActive */
export function shouldRoundMoodlePointsToHalf(
  project: Pick<
    ExamProject,
    "examType" | "moodlePointsRoundStep" | "roundMoodlePointsToHalf"
  >
): boolean {
  return isMoodleRoundStepActive(getMoodlePointsRoundStep(project));
}

/** Aufrunden auf Vielfache von `step` (0,25 oder 0,5) */
export function roundPointsUpToStep(n: number, step: 0.25 | 0.5): number {
  if (!Number.isFinite(n) || step <= 0) return n;
  const inv = 1 / step;
  return Math.ceil(n * inv - 1e-12) / inv;
}

/** @deprecated */
export function roundPointsUpToHalf(n: number): number {
  return roundPointsUpToStep(n, 0.5);
}

function mapRecord(
  rec: Record<string, number | null> | undefined,
  step: 0.25 | 0.5
): Record<string, number | null> | undefined {
  if (!rec) return rec;
  const out: Record<string, number | null> = {};
  for (const [k, v] of Object.entries(rec)) {
    out[k] =
      v == null || !Number.isFinite(v) ? v : roundPointsUpToStep(v, step);
  }
  return out;
}

/**
 * Rundet importierte Punkte (byQuestion → neu summiert, sonst total/bySubArea).
 */
export function applyMoodlePointRoundingToRecord(
  rec: PointsRecord,
  questionDefs: QuestionDef[],
  subAreas: SubArea[],
  step: 0.25 | 0.5
): PointsRecord {
  const byQuestion = mapRecord(rec.byQuestion, step);
  const hasQuestions =
    byQuestion && Object.keys(byQuestion).length > 0 && questionDefs.length > 0;

  if (hasQuestions) {
    return recomputePointsRecord(
      {
        ...rec,
        byQuestion,
        totalPoints: null,
      },
      questionDefs,
      subAreas
    );
  }

  return {
    ...rec,
    bySubArea: mapRecord(rec.bySubArea, step) ?? rec.bySubArea,
    totalPoints:
      rec.totalPoints == null || !Number.isFinite(rec.totalPoints)
        ? rec.totalPoints
        : roundPointsUpToStep(rec.totalPoints, step),
    totalOverride:
      rec.totalOverride == null || !Number.isFinite(rec.totalOverride)
        ? rec.totalOverride
        : roundPointsUpToStep(rec.totalOverride, step),
  };
}

/** @deprecated Alias */
export function applyHalfPointRoundingToRecord(
  rec: PointsRecord,
  questionDefs: QuestionDef[],
  subAreas: SubArea[],
  step: 0.25 | 0.5 = 0.5
): PointsRecord {
  return applyMoodlePointRoundingToRecord(rec, questionDefs, subAreas, step);
}

export function applyMoodlePointRoundingToPointsList(
  points: PointsRecord[],
  questionDefs: QuestionDef[],
  subAreas: SubArea[],
  step: 0.25 | 0.5
): PointsRecord[] {
  return points.map((p) =>
    applyMoodlePointRoundingToRecord(p, questionDefs, subAreas, step)
  );
}

/** @deprecated */
export function applyHalfPointRoundingToPointsList(
  points: PointsRecord[],
  questionDefs: QuestionDef[],
  subAreas: SubArea[],
  step: 0.25 | 0.5 = 0.5
): PointsRecord[] {
  return applyMoodlePointRoundingToPointsList(
    points,
    questionDefs,
    subAreas,
    step
  );
}

export function moodleRoundStepLabel(step: MoodlePointsRoundStep): string {
  return (
    MOODLE_ROUND_STEP_OPTIONS.find((o) => o.value === step)?.label ??
    String(step)
  );
}

export function moodleRoundStepExample(step: MoodlePointsRoundStep): string {
  return (
    MOODLE_ROUND_STEP_OPTIONS.find((o) => o.value === step)?.example ?? ""
  );
}

/** Kurzer Import-Hinweis */
export function moodleRoundImportWarning(step: MoodlePointsRoundStep): string | null {
  if (step === 0.5) {
    return "Punkte werden auf 0,5 aufgerundet (z. B. 3,2→3,5). Unter Einstellungen änderbar.";
  }
  if (step === 0.25) {
    return "Punkte werden auf 0,25 aufgerundet (z. B. 3,1→3,25). Unter Einstellungen änderbar.";
  }
  return null;
}
