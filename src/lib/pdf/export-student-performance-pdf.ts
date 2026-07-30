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
  PDF_CONTENT_WIDTH,
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
import {
  cohortGradesFromRows,
  computeStudentGradeRank,
  renderStudentGradeContextChartPng,
} from "@/lib/charts/student-grade-context-chart";
import { computeStatistics } from "@/lib/grades/statistics";
import {
  criterionPointsTotalsPartial,
  gradeFromUnitAvg,
  resolveComponentCriteriaScale,
  unitAvgFromCriterionValuesPartial,
} from "@/lib/grades/portfolio";
import type { jsPDF } from "jspdf";
import type { UserOptions } from "jspdf-autotable";

/** Wählbare Inhaltsblöcke im Leistungs-PDF */
export type StudentPerformanceSectionId =
  | "person"
  | "exam"
  | "result"
  | "gradeChart"
  | "subAreas"
  | "questions"
  | "staCriteria"
  | "portfolioTl"
  | "portfolioCriteria"
  | "secondCorrection"
  | "comment";

export type StudentPerformancePdfOptions = {
  sections: Partial<Record<StudentPerformanceSectionId, boolean>>;
};

export type StudentPerformanceSectionMeta = {
  id: StudentPerformanceSectionId;
  label: string;
  hint?: string;
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

function pageBottom(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - 14;
}

function ensureY(doc: jsPDF, y: number, need = 28): number {
  if (y + need > pageBottom(doc)) {
    doc.addPage();
    return PDF_MARGIN + 8;
  }
  return y;
}

/**
 * Abschnittsüberschrift nur, wenn Titel + Mindestkörper noch auf die Seite passen
 * (kein alleinstehender Titel am Seitenende).
 */
function beginSection(
  doc: jsPDF,
  title: string,
  y: number,
  /** Mindestplatz unter dem Titel für erste Inhaltszeilen (mm) */
  minBodyMm = 22
): number {
  const titleBlock = 8;
  y = ensureY(doc, y, titleBlock + minBodyMm);
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
  // Genug Platz für Kopfzeile + erste Datenzeile
  y = ensureY(doc, y, 18);
  autoTable(doc, {
    ...baseTable,
    startY: y,
    ...opts,
    styles: { ...baseTable.styles, ...opts.styles },
    headStyles: { ...baseTable.headStyles, ...opts.headStyles },
    // Kopf auf Folgeseiten wiederholen, wenn die Tabelle umbricht
    showHead: opts.showHead ?? "everyPage",
  });
  return getLastTableY(doc, y) + 4.5;
}

/** Teilnote / % / Punkte aus (ggf. unvollständigen) Kriterien für PDF-Anzeige. */
function resolveTlDisplayForPdf(
  project: ExamProject,
  rec: ReturnType<typeof findPointsRecord>,
  componentId: string,
  enriched?: {
    grade: number | null;
    percent: number | null;
    pointsRaw?: number | null;
    pointsMax?: number | null;
  } | null,
  directGrade?: number | null
): {
  grade: number | null;
  percent: number | null;
  pointsRaw: number | null;
  pointsMax: number | null;
  partial: boolean;
} {
  if (
    enriched?.grade != null &&
    Number.isFinite(enriched.grade)
  ) {
    return {
      grade: enriched.grade,
      percent: enriched.percent ?? null,
      pointsRaw: enriched.pointsRaw ?? null,
      pointsMax: enriched.pointsMax ?? null,
      partial: false,
    };
  }
  if (directGrade != null && Number.isFinite(directGrade)) {
    return {
      grade: directGrade,
      percent: enriched?.percent ?? null,
      pointsRaw: enriched?.pointsRaw ?? null,
      pointsMax: enriched?.pointsMax ?? null,
      partial: false,
    };
  }

  const components = project.portfolioComponents ?? [];
  const c = components.find((x) => x.id === componentId);
  if (!c || project.portfolioCriteriaMode !== true) {
    return {
      grade: null,
      percent: null,
      pointsRaw: null,
      pointsMax: null,
      partial: false,
    };
  }

  const scale = resolveComponentCriteriaScale(c);
  const crits = (c.criteria ?? []).map((k) => ({ ...k, scale }));
  const lecturers = (project.lecturers ?? [])
    .map((l) => l.trim())
    .filter(Boolean);

  let unit: number | null = null;
  let pointsRaw: number | null = null;
  let pointsMax: number | null = null;
  let filled = 0;
  let total = crits.length;

  if (!project.portfolioPerLecturerGrading) {
    const vals = rec?.portfolioCriterionValues?.[c.id];
    unit = unitAvgFromCriterionValuesPartial(vals, crits);
    for (const cr of crits) {
      if (vals?.[cr.id] != null && Number.isFinite(vals[cr.id] as number)) {
        filled += 1;
      }
    }
    const tot = criterionPointsTotalsPartial(vals, crits);
    if (tot) {
      pointsRaw = tot.raw;
      pointsMax = tot.max;
    }
  } else if (lecturers.length) {
    let uAcc = 0;
    let uN = 0;
    let rAcc = 0;
    let mAcc = 0;
    let tN = 0;
    for (const name of lecturers) {
      const vals =
        rec?.portfolioCriterionValuesByLecturer?.[c.id]?.[name] ?? {};
      const u = unitAvgFromCriterionValuesPartial(vals, crits);
      if (u != null) {
        uAcc += u;
        uN += 1;
      }
      for (const cr of crits) {
        if (vals[cr.id] != null && Number.isFinite(vals[cr.id] as number)) {
          filled += 1;
        }
      }
      total = crits.length * lecturers.length;
      const tot = criterionPointsTotalsPartial(vals, crits);
      if (tot) {
        rAcc += tot.raw;
        mAcc += tot.max;
        tN += 1;
      }
    }
    if (uN > 0) unit = uAcc / uN;
    if (tN > 0) {
      pointsRaw = Math.round((rAcc / tN) * 100) / 100;
      pointsMax = Math.round((mAcc / tN) * 100) / 100;
    }
  }

  if (unit == null) {
    return {
      grade: null,
      percent: null,
      pointsRaw,
      pointsMax,
      partial: filled > 0 && filled < total,
    };
  }

  const grade = gradeFromUnitAvg(unit, scale, project.gradeSchema);
  return {
    grade,
    percent: unit,
    pointsRaw,
    pointsMax,
    partial: filled > 0 && filled < total,
  };
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

function shortLecturer(name: string, index: number, total: number): string {
  const t = pdfText(name).trim();
  if (total <= 2) return t.length > 22 ? `${t.slice(0, 20)}…` : t;
  // Nachname oder Kürzel
  const parts = t.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    return last.length > 14 ? `${last.slice(0, 12)}…` : last;
  }
  return t.length > 14 ? `${t.slice(0, 12)}…` : t || `D${index + 1}`;
}

/** Mehr als ein inhaltliches Teilgebiet (nicht nur Platzhalter „Gesamt“). */
function hasMeaningfulSubAreas(project: ExamProject): boolean {
  const sas = project.subAreas ?? [];
  if (sas.length > 1) return true;
  if (sas.length === 1) {
    const n = (sas[0].name || "").trim().toLowerCase();
    const c = (sas[0].code || "").trim().toLowerCase();
    if (n === "gesamt" || c === "g" || c === "ges") return false;
    return true;
  }
  return false;
}

function hasQuestionData(project: ExamProject): boolean {
  return (project.questionDefs?.length ?? 0) > 0;
}

function hasSecondCorrectionAnywhere(project: ExamProject): boolean {
  return (project.points ?? []).some(
    (p) =>
      (p.secondCorrectionPoints != null &&
        Number.isFinite(p.secondCorrectionPoints)) ||
      Boolean(p.secondCorrectionNotes?.trim())
  );
}

function hasCommentsAnywhere(project: ExamProject): boolean {
  return (project.points ?? []).some((p) => Boolean(p.comment?.trim()));
}

function lecturersList(project: ExamProject): string[] {
  return (project.lecturers ?? []).map((l) => l.trim()).filter(Boolean);
}

/** Welche Abschnitte für diese Prüfung sinnvoll sind (UI + Defaults). */
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
      id: "gradeChart",
      label: "Notenverteilung",
      hint: "Kohorte mit Ihrer Note und Top-%",
    },
  ];

  if (hasCommentsAnywhere(project)) {
    list.push({ id: "comment", label: "Kommentar / Anmerkung" });
  }
  if (hasMeaningfulSubAreas(project)) {
    list.push({
      id: "subAreas",
      label: "Teilgebiete",
      hint: "Punkte je Teilgebiet",
    });
  }
  if (hasQuestionData(project)) {
    list.push({
      id: "questions",
      label: "Aufgaben / Detailpunkte",
      hint: "Punkte je Aufgabe",
    });
  }
  if (
    isStaCriteriaExam(project.examType) &&
    (project.criteria?.length ?? 0) > 0
  ) {
    list.push({
      id: "staCriteria",
      label: "StA-Kriterien",
      hint: "Rohwerte und Gewichte",
    });
  }
  if (
    isPortfolioExam(project.examType) &&
    (project.portfolioComponents?.length ?? 0) > 0
  ) {
    list.push({
      id: "portfolioTl",
      label: "Teilleistungen",
      hint: project.portfolioPerLecturerGrading
        ? "Teilnoten inkl. Spalten je Dozent"
        : "Teilnoten und Gewichte",
    });
    if (project.portfolioCriteriaMode) {
      list.push({
        id: "portfolioCriteria",
        label: "Portfolio-Kriterien",
        hint: project.portfolioPerLecturerGrading
          ? "Kriterien mit Dozenten-Spalten"
          : "Rohwerte je Teilleistung",
      });
    }
  }
  if (hasSecondCorrectionAnywhere(project)) {
    list.push({
      id: "secondCorrection",
      label: "Zweitkorrektur",
      hint: "Nur wenn für die Person erfasst",
    });
  }
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
 * @param allRows Kohorte für Notenverteilung / Rang
 */
export function buildStudentPerformancePdf(
  project: ExamProject,
  row: EnrichedStudentRow,
  options?: StudentPerformancePdfOptions,
  allRows?: EnrichedStudentRow[]
): { doc: jsPDF; baseName: string } {
  const sections =
    options?.sections ?? defaultStudentPerformanceSections(project);
  const rec = findPointsRecord(project, row.key);
  const cohort = allRows ?? [row];
  const { doc, y: y0 } = startPdfWithHeader(
    project,
    "Leistungsnachweis (Einzeln)"
  );
  let y = y0;

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
  const lecturers = lecturersList(project);
  const perLecturer =
    isPortfolioExam(project.examType) &&
    project.portfolioPerLecturerGrading === true &&
    lecturers.length > 0;

  // —— Stammdaten ——
  if (on(sections, "person") || on(sections, "exam")) {
    y = beginSection(doc, "Stammdaten", y, 28);
    const metaRows: string[][] = [];
    if (on(sections, "person")) {
      metaRows.push([
        "Name",
        pdfText(name || "–"),
        "Matr.-Nr.",
        pdfText(row.key),
      ]);
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
      const passLine =
        examHeaderLines(project).find((l) => l.startsWith("Bestehensgrenze")) ??
        "";
      metaRows.push([
        "Prüfer",
        pdfText(lecturers.join(", ") || "–"),
        "Bestehen",
        pdfText(passLine.replace(/^Bestehensgrenze:\s*/i, "") || "–"),
      ]);
    }
    y = tableY(doc, y, {
      body: metaRows,
      showHead: "never",
      columnStyles: {
        0: { cellWidth: 28, fontStyle: "bold", textColor: [70, 80, 90] },
        1: { cellWidth: 58 },
        2: { cellWidth: 28, fontStyle: "bold", textColor: [70, 80, 90] },
        3: { cellWidth: 58 },
      },
    });
  }

  // —— Ergebnis ——
  if (on(sections, "result")) {
    y = beginSection(doc, "Ergebnis", y, 22);
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

    const paired: string[][] = [];
    for (let i = 0; i < resultBody.length; i += 2) {
      const a = resultBody[i];
      const b = resultBody[i + 1];
      paired.push([a[0], a[1], b ? b[0] : "", b ? b[1] : ""]);
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

  // —— Notenverteilung ——
  if (on(sections, "gradeChart")) {
    const grades = cohortGradesFromRows(cohort);
    const rankInfo = computeStudentGradeRank(row.finalGrade, grades);
    if (grades.length >= 2 && rankInfo) {
      const chartH = 52;
      y = beginSection(doc, "Einordnung in der Kohorte", y, chartH + 10);
      try {
        const stats = computeStatistics(
          cohort,
          project.gradeSchema,
          undefined,
          project
        );
        const png = renderStudentGradeContextChartPng({
          distribution: stats.gradeDistribution,
          studentGrade: rankInfo.studentGrade,
          rankInfo,
          averageGrade: stats.averageGrade,
          width: 1200,
          height: 400,
          scale: 2,
        });
        doc.addImage(png, "PNG", PDF_MARGIN, y, PDF_CONTENT_WIDTH, chartH);
        y += chartH + 3;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(50);
        doc.text(
          pdfText(
            `Note ${pdfGrade(rankInfo.studentGrade)} · unter den besten ${rankInfo.topPercent} % der bewerteten Kohorte (Rang ${rankInfo.rank} von ${rankInfo.total}).`
          ),
          PDF_MARGIN,
          y
        );
        doc.setTextColor(0);
        y += 6;
      } catch {
        y = tableY(doc, y, {
          body: [
            [
              pdfText(
                `Note ${pdfGrade(rankInfo.studentGrade)} · unter den besten ${rankInfo.topPercent} % (Rang ${rankInfo.rank}/${rankInfo.total}). Diagramm nicht verfügbar.`
              ),
            ],
          ],
          showHead: "never",
        });
      }
    }
  }

  // —— Kommentar ——
  const commentText = (
    rec?.comment?.trim() ||
    row.comment?.trim() ||
    ""
  ).trim();
  if (on(sections, "comment") && commentText) {
    y = beginSection(doc, "Kommentar", y, 16);
    y = tableY(doc, y, {
      body: [[pdfText(commentText)]],
      showHead: "never",
      styles: { fontSize: 8, cellPadding: 2 },
    });
  }

  // —— Teilgebiete (nur wenn sinnvoll) ——
  if (on(sections, "subAreas") && hasMeaningfulSubAreas(project)) {
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
    const hasPts = saBody.some((r) => r[2] !== "–");
    if (hasPts) {
      y = beginSection(doc, "Teilgebiete", y, 20);
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
    if (qBody.some((r) => r[1] !== "–") || rec?.byQuestion) {
      y = beginSection(doc, "Aufgaben / Detailpunkte", y, 20);
      y = tableY(doc, y, {
        head: [["Aufgabe", "Punkte", "Max."]],
        body: qBody,
        columnStyles: {
          1: { cellWidth: 24, halign: "right" },
          2: { cellWidth: 24, halign: "right" },
        },
      });
    }
  }

  // —— StA Kriterien ——
  if (on(sections, "staCriteria") && isStaCriteriaExam(project.examType)) {
    const criteria = project.criteria ?? [];
    if (criteria.length > 0) {
      y = beginSection(doc, "Bewertungskriterien", y, 20);
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
    const critMode = project.portfolioCriteriaMode === true;

    if (on(sections, "portfolioTl") && components.length > 0) {
      y = beginSection(doc, "Teilleistungen", y, 24);

      const lecHeads = perLecturer
        ? lecturers.map((l, i) => shortLecturer(l, i, lecturers.length))
        : [];

      const head = [
        "Kürzel",
        "Teilleistung",
        "Gew.",
        "Note",
        "%",
        "Punkte",
        ...lecHeads,
      ];

      const tlBody = components.map((c) => {
        const d = row.portfolioComponentDetails?.[c.id];
        const disp = resolveTlDisplayForPdf(
          project,
          rec,
          c.id,
          d
            ? {
                grade: d.grade,
                percent: d.percent,
                pointsRaw: d.pointsRaw,
                pointsMax: d.pointsMax,
              }
            : null,
          row.portfolioComponentGrades?.[c.id] ??
            rec?.portfolioGrades?.[c.id] ??
            null
        );
        const g = disp.grade;
        const pct =
          disp.percent != null
            ? `${pdfText(formatPoints(disp.percent * 100, 1))} %${
                disp.partial ? "*" : ""
              }`
            : "–";
        const raw =
          disp.pointsRaw != null && disp.pointsMax != null
            ? `${pdfPoints(disp.pointsRaw)}/${pdfPoints(disp.pointsMax)}${
                disp.partial ? "*" : ""
              }`
            : "–";
        const byL = rec?.portfolioGradesByLecturer?.[c.id] ?? {};
        const lecCells = perLecturer
          ? lecturers.map((l) => {
              const direct = byL[l];
              if (direct != null && Number.isFinite(direct)) {
                return pdfGrade(direct);
              }
              // Teilbewertung je Dozent aus Kriterien
              if (project.portfolioCriteriaMode && c.criteria?.length) {
                const scale = resolveComponentCriteriaScale(c);
                const crits = (c.criteria ?? []).map((k) => ({
                  ...k,
                  scale,
                }));
                const vals =
                  rec?.portfolioCriterionValuesByLecturer?.[c.id]?.[l] ??
                  {};
                const u = unitAvgFromCriterionValuesPartial(vals, crits);
                if (u != null) {
                  return `${pdfGrade(gradeFromUnitAvg(u, scale, project.gradeSchema))}*`;
                }
              }
              return "–";
            })
          : [];
        return [
          pdfText(c.code || c.name),
          pdfText(c.name),
          pdfText(String(c.weight ?? 1)),
          g != null
            ? `${pdfGrade(g)}${disp.partial ? "*" : ""}`
            : "–",
          pct,
          raw,
          ...lecCells,
        ];
      });

      const colStyles: UserOptions["columnStyles"] = {
        0: { cellWidth: 16 },
        2: { cellWidth: 12, halign: "right" },
        3: { cellWidth: 16, halign: "right", fontStyle: "bold" },
        4: { cellWidth: 18, halign: "right" },
        5: { cellWidth: 24, halign: "right" },
      };
      if (perLecturer) {
        for (let i = 0; i < lecturers.length; i++) {
          colStyles[6 + i] = {
            cellWidth: Math.min(22, 80 / Math.max(lecturers.length, 1)),
            halign: "right",
          };
        }
      }

      y = tableY(doc, y, {
        head: [head],
        body: tlBody,
        styles: { fontSize: perLecturer ? 7 : 8 },
        columnStyles: colStyles,
      });

      if (
        tlBody.some((r) => r.some((cell) => String(cell).includes("*")))
      ) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(80);
        doc.text(
          pdfText(
            "* Aus den bisher bewerteten Kriterien berechnet (unvollständig)."
          ),
          PDF_MARGIN,
          y
        );
        doc.setTextColor(0);
        doc.setFont("helvetica", "normal");
        y += 5;
      }
    }

    if (on(sections, "portfolioCriteria") && critMode) {
      for (const c of components) {
        const crits = c.criteria ?? [];
        if (crits.length === 0) continue;

        y = beginSection(doc, `Kriterien · ${c.code || c.name}`, y, 22);

        if (perLecturer) {
          // Eine Tabelle: Kriterien × Dozenten-Spalten
          const head = [
            "Kürzel",
            "Kriterium",
            "Gew.",
            "Skala",
            ...lecturers.map((l, i) => shortLecturer(l, i, lecturers.length)),
          ];
          const body = crits.map((cr) => {
            const cells = lecturers.map((lec) => {
              const v =
                rec?.portfolioCriterionValuesByLecturer?.[c.id]?.[lec]?.[
                  cr.id
                ] ?? null;
              return formatCriterionRaw(v, cr);
            });
            return [
              pdfText(cr.code || cr.name),
              pdfText(cr.name),
              pdfText(String(cr.weight ?? 1)),
              pdfText(criterionScaleLabel(cr)),
              ...cells,
            ];
          });
          y = tableY(doc, y, {
            head: [head],
            body,
            styles: { fontSize: 7 },
            columnStyles: {
              0: { cellWidth: 16 },
              2: { cellWidth: 12, halign: "right" },
              3: { cellWidth: 20 },
            },
          });
        } else {
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
    y = beginSection(doc, "Zweitkorrektur", y, 16);
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
  options?: StudentPerformancePdfOptions,
  allRows?: EnrichedStudentRow[]
): void {
  const { doc, baseName } = buildStudentPerformancePdf(
    project,
    row,
    options,
    allRows
  );
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
    exportStudentPerformancePdf(project, selected[0], options, rows);
    return { count: 1, mode: "pdf" };
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const row of selected) {
    const { doc, baseName } = buildStudentPerformancePdf(
      project,
      row,
      options,
      rows
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
