import { buildEnrichedRows } from "@/lib/matching/match";
import { findMergeCandidates } from "@/lib/matching/merge-candidates";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { isOnlineStyleExam } from "@/lib/types";
import type { EnrichedStudentRow, ExamProject } from "@/lib/types";

export function isOrphanRow(r: EnrichedStudentRow): boolean {
  return (
    (!r.inHis || r.attendanceWithoutHis === true) &&
    (r.attended === true || r.hasPoints)
  );
}

export function listOrphanRows(
  project: ExamProject,
  rows?: EnrichedStudentRow[]
): EnrichedStudentRow[] {
  const all = rows ?? buildEnrichedRows(project);
  return all.filter(isOrphanRow);
}

function resolvedSourceMats(project: ExamProject): Set<string> {
  const set = new Set<string>();
  for (const m of project.identityMerges ?? []) {
    if (!m.active) continue;
    const s = normalizeMatriculation(m.sourceMatriculation);
    if (s) set.add(s);
  }
  for (const d of project.identityDismissals ?? []) {
    if (!d.active) continue;
    const s = normalizeMatriculation(d.sourceMatriculation);
    if (s) set.add(s);
  }
  return set;
}

/** Orphans ohne Merge und ohne Ablehnung */
export function listUnresolvedOrphans(
  project: ExamProject,
  rows?: EnrichedStudentRow[]
): EnrichedStudentRow[] {
  if (!isOnlineStyleExam(project.examType)) return [];
  const resolved = resolvedSourceMats(project);
  return listOrphanRows(project, rows).filter((r) => !resolved.has(r.key));
}

export function hasUnresolvedOrphans(
  project: ExamProject,
  rows?: EnrichedStudentRow[]
): boolean {
  return listUnresolvedOrphans(project, rows).length > 0;
}

export function unresolvedOrphanSummary(
  project: ExamProject,
  rows?: EnrichedStudentRow[]
): string {
  const list = listUnresolvedOrphans(project, rows);
  if (list.length === 0) return "Alle Matrikel-Sonderfälle geprüft";
  return `${list.length} Antritt/Punkte ohne HISinOne noch ungeprüft – bitte unter Zuordnung zusammenführen oder ablehnen`;
}

/**
 * Ungeprüfte Orphans ohne automatischen Merge-Vorschlag
 * (kein Eintrag in findMergeCandidates).
 */
export function listUnresolvedOrphansWithoutSuggestion(
  project: ExamProject,
  rows?: EnrichedStudentRow[]
): EnrichedStudentRow[] {
  const unresolved = listUnresolvedOrphans(project, rows);
  if (unresolved.length === 0) return [];
  const all = rows ?? buildEnrichedRows(project);
  const withSuggestion = new Set(
    findMergeCandidates(project, all).map((c) => c.orphanKey)
  );
  return unresolved.filter((r) => !withSuggestion.has(r.key));
}
