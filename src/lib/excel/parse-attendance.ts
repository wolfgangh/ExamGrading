import {
  autoMapColumns,
  cellToString,
  findHeaderRow,
  type LogicalField,
} from "@/lib/excel/column-detect";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type { AttendanceRecord, ImportLogEntry, Student } from "@/lib/types";

export interface AttendanceParseResult {
  records: AttendanceRecord[];
  students: Student[];
  log: Omit<ImportLogEntry, "at" | "fileName">;
  preview: Record<string, string>[];
  columnMap: Partial<Record<LogicalField, number>>;
  headers: string[];
  headerRowIndex: number;
}

/**
 * Moodle-Export „Antritt zur Prüfung“:
 * Präsenz der Matrikelnummer = angetreten.
 */
export function parseAttendanceMatrix(
  matrix: unknown[][],
  options?: {
    columnMap?: Partial<Record<LogicalField, number>>;
    headerRowIndex?: number;
  }
): AttendanceParseResult {
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
        type: "attendance",
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

  const matIdx = columnMap.matriculation;
  const lastIdx = columnMap.lastName;
  const firstIdx = columnMap.firstName;
  const fullIdx = columnMap.fullName;
  const emailIdx = columnMap.email;

  const records: AttendanceRecord[] = [];
  const students: Student[] = [];
  const seen = new Set<string>();
  let unmatched = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const mat = normalizeMatriculation(row[matIdx]);
    if (!mat) {
      const any = row.some((c) => cellToString(c));
      if (any) {
        unmatched++;
        warnings.push(`Zeile ${r + 1}: keine Matrikelnummer`);
      }
      continue;
    }
    if (seen.has(mat)) {
      warnings.push(`Doppelte Matrikelnummer ${mat}`);
      continue;
    }
    seen.add(mat);

    let lastName = lastIdx != null ? cellToString(row[lastIdx]) : "";
    let firstName = firstIdx != null ? cellToString(row[firstIdx]) : "";

    if ((!lastName || !firstName) && fullIdx != null) {
      const full = cellToString(row[fullIdx]);
      // "Nachname, Vorname" oder "Vorname Nachname"
      if (full.includes(",")) {
        const [a, b] = full.split(",").map((s) => s.trim());
        lastName = lastName || a;
        firstName = firstName || b;
      } else {
        const parts = full.split(/\s+/);
        if (parts.length >= 2) {
          firstName = firstName || parts.slice(0, -1).join(" ");
          lastName = lastName || parts[parts.length - 1];
        }
      }
    }

    records.push({
      matriculationNumber: mat,
      attended: true,
      sourceRow: r + 1,
    });

    students.push({
      matriculationNumber: mat,
      lastName,
      firstName,
      email: emailIdx != null ? cellToString(row[emailIdx]) : undefined,
    });
  }

  return {
    records,
    students,
    log: {
      type: "attendance",
      rowCount: records.length,
      matched: records.length,
      unmatched,
      warnings,
      errors,
    },
    preview: students.slice(0, 5).map((s) => ({
      Matrikelnummer: s.matriculationNumber,
      Nachname: s.lastName,
      Vorname: s.firstName,
    })),
    columnMap,
    headers,
    headerRowIndex,
  };
}
