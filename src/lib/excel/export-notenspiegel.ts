import {
  buildNotenspiegelData,
  formatShareDe,
} from "@/lib/grades/notenspiegel";
import {
  dataUrlToUint8Array,
  renderGradeDistributionChartPng,
} from "@/lib/charts/grade-distribution-export-chart";
import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
} from "@/lib/types";
import { downloadBlob } from "@/lib/download";
import { datedExportFilename, formatGrade } from "@/lib/utils";

/**
 * Notenspiegel als Excel inkl. Diagramm-PNG und Diagrammdaten.
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
  const chartPng = renderGradeDistributionChartPng(data, {
    width: 900,
    height: 420,
  });

  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "ExamGrade";
  wb.created = new Date();

  const ws = wb.addWorksheet("Notenspiegel", {
    properties: { defaultColWidth: 18 },
  });

  ws.getColumn(1).width = 28;
  ws.getColumn(2).width = 22;
  ws.getColumn(3).width = 14;
  ws.getColumn(4).width = 14;
  ws.getColumn(5).width = 14;

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
    ["Mittelwert Note", formatGrade(data.averageGrade)],
    ["Median Note", formatGrade(data.medianGrade)],
    ["Erzeugt am", new Date(data.generatedAt).toLocaleString("de-DE")],
  ];
  for (const [k, v] of meta) {
    ws.getCell(row, 1).value = k;
    ws.getCell(row, 1).font = { bold: true };
    ws.getCell(row, 2).value = v;
    row++;
  }

  row += 1;
  ws.getCell(row, 1).value = data.note;
  ws.getCell(row, 1).font = {
    italic: true,
    size: 9,
    color: { argb: "FF555555" },
  };
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
  const headers = ["Note", "Notenstufe", "Anzahl", "Anteil", "Farbe"];
  headers.forEach((h, i) => {
    ws.getCell(row, i + 1).value = h;
    ws.getCell(row, i + 1).font = { bold: true };
  });
  row += 1;
  for (const g of data.gradeRows) {
    ws.getCell(row, 1).value = g.label;
    ws.getCell(row, 2).value = g.bucket;
    ws.getCell(row, 3).value = g.count;
    ws.getCell(row, 4).value = formatShareDe(g.share).replace("\u00a0", " ");
    ws.getCell(row, 5).value = g.color;
    // Farbmarkierung
    ws.getCell(row, 5).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF" + g.color.replace("#", "").toUpperCase() },
    };
    row++;
  }
  ws.getCell(row, 1).value = "Summe";
  ws.getCell(row, 3).value = data.graded;
  ws.getCell(row, 4).value = data.graded > 0 ? "100,0 %" : "–";
  ws.getCell(row, 1).font = { bold: true };
  ws.getCell(row, 3).font = { bold: true };
  row += 2;

  ws.getCell(row, 1).value = "Notenstufen";
  ws.getCell(row, 1).font = { bold: true, size: 12 };
  row += 1;
  ["Stufe", "Anzahl", "Anteil"].forEach((h, i) => {
    ws.getCell(row, i + 1).value = h;
    ws.getCell(row, i + 1).font = { bold: true };
  });
  row += 1;
  for (const b of data.bucketRows) {
    ws.getCell(row, 1).value = b.label;
    ws.getCell(row, 2).value = b.count;
    ws.getCell(row, 3).value = formatShareDe(b.share).replace("\u00a0", " ");
    row++;
  }

  // Blatt Diagramm
  const wsChart = wb.addWorksheet("Diagramm", {
    properties: { defaultColWidth: 16 },
  });
  wsChart.getCell(1, 1).value = "Notenverteilung (grafisch)";
  wsChart.getCell(1, 1).font = { bold: true, size: 14 };
  wsChart.getCell(2, 1).value =
    "Balken nach Notenstufe gefärbt. Linien: Mittelwert und Median.";
  wsChart.getCell(2, 1).font = { italic: true, size: 10 };

  const pngBytes = dataUrlToUint8Array(chartPng);
  const imageId = wb.addImage({
    // exceljs typings erwarten Node Buffer; Uint8Array funktioniert zur Laufzeit
    buffer: pngBytes as unknown as ArrayBuffer,
    extension: "png",
  });
  wsChart.addImage(imageId, {
    tl: { col: 0, row: 3 },
    ext: { width: 640, height: 300 },
  });

  // Diagrammdaten unter dem Bild
  let r = 22;
  wsChart.getCell(r, 1).value = "Diagrammdaten";
  wsChart.getCell(r, 1).font = { bold: true, size: 12 };
  r += 1;
  wsChart.getCell(r, 1).value = "Mittelwert Note";
  wsChart.getCell(r, 1).font = { bold: true };
  wsChart.getCell(r, 2).value = data.averageGrade;
  wsChart.getCell(r, 3).value = formatGrade(data.averageGrade);
  r += 1;
  wsChart.getCell(r, 1).value = "Median Note";
  wsChart.getCell(r, 1).font = { bold: true };
  wsChart.getCell(r, 2).value = data.medianGrade;
  wsChart.getCell(r, 3).value = formatGrade(data.medianGrade);
  r += 2;

  ["Note", "Note (Zahl)", "Anzahl", "Anteil", "Notenstufe"].forEach((h, i) => {
    wsChart.getCell(r, i + 1).value = h;
    wsChart.getCell(r, i + 1).font = { bold: true };
  });
  r += 1;
  for (const g of data.gradeRows) {
    wsChart.getCell(r, 1).value = g.label;
    wsChart.getCell(r, 2).value = g.grade;
    wsChart.getCell(r, 3).value = g.count;
    wsChart.getCell(r, 4).value = Math.round(g.share * 1000) / 10 / 100;
    wsChart.getCell(r, 4).numFmt = "0.0%";
    wsChart.getCell(r, 5).value = g.bucket;
    r++;
  }

  const buffer = await wb.xlsx.writeBuffer();
  await downloadBlob(
    datedExportFilename(`Notenspiegel_${project.name || "Pruefung"}`, "xlsx"),
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
}
