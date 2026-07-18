import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  EnrichedStudentRow,
  ExamProject,
  PointsRecord,
} from "@/lib/types";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { downloadBlob } from "@/lib/download";
import { datedExportFilename, formatGrade, formatPoints } from "@/lib/utils";

export const PDF_MARGIN = 14;
export const PDF_PAGE_WIDTH = 210;
export const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;

/** OTH-Blau aus oth_hoessl_header */
export const OTH_BLUE: [number, number, number] = [68, 112, 153]; // #447099
export const OTH_BLUE_DARK: [number, number, number] = [44, 81, 113]; // #2c5171
export const OTH_MUTED: [number, number, number] = [91, 100, 112];

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

/**
 * OTH-Hößl-Letterhead analog oth_hoessl_header.html / .tex
 * @returns Y-Position unterhalb des Headers
 */
export function drawOthHeader(
  doc: jsPDF,
  options?: { subjectLine?: string }
): number {
  const top = 8;
  const boxH = 22;
  const left = PDF_MARGIN;
  const width = PDF_CONTENT_WIDTH;

  // Hintergrund leicht getönt
  doc.setFillColor(238, 243, 248);
  doc.setDrawColor(221, 227, 234);
  doc.roundedRect(left, top, width, boxH, 2, 2, "FD");

  // Linker blauer Akzent
  doc.setFillColor(...OTH_BLUE);
  doc.rect(left, top, 1.8, boxH, "F");

  // Logo-Platzhalter (OTH-Kasten)
  const logoX = left + 4;
  const logoY = top + 3.5;
  doc.setFillColor(...OTH_BLUE_DARK);
  doc.roundedRect(logoX, logoY, 16, 15, 1, 1, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("OTH", logoX + 8, logoY + 9, { align: "center" });

  const textX = logoX + 20;
  doc.setTextColor(...OTH_BLUE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text(
    pdfText("OTH REGENSBURG  ·  FAKULTÄT BUSINESS AND MANAGEMENT"),
    textX,
    top + 6
  );

  doc.setTextColor(34, 40, 47);
  doc.setFontSize(12);
  doc.text(pdfText("Prof. Dr. Wolfgang Hößl"), textX, top + 12);

  doc.setTextColor(...OTH_MUTED);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const subject =
    options?.subjectLine?.trim() ||
    "Internationale Finanzmärkte und Asset Management";
  doc.text(pdfText(subject), textX, top + 17.5);

  // Blaue Linie unter dem Header
  const lineY = top + boxH + 2;
  doc.setDrawColor(...OTH_BLUE);
  doc.setLineWidth(0.45);
  doc.line(left, lineY, left + width, lineY);
  doc.setLineWidth(0.2);
  doc.setTextColor(0);

  return lineY + 6;
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

/** Dokumenttitel unter OTH-Header; gibt nächste Y zurück */
export function drawDocTitle(
  doc: jsPDF,
  title: string,
  startY: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(0);
  doc.text(pdfText(title), PDF_MARGIN, startY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100);
  doc.text(
    `ExamGrade · ${formatDeDate()}`,
    PDF_PAGE_WIDTH - PDF_MARGIN,
    startY,
    { align: "right" }
  );
  doc.setTextColor(0);
  return startY + 7;
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
    doc.text(`Seite ${i} von ${total}`, PDF_PAGE_WIDTH / 2, 290, {
      align: "center",
    });
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
  void downloadBlob(datedExportFilename(baseName, "pdf"), blob);
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

export function findPointsRecord(
  project: ExamProject,
  matKey: string
): PointsRecord | undefined {
  return project.points.find(
    (p) => normalizeMatriculation(p.matriculationNumber) === matKey
  );
}

/** Studiengang: HIS-Quelle, sonst manuell */
export function resolveProgramCode(
  row: EnrichedStudentRow,
  project: ExamProject
): string {
  if (row.programCode) return row.programCode;
  const rec = findPointsRecord(project, row.key);
  if (rec?.manualProgramCode?.trim()) return rec.manualProgramCode.trim();
  return "";
}

export function startPdfWithHeader(
  project: ExamProject,
  title: string
): { doc: jsPDF; y: number } {
  const doc = createPdfDoc();
  let y = drawOthHeader(doc, { subjectLine: project.name });
  y = drawDocTitle(doc, title, y);
  return { doc, y };
}

export { autoTable, jsPDF };
