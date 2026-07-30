import type {
  AssessmentCriterion,
  EnrichedStudentRow,
  ExamProject,
} from "@/lib/types";
import {
  EXAM_TYPE_LABELS,
  STUDENT_STATUS_LABELS,
  isPortfolioExam,
  isStaCriteriaExam,
} from "@/lib/types";
import {
  autoTable,
  examHeaderLines,
  findPointsRecord,
  formatDeDate,
  getLastTableY,
  pdfDocToBlob,
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
import { datedExportFilename, formatPoints } from "@/lib/utils";
import {
  downloadBlob,
  sanitizeDownloadFilename,
} from "@/lib/download";
import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";

/** Wählbare Inhaltsblöcke im Leistungs-PDF */
export type StudentPerformanceSectionId =
  | "person"
  | "exam"
  | "result"
  | "subAreas"
  | "questions"
  | "staCriteria"
  | "portfolioTl"
  | "portfolioLecturer"
  | "portfolioCriteria"
  | "secondCorrection"
  | "comment";

export type StudentPerformancePdfOptions = {
  sections: Partial<Record<StudentPerformanceSectionId, boolean>>;
};

export type StudentPerformanceSectionMeta = {
  id: StudentPerformanceSectionId;
  label: string;
  /** Kurzhinweis in der UI */
  hint?: string;
  /** Immer im PDF (nicht abwählbar) */
  required?: boolean;
};

const TABLE_HEAD: [number, number, number] = [68, 112, 153];
const SECTION_COLOR: [number, number, number] = [44, 81, 113];

const baseTable: Partial<UserOptions> = {
  margin: { left: PDF_MARGIN, right: PDF_MARGIN },
  styles: {
    fontSize: 8,
    cellPadding: { top: 1.1, right: 1.4, bottom: 1.1, left: 1.4 },
    lineColor: [220, 226, 232],
    lineWidth: 0.15,
    textColor: [30, 35, 40],
    overflow: "linebreak",
  },
  headStyles: {
    fillColor: TABLE_HEAD,
    textColor: 255,
    fontStyle: "bold",
    fontSize: 8,
    cellPadding: { top: 1.3, right: 1.4, bottom: 1.3, left: 1.4 },
  },
  alternateRowStyles: { fillColor: [248, 250, 252] },
  theme: "grid",
};

function ensureY(doc: jsPDF, y: number, need = 28): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need > pageH - 14) {
    doc.addPage();
    return PDF_MARGIN + 8;
  }
  return y;
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureY(doc, y, 12);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...SECTION_COLOR);
  doc.text(pdfText(title), PDF_MARGIN, y);
  const w = doc.getTextWidth(pdfText(title));
  doc.setDrawColor(...TABLE_HEAD);
  doc.setLineWidth(0.35);
  doc.line(PDF_MARGIN, y + 1.2, PDF_MARGIN + Math.max(w, 28), y + 1.2);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  return y + 4.5;
}

function tableY(doc: jsPDF, y: number, opts: UserOptions): number {
  autoTable(doc, {
    ...baseTable,
    startY: y,
    ...opts,
    styles: { ...baseTable.styles, ...opts.styles },
    headStyles: { ...baseTable.headStyles, ...opts.headStyles },
  });
  return getLastTableY(doc, y) + 4.5;
}

function criterionScaleLabel(c: AssessmentCriterion): string {
  if (c.scale === "points") {
    return c.maxPoints != null ? `P (max ${c.maxPoints})` : "Punkte";
  }
  if (c.scale === "percent") return "%";
  return "Note";
}

function formatCriterionRaw(
  v: number | null | undefined,
  c: AssessmentCriterion
): string {
  if (v == null || !Number.isFinite(v)) return "–";
  if (c.scale === "grade") return pdfGrade(v);
  if (c.scale === "percent") return `${pdfText(formatPoints(v, 1))} %`;
  return pdfPoints(v);
}

function personFileBase(row: EnrichedStudentRow): string {
  const name = [row.student.lastName, row.student.firstName]
    .filter(Boolean)
    .join("_")
    .replace(/\s+/g, "_");
  return sanitizeDownloadFilename(
    `Leistung_${name || "Person"}_${row.key || "ohne-Matr"}`
  );
}

function on(
  sections: StudentPerformancePdfOptions["sections"],
  id: StudentPerformanceSectionId
): boolean {
  return sections[id] !== false;
}

/** Welche Abschnitte für diese Prüfung sinnvoll sind (UI). */
export function availableStudentPerformanceSections(
  project: ExamProject
): StudentPerformanceSectionMeta[] {
  const list: StudentPerformanceSectionMeta[] = [
    {
      id: "person",
      label: "Person",
      hint: "Name, Matrikel, Studiengang, Status",
      required: true,
    },
    {
      id: "exam",
      label: "Prüfung",
      hint: "Modul, Semester, Prüfer, Bestehensgrenze",
    },
    {
      id: "result",
      label: "Ergebnis",
      hint: "Note, Punkte, Prozent",
      required: true,
    },
    {
      id: "comment",
      label: "Kommentar / Anmerkung",
    },
  ];

  if ((project.subAreas?.length ?? 0) > 0) {
    list.push({
      id: "subAreas",
      label: "Teilgebiete",
      hint: "Punkte je Teilgebiet",
    });
  }
  if ((project.questionDefs?.length ?? 0) > 0) {
    list.push({
      id: "questions",
      label: "Aufgaben / Detailpunkte",
      hint: "Punkte je Aufgabe",
    });
  }
  if (isStaCriteriaExam(project.examType) && (project.criteria?.length ?? 0) > 0) {
    list.push({
      id: "staCriteria",
      label: "StA-Kriterien",
      hint: "Rohwerte und Gewichte",
    });
  }
  if (isPortfolioExam(project.examType)) {
    list.push({
      id: "portfolioTl",
      label: "Teilleistungen",
      hint: "Teilnoten und Gewichte",
    });
    if (project.portfolioPerLecturerGrading) {
      list.push({
        id: "portfolioLecturer",
        label: "Teilnoten je Dozent",
      });
    }
    if (project.portfolioCriteriaMode) {
      list.push({
        id: "portfolioCriteria",
        label: "Portfolio-Kriterien",
        hint: "Rohwerte je Teilleistung",
      });
    }
  }
  list.push({
    id: "secondCorrection",
    label: "Zweitkorrektur",
    hint: "Nur wenn erfasst",
  });
  return list;
}

export function defaultStudentPerformanceSections(
  project: ExamProject
): Record<StudentPerformanceSectionId, boolean> {
  const out = {} as Record<StudentPerformanceSectionId, boolean>;
  for (const s of availableStudentPerformanceSections(project)) {
    out[s.id] = true;
  }
  return out;
}

/**
 * Baut ein Leistungs-PDF für genau eine Person.
 */
export function buildStudentPerformancePdf(
  project: ExamProject,
  row: EnrichedStudentRow,
  options?: StudentPerformancePdfOptions
): { doc: jsPDF; baseName: string } {
  const sections =
    options?.sections ?? defaultStudentPerformanceSections(project);
  const rec = findPointsRecord(project, row.key);
  const { doc, y: y0 } = startPdfWithHeader(
    project,
    "Leistungsnachweis (Einzeln)"
  );
  let y = y0;

  // Kompakter Hinweis in einer Zeile
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(100);
  doc.text(
    pdfText(
      `Interne Auswertung · keine amtliche Notenmeldung · vertraulich · ${formatDeDate()}`
    ),
    PDF_MARGIN,
    y
  );
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  y += 5;

  const name = [row.student.lastName, row.student.firstName]
    .filter(Boolean)
    .join(", ");
  const prog = resolveProgramCode(row, project);
  const groupName =
    row.student.groupId && project.studentGroups
      ? project.studentGroups.find((g) => g.id === row.student.groupId)?.name
      : undefined;

  // —— Person + Prüfung als kompakte 4-Spalten-Meta ——
  if (on(sections, "person") || on(sections, "exam")) {
    y = sectionTitle(doc, "Stammdaten", y);
    const metaRows: string[][] = [];
    if (on(sections, "person")) {
      metaRows.push(["Name", pdfText(name || "–"), "Matr.-Nr.", pdfText(row.key)]);
      metaRows.push([
        "Studiengang",
        pdfText(prog || "–"),
        "Status",
        pdfText(STUDENT_STATUS_LABELS[row.status] ?? shortStatus(row)),
      ]);
      if (groupName || row.attempt != null) {
        metaRows.push([
          "Gruppe",
          pdfText(groupName || "–"),
          "Versuch",
          row.attempt != null ? String(row.attempt) : "–",
        ]);
      }
    }
    if (on(sections, "exam")) {
      metaRows.push([
        "Prüfung",
        pdfText(project.name || "–"),
        "Form",
        pdfText(EXAM_TYPE_LABELS[project.examType] ?? project.examType),
      ]);
      metaRows.push([
        "Semester",
        pdfText(project.semester || "–"),
        "Prüfungsnr.",
        pdfText(project.examNumber || "–"),
      ]);
      const lecturers = (project.lecturers ?? [])
        .map((l) => l.trim())
        .filter(Boolean)
        .join(", ");
      // Bestehensgrenze aus examHeaderLines-Logik
      const passLine =
        examHeaderLines(project).find((l) => l.startsWith("Bestehensgrenze")) ??
        "";
      metaRows.push([
        "Prüfer",
        pdfText(lecturers || "–"),
        "Bestehen",
        pdfText(passLine.replace(/^Bestehensgrenze:\s*/i, "") || "–"),
      ]);
    }
    y = tableY(doc, y, {
      head: [["Feld", "Wert", "Feld", "Wert"]],
      body: metaRows,
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold", textColor: [70, 80, 90] },
        1: { cellWidth: 58 },
        2: { cellWidth: 28, fontStyle: "bold", textColor: [70, 80, 90] },
        3: { cellWidth: 58 },
      },
      showHead: "never",
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.2, right: 1.5, bottom: 1.2, left: 1.5 },
      },
    });
  }

  // —— Ergebnis ——
  if (on(sections, "result")) {
    y = sectionTitle(doc, "Ergebnis", y);
    const resultBody: string[][] = [
      ["Gesamtnote", pdfGrade(row.finalGrade)],
      ["Berechnet", pdfGrade(row.calculatedGrade)],
      [
        "Manuell",
        row.gradeOverride != null ? pdfGrade(row.gradeOverride) : "–",
      ],
    ];
    if (row.totalPoints != null && Number.isFinite(row.totalPoints)) {
      resultBody.push(["Punkte / Erfüllung", pdfPoints(row.totalPoints)]);
    }
    if (row.percent != null && Number.isFinite(row.percent)) {
      resultBody.push([
        "Prozent",
        `${pdfText(formatPoints(row.percent * 100, 1))} %`,
      ]);
    }
    if (
      row.status === "no_show" ||
      row.attended === false ||
      rec?.notAttended
    ) {
      resultBody.push(["Antritt", "No-Show / nicht angetreten"]);
    }

    // Ergebnis kompakt: 2 Kennzahlen nebeneinander
    const paired: string[][] = [];
    for (let i = 0; i < resultBody.length; i += 2) {
      const a = resultBody[i];
      const b = resultBody[i + 1];
      paired.push([
        a[0],
        a[1],
        b ? b[0] : "",
        b ? b[1] : "",
      ]);
    }
    y = tableY(doc, y, {
      body: paired,
      showHead: "never",
      columnStyles: {
        0: { cellWidth: 36, fontStyle: "bold", textColor: [70, 80, 90] },
        1: { cellWidth: 28, fontStyle: "bold", fontSize: 10 },
        2: { cellWidth: 36, fontStyle: "bold", textColor: [70, 80, 90] },
        3: { cellWidth: 28, fontStyle: "bold", fontSize: 10 },
      },
    });
  }

  // —— Kommentar ——
  const commentText = (
    rec?.comment?.trim() ||
    row.comment?.trim() ||
    ""
  ).trim();
  if (on(sections, "comment") && commentText) {
    y = sectionTitle(doc, "Kommentar", y);
    y = tableY(doc, y, {
      body: [[pdfText(commentText)]],
      showHead: "never",
      styles: { fontSize: 8, cellPadding: 2 },
    });
  }

  // —— Teilgebiete ——
  if (on(sections, "subAreas") && (project.subAreas?.length ?? 0) > 0) {
    const saBody = project.subAreas.map((sa) => {
      const pts =
        row.subAreaPoints?.[sa.id] ?? rec?.bySubArea?.[sa.id] ?? null;
      return [
        pdfText(sa.code || sa.name),
        pdfText(sa.name),
        pdfPoints(pts),
        sa.maxPoints != null ? pdfPoints(sa.maxPoints) : "–",
      ];
    });
    if (saBody.some((r) => r[2] !== "–") || saBody.length > 0) {
      y = sectionTitle(doc, "Teilgebiete", y);
      y = tableY(doc, y, {
        head: [["Kürzel", "Teilgebiet", "Punkte", "Max."]],
        body: saBody,
        columnStyles: {
          0: { cellWidth: 22 },
          2: { cellWidth: 22, halign: "right" },
          3: { cellWidth: 22, halign: "right" },
        },
      });
    }
  }

  // —— Aufgaben ——
  const qDefs = project.questionDefs ?? [];
  if (on(sections, "questions") && qDefs.length > 0) {
    const qBody = [...qDefs]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((q) => [
        pdfText(q.label),
        pdfPoints(rec?.byQuestion?.[q.id] ?? null),
        pdfPoints(q.maxPoints),
      ]);
    y = sectionTitle(doc, "Aufgaben / Detailpunkte", y);
    y = tableY(doc, y, {
      head: [["Aufgabe", "Punkte", "Max."]],
      body: qBody,
      columnStyles: {
        1: { cellWidth: 24, halign: "right" },
        2: { cellWidth: 24, halign: "right" },
      },
    });
  }

  // —— StA Kriterien ——
  if (on(sections, "staCriteria") && isStaCriteriaExam(project.examType)) {
    const criteria = project.criteria ?? [];
    if (criteria.length > 0) {
      y = sectionTitle(doc, "Bewertungskriterien", y);
      const body = criteria.map((c) => {
        const raw = rec?.criterionValues?.[c.id] ?? null;
        return [
          pdfText(c.code || c.name),
          pdfText(c.name),
          pdfText(String(c.weight ?? 1)),
          pdfText(criterionScaleLabel(c)),
          formatCriterionRaw(raw, c),
        ];
      });
      y = tableY(doc, y, {
        head: [["Kürzel", "Kriterium", "Gew.", "Skala", "Wert"]],
        body,
        columnStyles: {
          0: { cellWidth: 18 },
          2: { cellWidth: 14, halign: "right" },
          3: { cellWidth: 26 },
          4: { cellWidth: 22, halign: "right" },
        },
      });
    }
  }

  // —— Portfolio ——
  if (isPortfolioExam(project.examType)) {
    const components = project.portfolioComponents ?? [];
    const lecturers = (project.lecturers ?? [])
      .map((l) => l.trim())
      .filter(Boolean);
    const perLecturer = project.portfolioPerLecturerGrading === true;
    const critMode = project.portfolioCriteriaMode === true;

    if (on(sections, "portfolioTl") && components.length > 0) {
      y = sectionTitle(doc, "Teilleistungen", y);
      const tlBody = components.map((c) => {
        const d = row.portfolioComponentDetails?.[c.id];
        const g =
          d?.grade ??
          row.portfolioComponentGrades?.[c.id] ??
          rec?.portfolioGrades?.[c.id] ??
          null;
        const pct =
          d?.percent != null
            ? `${pdfText(formatPoints(d.percent * 100, 1))} %`
            : "–";
        const raw =
          d?.pointsRaw != null && d?.pointsMax != null
            ? `${pdfPoints(d.pointsRaw)} / ${pdfPoints(d.pointsMax)}`
            : "–";
        return [
          pdfText(c.code || c.name),
          pdfText(c.name),
          pdfText(String(c.weight ?? 1)),
          pdfGrade(g),
          pct,
          raw,
        ];
      });
      y = tableY(doc, y, {
        head: [["Kürzel", "Teilleistung", "Gew.", "Note", "%", "Punkte"]],
        body: tlBody,
        columnStyles: {
          0: { cellWidth: 18 },
          2: { cellWidth: 14, halign: "right" },
          3: { cellWidth: 16, halign: "right", fontStyle: "bold" },
          4: { cellWidth: 18, halign: "right" },
          5: { cellWidth: 28, halign: "right" },
        },
      });
    }

    if (on(sections, "portfolioLecturer") && perLecturer && components.length) {
      // Eine Tabelle: TL × Dozenten
      const head = ["Teilleistung", ...lecturers.map((l) => pdfText(l).slice(0, 18))];
      const body = components.map((c) => {
        const byL = rec?.portfolioGradesByLecturer?.[c.id] ?? {};
        return [
          pdfText(c.code || c.name),
          ...lecturers.map((l) => pdfGrade(byL[l] ?? null)),
        ];
      });
      const hasAny = body.some((r) => r.slice(1).some((v) => v !== "–"));
      if (hasAny || lecturers.length > 0) {
        y = sectionTitle(doc, "Teilnoten je Dozent", y);
        y = tableY(doc, y, {
          head: [head],
          body,
          styles: { fontSize: 7.5 },
        });
      }
    }

    if (on(sections, "portfolioCriteria") && critMode) {
      for (const c of components) {
        const crits = c.criteria ?? [];
        if (crits.length === 0) continue;

        if (perLecturer && lecturers.length > 0) {
          y = sectionTitle(doc, `Kriterien · ${c.code || c.name}`, y);
          // flache Tabelle: Dozent | Kürzel | Name | Gew | Skala | Wert
          const body: string[][] = [];
          for (const lec of lecturers) {
            const vals =
              rec?.portfolioCriterionValuesByLecturer?.[c.id]?.[lec] ?? {};
            for (const cr of crits) {
              body.push([
                pdfText(lec),
                pdfText(cr.code || cr.name),
                pdfText(cr.name),
                pdfText(String(cr.weight ?? 1)),
                pdfText(criterionScaleLabel(cr)),
                formatCriterionRaw(vals[cr.id], cr),
              ]);
            }
          }
          y = tableY(doc, y, {
            head: [["Dozent/in", "Kürzel", "Kriterium", "Gew.", "Skala", "Wert"]],
            body,
            styles: { fontSize: 7 },
            columnStyles: {
              0: { cellWidth: 32 },
              1: { cellWidth: 16 },
              3: { cellWidth: 12, halign: "right" },
              4: { cellWidth: 22 },
              5: { cellWidth: 18, halign: "right" },
            },
          });
        } else {
          y = sectionTitle(doc, `Kriterien · ${c.code || c.name}`, y);
          const vals = rec?.portfolioCriterionValues?.[c.id] ?? {};
          const body = crits.map((cr) => [
            pdfText(cr.code || cr.name),
            pdfText(cr.name),
            pdfText(String(cr.weight ?? 1)),
            pdfText(criterionScaleLabel(cr)),
            formatCriterionRaw(vals[cr.id], cr),
          ]);
          y = tableY(doc, y, {
            head: [["Kürzel", "Kriterium", "Gew.", "Skala", "Wert"]],
            body,
            columnStyles: {
              0: { cellWidth: 18 },
              2: { cellWidth: 14, halign: "right" },
              3: { cellWidth: 26 },
              4: { cellWidth: 22, halign: "right" },
            },
          });
        }
      }
    }
  }

  // —— Zweitkorrektur ——
  if (
    on(sections, "secondCorrection") &&
    (rec?.secondCorrectionPoints != null ||
      rec?.secondCorrectionNotes?.trim())
  ) {
    y = sectionTitle(doc, "Zweitkorrektur", y);
    const body: string[][] = [];
    if (rec.secondCorrectionPoints != null) {
      body.push(["Punkte", pdfPoints(rec.secondCorrectionPoints)]);
    }
    if (rec.secondCorrectionNotes?.trim()) {
      body.push(["Anmerkung", pdfText(rec.secondCorrectionNotes.trim())]);
    }
    y = tableY(doc, y, {
      body,
      showHead: "never",
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold", textColor: [70, 80, 90] },
      },
    });
  }

  return { doc, baseName: personFileBase(row) };
}

export function exportStudentPerformancePdf(
  project: ExamProject,
  row: EnrichedStudentRow,
  options?: StudentPerformancePdfOptions
): void {
  const { doc, baseName } = buildStudentPerformancePdf(project, row, options);
  savePdf(doc, baseName, pdfFooterFromProject(project));
}

/**
 * Ein oder mehrere Leistungs-PDFs. Bei >1 Person: ZIP mit einem PDF je Person.
 */
export async function exportStudentPerformancePdfs(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  keys: string[],
  options?: StudentPerformancePdfOptions
): Promise<{ count: number; mode: "pdf" | "zip" }> {
  const keySet = new Set(keys);
  const selected = rows.filter((r) => keySet.has(r.key));
  if (selected.length === 0) {
    throw new Error("Keine Person ausgewählt.");
  }

  if (selected.length === 1) {
    exportStudentPerformancePdf(project, selected[0], options);
    return { count: 1, mode: "pdf" };
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const row of selected) {
    const { doc, baseName } = buildStudentPerformancePdf(
      project,
      row,
      options
    );
    const blob = pdfDocToBlob(doc, pdfFooterFromProject(project));
    let fileName = `${baseName}.pdf`;
    let n = 2;
    while (usedNames.has(fileName.toLowerCase())) {
      fileName = `${baseName}_${n}.pdf`;
      n += 1;
    }
    usedNames.add(fileName.toLowerCase());
    zip.file(fileName, blob);
  }

  const zipBlob = await zip.generateAsync({ type: "blob" });
  const zipBase = sanitizeDownloadFilename(
    `Leistungsnachweise_${project.name || "Pruefung"}_${selected.length}`
  );
  await downloadBlob(datedExportFilename(zipBase, "zip"), zipBlob);
  return { count: selected.length, mode: "zip" };
}
