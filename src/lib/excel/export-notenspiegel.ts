import {
  buildNotenspiegelData,
  formatShareDe,
} from "@/lib/grades/notenspiegel";
import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
} from "@/lib/types";
import { downloadBlob } from "@/lib/download";
import { datedExportFilename } from "@/lib/utils";

/**
 * Notenspiegel als Excel (ein Arbeitsblatt: Metadaten, Kennzahlen, Verteilung, Stufen).
 */
export async function exportNotenspiegelExcel(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics
): Promise<void> {
  if (stats.graded <= 0) {
    throw new Error("Keine bewerteten Teilnehmer – Notenspiegel nicht sinnvoll.");
  }

  const data = buildNotenspiegelData(project, rows, stats);
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "ExamGrade";
  wb.created = new Date();

  const ws = wb.addWorksheet("Notenspiegel", {
    properties: { defaultColWidth: 18 },
  });

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 14;

  let row = 1;
  const title = ws.getCell(row, 1);
  title.value = "Notenspiegel";
  title.font = { bold: true, size: 14 };
  row += 2;

  const meta: [string, string][] = [
    ["Prüfung", data.examName],
    ["Prüfungsnummer", data.examNumber],
    ["Semester", data.semester],
    ["Dozenten", data.lecturers],
    ["Notenszenario", data.scenarioName],
    ["Bestehensgrenze (Pkt.)", String(data.passThreshold)],
    ["Max. Punkte", String(data.maxPoints)],
    [
      "Erzeugt am",
      new Date(data.generatedAt).toLocaleString("de-DE"),
    ],
  ];
  for (const [k, v] of meta) {
    ws.getCell(row, 1).value = k;
    ws.getCell(row, 1).font = { bold: true };
    ws.getCell(row, 2).value = v;
    row++;
  }

  row += 1;
  ws.getCell(row, 1).value = data.note;
  ws.getCell(row, 1).font = { italic: true, size: 9, color: { argb: "FF555555" } };
  row += 2;

  ws.getCell(row, 1).value = "Kennzahlen";
  ws.getCell(row, 1).font = { bold: true, size: 12 };
  row += 1;
  ws.getCell(row, 1).value = "Kennzahl";
  ws.getCell(row, 2).value = "Wert";
  ws.getCell(row, 1).font = { bold: true };
  ws.getCell(row, 2).font = { bold: true };
  row += 1;
  for (const m of data.metrics) {
    ws.getCell(row, 1).value = m.label;
    ws.getCell(row, 2).value = m.value;
    row++;
  }

  row += 1;
  ws.getCell(row, 1).value = "Notenverteilung";
  ws.getCell(row, 1).font = { bold: true, size: 12 };
  row += 1;
  ws.getCell(row, 1).value = "Note";
  ws.getCell(row, 2).value = "Anzahl";
  ws.getCell(row, 3).value = "Anteil";
  for (let c = 1; c <= 3; c++) {
    ws.getCell(row, c).font = { bold: true };
  }
  row += 1;
  for (const g of data.gradeRows) {
    ws.getCell(row, 1).value = g.label;
    ws.getCell(row, 2).value = g.count;
    ws.getCell(row, 3).value = formatShareDe(g.share).replace("\u00a0", " ");
    row++;
  }
  ws.getCell(row, 1).value = "Summe";
  ws.getCell(row, 2).value = data.graded;
  ws.getCell(row, 3).value = data.graded > 0 ? "100,0 %" : "–";
  ws.getCell(row, 1).font = { bold: true };
  ws.getCell(row, 2).font = { bold: true };
  ws.getCell(row, 3).font = { bold: true };
  row += 2;

  ws.getCell(row, 1).value = "Notenstufen";
  ws.getCell(row, 1).font = { bold: true, size: 12 };
  row += 1;
  ws.getCell(row, 1).value = "Stufe";
  ws.getCell(row, 2).value = "Anzahl";
  ws.getCell(row, 3).value = "Anteil";
  for (let c = 1; c <= 3; c++) {
    ws.getCell(row, c).font = { bold: true };
  }
  row += 1;
  for (const b of data.bucketRows) {
    ws.getCell(row, 1).value = b.label;
    ws.getCell(row, 2).value = b.count;
    ws.getCell(row, 3).value = formatShareDe(b.share).replace("\u00a0", " ");
    row++;
  }

  const buffer = await wb.xlsx.writeBuffer();
  await downloadBlob(
    datedExportFilename(`Notenspiegel_${project.name || "Pruefung"}`, "xlsx"),
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
}
