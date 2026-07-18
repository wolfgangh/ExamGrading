import type { Workbook, Worksheet } from "exceljs";
import {
  assertFileSizeLimit,
  MAX_EXCEL_IMPORT_BYTES,
} from "@/lib/import-limits";

export async function loadWorkbookFromFile(file: File): Promise<Workbook> {
  assertFileSizeLimit(file, MAX_EXCEL_IMPORT_BYTES, "Excel-Datei");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  return workbook;
}

export function worksheetToMatrix(
  sheet: Worksheet,
  maxRows = 5000
): unknown[][] {
  const rows: unknown[][] = [];
  let maxCol = 1;

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber > maxRows) return;
    const values = row.values as unknown[];
    // exceljs: values[0] is empty
    const cells: unknown[] = [];
    for (let i = 1; i < values.length; i++) {
      const v = values[i];
      if (v && typeof v === "object" && "result" in (v as object)) {
        cells.push((v as { result: unknown }).result);
      } else if (v && typeof v === "object" && "text" in (v as object)) {
        cells.push((v as { text: string }).text);
      } else if (v && typeof v === "object" && "richText" in (v as object)) {
        const rt = (v as { richText: { text: string }[] }).richText;
        cells.push(rt.map((t) => t.text).join(""));
      } else {
        cells.push(v ?? null);
      }
    }
    maxCol = Math.max(maxCol, cells.length);
    rows[rowNumber - 1] = cells;
  });

  // fill sparse
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i]) rows[i] = [];
    while (rows[i].length < maxCol) rows[i].push(null);
  }

  return rows;
}

export function listSheetNames(workbook: Workbook): string[] {
  return workbook.worksheets.map((ws) => ws.name);
}

const F_HEADER_RE =
  /(?:^|[^a-z0-9])(F|Frage|Aufgabe)\s*\d+/i;

/**
 * Wählt das beste Arbeitsblatt für THE-/Punkte-Import.
 * Bevorzugt Detailpunkte mit F-Spalten vor reinen Gesamtpunkte-Blättern.
 */
export function pickPointsWorksheet(workbook: Workbook): Worksheet {
  const sheets = workbook.worksheets;
  if (sheets.length === 0) {
    throw new Error("Excel-Datei enthält keine Arbeitsblätter.");
  }
  if (sheets.length === 1) return sheets[0];

  let best = sheets[0];
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const sheet of sheets) {
    const name = sheet.name.toLowerCase();
    let score = 0;

    if (/detail/.test(name)) score += 80;
    if (/bewertung|grades|moodle|the/.test(name)) score += 25;
    if (/^punkte$|punktevorlage|klausur/.test(name)) score += 40;
    else if (/punkte/.test(name)) score += 15;
    if (/hinweis|anleitung|definition/.test(name)) score -= 50;
    if (/antritt|noteneintrag|szenario|durchfall|his|qis/.test(name)) {
      score -= 60;
    }

    // Nur Header-Bereich scannen
    const matrix = worksheetToMatrix(sheet, 20);
    for (const row of matrix.slice(0, 15)) {
      const headers = (row ?? []).map((c) =>
        String(c ?? "")
          .replace(/[\u00a0\u202f\u2007]/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      );
      const joined = headers.join(" ").toLowerCase();
      const fCount = headers.filter((h) => F_HEADER_RE.test(h)).length;
      if (fCount >= 2) score += 40 + fCount * 8;
      else if (fCount === 1) score += 10;
      if (joined.includes("bewertung/")) score += 12;
      if (joined.includes("anmeldename")) score += 8;
      if (/matr/.test(joined)) score += 6;
      if (joined.includes("nachname") && joined.includes("vorname")) score += 4;
      // reines Gesamtblatt ohne Aufgaben abwerten
      if (
        fCount === 0 &&
        (joined.includes("gesamtpunkte") || joined.includes("punkte f"))
      ) {
        score -= 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = sheet;
    }
  }

  return best;
}
