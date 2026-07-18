import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
} from "@/lib/types";
import {
  buildNotenspiegelData,
  formatShareDe,
} from "@/lib/grades/notenspiegel";
import { renderGradeDistributionChartPng } from "@/lib/charts/grade-distribution-export-chart";
import {
  autoTable,
  drawKeyValueBlock,
  getLastTableY,
  pdfText,
  PDF_CONTENT_WIDTH,
  PDF_MARGIN,
  savePdf,
  startPdfWithHeader,
} from "@/lib/pdf/pdf-common";

export function exportNotenspiegelPdf(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics
): void {
  if (stats.graded <= 0) {
    throw new Error("Keine bewerteten Teilnehmer – Notenspiegel nicht sinnvoll.");
  }

  const data = buildNotenspiegelData(project, rows, stats);
  // Hohe logische Auflösung + HiDPI-Scale für scharfe PDF-Einbettung
  const chartPng = renderGradeDistributionChartPng(data, {
    width: 1400,
    height: 620,
    scale: 2.5,
  });

  const { doc, y: y0 } = startPdfWithHeader(project, "Notenspiegel");

  let y = drawKeyValueBlock(
    doc,
    [
      `Prüfung: ${data.examName}`,
      `Prüfungsnummer: ${data.examNumber}`,
      `Semester: ${data.semester}`,
      `Dozenten: ${data.lecturers}`,
      `Notenszenario: ${data.scenarioName}`,
    ],
    y0
  );

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(pdfText(data.note), PDF_MARGIN, y);
  doc.setTextColor(0);
  y += 6;

  // Kennzahlen-Tabelle
  const metricBody = data.metrics.map((m) => [
    pdfText(m.label),
    pdfText(m.value),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Kennzahl", "Wert"]],
    body: metricBody,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 55 },
      1: { cellWidth: 40, halign: "right" },
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    tableWidth: 100,
  });

  y = getLastTableY(doc, y) + 10;

  // Diagramm oft auf neuer Seite für Platz
  if (y > 100) {
    doc.addPage();
    y = PDF_MARGIN + 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Notenverteilung (grafisch)"), PDF_MARGIN, y);
  y += 4;

  const chartH = 72;
  const chartW = PDF_CONTENT_WIDTH;
  try {
    doc.addImage(chartPng, "PNG", PDF_MARGIN, y, chartW, chartH);
  } catch {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      pdfText("(Diagramm konnte nicht eingebettet werden)"),
      PDF_MARGIN,
      y + 10
    );
  }
  y += chartH + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Notenverteilung (tabelle)"), PDF_MARGIN, y);
  y += 3;

  const gradeBody = [
    ...data.gradeRows.map((r) => [
      pdfText(r.label),
      pdfText(r.bucket),
      String(r.count),
      pdfText(formatShareDe(r.share)),
    ]),
    [
      pdfText("Summe"),
      "",
      String(data.graded),
      data.graded > 0 ? "100,0 %" : "–",
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Note", "Stufe", "Anzahl", "Anteil"]],
    body: gradeBody,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 36 },
      2: { cellWidth: 24, halign: "right" },
      3: { cellWidth: 24, halign: "right" },
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    didParseCell: (hookData) => {
      if (
        hookData.section === "body" &&
        hookData.row.index === gradeBody.length - 1
      ) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });

  y = getLastTableY(doc, y) + 10;

  if (y > 230) {
    doc.addPage();
    y = PDF_MARGIN + 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Notenstufen"), PDF_MARGIN, y);
  y += 3;

  const bucketBody = data.bucketRows.map((r) => [
    pdfText(r.label),
    String(r.count),
    pdfText(formatShareDe(r.share)),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Stufe", "Anzahl", "Anteil"]],
    body: bucketBody,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 28, halign: "right" },
      2: { cellWidth: 28, halign: "right" },
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });

  const finalY = getLastTableY(doc, y) + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    pdfText(
      "Erzeugt mit ExamGrade. Balken nach Notenstufe gefaerbt; Linien = Mittelwert und Median."
    ),
    PDF_MARGIN,
    finalY
  );
  doc.setTextColor(0);

  savePdf(doc, `Notenspiegel_${project.name || "Pruefung"}`);
}
