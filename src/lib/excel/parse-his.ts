import {
  autoMapColumns,
  cellToString,
  findHeaderRow,
  type LogicalField,
} from "@/lib/excel/column-detect";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { HISTemplateRow, HisTemplateMeta, ImportLogEntry } from "@/lib/types";

export interface HisParseResult {
  rows: HISTemplateRow[];
  meta: HisTemplateMeta;
  log: Omit<ImportLogEntry, "at" | "fileName">;
  preview: Record<string, string>[];
  columnMap: Partial<Record<LogicalField, number>>;
  headers: string[];
  headerRowIndex: number;
}

/**
 * Parst HIS/QIS-Noteneintragsdatei.
 * Sucht Header-Zeile mit Nachname/Vorname/Matrikelnummer.
 */
export function parseHisMatrix(
  matrix: unknown[][],
  options?: {
    columnMap?: Partial<Record<LogicalField, number>>;
    headerRowIndex?: number;
  }
): HisParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  let headerRowIndex = options?.headerRowIndex;
  let headers: string[] = [];
  let columnMap = options?.columnMap;

  if (headerRowIndex == null || !columnMap) {
    const found = findHeaderRow(matrix);
    if (!found) {
      // Fallback: manuell typische HIS-Zeile 10 (0-basiert 9)
      for (let i = 0; i < Math.min(20, matrix.length); i++) {
        const row = matrix[i] ?? [];
        const joined = row.map((c) => cellToString(c).toLowerCase()).join("|");
        if (
          joined.includes("nachname") &&
          joined.includes("matrikel")
        ) {
          headers = row.map((c) => cellToString(c));
          headerRowIndex = i;
          columnMap = autoMapColumns(headers);
          break;
        }
      }
    } else {
      headerRowIndex = found.headerRowIndex;
      headers = found.headers;
      columnMap = autoMapColumns(headers);
    }
  } else {
    headers = (matrix[headerRowIndex] ?? []).map((c) => cellToString(c));
  }

  if (headerRowIndex == null || !columnMap?.matriculation) {
    errors.push(
      "Keine Header-Zeile mit Matrikelnummer gefunden. Bitte Spalten manuell zuordnen."
    );
    return {
      rows: [],
      meta: {},
      log: {
        type: "his",
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
    };
  }

  const matIdx = columnMap.matriculation!;
  const lastIdx = columnMap.lastName;
  const firstIdx = columnMap.firstName;

  // Meta aus Kopfbereich
  const titleCell = cellToString(matrix[0]?.[0]);
  const lecturers: string[] = [];
  for (let r = 0; r < headerRowIndex; r++) {
    const a = cellToString(matrix[r]?.[0]);
    const c = cellToString(matrix[r]?.[2]);
    if (/^prof/i.test(a)) lecturers.push(a);
    if (/^prof/i.test(c)) lecturers.push(c);
  }

  const rows: HISTemplateRow[] = [];
  const seen = new Set<string>();
  let unmatched = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const matRaw = row[matIdx];
    const mat = normalizeMatriculation(matRaw);
    const lastName = lastIdx != null ? cellToString(row[lastIdx]) : "";
    const firstName = firstIdx != null ? cellToString(row[firstIdx]) : "";

    // leere Zeilen überspringen
    if (!mat && !lastName && !firstName) continue;

    if (!mat) {
      unmatched++;
      warnings.push(`Zeile ${r + 1}: keine gültige Matrikelnummer`);
      continue;
    }

    if (seen.has(mat)) {
      warnings.push(`Doppelte Matrikelnummer ${mat} (Zeile ${r + 1}) – übersprungen`);
      continue;
    }
    seen.add(mat);

    rows.push({
      matriculationNumber: mat,
      lastName,
      firstName,
      orderIndex: rows.length,
    });
  }

  const preview = rows.slice(0, 5).map((r) => ({
    Matrikelnummer: r.matriculationNumber,
    Nachname: r.lastName,
    Vorname: r.firstName,
  }));

  return {
    rows,
    meta: {
      titleCell: titleCell || undefined,
      lecturers: lecturers.length ? lecturers : undefined,
      headerRowIndex,
      dataStartRowIndex: headerRowIndex + 1,
    },
    log: {
      type: "his",
      rowCount: rows.length,
      matched: rows.length,
      unmatched,
      warnings,
      errors,
    },
    preview,
    columnMap,
    headers,
    headerRowIndex,
  };
}
