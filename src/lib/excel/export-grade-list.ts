import type { EnrichedStudentRow, ExamProject } from "@/lib/types";
import { HISINONE_LABEL } from "@/lib/types";
import { uniqueRowsByMatriculation } from "@/lib/grades/statistics";
import { downloadBlob } from "@/lib/download";
import { datedExportFilename, formatGrade } from "@/lib/utils";

export type GradeListRow = {
  matriculation: string;
  lastName: string;
  firstName: string;
  programCode: string;
  source: string;
  grade: string;
  remark: string;
};

/**
 * Zeilen der Excel-Notenliste: alle Personen der Teilnehmerliste
 * (HISinOne-Dateien und manuelle Teilnehmerliste), sortiert nach Name.
 */
export function buildGradeListRows(
  rows: EnrichedStudentRow[]
): GradeListRow[] {
  return uniqueRowsByMatriculation(rows)
    .filter((r) => r.inHis)
    .sort(
      (a, b) =>
        a.student.lastName.localeCompare(b.student.lastName, "de") ||
        a.student.firstName.localeCompare(b.student.firstName, "de")
    )
    .map((r) => {
      const noShow = r.status === "no_show";
      const remarks: string[] = [];
      if (noShow) remarks.push("nicht angetreten");
      if (!noShow && r.finalGrade == null) remarks.push("noch keine Note");
      if (r.gradeOverride != null) remarks.push("Note manuell gesetzt");
      if (r.student.takenOverFromManual) {
        remarks.push("aus manueller Liste in HISinOne übernommen");
      }
      return {
        matriculation: r.key,
        lastName: r.student.lastName,
        firstName: r.student.firstName,
        programCode: r.programCode ?? "",
        source: r.fromManualList ? "manuell" : HISINONE_LABEL,
        grade: !noShow && r.finalGrade != null ? formatGrade(r.finalGrade) : "",
        remark: remarks.join("; "),
      };
    });
}

/**
 * Excel-Notenliste (Matrikel, Name, Studiengang, Note, Bemerkung) – v. a. für
 * Teilnehmer ohne HISinOne-Datei (manuelle Teilnehmerliste).
 */
export async function exportGradeListExcel(
  project: ExamProject,
  rows: EnrichedStudentRow[]
): Promise<void> {
  const list = buildGradeListRows(rows);
  if (list.length === 0) {
    throw new Error("Keine Teilnehmer in der Teilnehmerliste.");
  }
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "ExamGrade";
  wb.created = new Date();
  const ws = wb.addWorksheet("Notenliste");

  ws.getCell(1, 1).value = project.name || "Prüfung";
  ws.getCell(1, 1).font = { bold: true, size: 13 };
  ws.getCell(2, 1).value = [
    project.semester,
    project.examNumber,
    (project.lecturers ?? []).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");

  const header = [
    "Matrikelnummer",
    "Nachname",
    "Vorname",
    "Studiengang",
    "Quelle",
    "Note",
    "Bemerkung",
  ];
  const headerRow = ws.getRow(4);
  header.forEach((h, i) => {
    const c = headerRow.getCell(i + 1);
    c.value = h;
    c.font = { bold: true };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
  });
  list.forEach((r, i) => {
    const row = ws.getRow(5 + i);
    row.values = [
      r.matriculation,
      r.lastName,
      r.firstName,
      r.programCode,
      r.source,
      r.grade,
      r.remark,
    ];
  });
  [16, 22, 18, 13, 11, 8, 40].forEach((w, i) => {
    ws.getColumn(i + 1).width = w;
  });
  ws.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4 + list.length, column: header.length },
  };
  ws.views = [{ state: "frozen", ySplit: 4 }];

  const buffer = await wb.xlsx.writeBuffer();
  await downloadBlob(
    datedExportFilename(`Notenliste_${project.name || "Pruefung"}`, "xlsx"),
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
}
