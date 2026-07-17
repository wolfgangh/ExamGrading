import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import {
  autoTable,
  drawKeyValueBlock,
  findPointsRecord,
  formatDeDate,
  getLastTableY,
  pdfGrade,
  pdfText,
  PDF_MARGIN,
  resolveProgramCode,
  savePdf,
  startPdfWithHeader,
} from "@/lib/pdf/pdf-common";

export interface GradeChangeRow {
  row: EnrichedStudentRow;
  previousGrade: number | null;
  newGrade: number | null;
  programCode: string;
}

/** Kandidaten mit geänderter Note (Override nach Klausureinsicht etc.) */
export function filterGradeChangeRows(
  project: ExamProject,
  rows: EnrichedStudentRow[]
): GradeChangeRow[] {
  const out: GradeChangeRow[] = [];
  for (const r of rows) {
    if (r.gradeOverride == null) continue;
    const rec = findPointsRecord(project, r.key);
    const previous =
      rec?.previousGrade ?? r.calculatedGrade ?? null;
    const neu = r.finalGrade;
    if (
      previous != null &&
      neu != null &&
      Math.abs(previous - neu) < 0.05
    ) {
      continue;
    }
    if (previous == null && neu == null) continue;
    out.push({
      row: r,
      previousGrade: previous,
      newGrade: neu,
      programCode: resolveProgramCode(r, project),
    });
  }
  return out.sort((a, b) => {
    const ln = a.row.student.lastName.localeCompare(
      b.row.student.lastName,
      "de"
    );
    if (ln !== 0) return ln;
    return a.row.student.firstName.localeCompare(
      b.row.student.firstName,
      "de"
    );
  });
}

/**
 * Notenänderungsliste zur Vorlage beim Prüfungsamt
 * (analog Notenänderungsliste.pdf, modernisiert).
 */
export function exportGradeChangesPdf(
  project: ExamProject,
  rows: EnrichedStudentRow[]
): void {
  const changes = filterGradeChangeRows(project, rows);
  if (changes.length === 0) {
    throw new Error(
      "Keine Notenänderungen vorhanden (manuelle Notenkorrekturen)."
    );
  }

  const { doc, y: y0 } = startPdfWithHeader(
    project,
    "Notenänderungsliste"
  );
  let y = y0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    pdfText(
      "Zur Vorlage beim Prüfungsamt – bitte nur für die Notenkorrektur verwenden."
    ),
    PDF_MARGIN,
    y
  );
  y += 5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    pdfText(
      "Diese Liste darf aus Datenschutzgründen NICHT für die Notenbekanntgabe ausgehängt werden."
    ),
    PDF_MARGIN,
    y
  );
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  y += 8;

  const lecturers = project.lecturers ?? [];
  const programs = [
    ...new Set(changes.map((c) => c.programCode).filter(Boolean)),
  ];

  const header = [
    `Semester: ${pdfText(project.semester || "–")}`,
    `Studiengang: ${pdfText(programs.join(", ") || "–")}`,
    `Anmeldenummer / Prüfungsnr.: ${pdfText(project.examNumber || "–")}`,
    `Fachbezeichnung: ${pdfText(project.name)}`,
    `Name des/r Prüfers/in: ${pdfText(lecturers[0] || "–")}`,
    `Name des/r Zweitprüfers/in: ${pdfText(lecturers[1] || "–")}`,
    `Erstellt: ${formatDeDate()}`,
  ];
  y = drawKeyValueBlock(doc, header, y);

  const body = changes.map((c) => [
    pdfText(c.row.key),
    pdfText(c.row.student.lastName),
    pdfText(c.row.student.firstName),
    pdfText(c.programCode || "–"),
    pdfGrade(c.previousGrade),
    pdfGrade(c.newGrade),
  ]);

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        "Matrikel-Nr.",
        "Name",
        "Vorname",
        "Studiengruppe",
        "Bisherige Note",
        "Neue Note",
      ],
    ],
    body,
    styles: { font: "helvetica", fontSize: 9, cellPadding: 2 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    columnStyles: {
      0: { cellWidth: 28 },
      4: { halign: "center", cellWidth: 28 },
      5: { halign: "center", cellWidth: 28 },
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });

  let finalY = getLastTableY(doc, y + 40);
  finalY += 8;
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    pdfText(
      "Bitte beachten: Diese Liste darf aus Datenschutzgründen NICHT für die Notenbekanntgabe ausgehängt werden."
    ),
    PDF_MARGIN,
    finalY,
    { maxWidth: 180 }
  );
  doc.setTextColor(0);
  finalY += 12;

  doc.setFontSize(9);
  const sigLines = [
    "Datum, Unterschrift Prüfer/in",
    "Datum, Unterschrift Zweitprüfer/in",
    "Datum, Unterschrift PK-Vorsitzende/r",
  ];
  for (const label of sigLines) {
    if (finalY > 275) {
      doc.addPage();
      finalY = PDF_MARGIN + 10;
    }
    doc.line(PDF_MARGIN, finalY, PDF_MARGIN + 70, finalY);
    doc.text(pdfText(label), PDF_MARGIN, finalY + 4);
    finalY += 14;
  }

  savePdf(doc, `Notenaenderung_${project.name || "Pruefung"}`);
}
