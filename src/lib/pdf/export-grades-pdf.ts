import type {
  EnrichedStudentRow,
  ExamProject,
  PointsRecord,
} from "@/lib/types";
import { HISINONE_LABEL, isPortfolioExam, isStaCriteriaExam } from "@/lib/types";
import {
  autoTable,
  drawKeyValueBlock,
  drawSignatureBlock,
  examHeaderLines,
  findPointsRecord,
  getLastTableY,
  pdfFooterFromProject,
  pdfGrade,
  pdfPoints,
  pdfText,
  PDF_MARGIN,
  resolveProgramCode,
  savePdf,
  shortStatus,
  startPdfWithHeader,
} from "@/lib/pdf/pdf-common";
import { formatGrade, formatPoints } from "@/lib/utils";

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

function meanFinite(values: (number | null | undefined)[]): number | null {
  const nums = values.filter(
    (v): v is number => v != null && Number.isFinite(v)
  );
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100;
}

function formatCellValue(
  v: number | null,
  kind: "points" | "percent" | "grade"
): string {
  if (v == null || !Number.isFinite(v)) return "–";
  if (kind === "grade") return pdfText(formatGrade(v));
  if (kind === "percent") return pdfText(formatPoints(v, 0));
  return pdfText(formatPoints(v, 1));
}

type ExtraCol = {
  header: string;
  value: (r: EnrichedStudentRow, rec: PointsRecord | undefined) => string;
};

/** Nur TL-Noten (keine Rohwerte) */
function portfolioTlNoteColumns(project: ExamProject): ExtraCol[] {
  if (!isPortfolioExam(project.examType)) return [];
  const components = project.portfolioComponents ?? [];
  return components.map((c) => ({
    header: pdfText(c.code || c.name).slice(0, 14),
    value: (r) => {
      if (r.status === "no_show" || r.attended === false) return "–";
      const g =
        r.portfolioComponentDetails?.[c.id]?.grade ??
        r.portfolioComponentGrades?.[c.id] ??
        null;
      return g != null ? pdfGrade(g) : "–";
    },
  }));
}

/** Rohwert-Spalten Teilkriterien (Portfolio) */
function portfolioRawCriterionColumns(project: ExamProject): ExtraCol[] {
  if (
    !isPortfolioExam(project.examType) ||
    project.portfolioCriteriaMode !== true
  ) {
    return [];
  }
  const components = project.portfolioComponents ?? [];
  const lecturers = (project.lecturers ?? [])
    .map((l) => l.trim())
    .filter(Boolean);
  const multiTl = components.length > 1;
  const cols: ExtraCol[] = [];

  for (const c of components) {
    for (const k of c.criteria ?? []) {
      const header = multiTl
        ? `${c.code || c.name}·${k.code || k.name}`
        : k.code || k.name;
      const kind =
        k.scale === "grade"
          ? ("grade" as const)
          : k.scale === "percent"
            ? ("percent" as const)
            : ("points" as const);
      cols.push({
        header: pdfText(header).slice(0, 16),
        value: (r, rec) => {
          if (r.status === "no_show" || r.attended === false) return "–";
          if (!rec) return "–";
          if (project.portfolioPerLecturerGrading && lecturers.length) {
            const vals = lecturers.map(
              (name) =>
                rec.portfolioCriterionValuesByLecturer?.[c.id]?.[name]?.[
                  k.id
                ] ?? null
            );
            return formatCellValue(meanFinite(vals), kind);
          }
          const v = rec.portfolioCriterionValues?.[c.id]?.[k.id] ?? null;
          return formatCellValue(
            v != null && Number.isFinite(v) ? v : null,
            kind
          );
        },
      });
    }
  }
  return cols;
}

function staRawCriterionColumns(project: ExamProject): ExtraCol[] {
  if (!isStaCriteriaExam(project.examType)) return [];
  return (project.criteria ?? []).map((k) => {
    const kind =
      k.scale === "grade"
        ? ("grade" as const)
        : k.scale === "percent"
          ? ("percent" as const)
          : ("points" as const);
    return {
      header: pdfText(k.code || k.name).slice(0, 14),
      value: (r, rec) => {
        if (r.status === "no_show" || r.attended === false) return "–";
        const v = rec?.criterionValues?.[k.id] ?? null;
        return formatCellValue(
          v != null && Number.isFinite(v) ? v : null,
          kind
        );
      },
    };
  });
}

const RAW_CHUNK = 9;

function chunkColumns<T>(cols: T[], size: number): T[][] {
  if (cols.length === 0) return [];
  const out: T[][] = [];
  for (let i = 0; i < cols.length; i += size) {
    out.push(cols.slice(i, i + size));
  }
  return out;
}

export type GradesListPdfOptions = {
  /** Rohwerte der Teilkriterien als weitere Tabelle(n) anhängen */
  includeCriterionRawValues?: boolean;
};

/** Gesamte Notenliste inkl. No-Shows und ohne HISinOne */
export function exportGradesListPdf(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  options?: GradesListPdfOptions
): void {
  const includeRaw = options?.includeCriterionRawValues === true;
  const tlCols = portfolioTlNoteColumns(project);
  const rawCols = includeRaw
    ? [...portfolioRawCriterionColumns(project), ...staRawCriterionColumns(project)]
    : [];

  const { doc, y: y0 } = startPdfWithHeader(project, "Notenliste", {
    orientation: "portrait",
  });
  let y = drawKeyValueBlock(doc, examHeaderLines(project), y0);

  doc.setFontSize(8);
  doc.setTextColor(80);
  doc.text(
    pdfText(
      `Alle Prüfungsteilnehmer einschließlich No-Shows und Kandidaten ohne ${HISINONE_LABEL}-Anmeldung.` +
        (tlCols.length
          ? " Spalten der Teilleistungen: berechnete Teilnoten."
          : "") +
        (includeRaw && rawCols.length
          ? " Rohwerte der Teilkriterien in separater Tabelle."
          : "")
    ),
    PDF_MARGIN,
    y,
    { maxWidth: 180 }
  );
  doc.setTextColor(0);
  y += 6;

  const sorted = sortRows(rows);

  // ——— Haupttabelle: Ident + TL-Noten + Punkte/Note/Status ———
  const mainHead = [
    "Nachname",
    "Vorname",
    "Matrikel-Nr.",
    "Studiengang",
    ...tlCols.map((c) => c.header),
    "Punkte",
    "Note",
    "Status",
  ];

  const mainBody = sorted.map((r) => {
    const isNoShow = r.status === "no_show" || r.attended === false;
    let status = shortStatus(r);
    if (r.mergedFromMatriculation) {
      status = `${status} (ZF ${r.mergedFromMatriculation})`;
    }
    const program = resolveProgramCode(r, project);
    const rec = findPointsRecord(project, r.key);
    return [
      pdfText(r.student.lastName),
      pdfText(r.student.firstName),
      pdfText(r.key),
      pdfText(program || "–"),
      ...tlCols.map((c) => c.value(r, rec)),
      isNoShow ? "–" : pdfPoints(r.totalPoints),
      isNoShow ? "–" : pdfGrade(r.finalGrade),
      pdfText(status),
    ];
  });

  const mainColStyles: Record<
    number,
    { cellWidth?: number; halign?: "left" | "right" | "center" }
  > = {
    0: { cellWidth: 28 },
    1: { cellWidth: 24 },
    2: { cellWidth: 26 },
    3: { cellWidth: 20 },
  };
  let ci = 4;
  for (let i = 0; i < tlCols.length; i++) {
    mainColStyles[ci + i] = { cellWidth: 14, halign: "right" };
  }
  ci += tlCols.length;
  mainColStyles[ci] = { cellWidth: 16, halign: "right" };
  mainColStyles[ci + 1] = { cellWidth: 14, halign: "right" };
  mainColStyles[ci + 2] = { cellWidth: 22 };

  autoTable(doc, {
    startY: y + 2,
    head: [mainHead],
    body: mainBody,
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.3 },
    headStyles: {
      fillColor: [68, 112, 153],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: mainColStyles,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  });

  let finalY = getLastTableY(doc, 200);

  // ——— Optionale Rohwert-Tabellen (gechunkt, kein horizontaler Überlauf) ———
  if (includeRaw && rawCols.length > 0) {
    const chunks = chunkColumns(rawCols, RAW_CHUNK);
    let ay = finalY + 10;
    const pageH = doc.internal.pageSize.getHeight();

    if (ay > pageH - 60) {
      doc.addPage();
      ay = PDF_MARGIN + 14;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(pdfText("Rohwerte der Teilkriterien"), PDF_MARGIN, ay);
    ay += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80);
    doc.text(
      pdfText(
        project.portfolioPerLecturerGrading
          ? "Mittel der Korrektoren je Kriterium. Bei vielen Kriterien mehrere Tabellenabschnitte."
          : "Rohwerte je Kriterium. Bei vielen Kriterien mehrere Tabellenabschnitte."
      ),
      PDF_MARGIN,
      ay,
      { maxWidth: 180 }
    );
    doc.setTextColor(0);
    ay += 6;

    chunks.forEach((chunk, chunkIdx) => {
      if (ay > pageH - 50) {
        doc.addPage();
        ay = PDF_MARGIN + 14;
      }
      if (chunks.length > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(
          pdfText(
            `Abschnitt ${chunkIdx + 1} von ${chunks.length} (Kriterien)`
          ),
          PDF_MARGIN,
          ay
        );
        ay += 3;
      }

      const head = [
        "Nachname",
        "Vorname",
        "Matrikel-Nr.",
        ...chunk.map((c) => c.header),
      ];
      const body = sorted.map((r) => {
        const rec = findPointsRecord(project, r.key);
        return [
          pdfText(r.student.lastName),
          pdfText(r.student.firstName),
          pdfText(r.key),
          ...chunk.map((c) => c.value(r, rec)),
        ];
      });

      const critW = Math.min(
        16,
        Math.max(9, Math.floor(120 / Math.max(chunk.length, 1)))
      );
      const colStyles: Record<
        number,
        { cellWidth?: number; halign?: "left" | "right" }
      > = {
        0: { cellWidth: 26 },
        1: { cellWidth: 22 },
        2: { cellWidth: 24 },
      };
      for (let i = 0; i < chunk.length; i++) {
        colStyles[3 + i] = { cellWidth: critW, halign: "right" };
      }

      autoTable(doc, {
        startY: ay + 2,
        head: [head],
        body,
        styles: {
          font: "helvetica",
          fontSize: chunk.length > 7 ? 6.5 : 7,
          cellPadding: 1.1,
        },
        headStyles: {
          fillColor: [68, 112, 153],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 6.5,
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: colStyles,
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      });
      ay = getLastTableY(doc, ay) + 8;
    });
    finalY = ay;
  }

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
  const pageH = doc.internal.pageSize.getHeight();
  if (sigY > pageH - 50) {
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

  savePdf(
    doc,
    `Notenliste_${project.name || "Pruefung"}`,
    pdfFooterFromProject(project)
  );
}
