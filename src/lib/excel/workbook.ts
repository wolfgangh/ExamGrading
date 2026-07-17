import type { Workbook, Worksheet } from "exceljs";

export async function loadWorkbookFromFile(file: File): Promise<Workbook> {
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
