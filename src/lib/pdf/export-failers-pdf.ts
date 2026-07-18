import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import {
  autoTable,
  drawKeyValueBlock,
  drawSignatureBlock,
  findPointsRecord,
  formatDeDate,
  formatLecturerHeaderLines,
  getLastTableY,
  pdfGrade,
  pdfPoints,
  pdfText,
  PDF_MARGIN,
  savePdf,
  startPdfWithHeader,
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

/** Zweitkorrektur-Punkte für alle Durchfaller erfasst? */
export function secondCorrectionComplete(
  project: ExamProject,
  rows: EnrichedStudentRow[]
): { total: number; filled: number; ready: boolean } {
  const failers = filterFailerRows(rows);
  let filled = 0;
  for (const r of failers) {
    const rec = findPointsRecord(project, r.key);
    if (rec?.secondCorrectionPoints != null) filled++;
  }
  return {
    total: failers.length,
    filled,
    ready: failers.length > 0 && filled === failers.length,
  };
}

/**
 * Zweitkorrektur / Durchfallerliste – mit erfassten Zweitpunkten.
 */
export function exportFailersPdf(
  project: ExamProject,
  rows: EnrichedStudentRow[]
): void {
  const failers = filterFailerRows(rows);
  const { ready } = secondCorrectionComplete(project, rows);
  if (!ready) {
    throw new Error(
      "Bitte für alle Durchfaller die Punkte der Zweitkorrektur erfassen."
    );
  }

  const { doc, y: y0 } = startPdfWithHeader(
    project,
    "Ergebnis der Zweitkorrektur"
  );
  let y = y0;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(
    pdfText(
      "Interne Prüferunterlage · Durchfaller (Note > 4,0) mit Ergebnis der Zweitkorrektur."
    ),
    PDF_MARGIN,
    y
  );
  doc.setTextColor(0);
  y += 8;

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
    ...formatLecturerHeaderLines(project.lecturers),
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

  const body = failers.map((r) => {
    const rec = findPointsRecord(project, r.key);
    return [
      pdfText(r.student.lastName),
      pdfText(r.student.firstName),
      pdfText(r.key),
      pdfPoints(r.totalPoints),
      pdfGrade(r.finalGrade),
      pdfPoints(rec?.secondCorrectionPoints),
      pdfText(rec?.secondCorrectionNotes ?? ""),
    ];
  });

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
      5: { halign: "right", cellWidth: 20 },
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

  drawSignatureBlock(doc, project.lecturers ?? [], finalY + 4, {
    label: "Unterschriften der Prüfer",
  });

  savePdf(doc, `Zweitkorrektur_Durchfaller_${project.name || "Pruefung"}`);
}
