import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { ExamProject } from "@/lib/types";
import { datedExportFilename, downloadBlob, formatGrade, formatPoints } from "@/lib/utils";

export const PDF_MARGIN = 14;
export const PDF_PAGE_WIDTH = 210;
export const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;

export function createPdfDoc(): jsPDF {
  return new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });
}

/** Latin-1-sichere Zeichenkette für Helvetica */
export function pdfText(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/\u00a0/g, " ")
    .replace(/[–—]/g, "-")
    .replace(/[„“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

export function pdfGrade(g: number | null | undefined): string {
  return pdfText(formatGrade(g));
}

export function pdfPoints(p: number | null | undefined): string {
  return pdfText(formatPoints(p));
}

export function formatDeDate(d = new Date()): string {
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function examHeaderLines(project: ExamProject): string[] {
  const lines: string[] = [];
  if (project.examNumber) {
    lines.push(`Prüfungsnummer: ${pdfText(project.examNumber)}`);
  }
  lines.push(`Prüfung: ${pdfText(project.name)}`);
  if (project.semester) {
    lines.push(`Semester: ${pdfText(project.semester)}`);
  }
  if (project.lecturers?.length) {
    lines.push(`Prüfer: ${pdfText(project.lecturers.join(", "))}`);
  }
  lines.push(
    `Bestehensgrenze: ${project.gradeSchema.passThreshold} Pkt. (von ${project.gradeSchema.maxPoints})`
  );
  return lines;
}

export function drawDocTitle(
  doc: jsPDF,
  title: string,
  startY = PDF_MARGIN
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(pdfText(title), PDF_MARGIN, startY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  doc.text(`ExamGrade · ${formatDeDate()}`, PDF_PAGE_WIDTH - PDF_MARGIN, startY, {
    align: "right",
  });
  doc.setTextColor(0);
  return startY + 8;
}

export function drawKeyValueBlock(
  doc: jsPDF,
  lines: string[],
  startY: number,
  lineHeight = 5
): number {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = startY;
  for (const line of lines) {
    doc.text(pdfText(line), PDF_MARGIN, y);
    y += lineHeight;
  }
  return y + 2;
}

export function drawSignatureBlock(
  doc: jsPDF,
  lecturers: string[],
  startY: number,
  options?: { label?: string }
): number {
  const names =
    lecturers.filter(Boolean).length > 0
      ? lecturers.filter(Boolean)
      : ["Prüfer"];
  let y = startY + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(pdfText(options?.label ?? "Unterschriften"), PDF_MARGIN, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  for (const name of names) {
    // Neue Seite falls nötig
    if (y > 270) {
      doc.addPage();
      y = PDF_MARGIN + 10;
    }
    doc.text(pdfText(name), PDF_MARGIN, y);
    y += 6;
    doc.text("Datum: ____________________", PDF_MARGIN, y);
    doc.text(
      "Unterschrift: ________________________________",
      PDF_MARGIN + 70,
      y
    );
    y += 12;
  }
  return y;
}

export function addPageNumbers(doc: jsPDF): void {
  const total = doc.getNumberOfPages();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.text(
      `Seite ${i} von ${total}`,
      PDF_PAGE_WIDTH / 2,
      290,
      { align: "center" }
    );
  }
  doc.setTextColor(0);
}

export function getLastTableY(doc: jsPDF, fallback: number): number {
  const ext = doc as jsPDF & { lastAutoTable?: { finalY?: number } };
  return ext.lastAutoTable?.finalY ?? fallback;
}

export function savePdf(doc: jsPDF, baseName: string): void {
  addPageNumbers(doc);
  const blob = doc.output("blob");
  downloadBlob(datedExportFilename(baseName, "pdf"), blob);
}

export function shortStatus(row: {
  status: string;
  attendanceWithoutHis?: boolean;
  isFailed: boolean;
  attended: boolean | null;
}): string {
  if (row.attendanceWithoutHis) return "ohne HIS";
  if (row.status === "no_show" || row.attended === false) return "No-Show";
  if (row.isFailed) return "nicht best.";
  if (row.status === "export_ready" || row.status === "graded") return "bewertet";
  if (row.status === "points") return "Punkte";
  if (row.status === "attended") return "angetreten";
  if (row.status === "mismatch") return "Unstimmigk.";
  return "angemeldet";
}

export { autoTable, jsPDF };
