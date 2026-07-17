import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import {
  autoTable,
  createPdfDoc,
  drawDocTitle,
  drawKeyValueBlock,
  drawSignatureBlock,
  formatDeDate,
  pdfGrade,
  pdfPoints,
  pdfText,
  getLastTableY,
  PDF_MARGIN,
  savePdf,
} from "@/lib/pdf/pdf-common";

export function filterFailerRows(
  rows: EnrichedStudentRow[]
): EnrichedStudentRow[] {
  return rows
    .filter((r) => r.isFailed)
    .sort((a, b) => {
      const ln = a.student.lastName.localeCompare(b.student.lastName, "de");
      if (ln !== 0) return ln;
      return a.student.firstName.localeCompare(b.student.firstName, "de");
    });
}

/**
 * Zweitkorrektur / Durchfallerliste – analog Vorlage Zweitkorrektur, modernisiert.
 */
export function exportFailersPdf(
  project: ExamProject,
  rows: EnrichedStudentRow[]
): void {
  const failers = filterFailerRows(rows);
  const doc = createPdfDoc();
  let y = drawDocTitle(doc, "Ergebnis der Zweitkorrektur");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(
    pdfText(
      "Interne Prüferunterlage · Durchfaller (Note > 4,0) mit Feldern für die Zweitkorrektur."
    ),
    PDF_MARGIN,
    y
  );
  doc.setTextColor(0);
  y += 8;

  const lecturers = project.lecturers ?? [];
  const erst = lecturers[0] || "____________________";
  const zweit = lecturers[1] || "____________________";
  const programs = [
    ...new Set(
      failers.map((r) => r.programCode).filter((p): p is string => !!p)
    ),
  ];

  const header = [
    `Semester: ${pdfText(project.semester || "–")}`,
    `Studiengang: ${pdfText(programs.join(", ") || project.examNumber || "–")}`,
    `Modul / Prüfung: ${pdfText(project.name)}`,
    `Prüfungsnummer: ${pdfText(project.examNumber || "–")}`,
    `Bestehensgrenze: ${project.gradeSchema.passThreshold} von ${project.gradeSchema.maxPoints} Punkten`,
    `Erstprüfer: ${pdfText(erst)}`,
    `Zweitprüfer: ${pdfText(zweit)}`,
  ];
  y = drawKeyValueBlock(doc, header, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    pdfText(
      "Die Zweitkorrektur wurde durchgeführt und führte zu folgenden Ergebnissen:"
    ),
    PDF_MARGIN,
    y + 2
  );
  y += 8;

  if (failers.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.text(pdfText("Keine Durchfaller vorhanden."), PDF_MARGIN, y + 4);
    savePdf(doc, `Zweitkorrektur_${project.name || "Pruefung"}`);
    return;
  }

  const body = failers.map((r) => [
    pdfText(r.student.lastName),
    pdfText(r.student.firstName),
    pdfText(r.key),
    pdfPoints(r.totalPoints),
    pdfGrade(r.finalGrade),
    "", // Punkte Zweitkorrektur – handschriftlich
    "", // Anmerkungen – handschriftlich
  ]);

  autoTable(doc, {
    startY: y,
    head: [
      [
        "Nachname",
        "Vorname",
        "Matrikel-Nr.",
        "Punkte\nErstkorr.",
        "Note",
        "Punkte\nZweitkorr.",
        "Anmerkungen",
      ],
    ],
    body,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 1.8,
      valign: "middle",
      minCellHeight: 8,
    },
    headStyles: {
      fillColor: [90, 40, 40],
      textColor: 255,
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      2: { cellWidth: 24 },
      3: { halign: "right", cellWidth: 18 },
      4: { halign: "right", cellWidth: 14 },
      5: { cellWidth: 22 },
      6: { cellWidth: 36 },
    },
    alternateRowStyles: { fillColor: [252, 245, 245] },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });

  let finalY = getLastTableY(doc, y + 40);

  finalY += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    pdfText(`Anzahl der durchgeführten Zweitkorrekturen: ${failers.length}`),
    PDF_MARGIN,
    finalY
  );

  finalY += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(pdfText(`Datum: ${formatDeDate()}`), PDF_MARGIN, finalY);

  drawSignatureBlock(doc, [erst, zweit].filter(Boolean), finalY + 4, {
    label: "Unterschriften Erst- und Zweitprüfer",
  });

  savePdf(doc, `Zweitkorrektur_Durchfaller_${project.name || "Pruefung"}`);
}
