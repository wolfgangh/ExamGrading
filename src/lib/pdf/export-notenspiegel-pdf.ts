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
import { renderDurationPointsScatterPng } from "@/lib/charts/duration-points-export-chart";
import {
  buildDurationPointsAnalysis,
  regressionCoefficientRows,
  regressionFitRows,
  regressionModelFormulaText,
} from "@/lib/grades/duration-points-analysis";
import { isOnlineStyleExam } from "@/lib/types";
import {
  autoTable,
  getLastTableY,
  jsPDF,
  pdfText,
  PDF_CONTENT_WIDTH,
  PDF_MARGIN,
  PDF_PAGE_WIDTH,
  savePdf,
  startPdfWithHeader,
} from "@/lib/pdf/pdf-common";
import { formatPoints } from "@/lib/utils";

/** Strukturierter Meta-Block: Label links, Wert umbrechend rechts */
function drawNotenspiegelMeta(
  doc: InstanceType<typeof jsPDF>,
  rows: { label: string; value: string }[],
  startY: number
): number {
  const labelW = 38;
  const valueX = PDF_MARGIN + labelW;
  const valueW = PDF_CONTENT_WIDTH - labelW;
  let y = startY;

  for (const row of rows) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text(pdfText(row.label), PDF_MARGIN, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(20);
    const lines = doc.splitTextToSize(
      pdfText(row.value || "–"),
      valueW
    ) as string[];
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], valueX, y + i * 4.2);
    }
    y += Math.max(5, lines.length * 4.2) + 1.5;
  }

  // Trennlinie
  y += 1;
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(PDF_MARGIN, y, PDF_PAGE_WIDTH - PDF_MARGIN, y);
  doc.setTextColor(0);
  return y + 5;
}

export function exportNotenspiegelPdf(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics
): void {
  if (stats.graded <= 0) {
    throw new Error("Keine bewerteten Teilnehmer – Notenspiegel nicht sinnvoll.");
  }

  const data = buildNotenspiegelData(project, rows, stats);
  const chartPng = renderGradeDistributionChartPng(data, {
    width: 1400,
    height: 620,
    scale: 2.5,
  });

  const { doc, y: y0 } = startPdfWithHeader(project, "Notenspiegel");

  let y = drawNotenspiegelMeta(
    doc,
    [
      { label: "Prüfung", value: data.examName },
      { label: "Prüfungsnummer(n)", value: data.examNumber },
      { label: "Semester", value: data.semester },
      { label: "Dozenten", value: data.lecturers },
      { label: "Notenszenario", value: data.scenarioName },
    ],
    y0
  );

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.setFont("helvetica", "italic");
  const noteLines = doc.splitTextToSize(
    pdfText(data.note),
    PDF_CONTENT_WIDTH
  ) as string[];
  doc.text(noteLines, PDF_MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(0);
  y += noteLines.length * 3.5 + 5;

  // --- Seite 1: Kennzahlen | Notenverteilung nebeneinander ---
  const tableStartY = y;
  const leftW = 92;
  const gap = 6;
  const rightLeft = PDF_MARGIN + leftW + gap;
  const rightW = PDF_CONTENT_WIDTH - leftW - gap;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(pdfText("Kennzahlen"), PDF_MARGIN, tableStartY);
  doc.text(pdfText("Notenverteilung"), rightLeft, tableStartY);
  y = tableStartY + 3;

  const metricBody = data.metrics.map((m) => [
    pdfText(m.label),
    pdfText(m.value),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["Kennzahl", "Wert"]],
    body: metricBody,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.4 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 52 },
      1: { cellWidth: 32, halign: "right" },
    },
    margin: { left: PDF_MARGIN, right: PDF_PAGE_WIDTH - PDF_MARGIN - leftW },
    tableWidth: leftW,
  });
  const yLeft = getLastTableY(doc, y);

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
    head: [["Note", "Stufe", "Anz.", "Anteil"]],
    body: gradeBody,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.4 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 16 },
      1: { cellWidth: 28 },
      2: { cellWidth: 14, halign: "right" },
      3: { cellWidth: 18, halign: "right" },
    },
    margin: { left: rightLeft, right: PDF_MARGIN },
    tableWidth: rightW,
    didParseCell: (hookData) => {
      if (
        hookData.section === "body" &&
        hookData.row.index === gradeBody.length - 1
      ) {
        hookData.cell.styles.fontStyle = "bold";
      }
    },
  });
  const yRight = getLastTableY(doc, y);
  y = Math.max(yLeft, yRight) + 8;

  // Diagramm
  if (y > 200) {
    doc.addPage();
    y = PDF_MARGIN + 16;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Notenverteilung (grafisch)"), PDF_MARGIN, y);
  y += 4;

  const chartH = 68;
  try {
    doc.addImage(
      chartPng,
      "PNG",
      PDF_MARGIN,
      y,
      PDF_CONTENT_WIDTH,
      chartH
    );
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

  y = getLastTableY(doc, y) + 10;

  // Teilgebiete
  if (data.subAreaRows.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = PDF_MARGIN + 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(pdfText("Teilgebiete"), PDF_MARGIN, y);
    y += 3;

    const saBody = data.subAreaRows.map((s) => [
      pdfText(s.code ? `${s.name} (${s.code})` : s.name),
      formatPoints(s.maxPoints),
      String(s.n),
      s.averagePoints != null ? formatPoints(s.averagePoints) : "–",
      s.averagePercent != null
        ? `${String(s.averagePercent).replace(".", ",")}\u00a0%`
        : "–",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Teilgebiet", "Max.", "n", "Ø Punkte", "Ø %"]],
      body: saBody,
      styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8 },
      headStyles: {
        fillColor: [68, 112, 153],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        1: { halign: "right", cellWidth: 22 },
        2: { halign: "right", cellWidth: 16 },
        3: { halign: "right", cellWidth: 24 },
        4: { halign: "right", cellWidth: 22 },
      },
      margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    });
    y = getLastTableY(doc, y) + 10;
  }

  // Dauer / Regression (THE/Moodle mit Dauerspalte)
  if (isOnlineStyleExam(project.examType)) {
    const durationAnalysis = buildDurationPointsAnalysis(project, "points");
    if (durationAnalysis.available) {
      doc.addPage();
      y = PDF_MARGIN + 16;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(
        pdfText("Bearbeitungsdauer und Punkte"),
        PDF_MARGIN,
        y
      );
      y += 5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80);
      doc.text(
        pdfText(
          `Scatterplot: Dauer (x) gegen Punkte (y), Farbe = Notenstufe. n = ${durationAnalysis.nWithDuration}`
        ),
        PDF_MARGIN,
        y
      );
      doc.setTextColor(0);
      y += 4;

      const scatterPng = renderDurationPointsScatterPng(durationAnalysis, {
        width: 1400,
        height: 620,
        scale: 2.5,
      });
      const scatterH = 78;
      if (scatterPng) {
        try {
          doc.addImage(
            scatterPng,
            "PNG",
            PDF_MARGIN,
            y,
            PDF_CONTENT_WIDTH,
            scatterH
          );
        } catch {
          doc.setFontSize(9);
          doc.text(
            pdfText("(Scatterplot konnte nicht eingebettet werden)"),
            PDF_MARGIN,
            y + 10
          );
        }
        y += scatterH + 8;
      }

      if (durationAnalysis.regression) {
        const reg = durationAnalysis.regression;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(pdfText("Lineare Regression"), PDF_MARGIN, y);
        y += 5;

        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(40);
        const formulaLines = doc.splitTextToSize(
          pdfText(
            regressionModelFormulaText(
              durationAnalysis.yMode,
              durationAnalysis.maxPoints
            )
          ),
          PDF_CONTENT_WIDTH
        ) as string[];
        doc.text(formulaLines, PDF_MARGIN, y);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);
        y += formulaLines.length * 4 + 3;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(pdfText("Koeffizienten"), PDF_MARGIN, y);
        y += 2;

        const coefBody = regressionCoefficientRows(reg, {
          yUnitShort: durationAnalysis.yUnitShort,
          slopeUnit: durationAnalysis.slopeUnit,
          yMode: durationAnalysis.yMode,
        }).map((r) => [
          pdfText(r.name),
          pdfText(r.symbol),
          pdfText(r.value),
          pdfText(r.unit),
          pdfText(r.se),
          pdfText(r.t),
          pdfText(r.pValue),
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Name", "Symbol", "Wert", "Einheit", "SE", "t", "p-Wert"]],
          body: coefBody,
          styles: { font: "helvetica", fontSize: 8, cellPadding: 1.4 },
          headStyles: {
            fillColor: [68, 112, 153],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            2: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right" },
            6: { halign: "right" },
          },
          margin: { left: PDF_MARGIN, right: PDF_MARGIN },
        });
        y = getLastTableY(doc, y) + 6;

        if (y > 240) {
          doc.addPage();
          y = PDF_MARGIN + 16;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(pdfText("Guetemasse und Stichprobe"), PDF_MARGIN, y);
        y += 2;

        const fitBody = regressionFitRows(reg).map((r) => [
          pdfText(r.name),
          pdfText(r.symbol),
          pdfText(r.value),
          pdfText(r.note ?? ""),
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Name", "Symbol", "Wert", "Hinweis"]],
          body: fitBody,
          styles: { font: "helvetica", fontSize: 8, cellPadding: 1.4 },
          headStyles: {
            fillColor: [68, 112, 153],
            textColor: 255,
            fontStyle: "bold",
          },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          columnStyles: {
            2: { halign: "right", cellWidth: 28 },
          },
          margin: { left: PDF_MARGIN, right: PDF_MARGIN },
        });
        y = getLastTableY(doc, y) + 6;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(90);
        const noteLines = doc.splitTextToSize(
          pdfText(
            "OLS-Schaetzung; p-Werte zweiseitig (Student-t, H0: Koeffizient = 0). " +
              "SE = Standardfehler. R2 = Bestimmtheitsmass."
          ),
          PDF_CONTENT_WIDTH
        ) as string[];
        doc.text(noteLines, PDF_MARGIN, y);
        doc.setTextColor(0);
        y += noteLines.length * 3.2 + 4;
      } else {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(80);
        doc.text(
          pdfText(
            "Fuer die Regression werden mindestens 3 Personen mit Dauer und Punkten benoetigt."
          ),
          PDF_MARGIN,
          y
        );
        doc.setTextColor(0);
        y += 8;
      }
    }
  }

  const finalY = y;
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
