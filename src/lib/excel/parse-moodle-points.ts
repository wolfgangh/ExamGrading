import {
  autoMapColumns,
  cellToNumber,
  cellToString,
  findHeaderRow,
  type LogicalField,
} from "@/lib/excel/column-detect";
import {
  buildStudentLookup,
  resolveMatriculation,
  type MatchMethod,
  type StudentLookup,
} from "@/lib/matching/identity";
import type {
  ImportLogEntry,
  PointsRecord,
  QuestionDef,
  Student,
  SubArea,
} from "@/lib/types";
import { recomputePointsRecord } from "@/lib/grades/points-total";

export interface PointsParseResult {
  records: PointsRecord[];
  students: Student[];
  log: Omit<ImportLogEntry, "at" | "fileName">;
  preview: Record<string, string>[];
  columnMap: Partial<Record<LogicalField, number>>;
  headers: string[];
  headerRowIndex: number;
  subAreaColumns: { subAreaId: string; columnIndex: number }[];
  matchStats: { method: MatchMethod; count: number }[];
  questionDefs: QuestionDef[];
}

const UNGRADED_RE =
  /bisher\s*nicht\s*bewertet|bewertung\s*notwendig|not\s*yet|no\s*grade|^-$|^–$/i;

const NEEDS_GRADING_RE = /bewertung\s*notwendig/i;

const FOOTER_RE = /gesamtdurchschnitt|durchschnitt|average|gesamt\s*$/i;

function detectSubAreaColumns(
  headers: string[],
  subAreas: SubArea[]
): { subAreaId: string; columnIndex: number }[] {
  const result: { subAreaId: string; columnIndex: number }[] = [];
  headers.forEach((h, idx) => {
    const n = h.toLowerCase();
    for (const sa of subAreas) {
      const name = sa.name.toLowerCase();
      const code = sa.code.toLowerCase();
      if (
        n.includes(`punkte ${code}`) ||
        n.includes(`punkte ${name}`) ||
        (n.includes(name) && n.includes("punkte")) ||
        n.startsWith(code + " ") ||
        n === code
      ) {
        if (!result.some((r) => r.subAreaId === sa.id)) {
          result.push({ subAreaId: sa.id, columnIndex: idx });
        }
      }
    }
  });
  return result;
}

/** Spalten „F 1 /10,00“, „F 2 /…“ → QuestionDef + Spaltenindex */
function parseQuestionHeaders(
  headers: string[],
  subAreas: SubArea[]
): { defs: QuestionDef[]; colIndex: number[] } {
  const defs: QuestionDef[] = [];
  const colIndex: number[] = [];
  const frmId =
    subAreas.find((s) => /^f$/i.test(s.code) || /frm|finanz/i.test(s.name))
      ?.id ?? subAreas[0]?.id;

  headers.forEach((h, idx) => {
    const t = h.trim();
    const m = t.match(/^(F|Frage|Aufgabe)\s*(\d+)\s*(?:\/\s*([\d.,]+))?/i);
    if (!m) return;
    const num = m[2];
    const maxRaw = m[3] ? cellToNumber(m[3].replace(",", ".")) : 0;
    const id = `f${num}`;
    defs.push({
      id,
      label: `F ${num}`,
      maxPoints: maxRaw ?? 0,
      orderIndex: defs.length,
      subAreaId: frmId,
    });
    colIndex.push(idx);
  });
  return { defs, colIndex };
}

function parsePointsCell(value: unknown): {
  points: number | null;
  needsGrading: boolean;
} {
  if (value == null || value === "") {
    return { points: null, needsGrading: false };
  }
  const s = cellToString(value);
  if (!s) return { points: null, needsGrading: false };
  if (NEEDS_GRADING_RE.test(s)) {
    return { points: null, needsGrading: true };
  }
  if (UNGRADED_RE.test(s)) {
    return { points: null, needsGrading: false };
  }
  const n = cellToNumber(value);
  return { points: n, needsGrading: false };
}

/**
 * Moodle-THE-Bewertungsexport:
 * Nachname | Vorname | Anmeldename | E-Mail | Status | … | Bewertung/90,00 | F 1 /… |
 *
 * Match zur Matrikelnummer **primär über Anmeldename** (knownStudents aus Antritt/HIS).
 */
export function parsePointsMatrix(
  matrix: unknown[][],
  subAreas: SubArea[],
  options?: {
    columnMap?: Partial<Record<LogicalField, number>>;
    headerRowIndex?: number;
    subAreaColumns?: { subAreaId: string; columnIndex: number }[];
    knownStudents?: Record<string, Student>;
  }
): PointsParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const methodCounts = new Map<MatchMethod, number>();

  let headerRowIndex = options?.headerRowIndex;
  let headers: string[] = [];
  let columnMap = options?.columnMap;

  if (headerRowIndex == null) {
    // THE: oft erste Zeile Header mit Bewertung/
    for (let i = 0; i < Math.min(10, matrix.length); i++) {
      const hs = (matrix[i] ?? []).map((c) => cellToString(c));
      const joined = hs.join(" ").toLowerCase();
      if (
        (joined.includes("nachname") || joined.includes("anmeldename")) &&
        (joined.includes("bewertung") || /f\s*1\s*\//i.test(joined))
      ) {
        headerRowIndex = i;
        headers = hs;
        columnMap = autoMapColumns(headers);
        break;
      }
    }
    if (headerRowIndex == null) {
      const found = findHeaderRow(matrix);
      if (found) {
        headerRowIndex = found.headerRowIndex;
        headers = found.headers;
        columnMap = columnMap ?? autoMapColumns(headers);
      }
    }
  } else {
    headers = (matrix[headerRowIndex] ?? []).map((c) => cellToString(c));
    columnMap = columnMap ?? autoMapColumns(headers);
  }

  const hasIdentity =
    columnMap?.matriculation != null ||
    columnMap?.login != null ||
    columnMap?.email != null ||
    (columnMap?.lastName != null && columnMap?.firstName != null);

  const map = columnMap ?? {};

  if (headerRowIndex == null || !hasIdentity) {
    errors.push(
      "THE-Header nicht erkannt. Erwartet: Nachname, Vorname, Anmeldename, E-Mail-Adresse, Bewertung/…"
    );
    return emptyResult(errors, warnings, map, headers, 0);
  }

  if (map.matriculation == null && map.login == null) {
    warnings.push(
      "Keine Matrikelnummer-Spalte – Match erfolgt über Anmeldename (bitte Antritt vorher importieren)."
    );
  }

  const matIdx = map.matriculation;
  const lastIdx = map.lastName;
  const firstIdx = map.firstName;
  const totalIdx = map.totalPoints;
  const attemptIdx = map.attempt;
  const loginIdx = map.login;
  const emailIdx = map.email;

  // Explizit Bewertung/ finden
  let resolvedTotalIdx = totalIdx;
  if (resolvedTotalIdx == null) {
    const moodle = headers.findIndex((h) =>
      /bewertung\s*\//i.test(h)
    );
    if (moodle >= 0) resolvedTotalIdx = moodle;
  }

  const subAreaColumns =
    options?.subAreaColumns ?? detectSubAreaColumns(headers, subAreas);
  const { defs: questionDefs, colIndex: questionCols } = parseQuestionHeaders(
    headers,
    subAreas
  );

  const lookup: StudentLookup = buildStudentLookup(
    options?.knownStudents ?? {}
  );

  const records: PointsRecord[] = [];
  const students: Student[] = [];
  const seen = new Set<string>();
  let unmatched = 0;
  let skippedUngraded = 0;
  let openGradingRows = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const lastName = lastIdx != null ? cellToString(row[lastIdx]) : "";
    const firstName = firstIdx != null ? cellToString(row[firstIdx]) : "";
    const login = loginIdx != null ? cellToString(row[loginIdx]) : "";
    const email = emailIdx != null ? cellToString(row[emailIdx]) : "";

    // Footer
    if (FOOTER_RE.test(lastName) || FOOTER_RE.test(firstName) || FOOTER_RE.test(login)) {
      continue;
    }
    if (!lastName && !firstName && !login && !email) {
      const any = row.some((c) => cellToString(c));
      if (!any) continue;
    }

    const { mat, method } = resolveMatriculation({
      matriculationRaw: matIdx != null ? row[matIdx] : null,
      login,
      email,
      lastName,
      firstName,
      lookup,
    });

    if (!mat) {
      unmatched++;
      warnings.push(
        `Zeile ${r + 1}: kein Match über Anmeldename (${login || "–"}) – ${lastName}, ${firstName}`
      );
      continue;
    }

    if (seen.has(mat)) {
      warnings.push(`Doppelte Zuordnung Matr. ${mat} (Zeile ${r + 1})`);
      continue;
    }
    seen.add(mat);
    methodCounts.set(method, (methodCounts.get(method) ?? 0) + 1);

    const bySubArea: Record<string, number | null> = {};
    for (const sa of subAreas) {
      bySubArea[sa.id] = null;
    }
    for (const sc of subAreaColumns) {
      bySubArea[sc.subAreaId] = parsePointsCell(row[sc.columnIndex]).points;
    }

    const byQuestion: Record<string, number | null> = {};
    const needsGrading: string[] = [];
    questionDefs.forEach((qd, i) => {
      const col = questionCols[i];
      const { points, needsGrading: ng } = parsePointsCell(row[col]);
      byQuestion[qd.id] = points;
      if (ng) needsGrading.push(qd.id);
    });

    const importTotal =
      resolvedTotalIdx != null
        ? parsePointsCell(row[resolvedTotalIdx]).points
        : null;

    let rec: PointsRecord = {
      matriculationNumber: mat,
      bySubArea,
      byQuestion: Object.keys(byQuestion).length ? byQuestion : undefined,
      needsGrading: needsGrading.length ? needsGrading : undefined,
      totalPoints: importTotal,
      source: "moodle",
    };

    if (Object.keys(byQuestion).length > 0) {
      rec = recomputePointsRecord(rec, questionDefs, subAreas);
    } else if (importTotal == null) {
      const parts = Object.values(bySubArea).filter(
        (v): v is number => v != null
      );
      if (parts.length > 0) {
        rec.totalPoints = parts.reduce((a, b) => a + b, 0);
      }
    }

    const hasAny =
      rec.totalPoints != null ||
      Object.values(rec.bySubArea).some((v) => v != null) ||
      (rec.byQuestion &&
        Object.values(rec.byQuestion).some((v) => v != null)) ||
      (rec.needsGrading && rec.needsGrading.length > 0);

    if (!hasAny) {
      skippedUngraded++;
      continue;
    }
    if (rec.needsGrading?.length) openGradingRows++;

    records.push(rec);

    const attempt =
      attemptIdx != null ? cellToNumber(row[attemptIdx]) : null;

    students.push({
      matriculationNumber: mat,
      lastName,
      firstName,
      email: email || login || undefined,
      attempt: attempt != null ? Math.round(attempt) : null,
    });
  }

  if (skippedUngraded > 0) {
    warnings.push(
      `${skippedUngraded} Zeile(n) ohne Bewertung (z. B. „Bisher nicht bewertet“) übersprungen.`
    );
  }
  if (openGradingRows > 0) {
    warnings.push(
      `${openGradingRows} Person(en) mit Aufgaben „Bewertung notwendig“ – in der Detailansicht nachtragen.`
    );
  }
  if (questionDefs.length > 0) {
    warnings.unshift(`${questionDefs.length} Aufgaben-Spalten erkannt.`);
  }
  if (unmatched > 0) {
    warnings.unshift(
      `${unmatched} Zeile(n) ohne Anmeldename-Match – Antritt/HIS zuerst importieren oder Logins prüfen.`
    );
  }

  const matchStats = [...methodCounts.entries()].map(([method, count]) => ({
    method,
    count,
  }));

  return {
    records,
    students,
    log: {
      type: "points",
      rowCount: records.length,
      matched: records.length,
      unmatched,
      warnings,
      errors,
    },
    preview: records.slice(0, 5).map((rec, i) => ({
      Matrikelnummer: rec.matriculationNumber,
      Nachname: students[i]?.lastName ?? "",
      Vorname: students[i]?.firstName ?? "",
      Anmeldename: students[i]?.email ?? "",
      Gesamtpunkte:
        rec.totalPoints != null ? String(rec.totalPoints).replace(".", ",") : "",
      Offen: rec.needsGrading?.length
        ? `${rec.needsGrading.length} Aufg.`
        : "–",
      Match:
        matchStats.find((m) => m.method === "login")
          ? "Anmeldename"
          : matchStats[0]?.method ?? "",
    })),
    columnMap: {
      ...map,
      totalPoints: resolvedTotalIdx,
    },
    headers,
    headerRowIndex,
    subAreaColumns,
    matchStats,
    questionDefs,
  };
}

function emptyResult(
  errors: string[],
  warnings: string[],
  columnMap: Partial<Record<LogicalField, number>>,
  headers: string[],
  headerRowIndex: number
): PointsParseResult {
  return {
    records: [],
    students: [],
    log: {
      type: "points",
      rowCount: 0,
      matched: 0,
      unmatched: 0,
      warnings,
      errors,
    },
    preview: [],
    columnMap,
    headers,
    headerRowIndex,
    subAreaColumns: [],
    matchStats: [],
    questionDefs: [],
  };
}
