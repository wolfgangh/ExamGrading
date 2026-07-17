import {
  autoMapColumns,
  cellToNumber,
  cellToString,
  findHeaderRow,
  type LogicalField,
} from "@/lib/excel/column-detect";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type {
  ImportLogEntry,
  PointsRecord,
  Student,
  SubArea,
} from "@/lib/types";

export interface PointsParseResult {
  records: PointsRecord[];
  students: Student[];
  log: Omit<ImportLogEntry, "at" | "fileName">;
  preview: Record<string, string>[];
  columnMap: Partial<Record<LogicalField, number>>;
  headers: string[];
  headerRowIndex: number;
  /** erkannter Index für Teilgebiet-Spalten */
  subAreaColumns: { subAreaId: string; columnIndex: number }[];
}

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
        n === `punkte ${code}` ||
        n.includes(name) && n.includes("punkte") ||
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

/**
 * Moodle-Bewertungsexport oder Punkte_Prüfung-ähnliche Tabelle.
 */
export function parsePointsMatrix(
  matrix: unknown[][],
  subAreas: SubArea[],
  options?: {
    columnMap?: Partial<Record<LogicalField, number>>;
    headerRowIndex?: number;
    subAreaColumns?: { subAreaId: string; columnIndex: number }[];
  }
): PointsParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let headerRowIndex = options?.headerRowIndex;
  let headers: string[] = [];
  let columnMap = options?.columnMap;

  if (headerRowIndex == null) {
    const found = findHeaderRow(matrix);
    if (found) {
      headerRowIndex = found.headerRowIndex;
      headers = found.headers;
      columnMap = columnMap ?? autoMapColumns(headers);
    }
  } else {
    headers = (matrix[headerRowIndex] ?? []).map((c) => cellToString(c));
    columnMap = columnMap ?? autoMapColumns(headers);
  }

  if (headerRowIndex == null || columnMap?.matriculation == null) {
    errors.push("Matrikelnummer-Spalte nicht gefunden.");
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
      columnMap: columnMap ?? {},
      headers,
      headerRowIndex: headerRowIndex ?? 0,
      subAreaColumns: [],
    };
  }

  const matIdx = columnMap.matriculation;
  const lastIdx = columnMap.lastName;
  const firstIdx = columnMap.firstName;
  const totalIdx = columnMap.totalPoints;
  const attemptIdx = columnMap.attempt;

  const subAreaColumns =
    options?.subAreaColumns ?? detectSubAreaColumns(headers, subAreas);

  // Fallback: Moodle "Bewertung/90,00" oder Spalte L
  let resolvedTotalIdx = totalIdx;
  if (resolvedTotalIdx == null) {
    const moodle = headers.findIndex((h) =>
      /bewertung\s*\/|gesamtpunkte|gesamt/i.test(h)
    );
    if (moodle >= 0) resolvedTotalIdx = moodle;
  }

  const records: PointsRecord[] = [];
  const students: Student[] = [];
  const seen = new Set<string>();
  let unmatched = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const mat = normalizeMatriculation(row[matIdx]);
    if (!mat) {
      if (row.some((c) => cellToString(c))) {
        unmatched++;
      }
      continue;
    }
    if (seen.has(mat)) {
      warnings.push(`Doppelte Matrikelnummer ${mat}`);
      continue;
    }
    seen.add(mat);

    const bySubArea: Record<string, number | null> = {};
    for (const sa of subAreas) {
      bySubArea[sa.id] = null;
    }
    for (const sc of subAreaColumns) {
      bySubArea[sc.subAreaId] = cellToNumber(row[sc.columnIndex]);
    }

    let totalPoints =
      resolvedTotalIdx != null ? cellToNumber(row[resolvedTotalIdx]) : null;

    // Summe Teilgebiete, falls kein Gesamt
    if (totalPoints == null) {
      const parts = Object.values(bySubArea).filter(
        (v): v is number => v != null
      );
      if (parts.length > 0) {
        totalPoints = parts.reduce((a, b) => a + b, 0);
      }
    }

    // Keine Punkte → überspringen (z. B. leere Moodle-Zeilen)
    const hasAny =
      totalPoints != null ||
      Object.values(bySubArea).some((v) => v != null);
    if (!hasAny) continue;

    records.push({
      matriculationNumber: mat,
      bySubArea,
      totalPoints,
      source: "moodle",
    });

    const attempt =
      attemptIdx != null ? cellToNumber(row[attemptIdx]) : null;

    students.push({
      matriculationNumber: mat,
      lastName: lastIdx != null ? cellToString(row[lastIdx]) : "",
      firstName: firstIdx != null ? cellToString(row[firstIdx]) : "",
      attempt: attempt != null ? Math.round(attempt) : null,
    });
  }

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
      Gesamtpunkte:
        rec.totalPoints != null ? String(rec.totalPoints) : "",
    })),
    columnMap: {
      ...columnMap,
      totalPoints: resolvedTotalIdx,
    },
    headers,
    headerRowIndex,
    subAreaColumns,
  };
}
