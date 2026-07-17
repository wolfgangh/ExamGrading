import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
} from "@/lib/types";
import {
  buildNotenspiegelData,
  formatShareDe,
} from "@/lib/grades/notenspiegel";
import {
  autoTable,
  drawKeyValueBlock,
  getLastTableY,
  pdfText,
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

  // Kennzahlen-Tabelle (2 Spalten als Key/Value-Paare)
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

  y = getLastTableY(doc, y) + 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Notenverteilung"), PDF_MARGIN, y);
  y += 3;

  const gradeBody = [
    ...data.gradeRows.map((r) => [
      pdfText(r.label),
      String(r.count),
      pdfText(formatShareDe(r.share)),
    ]),
    [
      pdfText("Summe"),
      String(data.graded),
      data.graded > 0 ? "100,0 %" : "–",
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [["Note", "Anzahl", "Anteil"]],
    body: gradeBody,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 28, halign: "right" },
      2: { cellWidth: 28, halign: "right" },
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.row.index === gradeBody.length - 1) {
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
      "Erzeugt mit ExamGrade. Notenspiegel basiert auf dem aktiven Notenschlüssel."
    ),
    PDF_MARGIN,
    finalY
  );
  doc.setTextColor(0);

  savePdf(doc, `Notenspiegel_${project.name || "Pruefung"}`);
}
