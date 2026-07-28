import { base64ToArrayBuffer } from "@/lib/excel/binary";
import { worksheetToMatrix } from "@/lib/excel/workbook";
import { parseHisMatrix } from "@/lib/excel/parse-his";
import {
  getHisSources,
  hasOriginalHisTemplate,
  sourcesMissingOriginalTemplate,
} from "@/lib/his-sources";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { downloadBlob } from "@/lib/download";
import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
  HisSource,
} from "@/lib/types";
import type { Worksheet } from "exceljs";

function gradeForMat(
  rows: EnrichedStudentRow[],
  mat: string
): { grade: number | null; isNoShow: boolean } {
  const enriched = rows.find((r) => r.key === mat && r.inHis);
  const isNoShow =
    enriched?.status === "no_show" || enriched?.attended === false;
  if (isNoShow) return { grade: null, isNoShow: true };
  if (enriched?.finalGrade != null && Number.isFinite(enriched.finalGrade)) {
    return { grade: enriched.finalGrade, isNoShow: false };
  }
  return { grade: null, isNoShow: false };
}

function resolveWorksheet(
  wb: { worksheets: Worksheet[]; getWorksheet(name: string): Worksheet | undefined },
  source: HisSource
): Worksheet {
  const preferred =
    source.sheetName ||
    source.meta.sheetName ||
    "";
  if (preferred) {
    const byName = wb.getWorksheet(preferred);
    if (byName) return byName;
  }
  const byPattern = wb.worksheets.find((s) =>
    /noteneintrag|his|qis/i.test(s.name)
  );
  return byPattern ?? wb.worksheets[0];
}

/**
 * Findet 1-basierte Excel-Spalte der Noten (Leistung/bewertung) und Matrikel.
 */
function resolveGradeColumns(
  sheet: Worksheet,
  source: HisSource
): {
  headerRow: number;
  matCol: number;
  gradeCol: number;
} {
  const meta = source.meta;
  if (
    meta.headerRowIndex != null &&
    meta.matriculationColIndex != null &&
    meta.leistungColIndex != null
  ) {
    return {
      headerRow: meta.headerRowIndex + 1,
      matCol: meta.matriculationColIndex + 1,
      gradeCol: meta.leistungColIndex + 1,
    };
  }

  const matrix = worksheetToMatrix(sheet);
  const parsed = parseHisMatrix(matrix, {
    fileName: source.originalFileName,
  });
  if (
    parsed.headerRowIndex == null ||
    parsed.columnMap.matriculation == null
  ) {
    throw new Error(
      `In „${source.originalFileName ?? source.label}“ keine Matrikel-Spalte gefunden.`
    );
  }

  const headers = parsed.headers.map((h) => h.toLowerCase().trim());
  let leistungIdx = parsed.meta.leistungColIndex;
  if (leistungIdx == null) {
    leistungIdx = headers.findIndex(
      (h) =>
        h === "leistung" ||
        h === "bewertung" ||
        h === "note" ||
        h.includes("bewertung")
    );
  }
  if (leistungIdx == null || leistungIdx < 0) {
    throw new Error(
      `In „${source.originalFileName ?? source.label}“ keine Notenspalte (Leistung/bewertung) gefunden.`
    );
  }

  return {
    headerRow: parsed.headerRowIndex + 1,
    matCol: parsed.columnMap.matriculation + 1,
    gradeCol: leistungIdx + 1,
  };
}

function cellMatKey(value: unknown): string {
  if (value == null || value === "") return "";
  let raw: string;
  if (typeof value === "number" && Number.isFinite(value)) {
    raw = String(Math.trunc(value));
  } else if (typeof value === "object" && value !== null && "result" in value) {
    return cellMatKey((value as { result: unknown }).result);
  } else if (typeof value === "object" && value !== null && "text" in value) {
    raw = String((value as { text: string }).text);
  } else {
    raw = String(value);
  }
  return normalizeMatriculation(raw) ?? "";
}

/**
 * Schreibt Noten in die Originalvorlage – nur die Notenspalte.
 * Struktur, Format und übrige Zellen bleiben erhalten (HisinOne-kompatibel).
 */
async function exportOneSourceFromTemplate(
  source: HisSource,
  rows: EnrichedStudentRow[]
): Promise<void> {
  if (!hasOriginalHisTemplate(source) || !source.originalXlsxBase64) {
    throw new Error(
      `Für „${source.label}“ fehlt die Original-HIS-Datei. Bitte unter Import erneut einlesen.`
    );
  }

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(base64ToArrayBuffer(source.originalXlsxBase64));

  const sheet = resolveWorksheet(wb, source);
  if (!sheet) {
    throw new Error(
      `Arbeitsblatt in „${source.originalFileName ?? source.label}“ nicht gefunden.`
    );
  }

  const { headerRow, matCol, gradeCol } = resolveGradeColumns(sheet, source);

  // Primär: bekannte Zeilen aus dem Parse
  const byExcelRow = new Map<number, string>();
  for (const his of source.rows) {
    if (his.sourceExcelRow != null) {
      const mat = normalizeMatriculation(his.matriculationNumber) ?? "";
      if (mat) byExcelRow.set(his.sourceExcelRow, mat);
    }
  }

  const maxRow = Math.max(sheet.rowCount, headerRow + source.rows.length + 5);
  let updated = 0;

  for (let r = headerRow + 1; r <= maxRow; r++) {
    const firstVal = sheet.getCell(r, 1).value;
    if (
      typeof firstVal === "string" &&
      /^endHISsheet$/i.test(firstVal.trim())
    ) {
      break;
    }

    const mat =
      byExcelRow.get(r) ??
      cellMatKey(sheet.getCell(r, matCol).value);
    if (!mat) {
      // leere Vorlagenzeilen belassen
      continue;
    }

    const { grade, isNoShow } = gradeForMat(rows, mat);
    const cell = sheet.getCell(r, gradeCol);

    if (isNoShow || grade == null) {
      // No-Show / keine Note: Zelle leeren (wie HisinOne-Vorlage)
      cell.value = null;
    } else {
      // Numerische Note wie in Originalvorlagen (1.3, 2, …)
      cell.value = grade;
    }
    updated++;
  }

  if (updated === 0) {
    throw new Error(
      `In „${source.originalFileName ?? source.label}“ keine Datenzeilen aktualisiert.`
    );
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const fileName = exportFileName(source);
  await downloadBlob(fileName, blob);
}

/** Final-Noten-Export: Suffix, damit kein Namenskonflikt mit der Importdatei entsteht */
const EXPORT_NOTEN_SUFFIX = "_Noten";

function withNotenSuffix(fileName: string): string {
  const safe = fileName.replace(/[\\/:*?"<>|]+/g, "_");
  // bereits mit Suffix (auch bei erneutem Export)
  if (new RegExp(`${EXPORT_NOTEN_SUFFIX}\\.xlsx?$`, "i").test(safe)) {
    return safe;
  }
  return safe.replace(/(\.xlsx?)$/i, `${EXPORT_NOTEN_SUFFIX}$1`);
}

function exportFileName(source: HisSource): string {
  const original = source.originalFileName?.trim();
  if (original && /\.xlsx?$/i.test(original)) {
    // Basis = Originalname (HisinOne-Workflow) + Suffix „_Noten“
    return withNotenSuffix(original);
  }
  const safeCode = source.programCode || "HIS";
  const safeNum = (source.examNumber || "export")
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 40);
  return withNotenSuffix(`Noteneintrag_${safeCode}_${safeNum}.xlsx`);
}

/**
 * Exportiert HIS-Quellen als separate Dateien – formatgetreu aus der
 * jeweiligen Originalvorlage (nur Notenspalte wird gesetzt).
 * @param options.sourceId nur diese Quelle; sonst alle Quellen
 */
export async function exportHisExcel(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats?: ExamStatistics,
  options?: { sourceId?: string }
): Promise<void> {
  void stats;
  const all = getHisSources(project);
  if (all.length === 0) {
    throw new Error(
      "Keine HIS-Quelle vorhanden. Bitte zuerst die HisinOne-Noteneintragsdatei(en) importieren."
    );
  }

  const sources = options?.sourceId
    ? all.filter((s) => s.id === options.sourceId)
    : all;
  if (sources.length === 0) {
    throw new Error(
      "Die gewählte HIS-Quelle wurde nicht gefunden. Bitte Import prüfen."
    );
  }

  const missing = sources.filter((s) => !hasOriginalHisTemplate(s));
  if (missing.length > 0) {
    const labels = missing.map((s) => s.label || s.originalFileName || s.id);
    throw new Error(
      `Für formatgetreuen HisinOne-Export fehlt die Originaldatei bei: ${labels.join(", ")}. Bitte die HIS-Datei(en) unter Import erneut einlesen.`
    );
  }

  for (const source of sources) {
    await exportOneSourceFromTemplate(source, rows);
  }
}
