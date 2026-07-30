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
  isStaManualExam,
} from "@/lib/types";
import {
  autoTable,
  drawKeyValueBlock,
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

function ensureY(doc: jsPDF, y: number, need = 36): number {
  const pageH = doc.internal.pageSize.getHeight();
  if (y + need > pageH - 16) {
    doc.addPage();
    return PDF_MARGIN + 10;
  }
  return y;
}

function sectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureY(doc, y, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(44, 81, 113);
  doc.text(pdfText(title), PDF_MARGIN, y);
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  return y + 5;
}

function criterionScaleLabel(c: AssessmentCriterion): string {
  if (c.scale === "points") {
    return c.maxPoints != null ? `Punkte (max. ${c.maxPoints})` : "Punkte";
  }
  if (c.scale === "percent") return "Prozent";
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

/**
 * Baut ein Leistungs-PDF für genau eine Person (Teilleistungen, Kriterien, …).
 */
export function buildStudentPerformancePdf(
  project: ExamProject,
  row: EnrichedStudentRow
): { doc: jsPDF; baseName: string } {
  const rec = findPointsRecord(project, row.key);
  const { doc, y: y0 } = startPdfWithHeader(
    project,
    "Leistungsnachweis (Einzeln)"
  );
  let y = y0;

  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(80);
  const disclaimer = doc.splitTextToSize(
    pdfText(
      "Interne Auswertung der erfassten Leistungen. Keine amtliche Notenmeldung. " +
        "Personenbezogene Daten vertraulich behandeln."
    ),
    180
  ) as string[];
  for (const line of disclaimer) {
    doc.text(line, PDF_MARGIN, y);
    y += 3.5;
  }
  doc.setTextColor(0);
  doc.setFont("helvetica", "normal");
  y += 4;

  const name = [row.student.lastName, row.student.firstName]
    .filter(Boolean)
    .join(", ");
  const prog = resolveProgramCode(row, project);
  const groupName =
    row.student.groupId && project.studentGroups
      ? project.studentGroups.find((g) => g.id === row.student.groupId)?.name
      : undefined;

  y = sectionTitle(doc, "Person", y);
  y = drawKeyValueBlock(
    doc,
    [
      `Name: ${pdfText(name || "–")}`,
      `Matrikelnummer: ${pdfText(row.key)}`,
      `Studiengang: ${pdfText(prog || "–")}`,
      groupName ? `Gruppe: ${pdfText(groupName)}` : "",
      row.attempt != null ? `Versuch: ${row.attempt}` : "",
      `Status: ${pdfText(STUDENT_STATUS_LABELS[row.status] ?? shortStatus(row))}`,
    ].filter(Boolean),
    y,
    4.5
  );
  y += 2;

  y = sectionTitle(doc, "Prüfung", y);
  y = drawKeyValueBlock(
    doc,
    [
      ...examHeaderLines(project),
      `Prüfungsform: ${pdfText(EXAM_TYPE_LABELS[project.examType] ?? project.examType)}`,
      `Erstellt: ${formatDeDate()}`,
    ],
    y,
    4.5
  );
  y += 2;

  y = sectionTitle(doc, "Ergebnis", y);
  const resultBody: string[][] = [
    ["Gesamtnote (final)", pdfGrade(row.finalGrade)],
    ["Berechnete Note", pdfGrade(row.calculatedGrade)],
    [
      "Manuelle Note",
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
  if (row.status === "no_show" || row.attended === false || rec?.notAttended) {
    resultBody.push(["Antritt", "No-Show / nicht angetreten"]);
  }
  if (rec?.comment?.trim() || row.comment?.trim()) {
    resultBody.push([
      "Kommentar",
      pdfText(rec?.comment?.trim() || row.comment || ""),
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Kennzahl", "Wert"]],
    body: resultBody,
    margin: { left: PDF_MARGIN, right: PDF_MARGIN },
    styles: { fontSize: 9, cellPadding: 1.5 },
    headStyles: { fillColor: [68, 112, 153], textColor: 255 },
    columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: "auto" } },
  });
  y = getLastTableY(doc, y) + 8;

  // Teilgebiete
  if ((project.subAreas?.length ?? 0) > 0) {
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
    if (saBody.some((r) => r[2] !== "–")) {
      y = sectionTitle(doc, "Teilgebiete", y);
      autoTable(doc, {
        startY: y,
        head: [["Kürzel", "Teilgebiet", "Punkte", "Max."]],
        body: saBody,
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
        styles: { fontSize: 8, cellPadding: 1.2 },
        headStyles: { fillColor: [68, 112, 153], textColor: 255 },
      });
      y = getLastTableY(doc, y) + 8;
    }
  }

  // Aufgaben (THE / elektrP / Klausur)
  const qDefs = project.questionDefs ?? [];
  if (qDefs.length > 0 && rec?.byQuestion) {
    const qBody = [...qDefs]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((q) => {
        const v = rec.byQuestion?.[q.id] ?? null;
        return [
          pdfText(q.label),
          pdfPoints(v),
          pdfPoints(q.maxPoints),
        ];
      });
    y = sectionTitle(doc, "Aufgaben / Detailpunkte", y);
    autoTable(doc, {
      startY: y,
      head: [["Aufgabe", "Punkte", "Max."]],
      body: qBody,
      margin: { left: PDF_MARGIN, right: PDF_MARGIN },
      styles: { fontSize: 8, cellPadding: 1.2 },
      headStyles: { fillColor: [68, 112, 153], textColor: 255 },
    });
    y = getLastTableY(doc, y) + 8;
  }

  // StA Kriterien
  if (isStaCriteriaExam(project.examType)) {
    const criteria = project.criteria ?? [];
    if (criteria.length > 0) {
      y = sectionTitle(doc, "Bewertungskriterien (Studienarbeit)", y);
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
      autoTable(doc, {
        startY: y,
        head: [["Kürzel", "Kriterium", "Gew.", "Skala", "Wert"]],
        body,
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
        styles: { fontSize: 8, cellPadding: 1.2 },
        headStyles: { fillColor: [68, 112, 153], textColor: 255 },
      });
      y = getLastTableY(doc, y) + 8;
    }
  }

  // StA manuell – wenig Extra
  if (isStaManualExam(project.examType) && rec?.comment) {
    y = sectionTitle(doc, "Anmerkung", y);
    y = drawKeyValueBlock(doc, [pdfText(rec.comment)], y);
    y += 4;
  }

  // Portfolio
  if (isPortfolioExam(project.examType)) {
    const components = project.portfolioComponents ?? [];
    const lecturers = (project.lecturers ?? [])
      .map((l) => l.trim())
      .filter(Boolean);
    const perLecturer = project.portfolioPerLecturerGrading === true;
    const critMode = project.portfolioCriteriaMode === true;

    if (components.length > 0) {
      y = sectionTitle(doc, "Teilleistungen (Portfolio)", y);
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
      autoTable(doc, {
        startY: y,
        head: [["Kürzel", "Teilleistung", "Gew.", "Note", "%", "Punkte"]],
        body: tlBody,
        margin: { left: PDF_MARGIN, right: PDF_MARGIN },
        styles: { fontSize: 8, cellPadding: 1.2 },
        headStyles: { fillColor: [68, 112, 153], textColor: 255 },
      });
      y = getLastTableY(doc, y) + 8;

      if (perLecturer) {
        for (const c of components) {
          const byL = rec?.portfolioGradesByLecturer?.[c.id] ?? {};
          const hasAny = lecturers.some(
            (l) => byL[l] != null && Number.isFinite(byL[l] as number)
          );
          if (!hasAny && lecturers.length === 0) continue;
          y = sectionTitle(
            doc,
            `Teilnoten je Dozent · ${c.code || c.name}`,
            y
          );
          const body = lecturers.map((l) => [
            pdfText(l),
            pdfGrade(byL[l] ?? null),
          ]);
          autoTable(doc, {
            startY: y,
            head: [["Dozent/in", "Teilnote"]],
            body: body.length ? body : [["–", "–"]],
            margin: { left: PDF_MARGIN, right: PDF_MARGIN },
            styles: { fontSize: 8, cellPadding: 1.2 },
            headStyles: { fillColor: [68, 112, 153], textColor: 255 },
          });
          y = getLastTableY(doc, y) + 6;
        }
      }

      if (critMode) {
        for (const c of components) {
          const crits = c.criteria ?? [];
          if (crits.length === 0) continue;
          y = sectionTitle(
            doc,
            `Kriterien · ${c.code || c.name}`,
            y
          );

          if (perLecturer && lecturers.length > 0) {
            for (const lec of lecturers) {
              const vals =
                rec?.portfolioCriterionValuesByLecturer?.[c.id]?.[lec] ?? {};
              const body = crits.map((cr) => [
                pdfText(cr.code || cr.name),
                pdfText(cr.name),
                pdfText(String(cr.weight ?? 1)),
                pdfText(criterionScaleLabel(cr)),
                formatCriterionRaw(vals[cr.id], cr),
              ]);
              y = ensureY(doc, y, 20);
              doc.setFont("helvetica", "bold");
              doc.setFontSize(9);
              doc.text(pdfText(`Dozent/in: ${lec}`), PDF_MARGIN, y);
              y += 4;
              autoTable(doc, {
                startY: y,
                head: [["Kürzel", "Kriterium", "Gew.", "Skala", "Wert"]],
                body,
                margin: { left: PDF_MARGIN, right: PDF_MARGIN },
                styles: { fontSize: 7.5, cellPadding: 1.1 },
                headStyles: { fillColor: [68, 112, 153], textColor: 255 },
              });
              y = getLastTableY(doc, y) + 5;
            }
          } else {
            const vals = rec?.portfolioCriterionValues?.[c.id] ?? {};
            const body = crits.map((cr) => [
              pdfText(cr.code || cr.name),
              pdfText(cr.name),
              pdfText(String(cr.weight ?? 1)),
              pdfText(criterionScaleLabel(cr)),
              formatCriterionRaw(vals[cr.id], cr),
            ]);
            autoTable(doc, {
              startY: y,
              head: [["Kürzel", "Kriterium", "Gew.", "Skala", "Wert"]],
              body,
              margin: { left: PDF_MARGIN, right: PDF_MARGIN },
              styles: { fontSize: 8, cellPadding: 1.2 },
              headStyles: { fillColor: [68, 112, 153], textColor: 255 },
            });
            y = getLastTableY(doc, y) + 6;
          }
        }
      }
    }
  }

  // Zweitkorrektur falls vorhanden
  if (
    rec?.secondCorrectionPoints != null ||
    rec?.secondCorrectionNotes?.trim()
  ) {
    y = sectionTitle(doc, "Zweitkorrektur", y);
    y = drawKeyValueBlock(
      doc,
      [
        rec.secondCorrectionPoints != null
          ? `Punkte Zweitkorrektur: ${pdfPoints(rec.secondCorrectionPoints)}`
          : "",
        rec.secondCorrectionNotes?.trim()
          ? `Anmerkung: ${pdfText(rec.secondCorrectionNotes.trim())}`
          : "",
      ].filter(Boolean),
      y
    );
  }

  return { doc, baseName: personFileBase(row) };
}

export function exportStudentPerformancePdf(
  project: ExamProject,
  row: EnrichedStudentRow
): void {
  const { doc, baseName } = buildStudentPerformancePdf(project, row);
  savePdf(doc, baseName, pdfFooterFromProject(project));
}

/**
 * Ein oder mehrere Leistungs-PDFs. Bei >1 Person: ZIP mit einem PDF je Person.
 */
export async function exportStudentPerformancePdfs(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  keys: string[]
): Promise<{ count: number; mode: "pdf" | "zip" }> {
  const keySet = new Set(keys);
  const selected = rows.filter((r) => keySet.has(r.key));
  if (selected.length === 0) {
    throw new Error("Keine Person ausgewählt.");
  }

  if (selected.length === 1) {
    exportStudentPerformancePdf(project, selected[0]);
    return { count: 1, mode: "pdf" };
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const row of selected) {
    const { doc, baseName } = buildStudentPerformancePdf(project, row);
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
