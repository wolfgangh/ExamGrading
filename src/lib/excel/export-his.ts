import { getHisSources } from "@/lib/his-sources";
import { datedExportFilename, downloadBlob, formatGrade } from "@/lib/utils";
import type {
  EnrichedStudentRow,
  ExamProject,
  ExamStatistics,
  HisSource,
} from "@/lib/types";

function gradeByMat(
  rows: EnrichedStudentRow[],
  mat: string
): EnrichedStudentRow | undefined {
  return rows.find((r) => r.key === mat && r.inHis);
}

/**
 * Exportiert alle HIS-Quellen als separate Dateien (QIS erwartet pro Studiengang eine Datei).
 */
export async function exportHisExcel(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics
): Promise<void> {
  const sources = getHisSources(project);
  if (sources.length === 0) {
    await exportLegacySingle(project, rows, stats);
    return;
  }

  for (const source of sources) {
    await exportOneSource(project, source, rows, stats);
  }
}

async function exportOneSource(
  project: ExamProject,
  source: HisSource,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "ExamGrade";
  wb.created = new Date();

  const format = source.meta.format ?? "legacy";
  const sourceRows = [...source.rows].sort(
    (a, b) => a.orderIndex - b.orderIndex
  );

  if (format === "hisinone_v2") {
    const ws = wb.addWorksheet("Noteneintrag");
    const title =
      source.meta.titleCell ||
      `${source.examNumber} - ${project.name}`.trim();
    ws.getCell("A1").value = title;

    if (source.meta.examCheckToken) {
      ws.getCell("A3").value = "EXAM_CHECK_TOKEN";
      ws.getCell("B3").value = source.meta.examCheckToken;
    }

    ws.getCell("A5").value = "startHISsheet";

    const headers = source.meta.headerColumns?.length
      ? source.meta.headerColumns
      : [
          "Examplan.id",
          "PrüfungsNr.",
          "Titel",
          "Nachname",
          "Vorname",
          "Matrikelnummer",
          "Leistung",
          "Status",
          "Semester",
          "Jahr",
          "Vermerk",
        ];

    const headerRow = 6;
    headers.forEach((h, i) => {
      const cell = ws.getCell(headerRow, i + 1);
      cell.value = h;
      cell.font = { bold: true };
    });

    const col = (name: string) => {
      const i = headers.findIndex(
        (h) => h.toLowerCase().trim() === name.toLowerCase()
      );
      return i >= 0 ? i + 1 : -1;
    };

    sourceRows.forEach((his, idx) => {
      const r = headerRow + 1 + idx;
      const mat = his.matriculationNumber;
      const enriched = gradeByMat(rows, mat);
      const isNoShow =
        enriched?.status === "no_show" || enriched?.attended === false;
      const grade =
        !isNoShow && enriched?.finalGrade != null
          ? enriched.finalGrade
          : null;

      const setIf = (headerNames: string[], value: unknown) => {
        for (const hn of headerNames) {
          const c = col(hn);
          if (c > 0) {
            ws.getCell(r, c).value = value as string | number | null;
            return;
          }
        }
      };

      setIf(["Examplan.id", "examplan.id"], his.examPlanId ?? "");
      setIf(
        ["PrüfungsNr.", "Prüfungsnr.", "PruefungsNr."],
        his.examNumber || source.examNumber
      );
      setIf(["Titel", "Title"], his.title ?? project.name);
      setIf(["Nachname", "Name"], his.lastName);
      setIf(["Vorname"], his.firstName);
      setIf(
        ["Matrikelnummer"],
        Number(mat) || mat
      );
      setIf(["Leistung", "bewertung", "Note"], grade);
      setIf(["Status"], his.status ?? "");
      setIf(["Semester"], his.semester ?? "");
      setIf(["Jahr"], his.year ?? "");
      setIf(["Vermerk"], his.vermerk ?? "");
    });
  } else {
    // Legacy-Format
    const ws = wb.addWorksheet("Noteneintrag");
    const title =
      source.meta.titleCell ||
      `${source.examNumber}  ${project.name}`.trim();
    ws.getCell("A1").value = title;
    ws.getCell("I1").value = "Auf Antritte OHNE Prüfungsteilnahme prüfen!!";
    ws.getCell("A4").value = "Datum";
    ws.getCell("C4").value = new Date().toLocaleDateString("de-DE");
    ws.getCell("I5").value = "Anmeldungen HISin One";
    ws.getCell("J5").value = "Antritt Prüfung";
    ws.getCell("K5").value = "No-Show Quote";

    const inSource = rows.filter(
      (r) =>
        r.inHis &&
        (r.hisSourceId === source.id ||
          (!r.hisSourceId && sourcesOnlyOne(project)))
    );
    const registered = sourceRows.length;
    const attended = inSource.filter((r) => r.attended === true).length;
    const noShow = inSource.filter(
      (r) => r.status === "no_show" || r.attended === false
    ).length;

    ws.getCell("I6").value = registered;
    ws.getCell("J6").value = attended;
    ws.getCell("K6").value =
      registered > 0 ? Math.round((noShow / registered) * 1000) / 1000 : null;

    const lecturers = project.lecturers;
    if (lecturers[0]) ws.getCell("A7").value = lecturers[0];
    if (lecturers[1]) ws.getCell("C7").value = lecturers[1];

    ws.getCell("A9").value = "startHISsheet";
    ws.getCell("F9").value = "endHISsheet";

    const headerRow = 10;
    ["Nachname", "Vorname", "Matrikelnummer", "bewertung", "Antritt", "Test"].forEach(
      (h, i) => {
        const cell = ws.getCell(headerRow, i + 1);
        cell.value = h;
        cell.font = { bold: true };
      }
    );

    sourceRows.forEach((his, idx) => {
      const r = headerRow + 1 + idx;
      const enriched = gradeByMat(rows, his.matriculationNumber);
      const isNoShow =
        enriched?.status === "no_show" || enriched?.attended === false;
      const hasTest = enriched?.hasPoints === true;

      ws.getCell(r, 1).value = his.lastName;
      ws.getCell(r, 2).value = his.firstName;
      ws.getCell(r, 3).value =
        Number(his.matriculationNumber) || his.matriculationNumber;
      if (!isNoShow && enriched?.finalGrade != null) {
        ws.getCell(r, 4).value = enriched.finalGrade;
      }
      ws.getCell(r, 5).value = enriched?.attended === true ? "Ja" : "-";
      ws.getCell(r, 6).value = hasTest ? "Ja" : "-";
    });
  }

  // Statistik-Blatt (pro Datei)
  const wsStat = wb.addWorksheet("Statistik");
  wsStat.getCell(1, 1).value = "Studiengang";
  wsStat.getCell(1, 2).value = source.programCode;
  wsStat.getCell(2, 1).value = "Prüfungsnummer";
  wsStat.getCell(2, 2).value = source.examNumber;
  wsStat.getCell(3, 1).value = "Anmeldungen (diese Datei)";
  wsStat.getCell(3, 2).value = sourceRows.length;
  wsStat.getCell(4, 1).value = "Aktives Notenszenario (Bestehen)";
  wsStat.getCell(4, 2).value = project.gradeSchema.passThreshold;
  wsStat.getCell(5, 1).value = "Gesamt-Anmeldungen (alle Studiengänge)";
  wsStat.getCell(5, 2).value = stats.registered;
  wsStat.getCell(6, 1).value = "Ø Note";
  wsStat.getCell(6, 2).value = stats.averageGrade;
  wsStat.getCell(7, 1).value = "Median Note";
  wsStat.getCell(7, 2).value = stats.medianGrade;
  wsStat.getCell(8, 1).value = "Stabw. Note";
  wsStat.getCell(8, 2).value = stats.stdDevGrade;
  wsStat.getCell(9, 1).value = "Bestehensquote";
  wsStat.getCell(9, 2).value =
    stats.passRate != null ? stats.passRate : null;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeCode = source.programCode || "HIS";
  const safeNum = (source.examNumber || "export")
    .replace(/[^\w\-]+/g, "_")
    .slice(0, 40);
  downloadBlob(
    datedExportFilename(`Noteneintrag_${safeCode}_${safeNum}`, "xlsx"),
    blob
  );
}

function sourcesOnlyOne(project: ExamProject): boolean {
  return getHisSources(project).length <= 1;
}

async function exportLegacySingle(
  project: ExamProject,
  rows: EnrichedStudentRow[],
  stats: ExamStatistics
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Noteneintrag");
  const title = `${project.examNumber}  ${project.name}`.trim();
  ws.getCell("A1").value = title;
  const headerRow = 10;
  ["Nachname", "Vorname", "Matrikelnummer", "bewertung", "Antritt", "Test"].forEach(
    (h, i) => {
      ws.getCell(headerRow, i + 1).value = h;
    }
  );
  rows
    .filter((r) => r.inHis)
    .forEach((row, idx) => {
      const r = headerRow + 1 + idx;
      const isNoShow = row.status === "no_show" || row.attended === false;
      ws.getCell(r, 1).value = row.student.lastName;
      ws.getCell(r, 2).value = row.student.firstName;
      ws.getCell(r, 3).value = Number(row.key) || row.key;
      if (!isNoShow && row.finalGrade != null) {
        ws.getCell(r, 4).value = row.finalGrade;
      }
      ws.getCell(r, 5).value = row.attended === true ? "Ja" : "-";
      ws.getCell(r, 6).value = row.hasPoints ? "Ja" : "-";
    });
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    datedExportFilename(`Noteneintrag_${project.name || "Pruefung"}`, "xlsx"),
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  );
  void formatGrade;
  void stats;
}
