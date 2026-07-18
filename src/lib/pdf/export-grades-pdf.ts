import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import {
  autoTable,
  drawKeyValueBlock,
  drawSignatureBlock,
  examHeaderLines,
  getLastTableY,
  pdfGrade,
  pdfPoints,
  pdfText,
  PDF_MARGIN,
  savePdf,
  shortStatus,
  startPdfWithHeader,
} from "@/lib/pdf/pdf-common";

function sortRows(rows: EnrichedStudentRow[]): EnrichedStudentRow[] {
  return [...rows].sort((a, b) => {
    const ln = a.student.lastName.localeCompare(b.student.lastName, "de");
    if (ln !== 0) return ln;
    return a.student.firstName.localeCompare(b.student.firstName, "de");
  });
}

/** Gesamte Notenliste inkl. No-Shows und ohne HIS */
export function exportGradesListPdf(
  project: ExamProject,
  rows: EnrichedStudentRow[]
): void {
  const { doc, y: y0 } = startPdfWithHeader(project, "Notenliste");
  let y = drawKeyValueBlock(doc, examHeaderLines(project), y0);

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    pdfText(
      "Alle Prüfungsteilnehmer einschließlich No-Shows und Kandidaten ohne HIS-Anmeldung."
    ),
    PDF_MARGIN,
    y
  );
  doc.setTextColor(0);
  y += 4;

  const data = sortRows(rows).map((r) => {
    const isNoShow = r.status === "no_show" || r.attended === false;
    let status = shortStatus(r);
    if (r.mergedFromMatriculation) {
      status = `${status} (ZF ${r.mergedFromMatriculation})`;
    }
    return [
      pdfText(r.student.lastName),
      pdfText(r.student.firstName),
      pdfText(r.key),
      isNoShow ? "–" : pdfPoints(r.totalPoints),
      isNoShow ? "–" : pdfGrade(r.finalGrade),
      pdfText(status),
    ];
  });

  autoTable(doc, {
    startY: y + 2,
    head: [
      ["Nachname", "Vorname", "Matrikel-Nr.", "Punkte", "Note", "Status"],
    ],
    body: data,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      2: { cellWidth: 28 },
      3: { halign: "right", cellWidth: 18 },
      4: { halign: "right", cellWidth: 16 },
      5: { cellWidth: 22 },
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });

  let finalY = getLastTableY(doc, 200);

  const merges = (project.identityMerges ?? []).filter((m) => m.active);
  if (merges.length > 0) {
    let y = finalY + 8;
    if (y > 250) {
      doc.addPage();
      y = PDF_MARGIN + 12;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(pdfText("Matrikel-Zusammenführungen (THE)"), PDF_MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const m of merges) {
      if (y > 275) {
        doc.addPage();
        y = PDF_MARGIN + 12;
      }
      const line = `${m.sourceMatriculation} → ${m.targetMatriculation}: ${m.sourceSnapshot.lastName}, ${m.sourceSnapshot.firstName} · ${m.reason}`;
      doc.text(pdfText(line), PDF_MARGIN, y, {
        maxWidth: 180,
      });
      y += 5;
    }
    finalY = y;
  }

  let sigY = finalY + 8;
  if (sigY > 240) {
    doc.addPage();
    sigY = PDF_MARGIN + 10;
  }

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    pdfText("Bitte ausgedruckt und unterschrieben aufbewahren."),
    PDF_MARGIN,
    sigY
  );
  doc.setTextColor(0);
  drawSignatureBlock(doc, project.lecturers ?? [], sigY + 4);

  savePdf(doc, `Notenliste_${project.name || "Pruefung"}`);
}
