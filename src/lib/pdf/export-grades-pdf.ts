import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import { HISINONE_LABEL } from "@/lib/types";
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
  resolveProgramCode,
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

function formatDeDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Gesamte Notenliste inkl. No-Shows und ohne HISinOne */
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
      `Alle Prüfungsteilnehmer einschließlich No-Shows und Kandidaten ohne ${HISINONE_LABEL}-Anmeldung.`
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
    const program = resolveProgramCode(r, project);
    return [
      pdfText(r.student.lastName),
      pdfText(r.student.firstName),
      pdfText(r.key),
      pdfText(program || "–"),
      isNoShow ? "–" : pdfPoints(r.totalPoints),
      isNoShow ? "–" : pdfGrade(r.finalGrade),
      pdfText(status),
    ];
  });

  autoTable(doc, {
    startY: y + 2,
    head: [
      [
        "Nachname",
        "Vorname",
        "Matrikel-Nr.",
        "Studiengang",
        "Punkte",
        "Note",
        "Status",
      ],
    ],
    body: data,
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.3 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 24 },
      2: { cellWidth: 26 },
      3: { cellWidth: 22 },
      4: { halign: "right", cellWidth: 16 },
      5: { halign: "right", cellWidth: 14 },
      6: { cellWidth: 26 },
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });

  let finalY = getLastTableY(doc, 200);

  const merges = (project.identityMerges ?? []).filter((m) => m.active);
  const undoneMerges = (project.identityMerges ?? []).filter(
    (m) => !m.active && m.undoneAt
  );
  const dismissals = (project.identityDismissals ?? []).filter((d) => d.active);
  const undoneDismissals = (project.identityDismissals ?? []).filter(
    (d) => !d.active && d.undoneAt
  );

  if (
    merges.length > 0 ||
    dismissals.length > 0 ||
    undoneMerges.length > 0 ||
    undoneDismissals.length > 0
  ) {
    doc.addPage();
    let ay = PDF_MARGIN + 14;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(
      pdfText("Dokumentierte Matrikel-Pruefungen"),
      PDF_MARGIN,
      ay
    );
    ay += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(
      pdfText(
        `Nach Sichtung der Antrittsdaten und der ${HISINONE_LABEL}-Unterlagen. ` +
          "Zusammenfuehrungen korrigieren Tippfehler in der selbst eingetragenen Matrikelnummer; " +
          "Ablehnungen bestaetigen, dass kein Merge erfolgen soll."
      ),
      PDF_MARGIN,
      ay,
      { maxWidth: 180 }
    );
    doc.setTextColor(0);
    ay += 12;

    if (merges.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(pdfText("A) Zusammengefuehrt"), PDF_MARGIN, ay);
      ay += 2;

      autoTable(doc, {
        startY: ay,
        head: [
          [
            "Datum",
            "Falsche Matr.",
            `Korrekt (${HISINONE_LABEL})`,
            "Name (Antritt)",
            "Begruendung",
          ],
        ],
        body: merges.map((m) => [
          pdfText(formatDeDateTime(m.at)),
          pdfText(m.sourceMatriculation),
          pdfText(m.targetMatriculation),
          pdfText(
            `${m.sourceSnapshot.lastName}, ${m.sourceSnapshot.firstName}`
          ),
          pdfText(m.reason),
        ]),
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.4 },
        headStyles: {
          fillColor: [68, 112, 153],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [236, 253, 245] },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 24 },
          2: { cellWidth: 28 },
          3: { cellWidth: 36 },
          4: { cellWidth: 56 },
        },
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      });
      ay = getLastTableY(doc, ay) + 10;
    }

    if (dismissals.length > 0) {
      if (ay > 240) {
        doc.addPage();
        ay = PDF_MARGIN + 14;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(
        pdfText("B) Geprueft, nicht zusammengefuehrt"),
        PDF_MARGIN,
        ay
      );
      ay += 2;

      autoTable(doc, {
        startY: ay,
        head: [["Datum", "Matr. (Antritt)", "Name", "Begruendung"]],
        body: dismissals.map((d) => [
          pdfText(formatDeDateTime(d.at)),
          pdfText(d.sourceMatriculation),
          pdfText(
            `${d.sourceSnapshot.lastName}, ${d.sourceSnapshot.firstName}`
          ),
          pdfText(d.reason),
        ]),
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.4 },
        headStyles: {
          fillColor: [68, 112, 153],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [255, 247, 237] },
        columnStyles: {
          0: { cellWidth: 28 },
          1: { cellWidth: 28 },
          2: { cellWidth: 40 },
          3: { cellWidth: 76 },
        },
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      });
      ay = getLastTableY(doc, ay) + 8;
    }

    if (undoneMerges.length > 0) {
      if (ay > 240) {
        doc.addPage();
        ay = PDF_MARGIN + 14;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(pdfText("C) Zusammenfuehrungen aufgehoben"), PDF_MARGIN, ay);
      ay += 2;

      autoTable(doc, {
        startY: ay,
        head: [
          [
            "Merge am",
            "Aufgehoben am",
            "Matr. (war)",
            "Begruendung Aufhebung",
          ],
        ],
        body: undoneMerges.map((m) => [
          pdfText(formatDeDateTime(m.at)),
          pdfText(m.undoneAt ? formatDeDateTime(m.undoneAt) : "–"),
          pdfText(`${m.sourceMatriculation} → ${m.targetMatriculation}`),
          pdfText(m.undoReason ?? "–"),
        ]),
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.4 },
        headStyles: {
          fillColor: [100, 100, 100],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 32 },
          2: { cellWidth: 40 },
          3: { cellWidth: 68 },
        },
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      });
      ay = getLastTableY(doc, ay) + 8;
    }

    if (undoneDismissals.length > 0) {
      if (ay > 240) {
        doc.addPage();
        ay = PDF_MARGIN + 14;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(pdfText("D) Ablehnungen aufgehoben"), PDF_MARGIN, ay);
      ay += 2;

      autoTable(doc, {
        startY: ay,
        head: [
          ["Ablehnung am", "Aufgehoben am", "Matr.", "Begruendung Aufhebung"],
        ],
        body: undoneDismissals.map((d) => [
          pdfText(formatDeDateTime(d.at)),
          pdfText(d.undoneAt ? formatDeDateTime(d.undoneAt) : "–"),
          pdfText(d.sourceMatriculation),
          pdfText(d.undoReason ?? "–"),
        ]),
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.4 },
        headStyles: {
          fillColor: [100, 100, 100],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 32 },
          2: { cellWidth: 28 },
          3: { cellWidth: 80 },
        },
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      });
      ay = getLastTableY(doc, ay) + 8;
    }

    finalY = ay;
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
