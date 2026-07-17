import type { PointsRecord, QuestionDef, SubArea } from "@/lib/types";
import { sumSubAreaPoints } from "@/lib/grades/schema";

/** Summe der Detailaufgaben (null-Werte = 0 für Summe, aber hasAny prüft separat) */
export function sumQuestionPoints(
  byQuestion: Record<string, number | null | undefined> | undefined
): number | null {
  if (!byQuestion) return null;
  const vals = Object.values(byQuestion).filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (vals.length === 0) {
    // alle null, aber Keys vorhanden → 0 Punkte vergeben vs. unbewertet
    const keys = Object.keys(byQuestion);
    if (keys.length === 0) return null;
    return 0;
  }
  return Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100;
}

/**
 * Effektive Gesamtpunkte:
 * 1) Summe byQuestion (wenn vorhanden)
 * 2) Summe Teilgebiete
 * 3) totalPoints / totalOverride (Legacy)
 */
export function computeEffectiveTotal(rec: PointsRecord | null | undefined): number | null {
  if (!rec) return null;
  if (rec.byQuestion && Object.keys(rec.byQuestion).length > 0) {
    const q = sumQuestionPoints(rec.byQuestion);
    if (q != null) return q;
  }
  const sub = sumSubAreaPoints(rec.bySubArea);
  if (sub != null) return sub;
  if (rec.totalOverride != null && Number.isFinite(rec.totalOverride)) {
    return rec.totalOverride;
  }
  if (rec.totalPoints != null && Number.isFinite(rec.totalPoints)) {
    return rec.totalPoints;
  }
  return null;
}

/** Teilgebiet-Summen aus Fragen ableiten (F-Aufgaben → Code F / FRM) */
export function recomputeSubAreasFromQuestions(
  byQuestion: Record<string, number | null>,
  questionDefs: QuestionDef[],
  subAreas: SubArea[]
): Record<string, number | null> {
  const bySub: Record<string, number | null> = {};
  for (const sa of subAreas) bySub[sa.id] = null;

  for (const q of questionDefs) {
    const pts = byQuestion[q.id];
    if (pts == null || !Number.isFinite(pts)) continue;
    const saId =
      q.subAreaId ??
      subAreas.find((s) => /^f$/i.test(s.code) || /frm|finanz/i.test(s.name))
        ?.id ??
      subAreas[0]?.id;
    if (!saId) continue;
    bySub[saId] = (bySub[saId] ?? 0) + pts;
  }

  for (const id of Object.keys(bySub)) {
    if (bySub[id] != null) {
      bySub[id] = Math.round((bySub[id] as number) * 100) / 100;
    }
  }
  return bySub;
}

export function recomputePointsRecord(
  rec: PointsRecord,
  questionDefs: QuestionDef[],
  subAreas: SubArea[]
): PointsRecord {
  const byQuestion = rec.byQuestion ?? {};
  const needsGrading = (rec.needsGrading ?? []).filter((id) => {
    const v = byQuestion[id];
    return v == null || !Number.isFinite(v);
  });

  let bySubArea = rec.bySubArea;
  if (Object.keys(byQuestion).length > 0 && questionDefs.length > 0) {
    bySubArea = recomputeSubAreasFromQuestions(
      byQuestion,
      questionDefs,
      subAreas
    );
  }

  const totalPoints = computeEffectiveTotal({
    ...rec,
    byQuestion,
    bySubArea,
    totalOverride: undefined,
  });

  return {
    ...rec,
    byQuestion,
    bySubArea,
    totalPoints,
    needsGrading: needsGrading.length ? needsGrading : undefined,
    totalOverride: undefined,
  };
}
