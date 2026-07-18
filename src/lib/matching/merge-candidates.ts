import { buildEnrichedRows } from "@/lib/matching/match";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { nameKey } from "@/lib/matching/identity";
import type { EnrichedStudentRow, ExamProject } from "@/lib/types";

export interface MatMergeCandidate {
  orphanKey: string;
  hisKey: string;
  score: number;
  reasons: string[];
  orphan: EnrichedStudentRow;
  his: EnrichedStudentRow;
}

function normalizeNamePart(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function namesSimilar(
  aLast: string,
  aFirst: string,
  bLast: string,
  bFirst: string
): { exact: boolean; close: boolean } {
  const al = normalizeNamePart(aLast);
  const af = normalizeNamePart(aFirst);
  const bl = normalizeNamePart(bLast);
  const bf = normalizeNamePart(bFirst);
  if (!al || !bl) return { exact: false, close: false };
  if (al === bl && af === bf) return { exact: true, close: true };
  if (al === bl && (af.startsWith(bf) || bf.startsWith(af) || !af || !bf)) {
    return { exact: false, close: true };
  }
  // Levenshtein light for last name length ≥ 4
  if (al.length >= 4 && bl.length >= 4 && hammingOrEdit1(al, bl) <= 1) {
    return { exact: false, close: true };
  }
  return { exact: false, close: false };
}

/** Hamming if same length, else simple edit-distance capped */
function hammingOrEdit1(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === b.length) {
    let d = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
    return d;
  }
  // allow one insertion/deletion
  if (Math.abs(a.length - b.length) > 1) return 99;
  const [shorter, longer] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < shorter.length && j < longer.length) {
    if (shorter[i] === longer[j]) {
      i++;
      j++;
    } else {
      edits++;
      if (edits > 1) return edits;
      j++;
    }
  }
  edits += longer.length - j;
  return edits;
}

export function matriculationDigitDistance(a: string, b: string): number {
  const na = normalizeMatriculation(a) ?? a;
  const nb = normalizeMatriculation(b) ?? b;
  return hammingOrEdit1(na, nb);
}

/**
 * Schlägt manuelle Zusammenführungen vor (nie automatisch anwenden).
 * Typisch THE: Orphan mit Tippfehler-Matr. ↔ HIS-No-Show.
 */
export function findMergeCandidates(
  project: ExamProject,
  rows?: EnrichedStudentRow[]
): MatMergeCandidate[] {
  const all = rows ?? buildEnrichedRows(project);
  const activeSources = new Set(
    (project.identityMerges ?? [])
      .filter((m) => m.active)
      .map((m) => normalizeMatriculation(m.sourceMatriculation))
      .filter(Boolean) as string[]
  );

  const orphans = all.filter(
    (r) =>
      (!r.inHis || r.attendanceWithoutHis) &&
      (r.attended === true || r.hasPoints) &&
      !activeSources.has(r.key)
  );

  const hisTargets = all.filter(
    (r) =>
      r.inHis &&
      (r.status === "no_show" ||
        (r.attended !== true && !r.hasPoints) ||
        r.status === "registered")
  );

  const candidates: MatMergeCandidate[] = [];

  for (const orphan of orphans) {
    for (const his of hisTargets) {
      if (orphan.key === his.key) continue;

      const reasons: string[] = [];
      let score = 0;

      const name = namesSimilar(
        orphan.student.lastName,
        orphan.student.firstName,
        his.student.lastName,
        his.student.firstName
      );
      if (name.exact) {
        score += 50;
        reasons.push("Name identisch");
      } else if (name.close) {
        score += 30;
        reasons.push("Name ähnlich");
      }

      const matDist = matriculationDigitDistance(orphan.key, his.key);
      if (matDist === 1) {
        score += 45;
        reasons.push("Matrikelnummer: 1 Ziffer Unterschied");
      } else if (matDist === 2 && name.close) {
        score += 15;
        reasons.push("Matrikelnummer: 2 Stellen Unterschied");
      }

      if (orphan.hasPoints && !his.hasPoints) {
        score += 10;
        reasons.push("Punkte am Orphan, HIS ohne Punkte");
      }
      if (orphan.attended === true && his.status === "no_show") {
        score += 8;
        reasons.push("Orphan angetreten, HIS als No-Show");
      }
      if (orphan.student.email) {
        score += 2;
        reasons.push("E-Mail/Anmeldename am Orphan vorhanden");
      }

      // Mindestscore: Name-Match oder 1-Ziffer-Matr.
      if (score < 40 && !name.close && matDist !== 1) continue;
      if (score < 25) continue;

      candidates.push({
        orphanKey: orphan.key,
        hisKey: his.key,
        score,
        reasons,
        orphan,
        his,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || a.orphanKey.localeCompare(b.orphanKey));

  // pro Orphan nur beste 3 Ziele behalten
  const perOrphan = new Map<string, number>();
  const filtered: MatMergeCandidate[] = [];
  for (const c of candidates) {
    const n = perOrphan.get(c.orphanKey) ?? 0;
    if (n >= 3) continue;
    perOrphan.set(c.orphanKey, n + 1);
    filtered.push(c);
  }
  return filtered;
}

/** Orphans ohne automatischen Vorschlag (für manuelle HIS-Auswahl) */
export function listOrphansWithoutStrongCandidate(
  project: ExamProject,
  rows?: EnrichedStudentRow[]
): EnrichedStudentRow[] {
  const all = rows ?? buildEnrichedRows(project);
  const candidates = findMergeCandidates(project, all);
  const withCandidate = new Set(
    candidates.filter((c) => c.score >= 50).map((c) => c.orphanKey)
  );
  return all.filter(
    (r) =>
      (!r.inHis || r.attendanceWithoutHis) &&
      (r.attended === true || r.hasPoints) &&
      !withCandidate.has(r.key)
  );
}

export function orphanCount(project: ExamProject): number {
  const rows = buildEnrichedRows(project);
  return rows.filter(
    (r) =>
      (!r.inHis || r.attendanceWithoutHis) &&
      (r.attended === true || r.hasPoints)
  ).length;
}

// re-export for tests / UI
export { nameKey };
