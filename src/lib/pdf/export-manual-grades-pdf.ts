import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import {
  autoTable,
  drawKeyValueBlock,
  drawSignatureBlock,
  formatDeDate,
  formatLecturerHeaderLines,
  getLastTableY,
  pdfGrade,
  pdfPoints,
  pdfText,
  PDF_MARGIN,
  resolveProgramCode,
  savePdf,
  startPdfWithHeader,
} from "@/lib/pdf/pdf-common";

/** Kandidaten ohne HIS-Anmeldung (Sonderfälle) */
export function filterManualGradeRows(
  rows: EnrichedStudentRow[]
): EnrichedStudentRow[] {
  return rows
    .filter(
      (r) =>
        r.attendanceWithoutHis ||
        (!r.inHis && (r.hasPoints || r.finalGrade != null))
    )
    .sort((a, b) => {
      const ln = a.student.lastName.localeCompare(b.student.lastName, "de");
      if (ln !== 0) return ln;
      return a.student.firstName.localeCompare(b.student.firstName, "de");
    });
}

/**
 * Manuelle Notenmeldung – Sonderfälle ohne HISinOne-Anmeldung.
 */
export function exportManualGradesPdf(
  project: ExamProject,
  rows: EnrichedStudentRow[]
): void {
  const specials = filterManualGradeRows(rows);
  const { doc, y: y0 } = startPdfWithHeader(
    project,
    "Manuelle Notenmeldung"
  );
  let y = y0;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(60);
  doc.text(
    pdfText(
      "Nur zur Erfassung von Sonderfällen (Teilnahme ohne HIS-Anmeldung)."
    ),
    PDF_MARGIN,
    y
  );
  doc.text(
    pdfText(
      "Nicht als öffentliche Notenliste verwenden. Datenschutz beachten."
    ),
    PDF_MARGIN,
    y + 4
  );
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  y += 12;

  const header = [
    `Studiengang / Anmeldenr.: ${pdfText(project.examNumber || "–")}`,
    `Fach / Modul: ${pdfText(project.name)}`,
    `Semester: ${pdfText(project.semester || "–")}`,
    ...formatLecturerHeaderLines(project.lecturers),
    `Datum der Erstellung: ${formatDeDate()}`,
  ];
  y = drawKeyValueBlock(doc, header, y);

  if (specials.length === 0) {
    doc.setFontSize(10);
    doc.text(
      pdfText("Keine Kandidaten ohne HIS-Anmeldung vorhanden."),
      PDF_MARGIN,
      y + 6
    );
    savePdf(doc, `Manuelle_Notenmeldung_${project.name || "Pruefung"}`, {
      examName: project.name,
      examNumber: project.examNumber,
    });
    return;
  }

  const body = specials.map((r) => {
    const prog = resolveProgramCode(r, project);
    return [
      pdfText(r.student.lastName),
      pdfText(r.student.firstName),
      pdfText(r.key),
      pdfPoints(r.totalPoints),
      pdfGrade(r.finalGrade),
      pdfText(prog || "–"),
    ];
  });

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        "Nachname",
        "Vorname",
        "Matrikel-Nr.",
        "Punkte",
        "Note",
        "Studiengang",
      ],
    ],
    body,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 245] },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });

  let finalY = getLastTableY(doc, y + 40);
  finalY += 6;
  doc.setFontSize(9);
  doc.text(
    pdfText(
      `Anzahl Sonderfälle: ${specials.length} · Bitte unterschrieben an Abteilung Studium senden.`
    ),
    PDF_MARGIN,
    finalY
  );

  drawSignatureBlock(doc, project.lecturers ?? [], finalY + 6);

  savePdf(doc, `Manuelle_Notenmeldung_${project.name || "Pruefung"}`, {
    examName: project.name,
    examNumber: project.examNumber,
  });
}
