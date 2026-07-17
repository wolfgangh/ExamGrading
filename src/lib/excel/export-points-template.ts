import type { ExamProject, Student } from "@/lib/types";
import { getHisSources } from "@/lib/his-sources";
import { normalizeMatriculation } from "@/lib/matching/matriculation";
import { datedExportFilename, downloadBlob } from "@/lib/utils";

const EXTRA_EMPTY_ROWS = 15;

/**
 * Erzeugt eine ausfüllbare Punkte-Vorlage für Präsenzklausuren.
 * Kompatibel mit parsePointsMatrix (Re-Import unter Importe → Punkte).
 */
export async function exportPointsTemplate(
  project: ExamProject
): Promise<void> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "ExamGrade";
  wb.created = new Date();

  const ws = wb.addWorksheet("Punkte", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const max = project.gradeSchema.maxPoints;
  const subAreas = project.subAreas ?? [];

  // Header – Reihenfolge wichtig für autoMap (Gesamtpunkte vor „Punkte X“)
  const headers: string[] = [
    "Matrikelnummer",
    "Nachname",
    "Vorname",
    "Gesamtpunkte",
  ];
  for (const sa of subAreas) {
    headers.push(`Punkte ${sa.code}`);
  }
  headers.push("Anmerkung");

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF447099" },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

  // Studierende aus HIS (+ bereits bekannte students)
  const byKey = new Map<string, Student>();

  for (const s of Object.values(project.students ?? {})) {
    const k = normalizeMatriculation(s.matriculationNumber);
    if (k) byKey.set(k, s);
  }
  for (const src of getHisSources(project)) {
    for (const row of src.rows) {
      const k = normalizeMatriculation(row.matriculationNumber);
      if (!k) continue;
      const prev = byKey.get(k);
      byKey.set(k, {
        matriculationNumber: row.matriculationNumber,
        lastName: row.lastName || prev?.lastName || "",
        firstName: row.firstName || prev?.firstName || "",
        email: prev?.email,
        attempt: prev?.attempt ?? null,
      });
    }
  }

  const sorted = [...byKey.values()].sort((a, b) => {
    const ln = a.lastName.localeCompare(b.lastName, "de");
    if (ln !== 0) return ln;
    return a.firstName.localeCompare(b.firstName, "de");
  });

  for (const s of sorted) {
    const row: (string | number | null)[] = [
      s.matriculationNumber,
      s.lastName,
      s.firstName,
      null, // Gesamtpunkte
    ];
    for (let i = 0; i < subAreas.length; i++) row.push(null);
    row.push(null); // Anmerkung
    ws.addRow(row);
  }

  // Leere Zeilen für Personen ohne HIS
  for (let i = 0; i < EXTRA_EMPTY_ROWS; i++) {
    const row: (string | null)[] = [null, null, null, null];
    for (let j = 0; j < subAreas.length; j++) row.push(null);
    row.push(i === 0 ? "(weitere Person ohne HIS hier eintragen)" : null);
    ws.addRow(row);
  }

  // Spaltenbreiten
  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 18;
  ws.getColumn(3).width = 16;
  ws.getColumn(4).width = 14;
  for (let c = 5; c <= headers.length; c++) {
    ws.getColumn(c).width = c === headers.length ? 36 : 12;
  }

  // Hinweise-Blatt
  const hi = wb.addWorksheet("Hinweise");
  hi.getColumn(1).width = 90;
  const lines = [
    `ExamGrade – Punkte-Vorlage für Klausur`,
    `Prüfung: ${project.name}`,
    project.examNumber ? `Prüfungsnummer: ${project.examNumber}` : "",
    `Maximalpunkte: ${max}`,
    "",
    "Ausfüllen:",
    "• Gesamtpunkte eintragen (empfohlen), ODER die Teilgebietsspalten – dann Summe bilden.",
    "• Matrikelnummer, Nachname und Vorname nicht ändern (außer bei neuen Personen).",
    "• Personen ohne HIS-Anmeldung: in den leeren Zeilen unten Matr.-Nr. + Name + Punkte eintragen.",
    "• Diese Datei unter „Importe“ → „Punkte importieren (Vorlage)“ wieder hochladen.",
    "• Danach Noten, Szenarien und Export wie gewohnt.",
    "",
    "Hinweis: Die Datei enthält die Stammdaten; Original-HIS-Pfade werden nicht benötigt.",
  ].filter(Boolean);
  lines.forEach((t, i) => {
    hi.getCell(i + 1, 1).value = t;
    if (i === 0) hi.getCell(i + 1, 1).font = { bold: true, size: 14 };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(
    datedExportFilename(
      `Klausur_Punktevorlage_${project.name || "Pruefung"}`,
      "xlsx"
    ),
    blob
  );
}
