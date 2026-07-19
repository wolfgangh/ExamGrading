import type { ExamProject } from "@/lib/types";
import {
  buildScenarioComparisonBundle,
  type ScenarioComparisonBundle,
} from "@/lib/grades/scenario-comparison";
import {
  renderScenarioBucketBarsPng,
  renderScenarioGradeBarsPng,
} from "@/lib/charts/scenario-bars-export";
import {
  autoTable,
  getLastTableY,
  pdfGrade,
  pdfPoints,
  pdfText,
  PDF_CONTENT_WIDTH,
  PDF_MARGIN,
  savePdf,
  startPdfWithHeader,
  formatDeDate,
} from "@/lib/pdf/pdf-common";
import { formatPercent } from "@/lib/utils";
import { appVersionLabel } from "@/lib/app-version";

function ensureSpace(
  doc: import("jspdf").jsPDF,
  y: number,
  need: number
): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need > pageH - 16) {
    doc.addPage();
    return PDF_MARGIN + 12;
  }
  return y;
}

export function exportScenarioComparisonPdf(
  project: ExamProject,
  options?: { impactA?: string | null; impactB?: string | null }
): void {
  const bundle = buildScenarioComparisonBundle(
    project,
    options?.impactA,
    options?.impactB
  );
  if (bundle.columns.length === 0) {
    throw new Error("Keine sichtbaren Notenszenarien zum Export.");
  }

  const gradePng = renderScenarioGradeBarsPng(
    bundle.columns,
    bundle.gradeMatrix,
    { mode: "count", width: 1300, height: 500, scale: 2 }
  );
  const bucketPng = renderScenarioBucketBarsPng(bundle.columns, {
    width: 1300,
    height: 440,
    scale: 2,
  });

  const { doc, y: y0 } = startPdfWithHeader(
    project,
    "Szenarienvergleich / Notenverteilung"
  );
  let y = y0;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(
    pdfText(
      `Export ${formatDeDate()} · ${appVersionLabel()} · zum internen Austausch der Notenszenarien`
    ),
    PDF_MARGIN,
    y
  );
  doc.setTextColor(0);
  y += 8;

  // Kennzahlen
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Kennzahlen je Szenario"), PDF_MARGIN, y);
  y += 3;

  const head = [
    "Kennzahl",
    ...bundle.columns.map((c) => pdfText(c.label)),
  ];
  const metricRows: string[][] = [
    [
      "Bestehensgrenze",
      ...bundle.columns.map((c) => String(c.passThreshold)),
    ],
    [
      "Ø Note",
      ...bundle.columns.map((c) => pdfGrade(c.stats.averageGrade)),
    ],
    [
      "Median",
      ...bundle.columns.map((c) => pdfGrade(c.stats.medianGrade)),
    ],
    [
      "Bestehen %",
      ...bundle.columns.map((c) =>
        pdfText(formatPercent(c.stats.passRate))
      ),
    ],
    [
      "Durchfaller",
      ...bundle.columns.map((c) => String(c.stats.failCount)),
    ],
    [
      "Grenzfälle",
      ...bundle.columns.map((c) => String(c.stats.borderlineCount)),
    ],
  ];

  autoTable(doc, {
    startY: y,
    head: [head],
    body: metricRows,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });
  y = getLastTableY(doc, y) + 8;

  const colHead = (first: string) => [
    first,
    ...bundle.columns.map((c) => pdfText(c.label)),
  ];

  // 1) Notenstufen zuerst (Entscheidungsrelevanz)
  y = ensureSpace(doc, y, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Notenstufen (Anzahl und Anteil)"), PDF_MARGIN, y);
  y += 3;

  const bucketBody = bundle.bucketMatrix.map((row) => [
    pdfText(row.name),
    ...row.cells.map(
      (cell) =>
        `${cell.count} (${Math.round(cell.share * 1000) / 10} %)`
    ),
  ]);
  autoTable(doc, {
    startY: y,
    head: [colHead("Stufe")],
    body: bucketBody,
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.3 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });
  y = getLastTableY(doc, y) + 8;

  y = ensureSpace(doc, y, 70);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Visualisierung Notenstufen"), PDF_MARGIN, y);
  y += 3;
  const chartH2 = 55;
  try {
    doc.addImage(bucketPng, "PNG", PDF_MARGIN, y, PDF_CONTENT_WIDTH, chartH2);
  } catch {
    /* ignore */
  }
  y += chartH2 + 10;

  // 2) Einzelnoten (Detail)
  y = ensureSpace(doc, y, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Anzahl und Anteil je Note"), PDF_MARGIN, y);
  y += 3;

  const gradeBody = bundle.gradeMatrix.map((row) => [
    pdfText(row.gradeLabel),
    ...row.cells.map(
      (cell) =>
        `${cell.count} (${Math.round(cell.share * 1000) / 10} %)`
    ),
  ]);

  autoTable(doc, {
    startY: y,
    head: [colHead("Note")],
    body: gradeBody,
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.2 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });
  y = getLastTableY(doc, y) + 8;

  y = ensureSpace(doc, y, 80);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(pdfText("Visualisierung Noten"), PDF_MARGIN, y);
  y += 3;
  const chartH = 62;
  try {
    doc.addImage(gradePng, "PNG", PDF_MARGIN, y, PDF_CONTENT_WIDTH, chartH);
  } catch {
    doc.setFontSize(9);
    doc.text(pdfText("(Diagramm nicht einbettbar)"), PDF_MARGIN, y + 8);
  }
  y += chartH + 10;

  // Impact summary
  if (bundle.impact) {
    y = ensureSpace(doc, y, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(pdfText("Szenario-Wechsel (Auswirkung)"), PDF_MARGIN, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const imp = bundle.impact;
    const a = imp.scenarioA.name.replace(" (Standard)", "").replace(" (frei)", "");
    const b = imp.scenarioB.name.replace(" (Standard)", "").replace(" (frei)", "");
    const lines = [
      `${a} → ${b}`,
      `Besser: ${imp.improved} · Unverändert: ${imp.unchanged} · Schlechter: ${imp.worsened}`,
      `Neu bestanden: ${imp.newlyPassed} · Neu durchgefallen: ${imp.newlyFailed}`,
    ];
    for (const line of lines) {
      doc.text(pdfText(line), PDF_MARGIN, y);
      y += 4.5;
    }
    y += 4;
  }

  // Failers
  y = ensureSpace(doc, y, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(
    pdfText(
      `Durchfaller über Szenarien (${bundle.failers.length} Person(en))`
    ),
    PDF_MARGIN,
    y
  );
  y += 3;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    pdfText(
      "Personen, die in mindestens einem sichtbaren Szenario die Note 5,0 erhalten."
    ),
    PDF_MARGIN,
    y
  );
  doc.setTextColor(0);
  y += 4;

  const failHead = [
    "Name",
    "Matr.",
    "Pkt.",
    ...bundle.columns.map((c) => pdfText(c.label)),
    "Hinweis",
  ];
  const failBody = bundle.failers.map((f) => [
    pdfText(`${f.lastName}, ${f.firstName}`),
    pdfText(f.key),
    pdfPoints(f.totalPoints),
    ...f.grades.map((g, i) => {
      const t = pdfGrade(g);
      return f.failsIn[i] ? `${t} *` : t;
    }),
    pdfText(f.statusNote),
  ]);

  if (failBody.length === 0) {
    doc.setFontSize(9);
    doc.text(
      pdfText("Keine Durchfaller in den sichtbaren Szenarien."),
      PDF_MARGIN,
      y + 4
    );
  } else {
    autoTable(doc, {
      startY: y,
      head: [failHead],
      body: failBody,
      styles: { font: "helvetica", fontSize: 7, cellPadding: 1.1 },
      headStyles: {
        fillColor: [153, 68, 68],
        textColor: 255,
        fontStyle: "bold",
      },
      margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      didDrawPage: () => {
        /* keep */
      },
    });
  }

  savePdf(
    doc,
    `ExamGrade_${project.name || "Pruefung"}_Szenarienvergleich`
  );
}

export type { ScenarioComparisonBundle };
