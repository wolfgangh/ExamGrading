import {
  autoMapColumns,
  cellToNumber,
  cellToString,
  findHeaderRow,
  type LogicalField,
} from "@/lib/excel/column-detect";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import type {
  HISTemplateRow,
  HisFileFormat,
  HisTemplateMeta,
  ImportLogEntry,
} from "@/lib/types";

/**
 * Prüfungsnummer aus HISinOne-Titelzeile.
 * MEB 20242 8010260 RMT | BW 20152 7820010 FI | 7820010 …
 */
export function extractExamNumberFromHisTitle(
  title: string | undefined | null
): string | null {
  if (!title) return null;
  const t = title.trim();
  if (!t) return null;

  const structured = t.match(
    /\b([A-ZÄÖÜ]{2,5})\s+(\d{4,5})\s+(\d{5,})\s+([A-ZÄÖÜ]{1,8})\b/i
  );
  if (structured) {
    return `${structured[1].toUpperCase()} ${structured[2]} ${structured[3]} ${structured[4].toUpperCase()}`;
  }

  const full = t.match(
    /\b((?:BW|BB|MBW|MEB|MB|BM|IBM|BWL)\s*[\d\s]+\d{5,}(?:\s*[A-ZÄÖÜ]{0,8})?)\b/i
  );
  if (full) {
    return full[1].replace(/\s+/g, " ").trim();
  }

  const leading = t.match(/^(\d{5,})\b/);
  if (leading) return leading[1];

  const anywhere = t.match(/\b(\d{6,8})\b/);
  if (anywhere) return anywhere[1];

  return null;
}

function extractExamCheckToken(matrix: unknown[][]): string | undefined {
  for (let r = 0; r < Math.min(15, matrix.length); r++) {
    const row = matrix[r] ?? [];
    for (let c = 0; c < row.length; c++) {
      const v = cellToString(row[c]);
      if (/EXAM_CHECK_TOKEN/i.test(v)) {
        const next = cellToString(row[c + 1]);
        if (next) return next;
        const m = v.match(/EXAM_CHECK_TOKEN\s*[:=]?\s*(\S+)/i);
        if (m) return m[1];
      }
    }
  }
  return undefined;
}

function extractLecturerFromTitle(title: string): string[] {
  const m = title.match(/Prüfer\/?-?in:\s*([^|]+)/i);
  if (!m) return [];
  const raw = m[1].trim();
  return raw ? [raw] : [];
}

function findColumn(
  headers: string[],
  predicates: (h: string) => boolean
): number | undefined {
  const idx = headers.findIndex((h) => predicates(h.toLowerCase().trim()));
  return idx >= 0 ? idx : undefined;
}

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
 * Parst HIS/QIS-Noteneintragsdatei (Legacy + HISinOne v2).
 */
export function parseHisMatrix(
  matrix: unknown[][],
  options?: {
    columnMap?: Partial<Record<LogicalField, number>>;
    headerRowIndex?: number;
    fileName?: string;
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
      for (let i = 0; i < Math.min(25, matrix.length); i++) {
        const row = matrix[i] ?? [];
        const joined = row.map((c) => cellToString(c).toLowerCase()).join("|");
        if (
          joined.includes("matrikel") &&
          (joined.includes("nachname") ||
            joined.includes("examplan") ||
            joined.includes("prüfungsnr") ||
            joined.includes("prufungsnr"))
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

  if (headerRowIndex != null && columnMap?.matriculation == null) {
    const matIdx = findColumn(headers, (h) => h.includes("matrikel"));
    if (matIdx != null) {
      columnMap = { ...columnMap, matriculation: matIdx };
    }
  }

  if (headerRowIndex == null || columnMap?.matriculation == null) {
    errors.push(
      "Keine Header-Zeile mit Matrikelnummer gefunden. Bitte Dateiformat prüfen."
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
  let lastIdx = columnMap.lastName;
  let firstIdx = columnMap.firstName;

  const examPlanIdx = findColumn(
    headers,
    (h) => h.includes("examplan") || h === "examplan.id"
  );
  const examNrIdx = findColumn(
    headers,
    (h) =>
      h.includes("prüfungsnr") ||
      h.includes("prufungsnr") ||
      h.includes("pruefungsnr")
  );
  const titleIdx = findColumn(headers, (h) => h === "titel" || h === "title");
  const statusIdx = findColumn(headers, (h) => h === "status");
  const leistungIdx = findColumn(
    headers,
    (h) => h === "leistung" || h === "bewertung" || h === "note"
  );
  const vermerkIdx = findColumn(headers, (h) => h.includes("vermerk"));
  const semesterIdx = findColumn(
    headers,
    (h) => h === "semester" && !h.includes("jahr")
  );
  const yearIdx = findColumn(headers, (h) => h === "jahr" || h === "year");

  if (lastIdx == null) {
    lastIdx = findColumn(headers, (h) => h === "nachname" || h === "name");
  }
  if (firstIdx == null) {
    firstIdx = findColumn(headers, (h) => h === "vorname");
  }

  const isHisinOne =
    examPlanIdx != null ||
    examNrIdx != null ||
    headers.some((h) => /examplan|prüfungsnr/i.test(h));
  const format: HisFileFormat = isHisinOne ? "hisinone_v2" : "legacy";

  const titleCell = cellToString(matrix[0]?.[0]);
  let examNumber = extractExamNumberFromHisTitle(titleCell) ?? undefined;
  const examCheckToken = extractExamCheckToken(matrix);
  const lecturers: string[] = extractLecturerFromTitle(titleCell);
  for (let r = 0; r < headerRowIndex; r++) {
    const a = cellToString(matrix[r]?.[0]);
    const c = cellToString(matrix[r]?.[2]);
    if (/^prof/i.test(a) && !lecturers.includes(a)) lecturers.push(a);
    if (/^prof/i.test(c) && !lecturers.includes(c)) lecturers.push(c);
  }

  let semesterLabel: string | undefined;
  let examPeriod: string | undefined;
  const semM = titleCell.match(/(Sommer|Winter)semester\s*\d{4}/i);
  if (semM) semesterLabel = semM[0];
  const perM = titleCell.match(/Prüfungsperiode\s*\d+/i);
  if (perM) examPeriod = perM[0];

  const rows: HISTemplateRow[] = [];
  const seen = new Set<string>();
  let unmatched = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    const firstCell = cellToString(row[0]);
    if (/^endHISsheet$/i.test(firstCell)) break;

    const mat = normalizeMatriculation(row[matIdx]);
    const lastName = lastIdx != null ? cellToString(row[lastIdx]) : "";
    const firstName = firstIdx != null ? cellToString(row[firstIdx]) : "";

    if (!mat && !lastName && !firstName) continue;

    if (!mat) {
      unmatched++;
      warnings.push(`Zeile ${r + 1}: keine gültige Matrikelnummer`);
      continue;
    }

    if (seen.has(mat)) {
      warnings.push(
        `Doppelte Matrikelnummer ${mat} in derselben Datei (Zeile ${r + 1}) – übersprungen`
      );
      continue;
    }
    seen.add(mat);

    const rowExamNr =
      examNrIdx != null ? cellToString(row[examNrIdx]) : "";
    if (!examNumber && rowExamNr) {
      examNumber = extractExamNumberFromHisTitle(rowExamNr) ?? rowExamNr;
    }

    const leistungRaw = leistungIdx != null ? row[leistungIdx] : null;
    const leistungNum = cellToNumber(leistungRaw);
    const leistung =
      leistungNum != null
        ? leistungNum
        : leistungRaw != null && cellToString(leistungRaw)
          ? cellToString(leistungRaw)
          : null;

    rows.push({
      matriculationNumber: mat,
      lastName,
      firstName,
      orderIndex: rows.length,
      /** Matrix 0-basiert → Excel 1-basiert */
      sourceExcelRow: r + 1,
      examPlanId:
        examPlanIdx != null
          ? cellToString(row[examPlanIdx]) || undefined
          : undefined,
      examNumber: rowExamNr || examNumber || undefined,
      title: titleIdx != null ? cellToString(row[titleIdx]) : undefined,
      status: statusIdx != null ? cellToString(row[statusIdx]) : undefined,
      leistung,
      vermerk:
        vermerkIdx != null ? cellToString(row[vermerkIdx]) : undefined,
      semester:
        semesterIdx != null ? cellToString(row[semesterIdx]) : undefined,
      year: yearIdx != null ? cellToString(row[yearIdx]) : undefined,
    });
  }

  const preview = rows.slice(0, 5).map((r) => ({
    Matrikelnummer: r.matriculationNumber,
    Nachname: r.lastName,
    Vorname: r.firstName,
    ...(r.examNumber ? { PrüfungsNr: r.examNumber } : {}),
    ...(r.status ? { Status: r.status } : {}),
  }));

  return {
    rows,
    meta: {
      titleCell: titleCell || undefined,
      examNumber,
      examCheckToken,
      lecturers: lecturers.length ? lecturers : undefined,
      semesterLabel,
      examPeriod,
      headerRowIndex,
      dataStartRowIndex: headerRowIndex + 1,
      format,
      headerColumns: headers.filter(Boolean),
      originalFileName: options?.fileName,
      matriculationColIndex: matIdx,
      leistungColIndex: leistungIdx,
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
