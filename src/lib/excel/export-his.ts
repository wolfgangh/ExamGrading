import { datedExportFilename, downloadBlob, formatGrade } from "@/lib/utils";
import type { EnrichedStudentRow, ExamProject, ExamStatistics } from "@/lib/types";

/**
 * Erzeugt HIS/QIS-Noteneintrags-Excel (direkt hochladbar).
 */
export async function exportHisExcel(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "ExamGrade";
  wb.created = new Date();

  const hisRows = rows
    .filter((r) => r.inHis)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // --- Blatt Noteneintrag ---
  const ws = wb.addWorksheet("Noteneintrag");

  const title =
    project.hisTemplateMeta?.titleCell ||
    `${project.examNumber}  ${project.name}`.trim();

  ws.getCell("A1").value = title;
  ws.getCell("I1").value = "Auf Antritte OHNE Prüfungsteilnahme prüfen!!";
  ws.getCell("A4").value = "Datum";
  ws.getCell("C4").value = new Date().toLocaleDateString("de-DE");
  ws.getCell("I5").value = "Anmeldungen HISin One";
  ws.getCell("J5").value = "Antritt Prüfung";
  ws.getCell("K5").value = "No-Show Quote";
  ws.getCell("I6").value = stats.registered;
  ws.getCell("J6").value = stats.attended;
  ws.getCell("K6").value =
    stats.noShowRate != null
      ? Math.round(stats.noShowRate * 1000) / 1000
      : null;

  const lecturers = project.lecturers;
  if (lecturers[0]) ws.getCell("A7").value = lecturers[0];
  if (lecturers[1]) ws.getCell("C7").value = lecturers[1];

  ws.getCell("G8").value = "Antritte";
  ws.getCell("H8").value = "Test";
  ws.getCell("I8").value = "Antritte OHNE Prüfungsteilnahme";

  ws.getCell("A9").value = "startHISsheet";
  ws.getCell("F9").value = "endHISsheet";
  ws.getCell("G9").value = stats.attended;
  ws.getCell("H9").value = stats.withPoints;
  ws.getCell("I9").value = stats.noShow;

  const headerRow = 10;
  const headers = [
    "Nachname",
    "Vorname",
    "Matrikelnummer",
    "bewertung",
    "Antritt",
    "Test",
  ];
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = { bold: true };
  });

  hisRows.forEach((row, idx) => {
    const r = headerRow + 1 + idx;
    const isNoShow = row.status === "no_show" || row.attended === false;
    const hasTest = row.hasPoints;

    ws.getCell(r, 1).value = row.student.lastName;
    ws.getCell(r, 2).value = row.student.firstName;
    ws.getCell(r, 3).value = Number(row.key) || row.key;
    if (!isNoShow && row.finalGrade != null) {
      ws.getCell(r, 4).value = row.finalGrade;
    }
    ws.getCell(r, 5).value = row.attended === true ? "Ja" : "-";
    ws.getCell(r, 6).value = hasTest ? "Ja" : "-";
  });

  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 16;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 12;
  ws.getColumn(5).width = 10;
  ws.getColumn(6).width = 10;

  // --- Blatt Durchfaller ---
  const fail = hisRows.filter(
    (r) => r.finalGrade != null && r.finalGrade >= 4.0 && r.attended !== false
  );
  const wsFail = wb.addWorksheet("Durchfaller");
  wsFail.getCell("A1").value = title;
  ["Nachname", "Vorname", "Matrikelnummer", "bewertung", "Punkte", "Antritt"].forEach(
    (h, i) => {
      const cell = wsFail.getCell(3, i + 1);
      cell.value = h;
      cell.font = { bold: true };
    }
  );
  fail.forEach((row, idx) => {
    const r = 4 + idx;
    wsFail.getCell(r, 1).value = row.student.lastName;
    wsFail.getCell(r, 2).value = row.student.firstName;
    wsFail.getCell(r, 3).value = Number(row.key) || row.key;
    wsFail.getCell(r, 4).value = row.finalGrade;
    wsFail.getCell(r, 5).value = row.totalPoints;
    wsFail.getCell(r, 6).value = row.attended === true ? "Ja" : "-";
  });

  // --- Blatt Statistik ---
  const wsStat = wb.addWorksheet("Statistik");
  const statLines: [string, string | number | null][] = [
    ["Prüfung", project.name],
    ["Prüfungsnummer", project.examNumber],
    ["Semester", project.semester],
    ["Anmeldungen", stats.registered],
    ["Antritte", stats.attended],
    ["No-Shows", stats.noShow],
    [
      "No-Show-Quote",
      stats.noShowRate != null
        ? `${(stats.noShowRate * 100).toFixed(1)} %`
        : "–",
    ],
    [
      "Durchschnittsnote",
      stats.averageGrade != null ? formatGrade(stats.averageGrade) : "–",
    ],
    [
      "Bestehensquote",
      stats.passRate != null
        ? `${(stats.passRate * 100).toFixed(1)} %`
        : "–",
    ],
    [
      "Punktedurchschnitt",
      stats.averagePoints != null
        ? Math.round(stats.averagePoints * 10) / 10
        : "–",
    ],
  ];
  statLines.forEach(([label, value], i) => {
    wsStat.getCell(i + 1, 1).value = label;
    wsStat.getCell(i + 1, 2).value = value;
  });

  wsStat.getCell(statLines.length + 2, 1).value = "Notenverteilung";
  wsStat.getCell(statLines.length + 3, 1).value = "Note";
  wsStat.getCell(statLines.length + 3, 2).value = "Anzahl";
  stats.gradeDistribution.forEach((g, i) => {
    wsStat.getCell(statLines.length + 4 + i, 1).value = g.grade;
    wsStat.getCell(statLines.length + 4 + i, 2).value = g.count;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(
    datedExportFilename(`Noteneintrag_${project.name || "Pruefung"}`, "xlsx"),
    blob
  );
}
